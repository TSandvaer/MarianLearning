/**
 * The digraphs-th mouth cue (spec #231; `design/native/word-song-native.md`
 * § 3): Emma's mouth close-up (`th-mouth.webp`) with "th" under it.
 *
 * - **Corner cue** (web placement B, while the th step is `intro` or
 *   `practicing`): right of the picture (or of the letter row), top
 *   aligned, 12 pt away; 48 × 66 on phones, 85 × 117 on a tablet, a 16 pt
 *   label. A 200 ms fade in, then still. (The web pins it top-right under
 *   the HUD, which lands on the ribbon.)
 * - **Intro panel** (placement A, the first th session, during the
 *   getting-ready wait): a square with a 24 pt label; it springs in (260 /
 *   20 from 0.85) and fades out over 200 ms when the plan arrives.
 *
 * Both are decorative and inert: hidden from screen readers, never a
 * target, never reacting to answers.
 */
import { Image } from 'expo-image'
import { StyleSheet, Text } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'
import { emmaAsset } from '../../assets'
import { colors, fonts } from '../../theme'

const FADE_MS = 200

/** Web: scale 0.85 → 1 on a 260 / 20 spring, opacity in. */
const introEntering: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.85 }] },
    animations: {
      opacity: withTiming(1, { duration: FADE_MS }),
      transform: [
        { scale: withSpring(1, { stiffness: 260, damping: 20, mass: 1 }) },
      ],
    },
  }
}

export function ThCornerCue({
  width,
  height,
}: {
  width: number
  height: number
}) {
  return (
    <Animated.View
      testID="th-corner-cue"
      entering={FadeIn.duration(FADE_MS)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.corner, { width }]}
    >
      <Image
        source={emmaAsset('th-mouth')}
        contentFit="contain"
        accessible={false}
        style={{ width, height }}
      />
      <Text allowFontScaling={false} style={[styles.label, styles.small]}>
        th
      </Text>
    </Animated.View>
  )
}

export function ThIntroPanel({ size }: { size: number }) {
  const reducedMotion = useReducedMotion()
  return (
    <Animated.View
      testID="th-intro-panel"
      entering={reducedMotion ? FadeIn.duration(FADE_MS) : introEntering}
      exiting={FadeOut.duration(FADE_MS)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.panel, { width: size }]}
    >
      <Image
        source={emmaAsset('th-mouth')}
        contentFit="contain"
        accessible={false}
        style={{ width: size, height: size }}
      />
      <Text allowFontScaling={false} style={[styles.label, styles.big]}>
        th
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
    left: '100%',
    top: 0,
    marginLeft: 12,
    alignItems: 'center',
    gap: 2,
    pointerEvents: 'none',
  },
  panel: { alignItems: 'center', gap: 4, pointerEvents: 'none' },
  label: { fontFamily: fonts.bold, color: colors.ink },
  small: { fontSize: 16, lineHeight: 20 },
  big: { fontSize: 24, lineHeight: 30 },
})
