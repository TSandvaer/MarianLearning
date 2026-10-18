/**
 * Math's inline vector glyphs, drawn exactly as the web's inline SVGs in
 * `src/screens/Math/Math.tsx` (`SparkleGlyph`, `FlowerGlyph`, the back
 * chevron) and `DotCardCell.tsx` / `TenFrameCell.tsx`; plus the native
 * `BudGlyph` (content wave 1 § 1.4) and hundreds' blocks, `CubeGlyph`,
 * `RodGlyph` and `FlatGlyph` (content wave 3 § 3.2).
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { colors } from '../../theme'

/** Web `SparkleGlyph`: a gold four-point star, 1em square. */
export function SparkleGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2 L13.6 9.4 L21 11 L13.6 12.6 L12 20 L10.4 12.6 L3 11 L10.4 9.4 Z"
        fill="#FFD966"
        stroke="#E0B800"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

const PETAL_ANGLES = [0, 72, 144, 216, 288]

/** Web `FlowerGlyph`: five pink petals around a yellow centre. */
export function FlowerGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {PETAL_ANGLES.map((angle) => {
        const rad = (angle * Math.PI) / 180
        return (
          <Circle
            key={angle}
            cx={16 + Math.cos(rad - Math.PI / 2) * 7}
            cy={16 + Math.sin(rad - Math.PI / 2) * 7}
            r={6}
            fill="#FFC0CB"
            stroke="#F48FB1"
            strokeWidth={0.6}
          />
        )
      })}
      <Circle
        cx={16}
        cy={16}
        r={4}
        fill="#FFD966"
        stroke="#E0B800"
        strokeWidth={0.6}
      />
    </Svg>
  )
}

/**
 * A flower that hasn't opened (content wave 1 § 1.4): `FlowerGlyph`'s
 * geometry, white petals with a rose outline, a cream centre with a gold
 * one. A missing number's hidden part shows as these from hint 3.
 */
export function BudGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {PETAL_ANGLES.map((angle) => {
        const rad = (angle * Math.PI) / 180
        return (
          <Circle
            key={angle}
            cx={16 + Math.cos(rad - Math.PI / 2) * 7}
            cy={16 + Math.sin(rad - Math.PI / 2) * 7}
            r={6}
            fill="#FFFFFF"
            stroke="#F48FB1"
            strokeWidth={1.2}
          />
        )
      })}
      <Circle
        cx={16}
        cy={16}
        r={4}
        fill={colors.myCream}
        stroke="#E0B800"
        strokeWidth={0.8}
      />
    </Svg>
  )
}

/** Web back arrow: a 28-unit chevron, stroke 4.5, white on the clay disc. */
export function BackChevron({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* The web's `drop-shadow(0 2px 0 rgba(90,45,15,.55))` at 32 px: 1.75 units. */}
      <Path
        d="M18 7.75 L9 15.75 L18 23.75"
        stroke="rgba(90,45,15,0.55)"
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 6 L9 14 L18 22"
        stroke="#FFFFFF"
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// ── Dot card cells (web DotCardCell / TenFrameCell) ───────────────────────

const PIP_25 = 20
const PIP_50 = 40
const PIP_75 = 60

/** Web `PIP_POSITIONS` on the 80-unit cell. */
const PIP_POSITIONS: Readonly<Record<number, readonly [number, number][]>> = {
  1: [[PIP_50, PIP_50]],
  2: [
    [PIP_25, PIP_25],
    [PIP_75, PIP_75],
  ],
  3: [
    [PIP_25, PIP_25],
    [PIP_50, PIP_50],
    [PIP_75, PIP_75],
  ],
  4: [
    [PIP_25, PIP_25],
    [PIP_75, PIP_25],
    [PIP_25, PIP_75],
    [PIP_75, PIP_75],
  ],
  5: [
    [PIP_25, PIP_25],
    [PIP_75, PIP_25],
    [PIP_50, PIP_50],
    [PIP_25, PIP_75],
    [PIP_75, PIP_75],
  ],
}

/** The web hardcodes these literals (pink border, `#3F3F46` pips). */
const CELL_BORDER = '#F48FB1'
const PIP_FILL = '#3F3F46'

/** Web `DotCardCell`: a die face, 80 units square, rounded 24. */
export function DotCardCell({ pips, size }: { pips: number; size: number }) {
  const positions = PIP_POSITIONS[pips] ?? []
  return (
    <Svg
      testID="math-dot-card-cell"
      width={size}
      height={size}
      viewBox="0 0 80 80"
    >
      <Rect
        x={1.5}
        y={1.5}
        width={77}
        height={77}
        rx={24}
        ry={24}
        fill="#FFFFFF"
        stroke={CELL_BORDER}
        strokeWidth={3}
      />
      {positions.map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={6} fill={PIP_FILL} />
      ))}
    </Svg>
  )
}

const FRAME_COLUMNS = [17, 41, 65, 89, 113]
const FRAME_ROWS = [18, 42]

/** Web `TenFrameCell`: 5 × 2 slots, top row first; 130×60 units at 170×80. */
export function TenFrameCell({
  pips,
  height,
}: {
  pips: number
  height: number
}) {
  const slots = FRAME_ROWS.flatMap((y) => FRAME_COLUMNS.map((x) => [x, y]))
  return (
    <Svg
      testID="math-dot-card-cell"
      width={(height * 170) / 80}
      height={height}
      viewBox="0 0 130 60"
    >
      <Rect
        x={1.5}
        y={1.5}
        width={127}
        height={57}
        rx={16}
        ry={16}
        fill="#FFFFFF"
        stroke={CELL_BORDER}
        strokeWidth={3}
      />
      {slots.slice(0, pips).map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={6} fill={PIP_FILL} />
      ))}
    </Svg>
  )
}

/** Hundreds' blocks (content wave 3 § 3.2): a pink fill, a 1.5 pt rose
 *  outline and a 1 pt grid, `cols` × `rows` cells of `u` each. Exact
 *  counts: a rod has 10 cells, a flat 10 × 10. */
function BlockGlyph({
  u,
  cols,
  rows,
}: {
  u: number
  cols: number
  rows: number
}) {
  const w = cols * u
  const h = rows * u
  const grid: string[] = []
  for (let c = 1; c < cols; c++) grid.push(`M${c * u} 0 V${h}`)
  for (let r = 1; r < rows; r++) grid.push(`M0 ${r * u} H${w}`)
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Rect x={0} y={0} width={w} height={h} fill={colors.myPink} />
      {grid.length > 0 && (
        <Path d={grid.join(' ')} stroke={colors.myRose} strokeWidth={1} />
      )}
      <Rect
        x={0.75}
        y={0.75}
        width={w - 1.5}
        height={h - 1.5}
        fill="none"
        stroke={colors.myRose}
        strokeWidth={1.5}
      />
    </Svg>
  )
}

/** A one-cube, `u` square. */
export function CubeGlyph({ u }: { u: number }) {
  return <BlockGlyph u={u} cols={1} rows={1} />
}

/** A ten-rod: `u` wide, 10 cells tall. */
export function RodGlyph({ u }: { u: number }) {
  return <BlockGlyph u={u} cols={1} rows={10} />
}

/** A hundred-flat: 10 × 10 cells. */
export function FlatGlyph({ u }: { u: number }) {
  return <BlockGlyph u={u} cols={10} rows={10} />
}
