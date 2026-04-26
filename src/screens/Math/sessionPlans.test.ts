import { describe, expect, it } from 'vitest'
import {
  STATIC_SESSION_PLANS,
  mathSessionPlanFromWire,
  mathSessionPlanToUtteranceSources,
  mathUtteranceId,
  pickStaticSessionPlan,
  type MathSessionPlan,
  type MathUtteranceSlot,
} from './sessionPlans'
import type { Utterance } from '../../../api/_types'

const ALL_SLOTS: readonly MathUtteranceSlot[] = [
  'read',
  'correct',
  'reprompt',
  'hint',
  'giveAnswer',
]

/** Build a fake `Utterance` for tests — audio is a dummy 1-byte payload. */
function fakeUtterance(id: string, text: string): Utterance {
  return {
    id,
    text,
    audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
  }
}

describe('mathUtteranceId', () => {
  it('emits canonical math.p{N}.{slot} ids per the design spec', () => {
    expect(mathUtteranceId(1, 'read')).toBe('math.p1.read')
    expect(mathUtteranceId(8, 'giveAnswer')).toBe('math.p8.giveAnswer')
    expect(mathUtteranceId(3, 'reprompt')).toBe('math.p3.reprompt')
  })
})

describe('mathSessionPlanToUtteranceSources', () => {
  it('flattens every problem × slot into the wire shape', () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const sources = mathSessionPlanToUtteranceSources(plan)

    // 8 problems × 5 slots = 40 utterances.
    expect(sources).toHaveLength(plan.problems.length * ALL_SLOTS.length)
  })

  it('emits problem-major, slot-order sequence (stable for server fan-out)', () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const sources = mathSessionPlanToUtteranceSources(plan)

    // First 5 entries are problem 1's slots in canonical order.
    expect(sources.slice(0, 5).map((s) => s.id)).toEqual([
      'math.p1.read',
      'math.p1.correct',
      'math.p1.reprompt',
      'math.p1.hint',
      'math.p1.giveAnswer',
    ])
    // Last 5 are problem 8's.
    expect(sources.slice(-5).map((s) => s.id)).toEqual([
      'math.p8.read',
      'math.p8.correct',
      'math.p8.reprompt',
      'math.p8.hint',
      'math.p8.giveAnswer',
    ])
  })

  it('carries each problem-slot text exactly as authored in the plan', () => {
    const plan = STATIC_SESSION_PLANS[0]!
    const sources = mathSessionPlanToUtteranceSources(plan)
    const byId = new Map(sources.map((s) => [s.id, s.text]))

    for (const problem of plan.problems) {
      for (const slot of ALL_SLOTS) {
        const expected = problem.utterances[slot]
        const actual = byId.get(mathUtteranceId(problem.index, slot))
        expect(actual).toBe(expected)
      }
    }
  })

  it('produces unique ids across the whole plan (no collisions)', () => {
    for (const plan of STATIC_SESSION_PLANS) {
      const sources = mathSessionPlanToUtteranceSources(plan)
      const ids = sources.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('mathSessionPlanFromWire', () => {
  it('rehydrates a plan when every expected utterance id is present', () => {
    const skeleton = STATIC_SESSION_PLANS[0]!
    const sources = mathSessionPlanToUtteranceSources(skeleton)
    const utterances = sources.map((s) => fakeUtterance(s.id, s.text))

    const rehydrated = mathSessionPlanFromWire(skeleton, utterances)

    // Same skeleton metadata.
    expect(rehydrated.id).toBe(skeleton.id)
    expect(rehydrated.label).toBe(skeleton.label)
    expect(rehydrated.problems).toHaveLength(skeleton.problems.length)

    // Math metadata preserved per problem.
    for (let i = 0; i < skeleton.problems.length; i++) {
      const orig = skeleton.problems[i]!
      const reh = rehydrated.problems[i]!
      expect(reh.index).toBe(orig.index)
      expect(reh.addendA).toBe(orig.addendA)
      expect(reh.addendB).toBe(orig.addendB)
      expect(reh.correct).toBe(orig.correct)
      // Slot text round-trips when wire == skeleton.
      for (const slot of ALL_SLOTS) {
        expect(reh.utterances[slot]).toBe(orig.utterances[slot])
      }
    }
  })

  it('round-trips: skeleton → wire → rehydrate produces a structurally equal plan', () => {
    const skeleton = STATIC_SESSION_PLANS[1]!
    const sources = mathSessionPlanToUtteranceSources(skeleton)
    const utterances = sources.map((s) => fakeUtterance(s.id, s.text))
    const rehydrated = mathSessionPlanFromWire(skeleton, utterances)

    // Use a JSON snapshot — fields and values, not reference equality.
    expect(JSON.stringify(rehydrated)).toBe(JSON.stringify(skeleton))
  })

  it('lets the WIRE text override the skeleton text (server is source of truth)', () => {
    // If the server normalised the text (e.g. typographic punctuation),
    // captions must mirror what was actually synthesized.
    const skeleton = STATIC_SESSION_PLANS[0]!
    const sources = mathSessionPlanToUtteranceSources(skeleton)
    const utterances = sources.map((s) =>
      s.id === 'math.p1.read'
        ? fakeUtterance(s.id, 'Three plus two—how many?') // server tweak
        : fakeUtterance(s.id, s.text),
    )
    const rehydrated = mathSessionPlanFromWire(skeleton, utterances)
    expect(rehydrated.problems[0]!.utterances.read).toBe(
      'Three plus two—how many?',
    )
    // Other slots untouched.
    expect(rehydrated.problems[0]!.utterances.correct).toBe(
      skeleton.problems[0]!.utterances.correct,
    )
  })

  it('throws when an expected utterance id is missing from the wire response', () => {
    const skeleton = STATIC_SESSION_PLANS[0]!
    const sources = mathSessionPlanToUtteranceSources(skeleton)
    // Drop a single utterance — simulate a partial server response.
    const incomplete = sources
      .filter((s) => s.id !== 'math.p4.hint')
      .map((s) => fakeUtterance(s.id, s.text))

    expect(() => mathSessionPlanFromWire(skeleton, incomplete)).toThrow(
      /missing utterance "math\.p4\.hint"/,
    )
  })

  it('ignores extraneous utterance ids beyond the plan (forward-compat)', () => {
    // Server may render bonus lines (e.g. greeting on session start) that
    // aren't part of the per-problem plan. The adapter should still rehydrate
    // every plan slot it knows about.
    const skeleton = STATIC_SESSION_PLANS[2]!
    const sources = mathSessionPlanToUtteranceSources(skeleton)
    const utterances = sources.map((s) => fakeUtterance(s.id, s.text))
    utterances.push(fakeUtterance('session.greeting', 'Hi Marian!'))

    const rehydrated = mathSessionPlanFromWire(skeleton, utterances)
    expect(rehydrated.problems).toHaveLength(skeleton.problems.length)
  })
})

describe('pickStaticSessionPlan rotation (regression)', () => {
  // Sanity-check that the existing rotation still works after the file's
  // header rewrite — guards against accidental drift in the public surface.
  it('returns a deterministic plan for a fixed time', () => {
    const fixedTime = new Date('2026-04-26T12:00:00Z')
    const a = pickStaticSessionPlan(() => fixedTime)
    const b = pickStaticSessionPlan(() => fixedTime)
    expect(a).toBe(b)
  })

  it('cycles through all three slots over consecutive minutes', () => {
    const seen = new Set<string>()
    for (let m = 0; m < 6; m++) {
      const t = new Date(`2026-04-26T12:0${m}:00Z`)
      seen.add(pickStaticSessionPlan(() => t).id)
    }
    expect(seen.size).toBe(STATIC_SESSION_PLANS.length)
  })

  it('returns a plan with the expected MathSessionPlan shape', () => {
    const plan: MathSessionPlan = pickStaticSessionPlan(() => new Date(0))
    expect(plan.problems).toHaveLength(8)
    for (const p of plan.problems) {
      expect(p.correct).toBe(p.addendA + p.addendB)
      expect(p.utterances.read).toMatch(/plus/)
    }
  })
})
