/**
 * Pending-resume gate — gesture-deferred AudioContext recovery.
 *
 * Ticket 86c9kxtmu (PR #137 round 2). Thomas's iPad PWA repro proved
 * that calling `Howler.ctx.resume()` + `unlockIosAudioSession()` from a
 * `visibilitychange` handler does NOT actually unstick an iOS-`'interrupted'`
 * AudioContext on real iPad PWA. The visibilitychange event is a system
 * event, not a user gesture — `resume()` resolves but the OS audio
 * session stays preempted, the silent buffer fires (`bufferStarted: true`)
 * but downstream `play()` calls land on `ctxState: "suspended"` and
 * produce no audible sound. iOS's WebAudio session-lock requires the
 * resume + buffer to happen INSIDE the synchronous body of a real user-
 * gesture handler.
 *
 * The audioCtxLog evidence
 * ------------------------
 * From Thomas's 2026-05-02 iPad PWA capture (the data the round-1
 * silent-buffer-on-resume fix was checked against):
 *
 *   t=237539 statechange → ctxState: "interrupted"
 *   t=237661 visibility-hidden-pre/post (suspend called)
 *   t=281562 visibility-visible-pre (~44s later, Thomas reopens)
 *   t=281565 visibility-visible-post → ctxState: "suspended"
 *   t=281566 visibility-recovery-buffer → bufferStarted: true
 *   t=281600 play-utterance-dispatch math.p5.read → ctxState: "suspended"
 *   t=281601 howl-play-event → ctxState: "suspended"  ← silent
 *   …       every subsequent dispatch: still "suspended"
 *
 * The `visibility-recovery-buffer` row "fires" but the context is not
 * actually re-engaged — Howler dispatches play, returns a soundId, but no
 * audio emits. Round-1 fix shipped a buffer-on-resume that was logged as
 * working but wasn't.
 *
 * What this module does
 * ---------------------
 * 1. **`markPending()`** — called by `useHowlerSuspendOnHide` on the
 *    `visible` edge when ctx state is `'suspended'` or `'interrupted'`.
 *    Sets the gate. Schedules a 3 s fallback timer.
 *
 * 2. **`isPending()`** — read by `playSessionUtterance` and the Hub line
 *    player. While pending, audio dispatches are queued instead of
 *    fired. This prevents the "Howler returns a soundId, no audio emits"
 *    silent-abyss case.
 *
 * 3. **`enqueue(handler)`** — registers a deferred play handler. The
 *    queue holds at most one entry; new pushes discard older ones, so
 *    when the user taps after a long absence the queue drain plays the
 *    MOST RECENT line, not a stale stack of every queued screen
 *    transition.
 *
 * 4. **`drainOnGesture(unlockFn, resumeFn)`** — called SYNCHRONOUSLY
 *    inside a user-gesture handler (chip tap, heart tap, hub node tap,
 *    or the "tap to continue" affordance). Runs `resume()` + the iOS
 *    silent-buffer kick, then invokes the queued handler (if any), then
 *    clears the pending flag. Unlike `useHowlerSuspendOnHide`, this
 *    fires inside the gesture's synchronous JS task — the iOS contract
 *    that the round-1 fix violated.
 *
 * 5. **Affordance subscription** — App.tsx renders a "tap to continue"
 *    affordance whenever the gate state is `'pending'` OR
 *    `'awaiting-tap'` (round-4, ticket 86c9kxtmu — Thomas's iPad
 *    capture showed Marian staying silent for the full 3 s fallback
 *    window, so the affordance now mounts on the visibility-recovery
 *    edge immediately rather than waiting for the fallback timer).
 *    Kyle's Greet wake-tap ring shape, reused. The fallback timer
 *    still transitions `'pending' → 'awaiting-tap'` so the
 *    audioCtxLog distinguishes "tapped within ms of returning" from
 *    "real walked-away" cases.
 *
 * What this module does NOT do
 * ----------------------------
 * - **It does not register tap listeners itself.** The screens own
 *   their tap surfaces; they call `drainOnGesture()` from inside their
 *   chip-tap / hub-node-tap / wake-tap handlers. A global window-level
 *   listener would race with React's event delegation and break the
 *   gesture-context association on iOS (the React handler would fire
 *   AFTER our window-level handler and lose the gesture window).
 *
 * - **It does not own the audio playback.** Callers pass a thunk that
 *   does the actual `Howl.play()` once the context is unstuck. The
 *   gate is pure dispatch routing.
 *
 * - **It does not call `resume()` / silent-buffer itself.** Callers
 *   pass those as injected fns so this module stays a pure singleton
 *   without a hard dep on `howlerContext.ts`. Lets unit tests stub
 *   them cleanly.
 *
 * Lifetime
 * --------
 * Module-level singleton. Survives screen mounts/unmounts the same way
 * `playSessionUtterance` does. Cleared on `_resetForTests()` only.
 */

import {
  recordPendingResumeGateState,
  type PendingResumeGateStateName,
} from '../debug/debugBus'

export type PendingResumeAffordanceState =
  /** No iOS interruption pending. Audio dispatches play normally. */
  | 'idle'
  /**
   * Visible edge fired with state `'suspended'`/`'interrupted'`; we've
   * marked the gate but the user hasn't tapped yet. Audio dispatches
   * are queued.
   *
   * Round-4 (PR #137 v4 — ticket 86c9kxtmu): the affordance now mounts
   * on `'pending'` immediately, NOT only on `'awaiting-tap'`. Thomas's
   * 2026-05-03 iPad capture showed Marian staying silent for the full
   * 3 s fallback window — she does not reflexively tap on
   * return-from-background, so the affordance has to be visible
   * immediately for audio to recover.
   */
  | 'pending'
  /**
   * Fallback timer elapsed without a user tap. Round-3 distinguished
   * `'pending'` (silent) from `'awaiting-tap'` (affordance mounted);
   * round-4 mounts the affordance on both states and uses this
   * transition only as a diagnostic signal in the audioCtxLog
   * (`pendingResumeGateState: 'awaiting-tap'` rows tell Thomas the
   * fallback fired without a gesture, distinguishing "real
   * walked-away" from "tapped within ms of returning").
   */
  | 'awaiting-tap'

export interface QueuedHandler {
  /** Caller's debug tag — included in logs / probe rows. */
  label: string
  /**
   * Synchronous-callable play handler. Invoked inside the gesture
   * window AFTER `resume()` + silent-buffer kick. The handler should
   * itself dispatch the play synchronously (or kick off any async
   * work whose first step is a synchronous Howl.play()).
   */
  run: () => void
}

export interface PendingResumeGateOptions {
  /**
   * Test seam — defaults to `window.setTimeout`. Production fallback
   * timer is sized at 3 000 ms; tests pass a small value plus a
   * controlled scheduler.
   */
  scheduleOnce?: (cb: () => void, ms: number) => unknown
  /** Test seam — defaults to `window.clearTimeout`. */
  cancelScheduleOnce?: (handle: unknown) => void
  /**
   * Override the fallback affordance timer. Defaults to 3 000 ms — the
   * "user came back, tapped within a few seconds" common case completes
   * before the affordance flashes up. Tests use a small value.
   */
  affordanceFallbackMs?: number
}

/**
 * Default fallback timer. 3 s is short enough that a backgrounded-and-
 * forgotten session surfaces the affordance promptly; long enough that
 * a tab-switcher round-trip (Marian's parent flips to mail, back to the
 * app) doesn't see the affordance flash unnecessarily before the chip
 * tap re-engages audio.
 *
 * The brief allowed 3-5 s; we picked 3 s because the audioCtxLog dump
 * shows real-world post-resume gestures landing within ~50 ms (the
 * chip-tap that briefly unstuck the context in Thomas's repro fired
 * almost immediately on his return). 3 s gives a 60× safety margin
 * before the affordance shows.
 */
const DEFAULT_AFFORDANCE_FALLBACK_MS = 3_000

interface InternalGateState {
  affordance: PendingResumeAffordanceState
  queue: QueuedHandler[]
  fallbackHandle: unknown
  scheduleOnce: NonNullable<PendingResumeGateOptions['scheduleOnce']>
  cancelScheduleOnce: NonNullable<
    PendingResumeGateOptions['cancelScheduleOnce']
  >
  affordanceFallbackMs: number
  subscribers: Set<(state: PendingResumeAffordanceState) => void>
}

function defaultScheduleOnce(cb: () => void, ms: number): unknown {
  if (typeof window === 'undefined') return null
  return window.setTimeout(cb, ms)
}

function defaultCancelScheduleOnce(handle: unknown): void {
  if (typeof window === 'undefined') return
  if (handle === null) return
  window.clearTimeout(handle as number)
}

const state: InternalGateState = {
  affordance: 'idle',
  queue: [],
  fallbackHandle: null,
  scheduleOnce: defaultScheduleOnce,
  cancelScheduleOnce: defaultCancelScheduleOnce,
  affordanceFallbackMs: DEFAULT_AFFORDANCE_FALLBACK_MS,
  subscribers: new Set(),
}

function emitState(): void {
  // Snapshot the subscribers before iteration so a callback that
  // unsubscribes mid-walk doesn't break the loop.
  for (const cb of Array.from(state.subscribers)) {
    try {
      cb(state.affordance)
    } catch {
      // Subscribers must not crash the dispatch loop.
    }
  }
}

function clearFallback(): void {
  if (state.fallbackHandle !== null) {
    state.cancelScheduleOnce(state.fallbackHandle)
    state.fallbackHandle = null
  }
}

/**
 * Map this module's internal affordance state to the audioCtxLog mirror
 * value (`PendingResumeGateStateName`). The internal `'pending'` state
 * surfaces as `'pending-resume'` in the log so a localStorage paste-back
 * is unambiguous next to the older audio-unlock gate's `'pending'` value
 * — different state machines, different semantics.
 *
 * PR #137 round 4 (ticket 86c9kxtmu) — Thomas's 2026-05-03 capture
 * showed only the OLD `gateState` field; round-3 had no way to confirm
 * the new gate flipped at the visible-edge of an interruption. The
 * mirror under its own field closes that diagnostic gap.
 */
function toLogState(
  affordance: PendingResumeAffordanceState,
): PendingResumeGateStateName {
  switch (affordance) {
    case 'idle':
      return 'idle'
    case 'pending':
      return 'pending-resume'
    case 'awaiting-tap':
      return 'awaiting-tap'
  }
}

function setAffordance(next: PendingResumeAffordanceState): void {
  if (state.affordance === next) return
  state.affordance = next
  // Mirror to the debug bus before notifying subscribers — the bus value
  // is read by `audioContextProbe` for every emit, and we want the next
  // probe row (which may fire synchronously inside a subscriber) to see
  // the up-to-date value.
  recordPendingResumeGateState(toLogState(next))
  emitState()
}

/**
 * Override the default schedulers / fallback duration. Tests call this
 * before each case; production never calls it. The override persists
 * until the next `configurePendingResumeGate` call or
 * `_resetPendingResumeGateForTests`.
 */
export function configurePendingResumeGate(
  opts: PendingResumeGateOptions,
): void {
  if (opts.scheduleOnce !== undefined) state.scheduleOnce = opts.scheduleOnce
  if (opts.cancelScheduleOnce !== undefined)
    state.cancelScheduleOnce = opts.cancelScheduleOnce
  if (opts.affordanceFallbackMs !== undefined)
    state.affordanceFallbackMs = opts.affordanceFallbackMs
}

/**
 * Mark the gate as pending — called from `useHowlerSuspendOnHide` on the
 * `visible` edge when iOS handed us `'suspended'` or `'interrupted'`.
 *
 * Idempotent: re-marking while already pending refreshes the fallback
 * timer (each new visibility return that lands suspended is a fresh
 * "user is back" signal).
 *
 * On the FIRST mark we transition `idle → pending`. The fallback timer
 * elapses to `awaiting-tap`. A successful `drainOnGesture()` resets the
 * affordance to `idle`.
 */
export function markPendingResume(): void {
  // Refresh the fallback timer regardless of current state so a re-
  // visibility (Marian flips away and back rapidly) gets a fresh window
  // to find a gesture before the affordance flashes.
  clearFallback()
  state.fallbackHandle = state.scheduleOnce(() => {
    state.fallbackHandle = null
    if (state.affordance === 'pending') {
      setAffordance('awaiting-tap')
    }
  }, state.affordanceFallbackMs)

  if (state.affordance === 'idle') {
    setAffordance('pending')
  }
}

/**
 * Whether audio dispatches should be deferred. Read by
 * `playSessionUtterance` and the Hub line player.
 */
export function isPendingResume(): boolean {
  return state.affordance !== 'idle'
}

/**
 * Read the current affordance state. App.tsx subscribes via
 * `subscribePendingResumeGate` and renders the "tap to continue" UI
 * when the value is `'awaiting-tap'`. Inline reads by tests.
 */
export function getPendingResumeAffordanceState(): PendingResumeAffordanceState {
  return state.affordance
}

/**
 * Subscribe to affordance-state transitions. Returns an unsubscribe
 * function. Subscribers are called synchronously inside the dispatch
 * tick that flips the state.
 */
export function subscribePendingResumeGate(
  cb: (state: PendingResumeAffordanceState) => void,
): () => void {
  state.subscribers.add(cb)
  return () => {
    state.subscribers.delete(cb)
  }
}

/**
 * Enqueue a handler to fire on the next gesture-window drain.
 *
 * The queue holds AT MOST ONE entry. Pushing while a prior handler is
 * queued discards the prior — the iPad capture showed Marian's most-
 * recent screen state is the only thing she expects to hear when she
 * comes back, and replaying the stack of every queued line that fired
 * during the absent window would be confusing (and is exactly the
 * "Hub welcome bleeds into Math" cross-screen leak Thomas heard).
 *
 * No-op when the gate isn't pending — callers should `if
 * (isPendingResume()) enqueueOnResume(...)` else play directly. We
 * still tolerate stray pushes (the rare race where the gate clears
 * between the caller's check and this push) by silently dropping them.
 */
export function enqueueOnResume(handler: QueuedHandler): void {
  if (state.affordance === 'idle') return
  // Replace any prior handler — most-recent-only semantics.
  state.queue = [handler]
}

/**
 * Drain the queued handler INSIDE the user-gesture's synchronous tick.
 * Callers pass the resume + unlock fns so this module stays decoupled
 * from `howlerContext.ts`. Production callers pass the real helpers;
 * tests inject stubs.
 *
 * Idle-gate fast path
 * -------------------
 * When the gate is `'idle'` (no recent visibility-recovery mark),
 * this is a NO-OP — we do NOT call resume or unlock. The chip-tap
 * handler that calls drainOnGesture already runs the unconditional
 * Phase-2/5 resume + unlock as belt-and-suspenders against every
 * gesture (the iOS contract that predates this gate). Doubling the
 * call here would just create per-tap test friction without
 * functional benefit. Drainage only triggers the recovery path when
 * the visibility-mark says it's needed.
 *
 * Order-of-operations rationale (when gate is pending):
 *   1. `resumeFn()` first — kicks `Howler.ctx.resume()` synchronously
 *      against the gesture activation. iOS associates the resume with
 *      the gesture's task.
 *   2. `unlockFn()` next — plays the 1-sample silent buffer to re-
 *      engage the OS audio session. Order matters: the silent buffer
 *      cannot start on a `'closed'` ctx, and the resume's job is to
 *      transition out of `'suspended'`/`'interrupted'`.
 *   3. Drain queue — the queued handler runs synchronously after the
 *      resume + unlock, still inside the gesture's tick.
 *   4. Clear pending flag + cancel fallback timer.
 *
 * Returns whether a queued handler was found and run — callers (the
 * chip-tap path) use this to decide whether the gesture has been
 * "consumed" by the recovery (the chip's normal answer-handling stays
 * gated behind `audioUnlocked`-style flags either way; this just lets
 * the caller log the recovery cleanly).
 */
export function drainOnGesture(
  resumeFn: () => void,
  unlockFn: () => void,
): { drainedHandlerCount: number } {
  // Idle fast-path: nothing to do. Caller's normal Phase-2/5 pipeline
  // handles the no-recovery-needed case.
  if (state.affordance === 'idle') {
    return { drainedHandlerCount: 0 }
  }

  try {
    resumeFn()
  } catch {
    // best-effort
  }
  try {
    unlockFn()
  } catch {
    // best-effort
  }

  const handlers = state.queue
  state.queue = []

  for (const h of handlers) {
    try {
      h.run()
    } catch {
      // Handler errors must not abort the gate clear — the gate
      // existing after a failed drain would just brick subsequent
      // playback. Swallow and continue.
    }
  }

  clearFallback()
  setAffordance('idle')

  return { drainedHandlerCount: handlers.length }
}

/**
 * Force-clear the gate — used by tests and by route-change cleanup
 * (when navigating away from a screen we want any queued play for that
 * screen discarded so it can't bleed into the next screen's audio
 * window). Drops queued handlers without running them.
 */
export function cancelPendingResume(): void {
  state.queue = []
  clearFallback()
  setAffordance('idle')
}

/**
 * Test reset. Resets all internal state to defaults and clears
 * subscribers. Production never calls this.
 */
export function _resetPendingResumeGateForTests(): void {
  clearFallback()
  state.affordance = 'idle'
  state.queue = []
  state.scheduleOnce = defaultScheduleOnce
  state.cancelScheduleOnce = defaultCancelScheduleOnce
  state.affordanceFallbackMs = DEFAULT_AFFORDANCE_FALLBACK_MS
  state.subscribers = new Set()
}
