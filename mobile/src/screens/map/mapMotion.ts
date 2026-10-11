/** Shared motion helpers of the map. */
import { useEffect } from 'react'
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { EASE_IN_OUT } from '../hub/clay'

/** Framer `easeOut` (the map's 250 ms entrance). */
export const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)

/** A 0 → 1 → 0 loop of `periodMs` (held at 0 with Reduce Motion). */
export function useLoop(periodMs: number, reducedMotion: boolean) {
  const t = useSharedValue(0)
  useEffect(() => {
    if (reducedMotion) {
      t.set(0)
      return
    }
    const half = { duration: periodMs / 2, easing: EASE_IN_OUT }
    t.set(
      withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1),
    )
    return () => cancelAnimation(t)
  }, [t, periodMs, reducedMotion])
  return t
}
