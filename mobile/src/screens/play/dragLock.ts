/**
 * The drag layer's shared numbers (play-place spec § 1.7) and its lock:
 * only one piece moves at a time, app-wide (a second finger is ignored).
 */

/** Under this many points of movement, a touch is a tap. */
export const TAP_SLOP = 8
export const LIFT_SCALE = 1.08
export const LIFT_MS = 120
export const SPRING = { stiffness: 300, damping: 22 } as const

/** The one piece being touched. */
export const dragLock: { held: symbol | null } = { held: null }

/** Tests: no piece held (a test that ends mid-drag). */
export function resetDragForTests(): void {
  dragLock.held = null
}
