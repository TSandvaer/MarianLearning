import { resolve } from 'node:path'
import {
  STATIC_ADD_TO_20_PLANS,
  STATIC_SESSION_PLANS,
} from '@marian/core/math/sessionPlans'
import { chipMaxAnswerForCorrects } from '@marian/core/math/distractors'
import { functionSource, REPO_ROOT } from '../../../test/webSource'
import { buildChipOrder } from './chipOrder'

const WEB_MATH = resolve(REPO_ROOT, 'src', 'screens', 'Math', 'Math.tsx')

describe('buildChipOrder is the web copy', () => {
  it.each(['buildChipOrder', 'lcg'])(
    '%s matches src/screens/Math/Math.tsx',
    (name) => {
      expect(functionSource(resolve(__dirname, 'chipOrder.ts'), name)).toBe(
        functionSource(WEB_MATH, name),
      )
    },
  )
})

describe('buildChipOrder', () => {
  const plans = [...STATIC_SESSION_PLANS, ...STATIC_ADD_TO_20_PLANS]

  it.each(plans.map((p) => [p.id, p] as const))(
    '%s: 3 distinct chips, one correct, the same order every time',
    (_id, plan) => {
      const max = chipMaxAnswerForCorrects(plan.problems.map((p) => p.correct))
      for (const problem of plan.problems) {
        const { values } = buildChipOrder(problem, max)
        expect(values).toHaveLength(3)
        expect(new Set(values).size).toBe(3)
        expect(values.filter((v) => v === problem.correct)).toHaveLength(1)
        expect(buildChipOrder(problem, max).values).toEqual(values)
      }
    },
  )

  it('offers no trap on P1–P3 and off-by-one on P4–P8 (add tiers)', () => {
    const plan = STATIC_SESSION_PLANS[0]
    const classes = plan.problems.map(
      (p) => buildChipOrder(p, 10, 'add-to-10').offeredClass,
    )
    expect(classes).toEqual([
      null,
      null,
      null,
      'off-by-one',
      'off-by-one',
      'off-by-one',
      'off-by-one',
      'off-by-one',
    ])
  })

  it('offers wrong-op on sub-to-10 subtraction from P4', () => {
    const problem = {
      index: 5,
      addendA: 7,
      addendB: 3,
      correct: 4,
      op: '-' as const,
      utterances: {
        read: 'Seven minus three. How many are left?',
        correct: 'Yes! Four!',
        reprompt: 'Hmm... try again?',
        hint: 'Look. Seven. Take away three.',
        giveAnswer: 'This one is four.',
      },
    }
    expect(buildChipOrder(problem, 10, 'sub-to-10').offeredClass).toBe(
      'wrong-op',
    )
  })
})
