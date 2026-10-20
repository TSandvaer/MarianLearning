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
 *
 * Native-only, the Map peek (fast-track spec
 * `design/native/fast-track-native.md` § 6): a later stop's tap asks App
 * for a peek (`onPeek`). Map tap-to-play (`design/native/map-tap-to-play.md`):
 * the current stop starts the Hub card's session (`onPlay`), a mastered
 * stop a replay (`onReplay`); during a launch Home and Android back are
 * ignored. A map remounted after a peek, a replay or a Map-started session
 * (`quietReturn`) opens quiet. See `useMapVisit`.
 *
 * Native-only, the play door (`design/native/mini-game-flower-bed.md`
 * § 1.2): a world with an open game shows it beside Home; its tap asks App
 * for the game (`onGame`) under the stop rules.
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
import {
  GameDoor,
  HomeButton,
  MapBackdrop,
  MapCaption,
  MapTitle,
} from './mapChrome'
import { MapPath } from './MapPath'
import { useMapVisit, type MapVisitOptions } from './useMapVisit'

/** Web: opacity 0 → 1 over 0.25 s ease-out; out over 0.2 s. */
export const MAP_ENTER_MS = 250
export const MAP_EXIT_MS = 200

/** The handoff that opens the map (App clears it when the map is left). */
export interface MapEntry {
  world: MasteryTrack
  /**
   * Back from a peek, a replay or a Map-started session (fast-track spec
   * § 6.4, map-tap-to-play § 4): no open line.
   */
  quietReturn?: true
}

export interface MapScreenProps extends Omit<
  MapVisitOptions,
  'world' | 'peek' | 'play' | 'replay' | 'openGame'
> {
  layout: MapScreenLayout
  world: MasteryTrack
  /** Home button / Android back → the Hub. */
  onHome: () => void
  /** A later stop was tapped: start its peek (`useMapVisit`'s `peek`). */
  onPeek?: MapVisitOptions['peek']
  /** The current stop was tapped: the Hub card's session (`play`). */
  onPlay?: MapVisitOptions['play']
  /** A mastered stop was tapped: its replay (`replay`). */
  onReplay?: MapVisitOptions['replay']
  /** The play door was tapped: open the game (`openGame`). */
  onGame?: MapVisitOptions['openGame']
}

export function MapScreen({
  layout,
  world,
  onHome,
  onPeek,
  onPlay,
  onReplay,
  onGame,
  ...seams
}: MapScreenProps) {
  const reducedMotion = useReducedMotion()
  const state = useMapVisit({
    world,
    peek: onPeek,
    play: onPlay,
    replay: onReplay,
    openGame: onGame,
    ...seams,
  })
  const leavingRef = useRef(false)
  const { leave, launchLocked } = state
  const home = () => {
    // The launch lock (map-tap-to-play § 2.2): ignored until the route changes.
    if (leavingRef.current || launchLocked()) return
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

  const { visit, tapDoor } = state
  // One door per world; the shelf for 2+ games comes with game B (§ 1.2).
  const game = state.games[0]
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
        {game !== undefined && (
          <GameDoor
            game={game}
            rect={layout.door}
            k={layout.homeScale}
            onPress={() => tapDoor(game)}
          />
        )}
        {layout.title && <MapTitle world={world} rect={layout.title} />}
        <MapCaption line={state.caption} caption={layout.caption} />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
})
