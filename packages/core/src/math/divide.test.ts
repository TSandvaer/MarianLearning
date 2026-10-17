/**
 * Sharing's read line and plan (content wave 2,
 * `design/native/content-wave-2.md` § 2.6, AC 1): "Twelve flowers, three
 * plates. How many on each plate?" is a `divide` problem in the opt-in
 * extended plan, and nothing in the default (web) parse.
 *
 * Failing-first: written before the kind existed, so it reads the problem
 * through a structural cast instead of `DivideProblem`.
 */
import { describe, expect, it } from 'vitest'
import {
  mathSessionPlanFromServer,
  PlanFromServerError,
} from './planFromServer'

const SLOTS = [
  'read',
  'correct',
  'reprompt',
  'hint1',
  'hint2',
  'hint3',
  'giveAnswer',
] as const

/** A plan whose 8 problems all read `read` (the other slots are fixed). */
function planReading(read: string): unknown {
  return {
    id: 'canon-div-share',
    label: 'Sharing',
    utterances: Array.from({ length: 8 }, (_, i) =>
      SLOTS.map((slot) => ({
        id: `math.p${i + 1}.${slot}`,
        text: slot === 'read' ? read : 'Hmm... try again?',
      })),
    ).flat(),
  }
}

interface DivideShape {
  kind: string
  index: number
  total: number
  plates: number
  correct: number
}

describe('the sharing read (§ 2.6, AC 1)', () => {
  it('"Twelve flowers, three plates. How many on each plate?" → divide 12 / 3 = 4', () => {
    const plan = mathSessionPlanFromServer(
      planReading('Twelve flowers, three plates. How many on each plate?'),
      { extendedKinds: true },
    )
    const p = plan.problems[0] as unknown as DivideShape
    expect({
      kind: p.kind,
      total: p.total,
      plates: p.plates,
      correct: p.correct,
    }).toEqual({ kind: 'divide', total: 12, plates: 3, correct: 4 })
    expect(plan.problems.map((q) => q.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it.each([
    [
      'seven on two (uneven)',
      'Seven flowers, two plates. How many on each plate?',
    ],
    [
      'twelve on six (more than 5 plates)',
      'Twelve flowers, six plates. How many on each plate?',
    ],
    [
      'thirty on three (more than 20 flowers)',
      'Thirty flowers, three plates. How many on each plate?',
    ],
  ])('rejects %s', (_name, read) => {
    expect(() =>
      mathSessionPlanFromServer(planReading(read), { extendedKinds: true }),
    ).toThrow(PlanFromServerError)
  })

  it('throws without extendedKinds (the frozen web keeps its silent fallback)', () => {
    expect(() =>
      mathSessionPlanFromServer(
        planReading('Twelve flowers, three plates. How many on each plate?'),
      ),
    ).toThrow(PlanFromServerError)
  })
})
