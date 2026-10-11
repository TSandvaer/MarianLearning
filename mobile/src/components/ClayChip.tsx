/**
 * An answer chip's frame: the web's `.clay-tile` (`src/index.css`), a cream
 * clay face on a world-coloured slab (Number Garden `#dba675`, Word Song
 * `#f2a7c3`). The lesson screens put their content in it: Math's numeral
 * (`screens/math/AnswerChip.tsx`), Word Song's picture, letter or word
 * (`screens/wordSong/WordChip.tsx`).
 *
 * - In: scale 0.9 → 1 on the chip spring (300 / 18), opacity to its
 *   target over 200 ms ease-out.
 * - Closed (Emma has not read yet) or dimmed for the guided answer:
 *   opacity 0.6 and not pressable ("in a moment", never "wrong"). Opening
 *   lifts it to 1.0 over 200 ms, no spring, no sound.
 * - Press: the face sinks 4 pt onto its slab (the slab shadow 6 → 2).
 * - Wrong tap: a 400 ms side-shake, x 0 → -6 → 6 → -4 → 4 → 0, ease-out
 *   (Reduce Motion: an opacity dip 1 → 0.7 → 1). Never red, never an X.
 * - Guided answer: a warm glow ring around the correct chip.
 * - `burst`: drawn over the face (each world's sparkle burst).
 */
import {
  CHIP_TAP_SPRING,
  WRONG_SHAKE_MS,
} from '@marian/core/shared/gameplayConstants'
import { useEffect, type ReactNode } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

const SPRING = {
  stiffness: CHIP_TAP_SPRING.stiffness,
  damping: CHIP_TAP_SPRING.damping,
  mass: 1,
}
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)
const OPACITY_MS = 200
const PRESS_DEPTH = 4
const FACE = 'linear-gradient(#ffffff 0%, #fff7ee 60%, #ffeedd 100%)'

/** The web's three `.clay-tile` shadows on a slab colour. */
function tileShadows(slab: string) {
  return {
    rest: `inset 0 4px 0 #ffffff, inset 0 -6px 0 rgba(120, 70, 40, 0.08), 0 6px 0 ${slab}, 0 10px 14px rgba(90, 45, 20, 0.12)`,
    pressed: `inset 0 4px 0 #ffffff, 0 2px 0 ${slab}, 0 4px 8px rgba(90, 45, 20, 0.12)`,
    glow: `inset 0 4px 0 #ffffff, inset 0 -6px 0 rgba(120, 70, 40, 0.08), 0 6px 0 ${slab}, 0 0 0 6px rgba(255, 214, 92, 0.75), 0 0 30px 10px rgba(255, 196, 64, 0.55)`,
  }
}

export interface ClayChipProps {
  testID: string
  label: string
  size: number
  radius: number
  /** Inner padding around the content. */
  inset?: number
  /** The world's slab colour. */
  slab: string
  /** The chip answers (Emma has read the problem). */
  gateOpen: boolean
  resolved: boolean
  dimForGuided: boolean
  glow: boolean
  shaking: boolean
  onPress: () => void
  children: ReactNode
  burst?: ReactNode
}

export function ClayChip({
  testID,
  label,
  size,
  radius,
  inset = 0,
  slab,
  gateOpen,
  resolved,
  dimForGuided,
  glow,
  shaking,
  onPress,
  children,
  burst,
}: ClayChipProps) {
  const reducedMotion = useReducedMotion()
  const dim = dimForGuided || !gateOpen
  const disabled = resolved || dim
  const shadows = tileShadows(slab)

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
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={() => {
          if (!reducedMotion) pressY.set(withSpring(PRESS_DEPTH, SPRING))
        }}
        onPressOut={() => pressY.set(withSpring(0, SPRING))}
        onPress={onPress}
        style={({ pressed }) => [
          styles.tile,
          {
            width: size,
            height: size,
            borderRadius: radius,
            padding: inset,
            boxShadow: glow
              ? shadows.glow
              : pressed && !disabled
                ? shadows.pressed
                : shadows.rest,
          },
        ]}
      >
        {children}
        {burst}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ee',
    experimental_backgroundImage: FACE,
  },
})
