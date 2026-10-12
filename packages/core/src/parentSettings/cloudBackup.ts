/**
 * Parent Settings: the Cloud backup section's state machines and the
 * device-ID restore flow (ticket 86c9pkfyu), shared by the web and
 * native screens. The network itself is `../progress/cloudSync`.
 *
 * Three status machines:
 *   - copy (backup JSON, device ID): idle → copied | error
 *   - push now:   idle → sending → sent | failed | skipped
 *   - restore:    idle → invalid-format | restoring → restored | restore-failed
 *
 * The web resets the device-ID copy and the push statuses to idle
 * `STATUS_RESET_MS` after they change (its backup copy status never
 * resets). Native resets every transient status, from the latest tap
 * (`design/native/parent-settings-native.md` § 5).
 *
 * Two restore flows: `adoptDeviceId` (web: install the ID, then
 * reconcile) and `adoptDeviceIdAfterRead` (native: reconcile, then install
 * the ID once the other device's record was read).
 */
import {
  reconcileWithCloud,
  type ReconcileOutcome,
} from '../progress/cloudSync'
import { isValidUuid, writeStoredDeviceId } from '../progress/deviceId'
import { loadProgress } from '../progress/storage'
import type { Progress } from '../progress/types'

export type CopyStatus = 'idle' | 'copied' | 'error'

export type PushStatus = 'idle' | 'sending' | 'sent' | 'failed' | 'skipped'

export type RestoreStatus =
  | { kind: 'idle' }
  | { kind: 'invalid-format' }
  | { kind: 'restoring' }
  | { kind: 'restored'; outcome: ReconcileOutcome }
  | { kind: 'restore-failed'; reason: string }

/** How long a transient status (device-ID copy, push) stays up. */
export const STATUS_RESET_MS = 2400

/** Does this push status go back to idle after `STATUS_RESET_MS`? */
export function pushStatusResets(status: PushStatus): boolean {
  return status === 'sent' || status === 'failed' || status === 'skipped'
}

/** Does the device-ID copy status go back to idle after `STATUS_RESET_MS`? */
export function copyStatusResets(status: CopyStatus): boolean {
  return status !== 'idle'
}

// ── Restore from device ID ─────────────────────────────────────────────

/** The pasted text as a device ID (trimmed), or null when it isn't one. */
export function parseRestoreInput(raw: string): string | null {
  const trimmed = raw.trim()
  return isValidUuid(trimmed) ? trimmed : null
}

/** The Restore button is enabled with some input and no restore running. */
export function canSubmitRestore(
  input: string,
  status: RestoreStatus,
): boolean {
  return input.trim().length > 0 && status.kind !== 'restoring'
}

/** Typing clears an invalid-format message; any other status stays. */
export function restoreStatusAfterEdit(status: RestoreStatus): RestoreStatus {
  return status.kind === 'invalid-format' ? { kind: 'idle' } : status
}

/** The reason a rejected restore shows in brackets. */
export function restoreFailureReason(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown'
}

/**
 * The status line's test tag (web `data-status`), or null when the
 * status shows no line.
 */
export function restoreStatusTag(status: RestoreStatus): string | null {
  switch (status.kind) {
    case 'invalid-format':
      return 'invalid-format'
    case 'restored':
      return `restored-${status.outcome.kind}`
    case 'restore-failed':
      return 'restore-failed'
    default:
      return null
  }
}

/**
 * The Progress the screen shows after a restore: the installed blob, or
 * a fresh read of storage (null: keep what is shown).
 */
export function progressAfterRestore(
  outcome: ReconcileOutcome,
  reload: () => Progress | null,
): Progress | null {
  if (outcome.kind === 'installed-from-cloud') return outcome.progress
  return reload()
}

export interface AdoptDeviceIdDeps {
  writeDeviceId: (uuid: string) => void
  loadLocal: () => Progress | null
  reconcile: (uuid: string, local: Progress | null) => Promise<ReconcileOutcome>
}

const DEFAULT_ADOPT_DEPS: AdoptDeviceIdDeps = {
  writeDeviceId: writeStoredDeviceId,
  loadLocal: loadProgress,
  reconcile: (uuid, local) => reconcileWithCloud(uuid, local),
}

/**
 * Adopt another device's ID: install it as this device's ID, then
 * reconcile against it. A cloud-newer blob is installed locally (history
 * union-merged) and the outcome says so. The ID is installed first, so
 * later session-end pushes go to that device's record even if this
 * reconcile fails. Async, so a throwing dependency rejects (never throws
 * into the tap handler).
 */
export async function adoptDeviceId(
  uuid: string,
  deps: AdoptDeviceIdDeps = DEFAULT_ADOPT_DEPS,
): Promise<ReconcileOutcome> {
  deps.writeDeviceId(uuid)
  return deps.reconcile(uuid, deps.loadLocal())
}

/**
 * Adopt another device's ID, read first (native). Reconcile against the
 * ID, then install it as this device's ID, unless the cloud read failed
 * (`cloud-error`): then nothing changed and this device keeps its own ID.
 *
 * Why not the web's order: the native screen aborts its request when it
 * unmounts (Done mid-restore). With the ID installed first, an aborted
 * read would leave this device on the other device's ID with its own
 * progress, and its next session-end push would overwrite that device's
 * cloud record. Read-first makes an aborted or failed restore a no-op.
 * Once the read succeeded, the install (inside the reconcile) and the ID
 * write both land, even after the screen is gone.
 */
export async function adoptDeviceIdAfterRead(
  uuid: string,
  deps: AdoptDeviceIdDeps = DEFAULT_ADOPT_DEPS,
): Promise<ReconcileOutcome> {
  const outcome = await deps.reconcile(uuid, deps.loadLocal())
  if (outcome.kind !== 'cloud-error') deps.writeDeviceId(uuid)
  return outcome
}
