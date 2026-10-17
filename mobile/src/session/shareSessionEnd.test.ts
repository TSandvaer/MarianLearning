/**
 * A sharing session's end (content wave 2, `design/native/content-wave-2.md`
 * § 2.6, K6, AC 4): no `mathFacts` entry and no Leitner outcome (its time
 * includes the deal, so it would mark × facts slow), and
 * `perProblemAnswerValue` holds the tapped shares.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setDayOffsetSource, setKeyValueStore } from '@marian/core'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import {
  defaultProgress,
  loadProgress,
  saveProgress,
} from '@marian/core/progress'
import { REPO_ROOT } from '../../test/webSource'
import type { MathSessionResult } from '../screens/math/mathTypes'
import { mathSessionEndPayload } from './sessionEndPayload'
import { forwardLeitnerOutcomes, writeSessionEnd } from './sessionEndWrite'

const SHARES = [3, 4, 5, 4, 2, 3, 5, 6]

const RESULT: MathSessionResult = {
  totalCorrect: 7,
  totalStardust: 20,
  finalStreak: 4,
  earnedThisSession: 8,
  perProblemCorrect: [true, true, true, false, true, true, true, true],
  latencyMs: [2600, 2100, 1900, 3300, 2400, 2000, 2800, 2500],
  subitisingScaffoldRendered: false,
  subitisingScaffoldSubRendered: false,
  // P4's first tap was the off-by-one 3; the rest the share.
  perProblemAnswerValue: [3, 4, 5, 3, 2, 3, 5, 6],
  warmupCorrect: [],
  firstTapCorrect: [true, true, true, false, true, true, true, true],
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

function sharePlan() {
  const json = JSON.parse(
    readFileSync(
      resolve(
        REPO_ROOT,
        'public',
        'canon',
        'math',
        'level-1',
        'div-share.json',
      ),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, { extendedKinds: true })
}

beforeEach(() => {
  const map = new Map<string, string>()
  setKeyValueStore({
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  })
  setDayOffsetSource(null)
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => jest.restoreAllMocks())

it('the canon plan is 8 shares (the answers the chips offer)', () => {
  expect(sharePlan().problems.map((p) => p.correct)).toEqual(SHARES)
})

it('AC 4: the payload has no mathFacts; the tapped shares, latencies and classes as usual', () => {
  const payload = mathSessionEndPayload(RESULT, sharePlan(), {
    node: 'div-share',
    mode: 'forward',
  })
  expect(payload).not.toHaveProperty('mathFacts')
  expect(payload).not.toHaveProperty('problemFacts')
  expect(payload.perProblemAnswerValue).toEqual([3, 4, 5, 3, 2, 3, 5, 6])
  expect(payload.perProblemCorrect).toEqual(RESULT.perProblemCorrect)
  expect(payload.latencyMs).toEqual(RESULT.latencyMs)
  expect(payload.perProblemDistractorClass).toEqual(
    RESULT.perProblemDistractorClass,
  )
  expect(forwardLeitnerOutcomes(payload)).toBeUndefined()
})

it('AC 4: the write leaves the Leitner box untouched and records no facts', () => {
  const seed = defaultProgress()
  saveProgress({
    ...seed,
    skillLevels: { ...seed.skillLevels, 'div-share': 'practicing' },
  })
  const before = loadProgress()!
  const payload = mathSessionEndPayload(RESULT, sharePlan(), {
    node: 'div-share',
    mode: 'forward',
  })
  writeSessionEnd(payload, { clock: () => new Date('2026-10-17T12:00:00') })
  const after = loadProgress()!
  expect(after.mathFactsLeitner).toEqual(before.mathFactsLeitner)
  // The session is recorded on the step, with no facts for the slow-fact
  // join (`slowFacts.ts` reads a history entry's mathFacts + latencyMs).
  const entry = after.history.at(-1)!
  expect(entry.skillFocus).toEqual(['div-share'])
  expect(entry).not.toHaveProperty('mathFacts')
  expect(entry.perProblemAnswerValue).toEqual([3, 4, 5, 3, 2, 3, 5, 6])
})
