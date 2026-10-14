import { describe, expect, it } from 'vitest'
import { DEFAULT_CHECKOUT_ORIGIN, WarpCheckoutError, isWarpCheckoutMessage, parseCheckoutUrl } from '../src/index'
import { CHECKOUT_URL, ORIGIN, SID, msg } from './helpers'

function code(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (error) {
    return error instanceof WarpCheckoutError ? error.code : 'other'
  }
  return undefined
}

describe('parseCheckoutUrl', () => {
  it('accepts session and success URLs on the default origin', () => {
    expect(DEFAULT_CHECKOUT_ORIGIN).toBe(ORIGIN)
    const parsed = parseCheckoutUrl(CHECKOUT_URL)
    expect(parsed.sessionId).toBe(SID)
    expect(parsed.url).toBeInstanceOf(URL)
    expect(parseCheckoutUrl(`${ORIGIN}/success/${SID}`).sessionId).toBe(SID)
    expect(parseCheckoutUrl(`${CHECKOUT_URL}?foo=1#x`).sessionId).toBe(SID)
  })

  it('accepts a matching custom origin, including a trailing slash', () => {
    const origin = 'https://staging-checkout.example.com/'
    expect(parseCheckoutUrl(`https://staging-checkout.example.com/session/${SID}`, origin).sessionId).toBe(SID)
  })

  it('rejects origin mismatches', () => {
    expect(code(() => parseCheckoutUrl(`https://evil.example.com/session/${SID}`))).toBe('invalid_checkout_url')
    expect(code(() => parseCheckoutUrl(`https://checkout.usewarp.net.evil.com/session/${SID}`))).toBe(
      'invalid_checkout_url',
    )
    expect(code(() => parseCheckoutUrl(`http://checkout.usewarp.net/session/${SID}`))).toBe('invalid_checkout_url')
  })

  it('rejects bad paths and session ids', () => {
    for (const path of [
      '/',
      `/session/${SID}/extra`,
      '/session/ps_123',
      `/session/${SID.toUpperCase()}`,
      `/pay/${SID}`,
      `/session/cs_${SID.slice(3)}`,
    ]) {
      expect(code(() => parseCheckoutUrl(`${ORIGIN}${path}`))).toBe('invalid_checkout_url')
    }
    expect(code(() => parseCheckoutUrl('not a url'))).toBe('invalid_checkout_url')
    expect(code(() => parseCheckoutUrl(''))).toBe('invalid_checkout_url')
  })

  it('rejects credentials in the URL', () => {
    expect(code(() => parseCheckoutUrl(`https://user:pass@checkout.usewarp.net/session/${SID}`))).toBe(
      'invalid_checkout_url',
    )
  })

  it('only allows http for localhost / 127.0.0.1 checkout origins', () => {
    expect(parseCheckoutUrl(`http://localhost:3000/session/${SID}`, 'http://localhost:3000').sessionId).toBe(SID)
    expect(parseCheckoutUrl(`http://127.0.0.1:3000/session/${SID}`, 'http://127.0.0.1:3000').sessionId).toBe(SID)
    expect(code(() => parseCheckoutUrl(`http://example.com/session/${SID}`, 'http://example.com'))).toBe(
      'invalid_checkout_url',
    )
    expect(code(() => parseCheckoutUrl(`http://localhost:3000/session/${SID}`))).toBe('invalid_checkout_url')
    expect(code(() => parseCheckoutUrl(`javascript:alert(1)`, 'javascript:alert(1)'))).toBe('invalid_checkout_url')
  })
})

describe('isWarpCheckoutMessage', () => {
  it('accepts valid messages', () => {
    expect(isWarpCheckoutMessage(msg('ready'))).toBe(true)
    expect(isWarpCheckoutMessage(msg('resize', { height: 640 }))).toBe(true)
    expect(isWarpCheckoutMessage(msg('status', { status: 'completed' }))).toBe(true)
    expect(isWarpCheckoutMessage(msg('cancel'))).toBe(true)
    expect(isWarpCheckoutMessage(msg('return'))).toBe(true)
  })

  it('rejects malformed messages', () => {
    expect(isWarpCheckoutMessage(null)).toBe(false)
    expect(isWarpCheckoutMessage('ready')).toBe(false)
    expect(isWarpCheckoutMessage({ ...msg('ready'), source: 'other' })).toBe(false)
    expect(isWarpCheckoutMessage({ ...msg('ready'), version: 2 })).toBe(false)
    expect(isWarpCheckoutMessage({ ...msg('ready'), session_id: 1 })).toBe(false)
    expect(isWarpCheckoutMessage(msg('unknown'))).toBe(false)
    expect(isWarpCheckoutMessage(msg('resize', { height: '640' }))).toBe(false)
    expect(isWarpCheckoutMessage(msg('resize', { height: Number.NaN }))).toBe(false)
    expect(isWarpCheckoutMessage(msg('resize', { height: -1 }))).toBe(false)
    expect(isWarpCheckoutMessage(msg('status', { status: 'paid' }))).toBe(false)
  })
})
