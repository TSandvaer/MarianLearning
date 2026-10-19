/**
 * Fill the flower bed's numbers (mini-game spec `design/native/mini-game-flower-bed.md`
 * § 2.2, § 2.4): the bed's size in Math's problem rect, its slot centres and
 * where the chips sit, so a bud can hop from a chip to a slot. Pure maths.
 */
import type { Rect } from '../../layout/layout'
import type { MathLayout } from '../../layout/mathLayout'
import { FADE_MS } from '../math/extendedMotion'
import { BLOOM_FADE_MS, BLOOM_STAGGER_MS } from '../math/MissingNumber'
import { FRAME_COLUMNS, FRAME_ROWS } from '../math/tenFrame'

/** The ten-frame's viewBox (`TenFrameCell`). */
export const BED_VIEW_W = 130
export const BED_VIEW_H = 60
/** The bed never grows past this (pt). */
export const BED_MAX_W = 560
/** A flower or a bud in a slot, in bed units. */
export const SLOT_GLYPH_UNITS = 20

export interface Point {
  x: number
  y: number
}

/** `bedW = min(problem.width − 32, 560, problem.height × 130 / 60)`, centred. */
export function bedRect(problem: Rect): Rect {
  const width = Math.min(
    problem.width - 32,
    BED_MAX_W,
    (problem.height * BED_VIEW_W) / BED_VIEW_H,
  )
  const height = (width * BED_VIEW_H) / BED_VIEW_W
  return {
    x: problem.x + (problem.width - width) / 2,
    y: problem.y + (problem.height - height) / 2,
    width,
    height,
  }
}

/** Slot `i`'s centre inside a bed `width` pt wide: top row first, left to right. */
export function slotCentre(i: number, width: number): Point {
  const unit = width / BED_VIEW_W
  return {
    x: FRAME_COLUMNS[i % 5]! * unit,
    y: FRAME_ROWS[Math.floor(i / 5)]! * unit,
  }
}

/** The centre of chip `i` of `count` in Math's centred chip row. */
export function chipCentre(
  chips: MathLayout['chips'],
  i: number,
  count: number,
): Point {
  const { rect, size, gap } = chips
  const row = count * size + (count - 1) * gap
  return {
    x: rect.x + (rect.width - row) / 2 + size / 2 + i * (size + gap),
    y: rect.y + rect.height / 2,
  }
}

/** Reduce Motion: bud j's fade-in, then its crossfade (§ 2.7). */
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
