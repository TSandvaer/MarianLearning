/**
 * Howler AudioContext gesture-resume helper.
 *
 * Why this module exists (Phase-2 fix for ticket 86c9gvd0y)
 * --------------------------------------------------------
 * The Phase-1 iPad export-log proved that the bug Thomas reported is NOT
 * audio-session decay in the way the original ticket assumed. The data
 * showed:
 *
 *   - Greet's chime SFX construction (`createSfx` at Greet mount) causes
 *     Howler to lazy-init `Howler.ctx` in the `'suspended'` state, because
 *     Splash → Greet auto-advances WITHOUT a user gesture. WebKit creates
 *     `AudioContext` suspended until the first gesture lands.
 *   - The context then sits `suspended` for as long as Marian looks at
 *     Melody (68 consecutive 1Hz polls confirmed `suspended` over 68s in
 *     Thomas's repro). It is not decaying. It has never been unlocked.
 *   - When the tap finally arrives, `ctx.resume()` (kicked implicitly by
 *     Howler's `play()` middleware) succeeds — `statechange → running`
 *     within ~185 ms. The audio context is fine.
 *   - But Howler's `onplay` event never fires. The gate's 1.5 s watchdog
 *     times out to `relock`. Marian sees no Melody, no heart, just the
 *     ring re-pulsing.
 *
 * Empirical hypothesis for the play-stall: Howler's `Howl.play()` checks
 * `Howler.ctx.state`; if suspended it calls `ctx.resume()` and queues the
 * actual buffer-source start onto the resume Promise. On iOS standalone
 * PWA, the queued play occasionally never finishes binding its buffer
 * source — likely a Howler internal where the suspended-at-construction
 * Howl preloaded its decoded buffer but didn't bind a source node, and
 * the bind step that happens during `play()` races with the resume.
 *
 * The fix this module enables
 * ---------------------------
 * Resume `Howler.ctx` EXPLICITLY and SYNCHRONOUSLY inside the user-gesture
 * handler, BEFORE calling any Howl `play()`. By the time `play()` runs
 * (which on the pre-recorded path happens in a microtask via
 * `ensureLoaded.then`), the resume is already in flight against the
 * gesture activation. iOS WebKit's gesture-context association is robust
 * across the time it takes the resume promise to settle, and the
 * subsequent `play()` no longer races with the suspended → running
 * transition.
 *
 * Mental model for callers: "before I do anything audio-y on a gesture,
 * resume the context." That's it. Returns a small result object that lets
 * the caller log what happened (the debug overlay reads it via the bus).
 *
 * What this module does NOT do
 * ----------------------------
 * - It does not own the gate state. The audio-unlock-gate (Dave's
 *   contract) is still the source of truth for "did speech actually
 *   start?" — this module just makes sure the context is in a state
 *   where speech CAN start.
 * - It does not add a silent oscillator keep-alive. The Phase-1 data
 *   showed iOS is not decaying the context idle; we don't pay battery
 *   for a problem that doesn't exist.
 * - It does not call `play()` itself. Callers (Greet's wake-tap, the
 *   future Math first-tap, Word Song first-tap, Session End first-tap)
 *   keep their own play orchestration; this is just the resume kick.
 * - It is NOT debug-gated. This is a production fix that runs every
 *   session, not a `?debug=1` instrumentation.
 *
 * Spec reference: design/session-1.md → "iPad Safari audio constraint"
 * (the reason the gate exists in the first place); ticket 86c9gvd0y for
 * the iPad data that motivated this layer.
 */

import { Howler } from 'howler'

/**
 * State values we mirror onto `AudioCtxState` in the debug bus. The
 * Web Audio standard defines `'running' | 'suspended' | 'closed'`;
 * WebKit additionally exposes `'interrupted'` when iOS preempts the
 * audio session (phone call, Siri). We treat both `'suspended'` and
 * `'interrupted'` as "needs resume" — the recovery path is identical.
 */
export type HowlerContextState =
  | 'running'
  | 'suspended'
  | 'interrupted'
  | 'closed'
  | 'unavailable'

export interface ResumeResult {
  /** State observed BEFORE we kicked any resume() call. */
  stateBefore: HowlerContextState
  /**
   * Whether we called `ctx.resume()`. False if the context was already
   * running, or if no AudioContext was available to resume (no Howler,
   * no ctx, environment without WebAudio).
   */
  resumeCalled: boolean
  /**
   * Whether `ctx.resume()` threw synchronously. iOS very rarely throws
   * here — usually the promise just rejects — but Howler's typings claim
   * the call cannot throw and we don't trust them implicitly.
   */
  resumeThrew: boolean
}

export interface ResumeAudioContextOptions {
  /**
   * Override Howler. Tests inject a stub with a fake `ctx`; production
   * omits this and we read the real `Howler.ctx`.
   */
  howlerLike?: { ctx?: AudioContext | null }
}

/**
 * Read whatever Howler exposes as an AudioContext, defensively. Mirrors
 * `audioContextProbe.readHowlerCtx` so the two diagnostic and fix
 * surfaces share the same access pattern.
 */
function readHowlerCtx(override?: {
  ctx?: AudioContext | null
}): AudioContext | null {
  const target = override ?? (Howler as unknown as { ctx?: AudioContext })
  try {
    const ctx = target.ctx
    if (!ctx) return null
    return ctx
  } catch {
    return null
  }
}

function readState(ctx: AudioContext | null): HowlerContextState {
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
      return 'unavailable'
  }
}

/**
 * Synchronously kick `Howler.ctx.resume()` if the context exists and is
 * not already running. Safe to call from any user-gesture handler:
 *
 *   - If Howler hasn't lazy-initted yet (no `ctx`), this is a no-op.
 *   - If the context is already `running`, this is a no-op.
 *   - If the context is `closed`, this is a no-op (resume is illegal on
 *     a closed context; we don't try).
 *   - If the context is `suspended` or `interrupted`, we call
 *     `ctx.resume()`. We do NOT await the returned Promise — the whole
 *     point of this helper is to be a synchronous gesture-window kick.
 *     The promise's rejection (very rare on iOS) is caught and folded
 *     into a no-op so callers never see an unhandled rejection.
 *
 * Idempotent: calling twice in the same gesture is harmless.
 *
 * MUST be called inside a user-gesture handler tick on iOS. Calling it
 * outside a gesture is also safe, but the resume() will silently fail
 * to actually transition the context — that's a WebKit constraint, not
 * something this helper can fix.
 *
 * Returns a small result object so the caller (and the debug overlay,
 * via callers that record into the bus) can see what happened.
 */
export function resumeHowlerContextOnGesture(
  opts: ResumeAudioContextOptions = {},
): ResumeResult {
  const ctx = readHowlerCtx(opts.howlerLike)
  const stateBefore = readState(ctx)

  if (!ctx) {
    return { stateBefore, resumeCalled: false, resumeThrew: false }
  }

  // Only call resume() when there's something to resume. Calling resume()
  // on a `running` context is harmless on most browsers but on some iOS
  // versions it triggers an extra `statechange` event with the same
  // value, which we'd rather not pollute the diagnostic stream with.
  if (stateBefore !== 'suspended' && stateBefore !== 'interrupted') {
    return { stateBefore, resumeCalled: false, resumeThrew: false }
  }

  let resumeThrew = false
  try {
    const result = ctx.resume()
    // Web Audio's resume() returns a Promise. Some older / non-conformant
    // implementations return undefined. Defensively swallow rejections so
    // we never leak unhandled-promise warnings on iOS edge cases.
    if (result && typeof (result as Promise<void>).catch === 'function') {
      ;(result as Promise<void>).catch(() => {
        /* ignored — see above */
      })
    }
  } catch {
    // Synchronous throw is rare but documented for some Safari builds.
    resumeThrew = true
  }

  return { stateBefore, resumeCalled: true, resumeThrew }
}

/**
 * Phase-4 fix surface (ticket 86c9gvd0y).
 *
 * Why this exists alongside `resumeHowlerContextOnGesture`
 * --------------------------------------------------------
 * The Phase-2 helper (above) kicks `ctx.resume()` synchronously inside the
 * gesture handler — correct iOS hygiene, but the resume PROMISE still
 * settles asynchronously. Phase-3's iPad data showed the race that follows:
 *
 *   t=0      tap arrives, gesture window open
 *   t=0+ms   resumeHowlerContextOnGesture() fires, ctx.resume() called
 *   t=0+ms   playGreetLine() resolves its `ensureLoaded.then` microtask
 *            and calls `Howl.play()` while ctx is still `'suspended'` —
 *            Howler binds a buffer source against the suspended context
 *   t=139ms  ctx statechange → `'running'` (resume promise finally settles)
 *   …        but the buffer source is in limbo and `onplay` never fires
 *
 * This helper fixes that by AWAITING the resume promise before the caller
 * proceeds to `Howl.play()`. By the time play() is called, the context is
 * actually `running` and Howler binds against a live state.
 *
 * Cost: ~140ms added latency on tap-after-idle (matches the observed iPad
 * resume-promise settle time). Imperceptible relative to Greet's own
 * line-to-line cadence; well worth shipping clean audio.
 *
 * The Phase-2 helper STAYS — it's still the right thing to do
 * synchronously inside the gesture handler (gesture-context association
 * for iOS is most robust when resume is kicked in the same tick as the
 * tap). This Phase-4 helper is the AWAITED version, intended for the
 * play-call site (one microtask later).
 *
 * Bounded wait: a never-settling resume promise would hang Greet forever.
 * We race the resume against a 500 ms timeout — well above the observed
 * 139 ms iPad settle time but well below any user-visible silence floor.
 * If the timeout wins, we return anyway and let `play()` try; iOS may
 * still play, and even if it doesn't, the watchdog → relock recovery
 * kicks in. We're never worse than the pre-fix behaviour.
 */

/** Bounded-wait timeout for the resume promise. */
const RESUME_AWAIT_TIMEOUT_MS = 500

export interface AwaitResumeResult {
  /** State observed BEFORE we awaited. */
  stateBefore: HowlerContextState
  /**
   * Whether we awaited the resume promise. False if the context was
   * already running, closed, or unavailable (no resume to wait for).
   */
  resumeAwaited: boolean
  /**
   * Whether the bounded-wait timeout fired before the resume promise
   * settled. Diagnostic only — caller proceeds to `play()` either way.
   */
  timedOut: boolean
  /**
   * Whether `ctx.resume()` threw synchronously. Mirrors
   * `ResumeResult.resumeThrew`.
   */
  resumeThrew: boolean
}

export interface AwaitResumeOptions extends ResumeAudioContextOptions {
  /**
   * Override the bounded-wait timeout. Tests use a small value to keep
   * the suite snappy; production uses the module default.
   */
  timeoutMs?: number
  /** Test seam — defaults to `window.setTimeout`. */
  scheduleOnce?: (cb: () => void, ms: number) => unknown
  /** Test seam — defaults to `window.clearTimeout`. */
  cancelScheduleOnce?: (handle: unknown) => void
}

/**
 * Resume `Howler.ctx` and await the resume promise's settlement (bounded
 * by a timeout) before resolving. Intended for the play-call site:
 * `await awaitHowlerContextResume()` immediately before `Howl.play()`.
 *
 *   - If `ctx` is unavailable, already running, or closed: resolves
 *     immediately with `resumeAwaited: false`.
 *   - If `ctx` is suspended/interrupted: calls `ctx.resume()` and awaits
 *     the returned promise, racing against `RESUME_AWAIT_TIMEOUT_MS`.
 *     Resolves when the resume settles (success or failure) or the
 *     timeout fires, whichever comes first.
 *
 * Caller MUST be inside (or microtask-adjacent to) a user-gesture for the
 * resume to actually transition the context on iOS. This helper does
 * not synthesize a gesture; it just waits for the resume the gesture
 * authorized.
 */
export async function awaitHowlerContextResume(
  opts: AwaitResumeOptions = {},
): Promise<AwaitResumeResult> {
  const ctx = readHowlerCtx(opts.howlerLike)
  const stateBefore = readState(ctx)

  if (!ctx) {
    return {
      stateBefore,
      resumeAwaited: false,
      timedOut: false,
      resumeThrew: false,
    }
  }

  if (stateBefore !== 'suspended' && stateBefore !== 'interrupted') {
    return {
      stateBefore,
      resumeAwaited: false,
      timedOut: false,
      resumeThrew: false,
    }
  }

  const timeoutMs = opts.timeoutMs ?? RESUME_AWAIT_TIMEOUT_MS
  const scheduleOnce =
    opts.scheduleOnce ?? ((cb, ms) => window.setTimeout(cb, ms))
  const cancelScheduleOnce =
    opts.cancelScheduleOnce ?? ((h) => window.clearTimeout(h as number))

  let resumePromise: Promise<unknown> | null = null
  try {
    const result = ctx.resume()
    if (result && typeof (result as Promise<void>).then === 'function') {
      resumePromise = result as Promise<unknown>
    }
  } catch {
    // Synchronous throw — mirror Phase-2 behaviour. Skip the await; the
    // caller proceeds to play() and the watchdog handles failure.
    return {
      stateBefore,
      resumeAwaited: false,
      timedOut: false,
      resumeThrew: true,
    }
  }

  // Legacy resume() that returns void: nothing to await; resolve.
  if (!resumePromise) {
    return {
      stateBefore,
      resumeAwaited: false,
      timedOut: false,
      resumeThrew: false,
    }
  }

  // Race the resume promise against a bounded timeout. Either way the
  // caller can proceed; the diagnostic flag tells the probe which won.
  let timeoutHandle: unknown = null
  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    timeoutHandle = scheduleOnce(() => resolve('timeout'), timeoutMs)
  })
  const settledPromise = resumePromise
    .then(() => 'settled' as const)
    .catch(() => 'settled' as const)

  const winner = await Promise.race([settledPromise, timeoutPromise])
  if (timeoutHandle !== null) cancelScheduleOnce(timeoutHandle)

  return {
    stateBefore,
    resumeAwaited: true,
    timedOut: winner === 'timeout',
    // resume() did not throw synchronously — we already returned in the
    // catch branch above if it had. The reject path of the resume
    // promise itself is folded into 'settled' (we don't surface it as
    // resumeThrew, which is reserved for synchronous throws).
    resumeThrew: false,
  }
}
