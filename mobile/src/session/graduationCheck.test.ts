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
  type SessionHistoryEntry,
} from '@marian/core/progress'
import { NOVEL_PROBE_WORDS } from '@marian/core/wordSong/novelProbeWords'
import type {
  LoadedSessionAudio,
  PreparedSession,
  SessionStartArgs,
} from '../audio'
import { GRADUATION_PROBE_PLAN } from './graduationCheck'
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
function startWordSong() {
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

/** Play the settled round: `correct(word)` gives each scored first tap. */
function endSession(
  snap: ReturnType<ReturnType<typeof startWordSong>['session']['getSnapshot']>,
  session: ReturnType<typeof startWordSong>['session'],
  correct: (word: string) => boolean,
) {
  const scored = snap.plan!.problems.slice(snap.warmupCount)
  const targetWords = scored.map((p) => p.target.word)
  const perProblemCorrect = targetWords.map(correct)
  writeSessionEnd(
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
    { clock },
  )
  session.tearDown()
  return targetWords
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

it('the due session holds three probe words in canon problem shape', async () => {
  saveProgress(dueLearner())
  const { settle, main, probe, loadProbeAudio, session } = startWordSong()
  const snap = await settle()
  const scored = snap.plan!.problems.slice(snap.warmupCount)
  expect(scored.map((p) => p.target.word)).toEqual([
    'hat',
    'nap',
    'man',
    'van',
    'rat',
    'bag',
    'map',
    'tag',
  ])
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
  await snap.playUtterance!('Read the nap.')
  await snap.playUtterance!('Read the hat.')
  expect(probe.playUtterance).toHaveBeenCalledWith('Read the nap.', undefined)
  expect(main.playUtterance).toHaveBeenCalledWith('Read the hat.', undefined)
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
  const { settle, session } = startWordSong()
  const snap = await settle()
  clockNow = new Date('2026-10-24T09:15:00')
  endSession(snap, session, () => true)
  const after = loadProgress()!
  expect(after.history.at(-1)!.novelPoolSuccessRate).toBe(1)
  expect(after.skillLevels['cvc-words']).toBe('mastered')
  expect(after.skillLevels['cvc-words-short-o']).toBe('intro')
  expect(pickFocusNode(after, 'word-song').node).toBe('cvc-words-short-o')
})

it('a missed check (novel < 0.8) does not master, and the re-check waits three sessions', async () => {
  saveProgress(dueLearner())
  const first = startWordSong()
  const words = endSession(
    await first.settle(),
    first.session,
    (w) => w !== 'rat',
  )
  expect(words.filter((w) => NOVEL_PROBE_WORDS.includes(w))).toHaveLength(3)
  let after = loadProgress()!
  expect(after.history.at(-1)!.novelPoolSuccessRate).toBeCloseTo(2 / 3)
  expect(after.skillLevels['cvc-words']).toBe('practicing')

  // Three plain sessions push the miss out of the window.
  for (let i = 0; i < 3; i++) {
    expect(readWordSongProgressHints().isGraduationSession).toBe(false)
    const s = startWordSong()
    const plain = endSession(await s.settle(), s.session, () => true)
    expect(plain).toEqual(CANON_WORDS)
    expect(s.loadProbeAudio).not.toHaveBeenCalled()
  }
  after = loadProgress()!
  expect(after.skillLevels['cvc-words']).toBe('practicing')

  // Then the check is due again, leading with a different probe word.
  expect(readWordSongProgressHints().isGraduationSession).toBe(true)
  const again = startWordSong()
  const snap = await again.settle()
  expect(
    snap.plan!.problems.slice(snap.warmupCount).map((p) => p.target.word),
  ).toEqual(['hat', 'rat', 'man', 'van', 'map', 'bag', 'tap', 'tag'])
})

it('with no check due, the session is the one today ships: same requests, plain canon round', async () => {
  saveProgress(dueLearner(2))
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
  expect(
    snap.plan!.problems.slice(snap.warmupCount).map((p) => p.target.word),
  ).toEqual(CANON_WORDS)
  expect(loadProbeAudio).not.toHaveBeenCalled()
  await snap.playUtterance!('Read the hat.')
  expect(main.playUtterance).toHaveBeenCalledWith('Read the hat.', undefined)
  session.tearDown()
})

it('bundles the web probe lines byte for byte, every one rendered (npm run export-audio)', () => {
  const rel = 'canon/word-song/level-1/cvc-words-probe.json'
  expect(
    readFileSync(resolve(__dirname, '../../assets/canon/cvc-words-probe.json')),
  ).toEqual(readFileSync(resolve(__dirname, '../../../public', rel)))
  expect(GRADUATION_PROBE_PLAN).toEqual(PROBE.plan)
  expect(
    PROBE.utterances.filter(
      (u: { audio: { base64: string } }) => u.audio.base64 === '',
    ),
  ).toEqual([])
})
