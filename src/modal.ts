import { Controller, assertBrowser, run } from './controller'
import { createFrame } from './frame'
import type { CheckoutInstance, CheckoutOptions } from './types'

const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>'

/** Full-screen modal overlay with the iframe; closes on Escape/backdrop/close button (calls onCancel) and after onReturn, then calls onClose. */
export function openCheckoutModal(options: CheckoutOptions): Promise<CheckoutInstance> {
  const c = new Controller(options)
  return run(c, async () => {
    assertBrowser()
    c.prepare()

    const frame = createFrame(c)
    const overlay = document.createElement('div')
    overlay.className = 'warp-overlay'
    overlay.setAttribute('data-warp-theme', options.theme ?? 'auto')
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Checkout')

    const panel = document.createElement('div')
    panel.className = 'warp-modal'
    const header = document.createElement('div')
    header.className = 'warp-modal-header'
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'warp-close'
    close.setAttribute('aria-label', 'Close checkout')
    close.innerHTML = CLOSE_ICON
    header.appendChild(close)
    panel.append(header, frame.root)
    overlay.appendChild(panel)

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const body = document.body
    const previousOverflow = body.style.overflow

    const onClose = () => c.dismiss()
    const onBackdrop = (event: MouseEvent) => {
      if (event.target === overlay) c.dismiss()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault()
        c.dismiss()
      }
    }
    // Lightweight focus trap: focus that leaves the dialog is pulled back to the close button.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (target instanceof Node && !overlay.contains(target)) close.focus()
    }

    close.addEventListener('click', onClose)
    overlay.addEventListener('click', onBackdrop)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocusIn)
    body.style.overflow = 'hidden'
    body.appendChild(overlay)
    close.focus()

    c.addCleanup(() => {
      close.removeEventListener('click', onClose)
      overlay.removeEventListener('click', onBackdrop)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocusIn)
      overlay.remove()
      body.style.overflow = previousOverflow
      if (previousFocus && previousFocus.isConnected) previousFocus.focus()
    })

    c.hooks.cancel = () => c.close()
    c.hooks.return = () => c.close()

    const src = await c.resolveUrl('iframe')
    if (c.destroyed) return
    frame.load(src)
  })
}
