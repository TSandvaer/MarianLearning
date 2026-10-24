/**
 * The Word Song session start: the web's payload (no render options: the
 * runtime-safe split), the kick latch and the frozen extras, settle
 * (resolve, failure, unreadable plan), the visible-wait fallback, the Hub
 * prefetch and the tear-down that aborts a request in flight.
 * `startSession` is faked: no network, no audio. The graduation check the
 * app builds itself is `./graduationCheck.test.ts`.
 */
import {
  STATIC_WORD_SONG_PLANS,
  wordSongSessionPlanToUtteranceSources,
} from '@marian/core/wordSong/wordSessionPlans'
import type { LoadedSessionAudio, PreparedSession } from '../audio'
import {
  createSessionPrefetcher,
  SessionStartError,
  type SessionStartArgs,
} from '../audio'
import { SESSION_START_WAIT_TIMEOUT_MS } from './sessionStartFallback'
import {
  buildWordSongSessionPayload,
  NO_EXTRAS,
  type WordSongProgressHints,
} from './wordSongHints'
import { createWordSongSessionController } from './wordSongSession'

const PLAN = STATIC_WORD_SONG_PLANS[0]
const SERVER_PLAN = {
  id: 'canon-blending-cv',
  label: 'Canon',
  utterances: wordSongSessionPlanToUtteranceSources(PLAN),
}

const NO_HINTS: WordSongProgressHints = {
  focusNode: undefined,
  focusMode: undefined,
  recentSuccessRate: undefined,
  isGraduationSession: undefined,
  lifetimeFirstEncounters: undefined,
  letterSoundsVowelStates: undefined,
  planKind: { kind: 'forward', warmup: [] },
}

const GRADUATION: WordSongProgressHints = {
  focusNode: 'cvc-words',
  focusMode: 'forward',
  recentSuccessRate: 0.9,
  isGraduationSession: true,
  lifetimeFirstEncounters: ['blending-cv'],
  letterSoundsVowelStates: undefined,
  planKind: { kind: 'forward', warmup: [] },
}

/** Letter sounds with a vowel map: built on the device since phase 4. */
const VOWEL_MAP: WordSongProgressHints = {
  focusNode: 'letter-sounds',
  focusMode: 'forward',
  recentSuccessRate: 0.9,
  isGraduationSession: false,
  lifetimeFirstEncounters: ['letter-sounds'],
  letterSoundsVowelStates: {
    '/o/': 'mastered',
    '/u/': 'practicing',
    '/i/': 'intro',
    '/e/': 'intro',
  },
  planKind: { kind: 'forward', warmup: [] },
}

function fakeAudio() {
  const audio: LoadedSessionAudio & { unload: jest.Mock } = {
    sessionId: 's',
    playUtterance: jest.fn(() => Promise.resolve()),
    playUtteranceById: jest.fn(() => Promise.resolve()),
    prewarm: jest.fn(),
    fileFor: jest.fn(() => undefined),
    textToId: new Map(),
    utteranceCount: 0,
    fileCount: 0,
    bundledCount: 0,
    filesWritten: 0,
    bytesWritten: 0,
    ready: Promise.resolve(),
    unload: jest.fn(),
  }
  return audio
}

interface Call {
  args: SessionStartArgs
  resolve: (p: PreparedSession) => void
  reject: (e: Error) => void
}

function harness(hints = NO_HINTS, extras = NO_EXTRAS) {
  const calls: Call[] = []
  const start = jest.fn(
    (args: SessionStartArgs) =>
      new Promise<PreparedSession>((resolve, reject) => {
        calls.push({ args, resolve, reject })
        args.signal?.addEventListener('abort', () =>
          reject(new SessionStartError('aborted', 'aborted')),
        )
      }),
  )
  const prefetcher = createSessionPrefetcher({ start })
  const session = createWordSongSessionController({
    start,
    readHints: () => hints,
    readExtras: () => extras,
    fallbackPlanId: () => 'word-song-shorta-A',
    now: () => 1000,
    prefetcher,
  })
  const prepared = (plan: unknown = SERVER_PLAN, vowel?: string) => {
    const audio = fakeAudio()
    return {
      audio,
      value: {
        sessionId: 'x',
        track: 'word-song',
        plan,
        currentTargetVowel: vowel,
        audio,
        fetchMs: 1,
      } as PreparedSession,
    }
  }
  return { calls, start, session, prepared, prefetcher }
}

const flush = () => new Promise((r) => setImmediate(r))

it('sends the web payload: no progress → the bare request', () => {
  expect(buildWordSongSessionPayload(NO_HINTS, true)).toEqual({
    track: 'word-song',
    level: 1,
    childName: 'friend',
  })
})

it('sends the hints, never asks for a graduation plan, and strips the vowel map for the fallback', () => {
  const full = buildWordSongSessionPayload(GRADUATION, true)
  expect(full).toEqual({
    track: 'word-song',
    level: 1,
    childName: 'friend',
    progress: {
      focusNode: 'cvc-words',
      recentSuccessRate: 0.9,
      isGraduationSession: false,
      lifetimeFirstEncounters: ['blending-cv'],
    },
  })
  expect(buildWordSongSessionPayload(GRADUATION, false)).toEqual({
    track: 'word-song',
    level: 1,
    childName: 'friend',
    progress: {
      focusNode: 'cvc-words',
      recentSuccessRate: 0.9,
      lifetimeFirstEncounters: ['blending-cv'],
    },
  })
  expect(buildWordSongSessionPayload(VOWEL_MAP, true).progress).toHaveProperty(
    'letterSoundsVowelStates',
  )
  expect(
    buildWordSongSessionPayload(VOWEL_MAP, false).progress,
  ).not.toHaveProperty('letterSoundsVowelStates')
  // Runtime-safe split: the app never asks for render options.
  expect(JSON.stringify(full)).not.toMatch(/render|synth|fidelity/i)
})

it('kicks once, publishes the frozen extras at once, then the server plan', async () => {
  const extras = {
    crossVowel: true,
    thLevel: 'intro' as const,
    thFirstEncounter: true,
  }
  const { calls, session, prepared } = harness(GRADUATION, extras)
  session.kick()
  session.kick()
  expect(calls).toHaveLength(1)
  expect(session.getSnapshot()).toMatchObject({ ...extras, audioReady: false })
  const p = prepared(SERVER_PLAN, '/o/')
  calls[0]!.resolve(p.value)
  await flush()
  const snap = session.getSnapshot()
  expect(snap.audioReady).toBe(true)
  expect(snap.crossVowel).toBe(true)
  expect(snap.plan?.problems.map((x) => x.target.word)).toEqual(
    PLAN.problems.map((x) => x.target.word),
  )
  expect(session.sessionFocus).toEqual({ node: 'cvc-words', mode: 'forward' })
  expect(session.currentTargetVowel).toBe('/o/')
  await snap.playUtterance?.('Tap the cat.')
  expect(p.audio.playUtterance).toHaveBeenCalledWith('Tap the cat.', undefined)
})

it('a failed start still releases problem 1 (static plan, silent)', async () => {
  const { calls, session } = harness()
  session.kick()
  calls[0]!.reject(new SessionStartError('network-error', 'offline'))
  await flush()
  expect(session.getSnapshot()).toMatchObject({
    plan: null,
    playUtterance: null,
    audioReady: true,
  })
})

it('an unreadable plan unloads its audio and falls back', async () => {
  const { calls, session, prepared } = harness()
  session.kick()
  const p = prepared({ id: 'bad', label: 'bad', utterances: [] })
  calls[0]!.resolve(p.value)
  await flush()
  expect(p.audio.unload).toHaveBeenCalledTimes(1)
  expect(session.getSnapshot()).toMatchObject({ plan: null, audioReady: true })
})

it('a letter-sounds vowel session gets no wait timer: the app builds it (no-Claude phase 4)', () => {
  jest.useFakeTimers()
  try {
    const { calls, session } = harness(VOWEL_MAP)
    session.kick()
    session.startWaitTimer()
    jest.advanceTimersByTime(SESSION_START_WAIT_TIMEOUT_MS * 3)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.args.signal?.aborted).toBe(false)
    expect(calls[0]!.args.payload.progress).toHaveProperty(
      'letterSoundsVowelStates',
    )
  } finally {
    jest.useRealTimers()
  }
})

it('a due graduation check gets no wait timer: there is no hinted request to abandon', () => {
  jest.useFakeTimers()
  try {
    const { calls, session } = harness(GRADUATION)
    session.kick()
    session.startWaitTimer()
    jest.advanceTimersByTime(SESSION_START_WAIT_TIMEOUT_MS * 3)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.args.signal?.aborted).toBe(false)
  } finally {
    jest.useRealTimers()
  }
})

it('tear-down aborts a request in flight and unloads a settled one', async () => {
  const { calls, session, prepared } = harness()
  session.kick()
  session.tearDown()
  expect(calls[0]!.args.signal?.aborted).toBe(true)
  expect(session.getSnapshot()).toMatchObject({ audioReady: false, plan: null })

  session.kick()
  expect(calls).toHaveLength(2)
  const p = prepared()
  calls[1]!.resolve(p.value)
  await flush()
  session.tearDown()
  expect(p.audio.unload).toHaveBeenCalledTimes(1)
  expect(session.sessionFocus).toBeNull()
})

it('a response that lands after tear-down is unloaded, never published', async () => {
  const { calls, session, prepared } = harness()
  session.kick()
  const late = calls[0]!
  session.tearDown()
  const p = prepared()
  late.resolve(p.value)
  await flush()
  expect(session.getSnapshot().audioReady).toBe(false)
})

it('the Hub prefetch is adopted by the kick when its focus still matches', async () => {
  const { calls, session } = harness(GRADUATION)
  session.prefetch()
  expect(calls).toHaveLength(1)
  session.kick()
  expect(calls).toHaveLength(1)
  session.tearDown()
  expect(calls[0]!.args.signal?.aborted).toBe(true)
})
