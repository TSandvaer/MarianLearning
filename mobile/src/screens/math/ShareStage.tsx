/**
 * Sharing's stage (content wave 2, `design/native/content-wave-2.md`
 * § 2.2–§ 2.5): a pile of T flowers on a cream cloth with a "T" tag, and B
 * empty plates with "?" tags. There is no equation and no division sign
 * (K2, D3). Hidden from accessibility but for its label, the read line.
 *
 * The deal: flower k leaves the pile's last occupied cell for plate
 * `k mod B` (`shareDeal.ts`). Each flower has one `Flight`, run on the UI
 * thread with `withDelay`; this component only decides, per command, which
 * flowers fly and when:
 *
 * - `autoDeal` (P1–P3, Math raises it 300 ms after the read): the whole
 *   pile, on the normal schedule.
 * - hint 1: the flowers ripple in deal order (60 ms apart), wherever they are.
 * - hint 2: undealt → one round (one per plate, 300 ms apart); dealt → the
 *   plates light one by one.
 * - hint 3: the rest of the pile, on the normal schedule; dealt → the
 *   plates pulse together.
 * - the given answer (`guided`): every flower left lands at once; every
 *   "?" tag gets the guided chip's rose ring.
 * - a right answer (`answered`): every flower left is dealt fast; after the
 *   last landing the "?" tags fill with the share (80 ms apart) and the
 *   plates pulse together once.
 * - the read: on the word that is T the total tag pulses; on the word that
 *   is B the plates ripple left to right.
 *
 * Reduce Motion: no travel and no scale; a pile flower fades out as its
 * cell fades in, the tags crossfade (§ 2.5 brackets). Rotation mid-deal:
 * every flower already launched lands at once, the rest keep their schedule
 * in the new layout. The deal is silent (no new sounds).
 */
import { wordToNumber } from '@marian/core/math/planFromServer'
import type { DivideProblem } from '@marian/core/math/extendedProblems'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import {
  fredokaBoldWidth,
  shareGeometry,
  type ShareMetrics,
  type SharePoint,
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
import { FlowerGlyph } from './glyphs'
import {
  CROSSFADE_MS,
  deal,
  dealOrder,
  emptyPlan,
  FLOWER_RIPPLE_STAGGER_MS,
  LAND_PEAK,
  LAND_SPRING,
  LAND_UP_MS,
  msUntilLanded,
  TAG_FILL_STAGGER_MS,
  undealt,
  type DealMode,
  type Flight,
  type FlightPlan,
} from './shareDeal'

/** Plates and flowers pulse 1 → 1.06 → 1 (multiply's); the total tag 1.1. */
const PULSE_PEAK = 1.06
const TOTAL_PEAK = 1.1

/** Monotonic ms (RN provides `performance`; its typings do not declare it). */
const clock = (): number =>
  (globalThis as { performance?: { now(): number } }).performance?.now() ??
  Date.now()

export interface ShareStageProps {
  problem: DivideProblem
  metrics: ShareMetrics
  /** The problem rect's width (the block is centred in it). */
  width: number
  /** Words of the read revealed so far (its word ticks). */
  readRevealed: number
  /** P1–P3's own deal: Math raises it 300 ms after the read ends. */
  autoDeal: boolean
  hintStep: 1 | 2 | 3 | null
  guided: boolean
  answered: boolean
  /** The auto-deal sent flowers: the ms until the last one lands. */
  onAutoDeal?: (ms: number) => void
  /** Test seam: the clock. */
  now?: () => number
}

/** The word index (0-based) of the first word reading `n` at or after
 *  `from`, or -1. */
function wordIndexOf(words: readonly string[], n: number, from = 0): number {
  for (let i = from; i < words.length; i++) {
    const w = words[i]!.toLowerCase().replace(/[^a-z-]/g, '')
    if (wordToNumber(w) === n) return i
  }
  return -1
}

export function ShareStage({
  problem,
  metrics,
  width,
  readRevealed,
  autoDeal,
  hintStep,
  guided,
  answered,
  onAutoDeal,
  now = clock,
}: ShareStageProps) {
  const reducedMotion = useReducedMotion()
  const { total, plates, correct } = problem
  const geometry = useMemo(
    () => shareGeometry(metrics, total, plates, width),
    [metrics, total, plates, width],
  )
  const order = useMemo(() => dealOrder(total, plates), [total, plates])
  const [plan, setPlan] = useState<FlightPlan>(() => emptyPlan(total))
  const planRef = useRef(plan)
  /** The tags fill this many ms after the right answer (the last landing). */
  const [fillDelay, setFillDelay] = useState<number | null>(null)
  const [platesLit, setPlatesLit] = useState(false)
  const [platesTogether, setPlatesTogether] = useState({ n: 0, delay: 0 })
  const [flowerRipple, setFlowerRipple] = useState(0)

  /** Apply a deal command now; returns the ms until the last landing. */
  const run = (mode: DealMode): number => {
    const t = now()
    const prev = planRef.current
    const next = deal(prev, mode, t, plates, reducedMotion)
    if (next !== prev) {
      planRef.current = next
      setPlan(next)
    }
    return msUntilLanded(next, t)
  }

  useOnRise(autoDeal, () => {
    if (undealt(planRef.current) === 0) return
    const ms = run('normal')
    onAutoDeal?.(ms)
  })

  const step = hintStep ?? 0
  useOnRise(step >= 1, () => setFlowerRipple((n) => n + 1))
  useOnRise(step >= 2, () => {
    if (undealt(planRef.current) === total) run('round')
    else setPlatesLit(true)
  })
  useOnRise(step >= 3, () => {
    if (undealt(planRef.current) > 0) run('normal')
    else setPlatesTogether((p) => ({ n: p.n + 1, delay: 0 }))
  })
  useOnRise(guided, () => {
    run('instant')
  })
  useOnRise(answered, () => {
    const ms = run('fast')
    setFillDelay(ms)
    setPlatesTogether((p) => ({ n: p.n + 1, delay: ms }))
  })

  // The read: the total tag pulses on T's word, the plates ripple on B's.
  const words = useMemo(
    () => problem.utterances.read.split(/\s+/).filter(Boolean),
    [problem.utterances.read],
  )
  const totalWord = wordIndexOf(words, total)
  const platesWord = wordIndexOf(words, plates, totalWord + 1)
  const totalTicked = totalWord >= 0 && readRevealed > totalWord
  const platesTicked = platesWord >= 0 && readRevealed > platesWord

  const pileScale = metrics.pileFlower / metrics.groups.flower
  const tagHeight = metrics.groups.tagHeight
  const tagFont = metrics.groups.tagFont
  return (
    <View
      testID="math-share"
      accessible
      accessibilityLabel={problem.utterances.read}
      pointerEvents="none"
      style={{ width, height: metrics.block }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <View
          testID="math-share-cloth"
          style={[
            styles.cloth,
            {
              left: geometry.cloth.x,
              top: geometry.cloth.y,
              width: geometry.cloth.width,
              height: geometry.cloth.height,
              borderRadius: metrics.clothRadius,
            },
          ]}
        />
        {geometry.plates.map((rect, k) => (
          <Plate
            key={k}
            index={k}
            rect={rect}
            metrics={metrics}
            ripple={platesTicked}
            lit={platesLit}
            together={platesTogether}
          />
        ))}
        {order.map((d, k) => (
          <ShareFlower
            key={k}
            index={k}
            home={geometry.pile[d.pileCell]!}
            target={geometry.plateCells[d.plate]![d.plateCell]!}
            plate={d.plate}
            flight={plan[k] ?? null}
            pileScale={pileScale}
            size={metrics.groups.flower}
            arc={metrics.arc}
            ripple={flowerRipple}
            reducedMotion={reducedMotion}
            now={now}
          />
        ))}
        {geometry.plateTags.map((c, k) => (
          <PlateTag
            key={k}
            index={k}
            center={c}
            share={correct}
            height={tagHeight}
            font={tagFont}
            fillDelay={fillDelay}
            guided={guided}
            reducedMotion={reducedMotion}
          />
        ))}
        <TotalTag
          center={geometry.totalTag}
          total={total}
          height={tagHeight}
          font={tagFont}
          pulse={totalTicked}
        />
      </View>
    </View>
  )
}

/** A pill's width for `text` (multiply's tag: 8 pt side padding, at least
 *  as wide as it is tall). */
function pillWidth(text: string, font: number, height: number): number {
  return Math.max(height, Math.ceil(fredokaBoldWidth(text, font)) + 16)
}

function TotalTag({
  center,
  total,
  height,
  font,
  pulse,
}: {
  center: SharePoint
  total: number
  height: number
  font: number
  pulse: boolean
}) {
  const { style, pulse: fire } = usePulse()
  useOnRise(pulse, () => fire(TOTAL_PEAK))
  const w = pillWidth(String(total), font, height)
  return (
    <Animated.View
      testID={`math-share-total${pulse ? '-pulsed' : ''}`}
      style={[
        styles.tag,
        styles.filledTag,
        {
          left: center.x - w / 2,
          top: center.y - height / 2,
          width: w,
          height,
          borderRadius: height / 2,
        },
        style,
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[styles.tagText, { fontSize: font, lineHeight: font * 1.2 }]}
      >
        {total}
      </Text>
    </Animated.View>
  )
}

function Plate({
  index,
  rect,
  metrics,
  ripple,
  lit,
  together,
}: {
  index: number
  rect: { x: number; y: number; width: number; height: number }
  metrics: ShareMetrics
  ripple: boolean
  lit: boolean
  together: { n: number; delay: number }
}) {
  const { style, pulse } = usePulse()
  // The read's plate word and hint 2's lighting: left to right.
  useOnRise(ripple, () => pulse(PULSE_PEAK, index * STAGGER_MS))
  useOnRise(lit, () => pulse(PULSE_PEAK, index * STAGGER_MS))
  useOnRise(together.n, () => pulse(PULSE_PEAK, together.delay))
  const g = metrics.groups
  return (
    <Animated.View
      testID={`math-share-plate-${index}${lit ? '-lit' : ''}`}
      style={[
        styles.plate,
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          borderRadius: g.radius,
          borderWidth: g.border,
        },
        style,
      ]}
    />
  )
}

function ShareFlower({
  index,
  home,
  target,
  plate,
  flight,
  pileScale,
  size,
  arc,
  ripple,
  reducedMotion,
  now,
}: {
  index: number
  home: SharePoint
  target: SharePoint
  plate: number
  flight: Flight | null
  pileScale: number
  size: number
  arc: number
  ripple: number
  reducedMotion: boolean
  now: () => number
}) {
  const progress = useSharedValue(0)
  const land = useSharedValue(1)
  const { style: rippleStyle, pulse } = usePulse()
  useOnRise(ripple, () => pulse(PULSE_PEAK, index * FLOWER_RIPPLE_STAGGER_MS))

  useEffect(() => {
    if (flight === null) {
      progress.set(0)
      land.set(1)
      return
    }
    const delay = Math.max(0, flight.start - now())
    const easing =
      flight.motion === 'deal'
        ? Easing.out(Easing.cubic)
        : flight.motion === 'instant'
          ? EASE_OUT
          : Easing.linear
    progress.set(
      withDelay(delay, withTiming(1, { duration: flight.duration, easing })),
    )
    if (flight.motion === 'deal') {
      land.set(
        withDelay(
          delay + flight.duration,
          withSequence(
            withTiming(LAND_PEAK, { duration: LAND_UP_MS }),
            withSpring(1, LAND_SPRING),
          ),
        ),
      )
    }
    // `now` is the stage's clock, fixed for the mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight, progress, land])

  // Rotation mid-deal (§ 2.5): a flower already launched lands at once; one
  // still waiting keeps its schedule and flies in the new layout.
  const geometryKey = `${home.x},${home.y},${target.x},${target.y}`
  const lastGeometry = useRef(geometryKey)
  useEffect(() => {
    if (lastGeometry.current === geometryKey) return
    lastGeometry.current = geometryKey
    if (flight !== null && flight.start <= now()) {
      progress.set(1)
      land.set(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryKey])

  const half = size / 2
  const arcHeight = flight?.motion === 'deal' ? arc : 0
  const hx = home.x
  const hy = home.y
  const tx = target.x
  const ty = target.y
  const flying = useAnimatedStyle(() => {
    const t = progress.get()
    const x = hx + (tx - hx) * t
    const y = hy + (ty - hy) * t - 4 * arcHeight * t * (1 - t)
    return {
      transform: [
        { translateX: x - half },
        { translateY: y - half },
        { scale: (pileScale + (1 - pileScale) * t) * land.get() },
      ],
    }
  })
  const pileFade = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }))
  const cellFade = useAnimatedStyle(() => ({ opacity: progress.get() }))

  const testID = `math-share-flower-${index}${
    flight === null ? '' : `-plate-${plate + 1}`
  }`
  const box = { width: size, height: size }
  if (reducedMotion) {
    return (
      <>
        <Animated.View
          testID={testID}
          style={[
            styles.flower,
            box,
            {
              transform: [
                { translateX: hx - half },
                { translateY: hy - half },
                { scale: pileScale },
              ],
            },
            pileFade,
          ]}
        >
          <FlowerGlyph size={size} />
        </Animated.View>
        <Animated.View
          testID={`math-share-flower-${index}-cell`}
          style={[
            styles.flower,
            box,
            {
              transform: [{ translateX: tx - half }, { translateY: ty - half }],
            },
            cellFade,
          ]}
        >
          <FlowerGlyph size={size} />
        </Animated.View>
      </>
    )
  }
  return (
    <Animated.View testID={testID} style={[styles.flower, box, flying]}>
      <Animated.View style={rippleStyle}>
        <FlowerGlyph size={size} />
      </Animated.View>
    </Animated.View>
  )
}

/**
 * A plate's tag: "?" (cream, a dashed rose border) until the right answer;
 * after the last landing + 80 ms per plate before it, the "?" fades out
 * (100 ms), then the share springs 0.6 → 1 while the pill turns pink and the
 * dashed border fades. Reduce Motion: one 200 ms crossfade. The given
 * answer rings it (4 pt rose, the guided chip's).
 */
function PlateTag({
  index,
  center,
  share,
  height,
  font,
  fillDelay,
  guided,
  reducedMotion,
}: {
  index: number
  center: SharePoint
  share: number
  height: number
  font: number
  fillDelay: number | null
  guided: boolean
  reducedMotion: boolean
}) {
  const filled = fillDelay !== null
  const at = (fillDelay ?? 0) + index * TAG_FILL_STAGGER_MS
  const questionStyle = useFadeAt(
    !filled,
    reducedMotion ? CROSSFADE_MS : GAP_OUT_MS,
    at,
  )
  const borderStyle = useFadeAt(
    !filled,
    reducedMotion ? CROSSFADE_MS : FADE_MS,
    reducedMotion ? at : at + GAP_OUT_MS,
  )
  const pillStyle = useFadeAt(
    filled,
    reducedMotion ? CROSSFADE_MS : FADE_MS,
    reducedMotion ? at : at + GAP_OUT_MS,
  )
  const numeralStyle = useSpringIn(filled, {
    delayMs: reducedMotion ? at : at + GAP_OUT_MS,
  })
  const ringStyle = useFade(guided)
  const w = pillWidth(String(share), font, height)
  const box = {
    left: center.x - w / 2,
    top: center.y - height / 2,
    width: w,
    height,
    borderRadius: height / 2,
  }
  return (
    <View
      testID={`math-share-tag-${index}${filled ? '-filled' : ''}`}
      style={[styles.tagSlot, box]}
    >
      <Animated.View
        testID={guided ? `math-share-tag-ring-${index}` : undefined}
        style={[styles.ring, { borderRadius: height / 2 + 4 }, ringStyle]}
      />
      <Animated.View
        style={[
          styles.fill,
          styles.questionTag,
          { borderRadius: height / 2 },
          borderStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.fill,
          styles.filledTag,
          { borderRadius: height / 2 },
          pillStyle,
        ]}
      />
      <Animated.Text
        allowFontScaling={false}
        style={[
          styles.tagText,
          styles.overlay,
          styles.questionText,
          { fontSize: font, lineHeight: height },
          questionStyle,
        ]}
      >
        ?
      </Animated.Text>
      <Animated.Text
        allowFontScaling={false}
        style={[
          styles.tagText,
          styles.overlay,
          { fontSize: font, lineHeight: height },
          numeralStyle,
        ]}
      >
        {share}
      </Animated.Text>
    </View>
  )
}

/** Opacity that follows `visible`, fading over `ms` after `delayMs` (both
 *  ways; `useFade` delays only the fade in). */
function useFadeAt(visible: boolean, ms: number, delayMs: number) {
  const opacity = useSharedValue(visible ? 1 : 0)
  useEffect(() => {
    opacity.set(
      withDelay(
        delayMs,
        withTiming(visible ? 1 : 0, { duration: ms, easing: EASE_OUT }),
      ),
    )
    // Fire on a change of `visible` only; the delay belongs to that change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])
  return useAnimatedStyle(() => ({ opacity: opacity.get() }))
}

const styles = StyleSheet.create({
  cloth: { position: 'absolute', backgroundColor: colors.myCream },
  plate: {
    position: 'absolute',
    backgroundColor: colors.white,
    borderColor: colors.myPink,
  },
  flower: { position: 'absolute', left: 0, top: 0 },
  tag: {
    position: 'absolute',
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagSlot: { position: 'absolute' },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  questionTag: {
    backgroundColor: colors.myCream,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.myRose,
  },
  filledTag: { backgroundColor: colors.myPink },
  tagText: { fontFamily: fonts.bold, color: colors.ink },
  questionText: { color: colors.myRose },
  overlay: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  ring: {
    position: 'absolute',
    left: -6,
    right: -6,
    top: -6,
    bottom: -6,
    borderWidth: 4,
    borderColor: colors.myRose,
  },
})
