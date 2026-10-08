#!/usr/bin/env tsx
/**
 * build-path-art — converts the Emma's Path clay icons (Redesign R1,
 * ClickUp 123jpnbc68y) from full-size transparent PNG sources into the
 * optimised WebP copies the app ships under public/assets/path/.
 *
 * The ~1254 px PNG sources are NOT in git (design/emmas-path/redesign/assets/
 * in the main checkout only); this script is the reproducible bridge.
 * Each manifest id's `{id}.png` becomes `{id}-256.webp` and `{id}-512.webp`
 * (`PATH_ART_SIZES` in src/lib/emmasPath/pathArt.ts). Alpha is kept at full
 * quality (residue below ALPHA_FLOOR is cleared to 0), and every output is decoded again to check its four corner
 * pixels are fully transparent — the run fails if one is not.
 *
 * Usage:
 *   yarn path-art <source-dir>
 *   e.g. yarn path-art ~/DEV/MarianLearning/design/emmas-path/redesign/assets
 *
 * sharp is a devDependency only; nothing here enters the app bundle.
 */

import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import {
  PATH_ART_DIR,
  PATH_ART_IDS,
  PATH_ART_SIZES,
} from '@marian/core/emmasPath/pathArt'

const QUALITY = 80
/** Alpha below this (of 255) is invisible residue and becomes 0. */
const ALPHA_FLOOR = 4

const sourceDir = process.argv[2]
if (!sourceDir || !existsSync(sourceDir)) {
  console.error('Usage: yarn path-art <source-dir of transparent PNGs>')
  process.exit(1)
}

const outDir = join('public', PATH_ART_DIR)
mkdirSync(outDir, { recursive: true })

// Driven by the manifest, so stray files in the source dir (e.g. the uncut
// ui-arch-closed-white.png) are ignored and a missing source fails loudly.
const missing = PATH_ART_IDS.filter(
  (id) => !existsSync(join(sourceDir, `${id}.png`)),
)
if (missing.length > 0) {
  console.error(`Missing source PNGs: ${missing.join(', ')}`)
  process.exit(1)
}

async function cornersTransparent(file: string): Promise<boolean> {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ]
  return corners.every(
    ([x, y]) => data[(y * width + x) * channels + channels - 1] === 0,
  )
}

const totals: Record<number, number> = {}
for (const id of PATH_ART_IDS) {
  for (const size of PATH_ART_SIZES) {
    const outPath = join(outDir, `${id}-${size}.webp`)
    const { data, info: raw } = await sharp(join(sourceDir, `${id}.png`))
      .resize(size, size, { fit: 'contain', background: '#0000' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    // Clear invisible background-removal residue (two sources carry
    // alpha 1/255 in a corner) so transparent areas are exactly 0.
    for (let i = raw.channels - 1; i < data.length; i += raw.channels) {
      if (data[i] < ALPHA_FLOOR) data[i] = 0
    }
    const info = await sharp(data, { raw })
      .webp({ quality: QUALITY, alphaQuality: 100, effort: 6 })
      .toFile(outPath)
    if (!(await cornersTransparent(outPath))) {
      console.error(`Corner pixel not transparent: ${outPath}`)
      process.exit(1)
    }
    totals[size] = (totals[size] ?? 0) + info.size
    console.log(`${outPath}  ${info.size} B`)
  }
}

const all = Object.values(totals).reduce((a, b) => a + b, 0)
for (const size of PATH_ART_SIZES) {
  console.log(`${size}px: ${PATH_ART_IDS.length} files, ${totals[size]} B`)
}
console.log(
  `total: ${PATH_ART_IDS.length * PATH_ART_SIZES.length} files, ${all} B`,
)
