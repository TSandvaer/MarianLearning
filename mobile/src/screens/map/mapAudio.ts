/**
 * The map's sound: the native `playMapLine` (web `src/screens/Map/
 * playMapLine.ts`) and the map's three effects.
 *
 * - Lines: one path line player per map mount, on Emma's voice channel
 *   under the `map:` label (`map:path.open.add-to-10`). A new line stops
 *   the one in flight; a deferred line (`src: null`) plays nothing and the
 *   caption shows alone; a failed clip resolves quietly (the caption is
 *   already up). Never browser / OS speech. `unload()` on leave releases
 *   the map's clips only, so the Hub's session prefetch survives a visit.
 * - Effects: the beat's chime (padlock pop) and cheer (gate swing), and a
 *   locked stop's poof, at the web's volumes (`@marian/core/map/mapVisit`).
 *   Made per mount, released on leave, like the web's `createSfx` calls.
 * - The Hub's quiet return: leaving the map stamps the Hub's rapid-remount
 *   clock, so Home → Hub plays no welcome line however long the map was
 *   open (web: the map writes `HUB_LAST_UNMOUNT_KEY` on unmount).
 */
import type { MapSfx } from '@marian/core/map/mapVisit'
import {
  createPathLinePlayer,
  createSfx,
  type PathLinePlayer,
  type Sfx,
} from '../../audio'

/** Voice label prefix of the map's lines. */
export const MAP_VOICE = 'map'

export type MapLinePlayer = PathLinePlayer

/** One player per map mount (web `createMapLinePlayer`). */
export function createMapLinePlayer(): MapLinePlayer {
  return createPathLinePlayer(undefined, MAP_VOICE)
}

/** Web `createSfx({ src, volume })`. */
export type CreateMapSfx = (effect: MapSfx) => Sfx

export const createMapSfx: CreateMapSfx = (effect) =>
  createSfx({ src: effect.src, volume: effect.volume })

export { markHubUnmount as markMapLeft } from '../hub/hubAudio'
