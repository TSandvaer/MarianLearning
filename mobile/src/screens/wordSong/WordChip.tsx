/**
 * One Word Song chip (`design/native/word-song-native.md` § 3): the shared
 * clay frame (`../../components/ClayChip.tsx`, Math's chip) on Word Song's
 * pink slab (`.clay-world-word`), with a face:
 *
 * - **picture**: the WebP, `contain`, in the inset box;
 * - **letter**: Fredoka 700 at 0.57 C, `#1F2937`;
 * - **written word**: Fredoka 700, `#1F2937`, 0.32 C or as large as fits
 *   C − 2 × inset, never below 24.
 *
 * A correct tap bursts six sparkles out 75 × C / 112 over 850 ms (Word
 * Song's own: farther and longer than Math's); none on Reduce Motion.
 */
import type { ChipFace } from '@marian/core/wordSong/wordRound'
import type { WordEntry } from '@marian/core/wordSong/wordPack'
import { useEffect } from 'react'
import { StyleSheet, Text } from 'react-native'
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { ClayChip } from '../../components/ClayChip'
import { chipInner } from '../../layout/wordSongLayout'
import { fonts } from '../../theme'
import { SparkleGlyph } from '../math/glyphs'
import { WordPicture } from './WordPicture'

/** Web `SPARKLE_BURST_MS`. */
export const SPARKLE_BURST_MS = 850
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)
/** Word Song clay (web `.clay-world-word`). */
const SLAB = '#f2a7c3'
const GLYPH_INK = '#1F2937'

function Particle({
  angle,
  distance,
  glyph,
}: {
  angle: number
  distance: number
  glyph: number
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.set(withTiming(1, { duration: SPARKLE_BURST_MS, easing: EASE_OUT }))
  }, [t])
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.get(),
    transform: [
      { translateX: Math.cos(angle) * distance * t.get() },
      { translateY: Math.sin(angle) * distance * t.get() },
      { scale: 0.5 + 0.6 * t.get() },
    ],
  }))
  return (
    <Animated.View style={[styles.particle, style]}>
      <SparkleGlyph size={glyph} />
    </Animated.View>
  )
}

/**
 * The burst: six sparkles out `distance` over `SPARKLE_BURST_MS`, filling
 * its parent and centred on it. A correct chip's, and the letter critters'
 * joy beat's from the middle seat (Dave 2026-10-25). Callers skip it on
 * Reduce Motion.
 */
export function SparkleBurst({
  distance,
  glyph,
  testID = 'word-song-sparkle-burst',
}: {
  distance: number
  glyph: number
  testID?: string
}) {
  return (
    <Animated.View
      testID={testID}
      exiting={FadeOut.duration(150)}
      style={styles.burst}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <Particle
          key={i}
          angle={(i / 6) * Math.PI * 2}
          distance={distance}
          glyph={glyph}
        />
      ))}
    </Animated.View>
  )
}

export interface WordChipProps {
  entry: WordEntry
  face: ChipFace
  label: string
  size: number
  /** Emma has read the problem: the chip answers. */
  ready: boolean
  resolved: boolean
  dimForGuided: boolean
  glow: boolean
  shaking: boolean
  bursting: boolean
  onTap: (word: string) => void
}

export function WordChip({
  entry,
  face,
  label,
  size,
  ready,
  resolved,
  dimForGuided,
  glow,
  shaking,
  bursting,
  onTap,
}: WordChipProps) {
  const reducedMotion = useReducedMotion()
  const inner = chipInner(size)
  const box = size - inner.inset * 2
  const font =
    face === 'letter' || face === 'letter-sound'
      ? inner.letterFont
      : inner.wordFont
  return (
    <ClayChip
      testID={`word-song-chip-${entry.word}`}
      label={label}
      size={size}
      radius={inner.radius}
      inset={inner.inset}
      slab={SLAB}
      gateOpen={ready}
      resolved={resolved}
      dimForGuided={dimForGuided}
      glow={glow}
      shaking={shaking}
      onPress={() => onTap(entry.word)}
      burst={
        bursting && !reducedMotion ? (
          <SparkleBurst distance={inner.burstDistance} glyph={inner.sparkle} />
        ) : null
      }
    >
      {face === 'picture' ? (
        <WordPicture
          pictureKey={entry.pictureKey}
          size={box}
          label={entry.word}
        />
      ) : (
        <Text
          testID={`word-song-chip-text-${face}`}
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit={face === 'written-word'}
          minimumFontScale={inner.wordFontMin / inner.wordFont}
          style={[
            styles.glyph,
            { fontSize: font, lineHeight: font * 1.2, maxWidth: box },
          ]}
        >
          {entry.word}
        </Text>
      )}
    </ClayChip>
  )
}

const styles = StyleSheet.create({
  glyph: { fontFamily: fonts.bold, color: GLYPH_INK, textAlign: 'center' },
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
