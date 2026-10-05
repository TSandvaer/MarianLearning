/**
 * Render the Hub unlock-celebration lines in ElevenLabs Lily (Emma's Path
 * 5/10, ClickUp 123jpnbc3dn).
 *
 * Line list = `CELEBRATE_LINE_TEXT` in src/screens/Hub/celebrationLines.ts
 * (the same module the caption reads), written to the bundled MP3 paths
 * `celebrateLineSrc()` names under public/assets/audio/hub/.
 *
 * Same request + cache shape as the hub bundle in revoiceCanonLily.ts
 * (no tier, cache key `lily|eleven_v4|<text>` in tmp/revoice-cache/), but
 * SEQUENTIAL — one request at a time, so it never competes for the
 * Starter plan's 3 concurrent slots.
 *
 * Run: npx tsx scripts/renderHubCelebrateLily.ts [--dry-run] [--retake "text"]
 * Reads ELEVENLABS_API_KEY from .env.local.
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripId3v2, synthesizeElevenLabs } from '../api/_tts_elevenlabs.js'
import {
  CELEBRATE_LINE_TEXT,
  celebrateLineSrc,
  type HubCelebrateLineId,
} from '../src/screens/Hub/celebrationLines'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'tmp', 'revoice-cache')

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const RETAKES = args.flatMap((a, i) => (a === '--retake' ? [args[i + 1]] : []))

for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(
  /\r?\n/,
)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && process.env[m[1]] === undefined)
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
}

const cachePath = (text: string) =>
  join(
    CACHE,
    `${createHash('sha256').update(`lily|eleven_v4|${text}`).digest('hex')}.mp3`,
  )

async function render(text: string): Promise<Buffer> {
  const path = cachePath(text)
  if (existsSync(path)) return Buffer.from(stripId3v2(readFileSync(path)))
  const { audio } = await synthesizeElevenLabs(
    { text, voice: '', rate: '', pitch: '', volume: '' },
    { backoff: { maxAttempts: 5 } },
  )
  writeFileSync(path, audio)
  return Buffer.from(stripId3v2(audio))
}

async function main() {
  mkdirSync(CACHE, { recursive: true })
  const lines = (Object.keys(CELEBRATE_LINE_TEXT) as HubCelebrateLineId[]).map(
    (id) => ({ id, text: CELEBRATE_LINE_TEXT[id] }),
  )
  for (const t of RETAKES) rmSync(cachePath(t), { force: true })

  const todo = lines.filter((l) => !existsSync(cachePath(l.text)))
  const chars = todo.reduce((n, l) => n + l.text.length, 0)
  console.log(
    `${lines.length} celebrate lines; ${todo.length} not cached (~${chars} characters to bill).`,
  )
  if (DRY) return

  for (const { id, text } of lines) {
    const out = join(ROOT, 'public', celebrateLineSrc(id))
    writeFileSync(out, await render(text))
    console.log(`  ${id} -> ${celebrateLineSrc(id)}  "${text}"`)
  }
  console.log(`Wrote ${lines.length} MP3s.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
