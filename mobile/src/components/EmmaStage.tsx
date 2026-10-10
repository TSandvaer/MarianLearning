/**
 * App-level Emma — the native stand-in for Framer Motion's
 * `layoutId="emma"` (carried over from the Phase 0 spike).
 *
 * Web: every screen renders its own `<m.img layoutId="emma">`; Framer
 * measures the old and new boxes across unmount/mount and animates between
 * them, and `key={pose}` + AnimatePresence cross-fades idle <-> celebration.
 *
 * Native: Reanimated's real equivalent (`sharedTransitionTag`) is behind the
 * static feature flag ENABLE_SHARED_ELEMENT_TRANSITIONS (default false in
 * reanimated 4.5.1, src/featureFlags/staticFlags.json), and it only animates
 * across react-navigation native-stack screens, which this app doesn't use.
 *
 * So Emma is HOISTED: one persistent view owned by App, positioned from the
 * current screen's layout rect (src/layout/layout.ts). When the rect
 * changes (Greet -> Math, Math -> Hub, or a rotation), the `layout`
 * transition springs her to the new box. The pose swap is expo-image's
 * native cross-dissolve on source change, plus the per-pose rotateZ tilt.
 */
import {
  CELEBRATION_DURATION_MS,
  CELEBRATION_TILT_KEYFRAMES,
  CELEBRATION_TILT_TIMES,
  TILT_BY_POSE,
  TILT_SPRING_BY_POSE,
  type EmmaPose,
} from '@marian/core/character/emmaPose'
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  LinearTransition,
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
import { emmaAsset } from '../assets'
import type { Rect } from '../layout/layout'

/** Web EMMA_ENTRANCE_SPRING (Greet.tsx): stiffness 220, damping 22, delay 0.3 s. */
const ENTRANCE_SPRING = { stiffness: 220, damping: 22, mass: 1 }
const ENTRANCE_DELAY_MS = 300

/**
 * Greet's slide-in: from x -120, y +60, opacity 0 to rest. Custom worklet
 * because no built-in preset moves on both axes.
 */
const emmaEntering: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: {
      opacity: 0,
      transform: [{ translateX: -120 }, { translateY: 60 }],
    },
    animations: {
      opacity: withDelay(
        ENTRANCE_DELAY_MS,
        withSpring(1, { ...ENTRANCE_SPRING, overshootClamping: true }),
      ),
      transform: [
        {
          translateX: withDelay(
            ENTRANCE_DELAY_MS,
            withSpring(0, ENTRANCE_SPRING),
          ),
        },
        {
          translateY: withDelay(
            ENTRANCE_DELAY_MS,
            withSpring(0, ENTRANCE_SPRING),
          ),
        },
      ],
    },
  }
}

/** Frame-to-frame move between screens: same spring as the entrance. */
const emmaLayout = LinearTransition.springify().stiffness(220).damping(22)

export interface Breath {
  /** Peak scale. Greet: 1.05 / 2.4 s. EmmaCharacter (Math, Hub): 1.02 / 4 s. */
  scale: number
  periodS: number
}

/**
 * - `greet`: Greet's own motion (web Greet.tsx): the breath runs in every
 *   pose, 1 s after the slide-in, around her centre.
 * - `character`: the web's `EmmaCharacter` (Math, and every later screen):
 *   tilt and breath pivot at her feet (`transform-origin: 50% 100%`), she
 *   breathes only while idle, and `celebration` is the keyframed tilt
 *   0 → -6° (200 ms ease-out) → hold 250 ms → 0 (250 ms ease-in-out).
 */
export type EmmaMotion = 'greet' | 'character'

/** Framer `easeOut` / `easeInOut`. */
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)

export interface EmmaStageProps {
  frame: Rect
  pose: EmmaPose
  breath: Breath
  /** Default `greet` (the motion Greet shipped with in #531). */
  motion?: EmmaMotion
}

export function EmmaStage({
  frame,
  pose,
  breath,
  motion = 'greet',
}: EmmaStageProps) {
  const reducedMotion = useReducedMotion()
  const rotate = useSharedValue(0)
  const scale = useSharedValue(1)
  const character = motion === 'character'

  useEffect(() => {
    if (reducedMotion) {
      rotate.set(0)
      return
    }
    if (character && pose === 'celebration') {
      const [k0, k1, k2, k3] = CELEBRATION_TILT_KEYFRAMES
      const [, t1, t2] = CELEBRATION_TILT_TIMES
      const ms = (from: number, to: number) =>
        (to - from) * CELEBRATION_DURATION_MS
      rotate.set(
        withSequence(
          withTiming(k0, { duration: 0 }),
          withTiming(k1, { duration: ms(0, t1), easing: EASE_OUT }),
          withTiming(k2, { duration: ms(t1, t2), easing: Easing.linear }),
          withTiming(k3, { duration: ms(t2, 1), easing: EASE_IN_OUT }),
        ),
      )
      return
    }
    const spring = TILT_SPRING_BY_POSE[pose]
    rotate.set(
      withSpring(TILT_BY_POSE[pose], {
        stiffness: spring.stiffness,
        damping: spring.damping,
        mass: 1,
      }),
    )
  }, [pose, reducedMotion, rotate, character])

  const breathing = !reducedMotion && (!character || pose === 'idle')
  useEffect(() => {
    if (!breathing) {
      cancelAnimation(scale)
      scale.set(1)
      return
    }
    const half = (breath.periodS * 1000) / 2
    const ease = character ? EASE_IN_OUT : Easing.inOut(Easing.ease)
    const loop = withRepeat(
      withSequence(
        withTiming(breath.scale, { duration: half, easing: ease }),
        withTiming(1, { duration: half, easing: ease }),
      ),
      -1,
    )
    // Greet: the breath starts after the slide-in lands (web: delay
    // 0.3 + 0.7 s). EmmaCharacter starts it at once.
    scale.set(character ? loop : withDelay(1000, loop))
    return () => cancelAnimation(scale)
  }, [breath.periodS, breath.scale, breathing, character, scale])

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }, { rotate: `${rotate.get()}deg` }],
  }))

  return (
    <Animated.View
      testID={`emma-${pose}`}
      // Reduce Motion: she fades in instead of sliding (session-1.md).
      entering={reducedMotion ? FadeIn.duration(300) : emmaEntering}
      layout={emmaLayout}
      style={[
        styles.frame,
        {
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
        },
      ]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, character && styles.feet, innerStyle]}
      >
        <Image
          source={emmaAsset(pose)}
          contentFit="contain"
          // EmmaCharacter cross-fades a pose in over 200 ms.
          transition={{
            duration: character ? 200 : 150,
            effect: 'cross-dissolve',
          }}
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Emma"
        />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // zIndex 1: between a screen's background (0) and foreground (2)
  // layers, e.g. Greet's ring below her and its nudge icon above.
  frame: { position: 'absolute', pointerEvents: 'none', zIndex: 1 },
  // EmmaCharacter's `transform-origin: 50% 100%`.
  feet: { transformOrigin: '50% 100%' },
})
