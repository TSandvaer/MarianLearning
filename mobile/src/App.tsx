/**
 * Native app root.
 *
 * Route state is core's route state machine (`./router/routes.ts`).
 * Phase 3 ports the screens one by one: Splash, Greet and Math are real,
 * every other route is still a placeholder. Splash branches on the
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
 * `SessionEndPayload`.
 *
 * `@marian/core` is wired to the device before this module loads
 * (`./platform/boot.ts`, imported first by `index.ts`).
 */
import {
  BREATHING_PERIOD_S,
  BREATHING_SCALE_KEYFRAMES,
  type EmmaPose,
} from '@marian/core/character/emmaPose'
import { pickStaticSessionPlan } from '@marian/core/math/sessionPlans'
import { nextAfterSplash } from '@marian/core/router/nextAfterSplash'
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
import { useAudioEngine } from './audio'
import { EmmaStage, type Breath } from './components/EmmaStage'
import { useAppFonts } from './fonts'
import type { Viewport } from './layout/layout'
import { greetLayout } from './layout/greetLayout'
import { mathLayout } from './layout/mathLayout'
import { layoutForRoute } from './layout/routeLayout'
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
import { MathScreen } from './screens/math/Math'
import type { MathSessionResult } from './screens/math/mathTypes'
import { RoutePlaceholder } from './screens/RoutePlaceholder'
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

  const navigate = useCallback((to: Route) => {
    setRoute((current) => nextRoute(current, to))
  }, [])
  const onSplashDone = useCallback(
    () => navigate(nextAfterSplash()),
    [navigate],
  )
  // Web `handleGreetAdvance`: the first-launch flow goes straight to Math.
  const onGreetDone = useCallback(() => navigate('math'), [navigate])

  // Math: session start, result handoff, Emma's pose.
  const [mathDefaults] = useState(mathSessionDefaults)
  const [mathSession] = useState(() =>
    createMathSessionController({
      fallbackPlanId: () => mathDefaults.plan.id,
    }),
  )
  const mathState = useSyncExternalStore(
    mathSession.subscribe,
    mathSession.getSnapshot,
  )
  const [mathPose, setMathPose] = useState<EmmaPose>('idle')
  const [sessionEnd, setSessionEnd] = useState<SessionEndPayload | null>(null)

  // Web kick-effect + leave-effect: kick on Greet / Math (latched); tear
  // down on leaving those routes, and on leaving Session End.
  const prevRouteRef = useRef(route)
  useEffect(() => {
    const prev = prevRouteRef.current
    prevRouteRef.current = route
    if (
      prev !== route &&
      (prev === 'session-end' || !MATH_AUDIO_ROUTES.has(route))
    ) {
      mathSession.tearDown()
    }
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
      navigate('session-end')
    },
    [mathDefaults, mathSession, navigate],
  )
  // Web `handleBackToHub` (the route effect tears the session down).
  const onMathExit = useCallback(() => navigate('hub'), [navigate])

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
  const layout = greet ?? math ?? layoutForRoute(route, viewport)

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
          ) : (
            <RoutePlaceholder
              key={route}
              route={route}
              layout={layout}
              flags={flags}
              onNavigate={navigate}
              sessionEnd={route === 'session-end' ? sessionEnd : null}
            />
          )}
          <EmmaStage
            frame={layout.emma}
            // Calm through the whole Greet (native-only, Thomas 2026-10-09:
            // no celebration swap); Math drives her poses as on the web.
            pose={route === 'math' ? mathPose : 'idle'}
            breath={route === 'greet' ? GREET_BREATH : BREATH}
            motion={route === 'greet' ? 'greet' : 'character'}
          />
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
