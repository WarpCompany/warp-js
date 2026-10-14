import { Controller, assertBrowser, run } from './controller'
import { WarpCheckoutError } from './errors'
import type { CheckoutInstance, CheckoutOptions } from './types'

export const POPUP_WIDTH = 480
export const POPUP_HEIGHT = 720
export const POPUP_POLL_MS = 500

let counter = 0

function popupFeatures(): string {
  const w = window
  const outerW = w.outerWidth || w.innerWidth || POPUP_WIDTH
  const outerH = w.outerHeight || w.innerHeight || POPUP_HEIGHT
  const left = Math.max(0, Math.round((w.screenX || 0) + (outerW - POPUP_WIDTH) / 2))
  const top = Math.max(0, Math.round((w.screenY || 0) + (outerH - POPUP_HEIGHT) / 2))
  return `popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`
}

function showPlaceholder(popup: Window): void {
  try {
    const doc = popup.document
    doc.title = 'Warp checkout'
    doc.body.style.cssText =
      'margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font:14px system-ui,sans-serif;color:#6b6b76'
    doc.body.textContent = 'Loading checkout…'
  } catch {
    // Not accessible; the checkout page replaces it shortly anyway.
  }
}

/** Popup window (fallback when framing is not allowed). Call from a user gesture; opens the window synchronously, then navigates it once the URL resolves. Calls onClose when the window closes. */
export function openCheckoutPopup(options: CheckoutOptions): Promise<CheckoutInstance> {
  const c = new Controller(options)
  let popup: Window | null = null
  let setupError: unknown = null

  // Everything up to window.open runs synchronously so the user gesture is still active.
  try {
    assertBrowser()
    c.prepare()
    if (!options.signal?.aborted) {
      popup = window.open('about:blank', `warp_checkout_${Date.now()}_${++counter}`, popupFeatures())
      if (!popup) {
        throw new WarpCheckoutError(
          'popup_blocked',
          'The checkout popup was blocked. Call openCheckoutPopup directly from a click handler.',
        )
      }
    }
  } catch (error) {
    setupError = error
  }

  return run(c, async () => {
    if (setupError) throw setupError
    const win = popup
    if (!win) return
    showPlaceholder(win)
    c.source = () => win
    c.listen()
    const poll = setInterval(() => {
      if (win.closed) c.dismiss()
    }, POPUP_POLL_MS)
    c.addCleanup(() => {
      clearInterval(poll)
      try {
        if (!win.closed) win.close()
      } catch {
        // ignore
      }
    })
    c.hooks.cancel = () => c.close()
    c.hooks.return = () => c.close()

    const src = await c.resolveUrl('popup')
    if (c.destroyed) return
    if (win.closed) {
      c.dismiss()
      return
    }
    win.location.replace(src)
    try {
      win.focus()
    } catch {
      // ignore
    }
  })
}
