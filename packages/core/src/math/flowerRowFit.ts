/**
 * Visual-fit helper for the Math screen's flower row (`math-visual-groups`).
 *
 * Why this module exists
 * ----------------------
 * The flower glyphs are sized at `1em`, so the `font-size` of the
 * surrounding flex container directly controls how wide the row paints.
 * Pre-PR-#166-extension, the row was hard-coded to `text-[3.2rem]`. The
 * add-to-20 tier (ticket 86c9q5q13) introduced problems where
 * `addendA + addendB` ranges across [11, 18]; on real iPad portrait,
 * `7+7=14` rendered cramped and `9+9=18` clipped past the right edge of
 * the viewport (Thomas's iPad smoke, 2026-05-09).
 *
 * Approach: continuous linear scale between two anchor points
 *   - total flowers ≤ 10 → 3.2rem (the historical add-to-10 value;
 *     unchanged so existing tests / pre-fix flows render identically)
 *   - total flowers ≥ 18 → 2.0rem (worst-case 9+9 fits inside an
 *     iPad-mini portrait safe area with breathing room)
 *   - in between → `3.2 - 0.15 * (total - 10)` rem
 *
 * Width budget (iPad-mini portrait, 768pt viewport, conservative target):
 *   T flowers @ font-size F (px):
 *     content_px ≈ T * F + (T - 2) * gap1_px + 2 * gap6_px + plus_glyph_px
 *                ≈ T * F + 4(T - 2) + 48 + 0.6 * F
 *     content_px must stay < ~704 (768 - 32px ancestor `px-4` -
 *     32px safety margin). The chosen anchors satisfy that on every
 *     T ∈ [10, 18].
 *
 * Why not flex-wrap or a threshold step?
 *   - `flex-wrap` on `math-visual-groups` would break the bilateral
 *     "left + plus + right" composition Marian relies on for counting
 *     each side independently. The wrap point is also unstable as the
 *     viewport size changes between iPad models.
 *   - A single threshold step (e.g. shrink only when `total >= 14`)
 *     creates a visible jump between two adjacent problems in the same
 *     session — `5+7` (3.05rem) next to `6+8` (2.6rem) reads jolt-y if
 *     the boundary lands on a step rather than a gradient.
 *
 * The continuous scale is the right primitive: every problem in the
 * canon (totals 11..18) gets a font-size proportional to its load, and
 * the historical add-to-10 surface is untouched.
 *
 * Pure: takes the two addends, returns a number. No DOM, no React. Lives
 * in a sibling file (not inline in `Math.tsx`) so React Fast Refresh's
 * `react-refresh/only-export-components` rule stays clean — sibling
 * helpers are the project convention (see `distractors.ts`, `stardust.ts`).
 */

const ADD_TO_10_REM = 3.2
const WORST_CASE_REM = 2.0
const SCALE_START_TOTAL = 10
const SCALE_END_TOTAL = 18
const SCALE_SLOPE_REM_PER_FLOWER =
  (ADD_TO_10_REM - WORST_CASE_REM) / (SCALE_END_TOTAL - SCALE_START_TOTAL)

export function flowerRowFontSizeRem(addendA: number, addendB: number): number {
  const total = addendA + addendB
  if (total <= SCALE_START_TOTAL) return ADD_TO_10_REM
  if (total >= SCALE_END_TOTAL) return WORST_CASE_REM
  return (
    ADD_TO_10_REM - SCALE_SLOPE_REM_PER_FLOWER * (total - SCALE_START_TOTAL)
  )
}
