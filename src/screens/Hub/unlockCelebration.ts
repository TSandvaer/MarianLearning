/**
 * Mastered → unlocked lookup for the Hub celebration (ticket 123jpnbc3dn).
 * `progress.pendingPromotion` is the node just MASTERED; the celebration
 * names and speaks the next node in the same tree.
 */

import { nextNode, type SkillNode } from '../../lib/progress'
import { trackOf } from '../../lib/progress/mastery'
import {
  UNLOCKED_STAGE_NAMES,
  isUnlockable,
  type HubCelebrateLineId,
  type UnlockableNode,
} from './celebrationLines'

export interface UnlockCelebration {
  /** The stage the mastery unlocked, or null when a tree was finished. */
  unlocked: UnlockableNode | null
  /** Child-facing stage name for the caption highlight ('' when finished). */
  name: string
  /** Hub line Emma speaks. */
  lineId: HubCelebrateLineId
}

/**
 * What to celebrate after `mastered` was mastered: the next node in its
 * tree (via `nextNode`), or the "You did it!" line for a tree's last node.
 */
export function unlockCelebrationFor(mastered: SkillNode): UnlockCelebration {
  const track = trackOf(mastered)
  const next = track === null ? null : nextNode(track, mastered)
  if (next === null || !isUnlockable(next)) {
    return { unlocked: null, name: '', lineId: 'hub.celebrate.you-did-it' }
  }
  return {
    unlocked: next,
    name: UNLOCKED_STAGE_NAMES[next],
    lineId: `hub.celebrate.${next}`,
  }
}
