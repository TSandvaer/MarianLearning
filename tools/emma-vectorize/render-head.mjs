// Zoomed head-region comparison OLD vs NEW for fine fidelity (face, eyes, bow).
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })

const POSE = process.argv[2] || 'idle'
const OLD_PATH = process.argv[3] || `/tmp/emma-${POSE}-OLD.svg`
const NEW_PATH = join(repoRoot, 'public/assets', `emma-${POSE}.svg`)
const toUri = (s) =>
  'data:image/svg+xml;base64,' + Buffer.from(s, 'utf8').toString('base64')
const oldUri = toUri(readFileSync(OLD_PATH, 'utf8'))
const newUri = toUri(readFileSync(NEW_PATH, 'utf8'))

// The figure occupies the full 2000x2000 box; head is roughly the top ~28%.
// Show each SVG inside an overflow-hidden window that crops to the head.
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#fff;font-family:system-ui;}
  .row{display:flex;gap:40px;padding:32px;}
  .col{display:flex;flex-direction:column;align-items:center;gap:8px;}
  .cap{font-size:20px;font-weight:600;}
  .win{width:520px;height:420px;overflow:hidden;border:1px solid #ccc;
    background:#f7f3ef;position:relative;}
  /* scale the 2000-box svg up so the head fills the window:
     img is 1700px wide, shifted up so head sits in frame */
  img{width:1700px;position:absolute;top:-60px;left:-590px;}
</style></head><body>
  <div class="row">
    <div class="col"><div class="cap">OLD head</div><div class="win"><img src="${oldUri}"></div></div>
    <div class="col"><div class="cap">NEW head</div><div class="win"><img src="${newUri}"></div></div>
  </div>
</body></html>`

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1180, height: 520 },
  deviceScaleFactor: 2,
})
const p = await ctx.newPage()
await p.setContent(html, { waitUntil: 'networkidle' })
await p.waitForTimeout(150)
const file = join(outDir, `emma-${POSE}-head.png`)
await (await p.$('.row')).screenshot({ path: file })
console.log('wrote', file)
await browser.close()
