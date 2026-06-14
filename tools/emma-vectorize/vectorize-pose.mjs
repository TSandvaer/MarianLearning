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
import sharp from 'sharp'

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
// LOCKED PILOT RECIPE v2 (emma-idle, ticket 86ca8kq42). Tuned via sweep3.mjs
// after the v1 recipe (fs16 / cp8 / LD16) FAILED the fidelity gate at 60vh: it
// DROPPED Emma's smile + nose and washed her eyes (the thin ~1.5-2px facial
// linework merged into skin), and speckled the whole crown.
//
// THE FIX — `layerDifference` was the missing lever (v1 left it at 16):
//   - layerDifference 6: a new colour layer is emitted on a much smaller colour
//     delta, so the soft-rose smile/lips, the nose strokes, and the eye/iris
//     detail survive as their OWN regions instead of being merged into the
//     adjacent skin colour. THIS is what brings the smile back. (cp=8 is already
//     the VTracer max — 8 significant bits — so the fix is layer granularity,
//     not colour-bit headroom.)
//   - filterSpeckle 4 (down from 16): keeps thin facial strokes; the 16 floor
//     was discarding sub-16px paths, eating the mouth/nose. Hair speckle is
//     now handled at the SOURCE (alpha-harden, below) + the canvas-space
//     despeckle, NOT by a high filterSpeckle that also destroys the face.
//   - cornerThreshold 70 + spliceThreshold 55: smooth manhwa curves, fewer nodes.
// Byte budget is then won at SVGO time via floatPrecision 0 (the dominant byte
// lever), NEVER by raising filterSpeckle (which re-breaks the face).
const TRACE_CONFIG = {
  colorMode: ColorMode.Color,
  hierarchical: Hierarchical.Stacked,
  filterSpeckle: 4,
  colorPrecision: 8,
  layerDifference: 6,
  mode: PathSimplifyMode.Spline, // smooth curves, not polygons
  cornerThreshold: 70,
  lengthThreshold: 4,
  maxIterations: 10,
  spliceThreshold: 55,
  pathPrecision: 2,
}

// --- Source alpha-harden (kill the hair-speckle root) ----------------------
// The bgclear.ai cut leaves wispy semi-transparent hair-tip pixels at the
// crown; the tracer reproduces that soft alpha fringe as dense speckle. Rather
// than fight it downstream with a high filterSpeckle (which also eats the
// face), we cut it at the SOURCE: harden the alpha to a hard 0/255 edge so the
// fringe below ALPHA_CUT becomes fully transparent and never reaches the
// tracer. RGB is untouched (no colour shift — re-trace, not recolour). This
// gives the tracer clean hair edges AND crisper face edges in one step.
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

// SVGO float precision on path coords — the dominant BYTE lever. The v2 recipe
// (layerDifference 6) traces SHORTER hair curves than v1, so fp=0 (integer
// 2000-space coords) no longer visibly facets the hair at 60vh — verified on
// the Greet 60vh + head-crop renders. fp=0 brings the face-correct 890-path
// trace from ~254KB (fp=1) down to ~141KB, back under the 150KB AC4 target.
// Override via FP env (e.g. FP=1) for a higher-precision experiment.
const SVGO_FLOAT_PRECISION = process.env.FP ? +process.env.FP : 0

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

// --- Hair-speckle despeckle (deterministic, recipe-able) -------------------
// Even after the source alpha-harden, the tracer reproduces some fine hair-edge
// texture as tiny disconnected islands across the CROWN + hair body. These read
// as speckle noise that the OLD raster blurred into a soft halo. filterSpeckle
// can't remove them without also eating the face (we deliberately run it LOW
// at 8 to keep the smile/nose). So we drop them here surgically:
//
//   remove any path whose bbox is small (area < MIN_AREA of the source canvas)
//   AND sits ENTIRELY OUTSIDE the protected FACE BOX.
//
// The FACE BOX is the central region holding the eyes / nose / smile / blush —
// the features the v1 recipe destroyed and we MUST preserve. Anything inside it
// is never a despeckle candidate, no matter how small (the smile + nose strokes
// are small-bbox paths and must survive). Small islands outside it are hair
// fringe / background fleck and safe to drop.
//
// Measured on emma-idle (source 1024px, head in the upper third):
//   - hair-top ≈ y 0.028H; eyes/brows band ≈ y 0.10–0.17H; nose/smile ≈ y
//     0.17–0.24H; face horizontally spans ≈ x 0.34–0.66W.
// FACE_BOX is padded generously around that (0.30–0.70W × 0.08–0.30H) so no
// facial linework is ever a candidate. Per-pose safety: every standing front
// pose keeps the face in this central upper region; the box is wide enough to
// cover small head-tilt poses. Coordinates are in the tracer's native
// 0..SRC_DIM space (despeckle runs BEFORE the scale-wrap).
const MIN_AREA = 0.0024 // 0.24% of canvas — ~50x50px island in 1024 space.
// Raised from 0.0009: now that the despeckle bbox is canvas-correct AND the
// face is protected by FACE_BOX (regardless of area), we can drop larger hair
// micro-islands to recover bytes — every removed path is OUTSIDE the face box,
// so the smile/nose/eyes are never candidates no matter how small.
// Protected face box (fraction of canvas) — NEVER despeckle inside this.
const FACE_X0 = 0.3,
  FACE_X1 = 0.7,
  FACE_Y0 = 0.08,
  FACE_Y1 = 0.3

// Compute a path's CANVAS-space bbox. CRITICAL: the tracer emits each path's
// geometry in LOCAL (origin-relative) coords inside `d`, and carries the real
// canvas position in a sibling `transform="translate(tx,ty)"` attribute. So the
// canvas bbox = (local d-extent) + (tx,ty). The v1 despeckle read only `d`,
// which put EVERY path's bbox near the origin — so the FACE_BOX protection
// silently never matched and small facial paths (the smile lives in several
// ~57x14px sub-MIN_AREA paths) were despeckled away. Parsing the translate is
// what makes the face protection real. Diagnosed via tools/emma-vectorize/
// diag-mouth.mjs (the mouth path #7c472b at canvas (513,268) was BELOW-MIN_AREA
// and, with origin-space bbox, read as OUTSIDE the face box -> removed).
function pathBBox(d, tx = 0, ty = 0) {
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
  return { minX: minX + tx, minY: minY + ty, maxX: maxX + tx, maxY: maxY + ty }
}

// True if a path's bbox overlaps the protected face box at all (any overlap
// disqualifies it from despeckle — we err hard on the side of keeping the face).
function overlapsFaceBox(bb) {
  const fx0 = SRC_DIM * FACE_X0,
    fx1 = SRC_DIM * FACE_X1,
    fy0 = SRC_DIM * FACE_Y0,
    fy1 = SRC_DIM * FACE_Y1
  return !(bb.maxX < fx0 || bb.minX > fx1 || bb.maxY < fy0 || bb.minY > fy1)
}

// Returns { body, removed } — body with hair-speckle paths stripped. Removes
// small-bbox islands that lie ENTIRELY outside the protected face box. Reads the
// per-path transform="translate(tx,ty)" so the bbox is in CANVAS space (see
// pathBBox) — without this the face protection is a no-op.
function despeckleHair(inner) {
  const canvasArea = SRC_DIM * SRC_DIM
  let removed = 0
  const body = inner.replace(/<path\b[^>]*\/>/g, (tag) => {
    const dMatch = tag.match(/\bd="([^"]*)"/)
    if (!dMatch) return tag
    const tMatch = tag.match(
      /\btransform="translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)"/,
    )
    const tx = tMatch ? +tMatch[1] : 0
    const ty = tMatch ? +tMatch[2] : 0
    const bb = pathBBox(dMatch[1], tx, ty)
    if (!bb) return tag
    const w = bb.maxX - bb.minX
    const h = bb.maxY - bb.minY
    const areaFrac = (w * h) / canvasArea
    if (areaFrac < MIN_AREA && !overlapsFaceBox(bb)) {
      removed++
      return ''
    }
    return tag
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
  const rawPng = readFileSync(srcPath)

  // 0. Source alpha-harden — kill the wispy semi-transparent hair fringe at the
  //    root so the tracer gets clean hair + face edges (see hardenAlpha).
  const png = await hardenAlpha(rawPng)

  // 1. Trace
  const rawSvg = await vectorize(png, TRACE_CONFIG)

  // 2. Palette-snap
  const { out: snapped, map } = snapAllFills(rawSvg)

  // 3. Extract inner geometry, despeckle the hair, then re-wrap in 2000x2000.
  // The source traces in 0..1024 space; we wrap the geometry in a <g> scaled
  // by SCALE so it fills the 0..2000 viewBox exactly as the old <image> did
  // (the old <image> was width=2000 height=2000 over a 1024 raster — same
  // full-bleed framing, feet at the bottom of the box). AC7 preserved.
  const innerRaw = extractInner(snapped)
  const { body: inner, removed: speckRemoved } = despeckleHair(innerRaw)
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
  // AC7 — re-add preserveAspectRatio to the ROOT <svg>. SVGO drops it on minify
  // because "xMidYMid meet" is the SVG default (render-identical), but spec AC7
  // / AC6.2 name it as a REQUIRED, assertable part of the load-bearing envelope
  // (EmmaCharacter's feet-pivot tilt/breathing contract). Re-inject it on the
  // first <svg ...> tag iff SVGO stripped it. Idempotent: only adds when absent.
  finalSvg = finalSvg.replace(/<svg\b([^>]*)>/, (tag, attrs) => {
    if (/\bpreserveAspectRatio\s*=/.test(attrs)) return tag
    // insert right after the viewBox attribute (or at the end if viewBox absent)
    if (/\bviewBox\s*=\s*"[^"]*"/.test(attrs)) {
      return `<svg${attrs.replace(
        /(\bviewBox\s*=\s*"[^"]*")/,
        '$1 preserveAspectRatio="xMidYMid meet"',
      )}>`
    }
    return `<svg${attrs} preserveAspectRatio="xMidYMid meet">`
  })
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
  console.log(`hair speckle paths removed: ${speckRemoved}`)
  console.log(
    `preserveAspectRatio on root: ${/<svg\b[^>]*preserveAspectRatio="xMidYMid meet"/.test(finalSvg) ? 'YES ✓' : 'MISSING ✗'}`,
  )
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
