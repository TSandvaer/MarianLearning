/**
 * The extended kinds never record an answer an older build's progress
 * guard rejects.
 *
 * Builds before content wave 3's G accept `perProblemAnswerValue` entries
 * in 0..99 only; one recorded 100 makes the whole doc fail `isProgressV1`
 * there, and it loads as a fresh start (all progress lost). This build's
 * guard reads any whole number from 0 up, but writes nothing above 99 until
 * the hundreds PR raises the cap (`design/native/content-wave-3.md` § 2,
 * G4). The tapped chip is what gets recorded, so: a problem whose answer is
 * above 99 goes to the static fallback (the parser throws), and no chip is
 * above 99.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultProgress, isProgressV1, loadProgress } from '../progress'
import { recordProgressOnSessionEnd } from '../sessionEnd/progressHistory'
import { extendedDistractors, multiplyChipCeiling } from './extendedDistractors'
import {
  EXTENDED_ANSWER_MAX,
  type ExtendedMathProblem,
} from './extendedProblems'
import {
  PlanFromServerError,
  mathSessionPlanFromServer,
  parseSkipCountRead,
} from './planFromServer'

/** A server plan: one read line per problem, other slots stubbed. */
function serverPlan(reads: readonly string[]) {
  return {
    id: 'range',
    label: 'Range',
    utterances: reads.flatMap((read, i) =>
      ['read', 'correct', 'reprompt', 'hint', 'giveAnswer'].map((slot) => ({
        id: `math.p${i + 1}.${slot}`,
        text: slot === 'read' ? read : `${slot} ${i + 1}`,
      })),
    ),
  }
}

describe('answers above 99 go to the fallback', () => {
  it('EXTENDED_ANSWER_MAX stays 99 until the hundreds PR', () => {
    expect(EXTENDED_ANSWER_MAX).toBe(99)
  })

  it.each([
    ['skip count to 100', 'Seventy, eighty, ninety. What is next?', 100],
    [
      'skip count to 100 by fives',
      'Eighty-five, ninety, ninety-five. What is next?',
      100,
    ],
    ['ten times ten', 'Ten times ten. How many?', 100],
    ['nine times twelve', 'Nine times twelve. How many?', 108],
  ])('%s: the plan throws (static fallback)', (_label, read, answer) => {
    const reads = Array.from({ length: 8 }, () => 'Two times two. How many?')
    reads[6] = read
    expect(() =>
      mathSessionPlanFromServer(serverPlan(reads), { extendedKinds: true }),
    ).toThrow(PlanFromServerError)
    expect(() =>
      mathSessionPlanFromServer(serverPlan(reads), { extendedKinds: true }),
    ).toThrow(`has the answer ${answer}, above 99`)
  })

  it('99 itself still parses', () => {
    expect(
      parseSkipCountRead('Ninety, ninety-three, ninety-six. What is next?'),
    ).toEqual({
      sequence: [90, 93, 96],
      step: 3,
      next: 99,
    })
    const plan = mathSessionPlanFromServer(
      serverPlan(
        Array.from({ length: 8 }, (_, i) =>
          i === 7 ? 'Nine times eleven. How many?' : 'Two times two. How many?',
        ),
      ),
      { extendedKinds: true },
    )
    expect(plan.problems[7]!.correct).toBe(99)
  })
})

describe('no chip above 99', () => {
  /** Plans at the top of the range, every problem index. */
  const reads = [
    'Ninety, ninety-three, ninety-six. What is next?', // 99, step 3
    'Eighty, eighty-five, ninety. What is next?', // 95, +5 = 100 repaired
    'Seventy-five, eighty, eighty-five, ninety. What is next?', // 95
    'Nine times eleven. How many?', // 99
    'Nine times ten. How many?', // 90
    'Eleven times nine. How many?', // 99
    'Ninety-six, ninety-seven, ninety-eight. What is next?', // 99, step 1
    'Ten times nine. How many?', // 90
  ]
  const problems = mathSessionPlanFromServer(serverPlan(reads), {
    extendedKinds: true,
  }).problems as readonly Exclude<
    ExtendedMathProblem,
    { kind: 'arithmetic' | 'missing-addend' }
  >[]
  const ceiling = multiplyChipCeiling(
    problems.filter((p) => p.kind === 'multiply').map((p) => p.correct),
  )

  it('the multiply ceiling caps at 99', () => {
    expect(ceiling).toBe(99)
  })

  it.each(problems.map((p) => [p.index, p] as const))(
    'P%i: answer and both wrong chips are 1..99',
    (_i, p) => {
      const chips = [p.correct, ...extendedDistractors(p, ceiling)]
      expect(chips.filter((c) => c < 1 || c > 99)).toEqual([])
      expect(new Set(chips).size).toBe(3)
    },
  )
})

describe('a recorded top chip survives the progress guard', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('99s are kept; this guard also reads a 100 (G), older builds do not', () => {
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: '2026-10-14T12:00:00.000Z',
      focusNode: 'skip-counting',
      perProblemAnswerValue: [99, 98, 99, 96, 91, 99, 99, 90],
    })
    const after = loadProgress()
    expect(after).not.toBeNull()
    expect(after!.history[0]!.perProblemAnswerValue).toEqual([
      99, 98, 99, 96, 91, 99, 99, 90,
    ])

    const withAnswers = (values: number[]) => ({
      ...defaultProgress(),
      history: [{ ...after!.history[0]!, perProblemAnswerValue: values }],
    })
    expect(isProgressV1(withAnswers([99, 98, 99, 96, 91, 99, 99, 90]))).toBe(
      true,
    )
    expect(isProgressV1(withAnswers([100, 98, 99, 96, 91, 99, 99, 90]))).toBe(
      true,
    )
  })
})
