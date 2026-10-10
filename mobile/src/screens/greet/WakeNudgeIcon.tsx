/**
 * The Wake re-prompt's finger-tap icon (`public/assets/icon-finger-tap.svg`),
 * centred on the ring. One run, then the parent unmounts it:
 * fade in 300 ms, one pulse (scale 1 → 1.1 → 1) over 600 ms, hold 2.5 s,
 * fade out 400 ms (spec session-1.md § Screen 2 States, "Wake re-prompt",
 * and the web's ICON_* constants). Reduce Motion: no pulse.
 *
 * The web renders it at 64 CSS px (its comment: "48pt at 1.333px/pt"); an
 * iPad draws a CSS px as a point, so it is 64 pt here.
 */
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SvgXml } from 'react-native-svg'
import { FINGER_TAP_XML } from '../../assets/vectors'

export const ICON_SIZE = 64
export const ICON_FADE_IN_MS = 300
export const ICON_PULSE_MS = 600
export const ICON_HOLD_AFTER_PULSE_MS = 2_500
export const ICON_FADE_OUT_MS = 400
/** The whole run; the parent unmounts the icon after it. */
export const ICON_TOTAL_MS =
  ICON_FADE_IN_MS + ICON_PULSE_MS + ICON_HOLD_AFTER_PULSE_MS + ICON_FADE_OUT_MS

export interface WakeNudgeIconProps {
  /** Centre point (the ring's centre). */
  cx: number
  cy: number
}

export function WakeNudgeIcon({ cx, cy }: WakeNudgeIconProps) {
  const reducedMotion = useReducedMotion()
  const opacity = useSharedValue(0)
  const scale = useSharedValue(1)

  useEffect(() => {
    const inOut = Easing.inOut(Easing.ease)
    opacity.set(
      withSequence(
        withTiming(1, { duration: ICON_FADE_IN_MS, easing: inOut }),
        withDelay(
          ICON_PULSE_MS + ICON_HOLD_AFTER_PULSE_MS,
          withTiming(0, { duration: ICON_FADE_OUT_MS, easing: inOut }),
        ),
      ),
    )
    if (reducedMotion) return
    scale.set(
      withDelay(
        ICON_FADE_IN_MS,
        withSequence(
          withTiming(1.1, { duration: ICON_PULSE_MS / 2, easing: inOut }),
          withTiming(1, { duration: ICON_PULSE_MS / 2, easing: inOut }),
        ),
      ),
    )
  }, [opacity, reducedMotion, scale])

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }))

  return (
    <Animated.View
      testID="greet-wake-icon"
      accessibilityLabel="Tap here"
      style={[
        styles.icon,
        { left: cx - ICON_SIZE / 2, top: cy - ICON_SIZE / 2 },
        animated,
      ]}
    >
      <SvgXml xml={FINGER_TAP_XML} width={ICON_SIZE} height={ICON_SIZE} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  icon: {
    position: 'absolute',
    width: ICON_SIZE,
    height: ICON_SIZE,
    pointerEvents: 'none',
  },
})
