// @vitest-environment node
/**
 * Core persistence through an injected KeyValueStore, with NO `window`
 * (node environment): the shape a React Native host runs in. Proves every
 * core module that persists goes through the seam rather than a browser
 * global, and keeps its corruption recovery.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  getKeyValueStore,
  setKeyValueStore,
  type KeyValueStore,
} from './keyValueStore'
import {
  clearProgress,
  defaultProgress,
  getOrCreateDeviceId,
  loadProgress,
  saveProgress,
  DEVICE_ID_STORAGE_KEY,
  STORAGE_KEY,
} from '../progress'
import {
  STARDUST_STORAGE_KEY,
  loadStardust,
  writeStardust,
} from '../shared/stardust'
import {
  SESSION_HISTORY_KEY,
  emptySessionHistory,
  readSessionHistory,
  writeSessionHistory,
} from '../sessionEnd/sessionHistory'
import {
  NOT_YET_NUDGE_STORAGE_KEY,
  markNudgeSaid,
  nudgeSaidToday,
} from '../sessionEnd/notYetNudge'

class MapStore implements KeyValueStore {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}

const throwingStore: KeyValueStore = {
  getItem: () => {
    throw new Error('storage revoked')
  },
  setItem: () => {
    throw new Error('quota exceeded')
  },
  removeItem: () => {
    throw new Error('storage revoked')
  },
}

afterEach(() => {
  setKeyValueStore(null)
})

describe('KeyValueStore seam', () => {
  it('runs with no window at all', () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined')
  })

  it('setKeyValueStore installs and uninstalls', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    expect(getKeyValueStore()).toBe(store)
    setKeyValueStore(null)
    expect(getKeyValueStore()).toBeNull()
  })
})

describe('progress through an injected store', () => {
  it('round-trips save → load under STORAGE_KEY', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    const p = defaultProgress()
    saveProgress(p)
    expect(store.data.has(STORAGE_KEY)).toBe(true)
    const loaded = loadProgress()
    expect(loaded?.profile.childName).toBe(p.profile.childName)
    expect(loaded?.skillLevels).toEqual(p.skillLevels)
    clearProgress()
    expect(store.data.has(STORAGE_KEY)).toBe(false)
  })

  it('treats a corrupt blob as nothing stored', () => {
    const store = new MapStore()
    store.setItem(STORAGE_KEY, '{not json,,,')
    setKeyValueStore(store)
    expect(loadProgress()).toBeNull()
  })

  it('with no store installed: reads null, writes are dropped', () => {
    expect(loadProgress()).toBeNull()
    expect(() => saveProgress(defaultProgress())).not.toThrow()
    expect(loadProgress()).toBeNull()
  })

  it('a throwing store never crashes the boot read or a save', () => {
    setKeyValueStore(throwingStore)
    expect(loadProgress()).toBeNull()
    expect(() => saveProgress(defaultProgress())).not.toThrow()
    expect(() => clearProgress()).not.toThrow()
  })

  it('persists the device id', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    const id = getOrCreateDeviceId()
    expect(store.getItem(DEVICE_ID_STORAGE_KEY)).toBe(id)
    expect(getOrCreateDeviceId()).toBe(id)
  })
})

describe('the other persisted blobs use the same store', () => {
  it('stardust', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    writeStardust(7)
    expect(store.data.has(STARDUST_STORAGE_KEY)).toBe(true)
    expect(loadStardust().total).toBe(7)
  })

  it('session history', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    writeSessionHistory({ ...emptySessionHistory(), sessionCount: 3 })
    expect(store.data.has(SESSION_HISTORY_KEY)).toBe(true)
    expect(readSessionHistory().sessionCount).toBe(3)
  })

  it('the not-yet nudge', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    markNudgeSaid('math', '2026-10-08')
    expect(store.data.has(NOT_YET_NUDGE_STORAGE_KEY)).toBe(true)
    expect(nudgeSaidToday('math', '2026-10-08')).toBe(true)
  })
})
