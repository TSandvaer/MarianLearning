/**
 * One answer chip: the web's `math-chip` (`src/screens/Math/Math.tsx`),
 * a cream `.clay-tile` on the Number Garden's caramel slab.
 *
 * - In: scale 0.9 → 1 on the chip spring (300 / 18), opacity to its
 *   target over 200 ms ease-out.
 * - Gate closed (before Emma starts reading) or dimmed for the guided
 *   answer: opacity 0.6 and not pressable ("in a moment", never "wrong").
 *   Opening lifts it to 1.0 over 200 ms, no spring, no sound.
 * - Press: the face sinks 4 pt onto its slab (the slab shadow 6 → 2).
 * - Wrong tap: a 400 ms side-shake, x 0 → -6 → 6 → -4 → 4 → 0, ease-out
 *   (Reduce Motion: an opacity dip 1 → 0.7 → 1). Never red, never an X.
 * - Guided answer: a warm glow ring around the correct chip.
 * - Correct tap: six sparkles spring out 60 pt (skipped on Reduce Motion).
 */
import {
  CHIP_TAP_SPRING,
  WRONG_SHAKE_MS,
} from '@marian/core/shared/gameplayConstants'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, {
  Easing,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  Extrapolation,
} from 'react-native-reanimated'
import { fonts } from '../../theme'
import { SparkleGlyph } from './glyphs'

const SPRING = {
  stiffness: CHIP_TAP_SPRING.stiffness,
  damping: CHIP_TAP_SPRING.damping,
  mass: 1,
}
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)
const OPACITY_MS = 200
const PRESS_DEPTH = 4

/** Number Garden clay (web `.clay-world-math`). */
const CLAY = {
  slab: '#dba675',
  ink: '#5a3524',
  tileFace: 'linear-gradient(#ffffff 0%, #fff7ee 60%, #ffeedd 100%)',
}
const TILE_SHADOW = `inset 0 4px 0 #ffffff, inset 0 -6px 0 rgba(120, 70, 40, 0.08), 0 6px 0 ${CLAY.slab}, 0 10px 14px rgba(90, 45, 20, 0.12)`
const TILE_SHADOW_PRESSED = `inset 0 4px 0 #ffffff, 0 2px 0 ${CLAY.slab}, 0 4px 8px rgba(90, 45, 20, 0.12)`
const TILE_SHADOW_GLOW = `inset 0 4px 0 #ffffff, inset 0 -6px 0 rgba(120, 70, 40, 0.08), 0 6px 0 ${CLAY.slab}, 0 0 0 6px rgba(255, 214, 92, 0.75), 0 0 30px 10px rgba(255, 196, 64, 0.55)`

/** Web `SparkleBurst` particle: 60 pt out on a 120 / 18 spring, fading. */
function Particle({ angle, glyph }: { angle: number; glyph: number }) {
  const p = useSharedValue(0)
  useEffect(() => {
    p.set(withSpring(1, { stiffness: 120, damping: 18, mass: 1 }))
  }, [p])
  const style = useAnimatedStyle(() => {
    const t = p.get()
    return {
      opacity: interpolate(t, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: Math.cos(angle) * 60 * t },
        { translateY: Math.sin(angle) * 60 * t },
        { scale: 0.5 + 0.5 * t },
      ],
    }
  })
  return (
    <Animated.View style={[styles.particle, style]}>
      <SparkleGlyph size={glyph} />
    </Animated.View>
  )
}

function SparkleBurst({ glyph }: { glyph: number }) {
  return (
    <Animated.View
      testID="math-sparkle-burst"
      exiting={FadeOut.duration(150)}
      style={styles.burst}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <Particle key={i} angle={(i / 6) * Math.PI * 2} glyph={glyph} />
      ))}
    </Animated.View>
  )
}

export interface AnswerChipProps {
  value: number
  size: number
  font: number
  radius: number
  /** The chip tap-gate is open (Emma started reading). */
  gateOpen: boolean
  /** The problem is answered. */
  resolved: boolean
  /** Guided answer: the other chips dim and stop answering. */
  dimForGuided: boolean
  /** Guided answer: this is the chip to tap. */
  glow: boolean
  shaking: boolean
  /** Correct tap celebration on this chip. */
  bursting: boolean
  onTap: (value: number) => void
}

export function AnswerChip({
  value,
  size,
  font,
  radius,
  gateOpen,
  resolved,
  dimForGuided,
  glow,
  shaking,
  bursting,
  onTap,
}: AnswerChipProps) {
  const reducedMotion = useReducedMotion()
  const dim = dimForGuided || !gateOpen
  const disabled = resolved || dim

  const scale = useSharedValue(0.9)
  const opacity = useSharedValue(0)
  const shakeX = useSharedValue(0)
  const pressY = useSharedValue(0)

  useEffect(() => {
    scale.set(withSpring(1, SPRING))
  }, [scale])

  useEffect(() => {
    if (shaking) return
    opacity.set(
      withTiming(dim ? 0.6 : 1, { duration: OPACITY_MS, easing: EASE_OUT }),
    )
  }, [dim, shaking, opacity])

  useEffect(() => {
    if (!shaking) return
    const seg = WRONG_SHAKE_MS / 5
    if (reducedMotion) {
      const half = { duration: WRONG_SHAKE_MS / 2 }
      opacity.set(withSequence(withTiming(0.7, half), withTiming(1, half)))
      return
    }
    const step = (x: number) =>
      withTiming(x, { duration: seg, easing: EASE_OUT })
    shakeX.set(withSequence(step(-6), step(6), step(-4), step(4), step(0)))
  }, [shaking, reducedMotion, opacity, shakeX])

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [
      { translateX: shakeX.get() },
      { translateY: pressY.get() },
      { scale: scale.get() },
    ],
  }))

  return (
    <Animated.View style={animated}>
      <Pressable
        testID={`math-chip-${value}`}
        accessibilityRole="button"
        accessibilityLabel={`Answer ${value}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={() => {
          if (!reducedMotion) pressY.set(withSpring(PRESS_DEPTH, SPRING))
        }}
        onPressOut={() => pressY.set(withSpring(0, SPRING))}
        onPress={() => onTap(value)}
        style={({ pressed }) => [
          styles.tile,
          {
            width: size,
            height: size,
            borderRadius: radius,
            boxShadow: glow
              ? TILE_SHADOW_GLOW
              : pressed && !disabled
                ? TILE_SHADOW_PRESSED
                : TILE_SHADOW,
          },
        ]}
      >
        <Text
          style={[styles.numeral, { fontSize: font, lineHeight: font * 1.2 }]}
          allowFontScaling={false}
        >
          {value}
        </Text>
        {bursting && !reducedMotion && <SparkleBurst glyph={font} />}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ee',
    experimental_backgroundImage: CLAY.tileFace,
  },
  numeral: {
    fontFamily: fonts.semibold,
    color: CLAY.ink,
  },
  burst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  particle: { position: 'absolute' },
})
