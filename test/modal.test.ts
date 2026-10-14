import { afterEach, describe, expect, it, vi } from 'vitest'
import { openCheckoutModal } from '../src/index'
import { CHECKOUT_URL, frameOf, msg, post } from './helpers'

function overlay(): HTMLElement | null {
  return document.querySelector('.warp-overlay')
}

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
})

describe('openCheckoutModal', () => {
  it('renders an accessible dialog and locks body scroll', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    document.body.style.overflow = 'scroll'

    const instance = await openCheckoutModal({ checkoutUrl: CHECKOUT_URL, theme: 'light' })
    const el = overlay()
    expect(el).not.toBeNull()
    expect(el?.getAttribute('role')).toBe('dialog')
    expect(el?.getAttribute('aria-modal')).toBe('true')
    expect(el?.getAttribute('data-warp-theme')).toBe('light')
    const close = el?.querySelector('button.warp-close')
    expect(close?.getAttribute('aria-label')).toBe('Close checkout')
    expect(document.activeElement).toBe(close)
    expect(document.body.style.overflow).toBe('hidden')
    expect(new URL(frameOf(el!).src).searchParams.get('embed')).toBe('iframe')

    instance.destroy()
    expect(overlay()).toBeNull()
    expect(document.body.style.overflow).toBe('scroll')
    expect(document.activeElement).toBe(trigger)
  })

  it('injects styles only once', async () => {
    const a = await openCheckoutModal({ checkoutUrl: CHECKOUT_URL })
    a.destroy()
    const b = await openCheckoutModal({ checkoutUrl: CHECKOUT_URL })
    expect(document.querySelectorAll('#warp-checkout-styles').length).toBe(1)
    b.destroy()
  })

  it('closes on Escape and calls onCancel', async () => {
    const onCancel = vi.fn()
    await openCheckoutModal({ checkoutUrl: CHECKOUT_URL, onCancel })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(overlay()).toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('closes on the close button and on backdrop click, not on panel click', async () => {
    const onCancel = vi.fn()
    await openCheckoutModal({ checkoutUrl: CHECKOUT_URL, onCancel })
    ;(document.querySelector('.warp-modal') as HTMLElement).click()
    expect(overlay()).not.toBeNull()
    ;(document.querySelector('.warp-close') as HTMLButtonElement).click()
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(overlay()).toBeNull()

    await openCheckoutModal({ checkoutUrl: CHECKOUT_URL, onCancel })
    overlay()!.click()
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(overlay()).toBeNull()
  })

  it('closes after a cancel message from the checkout', async () => {
    const onCancel = vi.fn()
    await openCheckoutModal({ checkoutUrl: CHECKOUT_URL, onCancel })
    post(frameOf(overlay()!).contentWindow, msg('cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(overlay()).toBeNull()
  })

  it('closes after onReturn and does not call onCancel once completed', async () => {
    const onCancel = vi.fn()
    const onReturn = vi.fn()
    const onComplete = vi.fn()
    await openCheckoutModal({ checkoutUrl: CHECKOUT_URL, onCancel, onReturn, onComplete })
    const win = frameOf(overlay()!).contentWindow
    post(win, msg('status', { status: 'completed' }))
    post(win, msg('return'))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onReturn).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    expect(overlay()).toBeNull()
  })

  it('does not call onCancel when dismissed after completion', async () => {
    const onCancel = vi.fn()
    await openCheckoutModal({ checkoutUrl: CHECKOUT_URL, onCancel })
    post(frameOf(overlay()!).contentWindow, msg('status', { status: 'completed' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onCancel).not.toHaveBeenCalled()
    expect(overlay()).toBeNull()
  })

  it('pulls focus back into the dialog', async () => {
    const outside = document.createElement('input')
    document.body.appendChild(outside)
    const instance = await openCheckoutModal({ checkoutUrl: CHECKOUT_URL })
    outside.focus()
    expect(document.activeElement).toBe(document.querySelector('.warp-close'))
    instance.destroy()
  })

  it('rejects with destroyed when closed while fetching the URL', async () => {
    const onCancel = vi.fn()
    const onError = vi.fn()
    const promise = openCheckoutModal({
      fetchCheckoutUrl: () => new Promise((r) => setTimeout(() => r(CHECKOUT_URL), 20)),
      onCancel,
      onError,
    })
    await Promise.resolve()
    ;(document.querySelector('.warp-close') as HTMLButtonElement).click()
    await expect(promise).rejects.toMatchObject({ code: 'destroyed' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
    expect(overlay()).toBeNull()
  })

  it('removes the overlay on fetch_failed', async () => {
    await expect(
      openCheckoutModal({ fetchCheckoutUrl: () => Promise.reject(new Error('nope')) }),
    ).rejects.toMatchObject({ code: 'fetch_failed' })
    expect(overlay()).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })
})
