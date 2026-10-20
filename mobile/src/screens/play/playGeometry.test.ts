/**
 * The games' sizes at the four floors (play-place § 1.7 `A`, § 2.2's fit
 * table, AC N13; § 3.2's table with 16 critters, AC N14).
 */
import type { Viewport } from '../../layout/layout'
import { mathLayout } from '../../layout/mathLayout'
import { critterScene, overlaps, playArea, raftScene } from './playGeometry'

const vp = (
  width: number,
  height: number,
  insets: Partial<Viewport['insets']> = {},
): Viewport => ({
  width,
  height,
  insets: { top: 0, bottom: 0, left: 0, right: 0, ...insets },
})

const FLOORS = [
  ['375×667', vp(375, 667)],
  ['667×375', vp(667, 375)],
  ['820×1180 (t24 b20)', vp(820, 1180, { top: 24, bottom: 20 })],
  ['1180×820 (b20)', vp(1180, 820, { bottom: 20 })],
] as const

const inside =
  (outer: { x: number; y: number; width: number; height: number }) =>
  (r: { x: number; y: number; width: number; height: number }) =>
    r.x >= outer.x - 0.01 &&
    r.y >= outer.y - 0.01 &&
    r.x + r.width <= outer.x + outer.width + 0.01 &&
    r.y + r.height <= outer.y + outer.height + 0.01

describe('§ 1.7: A at the floors', () => {
  it.each([
    [FLOORS[0][1], { x: 16, y: 259, width: 343, height: 376 }],
    [FLOORS[1][1], { x: 160, y: 146.4, width: 491, height: 216.4 }],
    [FLOORS[2][1], { x: 16, y: 442.8, width: 788, height: 685.2 }],
    [FLOORS[3][1], { x: 245.2, y: 231, width: 918.8, height: 537 }],
  ])('%#', (v, want) => {
    const A = playArea(mathLayout(v))
    expect(A.x).toBeCloseTo(want.x, 0)
    expect(A.y).toBeCloseTo(want.y, 0)
    expect(A.width).toBeCloseTo(want.width, 0)
    expect(A.height).toBeCloseTo(want.height, 0)
  })
})

describe('N13: the raft scene', () => {
  it.each([
    [
      FLOORS[0],
      { band: 135.4, water: 150.4, island: 90.2, a: 64, deck: [170.4, 119.6] },
    ],
    [
      FLOORS[1],
      { band: 147.3, water: 235.7, island: 108, a: 64, deck: [170.4, 119.6] },
    ],
    [
      FLOORS[2],
      { band: 246.7, water: 274, island: 164.4, a: 104, deck: [254.4, 175.6] },
    ],
    [
      FLOORS[3],
      { band: 275.6, water: 441, island: 202.1, a: 104, deck: [254.4, 175.6] },
    ],
  ])('%s', ([, v], want) => {
    const layout = mathLayout(v)
    const A = playArea(layout)
    const s = raftScene(A, layout.tablet, layout.landscape)
    const along = (r: { width: number; height: number }) =>
      s.axis === 'up' ? r.height : r.width
    expect(along(s.shore)).toBeCloseTo(want.band, 0)
    expect(along(s.water)).toBeCloseTo(want.water, 0)
    expect(along(s.island)).toBeCloseTo(want.island, 0)
    expect(s.a).toBe(want.a)
    expect(s.dock.width).toBeCloseTo(want.deck[0]!, 1)
    expect(s.dock.height).toBeCloseTo(want.deck[1]!, 1)
    expect(s.seats).toHaveLength(6)
    for (const seat of s.seats) {
      expect(seat.width).toBeCloseTo(0.7 * s.a, 5)
      expect(seat.width).toBeGreaterThanOrEqual(44)
    }
    // Six a × a cells inside the shore band, none overlapping.
    expect(s.spots).toHaveLength(6)
    s.spots.forEach((spot, i) => {
      expect(spot.width).toBe(s.a)
      expect(inside(s.shore)(spot)).toBe(true)
      s.spots.slice(i + 1).forEach((o) => expect(overlaps(spot, o)).toBe(false))
    })
    // The deck fits the water at the dock and at the island landing, and
    // touches neither the shore nor the island mound.
    for (const deck of [s.dock, s.landing]) {
      expect(inside(s.water)(deck)).toBe(true)
      expect(overlaps(deck, s.shore)).toBe(false)
      expect(overlaps(deck, s.mound)).toBe(false)
    }
    const gapToShore =
      s.axis === 'up'
        ? s.shore.y - (s.dock.y + s.dock.height)
        : s.dock.x - (s.shore.x + s.shore.width)
    expect(gapToShore).toBeCloseTo(4, 5)
  })
})

describe('N14: the critter scene with 16 critters', () => {
  it.each([
    [
      FLOORS[0],
      {
        c: 56,
        g: 8,
        perRow: 5,
        rows: 4,
        meadow: 248,
        band: 86,
        logW: 258,
        p: 200,
      },
    ],
    [
      FLOORS[1],
      {
        c: 48,
        g: 8,
        perRow: 8,
        rows: 2,
        meadow: 104,
        band: 76,
        logW: 228,
        p: 104,
      },
    ],
    [
      FLOORS[2],
      {
        c: 88,
        g: 16,
        perRow: 7,
        rows: 3,
        meadow: 296,
        band: 126,
        logW: 394,
        p: 296,
      },
    ],
    [
      FLOORS[3],
      {
        c: 88,
        g: 16,
        perRow: 8,
        rows: 2,
        meadow: 192,
        band: 126,
        logW: 394,
        p: 192,
      },
    ],
  ])('%s', ([, v], want) => {
    const layout = mathLayout(v)
    const A = playArea(layout)
    const s = critterScene(A, layout.tablet, layout.landscape, 16)
    expect(s.c).toBe(want.c)
    expect(s.g).toBe(want.g)
    expect(s.perRow).toBe(want.perRow)
    expect(s.rows).toBe(want.rows)
    expect(s.meadow.height).toBeCloseTo(want.meadow, 5)
    expect(s.logBand.height).toBeCloseTo(want.band, 5)
    expect(s.logBand.width).toBeCloseTo(want.logW, 5)
    expect(s.p).toBeCloseTo(want.p, 5)
    expect(s.cells).toHaveLength(16)
    const isInside = inside(A)
    for (const r of [s.logBand, s.meadow, s.picture, ...s.seats, ...s.cells]) {
      expect(isInside(r)).toBe(true)
    }
    expect(s.c).toBeGreaterThanOrEqual(48)
    for (const seat of s.seats) expect(seat.width).toBeGreaterThanOrEqual(60)
    s.cells.forEach((cell, i) =>
      s.cells
        .slice(i + 1)
        .forEach((o) => expect(overlaps(cell, o)).toBe(false)),
    )
  })
})
