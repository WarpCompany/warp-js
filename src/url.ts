import { WarpCheckoutError } from './errors'

export const DEFAULT_CHECKOUT_ORIGIN = 'https://checkout.usewarp.net'

const PATH_RE = /^\/(?:session|success)\/(ps_[0-9a-f]{32})\/?$/
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

function invalid(message: string): WarpCheckoutError {
  return new WarpCheckoutError('invalid_checkout_url', message)
}

/** Validates a checkout origin and returns it in canonical form (scheme://host[:port]). */
export function normalizeCheckoutOrigin(checkoutOrigin: string = DEFAULT_CHECKOUT_ORIGIN): string {
  let parsed: URL
  try {
    parsed = new URL(checkoutOrigin)
  } catch {
    throw invalid(`Invalid checkoutOrigin: ${checkoutOrigin}`)
  }
  const isLocalHttp = parsed.protocol === 'http:' && LOCAL_HOSTS.has(parsed.hostname)
  if (parsed.protocol !== 'https:' && !isLocalHttp) {
    throw invalid('checkoutOrigin must use https (http is only allowed for localhost and 127.0.0.1)')
  }
  if (parsed.username || parsed.password) throw invalid('checkoutOrigin must not contain credentials')
  return parsed.origin
}

/**
 * Validates a checkout_url against the checkout origin and extracts the session id.
 * Accepts `/session/ps_<32 hex>` and `/success/ps_<32 hex>`.
 * Throws WarpCheckoutError('invalid_checkout_url').
 */
export function parseCheckoutUrl(url: string, checkoutOrigin?: string): { url: URL; sessionId: string } {
  const origin = normalizeCheckoutOrigin(checkoutOrigin)
  if (typeof url !== 'string' || url.length === 0) throw invalid('checkoutUrl must be a non-empty string')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw invalid(`Invalid checkout URL: ${url}`)
  }
  if (parsed.username || parsed.password) throw invalid('Checkout URL must not contain credentials')
  if (parsed.origin !== origin) {
    throw invalid(`Checkout URL origin ${parsed.origin} does not match checkoutOrigin ${origin}`)
  }
  const match = PATH_RE.exec(parsed.pathname)
  if (!match || !match[1]) throw invalid('Checkout URL must look like <checkoutOrigin>/session/ps_<32 hex>')
  return { url: parsed, sessionId: match[1] }
}

export function buildEmbedUrl(url: URL, embed: 'iframe' | 'popup', theme: string | undefined): string {
  const out = new URL(url.href)
  out.hash = ''
  out.searchParams.set('embed', embed)
  if (theme === 'light' || theme === 'dark') out.searchParams.set('theme', theme)
  else out.searchParams.delete('theme')
  return out.href
}
