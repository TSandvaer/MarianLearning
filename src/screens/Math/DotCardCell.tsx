/**
 * DotCardCell — single-cell dice-pip primitive (ticket 86c9q5j9a).
 *
 * NOTE: file is named `DotCardCell.tsx` (not `DotCard.tsx`) to disambiguate
 * from the sibling `dotCard.ts` predicate module on case-insensitive
 * filesystems (Windows, default macOS). TypeScript's project references
 * raise TS1149 when two source files differ only in casing.
 *
 * Renders a square card with the canonical Western die face for `pips`
 * in `1..5`. Inline-SVG only — no asset file in `public/assets/`,
 * matching the `<FlowerGlyph>` / `<SparkleGlyph>` pattern at the bottom
 * of `Math.tsx`.
 *
 * Spec: `design/screen-math-subitising-prompt.md` § "Pip layout".
 *
 *   1 → centre
 *   2 → top-left + bottom-right
 *   3 → top-left + centre + bottom-right
 *   4 → four corners
 *   5 → four corners + centre
 *
 * Visual specifics from the spec:
 *   - 80×80pt cell, 24pt rounded corners
 *   - white fill, soft pink border (`--my-pink` Tailwind token)
 *   - 12pt-diameter dots in `--ink`
 *
 * Dot positions are hand-coded fractions of the 80-unit viewBox rather
 * than a CSS grid — ensures layout stability across browser zoom levels
 * (per spec § "Pip layout" final paragraph).
 */

import { PIPS_TO_WORD, type DotCardPipsCount } from './dotCard'

interface DotCardCellProps {
  /** Number of pips to render. Must be an integer in `[1, 5]`. */
  pips: DotCardPipsCount
  /**
   * Optional ARIA label override. Defaults to the spelled-out English
   * word ("three", "two") so screen readers narrate the quantity in the
   * same vocabulary Marian hears Emma speak. Spec § "Accessibility
   * notes → ARIA".
   */
  ariaLabel?: string
}

/**
 * Layout constants for the 80×80 viewBox. The pip-centre offsets are
 * derived once so the rendering is symmetric — placing pips at 25% /
 * 50% / 75% of the cell, keeping a comfortable margin from the rounded
 * border.
 */
const CELL_SIZE = 80
const CELL_RADIUS = 24
const PIP_RADIUS = 6 // 12pt diameter
const PIP_AT_25 = CELL_SIZE * 0.25 // 20
const PIP_AT_50 = CELL_SIZE * 0.5 // 40
const PIP_AT_75 = CELL_SIZE * 0.75 // 60

/**
 * Pip coordinates per face. Each tuple is `[cx, cy]` in viewBox units.
 * Order matches the spec's bullet list above.
 */
const PIP_POSITIONS: Readonly<
  Record<DotCardPipsCount, ReadonlyArray<[number, number]>>
> = {
  1: [[PIP_AT_50, PIP_AT_50]],
  2: [
    [PIP_AT_25, PIP_AT_25],
    [PIP_AT_75, PIP_AT_75],
  ],
  3: [
    [PIP_AT_25, PIP_AT_25],
    [PIP_AT_50, PIP_AT_50],
    [PIP_AT_75, PIP_AT_75],
  ],
  4: [
    [PIP_AT_25, PIP_AT_25],
    [PIP_AT_75, PIP_AT_25],
    [PIP_AT_25, PIP_AT_75],
    [PIP_AT_75, PIP_AT_75],
  ],
  5: [
    [PIP_AT_25, PIP_AT_25],
    [PIP_AT_75, PIP_AT_25],
    [PIP_AT_50, PIP_AT_50],
    [PIP_AT_25, PIP_AT_75],
    [PIP_AT_75, PIP_AT_75],
  ],
}

/**
 * Render one dice-pip card. The wrapper `<div>` carries the testids
 * spec § "Test seams" pins; the inner `<svg>` carries the role + ARIA
 * label so VoiceOver + axe-core both see the right shape.
 *
 * The card itself is `aria-hidden` at the overlay-container level (see
 * `DotCardOverlay`) — this `role="img"` + `aria-label` pair is
 * defense-in-depth for any future surface that mounts a `<DotCardCell>`
 * outside the overlay.
 */
export function DotCardCell({ pips, ariaLabel }: DotCardCellProps) {
  const positions = PIP_POSITIONS[pips]
  const label = ariaLabel ?? PIPS_TO_WORD[pips]
  return (
    <div
      data-testid="math-dot-card-cell"
      data-pips={pips}
      className="inline-flex items-center justify-center"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${CELL_SIZE} ${CELL_SIZE}`}
        width="80"
        height="80"
        role="img"
        aria-label={label}
      >
        {/* Cell — white fill, soft pink border. The `--my-pink` Tailwind
            token resolves to #F48FB1; we hardcode the literal here so
            the SVG renders consistently when wrapped in a `<m.div>` that
            doesn't inherit Tailwind theme variables. */}
        <rect
          x="1.5"
          y="1.5"
          width={CELL_SIZE - 3}
          height={CELL_SIZE - 3}
          rx={CELL_RADIUS}
          ry={CELL_RADIUS}
          fill="#FFFFFF"
          stroke="#F48FB1"
          strokeWidth="3"
        />
        {/* Pips — `--ink` token (#3F3F46). */}
        {positions.map(([cx, cy], i) => (
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
