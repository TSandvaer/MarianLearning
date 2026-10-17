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
 *    first, so the next render is a fresh take. A line that still fails the
 *    ear test goes to scripts/lilyTakePicker.ts instead (pick from N takes).
 *  - `--unrendered` renders only the canon lines whose audio is still empty
 *    (new lines a splice added, e.g. `scripts/spliceContentWave1Canon.ts`)
 *    and leaves every other clip's bytes as they are; no bundled clips.
 *
 * Run: npx tsx scripts/revoiceCanonLily.ts [--dry-run] [--only x] [--retake "text"]
 * Reads ELEVENLABS_API_KEY from .env.local.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import { renderElevenLabsText, stripId3v2 } from '../api/_tts_elevenlabs.js'
import {
  CACHE,
  ROOT,
  cachePath,
  canonFiles,
  loadEnvLocal,
  synthLily,
  tierFor,
} from './lilyCanonLib.js'

const CONCURRENCY = 3

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const ONLY = args.includes('--only')
  ? args[args.indexOf('--only') + 1]
  : undefined
const RETAKES = args.flatMap((a, i) => (a === '--retake' ? [args[i + 1]] : []))
const UNRENDERED = args.includes('--unrendered')
/** Is this line one the run renders (all of them, or only the empty ones)? */
const inScope = (u: { audio: { base64: string } }) =>
  !UNRENDERED || u.audio.base64 === ''

loadEnvLocal()

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

async function render(job: Job): Promise<Buffer> {
  const path = cachePath(job.input)
  if (existsSync(path)) return Buffer.from(stripId3v2(readFileSync(path)))
  const audio = await synthLily(job.text, job.tier)
  writeFileSync(path, audio)
  return audio
}

async function main() {
  mkdirSync(CACHE, { recursive: true })
  const files = canonFiles().filter((f) => !ONLY || f.includes(ONLY))
  const docs = files.map((f) => ({
    f,
    rel: relative(ROOT, f),
    doc: JSON.parse(readFileSync(f, 'utf8')),
  }))
  const bundles =
    ONLY || UNRENDERED
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
      if (!inScope(u)) continue
      const input = renderElevenLabsText(u.text, tier)
      jobs.set(input, { input, text: u.text, tier })
    }
  }
  for (const b of bundles)
    jobs.set(renderElevenLabsText(b.text), { input: b.text, text: b.text })

  for (const t of RETAKES) {
    for (const j of jobs.values()) {
      if (j.text === t) rmSync(cachePath(j.input), { force: true })
    }
  }

  const todo = [...jobs.values()].filter((j) => !existsSync(cachePath(j.input)))
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
      if (!inScope(u)) continue
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
