/**
 * Which problems draw the take-away picture, and what lifted it
 * (`design/native/take-away-picture.md` K1, K3, K6). Pure; `TakeAwayRow`
 * draws it.
 */
import type { ExtendedMathProblem } from '@marian/core/math/extendedProblems'
import { takeAwaySlots, type TakeAwaySlots } from '@marian/core/math/takeAway'
import type { SkillNode } from '@marian/core/progress'

export type TakeAwayStep = 'sub-to-10' | 'sub-to-20'
/** What lifted the taken flowers: the read or hint 3, a right tap, the
 *  given answer. */
export type TakeAwayLift = 'normal' | 'fast' | 'instant'
export type TakeAwayRippleScope = 'all' | 'left'

export interface TakeAwayPicture {
  step: TakeAwayStep
  slots: TakeAwaySlots
}

/**
 * The picture of `problem` on its own step `node` (K1, K3): a subtraction on
 * sub-to-10 (one frame) or sub-to-20; `null` for anything else (two-digit
 * steps keep no counters, a borrow or a minuend over 19 draws nothing).
 */
export function takeAwayPicture(
  problem: ExtendedMathProblem | undefined,
  node: SkillNode | undefined,
): TakeAwayPicture | null {
  if (problem?.kind !== 'arithmetic' || problem.op !== '-') return null
  if (node !== 'sub-to-10' && node !== 'sub-to-20') return null
  const slots = takeAwaySlots(problem.addendA, problem.addendB)
  if (slots === null || (node === 'sub-to-10' && slots.frames === 2))
    return null
  return { step: node, slots }
}

const LIFT_RANK: Record<TakeAwayLift, number> = {
  normal: 1,
  fast: 2,
  instant: 3,
}

/** The stronger of two lifts (`instant` > `fast` > `normal`). */
export function strongerLift(
  a: TakeAwayLift | null,
  b: TakeAwayLift | null,
): TakeAwayLift | null {
  if (a === null) return b
  if (b === null) return a
  return LIFT_RANK[b] > LIFT_RANK[a] ? b : a
}
