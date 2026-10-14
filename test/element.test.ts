import { afterEach, describe, expect, it, vi } from 'vitest'
import { ELEMENT_TAG, WarpCheckoutElement } from '../src/element'
import { CHECKOUT_URL, ORIGIN, SID, flush, frameOf, msg, post } from './helpers'

afterEach(() => {
  document.body.innerHTML = ''
})

async function createElement(attrs: Record<string, string>): Promise<WarpCheckoutElement> {
  const el = document.createElement(ELEMENT_TAG)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  document.body.appendChild(el)
  await flush()
  return el
}

describe('<warp-checkout>', () => {
  it('is registered on import', () => {
    expect(customElements.get('warp-checkout')).toBe(WarpCheckoutElement)
    expect(document.createElement('warp-checkout')).toBeInstanceOf(WarpCheckoutElement)
  })

  it('mounts the iframe from attributes', async () => {
    const el = await createElement({ 'checkout-url': CHECKOUT_URL, theme: 'dark' })
    const src = new URL(frameOf(el).src)
    expect(src.searchParams.get('embed')).toBe('iframe')
    expect(src.searchParams.get('theme')).toBe('dark')
    expect(el.sessionId).toBe(SID)
  })

  it('dispatches warp:* events from checkout messages', async () => {
    const el = await createElement({ 'checkout-url': CHECKOUT_URL })
    const seen: Array<[string, unknown]> = []
    for (const type of ['warp:ready', 'warp:status', 'warp:complete', 'warp:cancel', 'warp:return']) {
      document.addEventListener(type, (e) => seen.push([type, (e as CustomEvent).detail]))
    }
    const win = frameOf(el).contentWindow
    post(win, msg('ready'))
    post(win, msg('status', { status: 'processing' }))
    post(win, msg('status', { status: 'completed' }))
    post(win, msg('cancel'))
    post(win, msg('return'))
    expect(seen).toEqual([
      ['warp:ready', {}],
      ['warp:status', { status: 'processing' }],
      ['warp:status', { status: 'completed' }],
      ['warp:complete', {}],
      ['warp:cancel', {}],
      ['warp:return', {}],
    ])
    expect(el.status).toBe('completed')
  })

  it('dispatches warp:error for an invalid URL', async () => {
    const onError = vi.fn()
    document.addEventListener('warp:error', onError, { once: true })
    await createElement({ 'checkout-url': 'https://evil.example.com/session/x' })
    await flush()
    expect(onError).toHaveBeenCalledTimes(1)
    expect((onError.mock.calls[0]?.[0] as CustomEvent).detail.error.code).toBe('invalid_checkout_url')
  })

  it('honours checkout-origin', async () => {
    const el = await createElement({
      'checkout-url': `http://localhost:3000/session/${SID}`,
      'checkout-origin': 'http://localhost:3000',
    })
    const iframe = frameOf(el)
    expect(new URL(iframe.src).origin).toBe('http://localhost:3000')
    const ready = vi.fn()
    el.addEventListener('warp:ready', ready)
    post(iframe.contentWindow, msg('ready'), ORIGIN)
    expect(ready).not.toHaveBeenCalled()
    post(iframe.contentWindow, msg('ready'), 'http://localhost:3000')
    expect(ready).toHaveBeenCalledTimes(1)
  })

  it('re-mounts on attribute change and tears down on disconnect', async () => {
    const el = await createElement({ 'checkout-url': CHECKOUT_URL })
    const other = `ps_${'b'.repeat(32)}`
    el.setAttribute('checkout-url', `${ORIGIN}/session/${other}`)
    await flush()
    expect(el.querySelectorAll('iframe').length).toBe(1)
    expect(new URL(frameOf(el).src).pathname).toBe(`/session/${other}`)
    expect(el.sessionId).toBe(other)

    const win = frameOf(el).contentWindow
    el.remove()
    expect(el.querySelector('iframe')).toBeNull()
    const ready = vi.fn()
    el.addEventListener('warp:ready', ready)
    post(win, msg('ready', {}, other))
    expect(ready).not.toHaveBeenCalled()
  })
})
