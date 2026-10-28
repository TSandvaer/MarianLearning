/**
 * Raft crossing's paint, shared by the trip (`RaftCrossing.tsx`) and the
 * raft picker (`RaftPicker.tsx`): the raft (play-games-restyle T4, with
 * the island goal's target board, raft-island-goal § 4.3), the animals
 * and their tags (T5, T6), the island's clay oval with its bushes or
 * stones (§ 1.3), and a home (§ 1.1). Paint only: every rect comes from
 * `playGeometry.ts`.
 */
import { RAFT_ANIMALS, type RaftWeight } from '@marian/core/games/playPlace'
import { useEffect, useRef, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg'
import { Image } from 'expo-image'
import { pictureAsset } from '../../assets'
import { imageShadow } from '../../components/imageShadow'
import type { Rect } from '../../layout/layout'
import { fonts } from '../../theme'
import { ClayOval } from '../map/mapFx'
import { clayK, pictureSide, rectStyle } from './raftPaint'
import {
  clayDrop,
  islandTips,
  moundFace,
  targetBoard,
  type RaftScene,
} from './playGeometry'
import { raftLabel } from './playLines'

/** The raft's glide out and back (play-place § 2.3). */
export const GLIDE_MS = 2400
export const RETURN_MS = 1600
export const REDUCED_GLIDE_MS = 400
export const REDUCED_RETURN_MS = 400
/** Too heavy (§ 2.3). */
export const WOBBLE_MS = 900
export const FADE_MS = 150

/** T2: today's water as a pool; its ledge is the only new colour. */
export const WATER = '#8fd0ee'
export const WATER_DEEP = '#5fb3dd'
export const WATER_LEDGE = '#4a9cc8'
/** T3: the 10 island, a Word Song honey clay oval with green clay bushes. */
const SAND_STOPS = ['#ffeec2', '#f2c27a', '#d9a159'] as const
const SAND_SLAB = '#b27b37'
/**
 * § 1.3: the 20 island, green clay (`CLAY_LOOK.go`'s face ends, flat
 * colour and slab) with two honey sand stones.
 */
const GRASS_STOPS = ['#7fd364', '#6cc655', '#5cb945'] as const
const GRASS_SLAB = '#3f8a2e'
/** T6: the Map's open-stop plinth. */
const PLINTH_STOPS = ['#fffaf0', '#efdcc0', '#d6b890'] as const
const PLINTH_SLAB = '#b8946a'
/** A clay oval's soft shadow under its slab. */
const ovalSoft = (drop: number) => ({
  dy: drop + 2,
  blur: 8,
  color: 'rgba(60, 30, 10, 0.22)',
})
/** T4: the Home disc's wood, run top to bottom. */
const WOOD = '#c98a55'
const WOOD_RIM = '#7d4a26'
/** T5: the cream clay tile (`ClayChip`) on Number Garden's slab. */
const TILE = '#fff7ee'
const TILE_FACE = 'linear-gradient(#ffffff 0%, #fff7ee 60%, #ffeedd 100%)'
const TAG_SHADOW = {
  tablet:
    'inset 0 2px 0 #ffffff, 0 4px 0 #dba675, 0 6px 9px rgba(90, 45, 20, 0.16)',
  phone:
    'inset 0 2px 0 #ffffff, 0 3px 0 #dba675, 0 5px 7px rgba(90, 45, 20, 0.16)',
}
/** `INK` (`mapTheme.ts`): the numerals, and an empty home's shape. */
const TAG_TEXT = '#6b3f1f'
/** § 1.1: an empty home's animal, the picture tinted at 0.32. */
const SHAPE_OPACITY = 0.32
/** § 1.1: the nest's sand dip, the Word Song honey stops run dark to light. */
const NEST_STOPS = ['#d9a159', '#f2c27a', '#ffe0a8'] as const
/** T6: the Hub and map stickers' drop shadow, on every animal picture. */
const PICTURE_SHADOW = {
  tablet: imageShadow(4, 8, 'rgba(60, 30, 10, 0.28)'),
  phone: imageShadow(3, 6, 'rgba(60, 30, 10, 0.28)'),
}

/**
 * An animal and its weight tag (§ 2.2): the pack picture at
 * size × (0.72 + 0.28 × (w − 1) / 8), so the bee is small and the pig
 * fills the cell, with a contact shadow (T6); a cream clay disc of
 * 0.42 × size at its lower right with the numeral (D2, T5).
 */
export function AnimalArt({
  weight,
  size,
  tag,
  tablet,
}: {
  weight: RaftWeight
  size: number
  tag: boolean
  tablet: boolean
}) {
  const px = pictureSide(size, weight)
  const disc = 0.42 * size
  return (
    <View pointerEvents="none" style={styles.centred}>
      <View
        testID="raft-picture"
        style={tablet ? PICTURE_SHADOW.tablet : PICTURE_SHADOW.phone}
      >
        <Image
          source={pictureAsset(RAFT_ANIMALS[weight])}
          contentFit="contain"
          accessible={false}
          style={{ width: px, height: px }}
        />
      </View>
      {tag && (
        <Tag
          weight={weight}
          d={disc}
          font={0.3 * size}
          tablet={tablet}
          testID="raft-tag"
        />
      )}
    </View>
  )
}

/** A cream clay disc at its cell's lower right with the numeral (T5). */
function Tag({
  weight,
  d,
  font,
  tablet,
  testID,
}: {
  weight: number
  d: number
  font: number
  tablet: boolean
  testID: string
}) {
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[
        styles.tag,
        {
          width: d,
          height: d,
          borderRadius: d / 2,
          right: 0,
          bottom: 0,
          boxShadow: tablet ? TAG_SHADOW.tablet : TAG_SHADOW.phone,
        },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[styles.tagText, { fontSize: font }]}
      >
        {weight}
      </Text>
    </View>
  )
}

/**
 * A shore animal's cream clay plinth (T6), inside its cell; it moves with
 * the animal, so an empty spot shows sand.
 */
export function Plinth({
  size,
  tablet,
  id,
}: {
  size: number
  tablet: boolean
  id: string
}) {
  const drop = tablet ? 6 : 4
  return (
    <View
      testID="raft-plinth"
      pointerEvents="none"
      style={[styles.abs, { left: 0.06 * size, top: 0.62 * size }]}
    >
      <ClayOval
        id={id}
        w={0.88 * size}
        h={0.34 * size}
        drop={drop}
        stops={PLINTH_STOPS}
        slab={PLINTH_SLAB}
        soft={ovalSoft(drop)}
      />
    </View>
  )
}

/**
 * The island's clay oval (T3, raft-island-goal § 1.3): the 10 island honey
 * sand with two green clay bushes at its tips, the 20 island green clay
 * with two honey sand stones. `tips` false in the picker (§ 5.2).
 */
export function IslandGround({
  scene,
  oval,
  tips,
  tablet,
  id,
}: {
  scene: RaftScene
  /** The oval's rect, face and drop (the mound in a trip). */
  oval: Rect
  tips: boolean
  tablet: boolean
  id: string
}) {
  const drop = clayDrop(tablet)
  const k = clayK(tablet)
  const grass = scene.target === 20
  return (
    <>
      <View
        testID="raft-mound"
        pointerEvents="none"
        style={[styles.abs, { left: oval.x, top: oval.y }]}
      >
        <ClayOval
          id={id}
          w={oval.width}
          h={oval.height - drop}
          drop={drop}
          stops={grass ? GRASS_STOPS : SAND_STOPS}
          slab={grass ? GRASS_SLAB : SAND_SLAB}
          soft={ovalSoft(drop)}
        />
      </View>
      {tips &&
        islandTips(scene).map((r, i) =>
          grass ? (
            <View
              key={i}
              testID="raft-stone"
              pointerEvents="none"
              style={[styles.abs, { left: r.x, top: r.y }]}
            >
              <ClayOval
                id={`${id}-stone-${i}`}
                w={r.width}
                h={r.height - 0.2 * r.height}
                drop={0.2 * r.height}
                stops={SAND_STOPS}
                slab={SAND_SLAB}
              />
            </View>
          ) : (
            <View
              key={i}
              testID="raft-bush"
              pointerEvents="none"
              style={[
                styles.abs,
                styles.bush,
                {
                  ...rectStyle(r),
                  // 50 % / 50 % / 45 % / 45 % of the height: iOS draws no
                  // elliptical corners, and a '50%' radius here is a lens.
                  borderTopLeftRadius: 0.5 * r.height,
                  borderTopRightRadius: 0.5 * r.height,
                  borderBottomRightRadius: 0.45 * r.height,
                  borderBottomLeftRadius: 0.45 * r.height,
                  boxShadow: `inset 0 ${3 * k}px 0 rgba(255, 255, 255, 0.35), 0 ${5 * k}px 0 #3f8a2e, 0 ${8 * k}px ${10 * k}px rgba(40, 90, 20, 0.3)`,
                },
              ]}
            />
          ),
        )}
    </>
  )
}

/** The trip's island: `IslandGround` on the mound, with its tips. */
export function TripIsland({
  scene,
  tablet,
}: {
  scene: RaftScene
  tablet: boolean
}) {
  return (
    <IslandGround
      scene={scene}
      oval={{ ...moundFace(scene), height: scene.mound.height }}
      tips
      tablet={tablet}
      id="raft-mound"
    />
  )
}

/**
 * A home (raft-island-goal § 1.1): a sand-dip nest, its animal (a soft
 * shape while empty, in colour once home) bottom-centred with its feet in
 * the nest, and the home's number on a cream clay disc (`tag`; none in
 * the picker, Decision 8). Not a touch target (Decision 10).
 */
export function HomeArt({
  weight,
  size,
  filled,
  tag,
  tablet,
  id,
}: {
  weight: RaftWeight
  size: number
  filled: boolean
  tag: boolean
  tablet: boolean
  id: string
}) {
  const h = size
  const px = pictureSide(h, weight)
  const nest = { x: 0.04 * h, y: 0.6 * h, w: 0.92 * h, h: 0.36 * h }
  return (
    <View pointerEvents="none" style={styles.fill}>
      <Svg
        width={h}
        height={h}
        style={styles.abs}
        testID={`${id}-nest`}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id={`${id}-dip`} cx="50%" cy="40%" r="60%">
            <Stop offset="0" stopColor={NEST_STOPS[0]} />
            <Stop offset="0.6" stopColor={NEST_STOPS[1]} />
            <Stop offset="1" stopColor={NEST_STOPS[2]} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={nest.x + nest.w / 2}
          cy={nest.y + nest.h / 2}
          rx={nest.w / 2}
          ry={nest.h / 2}
          fill={`url(#${id}-dip)`}
        />
      </Svg>
      <View
        testID={filled ? 'raft-picture' : undefined}
        style={[
          styles.abs,
          { left: (h - px) / 2, top: 0.92 * h - px, width: px, height: px },
          filled && (tablet ? PICTURE_SHADOW.tablet : PICTURE_SHADOW.phone),
        ]}
      >
        <Image
          testID={filled ? `${id}-animal` : `${id}-shape`}
          source={pictureAsset(RAFT_ANIMALS[weight])}
          contentFit="contain"
          accessible={false}
          tintColor={filled ? undefined : TAG_TEXT}
          style={{
            width: px,
            height: px,
            opacity: filled ? 1 : SHAPE_OPACITY,
          }}
        />
      </View>
      {tag && (
        <Tag
          weight={weight}
          d={0.58 * h}
          font={0.44 * h}
          tablet={tablet}
          testID={`${id}-tag`}
        />
      )}
    </View>
  )
}

/**
 * The raft (§ 2.2, raft-island-goal § 4): clay logs on a dark wood base,
 * two rope bands, no seat marks (T4); a mast whose cream clay flag shows
 * the total up to the target (blank at 0) and an oar; the target on a
 * cream clay board on the front edge, above the seated animals (§ 4.3).
 * It sinks with its load (total / target × 0.12 × the deck's height), goes
 * under on a splash and wobbles (+6° / −6°, three times, 900 ms; Reduce
 * Motion: dims), and glides between the dock and the island, bobbing and
 * rowing. A new layout jumps it to where it is going. In the picker it is
 * `labelled={false}`: the pond is the button (§ 10).
 */
export function Deck({
  scene,
  rect,
  total,
  splashing,
  gliding,
  reducedMotion,
  frameKey,
  tablet,
  labelled = true,
  testID = 'raft',
  children,
}: {
  scene: RaftScene
  rect: Rect
  total: number
  splashing: boolean
  gliding: boolean
  reducedMotion: boolean
  frameKey: string
  tablet: boolean
  labelled?: boolean
  testID?: string
  children?: ReactNode
}) {
  const { dock, target } = scene
  const offset = { x: rect.x - dock.x, y: rect.y - dock.y }
  const x = useSharedValue(offset.x)
  const y = useSharedValue(offset.y)
  const sink = useSharedValue(0)
  const rot = useSharedValue(0)
  const dim = useSharedValue(1)
  const bob = useSharedValue(0)
  const oar = useSharedValue(0)
  const frameRef = useRef(frameKey)

  const depth = splashing
    ? 0.4 * dock.height
    : (Math.min(total, target) / target) * 0.12 * dock.height

  useEffect(() => {
    const jump = frameRef.current !== frameKey
    frameRef.current = frameKey
    if (jump) {
      x.set(offset.x)
      y.set(offset.y)
      return
    }
    const ms = offset.x === 0 && offset.y === 0 ? RETURN_MS : GLIDE_MS
    const t = reducedMotion
      ? {
          duration:
            offset.x === 0 && offset.y === 0
              ? REDUCED_RETURN_MS
              : REDUCED_GLIDE_MS,
        }
      : { duration: ms, easing: Easing.inOut(Easing.quad) }
    x.set(withTiming(offset.x, t))
    y.set(withTiming(offset.y, t))
    // Animate on a new target; a new layout jumps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset.x, offset.y, frameKey])

  useEffect(() => {
    sink.set(withTiming(depth, { duration: reducedMotion ? FADE_MS : 300 }))
  }, [depth, reducedMotion, sink])

  useEffect(() => {
    if (!splashing) return
    if (reducedMotion) {
      dim.set(
        withSequence(
          withTiming(0.7, { duration: 150 }),
          withTiming(1, { duration: 150 }),
        ),
      )
      return
    }
    const s = { duration: WOBBLE_MS / 6, easing: Easing.out(Easing.quad) }
    rot.set(
      withSequence(
        withTiming(6, s),
        withTiming(-6, s),
        withTiming(6, s),
        withTiming(-6, s),
        withTiming(4, s),
        withTiming(0, s),
      ),
    )
  }, [splashing, reducedMotion, rot, dim])

  useEffect(() => {
    if (!gliding || reducedMotion) {
      bob.set(0)
      oar.set(0)
      return
    }
    bob.set(
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 600 }),
          withTiming(3, { duration: 600 }),
        ),
        Math.ceil(GLIDE_MS / 1200),
        true,
      ),
    )
    oar.set(
      withRepeat(
        withSequence(
          withTiming(20, { duration: 250 }),
          withTiming(-20, { duration: 250 }),
        ),
        Math.ceil(GLIDE_MS / 500),
        true,
      ),
    )
  }, [gliding, reducedMotion, bob, oar])

  const moved = useAnimatedStyle(() => ({
    opacity: dim.get(),
    transform: [
      { translateX: x.get() },
      { translateY: y.get() + sink.get() + bob.get() },
      { rotate: `${rot.get()}deg` },
    ],
  }))
  const oarStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${oar.get()}deg` }],
  }))
  const a = scene.a
  const flag = scene.flag
  const board = targetBoard(scene)
  /** The base's depth: 1 on tablets, 0.75 on phones. */
  const kd = tablet ? 1 : 0.75
  const log = dock.height / 5
  const mastW = Math.max(6, 0.07 * a)
  return (
    <Animated.View
      testID={testID}
      accessible={labelled}
      accessibilityLabel={labelled ? raftLabel(target, total) : undefined}
      pointerEvents="box-none"
      style={[styles.abs, rectStyle(dock), moved]}
    >
      {splashing && !reducedMotion && <View testID="raft-wobble" />}
      {splashing && reducedMotion && <View testID="raft-dim" />}
      {gliding && !reducedMotion && <View testID="raft-rowing" />}
      <View pointerEvents="none" style={styles.fill}>
        <View
          testID="raft-deck"
          style={[
            styles.fill,
            styles.deck,
            {
              borderRadius: 0.14 * a,
              boxShadow: `0 ${8 * kd}px 0 ${WOOD_RIM}, 0 ${14 * kd}px ${18 * kd}px rgba(60, 30, 10, 0.3)`,
            },
          ]}
        />
        {/* Five logs, 2 pt apart: the base shows between them. */}
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            testID="raft-log"
            style={[
              styles.log,
              {
                top: i * log + 1,
                height: log - 2,
                borderRadius: (log - 2) / 2,
              },
            ]}
          />
        ))}
        {[0.2, 0.8].map((f) => (
          <View
            key={f}
            testID="raft-rope"
            style={[
              styles.rope,
              {
                left: f * dock.width - 0.05 * a,
                width: 0.1 * a,
                height: dock.height + 4,
                borderRadius: 0.05 * a,
              },
            ]}
          />
        ))}
      </View>
      {/* The mast and its flag, at the back-left corner: the mast's right
          edge stays 1 pt under the flag, as at its old 4 pt width. */}
      <View
        pointerEvents="none"
        style={[
          styles.mast,
          { left: 8 - mastW, width: mastW, top: flag.y, height: -flag.y + 12 },
        ]}
      />
      <View
        testID="raft-flag-box"
        pointerEvents="none"
        style={[
          styles.flag,
          {
            left: 7,
            top: flag.y,
            width: flag.width,
            height: flag.height,
            borderRadius: 0.08 * a,
          },
        ]}
      >
        <Text
          testID="raft-flag"
          allowFontScaling={false}
          style={[styles.flagText, { fontSize: 0.26 * a }]}
        >
          {total === 0 ? '' : String(Math.min(total, target))}
        </Text>
      </View>
      {/* The oar along the right edge. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.oar,
          {
            right: -6,
            top: 0.15 * dock.height,
            width: tablet ? 10 : 8,
            height: 0.7 * dock.height,
          },
          oarStyle,
        ]}
      />
      {children}
      {/* The target board, above the seated animals (§ 4.3). */}
      <View
        testID="raft-target-board"
        pointerEvents="none"
        style={[
          styles.tag,
          rectStyle(board),
          {
            borderRadius: 0.1 * a,
            boxShadow: tablet ? TAG_SHADOW.tablet : TAG_SHADOW.phone,
          },
        ]}
      >
        <Text
          testID="raft-target"
          allowFontScaling={false}
          style={[styles.tagText, { fontSize: 0.26 * a }]}
        >
          {String(target)}
        </Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  abs: { position: 'absolute' },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tag: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TILE,
    experimental_backgroundImage: TILE_FACE,
  },
  tagText: { fontFamily: fonts.bold, color: TAG_TEXT },
  bush: {
    backgroundColor: '#6cc655',
    experimental_backgroundImage: 'linear-gradient(#7fd364, #5cb945)',
  },
  deck: { backgroundColor: WOOD_RIM },
  log: {
    position: 'absolute',
    left: 2,
    right: 2,
    backgroundColor: WOOD,
    experimental_backgroundImage:
      'linear-gradient(#e7b07a 0%, #c98a55 55%, #a86c3c 100%)',
    boxShadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.3)',
  },
  rope: {
    position: 'absolute',
    top: -2,
    backgroundColor: '#f2d3a6',
    boxShadow: 'inset 0 -3px 0 rgba(125, 74, 38, 0.3)',
  },
  mast: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: WOOD_RIM,
    experimental_backgroundImage: `linear-gradient(90deg, #a86c3c, ${WOOD_RIM})`,
  },
  flag: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TILE,
    experimental_backgroundImage: 'linear-gradient(#fffdf8, #fff1e2)',
    boxShadow:
      'inset 0 2px 0 #ffffff, 0 3px 0 #efcfb4, 0 6px 8px rgba(90, 45, 20, 0.16)',
  },
  flagText: { fontFamily: fonts.bold, color: TAG_TEXT },
  oar: {
    position: 'absolute',
    borderRadius: 6,
    backgroundColor: WOOD_RIM,
    experimental_backgroundImage: `linear-gradient(90deg, ${WOOD}, ${WOOD_RIM})`,
    boxShadow: `0 3px 0 ${WOOD_RIM}`,
  },
})
