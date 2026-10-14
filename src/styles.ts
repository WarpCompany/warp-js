const STYLE_ID = 'warp-checkout-styles'

const LIGHT =
  '--warp-fg:#0b0b0f;--warp-muted:#6b6b76;--warp-bg:#ffffff;--warp-hover:rgba(0,0,0,.06);color-scheme:light'
const DARK =
  '--warp-fg:#f4f4f6;--warp-muted:#a1a1aa;--warp-bg:#111114;--warp-hover:rgba(255,255,255,.08);color-scheme:dark'

const CSS = [
  'warp-checkout{display:block}',
  `.warp-checkout,.warp-overlay{${LIGHT};--warp-accent:#9E1FAA}`,
  '.warp-checkout[data-warp-theme=auto],.warp-overlay[data-warp-theme=auto]{color-scheme:light dark}',
  `.warp-checkout[data-warp-theme=dark],.warp-overlay[data-warp-theme=dark]{${DARK}}`,
  `@media (prefers-color-scheme:dark){.warp-checkout[data-warp-theme=auto],.warp-overlay[data-warp-theme=auto]{${DARK};color-scheme:light dark}}`,
  '.warp-checkout{position:relative;width:100%;min-height:560px;box-sizing:border-box}',
  '.warp-checkout.warp-sized{min-height:0}',
  '.warp-frame{display:block;width:100%;height:560px;min-height:560px;border:0;margin:0;padding:0;background:transparent;opacity:0;transition:opacity .2s ease}',
  '.warp-sized .warp-frame{min-height:0}',
  '.warp-ready .warp-frame{opacity:1}',
  '.warp-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--warp-muted)}',
  '.warp-ready .warp-loading{display:none}',
  '.warp-spinner{width:28px;height:28px;box-sizing:border-box;border-radius:50%;border:3px solid var(--warp-accent);border-right-color:transparent;animation:warp-spin .8s linear infinite}',
  '.warp-failed .warp-spinner{display:none}',
  '@keyframes warp-spin{to{transform:rotate(360deg)}}',
  '@media (prefers-reduced-motion:reduce){.warp-spinner{animation-duration:2.4s}.warp-frame{transition:none}}',
  '.warp-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:rgba(9,9,12,.6);overflow-y:auto;-webkit-overflow-scrolling:touch}',
  '.warp-modal{position:relative;width:100%;max-width:480px;max-height:100%;overflow-y:auto;box-sizing:border-box;background:var(--warp-bg);color:var(--warp-fg);border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.35)}',
  '.warp-modal-header{display:flex;justify-content:flex-end;padding:8px 8px 0}',
  '.warp-close{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--warp-muted);cursor:pointer}',
  '.warp-close:hover{background:var(--warp-hover);color:var(--warp-fg)}',
  '.warp-close:focus-visible{outline:2px solid var(--warp-accent);outline-offset:2px}',
  '.warp-close svg{width:18px;height:18px}',
  '@media (max-width:640px){.warp-overlay{padding:0;align-items:stretch}.warp-modal{max-width:none;height:100%;border-radius:0;box-shadow:none}}',
].join('\n')

/** Injects the stylesheet once per document. */
export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  ;(doc.head || doc.documentElement).appendChild(style)
}
