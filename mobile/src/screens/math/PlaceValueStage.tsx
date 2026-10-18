/**
 * Hundreds' stage (content wave 3, `design/native/content-wave-3.md`
 * § 3.2–§ 3.5, D11): three cream trays, hundreds / tens / ones left to
 * right, with hundred-flats, ten-rods and one-cubes drawn in code (exact
 * counts), a tag under each tray, and on P6–P8 a number tag with its
 * "+10" / "+100" pill. No H T O letters, no "=" sign; "+" only in pills.
 * Hidden from accessibility but for its label, the read line; it takes no
 * touches.
 *
 * What drives it (Math's state, so it follows every line):
 *
 * - The read's word ticks (`readRevealed`): on a place-value problem the
 *   flats drop in on "hundreds", the rods on "tens", the cubes on "ones"
 *   (P5 says ones before tens, so its cubes land first). On P6–P8 the start
 *   blocks, their filled tags, the number tag and its pill are up from the
 *   first frame; the number tag pulses on the read's first word, the pill
 *   on the question's "ten" / "hundred".
 * - The lead line's word ticks (`leadRevealed`): the trays pulse left to
 *   right on "Hundreds, tens and ones!".
 * - Hints (`hintStep`): place-value, hint k ripples tray k and fills its
 *   tag (after hint 3 the tags read the answer); +10 / +100, hint 1
 *   ripples the rods / flats, hint 2 drops the added block in with its
 *   pill and ticks its tag, hint 3 pulses the number tag and its pill.
 * - The given answer (`guided`): every "?" tag fills at once with the
 *   guided chip's 4 pt rose ring; an added block lands at once.
 * - A right answer (`answered`): open tags fill left to right and the
 *   trays pulse once; an added block not in yet drops in fast (no pill),
 *   its tag ticks, and the number tag shows the answer as its pill fades,
 *   so "253 +10" never shows.
 *
 * Reduce Motion (§ 3.5 brackets): a tray fades in (150 ms) instead of
 * dropping its blocks; an added block crossfades (200 ms), its pill shows
 * 600 ms, still; tags crossfade (150 ms); no pulses or ripples. Rotation:
 * the layout recomputes, nothing replays, and a block in flight lands.
 */
import {
  PLACE_PARTS,
  type HundredsProblem,
  type PlacePart,
} from '@marian/core/math/extendedProblems'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import {
  pillWidth,
  placeValueGeometry,
  smallPillWidth,
  startDigits,
  type PlaceValueGeometry,
  type PlaceValueMetrics,
  type PlaceValueRect,
  type SharePoint,
} from '../../layout/mathLayout'
import { colors, fonts } from '../../theme'
import {
  EASE_OUT,
  STAGGER_MS,
  useFade,
  useOnRise,
  usePulse,
} from './extendedMotion'
import { CubeGlyph, FlatGlyph, RodGlyph } from './glyphs'

type AddedMode = 'hint' | 'instant' | 'fast'

/** A tray's blocks enter this far apart (§ 3.5). */
export const BUILD_STAGGER_MS = 90
/** A block's fade in as it drops. */
export const BUILD_FADE_MS = 120
/** The tray fades in at once with Reduce Motion. */
export const TRAY_FADE_MS = 150
/** The drop spring, and the added block's (a fast right tap's). */
const DROP_SPRING = { stiffness: 260, damping: 20, mass: 1 }
const ADDED_SPRING = { stiffness: 220, damping: 18, mass: 1 }
const FAST_SPRING = { stiffness: 300, damping: 22, mass: 1 }
/** The added block's pill fades this long after it lands (§ 3.5). */
export const ADDED_PILL_HOLD_MS = 600
/** About when a dropped block has landed (the spring settles later). */
const LAND_MS = 300
/** Tags fill this far apart (sharing's), left to right. */
export const PV_TAG_FILL_STAGGER_MS = 80
/** A tag's numeral changes over this long (old out, new in). */
const TICK_OUT_MS = 120
const CROSSFADE_MS = 150
/** Ripples and pulses: multiply's 1 → 1.06 → 1; the number tag 1.1. */
const RIPPLE_PEAK = 1.06
const TAG_PEAK = 1.1
const RIPPLE_STAGGER_MS = 60

/** A tray's cream fill (`colors.myCream`), with a pale rose edge. */
const TRAY_EDGE = '#F6D5DC'

/** The word index (0-based) of the first word reading `word` at or after
 *  `from`, or -1. */
function wordIndex(words: readonly string[], word: string, from = 0): number {
  for (let i = from; i < words.length; i++)
    if (words[i]!.toLowerCase().replace(/[^a-z]/g, '') === word) return i
  return -1
}

/** The last word index of a number word of the question ("ten" / "hundred"
 *  in "What is one hundred more?"), or -1. */
function questionWordIndex(words: readonly string[], step: 10 | 100): number {
  const want = step === 10 ? 'ten' : 'hundred'
  for (let i = words.length - 1; i >= 0; i--)
    if (words[i]!.toLowerCase().replace(/[^a-z]/g, '') === want) return i
  return -1
}

export interface PlaceValueStageProps {
  problem: HundredsProblem
  metrics: PlaceValueMetrics
  /** The problem rect's width (the block is centred in it). */
  width: number
  /** Words of the read revealed so far (its word ticks). */
  readRevealed: number
  /** Words of the step's lead line revealed so far ("Hundreds, tens and
   *  ones!"); 0 when it did not play. */
  leadRevealed: number
  hintStep: 1 | 2 | 3 | null
  guided: boolean
  answered: boolean
}

export function PlaceValueStage({
  problem,
  metrics,
  width,
  readRevealed,
  leadRevealed,
  hintStep,
  guided,
  answered,
}: PlaceValueStageProps) {
  const reducedMotion = useReducedMotion()
  const geometry = useMemo(
    () => placeValueGeometry(metrics, problem, width),
    [metrics, problem, width],
  )
  const words = useMemo(
    () => problem.utterances.read.split(/\s+/).filter(Boolean),
    [problem.utterances.read],
  )
  const start = startDigits(problem)
  const more = problem.kind === 'more' ? problem : null
  const step = hintStep ?? 0
  const resolved = answered || guided

  // Which trays are built: a place-value read builds each on its word's
  // tick; anything that ends the read early (a tap, a hint) lands them.
  const built = (place: PlacePart): boolean =>
    more !== null ||
    resolved ||
    step > 0 ||
    readRevealed > wordIndex(words, place)

  // The added block of a "more" problem: hint 2 drops it with its pill;
  // the given answer lands it at once; a right tap drops it fast. The block
  // reads its mode once, when it mounts (the event that brought it in).
  const addedShown = more !== null && (step >= 2 || guided || answered)
  const addedMode: AddedMode = step >= 2 ? 'hint' : guided ? 'instant' : 'fast'

  // The tags' values: a place-value tag fills on its hint, on the given
  // answer and on a right tap; a "more" tag shows the start digits, and
  // the added block's place ticks up as it lands.
  const tagValue = (place: PlacePart, k: number): string => {
    if (more !== null) {
      const changed = geometry.added?.place === place && addedShown
      return String(start[place] + (changed ? 1 : 0))
    }
    return resolved || step >= k + 1 ? String(start[place]) : '?'
  }
  const filled = (k: number) => more !== null || resolved || step >= k + 1

  // Pulses and ripples, by place.
  const leadPulse = (place: PlacePart) =>
    leadRevealed > wordIndex(['hundreds,', 'tens', 'and', 'ones!'], place)
  const rippled = (place: PlacePart, k: number): number => {
    if (more !== null) {
      const own = more.step === 100 ? 'hundreds' : 'tens'
      return place === own && step >= 1 ? 1 : 0
    }
    return step >= k + 1 ? 1 : 0
  }

  // The tray's last block lands about this long after its tick (§ 3.5).
  const lastLandMs = (place: PlacePart) =>
    Math.max(0, start[place] - 1) * BUILD_STAGGER_MS + LAND_MS

  const numberPulsed = more !== null && readRevealed >= 1
  const pillPulsed =
    more !== null && readRevealed > questionWordIndex(words, more.step)
  const hint3Pulse = more !== null && step >= 3

  return (
    <View
      testID="math-place-value"
      accessible
      accessibilityLabel={problem.utterances.read}
      pointerEvents="none"
      style={{ width, height: metrics.block.height }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        {PLACE_PARTS.map((place, k) => (
          <Tray
            key={place}
            place={place}
            index={k}
            rect={geometry.trays[place]}
            radius={metrics.trayRadius}
            leadPulse={leadPulse(place)}
            answerPulse={answered}
          >
            <Blocks
              place={place}
              geometry={geometry}
              u={metrics.u}
              built={built(place)}
              animate={more === null && !resolved && step === 0}
              drop={metrics.drop}
              ripple={rippled(place, k)}
              reducedMotion={reducedMotion}
            />
          </Tray>
        ))}
        {more !== null && addedShown && geometry.added !== null && (
          <AddedBlock
            key={`added-${geometry.added.place}`}
            place={geometry.added.place}
            rect={geometry.added.rect}
            pill={geometry.added.pill}
            label={`+${more.step}`}
            u={metrics.u}
            mode={addedMode}
            rise={metrics.addedRise}
            pillHeight={metrics.pillHeight}
            pillFont={metrics.pillFont}
            reducedMotion={reducedMotion}
          />
        )}
        {PLACE_PARTS.map((place, k) => (
          <PlaceTag
            key={place}
            place={place}
            center={geometry.tags[place]}
            value={tagValue(place, k)}
            filled={filled(k)}
            fillDelay={
              answered && more === null ? k * PV_TAG_FILL_STAGGER_MS : 0
            }
            built={built(place)}
            landMs={lastLandMs(place)}
            guided={guided && more === null}
            height={metrics.tagHeight}
            font={metrics.tagFont}
            reducedMotion={reducedMotion}
          />
        ))}
        {more !== null &&
          geometry.numberTag !== null &&
          geometry.numberPill !== null && (
            <>
              <NumberTag
                center={geometry.numberTag}
                value={String(answered ? more.correct : more.start)}
                width={metrics.numberTagWidth}
                height={metrics.tagHeight}
                font={metrics.tagFont}
                pulse={numberPulsed}
                hint3={hint3Pulse}
                reducedMotion={reducedMotion}
              />
              <NumberPill
                center={geometry.numberPill}
                label={`+${more.step}`}
                height={metrics.pillHeight}
                font={metrics.pillFont}
                pulse={pillPulsed}
                hint3={hint3Pulse}
                faded={answered}
              />
            </>
          )}
      </View>
    </View>
  )
}

function Tray({
  place,
  index,
  rect,
  radius,
  leadPulse,
  answerPulse,
  children,
}: {
  place: PlacePart
  index: number
  rect: PlaceValueRect
  radius: number
  leadPulse: boolean
  answerPulse: boolean
  children: ReactNode
}) {
  const { style, pulse } = usePulse()
  // The lead's word ticks; the right answer's once-over, left to right.
  useOnRise(leadPulse, () => pulse(RIPPLE_PEAK))
  useOnRise(answerPulse, () => pulse(RIPPLE_PEAK, index * STAGGER_MS))
  return (
    <>
      <Animated.View
        testID={`math-pv-tray-${place}${leadPulse ? '-pulsed' : ''}`}
        style={[
          styles.tray,
          {
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            borderRadius: radius,
          },
          style,
        ]}
      />
      {children}
    </>
  )
}

/** A tray's blocks, in build order. */
function Blocks({
  place,
  geometry,
  u,
  built,
  animate,
  drop,
  ripple,
  reducedMotion,
}: {
  place: PlacePart
  geometry: PlaceValueGeometry
  u: number
  built: boolean
  /** Built on the read's tick (drop in); else at once (start blocks, a
   *  tap or a hint that ended the build). */
  animate: boolean
  drop: number
  ripple: number
  reducedMotion: boolean
}) {
  // A block reads `animate` once, when it mounts: a tray built on its tick
  // drops its blocks; one built at once (the start blocks, a tap or a hint
  // that ended the build) shows them still.
  const fade = useFade(built, TRAY_FADE_MS)
  if (!built) return null
  const rects =
    place === 'hundreds'
      ? geometry.flats
      : place === 'tens'
        ? geometry.rods
        : geometry.cubes
  const Glyph =
    place === 'hundreds' ? FlatGlyph : place === 'tens' ? RodGlyph : CubeGlyph
  const kind = place === 'hundreds' ? 'flat' : place === 'tens' ? 'rod' : 'cube'
  const blocks = rects.map((r, k) => (
    <Block
      key={k}
      testID={`math-pv-${kind}-${k}`}
      rect={r}
      delay={k * BUILD_STAGGER_MS}
      drop={animate && !reducedMotion ? drop : 0}
      ripple={ripple}
      rippleDelay={k * RIPPLE_STAGGER_MS}
    >
      <Glyph u={u} />
    </Block>
  ))
  // Reduce Motion: the tray fades in instead (at once for blocks already
  // there).
  if (reducedMotion) {
    return (
      <Animated.View
        testID={`math-pv-tray-${place}-fade`}
        style={[StyleSheet.absoluteFill, fade]}
      >
        {blocks}
      </Animated.View>
    )
  }
  return <>{blocks}</>
}

function Block({
  testID,
  rect,
  delay,
  drop,
  ripple,
  rippleDelay,
  children,
}: {
  testID: string
  rect: PlaceValueRect
  delay: number
  /** Drop this far (0: still). */
  drop: number
  ripple: number
  rippleDelay: number
  children: ReactNode
}) {
  const y = useSharedValue(drop === 0 ? 0 : -drop)
  const opacity = useSharedValue(drop === 0 ? 1 : 0)
  useEffect(() => {
    if (drop === 0) return
    y.set(withDelay(delay, withSpring(0, DROP_SPRING)))
    opacity.set(
      withDelay(
        delay,
        withTiming(1, { duration: BUILD_FADE_MS, easing: EASE_OUT }),
      ),
    )
    // Mount only: a block drops once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Rotation: a block in flight lands at once in the new layout.
  const key = `${rect.x},${rect.y},${rect.width}`
  const last = useRef(key)
  useEffect(() => {
    if (last.current === key) return
    last.current = key
    y.set(0)
    opacity.set(1)
  }, [key, y, opacity])
  const { style: rippleStyle, pulse } = usePulse()
  useOnRise(ripple, () => pulse(RIPPLE_PEAK, rippleDelay))
  const moving = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: y.get() }],
  }))
  return (
    <Animated.View
      testID={testID}
      style={[
        styles.abs,
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
        moving,
      ]}
    >
      <Animated.View style={rippleStyle}>{children}</Animated.View>
    </Animated.View>
  )
}

/** A "more" problem's added rod or flat, with its "+10" / "+100" pill. */
function AddedBlock({
  place,
  rect,
  pill,
  label,
  u,
  mode,
  rise,
  pillHeight,
  pillFont,
  reducedMotion,
}: {
  place: PlacePart
  rect: PlaceValueRect
  pill: SharePoint
  label: string
  u: number
  mode: AddedMode
  rise: number
  pillHeight: number
  pillFont: number
  reducedMotion: boolean
}) {
  const moves = mode !== 'instant' && !reducedMotion
  const y = useSharedValue(moves ? -rise : 0)
  const opacity = useSharedValue(mode === 'instant' ? 1 : reducedMotion ? 0 : 1)
  // The pill: hint 2's block only (a fast right tap and the given answer
  // drop theirs with none).
  const [pillShown, setPillShown] = useState(mode === 'hint')
  const pillOpacity = useSharedValue(mode === 'hint' ? 1 : 0)
  useEffect(() => {
    if (moves)
      y.set(withSpring(0, mode === 'fast' ? FAST_SPRING : ADDED_SPRING))
    if (reducedMotion && mode !== 'instant')
      opacity.set(withTiming(1, { duration: 200, easing: EASE_OUT }))
    if (mode === 'hint') {
      const hold = reducedMotion
        ? ADDED_PILL_HOLD_MS
        : LAND_MS + ADDED_PILL_HOLD_MS
      pillOpacity.set(
        withDelay(hold, withTiming(0, { duration: 200, easing: EASE_OUT })),
      )
      const id = setTimeout(() => setPillShown(false), hold + 200)
      return () => clearTimeout(id)
    }
    // Mount only: the block arrives once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Rotation: a block in flight lands at once in the new layout.
  const key = `${rect.x},${rect.y},${rect.width}`
  const last = useRef(key)
  useEffect(() => {
    if (last.current === key) return
    last.current = key
    y.set(0)
    opacity.set(1)
  }, [key, y, opacity])
  const blockStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: y.get() }],
  }))
  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.get(),
    transform: [{ translateY: y.get() }],
  }))
  const Glyph = place === 'hundreds' ? FlatGlyph : RodGlyph
  const w = smallPillWidth(label, pillFont, pillHeight)
  return (
    <>
      <Animated.View
        testID={`math-pv-added-${place}`}
        style={[
          styles.abs,
          { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
          blockStyle,
        ]}
      >
        <Glyph u={u} />
      </Animated.View>
      {pillShown && (
        <Animated.View
          testID="math-pv-added-pill"
          style={[
            styles.pill,
            {
              left: pill.x - w / 2,
              top: pill.y - pillHeight / 2,
              width: w,
              height: pillHeight,
              borderRadius: pillHeight / 2,
            },
            pillStyle,
          ]}
        >
          <Text
            allowFontScaling={false}
            style={[
              styles.pillText,
              { fontSize: pillFont, lineHeight: pillHeight },
            ]}
          >
            {label}
          </Text>
        </Animated.View>
      )}
    </>
  )
}

/**
 * A tray's tag: "?" (cream, a dashed rose border) until it fills, then the
 * digit on sharing's pink pill. A change of value ticks: the old rises 8 pt
 * and fades (120 ms) while the new springs up from 8 pt below, 0.6 → 1.
 * Reduce Motion: a 150 ms crossfade. The given answer rings it.
 */
function PlaceTag({
  place,
  center,
  value,
  filled,
  fillDelay,
  built,
  landMs,
  guided,
  height,
  font,
  reducedMotion,
}: {
  place: PlacePart
  center: SharePoint
  value: string
  filled: boolean
  fillDelay: number
  /** The tray is built: the tag pulses as its last block lands. */
  built: boolean
  landMs: number
  guided: boolean
  height: number
  font: number
  reducedMotion: boolean
}) {
  const w = pillWidth(value === '?' ? '0' : value, font, height)
  const pillStyle = useFade(
    filled,
    reducedMotion ? CROSSFADE_MS : 200,
    fillDelay,
  )
  const ringStyle = useFade(guided)
  const { style: pulseStyle, pulse } = usePulse()
  // The last block landing pulses the tag (1 → 1.1 → 1), and so does
  // its fill.
  useOnRise(built, () => pulse(TAG_PEAK, landMs))
  useOnRise(filled, () => pulse(TAG_PEAK, fillDelay))
  return (
    <Animated.View
      testID={`math-pv-tag-${place}${filled ? '-filled' : ''}`}
      style={[
        styles.abs,
        {
          left: center.x - w / 2,
          top: center.y - height / 2,
          width: w,
          height,
        },
        pulseStyle,
      ]}
    >
      {guided && (
        <Animated.View
          testID={`math-pv-tag-ring-${place}`}
          style={[styles.ring, { borderRadius: height / 2 + 4 }, ringStyle]}
        />
      )}
      <View
        style={[styles.fill, styles.questionTag, { borderRadius: height / 2 }]}
      />
      <Animated.View
        style={[
          styles.fill,
          styles.filledTag,
          { borderRadius: height / 2 },
          pillStyle,
        ]}
      />
      <TickNumeral
        testID={`math-pv-tag-${place}-value`}
        value={value}
        font={font}
        height={height}
        delay={fillDelay}
        question={value === '?'}
        reducedMotion={reducedMotion}
      />
    </Animated.View>
  )
}

/** A numeral that ticks to a new value (§ 3.5 "Tag tick"). */
function TickNumeral({
  testID,
  value,
  font,
  height,
  delay,
  question,
  reducedMotion,
}: {
  testID: string
  value: string
  font: number
  height: number
  delay: number
  question: boolean
  reducedMotion: boolean
}) {
  const [old, setOld] = useState<{ value: string; n: number } | null>(null)
  const prev = useRef(value)
  const n = useRef(0)
  const inY = useSharedValue(0)
  const inScale = useSharedValue(1)
  const inOpacity = useSharedValue(1)
  useEffect(() => {
    if (prev.current === value) return
    const was = prev.current
    prev.current = value
    n.current += 1
    setOld({ value: was, n: n.current })
    if (reducedMotion) {
      inOpacity.set(0)
      inOpacity.set(withDelay(delay, withTiming(1, { duration: CROSSFADE_MS })))
    } else {
      inY.set(8)
      inScale.set(0.6)
      inOpacity.set(0)
      inY.set(withDelay(delay, withSpring(0, DROP_SPRING)))
      inScale.set(withDelay(delay, withSpring(1, DROP_SPRING)))
      inOpacity.set(withDelay(delay, withTiming(1, { duration: TICK_OUT_MS })))
    }
    const id = setTimeout(
      () => setOld(null),
      delay + (reducedMotion ? CROSSFADE_MS : TICK_OUT_MS),
    )
    return () => clearTimeout(id)
  }, [value, delay, reducedMotion, inY, inScale, inOpacity])
  const inStyle = useAnimatedStyle(() => ({
    opacity: inOpacity.get(),
    transform: [{ translateY: inY.get() }, { scale: inScale.get() }],
  }))
  const text = [
    styles.tagText,
    styles.overlay,
    { fontSize: font, lineHeight: height },
  ]
  return (
    <>
      {old !== null && (
        <OldNumeral
          key={old.n}
          value={old.value}
          style={text}
          question={old.value === '?'}
          delay={delay}
          reducedMotion={reducedMotion}
        />
      )}
      <Animated.Text
        testID={testID}
        allowFontScaling={false}
        style={[...text, question ? styles.questionText : null, inStyle]}
      >
        {value}
      </Animated.Text>
    </>
  )
}

function OldNumeral({
  value,
  style,
  question,
  delay,
  reducedMotion,
}: {
  value: string
  style: object[]
  question: boolean
  delay: number
  reducedMotion: boolean
}) {
  const y = useSharedValue(0)
  const opacity = useSharedValue(1)
  useEffect(() => {
    const ms = reducedMotion ? CROSSFADE_MS : TICK_OUT_MS
    opacity.set(withDelay(delay, withTiming(0, { duration: ms })))
    if (!reducedMotion)
      y.set(withDelay(delay, withTiming(-8, { duration: ms })))
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const s = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: y.get() }],
  }))
  return (
    <Animated.Text
      allowFontScaling={false}
      style={[...style, question ? styles.questionText : null, s]}
    >
      {value}
    </Animated.Text>
  )
}

/** P6–P8's number tag (multiply's pill): the start, then the answer. */
function NumberTag({
  center,
  value,
  width,
  height,
  font,
  pulse,
  hint3,
  reducedMotion,
}: {
  center: SharePoint
  value: string
  width: number
  height: number
  font: number
  pulse: boolean
  hint3: boolean
  reducedMotion: boolean
}) {
  const { style, pulse: fire } = usePulse()
  useOnRise(pulse, () => fire(TAG_PEAK))
  useOnRise(hint3, () => fire(TAG_PEAK))
  return (
    <Animated.View
      testID={`math-pv-number${pulse ? '-pulsed' : ''}`}
      style={[
        styles.abs,
        styles.filledTag,
        {
          left: center.x - width / 2,
          top: center.y - height / 2,
          width,
          height,
          borderRadius: height / 2,
        },
        style,
      ]}
    >
      <TickNumeral
        testID="math-pv-number-value"
        value={value}
        font={font}
        height={height}
        delay={0}
        question={false}
        reducedMotion={reducedMotion}
      />
    </Animated.View>
  )
}

/** The number tag's "+10" / "+100" pill (D11): up from the first frame,
 *  pulsing on the question's "ten" / "hundred" and on hint 3; it fades as
 *  the tag ticks to the answer. */
function NumberPill({
  center,
  label,
  height,
  font,
  pulse,
  hint3,
  faded,
}: {
  center: SharePoint
  label: string
  height: number
  font: number
  pulse: boolean
  hint3: boolean
  faded: boolean
}) {
  const { style, pulse: fire } = usePulse()
  useOnRise(pulse, () => fire(TAG_PEAK))
  useOnRise(hint3, () => fire(TAG_PEAK))
  const fade = useFade(!faded)
  const w = smallPillWidth(label, font, height)
  return (
    <Animated.View
      testID={
        faded
          ? 'math-pv-number-pill-faded'
          : `math-pv-number-pill${pulse ? '-pulsed' : ''}`
      }
      style={[
        styles.pill,
        {
          left: center.x - w / 2,
          top: center.y - height / 2,
          width: w,
          height,
          borderRadius: height / 2,
        },
        style,
        fade,
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[styles.pillText, { fontSize: font, lineHeight: height }]}
      >
        {label}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  tray: {
    position: 'absolute',
    backgroundColor: colors.myCream,
    borderWidth: 1,
    borderColor: TRAY_EDGE,
  },
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
  pill: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.myRose,
  },
  pillText: { fontFamily: fonts.bold, color: colors.myRose },
})
