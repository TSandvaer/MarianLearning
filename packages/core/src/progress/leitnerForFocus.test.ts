/**
 * `leitnerBoxForFocus`: a multiplication fact reaches only a
 * multiplication step's session-start hint (the planner's add-to-10
 * Leitner directive would otherwise plan "Two times three" into an
 * addition session).
 */
import { describe, expect, it } from 'vitest'
import {
  LEITNER_DUE_PER_SESSION_CAP,
  buildLeitnerSessionHint,
  leitnerBoxForFocus,
} from './leitner'
import type { LeitnerBox, LeitnerBoxIndex, MathFact } from './types'

function box(
  facts: [number, number, MathFact['op'], LeitnerBoxIndex][],
): LeitnerBox<MathFact> {
  return {
    items: facts.map(([a, b, op, n]) => ({
      item: { a, b, op },
      box: n,
      lastSeen: 0,
    })),
  }
}

// Three due multiplication facts in Box 1, ahead of two addition facts and
// a subtraction fact: without the filter they would fill the 3-fact cap.
const MIXED = box([
  [2, 3, '*', 1],
  [3, 2, '*', 1],
  [6, 2, '*', 1],
  [3, 4, '+', 2],
  [5, 2, '+', 2],
  [7, 3, '-', 3],
])

describe('leitnerBoxForFocus', () => {
  it.each([
    'add-to-10',
    'add-to-20',
    'sub-to-10',
    'number-recog',
    'skip-counting',
    'two-digit-addsub-with-regroup',
    undefined,
  ])('%s: drops every "*" fact, keeps "+" and "-"', (focus) => {
    const kept = leitnerBoxForFocus(MIXED, focus).items.map((e) => e.item)
    expect(kept.filter((f) => f.op === '*')).toHaveLength(0)
    expect(kept).toEqual([
      { a: 3, b: 4, op: '+' },
      { a: 5, b: 2, op: '+' },
      { a: 7, b: 3, op: '-' },
    ])
  })

  it.each(['mult-2-5-10', 'mult-3-4', 'mult-6-9'])(
    '%s: keeps the box as it is',
    (focus) => {
      expect(leitnerBoxForFocus(MIXED, focus)).toBe(MIXED)
    },
  )

  it('add-to-10 hint: no "*" fact, and the cap is spent on the addition facts', () => {
    const hint = buildLeitnerSessionHint(leitnerBoxForFocus(MIXED, 'add-to-10'))
    expect(LEITNER_DUE_PER_SESSION_CAP).toBe(3)
    expect(hint.filter((i) => i.op === '*')).toHaveLength(0)
    expect(hint).toEqual([
      { a: 3, b: 4, op: '+', box: 2 },
      { a: 5, b: 2, op: '+', box: 2 },
      { a: 7, b: 3, op: '-', box: 3 },
    ])
  })

  it('without the filter the same box would send only "*" facts (the leak)', () => {
    const hint = buildLeitnerSessionHint(MIXED)
    expect(hint.filter((i) => i.op === '*')).toHaveLength(3)
  })
})
