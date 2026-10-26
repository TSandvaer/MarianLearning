/**
 * The cvc-words graduation check, built in the app (Thomas 2026-10-23,
 * build 20 bug): a learner whose check is due gets it in her next Word Song
 * session, from the fast canon request, with no planner wait; Session End
 * then records the novel-pool score and the mastery rule decides.
 *
 * Fixture: shaped like the build-20 learner's doc (cvc-words practicing,
 * cvc-words-short-o locked, crossDayEnforcement off, Word Song threshold
 * 0.875 / 3, three good cvc-words sessions with no novel-pool score). The
 * session start is faked with the committed cvc-words canon plan: no
 * network, no audio, no paid call.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setDayOffsetSource, setKeyValueStore } from '@marian/core'
import {
  defaultProgress,
  getSettings,
  loadProgress,
  pickFocusNode,
  saveProgress,
  type Progress,
  type SeenItems,
  type SessionHistoryEntry,
} from '@marian/core/progress'
import {
  NOVEL_PROBE_WORDS,
  PROBE_RESERVE_WORDS,
} from '@marian/core/wordSong/novelProbeWords'
import type {
  LoadedSessionAudio,
  PreparedSession,
  SessionStartArgs,
} from '../audio'
import {
  GRADUATION_PROBE_PLAN,
  RENDERED_PROBE_WORDS,
  RESERVE_CHECK_READY,
} from './graduationCheck'
import { SESSION_START_WAIT_TIMEOUT_MS } from './sessionStartFallback'
import { writeSessionEnd } from './sessionEndWrite'
import {
  buildWordSongSessionPayload,
  readWordSongProgressHints,
} from './wordSongHints'
import {
  createWordSongSessionController,
  type WordSongSessionDeps,
} from './wordSongSession'

const canonDoc = (stem: string) =>
  JSON.parse(
    readFileSync(
      resolve(
        __dirname,
        '../../../public/canon/word-song/level-1',
        `${stem}.json`,
      ),
      'utf8',
    ),
  )
const CVC = canonDoc('cvc-words')
const PROBE = canonDoc('cvc-words-probe')
const CANON_WORDS = ['hat', 'fan', 'man', 'van', 'cat', 'bag', 'pan', 'tag']

/**
 * A session's words are read from the session, not from fixed slots: the
 * device plays the 8 in a new order each session (core `wordOrder.ts`, Dave
 * 2026-10-25). A check's probes stay at problems 2, 5 and 7, in order; the
 * other five are canon words, and P1 is not the last session's P1.
 */
function expectCheck(
  words: readonly string[],
  probes: readonly string[],
  lastP1: string,
) {
  expect([words[1], words[4], words[6]]).toEqual(probes)
  const practised = words.filter((_, i) => ![1, 4, 6].includes(i))
  expect(new Set(practised).size).toBe(5)
  for (const w of practised) expect(CANON_WORDS).toContain(w)
  expect(words[0]).not.toBe(lastP1)
}

/** A plain session: the 8 canon words, P1 not the last session's P1. */
function expectPlain(words: readonly string[], last: readonly string[]) {
  expect([...words].sort()).toEqual([...CANON_WORDS].sort())
  expect(words[0]).not.toBe(last[0])
  expect(words).not.toEqual(last)
}

const DAY = '2026-10-23'
const NEXT_MORNING = new Date('2026-10-24T09:00:00')
let clockNow = NEXT_MORNING
const clock = () => clockNow

const cvcEntry = (minute: number): SessionHistoryEntry => ({
  dateISO: `${DAY}T18:${String(minute).padStart(2, '0')}:00.000Z`,
  skillFocus: ['cvc-words'],
  successRate: 1,
})

/** The build-20 learner's shape, minimal. */
function dueLearner(cvcSessions = 3): Progress {
  const base = defaultProgress()
  return {
    ...base,
    skillLevels: {
      ...base.skillLevels,
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'sounding-out': 'mastered',
      'cvc-words': 'practicing',
      'cvc-words-short-o': 'locked',
    },
    parentSettings: {
      ...getSettings(base),
      autoPromote: true,
      crossDayEnforcement: false,
      masteryThreshold: {
        math: { percent: 0.875, sessions: 3 },
        'word-song': { percent: 0.875, sessions: 3 },
      },
    },
    lifetimeFirstEncounters: [
      'letter-sounds',
      'blending-cv',
      'sounding-out',
      'cvc-words',
    ],
    goodDays: { 'cvc-words': [DAY] },
    history: Array.from({ length: cvcSessions }, (_, i) => cvcEntry(i * 5)),
  }
}

function fakeAudio(lines: ReadonlyArray<{ id: string; text: string }>) {
  const textToId = new Map<string, string>()
  for (const l of lines) if (!textToId.has(l.text)) textToId.set(l.text, l.id)
  const audio: LoadedSessionAudio & {
    playUtterance: jest.Mock
    unload: jest.Mock
  } = {
    sessionId: 's',
    playUtterance: jest.fn(() => Promise.resolve()),
    playUtteranceById: jest.fn(() => Promise.resolve()),
    prewarm: jest.fn(),
    fileFor: jest.fn((text: string) =>
      textToId.has(text)
        ? { uri: `file://${textToId.get(text)}.mp3`, bytes: 1 }
        : undefined,
    ),
    textToId,
    utteranceCount: lines.length,
    fileCount: textToId.size,
    bundledCount: 0,
    filesWritten: 0,
    bytesWritten: 0,
    ready: Promise.resolve(),
    unload: jest.fn(),
  }
  return audio
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
}

/** One Word Song session start on the persisted progress. */
function startWordSong(readHints?: WordSongSessionDeps['readHints']) {
  const calls: SessionStartArgs[] = []
  const main = fakeAudio(CVC.utterances)
  const probe = fakeAudio(PROBE.utterances)
  const loadProbeAudio = jest.fn(() => probe)
  let resolveStart!: (p: PreparedSession) => void
  const start = jest.fn((args: SessionStartArgs) => {
    calls.push(args)
    return new Promise<PreparedSession>((res) => {
      resolveStart = res
    })
  })
  const deps = {
    start,
    fallbackPlanId: () => 'cvc',
    loadProbeAudio,
    ...(readHints !== undefined ? { readHints } : {}),
  } as WordSongSessionDeps
  const session = createWordSongSessionController(deps)
  session.kick()
  const settle = async () => {
    resolveStart({
      sessionId: 'x',
      track: 'word-song',
      plan: CVC.plan,
      audio: main,
      fetchMs: 1,
    })
    await flush()
    return session.getSnapshot()
  }
  return { session, calls, main, probe, loadProbeAudio, settle }
}

/**
 * Play the settled round: `correct(word)` gives each scored first tap.
 * Returns the scored words and what Session End shows.
 */
function playSession(
  snap: ReturnType<ReturnType<typeof startWordSong>['session']['getSnapshot']>,
  session: ReturnType<typeof startWordSong>['session'],
  correct: (word: string) => boolean,
  reserveCheck?: boolean,
) {
  const scored = snap.plan!.problems.slice(snap.warmupCount)
  const targetWords = scored.map((p) => p.target.word)
  const perProblemCorrect = targetWords.map(correct)
  const result = writeSessionEnd(
    {
      totalCorrect: perProblemCorrect.filter(Boolean).length,
      totalStardust: 0,
      finalStreak: 0,
      earnedThisSession: 0,
      surface: 'word-song',
      targetWords,
      perProblemCorrect,
      firstTapCorrect: perProblemCorrect,
      sessionFocus: session.sessionFocus ?? undefined,
    },
    { clock, ...(reserveCheck !== undefined ? { reserveCheck } : {}) },
  )
  session.tearDown()
  return { targetWords, result }
}

/** {@link playSession}, keeping only the scored words. */
const endSession = (...args: Parameters<typeof playSession>) =>
  playSession(...args).targetWords

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
  clockNow = NEXT_MORNING
  jest.useFakeTimers({ now: NEXT_MORNING, doNotFake: ['setImmediate'] })
  // Cloud sync is skipped without a secret; nothing reaches the network.
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it('a due check rides the fast canon request: no planner hint, no 5 s fallback', async () => {
  saveProgress(dueLearner())
  expect(readWordSongProgressHints().isGraduationSession).toBe(true)
  const { session, calls, settle } = startWordSong()
  expect(calls).toHaveLength(1)
  const progress = calls[0]!.payload.progress as Record<string, unknown>
  expect(progress.focusNode).toBe('cvc-words')
  // The server serves canon unless asked for a graduation plan: neither
  // the kick's request nor the Hub prefetch's asks.
  expect(progress.isGraduationSession).not.toBe(true)
  expect(
    (
      buildWordSongSessionPayload(readWordSongProgressHints(), true)
        .progress as Record<string, unknown>
    ).isGraduationSession,
  ).toBe(false)
  session.startWaitTimer()
  jest.advanceTimersByTime(SESSION_START_WAIT_TIMEOUT_MS * 3)
  expect(calls).toHaveLength(1)
  const snap = await settle()
  expect(snap.audioReady).toBe(true)
})

/**
 * Today's check (3 of nap, rat, map, tap by attempt): what a build without
 * the reserve's audio serves. This bundle serves the reserve check
 * (`the probe reserve on the device` below); these tests pin the fallback.
 */
const todaysCheck = () => readWordSongProgressHints(new Set(NOVEL_PROBE_WORDS))

it('the due session holds three probe words in canon problem shape', async () => {
  saveProgress(dueLearner())
  const { settle, main, probe, loadProbeAudio, session } =
    startWordSong(todaysCheck)
  const snap = await settle()
  const scored = snap.plan!.problems.slice(snap.warmupCount)
  // Her cvc-words sessions so far played the canon order (hat first).
  expectCheck(
    scored.map((p) => p.target.word),
    ['nap', 'rat', 'map'],
    'hat',
  )
  const nap = scored[1]!
  expect(nap.contentType).toBe(scored[0]!.contentType)
  expect(nap.utterances).toEqual({
    read: 'Read the nap.',
    correct: "Yes! That's a nap.",
    reprompt: 'Hmm... try again?',
    hint: "Let's look. Nap.",
    giveAnswer: 'This one is nap.',
    blend: 'n - a - p ... nap',
  })
  // The probe lines play from the bundled probe audio, the rest from the
  // session's.
  expect(loadProbeAudio).toHaveBeenCalledTimes(1)
  const p1 = scored[0]!.utterances.read
  await snap.playUtterance!('Read the nap.')
  await snap.playUtterance!(p1)
  expect(probe.playUtterance).toHaveBeenCalledWith('Read the nap.', undefined)
  expect(main.playUtterance).toHaveBeenCalledWith(p1, undefined)
  expect(main.playUtterance).not.toHaveBeenCalledWith(
    'Read the nap.',
    undefined,
  )
  expect(snap.clipFor!('n - a - p ... nap')?.uri).toBe(
    'file://word.p1.blend.mp3',
  )
  session.tearDown()
  expect(probe.unload).toHaveBeenCalledTimes(1)
  expect(main.unload).toHaveBeenCalledTimes(1)
})

it('all correct: the novel-pool score is 1, cvc-words is mastered and short-o is next', async () => {
  saveProgress(dueLearner())
  const { settle, session } = startWordSong(todaysCheck)
  const snap = await settle()
  clockNow = new Date('2026-10-24T09:15:00')
  endSession(snap, session, () => true, false)
  const after = loadProgress()!
  expect(after.history.at(-1)!.novelPoolSuccessRate).toBe(1)
  expect(after.skillLevels['cvc-words']).toBe('mastered')
  expect(after.skillLevels['cvc-words-short-o']).toBe('intro')
  expect(pickFocusNode(after, 'word-song').node).toBe('cvc-words-short-o')
})

it('a missed check (novel < 0.8) does not master, and the re-check waits one plain session (check fold-in (3))', async () => {
  saveProgress(dueLearner())
  const first = startWordSong(todaysCheck)
  const words = endSession(
    await first.settle(),
    first.session,
    (w) => w !== 'rat',
    false,
  )
  expect(words.filter((w) => NOVEL_PROBE_WORDS.includes(w))).toHaveLength(3)
  let after = loadProgress()!
  expect(after.history.at(-1)!.novelPoolSuccessRate).toBeCloseTo(2 / 3)
  expect(after.skillLevels['cvc-words']).toBe('practicing')

  // One plain session after a failed attempt.
  expect(todaysCheck().isGraduationSession).toBe(false)
  const s = startWordSong(todaysCheck)
  const plain = endSession(await s.settle(), s.session, () => true, false)
  expectPlain(plain, words)
  expect(s.loadProbeAudio).not.toHaveBeenCalled()
  after = loadProgress()!
  expect(after.skillLevels['cvc-words']).toBe('practicing')

  // Then the check is due again, leading with a different probe word.
  expect(todaysCheck().isGraduationSession).toBe(true)
  const again = startWordSong(todaysCheck)
  const snap = await again.settle()
  expectCheck(
    snap.plan!.problems.slice(snap.warmupCount).map((p) => p.target.word),
    ['rat', 'map', 'tap'],
    plain[0]!,
  )
})

it('with no check due, the session is the one today ships: same requests, plain canon round', async () => {
  // The plain session after a failed attempt (check fold-in (3)).
  const learner = dueLearner(2)
  saveProgress({
    ...learner,
    history: [
      ...learner.history,
      { ...cvcEntry(10), novelPoolSuccessRate: 0.5 },
    ],
  })
  const hints = readWordSongProgressHints()
  expect(hints.isGraduationSession).toBe(false)
  const lifetimeFirstEncounters = [
    'letter-sounds',
    'blending-cv',
    'sounding-out',
    'cvc-words',
  ]
  const warmup =
    hints.planKind.kind === 'forward' && hints.planKind.warmup.length > 0
      ? { warmup: expect.anything() }
      : {}
  // The Hub prefetch's request (hints on), as today.
  expect(buildWordSongSessionPayload(hints, true)).toEqual({
    track: 'word-song',
    level: 1,
    childName: 'friend',
    progress: {
      focusNode: 'cvc-words',
      recentSuccessRate: 1,
      isGraduationSession: false,
      lifetimeFirstEncounters,
    },
    ...warmup,
  })
  // The kick's request (no canon-bypassing hint, so hints off), as today.
  const { settle, calls, main, loadProbeAudio, session } = startWordSong()
  expect(calls[0]!.payload).toEqual({
    track: 'word-song',
    level: 1,
    childName: 'friend',
    progress: {
      focusNode: 'cvc-words',
      recentSuccessRate: 1,
      lifetimeFirstEncounters,
    },
    ...warmup,
  })
  const snap = await settle()
  const scored = snap.plan!.problems.slice(snap.warmupCount)
  // The canon words in this session's order (her last sessions: canon).
  expectPlain(
    scored.map((p) => p.target.word),
    CANON_WORDS,
  )
  expect(loadProbeAudio).not.toHaveBeenCalled()
  await snap.playUtterance!(scored[0]!.utterances.read)
  expect(main.playUtterance).toHaveBeenCalledWith(
    scored[0]!.utterances.read,
    undefined,
  )
  session.tearDown()
})

it('bundles the web probe lines byte for byte, every one rendered (npm run export-audio)', () => {
  const rel = 'canon/word-song/level-1/cvc-words-probe.json'
  expect(
    readFileSync(resolve(__dirname, '../../assets/canon/cvc-words-probe.json')),
  ).toEqual(readFileSync(resolve(__dirname, '../../../public', rel)))
  expect(GRADUATION_PROBE_PLAN).toEqual(PROBE.plan)
  const unrendered = PROBE.utterances
    .filter((u: { audio: { base64: string } }) => u.audio.base64 === '')
    .map((u: { text: string }) => u.text)
  expect(unrendered).toEqual([])
})

describe('the probe reserve on the device (Dave 2026-10-24)', () => {
  const ALL_RENDERED: ReadonlySet<string> = new Set([
    ...NOVEL_PROBE_WORDS,
    ...PROBE_RESERVE_WORDS,
  ])
  const scoredWords = (
    snap: ReturnType<
      ReturnType<typeof startWordSong>['session']['getSnapshot']
    >,
  ) => snap.plan!.problems.slice(snap.warmupCount).map((p) => p.target.word)

  it('this bundle serves the reserve check: every probe word rendered, none served without audio', async () => {
    expect([...RENDERED_PROBE_WORDS].sort()).toEqual([...ALL_RENDERED].sort())
    expect(RESERVE_CHECK_READY).toBe(true)
    const met = { day: DAY, count: 1, correct: null }
    const missed = { ...met, correct: false, check: 'missed' }
    const seenRecords: (SeenItems | undefined)[] = [
      undefined,
      { 'word:ham': met, 'word:cab': met, 'word:map': met },
      { 'word:nap': missed, 'word:rat': missed },
    ]
    for (const seenItems of seenRecords) {
      for (let failed = 0; failed < 5; failed++) {
        const learner = dueLearner()
        saveProgress({
          ...learner,
          ...(seenItems !== undefined ? { seenItems } : {}),
          history: [
            ...Array.from({ length: failed }, (_, i) => ({
              ...cvcEntry(40 + i),
              novelPoolSuccessRate: 0.5,
            })),
            ...learner.history,
          ],
        })
        const words = readWordSongProgressHints().probeWords!
        expect(words).toHaveLength(3)
        for (const w of words) expect(RENDERED_PROBE_WORDS.has(w)).toBe(true)
      }
    }
    // The bundle's own hints are the reserve check's: the tests below run
    // on them, with no rendered-words seam.
    saveProgress(dueLearner())
    expect(readWordSongProgressHints()).toEqual(
      readWordSongProgressHints(ALL_RENDERED),
    )
  }, 15_000)

  it('with every word rendered: two check sessions of 3 probe words, and 5 of 6 masters cvc-words', async () => {
    saveProgress(dueLearner())
    const first = startWordSong()
    const one = scoredWords(await first.settle())
    expectCheck(one, ['map', 'nap', 'rat'], 'hat')
    clockNow = new Date('2026-10-24T09:15:00')
    endSession(await first.settle(), first.session, () => true)
    let after = loadProgress()!
    expect(after.history.at(-1)!.novelPoolPart).toEqual({
      words: ['map', 'nap', 'rat'],
      correct: 3,
      next: ['ham', 'cab', 'rag'],
    })
    expect(after.history.at(-1)!.novelPoolSuccessRate).toBeUndefined()
    expect(after.skillLevels['cvc-words']).toBe('practicing')
    expect(after.seenItems?.['word:map']?.check).toBe('right')

    // The second session is the check again, with the next 3 words.
    expect(readWordSongProgressHints().isGraduationSession).toBe(true)
    const second = startWordSong()
    const two = scoredWords(await second.settle())
    expectCheck(two, ['ham', 'cab', 'rag'], one[0]!)
    clockNow = new Date('2026-10-24T09:40:00')
    endSession(await second.settle(), second.session, (w) => w !== 'cab')
    after = loadProgress()!
    expect(after.history.at(-1)!.novelPoolSuccessRate).toBeCloseTo(5 / 6)
    expect(after.skillLevels['cvc-words']).toBe('mastered')
    expect(after.seenItems?.['word:cab']?.check).toBe('missed')
  })

  it('4 of 6 holds her; after the 1 plain session the retake is 2 fresh words, then words she read right', async () => {
    saveProgress(dueLearner())
    const miss = new Set(['map', 'nap'])
    for (const minute of [15, 40]) {
      const s = startWordSong()
      clockNow = new Date(`2026-10-24T09:${minute}:00`)
      endSession(await s.settle(), s.session, (w) => !miss.has(w))
    }
    const after = loadProgress()!
    expect(after.history.at(-1)!.novelPoolSuccessRate).toBeCloseTo(4 / 6)
    expect(after.skillLevels['cvc-words']).toBe('practicing')
    // The 1 plain session after a failed attempt (check fold-in (3)).
    expect(readWordSongProgressHints().isGraduationSession).toBe(false)
    const s = startWordSong()
    clockNow = new Date('2026-10-24T10:00:00')
    endSession(await s.settle(), s.session, () => true)
    expect(readWordSongProgressHints().probeWords).toEqual([
      'ram',
      'pad',
      'rat',
    ])
  }, 15_000)
})

describe('Session End after the check (build 21: a pass read as the not-yet day)', () => {
  const ids = (r: ReturnType<typeof playSession>['result']) =>
    r.guidance.lines.map((l) => l.id)
  const FULL = ['grown', 'grown', 'grown']
  // Three good days banked, the 3rd held for the check (check fold-in (4)).
  const HELD = ['grown', 'grown', 'empty']

  it('one-session check: a pass lands the held flower on the unlock day', async () => {
    saveProgress(dueLearner())
    const { settle, session } = startWordSong(todaysCheck)
    const snap = await settle()
    clockNow = new Date('2026-10-24T09:15:00')
    const { result } = playSession(snap, session, () => true, false)
    expect(loadProgress()!.skillLevels['cvc-words']).toBe('mastered')
    expect(result.beat.kind).toBe('unlock')
    expect(result.guidance.day).toBe('unlock')
    expect(result.guidance.slotsBefore).toEqual(HELD)
    expect(result.guidance.slotsAfter).toEqual(FULL)
    expect(result.guidance.newSlot).toBe(2)
    expect(ids(result)).toEqual([
      'guide.end.right.8',
      'guide.end.flower',
      'guide.end.count.3',
      'guide.end.path-opens',
    ])
  })

  it('reserve check half 1: the practice ending, never "Play again…"', async () => {
    saveProgress(dueLearner())
    const first = startWordSong()
    clockNow = new Date('2026-10-24T09:15:00')
    const { result } = playSession(
      await first.settle(),
      first.session,
      () => true,
    )
    expect(loadProgress()!.history.at(-1)!.novelPoolPart).toBeDefined()
    expect(loadProgress()!.skillLevels['cvc-words']).toBe('practicing')
    expect(result.guidance.day).toBe('practice')
    expect(result.guidance.slotsAfter).toEqual(HELD)
    expect(result.guidance.newSlot).toBeNull()
    expect(result.guidance.countText).toBeNull()
    expect(ids(result)).toEqual(['guide.end.not-yet.praise'])
  })

  it('a check not passed (half 2 the next day, 4 of 6) and the session after it end the same way', async () => {
    saveProgress(dueLearner())
    const miss = new Set(['map', 'nap'])
    const first = startWordSong()
    clockNow = new Date('2026-10-24T09:15:00')
    playSession(await first.settle(), first.session, (w) => !miss.has(w))
    const second = startWordSong()
    const snap = await second.settle()
    expect(
      snap.plan!.problems.slice(snap.warmupCount).map((p) => p.target.word),
    ).toContain('cab')
    clockNow = new Date('2026-10-25T09:15:00')
    const failed = playSession(snap, second.session, () => true).result
    expect(loadProgress()!.history.at(-1)!.novelPoolSuccessRate).toBeCloseTo(
      4 / 6,
    )
    expect(loadProgress()!.skillLevels['cvc-words']).toBe('practicing')
    // The next day's plain session, inside the cooldown.
    expect(readWordSongProgressHints().isGraduationSession).toBe(false)
    const plain = startWordSong()
    clockNow = new Date('2026-10-26T09:15:00')
    const after = playSession(
      await plain.settle(),
      plain.session,
      () => true,
    ).result
    for (const result of [failed, after]) {
      expect(result.guidance.day).toBe('practice')
      expect(result.guidance.slotsAfter).toEqual(HELD)
      expect(result.guidance.newSlot).toBeNull()
      expect(ids(result)).toEqual(['guide.end.not-yet.praise'])
    }
  })

  it('reserve check: the second half’s pass lands the held flower on the unlock day, not practice', async () => {
    saveProgress(dueLearner())
    const first = startWordSong()
    clockNow = new Date('2026-10-24T09:15:00')
    playSession(await first.settle(), first.session, () => true)
    expect(loadProgress()!.skillLevels['cvc-words']).toBe('practicing')
    const second = startWordSong()
    clockNow = new Date('2026-10-24T09:40:00')
    const { result } = playSession(
      await second.settle(),
      second.session,
      (w) => w !== 'cab',
    )
    expect(loadProgress()!.skillLevels['cvc-words']).toBe('mastered')
    expect(result.guidance.day).toBe('unlock')
    expect(result.guidance.slotsAfter).toEqual(FULL)
    expect(result.guidance.newSlot).toBe(2)
    expect(ids(result)).toEqual([
      'guide.end.right.7',
      'guide.end.flower',
      'guide.end.count.3',
      'guide.end.path-opens',
    ])
  })
})
