import { readSessionHistory } from '../sessionEnd/sessionHistory'
import type { Route } from './route'

/**
 * The route after Splash, per `design/screen-hub.md` § "Navigation
 * contract" Q1. Shared by the web app and the native app so both branch
 * on the same persisted value:
 *
 *   - `sessionCount === 0` (first-ever launch) → Greet (then Math →
 *     SessionEnd → Hub via the standard flow).
 *   - `sessionCount >= 1` → Hub directly. Greet is a once-ever moment
 *     and never re-shows on subsequent launches.
 *
 * Reads `marian-tutor.session-history.v1` (v2-aware via the lazy
 * migration in `sessionEnd/sessionHistory.ts`) through the installed
 * `KeyValueStore` — a missing / malformed key, or no store at all,
 * reads as `sessionCount === 0`, so the first-ever path is the safe
 * default if storage is unavailable.
 */
export function nextAfterSplash(): Extract<Route, 'greet' | 'hub'> {
  try {
    const history = readSessionHistory()
    return history.sessionCount === 0 ? 'greet' : 'hub'
  } catch {
    return 'greet'
  }
}
