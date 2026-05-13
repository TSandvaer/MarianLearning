/**
 * Word-song stage list — e2e shim of `WORD_SONG_NODES_IN_ORDER` from
 * `src/lib/progress/focusNode.ts` (ticket 86c9qa0kq).
 *
 * Why a shim instead of a direct import
 * -------------------------------------
 * The e2e tsconfig (`tsconfig.e2e.json`) declares
 * `include: ["e2e", "playwright.config.ts"]` — `src/` is outside the
 * include set, so `tsc -b` won't add the canonical
 * `src/lib/progress/focusNode.ts` to the e2e project's compilation
 * unit. (DOM types are already in scope via
 * `lib: ["ES2023", "DOM", "DOM.Iterable"]` — those are not the
 * blocker.) The shim keeps spec consumers decoupled from the App's
 * internal module graph and avoids reaching across tsconfig
 * project boundaries.
 *
 * Source-of-truth alignment
 * -------------------------
 * This shim MUST stay in lockstep with the canonical
 * `WORD_SONG_NODES_IN_ORDER` constant in
 * `src/lib/progress/focusNode.ts`. Drift is guarded at CI time by a
 * vitest equality test at
 * `e2e/_helpers/wordSongNodesInOrder.test.ts` that imports both the
 * shim AND the source-of-truth and `expect.toEqual()`s them — if a
 * future tier insertion lands in one list but not the other, that
 * test fails loudly. Per Kevin's PR #183 review: closes the same
 * developer-discipline fragility class this refactor eliminates at
 * the spec layer.
 *
 * Any new sibling vowel-tier node inserted into the canonical list
 * (the tier-widening pattern Marian's curriculum follows — short-o,
 * short-u, future short-i / short-e) MUST be reflected here in the
 * same position.
 *
 * The path-strip projection assertions in
 * `cvc-words-regression.spec.ts`, `cvc-words-short-o-regression.spec.ts`,
 * and `cvc-words-short-u-regression.spec.ts` derive their expected slice
 * from this list via `slidingWindow()` — they do NOT hardcode stage
 * counts. So the only churn for a new tier insertion is:
 *
 *   1. Insert the new node here (one line).
 *   2. Insert into `src/lib/progress/focusNode.ts`'s
 *      `WORD_SONG_NODES_IN_ORDER` (the canonical source).
 *   3. Insert into `src/screens/Hub/stages.ts`'s `WORD_SONG_STAGES`
 *      (the Hub display-order list).
 *   4. Insert into `src/lib/progress/guards.ts`'s `SKILL_NODES`,
 *      `defaults.ts`'s `SCHEMA_FLOOR_NODES`, etc. — see the five-place
 *      widening contract in `progress-and-persistence.md`.
 *
 * The e2e specs themselves no longer need patching.
 */

export type WordSongNode =
  | 'letter-names'
  | 'letter-sounds'
  | 'blending-cv'
  | 'cvc-words'
  | 'cvc-words-short-o'
  | 'cvc-words-short-u'
  | 'cvc-words-short-i'
  | 'cvc-words-short-e'
  | 'digraphs'
  | 'sight-words'
  | 'simple-sentences'

/**
 * Word-song stages in declaration order. Mirrors
 * `src/lib/progress/focusNode.ts` `WORD_SONG_NODES_IN_ORDER` exactly.
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
  'digraphs',
  'sight-words',
  'simple-sentences',
]

/**
 * The expected `data-kind` value for a path-strip cell at absolute
 * index `cellIndex`, given the focus is at `focusIndex` on a tree
 * where every node before `focusIndex` is `'mastered'` and every node
 * at-or-after `focusIndex` is the seeded "current" / "locked" mix.
 *
 * The path-strip's `StageIcon` consumer maps
 * `mastered | current | locked` to the cell's `data-kind` attribute.
 * Specs that drive a returning-Marian flow (skillLevels seeded so
 * `pickFocusNode()` returns a specific node) can use this helper to
 * derive the expected `data-kind` per cell instead of repeating the
 * mapping by hand.
 */
export function expectedKindForCell(
  cellIndex: number,
  focusIndex: number,
): 'mastered' | 'current' | 'locked' {
  if (cellIndex < focusIndex) return 'mastered'
  if (cellIndex === focusIndex) return 'current'
  return 'locked'
}

/**
 * Convenience — produce the `[{ stage, kind }]` projection for a
 * path-strip slice given the absolute slice offset and the focus
 * index in the FULL track. Pairs naturally with `slidingWindow()`'s
 * `{ items, offset }` return.
 *
 * Use:
 *
 * ```ts
 * const { items, offset } = slidingWindow(WORD_SONG_NODES_IN_ORDER, focusIndex, 1, 3)
 * const expected = projectExpectedCells(items, offset, focusIndex)
 * expect(observed).toEqual(expected)
 * ```
 */
export function projectExpectedCells<T extends string>(
  items: readonly T[],
  offset: number,
  focusIndex: number,
): { stage: T; kind: 'mastered' | 'current' | 'locked' }[] {
  return items.map((stage, i) => ({
    stage,
    kind: expectedKindForCell(offset + i, focusIndex),
  }))
}
