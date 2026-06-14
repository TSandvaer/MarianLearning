// One-shot embed helper for the 2026-05-14 Emma asset refresh.
//
// Re-embeds the bgclear.ai transparent re-cuts (poses, 1024x1024 RGBA)
// and the remove.bg "Emma Tutor" medallion (500x500 RGBA) into their
// public/assets/emma-*.svg wrappers.
//
// Not part of the build pipeline — run manually with `node scripts/embed-emma-assets.mjs`
// when the transparent/ source PNGs change. Kept in the tree as the
// reproducible record of how the SVGs were produced.
//
// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  REGRESSION TRAP — READ BEFORE RUNNING (ticket 86ca8kq42, vector       ║
// ║  re-trace pilot).                                                      ║
// ║                                                                       ║
// ║  emma-idle.svg is now HAND-AUTHORED TRUE VECTOR (re-traced via         ║
// ║  tools/emma-vectorize/), NOT a PNG-in-SVG embed. Re-running this       ║
// ║  script would OVERWRITE that vector geometry with a fresh PNG embed —  ║
// ║  a silent regression that un-does the re-trace.                        ║
// ║                                                                       ║
// ║  GUARD: 'idle' is intentionally OMITTED from the POSES loop below      ║
// ║  (see VECTOR_RETRACED + the runtime skip + assertion). Do NOT add it   ║
// ║  back. The remaining 7 poses are still PNG-in-SVG and re-embed         ║
// ║  normally until their own vector re-trace lands (Track A all-7 PR);    ║
// ║  as each pose is vectorised, add it to VECTOR_RETRACED below.          ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const transparentDir = join(
  root,
  'design/references/character-emma/transparent',
)
const assetsDir = join(root, 'public/assets')

const GENERATED = '2026-05-14'

/** Base64-encode a PNG into a data URI. */
function dataUri(pngPath) {
  return 'data:image/png;base64,' + readFileSync(pngPath).toString('base64')
}

// --- pose family -----------------------------------------------------------
// Drop-in re-embeds: same square framing, same character. The runtime
// viewBox stays 0 0 2000 2000 (the wrapper coordinate system EmmaCharacter
// renders against); the embedded <image> spans it fully. The new PNGs are
// 1024x1024 — a smaller raster than the prior background-baked embeds, so
// the resulting SVG files shrink.
//
// Poses that have been re-traced to TRUE VECTOR (tools/emma-vectorize/) MUST
// NOT be re-embedded here — doing so silently reverts the re-trace. They are
// listed in VECTOR_RETRACED and asserted out of POSES at runtime.
const VECTOR_RETRACED = ['idle'] // emma-idle.svg is hand-authored vector (86ca8kq42)

const POSES = [
  // 'idle' — OMITTED: now true-vector, see VECTOR_RETRACED + the regression
  //          trap banner at the top of this file. Do NOT re-add.
  'celebration',
  'cheering',
  'listening',
  'puzzled-tilt',
  'sleepy',
  'attentive-pointing',
  'waving',
]

// Belt-and-suspenders: if anyone re-adds a vector-retraced pose to POSES, fail
// loudly rather than silently overwriting its vector geometry.
for (const guarded of VECTOR_RETRACED) {
  if (POSES.includes(guarded)) {
    throw new Error(
      `[embed-emma-assets] REFUSING TO RUN: '${guarded}' is a hand-authored ` +
        `vector pose (VECTOR_RETRACED) but appears in POSES. Re-embedding it ` +
        `would overwrite the vector geometry. Remove it from POSES. See the ` +
        `regression-trap banner at the top of this file (ticket 86ca8kq42).`,
    )
  }
}

function poseSvg(pose) {
  const uri = dataUri(join(transparentDir, `emma-${pose}.png`))
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  emma-${pose}.svg
  Emma character pose — "${pose}".

  Source: design/references/character-emma/transparent/emma-${pose}.png
    - bgclear.ai re-cut, 1024x1024 RGBA, transparent.
    - PNG-in-SVG technique, matching the rest of the emma-*.svg family.
      Vector re-trace remains a shared polish-backlog item — see
      .claude/docs/emma-character-and-animation.md section 1.
    - Generated ${GENERATED} (full Emma-family bgclear.ai re-cut).

  ViewBox 0 0 2000 2000 is the wrapper coordinate system EmmaCharacter
  renders against; the embedded <image> spans it fully. Drop-in
  replacement — same square framing, same character, background removed
  properly now.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" preserveAspectRatio="xMidYMid meet">
  <image href="${uri}" width="2000" height="2000"/>
</svg>
`
}

// --- emma-logo.svg medallion ----------------------------------------------
// Two-band composition: square medallion (upper) + "Emma Tutor" SVG
// wordmark + heart flourish (lower). Replaces the PR #218 head-and-
// shoulders portrait.
function logoSvg() {
  const uri = dataUri(join(transparentDir, 'emma-splash-base.png'))
  // Medallion is square (500x500). Upper band 0..256 holds the medallion
  // centred; lower band 256..336 holds the wordmark + heart. viewBox is
  // 256 wide x 336 tall — taller-per-width than the legacy 256x320 portrait
  // band, so Splash.tsx sizing is re-checked (see PR body / Self-Test Report).
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  emma-logo.svg
  Splash-screen "Emma Tutor" medallion logo + wordmark.

  Supersedes PR #218's head-and-shoulders portrait logo (option C:
  medallion + wordmark was chosen over the portrait approach).

  Pipeline:
    - Medallion source: design/references/character-emma/transparent/emma-splash-base.png
      500x500 RGBA. The 2048x2048 MJ original (with background) lives at
      design/references/character-emma/emma-splash-base.png.
    - Background removed via remove.bg — bgclear.ai mattes away the thin
      medallion ring, so remove.bg is the correct tool for this ringed
      asset (see feedback_mj_workflow_explicit_removebg memory).
    - PNG-in-SVG technique, matching the rest of the emma-*.svg family.
    - Generated ${GENERATED}.

  ViewBox: 0 0 256 336.
    - Upper band 0..256: square "Emma Tutor" medallion via <image> tag.
    - Lower band 256..336: "Emma Tutor" wordmark + heart flourish. The
      wordmark stays SVG text primitives — MJ cannot render clean text.

  Splash.tsx consumes this at w-60 max-w-[60vw] with a spring scale-in.
  The viewBox aspect ratio changed from the legacy 256x320 portrait band,
  so Splash.tsx layout was re-verified on the dev server — see the PR's
  Self-Test Report.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 336" role="img" aria-label="Emma Tutor">
  <title>Emma Tutor</title>

  <!-- "Emma Tutor" medallion — upper band (0..256). Square embedded transparent PNG. -->
  <image href="${uri}"
         x="0" y="0" width="256" height="256"
         preserveAspectRatio="xMidYMid meet"/>

  <!-- Wordmark "Emma Tutor" + heart flourish — lower band (256..336). SVG primitives. -->
  <g transform="translate(128 296)" text-anchor="middle">
    <text x="0" y="0"
      font-family="-apple-system, &apos;SF Pro Rounded&apos;, &apos;SF Pro&apos;, &apos;Segoe UI&apos;, system-ui, sans-serif"
      font-weight="700"
      font-size="34"
      letter-spacing="1"
      fill="#3D2B3D">Emma Tutor</text>
    <!-- Heart flourish below the wordmark -->
    <path d="M 0 14
      C -2.6 10, -8.5 10, -8.5 15.5
      C -8.5 20, -4.2 22.5, 0 25
      C 4.2 22.5, 8.5 20, 8.5 15.5
      C 8.5 10, 2.6 10, 0 14 Z"
      fill="#F48FB1" stroke="#3D2B3D" stroke-width="1.4" stroke-linejoin="round"/>
  </g>
</svg>
`
}

const sizes = []
for (const pose of POSES) {
  const target = join(assetsDir, `emma-${pose}.svg`)
  const before = statSync(target).size
  writeFileSync(target, poseSvg(pose))
  const after = statSync(target).size
  sizes.push({ file: `emma-${pose}.svg`, before, after })
}
{
  const target = join(assetsDir, 'emma-logo.svg')
  const before = statSync(target).size
  writeFileSync(target, logoSvg())
  const after = statSync(target).size
  sizes.push({ file: 'emma-logo.svg', before, after })
}

console.log('file\tbefore\tafter\tdelta')
for (const s of sizes) {
  console.log(
    `${s.file}\t${s.before}\t${s.after}\t${s.after - s.before > 0 ? '+' : ''}${s.after - s.before}`,
  )
}
