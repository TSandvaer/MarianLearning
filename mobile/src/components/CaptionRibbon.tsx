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
 * Screen readers get the whole line as one element. A caller may restyle
 * it (Math and the Hub use a clay slab), set the text `color`, add an
 * `exiting` animation and draw children over the slab (the Hub's tail).
 */
import {
  useCallback,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
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
  color: string
  onY?: (y: number) => void
}

function Word({
  word,
  revealed,
  fontSize,
  lineHeight,
  last,
  color,
  onY,
}: WordProps) {
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
      onLayout={onY ? (e) => onY(e.nativeEvent.layout.y) : undefined}
      style={[
        styles.word,
        { fontSize, lineHeight, color, marginRight: last ? 0 : fontSize * 0.4 },
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
  style?: StyleProp<ViewStyle>
  testID?: string
  /** Text colour. Default: the app's ink. */
  color?: string
  /** Leaves with this animation (default: at once). */
  exiting?: ComponentProps<typeof Animated.View>['exiting']
  /** Drawn over the slab, under the words (e.g. a speech tail). */
  children?: ReactNode
  /**
   * A fixed slot of this many lines (Word Song): the ribbon never grows
   * past it, and when the newest revealed word sits below the slot the
   * text slides up a line (200 ms ease-out; Reduce Motion: a jump), so
   * that word is always on the last line. Default: the ribbon grows.
   */
  maxLines?: number
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
  color = colors.ink,
  exiting,
  children,
  maxLines,
}: CaptionRibbonProps) {
  const reducedMotion = useReducedMotion()
  const words = text.split(/\s+/).filter(Boolean)
  const scroll = useLineScroll(lineKey, revealedCount, lineHeight, maxLines)
  return (
    <Animated.View
      testID={testID}
      entering={reducedMotion ? FadeIn.duration(300) : ribbonEntering}
      exiting={exiting}
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
      {children}
      <View
        style={
          maxLines !== undefined
            ? { maxHeight: maxLines * lineHeight, overflow: 'hidden' }
            : undefined
        }
      >
        <Animated.View
          testID={
            maxLines !== undefined
              ? `caption-lines-up-${scroll.linesUp}`
              : undefined
          }
          style={[styles.row, scroll.style]}
        >
          {words.map((w, i) => (
            <Word
              key={`${lineKey}-${i}`}
              word={w}
              revealed={i < revealedCount}
              fontSize={fontSize}
              lineHeight={lineHeight}
              last={i === words.length - 1}
              color={color}
              onY={
                maxLines !== undefined ? (y) => scroll.onWordY(i, y) : undefined
              }
            />
          ))}
        </Animated.View>
      </View>
    </Animated.View>
  )
}

/**
 * The fixed slot's scroll (see `maxLines`): how many lines the text has
 * slid up so the newest revealed word sits on the slot's last line, from
 * each word's laid-out y (state, per line), animated on a shared value.
 * Inert without `maxLines`.
 */
function useLineScroll(
  lineKey: string,
  revealedCount: number,
  lineHeight: number,
  maxLines: number | undefined,
) {
  const reducedMotion = useReducedMotion()
  const [laid, setLaid] = useState<{ key: string; ys: number[] }>({
    key: lineKey,
    ys: [],
  })
  const ys = laid.key === lineKey ? laid.ys : []
  const y = ys[revealedCount - 1]
  const linesUp =
    maxLines === undefined || y === undefined
      ? 0
      : Math.max(0, Math.round(y / lineHeight) - (maxLines - 1))
  const offset = useSharedValue(0)
  useEffect(() => {
    const target = -linesUp * lineHeight
    offset.set(
      reducedMotion || linesUp === 0
        ? target
        : withTiming(target, {
            duration: 200,
            easing: Easing.out(Easing.ease),
          }),
    )
  }, [linesUp, lineHeight, reducedMotion, offset])
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }],
  }))
  const onWordY = useCallback(
    (i: number, wordY: number) =>
      setLaid((prev) => {
        const base = prev.key === lineKey ? prev.ys : []
        if (base[i] === wordY && prev.key === lineKey) return prev
        const next = base.slice()
        next[i] = wordY
        return { key: lineKey, ys: next }
      }),
    [lineKey],
  )
  return { style, onWordY, linesUp }
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
  },
})
