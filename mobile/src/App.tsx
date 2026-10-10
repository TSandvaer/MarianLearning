/**
 * Native app root.
 *
 * Route state is core's route state machine (`./router/routes.ts`).
 * Phase 3 ports the screens one by one: Splash and Greet are real, every
 * other route is still a placeholder. Splash branches on the persisted
 * `sessionCount` through core's `nextAfterSplash()`, exactly like the
 * web; neither Splash nor Greet writes it (Session-End does). Emma is one
 * App-level view that springs between the routes' frames
 * (`./components/EmmaStage.tsx`); on Greet she breathes faster and stays
 * in the idle pose throughout.
 *
 * `@marian/core` is wired to the device before this module loads
 * (`./platform/boot.ts`, imported first by `index.ts`).
 */
import {
  BREATHING_PERIOD_S,
  BREATHING_SCALE_KEYFRAMES,
} from '@marian/core/character/emmaPose'
import { nextAfterSplash } from '@marian/core/router/nextAfterSplash'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { useAudioEngine } from './audio'
import { EmmaStage, type Breath } from './components/EmmaStage'
import { useAppFonts } from './fonts'
import type { Viewport } from './layout/layout'
import { greetLayout } from './layout/greetLayout'
import { layoutForRoute } from './layout/routeLayout'
import { useAppVisibilityChange } from './lifecycle/appVisibility'
import { readBuildEnv } from './platform/buildEnv'
import { getLaunchFlags } from './platform/launchFlags'
import { FIRST_ROUTE, nextRoute, type Route } from './router/routes'
import {
  Greet,
  GREET_BREATH_PERIOD_S,
  GREET_BREATH_SCALE,
} from './screens/greet/Greet'
import { RoutePlaceholder } from './screens/RoutePlaceholder'
import { Splash } from './screens/Splash'
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

function Shell() {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const viewport = useMemo<Viewport>(
    () => ({ width, height, insets }),
    [width, height, insets],
  )
  const flags = getLaunchFlags()
  const qaAutoTapMs = flags.debug
    ? parseQaAutoTap(readBuildEnv().qaAutoTapMs)
    : undefined
  const [route, setRoute] = useState<Route>(FIRST_ROUTE)

  const navigate = useCallback((to: Route) => {
    setRoute((current) => nextRoute(current, to))
  }, [])
  const onSplashDone = useCallback(
    () => navigate(nextAfterSplash()),
    [navigate],
  )
  // Web `handleGreetAdvance`: the first-launch flow goes straight to Math.
  const onGreetDone = useCallback(() => navigate('math'), [navigate])

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
  const layout = greet ?? layoutForRoute(route, viewport)

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
          ) : (
            <RoutePlaceholder
              key={route}
              route={route}
              layout={layout}
              flags={flags}
              onNavigate={navigate}
            />
          )}
          <EmmaStage
            frame={layout.emma}
            // Calm through the whole Greet (native-only, Thomas 2026-10-09:
            // no celebration swap); every other screen starts idle too.
            pose="idle"
            breath={route === 'greet' ? GREET_BREATH : BREATH}
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
