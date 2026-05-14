/**
 * Pure projections from the persisted `Progress` document into the
 * shapes Hub.tsx renders.
 *
 * Why this lives next to Hub
 * --------------------------
 * The progress library owns the canonical schema (`SkillNode`, `SkillLevels`,
 * etc.). The Hub-specific path-strip needs an INDEX (number of mastered
 * nodes from the start of each track) and the celebration component needs
 * a HUMAN LABEL. These are display projections — they belong with the
 * consumer (Hub) rather than next to the data.
 *
 * Tests live in `progressProjection.test.ts` to keep Hub.test.tsx focused
 * on the screen-level orchestration.
 */

import type {
  NumberGardenNode,
  Progress,
  SkillLevels,
  SkillNode,
  WordSongNode,
} from '../../lib/progress'
import {
  MATH_NODES_IN_ORDER,
  WORD_SONG_NODES_IN_ORDER,
} from '../../lib/progress'
import type { HubTreeProgress } from './Hub'

/**
 * Walk `track` in declaration order, count consecutive `'mastered'`
 * nodes from the start, return that count as the "current index" for
 * the Hub path-strip's sliding window.
 *
 * Rationale: the path-strip's `currentIndex` is the FIRST non-mastered
 * node — same projection `pickFocusNode()` uses internally. By counting
 * mastered nodes from the start, the result is the index of the first
 * non-mastered node. If everything is mastered, the index is the length
 * of the track (one past the last node) — the sliding-window helper
 * clamps that to the last cell, so the visual is correct.
 */
function countMasteredFromStart(
  levels: SkillLevels,
  order: readonly SkillNode[],
): number {
  let count = 0
  for (const node of order) {
    if (levels[node] === 'mastered') count += 1
    else break
  }
  return count
}

/**
 * Project a Progress document onto the per-tree indices Hub needs to
 * render the path-strips.
 *
 * Returns the default `{ numberGardenIndex: 0, wordSongIndex: 0 }` when
 * `progress` is null (first-run / private-mode storage). The Hub default
 * already handles this case visually; we keep the shape consistent so
 * the App.tsx caller can pass it through unconditionally.
 */
export function projectHubTreeProgress(
  progress: Progress | null,
): HubTreeProgress {
  if (progress === null) {
    return { numberGardenIndex: 0, wordSongIndex: 0 }
  }
  return {
    numberGardenIndex: countMasteredFromStart(
      progress.skillLevels,
      MATH_NODES_IN_ORDER,
    ),
    wordSongIndex: countMasteredFromStart(
      progress.skillLevels,
      WORD_SONG_NODES_IN_ORDER,
    ),
  }
}

/**
 * Human-readable label for a SkillNode — used in the celebration caption
 * ("You unlocked add-to-20!") and could be used elsewhere later.
 *
 * Labels mirror the on-curriculum names a parent would recognise. The
 * canonical IDs (`add-to-10`, `cvc-words`, etc.) live in the schema; the
 * display strings live here so a tweak to copy doesn't churn the schema.
 */
const NUMBER_GARDEN_LABELS: Record<NumberGardenNode, string> = {
  'number-recog': 'number recognition',
  'add-to-10': 'add to 10',
  'add-to-20': 'add to 20',
  'sub-to-10': 'subtract to 10',
  'sub-to-20': 'subtract to 20',
  'two-digit-addsub': 'two-digit add and subtract',
  'skip-counting': 'skip counting',
  'mult-2-5-10': 'multiply by 2, 5, 10',
  'mult-3-4': 'multiply by 3 and 4',
  'mult-6-9': 'multiply by 6 to 9',
}

const WORD_SONG_LABELS: Record<WordSongNode, string> = {
  'letter-names': 'letter names',
  'letter-sounds': 'letter sounds',
  'blending-cv': 'blending sounds',
  'cvc-words': 'CVC words',
  'cvc-words-short-o': 'CVC words (short o)',
  'cvc-words-short-u': 'CVC words (short u)',
  'cvc-words-short-i': 'CVC words (short i)',
  'cvc-words-short-e': 'CVC words (short e)',
  // Digraphs split into 3 sequential sibling nodes per PR #211.
  'digraphs-sh': 'digraphs (sh)',
  'digraphs-ch': 'digraphs (ch)',
  'digraphs-th-voiceless': 'digraphs (th)',
  'sight-words': 'sight words',
  'simple-sentences': 'simple sentences',
}

export function labelForSkillNode(node: SkillNode): string {
  if (node in NUMBER_GARDEN_LABELS) {
    return NUMBER_GARDEN_LABELS[node as NumberGardenNode]
  }
  if (node in WORD_SONG_LABELS) {
    return WORD_SONG_LABELS[node as WordSongNode]
  }
  // Defensive fallback — return the raw id rather than throw, so a
  // future node added to the schema before its label is added here
  // doesn't brick the celebration screen.
  return node
}
