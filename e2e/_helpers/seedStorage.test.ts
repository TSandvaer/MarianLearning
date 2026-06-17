/**
 * Unit tests for `buildSeedProgress` history widening (ticket 86c9xaybc).
 *
 * Covers the three precedents that previously bypassed the helper via
 * raw-spread or full hand-built Progress docs:
 *
 *   1. `latencyMs` — the M4 Leitner wiring spec
 *      (`slow-fact-directive-injection.spec.ts`,
 *      `sub-to-10-slow-fact-warmup.spec.ts`).
 *   2. `mathFacts` — paired with `latencyMs` in the same M4.x slow-fact
 *      capture path.
 *   3. `perProblemAnswerValue` / `perProblemAnswerWord` — PR #286 schema
 *      (`schema-answer-value.spec.ts` back-compat seed).
 *
 * Plus a negative case: arrays passed by the caller MUST NOT alias the
 * arrays on the seeded blob. The helper deep-copies so a caller's
 * downstream mutation (or a `Object.freeze` on the input) can't leak
 * into the persisted shape.
 *
 * Lives under `e2e/_helpers/` next to the helper. Vitest picks it up
 * via the same path slidingWindow.test.ts uses — `vite.config.ts`
 * narrows the e2e exclude to `*.spec.ts` only, so `*.test.ts` files in
 * the e2e tree run with the unit suite.
 */

import { describe, expect, it } from 'vitest'
import { buildSeedProgress } from './seedStorage'

interface PersistedProgress {
  history: Array<{
    dateISO: string
    skillFocus: string[]
    successRate: number
    novelPoolSuccessRate?: number
    latencyMs?: number[]
    mathFacts?: Array<{ a: number; b: number; op: '+' | '-' | '*' }>
    perProblemAnswerValue?: Array<number | null>
    perProblemAnswerWord?: Array<string | null>
  }>
}

interface ProgressWithLatch {
  cvcGraduationSessionFired?: boolean
}

describe('buildSeedProgress — SessionHistoryEntry widening (ticket 86c9xaybc)', () => {
  it('accepts a narrow legacy entry (dateISO + skillFocus + successRate) and emits no additive fields', () => {
    const progress = buildSeedProgress({
      history: [
        {
          dateISO: '2026-05-20T10:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.875,
        },
      ],
    }) as PersistedProgress

    expect(progress.history).toEqual([
      {
        dateISO: '2026-05-20T10:00:00.000Z',
        skillFocus: ['add-to-10'],
        successRate: 0.875,
      },
    ])
    expect(progress.history[0]!.latencyMs).toBeUndefined()
    expect(progress.history[0]!.mathFacts).toBeUndefined()
    expect(progress.history[0]!.perProblemAnswerValue).toBeUndefined()
    expect(progress.history[0]!.perProblemAnswerWord).toBeUndefined()
    expect(progress.history[0]!.novelPoolSuccessRate).toBeUndefined()
  })

  it('precedent 1: latencyMs survives the helper natively (was the slow-fact directive injection workaround)', () => {
    const progress = buildSeedProgress({
      history: [
        {
          dateISO: '2026-05-20T10:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 1,
          latencyMs: [5500, 5700, 5800, 5900, 6100, 6300],
        },
      ],
    }) as PersistedProgress

    expect(progress.history[0]!.latencyMs).toEqual([
      5500, 5700, 5800, 5900, 6100, 6300,
    ])
  })

  it('precedent 2: mathFacts survives the helper natively (paired with latencyMs in the slow-fact warmup spec)', () => {
    const fact = { a: 4, b: 2, op: '+' as const }
    const progress = buildSeedProgress({
      history: [
        {
          dateISO: '2026-05-20T10:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 1,
          latencyMs: [5500],
          mathFacts: [fact],
        },
      ],
    }) as PersistedProgress

    expect(progress.history[0]!.mathFacts).toEqual([{ a: 4, b: 2, op: '+' }])
    expect(progress.history[0]!.latencyMs).toEqual([5500])
  })

  it('precedent 3: perProblemAnswerValue / perProblemAnswerWord survive the helper natively (PR #286 schema)', () => {
    const progress = buildSeedProgress({
      history: [
        {
          dateISO: '2026-05-21T10:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.875,
          perProblemAnswerValue: [3, 7, null, 5, 8, 9, 2, 6],
        },
        {
          dateISO: '2026-05-21T11:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.875,
          perProblemAnswerWord: [
            'cat',
            'mat',
            null,
            'sat',
            'rat',
            'pat',
            'tap',
            'map',
          ],
        },
      ],
    }) as PersistedProgress

    expect(progress.history[0]!.perProblemAnswerValue).toEqual([
      3,
      7,
      null,
      5,
      8,
      9,
      2,
      6,
    ])
    expect(progress.history[1]!.perProblemAnswerWord).toEqual([
      'cat',
      'mat',
      null,
      'sat',
      'rat',
      'pat',
      'tap',
      'map',
    ])
  })

  it('emits novelPoolSuccessRate when supplied (cvc-words graduation entries)', () => {
    const progress = buildSeedProgress({
      history: [
        {
          dateISO: '2026-05-20T10:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 0.95,
          novelPoolSuccessRate: 0.85,
        },
      ],
    }) as PersistedProgress

    expect(progress.history[0]!.novelPoolSuccessRate).toBe(0.85)
  })

  it('deep-copies arrays so caller mutation does not leak into the seeded blob', () => {
    // Negative-case guard: a spec that builds the helper input from a
    // generator, then mutates the source for the next iteration, must
    // not see the prior iteration's seeded entry change underfoot.
    const latencyMs: number[] = [1000, 2000, 3000]
    const mathFacts: Array<{ a: number; b: number; op: '+' | '-' | '*' }> = [
      { a: 4, b: 2, op: '+' },
    ]
    const perProblemAnswerValue: Array<number | null> = [3, 5, 7]
    const perProblemAnswerWord: Array<string | null> = ['cat', 'mat']
    const skillFocus: Array<'add-to-10'> = ['add-to-10']

    const progress = buildSeedProgress({
      history: [
        {
          dateISO: '2026-05-20T10:00:00.000Z',
          skillFocus,
          successRate: 1,
          latencyMs,
          mathFacts,
          perProblemAnswerValue,
          perProblemAnswerWord,
        },
      ],
    }) as PersistedProgress

    // Mutate the caller's source arrays AFTER the helper has been
    // invoked. The seeded blob must remain at the original values.
    latencyMs.push(9999)
    mathFacts.push({ a: 99, b: 99, op: '-' })
    perProblemAnswerValue.push(99)
    perProblemAnswerWord.push('xxx')
    skillFocus.push('add-to-10')
    mathFacts[0]!.a = 99

    expect(progress.history[0]!.latencyMs).toEqual([1000, 2000, 3000])
    expect(progress.history[0]!.mathFacts).toEqual([{ a: 4, b: 2, op: '+' }])
    expect(progress.history[0]!.perProblemAnswerValue).toEqual([3, 5, 7])
    expect(progress.history[0]!.perProblemAnswerWord).toEqual(['cat', 'mat'])
    expect(progress.history[0]!.skillFocus).toEqual(['add-to-10'])
  })

  it('accepts frozen `as const` array inputs without throwing (readonly-array contract)', () => {
    // The widened type uses ReadonlyArray on every array field so a
    // caller can declare `as const` literals and pass them without
    // a cast. If we ever regress to a non-readonly param type, this
    // test stops compiling — which is the failure surface we want.
    const FROZEN_LATENCIES = [5500, 5700, 5800] as const
    const FROZEN_FACTS = [{ a: 4, b: 2, op: '+' }] as const

    expect(() =>
      buildSeedProgress({
        history: [
          {
            dateISO: '2026-05-20T10:00:00.000Z',
            skillFocus: ['add-to-10'],
            successRate: 1,
            latencyMs: FROZEN_LATENCIES,
            mathFacts: FROZEN_FACTS,
          },
        ],
      }),
    ).not.toThrow()
  })
})

describe('buildSeedProgress — cvcGraduationSessionFired latch (ticket 86caa6k18)', () => {
  it('leaves the latch ABSENT by default — the fresh-production forward-learner shape (§4.1.8)', () => {
    // AC4: the helper default must match the fresh-production value (latch
    // unset / falsy), NOT a convenience `true`. A seed that doesn't set it
    // therefore exercises the real pre-graduation path where the storage
    // read-path normalises the missing latch to falsy. This is the whole
    // point of the ticket — a `true` default would mask the PR #471
    // regression class.
    const progress = buildSeedProgress() as ProgressWithLatch
    expect(progress.cvcGraduationSessionFired).toBeUndefined()
    expect('cvcGraduationSessionFired' in progress).toBe(false)
  })

  it('leaves the latch ABSENT when other options are set but the latch is omitted', () => {
    // Setting unrelated options must not accidentally materialise the
    // latch — absence is the production default regardless of what else
    // the spec seeds.
    const progress = buildSeedProgress({
      skillLevelOverrides: { 'cvc-words-short-u': 'mastered' },
      history: [
        {
          dateISO: '2026-05-20T10:00:00.000Z',
          skillFocus: ['cvc-words'],
          successRate: 1,
        },
      ],
    }) as ProgressWithLatch
    expect(progress.cvcGraduationSessionFired).toBeUndefined()
  })

  it('threads cvcGraduationSessionFired: true through to the seeded blob (post-graduation periodic-review path)', () => {
    const progress = buildSeedProgress({
      cvcGraduationSessionFired: true,
    }) as ProgressWithLatch
    expect(progress.cvcGraduationSessionFired).toBe(true)
  })

  it('threads an explicit cvcGraduationSessionFired: false through to the seeded blob', () => {
    // An explicit `false` must round-trip as a present-and-false field
    // (distinct from absent), so a spec can pin the pre-graduation latch
    // value explicitly when it wants the field materialised.
    const progress = buildSeedProgress({
      cvcGraduationSessionFired: false,
    }) as ProgressWithLatch
    expect(progress.cvcGraduationSessionFired).toBe(false)
    expect('cvcGraduationSessionFired' in progress).toBe(true)
  })
})
