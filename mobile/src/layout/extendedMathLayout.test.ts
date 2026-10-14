/**
 * `extendedMathLayout` and the new problem visuals' metrics against the
 * § 6 table of `design/native/math-skip-counting-multiplication-native.md`
 * (all 9 viewports), and § 10's number-strip sizes.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import {
  isSkipCountProblem,
  type SkipCountProblem,
} from '@marian/core/math/extendedProblems'
import { REPO_ROOT } from '../../test/webSource'
import type { Viewport } from './layout'
import {
  extendedMathLayout,
  fredokaBoldWidth,
  groupsMetrics,
  groupsRow,
  mathLayout,
  multiplyBlockHeight,
  numberStripMetrics,
  skipTrackCellCount,
  skipTrackGeometry,
  skipTrackMetrics,
} from './mathLayout'
import { wordSongLayout } from './wordSongLayout'

const inset = (i: Partial<Viewport['insets']> = {}) => ({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  ...i,
})

function skipCanon(): SkipCountProblem[] {
  const json = JSON.parse(
    readFileSync(
      resolve(
        REPO_ROOT,
        'public',
        'canon',
        'math',
        'level-1',
        'skip-counting.json',
      ),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, {
    extendedKinds: true,
  }).problems.filter(isSkipCountProblem)
}

/** A worst-case plan for the groups slot: 5-tall plates (factorA ≥ 5). */
const FIVE_TALL = [{ factorA: 9, factorB: 3 }]

interface Row {
  name: string
  v: Viewport
  form: 'P' | 'L' | 'TP' | 'TL'
  skipArea: [number, number]
  d: number
  multiplyArea: [number, number]
  block: number
  /** [row width, gap] for 9 × 3, 2 × 5, 10 × 5. */
  rows: [[number, number], [number, number], [number, number]]
  chip: number
}

// Spec § 6, "Sizes", row by row.
const TABLE: Row[] = [
  {
    name: '375×667',
    v: { width: 375, height: 667, insets: inset() },
    form: 'P',
    skipArea: [343, 272],
    d: 55,
    multiplyArea: [343, 272],
    block: 245,
    rows: [
      [216, 24],
      [256, 24],
      [340, 15],
    ],
    chip: 88,
  },
  {
    name: '390×844 (t47 b34)',
    v: { width: 390, height: 844, insets: inset({ top: 47, bottom: 34 }) },
    form: 'P',
    skipArea: [358, 347],
    d: 58,
    multiplyArea: [358, 347],
    block: 245,
    rows: [
      [216, 24],
      [256, 24],
      [356, 19],
    ],
    chip: 88,
  },
  {
    name: '411×914 (t24 b24)',
    v: { width: 411, height: 914, insets: inset({ top: 24, bottom: 24 }) },
    form: 'P',
    skipArea: [379, 427],
    d: 63,
    multiplyArea: [379, 427],
    block: 245,
    rows: [
      [216, 24],
      [256, 24],
      [376, 24],
    ],
    chip: 88,
  },
  {
    name: '667×375',
    v: { width: 667, height: 375, insets: inset() },
    form: 'L',
    skipArea: [371, 210],
    d: 61,
    multiplyArea: [371, 240],
    block: 212,
    rows: [
      [216, 24],
      [256, 24],
      [368, 22],
    ],
    chip: 104,
  },
  {
    name: '667×375 (b21)',
    v: { width: 667, height: 375, insets: inset({ bottom: 21 }) },
    form: 'L',
    skipArea: [376, 189],
    d: 60,
    multiplyArea: [376, 219],
    block: 212,
    rows: [
      [216, 24],
      [256, 24],
      [376, 24],
    ],
    chip: 99,
  },
  {
    name: '844×390 (l47 r47 b21)',
    v: {
      width: 844,
      height: 390,
      insets: inset({ left: 47, right: 47, bottom: 21 }),
    },
    form: 'L',
    skipArea: [434, 204],
    d: 64,
    multiplyArea: [434, 234],
    block: 212,
    rows: [
      [216, 24],
      [256, 24],
      [376, 24],
    ],
    chip: 104,
  },
  {
    name: '914×411 (l24 r24)',
    v: { width: 914, height: 411, insets: inset({ left: 24, right: 24 }) },
    form: 'L',
    skipArea: [530, 246],
    d: 64,
    multiplyArea: [530, 276],
    block: 212,
    rows: [
      [216, 24],
      [256, 24],
      [376, 24],
    ],
    chip: 104,
  },
  {
    name: '744×1133 (t24 b20)',
    v: { width: 744, height: 1133, insets: inset({ top: 24, bottom: 20 }) },
    form: 'TP',
    skipArea: [712, 530],
    d: 88,
    multiplyArea: [712, 530],
    block: 306,
    rows: [
      [274, 32],
      [328, 32],
      [478, 32],
    ],
    chip: 120,
  },
  {
    name: '1133×744 (t24 b20)',
    v: { width: 1133, height: 744, insets: inset({ top: 24, bottom: 20 }) },
    form: 'TL',
    skipArea: [892, 317],
    d: 88,
    multiplyArea: [892, 317],
    block: 306,
    rows: [
      [274, 32],
      [328, 32],
      [478, 32],
    ],
    chip: 120,
  },
]

const FORM = {
  P: 'phone-portrait',
  L: 'phone-landscape',
  TP: 'tablet-portrait',
  TL: 'tablet-landscape',
} as const

const area = (r: { width: number; height: number }) => [
  Math.round(r.width),
  Math.round(r.height),
]

describe.each(TABLE)('spec § 6 — $name', (row) => {
  const skip = extendedMathLayout(row.v, 'skip-count')
  const multiply = extendedMathLayout(row.v, 'multiply')

  it('form and chip size', () => {
    expect(skip.form).toBe(FORM[row.form])
    expect(skip.chips.size).toBe(row.chip)
    expect(multiply.chips.size).toBe(row.chip)
  })

  it('skip area and stone size D (canon: 8 terms + "?")', () => {
    expect(area(skip.problem)).toEqual(row.skipArea)
    expect(skipTrackMetrics(skip, skipCanon()).stone).toBe(row.d)
  })

  it('multiply area and the worst-case block (5-tall plates)', () => {
    expect(area(multiply.problem)).toEqual(row.multiplyArea)
    const block = multiplyBlockHeight(
      multiply,
      groupsMetrics(multiply, FIVE_TALL),
    )
    expect(block).toBe(row.block)
    expect(block).toBeLessThanOrEqual(multiply.problem.height)
  })

  it('plate rows for 9 × 3, 2 × 5 and 10 × 5', () => {
    const m = groupsMetrics(multiply, FIVE_TALL)
    const widths = (
      [
        [9, 3],
        [2, 5],
        [10, 5],
      ] as const
    ).map(([a, b]) => {
      const r = groupsRow(m, a, b, multiply.problem.width)
      return [r.width, r.gap]
    })
    expect(widths).toEqual(row.rows)
  })

  it('the skip track fits its area', () => {
    const m = skipTrackMetrics(skip, skipCanon())
    for (const p of skipCanon()) {
      const g = skipTrackGeometry(m, skipTrackCellCount(p.sequence.length))
      expect(g.width).toBeLessThanOrEqual(skip.problem.width)
      expect(g.height).toBeLessThanOrEqual(skip.problem.height)
    }
  })
})

describe('extendedMathLayout — frames', () => {
  const P = { width: 375, height: 667, insets: inset() }
  const L = { width: 667, height: 375, insets: inset() }

  it('arithmetic and number recognition: Math’s own layout, no ribbon cap', () => {
    for (const v of [P, L, TABLE[7]!.v]) {
      for (const kind of ['arithmetic', 'recognize'] as const) {
        expect(extendedMathLayout(v, kind)).toEqual({
          ...mathLayout(v),
          chipsAxis: 'row',
          ribbonLines: undefined,
        })
      }
    }
  })

  it('P: Math’s frame with a 4-line ribbon cap (ends at 253, above 259)', () => {
    const m = extendedMathLayout(P, 'multiply')
    expect(m).toEqual({ ...mathLayout(P), chipsAxis: 'row', ribbonLines: 4 })
    expect(m.ribbon.y + 4 * m.captionLineHeight + 20).toBe(253)
    expect(m.problem.y).toBe(259)
  })

  it('L: Word Song’s L frame — the chip column, 2 lines skip / 1 line multiply', () => {
    const ws = wordSongLayout(L)
    const skip = extendedMathLayout(L, 'skip-count')
    const multiply = extendedMathLayout(L, 'multiply')
    expect(skip.chipsAxis).toBe('column')
    expect(skip.ribbonLines).toBe(2)
    expect(multiply.ribbonLines).toBe(1)
    expect(skip.chips.rect).toEqual(ws.chips.rect)
    expect(skip.chips.gap).toBe(ws.chips.gap)
    expect(skip.problem).toEqual(ws.stage)
    expect(skip.ribbon).toEqual(ws.ribbon)
    expect(skip.hud).toEqual(ws.hud)
    expect(skip.emma).toEqual(mathLayout(L).emma)
    expect(multiply.problemGap).toBe(8)
  })

  it('tablet: Math’s frames unchanged, ribbon included', () => {
    const v = TABLE[8]!.v
    expect(extendedMathLayout(v, 'skip-count')).toEqual({
      ...mathLayout(v),
      chipsAxis: 'row',
      ribbonLines: undefined,
    })
  })
})

describe('skip track', () => {
  it('numerals: 28 pt at D = 55 (the floor)', () => {
    const m = skipTrackMetrics(
      extendedMathLayout(TABLE[0]!.v, 'skip-count'),
      skipCanon(),
    )
    expect(m.numeralFont).toBe(28)
  })

  it('a numeral too wide for D − 12 steps down 2 pt at a time', () => {
    // 9 cells in a 250 pt rect: D = 37; "100" at round(37 / 2) = 19 pt is
    // 28.7 pt > 25, at 17 pt 25.7 > 25, at 15 pt 22.6: fits.
    const layout = {
      tablet: false,
      problem: { x: 0, y: 0, width: 250, height: 272 },
    }
    const m = skipTrackMetrics(layout, [
      { sequence: [20, 30, 40, 50, 60, 70, 80, 90], correct: 100 },
    ])
    expect(m.stone).toBe(37)
    expect(m.numeralFont).toBe(15)
    expect(fredokaBoldWidth('100', 15)).toBeLessThanOrEqual(25)
    expect(fredokaBoldWidth('100', 17)).toBeGreaterThan(25)
  })

  it('5 cells take one row; 6–9 take two balanced rows, row 2 indented (D + G) / 2', () => {
    const m = skipTrackMetrics(
      extendedMathLayout(TABLE[0]!.v, 'skip-count'),
      skipCanon(),
    )
    const five = skipTrackGeometry(m, 5)
    expect(new Set(five.cells.map((c) => c.row))).toEqual(new Set([0]))
    const nine = skipTrackGeometry(m, 9)
    expect(nine.cells.filter((c) => c.row === 0)).toHaveLength(5)
    expect(nine.cells.filter((c) => c.row === 1)).toHaveLength(4)
    expect(nine.cells[5]!.x).toBe((m.stone + m.gap) / 2)
    const six = skipTrackGeometry(m, 6)
    expect(six.cells.filter((c) => c.row === 0)).toHaveLength(3)
  })
})

describe('number strip (spec § 10)', () => {
  it.each([
    ['P floor 375×667', TABLE[0]!.v, 34, 48, 22],
    ['L 667×375 (Math’s 491 pt pane)', TABLE[3]!.v, 48, 48, 22],
    ['tablet portrait', TABLE[7]!.v, 71, 64, 32],
    ['tablet landscape', TABLE[8]!.v, 72, 64, 32],
  ] as const)('%s', (_n, v, cell, height, font) => {
    const m = numberStripMetrics(extendedMathLayout(v, 'recognize'))
    expect([m.cell, m.height, m.font]).toEqual([cell, height, font])
  })
})
