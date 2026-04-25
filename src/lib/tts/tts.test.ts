import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancel, isAvailable, loadVoices, speak } from './tts'

type UtteranceLike = {
  text: string
  rate: number
  pitch: number
  volume: number
  voice: SpeechSynthesisVoice | null
  onend: ((this: SpeechSynthesisUtterance) => void) | null
  onerror:
    | ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => void)
    | null
}

class FakeUtterance implements UtteranceLike {
  text: string
  rate = 1
  pitch = 1
  volume = 1
  voice: SpeechSynthesisVoice | null = null
  onend: ((this: SpeechSynthesisUtterance) => void) | null = null
  onerror:
    | ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => void)
    | null = null

  constructor(text: string) {
    this.text = text
  }
}

interface FakeSynth {
  speak: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
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
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    cancel()
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
    it('resolves when the utterance ends', async () => {
      const synth = installFakeSynth()
      const promise = speak('Hi! I am Melody.')

      expect(synth.speak).toHaveBeenCalledTimes(1)
      const u = synth._utterances[0]
      expect(u.text).toBe('Hi! I am Melody.')
      expect(u.rate).toBeCloseTo(0.9)
      expect(u.pitch).toBeCloseTo(1.1)
      expect(u.volume).toBe(1.0)

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

    it('rejects when the Web Speech API is not available', async () => {
      vi.stubGlobal('speechSynthesis', undefined)
      vi.stubGlobal('SpeechSynthesisUtterance', undefined)
      await expect(speak('Hi.')).rejects.toThrow('not available')
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
})
