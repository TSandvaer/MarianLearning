/**
 * Session-start timeout + prepared-session fallback (Emma's Path 1/10,
 * ClickUp 123jpnbc3dh).
 *
 * Problem
 * -------
 * A session-start request that carries planner hints (Math: `leitner` /
 * `slowFacts`; Word Song: `isGraduationSession` / non-fallback
 * `letterSoundsVowelStates`) bypasses the pre-baked canon and runs the
 * live Haiku planner + TTS. Measured on production 2026-10-04: ~15 s for
 * add-to-10 with review facts (Haiku alone 10.8–12.9 s). The canon path
 * for the same focus node answers in ~0.65–1 s. Math/Word Song hold their
 * problem area until the fetch settles, so a slow live plan is a long wait
 * in front of Marian.
 *
 * Contract
 * --------
 * The hinted request starts exactly as before (pre-warm on Greet / Hub, so
 * any latency the pre-warm hides still yields the personalised plan). The
 * caller calls {@link SessionStartFallbackHandle.startWaitTimer} once the
 * child is actually LOOKING at the waiting screen. If the hinted request
 * has not settled {@link SESSION_START_WAIT_TIMEOUT_MS} later, it is
 * aborted and a second request WITHOUT the hints is issued — which the
 * server serves from canon. The visible wait is therefore capped at
 * N + ~1 s instead of ~15 s.
 *
 * Why N = 5 s
 * -----------
 * - The canon path's healthy latency is ~0.65–1 s, so 5 s is >5× its
 *   p50: a hinted request the server ends up serving from canon (hint
 *   present but its directive inactive) settles long before the timer.
 * - The live hinted path measured 11–15 s, so at 5 s it is nowhere near
 *   finishing — waiting longer buys little chance of the personalised plan
 *   and costs the child seconds of staring at a waiting Emma.
 * - 5 s + ~1 s canon ≈ 6 s worst-case visible wait, inside the attention
 *   window for a "getting ready" beat at age 8, vs ~15 s today.
 * The timer counts VISIBLE wait only, so the Greet pre-warm (and the Hub
 * prefetch planned in Emma's Path 2/10) keep the Leitner/slow-fact plan
 * whenever they have hidden the latency.
 *
 * Requests without hints get no timer: the re-request would be identical.
 * Errors from the hinted request before the timer fires propagate
 * unchanged (existing silent-fallback path in App.tsx).
 */

/** Visible-wait budget before the hinted session-start is abandoned. */
export const SESSION_START_WAIT_TIMEOUT_MS = 5000

export interface SessionStartFallbackResult<T> {
  prepared: T
  /** `true` when the hinted request timed out and the hint-free
   *  (canon) re-request produced `prepared`. */
  usedFallback: boolean
}

export interface SessionStartFallbackHandle<T> {
  readonly promise: Promise<SessionStartFallbackResult<T>>
  /** Start the visible-wait timer. Idempotent; a no-op once settled, when
   *  the request carried no hints, or when the parent signal aborted. */
  startWaitTimer: () => void
}

export interface StartSessionWithFallbackArgs<T> {
  /** Whether the first request carries canon-bypassing planner hints. */
  hasHints: boolean
  /** Issue one session-start request. `withHints === false` must strip
   *  every canon-bypassing hint. Must reject when `signal` aborts. */
  run: (withHints: boolean, signal: AbortSignal) => Promise<T>
  /** Parent signal — aborting it aborts whichever request is in flight. */
  signal: AbortSignal
  /** Override for tests. Defaults to {@link SESSION_START_WAIT_TIMEOUT_MS}. */
  timeoutMs?: number
  /** Called when the timer fires and the fallback request is issued. */
  onFallback?: () => void
}

function linkedController(parent: AbortSignal): AbortController {
  const c = new AbortController()
  if (parent.aborted) c.abort()
  else parent.addEventListener('abort', () => c.abort(), { once: true })
  return c
}

export function startSessionWithFallback<T>(
  args: StartSessionWithFallbackArgs<T>,
): SessionStartFallbackHandle<T> {
  const timeoutMs = args.timeoutMs ?? SESSION_START_WAIT_TIMEOUT_MS
  let settled = false
  let fellBack = false
  let timer: ReturnType<typeof setTimeout> | undefined

  let resolveOuter!: (r: SessionStartFallbackResult<T>) => void
  let rejectOuter!: (e: unknown) => void
  const promise = new Promise<SessionStartFallbackResult<T>>((res, rej) => {
    resolveOuter = res
    rejectOuter = rej
  })
  const finish = (fn: () => void) => {
    if (settled) return
    settled = true
    if (timer !== undefined) clearTimeout(timer)
    fn()
  }

  const primary = linkedController(args.signal)
  args.run(args.hasHints, primary.signal).then(
    (prepared) => {
      // A primary that slipped past its abort after the fallback started
      // is dropped, NOT unloaded: session audio is a singleton and the
      // fallback's load replaces it (unloading here would kill the
      // fallback's howls).
      if (fellBack) return
      finish(() => resolveOuter({ prepared, usedFallback: false }))
    },
    (err: unknown) => {
      if (fellBack) return
      finish(() => rejectOuter(err))
    },
  )

  const startWaitTimer = () => {
    if (!args.hasHints || settled || fellBack || timer !== undefined) return
    if (args.signal.aborted) return
    timer = setTimeout(() => {
      if (settled || args.signal.aborted) return
      fellBack = true
      primary.abort()
      args.onFallback?.()
      const fallback = linkedController(args.signal)
      args.run(false, fallback.signal).then(
        (prepared) =>
          finish(() => resolveOuter({ prepared, usedFallback: true })),
        (err: unknown) => finish(() => rejectOuter(err)),
      )
    }, timeoutMs)
  }

  return { promise, startWaitTimer }
}
