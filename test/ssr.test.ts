// @vitest-environment node
import { describe, expect, it } from 'vitest'

describe('SSR', () => {
  it('imports without a DOM', async () => {
    expect(typeof window).toBe('undefined')
    const core = await import('../src/index')
    const element = await import('../src/element')
    expect(typeof core.mountCheckout).toBe('function')
    expect(typeof element.defineWarpCheckoutElement).toBe('function')
    expect(core.parseCheckoutUrl(`https://checkout.usewarp.net/session/ps_${'a'.repeat(32)}`).sessionId).toBe(
      `ps_${'a'.repeat(32)}`,
    )
  })

  it('rejects instead of throwing when called on the server', async () => {
    const core = await import('../src/index')
    await expect(core.mountCheckout('#x', { checkoutUrl: 'x' })).rejects.toThrow(/browser/)
    await expect(core.openCheckoutPopup({ checkoutUrl: 'x' })).rejects.toThrow(/browser/)
  })
})
