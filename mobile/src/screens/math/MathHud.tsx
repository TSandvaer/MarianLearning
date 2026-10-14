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
 *
 * Word Song wears the same HUD (the web's is a local copy of Math's), with
 * its own test IDs and a 400 ms / 1.3 pop: `world={WORD_SONG_HUD}`.
 *
 * Native (spec `design/native/review-mode-and-warmup-native.md` § 3.2): a
 * review's track opens with Session End's static moon (bead-current size),
 * one gap before bead 1; a warm-up's first beads are hearts (same sizes,
 * states, fills and 200 ms ease as the circle beads), then a double gap.
 * In phone landscape a track too wide for the pane's row next to the
 * status cluster closes its gaps to 4 pt (`../../layout/beadTrack.ts`).
 */
import {
  STREAK_BONUS_THRESHOLDS,
  STREAK_FADE_OUT_MS,
} from '@marian/core/shared/gameplayConstants'
import { createContext, useContext, useEffect } from 'react'
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
import Svg, { Path } from 'react-native-svg'
import { trackBeadGap } from '../../layout/beadTrack'
import type { HudLayout, HudMetrics } from '../../layout/mathLayout'
import { colors, fonts } from '../../theme'
import { MoonIcon } from '../sessionEnd/glyphs'
import { BackChevron, SparkleGlyph } from './glyphs'
import { MATH_HUD, type HudWorld } from './hudWorld'

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)

const World = createContext<HudWorld>(MATH_HUD)

const BACK_BG =
  'radial-gradient(circle at 40% 32%, #e7b07a 0%, #c98a55 55%, #a86c3c 100%)'
const BACK_SHADOW =
  'inset 0 4px 0 rgba(255, 255, 255, 0.3), inset 0 -5px 0 rgba(0, 0, 0, 0.16), 0 7px 0 #7d4a26, 0 12px 16px rgba(60, 30, 10, 0.28)'
const BACK_SHADOW_PRESSED =
  'inset 0 4px 0 rgba(255, 255, 255, 0.3), 0 2px 0 #7d4a26, 0 4px 8px rgba(60, 30, 10, 0.28)'

function BackButton({ size, onPress }: { size: number; onPress: () => void }) {
  const { idPrefix } = useContext(World)
  return (
    <Pressable
      testID={`${idPrefix}-back-to-hub`}
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

/** A value that pops `[1, peak, 1]` when `trigger` changes while `active`. */
function usePop(trigger: number, active: boolean) {
  const reducedMotion = useReducedMotion()
  const { popMs, popScale } = useContext(World)
  const scale = useSharedValue(1)
  useEffect(() => {
    if (!active || reducedMotion) return
    const half = { duration: popMs / 2, easing: EASE_OUT }
    scale.set(withSequence(withTiming(popScale, half), withTiming(1, half)))
  }, [trigger, active, reducedMotion, scale, popMs, popScale])
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
  const { idPrefix } = useContext(World)
  return (
    <View
      testID={`${idPrefix}-stardust`}
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
  const { idPrefix } = useContext(World)
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
      testID={`${idPrefix}-problem-dot-${state}`}
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

/** § 3.2's heart, viewBox 24, stroke 1.5. */
const HEART_PATH =
  'M12 21.2C12 21.2 2.5 15.4 2.5 9.1C2.5 6.1 4.9 3.8 7.8 3.8C9.6 3.8 11.1 4.7 12 6.1C12.9 4.7 14.4 3.8 16.2 3.8C19.1 3.8 21.5 6.1 21.5 9.1C21.5 15.4 12 21.2 12 21.2Z'

/** Fill / stroke per state: the circle beads' fills. */
const HEART_LOOK: Record<BeadState, { fill: string; stroke: string }> = {
  upcoming: { fill: '#e6d2c0', stroke: '#cdb39d' },
  current: { fill: '#ff8fb1', stroke: '#c2456f' },
  completed: { fill: '#ffd54a', stroke: '#c98a1f' },
}

/** A warm-up bead: the heart, in the circle bead's box and ease. */
function HeartBead({ state, m }: { state: BeadState; m: HudMetrics }) {
  const { idPrefix } = useContext(World)
  const size = useSharedValue(m.bead[state])
  useEffect(() => {
    size.set(withTiming(m.bead[state], { duration: 200, easing: EASE_OUT }))
  }, [state, m, size])
  const style = useAnimatedStyle(() => ({
    width: size.get(),
    height: size.get(),
  }))
  const look = HEART_LOOK[state]
  return (
    <Animated.View testID={`${idPrefix}-warmup-dot-${state}`} style={style}>
      <Svg width="100%" height="100%" viewBox="0 0 24 24">
        <Path
          d={HEART_PATH}
          fill={look.fill}
          stroke={look.stroke}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  )
}

const stateOf = (i: number, index: number): BeadState =>
  i < index ? 'completed' : i === index ? 'current' : 'upcoming'

function Beads({
  count,
  index,
  m,
  warmups,
  review,
  gap,
}: {
  count: number
  index: number
  m: HudMetrics
  /** The first `warmups` beads are hearts. */
  warmups: number
  review: boolean
  gap: number
}) {
  const { idPrefix } = useContext(World)
  const hearts = Math.min(warmups, count)
  return (
    <View
      testID={`${idPrefix}-problem-dots`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.track,
        {
          height: m.trackHeight,
          paddingHorizontal: m.trackPadX,
          gap,
        },
      ]}
    >
      {review && (
        <View testID={`${idPrefix}-review-moon`}>
          <MoonIcon size={m.bead.current} />
        </View>
      )}
      {Array.from({ length: hearts }, (_, i) => (
        <HeartBead key={`h${i}`} m={m} state={stateOf(i, index)} />
      ))}
      {/* A zero-width spacer: the gap after the last heart is 2 × gap. */}
      {hearts > 0 && hearts < count && <View style={styles.spacer} />}
      {Array.from({ length: count - hearts }, (_, i) => (
        <Bead key={i} m={m} state={stateOf(hearts + i, index)} />
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
  const { idPrefix, popMs, popScale } = useContext(World)
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
    opacity.set(withTiming(1, { duration: popMs, easing: EASE_OUT }))
    scale.set(withTiming(1, { duration: popMs, easing: EASE_OUT }))
  }, [fadingOut, opacity, scale, popMs])

  useEffect(() => {
    if (!celebrating || !bonus || reducedMotion || fadingOut) return
    const half = { duration: popMs / 2, easing: EASE_OUT }
    scale.set(withSequence(withTiming(popScale, half), withTiming(1, half)))
  }, [
    celebrating,
    bonus,
    streak,
    reducedMotion,
    fadingOut,
    scale,
    popMs,
    popScale,
  ])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }))
  return (
    // The exit fade sits on a wrapper: Reanimated warns when a layout
    // animation and an animated style both drive the same opacity.
    <Animated.View exiting={FadeOut.duration(150)}>
      <Animated.View
        testID={`${idPrefix}-streak`}
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
  /** The world's test IDs and pop (default Math's). */
  world?: HudWorld
  /** A same-day review: the moon leads the track (§ 3.2). */
  review?: boolean
  /** The first `warmupCount` of the `problemCount` beads are hearts. */
  warmupCount?: number
}

export function MathHud({ world = MATH_HUD, ...props }: MathHudProps) {
  return (
    <World.Provider value={world}>
      <HudBody {...props} />
    </World.Provider>
  )
}

function HudBody({
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
  review = false,
  warmupCount = 0,
}: Omit<MathHudProps, 'world'>) {
  const hudId = `${useContext(World).idPrefix}-hud`
  const gap = trackBeadGap(m, hud, landscape, {
    scored: problemCount - warmupCount,
    warmups: warmupCount,
    review,
  })
  const streakEl = showStreak ? (
    <Streak
      streak={streak}
      fadingOut={streakFadingOut}
      celebrating={celebrating}
      m={m}
    />
  ) : null
  const pill = <StardustPill total={stardust} celebrating={celebrating} m={m} />
  const beads = (
    <Beads
      count={problemCount}
      index={problemIndex}
      m={m}
      warmups={warmupCount}
      review={review}
      gap={gap}
    />
  )

  if (hud.kind === 'row') {
    const { rect, padX } = hud
    return (
      <View
        testID={hudId}
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
        testID={hudId}
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
  spacer: { width: 0, height: 1 },
  streakText: { fontFamily: fonts.semibold, color: colors.myRose },
})
