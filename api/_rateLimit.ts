// Per-IP token bucket for /api/claude session-start.
//
// Why this exists (ticket 86c9jdh39)
// -----------------------------------
// The share-link is a soft secret. If it leaks, runaway calls cost real
// money on Anthropic (Haiku per session-start) + Azure (per utterance TTS).
// A rate limit is the cheapest backstop. Per-IP, in-memory is the right
// tier for a family-local app — it backstops the "kid spams F5" / "brother
// puts the iPad in a loop" cases without pulling in Redis.
//
// Limitations (acknowledged, by design)
// -------------------------------------
// - Vercel functions are stateless across cold starts, so the bucket resets
//   when a fresh container spins up. This is fine — the attack model here
//   is not "professional adversary"; it's "8-year-old's iPad in a tight
//   loop". A determined attacker can defeat this; that's not the concern.
// - Within a warm container (Vercel keeps them warm 5-15min between calls),
//   the bucket is honoured. That covers the threat we care about.
// - One Vercel deployment may have several warm instances behind the LB,
//   each with its own bucket. Effective per-IP limit is therefore
//   limit × instance_count. Still adequate as a soft guardrail; we'd swap
//   to Redis-backed if this app ever became multi-tenant.
//
// Sliding-window deque implementation: each IP carries an array of recent
// request timestamps. On every check we drop entries older than `windowMs`,
// then admit if count < limit, else reject with a `retryAfterSec` derived
// from when the oldest entry will fall out of the window.

/** Configuration for a token-bucket limiter. */
export interface RateLimiterConfig {
  /** Max requests per window per key. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

/** Result of a single rate-limit check. */
export interface RateLimitResult {
  allowed: boolean
  /** How many more requests this key can make within the current window
   *  AFTER the current one was counted. -1 for blocked requests (signal,
   *  not load-bearing). */
  remaining: number
  /** Seconds until the next request would be allowed. Set on blocked
   *  requests so the response can include a Retry-After header. */
  retryAfterSec?: number
}

export interface RateLimiter {
  /**
   * Check + record a request. The check IS the record — if `allowed` is
   * true, the timestamp has already been counted toward the bucket, so
   * the caller doesn't need a separate "tick" step.
   *
   * @param key per-IP bucket key (typically the request's source IP)
   * @param nowMs current time in ms (Date.now() in production; tests pin a
   *              fixed value to avoid wall-clock flakiness)
   */
  check(key: string, nowMs: number): RateLimitResult
}

/**
 * Build a sliding-window rate limiter.
 *
 * Memory: O(active keys × limit). A pruning pass on each `check` drops
 * stale timestamps, so a key that goes silent has its entries reaped on
 * its next call (or never — if the key is never seen again, the entry
 * lingers in the Map until the function instance is recycled). For the
 * scale this app operates at — a single family — that's fine.
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  if (config.limit < 1 || !Number.isFinite(config.limit)) {
    throw new Error(`createRateLimiter: invalid limit ${config.limit}`)
  }
  if (config.windowMs < 1 || !Number.isFinite(config.windowMs)) {
    throw new Error(`createRateLimiter: invalid windowMs ${config.windowMs}`)
  }

  const buckets = new Map<string, number[]>()

  return {
    check(key: string, nowMs: number): RateLimitResult {
      const cutoff = nowMs - config.windowMs
      const existing = buckets.get(key)
      // Lazy-prune: drop timestamps older than the window. A simple while-
      // shift on a sorted-ascending array is O(k) where k is the number
      // of stale entries — fine at our limits.
      const fresh: number[] = []
      if (existing) {
        for (const ts of existing) {
          if (ts > cutoff) fresh.push(ts)
        }
      }

      if (fresh.length >= config.limit) {
        // Block. Compute retry-after from the oldest in-window entry — that
        // entry will fall out of the window at `oldest + windowMs`, freeing
        // a slot.
        const oldest = fresh[0]!
        const msUntilFree = oldest + config.windowMs - nowMs
        // Math.ceil to avoid rounding down to 0 and re-inviting the loop.
        const retryAfterSec = Math.max(1, Math.ceil(msUntilFree / 1000))
        // Persist the pruned bucket so future checks don't re-walk the
        // same stale tail.
        buckets.set(key, fresh)
        return { allowed: false, remaining: -1, retryAfterSec }
      }

      // Admit. Record the timestamp.
      fresh.push(nowMs)
      buckets.set(key, fresh)
      return {
        allowed: true,
        remaining: config.limit - fresh.length,
      }
    },
  }
}
