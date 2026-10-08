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
 * Host seam (`@marian/core` has no DOM): the raw `dayOffset` value comes
 * from a `DayOffsetSource` the host installs with `setDayOffsetSource`.
 * The web reads `?debug=1&dayOffset=N` (`src/platform/web.ts`); a host
 * that installs nothing gets plain wall-clock time. Validation stays here.
 *
 * Nothing about the offset is persisted: it is read from the URL on
 * every call. What IS persisted is whatever the shifted clock stamps —
 * the session's `dateISO`, `lastSessionCompletedAt`, Leitner `lastSeen`
 * — which is the point: the next day's session sees a real gap.
 * Stepping back to a lower offset after a higher one looks like clock
 * skew to the streak (`diff <= 0` → unchanged), same as a real device.
 */

export const MAX_DAY_OFFSET = 60

/**
 * Returns the raw requested day offset (the `dayOffset` query value on
 * the web), or `null` when there is none or the debug gate is closed.
 * Called on every clock read; may throw (treated as "no offset").
 */
export type DayOffsetSource = () => string | null

const NO_DAY_OFFSET: DayOffsetSource = () => null

let dayOffsetSource: DayOffsetSource = NO_DAY_OFFSET

/** Install the host's day-offset source. `null` restores wall-clock time. */
export function setDayOffsetSource(source: DayOffsetSource | null): void {
  dayOffsetSource = source ?? NO_DAY_OFFSET
}

/** Parse a raw day-offset value: an integer in 0..MAX_DAY_OFFSET, else 0. */
export function parseDayOffset(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 0
  const n = Number(raw)
  return n <= MAX_DAY_OFFSET ? n : 0
}

/**
 * The active day offset: N from `?debug=1&dayOffset=N` when N is an
 * integer in 0..MAX_DAY_OFFSET, otherwise 0.
 */
export function dayOffset(): number {
  let raw: string | null
  try {
    raw = dayOffsetSource()
  } catch {
    return 0
  }
  return parseDayOffset(raw)
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
