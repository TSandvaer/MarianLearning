/**
 * A digraph critter's pair (`design/native/critters-digraph.md` § 2.2, § 3):
 * its two letters as one text run, centred by their advance, and one short
 * round-ended bar under them in the letters' ink. The critter (`Critter`,
 * `LetterCritters.tsx`) and the tile (`Tile`, `HuntBoard.tsx`) draw it at
 * their own size and baseline; nothing else differs. Measured in
 * `pairInk.ts`.
 */
import type { HuntDigraph } from '@marian/core/games/playPlace'
import { StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'
import { fonts } from '../../theme'
import { FREDOKA_ASCENT, FREDOKA_LINE, pairBar } from './pairInk'

const LETTER = '#6b3f1f'

/**
 * The pair drawn into a box `side` wide: its letters at `f` on `baseline`,
 * and its bar. One group, so the lit pulse (`groupStyle`, about the
 * pair's baseline centre) moves letters and bar as one mark (Decision 5);
 * the singing light (`textStyle`) is on the letters only, the bar keeps
 * its ink.
 */
export function CritterPair({
  pair,
  side,
  f,
  baseline,
  textStyle,
  groupStyle,
  barTestID,
}: {
  pair: HuntDigraph
  side: number
  f: number
  baseline: number
  textStyle?: AnimatedStyle<TextStyle>
  groupStyle?: AnimatedStyle<ViewStyle>
  barTestID?: string
}) {
  const bar = pairBar(pair, f, baseline, side / 2)
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.fill,
        { transformOrigin: [side / 2, baseline, 0] },
        groupStyle,
      ]}
    >
      <Animated.Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          styles.pair,
          {
            top: baseline - FREDOKA_ASCENT * f,
            width: side,
            fontSize: f,
            lineHeight: FREDOKA_LINE * f,
          },
          textStyle,
        ]}
      >
        {pair}
      </Animated.Text>
      <View
        testID={barTestID}
        style={[
          styles.bar,
          {
            left: bar.x,
            top: bar.y,
            width: bar.width,
            height: bar.height,
            borderRadius: bar.height / 2,
          },
        ]}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  pair: {
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    fontFamily: fonts.bold,
    color: LETTER,
    textShadowColor: '#ffffff',
  },
  bar: { position: 'absolute', backgroundColor: LETTER },
})
