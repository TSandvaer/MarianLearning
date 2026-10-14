/**
 * Number recognition's 1–10 strip (spec
 * `design/native/math-skip-counting-multiplication-native.md` § 10): ten
 * touching cells, 1 to 10 left to right, in place of `math-symbolic`.
 * Flat and not tappable, so it never reads as chips; the chips carry the
 * answer.
 *
 * At the reveal each cell holds a small dot, not its numeral: Marian
 * matches "seven" to the 7 on a chip, not by counting along the strip.
 *
 * - hint 1: the numerals ripple in, 1 → 10 (each dot fades out as its
 *   numeral scales 0.6 → 1, 150 ms apart). They stay.
 * - hint 2: the landmark cell the fact names fills pink, and its numeral
 *   pulses once; it stays lit.
 * - guided answer: any numerals not yet shown appear at once; the target
 *   cell gets a 4 pt rose ring.
 * - correct: the target cell fills pink, and its numeral (in place of the
 *   dot if hint 1 has not played) springs 0.6 → 1.25 → 1.
 */
import { StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import type { NumberStripMetrics } from '../../layout/mathLayout'
import { colors, fonts } from '../../theme'
import {
  EASE_IN_OUT,
  EASE_OUT,
  FADE_MS,
  GAP_OUT_MS,
  PULSE_HALF_MS,
  SPRING,
  STAGGER_MS,
  useFade,
  useOnRise,
  usePulse,
} from './extendedMotion'
import { NUMBER_STRIP_LANDMARK } from './extendedHints'

export interface NumberStripProps {
  /** The number Emma asked for (1..10). */
  target: number
  metrics: NumberStripMetrics
  /** Read line, for screen readers. */
  label: string
  hintStep: 1 | 2 | 3 | null
  guided: boolean
  answered: boolean
}

function Cell({
  n,
  metrics,
  numeralsIn,
  numeralsDelay,
  isTarget,
  isLandmark,
  hint2,
  guided,
  answered,
}: {
  n: number
  metrics: NumberStripMetrics
  numeralsIn: boolean
  numeralsDelay: number
  isTarget: boolean
  isLandmark: boolean
  hint2: boolean
  guided: boolean
  answered: boolean
}) {
  const reducedMotion = useReducedMotion()
  // Once shown, a numeral stays for the rest of the problem; how it came in
  // is decided by what showed it first.
  const numeralShown = numeralsIn || guided || (isTarget && answered)
  const opacity = useSharedValue(numeralShown ? 1 : 0)
  const scale = useSharedValue(1)
  const dot = useSharedValue(numeralShown ? 0 : 1)
  useOnRise(numeralShown, () => {
    const fade = { duration: FADE_MS, easing: EASE_OUT }
    if (numeralsIn) {
      // Hint 1's ripple: 0.6 → 1 while the dot fades out, 150 ms apart.
      dot.set(withDelay(numeralsDelay, withTiming(0, fade)))
      opacity.set(withDelay(numeralsDelay, withTiming(1, fade)))
      if (!reducedMotion) {
        scale.set(0.6)
        scale.set(
          withDelay(
            numeralsDelay,
            withTiming(1, { duration: 2 * PULSE_HALF_MS, easing: EASE_IN_OUT }),
          ),
        )
      }
    } else if (guided) {
      // The guided answer: every numeral at once.
      dot.set(withTiming(0, fade))
      opacity.set(withTiming(1, fade))
    } else {
      // A correct tap before hint 1: the target's numeral replaces its dot
      // (the spring below).
      dot.set(withTiming(0, fade))
    }
  })
  // Correct: the target's numeral springs 0.6 → 1.25 → 1 (Reduce Motion: a
  // fade), whether or not hint 1 showed it already.
  useOnRise(isTarget && answered, () => {
    if (reducedMotion) {
      opacity.set(withTiming(1, { duration: FADE_MS, easing: EASE_OUT }))
      return
    }
    opacity.set(withTiming(1, { duration: GAP_OUT_MS }))
    scale.set(0.6)
    scale.set(withSequence(withSpring(1.25, SPRING), withSpring(1, SPRING)))
  })
  const numeralStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }))
  const dotStyle = useAnimatedStyle(() => ({ opacity: dot.get() }))
  const lit = (isLandmark && hint2) || (isTarget && answered)
  const fillStyle = useFade(lit, FADE_MS)
  const ringStyle = useFade(isTarget && guided, FADE_MS)
  const { style: pulseStyle, pulse } = usePulse()
  useOnRise(isLandmark && hint2, () => pulse(1.1))
  return (
    <View
      testID={`math-strip-cell-${n}${numeralShown ? '' : '-dot'}${lit ? '-lit' : ''}`}
      style={[styles.cell, n > 1 && { borderLeftWidth: metrics.divider }]}
    >
      <Animated.View style={[styles.cover, styles.fill, fillStyle]} />
      <Animated.View
        style={[
          styles.cover,
          styles.ring,
          { borderWidth: metrics.ring },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          {
            width: metrics.dot,
            height: metrics.dot,
            borderRadius: metrics.dot / 2,
          },
          dotStyle,
        ]}
      />
      <Animated.View style={[styles.cover, styles.center, pulseStyle]}>
        <Animated.Text
          allowFontScaling={false}
          style={[
            styles.numeral,
            { fontSize: metrics.font, lineHeight: metrics.font * 1.2 },
            numeralStyle,
          ]}
        >
          {n}
        </Animated.Text>
      </Animated.View>
    </View>
  )
}

export function NumberStrip({
  target,
  metrics,
  label,
  hintStep,
  guided,
  answered,
}: NumberStripProps) {
  const step = hintStep ?? 0
  const numeralsIn = step >= 1
  const landmark = NUMBER_STRIP_LANDMARK[target]
  return (
    <View
      testID="math-number-strip"
      accessible
      accessibilityLabel={label}
      pointerEvents="none"
      style={[
        styles.strip,
        {
          width: metrics.cell * 10,
          height: metrics.height,
          borderRadius: metrics.radius,
          borderWidth: metrics.border,
        },
      ]}
    >
      {Array.from({ length: 10 }, (_, i) => {
        const n = i + 1
        return (
          <Cell
            key={n}
            n={n}
            metrics={metrics}
            numeralsIn={numeralsIn}
            numeralsDelay={i * STAGGER_MS}
            isTarget={n === target}
            isLandmark={n === landmark}
            hint2={step >= 2}
            guided={guided}
            answered={answered}
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderColor: colors.myPink,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.myPink,
  },
  cover: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  fill: { backgroundColor: colors.myPink },
  ring: { borderColor: colors.myRose },
  center: { alignItems: 'center', justifyContent: 'center' },
  dot: { backgroundColor: colors.myPink },
  numeral: { fontFamily: fonts.bold, color: colors.ink },
})
