import { describe, expect, it } from 'vitest'
import {
  ANSWER_RANGE_MAX,
  ANSWER_RANGE_MIN,
  GENTLE_RAMP_THROUGH,
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
})
