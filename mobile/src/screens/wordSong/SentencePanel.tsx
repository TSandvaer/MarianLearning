/**
 * The simple-sentence panel (web `SentencePanel`; `design/native/
 * word-song-native.md` § 3, § 7): the gapped sentence on a white card with
 * a 3 pt `#FFC0CB` border, radius 16, the web's pink shadow. Its words
 * appear one by one with Emma's read (the caption's ticks, 150 ms fades);
 * the gap is a 3 pt ink bar 3.5 "0"s wide, and when the problem is solved
 * the answer springs into it (260 / 16; Reduce Motion: a 200 ms fade) so
 * she sees the whole sentence.
 *
 * Tokens come from core's `sentenceTokens` (the gap keeps its punctuation).
 */
import { filledSentence, sentenceTokens } from '@marian/core/wordSong/wordRound'
import { useEffect, type ReactNode } from 'react'
import { StyleSheet, Text, View, type TextStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import type { SentenceMetrics } from '../../layout/wordSongLayout'
import { colors, fonts } from '../../theme'

/** Fredoka's "0" is about 0.6 em wide (the gap is 3.5 of them, web `3.5ch`). */
const ZERO_ADVANCE_EM = 0.6

function Reveal({
  shown,
  children,
  testID,
}: {
  shown: boolean
  children: ReactNode
  testID: string
}) {
  const opacity = useSharedValue(shown ? 1 : 0)
  useEffect(() => {
    opacity.set(withTiming(shown ? 1 : 0, { duration: 150 }))
  }, [shown, opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return (
    <Animated.View testID={testID} style={[styles.token, style]}>
      {children}
    </Animated.View>
  )
}

function FilledWord({ word, style }: { word: string; style: TextStyle[] }) {
  const reducedMotion = useReducedMotion()
  const scale = useSharedValue(reducedMotion ? 1 : 0)
  const opacity = useSharedValue(0)
  useEffect(() => {
    opacity.set(withTiming(1, { duration: 200 }))
    if (!reducedMotion) {
      scale.set(withSpring(1, { stiffness: 260, damping: 16, mass: 1 }))
    }
  }, [reducedMotion, opacity, scale])
  const anim = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }))
  return (
    <Animated.Text
      testID="word-song-sentence-filled"
      allowFontScaling={false}
      style={[...style, anim]}
    >
      {word}
    </Animated.Text>
  )
}

export function SentencePanel({
  frame,
  targetWord,
  revealedCount,
  filled,
  metrics: m,
  maxWidth,
}: {
  frame: string | undefined
  targetWord: string
  revealedCount: number
  filled: boolean
  metrics: SentenceMetrics
  maxWidth: number
}) {
  if (frame === undefined) return null
  const text: TextStyle[] = [
    styles.text,
    { fontSize: m.font, lineHeight: m.font * m.lineHeight },
  ]
  const tokens = sentenceTokens(frame)
  return (
    <View
      testID="word-song-sentence-panel"
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={filled ? filledSentence(frame, targetWord) : frame}
      style={[
        styles.panel,
        {
          maxWidth,
          paddingHorizontal: m.padding.horizontal,
          paddingVertical: m.padding.vertical,
          columnGap: m.font * 0.3,
        },
      ]}
    >
      {tokens.map((t, i) =>
        t.kind === 'word' ? (
          <Reveal
            key={`${i}-${t.text}`}
            testID="word-song-sentence-word"
            shown={i < revealedCount}
          >
            <Text allowFontScaling={false} style={text}>
              {t.text}
            </Text>
          </Reveal>
        ) : (
          <Reveal
            key={`gap-${i}`}
            testID="word-song-sentence-gap"
            shown={i < revealedCount}
          >
            {t.before !== '' && (
              <Text allowFontScaling={false} style={text}>
                {t.before}
              </Text>
            )}
            {filled ? (
              <FilledWord word={targetWord} style={text} />
            ) : (
              <View
                testID="word-song-sentence-blank"
                style={[
                  styles.blank,
                  {
                    width: m.font * ZERO_ADVANCE_EM * 3.5,
                    height: m.font * m.lineHeight * 0.8,
                  },
                ]}
              />
            )}
            {t.after !== '' && (
              <Text allowFontScaling={false} style={text}>
                {t.after}
              </Text>
            )}
          </Reveal>
        ),
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-end',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.myPink,
    backgroundColor: colors.white,
    boxShadow: '0 8px 24px rgba(244, 143, 177, 0.18)',
  },
  token: { flexDirection: 'row', alignItems: 'flex-end' },
  text: { fontFamily: fonts.semibold, color: colors.ink },
  blank: { borderBottomWidth: 3, borderBottomColor: colors.ink },
})
