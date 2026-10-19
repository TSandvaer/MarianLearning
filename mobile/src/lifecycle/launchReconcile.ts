/**
 * The launch-time cloud reconcile (the web's boot effect, `src/App.tsx`),
 * once per launch. Core's `reconcileAtLaunch` does the work: off without
 * `EXPO_PUBLIC_PROGRESS_API_SECRET`, never rejects, and keeps local
 * progress on any failure. This module latches it to the JS runtime, so a
 * remount of App never reads, writes or sends a second time. With learner
 * profiles the latch is per learner, and each run is bound to its learner
 * (`launchReconcileDeps`): a newer cloud doc lands in the learner it
 * started for, whoever plays by then.
 *
 * Nothing waits for it. A newer cloud blob is installed in storage, and
 * every screen that mounts after that reads it. A Hub already on screen
 * keeps the visit it planned at mount (the native Hub decides its visit
 * once, and remounting it would cut Emma off mid-line), so it shows the
 * cloud progress from its next entry. The web re-projects a mounted Hub.
 */
import { activeLearner, launchReconcileDeps } from '@marian/core/learners'
import {
  reconcileAtLaunch,
  type LaunchReconcileResult,
} from '@marian/core/progress'

/**
 * One run per learner per launch (learner profiles § 2.3 step 4): a switch
 * starts the next learner's reconcile, bound to them, and a switch back
 * gets the first run. Keyed '' with no list installed (a failed boot).
 */
const launches = new Map<string, Promise<LaunchReconcileResult>>()

function reconcilePlaying(): Promise<LaunchReconcileResult> {
  const learner = activeLearner()
  return learner === null
    ? reconcileAtLaunch()
    : reconcileAtLaunch(launchReconcileDeps(learner))
}

/**
 * Start the playing learner's reconcile on their first call this launch;
 * later calls for them get the same run.
 */
export function reconcileOncePerLaunch(
  run: () => Promise<LaunchReconcileResult> = reconcilePlaying,
): Promise<LaunchReconcileResult> {
  const key = activeLearner()?.id ?? ''
  let launch = launches.get(key)
  if (launch === undefined) {
    launch = run()
    launches.set(key, launch)
  }
  return launch
}

/** Tests: the next call is a new launch. */
export function resetLaunchReconcileForTests(): void {
  launches.clear()
}
