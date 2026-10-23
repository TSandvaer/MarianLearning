#!/usr/bin/env node
/**
 * Copy the web app's bundled MP3s into the native app and generate the
 * native audio registry.
 *
 *   npm run export-audio          (from mobile/; needs no root install)
 *
 * What it writes
 * --------------
 * - `assets/audio/greet/*.mp3`   `public/assets/audio/greet/*.mp3`
 * - `assets/audio/hub/*.mp3`     `public/assets/audio/hub/*.mp3`
 * - `assets/audio/path/*.mp3`    `public/assets/audio/path/*.mp3` (Emma's
 *                                Path + guidance lines)
 * - `assets/audio/sfx/*.mp3`     `public/assets/sfx-*.mp3`
 * - `assets/audio/blend/<word>.mp3` every Word Song blend clip
 *                                (`word.p*.blend` in `public/canon/word-song/**`),
 *                                decoded from the canon; registered as
 *                                `/native/blend/<word>.mp3` (play-place spec
 *                                § 3.4: the letter critters play them with no
 *                                network call)
 * - `assets/audio/canon/<sha256>.mp3` every canon clip (`public/canon/**`),
 *                                one per text (a blend line reuses its blend
 *                                clip above): no-Claude plan phase 1
 *                                (`design/native/no-claude-sizing.md` § 4).
 *                                A session line the app bundles plays from
 *                                the binary, not from the server's base64
 *                                (`src/audio/sessionAudio.ts`)
 * - `assets/canon/cvc-words-probe.json` the cvc-words graduation check's
 *                                probe lines (`public/canon/word-song/level-1/
 *                                cvc-words-probe.json`), copied byte for byte:
 *                                Word Song plays them beside the session audio
 * - `src/audio/audioRegistry.ts` web URL path → `require()`d native module
 * - `src/audio/canonAudioRegistry.ts` canon line text → its bundled module
 *                                and the clip's byte length
 *
 * The files are copied byte for byte: the web's voice-QA page is the ear
 * gate for every clip, so the native app must play the same bytes.
 * `src/audio/audioRegistry.test.ts` fails when a copy drifts from its web
 * original or a manifest line has no copy, i.e. whenever a web re-render
 * lands without a re-run of this script (the canon clips too: same bytes
 * and hash as every canon line). The blend clips are decoded
 * exactly as `export-assets.mjs` decodes them to measure `BLEND_MARKS`, so
 * the marks are the bundled bytes' (the test checks length and hash).
 */
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
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
const out = join(mobileRoot, 'assets', 'audio')

/** Every `.json` file under `dir`, in sorted walk order. */
function jsonFilesUnder(dir) {
  const files = []
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.json')) files.push(p)
    }
  }
  walk(dir)
  return files
}

/** [web dir, web URL prefix, file filter, native subdir] */
const GROUPS = [
  [
    join(webAssets, 'audio', 'greet'),
    '/assets/audio/greet/',
    /\.mp3$/,
    'greet',
  ],
  [join(webAssets, 'audio', 'hub'), '/assets/audio/hub/', /\.mp3$/, 'hub'],
  [join(webAssets, 'audio', 'path'), '/assets/audio/path/', /\.mp3$/, 'path'],
  [webAssets, '/assets/', /^sfx-.*\.mp3$/, 'sfx'],
]

const entries = []
for (const [webDir, urlPrefix, filter, subdir] of GROUPS) {
  const dest = join(out, subdir)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  const files = readdirSync(webDir)
    .filter((f) => filter.test(f))
    .sort()
  for (const file of files) {
    copyFileSync(join(webDir, file), join(dest, file))
    entries.push([
      `${urlPrefix}${file}`,
      `../../assets/audio/${subdir}/${file}`,
    ])
  }
  console.log(`${subdir}: ${files.length} files`)
}

/** Blend line text → its bundled path, for the canon registry below. */
const blendPaths = new Map()

// Word Song blend clips, one per distinct text, named by its word.
{
  const clips = new Map() // word -> { text, mp3 }
  for (const file of jsonFilesUnder(
    join(repoRoot, 'public', 'canon', 'word-song'),
  )) {
    const json = JSON.parse(readFileSync(file, 'utf8'))
    for (const u of json.utterances ?? []) {
      if (!/^word\.p\d+\.blend$/.test(u.id) || !u.audio?.base64) continue
      const mp3 = Buffer.from(u.audio.base64, 'base64')
      const word = u.text.split('...').pop().trim()
      const prev = clips.get(word)
      if (prev && (prev.text !== u.text || !prev.mp3.equals(mp3))) {
        throw new Error(`blend word "${word}" has two different clips`)
      }
      clips.set(word, { text: u.text, mp3 })
    }
  }
  const dest = join(out, 'blend')
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  for (const word of [...clips.keys()].sort()) {
    const file = `${word}.mp3`
    writeFileSync(join(dest, file), clips.get(word).mp3)
    entries.push([`/native/blend/${file}`, `../../assets/audio/blend/${file}`])
    blendPaths.set(clips.get(word).text, `../../assets/audio/blend/${file}`)
  }
  console.log(`blend: ${clips.size} files`)
}

// Every canon clip, one per text, named by its hash (no-Claude plan phase 1).
const canonEntries = [] // [text, require path, bytes]
{
  const clips = new Map() // text -> mp3
  for (const file of jsonFilesUnder(join(repoRoot, 'public', 'canon'))) {
    const json = JSON.parse(readFileSync(file, 'utf8'))
    for (const u of json.utterances ?? []) {
      if (!u.audio?.base64) continue
      const mp3 = Buffer.from(u.audio.base64, 'base64')
      const prev = clips.get(u.text)
      if (prev && !prev.equals(mp3)) {
        throw new Error(`canon line "${u.text}" has two different clips`)
      }
      clips.set(u.text, mp3)
    }
  }
  const dest = join(out, 'canon')
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  let written = 0
  let bytes = 0
  for (const text of [...clips.keys()].sort()) {
    const mp3 = clips.get(text)
    let path = blendPaths.get(text)
    if (path === undefined) {
      const hash = createHash('sha256').update(mp3).digest('hex').slice(0, 16)
      writeFileSync(join(dest, `${hash}.mp3`), mp3)
      path = `../../assets/audio/canon/${hash}.mp3`
      written += 1
      bytes += mp3.length
    }
    canonEntries.push([text, path, mp3.length])
  }
  console.log(
    `canon: ${clips.size} lines, ${written} files (${bytes} bytes) + ` +
      `${clips.size - written} blend clips`,
  )
}

// The graduation check's probe lines: a canon file the server never serves.
{
  const name = 'cvc-words-probe.json'
  const dest = join(mobileRoot, 'assets', 'canon')
  mkdirSync(dest, { recursive: true })
  copyFileSync(
    join(repoRoot, 'public', 'canon', 'word-song', 'level-1', name),
    join(dest, name),
  )
  console.log(`canon: ${name}`)
}

entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
const lines = entries.map(([url, path]) => `  '${url}': require('${path}'),`)
const source = `/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * GENERATED by \`mobile/scripts/export-audio.mjs\`. Do not edit by hand:
 * re-run \`npm run export-audio\` after a web MP3 changes.
 *
 * Web URL path (what core's line manifests and the web screens use) → the
 * bundled native audio module. Look clips up through \`./bundledAudio.ts\`.
 */
export const WEB_AUDIO_MODULES: Readonly<Record<string, number>> = {
${lines.join('\n')}
}
`
writeFileSync(join(mobileRoot, 'src', 'audio', 'audioRegistry.ts'), source)
console.log(`registry: ${entries.length} entries`)

/**
 * `text` as a TS string literal in Prettier's style (fewer escapes, else
 * single quotes), so the generated file passes `prettier --check`.
 */
function literal(text) {
  if (/[\\\n\r\u2028\u2029]/.test(text)) {
    throw new Error(`canon line ${JSON.stringify(text)} needs an escape`)
  }
  const singles = text.split("'").length - 1
  const doubles = text.split('"').length - 1
  return singles > doubles
    ? `"${text.replaceAll('"', '\\"')}"`
    : `'${text.replaceAll("'", "\\'")}'`
}
const canonSource = `/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * GENERATED by \`mobile/scripts/export-audio.mjs\`. Do not edit by hand:
 * re-run \`npm run export-audio\` after a canon render lands.
 *
 * Every \`public/canon/**\` clip, by the text it speaks (canon has one clip
 * per text). Look clips up through \`./bundledAudio.ts\`.
 */

/** Canon line text → its bundled audio module. */
export const CANON_AUDIO_MODULES: Readonly<Record<string, number>> = {
${canonEntries.map(([text, path]) => `  ${literal(text)}: require('${path}'),`).join('\n')}
}

/** Canon line text → its clip's byte length (Word Song's measured marks). */
export const CANON_AUDIO_BYTES: Readonly<Record<string, number>> = {
${canonEntries.map(([text, , n]) => `  ${literal(text)}: ${n},`).join('\n')}
}
`
writeFileSync(
  join(mobileRoot, 'src', 'audio', 'canonAudioRegistry.ts'),
  canonSource,
)
console.log(`canon registry: ${canonEntries.length} entries`)
