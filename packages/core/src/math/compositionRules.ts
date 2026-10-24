/**
 * The composition rules of the two math steps the device composes from
 * the Leitner box (no-Claude plan phase 3, `design/native/no-claude-sizing.md`
 * § 2 "How the picker rules plug in" item 3): the sub-to-10 and add-to-10
 * fact pools with their caps and slot bands, the missing-number rules, and
 * the checks.
 *
 * Moved from `scripts/compositionLint.ts`, which imports them back: the
 * bake-time gate, the CI lint (`npm run canon:lint`) and the device's
 * picker (`../session/mathPicker.ts`) hold a session to the same code. The
 * other tiers' rules stay in the script.
 *
 * Pure; no I/O.
 */
import {
  MISSING_NUMBER_RANGES,
  MISSING_NUMBER_SLOTS,
  bondKey,
  missingNumberFits,
} from '../wire/missingNumbers'

/** The rules this module checks (`scripts/compositionLint.ts`
 *  `CompositionRule` adds the other tiers'). */
export type MathCompositionRule =
  | 'pool-membership'
  | 'category-cap'
  | 'band-by-slot'
  | 'high-leverage-coverage'
  | 'no-duplicates'
  | 'unparseable-problem'
  // add-to-10 / add-to-20 missing numbers (content wave 1 § 1.2): a
  // missing number sits at a missing-number slot, and a session with any
  // has one at every slot; its bond keeps to the step's range; and no
  // bond appears twice in one session, in either shape or order.
  | 'missing-number-slot'
  | 'missing-number-range'
  | 'same-bond'

/**
 * One detected violation against a single problem (or whole-session in the
 * coverage case).
 */
export interface CompositionViolation<R extends string = MathCompositionRule> {
  rule: R
  /** 1-indexed problem slot (P1-P8). `null` for whole-session rules
   *  (high-leverage-coverage, certain category-cap cases). */
  problemIndex: number | null
  /** Human-readable detail — what went wrong, with the offending fact. */
  message: string
  /** The fact identifier (e.g. `"10-7"`) when the rule fires against a
   *  specific fact. `null` for whole-session rules. */
  factId: string | null
}

/** What a check reads: a session's spoken lines. The problems are the
 *  `math.p<N>.read` lines (a canon file or a `SessionStartResponse`). */
export interface CompositionLines {
  utterances: readonly { id: string; text: string }[]
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

// ── lint a session against the sub-to-10 rules ───────────────────────────

interface ProblemRow {
  index: number // 1-indexed
  utteranceId: string
  text: string
  parsed: ParsedFact | null
  poolMatch: SubToTenPoolFact | null
}

function extractProblems(response: CompositionLines): ProblemRow[] {
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
  response: CompositionLines,
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

// ── missing numbers inside add-to-10 / add-to-20 (content wave 1 § 1.2) ──
//
// "Seven and what make ten?" is `7 + ? = 10`: Emma names one part and the
// whole, the child taps the other part. The slots and the bond ranges live
// in `packages/core/src/wire/missingNumbers.ts` (one place: Dave's marks may
// move them). The plain problems of a session keep every rule below; a
// missing number is checked here instead.

const RE_MISSING_NUMBER =
  /^\s*([a-z]+)\s+and\s+what\s+make\s+([a-z]+)\s*\?\s*$/i

/** The number words a missing-number line uses: 0-19, as add-to-20's
 *  table in `scripts/compositionLint.ts` (a whole of 11-14 there). */
const MISSING_NUMBER_WORDS: Record<string, number> = {
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

export interface ParsedMissingNumber {
  /** The part Emma names. */
  given: number
  total: number
  /** The part the child taps. */
  missing: number
}

/**
 * Parse a missing-number read line (`"<W> and what make <W>?"`), or `null`
 * on any other line, an unknown number word or a part not smaller than the
 * whole. Pure.
 */
export function parseMissingNumberReadLine(
  text: string,
): ParsedMissingNumber | null {
  const m = RE_MISSING_NUMBER.exec(text)
  if (!m) return null
  const given = MISSING_NUMBER_WORDS[m[1]!.toLowerCase()]
  const total = MISSING_NUMBER_WORDS[m[2]!.toLowerCase()]
  if (given === undefined || total === undefined) return null
  if (given < 1 || given >= total) return null
  return { given, total, missing: total - given }
}

/** One read line's bond, for the same-bond rule. */
export interface BondRow {
  index: number
  a: number
  b: number
  shape: 'plain' | 'missing'
}

/** The missing-number and same-bond checks of an adding session (add-to-10
 *  here, add-to-20 in `scripts/compositionLint.ts`). */
export function lintMissingNumbers(
  step: keyof typeof MISSING_NUMBER_RANGES,
  missing: ReadonlyArray<{ index: number; parsed: ParsedMissingNumber }>,
  plain: readonly BondRow[],
): CompositionViolation[] {
  const out: CompositionViolation[] = []
  const slots = MISSING_NUMBER_SLOTS.join(', P')
  if (missing.length > 0) {
    for (const r of missing) {
      if (!MISSING_NUMBER_SLOTS.includes(r.index)) {
        out.push({
          rule: 'missing-number-slot',
          problemIndex: r.index,
          message:
            `P${r.index} is a missing number; missing numbers sit at ` +
            `P${slots} only (content wave 1 § 1.2).`,
          factId: `${r.parsed.given}+?=${r.parsed.total}`,
        })
      }
    }
    for (const slot of MISSING_NUMBER_SLOTS) {
      if (!missing.some((r) => r.index === slot)) {
        out.push({
          rule: 'missing-number-slot',
          problemIndex: slot,
          message:
            `P${slot} must be a missing number: a session with missing ` +
            `numbers has one at each of P${slots} (content wave 1 § 1.2).`,
          factId: null,
        })
      }
    }
    const range = MISSING_NUMBER_RANGES[step]
    for (const r of missing) {
      const { given, missing: part, total } = r.parsed
      if (!missingNumberFits(step, given, part)) {
        out.push({
          rule: 'missing-number-range',
          problemIndex: r.index,
          message:
            `P${r.index} ${given} + ? = ${total} is outside ${step}'s ` +
            `missing-number bonds (given ${range.givenMin}-${range.givenMax}, ` +
            `missing ${range.missingMin}-${range.missingMax}, whole ` +
            `${range.totalMin}-${range.totalMax}; content wave 1 § 1.2).`,
          factId: `${given}+?=${total}`,
        })
      }
    }
  }
  const rows: BondRow[] = [
    ...plain,
    ...missing.map((r) => ({
      index: r.index,
      a: r.parsed.given,
      b: r.parsed.missing,
      shape: 'missing' as const,
    })),
  ].sort((x, y) => x.index - y.index)
  const byBond = new Map<string, BondRow[]>()
  for (const r of rows) {
    const key = bondKey(r.a, r.b)
    byBond.set(key, [...(byBond.get(key) ?? []), r])
  }
  for (const [key, group] of byBond) {
    if (group.length < 2) continue
    // An exact repeat of one plain problem is `no-duplicates`' finding.
    const exactPlainRepeat = group.every(
      (r) => r.shape === 'plain' && r.a === group[0]!.a && r.b === group[0]!.b,
    )
    if (exactPlainRepeat) continue
    out.push({
      rule: 'same-bond',
      problemIndex: null,
      message:
        `Bond {${key.replace('+', ', ')}} appears ${group.length} times ` +
        `(slots P${group.map((r) => r.index).join(', P')}); no bond twice ` +
        `in one session, in either shape or order (content wave 1 § 1.2).`,
      factId: key,
    })
  }
  return out
}

/** The missing-number rows and the plain rows' bonds of a session. */
export function splitMissing(
  problems: ReadonlyArray<{
    index: number
    parsed: ParsedFact | null
    missing: ParsedMissingNumber | null
  }>,
): {
  missing: { index: number; parsed: ParsedMissingNumber }[]
  plainBonds: BondRow[]
} {
  return {
    missing: problems.flatMap((p) =>
      p.missing === null ? [] : [{ index: p.index, parsed: p.missing }],
    ),
    plainBonds: problems.flatMap((p) =>
      p.parsed === null
        ? []
        : [
            {
              index: p.index,
              a: p.parsed.a,
              b: p.parsed.b,
              shape: 'plain' as const,
            },
          ],
    ),
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

// ── lint a session against the add-to-10 rules ───────────────────────────

interface AddProblemRow {
  index: number // 1-indexed
  utteranceId: string
  text: string
  parsed: ParsedFact | null
  poolMatch: AddToTenPoolFact | null
  /** A missing number (content wave 1 § 1.2): checked apart. */
  missing: ParsedMissingNumber | null
}

function extractAddProblems(response: CompositionLines): AddProblemRow[] {
  const re = /^math\.p(\d+)\.read$/
  const rows: AddProblemRow[] = []
  for (const u of response.utterances) {
    const m = re.exec(u.id)
    if (!m) continue
    const index = Number.parseInt(m[1]!, 10)
    const missing = parseMissingNumberReadLine(u.text)
    const parsed = missing === null ? parseAddToTenReadLine(u.text) : null
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
      missing,
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
  response: CompositionLines,
  config: AddToTenRulesConfig = ADD_TO_TEN_RULES,
): CompositionViolation[] {
  const violations: CompositionViolation[] = []
  const problems = extractAddProblems(response)

  // ── unparseable / pool-membership pass ──
  for (const p of problems) {
    if (p.missing !== null) continue
    if (p.parsed === null) {
      violations.push({
        rule: 'unparseable-problem',
        problemIndex: p.index,
        message:
          `P${p.index} (${p.utteranceId}) text does not match the ` +
          `add-to-10 read templates ("<W> plus <W>. How many?", ` +
          `"<W> and what make <W>?"): ` +
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
  // A missing number with the whole ten IS a bond to ten (content wave 1
  // § 1.2): it covers the make-10 rule as a plain sums-to-10 fact does.
  const sumsToTenInDiscriminate = [
    ...matched.filter(
      (p) => p.poolMatch.category === 'sums-to-10' && p.index >= 4,
    ),
    ...problems.filter(
      (p) => p.missing !== null && p.missing.total === 10 && p.index >= 4,
    ),
  ]
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

  // ── missing numbers + same-bond pass (content wave 1 § 1.2) ──
  const { missing, plainBonds } = splitMissing(problems)
  violations.push(...lintMissingNumbers('add-to-10', missing, plainBonds))

  return violations
}

/** The steps whose rules live here. */
export type ComposedMathStep = 'add-to-10' | 'sub-to-10'

/** `step`'s composition violations for `lines`; `[]` = clean. */
export function mathCompositionViolations(
  step: ComposedMathStep,
  lines: CompositionLines,
): CompositionViolation[] {
  return step === 'add-to-10'
    ? lintAddToTenComposition(lines)
    : lintSubToTenComposition(lines)
}
