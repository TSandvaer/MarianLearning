/**
 * Content wave 5's layouts (`design/native/content-wave-5.md` § 2.3, § 3.3,
 * § 3.5, AC 12, AC 16) for the committed canon:
 *
 * - Adding big numbers: two trays, tens and ones, under today's equation,
 *   sized for 9 rods (P8's answer) and 14 cubes (P6 before the bundle,
 *   three columns): § 3.3's table of u, widths and heights on P, L, TP and
 *   TL, in the place-value frames.
 * - The second number's blocks: its rods right of the first's, its cubes
 *   continuing the first's columns, rods first, 90 ms apart.
 * - The bundle: cubes 0–9 stand as one column 10u tall (the second
 *   column's five slide up and left, 40 ms apart), become one rod there,
 *   which goes to the next rod slot; the cubes left over slide into the
 *   first column.
 * - Zeros: hundreds' trays, the tens tray 9 rods wide (P5's 190; § 2.3
 *   counts 6), an empty tray keeps at least one unit's width, and P8's
 *   "−10" pill.
 *
 * Failing-first: written before the two-tray form existed.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isHundredsProblem,
  type ArithmeticProblem,
  type HundredsProblem,
  type MoreProblem,
} from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { REPO_ROOT } from '../../test/webSource'
import type { Viewport } from './layout'
import {
  extendedMathLayout,
  morePillLabel,
  placeValueGeometry,
  placeValueMetrics,
  PV_CHANGE_STAGGER_MS,
  SUM_GATHER_STAGGER_MS,
} from './mathLayout'

const inset = (i: Partial<Viewport['insets']> = {}) => ({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  ...i,
})

function canon(stem: string) {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', `${stem}.json`),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, { extendedKinds: true }).problems
}

const SUMS = canon('add-two-digit') as ArithmeticProblem[]
const ZEROS = canon('hundreds-zeros').filter(isHundredsProblem)

const FORMS: [string, Viewport][] = [
  ['P 375×667', { width: 375, height: 667, insets: inset() }],
  ['L 667×375 b21', { width: 667, height: 375, insets: inset({ bottom: 21 }) }],
  [
    'TP 744×1133',
    { width: 744, height: 1133, insets: inset({ top: 24, bottom: 20 }) },
  ],
  [
    'TL 1133×744',
    { width: 1133, height: 744, insets: inset({ top: 24, bottom: 20 }) },
  ],
]

describe('adding big numbers: the two trays (§ 3.3, AC 16)', () => {
  // § 3.3's table: the problem rect, the equation line, u, the trays'
  // width, and equation line + gap + trays and tags.
  const TABLE: Record<
    string,
    {
      rect: [number, number]
      line: number
      u: number
      width: number
      height: number
    }
  > = {
    'P 375×667': {
      rect: [343, 272],
      line: 79,
      u: 10,
      width: 182,
      height: 249,
    },
    'L 667×375 b21': {
      rect: [376, 189],
      line: 62,
      u: 7,
      width: 131,
      height: 183,
    },
    'TP 744×1133': {
      rect: [712, 530],
      line: 106,
      u: 20,
      width: 356,
      height: 392,
    },
    'TL 1133×744': {
      rect: [892, 317],
      line: 106,
      u: 13,
      width: 237,
      height: 315,
    },
  }

  it.each(FORMS)('%s', (name, v) => {
    const layout = extendedMathLayout(v, 'place-value')
    const m = placeValueMetrics(layout, SUMS)
    const want = TABLE[name]!
    expect(
      [layout.problem.width, layout.problem.height].map(Math.round),
    ).toEqual(want.rect)
    expect(layout.equationLineHeight).toBe(want.line)
    expect(m.places).toEqual(['tens', 'ones'])
    expect([m.maxRods, m.maxCubes, m.cubeColumns]).toEqual([9, 14, 3])
    expect(m.u).toBe(want.u)
    // The largest u that fits.
    expect(m.fits(m.u + 1)).toBe(false)
    expect(Math.round(m.block.width)).toBe(want.width)
    expect(
      Math.round(
        layout.equationLineHeight + layout.problemGap + m.block.height,
      ),
    ).toBe(want.height)
    expect(m.block.width).toBeLessThanOrEqual(layout.problem.width)
    expect(
      layout.equationLineHeight + layout.problemGap + m.block.height,
    ).toBeLessThanOrEqual(layout.problem.height)
    // No hundreds tray, no number tag, no pill.
    expect(m.trayWidths.hundreds).toBe(0)
    expect(m.numberTag).toBe(false)
  })

  it('takes the place-value frames on L (the chip column, the 2-line ribbon)', () => {
    const l = extendedMathLayout(FORMS[1]![1], 'place-value')
    expect(l.chipsAxis).toBe('column')
    expect(l.ribbonLines).toBe(2)
  })
})

describe("adding big numbers' blocks and bundle (§ 3.2, § 3.5, AC 12)", () => {
  const layout = extendedMathLayout(FORMS[0]![1], 'place-value')
  const m = placeValueMetrics(layout, SUMS)
  const P3 = SUMS[2]! // 28 + 35
  const g = placeValueGeometry(m, P3, layout.problem.width)

  it('P3 starts with the first number (2 rods, 8 cubes) in two trays', () => {
    expect(g.rods).toHaveLength(2)
    expect(g.cubes).toHaveLength(8)
    expect(g.flats).toEqual([])
    expect(g.trays.hundreds.width).toBe(0)
    expect(g.trays.tens.x + g.trays.tens.width).toBeLessThan(g.trays.ones.x)
  })

  it('drops the second number, rods first, 90 ms apart, continuing the columns', () => {
    const drop = g.sum!.drop
    expect(drop.map((b) => [b.place, b.index])).toEqual([
      ['tens', 2],
      ['tens', 3],
      ['tens', 4],
      ['ones', 8],
      ['ones', 9],
      ['ones', 10],
      ['ones', 11],
      ['ones', 12],
    ])
    expect(drop.map((b) => b.delay)).toEqual(
      drop.map((_, k) => k * PV_CHANGE_STAGGER_MS),
    )
    expect(PV_CHANGE_STAGGER_MS).toBe(90)
    // Cube 8 sits on cube 7 in the second column; cube 10 starts the third.
    const cubeAt = (k: number) => drop.find((b) => b.index === k)!.rect
    expect(cubeAt(8).x).toBe(g.cubes[5]!.x)
    expect(cubeAt(8).y).toBeLessThan(g.cubes[7]!.y)
    expect(cubeAt(10).x).toBeGreaterThan(cubeAt(9).x)
  })

  it('bundles ten cubes into one column 10u tall, a rod there, then the 6th rod slot; 3 cubes slide left', () => {
    const b = g.sum!.bundle!
    expect(b.column.map((c) => c.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    const col0 = g.cubes[0]!.x
    for (const c of b.column) expect(c.to.x).toBe(col0)
    // The first column stays; the second's five move, 40 ms apart.
    expect(b.column.map((c) => c.delay)).toEqual([
      0,
      0,
      0,
      0,
      0,
      0,
      SUM_GATHER_STAGGER_MS,
      2 * SUM_GATHER_STAGGER_MS,
      3 * SUM_GATHER_STAGGER_MS,
      4 * SUM_GATHER_STAGGER_MS,
    ])
    const top = Math.min(...b.column.map((c) => c.to.y))
    const bottom = Math.max(...b.column.map((c) => c.to.y + c.to.height))
    expect(bottom - top).toBeCloseTo(10 * m.u, 5)
    expect(b.rod.from).toEqual({
      x: col0,
      y: top,
      width: m.u,
      height: 10 * m.u,
    })
    expect(b.rod.index).toBe(5)
    expect(b.rod.to.x).toBeGreaterThan(g.rods[1]!.x)
    expect(b.rod.to.x + b.rod.to.width).toBeLessThanOrEqual(
      g.trays.tens.x + g.trays.tens.width,
    )
    expect(b.left.map((c) => [c.index, c.to.x])).toEqual([
      [10, col0],
      [11, col0],
      [12, col0],
    ])
    expect([g.sum!.endRods, g.sum!.endCubes]).toEqual([6, 3])
  })

  it('P1 and P2 make no ten', () => {
    for (const p of SUMS.slice(0, 2))
      expect(placeValueGeometry(m, p, layout.problem.width).sum!.bundle).toBe(
        null,
      )
    for (const p of SUMS.slice(2))
      expect(
        placeValueGeometry(m, p, layout.problem.width).sum!.bundle,
      ).not.toBeNull()
  })

  it('the hundreds kinds have no sum geometry', () => {
    const hm = placeValueMetrics(layout, ZEROS)
    expect(placeValueGeometry(hm, ZEROS[0]!, 343).sum).toBeNull()
  })
})

describe("zeros' trays (§ 2.3)", () => {
  it.each(FORMS)(
    '%s: three trays sized for 7 flats, 9 rods, 8 cubes; an empty tray keeps its width',
    (_name, v) => {
      const layout = extendedMathLayout(v, 'place-value')
      const m = placeValueMetrics(layout, ZEROS)
      expect(m.places).toEqual(['hundreds', 'tens', 'ones'])
      expect([m.maxFlats, m.maxRods, m.maxCubes]).toEqual([7, 9, 8])
      expect(m.block.width).toBeLessThanOrEqual(layout.problem.width)
      expect(m.block.height).toBeLessThanOrEqual(layout.problem.height)
      // P1 305: an empty tens tray, its tray full width, no rods.
      const g = placeValueGeometry(m, ZEROS[0] as HundredsProblem, 343)
      expect(g.rods).toEqual([])
      expect(g.trays.tens.width).toBe(m.trayWidths.tens)
      expect(m.trayWidths.tens).toBeGreaterThan(m.u)
    },
  )

  it('P8 shows "−10"; P6 "+10"; P7 "+100"', () => {
    const more = ZEROS.filter((p): p is MoreProblem => p.kind === 'more')
    expect(more.map(morePillLabel)).toEqual(['+10', '+100', '−10'])
  })
})
