import { describe, expect, it } from 'vitest'
import {
  PlanFromServerError,
  mathSessionPlanFromServer,
  parseReadAddends,
} from './planFromServer'
import {
  mathSessionPlanToUtteranceSources,
  STATIC_SESSION_PLANS,
} from './sessionPlans'

/** Build a server-shaped plan from one of the static plans — same id/label,
 *  same utterances. The point of these helpers is to exercise round-trip
 *  semantics: server-output (the flat shape) → planFromServer → nested
 *  shape that matches the static plan we started with. */
function staticPlanAsServerShape(planIndex = 0) {
  const plan = STATIC_SESSION_PLANS[planIndex]!
  return {
    id: plan.id,
    label: plan.label,
    utterances: mathSessionPlanToUtteranceSources(plan).map((u) => ({
      id: u.id,
      text: u.text,
    })),
  }
}

describe('parseReadAddends', () => {
  it('parses canonical "Three plus two. How many?"', () => {
    expect(parseReadAddends('Three plus two. How many?')).toEqual({
      addendA: 3,
      addendB: 2,
    })
  })

  it('is case-insensitive on the leading word', () => {
    expect(parseReadAddends('three plus two. How many?')).toEqual({
      addendA: 3,
      addendB: 2,
    })
  })

  it('accepts all 1..10 number words', () => {
    expect(parseReadAddends('One plus ten. How many?')).toEqual({
      addendA: 1,
      addendB: 10,
    })
    expect(parseReadAddends('Nine plus four. How many?')).toEqual({
      addendA: 9,
      addendB: 4,
    })
  })

  it('throws on non-template lines', () => {
    expect(() => parseReadAddends('What is three plus two?')).toThrow(
      PlanFromServerError,
    )
  })

  it('throws on unknown number words', () => {
    expect(() => parseReadAddends('Eleven plus two. How many?')).toThrow(
      PlanFromServerError,
    )
  })
})

describe('mathSessionPlanFromServer — happy path', () => {
  it('rebuilds a MathSessionPlan that matches the static plan it was derived from', () => {
    const wire = staticPlanAsServerShape(0)
    const rebuilt = mathSessionPlanFromServer(wire)
    const original = STATIC_SESSION_PLANS[0]!

    expect(rebuilt.id).toBe(original.id)
    expect(rebuilt.label).toBe(original.label)
    expect(rebuilt.problems).toHaveLength(8)
    for (let i = 0; i < 8; i++) {
      const got = rebuilt.problems[i]!
      const want = original.problems[i]!
      expect(got.index).toBe(want.index)
      expect(got.addendA).toBe(want.addendA)
      expect(got.addendB).toBe(want.addendB)
      expect(got.correct).toBe(want.correct)
      expect(got.utterances).toEqual(want.utterances)
    }
  })

  it('preserves the server-supplied id/label even when they differ from any static plan', () => {
    const wire = {
      ...staticPlanAsServerShape(0),
      id: 'haiku-generated-plan',
      label: 'Math Level 1: Sums to 10',
    }
    const rebuilt = mathSessionPlanFromServer(wire)
    expect(rebuilt.id).toBe('haiku-generated-plan')
    expect(rebuilt.label).toBe('Math Level 1: Sums to 10')
  })
})

describe('mathSessionPlanFromServer — failure paths', () => {
  it('throws when the blob is the wrong shape', () => {
    expect(() => mathSessionPlanFromServer(null)).toThrow(PlanFromServerError)
    expect(() => mathSessionPlanFromServer({})).toThrow(PlanFromServerError)
    expect(() =>
      mathSessionPlanFromServer({ id: 'x', label: 'y', utterances: [{}] }),
    ).toThrow(PlanFromServerError)
  })

  it('throws when an utterance id misses the math.p<N>.<slot> template', () => {
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: [
        { id: 'not-the-template', text: 'whatever' },
        ...wire.utterances.slice(1),
      ],
    }
    expect(() => mathSessionPlanFromServer(broken)).toThrow(
      /math\.p<N>\.<slot>/,
    )
  })

  it('throws when a problem is missing entirely', () => {
    const wire = staticPlanAsServerShape(0)
    // Drop every utterance for problem 4.
    const broken = {
      ...wire,
      utterances: wire.utterances.filter((u) => !u.id.startsWith('math.p4.')),
    }
    expect(() => mathSessionPlanFromServer(broken)).toThrow(
      /missing problem index 4/,
    )
  })

  it('throws when a slot is missing for a problem', () => {
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: wire.utterances.filter((u) => u.id !== 'math.p2.hint'),
    }
    expect(() => mathSessionPlanFromServer(broken)).toThrow(
      /missing slot "hint"/,
    )
  })

  it('throws when the read line drifts off template', () => {
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: wire.utterances.map((u) =>
        u.id === 'math.p1.read'
          ? { ...u, text: 'How many is three plus two?' }
          : u,
      ),
    }
    expect(() => mathSessionPlanFromServer(broken)).toThrow(/template/)
  })
})
