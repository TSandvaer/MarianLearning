/**
 * The flower bed, the picture on adding to ten's missing numbers
 * (`design/native/flower-bed-into-add-to-10.md` §§ 3-5; its look from
 * `design/native/mini-game-flower-bed.md` § 2.2, "Soil beds"): brown soil
 * in a wood rim on the lesson's ten-frame grid (`TenFrameCell`,
 * `./glyphs.tsx`), one furrow between the rows. The given part's flowers
 * fill slots 0 to g − 1, top row first, each planted in its hole. An empty
 * slot starts as bare soil with no hole (Dave's D1): its hole opens only
 * when the lesson shows the missing part. Drawn flat, in the app's existing
 * browns: none of the progress trays' clay art.
 *
 * - Hint 1 (`pulseGiven` rises): the planted flowers ripple once by row,
 *   1 → 1.1 → 1 over 300 ms: the top row's together at once, the bottom
 *   row's together 300 ms later. Reduce Motion: no scale.
 * - Hint 3, or the guided answer when hint 3 was cut (`hint` rises): every
 *   shut hole opens in fill order, hole j fading in over 150 ms while it
 *   pulses 1 → 1.1 → 1 over 300 ms, from 150 × j ms. Reduce Motion: hole j
 *   fades in over 200 ms, then dips in opacity 1 → 0.4 → 1. A rise finds
 *   open holes already open: they do not pulse again.
 * - The right move (`filled` rises): bud j lands in its slot at `landMs(j)`
 *   and blooms at once with the lesson's bloom (`./MissingNumber.tsx`): a
 *   150 ms crossfade to the flower while scaling 1 → 1.15 → 1. A hole still
 *   shut appears under the bud as it lands, with no pulse. The hop itself is
 *   Math's (`./BudHop.tsx`). Reduce Motion: bud j fades in over its slot at
 *   80 × j ms (200 ms), a shut hole fading in with it, then crossfades to
 *   its flower (200 ms). The hole stays under the flower either way.
 *
 * When a hole opens and the bottom row's ripple are JS timers (cleared on
 * unmount), so a test sees them; the motion itself is Reanimated's. Nothing
 * here is a target, holes included: no hole is planted one by one (D8).
 */
import { useEffect, useRef, useState } from 'react'
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
  FADE_MS,
  PULSE_HALF_MS,
  STAGGER_MS,
  useOnRise,
} from './extendedMotion'
import {
  BED_VIEW_H,
  BED_VIEW_W,
  REDUCED_BLOOM_FADE_MS,
  SLOT_GLYPH_UNITS,
  slotCentre,
} from './flowerBedGeometry'
import { BudGlyph, FlowerGlyph } from './glyphs'
import { BLOOM_FADE_MS, BLOOM_STAGGER_MS } from './MissingNumber'

/** § 2.2's browns, each already in the app (the wood clay's). */
const SOIL = '#7d4a26'
const RIM = '#c98a55'
/** The holes and the furrow: the darkest brown, flat. */
const HOLE = '#3d2112'
const HOLE_LIP = '#a86c3c'
/** A planting hole: radius 7 units with a 1.5-unit lip. */
const HOLE_R = 7
const HOLE_LIP_W = 1.5
/** The hint's peak, the given flowers' ripple, and Reduce Motion's dip. */
const PULSE_PEAK = 1.1
const HOLE_DIP = 0.4
/** A hole opened by the hint fades in over this, as it pulses. */
const HOLE_OPEN_MS = 150
/** Hint 1: the bottom row ripples this long after the top row. */
export const ROW_RIPPLE_GAP_MS = 2 * PULSE_HALF_MS

export const BED_SLOTS = 10
const ROW = 5

export interface FlowerBedProps {
  /** The bed's width (pt); its height is width × 60 / 130. */
  width: number
  /** Slots 0 … given − 1 hold flowers from the start. */
  given: number
  /** The right move: the empty slots fill. */
  filled?: boolean
  /** Bud j lands this long after `filled` rose (the hop's flight). */
  landMs?: (j: number) => number
  /** Each rise opens the shut holes and pulses them (hint 3, the guided
   *  answer). */
  hint?: number
  /** Each rise ripples the planted flowers once, by row (hint 1). */
  pulseGiven?: number
  /**
   * Test-ID prefix: `<prefix>-slot-<i>`, `-hole-<i>`, `-flower`,
   * `-given-<i>`, `-bloom-<i>`.
   */
  testIDPrefix?: string
}

export function FlowerBed({
  width,
  given,
  filled = false,
  landMs = () => 0,
  hint = 0,
  pulseGiven = 0,
  testIDPrefix = 'math-bed',
}: FlowerBedProps) {
  const reducedMotion = useReducedMotion()
  const unit = width / BED_VIEW_W
  const height = (width * BED_VIEW_H) / BED_VIEW_W
  const glyph = SLOT_GLYPH_UNITS * unit
  const hole = holeBox(glyph, unit)
  // Hint 1's ripple, row by row: how many rows have rippled this rise.
  const [rippledRows, setRippledRows] = useState(0)
  const [rippleRise, setRippleRise] = useState(0)
  const rowTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (rowTimer.current !== null) clearTimeout(rowTimer.current)
    },
    [],
  )
  useOnRise(pulseGiven, () => {
    if (reducedMotion || given === 0) return
    setRippleRise((n) => n + 1)
    setRippledRows(1)
    if (given > ROW) {
      if (rowTimer.current !== null) clearTimeout(rowTimer.current)
      rowTimer.current = setTimeout(() => {
        rowTimer.current = null
        setRippledRows(2)
      }, ROW_RIPPLE_GAP_MS)
    }
  })
  return (
    <View testID={testIDPrefix} style={{ width, height }}>
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
          <GivenSlot
            key={`f${i}`}
            index={i}
            hole={hole}
            box={box}
            glyph={glyph}
            ripple={rippledRows > Math.floor(i / ROW) ? rippleRise : 0}
            prefix={testIDPrefix}
          />
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

/** A planted flower in its hole; `ripple` rising pulses it once. */
function GivenSlot({
  index,
  hole,
  box,
  glyph,
  ripple,
  prefix,
}: {
  index: number
  hole: Box
  box: Box
  glyph: number
  ripple: number
  prefix: string
}) {
  const scale = useSharedValue(1)
  const [pulsed, setPulsed] = useState(false)
  useOnRise(ripple, () => {
    const half = { duration: PULSE_HALF_MS, easing: EASE_IN_OUT }
    scale.set(withSequence(withTiming(PULSE_PEAK, half), withTiming(1, half)))
    setPulsed(true)
  })
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }))
  return (
    <View testID={`${prefix}-slot-${index}`} style={[styles.slot, box]}>
      <Animated.View
        testID={`${prefix}-given-${index}${pulsed ? '-pulsed' : ''}`}
        style={[StyleSheet.absoluteFill, style]}
      >
        <View testID={`${prefix}-hole-${index}`} style={[styles.centred, hole]}>
          <HoleGlyph size={hole.width} />
        </View>
        <View testID={`${prefix}-flower`} style={StyleSheet.absoluteFill}>
          <FlowerGlyph size={glyph} />
        </View>
      </Animated.View>
    </View>
  )
}

/** How an empty slot's hole is: shut (bare soil), opened by the hint (and
 *  pulsed or, Reduce Motion, dipped), or opened under its landing bud. */
type HoleState = 'shut' | 'pulsed' | 'dipped' | 'landed'

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
  const holeIn = useSharedValue(0)
  const dip = useSharedValue(1)
  const pulse = useSharedValue(1)
  const bud = useSharedValue(0)
  const flower = useSharedValue(0)
  const scale = useSharedValue(1)
  const [state, setState] = useState<HoleState>('shut')
  const stateRef = useRef<HoleState>('shut')
  const landTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (landTimer.current !== null) clearTimeout(landTimer.current)
    },
    [],
  )
  const open = (next: HoleState) => {
    stateRef.current = next
    setState(next)
  }

  useOnRise(hint, () => {
    // Open already (an earlier rise, or a landed bud): no second pulse.
    if (stateRef.current !== 'shut') return
    const delay = STAGGER_MS * order
    const half = { duration: PULSE_HALF_MS, easing: EASE_IN_OUT }
    if (reducedMotion) {
      const fade = { duration: FADE_MS, easing: EASE_OUT }
      holeIn.set(withDelay(delay, withTiming(1, fade)))
      dip.set(
        withDelay(
          delay + FADE_MS,
          withSequence(withTiming(HOLE_DIP, half), withTiming(1, half)),
        ),
      )
      open('dipped')
      return
    }
    holeIn.set(
      withDelay(
        delay,
        withTiming(1, { duration: HOLE_OPEN_MS, easing: EASE_OUT }),
      ),
    )
    pulse.set(
      withDelay(
        delay,
        withSequence(withTiming(PULSE_PEAK, half), withTiming(1, half)),
      ),
    )
    open('pulsed')
  })

  // The hole stays: the bud lands in it, and it shows under the flower.
  useOnRise(filled, () => {
    const shut = stateRef.current === 'shut'
    if (reducedMotion) {
      const delay = BLOOM_STAGGER_MS * order
      const fade = { duration: REDUCED_BLOOM_FADE_MS, easing: EASE_OUT }
      bud.set(withDelay(delay, withTiming(1, fade)))
      flower.set(withDelay(delay + REDUCED_BLOOM_FADE_MS, withTiming(1, fade)))
      if (shut) {
        // A shut hole fades in with its bud.
        holeIn.set(withDelay(delay, withTiming(1, fade)))
        landTimer.current = setTimeout(() => {
          landTimer.current = null
          open('landed')
        }, delay)
      }
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
    if (shut) {
      // A shut hole appears under the bud as it lands, with no pulse (D1).
      landTimer.current = setTimeout(() => {
        landTimer.current = null
        holeIn.set(1)
        open('landed')
      }, landMs)
    }
  })

  const holeStyle = useAnimatedStyle(() => ({
    opacity: holeIn.get() * dip.get(),
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
      {state !== 'shut' && (
        <Animated.View
          testID={`${prefix}-hole-${index}${state === 'landed' ? '' : `-${state}`}`}
          style={[styles.centred, hole, holeStyle]}
        >
          <HoleGlyph size={hole.width} />
        </Animated.View>
      )}
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
