/**
 * No-Claude plan phase 4 on the device: a letter-sounds session with a
 * vowel map past greenfield is built from the bundled canon, with no
 * network call and no wait, and carries the `currentTargetVowel` the
 * server stamped, so the session-end vowel write is unchanged. A local
 * build that throws still asks the server, without the vowel map (so the
 * server answers from canon, not the planner).
 *
 * `EXPECTED_STAMP` is what `/api/claude` stamps for each map: the server's
 * `deriveCurrentTargetVowel` table (`packages/core/src/wire/
 * letterSoundsVowel.test.ts`). The root vitest `tests/noClaude/
 * letterSoundsVowelParity.test.ts` runs the real handler for all 81 maps.
 */
import { setKeyValueStore } from '@marian/core'
import { applyDebugSeed } from '@marian/core/debug/seeds'
import { setApiBase } from '@marian/core/platform/apiUrl'
import {
  defaultProgress,
  loadProgress,
  saveProgress,
  type Progress,
  type VowelSubMasteryState,
} from '@marian/core/progress'
import type { CanonText } from '@marian/core/session/composeSession'
import canonText from '../../assets/canon/canon-text.json'
import { fakePlayerFactory, resetFakePlayers } from '../../test/fakeAudio'
import { _resetAudioLogForTests, readAudioLog } from '../audio/audioLog'
import { createAudioEngine, type AudioEngine } from '../audio/engine'
import {
  currentSessionAudio,
  type SessionFileStore,
} from '../audio/sessionAudio'
import type {
  PreparedSession,
  SessionStartArgs,
  SessionStartPayload,
} from '../audio'
import type { WordSongSessionResult } from '../screens/wordSong/wordSongTypes'
import { startSessionLocalFirst } from './localSession'
import { wordSongSessionEndPayload } from './sessionEndPayload'
import { writeSessionEnd } from './sessionEndWrite'
import {
  buildWordSongSessionPayload,
  NO_EXTRAS,
  readWordSongProgressHints,
  type WordSongProgressHints,
} from './wordSongHints'
import {
  createWordSongSessionController,
  type WordSongSessionController,
} from './wordSongSession'

const CANON = canonText as unknown as Readonly<Record<string, CanonText>>
const LETTER_SOUNDS = 'word-song/level-1/letter-sounds'

type Vowel = '/o/' | '/u/' | '/i/' | '/e/'
type Map4 = Record<Vowel, VowelSubMasteryState>
const map = (o: string, u: string, i: string, e: string): Map4 => {
  const s = { i: 'intro', p: 'practicing', m: 'mastered' } as const
  const at = (c: string) => s[c as keyof typeof s]
  return { '/o/': at(o), '/u/': at(u), '/i/': at(i), '/e/': at(e) }
}

/** Map shapes, named by their /o/ /u/ /i/ /e/ states, and the server's stamp. */
const EXPECTED_STAMP: [string, Vowel | undefined][] = [
  ['iiii', undefined], // greenfield: canon, no stamp
  ['piii', '/o/'],
  ['miii', '/u/'],
  ['mpii', '/u/'],
  ['mmpi', '/i/'],
  ['mmmi', '/e/'],
  ['mmmp', '/e/'],
  ['miip', '/o/'], // the /e/ guard: review a mastered vowel
  ['iiip', undefined], // the /e/ guard with nothing mastered: no stamp
  ['mmmm', undefined], // a mastered tier: no stamp
]

const hintsFor = (m: Map4, seed = 4): WordSongProgressHints => ({
  focusNode: 'letter-sounds',
  focusMode: 'forward',
  recentSuccessRate: 0.8,
  isGraduationSession: false,
  lifetimeFirstEncounters: ['letter-names', 'letter-sounds'],
  letterSoundsVowelStates: m,
  seed,
  planKind: { kind: 'forward', warmup: [] },
})

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

const fetchOf = (body: unknown) =>
  jest.fn(async () => ({ ok: true, status: 200, json: async () => body }))

/** The server's canon answer for letter-sounds, inline audio. */
function canonAnswer() {
  const entry = CANON[LETTER_SOUNDS]!
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

async function microtasks() {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

let engine: AudioEngine
let files: ReturnType<typeof noFiles>
const offline = globalThis.fetch as jest.Mock
let store: Map<string, string>

beforeEach(() => {
  resetFakePlayers()
  _resetAudioLogForTests()
  engine = createAudioEngine({ createPlayer: fakePlayerFactory })
  files = noFiles()
  currentSessionAudio()?.unload()
  offline.mockClear()
  setApiBase('https://example.test')
  store = new Map()
  setKeyValueStore({
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v)
    },
    removeItem: (k) => {
      store.delete(k)
    },
  })
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('startSessionLocalFirst: a letter-sounds vowel map', () => {
  it.each(EXPECTED_STAMP)(
    '%s: built on the device with the server stamp, no network call',
    async (name, stamp) => {
      const fetch = fetchOf(canonAnswer())
      const m = map(name[0]!, name[1]!, name[2]!, name[3]!)
      const prepared = await startSessionLocalFirst(
        {
          sessionId: `ls-${name}`,
          payload: buildWordSongSessionPayload(hintsFor(m), true),
        },
        { fetch: fetch as never, engine, files },
      )
      expect(fetch).not.toHaveBeenCalled()
      expect(prepared.currentTargetVowel).toBe(stamp)
      expect(prepared.audio.fileCount).toBe(0)
      expect(files.writes).toBe(0)
      const reads = (prepared.plan as { utterances: { id: string }[] })
        .utterances
      expect(reads.filter((u) => /^word\.p\d\.read$/.test(u.id))).toHaveLength(
        8,
      )
      if (stamp === '/u/') {
        expect((prepared.plan as { id: string }).id).toBe(
          'letter-sounds-short-u',
        )
      }
    },
  )

  it('the payload carries the map and the seed for the device, never to the server', async () => {
    const sent = buildWordSongSessionPayload(
      hintsFor(map('m', 'p', 'i', 'i'), 9),
      true,
    )
    expect(sent.seed).toBe(9)
    expect(sent.progress).toHaveProperty('letterSoundsVowelStates')
    const fetch = fetchOf(canonAnswer())
    const prepared = await startSessionLocalFirst(
      { sessionId: 'ls-throw', payload: sent },
      {
        fetch: fetch as never,
        engine,
        files,
        compose: () => {
          throw new Error('boom')
        },
      },
    )
    // The server is the fallback on a throw: the request has no vowel map
    // and no seed, so it answers from canon (the planner never runs).
    expect(fetch).toHaveBeenCalledTimes(1)
    const [, init] = fetch.mock.calls[0] as unknown as [
      string,
      { body: string },
    ]
    const body = JSON.parse(init.body) as { payload: SessionStartPayload }
    expect(body.payload).not.toHaveProperty('seed')
    expect(body.payload.progress).not.toHaveProperty('letterSoundsVowelStates')
    const progress: Record<string, unknown> = {
      ...(sent.progress as Record<string, unknown>),
    }
    delete progress.letterSoundsVowelStates
    const expected: Record<string, unknown> = { ...sent, progress }
    delete expected.seed
    expect(body).toEqual({ kind: 'session-start', payload: expected })
    expect(prepared.plan).toEqual(CANON[LETTER_SOUNDS]!.plan)
    expect(prepared.currentTargetVowel).toBeUndefined()
    expect(readAudioLog()).toContainEqual({
      kind: 'note',
      label: 'session-local',
      detail: 'build failed, asking the server: boom',
    })
  })
})

describe('the Word Song controller', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    jest.useRealTimers()
  })

  it('a vowel session is ready before any timer runs, with no fetch and the stamp', async () => {
    const words: WordSongSessionController = createWordSongSessionController({
      readHints: () => hintsFor(map('m', 'm', 'p', 'i')),
      readExtras: () => NO_EXTRAS,
      fallbackPlanId: () => 'x',
    })
    words.kick()
    words.startWaitTimer()
    await microtasks()
    const snap = words.getSnapshot()
    expect(snap.audioReady).toBe(true)
    expect(snap.plan?.problems).toHaveLength(8)
    expect(snap.plan?.problems.map((p) => p.target.word.toUpperCase())).toEqual(
      expect.arrayContaining(['I', 'A']),
    )
    expect(words.currentTargetVowel).toBe('/i/')
    jest.advanceTimersByTime(60_000)
    expect(offline).not.toHaveBeenCalled()
    words.tearDown()
  })
})

describe('the letter-sounds-short-u debug seed (simulator and iPad checks)', () => {
  it('lands on letter sounds past greenfield: a short-u session built on the device', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    expect(applyDebugSeed('letter-sounds-short-u')).toBe(true)
    const hints = readWordSongProgressHints()
    expect(hints.focusNode).toBe('letter-sounds')
    expect(hints.letterSoundsVowelStates).toEqual(map('m', 'p', 'i', 'i'))
    const fetch = fetchOf(canonAnswer())
    const prepared = await startSessionLocalFirst(
      {
        sessionId: 'ls-seed',
        payload: buildWordSongSessionPayload(hints, true),
      },
      { fetch: fetch as never, engine, files },
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(prepared.currentTargetVowel).toBe('/u/')
    expect((prepared.plan as { id: string }).id).toBe('letter-sounds-short-u')
  })
})

describe('the session-end vowel write', () => {
  const NOON = new Date('2026-10-24T12:00:00')

  function seeded(m: Map4): Progress {
    const p = defaultProgress('friend')
    return {
      ...p,
      skillLevels: { ...p.skillLevels, 'letter-sounds': 'practicing' },
      literacy: { ...p.literacy, letterSoundsVowelStates: m },
    }
  }

  /** Play a whole session through the controller, then write its end. */
  async function playAndWrite(
    m: Map4,
    start: (args: SessionStartArgs) => Promise<PreparedSession>,
  ): Promise<{ vowel: Vowel | null; after: Progress }> {
    store.clear()
    saveProgress(seeded(m))
    const words = createWordSongSessionController({
      start,
      readHints: () => hintsFor(m),
      readExtras: () => NO_EXTRAS,
      fallbackPlanId: () => 'x',
    })
    words.kick()
    await microtasks()
    const plan = words.getSnapshot().plan
    expect(plan).not.toBeNull()
    const targets = plan!.problems.map((p) => p.target.word)
    const result: WordSongSessionResult = {
      totalCorrect: 8,
      totalStardust: 8,
      finalStreak: 8,
      earnedThisSession: 0,
      surface: 'word-song',
      perProblemCorrect: targets.map(() => true),
      targetWords: targets,
      perProblemAnswerWord: targets,
      warmupCorrect: [],
      firstTapCorrect: targets.map(() => true),
    }
    const vowel = words.currentTargetVowel
    writeSessionEnd(
      wordSongSessionEndPayload(result, vowel, words.sessionFocus),
      { clock: () => NOON },
    )
    words.tearDown()
    return { vowel, after: loadProgress()! }
  }

  it.each(EXPECTED_STAMP)(
    '%s: the device session writes what the server response wrote',
    async (name, stamp) => {
      const m = map(name[0]!, name[1]!, name[2]!, name[3]!)
      const local = await playAndWrite(m, (args) =>
        startSessionLocalFirst(args, { engine, files }),
      )
      // A server response for the same session: the same plan, with the
      // vowel `/api/claude` stamped for this map (none when it omits it).
      const server = await playAndWrite(m, async (args) => {
        const response: PreparedSession = {
          ...(await startSessionLocalFirst(args, { engine, files })),
        }
        delete response.currentTargetVowel
        if (stamp !== undefined) response.currentTargetVowel = stamp
        return response
      })
      expect(local.vowel).toBe(stamp ?? null)
      expect(server.vowel).toBe(stamp ?? null)
      expect(local.after.literacy).toEqual(server.after.literacy)
      expect(local.after.history).toEqual(server.after.history)
      expect(local.after.skillLevels).toEqual(server.after.skillLevels)
      expect(local.after.history.at(-1)?.currentTargetVowel).toBe(stamp)
      expect(offline).not.toHaveBeenCalled()
    },
  )
})
