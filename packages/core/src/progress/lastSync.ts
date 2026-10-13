/**
 * This device's last successful cloud sync: native Parent Settings'
 * "Last synced" row (`design/native/parent-settings-native.md` § 4).
 *
 * "Successful" is cloudSync's sync-success listener: this device and its
 * cloud copy agreed after a cloud call (`setCloudSyncSuccessListener`).
 * The native host installs `() => recordLastSync()` as that listener.
 *
 * Device-local on purpose. The time lives under its own key, never inside
 * the Progress blob, so it is never pushed to the cloud and a Restore
 * never carries another device's time here. Plain ISO text, like the
 * device ID beside it.
 *
 * The web neither writes nor reads it: its row shows
 * `profile.lastPlayedISO` (frozen).
 */
import { getKeyValueStore } from '../platform/keyValueStore'

export const LAST_SYNC_STORAGE_KEY = 'marian-tutor:last-sync'

/**
 * The stored time as an ISO string, or `null`: nothing stored, no store,
 * a store that throws, or a value that isn't a date.
 */
export function readLastSyncISO(): string | null {
  try {
    const raw = getKeyValueStore()?.getItem(LAST_SYNC_STORAGE_KEY) ?? null
    if (raw === null || Number.isNaN(Date.parse(raw))) return null
    return raw
  } catch {
    return null
  }
}

/** Store `at` (default: now) as the last successful sync. Never throws. */
export function recordLastSync(at: Date = new Date()): void {
  try {
    getKeyValueStore()?.setItem(LAST_SYNC_STORAGE_KEY, at.toISOString())
  } catch {
    // Quota / closed database: the row keeps its previous value.
  }
}
