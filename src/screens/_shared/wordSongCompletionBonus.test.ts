/**
 * Tests for `grantWordSongCompletionBonus`.
 *
 * Ticket 86c9kwvza — completion-contingent stardust on word-song.
 */

import { describe, expect, it } from 'vitest'
import {
  STARDUST_STORAGE_KEY,
  loadStardust,
  type StorageAdapter,
} from './stardust'
import {
  WORDSONG_SESSION_END_BONUS,
  grantWordSongCompletionBonus,
} from './wordSongCompletionBonus'

function createMemoryStorage(): StorageAdapter & {
  store: Map<string, string>
} {
  const store = new Map<string, string>()
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v)
    },
  }
}

describe('grantWordSongCompletionBonus', () => {
  it('grants exactly +5 (WORDSONG_SESSION_END_BONUS) on first call', () => {
    expect(WORDSONG_SESSION_END_BONUS).toBe(5)

    const storage = createMemoryStorage()
    const result = grantWordSongCompletionBonus(storage)

    expect(result.total).toBe(WORDSONG_SESSION_END_BONUS)
    expect(loadStardust(storage).total).toBe(WORDSONG_SESSION_END_BONUS)
  })

  it('layers on top of an existing balance', () => {
    const storage = createMemoryStorage()
    storage.setItem(
      STARDUST_STORAGE_KEY,
      JSON.stringify({
        total: 12,
        lastUpdatedAt: new Date(0).toISOString(),
        schemaVersion: 1,
      }),
    )

    const result = grantWordSongCompletionBonus(storage)

    expect(result.total).toBe(12 + WORDSONG_SESSION_END_BONUS)
    expect(loadStardust(storage).total).toBe(12 + WORDSONG_SESSION_END_BONUS)
  })

  it('two consecutive grants compound (every word-song session pays out)', () => {
    const storage = createMemoryStorage()
    grantWordSongCompletionBonus(storage)
    const second = grantWordSongCompletionBonus(storage)
    expect(second.total).toBe(2 * WORDSONG_SESSION_END_BONUS)
  })

  it('writes the supplied clock into lastUpdatedAt', () => {
    const storage = createMemoryStorage()
    const fixed = new Date('2026-05-02T18:00:00.000Z')
    const result = grantWordSongCompletionBonus(storage, () => fixed)
    expect(result.lastUpdatedAt).toBe(fixed.toISOString())
  })

  it('persists with the SHARED stardust storage key', () => {
    const storage = createMemoryStorage()
    grantWordSongCompletionBonus(storage)
    expect(storage.store.has(STARDUST_STORAGE_KEY)).toBe(true)
  })
})
