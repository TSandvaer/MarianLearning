// Diagnostic — why is the smile/mouth gone? Trace the source, then dump every
// path whose bbox centre lands in the MOUTH region, with its fill, bbox, area,
// what snapFill() would do to it, and whether despeckle would drop it. Also
// dumps the same for the whole lower-face band so we can see the mouth's
// neighbours. Instrument, not guess.
//
//   node diag-mouth.mjs          # on hardened-alpha source (pipeline-equiv)
//   node diag-mouth.mjs raw      # on raw source (isolate the alpha-harden)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  vectorize,
  ColorMode,
  Hierarchical,
  PathSimplifyMode,
} from '@neplex/vectorizer'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const SRC_DIM = 1024
const srcPath = join(
  repoRoot,
  'design/references/character-emma/transparent/emma-idle.png',
)

const RAW = process.argv[2] === 'raw'
const ALPHA_CUT = 160

async function hardenAlpha(png) {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const px = info.width * info.height
  for (let i = 0; i < px; i++) {
    const a = data[i * 4 + 3]
    data[i * 4 + 3] = a < ALPHA_CUT ? 0 : 255
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
}

const TRACE_CONFIG = {
  colorMode: ColorMode.Color,
  hierarchical: Hierarchical.Stacked,
  filterSpeckle: 4,
  colorPrecision: 8,
  layerDifference: 6,
  mode: PathSimplifyMode.Spline,
  cornerThreshold: 70,
  lengthThreshold: 4,
  maxIterations: 10,
  spliceThreshold: 55,
  pathPrecision: 2,
}

// mirror of snapFill from the pipeline
const BIBLE = [
  ['skin', '#F5DCC9'],
  ['skin-shadow', '#E8C4A8'],
  ['hair', '#5C3F31'],
  ['hair-highlight', '#8B6650'],
  ['cardigan', '#F0CDB8'],
  ['cardigan-shadow', '#D9AC93'],
  ['blouse', '#FFF6EE'],
  ['eye', '#3E2818'],
].map(([n, h]) => [
  n,
  [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ],
])
const SNAP_RADIUS = 28
function snap(hex) {
  const rgb = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
  let best = null,
    bd = Infinity
  for (const [n, t] of BIBLE) {
    const d = Math.sqrt(
      (rgb[0] - t[0]) ** 2 + (rgb[1] - t[1]) ** 2 + (rgb[2] - t[2]) ** 2,
    )
    if (d < bd) {
      bd = d
      best = n
    }
  }
  return bd <= SNAP_RADIUS
    ? `${best} (Δ${bd.toFixed(0)})`
    : `KEEP (nearest ${best} Δ${bd.toFixed(0)})`
}

// The tracer emits each path's geometry in LOCAL (origin-relative absolute)
// coords inside `d`, with the real canvas position in transform="translate(tx,ty)".
// So canvas bbox = local d-extent + (tx,ty).
function bbox(d, tx, ty) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)
  if (!nums) return null
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = +nums[i],
      y = +nums[i + 1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX: minX + tx, minY: minY + ty, maxX: maxX + tx, maxY: maxY + ty }
}

const raw = readFileSync(srcPath)
const png = RAW ? raw : await hardenAlpha(raw)
const svg = await vectorize(png, TRACE_CONFIG)

// mouth band: y 0.22..0.32, central face width 0.40..0.60 (mouth is central)
const Y0 = 0.22 * SRC_DIM,
  Y1 = 0.32 * SRC_DIM
const X0 = 0.4 * SRC_DIM,
  X1 = 0.6 * SRC_DIM
const MIN_AREA = 0.0009

console.log(
  `\n=== ${RAW ? 'RAW' : 'HARDENED'} source — lower-face paths (y 0.15..0.26) ===`,
)
// path tag: <path d="..." fill="#rrggbb" transform="translate(tx,ty)"/>
const rx =
  /<path\b[^>]*?\bd="([^"]*)"[^>]*?\bfill="(#[0-9a-fA-F]{6})"[^>]*?\btransform="translate\(([-\d.]+),\s*([-\d.]+)\)"/g
let m,
  n = 0
while ((m = rx.exec(svg))) {
  const d = m[1]
  const fill = m[2].toLowerCase()
  const tx = +m[3],
    ty = +m[4]
  const bb = bbox(d, tx, ty)
  if (!bb) continue
  const cx = (bb.minX + bb.maxX) / 2,
    cy = (bb.minY + bb.maxY) / 2
  if (cy < Y0 || cy > Y1 || cx < X0 || cx > X1) continue
  const w = bb.maxX - bb.minX,
    h = bb.maxY - bb.minY
  const areaFrac = (w * h) / (SRC_DIM * SRC_DIM)
  n++
  console.log(
    `  fill=${fill}  c=(${cx.toFixed(0)},${cy.toFixed(0)})  ${w.toFixed(0)}x${h.toFixed(0)}  area=${(areaFrac * 100).toFixed(3)}%  snap=${snap(fill)}  ${areaFrac < MIN_AREA ? 'BELOW-MIN_AREA' : ''}`,
  )
}
console.log(`  (${n} paths in lower-face band)`)
