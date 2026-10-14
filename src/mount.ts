import { Controller, assertBrowser, run } from './controller'
import { createFrame } from './frame'
import type { CheckoutInstance, CheckoutOptions } from './types'

/** Inline iframe inside `container` (element or CSS selector). Auto-resizes height. */
export function mountCheckout(container: HTMLElement | string, options: CheckoutOptions): Promise<CheckoutInstance> {
  const c = new Controller(options)
  return run(c, async () => {
    assertBrowser()
    c.prepare()
    const target = typeof container === 'string' ? document.querySelector<HTMLElement>(container) : container
    if (!target) throw new TypeError(`mountCheckout: container ${String(container)} not found`)
    const frame = createFrame(c)
    target.appendChild(frame.root)
    const src = await c.resolveUrl('iframe')
    if (c.destroyed) return
    frame.load(src)
  })
}
