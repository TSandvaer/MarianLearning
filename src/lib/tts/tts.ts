// iOS Safari requires the first speak() call to originate from a user gesture;
// callers must ensure that, this module makes no attempt to fake one.

import { recordSpeakAttempt, recordSpeakStatus } from '../debug/debugBus'
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
  /**
   * Fires when the engine actually begins speaking — i.e. the
   * `SpeechSynthesisUtterance.onstart` event. Used by `useAudioUnlockGate`
   * to confirm the iPad Safari gesture-gate let the call through. If the
   * engine doesn't emit onstart (rare; some custom voices), the gate falls
   * back to interpreting the first onboundary as a start signal.
   */
  onStart?: () => void
}

// Spec design/session-1.md line 29 calls for `rate 0.9, pitch 1.1` to give
// Melody her slightly higher, slightly slower character voice. iPad Safari
// QA on Thomas's real device showed TTS dead even with the gesture in the
// right place, and one of the documented iOS WebKit quirks is silent
// rejection of utterances with non-default pitch/rate (especially pitch).
// We pulled the defaults to 1.0 for both to maximise the chance the engine
// honours the call. PR body documents the deviation; if iPad sounds too
// "flat" once TTS is unblocked, Kyle has the call on whether to bring
// pitch back up incrementally and re-test, or live with neutral defaults.
const DEFAULT_RATE = 1.0
const DEFAULT_PITCH = 1.0
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

/**
 * Synchronously poke the voice list. Some iPad WebKit builds only start
 * loading voices the first time `getVoices()` is called — a cheap, safe nudge
 * during Splash means the voice list is ready by the time the Wake-tap fires
 * speak(). The return value is intentionally unused; the side effect is the
 * point. Safe to call repeatedly; safe to call before any user gesture.
 */
export function primeVoices(): void {
  const synth = getSynth()
  if (!synth) return
  try {
    synth.getVoices()
  } catch {
    // Defensive: some engines throw if speech isn't initialised. Swallow.
  }
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
    recordSpeakAttempt(text, 'errored', 'Web Speech API not available')
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
      recordSpeakStatus('ended')
      resolve()
    }

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      cleanup()
      const errMsg = event.error || 'speech synthesis error'
      recordSpeakStatus('errored', errMsg)
      // `canceled` and `interrupted` come through onerror in some engines.
      reject(new Error(errMsg))
    }

    if (opts.onStart) {
      const userOnStart = opts.onStart
      utterance.onstart = () => {
        recordSpeakStatus('started')
        userOnStart()
      }
    } else {
      utterance.onstart = () => {
        recordSpeakStatus('started')
      }
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
    //
    // CRITICAL iPad note (post-PR-#21 Thomas iPad QA): cancel-then-speak in the
    // same JS task is a documented iOS WebKit bug — the new speak is silently
    // dropped. We sidestep that by ONLY calling cancel() when there's actually
    // an in-flight utterance to cancel. On a cold-load first speak (the path
    // Wake's tap takes), `activeReject` is null so this branch is skipped and
    // the engine sees a clean speak() with no cancel preceding it.
    if (activeReject) {
      const prevReject = activeReject
      activeReject = null
      synth.cancel()
      prevReject(new Error('canceled'))
    }
    activeUtterance = utterance
    activeReject = reject

    // iPad Safari sometimes initialises `speechSynthesis` in a paused state,
    // especially after the PWA returns from a background tab or after the
    // service worker cycles. resume() is a no-op when not paused, so it's
    // safe to call unconditionally on every speak. Inside the user-gesture
    // tick, resume() also re-arms the engine so the speak() that follows is
    // recognised as user-activated.
    try {
      synth.resume()
    } catch {
      // Some engines throw if not initialised. The speak() call below will
      // tell us anything resume()'s exception couldn't.
    }

    recordSpeakAttempt(text, 'queued')
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
