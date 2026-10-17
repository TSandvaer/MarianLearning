/**
 * Map tap-to-play (native spec `design/native/map-tap-to-play.md` § 1,
 * Thomas 2026-10-17: "if i click on an island that is unlocked on the map
 * it should jump in … and start the questions"). What a stop's tap does:
 *
 * - `'play'`: the current stop starts exactly the Hub card's session for
 *   that world (D1).
 * - `'replay'`: a mastered stop replays that step's 8 canon problems under
 *   the peek's rules; it records nothing (D2). A complete world has only
 *   mastered stops, so every tap there is a replay.
 * - `'peek'`: a later stop that is not mastered, locked ones included,
 *   peeks at 3 problems (`fast-track-native.md` § 6, unchanged).
 * - `'name'`: anything else says the stop's name. No stop of a well-formed
 *   map lands here (every stop before the current one is mastered); it is
 *   the safe answer for a stop no rule claims.
 *
 * Pure: the request, the screens and the no-write rule live in the native
 * app.
 */
import type { MapModel, MapStop } from './mapModel'
import { isPeekableStop } from './peek'

export type StopTapAction = 'play' | 'replay' | 'peek' | 'name'

export function stopTapAction(model: MapModel, stop: MapStop): StopTapAction {
  if (stop.state === 'current') return 'play'
  if (stop.state === 'mastered') return 'replay'
  return isPeekableStop(model, stop) ? 'peek' : 'name'
}
