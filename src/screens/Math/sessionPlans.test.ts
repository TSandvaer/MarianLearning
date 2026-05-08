import { describe, expect, it } from 'vitest'
import {
  STATIC_ADD_TO_20_PLANS,
  STATIC_SESSION_PLANS,
  mathSessionPlanFromWire,
  mathSessionPlanToUtteranceSources,
  mathUtteranceId,
  pickStaticAddTo20Plan,
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

describe('STATIC_SESSION_PLANS shape contract (regression — ticket 86c9gumhp)', () => {
  // Ticket 86c9gumhp item #2 closes the regression surface around the
  // hardcoded plans before Path A replaces them. The existing rotation tests
  // above only assert the picked plan; these assertions hold for every plan
  // in the rotation so a future "let me add a fourth plan" PR can't drift
  // off the sums-to-10 ceiling without tripping CI.

  it('ships at least one plan in the rotation', () => {
    expect(STATIC_SESSION_PLANS.length).toBeGreaterThan(0)
  })

  it('every plan has a unique id (rotation collision guard)', () => {
    const ids = STATIC_SESSION_PLANS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every plan has exactly 8 problems', () => {
    for (const plan of STATIC_SESSION_PLANS) {
      expect(
        plan.problems.length,
        `plan "${plan.id}" should have exactly 8 problems`,
      ).toBe(8)
    }
  })

  it("every problem's correct === addendA + addendB", () => {
    for (const plan of STATIC_SESSION_PLANS) {
      for (const problem of plan.problems) {
        expect(
          problem.correct,
          `plan "${plan.id}" problem ${problem.index}: ` +
            `correct (${problem.correct}) must equal addendA (${problem.addendA}) + addendB (${problem.addendB})`,
        ).toBe(problem.addendA + problem.addendB)
      }
    }
  })

  it('every problem stays within the sums-to-10 ceiling (correct ≤ 10)', () => {
    // Marian's documented ceiling per project_diagnostic_results.md is sums
    // to 10. The numberWord() table also tops out at 10 — drifting past 10
    // would either crash plan construction or (worse) silently produce an
    // unreadable utterance line.
    for (const plan of STATIC_SESSION_PLANS) {
      for (const problem of plan.problems) {
        expect(
          problem.correct,
          `plan "${plan.id}" problem ${problem.index}: ` +
            `correct (${problem.correct}) must be ≤ 10`,
        ).toBeLessThanOrEqual(10)
      }
    }
  })

  it('every problem has both addends in the range [1, 10]', () => {
    // Belt-and-braces: numberWord() throws on anything outside [1, 10], so a
    // plan that drifted to addendA=0 would crash at construction. Asserting
    // the range explicitly here makes the contract visible at the test level
    // rather than relying on an internal throw.
    for (const plan of STATIC_SESSION_PLANS) {
      for (const problem of plan.problems) {
        expect(
          problem.addendA,
          `plan "${plan.id}" problem ${problem.index}: addendA out of range`,
        ).toBeGreaterThanOrEqual(1)
        expect(
          problem.addendA,
          `plan "${plan.id}" problem ${problem.index}: addendA out of range`,
        ).toBeLessThanOrEqual(10)
        expect(
          problem.addendB,
          `plan "${plan.id}" problem ${problem.index}: addendB out of range`,
        ).toBeGreaterThanOrEqual(1)
        expect(
          problem.addendB,
          `plan "${plan.id}" problem ${problem.index}: addendB out of range`,
        ).toBeLessThanOrEqual(10)
      }
    }
  })

  it('every problem has 1-based index matching its position', () => {
    // Math.tsx and the wire adapter both rely on `problem.index` being the
    // 1-based position; if a future plan author skips an index or re-uses
    // one, `mathUtteranceId` would emit colliding ids.
    for (const plan of STATIC_SESSION_PLANS) {
      for (let i = 0; i < plan.problems.length; i++) {
        expect(
          plan.problems[i]!.index,
          `plan "${plan.id}" position ${i}: index should be ${i + 1}`,
        ).toBe(i + 1)
      }
    }
  })
})

// ── Add-to-20 (ticket 86c9q5q13) ─────────────────────────────────────────

describe('STATIC_ADD_TO_20_PLANS shape contract (ticket 86c9q5q13)', () => {
  // Sibling rotation for the add-to-20 tier. Same shape contract as
  // STATIC_SESSION_PLANS, but with sums constrained to [11, 20] — never
  // <=10 (that's add-to-10's territory) and never >20 (downstream tier).

  it('ships at least one plan in the rotation', () => {
    expect(STATIC_ADD_TO_20_PLANS.length).toBeGreaterThan(0)
  })

  it('ships at least 2 rotation slots so consecutive sessions vary', () => {
    // Per the ticket AC #1: "at least 2 (recommend 3) rotations".
    expect(STATIC_ADD_TO_20_PLANS.length).toBeGreaterThanOrEqual(2)
  })

  it('every plan has a unique id (rotation collision guard)', () => {
    const ids = STATIC_ADD_TO_20_PLANS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every plan id is distinct from STATIC_SESSION_PLANS (cross-tier collision guard)', () => {
    const tier10Ids = new Set(STATIC_SESSION_PLANS.map((p) => p.id))
    for (const plan of STATIC_ADD_TO_20_PLANS) {
      expect(tier10Ids.has(plan.id)).toBe(false)
    }
  })

  it('every plan has exactly 8 problems', () => {
    for (const plan of STATIC_ADD_TO_20_PLANS) {
      expect(
        plan.problems.length,
        `plan "${plan.id}" should have exactly 8 problems`,
      ).toBe(8)
    }
  })

  it("every problem's correct === addendA + addendB", () => {
    for (const plan of STATIC_ADD_TO_20_PLANS) {
      for (const problem of plan.problems) {
        expect(
          problem.correct,
          `plan "${plan.id}" problem ${problem.index}: ` +
            `correct (${problem.correct}) must equal addendA (${problem.addendA}) + addendB (${problem.addendB})`,
        ).toBe(problem.addendA + problem.addendB)
      }
    }
  })

  it('every problem sum is in [11, 20] (never the add-to-10 tier, never beyond 20)', () => {
    // The pedagogical heart of add-to-20: every problem MUST stretch
    // Marian past sums-to-10, but must not jump beyond Marian's
    // documented add-to-20 ceiling. A plan that drifted to sum=10 would
    // belong on the add-to-10 rotation; a plan that drifted to sum=21+
    // would belong on a downstream tier.
    for (const plan of STATIC_ADD_TO_20_PLANS) {
      for (const problem of plan.problems) {
        expect(
          problem.correct,
          `plan "${plan.id}" problem ${problem.index}: correct must be >= 11`,
        ).toBeGreaterThanOrEqual(11)
        expect(
          problem.correct,
          `plan "${plan.id}" problem ${problem.index}: correct must be <= 20`,
        ).toBeLessThanOrEqual(20)
      }
    }
  })

  it('every addend is in [1, 9] — keeps FlowerGroup visuals legible', () => {
    // Per design/screen-3-math.md the flower-glyph row renders one glyph
    // per addend unit. At addendA=10 the row pushes past iPad portrait
    // width on the visual-groups display. Static plans hold the line at
    // ≤9 even though the planner prompt allows 10+single forms — those
    // route through the canon / live planner where the visual layout is
    // less constrained (the glyphs squeeze tighter).
    for (const plan of STATIC_ADD_TO_20_PLANS) {
      for (const problem of plan.problems) {
        expect(
          problem.addendA,
          `plan "${plan.id}" problem ${problem.index}: addendA out of range`,
        ).toBeGreaterThanOrEqual(1)
        expect(
          problem.addendA,
          `plan "${plan.id}" problem ${problem.index}: addendA out of range`,
        ).toBeLessThanOrEqual(9)
        expect(
          problem.addendB,
          `plan "${plan.id}" problem ${problem.index}: addendB out of range`,
        ).toBeGreaterThanOrEqual(1)
        expect(
          problem.addendB,
          `plan "${plan.id}" problem ${problem.index}: addendB out of range`,
        ).toBeLessThanOrEqual(9)
      }
    }
  })

  it('every problem has 1-based index matching its position', () => {
    for (const plan of STATIC_ADD_TO_20_PLANS) {
      for (let i = 0; i < plan.problems.length; i++) {
        expect(
          plan.problems[i]!.index,
          `plan "${plan.id}" position ${i}: index should be ${i + 1}`,
        ).toBe(i + 1)
      }
    }
  })

  it('utterance read templates render number words for sums in [11, 20]', () => {
    // Sanity-check that numberWord() lookups for both addends and the
    // sum produce non-empty templates. A drift past 20 in the table
    // would throw at plan construction; this assertion just confirms
    // the strings landed.
    for (const plan of STATIC_ADD_TO_20_PLANS) {
      for (const problem of plan.problems) {
        expect(problem.utterances.read).toMatch(
          /^[a-z]+ plus [a-z]+\. How many\?$/i,
        )
        expect(problem.utterances.correct).toMatch(/^Yes! [a-z]+!$/i)
        expect(problem.utterances.giveAnswer).toMatch(/^This one is [a-z]+\.$/)
      }
    }
  })

  it('flattens to wire shape with the canonical math.p<N>.<slot> id namespace', () => {
    // Same wire-shape contract as the sums-to-10 rotation. The id
    // namespace does not branch on tier — Math.tsx + the planner share
    // a single `math.p<N>.<slot>` template across every focus node.
    const plan = STATIC_ADD_TO_20_PLANS[0]!
    const sources = mathSessionPlanToUtteranceSources(plan)
    expect(sources).toHaveLength(plan.problems.length * 5)
    expect(sources.slice(0, 5).map((s) => s.id)).toEqual([
      'math.p1.read',
      'math.p1.correct',
      'math.p1.reprompt',
      'math.p1.hint',
      'math.p1.giveAnswer',
    ])
  })
})

describe('pickStaticAddTo20Plan rotation', () => {
  it('returns a deterministic plan for a fixed time', () => {
    const fixedTime = new Date('2026-05-08T12:00:00Z')
    const a = pickStaticAddTo20Plan(() => fixedTime)
    const b = pickStaticAddTo20Plan(() => fixedTime)
    expect(a).toBe(b)
  })

  it('cycles through every slot over consecutive minutes', () => {
    const seen = new Set<string>()
    for (let m = 0; m < 6; m++) {
      const t = new Date(`2026-05-08T12:0${m}:00Z`)
      seen.add(pickStaticAddTo20Plan(() => t).id)
    }
    expect(seen.size).toBe(STATIC_ADD_TO_20_PLANS.length)
  })

  it('returns a plan with the expected MathSessionPlan shape', () => {
    const plan: MathSessionPlan = pickStaticAddTo20Plan(() => new Date(0))
    expect(plan.problems).toHaveLength(8)
    for (const p of plan.problems) {
      expect(p.correct).toBe(p.addendA + p.addendB)
      expect(p.utterances.read).toMatch(/plus/)
      expect(p.correct).toBeGreaterThanOrEqual(11)
      expect(p.correct).toBeLessThanOrEqual(20)
    }
  })
})

describe('pickStaticSessionPlan focus-node dispatch (ticket 86c9q5q13)', () => {
  // The wrapper routes on focusNode so App.tsx's mathFallbackPlan can
  // drop straight onto the right tier. Backwards-compat: omitting
  // focusNode falls back to the sums-to-10 rotation that pre-existed.

  it('routes to STATIC_ADD_TO_20_PLANS when focusNode === "add-to-20"', () => {
    const fixedTime = new Date('2026-05-08T12:00:00Z')
    const picked = pickStaticSessionPlan(() => fixedTime, 'add-to-20')
    const expected = pickStaticAddTo20Plan(() => fixedTime)
    expect(picked).toBe(expected)
    // And it's in the add-to-20 rotation, not the sums-to-10 rotation.
    expect(STATIC_ADD_TO_20_PLANS.map((p) => p.id)).toContain(picked.id)
    expect(STATIC_SESSION_PLANS.map((p) => p.id)).not.toContain(picked.id)
  })

  it('falls back to sums-to-10 rotation when focusNode is omitted (back-compat)', () => {
    const fixedTime = new Date('2026-05-08T12:00:00Z')
    const picked = pickStaticSessionPlan(() => fixedTime)
    expect(STATIC_SESSION_PLANS.map((p) => p.id)).toContain(picked.id)
  })

  it('falls back to sums-to-10 rotation for unknown / non-add-to-20 focusNodes', () => {
    // Unknown focus nodes (sub-to-10, two-digit-addsub, etc.) don't
    // have first-class fallback rotations yet; they all degrade to the
    // sums-to-10 default. This is the "always render something" posture
    // — a missing tier-fallback never bricks the screen.
    const fixedTime = new Date('2026-05-08T12:00:00Z')
    expect(pickStaticSessionPlan(() => fixedTime, 'sub-to-10').id).toBe(
      pickStaticSessionPlan(() => fixedTime, 'add-to-10').id,
    )
    expect(pickStaticSessionPlan(() => fixedTime, 'two-digit-addsub').id).toBe(
      pickStaticSessionPlan(() => fixedTime, 'add-to-10').id,
    )
    expect(STATIC_SESSION_PLANS.map((p) => p.id)).toContain(
      pickStaticSessionPlan(() => fixedTime, 'mult-2-5-10').id,
    )
  })
})
