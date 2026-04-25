/**
 * localStorage adapter for the Progress document.
 *
 * Single key (`STORAGE_KEY`). Always JSON. Versioned via `schemaVersion`
 * inside the document — if the version doesn't match, we route through
 * `migrate()` instead of bumping the key.
 *
 * Pure module: zero React, zero side effects beyond `window.localStorage`.
 */

import { isProgressV1, readSchemaVersion } from './guards'
import { migrate } from './migrate'
import type { Progress } from './types'
import { CURRENT_SCHEMA_VERSION } from './types'

export const STORAGE_KEY = 'marian-tutor:progress:v1'

/** Cap on `Progress.history.length`. Older entries drop on save. */
export const MAX_SESSION_HISTORY = 30

/**
 * Load the persisted progress document.
 *
 * Returns:
 * - `null` if nothing is stored, or the storage backend is unavailable
 * - `null` if the stored blob is not valid JSON
 * - `null` if the blob is JSON but cannot be migrated to the current shape
 * - the parsed `Progress` otherwise
 */
export function loadProgress(): Progress | null {
  const raw = safeGetItem(STORAGE_KEY)
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  const version = readSchemaVersion(parsed)
  if (version === null) return null

  if (version === CURRENT_SCHEMA_VERSION) {
    return isProgressV1(parsed) ? parsed : null
  }

  // Different version (older or newer) — route through migrate.
  return migrate(parsed)
}

/**
 * Persist the progress document.
 *
 * Trims `history` to `MAX_SESSION_HISTORY` to keep the blob small.
 * Throws nothing — storage failures (quota, private mode) are swallowed
 * because progress is best-effort, never a blocker for play.
 */
export function saveProgress(p: Progress): void {
  const trimmed: Progress =
    p.history.length > MAX_SESSION_HISTORY
      ? { ...p, history: p.history.slice(-MAX_SESSION_HISTORY) }
      : p

  let serialized: string
  try {
    serialized = JSON.stringify(trimmed)
  } catch {
    return
  }

  safeSetItem(STORAGE_KEY, serialized)
}

/** Remove the stored progress document. Used by reset flows / tests. */
export function clearProgress(): void {
  safeRemoveItem(STORAGE_KEY)
}

// --------------------------------------------------------------------------
// internals — every localStorage touch goes through these so SSR / private
// mode / locked-down iframes don't crash the boot.
// --------------------------------------------------------------------------

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(key, value)
  } catch {
    // Quota exceeded, private mode, etc. — silently drop.
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
