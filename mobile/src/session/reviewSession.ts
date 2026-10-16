/**
 * What Math's and Word Song's session starts share for the same-day review
 * and the daily warm-up (native spec
 * `design/native/review-mode-and-warmup-native.md` § 7.4): the wire refs,
 * the prefetch mode and the review plan check; and the step intro lead
 * line (`design/native/content-wave-1.md` § 6.1).
 */
import type { FocusMode, Progress, SkillNode } from '@marian/core/progress'
import type {
  CanonBlockRef,
  SessionPlanKind,
} from '@marian/core/progress/reviewPlan'
import {
  REVIEW_PLAN_ID_PREFIX,
  type CanonBlockRef as WireCanonBlockRef,
} from '@marian/core/wire/types'
import { introGuideLine, type IntroGuideLineId } from '../audio'

/** A ref as the wire carries it. */
export function wireRef(r: CanonBlockRef): WireCanonBlockRef {
  return { node: r.node, problem: r.problem }
}

/** The payload fields of a session's plan kind: `review`, or `warmup` and
 *  (a times mix) `mix`. */
export function planKindFields(
  planKind: SessionPlanKind,
): Record<string, unknown> {
  if (planKind.kind === 'review') {
    return { review: { blocks: planKind.blocks.map(wireRef) } }
  }
  return {
    ...(planKind.warmup.length > 0
      ? { warmup: { blocks: planKind.warmup.map(wireRef) } }
      : {}),
    // Content wave 1 § 2.4: a times mix names its 8 blocks.
    ...(planKind.mix !== undefined
      ? { mix: { blocks: planKind.mix.map(wireRef) } }
      : {}),
  }
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
  const warm = hints.planKind.warmup.length > 0 ? '+warmup' : ''
  const mix = hints.planKind.mix !== undefined ? '+mix' : ''
  return warm === '' && mix === ''
    ? hints.focusMode
    : `${hints.focusMode}${warm}${mix}`
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

/**
 * The step intro a session plays before its scored problem 1 (content wave
 * 1 § 6.1): `node`'s intro line in a forward session while the step is not
 * mastered; `null` for a review, a step without an intro, or a mastered
 * step (a parent's pin or the QA picker can put one in focus).
 */
export function sessionIntroFor(
  progress: Pick<Progress, 'skillLevels'> | null,
  node: SkillNode | undefined,
  planKind: SessionPlanKind,
): IntroGuideLineId | null {
  if (planKind.kind === 'review' || node === undefined) return null
  if (progress?.skillLevels[node] === 'mastered') return null
  return introGuideLine(node)
}
