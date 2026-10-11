/**
 * The map's frames (web `src/screens/Map/MapScreen.tsx`): a header (Home
 * button + world title), the path region, and the caption slab. Pure
 * maths; the map positions everything absolutely from it.
 *
 * - **Portrait**: header row, path, caption row, top to bottom (web
 *   portrait). Tablet: the web's px 1:1 (header 124, caption row 128,
 *   caption 28 pt). Phone: the Hub's phone rules (56 pt hit areas, a
 *   22 pt caption with a reserved slot, so the path never moves).
 * - **Landscape**: header and caption in a left column, the path on the
 *   right over the full height (web `landscape:` grid, column
 *   `minmax(230px, 24vw)`).
 *
 * The path itself is laid out by core's `layoutMap` on a virtual region
 * and scaled to fit (`pathFrame`): at most web size, at least
 * `PATH_MIN_W` virtual px wide (core's stop insets assume an iPad-wide
 * region), and in landscape no taller than the web's landscape bands
 * allow (`landscapeScale`). Everything in the path shrinks together.
 */
import { LANDSCAPE_TRAY_ROOM, landscapeScale } from '@marian/core/map/mapLayout'
import {
  isLandscape,
  isTablet,
  safeRect,
  type Rect,
  type ScreenLayout,
  type Viewport,
} from './layout'

/** Narrowest virtual path region (iPad mini portrait, 744 pt). */
export const PATH_MIN_W = 744
/** Never below this for a tap target (pt). */
export const MAP_MIN_HIT = 56
/** Caption line height (web `lineHeight: 1.2`). */
export const CAPTION_LINE_HEIGHT = 1.2
/** Web landscape left column: `minmax(230px, 24vw)`. */
export const COLUMN_MIN = 230
export const COLUMN_VW = 0.24

export interface MapCaptionLayout extends Rect {
  fontSize: number
  lineHeight: number
  /** Slab padding (vertical, horizontal) and corner radius. */
  padV: number
  padH: number
  radius: number
  /** Speaker glyph size and its gap to the text. */
  speaker: number
  gap: number
  /** Bottom-aligned in the landscape column; centred in the row. */
  align: 'center' | 'end'
}

export interface MapScreenLayout extends ScreenLayout {
  safe: Rect
  home: Rect
  homeIcon: number
  /** Title box (centred text) and its font size. */
  title: Rect & { fontSize: number }
  /** The path region, in screen pt. */
  path: Rect
  caption: MapCaptionLayout
}

function caption(
  box: Rect,
  tablet: boolean,
  align: MapCaptionLayout['align'],
): MapCaptionLayout {
  return tablet
    ? {
        ...box,
        fontSize: 28,
        lineHeight: CAPTION_LINE_HEIGHT,
        padV: 12,
        padH: 26,
        radius: 40,
        speaker: 38,
        gap: 14,
        align,
      }
    : {
        ...box,
        fontSize: 22,
        lineHeight: CAPTION_LINE_HEIGHT,
        padV: 10,
        padH: 16,
        radius: 28,
        speaker: 28,
        gap: 10,
        align,
      }
}

/** Height of a caption slot that holds `lines` lines at `fontSize`. */
export function captionSlot(fontSize: number, lines: number, padV: number) {
  return Math.ceil(lines * fontSize * CAPTION_LINE_HEIGHT + 2 * padV)
}

export function mapLayout(v: Viewport): MapScreenLayout {
  const safe = safeRect(v)
  const landscape = isLandscape(v)
  const tablet = isTablet(v)
  const homeSize = tablet ? 96 : MAP_MIN_HIT
  const homeIcon = Math.round(homeSize * (68 / 96))
  const titleFont = tablet ? 52 : 32

  if (landscape) {
    const colW = Math.max(COLUMN_MIN, Math.round(v.width * COLUMN_VW))
    const home = {
      x: safe.x + (tablet ? 24 : 12),
      y: safe.y + (tablet ? 14 : 8),
      width: homeSize,
      height: homeSize,
    }
    const titleTop = home.y + homeSize + (tablet ? 14 : 8)
    const title = {
      x: safe.x,
      y: titleTop,
      width: colW,
      height: Math.ceil(titleFont * 2.1),
      fontSize: titleFont,
    }
    const capTop = title.y + title.height + 8
    const cap = caption(
      {
        x: safe.x + 12,
        y: capTop,
        width: colW - 24,
        height: safe.y + safe.height - (tablet ? 24 : 12) - capTop,
      },
      tablet,
      'end',
    )
    return {
      landscape,
      tablet,
      safe,
      emma: home,
      content: safe,
      captionFontSize: cap.fontSize,
      home,
      homeIcon,
      title,
      path: {
        x: safe.x + colW,
        y: safe.y + 8,
        width: safe.width - colW,
        height: safe.height - 16,
      },
      caption: cap,
    }
  }

  const headerH = tablet ? 124 : homeSize + 16
  const home = {
    x: safe.x + (tablet ? 24 : 12),
    y: safe.y + (tablet ? 14 : 8),
    width: homeSize,
    height: homeSize,
  }
  const title = {
    x: home.x + homeSize,
    y: safe.y,
    width: safe.width - 2 * (home.x - safe.x + homeSize),
    height: headerH,
    fontSize: titleFont,
  }
  const capProto = caption(
    { x: 0, y: 0, width: 0, height: 0 },
    tablet,
    'center',
  )
  const rowH = tablet
    ? 128
    : captionSlot(capProto.fontSize, 4, capProto.padV) + 20
  const capBox = {
    x: safe.x + (tablet ? 40 : 16),
    y: safe.y + safe.height - rowH,
    width: safe.width - 2 * (tablet ? 40 : 16),
    height: rowH,
  }
  return {
    landscape,
    tablet,
    safe,
    emma: home,
    content: safe,
    captionFontSize: capProto.fontSize,
    home,
    homeIcon,
    title,
    path: {
      x: safe.x,
      y: safe.y + headerH,
      width: safe.width,
      height: safe.height - headerH - rowH,
    },
    caption: caption(capBox, tablet, 'center'),
  }
}

/** How the path's virtual region maps onto `path`. */
export interface PathFrame {
  /** Virtual px → pt. */
  scale: number
  /** Virtual region for `layoutMap`. */
  width: number
  height: number
}

export function pathFrame(
  path: Pick<Rect, 'width' | 'height'>,
  landscape: boolean,
  lands: number,
  badgeLandCount: number,
): PathFrame {
  const byWidth = Math.min(1, path.width / PATH_MIN_W)
  const scale = landscape
    ? Math.min(byWidth, landscapeScale(lands, path.height, badgeLandCount))
    : byWidth
  if (scale <= 0) return { scale: 1, width: 0, height: 0 }
  return {
    scale,
    width: path.width / scale,
    height: path.height / scale - (landscape ? LANDSCAPE_TRAY_ROOM : 0),
  }
}
