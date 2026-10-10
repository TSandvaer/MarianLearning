/**
 * Greet's frames for the four form factors. Pure maths; the screen
 * positions everything absolutely from it, and App springs Emma between
 * these frames and the next screen's (see components/EmmaStage.tsx).
 *
 * - **Tablet** (shorter side ≥ 600 pt) follows the web Greet
 *   (`src/screens/Greet.tsx`): portrait is a column (Emma slot, ribbon
 *   `mt-2 mb-6 w-[88%] max-w-2xl`, heart box `h-[12vh] mb-8`); landscape
 *   is the 2-column grid (Emma `h-[min(80vh,50vw)]` in the left half,
 *   ribbon + heart centred together in the right half).
 * - **Phone** follows `design/native/greet-math-native.md` § 4, designed
 *   to a 375×667 pt floor: heart 120×88 (never shrinks) with its bottom
 *   edge 32 pt above the safe bottom; Emma takes the leftover height,
 *   capped at 60 % of the safe height, and the remainder is split evenly
 *   above Emma and between ribbon and heart. Landscape: Emma at 85 % of
 *   the safe height in the left half, ribbon + heart centred in the right.
 *
 * Every form factor reserves a 2-line ribbon slot from the start: the
 * visible ribbon grows down from the slot's fixed top, so Emma and the
 * heart never move when a line wraps or when the ribbon first appears.
 * (On the web the ribbon is not reserved, so Emma's slot shrinks when it
 * mounts at "Hi!"; the reserved slot removes that jump. Justified in the
 * Phase 3 Greet PR.)
 *
 * Emma's art is square (viewBox 2000×2000), so her frame is a square. Her
 * figure fills only the middle of it: in the two Greet poses the opaque
 * pixels span 0.236–0.679 of the width (measured on the exported WebPs).
 * So, like the web's `h-full w-auto` image in a clipped slot, her frame may
 * be wider than the screen in portrait; only the middle `FIGURE_BAND` has
 * to fit.
 */
import {
  isLandscape,
  isTablet,
  safeRect,
  type Rect,
  type ScreenLayout,
  type Viewport,
} from './layout'

export interface Size {
  width: number
  height: number
}

export interface GreetLayout extends ScreenLayout {
  /** The safe area: the wake tap target covers exactly this. */
  safe: Rect
  /** Bounding square of the wake ring, centred on Emma. */
  ring: Rect
  /** Ring stroke width. */
  ringStroke: number
  /** The 2-line ribbon slot; the visible ribbon hangs from its top. */
  ribbonSlot: Rect
  ribbonPadding: { horizontal: number; vertical: number }
  captionLineHeight: number
  /** The heart button's hit area (the glyph fills it). */
  heart: Rect
}

/** Web heart, 160×117 (Greet.tsx: spec 88pt × 120pt at 1.333 px/pt). */
export const TABLET_HEART: Size = { width: 160, height: 117 }
/** Native spec § 4: 120×88 on a phone, never smaller. */
export const PHONE_HEART: Size = { width: 120, height: 88 }

/** Web `text-[2.4rem]` = 38.4 px. Native spec § 2: 26 pt on a phone. */
export const TABLET_CAPTION_PT = 38.4
export const PHONE_CAPTION_PT = 26
/** Tailwind `leading-snug`. */
export const CAPTION_LINE_HEIGHT = 1.375
export const RIBBON_BORDER = 3
/** Tailwind `max-w-2xl`. */
export const RIBBON_MAX_WIDTH = 672
/** Lines the ribbon slot reserves. */
export const RIBBON_LINES = 2

/** The part of Emma's frame width that must stay on screen (see header). */
export const FIGURE_BAND = 0.6

/** Web ring: a viewBox-100 circle, r 46, stroke 3, in a 64vh box. */
const RING_STROKE_PER_DIAMETER = 3 / 92
/**
 * Ring diameter / Emma's frame. The web ring (0.92 × 64vh) is 0.78 of
 * Emma's frame on an iPad in portrait and 0.82 in landscape.
 */
const RING_PER_EMMA = 0.8

const PHONE = {
  pad: 16,
  emmaSidePad: 8,
  heartBottom: 32,
  emmaToRibbon: 8,
  minTop: 8,
  minRibbonToHeart: 16,
  emmaMaxOfSafeHeight: 0.6,
  landscapeEmmaOfSafeHeight: 0.85,
  ribbonPadding: { horizontal: 16, vertical: 10 },
}

const TABLET = {
  ribbonTop: 8, // mt-2
  ribbonBottom: 24, // mb-6
  heartBoxOfViewportHeight: 0.12, // h-[12vh]
  landscapeHeartBox: 132, // landscape:h-[132px]
  heartBottom: 32, // mb-8
  ribbonWidthOfColumn: 0.88, // w-[88%]
  ribbonPadding: { horizontal: 24, vertical: 16 }, // px-6 py-4
}

function slotHeight(fontSize: number, padding: { vertical: number }): number {
  return (
    RIBBON_LINES * fontSize * CAPTION_LINE_HEIGHT +
    padding.vertical * 2 +
    RIBBON_BORDER * 2
  )
}

function centredSquare(cx: number, cy: number, size: number): Rect {
  return { x: cx - size / 2, y: cy - size / 2, width: size, height: size }
}

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

function finish(
  v: Viewport,
  base: Pick<ScreenLayout, 'landscape' | 'tablet' | 'captionFontSize'>,
  emma: Rect,
  ribbonSlot: Rect,
  heart: Rect,
  ribbonPadding: GreetLayout['ribbonPadding'],
): GreetLayout {
  const ringSize = Math.min(
    emma.width * RING_PER_EMMA,
    safeRect(v).width - PHONE.emmaSidePad * 2,
  )
  return {
    ...base,
    safe: safeRect(v),
    emma,
    content: union(ribbonSlot, heart),
    ring: centredSquare(
      emma.x + emma.width / 2,
      emma.y + emma.height / 2,
      ringSize,
    ),
    ringStroke: ringSize * RING_STROKE_PER_DIAMETER,
    ribbonSlot,
    ribbonPadding,
    captionLineHeight: base.captionFontSize * CAPTION_LINE_HEIGHT,
    heart,
  }
}

function phonePortrait(v: Viewport): GreetLayout {
  const s = safeRect(v)
  const fontSize = PHONE_CAPTION_PT
  const ribbonH = slotHeight(fontSize, PHONE.ribbonPadding)
  const heartY = s.y + s.height - PHONE.heartBottom - PHONE_HEART.height
  const avail =
    heartY -
    s.y -
    ribbonH -
    PHONE.emmaToRibbon -
    PHONE.minTop -
    PHONE.minRibbonToHeart
  const emmaSize = Math.max(
    0,
    Math.min(
      avail,
      s.height * PHONE.emmaMaxOfSafeHeight,
      s.width / FIGURE_BAND,
    ),
  )
  const spare = Math.max(0, avail - emmaSize) / 2
  const emmaY = s.y + PHONE.minTop + spare
  const ribbonY = emmaY + emmaSize + PHONE.emmaToRibbon
  const ribbonW = Math.min(s.width - PHONE.pad * 2, RIBBON_MAX_WIDTH)
  return finish(
    v,
    { landscape: false, tablet: false, captionFontSize: fontSize },
    {
      x: s.x + (s.width - emmaSize) / 2,
      y: emmaY,
      width: emmaSize,
      height: emmaSize,
    },
    {
      x: s.x + (s.width - ribbonW) / 2,
      y: ribbonY,
      width: ribbonW,
      height: ribbonH,
    },
    {
      x: s.x + (s.width - PHONE_HEART.width) / 2,
      y: heartY,
      ...PHONE_HEART,
    },
    PHONE.ribbonPadding,
  )
}

function phoneLandscape(v: Viewport): GreetLayout {
  const s = safeRect(v)
  const fontSize = PHONE_CAPTION_PT
  const half = s.width / 2
  const emmaSize = Math.min(s.height * PHONE.landscapeEmmaOfSafeHeight, half)
  const ribbonH = slotHeight(fontSize, PHONE.ribbonPadding)
  const ribbonW = Math.min(half - PHONE.pad * 2, RIBBON_MAX_WIDTH)
  const block = ribbonH + PHONE.minRibbonToHeart + PHONE_HEART.height
  const top = s.y + Math.max(0, (s.height - block) / 2)
  const right = s.x + half
  return finish(
    v,
    { landscape: true, tablet: false, captionFontSize: fontSize },
    {
      x: s.x + (half - emmaSize) / 2,
      y: s.y + (s.height - emmaSize) / 2,
      width: emmaSize,
      height: emmaSize,
    },
    {
      x: right + (half - ribbonW) / 2,
      y: top,
      width: ribbonW,
      height: ribbonH,
    },
    {
      x: right + (half - PHONE_HEART.width) / 2,
      y: top + ribbonH + PHONE.minRibbonToHeart,
      ...PHONE_HEART,
    },
    PHONE.ribbonPadding,
  )
}

function tabletPortrait(v: Viewport): GreetLayout {
  const s = safeRect(v)
  const fontSize = TABLET_CAPTION_PT
  const ribbonH = slotHeight(fontSize, TABLET.ribbonPadding)
  const heartBox = Math.max(
    v.height * TABLET.heartBoxOfViewportHeight,
    TABLET_HEART.height,
  )
  const heartBoxY = s.y + s.height - TABLET.heartBottom - heartBox
  const ribbonY = heartBoxY - TABLET.ribbonBottom - ribbonH
  const slotH = Math.max(0, ribbonY - TABLET.ribbonTop - s.y)
  const emmaSize = Math.min(slotH, s.width / FIGURE_BAND)
  const ribbonW = Math.min(s.width * 0.88, RIBBON_MAX_WIDTH)
  return finish(
    v,
    { landscape: false, tablet: true, captionFontSize: fontSize },
    {
      x: s.x + (s.width - emmaSize) / 2,
      y: s.y + (slotH - emmaSize) / 2,
      width: emmaSize,
      height: emmaSize,
    },
    {
      x: s.x + (s.width - ribbonW) / 2,
      y: ribbonY,
      width: ribbonW,
      height: ribbonH,
    },
    {
      x: s.x + (s.width - TABLET_HEART.width) / 2,
      y: heartBoxY + (heartBox - TABLET_HEART.height) / 2,
      ...TABLET_HEART,
    },
    TABLET.ribbonPadding,
  )
}

function tabletLandscape(v: Viewport): GreetLayout {
  const s = safeRect(v)
  const fontSize = TABLET_CAPTION_PT
  const half = s.width / 2
  // h-[min(80vh,50vw)]: viewport units, not the safe area.
  const emmaSize = Math.min(v.height * 0.8, v.width * 0.5, half, s.height)
  const ribbonH = slotHeight(fontSize, TABLET.ribbonPadding)
  const ribbonW = Math.min(half * TABLET.ribbonWidthOfColumn, RIBBON_MAX_WIDTH)
  // Rows: minmax(0,1fr) | ribbon | heart box | minmax(0,1fr).
  const block =
    TABLET.ribbonTop +
    ribbonH +
    TABLET.ribbonBottom +
    TABLET.landscapeHeartBox +
    TABLET.heartBottom
  const top = s.y + Math.max(0, (s.height - block) / 2)
  const ribbonY = top + TABLET.ribbonTop
  const heartBoxY = ribbonY + ribbonH + TABLET.ribbonBottom
  const right = s.x + half
  return finish(
    v,
    { landscape: true, tablet: true, captionFontSize: fontSize },
    {
      x: s.x + (half - emmaSize) / 2,
      y: s.y + (s.height - emmaSize) / 2,
      width: emmaSize,
      height: emmaSize,
    },
    {
      x: right + (half - ribbonW) / 2,
      y: ribbonY,
      width: ribbonW,
      height: ribbonH,
    },
    {
      x: right + (half - TABLET_HEART.width) / 2,
      y: heartBoxY + (TABLET.landscapeHeartBox - TABLET_HEART.height) / 2,
      ...TABLET_HEART,
    },
    TABLET.ribbonPadding,
  )
}

export function greetLayout(v: Viewport): GreetLayout {
  const landscape = isLandscape(v)
  if (isTablet(v)) return landscape ? tabletLandscape(v) : tabletPortrait(v)
  return landscape ? phoneLandscape(v) : phonePortrait(v)
}
