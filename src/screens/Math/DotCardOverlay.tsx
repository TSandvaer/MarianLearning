/**
 * DotCardOverlay — the absolutely-positioned subitising flash overlay
 * (ticket 86c9q5j9a).
 *
 * Mounts above the flower-row position when both addends ≤ 5. Holds for
 * ~700ms (the recognition window), then fades out so the flower row
 * cross-fades in. The component owns its own lifecycle; the parent
 * (Math.tsx) just decides whether to mount it (via `shouldShowDotCard`)
 * and is told via `onComplete` when the overlay has finished, so the
 * flower row can transition from `opacity:0` to `opacity:1`.
 *
 * Spec: `design/screen-math-subitising-prompt.md` §"Motion".
 *
 * Layout invariant
 * ----------------
 * The wrapper is `position: absolute` (Tailwind `absolute inset-0
 * pointer-events-none`). It overlays the flower-row position WITHOUT
 * adding to flow layout — the math-symbolic row above and the
 * math-chips row below MUST NOT shift when this mounts/unmounts. Spec
 * § "Layout-stability rule (load-bearing)".
 *
 * Page-hidden / pending-resume
 * ----------------------------
 * Driven via `setTimeout` for orchestration, but the timer is
 * cancelled and re-armed across visibility transitions so a backgrounded
 * window doesn't fire `onComplete` while Marian's iPad is asleep. Spec
 * § "First-read vs retry → What if Marian backgrounds…".
 *
 * Reduced-motion
 * --------------
 * When `reducedMotion` is true, the spring scale-in is replaced with an
 * instant opacity:1 mount and a longer hold (900ms vs 700ms). The total
 * visible window is unchanged (~1100ms). Spec § "Reduced-motion variant
 * of dot-card visible".
 */

import { useEffect, useRef, useState } from 'react'
import { m } from 'motion/react'
import { DotCardCell } from './DotCardCell'
import {
  DOT_CARD_FADE_IN_MS,
  DOT_CARD_HOLD_MS,
  DOT_CARD_FADE_OUT_MS,
  DOT_CARD_FADE_IN_SPRING,
  DOT_CARD_REDUCED_MOTION_HOLD_MS,
  type DotCardPipsCount,
} from './dotCard'

/**
 * Phase machine. Mount → fadingIn → holding → fadingOut → unmount.
 * Reduced-motion collapses `fadingIn` (no spring) into `holding` on
 * mount.
 */
type DotCardPhase = 'fadingIn' | 'holding' | 'fadingOut'

interface DotCardOverlayProps {
  /** Left addend pip count; must be valid (caller pre-validates). */
  pipsA: DotCardPipsCount
  /** Right addend pip count; must be valid (caller pre-validates). */
  pipsB: DotCardPipsCount
  /**
   * iPad/page-hidden gate. When `true`, the lifecycle timer pauses and
   * resumes from its current phase on visibility return. Wired from
   * Math.tsx's `useIsPageHidden()`.
   */
  pageHidden: boolean
  /**
   * `true` when `usePrefersReducedMotion()` is true at the screen
   * level. Skip the spring fade-in; hold for 900ms instead of 700ms.
   */
  reducedMotion: boolean
  /**
   * Fires once the dot-card has fully faded out (i.e. the flower row
   * should now be at full opacity). Math.tsx's flower-opacity gate
   * binds to this transition.
   */
  onComplete?: () => void
  /**
   * Test seam — when `true`, the lifecycle is short-circuited:
   * `onComplete` fires synchronously on mount and the visible cards
   * are still rendered for assertion convenience. Production never
   * sets this. Default `false`.
   */
  __testSkipLifecycle?: boolean
}

export function DotCardOverlay({
  pipsA,
  pipsB,
  pageHidden,
  reducedMotion,
  onComplete,
  __testSkipLifecycle = false,
}: DotCardOverlayProps) {
  /**
   * Initial phase — when reduced-motion is on, skip straight to
   * `holding` because the spring fade-in is collapsed to an instant
   * opacity:1 mount. Otherwise start at `fadingIn` for the full
   * 200ms spring sequence.
   */
  const [phase, setPhase] = useState<DotCardPhase>(
    reducedMotion ? 'holding' : 'fadingIn',
  )

  // Latch — `onComplete` must fire exactly once across the lifecycle,
  // even if React re-renders during phase transitions (StrictMode).
  const completedRef = useRef(false)

  // Test seam: synchronously fire onComplete and skip the timeline.
  useEffect(() => {
    if (!__testSkipLifecycle) return
    if (completedRef.current) return
    completedRef.current = true
    onComplete?.()
  }, [__testSkipLifecycle, onComplete])

  // Lifecycle orchestration. We use plain `setTimeout` and cancel/
  // restart on `pageHidden` flips so a backgrounded iPad doesn't fire
  // onComplete in the dark. The fade-in step is only scheduled when
  // we're not in reduced-motion (the initial phase already accounts
  // for that case).
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
          onComplete?.()
        }
      }, DOT_CARD_FADE_OUT_MS)
    }

    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }, [phase, pageHidden, reducedMotion, __testSkipLifecycle, onComplete])

  // Animation targets per phase. We drive these through Framer Motion
  // so the global `MotionConfig reducedMotion="user"` collapses springs
  // automatically when the system pref is set; our own `reducedMotion`
  // prop is the per-screen mirror that drives the timeline (length /
  // spring choice). Belt-and-suspenders.
  const animateTarget = (() => {
    if (phase === 'fadingOut') return { opacity: 0, scale: 0.92 }
    return { opacity: 1, scale: 1 }
  })()

  const transition = (() => {
    if (phase === 'fadingIn') {
      // Spring on the way in (full motion only).
      return DOT_CARD_FADE_IN_SPRING
    }
    if (phase === 'fadingOut') {
      // Tween on the way out — a spring would over-bounce and read as
      // ambivalent (spec § "Spring config" rationale).
      return { duration: DOT_CARD_FADE_OUT_MS / 1000, ease: 'easeOut' as const }
    }
    // Holding — no transition. The previous animate target sticks.
    return { duration: 0 }
  })()

  return (
    <m.div
      data-testid="math-dot-card"
      data-phase={phase}
      data-paused={pageHidden ? 'true' : 'false'}
      aria-hidden="true"
      // Absolute overlay — sits on top of the flower-row position
      // without participating in flow. `inset-0` would stretch over
      // the whole problem-display container (which is taller than the
      // dot-card needs to be); we instead let the wrapper contain its
      // own height via flex centering and pin to the existing flower-
      // row gap-band.
      className="
        pointer-events-none absolute left-0 right-0
        flex items-center justify-center gap-6
      "
      // The `top` position lines up with the flower-row's vertical
      // axis. Math.tsx's problem-display container uses
      // `flex flex-col items-center justify-center gap-6` with the
      // symbolic block above and the flowers below. We match the
      // flowers' band by using `bottom-0` on the absolute wrapper —
      // the inner flex centring handles the vertical alignment within
      // the available space below the symbolic row.
      style={{ top: 0, bottom: 0 }}
      // Initial / animate / exit shape: opacity-only on reduced-motion,
      // opacity + scale otherwise. The MotionConfig at the App root
      // honours the OS-level reduce-motion pref independently — our
      // explicit branch here covers the per-screen `reducedMotion`
      // prop the spec calls out (spec § "Reduced-motion path"). The
      // two redundancies don't conflict: when system reduce-motion
      // is on, `reducedMotion` is `true` and we send opacity-only
      // shapes; when system pref is off but we're in a deliberately
      // simplified mode (e.g. for unit tests), the same code path
      // applies.
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.92 }}
      animate={animateTarget}
      transition={transition}
    >
      <DotCardCell pips={pipsA} />
      <DotCardCell pips={pipsB} />
    </m.div>
  )
}
