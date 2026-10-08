/**
 * The web host's debug-seed entry: `?debug=1&seed=<value>`.
 *
 * The seed recipes and their apply logic live in `@marian/core/debug/seeds`
 * (shared with the native app, which reads a launch argument instead of
 * the URL). This file owns only the web gate and the URL read.
 *
 * Why `?debug=1` is the gate
 * --------------------------
 * `isDebugEnabled()` (the same predicate that drives `DebugOverlay`) is
 * the canonical "this is a QA browser, not a real user's session" flag.
 * Marian's normal app-open never sets `?debug=1`, so this seeder never
 * runs in her flow. Production users are unaffected.
 *
 * Why module-load (not useEffect)
 * -------------------------------
 * The seed must land in localStorage BEFORE the React-tree's
 * `useState(loadProgress)` initializers, `getInitialRoute()`, or
 * `nextAfterSplash()` run — otherwise the first render reads stale
 * values and a forced reload would be needed to reflect the seed.
 * Module-load timing puts this BEFORE the React tree even imports.
 * Mirrors the `disableHowlerAutoSuspend()` pattern at the top of
 * `App.tsx`.
 */

import { applyDebugSeed } from '@marian/core/debug/seeds'
import { isDebugEnabled } from './isDebugEnabled'

/**
 * Returns the seed value from `?seed=<value>` if `?debug=1` is also
 * present. Returns `null` when no debug seed is requested.
 */
export function readDebugSeedParam(): string | null {
  if (typeof window === 'undefined' || !window.location) return null
  if (!isDebugEnabled()) return null
  try {
    return new URLSearchParams(window.location.search).get('seed')
  } catch {
    return null
  }
}

/**
 * Apply a recognized debug seed exactly once per stored state. Safe
 * to call multiple times — idempotent on the persisted blobs. No-op
 * when `?debug=1` is missing, when no `?seed=` is provided, or when
 * the seed value is not in the SEEDS table.
 */
export function maybeApplyDebugSeed(): void {
  const value = readDebugSeedParam()
  if (value === null) return
  applyDebugSeed(value)
}
