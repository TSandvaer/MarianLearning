/**
 * The launch-time cloud reconcile (ticket 86c9pkfyu), as one call for
 * the native App. The web runs the same steps inline in its boot effect
 * (`src/App.tsx`, frozen): this device's ID, the local progress, then
 * `reconcileWithCloud`, whose outcome says whether a newer cloud blob was
 * installed. `launchReconcile.test.ts` pins the two equal.
 *
 * One native difference: with no progress secret the reconcile is off.
 * Nothing is read, written (not even a device ID) or sent, and nothing is
 * logged. The web runs it anyway and gets `auth-not-configured` back.
 *
 * Never rejects. A cloud failure is `reconcileWithCloud`'s `cloud-error`
 * (local untouched); a throwing step resolves to `threw`, also with local
 * untouched, because the install is the reconcile's last step.
 */
import {
  isCloudSyncConfigured,
  reconcileWithCloud,
  type ReconcileOutcome,
} from './cloudSync'
import { getOrCreateDeviceId } from './deviceId'
import { loadProgress } from './storage'
import type { Progress } from './types'

export type LaunchReconcileResult =
  /** No progress secret in this build: cloud sync is off. */
  | { kind: 'off' }
  /** A step threw (never expected: each one catches its own errors). */
  | { kind: 'threw' }
  | ReconcileOutcome

export interface LaunchReconcileDeps {
  configured: () => boolean
  getDeviceId: () => string
  loadLocal: () => Progress | null
  reconcile: (
    deviceId: string,
    local: Progress | null,
  ) => Promise<ReconcileOutcome>
}

const DEFAULT_DEPS: LaunchReconcileDeps = {
  configured: isCloudSyncConfigured,
  getDeviceId: getOrCreateDeviceId,
  loadLocal: loadProgress,
  reconcile: (deviceId, local) => reconcileWithCloud(deviceId, local),
}

export async function reconcileAtLaunch(
  deps: LaunchReconcileDeps = DEFAULT_DEPS,
): Promise<LaunchReconcileResult> {
  try {
    if (!deps.configured()) return { kind: 'off' }
    const deviceId = deps.getDeviceId()
    const local = deps.loadLocal()
    return await deps.reconcile(deviceId, local)
  } catch {
    return { kind: 'threw' }
  }
}
