/**
 * Shared Lily (ElevenLabs) canon-render helpers for revoiceCanonLily.ts and
 * lilyTakePicker.ts, so both render with exactly the production settings and
 * share one render cache.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { synthesizeElevenLabs } from '../api/_tts_elevenlabs.js'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** tmp/revoice-cache/<sha256>.mp3 (gitignored), one file per request text. */
export const CACHE = join(ROOT, 'tmp', 'revoice-cache')

/** Cache key for one ElevenLabs request text (after the IPA substitution). */
export const cacheKey = (input: string) =>
  createHash('sha256').update(`lily|eleven_v4|${input}`).digest('hex')
export const cachePath = (input: string) =>
  join(CACHE, `${cacheKey(input)}.mp3`)

/** Copy .env.local into process.env (existing variables win). */
export function loadEnvLocal(): void {
  const path = join(ROOT, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

/** Production tier filter for a canon file (mirrors revoiceCanon.ts):
 *  math → none; word-song → basename; both letter-sounds files → letter-sounds. */
export function tierFor(rel: string): string | undefined {
  if (rel.includes('/math/')) return undefined
  const base = rel
    .split('/')
    .pop()!
    .replace(/\.json$/, '')
  return base.startsWith('letter-sounds') ? 'letter-sounds' : base
}

export function canonFiles(dir = join(ROOT, 'public', 'canon')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? canonFiles(join(dir, e.name))
      : e.name.endsWith('.json')
        ? [join(dir, e.name)]
        : [],
  )
}

/** One uncached Lily render: eleven_v4, the Lily voice, default model
 *  settings. `text` goes through renderElevenLabsText(text, tier) inside.
 *  `seed` is for the take picker only; production renders send none. */
export async function synthLily(
  text: string,
  tier?: string,
  seed?: number,
): Promise<Buffer> {
  const { audio } = await synthesizeElevenLabs(
    { text, tier, voice: '', rate: '', pitch: '', volume: '' },
    { backoff: { maxAttempts: 5 }, seed },
  )
  return Buffer.from(audio)
}
