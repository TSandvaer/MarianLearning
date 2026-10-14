/**
 * Leitner due dates across the autumn DST change (native spec
 * `design/native/review-mode-and-warmup-native.md` § 7.7).
 *
 * The runtime timezone is pinned at module load, before any `Date` is
 * built (the same pattern as `mastery.test.ts`'s Manila pin): in
 * Europe/Copenhagen, Sunday 2026-10-25 is 25 hours long (UTC+2 → UTC+1),
 * which an elapsed-hours rule would get wrong at the day's edges.
 */
process.env.TZ = 'Europe/Copenhagen'

import { describe, expect, it } from 'vitest'
import { dayDiff, localDateKey } from './clock'
import { dueLeitnerItems, leitnerOverdueDays } from './leitner'
import type { LeitnerBox, MathFact } from './types'

const box2 = (lastSeen: number): LeitnerBox<MathFact> => ({
  items: [{ item: { a: 2, b: 4, op: '+' }, box: 2, lastSeen }],
})

describe('Leitner due dates in local calendar days (Europe/Copenhagen)', () => {
  it('the pinned zone really changes its UTC offset on 2026-10-25', () => {
    const sat = new Date(2026, 9, 24, 20, 0)
    const sunEvening = new Date(2026, 9, 25, 20, 0)
    expect(sat.getTimezoneOffset()).toBe(-120)
    expect(sunEvening.getTimezoneOffset()).toBe(-60)
  })

  it('box 2 promoted Saturday 2026-10-24 20:00 is due on Sunday 2026-10-25', () => {
    const promoted = new Date(2026, 9, 24, 20, 0).getTime()
    // The first minute of Sunday, and its last.
    const sunStart = new Date(2026, 9, 25, 0, 0).getTime()
    const sunEnd = new Date(2026, 9, 25, 23, 59).getTime()
    const satLate = new Date(2026, 9, 24, 23, 59).getTime()
    expect(dueLeitnerItems(box2(promoted), satLate).items).toHaveLength(0)
    expect(dueLeitnerItems(box2(promoted), sunStart).items).toHaveLength(1)
    expect(dueLeitnerItems(box2(promoted), sunEnd).items).toHaveLength(1)
    expect(leitnerOverdueDays(box2(promoted).items[0]!, sunEnd)).toBe(0)
  })

  it('dayDiff counts the 25-hour day as one day', () => {
    expect(
      dayDiff(
        localDateKey(new Date(2026, 9, 25, 0, 0)),
        localDateKey(new Date(2026, 9, 26, 0, 0)),
      ),
    ).toBe(1)
    expect(dayDiff('2026-10-24', '2026-10-27')).toBe(3)
    expect(dayDiff('2026-10-27', '2026-10-24')).toBe(-3)
    expect(Number.isNaN(dayDiff('not-a-day', '2026-10-24'))).toBe(true)
  })
})
