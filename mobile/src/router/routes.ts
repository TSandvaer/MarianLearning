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
 * - splash → picker               native only: 2+ learners (learner profiles § 1.1)
 * - picker → greet | hub          the tap: Greet if that learner never played
 * - hub | greet | map | session-end | parent-settings → picker
 *                                 native only, 2+ learners: the badge, the
 *                                 return rule and Parent Settings' Done
 *                                 (§§ 1.1, 2.1–2.2, 3.1)
 * - greet → math                  `handleGreetAdvance` (first-launch sequence)
 * - hub → math | literacy         `handleHubPickTree`
 * - hub → map                     `handleHubOpenMap`
 * - hub → parent-settings         `handleHubParentGate` / long-press
 * - math | literacy → session-end `handleMathComplete` / `handleWordSongComplete`
 * - math | literacy → hub         `handleBackToHub`
 * - math | literacy → map         native only: Back from a session the Map
 *                                 started (map-tap-to-play § 4)
 * - session-end → hub | map       `handleSessionEndAllDone` (map: pending unlock)
 * - session-end → math | literacy `handleSessionEndAgain`
 * - map → hub                     `handleMapBack`
 * - map → peek                    native only: a later stop's peek
 *                                 (fast-track spec § 6.1), or a mastered
 *                                 stop's replay (map-tap-to-play § 3)
 * - map → math | literacy         native only: the current stop starts the
 *                                 Hub card's session (map-tap-to-play § 1)
 * - peek → map                    the closer's end, or the back button
 * - hub → play-place → hub        native only: the Hub's Play disc, and the
 *                                 Play place's Home (play-place spec § 1.4)
 * - play-place → play-game → play-place
 *                                 native only: a tile, and a game's Back or
 *                                 natural stop
 * - play-place → picker           native only: the return rule
 * - parent-settings → hub         `handleParentSettingsExit`
 * - reward → hub                  the web renders no screen for `reward`
 *                                 (a legacy route); the shell gives its
 *                                 placeholder a way out
 */
export const ROUTE_EXITS: Readonly<Record<Route, readonly Route[]>> = {
  splash: ['picker', 'greet', 'hub'],
  picker: ['greet', 'hub'],
  greet: ['math', 'picker'],
  hub: ['math', 'literacy', 'map', 'parent-settings', 'picker', 'play-place'],
  math: ['session-end', 'hub', 'map'],
  literacy: ['session-end', 'hub', 'map'],
  'session-end': ['hub', 'map', 'math', 'literacy', 'picker'],
  reward: ['hub'],
  'parent-settings': ['hub', 'picker'],
  map: ['hub', 'peek', 'math', 'literacy', 'picker'],
  peek: ['map'],
  'play-place': ['hub', 'play-game', 'picker'],
  'play-game': ['play-place'],
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
  peek: 'Peek',
  picker: 'Who is playing',
  'play-place': 'Play place',
  'play-game': 'Play game',
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
