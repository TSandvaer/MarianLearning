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

// Spec design/session-1.md line 29: `rate 0.9, pitch 1.1` gives Melody her
// slightly higher, slightly slower character voice (light girl bunny). PR #22
// temporarily flattened these to 1.0/1.0 as a defensive guess — we suspected
// iPad WebKit was silently rejecting non-default pitch utterances. PR #23
// then proved that hypothesis wrong: TTS works end-to-end with the right
// gesture-gate + pointer-events fix. Reverted to spec values in round 5
// (ticket 86c9gp99a) after Thomas iPad QA confirmed audio fires reliably;
// the deep voice he reported on iPad was the engine picking a system default
// voice WITH pitch 1.0, not pitch 1.1 being rejected. See pickMelodyVoice()
// below for the voice-selection half of the fix.
const DEFAULT_RATE = 0.9
const DEFAULT_PITCH = 1.1
const DEFAULT_VOLUME = 1.0

/**
 * Names of light-to-medium female English voices commonly available on
 * iPad / macOS / iOS Safari. Order in `MELODY_VOICE_NAMES` is preference:
 * earliest-listed name wins. Drawn from observed `getVoices()` output on
 * real iPads (Samantha is the default US English voice on virtually every
 * iPadOS install) and macOS Big Sur+ shipping voices.
 *
 * We anchor each entry with `^` when matching so partial-name collisions
 * ("Samantha (Enhanced)") still match the intended voice family without
 * accidentally picking up "Mark" or other male voices that happen to
 * contain a substring.
 */
const MELODY_VOICE_NAMES = [
  'Samantha',
  'Karen',
  'Allison',
  'Ava',
  'Susan',
  'Victoria',
  'Serena',
  'Catherine',
  'Tessa',
  'Moira',
  'Fiona',
] as const

/**
 * Cached voice pick. Recomputed on first call after page load (and whenever
 * the cached voice goes stale — see invalidation in pickMelodyVoice itself).
 * Module-level so we don't iterate getVoices() on every utterance, which is
 * cheap individually but adds up once Melody is talking through a session.
 */
let cachedMelodyVoice: SpeechSynthesisVoice | null = null
let cachedMelodyVoiceComputed = false

/**
 * Test-only seam — clears the module-level voice cache so each test starts
 * with a clean slate. Exported so `pickMelodyVoice` tests can run in any
 * order without leaking cached state across cases.
 */
export function _resetMelodyVoiceCacheForTests(): void {
  cachedMelodyVoice = null
  cachedMelodyVoiceComputed = false
}

/**
 * Pick the best-fit voice for Melody from whatever the engine offers.
 *
 *  1. Filter to English voices (`lang.startsWith('en')`). Spec is en-US,
 *     but Marian's iPad may ship en-GB / en-AU as the only options — any
 *     English voice is better than the system-default non-English fallback
 *     some configurations surface.
 *  2. Prefer named voices in MELODY_VOICE_NAMES (in order). These are the
 *     light/medium female voices that match Melody's character (Sanrio
 *     bunny, child-coded).
 *  3. Fall back to any voice whose name contains "(female)" — older Android
 *     / Chrome installs label voices this way.
 *  4. Fall back to a literal `name === 'Samantha'` heuristic for engines
 *     that don't surface gender metadata at all.
 *  5. If nothing matches, return `null` and let the caller leave
 *     `utterance.voice` unset — the engine then picks its system default.
 *     We don't pretend we know better than the OS in that case.
 *
 * Returns the chosen voice or null. Cached at module level for reuse.
 */
export function pickMelodyVoice(): SpeechSynthesisVoice | null {
  // Cache hit (positive): re-validate the voice is still in the engine's
  // voice list, because some engines drop voices when an external display
  // / Bluetooth audio device disconnects mid-session. Cheap O(n) scan.
  if (cachedMelodyVoiceComputed && cachedMelodyVoice !== null) {
    const synth = getSynth()
    if (synth) {
      const voices = synth.getVoices()
      if (voices.includes(cachedMelodyVoice)) return cachedMelodyVoice
    }
    // Cached voice is gone — re-pick.
    cachedMelodyVoice = null
    cachedMelodyVoiceComputed = false
  } else if (cachedMelodyVoiceComputed) {
    // Cached "no match" — cheap to return without re-iterating.
    return null
  }

  const synth = getSynth()
  if (!synth) return null

  const all = synth.getVoices()
  if (all.length === 0) {
    // Voice list isn't ready yet; don't cache the negative result so the
    // next call (after voiceschanged fires) can pick up real voices.
    return null
  }

  const englishVoices = all.filter((v) =>
    v.lang?.toLowerCase().startsWith('en'),
  )
  if (englishVoices.length === 0) {
    cachedMelodyVoiceComputed = true
    cachedMelodyVoice = null
    return null
  }

  // Tier 1: named-pattern match, preserving preference order. We walk
  // MELODY_VOICE_NAMES (not getVoices()'s ordering, which is engine-dependent
  // and not stable across iPadOS versions) so Samantha wins over Karen wins
  // over Allison.
  for (const preferredName of MELODY_VOICE_NAMES) {
    const re = new RegExp(`^${preferredName}`, 'i')
    const match = englishVoices.find((v) => re.test(v.name))
    if (match) {
      cachedMelodyVoice = match
      cachedMelodyVoiceComputed = true
      return match
    }
  }

  // Tier 2: any voice with "(female)" in the name (Android / older Chrome).
  const femaleLabeled = englishVoices.find((v) => /\(female\)/i.test(v.name))
  if (femaleLabeled) {
    cachedMelodyVoice = femaleLabeled
    cachedMelodyVoiceComputed = true
    return femaleLabeled
  }

  // Tier 3: literal Samantha heuristic. Already covered by tier 1, but kept
  // explicitly per the brief — defensive against future regex edits.
  const samantha = englishVoices.find((v) => v.name === 'Samantha')
  if (samantha) {
    cachedMelodyVoice = samantha
    cachedMelodyVoiceComputed = true
    return samantha
  }

  cachedMelodyVoiceComputed = true
  cachedMelodyVoice = null
  return null
}

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
    } else {
      // No explicit voice override — pick Melody's character voice from the
      // engine's voice list. Without this assignment iPad Safari falls back
      // to whatever the system default voice is, which on Thomas's real
      // device read as a deep / masculine voice (not the light girl bunny
      // the spec calls for). pickMelodyVoice() returns null if no English
      // voice matches our preference list, in which case we leave
      // utterance.voice unset and the engine default kicks in — at least
      // pitch 1.1 will lift it out of "deep" territory.
      const melodyVoice = pickMelodyVoice()
      if (melodyVoice) utterance.voice = melodyVoice
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
