/**
 * The progress clock — the one place "now" and "today" come from for
 * progress writes and day keys (ticket 123jpnbca4v, Guidance G4).
 *
 * In Marian's app this is plain wall-clock time. In a QA browser,
 * `?debug=1&dayOffset=N` (integer 0..60) moves the clock N days
 * forward, so one tester can walk through "day 1, day 2, day 3" of the
 * good-day rule, the day streak and the path celebrations without
 * waiting real days:
 *
 *   /?debug=1&dayOffset=0   → play a session (today)
 *   /?debug=1&dayOffset=1   → play a session (tomorrow)
 *   /?debug=1&dayOffset=2   → play a session (the day after)
 *
 * Gate: the SAME `isDebugEnabled()` predicate the debug overlay and the
 * debug seeds use. Without `?debug=1` the offset is ignored entirely;
 * an out-of-range or non-integer `dayOffset` is ignored (offset 0).
 *
 * Nothing about the offset is persisted: it is read from the URL on
 * every call. What IS persisted is whatever the shifted clock stamps —
 * the session's `dateISO`, `lastSessionCompletedAt`, Leitner `lastSeen`
 * — which is the point: the next day's session sees a real gap.
 * Stepping back to a lower offset after a higher one looks like clock
 * skew to the streak (`diff <= 0` → unchanged), same as a real device.
 *
 * Imports only the dependency-free `isDebugEnabled` leaf, so no cycle
 * with `lib/debug/debugSeed.ts` (which imports `lib/progress`).
 */

import { isDebugEnabled } from '../debug/isDebugEnabled'

export const MAX_DAY_OFFSET = 60

/**
 * The active day offset: N from `?debug=1&dayOffset=N` when N is an
 * integer in 0..MAX_DAY_OFFSET, otherwise 0.
 */
export function dayOffset(): number {
  if (!isDebugEnabled()) return 0
  let raw: string | null
  try {
    raw = new URLSearchParams(window.location.search).get('dayOffset')
  } catch {
    return 0
  }
  if (raw === null || !/^\d+$/.test(raw)) return 0
  const n = Number(raw)
  return n <= MAX_DAY_OFFSET ? n : 0
}

/**
 * Current instant, shifted by the debug day offset. Shifts by calendar
 * days (`setDate`), not by N × 24 h, so a DST change inside the window
 * cannot land the key on the wrong date.
 */
export function now(): Date {
  const d = new Date(Date.now())
  const offset = dayOffset()
  if (offset !== 0) d.setDate(d.getDate() + offset)
  return d
}

/** `now()` in epoch milliseconds (Leitner due checks take a number). */
export function nowMs(): number {
  return now().getTime()
}

/** Local-time `YYYY-MM-DD` of `date`. The day-key convention progress uses. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Today's local `YYYY-MM-DD` on the progress clock. */
export function todayKey(): string {
  return localDateKey(now())
}
