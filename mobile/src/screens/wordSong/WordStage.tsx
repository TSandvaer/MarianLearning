/**
 * The stage (`design/native/word-song-native.md` § 1, § 3, § 4): what
 * fills the rect between the ribbon and the chips, centred vertically.
 *
 * - `picture`: the picture (P × P; it says its word when tapped after the
 *   read), 8 pt, the letter row (`./LetterRow.tsx`).
 * - `letters`: the letter row alone (a word without art, § 7).
 * - `letter` / `letter-sound`: one glyph in a P × P box, Fredoka 700 at
 *   0.71 P; a tap replays the question.
 * - `sentence`: the square scene (when registered; a tap replays the
 *   question), 12 pt, the sentence panel.
 * - `none` (sight words): empty.
 * - `story` (content wave 3): empty here; the screen draws the story card
 *   at the stage's top (`./StoryCard.tsx`).
 *
 * The th corner cue sits right of the picture (or of the letter row), top
 * aligned. Press feedback on the picture, glyph and scene: scale 0.96 over
 * 80 ms, back on a 300 / 20 spring; they are inert unless `tapsOpen`.
 */
import type { WordSongProblem } from '@marian/core/wordSong/wordSessionPlans'
import { Image } from 'expo-image'
import { useEffect, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { sceneAsset } from '../../assets'
import type { WordSongLayout } from '../../layout/wordSongLayout'
import { fonts } from '../../theme'
import { LetterRow } from './LetterRow'
import type { NativeRound } from './nativeRound'
import { SentencePanel } from './SentencePanel'
import { ThCornerCue } from './ThCue'
import { WordPicture } from './WordPicture'

/** Springs in (web 260 / 16), presses to 0.96. */
function TapTarget({
  testID,
  label,
  size,
  enabled,
  onPress,
  children,
}: {
  testID: string
  label: string
  size: number
  enabled: boolean
  onPress: () => void
  children: ReactNode
}) {
  const reducedMotion = useReducedMotion()
  const enter = useSharedValue(reducedMotion ? 1 : 0)
  const opacity = useSharedValue(0)
  const press = useSharedValue(1)
  useEffect(() => {
    opacity.set(withTiming(1, { duration: reducedMotion ? 200 : 150 }))
    if (!reducedMotion) {
      enter.set(withSpring(1, { stiffness: 260, damping: 16, mass: 1 }))
    }
  }, [reducedMotion, opacity, enter])
  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: enter.get() * press.get() }],
  }))
  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPressIn={() => press.set(withTiming(0.96, { duration: 80 }))}
        onPressOut={() =>
          press.set(withSpring(1, { stiffness: 300, damping: 20, mass: 1 }))
        }
        onPress={onPress}
        style={styles.fill}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}

/** The th cue to the right of `children`, top aligned (§ 3). */
function WithCue({
  show,
  cue,
  children,
}: {
  show: boolean
  cue: { width: number; height: number }
  children: ReactNode
}) {
  return (
    <View>
      {children}
      {show && <ThCornerCue width={cue.width} height={cue.height} />}
    </View>
  )
}

export interface WordStageProps {
  round: NativeRound
  problem: WordSongProblem
  layout: WordSongLayout
  /** The lit letter (`length` = all), null = none. */
  lit: number | null
  /** A step intro's letter spotlight (`./introSpotlight.ts`); null = none. */
  spotlight?: readonly (number | null)[] | null
  /** Tent words' end pulse (`introEndPulse`); null = none. */
  endPulse?: readonly (number | null)[] | null
  /** The quiet cell of the quiet-E cue (`quietECue`); null = none. */
  quiet?: number | null
  revealedCount: number
  resolved: boolean
  showThCue: boolean
  /** The picture, glyph and scene answer taps (after the read). */
  tapsOpen: boolean
  onLetterPress: (index: number) => void
  onPicturePress: () => void
  onReplayRead: () => void
}

export function WordStage({
  round,
  problem,
  layout: l,
  lit,
  spotlight = null,
  endPulse = null,
  quiet = null,
  revealedCount,
  resolved,
  showThCue,
  tapsOpen,
  onLetterPress,
  onPicturePress,
  onReplayRead,
}: WordStageProps) {
  const word = problem.target.word
  const p = l.picture
  const letters = (
    <LetterRow
      word={word}
      font={l.letterFont}
      cellMin={l.letterCellMin}
      maxWidth={l.stage.width}
      lit={lit}
      spotlight={spotlight}
      endPulse={endPulse}
      quiet={quiet}
      onLetterPress={onLetterPress}
    />
  )
  let body: ReactNode = null
  if (round.card === 'picture') {
    body = (
      <View testID="word-song-word-card" style={[styles.column, { gap: 8 }]}>
        <WithCue show={showThCue} cue={l.thCue}>
          <TapTarget
            testID="word-song-word-picture"
            label={word}
            size={p}
            enabled={tapsOpen}
            onPress={onPicturePress}
          >
            <WordPicture
              pictureKey={problem.target.pictureKey}
              size={p}
              label={word}
            />
          </TapTarget>
        </WithCue>
        {letters}
      </View>
    )
  } else if (round.card === 'letters') {
    body = (
      <View testID="word-song-letters-card" style={styles.column}>
        <WithCue show={showThCue} cue={l.thCue}>
          {letters}
        </WithCue>
      </View>
    )
  } else if (round.card === 'letter' || round.card === 'letter-sound') {
    body = (
      <TapTarget
        testID={
          round.card === 'letter'
            ? 'word-song-letter-card'
            : 'word-song-letter-sound-card'
        }
        label={`Letter ${word}`}
        size={p}
        enabled={tapsOpen}
        onPress={onReplayRead}
      >
        <View style={styles.center}>
          <Text
            allowFontScaling={false}
            style={[
              styles.glyph,
              { fontSize: 0.71 * p, lineHeight: 0.71 * p * 1.2 },
            ]}
          >
            {word}
          </Text>
        </View>
      </TapTarget>
    )
  } else if (round.card === 'sentence') {
    const scene = sceneAsset(problem.sceneId)
    body = (
      <View style={[styles.column, { gap: 12 }]}>
        {scene !== undefined && (
          <TapTarget
            testID="word-song-scene"
            label={problem.sentenceFrame ?? word}
            size={l.scene}
            enabled={tapsOpen}
            onPress={onReplayRead}
          >
            <Image
              source={scene}
              contentFit="contain"
              accessible={false}
              style={{ width: l.scene, height: l.scene }}
            />
          </TapTarget>
        )}
        <SentencePanel
          frame={problem.sentenceFrame}
          targetWord={word}
          revealedCount={revealedCount}
          filled={resolved}
          metrics={l.sentence}
          maxWidth={l.stage.width}
        />
      </View>
    )
  }
  return (
    <View
      testID="word-song-stage"
      style={[
        styles.stage,
        {
          left: l.stage.x,
          top: l.stage.y,
          width: l.stage.width,
          height: l.stage.height,
        },
      ]}
    >
      {body}
    </View>
  )
}

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  column: { alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
  glyph: { fontFamily: fonts.bold, color: '#1F2937' },
})
