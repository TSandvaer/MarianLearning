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

  it('skips utterances with ids outside the math.p<N>.<slot> namespace, but still rejects when that leaves a slot missing', () => {
    // Replace math.p1.read with an out-of-namespace id. Under the
    // skip-not-throw contract the parser ignores it, but problem 1's
    // `read` slot is now genuinely missing — which the completeness
    // check still catches with the clearer "missing slot" error.
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: [
        { id: 'not-the-template', text: 'whatever' },
        ...wire.utterances.slice(1),
      ],
    }
    expect(() => mathSessionPlanFromServer(broken)).toThrow(
      /missing slot "read"/,
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

// Regression tests for ticket 86c9kj2u6 — the planner now also emits
// `session.end.*` utterances (and may emit other cross-screen families
// later). Per the skip-not-throw contract documented in the file header,
// the parser must ignore those without affecting the per-problem plan.
describe('mathSessionPlanFromServer — skip-not-throw on out-of-namespace ids (86c9kj2u6)', () => {
  /** The 19 session.end.* ids that the planner emits today (1 opener +
   *  11 recap.N + 6 streak.N + 1 goodbye). Texts are placeholders; the
   *  parser only inspects ids. */
  const SESSION_END_UTTERANCES: ReadonlyArray<{ id: string; text: string }> = [
    { id: 'session.end.opener', text: 'You did it!' },
    ...Array.from({ length: 11 }, (_, i) => ({
      id: `session.end.recap.${i + 1}`,
      text: `recap-${i + 1}`,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `session.end.streak.${i + 3}`,
      text: `streak-${i + 3}`,
    })),
    { id: 'session.end.goodbye', text: 'See you soon.' },
  ]

  it('returns the same plan whether or not session.end.* ids are present', () => {
    const baseline = staticPlanAsServerShape(0)
    const additive = {
      ...baseline,
      utterances: [...baseline.utterances, ...SESSION_END_UTTERANCES],
    }
    expect(additive.utterances.length).toBe(40 + 19)
    const fromBaseline = mathSessionPlanFromServer(baseline)
    const fromAdditive = mathSessionPlanFromServer(additive)
    // Structural equality — ids/labels, problem indexes, addends, sums,
    // and per-problem slot text all preserved.
    expect(fromAdditive).toEqual(fromBaseline)
  })

  it('still rejects malformed-but-namespaced ids by surfacing the missing-slot error downstream', () => {
    // `math.p1.bogus` is in the math.* namespace but its slot doesn't
    // match read|correct|reprompt|hint|giveAnswer. Under skip-not-throw
    // it's dropped from the bucket; problem 1 then has a missing slot
    // (whichever real slot we replaced) and the completeness check
    // throws the clearer message. This pins the contract: out-of-
    // namespace ids no longer throw early, but malformed ones don't
    // silently produce a corrupted plan either.
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: wire.utterances.map((u) =>
        u.id === 'math.p1.read' ? { id: 'math.p1.bogus', text: u.text } : u,
      ),
    }
    expect(() => mathSessionPlanFromServer(broken)).toThrow(PlanFromServerError)
    expect(() => mathSessionPlanFromServer(broken)).toThrow(
      /missing slot "read"/,
    )
  })
})
