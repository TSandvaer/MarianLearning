/**
 * Invisible 2-second corner long-press for the parent-area gate.
 *
 * Source-of-truth: `design/screen-hub.md` § "Parent area" + § "Long-press
 * detection — Devon's contract (v1)". Backed by Dave's research at
 * `design/research/hub-navigation-research-86c9hab6y.md` Q4: 2-second
 * sustained press on a non-default child gesture, outside Marian's natural
 * play zone.
 *
 * v1 behaviour
 * ------------
 *  - On `pointerdown` inside the corner zone: start a 2-second timer.
 *  - On `pointermove` that drifts outside the zone: cancel timer.
 *  - On `pointerup` / `pointercancel`: cancel timer (silent — no state).
 *  - On 2-second completion: fire `onComplete()`. v1 default no-ops with
 *    a `console.log` so Jessica/QA can verify; v2 navigates to a real
 *    parent area.
 *
 * Discoverability protection
 * --------------------------
 * No visible affordance is rendered — the hook returns props for a
 * 96×96pt invisible div in the top-right corner. The `data-testid` is
 * present for tests but the element is `aria-hidden` and visually
 * empty. Short taps in the same zone do nothing — no audio, no
 * animation, no log.
 */

import { useCallback, useEffect, useRef } from 'react'

/** How long the press must sustain to fire `onComplete` (Dave-locked). */
export const PARENT_GATE_LONG_PRESS_MS = 2000

export interface UseParentGateLongPressOptions {
  /** Fires when the press completes 2s in-zone. */
  onComplete: () => void
  /**
   * Test seam — defaults to `window.setTimeout`. The hook always passes
   * `PARENT_GATE_LONG_PRESS_MS` as the delay, so tests can advance an
   * injected fake clock to trigger completion.
   */
  schedule?: (cb: () => void, ms: number) => unknown
  /** Test seam — defaults to `window.clearTimeout`. */
  cancelSchedule?: (h: unknown) => void
}

/** Props the consumer spreads onto the invisible corner element. */
export interface ParentGateProps {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerLeave: () => void
}

/**
 * Build the pointer-event handlers for the invisible parent-gate zone.
 *
 * The zone's spatial bounds are encoded by the consumer's CSS
 * (top-right, 96×96pt, fixed positioning); the hook only checks
 * `e.currentTarget`-relative coordinates via the synthetic event's
 * `getBoundingClientRect()`. A `pointermove` whose pointer leaves the
 * element bounds cancels the timer — same behaviour as a `pointerleave`.
 */
export function useParentGateLongPress(
  opts: UseParentGateLongPressOptions,
): ParentGateProps {
  const onCompleteRef = useRef(opts.onComplete)
  // Refresh the ref on each render so the latest callback is invoked
  // when the timer eventually fires. (Avoids tearing if the consumer
  // passes an inline arrow that captures stale state.)
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
  // Refresh injected schedulers across renders so a parent that
  // re-creates them per-render still works (rare; mostly a test seam).
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

  // Tear down on unmount.
  useEffect(() => {
    return () => cancelTimer()
  }, [cancelTimer])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Defensive: capture pointer to the corner element so the OS keeps
      // delivering pointermove/up to us even if Marian drags slightly.
      // Failure to set capture is non-fatal (older browsers).
      try {
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      cancelTimer()
      timerRef.current = scheduleRef.current(() => {
        timerRef.current = null
        // Default v1 surface — caller may override with a real
        // navigation; v2 wires the parent area here.

        console.log('[Hub] parent-gate long-press detected (v1 no-op)')
        try {
          onCompleteRef.current()
        } catch {
          // Defensive: a thrown callback shouldn't kill the screen.
        }
      }, PARENT_GATE_LONG_PRESS_MS)
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
    // Drag-out cancels the press — mirror the `pointercancel` surface.
    cancelTimer()
  }, [cancelTimer])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (timerRef.current === null) return
      // If the pointer drifts outside the element's bounding rect,
      // cancel. The bounding rect is the hook's source of truth for
      // "is the press still in-zone" — the consumer's CSS sets the
      // 96×96 corner, so the rect is whatever Tailwind produced.
      const rect = (e.currentTarget as Element).getBoundingClientRect()
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      if (!inside) cancelTimer()
    },
    [cancelTimer],
  )

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerMove,
    onPointerLeave,
  }
}
