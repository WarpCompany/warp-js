import { WarpCheckoutError } from './errors'
import { isWarpCheckoutMessage } from './messages'
import type { CheckoutInstance, CheckoutOptions, CheckoutStatus } from './types'
import { buildEmbedUrl, normalizeCheckoutOrigin, parseCheckoutUrl } from './url'

export interface ControllerHooks {
  ready?: () => void
  resize?: (height: number) => void
  /** Runs after the user's onCancel / onReturn (modal and popup call close() here). */
  cancel?: () => void
  return?: () => void
}

/** Reports an exception thrown by user code without breaking our own state. */
function report(error: unknown): void {
  setTimeout(() => {
    throw error
  }, 0)
}

export function invoke<A extends unknown[]>(fn: ((...args: A) => void) | undefined, ...args: A): void {
  if (!fn) return
  try {
    fn(...args)
  } catch (error) {
    report(error)
  }
}

export function assertBrowser(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('@usewarp/js can only open a checkout in the browser')
  }
}

/** Shared state for one checkout: message filtering, callbacks and cleanup. */
export class Controller {
  readonly options: CheckoutOptions
  origin = ''
  sessionId: string | null = null
  status: CheckoutStatus | null = null
  hooks: ControllerHooks = {}
  /** Returns the only window allowed to post messages to us (iframe contentWindow or popup). */
  source: () => Window | null = () => null

  private destroyedFlag = false
  private completed = false
  private readyFired = false
  private listening = false
  private cleanups: Array<() => void> = []

  constructor(options: CheckoutOptions) {
    this.options = options
  }

  get destroyed(): boolean {
    return this.destroyedFlag
  }

  /** Normalizes checkoutOrigin and validates checkoutUrl if one was given. Throws WarpCheckoutError. */
  prepare(): void {
    this.origin = normalizeCheckoutOrigin(this.options.checkoutOrigin)
    if (typeof this.options.checkoutUrl === 'string') {
      this.sessionId = parseCheckoutUrl(this.options.checkoutUrl, this.origin).sessionId
    } else if (typeof this.options.fetchCheckoutUrl !== 'function') {
      throw new WarpCheckoutError('invalid_checkout_url', 'Provide checkoutUrl or fetchCheckoutUrl')
    }
  }

  /** Resolves the final embed URL (calling fetchCheckoutUrl if needed) and sets sessionId. */
  async resolveUrl(embed: 'iframe' | 'popup'): Promise<string> {
    let raw = this.options.checkoutUrl
    if (typeof raw !== 'string') {
      const fetcher = this.options.fetchCheckoutUrl
      if (typeof fetcher !== 'function') {
        throw new WarpCheckoutError('invalid_checkout_url', 'Provide checkoutUrl or fetchCheckoutUrl')
      }
      let result: unknown
      try {
        result = await fetcher()
      } catch (cause) {
        const detail = cause instanceof Error && cause.message ? `: ${cause.message}` : ''
        throw new WarpCheckoutError('fetch_failed', `fetchCheckoutUrl failed${detail}`, { cause })
      }
      if (typeof result !== 'string' || result.length === 0) {
        throw new WarpCheckoutError('fetch_failed', 'fetchCheckoutUrl did not return a checkout URL')
      }
      raw = result
    }
    const { url, sessionId } = parseCheckoutUrl(raw, this.origin)
    this.sessionId = sessionId
    return buildEmbedUrl(url, embed, this.options.theme)
  }

  listen(): void {
    if (this.listening || this.destroyedFlag) return
    this.listening = true
    window.addEventListener('message', this.onMessage)
    this.addCleanup(() => window.removeEventListener('message', this.onMessage))
  }

  addCleanup(fn: () => void): void {
    if (this.destroyedFlag) {
      fn()
      return
    }
    this.cleanups.push(fn)
  }

  fail(error: WarpCheckoutError): void {
    invoke(this.options.onError, error)
  }

  /** The customer closed the checkout (close button, Escape, backdrop, popup window closed). */
  dismiss(): void {
    if (this.destroyedFlag) return
    if (!this.completed) invoke(this.options.onCancel)
    this.close()
  }

  /**
   * Closes a modal or popup on its own (customer dismissal, or after onCancel / onReturn)
   * and then calls onClose. Not used for inline checkouts or when the merchant calls destroy().
   */
  close(): void {
    if (this.destroyedFlag) return
    this.destroy()
    invoke(this.options.onClose)
  }

  destroy(): void {
    if (this.destroyedFlag) return
    this.destroyedFlag = true
    const cleanups = this.cleanups.splice(0).reverse()
    for (const fn of cleanups) {
      try {
        fn()
      } catch (error) {
        report(error)
      }
    }
  }

  instance(): CheckoutInstance {
    // A plain object so `destroy` can be passed around unbound.
    const read = () => this
    return {
      get sessionId() {
        return read().sessionId
      },
      get status() {
        return read().status
      },
      destroy: () => this.destroy(),
    }
  }

  private onMessage = (event: MessageEvent): void => {
    if (this.destroyedFlag) return
    if (event.origin !== this.origin) return
    const expected = this.source()
    if (!expected || event.source !== expected) return
    const data: unknown = event.data
    if (!isWarpCheckoutMessage(data)) return
    if (this.sessionId === null || data.session_id !== this.sessionId) return

    switch (data.type) {
      case 'ready':
        if (this.readyFired) return
        this.readyFired = true
        this.hooks.ready?.()
        invoke(this.options.onReady)
        return
      case 'resize':
        this.hooks.resize?.(data.height)
        return
      case 'status':
        if (data.status !== this.status) {
          this.status = data.status
          invoke(this.options.onStatus, data.status)
        }
        if (data.status === 'completed' && !this.completed) {
          this.completed = true
          invoke(this.options.onComplete)
        }
        return
      case 'cancel':
        invoke(this.options.onCancel)
        if (!this.destroyedFlag) this.hooks.cancel?.()
        return
      case 'return':
        invoke(this.options.onReturn)
        if (!this.destroyedFlag) this.hooks.return?.()
        return
    }
  }
}

function destroyedError(): WarpCheckoutError {
  return new WarpCheckoutError('destroyed', 'The checkout was closed before it finished loading')
}

/**
 * Runs the async setup of a checkout with consistent error handling:
 * WarpCheckoutErrors are passed to onError and reject the promise. If the checkout was
 * closed or aborted before setup finished, the promise rejects with a 'destroyed' error
 * (onError is not called for that case).
 */
export async function run(c: Controller, body: () => Promise<void>): Promise<CheckoutInstance> {
  const signal = c.options.signal
  if (signal) {
    if (signal.aborted) {
      c.destroy()
      throw destroyedError()
    }
    const onAbort = () => c.destroy()
    signal.addEventListener('abort', onAbort)
    c.addCleanup(() => signal.removeEventListener('abort', onAbort))
  }
  try {
    await body()
  } catch (error) {
    const wasDestroyed = c.destroyed
    c.destroy()
    if (wasDestroyed) throw destroyedError()
    if (error instanceof WarpCheckoutError) c.fail(error)
    throw error
  }
  if (c.destroyed) throw destroyedError()
  return c.instance()
}
