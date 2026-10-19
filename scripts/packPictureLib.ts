/**
 * Pure helpers for `scripts/generatePackPictures.ts` (Word Song pack pictures
 * and, with `--scenes`, the little-story scenes, via OpenAI
 * gpt-image-2.5-flare). No file system, no network: everything here is
 * unit-tested in `packPictureLib.test.ts`.
 *
 * Covers: manifest parse/validation + selection, prompt building, CLI args,
 * spend math (usage → USD, dry-run estimate, ledger sum, budget gate), the
 * `--pick` copy plan, error classification + backoff, and a bounded pool.
 */

import { parseArgs } from 'node:util'
import { APIConnectionError, APIConnectionTimeoutError } from 'openai'

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
  // --scenes (content-wave-3.md § 6): its own manifest, variants and ledger,
  // so --budget caps the scene spend alone (the pack ledger already holds
  // the pack's spend).
  sceneManifest: 'design/word-song/scene-manifest.json',
  sceneOutRoot: 'design/references/picture-pack/openai/scenes',
  sceneLedger:
    'design/references/picture-pack/openai/scenes/spend-ledger.jsonl',
  scenes: 'mobile/assets/scenes',
} as const

/** A row's look: the pack's picture-book style, or the Hub's clay
 *  (quality bar 13), e.g. the learner avatars (learner-profiles.md § 9). */
export type PictureStyle = 'pack' | 'clay'

/** Clay style anchors: committed path art (no gitignored copy needed), three
 *  clay animals with faces, none of them one of the 8 avatar animals. */
export const CLAY_ANCHORS = [
  'public/assets/path/cvc-words-short-o-512.webp',
  'public/assets/path/cvc-words-short-i-512.webp',
  'public/assets/path/bee-words-512.webp',
] as const

export function anchorRelPaths(style: PictureStyle = 'pack'): string[] {
  if (style === 'clay') return [...CLAY_ANCHORS]
  return ANCHOR_WORDS.map((w) => `${PATHS.anchorsDir}/anchor-${w}.png`)
}

/** `outRoot` is PATHS.outRoot for the pack, PATHS.sceneOutRoot for scenes. */
export function batchDirRel(
  batch: number,
  outRoot: string = PATHS.outRoot,
): string {
  return `${outRoot}/batch-${batch}`
}

export function variantRelPath(
  batch: number,
  word: string,
  k: number,
  outRoot: string = PATHS.outRoot,
): string {
  return `${batchDirRel(batch, outRoot)}/${word}__v${k}.png`
}

export function contactSheetRelPath(
  batch: number,
  outRoot: string = PATHS.outRoot,
): string {
  return `${batchDirRel(batch, outRoot)}/contact-sheet.png`
}

export function currentPictureRelPath(word: string): string {
  return `${PATHS.currentPictures}/${word}.webp`
}

/** Destination the existing embed pipeline reads (scripts/embed-pictures.ts). */
export function pickDestRelPath(tier: string, word: string): string {
  return `${PATHS.packRoot}/transparent-${tier}/picture-${word}.png`
}

/** Pack picture size: every shipped pack PNG-in-SVG embeds a 500x500 PNG,
 *  and neither embed-pictures.ts nor mobile's export-assets.mjs resizes. */
export const PACK_PICTURE_PX = 500

/** A picked scene: an opaque 600 px WebP the app shows as is
 *  (content-wave-3.md § 4.2, § 6). */
export const SCENE_PICTURE_PX = 600

export function sceneDestRelPath(scene: string): string {
  return `${PATHS.scenes}/story-${scene}.webp`
}

/** Variant indices already on disk for `word`, ascending, from a listing of
 *  its batch dir. */
export function variantsOnDisk(
  fileNames: readonly string[],
  word: string,
): number[] {
  const prefix = `${word}__v`
  return fileNames
    .filter((f) => f.startsWith(prefix) && f.endsWith('.png'))
    .map((f) => f.slice(prefix.length, -'.png'.length))
    .filter((k) => /^\d+$/.test(k))
    .map(Number)
    .filter((k) => k >= 1)
    .sort((a, b) => a - b)
}

// ── Manifest ────────────────────────────────────────────────────────────────

/** One row of design/word-song/picture-manifest.json. `word` is the picture
 *  key and the file stem. `style` is absent for the pack's own rows. */
export interface PictureManifestEntry {
  word: string
  tier: string
  batch: number
  subject: string
  avoid: string[]
  distinctFrom: string[]
  style?: 'clay'
}

/** Lower-case slug: safe as a file stem and a directory suffix. */
const SLUG = /^[a-z0-9][a-z0-9-]*$/

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string')
}

/**
 * Validates the rows both manifests share (`<key>`, tier, batch, subject,
 * avoid) plus `check`'s extra fields. Collects every problem and throws one
 * error listing them all, so a broken manifest is fixed in one pass. Unknown
 * extra keys are ignored (forward-compatible with manifest additions).
 */
function parseRows<T>(
  raw: unknown,
  key: 'word' | 'scene',
  check: (r: Record<string, unknown>, label: string) => string[],
  build: (r: Record<string, unknown>) => T,
): T[] {
  if (!Array.isArray(raw)) {
    throw new Error('Manifest must be a JSON array of entries.')
  }
  const errors: string[] = []
  const entries: T[] = []
  const seen = new Set<string>()

  raw.forEach((item: unknown, i) => {
    const at = `entry ${i}`
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      errors.push(`${at}: must be an object`)
      return
    }
    const r = item as Record<string, unknown>
    const id = r[key]
    const label = typeof id === 'string' && id ? `${at} ("${id}")` : at
    const before = errors.length

    if (typeof id !== 'string' || !SLUG.test(id)) {
      errors.push(
        `${label}: "${key}" must be a lower-case slug (a-z, 0-9, -), got ${JSON.stringify(id)}`,
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
    errors.push(...check(r, label))
    if (typeof id === 'string' && SLUG.test(id)) {
      if (seen.has(id)) errors.push(`${label}: duplicate ${key}`)
      seen.add(id)
    }
    if (errors.length > before) return

    entries.push(build(r))
  })

  if (errors.length > 0) {
    throw new Error(
      `Manifest has ${errors.length} problem(s):\n  - ${errors.join('\n  - ')}`,
    )
  }
  if (entries.length === 0) throw new Error('Manifest is empty.')
  return entries
}

function trimmedList(v: unknown): string[] {
  return (v as string[]).map((s) => s.trim()).filter(Boolean)
}

/** Validates the parsed design/word-song/picture-manifest.json. */
export function parseManifest(raw: unknown): PictureManifestEntry[] {
  return parseRows(
    raw,
    'word',
    (r, label) => [
      ...(isStringArray(r.distinctFrom)
        ? []
        : [`${label}: "distinctFrom" must be an array of strings`]),
      ...(r.style === undefined || r.style === 'clay'
        ? []
        : [
            `${label}: "style" must be "clay" or absent, got ${JSON.stringify(r.style)}`,
          ]),
    ],
    (r) => ({
      word: r.word as string,
      tier: r.tier as string,
      batch: r.batch as number,
      subject: (r.subject as string).trim(),
      avoid: trimmedList(r.avoid),
      distinctFrom: r.distinctFrom as string[],
      ...(r.style === 'clay' ? { style: 'clay' as const } : {}),
    }),
  )
}

export function styleOf(
  entry: Pick<PictureManifestEntry, 'style'>,
): PictureStyle {
  return entry.style ?? 'pack'
}

/** One row of design/word-song/scene-manifest.json (content-wave-3.md § 6).
 *  `scene` is the story id ('fox-1'), `refs` the pack words whose chip
 *  pictures go in as references, in the order the subject names them. */
export interface SceneManifestEntry {
  scene: string
  tier: string
  batch: number
  subject: string
  avoid: string[]
  refs: string[]
}

/** The images API takes 16 input images; the spec caps refs at 4. */
export const MAX_SCENE_REFS = 4

/** Validates the parsed design/word-song/scene-manifest.json. */
export function parseSceneManifest(raw: unknown): SceneManifestEntry[] {
  return parseRows(
    raw,
    'scene',
    (r, label) => {
      const refs = r.refs
      if (
        !isStringArray(refs) ||
        refs.length === 0 ||
        refs.length > MAX_SCENE_REFS ||
        !refs.every((w) => SLUG.test(w))
      ) {
        return [
          `${label}: "refs" must be 1-${MAX_SCENE_REFS} pack words (lower-case slugs), got ${JSON.stringify(refs)}`,
        ]
      }
      return new Set(refs).size === refs.length
        ? []
        : [`${label}: "refs" names a word twice`]
    },
    (r) => ({
      scene: r.scene as string,
      tier: r.tier as string,
      batch: r.batch as number,
      subject: (r.subject as string).trim(),
      avoid: trimmedList(r.avoid),
      refs: r.refs as string[],
    }),
  )
}

/** `all` is the bare `--scenes` run: every scene in the manifest. */
export type Selection =
  | { kind: 'batch'; batch: number }
  | { kind: 'words'; words: string[] }
  | { kind: 'all' }

/** Picks the rows to generate, in manifest order for a batch (or all) and in
 *  the requested order for `--words`. Throws on an empty batch or unknown
 *  keys. */
export function selectRows<T extends { batch: number }>(
  rows: readonly T[],
  sel: Selection,
  keyOf: (row: T) => string,
): T[] {
  if (sel.kind === 'all') return [...rows]
  if (sel.kind === 'batch') {
    const picked = rows.filter((e) => e.batch === sel.batch)
    if (picked.length === 0) {
      const batches = [...new Set(rows.map((e) => e.batch))].sort(
        (a, b) => a - b,
      )
      throw new Error(
        `No manifest entries in batch ${sel.batch}. Batches present: ${batches.join(', ')}`,
      )
    }
    return picked
  }
  const byKey = new Map(rows.map((e) => [keyOf(e), e]))
  const unknown = sel.words.filter((w) => !byKey.has(w))
  if (unknown.length > 0) {
    throw new Error(`Not in the manifest: ${unknown.join(', ')}`)
  }
  return [...new Set(sel.words)].map((w) => byKey.get(w) as T)
}

export function selectEntries(
  manifest: PictureManifestEntry[],
  sel: Selection,
): PictureManifestEntry[] {
  return selectRows(manifest, sel, (e) => e.word)
}

// ── Prompt ──────────────────────────────────────────────────────────────────

/**
 * The bake-off STYLE prompt, restructured so the manifest's one-sentence
 * `subject` stands as its own sentence ("Subject: … Draw this subject …").
 */
const STYLE_BODY =
  "Draw this subject as a single children's picture-book illustration in exactly the same art " +
  'style as the reference pictures: the same soft line weight, the same flat soft colours and ' +
  'gentle cel-shading, the same simplicity and finish.'

export const STYLE_INSTRUCTION = `${STYLE_BODY} The references show the style only; do not copy their subjects.`

/** The clay form (quality bar 13, the Hub's path art). The contact shadow
 *  bar 13 names is drawn in code, so PACK_RULES' "no drop shadow" stands. */
export const CLAY_STYLE_INSTRUCTION =
  'Draw this subject as a single glossy soft-clay, vinyl-toy 3D figure in exactly the same style ' +
  'as the reference pictures: the same chunky rounded forms, warm saturated colours, soft light ' +
  'from the top left and subtle gloss, the same simplicity and finish. The references show the ' +
  'style only; do not copy their subjects.'

/**
 * The scene form of STYLE_INSTRUCTION. A scene call sends the anchors first
 * and then each `refs` chip picture, which SCENE_RULES asks the model to
 * copy, so "show the style only" is scoped to the anchors; otherwise the
 * prompt would say both "do not copy" and "draw like" of the same images.
 */
export const SCENE_STYLE_INSTRUCTION =
  `${STYLE_BODY} The first ${ANCHOR_WORDS.length} reference pictures show the style only; do not ` +
  'copy their subjects. The other reference pictures show the characters and objects of this scene.'

/** Scene rules, verbatim from content-wave-3.md § 6. */
export const SCENE_RULES =
  'Show exactly the characters and objects named, each drawn like its reference picture, in one ' +
  'simple scene on a soft cream background that fills the square. Nothing else: no other ' +
  'animals, people or objects, no text or letters, no faces on objects.'

/**
 * Pack-wide rules every prompt carries (picture-manifest.md § "Assumed in the
 * script, not repeated per word", from picture-pack-style-anchor.md § 3.7):
 * one subject, no scene, no text or letters, no faces on objects, no drop
 * shadow. The background is transparent (`background: "transparent"`), not
 * the bake-off's cream. "One subject" is phrased as "only the subject" so a
 * two-figure subject (dad) isn't read as "draw one person".
 */
export const PACK_RULES =
  'Show only the subject, with no other objects, people or animals, centred and filling about ' +
  '70% of a square frame, on a fully transparent background. No scene, no ground, no drop ' +
  'shadow, no border, no text or letters, and no faces on objects.'

/** Trims, capitalises the first letter and ends with a full stop if the text
 *  has no closing punctuation. The manifest contract is one sentence; a bare
 *  noun phrase works too. */
export function asSentence(text: string): string {
  const t = text.trim()
  if (t === '') return t
  const capped = `${t.charAt(0).toUpperCase()}${t.slice(1)}`
  return /[.!?]$/.test(capped) ? capped : `${capped}.`
}

export function buildPrompt(
  entry: Pick<PictureManifestEntry, 'subject' | 'avoid' | 'style'>,
): string {
  const parts = [
    `Subject: ${asSentence(entry.subject)}`,
    styleOf(entry) === 'clay' ? CLAY_STYLE_INSTRUCTION : STYLE_INSTRUCTION,
    PACK_RULES,
  ]
  const avoid = entry.avoid.map((s) => s.trim()).filter(Boolean)
  if (avoid.length > 0) parts.push(`Must not look like: ${avoid.join('; ')}.`)
  return parts.join(' ')
}

/** A scene's `avoid` names arrangements to leave out ("the fox wearing the
 *  hat"), so it reads "Do not show", not the pack's "Must not look like". */
export function buildScenePrompt(
  entry: Pick<SceneManifestEntry, 'subject' | 'avoid'>,
): string {
  const parts = [
    `Subject: ${asSentence(entry.subject)}`,
    SCENE_STYLE_INSTRUCTION,
    SCENE_RULES,
  ]
  const avoid = entry.avoid.map((s) => s.trim()).filter(Boolean)
  if (avoid.length > 0) parts.push(`Do not show: ${avoid.join('; ')}.`)
  return parts.join(' ')
}

// ── Spend ───────────────────────────────────────────────────────────────────

/** Published gpt-image-2.5 rates, USD per 1M tokens. */
export const RATES_PER_1M = {
  imageInput: 8,
  textInput: 5,
  imageOutput: 30,
} as const

/** Measured on 2026-10-16: 3 anchors in = 3,072 image tokens (1,024 each);
 *  one 1024x1024 medium image out = 439 tokens. */
export const MEASURED = {
  inputImageTokens: 1024,
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
 * Pre-call estimate for one images.edit call returning `n` images from
 * `inputImages` input images (the 3 anchors, plus a scene's refs). Input
 * images are billed once per image returned: every pack call in the
 * 2026-10-16 ledger (90 calls, n = 2) reports 6,144 image-in tokens for the
 * 3 anchors, twice the n = 1 measurement. Each input image is assumed to cost
 * what a 1024 px anchor did; a scene's refs are 500 px chip pictures, and the
 * ledger records what they really cost. Text input is billed once per image
 * returned too: the cake call's 804-char prompt reports 422 text-in tokens,
 * about 2 x 211. Text tokens per image are approximated as chars / 4.
 */
export function estimateCallCost(
  n: number,
  promptChars: number,
  inputImages: number = ANCHOR_WORDS.length,
): CallCost {
  return priced(
    n * inputImages * MEASURED.inputImageTokens,
    n * Math.ceil(promptChars / 4),
    n * MEASURED.outputTokensPerImage,
  )
}

/** One line of a spend ledger: `word` in the pack's, `scene` in the scenes'. */
export type LedgerEntry = CallCost & {
  ts: string
  runId: string
  batch: number
  model: string
  size: string
  quality: string
  n: number
  usage: ImageUsage
} & ({ word: string } | { scene: string })

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

function lookUpPicks<T>(
  picks: PickRequest[],
  byKey: Map<string, T>,
): (PickRequest & { row: T })[] {
  const unknown = picks.filter((p) => !byKey.has(p.word)).map((p) => p.word)
  if (unknown.length > 0) {
    throw new Error(`--pick: not in the manifest: ${unknown.join(', ')}`)
  }
  return picks.map((p) => ({ ...p, row: byKey.get(p.word) as T }))
}

/** Maps picks to repo-relative copies: openai/batch-N/<word>__vK.png →
 *  transparent-<tier>/picture-<word>.png. Throws on words not in the
 *  manifest. */
export function planPicks(
  picks: PickRequest[],
  manifest: PictureManifestEntry[],
): PickCopy[] {
  const byWord = new Map(manifest.map((e) => [e.word, e]))
  return lookUpPicks(picks, byWord).map((p) => ({
    word: p.word,
    src: variantRelPath(p.row.batch, p.word, p.variant),
    dest: pickDestRelPath(p.row.tier, p.word),
  }))
}

/** Scene picks: openai/scenes/batch-N/<scene>__vK.png →
 *  mobile/assets/scenes/story-<scene>.webp (`word` holds the scene id). */
export function planScenePicks(
  picks: PickRequest[],
  manifest: SceneManifestEntry[],
): PickCopy[] {
  const byScene = new Map(manifest.map((e) => [e.scene, e]))
  return lookUpPicks(picks, byScene).map((p) => ({
    word: p.word,
    src: variantRelPath(p.row.batch, p.word, p.variant, PATHS.sceneOutRoot),
    dest: sceneDestRelPath(p.word),
  }))
}

// ── CLI args ────────────────────────────────────────────────────────────────

/** `scenes`: the little-story scenes (`--scenes`), else the pack. */
export type PictureSet = 'pack' | 'scenes'

export type CliCommand =
  | {
      mode: 'generate'
      set: PictureSet
      selection: Selection
      variants: number
      dryRun: boolean
      budgetUsd: number | undefined
      /** Generate again for words that already have variants on disk (new
       *  variants are numbered after the existing ones; nothing is
       *  overwritten). */
      force: boolean
      manifestPath: string
    }
  | {
      mode: 'pick'
      set: PictureSet
      picks: PickRequest[]
      dryRun: boolean
      manifestPath: string
    }

export const USAGE = `Usage:
  npx tsx scripts/generatePackPictures.ts --batch N [--variants 2] [--budget USD] [--force] [--dry-run]
  npx tsx scripts/generatePackPictures.ts --words a,b [--variants 2] [--budget USD] [--force] [--dry-run]
  npx tsx scripts/generatePackPictures.ts --pick word=v2,word=v1 [--dry-run]
  npx tsx scripts/generatePackPictures.ts --scenes [--batch N | --words fox-1,hen-2] [--variants 2] [--budget USD] [--force] [--dry-run]
  npx tsx scripts/generatePackPictures.ts --scenes --pick fox-1=v2,hen-2=v1 [--dry-run]
Options:
  --scenes          the little-story scenes (${PATHS.sceneManifest});
                    alone, every scene; --words takes scene ids
  --force           also generate words that already have variants on disk
                    (adds v3, v4, ...; never overwrites)
  --manifest PATH   manifest JSON (default ${PATHS.manifest},
                    or ${PATHS.sceneManifest} with --scenes)`

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
      force: { type: 'boolean', default: false },
      budget: { type: 'string' },
      pick: { type: 'string' },
      manifest: { type: 'string' },
      scenes: { type: 'boolean', default: false },
    },
  })
  const set: PictureSet = values.scenes === true ? 'scenes' : 'pack'
  const manifestPath =
    values.manifest ?? (set === 'scenes' ? PATHS.sceneManifest : PATHS.manifest)
  const dryRun = values['dry-run'] === true
  const modes = [values.batch, values.words, values.pick].filter(
    (v) => v !== undefined,
  ).length
  if (set === 'scenes' && modes > 1) {
    throw new Error(
      'With --scenes, pass at most one of --batch, --words or --pick.',
    )
  }
  if (set === 'pack' && modes !== 1) {
    throw new Error('Pass exactly one of --batch, --words or --pick.')
  }

  if (values.pick !== undefined) {
    if (
      values.variants !== undefined ||
      values.budget !== undefined ||
      values.force === true
    ) {
      throw new Error(
        '--variants, --budget and --force do not apply to --pick.',
      )
    }
    return {
      mode: 'pick',
      set,
      picks: parsePickArg(values.pick),
      dryRun,
      manifestPath,
    }
  }

  let selection: Selection
  if (modes === 0) {
    selection = { kind: 'all' }
  } else if (values.batch !== undefined) {
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
    set,
    selection,
    variants,
    dryRun,
    budgetUsd,
    force: values.force === true,
    manifestPath,
  }
}

// ── Errors, retry, pool ─────────────────────────────────────────────────────

/** `retry`: transient (429 rate limit, 5xx, dropped connection). `fatal`:
 *  every later call would fail too (out of credit or over a spend limit, bad
 *  key, no access, unknown model), so stop the run. `word`: this word failed
 *  (e.g. a 400 on its prompt); carry on with the rest. */
export type ErrorClass = 'retry' | 'fatal' | 'word'

/** Billing codes from OpenAI's error-codes guide ("API errors"): a 429 whose
 *  `type` may be `insufficient_quota` while `code` names the cause. */
export const BILLING_ERROR_CODES: ReadonlySet<string> = new Set([
  'insufficient_quota',
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
])

/** True for any billing / credit / quota error, whatever the HTTP status:
 *  a listed code or type, or any code or type that mentions billing, quota,
 *  credit or a spend / usage limit. */
export function isBillingError(err: unknown): boolean {
  const e = (err ?? {}) as { code?: unknown; type?: unknown }
  return [e.code, e.type].some(
    (v) =>
      typeof v === 'string' &&
      (BILLING_ERROR_CODES.has(v) ||
        /billing|quota|credit|spend_limit|usage_limit/i.test(v)),
  )
}

export function classifyApiError(err: unknown): ErrorClass {
  // A timeout may have completed (and billed) server-side: don't pay twice.
  if (err instanceof APIConnectionTimeoutError) return 'word'
  // The request never landed (Wi-Fi blip): safe to retry.
  if (err instanceof APIConnectionError) return 'retry'
  if (isBillingError(err)) return 'fatal'
  const e = (err ?? {}) as { status?: unknown }
  const status = typeof e.status === 'number' ? e.status : undefined
  if (status === 429) return 'retry'
  if (status !== undefined && status >= 500) return 'retry'
  if (status === 401 || status === 403 || status === 404) return 'fatal'
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
