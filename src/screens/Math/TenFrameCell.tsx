/**
 * TenFrameCell — single-cell ten-frame pip primitive for the sub-to-10
 * minuend scaffold (ticket 86ca7kdw8 / spec §13.2.2).
 *
 * NOTE: file is named `TenFrameCell.tsx` (not `TenFrame.tsx`) to mirror
 * the `DotCardCell.tsx` naming convention and stay clear of any sibling
 * `tenFrame.ts`-style predicate module on case-insensitive filesystems
 * (Windows, default macOS) — the same TS1149 casing-collision hazard
 * documented in the `DotCardCell.tsx` header.
 *
 * Renders a ten-frame (5 columns × 2 rows) for a minuend value in
 * `6..10`. Pips fill the TOP row left→right first, then the BOTTOM row
 * left→right. Empty slots render as nothing (no outline circle) — the
 * stimulus is filled pips only, matching the dice-pip "filled dots on
 * white" contract of `DotCardCell`. Inline-SVG only — no asset file in
 * `public/assets/`.
 *
 * Spec: `design/math/subitising-scaffold-content.md` §13.2.2 (pip
 * layout / position rules) + §13.2.3 (sizing envelope).
 *
 *   6  → top row full (5) + bottom 1
 *   7  → top row full (5) + bottom 2
 *   8  → top row full (5) + bottom 3
 *   9  → top row full (5) + bottom 4
 *   10 → both rows full (5 + 5)
 *
 * The five-anchor (a full top row reads "5" instantly) makes 6–10
 * *conceptually* subitisable: "eight = a full five and three more" — the
 * part-whole decomposition Fuson & Kwon (1992) identify as the cognitive
 * anchor for teen subtraction (Dave's W10.1 research §1).
 *
 * Value-conditional boundary: minuend 5 stays a die face (existing
 * `DotCardCell`); only 6–10 use this ten-frame (spec §13.2.2). The
 * boundary at 5 is where perceptual subitising hands off to conceptual
 * subitising.
 *
 * Visual specifics (§13.2.3 + matching `DotCardCell`):
 *   - viewBox `0 0 130 60` (5 columns × 2 rows of 24-unit pitch + margins)
 *   - rendered at ~170pt wide × 80pt tall (narrower than the add path's
 *     two 80pt cells + 24pt gap = 184pt, so the overlay never exceeds the
 *     existing horizontal envelope — no layout-stability regression)
 *   - white fill, soft pink border (`--my-pink` → #F48FB1)
 *   - 12pt-diameter dots in `--ink` (#3F3F46)
 */

import { PIPS_TO_WORD } from './dotCard'

/** Minuend values rendered as a ten-frame (5 stays a die face). */
export type TenFramePipsCount = 6 | 7 | 8 | 9 | 10

interface TenFrameCellProps {
  /** Number of pips to render. Must be an integer in `[6, 10]`. */
  pips: TenFramePipsCount
  /**
   * Optional ARIA label override. Defaults to the spelled-out English
   * word ("eight", "six") so screen readers narrate the minuend quantity
   * in the same vocabulary Marian hears Emma speak.
   */
  ariaLabel?: string
}

/**
 * Ten-frame geometry on the 130×60 viewBox. Five columns × two rows at a
 * 24-unit pitch, centred with a symmetric margin. Column centres:
 * 17, 41, 65, 89, 113 (start 17, step 24, +17 right margin = 130). Row
 * centres: 18 (top), 42 (bottom) (start 18, step 24, +18 bottom margin =
 * 60). Pip radius 6 (12pt diameter) matches `DotCardCell`.
 */
const FRAME_WIDTH = 130
const FRAME_HEIGHT = 60
const FRAME_RADIUS = 16
const PIP_RADIUS = 6
const COLUMN_X = [17, 41, 65, 89, 113] as const
const ROW_Y = [18, 42] as const

/**
 * The ten slot centres in fill order — top row (slots 0–4) left→right,
 * then bottom row (slots 5–9) left→right. For a value `n`, fill slots
 * `0 .. n-1`. Spec §13.2.2 "Position rules (LOCKED)".
 */
const SLOT_CENTERS: ReadonlyArray<readonly [number, number]> = [
  // Top row (slots 0–4).
  [COLUMN_X[0], ROW_Y[0]],
  [COLUMN_X[1], ROW_Y[0]],
  [COLUMN_X[2], ROW_Y[0]],
  [COLUMN_X[3], ROW_Y[0]],
  [COLUMN_X[4], ROW_Y[0]],
  // Bottom row (slots 5–9).
  [COLUMN_X[0], ROW_Y[1]],
  [COLUMN_X[1], ROW_Y[1]],
  [COLUMN_X[2], ROW_Y[1]],
  [COLUMN_X[3], ROW_Y[1]],
  [COLUMN_X[4], ROW_Y[1]],
]

/**
 * Render one ten-frame card. The wrapper `<div>` carries the
 * `math-dot-card-cell` testid (REUSED from `DotCardCell` per spec §13.5
 * #9 so Jessica's E2E + the existing count selectors work uniformly
 * across both primitives) plus `data-pips` for the value assertion. The
 * inner `<svg>` carries `role="img"` + `aria-label` so VoiceOver +
 * axe-core see the right shape; the overlay container is `aria-hidden`,
 * so this pair is defense-in-depth.
 */
export function TenFrameCell({ pips, ariaLabel }: TenFrameCellProps) {
  const label = ariaLabel ?? PIPS_TO_WORD[pips]
  // Fill slots 0..pips-1 (top row first, then bottom). Spec §13.2.2.
  const filled = SLOT_CENTERS.slice(0, pips)
  return (
    <div
      data-testid="math-dot-card-cell"
      data-pips={pips}
      data-cell-kind="ten-frame"
      className="inline-flex items-center justify-center"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
        width="170"
        height="80"
        role="img"
        aria-label={label}
      >
        {/* Cell — white fill, soft pink border. `--my-pink` resolves to
            #F48FB1; hardcoded here so the SVG renders consistently when
            wrapped in an `<m.div>` that doesn't inherit Tailwind theme
            variables (matching DotCardCell). */}
        <rect
          x="1.5"
          y="1.5"
          width={FRAME_WIDTH - 3}
          height={FRAME_HEIGHT - 3}
          rx={FRAME_RADIUS}
          ry={FRAME_RADIUS}
          fill="#FFFFFF"
          stroke="#F48FB1"
          strokeWidth="3"
        />
        {/* Filled pips — `--ink` (#3F3F46). Empty slots render nothing
            (filled-pips-only stimulus, §13.2.2). */}
        {filled.map(([cx, cy], i) => (
          <circle
            key={i}
            data-testid="math-dot-card-pip"
            cx={cx}
            cy={cy}
            r={PIP_RADIUS}
            fill="#3F3F46"
          />
        ))}
      </svg>
    </div>
  )
}
