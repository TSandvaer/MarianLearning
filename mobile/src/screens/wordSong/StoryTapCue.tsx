/**
 * The story word-tap cue's hand (Kyle's call on PR #599, Dave's CONFIRM):
 * on the first story card of a session, Greet's finger-tap hand
 * (`FINGER_TAP_XML`, drawn the way `WakeNudgeIcon` draws it) taps word 0
 * ("The") once, early in the reading beat. WordSong owns the clock and the
 * fire; this is the hand alone, mounted only during the run.
 *
 * From the mount (beat + 600 ms): opacity 0 → 1 and a rise 8 → 0 over
 * 300 ms (inOut, Greet's); the press 1 → 0.9 over 100 ms (ease-out); at
 * + 400 (beat + 1,000, the fire) the release 0.9 → 1 over 150 ms; at
 * + 1,400 opacity 1 → 0 over 400 ms; WordSong unmounts it at + 1,800.
 * Her tap: opacity → 0 over 200 ms. [Reduce Motion: the fades only; it
 * mounts at the press point and never presses.]
 *
 * Size S: 48 pt on phones, 64 on a tablet (Greet's `ICON_SIZE`). The
 * fingertip is at (32, 18) in the SVG's 64-unit box, so (0.5 S, 0.28 S)
 * sits on the press point. See-through to touch and to VoiceOver.
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
import {
  STORY_TAP_CUE_CANCEL_OUT_MS,
  STORY_TAP_CUE_HOLD_MS,
  STORY_TAP_CUE_IN_MS,
  STORY_TAP_CUE_OUT_MS,
  STORY_TAP_CUE_PRESS_MS,
  STORY_TAP_CUE_RELEASE_MS,
  STORY_TAP_CUE_TIP,
  storyTapCueMotion,
} from './storyTapCueMotion'

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)

export interface StoryTapCueProps {
  /** The press point, in the card's coordinates. */
  x: number
  y: number
  size: number
  /** Her tap: the hand fades out (WordSong unmounts it 200 ms later). */
  leaving: boolean
}

export function StoryTapCue({ x, y, size, leaving }: StoryTapCueProps) {
  const reducedMotion = useReducedMotion()
  const motion = storyTapCueMotion(reducedMotion)
  const opacity = useSharedValue(0)
  const rise = useSharedValue(motion.riseFrom)
  const scale = useSharedValue(1)

  useEffect(() => {
    const inOut = Easing.inOut(Easing.ease)
    opacity.set(
      withSequence(
        withTiming(1, { duration: STORY_TAP_CUE_IN_MS, easing: inOut }),
        withDelay(
          STORY_TAP_CUE_PRESS_MS + STORY_TAP_CUE_HOLD_MS,
          withTiming(0, { duration: STORY_TAP_CUE_OUT_MS, easing: inOut }),
        ),
      ),
    )
    if (!motion.press) return
    rise.set(withTiming(0, { duration: STORY_TAP_CUE_IN_MS, easing: inOut }))
    scale.set(
      withDelay(
        STORY_TAP_CUE_IN_MS,
        withSequence(
          withTiming(0.9, {
            duration: STORY_TAP_CUE_PRESS_MS,
            easing: EASE_OUT,
          }),
          withTiming(1, {
            duration: STORY_TAP_CUE_RELEASE_MS,
            easing: EASE_OUT,
          }),
        ),
      ),
    )
  }, [motion.press, opacity, rise, scale])

  useEffect(() => {
    if (!leaving) return
    opacity.set(
      withTiming(0, {
        duration: STORY_TAP_CUE_CANCEL_OUT_MS,
        easing: Easing.inOut(Easing.ease),
      }),
    )
  }, [leaving, opacity])

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: rise.get() }, { scale: scale.get() }],
  }))

  return (
    <Animated.View
      testID="word-story-tap-cue"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.hand,
        {
          left: x - STORY_TAP_CUE_TIP.x * size,
          top: y - STORY_TAP_CUE_TIP.y * size,
          width: size,
          height: size,
        },
        animated,
      ]}
    >
      <SvgXml xml={FINGER_TAP_XML} width={size} height={size} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  hand: { position: 'absolute', pointerEvents: 'none' },
})
