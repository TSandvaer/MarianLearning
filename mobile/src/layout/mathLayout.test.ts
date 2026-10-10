import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import type { MathProblem } from '@marian/core/math/sessionPlans'
import { REPO_ROOT } from '../../test/webSource'
import type { Rect, Viewport } from './layout'
import {
  countingMetrics,
  mathLayout,
  PHONE_CHIP_GAP_MIN,
  PHONE_CHIP_MIN,
  type MathLayout,
} from './mathLayout'

const insets = (top = 0, bottom = 0, left = 0, right = 0) => ({
  top,
  bottom,
  left,
  right,
})

const PHONES: Record<string, Viewport> = {
  'floor portrait 375×667': { width: 375, height: 667, insets: insets() },
  'floor landscape 667×375': { width: 667, height: 375, insets: insets() },
  'floor landscape + 21 pt home indicator': {
    width: 667,
    height: 375,
    insets: insets(0, 21),
  },
  'iPhone 17e portrait': {
    width: 390,
    height: 844,
    insets: insets(47, 34),
  },
  'iPhone 17e landscape': {
    width: 844,
    height: 390,
    insets: insets(0, 21, 47, 47),
  },
  'Android 411×914 portrait': {
    width: 411,
    height: 914,
    insets: insets(24, 24),
  },
  'Android 914×411 landscape': {
    width: 914,
    height: 411,
    insets: insets(0, 0, 24, 24),
  },
}

const TABLETS: Record<string, Viewport> = {
  'iPad mini portrait': { width: 744, height: 1133, insets: insets(24, 20) },
  'iPad mini landscape': { width: 1133, height: 744, insets: insets(24, 20) },
  'iPad 820×1180 portrait': {
    width: 820,
    height: 1180,
    insets: insets(24, 20),
  },
}

const bottom = (r: Rect) => r.y + r.height
const right = (r: Rect) => r.x + r.width
const overlaps = (a: Rect, b: Rect) =>
  a.x < right(b) && b.x < right(a) && a.y < bottom(b) && b.y < bottom(a)

function ribbonRect(l: MathLayout): Rect {
  return {
    x: l.ribbon.x,
    y: l.ribbon.y,
    width: l.ribbon.width,
    height: l.ribbon.maxHeight,
  }
}

function chipRects(l: MathLayout): Rect[] {
  const { rect, size, gap } = l.chips
  const total = 3 * size + 2 * gap
  const x0 = rect.x + (rect.width - total) / 2
  return [0, 1, 2].map((i) => ({
    x: x0 + i * (size + gap),
    y: rect.y,
    width: size,
    height: size,
  }))
}

describe.each(Object.entries(PHONES))('phone %s', (_name, v) => {
  const l = mathLayout(v)
  const s = l.safe

  it('targets never shrink below the spec: chips ≥ 72 with ≥ 16 pt gaps, back 56', () => {
    expect(l.chips.size).toBeGreaterThanOrEqual(PHONE_CHIP_MIN)
    expect(l.chips.size).toBeLessThanOrEqual(88)
    expect(l.chips.gap).toBeGreaterThanOrEqual(PHONE_CHIP_GAP_MIN)
    if (l.hud.kind !== 'split') throw new Error('phone HUD is split')
    expect(l.hud.back.width).toBe(56)
    expect(l.hud.back.height).toBe(56)
  })

  it('every target is inside the safe area', () => {
    if (l.hud.kind !== 'split') throw new Error('phone HUD is split')
    for (const r of [l.hud.back, ...chipRects(l)]) {
      expect(r.x).toBeGreaterThanOrEqual(s.x)
      expect(r.y).toBeGreaterThanOrEqual(s.y)
      expect(right(r)).toBeLessThanOrEqual(right(s) + 0.001)
      expect(bottom(r)).toBeLessThanOrEqual(bottom(s) + 0.001)
    }
  })

  it('nothing overlaps the ribbon, and the problem block fits above the chips', () => {
    if (l.hud.kind !== 'split') throw new Error('phone HUD is split')
    const ribbon = ribbonRect(l)
    for (const r of [l.hud.back, l.hud.beads, l.problem, ...chipRects(l)]) {
      if (l.form === 'phone-portrait' && r === l.hud.beads) continue
      expect(overlaps(ribbon, r)).toBe(false)
    }
    // Portrait: the beads row is above the ribbon.
    expect(l.ribbon.y).toBeGreaterThanOrEqual(bottom(l.hud.beads))
    expect(l.problem.height).toBeGreaterThanOrEqual(
      l.equationLineHeight + l.problemGap + (l.visualSlot ?? 0) - 0.001,
    )
    expect(bottom(l.problem)).toBeLessThanOrEqual(l.chips.rect.y)
    // The back disc keeps ≥ 16 pt to every other target.
    for (const c of chipRects(l))
      expect(c.y - bottom(l.hud.back)).toBeGreaterThanOrEqual(16)
  })

  it('reserves a 2-line caption slot at 22 pt (a wrap never reaches the equation)', () => {
    expect(l.captionFontSize).toBe(22)
    expect(l.ribbon.maxHeight).toBeGreaterThanOrEqual(2 * 22 * 1.375 + 20)
    expect(l.ribbon.width).toBeGreaterThan(200)
  })
})

it('phone portrait: Emma is 22 % of the safe height (≥ 120), chips 88, 32 pt above the safe bottom', () => {
  const l = mathLayout(PHONES['floor portrait 375×667'])
  expect(l.emma.height).toBe(Math.round(667 * 0.22))
  expect(l.chips.size).toBe(88)
  expect(bottom(l.chips.rect)).toBe(667 - 32)
  expect(l.equationFont).toBe(72)
  expect(l.ribbon.maxHeight).toBeGreaterThanOrEqual(2 * 22 * 1.375 + 20)
})

it('phone landscape floor: a 2-line ribbon slot, 56 pt numerals, 72 pt chips, all in 375 pt', () => {
  const l = mathLayout(PHONES['floor landscape 667×375'])
  expect(l.ribbon.maxHeight).toBeGreaterThanOrEqual(2 * 22 * 1.375 + 20)
  expect(l.equationFont).toBe(56)
  expect(l.chips.size).toBe(72)
  expect(bottom(l.chips.rect)).toBeLessThanOrEqual(375)
  // Emma's column: clamp(120, 24 % of 667, 200) = 160; the pane starts after it.
  expect(l.ribbon.x).toBe(160)
})

describe.each(Object.entries(TABLETS))('tablet %s (web layout)', (_name, v) => {
  const l = mathLayout(v)
  it('web numbers: 96 pt HUD row, Emma at 26vh, 120 pt chips 32 apart, 32 pt above the safe bottom', () => {
    expect(l.hud.kind).toBe('row')
    if (l.hud.kind !== 'row') return
    expect(l.hud.rect.height).toBe(96)
    expect(l.emma.height).toBeCloseTo(v.height * 0.26)
    expect(l.emma.y).toBe(l.safe.y + 96)
    expect(l.chips.size).toBe(120)
    expect(l.chips.gap).toBe(32)
    expect(bottom(l.chips.rect)).toBe(bottom(l.safe) - 32)
    expect(l.captionFontSize).toBe(25.6)
    expect(l.equationFont).toBe(96)
    expect(l.chips.font).toBe(52)
  })
  it('the ribbon starts right of Emma and never overlaps the problem', () => {
    expect(l.ribbon.x).toBeGreaterThanOrEqual(right(l.emma))
    expect(overlaps(ribbonRect(l), l.problem)).toBe(false)
  })
})

describe('counting row', () => {
  const phone = { counting: 'phone' as const }

  it('phone: 24 pt counters up to a total of 10, on one row at the 343 pt floor', () => {
    for (const [a, b] of [
      [5, 5],
      [9, 1],
      [6, 4],
    ]) {
      const m = countingMetrics(phone, a, b, 343)!
      expect(m.size).toBe(24)
      expect(m.perRow).toBe(Infinity)
      expect(m.height).toBe(24)
    }
  })

  it('phone: above 10 the counters are 20 pt and a group that does not fit wraps into rows of 5', () => {
    const m = countingMetrics(phone, 9, 9, 343)!
    expect(m.size).toBe(20)
    expect(m.perRow).toBe(5)
    expect(m.height).toBe(2 * 20 + 8)
    const width = 2 * (5 * 20 + 4 * 8) + 24
    expect(width).toBeLessThanOrEqual(343)
  })

  it('tablet: the web flower row (3.2 rem to a total of 10, 2.0 rem from 18), no wrap', () => {
    const tablet = { counting: 'tablet' as const }
    expect(countingMetrics(tablet, 3, 4, 700)!.size).toBeCloseTo(51.2)
    expect(countingMetrics(tablet, 9, 9, 700)!.size).toBeCloseTo(32)
    expect(countingMetrics(tablet, 9, 9, 700)!.perRow).toBe(Infinity)
  })
})

/** Every addition in the live canon that Math can read (`public/canon/math`). */
function canonAdditions(): { tier: string; problem: MathProblem }[] {
  const dir = resolve(REPO_ROOT, 'public', 'canon', 'math', 'level-1')
  const out: { tier: string; problem: MathProblem }[] = []
  for (const file of readdirSync(dir)) {
    const json = JSON.parse(readFileSync(resolve(dir, file), 'utf8'))
    let problems: readonly MathProblem[]
    try {
      problems = mathSessionPlanFromServer(json.plan).problems
    } catch {
      continue // not a +/− tier (counting, times tables): not Math's read
    }
    for (const problem of problems) {
      if (problem.op === '+') out.push({ tier: file, problem })
    }
  }
  return out
}

describe('counting row vs the live canon (two-digit addends)', () => {
  const additions = canonAdditions()

  it('the canon has two-digit additions (the case this guards)', () => {
    const twoDigit = additions.filter(
      ({ problem }) => problem.addendA > 9 || problem.addendB > 9,
    )
    expect(twoDigit.length).toBeGreaterThan(0)
    expect(twoDigit.map(({ tier }) => tier)).toContain(
      'two-digit-addsub-with-regroup.json',
    )
  })

  it.each([...Object.entries(PHONES), ...Object.entries(TABLETS)])(
    '%s: every canon addition fits its counting slot, or has none',
    (_n, v) => {
      const l = mathLayout(v)
      for (const { tier, problem } of additions) {
        const { addendA: a, addendB: b } = problem
        const m = countingMetrics(l, a, b, l.problem.width)
        if (a > 9 || b > 9) {
          expect({ tier, a, b, m }).toEqual({ tier, a, b, m: null })
          continue
        }
        expect(m).not.toBeNull()
        // The web's tablet row is centred and may run into the area's px-4
        // padding (9 + 8 on a 744 pt iPad mini: ~713 of 712); a phone row
        // stays inside the area.
        const room = l.tablet ? l.problem.width + 32 : l.problem.width
        expect(m!.width).toBeLessThanOrEqual(room)
        if (l.visualSlot !== null) {
          expect(m!.height).toBeLessThanOrEqual(l.visualSlot)
          expect(m!.size).toBeGreaterThanOrEqual(20) // spec § 4: never below 20
        }
      }
    },
  )

  it('every single-digit sum (1..9 + 1..9) fits at the 375×667 floor, both orientations', () => {
    for (const v of [
      PHONES['floor portrait 375×667'],
      PHONES['floor landscape 667×375'],
    ]) {
      const l = mathLayout(v)
      for (let a = 1; a <= 9; a++) {
        for (let b = 1; b <= 9; b++) {
          const m = countingMetrics(l, a, b, l.problem.width)!
          expect(m.width).toBeLessThanOrEqual(l.problem.width)
          expect(m.height).toBeLessThanOrEqual(l.visualSlot!)
        }
      }
    }
  })
})
