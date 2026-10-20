/**
 * Fill the flower bed's bed (mini-game spec `design/native/mini-game-flower-bed.md`
 * § 2.2, amended 2026-10-20 to "Soil beds"): brown soil in a wood rim, with a
 * planting hole at every slot of the lesson's ten-frame (`TenFrameCell`,
 * `../math/glyphs.tsx`) and one furrow between the rows. The given part's
 * flowers fill slots 0 to g − 1, top row first, each planted in its hole; an
 * empty slot is its hole alone. Drawn flat, in the app's existing browns:
 * none of the progress trays' clay art (D7).
 *
 * - The right move (`filled` rises): bud j lands in its hole at `landMs(j)`
 *   and blooms at once with the lesson's bloom (`../math/MissingNumber.tsx`):
 *   a 150 ms crossfade to the flower while scaling 1 → 1.15 → 1. The hop
 *   itself is the play screen's (it flies from a chip). Reduce Motion
 *   (§ 2.7): bud j fades in over its hole at 80 × j ms (200 ms), then
 *   crossfades to its flower (200 ms). The hole stays under it either way.
 * - The hint (`hint` grows): the empty holes, each with its lip, pulse once
 *   in fill order, 1 → 1.1 → 1 over 300 ms, 150 ms apart (the counting
 *   row's ripple). Reduce Motion: each dips in opacity 1 → 0.4 → 1, no
 *   scale.
 *
 * The staggers are Reanimated delays (no JS timer). Nothing here is a
 * target, holes included: the play screen wraps the bed for the repeat tap,
 * and no hole is planted one by one (D8).
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
import Svg, { Circle, Line, Rect } from 'react-native-svg'
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

/** § 2.2's browns, each already in the app (the wood clay's). */
const SOIL = '#7d4a26'
const RIM = '#c98a55'
/** The holes and the furrow: the darkest brown, flat. */
const HOLE = '#3d2112'
const HOLE_LIP = '#a86c3c'
/** A planting hole: radius 7 units with a 1.5-unit lip. */
const HOLE_R = 7
const HOLE_LIP_W = 1.5
/** The hint's peak, and Reduce Motion's dip. */
const HOLE_PULSE_PEAK = 1.1
const HOLE_DIP = 0.4

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
  /** Each rise pulses the empty holes once (the hint, § 2.6). */
  hint?: number
  /**
   * Test-ID prefix: `<prefix>-slot-<i>`, `-hole-<i>`, `-flower`,
   * `-bloom-<i>`.
   */
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
  const hole = holeBox(glyph, unit)
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
          rx={8}
          ry={8}
          fill={SOIL}
          stroke={RIM}
          strokeWidth={3}
        />
        {/* The furrow between the fives; no vertical split (D6). */}
        <Line
          x1={8}
          y1={30}
          x2={122}
          y2={30}
          stroke={HOLE}
          strokeWidth={2}
          strokeLinecap="round"
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
            testID={`${testIDPrefix}-slot-${i}`}
            style={[styles.slot, box]}
          >
            <View
              testID={`${testIDPrefix}-hole-${i}`}
              style={[styles.centred, hole]}
            >
              <HoleGlyph size={hole.width} />
            </View>
            <View
              testID={`${testIDPrefix}-flower`}
              style={StyleSheet.absoluteFill}
            >
              <FlowerGlyph size={glyph} />
            </View>
          </View>
        ) : (
          <EmptySlot
            key={`e${i}`}
            index={i}
            order={i - given}
            hole={hole}
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

type Box = { left: number; top: number; width: number; height: number }

/** A planting hole's box, centred in a slot `slot` pt across. */
function holeBox(slot: number, unit: number): Box {
  const size = 2 * (HOLE_R + HOLE_LIP_W) * unit
  const at = (slot - size) / 2
  return { left: at, top: at, width: size, height: size }
}

/** A planting hole: a flat dark disc with its lip, no gradient, no shadow. */
function HoleGlyph({ size }: { size: number }) {
  const c = HOLE_R + HOLE_LIP_W
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${2 * c} ${2 * c}`}>
      <Circle
        cx={c}
        cy={c}
        r={HOLE_R}
        fill={HOLE}
        stroke={HOLE_LIP}
        strokeWidth={HOLE_LIP_W}
      />
    </Svg>
  )
}

function EmptySlot({
  index,
  order,
  hole,
  box,
  filled,
  landMs,
  hint,
  prefix,
}: {
  index: number
  /** j: this slot's place in the fill order. */
  order: number
  /** The hole's box inside the slot. */
  hole: Box
  box: Box
  filled: boolean
  landMs: number
  hint: number
  prefix: string
}) {
  const reducedMotion = useReducedMotion()
  const dip = useSharedValue(1)
  const pulse = useSharedValue(1)
  const bud = useSharedValue(0)
  const flower = useSharedValue(0)
  const scale = useSharedValue(1)
  const [hinted, setHinted] = useState<'pulsed' | 'dipped' | null>(null)

  useOnRise(hint, () => {
    const delay = STAGGER_MS * order
    const half = { duration: PULSE_HALF_MS, easing: EASE_IN_OUT }
    if (reducedMotion) {
      dip.set(
        withDelay(
          delay,
          withSequence(withTiming(HOLE_DIP, half), withTiming(1, half)),
        ),
      )
      setHinted('dipped')
      return
    }
    pulse.set(
      withDelay(
        delay,
        withSequence(withTiming(HOLE_PULSE_PEAK, half), withTiming(1, half)),
      ),
    )
    setHinted('pulsed')
  })

  // The hole stays: the bud lands in it, and it shows under the flower.
  useOnRise(filled, () => {
    if (reducedMotion) {
      const delay = BLOOM_STAGGER_MS * order
      const fade = { duration: REDUCED_BLOOM_FADE_MS, easing: EASE_OUT }
      bud.set(withDelay(delay, withTiming(1, fade)))
      flower.set(withDelay(delay + REDUCED_BLOOM_FADE_MS, withTiming(1, fade)))
      return
    }
    // The bud lands: it shows, and it blooms at once.
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

  const holeStyle = useAnimatedStyle(() => ({
    opacity: dip.get(),
    transform: [{ scale: pulse.get() }],
  }))
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bud.get(),
    transform: [{ scale: scale.get() }],
  }))
  const budStyle = useAnimatedStyle(() => ({ opacity: 1 - flower.get() }))
  const flowerStyle = useAnimatedStyle(() => ({ opacity: flower.get() }))
  return (
    <View testID={`${prefix}-slot-${index}`} style={[styles.slot, box]}>
      <Animated.View
        testID={`${prefix}-hole-${index}${hinted === null ? '' : `-${hinted}`}`}
        style={[styles.centred, hole, holeStyle]}
      >
        <HoleGlyph size={hole.width} />
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
