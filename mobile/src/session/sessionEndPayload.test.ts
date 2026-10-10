import { STATIC_SESSION_PLANS } from '@marian/core/math/sessionPlans'
import type { MathSessionResult } from '../screens/math/mathTypes'
import { mathSessionEndPayload } from './sessionEndPayload'

const RESULT: MathSessionResult = {
  totalCorrect: 7,
  totalStardust: 41,
  finalStreak: 3,
  earnedThisSession: 9,
  perProblemCorrect: [true, true, false, true, true, true, true, true],
  latencyMs: [900, -1, 1200, 800, 700, 650, 640, 600],
  subitisingScaffoldRendered: false,
  subitisingScaffoldSubRendered: false,
  perProblemAnswerValue: [5, 4, 7, 9, 3, 8, 6, 10],
  perProblemDistractorClass: [
    null,
    null,
    null,
    'off-by-one',
    'off-by-one',
    'off-by-one',
    'off-by-one',
    'off-by-one',
  ],
}

it('builds the web handleMathComplete payload', () => {
  const plan = STATIC_SESSION_PLANS[0]
  const payload = mathSessionEndPayload(RESULT, plan, {
    node: 'add-to-10',
    mode: 'forward',
  })
  expect(payload).toEqual({
    totalCorrect: 7,
    totalStardust: 41,
    finalStreak: 3,
    earnedThisSession: 9,
    surface: 'math',
    perProblemCorrect: RESULT.perProblemCorrect,
    latencyMs: RESULT.latencyMs,
    mathFacts: plan.problems.map((p) => ({
      a: p.addendA,
      b: p.addendB,
      op: p.op,
    })),
    perProblemAnswerValue: RESULT.perProblemAnswerValue,
    perProblemDistractorClass: RESULT.perProblemDistractorClass,
    sessionFocus: { node: 'add-to-10', mode: 'forward' },
  })
})

it('carries the scaffold flags only when true, and no focus without one', () => {
  const payload = mathSessionEndPayload(
    { ...RESULT, subitisingScaffoldRendered: true },
    null,
    null,
  )
  expect(payload.subitisingScaffoldRendered).toBe(true)
  expect(payload).not.toHaveProperty('subitisingScaffoldSubRendered')
  expect(payload).not.toHaveProperty('mathFacts')
  expect(payload).not.toHaveProperty('sessionFocus')
})
