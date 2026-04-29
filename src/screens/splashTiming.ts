/**
 * Splash timing logic — pure functions, no React, no DOM mutation. The
 * Splash component composes these and the only browser API used here
 * (sessionStorage / performance) is read-only and feature-detected.
 *
 * Spec: design/session-1.md, Screen 1 §States
 *  - warm cache: 1500 ms
 *  - cold cache: up to 3000 ms (force-advance)
 *  - default to cold cap if detection is uncertain (safer for first launch)
 */

export const WARM_CAP_MS = 1500
export const COLD_CAP_MS = 3000

/** Flag we set in sessionStorage on first visit so the next route knows. */
const WARM_FLAG_KEY = 'marian.splash.warm'

export type ColdStartDetector = () => boolean

/**
 * Returns true if this looks like a cold start.
 *
 * Heuristic, ordered safest → cheapest:
 *  1. If sessionStorage has the warm flag from a previous visit *in this
 *     session*, it's a warm reload — return false.
 *  2. If `performance.getEntriesByType('navigation')[0].type === 'reload'`,
 *     treat as warm — the SW cache is hot and the user is just refreshing.
 *  3. Otherwise (first nav, or detection unavailable), assume cold. The
 *     spec says "default to cold cap if uncertain" — safer to over-show
 *     the splash than to clip Emma's reveal.
 */
export function detectColdStart(): boolean {
  if (typeof window === 'undefined') return true

  try {
    if (window.sessionStorage?.getItem(WARM_FLAG_KEY) === '1') {
      return false
    }
  } catch {
    // Private mode / disabled storage → fall through to perf check.
  }

  try {
    const nav = window.performance?.getEntriesByType?.('navigation') as
      | PerformanceNavigationTiming[]
      | undefined
    if (nav && nav.length > 0 && nav[0].type === 'reload') {
      return false
    }
  } catch {
    // performance API unavailable → fall through.
  }

  return true
}

/** Mark this session warm so subsequent in-session navs use the warm cap. */
export function markWarm(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage?.setItem(WARM_FLAG_KEY, '1')
  } catch {
    // Storage disabled — the next visit will just see cold timing again.
    // That's the safer default per spec, so we don't fight it.
  }
}

/** Returns the auto-advance cap (ms) for this start. */
export function splashCapMs(isCold: boolean): number {
  return isCold ? COLD_CAP_MS : WARM_CAP_MS
}

/** Test seam: re-export the storage key so tests can clear it deterministically. */
export const __WARM_FLAG_KEY = WARM_FLAG_KEY
