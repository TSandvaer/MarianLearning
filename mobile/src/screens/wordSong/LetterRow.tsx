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
 * - If the row is wider than `maxWidth`, F steps down 4 pt at a time, never
 *   below 0.8 F.
 */
import { letterHighlighted } from '@marian/core/wordSong/wordRound'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
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
import { fonts } from '../../theme'

const SPOTLIGHT = '#FFB7C5'
const INK = '#3B3B3B'
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)

function Cell({
  letter,
  index,
  font,
  cellMin,
  lit,
  fadeOutMs,
  onPress,
}: {
  letter: string
  index: number
  font: number
  cellMin: number
  lit: boolean
  fadeOutMs: number
  onPress: () => void
}) {
  const reducedMotion = useReducedMotion()
  const enter = useSharedValue(reducedMotion ? 1 : 0)
  const opacity = useSharedValue(0)
  const pulse = useSharedValue(1)
  const spot = useSharedValue(0)

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
    spot.set(withTiming(lit ? 1 : 0, { duration: lit ? 120 : fadeOutMs }))
    if (!lit || reducedMotion) return
    const half = { duration: 200, easing: EASE_OUT }
    pulse.set(withSequence(withTiming(1.2, half), withTiming(1, half)))
  }, [lit, fadeOutMs, reducedMotion, spot, pulse])

  const cellStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: enter.get() * pulse.get() }],
  }))
  const spotStyle = useAnimatedStyle(() => ({ opacity: spot.get() }))
  return (
    <Animated.View style={cellStyle}>
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
        <Text
          allowFontScaling={false}
          style={[styles.letter, { fontSize: font, lineHeight: font * 1.2 }]}
        >
          {letter}
        </Text>
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
  onLetterPress: (index: number) => void
}

export function LetterRow({
  word,
  font: font0,
  cellMin,
  maxWidth,
  lit,
  onLetterPress,
}: LetterRowProps) {
  const [font, setFont] = useState(font0)
  const letters = word.split('')
  return (
    <View
      testID="word-song-letters"
      style={styles.row}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width
        if (w > maxWidth && font - 4 >= font0 * 0.8) setFont(font - 4)
      }}
    >
      {letters.map((letter, i) => (
        <Cell
          key={`${i}-${letter}`}
          letter={letter}
          index={i}
          font={font}
          cellMin={cellMin}
          lit={letterHighlighted(i, lit, letters.length)}
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
})
