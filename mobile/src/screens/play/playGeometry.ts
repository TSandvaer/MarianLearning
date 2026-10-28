/**
 * The Play-place games' geometry (play-place spec § 1.7, § 2.2, § 3.2):
 * pure maths from the lesson's Math frame. Each game fills `A`, the
 * problem and chip regions together (a game has no chips).
 */
import type { RaftTarget } from '@marian/core/games/playPlace'
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
/**
 * The 20 deck, 4 × 2 (raft-island-goal § 4.1, Decision 6): seat columns 4
 * apart and an 8 pt side pad on phones, 6 and 12 on tablets; rows as the
 * 10 deck's.
 */
const DECK_20 = {
  phone: { gap: 4, pad: 8 },
  tablet: { gap: 6, pad: 12 },
} as const

export interface RaftScene {
  /** The raft's load: the 10 deck is 3 × 2, the 20 deck 4 × 2. */
  target: RaftTarget
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
  /** The seats (6, or 8), relative to the deck's top-left: back row,
   *  then front. */
  seats: readonly Rect[]
  /** The mast's flag, relative to the deck. */
  flag: Rect
}

export function raftScene(
  A: Rect,
  tablet: boolean,
  landscape: boolean,
  target: RaftTarget = 10,
): RaftScene {
  const a = tablet ? 104 : 64
  const seat = SEAT_SCALE * a
  const cols = target === 10 ? 3 : 4
  const { gap: colGap, pad: sidePad } =
    target === 10
      ? { gap: DECK_GAP, pad: DECK_PAD }
      : DECK_20[tablet ? 'tablet' : 'phone']
  const deckW = cols * seat + (cols - 1) * colGap + 2 * sidePad
  const deckH = 2 * seat + DECK_GAP + 2 * DECK_PAD
  const seats: Rect[] = []
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < cols; col++) {
      seats.push({
        x: sidePad + col * (seat + colGap),
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
      target,
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
    target,
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

/** The clay oval's drop under its face: 7 on phones, 10 on tablets. */
export const clayDrop = (tablet: boolean) => (tablet ? 10 : 7)

/** The island's clay oval face: the mound less its drop. */
export function moundFace(scene: RaftScene): Rect {
  const { mound } = scene
  const tablet = scene.a > 64
  return { ...mound, height: mound.height - clayDrop(tablet) }
}

/** A home's side (raft-island-goal Decision 2): 0.42 a phones, 0.55 a tablets. */
export const homeSize = (a: number, tablet: boolean) =>
  (tablet ? 0.55 : 0.42) * a

/**
 * Nine `h × h` cells `gap` apart, in reading order (bee 1 to pig 9),
 * centred on `at`: rows of 5 and 4 (the 4 centred under the 5, like
 * bricks), or 3 × 3.
 */
function homeGrid(
  at: Point,
  h: number,
  gap: number,
  fiveFour: boolean,
): Rect[] {
  const rows = fiveFour ? [5, 4] : [3, 3, 3]
  const gh = rows.length * h + (rows.length - 1) * gap
  const out: Rect[] = []
  rows.forEach((n, r) => {
    const rw = n * h + (n - 1) * gap
    for (let c = 0; c < n; c++) {
      out.push({
        x: at.x - rw / 2 + c * (h + gap),
        y: at.y - gh / 2 + r * (h + gap),
        width: h,
        height: h,
      })
    }
  })
  return out
}

/**
 * The nine homes (raft-island-goal § 1.2): `h`-sided cells 4 pt (phones)
 * or 6 pt (tablets) apart, centred on the oval face; rows of 5 and 4 in
 * portrait, 3 × 3 in landscape. Home `w` is cell `w − 1`.
 */
export function islandHomes(scene: RaftScene): Rect[] {
  const tablet = scene.a > 64
  return homeGrid(
    centre(moundFace(scene)),
    homeSize(scene.a, tablet),
    tablet ? 6 : 4,
    scene.axis === 'up',
  )
}

/** A home's nest, its sand dip (§ 1.1): (0.04 h, 0.6 h), 0.92 h × 0.36 h. */
export function homeNest(home: Rect): Rect {
  const h = home.width
  return {
    x: home.x + 0.04 * h,
    y: home.y + 0.6 * h,
    width: 0.92 * h,
    height: 0.36 * h,
  }
}

/**
 * The two bushes (10 island) or sand stones (20 island) at the oval's
 * long-axis ends (§ 1.2): centred 0.86 × (semi-axis − 2) from the face's
 * centre, 0.32 a × 0.26 a.
 */
export function islandTips(scene: RaftScene): Rect[] {
  const face = moundFace(scene)
  const c = centre(face)
  const w = 0.32 * scene.a
  const h = 0.26 * scene.a
  const along = scene.axis === 'up' ? face.width / 2 : face.height / 2
  const d = 0.86 * (along - 2)
  return [-1, 1].map((sgn) => {
    const p =
      scene.axis === 'up'
        ? { x: c.x + sgn * d, y: c.y }
        : { x: c.x, y: c.y + sgn * d }
    return { x: p.x - w / 2, y: p.y - h / 2, width: w, height: h }
  })
}

/**
 * The target board on the raft's front edge (§ 4.3), relative to the
 * deck: 0.56 a × 0.34 a, centred, its top at `deck height − 12 − 0.1 a`.
 */
export function targetBoard(scene: RaftScene): Rect {
  const { a, dock } = scene
  const width = 0.56 * a
  return {
    x: (dock.width - width) / 2,
    y: dock.height - 12 - 0.1 * a,
    width,
    height: 0.34 * a,
  }
}

/**
 * Whether `inner` (an ellipse in its rect) lies inside the ellipse of
 * `outer` inset by `inset` on every side.
 */
export function ellipseInside(inner: Rect, outer: Rect, inset = 0): boolean {
  const o = centre(outer)
  const A = outer.width / 2 - inset
  const B = outer.height / 2 - inset
  const c = centre(inner)
  for (let k = 0; k < 360; k++) {
    const t = (k / 180) * Math.PI
    const x = c.x + (inner.width / 2) * Math.cos(t) - o.x
    const y = c.y + (inner.height / 2) * Math.sin(t) - o.y
    if ((x / A) ** 2 + (y / B) ** 2 > 1 + 1e-9) return false
  }
  return true
}

/** One raft's pond in the picker (raft-island-goal § 5.2). */
export interface RaftPond {
  target: RaftTarget
  /** The pool slab: the whole pond is the button. */
  pond: Rect
  /** The raft's scene at the pond (its seats, flag and board). */
  raft: RaftScene
  /** The deck, docked in the pond. */
  deck: Rect
  /** The island's clay oval: its face, and the drop under it. */
  island: Rect
  face: Rect
  /** The nine homes at the picker's `hp`, no tags. */
  homes: readonly Rect[]
}

/**
 * The raft picker (§ 5.2): one pond per raft, the full width (portrait,
 * stacked, 10 on top) or half (landscape, side by side, 10 on the left),
 * 16 apart; inside, inset 8 pt (phones) or 16 (tablets), the raft at full
 * size and its island. Portrait: the raft block (flag to deck) centred
 * down the pond's left side, the island centred in the room an inset
 * right of the wider deck; landscape: the deck on the pond's bottom inset, the island
 * above it, right of the flag. The island's face is the home grid ÷ 0.7
 * each way, narrowed to its room, grown in height until every nest lies
 * inside it inset 2 pt; the oval is that face and its drop, no taller than
 * its room. Homes `hp`: 0.34 a on phones, 0.55 a on tablets, the grid
 * 3 × 3 in portrait and 5 + 4 in landscape.
 */
export function raftPicker(
  A: Rect,
  tablet: boolean,
  landscape: boolean,
  targets: readonly RaftTarget[],
): RaftPond[] {
  const n = targets.length
  const inset = tablet ? 16 : 8
  const drop = clayDrop(tablet)
  const pondW = landscape ? (A.width - 16 * (n - 1)) / n : A.width
  const pondH = landscape ? A.height : (A.height - 16 * (n - 1)) / n
  const scenes = targets.map((t) => raftScene(A, tablet, landscape, t))
  const a = scenes[0]!.a
  const hp = (tablet ? 0.55 : 0.34) * a
  const gap = tablet ? 6 : 4
  const fiveFour = landscape
  const cols = fiveFour ? 5 : 3
  const rows = fiveFour ? 2 : 3
  const gw = cols * hp + (cols - 1) * gap
  const gh = rows * hp + (rows - 1) * gap
  const widest = Math.max(...scenes.map((sc) => sc.dock.width))
  const flagUp = -scenes[0]!.flag.y
  /** Past the flag's right edge, landscape (§ 5.2's L and TL). */
  const flagGap = tablet ? 8 : 6
  return targets.map((target, i) => {
    const raft = scenes[i]!
    const pond: Rect = {
      x: A.x + (landscape ? i * (pondW + 16) : 0),
      y: A.y + (landscape ? 0 : i * (pondH + 16)),
      width: pondW,
      height: pondH,
    }
    const { width: dw, height: dh } = raft.dock
    const deck: Rect = landscape
      ? {
          x: pond.x + inset,
          y: bottom(pond) - inset - dh,
          width: dw,
          height: dh,
        }
      : {
          x: pond.x + inset,
          y: pond.y + (pondH - flagUp - dh) / 2 + flagUp,
          width: dw,
          height: dh,
        }
    const room: Rect = landscape
      ? (() => {
          const x = deck.x + raft.flag.x + 7 + raft.flag.width + flagGap
          const y = pond.y + inset
          return {
            x,
            y,
            width: right(pond) - inset - x,
            height: deck.y - flagGap - y,
          }
        })()
      : (() => {
          const x = pond.x + 2 * inset + widest
          return {
            x,
            y: pond.y + inset,
            width: right(pond) - inset - x,
            height: pondH - 2 * inset,
          }
        })()
    const faceW = Math.min(gw / 0.7, room.width)
    let faceH = gh / 0.7
    const fits = (h: number) => {
      const face = { x: 0, y: 0, width: faceW, height: h }
      return homeGrid(centre(face), hp, gap, fiveFour).every((home) =>
        ellipseInside(homeNest(home), face, 2),
      )
    }
    while (!fits(faceH) && faceH < room.height) faceH += 0.5
    const islandH = Math.min(faceH + drop, room.height)
    const island: Rect = {
      x: room.x + (room.width - faceW) / 2,
      y: room.y + (room.height - islandH) / 2,
      width: faceW,
      height: islandH,
    }
    const face = { ...island, height: islandH - drop }
    return {
      target,
      pond,
      raft,
      deck,
      island,
      face,
      homes: homeGrid(centre(face), hp, gap, fiveFour),
    }
  })
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
  /** The seats (3, or 4 in a four-letter round), each 1.25 c, g apart. */
  seats: readonly Rect[]
  meadow: Rect
  /** One burrow cell per critter, in meadow order. */
  cells: readonly Rect[]
  /** The picture card's side, centred over the meadow. */
  p: number
  picture: Rect
}

/** The log band's width: `n` seats of 1.25 c, `g` apart, 16 a side. */
const logBandWidth = (c: number, g: number, n: number) =>
  n * SEATED_SCALE * c + (n - 1) * g + 32

export function critterScene(
  A: Rect,
  tablet: boolean,
  landscape: boolean,
  count: number,
  {
    perRow: fixedPerRow,
    seatCount = 3,
  }: { perRow?: number; seatCount?: number } = {},
): CritterScene {
  const c = tablet ? 88 : landscape ? 48 : 56
  const g = tablet ? 16 : 8
  const perRow = fixedPerRow ?? Math.max(1, Math.floor((A.width + g) / (c + g)))
  const rows = Math.max(1, Math.ceil(count / perRow))
  const meadowH = rows * c + (rows - 1) * g
  const cols = Math.min(perRow, Math.max(1, count))
  const meadowW = cols * c + (cols - 1) * g
  const seat = SEATED_SCALE * c
  const bandH = seat + 16
  const logW = logBandWidth(c, g, seatCount)
  const total = bandH + g + meadowH
  const top = A.y + (A.height - total) / 2
  const logBand = {
    x: A.x + (A.width - logW) / 2,
    y: top,
    width: logW,
    height: bandH,
  }
  const seats = Array.from({ length: seatCount }, (_, i) => ({
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

// --------------------------------------------------------------------------
// Letter critters' word hunt (critters-word-hunt.md § 2)
// --------------------------------------------------------------------------

/** § 2.2: a slot's box, box gap, padding and picture box; the chip's tile. */
export interface SlotStep {
  name: 'S1' | 'S2' | 'S3' | 'S4' | 'S5'
  b: number
  gb: number
  pad: number
  T: number
  bx: number
}

/**
 * § 2.2's ladder: tablets take the first that fits; phones take S4 (pad 3,
 * T 36 since § 15.10: the largest picture box the tightest phone fits).
 * S5 is the four-letter rounds' (critters-four-letter.md § 2.2): S4 with
 * b 20, for a phone where a four-box S4 does not fit (667 × 375).
 */
export const SLOT_STEPS: readonly SlotStep[] = [
  { name: 'S1', b: 40, gb: 4, pad: 8, T: 72, bx: 28 },
  { name: 'S2', b: 32, gb: 4, pad: 8, T: 56, bx: 24 },
  { name: 'S3', b: 28, gb: 3, pad: 6, T: 44, bx: 20 },
  { name: 'S4', b: 22, gb: 2, pad: 3, T: 36, bx: 16 },
  { name: 'S5', b: 20, gb: 2, pad: 3, T: 36, bx: 16 },
]

/** The hunt's 6 critters: 3 a row, 2 rows (Decision 2). */
export const HUNT_PER_ROW = 3
export const HUNT_CRITTERS = 6
/** A four-letter round's 7: 4 + 3, vowel first (four-letter Decision 1). */
export const HUNT_FOUR_PER_ROW = 4
export const HUNT_FOUR_CRITTERS = 7

/** A slot: its card, picture box and a tile box per letter. */
export interface SlotParts {
  card: Rect
  picture: Rect
  boxes: readonly Rect[]
}

export interface HuntScene extends CritterScene {
  /** The round's word length: the seats, boxes and numeral. */
  length: 3 | 4
  step: SlotStep
  /** The log band and the meadow together. */
  block: Rect
  /** The N slots (and, in landscape, the chip's cell). */
  board: Rect
  slots: readonly SlotParts[]
  /**
   * Landscape: the board's cell after the last slot; portrait, and every
   * four-letter round (no chip, critters-four-letter.md § 15.3): none.
   */
  chipCell: Rect | null
  /** The numeral disc on the log's left end (§ 3.2). */
  numeral: Rect
}

/** § 2.2: a slot's side for `step`, with a box per letter. */
export const slotSize = ({ b, gb, pad, T }: SlotStep, letters = 3) => ({
  width: letters * b + (letters - 1) * gb + 2 * pad,
  height: pad + T + pad + b + pad,
})

function slotParts(
  x: number,
  y: number,
  step: SlotStep,
  letters: number,
): SlotParts {
  const { b, gb, pad, T } = step
  const { width, height } = slotSize(step, letters)
  return {
    card: { x, y, width, height },
    picture: { x: x + (width - T) / 2, y: y + pad, width: T, height: T },
    boxes: Array.from({ length: letters }, (_, k) => ({
      x: x + pad + k * (b + gb),
      y: y + pad + T + pad,
      width: b,
      height: b,
    })),
  }
}

/**
 * § 4.5: the bonus chip with `k` extras (1-3), stacked in a column, the
 * newest at the bottom: beside the meadow, bottom-aligned (portrait), or
 * centred in its cell (landscape).
 */
export function chipRect(scene: HuntScene, k: number): Rect {
  const { bx, gb, pad } = scene.step
  const width = 3 * bx + 2 * gb + 2 * pad
  const height = k * bx + (k - 1) * pad + 2 * pad
  const cell = scene.chipCell
  if (cell !== null) {
    return {
      x: cell.x + (cell.width - width) / 2,
      y: cell.y + (cell.height - height) / 2,
      width,
      height,
    }
  }
  const { meadow, g } = scene
  return {
    x: right(meadow) + g,
    y: bottom(meadow) - height,
    width,
    height,
  }
}

/** The tile boxes of the chip's extra `i` of `k`. */
export function chipTiles(scene: HuntScene, k: number, i: number): Rect[] {
  const { bx, gb, pad } = scene.step
  const chip = chipRect(scene, k)
  return [0, 1, 2].map((j) => ({
    x: chip.x + pad + j * (bx + gb),
    y: chip.y + pad + i * (bx + pad),
    width: bx,
    height: bx,
  }))
}

/**
 * § 2.3: the scene for `n` targets with `step`. A four-letter round
 * (critters-four-letter.md § 2): 4 seats, 7 critters 4 + 3, four-box
 * slots, no chip; landscape boards in 2 columns (Decision 3).
 */
function huntSceneAt(
  A: Rect,
  tablet: boolean,
  landscape: boolean,
  n: number,
  step: SlotStep,
  length: 3 | 4 = 3,
): HuntScene {
  const c = tablet ? 88 : landscape ? 48 : 56
  const g = tablet ? 16 : 8
  const seat = SEATED_SCALE * c
  const blockW = logBandWidth(c, g, length)
  const blockH = seat + 16 + g + 2 * c + g
  const sg = tablet ? 16 : 6
  const { width: W, height: H } = slotSize(step, length)
  const rowW = (k: number) => k * W + (k - 1) * sg

  let rows: number[]
  let blockAt: { x: number; y: number }
  let boardRect: Rect
  if (!landscape) {
    rows = [Math.ceil(n / 2), Math.floor(n / 2)]
    const boardW = rowW(rows[0]!)
    const boardH = 2 * H + sg
    const gap = tablet ? 24 : 12
    const top = A.y + (A.height - (boardH + gap + blockH)) / 2
    boardRect = {
      x: A.x + (A.width - boardW) / 2,
      y: top,
      width: boardW,
      height: boardH,
    }
    blockAt = { x: A.x + (A.width - blockW) / 2, y: top + boardH + gap }
  } else {
    // Three letters: the slots and the chip's cell, 3 a row. Four: the
    // slots alone, 2 a row.
    const perRow = length === 4 ? 2 : 3
    const cells = length === 4 ? n : n + 1
    rows = []
    for (let left = cells; left > 0; left -= perRow) {
      rows.push(Math.min(perRow, left))
    }
    const boardW = rowW(perRow)
    const boardH = rows.length * H + (rows.length - 1) * sg
    const gap = Math.min(24, A.width - blockW - boardW)
    const x0 = A.x + (A.width - (blockW + gap + boardW)) / 2
    blockAt = { x: x0, y: A.y + (A.height - blockH) / 2 }
    boardRect = {
      x: x0 + blockW + gap,
      y: A.y + (A.height - boardH) / 2,
      width: boardW,
      height: boardH,
    }
  }
  const mid = boardRect.x + boardRect.width / 2
  const cellRects: Rect[] = []
  rows.forEach((k, r) => {
    const x0 = mid - rowW(k) / 2
    for (let i = 0; i < k; i++) {
      cellRects.push({
        x: x0 + i * (W + sg),
        y: boardRect.y + r * (H + sg),
        width: W,
        height: H,
      })
    }
  })
  const block = { ...blockAt, width: blockW, height: blockH }
  const four = length === 4
  const base = critterScene(
    block,
    tablet,
    landscape,
    four ? HUNT_FOUR_CRITTERS : HUNT_CRITTERS,
    { perRow: four ? HUNT_FOUR_PER_ROW : HUNT_PER_ROW, seatCount: length },
  )
  const p = Math.min(blockH, blockW, tablet ? 300 : 200)
  const D = tablet ? 40 : 32
  return {
    ...base,
    p,
    picture: {
      x: block.x + (blockW - p) / 2,
      y: block.y + (blockH - p) / 2,
      width: p,
      height: p,
    },
    length,
    step,
    block,
    board: boardRect,
    slots: cellRects.slice(0, n).map((r) => slotParts(r.x, r.y, step, length)),
    chipCell: landscape && !four ? cellRects[n]! : null,
    numeral: {
      x: base.log.x,
      y: base.log.y + base.log.height / 2 - D / 2,
      width: D,
      height: D,
    },
  }
}

/** A burrow hangs 0.04 c below its cell (`LetterCritters.tsx` burrow). */
const BURROW_HANG = 0.04

/**
 * § 2.2's fit rule for `scene`: every part inside `A` (burrows included);
 * each slot clear of the other slots, the log band, the numeral, every
 * seat's drop zone, every meadow cell and the bonus chip (3 extras); the
 * chip clear of the meadow and the drop zones; the picture card off the
 * board. A four-letter round has no chip (critters-four-letter.md § 2.2).
 */
export function huntSceneFits(scene: HuntScene, A: Rect): boolean {
  const e = 0.01
  const inA = (r: Rect) =>
    r.x >= A.x - e &&
    r.y >= A.y - e &&
    right(r) <= right(A) + e &&
    bottom(r) <= bottom(A) + e
  const chips = scene.length === 4 ? [] : [chipRect(scene, 3)]
  const cards = scene.slots.map((s) => s.card)
  const drops = scene.seats.map((r) => grow(r, 0.2 * scene.c))
  const burrows = scene.cells.map((r) => ({
    ...r,
    height: r.height + BURROW_HANG * scene.c,
  }))
  const parts = [
    ...cards,
    scene.logBand,
    scene.numeral,
    ...burrows,
    ...chips,
    scene.picture,
  ]
  if (!parts.every(inA)) return false
  const others = [
    scene.logBand,
    scene.numeral,
    ...drops,
    ...scene.cells,
    ...chips,
  ]
  for (let i = 0; i < cards.length; i++) {
    if (others.some((o) => overlaps(cards[i]!, o))) return false
    if (cards.some((o, j) => j !== i && overlaps(cards[i]!, o))) return false
  }
  for (const chip of chips) {
    if ([...scene.cells, ...drops].some((o) => overlaps(chip, o))) return false
  }
  return !overlaps(scene.picture, scene.board)
}

/**
 * The word hunt's scene (§ 2): a phone takes S4; a tablet the first of
 * S1, S2, S3 that fits for every N from 4 to 8 in this orientation (else
 * S3, logged; N 4 since the pictured-only boards, § 16.2, at the steps N
 * 5-8 took). The step depends on `A` alone, so slots keep their size
 * from round to round. A four-letter round (critters-four-letter.md
 * § 2.2): a tablet the first of S1-S4 that fits for N 4, 5 and 6, a phone
 * the first of S4, S5 (else the last, logged).
 */
export function huntScene(
  A: Rect,
  tablet: boolean,
  landscape: boolean,
  n: number,
  length: 3 | 4 = 3,
): HuntScene {
  if (length === 4) {
    const ladder = tablet ? SLOT_STEPS.slice(0, 4) : SLOT_STEPS.slice(3, 5)
    const step = ladder.find((st) =>
      [4, 5, 6].every((k) =>
        huntSceneFits(huntSceneAt(A, tablet, landscape, k, st, 4), A),
      ),
    )
    if (step === undefined) {
      console.warn(
        `[layout] four-letter rounds do not fit ${A.width} x ${A.height} at ${ladder.at(-1)!.name}`,
      )
    }
    return huntSceneAt(A, tablet, landscape, n, step ?? ladder.at(-1)!, 4)
  }
  const s4 = SLOT_STEPS[3]!
  if (!tablet) return huntSceneAt(A, false, landscape, n, s4)
  const step = SLOT_STEPS.slice(0, 3).find((st) =>
    [4, 5, 6, 7, 8].every((k) =>
      huntSceneFits(huntSceneAt(A, true, landscape, k, st), A),
    ),
  )
  if (step === undefined) {
    console.warn(
      `[layout] the word hunt does not fit ${A.width} x ${A.height} at S3`,
    )
  }
  return huntSceneAt(A, true, landscape, n, step ?? SLOT_STEPS[2]!)
}

// --------------------------------------------------------------------------
// Four-letter rounds: the length picker, the roll-in, the door
// (critters-four-letter.md § 5, § 6)
// --------------------------------------------------------------------------

/** A log on its own: its band (seats + log), its bar and its numeral disc. */
export interface LogParts {
  band: Rect
  bar: Rect
  disc: Rect
  /** The seats' rects (empty garden here), one socket under each. */
  seats: readonly Rect[]
}

/** The log of `seatCount` seats at its in-round size, its band at (x, y). */
function logAt(
  x: number,
  y: number,
  tablet: boolean,
  landscape: boolean,
  seatCount: 3 | 4,
): LogParts {
  const c = tablet ? 88 : landscape ? 48 : 56
  const g = tablet ? 16 : 8
  const seat = SEATED_SCALE * c
  const D = tablet ? 40 : 32
  const band = {
    x,
    y,
    width: logBandWidth(c, g, seatCount),
    height: seat + 16,
  }
  const bar = { x, y: y + seat - 8, width: band.width, height: 24 }
  return {
    band,
    bar,
    disc: { x, y: bar.y + bar.height / 2 - D / 2, width: D, height: D },
    seats: Array.from({ length: seatCount }, (_, i) => ({
      x: x + 16 + i * (seat + g),
      y,
      width: seat,
      height: seat,
    })),
  }
}

/** One socket under each seat, on the log's bar (T8). */
export function logSockets(seats: readonly Rect[], bar: Rect): Rect[] {
  return seats.map((s) => ({
    x: s.x + 0.18 * s.width,
    y: bar.y + 0.18 * bar.height,
    width: 0.64 * s.width,
    height: 0.64 * bar.height,
  }))
}

/** One of the picker's logs (§ 5.2): its button, the log, its ground shadow. */
export interface PickerLog {
  length: 3 | 4
  /** The button: the log's row, 8 wider than the log on each side. */
  hit: Rect
  /** `band` and `bar` are the bar; `seats` its socket cells. */
  log: LogParts
  /** The ground shadow under the bar: paint, never touchable. */
  shadow: Rect
  /**
   * § 5.4: the title's text box, from the disc's left edge to 2 pt above
   * the disc, one line of `PickerScene.titleLine`, as wide as its text.
   */
  title: Rect
}

export interface PickerScene {
  /** "3" on top, "4" below. */
  logs: readonly PickerLog[]
  /** The meadow under the logs, `A` (§ 5.3): a press there sends the wave. */
  meadow: Rect
  /** The socket cell σ. */
  seat: number
  /** The rows' pitch r. */
  pitch: number
  /** § 5.4: the titles' size f, 0.45 D (18 on phones, 25.2 on tablets). */
  titleSize: number
  /** Their line height, 1.21 f: Fredoka 700's ascent plus descent. */
  titleLine: number
}

/**
 * § 5.4: "Three letters" and "Four letters" in Fredoka 700, in em, as
 * measured there (Chromium's canvas, kerned, with the app's font file).
 * The advances alone sum to 6.068 and 5.534.
 */
const PICKER_TITLE_EM: Readonly<Record<3 | 4, number>> = { 3: 5.898, 4: 5.304 }

/**
 * § 5.2: the two logs lie in the meadow, "3" over "4", thicker than a
 * round's (bar 28, disc 40 on phones; 36, 56 on tablets). The socket cell
 * is the round's seat where the "4" log's button fits `A`, else the
 * largest that does; the disc covers 4 pt of the first socket. Each log's
 * row is its button, the pair of rows centred in `A`, and both discs sit
 * at the "4" log's centred x. Each title (§ 5.4) sits in its row, its box
 * from the disc's left edge, ending 2 pt above the disc.
 */
export function pickerScene(
  A: Rect,
  tablet: boolean,
  landscape: boolean,
): PickerScene {
  const c = tablet ? 88 : landscape ? 48 : 56
  const g = tablet ? 16 : 8
  const H = tablet ? 36 : 28
  const D = tablet ? 56 : 40
  const s = tablet ? 18 : 12
  const ledge = tablet ? 6 : 5
  // The "4" log's button is lead + 4σ + 3g + 16 + 2 × 8 wide, and the
  // lead is D − 4 − 0.18σ.
  const seat = Math.min(
    SEATED_SCALE * c,
    (A.width - 16 - (D - 4) - 16 - 3 * g) / (4 - 0.18),
  )
  const lead = D - 4 - 0.18 * seat
  const widthOf = (n: 3 | 4) => lead + n * seat + (n - 1) * g + 16
  const pitch = Math.min(2.2 * D, A.height / 2)
  const top = A.y + (A.height - 2 * pitch) / 2
  const x0 = A.x + (A.width - widthOf(4)) / 2
  const titleSize = 0.45 * D
  const titleLine = 1.21 * titleSize
  const logs = ([3, 4] as const).map((length, i) => {
    const y = top + i * pitch
    const mid = y + pitch / 2
    const bar = { x: x0, y: mid - H / 2, width: widthOf(length), height: H }
    const discY = mid - D / 2
    return {
      length,
      hit: { x: x0 - 8, y, width: bar.width + 16, height: pitch },
      log: {
        band: bar,
        bar,
        disc: { x: x0, y: discY, width: D, height: D },
        seats: Array.from({ length }, (_, k) => ({
          x: x0 + lead + k * (seat + g),
          y: bar.y,
          width: seat,
          height: H,
        })),
      },
      shadow: {
        x: x0 + 6,
        y: bar.y + H + ledge - s / 2,
        width: bar.width - 12,
        height: s,
      },
      title: {
        x: x0,
        y: discY - 2 - titleLine,
        width: PICKER_TITLE_EM[length] * titleSize,
        height: titleLine,
      },
    }
  })
  return { logs, meadow: A, seat, pitch, titleSize, titleLine }
}

export interface ArrivalScene {
  /** The slab at rest, and its log (bar, sockets, disc) on it. */
  slab: Rect
  log: LogParts
  /** The slab's left edge as it starts: the screen width + 8. */
  startX: number
}

/**
 * § 6.1: the arrival slab, the four-seat log's footprint (its length × the
 * disc's D) grown by `g` on every side, no wider than `A`, at rest centred
 * in `A`; it enters from beyond the screen's right edge.
 */
export function arrivalScene(
  A: Rect,
  tablet: boolean,
  landscape: boolean,
  screenWidth: number,
): ArrivalScene {
  const c = tablet ? 88 : landscape ? 48 : 56
  const g = tablet ? 16 : 8
  const D = tablet ? 40 : 32
  const logW = logBandWidth(c, g, 4)
  const width = Math.min(A.width, logW + 2 * g)
  const height = D + 2 * g
  const slab = {
    x: A.x + (A.width - width) / 2,
    y: A.y + (A.height - height) / 2,
    width,
    height,
  }
  const logX = A.x + (A.width - logW) / 2
  const barY = slab.y + (height - 24) / 2
  const seat = SEATED_SCALE * c
  return {
    slab,
    log: logAt(logX, barY - seat + 8, tablet, landscape, 4),
    startX: screenWidth + 8,
  }
}

/** The smallest door (§ 6.2): phone landscape's, clear of the ribbon. */
const DOOR_MIN = 44

/**
 * § 6.2: the door, beside New letters as New letters is beside Back
 * (Back's size + 16 on phones, + 24 on tablets), Back's size, or 44 where
 * that would reach the ribbon (phone landscape: the ribbon starts at y
 * 56.2 under the right pane's HUD row).
 */
export function doorRect(
  back: Rect,
  ribbon: { x: number; y: number; width: number },
  tablet: boolean,
): Rect {
  const step = back.width + (tablet ? 24 : 16)
  const full = { ...back, x: back.x + 2 * step }
  const reaches =
    full.x < ribbon.x + ribbon.width &&
    ribbon.x < right(full) &&
    bottom(full) > ribbon.y
  if (!reaches) return full
  return { ...full, width: DOOR_MIN, height: DOOR_MIN }
}
