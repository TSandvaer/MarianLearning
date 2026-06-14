// Render OLD (PNG-in-SVG) vs NEW (vector) emma pose side-by-side at the three
// real on-screen sizes (Greet 60vh / Math 26vh / Hub 22vh) for fidelity review.
//
// Reads the OLD svg from a path arg, the NEW from public/assets/.
// Emits a PNG screenshot per size under tools/emma-vectorize/out/.
//
//   node render-compare.mjs idle /tmp/emma-idle-OLD.svg
//
// Uses the worktree's own Playwright chromium.

import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })

const POSE = process.argv[2] || 'idle'
const OLD_PATH = process.argv[3] || `/tmp/emma-${POSE}-OLD.svg`
const NEW_PATH = join(repoRoot, 'public/assets', `emma-${POSE}.svg`)

const oldSvg = readFileSync(OLD_PATH, 'utf8')
const newSvg = readFileSync(NEW_PATH, 'utf8')

// data-uri so the page is self-contained (no server)
const toUri = (s) =>
  'data:image/svg+xml;base64,' + Buffer.from(s, 'utf8').toString('base64')
const oldUri = toUri(oldSvg)
const newUri = toUri(newSvg)

// Viewport: iPad portrait. The on-screen sizes are vh-relative; 1366 tall.
const VH = 1366
const sizes = [
  { label: 'Greet 60vh', vh: 60 },
  { label: 'Math 26vh', vh: 26 },
  { label: 'Hub 22vh', vh: 22 },
]

function page(sizePx, label) {
  // checkerboard bg so transparent edges + linework crispness are both visible
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font-family:system-ui,sans-serif;background:#fff;}
    .row{display:flex;align-items:flex-end;gap:48px;padding:32px;}
    .col{display:flex;flex-direction:column;align-items:center;gap:8px;}
    .cap{font-size:20px;font-weight:600;color:#333;}
    .frame{
      background-image:
        linear-gradient(45deg,#eee 25%,transparent 25%),
        linear-gradient(-45deg,#eee 25%,transparent 25%),
        linear-gradient(45deg,transparent 75%,#eee 75%),
        linear-gradient(-45deg,transparent 75%,#eee 75%);
      background-size:24px 24px;
      background-position:0 0,0 12px,12px -12px,-12px 0;
      border:1px solid #ccc;
    }
    img{height:${sizePx}px;display:block;}
    .title{font-size:24px;font-weight:700;padding:24px 32px 0;color:#111;}
  </style></head><body>
    <div class="title">emma-${POSE} — ${label}</div>
    <div class="row">
      <div class="col"><div class="cap">OLD (PNG-in-SVG)</div><div class="frame"><img src="${oldUri}"></div></div>
      <div class="col"><div class="cap">NEW (vector)</div><div class="frame"><img src="${newUri}"></div></div>
    </div>
  </body></html>`
}

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1400, height: VH },
  deviceScaleFactor: 2, // retina — the whole point is crisp-at-retina
})
const p = await ctx.newPage()

for (const s of sizes) {
  const px = Math.round((s.vh / 100) * VH)
  await p.setContent(page(px, s.label), { waitUntil: 'networkidle' })
  await p.waitForTimeout(150)
  const file = join(
    outDir,
    `emma-${POSE}-${s.label.replace(/\s+/g, '-').toLowerCase()}.png`,
  )
  // screenshot just the row region
  const el = await p.$('.row')
  await el.screenshot({ path: file })
  console.log(`wrote ${file}`)
}

await browser.close()
console.log('done')
