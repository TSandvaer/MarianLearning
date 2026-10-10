/**
 * Math's HUD, in the web's clay (`src/index.css` `.clay-round-btn`,
 * `.clay-pill`, `.clay-track`, `.clay-bead`):
 * - the back disc (to the Hub);
 * - the stardust pill: the all-time total, its sparkle pops
 *   `[1, 1.25, 1]` over 250 ms on every grant;
 * - the 8 problem beads: upcoming (small, recessed), completed (gold),
 *   current (pink, largest); size changes ease over 200 ms;
 * - the streak (sparkle + count, rose) from 2 clean wins in a row: in
 *   over 250 ms, a pop on 3 / 5 / 8, a 400 ms fade when it breaks.
 *
 * Tablet: the web's one row (back, stardust, beads, streak, spaced
 * between). Phone (spec § 4): back on its own; streak then stardust
 * right-aligned; the beads on their own row (portrait) or at the left of
 * the pane's HUD row (landscape). Nothing here is a target except back.
 */
import {
  STREAK_BONUS_THRESHOLDS,
  STREAK_FADE_OUT_MS,
} from '@marian/core/shared/gameplayConstants'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import type { HudLayout, HudMetrics } from '../../layout/mathLayout'
import { colors, fonts } from '../../theme'
import { BackChevron, SparkleGlyph } from './glyphs'

/** Web `HUD_POP_TWEEN`: 250 ms ease-out. */
const POP_MS = 250
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)

const BACK_BG =
  'radial-gradient(circle at 40% 32%, #e7b07a 0%, #c98a55 55%, #a86c3c 100%)'
const BACK_SHADOW =
  'inset 0 4px 0 rgba(255, 255, 255, 0.3), inset 0 -5px 0 rgba(0, 0, 0, 0.16), 0 7px 0 #7d4a26, 0 12px 16px rgba(60, 30, 10, 0.28)'
const BACK_SHADOW_PRESSED =
  'inset 0 4px 0 rgba(255, 255, 255, 0.3), 0 2px 0 #7d4a26, 0 4px 8px rgba(60, 30, 10, 0.28)'

function BackButton({ size, onPress }: { size: number; onPress: () => void }) {
  return (
    <Pressable
      testID="math-back-to-hub"
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      style={({ pressed }) => [
        styles.back,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          boxShadow: pressed ? BACK_SHADOW_PRESSED : BACK_SHADOW,
          transform: [{ translateY: pressed ? 5 : 0 }],
        },
      ]}
    >
      {/* Web: a 32 px chevron on the 56pt (74.67 px) disc. */}
      <BackChevron size={Math.round((size * 32) / 74.67)} />
    </Pressable>
  )
}

/** A value that pops `[1, 1.25, 1]` when `trigger` changes while `active`. */
function usePop(trigger: number, active: boolean) {
  const reducedMotion = useReducedMotion()
  const scale = useSharedValue(1)
  useEffect(() => {
    if (!active || reducedMotion) return
    const half = { duration: POP_MS / 2, easing: EASE_OUT }
    scale.set(withSequence(withTiming(1.25, half), withTiming(1, half)))
  }, [trigger, active, reducedMotion, scale])
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))
}

function StardustPill({
  total,
  celebrating,
  m,
}: {
  total: number
  celebrating: boolean
  m: HudMetrics
}) {
  const pop = usePop(total, celebrating)
  return (
    <View
      testID="math-stardust"
      accessible
      accessibilityLabel={`Stardust: ${total}`}
      style={[
        styles.pill,
        {
          height: m.pillHeight,
          paddingLeft: m.pillPadLeft,
          paddingRight: m.pillPadRight,
          gap: m.pillGap,
        },
      ]}
    >
      <Animated.View style={pop}>
        <SparkleGlyph size={m.pillFont} />
      </Animated.View>
      <Text
        allowFontScaling={false}
        style={[
          styles.pillText,
          { fontSize: m.pillFont, lineHeight: m.pillFont * 1.2 },
        ]}
      >
        {total}
      </Text>
    </View>
  )
}

type BeadState = 'completed' | 'current' | 'upcoming'

function Bead({ state, m }: { state: BeadState; m: HudMetrics }) {
  const size = useSharedValue(m.bead[state])
  useEffect(() => {
    size.set(withTiming(m.bead[state], { duration: 200, easing: EASE_OUT }))
  }, [state, m, size])
  const style = useAnimatedStyle(() => ({
    width: size.get(),
    height: size.get(),
    borderRadius: size.get() / 2,
  }))
  return (
    <Animated.View
      testID={`math-problem-dot-${state}`}
      style={[BEAD_LOOK[state], style]}
    />
  )
}

const BEAD_LOOK: Record<BeadState, ViewStyle> = {
  upcoming: {
    backgroundColor: '#e6d2c0',
    boxShadow: 'inset 0 3px 3px rgba(120, 70, 40, 0.28)',
  },
  completed: {
    backgroundColor: '#ffd54a',
    experimental_backgroundImage:
      'radial-gradient(circle at 40% 32%, #fff1a6 0%, #ffd54a 50%, #f2b42a 100%)',
    boxShadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.6), 0 3px 0 #c98a1f',
  },
  current: {
    backgroundColor: '#ff8fb1',
    experimental_backgroundImage:
      'radial-gradient(circle at 40% 32%, #ffd3e2 0%, #ff8fb1 55%, #f06c98 100%)',
    boxShadow:
      'inset 0 2px 0 rgba(255, 255, 255, 0.6), 0 2px 0 #c2456f, 0 3px 4px rgba(150, 40, 80, 0.25)',
  },
}

function Beads({
  count,
  index,
  m,
}: {
  count: number
  index: number
  m: HudMetrics
}) {
  return (
    <View
      testID="math-problem-dots"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.track,
        {
          height: m.trackHeight,
          paddingHorizontal: m.trackPadX,
          gap: m.beadGap,
        },
      ]}
    >
      {Array.from({ length: count }, (_, i) => (
        <Bead
          key={i}
          m={m}
          state={i < index ? 'completed' : i === index ? 'current' : 'upcoming'}
        />
      ))}
    </View>
  )
}

function Streak({
  streak,
  fadingOut,
  celebrating,
  m,
}: {
  streak: number
  fadingOut: boolean
  celebrating: boolean
  m: HudMetrics
}) {
  const reducedMotion = useReducedMotion()
  const opacity = useSharedValue(0)
  const scale = useSharedValue(reducedMotion ? 1 : 0.9)
  const bonus = (STREAK_BONUS_THRESHOLDS as readonly number[]).includes(streak)

  useEffect(() => {
    if (fadingOut) {
      opacity.set(
        withTiming(0, { duration: STREAK_FADE_OUT_MS, easing: EASE_OUT }),
      )
      return
    }
    opacity.set(withTiming(1, { duration: POP_MS, easing: EASE_OUT }))
    scale.set(withTiming(1, { duration: POP_MS, easing: EASE_OUT }))
  }, [fadingOut, opacity, scale])

  useEffect(() => {
    if (!celebrating || !bonus || reducedMotion || fadingOut) return
    const half = { duration: POP_MS / 2, easing: EASE_OUT }
    scale.set(withSequence(withTiming(1.25, half), withTiming(1, half)))
  }, [celebrating, bonus, streak, reducedMotion, fadingOut, scale])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }))
  return (
    // The exit fade sits on a wrapper: Reanimated warns when a layout
    // animation and an animated style both drive the same opacity.
    <Animated.View exiting={FadeOut.duration(150)}>
      <Animated.View
        testID="math-streak"
        accessible
        accessibilityLabel={`Streak: ${streak}`}
        style={[styles.streak, style]}
      >
        <SparkleGlyph size={m.streakFont} />
        <Text
          allowFontScaling={false}
          style={[
            styles.streakText,
            { fontSize: m.streakFont, lineHeight: m.streakFont * 1.2 },
          ]}
        >
          {streak}
        </Text>
      </Animated.View>
    </Animated.View>
  )
}

export interface MathHudProps {
  hud: HudLayout
  /** Phone landscape: the beads lead the pane's HUD row. */
  landscape: boolean
  metrics: HudMetrics
  problemCount: number
  problemIndex: number
  stardust: number
  streak: number
  showStreak: boolean
  streakFadingOut: boolean
  celebrating: boolean
  onBack: () => void
}

export function MathHud({
  hud,
  landscape,
  metrics: m,
  problemCount,
  problemIndex,
  stardust,
  streak,
  showStreak,
  streakFadingOut,
  celebrating,
  onBack,
}: MathHudProps) {
  const streakEl = showStreak ? (
    <Streak
      streak={streak}
      fadingOut={streakFadingOut}
      celebrating={celebrating}
      m={m}
    />
  ) : null
  const pill = <StardustPill total={stardust} celebrating={celebrating} m={m} />
  const beads = <Beads count={problemCount} index={problemIndex} m={m} />

  if (hud.kind === 'row') {
    const { rect, padX } = hud
    return (
      <View
        testID="math-hud"
        style={[
          styles.row,
          {
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            paddingHorizontal: padX,
          },
        ]}
      >
        <BackButton size={m.back} onPress={onBack} />
        {pill}
        {beads}
        {/* Web `flex h-8 w-20 items-center justify-end`. */}
        <View style={styles.streakBox}>{streakEl}</View>
      </View>
    )
  }

  return (
    <>
      <View
        style={[
          styles.abs,
          {
            left: hud.back.x,
            top: hud.back.y,
            width: hud.back.width,
            height: hud.back.height,
          },
        ]}
      >
        <BackButton size={m.back} onPress={onBack} />
      </View>
      <View
        testID="math-hud"
        style={[
          styles.abs,
          styles.beadsRow,
          {
            left: hud.beads.x,
            top: hud.beads.y,
            width: hud.beads.width,
            height: hud.beads.height,
            justifyContent: landscape ? 'flex-start' : 'center',
          },
        ]}
      >
        {beads}
      </View>
      <View
        style={[
          styles.abs,
          styles.status,
          {
            left: hud.status.x,
            top: hud.status.y,
            width: hud.status.width,
            height: hud.status.height,
            gap: 12,
          },
        ]}
      >
        {streakEl}
        {pill}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  row: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  beadsRow: { flexDirection: 'row', alignItems: 'center' },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  back: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c98a55',
    experimental_backgroundImage: BACK_BG,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    backgroundColor: '#b8784a',
    experimental_backgroundImage: 'linear-gradient(#c98a55, #a8683a)',
    boxShadow:
      'inset 0 3px 0 rgba(255, 255, 255, 0.28), inset 0 -5px 0 rgba(0, 0, 0, 0.15), 0 6px 0 #7d4a26, 0 10px 14px rgba(60, 30, 10, 0.22)',
  },
  pillText: {
    fontFamily: fonts.bold,
    color: colors.white,
    textShadowColor: 'rgba(90, 45, 15, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    backgroundColor: '#f6eadc',
    experimental_backgroundImage: 'linear-gradient(#f3e3d3, #fbf1e6)',
    boxShadow:
      'inset 0 4px 6px rgba(120, 70, 40, 0.22), inset 0 -2px 0 rgba(255, 255, 255, 0.9), 0 3px 0 rgba(255, 255, 255, 0.95)',
  },
  streakBox: {
    width: 80,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { fontFamily: fonts.semibold, color: colors.myRose },
})
