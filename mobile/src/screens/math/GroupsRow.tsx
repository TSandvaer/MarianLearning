/**
 * Multiplication's groups (spec
 * `design/native/math-skip-counting-multiplication-native.md` § 3, § 5,
 * § 7): `factorB` plates of `factorA` flowers in one row under the
 * equation ("A times B" is B groups of A, as Emma's hint 2 says). Flowers
 * fill columns of 5, top to bottom, left column first, so 7 reads as "five
 * and two". Hidden from accessibility, like `CountingRow`.
 *
 * Each plate's tag (its group size) sits on its top edge, with a "+" in
 * the gap before it: shown from the reveal (`tagsFromReveal`, mult-2-5-10
 * and mult-6-9), else as hint 2 lights its plate (mult-3-4). A hidden tag
 * keeps its space, so nothing moves when it appears.
 *
 * - hint 1: the plates ripple left to right.
 * - hint 2: plate k lights (a pulse) on Emma's k-th spoken number
 *   (`litCount`, from her word ticks).
 * - hint 3, and the guided answer: all plates pulse together once; the
 *   guided answer shows every tag and "+".
 */
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import {
  GROUP_COLUMN,
  groupsRow,
  type GroupsMetrics,
} from '../../layout/mathLayout'
import { colors, fonts } from '../../theme'
import { FADE_MS, STAGGER_MS, useOnRise, usePulse } from './extendedMotion'
import { FlowerGlyph } from './glyphs'

const PLATE_PEAK = 1.06

export interface GroupsRowProps {
  factorA: number
  factorB: number
  metrics: GroupsMetrics
  /** The problem rect's width. */
  width: number
  /** Tags and "+" from the reveal (else from hint 2). */
  tagsFromReveal: boolean
  hintStep: 1 | 2 | 3 | null
  /** Plates lit by hint 2 so far (0..factorB). */
  litCount: number
  guided: boolean
}

function Plate({
  index,
  factorA,
  metrics,
  size,
  ripple,
  lit,
  together,
  tagShown,
  tagFades,
}: {
  index: number
  factorA: number
  metrics: GroupsMetrics
  size: { width: number; height: number }
  ripple: boolean
  lit: boolean
  together: number
  tagShown: boolean
  tagFades: boolean
}) {
  const { style, pulse } = usePulse()
  useOnRise(ripple, () => pulse(PLATE_PEAK, index * STAGGER_MS))
  useOnRise(lit, () => pulse(PLATE_PEAK))
  useOnRise(together, () => pulse(PLATE_PEAK))
  const columns: number[] = []
  for (let left = factorA; left > 0; left -= GROUP_COLUMN) {
    columns.push(Math.min(left, GROUP_COLUMN))
  }
  const { flower, flowerGap, pad, border, radius, tagHeight, tagFont } = metrics
  return (
    <Animated.View
      testID={`math-group-plate-${index}${lit ? '-lit' : ''}`}
      style={[
        styles.plate,
        {
          width: size.width,
          height: size.height,
          borderRadius: radius,
          borderWidth: border,
          padding: pad - border,
          gap: flowerGap,
        },
        style,
      ]}
    >
      {columns.map((count, c) => (
        <View key={c} style={{ gap: flowerGap }}>
          {Array.from({ length: count }, (_, i) => (
            <FlowerGlyph key={i} size={flower} />
          ))}
        </View>
      ))}
      <View
        style={[
          styles.tagBox,
          { top: -tagHeight / 2 - border, height: tagHeight },
        ]}
      >
        {tagShown && (
          <Animated.View
            testID={`math-group-tag-${index}`}
            entering={tagFades ? FadeIn.duration(FADE_MS) : undefined}
            style={[
              styles.tag,
              {
                height: tagHeight,
                minWidth: tagHeight,
                borderRadius: tagHeight / 2,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.tagText,
                { fontSize: tagFont, lineHeight: tagFont * 1.2 },
              ]}
            >
              {factorA}
            </Text>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  )
}

export function GroupsRow({
  factorA,
  factorB,
  metrics,
  width,
  tagsFromReveal,
  hintStep,
  litCount,
  guided,
}: GroupsRowProps) {
  const row = groupsRow(metrics, factorA, factorB, width)
  const step = hintStep ?? 0
  const together = (step >= 3 ? 1 : 0) + (guided ? 1 : 0)
  const tagShown = (k: number) => tagsFromReveal || guided || k < litCount
  return (
    <View
      testID="math-groups"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.slot,
        { height: metrics.slot, paddingTop: metrics.tagHeight / 2 },
      ]}
    >
      <View style={styles.row}>
        {Array.from({ length: factorB }, (_, k) => (
          <View key={k} style={styles.row}>
            {k > 0 && (
              <View
                style={[
                  styles.plusBox,
                  { width: row.gap, height: row.plate.height },
                ]}
              >
                {tagShown(k) && (
                  <Animated.Text
                    testID={`math-group-plus-${k}`}
                    entering={
                      tagsFromReveal ? undefined : FadeIn.duration(FADE_MS)
                    }
                    allowFontScaling={false}
                    style={[
                      styles.plus,
                      {
                        fontSize: metrics.plusFont,
                        lineHeight: metrics.plusFont * 1.2,
                      },
                    ]}
                  >
                    +
                  </Animated.Text>
                )}
              </View>
            )}
            <Plate
              index={k}
              factorA={factorA}
              metrics={metrics}
              size={row.plate}
              ripple={step >= 1}
              lit={k < litCount}
              together={together}
              tagShown={tagShown(k)}
              tagFades={!tagsFromReveal}
            />
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  slot: { alignSelf: 'stretch', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  plate: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderColor: colors.myPink,
  },
  tagBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tag: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.myPink,
  },
  tagText: { fontFamily: fonts.bold, color: colors.ink },
  plusBox: { alignItems: 'center', justifyContent: 'center' },
  plus: { fontFamily: fonts.semibold, color: colors.ink },
})
