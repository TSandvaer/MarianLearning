/**
 * Greet background: `public/assets/bg-clouds.svg` (`preserveAspectRatio
 * xMidYMid slice`, i.e. `bg-cover bg-center`), fading in over 600 ms
 * ease-out, drifting `x: [0, 10, 0]` on a 20 s mirrored loop. Reduce
 * Motion: no drift (web Greet.tsx, spec session-1.md § Screen 2 Motion).
 */
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SvgXml } from 'react-native-svg'
import { BG_CLOUDS_XML } from '../../assets/vectors'

export const CLOUD_FADE_MS = 600
export const CLOUD_DRIFT_PX = 10
export const CLOUD_DRIFT_S = 20

export function Clouds() {
  const reducedMotion = useReducedMotion()
  const x = useSharedValue(0)

  useEffect(() => {
    if (reducedMotion) return
    const half = (CLOUD_DRIFT_S * 1000) / 2
    const ease = Easing.inOut(Easing.ease)
    x.set(
      withRepeat(
        withSequence(
          withTiming(CLOUD_DRIFT_PX, { duration: half, easing: ease }),
          withTiming(0, { duration: half, easing: ease }),
        ),
        -1,
      ),
    )
    return () => cancelAnimation(x)
  }, [reducedMotion, x])

  const drift = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
  }))

  return (
    <Animated.View
      testID="greet-clouds"
      entering={FadeIn.duration(CLOUD_FADE_MS).easing(Easing.out(Easing.ease))}
      style={[StyleSheet.absoluteFill, styles.passThrough, drift]}
    >
      <SvgXml xml={BG_CLOUDS_XML} width="100%" height="100%" />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  passThrough: { pointerEvents: 'none' },
})
