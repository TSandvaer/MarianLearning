/**
 * The word card's letters (`design/native/word-song-native.md` § 3, § 5):
 * Fredoka 600 `#3B3B3B` at F, one cell per letter (width max(48, advance +
 * 0.4 F), 56 minimum on a tablet; height F + 16), the cells touching and
 * the row centred. The hit area is the cell.
 *
 * - A lit letter stays dark on a rose spotlight (`#FFB7C5`, cell − 4 wide,
 *   F + 8 tall, radius 0.3 F) that fades in over 120 ms, with the web's
 *   pulse (scale 1 → 1.2 → 1, 400 ms ease-out). `lit === length` lights
 *   every letter (the whole word). Going dark: 120 ms, 200 ms at the end.
 * - Entrance: the web's springs (300 / 18), 150 ms apart.
 * - Reduce Motion: no pulse, no stagger (150 ms fades); the spotlight
 *   still shows.
 * - A step intro's spotlight (`./introSpotlight.ts`, content wave 1 § 3.3,
 *   § 4.3) lights its cells too, each after its own delay.
 * - Tent words' end pulse (content wave 2 § 3.3): a cell given a delay
 *   pulses once, 1 → 1.08 → 1 over 300 ms, on top of any other scale. Not
 *   with Reduce Motion (the caller passes none).
 * - The `'quiet'` cell (content wave 2 § 4.3, the magic e): the glyph is
 *   `colors.ink` at 35 % opacity (a 200 ms fade each way), with no
 *   spotlight, so a tap on it lights nothing while it is quiet.
 * - If the row is wider than `maxWidth`, F steps down 4 pt at a time, never
 *   below 0.8 F.
 */
import { letterHighlighted } from '@marian/core/wordSong/wordRound'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { colors, fonts } from '../../theme'
import { END_PULSE_MS } from './introSpotlight'

const SPOTLIGHT = '#FFB7C5'
const INK = '#3B3B3B'
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)
/** Tent words' end pulse: 1 → this → 1 over `END_PULSE_MS` (§ 3.3). */
export const END_PULSE_SCALE = 1.08
/** A quiet cell's glyph opacity, and its fade each way (§ 4.3). */
export const QUIET_OPACITY = 0.35
export const QUIET_FADE_MS = 200

function Cell({
  letter,
  index,
  font,
  cellMin,
  lit,
  litDelayMs,
  endPulseDelayMs,
  quiet,
  fadeOutMs,
  onPress,
}: {
  letter: string
  index: number
  font: number
  cellMin: number
  lit: boolean
  /** How long after `lit` turns on the spotlight fades in (and pulses). */
  litDelayMs: number
  /** The end pulse's delay (ms from now), or `null` for none. */
  endPulseDelayMs: number | null
  /** The `'quiet'` state: the glyph at 35 %, no spotlight. */
  quiet: boolean
  fadeOutMs: number
  onPress: () => void
}) {
  const reducedMotion = useReducedMotion()
  const enter = useSharedValue(reducedMotion ? 1 : 0)
  const opacity = useSharedValue(0)
  const pulse = useSharedValue(1)
  const endPulse = useSharedValue(1)
  const spot = useSharedValue(0)
  const glyph = useSharedValue(1)

  useEffect(() => {
    if (reducedMotion) {
      opacity.set(withTiming(1, { duration: 150 }))
      return
    }
    const spring = { stiffness: 300, damping: 18, mass: 1 }
    opacity.set(withDelay(150 * index, withTiming(1, { duration: 150 })))
    enter.set(withDelay(150 * index, withSpring(1, spring)))
  }, [index, reducedMotion, opacity, enter])

  useEffect(() => {
    const delay = lit ? litDelayMs : 0
    spot.set(
      withDelay(
        delay,
        withTiming(lit ? 1 : 0, { duration: lit ? 120 : fadeOutMs }),
      ),
    )
    if (!lit || reducedMotion) return
    const half = { duration: 200, easing: EASE_OUT }
    pulse.set(
      withDelay(
        delay,
        withSequence(withTiming(1.2, half), withTiming(1, half)),
      ),
    )
  }, [lit, litDelayMs, fadeOutMs, reducedMotion, spot, pulse])

  useEffect(() => {
    if (endPulseDelayMs === null || reducedMotion) return
    const half = { duration: END_PULSE_MS / 2, easing: EASE_OUT }
    endPulse.set(
      withDelay(
        endPulseDelayMs,
        withSequence(withTiming(END_PULSE_SCALE, half), withTiming(1, half)),
      ),
    )
  }, [endPulseDelayMs, reducedMotion, endPulse])

  useEffect(() => {
    glyph.set(
      withTiming(quiet ? QUIET_OPACITY : 1, { duration: QUIET_FADE_MS }),
    )
  }, [quiet, glyph])

  const cellStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: enter.get() * pulse.get() * endPulse.get() }],
  }))
  const spotStyle = useAnimatedStyle(() => ({ opacity: spot.get() }))
  const glyphStyle = useAnimatedStyle(() => ({ opacity: glyph.get() }))
  return (
    <Animated.View
      testID={
        endPulseDelayMs !== null ? 'word-song-letter-end-pulse' : undefined
      }
      style={cellStyle}
    >
      <Pressable
        testID={`word-song-letter-${index}`}
        accessibilityRole="button"
        accessibilityLabel={`Letter ${letter}`}
        accessibilityState={{ selected: lit }}
        onPress={onPress}
        style={[
          styles.cell,
          {
            minWidth: cellMin,
            height: font + 16,
            paddingHorizontal: font * 0.2,
          },
        ]}
      >
        <Animated.View
          testID={lit ? 'word-song-letter-lit' : undefined}
          style={[
            styles.spotlight,
            { height: font + 8, top: 4, borderRadius: font * 0.3 },
            spotStyle,
          ]}
        />
        <Animated.Text
          testID={quiet ? 'word-song-letter-quiet' : undefined}
          allowFontScaling={false}
          style={[
            styles.letter,
            { fontSize: font, lineHeight: font * 1.2 },
            quiet && styles.quiet,
            glyphStyle,
          ]}
        >
          {letter}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  )
}

export interface LetterRowProps {
  word: string
  /** F (the layout's), before any step-down. */
  font: number
  cellMin: number
  maxWidth: number
  /** The lit letter; `word.length` = all; null = none. */
  lit: number | null
  /**
   * A step intro's spotlight: per letter, the delay before it lights, or
   * `null` (dark). `null` / unset = no intro spotlight.
   */
  spotlight?: readonly (number | null)[] | null
  /**
   * Tent words' end pulse: per letter, the delay before its one pulse, or
   * `null`. `null` / unset = none.
   */
  endPulse?: readonly (number | null)[] | null
  /** The quiet cell (the magic e), or `null` / unset for none. */
  quiet?: number | null
  onLetterPress: (index: number) => void
}

export function LetterRow({
  word,
  font: font0,
  cellMin,
  maxWidth,
  lit,
  spotlight = null,
  endPulse = null,
  quiet = null,
  onLetterPress,
}: LetterRowProps) {
  // The step-down belongs to one F: a rotation (a new F) starts over.
  const [fit, setFit] = useState({ base: font0, font: font0 })
  const font = fit.base === font0 ? fit.font : font0
  const letters = word.split('')
  return (
    <View
      testID="word-song-letters"
      style={styles.row}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width
        if (w > maxWidth && font - 4 >= font0 * 0.8) {
          setFit({ base: font0, font: font - 4 })
        }
      }}
    >
      {letters.map((letter, i) => (
        <Cell
          key={`${i}-${letter}`}
          letter={letter}
          index={i}
          font={font}
          cellMin={cellMin}
          lit={
            quiet !== i &&
            (letterHighlighted(i, lit, letters.length) ||
              (spotlight?.[i] ?? null) !== null)
          }
          litDelayMs={
            letterHighlighted(i, lit, letters.length)
              ? 0
              : (spotlight?.[i] ?? 0)
          }
          endPulseDelayMs={endPulse?.[i] ?? null}
          quiet={quiet === i}
          fadeOutMs={lit === null ? 200 : 120}
          onPress={() => onLetterPress(i)}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  spotlight: {
    position: 'absolute',
    left: 2,
    right: 2,
    backgroundColor: SPOTLIGHT,
  },
  letter: { fontFamily: fonts.semibold, color: INK },
  quiet: { color: colors.ink },
})
