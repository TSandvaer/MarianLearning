/**
 * React hook — bridge `visibilitychange` to `Howler.ctx.suspend()` /
 * `resume()`. Mounted once at the App root.
 *
 * Ticket 86c9kxtmu (Jessica e2e batch — Bug B). On `hidden`, suspend
 * the AudioContext so any in-flight Howler `play()` parks rather than
 * decoding into a silent void. On `visible`, the recovery path differs
 * by ctx state — see "Round 2 (gesture-deferred recovery)" below.
 *
 * Why suspend at all (the iPad story)
 * -----------------------------------
 * iOS Safari PWA pauses the JS event loop on full app-switch /
 * lock-screen — the in-flight `setTimeout` callbacks freeze. But on
 * shorter "background" events (Control Center pull, notification
 * banner) the JS keeps running while the audio session may have been
 * preempted by the system; the sound goes nowhere. Explicitly
 * suspending the WebAudio context is the canonical Howler-ish way to
 * pause cleanly.
 *
 * Round 2 (gesture-deferred recovery — PR #137 iteration 2)
 * --------------------------------------------------------
 * The iteration-1 fix called `ctx.resume()` + `unlockIosAudioSession()`
 * inside this `visibilitychange` handler. Thomas's iPad PWA repro
 * proved that DOES NOT WORK on real hardware:
 *
 *   t=281565 visibility-visible-post → ctxState: "suspended"  ← resume() fired
 *   t=281566 visibility-recovery-buffer → bufferStarted: true  ← buffer fired
 *   t=281600 play-utterance-dispatch → ctxState: "suspended"  ← STILL DEAD
 *   t=281601 howl-play-event → ctxState: "suspended"  ← silent
 *
 * `visibilitychange` is a SYSTEM event, not a user gesture. iOS
 * Safari's WebAudio session lock requires the resume + buffer-play to
 * happen INSIDE the synchronous body of a real user-gesture handler.
 * The handler here runs at the right time but the ctx never actually
 * transitions to `running`; downstream `play()` calls return a soundId
 * but emit no audio.
 *
 * The round-2 fix — the `pendingResumeGate` singleton in
 * `lib/audio/pendingResumeGate.ts`:
 *
 *   1. Hidden edge: still call `ctx.suspend()`. Suspending IS allowed
 *      from a system event — it parks the audio session cleanly.
 *
 *   2. Visible edge with state in `'suspended'` / `'interrupted'`:
 *      `markPendingResume()` instead of trying to resume. Production
 *      `playSessionUtterance` and `playHubLine` consult `isPendingResume()`
 *      and queue dispatches instead of firing into a still-suspended
 *      context. A 3 s fallback timer transitions the gate to
 *      `'awaiting-tap'` so App.tsx can render a "tap to continue"
 *      affordance if Marian doesn't tap on her own.
 *
 *   3. The ACTUAL `resume()` + `unlockIosAudioSession()` runs inside
 *      the next user gesture's synchronous handler — chip-tap in
 *      Math/WordSong, hub-node tap in Hub, "tap to continue" tap on
 *      the affordance. Those handlers call `drainOnGesture()`, which
 *      runs resume + unlock + drains the queued utterance, all inside
 *      the gesture's JS task.
 *
 * Why we still call `ctx.suspend()` from this handler
 * ---------------------------------------------------
 * `suspend()` is allowed from a system event — its job is just to park
 * the session. The asymmetry is real: WebKit allows suspend out-of-
 * gesture but binds resume to a gesture. We benefit from the
 * synchronous suspend (cleaner state) and gesture-defer the resume.
 *
 * Diagnostic instrumentation
 * --------------------------
 * Probe rows bracket the suspend/resume calls (`'visibility-hidden-pre'`,
 * `'visibility-hidden-post'`, `'visibility-visible-pre'`,
 * `'visibility-visible-post'`) and one row marks the recovery-deferred
 * decision (`'visibility-recovery-buffer'` with `bufferStarted: false`
 * meaning "we marked pending, didn't try to play"). The audioCtxLog
 * mirror lets Thomas paste back the timeline from a real iPad repro.
 *
 * No-op when `Howler.ctx` is unavailable (SSR, jsdom without WebAudio,
 * Howler hasn't lazy-initted yet). Safe to mount unconditionally.
 */

import { useEffect } from 'react'
import { Howler } from 'howler'

import { subscribeToVisibilityChange, getIsPageHidden } from './pageVisibility'
import {
  recordVisibilityRecoveryBufferEvent,
  recordVisibilityTransitionEvent,
} from '../debug/audioContextProbe'
import { markPendingResume } from '../audio/pendingResumeGate'

/**
 * Mount-once hook. Subscribes to visibility changes and bridges them
 * to `Howler.ctx.suspend()` (on hide) / `markPendingResume()` (on
 * show, when ctx state needs gesture-defer recovery). Returns nothing.
 *
 * Idempotent across renders (the effect's empty-deps array pins the
 * subscription to the mount lifetime). Production callers mount this
 * exactly once at the App root.
 */
export function useHowlerSuspendOnHide(): void {
  useEffect(() => {
    return subscribeToVisibilityChange(() => {
      const hidden = getIsPageHidden()
      const ctx = readHowlerCtx()

      if (hidden) {
        // hidden-pre: ctxState reflects whatever iOS handed us at the
        // exact instant of the visibilitychange dispatch. On real iPad
        // we expect to see 'running' here (we haven't suspended yet)
        // unless iOS already preempted the audio session.
        recordVisibilityTransitionEvent('hidden-pre')
        if (ctx) suspendCtxSafely(ctx)
        // hidden-post: state after our suspend() invocation — the
        // diagnostic question is whether the suspend transitioned the
        // context synchronously or left it on iOS's
        // not-yet-transitioned bucket.
        recordVisibilityTransitionEvent('hidden-post')
      } else {
        // visible-pre: ctxState BEFORE we make any recovery decision.
        // This is the load-bearing diagnostic — if iPad delivers
        // `'interrupted'` or `'suspended'` here, we MUST defer the
        // resume to the next user gesture (round-2 fix). Trying to
        // resume here from this system event was the iteration-1 bug
        // Thomas's iPad capture exposed.
        recordVisibilityTransitionEvent('visible-pre')
        const stateBefore = ctx ? readState(ctx) : 'unavailable'
        recordVisibilityTransitionEvent('visible-post')

        // Round-2 gesture-deferred recovery: mark the gate as pending
        // when ctx state is `'suspended'` or `'interrupted'`. Both
        // states require a fresh user gesture on iOS — `suspended` is
        // the standard WebAudio idle bucket (also gesture-bound to
        // resume), `interrupted` is the iOS-only audio-session-preempt
        // state (also gesture-bound). The round-1 fix gated on
        // `interrupted` only and tried to resume both inline; Thomas's
        // capture proved neither path worked.
        //
        // The buffer "fires" semantically (we record the row for the
        // probe timeline) but `bufferStarted: false` on the recorded
        // row tells Thomas's iPad export that we DEFERRED the kick to
        // the gesture window — distinguishing this round-2 path from
        // the round-1 round-trip-already-tried fallacy.
        if (stateBefore === 'suspended' || stateBefore === 'interrupted') {
          markPendingResume()
          // bufferStarted=false: round-2 contract — the actual buffer
          // play is gesture-deferred. The presence of this row + a
          // following gesture-driven `unlock-state` row is the
          // diagnostic pair Thomas's iPad export should show on a
          // recovered session.
          recordVisibilityRecoveryBufferEvent(false)
        } else if (ctx) {
          // ctx is `'running'` already (no iOS preempt this round) or
          // `'closed'` (don't touch). We don't fire resume() in either
          // case — the running case has nothing to resume; the closed
          // case rejects.
          //
          // Note: on a `'running'` ctx we deliberately DO NOT call
          // resume() even though it would be a no-op. iOS occasionally
          // emits a duplicate `statechange` for redundant resume calls,
          // polluting the diagnostic stream.
        }
      }
    })
  }, [])
}

interface HowlerLike {
  ctx?: AudioContext | null
}

function readHowlerCtx(): AudioContext | null {
  try {
    const ctx = (Howler as unknown as HowlerLike).ctx
    return ctx ?? null
  } catch {
    return null
  }
}

function readState(ctx: AudioContext): string {
  try {
    return ctx.state as unknown as string
  } catch {
    return 'unavailable'
  }
}

function suspendCtxSafely(ctx: AudioContext): void {
  // Don't suspend an already-suspended/closed context.
  const state = readState(ctx)
  if (state !== 'running') return
  try {
    const result = ctx.suspend()
    // Some implementations return undefined; defensively swallow
    // rejections so we never leak unhandled-promise warnings.
    if (result && typeof (result as Promise<void>).catch === 'function') {
      ;(result as Promise<void>).catch(() => {
        /* ignored */
      })
    }
  } catch {
    /* ignored — best-effort */
  }
}
