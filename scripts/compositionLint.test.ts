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
 *   5. take-from-10-coverage — no take-from-10 anywhere
 *   6. no-duplicates — same fact twice
 *   7. unparseable-problem — read template malformed
 *   8. disk walker — write fixtures to a tmp dir, walk it, verify
 *      out-of-scope tier files are correctly skipped
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  ADD_TO_TEN_POOL,
  ADD_TO_TEN_RULES,
  CompositionLintError,
  SUB_TO_TEN_POOL,
  SUB_TO_TEN_RULES,
  assertAddToTenCompositionClean,
  assertSubToTenCompositionClean,
  formatCompositionLintReport,
  lintAddToTenComposition,
  lintSubToTenComposition,
  parseAddToTenReadLine,
  parseSubToTenReadLine,
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

describe('lintSubToTenComposition — take-from-10-coverage rule', () => {
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
      violations.find((v) => v.rule === 'take-from-10-coverage'),
    ).toBeDefined()
  })

  it('does NOT fire when ≥ 1 take-from-10 appears at P4-P8', () => {
    // CLEAN has take-from-10 at P5 and P8.
    const facts: Array<[number, number]> = [...CLEAN_FACTS_PR_244]
    expect(
      lintSubToTenComposition(buildCanonResponse(facts)).filter(
        (v) => v.rule === 'take-from-10-coverage',
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
      violations.filter((v) => v.rule === 'take-from-10-coverage'),
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
      violations.find((v) => v.rule === 'take-from-10-coverage'),
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
    // add-to-10 was previously out-of-scope (PR #245); now bound by this
    // PR. Out-of-scope examples are now confined to other math tiers
    // (add-to-20, sub-to-20, mult-*, etc.) and the word-song tiers.
    expect(resolveTierBinding('canon/math/level-1/add-to-20.json')).toBeNull()
    expect(resolveTierBinding('canon/math/level-1/sub-to-20.json')).toBeNull()
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

  it('lints in-scope math tiers (sub-to-10 + add-to-10) and SKIPS out-of-scope tiers', () => {
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
    expect(r.filesScanned).toBe(4)
    expect(r.filesLinted).toBe(2)
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
    const parsed = parseDirectiveFactPool(MATH_TRACK_GUIDE)
    expect(parsed).toEqual(EXPECTED_POOL_FROM_DIRECTIVE)
  })

  it('directive prose contains exactly 22 FACT POOL bullets (matches pool size)', () => {
    // Sanity check on the parser: catches the case where the bullet
    // format is reformatted in a way that escapes the regex (parsed
    // would be []) or where someone adds extra bullets the mirror
    // doesn't cover. Post-PR #252 spec ratification: 22 facts.
    const parsed = parseDirectiveFactPool(MATH_TRACK_GUIDE)
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
 * Parse the SESSION COMPOSITION RULES band-slot statements from the
 * directive prose. Returns the derived `bandAllowedSlots` map. Throws
 * if any of the three expected statements is missing or malformed —
 * a structural directive reformat must be matched by an update to
 * this parser (in lockstep with the mirror above).
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
 */
function parseDirectiveBandSlots(prose: string): SubToTenBandSlots {
  const r1 =
    /Problems\s+(\d+)-(\d+)\s+\(gentle ramp\):\s+EXCLUSIVELY\s+EASY-band facts/.exec(
      prose,
    )
  if (!r1) {
    throw new Error(
      "parseDirectiveBandSlots: could not locate EASY rule — expected 'Problems N-M (gentle ramp): EXCLUSIVELY EASY-band facts' in directive prose",
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
      "parseDirectiveBandSlots: could not locate MEDIUM+HARD rule — expected 'Problems N-M (discriminate): draw from MEDIUM + HARD bands' in directive prose",
    )
  }
  const discriminateStart = Number.parseInt(r3a[1]!, 10)
  const discriminateEnd = Number.parseInt(r3a[2]!, 10)

  const r3b = /HARD-band facts[^.]*?appear at P(\d+) or later only/.exec(prose)
  if (!r3b) {
    throw new Error(
      "parseDirectiveBandSlots: could not locate HARD-band refinement — expected 'HARD-band facts ... appear at P<N> or later only' in directive prose",
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
    const parsed = parseDirectiveBandSlots(MATH_TRACK_GUIDE)
    expect(parsed).toEqual(EXPECTED_BAND_SLOTS_FROM_DIRECTIVE)
  })

  it('parser throws a clear error when a required directive statement is missing', () => {
    // Sanity check on the parser: catches the case where someone
    // restructures the SESSION COMPOSITION RULES prose in a way that
    // escapes the regex (parsed bands would be undefined and the deep-
    // equality assertion above would fail with a less legible diff).
    // The throw points the maintainer at which statement disappeared.
    const proseMissingEasy = MATH_TRACK_GUIDE.replace(
      /Problems\s+1-3\s+\(gentle ramp\):\s+EXCLUSIVELY\s+EASY-band facts/,
      'Problems 1-3 (gentle ramp): [REFORMATTED]',
    )
    expect(() => parseDirectiveBandSlots(proseMissingEasy)).toThrow(/EASY rule/)

    const proseMissingMedium = MATH_TRACK_GUIDE.replace(
      /Problems\s+4-8\s+\(discriminate\):\s+draw from MEDIUM \+ HARD bands/,
      'Problems 4-8 (discriminate): [REFORMATTED]',
    )
    expect(() => parseDirectiveBandSlots(proseMissingMedium)).toThrow(
      /MEDIUM\+HARD rule/,
    )

    const proseMissingHard = MATH_TRACK_GUIDE.replace(
      /HARD-band facts[^.]*?appear at P\d+ or later only/,
      '[REFORMATTED]',
    )
    expect(() => parseDirectiveBandSlots(proseMissingHard)).toThrow(
      /HARD-band refinement/,
    )
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
      violations.find((v) => v.rule === 'take-from-10-coverage'),
    ).toBeDefined()
  })

  it('does NOT fire when ≥ 1 sums-to-10 appears at P4-P8', () => {
    // CLEAN has 5+5 at P8.
    const facts: Array<[number, number]> = [...CLEAN_ADD_FACTS]
    expect(
      lintAddToTenComposition(buildAddCanonResponse(facts)).filter(
        (v) => v.rule === 'take-from-10-coverage',
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
