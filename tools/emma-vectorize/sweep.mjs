// Param sweep for emma-idle: try a few (filterSpeckle, colorPrecision) combos,
// render each NEW head next to OLD, write a contact sheet. Tuning aid only.
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  vectorize,
  optimize,
  ColorMode,
  Hierarchical,
  PathSimplifyMode,
  OptimizePreset,
} from '@neplex/vectorizer'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })

const png = readFileSync(
  join(repoRoot, 'design/references/character-emma/transparent/emma-idle.png'),
)
const SCALE = 2000 / 1024

// Second sweep — hold colorPrecision=8 (keeps catchlights/blush/iris detail),
// vary filterSpeckle in the mid band + push spline simplification (higher
// corner/splice thresholds = fewer nodes) to cut bytes without dropping colour
// regions. Target the 130-260KB band.
const combos = [
  { fs: 10, cp: 8, ld: 16, ct: 80, st: 60 },
  { fs: 12, cp: 8, ld: 16, ct: 90, st: 75 },
  { fs: 14, cp: 8, ld: 16, ct: 90, st: 75 },
  { fs: 12, cp: 8, ld: 20, ct: 100, st: 90 },
]

const base = {
  colorMode: ColorMode.Color,
  hierarchical: Hierarchical.Stacked,
  mode: PathSimplifyMode.Spline,
  lengthThreshold: 4,
  maxIterations: 10,
  pathPrecision: 2,
}

async function trace(c) {
  const cfg = {
    ...base,
    filterSpeckle: c.fs,
    colorPrecision: c.cp,
    layerDifference: c.ld,
    cornerThreshold: c.ct,
    spliceThreshold: c.st,
  }
  const raw = await vectorize(png, cfg)
  const open = raw.indexOf('>', raw.indexOf('<svg')) + 1
  const close = raw.lastIndexOf('</svg>')
  const inner = raw.slice(open, close).trim()
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" preserveAspectRatio="xMidYMid meet"><g transform="scale(${SCALE})">${inner}</g></svg>`
  const min = await optimize(wrapped, {
    preset: OptimizePreset.Safe,
    multipass: true,
  })
  const paths = (min.match(/<path/g) || []).length
  return { svg: min, bytes: Buffer.byteLength(min), paths }
}

const toUri = (s) =>
  'data:image/svg+xml;base64,' + Buffer.from(s, 'utf8').toString('base64')
const oldUri = toUri(readFileSync(join(outDir, 'emma-idle-OLD.svg'), 'utf8'))

const results = []
for (const c of combos) {
  const r = await trace(c)
  results.push({ c, ...r })
  console.log(`fs=${c.fs} cp=${c.cp} ld=${c.ld}: ${r.bytes}B ${r.paths} paths`)
}

// contact sheet: OLD then each combo, head-cropped
const cell = (label, uri) =>
  `<div class="col"><div class="cap">${label}</div><div class="win"><img src="${uri}"></div></div>`
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#fff;font-family:system-ui;}
  .row{display:flex;flex-wrap:wrap;gap:20px;padding:24px;}
  .col{display:flex;flex-direction:column;align-items:center;gap:6px;}
  .cap{font-size:14px;font-weight:600;}
  .win{width:340px;height:300px;overflow:hidden;border:1px solid #ccc;background:#f7f3ef;position:relative;}
  img{width:1150px;position:absolute;top:-40px;left:-400px;}
</style></head><body><div class="row">
  ${cell('OLD', oldUri)}
  ${results.map((r) => cell(`fs${r.c.fs} cp${r.c.cp} ct${r.c.ct} st${r.c.st} (${Math.round(r.bytes / 1024)}KB/${r.paths}p)`, toUri(r.svg))).join('')}
</div></body></html>`

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1500, height: 700 },
  deviceScaleFactor: 2,
})
const p = await ctx.newPage()
await p.setContent(html, { waitUntil: 'networkidle' })
await p.waitForTimeout(150)
const file = join(outDir, 'sweep-head.png')
await (await p.$('.row')).screenshot({ path: file })
console.log('wrote', file)
await browser.close()
