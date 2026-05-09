/**
 * Subitising dot-card scope predicate (ticket 86c9q5j9a).
 *
 * Pure function. Decides whether the dot-card overlay (`DotCardOverlay`)
 * fires for a given Math problem. Per Kyle's spec
 * (`design/screen-math-subitising-prompt.md` § "Trigger condition"), the
 * rule is structural — both addends ≤ 5 — and explicitly NOT coupled to
 * Leitner state, accuracy history, or any other dynamic signal.
 *
 * Why structural-only (no `focusNode` parameter today)
 * ----------------------------------------------------
 * Kyle's spec mentions checking `focusNode === 'add-to-10'` as
 * belt-and-suspenders. In v1, the addends-only rule incidentally scopes
 * to `add-to-10`'s problem space because the only other math focus node
 * routed through Math.tsx today is `add-to-20`, whose plans always carry
 * at least one addend ≥ 6 (sum ≥ 11). Subtraction / multiplication / two-
 * digit nodes do not yet route through Math.tsx's `addendA + addendB`
 * shape. Plumbing `focusNode` through the screen-prop API would expand
 * the dispatch contract beyond the files-in-play list (App.tsx is not
 * in scope for this ticket).
 *
 * Forward-compat: if a future math node ever produces both-addends-≤-5
 * problems that should NOT fire the dot-card, extend this signature with
 * a `focusNode` parameter and gate on it. The `MAX_PIPS_PER_CELL = 5`
 * constant below pins the dice-pip vocabulary ceiling — the rule must
 * stay aligned with the rendering primitive.
 *
 * Spec invariant: `shouldShowDotCard` must be deterministic and side-
 * effect-free so the screen can call it in render without state sync.
 */

import type { MathProblem } from './sessionPlans'

/**
 * Discriminating union for valid pip counts. Exported from this pure
 * module rather than `DotCardCell.tsx` so non-component callers (e.g.
 * `Math.tsx`'s render-time `pipsFromProblem` selector) can import the
 * type without pulling in the React component file. Mirrors the dice-
 * pip range — see `MAX_PIPS_PER_CELL` below.
 */
export type DotCardPipsCount = 1 | 2 | 3 | 4 | 5

/**
 * The dot-card vocabulary tops out at 5 pips per cell — a canonical die
 * has six faces, but the spec's dice-pip layout is defined for 1..5 only
 * (six pips would render as a 2×3 grid which is a different visual
 * primitive; see spec § "Visual style decision" and § "Non-obvious
 * findings to surface" item 6).
 *
 * Both addends must satisfy `addend <= MAX_PIPS_PER_CELL` for the dot-
 * card to fire. Addends ≥ 6 are out of scope.
 */
export const MAX_PIPS_PER_CELL = 5 as const

/**
 * Lower bound on a representable pip count. The Math focus nodes that
 * route through this screen (`add-to-10`, `add-to-20`) emit addends
 * `≥ 1` per `_planner.ts` MATH_TRACK_GUIDE, but we guard against future
 * planner drift defensively rather than implicitly trust the upstream.
 */
export const MIN_PIPS_PER_CELL = 1 as const

/**
 * Returns `true` when the problem qualifies for a dot-card overlay
 * flash. Both addends must be in `[1, 5]`.
 */
export function shouldShowDotCard(problem: MathProblem): boolean {
  const { addendA, addendB } = problem
  if (!Number.isInteger(addendA) || !Number.isInteger(addendB)) return false
  if (addendA < MIN_PIPS_PER_CELL || addendA > MAX_PIPS_PER_CELL) return false
  if (addendB < MIN_PIPS_PER_CELL || addendB > MAX_PIPS_PER_CELL) return false
  return true
}

/**
 * Spelled-out lowercase number word for ARIA labels on dot-card cells.
 * Kept inline here (vs. lifting from sessionPlans.ts's `numberWord`) so
 * the dot-card module has zero coupling to the session-plan utterance
 * builder. Range `[1, 5]` matches `MAX_PIPS_PER_CELL`.
 */
export const PIPS_TO_WORD: Readonly<Record<1 | 2 | 3 | 4 | 5, string>> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
}

/**
 * Lifecycle constants for the dot-card overlay (per spec § "Motion").
 *
 * These are exported so component-level tests can pin the timeline
 * without the Math screen having to expose internal effect timers.
 *
 * Full-motion timeline:
 *   t=0      : mount; spring fade-in begins (220/22, scale 0.92→1)
 *   t=200    : fade-in completes; hold begins
 *   t=900    : fade-out begins (200ms tween easeOut)
 *               ↳ flowers begin cross-fade-in (250ms tween easeOut)
 *   t=1100   : dot-card unmounts; flowers settle at 50ms past
 *
 * Reduced-motion timeline (opacity-only, ~1100±50ms total):
 *   t=0      : mount at full opacity (no spring)
 *   t=900    : fade-out begins (200ms opacity-only tween)
 *               ↳ flowers begin cross-fade-in (250ms opacity-only tween)
 *   t=1100   : dot-card unmounts
 */
export const DOT_CARD_FADE_IN_MS = 200
export const DOT_CARD_HOLD_MS = 700
export const DOT_CARD_FADE_OUT_MS = 200
export const DOT_CARD_FLOWER_FADE_MS = 250
/**
 * Total visible window — `t = mount → unmount`. Equal to fade-in + hold
 * + fade-out. Flower cross-fade overlaps the last 200ms of the dot-card
 * fade-out and extends 50ms past the dot-card unmount.
 */
export const DOT_CARD_TOTAL_MS =
  DOT_CARD_FADE_IN_MS + DOT_CARD_HOLD_MS + DOT_CARD_FADE_OUT_MS

/**
 * When `usePrefersReducedMotion()` returns true, the spring fade-in is
 * skipped (no scale, no spring) and the lost in/out flourishes are
 * absorbed into a longer hold so the total visible window stays ~1100ms.
 * Spec § "Reduced-motion variant of dot-card visible".
 */
export const DOT_CARD_REDUCED_MOTION_HOLD_MS = 900
export const DOT_CARD_REDUCED_MOTION_TOTAL_MS =
  DOT_CARD_REDUCED_MOTION_HOLD_MS + DOT_CARD_FADE_OUT_MS

/**
 * Spring config for the fade-in. Mirrors `EmmaCharacter`'s celebration
 * spring family so the screen's motion vocabulary stays coherent (see
 * `emmaPose.ts` `TILT_SPRING_BY_POSE.celebration`). Spec § "Spring
 * config".
 */
export const DOT_CARD_FADE_IN_SPRING = {
  type: 'spring' as const,
  stiffness: 220,
  damping: 22,
}

/**
 * Type guard: `true` iff `n` is an integer in `[1, MAX_PIPS_PER_CELL]`,
 * i.e. a value the `<DotCardCell>` component can render.
 */
export function isValidPips(n: number): n is DotCardPipsCount {
  return Number.isInteger(n) && n >= MIN_PIPS_PER_CELL && n <= MAX_PIPS_PER_CELL
}

/**
 * Convenience selector — returns the `[addendA, addendB]` pair from a
 * `MathProblem` when both are valid pip counts; `null` otherwise.
 *
 * Callers that have already gated on `shouldShowDotCard(problem)` can
 * rely on the non-null result. The redundancy lets TypeScript narrow
 * the tuple type for `<DotCardOverlay>`'s `pipsA` / `pipsB` props
 * without any non-null assertion at the call site.
 */
export function pipsFromProblem(
  problem: MathProblem,
): readonly [DotCardPipsCount, DotCardPipsCount] | null {
  const { addendA, addendB } = problem
  if (!isValidPips(addendA) || !isValidPips(addendB)) return null
  return [addendA, addendB] as const
}
