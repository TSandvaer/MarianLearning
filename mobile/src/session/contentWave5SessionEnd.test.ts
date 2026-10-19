/**
 * Content wave 5's Number Garden session ends (`design/native/
 * content-wave-5.md` § 2.6, § 3.6, K8, AC 2, AC 3):
 *
 * - Zeros: no `mathFacts` entry and no Leitner outcome (no fact); a
 *   zero-drop tap (18) is kept as a two-digit value; § 2.7's classes.
 * - Adding big numbers: its 8 `{ a, b, op: '+' }` facts, as the two-digit
 *   steps send, so its blocks can be warm-up hearts; the forgotten carry
 *   on P4–P8 and `null` on P1–P3.
 *
 * Failing-first: written before the steps existed.
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

function plan(stem: string) {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', `${stem}.json`),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, { extendedKinds: true })
}

const result = (
  tapped: number[],
  classes: MathSessionResult['perProblemDistractorClass'],
  firstTap: boolean[],
): MathSessionResult => ({
  totalCorrect: firstTap.filter(Boolean).length,
  totalStardust: 20,
  finalStreak: 4,
  earnedThisSession: 8,
  perProblemCorrect: firstTap,
  latencyMs: [3600, 3100, 2900, 5300, 4400, 3000, 3800, 3500],
  subitisingScaffoldRendered: false,
  subitisingScaffoldSubRendered: false,
  perProblemAnswerValue: tapped,
  warmupCorrect: [],
  firstTapCorrect: firstTap,
  perProblemDistractorClass: classes,
})

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

describe('zeros (§ 2.6)', () => {
  // P4's first tap was the zero-drop chip 18; the rest the answer.
  const TAPPED = [305, 460, 700, 18, 190, 315, 740, 406]
  const CLASSES: MathSessionResult['perProblemDistractorClass'] = [
    'gentle',
    'gentle',
    'gentle',
    'zero-drop',
    'zero-drop',
    'wrong-place',
    'wrong-place',
    'wrong-place',
  ]
  const FIRST = [true, true, true, false, true, true, true, true]

  it('no mathFacts and no Leitner outcome; the two-digit zero-drop tap and § 2.7’s classes load back', () => {
    const payload = mathSessionEndPayload(
      result(TAPPED, CLASSES, FIRST),
      plan('hundreds-zeros'),
      { node: 'hundreds-zeros', mode: 'forward' },
    )
    expect(payload).not.toHaveProperty('mathFacts')
    expect(forwardLeitnerOutcomes(payload)).toBeUndefined()
    const seed = defaultProgress()
    saveProgress({
      ...seed,
      skillLevels: { ...seed.skillLevels, 'hundreds-zeros': 'practicing' },
    })
    const before = loadProgress()!
    writeSessionEnd(payload, { clock: () => new Date('2026-10-20T12:00:00') })
    const after = loadProgress()
    expect(isProgressV1(after)).toBe(true)
    expect(after!.mathFactsLeitner).toEqual(before.mathFactsLeitner)
    const entry = after!.history.at(-1)!
    expect(entry.skillFocus).toEqual(['hundreds-zeros'])
    expect(entry.perProblemAnswerValue).toEqual(TAPPED)
    expect(entry.perProblemDistractorClass).toEqual(CLASSES)
  })
})

describe('adding big numbers (§ 3.6, K8)', () => {
  const TAPPED = [59, 78, 63, 63, 83, 84, 62, 92]
  const CLASSES: MathSessionResult['perProblemDistractorClass'] = [
    null,
    null,
    null,
    'forgotten-carry',
    'forgotten-carry',
    'forgotten-carry',
    'forgotten-carry',
    'forgotten-carry',
  ]
  // P4's first tap was the forgotten carry, 63.
  const FIRST = [true, true, true, false, true, true, true, true]

  it('sends its 8 sums as mathFacts, as the two-digit steps do, and the Leitner box learns them', () => {
    const payload = mathSessionEndPayload(
      result(TAPPED, CLASSES, FIRST),
      plan('add-two-digit'),
      { node: 'add-two-digit', mode: 'forward' },
    )
    expect(payload.mathFacts).toEqual([
      { a: 34, b: 25, op: '+' },
      { a: 42, b: 36, op: '+' },
      { a: 28, b: 35, op: '+' },
      { a: 47, b: 26, op: '+' },
      { a: 39, b: 44, op: '+' },
      { a: 56, b: 28, op: '+' },
      { a: 29, b: 33, op: '+' },
      { a: 65, b: 27, op: '+' },
    ])
    expect(payload.perProblemDistractorClass).toEqual(CLASSES)
    const seed = defaultProgress()
    saveProgress({
      ...seed,
      skillLevels: { ...seed.skillLevels, 'add-two-digit': 'practicing' },
    })
    writeSessionEnd(payload, { clock: () => new Date('2026-10-20T12:00:00') })
    const after = loadProgress()!
    const keys = after.mathFactsLeitner.items.map(
      (i) => `${i.item.a}${i.item.op}${i.item.b}`,
    )
    expect(keys).toEqual(expect.arrayContaining(['28+35', '47+26']))
    const entry = after.history.at(-1)!
    expect(entry.skillFocus).toEqual(['add-two-digit'])
    expect(entry.perProblemAnswerValue).toEqual(TAPPED)
  })
})
