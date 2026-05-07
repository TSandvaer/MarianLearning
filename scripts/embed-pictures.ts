#!/usr/bin/env tsx
/**
 * embed-pictures — wraps transparent PNGs into SVG delivery wrappers
 * for the word-song picture pack, mirroring the Emma-character workflow
 * (PNG-in-SVG technique; see .claude/docs/emma-character-and-animation.md §2).
 *
 * Workflow:
 *  1. Take MJ PNG(s) from design/references/picture-pack/picture-{word}.png
 *  2. Run each through remove.bg (or similar) → transparent PNG
 *  3. Save transparents to a staging dir (e.g. .../picture-pack/transparent/)
 *  4. Run this script — base64-encodes each PNG into a `<svg><image>` wrapper
 *     and writes picture-{word}.svg to the chosen output dir.
 *
 * Usage:
 *   yarn embed-pictures <input-dir> [output-dir]
 *
 * Defaults output-dir to input-dir if omitted. Filenames retain their
 * basename: `picture-cat.png` -> `picture-cat.svg`. Inputs without a
 * `picture-` prefix are auto-prefixed to match the pack convention.
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  existsSync,
} from 'fs'
import { join, basename, extname } from 'path'

const args = process.argv.slice(2)
if (args.length < 1) {
  console.error('Usage: yarn embed-pictures <input-dir> [output-dir]')
  console.error(
    '  input-dir : folder of transparent PNGs (e.g. design/references/picture-pack/transparent)',
  )
  console.error(
    '  output-dir: optional; defaults to input-dir. Use public/assets/pictures to ship directly.',
  )
  process.exit(1)
}

const inputDir = args[0]
const outputDir = args[1] ?? inputDir

if (!existsSync(inputDir)) {
  console.error(`Input dir does not exist: ${inputDir}`)
  process.exit(1)
}

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true })
}

const files = readdirSync(inputDir).filter((f) =>
  f.toLowerCase().endsWith('.png'),
)

if (files.length === 0) {
  console.error(`No PNG files found in ${inputDir}`)
  process.exit(1)
}

console.log(`Found ${files.length} PNG files in ${inputDir}`)
console.log(`Writing SVGs to ${outputDir}\n`)

let totalIn = 0
let totalOut = 0

for (const file of files) {
  const inPath = join(inputDir, file)
  const png = readFileSync(inPath)
  const base64 = png.toString('base64')
  const baseName = basename(file, extname(file))
  const outBase = baseName.startsWith('picture-')
    ? baseName
    : `picture-${baseName}`
  const outPath = join(outputDir, `${outBase}.svg`)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
  <image href="data:image/png;base64,${base64}" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid meet" />
</svg>
`

  writeFileSync(outPath, svg)
  totalIn += png.length
  totalOut += svg.length
  const inKB = (png.length / 1024).toFixed(1)
  const outKB = (svg.length / 1024).toFixed(1)
  console.log(
    `  ${file.padEnd(30)} ${inKB.padStart(7)} KB  ->  ${outBase}.svg  (${outKB} KB)`,
  )
}

console.log(`\nDone. ${files.length} files written.`)
console.log(`Total input  : ${(totalIn / 1024 / 1024).toFixed(2)} MB`)
console.log(
  `Total output : ${(totalOut / 1024 / 1024).toFixed(2)} MB (~33% larger due to base64 overhead)`,
)
