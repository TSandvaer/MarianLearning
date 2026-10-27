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
 * - `assets/pictures/<key>.webp`   every `public/assets/pictures/picture-*.svg`,
 *                                  and the 4 novel-probe pictures the web
 *                                  draws inline (`renderProbePictures.ts`),
 *                                  unless a pack picture exists for them
 * - `assets/avatars/avatar-<id>.webp` kept as they are: the learner avatars
 *                                  (learner-profiles.md § 9), which the pack
 *                                  generator's --pick writes here; only
 *                                  registered (`/native/avatars/...`)
 * - `src/audio/blendMarks.generated.ts` the sound segments of every baked
 *                                  Word Song blend clip (needs `ffmpeg`)
 * - `assets/scenes/<id>.webp`      every `public/assets/scenes/scene-*.svg`
 * - `assets/scenes/story-<id>.webp` kept as they are: the little stories'
 *                                  scenes (content wave 3 § 4.2, § 6), which
 *                                  the scene generator writes here; only
 *                                  registered (`/native/scenes/...`)
 * - `src/audio/storyMarks.generated.ts` the sentence segments of every
 *                                  baked little-story clip (needs `ffmpeg`)
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
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
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

// The four novel-probe pictures (nap, rat, map, tap): the web draws them
// as inline SVG (`wordPictures.tsx`), so render that markup through the
// root `tsx` and bake it at 500 px like the pack (word-song-native.md § 7).
// Native-only (no web URL): keyed under /native/pictures/.
// The inline bake is only a fallback: once a real picture is picked for a
// probe word (scripts/generatePackPictures.ts --pick, then embed-pictures),
// its `picture-<key>.svg` was exported above under the same `<key>.webp`.
// Skip the bake then, or it would overwrite that file with the old picture.
{
  const markup = JSON.parse(
    execFileSync(
      join(repoRoot, 'node_modules', '.bin', 'tsx'),
      [
        '--tsconfig',
        join(repoRoot, 'tsconfig.app.json'),
        join(here, 'renderProbePictures.ts'),
      ],
      { cwd: repoRoot, encoding: 'utf8' },
    ),
  )
  for (const [key, svg] of Object.entries(markup)) {
    if (existsSync(join(webAssets, 'pictures', `picture-${key}.svg`))) continue
    const sized = svg
      .replace(/ style="[^"]*"/, '')
      .replace('<svg ', '<svg width="500" height="500" ')
    const webp = await sharp(Buffer.from(sized)).webp(WEBP).toBuffer()
    const outPath = join(out, 'pictures', `${key}.webp`)
    writeFileSync(outPath, webp)
    totalOut += webp.length
    registry.push([`/native/pictures/${key}`, outPath])
  }
}

// The learner avatars (design/native/learner-profiles.md § 9): written here
// directly by `generatePackPictures.ts --pick` (design/native/
// avatar-manifest.json), not exported from the web, which stays
// single-learner (§ 4.4). Registered as they are (native only: keyed under
// /native/avatars/).
mkdirSync(join(out, 'avatars'), { recursive: true })
for (const name of sorted(join(out, 'avatars'), /^avatar-.+\.webp$/)) {
  registry.push([`/native/avatars/${name}`, join(out, 'avatars', name)])
}

// Simple-sentences scenes. The little stories' scenes (`story-<id>.webp`,
// content wave 3 § 4.2, § 6) are written here directly by
// `generatePackPictures.ts --scenes --pick`, not exported from the web, so
// the clear-out keeps them and they are registered as they are (native
// only: keyed under /native/scenes/).
mkdirSync(join(out, 'scenes'), { recursive: true })
for (const name of readdirSync(join(out, 'scenes'))) {
  if (!/^story-.+\.webp$/.test(name)) {
    rmSync(join(out, 'scenes', name), { recursive: true, force: true })
  }
}
for (const name of sorted(join(out, 'scenes'), /^story-.+\.webp$/)) {
  registry.push([`/native/scenes/${name}`, join(out, 'scenes', name)])
}
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

// Word Song blend marks (word-song-native.md § 5): the four sound
// segments (3 graphemes, then the whole word) of every baked blend clip,
// measured with ffmpeg `silencedetect` at -35 dB. The first onset is the
// end of the leading silence (>= 30 ms); later boundaries are silences of
// >= 300 ms. Exactly 4 segments, or no entry. Keyed by the utterance text
// (the server reuses canon audio by text), with the MP3's byte length (the
// app's runtime check: it uses a mark only on a clip of that length) and a
// content hash (the test's drift check: the clips are CBR, so many share a
// length, and a re-bake can keep one; only the hash is sure to change).
const marks = new Map()
{
  const canonRoot = join(repoRoot, 'public', 'canon', 'word-song')
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.json')) files.push(p)
    }
  }
  walk(canonRoot)
  const tmp = join(tmpdir(), `blend-${process.pid}.mp3`)
  for (const file of files) {
    const json = JSON.parse(readFileSync(file, 'utf8'))
    for (const u of json.utterances ?? []) {
      if (!/^word\.p\d+\.blend$/.test(u.id) || !u.audio?.base64) continue
      const mp3 = Buffer.from(u.audio.base64, 'base64')
      const sha256 = clipHash(mp3)
      const prev = marks.get(u.text)
      if (prev && prev.sha256 !== sha256) {
        throw new Error(`blend "${u.text}" has two different clips`)
      }
      if (prev) continue
      writeFileSync(tmp, mp3)
      const segments = blendSegments(tmp)
      if (segments === null) {
        console.warn(`blend "${u.text}" (${file}): not 4 segments, skipped`)
        continue
      }
      marks.set(u.text, { bytes: mp3.length, sha256, segments })
    }
  }
  rmSync(tmp, { force: true })
  // The digraph critters' sound-source blends (Dave 2026-10-27, digraph
  // critters (A)), rendered as guidance lines: the text is the file's word
  // with one sound per digraph (`guide-play-critters-blend-ship.mp3` is
  // "sh - i - p ... ship"), as core's `CRITTER_DIGRAPH_BLENDS`. Their
  // boundaries are silences of >= 250 ms, not 300: Lily left 297 and 271 ms
  // between thin's sounds, and the words' own stop gaps are under 170 ms.
  // A letter's 80 ms tap tail still ends in silence.
  const pathDir = join(webAssets, 'audio', 'path')
  for (const name of sorted(
    pathDir,
    /^guide-play-critters-blend-[a-z]+\.mp3$/,
  )) {
    const word = name.slice('guide-play-critters-blend-'.length, -'.mp3'.length)
    const text = `${word.match(/sh|ch|th|ng|[a-z]/g).join(' - ')} ... ${word}`
    if (marks.has(text))
      throw new Error(`blend "${text}" has two different clips`)
    const mp3 = readFileSync(join(pathDir, name))
    const segments = clipSegments(join(pathDir, name), 0.25, 4)
    if (segments === null) {
      console.warn(`blend "${text}" (${name}): not 4 segments, skipped`)
      continue
    }
    marks.set(text, { bytes: mp3.length, sha256: clipHash(mp3), segments })
  }
}

/** A clip's content hash: the first 16 hex digits of its SHA-256. */
function clipHash(mp3) {
  return createHash('sha256').update(mp3).digest('hex').slice(0, 16)
}

function blendSegments(path) {
  return clipSegments(path, 0.3, 4)
}

/**
 * The sound segments of a clip: the first onset is the end of the leading
 * silence (>= 30 ms); later boundaries are silences of >= `minSilence` s.
 * Exactly `count` segments, or null.
 */
function clipSegments(path, minSilence, count) {
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
    { encoding: 'utf8' },
  )
  const duration = Number(probe.stdout.trim())
  const run = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-i',
      path,
      '-af',
      'silencedetect=noise=-35dB:d=0.03',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  )
  if (run.status !== 0 || !(duration > 0))
    throw new Error(`ffmpeg failed on ${path}`)
  const silences = []
  for (const line of run.stderr.split('\n')) {
    const start = line.match(/silence_start: (-?[\d.]+)/)
    if (start)
      silences.push({ start: Math.max(0, Number(start[1])), end: duration })
    const end = line.match(/silence_end: ([\d.]+)/)
    if (end && silences.length > 0) silences.at(-1).end = Number(end[1])
  }
  let on = 0
  let rest = silences
  if (rest.length > 0 && rest[0].start <= 0.001) {
    on = rest[0].end
    rest = rest.slice(1)
  }
  const trailing = rest.at(-1)?.end >= duration - 0.005 ? rest.at(-1) : null
  const segments = []
  for (const s of rest) {
    if (s === trailing) break
    if (s.end - s.start < minSilence) continue
    segments.push([on, s.start])
    on = s.end
  }
  segments.push([on, trailing ? trailing.start : duration])
  if (segments.length !== count) return null
  return segments.map(([a, b]) => [Math.round(a * 1000), Math.round(b * 1000)])
}

{
  const marksPath = join(mobileRoot, 'src', 'audio', 'blendMarks.generated.ts')
  const body = [...marks.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(
      ([text, m]) =>
        `  ${JSON.stringify(text)}: { bytes: ${m.bytes}, sha256: ${JSON.stringify(m.sha256)}, segments: ${JSON.stringify(m.segments)} },`,
    )
    .join('\n')
  const source = `/**
 * GENERATED by \`mobile/scripts/export-assets.mjs\`. Do not edit by hand:
 * re-run \`npm run export-assets\` after a canon re-bake.
 *
 * Every baked Word Song blend clip (\`word.p*.blend\` in
 * \`public/canon/word-song/**\`) and the digraph critters' sound-source
 * blends (\`guide-play-critters-blend-*.mp3\`), keyed by its text: the
 * MP3's byte length (the app's check), its content hash (the first 16 hex
 * digits of its SHA-256: \`blendMarks.test.ts\` fails when a re-bake changes
 * a clip) and its four sound segments \`[onMs, offMs]\` (3 graphemes, then
 * the whole word), from ffmpeg \`silencedetect\` at -35 dB
 * (design/native/word-song-native.md § 5). Read through \`./blendMarks.ts\`.
 */
export const BLEND_MARKS: Readonly<
  Record<
    string,
    {
      bytes: number
      sha256: string
      segments: readonly (readonly [number, number])[]
    }
  >
> = {
${body}
}
`
  const config = await prettier.resolveConfig(marksPath)
  writeFileSync(
    marksPath,
    await prettier.format(source, { ...config, parser: 'typescript' }),
  )
  console.log(`${marks.size} blend marks`)
}

// Little-story marks (content wave 3 § 4.5): the sentence segments of
// every baked story clip (`word.p*.hint` of a `*-stories` canon file),
// measured with ffmpeg `silencedetect` at -35 dB, silences >= 250 ms. One
// segment per sentence, or no entry (the app then splits the whole clip by
// characters). Keyed by the story text, with the byte length (the app's
// check) and the content hash (the drift check), as the blend marks.
const storyMarks = new Map()
{
  const canonRoot = join(repoRoot, 'public', 'canon', 'word-song', 'level-1')
  const tmp = join(tmpdir(), `story-${process.pid}.mp3`)
  for (const name of sorted(canonRoot, /-stories\.json$/)) {
    const json = JSON.parse(readFileSync(join(canonRoot, name), 'utf8'))
    for (const u of json.utterances ?? []) {
      if (!/^word\.[pw]\d+\.hint$/.test(u.id) || !u.audio?.base64) continue
      const mp3 = Buffer.from(u.audio.base64, 'base64')
      const sha256 = clipHash(mp3)
      const prev = storyMarks.get(u.text)
      if (prev && prev.sha256 !== sha256) {
        throw new Error(`story "${u.text}" has two different clips`)
      }
      if (prev) continue
      writeFileSync(tmp, mp3)
      const sentences = (u.text.match(/[^.!?]+[.!?]/g) ?? [u.text]).length
      const segments = clipSegments(tmp, 0.25, sentences)
      if (segments === null) {
        console.warn(
          `story "${u.text}" (${name}): not ${sentences} segments, skipped`,
        )
        continue
      }
      storyMarks.set(u.text, { bytes: mp3.length, sha256, segments })
    }
  }
  rmSync(tmp, { force: true })
  const marksPath = join(mobileRoot, 'src', 'audio', 'storyMarks.generated.ts')
  const body = [...storyMarks.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(
      ([text, m]) =>
        `  ${JSON.stringify(text)}: { bytes: ${m.bytes}, sha256: ${JSON.stringify(m.sha256)}, segments: ${JSON.stringify(m.segments)} },`,
    )
    .join('\n')
  const source = `/**
 * GENERATED by \`mobile/scripts/export-assets.mjs\`. Do not edit by hand:
 * re-run \`npm run export-assets\` after a canon render.
 *
 * Every baked little-story clip (\`word.p*.hint\` in
 * \`public/canon/word-song/level-1/*-stories.json\`), keyed by its text: the
 * MP3's byte length (the app's check), its content hash (the first 16 hex
 * digits of its SHA-256: \`storyMarks.test.ts\` fails when a render changes
 * a clip) and one sound segment \`[onMs, offMs]\` per sentence, from ffmpeg
 * \`silencedetect\` at -35 dB, silences >= 250 ms
 * (design/native/content-wave-3.md § 4.5). Read through \`./storyMarks.ts\`.
 */
export const STORY_MARKS: Readonly<
  Record<
    string,
    {
      bytes: number
      sha256: string
      segments: readonly (readonly [number, number])[]
    }
  >
> = {
${body}
}
`
  const config = await prettier.resolveConfig(marksPath)
  writeFileSync(
    marksPath,
    await prettier.format(source, { ...config, parser: 'typescript' }),
  )
  console.log(`${storyMarks.size} story marks`)
}

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
