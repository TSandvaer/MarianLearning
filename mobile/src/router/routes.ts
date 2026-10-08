/**
 * The native route shell over core's route state machine
 * (`@marian/core/router/route`): same `Route` names, same first route,
 * and the same exits as the web app's `App.tsx` transition handlers.
 * No URLs and no navigation library, by design (see core's `route.ts`).
 *
 * Phase 2a renders a placeholder per route; Phase 3 swaps in the real
 * screens one by one and keeps this table as the contract.
 */
import { FIRST_ROUTE, type Route } from '@marian/core/router/route'

export { FIRST_ROUTE, type Route }

/**
 * Where each route can go next. Mirrors the web's `App.tsx`:
 *
 * - splash → greet | hub          `handleSplashAdvance` (core `nextAfterSplash`)
 * - greet → math                  `handleGreetAdvance` (first-launch sequence)
 * - hub → math | literacy         `handleHubPickTree`
 * - hub → map                     `handleHubOpenMap`
 * - hub → parent-settings         `handleHubParentGate` / long-press
 * - math | literacy → session-end `handleMathComplete` / `handleWordSongComplete`
 * - math | literacy → hub         `handleBackToHub`
 * - session-end → hub | map       `handleSessionEndAllDone` (map: pending unlock)
 * - session-end → math | literacy `handleSessionEndAgain`
 * - map → hub                     `handleMapBack`
 * - parent-settings → hub         `handleParentSettingsExit`
 * - reward → hub                  the web renders no screen for `reward`
 *                                 (a legacy route); the shell gives its
 *                                 placeholder a way out
 */
export const ROUTE_EXITS: Readonly<Record<Route, readonly Route[]>> = {
  splash: ['greet', 'hub'],
  greet: ['math'],
  hub: ['math', 'literacy', 'map', 'parent-settings'],
  math: ['session-end', 'hub'],
  literacy: ['session-end', 'hub'],
  'session-end': ['hub', 'map', 'math', 'literacy'],
  reward: ['hub'],
  'parent-settings': ['hub'],
  map: ['hub'],
}

/** Every route, in `ROUTE_EXITS` order. */
export const ROUTES = Object.keys(ROUTE_EXITS) as readonly Route[]

/** Human labels for the placeholders (developer-facing, not Marian copy). */
export const ROUTE_LABELS: Readonly<Record<Route, string>> = {
  splash: 'Splash',
  greet: 'Greet',
  hub: 'Hub',
  math: 'Number Garden',
  literacy: 'Word Song',
  'session-end': 'Session End',
  reward: 'Reward',
  'parent-settings': 'Parent Settings',
  map: "Emma's Path",
}

/**
 * The route after `current` when `requested` is asked for: `requested`
 * if it is one of `current`'s exits, otherwise `current` (an illegal
 * jump is ignored, and reported in development).
 */
export function nextRoute(current: Route, requested: Route): Route {
  if (ROUTE_EXITS[current].includes(requested)) return requested
  if (__DEV__) {
    console.warn(`[route] ignored ${current} → ${requested}: not an exit`)
  }
  return current
}
