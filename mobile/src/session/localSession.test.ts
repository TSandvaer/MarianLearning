/**
 * No-Claude plan phase 2 on the device: a hint-free session is built from
 * the bundled canon with no network call and no wait, a hinted one still
 * goes to the server, and a local build that throws falls back to it.
 * The plan and lines equal the server's: `tests/noClaude/
 * localSessionParity.test.ts` (root vitest) runs the real handler.
 */
import { setApiBase } from '@marian/core/platform/apiUrl'
import type { CanonText } from '@marian/core/session/composeSession'
import canonText from '../../assets/canon/canon-text.json'
import { fakePlayerFactory, resetFakePlayers } from '../../test/fakeAudio'
import { _resetAudioLogForTests, readAudioLog } from '../audio/audioLog'
import { canonClipFor } from '../audio/bundledAudio'
import { createAudioEngine, type AudioEngine } from '../audio/engine'
import {
  currentSessionAudio,
  type SessionFileStore,
} from '../audio/sessionAudio'
import { SessionStartError, type SessionStartPayload } from '../audio'
import { bundledCanonText, startSessionLocalFirst } from './localSession'
import {
  createMathSessionController,
  type MathProgressHints,
} from './mathSession'
import { requestPeek, requestReplay } from './peekSession'
import {
  createWordSongSessionController,
  type WordSongSessionController,
} from './wordSongSession'
import { NO_EXTRAS, type WordSongProgressHints } from './wordSongHints'

const CANON = canonText as unknown as Readonly<Record<string, CanonText>>
const planOf = (path: string) => CANON[path]!.plan as { id: string }

/** A file store that fails the test if a local session writes a file. */
function noFiles(): SessionFileStore & { writes: number } {
  const store = {
    writes: 0,
    write() {
      store.writes += 1
      return { uri: 'file:///x.mp3', bytes: 1 }
    },
    removeSession() {},
    removeAllExcept: () => 0,
  }
  return store
}

/** A server answer for `payload` with inline audio (a fake MP3 header). */
function serverAnswer(path: string) {
  const entry = CANON[path]!
  return {
    ok: true,
    kind: 'session-start',
    plan: entry.plan,
    utterances: entry.utterances.map((u) => ({
      ...u,
      audio: { kind: 'inline', base64: 'SUQzBAAAAAAA', mime: 'audio/mpeg' },
    })),
  }
}

const fetchOf = (body: unknown) =>
  jest.fn(async () => ({ ok: true, status: 200, json: async () => body }))

const payload = (
  track: 'math' | 'word-song',
  extra: Record<string, unknown> = {},
): SessionStartPayload => ({ track, level: 1, childName: 'friend', ...extra })

let engine: AudioEngine
let files: ReturnType<typeof noFiles>
const offline = globalThis.fetch as jest.Mock

beforeEach(() => {
  resetFakePlayers()
  _resetAudioLogForTests()
  engine = createAudioEngine({ createPlayer: fakePlayerFactory })
  files = noFiles()
  currentSessionAudio()?.unload()
  offline.mockClear()
  setApiBase('https://example.test')
})

describe('startSessionLocalFirst', () => {
  it('a hint-free session: the canon plan, bundled audio, no network call', async () => {
    const fetch = fetchOf(serverAnswer('math/level-1/add-to-20'))
    const prepared = await startSessionLocalFirst(
      {
        sessionId: 's1',
        payload: payload('math', { progress: { focusNode: 'add-to-20' } }),
      },
      { fetch: fetch as never, engine, files },
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(prepared.plan).toEqual(CANON['math/level-1/add-to-20']!.plan)
    expect(prepared.track).toBe('math')
    const texts = new Set(
      CANON['math/level-1/add-to-20']!.utterances.map((u) => u.text),
    )
    expect(prepared.audio.bundledCount).toBe(texts.size)
    expect(prepared.audio.fileCount).toBe(0)
    expect(files.writes).toBe(0)
    expect(readAudioLog()).toContainEqual(
      expect.objectContaining({
        kind: 'session-load',
        label: 'session-local math',
        detail: 'canon add-to-20, 76 utterances',
      }),
    )
  })

  it.each([
    [
      'a review',
      payload('math', {
        review: {
          blocks: [1, 2, 3, 4, 5, 6, 7, 8].map((problem) => ({
            node: problem % 2 ? 'add-to-10' : 'sub-to-10',
            problem,
          })),
        },
      }),
      'review-math',
    ],
    [
      'a Word Song warm-up',
      payload('word-song', {
        progress: { focusNode: 'cvc-words-short-o' },
        warmup: { blocks: [{ node: 'cvc-words', problem: 4 }] },
      }),
      planOf('word-song/level-1/cvc-words-short-o').id,
    ],
    [
      'a times mix',
      payload('math', {
        progress: { focusNode: 'mult-mix' },
        mix: {
          blocks: [1, 2, 3, 4, 5, 6, 7, 8].map((problem) => ({
            node: 'mult-3-4',
            problem,
          })),
        },
      }),
      'mix-math',
    ],
    [
      'an all-intro letter-sounds vowel map',
      payload('word-song', {
        progress: {
          focusNode: 'letter-sounds',
          letterSoundsVowelStates: {
            '/o/': 'intro',
            '/u/': 'intro',
            '/i/': 'intro',
            '/e/': 'intro',
          },
        },
      }),
      planOf('word-song/level-1/letter-sounds').id,
    ],
  ])('%s is built on the device', async (_name, sent, planId) => {
    const fetch = fetchOf({})
    const prepared = await startSessionLocalFirst(
      { sessionId: 's2', payload: sent },
      { fetch: fetch as never, engine, files },
    )
    expect(fetch).not.toHaveBeenCalled()
    expect((prepared.plan as { id: string }).id).toBe(planId)
    expect(prepared.audio.fileCount).toBe(0)
  })

  it.each([
    [
      'the add-to-10 Leitner box',
      payload('math', {
        progress: {
          focusNode: 'add-to-10',
          leitner: [{ a: 3, b: 4, op: '+', box: 1 }],
        },
      }),
      'math/level-1/add-to-10',
    ],
    [
      'a practising letter-sounds vowel map',
      payload('word-song', {
        progress: {
          focusNode: 'letter-sounds',
          letterSoundsVowelStates: {
            '/o/': 'practicing',
            '/u/': 'intro',
            '/i/': 'intro',
            '/e/': 'intro',
          },
        },
      }),
      'word-song/level-1/letter-sounds',
    ],
  ])(
    'a hinted session (%s) still goes to the server',
    async (_name, sent, path) => {
      const fetch = fetchOf(serverAnswer(path))
      const prepared = await startSessionLocalFirst(
        { sessionId: 's3', payload: sent },
        { fetch: fetch as never, engine, files },
      )
      expect(fetch).toHaveBeenCalledTimes(1)
      const [url, init] = fetch.mock.calls[0] as unknown as [
        string,
        { body: string },
      ]
      expect(url).toBe('https://example.test/api/claude')
      expect(JSON.parse(init.body)).toEqual({
        kind: 'session-start',
        payload: sent,
      })
      expect(prepared.plan).toEqual(CANON[path]!.plan)
    },
  )

  it('a local build that throws falls back to the server, and says so', async () => {
    const fetch = fetchOf(serverAnswer('math/level-1/add-to-20'))
    const prepared = await startSessionLocalFirst(
      {
        sessionId: 's4',
        payload: payload('math', { progress: { focusNode: 'add-to-20' } }),
      },
      {
        fetch: fetch as never,
        engine,
        files,
        compose: () => {
          throw new Error('boom')
        },
      },
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(prepared.plan).toEqual(CANON['math/level-1/add-to-20']!.plan)
    expect(readAudioLog()).toContainEqual({
      kind: 'note',
      label: 'session-local',
      detail: 'build failed, asking the server: boom',
    })
  })

  it('a step this build has no canon for goes to the server', async () => {
    const fetch = fetchOf(serverAnswer('math/level-1/add-to-20'))
    await startSessionLocalFirst(
      {
        sessionId: 's5',
        payload: payload('math', { progress: { focusNode: 'add-to-20' } }),
      },
      { fetch: fetch as never, engine, files, resolveCanon: () => null },
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('a request the bundle cannot serve goes to the server (its 400 is the answer)', async () => {
    const fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid-request' }),
    }))
    await expect(
      startSessionLocalFirst(
        {
          sessionId: 's6',
          payload: payload('math', {
            review: { blocks: [{ node: 'add-to-10', problem: 1 }] },
          }),
        },
        { fetch: fetch as never, engine, files },
      ),
    ).rejects.toEqual(
      new SessionStartError('invalid-response', 'session-start returned 400'),
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(readAudioLog()).toContainEqual({
      kind: 'note',
      label: 'session-local',
      detail: 'not built (review must name 8 canon blocks), asking the server',
    })
  })

  it('an aborted request does not load', async () => {
    const abort = new AbortController()
    abort.abort()
    await expect(
      startSessionLocalFirst(
        { sessionId: 's7', payload: payload('math'), signal: abort.signal },
        { engine, files },
      ),
    ).rejects.toMatchObject({ code: 'aborted' })
    expect(currentSessionAudio()).toBeNull()
  })

  it('every line of every bundled canon file has its bundled clip', () => {
    const missing: string[] = []
    for (const [path, entry] of Object.entries(CANON)) {
      for (const u of entry.utterances) {
        if (canonClipFor(u.text) === undefined) missing.push(`${path} ${u.id}`)
      }
    }
    expect(missing).toEqual([])
    expect(
      bundledCanonText({ track: 'math', level: 2, focusNode: 'add-to-10' }),
    ).toBeNull()
    // The no-regroup step reads its old file name, as on the server.
    expect(
      bundledCanonText({
        track: 'math',
        level: 1,
        focusNode: 'two-digit-addsub-no-regroup',
      }),
    ).toBe(CANON['math/level-1/two-digit-addsub'])
  })
})

/** Settle promise chains without running a timer. */
async function microtasks() {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

const MATH: MathProgressHints = {
  focusNode: 'sub-to-20',
  focusMode: 'forward',
  recentSuccessRate: 0.8,
  leitner: undefined,
  slowFacts: undefined,
  lifetimeFirstEncounters: ['add-to-10'],
  planKind: { kind: 'forward', warmup: [] },
}

const WORDS: WordSongProgressHints = {
  focusNode: 'cvc-words-short-u',
  focusMode: 'forward',
  recentSuccessRate: 0.9,
  isGraduationSession: false,
  lifetimeFirstEncounters: ['cvc-words'],
  letterSoundsVowelStates: undefined,
  planKind: { kind: 'forward', warmup: [] },
}

describe('the session controllers start local sessions with no wait', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    jest.useRealTimers()
  })

  it('Number Garden: ready with the canon plan before any timer runs, no fetch', async () => {
    const math = createMathSessionController({
      readHints: () => MATH,
      fallbackPlanId: () => 'x',
    })
    math.kick()
    await microtasks()
    const snap = math.getSnapshot()
    expect(snap.audioReady).toBe(true)
    expect(snap.plan?.problems).toHaveLength(8)
    expect(snap.playUtterance).not.toBeNull()
    expect(offline).not.toHaveBeenCalled()
    math.tearDown()
  })

  it('Number Garden review: built on the device too', async () => {
    const math = createMathSessionController({
      readHints: () => ({
        ...MATH,
        planKind: {
          kind: 'review',
          blocks: [1, 2, 3, 4, 5, 6, 7, 8].map((problem) => ({
            node: problem % 2 ? 'add-to-10' : 'add-to-20',
            problem,
          })),
        },
      }),
      fallbackPlanId: () => 'x',
    })
    math.kick()
    await microtasks()
    expect(math.getSnapshot()).toMatchObject({ audioReady: true, review: true })
    expect(offline).not.toHaveBeenCalled()
    math.tearDown()
  })

  it('Word Song: ready with the canon plan before any timer runs, no fetch', async () => {
    const words: WordSongSessionController = createWordSongSessionController({
      readHints: () => WORDS,
      readExtras: () => NO_EXTRAS,
      fallbackPlanId: () => 'x',
    })
    words.kick()
    await microtasks()
    const snap = words.getSnapshot()
    expect(snap.audioReady).toBe(true)
    expect(snap.plan?.problems).toHaveLength(8)
    expect(offline).not.toHaveBeenCalled()
    words.tearDown()
  })

  it('a hinted Number Garden session still asks the server (offline here: the static plan)', async () => {
    const math = createMathSessionController({
      readHints: () => ({
        ...MATH,
        focusNode: 'add-to-10',
        leitner: [{ a: 3, b: 4, op: '+', box: 1 }],
      }),
      fallbackPlanId: () => 'x',
    })
    math.kick()
    await microtasks()
    expect(offline).toHaveBeenCalledTimes(1)
    expect(math.getSnapshot()).toMatchObject({ audioReady: true, plan: null })
    math.tearDown()
  })

  it('the Map peek and replay: built on the device', async () => {
    const signal = new AbortController().signal
    const peek = requestPeek({
      world: 'word-song',
      node: 'digraphs-sh',
      signal,
    })
    await microtasks()
    const prepared = await peek
    expect(prepared.plan.problems).toHaveLength(3)
    prepared.audio.unload()
    const replay = await requestReplay({
      world: 'math',
      node: 'mult-3-4',
      signal,
    })
    expect(replay.plan.problems).toHaveLength(8)
    replay.audio.unload()
    expect(offline).not.toHaveBeenCalled()
  })
})
