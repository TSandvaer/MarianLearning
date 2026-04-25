// iOS Safari requires the first speak() call to originate from a user gesture;
// callers must ensure that, this module makes no attempt to fake one.

import { subscribeToBoundary } from './boundary'
import type { BoundaryEvent } from './boundary'

export interface SpeakOptions {
  voiceURI?: string
  rate?: number
  pitch?: number
  volume?: number
  /**
   * Receive a callback per word boundary, synced to TTS playback. Uses the
   * Web Speech API's `onboundary` event when available, with a paced fallback
   * for engines (looking at you, iPad WebKit) where it's unreliable.
   *
   * See `./boundary.ts` for the full subscription API if you need to attach
   * to an utterance you already own.
   */
  onBoundary?: (event: BoundaryEvent) => void
  /**
   * Words-per-minute used by the Safari fallback path. Defaults to 165 to
   * roughly match Melody's `rate: 0.9`. Has no effect if the engine fires
   * `onboundary` natively.
   */
  boundaryWPM?: number
}

const DEFAULT_RATE = 0.9
const DEFAULT_PITCH = 1.1
const DEFAULT_VOLUME = 1.0

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  return window.speechSynthesis ?? null
}

export function isAvailable(): boolean {
  return (
    getSynth() !== null && typeof window.SpeechSynthesisUtterance === 'function'
  )
}

/**
 * Resolves with the available voices. On most browsers the voice list arrives
 * asynchronously; we listen for the `voiceschanged` event when needed and fall
 * back to a short polling loop for engines that never fire it (older Safari).
 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = getSynth()
  if (!synth) return Promise.resolve([])

  const initial = synth.getVoices()
  if (initial.length > 0) return Promise.resolve(initial)

  return new Promise((resolve) => {
    let settled = false

    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (settled) return
      settled = true
      synth.removeEventListener?.('voiceschanged', onChanged)
      clearInterval(poll)
      clearTimeout(timeout)
      resolve(voices)
    }

    const onChanged = () => finish(synth.getVoices())

    synth.addEventListener?.('voiceschanged', onChanged)

    // Safari sometimes never fires voiceschanged. Poll briefly as a backstop.
    const poll = setInterval(() => {
      const voices = synth.getVoices()
      if (voices.length > 0) finish(voices)
    }, 100)

    // Cap the wait so callers never hang forever on an engine with no voices.
    const timeout = setTimeout(() => finish(synth.getVoices()), 2000)
  })
}

let activeUtterance: SpeechSynthesisUtterance | null = null
let activeReject: ((reason: Error) => void) | null = null

/**
 * Speak `text` with Melody's default voice profile. Resolves on natural end,
 * rejects on synthesis error or if `cancel()` is called while speaking.
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const synth = getSynth()
  if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') {
    return Promise.reject(new Error('Web Speech API not available'))
  }

  return new Promise<void>((resolve, reject) => {
    const utterance = new window.SpeechSynthesisUtterance(text)
    utterance.rate = opts.rate ?? DEFAULT_RATE
    utterance.pitch = opts.pitch ?? DEFAULT_PITCH
    utterance.volume = opts.volume ?? DEFAULT_VOLUME

    if (opts.voiceURI) {
      const voice = synth.getVoices().find((v) => v.voiceURI === opts.voiceURI)
      if (voice) utterance.voice = voice
    }

    const cleanup = () => {
      utterance.onend = null
      utterance.onerror = null
      if (activeUtterance === utterance) {
        activeUtterance = null
        activeReject = null
      }
    }

    utterance.onend = () => {
      cleanup()
      resolve()
    }

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      cleanup()
      // `canceled` and `interrupted` come through onerror in some engines.
      reject(new Error(event.error || 'speech synthesis error'))
    }

    // Subscribe to boundary events AFTER onend/onerror are wired so the
    // boundary helper can chain through them rather than be clobbered.
    if (opts.onBoundary) {
      subscribeToBoundary(utterance, opts.onBoundary, {
        wpm: opts.boundaryWPM,
      })
    }

    // Replace any in-flight utterance so callers don't accidentally stack speech.
    // Web Speech API queues utterances by default, so we must call synth.cancel()
    // to stop the previous one at the audio layer — rejecting the JS promise alone
    // doesn't silence the speaker on iPad/Safari.
    if (activeReject) {
      const prevReject = activeReject
      activeReject = null
      synth.cancel()
      prevReject(new Error('canceled'))
    }
    activeUtterance = utterance
    activeReject = reject

    synth.speak(utterance)
  })
}

/**
 * Stop any current speech. Any in-flight `speak()` promise rejects with
 * `Error('canceled')`.
 */
export function cancel(): void {
  const synth = getSynth()
  if (!synth) return

  const reject = activeReject
  activeUtterance = null
  activeReject = null
  synth.cancel()
  if (reject) reject(new Error('canceled'))
}
