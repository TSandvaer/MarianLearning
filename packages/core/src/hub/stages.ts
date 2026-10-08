/**
 * Stage taxonomy + sliding-window helper for the Hub picker's path strips.
 *
 * Pure data + utility — split out from `stageIcons.tsx` so React Fast
 * Refresh's "components-only export" rule stays clean (the .tsx file
 * exports only the StageIcon React component now).
 *
 * Source-of-truth: `design/screen-hub.md` § "Skill-tree picker — node
 * design" + `CLAUDE.md`'s "Two skill trees" section (canonical stage
 * order).
 */

export type NumberGardenStageId =
  | 'number-recog'
  | 'add-to-10'
  | 'add-to-20'
  | 'subtract-to-10'
  | 'subtract-to-20'
  // Wave 5 (ticket 86c9y0bvc) — `'two-digit'` stage split into
  // adjacent `'two-digit-no-regroup'` + `'two-digit-with-regroup'`
  // siblings mirroring the SkillNode-level split. Stage IDs keep the
  // path-strip shorthand (`'two-digit'` was already a shortening of
  // SkillNode `'two-digit-addsub'`); the new literals follow the same
  // pattern (drop the `-addsub` infix for display). Hub path-strip
  // index correspondence with `MATH_NODES_IN_ORDER` stays 1:1.
  | 'two-digit-no-regroup'
  | 'two-digit-with-regroup'
  | 'skip-counting'
  | 'multiply-2-5-10'
  | 'multiply-3-4'
  | 'multiply-6-9'

export type WordSongStageId =
  | 'letter-names'
  | 'letter-sounds'
  | 'blending-cv'
  | 'cvc-words'
  | 'cvc-words-short-o'
  | 'cvc-words-short-u'
  | 'cvc-words-short-i'
  | 'cvc-words-short-e'
  | 'digraphs-sh'
  | 'digraphs-ch'
  | 'digraphs-th-voiceless'
  | 'sight-words'
  | 'simple-sentences'

export type StageId = NumberGardenStageId | WordSongStageId

/** Display order for each tree — drives the sliding-window logic. */
export const NUMBER_GARDEN_STAGES: NumberGardenStageId[] = [
  'number-recog',
  'add-to-10',
  'add-to-20',
  'subtract-to-10',
  'subtract-to-20',
  // Wave 5 sibling-tier split — adjacent placement mirrors
  // `MATH_NODES_IN_ORDER` (no-regroup THEN with-regroup) so the
  // path-strip cell index for either stage equals the SkillNode
  // index, keeping `projectHubTreeProgress` correct without any
  // mapping table.
  'two-digit-no-regroup',
  'two-digit-with-regroup',
  'skip-counting',
  'multiply-2-5-10',
  'multiply-3-4',
  'multiply-6-9',
]

export const WORD_SONG_STAGES: WordSongStageId[] = [
  'letter-names',
  'letter-sounds',
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
  'digraphs-sh',
  'digraphs-ch',
  'digraphs-th-voiceless',
  'sight-words',
  'simple-sentences',
]

/**
 * Compute the 5-node sliding window centred on the current stage index.
 *
 * Edge cases (per `design/screen-hub.md` § "Sliding window — which 5
 * stages render"):
 *  - currentIndex === 0 → offset 0 (no leftward slot).
 *  - currentIndex near the end → right edge of window aligns with
 *    last stage.
 */
export function slidingWindow<T>(
  stages: readonly T[],
  currentIndex: number,
  size = 5,
): { items: T[]; offset: number } {
  if (stages.length === 0) return { items: [], offset: 0 }
  const desiredOffset = currentIndex - 1
  const maxOffset = Math.max(0, stages.length - size)
  const offset = Math.max(0, Math.min(maxOffset, desiredOffset))
  const items: T[] = []
  for (let i = offset; i < Math.min(stages.length, offset + size); i++) {
    items.push(stages[i])
  }
  return { items, offset }
}
