/**
 * Hub session prefetch (Emma's Path 2/10, ClickUp 123jpnbc3dj).
 *
 * Problem
 * -------
 * A returning child lands Splash → Hub. Before this ticket only Word Song
 * pre-warmed on Hub; the Math session-start request only began when Math
 * mounted, so a Number Garden tap waited for the whole fetch (canon ~1 s,
 * live Leitner / slow-fact plan ~15 s, capped at 5 s + canon by the
 * Emma's Path 1/10 timeout).
 *
 * Contract
 * --------
 * - On Hub entry App prefetches the session for the world the Hub
 *   SUGGESTS — the same pure `computeSuggestion` over the same
 *   session-history blob the Hub reads, so the prefetch and the
 *   on-screen nudge always agree. Only ONE world is prefetched: session
 *   audio is a singleton, two concurrent loads would evict each other.
 * - No suggestion (cool-down, or both worlds touched today) → Word Song,
 *   which keeps the pre-existing 86c9pr4h9 Hub pre-warm unchanged.
 * - The tap REUSES the in-flight / settled request (the kick latch in
 *   App.tsx). The 1/10 visible-wait timer starts on the screen mount, so
 *   Hub dwell never counts toward its 5 s budget — an in-flight prefetch
 *   is adopted, never restarted.
 * - The tap DISCARDS the prefetch when the picked focus node (or mode)
 *   has changed since the prefetch started — e.g. a cloud-sync install
 *   or a parent-settings change landed while the Hub was up.
 * - Tapping the other world discards the prefetch (App's leave-effects
 *   abort + unload it before the other world's load).
 *
 * This module holds the pure decision helpers plus a tiny timing record
 * used to measure the latency the prefetch hides (read on a preview via
 * `window.__sessionStartTimings`, also logged with `console.info`).
 */

import { useMemo } from 'react'
import { computeSuggestion } from '../../screens/Hub/hubSuggestion'
import {
  readSessionHistoryForToday,
  type SkillTreeId,
} from '../../screens/SessionEnd/sessionHistory'

export type PrefetchTrack = 'math' | 'word-song'

/** Map the Hub suggestion to the track App prefetches. */
export function prefetchTrackFor(
  suggestion: SkillTreeId | null,
): PrefetchTrack {
  return suggestion === 'number-garden' ? 'math' : 'word-song'
}

/** The track whose session the Hub should prefetch, or `null` off-Hub.
 *  Recomputed per Hub entry (the history blob changes between visits). */
export function useHubSessionPrefetch(
  onHub: boolean,
  now: () => Date = () => new Date(),
): PrefetchTrack | null {
  return useMemo(() => {
    if (!onHub) return null
    let suggestion: SkillTreeId | null = null
    try {
      suggestion = computeSuggestion(readSessionHistoryForToday(now()), now())
    } catch {
      // Storage unavailable — fall through to the default world.
    }
    return prefetchTrackFor(suggestion)
    // `now` is a clock seam; only Hub entry should recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onHub])
}

/** Focus identity a session was prefetched under. */
export interface PrefetchFocus {
  node: string | undefined
  mode: string | undefined
}

/** `true` when a prefetched session no longer matches the focus the
 *  child would get if the request started now. */
export function isPrefetchStale(
  prefetched: PrefetchFocus,
  current: PrefetchFocus,
): boolean {
  return prefetched.node !== current.node || prefetched.mode !== current.mode
}

// ── Timing record ───────────────────────────────────────────────────────

export interface SessionStartTiming {
  track: PrefetchTrack
  /** Route the request started on: `hub` = prefetch, `greet` = first
   *  launch pre-warm, `math` / `literacy` = started by the screen. */
  origin: string
  startedAt: number
  settledAt?: number
  /** When the session screen mounted (the child's tap). */
  shownAt?: number
  usedFallback?: boolean
  outcome?: 'resolve' | 'reject'
}

const MAX_TIMINGS = 20
const timings: SessionStartTiming[] = []
const current = new Map<PrefetchTrack, SessionStartTiming>()

const clock = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now()

function publish(): void {
  if (typeof window !== 'undefined') {
    ;(
      window as unknown as { __sessionStartTimings?: SessionStartTiming[] }
    ).__sessionStartTimings = timings
  }
}

export function markSessionStartBegin(
  track: PrefetchTrack,
  origin: string,
): void {
  const t: SessionStartTiming = { track, origin, startedAt: clock() }
  current.set(track, t)
  timings.push(t)
  if (timings.length > MAX_TIMINGS) timings.shift()
  publish()
}

export function markSessionStartSettled(
  track: PrefetchTrack,
  outcome: 'resolve' | 'reject',
  usedFallback: boolean,
): void {
  const t = current.get(track)
  if (!t || t.settledAt !== undefined) return
  t.settledAt = clock()
  t.outcome = outcome
  t.usedFallback = usedFallback
  report(t)
}

export function markSessionScreenShown(track: PrefetchTrack): void {
  const t = current.get(track)
  if (!t || t.shownAt !== undefined) return
  t.shownAt = clock()
  report(t)
}

/** Derived numbers for one session start; `undefined` until both the
 *  settle and the screen mount are known. */
export function summarizeTiming(t: SessionStartTiming):
  | {
      fetchMs: number
      dwellMs: number
      visibleWaitMs: number
      hiddenMs: number
    }
  | undefined {
  if (t.settledAt === undefined || t.shownAt === undefined) return undefined
  const fetchMs = t.settledAt - t.startedAt
  const dwellMs = Math.max(0, t.shownAt - t.startedAt)
  const visibleWaitMs = Math.max(0, t.settledAt - t.shownAt)
  return { fetchMs, dwellMs, visibleWaitMs, hiddenMs: fetchMs - visibleWaitMs }
}

function report(t: SessionStartTiming): void {
  const s = summarizeTiming(t)
  if (!s) return
  console.info(
    `[session-start] ${t.track} origin=${t.origin} fetch=${Math.round(s.fetchMs)}ms ` +
      `dwell=${Math.round(s.dwellMs)}ms visibleWait=${Math.round(s.visibleWaitMs)}ms ` +
      `hidden=${Math.round(s.hiddenMs)}ms fallback=${t.usedFallback === true}`,
  )
}

/** Test seam. */
export function _resetSessionStartTimingsForTests(): void {
  timings.length = 0
  current.clear()
}
