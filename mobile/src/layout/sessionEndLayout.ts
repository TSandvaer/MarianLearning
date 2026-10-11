/**
 * Session End's frames for the four form factors. Pure maths: the screen
 * places every region from it, App springs Emma to `emma`, and the
 * flower's flight into its slot is computed from the same numbers
 * ({@link flowerFlight}), so it lands exactly on the hole.
 *
 * - **Tablet** (shorter side ≥ 600 pt) follows the web
 *   (`src/screens/SessionEnd/sessionEndClay.css`, sized for 820×1180).
 *   Portrait: one centred column: Emma `min(33vh, 390)` (she is the one
 *   piece that gives way, down to 160), the clay panel (`min(720, 92vw)`
 *   wide, at least `min(430, 38vh)` tall, content centred), the button
 *   row (130 tall, 112 pt buttons), then the caption slot taking the
 *   rest with the ribbon at its bottom. Landscape: Emma
 *   (`min(64vh, 480, 30vw)`) stands beside a `min(720, …)` column of
 *   panel, buttons and caption, the pair centred; the column's gaps
 *   tighten as in the web's landscape rule.
 * - **Phone portrait** keeps that column on the 375×667 floor: the panel
 *   spans the width, its stars and flower tray scale to fit it (the web's
 *   46 pt stars and 350 pt tray overflow a phone), 88 pt buttons (the
 *   web's phone value), a 22 pt caption (`design/native/greet-math-
 *   native.md` § 2 floor). Emma takes the leftover height, ≥ 120.
 * - **Phone landscape** keeps the web's landscape shape (Emma's column on
 *   the left, the stack on the right) inside 375 pt: 72 pt buttons (the
 *   phone tap floor), a 22 pt caption with a 2-line slot, and the flower
 *   tray sized from the height that is left.
 *
 * Every form: the caption slot always holds a two-line ribbon, so a line
 * that wraps never covers a button (web #521).
 *
 * The flower pieces keep the web's proportions to the 86 pt hole: step
 * picture 112, step → tray 28, tray 350×116 (radius 44), flower 82 in the
 * hole, today's new flower 120 starting 60 pt below the panel's top.
 */
import {
  isLandscape,
  isTablet,
  safeRect,
  type Rect,
  type ScreenLayout,
  type Viewport,
} from './layout'

export type SessionEndForm =
  | 'phone-portrait'
  | 'phone-landscape'
  | 'tablet-portrait'
  | 'tablet-landscape'

/** The web's hole, and every flower piece's size relative to it. */
export const WEB_HOLE = 86
const STEP_RATIO = 112 / WEB_HOLE
const STEP_GAP_RATIO = 28 / WEB_HOLE
const TRAY_W_RATIO = 350 / WEB_HOLE
const TRAY_H_RATIO = 116 / WEB_HOLE
const TRAY_RADIUS_RATIO = 44 / WEB_HOLE
const HOLE_FLOWER_RATIO = 82 / WEB_HOLE
const NEW_FLOWER_RATIO = 120 / WEB_HOLE
const NEW_FLOWER_TOP_RATIO = 60 / WEB_HOLE
/** Width of the step + tray row per pt of hole. */
const ROW_W_RATIO = STEP_RATIO + STEP_GAP_RATIO + TRAY_W_RATIO
/** Phone landscape: the smallest hole before the gaps give way. */
export const PHONE_HOLE_MIN = 40
/** Phone: the hole never grows past the web's phone value. */
export const PHONE_HOLE_MAX = 70
/** Phone tap floor (greet-math-native.md § 4: chips never below 72). */
export const PHONE_BUTTON_MIN = 72
/** Captions never below 22 pt (greet-math-native.md § 2). */
export const PHONE_CAPTION_PT = 22
/** Web `.se-caption`: 29 px, `line-height: 1.18`. */
export const TABLET_CAPTION_PT = 29
export const CAPTION_LINE_HEIGHT = 1.18

export interface ButtonMetrics {
  /** Height of the clay face. */
  height: number
  font: number
  icon: number
  radius: number
  /** Coloured slab under the face (web `0 11px 0`). */
  slab: number
  /** How far the face sinks when pressed (web `translateY(9px)`). */
  press: number
  gap: number
  /** Widths, by the buttons on screen. */
  widths: {
    allDone: number
    again: number
    homeWithAgain: number
    homeAlone: number
  }
}

export interface CaptionMetrics {
  font: number
  lineHeight: number
  padding: { horizontal: number; vertical: number }
  minHeight: number
  radius: number
  speaker: number
  /** Speaker → text. */
  gap: number
}

/** The panel's content, in the panel's own coordinates. */
export interface PanelContent {
  stars: { rect: Rect; size: number; gap: number }
  step: Rect
  tray: { rect: Rect; radius: number }
  hole: number
  /** Flower inside a hole (web: 82 in 86, 2 pt from the left, 5 from the bottom). */
  holeFlower: { size: number; left: number; bottom: number }
  count: { rect: Rect; font: number }
  /** Today's flower where it pops in, before it flies into its slot. */
  newFlower: Rect
}

export interface SessionEndLayout extends ScreenLayout {
  form: SessionEndForm
  safe: Rect
  /** The cream clay panel. */
  panel: Rect
  panelRadius: number
  /** The panel's slab under it (web `0 14px 0`). */
  panelSlab: number
  content: Rect
  inner: PanelContent
  /** The button row; buttons centre in it. */
  buttons: Rect
  button: ButtonMetrics
  /** The caption slot; the ribbon sits at its bottom and may grow to its top. */
  captionSlot: Rect
  caption: CaptionMetrics
}

const clamp = (min: number, value: number, max: number) =>
  Math.max(min, Math.min(max, value))

interface PanelTokens {
  pad: { top: number; bottom: number; x: number }
  starMax: number
  starGap: number
  rowGap: number
  countGap: number
  countRow: number
  countFont: number
  /** At least this tall; the content centres in the extra (web min-height). */
  minHeight: number
}

/** The panel's content for a given hole, top-aligned under the padding. */
function panelContent(
  t: PanelTokens,
  width: number,
  hole: number,
  star: number,
): { content: PanelContent; height: number } {
  const step = Math.round(hole * STEP_RATIO)
  const stepGap = Math.round(hole * STEP_GAP_RATIO)
  const trayW = Math.round(hole * TRAY_W_RATIO)
  const trayH = Math.round(hole * TRAY_H_RATIO)
  const rowH = Math.max(step, trayH)
  const contentH = star + t.rowGap + rowH + t.countGap + t.countRow
  const height = Math.max(t.minHeight, t.pad.top + contentH + t.pad.bottom)
  // Web `justify-content: center` inside the padding box.
  const top = t.pad.top + (height - t.pad.top - t.pad.bottom - contentH) / 2
  const rowW = step + stepGap + trayW
  const rowX = (width - rowW) / 2
  const rowY = top + star + t.rowGap
  const starsW = 8 * star + 7 * t.starGap
  const newFlower = Math.round(hole * NEW_FLOWER_RATIO)
  return {
    height,
    content: {
      stars: {
        rect: { x: (width - starsW) / 2, y: top, width: starsW, height: star },
        size: star,
        gap: t.starGap,
      },
      step: { x: rowX, y: rowY + (rowH - step) / 2, width: step, height: step },
      tray: {
        rect: {
          x: rowX + step + stepGap,
          y: rowY + (rowH - trayH) / 2,
          width: trayW,
          height: trayH,
        },
        radius: Math.round(hole * TRAY_RADIUS_RATIO),
      },
      hole,
      holeFlower: {
        size: Math.round(hole * HOLE_FLOWER_RATIO),
        left: Math.round((hole * 2) / WEB_HOLE),
        bottom: Math.round((hole * 5) / WEB_HOLE),
      },
      count: {
        rect: {
          x: t.pad.x,
          y: rowY + rowH + t.countGap,
          width: width - 2 * t.pad.x,
          height: t.countRow,
        },
        font: t.countFont,
      },
      newFlower: {
        x: (width - newFlower) / 2,
        y: Math.round(hole * NEW_FLOWER_TOP_RATIO),
        width: newFlower,
        height: newFlower,
      },
    },
  }
}

/** Largest star (≤ max) that puts 8 in `width`. */
function starFor(width: number, max: number, gap: number): number {
  return Math.max(12, Math.min(max, Math.floor((width - 7 * gap) / 8)))
}

/** Largest hole (≤ max) whose step + tray row fits `width`. */
function holeForWidth(width: number, max: number): number {
  return Math.min(max, Math.floor(width / ROW_W_RATIO))
}

function buttonMetrics(
  height: number,
  font: number,
  gap: number,
  rowWidth: number,
): ButtonMetrics {
  // Web widths (112 pt buttons): All done 360, Again 330 + Home 220, Home 300.
  const k = height / 112
  let again = Math.round(330 * k)
  let homeWithAgain = Math.round(220 * k)
  if (again + gap + homeWithAgain > rowWidth) {
    // A phone: the pair splits the row evenly.
    again = Math.floor((rowWidth - gap) / 2)
    homeWithAgain = again
  }
  return {
    height,
    font,
    icon: Math.round(height / 2),
    radius: Math.round(height / 2),
    slab: Math.round((11 * height) / 112),
    press: Math.round((9 * height) / 112),
    gap,
    widths: {
      allDone: Math.min(rowWidth, Math.round(360 * k)),
      again,
      homeWithAgain,
      homeAlone: Math.min(rowWidth, Math.round(300 * k)),
    },
  }
}

function captionMetrics(tablet: boolean): CaptionMetrics {
  const font = tablet ? TABLET_CAPTION_PT : PHONE_CAPTION_PT
  return tablet
    ? {
        font,
        lineHeight: font * CAPTION_LINE_HEIGHT,
        padding: { horizontal: 26, vertical: 12 },
        minHeight: 84,
        radius: 42,
        speaker: 38,
        gap: 14,
      }
    : {
        font,
        lineHeight: font * CAPTION_LINE_HEIGHT,
        padding: { horizontal: 16, vertical: 10 },
        minHeight: 64,
        radius: 32,
        speaker: 28,
        gap: 10,
      }
}

/** A two-line ribbon: the slot's floor. */
export function twoLineRibbon(c: CaptionMetrics): number {
  return Math.max(
    c.minHeight,
    Math.ceil(2 * c.lineHeight + 2 * c.padding.vertical),
  )
}

const TABLET_BUTTON = 112
const TABLET_BUTTON_FONT = 40
const TABLET_BUTTON_GAP = 30
const TABLET_PANEL_SLAB = 14
const PHONE_PANEL_SLAB = 10

/** Top and bottom of the stack (web `.se-stack` padding), in screen pt. */
function stackBounds(s: Rect, tablet: boolean, landscape: boolean) {
  // Web: `max(env(safe-area-inset-top), 12px)` / `calc(inset-bottom + 22px)`.
  const top = Math.max(s.y, tablet ? 12 : landscape ? 8 : 12)
  const bottomPad = tablet ? 22 : landscape ? 8 : 16
  return { top, bottom: s.y + s.height - bottomPad }
}

function tabletPortrait(v: Viewport): SessionEndLayout {
  const s = safeRect(v)
  const { top, bottom } = stackBounds(s, true, false)
  const caption = captionMetrics(true)
  const panelW = Math.min(720, 0.92 * v.width, s.width - 32)
  const tokens: PanelTokens = {
    pad: { top: 26, bottom: 18, x: 30 },
    starMax: 46,
    starGap: 24,
    rowGap: 34,
    countGap: 22,
    countRow: 72,
    countFont: 54,
    minHeight: Math.min(430, 0.38 * v.height),
  }
  const innerW = panelW - 2 * tokens.pad.x
  const panel = panelContent(
    tokens,
    panelW,
    holeForWidth(innerW, WEB_HOLE),
    starFor(innerW, tokens.starMax, tokens.starGap),
  )
  const buttonsH = 130
  // Web `.se-caption-slot`: padding-top 20 + a two-line ribbon.
  const slotMin = 20 + twoLineRibbon(caption)
  const below = 20 + panel.height + 46 + buttonsH + slotMin
  const emma = clamp(160, bottom - top - below, Math.min(0.33 * v.height, 390))
  const cx = s.x + s.width / 2
  const panelY = top + emma + 20
  const buttonsY = panelY + panel.height + 46
  const slotY = buttonsY + buttonsH
  const emmaRect = { x: cx - emma / 2, y: top, width: emma, height: emma }
  return {
    form: 'tablet-portrait',
    landscape: false,
    tablet: true,
    safe: s,
    emma: emmaRect,
    captionFontSize: caption.font,
    content: { x: s.x + 16, y: top, width: s.width - 32, height: bottom - top },
    panel: {
      x: cx - panelW / 2,
      y: panelY,
      width: panelW,
      height: panel.height,
    },
    panelRadius: 56,
    panelSlab: TABLET_PANEL_SLAB,
    inner: panel.content,
    buttons: {
      x: s.x + 16,
      y: buttonsY,
      width: s.width - 32,
      height: buttonsH,
    },
    button: buttonMetrics(
      TABLET_BUTTON,
      TABLET_BUTTON_FONT,
      TABLET_BUTTON_GAP,
      s.width - 32,
    ),
    // Web: `margin: 0 28px` inside the 16 pt stack padding.
    captionSlot: {
      x: s.x + 16 + 28,
      y: slotY,
      width: s.width - 32 - 56,
      height: Math.max(slotMin, bottom - slotY),
    },
    caption,
  }
}

function tabletLandscape(v: Viewport): SessionEndLayout {
  const s = safeRect(v)
  const { top, bottom } = stackBounds(s, true, true)
  const caption = captionMetrics(true)
  const emma = Math.min(0.64 * v.height, 480, 0.3 * v.width, bottom - top)
  const columnW = Math.min(720, s.width - 32 - emma - 28)
  const left = s.x + 16 + (s.width - 32 - (emma + 28 + columnW)) / 2
  const columnX = left + emma + 28
  const tokens: PanelTokens = {
    pad: { top: 26, bottom: 18, x: 30 },
    starMax: 46,
    starGap: 24,
    rowGap: 18,
    countGap: 12,
    countRow: 56,
    countFont: 54,
    minHeight: 0,
  }
  const innerW = columnW - 2 * tokens.pad.x
  const panel = panelContent(
    tokens,
    columnW,
    holeForWidth(innerW, WEB_HOLE),
    starFor(innerW, tokens.starMax, tokens.starGap),
  )
  const buttonsH = 124
  const buttonsY = top + panel.height + 22
  const slotY = buttonsY + buttonsH
  const slotMin = 20 + twoLineRibbon(caption)
  return {
    form: 'tablet-landscape',
    landscape: true,
    tablet: true,
    safe: s,
    emma: {
      x: left,
      y: top + (bottom - top - emma) / 2,
      width: emma,
      height: emma,
    },
    captionFontSize: caption.font,
    content: { x: columnX, y: top, width: columnW, height: bottom - top },
    panel: { x: columnX, y: top, width: columnW, height: panel.height },
    panelRadius: 56,
    panelSlab: TABLET_PANEL_SLAB,
    inner: panel.content,
    buttons: { x: columnX, y: buttonsY, width: columnW, height: buttonsH },
    button: buttonMetrics(
      TABLET_BUTTON,
      TABLET_BUTTON_FONT,
      TABLET_BUTTON_GAP,
      columnW,
    ),
    captionSlot: {
      x: columnX,
      y: slotY,
      width: columnW,
      height: Math.max(slotMin, bottom - slotY),
    },
    caption,
  }
}

function phonePortrait(v: Viewport): SessionEndLayout {
  const s = safeRect(v)
  const { top, bottom } = stackBounds(s, false, false)
  const caption = captionMetrics(false)
  const width = s.width - 32
  const tokens: PanelTokens = {
    pad: { top: 18, bottom: 12, x: 16 },
    starMax: 46,
    starGap: 8,
    rowGap: 16,
    countGap: 10,
    countRow: 48,
    countFont: 40,
    minHeight: 0,
  }
  const innerW = width - 2 * tokens.pad.x
  const panel = panelContent(
    tokens,
    width,
    holeForWidth(innerW, PHONE_HOLE_MAX),
    starFor(innerW, tokens.starMax, tokens.starGap),
  )
  const buttonH = 88
  const buttonsGap = 24
  const slotMin = 12 + twoLineRibbon(caption)
  const emmaGap = 12
  const below = emmaGap + panel.height + buttonsGap + buttonH + slotMin
  const emma = clamp(120, bottom - top - below, Math.min(0.33 * v.height, 390))
  const cx = s.x + s.width / 2
  const panelY = top + emma + emmaGap
  const buttonsY = panelY + panel.height + buttonsGap
  const slotY = buttonsY + buttonH
  return {
    form: 'phone-portrait',
    landscape: false,
    tablet: false,
    safe: s,
    emma: { x: cx - emma / 2, y: top, width: emma, height: emma },
    captionFontSize: caption.font,
    content: { x: s.x + 16, y: top, width, height: bottom - top },
    panel: { x: s.x + 16, y: panelY, width, height: panel.height },
    panelRadius: 40,
    panelSlab: PHONE_PANEL_SLAB,
    inner: panel.content,
    buttons: { x: s.x + 16, y: buttonsY, width, height: buttonH },
    button: buttonMetrics(buttonH, 30, 16, width),
    captionSlot: {
      x: s.x + 16,
      y: slotY,
      width,
      height: Math.max(slotMin, bottom - slotY),
    },
    caption,
  }
}

/** Ideal and minimum gaps of the phone-landscape stack. */
const LANDSCAPE_GAPS = { panelToButtons: [22, 14], buttonsToCaption: [12, 6] }

function phoneLandscape(v: Viewport): SessionEndLayout {
  const s = safeRect(v)
  const { top, bottom } = stackBounds(s, false, true)
  const height = bottom - top
  const caption = captionMetrics(false)
  // Web landscape: Emma `min(64vh, 480, 30vw)`, the column beside her.
  const emma = Math.round(Math.min(0.3 * s.width, 480, height))
  const columnX = s.x + 16 + emma + 16
  const columnW = s.x + s.width - 16 - columnX
  const buttonH = PHONE_BUTTON_MIN
  const ribbon = twoLineRibbon(caption)
  const tokens: PanelTokens = {
    pad: { top: 12, bottom: 8, x: 16 },
    starMax: 28,
    starGap: 8,
    rowGap: 8,
    countGap: 6,
    countRow: 38,
    countFont: 32,
    minHeight: 0,
  }
  const innerW = columnW - 2 * tokens.pad.x
  const star = starFor(innerW, tokens.starMax, tokens.starGap)
  const [g1, g1min] = LANDSCAPE_GAPS.panelToButtons
  const [g2, g2min] = LANDSCAPE_GAPS.buttonsToCaption
  // Everything but the tray row at the ideal gaps; the row gets the rest.
  const fixed =
    tokens.pad.top +
    star +
    tokens.rowGap +
    tokens.countGap +
    tokens.countRow +
    tokens.pad.bottom +
    buttonH +
    ribbon
  const rowAt = (gaps: number) => (height - fixed - gaps) / TRAY_H_RATIO
  const hole = Math.floor(
    clamp(
      PHONE_HOLE_MIN,
      Math.max(rowAt(g1 + g2), Math.min(rowAt(g1min + g2min), PHONE_HOLE_MIN)),
      Math.min(PHONE_HOLE_MAX, innerW / ROW_W_RATIO),
    ),
  )
  const panel = panelContent(tokens, columnW, hole, star)
  // Spare height (if any) shrinks the gaps from ideal toward minimum.
  const spare = height - panel.height - buttonH - ribbon
  const t = clamp(0, (spare - g1min - g2min) / (g1 + g2 - g1min - g2min), 1)
  const gap1 = g1min + (g1 - g1min) * t
  const buttonsY = top + panel.height + gap1
  const slotY = buttonsY + buttonH
  return {
    form: 'phone-landscape',
    landscape: true,
    tablet: false,
    safe: s,
    emma: {
      x: s.x + 16,
      y: top + (height - emma) / 2,
      width: emma,
      height: emma,
    },
    captionFontSize: caption.font,
    content: { x: columnX, y: top, width: columnW, height },
    panel: { x: columnX, y: top, width: columnW, height: panel.height },
    panelRadius: 32,
    panelSlab: PHONE_PANEL_SLAB,
    inner: panel.content,
    buttons: { x: columnX, y: buttonsY, width: columnW, height: buttonH },
    button: buttonMetrics(buttonH, 26, 16, columnW),
    captionSlot: {
      x: columnX,
      y: slotY,
      width: columnW,
      height: Math.max(ribbon, bottom - slotY),
    },
    caption,
  }
}

export function sessionEndLayout(v: Viewport): SessionEndLayout {
  const landscape = isLandscape(v)
  if (isTablet(v)) return landscape ? tabletLandscape(v) : tabletPortrait(v)
  return landscape ? phoneLandscape(v) : phonePortrait(v)
}

/**
 * The hole rects of a tray of `count` slots, in the tray's coordinates
 * (web: `justify-content: space-around`, holes centred vertically).
 */
export function holeRects(tray: Rect, hole: number, count: number): Rect[] {
  if (count <= 0) return []
  const around = (tray.width - count * hole) / count
  return Array.from({ length: count }, (_, i) => ({
    x: around / 2 + i * (hole + around),
    y: (tray.height - hole) / 2,
    width: hole,
    height: hole,
  }))
}

/**
 * Today's flower's flight, in the panel's coordinates: from where it pops
 * in to the centre of hole `slot`, ending at the hole's size (web: the
 * measured offset and `scale: 0.72`, 120 → 86).
 */
export function flowerFlight(
  inner: PanelContent,
  slot: number,
  count: number,
): { x: number; y: number; scale: number } {
  const tray = inner.tray.rect
  const h = holeRects(tray, inner.hole, count)[slot]
  const from = inner.newFlower
  if (h === undefined) return { x: 0, y: 0, scale: 1 }
  return {
    x: tray.x + h.x + h.width / 2 - (from.x + from.width / 2),
    y: tray.y + h.y + h.height / 2 - (from.y + from.height / 2),
    scale: 0.72,
  }
}
