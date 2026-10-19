/**
 * More and less's layout (`design/native/content-wave-4.md` § 2.2, § 2.3,
 * § 2.5, AC 10, AC 11) for the committed canon (largest counts shown: 7
 * flats, 6 rods, 8 cubes, hundreds' maxima):
 *
 * - § 3.3 of wave 3 stands: the same u, tray widths and heights on all four
 *   forms as hundreds.
 * - The number tag's pill names the change: "+200", "+30", "−200", "−30"
 *   (U+2212, a glyph of Fredoka Bold itself, so it draws at the "+"'s size
 *   and weight, D4).
 * - The change blocks: added on top of the start's (more), or the start's
 *   last-placed ones (less), which leave first; 90 ms apart (§ 2.5).
 *
 * Failing-first: written before the change geometry existed.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isHundredsProblem,
  type HundredsProblem,
  type MoreProblem,
} from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { fontMeasure } from '../../test/fontAdvances'
import { REPO_ROOT } from '../../test/webSource'
import type { Viewport } from './layout'
import {
  extendedMathLayout,
  fredokaBoldWidth,
  morePillLabel,
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

function canon(stem: string): HundredsProblem[] {
  const json = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1', `${stem}.json`),
      'utf8',
    ),
  ) as { plan: unknown }
  return mathSessionPlanFromServer(json.plan, {
    extendedKinds: true,
  }).problems.filter(isHundredsProblem)
}

const CANON = canon('hundreds-addsub') as MoreProblem[]
const HUNDREDS = canon('hundreds')

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

const FREDOKA_700 = resolve(
  __dirname,
  '..',
  '..',
  'node_modules/@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf',
)

describe('the canon plan (§ 2.3)', () => {
  it("has 8 more problems; largest counts 7 flats, 6 rods, 8 cubes (hundreds' maxima)", () => {
    expect(CANON).toHaveLength(8)
    const m = placeValueMetrics(extendedMathLayout(FORMS[0]![1], 'more'), CANON)
    expect([m.maxFlats, m.maxRods, m.maxCubes]).toEqual([7, 6, 8])
  })

  it.each(FORMS)("%s: hundreds' u, tray widths and heights stand", (_n, v) => {
    const layout = extendedMathLayout(v, 'more')
    const m = placeValueMetrics(layout, CANON)
    const h = placeValueMetrics(layout, HUNDREDS)
    expect(m.u).toBe(h.u)
    expect(m.trayWidths).toEqual(h.trayWidths)
    expect(m.block.height).toBe(h.block.height)
    expect(m.block.width).toBeLessThanOrEqual(layout.problem.width)
    expect(m.block.height).toBeLessThanOrEqual(layout.problem.height)
  })
})

describe('the pill names the change (§ 2.2, D4)', () => {
  it('"+200", "+30", "+300", "+30", "+400", "−200", "−30", "−40"', () => {
    expect(CANON.map(morePillLabel)).toEqual([
      '+200',
      '+30',
      '+300',
      '+30',
      '+400',
      '−200',
      '−30',
      '−40',
    ])
    // Hundreds keeps "+10" / "+100".
    expect(
      HUNDREDS.filter((p): p is MoreProblem => p.kind === 'more').map(
        morePillLabel,
      ),
    ).toEqual(['+10', '+100', '+10'])
  })

  it('"−" is a Fredoka Bold glyph (no fallback face), measured at its own advance', () => {
    const measure = fontMeasure(FREDOKA_700)
    expect(measure('−', 1)).toBeCloseTo(0.54, 3)
    expect(fredokaBoldWidth('−', 1)).toBeCloseTo(measure('−', 1), 3)
    expect(fredokaBoldWidth('+', 1)).toBeCloseTo(measure('+', 1), 3)
  })
})

describe('the change blocks (§ 2.5)', () => {
  const layout = extendedMathLayout(FORMS[0]![1], 'more')
  const m = placeValueMetrics(layout, CANON)
  const width = layout.problem.width

  it('P1 (235 + 200): two flats drop on top of the fan, 90 ms apart; no single added block', () => {
    const g = placeValueGeometry(m, CANON[0]!, width)
    expect(g.flats).toHaveLength(2)
    expect(g.added).toBeNull()
    expect(g.change).toMatchObject({ place: 'hundreds', direction: 'more' })
    const blocks = g.change!.blocks
    expect(blocks.map((b) => b.index)).toEqual([2, 3])
    expect(blocks.map((b) => b.delay)).toEqual([0, 90])
    expect(blocks[0]!.rect.x - g.flats[1]!.x).toBeCloseTo(1.2 * m.u)
    expect(blocks[1]!.rect.x - blocks[0]!.rect.x).toBeCloseTo(1.2 * m.u)
  })

  it('P2 (324 + 30): three rods after the start’s two', () => {
    const g = placeValueGeometry(m, CANON[1]!, width)
    expect(g.rods).toHaveLength(2)
    expect(g.change!.place).toBe('tens')
    expect(g.change!.blocks.map((b) => b.index)).toEqual([2, 3, 4])
    expect(g.change!.blocks[0]!.rect.x - g.rods[1]!.x).toBeCloseTo(1.3 * m.u)
  })

  it('P6 (653 − 200): the top two flats of six leave, the top first', () => {
    const g = placeValueGeometry(m, CANON[5]!, width)
    expect(g.flats).toHaveLength(6)
    expect(g.change).toMatchObject({ place: 'hundreds', direction: 'less' })
    expect(g.change!.blocks.map((b) => [b.index, b.delay])).toEqual([
      [5, 0],
      [4, 90],
    ])
    // A leaving block is the start's own (nothing reflows).
    expect(g.change!.blocks[0]!.rect).toEqual(g.flats[5])
  })

  it('P7 (765 − 30) and P8 (368 − 40): the rightmost rods leave first', () => {
    const g7 = placeValueGeometry(m, CANON[6]!, width)
    expect(g7.change!.blocks.map((b) => [b.index, b.delay])).toEqual([
      [5, 0],
      [4, 90],
      [3, 180],
    ])
    const g8 = placeValueGeometry(m, CANON[7]!, width)
    expect(g8.change!.blocks.map((b) => b.index)).toEqual([5, 4, 3, 2])
  })

  it('a block lifts 24 pt on a phone, 32 on a tablet', () => {
    expect(m.liftRise).toBe(24)
    const t = extendedMathLayout(FORMS[2]![1], 'more')
    expect(placeValueMetrics(t, CANON).liftRise).toBe(32)
  })

  it("hundreds' P6–P8 keep their single added block and no change", () => {
    const h = placeValueMetrics(layout, HUNDREDS)
    const g = placeValueGeometry(h, HUNDREDS[5]!, width)
    expect(g.added?.place).toBe('tens')
    expect(g.change).toBeNull()
  })
})
