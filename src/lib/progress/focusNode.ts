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

import { CVC_CROSS_VOWEL_NODES, cvcReviewEligible } from './mastery'
import type {
  NumberGardenNode,
  Progress,
  SkillNode,
  WordSongNode,
} from './types'

export type ProgressTrack = 'math' | 'word-song'

/**
 * The mode the focus picker selected the node under (ticket 86c9qa6n3).
 *
 * - `'forward'`: ordinary curriculum progression — the first non-mastered
 *   node in the track. The historical-and-still-default behaviour.
 * - `'cvc-review'`: a MASTERED CVC tier deliberately re-surfaced for a
 *   cross-vowel review session. The caller (App.tsx) uses this to allow
 *   cross-vowel mode through its `focusIsCvcTier` gate even though the
 *   node is mastered (which the forward picker would have walked past).
 */
export type FocusMode = 'forward' | 'cvc-review'

/**
 * The focus picker's result (ticket 86c9qa6n3). Widened from a bare
 * `SkillNode` so the caller can distinguish a forward-progression pick
 * from a CVC-review pick — the latter intentionally lands on a MASTERED
 * node, which App.tsx's `focusIsCvcTier` gate must let through so
 * cross-vowel distractor mixing actually fires.
 */
export interface FocusPick {
  node: SkillNode
  mode: FocusMode
}

/**
 * The three CVC tiers eligible for review-mode round-robin, in vowel
 * order (a → o → u). Re-exported from the cross-vowel source of truth in
 * `mastery.ts` so the picker and the distractor-matrix scope can never
 * drift apart.
 */
export const CVC_TIERS: readonly WordSongNode[] = CVC_CROSS_VOWEL_NODES

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
  // Wave 5 (ticket 86c9y0bvc): `'two-digit-addsub'` split into a
  // no-regroup tier (existing behaviour — preserves the current
  // canon, prompt block, and pool) followed by a with-regroup tier
  // (new pedagogical band; PR B wires canon + planner + debug seed).
  // The siblings are adjacent so Marian's path-strip walk stays
  // contiguous: master no-regroup → unlock with-regroup → master
  // with-regroup → unlock skip-counting.
  'two-digit-addsub-no-regroup',
  'two-digit-addsub-with-regroup',
  'skip-counting',
  'mult-2-5-10',
  'mult-3-4',
  'mult-6-9',
]

/**
 * The word-song track in declaration order. Same contract as
 * MATH_NODES_IN_ORDER.
 *
 * cvc-words = short-a CVC. Subsequent vowels get sibling nodes
 * (cvc-words-short-o, cvc-words-short-u, cvc-words-short-i,
 * cvc-words-short-e, …). This was a deliberate backward-compat choice
 * — see design/word-song/short-o-pool-expansion.md §2 (and
 * design/word-song/short-u-pool-expansion.md §2 for the short-u tier
 * added under ticket 86c9q9ben,
 * design/word-song/short-i-pool-expansion.md §2 for the short-i tier
 * added under ticket 86c9qdba4, and
 * design/word-song/short-e-pool-expansion.md §1 for the short-e tier
 * — the final single-vowel tier — added under ticket 86c9teua2).
 *
 * Digraphs are split into three sequential sibling nodes (sh → ch →
 * th-voiceless) per the architecture proposal PR #211. The dead single
 * `digraphs` literal that previously sat between `cvc-words-short-e`
 * and `sight-words` is dropped in this PR; the mastery + focus-picker
 * machinery now enforces sequential digraph isolation identically to
 * the CVC sibling tier cascade. Each digraph requires 3 cross-day
 * ≥90% sessions before the next unlocks.
 */
export const WORD_SONG_NODES_IN_ORDER: readonly WordSongNode[] = [
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
 *   - letter-sounds / digraphs-sh / digraphs-ch /
 *     digraphs-th-voiceless / sight-words / simple-sentences →
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
  sessionCount = 0,
): FocusPick {
  const order =
    track === 'math' ? MATH_NODES_IN_ORDER : WORD_SONG_NODES_IN_ORDER

  // Forward walk: the first non-mastered node in declaration order. This is
  // the ordinary-progression pick and the historical default.
  // `hasForwardProgress` records whether there is any non-mastered node
  // left to learn — it gates CVC review (below).
  let forwardNode: SkillNode = order[order.length - 1]!
  let hasForwardProgress = false
  for (const node of order) {
    if (progress.skillLevels[node] !== 'mastered') {
      forwardNode = node
      hasForwardProgress = true
      break
    }
  }

  // CVC review mode (ticket 86c9qa6n3) — word-song track only, and ONLY
  // when the forward walk found NO non-mastered node, i.e. Marian has
  // genuinely completed every word-song tier through simple-sentences and
  // there is nothing left to forward-progress. In that maintenance state
  // the review picker re-surfaces a mastered CVC tier so the PR #181
  // cross-vowel-mixing infrastructure actually fires.
  //
  // Why "no forward progress left" rather than "forward node is non-CVC":
  // the established e2e contract (predating this ticket) is that a session
  // on ANY actively-progressing tier targets THAT tier — including the
  // first session on a freshly-unlocked non-CVC node. Concretely:
  //   - `cvc-cross-vowel-mix-regression.spec.ts` test 1 seeds digraphs-sh
  //     `'practicing'` + all CVC mastered and asserts the wire focusNode is
  //     `digraphs-sh` (NOT a CVC review pick) — cross-vowel routing is
  //     deliberately NOT threaded there.
  //   - `progression-mastery-loop.spec.ts` walks short-e to mastery and
  //     asserts session 4 (the boundary session, digraphs-sh just unlocked
  //     to `'intro'`, latch unset) runs on `digraphs-sh`, not on a
  //     graduation review.
  // Both are forward-progress sessions, so review must defer to them. Only
  // once the whole tree is mastered does review take over as the standing
  // maintenance layer. A null result from the picker still means "no review
  // this session — use the (last-node) forward pick."
  if (track === 'word-song' && !hasForwardProgress) {
    const reviewNode = pickCvcReviewNode(progress, sessionCount)
    if (reviewNode !== null) return { node: reviewNode, mode: 'cvc-review' }
  }

  return { node: forwardNode, mode: 'forward' }
}

/**
 * Periods (in sessions) between post-mastery CVC review sessions
 * (ticket 86c9qa6n3, Option B revisit cadence). Review fires when
 * `sessionCount` is a positive multiple of this value.
 */
export const CVC_REVIEW_PERIOD_SESSIONS = 5

/**
 * Pick a mastered CVC tier to re-surface for a cross-vowel review session,
 * or `null` to defer to the forward picker (ticket 86c9qa6n3, AC3).
 *
 * Mechanic (Dave's `design/research/cvc-review-mode-mechanic.md` verdict —
 * Option C-then-B):
 *
 *   1. GRADUATION REVIEW (Option C, once). The first time the picker runs
 *      with all three CVC tiers mastered AND `cvcGraduationSessionFired`
 *      still falsy, return `'cvc-words-short-u'` — a one-shot celebratory
 *      cross-vowel session. Short-u is chosen because `/ʌ/` has no Tagalog
 *      equivalent and is Marian's highest-L1-interference vowel. The
 *      session-end write path latches `cvcGraduationSessionFired = true`
 *      so this never repeats.
 *
 *   2. PERIODIC REVISIT (Option B). After graduation, every
 *      `CVC_REVIEW_PERIOD_SESSIONS`-th session re-surfaces a CVC tier on a
 *      round-robin: `CVC_TIERS[floor(sessionCount / period) % 3]`. The
 *      round-robin walks a → o → u → a … across review sessions so no
 *      single vowel monopolises review practice.
 *
 *   3. Otherwise `null` — the forward picker takes over (lands on the next
 *      non-mastered node, e.g. `digraphs-sh`).
 *
 * Guard order matters: the graduation latch is checked BEFORE the periodic
 * branch so the very first eligible session is always the short-u
 * graduation review, regardless of where `sessionCount` falls in the
 * period cycle.
 *
 * Pure read of `progress` + `sessionCount`; no mutation, no history walk.
 * Returns `null` immediately when the CVC tiers are not all mastered, so
 * the common (pre-graduation) case is O(1) with no review overhead.
 */
export function pickCvcReviewNode(
  progress: Progress,
  sessionCount: number,
): WordSongNode | null {
  // Not eligible until all three CVC tiers are mastered — the forward
  // picker still has a non-mastered CVC node to land on, so review mode
  // would be premature.
  if (!cvcReviewEligible(progress)) return null

  // 1. Graduation review — fire short-u exactly once.
  if (progress.cvcGraduationSessionFired !== true) {
    return 'cvc-words-short-u'
  }

  // 2. Periodic revisit — every Nth session, round-robin across the tiers.
  // `sessionCount > 0` guards against a session-0 trigger (0 % N === 0);
  // session 0 is the first-ever launch and can never be CVC-eligible
  // anyway, but the guard keeps the intent explicit.
  if (sessionCount > 0 && sessionCount % CVC_REVIEW_PERIOD_SESSIONS === 0) {
    const index =
      Math.floor(sessionCount / CVC_REVIEW_PERIOD_SESSIONS) % CVC_TIERS.length
    return CVC_TIERS[index]!
  }

  // 3. No review this session.
  return null
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
