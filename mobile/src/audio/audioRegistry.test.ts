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
  critterWordLine,
} from '@marian/core/emmasPath/guidanceLines'
import { CRITTER_SAID_WORDS } from '@marian/core/games/playPlace'
import { HUB_LINES } from '@marian/core/hub/hubLines'
import { WEB_AUDIO_MODULES } from './audioRegistry'
import { BLEND_MARKS } from './blendMarks.generated'
import { canonClipFor, clipHash } from './bundledAudio'
import {
  CANON_AUDIO_BYTES,
  CANON_AUDIO_HASHES,
  CANON_AUDIO_MODULES,
} from './canonAudioRegistry'
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
    // 46, plus the graduation check's nap, rat, map and tap.
    expect(texts).toHaveLength(50)
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

describe('bundled critter word clips (Thomas 2026-10-22)', () => {
  it('bundles a whole-word clip for each of the 156 said words, byte-identical to the web original', () => {
    expect(CRITTER_SAID_WORDS).toHaveLength(156)
    const wrong = CRITTER_SAID_WORDS.filter((w) => {
      const src = critterWordLine(w)?.src
      if (src === undefined || !registryPaths.includes(src)) return true
      return !readFileSync(join(webPublic, src)).equals(
        readFileSync(nativeFileFor(src)),
      )
    })
    expect(wrong).toEqual([])
  })
})

describe('bundled canon clips (no-Claude plan phase 1, design/native/no-claude-sizing.md § 4)', () => {
  /** Every canon clip by its text, decoded from `public/canon/**`. */
  const canon = new Map<string, Buffer>()
  /** Every canon line's base64, as the server sends it (one per text). */
  const canonBase64: [text: string, base64: string][] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name)
      if (name.isDirectory()) walk(p)
      else if (name.name.endsWith('.json')) {
        const json = JSON.parse(readFileSync(p, 'utf8')) as {
          utterances?: { text: string; audio?: { base64?: string } }[]
        }
        for (const u of json.utterances ?? []) {
          if (!u.audio?.base64) continue
          canon.set(u.text, Buffer.from(u.audio.base64, 'base64'))
          canonBase64.push([u.text, u.audio.base64])
        }
      }
    }
  }
  walk(join(webPublic, 'canon'))
  const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex')

  /** text → its bundled file, read from the generated source. */
  const source = readFileSync(join(__dirname, 'canonAudioRegistry.ts'), 'utf8')
  const entries = new Map<string, { file: string; bytes: number }>()
  for (const m of source.matchAll(
    /^ {2}('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"): require\('([^']+)'\),$/gm,
  )) {
    const text = m[1]!.slice(1, -1).replace(/\\(.)/g, '$1')
    entries.set(text, {
      file: resolve(__dirname, m[2]!),
      bytes: CANON_AUDIO_BYTES[text]!,
    })
  }

  it('resolves every canon line to a bundled clip with the same bytes and hash', () => {
    expect(canon.size).toBeGreaterThan(1000)
    const wrong = [...canon].filter(([text, mp3]) => {
      const entry = entries.get(text)
      if (entry === undefined) return true
      const bundled = readFileSync(entry.file)
      return (
        entry.bytes !== mp3.length ||
        bundled.length !== mp3.length ||
        sha256(bundled) !== sha256(mp3)
      )
    })
    expect(wrong.map(([text]) => text)).toEqual([])
    expect(Object.keys(CANON_AUDIO_MODULES)).toHaveLength(canon.size)
    expect(Object.keys(CANON_AUDIO_BYTES)).toHaveLength(canon.size)
  })

  it("stores every canon line's content hash: the app's clipHash of the base64 the server sends", () => {
    expect(canonBase64.length).toBeGreaterThanOrEqual(canon.size)
    const wrong = canonBase64.filter(
      ([text, base64]) => CANON_AUDIO_HASHES[text] !== clipHash(base64),
    )
    expect(wrong.map(([text]) => text)).toEqual([])
    expect(Object.keys(CANON_AUDIO_HASHES)).toHaveLength(canon.size)
  })

  it('looks a line up by its text: the module, its byte length and hash', () => {
    const [text, mp3] = [...canon][0]!
    expect(canonClipFor(text)).toEqual({
      module: CANON_AUDIO_MODULES[text],
      bytes: mp3.length,
      hash: clipHash(mp3.toString('base64')),
    })
    expect(canonClipFor('Not a canon line.')).toBeUndefined()
    expect(canonClipFor('constructor')).toBeUndefined()
  })

  it('bundles no other canon clip (a blend line reuses its blend clip)', () => {
    expect([...entries.keys()].sort()).toEqual([...canon.keys()].sort())
    const canonDir = join(mobileRoot, 'assets', 'audio', 'canon')
    const targets = new Set([...entries.values()].map((e) => e.file))
    const files = readdirSync(canonDir).map((f) => join(canonDir, f))
    expect(files.filter((f) => !targets.has(f))).toEqual([])
    const blendDir = join(mobileRoot, 'assets', 'audio', 'blend')
    for (const text of Object.keys(BLEND_MARKS)) {
      expect(entries.get(text)?.file).toBe(
        join(blendDir, `${text.split('...').pop()!.trim()}.mp3`),
      )
    }
  })
})
