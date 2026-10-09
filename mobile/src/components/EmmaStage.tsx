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

export interface EmmaStageProps {
  frame: Rect
  pose: EmmaPose
  breath: Breath
}

export function EmmaStage({ frame, pose, breath }: EmmaStageProps) {
  const reducedMotion = useReducedMotion()
  const rotate = useSharedValue(0)
  const scale = useSharedValue(1)

  useEffect(() => {
    const spring = TILT_SPRING_BY_POSE[pose]
    rotate.set(
      reducedMotion
        ? 0
        : withSpring(TILT_BY_POSE[pose], {
            stiffness: spring.stiffness,
            damping: spring.damping,
            mass: 1,
          }),
    )
  }, [pose, reducedMotion, rotate])

  useEffect(() => {
    if (reducedMotion) {
      scale.set(1)
      return
    }
    const half = (breath.periodS * 1000) / 2
    const ease = Easing.inOut(Easing.ease)
    // Breathing starts after the slide-in lands (web: delay 0.3 + 0.7 s).
    scale.set(
      withDelay(
        1000,
        withRepeat(
          withSequence(
            withTiming(breath.scale, { duration: half, easing: ease }),
            withTiming(1, { duration: half, easing: ease }),
          ),
          -1,
        ),
      ),
    )
    return () => cancelAnimation(scale)
  }, [breath.periodS, breath.scale, reducedMotion, scale])

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }, { rotate: `${rotate.get()}deg` }],
  }))

  return (
    <Animated.View
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
      <Animated.View style={[StyleSheet.absoluteFill, innerStyle]}>
        <Image
          source={emmaAsset(pose)}
          contentFit="contain"
          transition={{ duration: 150, effect: 'cross-dissolve' }}
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
})
