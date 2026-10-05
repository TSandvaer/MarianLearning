/**
 * Render the Emma's Path lines in ElevenLabs Lily (Emma's Path 10/10,
 * ClickUp 123jpnbc3du).
 *
 * Line list = `BAKED_PATH_LINES` in src/lib/emmasPath/pathLines.ts (lines
 * whose kind is not deferred), written to each line's `src` under
 * public/assets/audio/path/. Same request + cache shape as
 * revoiceCanonLily.ts (no tier, cache key `lily|eleven_v4|<text>` in
 * tmp/revoice-cache/), de-duplicated on text, with at most 2 requests in
 * flight so another job can keep one of the Starter plan's 3 slots. 429s
 * are retried by `synthesizeElevenLabs`' backoff.
 *
 * After writing, every MP3 is decoded with ffprobe and its duration is
 * printed; lines longer than 3.5 s are flagged.
 *
 * Run: npx tsx scripts/renderPathLinesLily.ts [--dry-run] [--retake "text"]
 * Reads ELEVENLABS_API_KEY from .env.local.
 */
import { execFileSync } from 'node:child_process'
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
import { BAKED_PATH_LINES } from '../src/lib/emmasPath/pathLines'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'tmp', 'revoice-cache')
const CONCURRENCY = 2
const LONG_SECONDS = 3.5

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

function durationSeconds(file: string): number {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  )
  const s = Number(out.trim())
  if (!Number.isFinite(s) || s <= 0) throw new Error(`undecodable: ${file}`)
  return s
}

async function main() {
  mkdirSync(CACHE, { recursive: true })
  mkdirSync(join(ROOT, 'public', 'assets', 'audio', 'path'), {
    recursive: true,
  })
  for (const t of RETAKES) rmSync(cachePath(t), { force: true })

  const texts = [...new Set(BAKED_PATH_LINES.map((l) => l.text))]
  const todo = texts.filter((t) => !existsSync(cachePath(t)))
  const chars = todo.reduce((n, t) => n + t.length, 0)
  console.log(
    `${BAKED_PATH_LINES.length} path lines, ${texts.length} unique texts; ` +
      `${todo.length} not cached (~${chars} characters to bill).`,
  )
  if (DRY) return

  let done = 0
  const queue = [...todo]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        await render(t)
        if (++done % 10 === 0 || done === todo.length)
          console.log(`  rendered ${done}/${todo.length}`)
      }
    }),
  )

  const written = new Set<string>()
  const long: string[] = []
  for (const { id, text, src } of BAKED_PATH_LINES) {
    const out = join(ROOT, 'public', src)
    if (!written.has(src)) {
      writeFileSync(out, await render(text))
      written.add(src)
    }
    const s = durationSeconds(out)
    const flag = s > LONG_SECONDS ? '  LONG' : ''
    if (flag) long.push(`${id} (${s.toFixed(2)} s)`)
    console.log(`${s.toFixed(2)}s  ${id}  "${text}"${flag}`)
  }
  console.log(
    `Wrote ${written.size} MP3s; ${long.length} over ${LONG_SECONDS} s.`,
  )
  for (const l of long) console.log(`  LONG ${l}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
