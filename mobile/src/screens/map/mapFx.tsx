/**
 * Small clay pieces of the map (web `src/screens/Map/mapParts.tsx` +
 * `MapScreen.tsx`): stepping stones, the current stop's glow, the pop
 * sparkles, a clay oval (stone, plinth) and the bud tray. Positions come
 * in pt; `s` (pt per web px, map-native § 1) scales the web's fixed px:
 * sizes, radii, shadows.
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
import { imageShadow } from '../../components/imageShadow'
import { PathImage } from '../../components/PathImage'
import { useLoop } from './mapMotion'

const GOLD = '#ffd23f'
/** Framer `easeOut`. */
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)

/**
 * A soft oval (pt): radial face (45% 30%) over a solid slab `drop` below,
 * and optionally the web's blurred `0 dy blur color` shadow, drawn as an
 * ellipse fading to transparent (the Hub plinth's approach). The view is
 * `w × (h + drop)` at its top-left; the blur spills outside it.
 */
export function ClayOval({
  w,
  h,
  drop,
  stops,
  slab,
  id,
  soft,
}: {
  w: number
  h: number
  drop: number
  /** Face gradient: centre, 60%, edge. */
  stops: readonly [string, string, string]
  slab: string
  id: string
  soft?: { dy: number; blur: number; color: string }
}) {
  const pad = soft ? soft.blur : 0
  const W = w + 2 * pad
  const H = h + Math.max(drop, soft ? soft.dy : 0) + 2 * pad
  const cx = pad + w / 2
  const cy = pad + h / 2
  return (
    <Svg
      width={W}
      height={H}
      style={[styles.overflow, { marginLeft: -pad, marginTop: -pad }]}
    >
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
        {soft && (
          <RadialGradient id={`${id}-soft`} cx="50%" cy="50%" r="50%">
            <Stop offset="0.55" stopColor={soft.color} />
            <Stop offset="1" stopColor={soft.color} stopOpacity={0} />
          </RadialGradient>
        )}
      </Defs>
      {soft && (
        <Ellipse
          cx={cx}
          cy={cy + soft.dy}
          rx={w / 2 + soft.blur / 2}
          ry={h / 2 + soft.blur / 2}
          fill={`url(#${id}-soft)`}
        />
      )}
      <Ellipse cx={cx} cy={cy + drop} rx={w / 2} ry={h / 2} fill={slab} />
      <Ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill={`url(#${id})`} />
    </Svg>
  )
}

/** A stepping stone, 38×20 web px centred at (x, y) pt: pink once walked. */
export function StoneView({
  x,
  y,
  s,
  walked,
  index,
}: {
  x: number
  y: number
  s: number
  walked: boolean
  index: number
}) {
  return (
    <View
      testID={walked ? 'map-stone-walked' : 'map-stone'}
      pointerEvents="none"
      style={[styles.abs, { left: x - 19 * s, top: y - 10 * s, zIndex: 1 }]}
    >
      <ClayOval
        id={`stone-${index}`}
        w={38 * s}
        h={20 * s}
        drop={4 * s}
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
  s,
  reducedMotion,
}: {
  x: number
  y: number
  /** The current stop's size, pt. */
  size: number
  s: number
  reducedMotion: boolean
}) {
  const d = size * 1.5
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
            boxShadow: `0 0 0 ${5 * s}px #ffe27a, 0 0 ${30 * s}px ${8 * s}px #ffd23f88`,
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          disc,
          {
            boxShadow: `0 0 0 ${5 * s}px #fff0a8, 0 0 ${44 * s}px ${14 * s}px #ffd23fbb`,
          },
          peak,
        ]}
      />
    </>
  )
}

function Sparkle({
  angle,
  radius,
  dot,
  pink,
}: {
  angle: number
  radius: number
  dot: number
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
        {
          width: dot,
          height: dot,
          left: -dot / 2,
          top: -dot / 2,
          borderRadius: dot / 2,
          backgroundColor: pink ? '#ff8fb1' : GOLD,
        },
        fly,
      ]}
    />
  )
}

/** `count` sparkles (10 × s) flying `radius` pt out of a box's centre. */
export function SparkleBurst({
  count,
  radius,
  s,
  testID,
}: {
  count: number
  radius: number
  s: number
  testID: string
}) {
  return (
    <View testID={testID} pointerEvents="none" style={styles.centre}>
      {Array.from({ length: count }, (_, i) => (
        <Sparkle
          key={i}
          angle={(i / count) * Math.PI * 2}
          radius={radius}
          dot={10 * s}
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
  s,
}: {
  buds: readonly (readonly boolean[])[]
  /** Top and centre x, pt, relative to the stop's box. */
  top: number
  centre: number
  s: number
}) {
  const holePx = budHoleSize(buds)
  const hole = holePx * s
  const groupGap = (holePx > 30 ? 4 : 10) * s
  const width =
    20 * s +
    buds.reduce((w, g) => w + g.length * hole + (g.length - 1) * 3 * s, 0) +
    (buds.length - 1) * groupGap
  return (
    <View
      testID="map-buds"
      pointerEvents="none"
      style={[
        styles.tray,
        {
          top,
          left: centre - width / 2,
          width,
          gap: groupGap,
          paddingVertical: 4 * s,
          paddingHorizontal: 10 * s,
          borderRadius: 30 * s,
          boxShadow: `inset 0 ${3 * s}px 0 rgba(255,255,255,0.2), 0 ${5 * s}px 0 #7d4a26`,
        },
      ]}
    >
      {buds.map((group, gi) => (
        <View key={gi} style={[styles.group, { gap: 3 * s }]}>
          {group.map((open, i) => (
            <View
              key={i}
              testID={open ? 'map-bud-open' : 'map-bud'}
              style={[
                styles.hole,
                {
                  width: hole,
                  height: hole,
                  borderRadius: hole / 2,
                  boxShadow: `inset 0 ${6 * s}px ${8 * s}px rgba(0,0,0,0.45), 0 ${2 * s}px 0 rgba(255,255,255,0.35)`,
                },
              ]}
            >
              {open && (
                <View
                  style={[
                    styles.abs,
                    { left: 0, bottom: hole * 0.08 },
                    imageShadow(2 * s, 2 * s, 'rgba(0,0,0,0.3)'),
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
  tray: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b57948',
    experimental_backgroundImage: 'linear-gradient(#c58a55, #a86c3c)',
  },
  group: { flexDirection: 'row', alignItems: 'center' },
  hole: {
    experimental_backgroundImage:
      'radial-gradient(circle at 50% 62%, #6b4128 0%, #4e2c19 60%, #3d2112 100%)',
    backgroundColor: '#4e2c19',
  },
})
