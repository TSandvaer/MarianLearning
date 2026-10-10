/**
 * Screen 1, Splash. Native port of `src/screens/Splash.tsx` (spec
 * `design/session-1.md` § Screen 1):
 *
 * - Silent: no voice, no SFX. No skip.
 * - The `emma-logo.svg` lock-up at `w-60 max-w-[60vw]` (240 pt, at most
 *   60 % of the width): the medallion (exported WebP) over the "Emma Tutor"
 *   wordmark and heart flourish, which the web draws as SVG text and a path
 *   in the same 256×336 viewBox, so they are drawn the same way here.
 *   Spring scale 0.9 → 1 + opacity (stiffness 180, damping 18).
 * - Three `my-rose` 12 pt dots, 16 apart, 40 below the logo, pulsing
 *   opacity 0.4 → 1 → 0.4 over 1.2 s, staggered 150 ms.
 * - Cream background with a radial `my-pink` wash at 10 % (web:
 *   `radial-gradient(circle at 50% 45%, …10% 0%, …0 60%)`).
 * - Reduce Motion: the logo fades in without the scale; the dots hold still.
 * - Advances after `WARM_CAP_MS` (1500 ms), then fades out over 250 ms
 *   before App changes the route (the web's `AnimatePresence mode="wait"`:
 *   Greet mounts after Splash's exit). The web's 3000 ms cold cap covers an
 *   un-cached service worker; native assets ship in the binary, so every
 *   native launch is warm.
 */
import { WARM_CAP_MS } from '@marian/core/splash/splashTiming'
import { Image } from 'expo-image'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
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
import Svg, {
  Defs,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg'
import { emmaAsset } from '../assets'
import { colors, FILL } from '../theme'

export const SPLASH_FADE_OUT_MS = 250
export const DOT_STAGGER_MS = 150
const DOT_PERIOD_MS = 1_200
const LOGO_SPRING = { stiffness: 180, damping: 18, mass: 1 }
/** `w-60`. */
const LOGO_MAX_WIDTH = 240
/** `max-w-[60vw]`. */
const LOGO_MAX_OF_WIDTH = 0.6
/** emma-logo.svg viewBox: 256 wide, medallion 0..256, wordmark 256..336. */
const LOGO_VIEWBOX = { width: 256, height: 336 }

const logoEntering: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.9 }] },
    animations: {
      opacity: withSpring(1, { ...LOGO_SPRING, overshootClamping: true }),
      transform: [{ scale: withSpring(1, LOGO_SPRING) }],
    },
  }
}

function Dot({ index }: { index: number }) {
  const reducedMotion = useReducedMotion()
  const opacity = useSharedValue(reducedMotion ? 1 : 0.4)
  useEffect(() => {
    if (reducedMotion) return
    const ease = Easing.inOut(Easing.ease)
    opacity.set(
      withDelay(
        index * DOT_STAGGER_MS,
        withRepeat(
          withSequence(
            withTiming(1, { duration: DOT_PERIOD_MS / 2, easing: ease }),
            withTiming(0.4, { duration: DOT_PERIOD_MS / 2, easing: ease }),
          ),
          -1,
        ),
      ),
    )
    return () => cancelAnimation(opacity)
  }, [index, opacity, reducedMotion])
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return <Animated.View testID="splash-dot" style={[styles.dot, style]} />
}

/** The medallion plus the SVG wordmark band of emma-logo.svg. */
function Logo({ width }: { width: number }) {
  const height = (width * LOGO_VIEWBOX.height) / LOGO_VIEWBOX.width
  return (
    <View style={{ width, height }}>
      <Image
        source={emmaAsset('logo')}
        style={{ width, height: width }}
        contentFit="contain"
      />
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}
      >
        {/* The web's font stack starts with -apple-system: the system font. */}
        <SvgText
          x={128}
          y={296}
          textAnchor="middle"
          fontWeight="700"
          fontSize={34}
          letterSpacing={1}
          fill={colors.ink}
        >
          Emma Tutor
        </SvgText>
        <Path
          transform="translate(128 296)"
          d="M 0 14 C -2.6 10, -8.5 10, -8.5 15.5 C -8.5 20, -4.2 22.5, 0 25 C 4.2 22.5, 8.5 20, 8.5 15.5 C 8.5 10, 2.6 10, 0 14 Z"
          fill={colors.myRose}
          stroke={colors.ink}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

export interface SplashProps {
  /** Called once the splash has faded out; App picks the next route. */
  onAdvance: () => void
}

export function Splash({ onAdvance }: SplashProps) {
  const { width, height } = useWindowDimensions()
  const reducedMotion = useReducedMotion()
  const fade = useSharedValue(1)
  const onAdvanceRef = useRef(onAdvance)
  useLayoutEffect(() => {
    onAdvanceRef.current = onAdvance
  })

  useEffect(() => {
    let advanceTimer: ReturnType<typeof setTimeout> | null = null
    const capTimer = setTimeout(() => {
      fade.set(
        withTiming(0, {
          duration: SPLASH_FADE_OUT_MS,
          easing: Easing.out(Easing.ease),
        }),
      )
      advanceTimer = setTimeout(
        () => onAdvanceRef.current(),
        SPLASH_FADE_OUT_MS,
      )
    }, WARM_CAP_MS)
    return () => {
      clearTimeout(capTimer)
      if (advanceTimer !== null) clearTimeout(advanceTimer)
    }
  }, [fade])

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get() }))
  const logoWidth = Math.min(LOGO_MAX_WIDTH, width * LOGO_MAX_OF_WIDTH)
  // Web: the gradient circle reaches the farthest corner from (50%, 45%);
  // its 60 % stop is where the wash has faded out.
  const washRadius = 0.6 * Math.hypot(width / 2, height * 0.55)

  return (
    <View
      testID="route-splash"
      style={styles.root}
      accessibilityLabel="Emma is waking up"
    >
      <Animated.View style={[styles.fill, fadeStyle]}>
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient
              id="wash"
              cx={width / 2}
              cy={height * 0.45}
              r={washRadius}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={colors.myPink} stopOpacity={0.1} />
              <Stop offset="1" stopColor={colors.myCream} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#wash)" />
        </Svg>

        <View style={styles.center}>
          <Animated.View
            entering={reducedMotion ? FadeIn.duration(300) : logoEntering}
          >
            <Logo width={logoWidth} />
          </Animated.View>
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <Dot key={i} index={i} />
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { ...FILL, backgroundColor: colors.myCream },
  fill: { ...FILL },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 16, marginTop: 40 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.myRose,
  },
})
