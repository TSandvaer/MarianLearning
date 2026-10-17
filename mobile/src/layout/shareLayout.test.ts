/**
 * Sharing's layout (`design/native/content-wave-2.md` § 2.3) against its
 * table, for the committed canon (largest pile 20, largest share 6), plus
 * the fit rules on every viewport the multiply/skip table covers, and AC 10
 * (every plate of a plan has one size).
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
import { extendedMathLayout, shareGeometry, shareMetrics } from './mathLayout'

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
  s: number
  cloth: [number, number]
  plate: [number, number]
  /** Five plates: [row width, gap]. */
  row: [number, number]
  block: number
}

// § 2.3, "Form" … "Block height", row by row.
const TABLE: Row[] = [
  {
    name: 'P 375×667',
    v: { width: 375, height: 667, insets: inset() },
    area: [343, 272],
    s: 20,
    cloth: [256, 56],
    plate: [56, 128],
    row: [340, 15],
    block: 222,
  },
  {
    name: 'L 667×375 b21',
    v: { width: 667, height: 375, insets: inset({ bottom: 21 }) },
    area: [376, 189],
    s: 14,
    cloth: [342, 26],
    plate: [56, 128],
    row: [376, 24],
    block: 176,
  },
  {
    name: 'TP 744×1133',
    v: { width: 744, height: 1133, insets: inset({ top: 24, bottom: 20 }) },
    area: [712, 530],
    s: 24,
    cloth: [320, 70],
    plate: [70, 160],
    row: [478, 32],
    block: 270,
  },
  {
    name: 'TL 1133×744',
    v: { width: 1133, height: 744, insets: inset({ top: 24, bottom: 20 }) },
    area: [892, 317],
    s: 24,
    cloth: [320, 70],
    plate: [70, 160],
    row: [478, 32],
    block: 270,
  },
]

describe('the canon (largest pile 20, largest share 6)', () => {
  it('reads 8 divide problems', () => {
    expect(CANON).toHaveLength(8)
    expect(Math.max(...CANON.map((p) => p.total))).toBe(20)
    expect(Math.max(...CANON.map((p) => p.correct))).toBe(6)
  })
})

describe.each(TABLE)('§ 2.3 — $name', (row) => {
  const layout = extendedMathLayout(row.v, 'divide')
  const m = shareMetrics(layout, CANON)

  it('problem rect', () => {
    expect([
      Math.round(layout.problem.width),
      Math.round(layout.problem.height),
    ]).toEqual(row.area)
  })

  it('pile flower s, cloth, plate, 5-plate row, block', () => {
    expect(m.pileFlower).toBe(row.s)
    expect([m.cloth.width, m.cloth.height]).toEqual(row.cloth)
    expect([m.plate.width, m.plate.height]).toEqual(row.plate)
    const five = shareGeometry(m, 20, 5, layout.problem.width)
    const last = five.plates[4]!
    expect([
      Math.round(last.x + last.width - five.plates[0]!.x),
      five.plateGap,
    ]).toEqual(row.row)
    expect(m.block).toBe(row.block)
  })

  it('the block fits the problem rect; the cloth, its tag and the plates stay inside', () => {
    expect(m.block).toBeLessThanOrEqual(layout.problem.height)
    for (const p of CANON) {
      const g = shareGeometry(m, p.total, p.plates, layout.problem.width)
      expect(g.cloth.x - m.tagOuter).toBeGreaterThanOrEqual(0)
      expect(g.cloth.x + g.cloth.width).toBeLessThanOrEqual(
        layout.problem.width,
      )
      expect(g.plates[0]!.x).toBeGreaterThanOrEqual(0)
      const last = g.plates[g.plates.length - 1]!
      expect(last.x + last.width).toBeLessThanOrEqual(layout.problem.width)
    }
  })
})

describe('fit on every viewport of the multiply/skip table', () => {
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
  it.each(VIEWPORTS)('$width×$height', (v) => {
    const layout = extendedMathLayout(v, 'divide')
    const m = shareMetrics(layout, CANON)
    expect(m.block).toBeLessThanOrEqual(layout.problem.height)
    expect(m.cloth.width + m.tagOuter).toBeLessThanOrEqual(layout.problem.width)
    // Plate flowers stay full size everywhere; only the pile shrinks.
    expect(m.groups.flower).toBe(layout.tablet ? 24 : 20)
  })
})

describe('AC 10: one plate size per plan, the size for a share of 6', () => {
  it('every plate of every problem is 56 × 128 on the phone floor', () => {
    const layout = extendedMathLayout(
      { width: 375, height: 667, insets: inset() },
      'divide',
    )
    const m = shareMetrics(layout, CANON)
    const sizes = new Set(
      CANON.flatMap((p) =>
        shareGeometry(m, p.total, p.plates, layout.problem.width).plates.map(
          (pl) => `${pl.width}×${pl.height}`,
        ),
      ),
    )
    expect([...sizes]).toEqual(['56×128'])
  })
})

describe('geometry', () => {
  const layout = extendedMathLayout(
    { width: 375, height: 667, insets: inset() },
    'divide',
  )
  const m = shareMetrics(layout, CANON)

  it('the pile reads in rows of 10, a wider gap after the 5th; the tag sits on the cloth’s left edge', () => {
    const g = shareGeometry(m, 12, 3, layout.problem.width)
    expect(g.pile).toHaveLength(12)
    // 4 pt between flowers, 12 after the 5th; the 11th starts row 2.
    expect(g.pile[1]!.x - g.pile[0]!.x).toBe(24)
    expect(g.pile[5]!.x - g.pile[4]!.x).toBe(32)
    expect(g.pile[10]!.x).toBe(g.pile[0]!.x)
    expect(g.pile[10]!.y - g.pile[0]!.y).toBe(24)
    expect(g.totalTag).toEqual({ x: g.cloth.x, y: m.cloth.height / 2 })
  })

  it('plate cells fill columns of 5, top to bottom, left column first', () => {
    const g = shareGeometry(m, 18, 3, layout.problem.width)
    const cells = g.plateCells[0]!
    expect(cells).toHaveLength(6)
    expect(cells[4]!.x).toBe(cells[0]!.x)
    expect(cells[4]!.y - cells[0]!.y).toBe(4 * 24)
    expect(cells[5]!.x - cells[0]!.x).toBe(24)
    expect(cells[5]!.y).toBe(cells[0]!.y)
  })

  it('L draws the pile in one row, a wider gap after every 5th', () => {
    const l = extendedMathLayout(
      { width: 667, height: 375, insets: inset({ bottom: 21 }) },
      'divide',
    )
    const lm = shareMetrics(l, CANON)
    const g = shareGeometry(lm, 20, 4, l.problem.width)
    expect(new Set(g.pile.map((p) => p.y)).size).toBe(1)
    expect(g.pile[1]!.x - g.pile[0]!.x).toBe(16)
    expect(g.pile[5]!.x - g.pile[4]!.x).toBe(20)
    expect(g.pile[15]!.x - g.pile[14]!.x).toBe(20)
  })
})
