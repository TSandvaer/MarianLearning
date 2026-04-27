/**
 * Stardust persistence shared by Math and Word Song screens.
 *
 * Spec
 * ----
 * `design/screen-3-math.md` §"Stardust treatment" → "Persistence":
 *
 *   - localStorage key: `marian-tutor.stardust.v1`
 *   - Schema: `{ "total": number, "lastUpdatedAt": ISO string, "schemaVersion": 1 }`
 *   - Read on Math screen mount; write after every increment _and_ on session
 *     end. Atomic synchronous setItem — no partial-write races.
 *   - The `schemaVersion` field exists so v2's unlock loop (if we add one)
 *     can migrate cleanly.
 *   - **No streak persistence** — streak is per-session only and resets to 0
 *     on session end.
 *
 * Defensive posture
 * -----------------
 * iOS Safari in private browsing throws `QuotaExceededError` on every
 * setItem. CLAUDE.md's localStorage policy implies this code must not crash
 * the screen if storage is unavailable. We wrap reads + writes in try/catch
 * and fall through to in-memory defaults; missed writes are logged once via
 * `console.warn` so a failed iPad install surfaces in the debug overlay
 * (`?debug=1`) rather than silently losing stardust.
 *
 * Pure functions, not a class
 * ---------------------------
 * The `StardustState` shape is the source of truth; `loadStardust` and
 * `writeStardust` are pure over an injected `StorageAdapter`. The screen
 * keeps the loaded total in React state and writes through on every
 * increment. This mirrors the test seam pattern used in `Greet` (pass an
 * in-memory adapter for tests, default to `window.localStorage` in
 * production).
 */

/** Single source of truth for the storage key. */
export const STARDUST_STORAGE_KEY = 'marian-tutor.stardust.v1'

/** Persisted schema version. Bump on any breaking shape change; load() will
 *  migrate or discard older payloads. v1 is the only version that exists. */
export const STARDUST_SCHEMA_VERSION = 1 as const

/** The on-disk shape. */
export interface StardustState {
  total: number
  lastUpdatedAt: string // ISO 8601
  schemaVersion: typeof STARDUST_SCHEMA_VERSION
}

/** Minimal Storage shape we depend on. Matches `window.localStorage`. */
export interface StorageAdapter {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

/** Default adapter — `window.localStorage` if available, otherwise an
 *  in-memory shim. The shim exists so SSR / non-browser test contexts don't
 *  blow up at module-load. */
function defaultAdapter(): StorageAdapter {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  // Minimal in-memory fallback. Persists for the lifetime of the JS context
  // only — a page reload resets it. Better than crashing.
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
  }
}

/** Build a fresh zero-state. Single source of truth for the initial total. */
export function emptyStardust(): StardustState {
  return {
    total: 0,
    lastUpdatedAt: new Date(0).toISOString(),
    schemaVersion: STARDUST_SCHEMA_VERSION,
  }
}

/**
 * Load the persisted stardust state. Returns `emptyStardust()` if:
 *   - No stored value exists (first session).
 *   - The stored value is malformed JSON (corrupted; reset is the safest
 *     recovery — no game-state lost beyond the counter).
 *   - The stored value's schemaVersion doesn't match (future migration
 *     hook; today we discard rather than attempt forward-compat).
 *   - Storage throws on read (iOS private mode, sandboxed iframe, etc.).
 *
 * Never throws. Always returns a usable state.
 */
export function loadStardust(
  adapter: StorageAdapter = defaultAdapter(),
): StardustState {
  let raw: string | null
  try {
    raw = adapter.getItem(STARDUST_STORAGE_KEY)
  } catch {
    // localStorage can throw in restrictive environments. Default zero.
    return emptyStardust()
  }
  if (raw === null) return emptyStardust()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Corrupted JSON → reset. Prefer "she starts at 0 again" over crashing.
    return emptyStardust()
  }

  if (!isStardustState(parsed)) return emptyStardust()
  if (parsed.schemaVersion !== STARDUST_SCHEMA_VERSION) return emptyStardust()
  // Defensive: clamp negatives (shouldn't happen, but if it does, treat as 0).
  if (!Number.isFinite(parsed.total) || parsed.total < 0) {
    return { ...parsed, total: 0 }
  }
  return parsed
}

/**
 * Write the stardust state to storage. Best-effort: a thrown error from
 * setItem (quota, sandbox, private mode) is logged once and swallowed —
 * the screen keeps working with the in-memory total even if persistence
 * silently degrades.
 *
 * The `lastUpdatedAt` field is set HERE, not by the caller, so all writes
 * go through a consistent timestamp source. Pass `now` to inject a clock
 * for tests.
 */
let _writeWarned = false
export function writeStardust(
  total: number,
  adapter: StorageAdapter = defaultAdapter(),
  now: () => Date = () => new Date(),
): StardustState {
  // Defensive clamp — never persist negatives.
  const safeTotal = Math.max(0, Math.floor(total))
  const next: StardustState = {
    total: safeTotal,
    lastUpdatedAt: now().toISOString(),
    schemaVersion: STARDUST_SCHEMA_VERSION,
  }
  try {
    adapter.setItem(STARDUST_STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    if (!_writeWarned) {
      _writeWarned = true

      console.warn(
        `[stardust] setItem failed (${
          err instanceof Error ? err.message : 'unknown'
        }) — stardust will not persist this session.`,
      )
    }
  }
  return next
}

/** Test seam — reset the once-only warn flag between tests. */
export function _resetStardustWarn(): void {
  _writeWarned = false
}

function isStardustState(value: unknown): value is StardustState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.total !== 'number') return false
  if (typeof v.lastUpdatedAt !== 'string') return false
  if (typeof v.schemaVersion !== 'number') return false
  return true
}
