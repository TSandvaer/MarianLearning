/**
 * The extended chip pickers against the committed canon (spec
 * `design/native/math-skip-counting-multiplication-native.md` § 4 and § 10
 * list every canon value), plus the edge rules the canon never reaches.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  extendedDistractors,
  extendedOfferedClass,
  multiplyChipCeiling,
  multiplyDistractors,
  skipCountDistractors,
} from './extendedDistractors'
import {
  isMultiplyProblem,
  isNumberRecogProblem,
  isSkipCountProblem,
  type ExtendedMathProblem,
  type MultiplyProblem,
  type SkipCountProblem,
} from './extendedProblems'
import { mathSessionPlanFromServer } from './planFromServer'
import type { MathProblemUtterances } from './sessionPlans'

const CANON_DIR = join(process.cwd(), 'public', 'canon', 'math', 'level-1')

function canonProblems(node: string): readonly ExtendedMathProblem[] {
  const canon = JSON.parse(
    readFileSync(join(CANON_DIR, `${node}.json`), 'utf8'),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(canon.plan, { extendedKinds: true }).problems
}

const U: MathProblemUtterances = {
  read: '',
  correct: '',
  reprompt: '',
  giveAnswer: '',
  hint: '',
}

function multiply(
  index: number,
  factorA: number,
  factorB: number,
): MultiplyProblem {
  return {
    kind: 'multiply',
    index,
    factorA,
    factorB,
    correct: factorA * factorB,
    utterances: U,
  }
}

function skip(index: number, sequence: number[]): SkipCountProblem {
  const step = sequence[1]! - sequence[0]!
  return {
    kind: 'skip-count',
    index,
    sequence,
    step,
    correct: sequence[sequence.length - 1]! + step,
    utterances: U,
  }
}

describe('multiplyChipCeiling', () => {
  it.each([
    ['mult-2-5-10', 30],
    ['mult-3-4', 20],
    ['mult-6-9', 30],
  ])('%s → %i', (node, ceiling) => {
    const corrects = canonProblems(node).map((p) => p.correct)
    expect(multiplyChipCeiling(corrects)).toBe(ceiling)
  })

  it('leaves room for +1 at a round answer (20 → 30, 9 → 10)', () => {
    expect(multiplyChipCeiling([20])).toBe(30)
    expect(multiplyChipCeiling([9])).toBe(10)
    expect(multiplyChipCeiling([10])).toBe(20)
  })
})

/** [correct, [d1, d2]] per problem, in canon order (spec § 4 / § 10). */
const CANON_CHIPS: Record<string, [number, [number, number]][]> = {
  'number-recog': [
    [1, [3, 10]],
    [3, [1, 10]],
    [5, [1, 10]],
    [2, [1, 3]],
    [7, [6, 8]],
    [4, [3, 5]],
    [9, [8, 10]],
    [6, [5, 7]],
  ],
  'skip-counting': [
    [10, [2, 12]],
    [20, [5, 25]],
    [50, [10, 60]],
    [8, [7, 10]],
    [30, [26, 35]],
    [70, [61, 80]],
    [16, [15, 18]],
    [45, [41, 50]],
  ],
  'mult-2-5-10': [
    [4, [1, 30]],
    [5, [1, 30]],
    [10, [1, 30]],
    [6, [5, 7]],
    [10, [7, 9]],
    [10, [7, 11]],
    [20, [12, 19]],
    [20, [9, 21]],
  ],
  'mult-3-4': [
    [6, [1, 20]],
    [6, [1, 20]],
    [9, [1, 20]],
    [8, [6, 9]],
    [8, [6, 7]],
    [12, [7, 13]],
    [12, [7, 11]],
    [16, [8, 17]],
  ],
  'mult-6-9': [
    [12, [1, 30]],
    [14, [1, 30]],
    [16, [1, 30]],
    [18, [9, 19]],
    [21, [10, 20]],
    [18, [11, 19]],
    [24, [11, 23]],
    [27, [12, 28]],
  ],
}

describe.each(Object.keys(CANON_CHIPS))('canon chips — %s', (node) => {
  const problems = canonProblems(node)
  const ceiling = multiplyChipCeiling(
    problems.filter(isMultiplyProblem).map((p) => p.correct),
  )

  it('produces the spec values for all 8 problems', () => {
    expect(
      problems.map((p) => {
        if (p.kind === 'arithmetic' || p.kind === 'missing-addend')
          throw new Error('arithmetic in canon')
        return [p.correct, extendedDistractors(p, ceiling)]
      }),
    ).toEqual(CANON_CHIPS[node])
  })

  it('3 distinct chips per problem, none equal to the answer', () => {
    for (const p of problems) {
      if (p.kind === 'arithmetic' || p.kind === 'missing-addend')
        throw new Error('arithmetic in canon')
      const chips = [p.correct, ...extendedDistractors(p, ceiling)]
      expect(new Set(chips).size).toBe(3)
    }
  })
})

describe('the multiply answer is not "the biggest chip"', () => {
  it('across the 15 canon P4–P8 problems it is the biggest in 6, the middle in 9, never the smallest', () => {
    const place = { biggest: 0, middle: 0, smallest: 0 }
    for (const node of ['mult-2-5-10', 'mult-3-4', 'mult-6-9']) {
      const problems = canonProblems(node).filter(isMultiplyProblem)
      const ceiling = multiplyChipCeiling(problems.map((p) => p.correct))
      for (const p of problems.filter((q) => q.index >= 4)) {
        const [low, high] = multiplyDistractors(p, ceiling)
        if (p.correct > high) place.biggest += 1
        else if (p.correct < low) place.smallest += 1
        else place.middle += 1
      }
    }
    expect(place).toEqual({ biggest: 6, middle: 9, smallest: 0 })
  })
})

describe('extendedOfferedClass', () => {
  it.each([
    ['number-recog', 'off-by-one'],
    ['skip-counting', 'count-by-one'],
    ['mult-2-5-10', 'wrong-op'],
    ['mult-3-4', 'wrong-op'],
    ['mult-6-9', 'wrong-op'],
  ] as const)('%s: null on P1–P3, %s on P4–P8', (node, offered) => {
    const classes = canonProblems(node).map((p) => {
      if (p.kind === 'arithmetic' || p.kind === 'missing-addend')
        throw new Error('arithmetic in canon')
      return extendedOfferedClass(p)
    })
    expect(classes).toEqual([null, null, null, ...Array(5).fill(offered)])
  })

  it('keeps "wrong-op" when the trap falls back (2 × 2 on P4)', () => {
    expect(extendedOfferedClass(multiply(4, 2, 2))).toBe('wrong-op')
  })
})

describe('multiplyDistractors — rules the canon never reaches', () => {
  it('A + B equal to the answer (2 × 2) → pickDistractors off by one', () => {
    expect(multiplyDistractors(multiply(4, 2, 2), 10)).toEqual([3, 5])
  })

  it('A + B above the ceiling → pickDistractors off by one', () => {
    // 10 × 1 = 10 at a made-up ceiling of 10: the trap 11 does not fit.
    expect(multiplyDistractors(multiply(5, 10, 1), 10)).toEqual([8, 9])
  })

  it('a slip that collides with A + B takes the other sign', () => {
    // 3 × 1 = 3, trap 4; P4's +1 slip is 4 → the −1 slip, 2.
    expect(multiplyDistractors(multiply(4, 3, 1), 10)).toEqual([2, 4])
  })

  it('then ±2 when both ±1 are out (1 × 1: trap 2, slip 0 out, slip 2 = trap)', () => {
    expect(multiplyDistractors(multiply(5, 1, 1), 10)).toEqual([2, 3])
  })

  it('P4–P8 sign by position, not by the shuffle', () => {
    const slips = [4, 5, 6, 7, 8].map((index) => {
      const p = multiply(index, 6, 2) // 12, trap 8
      const [low, high] = multiplyDistractors(p, 30)
      return (low === 8 ? high : low) - p.correct
    })
    expect(slips).toEqual([1, -1, 1, -1, 1])
  })
})

describe('skipCountDistractors — repair', () => {
  it('a step of 1 makes last + 1 the answer → the last term instead', () => {
    expect(skipCountDistractors(skip(4, [3, 4, 5]))).toEqual([5, 7])
  })

  it('correct + step above 99 → the last term', () => {
    // 80, 85, 90 → 95; 100 is out (the 99 cap), so the last term, 90.
    expect(skipCountDistractors(skip(2, [80, 85, 90]))).toEqual([80, 90])
    expect(skipCountDistractors(skip(5, [80, 85, 90]))).toEqual([90, 91])
  })

  it('a repair that would repeat the other chip takes the first term', () => {
    // 96, 97, 98 → 99 on P4: last + 1 is the answer → the last term (98);
    // answer + step (100) is out → the last term is taken → the first term
    // (96).
    expect(skipCountDistractors(skip(4, [96, 97, 98]))).toEqual([96, 98])
  })

  it('canon kinds are told apart by their guards', () => {
    expect(canonProblems('skip-counting').every(isSkipCountProblem)).toBe(true)
    expect(canonProblems('number-recog').every(isNumberRecogProblem)).toBe(true)
  })
})
