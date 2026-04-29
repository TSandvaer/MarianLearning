import { describe, expect, it, beforeEach } from 'vitest'
import type { StorageAdapter } from '../Math/stardust'
import { STARDUST_STORAGE_KEY, STARDUST_SCHEMA_VERSION } from '../Math/stardust'
import {
  readSessionHistory,
  writeSessionHistory,
  recordSessionEnd,
  emptySessionHistory,
  migrateV1toV2,
  nextDayStreak,
  differenceInCalendarDays,
  isoDate,
  markTreeTouched,
  readSessionHistoryForToday,
  SESSION_HISTORY_KEY,
  SESSION_HISTORY_SCHEMA_VERSION,
  _resetSessionHistoryWarn,
} from './sessionHistory'
import type { SessionHistoryV1, SessionHistoryV2 } from './sessionHistory'

/** Minimal in-memory storage adapter for tests. */
function createMemoryStorage(): StorageAdapter & {
  store: Map<string, string>
} {
  const store = new Map<string, string>()
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
  }
}

/** A complete v1 payload for migration tests. */
function makeV1Fixture(
  overrides: Partial<SessionHistoryV1> = {},
): SessionHistoryV1 {
  return {
    schemaVersion: 1,
    sessionCount: 3,
    lastSessionCompletedAt: '2026-04-27T10:00:00.000Z',
    longestStreakEver: 5,
    cumulativeStardust: 30,
    ...overrides,
  }
}

describe('sessionHistory', () => {
  beforeEach(() => {
    _resetSessionHistoryWarn()
  })

  describe('emptySessionHistory', () => {
    it('returns the v2 zero-state shape', () => {
      const empty = emptySessionHistory()
      expect(empty).toEqual({
        schemaVersion: SESSION_HISTORY_SCHEMA_VERSION,
        sessionCount: 0,
        lastSessionCompletedAt: '',
        longestStreakEver: 0,
        cumulativeStardust: 0,
        lastSessionStardust: 0,
        dayStreak: 0,
        todayTreesTouched: { date: '', trees: [] },
        lastSuggestion: null,
        consecutiveOverrides: 0,
        suggestionCooldownUntil: null,
      })
    })

    it('schemaVersion is 2', () => {
      expect(SESSION_HISTORY_SCHEMA_VERSION).toBe(2)
      expect(emptySessionHistory().schemaVersion).toBe(2)
    })
  })

  describe('readSessionHistory', () => {
    it('returns empty state when key is absent', () => {
      const adapter = createMemoryStorage()
      expect(readSessionHistory(adapter)).toEqual(emptySessionHistory())
    })

    it('returns empty state when stored value is malformed JSON', () => {
      const adapter = createMemoryStorage()
      adapter.setItem(SESSION_HISTORY_KEY, 'not-json')
      expect(readSessionHistory(adapter)).toEqual(emptySessionHistory())
    })

    it('returns empty state when stored value has unknown schema version', () => {
      const adapter = createMemoryStorage()
      adapter.setItem(
        SESSION_HISTORY_KEY,
        JSON.stringify({
          schemaVersion: 99,
          sessionCount: 5,
          lastSessionCompletedAt: '2026-04-27T00:00:00.000Z',
          longestStreakEver: 8,
          cumulativeStardust: 42,
        }),
      )
      expect(readSessionHistory(adapter)).toEqual(emptySessionHistory())
    })

    it('returns empty state when v2 stored value is missing required fields', () => {
      const adapter = createMemoryStorage()
      adapter.setItem(
        SESSION_HISTORY_KEY,
        JSON.stringify({ schemaVersion: 2, sessionCount: 5 }),
      )
      expect(readSessionHistory(adapter)).toEqual(emptySessionHistory())
    })

    it('reads a valid v2 stored history', () => {
      const adapter = createMemoryStorage()
      const stored: SessionHistoryV2 = {
        schemaVersion: 2,
        sessionCount: 3,
        lastSessionCompletedAt: '2026-04-27T10:00:00.000Z',
        longestStreakEver: 5,
        cumulativeStardust: 30,
        lastSessionStardust: 4,
        dayStreak: 2,
        todayTreesTouched: {
          date: '2026-04-29',
          trees: ['number-garden'],
        },
        lastSuggestion: 'word-song',
        consecutiveOverrides: 1,
        suggestionCooldownUntil: null,
      }
      adapter.setItem(SESSION_HISTORY_KEY, JSON.stringify(stored))
      expect(readSessionHistory(adapter)).toEqual(stored)
    })

    it('promotes a v1 payload to v2 in-memory with defaults', () => {
      const adapter = createMemoryStorage()
      const v1 = makeV1Fixture()
      adapter.setItem(SESSION_HISTORY_KEY, JSON.stringify(v1))

      const got = readSessionHistory(adapter)

      expect(got.schemaVersion).toBe(2)
      expect(got.sessionCount).toBe(v1.sessionCount)
      expect(got.lastSessionCompletedAt).toBe(v1.lastSessionCompletedAt)
      expect(got.longestStreakEver).toBe(v1.longestStreakEver)
      expect(got.cumulativeStardust).toBe(v1.cumulativeStardust)
      expect(got.lastSessionStardust).toBe(0)
      expect(got.dayStreak).toBe(0)
      expect(got.todayTreesTouched).toEqual({ date: '', trees: [] })
      expect(got.lastSuggestion).toBeNull()
      expect(got.consecutiveOverrides).toBe(0)
      expect(got.suggestionCooldownUntil).toBeNull()
    })

    it('does NOT mutate v1 storage just by reading (lazy migration)', () => {
      const adapter = createMemoryStorage()
      const v1 = makeV1Fixture()
      adapter.setItem(SESSION_HISTORY_KEY, JSON.stringify(v1))

      readSessionHistory(adapter)

      // Storage still holds the original v1 payload — write happens
      // on the next writeSessionHistory call, not on read.
      const onDisk = JSON.parse(adapter.store.get(SESSION_HISTORY_KEY)!)
      expect(onDisk).toEqual(v1)
    })

    it('rejects an invalid v1 payload (missing required field)', () => {
      const adapter = createMemoryStorage()
      adapter.setItem(
        SESSION_HISTORY_KEY,
        JSON.stringify({ schemaVersion: 1, sessionCount: 5 }),
      )
      expect(readSessionHistory(adapter)).toEqual(emptySessionHistory())
    })

    it('rejects a v2 payload with malformed todayTreesTouched', () => {
      const adapter = createMemoryStorage()
      adapter.setItem(
        SESSION_HISTORY_KEY,
        JSON.stringify({
          schemaVersion: 2,
          sessionCount: 1,
          lastSessionCompletedAt: '2026-04-29T00:00:00.000Z',
          longestStreakEver: 1,
          cumulativeStardust: 5,
          lastSessionStardust: 5,
          dayStreak: 1,
          todayTreesTouched: { date: '2026-04-29', trees: ['unknown'] },
          lastSuggestion: null,
          consecutiveOverrides: 0,
          suggestionCooldownUntil: null,
        }),
      )
      expect(readSessionHistory(adapter)).toEqual(emptySessionHistory())
    })

    it('does not throw when getItem throws (private browsing)', () => {
      const adapter: StorageAdapter = {
        getItem: () => {
          throw new Error('QuotaExceededError')
        },
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      }
      expect(readSessionHistory(adapter)).toEqual(emptySessionHistory())
    })
  })

  describe('migrateV1toV2', () => {
    it('preserves every v1 field verbatim', () => {
      const v1 = makeV1Fixture()
      const v2 = migrateV1toV2(v1)
      expect(v2.sessionCount).toBe(v1.sessionCount)
      expect(v2.lastSessionCompletedAt).toBe(v1.lastSessionCompletedAt)
      expect(v2.longestStreakEver).toBe(v1.longestStreakEver)
      expect(v2.cumulativeStardust).toBe(v1.cumulativeStardust)
    })

    it('zero-fills the new v2 fields', () => {
      const v2 = migrateV1toV2(makeV1Fixture())
      expect(v2.lastSessionStardust).toBe(0)
      expect(v2.dayStreak).toBe(0)
      expect(v2.todayTreesTouched).toEqual({ date: '', trees: [] })
      expect(v2.lastSuggestion).toBeNull()
      expect(v2.consecutiveOverrides).toBe(0)
      expect(v2.suggestionCooldownUntil).toBeNull()
    })

    it('round-trips losslessly: v1 → v2 → write → read returns same data', () => {
      const adapter = createMemoryStorage()
      const v1 = makeV1Fixture()
      adapter.setItem(SESSION_HISTORY_KEY, JSON.stringify(v1))

      const promoted = readSessionHistory(adapter)
      writeSessionHistory(promoted, adapter)
      const reread = readSessionHistory(adapter)

      // Re-read returns the same v2 shape
      expect(reread).toEqual(promoted)
      // The four v1 data fields are preserved verbatim
      expect(reread.sessionCount).toBe(v1.sessionCount)
      expect(reread.lastSessionCompletedAt).toBe(v1.lastSessionCompletedAt)
      expect(reread.longestStreakEver).toBe(v1.longestStreakEver)
      expect(reread.cumulativeStardust).toBe(v1.cumulativeStardust)
    })

    it('promotes the empty v1 zero-state to the v2 zero-state', () => {
      const v1: SessionHistoryV1 = {
        schemaVersion: 1,
        sessionCount: 0,
        lastSessionCompletedAt: '',
        longestStreakEver: 0,
        cumulativeStardust: 0,
      }
      expect(migrateV1toV2(v1)).toEqual(emptySessionHistory())
    })
  })

  describe('writeSessionHistory', () => {
    it('persists the history to the adapter', () => {
      const adapter = createMemoryStorage()
      const history = emptySessionHistory()
      writeSessionHistory(history, adapter)
      expect(JSON.parse(adapter.store.get(SESSION_HISTORY_KEY)!)).toEqual(
        history,
      )
    })

    it('swallows setItem errors without crashing', () => {
      const adapter: StorageAdapter = {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      }
      // Should not throw
      expect(() =>
        writeSessionHistory(emptySessionHistory(), adapter),
      ).not.toThrow()
    })
  })

  describe('differenceInCalendarDays', () => {
    it('returns 0 for the same calendar day at different times', () => {
      const a = new Date(2026, 3, 29, 23, 59) // local time
      const b = new Date(2026, 3, 29, 0, 0)
      expect(differenceInCalendarDays(a, b)).toBe(0)
    })

    it('returns 1 for adjacent days', () => {
      const a = new Date(2026, 3, 29, 0, 0)
      const b = new Date(2026, 3, 28, 23, 59)
      expect(differenceInCalendarDays(a, b)).toBe(1)
    })

    it('returns positive for past dates', () => {
      const a = new Date(2026, 3, 29)
      const b = new Date(2026, 3, 22)
      expect(differenceInCalendarDays(a, b)).toBe(7)
    })

    it('returns negative when first arg is earlier', () => {
      const a = new Date(2026, 3, 28)
      const b = new Date(2026, 3, 29)
      expect(differenceInCalendarDays(a, b)).toBe(-1)
    })
  })

  describe('isoDate', () => {
    it('returns yyyy-mm-dd in local time', () => {
      // Use noon local-time so timezone shifts don't push us to the
      // adjacent calendar day.
      expect(isoDate(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
      expect(isoDate(new Date(2026, 11, 31, 12, 0))).toBe('2026-12-31')
    })
  })

  describe('nextDayStreak', () => {
    it('starts a fresh streak (=1) for a first-ever session', () => {
      const now = new Date(2026, 3, 29)
      expect(nextDayStreak(0, '', now)).toBe(1)
    })

    it('returns 1 for an unparseable lastCompletedAt', () => {
      const now = new Date(2026, 3, 29)
      expect(nextDayStreak(5, 'not-a-date', now)).toBe(1)
    })

    it('does not bump when last session was earlier today', () => {
      const earlierToday = new Date(2026, 3, 29, 8, 0).toISOString()
      const now = new Date(2026, 3, 29, 18, 0)
      expect(nextDayStreak(3, earlierToday, now)).toBe(3)
    })

    it('bumps to prev+1 when last session was yesterday', () => {
      const yesterday = new Date(2026, 3, 28, 18, 0).toISOString()
      const now = new Date(2026, 3, 29, 18, 0)
      expect(nextDayStreak(3, yesterday, now)).toBe(4)
    })

    it('silently resets to 1 when at least one day was missed', () => {
      const twoDaysAgo = new Date(2026, 3, 27, 18, 0).toISOString()
      const now = new Date(2026, 3, 29, 18, 0)
      expect(nextDayStreak(8, twoDaysAgo, now)).toBe(1)
    })

    it('resets to 1 across a weeks-long gap (no exception, no negative)', () => {
      const longAgo = new Date(2026, 0, 1).toISOString()
      const now = new Date(2026, 3, 29)
      expect(nextDayStreak(15, longAgo, now)).toBe(1)
    })
  })

  describe('markTreeTouched', () => {
    it('appends the tree on a fresh day', () => {
      const prev = emptySessionHistory()
      const now = new Date(2026, 3, 29, 12, 0)
      const next = markTreeTouched(prev, 'number-garden', now)
      expect(next.todayTreesTouched).toEqual({
        date: '2026-04-29',
        trees: ['number-garden'],
      })
    })

    it('is idempotent for the same tree on the same day', () => {
      const prev = emptySessionHistory()
      const now = new Date(2026, 3, 29, 12, 0)
      const once = markTreeTouched(prev, 'number-garden', now)
      const twice = markTreeTouched(once, 'number-garden', now)
      expect(twice).toBe(once) // referential equality — pure no-op
    })

    it('appends a second tree on the same day', () => {
      const prev = emptySessionHistory()
      const now = new Date(2026, 3, 29, 12, 0)
      const a = markTreeTouched(prev, 'number-garden', now)
      const b = markTreeTouched(a, 'word-song', now)
      expect(b.todayTreesTouched.trees).toEqual(['number-garden', 'word-song'])
    })

    it('clears stale entries when the calendar day rolls over', () => {
      const prev: SessionHistoryV2 = {
        ...emptySessionHistory(),
        todayTreesTouched: {
          date: '2026-04-28',
          trees: ['number-garden', 'word-song'],
        },
      }
      const now = new Date(2026, 3, 29, 12, 0)
      const next = markTreeTouched(prev, 'word-song', now)
      expect(next.todayTreesTouched).toEqual({
        date: '2026-04-29',
        trees: ['word-song'],
      })
    })
  })

  describe('readSessionHistoryForToday', () => {
    it('clears stale todayTreesTouched without writing to storage', () => {
      const adapter = createMemoryStorage()
      const stale: SessionHistoryV2 = {
        ...emptySessionHistory(),
        todayTreesTouched: {
          date: '2026-04-28',
          trees: ['number-garden'],
        },
      }
      adapter.setItem(SESSION_HISTORY_KEY, JSON.stringify(stale))
      const now = new Date(2026, 3, 29, 12, 0)
      const got = readSessionHistoryForToday(now, adapter)
      expect(got.todayTreesTouched).toEqual({
        date: '2026-04-29',
        trees: [],
      })
      // Storage NOT written — caller decides when to commit
      const onDisk = JSON.parse(adapter.store.get(SESSION_HISTORY_KEY)!)
      expect(onDisk.todayTreesTouched).toEqual({
        date: '2026-04-28',
        trees: ['number-garden'],
      })
    })

    it('passes through fresh entries unchanged', () => {
      const adapter = createMemoryStorage()
      const fresh: SessionHistoryV2 = {
        ...emptySessionHistory(),
        todayTreesTouched: {
          date: '2026-04-29',
          trees: ['number-garden'],
        },
      }
      adapter.setItem(SESSION_HISTORY_KEY, JSON.stringify(fresh))
      const now = new Date(2026, 3, 29, 12, 0)
      const got = readSessionHistoryForToday(now, adapter)
      expect(got.todayTreesTouched).toEqual(fresh.todayTreesTouched)
    })
  })

  describe('recordSessionEnd', () => {
    it('increments sessionCount from 0 to 1 on first session', () => {
      const adapter = createMemoryStorage()
      const fixedDate = new Date('2026-04-27T14:00:00.000Z')

      adapter.setItem(
        STARDUST_STORAGE_KEY,
        JSON.stringify({
          total: 9,
          lastUpdatedAt: fixedDate.toISOString(),
          schemaVersion: STARDUST_SCHEMA_VERSION,
        }),
      )

      const result = recordSessionEnd(5, adapter, () => fixedDate)

      expect(result.schemaVersion).toBe(2)
      expect(result.sessionCount).toBe(1)
      expect(result.lastSessionCompletedAt).toBe('2026-04-27T14:00:00.000Z')
      expect(result.longestStreakEver).toBe(5)
      expect(result.cumulativeStardust).toBe(9)
      expect(result.lastSessionStardust).toBe(9)
      expect(result.dayStreak).toBe(1)

      // Verify it was persisted as v2 on disk
      expect(JSON.parse(adapter.store.get(SESSION_HISTORY_KEY)!)).toEqual(
        result,
      )
    })

    it('increments sessionCount on subsequent sessions', () => {
      const adapter = createMemoryStorage()
      const firstDate = new Date('2026-04-27T14:00:00.000Z')
      const secondDate = new Date('2026-04-28T14:00:00.000Z')

      adapter.setItem(
        STARDUST_STORAGE_KEY,
        JSON.stringify({
          total: 9,
          lastUpdatedAt: firstDate.toISOString(),
          schemaVersion: STARDUST_SCHEMA_VERSION,
        }),
      )
      recordSessionEnd(3, adapter, () => firstDate)

      adapter.setItem(
        STARDUST_STORAGE_KEY,
        JSON.stringify({
          total: 20,
          lastUpdatedAt: secondDate.toISOString(),
          schemaVersion: STARDUST_SCHEMA_VERSION,
        }),
      )
      const result = recordSessionEnd(7, adapter, () => secondDate)

      expect(result.sessionCount).toBe(2)
      expect(result.lastSessionCompletedAt).toBe('2026-04-28T14:00:00.000Z')
      expect(result.lastSessionStardust).toBe(11) // 20 - 9 cumulative delta
    })

    it('honours an explicit earnedThisSession arg over the cumulative delta', () => {
      const adapter = createMemoryStorage()
      const date = new Date('2026-04-27T14:00:00.000Z')

      adapter.setItem(
        STARDUST_STORAGE_KEY,
        JSON.stringify({
          total: 99,
          lastUpdatedAt: date.toISOString(),
          schemaVersion: STARDUST_SCHEMA_VERSION,
        }),
      )

      // earnedThisSession = 7 even though stardust state shows total=99
      const result = recordSessionEnd(0, adapter, () => date, 7)
      expect(result.lastSessionStardust).toBe(7)
    })

    it('only updates longestStreakEver when current streak exceeds it', () => {
      const adapter = createMemoryStorage()
      adapter.setItem(
        STARDUST_STORAGE_KEY,
        JSON.stringify({
          total: 5,
          lastUpdatedAt: new Date().toISOString(),
          schemaVersion: STARDUST_SCHEMA_VERSION,
        }),
      )

      recordSessionEnd(5, adapter)
      const result = recordSessionEnd(3, adapter)

      expect(result.longestStreakEver).toBe(5)
      expect(result.sessionCount).toBe(2)
    })

    it('day-streak bumps across consecutive days', () => {
      const adapter = createMemoryStorage()

      const day1 = new Date(2026, 3, 27, 18, 0)
      const day2 = new Date(2026, 3, 28, 18, 0)
      const day3 = new Date(2026, 3, 29, 18, 0)

      // First session — streak = 1
      const a = recordSessionEnd(0, adapter, () => day1)
      expect(a.dayStreak).toBe(1)

      // Next-day session — streak = 2
      const b = recordSessionEnd(0, adapter, () => day2)
      expect(b.dayStreak).toBe(2)

      // Third consecutive day — streak = 3
      const c = recordSessionEnd(0, adapter, () => day3)
      expect(c.dayStreak).toBe(3)
    })

    it('day-streak does not bump twice in a single day', () => {
      const adapter = createMemoryStorage()
      const morning = new Date(2026, 3, 29, 8, 0)
      const evening = new Date(2026, 3, 29, 20, 0)

      const a = recordSessionEnd(0, adapter, () => morning)
      expect(a.dayStreak).toBe(1)
      const b = recordSessionEnd(0, adapter, () => evening)
      expect(b.dayStreak).toBe(1)
    })

    it('day-streak silently resets after a missed day', () => {
      const adapter = createMemoryStorage()
      const day1 = new Date(2026, 3, 27, 18, 0)
      const day3 = new Date(2026, 3, 29, 18, 0)

      const a = recordSessionEnd(0, adapter, () => day1)
      expect(a.dayStreak).toBe(1)
      // Skip day 2 entirely
      const b = recordSessionEnd(0, adapter, () => day3)
      expect(b.dayStreak).toBe(1)
    })

    it('handles missing stardust key gracefully (first session ever)', () => {
      const adapter = createMemoryStorage()
      const result = recordSessionEnd(2, adapter)
      expect(result.cumulativeStardust).toBe(0)
      expect(result.lastSessionStardust).toBe(0)
      expect(result.sessionCount).toBe(1)
    })

    it('migrates a v1 payload at recordSessionEnd time', () => {
      const adapter = createMemoryStorage()
      // Seed the storage with a v1 payload
      const v1: SessionHistoryV1 = {
        schemaVersion: 1,
        sessionCount: 5,
        lastSessionCompletedAt: '2026-04-27T18:00:00.000Z',
        longestStreakEver: 4,
        cumulativeStardust: 25,
      }
      adapter.setItem(SESSION_HISTORY_KEY, JSON.stringify(v1))

      adapter.setItem(
        STARDUST_STORAGE_KEY,
        JSON.stringify({
          total: 30,
          lastUpdatedAt: '2026-04-28T18:00:00.000Z',
          schemaVersion: STARDUST_SCHEMA_VERSION,
        }),
      )

      const result = recordSessionEnd(
        2,
        adapter,
        () => new Date('2026-04-28T18:00:00.000Z'),
      )

      // sessionCount carried over from v1, then bumped
      expect(result.sessionCount).toBe(6)
      expect(result.schemaVersion).toBe(2)
      // delta from v1 cumulativeStardust (25) → new cumulativeStardust (30)
      expect(result.lastSessionStardust).toBe(5)
      // dayStreak should bump from 0 (v1 default) → 1, since this is
      // effectively a "first day-streak observation" given v1 had no
      // streak field. Last completion was yesterday (4/27 → 4/28), so
      // nextDayStreak treats it as +1 from default 0.
      expect(result.dayStreak).toBe(1)

      // Persisted as v2
      const onDisk = JSON.parse(adapter.store.get(SESSION_HISTORY_KEY)!)
      expect(onDisk.schemaVersion).toBe(2)
    })

    it('continues without crashing when storage throws on write', () => {
      const store = new Map<string, string>()
      let writeCalls = 0
      const adapter: StorageAdapter = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: () => {
          writeCalls++
          throw new Error('QuotaExceededError')
        },
      }

      const result = recordSessionEnd(5, adapter)
      expect(result.sessionCount).toBe(1)
      expect(result.longestStreakEver).toBe(5)
      expect(writeCalls).toBeGreaterThan(0)
    })
  })
})
