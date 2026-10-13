/**
 * The launch-time cloud reconcile (the web's boot effect, `src/App.tsx`),
 * once per launch. Core's `reconcileAtLaunch` does the work: off without
 * `EXPO_PUBLIC_PROGRESS_API_SECRET`, never rejects, and keeps local
 * progress on any failure. This module latches it to the JS runtime, so a
 * remount of App never reads, writes or sends a second time.
 *
 * Nothing waits for it. A newer cloud blob is installed in storage, and
 * every screen that mounts after that reads it. A Hub already on screen
 * keeps the visit it planned at mount (the native Hub decides its visit
 * once, and remounting it would cut Emma off mid-line), so it shows the
 * cloud progress from its next entry. The web re-projects a mounted Hub.
 */
import {
  reconcileAtLaunch,
  type LaunchReconcileResult,
} from '@marian/core/progress'

let launch: Promise<LaunchReconcileResult> | null = null

/** Start the reconcile on the first call; later calls get the same run. */
export function reconcileOncePerLaunch(
  run: () => Promise<LaunchReconcileResult> = () => reconcileAtLaunch(),
): Promise<LaunchReconcileResult> {
  launch ??= run()
  return launch
}

/** Tests: the next call is a new launch. */
export function resetLaunchReconcileForTests(): void {
  launch = null
}
