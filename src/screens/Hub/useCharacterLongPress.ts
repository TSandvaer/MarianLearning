/**
 * 3-second long-press on Hub character art (M2.5 — ticket 86c9kpjc7).
 *
 * Source-of-truth: ticket 86c9kpjc7 dispatch contract — "long-press
 * Hub greeting / character art for 3000ms opens the parent settings
 * page. Tap-and-release does NOT. Long-press of any other Hub element
 * does NOT."
 *
 * Why a separate hook from `useParentGateLongPress`
 * --------------------------------------------------
 * The pre-existing 2s corner-gate hook (Dave's research, screen-hub
 * spec § "Long-press detection") binds to a specific 96×96pt
 * invisible div in the top-right corner — its bounds-check uses the
 * element's `getBoundingClientRect()` to detect drift. The character-
 * art surface here is bigger and the spec timing is different (3s,
 * not 2s); reusing the hook with a duration prop would drag the
 * existing screen-hub tests into a parameterised shape they don't
 * need. Two narrow hooks, one purpose each.
 *
 * Behaviour
 * ---------
 *  - `onPointerDown` on the bound element starts a 3000ms timer.
 *  - `onPointerUp` / `onPointerCancel` / `onPointerLeave` cancels.
 *  - Timer completion fires `onComplete()` once.
 *  - `onPointerDown` calls `setPointerCapture()` so a small drift
 *    keeps the press registered.
 */

import { useCallback, useEffect, useRef } from 'react'

/** Duration the press must be sustained (ticket-locked). */
export const CHARACTER_LONG_PRESS_MS = 3000

export interface UseCharacterLongPressOptions {
  /** Fires when the press completes 3s on the bound element. */
  onComplete: () => void
  /** Test seam — defaults to `window.setTimeout`. */
  schedule?: (cb: () => void, ms: number) => unknown
  /** Test seam — defaults to `window.clearTimeout`. */
  cancelSchedule?: (h: unknown) => void
}

export interface CharacterLongPressProps {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onPointerLeave: () => void
}

export function useCharacterLongPress(
  opts: UseCharacterLongPressOptions,
): CharacterLongPressProps {
  const onCompleteRef = useRef(opts.onComplete)
  // Refresh the callback ref each render so closure-stale handlers
  // don't bite when the consumer passes an inline arrow.
  useEffect(() => {
    onCompleteRef.current = opts.onComplete
  })

  const scheduleRef = useRef(
    opts.schedule ??
      ((cb: () => void, ms: number) => window.setTimeout(cb, ms)),
  )
  const cancelScheduleRef = useRef(
    opts.cancelSchedule ?? ((h: unknown) => window.clearTimeout(h as number)),
  )
  useEffect(() => {
    if (opts.schedule) scheduleRef.current = opts.schedule
    if (opts.cancelSchedule) cancelScheduleRef.current = opts.cancelSchedule
  }, [opts.schedule, opts.cancelSchedule])

  const timerRef = useRef<unknown>(null)

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      cancelScheduleRef.current(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Tear-down on unmount.
  useEffect(() => {
    return () => cancelTimer()
  }, [cancelTimer])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Capture the pointer so a small drift keeps the press alive —
      // failure is non-fatal (older browsers / non-pointer envs).
      try {
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      cancelTimer()
      timerRef.current = scheduleRef.current(() => {
        timerRef.current = null
        try {
          onCompleteRef.current()
        } catch {
          // Defensive: a thrown callback shouldn't kill the screen.
        }
      }, CHARACTER_LONG_PRESS_MS)
    },
    [cancelTimer],
  )

  const onPointerUp = useCallback(() => {
    cancelTimer()
  }, [cancelTimer])

  const onPointerCancel = useCallback(() => {
    cancelTimer()
  }, [cancelTimer])

  const onPointerLeave = useCallback(() => {
    cancelTimer()
  }, [cancelTimer])

  return { onPointerDown, onPointerUp, onPointerCancel, onPointerLeave }
}
