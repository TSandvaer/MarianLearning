/**
 * One answer chip: the web's `math-chip` (`src/screens/Math/Math.tsx`),
 * the numeral on the shared clay frame (`../../components/ClayChip.tsx`:
 * entrance, the closed / dimmed state, press, shake, guided glow) on the
 * Number Garden's caramel slab.
 *
 * - Correct tap: six sparkles spring out 60 pt (skipped on Reduce Motion).
 */
import { useEffect } from 'react'
import { StyleSheet, Text } from 'react-native'
import Animated, {
  Extrapolation,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { ClayChip } from '../../components/ClayChip'
import { fonts } from '../../theme'
import { SparkleGlyph } from './glyphs'

/** Number Garden clay (web `.clay-world-math`). */
const CLAY = { slab: '#dba675', ink: '#5a3524' }

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
  return (
    <ClayChip
      testID={`math-chip-${value}`}
      label={`Answer ${value}`}
      size={size}
      radius={radius}
      slab={CLAY.slab}
      gateOpen={gateOpen}
      resolved={resolved}
      dimForGuided={dimForGuided}
      glow={glow}
      shaking={shaking}
      onPress={() => onTap(value)}
      burst={bursting && !reducedMotion ? <SparkleBurst glyph={font} /> : null}
    >
      <Text
        style={[styles.numeral, { fontSize: font, lineHeight: font * 1.2 }]}
        allowFontScaling={false}
      >
        {value}
      </Text>
    </ClayChip>
  )
}

const styles = StyleSheet.create({
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
