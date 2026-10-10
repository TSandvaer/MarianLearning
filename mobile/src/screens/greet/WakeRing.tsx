/**
 * The Wake state's ready ring around Emma (web Greet.tsx; spec
 * session-1.md § Screen 2 Motion / States). A plain `my-pink` circle, no
 * asset. It is not the tap target (the whole safe area is).
 *
 * - At +900 ms after Greet mounts: scale 0.9 → 1 and opacity 0 → 0.4 over
 *   200 ms ease-out, then the opacity pulses 0.4 → 0.9 → 0.4 every 1.4 s.
 * - Out (the wake tap): fades and scales to 0.95 over 250 ms, from
 *   wherever the pulse was. It stays mounted, invisible, after that.
 * - Reduce Motion: fades to a static 0.5, no scale, no pulse.
 */
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import type { Rect } from '../../layout/layout'
import { colors } from '../../theme'

export const RING_REVEAL_DELAY_MS = 900
export const RING_REVEAL_MS = 200
export const RING_PULSE_PERIOD_MS = 1_400
export const RING_EXIT_MS = 250

export interface WakeRingProps {
  rect: Rect
  stroke: number
  /** `false` from the wake tap on: the ring leaves (from its current look). */
  visible: boolean
}

export function WakeRing({ rect, stroke, visible }: WakeRingProps) {
  const reducedMotion = useReducedMotion()
  const opacity = useSharedValue(0)
  const scale = useSharedValue(reducedMotion ? 1 : 0.9)

  useEffect(() => {
    const out = Easing.out(Easing.ease)
    if (!visible) {
      cancelAnimation(opacity)
      cancelAnimation(scale)
      opacity.set(withTiming(0, { duration: RING_EXIT_MS, easing: out }))
      if (!reducedMotion) {
        scale.set(withTiming(0.95, { duration: RING_EXIT_MS, easing: out }))
      }
      return
    }
    if (reducedMotion) {
      scale.set(1)
      opacity.set(
        withDelay(
          RING_REVEAL_DELAY_MS,
          withTiming(0.5, { duration: RING_REVEAL_MS, easing: out }),
        ),
      )
      return () => cancelAnimation(opacity)
    }
    const inOut = Easing.inOut(Easing.ease)
    const half = RING_PULSE_PERIOD_MS / 2
    scale.set(
      withDelay(
        RING_REVEAL_DELAY_MS,
        withTiming(1, { duration: RING_REVEAL_MS, easing: out }),
      ),
    )
    opacity.set(
      withDelay(
        RING_REVEAL_DELAY_MS,
        withSequence(
          withTiming(0.4, { duration: RING_REVEAL_MS, easing: out }),
          withRepeat(
            withSequence(
              withTiming(0.9, { duration: half, easing: inOut }),
              withTiming(0.4, { duration: half, easing: inOut }),
            ),
            -1,
          ),
        ),
      ),
    )
    return () => {
      cancelAnimation(opacity)
      cancelAnimation(scale)
    }
  }, [opacity, reducedMotion, scale, visible])

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }))

  return (
    <Animated.View
      testID={visible ? 'greet-ready-ring' : 'greet-ready-ring-leaving'}
      style={[
        styles.ring,
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          borderRadius: rect.width / 2,
          borderWidth: stroke,
        },
        animated,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderColor: colors.myPink,
    pointerEvents: 'none',
  },
})
