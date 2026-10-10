/**
 * The subitising scaffold flash: web `DotCardOverlay` (two die faces for
 * `a + b`, both ≤ 5) and `SubMinuendOverlay` (the minuend of a sub-to-10
 * problem: a die face for 5, a ten-frame for 6–10). Same lifecycle as the
 * web (`@marian/core/math/dotCard` timings):
 *
 *   fadingIn  200 ms  spring (220 / 22) opacity 0 → 1, scale 0.92 → 1
 *   holding   700 ms  (Reduce Motion: starts here, 900 ms, no fade)
 *   fadingOut 200 ms  ease-out to opacity 0, scale 0.92 → onComplete
 *
 * The phase timers stop while the app is in the background and re-arm on
 * return (web: `pageHidden`). It covers the counting row without taking
 * layout space, so the equation and the chips never move.
 */
import {
  DOT_CARD_FADE_IN_MS,
  DOT_CARD_FADE_IN_SPRING,
  DOT_CARD_FADE_OUT_MS,
  DOT_CARD_HOLD_MS,
  DOT_CARD_REDUCED_MOTION_HOLD_MS,
} from '@marian/core/math/dotCard'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { DotCardCell, TenFrameCell } from './glyphs'

type Phase = 'fadingIn' | 'holding' | 'fadingOut'

/** Framer `easeOut`. */
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)

export type ScaffoldContent =
  | { kind: 'dot-card'; pipsA: number; pipsB: number }
  | { kind: 'sub-minuend'; minuend: number }

export interface ScaffoldFlashProps {
  content: ScaffoldContent
  /** Cell size (web 80) and the gap between the two dot-card cells. */
  cell: number
  gap: number
  appHidden: boolean
  onComplete: () => void
}

export function ScaffoldFlash({
  content,
  cell,
  gap,
  appHidden,
  onComplete,
}: ScaffoldFlashProps) {
  const reducedMotion = useReducedMotion()
  const [phase, setPhase] = useState<Phase>(
    reducedMotion ? 'holding' : 'fadingIn',
  )
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  useLayoutEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const opacity = useSharedValue(reducedMotion ? 1 : 0)
  const scale = useSharedValue(reducedMotion ? 1 : 0.92)

  useEffect(() => {
    if (phase === 'fadingIn') {
      const spring = {
        stiffness: DOT_CARD_FADE_IN_SPRING.stiffness,
        damping: DOT_CARD_FADE_IN_SPRING.damping,
        mass: 1,
      }
      opacity.set(withSpring(1, { ...spring, overshootClamping: true }))
      scale.set(withSpring(1, spring))
    } else if (phase === 'fadingOut') {
      const out = { duration: DOT_CARD_FADE_OUT_MS, easing: EASE_OUT }
      opacity.set(withTiming(0, out))
      scale.set(withTiming(0.92, out))
    }
  }, [phase, opacity, scale])

  useEffect(() => {
    if (appHidden) return // re-armed on return
    let id: ReturnType<typeof setTimeout> | undefined
    if (phase === 'fadingIn') {
      id = setTimeout(() => setPhase('holding'), DOT_CARD_FADE_IN_MS)
    } else if (phase === 'holding') {
      id = setTimeout(
        () => setPhase('fadingOut'),
        reducedMotion ? DOT_CARD_REDUCED_MOTION_HOLD_MS : DOT_CARD_HOLD_MS,
      )
    } else {
      id = setTimeout(() => {
        if (completedRef.current) return
        completedRef.current = true
        onCompleteRef.current()
      }, DOT_CARD_FADE_OUT_MS)
    }
    return () => {
      if (id !== undefined) clearTimeout(id)
    }
  }, [phase, appHidden, reducedMotion])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }))

  return (
    <Animated.View
      testID={
        content.kind === 'dot-card' ? 'math-dot-card' : 'math-sub-minuend-card'
      }
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, { gap }, style]}
    >
      {content.kind === 'dot-card' ? (
        <>
          <DotCardCell pips={content.pipsA} size={cell} />
          <DotCardCell pips={content.pipsB} size={cell} />
        </>
      ) : content.minuend === 5 ? (
        <DotCardCell pips={5} size={cell} />
      ) : (
        <TenFrameCell pips={content.minuend} height={cell} />
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
})
