// Server-side session-start response cache (ticket 86c9kjdh2).
//
// Purpose
// -------
// Shaves Azure TTS load when the same (track, level, childName) triple is
// rendered multiple times within a short window. The dominant case is QA
// smokes / iPad reload-and-replay during dev — Marian's normal play
// pattern hits a fresh container each time and rarely benefits, but
// burst-test traffic absolutely does.
//
// Trade-off
// ---------
// Caching by exact-payload key means Marian replaying within the TTL gets
// the SAME problems and SAME pre-canned chatter. For a child resuming a
// session that was interrupted, this is actually helpful (continuity).
// For repeated "fresh sessions", the cache window is short enough (5 min
// default) that drift is bounded. If we ever want randomised problem
// selection within a child's session, that's a planner-side change —
// the cache layer here is just a memo over the (idempotent-shaped)
// session-start input.
//
// Scope
// -----
// Module-scoped Map. Vercel's warm-container retention (~5-15 min)
// matches our TTL well. Cold container = empty cache, next first-call
// refills. No cross-instance coherence — multi-instance deployments will
// have per-instance caches, which is fine; the worst case is "different
// containers serve different problems for the same kid", and that
// already happens between any two cold starts.
//
// Memory
// ------
// Each entry holds the full SessionStartResponse — utterances inline
// base64'd MP3s. Worst-case ~3KB per utterance × 60 utterances = ~180KB
// per entry. With cleanup-on-read and a small bounded-LRU cap (default
// 16 entries → ~3MB) we're well under Vercel's function memory budget.

import type { SessionStartResponse } from './_types.js'

/** Configuration for a SessionCache instance. */
export interface SessionCacheOptions {
  /** Time-to-live for a cached entry, in ms. Default 5 minutes. */
  ttlMs?: number
  /** Soft cap on simultaneously-cached entries. When the cache exceeds
   *  this, the oldest entry by insertion order is evicted on the next
   *  set(). Default 16. */
  maxEntries?: number
  /** Test seam — clock function. Defaults to Date.now. */
  now?: () => number
}

/** Public surface of the cache. */
export interface SessionCache {
  get(key: string, now?: number): SessionStartResponse | null
  set(key: string, response: SessionStartResponse, now?: number): void
  /** Test helper: how many entries are live (post-eviction count). */
  size(): number
  /** Test helper: clear all entries. */
  clear(): void
}

/** Build a cache-key for the track-based session-start payload.
 *
 * Identifying fields (joined with `|`):
 *   - track (enum)
 *   - level (integer)
 *   - childName (bounded ≤64 chars; any literal `|` is escaped)
 *   - focusNode (M2 — ticket 86c9kmwba). Cached responses depend on the
 *     focus node now that the planner generates problems for it. Without
 *     this in the key, a {focusNode: 'add-to-10'} request followed by
 *     {focusNode: 'add-to-20'} would silently serve the first response
 *     to the second call. Defaults to the empty string when omitted so
 *     the cache key for legacy clients (no focusNode field) stays stable.
 *
 * NOT in the key:
 *   - recentSuccessRate. It's a continuously variable float; including it
 *     would shred the cache hit rate for negligible benefit (the planner
 *     uses it as a soft hint, not a hard branch). The cost of serving a
 *     slightly-stale "recent score" response within the 5-minute TTL is
 *     bounded; the cache miss rate would not be.
 */
export function buildSessionCacheKey(args: {
  track: string
  level: number
  childName: string
  focusNode?: string
}): string {
  const safeName = args.childName.replace(/\|/g, '\\|')
  const focusNode = (args.focusNode ?? '').replace(/\|/g, '\\|')
  return `${args.track}|${args.level}|${safeName}|${focusNode}`
}

/**
 * Deep-clone the cached response so callers can't mutate the canonical
 * cache entry. Audio base64 strings are immutable values, but the
 * response object's array + plan blob are shared by reference if we
 * skip this step. JSON round-trip is the simplest correct approach —
 * the response is plain data (no Date / Map / functions / etc.) and the
 * latency is trivial relative to a network call we just saved.
 */
function cloneResponse(response: SessionStartResponse): SessionStartResponse {
  return JSON.parse(JSON.stringify(response)) as SessionStartResponse
}

/**
 * Create an in-memory session-start response cache.
 *
 * Concurrency notes
 * -----------------
 * Node is single-threaded; Map.get / Map.set are synchronous and atomic
 * relative to each other. Two concurrent handlers calling get→miss can
 * both proceed to render and both call set(); whichever set runs second
 * wins. That's intentional — caching the second writer's response is
 * equivalent in shape, and we'd rather double-render than serialise the
 * cache (a mutex would defeat the warm-cache goal of "zero Azure calls
 * on a hit").
 */
export function createSessionCache(
  opts: SessionCacheOptions = {},
): SessionCache {
  const ttlMs = opts.ttlMs ?? 5 * 60_000
  const maxEntries = opts.maxEntries ?? 16
  const nowFn = opts.now ?? Date.now

  // Map preserves insertion order in JS — the first key is the oldest.
  const store = new Map<
    string,
    { response: SessionStartResponse; expiresAt: number }
  >()

  function evictExpired(now: number): void {
    for (const [k, entry] of store) {
      if (entry.expiresAt <= now) store.delete(k)
    }
  }

  function evictOldest(): void {
    const firstKey = store.keys().next().value
    if (firstKey !== undefined) store.delete(firstKey)
  }

  return {
    get(key, now = nowFn()) {
      const entry = store.get(key)
      if (!entry) return null
      if (entry.expiresAt <= now) {
        store.delete(key)
        return null
      }
      return cloneResponse(entry.response)
    },

    set(key, response, now = nowFn()) {
      // If the key already exists, delete first so re-insert moves it to
      // the tail of the insertion-order list (LRU-on-write).
      store.delete(key)
      evictExpired(now)
      while (store.size >= maxEntries) {
        evictOldest()
      }
      store.set(key, {
        response: cloneResponse(response),
        expiresAt: now + ttlMs,
      })
    },

    size() {
      return store.size
    },

    clear() {
      store.clear()
    },
  }
}
