/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { buildSessionCacheKey, createSessionCache } from './_sessionCache.js'
import type { SessionStartResponse } from './_types.js'

function makeResponse(label: string): SessionStartResponse {
  return {
    ok: true,
    kind: 'session-start',
    plan: { tag: label },
    utterances: [
      {
        id: `${label}.u1`,
        text: `text-${label}`,
        audio: { kind: 'inline', base64: 'AAEC', mime: 'audio/mpeg' },
      },
    ],
  }
}

describe('buildSessionCacheKey', () => {
  it('joins track, level, childName, and an empty focusNode with `|`', () => {
    // Default (M2 ticket 86c9kmwba): no focusNode supplied → trailing
    // empty segment. Stable shape so legacy callers (no focusNode field)
    // still hit the same cache key as before this change.
    expect(
      buildSessionCacheKey({ track: 'math', level: 1, childName: 'Marian' }),
    ).toBe('math|1|Marian|')
  })

  it('includes focusNode when supplied', () => {
    expect(
      buildSessionCacheKey({
        track: 'math',
        level: 1,
        childName: 'Marian',
        focusNode: 'add-to-10',
      }),
    ).toBe('math|1|Marian|add-to-10')
  })

  it('escapes a literal `|` inside childName so it cannot collide with another key', () => {
    // Defensive: childName is bounded ≤64 chars by the handler validator
    // but isn't constrained on character set. A literal `|` would let a
    // crafted name collide with another track's key — escape it.
    expect(
      buildSessionCacheKey({
        track: 'math',
        level: 1,
        childName: 'evil|name',
      }),
    ).toBe('math|1|evil\\|name|')
  })

  it('escapes a literal `|` inside focusNode (defense in depth — VALID nodes never contain `|`)', () => {
    // The planner's request validator rejects unknown focus nodes, so a
    // literal `|` in focusNode never reaches this builder in practice.
    // We still escape it so a future widening of the allowed-set can't
    // open a key-collision corridor.
    expect(
      buildSessionCacheKey({
        track: 'math',
        level: 1,
        childName: 'Marian',
        focusNode: 'evil|node',
      }),
    ).toBe('math|1|Marian|evil\\|node')
  })

  it('M2 regression — same (track, level, childName) but DIFFERENT focusNode produces DIFFERENT cache keys (ticket 86c9kmwba)', () => {
    // Pin the bug the brief warned about: PR #113 keyed only on (track,
    // level, childName), so a {focusNode: add-to-10} request followed
    // by a {focusNode: add-to-20} request would have served the first
    // cached response to the second call. Including focusNode in the key
    // forces a fresh planner+TTS call for the new focus.
    const k1 = buildSessionCacheKey({
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const k2 = buildSessionCacheKey({
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
    })
    expect(k1).not.toBe(k2)
  })

  it('different tracks/levels/names/focusNodes produce different keys', () => {
    const k1 = buildSessionCacheKey({
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const k2 = buildSessionCacheKey({
      track: 'word-song',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const k3 = buildSessionCacheKey({
      track: 'math',
      level: 2,
      childName: 'Marian',
      focusNode: 'add-to-10',
    })
    const k4 = buildSessionCacheKey({
      track: 'math',
      level: 1,
      childName: 'Other',
      focusNode: 'add-to-10',
    })
    const k5 = buildSessionCacheKey({
      track: 'math',
      level: 1,
      childName: 'Marian',
      focusNode: 'add-to-20',
    })
    expect(new Set([k1, k2, k3, k4, k5]).size).toBe(5)
  })
})

describe('createSessionCache', () => {
  it('returns null on a miss', () => {
    const cache = createSessionCache({ now: () => 1000 })
    expect(cache.get('any')).toBeNull()
  })

  it('returns the cached value on a hit within the TTL', () => {
    let now = 1000
    const cache = createSessionCache({ ttlMs: 5000, now: () => now })
    cache.set('k', makeResponse('A'))
    now = 4000 // 3s later, well within TTL
    const got = cache.get('k')
    expect(got).not.toBeNull()
    expect(got!.kind).toBe('session-start')
    expect((got!.plan as { tag: string }).tag).toBe('A')
  })

  it('returns null after the TTL expires', () => {
    let now = 1000
    const cache = createSessionCache({ ttlMs: 5000, now: () => now })
    cache.set('k', makeResponse('A'))
    now = 7000 // 6s later → past TTL
    expect(cache.get('k')).toBeNull()
  })

  it('returns a deep clone — caller mutation does NOT leak into the cached entry', () => {
    const cache = createSessionCache({ ttlMs: 5000, now: () => 1000 })
    cache.set('k', makeResponse('A'))
    const a = cache.get('k')!
    // Caller mutates the returned response
    a.utterances[0]!.text = 'mutated'
    a.utterances.push({
      id: 'injected',
      text: 'leak',
      audio: { kind: 'inline', base64: 'XX', mime: 'audio/mpeg' },
    })
    const b = cache.get('k')!
    expect(b.utterances).toHaveLength(1)
    expect(b.utterances[0]!.text).toBe('text-A')
  })

  it('does NOT share the cached entry with the writer (write-side clone)', () => {
    const cache = createSessionCache({ ttlMs: 5000, now: () => 1000 })
    const original = makeResponse('A')
    cache.set('k', original)
    // Writer mutates the SAME object after set(); the cached copy must
    // remain unchanged because set() clones on write.
    original.utterances[0]!.text = 'writer-mutated-after-set'
    const got = cache.get('k')!
    expect(got.utterances[0]!.text).toBe('text-A')
  })

  it('different keys are isolated', () => {
    const cache = createSessionCache({ ttlMs: 5000, now: () => 1000 })
    cache.set('k1', makeResponse('A'))
    cache.set('k2', makeResponse('B'))
    expect((cache.get('k1')!.plan as { tag: string }).tag).toBe('A')
    expect((cache.get('k2')!.plan as { tag: string }).tag).toBe('B')
  })

  it('overwriting a key resets its expiry', () => {
    let now = 1000
    const cache = createSessionCache({ ttlMs: 5000, now: () => now })
    cache.set('k', makeResponse('A'))
    now = 4000
    cache.set('k', makeResponse('B')) // refresh
    now = 8000 // 4s after refresh — A would have expired (8s after first set)
    const got = cache.get('k')
    expect(got).not.toBeNull()
    expect((got!.plan as { tag: string }).tag).toBe('B')
  })

  it('evicts the oldest entry when maxEntries is exceeded', () => {
    const cache = createSessionCache({
      ttlMs: 60_000,
      maxEntries: 2,
      now: () => 1000,
    })
    cache.set('a', makeResponse('A'))
    cache.set('b', makeResponse('B'))
    cache.set('c', makeResponse('C')) // evicts 'a'
    expect(cache.get('a')).toBeNull()
    expect(cache.get('b')).not.toBeNull()
    expect(cache.get('c')).not.toBeNull()
    expect(cache.size()).toBe(2)
  })

  it('clear() empties the cache', () => {
    const cache = createSessionCache({ ttlMs: 5000, now: () => 1000 })
    cache.set('k', makeResponse('A'))
    cache.clear()
    expect(cache.get('k')).toBeNull()
    expect(cache.size()).toBe(0)
  })
})
