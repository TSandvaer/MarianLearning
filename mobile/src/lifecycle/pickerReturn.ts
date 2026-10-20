/**
 * The return rule (learner profiles § 2.2, Dave D4): back from 10 minutes
 * or more in the background, on a device with 2 or more learners, on
 * Greet, the Hub, the Map or Session End, the app asks "Who is playing?".
 * Math, Word Song and a peek are never interrupted: a session belongs to
 * the learner who started it. Leaving the four routes loses nothing:
 * Session End's one write runs on mount, and Greet and the Hub only hold
 * a kicked or prefetched session, which the route change tears down.
 */
import type { Route } from '../router/routes'

export const PICKER_AFTER_HIDDEN_MS = 600_000

export const PICKER_RETURN_ROUTES: ReadonlySet<Route> = new Set<Route>([
  'greet',
  'hub',
  'map',
  'session-end',
])

export function opensPickerOnReturn(
  route: Route,
  hiddenForMs: number,
  learnerCount: number,
): boolean {
  return (
    learnerCount >= 2 &&
    hiddenForMs >= PICKER_AFTER_HIDDEN_MS &&
    PICKER_RETURN_ROUTES.has(route)
  )
}
