/**
 * SubMinuendOverlay — the absolutely-positioned single-cell minuend
 * subitising flash for the sub-to-10 scaffold (ticket 86ca7kdw8 / spec
 * §13.1).
 *
 * Sibling to `DotCardOverlay` (the add-to-10 two-cell overlay), but for
 * SUBTRACTION: it shows EXACTLY ONE cell — the minuend (the start-number
 * Marian counts back from). No subtrahend cell, no operator glyph, no "?"
 * cell. The empty space where a second cell would go is intentional —
 * it represents the unknown remainder (Dave's W10.1 research § Bottom-
 * line 1 / § Recommendations-for-Kyle #1; §13.1).
 *
 * Value-conditional primitive (§13.2.2):
 *   - minuend 5      → `<DotCardCell pips={5} />` (canonical die-5 face;
 *                      Marian already reads die-5 reliably — switching her
 *                      to a ten-frame-5 would COST recognition)
 *   - minuend 6–10   → `<TenFrameCell pips={…} />` (five-anchor ten-frame)
 *
 * Lifecycle is IDENTICAL to the add path — it reuses the `DOT_CARD_*`
 * constants and the same fadingIn → holding → fadingOut → onComplete
 * phase machine (§13.0 "Reveal pattern / Reduced-motion — Unchanged;
 * single cell uses the same DOT_CARD_* lifecycle constants; only one cell
 * mounts instead of two"). The cell is STATIC from mount — no pip-fade,
 * no animation of the subtraction action (Dave's W10.1 research §4 — no
 * peer-reviewed basis for animated removal; it replaces instantaneous
 * recognition with sequential attention and adds a timed mechanic at
 * decision time, an anti-dark-pattern risk).
 *
 * Layout invariant
 * ----------------
 * Same absolute-overlay strategy as `DotCardOverlay`. The wrapper is
 * `position: absolute … pointer-events-none` so it overlays the problem-
 * display gap WITHOUT adding to flow layout — the symbolic row above and
 * the chip row below MUST NOT shift when this mounts/unmounts. Per
 * §13.2.3 the single ten-frame cell (~170pt) is NARROWER than the add
 * path's two 80pt cells + 24pt gap (184pt), so the overlay never exceeds
 * the existing horizontal envelope.
 *
 * Reduced-motion
 * --------------
 * When `reducedMotion` is true, the spring scale-in is replaced with an
 * instant opacity:1 mount and a longer hold (reusing
 * `DOT_CARD_REDUCED_MOTION_HOLD_MS`). The total visible window is
 * unchanged (~1100ms), identical to the add path.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { m } from 'motion/react'
import { DotCardCell } from './DotCardCell'
import { TenFrameCell, type TenFramePipsCount } from './TenFrameCell'
import {
  DOT_CARD_FADE_IN_MS,
  DOT_CARD_HOLD_MS,
  DOT_CARD_FADE_OUT_MS,
  DOT_CARD_FADE_IN_SPRING,
  DOT_CARD_REDUCED_MOTION_HOLD_MS,
} from './dotCard'
import type { SubMinuendValue } from './dotCard'

/** Phase machine — identical to `DotCardOverlay`. */
type SubMinuendPhase = 'fadingIn' | 'holding' | 'fadingOut'

interface SubMinuendOverlayProps {
  /** Minuend value (the start-number); caller pre-validates to `[5, 10]`. */
  minuend: SubMinuendValue
  /**
   * iPad/page-hidden gate. When `true`, the lifecycle timer pauses and
   * resumes from its current phase on visibility return. Wired from
   * Math.tsx's page-hidden state (same as `DotCardOverlay`).
   */
  pageHidden: boolean
  /**
   * `true` when `usePrefersReducedMotion()` is true at the screen level.
   * Skip the spring fade-in; hold longer instead.
   */
  reducedMotion: boolean
  /**
   * Fires once the minuend cell has fully faded out. Math.tsx's per-
   * problem dismiss gate binds to this transition (same contract as
   * `DotCardOverlay.onComplete`).
   */
  onComplete?: () => void
  /**
   * Test seam — when `true`, the lifecycle is FROZEN: phase stays at its
   * initial value, no timers are armed, and `onComplete` is NEVER fired.
   * The cell stays rendered indefinitely so spec count selectors can
   * assert against it without racing the dismissal cascade. Forwarded
   * from Math.tsx's `__testDisableDotCard` prop; production never sets it.
   */
  __testSkipLifecycle?: boolean
}

export function SubMinuendOverlay({
  minuend,
  pageHidden,
  reducedMotion,
  onComplete,
  __testSkipLifecycle = false,
}: SubMinuendOverlayProps) {
  const [phase, setPhase] = useState<SubMinuendPhase>(
    reducedMotion ? 'holding' : 'fadingIn',
  )

  // `onComplete` must fire exactly once across the lifecycle even under
  // StrictMode re-renders.
  const completedRef = useRef(false)

  // Stable ref to `onComplete` so the lifecycle effect doesn't re-arm on
  // every parent render (Math.tsx passes a fresh inline arrow per render).
  // Same rationale as `DotCardOverlay`'s `onCompleteRef` — the callback is
  // write-only, so we read it via the ref and OMIT it from the effect dep
  // array to avoid timer drift.
  const onCompleteRef = useRef(onComplete)
  useLayoutEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // Lifecycle orchestration — plain setTimeout, cancelled/re-armed on
  // pageHidden flips so a backgrounded iPad doesn't fire onComplete in
  // the dark. Mirrors `DotCardOverlay`.
  useEffect(() => {
    if (__testSkipLifecycle) return
    if (pageHidden) return // suspended; resume effect re-arms below

    let timeoutId: ReturnType<typeof setTimeout> | undefined

    if (phase === 'fadingIn') {
      timeoutId = setTimeout(() => {
        setPhase('holding')
      }, DOT_CARD_FADE_IN_MS)
    } else if (phase === 'holding') {
      const holdMs = reducedMotion
        ? DOT_CARD_REDUCED_MOTION_HOLD_MS
        : DOT_CARD_HOLD_MS
      timeoutId = setTimeout(() => {
        setPhase('fadingOut')
      }, holdMs)
    } else if (phase === 'fadingOut') {
      timeoutId = setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true
          onCompleteRef.current?.()
        }
      }, DOT_CARD_FADE_OUT_MS)
    }

    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
    // `onComplete` intentionally OMITTED — read via the ref (see above).
  }, [phase, pageHidden, reducedMotion, __testSkipLifecycle])

  const animateTarget =
    phase === 'fadingOut'
      ? { opacity: 0, scale: 0.92 }
      : { opacity: 1, scale: 1 }

  const transition = (() => {
    if (phase === 'fadingIn') return DOT_CARD_FADE_IN_SPRING
    if (phase === 'fadingOut') {
      return { duration: DOT_CARD_FADE_OUT_MS / 1000, ease: 'easeOut' as const }
    }
    return { duration: 0 }
  })()

  return (
    <m.div
      data-testid="math-sub-minuend-card"
      data-phase={phase}
      data-paused={pageHidden ? 'true' : 'false'}
      data-minuend={minuend}
      aria-hidden="true"
      className="
        pointer-events-none absolute left-0 right-0
        flex items-center justify-center
      "
      style={{ top: 0, bottom: 0 }}
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.92 }}
      animate={animateTarget}
      transition={transition}
    >
      {/* Value-conditional primitive (§13.2.2): die-5 for the minuend 5,
          ten-frame for 6–10. */}
      {minuend === 5 ? (
        <DotCardCell pips={5} />
      ) : (
        <TenFrameCell pips={minuend as TenFramePipsCount} />
      )}
    </m.div>
  )
}
