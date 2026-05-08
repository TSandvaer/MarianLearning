import { describe, expect, it } from 'vitest'
import {
  ANSWER_RANGE_MAX,
  ANSWER_RANGE_MAX_TO_20,
  ANSWER_RANGE_MIN,
  GENTLE_RAMP_THROUGH,
  chipMaxAnswerForCorrects,
  pickDistractors,
  pickTier,
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

  it('throws when correct exceeds the largest known tier ceiling', () => {
    // A two-digit-addsub tier or beyond would land here. We throw rather
    // than silently expanding — extending the function is a deliberate
    // change with its own tier-add ticket.
    expect(() => chipMaxAnswerForCorrects([21])).toThrow(/no tier ceiling/)
    expect(() => chipMaxAnswerForCorrects([5, 99])).toThrow(/no tier ceiling/)
  })
})
