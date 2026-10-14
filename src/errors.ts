export type WarpCheckoutErrorCode =
  | 'invalid_checkout_url'
  | 'fetch_failed'
  | 'popup_blocked'
  | 'load_failed'
  | 'destroyed'

export class WarpCheckoutError extends Error {
  readonly code: WarpCheckoutErrorCode
  cause?: unknown

  constructor(code: WarpCheckoutErrorCode, message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'WarpCheckoutError'
    this.code = code
    if (options && 'cause' in options) this.cause = options.cause
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
