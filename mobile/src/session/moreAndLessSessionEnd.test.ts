/**
 * A more-and-less session's end (content wave 4,
 * `design/native/content-wave-4.md` § 2.6, K8, AC 3): no `mathFacts` entry
 * and no Leitner outcome (more and less has no fact), `perProblemAnswerValue`
 * holds the tapped 3-digit numbers, and § 2.7's classes ('wrong-op' among
 * them) are recorded and load back.
 *
 * Failing-first: written before the step existed.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setDayOffsetSource, setKeyValueStore } from '@marian/core'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import {
  defaultProgress,
  isProgressV1,
  loadProgress,
  saveProgress,
} from '@marian/core/progress'
import { REPO_ROOT } from '../../test/webSource'
import type { MathSessionResult } from '../screens/math/mathTypes'
import { mathSessionEndPayload } from './sessionEndPayload'
import { forwardLeitnerOutcomes, writeSessionEnd } from './sessionEndWrite'

const ANSWERS = [435, 354, 726, 562, 645, 453, 735, 328]
// P6's first tap was the wrong-op chip 853 (she added); the rest the answer.
const TAPPED = [435, 354, 726, 562, 645, 853, 735, 328]
const CLASSES: MathSessionResult['perProblemDistractorClass'] = [
  'gentle',
  'gentle',
  'gentle',
  'wrong-place',
  'wrong-place',
  'wrong-op',
  'wrong-op',
  'wrong-place',
]

const RESULT: MathSessionResult = {
  totalCorrect: 7,
  totalStardust: 20,
  finalStreak: 4,
  earnedThisSession: 8,
  perProblemCorrect: [true, true, true, true, true, false, true, true],
  latencyMs: [3600, 3100, 2900, 5300, 4400, 3000, 3800, 3500],
  subitisingScaffoldRendered: false,
  subitisingScaffoldSubRendered: false,
  perProblemAnswerValue: TAPPED,
  warmupCorrect: [],
  firstTapCorrect: [true, true, true, true, true, false, true, true],
  perProblemDistractorClass: CLASSES,
}

function moreAndLessPlan() {
  const json = JSON.parse(
    readFileSync(
      resolve(
        REPO_ROOT,
        'public',
        'canon',
        'math',
        'level-1',
        'hundreds-addsub.json',
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

it('the canon plan answers § 2.7', () => {
  expect(moreAndLessPlan().problems.map((p) => p.correct)).toEqual(ANSWERS)
})

it('AC 3: the payload has no mathFacts and no Leitner outcome; the 3-digit taps and § 2.7’s classes', () => {
  const payload = mathSessionEndPayload(RESULT, moreAndLessPlan(), {
    node: 'hundreds-addsub',
    mode: 'forward',
  })
  expect(payload).not.toHaveProperty('mathFacts')
  expect(payload).not.toHaveProperty('problemFacts')
  expect(payload.perProblemAnswerValue).toEqual(TAPPED)
  expect(payload.perProblemDistractorClass).toEqual(CLASSES)
  expect(forwardLeitnerOutcomes(payload)).toBeUndefined()
})

it('AC 3: the write keeps the 3-digit taps and the classes, records no facts, and loads back', () => {
  const seed = defaultProgress()
  saveProgress({
    ...seed,
    skillLevels: { ...seed.skillLevels, 'hundreds-addsub': 'practicing' },
  })
  const before = loadProgress()!
  const payload = mathSessionEndPayload(RESULT, moreAndLessPlan(), {
    node: 'hundreds-addsub',
    mode: 'forward',
  })
  writeSessionEnd(payload, { clock: () => new Date('2026-10-18T12:00:00') })
  const after = loadProgress()
  expect(isProgressV1(after)).toBe(true)
  expect(after!.mathFactsLeitner).toEqual(before.mathFactsLeitner)
  const entry = after!.history.at(-1)!
  expect(entry.skillFocus).toEqual(['hundreds-addsub'])
  expect(entry).not.toHaveProperty('mathFacts')
  expect(entry.perProblemAnswerValue).toEqual(TAPPED)
  expect(entry.perProblemDistractorClass).toEqual(CLASSES)
})
