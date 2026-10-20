import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  BAKED_PATH_LINES,
  PATH_LINES_AWAITING_RENDER,
} from '@marian/core/emmasPath/pathLines'
import {
  GUIDANCE_LINES,
  GUIDANCE_LINES_AWAITING_RENDER,
} from '@marian/core/emmasPath/guidanceLines'
import { HUB_LINES } from '@marian/core/hub/hubLines'
import { WEB_AUDIO_MODULES } from './audioRegistry'
import { BLEND_MARKS } from './blendMarks.generated'
import { GREET_LINE_SOURCES } from './greetAudio'
import { SFX_SOURCES } from './sfx'

const mobileRoot = resolve(__dirname, '..', '..')
const webPublic = resolve(mobileRoot, '..', 'public')
const registryPaths = Object.keys(WEB_AUDIO_MODULES)
/**
 * The bundled blend clips (play-place spec § 3.4, K1) are decoded from the
 * canon, not copied from `public/`: the web-comparison tests leave them out
 * and N15 below covers them.
 */
const BLEND_PREFIX = '/native/blend/'
const webPaths = registryPaths.filter((p) => !p.startsWith(BLEND_PREFIX))

/** The registry's `require()` target for a web path, read from source. */
const registrySource = readFileSync(join(__dirname, 'audioRegistry.ts'), 'utf8')
function nativeFileFor(webPath: string): string {
  const escaped = webPath.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  const m = registrySource.match(
    new RegExp(`'${escaped}': require\\('([^']+)'\\)`),
  )
  if (!m) throw new Error(`no registry entry for ${webPath}`)
  return resolve(__dirname, m[1])
}

describe('bundled audio registry (npm run export-audio)', () => {
  it('has a native copy of every line and effect the engine can play', () => {
    const wanted = [
      ...Object.values(GREET_LINE_SOURCES),
      ...Object.values(HUB_LINES).map((l) => l.src),
      ...BAKED_PATH_LINES.filter(
        (l) => !PATH_LINES_AWAITING_RENDER.includes(l.id),
      ).map((l) => l.src),
      ...GUIDANCE_LINES.filter(
        (l) => !GUIDANCE_LINES_AWAITING_RENDER.includes(l.id),
      ).map((l) => l.src),
      ...Object.values(SFX_SOURCES),
    ]
    const missing = wanted.filter((p) => !registryPaths.includes(p))
    expect(missing).toEqual([])
  })

  it('has no copy of a path line still awaiting its render (the render commit empties that list)', () => {
    const awaiting = BAKED_PATH_LINES.filter((l) =>
      PATH_LINES_AWAITING_RENDER.includes(l.id),
    ).map((l) => l.src)
    expect(awaiting).toHaveLength(PATH_LINES_AWAITING_RENDER.length)
    expect(awaiting.filter((p) => registryPaths.includes(p))).toEqual([])
  })

  it('has no copy of a line still awaiting its render (the render commit empties that list)', () => {
    const awaiting = GUIDANCE_LINES.filter((l) =>
      GUIDANCE_LINES_AWAITING_RENDER.includes(l.id),
    ).map((l) => l.src)
    expect(awaiting).toHaveLength(GUIDANCE_LINES_AWAITING_RENDER.length)
    expect(awaiting.filter((p) => registryPaths.includes(p))).toEqual([])
  })

  it('covers every web MP3 in the bundled directories', () => {
    const dirs = ['greet', 'hub', 'path'].map((d) => ({
      dir: join(webPublic, 'assets', 'audio', d),
      prefix: `/assets/audio/${d}/`,
    }))
    const web = [
      ...dirs.flatMap(({ dir, prefix }) =>
        readdirSync(dir)
          .filter((f) => f.endsWith('.mp3'))
          .map((f) => `${prefix}${f}`),
      ),
      ...readdirSync(join(webPublic, 'assets'))
        .filter((f) => /^sfx-.*\.mp3$/.test(f))
        .map((f) => `/assets/${f}`),
    ].sort()
    expect([...webPaths].sort()).toEqual(web)
  })

  it('every native copy is byte-identical to its web original (re-run export-audio after a re-render)', () => {
    const drifted = webPaths.filter((webPath) => {
      const web = readFileSync(join(webPublic, webPath))
      const native = readFileSync(nativeFileFor(webPath))
      return !web.equals(native)
    })
    expect(drifted).toEqual([])
  })
})

describe('bundled blend clips (play-place spec § 3.4, N15)', () => {
  const word = (text: string) => text.split('...').pop()!.trim()

  it('bundles every BLEND_MARKS clip as /native/blend/<word>.mp3, with its measured bytes and hash', () => {
    const texts = Object.keys(BLEND_MARKS)
    expect(texts).toHaveLength(46)
    const wrong = texts.filter((text) => {
      const webPath = `${BLEND_PREFIX}${word(text)}.mp3`
      if (!registryPaths.includes(webPath)) return true
      const mp3 = readFileSync(nativeFileFor(webPath))
      const sha256 = createHash('sha256').update(mp3).digest('hex').slice(0, 16)
      const entry = BLEND_MARKS[text]!
      return mp3.length !== entry.bytes || sha256 !== entry.sha256
    })
    expect(wrong).toEqual([])
  })

  it('bundles no other blend clip', () => {
    const words = Object.keys(BLEND_MARKS).map(word)
    expect(
      registryPaths.filter((p) => p.startsWith(BLEND_PREFIX)).sort(),
    ).toEqual(words.map((w) => `${BLEND_PREFIX}${w}.mp3`).sort())
    expect(
      readdirSync(join(mobileRoot, 'assets', 'audio', 'blend')).sort(),
    ).toEqual(words.map((w) => `${w}.mp3`).sort())
  })
})
