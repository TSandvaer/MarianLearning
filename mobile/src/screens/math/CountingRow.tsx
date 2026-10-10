/**
 * The counting row under an addition: one flower per unit, `a` flowers,
 * a `+`, `b` flowers (web `math-visual-groups`, `FlowerGroup`). Sizes and
 * wrapping come from `countingMetrics` (tablet: the web's flower row;
 * phone: spec § 4).
 *
 * - The whole row cross-fades with the dot card: opacity 0 while the card
 *   shows, then 250 ms ease-out to 1 (Reduce Motion: 200 ms).
 * - Hint choreography (web W12-02): `pulsing` makes each flower of that
 *   group scale 1 → 1.1 → 1 over 300 ms, 150 ms after the previous one,
 *   so the group ripples in order. Reduce Motion: no scaling.
 */
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import type { CountingMetrics } from '../../layout/mathLayout'
import { colors, fonts } from '../../theme'
import { FlowerGlyph } from './glyphs'

/** Web `HINT_FLOWER_PULSE_MS`. */
export const HINT_FLOWER_PULSE_MS = 150
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)

function Flower({
  index,
  size,
  pulsing,
}: {
  index: number
  size: number
  pulsing: boolean
}) {
  const reducedMotion = useReducedMotion()
  const scale = useSharedValue(1)
  useEffect(() => {
    if (!pulsing || reducedMotion) {
      scale.set(1)
      return
    }
    const half = { duration: HINT_FLOWER_PULSE_MS, easing: EASE_IN_OUT }
    scale.set(
      withDelay(
        HINT_FLOWER_PULSE_MS * index,
        withSequence(withTiming(1.1, half), withTiming(1, half)),
      ),
    )
  }, [pulsing, reducedMotion, index, scale])
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }))
  return (
    <Animated.View style={style}>
      <FlowerGlyph size={size} />
    </Animated.View>
  )
}

function Group({
  side,
  count,
  metrics,
  pulsing,
}: {
  side: 'a' | 'b'
  count: number
  metrics: CountingMetrics
  pulsing: boolean
}) {
  const { size, gap, perRow } = metrics
  const wraps = perRow !== Infinity && count > perRow
  return (
    <View
      // Web `data-hint-beat` / `data-pulsing`, for the tests.
      testID={`math-flower-group-${side}${pulsing ? '-pulsing' : ''}`}
      accessibilityLabel={`${count}`}
      style={[
        styles.group,
        { gap },
        wraps && { width: perRow * size + (perRow - 1) * gap },
      ]}
    >
      {Array.from({ length: count }, (_, i) => (
        <Flower key={i} index={i} size={size} pulsing={pulsing} />
      ))}
    </View>
  )
}

export interface CountingRowProps {
  addendA: number
  addendB: number
  metrics: CountingMetrics
  visible: boolean
  hintBeat: 'group-a' | 'group-b' | null
}

export function CountingRow({
  addendA,
  addendB,
  metrics,
  visible,
  hintBeat,
}: CountingRowProps) {
  const reducedMotion = useReducedMotion()
  const opacity = useSharedValue(visible ? 1 : 0)
  useEffect(() => {
    opacity.set(
      withTiming(visible ? 1 : 0, {
        duration: reducedMotion ? 200 : 250,
        easing: EASE_OUT,
      }),
    )
  }, [visible, reducedMotion, opacity])
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }))

  return (
    <Animated.View
      testID="math-visual-groups"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.row, fade]}
    >
      <Group
        side="a"
        count={addendA}
        metrics={metrics}
        pulsing={hintBeat === 'group-a'}
      />
      <View style={[styles.plusBox, { width: metrics.between }]}>
        <Text
          style={[
            styles.plus,
            { fontSize: metrics.plusFont, lineHeight: metrics.plusFont * 1.2 },
          ]}
        >
          +
        </Text>
      </View>
      <Group
        side="b"
        count={addendB}
        metrics={metrics}
        pulsing={hintBeat === 'group-b'}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  plusBox: { alignItems: 'center', justifyContent: 'center' },
  plus: { fontFamily: fonts.semibold, color: colors.ink },
})
