import type { Controller } from './controller'
import { WarpCheckoutError } from './errors'
import { injectStyles } from './styles'

export const LOAD_TIMEOUT_MS = 15_000
export const INITIAL_HEIGHT = 560
const MAX_HEIGHT = 20_000

/**
 * iframe sandbox: what the checkout needs (scripts, its own storage, wallet popups,
 * forms, deep links to wallet apps) but no navigation of the merchant's top-level page.
 */
export const IFRAME_SANDBOX = [
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-modals',
  'allow-top-navigation-to-custom-protocols',
].join(' ')

export interface Frame {
  root: HTMLDivElement
  /** Creates the iframe pointing at `src` and starts the load timeout. */
  load(src: string): HTMLIFrameElement
}

/** Builds the container with a loading state. The iframe is added once the URL is known. */
export function createFrame(c: Controller): Frame {
  injectStyles()
  const root = document.createElement('div')
  root.className = 'warp-checkout'
  root.setAttribute('data-warp-theme', c.options.theme ?? 'auto')

  const loading = document.createElement('div')
  loading.className = 'warp-loading'
  loading.setAttribute('role', 'status')
  loading.setAttribute('aria-live', 'polite')
  const spinner = document.createElement('div')
  spinner.className = 'warp-spinner'
  spinner.setAttribute('aria-hidden', 'true')
  const label = document.createElement('span')
  label.textContent = 'Loading checkout…'
  loading.append(spinner, label)
  root.appendChild(loading)

  c.addCleanup(() => root.remove())

  return {
    root,
    load(src) {
      const frame = document.createElement('iframe')
      frame.className = 'warp-frame'
      frame.title = 'Warp checkout'
      frame.setAttribute('allow', 'clipboard-write')
      frame.setAttribute('sandbox', IFRAME_SANDBOX)
      // The checkout falls back to the referrer to learn the parent origin.
      frame.setAttribute('referrerpolicy', 'origin')
      frame.style.height = `${INITIAL_HEIGHT}px`

      c.source = () => frame.contentWindow

      const timer = setTimeout(() => {
        if (c.destroyed) return
        root.classList.add('warp-failed')
        label.textContent = 'The checkout could not be loaded.'
        c.fail(new WarpCheckoutError('load_failed', `Checkout did not respond within ${LOAD_TIMEOUT_MS / 1000}s`))
      }, LOAD_TIMEOUT_MS)
      c.addCleanup(() => clearTimeout(timer))

      c.hooks.ready = () => {
        clearTimeout(timer)
        root.classList.remove('warp-failed')
        root.classList.add('warp-ready')
        loading.remove()
      }
      c.hooks.resize = (height) => {
        const h = Math.min(Math.ceil(height), MAX_HEIGHT)
        if (h <= 0) return
        root.classList.add('warp-sized')
        frame.style.height = `${h}px`
      }

      c.listen()
      frame.src = src
      root.appendChild(frame)
      return frame
    },
  }
}
