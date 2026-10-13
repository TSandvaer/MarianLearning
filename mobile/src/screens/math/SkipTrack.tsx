/**
 * Skip counting's stepping stones (spec
 * `design/native/math-skip-counting-multiplication-native.md` § 2, § 5, § 7):
 * every term Emma reads on a stone, then a "?" stone. It takes the place of
 * `math-symbolic` and is centred in the problem rect. Flat (no clay), so
 * the stones never read as chips; nothing here is tappable.
 *
 * - hint 1: the stones ripple left to right.
 * - hint 2: the "+step" hops between the given stones fade in one by one.
 * - hint 3: the last stone and "?" pulse together; the dashed last hop
 *   draws in.
 * - guided answer: every hop shows; "?" gets a 4 pt rose ring.
 * - correct: "?" becomes the answer; the last hop turns solid.
 *
 * Every hop stays until the problem ends (Math remounts the track per
 * problem).
 */
import type { SkipCountProblem } from '@marian/core/math/extendedProblems'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import {
  skipTrackCellCount,
  skipTrackGeometry,
  SKIP_MAX_TERMS,
  type SkipTrackCell,
  type SkipTrackMetrics,
} from '../../layout/mathLayout'
import { colors, fonts } from '../../theme'
import {
  EASE_OUT,
  FADE_MS,
  GAP_OUT_MS,
  STAGGER_MS,
  useFade,
  useOnRise,
  usePulse,
  useSpringIn,
} from './extendedMotion'

export interface SkipTrackProps {
  problem: SkipCountProblem
  metrics: SkipTrackMetrics
  /** The hint line playing or played (1 / 2 / 3); `null` before hint 1. */
  hintStep: 1 | 2 | 3 | null
  /** The guided answer is on. */
  guided: boolean
  /** The answer was tapped. */
  answered: boolean
}

/** A hop's arc and arrowhead, from (x0, y) to (x1, y), apex `apex` above. */
function hopPath(
  x0: number,
  x1: number,
  y: number,
  apex: number,
  arrow: number,
) {
  const xm = (x0 + x1) / 2
  // A quadratic's apex sits halfway to its control point.
  const cy = y - 2 * apex
  const arc = `M ${x0} ${y} Q ${xm} ${cy} ${x1} ${y}`
  // The arrowhead: two strokes back along the end tangent, ±30°.
  const dx = x1 - xm
  const dy = y - cy
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const wing = (angle: number) => {
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    return [x1 - arrow * (ux * c - uy * s), y - arrow * (ux * s + uy * c)]
  }
  const [ax, ay] = wing(Math.PI / 6)
  const [bx, by] = wing(-Math.PI / 6)
  return { arc, head: `M ${ax} ${ay} L ${x1} ${y} L ${bx} ${by}`, xm }
}

function Hop({
  from,
  to,
  wrap,
  metrics,
  step,
  last,
  dashed,
  delayMs,
  width,
  height,
  index,
}: {
  from: SkipTrackCell
  to: SkipTrackCell
  wrap: boolean
  metrics: SkipTrackMetrics
  step: number
  last: boolean
  dashed: boolean
  delayMs: number
  width: number
  height: number
  index: number
}) {
  const reducedMotion = useReducedMotion()
  const {
    stone: d,
    gap: g,
    hopApex,
    hopStroke,
    hopArrow,
    hopLabelFont,
  } = metrics
  // A wrap hop starts on a virtual stone one column left of row 2's first.
  const fromX = wrap ? to.x - (d + g) : from.x
  const x0 = fromX + 0.75 * d
  const x1 = to.x + 0.25 * d
  const { arc, head, xm } = hopPath(x0, x1, to.y, hopApex, hopArrow)
  const labelScale = useSharedValue(reducedMotion ? 1 : 0.8)
  useEffect(() => {
    labelScale.set(
      withDelay(
        delayMs,
        withTiming(1, { duration: FADE_MS, easing: EASE_OUT }),
      ),
    )
  }, [delayMs, labelScale])
  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: labelScale.get() }],
  }))
  const label = `+${step}`
  const labelTop = to.y - hopApex - 2 - hopLabelFont
  return (
    <Animated.View
      testID={last ? 'math-skip-hop-last' : `math-skip-hop-${index}`}
      entering={FadeIn.duration(FADE_MS).delay(delayMs)}
      style={[styles.fill, { width, height }]}
    >
      <Svg width={width} height={height} style={styles.fill}>
        <Path
          d={arc}
          stroke={colors.myRose}
          strokeWidth={hopStroke}
          strokeLinecap="round"
          strokeDasharray={dashed ? '6 4' : undefined}
          fill="none"
        />
        <Path
          d={head}
          stroke={colors.myRose}
          strokeWidth={hopStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      <Animated.View
        style={[
          styles.hopLabelBox,
          { left: xm - 40, top: labelTop, height: hopLabelFont },
          labelStyle,
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[
            styles.hopLabel,
            { fontSize: hopLabelFont, lineHeight: hopLabelFont },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Animated.View>
  )
}

function Stone({
  cell,
  value,
  metrics,
  rippleDelay,
  ripple,
  together,
}: {
  cell: SkipTrackCell
  value: number
  metrics: SkipTrackMetrics
  rippleDelay: number
  ripple: boolean
  together: boolean
}) {
  const { stone: d, numeralFont } = metrics
  const { style, pulse } = usePulse()
  useOnRise(ripple, () => pulse(1.1, rippleDelay))
  useOnRise(together, () => pulse(1.1))
  return (
    <Animated.View
      testID={`math-skip-stone-${value}`}
      style={[
        styles.stone,
        styles.given,
        {
          left: cell.x,
          top: cell.y,
          width: d,
          height: d,
          borderRadius: d / 2,
        },
        style,
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[
          styles.numeral,
          { fontSize: numeralFont, lineHeight: numeralFont * 1.2 },
        ]}
      >
        {value}
      </Text>
    </Animated.View>
  )
}

function GapStone({
  cell,
  answer,
  metrics,
  rippleDelay,
  ripple,
  together,
  guided,
  answered,
}: {
  cell: SkipTrackCell
  answer: number
  metrics: SkipTrackMetrics
  rippleDelay: number
  ripple: boolean
  together: boolean
  guided: boolean
  answered: boolean
}) {
  const { stone: d, numeralFont } = metrics
  const { style, pulse } = usePulse()
  useOnRise(ripple, () => pulse(1.1, rippleDelay))
  useOnRise(together, () => pulse(1.1))
  const questionStyle = useFade(!answered, GAP_OUT_MS)
  const answerStyle = useSpringIn(answered, { delayMs: GAP_OUT_MS })
  const ringStyle = useFade(guided)
  // Flush outside the stone, as the guided chip's glow ring: positioned from
  // the padding box (inside the 3 pt border), so 3 + 4 out.
  const ringInset = -7
  const lineHeight = numeralFont * 1.2
  const overlayTop = (d - 6 - lineHeight) / 2
  return (
    <Animated.View
      testID={answered ? 'math-skip-gap-answered' : 'math-skip-gap'}
      style={[
        styles.stone,
        styles.gap,
        {
          left: cell.x,
          top: cell.y,
          width: d,
          height: d,
          borderRadius: d / 2,
          borderStyle: answered ? 'solid' : 'dashed',
        },
        style,
      ]}
    >
      <Animated.View
        testID={guided ? 'math-skip-gap-ring' : undefined}
        style={[
          styles.ring,
          {
            left: ringInset,
            top: ringInset,
            right: ringInset,
            bottom: ringInset,
            borderRadius: d / 2 + 4,
          },
          ringStyle,
        ]}
      />
      <Animated.Text
        allowFontScaling={false}
        style={[
          styles.numeral,
          styles.question,
          styles.overlay,
          { fontSize: numeralFont, lineHeight, top: overlayTop },
          questionStyle,
        ]}
      >
        ?
      </Animated.Text>
      <Animated.Text
        allowFontScaling={false}
        style={[
          styles.numeral,
          styles.overlay,
          { fontSize: numeralFont, lineHeight, top: overlayTop },
          answerStyle,
        ]}
      >
        {answer}
      </Animated.Text>
    </Animated.View>
  )
}

export function SkipTrack({
  problem,
  metrics,
  hintStep,
  guided,
  answered,
}: SkipTrackProps) {
  const terms = problem.sequence.slice(-SKIP_MAX_TERMS)
  const cellCount = skipTrackCellCount(problem.sequence.length)
  const geometry = skipTrackGeometry(metrics, cellCount)
  const { cells, width, height } = geometry
  const step = hintStep ?? 0
  const ripple = step >= 1
  const lastTogether = step >= 3
  // Hops between the given stones: from hint 2 (one by one) or the guided
  // answer (at once, when hint 2 never played).
  const givenHops = step >= 2 || guided
  const staggered = step >= 2
  // The last hop (last term → "?"): from hint 3 or the guided answer.
  const lastHop = step >= 3 || guided
  const gapCell = cells[cellCount - 1]!
  return (
    <View
      testID="math-skip-track"
      accessible
      accessibilityLabel={problem.utterances.read}
      pointerEvents="none"
      style={{ width, height }}
    >
      {givenHops &&
        terms.slice(1).map((_, i) => {
          const k = i + 1
          return (
            <Hop
              key={`hop-${k}`}
              index={k}
              from={cells[k - 1]!}
              to={cells[k]!}
              wrap={cells[k]!.row !== cells[k - 1]!.row}
              metrics={metrics}
              step={problem.step}
              last={false}
              dashed={false}
              delayMs={staggered ? i * STAGGER_MS : 0}
              width={width}
              height={height}
            />
          )
        })}
      {lastHop && (
        <Hop
          key="hop-last"
          index={cellCount - 1}
          from={cells[cellCount - 2]!}
          to={gapCell}
          wrap={gapCell.row !== cells[cellCount - 2]!.row}
          metrics={metrics}
          step={problem.step}
          last
          dashed={!answered}
          delayMs={0}
          width={width}
          height={height}
        />
      )}
      {terms.map((value, i) => (
        <Stone
          key={`stone-${i}`}
          cell={cells[i]!}
          value={value}
          metrics={metrics}
          rippleDelay={i * STAGGER_MS}
          ripple={ripple}
          together={lastTogether && i === terms.length - 1}
        />
      ))}
      <GapStone
        cell={gapCell}
        answer={problem.correct}
        metrics={metrics}
        rippleDelay={(cellCount - 1) * STAGGER_MS}
        ripple={ripple}
        together={lastTogether}
        guided={guided}
        answered={answered}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0 },
  stone: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  given: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.myPink,
  },
  gap: {
    backgroundColor: colors.myCream,
    borderWidth: 3,
    borderColor: colors.myRose,
  },
  ring: {
    position: 'absolute',
    borderWidth: 4,
    borderColor: colors.myRose,
  },
  numeral: { fontFamily: fonts.bold, color: colors.ink, textAlign: 'center' },
  question: { color: colors.myRose },
  overlay: { position: 'absolute', left: 0, right: 0 },
  hopLabelBox: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hopLabel: { fontFamily: fonts.bold, color: colors.ink },
})
