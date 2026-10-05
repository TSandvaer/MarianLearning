/**
 * Bud rows for the session-end bud beat (Emma's Path 9/10): which buds
 * were open before the session and which are open now. Pure.
 */

import type { NodeProgress } from '../../lib/progress/nodeProgress'

/** The new bud opens once the card has slid up. */
export const BUD_OPEN_DELAY_S = 0.35

export interface BudGroup {
  required: number
  /** Open before this session. */
  was: number
  /** Open now. */
  now: number
}

/** One group per vowel for per-vowel letter-sounds, else one group. */
export function budGroups(
  before: NodeProgress,
  after: NodeProgress,
): BudGroup[] {
  if (after.vowels !== undefined) {
    return after.vowels.map((v) => ({
      required: v.requiredDays,
      was: before.vowels?.find((b) => b.vowel === v.vowel)?.goodDays ?? 0,
      now: v.goodDays,
    }))
  }
  return [
    {
      required: after.requiredDays,
      was: Math.min(before.goodDays, after.goodDays),
      now: after.goodDays,
    },
  ]
}
