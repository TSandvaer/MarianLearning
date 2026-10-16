/**
 * A missing number's two visuals (content wave 1 `design/native/content-wave-1.md`
 * §§ 1.4–1.5): the equation's "?" (`EquationGap`) and the counting row's
 * group B (`MissingGroup`). Nothing here is tappable.
 *
 * - Reveal: group B is a "?" stone (skip counting's), centred in the box
 *   the matching addition would give its flowers, so nothing moves later.
 * - Hint 3: the stone fades out (100 ms), then bud k fades in and scales
 *   0.6 → 1 (200 ms, ease-out) at 150 × k ms, then the buds ripple once
 *   (the counting row's pulse). Reduce Motion: fades only.
 * - Guided answer (3rd wrong): the buds show if hint 3 didn't play (a
 *   200 ms fade); the equation's "?" gets a 4 pt rose ring.
 * - Correct: any bud not shown appears at once; bud k crossfades to a
 *   flower (150 ms) while scaling 1 → 1.15 → 1 (spring 300 / 14) at
 *   80 × k ms; the equation's "?" fades out (100 ms) and the answer springs
 *   in (0.6 → 1, 260 / 20). Reduce Motion: 200 ms crossfades, no scale.
 *
 * The staggers are Reanimated delays (no JS timer). Math keys both per
 * problem, so every problem starts fresh.
 */
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { fredokaBoldWidth, type CountingMetrics } from '../../layout/mathLayout'
import { colors, fonts } from '../../theme'
import {
  EASE_IN_OUT,
  EASE_OUT,
  FADE_MS,
  GAP_OUT_MS,
  PULSE_HALF_MS,
  STAGGER_MS,
  useFade,
  useOnRise,
  useSpringIn,
} from './extendedMotion'
import { BudGlyph, FlowerGlyph } from './glyphs'

/** Hint 3: each bud fades and scales in over this long. */
export const BUD_IN_MS = 200
/** Correct: a bud's crossfade to its flower. */
export const BLOOM_FADE_MS = 150
/** Correct: bud k blooms this long after bud k − 1. */
export const BLOOM_STAGGER_MS = 80
const BLOOM_SPRING = { stiffness: 300, damping: 14, mass: 1 }

/** How the hidden part shows: not yet, from hint 3, or the guided answer. */
export type BudReveal = 'hidden' | 'hint' | 'guided'

function Bud({
  index,
  size,
  reveal,
  bloom,
}: {
  index: number
  size: number
  reveal: BudReveal
  bloom: boolean
}) {
  const reducedMotion = useReducedMotion()
  const opacity = useSharedValue(0)
  const scale = useSharedValue(1)
  /** 0 = the bud, 1 = its flower. */
  const flower = useSharedValue(0)
  const fadeIn = { duration: FADE_MS, easing: EASE_OUT }
  useOnRise(reveal !== 'hidden', () => {
    if (reducedMotion || reveal === 'guided') {
      opacity.set(withTiming(1, fadeIn))
      return
    }
    // § 1.5: the stone fades out first (100 ms), then the buds.
    const delay = GAP_OUT_MS + STAGGER_MS * index
    const grow = { duration: BUD_IN_MS, easing: EASE_OUT }
    const half = { duration: PULSE_HALF_MS, easing: EASE_IN_OUT }
    scale.set(0.6)
    opacity.set(withDelay(delay, withTiming(1, grow)))
    scale.set(
      withDelay(
        delay,
        withSequence(
          withTiming(1, grow),
          withTiming(1.1, half),
          withTiming(1, half),
        ),
      ),
    )
  })
  useOnRise(bloom, () => {
    // A bud not shown yet appears at once, then blooms with the rest.
    opacity.set(1)
    if (reducedMotion) {
      scale.set(1)
      flower.set(withTiming(1, { duration: FADE_MS }))
      return
    }
    const delay = BLOOM_STAGGER_MS * index
    flower.set(withDelay(delay, withTiming(1, { duration: BLOOM_FADE_MS })))
    scale.set(
      withDelay(
        delay,
        withSequence(
          withSpring(1.15, BLOOM_SPRING),
          withSpring(1, BLOOM_SPRING),
        ),
      ),
    )
  })
  const outer = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }))
  const budStyle = useAnimatedStyle(() => ({ opacity: 1 - flower.get() }))
  const flowerStyle = useAnimatedStyle(() => ({ opacity: flower.get() }))
  return (
    <Animated.View style={[{ width: size, height: size }, outer]}>
      <Animated.View style={[styles.layer, budStyle]}>
        <BudGlyph size={size} />
      </Animated.View>
      <Animated.View style={[styles.layer, flowerStyle]}>
        <FlowerGlyph size={size} />
      </Animated.View>
    </Animated.View>
  )
}

export interface MissingGroupProps {
  /** The hidden part (the answer): how many buds. */
  count: number
  /** The matching addition's metrics (`countingMetrics(A, B)`). */
  metrics: CountingMetrics
  reveal: BudReveal
  /** The answer was tapped: the buds bloom. */
  answered: boolean
}

/** Group B of a missing number: the "?" stone, then buds, then flowers. */
export function MissingGroup({
  count,
  metrics,
  reveal,
  answered,
}: MissingGroupProps) {
  const { size, gap, perRow } = metrics
  const wraps = perRow !== Infinity && count > perRow
  const cols = wraps ? perRow : count
  const rows = wraps ? Math.ceil(count / perRow) : 1
  const width = cols * size + (cols - 1) * gap
  const height = rows * size + (rows - 1) * gap
  const stoneShown = reveal === 'hidden' && !answered
  const stoneStyle = useFade(stoneShown, GAP_OUT_MS)
  // The skip track's "?" stone: the row's flower + 8 pt.
  const d = size + 8
  const phase = answered ? 'bloom' : reveal === 'hidden' ? 'stone' : 'buds'
  return (
    <View
      testID={`math-missing-group-${phase}`}
      accessibilityLabel={`${count}`}
      style={[styles.group, { gap }, wraps && { width }]}
    >
      {Array.from({ length: count }, (_, k) => (
        <Bud key={k} index={k} size={size} reveal={reveal} bloom={answered} />
      ))}
      <Animated.View
        testID={stoneShown ? 'math-missing-stone' : undefined}
        pointerEvents="none"
        style={[
          styles.stone,
          {
            left: (width - d) / 2,
            top: (height - d) / 2,
            width: d,
            height: d,
            borderRadius: d / 2,
          },
          stoneStyle,
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[
            styles.stoneQuestion,
            {
              fontSize: Math.round(0.6 * d),
              lineHeight: Math.round(0.6 * d) * 1.2,
            },
          ]}
        >
          ?
        </Text>
      </Animated.View>
    </View>
  )
}

export interface EquationGapProps {
  /** The missing part the "?" becomes. */
  answer: number
  answered: boolean
  guided: boolean
  font: number
  lineHeight: number
}

/** The equation's "?" of `A + ? = T`: it fills with the answer on a correct
 *  tap and gets the guided chip's ring on the given answer. */
export function EquationGap({
  answer,
  answered,
  guided,
  font,
  lineHeight,
}: EquationGapProps) {
  const questionStyle = useFade(!answered, GAP_OUT_MS)
  const answerStyle = useSpringIn(answered, { delayMs: GAP_OUT_MS })
  const ringStyle = useFade(guided)
  // As wide as the wider of "?" and the answer: nothing moves when it fills.
  const width = Math.ceil(
    Math.max(
      fredokaBoldWidth('?', font),
      fredokaBoldWidth(String(answer), font),
    ),
  )
  return (
    <View
      testID={answered ? 'math-equation-gap-answered' : 'math-equation-gap'}
      style={{ width, height: lineHeight }}
    >
      <Animated.View
        testID={guided ? 'math-equation-gap-ring' : undefined}
        pointerEvents="none"
        style={[
          styles.ring,
          { borderRadius: Math.round(lineHeight / 2) },
          ringStyle,
        ]}
      />
      <Animated.Text
        allowFontScaling={false}
        style={[
          styles.equationText,
          styles.overlay,
          { fontSize: font, lineHeight },
          questionStyle,
        ]}
      >
        ?
      </Animated.Text>
      <Animated.Text
        allowFontScaling={false}
        style={[
          styles.equationText,
          styles.overlay,
          { fontSize: font, lineHeight },
          answerStyle,
        ]}
      >
        {answer}
      </Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0 },
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  stone: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.myCream,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.myRose,
  },
  stoneQuestion: {
    fontFamily: fonts.bold,
    color: colors.myRose,
    textAlign: 'center',
  },
  ring: {
    position: 'absolute',
    left: -10,
    right: -10,
    top: -2,
    bottom: -2,
    borderWidth: 4,
    borderColor: colors.myRose,
  },
  equationText: { fontFamily: fonts.bold, color: colors.ink },
  overlay: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
})
