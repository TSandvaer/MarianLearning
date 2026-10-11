/**
 * The map's frames (`design/native/map-native.md` §§ 1-2). Pure maths;
 * the map positions everything absolutely from it.
 *
 * - **W** (tablet portrait): the web portrait 1:1. Header 124 (Home 96,
 *   title 52 pt), the path, a 128 pt caption row.
 * - **P** (phone portrait): Home 56 and a 28 pt title, the path, a
 *   reserved 4-line caption slot. Never scrolls.
 * - **L** (phone landscape): a Home rail, no title, a path pane that may
 *   scroll, a 2-line caption across the base.
 * - **TL** (tablet landscape): the web landscape with a 350 pt column.
 *
 * The path scales as one picture (§ 1): core's `layoutMap` works in web
 * px ("virtual px") and native draws every path value × `s`, so hit areas
 * stay real-size (no `transform: scale`).
 */
import {
  badgeLands,
  emmaBadge,
  landscapeNeed,
  landscapeScale,
  LANDSCAPE_TRAY_ROOM,
  type StopLayout,
} from '@marian/core/map/mapLayout'
import type { MapModel } from '@marian/core/map/mapModel'
import type { SkillNode } from '@marian/core/progress'
import {
  isLandscape,
  isTablet,
  safeRect,
  type CaptionMetrics,
  type Rect,
  type ScreenLayout,
  type Viewport,
} from './layout'

export type MapForm = 'W' | 'P' | 'L' | 'TL'

/** The web's iPad width: portrait maps narrower than this scale down. */
export const MAP_REF_W = 820
/** Phone landscape never draws the map smaller than this; it scrolls. */
export const MAP_MIN_SCALE = 0.45
/** Every stop and gate hit area is at least this square (pt). */
export const MAP_MIN_HIT = 44
/** TL's left column (the web's `minmax(230px, 24vw)` is 283 on an iPad). */
export const TL_COLUMN = 350
/** Home on phones: the web's 96 px button × 7/12. */
export const PHONE_HOME_SCALE = 7 / 12

/** Session End's phone caption (§ 2 P, L). */
const PHONE_CAPTION: CaptionMetrics = {
  font: 22,
  lineHeight: 22 * 1.18,
  padding: { horizontal: 16, vertical: 10 },
  minHeight: 64,
  radius: 32,
  speaker: 28,
  gap: 10,
}

/** The web map's caption (§ 2 W, TL). */
const TABLET_CAPTION: CaptionMetrics = {
  font: 28,
  lineHeight: 28 * 1.2,
  padding: { horizontal: 26, vertical: 12 },
  minHeight: 80,
  radius: 40,
  speaker: 38,
  gap: 14,
}

export interface MapCaptionSlot {
  /** Reserved from mount, so the path never moves. */
  slot: Rect
  metrics: CaptionMetrics
  /** The slab sits centred in the slot, or at its bottom (TL). */
  align: 'center' | 'end'
}

export interface MapScreenLayout extends ScreenLayout {
  form: MapForm
  safe: Rect
  home: Rect
  /** Web Home px × this (1 on tablets, 7/12 on phones). */
  homeScale: number
  /** The world title, or null (L has none). */
  title: (Rect & { fontSize: number }) | null
  caption: MapCaptionSlot
  /** The path's pane. */
  pane: Rect
}

const bottom = (r: Rect) => r.y + r.height
const right = (r: Rect) => r.x + r.width

function formOf(v: Viewport): MapForm {
  const tablet = isTablet(v)
  if (isLandscape(v)) return tablet ? 'TL' : 'L'
  return tablet ? 'W' : 'P'
}

export function mapScreenLayout(v: Viewport): MapScreenLayout {
  const S = safeRect(v)
  const form = formOf(v)
  const tablet = form === 'W' || form === 'TL'
  const homeScale = tablet ? 1 : PHONE_HOME_SCALE
  const homeSize = Math.round(96 * homeScale)
  const home: Rect = tablet
    ? { x: S.x + 24, y: S.y + 14, width: homeSize, height: homeSize }
    : { x: S.x + 16, y: S.y + 8, width: homeSize, height: homeSize }

  let title: MapScreenLayout['title']
  let caption: MapCaptionSlot
  let pane: Rect
  switch (form) {
    case 'P': {
      title = {
        x: S.x,
        y: home.y,
        width: S.width,
        height: homeSize,
        fontSize: 28,
      }
      const slot = {
        x: S.x + 16,
        y: bottom(S) - 16 - 124,
        width: S.width - 32,
        height: 124,
      }
      caption = { slot, metrics: PHONE_CAPTION, align: 'center' }
      const top = bottom(home) + 8
      pane = { x: S.x, y: top, width: S.width, height: slot.y - 8 - top }
      break
    }
    case 'L': {
      title = null
      const slot = {
        x: S.x + 16,
        y: bottom(S) - 16 - 72,
        width: S.width - 32,
        height: 72,
      }
      caption = { slot, metrics: PHONE_CAPTION, align: 'center' }
      pane = {
        x: S.x + 88,
        y: S.y + 8,
        width: right(S) - 16 - (S.x + 88),
        height: slot.y - 8 - (S.y + 8),
      }
      break
    }
    case 'TL': {
      title = {
        x: S.x + 16,
        y: S.y + 124,
        width: TL_COLUMN,
        height: 2 * 52,
        fontSize: 52,
      }
      const slot = {
        x: S.x + 16,
        y: bottom(S) - 24 - 192,
        width: TL_COLUMN,
        height: 192,
      }
      caption = { slot, metrics: TABLET_CAPTION, align: 'end' }
      pane = {
        x: S.x + 390,
        y: S.y + 8,
        width: right(S) - 16 - (S.x + 390),
        height: S.height - 16,
      }
      break
    }
    case 'W': {
      title = { x: S.x, y: S.y, width: S.width, height: 124, fontSize: 52 }
      const slot = {
        x: S.x + 40,
        y: bottom(S) - 128,
        width: S.width - 80,
        height: 128,
      }
      caption = { slot, metrics: TABLET_CAPTION, align: 'center' }
      pane = {
        x: S.x,
        y: S.y + 124,
        width: S.width,
        height: S.height - 124 - 128,
      }
      break
    }
  }
  return {
    form,
    landscape: form === 'L' || form === 'TL',
    tablet,
    safe: S,
    // App's Emma is hidden on the map (§ 3); her frame is unused.
    emma: home,
    content: pane,
    captionFontSize: caption.metrics.font,
    home,
    homeScale,
    title,
    caption,
    pane,
  }
}

/** How the path's virtual px map onto the pane (§ 1). */
export interface MapPathScale {
  /** pt per virtual px. */
  s: number
  /** The virtual region for `layoutMap`. */
  virtualW: number
  virtualH: number
  /** The drawn path's height, pt (> the pane's when it scrolls). */
  contentH: number
  scrolls: boolean
}

export function mapPathScale(
  pane: Pick<Rect, 'width' | 'height'>,
  model: MapModel,
  alsoBadged: readonly SkillNode[],
  landscape: boolean,
): MapPathScale {
  if (!landscape) {
    const s = Math.min(1, pane.width / MAP_REF_W)
    return {
      s,
      virtualW: pane.width / s,
      virtualH: pane.height / s,
      contentH: pane.height,
      scrolls: false,
    }
  }
  const lands = model.lands.length
  const rooms = badgeLands(model, alsoBadged).size
  const fit = landscapeScale(lands, pane.height, rooms)
  if (fit >= MAP_MIN_SCALE) {
    return {
      s: fit,
      virtualW: pane.width / fit,
      virtualH: pane.height / fit - LANDSCAPE_TRAY_ROOM,
      contentH: pane.height,
      scrolls: false,
    }
  }
  const need = landscapeNeed(lands, rooms)
  return {
    s: MAP_MIN_SCALE,
    virtualW: pane.width / MAP_MIN_SCALE,
    virtualH: need - LANDSCAPE_TRAY_ROOM,
    contentH: need * MAP_MIN_SCALE,
    scrolls: true,
  }
}

/** Slop that lifts a `box`-pt target to the 44 pt floor (§ 1). */
export function hitSlopFor(box: number): number {
  return Math.max(0, (MAP_MIN_HIT - box) / 2)
}

/**
 * Phone landscape's focus box (§ 2 L), virtual px: Emma's badge top down
 * to the stop's centre + 1 × its size (which covers the bud tray).
 */
export function focusBox(stop: StopLayout): { top: number; bottom: number } {
  return { top: emmaBadge(stop).top, bottom: stop.y + stop.size }
}

/** The opening scroll offset (pt): the focus box centred, clamped. */
export function openingOffset(
  boxes: readonly { top: number; bottom: number }[],
  s: number,
  paneH: number,
  contentH: number,
): number {
  const top = Math.min(...boxes.map((b) => b.top)) * s
  const bottom = Math.max(...boxes.map((b) => b.bottom)) * s
  const y = (top + bottom) / 2 - paneH / 2
  return Math.max(0, Math.min(contentH - paneH, y))
}
