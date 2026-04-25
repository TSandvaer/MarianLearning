import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancel, isAvailable, loadVoices, primeVoices, speak } from './tts'
import { _resetForTests } from '../debug/debugBus'

type UtteranceLike = {
  text: string
  rate: number
  pitch: number
  volume: number
  voice: SpeechSynthesisVoice | null
  onstart:
    | ((this: SpeechSynthesisUtterance, ev?: SpeechSynthesisEvent) => void)
    | null
  onend:
    | ((this: SpeechSynthesisUtterance, ev?: SpeechSynthesisEvent) => void)
    | null
  onerror:
    | ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => void)
    | null
  onboundary:
    | ((this: SpeechSynthesisUtterance, ev?: SpeechSynthesisEvent) => void)
    | null
}

class FakeUtterance implements UtteranceLike {
  text: string
  rate = 1
  pitch = 1
  volume = 1
  voice: SpeechSynthesisVoice | null = null
  onstart:
    | ((this: SpeechSynthesisUtterance, ev?: SpeechSynthesisEvent) => void)
    | null = null
  onend:
    | ((this: SpeechSynthesisUtterance, ev?: SpeechSynthesisEvent) => void)
    | null = null
  onerror:
    | ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => void)
    | null = null
  onboundary:
    | ((this: SpeechSynthesisUtterance, ev?: SpeechSynthesisEvent) => void)
    | null = null

  constructor(text: string) {
    this.text = text
  }
}

interface FakeSynth {
  speak: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  getVoices: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  _utterances: UtteranceLike[]
  _voicesChangedHandlers: Array<() => void>
  _voices: SpeechSynthesisVoice[]
}

function makeFakeSynth(): FakeSynth {
  const utterances: UtteranceLike[] = []
  const handlers: Array<() => void> = []
  const synth: FakeSynth = {
    _utterances: utterances,
    _voicesChangedHandlers: handlers,
    _voices: [],
    speak: vi.fn((u: UtteranceLike) => {
      utterances.push(u)
    }),
    cancel: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => synth._voices),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (event === 'voiceschanged') handlers.push(handler)
    }),
    removeEventListener: vi.fn((event: string, handler: () => void) => {
      if (event === 'voiceschanged') {
        const idx = handlers.indexOf(handler)
        if (idx >= 0) handlers.splice(idx, 1)
      }
    }),
  }
  return synth
}

function installFakeSynth(): FakeSynth {
  const synth = makeFakeSynth()
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  return synth
}

describe('tts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    _resetForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    cancel()
    _resetForTests()
  })

  describe('isAvailable', () => {
    it('returns true when speechSynthesis and SpeechSynthesisUtterance exist', () => {
      installFakeSynth()
      expect(isAvailable()).toBe(true)
    })

    it('returns false when speechSynthesis is missing', () => {
      vi.stubGlobal('speechSynthesis', undefined)
      vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
      expect(isAvailable()).toBe(false)
    })

    it('returns false when SpeechSynthesisUtterance is missing', () => {
      vi.stubGlobal('speechSynthesis', makeFakeSynth())
      vi.stubGlobal('SpeechSynthesisUtterance', undefined)
      expect(isAvailable()).toBe(false)
    })
  })

  describe('speak', () => {
    it('resolves when the utterance ends with iPad-safe defaults (rate 1.0, pitch 1.0)', async () => {
      // Defaults pulled from spec line 29 (rate 0.9, pitch 1.1) to neutral
      // 1.0/1.0 in the post-PR-#21 iPad fix. iPad WebKit silently rejects
      // utterances with non-default pitch on some builds; defaulting to
      // 1.0 maximises the chance the engine honours the call. Callers can
      // still pass explicit rate/pitch via SpeakOptions.
      const synth = installFakeSynth()
      const promise = speak('Hi! I am Melody.')

      expect(synth.speak).toHaveBeenCalledTimes(1)
      const u = synth._utterances[0]
      expect(u.text).toBe('Hi! I am Melody.')
      expect(u.rate).toBe(1.0)
      expect(u.pitch).toBe(1.0)
      expect(u.volume).toBe(1.0)

      u.onend?.call(u as unknown as SpeechSynthesisUtterance)
      await expect(promise).resolves.toBeUndefined()
    })

    it('does NOT call synth.cancel() on cold-load first speak (iPad WebKit cancel-then-speak race)', async () => {
      // Documented iOS WebKit bug: cancel() followed immediately by speak()
      // in the same JS task often causes the new speak to be silently
      // dropped. Conditional cancel-only-if-active sidesteps this. On a
      // cold-load first speak, there's nothing to cancel — the engine sees
      // a clean speak() call.
      const synth = installFakeSynth()
      const promise = speak('Hi.')
      expect(synth.cancel).not.toHaveBeenCalled()
      expect(synth.speak).toHaveBeenCalledTimes(1)

      const u = synth._utterances[0]
      u.onend?.call(u as unknown as SpeechSynthesisUtterance)
      await promise
    })

    it('calls synth.resume() inside speak() to wake a paused engine (iPad PWA quirk)', async () => {
      // iPad Safari sometimes initialises speechSynthesis in a paused state,
      // especially in PWA / standalone mode. resume() is a no-op when not
      // paused, so we call it unconditionally on every speak() inside the
      // user-gesture tick. Without this, every speak() silently fails until
      // something else happens to resume the engine.
      const synth = installFakeSynth()
      const promise = speak('Hi.')

      expect(synth.resume).toHaveBeenCalledTimes(1)

      // Order matters: resume must be called BEFORE speak so the new
      // utterance lands on a non-paused engine.
      const resumeOrder = synth.resume.mock.invocationCallOrder[0]
      const speakOrder = synth.speak.mock.invocationCallOrder[0]
      expect(resumeOrder).toBeLessThan(speakOrder)

      const u = synth._utterances[0]
      u.onend?.call(u as unknown as SpeechSynthesisUtterance)
      await promise
    })

    it('swallows a thrown synth.resume() — does not break the speak path', async () => {
      // Some engines throw if speechSynthesis isn't fully initialised.
      // resume()'s exception must not poison the speak() that follows.
      const synth = installFakeSynth()
      synth.resume.mockImplementation(() => {
        throw new Error('engine not ready')
      })
      const promise = speak('Hi.')

      // Speak must still have been queued despite resume's throw.
      expect(synth.speak).toHaveBeenCalledTimes(1)
      const u = synth._utterances[0]
      u.onend?.call(u as unknown as SpeechSynthesisUtterance)
      await expect(promise).resolves.toBeUndefined()
    })

    it('honours custom rate, pitch, and volume', async () => {
      const synth = installFakeSynth()
      const promise = speak('Yes!', { rate: 1.2, pitch: 0.8, volume: 0.5 })
      const u = synth._utterances[0]
      expect(u.rate).toBe(1.2)
      expect(u.pitch).toBe(0.8)
      expect(u.volume).toBe(0.5)
      u.onend?.call(u as unknown as SpeechSynthesisUtterance)
      await promise
    })

    it('selects a voice by voiceURI when available', async () => {
      const synth = installFakeSynth()
      const samantha = {
        voiceURI: 'com.apple.samantha',
        name: 'Samantha',
        lang: 'en-US',
        default: false,
        localService: true,
      } as SpeechSynthesisVoice
      synth._voices = [samantha]

      const promise = speak('Hi.', { voiceURI: 'com.apple.samantha' })
      const u = synth._utterances[0]
      expect(u.voice).toBe(samantha)
      u.onend?.call(u as unknown as SpeechSynthesisUtterance)
      await promise
    })

    it('rejects on synthesis error', async () => {
      const synth = installFakeSynth()
      const promise = speak('Hi.')
      const u = synth._utterances[0]
      u.onerror?.call(
        u as unknown as SpeechSynthesisUtterance,
        {
          error: 'audio-busy',
        } as SpeechSynthesisErrorEvent,
      )
      await expect(promise).rejects.toThrow('audio-busy')
    })

    it('rejects when cancel() is called while speaking', async () => {
      installFakeSynth()
      const promise = speak('Hi.')
      cancel()
      await expect(promise).rejects.toThrow('canceled')
    })

    it('rejects the previous in-flight promise when speak() is called again', async () => {
      const synth = installFakeSynth()
      const first = speak('First.')
      const second = speak('Second.')
      await expect(first).rejects.toThrow('canceled')
      const u = synth._utterances[1]
      u.onend?.call(u as unknown as SpeechSynthesisUtterance)
      await expect(second).resolves.toBeUndefined()
    })

    it('cancels the audio-layer queue between back-to-back speak() calls', async () => {
      const synth = installFakeSynth()
      // Model the real Web Speech API: cancel() drains the pending queue.
      // Without this, the second utterance sits behind the first on iPad and
      // the user hears "First. Second." instead of just "Second."
      synth.cancel.mockImplementation(() => {
        synth._utterances.length = 0
      })

      const first = speak('First.')
      // Capture state right after the first speak() — queue should hold one.
      expect(synth.speak).toHaveBeenCalledTimes(1)
      expect(synth.cancel).not.toHaveBeenCalled()
      expect(synth._utterances).toHaveLength(1)

      const second = speak('Second.')

      // Cancel must have fired exactly once, between the two speak() calls.
      expect(synth.cancel).toHaveBeenCalledTimes(1)
      expect(synth.speak).toHaveBeenCalledTimes(2)
      const speakOrders = synth.speak.mock.invocationCallOrder
      const cancelOrder = synth.cancel.mock.invocationCallOrder[0]
      expect(cancelOrder).toBeGreaterThan(speakOrders[0])
      expect(cancelOrder).toBeLessThan(speakOrders[1])

      // Queue depth stays at 1: the first utterance was drained by cancel(),
      // only the second is enqueued.
      expect(synth._utterances).toHaveLength(1)
      expect(synth._utterances[0].text).toBe('Second.')

      await expect(first).rejects.toThrow('canceled')
      const u = synth._utterances[0]
      u.onend?.call(u as unknown as SpeechSynthesisUtterance)
      await expect(second).resolves.toBeUndefined()
    })

    it('rejects when the Web Speech API is not available', async () => {
      vi.stubGlobal('speechSynthesis', undefined)
      vi.stubGlobal('SpeechSynthesisUtterance', undefined)
      await expect(speak('Hi.')).rejects.toThrow('not available')
    })

    it('forwards SpeakOptions.onBoundary to the boundary helper', async () => {
      // Integration check: the SpeakOptions seam must wire through to the
      // boundary module without losing chained onend semantics. This is the
      // path Kyle's caption ribbon will use on Screen 2.
      const synth = installFakeSynth()
      const events: Array<{ word: string; wordIndex: number }> = []
      const promise = speak("Hi! I'm Melody.", {
        onBoundary: (e) =>
          events.push({ word: e.word, wordIndex: e.wordIndex }),
      })

      const u = synth._utterances[0] as unknown as FakeUtterance
      // Drive the lifecycle the way a real engine would.
      u.onstart?.call(
        u as unknown as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      )
      u.onboundary?.call(
        u as unknown as SpeechSynthesisUtterance,
        {
          charIndex: 0,
          charLength: 3,
          name: 'word',
        } as unknown as SpeechSynthesisEvent,
      )
      u.onboundary?.call(
        u as unknown as SpeechSynthesisUtterance,
        {
          charIndex: 4,
          charLength: 3,
          name: 'word',
        } as unknown as SpeechSynthesisEvent,
      )
      u.onboundary?.call(
        u as unknown as SpeechSynthesisUtterance,
        {
          charIndex: 8,
          charLength: 7,
          name: 'word',
        } as unknown as SpeechSynthesisEvent,
      )

      expect(events).toEqual([
        { word: 'Hi!', wordIndex: 0 },
        { word: "I'm", wordIndex: 1 },
        { word: 'Melody.', wordIndex: 2 },
      ])

      // Speak() must still resolve on natural end after boundary chaining.
      u.onend?.call(
        u as unknown as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      )
      await expect(promise).resolves.toBeUndefined()
    })

    it('does not call onBoundary if the option is omitted', async () => {
      // Backward-compat: existing speak() callers that never pass onBoundary
      // must not pay any cost from the boundary helper.
      //
      // Note: utterance.onstart IS attached unconditionally (to push status
      // to the debug bus) — that's a different concern from the boundary
      // helper. We only assert the boundary helper isn't sneaking work in.
      const synth = installFakeSynth()
      const promise = speak('Hi.')
      const u = synth._utterances[0] as unknown as FakeUtterance

      // The boundary helper is the thing under test here — its onboundary
      // wiring must not happen when onBoundary is omitted.
      expect(u.onboundary).toBeNull()

      u.onend?.call(
        u as unknown as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      )
      await expect(promise).resolves.toBeUndefined()
    })

    it('forwards onStart to the engine onstart event (used by useAudioUnlockGate)', async () => {
      const synth = installFakeSynth()
      const onStart = vi.fn()
      const promise = speak('Hi.', { onStart })
      const u = synth._utterances[0] as unknown as FakeUtterance

      expect(onStart).not.toHaveBeenCalled()
      u.onstart?.call(
        u as unknown as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      )
      expect(onStart).toHaveBeenCalledTimes(1)

      u.onend?.call(
        u as unknown as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      )
      await promise
    })

    it('chains onStart through the boundary helper when both are provided', async () => {
      // Order matters: tts.ts sets utterance.onstart = userOnStart BEFORE
      // subscribeToBoundary chains its own start handler. The boundary helper
      // preserves the prior handler and calls it. Verify both fire.
      const synth = installFakeSynth()
      const onStart = vi.fn()
      const onBoundary = vi.fn()
      const promise = speak('Hi.', { onStart, onBoundary })
      const u = synth._utterances[0] as unknown as FakeUtterance

      u.onstart?.call(
        u as unknown as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      )
      expect(onStart).toHaveBeenCalledTimes(1)

      u.onend?.call(
        u as unknown as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      )
      await promise
    })
  })

  describe('cancel', () => {
    it('calls speechSynthesis.cancel even when nothing is speaking', () => {
      const synth = installFakeSynth()
      cancel()
      expect(synth.cancel).toHaveBeenCalledTimes(1)
    })

    it('is a no-op when speechSynthesis is missing', () => {
      vi.stubGlobal('speechSynthesis', undefined)
      expect(() => cancel()).not.toThrow()
    })
  })

  describe('loadVoices', () => {
    it('returns immediately when voices are already populated', async () => {
      const synth = installFakeSynth()
      synth._voices = [
        {
          voiceURI: 'a',
          name: 'A',
          lang: 'en-US',
          default: true,
          localService: true,
        } as SpeechSynthesisVoice,
      ]
      const voices = await loadVoices()
      expect(voices).toHaveLength(1)
      expect(synth.addEventListener).not.toHaveBeenCalled()
    })

    it('waits for the voiceschanged event when the list starts empty', async () => {
      const synth = installFakeSynth()
      const promise = loadVoices()
      expect(synth.addEventListener).toHaveBeenCalledWith(
        'voiceschanged',
        expect.any(Function),
      )

      synth._voices = [
        {
          voiceURI: 'b',
          name: 'B',
          lang: 'en-US',
          default: false,
          localService: true,
        } as SpeechSynthesisVoice,
      ]
      // Fire the event the engine would have fired.
      synth._voicesChangedHandlers.forEach((h) => h())

      const voices = await promise
      expect(voices).toHaveLength(1)
      expect(synth.removeEventListener).toHaveBeenCalled()
    })

    it('falls back to polling when voiceschanged never fires', async () => {
      const synth = installFakeSynth()
      const promise = loadVoices()

      // No event fires; voices appear silently after a moment.
      synth._voices = [
        {
          voiceURI: 'c',
          name: 'C',
          lang: 'en-US',
          default: false,
          localService: true,
        } as SpeechSynthesisVoice,
      ]
      await vi.advanceTimersByTimeAsync(120)

      const voices = await promise
      expect(voices).toHaveLength(1)
    })

    it('resolves with whatever is available after a 2s timeout', async () => {
      installFakeSynth()
      const promise = loadVoices()
      await vi.advanceTimersByTimeAsync(2100)
      const voices = await promise
      expect(voices).toEqual([])
    })

    it('returns empty list when speechSynthesis is missing', async () => {
      vi.stubGlobal('speechSynthesis', undefined)
      await expect(loadVoices()).resolves.toEqual([])
    })
  })

  describe('primeVoices', () => {
    it('synchronously calls getVoices() on the engine', () => {
      // The point of primeVoices is to nudge engines (iPad WebKit) that only
      // start populating the voice list the first time getVoices() is called.
      // We don't care about the return value — just that the engine is poked.
      const synth = installFakeSynth()
      primeVoices()
      expect(synth.getVoices).toHaveBeenCalledTimes(1)
    })

    it('is a no-op when speechSynthesis is missing', () => {
      vi.stubGlobal('speechSynthesis', undefined)
      expect(() => primeVoices()).not.toThrow()
    })

    it('swallows a thrown getVoices()', () => {
      // Defensive: some engines throw if not initialised. Must not bubble.
      const synth = installFakeSynth()
      synth.getVoices.mockImplementation(() => {
        throw new Error('not initialised')
      })
      expect(() => primeVoices()).not.toThrow()
    })
  })

  describe('iPad-Safari second-utterance race', () => {
    it('only calls cancel() between back-to-back speaks (the conditional branch)', async () => {
      // The conditional cancel-only-if-active gates the cancel-then-speak
      // race. On a second utterance there IS an active reject, so cancel
      // fires once. This test is the companion to the cold-load assertion
      // above — together they prove the conditional is doing its job.
      const synth = installFakeSynth()
      // Attach the rejection handler before issuing the second speak so
      // Vitest doesn't see a transient unhandled-rejection between calls.
      const first = speak('First.')
      const firstAssertion = expect(first).rejects.toThrow('canceled')
      expect(synth.cancel).not.toHaveBeenCalled()

      const second = speak('Second.')
      expect(synth.cancel).toHaveBeenCalledTimes(1)

      await firstAssertion
      const u = synth._utterances[1]
      u.onend?.call(u as unknown as SpeechSynthesisUtterance)
      await second
    })
  })
})
