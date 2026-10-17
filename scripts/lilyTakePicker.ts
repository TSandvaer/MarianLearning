/**
 * Lily take picker: render several takes of a line, drop the near-duplicates,
 * let an ear pick on one self-contained HTML page, then splice the pick in.
 *
 * Why: `--retake` is one blind re-roll, and with one input it is barely a
 * re-roll at all. #558's retake of "Read the fig." came back with an energy
 * envelope 0.994 correlated with the take it replaced, the same "figa", and
 * failed the 2026-10-17 ear test again. Takes only differ when the seed or
 * the input text differs, so this script varies both and measures the result.
 *
 * Lines (`--ids`, comma-separated):
 *   <canon>.json:<utteranceId>  a canon utterance, e.g.
 *                               public/canon/word-song/level-1/cvc-words-short-i.json:word.p2.read
 *   <clip>.mp3                  a bundled clip the voice-QA page lists (text
 *                               from public/voice-qa.html), e.g.
 *                               public/assets/audio/path/guide-session-peek-open-div-share.mp3
 *   either with `@<git ref>`    read the text and the committed audio from
 *                               that ref instead of the working tree
 *
 * Render (bills ElevenLabs):
 *   npx tsx scripts/lilyTakePicker.ts --ids <line>,... [--takes 6]
 *     [--input-variant "<key>=<input>"]... [--variant-takes 3]
 *     [--reference "<key>=<file.mp3>"]... [--max-corr 0.95] [--label "<key>=<name>"]...
 *     [--out tmp/lily-takes/takes.html] [--max-chars 300] [--dry-run]
 *  - <key> is a line id or its tail (`word.p2.read`, `guide-...-share.mp3`).
 *  - Take 0 is the committed audio, the A/B anchor. Fresh takes use the
 *    production Lily request (lilyCanonLib.synthLily) plus a random seed.
 *  - `--input-variant` renders `--variant-takes` takes from another TTS input
 *    ("Read the fig!", "Read the fig..."); the caption text is unchanged.
 *    Every take is labelled with the exact input sent and its seed.
 *  - Every take is decoded and its 20 ms RMS envelope correlated (best lag
 *    within ±200 ms) with take 0, each `--reference` clip and the takes kept
 *    so far; above --max-corr it is a near-duplicate and left off the page.
 *  - Takes are kept in tmp/lily-takes/ (gitignored). A re-run appends, so the
 *    take numbers on an open page stay valid; `--takes 0` rebuilds the page
 *    without billing.
 *  - Aborts before any API call if the run would bill more than --max-chars.
 *  - The page has a Pick button per take and a "Copy picks" button that copies
 *    one line such as "read 17, hint 12, sharing 4". A line's name is its
 *    utterance id's last part or its clip's file stem, or `--label`.
 *
 * Apply (no API call; working tree only, no @ref):
 *   npx tsx scripts/lilyTakePicker.ts --apply <line>=<take>,...
 *  Writes the take to every canon utterance and every voice-QA-listed clip
 *  with the same ElevenLabs input (identical text gets identical bytes), and
 *  to tmp/revoice-cache, so a later re-voice or re-render keeps the pick. A
 *  changed bundled clip still needs `npm run export-audio` in mobile/.
 */
import { execFileSync } from 'node:child_process'
import { createHash, randomInt } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
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
import { assetManifests, loadPageDefinitions } from './voiceQaBaseline.js'

const TAKES_DIR = join(ROOT, 'tmp', 'lily-takes')
const CONCURRENCY = 3
/** 20 ms RMS frames at 16 kHz; correlation lags up to ±200 ms. */
const FRAME = 320
const MAX_LAG_FRAMES = 10

/** A clip the picker works on: a canon utterance or a bundled MP3. */
export type LineRef =
  | { kind: 'canon'; file: string; utteranceId: string }
  | { kind: 'mp3'; file: string }

export interface Take {
  n: number
  /** Exact text ElevenLabs received (take 0: the committed line's input). */
  input: string
  seed?: number
  /** audioHash(): what the voice-QA page shows once this take is applied. */
  hash: string
  seconds: number
}

/** tmp/lily-takes/<line>/manifest.json */
export interface TakeSet {
  line: LineRef
  text: string
  tier?: string
  /** The committed line's ElevenLabs input: the splice and cache key. */
  input: string
  takes: Take[]
  /** Extra near-duplicate anchors (e.g. the take a retake replaced). */
  references: Array<{ label: string; file: string }>
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

export interface Verdict {
  n: number
  keep: boolean
  /** Envelope correlation with take 0. */
  r0: number
  /** Highest envelope correlation with an anchor or an earlier kept take. */
  r: number
  nearest: string
}

export const lineId = (l: LineRef) =>
  l.kind === 'canon' ? `${l.file}:${l.utteranceId}` : l.file

function splitLast(s: string, sep: string): [string, string] {
  const i = s.lastIndexOf(sep)
  if (i <= 0 || i === s.length - 1) throw new Error(`bad entry "${s}"`)
  return [s.slice(0, i), s.slice(i + 1)]
}

/** "<canon>.json:<utteranceId>" or "<clip>.mp3", optionally "@<git ref>". */
export function parseLine(s: string): { line: LineRef; ref?: string } {
  const [body, ref] = s.includes('@') ? splitLast(s, '@') : [s, undefined]
  if (body.endsWith('.mp3')) return { line: { kind: 'mp3', file: body }, ref }
  const [file, utteranceId] = splitLast(body, ':')
  if (!file.endsWith('.json'))
    throw new Error(`"${s}": expected <canon>.json:<utteranceId> or <clip>.mp3`)
  return { line: { kind: 'canon', file, utteranceId }, ref }
}

export const parseIds = (arg: string) =>
  arg.split(',').map((e) => parseLine(e.trim()))

/** "<line>=<take>,..." */
export function parseApply(
  arg: string,
): Array<{ line: LineRef; take: number }> {
  return arg.split(',').map((entry) => {
    const [id, take] = splitLast(entry.trim(), '=')
    if (!/^\d+$/.test(take)) throw new Error(`bad take number in "${entry}"`)
    const { line, ref } = parseLine(id)
    if (ref) throw new Error(`--apply writes the working tree; drop @${ref}`)
    return { line, take: Number(take) }
  })
}

/** Repeatable "<key>=<value>" → values per key. */
export function parseKeyed(flag: string, entries: string[]) {
  const out = new Map<string, string[]>()
  for (const entry of entries) {
    const i = entry.indexOf('=')
    if (i <= 0 || i === entry.length - 1)
      throw new Error(`bad ${flag} "${entry}"`)
    const key = entry.slice(0, i)
    out.set(key, [...(out.get(key) ?? []), entry.slice(i + 1)])
  }
  return out
}

/** Does `key` name this line (whole id, or its tail after ":" or "/")? */
export const keyMatches = (line: LineRef, key: string) => {
  const id = lineId(line)
  return id === key || id.endsWith(`:${key}`) || id.endsWith(`/${key}`)
}

/** The name a line goes by in the page's copied picks ("read 17, hint 12"):
 *  the utterance id's last part, or the clip's file stem. */
export const shortLabel = (line: LineRef) =>
  line.kind === 'canon'
    ? line.utteranceId.split('.').pop()!
    : basename(line.file, '.mp3')

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
      touched.push({ kind: 'canon', file: rel, utteranceId: u.id })
    }
  }
  return touched
}

/** Every bundled clip the voice-QA page lists, as a repo path + its text. */
export function bundledClips(
  voiceQaHtml: string,
): Array<{ file: string; text: string }> {
  const defs = loadPageDefinitions(voiceQaHtml)
  return assetManifests(defs).flatMap(([prefix, files]) =>
    files.map(([name, text]) => ({
      file: `public${defs.ASSET_BASES[prefix]}${name}`,
      text,
    })),
  )
}

/** 20 ms RMS energy envelope of 16 kHz mono samples in [-1, 1]. */
export function rmsEnvelope(samples: ArrayLike<number>): Float64Array {
  const out = new Float64Array(Math.floor(samples.length / FRAME))
  for (let f = 0; f < out.length; f++) {
    let sum = 0
    for (let k = f * FRAME; k < (f + 1) * FRAME; k++)
      sum += samples[k] * samples[k]
    out[f] = Math.sqrt(sum / FRAME)
  }
  return out
}

/** Best normalized correlation of two envelopes over lags ±maxLag frames. */
export function envelopeCorr(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  maxLag = MAX_LAG_FRAMES,
): number {
  let best = -1
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let ab = 0
    let aa = 0
    let bb = 0
    for (let i = 0; i < a.length; i++) {
      const j = i + lag
      if (j < 0 || j >= b.length) continue
      ab += a[i] * b[j]
      aa += a[i] * a[i]
      bb += b[j] * b[j]
    }
    if (aa > 0 && bb > 0) best = Math.max(best, ab / Math.sqrt(aa * bb))
  }
  return best
}

/** Keep a take only if it is no closer than `maxCorr` to every anchor and to
 *  every take kept before it (in take order). `anchors[0]` is take 0. */
export function pickDistinct(
  anchors: ReadonlyArray<{ label: string; env: ArrayLike<number> }>,
  takes: ReadonlyArray<{ n: number; env: ArrayLike<number> }>,
  maxCorr: number,
): Verdict[] {
  const pool = [...anchors]
  return [...takes]
    .sort((a, b) => a.n - b.n)
    .map((t) => {
      let r = -1
      let nearest = ''
      for (const p of pool) {
        const c = envelopeCorr(p.env, t.env)
        if (c > r) [r, nearest] = [c, p.label]
      }
      const keep = r <= maxCorr
      if (keep) pool.push({ label: `take ${t.n}`, env: t.env })
      return {
        n: t.n,
        keep,
        r0: envelopeCorr(anchors[0].env, t.env),
        r,
        nearest,
      }
    })
}

/** The voice-QA page's audioHash, 10 hex: SHA-256 of a canon clip's base64
 *  string, or of a bundled MP3's bytes. */
export const audioHash = (line: LineRef, bytes: Buffer) =>
  createHash('sha256')
    .update(line.kind === 'canon' ? bytes.toString('base64') : bytes)
    .digest('hex')
    .slice(0, 10)

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  )

/** One self-contained page: take 0 plus every distinct take, inline as data
 *  URIs; the near-duplicates are listed, not playable. A Pick button per take
 *  builds the one-line answer ("read 17, hint 12, sharing 4") to copy. */
export function takesPage(
  sets: ReadonlyArray<{
    set: TakeSet
    label: string
    audio: ReadonlyMap<number, string>
    verdicts: readonly Verdict[]
  }>,
  maxCorr: number,
): string {
  const sections = sets.map(({ set, label, audio, verdicts }) => {
    const verdict = new Map(verdicts.map((v) => [v.n, v]))
    const shown = [...set.takes]
      .sort((a, b) => a.n - b.n)
      .filter((t) => t.n === 0 || verdict.get(t.n)?.keep)
    const dropped = verdicts.filter((v) => !v.keep)
    const rows = shown
      .map((t) => {
        const v = verdict.get(t.n)
        return `      <tr${t.n === 0 ? ' class="anchor"' : ''}>
        <td><button data-src="data:audio/mpeg;base64,${audio.get(t.n) ?? ''}">Play</button></td>
        <td><button class="pick" data-take="${t.n}">Pick</button></td>
        <td class="n">Take ${t.n}${t.n === 0 ? '<br><small>committed</small>' : ''}</td>
        <td><code>${escapeHtml(t.input)}</code>${t.input === set.input ? '' : ' <small>(variant)</small>'}</td>
        <td>${t.seconds.toFixed(2)} s</td>
        <td><small>${t.seed === undefined ? '' : `seed ${t.seed}<br>`}${v ? `r ${v.r0.toFixed(3)} to take 0<br>` : ''}${t.hash}</small></td>
      </tr>`
      })
      .join('\n')
    const note = dropped.length
      ? `    <p class="dropped">Near-duplicates left off (envelope r &gt; ${maxCorr}): ${dropped
          .map(
            (v) =>
              `take ${v.n} (${v.r.toFixed(3)} vs ${escapeHtml(v.nearest)})`,
          )
          .join(', ')}.</p>\n`
      : ''
    return `  <section data-label="${escapeHtml(label)}">
    <h2>${escapeHtml(set.text)} <small>(${escapeHtml(label)})</small></h2>
    <p class="id"><code>${escapeHtml(lineId(set.line))}</code> · ${shown.length - 1} distinct fresh take(s)</p>
    <table>
${rows}
    </table>
${note}  </section>`
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
  .id, .dropped { margin: 0.25rem 0 0.5rem; color: #666; font-size: 0.9rem; }
  table { border-collapse: collapse; width: 100%; }
  td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #ddd; vertical-align: middle; }
  tr.anchor { background: #f3f0e6; }
  tr.playing { background: #dcefdc; }
  tr.picked td { box-shadow: inset 0 -3px #3a7d44; }
  .picks { position: sticky; top: 0; background: #fff; padding: 0.5rem 0; border-bottom: 1px solid #ddd; display: flex; gap: 0.5rem; align-items: center; }
  .picks input { flex: 1; font: inherit; padding: 0.4rem; }
  td.n { white-space: nowrap; font-weight: 600; }
  button { font: inherit; padding: 0.4rem 1rem; }
</style>
</head>
<body>
<h1>Lily takes</h1>
<p>Take 0 is the committed clip. Tap Pick on the take you want for each line,
then Copy picks and paste the line back.</p>
<div class="picks">
  <input id="answer" readonly placeholder="No picks yet">
  <button id="copy">Copy picks</button>
</div>
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

  const order = [...document.querySelectorAll('section[data-label]')].map(
    (s) => s.dataset.label,
  )
  const picks = {}
  const answer = document.getElementById('answer')
  for (const b of document.querySelectorAll('button.pick')) {
    b.addEventListener('click', () => {
      const section = b.closest('section')
      for (const r of section.querySelectorAll('tr.picked'))
        r.classList.remove('picked')
      b.closest('tr').classList.add('picked')
      picks[section.dataset.label] = b.dataset.take
      answer.value = order
        .filter((l) => l in picks)
        .map((l) => l + ' ' + picks[l])
        .join(', ')
    })
  }
  const copy = document.getElementById('copy')
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(answer.value)
    } catch {
      answer.select()
      document.execCommand('copy')
    }
    copy.textContent = 'Copied'
    setTimeout(() => (copy.textContent = 'Copy picks'), 1500)
  })
</script>
</body>
</html>
`
}

// ---- I/O ------------------------------------------------------------------

const setDir = (l: LineRef) =>
  l.kind === 'canon'
    ? join(TAKES_DIR, l.file.replace(/\.json$/, ''), l.utteranceId)
    : join(TAKES_DIR, l.file.replace(/\.mp3$/, ''))
const takePath = (l: LineRef, n: number) => join(setDir(l), `take-${n}.mp3`)
const manifestPath = (l: LineRef) => join(setDir(l), 'manifest.json')

function readManifest(l: LineRef): TakeSet | undefined {
  const p = manifestPath(l)
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : undefined
}

function writeManifest(set: TakeSet): void {
  set.takes.sort((a, b) => a.n - b.n)
  writeFileSync(manifestPath(set.line), JSON.stringify(set, null, 2) + '\n')
}

/** A repo file from the working tree, or from `ref` when given. */
function readRepo(path: string, ref?: string): Buffer {
  if (ref)
    return execFileSync('git', ['show', `${ref}:${path}`], {
      cwd: ROOT,
      maxBuffer: 1 << 28,
    })
  const full = join(ROOT, path)
  if (!existsSync(full)) throw new Error(`no file ${path}`)
  return readFileSync(full)
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

function envelopeOfFile(file: string): Float64Array {
  const pcm = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
    { maxBuffer: 1 << 26 },
  )
  const samples = new Float64Array(pcm.length / 2)
  for (let i = 0; i < samples.length; i++)
    samples[i] = pcm.readInt16LE(i * 2) / 32768
  return rmsEnvelope(samples)
}

/** The line's caption text, tier and committed audio. */
function lineSource(
  line: LineRef,
  ref?: string,
): { text: string; tier?: string; audio: Buffer } {
  if (line.kind === 'canon') {
    const doc = JSON.parse(readRepo(line.file, ref).toString('utf8'))
    const u = (doc as CanonDoc['doc']).utterances.find(
      (x) => x.id === line.utteranceId,
    )
    if (!u) throw new Error(`no utterance ${lineId(line)}`)
    return {
      text: u.text,
      tier: tierFor(line.file),
      audio: Buffer.from(u.audio.base64, 'base64'),
    }
  }
  const clip = bundledClips(
    readRepo('public/voice-qa.html', ref).toString('utf8'),
  ).find((c) => c.file === line.file)
  if (!clip) throw new Error(`${line.file} is not on the voice-QA page`)
  if (renderElevenLabsText(clip.text) !== clip.text)
    throw new Error(`${line.file}: text is not plain; not supported`)
  return { text: clip.text, audio: readRepo(line.file, ref) }
}

/** The line's take set, created with take 0 = committed audio on first use. */
function openTakeSet(line: LineRef, ref?: string): TakeSet {
  const src = lineSource(line, ref)
  const existing = readManifest(line)
  if (existing) {
    if (existing.text !== src.text)
      throw new Error(
        `${lineId(line)} text changed ("${existing.text}" → "${src.text}"); delete ${relative(ROOT, setDir(line))} to start over`,
      )
    return existing
  }
  if (src.audio.length === 0)
    throw new Error(`${lineId(line)} has no committed audio to anchor on`)
  const set: TakeSet = {
    line,
    text: src.text,
    tier: src.tier,
    input: renderElevenLabsText(src.text, src.tier),
    takes: [],
    references: [],
  }
  mkdirSync(setDir(line), { recursive: true })
  writeFileSync(takePath(line, 0), src.audio)
  set.takes.push({
    n: 0,
    input: set.input,
    hash: audioHash(line, src.audio),
    seconds: seconds(takePath(line, 0)),
  })
  writeManifest(set)
  return set
}

function addReference(set: TakeSet, file: string): void {
  const bytes = readFileSync(resolve(file))
  const known = set.references.some((r) =>
    readFileSync(join(setDir(set.line), r.file)).equals(bytes),
  )
  if (known) return
  const name = `ref-${set.references.length + 1}.mp3`
  writeFileSync(join(setDir(set.line), name), bytes)
  set.references.push({ label: basename(file), file: name })
  writeManifest(set)
}

function verdictsFor(set: TakeSet, maxCorr: number): Verdict[] {
  const dir = setDir(set.line)
  return pickDistinct(
    [
      { label: 'take 0', env: envelopeOfFile(takePath(set.line, 0)) },
      ...set.references.map((r) => ({
        label: r.label,
        env: envelopeOfFile(join(dir, r.file)),
      })),
    ],
    set.takes
      .filter((t) => t.n > 0)
      .map((t) => ({ n: t.n, env: envelopeOfFile(takePath(set.line, t.n)) })),
    maxCorr,
  )
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

const repeated = (args: string[], name: string) =>
  args.flatMap((a, i) => (a === name ? [args[i + 1]] : []))

function intFlag(args: string[], name: string, fallback: number): number {
  const v = flag(args, name)
  if (v === undefined) return fallback
  if (!/^\d+$/.test(v)) throw new Error(`${name} needs a whole number`)
  return Number(v)
}

/** Each keyed entry must name exactly one of `lines`. */
function lineFor(lines: readonly LineRef[], key: string, flagName: string) {
  const hits = lines.filter((l) => keyMatches(l, key))
  if (hits.length !== 1)
    throw new Error(`${flagName} ${key} must match exactly one --ids line`)
  return hits[0]
}

async function renderMode(args: string[]): Promise<void> {
  const idsArg = flag(args, '--ids')
  if (!idsArg) throw new Error('--ids <line>,... is required')
  const specs = parseIds(idsArg)
  const lines = specs.map((s) => s.line)
  const takes = intFlag(args, '--takes', 6)
  const variantTakes = intFlag(args, '--variant-takes', 3)
  const maxChars = intFlag(args, '--max-chars', 300)
  const maxCorr = Number(flag(args, '--max-corr') ?? 0.95)
  const out = resolve(ROOT, flag(args, '--out') ?? 'tmp/lily-takes/takes.html')
  const variants = parseKeyed(
    '--input-variant',
    repeated(args, '--input-variant'),
  )
  const references = parseKeyed('--reference', repeated(args, '--reference'))
  const labelOverrides = parseKeyed('--label', repeated(args, '--label'))
  const labels = lines.map((l) => {
    const own = [...labelOverrides].find(([key]) => keyMatches(l, key))
    return own ? own[1][0] : shortLabel(l)
  })
  if (new Set(labels).size !== labels.length)
    throw new Error(`two lines share a page label (${labels}); use --label`)
  for (const key of [
    ...variants.keys(),
    ...references.keys(),
    ...labelOverrides.keys(),
  ])
    lineFor(lines, key, '--input-variant/--reference/--label')

  const sets = specs.map((s) => openTakeSet(s.line, s.ref))
  for (const [key, files] of references) {
    const set = sets[lines.indexOf(lineFor(lines, key, '--reference'))]
    for (const f of files) addReference(set, f)
  }
  const plans = sets.map((set) => {
    const alt = [...variants]
      .filter(([key]) => keyMatches(set.line, key))
      .flatMap(([, inputs]) => inputs)
    return {
      set,
      plan: planTakes(set.takes, [
        { text: set.text, input: set.input, count: takes },
        ...alt.map((text) => ({
          text,
          input: renderElevenLabsText(text, set.tier),
          count: variantTakes,
        })),
      ]),
    }
  })
  const chars = plans.reduce(
    (n, { plan }) => n + plan.reduce((m, t) => m + t.input.length, 0),
    0,
  )
  for (const { set, plan } of plans)
    console.log(
      `${lineId(set.line)}: ${plan.length} fresh takes (${[...new Set(plan.map((t) => JSON.stringify(t.input)))].join(', ') || 'none'})`,
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
        const seed = randomInt(0, 2 ** 32)
        const audio = await synthLily(t.text, set.tier, seed)
        billed += t.input.length
        writeFileSync(takePath(set.line, t.n), audio)
        set.takes.push({
          n: t.n,
          input: t.input,
          seed,
          hash: audioHash(set.line, audio),
          seconds: seconds(takePath(set.line, t.n)),
        })
        writeManifest(set)
      }
    }),
  )
  console.log(`Billed ${billed} characters.`)

  const pages = sets.map((set, i) => ({
    set,
    label: labels[i],
    verdicts: verdictsFor(set, maxCorr),
    audio: new Map(
      set.takes.map((t) => [
        t.n,
        readFileSync(takePath(set.line, t.n)).toString('base64'),
      ]),
    ),
  }))
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, takesPage(pages, maxCorr))
  for (const { set, verdicts } of pages) {
    const v = new Map(verdicts.map((x) => [x.n, x]))
    console.log(
      `${lineId(set.line)}: ${verdicts.filter((x) => x.keep).length} of ${verdicts.length} fresh takes distinct\n` +
        set.takes
          .map((t) => {
            const x = v.get(t.n)
            const tag = !x
              ? 'committed'
              : `${x.keep ? 'KEEP' : 'drop'} r0=${x.r0.toFixed(3)} max=${x.r.toFixed(3)} vs ${x.nearest}`
            return `  take ${t.n}: ${JSON.stringify(t.input)}${t.seed === undefined ? '' : ` seed ${t.seed}`} ${t.seconds.toFixed(2)} s ${t.hash} ${tag}`
          })
          .join('\n'),
    )
  }
  console.log(`Page: ${out}`)
}

function applyMode(arg: string): void {
  const voiceQa = readRepo('public/voice-qa.html').toString('utf8')
  const picks = parseApply(arg).map((p) => {
    const set = readManifest(p.line)
    if (!set) throw new Error(`no takes for ${lineId(p.line)}; render first`)
    if (!set.takes.some((t) => t.n === p.take))
      throw new Error(`${lineId(p.line)} has no take ${p.take}`)
    if (lineSource(p.line).text !== set.text)
      throw new Error(`${lineId(p.line)} text changed since its takes`)
    return { ...p, set, bytes: readFileSync(takePath(p.line, p.take)) }
  })
  const byInput = new Map<string, (typeof picks)[number]>()
  for (const p of picks) {
    const other = byInput.get(p.set.input)
    if (other && !other.bytes.equals(p.bytes))
      throw new Error(
        `${lineId(other.line)} and ${lineId(p.line)} share one input; pick one take`,
      )
    byInput.set(p.set.input, p)
  }

  const docs: CanonDoc[] = canonFiles().map((f) => ({
    rel: relative(ROOT, f),
    doc: JSON.parse(readFileSync(f, 'utf8')),
  }))
  const clips = bundledClips(voiceQa)
  const changed = new Set<string>()
  let mp3s = 0
  mkdirSync(CACHE, { recursive: true })
  for (const [input, p] of byInput) {
    const touched = spliceAudio(docs, input, p.bytes.toString('base64'))
    for (const t of touched) changed.add(t.file)
    for (const c of clips) {
      const path = join(ROOT, c.file)
      if (c.text !== input || !existsSync(path)) continue
      writeFileSync(path, p.bytes)
      touched.push({ kind: 'mp3', file: c.file })
      mp3s++
    }
    writeFileSync(cachePath(input), p.bytes)
    const take = p.set.takes.find((t) => t.n === p.take)!
    console.log(
      `${lineId(p.line)} ← take ${p.take} (${JSON.stringify(take.input)}): ` +
        touched.map(lineId).join(', '),
    )
  }
  for (const { rel, doc } of docs) {
    if (changed.has(rel)) writeFileSync(join(ROOT, rel), JSON.stringify(doc))
  }
  console.log(
    `Wrote ${changed.size} canon files, ${mp3s} MP3s, ${byInput.size} cache entries.` +
      (mp3s
        ? ' Run `npm run export-audio` in mobile/ for the native copy.'
        : ''),
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
