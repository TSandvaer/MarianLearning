import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { BAKED_PATH_LINES } from '@marian/core/emmasPath/pathLines'
import { GUIDANCE_LINES } from '@marian/core/emmasPath/guidanceLines'
import { HUB_LINES } from '@marian/core/hub/hubLines'
import { WEB_AUDIO_MODULES } from './audioRegistry'
import { GREET_LINE_SOURCES } from './greetAudio'
import { SFX_SOURCES } from './sfx'

const mobileRoot = resolve(__dirname, '..', '..')
const webPublic = resolve(mobileRoot, '..', 'public')
const registryPaths = Object.keys(WEB_AUDIO_MODULES)

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
      ...BAKED_PATH_LINES.map((l) => l.src),
      ...GUIDANCE_LINES.map((l) => l.src),
      ...Object.values(SFX_SOURCES),
    ]
    const missing = wanted.filter((p) => !registryPaths.includes(p))
    expect(missing).toEqual([])
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
    expect([...registryPaths].sort()).toEqual(web)
  })

  it('every native copy is byte-identical to its web original (re-run export-audio after a re-render)', () => {
    const drifted = registryPaths.filter((webPath) => {
      const web = readFileSync(join(webPublic, webPath))
      const native = readFileSync(nativeFileFor(webPath))
      return !web.equals(native)
    })
    expect(drifted).toEqual([])
  })
})
