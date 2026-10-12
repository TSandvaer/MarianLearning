/**
 * Parent Settings layout (`design/native/parent-settings-native.md` § 1).
 *
 * One scrolling column, at most 720 pt wide, centred in the safe rect,
 * under a fixed header. Two forms: compact (phone portrait, or large
 * system text) stacks the segmented controls under their text; wide puts
 * every control inline on the right, like the web rows. There is no Emma
 * frame: Emma is not on this screen.
 */
import { isTablet, safeRect, type Viewport } from './layout'

export interface ParentSettingsLayout {
  tablet: boolean
  /** Segmented controls go under their text. */
  compact: boolean
  /** The header bar's height, below the safe top. */
  headerHeight: number
  /** The safe top inset the header sits under. */
  safeTop: number
  /** The safe bottom inset (the keyboard padding subtracts it). */
  safeBottom: number
  /** The column, in screen coordinates. */
  column: { x: number; width: number }
  /** A card's inner width (column − 2 × (20 padding + 1 border)). */
  cardInner: number
  contentPadTop: number
  contentPadBottom: number
  /** Header title / subtitle sizes. */
  titleSize: number
  subtitleSize: number
}

/** The web's `max-w-3xl` (768) minus its `px-6`. */
export const COLUMN_MAX = 720
/** A card's 20 pt padding + 1 pt border, on both sides. */
export const CARD_CHROME = 42
/**
 * Below this card inner width the segmented controls stack: a
 * three-segment control (242) + the 24 pt gap + a 254 pt text column.
 */
export const COMPACT_BELOW = 520
/** Above this system text scale, inline segments no longer fit. */
export const COMPACT_FONT_SCALE = 1.2

export function parentSettingsLayout(
  viewport: Viewport,
  fontScale: number,
): ParentSettingsLayout {
  const s = safeRect(viewport)
  const tablet = isTablet(viewport)
  const pad = tablet ? 24 : 16
  const width = Math.max(0, Math.min(COLUMN_MAX, s.width - 2 * pad))
  const cardInner = Math.max(0, width - CARD_CHROME)
  return {
    tablet,
    compact: cardInner < COMPACT_BELOW || fontScale > COMPACT_FONT_SCALE,
    headerHeight: tablet ? 72 : 56,
    safeTop: s.y,
    safeBottom: viewport.insets.bottom,
    column: { x: s.x + (s.width - width) / 2, width },
    cardInner,
    contentPadTop: tablet ? 32 : 20,
    contentPadBottom: 32 + viewport.insets.bottom,
    titleSize: tablet ? 24 : 20,
    subtitleSize: tablet ? 14 : 13,
  }
}
