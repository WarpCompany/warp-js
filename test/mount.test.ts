import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WarpCheckoutError, mountCheckout } from '../src/index'
import { CHECKOUT_URL, ORIGIN, SID, flush, frameOf, msg, post } from './helpers'

let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  container.id = 'checkout'
  document.body.appendChild(container)
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('mountCheckout', () => {
  it('mounts an iframe with embed and theme params and a loading state', async () => {
    const instance = await mountCheckout('#checkout', { checkoutUrl: `${CHECKOUT_URL}?embed=popup`, theme: 'dark' })
    const iframe = frameOf(container)
    const src = new URL(iframe.src)
    expect(src.origin).toBe(ORIGIN)
    expect(src.pathname).toBe(`/session/${SID}`)
    expect(src.searchParams.get('embed')).toBe('iframe')
    expect(src.searchParams.get('theme')).toBe('dark')
    expect(iframe.getAttribute('allow')).toBe('clipboard-write')
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-top-navigation ')
    expect(iframe.getAttribute('sandbox')).not.toMatch(/allow-top-navigation(\s|$)/)
    expect(iframe.style.height).toBe('560px')
    expect(container.querySelector('.warp-loading')).not.toBeNull()
    expect(document.getElementById('warp-checkout-styles')).not.toBeNull()
    expect(instance.sessionId).toBe(SID)
    expect(instance.status).toBeNull()
    instance.destroy()
  })

  it('omits theme for auto', async () => {
    const instance = await mountCheckout(container, { checkoutUrl: CHECKOUT_URL })
    expect(new URL(frameOf(container).src).searchParams.has('theme')).toBe(false)
    instance.destroy()
  })

  it('ignores messages from the wrong origin, wrong source, malformed or for another session', async () => {
    const onReady = vi.fn()
    const onStatus = vi.fn()
    const instance = await mountCheckout(container, { checkoutUrl: CHECKOUT_URL, onReady, onStatus })
    const win = frameOf(container).contentWindow

    post(win, msg('ready'), 'https://evil.example.com')
    post(window, msg('ready'))
    post(null, msg('ready'))
    post(win, { ...msg('ready'), version: 2 })
    post(win, 'ready')
    post(win, msg('ready', {}, `ps_${'f'.repeat(32)}`))
    post(win, msg('status', { status: 'bogus' }))
    expect(onReady).not.toHaveBeenCalled()
    expect(onStatus).not.toHaveBeenCalled()

    post(win, msg('ready'))
    expect(onReady).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.warp-loading')).toBeNull()
    expect(container.querySelector('.warp-ready')).not.toBeNull()
    instance.destroy()
  })

  it('resizes the iframe on resize messages', async () => {
    const instance = await mountCheckout(container, { checkoutUrl: CHECKOUT_URL })
    const iframe = frameOf(container)
    post(iframe.contentWindow, msg('resize', { height: 731.4 }))
    expect(iframe.style.height).toBe('732px')
    post(iframe.contentWindow, msg('resize', { height: 400 }))
    expect(iframe.style.height).toBe('400px')
    post(iframe.contentWindow, msg('resize', { height: 'big' }))
    expect(iframe.style.height).toBe('400px')
    instance.destroy()
  })

  it('reports status changes and fires onComplete once', async () => {
    const onStatus = vi.fn()
    const onComplete = vi.fn()
    const instance = await mountCheckout(container, { checkoutUrl: CHECKOUT_URL, onStatus, onComplete })
    const win = frameOf(container).contentWindow
    post(win, msg('status', { status: 'pending' }))
    post(win, msg('status', { status: 'pending' }))
    post(win, msg('status', { status: 'processing' }))
    post(win, msg('status', { status: 'completed' }))
    post(win, msg('status', { status: 'completed' }))
    expect(onStatus.mock.calls.map((c) => c[0])).toEqual(['pending', 'processing', 'completed'])
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(instance.status).toBe('completed')
    instance.destroy()
  })

  it('accepts messages from the success page of the same session', async () => {
    const onComplete = vi.fn()
    const instance = await mountCheckout(container, { checkoutUrl: `${ORIGIN}/success/${SID}`, onComplete })
    post(frameOf(container).contentWindow, msg('status', { status: 'completed' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
    instance.destroy()
  })

  it('calls onCancel and onReturn without removing the inline iframe or calling onClose', async () => {
    const onCancel = vi.fn()
    const onReturn = vi.fn()
    const onClose = vi.fn()
    const instance = await mountCheckout(container, { checkoutUrl: CHECKOUT_URL, onCancel, onReturn, onClose })
    const win = frameOf(container).contentWindow
    post(win, msg('cancel'))
    post(win, msg('return'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onReturn).toHaveBeenCalledTimes(1)
    expect(container.querySelector('iframe')).not.toBeNull()
    instance.destroy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('destroy removes DOM and listeners and is idempotent', async () => {
    const onReady = vi.fn()
    const instance = await mountCheckout(container, { checkoutUrl: CHECKOUT_URL, onReady })
    const win = frameOf(container).contentWindow
    const destroy = instance.destroy
    destroy()
    destroy()
    instance.destroy()
    expect(container.innerHTML).toBe('')
    post(win, msg('ready'))
    expect(onReady).not.toHaveBeenCalled()
  })

  it('uses fetchCheckoutUrl and shows the loading state meanwhile', async () => {
    let resolve!: (url: string) => void
    const fetchCheckoutUrl = vi.fn(() => new Promise<string>((r) => (resolve = r)))
    const promise = mountCheckout(container, { fetchCheckoutUrl })
    await flush()
    expect(container.querySelector('.warp-loading')).not.toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
    resolve(CHECKOUT_URL)
    const instance = await promise
    expect(instance.sessionId).toBe(SID)
    expect(container.querySelector('iframe')).not.toBeNull()
    instance.destroy()
  })

  it('maps fetchCheckoutUrl failures to fetch_failed', async () => {
    const onError = vi.fn()
    const promise = mountCheckout(container, {
      fetchCheckoutUrl: () => Promise.reject(new Error('500 from server')),
      onError,
    })
    await expect(promise).rejects.toMatchObject({ code: 'fetch_failed' })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(WarpCheckoutError)
    expect(onError.mock.calls[0]?.[0].code).toBe('fetch_failed')
    expect(container.innerHTML).toBe('')
  })

  it('rejects invalid URLs with invalid_checkout_url', async () => {
    const onError = vi.fn()
    await expect(
      mountCheckout(container, { checkoutUrl: `https://evil.example.com/session/${SID}`, onError }),
    ).rejects.toMatchObject({ code: 'invalid_checkout_url' })
    await expect(mountCheckout(container, {})).rejects.toMatchObject({ code: 'invalid_checkout_url' })
    await expect(
      mountCheckout(container, { fetchCheckoutUrl: async () => 'https://evil.example.com/x' }),
    ).rejects.toMatchObject({ code: 'invalid_checkout_url' })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(container.innerHTML).toBe('')
  })

  it('rejects when the container does not exist', async () => {
    await expect(mountCheckout('#missing', { checkoutUrl: CHECKOUT_URL })).rejects.toBeInstanceOf(TypeError)
  })

  it('reports load_failed if no ready message arrives within 15s', async () => {
    vi.useFakeTimers()
    const onError = vi.fn()
    const instance = await mountCheckout(container, { checkoutUrl: CHECKOUT_URL, onError })
    vi.advanceTimersByTime(14_999)
    expect(onError).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0].code).toBe('load_failed')
    instance.destroy()
  })

  it('does not report load_failed after ready', async () => {
    vi.useFakeTimers()
    const onError = vi.fn()
    const instance = await mountCheckout(container, { checkoutUrl: CHECKOUT_URL, onError })
    post(frameOf(container).contentWindow, msg('ready'))
    vi.advanceTimersByTime(20_000)
    expect(onError).not.toHaveBeenCalled()
    instance.destroy()
  })

  it('aborting the signal before load rejects with destroyed', async () => {
    const abort = new AbortController()
    const promise = mountCheckout(container, {
      fetchCheckoutUrl: () => new Promise((r) => setTimeout(() => r(CHECKOUT_URL), 10)),
      signal: abort.signal,
    })
    abort.abort()
    await expect(promise).rejects.toMatchObject({ code: 'destroyed' })
    expect(container.innerHTML).toBe('')
  })

  it('keeps working when a callback throws', async () => {
    vi.useFakeTimers()
    const onStatus = vi.fn(() => {
      throw new Error('merchant bug')
    })
    const onComplete = vi.fn()
    const instance = await mountCheckout(container, { checkoutUrl: CHECKOUT_URL, onStatus, onComplete })
    post(frameOf(container).contentWindow, msg('status', { status: 'completed' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(() => vi.runOnlyPendingTimers()).toThrow('merchant bug')
    instance.destroy()
  })
})
