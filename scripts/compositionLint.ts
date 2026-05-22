#!/usr/bin/env tsx
/**
 * Composition-rule-spec lint for baked canon JSON.
 *
 * Mechanically validates the 8-problem set in each canon against per-tier
 * composition rules. Sits alongside `canonLint.ts` (text-encoding hygiene)
 * as a sibling check; the two run in series at bake-time and in CI.
 *
 * Why
 * ---
 * Haiku is a generative model. Even with sharpened directive prose (inline
 * `[BAND/category]` tags, per-rule self-checks, negative anchors), the
 * planner occasionally emits a canon that violates the composition rules
 * — too many doubles, too many HARD-band generals, a missing take-from-10
 * fact in the discriminate tier. PR #244 series surfaced 2 such violations
 * in 2 bakes that Devon caught by hand review. The text-encoding lint
 * (`canonLint.ts`) was clean both times — the bytes were valid, the
 * pedagogy was off.
 *
 * The future-test gap was called out in `planner-and-canon.md` and in
 * `feedback_haiku_directive_sharpening.md` memory pattern #5: a mechanical
 * backstop for the manual verification protocol. This file is that
 * backstop.
 *
 * Scope (current — sub-to-10 + add-to-10)
 * ---------------------------------------
 * Two hard-coded tier rule configs: `SUB_TO_TEN_RULES` (PR #245) and
 * `ADD_TO_TEN_RULES` (this PR). Adding the 2nd tier validates the
 * Approach-A → B migration path: a 3rd tier should now be a contained
 * refactor (a new `<TIER>_RULES` config + a new branch in
 * `resolveTierBinding`). Migrating to a per-tier `composition-rules.json`
 * (Approach B) is the future architecture once a 3rd tier requests rules —
 * two data points are not enough to crystallise the JSON shape.
 *
 * Other tiers (digraphs, cvc-words-short-*, add-to-20) have their own
 * composition rules but are out of scope here. File follow-up tickets
 * when they need backstops.
 *
 * Rules enforced — sub-to-10 (per `design/math/sub-to-10-content.md` §1.1 + §2.3)
 * --------------------------------------------------------------------------------
 *   1. Pool membership — every fact must be one of the 22 (a, b) pairs.
 *   2. Category caps:
 *        doubles-halving ≤ 1
 *        subtract-self   ≤ 1
 *        subtract-zero   ≤ 1
 *        subtract-one    ≤ 1
 *        subtract-two    ≤ 1
 *        take-from-10    ≤ 2  (high-value, relaxed cap)
 *        general         ≤ 2  (HARD cap)
 *   3. Band-by-slot:
 *        P1-P3: EASY only (gentle ramp) — and EASY appears ONLY here.
 *        P4-P8: MEDIUM (P4-P8) + HARD (P5-P8); EASY is FORBIDDEN at P4-P8
 *               (the discriminate tier — gentle-ramp facts undermine
 *                difficulty modulation if dosed in here).
 *        HARD MUST NOT appear at P1-P4. EASY MUST NOT appear at P4-P8.
 *   4. Take-from-10 coverage: ≥ 1 take-from-10 fact MUST appear in P4-P8.
 *   5. No duplicates: no (a, b) pair repeats within the 8-problem set.
 *
 * Rules enforced — add-to-10
 * --------------------------
 * NOTE: there is NO `design/math/add-to-10-content.md` spec and NO
 * structured FACT POOL block in the planner directive (`_planner.ts:921`
 * is one line — sums 3-10, addends 1-9, prefer bridge-through-5 / easy
 * doubles / small near-doubles). The rules below are a pedagogical
 * synthesis of:
 *   - the directive's stated constraints (sums 3-10, addends 1-9),
 *   - the sub-to-10 rule shape (band-by-slot + caps + coverage),
 *   - Marian's diagnostic (April 2026): "Sums to 10, drive automaticity,
 *     100% finger reliance" — sums-to-10 is the highest-leverage category
 *     and gets the same in-discriminate-slot coverage rule that
 *     take-from-10 gets in sub-to-10.
 *   - the post-PR-245 current canon at `public/canon/math/level-1/
 *     add-to-10.json` (validated to pass these rules at the time of this
 *     PR — no canon rebake required).
 *
 *   1. Pool membership — every fact must be one of the 44 ordered pairs
 *      (a, b) with a ≥ 1, b ≥ 1, 3 ≤ a + b ≤ 10. Commutative pairs are
 *      distinct facts (2+3 ≠ 3+2 in the pool) because the read-lines
 *      are spoken differently.
 *   2. Category caps (mutually exclusive — each fact has exactly ONE
 *      category; priority order is sums-to-10 → doubles → plus-one →
 *      near-doubles → general):
 *        doubles      ≤ 2   (3 facts in pool: 2+2, 3+3, 4+4. 5+5 lives
 *                            in sums-to-10 — see priority order.)
 *        plus-one     ≤ 2   (14 facts: min(a,b)==1, a≠b, sum≥3, sum<10.
 *                            1+9 and 9+1 are sums-to-10 instead.)
 *        near-doubles ≤ 3   (6 facts: |a−b|==1, min(a,b)≥2)
 *        sums-to-10   ≤ 2   (9 facts: a+b==10 — the highest-leverage
 *                            category. Includes 1+9 and 9+1 and the 5+5
 *                            anchor — same make-10 mental model.)
 *        general      ≤ 2   (12 facts: HARD cap — everything else)
 *   3. Band-by-slot (by sum):
 *        EASY (sum 3-5):   slots P1-P8 (gentle ramp anchor).
 *        MEDIUM (sum 6-8): slots P4-P8.
 *        HARD (sum 9-10):  slots P5-P8.
 *   4. Sums-to-10 coverage: ≥ 1 sums-to-10 fact MUST appear in P4-P8.
 *      This is the make-10 mental model that bridges to add-to-20.
 *   5. No duplicates: no (a, b) pair repeats within the 8-problem set.
 *      Note: 2+3 and 3+2 are NOT duplicates — they are distinct ordered
 *      pairs with distinct read-line text.
 *
 * Surfaces
 * --------
 *   - **Bake-time gate**: `assertCompositionClean(canonId, plan)` is called
 *     from `generateSessionCanon.ts::bakeOne` AFTER the text-encoding lint
 *     passes. A violation throws `CompositionLintError`, fails the bake
 *     for that combo, and prevents the JSON from reaching disk.
 *
 *   - **CI gate**: `npm run canon:lint:composition` walks every committed
 *     `public/canon/**\/*.json`, picks up sub-to-10, and exits non-zero
 *     on any violation. Chained into `npm run canon:lint` so a single
 *     command runs both lints.
 *
 * What it does NOT do
 * -------------------
 *   - Lint tiers other than sub-to-10. Out of scope — file backlog.
 *   - Extract rules from `_planner.ts` directive prose programmatically.
 *     The directive is for Haiku; the rules in this lint are authored
 *     separately and clearly. Drift between the two is acceptable for
 *     now (the drift-guard tests on the directive prose cover that side).
 *   - Repair violations. The lint REPORTS; cleanup is a re-bake.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { SessionStartResponse } from '../api/_types.js'
import { isSessionStartResponse } from '../api/_types.js'

// ── CanonFileTier (Wave 5 PR B — ticket 86c9y1p99 schema-literal rename) ──
//
// Distinguishes the DISK-TIER identifier (the canon-file basename, e.g.
// `'two-digit-addsub'` mapping to `public/canon/math/level-1/two-digit-addsub.json`)
// from the runtime `SkillNode` literal on the wire (post-PR-#308:
// `'two-digit-addsub-no-regroup'` / `'two-digit-addsub-with-regroup'`).
//
// The dual-identifier surface is documented in
// `.claude/docs/skill-trees-and-content.md` § "Canon-file-name vs
// SkillNode-literal — dual identifier surface". Before this rename, the
// literal `'two-digit-addsub'` in `TierLintBinding` and `CompositionFileFinding`
// was ambiguous — it COULD be read as either a SkillNode (now wrong since
// the union widened) or a canon-file-disk-tier (correct). Devon's NIT on
// PR #307 (ticket 86c9y0xda) flagged the ambiguity.
//
// Resolution (Wave 5 PR B): name the disk-side identifier explicitly. The
// `CanonFileTier` union below is the closed set of canon-file basenames the
// composition lint knows how to bind. It is INDEPENDENT of `SkillNode` —
// today every entry happens to match a canon disk file, and the wire-side
// SkillNode literal is mapped onto a CanonFileTier by `canonFileTierFor`
// in `generateSessionCanon.ts` + `api/_canon.ts`.
export type CanonFileTier =
  | 'sub-to-10'
  | 'add-to-10'
  | 'sub-to-20'
  | 'add-to-20'
  | 'two-digit-addsub'
  | 'two-digit-addsub-with-regroup'

// ── rule kinds + error type ──────────────────────────────────────────────

export type CompositionRule =
  | 'pool-membership'
  | 'category-cap'
  | 'band-by-slot'
  | 'high-leverage-coverage'
  | 'no-duplicates'
  | 'unparseable-problem'
  // two-digit-addsub-only rules (PR A — ticket 86c9xkz9n). Binding is
  // deferred per `testing-and-ci.md §6` split-PR pattern, but the rule
  // literals must be members of CompositionRule so the standalone exported
  // `lintTwoDigitAddsubComposition` typechecks. Sibling tiers never emit
  // these rules; their lint functions only emit the rules above.
  | 'op-mix'
  | 'p1-is-plus'
  | 'dual-exposure'
  | 'diagnostic-coverage'

/**
 * One detected violation against a single problem (or whole-session in the
 * coverage case).
 */
export interface CompositionViolation {
  rule: CompositionRule
  /** 1-indexed problem slot (P1-P8). `null` for whole-session rules
   *  (high-leverage-coverage, certain category-cap cases). */
  problemIndex: number | null
  /** Human-readable detail — what went wrong, with the offending fact. */
  message: string
  /** The fact identifier (e.g. `"10-7"`) when the rule fires against a
   *  specific fact. `null` for whole-session rules. */
  factId: string | null
}

export class CompositionLintError extends Error {
  readonly violations: readonly CompositionViolation[]
  readonly canonId: string
  constructor(canonId: string, violations: readonly CompositionViolation[]) {
    super(
      `Composition lint failed for ${canonId}: ${violations.length} ` +
        `violation(s). First: [${violations[0]!.rule}] ` +
        `${violations[0]!.message}`,
    )
    this.name = 'CompositionLintError'
    this.canonId = canonId
    this.violations = violations
  }
}

// ── number-word parser (utterance text → fact pair) ──────────────────────
//
// Canon utterance text for sub-to-10 is either:
//   "<W> take away <W>. How many are left?"    (first-session)
//   "<W> minus <W>. How many are left?"        (later)
//
// We accept both. Anything else (e.g. addition `"<W> plus <W>. How many?"`)
// is rejected by the parser — sub-to-10 must be subtraction.
//
// Canon utterance text for add-to-10 is:
//   "<W> plus <W>. How many?"
//
// The two parsers are siblings — they share NUMBER_WORDS but have distinct
// templates and distinct exports so a sub-to-10 canon parsed by the
// add-to-10 parser (or vice-versa) returns null and fires
// `unparseable-problem`.

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
}

const RE_TAKE_AWAY =
  /^\s*([a-z]+)\s+take\s+away\s+([a-z]+)\s*\.\s*how\s+many\s+are\s+left\s*\?\s*$/i
const RE_MINUS =
  /^\s*([a-z]+)\s+minus\s+([a-z]+)\s*\.\s*how\s+many\s+are\s+left\s*\?\s*$/i
const RE_PLUS = /^\s*([a-z]+)\s+plus\s+([a-z]+)\s*\.\s*how\s+many\s*\?\s*$/i

export interface ParsedFact {
  a: number
  b: number
}

/**
 * Parse a sub-to-10 read-line into `{ a, b }`. Returns null if the text
 * doesn't match either subtraction template or if a number word is
 * unrecognised. Pure; no I/O.
 *
 * Exported for tests + future tiers that share the parser.
 */
export function parseSubToTenReadLine(text: string): ParsedFact | null {
  const m = RE_TAKE_AWAY.exec(text) ?? RE_MINUS.exec(text)
  if (!m) return null
  const a = NUMBER_WORDS[m[1]!.toLowerCase()]
  const b = NUMBER_WORDS[m[2]!.toLowerCase()]
  if (a === undefined || b === undefined) return null
  return { a, b }
}

/**
 * Parse an add-to-10 read-line into `{ a, b }`. Returns null if the text
 * doesn't match the addition template `"<W> plus <W>. How many?"` or if
 * a number word is unrecognised. Pure; no I/O.
 *
 * Subtraction templates (sub-to-10's "take away" / "minus") return null
 * here — by design — so a sub-to-10 canon mis-routed to this parser
 * fires `unparseable-problem` cleanly.
 */
export function parseAddToTenReadLine(text: string): ParsedFact | null {
  const m = RE_PLUS.exec(text)
  if (!m) return null
  const a = NUMBER_WORDS[m[1]!.toLowerCase()]
  const b = NUMBER_WORDS[m[2]!.toLowerCase()]
  if (a === undefined || b === undefined) return null
  return { a, b }
}

// ── sub-to-10 rule config (hard-coded for first pass) ────────────────────
//
// Per `design/math/sub-to-10-content.md` §1.1. Each fact carries its band
// + category tag. The pool is exhaustive — the planner directive
// (`api/_planner.ts:930`) lists exactly these 22 with inline `[BAND/cat]`
// tags. If the design spec widens the pool, update BOTH the directive and
// this config; the drift-guard test in `compositionLint.test.ts` asserts
// the two stay in sync.
//
// History:
//   16 facts (PR #245, 2026-05-16) — original Dave § "Concrete fact
//     ordering" surface.
//   20 facts (PR #249 spec + this PR's impl, 2026-05-16) — 4 MEDIUM
//     additions (8-1, 7-1, 8-2, 6-2) per Dave's wrong-op delivery research
//     to bring in-range wrong-op traps into the MEDIUM band (the original
//     pool had every MEDIUM fact with a+b >= 11, forcing every P4-P8
//     wrong-op attempt to silently downgrade to off-by-one at render time).
//   22 facts (PR #252 spec + this PR's impl, 2026-05-16) — 2 HARD/general
//     additions (7-3, 6-4) per Dave's follow-up paper; both carry a+b=10
//     (the strongest "makes-ten" lure) and same cognitive load as the
//     existing 8-3 / 7-4 facts. Closes the wrong-op coverage cushion that
//     the MEDIUM-only amendment left thin: both HARD IN facts can
//     co-occur in P4-P8 under the `general` cap of 2, structurally
//     guaranteeing >=2 in-range traps even on MEDIUM-light high-score
//     sessions.

export type SubToTenBand = 'EASY' | 'MEDIUM' | 'HARD'

export type SubToTenCategory =
  | 'subtract-self'
  | 'subtract-zero'
  | 'doubles-halving'
  | 'subtract-one'
  | 'subtract-two'
  | 'take-from-10'
  | 'general'

export interface SubToTenPoolFact {
  /** "a-b" string id, e.g. "10-7". Stable across runs. */
  id: string
  a: number
  b: number
  band: SubToTenBand
  category: SubToTenCategory
}

export const SUB_TO_TEN_POOL: readonly SubToTenPoolFact[] = [
  // EASY band (8 facts)
  { id: '5-5', a: 5, b: 5, band: 'EASY', category: 'subtract-self' },
  { id: '8-8', a: 8, b: 8, band: 'EASY', category: 'subtract-self' },
  { id: '7-0', a: 7, b: 0, band: 'EASY', category: 'subtract-zero' },
  { id: '9-0', a: 9, b: 0, band: 'EASY', category: 'subtract-zero' },
  { id: '10-5', a: 10, b: 5, band: 'EASY', category: 'doubles-halving' },
  { id: '8-4', a: 8, b: 4, band: 'EASY', category: 'doubles-halving' },
  { id: '6-3', a: 6, b: 3, band: 'EASY', category: 'doubles-halving' },
  { id: '9-1', a: 9, b: 1, band: 'EASY', category: 'subtract-one' },
  // MEDIUM band (8 facts — post-2026-05-16 amendment per Dave's wrong-op
  // research, `canon-pool-wrong-op-delivery.md`: 4 added facts deliver
  // in-range wrong-op traps that the original 16-fact pool could not.)
  { id: '10-1', a: 10, b: 1, band: 'MEDIUM', category: 'subtract-one' },
  { id: '8-1', a: 8, b: 1, band: 'MEDIUM', category: 'subtract-one' },
  { id: '7-1', a: 7, b: 1, band: 'MEDIUM', category: 'subtract-one' },
  { id: '10-2', a: 10, b: 2, band: 'MEDIUM', category: 'subtract-two' },
  { id: '8-2', a: 8, b: 2, band: 'MEDIUM', category: 'subtract-two' },
  { id: '6-2', a: 6, b: 2, band: 'MEDIUM', category: 'subtract-two' },
  { id: '10-3', a: 10, b: 3, band: 'MEDIUM', category: 'take-from-10' },
  { id: '10-7', a: 10, b: 7, band: 'MEDIUM', category: 'take-from-10' },
  // HARD band (6 facts — post-2026-05-16 amendment per Dave's HARD/general
  // follow-up paper, `canon-pool-wrong-op-delivery-followup-hard-general.md`:
  // 2 added facts (7-3, 6-4) carry the strongest "makes-ten" wrong-op lure
  // and same cognitive load as the existing 8-3 / 7-4 facts.)
  { id: '9-4', a: 9, b: 4, band: 'HARD', category: 'general' },
  { id: '8-3', a: 8, b: 3, band: 'HARD', category: 'general' },
  { id: '7-4', a: 7, b: 4, band: 'HARD', category: 'general' },
  { id: '9-6', a: 9, b: 6, band: 'HARD', category: 'general' },
  { id: '7-3', a: 7, b: 3, band: 'HARD', category: 'general' },
  { id: '6-4', a: 6, b: 4, band: 'HARD', category: 'general' },
] as const

/** Tier rule config — what the lint enforces. Hard-coded for now; will
 *  generalise to per-tier JSON once a 2nd tier needs it. */
export interface SubToTenRulesConfig {
  pool: readonly SubToTenPoolFact[]
  categoryCaps: Record<SubToTenCategory, number>
  /** Slots (1-indexed) where each band is allowed. */
  bandAllowedSlots: Record<SubToTenBand, readonly number[]>
  /** Whole-session minimum count of take-from-10 facts within P4-P8. */
  takeFromTenInP4ToP8Min: number
  totalProblems: number
}

export const SUB_TO_TEN_RULES: SubToTenRulesConfig = {
  pool: SUB_TO_TEN_POOL,
  categoryCaps: {
    'subtract-self': 1,
    'subtract-zero': 1,
    'doubles-halving': 1,
    'subtract-one': 1,
    'subtract-two': 1,
    'take-from-10': 2,
    general: 2,
  },
  bandAllowedSlots: {
    // P1-P3 is the gentle-ramp slot range and the ONLY place EASY
    // facts may appear. The directive prose (`api/_planner.ts` SESSION
    // COMPOSITION RULES rule 3 — "Problems 4-8 (discriminate): draw
    // from MEDIUM + HARD bands") forbids EASY at P4-P8, but PR #245's
    // initial rule allowed EASY at any slot. Dave's audit on PR #247
    // found an undetected EASY-at-P5 violation in a previously-shipped
    // canon that this defense-in-depth tightening would have caught.
    // Tightened in the Dave-NOF-#1 follow-up to enforce P1-P3-only.
    EASY: [1, 2, 3],
    MEDIUM: [4, 5, 6, 7, 8],
    HARD: [5, 6, 7, 8],
  },
  takeFromTenInP4ToP8Min: 1,
  totalProblems: 8,
}

// ── core: lint a SessionStartResponse against sub-to-10 rules ────────────

interface ProblemRow {
  index: number // 1-indexed
  utteranceId: string
  text: string
  parsed: ParsedFact | null
  poolMatch: SubToTenPoolFact | null
}

function extractProblems(
  response: Pick<SessionStartResponse, 'utterances'>,
): ProblemRow[] {
  // `math.p<N>.read` utterances carry the problem text. Sort by N so
  // we always walk P1-P8 in order regardless of array ordering.
  const re = /^math\.p(\d+)\.read$/
  const rows: ProblemRow[] = []
  for (const u of response.utterances) {
    const m = re.exec(u.id)
    if (!m) continue
    const index = Number.parseInt(m[1]!, 10)
    const parsed = parseSubToTenReadLine(u.text)
    const poolMatch = parsed
      ? (SUB_TO_TEN_POOL.find((f) => f.a === parsed.a && f.b === parsed.b) ??
        null)
      : null
    rows.push({
      index,
      utteranceId: u.id,
      text: u.text,
      parsed,
      poolMatch,
    })
  }
  rows.sort((x, y) => x.index - y.index)
  return rows
}

/**
 * Lint a canon's plan against the sub-to-10 composition rules. Returns
 * ALL violations across the 8-problem set — does not stop at the first
 * (so a bake author sees the full picture in one pass).
 *
 * Pure; no I/O.
 */
export function lintSubToTenComposition(
  response: Pick<SessionStartResponse, 'utterances'>,
  config: SubToTenRulesConfig = SUB_TO_TEN_RULES,
): CompositionViolation[] {
  const violations: CompositionViolation[] = []
  const problems = extractProblems(response)

  // ── unparseable / pool-membership pass ──
  for (const p of problems) {
    if (p.parsed === null) {
      violations.push({
        rule: 'unparseable-problem',
        problemIndex: p.index,
        message:
          `P${p.index} (${p.utteranceId}) text does not match the ` +
          `sub-to-10 read templates ("<W> take away <W>. How many are ` +
          `left?" or "<W> minus <W>. How many are left?"): ` +
          JSON.stringify(p.text),
        factId: null,
      })
      continue
    }
    if (p.poolMatch === null) {
      violations.push({
        rule: 'pool-membership',
        problemIndex: p.index,
        message:
          `P${p.index} fact ${p.parsed.a}-${p.parsed.b}=` +
          `${p.parsed.a - p.parsed.b} is NOT in the 22-fact sub-to-10 ` +
          `pool. See design/math/sub-to-10-content.md §1.1.`,
        factId: `${p.parsed.a}-${p.parsed.b}`,
      })
    }
  }

  // From here on, work with rows that successfully matched the pool —
  // the band-by-slot, category-cap, take-from-10, and dedupe checks all
  // depend on the band + category metadata.
  const matched = problems.filter(
    (p): p is ProblemRow & { poolMatch: SubToTenPoolFact } =>
      p.poolMatch !== null,
  )

  // ── band-by-slot pass ──
  for (const p of matched) {
    const allowed = config.bandAllowedSlots[p.poolMatch.band]
    if (!allowed.includes(p.index)) {
      violations.push({
        rule: 'band-by-slot',
        problemIndex: p.index,
        message:
          `P${p.index} carries ${p.poolMatch.band} fact ` +
          `${p.poolMatch.id} (category ${p.poolMatch.category}). ` +
          `${p.poolMatch.band}-band is only allowed at slots ` +
          `[${allowed.join(', ')}].`,
        factId: p.poolMatch.id,
      })
    }
  }

  // ── category-cap pass ──
  type MatchedRow = ProblemRow & { poolMatch: SubToTenPoolFact }
  const categoryCounts: Record<string, MatchedRow[]> = {}
  for (const p of matched) {
    const cat = p.poolMatch.category
    if (!categoryCounts[cat]) categoryCounts[cat] = []
    categoryCounts[cat]!.push(p)
  }
  for (const [cat, rows] of Object.entries(categoryCounts)) {
    const cap = config.categoryCaps[cat as SubToTenCategory]
    if (cap === undefined) continue
    if (rows.length > cap) {
      violations.push({
        rule: 'category-cap',
        problemIndex: null,
        message:
          `Category "${cat}" cap is ${cap}; canon has ${rows.length} ` +
          `(slots P${rows.map((r) => r.index).join(', P')}; facts ` +
          `${rows.map((r) => r.poolMatch.id).join(', ')}).`,
        factId: null,
      })
    }
  }

  // ── take-from-10 coverage pass (≥ 1 in P4-P8) ──
  const takeFromTenInDiscriminate = matched.filter(
    (p) => p.poolMatch.category === 'take-from-10' && p.index >= 4,
  )
  if (takeFromTenInDiscriminate.length < config.takeFromTenInP4ToP8Min) {
    violations.push({
      rule: 'high-leverage-coverage',
      problemIndex: null,
      message:
        `At least ${config.takeFromTenInP4ToP8Min} take-from-10 fact(s) ` +
        `MUST appear in P4-P8 (highest-leverage category — Marian's ` +
        `future add-to-20 make-10 mental model depends on them). ` +
        `Canon has ${takeFromTenInDiscriminate.length}.`,
      factId: null,
    })
  }

  // ── no-duplicates pass ──
  const seen = new Map<string, ProblemRow[]>()
  for (const p of matched) {
    const key = p.poolMatch.id
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(p)
  }
  for (const [factId, rows] of seen.entries()) {
    if (rows.length > 1) {
      violations.push({
        rule: 'no-duplicates',
        problemIndex: null,
        message:
          `Fact ${factId} appears ${rows.length} times ` +
          `(slots P${rows.map((r) => r.index).join(', P')}). ` +
          `No duplicates allowed within the 8-problem set.`,
        factId,
      })
    }
  }

  return violations
}

/**
 * Throwing helper for the bake-time integration point. The throw aborts
 * the bake and stops the (compositionally invalid) JSON from reaching
 * disk.
 *
 * `canonId` is a human-readable identifier (e.g. `"math/sub-to-10"`) used
 * only for the error message — the lint itself doesn't care.
 */
export function assertSubToTenCompositionClean(
  canonId: string,
  response: Pick<SessionStartResponse, 'utterances'>,
  config: SubToTenRulesConfig = SUB_TO_TEN_RULES,
): void {
  const violations = lintSubToTenComposition(response, config)
  if (violations.length > 0) {
    throw new CompositionLintError(canonId, violations)
  }
}

// ── add-to-10 rule config (hard-coded — second tier) ─────────────────────
//
// No `design/math/add-to-10-content.md` spec exists today, and the
// planner directive at `api/_planner.ts:921` is a one-line description
// (sums 3-10, addends 1-9, prefer bridge-through-5 / easy doubles /
// small near-doubles) with NO structured FACT POOL block. Unlike
// sub-to-10, there is therefore no directive-side drift-guard parser
// to run — the pool below is authored fresh from the directive's stated
// constraints + Marian's diagnostic (sums-to-10 is the high-leverage
// category) + the post-PR-245 current canon (validated to pass).
//
// Pool shape: 44 ordered pairs (a, b) with a ≥ 1, b ≥ 1, 3 ≤ a+b ≤ 10.
// Commutative pairs (e.g. 2+3 and 3+2) are DISTINCT facts because the
// read-lines differ — the lint treats them independently. The "no
// duplicates" rule operates on the (a, b) pair id, not on the unordered
// {a, b} set.
//
// Category taxonomy: mutually exclusive (each fact maps to EXACTLY one
// category). Order of precedence when a fact could belong to multiple:
//   sums-to-10  →  doubles  →  plus-one  →  near-doubles  →  general
// In particular:
//   - 5+5 lives in `sums-to-10` (not `doubles`) — it IS a sums-to-10
//     anchor, pedagogically the most valuable doubles fact.
//   - 1+9 and 9+1 live in `sums-to-10` (not `plus-one`) — same
//     reasoning: the make-10 mental model dominates the shape.
// Marian's April diagnostic flags sums-to-10 automaticity as the top
// priority; the taxonomy is built around making sure those facts are
// detected and counted as a single high-leverage bucket.

export type AddToTenBand = 'EASY' | 'MEDIUM' | 'HARD'

export type AddToTenCategory =
  | 'doubles'
  | 'plus-one'
  | 'near-doubles'
  | 'sums-to-10'
  | 'general'

export interface AddToTenPoolFact {
  /** "a+b" string id, e.g. "5+5". Stable across runs. */
  id: string
  a: number
  b: number
  band: AddToTenBand
  category: AddToTenCategory
}

/** Build the canonical 44-fact add-to-10 pool deterministically.
 *
 *  Why a function (vs a hand-written literal like SUB_TO_TEN_POOL):
 *    sub-to-10's pool is 22 facts handpicked by Kyle's content spec, so
 *    a literal is the right shape. add-to-10's pool is the mathematical
 *    closure of (a≥1, b≥1, 3≤a+b≤10), so a programmatic build is both
 *    correct-by-construction AND testable (the pool-sanity tests assert
 *    count 44, unique ids, band counts, category counts). The factory
 *    runs once at module-load and produces a frozen array.
 */
function buildAddToTenPool(): readonly AddToTenPoolFact[] {
  const out: AddToTenPoolFact[] = []
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 9; b++) {
      const sum = a + b
      if (sum < 3 || sum > 10) continue

      // Bands by sum.
      const band: AddToTenBand =
        sum <= 5 ? 'EASY' : sum <= 8 ? 'MEDIUM' : 'HARD'

      // Categories — mutually exclusive, priority-ordered:
      //   1. sums-to-10 (a + b == 10) — includes 5+5 (the anchor)
      //   2. doubles (a == b, sum < 10)
      //   3. plus-one (min == 1, a != b)
      //   4. near-doubles (|a - b| == 1, min >= 2)
      //   5. general (everything else)
      let category: AddToTenCategory
      if (sum === 10) {
        category = 'sums-to-10'
      } else if (a === b) {
        category = 'doubles'
      } else if (a === 1 || b === 1) {
        category = 'plus-one'
      } else if (Math.abs(a - b) === 1) {
        category = 'near-doubles'
      } else {
        category = 'general'
      }

      out.push({ id: `${a}+${b}`, a, b, band, category })
    }
  }
  return Object.freeze(out)
}

export const ADD_TO_TEN_POOL: readonly AddToTenPoolFact[] = buildAddToTenPool()

/** Tier rule config — what the add-to-10 lint enforces. Mirrors
 *  `SubToTenRulesConfig`. Migration to per-tier JSON (Approach B) is
 *  postponed until at least one more tier requests rules — two data
 *  points (sub-to-10, add-to-10) are not enough to crystallise the
 *  JSON shape. */
export interface AddToTenRulesConfig {
  pool: readonly AddToTenPoolFact[]
  categoryCaps: Record<AddToTenCategory, number>
  /** Slots (1-indexed) where each band is allowed. */
  bandAllowedSlots: Record<AddToTenBand, readonly number[]>
  /** Whole-session minimum count of sums-to-10 facts within P4-P8. */
  sumsToTenInP4ToP8Min: number
  totalProblems: number
}

export const ADD_TO_TEN_RULES: AddToTenRulesConfig = {
  pool: ADD_TO_TEN_POOL,
  categoryCaps: {
    doubles: 2,
    'plus-one': 2,
    'near-doubles': 3,
    'sums-to-10': 2,
    general: 2,
  },
  bandAllowedSlots: {
    EASY: [1, 2, 3, 4, 5, 6, 7, 8],
    MEDIUM: [4, 5, 6, 7, 8],
    HARD: [5, 6, 7, 8],
  },
  sumsToTenInP4ToP8Min: 1,
  totalProblems: 8,
}

// ── core: lint a SessionStartResponse against add-to-10 rules ────────────

interface AddProblemRow {
  index: number // 1-indexed
  utteranceId: string
  text: string
  parsed: ParsedFact | null
  poolMatch: AddToTenPoolFact | null
}

function extractAddProblems(
  response: Pick<SessionStartResponse, 'utterances'>,
): AddProblemRow[] {
  const re = /^math\.p(\d+)\.read$/
  const rows: AddProblemRow[] = []
  for (const u of response.utterances) {
    const m = re.exec(u.id)
    if (!m) continue
    const index = Number.parseInt(m[1]!, 10)
    const parsed = parseAddToTenReadLine(u.text)
    const poolMatch = parsed
      ? (ADD_TO_TEN_POOL.find((f) => f.a === parsed.a && f.b === parsed.b) ??
        null)
      : null
    rows.push({
      index,
      utteranceId: u.id,
      text: u.text,
      parsed,
      poolMatch,
    })
  }
  rows.sort((x, y) => x.index - y.index)
  return rows
}

/**
 * Lint a canon's plan against the add-to-10 composition rules. Returns
 * ALL violations across the 8-problem set — does not stop at the first.
 *
 * Pure; no I/O.
 */
export function lintAddToTenComposition(
  response: Pick<SessionStartResponse, 'utterances'>,
  config: AddToTenRulesConfig = ADD_TO_TEN_RULES,
): CompositionViolation[] {
  const violations: CompositionViolation[] = []
  const problems = extractAddProblems(response)

  // ── unparseable / pool-membership pass ──
  for (const p of problems) {
    if (p.parsed === null) {
      violations.push({
        rule: 'unparseable-problem',
        problemIndex: p.index,
        message:
          `P${p.index} (${p.utteranceId}) text does not match the ` +
          `add-to-10 read template ("<W> plus <W>. How many?"): ` +
          JSON.stringify(p.text),
        factId: null,
      })
      continue
    }
    if (p.poolMatch === null) {
      violations.push({
        rule: 'pool-membership',
        problemIndex: p.index,
        message:
          `P${p.index} fact ${p.parsed.a}+${p.parsed.b}=` +
          `${p.parsed.a + p.parsed.b} is NOT in the add-to-10 pool ` +
          `(a≥1, b≥1, 3≤a+b≤10).`,
        factId: `${p.parsed.a}+${p.parsed.b}`,
      })
    }
  }

  const matched = problems.filter(
    (p): p is AddProblemRow & { poolMatch: AddToTenPoolFact } =>
      p.poolMatch !== null,
  )

  // ── band-by-slot pass ──
  for (const p of matched) {
    const allowed = config.bandAllowedSlots[p.poolMatch.band]
    if (!allowed.includes(p.index)) {
      violations.push({
        rule: 'band-by-slot',
        problemIndex: p.index,
        message:
          `P${p.index} carries ${p.poolMatch.band} fact ` +
          `${p.poolMatch.id} (category ${p.poolMatch.category}). ` +
          `${p.poolMatch.band}-band is only allowed at slots ` +
          `[${allowed.join(', ')}].`,
        factId: p.poolMatch.id,
      })
    }
  }

  // ── category-cap pass ──
  type MatchedAddRow = AddProblemRow & { poolMatch: AddToTenPoolFact }
  const categoryCounts: Record<string, MatchedAddRow[]> = {}
  for (const p of matched) {
    const cat = p.poolMatch.category
    if (!categoryCounts[cat]) categoryCounts[cat] = []
    categoryCounts[cat]!.push(p)
  }
  for (const [cat, rows] of Object.entries(categoryCounts)) {
    const cap = config.categoryCaps[cat as AddToTenCategory]
    if (cap === undefined) continue
    if (rows.length > cap) {
      violations.push({
        rule: 'category-cap',
        problemIndex: null,
        message:
          `Category "${cat}" cap is ${cap}; canon has ${rows.length} ` +
          `(slots P${rows.map((r) => r.index).join(', P')}; facts ` +
          `${rows.map((r) => r.poolMatch.id).join(', ')}).`,
        factId: null,
      })
    }
  }

  // ── sums-to-10 coverage pass (≥ 1 in P4-P8) ──
  const sumsToTenInDiscriminate = matched.filter(
    (p) => p.poolMatch.category === 'sums-to-10' && p.index >= 4,
  )
  if (sumsToTenInDiscriminate.length < config.sumsToTenInP4ToP8Min) {
    violations.push({
      rule: 'high-leverage-coverage',
      problemIndex: null,
      message:
        `At least ${config.sumsToTenInP4ToP8Min} sums-to-10 fact(s) ` +
        `MUST appear in P4-P8 (highest-leverage category — Marian's ` +
        `April diagnostic flags sums-to-10 automaticity as the top ` +
        `priority; bridges to add-to-20's make-10 mental model). ` +
        `Canon has ${sumsToTenInDiscriminate.length}.`,
      factId: null,
    })
  }

  // ── no-duplicates pass ──
  const seen = new Map<string, AddProblemRow[]>()
  for (const p of matched) {
    const key = p.poolMatch.id
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(p)
  }
  for (const [factId, rows] of seen.entries()) {
    if (rows.length > 1) {
      violations.push({
        rule: 'no-duplicates',
        problemIndex: null,
        message:
          `Fact ${factId} appears ${rows.length} times ` +
          `(slots P${rows.map((r) => r.index).join(', P')}). ` +
          `No duplicates allowed within the 8-problem set.`,
        factId,
      })
    }
  }

  return violations
}

/**
 * Throwing helper for the bake-time integration point. The throw aborts
 * the bake and stops the (compositionally invalid) JSON from reaching
 * disk.
 *
 * `canonId` is a human-readable identifier (e.g. `"math/add-to-10"`)
 * used only for the error message.
 */
export function assertAddToTenCompositionClean(
  canonId: string,
  response: Pick<SessionStartResponse, 'utterances'>,
  config: AddToTenRulesConfig = ADD_TO_TEN_RULES,
): void {
  const violations = lintAddToTenComposition(response, config)
  if (violations.length > 0) {
    throw new CompositionLintError(canonId, violations)
  }
}

// ── sub-to-20 rule config (third tier — Kyle's PR #269 spec) ─────────────
//
// Per `design/math/sub-to-20-content.md` §1.1. The pool is 22 facts handpicked
// by Kyle from the 45-fact no-borrow teen-minuend single-digit-subtrahend
// surface; bands + categories per Dave's research note § 4.1-4.2.
//
// "No-borrow" definition (strict): ones-digit(minuend) >= subtrahend.
// Every fact below satisfies this; pool results are in [10, 18].
//
// The directive at `api/_planner.ts` sub-to-20 block lists these 22 with
// inline `[BAND/category]` tags + DEC ALIAS/BOUNDARY/CLEAN annotations.
// If the spec widens the pool, update BOTH the directive and this config;
// the drift-guard test in `compositionLint.test.ts` asserts the two stay
// in sync.
//
// NEW vs sub-to-10: Class B (decade-anchor miss) distractor — every pool
// fact carries a DEC value (computed at render time as
// Math.round(correct / 10) * 10). For results in [10, 18], DEC = 10 always
// (Math.round(14/10) = 1 → DEC=10; Math.round(15/10) = 2 → DEC=20 — but
// no pool fact has correct >= 15 with DEC = 20 distinct from correct,
// so effectively DEC = 10 for every pool fact). The Class B coverage
// rule asserts >= 2 CLEAN-annotated facts (separation >=2 from correct,
// not aliasing, not boundary-degenerate) in P4-P8 — the mechanical
// backstop for the "deliver >=2 in-range Class B traps" pool/directive
// posture in spec §2.2.

export type SubToTwentyBand = 'EASY' | 'MEDIUM' | 'HARD'

export type SubToTwentyCategory =
  | 'subtract-one'
  | 'doubles-anchor'
  | 'take-to-decade'
  | 'subtract-two'
  | 'subtract-three'
  | 'general'

/**
 * DEC status — the Class B (decade-anchor miss) trap classification per
 * `design/math/sub-to-20-content.md` §3.3 and the directive's FACT POOL
 * annotation:
 *   - 'ALIAS'    — DEC === correct; Class B downgrades to off-by-one.
 *   - 'BOUNDARY' — Math.abs(DEC - correct) === 1; Class B downgrades.
 *   - 'CLEAN'    — DEC is in-range, distinct, and >=2 separation; usable.
 *
 * The Class-B-coverage rule operates on this field exclusively — it does
 * NOT recompute Math.round(correct / 10) * 10 from the fact's `(a, b)`,
 * because the spec authors that classification per-fact and a render-time
 * recompute would couple the lint to the renderer's exact formula. The
 * field is the contract.
 */
export type SubToTwentyDecStatus = 'ALIAS' | 'BOUNDARY' | 'CLEAN'

export interface SubToTwentyPoolFact {
  /** "a-b" string id, e.g. "16-4". Stable across runs. */
  id: string
  a: number
  b: number
  band: SubToTwentyBand
  category: SubToTwentyCategory
  /** DEC status per spec §3.3 (ALIAS / BOUNDARY / CLEAN). */
  decStatus: SubToTwentyDecStatus
}

export const SUB_TO_TWENTY_POOL: readonly SubToTwentyPoolFact[] = [
  // EASY band (6 facts; P1-P3 only — no Class B fires here)
  {
    id: '11-1',
    a: 11,
    b: 1,
    band: 'EASY',
    category: 'subtract-one',
    decStatus: 'ALIAS',
  },
  {
    id: '12-2',
    a: 12,
    b: 2,
    band: 'EASY',
    category: 'doubles-anchor',
    decStatus: 'ALIAS',
  },
  {
    id: '13-3',
    a: 13,
    b: 3,
    band: 'EASY',
    category: 'take-to-decade',
    decStatus: 'ALIAS',
  },
  {
    id: '12-1',
    a: 12,
    b: 1,
    band: 'EASY',
    category: 'subtract-one',
    decStatus: 'BOUNDARY',
  },
  {
    id: '13-2',
    a: 13,
    b: 2,
    band: 'EASY',
    category: 'subtract-two',
    decStatus: 'BOUNDARY',
  },
  {
    id: '13-1',
    a: 13,
    b: 1,
    band: 'EASY',
    category: 'subtract-one',
    decStatus: 'CLEAN',
  },
  // MEDIUM band (10 facts; P4-P8 eligible)
  {
    id: '14-4',
    a: 14,
    b: 4,
    band: 'MEDIUM',
    category: 'take-to-decade',
    decStatus: 'ALIAS',
  },
  {
    id: '14-3',
    a: 14,
    b: 3,
    band: 'MEDIUM',
    category: 'general',
    decStatus: 'BOUNDARY',
  },
  {
    id: '14-2',
    a: 14,
    b: 2,
    band: 'MEDIUM',
    category: 'subtract-two',
    decStatus: 'CLEAN',
  },
  {
    id: '15-5',
    a: 15,
    b: 5,
    band: 'MEDIUM',
    category: 'take-to-decade',
    decStatus: 'ALIAS',
  },
  {
    id: '15-4',
    a: 15,
    b: 4,
    band: 'MEDIUM',
    category: 'general',
    decStatus: 'BOUNDARY',
  },
  {
    id: '15-3',
    a: 15,
    b: 3,
    band: 'MEDIUM',
    category: 'subtract-three',
    decStatus: 'CLEAN',
  },
  {
    id: '15-2',
    a: 15,
    b: 2,
    band: 'MEDIUM',
    category: 'subtract-two',
    decStatus: 'CLEAN',
  },
  {
    id: '16-6',
    a: 16,
    b: 6,
    band: 'MEDIUM',
    category: 'take-to-decade',
    decStatus: 'ALIAS',
  },
  {
    id: '16-5',
    a: 16,
    b: 5,
    band: 'MEDIUM',
    category: 'general',
    decStatus: 'BOUNDARY',
  },
  {
    id: '16-4',
    a: 16,
    b: 4,
    band: 'MEDIUM',
    category: 'general',
    decStatus: 'CLEAN',
  },
  // HARD band (6 facts; P5-P8 eligible)
  {
    id: '17-7',
    a: 17,
    b: 7,
    band: 'HARD',
    category: 'take-to-decade',
    decStatus: 'ALIAS',
  },
  {
    id: '17-5',
    a: 17,
    b: 5,
    band: 'HARD',
    category: 'general',
    decStatus: 'CLEAN',
  },
  {
    id: '18-8',
    a: 18,
    b: 8,
    band: 'HARD',
    category: 'take-to-decade',
    decStatus: 'ALIAS',
  },
  {
    id: '18-6',
    a: 18,
    b: 6,
    band: 'HARD',
    category: 'general',
    decStatus: 'CLEAN',
  },
  {
    id: '19-9',
    a: 19,
    b: 9,
    band: 'HARD',
    category: 'take-to-decade',
    decStatus: 'ALIAS',
  },
  {
    id: '19-7',
    a: 19,
    b: 7,
    band: 'HARD',
    category: 'general',
    decStatus: 'CLEAN',
  },
] as const

/** Tier rule config — what the sub-to-20 lint enforces. Mirrors
 *  `SubToTenRulesConfig` shape; adds the Class-B-coverage rule. */
export interface SubToTwentyRulesConfig {
  pool: readonly SubToTwentyPoolFact[]
  categoryCaps: Record<SubToTwentyCategory, number>
  /** Slots (1-indexed) where each band is allowed. */
  bandAllowedSlots: Record<SubToTwentyBand, readonly number[]>
  /** Whole-session minimum count of take-to-decade facts within P4-P8. */
  takeToDecadeInP4ToP8Min: number
  /** Whole-session minimum count of CLEAN-annotated facts within P4-P8
   *  (the Class B coverage rule per spec §2.2). */
  cleanClassBInP4ToP8Min: number
  totalProblems: number
}

export const SUB_TO_TWENTY_RULES: SubToTwentyRulesConfig = {
  pool: SUB_TO_TWENTY_POOL,
  categoryCaps: {
    'subtract-one': 1,
    'doubles-anchor': 1,
    'take-to-decade': 2,
    'subtract-two': 1,
    'subtract-three': 1,
    general: 2,
  },
  bandAllowedSlots: {
    // P1-P3 gentle-ramp only; EASY FORBIDDEN at P4-P8.
    // Mirrors the sub-to-10 tightening from Dave's NOF #1 (PR #247) — the
    // discriminate tier must not lean on gentle-ramp facts.
    EASY: [1, 2, 3],
    MEDIUM: [4, 5, 6, 7, 8],
    HARD: [5, 6, 7, 8],
  },
  takeToDecadeInP4ToP8Min: 1,
  cleanClassBInP4ToP8Min: 2,
  totalProblems: 8,
}

// ── core: lint a SessionStartResponse against sub-to-20 rules ────────────

interface SubProblemRow {
  index: number // 1-indexed
  utteranceId: string
  text: string
  parsed: ParsedFact | null
  poolMatch: SubToTwentyPoolFact | null
}

/**
 * Parse a sub-to-20 read-line. Sub-to-20 uses the "minus" template
 * ("<minuend> minus <subtrahend>. How many are left?") from session 1
 * (spec §4.1 + §7.2 — no first-session "take away" variant). Number
 * words extend to "nineteen".
 *
 * Returns null if the text doesn't match the minus template or if a
 * number word is unrecognised. Pure; no I/O.
 *
 * Exported for tests + render-time consumers.
 */
export function parseSubToTwentyReadLine(text: string): ParsedFact | null {
  const m = SUB_TO_TWENTY_RE_MINUS.exec(text)
  if (!m) return null
  const a = SUB_TO_TWENTY_NUMBER_WORDS[m[1]!.toLowerCase()]
  const b = SUB_TO_TWENTY_NUMBER_WORDS[m[2]!.toLowerCase()]
  if (a === undefined || b === undefined) return null
  return { a, b }
}

// Teen-extended number-word table. Distinct from NUMBER_WORDS above
// (which stops at "ten") so that an unrelated tier mis-routing a teen
// word into the sub-to-10 parser still returns null.
const SUB_TO_TWENTY_NUMBER_WORDS: Record<string, number> = {
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
}

const SUB_TO_TWENTY_RE_MINUS =
  /^\s*([a-z]+)\s+minus\s+([a-z]+)\s*\.\s*how\s+many\s+are\s+left\s*\?\s*$/i

function extractSubToTwentyProblems(
  response: Pick<SessionStartResponse, 'utterances'>,
): SubProblemRow[] {
  const re = /^math\.p(\d+)\.read$/
  const rows: SubProblemRow[] = []
  for (const u of response.utterances) {
    const m = re.exec(u.id)
    if (!m) continue
    const index = Number.parseInt(m[1]!, 10)
    const parsed = parseSubToTwentyReadLine(u.text)
    const poolMatch = parsed
      ? (SUB_TO_TWENTY_POOL.find((f) => f.a === parsed.a && f.b === parsed.b) ??
        null)
      : null
    rows.push({
      index,
      utteranceId: u.id,
      text: u.text,
      parsed,
      poolMatch,
    })
  }
  rows.sort((x, y) => x.index - y.index)
  return rows
}

/**
 * Lint a canon's plan against the sub-to-20 composition rules. Returns
 * ALL violations across the 8-problem set — does not stop at the first.
 *
 * Pure; no I/O.
 */
export function lintSubToTwentyComposition(
  response: Pick<SessionStartResponse, 'utterances'>,
  config: SubToTwentyRulesConfig = SUB_TO_TWENTY_RULES,
): CompositionViolation[] {
  const violations: CompositionViolation[] = []
  const problems = extractSubToTwentyProblems(response)

  // ── unparseable / pool-membership pass ──
  for (const p of problems) {
    if (p.parsed === null) {
      violations.push({
        rule: 'unparseable-problem',
        problemIndex: p.index,
        message:
          `P${p.index} (${p.utteranceId}) text does not match the ` +
          `sub-to-20 read template ("<minuend> minus <subtrahend>. How ` +
          `many are left?"): ` +
          JSON.stringify(p.text),
        factId: null,
      })
      continue
    }
    if (p.poolMatch === null) {
      violations.push({
        rule: 'pool-membership',
        problemIndex: p.index,
        message:
          `P${p.index} fact ${p.parsed.a}-${p.parsed.b}=` +
          `${p.parsed.a - p.parsed.b} is NOT in the 22-fact sub-to-20 ` +
          `pool. Either it is a BORROW fact (ones-digit(a) < b) or a ` +
          `valid no-borrow fact outside the v1 curation. See ` +
          `design/math/sub-to-20-content.md §1.1.`,
        factId: `${p.parsed.a}-${p.parsed.b}`,
      })
    }
  }

  const matched = problems.filter(
    (p): p is SubProblemRow & { poolMatch: SubToTwentyPoolFact } =>
      p.poolMatch !== null,
  )

  // ── band-by-slot pass ──
  for (const p of matched) {
    const allowed = config.bandAllowedSlots[p.poolMatch.band]
    if (!allowed.includes(p.index)) {
      violations.push({
        rule: 'band-by-slot',
        problemIndex: p.index,
        message:
          `P${p.index} carries ${p.poolMatch.band} fact ` +
          `${p.poolMatch.id} (category ${p.poolMatch.category}). ` +
          `${p.poolMatch.band}-band is only allowed at slots ` +
          `[${allowed.join(', ')}].`,
        factId: p.poolMatch.id,
      })
    }
  }

  // ── category-cap pass ──
  type MatchedSubRow = SubProblemRow & { poolMatch: SubToTwentyPoolFact }
  const categoryCounts: Record<string, MatchedSubRow[]> = {}
  for (const p of matched) {
    const cat = p.poolMatch.category
    if (!categoryCounts[cat]) categoryCounts[cat] = []
    categoryCounts[cat]!.push(p)
  }
  for (const [cat, rows] of Object.entries(categoryCounts)) {
    const cap = config.categoryCaps[cat as SubToTwentyCategory]
    if (cap === undefined) continue
    if (rows.length > cap) {
      violations.push({
        rule: 'category-cap',
        problemIndex: null,
        message:
          `Category "${cat}" cap is ${cap}; canon has ${rows.length} ` +
          `(slots P${rows.map((r) => r.index).join(', P')}; facts ` +
          `${rows.map((r) => r.poolMatch.id).join(', ')}).`,
        factId: null,
      })
    }
  }

  // ── take-to-decade coverage pass (>= 1 in P4-P8) ──
  const takeToDecadeInDiscriminate = matched.filter(
    (p) => p.poolMatch.category === 'take-to-decade' && p.index >= 4,
  )
  if (takeToDecadeInDiscriminate.length < config.takeToDecadeInP4ToP8Min) {
    violations.push({
      rule: 'high-leverage-coverage',
      problemIndex: null,
      message:
        `At least ${config.takeToDecadeInP4ToP8Min} take-to-decade ` +
        `fact(s) MUST appear in P4-P8 (highest-leverage category — Dave's ` +
        `sub-to-20 research § 4.2 names these as memorable anchors; Marian's ` +
        `future bridging-down-through-the-decade strategy depends on retrieval). ` +
        `Canon has ${takeToDecadeInDiscriminate.length}.`,
      factId: null,
    })
  }

  // ── Class B coverage pass (>= 2 CLEAN-annotated facts in P4-P8) ──
  //
  // The sub-to-20-specific rule (spec §2.2). The render pipeline attempts
  // a Class B (decade-anchor miss) trap on every op:'-' P4-P8 problem
  // and silently downgrades to Class A (off-by-one) when the trap
  // aliases correct, aliases off-by-one, or falls out of range. Without
  // >= 2 CLEAN-annotated facts at P4-P8, the new distractor class is
  // effectively dead at render time — every Class B attempt collapses
  // to the existing Class A behaviour and the pool's whole point is lost.
  const cleanClassBInDiscriminate = matched.filter(
    (p) => p.poolMatch.decStatus === 'CLEAN' && p.index >= 4,
  )
  if (cleanClassBInDiscriminate.length < config.cleanClassBInP4ToP8Min) {
    violations.push({
      rule: 'high-leverage-coverage',
      problemIndex: null,
      message:
        `At least ${config.cleanClassBInP4ToP8Min} CLEAN-annotated ` +
        `(Class B decade-anchor miss capable) fact(s) MUST appear in ` +
        `P4-P8 (per design/math/sub-to-20-content.md §2.2 — without ` +
        `this coverage every Class B attempt silently downgrades to ` +
        `off-by-one and the decade-anchor distractor class is dead at ` +
        `render time). CLEAN-annotated facts in pool: ` +
        SUB_TO_TWENTY_POOL.filter((f) => f.decStatus === 'CLEAN')
          .map((f) => f.id)
          .join(', ') +
        `. Canon has ${cleanClassBInDiscriminate.length} CLEAN at P4-P8.`,
      factId: null,
    })
  }

  // ── no-duplicates pass ──
  const seen = new Map<string, SubProblemRow[]>()
  for (const p of matched) {
    const key = p.poolMatch.id
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(p)
  }
  for (const [factId, rows] of seen.entries()) {
    if (rows.length > 1) {
      violations.push({
        rule: 'no-duplicates',
        problemIndex: null,
        message:
          `Fact ${factId} appears ${rows.length} times ` +
          `(slots P${rows.map((r) => r.index).join(', P')}). ` +
          `No duplicates allowed within the 8-problem set.`,
        factId,
      })
    }
  }

  return violations
}

/**
 * Throwing helper for the bake-time integration point. The throw aborts
 * the bake and stops the (compositionally invalid) JSON from reaching
 * disk.
 *
 * `canonId` is a human-readable identifier (e.g. `"math/sub-to-20"`).
 */
export function assertSubToTwentyCompositionClean(
  canonId: string,
  response: Pick<SessionStartResponse, 'utterances'>,
  config: SubToTwentyRulesConfig = SUB_TO_TWENTY_RULES,
): void {
  const violations = lintSubToTwentyComposition(response, config)
  if (violations.length > 0) {
    throw new CompositionLintError(canonId, violations)
  }
}

// ── add-to-20 rule config (fourth tier — Kyle's add-to-20 PR #276 spec) ──
//
// Per `design/math/add-to-20-content.md` §1.1. The pool is 22 facts
// covering cross-10-bridge addition (sums in [11, 18], both addends
// in [1, 9]) with deliberate de-emphasis of doubles per the
// "Haiku doubles prior" correction (spec §1.4).
//
// Categories (mutually exclusive — each fact has exactly one):
//   - make-ten-bridge — child decomposes one addend to reach 10 first
//     (e.g. 8 + 5 = 8 + 2 + 3 = 10 + 3 = 13). 13 pool facts; the
//     ACTUAL learning target of this tier.
//   - doubles — a == b (4 pool facts: 6+6, 7+7, 8+8, 9+9). High
//     retrieval salience BUT over-represented by Haiku's prior;
//     capped tight (≤2 per session) — see DOUBLES-CAP correction.
//   - near-doubles — |a − b| == 1 (5 pool facts: 6+7, 7+6, 7+8, 8+7,
//     8+9). Doubles-plus-one derivation; requires doubles to be
//     retrieved first.
//   - general — everything else. ZERO facts in v1 pool — by design
//     (spec §1.4 "if the pool offers no slop bucket, Haiku cannot
//     over-select facts whose pedagogical role is unclear"). Cap
//     listed for forward-compat with §8 pool widening.
//
// Slot-range divergence from sibling tiers (Devon NOF #3 from PR #276
// review): Kyle's spec §2.4 + the SESSION COMPOSITION RULES locate the
// high-leverage coverage rule at P5–P8 — stricter than add-to-10,
// sub-to-10, and sub-to-20 which all use P4–P8 for the analog rule.
// To make the divergence explicit at the data layer, the config field
// is named `makeTenBridgeInP5ToP8Min` (not the bare "P4-P8" framing the
// siblings carry). See spec §2.4 "Why P5–P8 not P4–P8?" for the
// pedagogical justification.
//
// NEW vs sub-to-20: no DEC-status annotation. add-to-20 does NOT ship
// a Class B distractor (spec §3.4 — Dave's research gap on cross-10-
// bridge errors in 7-9 year olds, §7.4 REJECT recommendation). Two-class
// distractor model (gentle P1-P3, off-by-one P4-P8) unchanged.
//
// Commutative-pair wart (Devon non-blocking flag from PR #276): Kyle's
// pool classifies 9+8 (#20) as make-ten-bridge and 8+9 (#21) as
// near-doubles for the same numerical sum. Defensible — the strategies
// genuinely differ — but a future Kyle amendment may unify them.
// Accepted as-is for v1.

export type AddToTwentyBand = 'EASY' | 'MEDIUM' | 'HARD'

export type AddToTwentyCategory =
  | 'doubles'
  | 'near-doubles'
  | 'make-ten-bridge'
  | 'general'

export interface AddToTwentyPoolFact {
  /** "a-b" string id, e.g. "8-5". Stable across runs.
   *  Note: 9+2 and 2+9 are DISTINCT facts (distinct ids "9-2" and "2-9");
   *  commutativity per spec §1.1 row #1/#2. */
  id: string
  a: number
  b: number
  band: AddToTwentyBand
  category: AddToTwentyCategory
}

export const ADD_TO_TWENTY_POOL: readonly AddToTwentyPoolFact[] = [
  // EASY band (6 facts; P1-P3 gentle ramp; also eligible at P4-P8)
  { id: '9-2', a: 9, b: 2, band: 'EASY', category: 'make-ten-bridge' },
  { id: '2-9', a: 2, b: 9, band: 'EASY', category: 'make-ten-bridge' },
  { id: '8-3', a: 8, b: 3, band: 'EASY', category: 'make-ten-bridge' },
  { id: '3-8', a: 3, b: 8, band: 'EASY', category: 'make-ten-bridge' },
  { id: '9-3', a: 9, b: 3, band: 'EASY', category: 'make-ten-bridge' },
  { id: '6-6', a: 6, b: 6, band: 'EASY', category: 'doubles' },
  // MEDIUM band (8 facts; P4-P8 eligible)
  { id: '9-4', a: 9, b: 4, band: 'MEDIUM', category: 'make-ten-bridge' },
  { id: '4-9', a: 4, b: 9, band: 'MEDIUM', category: 'make-ten-bridge' },
  { id: '8-5', a: 8, b: 5, band: 'MEDIUM', category: 'make-ten-bridge' },
  { id: '5-8', a: 5, b: 8, band: 'MEDIUM', category: 'make-ten-bridge' },
  { id: '6-7', a: 6, b: 7, band: 'MEDIUM', category: 'near-doubles' },
  { id: '7-6', a: 7, b: 6, band: 'MEDIUM', category: 'near-doubles' },
  { id: '7-7', a: 7, b: 7, band: 'MEDIUM', category: 'doubles' },
  { id: '9-5', a: 9, b: 5, band: 'MEDIUM', category: 'make-ten-bridge' },
  // HARD band (8 facts; P5-P8 eligible)
  { id: '7-8', a: 7, b: 8, band: 'HARD', category: 'near-doubles' },
  { id: '8-7', a: 8, b: 7, band: 'HARD', category: 'near-doubles' },
  { id: '9-6', a: 9, b: 6, band: 'HARD', category: 'make-ten-bridge' },
  { id: '9-7', a: 9, b: 7, band: 'HARD', category: 'make-ten-bridge' },
  { id: '8-8', a: 8, b: 8, band: 'HARD', category: 'doubles' },
  { id: '9-8', a: 9, b: 8, band: 'HARD', category: 'make-ten-bridge' },
  { id: '8-9', a: 8, b: 9, band: 'HARD', category: 'near-doubles' },
  { id: '9-9', a: 9, b: 9, band: 'HARD', category: 'doubles' },
] as const

/** Tier rule config — what the add-to-20 lint enforces. Mirrors
 *  `AddToTenRulesConfig` shape; uses the spec-divergent
 *  `makeTenBridgeInP5ToP8Min` slot-range field (Devon NOF #3 from
 *  PR #276 review — spec §2.4 enforces P5-P8 not P4-P8). */
export interface AddToTwentyRulesConfig {
  pool: readonly AddToTwentyPoolFact[]
  categoryCaps: Record<AddToTwentyCategory, number>
  /** Slots (1-indexed) where each band is allowed. */
  bandAllowedSlots: Record<AddToTwentyBand, readonly number[]>
  /** Whole-session minimum count of make-ten-bridge facts within P5-P8.
   *  STRICTER than sibling tiers (which use P4-P8); explicit field name
   *  flags the divergence per spec §2.4 "Why P5–P8 not P4–P8?". */
  makeTenBridgeInP5ToP8Min: number
  totalProblems: number
}

export const ADD_TO_TWENTY_RULES: AddToTwentyRulesConfig = {
  pool: ADD_TO_TWENTY_POOL,
  categoryCaps: {
    // Doubles capped tight — the doubles-prior correction lever per
    // spec §1.4. Pool has 4 doubles; cap at 2 cuts current canon's
    // 4-of-8 saturation in half.
    doubles: 2,
    // Near-doubles capped to prevent over-reliance on doubles-plus-one
    // derivations (chained dependency on doubles retrieval).
    'near-doubles': 2,
    // Make-ten-bridge capped generously — IS the tier's learning
    // target; cap binds only on doubles-leaning sessions per spec §2.2.
    'make-ten-bridge': 5,
    // No general facts in v1 pool by design (spec §1.4). Cap is
    // structurally zero; forward-compat with §8 pool widening.
    general: 0,
  },
  bandAllowedSlots: {
    // EASY allowed at any slot — matches add-to-10 (not sub-to-10 or
    // sub-to-20 which tighten to P1-P3 only). Per spec §2.1 EASY is a
    // discriminate-tier fallback when recent-score modulation biases
    // easy (§2.3).
    EASY: [1, 2, 3, 4, 5, 6, 7, 8],
    MEDIUM: [4, 5, 6, 7, 8],
    HARD: [5, 6, 7, 8],
  },
  // STRICTER than sibling tiers — spec §2.4 locates the rule at P5-P8
  // (not P4-P8). The slot-range divergence is intentional: P4 is
  // MEDIUM-only and many MEDIUM facts are make-ten-bridge, so a
  // P4-P8 rule would be trivially satisfied; P5-P8 forces the rule
  // to bind even when P4 happens to carry a non-make-ten-bridge fact.
  makeTenBridgeInP5ToP8Min: 1,
  totalProblems: 8,
}

// ── core: lint a SessionStartResponse against add-to-20 rules ────────────

interface AddToTwentyProblemRow {
  index: number // 1-indexed
  utteranceId: string
  text: string
  parsed: ParsedFact | null
  poolMatch: AddToTwentyPoolFact | null
}

// Teen-extended number-word table. Separate from `NUMBER_WORDS` (which
// stops at "ten") and from `SUB_TO_TWENTY_NUMBER_WORDS` (which is a
// distinct const so a sub-to-20 word landing in add-to-20's parser
// matches independently — no shared state across tiers). add-to-20
// pool results land in [11, 18] but the table accepts 0-19 for
// forward-compat (sum-out-of-range trips pool-membership cleanly
// rather than unparseable-problem).
const ADD_TO_TWENTY_NUMBER_WORDS: Record<string, number> = {
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
}

const ADD_TO_TWENTY_RE_PLUS =
  /^\s*([a-z]+)\s+plus\s+([a-z]+)\s*\.\s*how\s+many\s*\?\s*$/i

/**
 * Parse an add-to-20 read-line into `{ a, b }`. Returns null if the text
 * doesn't match the addition template `"<W> plus <W>. How many?"` or if
 * a number word is unrecognised. Pure; no I/O.
 *
 * Subtraction templates (sub-to-10's "take away" / "minus" + sub-to-20's
 * "minus") return null here — by design — so a subtraction canon
 * mis-routed to this parser fires `unparseable-problem` cleanly.
 *
 * Exported for tests + render-time consumers.
 */
export function parseAddToTwentyReadLine(text: string): ParsedFact | null {
  const m = ADD_TO_TWENTY_RE_PLUS.exec(text)
  if (!m) return null
  const a = ADD_TO_TWENTY_NUMBER_WORDS[m[1]!.toLowerCase()]
  const b = ADD_TO_TWENTY_NUMBER_WORDS[m[2]!.toLowerCase()]
  if (a === undefined || b === undefined) return null
  return { a, b }
}

function extractAddToTwentyProblems(
  response: Pick<SessionStartResponse, 'utterances'>,
): AddToTwentyProblemRow[] {
  const re = /^math\.p(\d+)\.read$/
  const rows: AddToTwentyProblemRow[] = []
  for (const u of response.utterances) {
    const m = re.exec(u.id)
    if (!m) continue
    const index = Number.parseInt(m[1]!, 10)
    const parsed = parseAddToTwentyReadLine(u.text)
    const poolMatch = parsed
      ? (ADD_TO_TWENTY_POOL.find((f) => f.a === parsed.a && f.b === parsed.b) ??
        null)
      : null
    rows.push({
      index,
      utteranceId: u.id,
      text: u.text,
      parsed,
      poolMatch,
    })
  }
  rows.sort((x, y) => x.index - y.index)
  return rows
}

/**
 * Lint a canon's plan against the add-to-20 composition rules. Returns
 * ALL violations across the 8-problem set — does not stop at the first.
 *
 * Pure; no I/O.
 *
 * NOTE — PR A scope (split-PR pattern per `testing-and-ci.md §6`):
 * This function is EXPORTED but NOT yet wired into `bakeOne` /
 * `resolveTierBinding` / `runCompositionLint` dispatch / the
 * `CompositionFileFinding` union. The committed
 * `public/canon/math/level-1/add-to-20.json` pre-exists with violations
 * the rules here would catch (4-of-8 doubles per spec §1.4 — the
 * doubles-prior correction target). Wiring is deferred to PR B
 * (canon rebake + binding activation, ticket follow-up to 86c9uuqzu).
 *
 * TODO (PR B): wire the binding once the canon is rebaked.
 *   1. Add `'add-to-20'` to `TierLintBinding` union below.
 *   2. Add the `add-to-20.json` branch in `resolveTierBinding`.
 *   3. Add the `case 'add-to-20':` arm in `runCompositionLint`'s switch.
 *   4. Add `'add-to-20'` to `CompositionFileFinding.tier` union.
 *   5. Sharpen the `MATH_TRACK_GUIDE` add-to-20 directive at
 *      `api/_planner.ts:964` per spec §4.1 — change the bare
 *      "Lean on doubles and near-doubles within range" prose to the
 *      explicit FACT POOL + DOUBLES-CAP SELF-CHECK (`general = 0`
 *      directive enforcement per pattern 5 of
 *      `feedback_haiku_directive_sharpening`).
 *   6. Re-bake `public/canon/math/level-1/add-to-20.json` via the
 *      per-tier rebake recipe (`planner-and-canon.md` § "Per-tier
 *      rebake recipe"); commit the JSON diff in the same PR.
 *   7. Flip the deferred test marker:
 *        expect(resolveTierBinding('add-to-20.json')).toBe('add-to-20')
 */
export function lintAddToTwentyComposition(
  response: Pick<SessionStartResponse, 'utterances'>,
  config: AddToTwentyRulesConfig = ADD_TO_TWENTY_RULES,
): CompositionViolation[] {
  const violations: CompositionViolation[] = []
  const problems = extractAddToTwentyProblems(response)

  // ── unparseable / pool-membership pass ──
  for (const p of problems) {
    if (p.parsed === null) {
      violations.push({
        rule: 'unparseable-problem',
        problemIndex: p.index,
        message:
          `P${p.index} (${p.utteranceId}) text does not match the ` +
          `add-to-20 read template ("<addend-A> plus <addend-B>. How ` +
          `many?"): ` +
          JSON.stringify(p.text),
        factId: null,
      })
      continue
    }
    if (p.poolMatch === null) {
      violations.push({
        rule: 'pool-membership',
        problemIndex: p.index,
        message:
          `P${p.index} fact ${p.parsed.a}+${p.parsed.b}=` +
          `${p.parsed.a + p.parsed.b} is NOT in the 22-fact add-to-20 ` +
          `pool. Either it violates sum range [11, 18] (sums <11 belong ` +
          `in add-to-10; sums >18 require addend >9), addend range ` +
          `[1, 9] (10+n / n+10 is two-digit-addsub territory), or it ` +
          `is a valid in-range fact outside the v1 curation ` +
          `(deferred pool extensions per spec §8). See ` +
          `design/math/add-to-20-content.md §1.1.`,
        factId: `${p.parsed.a}-${p.parsed.b}`,
      })
    }
  }

  const matched = problems.filter(
    (p): p is AddToTwentyProblemRow & { poolMatch: AddToTwentyPoolFact } =>
      p.poolMatch !== null,
  )

  // ── band-by-slot pass ──
  for (const p of matched) {
    const allowed = config.bandAllowedSlots[p.poolMatch.band]
    if (!allowed.includes(p.index)) {
      violations.push({
        rule: 'band-by-slot',
        problemIndex: p.index,
        message:
          `P${p.index} carries ${p.poolMatch.band} fact ` +
          `${p.poolMatch.id} (category ${p.poolMatch.category}). ` +
          `${p.poolMatch.band}-band is only allowed at slots ` +
          `[${allowed.join(', ')}].`,
        factId: p.poolMatch.id,
      })
    }
  }

  // ── category-cap pass ──
  type MatchedAddRow = AddToTwentyProblemRow & {
    poolMatch: AddToTwentyPoolFact
  }
  const categoryCounts: Record<string, MatchedAddRow[]> = {}
  for (const p of matched) {
    const cat = p.poolMatch.category
    if (!categoryCounts[cat]) categoryCounts[cat] = []
    categoryCounts[cat]!.push(p)
  }
  for (const [cat, rows] of Object.entries(categoryCounts)) {
    const cap = config.categoryCaps[cat as AddToTwentyCategory]
    if (cap === undefined) continue
    if (rows.length > cap) {
      violations.push({
        rule: 'category-cap',
        problemIndex: null,
        message:
          `Category "${cat}" cap is ${cap}; canon has ${rows.length} ` +
          `(slots P${rows.map((r) => r.index).join(', P')}; facts ` +
          `${rows.map((r) => r.poolMatch.id).join(', ')}).` +
          (cat === 'doubles'
            ? ` Doubles-prior correction lever — per spec §1.4 the` +
              ` current canon ships 4 doubles; cap at ${cap} halves` +
              ` that saturation. Reject the third doubles fact.`
            : ''),
        factId: null,
      })
    }
  }

  // ── make-ten-bridge coverage pass (>= 1 in P5-P8) ──
  //
  // STRICTER than sibling tiers' P4-P8 framing — per spec §2.4
  // "Why P5–P8 not P4–P8?": P4 is MEDIUM-only and several MEDIUM facts
  // are make-ten-bridge (#7, #8, #9, #10, #14), so a P4-P8 rule would
  // be trivially satisfied. P5-P8 forces the rule to bind even when
  // P4 happens to carry a non-make-ten-bridge fact.
  const makeTenBridgeInDiscriminate = matched.filter(
    (p) => p.poolMatch.category === 'make-ten-bridge' && p.index >= 5,
  )
  if (makeTenBridgeInDiscriminate.length < config.makeTenBridgeInP5ToP8Min) {
    violations.push({
      rule: 'high-leverage-coverage',
      problemIndex: null,
      message:
        `At least ${config.makeTenBridgeInP5ToP8Min} make-ten-bridge ` +
        `fact(s) MUST appear in P5-P8 (the ACTUAL learning target of ` +
        `this tier per spec §2.4 + Dave's sub-to-20 research § 1.2). ` +
        `STRICTER than sibling tiers' P4-P8 framing: P4 is MEDIUM-only ` +
        `and several MEDIUM facts are make-ten-bridge, so a P4-P8 rule ` +
        `would be trivially satisfied; P5-P8 forces the rule to bind. ` +
        `Canon has ${makeTenBridgeInDiscriminate.length} make-ten-bridge ` +
        `fact(s) in P5-P8.`,
      factId: null,
    })
  }

  // ── no-duplicates pass ──
  const seen = new Map<string, AddToTwentyProblemRow[]>()
  for (const p of matched) {
    const key = p.poolMatch.id
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(p)
  }
  for (const [factId, rows] of seen.entries()) {
    if (rows.length > 1) {
      violations.push({
        rule: 'no-duplicates',
        problemIndex: null,
        message:
          `Fact ${factId} appears ${rows.length} times ` +
          `(slots P${rows.map((r) => r.index).join(', P')}). ` +
          `No duplicates allowed within the 8-problem set. ` +
          `Note: 9+2 and 2+9 are distinct ordered pairs (distinct ids ` +
          `"9-2" and "2-9"), NOT duplicates.`,
        factId,
      })
    }
  }

  return violations
}

/**
 * Throwing helper for the bake-time integration point. The throw aborts
 * the bake and stops the (compositionally invalid) JSON from reaching
 * disk.
 *
 * `canonId` is a human-readable identifier (e.g. `"math/add-to-20"`).
 *
 * NOTE (PR A scope): exported but not yet called from `bakeOne`. PR B
 * activates the binding alongside a fresh canon — see the TODO in
 * `lintAddToTwentyComposition` above.
 */
export function assertAddToTwentyCompositionClean(
  canonId: string,
  response: Pick<SessionStartResponse, 'utterances'>,
  config: AddToTwentyRulesConfig = ADD_TO_TWENTY_RULES,
): void {
  const violations = lintAddToTwentyComposition(response, config)
  if (violations.length > 0) {
    throw new CompositionLintError(canonId, violations)
  }
}

// ── two-digit-addsub: pool, rules, parser, lint, assert ─────────────────
//
// First tier with MIXED-OP sessions (`+` AND `-` within an 8-problem set).
// First tier with HYPHENATED number words (`twenty-three`). First tier
// where the dual-exposure rule binds in the real (non-forward-compat)
// sense per spec §5.5.
//
// Spec: `design/math/two-digit-addsub-content.md`
// Ticket: 86c9xkz9n
// Structural precedent: add-to-20 PR #278 (lint infra) → PR #280 (rebake +
// binding activation). This module follows the same split-PR pattern per
// `testing-and-ci.md §6` — PR A ships infra with the binding deferred;
// PR B (ticket follow-up) rebakes the canon and activates the binding.
//
// Six classes of composition rule (vs add-to-20's five):
//   1. pool-membership — every fact one of the 36 (or 30 under §7.2 Option A)
//      (a, b, op) triples.
//   2. category-cap — round-ten-anchor ≤ 1 (the round-ten-prior correction
//      lever per spec §1.4 — sibling to add-to-20's doubles cap), mid-decade-
//      units-shift ≤ 4, near-boundary-no-cross ≤ 5, tens-doubles-echo ≤ 1,
//      two-digit-plus-two-digit ≤ 2 (Option B only).
//   3. band-by-slot — EASY any slot; MEDIUM P4-P8; HARD P5-P8.
//   4. op-mix — first tier with mixed-op rules: addCount ∈ [5, 6],
//      subCount ∈ [2, 3], addCount + subCount === 8. Allowed mixes:
//      5+/3-, 6+/2-. FORBIDDEN: 8+/0-, 7+/1-, 4+/4-, 3+/5-.
//   5. p1-is-plus — session opener carries onset anxiety; the more confident
//      operation enters first (spec §2.2). P1 must be op === '+'.
//   6. dual-exposure — load-bearing per spec §5.5. For any (a, b, op) triple
//      in the session, the inverse triple (i.e. for + fact a+b=c, the - fact
//      c-b=a OR c-a=b; for - fact a-b=c, the + fact c+b=a) is FORBIDDEN.
//      Only ONE in-pool collision exists today (`33+4=37` ↔ `37-4=33`, but
//      37-4 is not in the v1 - pool by construction), so dual-exposure is
//      load-bearing primarily as forward-compat for v2 pool extensions.
//   7. high-leverage-coverage — ≥ 1 near-boundary-no-cross fact MUST appear
//      in P5-P8 (the cycle-5-regroup-prep diagnostic per spec §2.4). Uses
//      the same STRICTER P5-P8 framing as add-to-20's make-ten-bridge rule.
//   8. diagnostic-coverage — ≥ 2 in-range Class 2 (column-cross) traps
//      across P4-P8 AND ≥ 1 in-range Class 3 (phantom-borrow) trap across
//      P5-P8 `-` problems. Per spec §3.8 — the diagnostic instrument for
//      concatenated-single-digit-processing (Dave NOF #1). Computed purely
//      from `(a, b, op, correct)` per fact; renders the chip pool at lint
//      time without coupling to the render pipeline.
//   9. no-duplicates — no (a, b, op) triple repeats within the 8-problem set.
//
// NOTE — PR A scope (split-PR pattern per `testing-and-ci.md §6`):
// `lintTwoDigitAddsubComposition` + `assertTwoDigitAddsubCompositionClean`
// are EXPORTED but NOT yet wired into `bakeOne` / `resolveTierBinding` /
// `runCompositionLint` dispatch / the `CompositionFileFinding` union.
// The pre-existing `public/canon/math/level-1/two-digit-addsub.json` was
// not yet under spec-compliant composition rules — round-ten-prior is
// Haiku's empirical saturation failure mode that §1.4 targets via the
// at-most-1 round-ten-anchor cap. Wiring is deferred to PR B (canon
// rebake + directive sharpening + binding activation + Wave 2 prereq
// fold-in `86c9xa817`).

export type TwoDigitAddsubBand = 'EASY' | 'MEDIUM' | 'HARD'

export type TwoDigitAddsubCategory =
  | 'round-ten-anchor'
  | 'mid-decade-units-shift'
  | 'near-boundary-no-cross'
  | 'tens-doubles-echo'
  | 'two-digit-plus-two-digit'

export type TwoDigitAddsubOp = '+' | '-'

export interface TwoDigitAddsubPoolFact {
  /** Stable "<a><op><b>" id, e.g. "20+3", "48-7". Op is part of identity per
   *  spec §1.1 — "25-3" and "22+3" are distinct triples (and dual-exposure
   *  forbids them co-occurring). */
  id: string
  a: number
  b: number
  op: TwoDigitAddsubOp
  band: TwoDigitAddsubBand
  category: TwoDigitAddsubCategory
}

/** The 36-fact pool from spec §1.1 (§7.2 Option B default).
 *
 *  Under §7.2 Option A (Thomas decision), pool drops the last 6
 *  two-digit-plus-two-digit facts → 30 facts; the lint rule config also
 *  drops the `two-digit-plus-two-digit` category cap row. The Option-B
 *  default is what this lint ships against (Kyle's recommendation in
 *  spec §7.2). If Thomas selects Option A, replace this constant with
 *  the 30-fact slice. */
export const TWO_DIGIT_ADDSUB_POOL: readonly TwoDigitAddsubPoolFact[] = [
  // ── EASY band (9 facts; P1-P3 gentle ramp; also P4-P8 fallback) ────────
  {
    id: '20+3',
    a: 20,
    b: 3,
    op: '+',
    band: 'EASY',
    category: 'round-ten-anchor',
  },
  {
    id: '30+5',
    a: 30,
    b: 5,
    op: '+',
    band: 'EASY',
    category: 'round-ten-anchor',
  },
  {
    id: '40+2',
    a: 40,
    b: 2,
    op: '+',
    band: 'EASY',
    category: 'round-ten-anchor',
  },
  {
    id: '25+4',
    a: 25,
    b: 4,
    op: '+',
    band: 'EASY',
    category: 'near-boundary-no-cross',
  },
  {
    id: '33+4',
    a: 33,
    b: 4,
    op: '+',
    band: 'EASY',
    category: 'mid-decade-units-shift',
  },
  {
    id: '22+5',
    a: 22,
    b: 5,
    op: '+',
    band: 'EASY',
    category: 'tens-doubles-echo',
  },
  {
    id: '15-3',
    a: 15,
    b: 3,
    op: '-',
    band: 'EASY',
    category: 'mid-decade-units-shift',
  },
  {
    id: '28-5',
    a: 28,
    b: 5,
    op: '-',
    band: 'EASY',
    category: 'mid-decade-units-shift',
  },
  {
    id: '19-7',
    a: 19,
    b: 7,
    op: '-',
    band: 'EASY',
    category: 'mid-decade-units-shift',
  },
  // ── MEDIUM band (10 facts; P4-P8 eligible) ────────────────────────────
  {
    id: '21+3',
    a: 21,
    b: 3,
    op: '+',
    band: 'MEDIUM',
    category: 'mid-decade-units-shift',
  },
  {
    id: '34+5',
    a: 34,
    b: 5,
    op: '+',
    band: 'MEDIUM',
    category: 'near-boundary-no-cross',
  },
  {
    id: '42+3',
    a: 42,
    b: 3,
    op: '+',
    band: 'MEDIUM',
    category: 'mid-decade-units-shift',
  },
  {
    id: '54+4',
    a: 54,
    b: 4,
    op: '+',
    band: 'MEDIUM',
    category: 'mid-decade-units-shift',
  },
  {
    id: '36+2',
    a: 36,
    b: 2,
    op: '+',
    band: 'MEDIUM',
    category: 'mid-decade-units-shift',
  },
  {
    id: '44+3',
    a: 44,
    b: 3,
    op: '+',
    band: 'MEDIUM',
    category: 'tens-doubles-echo',
  },
  {
    id: '18-4',
    a: 18,
    b: 4,
    op: '-',
    band: 'MEDIUM',
    category: 'mid-decade-units-shift',
  },
  {
    id: '25-3',
    a: 25,
    b: 3,
    op: '-',
    band: 'MEDIUM',
    category: 'mid-decade-units-shift',
  },
  {
    id: '37-4',
    a: 37,
    b: 4,
    op: '-',
    band: 'MEDIUM',
    category: 'mid-decade-units-shift',
  },
  {
    id: '26-5',
    a: 26,
    b: 5,
    op: '-',
    band: 'MEDIUM',
    category: 'near-boundary-no-cross',
  },
  // ── HARD band (17 facts; P5-P8 eligible — Option B default) ───────────
  {
    id: '23+6',
    a: 23,
    b: 6,
    op: '+',
    band: 'HARD',
    category: 'near-boundary-no-cross',
  },
  {
    id: '41+8',
    a: 41,
    b: 8,
    op: '+',
    band: 'HARD',
    category: 'near-boundary-no-cross',
  },
  {
    id: '32+7',
    a: 32,
    b: 7,
    op: '+',
    band: 'HARD',
    category: 'near-boundary-no-cross',
  },
  {
    id: '55+4',
    a: 55,
    b: 4,
    op: '+',
    band: 'HARD',
    category: 'near-boundary-no-cross',
  },
  {
    id: '27+2',
    a: 27,
    b: 2,
    op: '+',
    band: 'HARD',
    category: 'near-boundary-no-cross',
  },
  {
    id: '35-4',
    a: 35,
    b: 4,
    op: '-',
    band: 'HARD',
    category: 'near-boundary-no-cross',
  },
  {
    id: '48-7',
    a: 48,
    b: 7,
    op: '-',
    band: 'HARD',
    category: 'near-boundary-no-cross',
  },
  {
    id: '52-1',
    a: 52,
    b: 1,
    op: '-',
    band: 'HARD',
    category: 'near-boundary-no-cross',
  },
  {
    id: '64-3',
    a: 64,
    b: 3,
    op: '-',
    band: 'HARD',
    category: 'near-boundary-no-cross',
  },
  {
    id: '66+3',
    a: 66,
    b: 3,
    op: '+',
    band: 'HARD',
    category: 'tens-doubles-echo',
  },
  {
    id: '47+2',
    a: 47,
    b: 2,
    op: '+',
    band: 'HARD',
    category: 'near-boundary-no-cross',
  },
  // two-digit-plus-two-digit (§7.2 Option B; 6 facts; HARD only)
  {
    id: '23+14',
    a: 23,
    b: 14,
    op: '+',
    band: 'HARD',
    category: 'two-digit-plus-two-digit',
  },
  {
    id: '42+31',
    a: 42,
    b: 31,
    op: '+',
    band: 'HARD',
    category: 'two-digit-plus-two-digit',
  },
  {
    id: '25+14',
    a: 25,
    b: 14,
    op: '+',
    band: 'HARD',
    category: 'two-digit-plus-two-digit',
  },
  {
    id: '31+26',
    a: 31,
    b: 26,
    op: '+',
    band: 'HARD',
    category: 'two-digit-plus-two-digit',
  },
  {
    id: '52+13',
    a: 52,
    b: 13,
    op: '+',
    band: 'HARD',
    category: 'two-digit-plus-two-digit',
  },
  {
    id: '34+22',
    a: 34,
    b: 22,
    op: '+',
    band: 'HARD',
    category: 'two-digit-plus-two-digit',
  },
] as const

/** Tier rule config — what the two-digit-addsub lint enforces. Mirrors
 *  `AddToTwentyRulesConfig` shape but adds op-mix + dual-exposure +
 *  diagnostic-coverage fields per spec §2.2 + §5.5 + §3.8. */
export interface TwoDigitAddsubRulesConfig {
  pool: readonly TwoDigitAddsubPoolFact[]
  categoryCaps: Record<TwoDigitAddsubCategory, number>
  /** Slots (1-indexed) where each band is allowed. */
  bandAllowedSlots: Record<TwoDigitAddsubBand, readonly number[]>
  /** Allowed op-mix combinations per spec §2.2. Each entry is
   *  `{ addCount, subCount }`; lint asserts the session matches one of
   *  these. Default: 5+/3-, 6+/2-. */
  allowedOpMixes: readonly { addCount: number; subCount: number }[]
  /** Whole-session minimum count of near-boundary-no-cross facts within
   *  P5-P8 (the cycle-5-regroup-prep diagnostic per spec §2.4). STRICTER
   *  than the P4-P8 framing used by sibling tiers — same rationale as
   *  add-to-20's `makeTenBridgeInP5ToP8Min`. */
  nearBoundaryNoCrossInP5ToP8Min: number
  /** Whole-session minimum count of in-range Class 2 (column-cross) traps
   *  across P4-P8 per spec §3.8. Class 2 is the high-leverage diagnostic
   *  instrument for this tier. */
  classTwoColumnCrossInP4ToP8Min: number
  /** Whole-session minimum count of in-range Class 3 (phantom-borrow)
   *  traps across P5-P8 `-` problems per spec §3.8. */
  classThreePhantomBorrowInP5ToP8Min: number
  totalProblems: number
}

export const TWO_DIGIT_ADDSUB_RULES: TwoDigitAddsubRulesConfig = {
  pool: TWO_DIGIT_ADDSUB_POOL,
  categoryCaps: {
    // Round-ten-anchor capped tight per spec §1.4 — the round-ten-prior
    // correction lever (sibling to add-to-20's doubles cap). Haiku's
    // uncapped empirical prior saturates this category across many bakes
    // (gravitating toward `20+3`, `30+5`, `40+2` — the easiest
    // representational instance of the tier); cap at 1 holds it to
    // 1-of-8 (12.5% of the session).
    'round-ten-anchor': 1,
    // mid-decade-units-shift capped at 4 per spec §2.3 — the calibration
    // anchor for typical mid-score sessions. Pool has 11 mid-decade
    // facts so the cap binds before pool exhaustion.
    'mid-decade-units-shift': 4,
    // near-boundary-no-cross capped generously at 5 per spec §2.3 — IS
    // the tier's learning target (the cycle-5-regroup-prep diagnostic).
    // Cap binds only on near-boundary-heavy sessions.
    'near-boundary-no-cross': 5,
    // tens-doubles-echo capped at 1 per spec §2.3 — keeps doubles
    // intuition lightly present without re-introducing add-to-20's
    // doubles-prior at a new tier.
    'tens-doubles-echo': 1,
    // two-digit-plus-two-digit capped at 2 per spec §2.3 (§7.2 Option B
    // only) — caps the cycle-5-prep representational surface to 25% of
    // the session. Under §7.2 Option A, drop this row + the 6 pool
    // facts.
    'two-digit-plus-two-digit': 2,
  },
  bandAllowedSlots: {
    // EASY allowed at any slot per spec §2.1 — gentle ramp anchor; also
    // permitted as a discriminate-tier fallback when recent-score
    // modulation biases easy.
    EASY: [1, 2, 3, 4, 5, 6, 7, 8],
    MEDIUM: [4, 5, 6, 7, 8],
    HARD: [5, 6, 7, 8],
  },
  // Spec §2.2: 5+/3- (default) OR 6+/2- (low-score modulation). Lint
  // FORBIDS 8+/0-, 7+/1-, 4+/4-, 3+/5-, and any combination summing to
  // something other than 8.
  allowedOpMixes: [
    { addCount: 5, subCount: 3 },
    { addCount: 6, subCount: 2 },
  ],
  // Spec §2.4: ≥ 1 near-boundary-no-cross in P5-P8. Same STRICTER
  // slot-range as add-to-20's make-ten-bridge — P4 is MEDIUM-only and
  // P4-P8 framing would trivially satisfy when P4 happens to be a MEDIUM
  // near-boundary fact (#11 or #19).
  nearBoundaryNoCrossInP5ToP8Min: 1,
  // Spec §3.8: ≥ 2 Class 2 column-cross traps in P4-P8. The chip pool's
  // diagnostic-coverage requirement — anything less and Marian's
  // concatenated-processing signal is not statistically meaningful.
  classTwoColumnCrossInP4ToP8Min: 2,
  // Spec §3.8: ≥ 1 Class 3 phantom-borrow trap in P5-P8 `-` problems.
  classThreePhantomBorrowInP5ToP8Min: 1,
  totalProblems: 8,
}

// ── core: lint a SessionStartResponse against two-digit-addsub rules ────

interface TwoDigitAddsubProblemRow {
  index: number // 1-indexed
  utteranceId: string
  text: string
  parsed: ParsedTwoDigitFact | null
  poolMatch: TwoDigitAddsubPoolFact | null
}

/** Parsed fact from a two-digit-addsub read-line — carries `op` because
 *  the tier is mixed-op (unlike `ParsedFact` which is op-implicit per
 *  parser). */
export interface ParsedTwoDigitFact {
  a: number
  b: number
  op: TwoDigitAddsubOp
}

/** Number-word table extended through 99 with hyphenated forms.
 *
 *  Distinct from the other tier-specific tables (`NUMBER_WORDS`,
 *  `SUB_TO_TWENTY_NUMBER_WORDS`, `ADD_TO_TWENTY_NUMBER_WORDS`) so that an
 *  off-tier canon mis-routed into this parser still returns null cleanly
 *  via the unrecognised-word fall-through. No shared mutable state.
 *
 *  Decade words (twenty, thirty, ... ninety) + hyphenated forms (twenty-
 *  one ... ninety-nine) + the 0-19 forms inherited from sibling tables.
 *  Total: 100 entries (0-99 in spoken form). */
const TWO_DIGIT_ADDSUB_NUMBER_WORDS: Record<string, number> = (() => {
  const table: Record<string, number> = {
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
  }
  const decades: Array<[string, number]> = [
    ['twenty', 20],
    ['thirty', 30],
    ['forty', 40],
    ['fifty', 50],
    ['sixty', 60],
    ['seventy', 70],
    ['eighty', 80],
    ['ninety', 90],
  ]
  const units: Array<[string, number]> = [
    ['one', 1],
    ['two', 2],
    ['three', 3],
    ['four', 4],
    ['five', 5],
    ['six', 6],
    ['seven', 7],
    ['eight', 8],
    ['nine', 9],
  ]
  for (const [decWord, decVal] of decades) {
    table[decWord] = decVal
    for (const [unitWord, unitVal] of units) {
      table[`${decWord}-${unitWord}`] = decVal + unitVal
    }
  }
  return table
})()

// Read-line regexes. Per testing-and-ci.md §6 "Per-spec-author parser
// convention" + "en-dash tolerance" — but neither dash form appears
// inside read-line operand text here; the spec's §4.1 directive uses
// plain hyphens within compound number words (`twenty-three`) which the
// character class `[a-z-]` already accepts. The en-dash tolerance pattern
// applies to spec-prose parsing (§1.1 pool table + §2.1 band-slot bullets)
// — see `parseTwoDigitAddsubBandSlotsFromSpec` drift-guard below.
//
// Character class `[a-z][a-z-]*` requires a leading letter and permits
// hyphens internally — sibling to Devon's parser widening in PR #287
// (`planFromServer.ts:225`). Sub-template REQUIRES "How many are left?"
// (PR B activated 86c9xa817 — subtraction read-template tightened to
// match sub-to-X tiers). The "+" template uses "How many?" (no "are
// left"); the trailing phrase is the wire-side discriminator between
// addition and subtraction.
const TWO_DIGIT_ADDSUB_RE_PLUS =
  /^\s*([a-z][a-z-]*)\s+plus\s+([a-z][a-z-]*)\s*\.\s*how\s+many\s*\?\s*$/i
const TWO_DIGIT_ADDSUB_RE_MINUS =
  /^\s*([a-z][a-z-]*)\s+minus\s+([a-z][a-z-]*)\s*\.\s*how\s+many\s+are\s+left\s*\?\s*$/i

/**
 * Parse a two-digit-addsub read-line into `{ a, b, op }`. Returns null if
 * the text matches neither the `"<W> plus <W>. How many?"` nor the
 * `"<W> minus <W>. How many?"` (or `"How many are left?"`) template, or
 * if a number word is unrecognised. Pure; no I/O.
 *
 * First mixed-op parser in this module — sibling tier parsers are
 * op-fixed (sub-to-X is minus-only, add-to-X is plus-only). The op is
 * inferred from which regex matches; the return value carries it
 * explicitly so downstream pool-membership lookup can be op-keyed.
 *
 * Exported for tests + future render-time consumers.
 */
export function parseTwoDigitAddsubReadLine(
  text: string,
): ParsedTwoDigitFact | null {
  const mPlus = TWO_DIGIT_ADDSUB_RE_PLUS.exec(text)
  if (mPlus) {
    const a = TWO_DIGIT_ADDSUB_NUMBER_WORDS[mPlus[1]!.toLowerCase()]
    const b = TWO_DIGIT_ADDSUB_NUMBER_WORDS[mPlus[2]!.toLowerCase()]
    if (a === undefined || b === undefined) return null
    return { a, b, op: '+' }
  }
  const mMinus = TWO_DIGIT_ADDSUB_RE_MINUS.exec(text)
  if (mMinus) {
    const a = TWO_DIGIT_ADDSUB_NUMBER_WORDS[mMinus[1]!.toLowerCase()]
    const b = TWO_DIGIT_ADDSUB_NUMBER_WORDS[mMinus[2]!.toLowerCase()]
    if (a === undefined || b === undefined) return null
    return { a, b, op: '-' }
  }
  return null
}

function extractTwoDigitAddsubProblems(
  response: Pick<SessionStartResponse, 'utterances'>,
): TwoDigitAddsubProblemRow[] {
  const re = /^math\.p(\d+)\.read$/
  const rows: TwoDigitAddsubProblemRow[] = []
  for (const u of response.utterances) {
    const m = re.exec(u.id)
    if (!m) continue
    const index = Number.parseInt(m[1]!, 10)
    const parsed = parseTwoDigitAddsubReadLine(u.text)
    const poolMatch = parsed
      ? (TWO_DIGIT_ADDSUB_POOL.find(
          (f) => f.a === parsed.a && f.b === parsed.b && f.op === parsed.op,
        ) ?? null)
      : null
    rows.push({
      index,
      utteranceId: u.id,
      text: u.text,
      parsed,
      poolMatch,
    })
  }
  rows.sort((x, y) => x.index - y.index)
  return rows
}

// ── distractor-trap predicates (Class 2 + Class 3 per spec §3) ──────────
//
// Both functions return the trap value if it is non-degenerate (in
// `[1, 99]`, distinct from `correct`, distinct from off-by-one) OR null
// if the trap collapses. The lint only needs to count non-null returns.
// Render-side derivation (Math.tsx) silently downgrades the same way.

/** Spec §3.3 — column-cross trap (Class 2, both ops, P4-P8 eligible).
 *
 *  For `+` with single-digit `b` (b in [1, 9]): tens digit = `a div 10`,
 *  units digit = `(a mod 10) + b` (no carry per pool guarantee). Trap is
 *  the units-tens swap: `((a mod 10) + b) * 10 + (a div 10)`.
 *
 *  For `+` with two-digit `b` (b in [10, 99]): tens digit = `(a div 10) +
 *  (b div 10)` (no carry per pool guarantee), units digit = `(a mod 10) +
 *  (b mod 10)`. Trap is the swap.
 *
 *  For `-` with single-digit `b`: tens digit = `a div 10`, units digit =
 *  `(a mod 10) - b` (no borrow per pool guarantee). Trap is the swap.
 *
 *  Degenerate cases:
 *    - Palindromic units result (e.g. correct=22 with tens=2,units=2): trap
 *      aliases correct.
 *    - Tens-zero result (e.g. trap evaluates to single-digit < 10): trap
 *      collapses below the chip range floor.
 *    - Trap within off-by-one of correct.
 */
function columnCrossTrap(fact: TwoDigitAddsubPoolFact): number | null {
  const { a, b, op } = fact
  const correct = op === '+' ? a + b : a - b
  let tens: number
  let units: number
  if (op === '+') {
    if (b < 10) {
      // single-digit-second-operand mainline
      tens = Math.floor(a / 10)
      units = (a % 10) + b
    } else {
      // two-digit-plus-two-digit (§7.2 Option B)
      tens = Math.floor(a / 10) + Math.floor(b / 10)
      units = (a % 10) + (b % 10)
    }
  } else {
    // op === '-' (subtrahend is single-digit per spec §0)
    tens = Math.floor(a / 10)
    units = (a % 10) - b
  }
  // Non-degeneracy: trap must be a valid 2-digit chip and distinct from
  // correct + off-by-one.
  const trap = units * 10 + tens
  if (trap < 10 || trap > 99) return null
  if (trap === correct) return null
  if (trap === correct - 1 || trap === correct + 1) return null
  return trap
}

/** Spec §3.4 — phantom-borrow trap (Class 3, op === '-' only, P5-P8
 *  eligible).
 *
 *  Trap formula: `correct - 10`. Models the over-application of borrow
 *  (child decrements the tens digit unnecessarily on a no-borrow problem).
 *
 *  Degenerate when `correct - 10 < 10` (trap drops below chip-range floor;
 *  for the v1 pool the smallest correct on the `-` side is 12, so trap=2
 *  — still ≥ 1 but below the typical chip-range floor of 10 for this
 *  tier. We accept trap ≥ 1 here; the render-side check decides whether
 *  to surface or downgrade based on the actual chip floor in use). */
function phantomBorrowTrap(fact: TwoDigitAddsubPoolFact): number | null {
  if (fact.op !== '-') return null
  const correct = fact.a - fact.b
  const trap = correct - 10
  if (trap < 1 || trap > 99) return null
  if (trap === correct) return null
  if (trap === correct - 1 || trap === correct + 1) return null
  return trap
}

/**
 * Lint a canon's plan against the two-digit-addsub composition rules.
 * Returns ALL violations across the 8-problem set — does not stop at the
 * first.
 *
 * Pure; no I/O.
 *
 * NOTE — PR A scope (split-PR pattern per `testing-and-ci.md §6`):
 * This function is EXPORTED but NOT yet wired into `bakeOne` /
 * `resolveTierBinding` / `runCompositionLint` dispatch / the
 * `CompositionFileFinding` union. The pre-existing
 * `public/canon/math/level-1/two-digit-addsub.json` was not yet under
 * spec-compliant composition rules — round-ten-prior is Haiku's
 * empirical saturation failure mode that §1.4 targets (Haiku gravitates
 * toward `20+3`, `30+5`, `40+2` across many bakes left unguarded).
 * Wiring is deferred to PR B (ticket follow-up to 86c9xkz9n).
 *
 * TODO (PR B activates: see testing-and-ci.md §6 "Split-PR pattern"
 * 3-line update — move two-digit-addsub.json out of OOS-list in
 * `runCompositionLint` disk-walker test, bump filesLinted +1, bump
 * filesSkipped -1):
 *   1. Add `'two-digit-addsub'` to `TierLintBinding` union below.
 *   2. Add the `two-digit-addsub.json` branch in `resolveTierBinding`.
 *   3. Add the `case 'two-digit-addsub':` arm in `runCompositionLint`'s
 *      switch.
 *   4. Add `'two-digit-addsub'` to `CompositionFileFinding.tier` union.
 *   5. Sharpen the `MATH_TRACK_GUIDE` two-digit-addsub directive at
 *      `api/_planner.ts:1176-1177` per spec §4.1 — replace the bare
 *      one-line directive with the full FACT POOL bullet block + the
 *      SESSION COMPOSITION RULES enumeration. Fold in Wave 2 prereq
 *      86c9xa817 (subtraction read-template "How many?" → "How many are
 *      left?" — and tighten `TWO_DIGIT_ADDSUB_RE_MINUS` to require the
 *      "are left" suffix).
 *   6. Re-bake `public/canon/math/level-1/two-digit-addsub.json` via the
 *      per-tier rebake recipe (`planner-and-canon.md` § "Per-tier rebake
 *      recipe"); commit the JSON diff in the same PR.
 *   7. Flip the deferred test marker:
 *        expect(resolveTierBinding('two-digit-addsub.json')).toBe(
 *          'two-digit-addsub')
 *      (drop the existing `.toBeNull()` assertion seeded in PR A).
 */
export function lintTwoDigitAddsubComposition(
  response: Pick<SessionStartResponse, 'utterances'>,
  config: TwoDigitAddsubRulesConfig = TWO_DIGIT_ADDSUB_RULES,
): CompositionViolation[] {
  const violations: CompositionViolation[] = []
  const problems = extractTwoDigitAddsubProblems(response)

  // ── unparseable / pool-membership pass ──
  for (const p of problems) {
    if (p.parsed === null) {
      violations.push({
        rule: 'unparseable-problem',
        problemIndex: p.index,
        message:
          `P${p.index} (${p.utteranceId}) text does not match either ` +
          `two-digit-addsub read template ("<addend-A> plus <addend-B>. ` +
          `How many?" OR "<minuend> minus <subtrahend>. How many?"): ` +
          JSON.stringify(p.text),
        factId: null,
      })
      continue
    }
    if (p.poolMatch === null) {
      const sum =
        p.parsed.op === '+' ? p.parsed.a + p.parsed.b : p.parsed.a - p.parsed.b
      violations.push({
        rule: 'pool-membership',
        problemIndex: p.index,
        message:
          `P${p.index} fact ${p.parsed.a}${p.parsed.op}${p.parsed.b}=` +
          `${sum} is NOT in the 36-fact two-digit-addsub pool. Either ` +
          `it violates the no-regroup constraint, the operand range ` +
          `(a in [10, 99], b in [1, 9] OR [10, 99] for ` +
          `two-digit-plus-two-digit), the answer range ([12, 73] for ` +
          `+, [12, 64] for -), or it is a valid in-range fact outside ` +
          `the v1 curation (deferred per spec §1.5). See ` +
          `design/math/two-digit-addsub-content.md §1.1.`,
        factId: `${p.parsed.a}${p.parsed.op}${p.parsed.b}`,
      })
    }
  }

  const matched = problems.filter(
    (
      p,
    ): p is TwoDigitAddsubProblemRow & { poolMatch: TwoDigitAddsubPoolFact } =>
      p.poolMatch !== null,
  )

  // ── band-by-slot pass ──
  for (const p of matched) {
    const allowed = config.bandAllowedSlots[p.poolMatch.band]
    if (!allowed.includes(p.index)) {
      violations.push({
        rule: 'band-by-slot',
        problemIndex: p.index,
        message:
          `P${p.index} carries ${p.poolMatch.band} fact ` +
          `${p.poolMatch.id} (category ${p.poolMatch.category}). ` +
          `${p.poolMatch.band}-band is only allowed at slots ` +
          `[${allowed.join(', ')}].`,
        factId: p.poolMatch.id,
      })
    }
  }

  // ── category-cap pass ──
  type MatchedTwoDigitRow = TwoDigitAddsubProblemRow & {
    poolMatch: TwoDigitAddsubPoolFact
  }
  const categoryCounts: Record<string, MatchedTwoDigitRow[]> = {}
  for (const p of matched) {
    const cat = p.poolMatch.category
    if (!categoryCounts[cat]) categoryCounts[cat] = []
    categoryCounts[cat]!.push(p)
  }
  for (const [cat, rows] of Object.entries(categoryCounts)) {
    const cap = config.categoryCaps[cat as TwoDigitAddsubCategory]
    if (cap === undefined) continue
    if (rows.length > cap) {
      violations.push({
        rule: 'category-cap',
        problemIndex: null,
        message:
          `Category "${cat}" cap is ${cap}; canon has ${rows.length} ` +
          `(slots P${rows.map((r) => r.index).join(', P')}; facts ` +
          `${rows.map((r) => r.poolMatch.id).join(', ')}).` +
          (cat === 'round-ten-anchor'
            ? ` Round-ten-prior correction lever — per spec §1.4 Haiku's` +
              ` empirical prior saturates this category across bakes (the` +
              ` easiest representational instance of the tier); cap at` +
              ` ${cap} holds it to 1-of-8. Reject the second` +
              ` round-ten-anchor.`
            : ''),
        factId: null,
      })
    }
  }

  // ── op-mix pass (spec §2.2 — first tier with mixed-op rules) ──
  if (matched.length === config.totalProblems) {
    let addCount = 0
    let subCount = 0
    for (const p of matched) {
      if (p.poolMatch.op === '+') addCount++
      else subCount++
    }
    const isAllowed = config.allowedOpMixes.some(
      (m) => m.addCount === addCount && m.subCount === subCount,
    )
    if (!isAllowed) {
      const allowedStr = config.allowedOpMixes
        .map((m) => `${m.addCount}+/${m.subCount}-`)
        .join(', ')
      violations.push({
        rule: 'op-mix',
        problemIndex: null,
        message:
          `Op-mix is ${addCount}+/${subCount}-; not in allowed set ` +
          `[${allowedStr}]. Per spec §2.2: at least 5 '+' AND at least ` +
          `2 '-' problems; allowed mixes are ${allowedStr}. FORBIDDEN: ` +
          `8+/0-, 7+/1-, 4+/4-, 3+/5-, and any combination summing to ` +
          `something other than 8.`,
        factId: null,
      })
    }
  }

  // ── p1-is-plus pass (spec §2.2 — session opener carries onset anxiety) ──
  const p1 = matched.find((p) => p.index === 1)
  if (p1 && p1.poolMatch.op !== '+') {
    violations.push({
      rule: 'p1-is-plus',
      problemIndex: 1,
      message:
        `P1 carries op '${p1.poolMatch.op}' (fact ${p1.poolMatch.id}). ` +
        `Per spec §2.2 P1 must always be op '+': session opener carries ` +
        `onset anxiety and the more confident operation (per Marian's ` +
        `April 2026 diagnostic) must enter first.`,
      factId: p1.poolMatch.id,
    })
  }

  // ── dual-exposure pass (spec §5.5 — load-bearing per v1) ──
  //
  // For every (a, b, op) triple in the session, the inverse triple is
  // FORBIDDEN. Inverse for + fact a+b=c: -fact c-b=a OR c-a=b. Inverse for
  // - fact a-b=c: +fact c+b=a (equivalently a-b=c implies b+c=a).
  //
  // Practically (against the v1 pool) the only candidate collisions are
  // facts where both halves of the operand triple appear as pool entries
  // in opposite ops. Today: 33+4=37 (in pool) ↔ 37-4=33 (NOT in pool —
  // pool has 37-4 as a + complement absent). The rule is asserted across
  // every triple combination regardless; it's load-bearing forward-compat.
  const tripleKey = (a: number, b: number, op: TwoDigitAddsubOp): string =>
    `${a}${op}${b}`
  const seenTriples = new Map<string, MatchedTwoDigitRow>()
  for (const p of matched) {
    seenTriples.set(tripleKey(p.poolMatch.a, p.poolMatch.b, p.poolMatch.op), p)
  }
  for (const p of matched) {
    const { a, b, op } = p.poolMatch
    const correct = op === '+' ? a + b : a - b
    // Each fact a OP b = c implies three "inverse" forms.
    // For +: a+b=c → -inverse: c-b=a (always), c-a=b (if a<10 — second
    //   operand stays single-digit). For 2-digit-plus-2-digit: c-b=a
    //   and c-a=b both valid candidates.
    // For -: a-b=c → +inverse: c+b=a (always), b+c=a (commutative).
    //   For the v1 - pool where b is single-digit, c+b=a is the form
    //   that would appear as a + fact.
    const inverses: Array<{ a: number; b: number; op: TwoDigitAddsubOp }> = []
    if (op === '+') {
      // c - b = a; c - a = b (latter often out of -pool by being negative
      // or having two-digit subtrahend, but we check the key match).
      inverses.push({ a: correct, b, op: '-' })
      inverses.push({ a: correct, b: a, op: '-' })
    } else {
      // c + b = a (the canonical + inverse)
      inverses.push({ a: correct, b, op: '+' })
      // b + c = a (commutative — but only if both single-digit, else
      // not in pool by construction).
      inverses.push({ a: b, b: correct, op: '+' })
    }
    for (const inv of inverses) {
      const invKey = tripleKey(inv.a, inv.b, inv.op)
      const invMatch = seenTriples.get(invKey)
      if (!invMatch) continue
      // Avoid double-reporting: only emit once per ordered pair (the
      // pair with smaller `index` raises the violation).
      if (invMatch.index <= p.index) continue
      violations.push({
        rule: 'dual-exposure',
        problemIndex: null,
        message:
          `Dual-exposure rule (spec §5.5): fact ${p.poolMatch.id} at P` +
          `${p.index} co-occurs with its inverse ${invMatch.poolMatch.id} ` +
          `at P${invMatch.index}. The operand triple ` +
          `(${a}, ${b}, ${correct}) must NOT appear in both '+' and '-' ` +
          `forms within the same session.`,
        factId: `${p.poolMatch.id}↔${invMatch.poolMatch.id}`,
      })
    }
  }

  // ── high-leverage-coverage pass (>= 1 near-boundary-no-cross in P5-P8) ──
  //
  // STRICTER P5-P8 framing per spec §2.4 (sibling to add-to-20's
  // make-ten-bridge rule) — P4 is MEDIUM-only and several MEDIUM facts
  // are near-boundary-no-cross (#11=34+5, #19=26-5), so a P4-P8 rule would
  // be trivially satisfied. P5-P8 forces the rule to bind.
  const nearBoundaryInDiscriminate = matched.filter(
    (p) => p.poolMatch.category === 'near-boundary-no-cross' && p.index >= 5,
  )
  if (
    nearBoundaryInDiscriminate.length < config.nearBoundaryNoCrossInP5ToP8Min
  ) {
    violations.push({
      rule: 'high-leverage-coverage',
      problemIndex: null,
      message:
        `At least ${config.nearBoundaryNoCrossInP5ToP8Min} ` +
        `near-boundary-no-cross fact(s) MUST appear in P5-P8 (the ` +
        `cycle-5-regroup-prep diagnostic per spec §2.4 — the actual ` +
        `learning target of the tier). STRICTER than sibling tiers' ` +
        `P4-P8 framing: P4 is MEDIUM-only and several MEDIUM facts are ` +
        `near-boundary-no-cross (#11=34+5, #19=26-5), so a P4-P8 rule ` +
        `would be trivially satisfied; P5-P8 forces the rule to bind. ` +
        `Canon has ${nearBoundaryInDiscriminate.length} ` +
        `near-boundary-no-cross fact(s) in P5-P8.`,
      factId: null,
    })
  }

  // ── diagnostic-coverage pass (Class 2 + Class 3 trap admissibility) ──
  //
  // Spec §3.8: ≥ 2 in-range Class 2 (column-cross) traps across P4-P8
  // AND ≥ 1 in-range Class 3 (phantom-borrow) trap across P5-P8 '-'
  // problems. Trap derivation is render-side (Math.tsx); the lint asserts
  // the pool-fact-set chosen by Haiku ADMITS the trap derivation in-range
  // for the required minimum count. Computed purely from (a, b, op, c) —
  // no coupling to the render pipeline.
  const p4ToP8 = matched.filter((p) => p.index >= 4 && p.index <= 8)
  const classTwoInRange = p4ToP8.filter(
    (p) => columnCrossTrap(p.poolMatch) !== null,
  )
  if (classTwoInRange.length < config.classTwoColumnCrossInP4ToP8Min) {
    violations.push({
      rule: 'diagnostic-coverage',
      problemIndex: null,
      message:
        `At least ${config.classTwoColumnCrossInP4ToP8Min} in-range ` +
        `Class 2 (column-cross) trap(s) MUST be admissible across ` +
        `P4-P8 per spec §3.8 (the diagnostic instrument for ` +
        `concatenated-single-digit-processing — Dave NOF #1). Canon ` +
        `has ${classTwoInRange.length} P4-P8 fact(s) whose column-cross ` +
        `trap is in [10, 99] AND non-degenerate (distinct from correct ` +
        `+ off-by-one). Re-bake with at least one additional P4-P8 fact ` +
        `that admits a non-degenerate column-cross trap.`,
      factId: null,
    })
  }
  const p5ToP8Minus = matched.filter(
    (p) => p.index >= 5 && p.index <= 8 && p.poolMatch.op === '-',
  )
  const classThreeInRange = p5ToP8Minus.filter(
    (p) => phantomBorrowTrap(p.poolMatch) !== null,
  )
  if (classThreeInRange.length < config.classThreePhantomBorrowInP5ToP8Min) {
    violations.push({
      rule: 'diagnostic-coverage',
      problemIndex: null,
      message:
        `At least ${config.classThreePhantomBorrowInP5ToP8Min} in-range ` +
        `Class 3 (phantom-borrow) trap(s) MUST be admissible across ` +
        `P5-P8 '-' problems per spec §3.8 (the over-regrouping ` +
        `diagnostic). Canon has ${classThreeInRange.length} P5-P8 '-' ` +
        `fact(s) whose phantom-borrow trap is in [1, 99] AND ` +
        `non-degenerate. Re-bake with at least one '-' fact at P5-P8 ` +
        `whose (correct - 10) admits a non-degenerate trap.`,
      factId: null,
    })
  }

  // ── no-duplicates pass ──
  const seenIds = new Map<string, TwoDigitAddsubProblemRow[]>()
  for (const p of matched) {
    const key = p.poolMatch.id
    if (!seenIds.has(key)) seenIds.set(key, [])
    seenIds.get(key)!.push(p)
  }
  for (const [factId, rows] of seenIds.entries()) {
    if (rows.length > 1) {
      violations.push({
        rule: 'no-duplicates',
        problemIndex: null,
        message:
          `Fact ${factId} appears ${rows.length} times ` +
          `(slots P${rows.map((r) => r.index).join(', P')}). ` +
          `No duplicate (a, b, op) triples allowed within the 8-problem ` +
          `set. Note: 25-3 and 22+3 are distinct ordered triples (the ` +
          `op flag is part of identity) — but dual-exposure forbids ` +
          `their co-occurrence per spec §5.5.`,
        factId,
      })
    }
  }

  return violations
}

/**
 * Throwing helper for the bake-time integration point. The throw aborts
 * the bake and stops the (compositionally invalid) JSON from reaching
 * disk.
 *
 * `canonId` is a human-readable identifier (e.g. `"math/two-digit-addsub"`).
 *
 * NOTE (PR A scope): exported but not yet called from `bakeOne`. PR B
 * activates the binding alongside a fresh canon — see the TODO in
 * `lintTwoDigitAddsubComposition` above.
 */
export function assertTwoDigitAddsubCompositionClean(
  canonId: string,
  response: Pick<SessionStartResponse, 'utterances'>,
  config: TwoDigitAddsubRulesConfig = TWO_DIGIT_ADDSUB_RULES,
): void {
  const violations = lintTwoDigitAddsubComposition(response, config)
  if (violations.length > 0) {
    throw new CompositionLintError(canonId, violations)
  }
}

// ── two-digit-addsub-with-regroup: pool, rules, parser, lint, assert ────
//
// Wave-5 tier (parallel-sequencing cycle 5). FIRST tier where regrouping
// (carry on `+`, borrow on `-`) is the conceptual learning target — the
// no-regroup Wave-4 sibling explicitly FORBIDS these facts; this tier
// explicitly REQUIRES them.
//
// Spec: `design/math/two-digit-addsub-with-regroup-content.md`
// Ticket: 86c9y01ee (PR A — lint infra, naming-agnostic at schema level)
// Structural precedent: `two-digit-addsub` PR #291 (lint infra) → PR #292
// (rebake + binding activation). This module follows the SAME split-PR
// pattern per `testing-and-ci.md §6` — PR A ships infra + binding registry
// entry; canon does not exist at PR A time (verified spec §5.1), so the
// disk-walker is a no-op against this tier until PR B bakes the canon and
// the binding fires for the first time.
//
// What's DIFFERENT from the Wave-4 sibling:
//   - Pool inversion: carry-required `+` and borrow-required `-` facts —
//     the EXACT facts the Wave-4 lint REJECTS — are now the pool. The
//     Wave-4 pool's `mid-decade-units-shift` / `near-boundary-no-cross` /
//     `tens-doubles-echo` / `round-ten-anchor` categories are FORBIDDEN
//     here (they're no-regroup facts).
//   - Three pool categories per spec §1.2: `carry-from-units` (`+` only,
//     18 facts), `borrow-from-tens` (`-` only, 9 facts), `round-ten-cross-
//     down` (`-` only, 3 facts). Total 30 facts (Option A — spec §1.1
//     prefers 30 over a 36-fact Wave-4-style mirror given the higher
//     per-fact cognitive load at this tier).
//   - Category caps per spec §1.5: carry-from-units ≤ 5, borrow-from-tens
//     ≤ 3, round-ten-cross-down ≤ 1 (saturation-prior cap — Haiku will
//     gravitate to round-ten anchors at this tier just as it did at the
//     Wave-4 round-ten-anchor category, per `[[feedback_haiku_directive_
//     sharpening]]`).
//   - High-leverage coverage: ≥ 1 `borrow-from-tens` fact MUST appear at
//     P5-P8 (the `+` side is satisfied trivially because every `+` fact
//     in the pool IS a `carry-from-units` fact by construction).
//   - Read-line templates UNCHANGED from Wave 4 (spec §1.6) — same
//     hyphenated quantity-word form, same "+" / "-" trailing-phrase
//     discriminator. Parser reuses the Wave-4 regex + number-word table
//     via the sibling `parseTwoDigitAddsubReadLine` function (re-exported
//     here under the with-regroup name for symmetry).
//
// What's SHARED with the Wave-4 sibling:
//   - 8-problem session size, band-by-slot framing (P1 always '+', P1-P3
//     EASY only, P4 MEDIUM-only, P5-P8 MEDIUM/HARD), op-mix rules (5+/3-
//     default, 6+/2- allowed, 4+/4- + 8+/0- + 7+/1- + 3+/5- FORBIDDEN),
//     dual-exposure rule (forward-compat; v1 audit per spec §3.3 finds
//     ZERO in-pool cross-op collisions but the rule asserts regardless).
//
// What's NOT in PR A (deferred to PR B per spec §4 + ticket 86c9y01ee OOS):
//   - Canon rebake — public/canon/math/level-1/two-digit-addsub-with-
//     regroup.json does not exist at PR A time; PR B bakes it.
//   - Class-name finalisation for `perProblemDistractorClass` literals
//     (Dave's `forgottenCarry*` / `smallerFromLarger*` / `borrowNoDecrement*`
//     vs Wave-4-style `columnCross*` / `phantomBorrow*`). Lint here is
//     POOL-CATEGORY-focused (pedagogical categories per spec §1.2 —
//     `carry-from-units` / `borrow-from-tens` / `round-ten-cross-down`)
//     and does NOT enforce distractor-class membership from canon JSON;
//     canon doesn't carry the field (it lives on `Progress.history` per
//     PR #302 schema). The naming-agnostic `KNOWN_DISTRACTOR_CLASSES` set
//     below is exported for forward-compat with PR B's render-side
//     binding activation; it accepts BOTH naming styles during the
//     transition per ticket 86c9y01ee dispatch contract.
//   - SkillNode taxonomy widening — separate ticket per
//     `[[feedback_sibling_tier_checklist]]`; affects schema/Hub/planner,
//     not this lint module.
//   - Bake-time `bakeOne` integration — wired in PR B alongside the canon
//     under-test, mirroring Wave-4's `two-digit-addsub` chain at
//     `generateSessionCanon.ts:442+`.

/**
 * Forward-compat enum of every distractor-class literal that production
 * code (PR B onwards) may set on `Progress.history[].perProblemDistractor
 * Class` for a `two-digit-addsub-with-regroup` session. Class-naming-
 * agnostic at PR A per ticket 86c9y01ee dispatch contract:
 *
 *   - Dave's names (canonical post-pivot per `wave-5-borrow-carry-error-
 *     patterns.md` §3 Candidates A/B/C; corresponds to the helper
 *     function names already exported from `src/screens/Math/distractors.
 *     ts` at lines 546/596/659): `forgottenCarryDistractors`,
 *     `smallerFromLargerDistractors`, `borrowNoDecrementDistractors`.
 *   - Wave-4-style names (transitional; matches the kebab-case literals
 *     already in the `PickDistractorsOpts.distractorClass` union at
 *     `distractors.ts:219`): `columnCrossDistractor`, `phantomBorrow
 *     Distractor`.
 *
 * NOTE: this set is EXPORTED but not yet referenced by any in-tree lint
 * pass — canon JSON does not carry per-problem distractor-class metadata
 * (it lives on `Progress.history` shipped to `/api/claude` session-end,
 * not on the static canon envelope). PR B activates the binding once a
 * concrete consumer surfaces; PR A's job is to fix the schema-level
 * naming surface so the transition is reversible.
 *
 * TODO Wave 5 PR B: remove Wave-4-style names; lock to Dave's names once
 * Kyle's spec-amendment PR merges (ticket TBD).
 */
export const KNOWN_DISTRACTOR_CLASSES = new Set([
  // Dave's names (canonical post-pivot)
  'forgottenCarryDistractors',
  'smallerFromLargerDistractors',
  'borrowNoDecrementDistractors',
  // Wave-4-style names (transitional, removed in PR B)
  'columnCrossDistractor',
  'phantomBorrowDistractor',
])

export type TwoDigitAddsubWithRegroupBand = 'EASY' | 'MEDIUM' | 'HARD'

export type TwoDigitAddsubWithRegroupCategory =
  | 'carry-from-units'
  | 'borrow-from-tens'
  | 'round-ten-cross-down'

export type TwoDigitAddsubWithRegroupOp = '+' | '-'

export interface TwoDigitAddsubWithRegroupPoolFact {
  /** Stable "<a><op><b>" id, e.g. "27+6", "32-5". Op is part of identity
   *  per spec §1.1 — distinct triples (and dual-exposure forbids inverse
   *  triples co-occurring per forward-compat rule). */
  id: string
  a: number
  b: number
  op: TwoDigitAddsubWithRegroupOp
  band: TwoDigitAddsubWithRegroupBand
  category: TwoDigitAddsubWithRegroupCategory
}

/** The 30-fact pool from spec §1.4 (Option A — preferred over a 36-fact
 *  Wave-4-mirror per spec §1.1 cognitive-load argument). All facts satisfy
 *  EITHER the carry-required `+` constraint (`(a mod 10) + b > 9`) OR the
 *  borrow-required `-` constraint (`(a mod 10) < b`). Operand range:
 *  `a ∈ [10, 99]` (v1 caps decade at 60 for representational coherence
 *  with Wave 4 — no 70s/80s/90s); `b ∈ [1, 9]` for the single-digit-
 *  second-operand mainline (two-digit-plus-two-digit-with-regroup deferred
 *  to v2 per spec §3.5 Q3).
 *
 *  Pool composition (verified against spec §1.4 cross-check):
 *    - EASY band (9 facts): 6 `+` + 3 `-`
 *    - MEDIUM band (11 facts): 7 `+` + 3 `-` borrow + 1 `-` round-ten
 *    - HARD band (10 facts): 5 `+` + 3 `-` borrow + 2 `-` round-ten
 *    - Op counts: 18 `+` (carry-from-units) + 12 `-` (9 borrow + 3
 *      round-ten)
 *    - Answer range: [17, 64] — both endpoints in `[1, 99]`.
 *  Spec §1.4 lists facts numbered 1–30; this constant preserves that
 *  numbering as inline `// #N` comments for traceability against the
 *  drift-guard test target. */
export const TWO_DIGIT_ADDSUB_WITH_REGROUP_POOL: readonly TwoDigitAddsubWithRegroupPoolFact[] =
  [
    // ── EASY band (9 facts; P1-P3 gentle ramp; also P4-P8 fallback) ──────
    // #1
    {
      id: '15+8',
      a: 15,
      b: 8,
      op: '+',
      band: 'EASY',
      category: 'carry-from-units',
    },
    // #2
    {
      id: '17+5',
      a: 17,
      b: 5,
      op: '+',
      band: 'EASY',
      category: 'carry-from-units',
    },
    // #3
    {
      id: '19+4',
      a: 19,
      b: 4,
      op: '+',
      band: 'EASY',
      category: 'carry-from-units',
    },
    // #4
    {
      id: '13+9',
      a: 13,
      b: 9,
      op: '+',
      band: 'EASY',
      category: 'carry-from-units',
    },
    // #5
    {
      id: '16+6',
      a: 16,
      b: 6,
      op: '+',
      band: 'EASY',
      category: 'carry-from-units',
    },
    // #6
    {
      id: '14+7',
      a: 14,
      b: 7,
      op: '+',
      band: 'EASY',
      category: 'carry-from-units',
    },
    // #7 (replaced per spec §1.4 — the original `12-5=7` placeholder was
    // excluded for crossing the single-digit-result boundary into sub-to-20
    // territory; #7-revised is `21-4=17` borrow-from-tens, two-digit result)
    {
      id: '21-4',
      a: 21,
      b: 4,
      op: '-',
      band: 'EASY',
      category: 'borrow-from-tens',
    },
    // #8
    {
      id: '22-5',
      a: 22,
      b: 5,
      op: '-',
      band: 'EASY',
      category: 'borrow-from-tens',
    },
    // #9
    {
      id: '23-6',
      a: 23,
      b: 6,
      op: '-',
      band: 'EASY',
      category: 'borrow-from-tens',
    },
    // ── MEDIUM band (11 facts; P4-P8 eligible) ───────────────────────────
    // #10 — the Wave-4 §1 FORBIDDEN example (`27+6`) surfaces here as
    // ALLOWED — that role inversion is the whole point of this tier.
    {
      id: '27+6',
      a: 27,
      b: 6,
      op: '+',
      band: 'MEDIUM',
      category: 'carry-from-units',
    },
    // #11
    {
      id: '25+8',
      a: 25,
      b: 8,
      op: '+',
      band: 'MEDIUM',
      category: 'carry-from-units',
    },
    // #12
    {
      id: '29+5',
      a: 29,
      b: 5,
      op: '+',
      band: 'MEDIUM',
      category: 'carry-from-units',
    },
    // #13
    {
      id: '35+7',
      a: 35,
      b: 7,
      op: '+',
      band: 'MEDIUM',
      category: 'carry-from-units',
    },
    // #14
    {
      id: '38+4',
      a: 38,
      b: 4,
      op: '+',
      band: 'MEDIUM',
      category: 'carry-from-units',
    },
    // #15
    {
      id: '46+7',
      a: 46,
      b: 7,
      op: '+',
      band: 'MEDIUM',
      category: 'carry-from-units',
    },
    // #16
    {
      id: '48+5',
      a: 48,
      b: 5,
      op: '+',
      band: 'MEDIUM',
      category: 'carry-from-units',
    },
    // #17 — the Wave-4 §1 FORBIDDEN example (`32-5`) surfaces here as ALLOWED.
    {
      id: '32-5',
      a: 32,
      b: 5,
      op: '-',
      band: 'MEDIUM',
      category: 'borrow-from-tens',
    },
    // #18
    {
      id: '41-6',
      a: 41,
      b: 6,
      op: '-',
      band: 'MEDIUM',
      category: 'borrow-from-tens',
    },
    // #19
    {
      id: '53-8',
      a: 53,
      b: 8,
      op: '-',
      band: 'MEDIUM',
      category: 'borrow-from-tens',
    },
    // #20 — first round-ten-cross-down (minuend ends in 0, units column
    // starts at 0 ⇒ every subtrahend forces borrow). Saturation-prior cap
    // candidate per spec §1.5 (≤ 1 per session).
    {
      id: '30-4',
      a: 30,
      b: 4,
      op: '-',
      band: 'MEDIUM',
      category: 'round-ten-cross-down',
    },
    // ── HARD band (10 facts; P5-P8 eligible) ─────────────────────────────
    // #21
    {
      id: '45+8',
      a: 45,
      b: 8,
      op: '+',
      band: 'HARD',
      category: 'carry-from-units',
    },
    // #22
    {
      id: '47+6',
      a: 47,
      b: 6,
      op: '+',
      band: 'HARD',
      category: 'carry-from-units',
    },
    // #23
    {
      id: '49+4',
      a: 49,
      b: 4,
      op: '+',
      band: 'HARD',
      category: 'carry-from-units',
    },
    // #24
    {
      id: '55+9',
      a: 55,
      b: 9,
      op: '+',
      band: 'HARD',
      category: 'carry-from-units',
    },
    // #25
    {
      id: '58+6',
      a: 58,
      b: 6,
      op: '+',
      band: 'HARD',
      category: 'carry-from-units',
    },
    // #26
    {
      id: '52-7',
      a: 52,
      b: 7,
      op: '-',
      band: 'HARD',
      category: 'borrow-from-tens',
    },
    // #27
    {
      id: '61-8',
      a: 61,
      b: 8,
      op: '-',
      band: 'HARD',
      category: 'borrow-from-tens',
    },
    // #28
    {
      id: '64-9',
      a: 64,
      b: 9,
      op: '-',
      band: 'HARD',
      category: 'borrow-from-tens',
    },
    // #29 — second round-ten-cross-down. §1.5 cap (≤ 1) FORBIDS this
    // co-occurring with #20 or #30 in a session.
    {
      id: '40-7',
      a: 40,
      b: 7,
      op: '-',
      band: 'HARD',
      category: 'round-ten-cross-down',
    },
    // #30 — third round-ten-cross-down. §1.5 cap (≤ 1) FORBIDS this
    // co-occurring with #20 or #29 in a session.
    {
      id: '50-8',
      a: 50,
      b: 8,
      op: '-',
      band: 'HARD',
      category: 'round-ten-cross-down',
    },
  ] as const

/** Tier rule config — what the two-digit-addsub-with-regroup lint
 *  enforces. Mirrors `TwoDigitAddsubRulesConfig` shape but drops the
 *  Wave-4-specific `nearBoundaryNoCrossInP5ToP8Min` /
 *  `classTwoColumnCrossInP4ToP8Min` / `classThreePhantomBorrowInP5ToP8Min`
 *  fields (the trap-admissibility checks belong to the Wave-4 tier where
 *  the trap classes are diagnostic instruments; at Wave 5 they are
 *  EXPECTED tap targets and the OUT-gate criterion shifts to "tap-rate
 *  reduction across sessions" per spec §2.1 — not gated at canon-bake
 *  time). Adds `borrowFromTensInP5ToP8Min` per spec §1.3 high-leverage
 *  coverage rule. */
export interface TwoDigitAddsubWithRegroupRulesConfig {
  pool: readonly TwoDigitAddsubWithRegroupPoolFact[]
  categoryCaps: Record<TwoDigitAddsubWithRegroupCategory, number>
  /** Slots (1-indexed) where each band is allowed. */
  bandAllowedSlots: Record<TwoDigitAddsubWithRegroupBand, readonly number[]>
  /** Allowed op-mix combinations per spec §1.1 + §3.2. Each entry is
   *  `{ addCount, subCount }`; lint asserts the session matches one of
   *  these. Default: 5+/3-, 6+/2-. */
  allowedOpMixes: readonly { addCount: number; subCount: number }[]
  /** Whole-session minimum count of `borrow-from-tens` facts within P5-P8
   *  (the cycle-5 `-` learning target per spec §1.3). The `+` side is
   *  satisfied trivially because every `+` fact in the pool IS a
   *  `carry-from-units` fact by construction — no separate `+` rule
   *  needed. */
  borrowFromTensInP5ToP8Min: number
  totalProblems: number
}

export const TWO_DIGIT_ADDSUB_WITH_REGROUP_RULES: TwoDigitAddsubWithRegroupRulesConfig =
  {
    pool: TWO_DIGIT_ADDSUB_WITH_REGROUP_POOL,
    categoryCaps: {
      // Carry-from-units capped generously per spec §1.5 — IS the `+`
      // learning target. Pool has 18 facts (60% of pool); cap at 5 binds
      // only on `+`-heavy sessions.
      'carry-from-units': 5,
      // Borrow-from-tens capped at 3 per spec §1.5 — matches the `-`
      // count cap from op-mix; every `-` problem in a default-mix session
      // IS a borrow problem.
      'borrow-from-tens': 3,
      // Round-ten-cross-down capped tight at 1 per spec §1.5 — the
      // saturation-prior correction lever (sibling to Wave-4's
      // round-ten-anchor cap). Haiku's empirical prior at the previous
      // two-digit tier saturates round-ten anchors across bakes (the
      // easiest representational instance of the tier); cap at 1 holds
      // it to 1-of-8 (12.5% of the session). NEGATIVE ANCHOR per
      // `[[feedback_haiku_directive_sharpening]]`: FORBIDDEN to place
      // any two of `30-4`, `40-7`, `50-8` in the same session.
      'round-ten-cross-down': 1,
    },
    bandAllowedSlots: {
      // P1-P3 gentle-ramp only — EASY FORBIDDEN at P4-P8 per spec §1.3.
      // Mirrors the sub-to-10 / sub-to-20 tightening from Dave's NOF #1
      // (PR #247) — the discriminate tier must not lean on gentle-ramp
      // facts. Wave-5 inherits the stricter framing from the start.
      EASY: [1, 2, 3],
      MEDIUM: [4, 5, 6, 7, 8],
      HARD: [5, 6, 7, 8],
    },
    // Spec §1.1: 5+/3- (default) OR 6+/2- (low-score modulation). Lint
    // FORBIDS 8+/0-, 7+/1-, 4+/4-, 3+/5-, and any combination summing to
    // something other than 8.
    allowedOpMixes: [
      { addCount: 5, subCount: 3 },
      { addCount: 6, subCount: 2 },
    ],
    // Spec §1.3: ≥ 1 borrow-from-tens fact MUST appear in P5-P8 (the
    // cycle-5 `-` learning target). Same STRICTER P5-P8 framing as
    // add-to-20 / two-digit-addsub — P4 is MEDIUM-only and many MEDIUM
    // facts are borrow-from-tens, so a P4-P8 rule would be trivially
    // satisfied.
    borrowFromTensInP5ToP8Min: 1,
    totalProblems: 8,
  }

// ── core: lint a SessionStartResponse against with-regroup rules ────────

interface TwoDigitAddsubWithRegroupProblemRow {
  index: number // 1-indexed
  utteranceId: string
  text: string
  parsed: ParsedTwoDigitFact | null
  poolMatch: TwoDigitAddsubWithRegroupPoolFact | null
}

/**
 * Parse a two-digit-addsub-with-regroup read-line into `{ a, b, op }`.
 * Read-line templates are IDENTICAL to the Wave-4 sibling per spec §1.6
 * (no new prosody work); this function is a thin alias over the Wave-4
 * `parseTwoDigitAddsubReadLine` re-exported here for caller-side
 * symmetry. The pool-match lookup downstream rejects facts that don't
 * satisfy the regroup constraint (`(a mod 10) + b > 9` for `+`,
 * `(a mod 10) < b` for `-`) by virtue of those facts not being in
 * `TWO_DIGIT_ADDSUB_WITH_REGROUP_POOL` — they live in the Wave-4 pool
 * instead.
 */
export function parseTwoDigitAddsubWithRegroupReadLine(
  text: string,
): ParsedTwoDigitFact | null {
  return parseTwoDigitAddsubReadLine(text)
}

function extractTwoDigitAddsubWithRegroupProblems(
  response: Pick<SessionStartResponse, 'utterances'>,
): TwoDigitAddsubWithRegroupProblemRow[] {
  const re = /^math\.p(\d+)\.read$/
  const rows: TwoDigitAddsubWithRegroupProblemRow[] = []
  for (const u of response.utterances) {
    const m = re.exec(u.id)
    if (!m) continue
    const index = Number.parseInt(m[1]!, 10)
    const parsed = parseTwoDigitAddsubWithRegroupReadLine(u.text)
    const poolMatch = parsed
      ? (TWO_DIGIT_ADDSUB_WITH_REGROUP_POOL.find(
          (f) => f.a === parsed.a && f.b === parsed.b && f.op === parsed.op,
        ) ?? null)
      : null
    rows.push({
      index,
      utteranceId: u.id,
      text: u.text,
      parsed,
      poolMatch,
    })
  }
  rows.sort((x, y) => x.index - y.index)
  return rows
}

/**
 * Lint a canon's plan against the two-digit-addsub-with-regroup
 * composition rules. Returns ALL violations across the 8-problem set —
 * does not stop at the first.
 *
 * Pure; no I/O.
 *
 * Rule passes (in order):
 *   1. unparseable / pool-membership
 *   2. band-by-slot
 *   3. category-cap (5 / 3 / 1 per spec §1.5)
 *   4. op-mix (5+/3- or 6+/2- per spec §1.1)
 *   5. p1-is-plus (spec §1.3)
 *   6. dual-exposure (forward-compat; v1 audit zero collisions per
 *      spec §3.3)
 *   7. high-leverage coverage (≥ 1 borrow-from-tens in P5-P8 per
 *      spec §1.3)
 *   8. no-duplicates
 *
 * NOTE (PR A scope per `testing-and-ci.md §6` split-PR pattern): this
 * function is EXPORTED and the binding IS registered in `resolveTier
 * Binding` below. Canon does not exist at PR A time (spec §5.1 verified
 * empirically); PR B (canon rebake) is the FIRST PR where the binding
 * fires in production. The `lintBeforeRebake` failing-first test in
 * `compositionLint.test.ts` proves the lint catches the documented
 * violations against synthetic fixtures BEFORE the canon ships.
 */
export function lintTwoDigitAddsubWithRegroupComposition(
  response: Pick<SessionStartResponse, 'utterances'>,
  config: TwoDigitAddsubWithRegroupRulesConfig = TWO_DIGIT_ADDSUB_WITH_REGROUP_RULES,
): CompositionViolation[] {
  const violations: CompositionViolation[] = []
  const problems = extractTwoDigitAddsubWithRegroupProblems(response)

  // ── unparseable / pool-membership pass ──
  for (const p of problems) {
    if (p.parsed === null) {
      violations.push({
        rule: 'unparseable-problem',
        problemIndex: p.index,
        message:
          `P${p.index} (${p.utteranceId}) text does not match either ` +
          `two-digit-addsub-with-regroup read template ("<addend-A> plus ` +
          `<addend-B>. How many?" OR "<minuend> minus <subtrahend>. How ` +
          `many are left?"): ` +
          JSON.stringify(p.text),
        factId: null,
      })
      continue
    }
    if (p.poolMatch === null) {
      const sum =
        p.parsed.op === '+' ? p.parsed.a + p.parsed.b : p.parsed.a - p.parsed.b
      violations.push({
        rule: 'pool-membership',
        problemIndex: p.index,
        message:
          `P${p.index} fact ${p.parsed.a}${p.parsed.op}${p.parsed.b}=` +
          `${sum} is NOT in the 30-fact two-digit-addsub-with-regroup ` +
          `pool. Either it violates the regroup-required constraint ` +
          `(carry on '+' requires (a mod 10) + b > 9; borrow on '-' ` +
          `requires (a mod 10) < b), the operand range (a in [10, 99] ` +
          `with v1 decade cap at 60, b in [1, 9]), the answer range ` +
          `([17, 64]), or it is a valid in-range fact outside the v1 ` +
          `curation (single-digit-result borrows deferred to sub-to-20; ` +
          `two-digit-plus-two-digit-with-regroup deferred to v2 per ` +
          `spec §3.5 Q3). See design/math/two-digit-addsub-with-regroup-` +
          `content.md §1.4.`,
        factId: `${p.parsed.a}${p.parsed.op}${p.parsed.b}`,
      })
    }
  }

  const matched = problems.filter(
    (
      p,
    ): p is TwoDigitAddsubWithRegroupProblemRow & {
      poolMatch: TwoDigitAddsubWithRegroupPoolFact
    } => p.poolMatch !== null,
  )

  // ── band-by-slot pass ──
  for (const p of matched) {
    const allowed = config.bandAllowedSlots[p.poolMatch.band]
    if (!allowed.includes(p.index)) {
      violations.push({
        rule: 'band-by-slot',
        problemIndex: p.index,
        message:
          `P${p.index} carries ${p.poolMatch.band} fact ` +
          `${p.poolMatch.id} (category ${p.poolMatch.category}). ` +
          `${p.poolMatch.band}-band is only allowed at slots ` +
          `[${allowed.join(', ')}].`,
        factId: p.poolMatch.id,
      })
    }
  }

  // ── category-cap pass ──
  type MatchedWithRegroupRow = TwoDigitAddsubWithRegroupProblemRow & {
    poolMatch: TwoDigitAddsubWithRegroupPoolFact
  }
  const categoryCounts: Record<string, MatchedWithRegroupRow[]> = {}
  for (const p of matched) {
    const cat = p.poolMatch.category
    if (!categoryCounts[cat]) categoryCounts[cat] = []
    categoryCounts[cat]!.push(p)
  }
  for (const [cat, rows] of Object.entries(categoryCounts)) {
    const cap = config.categoryCaps[cat as TwoDigitAddsubWithRegroupCategory]
    if (cap === undefined) continue
    if (rows.length > cap) {
      violations.push({
        rule: 'category-cap',
        problemIndex: null,
        message:
          `Category "${cat}" cap is ${cap}; canon has ${rows.length} ` +
          `(slots P${rows.map((r) => r.index).join(', P')}; facts ` +
          `${rows.map((r) => r.poolMatch.id).join(', ')}).` +
          (cat === 'round-ten-cross-down'
            ? ` Saturation-prior correction lever per spec §1.5 — Haiku's` +
              ` empirical prior at the previous two-digit tier saturates` +
              ` round-ten anchors across bakes; cap at ${cap} holds it to` +
              ` 1-of-8. Reject the second round-ten-cross-down.`
            : ''),
        factId: null,
      })
    }
  }

  // ── op-mix pass (spec §1.1 + §3.2 — mixed-op rules) ──
  if (matched.length === config.totalProblems) {
    let addCount = 0
    let subCount = 0
    for (const p of matched) {
      if (p.poolMatch.op === '+') addCount++
      else subCount++
    }
    const isAllowed = config.allowedOpMixes.some(
      (m) => m.addCount === addCount && m.subCount === subCount,
    )
    if (!isAllowed) {
      const allowedStr = config.allowedOpMixes
        .map((m) => `${m.addCount}+/${m.subCount}-`)
        .join(', ')
      violations.push({
        rule: 'op-mix',
        problemIndex: null,
        message:
          `Op-mix is ${addCount}+/${subCount}-; not in allowed set ` +
          `[${allowedStr}]. Per spec §1.1: at least 5 '+' AND at least ` +
          `2 '-' problems; allowed mixes are ${allowedStr}. FORBIDDEN: ` +
          `8+/0-, 7+/1-, 4+/4-, 3+/5-, and any combination summing to ` +
          `something other than 8.`,
        factId: null,
      })
    }
  }

  // ── p1-is-plus pass (spec §1.3 — session opener anxiety + Marian's
  // '+'-confident diagnostic) ──
  const p1 = matched.find((p) => p.index === 1)
  if (p1 && p1.poolMatch.op !== '+') {
    violations.push({
      rule: 'p1-is-plus',
      problemIndex: 1,
      message:
        `P1 carries op '${p1.poolMatch.op}' (fact ${p1.poolMatch.id}). ` +
        `Per spec §1.3 P1 must always be op '+': session opener carries ` +
        `onset anxiety and the more confident operation (per Marian's ` +
        `April 2026 diagnostic) must enter first. This rule is sharper ` +
        `at Wave 5 than at the no-regroup sibling — borrowing is ` +
        `documented as the harder regroup procedure per Dave Wave-5 ` +
        `research §1 (Brown-VanLehn SFL bug catalog).`,
      factId: p1.poolMatch.id,
    })
  }

  // ── dual-exposure pass (forward-compat per spec §3.3) ──
  //
  // V1 pool audit (spec §3.3): walk every (a, b, c) for both `+` and `-`
  // and confirm ZERO in-pool cross-op collisions. Example audit point:
  // `27+6=33` (#10); inverse `33-6=27` is NOT in the v1 pool (minuend 33
  // is not a v1 minuend). The rule remains in force for forward-compat
  // with v2 pool extensions.
  const tripleKey = (
    a: number,
    b: number,
    op: TwoDigitAddsubWithRegroupOp,
  ): string => `${a}${op}${b}`
  const seenTriples = new Map<string, MatchedWithRegroupRow>()
  for (const p of matched) {
    seenTriples.set(tripleKey(p.poolMatch.a, p.poolMatch.b, p.poolMatch.op), p)
  }
  for (const p of matched) {
    const { a, b, op } = p.poolMatch
    const correct = op === '+' ? a + b : a - b
    const inverses: Array<{
      a: number
      b: number
      op: TwoDigitAddsubWithRegroupOp
    }> = []
    if (op === '+') {
      // c - b = a; c - a = b (latter falls out of pool by being negative
      // or having two-digit subtrahend, but we check the key match).
      inverses.push({ a: correct, b, op: '-' })
      inverses.push({ a: correct, b: a, op: '-' })
    } else {
      // c + b = a (the canonical + inverse); b + c = a (commutative).
      inverses.push({ a: correct, b, op: '+' })
      inverses.push({ a: b, b: correct, op: '+' })
    }
    for (const inv of inverses) {
      const invKey = tripleKey(inv.a, inv.b, inv.op)
      const invMatch = seenTriples.get(invKey)
      if (!invMatch) continue
      // Emit once per ordered pair (the pair with smaller `index` raises
      // the violation).
      if (invMatch.index <= p.index) continue
      violations.push({
        rule: 'dual-exposure',
        problemIndex: null,
        message:
          `Dual-exposure rule (spec §3.3): fact ${p.poolMatch.id} at P` +
          `${p.index} co-occurs with its inverse ${invMatch.poolMatch.id} ` +
          `at P${invMatch.index}. The operand triple ` +
          `(${a}, ${b}, ${correct}) must NOT appear in both '+' and '-' ` +
          `forms within the same session.`,
        factId: `${p.poolMatch.id}↔${invMatch.poolMatch.id}`,
      })
    }
  }

  // ── high-leverage coverage pass (>= 1 borrow-from-tens in P5-P8) ──
  //
  // STRICTER P5-P8 framing per spec §1.3 — sibling to add-to-20 /
  // two-digit-addsub. P4 is MEDIUM-only and several MEDIUM facts are
  // borrow-from-tens (#17, #18, #19), so a P4-P8 rule would be trivially
  // satisfied. P5-P8 forces the rule to bind.
  const borrowInDiscriminate = matched.filter(
    (p) => p.poolMatch.category === 'borrow-from-tens' && p.index >= 5,
  )
  if (borrowInDiscriminate.length < config.borrowFromTensInP5ToP8Min) {
    violations.push({
      rule: 'high-leverage-coverage',
      problemIndex: null,
      message:
        `At least ${config.borrowFromTensInP5ToP8Min} borrow-from-tens ` +
        `fact(s) MUST appear in P5-P8 (the cycle-5 '-' learning target ` +
        `per spec §1.3 — borrowing is the documented harder regroup ` +
        `procedure per Dave Wave-5 research §1). The '+' side is ` +
        `satisfied trivially because every '+' fact in the pool IS a ` +
        `carry-from-units fact by construction. Canon has ` +
        `${borrowInDiscriminate.length} borrow-from-tens fact(s) in P5-P8.`,
      factId: null,
    })
  }

  // ── no-duplicates pass ──
  const seenIds = new Map<string, TwoDigitAddsubWithRegroupProblemRow[]>()
  for (const p of matched) {
    const key = p.poolMatch.id
    if (!seenIds.has(key)) seenIds.set(key, [])
    seenIds.get(key)!.push(p)
  }
  for (const [factId, rows] of seenIds.entries()) {
    if (rows.length > 1) {
      violations.push({
        rule: 'no-duplicates',
        problemIndex: null,
        message:
          `Fact ${factId} appears ${rows.length} times ` +
          `(slots P${rows.map((r) => r.index).join(', P')}). ` +
          `No duplicate (a, b, op) triples allowed within the 8-problem ` +
          `set.`,
        factId,
      })
    }
  }

  return violations
}

/**
 * Throwing helper for the bake-time integration point. The throw aborts
 * the bake and stops the (compositionally invalid) JSON from reaching
 * disk.
 *
 * `canonId` is a human-readable identifier (e.g.
 * `"math/two-digit-addsub-with-regroup"`).
 *
 * NOTE (PR A scope): exported. The binding IS registered in
 * `resolveTierBinding` so the disk-walker will fire it when the canon
 * file lands (PR B). The bake-time `bakeOne` integration in
 * `generateSessionCanon.ts` is wired in PR B alongside the canon
 * (mirrors the Wave-4 `two-digit-addsub` chain at
 * `generateSessionCanon.ts:442+`).
 */
export function assertTwoDigitAddsubWithRegroupCompositionClean(
  canonId: string,
  response: Pick<SessionStartResponse, 'utterances'>,
  config: TwoDigitAddsubWithRegroupRulesConfig = TWO_DIGIT_ADDSUB_WITH_REGROUP_RULES,
): void {
  const violations = lintTwoDigitAddsubWithRegroupComposition(response, config)
  if (violations.length > 0) {
    throw new CompositionLintError(canonId, violations)
  }
}

// ── tier dispatch: which canon files get composition-linted ──────────────
//
// Current scope is sub-to-10 + add-to-10 + sub-to-20 + add-to-20. The
// function returns a (potentially nil) rule config for the supplied
// canon-file path. Hard-coded matching; future tiers slot in here.
//
// two-digit-addsub: lint infra (POOL, RULES, parser,
// lintTwoDigitAddsubComposition, assertTwoDigitAddsubCompositionClean)
// shipped in PR A (ticket 86c9xkz9n). PR B (ticket follow-up to
// 86c9xkz9n) activates the binding alongside a fresh canon rebake + Wave 2
// prereq fold-in (86c9xa817 — "How many?" → "How many are left?"). The
// previous committed `public/canon/math/level-1/two-digit-addsub.json`
// shipped 3-of-8 round-ten-anchor facts (spec §1.4's round-ten-prior
// correction target); the rebake replaces it with a spec-compliant
// 8-problem session (round-ten-anchor ≤ 1, mid-decade-units-shift ≤ 4,
// near-boundary-no-cross ≤ 5, tens-doubles-echo ≤ 1, op-mix 5+/3- or
// 6+/2-, ≥ 1 near-boundary-no-cross in P5-P8, ≥ 2 Class 2 + ≥ 1 Class 3
// traps admissible).

// `tier` here is the `CanonFileTier` disk-identifier (defined at file head),
// NOT the runtime `SkillNode` literal. Post-PR-#308 the SkillNode union
// widened away from the legacy `'two-digit-addsub'` string but the canon
// disk file kept its name — see `.claude/docs/skill-trees-and-content.md`
// § "Canon-file-name vs SkillNode-literal" for the rationale.
export type TierLintBinding =
  | { tier: Extract<CanonFileTier, 'sub-to-10'>; config: SubToTenRulesConfig }
  | { tier: Extract<CanonFileTier, 'add-to-10'>; config: AddToTenRulesConfig }
  | {
      tier: Extract<CanonFileTier, 'sub-to-20'>
      config: SubToTwentyRulesConfig
    }
  | {
      tier: Extract<CanonFileTier, 'add-to-20'>
      config: AddToTwentyRulesConfig
    }
  | {
      tier: Extract<CanonFileTier, 'two-digit-addsub'>
      config: TwoDigitAddsubRulesConfig
    }
  | {
      tier: Extract<CanonFileTier, 'two-digit-addsub-with-regroup'>
      config: TwoDigitAddsubWithRegroupRulesConfig
    }
  | null

/**
 * Resolve a canon file path to the tier rule config that should lint it.
 * Returns null for files outside scope (digraphs, cvc-words, add-to-20,
 * etc.) — those tiers have their own composition rules but are not
 * mechanically backstopped yet.
 *
 * The match is by file basename: the path layout is
 * `<root>/<track>/level-<n>/<focusNode>.json`. We key on `focusNode`.
 */
export function resolveTierBinding(canonFilePath: string): TierLintBinding {
  // Normalise to posix-ish so we can substring-match basename without sep
  // worries.
  const norm = canonFilePath.split(sep).join('/')
  if (norm.endsWith('/math/level-1/sub-to-10.json')) {
    return { tier: 'sub-to-10', config: SUB_TO_TEN_RULES }
  }
  if (norm === 'sub-to-10.json' || norm.endsWith('/sub-to-10.json')) {
    return { tier: 'sub-to-10', config: SUB_TO_TEN_RULES }
  }
  if (norm.endsWith('/math/level-1/add-to-10.json')) {
    return { tier: 'add-to-10', config: ADD_TO_TEN_RULES }
  }
  if (norm === 'add-to-10.json' || norm.endsWith('/add-to-10.json')) {
    return { tier: 'add-to-10', config: ADD_TO_TEN_RULES }
  }
  // sub-to-20 binding ACTIVATED in the rebake PR (ticket 86c9utet9). The
  // committed `public/canon/math/level-1/sub-to-20.json` was rebaked from
  // scratch against Kyle's PR #269 spec (no-borrow, minuend 11-19, "How
  // many are left?" template, ≥2 CLEAN-annotated facts at P4-P8) in the
  // same PR. The deferred infrastructure (POOL, RULES, parser, lint
  // function, assert helper, drift-guards) authored in PR #273 is now
  // wired through the dispatch.
  if (norm.endsWith('/math/level-1/sub-to-20.json')) {
    return { tier: 'sub-to-20', config: SUB_TO_TWENTY_RULES }
  }
  if (norm === 'sub-to-20.json' || norm.endsWith('/sub-to-20.json')) {
    return { tier: 'sub-to-20', config: SUB_TO_TWENTY_RULES }
  }
  // add-to-20 binding ACTIVATED in the rebake PR (ticket follow-up to
  // 86c9uuqzu). PR A (#278) shipped the lint infra with the binding
  // deferred; this PR (PR B) sharpens the directive, rebakes the canon
  // to spec-compliant constraints (doubles <= 2, near-doubles <= 2,
  // >= 1 make-ten-bridge in P5-P8), and wires the binding through the
  // dispatch.
  if (norm.endsWith('/math/level-1/add-to-20.json')) {
    return { tier: 'add-to-20', config: ADD_TO_TWENTY_RULES }
  }
  if (norm === 'add-to-20.json' || norm.endsWith('/add-to-20.json')) {
    return { tier: 'add-to-20', config: ADD_TO_TWENTY_RULES }
  }
  // two-digit-addsub binding ACTIVATED in the rebake PR (ticket follow-up
  // to 86c9xkz9n). PR A (#291) shipped the lint infra with the binding
  // deferred; this PR (PR B) sharpens the directive (round-ten-anchor cap
  // at 1, mid-decade cap at 4, op-mix 5+/3- or 6+/2-, P1 is "+",
  // dual-exposure across (a, b, c) triples, subtraction read-template
  // tightened to "How many are left?" — folds in Wave 2 prereq 86c9xa817),
  // rebakes the canon, and wires the binding through the dispatch.
  // two-digit-addsub-with-regroup binding REGISTERED in PR A (ticket
  // 86c9y01ee). Canon does not exist at PR A time (spec §5.1 verified
  // empirically — no `public/canon/math/level-1/two-digit-addsub-with-
  // regroup.json` present). PR B (ticket follow-up to 86c9y01ee) sharpens
  // the planner directive, bakes the canon, and the binding fires for
  // the first time. ORDERED BEFORE the two-digit-addsub branch below
  // because `with-regroup.json`'s suffix does not collide with
  // `two-digit-addsub.json`'s suffix (the `-with-regroup` infix prevents
  // overlap) — but ordering by specificity is good practice for any
  // future sibling nodes that DO share a prefix.
  if (norm.endsWith('/math/level-1/two-digit-addsub-with-regroup.json')) {
    return {
      tier: 'two-digit-addsub-with-regroup',
      config: TWO_DIGIT_ADDSUB_WITH_REGROUP_RULES,
    }
  }
  if (
    norm === 'two-digit-addsub-with-regroup.json' ||
    norm.endsWith('/two-digit-addsub-with-regroup.json')
  ) {
    return {
      tier: 'two-digit-addsub-with-regroup',
      config: TWO_DIGIT_ADDSUB_WITH_REGROUP_RULES,
    }
  }
  if (norm.endsWith('/math/level-1/two-digit-addsub.json')) {
    return { tier: 'two-digit-addsub', config: TWO_DIGIT_ADDSUB_RULES }
  }
  if (
    norm === 'two-digit-addsub.json' ||
    norm.endsWith('/two-digit-addsub.json')
  ) {
    return { tier: 'two-digit-addsub', config: TWO_DIGIT_ADDSUB_RULES }
  }
  return null
}

// ── disk walker (CI mode) ────────────────────────────────────────────────

export interface CompositionFileFinding {
  /** Repo-relative posix-shaped path for log readability. */
  filePath: string
  /** `CanonFileTier` disk-identifier — see file-head note + dual-identifier
   *  surface doc in `.claude/docs/skill-trees-and-content.md`. */
  tier: CanonFileTier
  violations: CompositionViolation[]
}

export interface RunCompositionLintResult {
  filesScanned: number
  filesLinted: number
  filesSkipped: number
  totalViolations: number
  findings: CompositionFileFinding[]
  unparseable: { filePath: string; reason: string }[]
}

/**
 * Walk a canon root, lint every in-scope tier file (currently sub-to-10,
 * add-to-10, sub-to-20, add-to-20, two-digit-addsub), and return the
 * aggregate result without throwing. The CLI driver decides exit code
 * based on the result.
 */
export function runCompositionLint(
  canonRoot: string,
): RunCompositionLintResult {
  const result: RunCompositionLintResult = {
    filesScanned: 0,
    filesLinted: 0,
    filesSkipped: 0,
    totalViolations: 0,
    findings: [],
    unparseable: [],
  }

  if (!existsSync(canonRoot)) {
    return result
  }

  const files = collectJsonFiles(canonRoot)
  for (const absPath of files) {
    result.filesScanned++
    const filePath = toPosixRelative(canonRoot, absPath)

    const binding = resolveTierBinding(filePath)
    if (binding === null) {
      result.filesSkipped++
      continue
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(absPath, 'utf8'))
    } catch (err) {
      result.unparseable.push({
        filePath,
        reason: err instanceof Error ? err.message : String(err),
      })
      continue
    }

    if (!isSessionStartResponse(parsed)) {
      result.unparseable.push({
        filePath,
        reason: 'not a SessionStartResponse',
      })
      continue
    }

    result.filesLinted++

    // Source the 8 problem utterances. Per current canon shape they live
    // on the top-level `utterances` array. (We deliberately don't read
    // `plan.utterances` — the plan field is `unknown` on the wire type;
    // top-level `utterances` is the validated surface.)
    let violations: CompositionViolation[]
    switch (binding.tier) {
      case 'sub-to-10':
        violations = lintSubToTenComposition(
          parsed as SessionStartResponse,
          binding.config,
        )
        break
      case 'add-to-10':
        violations = lintAddToTenComposition(
          parsed as SessionStartResponse,
          binding.config,
        )
        break
      case 'sub-to-20':
        violations = lintSubToTwentyComposition(
          parsed as SessionStartResponse,
          binding.config,
        )
        break
      case 'add-to-20':
        violations = lintAddToTwentyComposition(
          parsed as SessionStartResponse,
          binding.config,
        )
        break
      case 'two-digit-addsub':
        violations = lintTwoDigitAddsubComposition(
          parsed as SessionStartResponse,
          binding.config,
        )
        break
      case 'two-digit-addsub-with-regroup':
        violations = lintTwoDigitAddsubWithRegroupComposition(
          parsed as SessionStartResponse,
          binding.config,
        )
        break
    }
    if (violations.length > 0) {
      result.findings.push({
        filePath,
        tier: binding.tier,
        violations,
      })
      result.totalViolations += violations.length
    }
  }

  return result
}

export function formatCompositionLintReport(
  result: RunCompositionLintResult,
): string {
  const lines: string[] = []
  lines.push('Composition lint report')
  lines.push('=======================')
  lines.push(`files scanned: ${result.filesScanned}`)
  lines.push(`files linted:  ${result.filesLinted}  (in-scope tiers)`)
  lines.push(`files skipped: ${result.filesSkipped}  (out-of-scope tiers)`)
  lines.push(`violations:    ${result.totalViolations}`)
  lines.push(`unparseable:   ${result.unparseable.length}`)
  lines.push('')

  if (result.unparseable.length > 0) {
    lines.push('Unparseable files:')
    for (const u of result.unparseable) {
      lines.push(`  - ${u.filePath}: ${u.reason}`)
    }
    lines.push('')
  }

  if (result.findings.length > 0) {
    lines.push('Composition violations (CI gate — must fix):')
    for (const f of result.findings) {
      lines.push(`[${f.filePath}] (tier: ${f.tier})`)
      for (const v of f.violations) {
        const slot = v.problemIndex === null ? '*' : `P${v.problemIndex}`
        lines.push(`  - ${v.rule}  slot=${slot}`)
        lines.push(`    ${v.message}`)
      }
    }
    lines.push('')
  }

  if (result.findings.length === 0 && result.unparseable.length === 0) {
    lines.push(
      `No composition violations across ${result.filesLinted} in-scope tier file(s).`,
    )
  }

  return lines.join('\n')
}

// ── helpers ──────────────────────────────────────────────────────────────

function collectJsonFiles(root: string): string[] {
  const out: string[] = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()!
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(abs)
      } else if (entry.isFile() && abs.endsWith('.json')) {
        out.push(abs)
      }
    }
  }
  out.sort()
  return out
}

function toPosixRelative(root: string, abs: string): string {
  const rel = relative(dirname(root), abs)
  return rel.split(sep).join('/')
}

// ── CLI entry ────────────────────────────────────────────────────────────

interface CliArgs {
  root: string
  report: boolean
}

function parseCliArgs(argv: readonly string[]): CliArgs {
  const here = dirname(fileURLToPath(import.meta.url))
  const repoRoot = join(here, '..')
  const args: CliArgs = {
    root: join(repoRoot, 'public', 'canon'),
    report: false,
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && typeof argv[i + 1] === 'string') {
      args.root = argv[i + 1]!
      i++
    } else if (argv[i] === '--report') {
      args.report = true
    }
  }
  return args
}

function main(): void {
  const args = parseCliArgs(process.argv.slice(2))
  const result = runCompositionLint(args.root)

  const hasFailures =
    result.totalViolations > 0 || result.unparseable.length > 0

  const hasAnyFinding =
    result.findings.length > 0 || result.unparseable.length > 0

  if (args.report || hasAnyFinding) {
    console.log(formatCompositionLintReport(result))
  } else {
    console.log(
      `composition lint clean: ${result.filesLinted} in-scope file(s), ` +
        `0 violations.`,
    )
  }

  process.exit(hasFailures ? 1 : 0)
}

function isMainModule(): boolean {
  if (!process.argv[1]) return false
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return false
  }
}

if (isMainModule()) {
  main()
}
