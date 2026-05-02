/**
 * Shared character render — Emma's `<m.img>` with pose-driven tilt,
 * spring physics, idle breathing, and reduce-motion handling.
 *
 * Spec: `design/character/motion-brief.md` (Phase 3b motion brief, ticket
 * 86c9kwh66, merged in PR #121).
 *
 * Why a shared component
 * ----------------------
 * Pre-this-component, Math.tsx, WordSong.tsx, Hub.tsx, Greet.tsx, and
 * SessionEnd.tsx each rendered Emma's `<m.img>` directly with their own
 * (sometimes drifting) animate / transition / initial / exit configs. The
 * motion brief specifies a single shape for the pose-swap choreography,
 * so this component owns it — every screen passes a pose, the spring +
 * tilt + breathing fall out automatically.
 *
 * Greet (entrance choreography) and SessionEnd (cheering one-shot) are
 * intentionally NOT migrated here. Per the brief §"Implementation order"
 * item 7, Greet's slide-in stays untouched; per §"Deliberately deferred",
 * Session-End's `emma-cheering.svg` is a one-shot beat, not pose-state-
 * machine driven, and lives outside the brief.
 *
 * Bundle posture
 * --------------
 * Uses `m.img` under the global `LazyMotion features={domAnimation}` at
 * the App root. Adds `< 0.1 KB` per the brief's measurement — within the
 * 4.6 KB iPad LazyMotion budget called out in CLAUDE.md.
 */

import { AnimatePresence, m } from 'motion/react'
import type { ComponentPropsWithoutRef, ReactElement } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import {
  BREATHING_PERIOD_S,
  BREATHING_SCALE_KEYFRAMES,
  CELEBRATION_DURATION_S,
  CELEBRATION_TILT_EASES,
  CELEBRATION_TILT_KEYFRAMES,
  CELEBRATION_TILT_TIMES,
  TILT_BY_POSE,
  TILT_SPRING_BY_POSE,
  type EmmaPose,
} from '../lib/character/emmaPose'

/**
 * Pass-through props that the host screen still controls. Notably:
 *
 * - `data-testid` — each screen wants its own (`math-emma`, `word-song-emma`,
 *   `hub-emma`, etc.) so QA queries don't collide across screens.
 * - `className` — sizing / positioning are layout-driven and stay with the
 *   host. The component pins motion + transform-origin only.
 * - `onPointerDown` / `onPointerUp` / `onPointerMove` etc. — Hub's M2.5
 *   long-press parent-gate hangs off the `<m.img>` directly via spread.
 */
export interface EmmaCharacterProps
  // We intentionally do NOT extend MotionProps directly — callers pass
  // raw HTML img attributes plus `data-*` and event handlers, and the
  // motion props (initial/animate/transition/exit) are controlled here.
  //
  // The animation-event handlers (`onAnimationStart`/`onAnimationEnd`/
  // `onAnimationIteration`) are excluded because Framer Motion's
  // `m.img` re-types them with a non-DOM signature
  // (callback receives an `AnimationDefinition`, not a CSS
  // `AnimationEvent`). Callers don't need them on the character; if a
  // future caller does, plumb them through explicitly with the Framer
  // signature rather than the DOM one.
  extends Omit<
    ComponentPropsWithoutRef<'img'>,
    // Reserve these for the shared motion config — callers cannot
    // override them without a code-review escape hatch.
    | 'src'
    | 'alt'
    | 'draggable'
    // Typed differently by Framer Motion — see comment above.
    | 'onAnimationStart'
    | 'onAnimationEnd'
    | 'onAnimationIteration'
    // Drag handlers also collide between DOM and Framer Motion shapes.
    | 'onDrag'
    | 'onDragEnd'
    | 'onDragStart'
  > {
  /** Current pose. Drives the rendered SVG and the rotateZ tilt. */
  pose: EmmaPose
  /** Optional alt text override. Defaults to "Emma". */
  alt?: string
  /**
   * Optional Framer Motion `layoutId`. Pass `"emma"` on every host
   * screen so the shared-element transition between screens carries
   * Emma's bounding box across mount/unmount.
   */
  layoutId?: string
  /**
   * Optional override for the SVG src. Defaults to
   * `/assets/emma-${pose}.svg` so the pose-keyed asset pipeline drives
   * what's drawn. The override exists for one-shot screens (e.g.
   * Session-End uses `emma-cheering.svg` regardless of `pose`) — those
   * screens generally don't use this component, but the prop is here
   * for the rare case.
   */
  src?: string
}

/**
 * Render Emma with the canonical motion brief shape:
 *
 *   - Per-pose `rotateZ` from `TILT_BY_POSE` with a spring per
 *     `TILT_SPRING_BY_POSE[pose]`.
 *   - Idle breathing loop on `pose === 'idle'`: scale `[1, 1.02, 1]`
 *     over 4s, infinite, ease-in-out.
 *   - Cross-fade pose-swap on opacity (200ms in / 150ms out — same
 *     shape the existing screens used).
 *   - `transformOrigin: '50% 100%'` (feet) per §3.5 — the brief
 *     prefers feet-pivot so breathing rises naturally; the small head-
 *     displacement difference at ±6° to ±10° is acceptable per Kyle's
 *     measurement note.
 *   - Honours `prefers-reduced-motion` via the project's own
 *     `usePrefersReducedMotion` hook (chosen over Framer Motion's
 *     `useReducedMotion` for consistency with every other screen and
 *     for reliable vitest matchMedia-stub handling): rotateZ collapses
 *     to 0, breathing collapses to scale 1, opacity cross-fade still
 *     plays at 200ms.
 *
 * `data-pose` and `data-wiggling` are wired automatically so existing
 * QA selectors (notably WordSong's celebration-pose tests) keep working.
 */
export function EmmaCharacter({
  pose,
  alt = 'Emma',
  layoutId,
  src,
  className,
  style,
  ...rest
}: EmmaCharacterProps): ReactElement {
  // Project's own `usePrefersReducedMotion` is preferred over Framer
  // Motion's `useReducedMotion()` because (a) consistent with every other
  // screen — single source-of-truth — and (b) Framer's hook reads from a
  // module-init signal that doesn't always pick up vitest's `matchMedia`
  // stub the way the project hook (which reads `window.matchMedia` per-
  // mount) does. Test reliability matters here.
  const reducedMotion = usePrefersReducedMotion()

  const tilt = TILT_BY_POSE[pose] ?? 0
  const spring = TILT_SPRING_BY_POSE[pose]
  const isIdle = pose === 'idle'
  // Celebration uses a keyframed tilt-out → hold → tilt-back sequence
  // instead of the per-pose spring. Iteration #2 (ticket 86c9kxmqb):
  // the hold beat at -6° is what makes the celebrate pose visible —
  // a spring-only motion had no time AT the apex, so Marian saw the
  // start of the tilt and then it was already returning.
  const isCelebration = pose === 'celebration'
  const resolvedSrc = src ?? `/assets/emma-${pose}.svg`

  // `data-wiggling` is the historical marker WordSong's tests rely on to
  // assert the celebration tilt is firing. Renamed semantics (was a
  // 600ms keyframe wiggle, now the spring-tilt) but the data attribute
  // stays so tests don't churn. True iff a non-idle pose is active and
  // motion is enabled.
  const wiggling = !reducedMotion && pose !== 'idle'

  return (
    <AnimatePresence initial={false}>
      <m.img
        {...rest}
        layoutId={layoutId}
        key={pose}
        data-pose={pose}
        data-wiggling={wiggling ? 'true' : 'false'}
        src={resolvedSrc}
        alt={alt}
        draggable={false}
        className={className}
        style={{ transformOrigin: '50% 100%', ...style }}
        initial={
          reducedMotion ? { opacity: 0 } : { opacity: 0, rotate: 0, scale: 1 }
        }
        animate={{
          opacity: 1,
          rotate: reducedMotion
            ? 0
            : isCelebration
              ? [...CELEBRATION_TILT_KEYFRAMES]
              : tilt,
          scale: isIdle && !reducedMotion ? [...BREATHING_SCALE_KEYFRAMES] : 1,
        }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        transition={{
          opacity: { duration: 0.2 },
          rotate: reducedMotion
            ? { duration: 0 }
            : isCelebration
              ? {
                  // Keyframed tilt-out → hold → tilt-back. The hold
                  // beat at -6° (between times[1] and times[2]) is
                  // Thomas's iteration-#2 ask for apex visibility.
                  duration: CELEBRATION_DURATION_S,
                  times: [...CELEBRATION_TILT_TIMES],
                  ease: [...CELEBRATION_TILT_EASES],
                }
              : {
                  type: 'spring',
                  stiffness: spring.stiffness,
                  damping: spring.damping,
                },
          scale:
            isIdle && !reducedMotion
              ? {
                  duration: BREATHING_PERIOD_S,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
              : { duration: 0 },
        }}
      />
    </AnimatePresence>
  )
}

export default EmmaCharacter
