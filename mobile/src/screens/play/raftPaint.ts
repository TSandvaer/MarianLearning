/**
 * Raft crossing's paint helpers (play-games-restyle § 2), shared by the
 * trip and the picker: the clay scale, the Map band's radius and shadow,
 * a rect as a style, and a picture's side by weight.
 */
import type { RaftWeight } from '@marian/core/games/playPlace'
import type { Rect } from '../../layout/layout'

// The clay (play-games-restyle § 2). k is the frame's clay scale (1 on
// tablets, 7/12 on phones, the Home disc's); R the Map band's radius.
export const clayK = (tablet: boolean) => (tablet ? 1 : 7 / 12)
export const bandRadius = (tablet: boolean) => 48 * clayK(tablet)
/** The Map band's shadow on its ledge colour (`landParts.tsx`). */
export const bandShadow = (lo: string, k: number) =>
  `inset 0 ${5 * k}px 0 rgba(255, 255, 255, 0.4), inset 0 ${-8 * k}px 0 rgba(0, 0, 0, 0.08), 0 ${10 * k}px 0 ${lo}, 0 ${18 * k}px ${24 * k}px rgba(60, 40, 10, 0.15)`

export const rectStyle = (r: Rect) => ({
  left: r.x,
  top: r.y,
  width: r.width,
  height: r.height,
})

/** The pack picture's side for weight `w` in a `size` cell (§ 2.2). */
export const pictureSide = (size: number, weight: RaftWeight) =>
  size * (0.72 + (0.28 * (weight - 1)) / 8)
