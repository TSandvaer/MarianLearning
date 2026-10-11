/**
 * Small clay pieces of the map (web `src/screens/Map/mapParts.tsx` +
 * `MapScreen.tsx`): stepping stones, the current stop's glow, the pop
 * sparkles, a stop's plinth and the bud tray. Sizes are the web's px in
 * the path's virtual space (the path view scales them all together).
 *
 * Ovals are SVG ellipses: on iOS a `'50%'` radius on a non-square view
 * draws a lens, and its box shadow a pill (the Hub's plinth).
 */
import { budHoleSize } from '@marian/core/map/mapLayout'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg'
import { PathImage } from '../../components/PathImage'
import { imageShadow } from '../hub/clay'
import { useLoop } from './mapMotion'

const GOLD = '#ffd23f'
/** Framer `easeOut`. */
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)

/** A soft oval: radial face (45% 30%) over a solid slab `drop` below. */
export function ClayOval({
  w,
  h,
  drop,
  stops,
  slab,
  id,
}: {
  w: number
  h: number
  drop: number
  /** Face gradient: centre, 60%, edge. */
  stops: readonly [string, string, string]
  slab: string
  id: string
}) {
  return (
    <Svg width={w} height={h + drop} style={styles.overflow}>
      <Defs>
        <RadialGradient
          id={id}
          cx="45%"
          cy="30%"
          rx="78%"
          ry="99%"
          fx="45%"
          fy="30%"
        >
          <Stop offset="0" stopColor={stops[0]} />
          <Stop offset="0.6" stopColor={stops[1]} />
          <Stop offset="1" stopColor={stops[2]} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={w / 2} cy={h / 2 + drop} rx={w / 2} ry={h / 2} fill={slab} />
      <Ellipse
        cx={w / 2}
        cy={h / 2}
        rx={w / 2}
        ry={h / 2}
        fill={`url(#${id})`}
      />
    </Svg>
  )
}

/** A stepping stone, 38×20 at (x, y): pink once walked. */
export function StoneView({
  x,
  y,
  walked,
  index,
}: {
  x: number
  y: number
  walked: boolean
  index: number
}) {
  return (
    <View
      testID={walked ? 'map-stone-walked' : 'map-stone'}
      pointerEvents="none"
      style={[styles.abs, { left: x - 19, top: y - 10, zIndex: 1 }]}
    >
      <ClayOval
        id={`stone-${index}`}
        w={38}
        h={20}
        drop={4}
        stops={
          walked
            ? ['#ffe3ee', '#ff9fbf', '#f07aa2']
            : ['#fffaf0', '#ead6b8', '#cdb08a']
        }
        slab={walked ? '#c9577f' : '#b39268'}
      />
    </View>
  )
}

/**
 * The gold halo behind the current stop (and Emma): 1.5 × the stop, its
 * shadow pulsing over 2.4 s. The peak shadow is a second layer whose
 * opacity loops (Reanimated can't tween a shadow string).
 */
export function CurrentGlow({
  x,
  y,
  size,
  reducedMotion,
}: {
  x: number
  y: number
  size: number
  reducedMotion: boolean
}) {
  const d = Math.round(size * 1.5)
  const t = useLoop(2400, reducedMotion)
  const peak = useAnimatedStyle(() => ({ opacity: t.get() }))
  const disc = {
    left: x - d / 2,
    top: y - d / 2,
    width: d,
    height: d,
    borderRadius: d / 2,
    zIndex: 1,
  }
  return (
    <>
      <View
        testID="map-current-glow"
        pointerEvents="none"
        style={[
          styles.abs,
          disc,
          {
            experimental_backgroundImage:
              'radial-gradient(circle, #fff7c2 0%, #ffe066aa 42%, #ffd23f00 70%)',
            boxShadow: '0 0 0 5px #ffe27a, 0 0 30px 8px #ffd23f88',
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          disc,
          { boxShadow: '0 0 0 5px #fff0a8, 0 0 44px 14px #ffd23fbb' },
          peak,
        ]}
      />
    </>
  )
}

function Sparkle({
  angle,
  radius,
  pink,
}: {
  angle: number
  radius: number
  pink: boolean
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.set(withTiming(1, { duration: 600, easing: EASE_OUT }))
  }, [t])
  const fly = useAnimatedStyle(() => ({
    opacity: 1 - t.get(),
    transform: [
      { translateX: Math.cos(angle) * radius * t.get() },
      { translateY: Math.sin(angle) * radius * t.get() },
      { scale: 1 - 0.6 * t.get() },
    ],
  }))
  return (
    <Animated.View
      style={[
        styles.abs,
        styles.dot,
        { backgroundColor: pink ? '#ff8fb1' : GOLD },
        fly,
      ]}
    />
  )
}

/** `count` sparkles flying out from a box's centre (spec §6 pops). */
export function SparkleBurst({
  count,
  radius,
  testID,
}: {
  count: number
  radius: number
  testID: string
}) {
  return (
    <View testID={testID} pointerEvents="none" style={styles.centre}>
      {Array.from({ length: count }, (_, i) => (
        <Sparkle
          key={i}
          angle={(i / count) * Math.PI * 2}
          radius={radius}
          pink={i % 2 === 1}
        />
      ))}
    </View>
  )
}

/** Clay seed tray under the current stop: one hole per good day needed. */
export function BudTray({
  buds,
  top,
  centre,
}: {
  buds: readonly (readonly boolean[])[]
  top: number
  /** The stop's centre x, relative to the stop box. */
  centre: number
}) {
  const hole = budHoleSize(buds)
  const groupGap = hole > 30 ? 4 : 10
  const width =
    20 +
    buds.reduce((w, g) => w + g.length * hole + (g.length - 1) * 3, 0) +
    (buds.length - 1) * groupGap
  return (
    <View
      testID="map-buds"
      pointerEvents="none"
      style={[
        styles.tray,
        { top, left: centre - width / 2, width, gap: groupGap },
      ]}
    >
      {buds.map((group, gi) => (
        <View key={gi} style={styles.group}>
          {group.map((open, i) => (
            <View
              key={i}
              testID={open ? 'map-bud-open' : 'map-bud'}
              style={[
                styles.hole,
                { width: hole, height: hole, borderRadius: hole / 2 },
              ]}
            >
              {open && (
                <View
                  style={[
                    styles.abs,
                    { left: 0, bottom: Math.round(hole * 0.08) },
                    imageShadow(2, 2, 'rgba(0,0,0,0.3)'),
                  ]}
                >
                  <PathImage id="ui-bud-open" px={hole} />
                </View>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  overflow: { overflow: 'visible' },
  centre: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
  },
  dot: { width: 10, height: 10, left: -5, top: -5, borderRadius: 5 },
  tray: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 30,
    backgroundColor: '#b57948',
    experimental_backgroundImage: 'linear-gradient(#c58a55, #a86c3c)',
    boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.2), 0 5px 0 #7d4a26',
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  hole: {
    experimental_backgroundImage:
      'radial-gradient(circle at 50% 62%, #6b4128 0%, #4e2c19 60%, #3d2112 100%)',
    backgroundColor: '#4e2c19',
    boxShadow:
      'inset 0 6px 8px rgba(0,0,0,0.45), 0 2px 0 rgba(255,255,255,0.35)',
  },
})
