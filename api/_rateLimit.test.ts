/**
 * @vitest-environment node
 *
 * Token-bucket rate limiter for /api/claude session-start. Per-IP, in-memory.
 *
 * Why per-IP, in-memory:
 *   - The share-link is a soft secret. If it leaks, runaway calls cost real
 *     money on Anthropic + Azure. A rate limit is the cheapest backstop.
 *   - Vercel keeps the function instance warm long enough between calls (a
 *     "warm container" persists for ~5-15 min) for an in-memory bucket to be
 *     useful as a SOFT guardrail. It is not bulletproof — a determined
 *     attacker can trigger a cold container and reset the bucket — but the
 *     attack model here is "8-year-old's brother's iPad spamming F5", not
 *     "professional adversary". Per-IP in-memory is the right tier.
 *   - Cheaper than pulling in a Redis-backed solution for what is effectively
 *     a family-local app.
 *
 * Bucket policy (default): 6 calls per IP per 60s window. Sliding window
 * implemented as a deque of timestamps — drop entries older than 60s, count
 * the rest, allow if count < 6.
 */
import { describe, expect, it } from 'vitest'
import { createRateLimiter } from './_rateLimit.js'

describe('createRateLimiter', () => {
  it('allows the first request from a given key', () => {
    const limiter = createRateLimiter({ limit: 6, windowMs: 60_000 })
    expect(limiter.check('ip-1', 1000)).toEqual({ allowed: true, remaining: 5 })
  })

  it('counts requests within the window and rejects the (limit+1)th', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 })
    // 3 calls within the same window → all allowed, remaining decrements
    expect(limiter.check('ip-1', 1000).allowed).toBe(true)
    expect(limiter.check('ip-1', 2000).allowed).toBe(true)
    expect(limiter.check('ip-1', 3000).allowed).toBe(true)
    // 4th call within window → blocked
    const fourth = limiter.check('ip-1', 4000)
    expect(fourth.allowed).toBe(false)
    expect(fourth.retryAfterSec).toBeGreaterThan(0)
  })

  it('forgives an old request that fell out of the sliding window', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 })
    // Two requests at t=1000 and t=2000 fill the bucket
    limiter.check('ip-1', 1000)
    limiter.check('ip-1', 2000)
    // Third request at t=70_000 — first request (t=1000) is now ~69s old,
    // outside the 60s window. Bucket is { 2000 } → allow, count goes to 2.
    expect(limiter.check('ip-1', 70_000).allowed).toBe(true)
  })

  it('keys per-IP — one IP filling its bucket does not affect another IP', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 })
    limiter.check('ip-1', 1000)
    limiter.check('ip-1', 2000)
    expect(limiter.check('ip-1', 3000).allowed).toBe(false)
    // ip-2's bucket is still empty
    expect(limiter.check('ip-2', 3000).allowed).toBe(true)
  })

  it('returns a sane retryAfterSec when blocked', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 })
    // Fill the bucket at t=1000 and t=2000.
    limiter.check('ip-1', 1000)
    limiter.check('ip-1', 2000)
    // At t=3000 we're blocked. The OLDEST entry (t=1000) falls out at
    // t=61_000, so retryAfterSec is ceil((61_000 - 3000) / 1000) = 58.
    const blocked = limiter.check('ip-1', 3000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBe(58)
  })

  it('does not leak memory — old entries are dropped lazily on subsequent checks', () => {
    // We don't expose an explicit GC; entries are dropped when the IP's bucket
    // is next consulted. This is intentionally simple — the working set on a
    // family-local app is small, and a few stale entries is cheaper than
    // running a periodic sweep.
    const limiter = createRateLimiter({ limit: 100, windowMs: 60_000 })
    for (let i = 0; i < 50; i++) {
      limiter.check('ip-1', i * 100)
    }
    // 60s later, all 50 entries should age out — the next call should allow
    // and the internal deque should be back to a single entry.
    const result = limiter.check('ip-1', 100_000)
    expect(result.allowed).toBe(true)
    // The contract surface is { allowed, remaining, retryAfterSec? }; we
    // assert remaining as the externally-observable proxy for "bucket was
    // pruned" — if all 50 stale entries hadn't been dropped we'd have
    // remaining = limit - 51 = 49, not limit - 1 = 99.
    expect(result.remaining).toBe(99)
  })
})
