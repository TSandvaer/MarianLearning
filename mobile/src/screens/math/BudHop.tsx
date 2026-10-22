/**
 * The flower bed's right move (`design/native/flower-bed-into-add-to-10.md`
 * § 4; the hop of `design/native/mini-game-flower-bed.md` § 2.4): on a right
 * tap, bud j leaves the tapped chip's centre 80 × j ms after the tap and
 * flies 360 ms to its slot in the bed, x linear, y on an arc 32 pt above
 * the straight line at its middle (180 ms up, ease-out; 180 ms down,
 * ease-in), scale 0.5 → 1. It is gone the moment it lands: the slot's own
 * bud blooms there (`FlowerBed`'s `filled` and `landMs`). The layer sits
 * above the stage and the chips, and takes no touch. Reduce Motion: no hop
 * (Math does not mount it).
 */
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { FILL } from '../../theme'
import { EASE_OUT } from './extendedMotion'
import type { Point } from './flowerBedGeometry'
import { BudGlyph } from './glyphs'

/** A bud's hop from the chip to its slot. */
export const HOP_MS = 360
/** Bud j leaves 80 × j ms after the tap (the lesson's bloom stagger). */
export const HOP_STAGGER_MS = 80
/** The hop's arc: this far above the straight line at its middle (pt). */
const HOP_ARC = 32
const EASE_IN = Easing.bezier(0.42, 0, 1, 1)

export function BudHop({
  from,
  to,
  size,
}: {
  /** The tapped chip's centre (screen pt). */
  from: Point
  /** Each bud's slot centre, in fill order (screen pt). */
  to: readonly Point[]
  /** A bud's size in the bed (pt). */
  size: number
}) {
  return (
    <View testID="math-hop" pointerEvents="none" style={styles.layer}>
      {to.map((point, j) => (
        <HopBud
          key={j}
          testID={`math-hop-${j}`}
          from={from}
          to={point}
          size={size}
          delayMs={HOP_STAGGER_MS * j}
        />
      ))}
    </View>
  )
}

function HopBud({
  from,
  to,
  size,
  delayMs,
  testID,
}: {
  from: Point
  to: Point
  size: number
  delayMs: number
  testID: string
}) {
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const scale = useSharedValue(0.5)
  const opacity = useSharedValue(0)
  useEffect(() => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const half = HOP_MS / 2
    opacity.set(
      withDelay(
        delayMs,
        withSequence(
          withTiming(1, { duration: 0 }),
          withDelay(HOP_MS, withTiming(0, { duration: 0 })),
        ),
      ),
    )
    x.set(
      withDelay(
        delayMs,
        withTiming(dx, { duration: HOP_MS, easing: Easing.linear }),
      ),
    )
    y.set(
      withDelay(
        delayMs,
        withSequence(
          withTiming(dy / 2 - HOP_ARC, { duration: half, easing: EASE_OUT }),
          withTiming(dy, { duration: half, easing: EASE_IN }),
        ),
      ),
    )
    scale.set(withDelay(delayMs, withTiming(1, { duration: HOP_MS })))
    // Mount-once: a hop flies once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
      testID={testID}
      style={[
        styles.abs,
        {
          left: from.x - size / 2,
          top: from.y - size / 2,
          width: size,
          height: size,
        },
        style,
      ]}
    >
      <BudGlyph size={size} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  layer: { ...FILL, zIndex: 3 },
  abs: { position: 'absolute' },
})
