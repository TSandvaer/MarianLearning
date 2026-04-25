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
}

const MAX_TAPS = 5
const MAX_RAW_EVENTS = 8

const state: DebugSnapshot = {
  lastSpeak: null,
  recentTaps: [],
  recentRawEvents: [],
  gateState: null,
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

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  // Push the current snapshot once so the listener has something to render
  // before the next event fires.
  listener({
    lastSpeak: state.lastSpeak,
    recentTaps: state.recentTaps.slice(),
    recentRawEvents: state.recentRawEvents.slice(),
    gateState: state.gateState,
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
  listeners.clear()
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
  }
}
