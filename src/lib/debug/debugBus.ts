/**
 * Tiny pub/sub for the iPad debug overlay.
 *
 * Why a module-level singleton
 * ----------------------------
 * The overlay is a React component, but the things it observes (TTS speak
 * attempts, gate state, tap events) come from non-React code paths and from
 * components other than the overlay itself. Threading this through context
 * would couple every speak()-call site to a provider; threading via window
 * globals would leak into production. A tiny singleton bus that the overlay
 * subscribes to keeps producers ignorant of the consumer and lets the bus
 * itself be dead code in normal sessions (the recording functions are a
 * couple of property mutations and an event dispatch).
 *
 * Production cost
 * ---------------
 * The overlay only mounts when `?debug=1` is in the URL. Without it, nothing
 * subscribes to the bus, so the only cost is recording functions setting
 * fields on a small object and conditionally dispatching an event when there
 * are no listeners. That's a couple of nanoseconds per speak() — well under
 * the noise floor.
 */

export type SpeakStatus = 'queued' | 'started' | 'ended' | 'errored'

export interface SpeakAttemptRecord {
  text: string
  /** ms since epoch — set fresh on each new attempt. */
  timestamp: number
  /** Latest status of this attempt. Updates in place. */
  status: SpeakStatus
  /** Error message if status === 'errored'. */
  error?: string
}

export type TapEventType = 'click' | 'touchend' | 'pointerdown'

export interface TapEventRecord {
  type: TapEventType
  /** ms since epoch. */
  timestamp: number
  /** Which testid (or other label) the tap landed on. */
  target: string
}

/**
 * Native-DOM raw event types we shadow-record on the wake-tap target.
 *
 * "Raw" means the event was observed via `addEventListener` directly on the
 * DOM node, BEFORE React's synthetic-event system gets a crack at it. Used
 * to distinguish "iPad isn't delivering events to this element" from
 * "events arrive but React's onClick/onTouchEnd binding doesn't catch them"
 * — see DebugOverlay raw-events line.
 */
export type RawTapEventType =
  | 'touchstart'
  | 'touchend'
  | 'pointerdown'
  | 'click'

export interface RawTapEventRecord {
  type: RawTapEventType
  /** ms since epoch. */
  timestamp: number
  /** Which testid (or other label) the event landed on. */
  target: string
}

export type GateStateName = 'idle' | 'pending' | 'unlocked' | 'relock'

/**
 * Possible AudioContext states. Mirrors the W3C Web Audio spec values plus
 * `'interrupted'` — a non-standard but documented WebKit/iOS-only value
 * that surfaces when the audio session is preempted (phone call, Siri, or
 * the iOS audio-session idle decay we're hunting in ticket 86c9gvd0y).
 *
 * `'unavailable'` is our own marker for "no AudioContext exists yet" —
 * before any Howler.play() unlocks the engine, `Howler.ctx` may not have
 * been instantiated.
 */
export type AudioCtxState =
  | 'suspended'
  | 'running'
  | 'closed'
  | 'interrupted'
  | 'unavailable'

/**
 * One sample of `Howler.ctx.state` (or fallback observation). Recorded
 * either by the 1Hz polling tick during the warm-up window, by a
 * `statechange` event firing on the AudioContext, synchronously inside
 * a tap handler, or by a tap-handler instrumentation call (speak-call /
 * speak-skipped / handler-error). The `cause` field tells us which.
 *
 * Phase-3 (ticket 86c9gvd0y) extended causes
 * ------------------------------------------
 * The Phase-2 fix (`resumeHowlerContextOnGesture`) verified the audio
 * context resumes correctly on tap, but Thomas's iPad still reproduced
 * the bug — which means the failure is downstream of the audio-context
 * layer (gate, handler, or Howler `play()`-to-`onplay` chain). These
 * causes mirror those layers into the same log so the next iPad export
 * shows where the chain breaks:
 *
 *   - `'speak-call'` — `Howl.play()` returned synchronously. Carries
 *     `speakResult` (the Howler sound id, or null/undefined when play
 *     threw or the howl wasn't there) and optionally `lineKey` (the
 *     Greet line key) for cross-referencing.
 *   - `'speak-onplay'` — Howler emitted the `'play'` event. Carries
 *     `lineKey` to pair with the matching `speak-call` row. If
 *     `'speak-call'` rows appear but `'speak-onplay'` rows don't, the
 *     bug is the Howler-on-iOS play-to-onplay stall.
 *   - `'speak-skipped'` — the wake-tap handler entered but didn't reach
 *     `speak()`. Carries `skipReason` from the handler's early-return
 *     (e.g. `'in-flight-guard'`, `'gate-not-relock'`,
 *     `'screen-not-wake-no-retry'`). `skipReason` is RESERVED for
 *     speak-skipped rows — speak-call/speak-onplay rows use `lineKey`.
 *   - `'handler-error'` — the wake-tap handler body threw. Carries
 *     `errorMessage` from the caught error. The error is re-thrown by
 *     the caller after recording — production behaviour is unchanged.
 */
export interface AudioCtxEventRecord {
  /** ms since epoch. */
  timestamp: number
  /** AudioContext.state at the moment this sample was taken. */
  ctxState: AudioCtxState
  /** Why this sample was taken — disambiguates poll noise from real events. */
  cause:
    | 'poll'
    | 'statechange'
    | 'tap'
    | 'init'
    | 'speak-call'
    | 'speak-onplay'
    | 'speak-skipped'
    | 'handler-error'
    | 'unlock-state'
  /**
   * Optional companion: speechSynthesis.paused at the same instant.
   * Useful because Web Speech and Web Audio share an audio session on
   * iOS — if both flip together, that's the audio-session interruption
   * fingerprint.
   */
  synthPaused?: boolean
  /**
   * Optional companion: the audio-unlock-gate state at the same instant.
   * The gate already pushes its state to the bus on every transition;
   * this field mirrors the most-recent value into each ctx-event record
   * so a single localStorage paste-back tells us both the audio-context
   * timeline AND the gate timeline aligned by timestamp.
   */
  gateState?: GateStateName
  /**
   * For `cause === 'speak-call'` rows: the synchronous return value of
   * `Howl.play()`. Howler returns a numeric sound id on success; we
   * record `null` when play() threw or there was no Howl to play.
   * Undefined for non-speak-call rows.
   */
  speakResult?: number | null
  /**
   * For `cause === 'speak-skipped'` rows ONLY: a short tag describing
   * why the handler short-circuited (e.g. `'in-flight-guard'`,
   * `'gate-not-relock'`). RESERVED for speak-skipped — speak-call and
   * speak-onplay rows use `lineKey` instead, so a paste-back search for
   * `skipReason: …` only matches genuine handler skips.
   *
   * Phase-4 cleanup (ticket 86c9gvd0y): pre-Phase-4 emit code reused
   * this field on speak-call/speak-onplay rows to carry the line text
   * — confusing in iPad exports because it looked like the handler
   * had skipped.
   */
  skipReason?: string
  /**
   * For `cause === 'speak-call'` and `cause === 'speak-onplay'` rows:
   * the Greet line key (`'hi'`, `'imMelody'`, `'niceToMeet'`,
   * `'tapHeart'`) — or any other short identifier the producer wants
   * to pair speak-call ↔ speak-onplay rows by. Phase-4 (ticket
   * 86c9gvd0y) split this out from `skipReason` so the two diagnostics
   * don't share a field.
   */
  lineKey?: string
  /** For `cause === 'handler-error'` rows: the caught error's message. */
  errorMessage?: string
  /**
   * For `cause === 'unlock-state'` rows (Phase-5, ticket 86c9gvd0y): the
   * `Howler._audioUnlocked` flag. Howler flips this to `true` exactly
   * once on the first user gesture, then short-circuits its own internal
   * unlock pathway forever after — even though iOS releases the OS-level
   * audio session every long-idle window. If we see `true` here while
   * `'speak-onplay'` rows fail to fire, the canonical iOS audio-session
   * decay is the culprit (independent of WebAudio's `AudioContext.state`).
   */
  howlerAudioUnlocked?: boolean
  /**
   * For `cause === 'unlock-state'` rows (Phase-5, ticket 86c9gvd0y):
   * `Howler._html5AudioPool.length`. Captured because Howler's HTML5
   * pool flag (`_unlocked` on each Audio node) is independent of
   * `_audioUnlocked` (the Web Audio flag); a divergence between the two
   * is part of the diagnostic surface. We record the pool length as a
   * cheap proxy for "did Howler ever populate its HTML5 pool" — empty
   * pool means the gesture-unlock never ran past line 348 in howler.js.
   */
  howlerHtml5PoolSize?: number
  /**
   * For `cause === 'unlock-state'` rows (Phase-5, ticket 86c9gvd0y):
   * `Howler._scratchBuffer != null`. True after the first call to
   * `_unlockAudio` constructed the scratch buffer (line 322 in howler.js)
   * — diagnostic for "did Howler enter its unlock pathway at all".
   */
  howlerHasScratchBuffer?: boolean
  /**
   * For `cause === 'unlock-state'` rows (Phase-8, ticket 86c9gvd0y):
   * `Howler.state` — the Howler-internal state machine value (NOT the
   * WebAudio `AudioContext.state`). Howler's `_autoSuspend` flips this
   * between `'running'`, `'suspending'`, and `'suspended'` independently
   * of `ctx.state`. Exact symptom of the Phase-8 root cause: this is
   * `'suspended'` at the moment of a failing tap, while `ctxState` reads
   * `'running'`. After the Phase-8 fix (`autoSuspend = false`) this should
   * stay `'running'` for the entire session.
   */
  howlerState?: 'running' | 'suspending' | 'suspended' | 'unavailable'
  /**
   * For `cause === 'unlock-state'` rows (Phase-8, ticket 86c9gvd0y):
   * `Howler.autoSuspend`. Should be `false` after the Phase-8 boot-time
   * `disableHowlerAutoSuspend()` call. If we ever see `true` in an iPad
   * export, the boot-time disable did not land — most likely cause is a
   * test-mode or hot-reload race where the boot effect didn't run.
   */
  howlerAutoSuspend?: boolean
  /**
   * For `cause === 'unlock-state'` rows (Phase-8, ticket 86c9gvd0y):
   * outcome of invoking `Howler._unlockAudio()` from inside the gesture
   * window. Mirrors the same-named field on
   * `UnlockIosAudioSessionResult`. Captures whether the Howler-internal
   * unlock method was reachable / called / threw at the moment of the
   * gesture — diagnostic-only; Phase-5/6 fallbacks remain authoritative
   * for the iOS contract.
   */
  howlerUnlockMethodCalled?: 'called' | 'missing' | 'threw'
}

export interface DebugSnapshot {
  lastSpeak: SpeakAttemptRecord | null
  recentTaps: TapEventRecord[]
  /**
   * Raw DOM events on the wake-tap target, captured via addEventListener
   * BEFORE React's onClick/onTouchEnd handlers run. If `recentTaps` stays
   * empty but `recentRawEvents` populates, the bug is in the React event
   * binding layer (or our handler logic) — not in iPad's hit-testing.
   * If both stay empty, iPad isn't delivering events to the element at all
   * (CSS hit-testing / overlapping element capturing the tap).
   */
  recentRawEvents: RawTapEventRecord[]
  gateState: GateStateName | null
  /**
   * Most-recently-observed AudioContext.state. Updated on every poll tick,
   * statechange event, or tap. `null` when no probe is running (debug
   * disabled, or before the first tick).
   */
  audioCtxState: AudioCtxState | null
  /**
   * Rolling log of AudioContext samples — one per poll, statechange, or
   * tap. Used by Phase-1 instrumentation (ticket 86c9gvd0y) to confirm or
   * deny the iOS audio-session decay hypothesis: does iOS fire a
   * statechange to `interrupted` / `suspended` at the ~30s idle mark?
   */
  audioCtxEvents: AudioCtxEventRecord[]
}

const MAX_TAPS = 5
const MAX_RAW_EVENTS = 8
/**
 * Audio-context event buffer size. Sized to fit the Phase-1 capture
 * window: 90s of 1Hz polling = 90 samples, plus a handful of statechange
 * and tap samples. 128 gives headroom; the overlay only renders the last
 * few entries but the full buffer is mirrored to localStorage by the
 * probe so Thomas can paste the timeline back.
 */
const MAX_AUDIO_CTX_EVENTS = 128

const state: DebugSnapshot = {
  lastSpeak: null,
  recentTaps: [],
  recentRawEvents: [],
  gateState: null,
  audioCtxState: null,
  audioCtxEvents: [],
}

type Listener = (snapshot: DebugSnapshot) => void
const listeners = new Set<Listener>()

function notify(): void {
  // Copy the snapshot before handing it out so listeners can store it without
  // worrying about mutation between renders. recentTaps gets a shallow copy;
  // lastSpeak is replaced (not mutated in place) on each call so shallow is
  // safe there too.
  const snapshot: DebugSnapshot = {
    lastSpeak: state.lastSpeak,
    recentTaps: state.recentTaps.slice(),
    recentRawEvents: state.recentRawEvents.slice(),
    gateState: state.gateState,
    audioCtxState: state.audioCtxState,
    audioCtxEvents: state.audioCtxEvents.slice(),
  }
  for (const listener of listeners) {
    try {
      listener(snapshot)
    } catch {
      // A misbehaving overlay listener must not break TTS or tap handlers.
    }
  }
}

function nowMs(): number {
  // Date.now() over performance.now() because we display absolute times in
  // the overlay and the user-visible wall clock is what matters for matching
  // a console screenshot to a video recording.
  return Date.now()
}

/**
 * Record the start of a speak() attempt OR a terminal status (errored).
 * Called from `lib/tts/tts.ts`. The bus replaces lastSpeak entirely so the
 * overlay always shows the most recent call.
 */
export function recordSpeakAttempt(
  text: string,
  status: SpeakStatus,
  error?: string,
): void {
  state.lastSpeak = {
    text,
    timestamp: nowMs(),
    status,
    error,
  }
  notify()
}

/**
 * Update the status of the in-flight attempt. Used for `started` / `ended` /
 * `errored` transitions after the initial `queued`. If there's no current
 * attempt to update, this is a no-op (keeps the overlay's view sane after a
 * page navigation that drops state).
 */
export function recordSpeakStatus(status: SpeakStatus, error?: string): void {
  if (!state.lastSpeak) return
  state.lastSpeak = {
    ...state.lastSpeak,
    status,
    error: error ?? state.lastSpeak.error,
  }
  notify()
}

/**
 * Record a tap. Keeps the most-recent MAX_TAPS, oldest first. Called from
 * components that bind tap handlers (Greet's wake-tap target).
 */
export function recordTap(type: TapEventType, target: string): void {
  state.recentTaps = [
    ...state.recentTaps.slice(-MAX_TAPS + 1),
    { type, timestamp: nowMs(), target },
  ]
  notify()
}

/**
 * Record a raw DOM event observed via `addEventListener` BEFORE React's
 * synthetic-event system runs. Diagnostic-only — used by Greet's wake-tap
 * target to expose whether iPad Safari is delivering pointer/touch events
 * to the element at all. Filtered separately from `recentTaps` (which only
 * fire from React handlers) so we can tell apart "events arrive, React
 * handler doesn't fire" from "events never reach the element".
 */
export function recordRawTapEvent(type: RawTapEventType, target: string): void {
  state.recentRawEvents = [
    ...state.recentRawEvents.slice(-MAX_RAW_EVENTS + 1),
    { type, timestamp: nowMs(), target },
  ]
  notify()
}

/**
 * Record the audio-unlock-gate state machine's current value. Wired from
 * `useAudioUnlockGate` via a useEffect.
 */
export function recordGateState(gateState: GateStateName): void {
  state.gateState = gateState
  notify()
}

/**
 * Record one observation of the AudioContext's state. Called by the
 * Phase-1 audio-context probe (`audioContextProbe.ts`) on its 1Hz poll
 * tick, on `statechange` events, and synchronously inside tap handlers.
 *
 * The buffer is bounded — older samples are dropped when full. The
 * probe additionally mirrors all samples to localStorage so Thomas can
 * paste back a full timeline even after a reload.
 */
export function recordAudioCtxEvent(record: AudioCtxEventRecord): void {
  state.audioCtxState = record.ctxState
  state.audioCtxEvents = [
    ...state.audioCtxEvents.slice(-MAX_AUDIO_CTX_EVENTS + 1),
    record,
  ]
  notify()
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  // Push the current snapshot once so the listener has something to render
  // before the next event fires.
  listener({
    lastSpeak: state.lastSpeak,
    recentTaps: state.recentTaps.slice(),
    recentRawEvents: state.recentRawEvents.slice(),
    gateState: state.gateState,
    audioCtxState: state.audioCtxState,
    audioCtxEvents: state.audioCtxEvents.slice(),
  })
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Test-only reset. Production code never calls this, but tests need to start
 * each case from a clean bus.
 */
export function _resetForTests(): void {
  state.lastSpeak = null
  state.recentTaps = []
  state.recentRawEvents = []
  state.gateState = null
  state.audioCtxState = null
  state.audioCtxEvents = []
  listeners.clear()
}

/**
 * Accessor for the latest gate-state value. Used by the audio-context
 * probe (`audioContextProbe.ts`) to attach the current gate state to
 * every emitted `AudioCtxEventRecord` — keeps the gate timeline aligned
 * to the audio-context timeline in a single localStorage paste-back.
 *
 * Returns `null` when no gate has reported yet (component unmounted, or
 * before first state push). The value is read fresh on every call; no
 * snapshot copy required because this is a single primitive.
 */
export function readGateState(): GateStateName | null {
  return state.gateState
}

/**
 * Snapshot accessor for tests / one-off reads. Production code should
 * subscribe instead.
 */
export function snapshot(): DebugSnapshot {
  return {
    lastSpeak: state.lastSpeak,
    recentTaps: state.recentTaps.slice(),
    recentRawEvents: state.recentRawEvents.slice(),
    gateState: state.gateState,
    audioCtxState: state.audioCtxState,
    audioCtxEvents: state.audioCtxEvents.slice(),
  }
}
