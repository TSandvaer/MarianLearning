/**
 * Self-describing payload + builder for the "Copy state" button.
 *
 * Extracted from `DebugOverlay.tsx` so the component file only exports
 * components (keeps `react-refresh/only-export-components` happy and
 * lets HMR fast-refresh the overlay). The function is also independently
 * testable from `DebugOverlay.test.tsx` without rendering the component.
 */

/**
 * Storage keys for the "Copy state" export.
 *
 * These mirror the canonical constants in `src/lib/progress/storage.ts` and
 * `src/screens/SessionEnd/sessionHistory.ts`. They're redeclared here rather
 * than imported to keep the debug module dependency-light (no circular
 * dependency through the progress module). If these keys ever change, update
 * here too — they're string constants in both places.
 */
const PROGRESS_KEY = 'marian-tutor:progress:v1'
const SESSION_HISTORY_KEY = 'marian-tutor.session-history.v1'
const DEVICE_ID_KEY = 'marian-tutor:device-id'

/**
 * Self-describing payload for the "Copy state" button.
 *
 * Bundles the three localStorage blobs Thomas needs to diagnose
 * persistence bugs (mastery promotion, cloud sync races, etc.) with
 * enough provenance context that the paste is self-explaining.
 *
 * `parentSettings` is embedded inside `progress` (it's a field on the
 * Progress document, not a separate localStorage key) — callers that
 * want to inspect settings read `progress.parentSettings`.
 */
export interface StateExportPayload {
  /** ISO timestamp of the export call. */
  exportedAt: string
  /** `navigator.userAgent` — confirm iPhone model / iOS version. */
  userAgent: string
  /** `window.location.href` — tells PR-preview apart from production. */
  pageUrl: string
  /**
   * Parsed contents of `marian-tutor:progress:v1`. Includes `skillLevels`,
   * `history`, `pendingPromotion`, and `parentSettings` (the sub-field
   * that carries mastery threshold + crossDayEnforcement + autoPromote).
   * `null` if the key is missing, empty, or malformed JSON.
   */
  progress: unknown
  /**
   * Parsed contents of `marian-tutor.session-history.v1`. Hub session
   * count, stardust totals, day streak, etc.
   * `null` if the key is missing, empty, or malformed JSON.
   */
  sessionHistory: unknown
  /**
   * The device UUID used for cloud sync (`marian-tutor:device-id`).
   * Lets us correlate this export with any server-side KV record.
   * Raw string — not parsed.
   */
  deviceId: string | null
}

/**
 * Safely read and JSON-parse a localStorage key. Returns `null` when
 * the key is missing, the storage backend is unavailable, or parsing
 * fails. Raw-string fields (like `deviceId`) use `safeGetRaw` below
 * instead.
 */
function safeGetParsed(key: string): unknown {
  if (typeof window === 'undefined' || !window.localStorage) return null
  let raw: string | null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    // Return the raw string so the payload is still useful when JSON is
    // corrupted — Thomas can at least see the malformed value.
    return raw
  }
}

/** Safely read a localStorage key as a raw string (no JSON parsing). */
function safeGetRaw(key: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Build the state export payload. Wrapped in a function so tests can
 * assert the shape without reaching into the component.
 */
export function buildStateExportPayload(
  now: number = Date.now(),
): StateExportPayload {
  let pageUrl = '(unknown)'
  try {
    if (typeof window !== 'undefined' && window.location?.href) {
      pageUrl = window.location.href
    }
  } catch {
    // cross-origin / sandbox — keep default
  }
  let userAgent = '(unknown)'
  try {
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      userAgent = navigator.userAgent
    }
  } catch {
    // ignore
  }

  return {
    exportedAt: new Date(now).toISOString(),
    userAgent,
    pageUrl,
    progress: safeGetParsed(PROGRESS_KEY),
    sessionHistory: safeGetParsed(SESSION_HISTORY_KEY),
    deviceId: safeGetRaw(DEVICE_ID_KEY),
  }
}
