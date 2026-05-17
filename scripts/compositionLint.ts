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

// ── rule kinds + error type ──────────────────────────────────────────────

export type CompositionRule =
  | 'pool-membership'
  | 'category-cap'
  | 'band-by-slot'
  | 'high-leverage-coverage'
  | 'no-duplicates'
  | 'unparseable-problem'

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

// ── tier dispatch: which canon files get composition-linted ──────────────
//
// Current scope is sub-to-10 + add-to-10. The function returns a
// (potentially nil) rule config for the supplied canon-file path.
// Hard-coded matching; future tiers slot in here.
//
// sub-to-20 INFRASTRUCTURE (POOL, RULES, parser, lint, assert helper) is
// LIVE in this file but the dispatch binding is DEFERRED until the
// rebake PR — see the long-form comment at the end of resolveTierBinding.

export type TierLintBinding =
  | { tier: 'sub-to-10'; config: SubToTenRulesConfig }
  | { tier: 'add-to-10'; config: AddToTenRulesConfig }
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
  // NOTE: sub-to-20 is INFRASTRUCTURE-ONLY in this PR (Kevin ticket 86c9utced).
  // The committed `public/canon/math/level-1/sub-to-20.json` predates Kyle's
  // PR #269 spec and openly violates the no-borrow constraint (Jessica's
  // E2E spec PR #271 surfaced this — facts like 14-7, 18-9, 17-8 are in
  // the file). Binding sub-to-20 in resolveTierBinding here would fail
  // `npm run canon:lint` against the existing borked canon and block CI.
  //
  // The dispatch binding lands in the follow-up rebake PR (per
  // `[[planner-and-canon.md §"Per-tier rebake recipe"]]`): rm the JSON,
  // run `npx tsx scripts/generateSessionCanon.ts`, commit the fresh
  // canon, and flip resolveTierBinding to bind sub-to-20 to
  // SUB_TO_TWENTY_RULES in the same PR. The infrastructure (POOL, RULES,
  // parser, lint function, assert helper, drift-guards) is all live in
  // this PR — only the bake-time + CI hook is deferred.
  return null
}

// ── disk walker (CI mode) ────────────────────────────────────────────────

export interface CompositionFileFinding {
  /** Repo-relative posix-shaped path for log readability. */
  filePath: string
  tier: 'sub-to-10' | 'add-to-10'
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
 * Walk a canon root, lint every in-scope tier file (currently only
 * sub-to-10), and return the aggregate result without throwing. The CLI
 * driver decides exit code based on the result.
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
    const violations =
      binding.tier === 'sub-to-10'
        ? lintSubToTenComposition(
            parsed as SessionStartResponse,
            binding.config,
          )
        : lintAddToTenComposition(
            parsed as SessionStartResponse,
            binding.config,
          )
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
