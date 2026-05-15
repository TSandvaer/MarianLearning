/**
 * Unit tests for the subitising dot-card scope predicate (ticket 86c9q5j9a).
 *
 * Pure-function coverage — no React, no DOM, no Math.tsx coupling. The
 * predicate is structural ("both addends ≤ 5") and lives in its own
 * module so it can be exercised against the spec's full truth table
 * without paying the screen-test setup cost.
 */

import { describe, expect, it } from 'vitest'
import {
  shouldShowDotCard,
  MAX_PIPS_PER_CELL,
  MIN_PIPS_PER_CELL,
  DOT_CARD_TOTAL_MS,
  DOT_CARD_REDUCED_MOTION_TOTAL_MS,
  PIPS_TO_WORD,
  DOT_CARD_FADE_IN_MS,
  DOT_CARD_HOLD_MS,
  DOT_CARD_FADE_OUT_MS,
  DOT_CARD_FADE_IN_SPRING,
} from './dotCard'
import type { MathProblem } from './sessionPlans'

/**
 * Minimal `MathProblem` factory — the predicate only reads the addends,
 * but TypeScript needs the rest of the shape to satisfy the type. Spec
 * pins addends ≥ 1 and integer-valued; the planner's MATH_TRACK_GUIDE
 * enforces this upstream.
 */
function problem(addendA: number, addendB: number): MathProblem {
  return {
    index: 1,
    addendA,
    addendB,
    correct: addendA + addendB,
    op: '+',
    utterances: {
      read: 'placeholder',
      correct: 'placeholder',
      reprompt: 'placeholder',
      hint: 'placeholder',
      giveAnswer: 'placeholder',
    },
  }
}

describe('shouldShowDotCard', () => {
  it('returns true when both addends are at the lower bound (1+1)', () => {
    expect(shouldShowDotCard(problem(1, 1))).toBe(true)
  })

  it('returns true when both addends are at the upper bound (5+5)', () => {
    expect(shouldShowDotCard(problem(5, 5))).toBe(true)
  })

  it('returns true on the canonical Marian observation case (3+2)', () => {
    expect(shouldShowDotCard(problem(3, 2))).toBe(true)
  })

  it('covers every in-scope addend pair on the full 1..5 truth table', () => {
    for (let a = 1; a <= 5; a++) {
      for (let b = 1; b <= 5; b++) {
        expect(
          shouldShowDotCard(problem(a, b)),
          `addends ${a}+${b} should be in scope`,
        ).toBe(true)
      }
    }
  })

  it('returns false when addendA is just above the upper bound (6)', () => {
    expect(shouldShowDotCard(problem(6, 3))).toBe(false)
  })

  it('returns false when addendB is just above the upper bound (6)', () => {
    expect(shouldShowDotCard(problem(3, 6))).toBe(false)
  })

  it('returns false on add-to-20 territory (e.g. 6+4)', () => {
    expect(shouldShowDotCard(problem(6, 4))).toBe(false)
  })

  it('returns false on the upper edge of add-to-20 (e.g. 9+9)', () => {
    expect(shouldShowDotCard(problem(9, 9))).toBe(false)
  })

  it('returns false on a borderline mixed pair (5+6)', () => {
    expect(shouldShowDotCard(problem(5, 6))).toBe(false)
    expect(shouldShowDotCard(problem(6, 5))).toBe(false)
  })

  it('returns false on zero addends (defensive — planner emits ≥ 1)', () => {
    expect(shouldShowDotCard(problem(0, 3))).toBe(false)
    expect(shouldShowDotCard(problem(3, 0))).toBe(false)
    expect(shouldShowDotCard(problem(0, 0))).toBe(false)
  })

  it('returns false on negative addends (defensive)', () => {
    expect(shouldShowDotCard(problem(-1, 3))).toBe(false)
    expect(shouldShowDotCard(problem(3, -1))).toBe(false)
  })

  it('returns false on non-integer addends (defensive)', () => {
    expect(shouldShowDotCard(problem(2.5, 3))).toBe(false)
    expect(shouldShowDotCard(problem(3, 2.5))).toBe(false)
  })

  it('returns false on a spec out-of-scope sample from PR #163 trigger table (6+3)', () => {
    expect(shouldShowDotCard(problem(6, 3))).toBe(false)
  })
})

describe('MAX_PIPS_PER_CELL / MIN_PIPS_PER_CELL', () => {
  it('caps the dice-pip vocabulary at 5', () => {
    // The spec's dice-pip rendering is defined for 1..5 only. Bumping
    // this constant requires a new visual primitive — the dot-card
    // would render 6+ pips, which Kyle's spec § "Visual style decision"
    // explicitly rejects (a 6-pip face is a 2x3 grid, not the canonical
    // dice layout).
    expect(MAX_PIPS_PER_CELL).toBe(5)
  })

  it('floors the dice-pip vocabulary at 1', () => {
    // Planner emits addends ≥ 1; the predicate also defends against
    // accidental zeroes from a future planner regression.
    expect(MIN_PIPS_PER_CELL).toBe(1)
  })
})

describe('PIPS_TO_WORD', () => {
  it('exposes the spelled lowercase word for every valid pip count', () => {
    expect(PIPS_TO_WORD).toEqual({
      1: 'one',
      2: 'two',
      3: 'three',
      4: 'four',
      5: 'five',
    })
  })
})

describe('Dot-card lifecycle constants', () => {
  it('full-motion total is 1100ms (200 fade-in + 700 hold + 200 fade-out)', () => {
    // Spec § "Animation envelope (locked)". This is the user-visible
    // duration; if it ever drifts past 1500ms or below 800ms, Marian's
    // perception of the recognition window changes and Kyle's locked
    // pedagogy assumption breaks.
    expect(DOT_CARD_TOTAL_MS).toBe(1100)
    expect(DOT_CARD_FADE_IN_MS + DOT_CARD_HOLD_MS + DOT_CARD_FADE_OUT_MS).toBe(
      DOT_CARD_TOTAL_MS,
    )
  })

  it('reduced-motion total is within 1100±50ms of full-motion', () => {
    // Spec § "Reduced-motion variant of dot-card visible" — total
    // visible window is preserved; only the spring flourishes are
    // collapsed.
    const delta = Math.abs(DOT_CARD_REDUCED_MOTION_TOTAL_MS - DOT_CARD_TOTAL_MS)
    expect(delta).toBeLessThanOrEqual(50)
  })

  it('fade-in spring matches Emma celebration spring (220 / 22)', () => {
    // Spec § "Spring config" — house spring family is shared with
    // EmmaCharacter celebration so motion vocabulary is coherent.
    expect(DOT_CARD_FADE_IN_SPRING.stiffness).toBe(220)
    expect(DOT_CARD_FADE_IN_SPRING.damping).toBe(22)
    expect(DOT_CARD_FADE_IN_SPRING.type).toBe('spring')
  })
})
