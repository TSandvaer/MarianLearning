/**
 * Splash timing — the platform-free half. The web's warm/cold detection
 * (sessionStorage + the Navigation Timing API) stays in
 * `src/screens/splashTiming.ts`, which re-exports these.
 *
 * Spec: design/session-1.md, Screen 1 §States
 *  - warm cache: 1500 ms
 *  - cold cache: up to 3000 ms (force-advance)
 *  - default to cold cap if detection is uncertain (safer for first launch)
 */

export const WARM_CAP_MS = 1500
export const COLD_CAP_MS = 3000

export type ColdStartDetector = () => boolean

/** Returns the auto-advance cap (ms) for this start. */
export function splashCapMs(isCold: boolean): number {
  return isCold ? COLD_CAP_MS : WARM_CAP_MS
}
