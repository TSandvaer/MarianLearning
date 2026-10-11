/** Geometry shared by a map stop's parts (web `StopView`). */
import { budHoleSize } from '@marian/core/map/mapLayout'

/** The bud tray's height, pt (holes + its 4 px padding). */
export function budTrayHeight(
  buds: readonly (readonly boolean[])[],
  s: number,
): number {
  return (budHoleSize(buds) + 8) * s
}

/** The padlock's box (web: right −8%, bottom −6% of the stop). */
export function lockBox(px: number) {
  return {
    position: 'absolute',
    right: '-8%',
    bottom: '-6%',
    width: px,
    height: px,
  } as const
}
