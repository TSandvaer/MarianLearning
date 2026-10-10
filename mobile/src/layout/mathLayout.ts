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
  /** Height of the whole row. */
  height: number
}

/**
 * The counting row for `a + b` in `width`. Tablet: the web's flower row
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
): CountingMetrics {
  if (layout.counting === 'tablet') {
    const size = flowerRowFontSizeRem(addendA, addendB) * 16
    return {
      size,
      gap: 4,
      between: 24 + size * 0.6 + 24,
      plusFont: size,
      perRow: Infinity,
      height: size,
    }
  }
  const total = addendA + addendB
  const size = total <= 10 ? PHONE_DOT : PHONE_DOT_SMALL
  const groupWidth = (n: number) =>
    n <= 0 ? 0 : n * size + (n - 1) * PHONE_DOT_GAP
  const oneRow = groupWidth(addendA) + PHONE_GROUP_GAP + groupWidth(addendB)
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
    height: maxRows * size + (maxRows - 1) * PHONE_DOT_GAP,
  }
}
