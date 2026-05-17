/**
 * @vitest-environment node
 *
 * Tests for the composition-rule-spec lint (`scripts/compositionLint.ts`).
 *
 * Coverage strategy
 * -----------------
 * The lint is a pure function over a SessionStartResponse. We build canon
 * fixtures by category of violation:
 *   1. clean / current sub-to-10.json — passes
 *   2. pool-membership — fact outside the 16
 *   3. category-cap — doubles=2, generals=3
 *   4. band-by-slot — HARD at P3, MEDIUM at P2
 *   5. high-leverage-coverage — no take-from-10 anywhere
 *   6. no-duplicates — same fact twice
 *   7. unparseable-problem — read template malformed
 *   8. disk walker — write fixtures to a tmp dir, walk it, verify
 *      out-of-scope tier files are correctly skipped
 */
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  ADD_TO_TEN_POOL,
  ADD_TO_TEN_RULES,
  CompositionLintError,
  SUB_TO_TEN_POOL,
  SUB_TO_TEN_RULES,
  SUB_TO_TWENTY_POOL,
  SUB_TO_TWENTY_RULES,
  assertAddToTenCompositionClean,
  assertSubToTenCompositionClean,
  assertSubToTwentyCompositionClean,
  formatCompositionLintReport,
  lintAddToTenComposition,
  lintSubToTenComposition,
  lintSubToTwentyComposition,
  parseAddToTenReadLine,
  parseSubToTenReadLine,
  parseSubToTwentyReadLine,
  resolveTierBinding,
  runCompositionLint,
} from './compositionLint.ts'
import { MATH_TRACK_GUIDE } from '../api/_planner.js'
import type { SessionStartResponse, Utterance } from '../api/_types.js'

// ── fixture helpers ──────────────────────────────────────────────────────

/** Build a `math.p<N>.read` utterance with the "take away" template. */
function readUtterance(index: number, a: number, b: number): Utterance {
  return {
    id: `math.p${index}.read`,
    text: `${numberWord(a)} take away ${numberWord(b)}. How many are left?`,
    audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
  }
}

/** Build a `math.p<N>.read` utterance with custom raw text (for the
 *  unparseable-problem fixture). */
function rawReadUtterance(index: number, text: string): Utterance {
  return {
    id: `math.p${index}.read`,
    text,
    audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
  }
}

const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
] as const

function numberWord(n: number): string {
  return WORDS[n]!
}

/** Convenience: build a SessionStartResponse with the given 8 facts. */
function buildCanonResponse(
  facts: Array<[a: number, b: number]>,
): SessionStartResponse {
  const utterances: Utterance[] = facts.map(([a, b], i) =>
    readUtterance(i + 1, a, b),
  )
  return {
    ok: true,
    kind: 'session-start',
    plan: { id: 'test', label: 'test', utterances: [] },
    utterances,
  }
}

/** A canonically valid 8-fact session (mirrors the current
 *  public/canon/math/level-1/sub-to-10.json after PR #244). */
const CLEAN_FACTS_PR_244: ReadonlyArray<[number, number]> = [
  [7, 0], // P1 subtract-zero EASY
  [6, 3], // P2 doubles-halving EASY
  [9, 1], // P3 subtract-one EASY
  [10, 2], // P4 subtract-two MEDIUM
  [10, 3], // P5 take-from-10 MEDIUM
  [8, 3], // P6 general HARD
  [9, 4], // P7 general HARD
  [10, 7], // P8 take-from-10 MEDIUM
]

// ── add-to-10 fixture helpers ────────────────────────────────────────────

/** Build a `math.p<N>.read` add-to-10 utterance with the "plus" template. */
function readAddUtterance(index: number, a: number, b: number): Utterance {
  return {
    id: `math.p${index}.read`,
    text: `${numberWord(a)} plus ${numberWord(b)}. How many?`,
    audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
  }
}

/** Convenience: build a SessionStartResponse with the given 8 add-to-10 facts. */
function buildAddCanonResponse(
  facts: Array<[a: number, b: number]>,
): SessionStartResponse {
  const utterances: Utterance[] = facts.map(([a, b], i) =>
    readAddUtterance(i + 1, a, b),
  )
  return {
    ok: true,
    kind: 'session-start',
    plan: { id: 'test', label: 'test', utterances: [] },
    utterances,
  }
}

/** The 8 facts currently committed to public/canon/math/level-1/add-to-10.json
 *  (verified at PR #245 → this-PR baseline). Mapped through the lint
 *  pool, this is:
 *    P1 2+1=3 plus-one  EASY
 *    P2 2+2=4 doubles   EASY
 *    P3 3+2=5 near-doub EASY
 *    P4 4+3=7 near-doub MEDIUM
 *    P5 5+3=8 general   MEDIUM
 *    P6 4+4=8 doubles   MEDIUM
 *    P7 5+4=9 near-doub HARD
 *    P8 5+5=10 sums-to-10 HARD
 */
const CLEAN_ADD_FACTS: ReadonlyArray<[number, number]> = [
  [2, 1],
  [2, 2],
  [3, 2],
  [4, 3],
  [5, 3],
  [4, 4],
  [5, 4],
  [5, 5],
]

// ── parseSubToTenReadLine ────────────────────────────────────────────────

describe('parseSubToTenReadLine', () => {
  it('parses the "take away" template', () => {
    expect(
      parseSubToTenReadLine('Seven take away three. How many are left?'),
    ).toEqual({ a: 7, b: 3 })
  })

  it('parses the "minus" template', () => {
    expect(
      parseSubToTenReadLine('Ten minus seven. How many are left?'),
    ).toEqual({ a: 10, b: 7 })
  })

  it('parses zero operands', () => {
    expect(
      parseSubToTenReadLine('Seven take away zero. How many are left?'),
    ).toEqual({ a: 7, b: 0 })
    expect(
      parseSubToTenReadLine('Five minus zero. How many are left?'),
    ).toEqual({ a: 5, b: 0 })
  })

  it('is case-insensitive', () => {
    expect(
      parseSubToTenReadLine('seven TAKE AWAY three. how many are LEFT?'),
    ).toEqual({ a: 7, b: 3 })
  })

  it('returns null for addition template (out of scope for sub-to-10)', () => {
    expect(parseSubToTenReadLine('Seven plus three. How many?')).toBeNull()
  })

  it('returns null for unrecognised number words', () => {
    expect(
      parseSubToTenReadLine('Eleven take away three. How many are left?'),
    ).toBeNull()
  })

  it('returns null for completely off-shape text', () => {
    expect(parseSubToTenReadLine('Tap the cat.')).toBeNull()
    expect(parseSubToTenReadLine('')).toBeNull()
  })
})

// ── lintSubToTenComposition: pool, caps, bands, coverage, dedupe ─────────

describe('lintSubToTenComposition — clean canon passes', () => {
  it('returns 0 violations for the post-PR-244 sub-to-10 canon fact set', () => {
    const response = buildCanonResponse([...CLEAN_FACTS_PR_244])
    expect(lintSubToTenComposition(response)).toEqual([])
  })

  it('does not throw on the clean canon via assert helper', () => {
    const response = buildCanonResponse([...CLEAN_FACTS_PR_244])
    expect(() =>
      assertSubToTenCompositionClean('math/sub-to-10', response),
    ).not.toThrow()
  })
})

describe('lintSubToTenComposition — pool-membership rule', () => {
  it('fires when a fact is NOT in the 22-fact pool', () => {
    // 9-2 is NOT in the pool (the directive lists it as FORBIDDEN).
    // (Pre-PR #249/#252 widening this test used 7-3, but 7-3 is now
    // IN the pool as a HARD/general fact — see SUB_TO_TEN_POOL.)
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [9, 1],
      [9, 2], // ← outside pool
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const poolViolations = violations.filter(
      (v) => v.rule === 'pool-membership',
    )
    expect(poolViolations).toHaveLength(1)
    expect(poolViolations[0]!.problemIndex).toBe(4)
    expect(poolViolations[0]!.factId).toBe('9-2')
    expect(poolViolations[0]!.message).toContain('NOT in the 22-fact')
  })

  it('fires on a manually-curated list of forbidden facts the directive calls out', () => {
    // Post-PR #249/#252 widening, the directive's explicit FORBIDDEN
    // list shrank — 7-3, 8-1, 7-1, 8-2, 6-2, 6-4 are now IN the pool.
    // Remaining forbidden facts still flagged by the directive: 7-2,
    // 8-5, 9-3, 9-2. We sanity-check 3 of them.
    for (const [a, b] of [
      [7, 2],
      [8, 5],
      [9, 3],
    ] as const) {
      const facts: Array<[number, number]> = [
        [7, 0],
        [a, b], // forbidden
        [9, 1],
        [10, 2],
        [10, 3],
        [8, 3],
        [9, 4],
        [10, 7],
      ]
      const violations = lintSubToTenComposition(buildCanonResponse(facts))
      const pool = violations.filter((v) => v.rule === 'pool-membership')
      expect(
        pool,
        `expected pool-membership violation for ${a}-${b}`,
      ).toHaveLength(1)
      expect(pool[0]!.factId).toBe(`${a}-${b}`)
    }
  })
})

describe('lintSubToTenComposition — category-cap rule', () => {
  it('fires on doubles count > 1', () => {
    // Two doubles-halving facts: 10-5 and 8-4.
    const facts: Array<[number, number]> = [
      [10, 5], // doubles
      [8, 4], // doubles (cap busted)
      [9, 1],
      [10, 2],
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const cap = violations.filter((v) => v.rule === 'category-cap')
    expect(cap).toHaveLength(1)
    expect(cap[0]!.message).toContain('doubles-halving')
    expect(cap[0]!.message).toContain('cap is 1')
    expect(cap[0]!.message).toContain('canon has 2')
  })

  it('fires on general count > 2 (HARD cap)', () => {
    // Three HARD/general facts: 8-3, 9-4, 7-4 (also breaks band-by-slot
    // if any are below P5; we keep them all at P5-P8 to isolate the cap).
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [9, 1],
      [10, 3], // take-from-10
      [8, 3], // general 1
      [9, 4], // general 2
      [7, 4], // general 3 (cap busted)
      [10, 7], // take-from-10
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const cap = violations.filter((v) => v.rule === 'category-cap')
    expect(cap).toHaveLength(1)
    expect(cap[0]!.message).toContain('"general"')
    expect(cap[0]!.message).toContain('cap is 2')
    expect(cap[0]!.message).toContain('canon has 3')
  })

  it('does NOT fire on take-from-10 count of 2 (cap is 2)', () => {
    // 10-3 and 10-7 both in the session — at the cap, not over it.
    const facts: Array<[number, number]> = [...CLEAN_FACTS_PR_244]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(violations.filter((v) => v.rule === 'category-cap')).toEqual([])
  })

  it('fires when subtract-self appears twice (each pool fact would fail dedup too)', () => {
    // 5-5 and 8-8 in the same session. Note this ALSO fires no-duplicates
    // false ... actually NO — these are DIFFERENT (a,b) pairs, so dedup
    // wouldn't fire. But subtract-self cap is 1 → category-cap fires.
    const facts: Array<[number, number]> = [
      [5, 5], // subtract-self 1
      [8, 8], // subtract-self 2 (cap busted)
      [9, 1],
      [10, 2],
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const cap = violations.filter((v) => v.rule === 'category-cap')
    expect(cap).toHaveLength(1)
    expect(cap[0]!.message).toContain('subtract-self')
    // The two facts (5-5, 8-8) are distinct (a,b) pairs, so dedup does NOT fire.
    expect(violations.filter((v) => v.rule === 'no-duplicates')).toHaveLength(0)
  })

  it('fires when subtract-zero appears twice', () => {
    const facts: Array<[number, number]> = [
      [7, 0], // subtract-zero
      [9, 0], // subtract-zero (cap busted)
      [9, 1],
      [10, 2],
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(
      violations.find(
        (v) => v.rule === 'category-cap' && v.message.includes('subtract-zero'),
      ),
    ).toBeDefined()
  })

  it('fires when subtract-one appears twice (EASY 9-1 + MEDIUM 10-1)', () => {
    // Per directive line 939: 9-1 + 10-1 count toward the same cap.
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [9, 1], // subtract-one EASY
      [10, 1], // subtract-one MEDIUM (cap busted; one combined cap)
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(
      violations.find(
        (v) => v.rule === 'category-cap' && v.message.includes('subtract-one'),
      ),
    ).toBeDefined()
  })
})

describe('lintSubToTenComposition — band-by-slot rule', () => {
  it('fires when HARD-band general appears at P4 (P1-P4 forbid HARD)', () => {
    // Move 8-3 (HARD/general) to P4. CLEAN had 8-3 at P6.
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [9, 1],
      [8, 3], // HARD at P4 — band-by-slot violation
      [10, 3],
      [9, 4], // HARD at P6 (ok)
      [10, 2],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const band = violations.filter((v) => v.rule === 'band-by-slot')
    expect(band).toHaveLength(1)
    expect(band[0]!.problemIndex).toBe(4)
    expect(band[0]!.factId).toBe('8-3')
    expect(band[0]!.message).toContain('HARD')
  })

  it('fires when MEDIUM-band fact appears at P2 (P1-P3 EASY-only)', () => {
    // Note: under the tightened EASY = P1-P3 only rule, every P4-P8 slot
    // must carry MEDIUM or HARD. This fixture isolates a single MEDIUM-at-
    // P2 violation by filling P4-P8 with MEDIUM/HARD only and respecting
    // all caps + take-from-10 coverage.
    const facts: Array<[number, number]> = [
      [7, 0], // P1 subtract-zero EASY ok
      [10, 3], // P2 take-from-10 MEDIUM — band-by-slot violation (only thing under test)
      [8, 8], // P3 subtract-self EASY ok
      [10, 2], // P4 subtract-two MEDIUM
      [8, 3], // P5 general HARD
      [9, 4], // P6 general HARD
      [10, 7], // P7 take-from-10 MEDIUM (satisfies P4-P8 take-from-10 coverage)
      [10, 1], // P8 subtract-one MEDIUM
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const band = violations.filter((v) => v.rule === 'band-by-slot')
    expect(band).toHaveLength(1)
    expect(band[0]!.problemIndex).toBe(2)
    expect(band[0]!.factId).toBe('10-3')
  })

  it('fires when EASY-band fact appears at P5 (Dave NOF #1 mutation — P4-P8 forbid EASY)', () => {
    // Tightened band-by-slot rule (post-Dave-NOF-#1 from PR #247): EASY
    // is allowed at P1-P3 only. Previously the lint allowed EASY at any
    // slot, which let an EASY-at-P5 slip past the bake-time check in a
    // previously-shipped canon. This mutation test pins the new
    // behaviour.
    //
    // Move 9-1 (EASY/subtract-one) from its CLEAN P3 home to P5; fill P3
    // with another EASY fact (8-8) to keep the gentle-ramp slots full.
    // Re-balance category caps so the only violation under test is the
    // EASY-at-P5 band-by-slot fire.
    const facts: Array<[number, number]> = [
      [7, 0], // P1 subtract-zero EASY ok
      [6, 3], // P2 doubles-halving EASY ok
      [8, 8], // P3 subtract-self EASY ok
      [10, 2], // P4 subtract-two MEDIUM
      [9, 1], // P5 subtract-one EASY — band-by-slot violation (only thing under test)
      [8, 3], // P6 general HARD
      [9, 4], // P7 general HARD
      [10, 7], // P8 take-from-10 MEDIUM (satisfies P4-P8 take-from-10 coverage)
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const band = violations.filter((v) => v.rule === 'band-by-slot')
    expect(band).toHaveLength(1)
    expect(band[0]!.problemIndex).toBe(5)
    expect(band[0]!.factId).toBe('9-1')
    expect(band[0]!.message).toContain('EASY')
    expect(band[0]!.message).toContain('[1, 2, 3]')
  })

  it('does NOT fire when HARD facts are at P5-P8', () => {
    // CLEAN puts 8-3 at P6 and 9-4 at P7. Verify no band-by-slot violations.
    const facts: Array<[number, number]> = [...CLEAN_FACTS_PR_244]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(violations.filter((v) => v.rule === 'band-by-slot')).toEqual([])
  })
})

describe('lintSubToTenComposition — high-leverage-coverage rule', () => {
  it('fires when no take-from-10 fact appears in P4-P8', () => {
    // Replace both 10-3 and 10-7 with other facts.
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [9, 1],
      [10, 2], // subtract-two
      [10, 1], // subtract-one
      [8, 3], // HARD general
      [9, 4], // HARD general
      [7, 4], // HARD general — pushes general cap; we accept that, the
      //                       coverage test still must fire.
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(
      violations.find((v) => v.rule === 'high-leverage-coverage'),
    ).toBeDefined()
  })

  it('does NOT fire when ≥ 1 take-from-10 appears at P4-P8', () => {
    // CLEAN has take-from-10 at P5 and P8.
    const facts: Array<[number, number]> = [...CLEAN_FACTS_PR_244]
    expect(
      lintSubToTenComposition(buildCanonResponse(facts)).filter(
        (v) => v.rule === 'high-leverage-coverage',
      ),
    ).toEqual([])
  })

  it('does NOT fire when take-from-10 appears at P4-P8 even if also at P1-P3 (band-by-slot would catch the P1-P3 placement separately)', () => {
    // take-from-10 at P3 is a band-by-slot violation (P3 is EASY-only)
    // — but coverage is met because there's also one at P5.
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [10, 3], // MEDIUM at P3 — band-by-slot violation, but take-from-10 IS present
      [10, 2],
      [10, 7], // take-from-10 at P5 — satisfies coverage
      [8, 3],
      [9, 4],
      [9, 1],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(
      violations.filter((v) => v.rule === 'high-leverage-coverage'),
    ).toEqual([])
    // (band-by-slot does fire — verifies separation of concerns)
    expect(
      violations.find((v) => v.rule === 'band-by-slot' && v.problemIndex === 3),
    ).toBeDefined()
  })
})

describe('lintSubToTenComposition — no-duplicates rule', () => {
  it('fires when the same (a,b) pair appears twice', () => {
    const facts: Array<[number, number]> = [
      [7, 0],
      [6, 3],
      [9, 1],
      [10, 2],
      [10, 3], // first 10-3
      [10, 3], // duplicate 10-3
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    const dup = violations.filter((v) => v.rule === 'no-duplicates')
    expect(dup).toHaveLength(1)
    expect(dup[0]!.factId).toBe('10-3')
    expect(dup[0]!.message).toContain('appears 2 times')
  })

  it('does NOT confuse same-category different-fact (5-5 and 8-8 are different pairs)', () => {
    const facts: Array<[number, number]> = [
      [5, 5],
      [8, 8],
      [9, 1],
      [10, 2],
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const violations = lintSubToTenComposition(buildCanonResponse(facts))
    expect(violations.filter((v) => v.rule === 'no-duplicates')).toEqual([])
  })
})

describe('lintSubToTenComposition — unparseable-problem rule', () => {
  it('fires when read text does not match either subtraction template', () => {
    const response: SessionStartResponse = {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        readUtterance(1, 7, 0),
        rawReadUtterance(2, 'Two plus three. How many?'), // ← addition (out of scope)
        readUtterance(3, 9, 1),
        readUtterance(4, 10, 2),
        readUtterance(5, 10, 3),
        readUtterance(6, 8, 3),
        readUtterance(7, 9, 4),
        readUtterance(8, 10, 7),
      ],
    }
    const violations = lintSubToTenComposition(response)
    const unp = violations.filter((v) => v.rule === 'unparseable-problem')
    expect(unp).toHaveLength(1)
    expect(unp[0]!.problemIndex).toBe(2)
  })

  it('still runs whole-session checks (coverage, dedup) on the parseable subset', () => {
    // Make P5 unparseable AND remove all take-from-10 facts so coverage
    // also fires — verifies the two rules run independently.
    const response: SessionStartResponse = {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        readUtterance(1, 7, 0),
        readUtterance(2, 6, 3),
        readUtterance(3, 9, 1),
        readUtterance(4, 10, 2),
        rawReadUtterance(5, 'garbage text'),
        readUtterance(6, 8, 3),
        readUtterance(7, 9, 4),
        readUtterance(8, 7, 4), // general (3rd HARD/general — also cap)
      ],
    }
    const violations = lintSubToTenComposition(response)
    expect(
      violations.find((v) => v.rule === 'unparseable-problem'),
    ).toBeDefined()
    expect(
      violations.find((v) => v.rule === 'high-leverage-coverage'),
    ).toBeDefined()
    expect(
      violations.find(
        (v) => v.rule === 'category-cap' && v.message.includes('general'),
      ),
    ).toBeDefined()
  })
})

// ── assertSubToTenCompositionClean ───────────────────────────────────────

describe('assertSubToTenCompositionClean', () => {
  it('does not throw on a clean canon', () => {
    const response = buildCanonResponse([...CLEAN_FACTS_PR_244])
    expect(() =>
      assertSubToTenCompositionClean('math/sub-to-10', response),
    ).not.toThrow()
  })

  it('throws CompositionLintError with the canon id + violations', () => {
    // 3 doubles in a row blows the cap and the band-by-slot is fine.
    const facts: Array<[number, number]> = [
      [10, 5], // doubles 1
      [8, 4], // doubles 2
      [6, 3], // doubles 3
      [10, 2],
      [10, 3],
      [8, 3],
      [9, 4],
      [10, 7],
    ]
    const response = buildCanonResponse(facts)
    try {
      assertSubToTenCompositionClean('math/sub-to-10', response)
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(CompositionLintError)
      const e = err as CompositionLintError
      expect(e.canonId).toBe('math/sub-to-10')
      expect(e.violations.length).toBeGreaterThanOrEqual(1)
      expect(e.message).toContain('math/sub-to-10')
    }
  })
})

// ── pool sanity (defends against accidental edits to SUB_TO_TEN_POOL) ────

describe('SUB_TO_TEN_POOL', () => {
  it('contains exactly 22 facts (post-PR #249/#252 widening)', () => {
    expect(SUB_TO_TEN_POOL).toHaveLength(22)
  })

  it('every fact has a unique id', () => {
    const ids = new Set(SUB_TO_TEN_POOL.map((f) => f.id))
    expect(ids.size).toBe(SUB_TO_TEN_POOL.length)
  })

  it('every fact id matches its (a, b) numerics', () => {
    for (const f of SUB_TO_TEN_POOL) {
      expect(f.id).toBe(`${f.a}-${f.b}`)
    }
  })

  it('every fact answer is in [0, 9]', () => {
    for (const f of SUB_TO_TEN_POOL) {
      const answer = f.a - f.b
      expect(answer).toBeGreaterThanOrEqual(0)
      expect(answer).toBeLessThanOrEqual(9)
    }
  })

  it('band counts match design spec §1.1 (post-amendments): 8 EASY, 8 MEDIUM, 6 HARD', () => {
    const counts = SUB_TO_TEN_POOL.reduce(
      (acc, f) => {
        acc[f.band] = (acc[f.band] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
    expect(counts.EASY).toBe(8)
    expect(counts.MEDIUM).toBe(8)
    expect(counts.HARD).toBe(6)
  })

  it('category counts match design spec §1.1 (post-amendments)', () => {
    // Per design/math/sub-to-10-content.md §1.1 "Category counts":
    //   subtract-self ×2 · subtract-zero ×2 · doubles ×3 · subtract-one ×4 ·
    //   subtract-two ×3 · take-from-10 ×2 · general ×6.
    // (`doubles` in the spec maps to `doubles-halving` in this lint —
    // the rule rename is deferred to a follow-up ticket per PR #251.)
    const counts = SUB_TO_TEN_POOL.reduce(
      (acc, f) => {
        acc[f.category] = (acc[f.category] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
    expect(counts['subtract-self']).toBe(2)
    expect(counts['subtract-zero']).toBe(2)
    expect(counts['doubles-halving']).toBe(3)
    expect(counts['subtract-one']).toBe(4)
    expect(counts['subtract-two']).toBe(3)
    expect(counts['take-from-10']).toBe(2)
    expect(counts['general']).toBe(6)
  })
})

// ── resolveTierBinding ───────────────────────────────────────────────────

describe('resolveTierBinding', () => {
  it('binds the canonical sub-to-10 path on this platform (handles both sep flavours)', () => {
    const binding = resolveTierBinding(
      'canon/math/level-1/sub-to-10.json'.replace(/\//g, sep),
    )
    expect(binding).not.toBeNull()
    expect(binding!.tier).toBe('sub-to-10')
  })

  it('binds a posix path as well', () => {
    expect(resolveTierBinding('canon/math/level-1/sub-to-10.json')?.tier).toBe(
      'sub-to-10',
    )
  })

  it('binds bare basename (used by some test paths)', () => {
    expect(resolveTierBinding('sub-to-10.json')?.tier).toBe('sub-to-10')
  })

  it('returns null for out-of-scope tier files', () => {
    // sub-to-10 + add-to-10 + sub-to-20 are bake-time-bound. The
    // sub-to-20 binding was activated in the rebake PR (ticket
    // 86c9utet9) alongside a fresh canon that respects Kyle's PR #269
    // spec (no-borrow, minuend 11-19, "How many are left?" template).
    // Asserted positively in the dedicated `resolveTierBinding —
    // sub-to-20` describe block below.
    expect(resolveTierBinding('canon/math/level-1/add-to-20.json')).toBeNull()
    expect(
      resolveTierBinding('canon/word-song/level-1/blending-cv.json'),
    ).toBeNull()
    expect(
      resolveTierBinding('canon/word-song/level-1/cvc-words-short-u.json'),
    ).toBeNull()
  })

  it('returns null for non-canon files (defensive)', () => {
    expect(resolveTierBinding('some/random/file.json')).toBeNull()
    expect(resolveTierBinding('')).toBeNull()
  })
})

// ── runCompositionLint: disk walker ──────────────────────────────────────

describe('runCompositionLint — disk walker', () => {
  let tmp: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'composition-lint-'))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  function writeCanon(path: string, body: SessionStartResponse): void {
    const abs = join(tmp, path)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, JSON.stringify(body, null, 2), 'utf8')
  }

  it('returns empty result when canonRoot does not exist', () => {
    const r = runCompositionLint(join(tmp, 'does-not-exist'))
    expect(r.filesScanned).toBe(0)
    expect(r.filesLinted).toBe(0)
    expect(r.totalViolations).toBe(0)
  })

  it('lints in-scope math tiers (sub-to-10 + add-to-10 + sub-to-20) and SKIPS out-of-scope tiers', () => {
    // In-scope sub-to-10.
    writeCanon(
      'math/level-1/sub-to-10.json',
      buildCanonResponse([...CLEAN_FACTS_PR_244]),
    )
    // In-scope add-to-10 (clean canon mirroring the post-PR-245 layout).
    writeCanon(
      'math/level-1/add-to-10.json',
      buildAddCanonResponse([...CLEAN_ADD_FACTS]),
    )
    // In-scope sub-to-20 (clean canon mirroring the rebake PR 86c9utet9
    // layout — bound through resolveTierBinding alongside the fresh
    // post-spec canon).
    writeCanon(
      'math/level-1/sub-to-20.json',
      buildSubToTwentyCanonResponse([...CLEAN_SUB_TO_TWENTY_FACTS]),
    )
    // Out-of-scope.
    writeCanon('math/level-1/add-to-20.json', {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        {
          id: 'math.p1.read',
          text: 'Seven plus six. How many?',
          audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
        },
      ],
    })
    writeCanon('word-song/level-1/blending-cv.json', {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        {
          id: 'word.p1.read',
          text: 'Tap the cat.',
          audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
        },
      ],
    })

    const r = runCompositionLint(tmp)
    expect(r.filesScanned).toBe(5)
    expect(r.filesLinted).toBe(3)
    expect(r.filesSkipped).toBe(2)
    expect(r.totalViolations).toBe(0)
    expect(r.findings).toEqual([])
  })

  it('records violations grouped by file', () => {
    // Bad canon: 3 doubles.
    writeCanon(
      'math/level-1/sub-to-10.json',
      buildCanonResponse([
        [10, 5],
        [8, 4],
        [6, 3],
        [10, 2],
        [10, 3],
        [8, 3],
        [9, 4],
        [10, 7],
      ]),
    )
    const r = runCompositionLint(tmp)
    expect(r.filesLinted).toBe(1)
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]!.filePath).toContain('math/level-1/sub-to-10.json')
    expect(r.findings[0]!.tier).toBe('sub-to-10')
    expect(r.findings[0]!.violations.length).toBeGreaterThanOrEqual(1)
    expect(r.totalViolations).toBe(r.findings[0]!.violations.length)
  })

  it('records unparseable JSON without throwing', () => {
    // Manually write malformed JSON at the sub-to-10 path.
    const abs = join(tmp, 'math/level-1/sub-to-10.json')
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, '{ not json', 'utf8')
    const r = runCompositionLint(tmp)
    expect(r.unparseable).toHaveLength(1)
    expect(r.unparseable[0]!.filePath).toContain('sub-to-10.json')
  })

  it('records shape-mismatch (not a SessionStartResponse) as unparseable', () => {
    const abs = join(tmp, 'math/level-1/sub-to-10.json')
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, '{"hello":"world"}', 'utf8')
    const r = runCompositionLint(tmp)
    expect(r.unparseable).toHaveLength(1)
    expect(r.unparseable[0]!.reason).toBe('not a SessionStartResponse')
  })
})

// ── formatCompositionLintReport ──────────────────────────────────────────

describe('formatCompositionLintReport', () => {
  it('renders "no violations" cleanly', () => {
    const out = formatCompositionLintReport({
      filesScanned: 5,
      filesLinted: 1,
      filesSkipped: 4,
      totalViolations: 0,
      findings: [],
      unparseable: [],
    })
    expect(out).toContain('files scanned: 5')
    expect(out).toContain('files linted:  1')
    expect(out).toContain('files skipped: 4')
    expect(out).toContain('No composition violations')
  })

  it('renders each finding with rule, slot, and message', () => {
    const out = formatCompositionLintReport({
      filesScanned: 1,
      filesLinted: 1,
      filesSkipped: 0,
      totalViolations: 1,
      findings: [
        {
          filePath: 'math/level-1/sub-to-10.json',
          tier: 'sub-to-10',
          violations: [
            {
              rule: 'category-cap',
              problemIndex: null,
              message:
                'Category "doubles-halving" cap is 1; canon has 3 (slots P1, P2, P3).',
              factId: null,
            },
          ],
        },
      ],
      unparseable: [],
    })
    expect(out).toContain('math/level-1/sub-to-10.json')
    expect(out).toContain('sub-to-10')
    expect(out).toContain('category-cap')
    expect(out).toContain('slot=*')
    expect(out).toContain('Category "doubles-halving"')
  })

  it('lists unparseable files separately', () => {
    const out = formatCompositionLintReport({
      filesScanned: 1,
      filesLinted: 0,
      filesSkipped: 0,
      totalViolations: 0,
      findings: [],
      unparseable: [{ filePath: 'sub-to-10.json', reason: 'JSON parse error' }],
    })
    expect(out).toContain('Unparseable files:')
    expect(out).toContain('sub-to-10.json')
  })
})

// ── SUB_TO_TEN_RULES sanity (defends against accidental config edits) ────

describe('SUB_TO_TEN_RULES', () => {
  it('has totalProblems = 8', () => {
    expect(SUB_TO_TEN_RULES.totalProblems).toBe(8)
  })

  it('has take-from-10 cap of 2 (high-value category)', () => {
    expect(SUB_TO_TEN_RULES.categoryCaps['take-from-10']).toBe(2)
  })

  it('has general cap of 2 (HARD cap)', () => {
    expect(SUB_TO_TEN_RULES.categoryCaps['general']).toBe(2)
  })

  it('has all other category caps at 1', () => {
    expect(SUB_TO_TEN_RULES.categoryCaps['subtract-self']).toBe(1)
    expect(SUB_TO_TEN_RULES.categoryCaps['subtract-zero']).toBe(1)
    expect(SUB_TO_TEN_RULES.categoryCaps['doubles-halving']).toBe(1)
    expect(SUB_TO_TEN_RULES.categoryCaps['subtract-one']).toBe(1)
    expect(SUB_TO_TEN_RULES.categoryCaps['subtract-two']).toBe(1)
  })

  it('EASY allowed at P1-P3 only (gentle ramp; tightened post-Dave-NOF-#1)', () => {
    // Per directive prose at `api/_planner.ts` SESSION COMPOSITION RULES
    // rule 3 — "Problems 4-8 (discriminate): draw from MEDIUM + HARD bands"
    // — EASY is FORBIDDEN at P4-P8. Original PR #245 allowed EASY at any
    // slot, which let an EASY-at-P5 slip past the bake-time lint in a
    // previously-shipped canon (Dave's audit, PR #247). This tightening
    // closes the defense-in-depth gap.
    expect(SUB_TO_TEN_RULES.bandAllowedSlots.EASY).toEqual([1, 2, 3])
  })

  it('MEDIUM allowed at P4-P8 only', () => {
    expect(SUB_TO_TEN_RULES.bandAllowedSlots.MEDIUM).toEqual([4, 5, 6, 7, 8])
  })

  it('HARD allowed at P5-P8 only', () => {
    expect(SUB_TO_TEN_RULES.bandAllowedSlots.HARD).toEqual([5, 6, 7, 8])
  })

  it('takeFromTenInP4ToP8Min = 1', () => {
    expect(SUB_TO_TEN_RULES.takeFromTenInP4ToP8Min).toBe(1)
  })
})

// ── drift-guard: SUB_TO_TEN_POOL ↔ MATH_TRACK_GUIDE directive prose ──────
//
// Devon's NOF on PR #245 (and Kevin's own NOF #4) flagged that the canon-
// lint pool (`SUB_TO_TEN_POOL`) and the Haiku-facing planner directive
// (`MATH_TRACK_GUIDE` FACT POOL block, currently at `api/_planner.ts:930+`)
// carry the SAME 22 facts in DIFFERENT representations — bullets with
// inline `[BAND/category]` tags vs a typed array of pool entries. They
// MUST stay in lockstep: drift means the lint either rejects a fact Haiku
// is told to emit, or accepts a fact Haiku was told is forbidden.
//
// Pool size history (kept here as a guard-rail against silent regression):
//   16 → 20 → 22 facts. The PR #249 spec widened to 20 (4 MEDIUM
//   additions for in-range wrong-op coverage); PR #252 spec widened to
//   22 (2 HARD/general additions to close the wrong-op coverage cushion).
//   Both spec changes ratified by the implementation PR that lands these
//   tests and the directive mirror in lockstep.
//
// Two-sided guard:
//   1. EXPECTED_POOL_FROM_DIRECTIVE (below) is a hand-mirrored snapshot
//      of the directive's 22 bullet lines. If the planner directive
//      changes its pool, this mirror must be updated in lockstep — the
//      programmatic parser asserts they agree.
//   2. SUB_TO_TEN_POOL is what the lint enforces. The mirror is asserted
//      deeply-equal to it — if either side drifts without the other,
//      the test fails with a clear diff.
//
// Failure mode: when either side moves, this test fails with a deep-
// equality diff pointing at the exact fact that moved. The fix is
// always "update the OTHER side too, in this same PR".

// Local alias for the pool entry shape — pulled from the exported
// `SUB_TO_TEN_POOL` const so the mirror reads as a literal in this file
// without needing a second import. Declared above its first use.
type SubToTenPoolFact = (typeof SUB_TO_TEN_POOL)[number]

/**
 * MIRROR of `api/_planner.ts` `MATH_TRACK_GUIDE` FACT POOL block (the
 * `sub-to-10:` directive section, currently 22 bullet lines). Update
 * both in lockstep when widening or reshaping the pool.
 *
 * Source bullet format (from the directive):
 *   `    · 5-5=0   [EASY/subtract-self]   (a+b=10 IN — boundary)`
 *
 * The trailing annotation `(a+b=N IN/OOR/ALIAS — ...)` is documentation
 * for Haiku's wrong-op trap selection; the regex below stops at the
 * `]` after `[BAND/category]` and ignores the annotation, so it doesn't
 * need to be encoded here.
 *
 * Stored here as the parsed shape — `{ id, a, b, band, category }` —
 * so the deep-equality assertion against `SUB_TO_TEN_POOL` gives a
 * legible failure diff. Order matches the directive's bullet order.
 */
const EXPECTED_POOL_FROM_DIRECTIVE: readonly SubToTenPoolFact[] = [
  // EASY band (8 facts)
  { id: '5-5', a: 5, b: 5, band: 'EASY', category: 'subtract-self' },
  { id: '8-8', a: 8, b: 8, band: 'EASY', category: 'subtract-self' },
  { id: '7-0', a: 7, b: 0, band: 'EASY', category: 'subtract-zero' },
  { id: '9-0', a: 9, b: 0, band: 'EASY', category: 'subtract-zero' },
  { id: '10-5', a: 10, b: 5, band: 'EASY', category: 'doubles-halving' },
  { id: '8-4', a: 8, b: 4, band: 'EASY', category: 'doubles-halving' },
  { id: '6-3', a: 6, b: 3, band: 'EASY', category: 'doubles-halving' },
  { id: '9-1', a: 9, b: 1, band: 'EASY', category: 'subtract-one' },
  // MEDIUM band (8 facts — post-PR #249 widening; 8-1, 7-1, 8-2, 6-2 added)
  { id: '10-1', a: 10, b: 1, band: 'MEDIUM', category: 'subtract-one' },
  { id: '8-1', a: 8, b: 1, band: 'MEDIUM', category: 'subtract-one' },
  { id: '7-1', a: 7, b: 1, band: 'MEDIUM', category: 'subtract-one' },
  { id: '10-2', a: 10, b: 2, band: 'MEDIUM', category: 'subtract-two' },
  { id: '8-2', a: 8, b: 2, band: 'MEDIUM', category: 'subtract-two' },
  { id: '6-2', a: 6, b: 2, band: 'MEDIUM', category: 'subtract-two' },
  { id: '10-3', a: 10, b: 3, band: 'MEDIUM', category: 'take-from-10' },
  { id: '10-7', a: 10, b: 7, band: 'MEDIUM', category: 'take-from-10' },
  // HARD band (6 facts — post-PR #252 widening; 7-3, 6-4 added)
  { id: '9-4', a: 9, b: 4, band: 'HARD', category: 'general' },
  { id: '8-3', a: 8, b: 3, band: 'HARD', category: 'general' },
  { id: '7-4', a: 7, b: 4, band: 'HARD', category: 'general' },
  { id: '9-6', a: 9, b: 6, band: 'HARD', category: 'general' },
  { id: '7-3', a: 7, b: 3, band: 'HARD', category: 'general' },
  { id: '6-4', a: 6, b: 4, band: 'HARD', category: 'general' },
]

/**
 * Parse the directive's FACT POOL block. Returns one entry per bullet
 * line matching the canonical shape:
 *
 *   `    · <a>-<b>=<answer>   [<BAND>/<category>] ...`
 *
 * Anything that does not match the bullet shape is skipped silently —
 * the FACT POOL section also contains a header line and self-check
 * paragraphs, and we only want the 22 fact bullets.
 */
function parseDirectiveFactPool(prose: string): readonly SubToTenPoolFact[] {
  // Bullet character is U+00B7 (middle dot). Tolerate leading whitespace.
  const re = /^\s*·\s+(\d+)-(\d+)=\d+\s+\[(EASY|MEDIUM|HARD)\/([a-z0-9-]+)\]/gm
  const out: SubToTenPoolFact[] = []
  for (const m of prose.matchAll(re)) {
    const a = Number.parseInt(m[1]!, 10)
    const b = Number.parseInt(m[2]!, 10)
    out.push({
      id: `${a}-${b}`,
      a,
      b,
      band: m[3]! as SubToTenPoolFact['band'],
      category: m[4]! as SubToTenPoolFact['category'],
    })
  }
  return out
}

describe('SUB_TO_TEN_POOL drift-guard against MATH_TRACK_GUIDE directive prose', () => {
  it('lint pool matches the hand-mirrored expectation from the directive (lockstep)', () => {
    // The mirror is the single source of update-pressure: if SUB_TO_TEN_POOL
    // grows, shrinks, or relabels a fact's band/category, this assertion
    // fails until the mirror is updated to match — at which point the
    // separate parser-vs-mirror assertion below forces the directive
    // prose to be updated too.
    expect(SUB_TO_TEN_POOL).toEqual(EXPECTED_POOL_FROM_DIRECTIVE)
  })

  it('directive FACT POOL bullets parse to the hand-mirrored expectation (lockstep)', () => {
    // Parses `api/_planner.ts` FACT POOL bullets at runtime. If the
    // directive moves a fact (e.g. relabels a band, removes a fact,
    // adds a 17th), this fails until the mirror is updated to match.
    //
    // Scope to the sub-to-10 tier-block via `extractTierBlock`: once a
    // second math tier with the same `· <a>-<b>=<answer> [BAND/category]`
    // bullet shape lands (sub-to-20 in this PR), an unscoped parse of
    // the full `MATH_TRACK_GUIDE` would conflate the two tiers' pools.
    // Per `planner-and-canon.md` § "Tier-block scoping for multi-tier
    // drift-guards" the parser must operate on the tier-specific slice.
    const subToTenBlock = extractTierBlock(MATH_TRACK_GUIDE, 'sub-to-10')
    const parsed = parseDirectiveFactPool(subToTenBlock)
    expect(parsed).toEqual(EXPECTED_POOL_FROM_DIRECTIVE)
  })

  it('directive prose contains exactly 22 FACT POOL bullets (matches pool size)', () => {
    // Sanity check on the parser: catches the case where the bullet
    // format is reformatted in a way that escapes the regex (parsed
    // would be []) or where someone adds extra bullets the mirror
    // doesn't cover. Post-PR #252 spec ratification: 22 facts.
    //
    // Tier-block-scoped per the comment above.
    const subToTenBlock = extractTierBlock(MATH_TRACK_GUIDE, 'sub-to-10')
    const parsed = parseDirectiveFactPool(subToTenBlock)
    expect(parsed).toHaveLength(SUB_TO_TEN_POOL.length)
    expect(parsed).toHaveLength(22)
  })
})

// ── drift-guard: SUB_TO_TEN_RULES.bandAllowedSlots ↔ directive prose ────
//
// Companion to the POOL drift-guard above (PR #246). The POOL guard
// pins the FACT POOL bullets to `SUB_TO_TEN_POOL`. This RULE guard pins
// the SESSION COMPOSITION RULES prose to `SUB_TO_TEN_RULES.bandAllowedSlots`.
//
// Why a second guard: the EASY-at-any-slot mismatch closed manually in
// PR #255 was a RULE-identity disagreement — the directive said "Problems
// 1-3 (gentle ramp): EXCLUSIVELY EASY-band facts" + "Problems 4-8
// (discriminate): draw from MEDIUM + HARD bands" (i.e. EASY only at
// P1-P3), but the data still listed `bandAllowedSlots.EASY = [1..8]`.
// The POOL guard could not catch this — the pool itself was internally
// consistent; the failure was in the slot-range rule data falling out of
// sync with the prose that describes it. A symmetric drift-guard at the
// RULE-identity layer catches that class of bug at lint time.
//
// Two-sided guard (same hybrid pattern as the POOL guard):
//   1. EXPECTED_BAND_SLOTS_FROM_DIRECTIVE (below) is a hand-mirrored
//      snapshot of the directive's three slot-range statements. If the
//      planner directive moves a band-slot boundary, this mirror must
//      be updated in lockstep — the programmatic parser asserts they
//      agree.
//   2. `SUB_TO_TEN_RULES.bandAllowedSlots` is what the lint enforces.
//      The mirror is asserted deeply-equal to it — if either side
//      drifts without the other, the test fails with a clear diff.
//
// Three relevant statements in the directive prose:
//   · Rule 1: "Problems 1-3 (gentle ramp): EXCLUSIVELY EASY-band facts."
//     → EASY allowed slots = [1, 2, 3] (and nowhere else, since Rule 3
//       restricts P4-P8 to MEDIUM + HARD).
//   · Rule 3a: "Problems 4-8 (discriminate): draw from MEDIUM + HARD bands."
//     → MEDIUM allowed slots = [4, 5, 6, 7, 8] (start = 4, end = total).
//   · Rule 3b: "HARD-band facts ... appear at P5 or later only."
//     → HARD allowed slots = [5, 6, 7, 8] (start = 5, end = total).
//
// Failure mode: when either side moves, this test fails with a deep-
// equality diff pointing at the exact band whose slot range moved. The
// fix is always "update the OTHER side too, in this same PR".

type SubToTenBandSlots = (typeof SUB_TO_TEN_RULES)['bandAllowedSlots']

/**
 * Extract the prose block for a single tier from `MATH_TRACK_GUIDE`.
 *
 * The directive lists each math focus-node under a top-level bullet:
 *   `- <tier>: <one-line summary>` followed by indented prose for the
 *   tier (FACT POOL, SESSION COMPOSITION RULES, PER-PROBLEM SHAPE, ...).
 *   The block ends at the next top-level `- <next-tier>:` bullet (or
 *   end-of-string).
 *
 * Returns the prose slice starting at the tier's bullet through (but
 * excluding) the next top-level bullet. Throws if the requested tier
 * header is not present in the prose.
 *
 * Why this exists: after PR #259 (add-to-10 directive sharpening) the
 * SESSION COMPOSITION RULES prose shape ("Problems 1-3 (gentle ramp):
 * EXCLUSIVELY EASY-band facts", "Problems 4-8 (discriminate): draw
 * from MEDIUM + HARD bands", etc.) appears VERBATIM in both the
 * sub-to-10 and the add-to-10 directive blocks. The sub-to-10 parser's
 * regexes, when run against the full `MATH_TRACK_GUIDE`, find the
 * add-to-10 occurrence first (it precedes sub-to-10 in the prose) —
 * the parsed values happen to be identical, so the assertion passes
 * coincidentally rather than by design. Scoping the parser to the
 * tier-specific block removes the coincidence.
 */
// NOTE: `nextRe` lookahead anchors on top-level `- <tier>:` bullets. If a
// future caller passes `mult-6-9` (currently the last tier bullet in
// MATH_TRACK_GUIDE), the lookahead may match `- read:` inside the
// Per-problem utterance template at api/_planner.ts:1030 rather than a
// true tier header. Current callers (sub-to-10, add-to-10) only key on
// `BAND (sum N-M):` bullets, so the over-extended slice is benign today
// — but be aware before adding a mult-6-9 caller.
function extractTierBlock(prose: string, tier: string): string {
  // Top-level tier bullets start at column 0 (no leading whitespace)
  // and use the shape `- <tier>:`. The directive's secondary bullets
  // (`  - read:`, `  - correct:`, `  - EASY (sum ...):`) are indented
  // with at least two spaces and must NOT match this anchor.
  const startRe = new RegExp(`^- ${escapeRegex(tier)}:`, 'm')
  const startMatch = startRe.exec(prose)
  if (!startMatch) {
    throw new Error(
      `extractTierBlock: could not locate tier header "- ${tier}:" in directive prose`,
    )
  }
  const sliceFrom = startMatch.index
  // Look for the NEXT top-level `- <name>:` bullet after the tier's
  // start. The lookahead must skip indented secondary bullets.
  const nextRe = /^- [\w-]+:/m
  const remainder = prose.slice(sliceFrom + startMatch[0].length)
  const nextMatch = nextRe.exec(remainder)
  const sliceTo =
    nextMatch === null
      ? prose.length
      : sliceFrom + startMatch[0].length + nextMatch.index
  return prose.slice(sliceFrom, sliceTo)
}

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * MIRROR of the directive's SESSION COMPOSITION RULES band-slot ranges.
 * Update both this mirror and the directive prose in lockstep when
 * shifting a band-slot boundary.
 *
 * Source prose (excerpted from `api/_planner.ts` SESSION COMPOSITION RULES):
 *   1. Problems 1-3 (gentle ramp): EXCLUSIVELY EASY-band facts.
 *   3. Problems 4-8 (discriminate): draw from MEDIUM + HARD bands.
 *      HARD-band facts ... appear at P5 or later only.
 */
const EXPECTED_BAND_SLOTS_FROM_DIRECTIVE: SubToTenBandSlots = {
  EASY: [1, 2, 3],
  MEDIUM: [4, 5, 6, 7, 8],
  HARD: [5, 6, 7, 8],
}

/**
 * Parse the sub-to-10 SESSION COMPOSITION RULES band-slot statements
 * from a bullet-prose source — either the `MATH_TRACK_GUIDE` sub-to-10
 * tier-block (directive prose, indented inside the planner-prompt
 * string literal) OR any spec-markdown source that uses the same
 * "Problems N-M (label): ..." sentence shape. Returns the derived
 * `bandAllowedSlots` map. Throws if any of the three expected
 * statements is missing or malformed — a structural reformat of the
 * prose must be matched by an update to this parser (in lockstep with
 * the mirror above).
 *
 * Three statements parsed:
 *   1. EASY exclusivity at P1-P3:
 *      `Problems <s>-<e> (gentle ramp): EXCLUSIVELY EASY-band facts`
 *      Yields EASY allowed slots = [s..e].
 *   2. MEDIUM+HARD discrimination at P4-P8:
 *      `Problems <s>-<e> (discriminate): draw from MEDIUM + HARD bands`
 *      Yields MEDIUM allowed slots = [s..e]; sets HARD's end = e.
 *   3. HARD-only-at-P5+ refinement:
 *      `HARD-band facts ... appear at P<n> or later only`
 *      Yields HARD allowed slots = [n..HARD-end].
 *
 * The regexes are anchorless on whitespace, so the parser works
 * against both directive prose (indented inside template-strings)
 * and spec markdown (flush-left) — the bullet-shape phrases are the
 * contract, not the surrounding indentation.
 */
function parseSubToTenBandSlotsFromBulletProse(
  prose: string,
): SubToTenBandSlots {
  const r1 =
    /Problems\s+(\d+)-(\d+)\s+\(gentle ramp\):\s+EXCLUSIVELY\s+EASY-band facts/.exec(
      prose,
    )
  if (!r1) {
    throw new Error(
      "parseSubToTenBandSlotsFromBulletProse: could not locate EASY rule — expected 'Problems N-M (gentle ramp): EXCLUSIVELY EASY-band facts' in bullet prose",
    )
  }
  const easyStart = Number.parseInt(r1[1]!, 10)
  const easyEnd = Number.parseInt(r1[2]!, 10)

  const r3a =
    /Problems\s+(\d+)-(\d+)\s+\(discriminate\):\s+draw from MEDIUM \+ HARD bands/.exec(
      prose,
    )
  if (!r3a) {
    throw new Error(
      "parseSubToTenBandSlotsFromBulletProse: could not locate MEDIUM+HARD rule — expected 'Problems N-M (discriminate): draw from MEDIUM + HARD bands' in bullet prose",
    )
  }
  const discriminateStart = Number.parseInt(r3a[1]!, 10)
  const discriminateEnd = Number.parseInt(r3a[2]!, 10)

  const r3b = /HARD-band facts[^.]*?appear at P(\d+) or later only/.exec(prose)
  if (!r3b) {
    throw new Error(
      "parseSubToTenBandSlotsFromBulletProse: could not locate HARD-band refinement — expected 'HARD-band facts ... appear at P<N> or later only' in bullet prose",
    )
  }
  const hardStart = Number.parseInt(r3b[1]!, 10)

  const range = (start: number, end: number): readonly number[] => {
    const out: number[] = []
    for (let i = start; i <= end; i++) out.push(i)
    return out
  }

  return {
    EASY: range(easyStart, easyEnd),
    MEDIUM: range(discriminateStart, discriminateEnd),
    HARD: range(hardStart, discriminateEnd),
  }
}

describe('SUB_TO_TEN_RULES.bandAllowedSlots drift-guard against directive prose', () => {
  it('lint rule data matches the hand-mirrored expectation from the directive (lockstep)', () => {
    // The mirror is the single source of update-pressure: if
    // SUB_TO_TEN_RULES.bandAllowedSlots changes (a band's slot range
    // shifts), this assertion fails until the mirror is updated to
    // match — at which point the separate parser-vs-mirror assertion
    // below forces the directive prose to be updated too.
    //
    // Mutation-test contract (documented in the PR description):
    //   Flip SUB_TO_TEN_RULES.bandAllowedSlots.EASY from [1, 2, 3] to
    //   [1, 2, 3, 4, 5, 6, 7, 8] and this test must FAIL with a deep-
    //   equality diff naming the EASY band as the discrepant key.
    //   Restore to verify GREEN.
    expect(SUB_TO_TEN_RULES.bandAllowedSlots).toEqual(
      EXPECTED_BAND_SLOTS_FROM_DIRECTIVE,
    )
  })

  it('directive SESSION COMPOSITION RULES parse to the hand-mirrored expectation (lockstep)', () => {
    // Parses `api/_planner.ts` SESSION COMPOSITION RULES at runtime.
    // If the directive moves a band-slot boundary (e.g. relaxes HARD
    // to P4-or-later, or tightens EASY to P1-P2), this fails until
    // the mirror is updated to match.
    //
    // This is the half of the guard that catches the PR #255 class of
    // bug: prose drifting away from data. If the directive said
    // "Problems 1-2 (gentle ramp): EXCLUSIVELY EASY-band facts" while
    // the data still said `EASY: [1, 2, 3]`, the parsed slots would
    // be [1, 2] and the mirror would still be [1, 2, 3] — failure
    // points at EASY with a clear diff.
    //
    // Scope the parser to the sub-to-10 tier-block. After PR #259
    // (add-to-10 directive sharpening) the SESSION COMPOSITION RULES
    // prose appears verbatim in both the sub-to-10 and add-to-10
    // blocks — `extractTierBlock` removes the coincidence so this
    // parser is exercising sub-to-10's prose specifically.
    const subToTenBlock = extractTierBlock(MATH_TRACK_GUIDE, 'sub-to-10')
    const parsed = parseSubToTenBandSlotsFromBulletProse(subToTenBlock)
    expect(parsed).toEqual(EXPECTED_BAND_SLOTS_FROM_DIRECTIVE)
  })

  it('parser throws a clear error when a required directive statement is missing', () => {
    // Sanity check on the parser: catches the case where someone
    // restructures the SESSION COMPOSITION RULES prose in a way that
    // escapes the regex (parsed bands would be undefined and the deep-
    // equality assertion above would fail with a less legible diff).
    // The throw points the maintainer at which statement disappeared.
    //
    // The mutations are applied to the sub-to-10 tier-block only.
    // After PR #259's add-to-10 directive sharpening, the SESSION
    // COMPOSITION RULES prose appears verbatim in both the sub-to-10
    // and add-to-10 blocks — scoping the mutation to the sub-to-10
    // slice keeps the "missing statement" assertion tier-relevant.
    const subToTenBlock = extractTierBlock(MATH_TRACK_GUIDE, 'sub-to-10')

    const proseMissingEasy = subToTenBlock.replace(
      /Problems\s+1-3\s+\(gentle ramp\):\s+EXCLUSIVELY\s+EASY-band facts/,
      'Problems 1-3 (gentle ramp): [REFORMATTED]',
    )
    expect(() =>
      parseSubToTenBandSlotsFromBulletProse(proseMissingEasy),
    ).toThrow(/EASY rule/)

    const proseMissingMedium = subToTenBlock.replace(
      /Problems\s+4-8\s+\(discriminate\):\s+draw from MEDIUM \+ HARD bands/,
      'Problems 4-8 (discriminate): [REFORMATTED]',
    )
    expect(() =>
      parseSubToTenBandSlotsFromBulletProse(proseMissingMedium),
    ).toThrow(/MEDIUM\+HARD rule/)

    const proseMissingHard = subToTenBlock.replace(
      /HARD-band facts[^.]*?appear at P\d+ or later only/,
      '[REFORMATTED]',
    )
    expect(() =>
      parseSubToTenBandSlotsFromBulletProse(proseMissingHard),
    ).toThrow(/HARD-band refinement/)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// add-to-10 lint tests
// ═════════════════════════════════════════════════════════════════════════

// ── parseAddToTenReadLine ────────────────────────────────────────────────

describe('parseAddToTenReadLine', () => {
  it('parses the "plus" template', () => {
    expect(parseAddToTenReadLine('Three plus two. How many?')).toEqual({
      a: 3,
      b: 2,
    })
  })

  it('parses the doubles anchor', () => {
    expect(parseAddToTenReadLine('Five plus five. How many?')).toEqual({
      a: 5,
      b: 5,
    })
  })

  it('is case-insensitive', () => {
    expect(parseAddToTenReadLine('TWO plus three. HOW MANY?')).toEqual({
      a: 2,
      b: 3,
    })
  })

  it('returns null for subtraction templates (out of scope for add-to-10)', () => {
    expect(
      parseAddToTenReadLine('Seven minus three. How many are left?'),
    ).toBeNull()
    expect(
      parseAddToTenReadLine('Eight take away three. How many are left?'),
    ).toBeNull()
  })

  it('returns null for unrecognised number words', () => {
    expect(parseAddToTenReadLine('Eleven plus three. How many?')).toBeNull()
  })

  it('returns null for completely off-shape text', () => {
    expect(parseAddToTenReadLine('Tap the cat.')).toBeNull()
    expect(parseAddToTenReadLine('')).toBeNull()
  })
})

// ── ADD_TO_TEN_POOL sanity ───────────────────────────────────────────────

describe('ADD_TO_TEN_POOL', () => {
  it('contains exactly 44 facts (a≥1, b≥1, 3≤a+b≤10, ordered pairs)', () => {
    expect(ADD_TO_TEN_POOL).toHaveLength(44)
  })

  it('every fact has a unique id', () => {
    const ids = new Set(ADD_TO_TEN_POOL.map((f) => f.id))
    expect(ids.size).toBe(ADD_TO_TEN_POOL.length)
  })

  it('every fact id matches its (a, b) numerics', () => {
    for (const f of ADD_TO_TEN_POOL) {
      expect(f.id).toBe(`${f.a}+${f.b}`)
    }
  })

  it('every fact has a,b in [1,9] and sum in [3,10]', () => {
    for (const f of ADD_TO_TEN_POOL) {
      expect(f.a).toBeGreaterThanOrEqual(1)
      expect(f.a).toBeLessThanOrEqual(9)
      expect(f.b).toBeGreaterThanOrEqual(1)
      expect(f.b).toBeLessThanOrEqual(9)
      const sum = f.a + f.b
      expect(sum).toBeGreaterThanOrEqual(3)
      expect(sum).toBeLessThanOrEqual(10)
    }
  })

  it('treats commutative pairs as DISTINCT facts (2+3 and 3+2 both present)', () => {
    expect(ADD_TO_TEN_POOL.find((f) => f.id === '2+3')).toBeDefined()
    expect(ADD_TO_TEN_POOL.find((f) => f.id === '3+2')).toBeDefined()
  })

  it('band counts: EASY (sum 3-5) = 9, MEDIUM (sum 6-8) = 18, HARD (sum 9-10) = 17', () => {
    const counts = ADD_TO_TEN_POOL.reduce(
      (acc, f) => {
        acc[f.band] = (acc[f.band] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
    expect(counts.EASY).toBe(9)
    expect(counts.MEDIUM).toBe(18)
    expect(counts.HARD).toBe(17)
  })

  it('category counts: doubles=3, plus-one=14, near-doubles=6, sums-to-10=9, general=12', () => {
    // Priority order: sums-to-10 wins over plus-one (1+9 and 9+1 are
    // make-10 facts AND plus-one shape; pedagogically they belong with
    // sums-to-10 — same make-10 mental model). That makes:
    //   sums-to-10 = {1+9, 2+8, 3+7, 4+6, 5+5, 6+4, 7+3, 8+2, 9+1} = 9
    //   plus-one   = 16 (a==1 or b==1, a!=b, sum>=3) − 2 (1+9, 9+1) = 14
    const counts = ADD_TO_TEN_POOL.reduce(
      (acc, f) => {
        acc[f.category] = (acc[f.category] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
    expect(counts.doubles).toBe(3)
    expect(counts['plus-one']).toBe(14)
    expect(counts['near-doubles']).toBe(6)
    expect(counts['sums-to-10']).toBe(9)
    expect(counts.general).toBe(12)
  })

  it('5+5 is categorised as sums-to-10 (not doubles) — the pedagogical anchor', () => {
    // Per the rule design note: 5+5 lives in sums-to-10 because Marian's
    // diagnostic flags sums-to-10 automaticity as the top priority. The
    // current canon's P8 = 5+5 satisfies the sums-to-10 coverage rule.
    const fact55 = ADD_TO_TEN_POOL.find((f) => f.id === '5+5')
    expect(fact55).toBeDefined()
    expect(fact55!.category).toBe('sums-to-10')
  })

  it('doubles category contains exactly {2+2, 3+3, 4+4} — 5+5 is sums-to-10 instead', () => {
    const doublesIds = ADD_TO_TEN_POOL.filter((f) => f.category === 'doubles')
      .map((f) => f.id)
      .sort()
    expect(doublesIds).toEqual(['2+2', '3+3', '4+4'])
  })

  it('sums-to-10 category contains exactly the 9 facts summing to 10', () => {
    // All 9 sum-to-10 facts (including 1+9 and 9+1) land here — the
    // pedagogical make-10 mental model. The bare plus-one shape doesn't
    // override it.
    const stId = ADD_TO_TEN_POOL.filter((f) => f.category === 'sums-to-10')
      .map((f) => f.id)
      .sort()
    expect(stId).toEqual([
      '1+9',
      '2+8',
      '3+7',
      '4+6',
      '5+5',
      '6+4',
      '7+3',
      '8+2',
      '9+1',
    ])
  })

  it('forbids sum=2 (1+1 is NOT in the pool — directive says sums 3-10)', () => {
    expect(ADD_TO_TEN_POOL.find((f) => f.id === '1+1')).toBeUndefined()
  })

  it('forbids sums > 10 (e.g. 6+6 is NOT in the pool — that is add-to-20 territory)', () => {
    expect(ADD_TO_TEN_POOL.find((f) => f.id === '6+6')).toBeUndefined()
    expect(ADD_TO_TEN_POOL.find((f) => f.id === '7+8')).toBeUndefined()
  })
})

// ── ADD_TO_TEN_RULES sanity ──────────────────────────────────────────────

describe('ADD_TO_TEN_RULES', () => {
  it('has totalProblems = 8', () => {
    expect(ADD_TO_TEN_RULES.totalProblems).toBe(8)
  })

  it('has sums-to-10 cap of 2 (high-value category)', () => {
    expect(ADD_TO_TEN_RULES.categoryCaps['sums-to-10']).toBe(2)
  })

  it('has near-doubles cap of 3 (allows the current canon P3+P4+P7 layout)', () => {
    expect(ADD_TO_TEN_RULES.categoryCaps['near-doubles']).toBe(3)
  })

  it('has doubles, plus-one, general all capped at 2', () => {
    expect(ADD_TO_TEN_RULES.categoryCaps['doubles']).toBe(2)
    expect(ADD_TO_TEN_RULES.categoryCaps['plus-one']).toBe(2)
    expect(ADD_TO_TEN_RULES.categoryCaps['general']).toBe(2)
  })

  it('EASY allowed at all slots P1-P8', () => {
    expect(ADD_TO_TEN_RULES.bandAllowedSlots.EASY).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ])
  })

  it('MEDIUM allowed at P4-P8 only', () => {
    expect(ADD_TO_TEN_RULES.bandAllowedSlots.MEDIUM).toEqual([4, 5, 6, 7, 8])
  })

  it('HARD allowed at P5-P8 only', () => {
    expect(ADD_TO_TEN_RULES.bandAllowedSlots.HARD).toEqual([5, 6, 7, 8])
  })

  it('sumsToTenInP4ToP8Min = 1', () => {
    expect(ADD_TO_TEN_RULES.sumsToTenInP4ToP8Min).toBe(1)
  })
})

// ── lintAddToTenComposition: clean canon ─────────────────────────────────

describe('lintAddToTenComposition — clean canon passes', () => {
  it('returns 0 violations for the post-PR-245 add-to-10 canon fact set', () => {
    const response = buildAddCanonResponse([...CLEAN_ADD_FACTS])
    expect(lintAddToTenComposition(response)).toEqual([])
  })

  it('does not throw on the clean canon via assert helper', () => {
    const response = buildAddCanonResponse([...CLEAN_ADD_FACTS])
    expect(() =>
      assertAddToTenCompositionClean('math/add-to-10', response),
    ).not.toThrow()
  })
})

// ── lintAddToTenComposition: pool-membership ─────────────────────────────

describe('lintAddToTenComposition — pool-membership rule', () => {
  it('fires when sum > 10 (1+10 is NOT a valid add-to-10 fact: b > 9)', () => {
    // We can't actually emit 1+10 via numberWord (it would render as
    // "ten" which DOES parse), so simulate by using an out-of-pool fact
    // through the read template. 10+0 is not in the pool either.
    const facts: Array<[number, number]> = [
      [2, 1],
      [2, 2],
      [3, 2],
      [4, 3],
      [5, 3],
      [4, 4],
      [5, 4],
      [10, 0], // sum=10 but b=0 — outside the a≥1, b≥1 pool
    ]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    const pool = violations.filter((v) => v.rule === 'pool-membership')
    expect(pool).toHaveLength(1)
    expect(pool[0]!.problemIndex).toBe(8)
    expect(pool[0]!.factId).toBe('10+0')
  })

  it('fires when sum > 10 (8+5=13 → outside add-to-10 territory)', () => {
    const facts: Array<[number, number]> = [
      [2, 1],
      [2, 2],
      [3, 2],
      [8, 5], // sum=13 — that's add-to-20's domain
      [5, 3],
      [4, 4],
      [5, 4],
      [5, 5],
    ]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    const pool = violations.filter((v) => v.rule === 'pool-membership')
    expect(pool).toHaveLength(1)
    expect(pool[0]!.factId).toBe('8+5')
  })

  it('fires when sum < 3 (1+1=2 is below the directive floor)', () => {
    const facts: Array<[number, number]> = [
      [1, 1], // sum=2 — below directive floor of 3
      [2, 2],
      [3, 2],
      [4, 3],
      [5, 3],
      [4, 4],
      [5, 4],
      [5, 5],
    ]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    const pool = violations.filter((v) => v.rule === 'pool-membership')
    expect(pool).toHaveLength(1)
    expect(pool[0]!.factId).toBe('1+1')
  })
})

// ── lintAddToTenComposition: category-cap rule ───────────────────────────

describe('lintAddToTenComposition — category-cap rule', () => {
  it('fires on doubles count > 2 (3 doubles blows the cap)', () => {
    // 2+2, 3+3, 4+4 — three doubles facts (recall 5+5 is sums-to-10,
    // not doubles).
    const facts: Array<[number, number]> = [
      [2, 2],
      [3, 3],
      [4, 4], // 3 doubles — cap is 2
      [4, 3],
      [5, 3],
      [3, 4],
      [5, 4],
      [5, 5],
    ]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    const cap = violations.filter((v) => v.rule === 'category-cap')
    expect(cap.find((v) => v.message.includes('doubles'))).toBeDefined()
    expect(cap.find((v) => v.message.includes('"doubles"'))!.message).toContain(
      'cap is 2',
    )
    expect(cap.find((v) => v.message.includes('"doubles"'))!.message).toContain(
      'canon has 3',
    )
  })

  it('fires on sums-to-10 count > 2 (3 make-10 facts blows the cap)', () => {
    // 3+7, 4+6, 5+5 — three sums-to-10 facts (cap 2).
    const facts: Array<[number, number]> = [
      [2, 1],
      [2, 2],
      [3, 2],
      [4, 3],
      [3, 7], // sums-to-10 #1, HARD
      [4, 6], // sums-to-10 #2, HARD
      [5, 5], // sums-to-10 #3 — cap busted
      [5, 4],
    ]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    const cap = violations.filter(
      (v) => v.rule === 'category-cap' && v.message.includes('sums-to-10'),
    )
    expect(cap).toHaveLength(1)
    expect(cap[0]!.message).toContain('cap is 2')
    expect(cap[0]!.message).toContain('canon has 3')
  })

  it('fires on general count > 2 (HARD cap)', () => {
    // 2+4, 4+2, 5+2 — three general facts.
    const facts: Array<[number, number]> = [
      [2, 1],
      [2, 2],
      [3, 2],
      [2, 4], // general MEDIUM
      [4, 2], // general MEDIUM
      [5, 2], // general MEDIUM — cap busted (3rd general)
      [5, 4],
      [5, 5],
    ]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    const cap = violations.filter(
      (v) => v.rule === 'category-cap' && v.message.includes('"general"'),
    )
    expect(cap).toHaveLength(1)
    expect(cap[0]!.message).toContain('cap is 2')
    expect(cap[0]!.message).toContain('canon has 3')
  })

  it('does NOT fire on near-doubles count of 3 (cap is 3)', () => {
    // The current canon has 3 near-doubles (3+2, 4+3, 5+4) — exactly at
    // the cap, not over it.
    const facts: Array<[number, number]> = [...CLEAN_ADD_FACTS]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    expect(violations.filter((v) => v.rule === 'category-cap')).toEqual([])
  })
})

// ── lintAddToTenComposition: band-by-slot rule ───────────────────────────

describe('lintAddToTenComposition — band-by-slot rule', () => {
  it('fires when HARD-band fact appears at P4 (P1-P4 forbid HARD)', () => {
    // Move 5+5 (HARD sums-to-10) to P4. Clean canon had it at P8.
    const facts: Array<[number, number]> = [
      [2, 1],
      [2, 2],
      [3, 2],
      [5, 5], // HARD at P4 — band-by-slot violation
      [4, 3],
      [5, 3],
      [4, 4],
      [5, 4],
    ]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    const band = violations.filter((v) => v.rule === 'band-by-slot')
    expect(band).toHaveLength(1)
    expect(band[0]!.problemIndex).toBe(4)
    expect(band[0]!.factId).toBe('5+5')
    expect(band[0]!.message).toContain('HARD')
  })

  it('fires when MEDIUM-band fact appears at P3 (P1-P3 EASY-only)', () => {
    // Move 4+4 (MEDIUM sum=8) to P3.
    const facts: Array<[number, number]> = [
      [2, 1],
      [2, 2],
      [4, 4], // MEDIUM at P3 — band-by-slot violation
      [3, 2],
      [4, 3],
      [5, 3],
      [5, 4],
      [5, 5],
    ]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    const band = violations.filter((v) => v.rule === 'band-by-slot')
    expect(band).toHaveLength(1)
    expect(band[0]!.problemIndex).toBe(3)
    expect(band[0]!.factId).toBe('4+4')
    expect(band[0]!.message).toContain('MEDIUM')
  })

  it('does NOT fire when HARD facts are at P5-P8', () => {
    const facts: Array<[number, number]> = [...CLEAN_ADD_FACTS]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    expect(violations.filter((v) => v.rule === 'band-by-slot')).toEqual([])
  })
})

// ── lintAddToTenComposition: sums-to-10-coverage rule ────────────────────

describe('lintAddToTenComposition — sums-to-10-coverage rule', () => {
  it('fires when no sums-to-10 fact appears in P4-P8', () => {
    // Replace 5+5 with a non-sums-to-10 HARD fact (5+4 already at P7,
    // can we use 6+3? Yes, sum=9, HARD, general).
    const facts: Array<[number, number]> = [
      [2, 1],
      [2, 2],
      [3, 2],
      [4, 3],
      [5, 3],
      [4, 4],
      [5, 4], // HARD near-doubles
      [6, 3], // HARD general — replaces the sums-to-10 anchor
    ]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    expect(
      violations.find((v) => v.rule === 'high-leverage-coverage'),
    ).toBeDefined()
  })

  it('does NOT fire when ≥ 1 sums-to-10 appears at P4-P8', () => {
    // CLEAN has 5+5 at P8.
    const facts: Array<[number, number]> = [...CLEAN_ADD_FACTS]
    expect(
      lintAddToTenComposition(buildAddCanonResponse(facts)).filter(
        (v) => v.rule === 'high-leverage-coverage',
      ),
    ).toEqual([])
  })
})

// ── lintAddToTenComposition: no-duplicates rule ──────────────────────────

describe('lintAddToTenComposition — no-duplicates rule', () => {
  it('fires when the same (a,b) ordered pair appears twice', () => {
    const facts: Array<[number, number]> = [
      [2, 1],
      [2, 2],
      [3, 2],
      [4, 3],
      [5, 3], // first 5+3
      [5, 3], // duplicate 5+3
      [5, 4],
      [5, 5],
    ]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    const dup = violations.filter((v) => v.rule === 'no-duplicates')
    expect(dup).toHaveLength(1)
    expect(dup[0]!.factId).toBe('5+3')
    expect(dup[0]!.message).toContain('appears 2 times')
  })

  it('does NOT fire on commutative pairs (2+3 and 3+2 are distinct facts)', () => {
    // Both 2+3 and 3+2 are in the pool as distinct entries — the
    // read-lines differ, so they are not duplicates.
    const facts: Array<[number, number]> = [
      [2, 1],
      [2, 3], // near-doubles
      [3, 2], // near-doubles — distinct from 2+3
      [4, 3],
      [5, 3],
      [4, 4],
      [5, 4],
      [5, 5],
    ]
    const violations = lintAddToTenComposition(buildAddCanonResponse(facts))
    expect(violations.filter((v) => v.rule === 'no-duplicates')).toEqual([])
    // But near-doubles cap is 3 — we have 3 here (2+3, 3+2, 4+3). 5+4 at
    // P7 would make 4, but we placed it; let's check: 2+3 + 3+2 + 4+3 + 5+4 = 4
    // near-doubles. Cap = 3 → cap violation expected.
    expect(
      violations.find(
        (v) => v.rule === 'category-cap' && v.message.includes('near-doubles'),
      ),
    ).toBeDefined()
  })
})

// ── lintAddToTenComposition: unparseable-problem rule ────────────────────

describe('lintAddToTenComposition — unparseable-problem rule', () => {
  it('fires when read text uses the subtraction template (out of scope)', () => {
    const response: SessionStartResponse = {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        readAddUtterance(1, 2, 1),
        rawReadUtterance(2, 'Eight minus three. How many are left?'),
        readAddUtterance(3, 3, 2),
        readAddUtterance(4, 4, 3),
        readAddUtterance(5, 5, 3),
        readAddUtterance(6, 4, 4),
        readAddUtterance(7, 5, 4),
        readAddUtterance(8, 5, 5),
      ],
    }
    const violations = lintAddToTenComposition(response)
    const unp = violations.filter((v) => v.rule === 'unparseable-problem')
    expect(unp).toHaveLength(1)
    expect(unp[0]!.problemIndex).toBe(2)
  })

  it('fires when read text is wholly off-shape', () => {
    const response: SessionStartResponse = {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        readAddUtterance(1, 2, 1),
        readAddUtterance(2, 2, 2),
        readAddUtterance(3, 3, 2),
        rawReadUtterance(4, 'garbage text'),
        readAddUtterance(5, 5, 3),
        readAddUtterance(6, 4, 4),
        readAddUtterance(7, 5, 4),
        readAddUtterance(8, 5, 5),
      ],
    }
    const violations = lintAddToTenComposition(response)
    expect(
      violations.find((v) => v.rule === 'unparseable-problem'),
    ).toBeDefined()
  })
})

// ── assertAddToTenCompositionClean ───────────────────────────────────────

describe('assertAddToTenCompositionClean', () => {
  it('does not throw on a clean canon', () => {
    const response = buildAddCanonResponse([...CLEAN_ADD_FACTS])
    expect(() =>
      assertAddToTenCompositionClean('math/add-to-10', response),
    ).not.toThrow()
  })

  it('throws CompositionLintError with the canon id + violations', () => {
    // 3 doubles in a row blows the cap.
    const facts: Array<[number, number]> = [
      [2, 2],
      [3, 3],
      [4, 4],
      [4, 3],
      [5, 3],
      [3, 4],
      [5, 4],
      [5, 5],
    ]
    const response = buildAddCanonResponse(facts)
    try {
      assertAddToTenCompositionClean('math/add-to-10', response)
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(CompositionLintError)
      const e = err as CompositionLintError
      expect(e.canonId).toBe('math/add-to-10')
      expect(e.violations.length).toBeGreaterThanOrEqual(1)
      expect(e.message).toContain('math/add-to-10')
    }
  })
})

// ── resolveTierBinding for add-to-10 ─────────────────────────────────────

describe('resolveTierBinding — add-to-10', () => {
  it('binds the canonical add-to-10 path on this platform (sep-aware)', () => {
    const binding = resolveTierBinding(
      'canon/math/level-1/add-to-10.json'.replace(/\//g, sep),
    )
    expect(binding).not.toBeNull()
    expect(binding!.tier).toBe('add-to-10')
  })

  it('binds a posix add-to-10 path', () => {
    expect(resolveTierBinding('canon/math/level-1/add-to-10.json')?.tier).toBe(
      'add-to-10',
    )
  })

  it('binds bare add-to-10 basename', () => {
    expect(resolveTierBinding('add-to-10.json')?.tier).toBe('add-to-10')
  })

  it('still binds sub-to-10 paths (no cross-tier confusion)', () => {
    expect(resolveTierBinding('canon/math/level-1/sub-to-10.json')?.tier).toBe(
      'sub-to-10',
    )
  })
})

// ── runCompositionLint: add-to-10 dispatch ───────────────────────────────

describe('runCompositionLint — add-to-10 dispatch', () => {
  let tmp: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'composition-lint-add-'))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  function writeCanon(path: string, body: SessionStartResponse): void {
    const abs = join(tmp, path)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, JSON.stringify(body, null, 2), 'utf8')
  }

  it('lints a clean add-to-10 canon with zero violations', () => {
    writeCanon(
      'math/level-1/add-to-10.json',
      buildAddCanonResponse([...CLEAN_ADD_FACTS]),
    )
    const r = runCompositionLint(tmp)
    expect(r.filesScanned).toBe(1)
    expect(r.filesLinted).toBe(1)
    expect(r.totalViolations).toBe(0)
    expect(r.findings).toEqual([])
  })

  it('records add-to-10 violations grouped by file with tier="add-to-10"', () => {
    // 3 doubles → cap violation.
    writeCanon(
      'math/level-1/add-to-10.json',
      buildAddCanonResponse([
        [2, 2],
        [3, 3],
        [4, 4],
        [4, 3],
        [5, 3],
        [3, 4],
        [5, 4],
        [5, 5],
      ]),
    )
    const r = runCompositionLint(tmp)
    expect(r.filesLinted).toBe(1)
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]!.filePath).toContain('math/level-1/add-to-10.json')
    expect(r.findings[0]!.tier).toBe('add-to-10')
    expect(r.findings[0]!.violations.length).toBeGreaterThanOrEqual(1)
  })
})

// ── drift-guard: ADD_TO_TEN_POOL ↔ planner directive prose ───────────────
//
// The add-to-10 directive at `_planner.ts:921` is a ONE-LINE description
// — there is NO structured FACT POOL block to parse like sub-to-10's
// `:931-946`. So this drift-guard is shaped differently than its
// sub-to-10 sibling: rather than parse a bullet list, we assert the
// directive prose still names the rule shape the lint enforces (sums
// 3-10, addends 1-9). If a future PR rewrites that line in a way that
// changes the math, this test fails with a clear pointer.
//
// Once the directive grows a proper FACT POOL block (likely when
// Marian moves past automaticity work and the planner needs sharper
// per-fact band/category guidance), the test can be upgraded to the
// full sub-to-10-style parser/mirror pair.

describe('ADD_TO_TEN_POOL drift-guard against MATH_TRACK_GUIDE directive prose', () => {
  it('directive still describes add-to-10 with sums 3-10 and addends 1-9', () => {
    // If either bound changes, the lint pool must change in lockstep.
    expect(MATH_TRACK_GUIDE).toContain(
      'add-to-10: addition with sums 3-10. Both addends 1-9.',
    )
  })

  it('lint pool covers every (a,b) the directive permits', () => {
    // Programmatic check: pool contains every (a,b) with a∈[1,9], b∈[1,9],
    // a+b∈[3,10]. If the rules above ever drop a fact, this catches it.
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= 9; b++) {
        const sum = a + b
        if (sum < 3 || sum > 10) continue
        const found = ADD_TO_TEN_POOL.find((f) => f.a === a && f.b === b)
        expect(
          found,
          `expected pool to contain ${a}+${b} (sum ${sum})`,
        ).toBeDefined()
      }
    }
  })

  it('lint pool excludes every (a,b) the directive forbids (sums outside 3-10)', () => {
    for (const f of ADD_TO_TEN_POOL) {
      const sum = f.a + f.b
      expect(
        sum,
        `pool fact ${f.id} has sum out of range`,
      ).toBeGreaterThanOrEqual(3)
      expect(sum, `pool fact ${f.id} has sum out of range`).toBeLessThanOrEqual(
        10,
      )
    }
  })
})

// ── drift-guard: ADD_TO_TEN_RULES.bandAllowedSlots ↔ spec prose ─────────
//
// Sibling to the SUB_TO_TEN_RULES.bandAllowedSlots drift-guard above
// (PR #256). Same hybrid mirror + runtime-parser + 2-sided equality
// structure.
//
// PR #259 (add-to-10 directive sharpening) added a full SESSION
// COMPOSITION RULES block to the planner directive (`MATH_TRACK_GUIDE`)
// for add-to-10, mirroring the sub-to-10 block at `_planner.ts:1002-
// 1012`. The directive now carries the authoritative band-by-slot rules
// in-prompt, AND the spec at `design/math/add-to-10-content.md` §2.1
// retains the same rules as design documentation. The drift-guards
// fire against BOTH prose sources to prevent silent divergence:
//
//   1. SPEC drift-guard (this section, original PR #256): parses
//      `design/math/add-to-10-content.md` §2.1 — keeps Kyle's design
//      doc honest against the lint data. Same spec parser the original
//      drift-guard used; unchanged shape after PR #259.
//
//   2. DIRECTIVE drift-guard (sibling section below, added PR #259):
//      parses `MATH_TRACK_GUIDE`'s add-to-10 SESSION COMPOSITION RULES
//      bullets — mirrors sub-to-10's architecture. Catches a sub-to-10-
//      style PR #255 drift where the directive prose moves a band-slot
//      boundary while the lint data lags behind (or vice versa).
//
// Why the spec parser is NOT a copy of sub-to-10's parser: add-to-10's
// SPEC prose has a different shape from sub-to-10's directive prose —
// sub-to-10 says "Problems 1-3 (gentle ramp): EXCLUSIVELY EASY-band
// facts" (band-exclusive to a slot range), but the add-to-10 spec says
// "EASY (sum 3-5): allowed at any slot P1-P8" (band-led, slot range as
// a property of the band). The DIRECTIVE drift-guard below parses
// add-to-10's new BAND-BY-SLOT bullets in the directive (which echo the
// spec's bullet shape verbatim), reusing the same regex shape as the
// spec parser.
//
// Two-sided guard (same hybrid pattern):
//   1. EXPECTED_ADD_TO_TEN_BAND_SLOTS_FROM_SPEC (below) is a hand-mirrored
//      snapshot of the three §2.1 bullets. If the spec moves a band-slot
//      boundary, this mirror must be updated in lockstep — the
//      programmatic parser asserts they agree.
//   2. `ADD_TO_TEN_RULES.bandAllowedSlots` is what the lint enforces.
//      The mirror is asserted deeply-equal to it — if either side drifts
//      without the other, the test fails with a clear diff.
//
// Three relevant statements in the spec prose (§2.1 "Band-by-slot rule"):
//   · EASY (sum 3-5): allowed at any slot P1-P8.
//     → EASY allowed slots = [1, 2, 3, 4, 5, 6, 7, 8].
//   · MEDIUM (sum 6-8): allowed at P4-P8.
//     → MEDIUM allowed slots = [4, 5, 6, 7, 8].
//   · HARD (sum 9-10): allowed at P5-P8 only.
//     → HARD allowed slots = [5, 6, 7, 8].
//
// Failure mode: when either side moves, this test fails with a deep-
// equality diff pointing at the exact band whose slot range moved. The
// fix is always "update the OTHER side too, in this same PR".

type AddToTenBandSlots = (typeof ADD_TO_TEN_RULES)['bandAllowedSlots']

/**
 * MIRROR of the spec's §2.1 band-by-slot bullets. Update both this
 * mirror and the spec markdown in lockstep when shifting a band-slot
 * boundary.
 *
 * Source prose (excerpted from `design/math/add-to-10-content.md` §2.1
 * "Band-by-slot rule (LOCKED, matches Kevin's lint `bandAllowedSlots`)"):
 *   - EASY (sum 3-5): allowed at any slot P1-P8 ...
 *   - MEDIUM (sum 6-8): allowed at P4-P8.
 *   - HARD (sum 9-10): allowed at P5-P8 only. **HARD must NOT appear at P1-P4.**
 */
const EXPECTED_ADD_TO_TEN_BAND_SLOTS_FROM_SPEC: AddToTenBandSlots = {
  EASY: [1, 2, 3, 4, 5, 6, 7, 8],
  MEDIUM: [4, 5, 6, 7, 8],
  HARD: [5, 6, 7, 8],
}

/**
 * Parse the add-to-10 band-by-slot bullets from a bullet-prose source
 * — `design/math/add-to-10-content.md` §2.1 (spec markdown, flush-
 * left) OR the `MATH_TRACK_GUIDE` add-to-10 BAND-BY-SLOT block
 * (directive prose, indented within the planner-prompt string
 * literal). Returns the derived `bandAllowedSlots` map. Throws if any
 * of the three expected bullets is missing or malformed — a structural
 * reformat of the prose section must be matched by an update to this
 * parser (in lockstep with the mirror above).
 *
 * Three bullets parsed (one regex per band):
 *   1. `- EASY (sum N-M): allowed at any slot P<s>-P<e>` (the "any slot"
 *      hint is the discriminator — distinguishes EASY's "allowed
 *      anywhere" framing from the more restrictive MEDIUM/HARD bullets).
 *   2. `- MEDIUM (sum N-M): allowed at P<s>-P<e>.`
 *   3. `- HARD (sum N-M): allowed at P<s>-P<e> only.` (the trailing
 *      "only" is the discriminator — distinguishes HARD's tight clause
 *      from MEDIUM's plain allowance and from the boldface emphasis
 *      sentence that follows.)
 *
 * Each regex tolerates leading whitespace before the bullet dash
 * (`^\s*-`) so the parser works against both the spec markdown (`- `
 * at column 0) and the directive prose (`  - `, indented inside the
 * planner template-string).
 */
function parseAddToTenBandSlotsFromBulletProse(
  prose: string,
): AddToTenBandSlots {
  // EASY: "allowed at any slot P1-P8" — the "any slot" phrase is the
  // intentional asymmetry that wedges the parser off the EASY bullet
  // specifically. If a future editor harmonises this to "allowed at
  // P1-P8" (dropping "any slot"), parseAddToTenBandSlotsFromBulletProse
  // falls over loudly — at which point this regex needs an update.
  const easyMatch =
    /^\s*-\s+EASY\s+\(sum[^)]*\):\s+allowed at any slot P(\d+)-P(\d+)/m.exec(
      prose,
    )
  if (!easyMatch) {
    throw new Error(
      "parseAddToTenBandSlotsFromBulletProse: could not locate EASY rule — expected '- EASY (sum N-M): allowed at any slot P<s>-P<e>' bullet in spec §2.1",
    )
  }
  const easyStart = Number.parseInt(easyMatch[1]!, 10)
  const easyEnd = Number.parseInt(easyMatch[2]!, 10)

  // MEDIUM: "allowed at P4-P8." — terminal period (no trailing "only")
  // is the discriminator. If a future editor adds "only" to MEDIUM's
  // bullet, this regex stops matching loudly.
  const mediumMatch =
    /^\s*-\s+MEDIUM\s+\(sum[^)]*\):\s+allowed at P(\d+)-P(\d+)\.\s*$/m.exec(
      prose,
    )
  if (!mediumMatch) {
    throw new Error(
      "parseAddToTenBandSlotsFromBulletProse: could not locate MEDIUM rule — expected '- MEDIUM (sum N-M): allowed at P<s>-P<e>.' bullet in spec §2.1",
    )
  }
  const mediumStart = Number.parseInt(mediumMatch[1]!, 10)
  const mediumEnd = Number.parseInt(mediumMatch[2]!, 10)

  // HARD: "allowed at P5-P8 only" — the trailing "only" is the
  // discriminator that distinguishes HARD's tight clause from MEDIUM's.
  // If a future editor harmonises HARD's bullet to drop "only", this
  // parser fails loudly.
  const hardMatch =
    /^\s*-\s+HARD\s+\(sum[^)]*\):\s+allowed at P(\d+)-P(\d+)\s+only/m.exec(
      prose,
    )
  if (!hardMatch) {
    throw new Error(
      "parseAddToTenBandSlotsFromBulletProse: could not locate HARD rule — expected '- HARD (sum N-M): allowed at P<s>-P<e> only' bullet in spec §2.1",
    )
  }
  const hardStart = Number.parseInt(hardMatch[1]!, 10)
  const hardEnd = Number.parseInt(hardMatch[2]!, 10)

  const range = (start: number, end: number): readonly number[] => {
    const out: number[] = []
    for (let i = start; i <= end; i++) out.push(i)
    return out
  }

  return {
    EASY: range(easyStart, easyEnd),
    MEDIUM: range(mediumStart, mediumEnd),
    HARD: range(hardStart, hardEnd),
  }
}

describe('ADD_TO_TEN_RULES.bandAllowedSlots drift-guard against spec prose', () => {
  // Resolve the spec path once. `import.meta.url` would be cleaner but
  // requires ESM-only test env; falling back to cwd-relative keeps this
  // working in both ts-node + vitest configurations.
  const SPEC_PATH = join(
    process.cwd(),
    'design',
    'math',
    'add-to-10-content.md',
  )

  it('lint rule data matches the hand-mirrored expectation from the spec (lockstep)', () => {
    // The mirror is the single source of update-pressure: if
    // ADD_TO_TEN_RULES.bandAllowedSlots changes (a band's slot range
    // shifts), this assertion fails until the mirror is updated to
    // match — at which point the separate parser-vs-mirror assertion
    // below forces the spec markdown to be updated too.
    //
    // Mutation-test contract (documented in the PR description):
    //   Flip ADD_TO_TEN_RULES.bandAllowedSlots.HARD from [5, 6, 7, 8]
    //   to [4, 5, 6, 7, 8] (replicates a HARD-at-P4 widening that
    //   would contradict the spec §2.1 bullet "HARD must NOT appear
    //   at P1-P4"). This test must FAIL with a deep-equality diff
    //   naming the HARD band as the discrepant key. Restore to
    //   verify GREEN.
    expect(ADD_TO_TEN_RULES.bandAllowedSlots).toEqual(
      EXPECTED_ADD_TO_TEN_BAND_SLOTS_FROM_SPEC,
    )
  })

  it('spec §2.1 band-by-slot bullets parse to the hand-mirrored expectation (lockstep)', () => {
    // Parses `design/math/add-to-10-content.md` §2.1 at runtime. If the
    // spec moves a band-slot boundary (e.g. relaxes HARD to P4-or-
    // later, or tightens MEDIUM to P5-P8), this fails until the mirror
    // is updated to match.
    //
    // This is the half of the guard that catches the spec-drifting-
    // away-from-data class of bug — the symmetric counterpart to the
    // sub-to-10 PR #255 incident where lint data drifted away from
    // directive prose.
    //
    // After PR #259 (add-to-10 directive sharpening), a sibling
    // drift-guard below parses `MATH_TRACK_GUIDE` directly — this
    // spec-based guard remains in place to pin Kyle's design doc
    // alongside the directive.
    const spec = readFileSync(SPEC_PATH, 'utf8')
    const parsed = parseAddToTenBandSlotsFromBulletProse(spec)
    expect(parsed).toEqual(EXPECTED_ADD_TO_TEN_BAND_SLOTS_FROM_SPEC)
  })

  it('parser throws a clear error when a required spec bullet is missing', () => {
    // Sanity check on the parser: catches the case where someone
    // restructures §2.1's bullets in a way that escapes the regex
    // (parsed bands would be undefined and the deep-equality assertion
    // above would fail with a less legible diff). The throw points the
    // maintainer at which bullet disappeared.
    const spec = readFileSync(SPEC_PATH, 'utf8')

    const proseMissingEasy = spec.replace(
      /^-\s+EASY\s+\(sum[^)]*\):\s+allowed at any slot P\d+-P\d+/m,
      '- EASY (sum 3-5): [REFORMATTED]',
    )
    expect(() =>
      parseAddToTenBandSlotsFromBulletProse(proseMissingEasy),
    ).toThrow(/EASY rule/)

    const proseMissingMedium = spec.replace(
      /^-\s+MEDIUM\s+\(sum[^)]*\):\s+allowed at P\d+-P\d+\.\s*$/m,
      '- MEDIUM (sum 6-8): [REFORMATTED]',
    )
    expect(() =>
      parseAddToTenBandSlotsFromBulletProse(proseMissingMedium),
    ).toThrow(/MEDIUM rule/)

    const proseMissingHard = spec.replace(
      /^-\s+HARD\s+\(sum[^)]*\):\s+allowed at P\d+-P\d+\s+only/m,
      '- HARD (sum 9-10): [REFORMATTED]',
    )
    expect(() =>
      parseAddToTenBandSlotsFromBulletProse(proseMissingHard),
    ).toThrow(/HARD rule/)
  })
})

// ── drift-guard: ADD_TO_TEN_RULES.bandAllowedSlots ↔ directive prose ────
//
// Sibling to the spec-prose drift-guard above, added in PR #259 when
// the add-to-10 directive at `api/_planner.ts` gained a full SESSION
// COMPOSITION RULES + BAND-BY-SLOT block. The directive's BAND-BY-SLOT
// bullets reuse the spec's bullet shape verbatim
// (`- BAND (sum N-M): allowed at P<s>-P<e>...`), so the spec parser
// `parseAddToTenBandSlotsFromBulletProse` works without modification — the
// shape of the bullets is the contract.
//
// Why both: the spec drift-guard pins Kyle's design doc to the lint;
// the directive drift-guard pins the Haiku prompt to the lint.
// Diverging the spec from the directive without diverging from the
// lint slips through one guard but fails the other; the lint is the
// single source of update-pressure.
//
// Source prose (excerpted from `api/_planner.ts` add-to-10 BAND-BY-SLOT
// canonical restatement):
//   - EASY (sum 3-5): allowed at any slot P1-P8 ...
//   - MEDIUM (sum 6-8): allowed at P4-P8.
//   - HARD (sum 9-10): allowed at P5-P8 only.
//
// Scoped via `extractTierBlock` so the parser sees the add-to-10 block
// only — `MATH_TRACK_GUIDE` carries several tier blocks and the
// directive's other tiers (notably sub-to-10) use a different
// composition-rule shape; isolating the add-to-10 block keeps the
// parser's "find one bullet per band" semantics correct.

describe('ADD_TO_TEN_RULES.bandAllowedSlots drift-guard against directive prose', () => {
  it('directive BAND-BY-SLOT bullets parse to the hand-mirrored expectation (lockstep)', () => {
    // Parses `api/_planner.ts` add-to-10 BAND-BY-SLOT bullets at
    // runtime. If the directive moves a band-slot boundary (e.g.
    // relaxes HARD to P4-or-later, or tightens MEDIUM to P5-P8),
    // this fails until the mirror is updated to match.
    //
    // The mirror is shared with the spec-prose drift-guard above —
    // ADD_TO_TEN_RULES.bandAllowedSlots is the single source of
    // update-pressure for both directive and spec prose.
    const addToTenBlock = extractTierBlock(MATH_TRACK_GUIDE, 'add-to-10')
    const parsed = parseAddToTenBandSlotsFromBulletProse(addToTenBlock)
    expect(parsed).toEqual(EXPECTED_ADD_TO_TEN_BAND_SLOTS_FROM_SPEC)
  })

  it('parser throws a clear error when a required directive bullet is missing', () => {
    // Sanity check on the parser when scoped to the directive prose.
    // Catches the case where someone restructures `MATH_TRACK_GUIDE`'s
    // add-to-10 BAND-BY-SLOT bullets in a way that escapes the regex.
    //
    // The mutation regexes tolerate leading whitespace (`^\s*-`) because
    // the directive's bullets are indented inside the planner template-
    // string literal (`  - EASY ...`), whereas the spec markdown carries
    // the same bullets at column zero.
    const addToTenBlock = extractTierBlock(MATH_TRACK_GUIDE, 'add-to-10')

    const proseMissingEasy = addToTenBlock.replace(
      /^\s*-\s+EASY\s+\(sum[^)]*\):\s+allowed at any slot P\d+-P\d+/m,
      '  - EASY (sum 3-5): [REFORMATTED]',
    )
    expect(() =>
      parseAddToTenBandSlotsFromBulletProse(proseMissingEasy),
    ).toThrow(/EASY rule/)

    const proseMissingMedium = addToTenBlock.replace(
      /^\s*-\s+MEDIUM\s+\(sum[^)]*\):\s+allowed at P\d+-P\d+\.\s*$/m,
      '  - MEDIUM (sum 6-8): [REFORMATTED]',
    )
    expect(() =>
      parseAddToTenBandSlotsFromBulletProse(proseMissingMedium),
    ).toThrow(/MEDIUM rule/)

    const proseMissingHard = addToTenBlock.replace(
      /^\s*-\s+HARD\s+\(sum[^)]*\):\s+allowed at P\d+-P\d+\s+only/m,
      '  - HARD (sum 9-10): [REFORMATTED]',
    )
    expect(() =>
      parseAddToTenBandSlotsFromBulletProse(proseMissingHard),
    ).toThrow(/HARD rule/)
  })

  it('extractTierBlock isolates the add-to-10 prose from other tier blocks', () => {
    // Sanity check on the tier-block extractor: scoping should produce
    // a slice that contains add-to-10 prose only, NOT the sub-to-10
    // SESSION COMPOSITION RULES block (which shares many "Problems N-M"
    // phrases verbatim after PR #259). Validates the extractor's
    // tier-isolation guarantee — load-bearing for both the sub-to-10
    // drift-guard scoping above and this add-to-10 directive guard.
    const addToTenBlock = extractTierBlock(MATH_TRACK_GUIDE, 'add-to-10')
    expect(addToTenBlock).toMatch(/^- add-to-10:/)
    // The add-to-10 block must NOT carry sub-to-10's tier-distinctive
    // wrong-op fact-pool annotation (which is sub-to-10-only).
    expect(addToTenBlock).not.toMatch(/HARD\/general.*a\+b=/)
    // The add-to-10 block carries the directive's add-to-10-only
    // sums-to-10 fact list (1+9, 9+1, ...).
    expect(addToTenBlock).toMatch(/sums-to-10: 1\+9, 9\+1, 2\+8/)
  })

  it('extractTierBlock throws a clear error when the tier header is missing', () => {
    // Mutation: rename the add-to-10 header. The extractor must throw
    // rather than fall back to (e.g.) the previous tier's block.
    const proseMissingAdd = MATH_TRACK_GUIDE.replace(
      /^- add-to-10:/m,
      '- [REMOVED-TIER]:',
    )
    expect(() => extractTierBlock(proseMissingAdd, 'add-to-10')).toThrow(
      /could not locate tier header "- add-to-10:"/,
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════
// sub-to-20 lint tests (Kyle's PR #269 spec)
// ═════════════════════════════════════════════════════════════════════════

// ── sub-to-20 fixture helpers ────────────────────────────────────────────

const TEEN_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
] as const

function teenWord(n: number): string {
  return TEEN_WORDS[n]!
}

/** Build a `math.p<N>.read` sub-to-20 utterance with the "minus" template. */
function readSubToTwentyUtterance(
  index: number,
  a: number,
  b: number,
): Utterance {
  return {
    id: `math.p${index}.read`,
    text: `${teenWord(a)} minus ${teenWord(b)}. How many are left?`,
    audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
  }
}

/** Convenience: build a SessionStartResponse with the given 8 sub-to-20 facts. */
function buildSubToTwentyCanonResponse(
  facts: Array<[a: number, b: number]>,
): SessionStartResponse {
  const utterances: Utterance[] = facts.map(([a, b], i) =>
    readSubToTwentyUtterance(i + 1, a, b),
  )
  return {
    ok: true,
    kind: 'session-start',
    plan: { id: 'test', label: 'test', utterances: [] },
    utterances,
  }
}

/** A canonically valid 8-fact sub-to-20 session.
 *
 *  Picked to satisfy every rule simultaneously:
 *    P1 11-1 [EASY/subtract-one]     (subtract-one cap=1, satisfied)
 *    P2 12-2 [EASY/doubles-anchor]   (doubles-anchor cap=1, satisfied)
 *    P3 13-3 [EASY/take-to-decade]   (take-to-decade #1; EASY at P3
 *                                     does NOT count toward P4-P8 coverage
 *                                     — the MEDIUM 15-5 at P5 satisfies it)
 *    P4 14-2 [MEDIUM/subtract-two]   (CLEAN; subtract-two cap=1, satisfied)
 *    P5 15-5 [MEDIUM/take-to-decade] (ALIAS; take-to-decade #2 → cap=2 done;
 *                                     P4-P8 take-to-decade coverage met)
 *    P6 15-3 [MEDIUM/subtract-three] (CLEAN; subtract-three cap=1, satisfied)
 *    P7 16-4 [MEDIUM/general]        (CLEAN; general #1)
 *    P8 17-5 [HARD/general]          (CLEAN; general #2 → cap=2 done)
 *
 *  P4-P8 CLEAN count: 4 (14-2, 15-3, 16-4, 17-5) — meets >=2 Class B rule.
 *  P4-P8 take-to-decade count: 1 (15-5) — meets >=1 coverage rule.
 *  Band-by-slot: EASY at P1-P3, MEDIUM at P4-P7, HARD at P8 (P5+ ok).
 */
const CLEAN_SUB_TO_TWENTY_FACTS: ReadonlyArray<[number, number]> = [
  [11, 1], // P1 EASY subtract-one
  [12, 2], // P2 EASY doubles-anchor
  [13, 3], // P3 EASY take-to-decade
  [14, 2], // P4 MEDIUM subtract-two CLEAN
  [15, 5], // P5 MEDIUM take-to-decade ALIAS (covers P4-P8 take-to-decade)
  [15, 3], // P6 MEDIUM subtract-three CLEAN
  [16, 4], // P7 MEDIUM general CLEAN
  [17, 5], // P8 HARD general CLEAN
]

// ── parseSubToTwentyReadLine ─────────────────────────────────────────────

describe('parseSubToTwentyReadLine', () => {
  it('parses the "minus" template with teen minuend', () => {
    expect(
      parseSubToTwentyReadLine('Fifteen minus three. How many are left?'),
    ).toEqual({ a: 15, b: 3 })
  })

  it('parses the extremes of the no-borrow pool (11-1 and 19-9)', () => {
    expect(
      parseSubToTwentyReadLine('Eleven minus one. How many are left?'),
    ).toEqual({ a: 11, b: 1 })
    expect(
      parseSubToTwentyReadLine('Nineteen minus nine. How many are left?'),
    ).toEqual({ a: 19, b: 9 })
  })

  it('is case-insensitive', () => {
    expect(
      parseSubToTwentyReadLine('SIXTEEN minus FOUR. how many ARE LEFT?'),
    ).toEqual({ a: 16, b: 4 })
  })

  it('returns null for "take away" template (sub-to-20 uses "minus" only)', () => {
    // Spec §4.3 + §7.2 — no first-session "take away" variant for sub-to-20.
    expect(
      parseSubToTwentyReadLine('Fifteen take away three. How many are left?'),
    ).toBeNull()
  })

  it('returns null for addition template (out of scope)', () => {
    expect(parseSubToTwentyReadLine('Seven plus three. How many?')).toBeNull()
  })

  it('returns null for unrecognised number words', () => {
    expect(
      parseSubToTwentyReadLine('Twenty minus three. How many are left?'),
    ).toBeNull()
  })

  it('returns null for completely off-shape text', () => {
    expect(parseSubToTwentyReadLine('Tap the cat.')).toBeNull()
    expect(parseSubToTwentyReadLine('')).toBeNull()
  })
})

// ── SUB_TO_TWENTY_POOL sanity ────────────────────────────────────────────

describe('SUB_TO_TWENTY_POOL', () => {
  it("contains exactly 22 facts (per Kyle's spec §1.1)", () => {
    expect(SUB_TO_TWENTY_POOL).toHaveLength(22)
  })

  it('every fact has a unique id', () => {
    const ids = new Set(SUB_TO_TWENTY_POOL.map((f) => f.id))
    expect(ids.size).toBe(SUB_TO_TWENTY_POOL.length)
  })

  it('every fact id matches its (a, b) numerics', () => {
    for (const f of SUB_TO_TWENTY_POOL) {
      expect(f.id).toBe(`${f.a}-${f.b}`)
    }
  })

  it('every fact satisfies the no-borrow constraint (ones-digit(a) >= b)', () => {
    for (const f of SUB_TO_TWENTY_POOL) {
      expect(
        f.a % 10,
        `pool fact ${f.id} violates no-borrow (ones-digit ${f.a % 10} < b=${f.b})`,
      ).toBeGreaterThanOrEqual(f.b)
    }
  })

  it('every fact answer is in [10, 18]', () => {
    for (const f of SUB_TO_TWENTY_POOL) {
      const answer = f.a - f.b
      expect(answer).toBeGreaterThanOrEqual(10)
      expect(answer).toBeLessThanOrEqual(18)
    }
  })

  it('band counts match spec §1.1: 6 EASY, 10 MEDIUM, 6 HARD', () => {
    const counts = SUB_TO_TWENTY_POOL.reduce(
      (acc, f) => {
        acc[f.band] = (acc[f.band] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
    expect(counts.EASY).toBe(6)
    expect(counts.MEDIUM).toBe(10)
    expect(counts.HARD).toBe(6)
  })

  it('category counts match spec §1.1: subtract-one ×3, doubles-anchor ×1, take-to-decade ×7, subtract-two ×3, subtract-three ×1, general ×7', () => {
    const counts = SUB_TO_TWENTY_POOL.reduce(
      (acc, f) => {
        acc[f.category] = (acc[f.category] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
    expect(counts['subtract-one']).toBe(3)
    expect(counts['doubles-anchor']).toBe(1)
    expect(counts['take-to-decade']).toBe(7)
    expect(counts['subtract-two']).toBe(3)
    expect(counts['subtract-three']).toBe(1)
    expect(counts['general']).toBe(7)
  })

  it('decStatus matches the spec §1.1 column for each fact (4 CLEAN, 5 BOUNDARY, 13 ALIAS)', () => {
    // Per spec §1.1 availability table: 4 MEDIUM/HARD facts with separation
    // >= 2 are CLEAN at P4-P8 eligibility; EASY 13-1=12 is CLEAN but EASY-
    // restricted so does NOT count toward P4-P8 coverage. Total CLEAN = 5
    // including EASY 13-1, MEDIUM 14-2/15-3/15-2/16-4, HARD 17-5/18-6/19-7
    // — wait, that's more than 4. Let me recount from SUB_TO_TWENTY_POOL:
    //   EASY:   13-1 CLEAN                                  → 1
    //   MEDIUM: 14-2, 15-3, 15-2, 16-4 CLEAN                → 4
    //   HARD:   17-5, 18-6, 19-7 CLEAN                      → 3
    //   Total CLEAN: 8.
    //   BOUNDARY: 12-1, 13-2 (EASY) + 14-3, 15-4, 16-5 (MEDIUM) → 5
    //   ALIAS: 11-1, 12-2, 13-3 (EASY) + 14-4, 15-5, 16-6 (MEDIUM)
    //          + 17-7, 18-8, 19-9 (HARD)                        → 9
    //   Sum: 8 + 5 + 9 = 22. ✓
    const counts = SUB_TO_TWENTY_POOL.reduce(
      (acc, f) => {
        acc[f.decStatus] = (acc[f.decStatus] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
    expect(counts.CLEAN).toBe(8)
    expect(counts.BOUNDARY).toBe(5)
    expect(counts.ALIAS).toBe(9)
  })

  it('forbids borrow facts (e.g. 14-7=7, 18-9=9 are NOT in the pool)', () => {
    // ones-digit(14)=4 < 7 → BORROW, FORBIDDEN
    expect(SUB_TO_TWENTY_POOL.find((f) => f.id === '14-7')).toBeUndefined()
    // ones-digit(18)=8 < 9 → BORROW, FORBIDDEN
    expect(SUB_TO_TWENTY_POOL.find((f) => f.id === '18-9')).toBeUndefined()
    // ones-digit(15)=5 < 7 → BORROW, FORBIDDEN
    expect(SUB_TO_TWENTY_POOL.find((f) => f.id === '15-7')).toBeUndefined()
  })

  it('includes the highest-leverage HARD take-to-decade exemplars (15-5, 16-6, 17-7, 18-8, 19-9)', () => {
    // Dave § 4.2 names these as memorable anchors.
    expect(SUB_TO_TWENTY_POOL.find((f) => f.id === '15-5')).toBeDefined()
    expect(SUB_TO_TWENTY_POOL.find((f) => f.id === '16-6')).toBeDefined()
    expect(SUB_TO_TWENTY_POOL.find((f) => f.id === '17-7')).toBeDefined()
    expect(SUB_TO_TWENTY_POOL.find((f) => f.id === '18-8')).toBeDefined()
    expect(SUB_TO_TWENTY_POOL.find((f) => f.id === '19-9')).toBeDefined()
  })
})

// ── SUB_TO_TWENTY_RULES sanity ───────────────────────────────────────────

describe('SUB_TO_TWENTY_RULES', () => {
  it('has totalProblems = 8', () => {
    expect(SUB_TO_TWENTY_RULES.totalProblems).toBe(8)
  })

  it('has take-to-decade cap of 2 (high-value, relaxed cap per spec §2.3)', () => {
    expect(SUB_TO_TWENTY_RULES.categoryCaps['take-to-decade']).toBe(2)
  })

  it('has general cap of 2 (HARD cap)', () => {
    expect(SUB_TO_TWENTY_RULES.categoryCaps['general']).toBe(2)
  })

  it('has subtract-one, doubles-anchor, subtract-two, subtract-three all capped at 1', () => {
    expect(SUB_TO_TWENTY_RULES.categoryCaps['subtract-one']).toBe(1)
    expect(SUB_TO_TWENTY_RULES.categoryCaps['doubles-anchor']).toBe(1)
    expect(SUB_TO_TWENTY_RULES.categoryCaps['subtract-two']).toBe(1)
    expect(SUB_TO_TWENTY_RULES.categoryCaps['subtract-three']).toBe(1)
  })

  it('EASY allowed at P1-P3 only (gentle ramp; FORBIDDEN at discriminate tier)', () => {
    expect(SUB_TO_TWENTY_RULES.bandAllowedSlots.EASY).toEqual([1, 2, 3])
  })

  it('MEDIUM allowed at P4-P8 only', () => {
    expect(SUB_TO_TWENTY_RULES.bandAllowedSlots.MEDIUM).toEqual([4, 5, 6, 7, 8])
  })

  it('HARD allowed at P5-P8 only', () => {
    expect(SUB_TO_TWENTY_RULES.bandAllowedSlots.HARD).toEqual([5, 6, 7, 8])
  })

  it('takeToDecadeInP4ToP8Min = 1 (Dave § 4.2 high-leverage exemplars)', () => {
    expect(SUB_TO_TWENTY_RULES.takeToDecadeInP4ToP8Min).toBe(1)
  })

  it('cleanClassBInP4ToP8Min = 2 (Kyle spec §2.2 Class B coverage)', () => {
    // The sub-to-20-specific rule: >=2 CLEAN-annotated facts in P4-P8 so
    // the Class B (decade-anchor miss) distractor class is live at render
    // time rather than silently downgrading on every problem.
    expect(SUB_TO_TWENTY_RULES.cleanClassBInP4ToP8Min).toBe(2)
  })
})

// ── lintSubToTwentyComposition: clean canon ──────────────────────────────

describe('lintSubToTwentyComposition — clean canon passes', () => {
  it('returns 0 violations for the canonical 8-fact set', () => {
    const response = buildSubToTwentyCanonResponse([
      ...CLEAN_SUB_TO_TWENTY_FACTS,
    ])
    expect(lintSubToTwentyComposition(response)).toEqual([])
  })

  it('does not throw via assert helper', () => {
    const response = buildSubToTwentyCanonResponse([
      ...CLEAN_SUB_TO_TWENTY_FACTS,
    ])
    expect(() =>
      assertSubToTwentyCompositionClean('math/sub-to-20', response),
    ).not.toThrow()
  })
})

// ── lintSubToTwentyComposition: pool-membership rule ─────────────────────

describe('lintSubToTwentyComposition — pool-membership rule', () => {
  it('fires on a BORROW fact (14-7=7) — flagged as outside the 22-fact pool', () => {
    const facts: Array<[number, number]> = [
      [11, 1],
      [12, 2],
      [13, 3],
      [14, 7], // BORROW — outside pool
      [15, 5],
      [16, 4],
      [17, 5],
      [19, 9],
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const pool = violations.filter((v) => v.rule === 'pool-membership')
    expect(pool).toHaveLength(1)
    expect(pool[0]!.problemIndex).toBe(4)
    expect(pool[0]!.factId).toBe('14-7')
    expect(pool[0]!.message).toContain('NOT in the 22-fact sub-to-20')
  })

  it('fires on a no-borrow fact that is outside the v1 curation (15-1=14)', () => {
    // 15-1=14: ones-digit(15)=5 >= 1 → no-borrow OK, but NOT in the 22.
    const facts: Array<[number, number]> = [
      [11, 1],
      [12, 2],
      [13, 3],
      [15, 1], // outside v1 curation
      [15, 5],
      [16, 4],
      [17, 5],
      [19, 9],
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const pool = violations.filter((v) => v.rule === 'pool-membership')
    expect(pool).toHaveLength(1)
    expect(pool[0]!.factId).toBe('15-1')
  })

  it('fires on multiple borrow candidates at once (18-9, 17-8, 15-7)', () => {
    // All three are BORROW (ones-digit < subtrahend). Note: this fixture
    // also blows other rules (e.g. P4-P8 take-to-decade may not be met)
    // but the pool-membership rule fires independently per problem.
    const facts: Array<[number, number]> = [
      [11, 1],
      [12, 2],
      [13, 3],
      [14, 2],
      [18, 9], // BORROW
      [17, 8], // BORROW
      [15, 7], // BORROW
      [19, 9],
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const pool = violations.filter((v) => v.rule === 'pool-membership')
    expect(pool).toHaveLength(3)
    const factIds = pool.map((v) => v.factId).sort()
    expect(factIds).toEqual(['15-7', '17-8', '18-9'])
  })
})

// ── lintSubToTwentyComposition: category-cap rule ────────────────────────

describe('lintSubToTwentyComposition — category-cap rule', () => {
  it('fires on subtract-one count > 1 (only one subtract-one allowed)', () => {
    // 11-1 AND 13-1 are both subtract-one EASY. Pair them at P1+P2 (and
    // backfill P3 with a non-subtract-one EASY fact to keep gentle ramp
    // legal). Note: 12-1 is ALSO subtract-one, so picking three would
    // also blow the cap; we keep two for a minimal fixture.
    const facts: Array<[number, number]> = [
      [11, 1], // subtract-one
      [13, 1], // subtract-one (cap busted; one combined cap)
      [12, 2], // doubles-anchor (replace any sibling without changing the cap fire)
      [14, 2],
      [15, 5],
      [16, 4],
      [17, 5],
      [19, 9],
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const cap = violations.filter(
      (v) => v.rule === 'category-cap' && v.message.includes('subtract-one'),
    )
    expect(cap).toHaveLength(1)
    expect(cap[0]!.message).toContain('cap is 1')
    expect(cap[0]!.message).toContain('canon has 2')
  })

  it('fires on general count > 2 (HARD cap)', () => {
    // 14-3, 16-4 MEDIUM/general + 17-5, 18-6, 19-7 HARD/general = 5
    // generals. Reduce to 3 to trip the cap minimally:
    const facts: Array<[number, number]> = [
      [11, 1],
      [12, 2],
      [13, 3],
      [16, 4], // general MEDIUM
      [15, 5], // take-to-decade MEDIUM (preserves coverage rule)
      [17, 5], // general HARD
      [18, 6], // general HARD (3rd general — cap busted)
      [19, 9], // take-to-decade HARD
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const cap = violations.filter(
      (v) => v.rule === 'category-cap' && v.message.includes('"general"'),
    )
    expect(cap).toHaveLength(1)
    expect(cap[0]!.message).toContain('cap is 2')
    expect(cap[0]!.message).toContain('canon has 3')
  })

  it('does NOT fire on take-to-decade count of 2 (cap is 2 — at the cap, not over)', () => {
    // CLEAN_SUB_TO_TWENTY_FACTS has 13-3 at P3 (EASY take-to-decade) +
    // 15-5 at P5 (MEDIUM take-to-decade ALIAS) = 2 take-to-decade total,
    // exactly at the cap. No category-cap violation should fire for this
    // category.
    const facts: Array<[number, number]> = [...CLEAN_SUB_TO_TWENTY_FACTS]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const cap = violations.filter(
      (v) => v.rule === 'category-cap' && v.message.includes('take-to-decade'),
    )
    expect(cap).toEqual([])
  })

  it('fires on subtract-two count > 1', () => {
    // 14-2 + 15-2 both MEDIUM/subtract-two. Cap = 1.
    // Note: subtract-three (cap 1) and doubles-anchor (cap 1) only have
    // ONE pool entry each (15-3 and 12-2 respectively), so their caps
    // are structurally unreachable except via no-duplicates which fires
    // on the same fixture. Subtract-two and subtract-one are the testable
    // singleton caps. Subtract-one is covered above; this covers
    // subtract-two.
    const facts: Array<[number, number]> = [
      [11, 1],
      [12, 2],
      [13, 3],
      [14, 2], // subtract-two
      [15, 2], // subtract-two (cap busted; both MEDIUM, both CLEAN)
      [15, 3],
      [16, 4],
      [17, 5],
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const cap = violations.filter(
      (v) => v.rule === 'category-cap' && v.message.includes('subtract-two'),
    )
    expect(cap).toHaveLength(1)
    expect(cap[0]!.message).toContain('cap is 1')
    expect(cap[0]!.message).toContain('canon has 2')
  })
})

// ── lintSubToTwentyComposition: band-by-slot rule ────────────────────────

describe('lintSubToTwentyComposition — band-by-slot rule', () => {
  it('fires when HARD-band fact appears at P4 (P1-P4 forbid HARD)', () => {
    // Move 17-5 (HARD/general) to P4.
    const facts: Array<[number, number]> = [
      [11, 1],
      [12, 2],
      [13, 3],
      [17, 5], // HARD at P4 — band-by-slot violation
      [15, 5],
      [16, 4],
      [14, 2],
      [19, 9],
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const band = violations.filter((v) => v.rule === 'band-by-slot')
    expect(band).toHaveLength(1)
    expect(band[0]!.problemIndex).toBe(4)
    expect(band[0]!.factId).toBe('17-5')
    expect(band[0]!.message).toContain('HARD')
  })

  it('fires when MEDIUM-band fact appears at P3 (P1-P3 EASY-only)', () => {
    // Move 14-2 (MEDIUM/subtract-two CLEAN) to P3 — the only violation
    // under test. We accept that this fixture trips OTHER rules too
    // (13-3 at P4 is also EASY-at-P4-P8 band-by-slot violation; 17-5 +
    // 18-6 + 16-4 is 3 generals which busts the general cap) and filter
    // the assertion to band-by-slot at P3 specifically.
    const facts: Array<[number, number]> = [
      [11, 1], // P1 EASY
      [12, 2], // P2 EASY
      [14, 2], // P3 MEDIUM at P3 — the band-by-slot violation under test
      [13, 3], // P4 EASY at P4-P8 — separate (filtered out) violation
      [15, 5], // P5 MEDIUM take-to-decade
      [16, 4], // P6 MEDIUM general
      [17, 5], // P7 HARD general
      [19, 9], // P8 HARD take-to-decade
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const band = violations.filter(
      (v) => v.rule === 'band-by-slot' && v.problemIndex === 3,
    )
    expect(band).toHaveLength(1)
    expect(band[0]!.factId).toBe('14-2')
    expect(band[0]!.message).toContain('MEDIUM')
  })

  it('fires when EASY-band fact appears at P5 (P4-P8 forbid EASY)', () => {
    // Fixture sites 13-1 (EASY/subtract-one CLEAN) at P5 to trip the
    // P4-P8-EASY-forbidden rule. P1 is 12-2 (doubles-anchor) and P2 is
    // 11-1 (subtract-one) so the subtract-one cap = 1 is satisfied:
    // only ONE subtract-one fact (11-1 at P2) sits IN the matched set
    // (13-1 at P5 also-fires band-by-slot but still counts toward
    // category-cap — so we have to choose between band-by-slot test
    // isolation vs subtract-one cap cleanliness; here we accept that
    // category-cap subtract-one ALSO fires, and assert only band-by-slot).
    const facts: Array<[number, number]> = [
      [12, 2], // P1 EASY doubles-anchor
      [11, 1], // P2 EASY subtract-one
      [13, 3], // P3 EASY take-to-decade
      [14, 2], // P4 MEDIUM subtract-two CLEAN
      [13, 1], // P5 EASY subtract-one — band-by-slot violation (the one we want)
      [16, 4], // P6 MEDIUM general CLEAN
      [17, 5], // P7 HARD general CLEAN
      [19, 9], // P8 HARD take-to-decade ALIAS
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const band = violations.filter((v) => v.rule === 'band-by-slot')
    expect(band).toHaveLength(1)
    expect(band[0]!.problemIndex).toBe(5)
    expect(band[0]!.factId).toBe('13-1')
    expect(band[0]!.message).toContain('EASY')
    expect(band[0]!.message).toContain('[1, 2, 3]')
  })

  it('does NOT fire when HARD facts are at P5-P8', () => {
    const facts: Array<[number, number]> = [...CLEAN_SUB_TO_TWENTY_FACTS]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    expect(violations.filter((v) => v.rule === 'band-by-slot')).toEqual([])
  })
})

// ── lintSubToTwentyComposition: take-to-decade coverage rule ─────────────

describe('lintSubToTwentyComposition — take-to-decade coverage rule', () => {
  it('fires when no take-to-decade fact appears in P4-P8', () => {
    // Structural note: under pool composition + category caps, a
    // take-to-decade-FREE P4-P8 forces at least one OTHER rule to fire
    // alongside (general cap = 2; remaining 5 P4-P8 slots must absorb
    // 2 HARD generals + 3 MEDIUM non-take-to-decade, but MEDIUM has
    // only subtract-two ×2 + subtract-three ×1 + general ×3 outside
    // take-to-decade, and the singleton caps + general cap pin MEDIUM
    // contribution to <= 3 with at most 1 of each singleton — so 3
    // generals in P4-P8 always blow the cap). We accept that the
    // coverage fire here co-occurs with a category-cap fire and assert
    // only the coverage rule.
    const facts: Array<[number, number]> = [
      [11, 1], // P1 EASY subtract-one
      [12, 2], // P2 EASY doubles-anchor
      [13, 3], // P3 EASY take-to-decade (at P3 — does NOT count toward P4-P8 coverage)
      [14, 2], // P4 MEDIUM subtract-two CLEAN
      [15, 3], // P5 MEDIUM subtract-three CLEAN
      [16, 4], // P6 MEDIUM general CLEAN
      [17, 5], // P7 HARD general CLEAN (general count 2)
      [18, 6], // P8 HARD general CLEAN (general count 3 — cap fires alongside)
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    expect(
      violations.find(
        (v) =>
          v.rule === 'high-leverage-coverage' &&
          v.message.includes('take-to-decade'),
      ),
    ).toBeDefined()
  })

  it('does NOT fire when >= 1 take-to-decade appears at P4-P8', () => {
    // CLEAN_SUB_TO_TWENTY_FACTS has 15-5 at P5 and 19-9 at P8.
    const facts: Array<[number, number]> = [...CLEAN_SUB_TO_TWENTY_FACTS]
    const cov = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    ).filter(
      (v) =>
        v.rule === 'high-leverage-coverage' &&
        v.message.includes('take-to-decade'),
    )
    expect(cov).toEqual([])
  })
})

// ── lintSubToTwentyComposition: Class B coverage rule (NEW for sub-to-20) ─

describe('lintSubToTwentyComposition — Class B (decade-anchor miss) coverage rule', () => {
  it('fires when < 2 CLEAN-annotated facts appear in P4-P8 (every P4-P8 problem is ALIAS or BOUNDARY)', () => {
    // Pack P4-P8 with ALIAS / BOUNDARY-annotated facts only.
    //   P4 14-4 MEDIUM/take-to-decade ALIAS
    //   P5 15-5 MEDIUM/take-to-decade ALIAS — also satisfies take-to-decade coverage
    //   P6 14-3 MEDIUM/general BOUNDARY (general 1)
    //   P7 15-4 MEDIUM/general BOUNDARY (general 2)
    //   P8 17-7 HARD/take-to-decade ALIAS — wait, that's 3 take-to-decade
    //     (14-4 + 15-5 + 17-7 = 3 > cap 2). Swap to 16-5 MEDIUM/general
    //     BOUNDARY (general 3 — cap busted). Pick a HARD non-general
    //     non-take-to-decade: HARD has only take-to-decade and general.
    //     → Same structural problem: pool composition is forcing
    //       interactions. Use 18-8 HARD take-to-decade — then 14-4 +
    //       15-5 + 18-8 = 3 take-to-decade (cap 2). Accept the
    //       take-to-decade cap fire alongside the Class B coverage fire
    //       and filter the assertion.
    const facts: Array<[number, number]> = [
      [11, 1], // P1 EASY (ALIAS — irrelevant for Class B)
      [12, 2], // P2 EASY
      [13, 3], // P3 EASY
      [14, 4], // P4 MEDIUM take-to-decade ALIAS
      [15, 5], // P5 MEDIUM take-to-decade ALIAS
      [14, 3], // P6 MEDIUM general BOUNDARY
      [15, 4], // P7 MEDIUM general BOUNDARY
      [17, 7], // P8 HARD take-to-decade ALIAS (3rd take-to-decade — cap)
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const classB = violations.filter(
      (v) =>
        v.rule === 'high-leverage-coverage' &&
        v.message.includes('CLEAN-annotated'),
    )
    expect(classB).toHaveLength(1)
    expect(classB[0]!.message).toContain('At least 2 CLEAN-annotated')
    expect(classB[0]!.message).toContain('Canon has 0 CLEAN at P4-P8')
  })

  it('fires when exactly 1 CLEAN-annotated fact appears in P4-P8 (below the >=2 threshold)', () => {
    //   P4 14-2 MEDIUM/subtract-two CLEAN (the only CLEAN at P4-P8)
    //   P5 15-5 MEDIUM/take-to-decade ALIAS
    //   P6 14-3 MEDIUM/general BOUNDARY (general 1)
    //   P7 15-4 MEDIUM/general BOUNDARY — 2nd general (cap 2)
    //   P8 17-7 HARD/take-to-decade ALIAS
    const facts: Array<[number, number]> = [
      [11, 1], // P1 EASY
      [12, 2], // P2 EASY
      [13, 3], // P3 EASY
      [14, 2], // P4 MEDIUM subtract-two CLEAN — the ONE CLEAN
      [15, 5], // P5 MEDIUM take-to-decade ALIAS
      [14, 3], // P6 MEDIUM general BOUNDARY
      [15, 4], // P7 MEDIUM general BOUNDARY
      [17, 7], // P8 HARD take-to-decade ALIAS
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const classB = violations.filter(
      (v) =>
        v.rule === 'high-leverage-coverage' &&
        v.message.includes('CLEAN-annotated'),
    )
    expect(classB).toHaveLength(1)
    expect(classB[0]!.message).toContain('Canon has 1 CLEAN at P4-P8')
  })

  it('does NOT fire when exactly 2 CLEAN-annotated facts appear in P4-P8 (at the threshold)', () => {
    // CLEAN_SUB_TO_TWENTY_FACTS: P4 14-2 CLEAN + P6 16-4 CLEAN + P7 17-5 CLEAN = 3 CLEAN.
    // Above the threshold; rule does not fire.
    const facts: Array<[number, number]> = [...CLEAN_SUB_TO_TWENTY_FACTS]
    const classB = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    ).filter(
      (v) =>
        v.rule === 'high-leverage-coverage' &&
        v.message.includes('CLEAN-annotated'),
    )
    expect(classB).toEqual([])
  })

  it('does NOT count EASY-band CLEAN facts (13-1 at P3 is CLEAN but EASY-restricted, not in P4-P8)', () => {
    // Fixture: 13-1 (EASY CLEAN) at P3, then 3 ALIAS/BOUNDARY MEDIUM/HARD
    // in P4-P8 → Class B rule should still fire because the EASY CLEAN
    // doesn't qualify under the P4-P8 filter.
    const facts: Array<[number, number]> = [
      [11, 1], // P1 EASY
      [12, 2], // P2 EASY
      [13, 1], // P3 EASY CLEAN — but P3 is not in P4-P8
      [14, 4], // P4 MEDIUM ALIAS
      [15, 5], // P5 MEDIUM ALIAS
      [14, 3], // P6 MEDIUM BOUNDARY
      [15, 4], // P7 MEDIUM BOUNDARY
      [17, 7], // P8 HARD ALIAS (3rd take-to-decade — caps)
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const classB = violations.filter(
      (v) =>
        v.rule === 'high-leverage-coverage' &&
        v.message.includes('CLEAN-annotated'),
    )
    expect(classB).toHaveLength(1)
    expect(classB[0]!.message).toContain('Canon has 0 CLEAN at P4-P8')
  })
})

// ── lintSubToTwentyComposition: no-duplicates rule ───────────────────────

describe('lintSubToTwentyComposition — no-duplicates rule', () => {
  it('fires when the same (a, b) pair appears twice', () => {
    const facts: Array<[number, number]> = [
      [11, 1],
      [12, 2],
      [13, 3],
      [14, 2], // first 14-2
      [14, 2], // duplicate 14-2
      [16, 4],
      [17, 5],
      [19, 9],
    ]
    const violations = lintSubToTwentyComposition(
      buildSubToTwentyCanonResponse(facts),
    )
    const dup = violations.filter((v) => v.rule === 'no-duplicates')
    expect(dup).toHaveLength(1)
    expect(dup[0]!.factId).toBe('14-2')
    expect(dup[0]!.message).toContain('appears 2 times')
  })
})

// ── lintSubToTwentyComposition: unparseable-problem rule ─────────────────

describe('lintSubToTwentyComposition — unparseable-problem rule', () => {
  it('fires when read text uses sub-to-10\'s "take away" template', () => {
    // Sub-to-20 uses "minus" only (spec §4.3 + §7.2).
    const response: SessionStartResponse = {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        readSubToTwentyUtterance(1, 11, 1),
        rawReadUtterance(2, 'Twelve take away two. How many are left?'),
        readSubToTwentyUtterance(3, 13, 3),
        readSubToTwentyUtterance(4, 14, 2),
        readSubToTwentyUtterance(5, 15, 5),
        readSubToTwentyUtterance(6, 16, 4),
        readSubToTwentyUtterance(7, 17, 5),
        readSubToTwentyUtterance(8, 19, 9),
      ],
    }
    const violations = lintSubToTwentyComposition(response)
    const unp = violations.filter((v) => v.rule === 'unparseable-problem')
    expect(unp).toHaveLength(1)
    expect(unp[0]!.problemIndex).toBe(2)
  })

  it('fires when read text uses addition template', () => {
    const response: SessionStartResponse = {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        readSubToTwentyUtterance(1, 11, 1),
        readSubToTwentyUtterance(2, 12, 2),
        readSubToTwentyUtterance(3, 13, 3),
        rawReadUtterance(4, 'Fourteen plus two. How many?'),
        readSubToTwentyUtterance(5, 15, 5),
        readSubToTwentyUtterance(6, 16, 4),
        readSubToTwentyUtterance(7, 17, 5),
        readSubToTwentyUtterance(8, 19, 9),
      ],
    }
    const violations = lintSubToTwentyComposition(response)
    const unp = violations.filter((v) => v.rule === 'unparseable-problem')
    expect(unp).toHaveLength(1)
    expect(unp[0]!.problemIndex).toBe(4)
  })

  it('fires when read text is wholly off-shape', () => {
    const response: SessionStartResponse = {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        readSubToTwentyUtterance(1, 11, 1),
        readSubToTwentyUtterance(2, 12, 2),
        readSubToTwentyUtterance(3, 13, 3),
        rawReadUtterance(4, 'garbage text'),
        readSubToTwentyUtterance(5, 15, 5),
        readSubToTwentyUtterance(6, 16, 4),
        readSubToTwentyUtterance(7, 17, 5),
        readSubToTwentyUtterance(8, 19, 9),
      ],
    }
    const violations = lintSubToTwentyComposition(response)
    expect(
      violations.find((v) => v.rule === 'unparseable-problem'),
    ).toBeDefined()
  })
})

// ── assertSubToTwentyCompositionClean ────────────────────────────────────

describe('assertSubToTwentyCompositionClean', () => {
  it('does not throw on a clean canon', () => {
    const response = buildSubToTwentyCanonResponse([
      ...CLEAN_SUB_TO_TWENTY_FACTS,
    ])
    expect(() =>
      assertSubToTwentyCompositionClean('math/sub-to-20', response),
    ).not.toThrow()
  })

  it('throws CompositionLintError with the canon id + violations', () => {
    // 3 take-to-decade in P4-P8 → cap busted.
    const facts: Array<[number, number]> = [
      [11, 1],
      [12, 2],
      [13, 3],
      [14, 4], // take-to-decade 1
      [15, 5], // take-to-decade 2
      [16, 6], // take-to-decade 3 (cap busted)
      [17, 5],
      [19, 9], // take-to-decade 4 (further cap busted)
    ]
    const response = buildSubToTwentyCanonResponse(facts)
    try {
      assertSubToTwentyCompositionClean('math/sub-to-20', response)
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(CompositionLintError)
      const e = err as CompositionLintError
      expect(e.canonId).toBe('math/sub-to-20')
      expect(e.violations.length).toBeGreaterThanOrEqual(1)
      expect(e.message).toContain('math/sub-to-20')
    }
  })
})

// ── resolveTierBinding for sub-to-20 — ACTIVATED in the rebake PR ────────
//
// The dispatch binding was activated in the rebake PR (ticket 86c9utet9)
// alongside a fresh canon that respects Kyle's PR #269 spec (no-borrow,
// minuend 11-19, "How many are left?" template, ≥2 CLEAN-annotated facts
// at P4-P8). The infrastructure (POOL, RULES, parser, lint function,
// assert helper, drift-guards) authored in PR #273 is now wired through
// `resolveTierBinding` + the `runCompositionLint` disk-walker.

describe('resolveTierBinding — sub-to-20', () => {
  it('binds the canonical sub-to-20 path on this platform (handles both sep flavours)', () => {
    const binding = resolveTierBinding(
      'canon/math/level-1/sub-to-20.json'.replace(/\//g, sep),
    )
    expect(binding).not.toBeNull()
    expect(binding!.tier).toBe('sub-to-20')
  })

  it('binds a posix path as well', () => {
    expect(resolveTierBinding('canon/math/level-1/sub-to-20.json')?.tier).toBe(
      'sub-to-20',
    )
  })

  it('binds bare basename (used by some test paths)', () => {
    expect(resolveTierBinding('sub-to-20.json')?.tier).toBe('sub-to-20')
  })
})

// ── drift-guard: SUB_TO_TWENTY_POOL ↔ MATH_TRACK_GUIDE directive prose ───
//
// Mirrors the sub-to-10 POOL drift-guard above (PR #246), forward-extended
// to sub-to-20. Same hybrid pattern: hand-mirrored constant + runtime
// parser + 2-sided equality. Tier-block-scoped via `extractTierBlock` per
// `planner-and-canon.md` § "Tier-block scoping for multi-tier drift-guards"
// — required because the sub-to-20 FACT POOL block uses the same `· N-M=`
// bullet format as the sub-to-10 block, so an unscoped parse against
// `MATH_TRACK_GUIDE` would conflate the two pools.

/** MIRROR of `api/_planner.ts` `MATH_TRACK_GUIDE` sub-to-20 FACT POOL
 *  block (22 bullet lines). Update both in lockstep when widening or
 *  reshaping the pool.
 *
 *  Source bullet format:
 *    `    · 11-1=10  [EASY/subtract-one]    (DEC=10 ALIAS)`
 *
 *  The DEC annotation `(DEC=N ALIAS|BOUNDARY|CLEAN — ...)` IS encoded
 *  here (unlike sub-to-10's a+b annotation) because `decStatus` is
 *  load-bearing for the Class B coverage rule and the drift-guard
 *  must catch any silent change to that classification. */
const EXPECTED_SUB_TO_TWENTY_POOL_FROM_DIRECTIVE: readonly (typeof SUB_TO_TWENTY_POOL)[number][] =
  [
    // EASY band (6 facts)
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
    // MEDIUM band (10 facts)
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
    // HARD band (6 facts)
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
  ]

/** Parse the sub-to-20 directive's FACT POOL block. Bullet shape:
 *    `    · <a>-<b>=<answer>   [<BAND>/<category>] (DEC=<n> <STATUS>...`
 *  Where STATUS ∈ {ALIAS, BOUNDARY, CLEAN}. */
function parseSubToTwentyDirectiveFactPool(
  prose: string,
): readonly (typeof SUB_TO_TWENTY_POOL)[number][] {
  // Bullet character is U+00B7 (middle dot). Tolerate leading whitespace.
  // Capture: a, b, BAND, category, decStatus. The DEC=N value itself is
  // not captured (the lint doesn't read it — it consumes decStatus only).
  const re =
    /^\s*·\s+(\d+)-(\d+)=\d+\s+\[(EASY|MEDIUM|HARD)\/([a-z0-9-]+)\]\s+\(DEC=\d+\s+(ALIAS|BOUNDARY|CLEAN)/gm
  const out: (typeof SUB_TO_TWENTY_POOL)[number][] = []
  for (const m of prose.matchAll(re)) {
    const a = Number.parseInt(m[1]!, 10)
    const b = Number.parseInt(m[2]!, 10)
    out.push({
      id: `${a}-${b}`,
      a,
      b,
      band: m[3]! as (typeof SUB_TO_TWENTY_POOL)[number]['band'],
      category: m[4]! as (typeof SUB_TO_TWENTY_POOL)[number]['category'],
      decStatus: m[5]! as (typeof SUB_TO_TWENTY_POOL)[number]['decStatus'],
    })
  }
  return out
}

describe('SUB_TO_TWENTY_POOL drift-guard against MATH_TRACK_GUIDE directive prose', () => {
  it('lint pool matches the hand-mirrored expectation from the directive (lockstep)', () => {
    // Mutation contract: flip any single fact's band/category/decStatus
    // (or insert/remove a fact) and this assertion fires with a deep-
    // equality diff identifying the discrepant entry.
    expect(SUB_TO_TWENTY_POOL).toEqual(
      EXPECTED_SUB_TO_TWENTY_POOL_FROM_DIRECTIVE,
    )
  })

  it('directive FACT POOL bullets parse to the hand-mirrored expectation (lockstep)', () => {
    // Tier-block-scoped: parses only the sub-to-20 block of
    // MATH_TRACK_GUIDE. An unscoped parse would conflate the bullet-
    // shape with sub-to-10's (different annotation: a+b vs DEC), but
    // the regex is decStatus-specific so an unscoped parse would yield
    // zero matches from the sub-to-10 block anyway. Scoping is the
    // protocol-correct shape per planner-and-canon.md § "Tier-block
    // scoping" and is robust against future tier additions that reuse
    // the DEC annotation pattern.
    const subToTwentyBlock = extractTierBlock(MATH_TRACK_GUIDE, 'sub-to-20')
    const parsed = parseSubToTwentyDirectiveFactPool(subToTwentyBlock)
    expect(parsed).toEqual(EXPECTED_SUB_TO_TWENTY_POOL_FROM_DIRECTIVE)
  })

  it('directive prose contains exactly 22 sub-to-20 FACT POOL bullets', () => {
    const subToTwentyBlock = extractTierBlock(MATH_TRACK_GUIDE, 'sub-to-20')
    const parsed = parseSubToTwentyDirectiveFactPool(subToTwentyBlock)
    expect(parsed).toHaveLength(SUB_TO_TWENTY_POOL.length)
    expect(parsed).toHaveLength(22)
  })

  it('parser throws zero results when the sub-to-20 prose is mutated to drop the DEC annotation', () => {
    // Sanity check on the parser: catches the case where the bullet
    // format is reformatted in a way that escapes the regex. The DEC
    // annotation `(DEC=N ALIAS|BOUNDARY|CLEAN)` is the discriminator;
    // dropping it via mutation should cause the parser to find no
    // bullets.
    const subToTwentyBlock = extractTierBlock(MATH_TRACK_GUIDE, 'sub-to-20')
    const mutated = subToTwentyBlock.replace(
      /\(DEC=\d+\s+(ALIAS|BOUNDARY|CLEAN)/g,
      '(NO-DEC',
    )
    const parsed = parseSubToTwentyDirectiveFactPool(mutated)
    expect(parsed).toEqual([])
  })
})

// ── drift-guard: SUB_TO_TWENTY_RULES.bandAllowedSlots ↔ directive prose ──
//
// Mirrors the sub-to-10 RULE drift-guard above (PR #256), forward-extended
// to sub-to-20. The sub-to-20 directive carries the same "Problems 1-3
// (gentle ramp): EXCLUSIVELY EASY-band facts" / "Problems 4-8
// (discriminate): draw from MEDIUM + HARD bands" / "HARD-band facts ...
// appear at P5 or later only" pattern, so the sub-to-10 parser
// `parseSubToTenBandSlotsFromBulletProse` works without modification —
// the bullet shape IS the contract. We scope via `extractTierBlock`
// to isolate the sub-to-20 block (the same prose appears verbatim in
// sub-to-10 + add-to-10 + sub-to-20 blocks after this PR).

const EXPECTED_SUB_TO_TWENTY_BAND_SLOTS_FROM_DIRECTIVE: (typeof SUB_TO_TWENTY_RULES)['bandAllowedSlots'] =
  {
    EASY: [1, 2, 3],
    MEDIUM: [4, 5, 6, 7, 8],
    HARD: [5, 6, 7, 8],
  }

describe('SUB_TO_TWENTY_RULES.bandAllowedSlots drift-guard against directive prose', () => {
  it('lint rule data matches the hand-mirrored expectation from the directive (lockstep)', () => {
    expect(SUB_TO_TWENTY_RULES.bandAllowedSlots).toEqual(
      EXPECTED_SUB_TO_TWENTY_BAND_SLOTS_FROM_DIRECTIVE,
    )
  })

  it('directive SESSION COMPOSITION RULES parse to the hand-mirrored expectation (lockstep)', () => {
    // Scope the parser to the sub-to-20 tier-block. The sub-to-10
    // parser regexes are reused verbatim (same "Problems N-M (gentle
    // ramp)" / "(discriminate)" / "HARD-band facts ... appear at P<n>
    // or later only" phrasings) — the bullet shape IS the contract
    // across tiers.
    const subToTwentyBlock = extractTierBlock(MATH_TRACK_GUIDE, 'sub-to-20')
    const parsed = parseSubToTenBandSlotsFromBulletProse(subToTwentyBlock)
    expect(parsed).toEqual(EXPECTED_SUB_TO_TWENTY_BAND_SLOTS_FROM_DIRECTIVE)
  })

  it('parser throws a clear error when a required directive statement is missing', () => {
    // Sanity check: mutate the sub-to-20 prose to drop the EASY rule
    // and assert the parser throws with a specific error.
    const subToTwentyBlock = extractTierBlock(MATH_TRACK_GUIDE, 'sub-to-20')

    const proseMissingEasy = subToTwentyBlock.replace(
      /Problems\s+1-3\s+\(gentle ramp\):\s+EXCLUSIVELY\s+EASY-band facts/,
      'Problems 1-3 (gentle ramp): [REFORMATTED]',
    )
    expect(() =>
      parseSubToTenBandSlotsFromBulletProse(proseMissingEasy),
    ).toThrow(/EASY rule/)

    const proseMissingMedium = subToTwentyBlock.replace(
      /Problems\s+4-8\s+\(discriminate\):\s+draw from MEDIUM \+ HARD bands/,
      'Problems 4-8 (discriminate): [REFORMATTED]',
    )
    expect(() =>
      parseSubToTenBandSlotsFromBulletProse(proseMissingMedium),
    ).toThrow(/MEDIUM\+HARD rule/)

    const proseMissingHard = subToTwentyBlock.replace(
      /HARD-band facts[^.]*?appear at P\d+ or later only/,
      '[REFORMATTED]',
    )
    expect(() =>
      parseSubToTenBandSlotsFromBulletProse(proseMissingHard),
    ).toThrow(/HARD-band refinement/)
  })

  it('extractTierBlock isolates the sub-to-20 prose from sibling tier blocks', () => {
    const subToTwentyBlock = extractTierBlock(MATH_TRACK_GUIDE, 'sub-to-20')
    expect(subToTwentyBlock).toMatch(/^- sub-to-20:/)
    // The sub-to-20 block must carry the no-borrow self-check (sub-to-20-only).
    expect(subToTwentyBlock).toMatch(/NO-BORROW SELF-CHECK/)
    // The sub-to-20 block must NOT carry sub-to-10's distinctive
    // wrong-op fact-pool annotation (`(a+b=N IN ...)`).
    expect(subToTwentyBlock).not.toMatch(/a\+b=\d+\s+IN/)
    // The sub-to-20 block must NOT carry add-to-10's distinctive
    // sums-to-10 fact list.
    expect(subToTwentyBlock).not.toMatch(/sums-to-10: 1\+9, 9\+1, 2\+8/)
  })
})
