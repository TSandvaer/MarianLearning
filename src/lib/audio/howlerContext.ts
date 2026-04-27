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
 * Read whether `Howler.ctx` is currently in the `'running'` state. Returns
 * `false` when Howler has not lazy-initted, when the context is missing, or
 * when the context is in any state other than `'running'`.
 *
 * Why this helper exists (ticket 86c9hf4ef)
 * -----------------------------------------
 * After Greet's wake-tap + heart-tap sequence, Howler's audio context has
 * been unlocked and is in `'running'` state. When Math (or Word Song) mounts
 * next, its local `audioUnlocked` React state defaults to `false`, but the
 * underlying Howler context is already live — a previous gesture on a
 * different screen authorised it. Math/Word Song's read-aloud effect uses
 * this helper to detect the Greet-already-unlocked precondition and fire
 * the read-aloud immediately on cold mount, rather than waiting for a chip
 * tap that the disabled-chip gate won't allow.
 *
 * Production callers read the real `Howler.ctx`. Tests pass a stub through
 * the screen prop seam (`getHowlerRunning`) — we don't expose a `howlerLike`
 * override here because the production helper is a pure read with no
 * side-effects.
 */
export function readHowlerContextRunning(): boolean {
  const ctx = readHowlerCtx()
  return readState(ctx) === 'running'
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
 * Phase-4 / Phase-7 fix surface (ticket 86c9gvd0y).
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
 * This helper fixes that by AWAITING the resume before the caller proceeds
 * to `Howl.play()`. By the time play() is called, the context is actually
 * `running` and Howler binds against a live state.
 *
 * Phase-7 update (ticket 86c9gvd0y, 2026-04-26): event-driven resume wait
 * -----------------------------------------------------------------------
 * The Phase-4 implementation used a fixed 500 ms timeout, sized against
 * the ~139 ms observed iPad resume-promise settle time on a 3 s idle.
 * Thomas's 2026-04-26 iPad capture revealed a worst-case scenario the
 * Phase-4 sizing missed: after a 78 s idle (page sat suspended in the
 * background), iOS Safari's audio session takes ~3.6 s to actually transition
 * the context from `'suspended'` to `'running'` after `ctx.resume()` is
 * called. The 500 ms timeout fired long before that, `play()` ran against
 * a still-suspended context, `onplay` never fired, and the gate relocked.
 *
 * The fix: drop the fixed-time race and instead WAIT FOR THE STATE TO
 * ACTUALLY BECOME `'running'`. We subscribe to the `statechange` event on
 * the AudioContext and resolve the helper the moment the state observably
 * transitions. A much longer fallback timeout (5 000 ms) is the safety
 * valve for genuinely stuck contexts — but the common case is event-driven
 * and resolves in whatever time the OS actually needs (139 ms on warm
 * idle, 3.6 s on cold idle).
 *
 * Why event-driven (not just a longer timeout)
 * --------------------------------------------
 *   - The resume PROMISE on iOS sometimes settles before the state has
 *     fully transitioned (or settles after — neither is reliable).
 *     Subscribing to `statechange` is the canonical signal for "the
 *     context is now `running`".
 *   - The iPad data shows variable resume latency (139 ms / 3.6 s) — a
 *     longer fixed timeout would either still race the cold case or
 *     waste time on the warm case. Event-driven adapts.
 *   - Cleanup is straightforward: a single `removeEventListener` +
 *     `clearTimeout` on resolve, regardless of which path won.
 *
 * Cost: zero extra latency on the warm path (event fires the moment the
 * OS transitions the context). Up to 5 000 ms on a worst-case stuck
 * context — long, but bounded, and the gate's watchdog at the call-site
 * is sized accordingly (Greet/Math/WordSong's `FIRST_UTTERANCE_RETRY_MS`
 * was bumped from 1 500 ms → 6 000 ms in the same Phase-7 patch).
 *
 * The Phase-2 helper STAYS — it's still the right thing to do
 * synchronously inside the gesture handler (gesture-context association
 * for iOS is most robust when resume is kicked in the same tick as the
 * tap). This Phase-4/7 helper is the AWAITED version, intended for the
 * play-call site (one microtask later).
 */

/**
 * Phase-7 fallback timeout for the event-driven resume wait. Sized against
 * Thomas's 2026-04-26 iPad capture: worst observed `'suspended'` →
 * `'running'` transition after long idle was 3.6 s. 5 s is the safety
 * valve — well above the worst observed real-iOS latency, well below the
 * Greet/Math/WordSong gate watchdog (6 s) so a genuinely-stuck context
 * surfaces a relock UI rather than hanging forever.
 */
const RESUME_AWAIT_TIMEOUT_MS = 5_000

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
 * Resume `Howler.ctx` and wait for the context state to actually transition
 * to `'running'` (bounded by a fallback timeout) before resolving. Intended
 * for the play-call site: `await awaitHowlerContextResume()` immediately
 * before `Howl.play()`.
 *
 *   - If `ctx` is unavailable, already running, or closed: resolves
 *     immediately with `resumeAwaited: false`.
 *   - If `ctx` is suspended/interrupted: calls `ctx.resume()` and waits
 *     for the next of these signals, whichever fires first:
 *       (a) a `statechange` event firing with `ctx.state === 'running'`
 *           (the canonical signal — the OS has actually transitioned
 *           the audio output graph), or
 *       (b) the resume promise settling AND `ctx.state === 'running'` at
 *           that moment (belt-and-suspenders for browsers that resolve
 *           the resume promise without firing `statechange`), or
 *       (c) the fallback timeout (`RESUME_AWAIT_TIMEOUT_MS`, default
 *           5 000 ms) — `timedOut: true`. The caller proceeds to play()
 *           anyway; the gate watchdog at the call site catches a stuck
 *           context as a relock.
 *
 * Phase-7 (ticket 86c9gvd0y): the previous implementation raced the resume
 * promise against a 500 ms timeout. Real-iPad data after long-idle showed
 * iOS taking ~3.6 s to transition the context, so the timeout fired and
 * `play()` ran against a still-suspended context. Event-driven wait
 * adapts to the actual OS latency (139 ms on warm idle, 3.6 s on cold).
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

  // Read state defensively — if the post-resume state read throws, treat
  // it as still-not-running and fall through to the event-driven wait.
  const isRunningNow = (): boolean => {
    try {
      return (ctx.state as unknown as string) === 'running'
    } catch {
      return false
    }
  }

  // Fast path: some impls flip state synchronously inside resume(). If
  // we're already running, no need to attach listeners or schedule a
  // timeout — done.
  if (isRunningNow()) {
    return {
      stateBefore,
      resumeAwaited: true,
      timedOut: false,
      resumeThrew: false,
    }
  }

  // Event-driven wait. Resolve when state observably transitions to
  // `'running'`, OR when the resume promise settles and state happens to
  // be `'running'` at that moment, OR when the fallback timeout fires.
  // Whichever wins, we clean up the others before resolving.
  return new Promise<AwaitResumeResult>((resolveOuter) => {
    let settled = false
    let timeoutHandle: unknown = null

    const finish = (timedOut: boolean) => {
      if (settled) return
      settled = true
      // Best-effort listener removal. If `removeEventListener` doesn't
      // exist (legacy / stub ctx), the listener was never attached so
      // there's nothing to remove.
      try {
        if (typeof ctx.removeEventListener === 'function') {
          ctx.removeEventListener('statechange', onStateChange)
        }
      } catch {
        // Defensive — never let cleanup throw out of the helper.
      }
      if (timeoutHandle !== null) {
        try {
          cancelScheduleOnce(timeoutHandle)
        } catch {
          // Defensive — same rationale.
        }
        timeoutHandle = null
      }
      resolveOuter({
        stateBefore,
        resumeAwaited: true,
        timedOut,
        // resume() did not throw synchronously — we already returned in
        // the catch branch above if it had. Resume-promise rejection is
        // folded into the wait (we just keep waiting for state===running
        // or the timeout).
        resumeThrew: false,
      })
    }

    const onStateChange = () => {
      if (isRunningNow()) finish(false)
    }

    // Subscribe to statechange BEFORE checking state again — narrow the
    // race window where state transitions between our last read and the
    // listener attaching.
    let listenerAttached = false
    try {
      if (typeof ctx.addEventListener === 'function') {
        ctx.addEventListener('statechange', onStateChange)
        listenerAttached = true
      }
    } catch {
      // Defensive — fall through to the timeout-only path.
    }

    // Re-check state after attaching the listener: if it transitioned
    // synchronously between our earlier check and the listener attach,
    // we'd otherwise wait for a `statechange` event that already fired.
    if (isRunningNow()) {
      finish(false)
      return
    }

    // Schedule the fallback timeout. The caller proceeds to play() with
    // `timedOut: true` if this fires; the gate watchdog at the call site
    // catches the relock case.
    timeoutHandle = scheduleOnce(() => {
      timeoutHandle = null
      finish(true)
    }, timeoutMs)

    // If the resume promise settles and state is running by then, we can
    // resolve early without waiting for the (already-fired) statechange
    // event. If state is NOT running on resume settle, we keep waiting
    // — the resume promise on some browsers settles before the state
    // actually transitions, and the statechange event is the truth.
    //
    // Resume-promise rejection is benign: state may still transition
    // (some iOS edge cases reject the promise but the OS audio session
    // still wakes up), so we treat reject the same as resolve and just
    // re-check state.
    if (resumePromise) {
      const recheck = () => {
        if (isRunningNow()) finish(false)
      }
      resumePromise.then(recheck, recheck)
    }

    // If we couldn't attach a listener (ancient ctx without
    // addEventListener), fall back to the resume-promise + timeout path.
    // Nothing more to do — the timeout will fire, or the resume promise
    // recheck above will resolve if state happens to be running by then.
    if (!listenerAttached && !resumePromise) {
      // No way to observe a transition AND no resume promise to recheck
      // state on. The timeout is the only possible resolver — leave it.
    }
  })
}

/**
 * Phase-5 fix surface (ticket 86c9gvd0y).
 *
 * Why this exists alongside the Phase-2 / Phase-4 helpers
 * -------------------------------------------------------
 * The Phase-4 iPad data showed `ctx.resume()` settling correctly (state
 * `'running'` 188 ms after the tap, well within the awaited window) and
 * `Howl.play()` returning a valid sound id. But `'speak-onplay'` never
 * fired — across three back-to-back taps. That localizes the failure
 * BELOW the WebAudio `AudioContext` layer, at the iOS audio-session /
 * hardware-output layer.
 *
 * iOS draws a distinction the Web Audio spec does not:
 *
 *   - **WebAudio AudioContext** is a browser-level construct. `state` and
 *     `resume()` operate here. After ~60 s of total silence, iOS does not
 *     change this state — the context remains `running` (or transitions
 *     `suspended → running` on the next gesture, as Phase-1/4 confirmed).
 *
 *   - **iOS audio session** is an OS-level construct, independent of any
 *     browser. After ~60 s with no actual audio output, iOS releases the
 *     audio session to save power. `AudioContext.state` does not reflect
 *     this. `AudioBufferSourceNode.start()` will queue the source against
 *     a context that is `running` from JS's perspective but whose output
 *     graph is no longer wired through to the speaker — the source plays
 *     into the void, no `'play'` event ever fires from the underlying
 *     buffer source's `onended` chain.
 *
 * The canonical fix on iOS is to play a 1-sample silent buffer SYNCHRONOUSLY
 * inside the user-gesture event handler, every gesture. The OS audio session
 * re-engages because something is requesting output; subsequent real plays
 * (microseconds later) bind against a live output graph and fire `'play'`
 * normally.
 *
 * Why Howler doesn't do this for us
 * ---------------------------------
 * Howler's internal `_unlockAudio` (see `node_modules/howler/dist/howler.js`
 * around line 301) plays a scratch buffer on the FIRST gesture, then sets
 * `Howler._audioUnlocked = true` and removes its own gesture listeners.
 * After that flag flips, Howler never re-runs the unlock — even though iOS
 * re-releases the session every long-idle window. We need to kick the
 * silent buffer ourselves on every gesture that's about to play audio.
 *
 * Phase-6 extension (ticket 86c9gvd0y): HTML5 audio pool refill
 * -------------------------------------------------------------
 * Phase-5 shipped, but iPad still failed after long-idle. Two back-to-back
 * sessions captured 2026-04-26 isolated the empirical delta: at the
 * gesture moment of a WORKING session, `Howler._html5AudioPool.length`
 * was 10. At the gesture moment of a FAILING session (after ~52 s idle),
 * it was 0. Pool=0 BEFORE first user tap.
 *
 * Pool=10 → 0 is not "draining"; the pool starts empty and is populated
 * exclusively by Howler's own `unlock` handler (howler.js line 334-348),
 * which runs on the first capture-phase `touchstart`/`touchend`/`click`
 * delivered to `document`. On long-idle iPad PWA, that handler does not
 * fire reliably — the user gesture reaches React via a different path
 * (we suspect iOS's hit-testing or focus-restoration delivers the touch
 * directly to the React root after a focus-loss window) so Howler's
 * capture-phase listener never sees it. `_audioUnlocked` stays false,
 * the pool stays empty, the OS audio session stays released.
 *
 * Pool size doesn't directly affect Web Audio playback (we use Web Audio
 * mode; the pool is only consumed when sounds are constructed in HTML5
 * mode). But pool=0 is a reliable signal that Howler's unlock code path
 * never ran in this gesture window, and we want all of its iOS-relevant
 * side effects to run, in OUR gesture handler tick. Phase-5 already
 * replicates the scratch-buffer + ctx.resume() side effects. This Phase-6
 * extension replicates the OTHER load-bearing side effect: filling the
 * HTML5 pool with `new Audio()` objects synchronously inside the gesture.
 *
 * What this helper does NOT do
 * ----------------------------
 * - It does not touch `AudioContext.state`. The Phase-2 (`resumeHowlerContextOnGesture`)
 *   and Phase-4 (`awaitHowlerContextResume`) helpers stay — they remain the
 *   right tools for the WebAudio layer. This helper addresses a different
 *   layer.
 * - It does not own a buffer cache. Creating a 1-sample buffer is so cheap
 *   (microseconds, no allocation pressure on the audio thread) that caching
 *   it would add complexity for no measurable benefit.
 * - It does not flip `Howler._audioUnlocked`. Howler owns that flag; we
 *   only mutate `Howler._html5AudioPool` (which Howler itself treats as
 *   replenishable — see howler.js line 334's `while (length < poolSize)`
 *   loop). Pushing to the pool in the same shape Howler does is the
 *   intended-by-Howler safe extension point.
 * - It is NOT debug-gated. This is a production fix that runs on every
 *   gesture-window play call.
 *
 * MUST be called synchronously inside the user-gesture handler tick on iOS.
 * Calling it after `await` defeats the purpose — iOS associates the
 * audio-session re-engagement with the gesture, and the gesture's
 * authorization expires the moment the JS task yields.
 */
export interface UnlockIosAudioSessionResult {
  /**
   * Whether we successfully created and started a silent buffer source.
   * False on environments without WebAudio, when the ctx is closed, or
   * when the silent-buffer construction threw.
   */
  bufferStarted: boolean
  /**
   * Whether one of the underlying calls (createBuffer / createBufferSource
   * / start / connect) threw synchronously. Diagnostic only — caller has
   * no recovery action; we just record and move on.
   */
  threw: boolean
  /**
   * Phase-6 (ticket 86c9gvd0y): `Howler._html5AudioPool.length` BEFORE
   * the helper ran. `undefined` when Howler isn't reachable / pool field
   * is missing (e.g. Howler renamed it). 0 in failing-session iPad
   * captures; 10 in working-session captures. This pair (with `poolAfter`)
   * is the diagnostic delta the Phase-6 fix targets — and the
   * regression-tracing surface for any future drift.
   */
  poolBefore?: number
  /**
   * Phase-6: `Howler._html5AudioPool.length` AFTER the helper pushed
   * fresh `new Audio()` objects. Should match `Howler.html5PoolSize`
   * (default 10). If less, `new Audio()` threw on this device.
   */
  poolAfter?: number
  /**
   * Phase-6: how many `new Audio()` objects we successfully pushed into
   * `Howler._html5AudioPool` this call. 0 when the pool was already
   * full, when Howler was unreachable, or when every Audio construction
   * threw.
   */
  poolFilled?: number
  /**
   * Phase-8 (ticket 86c9gvd0y): outcome of invoking Howler's internal
   * `_unlockAudio()` inside the gesture window.
   *
   *   - `'called'` — `Howler._unlockAudio` exists and we invoked it.
   *     Howler's own implementation guards on `_audioUnlocked`, so this
   *     does not double-unlock; it just gives Howler a chance to install
   *     its document-capture listeners again on the rare iOS edge case
   *     where its first install was missed.
   *   - `'missing'` — `Howler._unlockAudio` was not a function (Howler
   *     renamed the method, or we are running against a Howler stub /
   *     test fake that doesn't expose it). The Phase-5/6 fallbacks below
   *     still run and are sufficient for the documented iOS contract.
   *   - `'threw'` — calling `Howler._unlockAudio()` threw synchronously.
   *     Diagnostic only — we swallow and continue.
   */
  howlerUnlockMethodCalled?: 'called' | 'missing' | 'threw'
}

/**
 * Howler's HTML5 pool-size constant. Mirrored locally to avoid plumbing
 * `Howler.html5PoolSize` access through the `howlerLike` override seam
 * for tests; matches howler.js line 38 (`self.html5PoolSize = 10`). If
 * Howler ever raises its own default we'll see a one-time pool
 * under-fill on iPad — easily caught in the next probe pass.
 */
const HTML5_AUDIO_POOL_SIZE = 10

/**
 * Read Howler's `_html5AudioPool` array defensively. Howler types this
 * field as private; we treat any non-array value as "pool unavailable"
 * and return `undefined`. The same shape both production and tests
 * use — tests pass a `howlerLike` whose ctx field carries the pool ref
 * via a side property (see `unlockIosAudioSession` test seam).
 */
interface HowlerHtml5PoolHost {
  _html5AudioPool?: unknown
  html5PoolSize?: unknown
}

function readHowlerHtml5Pool(
  override?: { ctx?: AudioContext | null } & HowlerHtml5PoolHost,
): {
  pool: { push: (audio: unknown) => unknown; length: number } | null
  poolSize: number
} {
  // Production: read the real Howler module singleton. Tests can pass an
  // override that includes the pool fields directly on the howlerLike
  // shape (alongside `ctx`), which lets unit tests stand up a fake pool
  // without monkeypatching the real Howler import.
  const target =
    override ?? (Howler as unknown as HowlerHtml5PoolHost & { ctx?: unknown })
  let pool: { push: (audio: unknown) => unknown; length: number } | null = null
  let poolSize = HTML5_AUDIO_POOL_SIZE
  try {
    const rawPool = (target as HowlerHtml5PoolHost)._html5AudioPool
    if (Array.isArray(rawPool)) {
      pool = rawPool as unknown as {
        push: (audio: unknown) => unknown
        length: number
      }
    }
  } catch {
    // pool unreachable — leave null
  }
  try {
    const rawSize = (target as HowlerHtml5PoolHost).html5PoolSize
    if (typeof rawSize === 'number' && rawSize >= 0 && rawSize < 1000) {
      poolSize = rawSize
    }
  } catch {
    // size unreachable — fall back to the local constant
  }
  return { pool, poolSize }
}

export interface UnlockIosAudioSessionOptions extends ResumeAudioContextOptions {
  /**
   * Test seam — Audio constructor for the HTML5 pool refill. Production
   * uses `window.Audio`. Tests inject a fake counter so we can assert
   * how many constructions ran without standing up the real DOM Audio.
   */
  AudioCtor?: new () => unknown
  /**
   * Phase-8 test seam (ticket 86c9gvd0y) — the Howler-shaped object whose
   * `_unlockAudio` method we should invoke inside the gesture window.
   * Defaults to the imported `Howler` singleton in production. Tests pass
   * a fake `{ _unlockAudio: vi.fn() }` (or omit the method to simulate
   * Howler renaming it).
   */
  howlerUnlockHost?: { _unlockAudio?: unknown }
}

export function unlockIosAudioSession(
  opts: UnlockIosAudioSessionOptions = {},
): UnlockIosAudioSessionResult {
  const ctx = readHowlerCtx(opts.howlerLike)
  // Snapshot the pool BEFORE we do anything — diagnostic captures the
  // state Howler arrived in at the moment of this gesture, regardless of
  // whether ctx is reachable.
  const { pool, poolSize } = readHowlerHtml5Pool(
    opts.howlerLike as
      | ({ ctx?: AudioContext | null } & HowlerHtml5PoolHost)
      | undefined,
  )
  const poolBefore = pool ? pool.length : undefined

  if (!ctx) {
    return {
      bufferStarted: false,
      threw: false,
      ...(poolBefore !== undefined ? { poolBefore } : {}),
      ...(poolBefore !== undefined ? { poolAfter: poolBefore } : {}),
      poolFilled: 0,
    }
  }
  const state = readState(ctx)
  // Don't try on a closed context — createBufferSource throws.
  if (state === 'closed' || state === 'unavailable') {
    return {
      bufferStarted: false,
      threw: false,
      ...(poolBefore !== undefined ? { poolBefore } : {}),
      ...(poolBefore !== undefined ? { poolAfter: poolBefore } : {}),
      poolFilled: 0,
    }
  }

  // Phase-6 (ticket 86c9gvd0y). Refill `Howler._html5AudioPool` up to
  // `Howler.html5PoolSize` BEFORE the silent buffer plays. Pushing fresh
  // `new Audio()` instances synchronously inside the user gesture
  // mirrors Howler's own unlock loop (howler.js line 334-348) — the
  // documented iOS-friendly way to populate the pool. Each construction
  // is in its own try block because `new Audio()` can throw on hostile
  // platforms (no audio backend at all) and we want a partial fill
  // rather than aborting the whole helper. iPad QA exports show the
  // result via `recordUnlockStateEvent` rows captured before/after this
  // helper; a 0 → 10 transition confirms the fix.
  let poolFilled = 0
  if (pool) {
    const AudioCtor =
      opts.AudioCtor ??
      (typeof window !== 'undefined' && typeof window.Audio === 'function'
        ? (window.Audio as unknown as new () => unknown)
        : null)
    if (AudioCtor) {
      // Bound the loop by both the target size AND a hard iteration cap
      // so a poison Howler that ignores our pushes can't infinite-loop.
      let safety = poolSize + 4
      while (pool.length < poolSize && safety > 0) {
        safety -= 1
        try {
          const audio = new AudioCtor()
          // Mark the fresh element as unlocked, mirroring howler.js line
          // 340. Without this flag, Howler's `_releaseHtml5Audio` would
          // refuse to recycle the element back to the pool when a
          // played-through Sound finishes (howler.js line 449's
          // `audio._unlocked` guard).
          ;(audio as { _unlocked?: boolean })._unlocked = true
          pool.push(audio)
          poolFilled += 1
        } catch {
          // `new Audio()` threw — typical on platforms without audio
          // support. Stop pushing; partial fill is still better than
          // none, and the next gesture will retry.
          break
        }
      }
    }
  }

  const poolAfter = pool ? pool.length : poolBefore

  // Phase-8 (ticket 86c9gvd0y). Invoke Howler's internal `_unlockAudio()`
  // synchronously inside the gesture window, between the pool refill
  // (Phase-6) and the silent-buffer kick (Phase-5).
  //
  // Why this is here
  // ----------------
  // Phase-7's iPad capture proved `ctx.state` reaches `'running'` and our
  // synchronous `Howl.play()` call gets a valid sound id — yet the
  // `'play'` event still never fires after a long-idle window. Inspection
  // of `node_modules/howler/dist/howler.js` reveals the smoking gun: the
  // OUTER `_unlockAudio` (line 301) is idempotent-guarded by
  // `_audioUnlocked`. On the first gesture it installs a document-level
  // `touchstart`/`touchend`/`click`/`keydown` capture listener (lines
  // 408-412) whose body (lines 327-405) is what actually:
  //   - fills the HTML5 pool with `new Audio()` objects (line 334-348)
  //   - plays Howler's own scratch buffer (line 372-381)
  //   - calls `ctx.resume()` from inside the gesture (line 384-386)
  //   - sets `_audioUnlocked = true` and removes its own listeners (line
  //     393-399, inside the buffer source's `onended` handler)
  //
  // On the long-idle iPad path, our React handler runs BEFORE Howler's
  // document-capture listener fires (or fires it without driving the full
  // unlock — iOS gesture-event-dispatch on an app that's been backgrounded
  // is documented to be non-deterministic). `_audioUnlocked` stays false,
  // and on the NEXT gesture Howler's `_unlockAudio` short-circuits at
  // line 305 because — reading the Howler source carefully —
  // `_audioUnlocked` was never flipped to true (it gets RESET to false at
  // line 309 each call, but only flips to true inside the `onended`
  // handler which the document listener body schedules).
  //
  // Calling `Howler._unlockAudio()` here re-installs the document-capture
  // listeners. iOS's hit-testing for the same gesture is stale by this
  // point, but the listeners stay armed for the NEXT gesture, which is
  // the realistic recovery path the user will take after the first failed
  // tap. Belt-and-suspenders alongside our own pool refill (Phase-6) and
  // silent buffer (Phase-5) — both of which already replicate the
  // load-bearing side effects of Howler's `unlock(e)` body.
  //
  // Wrapped in try/catch because `_unlockAudio` is a leading-underscore
  // private method on the Howler module; if Howler ever renames it
  // we want to degrade silently rather than break audio. The Phase-5/6
  // fallbacks below are sufficient for the documented iOS contract on
  // their own.
  let howlerUnlockMethodCalled: 'called' | 'missing' | 'threw' = 'missing'
  try {
    const unlockHost =
      opts.howlerUnlockHost ?? (Howler as unknown as { _unlockAudio?: unknown })
    const unlockFn = unlockHost?._unlockAudio
    if (typeof unlockFn === 'function') {
      try {
        ;(unlockFn as (this: unknown) => unknown).call(unlockHost)
        howlerUnlockMethodCalled = 'called'
      } catch {
        // Synchronous throw inside `_unlockAudio`. Rare — the documented
        // implementation is straight-line code that does not throw — but
        // we never want a private-method invocation to surface as a JS
        // error to Marian. Swallow and proceed to Phase-5/6 fallbacks.
        howlerUnlockMethodCalled = 'threw'
      }
    }
  } catch {
    // Reading `Howler._unlockAudio` itself threw. Lockdown environments
    // can make property access on the Howler module throw. Swallow and
    // fall through to the silent-buffer kick — the rest of the helper
    // is unaffected.
    howlerUnlockMethodCalled = 'threw'
  }

  try {
    // 1-sample buffer at 22050 Hz: matches Howler's own scratch-buffer
    // shape exactly (see node_modules/howler/dist/howler.js, _unlockAudio).
    // Smallest-possible buffer that still re-engages the iOS audio session.
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
    // Disconnect immediately. The 1-sample buffer's playback completes in
    // ~45 microseconds anyway, but explicit disconnect avoids leaving any
    // node references alive longer than needed.
    try {
      source.disconnect()
    } catch {
      // Some impls reject disconnect on a not-yet-played source. Harmless
      // either way — the source will be garbage-collected once its end
      // event fires.
    }
    return {
      bufferStarted: true,
      threw: false,
      ...(poolBefore !== undefined ? { poolBefore } : {}),
      ...(poolAfter !== undefined ? { poolAfter } : {}),
      poolFilled,
      howlerUnlockMethodCalled,
    }
  } catch {
    // Best-effort. iOS may reject this in obscure edge cases (page is
    // backgrounded, audio session preempted by phone call). The next
    // gesture will try again; we don't propagate.
    return {
      bufferStarted: false,
      threw: true,
      ...(poolBefore !== undefined ? { poolBefore } : {}),
      ...(poolAfter !== undefined ? { poolAfter } : {}),
      poolFilled,
      howlerUnlockMethodCalled,
    }
  }
}

/**
 * Phase-8 fix surface (ticket 86c9gvd0y) — disable Howler's internal
 * `_autoSuspend` state machine.
 *
 * Why this exists
 * ---------------
 * Re-reading `node_modules/howler/dist/howler.js` after the Phase-7 iPad
 * capture surfaced a SECOND mechanism with a 30-second idle threshold —
 * matching Thomas's stopwatch repro EXACTLY:
 *
 *   - `Howler._autoSuspend()` (howler.js line 461) schedules a 30 000 ms
 *     timer after every sound's `_ended` callback (line 1997).
 *   - When the timer fires, it sets `Howler.state = 'suspending'` then
 *     calls `Howler.ctx.suspend()`. On resolve, `Howler.state = 'suspended'`.
 *   - On the next `Howl.play()`, the play body checks
 *     `Howler.state === 'running'` (line 886). When the state is
 *     `'suspended'`, play takes the else branch at line 888-896:
 *     `_playLock = true; self.once('resume', playWebAudio);` — i.e. it
 *     defers playback until Howler emits its OWN internal `'resume'`
 *     event.
 *   - That `'resume'` event is supposed to be emitted by `_autoResume()`
 *     (line 528-532) after `ctx.resume().then(...)` resolves. But our
 *     Phase-7 helper has ALREADY resumed `ctx` synchronously upstream —
 *     so by the time Howler's `_autoResume()` runs, `ctx.state` is
 *     already `'running'`. Howler's logic at line 521-523 sees this and
 *     takes the `else if (self.state === 'suspended' || ...)` branch
 *     (line 524), calling `ctx.resume()` AGAIN.
 *
 * The double-resume is fine on most browsers — `ctx.resume()` on a
 * running context is a fast no-op. But on long-idle iPad PWA the
 * second `.then` callback never settles in some captures, so
 * `Howler.state` stays at `'suspended'` and the deferred `playWebAudio`
 * is never invoked. The `Howl.play()` call has already returned a sound
 * id (the one Phase-7 logged: `soundId=1006`), but `_emit('play', id)`
 * inside `playWebAudio` never fires — exactly the symptom Phase-7
 * captured.
 *
 * The fix
 * -------
 * `Howler.autoSuspend = false`. Public, documented option (see
 * https://github.com/goldfire/howler.js#autosuspend-boolean). Suppresses
 * the 30 s timer entirely, so `Howler.state` never leaves `'running'`
 * after the first play, so `play()` always takes the line 887 fast path
 * (`playWebAudio()` runs synchronously), so `_emit('play', id)` always
 * fires.
 *
 * Why we can't just rely on `awaitHowlerContextResume` (Phase 7)
 * -------------------------------------------------------------
 * `awaitHowlerContextResume` operates on `Howler.ctx.state` (the WebAudio
 * layer). `Howler.state` (the Howler-internal state machine) is
 * independent — it does NOT mirror `Howler.ctx.state` directly; it is
 * driven by Howler's own suspend/resume machinery. Our resume helper
 * lands `ctx.state === 'running'` but Howler-internal state stays at
 * `'suspended'`, and Howler's `play()` body reads the latter, not the
 * former.
 *
 * Why we don't use this for `playLine`-time recovery
 * --------------------------------------------------
 * Setting `autoSuspend = false` once at app boot is the cleanest fix.
 * Calling it per gesture would also work but adds a property write to
 * every gesture handler. Boot-time once is sufficient because Howler
 * reads `self.autoSuspend` at line 485 (inside the timer callback) — a
 * single boot-time write disables the entire mechanism for the lifetime
 * of the page.
 *
 * Cost
 * ----
 * The PWA stays idle indefinitely on Greet (Marian stares at Melody for
 * minutes). With `autoSuspend = true`, Howler's `_autoSuspend` calls
 * `ctx.suspend()` which DOES save power (no audio thread running). With
 * `autoSuspend = false`, the audio thread keeps idling. On iOS the OS
 * itself manages audio session lifecycle independently — and our Phase-5
 * silent-buffer kick re-engages the OS audio session per gesture
 * regardless. The extra power draw of an idle running AudioContext is
 * negligible on modern hardware (Safari's Web Audio thread parks itself
 * when nothing is connected), well under the cost of letting the bug
 * persist.
 */
export interface DisableHowlerAutoSuspendResult {
  /**
   * Whether the property write succeeded. False when Howler is unreachable
   * or the property write threw (lockdown environments).
   */
  applied: boolean
  /** The value of `Howler.autoSuspend` BEFORE we wrote to it. */
  previousValue?: boolean
}

export interface DisableHowlerAutoSuspendOptions {
  /**
   * Test seam — the Howler-shaped target. Production omits this and we
   * write to the real `Howler` module singleton.
   */
  howlerLike?: { autoSuspend?: boolean }
}

export function disableHowlerAutoSuspend(
  opts: DisableHowlerAutoSuspendOptions = {},
): DisableHowlerAutoSuspendResult {
  const target =
    opts.howlerLike ?? (Howler as unknown as { autoSuspend?: boolean })
  let previousValue: boolean | undefined
  try {
    const raw = target.autoSuspend
    if (typeof raw === 'boolean') previousValue = raw
  } catch {
    // Property read threw (very unusual). Treat as unreachable — return
    // applied:false so callers know the disable did not land.
    return { applied: false }
  }
  try {
    target.autoSuspend = false
  } catch {
    // Property write threw — Howler frozen (Object.freeze) or otherwise
    // restricted. We can't disable autoSuspend; the bug will remain. Log
    // applied:false so the caller / probe can record the gap.
    return {
      applied: false,
      ...(previousValue !== undefined ? { previousValue } : {}),
    }
  }
  return {
    applied: true,
    ...(previousValue !== undefined ? { previousValue } : {}),
  }
}
