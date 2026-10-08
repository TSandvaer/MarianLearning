#!/usr/bin/env node
/**
 * Export the web app's image assets for the native app, and generate the
 * native asset registry.
 *
 * Run from anywhere, after the ROOT `yarn install` (it uses the web app's
 * `sharp` and `prettier`, so `mobile/` grows no native build dependency):
 *
 *   npm run export-assets          (from mobile/)
 *
 * What it writes
 * --------------
 * - `assets/emma/<pose>.webp`      every `public/assets/emma-*.svg`
 * - `assets/pictures/<key>.webp`   every `public/assets/pictures/picture-*.svg`
 * - `assets/scenes/<id>.webp`      every `public/assets/scenes/scene-*.svg`
 * - `assets/path/*.webp`           `public/assets/path/*.webp`, copied as-is
 * - `assets/app/icon.png`          the PWA icon at 1024 px (iOS app icon)
 * - `assets/app/splash-logo.png`   the Emma logo PNG (native splash screen)
 * - `src/assets/registry.ts`       web URL path → `require()`d native module
 *
 * The Emma, picture and scene SVGs are PNG-in-SVG wrappers: each holds one
 * `<image href="data:image/png;base64,...">` (outside the provenance
 * comments). The PNG is re-encoded as WebP (lossy q=85, alpha q=90).
 *
 * The registry is keyed by the same URL path the web renders (`/assets/
 * emma-idle.svg`, `pathArtSrc(id, size)`, `sceneSrc(id)`), so native code
 * resolves an asset from the path core already computes. Metro needs a
 * static `require()` per file, hence the generated table.
 */
import { createRequire } from 'node:module'
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const mobileRoot = resolve(here, '..')
const repoRoot = resolve(mobileRoot, '..')
const webAssets = join(repoRoot, 'public', 'assets')
const out = join(mobileRoot, 'assets')

const requireFromRoot = createRequire(join(repoRoot, 'package.json'))
const sharp = requireFromRoot('sharp')
const prettier = requireFromRoot('prettier')

const WEBP = { quality: 85, alphaQuality: 90 }

/** The embedded PNG of a PNG-in-SVG wrapper, ignoring XML comments. */
function extractPng(svgPath) {
  const svg = readFileSync(svgPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  const m = svg.match(/href="data:image\/png;base64,([^"]+)"/)
  if (!m) throw new Error(`no embedded PNG in ${svgPath}`)
  return Buffer.from(m[1], 'base64')
}

function freshDir(dir) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
}

function sorted(dir, pattern) {
  return readdirSync(dir)
    .filter((name) => pattern.test(name))
    .sort()
}

/** web URL path → path relative to `mobile/` (for the registry). */
const registry = []
let totalIn = 0
let totalOut = 0

async function svgToWebp(svgPath, outPath, webPath) {
  const webp = await sharp(extractPng(svgPath)).webp(WEBP).toBuffer()
  writeFileSync(outPath, webp)
  totalIn += statSync(svgPath).size
  totalOut += webp.length
  registry.push([webPath, outPath])
}

// Emma: every pose plus the logo and the th-mouth overlay.
freshDir(join(out, 'emma'))
for (const name of sorted(webAssets, /^emma-.+\.svg$/)) {
  const id = name.slice('emma-'.length, -'.svg'.length)
  await svgToWebp(
    join(webAssets, name),
    join(out, 'emma', `${id}.webp`),
    `/assets/${name}`,
  )
}

// Word Song picture pack.
freshDir(join(out, 'pictures'))
for (const name of sorted(join(webAssets, 'pictures'), /^picture-.+\.svg$/)) {
  const key = name.slice('picture-'.length, -'.svg'.length)
  await svgToWebp(
    join(webAssets, 'pictures', name),
    join(out, 'pictures', `${key}.webp`),
    `/assets/pictures/${name}`,
  )
}

// Simple-sentences scenes.
freshDir(join(out, 'scenes'))
for (const name of sorted(join(webAssets, 'scenes'), /^scene-.+\.svg$/)) {
  const id = name.slice('scene-'.length, -'.svg'.length)
  await svgToWebp(
    join(webAssets, 'scenes', name),
    join(out, 'scenes', `${id}.webp`),
    `/assets/scenes/${name}`,
  )
}

// Emma's Path clay art: already WebP at 256 and 512 px.
freshDir(join(out, 'path'))
for (const name of sorted(join(webAssets, 'path'), /\.webp$/)) {
  const outPath = join(out, 'path', name)
  copyFileSync(join(webAssets, 'path', name), outPath)
  registry.push([`/assets/path/${name}`, outPath])
}

// App icon + native splash image.
freshDir(join(out, 'app'))
await sharp(join(repoRoot, 'public', 'icons', 'icon-512.png'))
  .resize(1024, 1024)
  .png()
  .toFile(join(out, 'app', 'icon.png'))
await sharp(extractPng(join(webAssets, 'emma-logo.svg')))
  .png()
  .toFile(join(out, 'app', 'splash-logo.png'))

// Registry.
const registryPath = join(mobileRoot, 'src', 'assets', 'registry.ts')
const entries = registry
  .map(([webPath, outPath]) => {
    const rel = `../../${outPath.slice(mobileRoot.length + 1)}`
    return `  ${JSON.stringify(webPath)}: require(${JSON.stringify(rel)}),`
  })
  .join('\n')
const source = `/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * GENERATED by \`mobile/scripts/export-assets.mjs\`. Do not edit by hand:
 * re-run \`npm run export-assets\` after the web assets change.
 *
 * Web URL path (what core and the web app render) → the bundled native
 * image module. Look assets up through \`./index.ts\`, not directly.
 */
export const WEB_ASSET_MODULES: Readonly<Record<string, number>> = {
${entries}
}
`
const config = await prettier.resolveConfig(registryPath)
mkdirSync(dirname(registryPath), { recursive: true })
writeFileSync(
  registryPath,
  await prettier.format(source, { ...config, parser: 'typescript' }),
)

const kb = (n) => `${Math.round(n / 1024)} KB`
console.log(
  `${registry.length} registry entries; PNG-in-SVG ${kb(totalIn)} -> WebP ${kb(totalOut)}`,
)
