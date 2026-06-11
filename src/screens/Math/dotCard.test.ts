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
  shouldShowSubMinuendCell,
  isValidSubMinuend,
  subMinuendFromProblem,
  MAX_PIPS_PER_CELL,
  MIN_PIPS_PER_CELL,
  MIN_SUB_MINUEND,
  MAX_SUB_MINUEND,
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

/** Like `problem(...)` but produces a subtraction problem. Used to pin
 *  Kyle's spec §3 / Dave's research §Q2: sub-to-10 NEVER shows the
 *  dot-card, regardless of operand sizes. */
function subProblem(minuend: number, subtrahend: number): MathProblem {
  return {
    index: 1,
    addendA: minuend,
    addendB: subtrahend,
    correct: minuend - subtrahend,
    op: '-',
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

  // ── sub-to-10 op-gate (Kyle's spec §3, Dave's research §Q2) ────────────
  //
  // The dot-card is an addition-only CRA scaffold. Subtraction skips it
  // entirely — Marian's representational layer for sub-to-10 is Emma's
  // read-aloud, not a pip visualization. Without the op-gate, pool facts
  // like `5 − 5 = 0` (both operands ≤ 5) would fire the structural rule
  // and show a misleading 5+5 = 10 pip count for a problem whose
  // correct answer is `0`.
  //
  // Belt-and-braces: even pool facts whose operands ALSO clear the ≤ 5
  // ceiling (e.g. `5 − 5`, `3 − 2`, `1 − 1`) must return false on
  // `op === '-'`. The structural addends-≤-5 rule still runs for `op
  // === '+'` callers — these counter-tests defend against silent gate
  // regression.

  it('returns false on sub-to-10 subtract-self with both operands ≤ 5 (5-5)', () => {
    expect(shouldShowDotCard(subProblem(5, 5))).toBe(false)
  })

  it('returns false on sub-to-10 with both operands ≤ 5 (3-2)', () => {
    expect(shouldShowDotCard(subProblem(3, 2))).toBe(false)
  })

  it('returns false on sub-to-10 with both operands at the lower bound (1-1)', () => {
    expect(shouldShowDotCard(subProblem(1, 1))).toBe(false)
  })

  it('returns false on every sub-to-10 pair on the 1..5 × 1..5 truth table', () => {
    for (let m = 1; m <= 5; m++) {
      for (let s = 1; s <= 5; s++) {
        expect(
          shouldShowDotCard(subProblem(m, s)),
          `sub-to-10 ${m}-${s} must NOT fire dot-card (op-gate)`,
        ).toBe(false)
      }
    }
  })

  it('returns false on sub-to-10 even when operands would be in-range additively (4-1)', () => {
    // 4 + 1 = 5 would pass the structural rule for op:'+', but the op-gate
    // rejects op:'-' upfront — no need to evaluate the operand check.
    expect(shouldShowDotCard(subProblem(4, 1))).toBe(false)
  })

  it('returns false on sub-to-10 subtract-zero (5-0) — operand 0 is below MIN, AND op gate rejects', () => {
    // Double-protected — subtract-zero produces operand b=0 which would fail
    // the MIN_PIPS_PER_CELL check anyway, but the op-gate fires first.
    expect(shouldShowDotCard(subProblem(5, 0))).toBe(false)
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
  it('exposes the spelled lowercase word for every quantity 1..10', () => {
    // Range expanded 1..5 → 1..10 for the sub-to-10 minuend ten-frame
    // (ticket 86ca7kdw8 / spec §13.2). The dice-pip primitive still only
    // renders 1..5; the ten-frame minuend cell renders 6..10.
    expect(PIPS_TO_WORD).toEqual({
      1: 'one',
      2: 'two',
      3: 'three',
      4: 'four',
      5: 'five',
      6: 'six',
      7: 'seven',
      8: 'eight',
      9: 'nine',
      10: 'ten',
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

// ── sub-to-10 minuend scaffold (ticket 86ca7kdw8 / spec §13.3) ───────────

describe('shouldShowSubMinuendCell', () => {
  it('fires across the full EASY-band minuend envelope [5, 10]', () => {
    // The 8 EASY-band sub-to-10 facts have minuends 5,8,7,9,10,8,6,9 —
    // all in [5,10]. Spec §13.3 S3.
    for (let minuend = MIN_SUB_MINUEND; minuend <= MAX_SUB_MINUEND; minuend++) {
      expect(shouldShowSubMinuendCell(subProblem(minuend, 1))).toBe(true)
    }
  })

  it('gates on the MINUEND only — subtrahend is irrelevant (§13.3 S4)', () => {
    // The structural difference from shouldShowDotCard: the subtrahend
    // can be anything; only the minuend (start-number) is subitised.
    expect(shouldShowSubMinuendCell(subProblem(8, 0))).toBe(true)
    expect(shouldShowSubMinuendCell(subProblem(8, 4))).toBe(true)
    expect(shouldShowSubMinuendCell(subProblem(8, 8))).toBe(true)
  })

  it('returns false for minuends below the floor (< 5)', () => {
    expect(shouldShowSubMinuendCell(subProblem(4, 2))).toBe(false)
    expect(shouldShowSubMinuendCell(subProblem(3, 1))).toBe(false)
    expect(shouldShowSubMinuendCell(subProblem(0, 0))).toBe(false)
  })

  it('returns false for minuends above the ceiling (> 10)', () => {
    expect(shouldShowSubMinuendCell(subProblem(11, 3))).toBe(false)
    expect(shouldShowSubMinuendCell(subProblem(15, 5))).toBe(false)
  })

  it('op-gate FIRST — addition never trips the minuend predicate', () => {
    // Even an add problem with addendA in [5,10] must not fire (the add
    // path has its own dot-card overlay). Spec §13.3 S2.
    expect(shouldShowSubMinuendCell(problem(5, 3))).toBe(false)
    expect(shouldShowSubMinuendCell(problem(8, 2))).toBe(false)
    expect(shouldShowSubMinuendCell(problem(10, 0))).toBe(false)
  })

  it('rejects non-integer minuends defensively', () => {
    expect(shouldShowSubMinuendCell(subProblem(7.5, 2))).toBe(false)
  })
})

describe('isValidSubMinuend', () => {
  it('accepts integers 5..10', () => {
    for (let n = 5; n <= 10; n++) expect(isValidSubMinuend(n)).toBe(true)
  })

  it('rejects 4, 11, and non-integers', () => {
    expect(isValidSubMinuend(4)).toBe(false)
    expect(isValidSubMinuend(11)).toBe(false)
    expect(isValidSubMinuend(7.5)).toBe(false)
  })
})

describe('subMinuendFromProblem', () => {
  it('returns the minuend for an in-scope subtraction problem', () => {
    expect(subMinuendFromProblem(subProblem(8, 4))).toBe(8)
    expect(subMinuendFromProblem(subProblem(5, 5))).toBe(5)
    expect(subMinuendFromProblem(subProblem(10, 3))).toBe(10)
  })

  it('returns null for out-of-band minuend or addition op', () => {
    expect(subMinuendFromProblem(subProblem(4, 1))).toBeNull()
    expect(subMinuendFromProblem(subProblem(11, 2))).toBeNull()
    expect(subMinuendFromProblem(problem(8, 2))).toBeNull()
  })
})
