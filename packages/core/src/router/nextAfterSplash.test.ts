// @vitest-environment node
/**
 * The Splash branch both hosts share, run against an in-memory store
 * (no browser): first launch → Greet, any completed session → Hub.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { setKeyValueStore, type KeyValueStore } from '../index'
import {
  SESSION_HISTORY_KEY,
  emptySessionHistory,
  writeSessionHistory,
} from '../sessionEnd/sessionHistory'
import { nextAfterSplash } from './nextAfterSplash'

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

afterEach(() => {
  setKeyValueStore(null)
})

describe('nextAfterSplash', () => {
  it('first launch (nothing stored) → greet', () => {
    setKeyValueStore(memoryStore())
    expect(nextAfterSplash()).toBe('greet')
  })

  it('sessionCount 0 stored → greet', () => {
    setKeyValueStore(memoryStore())
    writeSessionHistory(emptySessionHistory())
    expect(nextAfterSplash()).toBe('greet')
  })

  it('sessionCount ≥ 1 → hub', () => {
    setKeyValueStore(memoryStore())
    writeSessionHistory({ ...emptySessionHistory(), sessionCount: 1 })
    expect(nextAfterSplash()).toBe('hub')
    writeSessionHistory({ ...emptySessionHistory(), sessionCount: 7 })
    expect(nextAfterSplash()).toBe('hub')
  })

  it('malformed session history → greet', () => {
    const store = memoryStore()
    store.setItem(SESSION_HISTORY_KEY, '{not json')
    setKeyValueStore(store)
    expect(nextAfterSplash()).toBe('greet')
  })

  it('no store installed → greet', () => {
    expect(nextAfterSplash()).toBe('greet')
  })

  it('a store whose reads throw → greet', () => {
    setKeyValueStore({
      getItem: () => {
        throw new Error('storage disabled')
      },
      setItem: () => {},
      removeItem: () => {},
    })
    expect(nextAfterSplash()).toBe('greet')
  })
})
