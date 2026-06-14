// Sweep cp8 traces through aggressive standalone SVGO to see if we can crush
// the catchlight-preserving cp8 output under the 300KB ceiling.
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  vectorize,
  ColorMode,
  Hierarchical,
  PathSimplifyMode,
} from '@neplex/vectorizer'
import { optimize as svgoOptimize } from 'svgo'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })
const png = readFileSync(
  join(repoRoot, 'design/references/character-emma/transparent/emma-idle.png'),
)
const SCALE = 2000 / 1024

function svgoCfg(floatPrecision) {
  return {
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            removeViewBox: false,
            // keep the wrapper viewBox + preserveAspectRatio
            cleanupIds: false,
          },
        },
      },
      { name: 'convertPathData', params: { floatPrecision } },
      { name: 'cleanupNumericValues', params: { floatPrecision } },
      'mergePaths',
      'removeComments',
    ],
  }
}

const combos = [
  { fs: 12, cp: 8, fp: 1 },
  { fs: 12, cp: 8, fp: 0 },
  { fs: 16, cp: 8, fp: 1 },
  { fs: 14, cp: 8, fp: 1 },
]

async function trace(c) {
  const raw = await vectorize(png, {
    colorMode: ColorMode.Color,
    hierarchical: Hierarchical.Stacked,
    mode: PathSimplifyMode.Spline,
    filterSpeckle: c.fs,
    colorPrecision: c.cp,
    layerDifference: 16,
    cornerThreshold: 80,
    lengthThreshold: 4,
    maxIterations: 10,
    spliceThreshold: 60,
    pathPrecision: 2,
  })
  const open = raw.indexOf('>', raw.indexOf('<svg')) + 1
  const close = raw.lastIndexOf('</svg>')
  const inner = raw.slice(open, close).trim()
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" preserveAspectRatio="xMidYMid meet"><g transform="scale(${SCALE})">${inner}</g></svg>`
  const { data } = svgoOptimize(wrapped, svgoCfg(c.fp))
  const paths = (data.match(/<path/g) || []).length
  return { svg: data, bytes: Buffer.byteLength(data), paths }
}

const toUri = (s) =>
  'data:image/svg+xml;base64,' + Buffer.from(s, 'utf8').toString('base64')
const oldUri = toUri(readFileSync(join(outDir, 'emma-idle-OLD.svg'), 'utf8'))

const results = []
for (const c of combos) {
  const r = await trace(c)
  results.push({ c, ...r })
  console.log(
    `fs${c.fs} cp${c.cp} fp${c.fp}: ${r.bytes}B (${Math.round(r.bytes / 1024)}KB) ${r.paths}p`,
  )
}

const cell = (label, uri) =>
  `<div class="col"><div class="cap">${label}</div><div class="win"><img src="${uri}"></div></div>`
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#fff;font-family:system-ui;}
  .row{display:flex;flex-wrap:wrap;gap:20px;padding:24px;}
  .col{display:flex;flex-direction:column;align-items:center;gap:6px;}
  .cap{font-size:13px;font-weight:600;}
  .win{width:340px;height:300px;overflow:hidden;border:1px solid #ccc;background:#f7f3ef;position:relative;}
  img{width:1150px;position:absolute;top:-40px;left:-400px;}
</style></head><body><div class="row">
  ${cell('OLD', oldUri)}
  ${results.map((r) => cell(`fs${r.c.fs} cp${r.c.cp} fp${r.c.fp} (${Math.round(r.bytes / 1024)}KB/${r.paths}p)`, toUri(r.svg))).join('')}
</div></body></html>`
const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1500, height: 700 },
  deviceScaleFactor: 2,
})
const p = await ctx.newPage()
await p.setContent(html, { waitUntil: 'networkidle' })
await p.waitForTimeout(150)
const file = join(outDir, 'sweep2-head.png')
await (await p.$('.row')).screenshot({ path: file })
console.log('wrote', file)
await browser.close()
