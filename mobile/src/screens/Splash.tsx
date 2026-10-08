/**
 * Screen 1 — Splash. Port of src/screens/Splash.tsx.
 *
 *  - Silent.
 *  - Logo spring scale-in 0.9 -> 1 + opacity (stiffness 180, damping 18).
 *  - Three dots pulsing opacity [0.4, 1, 0.4] over 1.2 s, 150 ms stagger.
 *  - Cream background with a subtle radial pink wash.
 *  - Auto-advances after WARM_CAP_MS (1500 ms). The web's 3000 ms "cold"
 *    cap exists for an un-cached service worker; native assets ship in the
 *    binary, so every native launch is "warm".
 *  - Fades out over 250 ms (exiting).
 */
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { WARM_CAP_MS } from '../reuse'
import { colors, FILL, fonts, LOGO_SOURCE } from '../theme'

const SPRING = { stiffness: 180, damping: 18, mass: 1 }
const DOT_STAGGER_MS = 150

const logoEntering: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.9 }] },
    animations: {
      opacity: withSpring(1, { ...SPRING, overshootClamping: true }),
      transform: [{ scale: withSpring(1, SPRING) }],
    },
  }
}

function Dot({ index }: { index: number }) {
  const reducedMotion = useReducedMotion()
  const opacity = useSharedValue(0.4)
  useEffect(() => {
    if (reducedMotion) return
    const ease = Easing.inOut(Easing.ease)
    opacity.value = withDelay(
      index * DOT_STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: ease }),
          withTiming(0.4, { duration: 600, easing: ease }),
        ),
        -1,
      ),
    )
    return () => cancelAnimation(opacity)
  }, [index, opacity, reducedMotion])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={[styles.dot, style]} />
}

export interface SplashProps {
  onAdvance: () => void
}

export function Splash({ onAdvance }: SplashProps) {
  const { width } = useWindowDimensions()
  const logoWidth = Math.min(240, width * 0.6)
  const scale = logoWidth / 256 // web viewBox is 256 x 336

  useEffect(() => {
    const id = setTimeout(onAdvance, WARM_CAP_MS)
    return () => clearTimeout(id)
  }, [onAdvance])

  return (
    <Animated.View
      exiting={FadeOut.duration(250)}
      style={styles.root}
      accessibilityLabel="Emma is waking up"
    >
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="wash" cx="50%" cy="45%" r="60%">
            <Stop offset="0%" stopColor="#FFC0CB" stopOpacity={0.1} />
            <Stop offset="100%" stopColor="#FFF5F0" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#wash)" />
      </Svg>

      <Animated.View entering={logoEntering} style={styles.center}>
        <Image
          source={LOGO_SOURCE}
          style={{ width: logoWidth, height: logoWidth }}
          contentFit="contain"
          accessibilityLabel="Emma"
        />
        <Text
          style={[
            styles.wordmark,
            { fontSize: 34 * scale, letterSpacing: 1 * scale },
          ]}
        >
          Emma Tutor
        </Text>
        <Svg width={20 * scale} height={18 * scale} viewBox="-10 9 20 18">
          <Path
            d="M 0 14 C -2.6 10, -8.5 10, -8.5 15.5 C -8.5 20, -4.2 22.5, 0 25 C 4.2 22.5, 8.5 20, 8.5 15.5 C 8.5 10, 2.6 10, 0 14 Z"
            fill="#F48FB1"
            stroke="#3D2B3D"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} index={i} />
        ))}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...FILL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.myCream,
  },
  center: { alignItems: 'center' },
  wordmark: {
    fontFamily: fonts.bold,
    color: colors.ink,
    marginTop: 4,
  },
  dots: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 40,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.myRose,
  },
})
