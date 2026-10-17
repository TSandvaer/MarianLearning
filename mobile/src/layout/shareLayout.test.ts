/**
 * Sharing's layout (`design/native/content-wave-2.md` § 2.3, amended by
 * Kyle's UX calls on #587) for the committed canon (largest pile 20,
 * largest share 6, at most 5 plates):
 *
 * - call 2: the cloth's left padding is `ceil(tagW / 2) + 4`, so the total
 *   tag clears the pile (L's `s` is 13);
 * - the plate call (after Thomas's iPad check, "the plates look like boxes"):
 *   round plates of diameter D = 3.5 f in one row, the "?" tag centred 4 pt
 *   (tablet 6) above each, the dealt flowers on the share's die face, round
 *   1 always top-left. It replaces call 3 (the centred column).
 *
 * Plus the fit on every viewport the multiply/skip table covers, and AC 10
 * (one plate size per plan).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isDivideProblem,
  type DivideProblem,
} from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { REPO_ROOT } from '../../test/webSource'
import type { Viewport } from './layout'
import {
  extendedMathLayout,
  SHARE_FACES,
  shareGeometry,
  shareMetrics,
  shareSlotOffset,
} from './mathLayout'

const inset = (i: Partial<Viewport['insets']> = {}) => ({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  ...i,
})

function shareCanon(): DivideProblem[] {
  const json = JSON.parse(
    readFileSync(
      resolve(
        REPO_ROOT,
        'public',
        'canon',
        'math',
        'level-1',
        'div-share.json',
      ),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, {
    extendedKinds: true,
  }).problems.filter(isDivideProblem)
}

const CANON = shareCanon()

interface Row {
  name: string
  v: Viewport
  area: [number, number]
  /** Pile flower s and the cloth (call 2). */
  s: number
  cloth: [number, number]
  /** Plate flower f, diameter D, gap G, the 5-plate row's width. */
  f: number
  d: number
  g: number
  row: number
  /** Tag + tag gap + D, and the block (cloth + gap + slot). */
  slot: number
  block: number
}

// Kyle's plate call, the table row by row (and call 2's cloth).
const TABLE: Row[] = [
  {
    name: 'P 375×667',
    v: { width: 375, height: 667, insets: inset() },
    area: [343, 272],
    s: 20,
    cloth: [274, 56],
    f: 18,
    d: 63,
    g: 7,
    row: 343,
    slot: 95,
    block: 175,
  },
  {
    name: 'L 667×375 b21',
    v: { width: 667, height: 375, insets: inset({ bottom: 21 }) },
    area: [376, 189],
    s: 13,
    cloth: [340, 25],
    f: 20,
    d: 70,
    g: 6.5,
    row: 376,
    slot: 102,
    block: 135,
  },
  {
    name: 'TP 744×1133',
    v: { width: 744, height: 1133, insets: inset({ top: 24, bottom: 20 }) },
    area: [712, 530],
    s: 24,
    cloth: [338, 70],
    f: 24,
    d: 84,
    g: 32,
    row: 548,
    slot: 122,
    block: 216,
  },
  {
    name: 'TL 1133×744',
    v: { width: 1133, height: 744, insets: inset({ top: 24, bottom: 20 }) },
    area: [892, 317],
    s: 24,
    cloth: [338, 70],
    f: 24,
    d: 84,
    g: 32,
    row: 548,
    slot: 122,
    block: 216,
  },
]

const VIEWPORTS: Viewport[] = [
  { width: 375, height: 667, insets: inset() },
  { width: 390, height: 844, insets: inset({ top: 47, bottom: 34 }) },
  { width: 411, height: 914, insets: inset({ top: 24, bottom: 24 }) },
  { width: 667, height: 375, insets: inset() },
  { width: 667, height: 375, insets: inset({ bottom: 21 }) },
  {
    width: 844,
    height: 390,
    insets: inset({ left: 47, right: 47, bottom: 21 }),
  },
  { width: 914, height: 411, insets: inset({ left: 24, right: 24 }) },
  { width: 744, height: 1133, insets: inset({ top: 24, bottom: 20 }) },
  { width: 1133, height: 744, insets: inset({ top: 24, bottom: 20 }) },
]

describe('the canon (largest pile 20, largest share 6, 5 plates)', () => {
  it('reads 8 divide problems', () => {
    expect(CANON).toHaveLength(8)
    expect(Math.max(...CANON.map((p) => p.total))).toBe(20)
    expect(Math.max(...CANON.map((p) => p.correct))).toBe(6)
    expect(Math.max(...CANON.map((p) => p.plates))).toBe(5)
  })
})

describe.each(TABLE)('the plate call’s table — $name', (row) => {
  const layout = extendedMathLayout(row.v, 'divide')
  const m = shareMetrics(layout, CANON)

  it('problem rect', () => {
    expect([
      Math.round(layout.problem.width),
      Math.round(layout.problem.height),
    ]).toEqual(row.area)
  })

  it('pile s and cloth; plate f, D, gap, 5-plate row; slot; block', () => {
    expect(m.pileFlower).toBe(row.s)
    expect([m.cloth.width, m.cloth.height]).toEqual(row.cloth)
    expect(m.plateFlower).toBe(row.f)
    expect(m.plate).toBe(row.d)
    expect(m.plateGap).toBe(row.g)
    const five = shareGeometry(m, 20, 5, layout.problem.width)
    const last = five.plates[4]!
    expect(last.x + last.width - five.plates[0]!.x).toBe(row.row)
    expect(m.tagHeight + m.plateTagGap + m.plate).toBe(row.slot)
    expect(m.block).toBe(row.block)
  })
})

describe('fit on every viewport of the multiply/skip table', () => {
  it.each(VIEWPORTS)(
    '$width×$height: the block, the cloth with its tag, and 5 plates fit',
    (v) => {
      const layout = extendedMathLayout(v, 'divide')
      const m = shareMetrics(layout, CANON)
      expect(m.block).toBeLessThanOrEqual(layout.problem.height)
      expect(m.cloth.width + m.tagOuter).toBeLessThanOrEqual(
        layout.problem.width,
      )
      for (const p of CANON) {
        const g = shareGeometry(m, p.total, p.plates, layout.problem.width)
        expect(g.plates[0]!.x).toBeGreaterThanOrEqual(0)
        const last = g.plates[g.plates.length - 1]!
        expect(last.x + last.width).toBeLessThanOrEqual(
          layout.problem.width + 1e-9,
        )
        // The "?" tag sits above its plate, clear of it.
        g.plateTags.forEach((t, k) => {
          expect(t.y + m.tagHeight / 2 + m.plateTagGap).toBe(g.plates[k]!.y)
          expect(t.x).toBe(g.plates[k]!.x + m.plate / 2)
        })
      }
    },
  )

  // Call 2: the tag clears the pile.
  it.each(VIEWPORTS)(
    '$width×$height: no pile cell touches the total tag (largest pile)',
    (v) => {
      const layout = extendedMathLayout(v, 'divide')
      const m = shareMetrics(layout, CANON)
      const g = shareGeometry(m, 20, 4, layout.problem.width)
      const tag = {
        left: g.totalTag.x - m.tagWidth / 2,
        right: g.totalTag.x + m.tagWidth / 2,
        top: g.totalTag.y - m.tagHeight / 2,
        bottom: g.totalTag.y + m.tagHeight / 2,
      }
      const s = m.pileFlower
      const hits = g.pile.filter(
        (c) =>
          c.x - s / 2 < tag.right &&
          c.x + s / 2 > tag.left &&
          c.y - s / 2 < tag.bottom &&
          c.y + s / 2 > tag.top,
      )
      expect(hits).toEqual([])
      expect(g.pile[0]!.x - s / 2 - tag.right).toBeGreaterThanOrEqual(4)
    },
  )

  // The plate call: the flowers stay on the plate. Each flower is a disc of
  // diameter f (its drawn petals reach 0.81 of that): the outermost point is
  // √(a² + b²) + f / 2 = 1.71 f, inside the radius 1.75 f.
  it.each(VIEWPORTS)(
    '$width×$height: no flower crosses the plate’s outer circle, shares 2–6',
    (v) => {
      const layout = extendedMathLayout(v, 'divide')
      const m = shareMetrics(layout, CANON)
      for (const share of [2, 3, 4, 5, 6]) {
        const g = shareGeometry(m, share * 2, 2, layout.problem.width)
        g.plateCells.forEach((cells, k) => {
          const p = g.plates[k]!
          const cx = p.x + m.plate / 2
          const cy = p.y + m.plate / 2
          expect(cells).toHaveLength(share)
          for (const c of cells) {
            const reach = Math.hypot(c.x - cx, c.y - cy) + m.plateFlower / 2
            expect(reach).toBeLessThanOrEqual(m.plate / 2)
          }
        })
      }
    },
  )
})

describe('the die face (the plate call)', () => {
  const layout = extendedMathLayout(
    { width: 375, height: 667, insets: inset() },
    'divide',
  )
  const m = shareMetrics(layout, CANON)
  const f = m.plateFlower

  it('the slots, in deal order, for shares 2–6', () => {
    expect(SHARE_FACES).toEqual({
      2: ['TL', 'BR'],
      3: ['TL', 'C', 'BR'],
      4: ['TL', 'TR', 'BL', 'BR'],
      5: ['TL', 'TR', 'C', 'BL', 'BR'],
      6: ['TL', 'TR', 'ML', 'MR', 'BL', 'BR'],
    })
    expect(shareSlotOffset('TL', f)).toEqual({ x: -0.6 * f, y: -1.05 * f })
    expect(shareSlotOffset('MR', f)).toEqual({ x: 0.6 * f, y: 0 })
    expect(shareSlotOffset('C', f)).toEqual({ x: 0, y: 0 })
  })

  it('round 1 lands on TL for every share', () => {
    for (const share of [2, 3, 4, 5, 6]) {
      const g = shareGeometry(m, share * 3, 3, layout.problem.width)
      g.plateCells.forEach((cells, k) => {
        const p = g.plates[k]!
        expect(cells[0]).toEqual({
          x: p.x + m.plate / 2 - 0.6 * f,
          y: p.y + m.plate / 2 - 1.05 * f,
        })
      })
    }
  })

  it('a share of 4: TL, TR, BL, BR (a die’s four)', () => {
    const g = shareGeometry(m, 8, 2, layout.problem.width)
    const p = g.plates[0]!
    const c = { x: p.x + m.plate / 2, y: p.y + m.plate / 2 }
    expect(
      g.plateCells[0]!.map((q) => [
        Math.round((q.x - c.x) / (0.6 * f)),
        Math.round((q.y - c.y) / (1.05 * f)),
      ]),
    ).toEqual([
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
  })
})

describe('AC 10: one plate size per plan', () => {
  it.each(TABLE)('$name: every plate of every problem is D × D', (row) => {
    const layout = extendedMathLayout(row.v, 'divide')
    const m = shareMetrics(layout, CANON)
    const sizes = new Set(
      CANON.flatMap((p) =>
        shareGeometry(m, p.total, p.plates, layout.problem.width).plates.map(
          (pl) => `${pl.width}×${pl.height}`,
        ),
      ),
    )
    expect([...sizes]).toEqual([`${row.d}×${row.d}`])
  })
})

describe('the cloth and the pile (call 2)', () => {
  const layout = extendedMathLayout(
    { width: 375, height: 667, insets: inset() },
    'divide',
  )
  const m = shareMetrics(layout, CANON)

  it('the cloth’s left padding is ceil(tagW / 2) + 4 for the plan’s largest pile ("20": 39 pt → 24)', () => {
    expect(m.tagWidth).toBe(39)
    expect(m.tagOuter).toBe(20)
    expect(m.clothLeftPad).toBe(24)
    expect(m.clothPad).toBe(6)
    const g = shareGeometry(m, 12, 3, layout.problem.width)
    expect(g.pile[0]!.x - m.pileFlower / 2).toBe(g.cloth.x + 24)
  })

  it('the pile reads in rows of 10, a wider gap after the 5th; the tag sits on the cloth’s left edge', () => {
    const g = shareGeometry(m, 12, 3, layout.problem.width)
    expect(g.pile).toHaveLength(12)
    expect(g.pile[1]!.x - g.pile[0]!.x).toBe(24)
    expect(g.pile[5]!.x - g.pile[4]!.x).toBe(32)
    expect(g.pile[10]!.x).toBe(g.pile[0]!.x)
    expect(g.pile[10]!.y - g.pile[0]!.y).toBe(24)
    expect(g.totalTag).toEqual({ x: g.cloth.x, y: m.cloth.height / 2 })
  })

  it('L draws the pile in one row, a wider gap after every 5th', () => {
    const l = extendedMathLayout(
      { width: 667, height: 375, insets: inset({ bottom: 21 }) },
      'divide',
    )
    const lm = shareMetrics(l, CANON)
    const g = shareGeometry(lm, 20, 4, l.problem.width)
    expect(new Set(g.pile.map((p) => p.y)).size).toBe(1)
    // s = 13: 2 pt gaps, 6 after every 5th.
    expect(g.pile[1]!.x - g.pile[0]!.x).toBe(15)
    expect(g.pile[5]!.x - g.pile[4]!.x).toBe(19)
    expect(g.pile[15]!.x - g.pile[14]!.x).toBe(19)
  })
})
