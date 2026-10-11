/**
 * Emma's Path, one world's map: the native port of the web map
 * (`src/screens/Map/`, Emma's Path 8/10 + 9/10, clay direction A #509),
 * built to `design/native/map-native.md` and mounted from the rules it
 * shares with the web (`@marian/core/map/*`).
 *
 * One screen: the clay Home button and the world title (not in phone
 * landscape), the path (one tinted band per land, land 1 at the bottom,
 * garden-arch gates between them, Emma's "you are here" badge over her
 * stop), and the caption slab mirroring every line she says. Every tap
 * speaks: a stop its name, a locked stop what opens it, a gate its land.
 * An unlock not yet celebrated plays its beat once (`useMapVisit`).
 *
 * App renders it only with a handoff (`MapEntry`: the world, from a Hub
 * map button or Session End's "All done"); the seen-marker write is the
 * map's only mount-time write. App's Emma stage is hidden here: her badge
 * is the map's Emma (§ 3). Home and Android back → Hub, at any time (§ 7).
 */
import type { MasteryTrack } from '@marian/core/progress'
import { useEffect, useRef } from 'react'
import { BackHandler, StyleSheet } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated'
import type { MapScreenLayout } from '../../layout/mapScreenLayout'
import { EASE_OUT } from './mapMotion'
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
  /** Home button / Android back → the Hub. */
  onHome: () => void
}

export function MapScreen({ layout, world, onHome, ...seams }: MapScreenProps) {
  const reducedMotion = useReducedMotion()
  const state = useMapVisit({ world, ...seams })
  const leavingRef = useRef(false)
  const { leave } = state
  const home = () => {
    if (leavingRef.current) return
    leavingRef.current = true
    leave()
    onHome()
  }
  const homeRef = useRef(home)
  useEffect(() => {
    homeRef.current = home
  })
  // Android back = Home (§ 7).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      homeRef.current()
      return true
    })
    return () => sub.remove()
  }, [])

  const { visit } = state
  return (
    <Animated.View
      testID="map"
      entering={FadeIn.duration(MAP_ENTER_MS).easing(EASE_OUT)}
      exiting={FadeOut.duration(MAP_EXIT_MS)}
      style={styles.fill}
    >
      <MapBackdrop />
      <Animated.View
        testID={`map-${visit.world}-beat-${visit.beat}`}
        style={styles.fill}
      >
        <MapPath layout={layout} state={state} reducedMotion={reducedMotion} />
        <HomeButton rect={layout.home} k={layout.homeScale} onPress={home} />
        {layout.title && <MapTitle world={world} rect={layout.title} />}
        <MapCaption line={state.caption} caption={layout.caption} />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
})
