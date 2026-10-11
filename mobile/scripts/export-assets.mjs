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
 * - `assets/emma/idle-shadow.webp` the Hub's baked shadow under idle Emma
 * - `assets/pictures/<key>.webp`   every `public/assets/pictures/picture-*.svg`
 * - `assets/scenes/<id>.webp`      every `public/assets/scenes/scene-*.svg`
 * - `assets/path/*.webp`           `public/assets/path/*.webp`, copied as-is
 * - `assets/path/*-256-muted.webp` the Hub's muted "next" stickers
 * - `assets/path/<step>-256-locked.webp` the map's frosted locked stops
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

// The Hub's baked shadow for idle Emma (design/native/hub-native.md § 4).
// iOS cannot filter an image, so the web's two `drop-shadow`s on her
// (hubClay.css `.hub-emma-img`, 1u = 1024 / 520 px on this canvas; CSS
// blur radius r = Gaussian σ r / 2) are drawn from the idle art's alpha on
// the same canvas: a warm glow (σ 18 px) under a brown contact shadow
// (+20 px, σ 10 px). EmmaStage draws it under the pose image on the Hub.
await emmaIdleShadow(
  join(webAssets, 'emma-idle.svg'),
  join(out, 'emma', 'idle-shadow.webp'),
)

async function emmaIdleShadow(svgPath, outPath) {
  const { data, info } = await sharp(extractPng(svgPath))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const k = width / 1024
  const alpha = Buffer.alloc(width * height)
  for (let i = 0; i < width * height; i++) alpha[i] = data[i * channels + 3]

  async function shadowAlpha(dy, sigma) {
    const shifted = Buffer.alloc(width * height)
    for (let y = 0; y < height; y++) {
      const from = y - Math.round(dy * k)
      if (from < 0 || from >= height) continue
      alpha.copy(shifted, y * width, from * width, (from + 1) * width)
    }
    const blurred = await sharp(shifted, {
      raw: { width, height, channels: 1 },
    })
      .blur(sigma * k)
      .extractChannel(0)
      .raw()
      .toBuffer({ resolveWithObject: true })
    if (blurred.info.channels !== 1)
      throw new Error('shadow: expected 1 channel')
    return blurred.data
  }
  const contact = await shadowAlpha(20, 10) // rgba(90, 50, 20, .28)
  const glow = await shadowAlpha(0, 18) // rgba(255, 210, 140, .35)
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const a1 = (contact[i] / 255) * 0.28
    const a2 = (glow[i] / 255) * 0.35 * (1 - a1)
    const a = a1 + a2
    if (a === 0) continue
    rgba[i * 4] = Math.round((90 * a1 + 255 * a2) / a)
    rgba[i * 4 + 1] = Math.round((50 * a1 + 210 * a2) / a)
    rgba[i * 4 + 2] = Math.round((20 * a1 + 140 * a2) / a)
    rgba[i * 4 + 3] = Math.round(a * 255)
  }
  const webp = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .webp(WEBP)
    .toBuffer()
  writeFileSync(outPath, webp)
  totalOut += webp.length
  // Native-only (no web URL): keyed under /native/.
  registry.push(['/native/emma/idle-shadow.webp', outPath])
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

// The Hub's "next" sticker is muted on the web with `filter: saturate(.55)
// brightness(1.04)`, which iOS cannot draw (hub-native.md § 6): bake a
// `-muted` copy of every 256 px path image.
for (const name of sorted(join(webAssets, 'path'), /-256\.webp$/)) {
  const muted = name.replace(/\.webp$/, '-muted.webp')
  const outPath = join(out, 'path', muted)
  const webp = await sharp(join(webAssets, 'path', name))
    .modulate({ saturation: 0.55, brightness: 1.04 })
    .webp(WEBP)
    .toBuffer()
  writeFileSync(outPath, webp)
  totalOut += webp.length
  registry.push([`/native/path/${muted}`, outPath])
}

// The map's locked stop is frosted on the web with `filter: saturate(.2)
// brightness(1.12) opacity(.62)` (map-native.md § 5): bake the saturate +
// brightness into a `-locked` copy of each step's 256 px sticker (the 24
// steps: not the `ui-*` / `land-*` art). The opacity and shadow are drawn.
for (const name of sorted(join(webAssets, 'path'), /-256\.webp$/)) {
  if (/^(ui|land)-/.test(name)) continue
  const locked = name.replace(/\.webp$/, '-locked.webp')
  const outPath = join(out, 'path', locked)
  const webp = await sharp(join(webAssets, 'path', name))
    .modulate({ saturation: 0.2, brightness: 1.12 })
    .webp(WEBP)
    .toBuffer()
  writeFileSync(outPath, webp)
  totalOut += webp.length
  registry.push([`/native/path/${locked}`, outPath])
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
 * image module; native-only bakes of web CSS filters are keyed under
 * \`/native/\`. Look assets up through \`./index.ts\`, not directly.
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
