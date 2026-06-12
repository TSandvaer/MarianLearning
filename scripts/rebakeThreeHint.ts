/**
 * THREE-HINT canon re-bake — Wave 12, ticket 86ca8704f (W12-04).
 *
 * Why this exists (vs. revoiceCanonTargeted.ts)
 * ---------------------------------------------
 * `revoiceCanonTargeted.ts` re-renders the audio of utterances that ALREADY
 * exist, in place — same ids, same text, new bytes. W12-04 is a different
 * shape: each math problem's single legacy `math.p<N>.hint` is REPLACED by
 * three escalating sub-step utterances `math.p<N>.hint1/hint2/hint3`. So this
 * script ADDS three ids + audio and REMOVES one — in BOTH the audio-side
 * `utterances[]` array AND the opaque `plan.utterances[]` skeleton (each canon
 * file carries hint ids in both; a file goes 59 -> 65 entries per array).
 *
 * Deterministic derivation (no re-planning — byte-preservation + billing)
 * ----------------------------------------------------------------------
 * The new hint TEXT is derived DETERMINISTICALLY from each problem's existing
 * `read` line (the operand words) + the W12-03 directive's per-tier hint1/2/3
 * templates (api/_planner.ts PER-PROBLEM SHAPE blocks). We do NOT re-run the
 * Haiku planner — a re-plan regenerates every text and breaches byte
 * preservation. Operand WORDS are lifted verbatim from the read line so the
 * spelling/hyphenation exactly matches the planner's own output.
 *
 * Tier scope
 * ----------
 * Only the 6 tiers with a deterministic operand->template mapping are
 * supported here (DERIVABLE_TIERS). The 5 generic tiers (number-recog,
 * skip-counting, mult-*) have bespoke scaffold prose with no per-operand
 * template; they are deliberately NOT handled by this script (Dave authors
 * deterministic templates for them in a follow-up; this script's TIER_RULES
 * table extends to cover them once those templates land).
 *
 * Audio rendering
 * ---------------
 * Each new hint clip is rendered through the SAME `renderSessionAudio` the
 * handler uses, with the math production tierFilter (undefined). Every
 * NON-hint utterance is left byte-for-byte untouched. The companion
 * `verifyThreeHintBytePreservation.ts` proves that post-write.
 *
 * Run: `npx tsx scripts/rebakeThreeHint.ts`           (renders + writes)
 *      `npx tsx scripts/rebakeThreeHint.ts --dry`     (prints derived text,
 *                                                       NO Azure calls)
 *      `npx tsx scripts/rebakeThreeHint.ts --tiers add-to-10,sub-to-10`
 * Reads `.env.local` for AZURE_SPEECH_KEY / AZURE_SPEECH_REGION.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSessionAudio } from '../api/_session.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MATH_CANON_DIR = join(REPO_ROOT, 'public/canon/math/level-1')

// ── .env.local loader (mirrors revoiceCanonTargeted.ts) ─────────────────
function loadEnvLocal(): void {
  const path = join(REPO_ROOT, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

// ── number-word value table (mirrors planFromServer.ts NUMBER_WORDS) ─────
// Used ONLY for the singular/plural decision (operand-A === 1). The hint
// TEXT uses the operand WORDS lifted verbatim from the read line, never a
// re-spelling, so this table is decision-logic only.
const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

function wordToNumber(word: string): number | undefined {
  const w = word.toLowerCase()
  const direct = NUMBER_WORDS[w]
  if (direct !== undefined) return direct
  const dash = w.indexOf('-')
  if (dash < 0) return undefined
  const decade = NUMBER_WORDS[w.slice(0, dash)]
  const unit = NUMBER_WORDS[w.slice(dash + 1)]
  if (decade === undefined || unit === undefined) return undefined
  if (decade < 20 || decade > 90 || decade % 10 !== 0) return undefined
  if (unit < 1 || unit > 9) return undefined
  return decade + unit
}

const capitalize = (w: string): string =>
  w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)
const lower = (w: string): string => w.toLowerCase()

// ── read-line operand extraction (raw WORD tokens, verbatim spelling) ────
interface Operands {
  aWord: string // operand-A word, as spelled in the read line
  bWord: string // operand-B word, as spelled in the read line
  op: '+' | '-'
}

/** Pull the two operand word-tokens + op from a math read line. Mirrors the
 *  three production templates in planFromServer.ts:parseReadOperands but
 *  returns the raw WORD tokens (not numeric values) so the derived hint text
 *  reproduces the planner's exact spelling/hyphenation. Throws on any tier
 *  whose read line isn't an addition/subtraction two-operand template — that
 *  is the deliberate guard against running this on the 5 generic tiers. */
function extractOperands(read: string): Operands {
  const add = read.match(
    /^\s*([a-z-]+)\s+plus\s+([a-z-]+)\s*\.\s*how\s+many\s*\?\s*$/i,
  )
  if (add) return { aWord: add[1]!, bWord: add[2]!, op: '+' }
  const minus = read.match(
    /^\s*([a-z-]+)\s+minus\s+([a-z-]+)\s*\.\s*how\s+many\s+are\s+left\s*\?\s*$/i,
  )
  if (minus) return { aWord: minus[1]!, bWord: minus[2]!, op: '-' }
  const takeAway = read.match(
    /^\s*([a-z-]+)\s+take\s+away\s+([a-z-]+)\s*\.\s*how\s+many\s+are\s+left\s*\?\s*$/i,
  )
  if (takeAway) return { aWord: takeAway[1]!, bWord: takeAway[2]!, op: '-' }
  throw new Error(
    `read line "${read}" is not a two-operand add/sub template — this tier ` +
      `is not deterministically derivable and must not be run through this script`,
  )
}

// ── per-tier hint1/2/3 templates (faithful to W12-03 directive) ──────────
type HintTriple = { hint1: string; hint2: string; hint3: string }
type TierStyle = 'flowers' | 'place-value'
interface TierRule {
  style: TierStyle
}

/** The 6 deterministically-derivable tiers + their hint style.
 *  - 'flowers'      → add-to-10/20 + sub-to-10/20: hint1 "Look at the
 *                     flowers.", hint2 "<A> flower(s).", hint3 op-specific.
 *  - 'place-value'  → two-digit-addsub(+with-regroup): hint1 "Look.",
 *                     hint2 "<A>." (no flowers), hint3 op-specific. */
const TIER_RULES: Record<string, TierRule> = {
  'add-to-10': { style: 'flowers' },
  'add-to-20': { style: 'flowers' },
  'sub-to-10': { style: 'flowers' },
  'sub-to-20': { style: 'flowers' },
  'two-digit-addsub': { style: 'place-value' },
  'two-digit-addsub-with-regroup': { style: 'place-value' },
}
const DERIVABLE_TIERS = Object.keys(TIER_RULES)

/** Derive the three hint utterance texts for one problem. */
function deriveHints(read: string, rule: TierRule): HintTriple {
  const { aWord, bWord, op } = extractOperands(read)
  const aValue = wordToNumber(aWord)
  if (aValue === undefined) {
    throw new Error(`could not decode operand-A word "${aWord}" in "${read}"`)
  }

  // hint3 is op-specific and shared across both styles.
  const hint3 =
    op === '+'
      ? `And ${lower(bWord)} more. How many now?`
      : `Take away ${lower(bWord)}. How many now?`

  if (rule.style === 'flowers') {
    // Singular noun when operand-A is exactly 1 (Devon NIT-1 rule).
    const noun = aValue === 1 ? 'flower' : 'flowers'
    return {
      hint1: 'Look at the flowers.',
      hint2: `${capitalize(aWord)} ${noun}.`,
      hint3,
    }
  }
  // place-value (two-digit): no "flowers" wording — name the operand alone.
  return {
    hint1: 'Look.',
    hint2: `${capitalize(aWord)}.`,
    hint3,
  }
}

// ── canon file shapes ────────────────────────────────────────────────────
interface SkeletonUtterance {
  id: string
  text: string
}
interface AudioUtterance {
  id: string
  text: string
  audio: { kind: string; base64: string; mime: string }
}
interface CanonFile {
  ok: boolean
  kind: string
  plan: { id: string; label: string; utterances: SkeletonUtterance[] }
  utterances: AudioUtterance[]
}

interface PlannedChange {
  problemIndex: number
  read: string
  legacyHintId: string
  triple: HintTriple
}

function planTierChanges(canon: CanonFile, rule: TierRule): PlannedChange[] {
  const byId = new Map(canon.utterances.map((u) => [u.id, u]))
  const changes: PlannedChange[] = []
  for (let n = 1; n <= 8; n++) {
    const read = byId.get(`math.p${n}.read`)?.text
    if (read === undefined) {
      throw new Error(`missing math.p${n}.read`)
    }
    const legacyHintId = `math.p${n}.hint`
    if (!byId.has(legacyHintId)) {
      throw new Error(`missing legacy ${legacyHintId} — already re-baked?`)
    }
    changes.push({
      problemIndex: n,
      read,
      legacyHintId,
      triple: deriveHints(read, rule),
    })
  }
  return changes
}

/**
 * Rewrite one canon file in place: for every problem, remove the legacy
 * `math.p<N>.hint` and insert `hint1/hint2/hint3` (with freshly-rendered
 * audio) at the legacy slot's position, in BOTH the audio-side `utterances[]`
 * and the `plan.utterances[]` skeleton. Every other utterance is untouched.
 */
function applyTierChanges(
  canon: CanonFile,
  changes: PlannedChange[],
  renderedAudio: Map<string, AudioUtterance['audio']>,
): void {
  // 1. Audio-side utterances[] — splice at the legacy hint position.
  canon.utterances = spliceArray(canon.utterances, changes, (c) => [
    {
      id: `math.p${c.problemIndex}.hint1`,
      text: c.triple.hint1,
      audio: requireAudio(renderedAudio, `math.p${c.problemIndex}.hint1`),
    },
    {
      id: `math.p${c.problemIndex}.hint2`,
      text: c.triple.hint2,
      audio: requireAudio(renderedAudio, `math.p${c.problemIndex}.hint2`),
    },
    {
      id: `math.p${c.problemIndex}.hint3`,
      text: c.triple.hint3,
      audio: requireAudio(renderedAudio, `math.p${c.problemIndex}.hint3`),
    },
  ])

  // 2. Opaque plan.utterances[] skeleton — same splice, text-only (no audio).
  canon.plan.utterances = spliceArray(canon.plan.utterances, changes, (c) => [
    { id: `math.p${c.problemIndex}.hint1`, text: c.triple.hint1 },
    { id: `math.p${c.problemIndex}.hint2`, text: c.triple.hint2 },
    { id: `math.p${c.problemIndex}.hint3`, text: c.triple.hint3 },
  ])
}

function requireAudio(
  rendered: Map<string, AudioUtterance['audio']>,
  id: string,
): AudioUtterance['audio'] {
  const a = rendered.get(id)
  if (!a) throw new Error(`no rendered audio for ${id}`)
  return a
}

/** Generic in-place splice: replace each change's legacy hint entry with the
 *  entries returned by `make(change)`, preserving array order and every other
 *  element by reference. */
function spliceArray<T extends { id: string }>(
  arr: T[],
  changes: PlannedChange[],
  make: (c: PlannedChange) => T[],
): T[] {
  const replacements = new Map(changes.map((c) => [c.legacyHintId, make(c)]))
  const out: T[] = []
  for (const item of arr) {
    const repl = replacements.get(item.id)
    if (repl) out.push(...repl)
    else out.push(item)
  }
  return out
}

function resolveTiers(argv: readonly string[]): string[] {
  const eqArg = argv.find((a) => a.startsWith('--tiers='))
  let raw: string | undefined = eqArg?.slice('--tiers='.length)
  if (raw === undefined) {
    const idx = argv.indexOf('--tiers')
    if (idx >= 0 && idx + 1 < argv.length) raw = argv[idx + 1]
  }
  if (raw === undefined) return DERIVABLE_TIERS
  const tiers = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const t of tiers) {
    if (!TIER_RULES[t]) {
      console.error(
        `ERROR: tier "${t}" is not deterministically derivable ` +
          `(supported: ${DERIVABLE_TIERS.join(', ')})`,
      )
      process.exit(1)
    }
  }
  return tiers
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry')
  const tiers = resolveTiers(process.argv)
  loadEnvLocal()
  if (
    !dryRun &&
    (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION)
  ) {
    console.error(
      'ERROR: AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set (.env.local). ' +
        'Run with --dry to preview derivation without rendering.',
    )
    process.exit(1)
  }

  let totalNewClips = 0
  for (const tier of tiers) {
    const path = join(MATH_CANON_DIR, `${tier}.json`)
    const canon = JSON.parse(readFileSync(path, 'utf8')) as CanonFile
    const rule = TIER_RULES[tier]!
    const changes = planTierChanges(canon, rule)

    console.log(`\n=== ${tier} ===`)
    for (const c of changes) {
      console.log(`  P${c.problemIndex} read: ${c.read}`)
      console.log(`    hint1: ${c.triple.hint1}`)
      console.log(`    hint2: ${c.triple.hint2}`)
      console.log(`    hint3: ${c.triple.hint3}`)
    }

    if (dryRun) {
      totalNewClips += changes.length * 3
      continue
    }

    // Render the 24 new hint clips (8 problems × 3) through the production
    // pipeline (math tierFilter = undefined).
    const renderPlan = {
      id: canon.plan.id,
      label: canon.plan.label,
      utterances: changes.flatMap((c) => [
        { id: `math.p${c.problemIndex}.hint1`, text: c.triple.hint1 },
        { id: `math.p${c.problemIndex}.hint2`, text: c.triple.hint2 },
        { id: `math.p${c.problemIndex}.hint3`, text: c.triple.hint3 },
      ]),
    }
    process.stdout.write(
      `  rendering ${renderPlan.utterances.length} hint clips ... `,
    )
    const response = await renderSessionAudio(renderPlan, {
      tierFilter: undefined,
    })
    if (response.utterances.length !== renderPlan.utterances.length) {
      throw new Error(
        `partial render: ${response.utterances.length}/${renderPlan.utterances.length} for ${tier} (NOT writing)`,
      )
    }
    const renderedAudio = new Map<string, AudioUtterance['audio']>()
    for (const u of response.utterances) {
      renderedAudio.set(u.id, u.audio as AudioUtterance['audio'])
    }

    applyTierChanges(canon, changes, renderedAudio)

    // Sanity: no legacy hint id survives; exactly 3 hint ids per problem.
    assertHintShape(canon)

    writeFileSync(path, JSON.stringify(canon), 'utf8')
    totalNewClips += response.utterances.length
    console.log(`ok (${response.utterances.length} clips, legacy hint removed)`)
  }

  console.log(
    `\nDone. ${dryRun ? '[--dry] would create' : 'created'} ${totalNewClips} ` +
      `hint clips across ${tiers.length} tier(s).`,
  )
}

/** Post-write structural assertion: every problem carries exactly hint1/2/3
 *  and NO legacy `math.p<N>.hint`, in BOTH arrays. */
function assertHintShape(canon: CanonFile): void {
  for (const arrName of ['utterances', 'plan.utterances'] as const) {
    const arr =
      arrName === 'utterances' ? canon.utterances : canon.plan.utterances
    const ids = new Set(arr.map((u) => u.id))
    for (let n = 1; n <= 8; n++) {
      if (ids.has(`math.p${n}.hint`)) {
        throw new Error(`legacy math.p${n}.hint still present in ${arrName}`)
      }
      for (const suffix of ['hint1', 'hint2', 'hint3']) {
        if (!ids.has(`math.p${n}.${suffix}`)) {
          throw new Error(`missing math.p${n}.${suffix} in ${arrName}`)
        }
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
