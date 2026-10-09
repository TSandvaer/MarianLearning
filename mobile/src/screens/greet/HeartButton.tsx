/**
 * Greet's heart CTA (`public/assets/heart-button.svg`) with the web's
 * motion (`src/screens/Greet.tsx`):
 * - in: spring scale 0 → 1 + opacity (stiffness 300, damping 15);
 * - idle bob: y 0 → -6 → 0 over 2 s, looping;
 * - tap: one squish, scale 1 → 1.15 → 0.95 → 1 over 250 ms ease-out;
 * - Reduce Motion: a 300 ms fade in, no bob.
 * Icon-only, no label text: Emma says what it does. Silent on tap.
 */
import { useEffect } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'
import { SvgXml } from 'react-native-svg'
import { HEART_BUTTON_XML } from '../../assets/vectors'
import type { Rect } from '../../layout/layout'

const HEART_SPRING = { stiffness: 300, damping: 15, mass: 1 }
export const HEART_SQUISH_MS = 250
const BOB_PX = 6
const BOB_PERIOD_MS = 2_000

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

export interface HeartButtonProps {
  rect: Rect
  squishing: boolean
  disabled: boolean
  onPress: () => void
  accessibilityLabel: string
}

export function HeartButton({
  rect,
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
      bob.set(withTiming(0, { duration: 100 }))
      return
    }
    const ease = Easing.inOut(Easing.ease)
    bob.set(
      withRepeat(
        withSequence(
          withTiming(-BOB_PX, { duration: BOB_PERIOD_MS / 2, easing: ease }),
          withTiming(0, { duration: BOB_PERIOD_MS / 2, easing: ease }),
        ),
        -1,
      ),
    )
    return () => cancelAnimation(bob)
  }, [bob, reducedMotion, squishing])

  useEffect(() => {
    if (!squishing) return
    const ease = Easing.out(Easing.ease)
    const third = HEART_SQUISH_MS / 3
    squish.set(
      withSequence(
        withTiming(1.15, { duration: third, easing: ease }),
        withTiming(0.95, { duration: third, easing: ease }),
        withTiming(1, { duration: third, easing: ease }),
      ),
    )
  }, [squishing, squish])

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.get() }, { scale: squish.get() }],
  }))

  return (
    <Animated.View
      entering={reducedMotion ? FadeIn.duration(300) : heartEntering}
      style={[
        styles.slot,
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, motion]}>
        <Pressable
          testID="greet-heart"
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
          style={StyleSheet.absoluteFill}
        >
          <SvgXml
            xml={HEART_BUTTON_XML}
            width={rect.width}
            height={rect.height}
          />
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  slot: { position: 'absolute' },
})
