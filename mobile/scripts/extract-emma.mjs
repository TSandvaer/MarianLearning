#!/usr/bin/env node
/**
 * Extract the embedded PNG from the web app's PNG-in-SVG Emma assets
 * (`public/assets/emma-*.svg`) and re-encode it as WebP for the native app.
 *
 * Run from the repo root:   node mobile/scripts/extract-emma.mjs
 *
 * - Reads only the FIRST `<image href="data:image/png;base64,...">` that sits
 *   outside an XML comment (the files carry long provenance comments).
 * - Uses `sharp` from the ROOT node_modules (the web app already depends on
 *   it), so the mobile package does not grow a native build dependency.
 * - Writes `mobile/assets/emma/<name>.webp` (lossy q=85, alpha kept).
 */
import { createRequire } from 'node:module'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const require = createRequire(join(repoRoot, 'package.json'))
const sharp = require('sharp')

/** Poses the spike needs. `logo` is the Splash medallion (upper band). */
const POSES = ['idle', 'celebration', 'puzzled-tilt', 'logo']

function extractPngBase64(svg) {
  const withoutComments = svg.replace(/<!--[\s\S]*?-->/g, '')
  const m = withoutComments.match(/href="data:image\/png;base64,([^"]+)"/)
  if (!m) throw new Error('no embedded PNG found')
  return m[1]
}

for (const pose of POSES) {
  const src = join(repoRoot, 'public', 'assets', `emma-${pose}.svg`)
  const out = join(here, '..', 'assets', 'emma', `${pose}.webp`)
  const png = Buffer.from(extractPngBase64(readFileSync(src, 'utf8')), 'base64')
  const meta = await sharp(png).metadata()
  const webp = await sharp(png)
    .webp({ quality: 85, alphaQuality: 90 })
    .toBuffer()
  writeFileSync(out, webp)
  console.log(
    `${pose}: svg ${statSync(src).size} B -> png ${png.length} B (${meta.width}x${meta.height}) -> webp ${webp.length} B`,
  )
}
