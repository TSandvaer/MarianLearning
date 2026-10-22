/**
 * The flower bed's numbers on the lesson card (`design/native/flower-bed-into-add-to-10.md`
 * § 3, § 4; the look from `design/native/mini-game-flower-bed.md` § 2.2): the
 * bed's size in the visual row, its slot centres and where the chips sit, so
 * a bud can hop from a chip to a slot. Pure maths.
 */
import type { ExtendedMathLayout, MathLayout } from '../../layout/mathLayout'
import { FADE_MS } from './extendedMotion'
import { BLOOM_FADE_MS, BLOOM_STAGGER_MS } from './MissingNumber'
import { FRAME_COLUMNS, FRAME_ROWS } from './tenFrame'

/** The ten-frame's viewBox (`TenFrameCell`). */
export const BED_VIEW_W = 130
export const BED_VIEW_H = 60
/** A flower or a bud in a slot, in bed units. */
export const SLOT_GLYPH_UNITS = 20
/** The bed's side margin inside the problem rect (pt). */
const BED_MARGIN = 16

export interface Point {
  x: number
  y: number
}

/**
 * § 3: the bed's flowers are the counting row's (`flower`, its
 * `countingMetrics(…).size`), so `bedW = min(130 × unit, slotH × 130 / 60,
 * areaWidth − 32)` with `unit = flower / 20`; the height is `bedW × 60 / 130`.
 * `slotH` is the phone's reserved visual slot, or the tablet's space under
 * the equation.
 */
export function bedSize(
  flower: number,
  slotH: number,
  areaWidth: number,
): { width: number; height: number } {
  const unit = flower / SLOT_GLYPH_UNITS
  const width = Math.min(
    BED_VIEW_W * unit,
    (slotH * BED_VIEW_W) / BED_VIEW_H,
    areaWidth - 2 * BED_MARGIN,
  )
  return { width, height: (width * BED_VIEW_H) / BED_VIEW_W }
}

/** Slot `i`'s centre inside a bed `width` pt wide: top row first, left to right. */
export function slotCentre(i: number, width: number): Point {
  const unit = width / BED_VIEW_W
  return {
    x: FRAME_COLUMNS[i % 5]! * unit,
    y: FRAME_ROWS[Math.floor(i / 5)]! * unit,
  }
}

/** The centre of chip `i` of `count` in Math's centred chip row (or, in
 *  phone landscape, its centred column). */
export function chipCentre(
  chips: MathLayout['chips'],
  axis: ExtendedMathLayout['chipsAxis'] | undefined,
  i: number,
  count: number,
): Point {
  const { rect, size, gap } = chips
  const line = count * size + (count - 1) * gap
  const along = size / 2 + i * (size + gap)
  return axis === 'column'
    ? {
        x: rect.x + rect.width / 2,
        y: rect.y + (rect.height - line) / 2 + along,
      }
    : {
        x: rect.x + (rect.width - line) / 2 + along,
        y: rect.y + rect.height / 2,
      }
}

/** Reduce Motion: bud j's fade-in, then its crossfade (§ 4). */
export const REDUCED_BLOOM_FADE_MS = FADE_MS

/** When bud j is in its flower, after the right move: the bloom's end. */
export function bloomEndMs(
  j: number,
  landMs: number,
  reducedMotion: boolean,
): number {
  return reducedMotion
    ? BLOOM_STAGGER_MS * j + 2 * REDUCED_BLOOM_FADE_MS
    : landMs + BLOOM_FADE_MS
}
