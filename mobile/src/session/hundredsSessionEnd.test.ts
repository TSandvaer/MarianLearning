/**
 * A hundreds session's end (content wave 3, `design/native/content-wave-3.md`
 * § 3.6, K7, AC 4): no `mathFacts` entry and no Leitner outcome (hundreds
 * has no fact), and `perProblemAnswerValue` holds the tapped 3-digit
 * numbers, which the progress guard reads since G and which load back.
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

const ANSWERS = [234, 352, 426, 537, 326, 253, 565, 738]
// P4's first tap was the digit swap 573; the rest the answer.
const TAPPED = [234, 352, 426, 573, 326, 253, 565, 738]

const RESULT: MathSessionResult = {
  totalCorrect: 7,
  totalStardust: 20,
  finalStreak: 4,
  earnedThisSession: 8,
  perProblemCorrect: [true, true, true, false, true, true, true, true],
  latencyMs: [3600, 3100, 2900, 5300, 4400, 3000, 3800, 3500],
  subitisingScaffoldRendered: false,
  subitisingScaffoldSubRendered: false,
  perProblemAnswerValue: TAPPED,
  warmupCorrect: [],
  firstTapCorrect: [true, true, true, false, true, true, true, true],
  perProblemDistractorClass: [
    'gentle',
    'gentle',
    'gentle',
    'digit-swap',
    'spoken-order',
    'wrong-place',
    'wrong-place',
    'wrong-place',
  ],
}

function hundredsPlan() {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', 'hundreds.json'),
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

it('the canon plan answers § 3.7', () => {
  expect(hundredsPlan().problems.map((p) => p.correct)).toEqual(ANSWERS)
})

it('AC 4: the payload has no mathFacts and no Leitner outcome; the 3-digit taps as usual', () => {
  const payload = mathSessionEndPayload(RESULT, hundredsPlan(), {
    node: 'hundreds',
    mode: 'forward',
  })
  expect(payload).not.toHaveProperty('mathFacts')
  expect(payload).not.toHaveProperty('problemFacts')
  expect(payload.perProblemAnswerValue).toEqual(TAPPED)
  expect(payload.perProblemDistractorClass).toEqual(
    RESULT.perProblemDistractorClass,
  )
  expect(forwardLeitnerOutcomes(payload)).toBeUndefined()
})

it('AC 4: the write keeps the 3-digit taps, records no facts, and loads back', () => {
  const seed = defaultProgress()
  saveProgress({
    ...seed,
    skillLevels: { ...seed.skillLevels, hundreds: 'practicing' },
  })
  const before = loadProgress()!
  const payload = mathSessionEndPayload(RESULT, hundredsPlan(), {
    node: 'hundreds',
    mode: 'forward',
  })
  writeSessionEnd(payload, { clock: () => new Date('2026-10-18T12:00:00') })
  const after = loadProgress()
  expect(isProgressV1(after)).toBe(true)
  expect(after!.mathFactsLeitner).toEqual(before.mathFactsLeitner)
  const entry = after!.history.at(-1)!
  expect(entry.skillFocus).toEqual(['hundreds'])
  expect(entry).not.toHaveProperty('mathFacts')
  expect(entry.perProblemAnswerValue).toEqual(TAPPED)
})
