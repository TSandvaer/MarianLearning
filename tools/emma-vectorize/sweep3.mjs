// Sweep 3 — FACE-PRESERVATION sweep. The pilot recipe (fs16/cp8/ld16) DROPPED
// the smile + nose and washed the eyes, and speckled the whole crown. Root
// cause hypotheses:
//   - layerDifference 16 merges the thin soft-rose mouth/nose strokes into skin
//     (never tried below 16).
//   - filterSpeckle 16 discards sub-16px paths — eats 1.5-2px facial linework.
//   - hair speckle = tracer fragmenting soft AA hair edges into tiny islands.
//
// This sweep: lower layerDifference + lower filterSpeckle to KEEP the face, and
// optionally pre-clean the source alpha (kill wispy semi-transparent hair tips
// at the root) so we don't NEED a high filterSpeckle to control hair noise.
//
//   node sweep3.mjs            # trace-param sweep, no source clean
//   node sweep3.mjs clean      # same combos but on an alpha-cleaned source
import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
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
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })

const CLEAN = process.argv[2] === 'clean'
const srcPath = join(
  repoRoot,
  'design/references/character-emma/transparent/emma-idle.png',
)
const SCALE = 2000 / 1024

// Alpha-clean: harden the alpha so wispy semi-transparent hair tips (alpha <
// threshold) become fully transparent, killing the speckle root WITHOUT
// touching the opaque body/face. A small dilate-then-threshold flattens the
// fringe. We keep the RGB untouched so colours don't shift.
async function loadSource() {
  if (!CLEAN) return readFileSync(srcPath)
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  // hard alpha threshold: anything below ALPHA_CUT becomes 0, anything above
  // becomes 255 — removes the soft semi-transparent fringe the tracer speckles.
  const ALPHA_CUT = 160
  const px = info.width * info.height
  for (let i = 0; i < px; i++) {
    const a = data[i * 4 + 3]
    data[i * 4 + 3] = a < ALPHA_CUT ? 0 : 255
  }
  const cleaned = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
  writeFileSync(join(outDir, 'emma-idle-cleaned-source.png'), cleaned)
  return cleaned
}

// Combos: drive layerDifference DOWN (keep mouth/nose/eye as own regions) and
// filterSpeckle DOWN (keep thin strokes). Hold cp=8 (max). Two spline-smooth
// settings to keep bytes sane.
const combos = [
  { fs: 4, cp: 8, ld: 8, ct: 60, st: 45 },
  { fs: 6, cp: 8, ld: 8, ct: 70, st: 55 },
  { fs: 4, cp: 8, ld: 6, ct: 60, st: 45 },
  { fs: 8, cp: 8, ld: 6, ct: 70, st: 55 },
  { fs: 6, cp: 8, ld: 4, ct: 60, st: 45 },
]

const base = {
  colorMode: ColorMode.Color,
  hierarchical: Hierarchical.Stacked,
  mode: PathSimplifyMode.Spline,
  lengthThreshold: 4,
  maxIterations: 10,
  pathPrecision: 2,
}

async function trace(png, c) {
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

const png = await loadSource()
const toUri = (s) =>
  'data:image/svg+xml;base64,' + Buffer.from(s, 'utf8').toString('base64')
const oldUri = toUri(readFileSync(join(outDir, 'emma-idle-OLD.svg'), 'utf8'))

const results = []
for (const c of combos) {
  const r = await trace(png, c)
  results.push({ c, ...r })
  console.log(
    `fs=${c.fs} ld=${c.ld} ct=${c.ct}: ${Math.round(r.bytes / 1024)}KB ${r.paths} paths`,
  )
}

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
  ${results.map((r) => cell(`fs${r.c.fs} ld${r.c.ld} ct${r.c.ct} (${Math.round(r.bytes / 1024)}KB/${r.paths}p)${CLEAN ? ' CLEAN' : ''}`, toUri(r.svg))).join('')}
</div></body></html>`

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1500, height: 700 },
  deviceScaleFactor: 2,
})
const p = await ctx.newPage()
await p.setContent(html, { waitUntil: 'networkidle' })
await p.waitForTimeout(150)
const file = join(outDir, CLEAN ? 'sweep3-clean-head.png' : 'sweep3-head.png')
await (await p.$('.row')).screenshot({ path: file })
console.log('wrote', file)
await browser.close()
