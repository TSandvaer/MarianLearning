/**
 * Tests for the production IndexedDB-backed `createIndexedDbCache`.
 *
 * Split into its own file so the `fake-indexeddb` polyfill loads ONCE per
 * test file and doesn't leak into the rest of the suite. (Fake-indexeddb
 * monkey-patches the global `indexedDB`; isolating the import keeps the
 * sessionAudio.test.ts harness using the explicit injected cache.)
 */
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createIndexedDbCache } from './sessionAudio'

afterEach(async () => {
  // Drop the database between tests so each one starts clean.
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('marian-tutor-session-audio')
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
