/**
 * The 2-secure-days fast track and the pace guard (native spec
 * `design/native/fast-track-native.md` §§ 2–5, acceptance criteria 1–6, 9,
 * 10's guard half). Session ends go through the real write path
 * (`recordProgressOnSessionEnd`) into the jsdom store; the cloud push is
 * stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.hoisted(() =>
  vi.fn<(deviceId: string, progress: unknown) => Promise<'skipped'>>(() =>
    Promise.resolve('skipped'),
  ),
)
vi.mock('./cloudSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./cloudSync')>()),
  pushProgressToCloud: push,
}))

import { progressAtStep } from '../debug/stepProgress'
import {
  recordProgressOnSessionEnd,
  type RecordProgressInput,
} from '../sessionEnd/progressHistory'
import {
  FAST_TRACK_SECURE_DAYS,
  fastTrackQualifies,
  fastTrackSecureDays,
  isSecureSession,
} from './fastTrack'
import { dayScores, withPaceHold, withSecureDay } from './fastTrackRecord'
import { isProgressV1 } from './guards'
import { isGraduationSessionPending } from './mastery'
import { nodeProgress } from './nodeProgress'
import { DEFAULT_PARENT_SETTINGS } from './parentSettings'
import { loadProgress, saveProgress } from './storage'
import type { Progress, SkillNode } from './types'

const ALL = Array<boolean>(8).fill(true)
const SEVEN = [false, ...Array<boolean>(7).fill(true)]

/** A local timestamp on October `day`, 2026 (TZ-safe day keys). */
const on = (day: number, hour = 10) =>
  new Date(2026, 9, day, hour).toISOString()
const MON = 12
const TUE = 13
const WED = 14
const key = (day: number) => `2026-10-${day}`

function play(
  node: SkillNode,
  day: number,
  firstTap: readonly boolean[] | undefined,
  extra: Partial<RecordProgressInput> = {},
  hour = 10,
): Progress {
  const totalCorrect =
    firstTap === undefined ? 8 : firstTap.filter(Boolean).length
  return recordProgressOnSessionEnd({
    surface:
      node.startsWith('add') || node.startsWith('sub') ? 'math' : 'word-song',
    totalCorrect,
    dateISO: on(day, hour),
    focusNode: node,
    ...(firstTap !== undefined ? { firstTapCorrect: firstTap } : {}),
    ...extra,
  })
}

/** A session scoring `correct` of 8 (first taps match the score). */
const score = (correct: number) =>
  Array.from({ length: 8 }, (_, i) => i < correct)

function withSettings(
  p: Progress,
  patch: Partial<typeof DEFAULT_PARENT_SETTINGS>,
): Progress {
  return { ...p, parentSettings: { ...DEFAULT_PARENT_SETTINGS, ...patch } }
}

beforeEach(() => {
  window.localStorage.clear()
  push.mockClear()
})
afterEach(() => {
  window.localStorage.clear()
})

describe('AC1 isSecureSession', () => {
  it('8 × true is secure; any false, 7 or 9 entries, or undefined is not', () => {
    expect(isSecureSession(ALL)).toBe(true)
    expect(isSecureSession(SEVEN)).toBe(false)
    expect(isSecureSession([...ALL.slice(0, 7), false])).toBe(false)
    expect(isSecureSession(ALL.slice(0, 7))).toBe(false)
    expect(isSecureSession([...ALL, true])).toBe(false)
    expect(isSecureSession(undefined)).toBe(false)
    expect(isSecureSession([])).toBe(false)
  })

  it('fastTrackQualifies needs 2 distinct days', () => {
    expect(FAST_TRACK_SECURE_DAYS).toBe(2)
    expect(fastTrackQualifies(undefined)).toBe(false)
    expect(fastTrackQualifies([key(MON)])).toBe(false)
    expect(fastTrackQualifies([key(MON), key(MON)])).toBe(false)
    expect(fastTrackQualifies([key(MON), key(TUE)])).toBe(true)
  })
})

describe('AC2 recordProgressOnSessionEnd records secure days', () => {
  it('the first secure session on a step today adds today', () => {
    saveProgress(progressAtStep('add-to-10'))
    const p = play('add-to-10', MON, ALL)
    expect(p.secureDays).toEqual({ 'add-to-10': [key(MON)] })
  })

  it('after a finished 7/8 session on that step today, an 8/8 one adds nothing', () => {
    saveProgress(progressAtStep('add-to-10'))
    play('add-to-10', MON, SEVEN, {}, 9)
    const p = play('add-to-10', MON, ALL, {}, 11)
    expect(p.secureDays).toBeUndefined()
  })

  it('a second secure session the same day adds no second entry', () => {
    saveProgress(progressAtStep('add-to-10'))
    play('add-to-10', MON, ALL, {}, 9)
    const p = play('add-to-10', MON, ALL, {}, 11)
    expect(p.secureDays).toEqual({ 'add-to-10': [key(MON)] })
  })

  it('a session on a mastered step adds nothing', () => {
    saveProgress(progressAtStep('add-to-20'))
    const p = play('add-to-10', MON, ALL)
    expect(p.secureDays).toBeUndefined()
  })

  it('without firstTapCorrect (the web, older callers) nothing is recorded', () => {
    saveProgress(progressAtStep('add-to-10'))
    const p = play('add-to-10', MON, undefined)
    expect(p.secureDays).toBeUndefined()
  })

  it('a letter-sounds entry tagged /o/ adds today under both letter-sounds and /o/', () => {
    saveProgress(progressAtStep('letter-sounds'))
    const p = play('letter-sounds', MON, ALL, { currentTargetVowel: '/o/' })
    expect(p.secureDays).toEqual({
      'letter-sounds': [key(MON)],
      '/o/': [key(MON)],
    })
  })

  it('withSecureDay judges P2 per key: an earlier /o/ session today leaves /u/ free', () => {
    const base = progressAtStep('letter-sounds')
    const p: Progress = {
      ...base,
      history: [
        {
          dateISO: on(MON, 8),
          skillFocus: ['letter-sounds'],
          successRate: 0.5,
          currentTargetVowel: '/o/',
        },
      ],
    }
    const out = withSecureDay(p, {
      focusNode: 'letter-sounds',
      currentTargetVowel: '/u/',
      dateISO: on(MON, 10),
      firstTapCorrect: ALL,
    })
    expect(out.secureDays).toEqual({ '/u/': [key(MON)] })
  })

  it('the history entry itself carries no first-tap field', () => {
    saveProgress(progressAtStep('add-to-10'))
    const p = play('add-to-10', MON, ALL)
    expect(p.history.at(-1)).toEqual({
      dateISO: on(MON),
      skillFocus: ['add-to-10'],
      successRate: 1,
    })
  })
})

describe('AC3 the fast track at the defaults (88% / 3)', () => {
  it('Number Garden: secure Monday + Tuesday master add-to-10 and open add-to-20', () => {
    saveProgress(progressAtStep('add-to-10'))
    const mon = play('add-to-10', MON, ALL)
    expect(mon.skillLevels['add-to-10']).toBe('practicing')
    const p = play('add-to-10', TUE, ALL)
    expect(p.skillLevels['add-to-10']).toBe('mastered')
    expect(p.skillLevels['add-to-20']).toBe('intro')
    expect(p.pendingPromotion).toBe('add-to-10')
    // No good-day date is invented (P3).
    expect(p.goodDays?.['add-to-10']).toEqual([key(MON), key(TUE)])
    expect(p.secureDays?.['add-to-10']).toEqual([key(MON), key(TUE)])
    expect(loadProgress()).toEqual(p)
  })

  it('Word Song: secure Monday + Tuesday master blending-cv and open sounding-out (real blending § 1)', () => {
    saveProgress(progressAtStep('blending-cv'))
    play('blending-cv', MON, ALL)
    const p = play('blending-cv', TUE, ALL)
    expect(p.skillLevels['blending-cv']).toBe('mastered')
    expect(p.skillLevels['sounding-out']).toBe('intro')
    expect(p.pendingPromotion).toBe('blending-cv')
    expect(p.goodDays?.['blending-cv']).toEqual([key(MON), key(TUE)])
  })

  it('secure, bad, secure (Mon 8/8, Tue 5/8, Wed 8/8): a full row on Wednesday', () => {
    saveProgress(progressAtStep('add-to-10'))
    play('add-to-10', MON, ALL)
    const tue = play('add-to-10', TUE, score(5))
    expect(tue.skillLevels['add-to-10']).toBe('practicing')
    const wed = play('add-to-10', WED, ALL)
    expect(wed.skillLevels['add-to-10']).toBe('mastered')
  })
})

describe('AC4 not fast-tracked', () => {
  it('Monday secure, then Tuesday 7/8 first and 8/8 second → still practicing', () => {
    saveProgress(progressAtStep('add-to-10'))
    play('add-to-10', MON, ALL)
    play('add-to-10', TUE, SEVEN, {}, 9)
    const p = play('add-to-10', TUE, ALL, {}, 11)
    expect(p.skillLevels['add-to-10']).toBe('practicing')
    expect(p.secureDays?.['add-to-10']).toEqual([key(MON)])
  })

  it('crossDayEnforcement off with two 8/8 sessions on Monday → not mastered, 1 secure day (P5)', () => {
    saveProgress(
      withSettings(progressAtStep('add-to-10'), { crossDayEnforcement: false }),
    )
    play('add-to-10', MON, ALL, {}, 9)
    const p = play('add-to-10', MON, ALL, {}, 11)
    expect(p.skillLevels['add-to-10']).toBe('practicing')
    expect(p.secureDays?.['add-to-10']).toEqual([key(MON)])
  })

  it('first two good days not both secure: the 3rd good day masters, as before', () => {
    saveProgress(progressAtStep('add-to-10'))
    play('add-to-10', MON, ALL)
    const tue = play('add-to-10', TUE, SEVEN)
    expect(tue.skillLevels['add-to-10']).toBe('practicing')
    const wed = play('add-to-10', WED, SEVEN)
    expect(wed.skillLevels['add-to-10']).toBe('mastered')
  })
})

describe('AC5 cvc-words keeps its novel-word gate (P6)', () => {
  it('2 secure days → practicing, graduation pending, a full row awaiting the check; the graduation then masters', () => {
    saveProgress(progressAtStep('cvc-words'))
    play('cvc-words', MON, ALL)
    const p = play('cvc-words', TUE, ALL)
    expect(p.skillLevels['cvc-words']).toBe('practicing')
    expect(isGraduationSessionPending(p, 'cvc-words', 'word-song')).toBe(true)
    const np = nodeProgress(p, 'cvc-words')
    expect(np.goodDays).toBe(3)
    expect(np.requiredDays).toBe(3)
    expect(np.awaitingNovelWordCheck).toBe(true)

    const grad = play('cvc-words', WED, score(7), {
      graduationSplit: {
        canonicalCorrect: 5,
        canonicalCount: 5,
        novelCorrect: 3,
        novelCount: 3,
      },
    })
    expect(grad.skillLevels['cvc-words']).toBe('mastered')
    expect(grad.skillLevels['cvc-words-short-o']).toBe('intro')
  })
})

describe('AC6 autoPromote off', () => {
  it('2 secure days queue pendingPromotion, skillLevels unchanged, the row reads full', () => {
    saveProgress(
      withSettings(progressAtStep('add-to-10'), { autoPromote: false }),
    )
    play('add-to-10', MON, ALL)
    const p = play('add-to-10', TUE, ALL)
    expect(p.skillLevels['add-to-10']).toBe('practicing')
    expect(p.skillLevels['add-to-20']).toBe('locked')
    expect(p.pendingPromotion).toBe('add-to-10')
    const np = nodeProgress(p, 'add-to-10')
    expect(np.goodDays).toBe(np.requiredDays)
  })
})

describe('AC8 80% / 2 (Thomas’s current preset)', () => {
  it('2 secure days master through the normal rule', () => {
    const preset = { percent: 0.8, sessions: 2 }
    saveProgress(
      withSettings(progressAtStep('add-to-10'), {
        masteryThreshold: { math: preset, 'word-song': preset },
      }),
    )
    play('add-to-10', MON, ALL)
    const p = play('add-to-10', TUE, ALL)
    expect(p.skillLevels['add-to-10']).toBe('mastered')
  })
})

describe('Letter sounds per vowel', () => {
  it('a vowel fast-tracks on its own; the composite still needs all four', () => {
    saveProgress(progressAtStep('letter-sounds'))
    play('letter-sounds', MON, ALL, { currentTargetVowel: '/o/' })
    const p = play('letter-sounds', TUE, ALL, { currentTargetVowel: '/o/' })
    expect(p.literacy?.letterSoundsVowelStates?.['/o/']).toBe('mastered')
    expect(p.literacy?.letterSoundsVowelStates?.['/u/']).not.toBe('mastered')
    expect(p.skillLevels['letter-sounds']).toBe('practicing')
  })
})

describe('AC9 pace guard', () => {
  it('day scores 4/8 and 5/8 on the last two days played add the step (days need not be consecutive)', () => {
    saveProgress(progressAtStep('add-to-10'))
    play('add-to-10', MON, score(4))
    const p = play('add-to-10', WED, score(5))
    expect(p.paceHold).toEqual(['add-to-10'])
  })

  it('4/8 then 6/8 adds nothing', () => {
    saveProgress(progressAtStep('add-to-10'))
    play('add-to-10', MON, score(4))
    const p = play('add-to-10', TUE, score(6))
    expect(p.paceHold).toBeUndefined()
  })

  it('the day score is the FIRST session of the day; a later better one does not lift it', () => {
    saveProgress(progressAtStep('add-to-10'))
    play('add-to-10', MON, score(4))
    play('add-to-10', TUE, score(5), {}, 9)
    const p = play('add-to-10', TUE, score(7), {}, 11)
    expect(p.paceHold).toEqual(['add-to-10'])
  })

  it('on hold: 2 secure days do not master; 3 good days (banked ones included) do', () => {
    saveProgress(progressAtStep('add-to-10'))
    play('add-to-10', 5, score(4))
    play('add-to-10', 6, score(5))
    expect(loadProgress()!.paceHold).toEqual(['add-to-10'])
    play('add-to-10', 7, ALL)
    const second = play('add-to-10', 8, ALL)
    expect(second.secureDays?.['add-to-10']).toEqual([
      '2026-10-07',
      '2026-10-08',
    ])
    expect(fastTrackSecureDays(second, 'add-to-10')).toBeUndefined()
    expect(second.skillLevels['add-to-10']).toBe('practicing')
    expect(nodeProgress(second, 'add-to-10').goodDays).toBe(2)
    // The 3rd good day masters through the normal rule.
    const third = play('add-to-10', 9, SEVEN)
    expect(third.skillLevels['add-to-10']).toBe('mastered')
  })

  it('a hold on letter sounds turns the fast track off for its vowels', () => {
    const p: Progress = {
      ...progressAtStep('letter-sounds'),
      skillLevels: {
        ...progressAtStep('letter-sounds').skillLevels,
        'letter-sounds': 'practicing',
      },
      secureDays: { '/o/': [key(MON), key(TUE)] },
      paceHold: ['letter-sounds'],
    }
    expect(fastTrackSecureDays(p, '/o/')).toBeUndefined()
    expect(fastTrackSecureDays({ ...p, paceHold: [] }, '/o/')).toEqual([
      key(MON),
      key(TUE),
    ])
  })

  it('a mastered step never joins the list, and the list is add-only', () => {
    const p = progressAtStep('add-to-20')
    const lows: Progress = {
      ...p,
      history: [
        { dateISO: on(MON), skillFocus: ['add-to-10'], successRate: 0.25 },
        { dateISO: on(TUE), skillFocus: ['add-to-10'], successRate: 0.25 },
      ],
    }
    expect(withPaceHold(lows, 'add-to-10')).toBe(lows)
    const held = { ...lows, paceHold: ['add-to-20' as SkillNode] }
    expect(withPaceHold(held, 'add-to-20')).toBe(held)
  })

  it('dayScores: first session per local day, oldest first', () => {
    expect(
      dayScores(
        [
          { dateISO: on(TUE, 11), skillFocus: ['add-to-10'], successRate: 1 },
          { dateISO: on(MON, 9), skillFocus: ['add-to-10'], successRate: 0.5 },
          { dateISO: on(TUE, 9), skillFocus: ['add-to-10'], successRate: 0.25 },
          { dateISO: on(MON, 9), skillFocus: ['add-to-20'], successRate: 0 },
        ],
        'add-to-10',
      ),
    ).toEqual([
      { day: key(MON), score: 0.5 },
      { day: key(TUE), score: 0.25 },
    ])
  })
})

describe('AC10 isProgressV1 (secureDays, paceHold)', () => {
  const base = progressAtStep('add-to-10')
  it('accepts both fields, and their absence', () => {
    expect(isProgressV1(base)).toBe(true)
    expect(
      isProgressV1({
        ...base,
        secureDays: { 'add-to-10': [key(MON)], '/o/': [] },
        paceHold: ['add-to-10'],
      }),
    ).toBe(true)
  })
  it('rejects malformed values', () => {
    for (const secureDays of [[], 'x', { 'add-to-10': 'x' }, { a: [1] }]) {
      expect(isProgressV1({ ...base, secureDays })).toBe(false)
    }
    for (const paceHold of [{}, 'add-to-10', [1]]) {
      expect(isProgressV1({ ...base, paceHold })).toBe(false)
    }
  })
})
