/**
 * The games' sizes at the four floors (play-place § 1.7 `A`, § 2.2's fit
 * table, AC N13; § 3.2's table with 16 critters, AC N14), and the 22
 * critters at the tablet sizes the layout tests use (Thomas 2026-10-23,
 * build 20).
 */
import type { Viewport } from '../../layout/layout'
import { mathLayout } from '../../layout/mathLayout'
import {
  chipRect,
  critterScene,
  crittersFitBothWays,
  huntScene,
  huntSceneFits,
  overlaps,
  playArea,
  raftScene,
  TABLET_FIT_INSETS,
} from './playGeometry'

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

describe('Thomas 2026-10-23 (build 20): every letter on a tablet, 22 critters', () => {
  const T = { top: 24, bottom: 20 }
  // Measured 2026-10-23: per row, rows, the block (log band 126 + g 16 +
  // meadow) and A's height; it fits when the block is no taller than A.
  it.each([
    ['820×1180 (t24 b20)', vp(820, 1180, T), 7, 4, 542, 685.2, true],
    ['1180×820 (t24 b20)', vp(1180, 820, T), 8, 3, 438, 513, true],
    ['1180×820 (b20)', vp(1180, 820, { bottom: 20 }), 8, 3, 438, 537, true],
    ['744×1133 (t24 b20)', vp(744, 1133, T), 7, 4, 542, 650.4, true],
    ['1133×744 (t24 b20)', vp(1133, 744, T), 8, 3, 438, 437, false],
    ['1133×744 (b20)', vp(1133, 744, { bottom: 20 }), 8, 3, 438, 461, true],
    ['834×1194 (t24 b20)', vp(834, 1194, T), 7, 4, 542, 695.6, true],
    ['1194×834 (t24 b20)', vp(1194, 834, T), 9, 3, 438, 527, true],
    ['768×1024 (t24 b20)', vp(768, 1024, T), 7, 4, 542, 569.8, true],
    ['1024×768 (t24 b20)', vp(1024, 768, T), 7, 4, 542, 461, false],
    ['1024×768 (no insets)', vp(1024, 768), 7, 4, 542, 505, false],
  ] as const)('%s', (_, v, perRow, rows, block, aHeight, fits) => {
    const layout = mathLayout(v)
    const A = playArea(layout)
    const s = critterScene(A, layout.tablet, layout.landscape, 22)
    expect(layout.tablet).toBe(true)
    expect(s.c).toBe(88)
    expect(s.perRow).toBe(perRow)
    expect(s.rows).toBe(rows)
    expect(s.cells).toHaveLength(22)
    expect(s.logBand.height + s.g + s.meadow.height).toBeCloseTo(block, 5)
    expect(A.height).toBeCloseTo(aHeight, 1)
    const isInside = inside(A)
    const all = [s.logBand, s.meadow, s.picture, ...s.seats, ...s.cells]
    expect(all.every(isInside)).toBe(fits)
    // Never over the log band or a seat, never over each other.
    for (const cell of s.cells) {
      expect(overlaps(cell, s.logBand)).toBe(false)
      for (const seat of s.seats) expect(overlaps(cell, seat)).toBe(false)
    }
    s.cells.forEach((cell, i) =>
      s.cells
        .slice(i + 1)
        .forEach((o) => expect(overlaps(cell, o)).toBe(false)),
    )
  })

  it('the rule: 22 only on a tablet where 22 fit both ways, with at least t24 b20 (coordinator 2026-10-23)', () => {
    const fit = (v: Viewport, count = 22) => crittersFitBothWays(v, count)
    expect(TABLET_FIT_INSETS).toEqual(T)
    // iPad 10th gen / Air 11 and iPad Pro 11: 22.
    expect(fit(vp(820, 1180, T))).toBe(true)
    expect(fit(vp(1180, 820, { bottom: 20 }))).toBe(true)
    expect(fit(vp(820, 1180))).toBe(true)
    expect(fit(vp(834, 1194, T))).toBe(true)
    expect(fit(vp(1194, 834))).toBe(true)
    // iPad mini: landscape is 1 pt short with a status bar, whichever way
    // the visit opens, so 16.
    expect(fit(vp(744, 1133, T))).toBe(false)
    expect(fit(vp(744, 1133, { bottom: 20 }))).toBe(false)
    expect(fit(vp(1133, 744, { bottom: 20 }))).toBe(false)
    // The 1024×768 class: 16.
    expect(fit(vp(768, 1024, T))).toBe(false)
    expect(fit(vp(1024, 768))).toBe(false)
    // Every tablet fits the phone's 16 both ways.
    for (const v of [
      vp(820, 1180, T),
      vp(744, 1133, T),
      vp(834, 1194, T),
      vp(768, 1024, T),
    ]) {
      expect(fit(v, 16)).toBe(true)
    }
    // A phone never: it keeps the cap.
    expect(fit(vp(375, 667), 11)).toBe(false)
    expect(fit(vp(667, 375), 11)).toBe(false)
  })
})

/**
 * critters-word-hunt.md § 2.4: the word hunt's step and rects (N 8) on its
 * 15 viewports, as printed: (x, y, width, height).
 */
const HUNT_TABLE: readonly (readonly [
  string,
  Viewport,
  string,
  Record<'board' | 'logBand' | 'meadow' | 'chip', readonly number[]> & {
    picture: readonly [number, number, number]
  },
])[] = [
  [
    '375 × 667',
    vp(375, 667),
    'S4',
    {
      board: [26.5, 264, 322, 140],
      logBand: [58.5, 416, 258, 86],
      meadow: [95.5, 510, 184, 120],
      chip: [287.5, 570, 58, 60],
      picture: [87.5, 423, 200],
    },
  ],
  [
    '667 × 375',
    vp(667, 375),
    'S4',
    {
      board: [411, 148.1, 240, 213],
      logBand: [160, 160.6, 228, 76],
      meadow: [194, 244.6, 160, 104],
      chip: [584, 297.6, 58, 60],
      picture: [180, 160.6, 188],
    },
  ],
  [
    '390 × 844 (t47 b34)',
    vp(390, 844, { top: 47, bottom: 34 }),
    'S4',
    {
      board: [34, 369.5, 322, 140],
      logBand: [66, 521.5, 258, 86],
      meadow: [103, 615.5, 184, 120],
      chip: [295, 675.5, 58, 60],
      picture: [95, 528.5, 200],
    },
  ],
  [
    '844 × 390 (l/r47 b21)',
    vp(844, 390, { left: 47, right: 47, bottom: 21 }),
    'S4',
    {
      board: [510, 144.6, 240, 213],
      logBand: [258, 157.1, 228, 76],
      meadow: [292, 241.1, 160, 104],
      chip: [683, 294.1, 58, 60],
      picture: [278, 157.1, 188],
    },
  ],
  [
    '820 × 1180 (t24 b20)',
    vp(820, 1180, { top: 24, bottom: 20 }),
    'S1',
    {
      board: [98, 462.4, 624, 288],
      logBand: [213, 774.4, 394, 126],
      meadow: [262, 916.4, 296, 192],
      chip: [574, 992.4, 108, 116],
      picture: [260, 791.4, 300],
    },
  ],
  [
    '1180 × 820 (b20)',
    vp(1180, 820, { bottom: 20 }),
    'S1',
    {
      board: [681.6, 279.5, 464, 440],
      logBand: [263.6, 332.5, 394, 126],
      meadow: [312.6, 474.5, 296, 192],
      chip: [1019.6, 593.5, 108, 116],
      picture: [310.6, 349.5, 300],
    },
  ],
  [
    '1180 × 820 (t24 b20)',
    vp(1180, 820, { top: 24, bottom: 20 }),
    'S1',
    {
      board: [681.6, 291.5, 464, 440],
      logBand: [263.6, 344.5, 394, 126],
      meadow: [312.6, 486.5, 296, 192],
      chip: [1019.6, 605.5, 108, 116],
      picture: [310.6, 361.5, 300],
    },
  ],
  [
    '834 × 1194 (t24 b20)',
    vp(834, 1194, { top: 24, bottom: 20 }),
    'S1',
    {
      board: [105, 471.2, 624, 288],
      logBand: [220, 783.2, 394, 126],
      meadow: [269, 925.2, 296, 192],
      chip: [581, 1001.2, 108, 116],
      picture: [267, 800.2, 300],
    },
  ],
  [
    '1194 × 834 (t24 b20)',
    vp(1194, 834, { top: 24, bottom: 20 }),
    'S1',
    {
      board: [690.4, 298.5, 464, 440],
      logBand: [272.4, 351.5, 394, 126],
      meadow: [321.4, 493.5, 296, 192],
      chip: [1028.4, 612.5, 108, 116],
      picture: [319.4, 368.5, 300],
    },
  ],
  [
    '744 × 1133 (t24 b20)',
    vp(744, 1133, { top: 24, bottom: 20 }),
    'S2',
    {
      board: [108, 456.8, 528, 240],
      logBand: [175, 720.8, 394, 126],
      meadow: [224, 862.8, 296, 192],
      chip: [536, 950.8, 96, 104],
      picture: [222, 737.8, 300],
    },
  ],
  [
    '1133 × 744 (t24 b20)',
    vp(1133, 744, { top: 24, bottom: 20 }),
    'S2',
    {
      board: [684.2, 289.5, 392, 368],
      logBand: [266.2, 306.5, 394, 126],
      meadow: [315.2, 448.5, 296, 192],
      chip: [968.2, 549.5, 96, 104],
      picture: [313.2, 323.5, 300],
    },
  ],
  [
    '810 × 1080 (t24 b20)',
    vp(810, 1080, { top: 24, bottom: 20 }),
    'S2',
    {
      board: [141, 423.4, 528, 240],
      logBand: [208, 687.4, 394, 126],
      meadow: [257, 829.4, 296, 192],
      chip: [569, 917.4, 96, 104],
      picture: [255, 704.4, 300],
    },
  ],
  [
    '1080 × 810 (t24 b20)',
    vp(1080, 810, { top: 24, bottom: 20 }),
    'S2',
    {
      board: [666.3, 322.5, 392, 368],
      logBand: [248.3, 339.5, 394, 126],
      meadow: [297.3, 481.5, 296, 192],
      chip: [950.3, 582.5, 96, 104],
      picture: [295.3, 356.5, 300],
    },
  ],
  [
    '768 × 1024 (t24 b20)',
    vp(768, 1024, { top: 24, bottom: 20 }),
    'S3',
    {
      board: [156, 410.1, 456, 196],
      logBand: [187, 630.1, 394, 126],
      meadow: [236, 772.1, 296, 192],
      chip: [548, 880.1, 78, 84],
      picture: [234, 647.1, 300],
    },
  ],
  [
    '1024 × 768 (t24 b20)',
    vp(1024, 768, { top: 24, bottom: 20 }),
    'S3',
    {
      board: [659.8, 334.5, 338, 302],
      logBand: [241.8, 318.5, 394, 126],
      meadow: [290.8, 460.5, 296, 192],
      chip: [907.8, 549.5, 78, 84],
      picture: [288.8, 335.5, 300],
    },
  ],
]

describe('H7: the word hunt scene (critters-word-hunt.md § 2.4)', () => {
  const sceneOf = (v: Viewport, n: number) => {
    const layout = mathLayout(v)
    const A = playArea(layout)
    return { A, s: huntScene(A, layout.tablet, layout.landscape, n) }
  }
  const expectRect = (
    r: { x: number; y: number; width: number; height: number },
    [x, y, w, h]: readonly number[],
  ) => {
    expect(r.x).toBeCloseTo(x!, 1)
    expect(r.y).toBeCloseTo(y!, 1)
    expect(r.width).toBeCloseTo(w!, 1)
    expect(r.height).toBeCloseTo(h!, 1)
  }

  it.each(HUNT_TABLE)(
    '%s: § 2.4’s step and rects for N 8',
    (_, v, step, want) => {
      const { s } = sceneOf(v, 8)
      expect(s.step.name).toBe(step)
      expectRect(s.board, want.board)
      expectRect(s.logBand, want.logBand)
      expectRect(s.meadow, want.meadow)
      expectRect(chipRect(s, 3), want.chip)
      const [px, py, p] = want.picture
      expectRect(s.picture, [px, py, p, p])
    },
  )

  it.each(HUNT_TABLE)('%s: § 2.2’s fit rule holds for N 5-8', (_, v) => {
    for (const n of [5, 6, 7, 8]) {
      const { A, s } = sceneOf(v, n)
      expect(s.slots).toHaveLength(n)
      expect(huntSceneFits(s, A)).toBe(true)
    }
  })

  it('6 critters, 3 a row in 2 rows; the numeral disc on the log’s left end (32 phone, 40 tablet)', () => {
    const phone = sceneOf(vp(375, 667), 6).s
    expect(phone.cells).toHaveLength(6)
    expect(new Set(phone.cells.map((r) => r.y)).size).toBe(2)
    expect(phone.cells.slice(0, 3).map((r) => r.y)).toEqual([510, 510, 510])
    expectRect(phone.numeral, [58.5, phone.log.y - 4, 32, 32])
    const tablet = sceneOf(vp(820, 1180, { top: 24, bottom: 20 }), 6).s
    expectRect(tablet.numeral, [213, 868.4, 40, 40])
  })

  it('portrait rows: ceil(N/2) over floor(N/2); landscape: rows of 3 with the chip’s cell after the last slot', () => {
    const rowsOf = (s: ReturnType<typeof huntScene>) =>
      [...new Set(s.slots.map((x) => x.card.y))].map(
        (y) => s.slots.filter((x) => x.card.y === y).length,
      )
    expect(rowsOf(sceneOf(vp(375, 667), 5).s)).toEqual([3, 2])
    expect(rowsOf(sceneOf(vp(375, 667), 8).s)).toEqual([4, 4])
    expect(rowsOf(sceneOf(vp(667, 375), 5).s)).toEqual([3, 2])
    expect(rowsOf(sceneOf(vp(667, 375), 7).s)).toEqual([3, 3, 1])
    const l = sceneOf(vp(667, 375), 6).s
    expect(l.chipCell).not.toBeNull()
    expect(l.chipCell!.y).toBeGreaterThan(l.slots[5]!.card.y)
    expect(sceneOf(vp(375, 667), 6).s.chipCell).toBeNull()
  })
})
