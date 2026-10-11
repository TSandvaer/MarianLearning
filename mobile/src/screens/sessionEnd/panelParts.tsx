/**
 * The clay panel's moving pieces (web `SessionEnd.tsx` +
 * `sessionEndClay.css`):
 *
 * - `Stars`: one gold star per right answer, feedback only, never a number
 *   (team/DECISIONS.md 2026-10-06). Each twinkles (scale 0.8, opacity 0.7
 *   at the midpoint of a 1.6 s ease-in-out loop), starting 0.5 s + 80 ms
 *   per star after mount. Reduce Motion: still.
 * - `CountBadge`: "2 of 3" / "3 of 3!" springs in (scale 0.6 → 1,
 *   stiffness 320, damping 16) once the flower has landed.
 * - `NewFlower`: today's flower pops in (scale 0 → 1, spring 300 / 14),
 *   then flies into its hole in 0.75 s (`cubic-bezier(.5, 0, .3, 1)`),
 *   ending at the hole's size. Reduce Motion: a 0.2 s fade, no flight.
 */
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'
import { PathImage } from '../../components/PathImage'
import type { Rect } from '../../layout/layout'
import type { PanelContent } from '../../layout/sessionEndLayout'
import { fonts } from '../../theme'
import { StarIcon } from './glyphs'

const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)
/** Web `se-tw`: 1.6 s loop. */
const TWINKLE_PERIOD_MS = 1600
/** Web: the flight to the hole. */
export const FLOWER_FLIGHT_MS = 750
const FLIGHT_EASE = Easing.bezier(0.5, 0, 0.3, 1)
const POP_SPRING = { stiffness: 300, damping: 14, mass: 1 }
const COUNT_SPRING = { stiffness: 320, damping: 16, mass: 1 }

function TwinkleStar({
  size,
  index,
  reducedMotion,
}: {
  size: number
  index: number
  reducedMotion: boolean
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    if (reducedMotion) return
    const half = { duration: TWINKLE_PERIOD_MS / 2, easing: EASE_IN_OUT }
    t.set(
      withDelay(
        Math.round((0.5 + index * 0.08) * 1000),
        withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1),
      ),
    )
    return () => cancelAnimation(t)
  }, [index, reducedMotion, t])
  const twinkle = useAnimatedStyle(() => ({
    opacity: 1 - 0.3 * t.get(),
    transform: [{ scale: 1 - 0.2 * t.get() }],
  }))
  return (
    <Animated.View testID="session-end-star" style={twinkle}>
      <StarIcon size={size} />
    </Animated.View>
  )
}

export function Stars({
  count,
  stars,
  reducedMotion,
}: {
  count: number
  stars: PanelContent['stars']
  reducedMotion: boolean
}) {
  const n = Math.max(0, Math.min(8, count))
  return (
    <View
      testID="session-end-stars"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.row,
        {
          left: stars.rect.x,
          top: stars.rect.y,
          width: stars.rect.width,
          height: stars.rect.height,
          gap: stars.gap,
        },
      ]}
    >
      {Array.from({ length: n }, (_, i) => (
        <TwinkleStar
          key={i}
          size={stars.size}
          index={i}
          reducedMotion={reducedMotion}
        />
      ))}
    </View>
  )
}

const countEntering: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.6 }] },
    animations: {
      opacity: withSpring(1, { ...COUNT_SPRING, overshootClamping: true }),
      transform: [{ scale: withSpring(1, COUNT_SPRING) }],
    },
  }
}

export function CountBadge({
  text,
  rect,
  font,
  reducedMotion,
}: {
  text: string
  rect: Rect
  font: number
  reducedMotion: boolean
}) {
  return (
    <View
      style={[
        styles.row,
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
      ]}
    >
      <Animated.Text
        testID="session-end-count"
        entering={reducedMotion ? FadeIn.duration(200) : countEntering}
        allowFontScaling={false}
        style={[styles.count, { fontSize: font, lineHeight: font * 1.15 }]}
      >
        {text}
      </Animated.Text>
    </View>
  )
}

export type FlowerStage = 'pop' | 'fly'

export function NewFlower({
  stage,
  rect,
  flight,
  reducedMotion,
}: {
  stage: FlowerStage
  rect: Rect
  flight: { x: number; y: number; scale: number }
  reducedMotion: boolean
}) {
  const opacity = useSharedValue(0)
  const scale = useSharedValue(reducedMotion ? 1 : 0)
  const x = useSharedValue(0)
  const y = useSharedValue(0)

  useEffect(() => {
    if (reducedMotion) {
      opacity.set(withTiming(1, { duration: 200 }))
      return
    }
    opacity.set(withSpring(1, { ...POP_SPRING, overshootClamping: true }))
    scale.set(withSpring(1, POP_SPRING))
  }, [opacity, scale, reducedMotion])

  useEffect(() => {
    if (stage !== 'fly') return
    const fly = { duration: FLOWER_FLIGHT_MS, easing: FLIGHT_EASE }
    x.set(withTiming(flight.x, fly))
    y.set(withTiming(flight.y, fly))
    scale.set(withTiming(flight.scale, fly))
  }, [stage, flight.x, flight.y, flight.scale, x, y, scale])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { scale: scale.get() },
    ],
  }))

  return (
    <Animated.View
      testID="session-end-new-flower"
      accessible={false}
      style={[
        styles.newFlower,
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
        style,
      ]}
    >
      <PathImage id="ui-bud-open" px={rect.width} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontFamily: fonts.bold,
    color: '#ffb12e',
    textAlign: 'center',
    textShadowColor: '#8a5a1f',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  newFlower: {
    position: 'absolute',
    zIndex: 3,
    pointerEvents: 'none',
    filter: 'drop-shadow(0px 6px 4px rgba(60, 30, 10, 0.25))',
  },
})
