/**
 * "Who is playing?" (learner profiles § 1.2) and the Hub's learner badge
 * (§ 2.1).
 *
 * The picker takes the Hub's frame for each form (P, L, W:
 * `./hubLayout.ts`): Emma, her light and her bubble sit where they sit on
 * the Hub, so nothing jumps between the two screens. The tiles fill the
 * Hub's card area R, the box around both card boxes: 2 or 3 learners in
 * one row, 4 in 2 × 2, 16 pt apart, centred in R and bottom-anchored as
 * the cards are (thumb zone).
 *
 * Tile: width `(R width − (columns − 1) × 16) / columns`, height
 * `min(1.25 × width, (R height − (rows − 1) × 16) / rows)`. The smallest
 * is 103 × 130 pt (3 tiles on the 375 floor); 4 tiles on the 667 × 375
 * floor are 166 × 140. Disc: `min(0.72 × width, height − name line − 36)`,
 * the clay animal at 90% of it; the name 12 pt under it, Fredoka 600 at
 * the Hub caption size.
 */
import { hubLayout, type HubLayout } from './hubLayout'
import { isTablet, type Rect, type Viewport } from './layout'

export const TILE_GAP = 16
/** Tile height ≤ this × its width. */
export const TILE_ASPECT = 1.25
/** Disc ≤ this × the tile width. */
export const DISC_OF_TILE = 0.72
/** The tile's room around the disc and the name, top to bottom. */
export const TILE_V_ROOM = 36
/** Disc → name. */
export const NAME_GAP = 12
/** The clay animal inside its disc. */
export const ANIMAL_OF_DISC = 0.9
/** The name's floor before it ellipsises (pt). */
export const NAME_MIN_SIZE = 16
export const NAME_LINE_HEIGHT = 1.15

/** The badge: a 48 pt disc in a 56 × 56 target, safe top + 8, safe left + 16. */
export const BADGE_SIZE = 48
export const BADGE_HIT = 56
const BADGE_TOP = 8
const BADGE_LEFT = 16
/** Emma's long-press target leaves out the badge rect plus this much. */
export const BADGE_EXCLUSION_PAD = 8

export interface PickerLayout extends HubLayout {
  /** The tiles, in add order. */
  tiles: readonly Rect[]
  /** The avatar disc's diameter on every tile. */
  disc: number
  /** The name's size (it shrinks to `NAME_MIN_SIZE`, then ellipsises). */
  nameSize: number
}

/** The Hub's card area R: the box around both card boxes. */
export function cardArea(hub: HubLayout): Rect {
  const [a, b] = hub.cards
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

/** Columns × rows for `count` learners: 1–3 in a row, 4 in 2 × 2. */
export function pickerGrid(count: number): { columns: number; rows: number } {
  if (count >= 4) return { columns: 2, rows: Math.ceil(count / 2) }
  return { columns: Math.max(1, count), rows: 1 }
}

export function pickerLayout(v: Viewport, count: number): PickerLayout {
  const hub = hubLayout(v)
  const r = cardArea(hub)
  const { columns, rows } = pickerGrid(count)
  const width = (r.width - (columns - 1) * TILE_GAP) / columns
  const height = Math.min(
    TILE_ASPECT * width,
    (r.height - (rows - 1) * TILE_GAP) / rows,
  )
  const nameSize = isTablet(v) ? 30 : 22
  const nameLine = nameSize * NAME_LINE_HEIGHT
  const disc = Math.max(
    0,
    Math.min(DISC_OF_TILE * width, height - nameLine - TILE_V_ROOM),
  )
  // Centred in R, bottom-anchored.
  const gridW = columns * width + (columns - 1) * TILE_GAP
  const gridH = rows * height + (rows - 1) * TILE_GAP
  const left = r.x + (r.width - gridW) / 2
  const top = r.y + r.height - gridH
  const tiles: Rect[] = []
  for (let i = 0; i < count; i++) {
    const col = i % columns
    const row = Math.floor(i / columns)
    tiles.push({
      x: left + col * (width + TILE_GAP),
      y: top + row * (height + TILE_GAP),
      width,
      height,
    })
  }
  return { ...hub, tiles, disc, nameSize }
}

/** The badge's 48 pt disc and its 56 × 56 hit area (§ 2.1), on P, L and W. */
export function hubBadge(hub: HubLayout): { disc: Rect; hit: Rect } {
  const disc = {
    x: hub.safe.x + BADGE_LEFT,
    y: hub.safe.y + BADGE_TOP,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
  }
  const inset = (BADGE_HIT - BADGE_SIZE) / 2
  return {
    disc,
    hit: {
      x: disc.x - inset,
      y: disc.y - inset,
      width: BADGE_HIT,
      height: BADGE_HIT,
    },
  }
}

/** The rect Emma's 3 s press ignores: the badge's hit area plus 8 pt. */
export function badgeExclusion(hub: HubLayout): Rect {
  const { hit } = hubBadge(hub)
  return {
    x: hit.x - BADGE_EXCLUSION_PAD,
    y: hit.y - BADGE_EXCLUSION_PAD,
    width: hit.width + 2 * BADGE_EXCLUSION_PAD,
    height: hit.height + 2 * BADGE_EXCLUSION_PAD,
  }
}

export function containsPoint(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
}
