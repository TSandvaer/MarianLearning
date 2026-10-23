/**
 * The drag layer's shared numbers (play-place spec § 1.7) and its lock:
 * only one piece moves at a time, app-wide (a second finger is ignored).
 */

/** Under this many points of movement, a touch is a tap. */
export const TAP_SLOP = 8
export const LIFT_SCALE = 1.08
export const LIFT_MS = 120
export const SPRING = { stiffness: 300, damping: 22 } as const

/**
 * Paint order. On iOS (Fabric) a plain View that forms no stacking context
 * is flattened, so its children are sorted by zIndex in the nearest one:
 * the games' pieces (zIndex `PIECE_Z`) then draw over any later sibling
 * without a zIndex, wherever it sits in the tree. An overlay that must
 * cover every piece (a picture card, a hint hand) takes `OVER_PIECE_Z`
 * (Thomas 2026-10-23: the critters' picture drew behind the letters).
 */
export const PIECE_Z = 1
export const OVER_PIECE_Z = 2

/** The one piece being touched. */
export const dragLock: { held: symbol | null } = { held: null }

/** Tests: no piece held (a test that ends mid-drag). */
export function resetDragForTests(): void {
  dragLock.held = null
}
