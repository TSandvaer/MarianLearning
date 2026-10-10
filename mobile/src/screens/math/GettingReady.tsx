/**
 * "Getting ready" (web `src/components/GettingReady.tsx`): three rose dots
 * breathing in turn while the session start is in flight (Emma's Path
 * 1/10). 24 pt dots, 16 pt apart; each pulses opacity 0.35 → 1 → 0.35 and
 * scale 0.8 → 1.15 → 0.8 over 1.2 s, 0.2 s after the previous one.
 * Reduce Motion: still dots at opacity 0.6.
 */
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
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
import { colors } from '../../theme'

const PERIOD_MS = 1200
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)

function Dot({ index }: { index: number }) {
  const reducedMotion = useReducedMotion()
  const t = useSharedValue(0)
  useEffect(() => {
    if (reducedMotion) return
    const half = { duration: PERIOD_MS / 2, easing: EASE_IN_OUT }
    t.set(
      withDelay(
        index * 200,
        withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1),
      ),
    )
    return () => cancelAnimation(t)
  }, [index, reducedMotion, t])
  const style = useAnimatedStyle(() =>
    reducedMotion
      ? { opacity: 0.6, transform: [{ scale: 1 }] }
      : {
          opacity: 0.35 + 0.65 * t.get(),
          transform: [{ scale: 0.8 + 0.35 * t.get() }],
        },
  )
  return <Animated.View style={[styles.dot, style]} />
}

export function GettingReady({ testID }: { testID: string }) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Getting ready"
      style={styles.row}
    >
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.myRose,
  },
})
