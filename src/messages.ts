import type { CheckoutStatus, WarpCheckoutMessage } from './types'

const STATUSES: ReadonlySet<string> = new Set(['pending', 'processing', 'completed', 'failed', 'expired'])

export function isCheckoutStatus(value: unknown): value is CheckoutStatus {
  return typeof value === 'string' && STATUSES.has(value)
}

/** Shape check for messages posted by the Warp checkout page (protocol version 1). */
export function isWarpCheckoutMessage(data: unknown): data is WarpCheckoutMessage {
  if (typeof data !== 'object' || data === null) return false
  const m = data as Record<string, unknown>
  if (m.source !== 'warp-checkout' || m.version !== 1) return false
  if (typeof m.session_id !== 'string') return false
  switch (m.type) {
    case 'ready':
    case 'cancel':
    case 'return':
      return true
    case 'resize':
      return typeof m.height === 'number' && Number.isFinite(m.height) && m.height >= 0
    case 'status':
      return isCheckoutStatus(m.status)
    default:
      return false
  }
}
