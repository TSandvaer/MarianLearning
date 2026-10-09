import { setApiBase } from '@marian/core/platform/apiUrl'
import type { Utterance } from '@marian/core/wire/types'
import {
  fakePlayerFactory,
  fakePlayers,
  resetFakePlayers,
} from '../../test/fakeAudio'
import { _resetAudioLogForTests, readAudioLog } from './audioLog'
import { createAudioEngine, type AudioEngine } from './engine'
import {
  currentSessionAudio,
  loadSessionAudio,
  safeName,
  sweepSessionAudioCache,
  type SessionFileStore,
} from './sessionAudio'
import { createSessionPrefetcher } from './sessionPrefetch'
import { SessionStartError, startSession } from './sessionStart'

/** In-memory SessionFileStore: dirs → files → base64. */
function memoryFiles() {
  const dirs = new Map<string, Map<string, string>>()
  const store: SessionFileStore & { dirs: typeof dirs } = {
    dirs,
    write(sessionId, utteranceId, base64) {
      const dir = dirs.get(sessionId) ?? new Map<string, string>()
      dirs.set(sessionId, dir)
      dir.set(utteranceId, base64)
      return {
        uri: `file:///cache/session-audio/${safeName(sessionId)}/${safeName(utteranceId)}.mp3`,
        bytes: Math.floor((base64.length * 3) / 4),
      }
    },
    removeSession(sessionId) {
      dirs.delete(sessionId)
    },
    removeAllExcept(keep) {
      let n = 0
      for (const id of Array.from(dirs.keys())) {
        if (!keep.includes(id)) {
          dirs.delete(id)
          n += 1
        }
      }
      return n
    },
  }
  return store
}

const utt = (id: string, text: string): Utterance => ({
  id,
  text,
  audio: { kind: 'inline', base64: 'SUQzBAAAAAAA', mime: 'audio/mpeg' },
})

const UTTERANCES: Utterance[] = [
  utt('p1.read', 'Three plus two. How many?'),
  utt('p1.reprompt', 'Hmm... try again?'),
  utt('p2.read', 'One plus one. How many?'),
  utt('p2.reprompt', 'Hmm... try again?'),
]

let engine: AudioEngine
let files: ReturnType<typeof memoryFiles>
/** Runs every background write slice at once. */
const sync = (fn: () => void) => fn()

beforeEach(() => {
  resetFakePlayers()
  _resetAudioLogForTests()
  engine = createAudioEngine({ createPlayer: fakePlayerFactory })
  files = memoryFiles()
  currentSessionAudio()?.unload()
})

describe('session audio: eager files, lazy players', () => {
  it('writes one file per distinct text and creates no player', async () => {
    const s = loadSessionAudio('s1', UTTERANCES, {
      engine,
      files,
      yieldThen: sync,
    })
    await s.ready
    expect(Array.from(files.dirs.get('s1')!.keys())).toEqual([
      'p1.read',
      'p1.reprompt',
      'p2.read',
    ])
    expect(fakePlayers).toHaveLength(0)
    expect(s.utteranceCount).toBe(4)
    expect(s.fileCount).toBe(3)
    expect(s.filesWritten).toBe(3)
    expect(readAudioLog()[0]).toMatchObject({
      kind: 'session-load',
      label: 'session-files',
    })
    expect((readAudioLog()[0] as { detail: string }).detail).toMatch(
      new RegExp(`^3 files ${s.bytesWritten} bytes`),
    )
  })

  it('writes in the background: nothing at load, slices of ≤8 ms, yielding between', () => {
    const queue: (() => void)[] = []
    let t = 0
    const writes: string[] = []
    const slowFiles: SessionFileStore = {
      ...files,
      write(sessionId, id, b64) {
        writes.push(id)
        t += 5 // each write costs 5 ms of JS thread
        return files.write(sessionId, id, b64)
      },
    }
    const s = loadSessionAudio('s1', UTTERANCES, {
      engine,
      files: slowFiles,
      now: () => t,
      yieldThen: (fn) => queue.push(fn),
    })
    expect(writes).toEqual([])
    queue.shift()!() // slice 1: 5 ms, then 10 ms ≥ 8 → yield
    expect(writes).toEqual(['p1.read', 'p1.reprompt'])
    expect(queue).toHaveLength(1)
    queue.shift()!()
    expect(writes).toEqual(['p1.read', 'p1.reprompt', 'p2.read'])
    expect(queue).toHaveLength(0)
    expect(s.filesWritten).toBe(3)
  })

  it('a line played before its file is written gets it written on the spot', () => {
    const queue: (() => void)[] = []
    const s = loadSessionAudio('s1', UTTERANCES, {
      engine,
      files,
      yieldThen: (fn) => queue.push(fn),
    })
    expect(s.filesWritten).toBe(0)
    const done = s.playUtterance('One plus one. How many?')
    expect(Array.from(files.dirs.get('s1')!.keys())).toEqual(['p2.read'])
    expect(fakePlayers[0].source).toEqual({
      uri: 'file:///cache/session-audio/s1/p2.read.mp3',
    })
    queue.shift()!() // the background writer skips what is already written
    expect(s.filesWritten).toBe(3)
    s.unload()
    return expect(done).rejects.toThrow('cancelled')
  })

  it('unload stops the background writer', () => {
    const queue: (() => void)[] = []
    const s = loadSessionAudio('s1', UTTERANCES, {
      engine,
      files,
      yieldThen: (fn) => queue.push(fn),
    })
    s.unload()
    queue.shift()!()
    expect(files.dirs.has('s1')).toBe(false)
    expect(s.filesWritten).toBe(0)
  })

  it('a duplicate id plays its text’s file (web: first id wins)', async () => {
    const s = loadSessionAudio('s1', UTTERANCES, {
      engine,
      files,
      yieldThen: sync,
    })
    const done = s.playUtteranceById('p2.reprompt')
    expect(fakePlayers[0].source).toEqual({
      uri: 'file:///cache/session-audio/s1/p1.reprompt.mp3',
    })
    s.unload()
    await expect(done).rejects.toThrow('cancelled')
  })

  it('plays by text through the file URI; duplicate text resolves to the first id', async () => {
    const s = loadSessionAudio('s1', UTTERANCES, {
      engine,
      files,
      yieldThen: sync,
    })
    expect(s.textToId.get('Hmm... try again?')).toBe('p1.reprompt')
    const ticks: number[] = []
    const done = s.playUtterance('Hmm... try again?', {
      onWordTick: (i) => ticks.push(i),
    })
    expect(fakePlayers).toHaveLength(1)
    expect(fakePlayers[0].source).toEqual({
      uri: 'file:///cache/session-audio/s1/p1.reprompt.mp3',
    })
    fakePlayers[0].start(1.5)
    fakePlayers[0].finish()
    await done
    expect(ticks).toEqual([0, 1, 2])
    // The duplicate reuses the same player.
    const again = s.playUtterance('Hmm... try again?')
    expect(fakePlayers).toHaveLength(1)
    s.unload()
    await expect(again).rejects.toThrow('cancelled')
  })

  it('text the server never rendered fails soft: onPlay + every tick, resolves silently', async () => {
    const s = loadSessionAudio('s1', UTTERANCES, {
      engine,
      files,
      yieldThen: sync,
    })
    const onPlay = jest.fn()
    const ticks: number[] = []
    await expect(
      s.playUtterance('Not in the plan.', {
        onPlay,
        onWordTick: (i) => ticks.push(i),
      }),
    ).resolves.toBeUndefined()
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(ticks).toEqual([0, 1, 2, 3]) // "Not in the plan." = 4 words
    expect(fakePlayers).toHaveLength(0)
  })

  it('playUtteranceById rejects for an unknown id', async () => {
    const s = loadSessionAudio('s1', UTTERANCES, {
      engine,
      files,
      yieldThen: sync,
    })
    await expect(s.playUtteranceById('p9.read')).rejects.toThrow('no utterance')
  })

  it('prewarm creates one line player ahead of its first play', async () => {
    const s = loadSessionAudio('s1', UTTERANCES, {
      engine,
      files,
      yieldThen: sync,
    })
    s.prewarm('One plus one. How many?')
    expect(fakePlayers).toHaveLength(1)
    const done = s.playUtterance('One plus one. How many?')
    expect(fakePlayers).toHaveLength(1)
    expect(fakePlayers[0].calls).toEqual(['play'])
    s.unload()
    await expect(done).rejects.toThrow('cancelled')
  })

  it('unload stops a playing session line, releases the players and deletes the files', async () => {
    const s = loadSessionAudio('s1', UTTERANCES, {
      engine,
      files,
      yieldThen: sync,
    })
    const done = s.playUtterance('Three plus two. How many?')
    fakePlayers[0].start(2)
    s.unload()
    await expect(done).rejects.toThrow('cancelled')
    expect(fakePlayers[0].removed).toBe(true)
    expect(files.dirs.has('s1')).toBe(false)
    expect(currentSessionAudio()).toBeNull()
    // After unload: soft, silent captions.
    await expect(
      s.playUtterance('Three plus two. How many?'),
    ).resolves.toBeUndefined()
  })

  it('loading another session replaces (unloads) the first: one session on disk', () => {
    loadSessionAudio('s1', UTTERANCES, { engine, files, yieldThen: sync })
    loadSessionAudio('s2', UTTERANCES.slice(0, 1), {
      engine,
      files,
      yieldThen: sync,
    })
    expect(Array.from(files.dirs.keys())).toEqual(['s2'])
    expect(currentSessionAudio()?.sessionId).toBe('s2')
  })

  it('the boot sweep deletes directories a killed app left, keeping the loaded session', () => {
    files.write('stale-a', 'x', 'AA==')
    files.write('stale-b', 'x', 'AA==')
    loadSessionAudio('s1', UTTERANCES, { engine, files, yieldThen: sync })
    expect(sweepSessionAudioCache(files)).toBe(2)
    expect(Array.from(files.dirs.keys())).toEqual(['s1'])
  })
})

describe('session-start client', () => {
  const okResponse = {
    ok: true,
    kind: 'session-start',
    plan: { problems: [] },
    utterances: UTTERANCES,
  }
  const fetchReturning = (status: number, body: unknown) =>
    jest.fn(() =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      } as unknown as Response),
    )

  beforeEach(() => setApiBase('https://example.test'))
  afterEach(() => setApiBase(''))

  it('POSTs the session-start body to apiUrl("/api/claude") and loads the audio', async () => {
    const fetch = fetchReturning(200, okResponse)
    const payload = { track: 'math' as const, level: 1, childName: 'Marian' }
    const prepared = await startSession(
      { sessionId: 'm1', payload },
      { fetch, engine, files, yieldThen: sync },
    )
    expect(fetch).toHaveBeenCalledWith('https://example.test/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'session-start', payload }),
      signal: undefined,
    })
    expect(prepared.plan).toEqual({ problems: [] })
    expect(prepared.track).toBe('math')
    expect(prepared.audio.utteranceCount).toBe(4)
    await prepared.audio.ready
    expect(files.dirs.get('m1')?.size).toBe(3)
  })

  it.each([
    ['rate-limited', 429],
    ['planner-failed', 502],
    ['tts-failed', 502],
    ['config-missing', 500],
  ])('maps the server error %s', async (code, status) => {
    const fetch = fetchReturning(status, { error: code })
    await expect(
      startSession(
        { sessionId: 'm1', payload: { track: 'math' } },
        { fetch, engine, files, yieldThen: sync },
      ),
    ).rejects.toMatchObject({ name: 'SessionStartError', code })
  })

  it('a malformed response is invalid-response and writes nothing', async () => {
    const fetch = fetchReturning(200, { ok: true, kind: 'session-start' })
    await expect(
      startSession(
        { sessionId: 'm1', payload: { track: 'word-song' } },
        { fetch, engine, files, yieldThen: sync },
      ),
    ).rejects.toMatchObject({ code: 'invalid-response' })
    expect(files.dirs.size).toBe(0)
  })

  it('a network failure is network-error', async () => {
    const fetch = jest.fn(() =>
      Promise.reject(new TypeError('Network request failed')),
    )
    const err = await startSession(
      { sessionId: 'm1', payload: { track: 'math' } },
      { fetch, engine, files, yieldThen: sync },
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SessionStartError)
    expect((err as SessionStartError).code).toBe('network-error')
  })

  it('a request aborted after its body arrived loads no audio (web 123jpnbc3dh)', async () => {
    const controller = new AbortController()
    const fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => {
          controller.abort()
          return Promise.resolve(okResponse)
        },
      } as unknown as Response),
    )
    await expect(
      startSession(
        {
          sessionId: 'm1',
          payload: { track: 'math' },
          signal: controller.signal,
        },
        { fetch, engine, files, yieldThen: sync },
      ),
    ).rejects.toMatchObject({ code: 'aborted' })
    expect(files.dirs.size).toBe(0)
  })
})

describe('session prefetch (Hub)', () => {
  function deferredStart() {
    const calls: {
      args: Parameters<typeof startSession>[0]
      resolve: (v: Awaited<ReturnType<typeof startSession>>) => void
    }[] = []
    const start = jest.fn(
      (args: Parameters<typeof startSession>[0]) =>
        new Promise<Awaited<ReturnType<typeof startSession>>>((resolve) => {
          calls.push({ args, resolve })
        }),
    )
    return { start, calls }
  }
  const prepared = (id: string) => {
    const audio = loadSessionAudio(id, UTTERANCES, {
      engine,
      files,
      yieldThen: sync,
    })
    return {
      sessionId: id,
      track: 'math' as const,
      plan: null,
      audio,
      fetchMs: 1,
    }
  }
  const MATH = { track: 'math' as const, node: 'add-to-10' }
  const args = (id: string) => ({
    sessionId: id,
    payload: { track: 'math' as const },
  })

  it('take() adopts the in-flight request for the same key (never restarts it)', async () => {
    const { start, calls } = deferredStart()
    const pf = createSessionPrefetcher({ start })
    pf.prefetch(MATH, args('h1'))
    pf.prefetch(MATH, args('h1')) // Hub re-render: same key, no second request
    expect(start).toHaveBeenCalledTimes(1)
    const taken = pf.take(MATH)
    expect(taken).not.toBeNull()
    calls[0].resolve(prepared('h1'))
    await expect(taken).resolves.toMatchObject({ sessionId: 'h1' })
    expect(pf.pendingKey).toBeNull()
  })

  it('take() with a stale key (focus changed) discards: aborts and returns null', () => {
    const { start, calls } = deferredStart()
    const pf = createSessionPrefetcher({ start })
    pf.prefetch(MATH, args('h1'))
    expect(pf.take({ ...MATH, node: 'add-to-20' })).toBeNull()
    expect(calls[0].args.signal?.aborted).toBe(true)
  })

  it('prefetching the other world aborts the first (one session at a time)', () => {
    const { start, calls } = deferredStart()
    const pf = createSessionPrefetcher({ start })
    pf.prefetch(MATH, args('h1'))
    pf.prefetch({ track: 'word-song', node: 'cvc-words' }, args('h2'))
    expect(calls[0].args.signal?.aborted).toBe(true)
    expect(pf.pendingKey).toEqual({ track: 'word-song', node: 'cvc-words' })
  })

  it('discard() unloads a settled prefetch', async () => {
    const { start, calls } = deferredStart()
    const pf = createSessionPrefetcher({ start })
    pf.prefetch(MATH, args('h1'))
    calls[0].resolve(prepared('h1'))
    await Promise.resolve()
    await Promise.resolve()
    pf.discard()
    expect(files.dirs.has('h1')).toBe(false)
  })

  it('a prefetch discarded before its result is handled is still unloaded', async () => {
    const { start, calls } = deferredStart()
    const pf = createSessionPrefetcher({ start })
    pf.prefetch(MATH, args('h1'))
    const result = prepared('h1')
    pf.discard()
    calls[0].resolve(result)
    await Promise.resolve()
    await Promise.resolve()
    expect(files.dirs.has('h1')).toBe(false)
  })
})
