/**
 * The motion beats of the extended Math visuals (`SkipTrack`, `GroupsRow`,
 * `NumberStrip`, and the lift-out of `PlaceValueStage` and `TakeAwayRow`), spec `design/native/math-skip-counting-multiplication-native.md`
 * § 7. Reduce Motion: no scaling anywhere; fades only.
 */
import { useEffect, useLayoutEffect, useRef } from 'react'
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { HINT_FLOWER_PULSE_MS } from './CountingRow'

/** A ripple / pulse: 300 ms in all (150 up, 150 down), as `CountingRow`'s. */
export const PULSE_HALF_MS = HINT_FLOWER_PULSE_MS
/** Between two elements of a ripple, and between two hops fading in. */
export const STAGGER_MS = HINT_FLOWER_PULSE_MS
/** Fades: hops, tags, "+", the landmark fill, the guided numerals. */
export const FADE_MS = 200
/** The "?" fades out before the answer springs in. */
export const GAP_OUT_MS = 100
export const SPRING = { stiffness: 260, damping: 20, mass: 1 }
/** A missing number's bloom (`MissingNumber`, the flower bed): 1 → 1.15 → 1. */
export const BLOOM_SPRING = { stiffness: 300, damping: 14, mass: 1 }

export const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)
export const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)

/** More and less's lift-out (content wave 4 § 2.5), shared with the
 *  take-away picture: a lifted block or flower fades over 250 ms, 150 on a
 *  fast right tap, and over 200 ms with no rise on Reduce Motion. */
export const LIFT_MS = 250
export const LIFT_FAST_MS = 150
export const LIFT_REDUCED_MS = 200

/** A lift-out's fade for `mode` (an instant one has none). */
export function liftMs(mode: 'normal' | 'fast', reducedMotion: boolean) {
  if (reducedMotion) return LIFT_REDUCED_MS
  return mode === 'fast' ? LIFT_FAST_MS : LIFT_MS
}

/** Run `onRise` when `value` goes from falsy to truthy, or a number grows;
 *  never on mount. */
export function useOnRise(value: boolean | number, onRise: () => void): void {
  const prev = useRef(value)
  const cb = useRef(onRise)
  useLayoutEffect(() => {
    cb.current = onRise
  })
  useEffect(() => {
    const before = prev.current
    prev.current = value
    if (Number(value) > Number(before)) cb.current()
  }, [value])
}

/** A scale pulse (1 → peak → 1 over 300 ms) the caller fires. No-op on
 *  Reduce Motion. */
export function usePulse() {
  const reducedMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }))
  const pulse = (peak: number, delayMs = 0) => {
    if (reducedMotion) return
    const half = { duration: PULSE_HALF_MS, easing: EASE_IN_OUT }
    scale.set(
      withDelay(
        delayMs,
        withSequence(withTiming(peak, half), withTiming(1, half)),
      ),
    )
  }
  return { style, pulse }
}

/** Opacity that follows `visible`: starts there, then fades over `ms`
 *  (after `delayMs`). */
export function useFade(visible: boolean, ms = FADE_MS, delayMs = 0) {
  const opacity = useSharedValue(visible ? 1 : 0)
  useEffect(() => {
    opacity.set(
      withDelay(
        visible ? delayMs : 0,
        withTiming(visible ? 1 : 0, { duration: ms, easing: EASE_OUT }),
      ),
    )
  }, [visible, ms, delayMs, opacity])
  return useAnimatedStyle(() => ({ opacity: opacity.get() }))
}

/**
 * A numeral that springs in when `shown` rises (from `from`, through an
 * optional `overshoot`, to 1; stiffness 260, damping 20), after `delayMs`.
 * Reduce Motion: a `FADE_MS` fade.
 */
export function useSpringIn(
  shown: boolean,
  {
    from = 0.6,
    overshoot,
    delayMs = 0,
  }: {
    from?: number
    overshoot?: number
    delayMs?: number
  } = {},
) {
  const reducedMotion = useReducedMotion()
  const opacity = useSharedValue(shown ? 1 : 0)
  const scale = useSharedValue(1)
  useOnRise(shown, () => {
    if (reducedMotion) {
      opacity.set(withDelay(delayMs, withTiming(1, { duration: FADE_MS })))
      return
    }
    scale.set(from)
    opacity.set(withDelay(delayMs, withTiming(1, { duration: GAP_OUT_MS })))
    scale.set(
      withDelay(
        delayMs,
        overshoot === undefined
          ? withSpring(1, SPRING)
          : withSequence(withSpring(overshoot, SPRING), withSpring(1, SPRING)),
      ),
    )
  })
  useEffect(() => {
    if (!shown) {
      opacity.set(0)
      scale.set(1)
    }
  }, [shown, opacity, scale])
  return useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }))
}
