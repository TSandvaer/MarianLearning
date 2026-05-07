/**
 * Per-device UUID for cloud-sync (ticket 86c9pkfyu).
 *
 * Generated once on first launch via `crypto.randomUUID()`, persisted to
 * localStorage as `marian-tutor:device-id`. Used by /api/progress as the
 * key for Marian's cloud-backup blob. Idempotent — second launch reads
 * the existing UUID; never re-generates unless the stored value is
 * malformed.
 *
 * Why a UUID, not a derived key
 * -----------------------------
 * The cloud blob carries `childName: "Marian"` AS-IS so a per-name key
 * would collapse to one bucket per child. UUID-keying:
 *   - Implicitly enables multi-child later (different iPad → different
 *     UUID → independent backup).
 *   - Implicitly hands "factory reset" recovery to the user — they
 *     paste their UUID into the Restore field on the new device.
 *   - Doesn't leak any user-identifying info in the KV key surface.
 *
 * Storage shape
 * -------------
 * Plain string, NOT JSON. Storing as bare text keeps it readable in
 * Safari Web Inspector for support / debugging and avoids quoting noise.
 *
 * Failure modes
 * -------------
 * - localStorage unavailable (SSR, private mode, locked iframe): returns
 *   a freshly-generated UUID per call. Cloud-sync still functions for
 *   the lifetime of the page; no persistent device identity.
 * - `crypto.randomUUID()` unavailable (iOS Safari < 15.4 — unlikely on
 *   Marian's iPad but possible on other family devices): falls back to
 *   a Math.random-based RFC-4122-shaped UUID. Quality is lower (the
 *   fallback isn't cryptographically random) but the app's threat model
 *   doesn't depend on UUID unguessability — it's a backup key, not a
 *   secret.
 *
 * Validation
 * ----------
 * On read, the stored value is shape-checked against an RFC 4122 v4
 * pattern. A corrupt value (e.g. an old `marian-tutor:device-id`
 * written by a development build with a different shape) regenerates.
 */

export const DEVICE_ID_STORAGE_KEY = 'marian-tutor:device-id'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Read the current device UUID, generating + persisting one on first
 * launch.
 *
 * Idempotent: subsequent calls return the same value. Returns a fresh
 * UUID when storage is unavailable so callers always get a non-empty
 * string (the cloud-sync flow degrades to "ephemeral identity for this
 * page lifetime" rather than crashing).
 */
export function getOrCreateDeviceId(): string {
  const existing = readStoredDeviceId()
  if (existing !== null) return existing
  const fresh = generateUuid()
  writeStoredDeviceId(fresh)
  return fresh
}

/**
 * Read the stored device UUID without generating a new one.
 *
 * Returns `null` when no value is stored, when storage is unavailable,
 * or when the stored value fails the UUID shape check. Callers that
 * need the "is this a freshly-keyed device?" signal use this to
 * distinguish "first launch" from "returning launch."
 */
export function readStoredDeviceId(): string | null {
  const raw = safeGetItem(DEVICE_ID_STORAGE_KEY)
  if (raw === null) return null
  if (!isValidUuid(raw)) return null
  return raw
}

/**
 * Force-write a device UUID to storage. Used by the Parent Settings
 * "Restore from device ID" flow — the parent pastes a UUID from another
 * device, we validate it, then this writer installs it locally so the
 * subsequent reconcile pulls that device's blob.
 */
export function writeStoredDeviceId(deviceId: string): void {
  safeSetItem(DEVICE_ID_STORAGE_KEY, deviceId)
}

/** Public predicate for callers that accept paste input from a parent. */
export function isValidUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_PATTERN.test(v)
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function generateUuid(): string {
  // crypto.randomUUID() is available on iOS Safari 15.4+ — Marian's iPad
  // supports this, no polyfill needed in the production target. The
  // fallback exists for non-target browsers (test runners, older iOS,
  // an embedded webview that wraps an older WebKit). Quality is lower
  // but the cloud-sync threat model doesn't depend on unguessability.
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    try {
      return crypto.randomUUID()
    } catch {
      // Fall through.
    }
  }
  return fallbackUuid()
}

function fallbackUuid(): string {
  // RFC 4122 v4-shaped — Math.random()-based. NOT cryptographically
  // strong; acceptable for the threat model (see header).
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  // Set version (4) and variant (8/9/a/b) bits per RFC 4122.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  )
}

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
    // Quota / private mode / locked iframe — silently drop. The caller
    // (cloud-sync) degrades to "ephemeral identity for this page" and
    // continues without crashing.
  }
}
