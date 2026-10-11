/**
 * Shared bits of the Hub's clay port (web `hubClay.css`).
 *
 * - `imageShadow`: the web's `filter: drop-shadow(0 Y B color)` on a
 *   sticker, the lock, a bud, the moon or the map icon. iOS can't filter
 *   (RN supports only `brightness` and `opacity` there), so a
 *   background-less wrapper gets `shadow*` props, which follow the image's
 *   alpha. Android draws RN's `dropShadow` filter (Android 12+; older
 *   versions show none). CSS blur radius B = Gaussian σ B / 2: RN's
 *   `standardDeviation` is σ, and iOS `shadowRadius` ≈ B / 2.
 * - The web's easings: CSS `ease` and `ease-in-out`.
 * - `box`: a rect at card reference px × s; `gardenBackground`: the
 *   backdrop's gradient list.
 */
import { Platform, type ViewStyle } from 'react-native'
import { Easing } from 'react-native-reanimated'
import type { HubLayout } from '../../layout/hubLayout'

/** CSS `ease-in-out` (keyframe loops). */
export const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)
/** CSS `ease` (the 0.12 s press transitions). */
export const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1)
/** Web `transition: transform .12s` on a card and the map button. */
export const PRESS_MS = 120

export function imageShadow(y: number, blur: number, color: string): ViewStyle {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: color,
      shadowOffset: { width: 0, height: y },
      shadowOpacity: 1,
      shadowRadius: blur / 2,
    }
  }
  return {
    filter: [
      {
        dropShadow: {
          offsetX: 0,
          offsetY: y,
          standardDeviation: blur / 2,
          color,
        },
      },
    ],
  }
}

/** Corner radii, CSS order (top-left, top-right, bottom-right, bottom-left). */
export function radii(
  tl: number,
  tr: number,
  br: number,
  bl: number,
): ViewStyle {
  return {
    borderTopLeftRadius: tl,
    borderTopRightRadius: tr,
    borderBottomRightRadius: br,
    borderBottomLeftRadius: bl,
  }
}

/** A box at card reference px × s. */
export function box(
  s: number,
  x: number,
  y: number,
  w: number,
  h: number,
): ViewStyle {
  return {
    position: 'absolute',
    left: x * s,
    top: y * s,
    width: w * s,
    height: h * s,
  }
}

const BANDS =
  'linear-gradient(#bfe6ff 0%, #dff2ff 30%, #cdebb4 38%, #b9e19e 60%, #e9dcc4 88%, #e0cfb2 100%)'

/** Web `.hub-garden`, reference px: radii, centre, colour. */
const BLOBS: readonly [number, number, number, number, string][] = [
  [60, 60, 70, 1120, '#ffb3c9'],
  [80, 80, 760, 1100, '#ffc7d6'],
  [50, 50, 130, 520, '#ffd0dc'],
  [70, 70, 720, 470, '#fff0b8'],
  [520, 260, 120, 420, '#a6d98d'],
  [520, 260, 720, 420, '#9fd488'],
]

/**
 * The Hub backdrop's gradient list (`HubBackdrop`): the six web
 * `.hub-garden` blobs over the `.hub-clay` bands.
 */
export function gardenBackground(garden: HubLayout['garden']): string {
  const { origin, scale, width, height } = garden
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`
  const blobs = BLOBS.map(([rx, ry, x, y, color]) => {
    const cx = origin.x + (x / 820) * origin.width
    const cy = origin.y + (y / 1180) * origin.height
    return `radial-gradient(${(rx * scale).toFixed(2)}px ${(ry * scale).toFixed(2)}px at ${pct(cx, width)} ${pct(cy, height)}, ${color} 0%, ${color}00 70%)`
  })
  return [...blobs, BANDS].join(', ')
}
