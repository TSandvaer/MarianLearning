/**
 * The games' sizes at the four floors (play-place § 1.7 `A`, § 2.2's fit
 * table, AC N13; § 3.2's table with 16 critters, AC N14), and the 22
 * critters at the tablet sizes the layout tests use (Thomas 2026-10-23,
 * build 20).
 */
import { FREDOKA_700, fontMeasure } from '../../../test/fontAdvances'
import type { Viewport } from '../../layout/layout'
import { mathLayout } from '../../layout/mathLayout'
import {
  arrivalScene,
  backRect,
  chipRect,
  critterScene,
  crittersFitBothWays,
  doorRect,
  huntScene,
  huntSceneFits,
  logSockets,
  overlaps,
  pickerScene,
  playArea,
  raftScene,
  TABLET_FIT_INSETS,
} from './playGeometry'
import { PLAY_LABELS } from './playLines'

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

/**
 * critters-word-hunt.md § 16.2: the three-letter board at N 4 on its 16
 * viewports, as printed: the step, the board (x, y, w, h), the four slots'
 * (x, y) and the chip zone for 3 extras (x, y, w, h).
 */
const N4_TABLE: readonly (readonly [
  string,
  Viewport,
  string,
  readonly number[],
  readonly (readonly [number, number])[],
  readonly number[],
])[] = [
  [
    '375 × 667',
    vp(375, 667),
    'S4',
    [108.5, 264, 158, 140],
    [
      [108.5, 264],
      [190.5, 264],
      [108.5, 337],
      [190.5, 337],
    ],
    [287.5, 570, 58, 60],
  ],
  [
    '667 × 375',
    vp(667, 375),
    'S4',
    [411, 184.6, 240, 140],
    [
      [411, 184.6],
      [493, 184.6],
      [575, 184.6],
      [452, 257.6],
    ],
    [543, 261.1, 58, 60],
  ],
  [
    '390 × 844 (t47 b34)',
    vp(390, 844, { top: 47, bottom: 34 }),
    'S4',
    [116, 369.5, 158, 140],
    [
      [116, 369.5],
      [198, 369.5],
      [116, 442.5],
      [198, 442.5],
    ],
    [295, 675.5, 58, 60],
  ],
  [
    '844 × 390 (l/r47 b21)',
    vp(844, 390, { left: 47, right: 47, bottom: 21 }),
    'S4',
    [510, 181.1, 240, 140],
    [
      [510, 181.1],
      [592, 181.1],
      [674, 181.1],
      [551, 254.1],
    ],
    [642, 257.6, 58, 60],
  ],
  [
    '820 × 1180 (t24 b20)',
    vp(820, 1180, { top: 24, bottom: 20 }),
    'S1',
    [258, 462.4, 304, 288],
    [
      [258, 462.4],
      [418, 462.4],
      [258, 614.4],
      [418, 614.4],
    ],
    [574, 992.4, 108, 116],
  ],
  [
    '1180 × 820 (b20)',
    vp(1180, 820, { bottom: 20 }),
    'S1',
    [681.6, 355.5, 464, 288],
    [
      [681.6, 355.5],
      [841.6, 355.5],
      [1001.6, 355.5],
      [761.6, 507.5],
    ],
    [939.6, 517.5, 108, 116],
  ],
  [
    '1180 × 820 (t24 b20)',
    vp(1180, 820, { top: 24, bottom: 20 }),
    'S1',
    [681.6, 367.5, 464, 288],
    [
      [681.6, 367.5],
      [841.6, 367.5],
      [1001.6, 367.5],
      [761.6, 519.5],
    ],
    [939.6, 529.5, 108, 116],
  ],
  [
    '834 × 1194 (t24 b20)',
    vp(834, 1194, { top: 24, bottom: 20 }),
    'S1',
    [265, 471.2, 304, 288],
    [
      [265, 471.2],
      [425, 471.2],
      [265, 623.2],
      [425, 623.2],
    ],
    [581, 1001.2, 108, 116],
  ],
  [
    '1194 × 834 (t24 b20)',
    vp(1194, 834, { top: 24, bottom: 20 }),
    'S1',
    [690.4, 374.5, 464, 288],
    [
      [690.4, 374.5],
      [850.4, 374.5],
      [1010.4, 374.5],
      [770.4, 526.5],
    ],
    [948.4, 536.5, 108, 116],
  ],
  [
    '744 × 1133 (t24 b20)',
    vp(744, 1133, { top: 24, bottom: 20 }),
    'S2',
    [244, 456.8, 256, 240],
    [
      [244, 456.8],
      [380, 456.8],
      [244, 584.8],
      [380, 584.8],
    ],
    [536, 950.8, 96, 104],
  ],
  [
    '1133 × 744 (t24 b20)',
    vp(1133, 744, { top: 24, bottom: 20 }),
    'S2',
    [684.2, 353.5, 392, 240],
    [
      [684.2, 353.5],
      [820.2, 353.5],
      [956.2, 353.5],
      [752.2, 481.5],
    ],
    [900.2, 485.5, 96, 104],
  ],
  [
    '810 × 1080 (t24 b20)',
    vp(810, 1080, { top: 24, bottom: 20 }),
    'S2',
    [277, 423.4, 256, 240],
    [
      [277, 423.4],
      [413, 423.4],
      [277, 551.4],
      [413, 551.4],
    ],
    [569, 917.4, 96, 104],
  ],
  [
    '1080 × 810 (t24 b20)',
    vp(1080, 810, { top: 24, bottom: 20 }),
    'S2',
    [666.3, 386.5, 392, 240],
    [
      [666.3, 386.5],
      [802.3, 386.5],
      [938.3, 386.5],
      [734.3, 514.5],
    ],
    [882.3, 518.5, 96, 104],
  ],
  [
    '1080 × 810 (none)',
    vp(1080, 810),
    'S2',
    [666.3, 384.5, 392, 240],
    [
      [666.3, 384.5],
      [802.3, 384.5],
      [938.3, 384.5],
      [734.3, 512.5],
    ],
    [882.3, 516.5, 96, 104],
  ],
  [
    '768 × 1024 (t24 b20)',
    vp(768, 1024, { top: 24, bottom: 20 }),
    'S3',
    [274, 410.1, 220, 196],
    [
      [274, 410.1],
      [392, 410.1],
      [274, 516.1],
      [392, 516.1],
    ],
    [548, 880.1, 78, 84],
  ],
  [
    '1024 × 768 (t24 b20)',
    vp(1024, 768, { top: 24, bottom: 20 }),
    'S3',
    [659.8, 387.5, 338, 196],
    [
      [659.8, 387.5],
      [777.8, 387.5],
      [895.8, 387.5],
      [718.8, 493.5],
    ],
    [848.8, 496.5, 78, 84],
  ],
]

describe('B8: the three-letter board at N 4 (critters-word-hunt.md § 16.2)', () => {
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

  it.each(N4_TABLE)(
    '%s: § 16.2’s step, board, slots and chip zone',
    (_, v, step, board, slots, chip) => {
      const { s } = sceneOf(v, 4)
      expect(s.step.name).toBe(step)
      expectRect(s.board, board)
      expect(s.slots).toHaveLength(4)
      s.slots.forEach(({ card }, i) => {
        expect(card.x).toBeCloseTo(slots[i]![0], 1)
        expect(card.y).toBeCloseTo(slots[i]![1], 1)
      })
      expectRect(chipRect(s, 3), chip)
    },
  )

  it.each(N4_TABLE)(
    '%s: the fit rule holds for every N from 4 to 8',
    (_, v) => {
      for (const n of [4, 5, 6, 7, 8]) {
        const { A, s } = sceneOf(v, n)
        expect(s.slots).toHaveLength(n)
        expect(huntSceneFits(s, A)).toBe(true)
      }
    },
  )

  it('portrait 2 + 2; landscape 3 + (1 + the chip’s cell), the second row centred', () => {
    const rowsOf = (s: ReturnType<typeof huntScene>) =>
      [...new Set(s.slots.map((x) => x.card.y))].map(
        (y) => s.slots.filter((x) => x.card.y === y).length,
      )
    expect(rowsOf(sceneOf(vp(375, 667), 4).s)).toEqual([2, 2])
    const l = sceneOf(vp(667, 375), 4).s
    expect(rowsOf(l)).toEqual([3, 1])
    expectRect(l.chipCell!, [534, 257.6, 76, 67])
  })

  it('the tablet ladder checks N 4-8 and still picks § 2.4’s steps (N 8 unchanged)', () => {
    for (const [, v, step] of N4_TABLE) {
      expect(sceneOf(v, 8).s.step.name).toBe(step)
    }
  })
})

/** critters-four-letter.md § 2.4: (x, y, w, h) rects for N 6. */
const FOUR_TABLE: readonly (readonly [
  string,
  Viewport,
  string,
  Record<'slot' | 'board' | 'logBand' | 'meadow', readonly number[]> & {
    picture: readonly [number, number, number]
  },
])[] = [
  [
    '375 × 667',
    vp(375, 667),
    'S4',
    {
      slot: [100, 67],
      board: [31.5, 264, 312, 140],
      logBand: [19.5, 416, 336, 86],
      meadow: [63.5, 510, 248, 120],
      picture: [87.5, 423, 200],
    },
  ],
  [
    '667 × 375',
    vp(667, 375),
    'S5',
    {
      slot: [92, 65],
      board: [461, 151.1, 190, 207],
      logBand: [160, 160.6, 296, 76],
      meadow: [200, 244.6, 216, 104],
      picture: [214, 160.6, 188],
    },
  ],
  [
    '390 × 844 (t47 b34)',
    vp(390, 844, { top: 47, bottom: 34 }),
    'S4',
    {
      slot: [100, 67],
      board: [39, 369.5, 312, 140],
      logBand: [27, 521.5, 336, 86],
      meadow: [71, 615.5, 248, 120],
      picture: [95, 528.5, 200],
    },
  ],
  [
    '844 × 390 (l/r47 b21)',
    vp(844, 390, { left: 47, right: 47, bottom: 21 }),
    'S4',
    {
      slot: [100, 67],
      board: [561, 144.6, 206, 213],
      logBand: [241, 157.1, 296, 76],
      meadow: [281, 241.1, 216, 104],
      picture: [295, 157.1, 188],
    },
  ],
  [
    '820 × 1180 (t24 b20)',
    vp(820, 1180, { top: 24, bottom: 20 }),
    'S1',
    {
      slot: [188, 136],
      board: [112, 462.4, 596, 288],
      logBand: [150, 774.4, 520, 126],
      meadow: [210, 916.4, 400, 192],
      picture: [260, 791.4, 300],
    },
  ],
  [
    '1180 × 820 (b20)',
    vp(1180, 820, { bottom: 20 }),
    'S1',
    {
      slot: [188, 136],
      board: [772, 279.5, 392, 440],
      logBand: [245.2, 332.5, 520, 126],
      meadow: [305.2, 474.5, 400, 192],
      picture: [355.2, 349.5, 300],
    },
  ],
  [
    '1180 × 820 (t24 b20)',
    vp(1180, 820, { top: 24, bottom: 20 }),
    'S1',
    {
      slot: [188, 136],
      board: [772, 291.5, 392, 440],
      logBand: [245.2, 344.5, 520, 126],
      meadow: [305.2, 486.5, 400, 192],
      picture: [355.2, 361.5, 300],
    },
  ],
  [
    '834 × 1194 (t24 b20)',
    vp(834, 1194, { top: 24, bottom: 20 }),
    'S1',
    {
      slot: [188, 136],
      board: [119, 471.2, 596, 288],
      logBand: [157, 783.2, 520, 126],
      meadow: [217, 925.2, 400, 192],
      picture: [267, 800.2, 300],
    },
  ],
  [
    '1194 × 834 (t24 b20)',
    vp(1194, 834, { top: 24, bottom: 20 }),
    'S1',
    {
      slot: [188, 136],
      board: [786, 298.5, 392, 440],
      logBand: [248.8, 351.5, 520, 126],
      meadow: [308.8, 493.5, 400, 192],
      picture: [358.8, 368.5, 300],
    },
  ],
  [
    '744 × 1133 (t24 b20)',
    vp(744, 1133, { top: 24, bottom: 20 }),
    'S2',
    {
      slot: [156, 112],
      board: [122, 456.8, 500, 240],
      logBand: [112, 720.8, 520, 126],
      meadow: [172, 862.8, 400, 192],
      picture: [222, 737.8, 300],
    },
  ],
  [
    '1133 × 744 (t24 b20)',
    vp(1133, 744, { top: 24, bottom: 20 }),
    'S2',
    {
      slot: [156, 112],
      board: [779.2, 289.5, 328, 368],
      logBand: [235.2, 306.5, 520, 126],
      meadow: [295.2, 448.5, 400, 192],
      picture: [345.2, 323.5, 300],
    },
  ],
  [
    '810 × 1080 (t24 b20)',
    vp(810, 1080, { top: 24, bottom: 20 }),
    'S2',
    {
      slot: [156, 112],
      board: [155, 423.4, 500, 240],
      logBand: [145, 687.4, 520, 126],
      meadow: [205, 829.4, 400, 192],
      picture: [255, 704.4, 300],
    },
  ],
  [
    '1080 × 810 (t24 b20)',
    vp(1080, 810, { top: 24, bottom: 20 }),
    'S3',
    {
      slot: [133, 90],
      board: [782, 355.5, 282, 302],
      logBand: [242.6, 339.5, 520, 126],
      meadow: [302.6, 481.5, 400, 192],
      picture: [352.6, 356.5, 300],
    },
  ],
  [
    '768 × 1024 (t24 b20)',
    vp(768, 1024, { top: 24, bottom: 20 }),
    'S3',
    {
      slot: [133, 90],
      board: [168.5, 410.1, 431, 196],
      logBand: [124, 630.1, 520, 126],
      meadow: [184, 772.1, 400, 192],
      picture: [234, 647.1, 300],
    },
  ],
  [
    '1024 × 768 (t24 b20)',
    vp(1024, 768, { top: 24, bottom: 20 }),
    'S4',
    {
      slot: [100, 67],
      board: [783.8, 369, 216, 233],
      logBand: [239.8, 318.5, 520, 126],
      meadow: [299.8, 460.5, 400, 192],
      picture: [349.8, 335.5, 300],
    },
  ],
]

describe('F10: the four-letter scene (critters-four-letter.md § 2.4)', () => {
  const sceneOf = (v: Viewport, n: number) => {
    const layout = mathLayout(v)
    const A = playArea(layout)
    return { A, s: huntScene(A, layout.tablet, layout.landscape, n, 4) }
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

  it.each(FOUR_TABLE)(
    '%s: § 2.4’s step, slot and rects for N 6',
    (_, v, step, want) => {
      const { s } = sceneOf(v, 6)
      expect(s.step.name).toBe(step)
      expect(s.slots[0]!.card.width).toBeCloseTo(want.slot[0]!, 1)
      expect(s.slots[0]!.card.height).toBeCloseTo(want.slot[1]!, 1)
      expectRect(s.board, want.board)
      expectRect(s.logBand, want.logBand)
      expectRect(s.meadow, want.meadow)
      const [px, py, p] = want.picture
      expectRect(s.picture, [px, py, p, p])
    },
  )

  it.each(FOUR_TABLE)('%s: the fit rule holds for N 4, 5 and 6', (_, v) => {
    for (const n of [4, 5, 6]) {
      const { A, s } = sceneOf(v, n)
      expect(s.slots).toHaveLength(n)
      expect(s.slots.every((x) => x.boxes.length === 4)).toBe(true)
      expect(s.chipCell).toBeNull()
      expect(huntSceneFits(s, A)).toBe(true)
    }
  })

  it('4 seats; 7 critters, 4 + 3 in round order, each row centred (§ 2.5)', () => {
    const { s } = sceneOf(vp(375, 667), 6)
    expect(s.seats.map((r) => r.x)).toEqual([35.5, 113.5, 191.5, 269.5])
    expect(s.seats.every((r) => r.y === 416 && r.width === 70)).toBe(true)
    expect(s.cells.map((r) => [r.x, r.y])).toEqual([
      [63.5, 510],
      [127.5, 510],
      [191.5, 510],
      [255.5, 510],
      [95.5, 574],
      [159.5, 574],
      [223.5, 574],
    ])
    expectRect(s.log, [19.5, 478, 336, 24])
    expectRect(s.numeral, [19.5, 474, 32, 32])
  })

  it('rows: portrait ceil(N/2) over floor(N/2); landscape 2 a row, the last centred; no chip cell', () => {
    const rowsOf = (s: ReturnType<typeof huntScene>) =>
      [...new Set(s.slots.map((x) => x.card.y))].map(
        (y) => s.slots.filter((x) => x.card.y === y).length,
      )
    expect(rowsOf(sceneOf(vp(375, 667), 4).s)).toEqual([2, 2])
    expect(rowsOf(sceneOf(vp(375, 667), 5).s)).toEqual([3, 2])
    expect(rowsOf(sceneOf(vp(667, 375), 5).s)).toEqual([2, 2, 1])
    expect(rowsOf(sceneOf(vp(667, 375), 6).s)).toEqual([2, 2, 2])
    const l5 = sceneOf(vp(667, 375), 5).s
    expect(l5.slots[4]!.card.x).toBeCloseTo(510, 1)
  })

  it('the three-letter scene is unchanged by the length (no S5, 3 seats)', () => {
    const layout = mathLayout(vp(667, 375))
    const s = huntScene(playArea(layout), false, true, 6)
    expect(s.step.name).toBe('S4')
    expect(s.seats).toHaveLength(3)
    expect(s.slots[0]!.boxes).toHaveLength(3)
  })
})

describe('F16: the length picker (critters-four-letter.md § 5.2)', () => {
  // § 5.2 prints to 0.1 pt (24.17 as 24.2).
  const near = (
    r: { x: number; y: number; width: number; height: number },
    want: readonly number[],
  ) =>
    [r.x, r.y, r.width, r.height].forEach((v, k) =>
      expect(Math.abs(v - want[k]!)).toBeLessThanOrEqual(0.0501),
    )
  const sceneOf = (v: Viewport) => {
    const layout = mathLayout(v)
    const A = playArea(layout)
    return { A, p: pickerScene(A, layout.tablet, layout.landscape) }
  }
  type Log = readonly [
    hit: readonly number[],
    bar: readonly number[],
    disc: readonly [number, number, number],
  ]
  const PICKER: readonly (readonly [
    string,
    Viewport,
    number,
    number,
    Log,
    Log,
  ])[] = [
    [
      'P',
      vp(375, 667),
      65.7,
      88,
      [
        [16, 359, 269.3, 88],
        [24, 389, 253.3, 28],
        [24, 383, 40],
      ],
      [
        [16, 447, 343, 88],
        [24, 477, 327, 28],
        [24, 471, 40],
      ],
    ],
    [
      'L',
      vp(667, 375),
      60,
      88,
      [
        [244.9, 166.6, 253.2, 88],
        [252.9, 196.6, 237.2, 28],
        [252.9, 190.6, 40],
      ],
      [
        [244.9, 254.6, 321.2, 88],
        [252.9, 284.6, 305.2, 28],
        [252.9, 278.6, 40],
      ],
    ],
    [
      'W',
      vp(820, 1180, { top: 24, bottom: 20 }),
      110,
      123.2,
      [
        [133.9, 662.2, 426.2, 123.2],
        [141.9, 705.8, 410.2, 36],
        [141.9, 695.8, 56],
      ],
      [
        [133.9, 785.4, 552.2, 123.2],
        [141.9, 829, 536.2, 36],
        [141.9, 819, 56],
      ],
    ],
    [
      'TL',
      vp(1180, 820, { bottom: 20 }),
      110,
      123.2,
      [
        [428.5, 376.3, 426.2, 123.2],
        [436.5, 419.9, 410.2, 36],
        [436.5, 409.9, 56],
      ],
      [
        [428.5, 499.5, 552.2, 123.2],
        [436.5, 543.1, 536.2, 36],
        [436.5, 533.1, 56],
      ],
    ],
    [
      "Thomas's iPad 1080 × 810 (none)",
      vp(1080, 810),
      110,
      123.2,
      [
        [377.2, 381.3, 426.2, 123.2],
        [385.2, 424.9, 410.2, 36],
        [385.2, 414.9, 56],
      ],
      [
        [377.2, 504.5, 552.2, 123.2],
        [385.2, 548.1, 536.2, 36],
        [385.2, 538.1, 56],
      ],
    ],
  ]
  it.each(PICKER)(
    '%s: σ, the pitch, and each log’s button, bar and disc at § 5.2’s rects',
    (_, v, seat, pitch, three, four) => {
      const { p } = sceneOf(v)
      expect(p.logs.map((l) => l.length)).toEqual([3, 4])
      expect(Math.abs(p.seat - seat)).toBeLessThanOrEqual(0.0501)
      expect(Math.abs(p.pitch - pitch)).toBeLessThanOrEqual(0.0501)
      p.logs.forEach((l, i) => {
        const [hit, bar, [dx, dy, D]] = [three, four][i]!
        near(l.hit, hit)
        near(l.log.bar, bar)
        expect(l.log.band).toEqual(l.log.bar)
        near(l.log.disc, [dx, dy, D, D])
        expect(l.log.seats).toHaveLength(l.length)
      })
    },
  )

  it('sockets: socket 1 at x0 + 36 on phones (42.1 × 17.9 P, 38.4 × 17.9 L), x0 + 52 on tablets (70.4 × 23)', () => {
    const want = [
      [vp(375, 667), 36, 42.1, 17.9],
      [vp(667, 375), 36, 38.4, 17.9],
      [vp(820, 1180, { top: 24, bottom: 20 }), 52, 70.4, 23],
      [vp(1080, 810), 52, 70.4, 23],
    ] as const
    for (const [v, at, w, h] of want) {
      const { p } = sceneOf(v)
      for (const { length, log } of p.logs) {
        const sockets = logSockets(log.seats, log.bar)
        expect(sockets).toHaveLength(length)
        const x0 = log.bar.x
        expect(sockets[0]!.x - x0).toBeCloseTo(at, 5)
        expect(sockets[0]!.width).toBeCloseTo(w, 1)
        expect(sockets[0]!.height).toBeCloseTo(h, 1)
        // The cells are σ wide and g apart.
        sockets.slice(1).forEach((s, k) => {
          expect(s.x - sockets[k]!.x).toBeCloseTo(
            p.seat + (at === 52 ? 16 : 8),
            5,
          )
        })
      }
    }
  })

  it('the ground shadow: (x0 + 6, bar bottom + ledge − s / 2), W − 12 wide, s tall', () => {
    const { p: phone } = sceneOf(vp(375, 667))
    near(phone.logs[0]!.shadow, [30, 416, 241.3, 12])
    near(phone.logs[1]!.shadow, [30, 504, 315, 12])
    const { p: ipad } = sceneOf(vp(1080, 810))
    near(ipad.logs[0]!.shadow, [391.2, 457.9, 398.2, 18])
    near(ipad.logs[1]!.shadow, [391.2, 581.1, 524.2, 18])
  })

  const FIT = [
    ['375 × 667', vp(375, 667), 65.7, 88, 327, [16, 359, 343, 176]],
    ['667 × 375', vp(667, 375), 60, 88, 305.2, [244.9, 166.6, 321.2, 176]],
    [
      '390 × 844 (t47 b34)',
      vp(390, 844, { top: 47, bottom: 34 }),
      69.6,
      88,
      342,
      [16, 464.5, 358, 176],
    ],
    [
      '844 × 390 (l/r47 b21)',
      vp(844, 390, { left: 47, right: 47, bottom: 21 }),
      60,
      88,
      305.2,
      [343.4, 163.1, 321.2, 176],
    ],
    [
      '820 × 1180 (t24 b20)',
      vp(820, 1180, { top: 24, bottom: 20 }),
      110,
      123.2,
      536.2,
      [133.9, 662.2, 552.2, 246.4],
    ],
    [
      '1180 × 820 (b20)',
      vp(1180, 820, { bottom: 20 }),
      110,
      123.2,
      536.2,
      [428.5, 376.3, 552.2, 246.4],
    ],
    [
      '1180 × 820 (t24 b20)',
      vp(1180, 820, { top: 24, bottom: 20 }),
      110,
      123.2,
      536.2,
      [428.5, 388.3, 552.2, 246.4],
    ],
    [
      '834 × 1194 (t24 b20)',
      vp(834, 1194, { top: 24, bottom: 20 }),
      110,
      123.2,
      536.2,
      [140.9, 671, 552.2, 246.4],
    ],
    [
      '1194 × 834 (t24 b20)',
      vp(1194, 834, { top: 24, bottom: 20 }),
      110,
      123.2,
      536.2,
      [437.3, 395.3, 552.2, 246.4],
    ],
    [
      '744 × 1133 (t24 b20)',
      vp(744, 1133, { top: 24, bottom: 20 }),
      110,
      123.2,
      536.2,
      [95.9, 632.6, 552.2, 246.4],
    ],
    [
      '1133 × 744 (t24 b20)',
      vp(1133, 744, { top: 24, bottom: 20 }),
      110,
      123.2,
      536.2,
      [395.1, 350.3, 552.2, 246.4],
    ],
    [
      '810 × 1080 (t24 b20)',
      vp(810, 1080, { top: 24, bottom: 20 }),
      110,
      123.2,
      536.2,
      [128.9, 599.2, 552.2, 246.4],
    ],
    [
      '1080 × 810 (t24 b20)',
      vp(1080, 810, { top: 24, bottom: 20 }),
      110,
      123.2,
      536.2,
      [377.2, 383.3, 552.2, 246.4],
    ],
    [
      '1080 × 810 (none)',
      vp(1080, 810),
      110,
      123.2,
      536.2,
      [377.2, 381.3, 552.2, 246.4],
    ],
    [
      '768 × 1024 (t24 b20)',
      vp(768, 1024, { top: 24, bottom: 20 }),
      110,
      123.2,
      536.2,
      [107.9, 563.9, 552.2, 246.4],
    ],
    [
      '1024 × 768 (t24 b20)',
      vp(1024, 768, { top: 24, bottom: 20 }),
      110,
      123.2,
      536.2,
      [343.7, 362.3, 552.2, 246.4],
    ],
  ] as const
  it.each(FIT)(
    '%s: σ, r, the "4" log’s width and the pair; both buttons inside A, at least 44 tall, the rows abutting',
    (_, v, seat, pitch, width, pair) => {
      const { A, p } = sceneOf(v)
      expect(Math.abs(p.seat - seat)).toBeLessThanOrEqual(0.0501)
      expect(Math.abs(p.pitch - pitch)).toBeLessThanOrEqual(0.0501)
      const [three, four] = p.logs
      expect(Math.abs(four!.log.bar.width - width)).toBeLessThanOrEqual(0.0501)
      near(
        {
          x: four!.hit.x,
          y: three!.hit.y,
          width: four!.hit.width,
          height: four!.hit.y + four!.hit.height - three!.hit.y,
        },
        pair,
      )
      expect(p.logs.every((l) => inside(A)(l.hit))).toBe(true)
      expect(p.logs.every((l) => l.hit.height >= 44)).toBe(true)
      expect(four!.hit.y).toBeCloseTo(three!.hit.y + three!.hit.height, 9)
      expect(three!.log.disc.x).toBe(four!.log.disc.x)
      expect(p.meadow).toEqual(A)
    },
  )

  // § 5.4 (2026-10-28): the titles.
  const TITLES = [
    ['P', vp(375, 667), 18, [24, 359.2, 106.2, 21.8], [24, 447.2, 95.5, 21.8]],
    [
      'L',
      vp(667, 375),
      18,
      [252.9, 166.8, 106.2, 21.8],
      [252.9, 254.8, 95.5, 21.8],
    ],
    [
      'W',
      vp(820, 1180, { top: 24, bottom: 20 }),
      25.2,
      [141.9, 663.3, 148.6, 30.5],
      [141.9, 786.5, 133.7, 30.5],
    ],
    [
      'TL',
      vp(1180, 820, { bottom: 20 }),
      25.2,
      [436.5, 377.4, 148.6, 30.5],
      [436.5, 500.6, 133.7, 30.5],
    ],
    [
      "Thomas's iPad 1080 × 810 (none)",
      vp(1080, 810),
      25.2,
      [385.2, 382.4, 148.6, 30.5],
      [385.2, 505.6, 133.7, 30.5],
    ],
  ] as const
  it.each(TITLES)(
    '%s: the titles at § 5.4’s boxes, 0.45 D, line 1.21 f, 2 pt above the disc',
    (_, v, f, three, four) => {
      const { p } = sceneOf(v)
      expect(p.titleSize).toBeCloseTo(f, 9)
      expect(p.titleLine).toBeCloseTo(1.21 * f, 9)
      expect(p.titleSize).toBeCloseTo(0.45 * p.logs[0]!.log.disc.width, 9)
      p.logs.forEach((l, i) => {
        near(l.title, [three, four][i]!)
        expect(l.title.x).toBe(l.log.disc.x)
        expect(l.title.height).toBe(p.titleLine)
        expect(l.log.disc.y - (l.title.y + l.title.height)).toBeCloseTo(2, 9)
      })
    },
  )

  // The advances alone, no kerning: wider than the kerned text, so a title
  // that fits by them fits whatever the engine kerns.
  const unkerned = fontMeasure(FREDOKA_700)
  const WORDS = { 3: PLAY_LABELS.huntTitle, 4: PLAY_LABELS.huntTitleFour }
  it.each(FIT)(
    '%s: each title inside its own button, ending short of its log’s end',
    (_, v) => {
      const { p } = sceneOf(v)
      for (const l of p.logs) {
        const wide = unkerned(WORDS[l.length], p.titleSize)
        expect(wide).toBeGreaterThan(l.title.width)
        expect(inside(l.hit)({ ...l.title, width: wide })).toBe(true)
        expect(l.title.y).toBeGreaterThan(l.hit.y)
        expect(l.title.x + wide).toBeLessThan(l.log.bar.x + l.log.bar.width)
      }
    },
  )

  it('the tightest: the "3" title on phone L ends at 359.1, its bar at 490.1', () => {
    const { p } = sceneOf(vp(667, 375))
    const t = p.logs[0]!
    expect(t.title.x + t.title.width).toBeCloseTo(359.1, 1)
    expect(t.log.bar.x + t.log.bar.width).toBeCloseTo(490.1, 1)
  })
})

describe('F17: the arrival slab and the door (critters-four-letter.md § 6.1, § 6.2)', () => {
  const ARRIVAL = [
    [
      'P',
      vp(375, 667),
      [16, 423, 343, 48],
      [19.5, 435, 336, 24],
      [19.5, 431, 32],
      383,
      [160, 8, 56],
    ],
    [
      'L',
      vp(667, 375),
      [249.5, 230.6, 312, 48],
      [257.5, 242.6, 296, 24],
      [257.5, 238.6, 32],
      675,
      [160, 8, 44],
    ],
    [
      'W',
      vp(820, 1180, { top: 24, bottom: 20 }),
      [134, 749.4, 552, 72],
      [150, 773.4, 520, 24],
      [150, 765.4, 40],
      828,
      [213.3, 34.7, 74.7],
    ],
    [
      'TL',
      vp(1180, 820, { bottom: 20 }),
      [428.6, 463.5, 552, 72],
      [444.6, 487.5, 520, 24],
      [444.6, 479.5, 40],
      1188,
      [213.3, 10.7, 74.7],
    ],
  ] as const
  it.each(ARRIVAL)(
    '%s: the slab at rest, its log bar and disc, its start, and the door',
    (_, v, slab, bar, disc, startX, door) => {
      const layout = mathLayout(v)
      const a = arrivalScene(
        playArea(layout),
        layout.tablet,
        layout.landscape,
        v.width,
      )
      const near = (
        r: { x: number; y: number; width: number; height: number },
        want: readonly number[],
      ) => {
        expect(r.x).toBeCloseTo(want[0]!, 1)
        expect(r.y).toBeCloseTo(want[1]!, 1)
        expect(r.width).toBeCloseTo(want[2]!, 1)
        expect(r.height).toBeCloseTo(want[3] ?? want[2]!, 1)
      }
      near(a.slab, slab)
      expect(a.slab.height / 2).toBeCloseTo(slab[3] / 2, 1)
      near(a.log.bar, bar)
      near(a.log.disc, disc)
      expect(a.startX).toBe(startX)
      const d = doorRect(backRect(layout), layout.ribbon, layout.tablet)
      near(d, door)
      // Clear of the ribbon: above it, or beside it.
      const { ribbon } = layout
      expect(
        d.y + d.height <= ribbon.y ||
          d.x + d.width <= ribbon.x ||
          d.x >= ribbon.x + ribbon.width,
      ).toBe(true)
    },
  )

  it('four sockets, one under each seat, 0.64 of the seat wide (T8)', () => {
    const layout = mathLayout(vp(375, 667))
    const s = huntScene(playArea(layout), false, false, 6, 4)
    const sockets = logSockets(s.seats, s.log)
    expect(sockets).toHaveLength(4)
    sockets.forEach((r) => expect(r.width).toBeCloseTo(44.8, 5))
    expect(sockets[0]!.x).toBeCloseTo(35.5 + 0.18 * 70, 5)
  })
})
