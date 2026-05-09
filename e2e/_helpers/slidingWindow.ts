/**
 * Sliding-window slice helper for path-strip projection assertions
 * (ticket 86c9qa0kq).
 *
 * Why this exists
 * ---------------
 * The Hub's path-strip renders a 5-cell sliding window over each tree's
 * stage list, computed by `src/screens/Hub/stages.ts`'s `slidingWindow()`
 * helper (signature `(arr, currentIndex, size = 5)`, centred with
 * edge-clamping). E2E specs that assert against the rendered cells used
 * to hardcode the expected slice cell-by-cell, which broke every time
 * a new vowel-tier sibling was inserted into `WORD_SONG_NODES_IN_ORDER`:
 *
 *   - PR #151 (short-o widening) had to update one spec.
 *   - PR #174 (short-u widening) had to update two specs.
 *
 * Each tier added rotates the indices and the cell-by-cell hardcoded
 * slice goes stale until manually patched. Kevin's PR #174 review +
 * Devon's cross-cutting observation flagged this as a 3rd-occurrence
 * pattern; ticket 86c9qa0kq lifts the hardcoded math into this helper
 * so future tier insertions don't ripple into spec churn.
 *
 * Contract
 * --------
 * `slidingWindow(arr, focusIndex, before, after)` returns the slice of
 * `arr` that the path-strip will render given a focus at `focusIndex`,
 * showing `before` nodes to the left of the focus and `after` nodes to
 * the right (`before + 1 + after` total cells).
 *
 * Edge clamping mirrors the Hub helper exactly:
 *   - When `focusIndex - before < 0`, the window's left edge clamps to
 *     index 0 and the focus appears nearer the left edge of the window.
 *   - When `focusIndex + after >= arr.length`, the window's right edge
 *     clamps to `arr.length - 1` and the focus appears nearer the
 *     right edge.
 *   - Always returns `min(before + 1 + after, arr.length)` items.
 *
 * The 4-arg `(before, after)` shape is more explicit than the Hub's
 * 3-arg `(currentIndex, size)` shape because the path-strip's actual
 * geometry is asymmetric: the rendered window is `[focus-1, focus,
 * focus+1, focus+2, focus+3]` (before=1, after=3) — so the asymmetry
 * is named at the call site instead of buried in
 * `desiredOffset = currentIndex - 1`.
 *
 * Why a 4-arg helper instead of importing the Hub's 3-arg helper
 * --------------------------------------------------------------
 * Two reasons:
 *
 *  1. **tsconfig boundary.** `tsconfig.e2e.json` only includes `e2e/**`
 *     and `playwright.config.ts`. Importing from `src/screens/Hub/stages`
 *     would not type-check under the e2e config. We could widen the
 *     config, but that pulls jsdom + DOM types into the e2e harness
 *     which the Playwright runtime doesn't need.
 *  2. **Asymmetry is the load-bearing intent.** The whole reason this
 *     helper replaces hardcoded slices is to make the `(before=1,
 *     after=3)` shape obvious in spec bodies. A `size=5` that callers
 *     have to mentally translate back to `(before=1, after=3)` reverts
 *     the readability win.
 *
 * Both helpers must stay structurally equivalent. The unit test in
 * `slidingWindow.test.ts` includes a parity case that runs the same
 * inputs through both shapes and asserts identical output for the
 * canonical 5-cell path-strip geometry.
 */

export interface SlidingWindowResult<T> {
  /** The selected slice of `arr` in source order. */
  items: T[]
  /** The absolute index in `arr` of the first item in `items`. */
  offset: number
}

/**
 * Return the path-strip projection slice — `before` items to the left
 * of `focusIndex`, the focus item itself, then `after` items to the
 * right, with edge clamping so the result stays within `arr`.
 *
 * Mirrors the geometry of `src/screens/Hub/stages.ts`'s `slidingWindow`
 * for the canonical `before=1, after=3` (size=5) path-strip case.
 *
 * Empty `arr` returns `{ items: [], offset: 0 }`.
 *
 * Throws on:
 *  - Non-integer `focusIndex` / `before` / `after`.
 *  - Negative `before` / `after`.
 *  - `focusIndex` outside `[0, arr.length - 1]` for non-empty `arr`.
 */
export function slidingWindow<T>(
  arr: readonly T[],
  focusIndex: number,
  before: number,
  after: number,
): SlidingWindowResult<T> {
  if (arr.length === 0) return { items: [], offset: 0 }

  if (!Number.isInteger(focusIndex)) {
    throw new TypeError(
      `slidingWindow: focusIndex must be an integer; got ${String(focusIndex)}`,
    )
  }
  if (!Number.isInteger(before) || before < 0) {
    throw new TypeError(
      `slidingWindow: before must be a non-negative integer; got ${String(before)}`,
    )
  }
  if (!Number.isInteger(after) || after < 0) {
    throw new TypeError(
      `slidingWindow: after must be a non-negative integer; got ${String(after)}`,
    )
  }
  if (focusIndex < 0 || focusIndex >= arr.length) {
    throw new RangeError(
      `slidingWindow: focusIndex ${focusIndex} out of bounds for array length ${arr.length}`,
    )
  }

  const size = before + 1 + after
  // Desired left-edge of the window: focus minus `before` cells.
  const desiredOffset = focusIndex - before
  // Edge clamp — when the window would run off either end, slide it
  // back inside `arr`. `maxOffset` is the largest offset that keeps
  // the full window inside the array; if `arr` is shorter than the
  // window, `maxOffset = 0` and the result is just `arr`.
  const maxOffset = Math.max(0, arr.length - size)
  const offset = Math.max(0, Math.min(maxOffset, desiredOffset))

  const end = Math.min(arr.length, offset + size)
  const items: T[] = []
  for (let i = offset; i < end; i++) {
    items.push(arr[i] as T)
  }

  return { items, offset }
}
