import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  extendedDistractors,
  multiplyChipCeiling,
} from '@marian/core/math/extendedDistractors'
import type { ExtendedMathProblem } from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { REPO_ROOT } from '../../../test/webSource'
import { countSpokenFactor, NUMBER_STRIP_LANDMARK } from './extendedHints'
import { buildExtendedChipOrder } from './extendedChipOrder'

function canon(node: string): readonly ExtendedMathProblem[] {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', `${node}.json`),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, { extendedKinds: true }).problems
}

const NODES = [
  'number-recog',
  'skip-counting',
  'mult-2-5-10',
  'mult-3-4',
  'mult-6-9',
] as const

describe.each(NODES)('buildExtendedChipOrder — %s canon', (node) => {
  const problems = canon(node)
  const ceiling = multiplyChipCeiling(
    problems.filter((p) => p.kind === 'multiply').map((p) => p.correct),
  )

  it('3 distinct chips: the answer + core’s two, the same order every time', () => {
    for (const p of problems) {
      if (p.kind === 'arithmetic' || p.kind === 'missing-addend')
        throw new Error('arithmetic in canon')
      const { values } = buildExtendedChipOrder(p, ceiling)
      expect(values).toHaveLength(3)
      expect([...values].sort((a, b) => a - b)).toEqual(
        [p.correct, ...extendedDistractors(p, ceiling)].sort((a, b) => a - b),
      )
      expect(buildExtendedChipOrder(p, ceiling).values).toEqual(values)
    }
  })

  it('offers nothing on P1–P3, its class on P4–P8', () => {
    const classes = problems.map((p) => {
      if (p.kind === 'arithmetic' || p.kind === 'missing-addend')
        throw new Error('arithmetic in canon')
      return buildExtendedChipOrder(p, ceiling).offeredClass
    })
    const offered =
      node === 'number-recog'
        ? 'off-by-one'
        : node === 'skip-counting'
          ? 'count-by-one'
          : 'wrong-op'
    expect(classes).toEqual([null, null, null, ...Array(5).fill(offered)])
  })
})

describe('countSpokenFactor (hint 2 lights plate k at the k-th number)', () => {
  it.each([
    ['Two, then two, then two.', 2, 3, [1, 1, 2, 2, 3]],
    ['Two and two more.', 2, 2, [1, 1, 2, 2]],
    ['One group of five.', 5, 1, [0, 0, 0, 1]],
    ['Seven, then seven, then seven.', 7, 3, [1, 1, 2, 2, 3]],
    ['Five, five, five, five.', 5, 4, [1, 2, 3, 4]],
  ])('%s', (text, a, b, byWord) => {
    expect(byWord.map((_, i) => countSpokenFactor(text, i + 1, a, b))).toEqual(
      byWord,
    )
  })

  it('never lights more than factorB plates', () => {
    expect(countSpokenFactor('One group of one.', 4, 1, 1)).toBe(1)
  })
})

describe('NUMBER_STRIP_LANDMARK', () => {
  it('names the cell each canon hint 2 mentions', () => {
    const lines = canon('number-recog').map((p) => [
      p.correct,
      p.utterances.hint2,
    ])
    expect(
      lines.map(([target, line]) => [
        line,
        NUMBER_STRIP_LANDMARK[target as number],
      ]),
    ).toEqual([
      ['One is the smallest.', 1],
      ['Three comes after two.', 2],
      ['Five is in the middle.', 5],
      ['Two comes right after one.', 1],
      ['Seven is bigger than five.', 5],
      ['Four comes after three.', 3],
      ['Nine is close to ten.', 10],
      ['Six comes after five.', 5],
    ])
  })
})
