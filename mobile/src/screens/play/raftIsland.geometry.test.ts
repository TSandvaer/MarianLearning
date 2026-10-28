/**
 * The raft island's sizes at the four floors (raft-island-goal §§ 1.2,
 * 4.1, 4.3, 4.4, 5.2; AC I11): the nine homes and the tips on the oval
 * face, the 20 deck, the target board, and the picker's ponds.
 */
import type { Viewport } from '../../layout/layout'
import { mathLayout } from '../../layout/mathLayout'
import {
  ellipseInside,
  homeNest,
  islandHomes,
  islandTips,
  moundFace,
  overlaps,
  playArea,
  raftPicker,
  raftScene,
  targetBoard,
} from './playGeometry'

type R = { x: number; y: number; width: number; height: number }

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

const inside = (outer: R) => (r: R) =>
  r.x >= outer.x - 0.01 &&
  r.y >= outer.y - 0.01 &&
  r.x + r.width <= outer.x + outer.width + 0.01 &&
  r.y + r.height <= outer.y + outer.height + 0.01

const near = (r: R, want: readonly number[]) => {
  expect(r.x).toBeCloseTo(want[0]!, 0)
  expect(r.y).toBeCloseTo(want[1]!, 0)
  if (want.length > 2) {
    expect(r.width).toBeCloseTo(want[2]!, 0)
    expect(r.height).toBeCloseTo(want[3]!, 0)
  }
}

describe('I11: the island, the 20 deck and the board (§§ 1.2, 4)', () => {
  it.each([
    [
      FLOORS[0],
      {
        h: 26.9,
        home1: [112.3, 271.7],
        home9: [220.4, 302.6],
        tips: [
          [100.7, 300.6],
          [274.3, 300.6],
        ],
        dock20: [83.9, 376],
        land20: [83.9, 349.2],
      },
    ],
    [
      FLOORS[1],
      {
        h: 26.9,
        home1: [552.7, 206.8],
        home9: [614.4, 268.5],
        tips: [
          [597, 181.4],
          [597, 320.8],
        ],
        dock20: [311.3, 194.8],
        land20: [335.8, 194.8],
      },
    ],
    [
      FLOORS[2],
      {
        h: 57.2,
        home1: [255, 459.8],
        home9: [476.2, 523],
        tips: [
          [208.4, 520],
          [611.6, 520],
        ],
        dock20: [243.4, 701.7],
        land20: [243.4, 607.2],
      },
    ],
    [
      FLOORS[3],
      {
        h: 57.2,
        home1: [971.1, 402.7],
        home9: [1097.5, 529.1],
        tips: [
          [1062.9, 315.8],
          [1062.9, 673.2],
        ],
        dock20: [524.8, 411.7],
        land20: [628.7, 411.7],
      },
    ],
  ])('%s', ([, v], want) => {
    const layout = mathLayout(v)
    const A = playArea(layout)
    const s = raftScene(A, layout.tablet, layout.landscape)
    const face = moundFace(s)
    const homes = islandHomes(s)
    expect(homes).toHaveLength(9)
    near(homes[0]!, [...want.home1, want.h, want.h])
    near(homes[8]!, [...want.home9, want.h, want.h])
    // Reading order: left to right, then top to bottom.
    for (let i = 1; i < 9; i++) {
      const [p, q] = [homes[i - 1]!, homes[i]!]
      expect(q.y > p.y + 0.01 || (q.y === p.y && q.x > p.x)).toBe(true)
    }
    const tips = islandTips(s)
    tips.forEach((tip, i) => {
      expect(tip.x + tip.width / 2).toBeCloseTo(want.tips[i]![0]!, 0)
      expect(tip.y + tip.height / 2).toBeCloseTo(want.tips[i]![1]!, 0)
      expect(tip.width).toBeCloseTo(0.32 * s.a, 5)
      expect(ellipseInside(tip, face)).toBe(true)
    })
    // Every nest inside the face inset 2; no home overlaps a home or a tip.
    homes.forEach((home, i) => {
      expect(ellipseInside(homeNest(home), face, 2)).toBe(true)
      homes.slice(i + 1).forEach((o) => expect(overlaps(home, o)).toBe(false))
      tips.forEach((tip) => expect(overlaps(home, tip)).toBe(false))
    })

    // The 20 deck (§ 4.1, § 4.4): 8 seats of 0.7 a; it docks and lands
    // where the table has it, in the water, clear of the shore and mound.
    const t = raftScene(A, layout.tablet, layout.landscape, 20)
    expect(t.seats).toHaveLength(8)
    expect(t.dock.width).toBeCloseTo(layout.tablet ? 333.2 : 207.2, 1)
    expect(t.dock.height).toBeCloseTo(s.dock.height, 5)
    const xs = layout.tablet
      ? [12, 90.8, 169.6, 248.4]
      : [8, 56.8, 105.6, 154.4]
    t.seats.slice(0, 4).forEach((seat, i) => {
      expect(seat.x).toBeCloseTo(xs[i]!, 1)
      expect(seat.width).toBeCloseTo(0.7 * t.a, 5)
    })
    near(t.dock, want.dock20)
    near(t.landing, want.land20)
    for (const deck of [t.dock, t.landing]) {
      expect(inside(t.water)(deck)).toBe(true)
      expect(overlaps(deck, t.shore)).toBe(false)
      expect(overlaps(deck, t.mound)).toBe(false)
    }
    t.seats.forEach((seat, i) =>
      t.seats
        .slice(i + 1)
        .forEach((o) => expect(overlaps(seat, o)).toBe(false)),
    )

    // The board (§ 4.3): 0.56 a × 0.34 a, centred, its top at the deck's
    // height − 12 − 0.1 a; it covers the front row's seats only.
    for (const sc of [s, t]) {
      const board = targetBoard(sc)
      near(board, [
        (sc.dock.width - 0.56 * sc.a) / 2,
        layout.tablet ? 153.2 : 101.2,
        0.56 * sc.a,
        0.34 * sc.a,
      ])
      sc.seats
        .slice(0, sc.seats.length / 2)
        .forEach((seat) => expect(overlaps(seat, board)).toBe(false))
    }
  })
})

describe('I11: the raft picker (§ 5.2)', () => {
  it.each([
    [
      FLOORS[0],
      {
        ponds: [
          [16, 259, 343, 180],
          [16, 455, 343, 180],
        ],
        decks: [
          [24, 303.7, 170.4, 119.6],
          [24, 499.7, 207.2, 119.6],
        ],
        island: [104.7, 111.7],
        hp: 21.8,
      },
    ],
    [
      FLOORS[1],
      {
        ponds: [
          [160, 146.4, 237.5, 216.4],
          [413.5, 146.4, 237.5, 216.4],
        ],
        decks: [
          [168, 235.2, 170.4, 119.6],
          [421.5, 235.2, 207.2, 119.6],
        ],
        island: [176.5, 74.8],
        hp: 21.8,
      },
    ],
    [
      FLOORS[2],
      {
        ponds: [
          [16, 442.8, 788, 334.6],
          [16, 793.4, 788, 334.6],
        ],
        decks: [
          [32, 544, 254.4, 175.6],
          [32, 894.6, 333.2, 175.6],
        ],
        island: [262.3, 272.3],
        hp: 57.2,
      },
    ],
    [
      FLOORS[3],
      {
        ponds: [
          [245.2, 231, 451.4, 537],
          [712.6, 231, 451.4, 537],
        ],
        decks: [
          [261.2, 576.4, 254.4, 175.6],
          [728.6, 576.4, 333.2, 175.6],
        ],
        // § 5.2's table has 206; its own rule (the grid ÷ 0.7, grown until
        // the nests fit, plus the drop) gives 182. The PR notes it.
        island: [352.4, 182],
        hp: 57.2,
      },
    ],
  ])('%s', ([, v], want) => {
    const layout = mathLayout(v)
    const A = playArea(layout)
    const ponds = raftPicker(A, layout.tablet, layout.landscape, [10, 20])
    expect(ponds.map((p) => p.target)).toEqual([10, 20])
    expect(overlaps(ponds[0]!.pond, ponds[1]!.pond)).toBe(false)
    ponds.forEach((p, i) => {
      near(p.pond, want.ponds[i]!)
      near(p.deck, want.decks[i]!)
      expect(p.island.width).toBeCloseTo(want.island[0]!, 0)
      expect(p.island.height).toBeCloseTo(want.island[1]!, 0)
      expect(inside(p.pond)(p.island)).toBe(true)
      expect(inside(p.pond)(p.deck)).toBe(true)
      // The flag, above the deck, stays in the pond and off the island.
      const flag = {
        ...p.raft.flag,
        x: p.deck.x + 7,
        y: p.deck.y + p.raft.flag.y,
      }
      expect(inside(p.pond)(flag)).toBe(true)
      expect(overlaps(flag, p.island)).toBe(false)
      expect(overlaps(p.deck, p.island)).toBe(false)
      expect(p.homes).toHaveLength(9)
      p.homes.forEach((home) => {
        expect(home.width).toBeCloseTo(want.hp, 1)
        expect(ellipseInside(homeNest(home), p.face, 2)).toBe(true)
      })
    })
  })

  it('one raft: one pond', () => {
    const layout = mathLayout(FLOORS[0][1])
    expect(raftPicker(playArea(layout), false, false, [10])).toHaveLength(1)
  })
})
