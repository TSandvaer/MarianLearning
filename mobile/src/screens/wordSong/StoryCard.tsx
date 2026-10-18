/**
 * A little story's card and its reveal scene (`design/native/content-
 * wave-3.md` § 4.2, § 4.3, § 4.5).
 *
 * - **Card** (`testID="word-story"`, label = the story): the sentence
 *   panel's look (white, 3 pt pink border, radius 16, its shadow), Fredoka
 *   600 ink, at the top of the stage. Each sentence starts a new line; each
 *   word is a button ("Word fox") whose box takes half the 0.35 em gap on
 *   each side, a line tall (≥ 44 pt), so the boxes touch.
 * - **Spotlight**: the letter row's pink (`#FFB7C5`) behind one word, its
 *   width + 4 (an overhang over the half-gaps, not layout width, so the
 *   line counts stay § 4.3's), F + 8 tall, radius 0.3 F; the word stays
 *   dark. A tapped word
 *   also pulses 1 → 1.08 → 1 (300 ms ease-out). [Reduce Motion: the
 *   spotlight only.] It comes in over 120 ms and goes out over 200 ms.
 * - **Scene** (`testID="word-story-scene"`, after the answer only): the
 *   story's square scene, radius 16; until the scenes are generated, the
 *   answer's pack picture. Scale 0.92 → 1 on a 260 / 20 spring, opacity
 *   over 250 ms. [Reduce Motion: a 200 ms fade.]
 * - The card enters with opacity 0 → 1 and a 12 pt rise on a 260 / 20
 *   spring. [Reduce Motion: a 150 ms fade.]
 * - **Word-tap cue** (`./StoryTapCue.tsx`, PR #599): the hand, the card's
 *   last child (above every word, outside word 0's pulse), its fingertip
 *   2 pt above the bottom-centre of word 0's text box, placed from word
 *   0's measured frame.
 */
import type { WordEntry } from '@marian/core/wordSong/wordPack'
import { Image } from 'expo-image'
import { useEffect, useMemo, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
} from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { storySceneAsset } from '../../assets'
import {
  STORY_CARD_BORDER,
  STORY_SPOT_OVERHANG,
  STORY_WORD_GAP_EM,
  type StoryCardMetrics,
} from '../../layout/wordSongLayout'
import { colors, fonts } from '../../theme'
import { storyCells, type StoryWordCell } from './storyCells'
import { StoryTapCue } from './StoryTapCue'
import { WordPicture } from './WordPicture'

/** The spotlight (the letter row's). */
export const STORY_SPOT = '#FFB7C5'
export const STORY_SPOT_IN_MS = 120
export const STORY_SPOT_OUT_MS = 200
/** A tapped word's pulse (§ 4.5). */
export const STORY_TAP_PULSE_MS = 300
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)
const SPRING = { stiffness: 260, damping: 20, mass: 1 }

function StoryWord({
  cell,
  metrics: m,
  lit,
  pulse,
  enabled,
  reducedMotion,
  onPress,
  onLayout,
}: {
  cell: StoryWordCell
  metrics: StoryCardMetrics
  lit: boolean
  /** Bumped by each tap on this word (0 = never tapped). */
  pulse: number
  enabled: boolean
  reducedMotion: boolean
  onPress: (cell: StoryWordCell) => void
  /** Word 0's frame in its sentence row (the cue's hand is placed from it). */
  onLayout?: (frame: LayoutRectangle) => void
}) {
  const scale = useSharedValue(1)
  useEffect(() => {
    if (pulse === 0 || reducedMotion) return
    scale.set(
      withSequence(
        withTiming(1.08, {
          duration: STORY_TAP_PULSE_MS / 2,
          easing: EASE_OUT,
        }),
        withTiming(1, { duration: STORY_TAP_PULSE_MS / 2, easing: EASE_OUT }),
      ),
    )
  }, [pulse, reducedMotion, scale])
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }))
  const F = m.font
  return (
    <Pressable
      testID={`word-story-word-${cell.index}`}
      accessibilityRole="button"
      accessibilityLabel={`Word ${cell.key}`}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => onPress(cell)}
      onLayout={onLayout && ((e) => onLayout(e.nativeEvent.layout))}
      style={[
        styles.word,
        {
          height: m.lineHeight,
          paddingHorizontal: (STORY_WORD_GAP_EM / 2) * F,
        },
      ]}
    >
      <Animated.View style={[styles.wordInner, { height: F + 8 }, style]}>
        {lit && (
          <Animated.View
            testID={`word-story-lit-${cell.index}`}
            entering={FadeIn.duration(STORY_SPOT_IN_MS)}
            exiting={FadeOut.duration(STORY_SPOT_OUT_MS)}
            style={[
              styles.spot,
              {
                left: -STORY_SPOT_OVERHANG,
                right: -STORY_SPOT_OVERHANG,
                borderRadius: 0.3 * F,
              },
            ]}
          />
        )}
        <Text
          allowFontScaling={false}
          style={[styles.text, { fontSize: F, lineHeight: F + 8 }]}
        >
          {cell.written}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

export interface StoryCardProps {
  story: string
  metrics: StoryCardMetrics
  /** The card's top-left (the stage's top, centred in it). */
  x: number
  y: number
  /** The lit words (a tap's, or the read-along's). */
  lit: readonly number[]
  /** Per word index, its tap count (drives the pulse). */
  pulses: Readonly<Record<number, number>>
  /** Word taps are live (from the first frame until the reveal). */
  wordsEnabled: boolean
  onWordPress: (cell: StoryWordCell) => void
  /** The card's measured height (the reveal scene sits below it). */
  onHeight?: (height: number) => void
  /** The word-tap cue's hand is up at word 0 (PR #599). */
  tapCue?: boolean
  /** Her tap: the hand fades out. */
  tapCueLeaving?: boolean
  /** The hand's size S (`storyTapCueSize`). */
  tapCueSize?: number
  /** Word 0 has been measured: the hand can be placed. */
  onTapCueReady?: () => void
}

export function StoryCard({
  story,
  metrics: m,
  x,
  y,
  lit,
  pulses,
  wordsEnabled,
  onWordPress,
  onHeight,
  tapCue = false,
  tapCueLeaving = false,
  tapCueSize = 48,
  onTapCueReady,
}: StoryCardProps) {
  const reducedMotion = useReducedMotion()
  /** Word 0's frame in sentence row 0 (null until measured). */
  const [word0, setWord0] = useState<LayoutRectangle | null>(null)
  const cells = useMemo(() => storyCells(story), [story])
  const sentences = useMemo(
    () =>
      cells.reduce<StoryWordCell[][]>((rows, c) => {
        ;(rows[c.sentence] ??= []).push(c)
        return rows
      }, []),
    [cells],
  )
  const opacity = useSharedValue(0)
  const rise = useSharedValue(reducedMotion ? 0 : 12)
  useEffect(() => {
    if (reducedMotion) {
      opacity.set(withTiming(1, { duration: 150 }))
      return
    }
    opacity.set(withSpring(1, SPRING))
    rise.set(withSpring(0, SPRING))
  }, [reducedMotion, opacity, rise])
  const enter = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: rise.get() }],
  }))
  const litSet = new Set(lit)
  const F = m.font
  return (
    <Animated.View
      testID="word-story"
      accessible={false}
      accessibilityLabel={story}
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
      style={[
        styles.card,
        {
          left: x,
          top: y,
          width: m.width,
          paddingHorizontal: m.padding.horizontal,
          paddingVertical: m.padding.vertical,
          borderWidth: STORY_CARD_BORDER,
        },
        enter,
      ]}
    >
      {sentences.map((row, s) => (
        <View key={s} style={styles.sentence}>
          {row.map((cell) => (
            <StoryWord
              key={cell.index}
              cell={cell}
              metrics={m}
              lit={litSet.has(cell.index)}
              pulse={pulses[cell.index] ?? 0}
              enabled={wordsEnabled}
              reducedMotion={reducedMotion}
              onPress={onWordPress}
              onLayout={
                cell.index === 0
                  ? (frame) => {
                      setWord0(frame)
                      onTapCueReady?.()
                    }
                  : undefined
              }
            />
          ))}
        </View>
      ))}
      {tapCue && word0 !== null && (
        // Absolute insets count from inside the border, where row 0's
        // padding starts; the text box (F + 8) is centred in the word's box.
        <StoryTapCue
          x={m.padding.horizontal + word0.x + word0.width / 2}
          y={m.padding.vertical + word0.y + (word0.height + F + 8) / 2 - 2}
          size={tapCueSize}
          leaving={tapCueLeaving}
        />
      )}
    </Animated.View>
  )
}

/**
 * The reveal scene: the story's scene, or the answer's pack picture until
 * the scenes exist (§ 4.2, § 7).
 */
export function StoryScene({
  storyId,
  answer,
  x,
  y,
  size,
}: {
  storyId: string | undefined
  answer: WordEntry
  x: number
  y: number
  size: number
}) {
  const reducedMotion = useReducedMotion()
  const scene = storySceneAsset(storyId)
  const opacity = useSharedValue(0)
  const scale = useSharedValue(reducedMotion ? 1 : 0.92)
  useEffect(() => {
    if (reducedMotion) {
      opacity.set(withTiming(1, { duration: 200 }))
      return
    }
    opacity.set(withTiming(1, { duration: 250 }))
    scale.set(withSpring(1, SPRING))
  }, [reducedMotion, opacity, scale])
  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }))
  return (
    <Animated.View
      testID="word-story-scene"
      exiting={FadeOut.duration(reducedMotion ? 200 : 250)}
      style={[
        styles.scene,
        { left: x, top: y, width: size, height: size },
        style,
      ]}
    >
      {scene !== undefined ? (
        <Image
          testID="word-story-scene-art"
          source={scene}
          contentFit="cover"
          accessible
          accessibilityLabel={answer.word}
          style={{ width: size, height: size }}
        />
      ) : (
        <WordPicture
          testID="word-story-scene-picture"
          pictureKey={answer.pictureKey}
          size={size}
          label={answer.word}
        />
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: 16,
    borderColor: colors.myPink,
    backgroundColor: colors.white,
    boxShadow: '0 8px 24px rgba(244, 143, 177, 0.18)',
  },
  sentence: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  word: { justifyContent: 'center' },
  wordInner: { justifyContent: 'center', alignItems: 'center' },
  spot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: STORY_SPOT,
  },
  text: { fontFamily: fonts.semibold, color: colors.ink },
  scene: { position: 'absolute', borderRadius: 16, overflow: 'hidden' },
})
