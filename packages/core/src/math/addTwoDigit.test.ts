/**
 * Adding big numbers, `add-two-digit` (content wave 5,
 * `design/native/content-wave-5.md` § 3.6, § 3.7, AC 3): two-digit +
 * two-digit with a new ten. Its reads parse with today's addition template
 * (`kind: 'arithmetic'`, no parser change); the trays come from the step
 * (`PLACE_VALUE_ARITHMETIC_NODES`), what moves on the read from the
 * problem's position (`addTwoDigitReadMotion`, D6), and the chips from
 * `addTwoDigitDistractors`: the answer ± 20 on P1–P3, then the forgotten
 * carry (− 10) and an off-by-one whose sign alternates.
 *
 * Failing-first: written before the list, the motion rule and the chip
 * function existed.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  addTwoDigitDistractors,
  addTwoDigitOfferedClass,
} from './extendedDistractors'
import {
  addTwoDigitReadMotion,
  isPlaceValueArithmetic,
  PLACE_VALUE_ARITHMETIC_NODES,
  problemFact,
} from './extendedProblems'
import { mathSessionPlanFromServer } from './planFromServer'

/** § 3.7's reads, answers, chips (the answer first). */
const TABLE: readonly [string, number, number, number][] = [
  ['Thirty-four plus twenty-five. How many?', 59, 39, 79],
  ['Forty-two plus thirty-six. How many?', 78, 58, 98],
  ['Twenty-eight plus thirty-five. How many?', 63, 43, 83],
  ['Forty-seven plus twenty-six. How many?', 73, 63, 74],
  ['Thirty-nine plus forty-four. How many?', 83, 73, 82],
  ['Fifty-six plus twenty-eight. How many?', 84, 74, 85],
  ['Twenty-nine plus thirty-three. How many?', 62, 52, 61],
  ['Sixty-five plus twenty-seven. How many?', 92, 82, 93],
]

describe('the step draws the trays (§ 3.6)', () => {
  it('is the one place-value arithmetic step', () => {
    expect(PLACE_VALUE_ARITHMETIC_NODES).toEqual(['add-two-digit'])
  })

  it('an arithmetic problem draws them only on that step', () => {
    const p = {
      kind: 'arithmetic' as const,
      index: 3,
      addendA: 28,
      addendB: 35,
      correct: 63,
      op: '+' as const,
      utterances: { read: '', correct: '', reprompt: '', giveAnswer: '' },
    }
    expect(isPlaceValueArithmetic(p, 'add-two-digit')).toBe(true)
    expect(isPlaceValueArithmetic(p, 'two-digit-addsub-with-regroup')).toBe(
      false,
    )
    expect(isPlaceValueArithmetic(p, undefined)).toBe(false)
    expect(isPlaceValueArithmetic(p, null)).toBe(false)
  })
})

describe('what moves on the read, by position (§ 3.6, D6, AC 3)', () => {
  it('P1–P3 drop and bundle, P4–P5 drop, P6–P8 nothing', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(addTwoDigitReadMotion)).toEqual([
      'drop-and-bundle',
      'drop-and-bundle',
      'drop-and-bundle',
      'drop',
      'drop',
      'none',
      'none',
      'none',
    ])
  })
})

describe('the chips (§ 3.6, § 3.7, AC 3)', () => {
  it.each(TABLE.map(([, a, b, c], i) => [i + 1, a, b, c] as const))(
    'P%i: %i, %i, %i',
    (index, answer, x, y) => {
      expect(addTwoDigitDistractors(answer, index)).toEqual(
        [x, y].sort((m, n) => m - n),
      )
    },
  )

  it('records null on P1–P3 and the forgotten carry on P4–P8', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(addTwoDigitOfferedClass)).toEqual([
      null,
      null,
      null,
      'forgotten-carry',
      'forgotten-carry',
      'forgotten-carry',
      'forgotten-carry',
      'forgotten-carry',
    ])
  })

  it('keeps every chip in 1–99, apart from the answer and each other, with no zero digit', () => {
    for (let correct = 21; correct <= 99; correct++) {
      if (correct % 10 === 0) continue
      for (let index = 1; index <= 8; index++) {
        const [a, b] = addTwoDigitDistractors(correct, index)
        for (const v of [a, b]) {
          expect(v).toBeGreaterThanOrEqual(1)
          expect(v).toBeLessThanOrEqual(99)
          expect(v % 10).not.toBe(0)
          expect(v).not.toBe(correct)
        }
        expect(a).not.toBe(b)
      }
    }
  })
})

describe('the committed canon (§ 3.7, AC 3)', () => {
  const path = join(
    __dirname,
    '../../../../public/canon/math/level-1/add-two-digit.json',
  )

  it('parses 8/8 as arithmetic, records the 8 + facts', () => {
    expect(existsSync(path)).toBe(true)
    const doc = JSON.parse(readFileSync(path, 'utf8')) as { plan: unknown }
    const plan = mathSessionPlanFromServer(doc.plan, { extendedKinds: true })
    expect(plan.problems.map((p) => p.kind)).toEqual(
      Array(8).fill('arithmetic'),
    )
    expect(plan.problems.map((p) => p.utterances.read)).toEqual(
      TABLE.map(([r]) => r),
    )
    expect(plan.problems.map((p) => p.correct)).toEqual(TABLE.map(([, a]) => a))
    expect(plan.problems.map(problemFact)).toEqual([
      { a: 34, b: 25, op: '+' },
      { a: 42, b: 36, op: '+' },
      { a: 28, b: 35, op: '+' },
      { a: 47, b: 26, op: '+' },
      { a: 39, b: 44, op: '+' },
      { a: 56, b: 28, op: '+' },
      { a: 29, b: 33, op: '+' },
      { a: 65, b: 27, op: '+' },
    ])
  })
})
