import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STARDUST_SCHEMA_VERSION,
  STARDUST_STORAGE_KEY,
  _resetStardustWarn,
  emptyStardust,
  loadStardust,
  writeStardust,
  type StorageAdapter,
} from './stardust'

function makeMemoryAdapter(seed: Record<string, string> = {}): StorageAdapter {
  const map = new Map(Object.entries(seed))
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
  }
}

describe('emptyStardust', () => {
  it('returns total=0 and the locked schema version', () => {
    const s = emptyStardust()
    expect(s.total).toBe(0)
    expect(s.schemaVersion).toBe(STARDUST_SCHEMA_VERSION)
    expect(typeof s.lastUpdatedAt).toBe('string')
    // ISO 8601 — the epoch fallback is fine, just sanity-check it parses.
    expect(Number.isNaN(Date.parse(s.lastUpdatedAt))).toBe(false)
  })
})

describe('loadStardust', () => {
  it('returns empty state when storage is empty (first session)', () => {
    const adapter = makeMemoryAdapter()
    expect(loadStardust(adapter)).toEqual(emptyStardust())
  })

  it('round-trips a written value', () => {
    const adapter = makeMemoryAdapter()
    writeStardust(7, adapter)
    const loaded = loadStardust(adapter)
    expect(loaded.total).toBe(7)
    expect(loaded.schemaVersion).toBe(STARDUST_SCHEMA_VERSION)
  })

  it('returns empty state when stored JSON is corrupted', () => {
    const adapter = makeMemoryAdapter({
      [STARDUST_STORAGE_KEY]: '{not-valid-json',
    })
    expect(loadStardust(adapter)).toEqual(emptyStardust())
  })

  it('returns empty state when shape is missing required fields', () => {
    const adapter = makeMemoryAdapter({
      [STARDUST_STORAGE_KEY]: JSON.stringify({ total: 5 }),
    })
    expect(loadStardust(adapter)).toEqual(emptyStardust())
  })

  it('returns empty state when schemaVersion does not match', () => {
    const adapter = makeMemoryAdapter({
      [STARDUST_STORAGE_KEY]: JSON.stringify({
        total: 99,
        lastUpdatedAt: '2026-04-25T00:00:00.000Z',
        schemaVersion: 999, // future hypothetical version
      }),
    })
    // No migration logic in v1 → discard. Marian sees 0; the schema bump is
    // the migration's hook point.
    expect(loadStardust(adapter)).toEqual(emptyStardust())
  })

  it('clamps negative totals to 0 (defensive — should never happen)', () => {
    const adapter = makeMemoryAdapter({
      [STARDUST_STORAGE_KEY]: JSON.stringify({
        total: -5,
        lastUpdatedAt: '2026-04-25T00:00:00.000Z',
        schemaVersion: STARDUST_SCHEMA_VERSION,
      }),
    })
    const loaded = loadStardust(adapter)
    expect(loaded.total).toBe(0)
  })

  it('returns empty state when getItem throws (private-mode iOS)', () => {
    const throwing: StorageAdapter = {
      getItem: () => {
        throw new Error('SecurityError: localStorage disabled')
      },
      setItem: () => undefined,
    }
    expect(loadStardust(throwing)).toEqual(emptyStardust())
  })
})

describe('writeStardust', () => {
  beforeEach(() => {
    _resetStardustWarn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists the new total via setItem with the canonical key', () => {
    const adapter = makeMemoryAdapter()
    const setSpy = vi.spyOn(adapter, 'setItem')
    writeStardust(5, adapter)
    expect(setSpy).toHaveBeenCalledWith(
      STARDUST_STORAGE_KEY,
      expect.stringContaining('"total":5'),
    )
  })

  it('uses the injected clock for lastUpdatedAt', () => {
    const adapter = makeMemoryAdapter()
    const fixed = new Date('2026-04-25T12:34:56.000Z')
    const written = writeStardust(3, adapter, () => fixed)
    expect(written.lastUpdatedAt).toBe(fixed.toISOString())
  })

  it('returns the in-memory state even if setItem throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken: StorageAdapter = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const written = writeStardust(11, broken)
    expect(written.total).toBe(11)
    // Warn fires once per app session. We cannot reset across tests cleanly
    // without exposing a hook; assert that it was called this time.
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('warns only once across multiple failing writes', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken: StorageAdapter = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    writeStardust(1, broken)
    writeStardust(2, broken)
    writeStardust(3, broken)
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('floors fractional inputs and clamps negatives', () => {
    const adapter = makeMemoryAdapter()
    expect(writeStardust(3.7, adapter).total).toBe(3)
    expect(writeStardust(-2, adapter).total).toBe(0)
  })
})
