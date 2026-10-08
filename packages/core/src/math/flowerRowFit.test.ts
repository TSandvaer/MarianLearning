import { describe, expect, it } from 'vitest'
import { flowerRowFontSizeRem } from './flowerRowFit'

/**
 * Visual-fit invariant for the Math screen's flower row.
 *
 * Pins the linear-scale contract that solves the add-to-20 tier overflow
 * Thomas observed on iPad portrait (2026-05-09 — `7+7=14` cramped,
 * `9+9=18` clipping). Keeping the helper pure + tested in isolation
 * makes future tier additions (e.g. add-to-30, sub-to-20) easy to scope
 * — change one slope or one anchor, the screen test in Math.test.tsx
 * confirms the wiring still threads through.
 */
describe('flowerRowFontSizeRem', () => {
  it('keeps add-to-10 plans at the historical 3.2rem (no regression)', () => {
    expect(flowerRowFontSizeRem(5, 5)).toBe(3.2) // total = 10, the cap
    expect(flowerRowFontSizeRem(3, 2)).toBe(3.2)
    expect(flowerRowFontSizeRem(1, 4)).toBe(3.2)
    expect(flowerRowFontSizeRem(1, 1)).toBe(3.2)
  })

  it('linearly scales between (total=10, 3.2rem) and (total=18, 2.0rem)', () => {
    // Slope = (3.2 - 2.0) / (18 - 10) = 0.15 rem per added flower.
    expect(flowerRowFontSizeRem(6, 5)).toBeCloseTo(3.05, 5) // total = 11
    expect(flowerRowFontSizeRem(6, 6)).toBeCloseTo(2.9, 5) // total = 12
    expect(flowerRowFontSizeRem(7, 6)).toBeCloseTo(2.75, 5) // total = 13
    expect(flowerRowFontSizeRem(7, 7)).toBeCloseTo(2.6, 5) // total = 14 (Thomas's "cramped")
    expect(flowerRowFontSizeRem(8, 7)).toBeCloseTo(2.45, 5) // total = 15
    expect(flowerRowFontSizeRem(8, 8)).toBeCloseTo(2.3, 5) // total = 16
    expect(flowerRowFontSizeRem(9, 8)).toBeCloseTo(2.15, 5) // total = 17
  })

  it("floors at 2.0rem on the worst case (9+9=18, Thomas's clipping signal)", () => {
    expect(flowerRowFontSizeRem(9, 9)).toBe(2.0)
  })

  it('is commutative — addend order does not matter', () => {
    expect(flowerRowFontSizeRem(7, 6)).toBe(flowerRowFontSizeRem(6, 7))
    expect(flowerRowFontSizeRem(9, 4)).toBe(flowerRowFontSizeRem(4, 9))
  })

  it('is monotonically non-increasing in total over the full addend grid', () => {
    // Sweep [1..9] × [1..9] (covers add-to-10 + add-to-20 surfaces).
    // Sort by total flower count and confirm the helper output never
    // grows — guards against future formula tweaks that introduce a dip.
    const pairs: Array<{ total: number; rem: number }> = []
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= 9; b++) {
        pairs.push({ total: a + b, rem: flowerRowFontSizeRem(a, b) })
      }
    }
    pairs.sort((x, y) => x.total - y.total)
    expect(pairs.length).toBe(81)
    for (let i = 1; i < pairs.length; i++) {
      expect(pairs[i]!.rem).toBeLessThanOrEqual(pairs[i - 1]!.rem)
    }
  })
})
