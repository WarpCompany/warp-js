import { WarpCheckoutError } from './errors'
import { mountCheckout } from './mount'
import type { CheckoutInstance, CheckoutStatus, CheckoutTheme } from './types'

export const ELEMENT_TAG = 'warp-checkout'

export interface WarpCheckoutEventMap {
  'warp:ready': CustomEvent<Record<string, never>>
  'warp:status': CustomEvent<{ status: CheckoutStatus }>
  'warp:complete': CustomEvent<Record<string, never>>
  'warp:cancel': CustomEvent<Record<string, never>>
  'warp:return': CustomEvent<Record<string, never>>
  'warp:error': CustomEvent<{ error: WarpCheckoutError }>
}

// Lets this module be imported during SSR, where HTMLElement does not exist.
const Base: typeof HTMLElement =
  typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement

const THEMES: ReadonlySet<string> = new Set(['light', 'dark', 'auto'])

/**
 * `<warp-checkout checkout-url="..." theme="light|dark|auto" checkout-origin="...">`
 *
 * Mounts the inline checkout while connected and re-mounts when an attribute changes.
 * Dispatches `warp:ready`, `warp:status` ({ status }), `warp:complete`, `warp:cancel`,
 * `warp:return` and `warp:error` ({ error }). Events bubble and cross shadow roots.
 */
export class WarpCheckoutElement extends Base {
  static get observedAttributes(): string[] {
    return ['checkout-url', 'theme', 'checkout-origin']
  }

  private instance: CheckoutInstance | null = null
  private abort: AbortController | null = null
  private generation = 0

  /** The mounted checkout's session id, or null. */
  get sessionId(): string | null {
    return this.instance?.sessionId ?? null
  }

  /** The latest status reported by the checkout, or null. */
  get status(): CheckoutStatus | null {
    return this.instance?.status ?? null
  }

  connectedCallback(): void {
    this.remount()
  }

  disconnectedCallback(): void {
    this.teardown()
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.isConnected) return
    this.remount()
  }

  private teardown(): void {
    this.generation++
    this.abort?.abort()
    this.abort = null
    this.instance?.destroy()
    this.instance = null
  }

  private emit(type: keyof WarpCheckoutEventMap, detail: object = {}): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
  }

  private remount(): void {
    this.teardown()
    const checkoutUrl = this.getAttribute('checkout-url')
    if (!checkoutUrl) return
    const themeAttr = this.getAttribute('theme')
    const theme: CheckoutTheme = themeAttr && THEMES.has(themeAttr) ? (themeAttr as CheckoutTheme) : 'auto'
    const checkoutOrigin = this.getAttribute('checkout-origin') || undefined
    const generation = this.generation
    const abort = typeof AbortController === 'undefined' ? null : new AbortController()
    this.abort = abort

    mountCheckout(this, {
      checkoutUrl,
      theme,
      checkoutOrigin,
      signal: abort?.signal,
      onReady: () => this.emit('warp:ready'),
      onStatus: (status) => this.emit('warp:status', { status }),
      onComplete: () => this.emit('warp:complete'),
      onCancel: () => this.emit('warp:cancel'),
      onReturn: () => this.emit('warp:return'),
      onError: (error) => this.emit('warp:error', { error }),
    }).then(
      (instance) => {
        if (generation !== this.generation) instance.destroy()
        else this.instance = instance
      },
      () => {
        // Already reported through onError (or the element was disconnected).
      },
    )
  }
}

/** Registers `<warp-checkout>` if custom elements are available and it is not registered yet. */
export function defineWarpCheckoutElement(tagName: string = ELEMENT_TAG): void {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') return
  if (customElements.get(tagName)) return
  customElements.define(tagName, tagName === ELEMENT_TAG ? WarpCheckoutElement : class extends WarpCheckoutElement {})
}

defineWarpCheckoutElement()

declare global {
  interface HTMLElementTagNameMap {
    'warp-checkout': WarpCheckoutElement
  }
}
