/**
 * The HUD's bead track with a review's moon or a warm-up's hearts (native
 * spec `design/native/review-mode-and-warmup-native.md` § 3.2). Pure maths
 * for `MathHud` (Math and Word Song).
 *
 *   Forward   [ ● ● ● ○ ○ ○ ○ ○ ]
 *   Review    [ ☾  ● ● ● ○ ○ ○ ○ ○ ]       the moon one gap before bead 1
 *   Warm-up   [ ♥ ♥    ● ○ ○ ○ ○ ○ ○ ○ ]    a double gap after the hearts
 *
 * Tight form: on a phone in landscape the track shares the pane's HUD row
 * with the status cluster (stardust + streak). The cluster is ESTIMATED at
 * ~150 pt (§ 3.2: not measured); when the worst-case track plus the cluster
 * plus 12 pt does not fit the row, that track's gap drops from 6 to 4.
 */
import type { HudLayout, HudMetrics } from './mathLayout'

/** § 3.2's estimate of the stardust pill + streak on a phone (not measured). */
export const STATUS_WIDTH_ESTIMATE = 150
/** The gap between the track and the status cluster. */
export const TRACK_STATUS_GAP = 12
/** The tight form's bead gap (from 6). */
export const TIGHT_BEAD_GAP = 4

export interface TrackShape {
  /** Scored problems (circle beads). */
  scored: number
  /** Warm-up problems (heart beads, first). */
  warmups: number
  /** A review: the moon leads the track. */
  review: boolean
}

/**
 * The track's widest width: every bead completed except the last one,
 * which is current, plus the padding. Matches § 3.2's table (phone 172 /
 * 194 / 218, tablet 258 / 290 / 326 at the default gaps).
 */
export function beadTrackWidth(
  m: HudMetrics,
  shape: TrackShape,
  gap: number = m.beadGap,
): number {
  const beads = shape.warmups + shape.scored
  if (beads === 0) return m.trackPadX * 2
  const items = beads + (shape.review ? 1 : 0)
  // The spacer after the hearts adds one gap: 2 × gap between them.
  const gaps = items - 1 + (shape.warmups > 0 && shape.scored > 0 ? 1 : 0)
  return (
    m.trackPadX * 2 +
    (shape.review ? m.bead.current : 0) +
    (beads - 1) * m.bead.completed +
    m.bead.current +
    gaps * gap
  )
}

/** The track's bead gap: the tight 4 pt only where § 3.2's rule needs it. */
export function trackBeadGap(
  m: HudMetrics,
  hud: HudLayout,
  landscape: boolean,
  shape: TrackShape,
): number {
  if (hud.kind !== 'split' || !landscape) return m.beadGap
  const fits =
    beadTrackWidth(m, shape) + STATUS_WIDTH_ESTIMATE + TRACK_STATUS_GAP <=
    hud.beads.width
  return fits ? m.beadGap : Math.min(m.beadGap, TIGHT_BEAD_GAP)
}
