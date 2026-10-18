/**
 * Hundreds' layout (`design/native/content-wave-3.md` § 3.2, § 3.3, AC 10)
 * for the committed canon (largest counts shown: 7 flats in P8, 6 rods in
 * P7, 8 cubes in P8):
 *
 * - `extendedMathLayout(v, 'place-value')` (and `'more'`) returns sharing's
 *   frames, so nothing moves between P5 and P6.
 * - One unit u per plan, the largest whole number ≤ 10 (tablet ≤ 20) that
 *   fits the problem rect: § 3.3's table, row by row.
 * - The trays sit side by side (hundreds, tens, ones), the flats fan up and
 *   right 1.2u apart, rods 0.3u apart, cubes in columns of 5 bottom up.
 * - Every numeral fits its chip (the 2 pt step-down rule).
 *
 * Failing-first: written before `placeValueMetrics` existed.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isHundredsProblem,
  type HundredsProblem,
} from '@marian/core/math/extendedProblems'
import { hundredsDistractors } from '@marian/core/math/extendedDistractors'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { REPO_ROOT } from '../../test/webSource'
import type { Viewport } from './layout'
import {
  chipNumeralFont,
  extendedMathLayout,
  fredokaBoldWidth,
  placeValueGeometry,
  placeValueMetrics,
} from './mathLayout'

const inset = (i: Partial<Viewport['insets']> = {}) => ({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  ...i,
})

function hundredsCanon(): HundredsProblem[] {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', 'hundreds.json'),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, {
    extendedKinds: true,
  }).problems.filter(isHundredsProblem)
}

const CANON = hundredsCanon()

// § 3.3's table: the problem rect, u, the block's width (L and TL: before
// the number tag's column) and height (with the number tag).
const TABLE: [string, Viewport, [number, number], number, number, number][] = [
  [
    'P 375×667',
    { width: 375, height: 667, insets: inset() },
    [343, 272],
    10,
    324,
    254,
  ],
  [
    'L 667×375 b21',
    { width: 667, height: 375, insets: inset({ bottom: 21 }) },
    [376, 189],
    8,
    264,
    182,
  ],
  [
    'TP 744×1133',
    { width: 744, height: 1133, insets: inset({ top: 24, bottom: 20 }) },
    [712, 530],
    20,
    632,
    448,
  ],
  [
    'TL 1133×744',
    { width: 1133, height: 744, insets: inset({ top: 24, bottom: 20 }) },
    [892, 317],
    15,
    482,
    315,
  ],
]

describe('the canon plan', () => {
  it('has 8 hundreds problems; largest counts 7 flats, 6 rods, 8 cubes', () => {
    expect(CANON).toHaveLength(8)
    const m = placeValueMetrics(
      extendedMathLayout(TABLE[0]![1], 'place-value'),
      CANON,
    )
    expect([m.maxFlats, m.maxRods, m.maxCubes]).toEqual([7, 6, 8])
  })
})

describe('§ 3.3: one u per plan, on the four forms (AC 10)', () => {
  it.each(TABLE)('%s', (_name, v, area, u, width, height) => {
    const layout = extendedMathLayout(v, 'place-value')
    // Sharing's frames, for both hundreds kinds.
    expect(extendedMathLayout(v, 'more')).toEqual(layout)
    expect(extendedMathLayout(v, 'divide')).toEqual(layout)
    expect([
      Math.round(layout.problem.width),
      Math.round(layout.problem.height),
    ]).toEqual(area)
    const m = placeValueMetrics(layout, CANON)
    expect(m.u).toBe(u)
    expect(Math.round(m.traysWidth)).toBe(width)
    expect(Math.round(m.block.height)).toBe(height)
    expect(m.block.width).toBeLessThanOrEqual(area[0])
    expect(m.block.height).toBeLessThanOrEqual(area[1])
    // The largest u: one more does not fit.
    expect(m.fits(u)).toBe(true)
    expect(m.fits(u + 1)).toBe(false)
    // L and TL: the number tag's column sits left of the trays.
    if (layout.form === 'phone-landscape' || layout.form === 'tablet-landscape')
      expect(m.numberTagSide).toBe('left')
    else expect(m.numberTagSide).toBe('top')
  })
})

describe('the geometry of one problem', () => {
  const layout = extendedMathLayout(TABLE[0]![1], 'place-value')
  const m = placeValueMetrics(layout, CANON)
  const width = layout.problem.width

  it('P1: 2 flats fanned up-right 1.2u apart, 3 rods 0.3u apart, 4 cubes bottom up', () => {
    const g = placeValueGeometry(m, CANON[0]!, width)
    const u = m.u
    expect(g.flats).toHaveLength(2)
    expect(g.flats[1]!.x - g.flats[0]!.x).toBeCloseTo(1.2 * u)
    expect(g.flats[0]!.y - g.flats[1]!.y).toBeCloseTo(1.2 * u)
    expect(g.flats[0]!.width).toBeCloseTo(10 * u)
    expect(g.rods).toHaveLength(3)
    expect(g.rods[1]!.x - g.rods[0]!.x).toBeCloseTo(1.3 * u)
    expect(g.rods[0]!.height).toBeCloseTo(10 * u)
    expect(g.cubes).toHaveLength(4)
    expect(g.cubes[0]!.y - g.cubes[1]!.y).toBeCloseTo(u)
    // Trays left to right: hundreds, tens, ones; the blocks inside them.
    const [h, t, o] = [g.trays.hundreds, g.trays.tens, g.trays.ones]
    expect(h.x + h.width).toBeLessThan(t.x)
    expect(t.x + t.width).toBeLessThan(o.x)
    for (const r of g.flats) {
      expect(r.x).toBeGreaterThanOrEqual(h.x)
      expect(r.x + r.width).toBeLessThanOrEqual(h.x + h.width + 0.001)
      expect(r.y).toBeGreaterThanOrEqual(h.y - 0.001)
    }
    for (const r of g.cubes) {
      expect(r.x + r.width).toBeLessThanOrEqual(o.x + o.width + 0.001)
      expect(r.y + r.height).toBeLessThanOrEqual(o.y + o.height + 0.001)
    }
    // No number tag on a place-value problem; each tray's tag under it.
    expect(g.numberTag).toBeNull()
    expect(g.tags.ones.y).toBeGreaterThan(o.y + o.height)
  })

  it('P8: cubes in two columns of 5 (left first); the added rod has a slot', () => {
    const g = placeValueGeometry(m, CANON[7]!, width)
    expect(g.cubes).toHaveLength(8)
    expect(g.cubes[5]!.x).toBeGreaterThan(g.cubes[4]!.x)
    expect(g.cubes[5]!.y).toBeCloseTo(g.cubes[0]!.y)
    // 728 + 10: two rods at the start, the third is the added one.
    expect(g.rods).toHaveLength(2)
    expect(g.added?.place).toBe('tens')
    expect(g.added!.rect.x - g.rods[1]!.x).toBeCloseTo(1.3 * m.u)
    expect(g.numberTag).not.toBeNull()
    // The pill sits right of the number tag in P.
    expect(g.numberPill!.x).toBeGreaterThan(g.numberTag!.x)
  })

  it('P7: + 100 adds a flat on top of the fan', () => {
    const g = placeValueGeometry(m, CANON[6]!, width)
    expect(g.flats).toHaveLength(4)
    expect(g.added?.place).toBe('hundreds')
    expect(g.added!.rect.x - g.flats[3]!.x).toBeCloseTo(1.2 * m.u)
  })

  it('L: the number tag is left of the trays, its pill under it', () => {
    const l = extendedMathLayout(TABLE[1]![1], 'more')
    const ml = placeValueMetrics(l, CANON)
    const g = placeValueGeometry(ml, CANON[5]!, l.problem.width)
    expect(g.numberTag!.x).toBeLessThan(g.trays.hundreds.x)
    expect(g.numberPill!.y).toBeGreaterThan(g.numberTag!.y)
    expect(g.trays.ones.x + g.trays.ones.width).toBeLessThanOrEqual(
      l.problem.width,
    )
  })
})

describe('every numeral fits its chip (§ 3.3, AC 10)', () => {
  it.each(TABLE)('%s', (_name, v) => {
    const layout = extendedMathLayout(v, 'place-value')
    const { size, font } = layout.chips
    for (const p of CANON) {
      const values = [p.correct, ...hundredsDistractors(p)]
      const f = chipNumeralFont(values, size, font)
      // § 3.3: "234" is 1.68 em; the canon never needs the step-down.
      expect(f).toBe(font)
      for (const n of values)
        expect(fredokaBoldWidth(String(n), f)).toBeLessThanOrEqual(size - 16)
    }
  })

  it('steps the font down 2 pt while a numeral is wider than chip − 16', () => {
    // A 40 pt "888" (1.62 em = 64.9 pt) in a 72 pt chip (56 pt of room).
    const f = chipNumeralFont([888], 72, 40)
    expect(f).toBe(34)
    expect(fredokaBoldWidth('888', f)).toBeLessThanOrEqual(56)
    expect(fredokaBoldWidth('888', f + 2)).toBeGreaterThan(56)
  })
})
