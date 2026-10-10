/**
 * Session-start visible-wait timeout with a hint-free re-request. Native
 * copy of the web's `src/lib/audio/sessionStartFallback.ts` (Emma's Path
 * 1/10, 123jpnbc3dh), which is DOM-free but lives in the web app, not in
 * `@marian/core`.
 *
 * A session-start that carries canon-bypassing planner hints (Math:
 * `leitner` / `slowFacts`) runs the live planner: ~15 s measured on
 * production. The request starts early (on Greet) exactly as before; once
 * the child is LOOKING at the waiting screen the caller starts the wait
 * timer, and if the hinted request has not settled
 * {@link SESSION_START_WAIT_TIMEOUT_MS} later it is aborted and a request
 * WITHOUT the hints is issued, which the server serves from canon (~1 s).
 * Requests without hints get no timer (the re-request would be the same).
 * Errors from the hinted request before the timer fires propagate.
 */

/** Visible-wait budget before the hinted session-start is abandoned. */
export const SESSION_START_WAIT_TIMEOUT_MS = 5000

export interface SessionStartFallbackResult<T> {
  prepared: T
  /** `true` when the hint-free re-request produced `prepared`. */
  usedFallback: boolean
}

export interface SessionStartFallbackHandle<T> {
  readonly promise: Promise<SessionStartFallbackResult<T>>
  /**
   * Start the visible-wait timer. Idempotent; a no-op once settled, when
   * the request carried no hints, or when the parent signal aborted.
   */
  startWaitTimer: () => void
}

export interface StartSessionWithFallbackArgs<T> {
  /** Whether the first request carries canon-bypassing planner hints. */
  hasHints: boolean
  /**
   * Issue one session-start request. `withHints === false` must strip
   * every canon-bypassing hint. Must reject when `signal` aborts.
   */
  run: (withHints: boolean, signal: AbortSignal) => Promise<T>
  /** Parent signal: aborting it aborts whichever request is in flight. */
  signal: AbortSignal
  /** Test override. Defaults to {@link SESSION_START_WAIT_TIMEOUT_MS}. */
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
      // fallback's load replaces it.
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
