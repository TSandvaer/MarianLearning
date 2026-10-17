/**
 * Lily take picker: render several takes of a canon line, let an ear pick
 * one on a self-contained HTML page, then splice the pick in.
 *
 * Why: `revoiceCanonLily.ts --retake` is one blind re-roll. "Read the fig."
 * still said "figa" after #558's retake and failed the 2026-10-17 ear test
 * again; this turns N re-rolls into one listening round.
 *
 * Render (bills ElevenLabs):
 *   npx tsx scripts/lilyTakePicker.ts \
 *     --ids public/canon/word-song/level-1/cvc-words-short-i.json:word.p2.read,... \
 *     [--takes 6] [--input-variant "word.p2.read=Read the fig"] [--variant-takes 3] \
 *     [--out tmp/lily-takes/takes.html] [--max-chars 300] [--dry-run]
 *  - Take 0 is the committed audio, the A/B anchor. Fresh takes use exactly
 *    the production Lily request (lilyCanonLib.synthLily).
 *  - `--input-variant <utteranceId>=<input>` (repeatable) renders
 *    `--variant-takes` extra takes from a different TTS input; the caption
 *    text is unchanged. Every take is labelled with the exact input sent.
 *  - Takes are kept in tmp/lily-takes/ (gitignored). A re-run appends, so the
 *    take numbers on an open page stay valid; `--takes 0` rebuilds the page
 *    without billing.
 *  - Aborts before any API call if the run would bill more than --max-chars.
 *
 * Apply (no API call):
 *   npx tsx scripts/lilyTakePicker.ts --apply <canonFile>:<utteranceId>=<take>,...
 *  Splices the take into every canon utterance with the same ElevenLabs input
 *  (revoiceCanonLily's dedupe key, so identical text gets identical bytes) and
 *  into tmp/revoice-cache, so a later full re-voice keeps the pick.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { renderElevenLabsText } from '../api/_tts_elevenlabs.js'
import {
  CACHE,
  ROOT,
  cachePath,
  canonFiles,
  loadEnvLocal,
  synthLily,
  tierFor,
} from './lilyCanonLib.js'

const TAKES_DIR = join(ROOT, 'tmp', 'lily-takes')
const CONCURRENCY = 3

export interface LineRef {
  file: string
  utteranceId: string
}

export interface Take {
  n: number
  /** Exact text ElevenLabs received (take 0: the committed line's input). */
  input: string
  /** Voice-QA audioHash scheme: SHA-256 of the base64 string, 10 hex. */
  hash: string
  seconds: number
}

/** tmp/lily-takes/<canon path>/<utteranceId>/manifest.json */
export interface TakeSet extends LineRef {
  text: string
  tier?: string
  /** The committed line's ElevenLabs input: the splice and cache key. */
  input: string
  takes: Take[]
}

export interface Utterance {
  id: string
  text: string
  audio: { kind: string; base64: string; mime: string }
}

export interface CanonDoc {
  rel: string
  doc: { utterances: Utterance[] }
}

export const lineId = (r: LineRef) => `${r.file}:${r.utteranceId}`

function splitLast(s: string, sep: string): [string, string] {
  const i = s.lastIndexOf(sep)
  if (i <= 0 || i === s.length - 1) throw new Error(`bad entry "${s}"`)
  return [s.slice(0, i), s.slice(i + 1)]
}

/** "<file>:<utteranceId>,..." */
export function parseIds(arg: string): LineRef[] {
  return arg.split(',').map((entry) => {
    const [file, utteranceId] = splitLast(entry.trim(), ':')
    return { file, utteranceId }
  })
}

/** "<file>:<utteranceId>=<take>,..." */
export function parseApply(arg: string): Array<LineRef & { take: number }> {
  return arg.split(',').map((entry) => {
    const [ref, take] = splitLast(entry.trim(), '=')
    if (!/^\d+$/.test(take)) throw new Error(`bad take number in "${entry}"`)
    return { ...parseIds(ref)[0], take: Number(take) }
  })
}

/** Repeatable "<utteranceId>=<input>" → inputs per utteranceId. */
export function parseVariants(entries: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const entry of entries) {
    const i = entry.indexOf('=')
    if (i <= 0 || i === entry.length - 1)
      throw new Error(`bad --input-variant "${entry}"`)
    const id = entry.slice(0, i)
    out.set(id, [...(out.get(id) ?? []), entry.slice(i + 1)])
  }
  return out
}

/** Fresh takes to render, numbered after the takes already on disk. Each
 *  input in `inputs` gets `count` takes, in order. */
export function planTakes(
  existing: readonly Take[],
  inputs: ReadonlyArray<{ text: string; input: string; count: number }>,
): Array<{ n: number; text: string; input: string }> {
  let n = existing.reduce((max, t) => Math.max(max, t.n), -1)
  return inputs.flatMap(({ text, input, count }) =>
    Array.from({ length: count }, () => ({ n: ++n, text, input })),
  )
}

/** Put `base64` on every utterance whose ElevenLabs input equals `input`.
 *  Returns the touched lines. */
export function spliceAudio(
  docs: readonly CanonDoc[],
  input: string,
  base64: string,
): LineRef[] {
  const touched: LineRef[] = []
  for (const { rel, doc } of docs) {
    for (const u of doc.utterances) {
      if (renderElevenLabsText(u.text, tierFor(rel)) !== input) continue
      u.audio = { kind: 'inline', base64, mime: 'audio/mpeg' }
      touched.push({ file: rel, utteranceId: u.id })
    }
  }
  return touched
}

export const audioHash = (base64: string) =>
  createHash('sha256').update(base64, 'utf8').digest('hex').slice(0, 10)

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  )

/** One self-contained page: every take inline as a data URI. */
export function takesPage(
  sets: ReadonlyArray<{ set: TakeSet; audio: ReadonlyMap<number, string> }>,
): string {
  const sections = sets.map(({ set, audio }) => {
    const rows = [...set.takes]
      .sort((a, b) => a.n - b.n)
      .map(
        (t) => `      <tr${t.n === 0 ? ' class="anchor"' : ''}>
        <td><button data-src="data:audio/mpeg;base64,${audio.get(t.n) ?? ''}">Play</button></td>
        <td class="n">Take ${t.n}${t.n === 0 ? '<br><small>committed</small>' : ''}</td>
        <td><code>${escapeHtml(t.input)}</code>${t.input === set.input ? '' : ' <small>(variant)</small>'}</td>
        <td>${t.seconds.toFixed(2)} s</td>
        <td><small>${t.hash}</small></td>
      </tr>`,
      )
      .join('\n')
    return `  <section>
    <h2>${escapeHtml(set.text)}</h2>
    <p class="id"><code>${escapeHtml(lineId(set))}</code></p>
    <table>
${rows}
    </table>
  </section>`
  })
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lily takes</title>
<style>
  body { font: 16px/1.4 system-ui, sans-serif; margin: 2rem; max-width: 60rem; }
  h2 { margin: 2rem 0 0; }
  .id { margin: 0 0 0.5rem; color: #666; }
  table { border-collapse: collapse; width: 100%; }
  td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #ddd; vertical-align: middle; }
  tr.anchor { background: #f3f0e6; }
  tr.playing { background: #dcefdc; }
  td.n { white-space: nowrap; font-weight: 600; }
  button { font: inherit; padding: 0.4rem 1rem; }
</style>
</head>
<body>
<h1>Lily takes</h1>
<p>Take 0 is the committed clip. Pick with
<code>npx tsx scripts/lilyTakePicker.ts --apply &lt;canonFile&gt;:&lt;utteranceId&gt;=&lt;take&gt;</code>.</p>
${sections.join('\n')}
<script>
  let current = null
  for (const b of document.querySelectorAll('button[data-src]')) {
    b.addEventListener('click', () => {
      if (current) {
        current.audio.pause()
        current.row.classList.remove('playing')
      }
      const audio = new Audio(b.dataset.src)
      const row = b.closest('tr')
      row.classList.add('playing')
      audio.addEventListener('ended', () => row.classList.remove('playing'))
      audio.play()
      current = { audio, row }
    })
  }
</script>
</body>
</html>
`
}

// ---- I/O ------------------------------------------------------------------

const setDir = (r: LineRef) =>
  join(TAKES_DIR, r.file.replace(/\.json$/, ''), r.utteranceId)
const takePath = (r: LineRef, n: number) => join(setDir(r), `take-${n}.mp3`)
const manifestPath = (r: LineRef) => join(setDir(r), 'manifest.json')

function readManifest(r: LineRef): TakeSet | undefined {
  const p = manifestPath(r)
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : undefined
}

function writeManifest(set: TakeSet): void {
  set.takes.sort((a, b) => a.n - b.n)
  writeFileSync(manifestPath(set), JSON.stringify(set, null, 2) + '\n')
}

function seconds(file: string): number {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  )
  const s = Number(out.trim())
  if (!Number.isFinite(s) || s <= 0) throw new Error(`undecodable: ${file}`)
  return s
}

function loadUtterance(r: LineRef): Utterance {
  const path = join(ROOT, r.file)
  if (!existsSync(path)) throw new Error(`no canon file ${r.file}`)
  const doc = JSON.parse(readFileSync(path, 'utf8')) as CanonDoc['doc']
  const u = doc.utterances.find((x) => x.id === r.utteranceId)
  if (!u) throw new Error(`no utterance ${lineId(r)}`)
  return u
}

/** The line's take set, created with take 0 = committed audio on first use. */
function openTakeSet(r: LineRef): TakeSet {
  const u = loadUtterance(r)
  const existing = readManifest(r)
  if (existing) {
    if (existing.text !== u.text)
      throw new Error(
        `${lineId(r)} text changed ("${existing.text}" → "${u.text}"); delete ${relative(ROOT, setDir(r))} to start over`,
      )
    return existing
  }
  if (u.audio.base64 === '')
    throw new Error(`${lineId(r)} has no committed audio to anchor on`)
  const tier = tierFor(r.file)
  const set: TakeSet = {
    ...r,
    text: u.text,
    tier,
    input: renderElevenLabsText(u.text, tier),
    takes: [],
  }
  mkdirSync(setDir(r), { recursive: true })
  writeFileSync(takePath(r, 0), Buffer.from(u.audio.base64, 'base64'))
  set.takes.push({
    n: 0,
    input: set.input,
    hash: audioHash(u.audio.base64),
    seconds: seconds(takePath(r, 0)),
  })
  writeManifest(set)
  return set
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

function intFlag(args: string[], name: string, fallback: number): number {
  const v = flag(args, name)
  if (v === undefined) return fallback
  if (!/^\d+$/.test(v)) throw new Error(`${name} needs a whole number`)
  return Number(v)
}

async function renderMode(args: string[]): Promise<void> {
  const idsArg = flag(args, '--ids')
  if (!idsArg)
    throw new Error('--ids <canonFile>:<utteranceId>,... is required')
  const refs = parseIds(idsArg)
  const takes = intFlag(args, '--takes', 6)
  const variantTakes = intFlag(args, '--variant-takes', 3)
  const maxChars = intFlag(args, '--max-chars', 300)
  const out = resolve(ROOT, flag(args, '--out') ?? 'tmp/lily-takes/takes.html')
  const variants = parseVariants(
    args.flatMap((a, i) => (a === '--input-variant' ? [args[i + 1]] : [])),
  )
  for (const id of variants.keys()) {
    if (refs.filter((r) => r.utteranceId === id).length !== 1)
      throw new Error(`--input-variant ${id} must match exactly one --ids line`)
  }

  const sets = refs.map(openTakeSet)
  const plans = sets.map((set) => ({
    set,
    plan: planTakes(set.takes, [
      { text: set.text, input: set.input, count: takes },
      ...(variants.get(set.utteranceId) ?? []).map((text) => ({
        text,
        input: renderElevenLabsText(text, set.tier),
        count: variantTakes,
      })),
    ]),
  }))
  const chars = plans.reduce(
    (n, { plan }) => n + plan.reduce((m, t) => m + t.input.length, 0),
    0,
  )
  for (const { set, plan } of plans)
    console.log(
      `${lineId(set)}: ${plan.length} fresh takes (${[...new Set(plan.map((t) => JSON.stringify(t.input)))].join(', ') || 'none'})`,
    )
  console.log(`${chars} characters to bill (cap ${maxChars}).`)
  if (chars > maxChars) throw new Error('over --max-chars; nothing rendered')
  if (args.includes('--dry-run')) return

  loadEnvLocal()
  let billed = 0
  const queue = plans.flatMap(({ set, plan }) => plan.map((t) => ({ set, t })))
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const { set, t } = job
        const audio = await synthLily(t.text, set.tier)
        billed += t.input.length
        writeFileSync(takePath(set, t.n), audio)
        set.takes.push({
          n: t.n,
          input: t.input,
          hash: audioHash(audio.toString('base64')),
          seconds: seconds(takePath(set, t.n)),
        })
        writeManifest(set)
      }
    }),
  )
  console.log(`Billed ${billed} characters.`)

  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(
    out,
    takesPage(
      sets.map((set) => ({
        set,
        audio: new Map(
          set.takes.map((t) => [
            t.n,
            readFileSync(takePath(set, t.n)).toString('base64'),
          ]),
        ),
      })),
    ),
  )
  for (const set of sets)
    console.log(
      `${lineId(set)}\n` +
        set.takes
          .map(
            (t) =>
              `  take ${t.n}: ${JSON.stringify(t.input)} ${t.seconds.toFixed(2)} s ${t.hash}`,
          )
          .join('\n'),
    )
  console.log(`Page: ${out}`)
}

function applyMode(arg: string): void {
  const picks = parseApply(arg).map((p) => {
    const set = readManifest(p)
    if (!set) throw new Error(`no takes for ${lineId(p)}; render them first`)
    if (!set.takes.some((t) => t.n === p.take))
      throw new Error(`${lineId(p)} has no take ${p.take}`)
    if (loadUtterance(p).text !== set.text)
      throw new Error(`${lineId(p)} text changed since its takes were rendered`)
    return { ...p, set, bytes: readFileSync(takePath(p, p.take)) }
  })
  const byInput = new Map<string, (typeof picks)[number]>()
  for (const p of picks) {
    const other = byInput.get(p.set.input)
    if (other && !other.bytes.equals(p.bytes))
      throw new Error(
        `${lineId(other)} and ${lineId(p)} share one input; pick one take`,
      )
    byInput.set(p.set.input, p)
  }

  const docs: CanonDoc[] = canonFiles().map((f) => ({
    rel: relative(ROOT, f),
    doc: JSON.parse(readFileSync(f, 'utf8')),
  }))
  const changed = new Set<string>()
  mkdirSync(CACHE, { recursive: true })
  for (const [input, p] of byInput) {
    const touched = spliceAudio(docs, input, p.bytes.toString('base64'))
    writeFileSync(cachePath(input), p.bytes)
    for (const t of touched) changed.add(t.file)
    console.log(
      `${lineId(p)} ← take ${p.take} (${JSON.stringify(p.set.takes.find((t) => t.n === p.take)!.input)}): ` +
        touched.map(lineId).join(', '),
    )
  }
  for (const { rel, doc } of docs) {
    if (changed.has(rel)) writeFileSync(join(ROOT, rel), JSON.stringify(doc))
  }
  console.log(
    `Wrote ${changed.size} canon files and ${byInput.size} cache entries.`,
  )
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const apply = flag(args, '--apply')
  if (apply) applyMode(apply)
  else await renderMode(args)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
