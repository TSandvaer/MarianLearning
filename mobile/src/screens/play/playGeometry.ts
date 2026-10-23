/**
 * The Play-place games' geometry (play-place spec § 1.7, § 2.2, § 3.2):
 * pure maths from the lesson's Math frame. Each game fills `A`, the
 * problem and chip regions together (a game has no chips).
 */
import { isTablet, type Rect, type Viewport } from '../../layout/layout'
import { mathLayout, type MathLayout } from '../../layout/mathLayout'

export interface Point {
  x: number
  y: number
}

const bottom = (r: Rect) => r.y + r.height
const right = (r: Rect) => r.x + r.width

/** § 1.7: the play area `A`. */
export function playArea(layout: MathLayout): Rect {
  const { problem, chips } = layout
  return {
    x: problem.x,
    y: problem.y,
    width: problem.width,
    height: bottom(chips.rect) - problem.y,
  }
}

/** § 1.7: the back disc's rect, where the lesson's HUD puts it. */
export function backRect(layout: MathLayout): Rect {
  const size = layout.hudMetrics.back
  const { hud } = layout
  if (hud.kind === 'split') return { ...hud.back, width: size, height: size }
  return {
    x: hud.rect.x + hud.padX,
    y: hud.rect.y + (hud.rect.height - size) / 2,
    width: size,
    height: size,
  }
}

export const centre = (r: Rect): Point => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
})

export const contains = (r: Rect, p: Point) =>
  p.x >= r.x && p.x <= right(r) && p.y >= r.y && p.y <= bottom(r)

export const grow = (r: Rect, by: number): Rect => ({
  x: r.x - by,
  y: r.y - by,
  width: r.width + 2 * by,
  height: r.height + 2 * by,
})

export const overlaps = (a: Rect, b: Rect) =>
  a.x < right(b) && b.x < right(a) && a.y < bottom(b) && b.y < bottom(a)

// --------------------------------------------------------------------------
// Raft crossing (§ 2.2)
// --------------------------------------------------------------------------

/** Seat side and the deck's padding and gap, × a / pt. */
export const SEAT_SCALE = 0.7
const DECK_GAP = 6
const DECK_PAD = 12

export interface RaftScene {
  /** Portrait crosses upward; landscape rightward. */
  axis: 'up' | 'right'
  /** The animal cell (touch target): 64 on phones, 104 on tablets. */
  a: number
  shore: Rect
  water: Rect
  island: Rect
  /** The island's sand mound, inside its band. */
  mound: Rect
  /** The 6 shore spots (a × a cells), in shore order. */
  spots: readonly Rect[]
  /** The deck docked at the shore, and landed at the island. */
  dock: Rect
  landing: Rect
  /** The 6 seats, relative to the deck's top-left: back row, then front. */
  seats: readonly Rect[]
  /** The mast's flag, relative to the deck. */
  flag: Rect
}

export function raftScene(
  A: Rect,
  tablet: boolean,
  landscape: boolean,
): RaftScene {
  const a = tablet ? 104 : 64
  const seat = SEAT_SCALE * a
  const deckW = 3 * seat + 2 * DECK_GAP + 2 * DECK_PAD
  const deckH = 2 * seat + DECK_GAP + 2 * DECK_PAD
  const seats: Rect[] = []
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      seats.push({
        x: DECK_PAD + col * (seat + DECK_GAP),
        y: DECK_PAD + row * (seat + DECK_GAP),
        width: seat,
        height: seat,
      })
    }
  }
  const flag = { x: 0, y: -0.36 * a - 6, width: 0.5 * a, height: 0.36 * a }
  const cell = (cx: number, cy: number): Rect => ({
    x: cx - a / 2,
    y: cy - a / 2,
    width: a,
    height: a,
  })

  if (!landscape) {
    const shoreH = 0.36 * A.height
    const islandH = 0.24 * A.height
    const shore = {
      x: A.x,
      y: bottom(A) - shoreH,
      width: A.width,
      height: shoreH,
    }
    const island = { x: A.x, y: A.y, width: A.width, height: islandH }
    const water = {
      x: A.x,
      y: bottom(island),
      width: A.width,
      height: shore.y - bottom(island),
    }
    const moundW = 0.6 * A.width
    const mound = {
      x: A.x + (A.width - moundW) / 2,
      y: island.y,
      width: moundW,
      height: islandH,
    }
    const spots: Rect[] = []
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        spots.push(
          cell(
            A.x + ((col + 0.5) * A.width) / 3,
            shore.y + ((row + 0.5) * shoreH) / 2,
          ),
        )
      }
    }
    const x = A.x + (A.width - deckW) / 2
    return {
      axis: 'up',
      a,
      shore,
      water,
      island,
      mound,
      spots,
      dock: { x, y: shore.y - 4 - deckH, width: deckW, height: deckH },
      landing: { x, y: bottom(mound), width: deckW, height: deckH },
      seats,
      flag,
    }
  }

  const shoreW = 0.3 * A.width
  const islandW = 0.22 * A.width
  const shore = { x: A.x, y: A.y, width: shoreW, height: A.height }
  const island = {
    x: right(A) - islandW,
    y: A.y,
    width: islandW,
    height: A.height,
  }
  const water = {
    x: right(shore),
    y: A.y,
    width: island.x - right(shore),
    height: A.height,
  }
  const moundH = 0.8 * A.height
  const mound = {
    x: island.x,
    y: A.y + (A.height - moundH) / 2,
    width: islandW,
    height: moundH,
  }
  const spots: Rect[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      spots.push(
        cell(
          A.x + ((col + 0.5) * shoreW) / 2,
          A.y + ((row + 0.5) * A.height) / 3,
        ),
      )
    }
  }
  const y = A.y + (A.height - deckH) / 2
  return {
    axis: 'right',
    a,
    shore,
    water,
    island,
    mound,
    spots,
    dock: { x: right(shore) + 4, y, width: deckW, height: deckH },
    landing: { x: mound.x - deckW, y, width: deckW, height: deckH },
    seats,
    flag,
  }
}

/** The shore's outer edge: the bottom (portrait) or the left (landscape). */
export function outerness(scene: RaftScene, spot: Rect): number {
  return scene.axis === 'up' ? spot.y : -spot.x
}

/** Where island animal i (0-based, this visit) sits, at 0.5 a. */
export function islandSpot(scene: RaftScene, i: number): Rect {
  const s = 0.5 * scene.a
  const { mound } = scene
  const perRow = Math.max(1, Math.floor((mound.width - 8) / (s + 4)))
  const row = Math.floor(i / perRow)
  const col = i % perRow
  const rows = Math.max(1, Math.floor((mound.height - 8) / (s + 4)))
  return {
    x: mound.x + 4 + col * (s + 4) + (row % 2) * (s / 2),
    y: mound.y + 4 + (row % rows) * (s + 4),
    width: s,
    height: s,
  }
}

// --------------------------------------------------------------------------
// Letter critters (§ 3.2)
// --------------------------------------------------------------------------

export const SEATED_SCALE = 1.25

export interface CritterScene {
  /** A meadow critter's body, and the gap between cells. */
  c: number
  g: number
  perRow: number
  rows: number
  /** The log's band (seats + log) and the log itself. */
  logBand: Rect
  log: Rect
  /** The 3 seats, each 1.25 c, g apart. */
  seats: readonly Rect[]
  meadow: Rect
  /** One burrow cell per critter, in meadow order. */
  cells: readonly Rect[]
  /** The picture card's side, centred over the meadow. */
  p: number
  picture: Rect
}

export function critterScene(
  A: Rect,
  tablet: boolean,
  landscape: boolean,
  count: number,
): CritterScene {
  const c = tablet ? 88 : landscape ? 48 : 56
  const g = tablet ? 16 : 8
  const perRow = Math.max(1, Math.floor((A.width + g) / (c + g)))
  const rows = Math.max(1, Math.ceil(count / perRow))
  const meadowH = rows * c + (rows - 1) * g
  const cols = Math.min(perRow, Math.max(1, count))
  const meadowW = cols * c + (cols - 1) * g
  const seat = SEATED_SCALE * c
  const bandH = seat + 16
  const logW = 3 * seat + 2 * g + 32
  const total = bandH + g + meadowH
  const top = A.y + (A.height - total) / 2
  const logBand = {
    x: A.x + (A.width - logW) / 2,
    y: top,
    width: logW,
    height: bandH,
  }
  const seats = [0, 1, 2].map((i) => ({
    x: logBand.x + 16 + i * (seat + g),
    y: top,
    width: seat,
    height: seat,
  }))
  const meadow = {
    x: A.x + (A.width - meadowW) / 2,
    y: top + bandH + g,
    width: meadowW,
    height: meadowH,
  }
  const cells: Rect[] = []
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow)
    const inRow = Math.min(perRow, count - row * perRow)
    const rowW = inRow * c + (inRow - 1) * g
    const x0 = A.x + (A.width - rowW) / 2
    cells.push({
      x: x0 + (i % perRow) * (c + g),
      y: meadow.y + row * (c + g),
      width: c,
      height: c,
    })
  }
  const p = Math.min(meadowH, meadowW, tablet ? 300 : 200)
  return {
    c,
    g,
    perRow,
    rows,
    logBand,
    log: { x: logBand.x, y: top + seat - 8, width: logW, height: 24 },
    seats,
    meadow,
    cells,
    p,
    picture: {
      x: meadow.x + (meadowW - p) / 2,
      y: meadow.y + (meadowH - p) / 2,
      width: p,
      height: p,
    },
  }
}

/**
 * The insets a tablet's other orientation is measured with, at least: a
 * status bar (24) and a home indicator (20). Its real ones are not known
 * until she turns it, so the fit takes the larger (coordinator 2026-10-23).
 */
export const TABLET_FIT_INSETS = { top: 24, bottom: 20 } as const

/**
 * Whether `count` critters fit this tablet at the tablet size (c 88) in
 * both orientations: the log band and every burrow inside each one's `A`
 * (Thomas 2026-10-23, build 20; the coordinator's rule). Each orientation
 * is laid out as the app lays it out (`mathLayout`), with insets no
 * smaller than `TABLET_FIT_INSETS`. A phone: false (it keeps the cap).
 */
export function crittersFitBothWays(v: Viewport, count: number): boolean {
  if (!isTablet(v)) return false
  const insets = {
    ...v.insets,
    top: Math.max(v.insets.top, TABLET_FIT_INSETS.top),
    bottom: Math.max(v.insets.bottom, TABLET_FIT_INSETS.bottom),
  }
  return [
    { width: v.width, height: v.height },
    { width: v.height, height: v.width },
  ].every(({ width, height }) => {
    const layout = mathLayout({ width, height, insets })
    const A = playArea(layout)
    const s = critterScene(A, true, layout.landscape, count)
    // 0.01 pt for float error: the block is centred in `A`.
    return [s.logBand, ...s.cells].every(
      (r) =>
        r.x >= A.x - 0.01 &&
        r.y >= A.y - 0.01 &&
        right(r) <= right(A) + 0.01 &&
        bottom(r) <= bottom(A) + 0.01,
    )
  })
}
