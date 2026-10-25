/**
 * Letter critters' word hunt, drawn (`design/native/critters-word-hunt.md`
 * § 2-§ 5): the slots (a picture box over three tile boxes, the log's
 * seats in miniature), the bonus chip, the numeral disc on the log's end,
 * the vowel's ringed burrow, the found word's tiles flying up, and New
 * letters. Every piece is a View; the only shipped art is `ui-critters`
 * in New letters. The game (`LetterCritters.tsx`) owns every state and
 * time; these only draw and animate what they are given.
 */
import { critterPictureKey } from '@marian/core/games/playPlace'
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { pictureAsset } from '../../assets'
import type { Rect } from '../../layout/layout'
import { colors, fonts } from '../../theme'
import { ClayDisc } from '../map/mapChrome'
import { OVER_PIECE_Z } from './dragLock'
import type { SlotParts, SlotStep } from './playGeometry'

const HONEY = '#f2c27a'
const HONEY_LEDGE = '#b27b37'
const LETTER = '#6b3f1f'
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

/** § 4.1: a found word's tiles fly up, 60 ms apart, 500 ms each. */
export const TILE_STAGGER_MS = 60
export const TILE_FLIGHT_MS = 500
/** The last tile lands at 620 ms; the three settle over 120 ms. */
export const FILL_LAND_MS = 2 * TILE_STAGGER_MS + TILE_FLIGHT_MS
export const FILL_SETTLE_MS = 120
/** § 4.2: the repeat wiggle, four 100 ms steps. */
export const WIGGLE_STEP_MS = 100
/** § 4.6: the hint's glow fades in over 300 ms, out over 200 ms. */
export const GLOW_IN_MS = 300
export const GLOW_OUT_MS = 200
/** § 5.1: the lap's ring fades in over 150 ms, out over 200 ms. */
export const LAP_RING_IN_MS = 150

const EASE_IN_OUT = Easing.inOut(Easing.quad)

const rectStyle = (r: Rect) => ({
  left: r.x,
  top: r.y,
  width: r.width,
  height: r.height,
})

/** A tile's look: pink for the vowel, honey for a consonant (§ 2.2). */
function tileLook(letter: string) {
  const vowel = VOWELS.has(letter)
  return {
    backgroundColor: vowel ? colors.myPink : HONEY,
    boxShadow: `0 1.5px 0 ${vowel ? colors.myRose : HONEY_LEDGE}`,
  }
}

/**
 * One tile: its letter, Fredoka 700 at 0.62 of its side. The lit pulse
 * (1 → 1.15 → 1, 400 ms) on each new `lit`; Reduce Motion: the letter
 * lights (120 ms in, 200 ms out), no pulse.
 */
export function Tile({
  letter,
  rect,
  lit = 0,
  reducedMotion,
  testID,
}: {
  letter: string
  rect: Rect
  lit?: number
  reducedMotion: boolean
  testID?: string
}) {
  const s = useSharedValue(1)
  const glow = useSharedValue(0)
  useEffect(() => {
    if (lit === 0) return
    if (reducedMotion) {
      glow.set(
        withSequence(
          withTiming(1, { duration: 120 }),
          withTiming(0, { duration: 200 }),
        ),
      )
      return
    }
    s.set(
      withSequence(
        withTiming(1.15, { duration: 200 }),
        withTiming(1, { duration: 200 }),
      ),
    )
  }, [lit, reducedMotion, s, glow])
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }))
  const letterStyle = useAnimatedStyle(() => ({
    textShadowRadius: 8 * glow.get(),
  }))
  const b = rect.width
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[
        styles.abs,
        styles.centred,
        rectStyle(rect),
        { borderRadius: 0.22 * b },
        tileLook(letter),
        style,
      ]}
    >
      <Animated.Text
        allowFontScaling={false}
        style={[
          styles.tileLetter,
          { fontSize: 0.62 * b, lineHeight: 0.8 * b },
          letterStyle,
        ]}
      >
        {letter}
      </Animated.Text>
    </Animated.View>
  )
}

/** A pack picture `contain` in a box (a slot's, or the hint's ghost). */
function SlotPicture({
  word,
  box,
  opacity = 1,
  testID,
}: {
  word: string
  box: Rect
  opacity?: number
  testID: string
}) {
  const source = pictureAsset(critterPictureKey(word))
  if (source === undefined) return null
  return (
    <Image
      testID={testID}
      source={source}
      contentFit="contain"
      accessible={false}
      style={[
        styles.abs,
        {
          left: box.x + 0.07 * box.width,
          top: box.y + 0.07 * box.height,
          width: 0.86 * box.width,
          height: 0.86 * box.height,
          opacity,
        },
      ]}
    />
  )
}

/**
 * The ring outside a slot's card (§ 4.6, § 5.1): honey at 90 %, 4 pt on
 * phones and 6 on tablets, with a 10 pt soft honey shadow. Static: it only
 * fades in and out.
 */
function SlotRing({
  card,
  width,
  inMs,
  testID,
}: {
  card: Rect
  width: number
  inMs: number
  testID: string
}) {
  const r = 0.18 * card.height
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      entering={FadeIn.duration(inMs)}
      exiting={FadeOut.duration(GLOW_OUT_MS)}
      style={[
        styles.abs,
        {
          left: card.x - width,
          top: card.y - width,
          width: card.width + 2 * width,
          height: card.height + 2 * width,
          borderRadius: r + width,
          borderWidth: width,
          borderColor: 'rgba(242, 194, 122, 0.9)',
          boxShadow: '0 0 10px rgba(242, 194, 122, 0.9)',
        },
      ]}
    />
  )
}

export interface SlotProps {
  index: number
  parts: SlotParts
  step: SlotStep
  tablet: boolean
  /** The found word in it, once its tiles have landed; else empty. */
  word: string | null
  /** Reduce Motion's fill: the tiles and picture fade in (200 ms). */
  fadeIn?: boolean
  /** The hint: the glow; and, after its first tap, its word's ghost. */
  glow?: boolean
  ghost?: string | null
  /** The lap of the completion beat lights this slot. */
  lapRing?: boolean
  /** Each new value: the lit pulse on its tiles. */
  lit?: number
  /** Each new value: the repeat wiggle (§ 4.2). */
  wiggle?: number
  reducedMotion: boolean
  label: string
  onPress?: () => void
}

/**
 * A slot (§ 2.2): a cream card, its picture box over three tile boxes.
 * Filled, its tiles and (if bundled) the word's picture; a word whose
 * picture is not bundled leaves the box blank cream. The repeat wiggle
 * turns it 0 → −5° → +5° → −3° → 0 around its centre (400 ms); Reduce
 * Motion: no turn, the tiles light.
 */
export function Slot({
  index,
  parts,
  step,
  tablet,
  word,
  fadeIn = false,
  glow = false,
  ghost = null,
  lapRing = false,
  lit = 0,
  wiggle = 0,
  reducedMotion,
  label,
  onPress,
}: SlotProps) {
  const turn = useSharedValue(0)
  useEffect(() => {
    if (wiggle === 0 || reducedMotion) return
    const step100 = (deg: number) =>
      withTiming(deg, { duration: WIGGLE_STEP_MS })
    turn.set(withSequence(step100(-5), step100(5), step100(-3), step100(0)))
  }, [wiggle, reducedMotion, turn])
  const turned = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get()}deg` }],
  }))
  const { card, picture, boxes } = parts
  // Inner rects are drawn relative to the card.
  const rel = (r: Rect): Rect => ({ ...r, x: r.x - card.x, y: r.y - card.y })
  const ring = tablet ? 6 : 4
  // A repeat lights the tiles with the wiggle (Reduce Motion: alone).
  const pulse = lit + wiggle
  const fill =
    word === null ? null : (
      <View pointerEvents="none" style={styles.fill}>
        <SlotPicture
          word={word}
          box={rel(picture)}
          testID={`hunt-slot-${index}-picture-${critterPictureKey(word)}`}
        />
        {[...word].map((l, k) => (
          <Tile
            key={k}
            letter={l}
            rect={rel(boxes[k]!)}
            lit={pulse}
            reducedMotion={reducedMotion}
            testID={`hunt-slot-${index}-tile-${k}`}
          />
        ))}
      </View>
    )
  return (
    <>
      {glow && (
        <SlotRing
          card={card}
          width={ring}
          inMs={GLOW_IN_MS}
          testID={`hunt-slot-${index}-glow`}
        />
      )}
      {lapRing && (
        <SlotRing
          card={card}
          width={ring}
          inMs={LAP_RING_IN_MS}
          testID={`hunt-slot-${index}-lap`}
        />
      )}
      <Animated.View
        testID={`hunt-slot-${index}-card`}
        style={[styles.abs, rectStyle(card), turned]}
        pointerEvents="box-none"
      >
        <Pressable
          testID={`hunt-slot-${index}`}
          accessible
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={label}
          accessibilityState={{ selected: glow }}
          onPress={onPress}
          disabled={onPress === undefined}
          style={[styles.card, { borderRadius: 0.18 * card.height }]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.abs,
              styles.pictureBox,
              rectStyle(rel(picture)),
              { borderRadius: 0.18 * step.T },
            ]}
          />
          {boxes.map((b, k) => (
            <View
              key={k}
              pointerEvents="none"
              style={[
                styles.abs,
                styles.emptyBox,
                rectStyle(rel(b)),
                { borderRadius: 0.22 * step.b },
              ]}
            />
          ))}
          {ghost !== null && word === null && (
            <Animated.View
              pointerEvents="none"
              entering={FadeIn.duration(200)}
              style={styles.fill}
            >
              <SlotPicture
                word={ghost}
                box={rel(picture)}
                opacity={0.35}
                testID={`hunt-slot-${index}-ghost-${critterPictureKey(ghost)}`}
              />
            </Animated.View>
          )}
          {fill !== null &&
            (fadeIn ? (
              <Animated.View
                pointerEvents="none"
                entering={FadeIn.duration(200)}
                style={styles.fill}
              >
                {fill}
              </Animated.View>
            ) : (
              fill
            ))}
        </Pressable>
      </Animated.View>
    </>
  )
}

/**
 * The bonus chip (§ 4.5): the extras found, newest at the bottom, each as
 * three small tiles on pale honey. Not a button. It appears with its first
 * extra (fade, and scale 0.8 → 1 on a 300 / 22 spring; Reduce Motion: a
 * 200 ms fade).
 */
export function BonusChip({
  rect,
  tiles,
  words,
  lit,
  reducedMotion,
  label,
}: {
  rect: Rect
  /** Each extra's three tile boxes, in find order. */
  tiles: readonly (readonly Rect[])[]
  words: readonly string[]
  lit: Readonly<Record<string, number>>
  reducedMotion: boolean
  label: string
}) {
  const s = useSharedValue(reducedMotion ? 1 : 0.8)
  useEffect(() => {
    if (!reducedMotion) s.set(withSpring(1, { stiffness: 300, damping: 22 }))
    // Mount-once: the chip's first extra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }))
  const rel = (r: Rect): Rect => ({ ...r, x: r.x - rect.x, y: r.y - rect.y })
  return (
    <Animated.View
      testID="hunt-bonus"
      accessible
      accessibilityLabel={label}
      entering={FadeIn.duration(200)}
      style={[
        styles.abs,
        styles.chip,
        rectStyle(rect),
        { borderRadius: 0.25 * (tiles[0]?.[0]?.width ?? 16) },
        grow,
      ]}
    >
      {words.map((w, i) =>
        [...w].map((l, k) => (
          <Tile
            key={`${w}-${k}`}
            letter={l}
            rect={rel(tiles[i]![k]!)}
            lit={lit[w] ?? 0}
            reducedMotion={reducedMotion}
            testID={`hunt-bonus-${w}-${k}`}
          />
        )),
      )}
    </Animated.View>
  )
}

/**
 * The numeral disc on the log's left end (§ 3.2): lighter Number Garden
 * wood with the log's border, the round's length in Fredoka 700 at 0.62 D.
 * Part of the log: no touch and no label of its own; it never moves.
 */
export function NumeralDisc({ rect, length }: { rect: Rect; length: number }) {
  const D = rect.width
  return (
    <View
      testID="critter-log-numeral"
      pointerEvents="none"
      accessible={false}
      style={[
        styles.abs,
        styles.centred,
        styles.numeral,
        rectStyle(rect),
        { borderRadius: D / 2 },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[styles.numeralText, { fontSize: 0.62 * D, lineHeight: D }]}
      >
        {String(length)}
      </Text>
    </View>
  )
}

/**
 * The vowel's empty burrow (§ 2.5): a dashed ring where the critter sits,
 * the vowel's ledge colour at 60 %, fading in and out over 150 ms. Not a
 * target.
 */
export function VowelRing({
  cell,
  vowel,
  shown,
}: {
  cell: Rect
  vowel: string
  shown: boolean
}) {
  const o = useSharedValue(shown ? 0.6 : 0)
  useEffect(() => {
    o.set(withTiming(shown ? 0.6 : 0, { duration: 150 }))
  }, [shown, o])
  const style = useAnimatedStyle(() => ({ opacity: o.get() }))
  return (
    <Animated.View
      testID={shown ? `critter-burrow-empty-${vowel}` : undefined}
      pointerEvents="none"
      accessible={false}
      style={[
        styles.abs,
        rectStyle(cell),
        {
          borderRadius: cell.width / 2,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.myRose,
        },
        style,
      ]}
    />
  )
}

/**
 * One tile of a found word flying from its seated critter to its box
 * (§ 4.1): from the critter's centre at 0.6 × the seat, `delay` ms in,
 * shrinking to the box over 500 ms (ease in-out); it lands a touch large
 * and settles (1.08 → 1, 120 ms) when the last one lands, at 620 ms.
 */
export function FlyingTile({
  letter,
  from,
  to,
  delay,
  testID,
}: {
  letter: string
  from: Rect
  to: Rect
  delay: number
  testID: string
}) {
  const p = useSharedValue(0)
  const settle = useSharedValue(1.08)
  useEffect(() => {
    p.set(
      withDelay(
        delay,
        withTiming(1, { duration: TILE_FLIGHT_MS, easing: EASE_IN_OUT }),
      ),
    )
    settle.set(
      withDelay(FILL_LAND_MS, withTiming(1, { duration: FILL_SETTLE_MS })),
    )
    // Mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const start = 0.6 * from.width
  const dx = from.x + from.width / 2 - (to.x + to.width / 2)
  const dy = from.y + from.height / 2 - (to.y + to.height / 2)
  const big = start / to.width
  const style = useAnimatedStyle(() => {
    const t = p.get()
    return {
      transform: [
        { translateX: (1 - t) * dx },
        { translateY: (1 - t) * dy },
        { scale: (big + (1 - big) * t) * (t < 1 ? 1 : settle.get()) },
      ],
    }
  })
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[styles.abs, styles.over, rectStyle(to), style]}
    >
      <Tile letter={letter} rect={{ ...to, x: 0, y: 0 }} reducedMotion />
    </Animated.View>
  )
}

/**
 * New letters (§ 5.3): Back's size, Home's clay shape and press, Word
 * Song honey with the Letter critters art. It enters with a fade and a
 * scale 0.6 → 1 on the picture's 260 / 16 spring (Reduce Motion: a 200 ms
 * fade). No text, no glow, no idle motion.
 */
export function NewLetters({
  rect,
  reducedMotion,
  label,
  onPress,
}: {
  rect: Rect
  reducedMotion: boolean
  label: string
  onPress: () => void
}) {
  const s = useSharedValue(reducedMotion ? 1 : 0.6)
  useEffect(() => {
    if (!reducedMotion) s.set(withSpring(1, { stiffness: 260, damping: 16 }))
    // Mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }))
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      pointerEvents="box-none"
      style={[styles.fill, styles.top, style]}
    >
      <ClayDisc
        rect={rect}
        k={rect.width / 96}
        onPress={onPress}
        testID="hunt-new-letters"
        label={label}
        art="ui-critters"
        look="honey"
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  abs: { position: 'absolute' },
  centred: { alignItems: 'center', justifyContent: 'center' },
  top: { zIndex: 4 },
  // Over every critter, the log and the drag layer (`dragLock.ts`).
  over: { zIndex: OVER_PIECE_Z },
  card: {
    flex: 1,
    backgroundColor: '#fff8ee',
    boxShadow: '0 2px 0 #e3c6a6',
  },
  pictureBox: { backgroundColor: '#ffffff' },
  emptyBox: {
    backgroundColor: '#efe2d0',
    boxShadow: 'inset 0 0 0 1.5px #d9bfa0',
  },
  tileLetter: {
    fontFamily: fonts.bold,
    color: LETTER,
    textShadowColor: '#ffffff',
  },
  chip: { backgroundColor: 'rgba(242, 194, 122, 0.35)' },
  numeral: {
    backgroundColor: '#f2d3a6',
    borderWidth: 2,
    borderColor: '#7d4a26',
  },
  numeralText: { fontFamily: fonts.bold, color: LETTER },
})
