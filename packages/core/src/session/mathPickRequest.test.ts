/**
 * `mathPickRequestFor`: the device picks exactly the sessions whose
 * request carried a hint the planner used (no-Claude plan phase 3), and
 * reads the picker's input from that learner's doc.
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { applyDebugSeed } from '../debug/seeds'
import { localDateKey } from '../progress/clock'
import { defaultProgress } from '../progress/defaults'
import { sessionPlanKind } from '../progress/reviewPlan'
import { loadProgress } from '../progress/storage'
import type { MathFact, Progress, SessionHistoryEntry } from '../progress/types'
import {
  composeSession,
  type CanonText,
  type CanonTextResolver,
} from './composeSession'
import { mathPickRequestFor, previousSessionFacts } from './mathPickRequest'

const NOW = new Date('2026-10-24T09:00:00.000Z').getTime()
const TODAY = localDateKey(new Date(NOW))
const FORWARD = { kind: 'forward' as const, warmup: [] }

const doc = (over: Partial<Progress> = {}): Progress => ({
  ...defaultProgress(),
  ...over,
})
const due = (item: MathFact) => ({ item, box: 1 as const, lastSeen: 0 })
const session = (
  node: Progress['history'][number]['skillFocus'][number],
  mathFacts?: MathFact[],
): SessionHistoryEntry => ({
  dateISO: new Date(NOW - 86_400_000).toISOString(),
  skillFocus: [node],
  successRate: 1,
  ...(mathFacts !== undefined ? { mathFacts } : {}),
})

describe('mathPickRequestFor: which sessions the device picks', () => {
  it('add-to-10 with a due fact of the step: picked', () => {
    const p = doc({
      mathFactsLeitner: { items: [due({ a: 6, b: 4, op: '+' })] },
    })
    expect(
      mathPickRequestFor(p, 'add-to-10', FORWARD, NOW, TODAY, 3),
    ).toMatchObject({
      step: 'add-to-10',
      seed: 3,
      today: TODAY,
      warmup: [],
    })
  })

  it('add-to-10 with only a "*" fact due, or only warm-up facts due: not picked', () => {
    const times = doc({
      mathFactsLeitner: { items: [due({ a: 2, b: 3, op: '*' })] },
    })
    expect(
      mathPickRequestFor(times, 'add-to-10', FORWARD, NOW, TODAY, 0),
    ).toBeNull()
    const warmed = doc({
      mathFactsLeitner: { items: [due({ a: 7, b: 3, op: '+' })] },
    })
    expect(
      mathPickRequestFor(
        warmed,
        'add-to-10',
        { kind: 'forward', warmup: [{ node: 'add-to-10', problem: 4 }] },
        NOW,
        TODAY,
        0,
      ),
    ).toBeNull()
  })

  it('sub-to-10 picks only for a slow fact (the Leitner hint never applied there)', () => {
    const box = doc({
      mathFactsLeitner: { items: [due({ a: 9, b: 1, op: '-' })] },
    })
    expect(
      mathPickRequestFor(box, 'sub-to-10', FORWARD, NOW, TODAY, 0),
    ).toBeNull()
    const facts: MathFact[] = [{ a: 9, b: 1, op: '-' }]
    const slow = doc({
      history: [1, 2, 3, 4, 5].map((d) => ({
        ...session('sub-to-10', facts),
        dateISO: new Date(NOW - d * 86_400_000).toISOString(),
        latencyMs: [8000],
      })),
    })
    expect(
      mathPickRequestFor(slow, 'sub-to-10', FORWARD, NOW, TODAY, 0)?.slow,
    ).toEqual(facts)
  })

  it('a review, a times mix and every other step: not picked', () => {
    const p = doc({
      mathFactsLeitner: { items: [due({ a: 6, b: 4, op: '+' })] },
    })
    expect(
      mathPickRequestFor(
        p,
        'add-to-10',
        { kind: 'review', blocks: [] },
        NOW,
        TODAY,
        0,
      ),
    ).toBeNull()
    expect(
      mathPickRequestFor(
        p,
        'add-to-10',
        { kind: 'forward', warmup: [], mix: [] },
        NOW,
        TODAY,
        0,
      ),
    ).toBeNull()
    expect(
      mathPickRequestFor(p, 'add-to-20', FORWARD, NOW, TODAY, 0),
    ).toBeNull()
    expect(mathPickRequestFor(p, undefined, FORWARD, NOW, TODAY, 0)).toBeNull()
  })
})

describe('previousSessionFacts', () => {
  it('the last full session of the step, warm-ups left out; else null', () => {
    const last: MathFact[] = Array.from({ length: 8 }, (_, i) => ({
      a: i + 1,
      b: 1,
      op: '+' as const,
    }))
    const p = doc({
      history: [
        session('add-to-10', [{ a: 1, b: 2, op: '+' }]),
        session('add-to-10', last),
        session('blending-cv'),
      ],
    })
    expect(previousSessionFacts(p, 'add-to-10')).toEqual(last)
    expect(previousSessionFacts(p, 'sub-to-10')).toBeNull()
    expect(previousSessionFacts(doc(), 'add-to-10')).toBeNull()
  })
})

describe('the add-to-10-due debug seed (the simulator pre-check and device check)', () => {
  beforeEach(() => window.localStorage.clear())

  it('makes the next add-to-10 session a pick, 6 + ? = 10 at P4 after its 2-heart warm-up', () => {
    expect(applyDebugSeed('add-to-10-due')).toBe(true)
    const p = loadProgress()!
    const planKind = sessionPlanKind(p, 'math', NOW, TODAY, 1, 'add-to-10')
    expect(planKind).toEqual({
      kind: 'forward',
      warmup: [
        { node: 'add-to-10', problem: 2 },
        { node: 'add-to-10', problem: 7 },
      ],
    })
    const req = mathPickRequestFor(p, 'add-to-10', planKind, NOW, TODAY, 1)!
    const canon = JSON.parse(
      readFileSync('mobile/assets/canon/canon-text.json', 'utf8'),
    ) as Record<string, CanonText>
    const resolve: CanonTextResolver = (key) =>
      canon[`${key.track}/level-${key.level}/${key.focusNode}`] ?? null
    const out = composeSession(
      {
        track: 'math',
        level: 1,
        childName: 'friend',
        progress: { focusNode: 'add-to-10' },
        warmup: { blocks: planKind.kind === 'forward' ? planKind.warmup : [] },
      },
      resolve,
      { mathPick: req },
    )
    if (out.kind !== 'local') throw new Error(out.kind)
    expect(
      out.session.utterances.find((u) => u.id === 'math.p4.read')?.text,
    ).toBe('Six and what make ten?')
    expect(out.session.utterances.some((u) => u.id === 'math.w2.read')).toBe(
      true,
    )
  })
})
