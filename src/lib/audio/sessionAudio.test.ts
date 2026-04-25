import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  base64ToBytes,
  countWords,
  createSessionAudio,
  type HowlLike,
  type SessionAudioCache,
} from './sessionAudio'
import type { Utterance } from '../../../api/_types'

// --- Test helpers --------------------------------------------------------

type Listener = (id?: number, err?: unknown) => void

interface FakeHowl extends HowlLike {
  __src: string
  __duration: number
  __setDuration: (sec: number) => void
  __fire: (
    event: 'play' | 'end' | 'loaderror' | 'playerror',
    err?: unknown,
  ) => void
  __playCalls: number
  __stopCalls: number
  __unloadCalls: number
}

function makeFakeHowl(src: string, duration = 1.0): FakeHowl {
  const listeners: Record<string, Listener[]> = {
    play: [],
    end: [],
    loaderror: [],
    playerror: [],
  }
  let _duration = duration
  let playCalls = 0
  let stopCalls = 0
  let unloadCalls = 0

  return {
    __src: src,
    get __duration() {
      return _duration
    },
    set __duration(v: number) {
      _duration = v
    },
    __setDuration(sec: number) {
      _duration = sec
    },
    __fire(event, err) {
      const snapshot = listeners[event].slice()
      for (const cb of snapshot) cb(undefined, err)
    },
    get __playCalls() {
      return playCalls
    },
    get __stopCalls() {
      return stopCalls
    },
    get __unloadCalls() {
      return unloadCalls
    },
    play() {
      playCalls += 1
      return 1
    },
    stop() {
      stopCalls += 1
    },
    duration() {
      return _duration
    },
    on(event, cb) {
      listeners[event].push(cb)
      return undefined
    },
    off(event) {
      listeners[event] = []
      return undefined
    },
    unload() {
      unloadCalls += 1
    },
    state() {
      return 'loaded' as const
    },
  }
}

interface Harness {
  audio: ReturnType<typeof createSessionAudio>
  fakes: Map<string, FakeHowl>
  cache: SessionAudioCache
  cacheGet: ReturnType<typeof vi.fn>
  cachePut: ReturnType<typeof vi.fn>
  cacheRemove: ReturnType<typeof vi.fn>
  blobsCreated: string[]
  blobsRevoked: string[]
}

function makeHarness(
  opts: {
    duration?: number
    cachedBase64?: Map<string, string> | null
  } = {},
): Harness {
  const fakes = new Map<string, FakeHowl>()
  let nextHowlIndex = 0
  const HowlCtor = vi.fn(({ src }: { src: string[] }) => {
    const idx = nextHowlIndex++
    const fake = makeFakeHowl(src[0], opts.duration ?? 1.0)
    // Map the Howl's blob URL → fake. Tests look up by utterance index.
    fakes.set(`howl-${idx}`, fake)
    fakes.set(src[0], fake)
    return fake
  }) as unknown as typeof import('howler').Howl

  const cacheGet = vi.fn(async () => opts.cachedBase64 ?? null)
  const cachePut = vi.fn(async () => {})
  const cacheRemove = vi.fn(async () => {})
  const cache: SessionAudioCache = {
    get: cacheGet,
    put: cachePut,
    remove: cacheRemove,
  }

  const blobsCreated: string[] = []
  const blobsRevoked: string[] = []
  let blobIdx = 0

  const audio = createSessionAudio({
    HowlCtor,
    cache,
    createBlobUrl: () => {
      const url = `blob:test://${blobIdx++}`
      blobsCreated.push(url)
      return url
    },
    revokeBlobUrl: (u) => {
      blobsRevoked.push(u)
    },
  })

  return {
    audio,
    fakes,
    cache,
    cacheGet,
    cachePut,
    cacheRemove,
    blobsCreated,
    blobsRevoked,
  }
}

function makeUtterance(
  id: string,
  text: string,
  base64 = 'AAEC', // [0,1,2]
): Utterance {
  return {
    id,
    text,
    audio: { kind: 'inline', base64, mime: 'audio/mpeg' },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// --- Helper-function tests ----------------------------------------------

describe('base64ToBytes', () => {
  it('decodes a base64 string into the expected byte array', () => {
    const bytes = base64ToBytes('AAEC') // 0,1,2
    expect(Array.from(bytes)).toEqual([0, 1, 2])
  })

  it('round-trips with btoa', () => {
    const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    const b64 = btoa(String.fromCharCode(...original))
    expect(Array.from(base64ToBytes(b64))).toEqual([0xde, 0xad, 0xbe, 0xef])
  })
})

describe('countWords', () => {
  it('counts whitespace-delimited words', () => {
    expect(countWords('Two plus three is five.')).toBe(5)
  })

  it('returns 0 for empty / whitespace-only', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
  })
})

// --- loadSessionAudio ---------------------------------------------------

describe('loadSessionAudio', () => {
  it('reads cache, falls back to inline base64 when cache miss, builds a Howl per utterance', async () => {
    const h = makeHarness()
    const utterances = [
      makeUtterance('u1', 'Hello.'),
      makeUtterance('u2', 'World!'),
    ]
    const map = await h.audio.loadSessionAudio('sess-1', utterances)
    expect(map.size).toBe(2)
    expect(map.has('u1')).toBe(true)
    expect(map.has('u2')).toBe(true)
    expect(h.cacheGet).toHaveBeenCalledWith('sess-1')
    // Cache miss → put the inline base64 for next time.
    expect(h.cachePut).toHaveBeenCalledWith('sess-1', expect.any(Map))
    expect(h.blobsCreated).toHaveLength(2)
  })

  it('reuses cached base64 when available — does not just take the inline payload', async () => {
    const h = makeHarness({
      cachedBase64: new Map([['u1', 'AwQF']]), // [3,4,5]
    })
    const utterances = [makeUtterance('u1', 'Hi', 'AAEC')]
    await h.audio.loadSessionAudio('sess-2', utterances)
    // `put` is called with the cached value preserved (not overwritten by
    // the fresher inline payload).
    const persisted = h.cachePut.mock.calls[0]![1] as Map<string, string>
    expect(persisted.get('u1')).toBe('AwQF')
  })

  it('returns the same howls when called twice for the same session', async () => {
    const h = makeHarness()
    const utterances = [makeUtterance('u1', 'Hi')]
    const a = await h.audio.loadSessionAudio('s', utterances)
    const b = await h.audio.loadSessionAudio('s', utterances)
    expect(a.get('u1')).toBe(b.get('u1'))
    // Only one Howl built across the two calls.
    expect(h.blobsCreated).toHaveLength(1)
  })

  it('tears down a previous session when a new sessionId loads', async () => {
    const h = makeHarness()
    await h.audio.loadSessionAudio('s1', [makeUtterance('u1', 'a')])
    expect(h.blobsCreated).toHaveLength(1)
    await h.audio.loadSessionAudio('s2', [makeUtterance('u1', 'b')])
    // Old blob revoked + Howl unloaded.
    expect(h.blobsRevoked).toHaveLength(1)
    expect(h.blobsCreated).toHaveLength(2)
  })
})

// --- playSessionUtterance happy path ------------------------------------

describe('playSessionUtterance', () => {
  it('rejects when load has not been called yet', async () => {
    const h = makeHarness()
    await expect(h.audio.playSessionUtterance('u1')).rejects.toThrow(
      /loadSessionAudio/,
    )
  })

  it('rejects when the id is unknown after load', async () => {
    const h = makeHarness()
    await h.audio.loadSessionAudio('s', [makeUtterance('u1', 'a')])
    await expect(
      h.audio.playSessionUtterance('does-not-exist'),
    ).rejects.toThrow(/no utterance with id/)
  })

  it('plays, fires onPlay + onWordTick, resolves on Howler `end`', async () => {
    const h = makeHarness({ duration: 6.0 })
    await h.audio.loadSessionAudio('s', [
      makeUtterance('u1', 'Two plus three is five.'),
    ])
    const onPlay = vi.fn()
    const ticks: number[] = []
    const promise = h.audio.playSessionUtterance('u1', {
      onPlay,
      onWordTick: (i) => ticks.push(i),
    })
    await Promise.resolve()
    const fake = h.fakes.get('blob:test://0')!
    fake.__fire('play')
    expect(onPlay).toHaveBeenCalledOnce()
    expect(ticks).toEqual([0])

    // 5 words, 6s duration → 1.2s per word.
    vi.advanceTimersByTime(1200)
    expect(ticks).toEqual([0, 1])
    vi.advanceTimersByTime(1200 * 4)
    expect(ticks).toEqual([0, 1, 2, 3, 4])

    fake.__fire('end')
    await expect(promise).resolves.toBeUndefined()
  })

  it('falls back to 165 wpm when Howler.duration() returns 0', async () => {
    const h = makeHarness({ duration: 0 })
    await h.audio.loadSessionAudio('s', [
      makeUtterance('u1', 'one two three four five six'),
    ])
    const ticks: number[] = []
    const promise = h.audio.playSessionUtterance('u1', {
      onWordTick: (i) => ticks.push(i),
    })
    await Promise.resolve()
    const fake = h.fakes.get('blob:test://0')!
    fake.__fire('play')
    expect(ticks).toEqual([0])
    // (6 / 165) * 60_000 = ~2181.8 total → ~363ms per word. Be generous.
    vi.advanceTimersByTime(50)
    expect(ticks).toEqual([0])
    vi.advanceTimersByTime(3_000)
    expect(ticks).toEqual([0, 1, 2, 3, 4, 5])
    fake.__fire('end')
    await promise
  })

  it('rejects on loaderror', async () => {
    const h = makeHarness()
    await h.audio.loadSessionAudio('s', [makeUtterance('u1', 'hi')])
    const promise = h.audio.playSessionUtterance('u1')
    await Promise.resolve()
    h.fakes.get('blob:test://0')!.__fire('loaderror')
    await expect(promise).rejects.toThrow(/loaderror/)
  })

  it('rejects on playerror', async () => {
    const h = makeHarness()
    await h.audio.loadSessionAudio('s', [makeUtterance('u1', 'hi')])
    const promise = h.audio.playSessionUtterance('u1')
    await Promise.resolve()
    h.fakes.get('blob:test://0')!.__fire('playerror')
    await expect(promise).rejects.toThrow(/playerror/)
  })

  it('starting a new play cancels the prior in-flight play', async () => {
    const h = makeHarness()
    await h.audio.loadSessionAudio('s', [
      makeUtterance('u1', 'a'),
      makeUtterance('u2', 'b'),
    ])
    const first = h.audio.playSessionUtterance('u1')
    await Promise.resolve()
    h.fakes.get('blob:test://0')!.__fire('play')
    const second = h.audio.playSessionUtterance('u2')
    await Promise.resolve()
    expect(h.fakes.get('blob:test://0')!.__stopCalls).toBe(1)
    await expect(first).rejects.toThrow(/cancelled/)
    h.fakes.get('blob:test://1')!.__fire('end')
    await expect(second).resolves.toBeUndefined()
  })
})

// --- cancel / unload / clear -------------------------------------------

describe('cancel', () => {
  it('stops in-flight playback and rejects', async () => {
    const h = makeHarness()
    await h.audio.loadSessionAudio('s', [makeUtterance('u1', 'a')])
    const promise = h.audio.playSessionUtterance('u1')
    await Promise.resolve()
    h.fakes.get('blob:test://0')!.__fire('play')
    h.audio.cancel()
    expect(h.fakes.get('blob:test://0')!.__stopCalls).toBe(1)
    await expect(promise).rejects.toThrow(/cancelled/)
  })

  it('is a safe no-op when nothing is in flight', () => {
    const h = makeHarness()
    expect(() => h.audio.cancel()).not.toThrow()
  })
})

describe('unload', () => {
  it('unloads every Howl and revokes every blob URL', async () => {
    const h = makeHarness()
    await h.audio.loadSessionAudio('s', [
      makeUtterance('u1', 'a'),
      makeUtterance('u2', 'b'),
    ])
    h.audio.unload()
    expect(h.fakes.get('blob:test://0')!.__unloadCalls).toBe(1)
    expect(h.fakes.get('blob:test://1')!.__unloadCalls).toBe(1)
    expect(h.blobsRevoked).toHaveLength(2)
  })
})

describe('clearSessionAudio', () => {
  it('removes the session from the IndexedDB cache', async () => {
    const h = makeHarness()
    await h.audio.loadSessionAudio('s', [makeUtterance('u1', 'a')])
    await h.audio.clearSessionAudio('s')
    expect(h.cacheRemove).toHaveBeenCalledWith('s')
  })

  it('also unloads in-memory state when clearing the active session', async () => {
    const h = makeHarness()
    await h.audio.loadSessionAudio('s', [makeUtterance('u1', 'a')])
    await h.audio.clearSessionAudio('s')
    expect(h.fakes.get('blob:test://0')!.__unloadCalls).toBe(1)
  })

  it('does NOT unload in-memory state when clearing an inactive session', async () => {
    const h = makeHarness()
    await h.audio.loadSessionAudio('active', [makeUtterance('u1', 'a')])
    await h.audio.clearSessionAudio('different-session')
    expect(h.fakes.get('blob:test://0')!.__unloadCalls).toBe(0)
    expect(h.cacheRemove).toHaveBeenCalledWith('different-session')
  })
})

describe('quota / cache resilience', () => {
  it('survives a cache.put that rejects (in-memory copy still works)', async () => {
    const h = makeHarness()
    h.cachePut.mockRejectedValueOnce(new Error('QuotaExceeded'))
    // Should not throw.
    await expect(
      h.audio.loadSessionAudio('s', [makeUtterance('u1', 'a')]),
    ).resolves.toBeInstanceOf(Map)
  })

  it('survives a cache.get that returns null (no cache pre-populated)', async () => {
    const h = makeHarness({ cachedBase64: null })
    const map = await h.audio.loadSessionAudio('s', [makeUtterance('u1', 'a')])
    expect(map.size).toBe(1)
  })
})
