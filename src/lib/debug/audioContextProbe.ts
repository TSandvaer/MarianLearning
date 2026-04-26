/**
 * Audio-context probe (Phase 1 instrumentation, ticket 86c9gvd0y).
 *
 * Why this exists
 * ---------------
 * Thomas reproduced a P1 bug on iPad PWA: leave Greet idle for >30s, then
 * tap. Tap arrives at the React handler (`recordTap` fires in the debug
 * bus, raw events fire too) but no audio plays — Marian sees a brick.
 * The strong hypothesis is iOS Safari's audio-session interruption:
 * `Howler.ctx.state` flips from `running` → `interrupted` (or
 * `suspended`) after an idle window and silently rejects new playback
 * until the context is re-resumed inside a fresh user gesture.
 *
 * Phase-1 hard rule (from Thomas, with reference to PR #28's wasted
 * 3-hour fix-guessing session): instrument FIRST, fix SECOND. This
 * module is debug-only, behavior-neutral. It observes; it never resumes,
 * unlocks, or mutates the audio context.
 *
 * What it captures
 * ----------------
 * 1. **1 Hz poll for the first 90 seconds** after the probe starts. Each
 *    tick reads `Howler.ctx.state` and records it via `recordAudioCtxEvent`.
 *    This gives Thomas a timeline showing *when* the state transition
 *    happens — confirming or denying the ~30s threshold.
 *
 * 2. **`statechange` event listener** on `Howler.ctx`. WebKit fires this
 *    when iOS preempts or restores the audio session. If we see a
 *    statechange exactly at the idle threshold, the hypothesis is
 *    confirmed. If no statechange fires but state appears different on
 *    next tap, the hypothesis is wrong and we have a different bug.
 *
 * 3. **Tap-time samples.** When Greet's wake-tap target receives a tap,
 *    the probe records the AudioContext state at that exact moment. This
 *    is the load-bearing diagnostic: a tap at t=45s that comes back as
 *    `state: 'suspended'` directly proves the failure mode.
 *
 * 4. **localStorage mirror.** Every recorded sample is appended to a
 *    rolling JSON log under a fixed key. Thomas can copy-paste this log
 *    out of the iPad even if the on-screen overlay is too small to see
 *    full history. The log is capped at MAX_LOG_ENTRIES to avoid filling
 *    iPad localStorage.
 *
 * What it does NOT do
 * -------------------
 * - It does not call `audioContext.resume()`. Resuming would mask the
 *   bug we're trying to characterize.
 * - It does not unlock or warm the context. The whole point is to watch
 *   what iOS does when nothing is touched.
 * - It does not run unless `?debug=1` is on. Production sessions pay
 *   nothing — no listener, no poll, no localStorage write.
 * - It does not manage a Howler instance lifecycle. Howler creates its
 *   own AudioContext lazily on first playback in production (and on
 *   probe-start on the debug build, see below). We attach to whatever
 *   context Howler exposes.
 *
 * Probe lifecycle
 * ---------------
 * The probe is started by `App.tsx` exactly once on mount (debug-only
 * branch). It returns a stop fn but `App` does not call it — the probe
 * outlives the React tree and continues recording across screen
 * navigations. Tests call the stop fn explicitly to clean up.
 *
 * Howler context bootstrapping
 * ----------------------------
 * Howler does not instantiate `Howler.ctx` until something tries to
 * play. So at probe-start, `Howler.ctx` is typically undefined. Two
 * paths:
 *   - Pre-Howler-init: probe records `'unavailable'` until Howler shows
 *     up. Once visible, the probe attaches its statechange listener and
 *     resumes recording real states.
 *   - Post-Howler-init: probe attaches immediately and records the
 *     initial state.
 * The probe re-checks `Howler.ctx` on every poll tick to handle the
 * transition.
 */

import { Howler } from 'howler'
import {
  readGateState,
  recordAudioCtxEvent,
  type AudioCtxEventRecord,
  type AudioCtxState,
} from './debugBus'

/**
 * 1 Hz polling cadence. The 30s threshold is well-resolved at 1 Hz, and
 * 1 Hz keeps localStorage churn modest (one row per second × 90s = 90
 * rows in the warm-up window).
 */
const POLL_INTERVAL_MS = 1000

/**
 * Total polling window. Long enough to span Thomas's stopwatch repro
 * (he hits the 30s threshold and watches it stay dead) plus headroom
 * to confirm the state stays decayed — and short enough that we don't
 * burn battery polling forever after the diagnostic point lands. Polling
 * stops at this mark; statechange + tap recording continue indefinitely.
 */
const POLL_WINDOW_MS = 90_000

/** localStorage key for the persisted sample log. */
const LOG_STORAGE_KEY = 'debug:audioCtxLog:v1'

/**
 * Cap the localStorage log at this many rows. ~256 rows × ~70 bytes/row
 * ≈ 18 KB — well under iPad's ~5 MB localStorage budget but generous
 * enough to capture a multi-minute repro session.
 */
const MAX_LOG_ENTRIES = 256

export interface AudioContextProbeHandle {
  /** Stop polling and detach all listeners. Idempotent. */
  stop: () => void
  /**
   * Synchronously record the current AudioContext state. Called from
   * tap handlers so the sample is captured in the same JS task as the
   * tap. The cause is forced to `'tap'`.
   *
   * Returns the recorded state (or `'unavailable'`) so callers that
   * want to react can do so — but Phase-1 callers MUST NOT take
   * behavioral action on the value.
   */
  sampleNow: (cause?: 'tap' | 'init') => AudioCtxState
  /**
   * Record a `cause: 'speak-call'` row — the synchronous return from
   * `Howl.play()`. `soundId` is the Howler-returned sound id (number),
   * or `null` when play() threw / no Howl was available. The optional
   * `tag` is folded into `skipReason` for cross-referencing (e.g. the
   * Greet line key).
   */
  recordSpeakCall: (soundId: number | null, tag?: string) => void
  /**
   * Record a `cause: 'speak-onplay'` row — Howler emitted the `'play'`
   * event. The optional `tag` carries the Greet line key (or similar).
   *
   * The diagnostic value: if `'speak-call'` rows show up but
   * `'speak-onplay'` rows don't, the bug is the Howler-on-iOS
   * play-to-onplay stall.
   */
  recordSpeakOnPlay: (tag?: string) => void
  /**
   * Record a `cause: 'speak-skipped'` row — the wake-tap handler
   * entered but didn't reach `speak()`. `reason` is a short tag.
   */
  recordSpeakSkipped: (reason: string) => void
  /**
   * Record a `cause: 'handler-error'` row — the wake-tap handler body
   * threw. The error's message is recorded; the caller is expected to
   * re-throw afterwards so production behaviour is unchanged.
   */
  recordHandlerError: (error: unknown) => void
}

export interface AudioContextProbeOptions {
  /**
   * Override Howler. Tests inject a stub; production omits this.
   */
  howlerLike?: { ctx?: AudioContext }
  /**
   * Override `window.speechSynthesis`. Tests inject a stub. The probe
   * reads `synth.paused` to co-record the speech-engine state alongside
   * the audio-context state — useful because both share an audio session
   * on iOS, so a co-flip is a strong audio-session-interruption signal.
   */
  speechSynthLike?: { paused: boolean } | null
  /** Test seam — defaults to `window.setInterval`. */
  schedule?: (cb: () => void, ms: number) => unknown
  /** Test seam — defaults to `window.clearInterval`. */
  cancelSchedule?: (handle: unknown) => void
  /** Test seam — defaults to `window.setTimeout`. */
  scheduleOnce?: (cb: () => void, ms: number) => unknown
  /** Test seam — defaults to `window.clearTimeout`. */
  cancelScheduleOnce?: (handle: unknown) => void
  /** Test seam — defaults to `Date.now`. */
  now?: () => number
  /**
   * Test seam — localStorage-shaped storage. Tests inject an in-memory
   * map; production uses `window.localStorage`. When `null`, the probe
   * skips persistence entirely (jsdom or restrictive PWA).
   */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  /** Override poll interval (ms). Tests use a small value. */
  pollIntervalMs?: number
  /** Override poll window total duration (ms). Tests use a small value. */
  pollWindowMs?: number
  /** Override max log entries. Tests use a small value. */
  maxLogEntries?: number
}

interface InternalState {
  pollHandle: unknown
  windowHandle: unknown
  attachedCtx: AudioContext | null
  detachStatechange: (() => void) | null
  stopped: boolean
}

function readSynthPaused(
  synth: { paused: boolean } | null | undefined,
): boolean | undefined {
  if (synth === null) return undefined
  if (synth === undefined) {
    if (typeof window === 'undefined') return undefined
    if (!window.speechSynthesis) return undefined
    try {
      return window.speechSynthesis.paused
    } catch {
      return undefined
    }
  }
  try {
    return synth.paused
  } catch {
    return undefined
  }
}

/**
 * Read whatever Howler exposes as an AudioContext, defensively. Howler's
 * type asserts `ctx: AudioContext` but in practice it can be undefined
 * before the first play(), and it can throw on access in environments
 * where Howler's audio backend failed to initialize.
 */
function readHowlerCtx(override?: { ctx?: AudioContext }): AudioContext | null {
  const target = override ?? (Howler as unknown as { ctx?: AudioContext })
  try {
    const ctx = target.ctx
    if (!ctx) return null
    return ctx
  } catch {
    return null
  }
}

/**
 * Read the AudioContext.state, mapping it onto our `AudioCtxState` enum
 * (which adds the WebKit-specific `'interrupted'` value the standard
 * AudioContextState type doesn't include).
 */
function readCtxState(ctx: AudioContext | null): AudioCtxState {
  if (!ctx) return 'unavailable'
  let raw: string
  try {
    raw = ctx.state as unknown as string
  } catch {
    return 'unavailable'
  }
  switch (raw) {
    case 'running':
    case 'suspended':
    case 'closed':
    case 'interrupted':
      return raw
    default:
      // Unknown values bucket into 'unavailable' so we don't lie in the
      // overlay; the localStorage log preserves the raw cause + timestamp
      // for forensic reading.
      return 'unavailable'
  }
}

/**
 * Append a sample to the localStorage rolling log. Best-effort — quota
 * errors and parse errors are swallowed. The probe never depends on the
 * log being readable, only on the bus being updated; the log is purely
 * for Thomas's after-the-fact paste-back.
 */
function appendToStorage(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  record: AudioCtxEventRecord,
  maxEntries: number,
): void {
  try {
    const existing = storage.getItem(LOG_STORAGE_KEY)
    let log: AudioCtxEventRecord[] = []
    if (existing) {
      try {
        const parsed = JSON.parse(existing) as unknown
        if (Array.isArray(parsed)) {
          log = parsed.filter(
            (entry): entry is AudioCtxEventRecord =>
              typeof entry === 'object' &&
              entry !== null &&
              'timestamp' in entry &&
              'ctxState' in entry &&
              'cause' in entry,
          )
        }
      } catch {
        // Corrupted log — start fresh rather than crash.
        log = []
      }
    }
    log.push(record)
    while (log.length > maxEntries) log.shift()
    storage.setItem(LOG_STORAGE_KEY, JSON.stringify(log))
  } catch {
    // localStorage may be disabled, full, or quota-blocked. Swallow.
  }
}

/**
 * Start the audio-context probe. Returns a handle with `stop()` and
 * `sampleNow()`. Idempotent: calling `start()` twice in a row is fine —
 * each call yields a new handle but they share the same bus + storage.
 *
 * Call from `App.tsx` only when `isDebugEnabled()` returns true.
 */
export function startAudioContextProbe(
  opts: AudioContextProbeOptions = {},
): AudioContextProbeHandle {
  const schedule = opts.schedule ?? ((cb, ms) => window.setInterval(cb, ms))
  const cancelSchedule =
    opts.cancelSchedule ?? ((h) => window.clearInterval(h as number))
  const scheduleOnce =
    opts.scheduleOnce ?? ((cb, ms) => window.setTimeout(cb, ms))
  const cancelScheduleOnce =
    opts.cancelScheduleOnce ?? ((h) => window.clearTimeout(h as number))
  const now = opts.now ?? (() => Date.now())
  // Default to window.localStorage. If it throws on access (Safari
  // private mode, sandboxed iframe), fall back to no storage.
  let storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  if (opts.storage !== undefined) {
    storage = opts.storage
  } else {
    try {
      storage =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage
          : null
    } catch {
      storage = null
    }
  }
  const pollIntervalMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS
  const pollWindowMs = opts.pollWindowMs ?? POLL_WINDOW_MS
  const maxLogEntries = opts.maxLogEntries ?? MAX_LOG_ENTRIES

  const internal: InternalState = {
    pollHandle: null,
    windowHandle: null,
    attachedCtx: null,
    detachStatechange: null,
    stopped: false,
  }

  // Reset the localStorage log on probe start. A fresh probe should
  // begin with a clean timeline so Thomas's paste-back maps to one
  // contiguous capture session (and so the buffer doesn't grow across
  // many reloads). Best-effort — failures are silent.
  if (storage) {
    try {
      storage.removeItem(LOG_STORAGE_KEY)
    } catch {
      // best-effort
    }
  }

  function emit(
    cause: AudioCtxEventRecord['cause'],
    ctx: AudioContext | null,
    extra: Pick<
      AudioCtxEventRecord,
      'speakResult' | 'skipReason' | 'errorMessage'
    > = {},
  ): AudioCtxState {
    const ctxState = readCtxState(ctx)
    const synthPaused = readSynthPaused(opts.speechSynthLike)
    // Phase-3 (ticket 86c9gvd0y): mirror the most-recent gate state into
    // every emit so a single localStorage paste-back tells us both the
    // audio-context timeline AND the gate timeline aligned by timestamp.
    // The gate pushes its state to the bus on every transition; we read
    // the latest value here. `null` when the gate hasn't reported yet —
    // we omit the field rather than write `null` to keep the JSON tight.
    const gateState = readGateState()
    const record: AudioCtxEventRecord = {
      timestamp: now(),
      ctxState,
      cause,
      ...(synthPaused !== undefined ? { synthPaused } : {}),
      ...(gateState !== null ? { gateState } : {}),
      ...(extra.speakResult !== undefined
        ? { speakResult: extra.speakResult }
        : {}),
      ...(extra.skipReason !== undefined
        ? { skipReason: extra.skipReason }
        : {}),
      ...(extra.errorMessage !== undefined
        ? { errorMessage: extra.errorMessage }
        : {}),
    }
    recordAudioCtxEvent(record)
    if (storage) appendToStorage(storage, record, maxLogEntries)
    return ctxState
  }

  function attachStatechange(ctx: AudioContext): void {
    if (internal.attachedCtx === ctx) return
    // Detach any prior listener — the underlying ctx might have been
    // closed and re-created (rare but possible if Howler tears down).
    if (internal.detachStatechange) {
      internal.detachStatechange()
      internal.detachStatechange = null
    }

    const handler = () => {
      if (internal.stopped) return
      emit('statechange', ctx)
    }
    try {
      ctx.addEventListener('statechange', handler)
    } catch {
      // Some test stubs may not implement addEventListener.
      return
    }
    internal.attachedCtx = ctx
    internal.detachStatechange = () => {
      try {
        ctx.removeEventListener('statechange', handler)
      } catch {
        // best-effort
      }
    }
  }

  // Initial sample on probe start. Records 'unavailable' if Howler hasn't
  // initialized yet — that's fine, it gives us a t=0 anchor.
  const startCtx = readHowlerCtx(opts.howlerLike)
  if (startCtx) attachStatechange(startCtx)
  emit('init', startCtx)

  // 1 Hz poll. Re-reads Howler.ctx every tick because it lazy-init's on
  // first play(). Once we see a real ctx we attach the statechange
  // listener — at most once per ctx instance.
  internal.pollHandle = schedule(() => {
    if (internal.stopped) return
    const ctx = readHowlerCtx(opts.howlerLike)
    if (ctx) attachStatechange(ctx)
    emit('poll', ctx)
  }, pollIntervalMs)

  // Cancel polling at pollWindowMs. Statechange + tap recording continue
  // indefinitely — they're event-driven and have negligible overhead.
  internal.windowHandle = scheduleOnce(() => {
    if (internal.pollHandle !== null) {
      cancelSchedule(internal.pollHandle)
      internal.pollHandle = null
    }
  }, pollWindowMs)

  function stop(): void {
    if (internal.stopped) return
    internal.stopped = true
    if (internal.pollHandle !== null) {
      cancelSchedule(internal.pollHandle)
      internal.pollHandle = null
    }
    if (internal.windowHandle !== null) {
      cancelScheduleOnce(internal.windowHandle)
      internal.windowHandle = null
    }
    if (internal.detachStatechange) {
      internal.detachStatechange()
      internal.detachStatechange = null
    }
    internal.attachedCtx = null
  }

  function sampleNow(cause: 'tap' | 'init' = 'tap'): AudioCtxState {
    if (internal.stopped) {
      // Even after stop(), return the current state so a late tap-time
      // sample can still be observed if a caller asks. We do NOT record
      // — a stopped probe means tests / cleanup ran, and re-recording
      // would surprise.
      return readCtxState(readHowlerCtx(opts.howlerLike))
    }
    const ctx = readHowlerCtx(opts.howlerLike)
    // Late attach if Howler showed up between poll ticks.
    if (ctx) attachStatechange(ctx)
    return emit(cause, ctx)
  }

  /**
   * Phase-3 diagnostic emit (ticket 86c9gvd0y). The probe shares its
   * emit path with the new Phase-3 causes so every record — speak-call,
   * speak-onplay, speak-skipped, handler-error — lands in the same
   * localStorage timeline as the original poll/statechange/tap rows,
   * with the gateState mirror attached uniformly.
   *
   * After `stop()` these are no-ops to avoid surprising tests / cleanup
   * paths that still hold a stale handle.
   */
  function recordSpeakCall(soundId: number | null, tag?: string): void {
    if (internal.stopped) return
    const ctx = readHowlerCtx(opts.howlerLike)
    emit('speak-call', ctx, {
      speakResult: soundId,
      ...(tag !== undefined ? { skipReason: tag } : {}),
    })
  }

  function recordSpeakOnPlay(tag?: string): void {
    if (internal.stopped) return
    const ctx = readHowlerCtx(opts.howlerLike)
    emit('speak-onplay', ctx, {
      ...(tag !== undefined ? { skipReason: tag } : {}),
    })
  }

  function recordSpeakSkipped(reason: string): void {
    if (internal.stopped) return
    const ctx = readHowlerCtx(opts.howlerLike)
    emit('speak-skipped', ctx, { skipReason: reason })
  }

  function recordHandlerError(error: unknown): void {
    if (internal.stopped) return
    const ctx = readHowlerCtx(opts.howlerLike)
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '(non-Error thrown)'
    emit('handler-error', ctx, { errorMessage: message })
  }

  return {
    stop,
    sampleNow,
    recordSpeakCall,
    recordSpeakOnPlay,
    recordSpeakSkipped,
    recordHandlerError,
  }
}

/**
 * localStorage key — exported so tests can assert on it and so Thomas
 * (or DevTools) can read/clear it manually if needed.
 */
export const AUDIO_CTX_LOG_STORAGE_KEY = LOG_STORAGE_KEY

/**
 * Module-level singleton for the active probe. Pattern matches the rest
 * of `lib/debug` — module singletons are how producer code (Greet's tap
 * handler, future audio call sites) reaches the bus without threading
 * the handle through context.
 *
 * `null` when no probe has been started (production sessions, debug
 * disabled). Callers that depend on the probe being active (tests, the
 * Greet tap-time hook) should null-guard.
 */
let activeProbe: AudioContextProbeHandle | null = null

/**
 * Start the probe and register it as the module-level singleton. Returns
 * the same handle as `startAudioContextProbe`. Calling this twice
 * replaces the singleton — the previous probe is stopped.
 */
export function activateAudioContextProbe(
  opts: AudioContextProbeOptions = {},
): AudioContextProbeHandle {
  if (activeProbe) activeProbe.stop()
  activeProbe = startAudioContextProbe(opts)
  return activeProbe
}

/**
 * Synchronous tap-time sample. Safe to call from any tap handler — if
 * no probe is active (production / no `?debug=1`) this is a no-op that
 * returns `'unavailable'`. The cost in production is one null check.
 *
 * The `'tap'` cause is the load-bearing diagnostic for ticket 86c9gvd0y:
 * a tap that arrives at the React handler but finds the AudioContext in
 * `'suspended'` or `'interrupted'` state directly proves the iOS
 * audio-session decay hypothesis.
 */
export function sampleAudioCtxOnTap(): AudioCtxState {
  if (!activeProbe) return 'unavailable'
  return activeProbe.sampleNow('tap')
}

/**
 * Phase-3 diagnostic surface (ticket 86c9gvd0y). All four singleton
 * wrappers below are no-ops when no probe is active, so production
 * sessions (no `?debug=1`) pay only a null check per call. iPad QA
 * sessions add roughly one localStorage row per call.
 *
 * Diagnostic intent
 * -----------------
 * - `recordSpeakCall(soundId, tag?)`: every `Howl.play()` synchronous
 *   return emits a row. `soundId` is the Howler return value (number)
 *   or `null` when play threw / no Howl available. `tag` is folded
 *   into `skipReason` for cross-referencing (typical: a Greet line key).
 *
 * - `recordSpeakOnPlayEvent(tag?)`: Howler's `'play'` event handler
 *   emits a row. The diagnostic question we are answering: do we see
 *   `'speak-call'` rows but no matching `'speak-onplay'` rows? That
 *   would localize the failure to Howler-on-iOS play-to-onplay stall,
 *   downstream of the audio-context layer.
 *
 * - `recordSpeakSkipped(reason)`: tap-handler early-returns. If we see
 *   tap rows followed by `'speak-skipped'` with `reason` and no
 *   `'speak-call'`, the gate is bouncing the gesture (e.g. dispatch
 *   wasn't consumed because gate isn't `'relock'` yet).
 *
 * - `recordHandlerError(error)`: tap-handler body threw. The error
 *   message is recorded. Caller MUST re-throw afterwards so production
 *   behaviour (the throw) is preserved.
 */
export function recordSpeakCallEvent(
  soundId: number | null,
  tag?: string,
): void {
  if (!activeProbe) return
  activeProbe.recordSpeakCall(soundId, tag)
}

export function recordSpeakOnPlayEvent(tag?: string): void {
  if (!activeProbe) return
  activeProbe.recordSpeakOnPlay(tag)
}

export function recordSpeakSkippedEvent(reason: string): void {
  if (!activeProbe) return
  activeProbe.recordSpeakSkipped(reason)
}

export function recordHandlerErrorEvent(error: unknown): void {
  if (!activeProbe) return
  activeProbe.recordHandlerError(error)
}

/**
 * Stop the active singleton probe (if any) and clear the registration.
 * Test-only — production never tears the probe down.
 */
export function _resetAudioContextProbeForTests(): void {
  if (activeProbe) {
    activeProbe.stop()
    activeProbe = null
  }
}
