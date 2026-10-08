/**
 * Greet heart CTA — port of `public/assets/heart-button.svg` + the web
 * heart's motion (Greet.tsx):
 *  - enter: spring scale 0 -> 1 + opacity (stiffness 300, damping 15)
 *  - idle bob: y [0, -6, 0] over 2 s, mirrored, infinite
 *  - tap: squish scale [1, 1.15, 0.95, 1] over 250 ms ease-out
 *  - exit: scale -> 0 + opacity -> 0
 */
import { useEffect } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg'

const HEART_SPRING = { stiffness: 300, damping: 15, mass: 1 }

const heartEntering: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0 }] },
    animations: {
      opacity: withSpring(1, { ...HEART_SPRING, overshootClamping: true }),
      transform: [{ scale: withSpring(1, HEART_SPRING) }],
    },
  }
}

const heartExiting: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 200 }),
      transform: [{ scale: withTiming(0, { duration: 200 }) }],
    },
  }
}

function HeartGlyph({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 100">
      <Defs>
        <LinearGradient id="heartFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFB6C5" />
          <Stop offset="100%" stopColor="#F48FB1" />
        </LinearGradient>
        <RadialGradient id="shine" cx="38%" cy="32%" r="22%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.85} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path
        d="M 60 92 C 30 74, 8 56, 8 34 C 8 18, 22 8, 36 8 C 48 8, 58 16, 60 24 C 62 16, 72 8, 84 8 C 98 8, 112 18, 112 34 C 112 56, 90 74, 60 92 Z"
        fill="#3D2B3D"
        opacity={0.1}
        transform="translate(0 4)"
      />
      <Path
        d="M 60 88 C 30 70, 8 52, 8 30 C 8 14, 22 4, 36 4 C 48 4, 58 12, 60 20 C 62 12, 72 4, 84 4 C 98 4, 112 14, 112 30 C 112 52, 90 70, 60 88 Z"
        fill="url(#heartFill)"
        stroke="#E07AA0"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Ellipse cx="42" cy="26" rx="14" ry="8" fill="url(#shine)" />
    </Svg>
  )
}

export interface HeartButtonProps {
  width: number
  height: number
  squishing: boolean
  disabled: boolean
  onPress: () => void
  accessibilityLabel: string
}

export function HeartButton({
  width,
  height,
  squishing,
  disabled,
  onPress,
  accessibilityLabel,
}: HeartButtonProps) {
  const reducedMotion = useReducedMotion()
  const bob = useSharedValue(0)
  const squish = useSharedValue(1)

  useEffect(() => {
    if (reducedMotion || squishing) {
      cancelAnimation(bob)
      bob.value = withTiming(0, { duration: 100 })
      return
    }
    const ease = Easing.inOut(Easing.ease)
    bob.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1000, easing: ease }),
        withTiming(0, { duration: 1000, easing: ease }),
      ),
      -1,
    )
    return () => cancelAnimation(bob)
  }, [bob, reducedMotion, squishing])

  useEffect(() => {
    if (!squishing) return
    const ease = Easing.out(Easing.ease)
    // 250 ms split over three keyframe segments.
    squish.value = withSequence(
      withTiming(1.15, { duration: 83, easing: ease }),
      withTiming(0.95, { duration: 84, easing: ease }),
      withTiming(1, { duration: 83, easing: ease }),
    )
  }, [squishing, squish])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }, { scale: squish.value }],
  }))

  return (
    <Animated.View entering={heartEntering} exiting={heartExiting}>
      <Animated.View style={style}>
        <Pressable
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          hitSlop={12}
          style={[styles.hit, { width, height }]}
        >
          <HeartGlyph width={width} height={height} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  hit: { alignItems: 'center', justifyContent: 'center' },
})
