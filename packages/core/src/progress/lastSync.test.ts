// @vitest-environment node
/**
 * The last successful cloud sync, stored device-locally under its own key
 * (native Parent Settings' "Last synced"): never inside the Progress blob,
 * so it never travels to the cloud or back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setKeyValueStore, type KeyValueStore } from '../platform/keyValueStore'
import { pushProgressToCloud } from './cloudSync'
import { defaultProgress } from './defaults'
import {
  LAST_SYNC_STORAGE_KEY,
  readLastSyncISO,
  recordLastSync,
} from './lastSync'
import { STORAGE_KEY, loadProgress, saveProgress } from './storage'

const AT = new Date('2026-10-13T09:41:00.000Z')

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

afterEach(() => {
  setKeyValueStore(null)
})

describe('lastSync', () => {
  it('reads null until something is recorded', () => {
    setKeyValueStore(new MapStore())
    expect(readLastSyncISO()).toBeNull()
  })

  it('records the time as ISO text under its own key, and reads it back', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    recordLastSync(AT)
    expect([...store.data.keys()]).toEqual([LAST_SYNC_STORAGE_KEY])
    expect(store.data.get(LAST_SYNC_STORAGE_KEY)).toBe(
      '2026-10-13T09:41:00.000Z',
    )
    expect(readLastSyncISO()).toBe('2026-10-13T09:41:00.000Z')
  })

  it('defaults to now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(AT)
    try {
      setKeyValueStore(new MapStore())
      recordLastSync()
      expect(readLastSyncISO()).toBe('2026-10-13T09:41:00.000Z')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stays out of the Progress blob, so a push never carries it', async () => {
    const store = new MapStore()
    setKeyValueStore(store)
    const doc = defaultProgress()
    saveProgress(doc)
    const blobBefore = store.data.get(STORAGE_KEY)
    recordLastSync(AT)
    expect(store.data.get(STORAGE_KEY)).toBe(blobBefore)
    expect(store.data.size).toBe(2)

    const fetchImpl = vi.fn(async () => new Response('{"ok":true}'))
    await pushProgressToCloud(
      '11111111-2222-4333-8444-555555555555',
      loadProgress()!,
      { fetchImpl: fetchImpl as unknown as typeof fetch, authSecret: 's' },
    )
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const body = String(
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body,
    )
    expect(body).not.toContain('2026-10-13T09:41')
  })

  it('a stored value that is not a date reads as null', () => {
    const store = new MapStore()
    store.setItem(LAST_SYNC_STORAGE_KEY, 'banana')
    setKeyValueStore(store)
    expect(readLastSyncISO()).toBeNull()
  })

  it('no store, or a throwing one: reads null and never throws', () => {
    expect(readLastSyncISO()).toBeNull()
    expect(() => recordLastSync(AT)).not.toThrow()
    setKeyValueStore({
      getItem: () => {
        throw new Error('closed')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {},
    })
    expect(readLastSyncISO()).toBeNull()
    expect(() => recordLastSync(AT)).not.toThrow()
  })
})
