import type { WarpCheckoutError } from './errors'

export type CheckoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired'
export type CheckoutTheme = 'light' | 'dark' | 'auto'

export interface CheckoutOptions {
  /** checkout_url from your server, or an async function that creates a session on your server and returns it. */
  checkoutUrl?: string
  fetchCheckoutUrl?: () => Promise<string>
  /** Default 'auto' (follows the customer's system setting). */
  theme?: CheckoutTheme
  /** Override for self-hosted/staging checkout. Default 'https://checkout.usewarp.net'. checkoutUrl must match this origin. */
  checkoutOrigin?: string
  onReady?: () => void
  onStatus?: (status: CheckoutStatus) => void
  /** Status became 'completed'. Fires at most once per instance. */
  onComplete?: () => void
  onCancel?: () => void
  onReturn?: () => void
  onError?: (error: WarpCheckoutError) => void
  /**
   * Modal and popup only: the checkout closed itself. Fires once, after onCancel / onReturn,
   * when the customer dismisses it (close button, Escape, backdrop, popup window closed), also
   * after a completed payment, or when it closes after a cancel or return. Not called when you
   * call destroy() or abort the signal, and never called by mountCheckout.
   */
  onClose?: () => void
  /**
   * Optional. Aborting before the returned promise settles tears everything down and rejects
   * with a 'destroyed' error. Aborting afterwards is the same as calling destroy().
   */
  signal?: AbortSignal
}

export interface CheckoutInstance {
  readonly sessionId: string | null
  readonly status: CheckoutStatus | null
  destroy(): void
}

export type WarpCheckoutMessage = {
  source: 'warp-checkout'
  version: 1
  session_id: string
} & (
  | { type: 'ready' }
  | { type: 'resize'; height: number }
  | { type: 'status'; status: CheckoutStatus }
  | { type: 'cancel' }
  | { type: 'return' }
)
