import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPreRecorded,
  GREET_LINE_SOURCES,
  GREET_LINE_WORD_COUNTS,
  type GreetLineKey,
  type HowlLike,
  type PreRecordedAudio,
} from './preRecorded'
import { GREET_LINES } from '../../screens/greetSequence'
import {
  _resetAudioContextProbeForTests,
  activateAudioContextProbe,
} from '../debug/audioContextProbe'
import { _resetForTests, snapshot } from '../debug/debugBus'

/**
 * Build a controllable Howl-like fake. Each instance records every event
 * subscription so tests can fire `play`/`end`/`loaderror`/`playerror` at
 * will, and tracks `play()`/`stop()` calls.
 *
 * One fake per source URL — the production module constructs one Howl per
 * line in `loadGreetAudio`.
 */
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
      // Snapshot listeners so a handler that calls off() mid-fire (the
      // production code does this on settle) doesn't mutate the iteration.
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
      // Match Howler's "no id" semantics: remove all listeners.
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
  audio: PreRecordedAudio
  fakes: Map<string, FakeHowl>
  /**
   * After loadGreetAudio() runs, this returns the fake bound to the named key.
   * If load hasn't happened yet, returns undefined.
   */
  fake: (key: GreetLineKey) => FakeHowl | undefined
}

function makeHarness(opts: { duration?: number } = {}): Harness {
  const fakes = new Map<string, FakeHowl>()
  // The production code calls `new HowlCtor({ src: [...] })` — we mimic
  // Howler's signature loosely. We only need the constructor to register a
  // FakeHowl bound to the requested src.
  const HowlCtor = vi.fn(({ src }: { src: string[] }) => {
    const fake = makeFakeHowl(src[0], opts.duration ?? 1.0)
    fakes.set(src[0], fake)
    return fake
  }) as unknown as typeof import('howler').Howl

  const audio = createPreRecorded({ HowlCtor })

  return {
    audio,
    fakes,
    fake(key: GreetLineKey) {
      return fakes.get(GREET_LINE_SOURCES[key])
    },
  }
}

describe('preRecorded', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('module-level constants', () => {
    it('has one source URL per GreetLineKey, all under public/assets/audio/greet/', () => {
      const keys: GreetLineKey[] = ['hi', 'imMelody', 'niceToMeet', 'tapHeart']
      for (const k of keys) {
        expect(GREET_LINE_SOURCES[k]).toMatch(/^\/assets\/audio\/greet\/greet-/)
        expect(GREET_LINE_SOURCES[k]).toMatch(/\.mp3$/)
      }
    })

    it('word counts match the live GREET_LINES strings — drift guard', () => {
      // If someone edits GREET_LINES without updating WORD_COUNTS the
      // caption tick interval would be wrong (or fire too few/many ticks).
      expect(GREET_LINE_WORD_COUNTS.hi).toBe(
        GREET_LINES[0].split(/\s+/).filter(Boolean).length,
      )
      expect(GREET_LINE_WORD_COUNTS.imMelody).toBe(
        GREET_LINES[1].split(/\s+/).filter(Boolean).length,
      )
      expect(GREET_LINE_WORD_COUNTS.niceToMeet).toBe(
        GREET_LINES[2].split(/\s+/).filter(Boolean).length,
      )
      expect(GREET_LINE_WORD_COUNTS.tapHeart).toBe(
        GREET_LINES[3].split(/\s+/).filter(Boolean).length,
      )
    })
  })

  describe('loadGreetAudio', () => {
    it('constructs one Howl per line on first call, returning the cached map afterwards', async () => {
      const h = makeHarness()
      const map1 = await h.audio.loadGreetAudio()
      const map2 = await h.audio.loadGreetAudio()

      expect(Object.keys(map1)).toEqual([
        'hi',
        'imMelody',
        'niceToMeet',
        'tapHeart',
      ])
      expect(map1).toBe(map2) // identity, not just equality
      // 4 Howls total.
      expect(h.fakes.size).toBe(4)
    })

    it('only constructs the Howls once even under concurrent calls', async () => {
      const h = makeHarness()
      const [a, b, c] = await Promise.all([
        h.audio.loadGreetAudio(),
        h.audio.loadGreetAudio(),
        h.audio.loadGreetAudio(),
      ])
      expect(a).toBe(b)
      expect(b).toBe(c)
      expect(h.fakes.size).toBe(4)
    })
  })

  describe('playGreetLine — happy path', () => {
    it('resolves when the Howl `end` event fires', async () => {
      const h = makeHarness()
      const promise = h.audio.playGreetLine('hi')
      // Microtask flush so the promise constructor runs the load + on()
      // wiring before we fire events.
      await Promise.resolve()
      const fake = h.fake('hi')!
      expect(fake.__playCalls).toBe(1)

      fake.__fire('play')
      fake.__fire('end')

      await expect(promise).resolves.toBeUndefined()
    })

    it('fires onPlay synchronously when Howler emits its `play` event', async () => {
      const h = makeHarness()
      const onPlay = vi.fn()
      const promise = h.audio.playGreetLine('hi', { onPlay })
      await Promise.resolve()

      const fake = h.fake('hi')!
      fake.__fire('play')
      expect(onPlay).toHaveBeenCalledTimes(1)

      fake.__fire('end')
      await promise
    })

    it('fires onWordTick(0) immediately on play, then evenly across duration for multi-word lines', async () => {
      // niceToMeet has 6 words, set duration to 6s for a tidy 1s/word interval.
      const h = makeHarness({ duration: 6.0 })
      const ticks: number[] = []
      const promise = h.audio.playGreetLine('niceToMeet', {
        onWordTick: (i) => ticks.push(i),
      })
      await Promise.resolve()

      h.fake('niceToMeet')!.__fire('play')
      // Word 0 fires immediately on play.
      expect(ticks).toEqual([0])

      // Subsequent ticks at 1000ms intervals.
      vi.advanceTimersByTime(999)
      expect(ticks).toEqual([0])
      vi.advanceTimersByTime(1)
      expect(ticks).toEqual([0, 1])
      vi.advanceTimersByTime(1000)
      expect(ticks).toEqual([0, 1, 2])
      vi.advanceTimersByTime(3000)
      expect(ticks).toEqual([0, 1, 2, 3, 4, 5])
      // Past the 6th tick: no further ticks fire (interval cleared).
      vi.advanceTimersByTime(5000)
      expect(ticks).toEqual([0, 1, 2, 3, 4, 5])

      h.fake('niceToMeet')!.__fire('end')
      await promise
    })

    it('does not start the word-tick interval for single-word lines', async () => {
      const h = makeHarness({ duration: 0.5 })
      const ticks: number[] = []
      const promise = h.audio.playGreetLine('hi', {
        onWordTick: (i) => ticks.push(i),
      })
      await Promise.resolve()

      h.fake('hi')!.__fire('play')
      // Word 0 fires immediately.
      expect(ticks).toEqual([0])

      // Advance past any plausible interval — no additional ticks because
      // wordCount === 1.
      vi.advanceTimersByTime(60_000)
      expect(ticks).toEqual([0])

      h.fake('hi')!.__fire('end')
      await promise
    })

    it('falls back to 165 wpm when duration() returns 0 (asset not yet probed)', async () => {
      // Computed interval: (6 words / 165 wpm) * 60_000ms = ~2181.8ms total
      // → ~363.6 ms/word. We don't pin the exact interval; we assert the
      // tick cadence is reasonably close to the WPM fallback rather than
      // the (unknown) audio duration. Two checkpoints prove the fallback
      // engaged at all (without it the `if (wordCount > 1)` branch reaches
      // `intervalMs = 0` which would fire all ticks immediately on the
      // microtask flush).
      const h = makeHarness({ duration: 0 })
      const ticks: number[] = []
      const promise = h.audio.playGreetLine('niceToMeet', {
        onWordTick: (i) => ticks.push(i),
      })
      await Promise.resolve()

      h.fake('niceToMeet')!.__fire('play')
      expect(ticks).toEqual([0])

      // At 100 ms — well before the 363 ms first-interval — there should
      // still be only the immediate tick. (If the fallback were broken
      // and intervalMs were 0, every tick would have fired by now.)
      vi.advanceTimersByTime(100)
      expect(ticks).toEqual([0])

      // Past the full computed duration (~2.2s) every word should have
      // ticked. Generous bound to ride out fake-timer rounding.
      vi.advanceTimersByTime(3_000)
      expect(ticks).toEqual([0, 1, 2, 3, 4, 5])

      h.fake('niceToMeet')!.__fire('end')
      await promise
    })
  })

  describe('playGreetLine — error paths', () => {
    it('rejects when Howler emits `loaderror`', async () => {
      const h = makeHarness()
      const promise = h.audio.playGreetLine('hi')
      await Promise.resolve()

      h.fake('hi')!.__fire('loaderror')
      await expect(promise).rejects.toThrow(/loaderror/)
    })

    it('rejects when Howler emits `playerror`', async () => {
      const h = makeHarness()
      const promise = h.audio.playGreetLine('hi')
      await Promise.resolve()

      h.fake('hi')!.__fire('playerror')
      await expect(promise).rejects.toThrow(/playerror/)
    })

    it('rejects with the underlying error if Howl construction throws', async () => {
      const HowlCtor = vi.fn(() => {
        throw new Error('no audio backend')
      }) as unknown as typeof import('howler').Howl
      const audio = createPreRecorded({ HowlCtor })

      await expect(audio.playGreetLine('hi')).rejects.toThrow(
        /no audio backend/,
      )
    })

    it('rejects with the underlying error if Howl.play() throws synchronously', async () => {
      const h = makeHarness()
      // Wait for load so we can mutate the fake before playGreetLine runs.
      await h.audio.loadGreetAudio()
      const fake = h.fake('hi')!
      fake.play = () => {
        throw new Error('engine torn down')
      }

      await expect(h.audio.playGreetLine('hi')).rejects.toThrow(
        /engine torn down/,
      )
    })
  })

  describe('cancel', () => {
    it('stops in-flight playback and rejects the promise', async () => {
      const h = makeHarness()
      const promise = h.audio.playGreetLine('hi')
      await Promise.resolve()

      const fake = h.fake('hi')!
      fake.__fire('play')

      h.audio.cancel()

      expect(fake.__stopCalls).toBe(1)
      await expect(promise).rejects.toThrow(/cancelled/)
    })

    it('clears the word-tick interval on cancel — no late ticks', async () => {
      const h = makeHarness({ duration: 6.0 })
      const ticks: number[] = []
      const promise = h.audio.playGreetLine('niceToMeet', {
        onWordTick: (i) => ticks.push(i),
      })
      await Promise.resolve()

      h.fake('niceToMeet')!.__fire('play')
      expect(ticks).toEqual([0])

      vi.advanceTimersByTime(1500)
      expect(ticks).toEqual([0, 1])

      h.audio.cancel()
      vi.advanceTimersByTime(10_000)
      // No ticks landed after cancel.
      expect(ticks).toEqual([0, 1])
      await expect(promise).rejects.toThrow(/cancelled/)
    })

    it('is a safe no-op when nothing is in flight', () => {
      const h = makeHarness()
      expect(() => h.audio.cancel()).not.toThrow()
    })

    it('starting a new playGreetLine while one is in flight cancels the prior one', async () => {
      const h = makeHarness()
      const first = h.audio.playGreetLine('hi')
      await Promise.resolve()
      h.fake('hi')!.__fire('play')

      // Start the second line — should cancel the first.
      const second = h.audio.playGreetLine('imMelody')
      await Promise.resolve()

      // The first Howl was stopped.
      expect(h.fake('hi')!.__stopCalls).toBe(1)
      await expect(first).rejects.toThrow(/cancelled/)

      // Resolve the second normally.
      h.fake('imMelody')!.__fire('end')
      await expect(second).resolves.toBeUndefined()
    })
  })

  describe('unload', () => {
    it('unloads every cached Howl and is safe to call repeatedly', async () => {
      const h = makeHarness()
      await h.audio.loadGreetAudio()
      h.audio.unload()
      for (const fake of h.fakes.values()) {
        expect(fake.__unloadCalls).toBe(1)
      }
      // Second unload is a no-op (fakes already cleared).
      expect(() => h.audio.unload()).not.toThrow()
    })

    it('unload after an in-flight play cancels the playback first', async () => {
      const h = makeHarness()
      const promise = h.audio.playGreetLine('hi')
      await Promise.resolve()
      h.fake('hi')!.__fire('play')

      h.audio.unload()
      expect(h.fake('hi')!.__stopCalls).toBe(1)
      await expect(promise).rejects.toThrow(/cancelled/)
    })
  })

  describe('test seams (schedule / cancelSchedule)', () => {
    it('uses the injected schedule/cancelSchedule when provided', async () => {
      const h = makeHarness({ duration: 6.0 })
      const schedule = vi.fn((cb: () => void) => {
        // Run synchronously so we can assert without timer flush.
        // Returning a non-numeric handle proves the cancelSchedule
        // branch is ours, not window.clearInterval.
        cb()
        return 'fake-handle'
      })
      const cancelSchedule = vi.fn()

      const ticks: number[] = []
      const promise = h.audio.playGreetLine('niceToMeet', {
        onWordTick: (i) => ticks.push(i),
        schedule,
        cancelSchedule,
      })
      await Promise.resolve()

      h.fake('niceToMeet')!.__fire('play')
      // First tick is synchronous (word 0); the schedule callback fires
      // tick 1 immediately; subsequent ticks would too if it were a real
      // interval, but our fake schedule only runs once. The behaviour we
      // assert: schedule was called with a function and the right delay.
      expect(schedule).toHaveBeenCalledWith(expect.any(Function), 1000)
      expect(ticks).toContain(0)
      expect(ticks).toContain(1)

      h.fake('niceToMeet')!.__fire('end')
      await promise
    })
  })

  describe('Phase-3 (ticket 86c9gvd0y) — audio-ctx probe instrumentation', () => {
    /** Set up an active probe so the singleton wrappers in preRecorded.ts
     * actually emit. Each test resets afterwards so probe state doesn't
     * bleed across cases. */
    beforeEach(() => {
      _resetForTests()
      _resetAudioContextProbeForTests()
      activateAudioContextProbe({
        howlerLike: { ctx: undefined },
        speechSynthLike: null,
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })
    })

    afterEach(() => {
      _resetAudioContextProbeForTests()
      _resetForTests()
    })

    it('records a speak-call row with the synchronous Howl.play() return value as soundId', async () => {
      const h = makeHarness()
      const promise = h.audio.playGreetLine('hi')
      await Promise.resolve()

      // The fake's play() returns 1 (see makeFakeHowl). Find the
      // speak-call row in the bus events.
      const events = snapshot().audioCtxEvents
      const speakCall = events.find((e) => e.cause === 'speak-call')
      expect(speakCall).toBeDefined()
      expect(speakCall).toMatchObject({
        cause: 'speak-call',
        speakResult: 1,
        skipReason: 'hi',
      })

      h.fake('hi')!.__fire('play')
      h.fake('hi')!.__fire('end')
      await promise
    })

    it('records a speak-onplay row when Howler emits its `play` event', async () => {
      const h = makeHarness()
      const promise = h.audio.playGreetLine('imMelody')
      await Promise.resolve()

      h.fake('imMelody')!.__fire('play')

      const events = snapshot().audioCtxEvents
      const onPlay = events.find((e) => e.cause === 'speak-onplay')
      expect(onPlay).toBeDefined()
      expect(onPlay).toMatchObject({
        cause: 'speak-onplay',
        skipReason: 'imMelody',
      })

      h.fake('imMelody')!.__fire('end')
      await promise
    })

    it('records a speak-call row with speakResult=null when Howl.play() throws', async () => {
      const h = makeHarness()
      // Override play() on the named line's Howl to throw synchronously.
      // We have to wait for loadGreetAudio to actually instantiate the
      // fakes first — kick a one-line load via playGreetLine so the
      // fakes register, then we'll override and run a fresh playGreetLine.
      await h.audio.loadGreetAudio()

      const fake = h.fake('niceToMeet')!
      fake.play = () => {
        throw new Error('iOS rejected play()')
      }

      const promise = h.audio.playGreetLine('niceToMeet')
      // Catch the rejection — our assertion is on the recorded event,
      // not on whether the promise rejects (it should).
      await expect(promise).rejects.toThrow('iOS rejected play()')

      const events = snapshot().audioCtxEvents
      const speakCall = events.find((e) => e.cause === 'speak-call')
      expect(speakCall).toBeDefined()
      expect(speakCall).toMatchObject({
        cause: 'speak-call',
        speakResult: null,
        skipReason: 'niceToMeet',
      })
    })
  })
})
