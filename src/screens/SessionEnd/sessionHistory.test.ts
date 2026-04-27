import { describe, expect, it, beforeEach } from 'vitest'
import type { StorageAdapter } from '../Math/stardust'
import { STARDUST_STORAGE_KEY, STARDUST_SCHEMA_VERSION } from '../Math/stardust'
import {
  readSessionHistory,
  writeSessionHistory,
  recordSessionEnd,
  emptySessionHistory,
  SESSION_HISTORY_KEY,
  SESSION_HISTORY_SCHEMA_VERSION,
  _resetSessionHistoryWarn,
} from './sessionHistory'
import type { SessionHistoryV1 } from './sessionHistory'

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

describe('sessionHistory', () => {
  beforeEach(() => {
    _resetSessionHistoryWarn()
  })

  describe('emptySessionHistory', () => {
    it('returns the zero-state shape', () => {
      const empty = emptySessionHistory()
      expect(empty).toEqual({
        schemaVersion: SESSION_HISTORY_SCHEMA_VERSION,
        sessionCount: 0,
        lastSessionCompletedAt: '',
        longestStreakEver: 0,
        cumulativeStardust: 0,
      })
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

    it('returns empty state when stored value has wrong schema version', () => {
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

    it('returns empty state when stored value is missing required fields', () => {
      const adapter = createMemoryStorage()
      adapter.setItem(
        SESSION_HISTORY_KEY,
        JSON.stringify({ schemaVersion: 1, sessionCount: 5 }),
      )
      expect(readSessionHistory(adapter)).toEqual(emptySessionHistory())
    })

    it('reads a valid stored history', () => {
      const adapter = createMemoryStorage()
      const stored: SessionHistoryV1 = {
        schemaVersion: 1,
        sessionCount: 3,
        lastSessionCompletedAt: '2026-04-27T10:00:00.000Z',
        longestStreakEver: 5,
        cumulativeStardust: 30,
      }
      adapter.setItem(SESSION_HISTORY_KEY, JSON.stringify(stored))
      expect(readSessionHistory(adapter)).toEqual(stored)
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

  describe('writeSessionHistory', () => {
    it('persists the history to the adapter', () => {
      const adapter = createMemoryStorage()
      const history: SessionHistoryV1 = {
        schemaVersion: 1,
        sessionCount: 1,
        lastSessionCompletedAt: '2026-04-27T12:00:00.000Z',
        longestStreakEver: 3,
        cumulativeStardust: 11,
      }
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
      const history: SessionHistoryV1 = {
        schemaVersion: 1,
        sessionCount: 1,
        lastSessionCompletedAt: '2026-04-27T12:00:00.000Z',
        longestStreakEver: 3,
        cumulativeStardust: 11,
      }
      // Should not throw
      expect(() => writeSessionHistory(history, adapter)).not.toThrow()
    })
  })

  describe('recordSessionEnd', () => {
    it('increments sessionCount from 0 to 1 on first session', () => {
      const adapter = createMemoryStorage()
      const fixedDate = new Date('2026-04-27T14:00:00.000Z')

      // Seed stardust state (Math writes this during the session)
      adapter.setItem(
        STARDUST_STORAGE_KEY,
        JSON.stringify({
          total: 9,
          lastUpdatedAt: fixedDate.toISOString(),
          schemaVersion: STARDUST_SCHEMA_VERSION,
        }),
      )

      const result = recordSessionEnd(5, adapter, () => fixedDate)

      expect(result).toEqual({
        schemaVersion: 1,
        sessionCount: 1,
        lastSessionCompletedAt: '2026-04-27T14:00:00.000Z',
        longestStreakEver: 5,
        cumulativeStardust: 9,
      })

      // Verify it was persisted
      expect(JSON.parse(adapter.store.get(SESSION_HISTORY_KEY)!)).toEqual(
        result,
      )
    })

    it('increments sessionCount on subsequent sessions', () => {
      const adapter = createMemoryStorage()
      const firstDate = new Date('2026-04-27T14:00:00.000Z')
      const secondDate = new Date('2026-04-28T14:00:00.000Z')

      // Seed stardust
      adapter.setItem(
        STARDUST_STORAGE_KEY,
        JSON.stringify({
          total: 20,
          lastUpdatedAt: secondDate.toISOString(),
          schemaVersion: STARDUST_SCHEMA_VERSION,
        }),
      )

      // First session
      recordSessionEnd(3, adapter, () => firstDate)

      // Update stardust for second session
      adapter.setItem(
        STARDUST_STORAGE_KEY,
        JSON.stringify({
          total: 20,
          lastUpdatedAt: secondDate.toISOString(),
          schemaVersion: STARDUST_SCHEMA_VERSION,
        }),
      )

      // Second session
      const result = recordSessionEnd(7, adapter, () => secondDate)

      expect(result.sessionCount).toBe(2)
      expect(result.lastSessionCompletedAt).toBe('2026-04-28T14:00:00.000Z')
    })

    it('only updates longestStreakEver when current streak exceeds it', () => {
      const adapter = createMemoryStorage()

      // Seed stardust
      adapter.setItem(
        STARDUST_STORAGE_KEY,
        JSON.stringify({
          total: 5,
          lastUpdatedAt: new Date().toISOString(),
          schemaVersion: STARDUST_SCHEMA_VERSION,
        }),
      )

      // First session: streak of 5
      recordSessionEnd(5, adapter)

      // Second session: streak of 3 (lower -- should NOT decrease)
      const result = recordSessionEnd(3, adapter)

      expect(result.longestStreakEver).toBe(5)
      expect(result.sessionCount).toBe(2)
    })

    it('updates longestStreakEver when current streak is higher', () => {
      const adapter = createMemoryStorage()

      adapter.setItem(
        STARDUST_STORAGE_KEY,
        JSON.stringify({
          total: 10,
          lastUpdatedAt: new Date().toISOString(),
          schemaVersion: STARDUST_SCHEMA_VERSION,
        }),
      )

      // First session: streak of 3
      recordSessionEnd(3, adapter)
      // Second session: streak of 8
      const result = recordSessionEnd(8, adapter)

      expect(result.longestStreakEver).toBe(8)
    })

    it('mirrors cumulativeStardust from stardust.v1.total', () => {
      const adapter = createMemoryStorage()

      adapter.setItem(
        STARDUST_STORAGE_KEY,
        JSON.stringify({
          total: 42,
          lastUpdatedAt: new Date().toISOString(),
          schemaVersion: STARDUST_SCHEMA_VERSION,
        }),
      )

      const result = recordSessionEnd(0, adapter)
      expect(result.cumulativeStardust).toBe(42)
    })

    it('handles missing stardust key gracefully (first session ever)', () => {
      const adapter = createMemoryStorage()
      // No stardust key at all

      const result = recordSessionEnd(2, adapter)
      expect(result.cumulativeStardust).toBe(0)
      expect(result.sessionCount).toBe(1)
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

      // Should not throw
      const result = recordSessionEnd(5, adapter)
      expect(result.sessionCount).toBe(1)
      expect(result.longestStreakEver).toBe(5)
      // setItem was attempted
      expect(writeCalls).toBeGreaterThan(0)
    })
  })
})
