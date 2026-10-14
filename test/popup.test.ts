import { afterEach, describe, expect, it, vi } from 'vitest'
import { openCheckoutPopup } from '../src/index'
import { CHECKOUT_URL, SID, msg, post } from './helpers'

interface FakePopup {
  closed: boolean
  close: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  location: { replace: ReturnType<typeof vi.fn> }
  document: Document
}

function fakePopup(): FakePopup {
  const popup: FakePopup = {
    closed: false,
    close: vi.fn(() => {
      popup.closed = true
    }),
    focus: vi.fn(),
    location: { replace: vi.fn() },
    document: document.implementation.createHTMLDocument(''),
  }
  return popup
}

afterEach(() => {
  vi.useRealTimers()
})

describe('openCheckoutPopup', () => {
  it('opens about:blank synchronously, then navigates with embed=popup', async () => {
    const popup = fakePopup()
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    let resolve!: (url: string) => void
    const promise = openCheckoutPopup({
      fetchCheckoutUrl: () => new Promise<string>((r) => (resolve = r)),
      theme: 'light',
    })
    expect(open).toHaveBeenCalledTimes(1)
    expect(open.mock.calls[0]?.[0]).toBe('about:blank')
    expect(open.mock.calls[0]?.[2]).toMatch(/width=480,height=720/)
    expect(open.mock.calls[0]?.[2]).not.toMatch(/noopener/)
    expect(popup.location.replace).not.toHaveBeenCalled()

    resolve(CHECKOUT_URL)
    const instance = await promise
    const target = new URL(popup.location.replace.mock.calls[0]?.[0] as string)
    expect(target.pathname).toBe(`/session/${SID}`)
    expect(target.searchParams.get('embed')).toBe('popup')
    expect(target.searchParams.get('theme')).toBe('light')
    expect(instance.sessionId).toBe(SID)
    instance.destroy()
    expect(popup.close).toHaveBeenCalled()
  })

  it('rejects with popup_blocked when window.open returns null', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const onError = vi.fn()
    const fetchCheckoutUrl = vi.fn(async () => CHECKOUT_URL)
    await expect(openCheckoutPopup({ fetchCheckoutUrl, onError })).rejects.toMatchObject({ code: 'popup_blocked' })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0].code).toBe('popup_blocked')
    expect(fetchCheckoutUrl).not.toHaveBeenCalled()
  })

  it('does not open a window for an invalid checkoutUrl', async () => {
    const open = vi.spyOn(window, 'open')
    await expect(openCheckoutPopup({ checkoutUrl: 'https://evil.example.com/session/x' })).rejects.toMatchObject({
      code: 'invalid_checkout_url',
    })
    expect(open).not.toHaveBeenCalled()
  })

  it('closes the popup and reports fetch_failed', async () => {
    const popup = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const onError = vi.fn()
    await expect(
      openCheckoutPopup({ fetchCheckoutUrl: () => Promise.reject(new Error('boom')), onError }),
    ).rejects.toMatchObject({ code: 'fetch_failed' })
    expect(onError.mock.calls[0]?.[0].code).toBe('fetch_failed')
    expect(popup.close).toHaveBeenCalled()
  })

  it('accepts messages only from the popup window', async () => {
    const popup = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const onStatus = vi.fn()
    const onComplete = vi.fn()
    const instance = await openCheckoutPopup({ checkoutUrl: CHECKOUT_URL, onStatus, onComplete })
    post(window, msg('status', { status: 'completed' }))
    post(popup, msg('status', { status: 'completed' }), 'https://evil.example.com')
    expect(onStatus).not.toHaveBeenCalled()
    post(popup, msg('status', { status: 'completed' }))
    post(popup, msg('status', { status: 'completed' }))
    expect(onStatus).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
    instance.destroy()
  })

  it('calls onCancel when the customer closes the popup before completing', async () => {
    vi.useFakeTimers()
    const popup = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const onCancel = vi.fn()
    await openCheckoutPopup({ checkoutUrl: CHECKOUT_URL, onCancel })
    vi.advanceTimersByTime(1000)
    expect(onCancel).not.toHaveBeenCalled()
    popup.closed = true
    vi.advanceTimersByTime(600)
    expect(onCancel).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not call onCancel when closed after completion', async () => {
    vi.useFakeTimers()
    const popup = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const onCancel = vi.fn()
    await openCheckoutPopup({ checkoutUrl: CHECKOUT_URL, onCancel })
    post(popup, msg('status', { status: 'completed' }))
    popup.closed = true
    vi.advanceTimersByTime(1000)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('closes the popup on cancel and return messages', async () => {
    const popupA = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popupA as unknown as Window)
    const onCancel = vi.fn()
    await openCheckoutPopup({ checkoutUrl: CHECKOUT_URL, onCancel })
    post(popupA, msg('cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(popupA.close).toHaveBeenCalled()

    const popupB = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popupB as unknown as Window)
    const onReturn = vi.fn()
    await openCheckoutPopup({ checkoutUrl: CHECKOUT_URL, onReturn, onCancel })
    post(popupB, msg('return'))
    expect(onReturn).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(popupB.close).toHaveBeenCalled()
  })

  it('calls onClose once when the popup window is closed, before or after completion', async () => {
    vi.useFakeTimers()
    const popupA = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popupA as unknown as Window)
    const calls: string[] = []
    await openCheckoutPopup({
      checkoutUrl: CHECKOUT_URL,
      onCancel: () => calls.push('cancel'),
      onClose: () => calls.push('close'),
    })
    popupA.closed = true
    vi.advanceTimersByTime(600)
    vi.advanceTimersByTime(5000)
    expect(calls).toEqual(['cancel', 'close'])

    const popupB = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popupB as unknown as Window)
    const onCancel = vi.fn()
    const onClose = vi.fn()
    await openCheckoutPopup({ checkoutUrl: CHECKOUT_URL, onCancel, onClose })
    post(popupB, msg('status', { status: 'completed' }))
    popupB.closed = true
    vi.advanceTimersByTime(1000)
    expect(onCancel).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose after cancel and return messages close the popup', async () => {
    const popupA = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popupA as unknown as Window)
    const calls: string[] = []
    await openCheckoutPopup({
      checkoutUrl: CHECKOUT_URL,
      onCancel: () => calls.push('cancel'),
      onClose: () => calls.push('close'),
    })
    post(popupA, msg('cancel'))
    expect(calls).toEqual(['cancel', 'close'])

    calls.length = 0
    const popupB = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popupB as unknown as Window)
    await openCheckoutPopup({
      checkoutUrl: CHECKOUT_URL,
      onReturn: () => calls.push('return'),
      onClose: () => calls.push('close'),
    })
    post(popupB, msg('return'))
    expect(calls).toEqual(['return', 'close'])
  })

  it('does not call onClose when the merchant calls destroy()', async () => {
    vi.useFakeTimers()
    const popup = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const onClose = vi.fn()
    const instance = await openCheckoutPopup({ checkoutUrl: CHECKOUT_URL, onClose })
    instance.destroy()
    expect(popup.close).toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    expect(onClose).not.toHaveBeenCalled()
  })
})
