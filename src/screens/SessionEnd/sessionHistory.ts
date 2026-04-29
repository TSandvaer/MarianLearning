/**
 * Session-history persistence for Session End + Hub.
 *
 * Spec source-of-truth:
 *   - `design/screen-5-session-end.md` — original v1 contract.
 *   - `design/screen-hub.md` § "localStorage updates required —
 *     session-history.v2" — adds five fields: `lastSessionStardust`,
 *     `dayStreak`, `todayTreesTouched`, `lastSuggestion`,
 *     `consecutiveOverrides`.
 *
 * Schema: `marian-tutor.session-history.v1` (storage key kept stable
 * across the v1 → v2 migration so existing payloads round-trip).
 *
 * Migration model
 * ---------------
 * Lazy on read: `readSessionHistory()` accepts both shapes; v1 payloads
 * are promoted in-memory via `migrateV1toV2`. The next
 * `writeSessionHistory()` lands the v2 shape on disk. No explicit
 * migration pass on app launch — there's nothing to migrate that we
 * don't read in the same hop.
 *
 * Defensive posture
 * -----------------
 * iOS Safari in private browsing throws `QuotaExceededError` on every
 * `setItem`. We wrap reads + writes in try/catch and fall through to
 * in-memory defaults. Mirrors the same pattern from Math's `stardust.ts`.
 */

import type { StorageAdapter } from '../Math/stardust'
import { loadStardust } from '../Math/stardust'

/** Single source of truth for the storage key. */
export const SESSION_HISTORY_KEY = 'marian-tutor.session-history.v1'

/**
 * Schema version on the wire. We bumped from `1` → `2` when Hub landed;
 * the storage key keeps the literal `.v1` infix because mid-flight
 * payloads in the field would otherwise be orphaned. Old `schemaVersion: 1`
 * payloads are migrated lazily on read.
 */
export const SESSION_HISTORY_SCHEMA_VERSION = 2 as const

export type SkillTreeId = 'number-garden' | 'word-song'

/** The legacy v1 on-disk shape. Retained for migration + tests. */
export interface SessionHistoryV1 {
  schemaVersion: 1
  sessionCount: number
  lastSessionCompletedAt: string
  longestStreakEver: number
  cumulativeStardust: number
}

/**
 * The current (v2) on-disk shape.
 *
 * Hub-driven additions (from `screen-hub.md`):
 *
 * - `lastSessionStardust` — stardust earned in the most recent session.
 *   Surfaced on Hub's recent-stats strip iff the session was within 24 h.
 * - `dayStreak` — consecutive-day streak count. Bumped at Session-End
 *   when last completion was yesterday; left alone if today; silently
 *   resets to 0 on missed days. Hub renders only when ≥ 1 AND last
 *   session was today/yesterday.
 * - `todayTreesTouched` — which trees Marian has touched today. Drives
 *   the soft-suggestion algorithm. Cleared lazily on read when the
 *   calendar date rolls over.
 * - `lastSuggestion` — most recent suggestion direction. Used for
 *   tie-break alternation in the suggestion algorithm.
 * - `consecutiveOverrides` — how many times in a row Marian overrode
 *   the current suggestion direction. Cap at 3 triggers a 2-day
 *   suspension (Dave-locked, anti-nag rule).
 */
export interface SessionHistoryV2 {
  schemaVersion: 2
  // --- v1 fields, unchanged ---
  sessionCount: number
  lastSessionCompletedAt: string
  longestStreakEver: number
  cumulativeStardust: number
  // --- new in v2 ---
  lastSessionStardust: number
  dayStreak: number
  todayTreesTouched: {
    /** ISO yyyy-mm-dd; empty string sentinel before the first touch. */
    date: string
    trees: SkillTreeId[]
  }
  lastSuggestion: SkillTreeId | null
  consecutiveOverrides: number
  /**
   * Timestamp (ms epoch) at which the suggestion cool-down expires.
   * `null` outside a cool-down. While `now() < suggestionCooldownUntil`,
   * the suggestion algorithm yields `null` — both nodes equal.
   */
  suggestionCooldownUntil: number | null
}

/** Public alias — every consumer should hold the V2 shape. */
export type SessionHistory = SessionHistoryV2

/** Default adapter -- `window.localStorage` if available, otherwise an
 *  in-memory shim. */
function defaultAdapter(): StorageAdapter {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
  }
}

/** Build a fresh zero-state in the v2 shape. */
export function emptySessionHistory(): SessionHistoryV2 {
  return {
    schemaVersion: SESSION_HISTORY_SCHEMA_VERSION,
    sessionCount: 0,
    lastSessionCompletedAt: '',
    longestStreakEver: 0,
    cumulativeStardust: 0,
    lastSessionStardust: 0,
    dayStreak: 0,
    todayTreesTouched: { date: '', trees: [] },
    lastSuggestion: null,
    consecutiveOverrides: 0,
    suggestionCooldownUntil: null,
  }
}

/**
 * Promote a v1 payload to v2. All v1 fields are preserved verbatim;
 * the new v2 fields default to their zero-state.
 *
 * Lossless: `migrateV1toV2(v1)` + `(v2 → v1 projection)` round-trips
 * exactly. The migration never throws.
 */
export function migrateV1toV2(prev: SessionHistoryV1): SessionHistoryV2 {
  return {
    schemaVersion: 2,
    sessionCount: prev.sessionCount,
    lastSessionCompletedAt: prev.lastSessionCompletedAt,
    longestStreakEver: prev.longestStreakEver,
    cumulativeStardust: prev.cumulativeStardust,
    lastSessionStardust: 0,
    dayStreak: 0,
    todayTreesTouched: { date: '', trees: [] },
    lastSuggestion: null,
    consecutiveOverrides: 0,
    suggestionCooldownUntil: null,
  }
}

/**
 * Read the persisted session-history state. Returns `emptySessionHistory()`
 * if the key is absent, malformed, or storage throws. Lazily promotes
 * a v1 payload to v2 in-memory; the next write commits the new shape.
 *
 * Never throws. Always returns a usable v2 state.
 */
export function readSessionHistory(
  adapter: StorageAdapter = defaultAdapter(),
): SessionHistoryV2 {
  let raw: string | null
  try {
    raw = adapter.getItem(SESSION_HISTORY_KEY)
  } catch {
    return emptySessionHistory()
  }
  if (raw === null) return emptySessionHistory()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptySessionHistory()
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return emptySessionHistory()
  }
  const v = parsed as Record<string, unknown>

  // v2 first — the common case post-migration. Validate fully.
  if (v.schemaVersion === 2) {
    if (isSessionHistoryV2(v)) return v as unknown as SessionHistoryV2
    return emptySessionHistory()
  }

  // v1 — promote.
  if (v.schemaVersion === 1) {
    if (isSessionHistoryV1(v)) {
      return migrateV1toV2(v as unknown as SessionHistoryV1)
    }
    return emptySessionHistory()
  }

  // Unknown / future schema — safe-fail to empty so a forward-version
  // payload doesn't get clobbered. (Same posture as the original v1
  // module: an unrecognised schema reads as empty.)
  return emptySessionHistory()
}

/**
 * Write the session-history state to storage. Best-effort: a thrown error
 * from setItem is logged once and swallowed.
 */
let _writeWarned = false
export function writeSessionHistory(
  next: SessionHistoryV2,
  adapter: StorageAdapter = defaultAdapter(),
): void {
  try {
    adapter.setItem(SESSION_HISTORY_KEY, JSON.stringify(next))
  } catch (err) {
    if (!_writeWarned) {
      _writeWarned = true
      console.warn(
        `[sessionHistory] setItem failed (${
          err instanceof Error ? err.message : 'unknown'
        }) -- session history will not persist.`,
      )
    }
  }
}

/** Test seam -- reset the once-only warn flag between tests. */
export function _resetSessionHistoryWarn(): void {
  _writeWarned = false
}

/**
 * Compute the next day-streak value at session-end given the previous
 * stored value and the timestamp of the previous completion.
 *
 * Rules (Dave-locked, `screen-hub.md` § "Day-streak computation"):
 *  - First-ever session: streak becomes 1.
 *  - Same calendar day as previous completion: streak unchanged
 *    (already counted today).
 *  - Exactly one calendar day later: streak + 1.
 *  - Two or more days later: silent reset to 1 (the current session
 *    starts a fresh streak).
 *
 * `differenceInCalendarDays` semantics: based on the `now` timezone.
 * We use local-time day boundaries to match Marian's lived experience
 * (a session at 23:55 vs 00:05 should not count as two distinct days
 * if they're the same wall-clock day).
 */
export function nextDayStreak(
  prevDayStreak: number,
  prevLastCompletedAt: string,
  now: Date,
): number {
  if (prevLastCompletedAt === '') return 1
  const prev = new Date(prevLastCompletedAt)
  if (Number.isNaN(prev.getTime())) return 1
  const diff = differenceInCalendarDays(now, prev)
  if (diff <= 0) return Math.max(prevDayStreak, 1) // same day or clock-skew
  if (diff === 1) return prevDayStreak + 1
  return 1 // missed at least one day — fresh streak starting today
}

/**
 * Difference in calendar days between two `Date`s using local-time day
 * boundaries. Implemented inline (rather than depending on date-fns) to
 * keep the bundle lean — same iPad budget rule as everywhere else.
 *
 * Returns a positive integer when `b` is strictly before `a` (so
 * `differenceInCalendarDays(today, yesterday) === 1`).
 */
export function differenceInCalendarDays(a: Date, b: Date): number {
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((aMid - bMid) / 86_400_000)
}

/**
 * Return the local-date in ISO yyyy-mm-dd form. Used as the
 * `todayTreesTouched.date` key.
 */
export function isoDate(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Mark a tree as touched today. Idempotent — a second touch of the
 * same tree on the same day is a no-op. Lazily clears stale entries
 * (different ISO date than today).
 */
export function markTreeTouched(
  prev: SessionHistoryV2,
  tree: SkillTreeId,
  now: Date,
): SessionHistoryV2 {
  const today = isoDate(now)
  const isFreshDay = prev.todayTreesTouched.date !== today
  const baseTrees: SkillTreeId[] = isFreshDay
    ? []
    : prev.todayTreesTouched.trees
  if (!isFreshDay && baseTrees.includes(tree)) return prev
  return {
    ...prev,
    todayTreesTouched: {
      date: today,
      trees: [...baseTrees, tree],
    },
  }
}

/**
 * Read history and return it with any stale `todayTreesTouched` cleared.
 * Convenience wrapper for screens that only want today's trees.
 */
export function readSessionHistoryForToday(
  now: Date,
  adapter: StorageAdapter = defaultAdapter(),
): SessionHistoryV2 {
  const history = readSessionHistory(adapter)
  const today = isoDate(now)
  if (history.todayTreesTouched.date === today) return history
  return {
    ...history,
    todayTreesTouched: { date: today, trees: [] },
  }
}

/**
 * Record that a session just completed. Reads the current state, computes
 * the next state, writes it, and returns the new state.
 *
 * v2 additions (per `screen-hub.md`):
 *  - `lastSessionStardust` mirrors `cumulativeStardust - prev.cumulativeStardust`
 *    when a positive delta exists; otherwise mirrors the absolute total
 *    earned this session if available via the `earnedThisSession` arg.
 *  - `dayStreak` updated per `nextDayStreak` rules.
 *
 * This is the single call Session-End makes on mount.
 */
export function recordSessionEnd(
  finalStreak: number,
  adapter: StorageAdapter = defaultAdapter(),
  now: () => Date = () => new Date(),
  earnedThisSession?: number,
): SessionHistoryV2 {
  const prev = readSessionHistory(adapter)
  const stardustState = loadStardust(adapter)
  const completedAt = now()

  // Prefer the explicit per-session earned value when the caller provides
  // it (Session-End knows this exactly from the originating screen's
  // payload). Otherwise fall back to the cumulative delta — same value in
  // the typical case, but guards against stale `cumulativeStardust` when
  // an external write moment landed between Session-End and recording.
  const cumulativeDelta = stardustState.total - prev.cumulativeStardust
  const lastSessionStardust =
    earnedThisSession !== undefined
      ? earnedThisSession
      : Math.max(0, cumulativeDelta)

  const next: SessionHistoryV2 = {
    schemaVersion: SESSION_HISTORY_SCHEMA_VERSION,
    sessionCount: prev.sessionCount + 1,
    lastSessionCompletedAt: completedAt.toISOString(),
    longestStreakEver: Math.max(prev.longestStreakEver, finalStreak),
    cumulativeStardust: stardustState.total,
    lastSessionStardust,
    dayStreak: nextDayStreak(
      prev.dayStreak,
      prev.lastSessionCompletedAt,
      completedAt,
    ),
    // Keep today's tree-touches if the calendar day hasn't rolled over.
    // This lets the suggestion algorithm see what Marian did this session
    // when computing tomorrow's nudge.
    todayTreesTouched:
      prev.todayTreesTouched.date === isoDate(completedAt)
        ? prev.todayTreesTouched
        : { date: isoDate(completedAt), trees: [] },
    lastSuggestion: prev.lastSuggestion,
    consecutiveOverrides: prev.consecutiveOverrides,
    suggestionCooldownUntil: prev.suggestionCooldownUntil,
  }

  writeSessionHistory(next, adapter)
  return next
}

/** v1 type-guard. Strict: only the original four data fields. */
function isSessionHistoryV1(v: Record<string, unknown>): boolean {
  return (
    v.schemaVersion === 1 &&
    typeof v.sessionCount === 'number' &&
    typeof v.lastSessionCompletedAt === 'string' &&
    typeof v.longestStreakEver === 'number' &&
    typeof v.cumulativeStardust === 'number'
  )
}

/** v2 type-guard. */
function isSessionHistoryV2(v: Record<string, unknown>): boolean {
  if (
    v.schemaVersion !== 2 ||
    typeof v.sessionCount !== 'number' ||
    typeof v.lastSessionCompletedAt !== 'string' ||
    typeof v.longestStreakEver !== 'number' ||
    typeof v.cumulativeStardust !== 'number' ||
    typeof v.lastSessionStardust !== 'number' ||
    typeof v.dayStreak !== 'number' ||
    typeof v.consecutiveOverrides !== 'number'
  ) {
    return false
  }
  if (typeof v.todayTreesTouched !== 'object' || v.todayTreesTouched === null) {
    return false
  }
  const ttt = v.todayTreesTouched as Record<string, unknown>
  if (typeof ttt.date !== 'string') return false
  if (!Array.isArray(ttt.trees)) return false
  if (!ttt.trees.every((t) => t === 'number-garden' || t === 'word-song')) {
    return false
  }
  if (
    v.lastSuggestion !== null &&
    v.lastSuggestion !== 'number-garden' &&
    v.lastSuggestion !== 'word-song'
  ) {
    return false
  }
  if (
    v.suggestionCooldownUntil !== null &&
    typeof v.suggestionCooldownUntil !== 'number'
  ) {
    return false
  }
  return true
}
