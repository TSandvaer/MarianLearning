/**
 * Emma's Path, one world's map: the native port of the web map
 * (`src/screens/Map/`, Emma's Path 8/10 + 9/10, clay direction A #509),
 * mounted from the rules it shares with the web (`@marian/core/map/*`).
 *
 * One screen, no scroll: the clay Home button and the world title, the
 * path (one tinted band per land, land 1 at the bottom, garden-arch gates
 * between them, Emma's "you are here" badge over her stop), and the
 * caption slab mirroring every line she says. Every tap speaks: a stop its
 * name, a locked stop what opens it, a gate its land. An unlock not yet
 * celebrated plays its beat once (`useMapVisit`).
 *
 * App renders it only with a handoff (`MapEntry`: the world, from a Hub
 * map button or Session End's "All done"); the seen-marker write is the
 * map's only mount-time write. App's Emma stage is hidden here: her badge
 * is the map's Emma, as on the web.
 */
import type { MasteryTrack } from '@marian/core/progress'
import { useRef } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated'
import type { MapScreenLayout } from '../../layout/mapLayout'
import { HomeButton, MapBackdrop, MapCaption, MapTitle } from './mapChrome'
import { MapPath } from './MapPath'
import { useMapVisit, type MapVisitOptions } from './useMapVisit'

/** Web: opacity 0 → 1 over 0.25 s ease-out; out over 0.2 s. */
export const MAP_ENTER_MS = 250
export const MAP_EXIT_MS = 200

/** The handoff that opens the map (App clears it when the map is left). */
export interface MapEntry {
  world: MasteryTrack
}

export interface MapScreenProps extends Omit<MapVisitOptions, 'world'> {
  layout: MapScreenLayout
  world: MasteryTrack
  /** Home button → the Hub. */
  onHome: () => void
}

export function MapScreen({ layout, world, onHome, ...seams }: MapScreenProps) {
  const reducedMotion = useReducedMotion()
  const state = useMapVisit({ world, ...seams })
  const leavingRef = useRef(false)
  const home = () => {
    if (leavingRef.current) return
    leavingRef.current = true
    state.leave()
    onHome()
  }
  const { visit } = state
  return (
    <Animated.View
      testID="map"
      entering={FadeIn.duration(MAP_ENTER_MS)}
      exiting={FadeOut.duration(MAP_EXIT_MS)}
      style={styles.fill}
    >
      <MapBackdrop />
      <Animated.View
        testID={`map-${visit.world}-beat-${visit.beat}`}
        style={styles.fill}
      >
        <MapPath layout={layout} state={state} reducedMotion={reducedMotion} />
        <HomeButton rect={layout.home} icon={layout.homeIcon} onPress={home} />
        <MapTitle
          world={world}
          rect={layout.title}
          fontSize={layout.title.fontSize}
        />
        <MapCaption line={state.caption} layout={layout.caption} />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
})
