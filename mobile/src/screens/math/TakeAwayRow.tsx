/**
 * The take-away picture (`design/native/take-away-picture.md`, Dave's
 * research #618): a sub-to-10 problem's minuend as flowers in one
 * ten-frame; a sub-to-20 problem's as a double ten-frame, the left a full
 * ten that never moves and the right its ones digit. The frame is the
 * flash's ten-frame card (white, rose border, no cell lines), the flowers
 * addition's, undecorated. It takes the counting row's place, hidden from
 * accessibility (the equation carries the read), and takes no touches.
 *
 * What drives it (Math's state, so it follows every line):
 *
 * - `lift`: the taken flowers (the last placed) lift, last placed first,
 *   90 ms apart. A copy of each rises 24 pt (tablet 32, phone landscape 16)
 *   and fades over 250 ms while the flower in its cell fades in to 0.35, so
 *   the taken ones stay countable; the rest never move. `fast` (a right
 *   tap): 150 ms. `instant` (the given answer): the end state at once.
 *   A lift due while the minuend flash covers the row waits for the frame
 *   to fade in; a fast or instant one lands as the frame fades in.
 * - `ripple` (each rise) and `rippleScope`: each flower in scope scales
 *   1 → 1.1 → 1 over 300 ms, 150 ms after the one before, in reading order;
 *   sub-to-20's ten pulses as one beat first (K8). `left`: only the flowers
 *   not taken. Pale flowers ripple at their pale opacity.
 * - `visible`: opacity 0 under the flash, then 250 ms ease-out to 1.
 *
 * Reduce Motion: the copy fades over 200 ms with no rise, so the flower
 * turns pale in place; nothing scales. A rotation or the app going to the
 * background lands every flower in its end state; nothing replays.
 */
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { TAKE_AWAY_BORDER, type TakeAwayMetrics } from '../../layout/mathLayout'
import {
  EASE_IN_OUT,
  EASE_OUT,
  liftMs,
  PULSE_HALF_MS,
  STAGGER_MS,
  useOnRise,
} from './extendedMotion'
import { FlowerGlyph } from './glyphs'
import { BUILD_STAGGER_MS } from './placeValueTiming'
import type {
  TakeAwayLift,
  TakeAwayPicture,
  TakeAwayRippleScope,
} from './takeAwayPicture'

/** A taken flower rests in its cell at this opacity (K5; T1: pale or gone). */
export const TAKEN_OPACITY = 0.35
/** The frame fades in over this long once the flash is gone (§ 5). */
export const TAKE_AWAY_FADE_MS = 250
const TAKE_AWAY_FADE_REDUCED_MS = 200
const RIPPLE_PEAK = 1.1

export interface TakeAwayRowProps {
  picture: TakeAwayPicture
  metrics: TakeAwayMetrics
  /** `false` while the minuend flash covers the row. */
  visible: boolean
  lift: TakeAwayLift | null
  /** Rises once per ripple (a hint line's start). */
  ripple: number
  /** Which flowers the current hint line ripples; `null` = none. */
  rippleScope: TakeAwayRippleScope | null
  appHidden: boolean
}

type FrameName = 'ten' | 'ones'

export function TakeAwayRow({
  picture,
  metrics,
  visible,
  lift,
  ripple,
  rippleScope,
  appHidden,
}: TakeAwayRowProps) {
  const reducedMotion = useReducedMotion()
  const fadeMs = reducedMotion ? TAKE_AWAY_FADE_REDUCED_MS : TAKE_AWAY_FADE_MS
  const opacity = useSharedValue(visible ? 1 : 0)
  useEffect(() => {
    opacity.set(
      withTiming(visible ? 1 : 0, { duration: fadeMs, easing: EASE_OUT }),
    )
  }, [visible, fadeMs, opacity])
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }))

  // The frame has faded in: a lift waits for it (§ 4). Follows `visible`
  // (the flash's scope can settle after the mount).
  const [faded, setFaded] = useState(visible)
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (!visible) setFaded(false)
  }
  useEffect(() => {
    if (!visible || faded) return
    const id = setTimeout(() => setFaded(true), fadeMs)
    return () => clearTimeout(id)
  }, [visible, faded, fadeMs])
  // The background lands the frame's fade with everything else (§ 6).
  useOnRise(appHidden, () => {
    if (!visible) return
    opacity.set(1)
    setFaded(true)
  })

  const started = lift !== null && (faded || (visible && lift !== 'normal'))
  // A lift that starts under the fade-in or in the background lands at once.
  const mode: TakeAwayLift =
    !faded || appHidden ? 'instant' : (lift ?? 'normal')

  const { frames, filled, taken } = picture.slots
  const liftOrder = new Map(taken.map((slot, k) => [slot, k]))
  const inScope = (frame: FrameName, slot: number) =>
    rippleScope === 'all' ||
    (rippleScope === 'left' && !(frame === 'ones' && liftOrder.has(slot)))
  // Reading order, left frame first; sub-to-20's ten as one beat (K8).
  const rippleDelays = new Map<string, number>()
  if (frames === 2) {
    for (let slot = 1; slot <= 10; slot++)
      if (inScope('ten', slot)) rippleDelays.set(`ten-${slot}`, 0)
  }
  let loose = frames === 2 ? 1 : 0
  for (let slot = 1; slot <= filled; slot++) {
    if (!inScope('ones', slot)) continue
    rippleDelays.set(`ones-${slot}`, loose * STAGGER_MS)
    loose += 1
  }

  const layoutKey = `${metrics.flower},${metrics.frameWidth}`
  const frame = (name: FrameName, testID: string, count: number) => (
    <View
      testID={testID}
      style={{ width: metrics.frameWidth, height: metrics.frameHeight }}
    >
      <View
        style={[
          styles.card,
          { borderWidth: metrics.border, borderRadius: metrics.radius },
        ]}
      />
      {Array.from({ length: count }, (_, i) => {
        const slot = i + 1
        const order = name === 'ones' ? liftOrder.get(slot) : undefined
        const isTaken = order !== undefined
        const delay = rippleDelays.get(`${name}-${slot}`)
        const marks = `${isTaken && started ? '-taken' : ''}${
          rippleScope !== null && delay !== undefined ? '-pulsing' : ''
        }`
        return (
          <Flower
            key={slot}
            testID={`math-take-away-flower-${name}-${slot}${marks}`}
            centre={metrics.slotCentre(slot)}
            size={metrics.flower}
            taken={isTaken}
            started={started}
            mode={mode}
            instant={lift === 'instant'}
            liftDelay={(order ?? 0) * BUILD_STAGGER_MS}
            rise={metrics.liftRise}
            ripple={ripple}
            rippleDelay={delay ?? null}
            reducedMotion={reducedMotion}
            appHidden={appHidden}
            layoutKey={layoutKey}
          />
        )
      })}
    </View>
  )

  return (
    <Animated.View
      testID="math-take-away"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.row, { gap: metrics.between }, fade]}
    >
      {frames === 2 && frame('ten', 'math-take-away-frame-ten', 10)}
      {frame(
        'ones',
        frames === 2 ? 'math-take-away-frame-ones' : 'math-take-away-frame',
        filled,
      )}
    </Animated.View>
  )
}

function Flower({
  testID,
  centre,
  size,
  taken,
  started,
  mode,
  instant,
  liftDelay,
  rise,
  ripple,
  rippleDelay,
  reducedMotion,
  appHidden,
  layoutKey,
}: {
  testID: string
  centre: { x: number; y: number }
  size: number
  /** One of the flowers the problem takes away. */
  taken: boolean
  /** The lift has started (the frame is in). */
  started: boolean
  /** How the lift plays, read when it starts. */
  mode: TakeAwayLift
  /** The given answer: a lift still in flight lands. */
  instant: boolean
  liftDelay: number
  rise: number
  ripple: number
  /** This flower's delay in the current ripple; `null` = not in it. */
  rippleDelay: number | null
  reducedMotion: boolean
  appHidden: boolean
  layoutKey: string
}) {
  const lifted = taken && started
  // The full flower (a taken one's copy, which rises), and a taken one's
  // pale flower in its cell.
  const copy = useSharedValue(lifted ? 0 : 1)
  const pale = useSharedValue(lifted ? TAKEN_OPACITY : 0)
  const y = useSharedValue(0)
  const scale = useSharedValue(1)
  const land = () => {
    scale.set(1)
    if (!lifted) return
    copy.set(0)
    pale.set(TAKEN_OPACITY)
    y.set(0)
  }
  useOnRise(lifted, () => {
    if (mode === 'instant') {
      land()
      return
    }
    const timing = { duration: liftMs(mode, reducedMotion), easing: EASE_OUT }
    copy.set(withDelay(liftDelay, withTiming(0, timing)))
    pale.set(withDelay(liftDelay, withTiming(TAKEN_OPACITY, timing)))
    if (!reducedMotion) y.set(withDelay(liftDelay, withTiming(-rise, timing)))
  })
  useOnRise(lifted && instant, land)
  useOnRise(appHidden, land)
  useOnRise(ripple, () => {
    if (rippleDelay === null || reducedMotion) return
    const half = { duration: PULSE_HALF_MS, easing: EASE_IN_OUT }
    // From its current scale: a ripple may start while the last one runs.
    scale.set(
      withDelay(
        rippleDelay,
        withSequence(withTiming(RIPPLE_PEAK, half), withTiming(1, half)),
      ),
    )
  })
  // Rotation: what is in flight lands in the new layout; nothing replays.
  const lastKey = useRef(layoutKey)
  useEffect(() => {
    if (lastKey.current === layoutKey) return
    lastKey.current = layoutKey
    scale.set(1)
    if (!lifted) return
    copy.set(0)
    pale.set(TAKEN_OPACITY)
    y.set(0)
  }, [layoutKey, lifted, scale, copy, pale, y])

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }))
  const copyStyle = useAnimatedStyle(() => ({
    opacity: copy.get(),
    transform: [{ translateY: y.get() }],
  }))
  const paleStyle = useAnimatedStyle(() => ({ opacity: pale.get() }))
  return (
    <View
      testID={testID}
      style={[
        styles.flower,
        {
          left: centre.x - size / 2,
          top: centre.y - size / 2,
          width: size,
          height: size,
        },
      ]}
    >
      <Animated.View style={rippleStyle}>
        {taken && (
          <Animated.View style={[StyleSheet.absoluteFill, paleStyle]}>
            <FlowerGlyph size={size} />
          </Animated.View>
        )}
        <Animated.View style={copyStyle}>
          <FlowerGlyph size={size} />
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderColor: TAKE_AWAY_BORDER,
  },
  flower: { position: 'absolute' },
})
