/**
 * Phase 0 spike root: Splash -> Greet -> Math (live session-start) -> Hub
 * stub, with a persistent App-level Emma (see src/components/EmmaStage.tsx).
 *
 * Route state stays a plain state machine, like the web's src/router/route.ts
 * (no URLs, no navigation library).
 */
// Per-weight subpaths: the package index requires all five TTFs (+150 KB).
import { Fredoka_400Regular } from '@expo-google-fonts/fredoka/400Regular'
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold'
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold'
import { useFonts } from 'expo-font'
import { Image } from 'expo-image'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { configureAudioSession } from './src/audio/captionPlayer'
import { preloadGreetAudio } from './src/audio/greetAudio'
import { EmmaStage, type Breath } from './src/components/EmmaStage'
import {
  greetLayout,
  hubLayout,
  mathLayout,
  type ScreenLayout,
  type Viewport,
} from './src/layout'
import { Greet } from './src/screens/Greet'
import { HubStub } from './src/screens/HubStub'
import { MathProblemScreen } from './src/screens/MathProblem'
import { Splash } from './src/screens/Splash'
import {
  bumpSessionCount,
  readSessionCount,
  resetSessionCount,
} from './src/storage'
import { colors, EMMA_SOURCES, fonts, type SpikePose } from './src/theme'

type Route = 'splash' | 'greet' | 'math' | 'hub'

const GREET_BREATH: Breath = { scale: 1.05, periodS: 2.4 }
const CHARACTER_BREATH: Breath = { scale: 1.02, periodS: 4 }
const SHOW_DEBUG = process.env.EXPO_PUBLIC_SPIKE_DEBUG !== '0'

function layoutFor(route: Route, viewport: Viewport): ScreenLayout {
  if (route === 'math') return mathLayout(viewport)
  if (route === 'hub') return hubLayout(viewport)
  return greetLayout(viewport)
}

function Root() {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const viewport = useMemo<Viewport>(
    () => ({ width, height, insets }),
    [width, height, insets],
  )

  // Synchronous boot read through the localStorage polyfill — the same
  // shape as the web's `useState(loadProgress)`.
  const [sessionCount, setSessionCount] = useState(() => readSessionCount())
  const [route, setRoute] = useState<Route>('splash')
  const [pose, setPose] = useState<SpikePose>('idle')
  const [debug, setDebug] = useState<string[]>([])
  const [debugOpen, setDebugOpen] = useState(SHOW_DEBUG)

  const log = useCallback((line: string) => {
    console.log(`[spike] ${line}`)
    setDebug((prev) => [...prev.slice(-5), line])
  }, [])

  // Splash does the warm-up: audio session, the 4 Greet players, Emma poses.
  useEffect(() => {
    void configureAudioSession()
    preloadGreetAudio()
    for (const src of Object.values(EMMA_SOURCES)) {
      void Image.loadAsync(src).catch(() => {})
    }
    log(`boot: sessionCount=${readSessionCount()} (localStorage polyfill)`)
  }, [log])

  const onSplashDone = useCallback(() => {
    setRoute(sessionCount > 0 ? 'hub' : 'greet')
  }, [sessionCount])

  const startMath = useCallback(() => {
    setSessionCount(bumpSessionCount())
    setRoute('math')
    // Emma arrives still celebrating from the heart tap; settle her after
    // the same 600 ms ear-wiggle window Greet uses.
    setTimeout(() => setPose((p) => (p === 'celebration' ? 'idle' : p)), 600)
  }, [])

  const layout = layoutFor(route, viewport)

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {route === 'splash' && <Splash onAdvance={onSplashDone} />}
      {route === 'greet' && (
        <Greet
          layout={layout}
          viewport={viewport}
          onPoseChange={setPose}
          onAdvance={startMath}
          onDebug={log}
        />
      )}
      {route === 'math' && (
        <MathProblemScreen
          layout={layout}
          onPoseChange={setPose}
          onDone={() => {
            setPose('idle')
            setRoute('hub')
          }}
          onDebug={log}
        />
      )}
      {route === 'hub' && (
        <HubStub
          layout={layout}
          sessionCount={sessionCount}
          onPlayMath={startMath}
          onReplayGreet={() => {
            setPose('idle')
            setRoute('greet')
          }}
          onReset={() => {
            resetSessionCount()
            setSessionCount(readSessionCount())
            log('storage reset: next launch shows Greet')
          }}
        />
      )}

      {route !== 'splash' && (
        <EmmaStage
          frame={layout.emma}
          pose={pose}
          breath={route === 'greet' ? GREET_BREATH : CHARACTER_BREATH}
        />
      )}

      {route !== 'splash' && (
        <Pressable
          onPress={() => setDebugOpen((o) => !o)}
          style={[
            styles.debug,
            { bottom: insets.bottom + 4, left: insets.left + 4 },
          ]}
          accessibilityLabel="Toggle spike debug log"
        >
          <Text style={styles.debugText}>
            {debugOpen ? debug.join('\n') : 'dbg'}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  })
  if (!fontsLoaded) return <View style={styles.root} />
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.myCream },
  debug: { position: 'absolute', maxWidth: '70%', padding: 4 },
  debugText: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 13,
    color: colors.ink,
    opacity: 0.45,
  },
})
