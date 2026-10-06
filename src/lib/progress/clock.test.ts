import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_DAY_OFFSET,
  dayOffset,
  localDateKey,
  now,
  nowMs,
  todayKey,
} from './clock'
import { loadProgress } from './storage'
import {
  readSessionHistory,
  recordSessionEnd,
} from '../../screens/SessionEnd/sessionHistory'
import { recordProgressOnSessionEnd } from '../../screens/SessionEnd/progressHistory'

function setSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, search },
  })
}

// Local-time noon, so the expected keys hold in any runner timezone.
const REAL_NOW = new Date(2026, 9, 6, 12, 0, 0)

describe('progress clock — ?debug=1&dayOffset=N', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(REAL_NOW)
    setSearch('')
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    setSearch('')
  })

  it('is plain wall-clock time with no query string', () => {
    expect(dayOffset()).toBe(0)
    expect(now().getTime()).toBe(REAL_NOW.getTime())
    expect(nowMs()).toBe(REAL_NOW.getTime())
    expect(todayKey()).toBe('2026-10-06')
  })

  it.each([
    [0, '2026-10-06'],
    [1, '2026-10-07'],
    [2, '2026-10-08'],
  ])('dayOffset=%i shifts today to %s', (offset, key) => {
    setSearch(`?debug=1&dayOffset=${offset}`)
    expect(dayOffset()).toBe(offset)
    expect(todayKey()).toBe(key)
    // Same wall-clock time of day, N calendar days later.
    const shifted = now()
    expect(shifted.getHours()).toBe(12)
    expect(shifted.getDate()).toBe(6 + offset)
  })

  it('accepts the upper bound and crosses month boundaries', () => {
    setSearch(`?debug=1&dayOffset=${MAX_DAY_OFFSET}`)
    expect(dayOffset()).toBe(60)
    expect(todayKey()).toBe('2026-12-05')
  })

  it.each(['-1', '61', '1.5', 'abc', '', ' 1', '1e1', '0x2', '+1'])(
    'ignores invalid dayOffset=%j',
    (raw) => {
      setSearch(`?debug=1&dayOffset=${encodeURIComponent(raw)}`)
      expect(dayOffset()).toBe(0)
      expect(todayKey()).toBe('2026-10-06')
    },
  )

  it.each(['?dayOffset=2', '?debug=0&dayOffset=2', '?debug=true&dayOffset=2'])(
    'has no effect when the debug gate is off (%s)',
    (search) => {
      setSearch(search)
      expect(dayOffset()).toBe(0)
      expect(now().getTime()).toBe(REAL_NOW.getTime())
      expect(todayKey()).toBe('2026-10-06')
    },
  )

  it('persists nothing about the offset', () => {
    setSearch('?debug=1&dayOffset=2')
    now()
    todayKey()
    expect(window.localStorage.length).toBe(0)
  })

  it('localDateKey zero-pads local month and day', () => {
    expect(localDateKey(new Date(2026, 0, 3, 23, 59))).toBe('2026-01-03')
  })
})

describe('progress clock drives the day-keyed progress writes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(REAL_NOW)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    setSearch('')
  })

  it('day streak counts offsets 0, 1, 2 as three consecutive days', () => {
    for (const offset of [0, 1, 2]) {
      setSearch(`?debug=1&dayOffset=${offset}`)
      recordSessionEnd(5)
    }
    const history = readSessionHistory()
    expect(history.dayStreak).toBe(3)
    expect(history.todayTreesTouched.date).toBe('2026-10-08')
    expect(new Date(history.lastSessionCompletedAt).getDate()).toBe(8)
  })

  it('without the gate, three same-day sessions stay a streak of 1', () => {
    for (let i = 0; i < 3; i++) {
      setSearch('?dayOffset=2')
      recordSessionEnd(5)
    }
    expect(readSessionHistory().dayStreak).toBe(1)
  })

  it('good-day rule sees three distinct days across offsets 0, 1, 2', () => {
    for (const offset of [0, 1, 2]) {
      setSearch(`?debug=1&dayOffset=${offset}`)
      recordProgressOnSessionEnd({
        surface: 'math',
        totalCorrect: 8,
        dateISO: now().toISOString(),
        focusNode: 'add-to-20',
      })
    }
    const progress = loadProgress()
    expect(progress?.goodDays?.['add-to-20']).toHaveLength(3)
  })
})
