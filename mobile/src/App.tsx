/**
 * Native app root.
 *
 * Route state is core's route state machine (`./router/routes.ts`).
 * Phase 3 ports the screens one by one: Splash, Greet, Math, Session End
 * and the Hub are real, every other route is still a placeholder. Splash branches on the
 * persisted `sessionCount` through core's `nextAfterSplash()`, exactly
 * like the web; neither Splash nor Greet writes it (Session-End does).
 * Emma is one App-level view that springs between the routes' frames
 * (`./components/EmmaStage.tsx`); on Greet she breathes faster and stays
 * in the idle pose throughout; on Math she takes the screen's poses.
 *
 * Math's session start is App's, as on the web (`./session/mathSession.ts`):
 * kicked on Greet (or on Math for a returning child), its visible-wait
 * timer started on Math, torn down when the child leaves Math for the Hub
 * or leaves Session End. Math's result goes to Session End as the web's
 * `SessionEndPayload`; Session End's "All done" opens the map when an
 * unlock is waiting, else the Hub, and a not-yet day's "Again" starts the
 * next session (web `handleSessionEndAllDone` / `…Again`).
 *
 * The Hub (`./screens/hub/Hub.tsx`) hands a card tap to Math (Number
 * Garden) or the Word Song placeholder, a map button to that world's map
 * and Emma's 3 s press to Parent Settings. On Hub entry App
 * prefetches the Math session while Number Garden glows (web
 * `hubSessionPrefetch.ts`); the card tap kicks it, which adopts the
 * prefetch. Emma fades in when the Hub is the first screen after Splash,
 * and wears her baked shadow on the Hub.
 *
 * The map (`./screens/map/MapScreen.tsx`) opens with a handoff (`MapEntry`,
 * the world) from a Hub map button or Session End's "All done"; it may
 * write the unlock seen-marker on mount, so without a handoff (the QA
 * route, a placeholder's exit) the placeholder renders, and leaving the
 * map clears it. App's Emma is hidden there (the map draws her badge).
 *
 * `@marian/core` is wired to the device before this module loads
 * (`./platform/boot.ts`, imported first by `index.ts`).
 */
import {
  BREATHING_PERIOD_S,
  BREATHING_SCALE_KEYFRAMES,
  type EmmaPose,
} from '@marian/core/character/emmaPose'
import {
  computeSuggestion,
  prefetchTrackFor,
} from '@marian/core/hub/hubSuggestion'
import { pickStaticSessionPlan } from '@marian/core/math/sessionPlans'
import { loadProgress, type MasteryTrack } from '@marian/core/progress'
import { now as progressNow } from '@marian/core/progress/clock'
import { pendingUnlock } from '@marian/core/progress/pathBeats'
import { nextAfterSplash } from '@marian/core/router/nextAfterSplash'
import {
  readSessionHistoryForToday,
  type SkillTreeId,
} from '@marian/core/sessionEnd/sessionHistory'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { StyleSheet, View } from 'react-native'
import {
  SafeAreaProvider,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { sessionPrefetcher, useAudioEngine } from './audio'
import { EmmaStage, type Breath } from './components/EmmaStage'
import { useAppFonts } from './fonts'
import type { Viewport } from './layout/layout'
import { greetLayout } from './layout/greetLayout'
import { hubLayout } from './layout/hubLayout'
import { mathLayout } from './layout/mathLayout'
import { mapLayout } from './layout/mapLayout'
import { layoutForRoute } from './layout/routeLayout'
import { sessionEndLayout } from './layout/sessionEndLayout'
import { useAppVisibilityChange } from './lifecycle/appVisibility'
import { readBuildEnv } from './platform/buildEnv'
import { getLaunchFlags } from './platform/launchFlags'
import {
  FIRST_ROUTE,
  nextRoute,
  ROUTE_EXITS,
  type Route,
} from './router/routes'
import {
  Greet,
  GREET_BREATH_PERIOD_S,
  GREET_BREATH_SCALE,
} from './screens/greet/Greet'
import { Hub } from './screens/hub/Hub'
import { MapScreen, type MapEntry } from './screens/map/MapScreen'
import { MathScreen } from './screens/math/Math'
import type { MathSessionResult } from './screens/math/mathTypes'
import { RoutePlaceholder } from './screens/RoutePlaceholder'
import { SessionEnd } from './screens/sessionEnd/SessionEnd'
import { Splash } from './screens/Splash'
import {
  createMathSessionController,
  mathFallbackFocusNode,
  mathScaffoldDecisions,
} from './session/mathSession'
import {
  mathSessionEndPayload,
  type SessionEndPayload,
} from './session/sessionEndPayload'
import { colors } from './theme'

// Keep the OS splash up until the fonts are ready (module scope, so it
// runs before the first render).
void SplashScreen.preventAutoHideAsync()

/**
 * Greet's breath: `scale: [1, 1.05, 1]` over 2.4 s, faster than elsewhere so
 * she reads as awake (web Greet.tsx; Dave's consult rejected 1.015).
 */
const GREET_BREATH: Breath = {
  scale: GREET_BREATH_SCALE,
  periodS: GREET_BREATH_PERIOD_S,
}

/** EmmaCharacter's breath (Math, Hub, ...): 1.02 over 4 s. */
const BREATH: Breath = {
  scale: BREATHING_SCALE_KEYFRAMES[1],
  periodS: BREATHING_PERIOD_S,
}

/**
 * The routes Math's session audio survives on: Greet (the pre-warm), Math,
 * Session End (the web plays its lines from the same session).
 */
const MATH_AUDIO_ROUTES: ReadonlySet<Route> = new Set<Route>([
  'greet',
  'math',
  'session-end',
])

/** Once per App mount, as on the web: the fallback plan + scaffold decisions. */
function mathSessionDefaults() {
  const focusNode = mathFallbackFocusNode()
  return {
    focusNode,
    plan: pickStaticSessionPlan(undefined, focusNode),
    scaffold: mathScaffoldDecisions(new Date().toISOString()),
  }
}

function Shell() {
  // The provider's measured frame, not `useWindowDimensions()`: on Android
  // (API 37 emulator, edge-to-edge) the window height leaves out the
  // navigation bar (667×351) while the app draws under it (667×375) and
  // the bottom inset counts it again (24), so the layouts lost 24 pt.
  const { width, height } = useSafeAreaFrame()
  const insets = useSafeAreaInsets()
  const viewport = useMemo<Viewport>(
    () => ({ width, height, insets }),
    [width, height, insets],
  )
  const flags = getLaunchFlags()
  useEffect(() => {
    if (!flags.debug) return
    console.log(
      `[layout] frame ${Math.round(width)}×${Math.round(height)} insets t${insets.top} b${insets.bottom} l${insets.left} r${insets.right}`,
    )
  }, [flags.debug, width, height, insets])
  const env = readBuildEnv()
  const qaAutoTapMs = flags.debug ? parseQaAutoTap(env.qaAutoTapMs) : undefined
  const [route, setRoute] = useState<Route>(() =>
    flags.debug ? parseQaRoute(env.qaRoute) : FIRST_ROUTE,
  )

  // Math: session start, result handoff, Emma's pose.
  const [mathDefaults] = useState(mathSessionDefaults)
  const [mathSession] = useState(() =>
    createMathSessionController({
      fallbackPlanId: () => mathDefaults.plan.id,
      prefetcher: sessionPrefetcher,
    }),
  )
  const mathState = useSyncExternalStore(
    mathSession.subscribe,
    mathSession.getSnapshot,
  )
  const [mathPose, setMathPose] = useState<EmmaPose>('idle')
  const [sessionEnd, setSessionEnd] = useState<SessionEndPayload | null>(null)
  const [sessionEndPose, setSessionEndPose] = useState<EmmaPose>('idle')
  // The map's handoff: set by the two ways in, cleared on the way out.
  const [mapEntry, setMapEntry] = useState<MapEntry | null>(null)

  // The web's tear-downs (`handleBackToHub`, `handleSessionEndAllDone` /
  // `…Again`, the leave-effect) run BEFORE the route flips: leaving
  // Session End, or leaving Greet / Math / Session End for anything else,
  // drops the Math session first. A Math screen must never mount on the
  // previous session: its stale read would set the read-aloud latch.
  const routeRef = useRef(route)
  const navigate = useCallback(
    (to: Route) => {
      const from = routeRef.current
      const next = nextRoute(from, to)
      if (next === from) return
      if (from === 'session-end' || !MATH_AUDIO_ROUTES.has(next)) {
        mathSession.tearDown()
      }
      // The Hub's prefetch is for Number Garden; it survives a map visit
      // (web parity) and goes on any other way out.
      if (from === 'hub' && next !== 'math' && next !== 'map') {
        sessionPrefetcher.discard()
      }
      // Session End consumed its payload (the one write): a later arrival
      // without a new session gets the placeholder, never a second write.
      if (from === 'session-end') setSessionEnd(null)
      // Likewise the map: a later arrival needs a new handoff, so its
      // seen-marker write can never run on a stale one.
      if (from === 'map') setMapEntry(null)
      routeRef.current = next
      setRoute(next)
    },
    [mathSession],
  )
  // A way into the map: the handoff first, then the route (only when the
  // map is an exit of the route we are on).
  const openMap = useCallback(
    (world: MasteryTrack) => {
      if (nextRoute(routeRef.current, 'map') !== 'map') return
      setMapEntry({ world })
      navigate('map')
    },
    [navigate],
  )
  const onSplashDone = useCallback(
    () => navigate(nextAfterSplash()),
    [navigate],
  )
  // Web `handleGreetAdvance`: the first-launch flow goes straight to Math.
  const onGreetDone = useCallback(() => navigate('math'), [navigate])

  // Web kick-effect: kick on Greet / Math (latched until a tear-down).
  useEffect(() => {
    if (route === 'greet' || route === 'math') mathSession.kick()
  }, [route, mathSession])
  // Emma's Path 1/10: the hinted request's 5 s budget counts visible wait.
  useEffect(() => {
    if (route === 'math' && !mathState.audioReady) {
      mathSession.startWaitTimer()
    }
  }, [route, mathState.audioReady, mathSession])

  // Web `handleMathComplete`.
  const onMathComplete = useCallback(
    (result: MathSessionResult) => {
      setSessionEnd(
        mathSessionEndPayload(
          result,
          mathSession.getSnapshot().plan ?? mathDefaults.plan,
          mathSession.sessionFocus,
        ),
      )
      setSessionEndPose('idle')
      navigate('session-end')
    },
    [mathDefaults, mathSession, navigate],
  )
  // Web `handleSessionEndAllDone`: an unlock this world has not celebrated
  // yet opens the map (which plays it); otherwise the Hub. (The route
  // flip tears the Math session down, as the web's handler does.)
  const onSessionEndAllDone = useCallback(() => {
    const world: MasteryTrack =
      sessionEnd?.surface === 'word-song' ? 'word-song' : 'math'
    const saved = loadProgress()
    if (saved !== null && pendingUnlock(saved, world) !== null) openMap(world)
    else navigate('hub')
  }, [sessionEnd, navigate, openMap])
  // Web `handleSessionEndAgain` (not-yet day): another session, same world.
  const onSessionEndAgain = useCallback(
    () => navigate(sessionEnd?.surface === 'word-song' ? 'literacy' : 'math'),
    [sessionEnd, navigate],
  )
  // Web `handleBackToHub` (the route effect tears the session down).
  const onMathExit = useCallback(() => navigate('hub'), [navigate])

  // Hub entry: prefetch the glowing world's session (web
  // `useHubSessionPrefetch`; no glow → Word Song, which is not ported yet).
  useEffect(() => {
    if (route !== 'hub') return
    let suggestion: SkillTreeId | null = null
    try {
      const now = progressNow()
      suggestion = computeSuggestion(readSessionHistoryForToday(now), now)
    } catch {
      // Storage unavailable: no prefetch; the tap starts its own request.
    }
    if (prefetchTrackFor(suggestion) === 'math') mathSession.prefetch()
  }, [route, mathSession])
  // Web `handleHubPickTree`. The kick takes the prefetch in the tap.
  const onHubPick = useCallback(
    (tree: SkillTreeId) => {
      if (tree === 'number-garden') {
        mathSession.kick()
        navigate('math')
      } else {
        navigate('literacy')
      }
    },
    [mathSession, navigate],
  )
  // Web `handleHubOpenMap`; the map's Home is web `handleMapBack` (the
  // map stamps the Hub's rapid-remount clock, so the Hub stays quiet).
  const onHubMap = openMap
  const onMapHome = useCallback(() => navigate('hub'), [navigate])
  const onHubParent = useCallback(() => navigate('parent-settings'), [navigate])

  // Audio session (plays in silent mode, doNotMix), the voice channel's
  // background/interruption handling, and the boot-time cache sweep.
  useAudioEngine(flags.debug)

  // The web's visibilitychange use, natively. The audio engine subscribes
  // itself (above); the shell only logs the edge in debug mode.
  useAppVisibilityChange(
    useCallback(
      (hidden: boolean) => {
        if (flags.debug) {
          console.log(`[lifecycle] ${hidden ? 'hidden' : 'visible'}`)
        }
      },
      [flags.debug],
    ),
  )

  const greet = route === 'greet' ? greetLayout(viewport) : null
  const math = route === 'math' ? mathLayout(viewport) : null
  // Session End needs a finished session; without one (QA route, the
  // Word Song placeholder's exit) the placeholder renders and nothing is
  // written.
  const end =
    route === 'session-end' && sessionEnd !== null
      ? sessionEndLayout(viewport)
      : null
  const hub = route === 'hub' ? hubLayout(viewport) : null
  // The map needs its handoff; without one, the placeholder (no write).
  const map = route === 'map' && mapEntry !== null ? mapLayout(viewport) : null
  const layout =
    greet ?? math ?? end ?? hub ?? map ?? layoutForRoute(route, viewport)

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {route === 'splash' ? (
        <Splash onAdvance={onSplashDone} />
      ) : (
        <>
          {greet ? (
            <Greet
              layout={greet}
              onAdvance={onGreetDone}
              qaAutoTapAfterMs={qaAutoTapMs}
            />
          ) : math ? (
            <MathScreen
              layout={math}
              plan={mathState.plan ?? mathDefaults.plan}
              playUtterance={mathState.playUtterance ?? undefined}
              audioReady={mathState.audioReady}
              focusNode={mathDefaults.focusNode}
              subitisingScaffoldActive={mathDefaults.scaffold.add}
              subitisingSubScaffoldActive={mathDefaults.scaffold.sub}
              onSessionComplete={onMathComplete}
              onRequestExit={onMathExit}
              onPoseChange={setMathPose}
              qaAutoAnswerAfterMs={qaAutoTapMs}
            />
          ) : hub ? (
            <Hub
              layout={hub}
              onPickTree={onHubPick}
              onOpenMap={onHubMap}
              onParentLongPress={onHubParent}
            />
          ) : map && mapEntry ? (
            <MapScreen
              key={`map-${mapEntry.world}`}
              layout={map}
              world={mapEntry.world}
              onHome={onMapHome}
            />
          ) : end ? (
            <SessionEnd
              layout={end}
              payload={sessionEnd}
              onAllDone={onSessionEndAllDone}
              onAgain={onSessionEndAgain}
              onPoseChange={setSessionEndPose}
            />
          ) : (
            <RoutePlaceholder
              key={route}
              route={route}
              layout={layout}
              flags={flags}
              onNavigate={navigate}
            />
          )}
          {map === null && (
            <EmmaStage
              frame={layout.emma}
              // Calm through the whole Greet (native-only, Thomas 2026-10-09:
              // no celebration swap); Math and Session End drive her poses as
              // on the web.
              pose={route === 'math' ? mathPose : end ? sessionEndPose : 'idle'}
              // The web's Session End Emma is a still image (no breath).
              breath={route === 'greet' ? GREET_BREATH : end ? null : BREATH}
              motion={route === 'greet' ? 'greet' : 'character'}
              // Read at mount: a returning launch lands on the Hub, where
              // she is already there (a fade), not Greet's arrival.
              entrance={route === 'hub' ? 'fade' : 'slide'}
              shadow={route === 'hub'}
            />
          )}
        </>
      )}
    </View>
  )
}

/** `EXPO_PUBLIC_QA_AUTOTAP_MS`: a non-negative integer, else ignored. */
function parseQaAutoTap(raw: string | undefined): number | undefined {
  if (raw === undefined || !/^\d+$/.test(raw)) return undefined
  return Number(raw)
}

/** `EXPO_PUBLIC_QA_ROUTE` (web `?route=`): a known route, else the first. */
function parseQaRoute(raw: string | undefined): Route {
  const known = Object.keys(ROUTE_EXITS) as Route[]
  return known.find((r) => r === raw?.trim()) ?? FIRST_ROUTE
}

export default function App() {
  const fontsReady = useAppFonts()

  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync()
  }, [fontsReady])

  if (!fontsReady) return null
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.myCream },
})
