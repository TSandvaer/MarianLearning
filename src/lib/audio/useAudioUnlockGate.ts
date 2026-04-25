/**
 * useAudioUnlockGate — reusable hook for the iPad Safari TTS gesture gate.
 *
 * Background
 * ----------
 * iPad Safari rejects `speechSynthesis.speak()` and any new `Audio` / `Howl`
 * playback unless the call sits in the synchronous body of a user-gesture
 * handler. The unlock is per-app-session: once any gesture-aligned audio
 * call lands, the rest of the session stays unlocked. See
 * design/session-1.md → "iPad Safari audio constraint" for the spec author's
 * full rationale.
 *
 * Two failure modes need handling
 * -------------------------------
 * 1. **First-utterance miss (Dave's contract).** Even with the gesture in
 *    the right place, iPadOS occasionally rejects the very first call. We
 *    give it 5s; if `onstart` never fires we mark the unlock as pending so
 *    the next user gesture can synchronously retry with a fresh utterance.
 *    The user sees a short silent beat, never an error.
 *
 *    The 5s value (bumped from 2s in round 5, ticket 86c9gp99a) is sized
 *    against Thomas's real-iPad QA: first-speech routinely takes 3-5s on
 *    cold-cache PWA loads (voice list lazy-init, audio session warm-up,
 *    Howler WebAudio context bridge). 2s was triggering spurious relocks
 *    BEFORE the engine actually started speaking — Marian saw the ring
 *    re-pulse, tapped again, queued a second speak() that competed with
 *    the first; the "eventually one wins" pattern she reported.
 *
 * 2. **Soft re-gate after long background.** When iPadOS aggressively
 *    suspends a backgrounded PWA's audio context (>~5 min), the next
 *    `speak()` from a new screen will silently no-op. Same recovery path:
 *    250 ms after the speak call, if `onstart` still hasn't fired, surface
 *    the Wake-state ring + tap-anywhere affordance in-place. Reuses Greet's
 *    Screen 2 affordance verbatim — same ring, same gesture, no copy.
 *
 * What this hook owns
 * -------------------
 * - The `gateState` machine: `idle` → `pending` → `unlocked` (or `idle` →
 *   `pending` → `relock` if onstart never fires within the watchdog window).
 * - The watchdog timeout. Configurable per call: 5000 ms for the
 *   first-utterance retry contract, 250 ms for the cross-screen soft re-gate.
 * - A `reportSpeechStart()` callback that callers wire into their TTS
 *   utility's `onstart` (or, since lib/tts doesn't expose onstart, the
 *   `onBoundary` first-fire) to clear the watchdog.
 * - A `retryOnGesture` mechanism: components register a synchronous retry
 *   callback. When the user taps the ring/screen while we're in `relock`,
 *   the hook fires the callback inside the same JS tick — preserving the
 *   gesture-context association.
 *
 * What this hook does NOT own
 * ---------------------------
 * - The Wake-state visuals (ring, breathing Melody, finger-tap icon). Those
 *   live in components. The hook just exposes a `showGate: boolean` for the
 *   component to render against.
 * - The actual `speechSynthesis.speak()` call. The hook gives you a
 *   `wrapSpeak()` that arms/disarms the watchdog around YOUR speak call —
 *   it never owns the utterance.
 *
 * Why a hook (not a singleton)
 * ----------------------------
 * Per-screen state. Each screen mount can independently determine whether
 * its first speak() lands. A singleton would have to track which screen is
 * "current" and the lifecycle gets messy. The hook is small enough that
 * paying it per screen is fine.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { recordGateState } from '../debug/debugBus'

export type GateState =
  /** No speak() in flight; gate hidden. Default state on mount. */
  | 'idle'
  /** A speak() was just dispatched; watchdog is armed. Gate hidden. */
  | 'pending'
  /** A speak() onstart was observed; the audio context is unlocked. */
  | 'unlocked'
  /**
   * Watchdog expired without onstart firing. Surface the gate; on next
   * gesture, fire the registered retry callback synchronously.
   */
  | 'relock'

export interface UseAudioUnlockGateOptions {
  /**
   * How long to wait for `reportSpeechStart()` before transitioning to
   * `relock`. Defaults to 5000 ms — Dave's first-utterance retry contract,
   * sized against real-iPad first-speech latency observed in round-5 QA
   * (Thomas iPad). Pass 250 ms for the cross-screen soft-regate path.
   */
  watchdogMs?: number
  /**
   * Test seam — defaults to `window.setTimeout`.
   */
  schedule?: (cb: () => void, ms: number) => unknown
  /**
   * Test seam — defaults to `window.clearTimeout`.
   */
  cancelSchedule?: (handle: unknown) => void
}

export interface AudioUnlockGate {
  /** Current gate state — components render the ring iff this is `'relock'`. */
  state: GateState
  /** Convenience: `state === 'relock'`. */
  showGate: boolean
  /**
   * Wrap your synchronous speak() call. Arms the watchdog before invoking
   * `runSpeak`, then transitions through `pending` → (`unlocked` | `relock`)
   * based on whether `reportSpeechStart()` is called.
   *
   * The wrapper itself is synchronous so the gesture-context association
   * holds — `runSpeak` is invoked in the same tick the caller invoked
   * `wrapSpeak` in.
   */
  wrapSpeak: (runSpeak: () => void) => void
  /**
   * Call this from your TTS layer when speech genuinely begins (onstart, or
   * the first onboundary on engines that skip onstart). Clears the
   * watchdog and transitions to `unlocked`.
   */
  reportSpeechStart: () => void
  /**
   * Register a synchronous retry callback. While `state === 'relock'`, the
   * hook will invoke this callback the next time `dispatchGesture()` is
   * called. The callback should itself be a synchronous `wrapSpeak()`
   * invocation so the new gesture context propagates to the new speak().
   *
   * Re-registering replaces any previous callback.
   */
  registerRetry: (cb: (() => void) | null) => void
  /**
   * The component's tap handler should call this from its synchronous
   * onPointerDown / onClick handler. If we're in `relock` and a retry is
   * registered, the retry runs synchronously inside this call and returns
   * `true`. Otherwise returns `false` so the caller can do its normal work.
   */
  dispatchGesture: () => boolean
  /**
   * Manual reset to `idle`. Useful for screens that want to re-arm the gate
   * across navigation, or for tests.
   */
  reset: () => void
}

/**
 * Default first-utterance watchdog window. Bumped from 2000 → 5000 ms in
 * round 5 (ticket 86c9gp99a) after Thomas iPad QA showed first-speech
 * routinely takes 3-5 s on cold-cache PWA loads. The previous 2 s value
 * was triggering spurious relocks BEFORE the engine actually started
 * speaking — Marian then tapped again, queued a competing speak(), and
 * saw the "ring re-pulses several times then voice eventually fires"
 * pattern. 5 s is the safe upper bound on observed first-speech latency.
 */
const DEFAULT_WATCHDOG_MS = 5000

export function useAudioUnlockGate(
  opts: UseAudioUnlockGateOptions = {},
): AudioUnlockGate {
  const watchdogMs = opts.watchdogMs ?? DEFAULT_WATCHDOG_MS

  const [state, setState] = useState<GateState>('idle')

  // Refs that survive re-renders. We deliberately avoid useState for these —
  // changing them should not trigger a render. Schedule/cancel are stashed in
  // refs (and refreshed via effect) so the callback identities below stay
  // stable across renders — otherwise the unmount-cleanup effect would
  // re-register on every state change and cancel the in-flight watchdog the
  // moment we entered `pending`. Took an embarrassing afternoon to find that.
  const scheduleRef = useRef<
    NonNullable<UseAudioUnlockGateOptions['schedule']>
  >(opts.schedule ?? ((cb, ms) => window.setTimeout(cb, ms)))
  const cancelScheduleRef = useRef<
    NonNullable<UseAudioUnlockGateOptions['cancelSchedule']>
  >(opts.cancelSchedule ?? ((h) => window.clearTimeout(h as number)))

  // Refresh refs from props after commit so callers swapping schedulers
  // mid-life still work. Done here, not during render, to satisfy the
  // react-hooks/refs lint rule (and avoid the standard "ref mutation during
  // render is a tearing hazard" pitfall).
  useEffect(() => {
    if (opts.schedule) scheduleRef.current = opts.schedule
    if (opts.cancelSchedule) cancelScheduleRef.current = opts.cancelSchedule
  }, [opts.schedule, opts.cancelSchedule])

  const watchdogHandleRef = useRef<unknown>(null)
  const retryRef = useRef<(() => void) | null>(null)

  // Push the current state to the debug bus on every change so the
  // `?debug=1` overlay can show what the iPad sees in real time. The
  // bus is a no-op when there are no listeners, so this is free in
  // normal sessions.
  useEffect(() => {
    recordGateState(state)
  }, [state])

  const clearWatchdog = useCallback(() => {
    if (watchdogHandleRef.current !== null) {
      cancelScheduleRef.current(watchdogHandleRef.current)
      watchdogHandleRef.current = null
    }
  }, [])

  // Tear down watchdog on unmount only. Empty deps deliberate — see the
  // schedule-ref note above.
  useEffect(() => {
    return () => {
      clearWatchdog()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wrapSpeak = useCallback(
    (runSpeak: () => void): void => {
      // Arm watchdog FIRST, then run the synchronous speak. Order matters
      // less for correctness than for clarity; the speak call is what unlocks
      // the engine, the watchdog is what we read afterward.
      clearWatchdog()
      setState('pending')
      watchdogHandleRef.current = scheduleRef.current(() => {
        watchdogHandleRef.current = null
        // We only flip to `relock` if we're still pending. If onstart already
        // arrived (state === 'unlocked'), leave it alone.
        setState((prev) => (prev === 'pending' ? 'relock' : prev))
      }, watchdogMs)

      // Synchronous dispatch — this is the whole point.
      runSpeak()
    },
    [clearWatchdog, watchdogMs],
  )

  const reportSpeechStart = useCallback(() => {
    clearWatchdog()
    setState('unlocked')
  }, [clearWatchdog])

  const registerRetry = useCallback((cb: (() => void) | null): void => {
    retryRef.current = cb
  }, [])

  const dispatchGesture = useCallback((): boolean => {
    // Only consume the gesture if we actually have a retry queued AND we're
    // in a state where retrying is appropriate.
    if (state !== 'relock') return false
    const cb = retryRef.current
    if (!cb) return false
    // Run synchronously so the new gesture context propagates.
    cb()
    return true
  }, [state])

  const reset = useCallback((): void => {
    clearWatchdog()
    retryRef.current = null
    setState('idle')
  }, [clearWatchdog])

  return {
    state,
    showGate: state === 'relock',
    wrapSpeak,
    reportSpeechStart,
    registerRetry,
    dispatchGesture,
    reset,
  }
}
