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
 * `sub-to-10` (Kyle's spec §3, Dave's research §Q2 "skip CRA detour")
 * --------------------------------------------------------------------
 * The dot-card is a CRA representational layer scoped to addition only.
 * Per Dave's research, subtraction does NOT get the CRA visual scaffold —
 * the read-aloud carries the representational layer for sub-to-10. Pool
 * facts like `5 − 5 = 0` and `3 − 2 = 1` have BOTH operands ≤ 5, so
 * without an explicit op-gate the structural predicate would fire on them
 * and Marian would see a dot-card showing pips `5` and `5` (total 10)
 * for a problem whose correct answer is `0` — visually nonsensical for a
 * subtraction. The `op === '+'` gate at the top of `shouldShowDotCard`
 * is the belt-and-braces enforcement that prevents this. Belt = the
 * structural addends-≤-5 rule (still applies); braces = the op check
 * (catches subtraction explicitly so future tiers with addends-≤-5 also
 * stay out). See Kevin's audit §4 for the same recommendation.
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
 * flash. Both addends must be in `[1, 5]` AND `op === '+'` (the dot-card
 * is an addition-only CRA scaffold; sub-to-10 explicitly skips it per
 * Dave's research §Q2 / Kyle's spec §3).
 */
export function shouldShowDotCard(problem: MathProblem): boolean {
  // Op-gate FIRST — subtraction never shows the dot-card regardless of
  // operand sizes. See module header "sub-to-10" block for rationale.
  if (problem.op !== '+') return false
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
 * builder. Range `[1, 10]` covers both the dice-pip vocabulary (1–5) and
 * the ten-frame vocabulary (6–10) used by the sub-to-10 minuend scaffold
 * (`TenFrameCell`, ticket 86ca7kdw8 / spec §13.2).
 */
export const PIPS_TO_WORD: Readonly<Record<number, string>> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
}

// ── sub-to-10 minuend scaffold (ticket 86ca7kdw8 / spec §13) ─────────────

/**
 * Minuend pip range for the sub-to-10 subitising scaffold. The minuend
 * is rendered as a single value-conditional cell: a die face for 5
 * (existing `DotCardCell`) and a ten-frame for 6–10 (`TenFrameCell`).
 * Spec §13.2.2 / §13.3 S3 — the EASY-band minuend envelope is `[5, 10]`.
 */
export const MIN_SUB_MINUEND = 5 as const
export const MAX_SUB_MINUEND = 10 as const

/** Minuend values the sub-to-10 minuend scaffold renders. */
export type SubMinuendValue = 5 | 6 | 7 | 8 | 9 | 10

/**
 * Structural predicate for the sub-to-10 minuend scaffold (spec §13.3,
 * the S2 + S3 core — focus-node-free so the render layer can reuse it).
 *
 * Sibling to `shouldShowDotCard` but for SUBTRACTION: fires iff
 * `op === '-'` AND the minuend (`addendA` — the start-number for
 * `op === '-'`, per `sessionPlans.ts`'s documented legacy-name drift) is
 * in `[5, 10]`. The SUBTRAHEND (`addendB`) is deliberately ignored — the
 * scaffold shows ONLY the minuend (Dave's W10.1 research § Bottom-line 1;
 * the empty space where a second cell would sit represents the unknown
 * remainder, §13.1).
 *
 * This is the structural counterpart to `shouldShowDotCard`'s
 * "both addends ≤ 5 AND op === '+'". The op-gate is FIRST so an addition
 * problem never trips the minuend predicate even if its `addendA` happens
 * to be in `[5, 10]`.
 */
export function shouldShowSubMinuendCell(problem: MathProblem): boolean {
  // Op-gate FIRST — addition never shows the minuend cell regardless of
  // operand sizes (the add path has its own two-cell dot-card overlay).
  if (problem.op !== '-') return false
  const { addendA } = problem
  if (!Number.isInteger(addendA)) return false
  if (addendA < MIN_SUB_MINUEND || addendA > MAX_SUB_MINUEND) return false
  return true
}

/**
 * Type guard: `true` iff `n` is an integer minuend in `[5, 10]` — a value
 * the sub-to-10 minuend scaffold can render. Sibling to `isValidPips`.
 */
export function isValidSubMinuend(n: number): n is SubMinuendValue {
  return Number.isInteger(n) && n >= MIN_SUB_MINUEND && n <= MAX_SUB_MINUEND
}

/**
 * Convenience selector — returns the minuend value from a `MathProblem`
 * when it qualifies for the sub-to-10 minuend scaffold, `null` otherwise.
 * Callers that have already gated on `shouldShowSubMinuendCell(problem)`
 * can rely on the non-null result. The redundancy lets TypeScript narrow
 * the value to `SubMinuendValue` for the overlay's `minuend` prop without
 * a non-null assertion at the call site.
 */
export function subMinuendFromProblem(
  problem: MathProblem,
): SubMinuendValue | null {
  if (problem.op !== '-') return null
  const { addendA } = problem
  if (!isValidSubMinuend(addendA)) return null
  return addendA
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
