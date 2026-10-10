/**
 * Emma's speech ribbon with the word-by-word reveal. Port of web Greet's
 * ribbon + `renderCaption` (`src/screens/Greet.tsx`):
 *
 * - white, `rounded-3xl` (24), 3 pt `my-pink` border, shadow
 *   `0 8px 24px rgba(244,143,177,0.18)`, centred text;
 * - enters with scale 0.9 → 1 + opacity on a spring (stiffness 260,
 *   damping 20); Reduce Motion: a 300 ms fade;
 * - each word fades 0 → 1 over 150 ms ease-out when revealed; unrevealed
 *   words hold their space (opacity 0), so a line never re-wraps while it
 *   is spoken.
 *
 * The caller positions it (width, top); its height follows the text.
 * Screen readers get the whole line as one element.
 */
import { useEffect } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'
import { colors, fonts } from '../theme'

const RIBBON_SPRING = { stiffness: 260, damping: 20, mass: 1 }
export const WORD_FADE_MS = 150

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
  lineHeight: number
  last: boolean
}

function Word({ word, revealed, fontSize, lineHeight, last }: WordProps) {
  const opacity = useSharedValue(revealed ? 1 : 0)
  useEffect(() => {
    opacity.set(
      withTiming(revealed ? 1 : 0, {
        duration: WORD_FADE_MS,
        easing: Easing.out(Easing.ease),
      }),
    )
  }, [revealed, opacity])
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return (
    <Animated.Text
      testID={revealed ? 'caption-word-revealed' : 'caption-word-hidden'}
      style={[
        styles.word,
        { fontSize, lineHeight, marginRight: last ? 0 : fontSize * 0.4 },
        fade,
      ]}
    >
      {word}
    </Animated.Text>
  )
}

export interface CaptionRibbonProps {
  text: string
  revealedCount: number
  /** Changes when a new line (or a replay) starts, so words fade in anew. */
  lineKey: string
  fontSize: number
  lineHeight: number
  padding: { horizontal: number; vertical: number }
  style?: ViewStyle
  testID?: string
}

export function CaptionRibbon({
  text,
  revealedCount,
  lineKey,
  fontSize,
  lineHeight,
  padding,
  style,
  testID,
}: CaptionRibbonProps) {
  const reducedMotion = useReducedMotion()
  const words = text.split(/\s+/).filter(Boolean)
  return (
    <Animated.View
      testID={testID}
      entering={reducedMotion ? FadeIn.duration(300) : ribbonEntering}
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
      style={[
        styles.ribbon,
        {
          paddingHorizontal: padding.horizontal,
          paddingVertical: padding.vertical,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {words.map((w, i) => (
          <Word
            key={`${lineKey}-${i}`}
            word={w}
            revealed={i < revealedCount}
            fontSize={fontSize}
            lineHeight={lineHeight}
            last={i === words.length - 1}
          />
        ))}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  ribbon: {
    borderRadius: 24, // rounded-3xl
    borderWidth: 3,
    borderColor: colors.myPink,
    backgroundColor: colors.white,
    boxShadow: '0 8px 24px rgba(244, 143, 177, 0.18)',
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
