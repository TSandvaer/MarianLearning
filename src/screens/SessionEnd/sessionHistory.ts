/**
 * Session-history persistence for Session End.
 *
 * Spec: `design/screen-5-session-end.md` section "localStorage updates at
 * session end". This is the canonical write moment for cross-session
 * progress state.
 *
 * Schema: `marian-tutor.session-history.v1`
 *
 * Defensive posture
 * -----------------
 * iOS Safari in private browsing throws `QuotaExceededError` on every
 * `setItem`. We wrap reads + writes in try/catch and fall through to
 * in-memory defaults. Mirrors the same pattern from Math's `stardust.ts`.
 *
 * Pure functions, not a class
 * ---------------------------
 * All helpers accept an injected `StorageAdapter` so tests can use an
 * in-memory map. Defaults to `window.localStorage` in production.
 */

import type { StorageAdapter } from '../Math/stardust'
import { loadStardust } from '../Math/stardust'

/** Single source of truth for the storage key. */
export const SESSION_HISTORY_KEY = 'marian-tutor.session-history.v1'

export const SESSION_HISTORY_SCHEMA_VERSION = 1 as const

/** The on-disk shape. */
export interface SessionHistoryV1 {
  schemaVersion: typeof SESSION_HISTORY_SCHEMA_VERSION
  /** Total sessions completed (any tree). Increments by 1 per Session-End
   *  screen reached. */
  sessionCount: number
  /** ISO-8601 timestamp of the most-recently-completed session.
   *  Empty string sentinel when `sessionCount === 0`. */
  lastSessionCompletedAt: string
  /** Longest single-session streak ever recorded. Only updated if current
   *  `finalStreak > stored value`. */
  longestStreakEver: number
  /** Cumulative stardust across all sessions ever. Mirrors
   *  `marian-tutor.stardust.v1.total` but written here for atomicity. */
  cumulativeStardust: number
}

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

/** Build a fresh zero-state. */
export function emptySessionHistory(): SessionHistoryV1 {
  return {
    schemaVersion: SESSION_HISTORY_SCHEMA_VERSION,
    sessionCount: 0,
    lastSessionCompletedAt: '',
    longestStreakEver: 0,
    cumulativeStardust: 0,
  }
}

/**
 * Read the persisted session-history state. Returns `emptySessionHistory()`
 * if the key is absent, malformed, or storage throws.
 *
 * Never throws. Always returns a usable state.
 */
export function readSessionHistory(
  adapter: StorageAdapter = defaultAdapter(),
): SessionHistoryV1 {
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

  if (!isSessionHistory(parsed)) return emptySessionHistory()
  if (parsed.schemaVersion !== SESSION_HISTORY_SCHEMA_VERSION) {
    return emptySessionHistory()
  }

  return parsed
}

/**
 * Write the session-history state to storage. Best-effort: a thrown error
 * from setItem is logged once and swallowed.
 */
let _writeWarned = false
export function writeSessionHistory(
  next: SessionHistoryV1,
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
 * Record that a session just completed. Reads the current state, computes
 * the next state, writes it, and returns the new state.
 *
 * This is the single call Session-End makes on mount.
 */
export function recordSessionEnd(
  finalStreak: number,
  adapter: StorageAdapter = defaultAdapter(),
  now: () => Date = () => new Date(),
): SessionHistoryV1 {
  const prev = readSessionHistory(adapter)
  const stardustState = loadStardust(adapter)

  const next: SessionHistoryV1 = {
    schemaVersion: SESSION_HISTORY_SCHEMA_VERSION,
    sessionCount: prev.sessionCount + 1,
    lastSessionCompletedAt: now().toISOString(),
    longestStreakEver: Math.max(prev.longestStreakEver, finalStreak),
    cumulativeStardust: stardustState.total,
  }

  writeSessionHistory(next, adapter)
  return next
}

function isSessionHistory(value: unknown): value is SessionHistoryV1 {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.schemaVersion === 'number' &&
    typeof v.sessionCount === 'number' &&
    typeof v.lastSessionCompletedAt === 'string' &&
    typeof v.longestStreakEver === 'number' &&
    typeof v.cumulativeStardust === 'number'
  )
}
