/**
 * What Math's and Word Song's session starts share for the same-day review
 * and the daily warm-up (native spec
 * `design/native/review-mode-and-warmup-native.md` § 7.4): the wire refs,
 * the prefetch mode and the review plan check.
 */
import type { FocusMode } from '@marian/core/progress'
import type {
  CanonBlockRef,
  SessionPlanKind,
} from '@marian/core/progress/reviewPlan'
import {
  REVIEW_PLAN_ID_PREFIX,
  type CanonBlockRef as WireCanonBlockRef,
} from '@marian/core/wire/types'

/** A ref as the wire carries it. */
export function wireRef(r: CanonBlockRef): WireCanonBlockRef {
  return { node: r.node, problem: r.problem }
}

/** The payload fields of a session's plan kind: `review` or `warmup`. */
export function planKindFields(
  planKind: SessionPlanKind,
): Record<string, unknown> {
  if (planKind.kind === 'review') {
    return { review: { blocks: planKind.blocks.map(wireRef) } }
  }
  return planKind.warmup.length > 0
    ? { warmup: { blocks: planKind.warmup.map(wireRef) } }
    : {}
}

/**
 * The prefetch mode of a session: `review` for a review, `<mode>+warmup`
 * with warm-up refs, else the focus mode as before.
 */
export function planModeOf(hints: {
  focusMode: FocusMode | undefined
  planKind: SessionPlanKind
}): string | undefined {
  if (hints.planKind.kind === 'review') return 'review'
  return hints.planKind.warmup.length > 0
    ? `${hints.focusMode}+warmup`
    : hints.focusMode
}

/** Is `plan` a review response's plan (`plan.id` starts `review-`)? */
export function isReviewPlan(plan: unknown): boolean {
  return (
    typeof plan === 'object' &&
    plan !== null &&
    typeof (plan as { id?: unknown }).id === 'string' &&
    (plan as { id: string }).id.startsWith(REVIEW_PLAN_ID_PREFIX)
  )
}
