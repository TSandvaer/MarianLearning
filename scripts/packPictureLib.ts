/**
 * Pure helpers for `scripts/generatePackPictures.ts` (Word Song pack pictures
 * via OpenAI gpt-image-2.5-flare). No file system, no network: everything
 * here is unit-tested in `packPictureLib.test.ts`.
 *
 * Covers: manifest parse/validation + selection, prompt building, CLI args,
 * spend math (usage → USD, dry-run estimate, ledger sum, budget gate), the
 * `--pick` copy plan, error classification + backoff, and a bounded pool.
 */

import { parseArgs } from 'node:util'

// ── Fixed call shape (proven in the 2026-10-16 bake-off) ────────────────────

export const MODEL = 'gpt-image-2.5-flare'
export const IMAGE_SIZE = '1024x1024'
export const QUALITY = 'medium'
export const MAX_CONCURRENCY = 4
export const DEFAULT_VARIANTS = 2
/** The images API accepts n = 1..10. */
export const MAX_VARIANTS = 10
export const MAX_RETRIES = 4

export const ANCHOR_WORDS = ['hen', 'sack', 'wing'] as const

/** Repo-relative paths. */
export const PATHS = {
  manifest: 'design/word-song/picture-manifest.json',
  anchorsDir: 'design/references/picture-pack/anchors-openai',
  outRoot: 'design/references/picture-pack/openai',
  ledger: 'design/references/picture-pack/openai/spend-ledger.jsonl',
  packRoot: 'design/references/picture-pack',
  currentPictures: 'mobile/assets/pictures',
} as const

export function anchorRelPaths(): string[] {
  return ANCHOR_WORDS.map((w) => `${PATHS.anchorsDir}/anchor-${w}.png`)
}

export function batchDirRel(batch: number): string {
  return `${PATHS.outRoot}/batch-${batch}`
}

export function variantRelPath(batch: number, word: string, k: number): string {
  return `${batchDirRel(batch)}/${word}__v${k}.png`
}

export function contactSheetRelPath(batch: number): string {
  return `${batchDirRel(batch)}/contact-sheet.png`
}

export function currentPictureRelPath(word: string): string {
  return `${PATHS.currentPictures}/${word}.webp`
}

/** Destination the existing embed pipeline reads (scripts/embed-pictures.ts). */
export function pickDestRelPath(tier: string, word: string): string {
  return `${PATHS.packRoot}/transparent-${tier}/picture-${word}.png`
}

// ── Manifest ────────────────────────────────────────────────────────────────

/** One row of design/word-song/picture-manifest.json. `word` is the picture
 *  key and the file stem. */
export interface PictureManifestEntry {
  word: string
  tier: string
  batch: number
  subject: string
  avoid: string[]
  distinctFrom: string[]
}

/** Lower-case slug: safe as a file stem and a directory suffix. */
const SLUG = /^[a-z0-9][a-z0-9-]*$/

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string')
}

/**
 * Validates the parsed manifest JSON. Collects every problem and throws one
 * error listing them all, so a broken manifest is fixed in one pass. Unknown
 * extra keys are ignored (forward-compatible with manifest additions).
 */
export function parseManifest(raw: unknown): PictureManifestEntry[] {
  if (!Array.isArray(raw)) {
    throw new Error('Manifest must be a JSON array of entries.')
  }
  const errors: string[] = []
  const entries: PictureManifestEntry[] = []
  const seen = new Set<string>()

  raw.forEach((item: unknown, i) => {
    const at = `entry ${i}`
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      errors.push(`${at}: must be an object`)
      return
    }
    const r = item as Record<string, unknown>
    const label =
      typeof r.word === 'string' && r.word ? `${at} ("${r.word}")` : at
    const before = errors.length

    if (typeof r.word !== 'string' || !SLUG.test(r.word)) {
      errors.push(
        `${label}: "word" must be a lower-case slug (a-z, 0-9, -), got ${JSON.stringify(r.word)}`,
      )
    }
    if (typeof r.tier !== 'string' || !SLUG.test(r.tier)) {
      errors.push(
        `${label}: "tier" must be a lower-case slug (a-z, 0-9, -), got ${JSON.stringify(r.tier)}`,
      )
    }
    if (
      typeof r.batch !== 'number' ||
      !Number.isInteger(r.batch) ||
      r.batch < 1
    ) {
      errors.push(
        `${label}: "batch" must be a positive integer, got ${JSON.stringify(r.batch)}`,
      )
    }
    if (typeof r.subject !== 'string' || r.subject.trim() === '') {
      errors.push(`${label}: "subject" must be a non-empty string`)
    }
    if (!isStringArray(r.avoid)) {
      errors.push(`${label}: "avoid" must be an array of strings`)
    }
    if (!isStringArray(r.distinctFrom)) {
      errors.push(`${label}: "distinctFrom" must be an array of strings`)
    }
    if (typeof r.word === 'string' && SLUG.test(r.word)) {
      if (seen.has(r.word)) errors.push(`${label}: duplicate word`)
      seen.add(r.word)
    }
    if (errors.length > before) return

    entries.push({
      word: r.word as string,
      tier: r.tier as string,
      batch: r.batch as number,
      subject: (r.subject as string).trim(),
      avoid: (r.avoid as string[]).map((s) => s.trim()).filter(Boolean),
      distinctFrom: r.distinctFrom as string[],
    })
  })

  if (errors.length > 0) {
    throw new Error(
      `Manifest has ${errors.length} problem(s):\n  - ${errors.join('\n  - ')}`,
    )
  }
  if (entries.length === 0) throw new Error('Manifest is empty.')
  return entries
}

export type Selection =
  | { kind: 'batch'; batch: number }
  | { kind: 'words'; words: string[] }

/** Picks the manifest rows to generate, in manifest order for a batch and in
 *  the requested order for `--words`. Throws on an empty batch or unknown
 *  words. */
export function selectEntries(
  manifest: PictureManifestEntry[],
  sel: Selection,
): PictureManifestEntry[] {
  if (sel.kind === 'batch') {
    const rows = manifest.filter((e) => e.batch === sel.batch)
    if (rows.length === 0) {
      const batches = [...new Set(manifest.map((e) => e.batch))].sort(
        (a, b) => a - b,
      )
      throw new Error(
        `No manifest entries in batch ${sel.batch}. Batches present: ${batches.join(', ')}`,
      )
    }
    return rows
  }
  const byWord = new Map(manifest.map((e) => [e.word, e]))
  const unknown = sel.words.filter((w) => !byWord.has(w))
  if (unknown.length > 0) {
    throw new Error(`Not in the manifest: ${unknown.join(', ')}`)
  }
  return [...new Set(sel.words)].map(
    (w) => byWord.get(w) as PictureManifestEntry,
  )
}

// ── Prompt ──────────────────────────────────────────────────────────────────

/**
 * Bake-off STYLE prompt, with the background clause adapted for
 * `background: "transparent"` (the bake-off asked for a cream background and
 * still got real alpha; asking for transparency directly removes the
 * contradiction).
 */
export const STYLE_TEMPLATE =
  "Draw {subject} as a single children's picture-book illustration in exactly the same art style " +
  'as the reference pictures: the same soft line weight, the same flat soft colours and gentle ' +
  'cel-shading, the same simplicity and finish. The references show the style only; do not copy ' +
  'their subjects. One subject, centred, filling about 70% of a square frame, on a fully ' +
  'transparent background with no scenery, no shadow, no ground, no text, no border.'

export function buildPrompt(
  entry: Pick<PictureManifestEntry, 'subject' | 'avoid'>,
): string {
  const base = STYLE_TEMPLATE.replace('{subject}', entry.subject.trim())
  const avoid = entry.avoid.map((s) => s.trim()).filter(Boolean)
  return avoid.length > 0
    ? `${base} Must not look like: ${avoid.join('; ')}.`
    : base
}

// ── Spend ───────────────────────────────────────────────────────────────────

/** Published gpt-image-2.5 rates, USD per 1M tokens. */
export const RATES_PER_1M = {
  imageInput: 8,
  textInput: 5,
  imageOutput: 30,
} as const

/** Measured on 2026-10-16: 3 anchors in = 3,072 image tokens; one 1024x1024
 *  medium image out = 439 tokens. */
export const MEASURED = {
  anchorImageInputTokens: 3072,
  outputTokensPerImage: 439,
} as const

/** Structural subset of the SDK's `ImagesResponse.Usage`. */
export interface ImageUsage {
  input_tokens: number
  output_tokens: number
  total_tokens?: number
  input_tokens_details?: { image_tokens?: number; text_tokens?: number }
  output_tokens_details?: { image_tokens?: number; text_tokens?: number } | null
}

export interface CallCost {
  imageInTokens: number
  textInTokens: number
  outputTokens: number
  costUsd: number
}

/** Rounds to 1e-6 USD so ledger sums don't drift on float noise. */
export function roundUsd(v: number): number {
  return Math.round(v * 1_000_000) / 1_000_000
}

function priced(imageIn: number, textIn: number, out: number): CallCost {
  return {
    imageInTokens: imageIn,
    textInTokens: textIn,
    outputTokens: out,
    costUsd: roundUsd(
      (imageIn * RATES_PER_1M.imageInput +
        textIn * RATES_PER_1M.textInput +
        out * RATES_PER_1M.imageOutput) /
        1_000_000,
    ),
  }
}

/**
 * Prices a response's `usage`. If the input split is missing, all input is
 * priced at the image rate and all output at the image-output rate: both
 * over-estimate, which is the safe side for a budget with no auto-reload.
 */
export function costFromUsage(usage: ImageUsage): CallCost {
  const d = usage.input_tokens_details
  let imageIn: number
  let textIn: number
  if (
    d &&
    typeof d.image_tokens === 'number' &&
    typeof d.text_tokens === 'number'
  ) {
    imageIn = d.image_tokens
    textIn = d.text_tokens
  } else {
    imageIn = usage.input_tokens
    textIn = 0
  }
  return priced(imageIn, textIn, usage.output_tokens)
}

/**
 * Pre-call estimate for one images.edit call returning `n` images. Input is
 * billed once per call (usage is reported per response); text tokens are
 * approximated as chars / 4, which over-counts English prose (worth well
 * under $0.001 at $5 / 1M).
 */
export function estimateCallCost(n: number, promptChars: number): CallCost {
  return priced(
    MEASURED.anchorImageInputTokens,
    Math.ceil(promptChars / 4),
    n * MEASURED.outputTokensPerImage,
  )
}

export interface LedgerEntry extends CallCost {
  ts: string
  runId: string
  word: string
  batch: number
  model: string
  size: string
  quality: string
  n: number
  usage: ImageUsage
}

export function ledgerLine(entry: LedgerEntry): string {
  return `${JSON.stringify(entry)}\n`
}

/** Sums `costUsd` across a JSONL ledger. Blank lines are skipped; malformed
 *  lines are reported (1-based) and not counted. */
export function sumLedger(text: string): {
  totalUsd: number
  entries: number
  badLines: number[]
} {
  let total = 0
  let entries = 0
  const badLines: number[] = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.trim() === '') return
    try {
      const v = JSON.parse(line) as { costUsd?: unknown }
      if (typeof v.costUsd !== 'number' || !Number.isFinite(v.costUsd)) {
        badLines.push(i + 1)
        return
      }
      total += v.costUsd
      entries++
    } catch {
      badLines.push(i + 1)
    }
  })
  return { totalUsd: roundUsd(total), entries, badLines }
}

/**
 * Budget gate, checked before every call: spent so far (ledger + this run)
 * plus estimates for calls already in flight plus this call's estimate must
 * not exceed the budget. No budget = always allowed.
 */
export function budgetAllows(a: {
  budgetUsd: number | undefined
  spentUsd: number
  reservedUsd: number
  estimateUsd: number
}): boolean {
  if (a.budgetUsd === undefined) return true
  return roundUsd(a.spentUsd + a.reservedUsd + a.estimateUsd) <= a.budgetUsd
}

export function formatUsd(v: number): string {
  return `$${v.toFixed(4)}`
}

// ── Pick ────────────────────────────────────────────────────────────────────

export interface PickRequest {
  word: string
  variant: number
}

/** Parses `hen=v2,sack=v1` (the `v` is optional: `hen=2` works too). */
export function parsePickArg(arg: string): PickRequest[] {
  const parts = arg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0)
    throw new Error('--pick needs word=vN pairs, e.g. hen=v2,sack=v1')
  const seen = new Set<string>()
  return parts.map((p) => {
    const m = /^([a-z0-9][a-z0-9-]*)=v?(\d+)$/.exec(p)
    if (!m) throw new Error(`--pick: "${p}" is not word=vN (e.g. hen=v2)`)
    const word = m[1]
    const variant = Number(m[2])
    if (variant < 1)
      throw new Error(`--pick: "${p}" variant must be v1 or higher`)
    if (seen.has(word)) throw new Error(`--pick: "${word}" is picked twice`)
    seen.add(word)
    return { word, variant }
  })
}

export interface PickCopy {
  word: string
  src: string
  dest: string
}

/** Maps picks to repo-relative copies: openai/batch-N/<word>__vK.png →
 *  transparent-<tier>/picture-<word>.png. Throws on words not in the
 *  manifest. */
export function planPicks(
  picks: PickRequest[],
  manifest: PictureManifestEntry[],
): PickCopy[] {
  const byWord = new Map(manifest.map((e) => [e.word, e]))
  const unknown = picks.filter((p) => !byWord.has(p.word)).map((p) => p.word)
  if (unknown.length > 0) {
    throw new Error(`--pick: not in the manifest: ${unknown.join(', ')}`)
  }
  return picks.map((p) => {
    const e = byWord.get(p.word) as PictureManifestEntry
    return {
      word: p.word,
      src: variantRelPath(e.batch, p.word, p.variant),
      dest: pickDestRelPath(e.tier, p.word),
    }
  })
}

// ── CLI args ────────────────────────────────────────────────────────────────

export type CliCommand =
  | {
      mode: 'generate'
      selection: Selection
      variants: number
      dryRun: boolean
      budgetUsd: number | undefined
      manifestPath: string
    }
  | {
      mode: 'pick'
      picks: PickRequest[]
      dryRun: boolean
      manifestPath: string
    }

export const USAGE = `Usage:
  npx tsx scripts/generatePackPictures.ts --batch N [--variants 2] [--budget USD] [--dry-run]
  npx tsx scripts/generatePackPictures.ts --words a,b [--variants 2] [--budget USD] [--dry-run]
  npx tsx scripts/generatePackPictures.ts --pick word=v2,word=v1 [--dry-run]
Options:
  --manifest PATH   manifest JSON (default ${PATHS.manifest})`

export function parseCli(argv: string[]): CliCommand {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      batch: { type: 'string' },
      words: { type: 'string' },
      variants: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      budget: { type: 'string' },
      pick: { type: 'string' },
      manifest: { type: 'string' },
    },
  })
  const manifestPath = values.manifest ?? PATHS.manifest
  const dryRun = values['dry-run'] === true
  const modes = [values.batch, values.words, values.pick].filter(
    (v) => v !== undefined,
  ).length
  if (modes !== 1) {
    throw new Error('Pass exactly one of --batch, --words or --pick.')
  }

  if (values.pick !== undefined) {
    if (values.variants !== undefined || values.budget !== undefined) {
      throw new Error('--variants and --budget do not apply to --pick.')
    }
    return {
      mode: 'pick',
      picks: parsePickArg(values.pick),
      dryRun,
      manifestPath,
    }
  }

  let selection: Selection
  if (values.batch !== undefined) {
    if (!/^\d+$/.test(values.batch) || Number(values.batch) < 1) {
      throw new Error(
        `--batch must be a positive integer, got "${values.batch}"`,
      )
    }
    selection = { kind: 'batch', batch: Number(values.batch) }
  } else {
    const words = (values.words ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (words.length === 0)
      throw new Error('--words needs a comma-separated list')
    selection = { kind: 'words', words }
  }

  let variants = DEFAULT_VARIANTS
  if (values.variants !== undefined) {
    if (!/^\d+$/.test(values.variants)) {
      throw new Error(`--variants must be an integer, got "${values.variants}"`)
    }
    variants = Number(values.variants)
    if (variants < 1 || variants > MAX_VARIANTS) {
      throw new Error(`--variants must be 1..${MAX_VARIANTS}, got ${variants}`)
    }
  }

  let budgetUsd: number | undefined
  if (values.budget !== undefined) {
    budgetUsd = Number(values.budget)
    if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
      throw new Error(
        `--budget must be a positive USD amount, got "${values.budget}"`,
      )
    }
  }

  return {
    mode: 'generate',
    selection,
    variants,
    dryRun,
    budgetUsd,
    manifestPath,
  }
}

// ── Errors, retry, pool ─────────────────────────────────────────────────────

/** `retry`: transient (429 rate limit, 5xx). `fatal`: every later call would
 *  fail too (bad key, no access, out of credit), so stop the run. `word`:
 *  this word failed (e.g. a 400 on its prompt); carry on with the rest. */
export type ErrorClass = 'retry' | 'fatal' | 'word'

export function classifyApiError(err: unknown): ErrorClass {
  const e = (err ?? {}) as { status?: unknown; code?: unknown }
  const status = typeof e.status === 'number' ? e.status : undefined
  if (status === 429 && e.code === 'insufficient_quota') return 'fatal'
  if (status === 429) return 'retry'
  if (status !== undefined && status >= 500) return 'retry'
  if (status === 401 || status === 403) return 'fatal'
  return 'word'
}

/** Exponential backoff: 2 s, 4 s, 8 s, 16 s (capped at 60 s), or the
 *  server's `retry-after` seconds when it sends one. */
export function backoffMs(attempt: number, retryAfterSec?: number): number {
  if (
    retryAfterSec !== undefined &&
    Number.isFinite(retryAfterSec) &&
    retryAfterSec > 0
  ) {
    return Math.min(60_000, retryAfterSec * 1000)
  }
  return Math.min(60_000, 2000 * 2 ** attempt)
}

/** Reads `retry-after` (seconds) from an SDK APIError's headers, if any. */
export function retryAfterSeconds(err: unknown): number | undefined {
  const h = (err as { headers?: unknown } | null)?.headers
  if (!h || typeof (h as Headers).get !== 'function') return undefined
  const raw = (h as Headers).get('retry-after')
  if (raw === null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    maxRetries: number
    sleep: (ms: number) => Promise<void>
    onRetry?: (attempt: number, delayMs: number, err: unknown) => void
  },
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= opts.maxRetries || classifyApiError(err) !== 'retry')
        throw err
      const delay = backoffMs(attempt, retryAfterSeconds(err))
      opts.onRetry?.(attempt + 1, delay, err)
      await opts.sleep(delay)
    }
  }
}

/** Runs `worker` over `items` with at most `limit` in flight. */
export async function runPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0
  const lanes = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++
        await worker(items[i], i)
      }
    },
  )
  await Promise.all(lanes)
}
