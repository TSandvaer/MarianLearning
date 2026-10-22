/**
 * The flower bed's problems (`design/native/flower-bed-into-add-to-10.md`
 * § 1, C1-C2): a missing number whose whole is ten, and only that. Read from
 * the problem itself, so it holds wherever an adding-to-ten missing number
 * plays (canon, planner, review, warm-up, mix, peek, replay).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MISSING_NUMBER_SLOTS } from '../wire/missingNumbers'
import {
  isBondToTenProblem,
  type ExtendedMathProblem,
  type MissingAddendProblem,
} from './extendedProblems'
import { mathSessionPlanFromServer } from './planFromServer'
import type { MathProblem } from './sessionPlans'

const UTTERANCES = {
  read: 'r',
  correct: 'c',
  reprompt: 'p',
  hint: 'h',
} as MissingAddendProblem['utterances']

const missing = (addendA: number, total: number): MissingAddendProblem => ({
  kind: 'missing-addend',
  index: 4,
  addendA,
  total,
  correct: total - addendA,
  utterances: UTTERANCES,
})

const canonPlan = (node: string) =>
  mathSessionPlanFromServer(
    JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'public',
          'canon',
          'math',
          'level-1',
          `${node}.json`,
        ),
        'utf8',
      ),
    ).plan,
    { extendedKinds: true },
  )

describe('isBondToTenProblem (C1)', () => {
  it('is true for 7 + ? = 10 and for every given 1-9 with whole 10', () => {
    expect(
      isBondToTenProblem({
        kind: 'missing-addend',
        index: 4,
        addendA: 7,
        total: 10,
        correct: 3,
        utterances: UTTERANCES,
      }),
    ).toBe(true)
    for (let given = 1; given <= 9; given++) {
      expect(isBondToTenProblem(missing(given, 10))).toBe(true)
    }
  })

  it('is false for a missing number with whole 11-14', () => {
    for (let total = 11; total <= 14; total++) {
      for (let given = 6; given <= 9; given++) {
        expect(isBondToTenProblem(missing(given, total))).toBe(false)
      }
    }
  })

  it('is false for 7 + 3 arithmetic and for every other kind', () => {
    const arithmetic: ExtendedMathProblem = {
      kind: 'arithmetic',
      index: 4,
      addendA: 7,
      addendB: 3,
      op: '+',
      correct: 10,
      utterances: UTTERANCES,
    }
    expect(isBondToTenProblem(arithmetic)).toBe(false)
    // A plain (kind-less) MathProblem is never one.
    const plain: MathProblem = {
      index: 4,
      addendA: 7,
      addendB: 3,
      op: '+',
      correct: 10,
      utterances: UTTERANCES,
    }
    expect(isBondToTenProblem(plain)).toBe(false)
    const others: ExtendedMathProblem[] = [
      { kind: 'recognize', index: 1, correct: 10, utterances: UTTERANCES },
      {
        kind: 'skip-count',
        index: 1,
        sequence: [2, 4, 6],
        step: 2,
        correct: 8,
        utterances: UTTERANCES,
      },
      {
        kind: 'multiply',
        index: 1,
        factorA: 2,
        factorB: 5,
        correct: 10,
        utterances: UTTERANCES,
      },
    ]
    for (const p of others) expect(isBondToTenProblem(p)).toBe(false)
  })
})

describe('the canon (C2)', () => {
  it('add-to-10: true exactly at P4, P6 and P8 (MISSING_NUMBER_SLOTS)', () => {
    const plan = canonPlan('add-to-10')
    expect(
      plan.problems.flatMap((p) => (isBondToTenProblem(p) ? [p.index] : [])),
    ).toEqual([...MISSING_NUMBER_SLOTS])
  })

  it('add-to-20: false at every problem', () => {
    const plan = canonPlan('add-to-20')
    expect(plan.problems.filter(isBondToTenProblem)).toEqual([])
  })
})
