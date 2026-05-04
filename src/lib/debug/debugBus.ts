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
 * Pending-resume gate state values, as surfaced to the audioCtxLog. This
 * is a SEPARATE state machine from `GateStateName` (which tracks the
 * older `useAudioUnlockGate` first-tap unlock flow). Mirroring it into
 * the log under its own field keeps Thomas's iPad paste-back unambiguous
 * — the older `gateState` and the new `pendingResumeGateState` carry
 * different semantics and should not collide.
 *
 * Values:
 *   - `'idle'` — no iOS audio-session preempt pending; dispatches play
 *     normally.
 *   - `'pending-resume'` — `useHowlerSuspendOnHide` saw `'suspended'` /
 *     `'interrupted'` on the visible edge and marked the gate. Audio
 *     dispatches are queued; the next user gesture's `drainOnGesture`
 *     will run resume + unlock + drain. This is the load-bearing
 *     diagnostic for ticket 86c9kxtmu — its presence in an iPad capture
 *     proves the gate fired on the recovery edge.
 *   - `'awaiting-tap'` — the fallback timer elapsed without a gesture
 *     and the affordance is now showing.
 */
export type PendingResumeGateStateName =
  | 'idle'
  | 'pending-resume'
  | 'awaiting-tap'

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
     * Diagnostic instrumentation pass (ticket 86c9hjnn8 follow-up). All
     * fields below land in the same audioCtxLog timeline so a single
     * paste-back tells us whether the bundle Thomas loaded matches the
     * deployed commit AND where the audio-readiness chain breaks.
     */
    /**
     * `bundle-init` — emitted exactly once on App mount. Carries
     * `cacheVersion`, `storeName`, `idbSchemaVersion`, `commitSha`,
     * `serviceWorkerScriptUrl`. The load-bearing line for tomorrow's
     * iPad QA: if Thomas's export shows a stale `commitSha` he's
     * looking at a cached service-worker bundle, not the new code.
     */
    | 'bundle-init'
    /**
     * `audio-ready-state` — emitted from Math/WordSong when the
     * `audioReady` prop changes. Carries `audioReadyValue` (boolean
     * or 'undefined'). Lets us see if the parent's gate ever flipped
     * to `true` for the screen the user actually sat on.
     */
    | 'audio-ready-state'
    /**
     * `pathA-resolve` / `pathA-reject` — emitted from App.tsx's
     * `prepareMathPathA` / `prepareWordSongPathA` settle handlers.
     * Distinguishes "fetch finished, real player wired" from "fetch
     * failed, silent fallback path". `pathA-reject` carries
     * `errorMessage`; both carry `pathAScreen` ('math' | 'wordSong').
     */
    | 'pathA-resolve'
    | 'pathA-reject'
    /**
     * `play-utterance-dispatch` — emitted from Math/WordSong's `speak`
     * helper when it's about to call `playUtterance`. Carries
     * `playerKind: 'real' | 'silent-fallback'` so the timeline shows
     * whether the screen reached into the wired Path A player or the
     * default 165-wpm captioner. Pair with `howl-play-call` for the
     * full chain.
     */
    | 'play-utterance-dispatch'
    /**
     * `howl-play-call` — emitted from `sessionAudio.ts` when
     * `Howl.play()` is invoked. Carries truncated `howlSrc` (first 80
     * chars of `_src`), `howlState` (Howler's `_state` string), and
     * `howlDuration` (seconds, from `duration()`).
     */
    | 'howl-play-call'
    /**
     * `howl-play-event` — Howler's `play` event fired for the howl we
     * just dispatched. Carries `dtFromCallMs` (delta from the
     * preceding `howl-play-call` for the same utterance). The
     * definitive "audio actually started" signal.
     */
    | 'howl-play-event'
    /**
     * `howl-end-event` — Howler's `end` event fired. Carries
     * `dtFromCallMs`. If `howl-play-event` lands but `howl-end-event`
     * never lands, the audio started but stopped early.
     */
    | 'howl-end-event'
    /**
     * `howl-loaderror-event` — Howler's `loaderror` event fired. The
     * load-bearing failure mode for "Howl exists but never plays
     * because it could not decode the blob". Carries `errorMessage`.
     */
    | 'howl-loaderror-event'
    /**
     * Visibility-transition probe rows (ticket 86c9kxtmu round 2 — iPad
     * PWA WebAudio interruption diagnostic).
     *
     * Two pairs of rows bracket the suspend/resume calls in
     * `useHowlerSuspendOnHide`:
     *
     *   - `'visibility-hidden-pre'` — captured the instant `visibilitychange`
     *     fires with `document.visibilityState === 'hidden'`, BEFORE the
     *     hook calls `Howler.ctx.suspend()`. The `ctxState` field is the
     *     state iOS handed us at hide time.
     *   - `'visibility-hidden-post'` — captured immediately AFTER the
     *     hook's `suspend()` invocation. Same row shape; the state shows
     *     whether suspend transitioned the context synchronously.
     *   - `'visibility-visible-pre'` — captured on the hidden→visible
     *     transition BEFORE `resume()`. The diagnostic question:
     *     does iPad return `ctxState === 'interrupted'` here? The
     *     hypothesis (PR #137 round 2) is yes; that's the iOS-only
     *     recovery path.
     *   - `'visibility-visible-post'` — AFTER `resume()`. If the state
     *     stayed `'interrupted'`, plain `resume()` did not recover and the
     *     unlock-buffer path was needed.
     *
     * All four rows omit Howler-specific extras; the `ctxState` and the
     * implicit timestamp delta are the load-bearing diagnostic.
     */
    | 'visibility-hidden-pre'
    | 'visibility-hidden-post'
    | 'visibility-visible-pre'
    | 'visibility-visible-post'
    /**
     * `'visibility-recovery-buffer'` — emitted from `useHowlerSuspendOnHide`
     * when the post-resume state is still `'interrupted'` and the
     * silent-buffer recovery kick fires. Carries the result of the kick
     * via `bufferStarted` (whether `createBufferSource().start()` was
     * called without throwing). The diagnostic question: did we reach
     * the recovery path at all?
     */
    | 'visibility-recovery-buffer'
    /**
     * `'onplay-watchdog-missed'` — emitted from `playSessionUtterance` when
     * the watchdog deadline (default 800 ms) elapses without Howler
     * firing the `play` event for the most recent `howl.play()` call.
     * The pre-existing `howl-play-event` row is the positive signal; this
     * row is the negative signal. Carries `utteranceId` to pair with the
     * preceding `howl-play-call` row. iPad PWA WebAudio interruption
     * (ticket 86c9kxtmu round 2) is the dominant cause: `play()` returns
     * a sound id but the `'play'` event never fires.
     */
    | 'onplay-watchdog-missed'
  /**
   * Optional companion: the audio-unlock-gate state at the same instant.
   * The gate already pushes its state to the bus on every transition;
   * this field mirrors the most-recent value into each ctx-event record
   * so a single localStorage paste-back tells us both the audio-context
   * timeline AND the gate timeline aligned by timestamp.
   */
  gateState?: GateStateName
  /**
   * Pending-resume gate state at the same instant. Mirrored from the
   * pendingResumeGate via `recordPendingResumeGateState`. Separate field
   * from `gateState` (the older audio-unlock gate) so an iPad export
   * shows both timelines without confusion.
   *
   * Load-bearing diagnostic for ticket 86c9kxtmu (PR #137 round 4):
   * presence of `pendingResumeGateState: 'pending-resume'` rows on the
   * `'visibility-visible-post'` / `'visibility-recovery-buffer'` causes
   * proves the gate flipped on the recovery edge. Round-3 emitted the
   * recovery-buffer row (`bufferStarted: false`) but did not surface
   * the new gate's state — Thomas's 2026-05-03 capture had no way to
   * confirm the gate flipped.
   */
  pendingResumeGateState?: PendingResumeGateStateName
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
   * the Greet line key (`'hi'`, `'imEmma'`, `'niceToMeet'`,
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
  /**
   * For `cause === 'bundle-init'` rows (ticket 86c9hjnn8 follow-up):
   * sessionAudio CACHE_VERSION constant. Mirrored into the log so a
   * stale-bundle screenshot is one-shot diagnosable.
   */
  cacheVersion?: number
  /**
   * For `cause === 'bundle-init'` rows: sessionAudio STORE_NAME string
   * (e.g. `'session-audio-v2'`).
   */
  storeName?: string
  /**
   * For `cause === 'bundle-init'` rows: the IndexedDB schema version
   * actually opened (read post-onsuccess). `null` when IndexedDB is
   * unavailable / the open failed; `undefined` when the probe didn't
   * try to read the DB version (e.g. running outside a browser).
   */
  idbSchemaVersion?: number | null
  /**
   * For `cause === 'bundle-init'` rows: the bundle's commit SHA injected
   * at build time via `vite.config.ts`. `'unknown'` when the env var
   * wasn't set during the build (local dev, Vercel preview without
   * `VITE_COMMIT_SHA`). The point is mismatch detection, not pretty
   * formatting.
   */
  commitSha?: string
  /**
   * For `cause === 'bundle-init'` rows: the service worker's
   * `registration.active.scriptURL` — proves we're running from the
   * registered SW (and tells us which version path it served). `null`
   * when no SW is active (dev mode, unsupported browser).
   */
  serviceWorkerScriptUrl?: string | null
  /**
   * For `cause === 'audio-ready-state'` rows: the new value of the
   * `audioReady` prop on Math or WordSong. We capture `'undefined'`
   * explicitly (instead of dropping the field) so we can tell apart
   * "not yet observed" from "observed as false".
   */
  audioReadyValue?: 'true' | 'false' | 'undefined'
  /**
   * For `cause === 'audio-ready-state'` and `cause === 'pathA-resolve'`
   * / `'pathA-reject'`: which screen the event is for.
   */
  pathAScreen?: 'math' | 'wordSong'
  /**
   * For `cause === 'play-utterance-dispatch'` rows: whether the
   * function reference Math/WordSong invoked is the real Path A
   * player (tagged with `playerKind = 'real'` by `mathPathA.ts` /
   * `wordSongPathA.ts`) or the in-screen `defaultPlayUtterance`
   * silent fallback.
   */
  playerKind?: 'real' | 'silent-fallback'
  /**
   * For `cause === 'howl-play-call'` rows: the Howl's `_src` truncated
   * to the first 80 chars. Truncation avoids 4 KB blob-URL strings
   * blowing the localStorage budget.
   */
  howlSrc?: string
  /**
   * For `cause === 'howl-play-call'` rows: the Howl's internal
   * `_state` ('unloaded' | 'loading' | 'loaded'). If a `howl-play-call`
   * row carries `'unloaded'` and never gets a paired `howl-play-event`,
   * the howl never decoded.
   */
  howlState?: 'unloaded' | 'loading' | 'loaded' | 'unknown'
  /**
   * For `cause === 'howl-play-call'` rows: `howl.duration()` in
   * seconds. `0` means Howler couldn't read a duration — the screen
   * falls back to 165-wpm caption pacing in that case.
   */
  howlDuration?: number
  /**
   * For `cause === 'howl-play-event'`, `'howl-end-event'`,
   * `'howl-loaderror-event'`: ms delta from the matching
   * `howl-play-call` for the same utterance id.
   */
  dtFromCallMs?: number
  /**
   * For `cause === 'howl-play-call'` and the `howl-*-event` family:
   * the utterance id this row pairs to. Lets the export pair calls
   * with their event responses across interleaved rows.
   */
  utteranceId?: string
  /**
   * For `cause === 'visibility-recovery-buffer'` rows (ticket
   * 86c9kxtmu round 2): whether the silent-buffer kick actually called
   * `createBufferSource().start()` without throwing. `false` means the
   * recovery attempt itself failed (rare — closed/unavailable ctx).
   */
  bufferStarted?: boolean
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
   * Pending-resume gate state — separate machine from `gateState`, see
   * `PendingResumeGateStateName` for full semantics. `null` when the
   * gate hasn't reported yet (Hub-only sessions before the first
   * background event).
   */
  pendingResumeGateState: PendingResumeGateStateName | null
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
  pendingResumeGateState: null,
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
    pendingResumeGateState: state.pendingResumeGateState,
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
 * Called from audio playback call sites. The bus replaces lastSpeak entirely so the
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
 * Record the pending-resume gate's current value. Wired from
 * `pendingResumeGate` (PR #137 round 4 — ticket 86c9kxtmu). The gate
 * pushes its state to this bus on every transition; the audio-context
 * probe mirrors `readPendingResumeGateState()` into every emitted
 * `AudioCtxEventRecord` under the `pendingResumeGateState` field, so a
 * single localStorage paste-back from Thomas's iPad shows whether the
 * gate flipped at the visible-edge of an interruption.
 *
 * Round-3 (PR #137 v3) DID flip the gate to `'pending'` on `'interrupted'`
 * but did not surface that state into the audioCtxLog — Thomas's
 * 2026-05-03 capture showed only the OLD `gateState: "unlocked"` field
 * and there was no way to confirm the new gate had fired. Round-4
 * closes that diagnostic gap.
 */
export function recordPendingResumeGateState(
  pendingResumeGateState: PendingResumeGateStateName,
): void {
  state.pendingResumeGateState = pendingResumeGateState
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
    pendingResumeGateState: state.pendingResumeGateState,
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
  state.pendingResumeGateState = null
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
 * Accessor for the pending-resume gate's current value. Used by the
 * audio-context probe to mirror the new gate's state into every
 * emitted `AudioCtxEventRecord` under the `pendingResumeGateState`
 * field. Returns `null` when the gate hasn't reported yet.
 */
export function readPendingResumeGateState(): PendingResumeGateStateName | null {
  return state.pendingResumeGateState
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
    pendingResumeGateState: state.pendingResumeGateState,
    audioCtxState: state.audioCtxState,
    audioCtxEvents: state.audioCtxEvents.slice(),
  }
}
