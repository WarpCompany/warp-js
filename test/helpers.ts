export const ORIGIN = 'https://checkout.usewarp.net'
export const SID = `ps_${'0123456789abcdef'.repeat(2)}`
export const CHECKOUT_URL = `${ORIGIN}/session/${SID}`

export function msg(type: string, extra: Record<string, unknown> = {}, sessionId = SID): Record<string, unknown> {
  return { source: 'warp-checkout', version: 1, session_id: sessionId, type, ...extra }
}

/** Dispatches a message event on window as if posted by `source` from `origin`. */
export function post(source: unknown, data: unknown, origin = ORIGIN): void {
  const event = new MessageEvent('message', { data, origin })
  Object.defineProperty(event, 'source', { value: source })
  window.dispatchEvent(event)
}

export function frameOf(root: ParentNode = document): HTMLIFrameElement {
  const iframe = root.querySelector('iframe')
  if (!iframe) throw new Error('iframe not found')
  return iframe
}

export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
