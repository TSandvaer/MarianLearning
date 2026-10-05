/**
 * Unlock-celebration lines (Emma's Path 5/10, ClickUp 123jpnbc3dn).
 *
 * `progress.pendingPromotion` holds the node Marian just MASTERED. The
 * celebration has to name the stage that mastery UNLOCKED — the next
 * node in the same tree — so the caption and Emma's spoken line both
 * come from `unlockCelebrationFor(mastered)` below, never from the
 * mastered node's own label.
 *
 * One short Lily line per unlockable stage ("Something new! <name>!"),
 * plus `hub.celebrate.you-did-it` for mastering the LAST stage of a tree
 * (nothing left to unlock). Names are child-facing and stay inside
 * Emma's capped vocabulary; the phonics stages name a picture word from
 * that stage's word pack ("Words like dog") instead of the phonics term.
 *
 * MP3s are bundled under `public/assets/audio/hub/` and rendered by
 * `scripts/renderHubCelebrateLily.ts` from `CELEBRATE_LINE_TEXT` — the
 * script reads this module, so the caption text and the audio cannot
 * drift apart.
 */

import { nextNode, type SkillNode } from '../../lib/progress'
import { trackOf } from '../../lib/progress/mastery'

/** Every stage that can be unlocked (= every node except each tree's first). */
export type UnlockableNode = Exclude<SkillNode, 'number-recog' | 'letter-names'>

export type HubCelebrateLineId =
  | `hub.celebrate.${UnlockableNode}`
  | 'hub.celebrate.you-did-it'

/** Child-facing name of each unlockable stage — spoken AND shown. */
export const UNLOCKED_STAGE_NAMES: Record<UnlockableNode, string> = {
  // ── Number Garden ─────────────────────────────────────────────────────
  'add-to-10': 'Adding to ten',
  'add-to-20': 'Adding to twenty',
  'sub-to-10': 'Taking away to ten',
  'sub-to-20': 'Taking away to twenty',
  'two-digit-addsub-no-regroup': 'Bigger numbers',
  'two-digit-addsub-with-regroup': 'Even bigger numbers',
  'skip-counting': 'Skip counting',
  // Multiplication is repeated addition with no × symbol yet.
  'mult-2-5-10': 'Counting in groups',
  'mult-3-4': 'More groups',
  'mult-6-9': 'Bigger groups',
  // ── Word Song ─────────────────────────────────────────────────────────
  'letter-sounds': 'Letter sounds',
  'blending-cv': 'Blending sounds',
  'cvc-words': 'Reading words',
  'cvc-words-short-o': 'Words like dog',
  'cvc-words-short-u': 'Words like sun',
  'cvc-words-short-i': 'Words like pig',
  'cvc-words-short-e': 'Words like bed',
  'digraphs-sh': 'Words like ship',
  'digraphs-ch': 'Words like chip',
  'digraphs-th-voiceless': 'Words like thin',
  'sight-words': 'Sight words',
  'simple-sentences': 'Reading sentences',
}

/** Lead-in spoken before the stage name. */
export const CELEBRATE_LEAD = 'Something new!'

/** Line for mastering a tree's final stage (nothing left to unlock). */
export const CELEBRATE_DONE_TEXT = 'You did it!'

function isUnlockable(node: SkillNode): node is UnlockableNode {
  return node in UNLOCKED_STAGE_NAMES
}

/** Full spoken text per line id — the render script's input. */
export const CELEBRATE_LINE_TEXT: Record<HubCelebrateLineId, string> = {
  ...(Object.fromEntries(
    (Object.keys(UNLOCKED_STAGE_NAMES) as UnlockableNode[]).map((n) => [
      `hub.celebrate.${n}`,
      `${CELEBRATE_LEAD} ${UNLOCKED_STAGE_NAMES[n]}!`,
    ]),
  ) as Record<`hub.celebrate.${UnlockableNode}`, string>),
  'hub.celebrate.you-did-it': CELEBRATE_DONE_TEXT,
}

/** Bundled MP3 path (relative to `public/`) for a celebrate line id. */
export function celebrateLineSrc(id: HubCelebrateLineId): string {
  return `/assets/audio/hub/${id.replace(/\./g, '-')}.mp3`
}

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
