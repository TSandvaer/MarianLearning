/**
 * Session End's write (web `SessionEnd.tsx` mount effect) on an in-memory
 * store: what is saved, and the guidance the screen plays from it.
 */
import { setDayOffsetSource, setKeyValueStore } from '@marian/core'
import {
  defaultProgress,
  loadProgress,
  saveProgress,
  type Progress,
} from '@marian/core/progress'
import { loadStardust } from '@marian/core/shared/stardust'
import { readSessionHistory } from '@marian/core/sessionEnd/sessionHistory'
import { GRADUATION_PROBE_WORDS } from '@marian/core/wordSong/novelProbeWords'
import type { SessionEndPayload } from './sessionEndPayload'
import {
  buildLeitnerOutcomes,
  computeGraduationSplit,
  forwardLeitnerOutcomes,
  normalizeSessionEndPayload,
  PROBE_SCORING,
  writeSessionEnd,
  type ProbeScoring,
} from './sessionEndWrite'

const MATH: SessionEndPayload = {
  totalCorrect: 7,
  totalStardust: 9,
  finalStreak: 5,
  earnedThisSession: 9,
  surface: 'math',
}

const NOON = new Date('2026-10-10T12:00:00')
const clock = () => NOON
const daysAgo = (d: number) =>
  new Date(NOON.getTime() - d * 86_400_000).toISOString()

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
  // Cloud sync is skipped without a secret; nothing reaches the network.
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

const ids = (r: ReturnType<typeof writeSessionEnd>) =>
  r.guidance.lines.map((l) => l.id)

it('a null payload is a zero math session (web back-compat shim)', () => {
  expect(normalizeSessionEndPayload(null)).toEqual({
    totalCorrect: 0,
    totalStardust: 0,
    finalStreak: 0,
    earnedThisSession: 0,
    surface: 'math',
  })
})

it('saves the session history and one progress entry at the clock instant', () => {
  writeSessionEnd(MATH, { clock })
  const history = readSessionHistory()
  expect(history.sessionCount).toBe(1)
  expect(history.longestStreakEver).toBe(5)
  const progress = loadProgress()
  expect(progress?.history).toEqual([
    {
      dateISO: NOON.toISOString(),
      skillFocus: ['add-to-10'],
      successRate: 7 / 8,
    },
  ])
  expect(progress?.profile.lastPlayedISO).toBe(NOON.toISOString())
})

it('good day: praise, flower, "1 of 3", sleeps tonight', () => {
  const r = writeSessionEnd(MATH, { clock })
  expect(r.guidance.day).toBe('good-day')
  expect(r.guidance.newSlot).toBe(0)
  expect(r.guidance.countText).toBe('1 of 3')
  expect(r.guidance.slotsBefore).toEqual(['empty', 'empty', 'empty'])
  expect(r.guidance.slotsAfter).toEqual(['sleeping', 'empty', 'empty'])
  expect(ids(r)).toEqual([
    'guide.end.right.7',
    'guide.end.flower',
    'guide.end.count.1',
    'guide.end.sleeps',
  ])
})

it('3rd good day: the unlock beat and "A new path opens"', () => {
  saveProgress({
    ...defaultProgress(),
    history: [
      { dateISO: daysAgo(2), skillFocus: ['add-to-10'], successRate: 1 },
      { dateISO: daysAgo(1), skillFocus: ['add-to-10'], successRate: 1 },
    ],
  })
  const r = writeSessionEnd({ ...MATH, totalCorrect: 8 }, { clock })
  expect(r.beat.kind).toBe('unlock')
  expect(r.guidance.day).toBe('unlock')
  expect(r.guidance.countText).toBe('3 of 3!')
  expect(ids(r)).toEqual([
    'guide.end.right.8',
    'guide.end.flower',
    'guide.end.count.3',
    'guide.end.path-opens',
  ])
})

it('not-yet day: warm praise and "Play again…" once a day; the second gets praise only', () => {
  const first = writeSessionEnd({ ...MATH, totalCorrect: 5 }, { clock })
  expect(first.guidance.day).toBe('not-yet')
  expect(first.guidance.newSlot).toBeNull()
  expect(ids(first)).toEqual([
    'guide.end.not-yet.praise',
    'guide.end.not-yet.again',
  ])
  const second = writeSessionEnd({ ...MATH, totalCorrect: 4 }, { clock })
  expect(ids(second)).toEqual(['guide.end.not-yet.praise'])
})

it('same-day replay after the flower: practice, no new flower, still sleeping', () => {
  writeSessionEnd({ ...MATH, totalCorrect: 8 }, { clock })
  const replay = writeSessionEnd({ ...MATH, totalCorrect: 8 }, { clock })
  expect(replay.guidance.day).toBe('practice')
  expect(replay.guidance.newSlot).toBeNull()
  expect(replay.guidance.slotsAfter).toEqual(['sleeping', 'empty', 'empty'])
  expect(ids(replay)).toEqual(['guide.end.not-yet.praise'])
})

it('the threaded session focus wins over the re-derived one', () => {
  writeSessionEnd(
    { ...MATH, sessionFocus: { node: 'add-to-20', mode: 'forward' } },
    { clock },
  )
  expect(loadProgress()?.history[0]?.skillFocus).toEqual(['add-to-20'])
})

it('Word Song grants the +5 completion bonus; math does not', () => {
  writeSessionEnd({ ...MATH, surface: 'word-song' }, { clock })
  expect(loadStardust().total).toBe(5)
  writeSessionEnd(MATH, { clock })
  expect(loadStardust().total).toBe(5)
})

it('Leitner outcomes zip facts with first-tap correctness (overlapping prefix)', () => {
  expect(
    buildLeitnerOutcomes(
      [
        { a: 3, b: 2, op: '+' },
        { a: 1, b: 4, op: '+' },
      ],
      [true],
    ),
  ).toEqual([{ fact: { a: 3, b: 2, op: '+' }, correct: true }])
  expect(buildLeitnerOutcomes([], [true])).toBeUndefined()
})

it('one Leitner outcome per fact per session, from its first occurrence (content wave 1 § 1.7, AC 4)', () => {
  // `7 + 3` as plain addition at P2 and as `7 + ? = 10` at P4: one bond.
  const facts = [
    { a: 2, b: 2, op: '+' as const },
    { a: 7, b: 3, op: '+' as const },
    { a: 3, b: 2, op: '+' as const },
    { a: 7, b: 3, op: '+' as const },
  ]
  const outcomes = forwardLeitnerOutcomes({
    ...MATH,
    mathFacts: facts,
    perProblemCorrect: [true, false, true, true],
  })
  expect(outcomes).toEqual([
    { fact: { a: 2, b: 2, op: '+' }, correct: true },
    { fact: { a: 7, b: 3, op: '+' }, correct: false },
    { fact: { a: 3, b: 2, op: '+' }, correct: true },
  ])
  // And through the write: the box holds 7+3 once, at its first outcome.
  saveProgress(defaultProgress())
  writeSessionEnd(
    {
      ...MATH,
      mathFacts: facts,
      perProblemCorrect: [true, false, true, true],
      sessionFocus: { node: 'add-to-10', mode: 'forward' },
    },
    { clock },
  )
  const items = loadProgress()!.mathFactsLeitner.items.filter(
    (e) => e.item.a === 7 && e.item.b === 3 && e.item.op === '+',
  )
  expect(items).toHaveLength(1)
  expect(items[0]!.box).toBe(1)
})

it('no graduation split without the novel-probe word list, or on math', () => {
  const p = defaultProgress()
  const ws: SessionEndPayload = {
    ...MATH,
    surface: 'word-song',
    targetWords: ['nap', 'cat'],
    perProblemCorrect: [true, true],
  }
  expect(
    computeGraduationSplit(p, 'word-song', 'cvc-words', ws, undefined),
  ).toBeNull()
  expect(computeGraduationSplit(p, 'math', 'add-to-10', ws, ['nap'])).toBeNull()
})

it("Word Song graduation, today's check (reserve check off): the split uses core's novel probe words", () => {
  // cvc-words practicing with three good days banked: graduation pending.
  const base = defaultProgress()
  saveProgress({
    ...base,
    skillLevels: { ...base.skillLevels, 'cvc-words': 'practicing' },
    goodDays: { 'cvc-words': [daysAgo(3), daysAgo(2), daysAgo(1)] },
  })
  const ws: SessionEndPayload = {
    ...MATH,
    surface: 'word-song',
    earnedThisSession: 0,
    targetWords: ['cat', 'nap', 'bag', 'rat', 'fan', 'man', 'tap', 'hat'],
    perProblemCorrect: [true, true, true, false, true, true, true, true],
    firstTapCorrect: [true, true, true, false, true, true, true, true],
    sessionFocus: { node: 'cvc-words', mode: 'forward' },
  }
  // This bundle serves the reserve check (graduationCheck.test.ts); today's
  // check is a build without the reserve's audio.
  writeSessionEnd(ws, { clock, reserveCheck: false })
  // 3 novel words (nap, rat, tap), 2 right.
  expect(loadProgress()?.history.at(-1)?.novelPoolSuccessRate).toBeCloseTo(
    2 / 3,
  )
})

describe('probe words score on the first tap (Dave 2026-10-24, msg_a4e2ea6ad291)', () => {
  const base = defaultProgress()
  const pending: Progress = {
    ...base,
    skillLevels: { ...base.skillLevels, 'cvc-words': 'practicing' },
    goodDays: { 'cvc-words': [daysAgo(3), daysAgo(2), daysAgo(1)] },
  }
  // Probes at problems 2, 5 and 7 (nap, rat, tap), as the device's check.
  const WORDS = ['cat', 'nap', 'bag', 'van', 'rat', 'man', 'tap', 'hat']
  const PROBE = [false, true, false, false, true, false, true, false]
  const check = (
    perProblemCorrect: boolean[],
    firstTapCorrect?: boolean[],
  ): SessionEndPayload => ({
    ...MATH,
    surface: 'word-song',
    targetWords: WORDS,
    perProblemCorrect,
    ...(firstTapCorrect !== undefined ? { firstTapCorrect } : {}),
  })
  const split = (payload: SessionEndPayload, scoring?: ProbeScoring) =>
    computeGraduationSplit(
      pending,
      'word-song',
      'cvc-words',
      payload,
      GRADUATION_PROBE_WORDS,
      false,
      scoring,
    )

  it('the switch is set to first tap', () => {
    expect(PROBE_SCORING).toBe('first-tap')
  })

  it('a decoder (every first tap right): 3 of 3, each probe right', () => {
    const all = WORDS.map(() => true)
    expect(split(check(all, all))).toMatchObject({
      novelCorrect: 3,
      novelCount: 3,
      probes: [
        { word: 'nap', correct: true },
        { word: 'rat', correct: true },
        { word: 'tap', correct: true },
      ],
    })
  })

  it('a child who taps every chip (solved, first taps wrong on the probes): 0 of 3', () => {
    const solved = WORDS.map(() => true)
    const firstTaps = PROBE.map((probe) => !probe)
    expect(split(check(solved, firstTaps))).toMatchObject({
      novelCorrect: 0,
      novelCount: 3,
    })
    // Before the ruling the same session scored 3 of 3.
    expect(split(check(solved, firstTaps), 'any-tap')).toMatchObject({
      novelCorrect: 3,
    })
  })

  it('no first taps: no check session (no fall-back to perProblemCorrect)', () => {
    const all = WORDS.map(() => true)
    expect(split(check(all))).toBeNull()
    expect(split(check(all, [true, true]))).toBeNull()
  })

  it('the practised words keep perProblemCorrect (the canonical slice and its 90% rule)', () => {
    const solved = WORDS.map(() => true)
    const firstTaps = PROBE.map((probe) => probe)
    expect(split(check(solved, firstTaps))).toMatchObject({
      canonicalCorrect: 5,
      canonicalCount: 5,
      novelCorrect: 3,
    })
    const canonMissed = WORDS.map((_, i) => i !== 0)
    expect(split(check(canonMissed, solved))).toMatchObject({
      canonicalCorrect: 4,
      canonicalCount: 5,
    })
  })
})
