/**
 * Speech ribbon with word-by-word reveal — port of Greet's ribbon +
 * `renderCaption` (web Greet.tsx). Each word fades 0 -> 1 over 150 ms
 * ease-out when revealed; unrevealed words hold their space (opacity 0) so
 * the line never re-wraps mid-sentence.
 */
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'
import { colors, fonts } from '../theme'

/** Web RIBBON_SPRING: scale 0.9 -> 1 + opacity 0 -> 1, stiffness 260, damping 20. */
const RIBBON_SPRING = { stiffness: 260, damping: 20, mass: 1 }
const ribbonEntering: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.9 }] },
    animations: {
      opacity: withSpring(1, { ...RIBBON_SPRING, overshootClamping: true }),
      transform: [{ scale: withSpring(1, RIBBON_SPRING) }],
    },
  }
}

interface WordProps {
  word: string
  revealed: boolean
  fontSize: number
  last: boolean
}

function Word({ word, revealed, fontSize, last }: WordProps) {
  const opacity = useSharedValue(revealed ? 1 : 0)
  useEffect(() => {
    opacity.value = withTiming(revealed ? 1 : 0, {
      duration: 150,
      easing: Easing.out(Easing.ease),
    })
  }, [revealed, opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.Text
      style={[
        styles.word,
        {
          fontSize,
          lineHeight: fontSize * 1.375,
          marginRight: last ? 0 : fontSize * 0.4,
        },
        style,
      ]}
    >
      {word}
    </Animated.Text>
  )
}

export interface CaptionRibbonProps {
  text: string
  revealedCount: number
  fontSize: number
  /** Unique per line so a new line restarts the reveal from 0. */
  lineKey: string
}

export function CaptionRibbon({
  text,
  revealedCount,
  fontSize,
  lineKey,
}: CaptionRibbonProps) {
  const words = text.split(/\s+/).filter(Boolean)
  return (
    <Animated.View
      entering={ribbonEntering}
      style={[
        styles.ribbon,
        { paddingHorizontal: fontSize * 0.6, paddingVertical: fontSize * 0.4 },
      ]}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        {words.map((w, i) => (
          <Word
            key={`${lineKey}-${i}`}
            word={w}
            revealed={i < revealedCount}
            fontSize={fontSize}
            last={i === words.length - 1}
          />
        ))}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  ribbon: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 672, // max-w-2xl
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.myPink,
    backgroundColor: colors.white,
    // shadow-[0_8px_24px_rgba(244,143,177,0.18)]
    shadowColor: colors.myRose,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  word: {
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
})
