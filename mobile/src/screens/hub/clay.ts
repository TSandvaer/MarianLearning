/**
 * Shared bits of the Hub's clay port (web `hubClay.css`).
 *
 * - `imageShadow`: re-exported from `components/imageShadow.ts` (shared
 *   with the map).
 * - The web's easings: CSS `ease` and `ease-in-out`.
 * - `box`: a rect at card reference px × s; `gardenBackground`: the
 *   backdrop's gradient list.
 */
import type { ViewStyle } from 'react-native'
import { Easing } from 'react-native-reanimated'
import type { HubLayout } from '../../layout/hubLayout'

export { imageShadow } from '../../components/imageShadow'

/** CSS `ease-in-out` (keyframe loops). */
export const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)
/** CSS `ease` (the 0.12 s press transitions). */
export const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1)
/** Web `transition: transform .12s` on a card and the map button. */
export const PRESS_MS = 120

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
