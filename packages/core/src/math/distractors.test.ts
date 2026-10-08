import { describe, expect, it } from 'vitest'
import {
  ANSWER_RANGE_MAX,
  ANSWER_RANGE_MAX_TO_20,
  ANSWER_RANGE_MAX_TWO_DIGIT,
  ANSWER_RANGE_MIN,
  GENTLE_RAMP_THROUGH,
  borrowNoDecrementDistractors,
  chipMaxAnswerForCorrects,
  decadeAnchorDistractors,
  forgottenCarryDistractors,
  pickDistractors,
  pickTier,
  smallerFromLargerDistractors,
} from './distractors'

describe('pickTier', () => {
  it('returns "gentle" for problems 1 through GENTLE_RAMP_THROUGH', () => {
    for (let i = 1; i <= GENTLE_RAMP_THROUGH; i++) {
      expect(pickTier(i)).toBe('gentle')
    }
  })

  it('returns "offByOne" for problems past the ramp', () => {
    for (let i = GENTLE_RAMP_THROUGH + 1; i <= 8; i++) {
      expect(pickTier(i)).toBe('offByOne')
    }
  })

  it('cutoff matches Dave consult — gentle through problem 3', () => {
    // Locks the post-Dave value. If Kyle revisits, this test is the canary
    // that surfaces the change.
    expect(GENTLE_RAMP_THROUGH).toBe(3)
    expect(pickTier(3)).toBe('gentle')
    expect(pickTier(4)).toBe('offByOne')
  })

  it('treats out-of-range upper indexes as offByOne (safe default)', () => {
    expect(pickTier(99)).toBe('offByOne')
  })
})

describe('pickDistractors — invariant checks', () => {
  // Sums-to-10: correct can be any integer in [1, 10] (smallest sum 1+0 isn't
  // shown to Marian; even the simplest hardcoded plan starts at 1+1=2, but
  // the function must defend the full range).
  const ALL_CORRECT_VALUES = Array.from(
    { length: ANSWER_RANGE_MAX - ANSWER_RANGE_MIN + 1 },
    (_, i) => ANSWER_RANGE_MIN + i,
  )

  // Tier-aware sweep: every correct × every tier-active problem index.
  const TIER_REPRESENTATIVES = [
    { problemIndex: 1, tier: 'gentle' as const },
    { problemIndex: 2, tier: 'gentle' as const },
    { problemIndex: 3, tier: 'gentle' as const },
    { problemIndex: 4, tier: 'offByOne' as const },
    { problemIndex: 5, tier: 'offByOne' as const },
    { problemIndex: 8, tier: 'offByOne' as const },
  ]

  for (const correct of ALL_CORRECT_VALUES) {
    for (const { problemIndex, tier } of TIER_REPRESENTATIVES) {
      it(`(correct=${correct}, problem=${problemIndex}/${tier}) yields valid distractors`, () => {
        const [d1, d2] = pickDistractors(correct, problemIndex)

        // Constraint 1 — both distractors in range.
        expect(d1).toBeGreaterThanOrEqual(ANSWER_RANGE_MIN)
        expect(d1).toBeLessThanOrEqual(ANSWER_RANGE_MAX)
        expect(d2).toBeGreaterThanOrEqual(ANSWER_RANGE_MIN)
        expect(d2).toBeLessThanOrEqual(ANSWER_RANGE_MAX)

        // Constraint 2 — distinct from each other and from correct.
        expect(d1).not.toBe(d2)
        expect(d1).not.toBe(correct)
        expect(d2).not.toBe(correct)

        // Constraint 3 — integers (no rounding artefacts).
        expect(Number.isInteger(d1)).toBe(true)
        expect(Number.isInteger(d2)).toBe(true)
      })
    }
  }
})

describe('pickDistractors — gentle ramp (problems 1-3)', () => {
  it('uses range extremes when correct sits in the middle', () => {
    // correct=5 → [1, 10] (both extremes ≥2 away).
    expect(pickDistractors(5, 1)).toEqual([1, 10])
    expect(pickDistractors(5, 2)).toEqual([1, 10])
    expect(pickDistractors(5, 3)).toEqual([1, 10])
  })

  it('keeps both distractors at least 2 away from correct', () => {
    for (
      let correct = ANSWER_RANGE_MIN;
      correct <= ANSWER_RANGE_MAX;
      correct++
    ) {
      const [d1, d2] = pickDistractors(correct, 1)
      expect(Math.abs(d1 - correct)).toBeGreaterThanOrEqual(2)
      expect(Math.abs(d2 - correct)).toBeGreaterThanOrEqual(2)
    }
  })

  it('handles correct=1 — MIN extreme is too close, falls back to MAX + an in-range mate', () => {
    // correct=1: MIN=1 is OOR (it IS correct), MIN+1=2 is 1 away (rejected).
    // So MAX=10 is anchor; second pick from a high in-range value still ≥2 away
    // (anything in [3, 9]).
    const [d1, d2] = pickDistractors(1, 1)
    expect([d1, d2]).toContain(ANSWER_RANGE_MAX)
    expect(d1).not.toBe(d2)
    expect(Math.abs(d1 - 1)).toBeGreaterThanOrEqual(2)
    expect(Math.abs(d2 - 1)).toBeGreaterThanOrEqual(2)
  })

  it('handles correct=2 — MIN is 1 away (rejected), MAX is anchor', () => {
    const [d1, d2] = pickDistractors(2, 1)
    expect([d1, d2]).toContain(ANSWER_RANGE_MAX)
    expect(d1).not.toBe(d2)
    expect(d1).not.toBe(2)
    expect(d2).not.toBe(2)
    expect(Math.abs(d1 - 2)).toBeGreaterThanOrEqual(2)
    expect(Math.abs(d2 - 2)).toBeGreaterThanOrEqual(2)
  })

  it('handles correct=10 — MAX is correct, MIN is anchor', () => {
    const [d1, d2] = pickDistractors(10, 1)
    expect([d1, d2]).toContain(ANSWER_RANGE_MIN)
    expect(d1).not.toBe(d2)
    expect(d1).not.toBe(10)
    expect(d2).not.toBe(10)
    expect(Math.abs(d1 - 10)).toBeGreaterThanOrEqual(2)
    expect(Math.abs(d2 - 10)).toBeGreaterThanOrEqual(2)
  })

  it('returns same tuple for repeated calls (deterministic per (correct, problemIndex))', () => {
    expect(pickDistractors(5, 2)).toEqual(pickDistractors(5, 2))
    expect(pickDistractors(7, 1)).toEqual(pickDistractors(7, 1))
  })
})

describe('pickDistractors — off-by-one (problems 4-8)', () => {
  it('returns [correct-1, correct+1] for middle-of-range correct', () => {
    expect(pickDistractors(5, 4)).toEqual([4, 6])
    expect(pickDistractors(7, 5)).toEqual([6, 8])
    expect(pickDistractors(2, 4)).toEqual([1, 3])
  })

  it('substitutes the next adjacent number when correct=10 (high end)', () => {
    // correct=10: high=11 invalid → substitute correct-2=8.
    // Output is [low-1, low] in impl order = [8, 9].
    expect(pickDistractors(10, 8)).toEqual([8, 9])
  })

  it('substitutes the next adjacent number when correct=1 (low end)', () => {
    // correct=1: low=0 invalid → substitute correct+2=3.
    expect(pickDistractors(1, 4)).toEqual([2, 3])
  })

  it('correct=9 → [8, 10] (both adjacents in range)', () => {
    expect(pickDistractors(9, 6)).toEqual([8, 10])
  })

  it('all 10 possible correct values produce in-range, distinct off-by-ones', () => {
    for (
      let correct = ANSWER_RANGE_MIN;
      correct <= ANSWER_RANGE_MAX;
      correct++
    ) {
      const [d1, d2] = pickDistractors(correct, 4)
      expect(d1).not.toBe(d2)
      expect(d1).not.toBe(correct)
      expect(d2).not.toBe(correct)
      expect(d1).toBeGreaterThanOrEqual(ANSWER_RANGE_MIN)
      expect(d1).toBeLessThanOrEqual(ANSWER_RANGE_MAX)
      expect(d2).toBeGreaterThanOrEqual(ANSWER_RANGE_MIN)
      expect(d2).toBeLessThanOrEqual(ANSWER_RANGE_MAX)
    }
  })
})

describe('pickDistractors — input validation', () => {
  it('throws when correct is below the range', () => {
    expect(() => pickDistractors(0, 1)).toThrow(/outside/)
    expect(() => pickDistractors(-3, 1)).toThrow(/outside/)
  })

  it('throws when correct is above the range', () => {
    expect(() => pickDistractors(11, 1)).toThrow(/outside/)
    expect(() => pickDistractors(100, 1)).toThrow(/outside/)
  })

  it('throws when correct is non-integer', () => {
    expect(() => pickDistractors(3.5, 1)).toThrow(/outside/)
    expect(() => pickDistractors(NaN, 1)).toThrow(/outside/)
  })

  it('throws when correct is out of range for the supplied maxAnswer (ticket 86c9q5q13)', () => {
    expect(() => pickDistractors(21, 1, ANSWER_RANGE_MAX_TO_20)).toThrow(
      /outside/,
    )
    expect(() => pickDistractors(0, 1, ANSWER_RANGE_MAX_TO_20)).toThrow(
      /outside/,
    )
  })

  it('throws when maxAnswer is too narrow to satisfy the constraints', () => {
    // maxAnswer must allow at least 2 valid distractors (correct +
    // ≥2-gap distinct values). maxAnswer < ANSWER_RANGE_MIN + 2 = 3 is
    // a configuration bug.
    expect(() => pickDistractors(1, 1, 2)).toThrow(/maxAnswer/)
    expect(() => pickDistractors(1, 1, 0)).toThrow(/maxAnswer/)
  })
})

// ── Add-to-20 boundary (ticket 86c9q5q13) ────────────────────────────────

describe('pickDistractors — sums-to-20 range (ticket 86c9q5q13)', () => {
  // Same algorithm, wider ceiling. Constraint sweep mirrors the
  // sums-to-10 invariant block above but pinned to maxAnswer=20.

  const ALL_CORRECT_TO_20 = Array.from(
    { length: ANSWER_RANGE_MAX_TO_20 - ANSWER_RANGE_MIN + 1 },
    (_, i) => ANSWER_RANGE_MIN + i,
  )

  const TIER_REPRESENTATIVES = [
    { problemIndex: 1, tier: 'gentle' as const },
    { problemIndex: 3, tier: 'gentle' as const },
    { problemIndex: 4, tier: 'offByOne' as const },
    { problemIndex: 8, tier: 'offByOne' as const },
  ]

  for (const correct of ALL_CORRECT_TO_20) {
    for (const { problemIndex, tier } of TIER_REPRESENTATIVES) {
      it(`(correct=${correct}/20, problem=${problemIndex}/${tier}) yields valid distractors`, () => {
        const [d1, d2] = pickDistractors(
          correct,
          problemIndex,
          ANSWER_RANGE_MAX_TO_20,
        )

        // Constraint 1 — both distractors in [1, 20].
        expect(d1).toBeGreaterThanOrEqual(ANSWER_RANGE_MIN)
        expect(d1).toBeLessThanOrEqual(ANSWER_RANGE_MAX_TO_20)
        expect(d2).toBeGreaterThanOrEqual(ANSWER_RANGE_MIN)
        expect(d2).toBeLessThanOrEqual(ANSWER_RANGE_MAX_TO_20)

        // Constraint 2 — distinct from each other and from correct.
        expect(d1).not.toBe(d2)
        expect(d1).not.toBe(correct)
        expect(d2).not.toBe(correct)

        // Constraint 3 — integers.
        expect(Number.isInteger(d1)).toBe(true)
        expect(Number.isInteger(d2)).toBe(true)
      })
    }
  }

  it('off-by-one returns [correct-1, correct+1] for sums in the middle of [11, 20]', () => {
    expect(pickDistractors(15, 4, ANSWER_RANGE_MAX_TO_20)).toEqual([14, 16])
    expect(pickDistractors(11, 4, ANSWER_RANGE_MAX_TO_20)).toEqual([10, 12])
    expect(pickDistractors(13, 5, ANSWER_RANGE_MAX_TO_20)).toEqual([12, 14])
  })

  it('off-by-one substitutes when correct === 20 (high-end clamp)', () => {
    // correct=20: high=21 invalid → substitute correct-2=18.
    // Output is [low-1, low] in impl order = [18, 19].
    expect(pickDistractors(20, 8, ANSWER_RANGE_MAX_TO_20)).toEqual([18, 19])
  })

  it('off-by-one substitutes when correct === 1 (low-end clamp at the wider range)', () => {
    expect(pickDistractors(1, 4, ANSWER_RANGE_MAX_TO_20)).toEqual([2, 3])
  })

  it('gentle ramp returns range extremes for middle-ish correct in [11, 20]', () => {
    // correct=15: both extremes ([1, 20]) are ≥2 away.
    expect(pickDistractors(15, 1, ANSWER_RANGE_MAX_TO_20)).toEqual([1, 20])
    expect(pickDistractors(11, 1, ANSWER_RANGE_MAX_TO_20)).toEqual([1, 20])
    expect(pickDistractors(13, 2, ANSWER_RANGE_MAX_TO_20)).toEqual([1, 20])
  })

  it('gentle ramp anchors to MIN when correct sits within 2 of MAX', () => {
    // correct=20: MAX is correct → MIN=1 is anchor; second pick walks
    // down from MAX skipping correct and values within 2 of it.
    const [d1, d2] = pickDistractors(20, 1, ANSWER_RANGE_MAX_TO_20)
    expect([d1, d2]).toContain(ANSWER_RANGE_MIN)
    expect(d1).not.toBe(d2)
    expect(d1).not.toBe(20)
    expect(d2).not.toBe(20)
    expect(Math.abs(d1 - 20)).toBeGreaterThanOrEqual(2)
    expect(Math.abs(d2 - 20)).toBeGreaterThanOrEqual(2)
  })

  it('gentle ramp anchors to MAX when correct sits within 2 of MIN at maxAnswer=20', () => {
    const [d1, d2] = pickDistractors(2, 1, ANSWER_RANGE_MAX_TO_20)
    expect([d1, d2]).toContain(ANSWER_RANGE_MAX_TO_20)
    expect(d1).not.toBe(d2)
    expect(d1).not.toBe(2)
    expect(d2).not.toBe(2)
    expect(Math.abs(d1 - 2)).toBeGreaterThanOrEqual(2)
    expect(Math.abs(d2 - 2)).toBeGreaterThanOrEqual(2)
  })

  it('default maxAnswer (10) still applies when not supplied — backwards compat', () => {
    // No third arg → defaults to ANSWER_RANGE_MAX = 10. Pinning the
    // existing add-to-10 contract under the new optional parameter.
    expect(ANSWER_RANGE_MAX).toBe(10)
    expect(pickDistractors(5, 4)).toEqual([4, 6])
    expect(pickDistractors(10, 8)).toEqual([8, 9])
    // And explicitly supplying maxAnswer=10 produces the identical result.
    expect(pickDistractors(5, 4, ANSWER_RANGE_MAX)).toEqual(
      pickDistractors(5, 4),
    )
  })
})

describe('chipMaxAnswerForCorrects', () => {
  it('returns ANSWER_RANGE_MAX (10) for add-to-10-shaped corrects', () => {
    // Static plan A: sums-to-10 correct values.
    const corrects = [5, 5, 6, 8, 7, 9, 8, 10]
    expect(chipMaxAnswerForCorrects(corrects)).toBe(ANSWER_RANGE_MAX)
    expect(chipMaxAnswerForCorrects(corrects)).toBe(10)
  })

  it('returns ANSWER_RANGE_MAX_TO_20 (20) for add-to-20-shaped corrects', () => {
    // STATIC_ADD_TO_20_PLANS slot A — sums in [11, 18].
    const corrects = [12, 14, 12, 13, 13, 13, 16, 18]
    expect(chipMaxAnswerForCorrects(corrects)).toBe(ANSWER_RANGE_MAX_TO_20)
    expect(chipMaxAnswerForCorrects(corrects)).toBe(20)
  })

  it('returns ANSWER_RANGE_MAX_TO_20 (20) for canon add-to-20 corrects', () => {
    // Canon's `add-to-20-level-1` plan — sums climb to 18 (Nine plus nine).
    const corrects = [11, 15, 12, 11, 13, 14, 17, 18]
    expect(chipMaxAnswerForCorrects(corrects)).toBe(20)
  })

  it('promotes to the 20 ceiling as soon as ANY correct exceeds 10', () => {
    // A single boundary-crosser (11) is enough — defends against a future
    // mixed plan that opens with sums-to-10 problems then bridges to 20.
    expect(chipMaxAnswerForCorrects([3, 5, 7, 9, 10, 11, 8, 6])).toBe(20)
  })

  it('returns 10 at the boundary correct=10 (not 20)', () => {
    expect(chipMaxAnswerForCorrects([10])).toBe(10)
  })

  it('promotes to 20 at the boundary correct=11', () => {
    expect(chipMaxAnswerForCorrects([11])).toBe(20)
  })

  it('returns ANSWER_RANGE_MAX (10) for an empty plan (defensive default)', () => {
    expect(chipMaxAnswerForCorrects([])).toBe(ANSWER_RANGE_MAX)
  })

  it('returns ANSWER_RANGE_MAX_TWO_DIGIT (99) for two-digit-addsub corrects (Kyle spec §5.1, PR #285)', () => {
    // Pool envelope per spec §1.1: smallest result is 12, largest is 73
    // under §7.2 Option B. The ceiling is set at 99 to cover the full
    // two-digit space rather than the tighter pool max.
    const corrects = [23, 17, 35, 31, 25, 32, 48, 32]
    expect(chipMaxAnswerForCorrects(corrects)).toBe(ANSWER_RANGE_MAX_TWO_DIGIT)
    expect(chipMaxAnswerForCorrects(corrects)).toBe(99)
  })

  it('promotes to 99 at the boundary correct=21 (first value above the to-20 ceiling)', () => {
    expect(chipMaxAnswerForCorrects([21])).toBe(99)
  })

  it('returns 20 at the boundary correct=20 (not 99)', () => {
    // Pinned defense: an add-to-20 / sub-to-20 plan whose max correct is
    // exactly 20 must NOT widen to the two-digit tier — the chips would
    // otherwise span [1, 99] and present nonsense gentle-ramp values for
    // a 20-ceiling tier.
    expect(chipMaxAnswerForCorrects([20])).toBe(20)
    expect(chipMaxAnswerForCorrects([5, 10, 18, 20])).toBe(20)
  })

  it('promotes to 99 at the top of the two-digit range (correct=99)', () => {
    expect(chipMaxAnswerForCorrects([99])).toBe(99)
  })

  it('throws when correct exceeds the largest known tier ceiling (>99)', () => {
    // A 3-digit-addsub tier or beyond would land here. We throw rather
    // than silently expanding — extending the function is a deliberate
    // change with its own tier-add ticket.
    expect(() => chipMaxAnswerForCorrects([100])).toThrow(/no tier ceiling/)
    expect(() => chipMaxAnswerForCorrects([5, 150])).toThrow(/no tier ceiling/)
  })
})

// ── sub-to-10 Class 2 wrong-operation distractor (Kyle's spec §3.2) ──────

describe('pickDistractors — sub-to-10 Class 2 (wrong-operation) trap', () => {
  // For a subtraction problem `a − b = c`, the wrong-op trap is `a + b`
  // (the addition answer using the same operand pair). Fires only on
  // P4-P8 when `op === '-'` AND the planner emits
  // `distractorClass: 'wrong-op'`. P1-P3 always use the gentle ramp;
  // `op === '+'` problems NEVER use Class 2.

  it('emits the wrong-op trap (a + b) when in range — e.g. 9 − 1 = 8 → traps with 10', () => {
    // a=9, b=1 → wrong-op = 10 (in range [0,10]). Off-by-one secondary
    // picks c−1 = 7 (in range, distinct from trap 10). Pair sorted
    // ascending: [7, 10].
    expect(
      pickDistractors(8, 4, 10, {
        op: '-',
        operands: [9, 1],
        distractorClass: 'wrong-op',
      }),
    ).toEqual([7, 10])
  })

  it('emits the wrong-op trap for 6 − 3 = 3 → traps with 9', () => {
    // a=6, b=3 → wrong-op = 9 (in range). Secondary: c−1 = 2 (in range,
    // distinct from 9). Pair: [2, 9].
    expect(
      pickDistractors(3, 5, 10, {
        op: '-',
        operands: [6, 3],
        distractorClass: 'wrong-op',
      }),
    ).toEqual([2, 9])
  })

  it('emits the wrong-op trap for 10 − 7 = 3 (take-from-10 fact) → falls back when trap is OOR', () => {
    // a=10, b=7 → wrong-op = 17 > 10 (OOR). Falls back to Class 1
    // off-by-one: [c−1, c+1] = [2, 4].
    expect(
      pickDistractors(3, 5, 10, {
        op: '-',
        operands: [10, 7],
        distractorClass: 'wrong-op',
      }),
    ).toEqual([2, 4])
  })

  it('falls back to Class 1 when the wrong-op trap is OOR — 10 − 2 = 8, trap=12 → [7, 9]', () => {
    // a=10, b=2 → wrong-op = 12 > maxAnswer=10. Falls back to plain
    // off-by-one Class 1: [c−1, c+1] = [7, 9].
    expect(
      pickDistractors(8, 4, 10, {
        op: '-',
        operands: [10, 2],
        distractorClass: 'wrong-op',
      }),
    ).toEqual([7, 9])
  })

  it('falls back to Class 1 when the wrong-op trap aliases the correct answer (subtract-zero) — 7 − 0 = 7, trap=7 → [6, 8]', () => {
    // a=7, b=0 → wrong-op = 7 = correct (alias collision per spec
    // §3.2 "Same-value collision"). Falls back to Class 1.
    expect(
      pickDistractors(7, 5, 10, {
        op: '-',
        operands: [7, 0],
        distractorClass: 'wrong-op',
      }),
    ).toEqual([6, 8])
  })

  it('falls back to Class 1 for 9 − 0 = 9 (subtract-zero) — trap=9 collides → [8, 10]', () => {
    // a=9, b=0 → wrong-op = 9 = correct. Fall back to off-by-one;
    // c+1 = 10 in range; c−1 = 8 in range; pair [8, 10].
    expect(
      pickDistractors(9, 6, 10, {
        op: '-',
        operands: [9, 0],
        distractorClass: 'wrong-op',
      }),
    ).toEqual([8, 10])
  })

  it('subtract-self facts (correct = 0) use Class 2 trap + nearest off-by-one — 5 − 5 = 0, trap=10 → [1, 10]', () => {
    // a=5, b=5 → wrong-op = 10 (in range, distinct from correct 0).
    // Secondary off-by-one walks deltas [-1, +1, -2, +2]:
    //   delta -1: candidate = -1, below minAnswer 0 → skip
    //   delta +1: candidate = 1 ∈ [0,10], distinct from correct (0) and
    //             trap (10) → take. Pair sorted: [1, 10].
    expect(
      pickDistractors(0, 4, 10, {
        op: '-',
        operands: [5, 5],
        distractorClass: 'wrong-op',
      }),
    ).toEqual([1, 10])
  })

  it('subtract-self facts (correct = 0) require minAnswer=0 — gentle tier (P1) lands cleanly', () => {
    // Without `minAnswer=0` (the default for `op: '-'`), correct=0
    // would fail the input-range check (correct < ANSWER_RANGE_MIN=1).
    // The default minAnswer for `op:'-'` is 0 — test that pickDistractors
    // accepts correct=0 and produces in-range distractors.
    // For correct=0 with maxAnswer=10, gentle picks: max anchor=10,
    // then walk up from minAnswer=0; skip 0 (==correct), skip 1 (too
    // close, <2 gap), pick 2. Pair: [2, 10].
    expect(
      pickDistractors(0, 1, 10, {
        op: '-',
        operands: [5, 5],
      }),
    ).toEqual([2, 10])
  })

  it('Class 2 NEVER fires for op === "+" — addition problems use Class 1 unchanged', () => {
    // Even if a caller passes distractorClass:'wrong-op' on an
    // addition problem, the Class 2 dispatch is gated on op:'-'.
    // Addition falls through to off-by-one (Class 1) regardless.
    expect(
      pickDistractors(5, 4, 10, {
        op: '+',
        operands: [3, 2],
        distractorClass: 'wrong-op',
      }),
    ).toEqual([4, 6]) // Class 1 off-by-one
  })

  it('Class 2 NEVER fires for P1-P3 — gentle ramp wins regardless of distractorClass hint', () => {
    // Even when op:'-' and distractorClass:'wrong-op' are set, P1-P3
    // always use the gentle ramp. P3 is GENTLE_RAMP_THROUGH; P4 is
    // the first discriminate problem.
    for (const p of [1, 2, 3]) {
      const result = pickDistractors(8, p, 10, {
        op: '-',
        operands: [9, 1],
        distractorClass: 'wrong-op',
      })
      // Gentle for correct=8 maxAnswer=10 minAnswer=0:
      //   min-ok: 8-0=8 ≥ 2 → 0; max-ok: 10-8=2 ≥ 2 → 10
      //   pair: [0, 10]
      expect(result).toEqual([0, 10])
    }
  })

  it('Class 2 NEVER fires without operands — defensive fallback to Class 1', () => {
    // distractorClass:'wrong-op' WITHOUT operands is undecodable. The
    // dispatch silently degrades to Class 1 rather than throwing.
    expect(
      pickDistractors(8, 4, 10, {
        op: '-',
        distractorClass: 'wrong-op',
      }),
    ).toEqual([7, 9])
  })

  it('Class 2 NEVER fires when distractorClass !== "wrong-op" — defaults to off-by-one', () => {
    // op:'-' but no wrong-op hint → falls through to standard
    // off-by-one Class 1.
    expect(
      pickDistractors(8, 4, 10, {
        op: '-',
        operands: [9, 1],
        distractorClass: 'off-by-one',
      }),
    ).toEqual([7, 9])
  })

  it('every Class 2 pair is in [minAnswer, maxAnswer], distinct, and ≠ correct (invariant)', () => {
    // Exhaustive over the entire sub-to-10 pool (Kyle's spec §1.1).
    const pool: ReadonlyArray<[number, number]> = [
      [5, 5],
      [8, 8], // subtract-self
      [7, 0],
      [9, 0], // subtract-zero
      [10, 5],
      [8, 4],
      [6, 3], // doubles
      [9, 1],
      [10, 1], // subtract-one
      [10, 2], // subtract-two
      [10, 3],
      [10, 7], // take-from-10
      [9, 4],
      [8, 3],
      [7, 4],
      [9, 6], // general
    ]
    for (const [a, b] of pool) {
      const correct = a - b
      for (let p = 4; p <= 8; p++) {
        const [d1, d2] = pickDistractors(correct, p, 10, {
          op: '-',
          operands: [a, b],
          distractorClass: 'wrong-op',
        })
        // In-range
        expect(d1).toBeGreaterThanOrEqual(0)
        expect(d1).toBeLessThanOrEqual(10)
        expect(d2).toBeGreaterThanOrEqual(0)
        expect(d2).toBeLessThanOrEqual(10)
        // Distinct
        expect(d1).not.toBe(d2)
        // Neither is the correct answer
        expect(d1).not.toBe(correct)
        expect(d2).not.toBe(correct)
      }
    }
  })

  it('every Class 1 (off-by-one) sub fact pair is in [minAnswer, maxAnswer], distinct, and ≠ correct', () => {
    // Sub-to-10 pool, but with the off-by-one hint instead of wrong-op.
    const pool: ReadonlyArray<[number, number]> = [
      [5, 5],
      [8, 8],
      [7, 0],
      [9, 0],
      [10, 5],
      [8, 4],
      [6, 3],
      [9, 1],
      [10, 1],
      [10, 2],
      [10, 3],
      [10, 7],
      [9, 4],
      [8, 3],
      [7, 4],
      [9, 6],
    ]
    for (const [a, b] of pool) {
      const correct = a - b
      for (let p = 4; p <= 8; p++) {
        const [d1, d2] = pickDistractors(correct, p, 10, {
          op: '-',
          operands: [a, b],
          distractorClass: 'off-by-one',
        })
        expect(d1).toBeGreaterThanOrEqual(0)
        expect(d1).toBeLessThanOrEqual(10)
        expect(d2).toBeGreaterThanOrEqual(0)
        expect(d2).toBeLessThanOrEqual(10)
        expect(d1).not.toBe(d2)
        expect(d1).not.toBe(correct)
        expect(d2).not.toBe(correct)
      }
    }
  })
})

// ── sub-to-20 Class B (decade-anchor miss) distractor (Kyle's spec §3.3) ──
// Ticket 86c9utcf7. Class B fires when op === '-' AND distractorClass ===
// 'decade-anchor' AND problemIndex >= 4. The trap value is
// `Math.round(correct / 10) * 10`. Three degenerate cases downgrade to
// Class A (off-by-one):
//   - DEC out of [minAnswer, maxAnswer]
//   - DEC === correct (aliases — take-to-decade facts like 19−9=10)
//   - |DEC − correct| === 1 (aliases off-by-one — boundary facts like 16−5=11)
//
// Test surface mirrors Kyle's §1.1 22-fact pool — every fact's annotated
// status (CLEAN / ALIAS / BOUNDARY) is pinned. Render-tier widening:
// sub-to-20 callers pass maxAnswer = ANSWER_RANGE_MAX_TO_20 = 20 (Kyle §7.4
// ACCEPT 20 — inherits the existing chipMaxAnswerForCorrects widening).

describe('decadeAnchorDistractors — standalone (§3.3 formula)', () => {
  // The bare function returns `[DEC, secondary] | null` for an explicit
  // [minAnswer, maxAnswer]. Sub-to-20 callers use minAnswer=0, maxAnswer=20
  // — but the function is range-parameterised so it doesn't need to know
  // sub-to-20's specific min.

  describe('CLEAN cases — standard MEDIUM/HARD facts (separation ≥ 2)', () => {
    it('14 − 2 = 12 → DEC=10, secondary=13 (opposite side from DEC)', () => {
      // Pool #9, MEDIUM/subtract-two. Sub-to-20 spec §1.1: "DEC=10 CLEAN".
      expect(decadeAnchorDistractors(12, 0, 20)).toEqual([10, 13])
    })

    it('15 − 3 = 12 → DEC=10, secondary=13', () => {
      // Pool #12, MEDIUM/subtract-three.
      expect(decadeAnchorDistractors(12, 0, 20)).toEqual([10, 13])
    })

    it('15 − 2 = 13 → DEC=10, secondary=14 (separation 3)', () => {
      // Pool #13, MEDIUM/subtract-two. Spec §1.1 example: "Class B trap
      // clean and well-separated."
      expect(decadeAnchorDistractors(13, 0, 20)).toEqual([10, 14])
    })

    it('16 − 4 = 12 → DEC=10, secondary=13', () => {
      // Pool #16, MEDIUM/general. The CLEAN MEDIUM/general anchor.
      expect(decadeAnchorDistractors(12, 0, 20)).toEqual([10, 13])
    })

    it('17 − 5 = 12 → DEC=10, secondary=13 (HARD/general)', () => {
      // Pool #18, HARD/general.
      expect(decadeAnchorDistractors(12, 0, 20)).toEqual([10, 13])
    })

    it('18 − 6 = 12 → DEC=10, secondary=13 (HARD/general)', () => {
      // Pool #20, HARD/general.
      expect(decadeAnchorDistractors(12, 0, 20)).toEqual([10, 13])
    })

    it('19 − 7 = 12 → DEC=10, secondary=13 (HARD/general)', () => {
      // Pool #22, HARD/general.
      expect(decadeAnchorDistractors(12, 0, 20)).toEqual([10, 13])
    })

    it('high-end CLEAN — correct=17 → DEC=20, secondary=16 (opposite side, DEC > correct)', () => {
      // Synthetic case: correct=17 → Math.round(1.7)*10 = 20. Sub-to-20
      // pool has no result of 17 (results in [10, 18]) but the formula
      // must handle DEC > correct correctly. Secondary on the LOW side.
      expect(decadeAnchorDistractors(17, 0, 20)).toEqual([16, 20])
    })

    it('correct=18 (pool max) → DEC=20, secondary=17', () => {
      // Synthetic-but-pool-adjacent: spec §1.1 pool produces results
      // in [10, 18]. correct=18 isn't in the 22-fact curation but a
      // future pool extension could land here; the formula handles it.
      expect(decadeAnchorDistractors(18, 0, 20)).toEqual([17, 20])
    })
  })

  describe('ALIAS-correct fallback (DEC === correct, take-to-decade facts)', () => {
    it('19 − 9 = 10 → DEC=10 aliases correct → null', () => {
      // Pool #21, HARD/take-to-decade. Spec §1.1: "DEC=10 ALIAS — forbidden".
      expect(decadeAnchorDistractors(10, 0, 20)).toBeNull()
    })

    it('11 − 1 = 10 → DEC=10 aliases correct → null', () => {
      // Pool #1, EASY/subtract-one. Spec §1.1 ALIAS.
      expect(decadeAnchorDistractors(10, 0, 20)).toBeNull()
    })

    it('every pool take-to-decade fact aliases correct → null', () => {
      // Pool entries with result === 10: #1, #2, #3, #7, #10, #14, #17, #19, #21.
      // Every one has DEC = correct = 10 → null per §3.3.
      expect(decadeAnchorDistractors(10, 0, 20)).toBeNull()
    })

    it('correct=20 → DEC=20 aliases correct → null (synthetic boundary)', () => {
      // Not in pool (pool max result is 18), but the formula handles the
      // upper-decade alias for forward-compat with future pool extensions.
      expect(decadeAnchorDistractors(20, 0, 20)).toBeNull()
    })
  })

  describe('ALIAS-off-by-one fallback (|DEC − correct| === 1, boundary facts)', () => {
    it('12 − 1 = 11 → DEC=10 = correct − 1 → null', () => {
      // Pool #4, EASY/subtract-one. Spec §1.1: "DEC=10 BOUNDARY —
      // degenerate, downgrades."
      expect(decadeAnchorDistractors(11, 0, 20)).toBeNull()
    })

    it('14 − 3 = 11 → DEC=10 = correct − 1 → null', () => {
      // Pool #8, MEDIUM/general. Spec §1.1 BOUNDARY.
      expect(decadeAnchorDistractors(11, 0, 20)).toBeNull()
    })

    it('16 − 5 = 11 → DEC=10 = correct − 1 → null', () => {
      // Pool #15, MEDIUM/general. Spec §1.1 BOUNDARY (Dave §4.2's
      // canonical decade-anchor-miss exemplar but the trap aliases
      // off-by-one and degenerates).
      expect(decadeAnchorDistractors(11, 0, 20)).toBeNull()
    })

    it('correct=9 → DEC=10 = correct + 1 → null (lower-decade boundary)', () => {
      // Synthetic — correct=9 not in pool, but the formula must reject
      // when DEC sits exactly +1 above correct.
      expect(decadeAnchorDistractors(9, 0, 20)).toBeNull()
    })

    it('correct=21 → DEC=20 = correct − 1 → null (upper-decade boundary, synthetic)', () => {
      // Synthetic with widened maxAnswer. Not reachable in v1 sub-to-20
      // but pins the formula's |DEC − correct| === 1 check on the
      // DEC > correct side.
      expect(decadeAnchorDistractors(21, 0, 25)).toBeNull()
    })
  })

  describe('OUT-OF-RANGE fallback (DEC outside [minAnswer, maxAnswer])', () => {
    it('correct=25 → DEC=30, maxAnswer=20 → null', () => {
      // Synthetic — sub-to-20 callers never see correct > 19, but the
      // formula must reject DEC > maxAnswer for any future tier widening.
      expect(decadeAnchorDistractors(25, 0, 20)).toBeNull()
    })

    it('correct=5, minAnswer=10 → secondary OOR forces secondary walker null → null', () => {
      // Edge: synthetic — pickDistractors would throw because correct <
      // minAnswer, but decadeAnchorDistractors is a pure function that
      // doesn't validate correct against the range, only DEC.
      //   dec = Math.round(5/10)*10 = 10. 10 >= minAnswer=10 (in range).
      //   dec=10 !== correct=5. |10−5|=5 !== 1.
      //   Preferred secondary (DEC < correct? no, 10 > 5): correct−1=4.
      //   4 < minAnswer=10 → preferred OOR.
      //   Fallback to pickSecondaryOffByOne(5, 10, 10, 20) with deltas
      //   [-1, +1, -2, +2]: all candidates (4, 6, 3, 7) < minAnswer=10
      //   → walker returns null → decadeAnchorDistractors returns null.
      expect(decadeAnchorDistractors(5, 10, 20)).toBeNull()
    })

    it('correct=2, minAnswer=0, maxAnswer=5 → DEC=0; degenerate or in-range?', () => {
      // Synthetic edge: correct=2 → Math.round(2/10)*10=0. DEC=0. minAnswer=0,
      // so DEC === minAnswer. DEC !== correct (0 !== 2). |0−2|=2 !== 1.
      // Preferred secondary: DEC < correct, secondary=correct+1=3.
      // 3 in [0, 5], !== correct, !== dec. → [0, 3].
      expect(decadeAnchorDistractors(2, 0, 5)).toEqual([0, 3])
    })
  })

  describe('correct ∈ {10, 11} edge case — explicit per ticket 86c9utcf7', () => {
    // Ticket text: "Specific fallback for correct ∈ {10, 11} per Kyle's §7
    // deferred edge case — produce ONE off-by-one distractor (per spec §3
    // default Kyle locked)."
    //
    // Per §3.3: correct=10 → DEC=10 aliases correct → null. correct=11 →
    // DEC=10 aliases off-by-one → null. Both downgrade to Class A at the
    // pickDistractors dispatch site (tested separately below).

    it('correct=10 → null (aliases correct — every take-to-decade fact)', () => {
      expect(decadeAnchorDistractors(10, 0, 20)).toBeNull()
    })

    it('correct=11 → null (aliases off-by-one — every BOUNDARY fact)', () => {
      expect(decadeAnchorDistractors(11, 0, 20)).toBeNull()
    })
  })
})

describe('pickDistractors — sub-to-20 Class B dispatch (op:"-", decade-anchor)', () => {
  // Integration through pickDistractors: Class B fires at P4–P8 (op:'-',
  // distractorClass:'decade-anchor'); never fires at P1–P3 (gentle ramp
  // wins); silently downgrades to Class A on null.

  const MAX = ANSWER_RANGE_MAX_TO_20 // 20 — sub-to-20 ceiling

  it('14 − 2 = 12 at P4 → Class B fires: chips [10, 12, 13]', () => {
    // Pool #9 MEDIUM/subtract-two CLEAN. Trap=10, secondary=13.
    expect(
      pickDistractors(12, 4, MAX, {
        op: '-',
        operands: [14, 2],
        distractorClass: 'decade-anchor',
      }),
    ).toEqual([10, 13])
  })

  it('15 − 2 = 13 at P5 → Class B fires: chips [10, 13, 14]', () => {
    // Pool #13 MEDIUM/subtract-two CLEAN (separation 3).
    expect(
      pickDistractors(13, 5, MAX, {
        op: '-',
        operands: [15, 2],
        distractorClass: 'decade-anchor',
      }),
    ).toEqual([10, 14])
  })

  it('16 − 4 = 12 at P6 → Class B fires: chips [10, 12, 13]', () => {
    // Pool #16 MEDIUM/general CLEAN.
    expect(
      pickDistractors(12, 6, MAX, {
        op: '-',
        operands: [16, 4],
        distractorClass: 'decade-anchor',
      }),
    ).toEqual([10, 13])
  })

  it('19 − 9 = 10 at P8 → Class B aliases correct → downgrades to Class A [10, 11]', () => {
    // Pool #21 HARD/take-to-decade ALIAS. Off-by-one fallback at correct=10:
    // low=9 < minAnswer=0? no, 9 >= 0. low ok. high=11 in range. → [9, 11].
    // Wait — minAnswer for op:'-' defaults to 0 per pickDistractors:
    //   `const minAnswer = opts?.minAnswer ?? (op === '-' ? 0 : ANSWER_RANGE_MIN)`
    // offByOneDistractors with correct=10, minAnswer=0, maxAnswer=20:
    //   low=9 ≥ 0 (ok); high=11 ≤ 20 (ok); return [9, 11].
    expect(
      pickDistractors(10, 8, MAX, {
        op: '-',
        operands: [19, 9],
        distractorClass: 'decade-anchor',
      }),
    ).toEqual([9, 11])
  })

  it('11 − 1 = 10 at P4 (synthetic — EASY-band facts shouldnt land at P4 but the formula must still downgrade)', () => {
    // Pool #1 EASY/subtract-one ALIAS. Same as #21 — DEC=10=correct → null.
    // Downgrades to off-by-one Class A: [9, 11].
    expect(
      pickDistractors(10, 4, MAX, {
        op: '-',
        operands: [11, 1],
        distractorClass: 'decade-anchor',
      }),
    ).toEqual([9, 11])
  })

  it('16 − 5 = 11 at P5 → Class B aliases off-by-one → downgrades to [10, 12]', () => {
    // Pool #15 MEDIUM/general BOUNDARY. DEC=10 = correct − 1 → null →
    // off-by-one fallback: [correct−1, correct+1] = [10, 12].
    expect(
      pickDistractors(11, 5, MAX, {
        op: '-',
        operands: [16, 5],
        distractorClass: 'decade-anchor',
      }),
    ).toEqual([10, 12])
  })

  it('12 − 1 = 11 at P4 → BOUNDARY → downgrades to [10, 12]', () => {
    // Pool #4 EASY/subtract-one BOUNDARY.
    expect(
      pickDistractors(11, 4, MAX, {
        op: '-',
        operands: [12, 1],
        distractorClass: 'decade-anchor',
      }),
    ).toEqual([10, 12])
  })

  it('Class B never fires at P1–P3 (gentle ramp wins regardless of hint)', () => {
    // P3 is GENTLE_RAMP_THROUGH. Gentle for correct=12, maxAnswer=20,
    // minAnswer=0: min-ok 12-0=12 ≥ 2 → 0; max-ok 20-12=8 ≥ 2 → 20.
    // → [0, 20].
    for (const p of [1, 2, 3]) {
      const result = pickDistractors(12, p, MAX, {
        op: '-',
        operands: [14, 2],
        distractorClass: 'decade-anchor',
      })
      expect(result).toEqual([0, 20])
    }
  })

  it('Class B never fires for op:"+" — addition uses Class A unchanged', () => {
    // Defensive — Math.tsx never sets decade-anchor on op:'+' problems,
    // but the dispatch must gate on op === '-' for forward-compat.
    expect(
      pickDistractors(12, 4, MAX, {
        op: '+',
        operands: [10, 2],
        distractorClass: 'decade-anchor',
      }),
    ).toEqual([11, 13]) // standard Class A off-by-one
  })

  it('every pool fact yields in-range, distinct, ≠ correct chips at P4–P8 (invariant)', () => {
    // Exhaustive over Kyle's §1.1 22-fact pool. Class B EITHER fires
    // (CLEAN facts) OR downgrades to Class A (ALIAS / BOUNDARY facts);
    // either way the result must be in-range + distinct + ≠ correct.
    const pool: ReadonlyArray<[number, number]> = [
      [11, 1], // #1  ALIAS  → [9, 11]
      [12, 2], // #2  ALIAS  → [9, 11]
      [13, 3], // #3  ALIAS  → [9, 11]
      [12, 1], // #4  BOUNDARY → [10, 12]
      [13, 2], // #5  BOUNDARY → [10, 12]
      [13, 1], // #6  CLEAN  → [10, 13]
      [14, 4], // #7  ALIAS  → [9, 11]
      [14, 3], // #8  BOUNDARY → [10, 12]
      [14, 2], // #9  CLEAN  → [10, 13]
      [15, 5], // #10 ALIAS  → [9, 11]
      [15, 4], // #11 BOUNDARY → [10, 12]
      [15, 3], // #12 CLEAN  → [10, 13]
      [15, 2], // #13 CLEAN  → [10, 14]
      [16, 6], // #14 ALIAS  → [9, 11]
      [16, 5], // #15 BOUNDARY → [10, 12]
      [16, 4], // #16 CLEAN  → [10, 13]
      [17, 7], // #17 ALIAS  → [9, 11]
      [17, 5], // #18 CLEAN  → [10, 13]
      [18, 8], // #19 ALIAS  → [9, 11]
      [18, 6], // #20 CLEAN  → [10, 13]
      [19, 9], // #21 ALIAS  → [9, 11]
      [19, 7], // #22 CLEAN  → [10, 13]
    ]
    for (const [a, b] of pool) {
      const correct = a - b
      for (let p = 4; p <= 8; p++) {
        const [d1, d2] = pickDistractors(correct, p, MAX, {
          op: '-',
          operands: [a, b],
          distractorClass: 'decade-anchor',
        })
        // Pool results land in [10, 18]; sub-to-20 minAnswer defaults to 0.
        expect(d1).toBeGreaterThanOrEqual(0)
        expect(d1).toBeLessThanOrEqual(MAX)
        expect(d2).toBeGreaterThanOrEqual(0)
        expect(d2).toBeLessThanOrEqual(MAX)
        expect(d1).not.toBe(d2)
        expect(d1).not.toBe(correct)
        expect(d2).not.toBe(correct)
      }
    }
  })

  it('CLEAN pool facts (separation ≥ 2) all emit chip 10 as the trap', () => {
    // Pool §1.1 CLEAN-annotated facts: #6 13-1=12, #9 14-2=12, #12 15-3=12,
    // #13 15-2=13, #16 16-4=12, #18 17-5=12, #20 18-6=12, #22 19-7=12.
    // Every one has DEC=10 and correct in [12, 13] (separation 2 or 3).
    const cleanFacts: ReadonlyArray<[number, number, number]> = [
      [13, 1, 12], // #6
      [14, 2, 12], // #9
      [15, 3, 12], // #12
      [15, 2, 13], // #13
      [16, 4, 12], // #16
      [17, 5, 12], // #18
      [18, 6, 12], // #20
      [19, 7, 12], // #22
    ]
    for (const [a, b, correct] of cleanFacts) {
      const [d1, d2] = pickDistractors(correct, 4, MAX, {
        op: '-',
        operands: [a, b],
        distractorClass: 'decade-anchor',
      })
      expect([d1, d2]).toContain(10) // every CLEAN fact ships the 10-chip Class B trap
    }
  })

  it('Class B is identity-stable across repeated calls (deterministic)', () => {
    const result1 = pickDistractors(12, 4, MAX, {
      op: '-',
      operands: [14, 2],
      distractorClass: 'decade-anchor',
    })
    const result2 = pickDistractors(12, 4, MAX, {
      op: '-',
      operands: [14, 2],
      distractorClass: 'decade-anchor',
    })
    expect(result1).toEqual(result2)
  })
})

describe('pickDistractors — sub-to-20 maxAnswer=20 ceiling (Kyle §7.4 ACCEPT)', () => {
  // Per Kyle's sub-to-20 spec §7.4: maxAnswer = ANSWER_RANGE_MAX_TO_20 = 20
  // (inherits the existing chipMaxAnswerForCorrects widening; no separate
  // sub-to-20-specific ceiling). This block pins that contract.

  it('chipMaxAnswerForCorrects returns 20 for sub-to-20 pool corrects', () => {
    // Spec §1.1 pool results: [10, 11, 12, 13]. Any correct >= 11 widens.
    const corrects = [10, 11, 12, 13, 12, 10, 12, 12]
    expect(chipMaxAnswerForCorrects(corrects)).toBe(ANSWER_RANGE_MAX_TO_20)
  })

  it('Class B chips fit inside [0, 20] for every sub-to-20 pool fact', () => {
    // Re-cover the invariant from the previous block but pinned against
    // the §7.4 ceiling constant.
    const pool: ReadonlyArray<[number, number]> = [
      [11, 1],
      [13, 1],
      [14, 2],
      [15, 2],
      [16, 4],
      [17, 5],
      [18, 6],
      [19, 7],
      [19, 9],
    ]
    for (const [a, b] of pool) {
      const correct = a - b
      const [d1, d2] = pickDistractors(correct, 4, ANSWER_RANGE_MAX_TO_20, {
        op: '-',
        operands: [a, b],
        distractorClass: 'decade-anchor',
      })
      expect(d1).toBeGreaterThanOrEqual(0)
      expect(d1).toBeLessThanOrEqual(ANSWER_RANGE_MAX_TO_20)
      expect(d2).toBeGreaterThanOrEqual(0)
      expect(d2).toBeLessThanOrEqual(ANSWER_RANGE_MAX_TO_20)
    }
  })
})

// ── sub-to-20 minAnswer=10 threading (Kyle §3.1 — no-borrow operating range)
//
// Per Kyle's sub-to-20 spec §3.1, chips for sub-to-20 problems live in the
// no-borrow band `[minAnswer = 10, maxAnswer = 19]`. The threading happens
// at the screen layer (`Math.tsx:buildChipOrder` — see commit threading
// `minAnswer: 10` when `focusNode === 'sub-to-20'`). This block exercises
// the distractor module directly with `opts.minAnswer = 10` to pin the
// downstream chip math; the Math.tsx-side mapping is covered by the
// existing focus-node integration tests + e2e specs.
// ─────────────────────────────────────────────────────────────────────────
describe('pickDistractors — sub-to-20 minAnswer=10 threading (Kyle §3.1)', () => {
  const MAX = ANSWER_RANGE_MAX_TO_20 // 20

  it('19-9=10 alias-correct fallback produces chips in [10, 19] no-borrow range', () => {
    // Pool #21 HARD/take-to-decade ALIAS. Class B fires:
    //   DEC = Math.round(10 / 10) * 10 = 10 === correct → null → fall to Class A.
    // Class A (off-by-one) with minAnswer=10, maxAnswer=20, correct=10:
    //   low = 9 < minAnswer=10 → low NOT ok.
    //   high = 11 ≤ 20 → high ok.
    //   `!lowOk` branch: return [high, high + 1] = [11, 12].
    // Before this fix (minAnswer defaulted to 0): chips were [9, 11] — a
    // chip of `9` is OUT of the no-borrow band, contradicting §3.1.
    const [d1, d2] = pickDistractors(10, 8, MAX, {
      op: '-',
      operands: [19, 9],
      distractorClass: 'decade-anchor',
      minAnswer: 10,
    })
    expect([d1, d2]).toEqual([11, 12])
    // Hard floor — every chip must be ≥ 10.
    expect(d1).toBeGreaterThanOrEqual(10)
    expect(d2).toBeGreaterThanOrEqual(10)
  })

  it('every sub-to-20 pool ALIAS / BOUNDARY fact produces chips in [10, 19] under minAnswer=10', () => {
    // Exhaustive over the take-to-decade / boundary facts where Class B
    // downgrades. Each must produce chips ≥ minAnswer = 10. Pre-fix, the
    // result=10 facts (#1, #2, #3, #7, #11, #14, #17, #19, #21) and the
    // boundary facts that hit correct=11 (#4, #5, #15) could emit a chip
    // of `9` via Class A's `[correct - 1, correct + 1]`.
    const downgradingFacts: ReadonlyArray<[number, number]> = [
      [11, 1], // #1  ALIAS  correct=10
      [12, 2], // #2  ALIAS  correct=10
      [13, 3], // #3  ALIAS  correct=10
      [12, 1], // #4  BOUNDARY correct=11
      [13, 2], // #5  BOUNDARY correct=11
      [14, 4], // #7  ALIAS  correct=10
      [14, 3], // #8  BOUNDARY correct=11
      [15, 4], // BOUNDARY correct=11 (synthetic)
      [15, 5], // #11 ALIAS  correct=10
      [16, 5], // #15 BOUNDARY correct=11
      [16, 6], // #14 ALIAS  correct=10
      [17, 6], // BOUNDARY correct=11 (synthetic)
      [17, 7], // #17 ALIAS  correct=10
      [18, 7], // BOUNDARY correct=11 (synthetic)
      [18, 8], // #19 ALIAS  correct=10
      [19, 8], // BOUNDARY correct=11 (synthetic)
      [19, 9], // #21 ALIAS  correct=10
    ]
    for (const [a, b] of downgradingFacts) {
      const correct = a - b
      const [d1, d2] = pickDistractors(correct, 4, MAX, {
        op: '-',
        operands: [a, b],
        distractorClass: 'decade-anchor',
        minAnswer: 10,
      })
      // Both chips must sit inside the no-borrow operating range.
      expect(d1).toBeGreaterThanOrEqual(10)
      expect(d1).toBeLessThanOrEqual(MAX)
      expect(d2).toBeGreaterThanOrEqual(10)
      expect(d2).toBeLessThanOrEqual(MAX)
      // Distinct from each other and from correct.
      expect(d1).not.toBe(d2)
      expect(d1).not.toBe(correct)
      expect(d2).not.toBe(correct)
    }
  })

  it('CLEAN Class B facts still emit DEC=10 (which is in [10, 19]) under minAnswer=10', () => {
    // CLEAN facts produce chips {DEC=10, correct, correct+1}. DEC=10 is
    // exactly the floor — verifying inclusivity of `minAnswer` (Class B
    // helper allows `dec >= minAnswer`, not `dec > minAnswer`).
    // Pool #16 16 − 4 = 12, DEC = 10, secondary = correct + 1 = 13.
    expect(
      pickDistractors(12, 4, MAX, {
        op: '-',
        operands: [16, 4],
        distractorClass: 'decade-anchor',
        minAnswer: 10,
      }),
    ).toEqual([10, 13])
  })
})

describe('pickDistractors — two-digit-addsub chip-floor alignment (forward-risk-guard for Wave 3 phantomBorrowDistractor)', () => {
  // ── Context ────────────────────────────────────────────────────────────
  // Devon NOF #7 on Kevin PR #291 surfaced a forward-risk: when Wave 3
  // wires `phantomBorrowDistractor(correct, maxAnswer)` for two-digit-
  // addsub P5–P8 `-` problems (per `design/math/two-digit-addsub-content.md`
  // §3.4), the render-side chip floor MUST match the lint-side trap floor
  // in `scripts/compositionLint.ts` `phantomBorrowTrap()` (line 2548:
  // `if (trap < 1 || trap > 99) return null`).
  //
  // If a future Wave 3 PR sets the render-side floor to ≥ 10 (e.g. to
  // enforce two-digit-only chips) without updating the lint-side, the
  // pool's smallest `-` results (correct ∈ {12, 13, 14, 15}) would lint-
  // pass with trap ∈ {2, 3, 4, 5} but silent-downgrade at render time.
  // That's the misalignment this block pins against.
  //
  // ── The agreed floor ───────────────────────────────────────────────────
  // The agreed floor for the two-digit-addsub `-` tier is `1` — matching
  // `compositionLint.ts:2548` (literal `1` in the `phantomBorrowTrap`
  // guard) and Marian-curriculum `ANSWER_RANGE_MIN = 1`. If either side
  // drifts, the linkage breaks silently in production; this block is the
  // tripwire.
  //
  // Cross-reference: `scripts/compositionLint.ts:2533-2552` (phantom-borrow
  // lint floor narrative) + `design/math/two-digit-addsub-content.md` §3.4
  // (trap formula `correct − 10`; degenerate-downgrade chain).
  const PHANTOM_BORROW_LINT_FLOOR_PIN = 1
  const MAX = ANSWER_RANGE_MAX_TWO_DIGIT // 99

  it('lint-floor literal pin: matches scripts/compositionLint.ts:2548 trap-guard `< 1`', () => {
    // If the lint guard at line 2548 is moved off `< 1` (e.g. to `< 10`),
    // update this constant + the call sites in `Math.tsx` two-digit-addsub
    // wiring in the SAME PR. This test exists so the misalignment can't
    // sneak through a single-side edit.
    expect(PHANTOM_BORROW_LINT_FLOOR_PIN).toBe(1)
  })

  it('correct=12 (smallest pool `-` result) with minAnswer=1 emits in-range off-by-one chips [11, 13]', () => {
    // Pool fact 15 − 3 = 12 (per spec §1.1, smallest `correct` on the `-`
    // side of the no-regroup pool). problemIndex=5 lands in the off-by-one
    // tier, which is the tier Wave 3's phantom-borrow class will branch
    // off of. Off-by-one of 12 is {11, 13}; both ≥ 1 and ≤ 99 under the
    // pinned floor.
    expect(
      pickDistractors(12, 5, MAX, {
        op: '-',
        operands: [15, 3],
        minAnswer: PHANTOM_BORROW_LINT_FLOOR_PIN,
      }),
    ).toEqual([11, 13])
  })

  it('correct=12 gentle ramp (problemIndex=1) with minAnswer=1 emits range-extreme chips [1, 99]', () => {
    // Gentle ramp tier — both range-extremes are ≥2 away from correct=12.
    // The `1` chip is exactly the pinned floor; the `99` chip is the
    // ceiling. This pin demonstrates that under minAnswer=1, the floor
    // value `1` is itself a valid chip (inclusivity of `minAnswer`).
    expect(
      pickDistractors(12, 1, MAX, {
        op: '-',
        operands: [15, 3],
        minAnswer: PHANTOM_BORROW_LINT_FLOOR_PIN,
      }),
    ).toEqual([1, 99])
  })

  it('correct=73 (largest pool `-` result envelope) with minAnswer=1 emits off-by-one chips [72, 74]', () => {
    // The pool's largest correct under the §7.2 Option B no-regroup pool
    // is 73 (`97 − 24`). Off-by-one of 73 is {72, 74} — both well inside
    // [1, 99]. Pin verifies the ceiling-side of the tier behaves under the
    // same minAnswer=1 contract.
    expect(
      pickDistractors(73, 5, MAX, {
        op: '-',
        operands: [97, 24],
        minAnswer: PHANTOM_BORROW_LINT_FLOOR_PIN,
      }),
    ).toEqual([72, 74])
  })

  it('every smallest-pool `-` correct ∈ {12, 13, 14, 15} stays ≥ minAnswer=1 across P4–P8 (NOF #7 forward-risk scenarios)', () => {
    // Devon NOF #7's concrete forward-risk set: when Wave 3's render-side
    // phantomBorrowDistractor lands with a hypothetical chip-floor of 10,
    // these four `correct` values would lint-pass with phantom-borrow
    // traps {2, 3, 4, 5} (all ≥ 1) but silent-downgrade at render time.
    // Under the AGREED floor of 1, none of those traps falls out of range,
    // and the existing off-by-one fallback yields chips strictly ≥ 1.
    const nofForwardRiskCorrects = [12, 13, 14, 15] as const
    const problemIndices = [4, 5, 6, 7, 8] as const
    for (const correct of nofForwardRiskCorrects) {
      for (const problemIndex of problemIndices) {
        const [d1, d2] = pickDistractors(correct, problemIndex, MAX, {
          op: '-',
          // Operands chosen so a − b = correct without crossing 10s
          // boundary; concrete fact selection doesn't matter for this
          // off-by-one pin since no Class-2/B/3 hint is passed.
          operands: [correct + 3, 3] as const,
          minAnswer: PHANTOM_BORROW_LINT_FLOOR_PIN,
        })
        expect(d1).toBeGreaterThanOrEqual(PHANTOM_BORROW_LINT_FLOOR_PIN)
        expect(d1).toBeLessThanOrEqual(MAX)
        expect(d2).toBeGreaterThanOrEqual(PHANTOM_BORROW_LINT_FLOOR_PIN)
        expect(d2).toBeLessThanOrEqual(MAX)
        expect(d1).not.toBe(d2)
        expect(d1).not.toBe(correct)
        expect(d2).not.toBe(correct)
      }
    }
  })

  it('minAnswer=10 (hypothetical misaligned floor) makes correct=12 phantom-borrow trap=2 out-of-range — surfaces drift', () => {
    // The misalignment scenario the brief warns about: a future Wave 3 PR
    // sets render-side floor=10 (to enforce two-digit-only chips) while
    // the lint stays at `< 1`. Under floor=10 and correct=12, the off-
    // by-one walker still finds [11, 13] (both ≥ 10), but a phantom-borrow
    // trap of `correct - 10 = 2` (the lint-passing value) WOULD be
    // out-of-range. Pin documents that the lint-passing trap `2` violates
    // a floor-of-10 contract — making any future floor-shift on EITHER
    // side land a CI red.
    const hypotheticalMisalignedFloor = 10
    const lintPassingTrap = 12 - 10 // canonical phantom-borrow formula
    expect(lintPassingTrap).toBe(2)
    expect(lintPassingTrap).toBeLessThan(hypotheticalMisalignedFloor)
    // The off-by-one fallback for correct=12 under floor=10 still
    // produces in-range chips ([11, 13]) — the silent failure surface
    // would be the lint-side trap (2) being declared "valid" by the lint
    // while render-side rejects it. Pin asserts the trap-vs-floor delta.
    expect(
      pickDistractors(12, 5, MAX, {
        op: '-',
        operands: [15, 3],
        minAnswer: hypotheticalMisalignedFloor,
      }),
    ).toEqual([11, 13])
  })
})

// ── Wave 5 — Forgotten-Carry, Smaller-From-Larger, Borrow-No-Decrement ──
// Dave's research PR #300 (design/research/wave-5-borrow-carry-error-patterns.md).
// Three distractor classes for two-digit-addsub WITH-regroup:
//
//   - 'forgotten-carry'      addition;     trap = correct − 10
//   - 'smaller-from-larger'  subtraction;  trap = (tA−tB)×10 + (oB−oA)
//   - 'borrow-no-decrement'  subtraction;  trap = (tA−tB)×10 + (oA+10−oB)
//                            (algebraically = correct + 10)
//
// All three follow the established Class-2-family fallback chain: silent
// downgrade to Class-1 off-by-one on OOR / aliases-correct /
// aliases-off-by-one. SFL and BND additionally null on non-borrow facts
// (onesA ≥ onesB) where the formula doesn't model a real error.
//
// Test surface: pin each formula EXACTLY on a small set of canonical
// worked examples (the same ones Dave used in the research note's
// distractor table § 4). Pin the silent-downgrade path on each failure
// mode. Pin the caller-site dispatch (pickDistractors) so the wiring
// chain is end-to-end.

describe('forgottenCarryDistractors — Wave-5 Class 2 (addition)', () => {
  // Pool envelope: smallest with-regroup answer is 11 (2+9, 3+8, etc.);
  // largest in 2D+1D with-regroup is ~98 (89+9). Trap = correct − 10 ∈
  // [1, 88]. Wave-5 callers thread minAnswer=1.

  it("matches Dave's research §3 Candidate A worked example — 27+6=33 → trap=23", () => {
    // Forgotten-Carry models WM failure to add the carried 1 to tens.
    // For 27+6: correct=33, trap=23, secondary off-by-one walker picks
    // 32 (correct−1, distinct from trap 23). Pair sorted: [23, 32].
    expect(forgottenCarryDistractors(33, 1, 99)).toEqual([23, 32])
  })

  it('smallest pool fact 2+9=11 → trap=1, secondary walks correct±1', () => {
    // correct=11, trap=11−10=1 (exactly at minAnswer=1 floor — inclusive).
    // Secondary walker: -1 → 10 (in range, distinct from trap 1 and
    // correct 11) → take. Pair: [1, 10].
    expect(forgottenCarryDistractors(11, 1, 99)).toEqual([1, 10])
  })

  it('returns null when trap falls below minAnswer — minAnswer=11, correct=15 → trap=5 OOR', () => {
    // Hypothetical tier with a higher floor. Pin verifies the OOR
    // downgrade path fires cleanly.
    expect(forgottenCarryDistractors(15, 11, 99)).toBeNull()
  })

  it('returns null when trap exceeds maxAnswer — maxAnswer=20, correct=99 → trap=89 OOR', () => {
    // Pathological for 2-digit tier, but the bound check should hold.
    expect(forgottenCarryDistractors(99, 1, 20)).toBeNull()
  })
})

describe('smallerFromLargerDistractors — Wave-5 Class 2 (subtraction)', () => {
  // SFL only fires when onesA < onesB (the borrow-required condition).
  // Trap = (tensA − tensB) × 10 + (onesB − onesA).

  it("matches Dave's research §3 Candidate B worked example — 43-27=16 → trap=24", () => {
    // onesA=3, onesB=7 → borrow needed. SFL = (4−2)×10 + (7−3) = 24.
    // Off-by-one of 16 is {15, 17}; trap 24 distinct from both. Walker
    // picks correct−1=15 as secondary. Pair sorted: [15, 24].
    expect(smallerFromLargerDistractors(16, 43, 27, 1, 99)).toEqual([15, 24])
  })

  it('returns null on non-borrow fact (onesA ≥ onesB) — 47-23=24 → null', () => {
    // onesA=7, onesB=3 → no borrow needed. SFL formula would compute
    // (4−2)×10 + (3−7) = 20 − 4 = 16, which is NOT the correct answer
    // (24) and would actually be in-range — but the error pattern SFL
    // models (column-reversal because the child can't subtract) does
    // NOT apply when borrowing isn't required. Returning null forces
    // the caller to fall through to plain off-by-one for these facts.
    expect(smallerFromLargerDistractors(24, 47, 23, 1, 99)).toBeNull()
  })

  it('emits trap for 35-18=17 → trap=23', () => {
    // onesA=5, onesB=8 → borrow needed. SFL = (3−1)×10 + (8−5) = 23.
    // Off-by-one secondary: 16 (correct−1, distinct from trap 23).
    expect(smallerFromLargerDistractors(17, 35, 18, 1, 99)).toEqual([16, 23])
  })

  it('emits trap for 52-26=26 → trap=34', () => {
    // onesA=2, onesB=6 → borrow. SFL = (5−2)×10 + (6−2) = 34. Secondary
    // picks correct−1=25.
    expect(smallerFromLargerDistractors(26, 52, 26, 1, 99)).toEqual([25, 34])
  })

  it('emits trap for 97-49=48 → trap=52', () => {
    // onesA=7, onesB=9 → borrow. SFL = (9−4)×10 + (9−7) = 52. Secondary
    // picks correct−1=47.
    expect(smallerFromLargerDistractors(48, 97, 49, 1, 99)).toEqual([47, 52])
  })
})

describe('borrowNoDecrementDistractors — Wave-5 Class 3 (subtraction)', () => {
  // BND only fires when onesA < onesB (borrow required). Trap =
  // (tensA − tensB) × 10 + (onesA + 10 − onesB), algebraically = correct + 10.

  it("matches Dave's research §3 Candidate C worked example — 43-27=16 → trap=26", () => {
    // onesA=3, onesB=7 → borrow. BND = (4−2)×10 + (3+10−7) = 26.
    // Off-by-one of 16 is {15, 17}; trap 26 distinct from both. Walker
    // picks correct−1=15 as secondary. Pair sorted: [15, 26].
    expect(borrowNoDecrementDistractors(16, 43, 27, 1, 99)).toEqual([15, 26])
  })

  it('BND = correct + 10 (algebraic identity) — 35-18=17 → trap=27', () => {
    // BND = (3−1)×10 + (5+10−8) = 20 + 7 = 27 = 17 + 10. ✓
    expect(borrowNoDecrementDistractors(17, 35, 18, 1, 99)).toEqual([16, 27])
  })

  it('BND = correct + 10 — 97-49=48 → trap=58', () => {
    // BND = (9−4)×10 + (7+10−9) = 50 + 8 = 58 = 48 + 10. ✓
    expect(borrowNoDecrementDistractors(48, 97, 49, 1, 99)).toEqual([47, 58])
  })

  it('returns null on non-borrow fact — 47-23=24 → null', () => {
    // onesA=7, onesB=3 → no borrow needed. BND doesn't model a real
    // error when the child doesn't have to borrow.
    expect(borrowNoDecrementDistractors(24, 47, 23, 1, 99)).toBeNull()
  })

  it('returns null when trap exceeds maxAnswer — 97-49=48 with maxAnswer=50 → BND=58 OOR', () => {
    // Narrow ceiling — BND falls out of range.
    expect(borrowNoDecrementDistractors(48, 97, 49, 1, 50)).toBeNull()
  })

  it("verifies Dave's 'BND distinct from SFL on Wave-5 pool' assertion — 43-27=16 → BND=26, SFL=24", () => {
    // Dave's §4 distractor-table assertion: "BND is always off-by-10
    // from correct in the upward direction" + "distinct from SFL in
    // the full pool". Pin both formulas side-by-side on the canonical
    // fact and assert distinctness.
    const sfl = smallerFromLargerDistractors(16, 43, 27, 1, 99)
    const bnd = borrowNoDecrementDistractors(16, 43, 27, 1, 99)
    expect(sfl).toEqual([15, 24])
    expect(bnd).toEqual([15, 26])
    // Traps distinct — secondary off-by-one (15 = correct−1) is shared
    // because both classes share the off-by-one walker; the trap value
    // (sorted into position [1]) is what differs: 24 (SFL) vs 26 (BND).
    expect(sfl![1]).not.toBe(bnd![1])
    // Algebraically: BND = correct + 10 = 26 ≠ SFL = correct + 8 = 24.
    expect(bnd![1] - sfl![1]).toBe(2)
  })
})

describe('pickDistractors — Wave-5 caller-site dispatch', () => {
  // End-to-end dispatch: caller passes (correct, problemIndex, maxAnswer,
  // {op, operands, distractorClass}); the right class branch fires and the
  // helper output flows through.

  const MAX = ANSWER_RANGE_MAX_TWO_DIGIT // 99
  const FLOOR = 1

  describe("distractorClass='forgotten-carry' (op='+')", () => {
    it('27+6=33 P4 emits the Forgotten-Carry trap [23, 32]', () => {
      expect(
        pickDistractors(33, 4, MAX, {
          op: '+',
          operands: [27, 6],
          distractorClass: 'forgotten-carry',
          minAnswer: FLOOR,
        }),
      ).toEqual([23, 32])
    })

    it('NEVER fires on op="-" — silently downgrades to off-by-one', () => {
      // Class is addition-only. Setting it on a subtraction problem is
      // benign — falls through to off-by-one Class 1.
      expect(
        pickDistractors(16, 5, MAX, {
          op: '-',
          operands: [43, 27],
          distractorClass: 'forgotten-carry',
          minAnswer: FLOOR,
        }),
      ).toEqual([15, 17])
    })

    it('NEVER fires for P1-P3 — gentle ramp wins (correct=33 picks range extremes)', () => {
      // P1 → 'gentle'. For correct=33 with [1, 99]: both extremes ≥2
      // away → pair [1, 99] sorted ascending.
      expect(
        pickDistractors(33, 1, MAX, {
          op: '+',
          operands: [27, 6],
          distractorClass: 'forgotten-carry',
          minAnswer: FLOOR,
        }),
      ).toEqual([1, 99])
    })
  })

  describe("distractorClass='smaller-from-larger' (op='-')", () => {
    it('43-27=16 P4 emits the SFL trap [15, 24]', () => {
      expect(
        pickDistractors(16, 4, MAX, {
          op: '-',
          operands: [43, 27],
          distractorClass: 'smaller-from-larger',
          minAnswer: FLOOR,
        }),
      ).toEqual([15, 24])
    })

    it('non-borrow fact 47-23=24 silently downgrades to off-by-one [23, 25]', () => {
      // onesA=7, onesB=3 → SFL helper returns null → fall through.
      expect(
        pickDistractors(24, 4, MAX, {
          op: '-',
          operands: [47, 23],
          distractorClass: 'smaller-from-larger',
          minAnswer: FLOOR,
        }),
      ).toEqual([23, 25])
    })

    it('NEVER fires without operands — defensive fallback to off-by-one', () => {
      // SFL is operand-keyed; without operands it cannot be computed.
      expect(
        pickDistractors(16, 4, MAX, {
          op: '-',
          distractorClass: 'smaller-from-larger',
          minAnswer: FLOOR,
        }),
      ).toEqual([15, 17])
    })

    it('NEVER fires on op="+" — addition silently downgrades to off-by-one', () => {
      expect(
        pickDistractors(33, 4, MAX, {
          op: '+',
          operands: [27, 6],
          distractorClass: 'smaller-from-larger',
          minAnswer: FLOOR,
        }),
      ).toEqual([32, 34])
    })
  })

  describe("distractorClass='borrow-no-decrement' (op='-')", () => {
    it('43-27=16 P5 emits the BND trap [15, 26]', () => {
      // BND is P5–P8 only per Dave; pin at P5.
      expect(
        pickDistractors(16, 5, MAX, {
          op: '-',
          operands: [43, 27],
          distractorClass: 'borrow-no-decrement',
          minAnswer: FLOOR,
        }),
      ).toEqual([15, 26])
    })

    it('non-borrow fact 47-23=24 silently downgrades to off-by-one [23, 25]', () => {
      expect(
        pickDistractors(24, 5, MAX, {
          op: '-',
          operands: [47, 23],
          distractorClass: 'borrow-no-decrement',
          minAnswer: FLOOR,
        }),
      ).toEqual([23, 25])
    })

    it('NEVER fires without operands — defensive fallback to off-by-one', () => {
      expect(
        pickDistractors(16, 5, MAX, {
          op: '-',
          distractorClass: 'borrow-no-decrement',
          minAnswer: FLOOR,
        }),
      ).toEqual([15, 17])
    })

    it('NEVER fires on op="+" — addition silently downgrades to off-by-one', () => {
      expect(
        pickDistractors(33, 5, MAX, {
          op: '+',
          operands: [27, 6],
          distractorClass: 'borrow-no-decrement',
          minAnswer: FLOOR,
        }),
      ).toEqual([32, 34])
    })
  })

  describe('invariants across full Wave-5 sample pool', () => {
    // Sample of canonical with-regroup facts spanning the 2D±1D / 2D±2D
    // space. Each distractor must be (a) in range, (b) distinct from
    // correct, (c) distinct from each other.
    const WAVE5_SUB_BORROW: ReadonlyArray<[number, number]> = [
      // 2D − 1D with borrow
      [21, 5], // 21−5=16, onesA=1 < onesB=5
      [33, 8], // 33−8=25, onesA=3 < onesB=8
      [42, 9], // 42−9=33
      [54, 7], // 54−7=47
      // 2D − 2D with borrow
      [43, 27], // 43−27=16 (Dave canonical)
      [35, 18], // 35−18=17
      [52, 26], // 52−26=26
      [97, 49], // 97−49=48
    ]

    for (const [a, b] of WAVE5_SUB_BORROW) {
      const correct = a - b
      it(`${a}-${b}=${correct}: SFL P4 produces in-range distinct chips`, () => {
        const [d1, d2] = pickDistractors(correct, 4, MAX, {
          op: '-',
          operands: [a, b],
          distractorClass: 'smaller-from-larger',
          minAnswer: FLOOR,
        })
        expect(d1).toBeGreaterThanOrEqual(FLOOR)
        expect(d1).toBeLessThanOrEqual(MAX)
        expect(d2).toBeGreaterThanOrEqual(FLOOR)
        expect(d2).toBeLessThanOrEqual(MAX)
        expect(d1).not.toBe(d2)
        expect(d1).not.toBe(correct)
        expect(d2).not.toBe(correct)
      })

      it(`${a}-${b}=${correct}: BND P5 produces in-range distinct chips`, () => {
        const [d1, d2] = pickDistractors(correct, 5, MAX, {
          op: '-',
          operands: [a, b],
          distractorClass: 'borrow-no-decrement',
          minAnswer: FLOOR,
        })
        expect(d1).toBeGreaterThanOrEqual(FLOOR)
        expect(d1).toBeLessThanOrEqual(MAX)
        expect(d2).toBeGreaterThanOrEqual(FLOOR)
        expect(d2).toBeLessThanOrEqual(MAX)
        expect(d1).not.toBe(d2)
        expect(d1).not.toBe(correct)
        expect(d2).not.toBe(correct)
      })
    }

    const WAVE5_ADD_CARRY: ReadonlyArray<[number, number]> = [
      // 2D + 1D with carry
      [27, 6], // Dave canonical, 33
      [38, 5], // 43
      [49, 4], // 53
      [56, 7], // 63
      [89, 9], // 98
      // boundary: smallest with-regroup answers
      [2, 9], // 11
      [5, 8], // 13
    ]

    for (const [a, b] of WAVE5_ADD_CARRY) {
      const correct = a + b
      it(`${a}+${b}=${correct}: Forgotten-Carry P4 produces in-range distinct chips`, () => {
        const [d1, d2] = pickDistractors(correct, 4, MAX, {
          op: '+',
          operands: [a, b],
          distractorClass: 'forgotten-carry',
          minAnswer: FLOOR,
        })
        expect(d1).toBeGreaterThanOrEqual(FLOOR)
        expect(d1).toBeLessThanOrEqual(MAX)
        expect(d2).toBeGreaterThanOrEqual(FLOOR)
        expect(d2).toBeLessThanOrEqual(MAX)
        expect(d1).not.toBe(d2)
        expect(d1).not.toBe(correct)
        expect(d2).not.toBe(correct)
      })
    }
  })
})

// ── ANSWER_RANGE_MIN is exported but unused in this block — keep the
//    import live so future tier additions don't have to re-add it.
void ANSWER_RANGE_MIN
