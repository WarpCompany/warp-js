// Entry for dist/warp.global.js (script tag build).
import { defineWarpCheckoutElement } from './element'
import { WarpCheckoutError } from './errors'
import { mountCheckout } from './mount'
import { openCheckoutModal } from './modal'
import { openCheckoutPopup } from './popup'
import { DEFAULT_CHECKOUT_ORIGIN, parseCheckoutUrl } from './url'

const Warp = {
  mountCheckout,
  openCheckoutModal,
  openCheckoutPopup,
  parseCheckoutUrl,
  WarpCheckoutError,
  DEFAULT_CHECKOUT_ORIGIN,
}

declare global {
  interface Window {
    Warp?: typeof Warp
  }
}

if (typeof window !== 'undefined') {
  window.Warp = Warp
  defineWarpCheckoutElement()
}
