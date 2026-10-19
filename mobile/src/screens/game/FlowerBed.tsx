/**
 * Fill the flower bed's bed (mini-game spec `design/native/mini-game-flower-bed.md`
 * § 2.2): the lesson's ten-frame (`TenFrameCell`, `../math/glyphs.tsx`) with
 * flowers in its slots. The given part fills slots 0 to g − 1, top row first;
 * an empty slot is a ring in the frame's own pink. The same drawing, full
 * and still, is the play door's picture on the Map (§ 1.2).
 *
 * - The right move (`filled` rises): bud j lands at `landMs(j)` and blooms
 *   at once with the lesson's bloom (`../math/MissingNumber.tsx`): a 150 ms
 *   crossfade to the flower while scaling 1 → 1.15 → 1. The hop itself is
 *   the play screen's (it flies from a chip). Reduce Motion (§ 2.7): bud j
 *   fades in at 80 × j ms (200 ms), then crossfades to its flower (200 ms).
 * - The hint (`hint` grows): the empty rings pulse once in fill order, each
 *   1 → 1.1 → 1 over 300 ms, 150 ms apart (the counting row's ripple).
 *   Reduce Motion: each dips in opacity 1 → 0.4 → 1, no scale.
 *
 * The staggers are Reanimated delays (no JS timer). Nothing here is a
 * target; the play screen wraps the bed for the repeat tap.
 */
import { useState } from 'react'
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
import Svg, { Circle, Rect } from 'react-native-svg'
import {
  BLOOM_SPRING,
  EASE_IN_OUT,
  EASE_OUT,
  PULSE_HALF_MS,
  STAGGER_MS,
  useOnRise,
} from '../math/extendedMotion'
import { BudGlyph, FlowerGlyph } from '../math/glyphs'
import { BLOOM_FADE_MS, BLOOM_STAGGER_MS } from '../math/MissingNumber'
import {
  BED_VIEW_H,
  BED_VIEW_W,
  REDUCED_BLOOM_FADE_MS,
  SLOT_GLYPH_UNITS,
  slotCentre,
} from './flowerBedGeometry'

/** The frame's border, and the empty slot's ring (no new colour). */
const BED_PINK = '#F48FB1'
/** An empty slot's ring: radius 7 units, a 1.5-unit stroke, no fill. */
const RING_R = 7
const RING_STROKE = 1.5
/** The hint ring's peak, and Reduce Motion's dip. */
const RING_PULSE_PEAK = 1.1
const RING_DIP = 0.4

export const BED_SLOTS = 10

export interface FlowerBedProps {
  /** The bed's width (pt); its height is width × 60 / 130. */
  width: number
  /** Slots 0 … given − 1 hold flowers from the start. */
  given: number
  /** The right move: the empty slots fill. */
  filled?: boolean
  /** Bud j lands this long after `filled` rose (the hop's flight). */
  landMs?: (j: number) => number
  /** Each rise pulses the empty rings once (the hint, § 2.6). */
  hint?: number
  /** Test-ID prefix: `<prefix>-flower`, `-ring-<i>`, `-bloom-<i>`. */
  testIDPrefix?: string
}

export function FlowerBed({
  width,
  given,
  filled = false,
  landMs = () => 0,
  hint = 0,
  testIDPrefix = 'game-bed',
}: FlowerBedProps) {
  const unit = width / BED_VIEW_W
  const height = (width * BED_VIEW_H) / BED_VIEW_W
  const glyph = SLOT_GLYPH_UNITS * unit
  return (
    <View style={{ width, height }}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${BED_VIEW_W} ${BED_VIEW_H}`}
      >
        <Rect
          x={1.5}
          y={1.5}
          width={127}
          height={57}
          rx={16}
          ry={16}
          fill="#FFFFFF"
          stroke={BED_PINK}
          strokeWidth={3}
        />
      </Svg>
      {Array.from({ length: BED_SLOTS }, (_, i) => {
        const c = slotCentre(i, width)
        const box = {
          left: c.x - glyph / 2,
          top: c.y - glyph / 2,
          width: glyph,
          height: glyph,
        }
        return i < given ? (
          <View
            key={`f${i}`}
            testID={`${testIDPrefix}-flower`}
            style={[styles.slot, box]}
          >
            <FlowerGlyph size={glyph} />
          </View>
        ) : (
          <EmptySlot
            key={`e${i}`}
            index={i}
            order={i - given}
            unit={unit}
            box={box}
            filled={filled}
            landMs={landMs(i - given)}
            hint={hint}
            prefix={testIDPrefix}
          />
        )
      })}
    </View>
  )
}

function EmptySlot({
  index,
  order,
  unit,
  box,
  filled,
  landMs,
  hint,
  prefix,
}: {
  index: number
  /** j: this slot's place in the fill order. */
  order: number
  unit: number
  box: { left: number; top: number; width: number; height: number }
  filled: boolean
  landMs: number
  hint: number
  prefix: string
}) {
  const reducedMotion = useReducedMotion()
  const ring = useSharedValue(1)
  const ringScale = useSharedValue(1)
  const bud = useSharedValue(0)
  const flower = useSharedValue(0)
  const scale = useSharedValue(1)
  const [hinted, setHinted] = useState<'pulsed' | 'dipped' | null>(null)

  useOnRise(hint, () => {
    const delay = STAGGER_MS * order
    const half = { duration: PULSE_HALF_MS, easing: EASE_IN_OUT }
    if (reducedMotion) {
      ring.set(
        withDelay(
          delay,
          withSequence(withTiming(RING_DIP, half), withTiming(1, half)),
        ),
      )
      setHinted('dipped')
      return
    }
    ringScale.set(
      withDelay(
        delay,
        withSequence(withTiming(RING_PULSE_PEAK, half), withTiming(1, half)),
      ),
    )
    setHinted('pulsed')
  })

  useOnRise(filled, () => {
    if (reducedMotion) {
      const delay = BLOOM_STAGGER_MS * order
      const fade = { duration: REDUCED_BLOOM_FADE_MS, easing: EASE_OUT }
      ring.set(withDelay(delay, withTiming(0, fade)))
      bud.set(withDelay(delay, withTiming(1, fade)))
      flower.set(withDelay(delay + REDUCED_BLOOM_FADE_MS, withTiming(1, fade)))
      return
    }
    // The bud lands: the ring goes, the bud shows, and it blooms at once.
    ring.set(withDelay(landMs, withTiming(0, { duration: 0 })))
    bud.set(withDelay(landMs, withTiming(1, { duration: 0 })))
    flower.set(withDelay(landMs, withTiming(1, { duration: BLOOM_FADE_MS })))
    scale.set(
      withDelay(
        landMs,
        withSequence(
          withSpring(1.15, BLOOM_SPRING),
          withSpring(1, BLOOM_SPRING),
        ),
      ),
    )
  })

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.get(),
    transform: [{ scale: ringScale.get() }],
  }))
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bud.get(),
    transform: [{ scale: scale.get() }],
  }))
  const budStyle = useAnimatedStyle(() => ({ opacity: 1 - flower.get() }))
  const flowerStyle = useAnimatedStyle(() => ({ opacity: flower.get() }))
  const ringBox = 2 * (RING_R + RING_STROKE) * unit
  return (
    <View style={[styles.slot, box]}>
      <Animated.View
        testID={`${prefix}-ring-${index}${hinted === null ? '' : `-${hinted}`}`}
        style={[
          styles.centred,
          {
            left: (box.width - ringBox) / 2,
            top: (box.height - ringBox) / 2,
            width: ringBox,
            height: ringBox,
          },
          ringStyle,
        ]}
      >
        <Svg
          width={ringBox}
          height={ringBox}
          viewBox={`0 0 ${2 * (RING_R + RING_STROKE)} ${2 * (RING_R + RING_STROKE)}`}
        >
          <Circle
            cx={RING_R + RING_STROKE}
            cy={RING_R + RING_STROKE}
            r={RING_R}
            fill="none"
            stroke={BED_PINK}
            strokeWidth={RING_STROKE}
          />
        </Svg>
      </Animated.View>
      {filled && (
        <Animated.View
          testID={`${prefix}-bloom-${index}`}
          style={[StyleSheet.absoluteFill, bloomStyle]}
        >
          <Animated.View style={[StyleSheet.absoluteFill, budStyle]}>
            <BudGlyph size={box.width} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, flowerStyle]}>
            <FlowerGlyph size={box.width} />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  slot: { position: 'absolute' },
  centred: { position: 'absolute' },
})
