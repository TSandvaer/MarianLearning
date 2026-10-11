/**
 * The Hub's frames for its three compositions (`design/native/hub-native.md`
 * §§ 1-3). Pure maths; the Hub positions everything absolutely from it,
 * and App springs Emma between these frames and the next screen's.
 *
 * - **W** (tablet portrait): the web stage 1:1. The 820×1180 reference
 *   canvas fits the safe area, top-aligned and centred, `u` = width / 820,
 *   and every web position is reference px × u (`hubClay.css`).
 * - **P** (phone portrait): the cards side by side at the bottom (thumb
 *   zone), a reserved 3-line bubble slot above them, Emma on top.
 * - **L** (phone and tablet landscape): Emma and the bubble in a left
 *   column, the cards side by side on the right, at web size at most.
 *
 * A card scales as one picture: its contents use the web's card-relative
 * reference px (378×672) × `s`. It needs 28s above it (crown + bob), 14s
 * on each side (the suggested ring) and 14s below (the solid shadow).
 */
import {
  isLandscape,
  isTablet,
  safeRect,
  type Rect,
  type ScreenLayout,
  type Viewport,
} from './layout'

export type HubForm = 'W' | 'P' | 'L'

/** Web card, reference px. */
export const CARD_W = 378
export const CARD_H = 672
/** Web stage (`.hub-stage`), reference px. */
export const STAGE_W = 820
export const STAGE_H = 1180
/** Room a card needs above / beside / below its box, × s. */
export const CARD_ROOM_TOP = 28
export const CARD_ROOM_SIDE = 14
export const CARD_ROOM_BOTTOM = 14
/** Gap between the two cards in P and L (pt, not × s). */
export const CARD_GAP = 16
/** Caption line height (web `.hub-bubble p`). */
export const CAPTION_LINE_HEIGHT = 1.15
/** Lines the P / L bubble slot reserves. */
export const BUBBLE_LINES = 3
/** Emma → bubble gap in P and L (the tail sits in it). */
export const EMMA_BUBBLE_GAP = 12
/** The map button's hit area is never smaller than this (pt). */
export const MAP_MIN_HIT = 56

export interface HubBubbleLayout {
  /** Top-left of the bubble; it grows down from here at a fixed width. */
  x: number
  y: number
  width: number
  /** The reserved 3-line slot (P / L); null in W, which reserves none. */
  slotHeight: number | null
  fontSize: number
  lineHeight: number
  padding: { horizontal: number; vertical: number }
  radius: number
  shadow: string
  /** The tail's box, relative to the bubble's top-left. */
  tail: Rect & { side: 'right' | 'top' }
}

export interface HubLayout extends ScreenLayout {
  form: HubForm
  safe: Rect
  /** The warm light disc behind Emma (background layer). */
  light: Rect
  bubble: HubBubbleLayout
  /** Card boxes: Number Garden, Word Song. */
  cards: readonly [Rect, Rect]
  /** Card scale: card reference px × s. */
  s: number
  /**
   * Garden backdrop: blob centres and radii in screen pt, as fractions of
   * the screen (W: the web stage's coordinates; P / L: x / 820, y / 1180).
   */
  garden: { width: number; height: number; origin: Rect; scale: number }
}

interface Caption {
  fontSize: number
  padding: { horizontal: number; vertical: number }
  /** P / L slot height. */
  slot: number
}

/** Phone P / L caption: 22 pt, padding 12 / 16 → a 100 pt slot. */
const PHONE_CAPTION: Caption = {
  fontSize: 22,
  padding: { horizontal: 16, vertical: 12 },
  slot: 100,
}
/** Tablet L caption: the web's 30u at u = 1, padding 14 / 18 → 132 pt. */
const TABLET_CAPTION: Caption = {
  fontSize: 30,
  padding: { horizontal: 18, vertical: 14 },
  slot: 132,
}
/** Narrowest L column that keeps every guidance line to 3 lines. */
const COL_MIN_PHONE = 262
const COL_MIN_TABLET = 350

const P_L_SHADOW =
  'inset 0 3px 0 #ffffff, 0 6px 0 #e3c6a6, 0 10px 16px rgba(60, 30, 10, 0.2)'
const P_L_RADIUS = 28
/** P / L tail: top centre, pointing up at Emma. */
const TAIL_UP = { width: 28, height: 14 }

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Emma's warm light: her frame offset (0.096E, 0.088E), size 0.808E. */
function lightFor(emma: Rect): Rect {
  const e = emma.width
  return {
    x: emma.x + 0.096 * e,
    y: emma.y + 0.088 * e,
    width: 0.808 * e,
    height: 0.808 * e,
  }
}

function slotBubble(
  x: number,
  y: number,
  width: number,
  caption: Caption,
): HubBubbleLayout {
  return {
    x,
    y,
    width,
    slotHeight: caption.slot,
    fontSize: caption.fontSize,
    lineHeight: caption.fontSize * CAPTION_LINE_HEIGHT,
    padding: caption.padding,
    radius: P_L_RADIUS,
    shadow: P_L_SHADOW,
    tail: {
      side: 'top',
      x: (width - TAIL_UP.width) / 2,
      y: -TAIL_UP.height,
      ...TAIL_UP,
    },
  }
}

function contentOf(safe: Rect): Rect {
  return {
    x: safe.x + 16,
    y: safe.y + 16,
    width: Math.max(0, safe.width - 32),
    height: Math.max(0, safe.height - 32),
  }
}

/** W: the web stage, 1:1 (§ 3). */
function stageLayout(v: Viewport, safe: Rect): HubLayout {
  const width = Math.min(safe.width, (safe.height * STAGE_W) / STAGE_H)
  const u = width / STAGE_W
  const stage: Rect = {
    x: safe.x + (safe.width - width) / 2,
    y: safe.y,
    width,
    height: STAGE_H * u,
  }
  const at = (x: number, y: number, w: number, h: number): Rect => ({
    x: stage.x + x * u,
    y: stage.y + y * u,
    width: w * u,
    height: h * u,
  })
  const emma = at(200, -6, 520, 520)
  return {
    form: 'W',
    landscape: false,
    tablet: true,
    safe,
    emma,
    content: contentOf(safe),
    captionFontSize: 30 * u,
    light: at(250, 40, 420, 420),
    bubble: {
      x: stage.x + 26 * u,
      y: stage.y + 120 * u,
      width: 330 * u,
      slotHeight: null,
      fontSize: 30 * u,
      lineHeight: 30 * u * CAPTION_LINE_HEIGHT,
      padding: { horizontal: 18 * u, vertical: 14 * u },
      radius: 34 * u,
      shadow: `inset 0 ${3 * u}px 0 #ffffff, 0 ${7 * u}px 0 #e3c6a6, 0 ${12 * u}px ${18 * u}px rgba(60, 30, 10, 0.2)`,
      // Web `::before`: right −16u, top 34u, 34u × 30u.
      tail: {
        side: 'right',
        x: 330 * u - 18 * u,
        y: 34 * u,
        width: 34 * u,
        height: 30 * u,
      },
    },
    cards: [at(24, 470, CARD_W, CARD_H), at(418, 470, CARD_W, CARD_H)],
    s: u,
    garden: { width: v.width, height: v.height, origin: stage, scale: u },
  }
}

/** P: phone portrait (§ 2). */
function portraitLayout(v: Viewport, safe: Rect): HubLayout {
  const W = safe.width - 32
  const cw = (W - CARD_GAP) / 2
  const s = cw / CARD_W
  const ch = CARD_H * s
  const cardTop = safe.y + safe.height - 24 - ch
  const caption = PHONE_CAPTION
  const top = safe.y + 8
  const available =
    cardTop - CARD_ROOM_TOP * s - 16 - caption.slot - EMMA_BUBBLE_GAP - top
  const E = clamp(120, available, 0.4 * safe.height)
  // Room the cap leaves over: half above Emma, half above the cards.
  const spare = Math.max(0, available - E) / 2
  const emma: Rect = {
    x: safe.x + (safe.width - E) / 2,
    y: top + spare,
    width: E,
    height: E,
  }
  const left = safe.x + 16
  return {
    form: 'P',
    landscape: false,
    tablet: false,
    safe,
    emma,
    content: contentOf(safe),
    captionFontSize: caption.fontSize,
    light: lightFor(emma),
    bubble: slotBubble(left, emma.y + E + EMMA_BUBBLE_GAP, W, caption),
    cards: [
      { x: left, y: cardTop, width: cw, height: ch },
      { x: left + cw + CARD_GAP, y: cardTop, width: cw, height: ch },
    ],
    s,
    garden: {
      width: v.width,
      height: v.height,
      origin: fullScreen(v),
      scale: s,
    },
  }
}

/** L: phone and tablet landscape (§§ 2-3). */
function landscapeLayout(v: Viewport, safe: Rect, tablet: boolean): HubLayout {
  const caption = tablet ? TABLET_CAPTION : PHONE_CAPTION
  const colMin = tablet ? COL_MIN_TABLET : COL_MIN_PHONE
  const s = Math.min(
    1,
    (safe.height - 16) / (CARD_ROOM_TOP + CARD_H + CARD_ROOM_BOTTOM),
    (safe.width - colMin - 72) / (2 * CARD_W),
  )
  const cw = CARD_W * s
  const ch = CARD_H * s
  const right = safe.x + safe.width - 16 - cw
  const left = right - CARD_GAP - cw
  const cardTop = safe.y + safe.height - 8 - CARD_ROOM_BOTTOM * s - ch
  const colX = safe.x + 16
  const colW = left - 24 - colX
  const E = Math.min(
    1.25 * colW,
    safe.height - 16 - caption.slot - EMMA_BUBBLE_GAP,
  )
  // Emma + gap + bubble slot, centred together in the safe height.
  const stackTop =
    safe.y + (safe.height - (E + EMMA_BUBBLE_GAP + caption.slot)) / 2
  const emma: Rect = {
    x: colX + (colW - E) / 2,
    y: stackTop,
    width: E,
    height: E,
  }
  return {
    form: 'L',
    landscape: true,
    tablet,
    safe,
    emma,
    content: contentOf(safe),
    captionFontSize: caption.fontSize,
    light: lightFor(emma),
    bubble: slotBubble(colX, stackTop + E + EMMA_BUBBLE_GAP, colW, caption),
    cards: [
      { x: left, y: cardTop, width: cw, height: ch },
      { x: right, y: cardTop, width: cw, height: ch },
    ],
    s,
    garden: {
      width: v.width,
      height: v.height,
      origin: fullScreen(v),
      scale: s,
    },
  }
}

function fullScreen(v: Viewport): Rect {
  return { x: 0, y: 0, width: v.width, height: v.height }
}

export function hubLayout(v: Viewport): HubLayout {
  const safe = safeRect(v)
  const tablet = isTablet(v)
  if (isLandscape(v)) return landscapeLayout(v, safe, tablet)
  return tablet ? stageLayout(v, safe) : portraitLayout(v, safe)
}

/** The map button's hit slop on each side, so its hit area is ≥ 56×56. */
export function mapHitSlop(s: number): number {
  return Math.max(0, (MAP_MIN_HIT - 118 * s) / 2)
}
