/**
 * Focus-node selection — Milestone 2 of the adaptive engine (ticket
 * 86c9kmwba). Pure functions; the browser calls these once at session-start
 * fetch time and ships the result on the `/api/claude` payload.
 *
 * Why this lives in `src/lib/progress/`
 * -------------------------------------
 * The progress module owns the persisted `Progress` document and the helpers
 * that read it. Picking the current focus node is a read-only projection of
 * `skillLevels` filtered by track ordering — it belongs next to the data,
 * not in the audio-wiring layer where the `/api/claude` POST happens.
 *
 * Mastery-promotion is intentionally NOT here
 * -------------------------------------------
 * M2 reads `skillLevels` as-is. The promotion logic ("did Marian master
 * `add-to-10` this session?") is M3's responsibility (separate ticket).
 * Today, every selector call walks the static tree-order list and returns
 * the first node whose level is not `mastered`. If everything is mastered
 * (won't happen in v1 — `add-to-20` and onwards are `locked`), we return
 * the last node in the track so the call site never has to handle a null.
 *
 * Track ordering
 * --------------
 * Per `CLAUDE.md` `## Two skill trees` and `types.ts NumberGardenNode` /
 * `WordSongNode` declaration order. The constants below mirror that order
 * exactly; if a node is added to either union, add it here too. The unit
 * test pins the sequences against the type so a silent drift fails CI.
 */

import type {
  NumberGardenNode,
  Progress,
  SkillNode,
  WordSongNode,
} from './types'

export type ProgressTrack = 'math' | 'word-song'

/**
 * The math track in declaration order. First entry is the lowest-level
 * skill; the focus picker walks left-to-right and stops at the first
 * non-mastered entry. If you reorder this list you reorder the curriculum
 * — coordinate with `MATH_FOCUS_NODE_GUIDE` in `api/_planner.ts`.
 */
export const MATH_NODES_IN_ORDER: readonly NumberGardenNode[] = [
  'number-recog',
  'add-to-10',
  'add-to-20',
  'sub-to-10',
  'sub-to-20',
  'two-digit-addsub',
  'skip-counting',
  'mult-2-5-10',
  'mult-3-4',
  'mult-6-9',
]

/**
 * The word-song track in declaration order. Same contract as
 * MATH_NODES_IN_ORDER.
 */
export const WORD_SONG_NODES_IN_ORDER: readonly WordSongNode[] = [
  'letter-names',
  'letter-sounds',
  'blending-cv',
  'cvc-words',
  'digraphs',
  'sight-words',
  'simple-sentences',
]

/**
 * Pick the current focus node for `track`. Walks the track's nodes in
 * declaration order and returns the first whose `skillLevels[node]` is
 * anything other than `'mastered'`.
 *
 * Falls back to the LAST node in the track if all are mastered. This will
 * not happen in v1 (Marian still has `locked` nodes near the end of every
 * track), but the fallback keeps the return type non-null so the call
 * site stays narrow.
 *
 * Word-song un-clamp (planner-parser contract step 2, ticket 86c9kxu07)
 * ---------------------------------------------------------------------
 * The clamp from the original P0 fix (ticket 86c9kt47v) was a temporary
 * shim while the browser parser only accepted the CVC "Tap the <word>."
 * template. PR #132 (step 1, ticket 86c9kxp08) widened the parser to
 * also accept "Read the <word>." → cvc-word; this PR (step 2) widens the
 * planner to emit that content. The picker is now safe to walk the
 * LITERACY_TREE — same shape as the math walker.
 *
 * Tier coverage today:
 *   - blending-cv → first-class (planner emits "Tap the <word>.")
 *   - cvc-words   → first-class (planner emits "Read the <word>.")
 *   - letter-sounds / digraphs / sight-words / simple-sentences →
 *     stub plans (planner falls back to blending-cv content with a
 *     non-error log; future tier-content tickets refine these).
 *
 * That stub fallback is what makes it safe to surface those nodes from
 * the picker in v1: a wrong-tier walk yields a working session, not a
 * silent screen.
 */
export function pickFocusNode(
  progress: Progress,
  track: ProgressTrack,
): SkillNode {
  const order =
    track === 'math' ? MATH_NODES_IN_ORDER : WORD_SONG_NODES_IN_ORDER
  for (const node of order) {
    if (progress.skillLevels[node] !== 'mastered') return node
  }
  // Defensive fallback — every node mastered. Won't happen in v1; the
  // adaptive engine M3+ will move children past this point and pick up new
  // tracks. Until then, return the last node so the caller has a string.
  return order[order.length - 1]!
}

/**
 * Compute the mean `successRate` over the last 3 history entries that
 * touched a node in `track`. Returns `null` when there are zero matching
 * entries — the planner uses null to distinguish "no data" from "abysmal
 * (0.0)".
 *
 * Filtering rule: an entry counts when ANY skill in `entry.skillFocus`
 * appears in the track's node list. Entries with empty `skillFocus`
 * cannot be attributed and are ignored.
 *
 * "Last 3" is by `Progress.history` insertion order (most recent at the
 * end — see `saveProgress`'s trim semantics). We slice the matching
 * subset, take the LAST 3 of that subset, then average.
 */
export function pickRecentSuccessRate(
  progress: Progress,
  track: ProgressTrack,
): number | null {
  const order =
    track === 'math' ? MATH_NODES_IN_ORDER : WORD_SONG_NODES_IN_ORDER
  const trackSet = new Set<SkillNode>(order)

  // Filter to entries that touched at least one node in this track.
  const matching = progress.history.filter((entry) =>
    entry.skillFocus.some((node) => trackSet.has(node)),
  )
  if (matching.length === 0) return null

  // Take the last 3 matching entries (or all of them if <3).
  const window = matching.slice(-3)
  const sum = window.reduce((acc, entry) => acc + entry.successRate, 0)
  return sum / window.length
}
