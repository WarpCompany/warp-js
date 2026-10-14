<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./.github/assets/symbol_white.png" />
    <img src="./.github/assets/symbol_black.png" alt="Warp" height="64" />
  </picture>
</p>

<h1 align="center">Pay with Warp: JavaScript embed</h1>

<p align="center">
  Embed the <a href="https://usewarp.net">Pay with Warp</a> checkout in your site as an inline iframe, a modal, a popup or a web component.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@warpfi/js"><img src="https://img.shields.io/npm/v/@warpfi/js?color=9E1FAA" alt="npm" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT" /></a>
  <a href="https://developer.usewarp.net"><img src="https://img.shields.io/badge/docs-developer.usewarp.net-9E1FAA" alt="Docs" /></a>
</p>

---

Your server creates a checkout session with your `sk_` secret key and returns its `checkout_url` to the browser. This package shows that checkout on your page instead of redirecting to it. The customer pays without leaving your site, you get UI events as the payment progresses, and Warp notifies your server with a signed webhook once the payment is verified on-chain.

> [!WARNING]
> This project is under active development. Test with `sk_test_` keys on testnets before accepting mainnet payments.

## Features

- Inline iframe that resizes to fit its content
- Accessible modal with Escape, backdrop and close-button handling, full-screen on mobile
- Popup fallback that survives popup blockers
- `<warp-checkout>` web component and a `<script>` tag build
- Ready, status, complete, cancel and return events
- Strict message checks: origin, source window, shape, protocol version and session id
- Zero dependencies, typed, safe to import during server-side rendering

## Installation

Requirements: a modern browser. Works with any framework or none. For React and Vue, see [@warpfi/react](https://github.com/WarpCompany/warp-react) and [@warpfi/vue](https://github.com/WarpCompany/warp-vue).

```bash
npm install @warpfi/js
```

Or load it from a CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@warpfi/js@0/dist/warp.global.js"></script>
```

## Usage

Create the session on your server with [@warpfi/node](https://github.com/WarpCompany/warp-node). Never put your secret key in the browser.

```ts
import Warp from '@warpfi/node'
const warp = new Warp(process.env.WARP_SECRET_KEY!)
app.post('/api/checkout', async (req, res) => {
  const session = await warp.checkout.sessions.create({ amount_usd: '49.99', return_url: 'https://example.com/thanks', cancel_url: 'https://example.com/cart' })
  res.json({ checkout_url: session.checkout_url })
})
```

Then mount the checkout in the browser:

```ts
import { mountCheckout } from '@warpfi/js'

async function fetchCheckoutUrl(): Promise<string> {
  const res = await fetch('/api/checkout', { method: 'POST' })
  if (!res.ok) throw new Error(`Checkout request failed: ${res.status}`)
  const { checkout_url } = await res.json()
  return checkout_url
}

const checkout = await mountCheckout('#checkout', {
  fetchCheckoutUrl,
  onComplete: () => {
    // UI signal only. Fulfil the order from your webhook handler.
    window.location.href = '/thanks'
  },
  onError: (error) => console.error(error.code, error.message),
})

// Later, e.g. when navigating away:
checkout.destroy()
```

You can also pass a `checkoutUrl` you already have instead of `fetchCheckoutUrl`.

### Script tag

The CDN build exposes `window.Warp` and registers `<warp-checkout>`.

```html
<div id="checkout"></div>
<script src="https://cdn.jsdelivr.net/npm/@warpfi/js@0/dist/warp.global.js"></script>
<script>
  fetch('/api/checkout', { method: 'POST' })
    .then((res) => res.json())
    .then(({ checkout_url }) =>
      Warp.mountCheckout('#checkout', {
        checkoutUrl: checkout_url,
        onComplete: () => (window.location.href = '/thanks'),
      }),
    )
</script>
```

### Modal

Opens a full-screen overlay. It closes on Escape, a backdrop click or the close button (calling `onCancel` if the payment has not completed), and after `onCancel` or `onReturn` from the checkout page. Each time it closes on its own, `onClose` is called last, so you can reset your UI there.

```ts
import { openCheckoutModal } from '@warpfi/js'

document.querySelector('#pay')!.addEventListener('click', () => {
  openCheckoutModal({
    fetchCheckoutUrl,
    theme: 'dark',
    onComplete: () => showThankYou(),
    onCancel: () => console.log('Checkout cancelled'),
    onClose: () => console.log('Checkout closed'),
  }).catch(() => {})
})
```

### Popup fallback

Use a popup when the checkout cannot run in a frame on your page, for example when the customer's wallet does not work inside iframes. Call it directly in a click handler: the window opens immediately and is pointed at the checkout once `fetchCheckoutUrl` resolves. If the customer closes the window before paying, `onCancel` is called. Whenever the window closes on its own or is closed by the customer, `onClose` is called last.

```ts
import { openCheckoutPopup } from '@warpfi/js'

button.addEventListener('click', () => {
  openCheckoutPopup({
    fetchCheckoutUrl,
    onComplete: () => showThankYou(),
    onError: (error) => {
      if (error.code === 'popup_blocked') window.location.href = '/checkout'
    },
  }).catch(() => {})
})
```

If your page uses COOP, set it to `same-origin-allow-popups` so the popup can report back.

### Web component

```html
<script type="module">
  import '@warpfi/js/element'
</script>

<warp-checkout checkout-url="https://checkout.usewarp.net/session/ps_..." theme="auto"></warp-checkout>

<script type="module">
  const el = document.querySelector('warp-checkout')
  el.addEventListener('warp:complete', () => (window.location.href = '/thanks'))
  el.addEventListener('warp:error', (event) => console.error(event.detail.error))
</script>
```

Attributes: `checkout-url` (required), `theme` (`light`, `dark` or `auto`) and `checkout-origin`. Changing an attribute re-mounts the checkout. Removing the element tears it down.

### Events

| Callback | Element event | When |
| -------- | ------------- | ---- |
| `onReady()` | `warp:ready` | The checkout page has loaded (once per instance) |
| `onStatus(status)` | `warp:status` (`detail.status`) | On load and whenever the status changes: `pending`, `processing`, `completed`, `failed`, `expired` |
| `onComplete()` | `warp:complete` | The status became `completed` (once) |
| `onCancel()` | `warp:cancel` | The customer clicked "Cancel and return", or closed the modal or popup before completing |
| `onReturn()` | `warp:return` | The customer clicked "Back to merchant" on the success page |
| `onError(error)` | `warp:error` (`detail.error`) | A `WarpCheckoutError`, see below |
| `onClose()` | (none) | Modal and popup only: the checkout closed, after any `onCancel` or `onReturn`. Fires once, including when the customer closes it after paying. Not called when you call `destroy()` or abort the `signal`, and never for inline checkouts |

`WarpCheckoutError.code` is one of:

| Code | Meaning |
| ---- | ------- |
| `invalid_checkout_url` | The URL is not a checkout session URL on `checkoutOrigin`, or neither `checkoutUrl` nor `fetchCheckoutUrl` was given |
| `fetch_failed` | `fetchCheckoutUrl` threw or did not return a URL |
| `popup_blocked` | The browser blocked the popup |
| `load_failed` | The checkout did not report ready within 15 seconds, usually because framing is not allowed |
| `destroyed` | The checkout was closed or aborted before it finished loading |

Errors are passed to `onError`, and errors during setup also reject the returned promise. A `destroyed` rejection is not passed to `onError`. To cancel a pending setup, pass an `AbortSignal` as `signal`.

### Allowed origins

The checkout can only be framed by, and only sends events to, the origins of the session's `return_url` and `cancel_url`. Create the session with a `return_url` or `cancel_url` on the site that embeds it. Sessions without either cannot be framed and send no events; redirect to `checkout_url` instead. Testnet sessions (created with an `sk_test_` key) also allow `http://localhost` and `http://127.0.0.1` on any port.

If your site sends a Content-Security-Policy, allow the checkout with `frame-src https://checkout.usewarp.net`.

### Security

Events are UI signals only. Anyone can open your page and call your callbacks from the console. Confirm payment on your server with the `payment.completed` [webhook](https://developer.usewarp.net/warp-pay/webhooks) or by retrieving the session (`GET /v1/checkout/sessions/:id`) before fulfilling an order.

This package accepts a message only if it comes from `checkoutOrigin` and from the exact iframe or popup it opened, has the expected shape and protocol version, and matches the session id in the checkout URL. The iframe is sandboxed so it cannot navigate your page. Never put secrets in the checkout URL.

## API

| Export | Description |
| ------ | ----------- |
| `mountCheckout(container, options)` | Mounts the checkout inline in an element or CSS selector. Resolves to a `CheckoutInstance` |
| `openCheckoutModal(options)` | Opens the checkout in a modal overlay |
| `openCheckoutPopup(options)` | Opens the checkout in a popup window. Call from a user gesture |
| `parseCheckoutUrl(url, checkoutOrigin?)` | Validates a checkout URL and returns `{ url, sessionId }`. Throws `invalid_checkout_url` |
| `isWarpCheckoutMessage(data)` | Type guard for checkout messages |
| `WarpCheckoutError` | Error class with a `code` |
| `DEFAULT_CHECKOUT_ORIGIN` | `https://checkout.usewarp.net` |
| `@warpfi/js/element` | Registers `<warp-checkout>`. Exports `WarpCheckoutElement` and `defineWarpCheckoutElement(tagName?)` |
| Types | `CheckoutOptions`, `CheckoutInstance`, `CheckoutStatus`, `CheckoutTheme`, `WarpCheckoutMessage`, `WarpCheckoutErrorCode` |

`CheckoutOptions`: `checkoutUrl` or `fetchCheckoutUrl`, `theme` (`'auto'` by default), `checkoutOrigin` (for self-hosted or staging checkouts), `signal`, and the callbacks above. `CheckoutInstance` has `sessionId`, `status` and an idempotent `destroy()` that removes the DOM and all listeners.

## Documentation

| Topic | Description |
| ----- | ----------- |
| [Embedded checkout](https://developer.usewarp.net/warp-pay/embedded-checkout) | Embed modes, events, allowed origins |
| [Webhooks](https://developer.usewarp.net/warp-pay/webhooks) | Signature verification and retries |
| [API reference](https://developer.usewarp.net/api-reference/introduction) | Endpoints, parameters and errors |

Full product documentation is at [developer.usewarp.net](https://developer.usewarp.net).

## Development

```bash
git clone https://github.com/WarpCompany/warp-js.git
cd warp-js
npm install
npm test
npm run build
```

## Project structure

```
src/            Embed modes, message handling, URL validation, web component, script tag entry
test/           Vitest tests (jsdom)
dist/           Build output: ESM, CJS, type declarations and warp.global.js
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

Please report security issues privately as described in [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)
