// Emma pose-SVG vector re-trace harness (Track A-impl, ticket 86ca8kq42).
//
// Re-traces a single Emma pose PNG from the transparent source-of-truth into
// TRUE vector geometry, then re-wraps it in the load-bearing
// `viewBox="0 0 2000 2000" preserveAspectRatio="xMidYMid meet"` envelope that
// EmmaCharacter + the feet-pivot tilt/breathing animations depend on (spec AC7).
//
// Pipeline (spec AC5):
//   1. Trace `transparent/emma-<pose>.png` (1024x1024 RGBA) with @neplex/vectorizer
//      in color mode -> first-pass multi-region vector.
//   2. Palette-snap traced fills to the character-emma.md §2.2 bible tokens.
//   3. SVGO minify.
//   4. Re-wrap geometry in the 2000x2000 viewBox so the figure occupies the
//      same region as the current <image> (full-bleed 0..1024 -> scaled 0..2000).
//   5. XML-validate (caller runs python ET.parse).
//
// NOT an app runtime dependency. Run from this dir:
//   node vectorize-pose.mjs idle
//
// Tunable trace params live in TRACE_CONFIG below; tune to hit the AC2 fidelity
// bar + AC4 size budget without dumping raster speckle noise into micro-paths.

import { readFileSync, writeFileSync } from 'node:fs'
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
const transparentDir = join(
  repoRoot,
  'design/references/character-emma/transparent',
)
const assetsDir = join(repoRoot, 'public/assets')

// --- Bible palette tokens (character-emma.md §2.2) -------------------------
// Snapping targets — the tracer samples the raster's anti-aliased average,
// which drifts a few ΔE off the canonical tokens; we snap traced fills within
// SNAP_RADIUS to the nearest token so the AC2 palette check passes cleanly.
//
// IMPORTANT — fidelity over bible-purity (spec AC1/AC2): the task is to
// re-trace the CURRENT rendered Emma pixel-faithfully, NOT to "correct" the
// shipped art toward the bible. Where the source asset genuinely uses a token
// colour we snap to it (cleans up AA drift); where the source diverges from a
// token (e.g. emma-idle's shipped skirt is terracotta `#d1805c`/`#b05d43`, not
// the mauve `--emma-skirt #C8AAB8`) we must NOT pull it onto the token — that
// would be a recolour/redesign, out of scope. So:
//   - Only large, structurally-unambiguous tokens are in the bulk-snap set.
//   - `skirt`, `mouth`, `blush` are EXCLUDED: skirt because the shipped colour
//     diverges from the token (preserve current render); mouth/blush because
//     they are tiny regions whose rose hue is RGB-poison-close to warm
//     skin-shadow/skirt browns and would wrongly capture them. Their traced
//     values already sit within JND of the bible and ride unchanged.
//   - SNAP_RADIUS is tight so only genuine AA-drift snaps, not a hue jump.
const BIBLE_TOKENS = [
  { name: 'skin', hex: '#F5DCC9' },
  { name: 'skin-shadow', hex: '#E8C4A8' },
  { name: 'hair', hex: '#5C3F31' },
  { name: 'hair-highlight', hex: '#8B6650' },
  { name: 'cardigan', hex: '#F0CDB8' },
  { name: 'cardigan-shadow', hex: '#D9AC93' },
  { name: 'blouse', hex: '#FFF6EE' },
  { name: 'eye', hex: '#3E2818' },
]

// --- Trace config ----------------------------------------------------------
// LOCKED PILOT RECIPE (emma-idle, ticket 86ca8kq42). Tuned via the param sweep
// in sweep.mjs / sweep2.mjs. Key finding: colorPrecision is the fidelity lever
// (8 retains the cream eye-catchlights + cheek blush that 6 flattens), and the
// byte budget is then won at SVGO time via floatPrecision, NOT by raising
// filterSpeckle (which destroys the same small features). See render report.
//   - filterSpeckle 16: drops AA fringe speckle from the soft hair edge without
//     eating the catchlights (those survive because cp=8 keeps them as regions).
//   - colorPrecision 8: keeps catchlight / blush / iris as distinct fills.
//   - cornerThreshold 80 + spliceThreshold 60: smoother manhwa curves, fewer nodes.
const TRACE_CONFIG = {
  colorMode: ColorMode.Color,
  hierarchical: Hierarchical.Stacked,
  filterSpeckle: 16,
  colorPrecision: 8,
  layerDifference: 16,
  mode: PathSimplifyMode.Spline, // smooth curves, not polygons
  cornerThreshold: 80,
  lengthThreshold: 4,
  maxIterations: 10,
  spliceThreshold: 60,
  pathPrecision: 2,
}

// SVGO float precision on path coords — the dominant BYTE lever. fp=1 keeps
// sub-pixel curve smoothness on the 2000-unit viewBox (crisp at 60vh retina)
// while crushing ~364KB raw -> ~143KB. fp=0 (integer coords) halves again to
// ~90KB but risks faceting long hair curves at the largest render; fp=1 is the
// safe target-hitting choice.
const SVGO_FLOAT_PRECISION = 1

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

const BIBLE_RGB = BIBLE_TOKENS.map((t) => ({ ...t, rgb: hexToRgb(t.hex) }))

function rgbDist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

// Snap a traced fill hex to the nearest bible token within SNAP_RADIUS.
// Beyond the radius the fill is left as-is (e.g. terracotta skirt, teal bow,
// cream flats — colours that are NOT in the bulk-snap token set) — never force
// an out-of-family colour onto a distant token. Radius kept tight (28) so only
// genuine anti-alias drift snaps; a hue jump (rust -> rose) exceeds it.
const SNAP_RADIUS = 28
function snapFill(hex) {
  const rgb = hexToRgb(hex)
  let best = null
  let bestDist = Infinity
  for (const t of BIBLE_RGB) {
    const d = rgbDist(rgb, t.rgb)
    if (d < bestDist) {
      bestDist = d
      best = t
    }
  }
  if (best && bestDist <= SNAP_RADIUS) return best.hex.toLowerCase()
  return hex.toLowerCase()
}

// Rewrite every fill="#rrggbb" in the traced SVG body to the snapped token.
function snapAllFills(svg) {
  const seen = new Map()
  const out = svg.replace(/fill="(#[0-9a-fA-F]{6})"/g, (_m, hex) => {
    const snapped = snapFill(hex)
    seen.set(hex.toLowerCase(), snapped)
    return `fill="${snapped}"`
  })
  return { out, map: seen }
}

// Extract the inner geometry from the tracer's own <svg ...>...</svg> wrapper.
// The tracer emits <svg width="1024" height="1024" ...>...paths...</svg>; we
// want just the inner body so we can re-wrap it in the 2000x2000 viewBox.
function extractInner(svg) {
  const open = svg.indexOf('>', svg.indexOf('<svg')) + 1
  const close = svg.lastIndexOf('</svg>')
  return svg.slice(open, close).trim()
}

// --- Crown-speckle despeckle (deterministic, recipe-able) ------------------
// The bgclear.ai source cuts leave wispy semi-transparent hair-tip pixels at
// the crown. The tracer faithfully reproduces these as tiny disconnected
// islands that the OLD raster blurred into a soft halo — they read as speckle
// noise above the hairline at the 60vh render. filterSpeckle/Cutout don't
// remove them cleanly (they're real source regions larger than the AA-speckle
// floor and entangled with the catchlights). So we drop them here surgically:
// remove any path whose bounding box is BOTH small (area < MIN_AREA of the
// source canvas) AND sits ENTIRELY within the TOP_BAND of the figure (strictly
// ABOVE the hairline-to-eye gap). Measured on emma-idle (source 1024px):
// hair-top at y=0.028H, first eye-dark at y=0.10H — so the crown-speckle band
// is y≈0.028..0.09H. TOP_BAND=0.085 keeps the cutoff strictly above the eyes
// (0.10H) with margin; the eyes / brows / catchlights all sit BELOW it and are
// never considered. Per-pose safety: the eyes never start above ~0.10H in any
// standing front pose (head is always in the upper third but eyes never in the
// top 8.5%), so the same band is safe for all 8 poses. Coordinates are in the
// tracer's native 0..SRC_DIM space (despeckle runs BEFORE the scale-wrap).
const MIN_AREA = 0.0009 // 0.09% of canvas — a ~30x30px island in 1024 space
const TOP_BAND = 0.085 // bbox must lie entirely above 8.5% of canvas height

// Parse the absolute-coordinate numbers out of a path `d` to get a bbox.
// The tracer emits absolute commands (M/C/L) with space/comma-separated
// numbers; a coarse numeric scan is sufficient for a bbox estimate.
function pathBBox(d) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)
  if (!nums || nums.length < 2) return null
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = +nums[i]
    const y = +nums[i + 1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

// Returns { body, removed } — body with crown-speckle paths stripped.
function despeckleCrown(inner) {
  const canvasArea = SRC_DIM * SRC_DIM
  let removed = 0
  const body = inner.replace(/<path\b[^>]*\bd="([^"]*)"[^>]*\/>/g, (m, d) => {
    const bb = pathBBox(d)
    if (!bb) return m
    const w = bb.maxX - bb.minX
    const h = bb.maxY - bb.minY
    const areaFrac = (w * h) / canvasArea
    const inTopBand = bb.maxY <= SRC_DIM * TOP_BAND
    if (areaFrac < MIN_AREA && inTopBand) {
      removed++
      return ''
    }
    return m
  })
  return { body, removed }
}

const POSE = process.argv[2]
if (!POSE) {
  console.error('usage: node vectorize-pose.mjs <pose>  (e.g. idle)')
  process.exit(1)
}

const SRC_DIM = 1024 // transparent source PNG is 1024x1024
const VIEWBOX = 2000 // wrapper coordinate system (AC7)
const SCALE = VIEWBOX / SRC_DIM // 1.953125 — maps 0..1024 source onto 0..2000

const today = new Date().toISOString().slice(0, 10)

async function main() {
  const srcPath = join(transparentDir, `emma-${POSE}.png`)
  const png = readFileSync(srcPath)

  // 1. Trace
  const rawSvg = await vectorize(png, TRACE_CONFIG)

  // 2. Palette-snap
  const { out: snapped, map } = snapAllFills(rawSvg)

  // 3. Extract inner geometry, despeckle the crown, then re-wrap in 2000x2000.
  // The source traces in 0..1024 space; we wrap the geometry in a <g> scaled
  // by SCALE so it fills the 0..2000 viewBox exactly as the old <image> did
  // (the old <image> was width=2000 height=2000 over a 1024 raster — same
  // full-bleed framing, feet at the bottom of the box). AC7 preserved.
  const innerRaw = extractInner(snapped)
  const { body: inner, removed: speckRemoved } = despeckleCrown(innerRaw)
  const headerComment = `<!--
  emma-${POSE}.svg
  Emma character pose — "${POSE}".

  TRUE VECTOR re-trace (pilot, ticket 86ca8kq42, ${today}).
  Supersedes the PNG-in-SVG (base64 raster embed) technique.

  Source: design/references/character-emma/transparent/emma-${POSE}.png
    1024x1024 RGBA transparent (bgclear.ai re-cut 2026-05-14).
  Pipeline: @neplex/vectorizer color trace -> palette-snap to
    character-emma.md §2.2 bible tokens -> SVGO minify -> re-wrap in the
    load-bearing 2000x2000 viewBox. See tools/emma-vectorize/.

  CONTRACT (AC7) — DO NOT CHANGE:
    viewBox 0 0 2000 2000 + preserveAspectRatio="xMidYMid meet" + feet-at-
    bottom framing. The runtime feet-pivot tilt (rotateZ) and breathing
    (scale) in EmmaCharacter depend on this. Geometry is in neutral 2000-space
    with NO transform attribute anywhere (the 1024-to-2000 scale is baked into
    the path coordinates by SVGO) — so no baked rotation/scale collides with
    the runtime animation transforms on the wrapping element.

  REGENERATION: this file is hand-authored vector now. Do NOT re-run
    scripts/embed-emma-assets.mjs against this pose — it would overwrite the
    vector geometry with a fresh PNG embed (the script guards emma-idle).
-->`
  const wrapped = `<?xml version="1.0" encoding="UTF-8"?>
${headerComment}
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" preserveAspectRatio="xMidYMid meet">
  <g transform="scale(${SCALE})">
${inner}
  </g>
</svg>
`

  // 4. SVGO minify (standalone svgo). preset-default + explicit convertPathData
  //    / cleanupNumericValues at SVGO_FLOAT_PRECISION is the dominant byte lever
  //    (crushes ~364KB raw -> target band without touching colour regions).
  //    mergePaths collapses same-fill adjacent paths; removeComments strips the
  //    (re-attached below) header so we control it.
  const { data: minified } = svgoOptimize(wrapped, {
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: { overrides: { cleanupIds: false } },
      },
      {
        name: 'convertPathData',
        params: { floatPrecision: SVGO_FLOAT_PRECISION },
      },
      {
        name: 'cleanupNumericValues',
        params: { floatPrecision: SVGO_FLOAT_PRECISION },
      },
      'mergePaths',
      'removeComments',
    ],
  })

  // Re-attach the XML decl + header comment (optimizer may strip the comment).
  // Ensure no `--` double-hyphen survives inside the comment (XML-forbidden).
  let finalSvg = minified
  if (!finalSvg.startsWith('<?xml')) {
    finalSvg = `<?xml version="1.0" encoding="UTF-8"?>\n${finalSvg}`
  }
  if (!finalSvg.includes('TRUE VECTOR re-trace')) {
    // Optimizer dropped the comment; splice it back after the XML decl.
    finalSvg = finalSvg.replace(/(<\?xml[^>]*\?>\n?)/, `$1${headerComment}\n`)
  }
  // Guard: no `--` inside comments (em-dash U+2014 is the only safe long dash).
  finalSvg = finalSvg.replace(/(<!--[\s\S]*?-->)/g, (block) =>
    block.replace(/(?<!^<!)--(?!>)/g, '—'),
  )

  const outPath = join(assetsDir, `emma-${POSE}.svg`)
  writeFileSync(outPath, finalSvg)

  // --- report ---
  console.log(`\n=== emma-${POSE} trace report ===`)
  console.log(`output: ${outPath}`)
  console.log(`size:   ${Buffer.byteLength(finalSvg)} bytes`)
  const pathCount = (finalSvg.match(/<path/g) || []).length
  console.log(`paths:  ${pathCount}`)
  console.log(`crown speckle paths removed: ${speckRemoved}`)
  console.log(`fill snap map (traced -> bible):`)
  for (const [from, to] of map) {
    const flag = from === to ? '   (unchanged)' : ' -> SNAPPED'
    console.log(`  ${from} -> ${to}${flag}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
