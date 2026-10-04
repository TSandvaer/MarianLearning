/**
 * Re-voice ALL of Emma in ElevenLabs Lily (voice migration 4/6, ClickUp
 * 123jpnbc33h; plan: design/voice-migration-elevenlabs.md).
 *
 * Text-preserving: every canon file keeps its working-tree text and
 * structure byte-for-byte; only `utterances[].audio` is replaced. The
 * greet and hub MP3 bundles are re-rendered from the same line lists their
 * Azure render scripts use.
 *
 * Credit-safe:
 *  - De-duplicates on the exact ElevenLabs request text (after the IPA
 *    substitution), so "Hmm... try again?" in 25 files is rendered once.
 *  - Caches every render in tmp/revoice-cache/<sha256>.mp3 (gitignored). A
 *    crash or re-run never pays for a line twice.
 *  - `--dry-run` prints the unique-request count and character total
 *    without calling the API.
 *  - `--only <substring>` restricts to canon files whose path contains it.
 *  - `--retake <utterance-text>` (repeatable) drops that line's cache entry
 *    first, so the next render is a fresh take.
 *
 * Run: npx tsx scripts/revoiceCanonLily.ts [--dry-run] [--only x] [--retake "text"]
 * Reads ELEVENLABS_API_KEY from .env.local.
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  renderElevenLabsText,
  stripId3v2,
  synthesizeElevenLabs,
} from '../api/_tts_elevenlabs.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'tmp', 'revoice-cache')
const CONCURRENCY = 3

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const ONLY = args.includes('--only')
  ? args[args.indexOf('--only') + 1]
  : undefined
const RETAKES = args.flatMap((a, i) => (a === '--retake' ? [args[i + 1]] : []))

for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(
  /\r?\n/,
)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && process.env[m[1]] === undefined)
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
}

/** Production tier filter for a canon file (mirrors revoiceCanon.ts):
 *  math → none; word-song → basename; both letter-sounds files → letter-sounds. */
function tierFor(rel: string): string | undefined {
  if (rel.includes('/math/')) return undefined
  const base = rel
    .split('/')
    .pop()!
    .replace(/\.json$/, '')
  return base.startsWith('letter-sounds') ? 'letter-sounds' : base
}

function canonFiles(dir = join(ROOT, 'public', 'canon')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? canonFiles(join(dir, e.name))
      : e.name.endsWith('.json')
        ? [join(dir, e.name)]
        : [],
  )
}

/** {file, text} pairs from an Azure render script's LINES array. */
function bundleLines(script: string): Array<{ file: string; text: string }> {
  const src = readFileSync(join(ROOT, 'scripts', script), 'utf8')
  return [
    ...src.matchAll(
      /file:\s*'([^']+\.mp3)',\s*text:\s*(['"])((?:\\.|(?!\2).)*)\2/gs,
    ),
  ].map((m) => ({ file: m[1], text: m[3].replace(/\\(['"])/g, '$1') }))
}

type Job = { input: string; text: string; tier?: string }
const key = (input: string) =>
  createHash('sha256').update(`lily|eleven_v4|${input}`).digest('hex')

async function render(job: Job): Promise<Buffer> {
  const path = join(CACHE, `${key(job.input)}.mp3`)
  if (existsSync(path)) return Buffer.from(stripId3v2(readFileSync(path)))
  const { audio } = await synthesizeElevenLabs(
    {
      text: job.text,
      tier: job.tier,
      voice: '',
      rate: '',
      pitch: '',
      volume: '',
    },
    { backoff: { maxAttempts: 5 } },
  )
  writeFileSync(path, audio)
  return Buffer.from(audio)
}

async function main() {
  mkdirSync(CACHE, { recursive: true })
  const files = canonFiles().filter((f) => !ONLY || f.includes(ONLY))
  const docs = files.map((f) => ({
    f,
    rel: relative(ROOT, f),
    doc: JSON.parse(readFileSync(f, 'utf8')),
  }))
  const bundles = ONLY
    ? []
    : [
        ...bundleLines('render-greet-mp3s.mjs').map((l) => ({
          ...l,
          dir: 'greet',
        })),
        ...bundleLines('render-hub-mp3s.mjs').map((l) => ({
          ...l,
          dir: 'hub',
        })),
      ]

  const jobs = new Map<string, Job>()
  for (const { rel, doc } of docs) {
    const tier = tierFor(rel)
    for (const u of doc.utterances) {
      const input = renderElevenLabsText(u.text, tier)
      jobs.set(input, { input, text: u.text, tier })
    }
  }
  for (const b of bundles)
    jobs.set(renderElevenLabsText(b.text), { input: b.text, text: b.text })

  for (const t of RETAKES) {
    for (const j of jobs.values()) {
      if (j.text === t)
        rmSync(join(CACHE, `${key(j.input)}.mp3`), { force: true })
    }
  }

  const todo = [...jobs.values()].filter(
    (j) => !existsSync(join(CACHE, `${key(j.input)}.mp3`)),
  )
  const chars = todo.reduce((n, j) => n + j.input.length, 0)
  console.log(
    `${docs.length} canon files, ${bundles.length} bundled clips, ${jobs.size} unique requests; ` +
      `${todo.length} not cached (~${chars} characters to bill).`,
  )
  if (DRY) return

  let done = 0
  const queue = [...todo]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let j = queue.shift(); j; j = queue.shift()) {
        await render(j)
        if (++done % 25 === 0 || done === todo.length)
          console.log(`  rendered ${done}/${todo.length}`)
      }
    }),
  )

  for (const { f, rel, doc } of docs) {
    const tier = tierFor(rel)
    for (const u of doc.utterances) {
      const audio = await render(jobs.get(renderElevenLabsText(u.text, tier))!)
      u.audio = {
        kind: 'inline',
        base64: audio.toString('base64'),
        mime: 'audio/mpeg',
      }
    }
    writeFileSync(f, JSON.stringify(doc))
  }
  for (const b of bundles) {
    writeFileSync(
      join(ROOT, 'public', 'assets', 'audio', b.dir, b.file),
      await render(jobs.get(renderElevenLabsText(b.text))!),
    )
  }
  console.log(
    `Wrote ${docs.length} canon files and ${bundles.length} bundled MP3s.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
