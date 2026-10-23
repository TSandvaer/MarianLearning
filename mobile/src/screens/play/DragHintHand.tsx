/**
 * Letter critters' drag hint (play-place § 3.3, Thomas 2026-10-23,
 * Marian's play test): the story word-tap cue's hand (`StoryTapCue`:
 * Greet's `FINGER_TAP_XML`, size S, the fingertip on the point) shows a
 * drag from a meadow critter up to the log, `DRAG_HINT_LOOPS` times.
 * LetterCritters owns the clock and the mount; this is the hand alone.
 *
 * One loop (`DRAG_HINT_LOOP_MS`): at the critter, opacity 0 → 1 and the
 * rise 8 → 0 over 300 ms (the cue's entrance); the press 1 → 0.9 over
 * 100 ms; the glide to the log over 900 ms (inOut), pressed; the release
 * 0.9 → 1 over 150 ms; opacity 1 → 0 over 400 ms; a 150 ms rest. Her touch:
 * opacity → 0 over 200 ms. [Reduce Motion: the fades only. It fades in and
 * out at the critter, then at the log, and never moves or presses.]
 *
 * See-through to touch and to VoiceOver.
 */
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SvgXml } from 'react-native-svg'
import { FINGER_TAP_XML } from '../../assets/vectors'
import { OVER_PIECE_Z } from './dragLock'
import type { Point } from './playGeometry'
import {
  STORY_TAP_CUE_CANCEL_OUT_MS,
  STORY_TAP_CUE_IN_MS,
  STORY_TAP_CUE_OUT_MS,
  STORY_TAP_CUE_PRESS_MS,
  STORY_TAP_CUE_RELEASE_MS,
  STORY_TAP_CUE_TIP,
  storyTapCueMotion,
} from '../wordSong/storyTapCueMotion'

export const DRAG_HINT_GLIDE_MS = 900
const REST_MS = 150
export const DRAG_HINT_LOOP_MS =
  STORY_TAP_CUE_IN_MS +
  STORY_TAP_CUE_PRESS_MS +
  DRAG_HINT_GLIDE_MS +
  STORY_TAP_CUE_RELEASE_MS +
  STORY_TAP_CUE_OUT_MS +
  REST_MS
export const DRAG_HINT_LOOPS = 3
/** The mount → the unmount. */
export const DRAG_HINT_MS = DRAG_HINT_LOOPS * DRAG_HINT_LOOP_MS

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)
const IN_OUT = Easing.inOut(Easing.ease)
const at = (v: number) => withTiming(v, { duration: 0 })

export interface DragHintHandProps {
  /** The critter's centre and the log seat's, in screen points. */
  from: Point
  to: Point
  size: number
  reducedMotion: boolean
  /** Her touch: the hand fades out (LetterCritters unmounts it after). */
  leaving: boolean
}

export function DragHintHand({
  from,
  to,
  size,
  reducedMotion,
  leaving,
}: DragHintHandProps) {
  const motion = storyTapCueMotion(reducedMotion)
  const opacity = useSharedValue(0)
  const rise = useSharedValue(motion.riseFrom)
  const scale = useSharedValue(1)
  /** 0 at the critter, 1 at the log. */
  const p = useSharedValue(0)

  useEffect(() => {
    const loop = (seq: number) => withRepeat(seq, DRAG_HINT_LOOPS, false)
    if (!motion.press) {
      // Two fade-in, fade-out beats, at the critter then at the log; the
      // jump between them happens while the hand is see-through.
      const half = DRAG_HINT_LOOP_MS / 2
      const shown = half - STORY_TAP_CUE_IN_MS - STORY_TAP_CUE_OUT_MS
      const beat = () =>
        withSequence(
          withTiming(1, { duration: STORY_TAP_CUE_IN_MS, easing: IN_OUT }),
          withDelay(
            shown,
            withTiming(0, { duration: STORY_TAP_CUE_OUT_MS, easing: IN_OUT }),
          ),
        )
      opacity.set(loop(withSequence(beat(), beat())))
      p.set(
        loop(
          withSequence(at(0), withDelay(half, at(1)), withDelay(half, at(1))),
        ),
      )
      return
    }
    const down = STORY_TAP_CUE_IN_MS + STORY_TAP_CUE_PRESS_MS
    const up = down + DRAG_HINT_GLIDE_MS + STORY_TAP_CUE_RELEASE_MS
    opacity.set(
      loop(
        withSequence(
          withTiming(1, { duration: STORY_TAP_CUE_IN_MS, easing: IN_OUT }),
          withDelay(
            up - STORY_TAP_CUE_IN_MS,
            withTiming(0, { duration: STORY_TAP_CUE_OUT_MS, easing: IN_OUT }),
          ),
          withDelay(REST_MS, at(0)),
        ),
      ),
    )
    rise.set(
      loop(
        withSequence(
          at(motion.riseFrom),
          withTiming(0, { duration: STORY_TAP_CUE_IN_MS, easing: IN_OUT }),
          withDelay(DRAG_HINT_LOOP_MS - STORY_TAP_CUE_IN_MS, at(0)),
        ),
      ),
    )
    scale.set(
      loop(
        withSequence(
          withDelay(
            STORY_TAP_CUE_IN_MS,
            withTiming(0.9, {
              duration: STORY_TAP_CUE_PRESS_MS,
              easing: EASE_OUT,
            }),
          ),
          withDelay(
            DRAG_HINT_GLIDE_MS,
            withTiming(1, {
              duration: STORY_TAP_CUE_RELEASE_MS,
              easing: EASE_OUT,
            }),
          ),
          withDelay(DRAG_HINT_LOOP_MS - up, at(1)),
        ),
      ),
    )
    p.set(
      loop(
        withSequence(
          at(0),
          withDelay(
            down,
            withTiming(1, { duration: DRAG_HINT_GLIDE_MS, easing: IN_OUT }),
          ),
          withDelay(DRAG_HINT_LOOP_MS - down - DRAG_HINT_GLIDE_MS, at(1)),
        ),
      ),
    )
    // Mount-once: LetterCritters remounts it for each hint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!leaving) return
    opacity.set(
      withTiming(0, { duration: STORY_TAP_CUE_CANCEL_OUT_MS, easing: IN_OUT }),
    )
  }, [leaving, opacity])

  const dx = to.x - from.x
  const dy = to.y - from.y
  const animated = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [
      { translateX: p.get() * dx },
      { translateY: p.get() * dy + rise.get() },
      { scale: scale.get() },
    ],
  }))

  return (
    <Animated.View
      testID="critter-drag-hint"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.hand,
        {
          left: from.x - STORY_TAP_CUE_TIP.x * size,
          top: from.y - STORY_TAP_CUE_TIP.y * size,
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
  hand: { position: 'absolute', zIndex: OVER_PIECE_Z, pointerEvents: 'none' },
})
