/**
 * Math's frames for the four form factors. Pure maths; the screen places
 * its regions from it, and App springs Emma to `emma`.
 *
 * - **Tablet** (shorter side ≥ 600 pt) follows the web Math
 *   (`src/screens/Math/Math.tsx`): a one-row 96 pt HUD (`h-24`), Emma at
 *   `26vh` upper-left with the ribbon to her right (`gap-4`, `mt-4`), the
 *   problem centred in the space left (`mt-4 flex-1`), 120 pt chips with
 *   32 pt gaps, 32 pt above the safe bottom (`mb-8`). Landscape: Emma
 *   stands in the left gutter under the HUD, the ribbon and problem sit to
 *   her right (`pl-[calc(26vh+…)]`).
 * - **Phone** follows `design/native/greet-math-native.md` § 4 (375×667
 *   floor). Portrait: a two-row HUD (back + streak/stardust, then the
 *   beads), Emma at 22 % of the safe height (≥ 120) with the ribbon to her
 *   right, the equation (72 pt) and counting dots centred between the
 *   ribbon and the chips, chips (clamp 72..88) 32 pt above the safe
 *   bottom. Landscape: Emma's column is clamp(120, 24 % of the safe width,
 *   200) with the back arrow at its top; a 44 pt HUD row, the ribbon, the
 *   equation (56 pt), the dots and the chips stack in the right pane.
 *
 * Native-only, every form factor: the ribbon has a reserved 2-line slot
 * (a wrapped caption never moves the problem; same reasoning as Greet's,
 * see `greetLayout.ts`), and on a phone the counting-dots row is a fixed
 * slot tall enough for two rows of dots or the dot card, so the equation
 * never moves between problems.
 *
 * Emma's art is a transparent square: across the Math poses (idle,
 * listening, celebration, puzzled-tilt, attentive-pointing) the opaque
 * pixels span 0.183–0.733 of its width (measured on the exported WebPs).
 * On a phone her frame is placed by that band ({@link FIGURE_LEFT},
 * {@link FIGURE_RIGHT}), so the frame itself may overhang the screen edge.
 */
import {
  isMoreAndLess,
  isPlaceValueArithmetic,
  moreChange,
  type ExtendedMathProblem,
  type MoreCount,
  type MoreDirection,
} from '@marian/core/math/extendedProblems'
import type { SkillNode } from '@marian/core/progress'
import { flowerRowFontSizeRem } from '@marian/core/math/flowerRowFit'
import {
  isLandscape,
  isTablet,
  safeRect,
  type Rect,
  type ScreenLayout,
  type Viewport,
} from './layout'

export type MathForm =
  | 'phone-portrait'
  | 'phone-landscape'
  | 'tablet-portrait'
  | 'tablet-landscape'

/** Where Emma's figure starts / ends across the Math poses (see header). */
export const FIGURE_LEFT = 0.18
export const FIGURE_RIGHT = 0.74

/** Native spec § 4: chips clamp(72, fit, 88) on a phone, ≥ 16 pt apart. */
export const PHONE_CHIP_MIN = 72
export const PHONE_CHIP_MAX = 88
export const PHONE_CHIP_GAP_MIN = 16
/** Web chips: 120×120, `gap-8`. */
export const TABLET_CHIP = 120
export const CHIP_GAP_MAX = 32
/** Back disc: 56 pt on a phone (spec § 4); the web's `56pt` CSS is 74.67 px. */
export const PHONE_BACK = 56
export const TABLET_BACK = (56 * 4) / 3
/** Spec § 2: Math caption 22 pt on a phone, `text-[1.6rem]` on a tablet. */
export const PHONE_CAPTION_PT = 22
export const TABLET_CAPTION_PT = 25.6
/** Tailwind `leading-snug`. */
export const CAPTION_LINE_HEIGHT = 1.375
/** Spec § 2: equation numerals 96 / 72 / 56. */
export const TABLET_EQUATION_PT = 96
export const PHONE_PORTRAIT_EQUATION_PT = 72
export const PHONE_LANDSCAPE_EQUATION_PT = 56
/** Line box of the equation row, as a multiple of the numeral size. */
export const EQUATION_LINE = 1.1
/** Spec § 4: counting dots 24 pt (total ≤ 10) or 20 pt, 8 pt apart, 24 pt between groups. */
export const PHONE_DOT = 24
export const PHONE_DOT_SMALL = 20
export const PHONE_DOT_GAP = 8
export const PHONE_GROUP_GAP = 24
/** Web dot card: 80 pt cells, `gap-6`. */
export const DOT_CARD_CELL = 80

export interface HudMetrics {
  back: number
  pillHeight: number
  pillFont: number
  pillPadLeft: number
  pillPadRight: number
  pillGap: number
  trackHeight: number
  trackPadX: number
  beadGap: number
  bead: { upcoming: number; completed: number; current: number }
  streakFont: number
}

export type HudLayout =
  /** Tablet (web): back, stardust, beads, streak in one justify-between row. */
  | { kind: 'row'; rect: Rect; padX: number }
  /** Phone: the beads track centred in `beads`; streak + stardust right-aligned in `status`. */
  | { kind: 'split'; back: Rect; beads: Rect; status: Rect }

export interface MathLayout extends ScreenLayout {
  form: MathForm
  safe: Rect
  hud: HudLayout
  hudMetrics: HudMetrics
  /** The ribbon hangs from (x, y) at this width; it may grow to `maxHeight`. */
  ribbon: { x: number; y: number; width: number; maxHeight: number }
  ribbonPadding: { horizontal: number; vertical: number }
  captionLineHeight: number
  /** The equation + counting row block is centred in here. */
  problem: Rect
  equationFont: number
  equationLineHeight: number
  equationGap: number
  /** Equation → counting row. */
  problemGap: number
  /** Fixed height of the counting row (phone); `null`: its natural height (tablet). */
  visualSlot: number | null
  counting: 'phone' | 'tablet'
  dotCard: { cell: number; gap: number }
  chips: { rect: Rect; size: number; gap: number; font: number; radius: number }
}

const clamp = (min: number, value: number, max: number) =>
  Math.max(min, Math.min(max, value))

const PHONE_HUD: HudMetrics = {
  back: PHONE_BACK,
  pillHeight: 40,
  pillFont: 22,
  pillPadLeft: 8,
  pillPadRight: 14,
  pillGap: 6,
  trackHeight: 28,
  trackPadX: 8,
  beadGap: 6,
  // Spec § 4: 12/14/16 (web 18/22/24).
  bead: { upcoming: 12, completed: 14, current: 16 },
  streakFont: 20,
}

/** Web: `clay-round-btn` 56pt, `clay-pill h-14 text-3xl`, `clay-track h-11`. */
const TABLET_HUD: HudMetrics = {
  back: TABLET_BACK,
  pillHeight: 56,
  pillFont: 30,
  pillPadLeft: 12,
  pillPadRight: 20,
  pillGap: 8,
  trackHeight: 44,
  trackPadX: 12,
  beadGap: 8,
  bead: { upcoming: 18, completed: 22, current: 24 },
  streakFont: 24,
}

const PHONE_RIBBON_PADDING = { horizontal: 16, vertical: 10 }
/** Web `px-6 py-4`. */
const TABLET_RIBBON_PADDING = { horizontal: 24, vertical: 16 }

function ribbonSlot(
  fontSize: number,
  padding: { vertical: number },
  lines: number,
): number {
  return Math.ceil(
    lines * fontSize * CAPTION_LINE_HEIGHT + padding.vertical * 2,
  )
}

/** Chip numeral (spec § 2): 52 on a tablet, 0.45 × the chip on a phone. */
function chipMetrics(size: number, tablet: boolean) {
  return {
    font: tablet ? 52 : Math.round(size * 0.45),
    // Web `.clay-tile` radius 32 on a 120 pt chip.
    radius: Math.round((size * 32) / TABLET_CHIP),
  }
}

function chipRow(
  left: number,
  right: number,
  y: number,
  size: number,
  count = 3,
): { rect: Rect; gap: number } {
  const width = right - left
  const gap = clamp(
    PHONE_CHIP_GAP_MIN,
    Math.floor((width - count * size) / (count - 1)),
    CHIP_GAP_MAX,
  )
  return { rect: { x: left, y, width, height: size }, gap }
}

function phonePortrait(v: Viewport): MathLayout {
  const s = safeRect(v)
  const pad = 16
  const top = s.y + 8
  const back = { x: s.x + pad, y: top, width: PHONE_BACK, height: PHONE_BACK }
  const statusX = back.x + PHONE_BACK + 16
  const status = {
    x: statusX,
    y: top,
    width: s.x + s.width - pad - statusX,
    height: PHONE_BACK,
  }
  const beads = {
    x: s.x + pad,
    y: top + PHONE_BACK + 4,
    width: s.width - pad * 2,
    height: PHONE_HUD.trackHeight,
  }
  const emmaTop = beads.y + beads.height + 8

  const contentW = s.width - pad * 2
  const chip = clamp(
    PHONE_CHIP_MIN,
    Math.floor((contentW - 2 * PHONE_CHIP_GAP_MIN) / 3),
    PHONE_CHIP_MAX,
  )
  const chipsY = s.y + s.height - 32 - chip

  const equationFont = PHONE_PORTRAIT_EQUATION_PT
  const equationLineHeight = Math.round(equationFont * EQUATION_LINE)
  const problemGap = 24
  // Two rows of 20 pt dots (48) or the 80 pt dot card, whichever is taller.
  const visualSlot = DOT_CARD_CELL
  const problemBlock = equationLineHeight + problemGap + visualSlot

  const maxEmma = chipsY - 16 - problemBlock - 8 - emmaTop
  const emmaSize = Math.max(120, Math.min(Math.round(s.height * 0.22), maxEmma))
  const emma = {
    x: s.x + 8 - FIGURE_LEFT * emmaSize,
    y: emmaTop,
    width: emmaSize,
    height: emmaSize,
  }
  const ribbonX = emma.x + FIGURE_RIGHT * emmaSize + 8
  const problemTop = emma.y + emmaSize + 8
  const row = chipRow(s.x + pad, s.x + s.width - pad, chipsY, chip)
  return {
    form: 'phone-portrait',
    landscape: false,
    tablet: false,
    safe: s,
    emma,
    content: { x: s.x + pad, y: top, width: contentW, height: s.height - 8 },
    captionFontSize: PHONE_CAPTION_PT,
    captionLineHeight: PHONE_CAPTION_PT * CAPTION_LINE_HEIGHT,
    hud: { kind: 'split', back, beads, status },
    hudMetrics: PHONE_HUD,
    ribbon: {
      x: ribbonX,
      y: emmaTop + 8,
      width: s.x + s.width - pad - ribbonX,
      maxHeight: emmaSize - 8,
    },
    ribbonPadding: PHONE_RIBBON_PADDING,
    problem: {
      x: s.x + pad,
      y: problemTop,
      width: contentW,
      height: Math.max(0, chipsY - 16 - problemTop),
    },
    equationFont,
    equationLineHeight,
    equationGap: 12,
    problemGap,
    visualSlot,
    counting: 'phone',
    dotCard: { cell: DOT_CARD_CELL, gap: 24 },
    chips: { ...row, size: chip, ...chipMetrics(chip, false) },
  }
}

/** Ideal and minimum gaps of the landscape stack (spec § 4 budget). */
const LANDSCAPE_GAPS = {
  top: [8, 4],
  hudToRibbon: [8, 4],
  ribbonToEquation: [12, 6],
  equationToDots: [8, 4],
  dotsToChips: [16, 8],
  bottom: [16, 8],
} as const

function phoneLandscape(v: Viewport): MathLayout {
  const s = safeRect(v)
  const pad = 16
  const column = clamp(120, Math.round(s.width * 0.24), 200)
  const back = {
    x: s.x + pad,
    y: s.y + 8,
    width: PHONE_BACK,
    height: PHONE_BACK,
  }

  const emmaTop = back.y + PHONE_BACK + 8
  const emmaSize = Math.min(
    column / (FIGURE_RIGHT - FIGURE_LEFT),
    s.y + s.height - 8 - emmaTop,
  )
  const emma = {
    x: s.x + column / 2 - ((FIGURE_LEFT + FIGURE_RIGHT) / 2) * emmaSize,
    y: emmaTop,
    width: emmaSize,
    height: emmaSize,
  }

  const paneX = s.x + column
  const paneRight = s.x + s.width - pad
  const paneW = paneRight - paneX

  const equationFont = PHONE_LANDSCAPE_EQUATION_PT
  const equationLineHeight = Math.round(equationFont * EQUATION_LINE)
  const hudH = 44

  const gaps = Object.values(LANDSCAPE_GAPS)
  const idealGaps = gaps.reduce((n, [ideal]) => n + ideal, 0)
  const minGaps = gaps.reduce((n, [, min]) => n + min, 0)
  const twoLines = ribbonSlot(PHONE_CAPTION_PT, PHONE_RIBBON_PADDING, 2)
  const oneLine = ribbonSlot(PHONE_CAPTION_PT, PHONE_RIBBON_PADDING, 1)
  // The counting slot holds the dot card (64, or 56 when tight; two rows
  // of 20 pt dots need 48). Prefer a 2-line ribbon slot, so a wrapped
  // caption never reaches the equation: 375 pt fits it with 64, and a
  // 375 pt screen minus a home-indicator inset with 56. Else 1 line.
  const stackOf = (ribbon: number, slot: number, chip: number) =>
    hudH + ribbon + equationLineHeight + slot + chip
  const fit = [
    { ribbon: twoLines, cell: 64 },
    { ribbon: twoLines, cell: 56 },
  ].find(
    (o) => s.height - stackOf(o.ribbon, o.cell, PHONE_CHIP_MIN) >= minGaps,
  ) ?? { ribbon: oneLine, cell: 64 }
  const ribbonH = fit.ribbon
  const cell = fit.cell
  const visualSlot = cell
  const fixedWithout = (ribbon: number, chip: number) =>
    stackOf(ribbon, visualSlot, chip)
  const spareForChips =
    s.height - fixedWithout(ribbonH, PHONE_CHIP_MIN) - idealGaps
  const chip = clamp(
    PHONE_CHIP_MIN,
    Math.min(
      PHONE_CHIP_MIN + Math.max(0, spareForChips),
      Math.floor((paneW - 2 * PHONE_CHIP_GAP_MIN) / 3),
    ),
    PHONE_CHIP_MAX,
  )
  const slack = s.height - fixedWithout(ribbonH, chip)
  const t = clamp(0, (slack - minGaps) / (idealGaps - minGaps), 1)
  const g = (key: keyof typeof LANDSCAPE_GAPS) => {
    const [ideal, min] = LANDSCAPE_GAPS[key]
    return min + (ideal - min) * t
  }

  const hudY = s.y + g('top')
  const ribbonY = hudY + hudH + g('hudToRibbon')
  const problemY = ribbonY + ribbonH + g('ribbonToEquation')
  const problemH = equationLineHeight + g('equationToDots') + visualSlot
  const chipsY = s.y + s.height - g('bottom') - chip
  const row = chipRow(paneX, paneRight, chipsY, chip)
  return {
    form: 'phone-landscape',
    landscape: true,
    tablet: false,
    safe: s,
    emma,
    content: { x: paneX, y: hudY, width: paneW, height: s.height },
    captionFontSize: PHONE_CAPTION_PT,
    captionLineHeight: PHONE_CAPTION_PT * CAPTION_LINE_HEIGHT,
    hud: {
      kind: 'split',
      back,
      beads: { x: paneX, y: hudY, width: paneW, height: hudH },
      status: { x: paneX, y: hudY, width: paneW, height: hudH },
    },
    hudMetrics: PHONE_HUD,
    ribbon: { x: paneX, y: ribbonY, width: paneW, maxHeight: ribbonH },
    ribbonPadding: PHONE_RIBBON_PADDING,
    problem: { x: paneX, y: problemY, width: paneW, height: problemH },
    equationFont,
    equationLineHeight,
    equationGap: 10,
    problemGap: g('equationToDots'),
    visualSlot,
    counting: 'phone',
    dotCard: { cell, gap: 16 },
    chips: { ...row, size: chip, ...chipMetrics(chip, false) },
  }
}

function tablet(v: Viewport, landscape: boolean): MathLayout {
  const s = safeRect(v)
  const pad = 16
  const hudH = 96 // h-24
  const emmaSize = v.height * 0.26 // h-[26vh]
  const emma = {
    x: s.x + pad,
    y: s.y + hudH,
    width: emmaSize,
    height: emmaSize,
  }
  const twoLines = ribbonSlot(TABLET_CAPTION_PT, TABLET_RIBBON_PADDING, 2)

  // Portrait: ribbon beside Emma (gap-4). Landscape: pl-[calc(26vh+2rem)].
  const ribbonX = landscape ? s.x + emmaSize + 32 : emma.x + emmaSize + 16
  const ribbonY = s.y + hudH + 16 // mt-4
  const rowH = landscape
    ? Math.max(88, 16 + twoLines) // landscape:min-h-[88px], reserved 2 lines
    : Math.max(emmaSize, 16 + twoLines)

  const chipsY = s.y + s.height - 32 - TABLET_CHIP // mb-8
  // Landscape: the problem column starts at pl-[calc(26vh+1rem)], then px-4.
  const columnX = landscape ? s.x + emmaSize + 16 : s.x
  const problemTop = s.y + hudH + rowH + 16 // mt-4
  const row = chipRow(columnX + pad, s.x + s.width - pad, chipsY, TABLET_CHIP)
  return {
    form: landscape ? 'tablet-landscape' : 'tablet-portrait',
    landscape,
    tablet: true,
    safe: s,
    emma,
    content: {
      x: columnX + pad,
      y: problemTop,
      width: s.x + s.width - pad - (columnX + pad),
      height: chipsY - problemTop,
    },
    captionFontSize: TABLET_CAPTION_PT,
    captionLineHeight: TABLET_CAPTION_PT * CAPTION_LINE_HEIGHT,
    hud: {
      kind: 'row',
      rect: { x: s.x, y: s.y, width: s.width, height: hudH },
      padX: pad,
    },
    hudMetrics: TABLET_HUD,
    ribbon: {
      x: ribbonX,
      y: ribbonY,
      width: s.x + s.width - pad - ribbonX,
      maxHeight: landscape ? twoLines : rowH - 16,
    },
    ribbonPadding: TABLET_RIBBON_PADDING,
    problem: {
      x: columnX + pad,
      y: problemTop,
      width: s.x + s.width - pad - (columnX + pad),
      height: Math.max(0, chipsY - problemTop),
    },
    equationFont: TABLET_EQUATION_PT,
    equationLineHeight: Math.round(TABLET_EQUATION_PT * EQUATION_LINE),
    equationGap: 16, // gap-4
    problemGap: 24, // gap-6
    visualSlot: null,
    counting: 'tablet',
    dotCard: { cell: DOT_CARD_CELL, gap: 24 },
    chips: {
      ...row,
      gap: CHIP_GAP_MAX,
      size: TABLET_CHIP,
      ...chipMetrics(TABLET_CHIP, true),
    },
  }
}

export function mathLayout(v: Viewport): MathLayout {
  const landscape = isLandscape(v)
  if (isTablet(v)) return tablet(v, landscape)
  return landscape ? phoneLandscape(v) : phonePortrait(v)
}

// ── Counting row ──────────────────────────────────────────────────────────

export interface CountingMetrics {
  /** One counter (flower) glyph's size. */
  size: number
  /** Between counters of one group. */
  gap: number
  /** Width of the `+` between the two groups (gaps included). */
  between: number
  /** `+` glyph size. */
  plusFont: number
  /** Counters per row of a group (`Infinity`: one row). */
  perRow: number
  /** Width of the whole row. */
  width: number
  /** Height of the whole row. */
  height: number
}

/**
 * Counters are drawn for single-digit addends only (sums up to 9 + 9, the
 * range the web's `flowerRowFontSizeRem` is designed for). A two-digit
 * addend (the two-digit tiers: `20 + 3`, `45 + 8` in canon) gets no
 * counting row: their spec skips the visual detour ("the 3-chip
 * recognition format IS the representational layer",
 * `design/math/two-digit-addsub-content.md`). The web screen still draws
 * every flower in one row there (23–53 of them), which runs past the
 * screen and is clipped; natively the row is left out.
 */
export const MAX_COUNTED_ADDEND = 9

/**
 * The counting row for `a + b` in `width`, or `null` when an addend has two
 * digits (see {@link MAX_COUNTED_ADDEND}). Tablet: the web's flower row
 * (`1em` glyphs at `flowerRowFontSizeRem`, `gap-1` inside a group, `gap-6`
 * around the `+`, never wraps). Phone (spec § 4): 24 pt counters when the
 * total is ≤ 10, else 20 pt; 8 pt apart, 24 pt between the groups (the `+`
 * sits in that gap); when the row does not fit, each group wraps into rows
 * of 5 instead of shrinking.
 */
export function countingMetrics(
  layout: Pick<MathLayout, 'counting'>,
  addendA: number,
  addendB: number,
  width: number,
): CountingMetrics | null {
  if (addendA > MAX_COUNTED_ADDEND || addendB > MAX_COUNTED_ADDEND) {
    return null
  }
  if (layout.counting === 'tablet') {
    const size = flowerRowFontSizeRem(addendA, addendB) * 16
    const group = (n: number) => (n <= 0 ? 0 : n * size + (n - 1) * 4)
    const between = 24 + size * 0.6 + 24
    return {
      size,
      gap: 4,
      between,
      plusFont: size,
      perRow: Infinity,
      width: group(addendA) + between + group(addendB),
      height: size,
    }
  }
  const total = addendA + addendB
  const size = total <= 10 ? PHONE_DOT : PHONE_DOT_SMALL
  const groupWidth = (n: number, perRow: number) => {
    const cols = Math.min(n, perRow)
    return cols <= 0 ? 0 : cols * size + (cols - 1) * PHONE_DOT_GAP
  }
  const oneRow =
    groupWidth(addendA, Infinity) +
    PHONE_GROUP_GAP +
    groupWidth(addendB, Infinity)
  const perRow = oneRow <= width ? Infinity : 5
  const rows = (n: number) =>
    perRow === Infinity ? 1 : Math.max(1, Math.ceil(n / perRow))
  const maxRows = Math.max(rows(addendA), rows(addendB))
  return {
    size,
    gap: PHONE_DOT_GAP,
    between: PHONE_GROUP_GAP,
    plusFont: size * 0.75,
    perRow,
    width:
      groupWidth(addendA, perRow) +
      PHONE_GROUP_GAP +
      groupWidth(addendB, perRow),
    height: maxRows * size + (maxRows - 1) * PHONE_DOT_GAP,
  }
}

// ── The take-away picture ─────────────────────────────────────────────────
//
// `design/native/take-away-picture.md` § 2; `takeAwayLayout.test.ts` pins
// its table.

/** The flash's ten-frame border (`glyphs.tsx` `CELL_BORDER`). */
export const TAKE_AWAY_BORDER = '#F48FB1'

export interface TakeAwayMetrics {
  /** The step's frames: one (sub-to-10) or the ten and the ones. */
  frames: 1 | 2
  /** One flower glyph. */
  flower: number
  /** Between flowers, and from a flower to the frame's edge. */
  gap: number
  /** Between the two frames. */
  between: number
  frameWidth: number
  frameHeight: number
  /** The step's whole row (both frames for sub-to-20). */
  width: number
  height: number
  /** The card's border and corner radius. */
  border: number
  radius: number
  /** A lifted flower's copy rises this far as it fades. */
  liftRise: number
  /** Slot `k`'s centre in its frame (1 = top-left, reading order). */
  slotCentre: (k: number) => { x: number; y: number }
}

/**
 * The ten-frame(s) of a take-away problem on `step` in `width` (§ 2): cell
 * pitch c = min(f₀ + g, ⌊(slot − g) / 2⌋, the width cap), flower f = c − g,
 * a frame 5c + g by 2c + g. f₀ is 24 pt (sub-to-10) or 20 (sub-to-20) on a
 * phone, 48 or 40 on a tablet, where the row takes the frame's height.
 */
export function takeAwayMetrics(
  layout: Pick<MathLayout, 'counting' | 'visualSlot' | 'form'>,
  step: 'sub-to-10' | 'sub-to-20',
  width: number,
): TakeAwayMetrics {
  const tablet = layout.counting === 'tablet'
  const landscape = layout.form === 'phone-landscape'
  const frames = step === 'sub-to-20' ? 2 : 1
  const gap = landscape ? 6 : 8
  const between = tablet ? 32 : 24
  const f0 = tablet ? (frames === 1 ? 48 : 40) : frames === 1 ? 24 : 20
  const slotCap =
    layout.visualSlot === null
      ? Infinity
      : Math.floor((layout.visualSlot - gap) / 2)
  const widthCap =
    frames === 1
      ? Math.floor((width - gap) / 5)
      : Math.floor((width - between - 2 * gap) / 10)
  const pitch = Math.min(f0 + gap, slotCap, widthCap)
  const frameWidth = 5 * pitch + gap
  const frameHeight = 2 * pitch + gap
  return {
    frames,
    flower: pitch - gap,
    gap,
    between,
    frameWidth,
    frameHeight,
    width: frames === 1 ? frameWidth : 2 * frameWidth + between,
    height: frameHeight,
    border: tablet ? 3 : 2,
    radius: Math.round(0.27 * frameHeight),
    liftRise: tablet ? 32 : landscape ? 16 : 24,
    slotCentre: (k) => ({
      x: gap / 2 + (((k - 1) % 5) + 0.5) * pitch,
      y: gap / 2 + ((k <= 5 ? 0 : 1) + 0.5) * pitch,
    }),
  }
}

// ── Number Garden 1 and 8–11 (number recognition, skip counting,
//    multiplication) ────────────────────────────────────────────────────
//
// `design/native/math-skip-counting-multiplication-native.md` § 2, § 3,
// § 6 and § 10; `mathLayout.test.ts` pins its § 6 table.

/** Problem kinds the layout tells apart (core's `ExtendedMathProblemKind`). */
export type MathLayoutKind =
  | 'arithmetic'
  | 'recognize'
  | 'skip-count'
  | 'multiply'
  | 'missing-addend'
  | 'divide'
  | 'place-value'
  | 'more'

/**
 * The frame a problem takes: its kind, but an adding-big-numbers sum (an
 * arithmetic problem of a `PLACE_VALUE_ARITHMETIC_NODES` step, its step
 * `node`) takes the place-value frame, since it draws the trays (content
 * wave 5 § 3.3). Math reports it to App; App uses it before the report.
 */
export function mathLayoutKind(
  problem: ExtendedMathProblem | undefined,
  node: SkillNode | null | undefined,
): MathLayoutKind {
  if (problem === undefined) return 'arithmetic'
  return isPlaceValueArithmetic(problem, node) ? 'place-value' : problem.kind
}

export interface ExtendedMathLayout extends MathLayout {
  /** The chips' row (Math's) or the right-edge column (Word Song's L). */
  chipsAxis: 'row' | 'column'
  /** The ribbon's line cap (`CaptionRibbon` `maxLines`); `undefined`: none. */
  ribbonLines: number | undefined
}

/** Phone landscape's chip column (Word Song's L): chips clamp(88, …, 104). */
const COLUMN_CHIP_MIN = 88
const COLUMN_CHIP_MAX = 104
const COLUMN_CHIP_GAP = 16

/**
 * Math's layout for a plan of `kind` (spec § 6):
 *
 * - arithmetic, missing numbers, number recognition, and every tablet
 *   form: `mathLayout`.
 * - Phone portrait, skip / multiply / divide / hundreds: Math's P frame; the ribbon is
 *   capped at 4 lines (they end at 253 pt on the 375×667 floor, above the
 *   problem's top at 259).
 * - Phone landscape, skip / multiply / divide / hundreds: Word Song's L frame
 *   (`wordSongLayout.ts`, mirrored here: importing it would be a require
 *   cycle): Math's Emma column and back arrow, the HUD row, the ribbon at
 *   safe y + 60 in a 2-line (skip, divide, hundreds) or 1-line (multiply) slot, the
 *   chip column
 *   clamp(88, ⌊(safe h − 56) / 3⌋, 104) on the right, and the stage between
 *   as the problem rect.
 */
export function extendedMathLayout(
  v: Viewport,
  kind: MathLayoutKind,
): ExtendedMathLayout {
  const m = mathLayout(v)
  // A missing number keeps Math's arithmetic frames (content wave 1 § 1.1).
  if (
    kind === 'arithmetic' ||
    kind === 'missing-addend' ||
    kind === 'recognize' ||
    m.tablet
  ) {
    return { ...m, chipsAxis: 'row', ribbonLines: undefined }
  }
  if (m.form === 'phone-portrait') {
    return { ...m, chipsAxis: 'row', ribbonLines: 4 }
  }
  const s = safeRect(v)
  const pad = 16
  const column = clamp(120, Math.round(s.width * 0.24), 200)
  const chip = clamp(
    COLUMN_CHIP_MIN,
    Math.floor((s.height - 56) / 3),
    COLUMN_CHIP_MAX,
  )
  const chipX = s.x + s.width - pad - chip
  const chipsH = 3 * chip + 2 * COLUMN_CHIP_GAP
  const paneX = s.x + column
  const paneW = chipX - 16 - paneX
  const hudRow = { x: paneX, y: s.y + 8, width: paneW, height: 44 }
  // Sharing takes skip's 2-line slot (content wave 2 § 2.3), and hundreds
  // takes sharing's frames (content wave 3 § 3.3).
  const ribbonLines =
    kind === 'skip-count' ||
    kind === 'divide' ||
    kind === 'place-value' ||
    kind === 'more'
      ? 2
      : 1
  const ribbonH = ribbonSlot(
    PHONE_CAPTION_PT,
    PHONE_RIBBON_PADDING,
    ribbonLines,
  )
  const ribbonY = s.y + 60
  const stageTop = ribbonY + ribbonH + 8
  return {
    ...m,
    content: { x: paneX, y: hudRow.y, width: paneW, height: s.height },
    hud: {
      kind: 'split',
      back: { x: s.x + pad, y: s.y + 8, width: PHONE_BACK, height: PHONE_BACK },
      beads: hudRow,
      status: hudRow,
    },
    ribbon: { x: paneX, y: ribbonY, width: paneW, maxHeight: ribbonH },
    problem: {
      x: paneX,
      y: stageTop,
      width: paneW,
      height: Math.max(0, s.y + s.height - 16 - stageTop),
    },
    problemGap: 8,
    chips: {
      rect: {
        x: chipX,
        y: s.y + s.height - 16 - chipsH,
        width: chip,
        height: chipsH,
      },
      size: chip,
      gap: COLUMN_CHIP_GAP,
      ...chipMetrics(chip, false),
    },
    chipsAxis: 'column',
    ribbonLines,
  }
}

/**
 * Fredoka 700 advance widths (em) of the glyphs the new problem visuals
 * draw, read from `Fredoka_700Bold.ttf`'s `hmtx` table (unitsPerEm 1000).
 * "10" at 22 pt measures 20.77 pt, as the spec's § 10 says (20.8).
 */
const FREDOKA_BOLD_ADVANCE: Record<string, number> = {
  '0': 0.565,
  '1': 0.379,
  '2': 0.566,
  '3': 0.565,
  '4': 0.551,
  '5': 0.493,
  '6': 0.521,
  '7': 0.522,
  '8': 0.541,
  '9': 0.521,
  '?': 0.476,
  '+': 0.49,
  // U+2212, more and less's "−200" pill (content wave 4 § 2.2, D4).
  '\u2212': 0.54,
}

/** Width of `text` (digits, "?", "+", "−") in Fredoka 700 at `size`. */
export function fredokaBoldWidth(text: string, size: number): number {
  let em = 0
  for (const ch of text) em += FREDOKA_BOLD_ADVANCE[ch] ?? 0.6
  return em * size
}

// ── Skip counting: the stepping-stone track (spec § 2) ──────────────────

/** At most this many terms are drawn (the last ones); then the "?". */
export const SKIP_MAX_TERMS = 8
/** Up to this many cells take one row; more take two balanced rows. */
export const SKIP_ONE_ROW_MAX = 5

export interface SkipTrackMetrics {
  /** Stone diameter D. */
  stone: number
  /** Between stones in a row (G). */
  gap: number
  /** Between the two rows. */
  rowGap: number
  /** Above each row, for its hops. */
  hopZone: number
  /** The numerals (and "?"), one size for the session. */
  numeralFont: number
  hopStroke: number
  /** The hop's apex, above the stone tops. */
  hopApex: number
  hopLabelFont: number
  hopArrow: number
}

export interface SkipTrackCell {
  /** Top-left of the stone, in the track's own box. */
  x: number
  y: number
  row: 0 | 1
}

export interface SkipTrackGeometry {
  cells: SkipTrackCell[]
  width: number
  height: number
}

/** The cells of a problem: its last {@link SKIP_MAX_TERMS} terms + "?". */
export function skipTrackCellCount(termCount: number): number {
  return Math.min(termCount, SKIP_MAX_TERMS) + 1
}

function skipTrackSize(
  n: number,
  d: number,
  g: number,
  hop: number,
  rowGap: number,
): { width: number; height: number } {
  if (n <= SKIP_ONE_ROW_MAX) {
    return { width: n * d + (n - 1) * g, height: hop + d }
  }
  const c1 = Math.ceil(n / 2)
  const c2 = n - c1
  return {
    width: Math.max(c1 * d + (c1 - 1) * g, (d + g) / 2 + c2 * d + (c2 - 1) * g),
    height: 2 * (hop + d) + rowGap,
  }
}

/**
 * The track's sizes for a plan (spec § 2, decision 10: one stone size for
 * the session). D is the largest value ≤ 64 (tablet 88) at which the plan's
 * longest sequence fits the problem rect; the numerals start at round(D / 2)
 * and step down 2 pt until the widest one (terms and answers) fits D − 12.
 */
export function skipTrackMetrics(
  layout: Pick<MathLayout, 'tablet' | 'problem'>,
  problems: readonly { sequence: readonly number[]; correct: number }[],
): SkipTrackMetrics {
  const tablet = layout.tablet
  const gap = tablet ? 24 : 16
  const rowGap = 8
  const hopZone = tablet ? 40 : 30
  const n = Math.max(
    2,
    ...problems.map((p) => skipTrackCellCount(p.sequence.length)),
  )
  let stone = tablet ? 88 : 64
  while (stone > 1) {
    const size = skipTrackSize(n, stone, gap, hopZone, rowGap)
    if (
      size.width <= layout.problem.width &&
      size.height <= layout.problem.height
    ) {
      break
    }
    stone -= 1
  }
  const numerals = problems.flatMap((p) => [
    ...p.sequence.slice(-SKIP_MAX_TERMS),
    p.correct,
  ])
  const widest = numerals.reduce(
    (w, n) => Math.max(w, fredokaBoldWidth(String(n), 1)),
    fredokaBoldWidth('?', 1),
  )
  let numeralFont = Math.round(stone / 2)
  while (numeralFont > 2 && widest * numeralFont > stone - 12) {
    numeralFont -= 2
  }
  return {
    stone,
    gap,
    rowGap,
    hopZone,
    numeralFont,
    hopStroke: tablet ? 4 : 3,
    hopApex: tablet ? 16 : 12,
    hopLabelFont: tablet ? 22 : 16,
    hopArrow: 6,
  }
}

/** Where a problem's `cellCount` stones sit (row 2 indented by (D + G) / 2). */
export function skipTrackGeometry(
  m: SkipTrackMetrics,
  cellCount: number,
): SkipTrackGeometry {
  const { stone: d, gap: g, hopZone, rowGap } = m
  const twoRows = cellCount > SKIP_ONE_ROW_MAX
  const c1 = twoRows ? Math.ceil(cellCount / 2) : cellCount
  const cells: SkipTrackCell[] = []
  for (let i = 0; i < cellCount; i++) {
    if (i < c1) {
      cells.push({ x: i * (d + g), y: hopZone, row: 0 })
    } else {
      cells.push({
        x: (d + g) / 2 + (i - c1) * (d + g),
        y: 2 * hopZone + d + rowGap,
        row: 1,
      })
    }
  }
  return { cells, ...skipTrackSize(cellCount, d, g, hopZone, rowGap) }
}

// ── Multiplication: the groups row (spec § 3) ───────────────────────────

/** Groups are drawn for `factorA` 1..10 and `factorB` 1..5 (spec § 1). */
export const MAX_GROUP_SIZE = 10
export const MAX_GROUPS = 5
/** Flowers fill columns of this many, top to bottom. */
export const GROUP_COLUMN = 5

export interface GroupsMetrics {
  flower: number
  flowerGap: number
  /** Inside the plate's edge, its 2 pt border included. */
  pad: number
  border: number
  radius: number
  tagHeight: number
  tagFont: number
  plusFont: number
  gapMin: number
  gapMax: number
  /** Reserved for the session: half a tag + the plan's tallest plate. */
  slot: number
}

export function groupsAreDrawn(factorA: number, factorB: number): boolean {
  return (
    Number.isInteger(factorA) &&
    Number.isInteger(factorB) &&
    factorA >= 1 &&
    factorA <= MAX_GROUP_SIZE &&
    factorB >= 1 &&
    factorB <= MAX_GROUPS
  )
}

function plateFor(
  flower: number,
  flowerGap: number,
  pad: number,
  factorA: number,
): { width: number; height: number } {
  const cols = Math.ceil(factorA / GROUP_COLUMN)
  const rows = Math.min(factorA, GROUP_COLUMN)
  return {
    width: cols * flower + (cols - 1) * flowerGap + 2 * pad,
    height: rows * flower + (rows - 1) * flowerGap + 2 * pad,
  }
}

/** The groups' sizes for a plan of multiply problems. */
export function groupsMetrics(
  layout: Pick<MathLayout, 'tablet'>,
  problems: readonly { factorA: number; factorB: number }[],
): GroupsMetrics {
  const tablet = layout.tablet
  const flower = tablet ? 24 : 20
  const flowerGap = tablet ? 6 : 4
  const pad = tablet ? 8 : 6
  const tagHeight = tablet ? 32 : 28
  const drawn = problems.filter((p) => groupsAreDrawn(p.factorA, p.factorB))
  const tallest = drawn.reduce(
    (h, p) => Math.max(h, plateFor(flower, flowerGap, pad, p.factorA).height),
    0,
  )
  return {
    flower,
    flowerGap,
    pad,
    border: 2,
    radius: tablet ? 16 : 12,
    tagHeight,
    tagFont: tablet ? 24 : 20,
    plusFont: tablet ? 20 : 16,
    gapMin: tablet ? 16 : 12,
    gapMax: tablet ? 32 : 24,
    slot: drawn.length === 0 ? 0 : tagHeight / 2 + tallest,
  }
}

export function plateSize(
  m: GroupsMetrics,
  factorA: number,
): { width: number; height: number } {
  return plateFor(m.flower, m.flowerGap, m.pad, factorA)
}

/** The row of `factorB` plates of `factorA` in `width`: the gap between
 *  plates (clamp(12, fit, 24), tablet clamp(16, fit, 32)) and the row's
 *  width. */
export function groupsRow(
  m: GroupsMetrics,
  factorA: number,
  factorB: number,
  width: number,
): { gap: number; width: number; plate: { width: number; height: number } } {
  const plate = plateSize(m, factorA)
  const fit =
    factorB <= 1
      ? m.gapMax
      : Math.floor((width - factorB * plate.width) / (factorB - 1))
  const gap = clamp(m.gapMin, fit, m.gapMax)
  return {
    gap,
    width: factorB * plate.width + (factorB - 1) * gap,
    plate,
  }
}

/** The multiply block: equation, `problemGap`, the groups slot. */
export function multiplyBlockHeight(
  layout: Pick<MathLayout, 'equationLineHeight' | 'problemGap'>,
  m: GroupsMetrics,
): number {
  return m.slot === 0
    ? layout.equationLineHeight
    : layout.equationLineHeight + layout.problemGap + m.slot
}

// ── Number recognition: the 1–10 strip (spec § 10) ──────────────────────

export interface NumberStripMetrics {
  cell: number
  height: number
  font: number
  radius: number
  border: number
  divider: number
  dot: number
  ring: number
}

export function numberStripMetrics(
  layout: Pick<MathLayout, 'tablet' | 'problem'>,
): NumberStripMetrics {
  const tablet = layout.tablet
  return {
    cell: Math.min(Math.floor(layout.problem.width / 10), tablet ? 72 : 48),
    height: tablet ? 64 : 48,
    font: tablet ? 32 : 22,
    radius: 12,
    border: 2,
    divider: 1,
    dot: 6,
    ring: 4,
  }
}

// ── Sharing: the cloth, the pile and the plates (content wave 2 § 2.3) ──
//
// `design/native/content-wave-2.md` § 2.2, § 2.3, amended by Kyle's UX calls
// on #587; `shareLayout.test.ts` pins the tables.
//
// - The cloth reserves room left of the pile for the total tag (call 2).
// - The plates are round plates seen from above, sharing's own (the plate
//   call, after Thomas's iPad check: "the plates look like boxes"): a white
//   well inside a tinted rim, diameter D = 3.5 × the plate-flower size f, in
//   one row. `GroupsRow`'s trays stay multiply's. f, D and the gap are
//   computed once per plan from its largest plate count, so a plate's size
//   never gives the answer away (AC 10).
// - The dealt flowers settle into the die face of the share (2–6), the k-th
//   flower on a plate taking the face's k-th slot, so round 1 always lands
//   top-left.

/** The pile's flowers are at most this big (pt); tablet {@link SHARE_TABLET_FLOWER_MAX}. */
export const SHARE_PHONE_FLOWER_MAX = 20
export const SHARE_TABLET_FLOWER_MAX = 24
/** Between the total tag's inner edge and the pile's first flower (call 2). */
export const SHARE_TAG_CLEARANCE = 4
/** Pile rows hold this many flowers (P and tablet); L draws one row. */
export const SHARE_PILE_ROW = 10
/** A plate's diameter in plate-flower sizes. */
export const SHARE_PLATE_FLOWERS = 3.5
/** The well's diameter as a fraction of the plate's. */
export const SHARE_WELL_RATIO = 0.74
/** Die-face slot offsets from the plate's centre, in plate-flower sizes. */
export const SHARE_SLOT_X = 0.6
export const SHARE_SLOT_Y = 1.05

/** A slot of the die-face lattice (`T`op / `M`iddle / `B`ottom, `L`eft /
 *  `R`ight, `C`entre). */
export type ShareSlot = 'TL' | 'TR' | 'ML' | 'C' | 'MR' | 'BL' | 'BR'

/** The die face of each share, its slots in deal order (round 1 → TL). */
export const SHARE_FACES: Readonly<Record<number, readonly ShareSlot[]>> = {
  2: ['TL', 'BR'],
  3: ['TL', 'C', 'BR'],
  4: ['TL', 'TR', 'BL', 'BR'],
  5: ['TL', 'TR', 'C', 'BL', 'BR'],
  6: ['TL', 'TR', 'ML', 'MR', 'BL', 'BR'],
}

const SLOT_UNIT: Readonly<Record<ShareSlot, [number, number]>> = {
  TL: [-1, -1],
  TR: [1, -1],
  ML: [-1, 0],
  C: [0, 0],
  MR: [1, 0],
  BL: [-1, 1],
  BR: [1, 1],
}

/** A slot's offset from the plate's centre for plate flowers of size `f`. */
export function shareSlotOffset(slot: ShareSlot, f: number): SharePoint {
  const [ux, uy] = SLOT_UNIT[slot]
  return { x: ux * SHARE_SLOT_X * f, y: uy * SHARE_SLOT_Y * f }
}

export interface ShareMetrics {
  /** The pile's flower size `s`. */
  pileFlower: number
  /** Between pile flowers, and after every 5th. */
  pileGap: number
  pileFifthGap: number
  /** Between the pile's rows. */
  pileRowGap: number
  /** Flowers per pile row (10; L: the plan's largest pile, one row). */
  pileRow: number
  /** The cloth's right, top and bottom padding. */
  clothPad: number
  /** The cloth's left padding: room for the total tag's inner half plus
   *  {@link SHARE_TAG_CLEARANCE} (call 2). */
  clothLeftPad: number
  clothRadius: number
  cloth: { width: number; height: number }
  /** The tags: multiply's pill (28 pt, tablet 32; Fredoka 20, tablet 24). */
  tagHeight: number
  tagFont: number
  /** The total tag's width for the plan's largest pile. */
  tagWidth: number
  /** The tag's outer half, `ceil(tagWidth / 2)`, reserved left of the cloth. */
  tagOuter: number
  /** The plate flowers' size f. */
  plateFlower: number
  /** Every plate's diameter, `3.5 × f`. */
  plate: number
  /** Between the plates of a row. */
  plateGap: number
  /** The rim's edge and the well's line. */
  plateBorder: number
  wellBorder: number
  /** A "?" tag's bottom edge sits this far above its plate. */
  plateTagGap: number
  /** Cloth → plate slot. */
  gap: number
  /** Cloth + gap + tag + tag gap + plate. */
  block: number
  /** The deal's arc height h. */
  arc: number
}

/** A tag pill's width for `text` (multiply's tag: 8 pt side padding, at
 *  least as wide as it is tall). */
export function pillWidth(text: string, font: number, height: number): number {
  return Math.max(height, Math.ceil(fredokaBoldWidth(text, font)) + 16)
}

/** Width of `n` pile flowers in rows of `row` at size `s`. */
function pileRowWidth(
  n: number,
  row: number,
  s: number,
  gap: number,
  fifth: number,
): number {
  const cols = Math.min(n, row)
  if (cols <= 0) return 0
  return (
    cols * s + (cols - 1) * gap + Math.floor((cols - 1) / 5) * (fifth - gap)
  )
}

/** The sharing visuals' sizes for a plan of divide problems (§ 2.3). */
export function shareMetrics(
  layout: Pick<MathLayout, 'tablet' | 'form' | 'problem' | 'problemGap'>,
  problems: readonly { total: number; plates: number; correct: number }[],
): ShareMetrics {
  const tablet = layout.tablet
  const oneRow = layout.form === 'phone-landscape'
  const width = layout.problem.width
  const maxPile = problems.reduce((m, p) => Math.max(m, p.total), 0)
  const maxPlates = Math.max(
    1,
    problems.reduce((m, p) => Math.max(m, p.plates), 0),
  )
  const pileGap = oneRow ? 2 : tablet ? 6 : 4
  const pileFifthGap = oneRow ? 6 : tablet ? 16 : 12
  const pileRowGap = tablet ? 6 : 4
  const clothPad = tablet ? 8 : 6
  const tagHeight = tablet ? 32 : 28
  const tagFont = tablet ? 24 : 20
  // Call 2: the tag stays centred on the cloth's left edge; the cloth's left
  // padding clears its inner half, and its outer half is reserved outside.
  const tagWidth = pillWidth(String(maxPile), tagFont, tagHeight)
  const tagOuter = Math.ceil(tagWidth / 2)
  const clothLeftPad = tagOuter + SHARE_TAG_CLEARANCE
  const pileRow = oneRow ? Math.max(1, maxPile) : SHARE_PILE_ROW
  const rows = Math.max(1, Math.ceil(maxPile / pileRow))
  const clothWidth = (s: number) =>
    clothLeftPad +
    pileRowWidth(maxPile, pileRow, s, pileGap, pileFifthGap) +
    clothPad
  const fits = (s: number) => clothWidth(s) + tagOuter <= width
  let s = tablet ? SHARE_TABLET_FLOWER_MAX : SHARE_PHONE_FLOWER_MAX
  while (s > 8 && !fits(s)) s -= 1
  const cloth = {
    width: clothWidth(s),
    height: rows * s + (rows - 1) * pileRowGap + 2 * clothPad,
  }
  // The plate call: f = min(20, floor((W − 6 (n − 1)) / (3.5 n))), tablet
  // cap 24 and minimum gap 8; the gap clamp(6, fit, 24), tablet
  // clamp(8, fit, 32); n = the plan's largest plate count.
  const gapMin = tablet ? 8 : 6
  const gapMax = tablet ? 32 : 24
  const plateFlower = Math.min(
    tablet ? SHARE_TABLET_FLOWER_MAX : SHARE_PHONE_FLOWER_MAX,
    Math.floor(
      (width - gapMin * (maxPlates - 1)) / (SHARE_PLATE_FLOWERS * maxPlates),
    ),
  )
  const plate = SHARE_PLATE_FLOWERS * plateFlower
  const plateGap =
    maxPlates <= 1
      ? gapMax
      : clamp(gapMin, (width - maxPlates * plate) / (maxPlates - 1), gapMax)
  const plateTagGap = tablet ? 6 : 4
  return {
    pileFlower: s,
    pileGap,
    pileFifthGap,
    pileRowGap,
    pileRow,
    clothPad,
    clothLeftPad,
    clothRadius: tablet ? 20 : 16,
    cloth,
    tagHeight,
    tagFont,
    tagWidth,
    tagOuter,
    plateFlower,
    plate,
    plateGap,
    plateBorder: tablet ? 2.5 : 2,
    wellBorder: tablet ? 2 : 1.5,
    plateTagGap,
    gap: layout.problemGap,
    block: cloth.height + layout.problemGap + tagHeight + plateTagGap + plate,
    arc: tablet ? 40 : 32,
  }
}

export interface SharePoint {
  x: number
  y: number
}

export interface ShareGeometry {
  /** The cloth, in the block (origin: the block's top-left). */
  cloth: { x: number; y: number; width: number; height: number }
  /** The total tag's centre (on the cloth's left edge). */
  totalTag: SharePoint
  /** Pile cell centres, reading order (cell 0 top-left). */
  pile: readonly SharePoint[]
  /** The plates' bounding squares, left to right. */
  plates: readonly { x: number; y: number; width: number; height: number }[]
  /** Each plate's "?" tag centre (centred above it). */
  plateTags: readonly SharePoint[]
  /** Each plate's cell centres for its share: the die face's slots, in deal
   *  order. */
  plateCells: readonly (readonly SharePoint[])[]
}

/** Where everything of one problem sits in a block `width` wide. */
export function shareGeometry(
  m: ShareMetrics,
  total: number,
  plates: number,
  width: number,
): ShareGeometry {
  const share = plates > 0 ? Math.floor(total / plates) : 0
  // The cloth and the tag's outer half, centred together.
  const groupWidth = m.cloth.width + m.tagOuter
  const clothX = (width - groupWidth) / 2 + m.tagOuter
  const cloth = { x: clothX, y: 0, ...m.cloth }
  const s = m.pileFlower
  const pile: SharePoint[] = []
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / m.pileRow)
    const c = i % m.pileRow
    pile.push({
      x:
        clothX +
        m.clothLeftPad +
        c * (s + m.pileGap) +
        Math.floor(c / 5) * (m.pileFifthGap - m.pileGap) +
        s / 2,
      y: m.clothPad + r * (s + m.pileRowGap) + s / 2,
    })
  }
  const rowWidth = plates * m.plate + Math.max(0, plates - 1) * m.plateGap
  const rowX = (width - rowWidth) / 2
  const plateY = m.cloth.height + m.gap + m.tagHeight + m.plateTagGap
  const platesOut = Array.from({ length: plates }, (_, k) => ({
    x: rowX + k * (m.plate + m.plateGap),
    y: plateY,
    width: m.plate,
    height: m.plate,
  }))
  const face = SHARE_FACES[share] ?? []
  const plateCells = platesOut.map((p) => {
    const cx = p.x + m.plate / 2
    const cy = p.y + m.plate / 2
    return face.map((slot) => {
      const o = shareSlotOffset(slot, m.plateFlower)
      return { x: cx + o.x, y: cy + o.y }
    })
  })
  return {
    cloth,
    totalTag: { x: clothX, y: m.cloth.height / 2 },
    pile,
    plates: platesOut,
    plateTags: platesOut.map((p) => ({
      x: p.x + m.plate / 2,
      y: p.y - m.plateTagGap - m.tagHeight / 2,
    })),
    plateCells,
  }
}

// ── Hundreds: trays of flats, rods and cubes (content wave 3 § 3.2–§ 3.3) ──
//
// `design/native/content-wave-3.md` § 3.3; `placeValueLayout.test.ts` pins
// its table. One unit u per plan, from the largest counts shown at any
// point (a "more" problem's start and its answer), so a tray's size never
// gives the answer away:
//
// - Width: the trays, hundreds (10 + 1.2 (H − 1)) u, tens (1.3 T − 0.3) u,
//   ones 2.3 u (two columns of 5), each padded 0.5 u, 2 gaps g (12, tablet
//   16) between them; L and TL add the number tag's column + 8.
// - Height: the fan (10 + 1.2 (H − 1)) u + u, the tag row (36, tablet 42);
//   P and TP add the number-tag row on top when the plan has a "more".
// - u: the largest whole number ≤ 10 (tablet ≤ 20) that fits the problem
//   rect.
//
// Adding big numbers (`content-wave-5.md` § 3.3) draws two trays, tens and
// ones, under today's equation: width (1.3 T − 0.3 + 1) u + (1.3 C − 0.3 +
// 1) u + g (T the answers' rods, C the cube columns before the bundle),
// height 11u + the tag row, and u fits the problem rect less the equation
// line and the equation-to-visual gap.

/** A flat's side, a rod's length (in u). */
export const PV_TEN = 10
/** The flats' fan step (up and right), in u. */
export const PV_FAN_STEP = 1.2
/** Between rods, and between the two cube columns, in u. */
export const PV_ROD_GAP = 0.3
/** Cubes stack in columns of this many, bottom up. */
export const PV_CUBE_COLUMN = 5
/** A tray's padding, in u. */
export const PV_TRAY_PAD = 0.5
/** More and less's change blocks move this far apart (the build's
 *  `BUILD_STAGGER_MS`, content wave 4 § 2.5). */
export const PV_CHANGE_STAGGER_MS = 90
/** The largest u on a phone / a tablet. */
export const PV_PHONE_U_MAX = 10
export const PV_TABLET_U_MAX = 20

type Place = 'hundreds' | 'tens' | 'ones'
const PLACES: readonly Place[] = ['hundreds', 'tens', 'ones']

/** What the hundreds layout reads of a problem (core's `HundredsProblem`),
 *  and of adding big numbers' sums (content wave 5 § 3.6): two trays. */
export type PlaceValueLayoutProblem =
  | {
      kind: 'place-value'
      hundreds: number
      tens: number
      ones: number
      correct: number
    }
  | MoreLayoutProblem
  | SumLayoutProblem

/** What the layout reads of an adding-big-numbers problem (core's
 *  `ArithmeticProblem` on a `PLACE_VALUE_ARITHMETIC_NODES` step). */
export interface SumLayoutProblem {
  kind: 'arithmetic'
  addendA: number
  addendB: number
  correct: number
}

/** What the layout reads of core's `MoreProblem`. */
export interface MoreLayoutProblem {
  kind: 'more'
  start: number
  step: 10 | 100
  count: MoreCount
  direction: MoreDirection
  correct: number
}

/** A "more" problem's number-tag pill: "+10", "+100" (hundreds), "+200",
 *  "−30" (more and less, U+2212, the take-away equations' sign; content
 *  wave 4 § 2.2). Digits only, no "=". */
export function morePillLabel(p: MoreLayoutProblem): string {
  const change = moreChange(p)
  return `${change < 0 ? '\u2212' : '+'}${Math.abs(change)}`
}

const digitsOf = (n: number): Record<Place, number> => ({
  hundreds: Math.floor(n / 100) % 10,
  tens: Math.floor(n / 10) % 10,
  ones: n % 10,
})

/** The digits a problem shows first (a "more" problem: its start; a sum:
 *  its first number). */
export function startDigits(p: PlaceValueLayoutProblem): Record<Place, number> {
  if (p.kind === 'more') return digitsOf(p.start)
  if (p.kind === 'arithmetic') return digitsOf(p.addendA)
  return { hundreds: p.hundreds, tens: p.tens, ones: p.ones }
}

/** A sum's ones before the bundle: both numbers' cubes (content wave 5
 *  § 3.2; P6 shows 14). */
export const sumOnes = (p: SumLayoutProblem): number =>
  (p.addendA % 10) + (p.addendB % 10)

export interface PlaceValueMetrics {
  /** The trays drawn, left to right: hundreds, tens, ones; adding big
   *  numbers' two, tens and ones (content wave 5 § 3.2). */
  places: readonly Place[]
  u: number
  /** The plan's largest counts shown at any point. */
  maxFlats: number
  maxRods: number
  maxCubes: number
  /** Ones' columns (of 5). */
  cubeColumns: number
  /** Between the trays. */
  trayGap: number
  trayRadius: number
  trayWidths: Record<Place, number>
  trayHeight: number
  /** The three trays and their two gaps. */
  traysWidth: number
  /** The tags: sharing's pill (28 pt, tablet 32; Fredoka 20, tablet 24),
   *  `tagGap` (8, tablet 10) under each tray. */
  tagHeight: number
  tagFont: number
  tagGap: number
  /** The plan has a "more" problem: the number tag's row / column. */
  numberTag: boolean
  numberTagSide: 'top' | 'left'
  /** The widest number tag the plan shows (its starts and answers). */
  numberTagWidth: number
  /** The "+10" / "+100" pills: 20 pt high (tablet 24). */
  pillHeight: number
  pillFont: number
  /** The widest pill the plan shows. */
  pillWidth: number
  /** Tag → its pill. */
  pillGap: number
  /** L and TL: the number tag's column (its tag or its pill, the wider). */
  numberColumn: number
  /** The block the stage centres in the problem rect. */
  block: { width: number; height: number }
  /** A built block drops this far (16, tablet 24); an added one 40. */
  drop: number
  addedRise: number
  /** A lifted block rises this far as it fades out (24, tablet 32;
   *  content wave 4 § 2.5). */
  liftRise: number
  /** The grid line and the outline. */
  gridLine: number
  outline: number
  /** Whether `u` fits the problem rect (the test's "largest" check). */
  fits: (u: number) => boolean
}

/** A pill's width for a "+10" / "+100": 6 pt side padding, at least as wide
 *  as it is tall. */
export function smallPillWidth(text: string, font: number, height: number) {
  return Math.max(height, Math.ceil(fredokaBoldWidth(text, font)) + 12)
}

/** Hundreds' sizes for a plan of hundreds problems (§ 3.3); a plan of
 *  sums only takes adding big numbers' two trays ({@link sumTrayMetrics}). */
export function placeValueMetrics(
  layout: Pick<
    MathLayout,
    'tablet' | 'form' | 'problem' | 'equationLineHeight' | 'problemGap'
  >,
  problems: readonly PlaceValueLayoutProblem[],
): PlaceValueMetrics {
  const sums = problems.filter(
    (p): p is SumLayoutProblem => p.kind === 'arithmetic',
  )
  if (sums.length > 0 && sums.length === problems.length)
    return sumTrayMetrics(layout, sums)
  const tablet = layout.tablet
  const side: 'top' | 'left' =
    layout.form === 'phone-landscape' || layout.form === 'tablet-landscape'
      ? 'left'
      : 'top'
  let maxFlats = 1
  let maxRods = 1
  let maxCubes = 1
  const numbers: number[] = []
  const pills: string[] = []
  for (const p of problems) {
    for (const d of [startDigits(p), digitsOf(p.correct)]) {
      maxFlats = Math.max(maxFlats, d.hundreds)
      maxRods = Math.max(maxRods, d.tens)
      maxCubes = Math.max(maxCubes, d.ones)
    }
    if (p.kind === 'more') {
      numbers.push(p.start, p.correct)
      pills.push(morePillLabel(p))
    }
  }
  const numberTag = numbers.length > 0
  const cubeColumns = Math.ceil(maxCubes / PV_CUBE_COLUMN)
  const trayGap = tablet ? 16 : 12
  const tagHeight = tablet ? 32 : 28
  const tagFont = tablet ? 24 : 20
  const tagGap = tablet ? 10 : 8
  const pillHeight = tablet ? 24 : 20
  const pillFont = tablet ? 17 : 14
  const pillGap = 6
  const numberTagWidth = numbers.reduce(
    (w, n) => Math.max(w, pillWidth(String(n), tagFont, tagHeight)),
    0,
  )
  const pillW = pills.reduce(
    (w, t) => Math.max(w, smallPillWidth(t, pillFont, pillHeight)),
    0,
  )
  const numberColumn = numberTag ? Math.max(numberTagWidth, pillW) : 0
  const fan = PV_TEN + PV_FAN_STEP * (maxFlats - 1)
  const pad = 2 * PV_TRAY_PAD
  const widthsIn = {
    hundreds: fan + pad,
    tens: (1 + PV_ROD_GAP) * maxRods - PV_ROD_GAP + pad,
    ones: (1 + PV_ROD_GAP) * cubeColumns - PV_ROD_GAP + pad,
  }
  const tagRow = tagHeight + tagGap
  const numberRow = numberTag && side === 'top' ? tagHeight + tagGap : 0
  const sizeFor = (u: number) => {
    const traysWidth =
      (widthsIn.hundreds + widthsIn.tens + widthsIn.ones) * u + 2 * trayGap
    const trayHeight = (fan + pad) * u
    const width =
      side === 'left' && numberTag
        ? numberColumn + 8 + traysWidth
        : Math.max(traysWidth, numberTagWidth + pillGap + pillW)
    const height =
      side === 'left'
        ? Math.max(
            trayHeight + tagRow,
            numberTag ? tagHeight + pillGap + pillHeight : 0,
          )
        : numberRow + trayHeight + tagRow
    return { traysWidth, trayHeight, width, height }
  }
  const fits = (u: number) => {
    const s = sizeFor(u)
    return s.width <= layout.problem.width && s.height <= layout.problem.height
  }
  let u = tablet ? PV_TABLET_U_MAX : PV_PHONE_U_MAX
  while (u > 2 && !fits(u)) u -= 1
  const size = sizeFor(u)
  return {
    places: PLACES,
    u,
    maxFlats,
    maxRods,
    maxCubes,
    cubeColumns,
    trayGap,
    trayRadius: tablet ? 16 : 12,
    trayWidths: {
      hundreds: widthsIn.hundreds * u,
      tens: widthsIn.tens * u,
      ones: widthsIn.ones * u,
    },
    trayHeight: size.trayHeight,
    traysWidth: size.traysWidth,
    tagHeight,
    tagFont,
    tagGap,
    numberTag,
    numberTagSide: side,
    numberTagWidth,
    pillHeight,
    pillFont,
    pillWidth: pillW,
    pillGap,
    numberColumn,
    block: { width: size.width, height: size.height },
    drop: tablet ? 24 : 16,
    addedRise: 40,
    liftRise: tablet ? 32 : 24,
    gridLine: 1,
    outline: 1.5,
    fits: (n: number) =>
      n <= (tablet ? PV_TABLET_U_MAX : PV_PHONE_U_MAX) && fits(n),
  }
}

/**
 * Adding big numbers' sizes (content wave 5 § 3.3): two trays, tens and
 * ones, under the equation. The tens tray holds the answers' rods (so the
 * new ten always has a slot), the ones tray the cubes before the bundle
 * (P6's 14: three columns). The block is the trays and their tags; the
 * equation line and the gap above it are Math's, and u fits what they
 * leave of the problem rect.
 */
export function sumTrayMetrics(
  layout: Pick<
    MathLayout,
    'tablet' | 'form' | 'problem' | 'equationLineHeight' | 'problemGap'
  >,
  problems: readonly SumLayoutProblem[],
): PlaceValueMetrics {
  const tablet = layout.tablet
  let maxRods = 1
  let maxCubes = 1
  for (const p of problems) {
    maxRods = Math.max(maxRods, Math.floor(p.correct / 10) % 10)
    maxCubes = Math.max(maxCubes, sumOnes(p), p.correct % 10)
  }
  const cubeColumns = Math.ceil(maxCubes / PV_CUBE_COLUMN)
  const trayGap = tablet ? 16 : 12
  const tagHeight = tablet ? 32 : 28
  const tagFont = tablet ? 24 : 20
  const tagGap = tablet ? 10 : 8
  const pad = 2 * PV_TRAY_PAD
  const widthsIn = {
    hundreds: 0,
    tens: (1 + PV_ROD_GAP) * maxRods - PV_ROD_GAP + pad,
    ones: (1 + PV_ROD_GAP) * cubeColumns - PV_ROD_GAP + pad,
  }
  const tagRow = tagHeight + tagGap
  const room = {
    width: layout.problem.width,
    height:
      layout.problem.height - layout.equationLineHeight - layout.problemGap,
  }
  const sizeFor = (u: number) => {
    const traysWidth = (widthsIn.tens + widthsIn.ones) * u + trayGap
    const trayHeight = (PV_TEN + pad) * u
    return {
      traysWidth,
      trayHeight,
      width: traysWidth,
      height: trayHeight + tagRow,
    }
  }
  const fits = (u: number) => {
    const sz = sizeFor(u)
    return sz.width <= room.width && sz.height <= room.height
  }
  const top = tablet ? PV_TABLET_U_MAX : PV_PHONE_U_MAX
  let u = top
  while (u > 2 && !fits(u)) u -= 1
  const size = sizeFor(u)
  const pillHeight = tablet ? 24 : 20
  return {
    places: ['tens', 'ones'],
    u,
    maxFlats: 0,
    maxRods,
    maxCubes,
    cubeColumns,
    trayGap,
    trayRadius: tablet ? 16 : 12,
    trayWidths: {
      hundreds: 0,
      tens: widthsIn.tens * u,
      ones: widthsIn.ones * u,
    },
    trayHeight: size.trayHeight,
    traysWidth: size.traysWidth,
    tagHeight,
    tagFont,
    tagGap,
    numberTag: false,
    numberTagSide: 'top',
    numberTagWidth: 0,
    pillHeight,
    pillFont: tablet ? 17 : 14,
    pillWidth: 0,
    pillGap: 6,
    numberColumn: 0,
    block: { width: size.width, height: size.height },
    drop: tablet ? 24 : 16,
    addedRise: 40,
    liftRise: tablet ? 32 : 24,
    gridLine: 1,
    outline: 1.5,
    fits: (n: number) => n <= top && fits(n),
  }
}

/** Adding big numbers' bundle (content wave 5 § 3.5): the carried rod
 *  rises this far before it arcs to the tens tray. */
export const SUM_CARRY_RISE = 12
export const SUM_CARRY_RISE_TABLET = 16
/** The gather: the second column's cubes move this far apart. */
export const SUM_GATHER_STAGGER_MS = 40

export interface PlaceValueRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PlaceValueGeometry {
  /** Each tray, in the block's frame (origin: the stage's top-left). */
  trays: Record<Place, PlaceValueRect>
  /** The blocks shown from the start, in build order (flat 0 lowest). */
  flats: readonly PlaceValueRect[]
  rods: readonly PlaceValueRect[]
  cubes: readonly PlaceValueRect[]
  /** Hundreds' "more" problem's added block (the next in its tray) and
   *  its pill. */
  added: { place: Place; rect: PlaceValueRect; pill: SharePoint } | null
  /** More and less's change (content wave 4 § 2.5): the blocks that drop
   *  in on top of the start's (more) or lift out of it (less), in move
   *  order, `BUILD_STAGGER_MS` apart. A lifted block is the start's own
   *  (its `index` in place order); the last placed leaves first, so the
   *  blocks that stay never move. */
  change: {
    place: Place
    direction: MoreDirection
    blocks: readonly { index: number; rect: PlaceValueRect; delay: number }[]
  } | null
  /** Adding big numbers (content wave 5 § 3.2, § 3.5): the second
   *  number's blocks in drop order (its rods, then its cubes continuing the
   *  first's columns), `BUILD_STAGGER_MS` apart, and the bundle; `null` for
   *  the hundreds kinds. */
  sum: SumGeometry | null
  /** Each tray's tag centre (under it). */
  tags: Record<Place, SharePoint>
  /** A "more" problem's number tag centre and its pill's; else `null`. */
  numberTag: SharePoint | null
  numberPill: SharePoint | null
}

/** A moving block of adding big numbers: its place, its index there, where
 *  it is and where it goes. */
export interface SumBlock {
  place: 'tens' | 'ones'
  index: number
  rect: PlaceValueRect
  delay: number
}

export interface SumGeometry {
  /** The second number's rods then cubes, in drop order. */
  drop: readonly SumBlock[]
  /** The new ten, or `null` when the ones make none (P1, P2). */
  bundle: {
    /** Cubes 0–9 and where each stands in the one column 10u tall (the
     *  first column's stay; the second column's slide up and left,
     *  `SUM_GATHER_STAGGER_MS` apart). */
    column: readonly {
      index: number
      from: PlaceValueRect
      to: PlaceValueRect
      delay: number
    }[]
    /** The fused rod: the column's place, then the next free rod slot. */
    rod: { index: number; from: PlaceValueRect; to: PlaceValueRect }
    /** The cubes left over (index 10 on), sliding into the first column. */
    left: readonly { index: number; from: PlaceValueRect; to: PlaceValueRect }[]
  } | null
  /** The rods and cubes the trays end with (the answer's digits). */
  endRods: number
  endCubes: number
}

/** Where everything of one problem sits in a stage `width` wide. */
export function placeValueGeometry(
  m: PlaceValueMetrics,
  problem: PlaceValueLayoutProblem,
  width: number,
): PlaceValueGeometry {
  const { u } = m
  const pad = PV_TRAY_PAD * u
  const x0 = (width - m.block.width) / 2
  const left = m.numberTag && m.numberTagSide === 'left'
  const traysX = left
    ? x0 + m.numberColumn + 8
    : x0 + (m.block.width - m.traysWidth) / 2
  const trayTop =
    m.numberTag && m.numberTagSide === 'top' ? m.tagHeight + m.tagGap : 0
  const trays = {} as Record<Place, PlaceValueRect>
  let x = traysX
  for (const p of PLACES) {
    const drawn = m.places.includes(p)
    trays[p] = {
      x,
      y: trayTop,
      width: drawn ? m.trayWidths[p] : 0,
      height: m.trayHeight,
    }
    if (drawn) x += m.trayWidths[p] + m.trayGap
  }
  const bottom = trayTop + m.trayHeight - pad
  const flat = (k: number): PlaceValueRect => ({
    x: trays.hundreds.x + pad + PV_FAN_STEP * u * k,
    y: bottom - PV_TEN * u - PV_FAN_STEP * u * k,
    width: PV_TEN * u,
    height: PV_TEN * u,
  })
  const rod = (k: number): PlaceValueRect => ({
    x: trays.tens.x + pad + (1 + PV_ROD_GAP) * u * k,
    y: bottom - PV_TEN * u,
    width: u,
    height: PV_TEN * u,
  })
  const cube = (k: number): PlaceValueRect => ({
    x:
      trays.ones.x +
      pad +
      (1 + PV_ROD_GAP) * u * Math.floor(k / PV_CUBE_COLUMN),
    y: bottom - u * ((k % PV_CUBE_COLUMN) + 1),
    width: u,
    height: u,
  })
  const d = startDigits(problem)
  const range = (n: number) => Array.from({ length: n }, (_, k) => k)
  let added: PlaceValueGeometry['added'] = null
  let change: PlaceValueGeometry['change'] = null
  let sum: SumGeometry | null = null
  if (problem.kind === 'arithmetic') {
    const b = digitsOf(problem.addendB)
    const drop: SumBlock[] = [
      ...range(b.tens).map((k) => ({
        place: 'tens' as const,
        index: d.tens + k,
        rect: rod(d.tens + k),
      })),
      ...range(b.ones).map((k) => ({
        place: 'ones' as const,
        index: d.ones + k,
        rect: cube(d.ones + k),
      })),
    ].map((blk, k) => ({ ...blk, delay: k * PV_CHANGE_STAGGER_MS }))
    const ones = d.ones + b.ones
    const ten = PV_TEN
    // The one column: cube k stands at row k of the first column.
    const columnAt = (k: number): PlaceValueRect => ({
      ...cube(0),
      y: bottom - u * (k + 1),
    })
    sum = {
      drop,
      bundle:
        ones < ten
          ? null
          : {
              column: range(ten).map((k) => ({
                index: k,
                from: cube(k),
                to: columnAt(k),
                delay:
                  k < PV_CUBE_COLUMN
                    ? 0
                    : (k - PV_CUBE_COLUMN) * SUM_GATHER_STAGGER_MS,
              })),
              rod: {
                index: d.tens + b.tens,
                from: { ...cube(0), y: bottom - ten * u, height: ten * u },
                to: rod(d.tens + b.tens),
              },
              left: range(ones - ten).map((k) => ({
                index: ten + k,
                from: cube(ten + k),
                to: cube(k),
              })),
            },
      endRods: Math.floor(problem.correct / 10) % 10,
      endCubes: problem.correct % 10,
    }
  } else if (problem.kind === 'more' && isMoreAndLess(problem)) {
    const place: Place = problem.step === 100 ? 'hundreds' : 'tens'
    const at = place === 'hundreds' ? flat : rod
    const indices =
      problem.direction === 'more'
        ? range(problem.count).map((k) => d[place] + k)
        : range(problem.count).map((k) => d[place] - 1 - k)
    change = {
      place,
      direction: problem.direction,
      blocks: indices.map((index, k) => ({
        index,
        rect: at(index),
        delay: k * PV_CHANGE_STAGGER_MS,
      })),
    }
  } else if (problem.kind === 'more') {
    const place: Place = problem.step === 100 ? 'hundreds' : 'tens'
    const rect = place === 'hundreds' ? flat(d.hundreds) : rod(d.tens)
    added = {
      place,
      rect,
      pill: {
        x: rect.x + rect.width / 2,
        y: rect.y - 4 - m.pillHeight / 2,
      },
    }
  }
  const tagY = trayTop + m.trayHeight + m.tagGap + m.tagHeight / 2
  const tags = {} as Record<Place, SharePoint>
  for (const p of PLACES)
    tags[p] = { x: trays[p].x + trays[p].width / 2, y: tagY }
  let numberTag: SharePoint | null = null
  let numberPill: SharePoint | null = null
  if (problem.kind === 'more') {
    if (left) {
      const stack = m.tagHeight + m.pillGap + m.pillHeight
      const top = trayTop + (m.trayHeight - stack) / 2
      const cx = x0 + m.numberColumn / 2
      numberTag = { x: cx, y: top + m.tagHeight / 2 }
      numberPill = {
        x: cx,
        y: top + m.tagHeight + m.pillGap + m.pillHeight / 2,
      }
    } else {
      const group = m.numberTagWidth + m.pillGap + m.pillWidth
      const gx = x0 + (m.block.width - group) / 2
      numberTag = { x: gx + m.numberTagWidth / 2, y: m.tagHeight / 2 }
      numberPill = {
        x: gx + m.numberTagWidth + m.pillGap + m.pillWidth / 2,
        y: m.tagHeight / 2,
      }
    }
  }
  return {
    trays,
    flats: range(d.hundreds).map(flat),
    rods: range(d.tens).map(rod),
    cubes: range(d.ones).map(cube),
    added,
    change,
    sum,
    tags,
    numberTag,
    numberPill,
  }
}

/**
 * The chip numerals' font for one chip set (§ 3.3): `font`, stepped down
 * 2 pt while a numeral is wider than the chip − 16. One size for the set,
 * so its chips match.
 */
export function chipNumeralFont(
  values: readonly number[],
  size: number,
  font: number,
): number {
  let f = font
  const room = size - 16
  while (f > 12 && values.some((v) => fredokaBoldWidth(String(v), f) > room))
    f -= 2
  return f
}
