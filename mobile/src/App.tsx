/**
 * Native app root (Phase 2a shell).
 *
 * Route state is core's route state machine (`./router/routes.ts`), one
 * placeholder per route until Phase 3 ports the screens. Splash branches
 * on the persisted `sessionCount` through core's `nextAfterSplash()`,
 * exactly like the web. Emma is one App-level view that springs between
 * the routes' frames (`./components/EmmaStage.tsx`).
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
import { layoutForRoute } from './layout/routeLayout'
import { useAppVisibilityChange } from './lifecycle/appVisibility'
import { getLaunchFlags } from './platform/launchFlags'
import { FIRST_ROUTE, nextRoute, type Route } from './router/routes'
import { RoutePlaceholder } from './screens/RoutePlaceholder'
import { SplashPlaceholder } from './screens/SplashPlaceholder'
import { colors } from './theme'

// Keep the OS splash up until the fonts are ready (module scope, so it
// runs before the first render).
void SplashScreen.preventAutoHideAsync()

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
  const [route, setRoute] = useState<Route>(FIRST_ROUTE)

  const navigate = useCallback((to: Route) => {
    setRoute((current) => nextRoute(current, to))
  }, [])
  const onSplashDone = useCallback(
    () => navigate(nextAfterSplash()),
    [navigate],
  )

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

  const layout = layoutForRoute(route, viewport)

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {route === 'splash' ? (
        <SplashPlaceholder onAdvance={onSplashDone} />
      ) : (
        <>
          <RoutePlaceholder
            key={route}
            route={route}
            layout={layout}
            flags={flags}
            onNavigate={navigate}
          />
          <EmmaStage frame={layout.emma} pose="idle" breath={BREATH} />
        </>
      )}
    </View>
  )
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
