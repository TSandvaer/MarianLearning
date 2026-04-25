import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetMelodyVoiceCacheForTests,
  cancel,
  isAvailable,
  loadVoices,
  pickMelodyVoice,
  primeVoices,
  speak,
} from './tts'
import { _resetForTests } from '../debug/debugBus'

/**
 * Build a SpeechSynthesisVoice-shaped object for tests. The Web Speech
 * API's voice type is a host-defined interface; we only assert on the
 * fields our voice-picker reads (name, lang, voiceURI), so a partial
 * object cast to the type is sound for unit tests.
 */
function fakeVoice(
  name: string,
  lang: string,
  voiceURI: string = name.toLowerCase(),
): SpeechSynthesisVoice {
  return {
    voiceURI,
    name,
    lang,
    default: false,
    localService: true,
  } as SpeechSynthesisVoice
}

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
    // Voice cache is module-level (intentionally — production runs one
    // pick per session). Reset between tests so cases that install
    // different voice lists don't see stale cached state.
    _resetMelodyVoiceCacheForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    cancel()
    _resetForTests()
    _resetMelodyVoiceCacheForTests()
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
    it('resolves when the utterance ends with spec defaults (rate 0.9, pitch 1.1)', async () => {
      // Spec design/session-1.md line 29: Melody is voiced at rate 0.9,
      // pitch 1.1 — slightly higher, slightly slower than neutral, to
      // match the Sanrio bunny character. PR #22 temporarily flattened
      // these to 1.0/1.0 as a defensive guess (we suspected iPad WebKit
      // was rejecting non-default pitch utterances). PR #23 then proved
      // the hypothesis wrong, and round 5 (ticket 86c9gp99a) reverted
      // to spec values after Thomas iPad QA confirmed audio fires
      // reliably with full TTS.
      const synth = installFakeSynth()
      const promise = speak('Hi! I am Melody.')

      expect(synth.speak).toHaveBeenCalledTimes(1)
      const u = synth._utterances[0]
      expect(u.text).toBe('Hi! I am Melody.')
      expect(u.rate).toBe(0.9)
      expect(u.pitch).toBe(1.1)
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

  describe('pickMelodyVoice', () => {
    it('returns null when speechSynthesis is missing', () => {
      vi.stubGlobal('speechSynthesis', undefined)
      expect(pickMelodyVoice()).toBeNull()
    })

    it('returns null when the voice list is empty (engine not ready yet)', () => {
      const synth = installFakeSynth()
      synth._voices = []
      expect(pickMelodyVoice()).toBeNull()
      // Importantly, the negative result is NOT cached when the list was
      // empty — a follow-up call after voiceschanged populates voices
      // must be able to pick afresh.
      synth._voices = [fakeVoice('Samantha', 'en-US')]
      expect(pickMelodyVoice()?.name).toBe('Samantha')
    })

    it('returns null when there are voices but none are English', () => {
      const synth = installFakeSynth()
      synth._voices = [
        fakeVoice('Paulina', 'es-MX'),
        fakeVoice('Yuna', 'ko-KR'),
      ]
      expect(pickMelodyVoice()).toBeNull()
    })

    it('prefers Samantha (tier 1, top of preference list) when present', () => {
      // Samantha is the iPad / iOS Safari default US-English voice and the
      // first entry in MELODY_VOICE_NAMES — it should win even when other
      // matching female voices are also present.
      const synth = installFakeSynth()
      const samantha = fakeVoice('Samantha', 'en-US')
      synth._voices = [
        fakeVoice('Karen', 'en-AU'),
        fakeVoice('Allison', 'en-US'),
        samantha,
        fakeVoice('Daniel', 'en-GB'),
      ]
      expect(pickMelodyVoice()).toBe(samantha)
    })

    it('honours preference order when Samantha is absent (Karen wins over Allison)', () => {
      const synth = installFakeSynth()
      const karen = fakeVoice('Karen', 'en-AU')
      const allison = fakeVoice('Allison', 'en-US')
      synth._voices = [allison, karen]
      // Even though Allison comes first in getVoices(), Karen is earlier in
      // the preference list and wins.
      expect(pickMelodyVoice()).toBe(karen)
    })

    it('matches name prefixes (e.g. "Samantha (Enhanced)") via the ^Samantha pattern', () => {
      // iPadOS sometimes labels voice variants like "Samantha (Enhanced)".
      // The ^-anchored regex in pickMelodyVoice should still match.
      const synth = installFakeSynth()
      const enhanced = fakeVoice('Samantha (Enhanced)', 'en-US')
      synth._voices = [enhanced]
      expect(pickMelodyVoice()).toBe(enhanced)
    })

    it('filters non-English voices out of consideration', () => {
      const synth = installFakeSynth()
      // A Spanish voice happens to be named "Samantha" — must be skipped
      // because it's not en-*. We don't want a Spanish voice rendering
      // English text on Marian's iPad.
      synth._voices = [
        fakeVoice('Samantha', 'es-ES'),
        fakeVoice('Karen', 'en-AU'),
      ]
      expect(pickMelodyVoice()?.name).toBe('Karen')
    })

    it('falls back to "(female)"-labeled voices on Android-style engines', () => {
      // Older Chrome / Android engines label voices "English United States
      // (female)". No tier-1 name match → tier-2 picks it up.
      const synth = installFakeSynth()
      const female = fakeVoice('English United States (female)', 'en-US')
      synth._voices = [
        fakeVoice('Daniel', 'en-GB'),
        female,
        fakeVoice('Mark', 'en-US'),
      ]
      expect(pickMelodyVoice()).toBe(female)
    })

    it('falls back to literal name === "Samantha" if regex-anchored match somehow misses (defensive tier 3)', () => {
      // Tier 3 is a redundancy: the tier-1 ^Samantha regex already catches
      // a voice named exactly "Samantha". This test is mostly insurance:
      // if a future regex edit accidentally drops the Samantha entry from
      // tier 1, tier 3 still fires the right pick.
      const synth = installFakeSynth()
      const samantha = fakeVoice('Samantha', 'en-US')
      synth._voices = [samantha]
      expect(pickMelodyVoice()).toBe(samantha)
    })

    it('returns null when no English voice matches any tier', () => {
      const synth = installFakeSynth()
      synth._voices = [
        fakeVoice('Daniel', 'en-GB'),
        fakeVoice('Mark', 'en-US'),
        fakeVoice('Bruce', 'en-AU'),
      ]
      expect(pickMelodyVoice()).toBeNull()
    })

    it('caches the picked voice across calls (no re-iteration on every speak)', () => {
      // Module-level cache is the whole point — speak() runs on every
      // utterance so we don't want a getVoices() iteration each time.
      const synth = installFakeSynth()
      const samantha = fakeVoice('Samantha', 'en-US')
      synth._voices = [samantha]

      expect(pickMelodyVoice()).toBe(samantha)
      const callsAfterFirst = synth.getVoices.mock.calls.length

      // Second call — should hit the cache. We allow ONE getVoices() call
      // (the re-validation scan) but not the full iteration.
      expect(pickMelodyVoice()).toBe(samantha)
      const callsAfterSecond = synth.getVoices.mock.calls.length
      // At most one extra call (the cache-validation scan).
      expect(callsAfterSecond - callsAfterFirst).toBeLessThanOrEqual(1)
    })

    it('caches the negative "no match" result so retries are cheap', () => {
      // After a confirmed-empty match, subsequent calls should not iterate
      // the voice list again. A re-pick only happens after _resetMelodyVoice
      // CacheForTests() (or a fresh page load).
      const synth = installFakeSynth()
      synth._voices = [fakeVoice('Daniel', 'en-GB'), fakeVoice('Mark', 'en-US')]
      expect(pickMelodyVoice()).toBeNull()
      const callsAfterFirst = synth.getVoices.mock.calls.length

      expect(pickMelodyVoice()).toBeNull()
      const callsAfterSecond = synth.getVoices.mock.calls.length
      // The "cached null" path skips getVoices entirely.
      expect(callsAfterSecond).toBe(callsAfterFirst)
    })

    it('invalidates the cache if the picked voice disappears from the engine list', () => {
      // Bluetooth disconnect / external display unplug can drop voices
      // mid-session. Stale-cache scenario: cached Samantha is no longer
      // in getVoices() — pickMelodyVoice must re-pick.
      const synth = installFakeSynth()
      const samantha = fakeVoice('Samantha', 'en-US')
      const karen = fakeVoice('Karen', 'en-AU')
      synth._voices = [samantha, karen]
      expect(pickMelodyVoice()).toBe(samantha)

      // Samantha disappears.
      synth._voices = [karen]
      expect(pickMelodyVoice()).toBe(karen)
    })
  })

  describe('speak — auto voice selection (round 5: light girl voice)', () => {
    it('assigns pickMelodyVoice() to utterance.voice when no voiceURI is provided', async () => {
      // Round-5 fix: without this, iPad falls back to the system default
      // voice (often male / deep on Thomas's iPad). Auto-pick gives
      // Melody a consistent light female voice across devices.
      const synth = installFakeSynth()
      const samantha = fakeVoice('Samantha', 'en-US')
      synth._voices = [samantha]
      const promise = speak('Hi.')
      const u = synth._utterances[0]
      expect(u.voice).toBe(samantha)
      u.onend?.call(u as unknown as SpeechSynthesisUtterance)
      await promise
    })

    it('explicit voiceURI still wins over the auto-pick (override path intact)', async () => {
      // Callers that already know which voice they want must not be
      // overridden by the auto-picker.
      const synth = installFakeSynth()
      const samantha = fakeVoice('Samantha', 'en-US', 'com.apple.samantha')
      const karen = fakeVoice('Karen', 'en-AU', 'com.apple.karen')
      synth._voices = [samantha, karen]

      const promise = speak('Hi.', { voiceURI: 'com.apple.karen' })
      const u = synth._utterances[0]
      expect(u.voice).toBe(karen)
      u.onend?.call(u as unknown as SpeechSynthesisUtterance)
      await promise
    })

    it('leaves utterance.voice unset (engine default) when no English voice matches', async () => {
      // Graceful degradation: if pickMelodyVoice() returns null, we don't
      // pretend we know better than the OS. The engine picks its system
      // default, and pitch 1.1 lifts it out of "deep" territory anyway.
      const synth = installFakeSynth()
      synth._voices = [fakeVoice('Daniel', 'en-GB')] // not in preference list
      const promise = speak('Hi.')
      const u = synth._utterances[0]
      expect(u.voice).toBeNull()
      u.onend?.call(u as unknown as SpeechSynthesisUtterance)
      await promise
    })
  })
})
