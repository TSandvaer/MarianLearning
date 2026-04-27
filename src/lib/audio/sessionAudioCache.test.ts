/**
 * Tests for the production IndexedDB-backed `createIndexedDbCache`.
 *
 * Split into its own file so the `fake-indexeddb` polyfill loads ONCE per
 * test file and doesn't leak into the rest of the suite. (Fake-indexeddb
 * monkey-patches the global `indexedDB`; isolating the import keeps the
 * sessionAudio.test.ts harness using the explicit injected cache.)
 */
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CACHE_VERSION,
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  createIndexedDbCache,
  createSessionAudio,
} from './sessionAudio'

afterEach(async () => {
  // Drop the database between tests so each one starts clean.
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve() // best-effort
    req.onblocked = () => resolve()
  })
})

describe('createIndexedDbCache', () => {
  it('returns null on get when no entry exists', async () => {
    const cache = createIndexedDbCache()
    const out = await cache.get('missing-session')
    expect(out).toBeNull()
  })

  it('round-trips a put → get for a session', async () => {
    const cache = createIndexedDbCache()
    const map = new Map<string, string>([
      ['u1', 'AAEC'],
      ['u2', 'AwQF'],
    ])
    await cache.put('s1', map)

    const out = await cache.get('s1')
    expect(out).not.toBeNull()
    expect(out!.get('u1')).toBe('AAEC')
    expect(out!.get('u2')).toBe('AwQF')
  })

  it('keeps sessions isolated by id', async () => {
    const cache = createIndexedDbCache()
    await cache.put('s1', new Map([['u1', 'AAEC']]))
    await cache.put('s2', new Map([['u1', 'AwQF']]))

    expect((await cache.get('s1'))!.get('u1')).toBe('AAEC')
    expect((await cache.get('s2'))!.get('u1')).toBe('AwQF')
  })

  it('removes a session from the store', async () => {
    const cache = createIndexedDbCache()
    await cache.put('to-remove', new Map([['u1', 'AAEC']]))
    expect(await cache.get('to-remove')).not.toBeNull()
    await cache.remove('to-remove')
    expect(await cache.get('to-remove')).toBeNull()
  })

  it('overwrites a previous put for the same session id', async () => {
    const cache = createIndexedDbCache()
    await cache.put('s1', new Map([['u1', 'AAA=']]))
    await cache.put('s1', new Map([['u1', 'BBB=']]))
    expect((await cache.get('s1'))!.get('u1')).toBe('BBB=')
  })
})

describe('cache version invariants', () => {
  it('STORE_NAME embeds the current CACHE_VERSION', () => {
    // Guards against the failure mode where someone bumps CACHE_VERSION
    // but forgets to wire it into the store name (or vice versa).
    expect(STORE_NAME).toBe(`session-audio-v${CACHE_VERSION}`)
  })

  it('DB_VERSION tracks CACHE_VERSION so onupgradeneeded fires on bump', () => {
    // The IDB spec only fires onupgradeneeded when the integer goes UP.
    // If these decouple, a CACHE_VERSION bump silently fails to drop the
    // stale store on returning users.
    expect(DB_VERSION).toBe(CACHE_VERSION)
  })

  it('drops a previous-version store on open (onupgradeneeded path)', async () => {
    // Simulate a returning user who has the v1 store on disk. Open the
    // DB at the previous version with the old store name, write some
    // data, close.
    const previousStoreName = 'session-audio-v-legacy'
    const previousVersion = CACHE_VERSION - 1
    expect(previousVersion).toBeGreaterThanOrEqual(1)

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, previousVersion)
      req.onupgradeneeded = () => {
        req.result.createObjectStore(previousStoreName)
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(previousStoreName, 'readwrite')
        tx.objectStore(previousStoreName).put(
          new Map([['stale-u', 'STALEBYTES']]),
          'stale-session',
        )
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })

    // Now use the production adapter, which opens at DB_VERSION =
    // CACHE_VERSION. onupgradeneeded should fire and drop the legacy
    // store.
    const cache = createIndexedDbCache()
    // Trigger an open by exercising the adapter.
    await cache.get('any-session')

    // Re-open at current version and inspect the store list directly.
    const stores = await new Promise<string[]>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onsuccess = () => {
        const names = Array.from(req.result.objectStoreNames)
        req.result.close()
        resolve(names)
      }
      req.onerror = () => reject(req.error)
    })

    expect(stores).toContain(STORE_NAME)
    expect(stores).not.toContain(previousStoreName)
  })

  it('cache miss → caller-supplied bytes are used for fresh playback', async () => {
    // Regression for the stale-serve bug: when the cache has nothing
    // for a session id, the buildHowls() path at sessionAudio.ts must
    // use `u.audio.base64` from the server payload, not stale bytes.
    // This exercises that fallthrough end-to-end against the real
    // IDB-backed cache (post-version-bump).
    const cache = createIndexedDbCache()
    // Confirm cold cache.
    expect(await cache.get('fresh-session')).toBeNull()

    const captured: string[] = []
    const HowlCtor = vi.fn(({ src }: { src: string[] }) => {
      captured.push(src[0])
      return {
        play: () => 0,
        stop: () => {},
        duration: () => 0,
        on: () => {},
        off: () => {},
        unload: () => {},
      }
    }) as unknown as typeof import('howler').Howl

    const sessionAudio = createSessionAudio({
      cache,
      HowlCtor,
      createBlobUrl: (blob: Blob) => `blob:fresh-${blob.size}`,
      revokeBlobUrl: () => {},
    })

    const utterances = [
      {
        id: 'u-fresh',
        text: 'twenty-four',
        audio: {
          kind: 'inline' as const,
          base64: 'RlJFU0g=',
          mime: 'audio/mpeg' as const,
        },
      },
    ]

    const map = await sessionAudio.loadSessionAudio('fresh-session', utterances)
    expect(map.has('u-fresh')).toBe(true)
    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatch(/^blob:fresh-/)

    // And confirm we wrote the FRESH bytes to the cache (not nothing,
    // not stale). The put is fire-and-forget; await a microtask flush.
    await Promise.resolve()
    await Promise.resolve()
    const persisted = await cache.get('fresh-session')
    expect(persisted?.get('u-fresh')).toBe('RlJFU0g=')
  })
})
