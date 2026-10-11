/**
 * One stop on the map (web `StopView`, `src/screens/Map/mapParts.tsx`): a
 * clay plinth, the step's sticker, and per state a padlock (locked), the
 * flower badge (mastered) or the bud tray (current). The unlock beat adds
 * the bloom, the padlock pop and the frost fading off.
 *
 * Locked frost: the web filters the sticker (`saturate(.2) brightness(1.12)
 * opacity(.62)`). iOS can't saturate and a brightness filter paints a grey
 * box behind a transparent image, so the native frost is the baked muted
 * sticker (`-256-muted`, hub-native § 6) at opacity .62.
 */
import type { MapStop } from '@marian/core/map/mapModel'
import { STAGE_SPOKEN_NAMES } from '@marian/core/sessionEnd/friendlyNodeName'
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { pathArtMutedAsset } from '../../assets'
import { PathImage } from '../../components/PathImage'
import { imageShadow } from '../hub/clay'
import { BudTray, ClayOval, SparkleBurst } from './mapFx'
import { useLoop } from './mapMotion'

/** Web `opacity(0.62)` of the locked filter. */
export const FROST_OPACITY = 0.62

export interface MapStopProps {
  stop: MapStop
  x: number
  y: number
  size: number
  reducedMotion: boolean
  /** Unlock beat: the just-mastered stop's flower badge blooms in. */
  bloom: boolean
  /** Unlock beat: the padlock pops and the frost fades off. */
  popping: boolean
  /** Bumped on every tap of a locked stop: one "not yet" wiggle. */
  wiggle: number
  onPress: () => void
}

function Frost({ id, px }: { id: MapStop['node']; px: number }) {
  return (
    <Image
      source={pathArtMutedAsset(id)}
      contentFit="contain"
      accessible={false}
      style={{ width: px, height: px, opacity: FROST_OPACITY }}
    />
  )
}

/** The sticker: wiggles once per locked tap; pulses when nearly there. */
function Sticker({
  stop,
  px,
  top,
  left,
  wiggle,
  popping,
  reducedMotion,
}: {
  stop: MapStop
  px: number
  top: number
  left: number
  wiggle: number
  popping: boolean
  reducedMotion: boolean
}) {
  const rotate = useSharedValue(0)
  const pulse = useLoop(2000, reducedMotion || !stop.nearlyThere)
  useEffect(() => {
    if (wiggle === 0 || reducedMotion) return
    const step = (deg: number) => withTiming(deg, { duration: 125 })
    rotate.set(withSequence(step(-7), step(7), step(-4), step(0)))
  }, [wiggle, reducedMotion, rotate])
  const motion = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.get()}deg` }],
    opacity: stop.nearlyThere && !reducedMotion ? 0.6 + 0.4 * pulse.get() : 1,
  }))
  const locked = stop.state === 'locked'
  const fade = useSharedValue(1)
  useEffect(() => {
    if (popping) fade.set(withTiming(0, { duration: 400 }))
  }, [popping, fade])
  const frostFade = useAnimatedStyle(() => ({ opacity: fade.get() }))
  return (
    <Animated.View
      testID={stop.nearlyThere ? 'map-stop-nearly-there' : undefined}
      style={[styles.abs, { left, top, width: px, height: px }, motion]}
    >
      <View
        style={
          locked
            ? imageShadow(4, 3, 'rgba(60,30,10,0.12)')
            : imageShadow(5, 3, 'rgba(60,30,10,0.25)')
        }
      >
        {locked ? (
          <View testID="map-stop-frost">
            <Frost id={stop.node} px={px} />
          </View>
        ) : (
          <PathImage id={stop.node} px={px} />
        )}
      </View>
      {popping && (
        <Animated.View
          testID="map-frost-fade"
          style={[StyleSheet.absoluteFill, frostFade]}
        >
          <Frost id={stop.node} px={px} />
        </Animated.View>
      )}
    </Animated.View>
  )
}

function PadlockPop({
  px,
  reducedMotion,
}: {
  px: number
  reducedMotion: boolean
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.set(withTiming(1, { duration: reducedMotion ? 200 : 400 }))
  }, [t, reducedMotion])
  const pop = useAnimatedStyle(() => {
    const v = t.get()
    if (reducedMotion) return { opacity: 1 - v }
    // Framer keyframes [1, 1.35, 0] / [1, 1, 0] at 0, .5, 1.
    const scale = v < 0.5 ? 1 + 0.7 * v : 1.35 * (2 - 2 * v)
    return { opacity: v < 0.5 ? 1 : 2 - 2 * v, transform: [{ scale }] }
  })
  return (
    <Animated.View testID="map-padlock-pop" style={[styles.lock(px), pop]}>
      <PathImage id="ui-padlock" px={px} />
    </Animated.View>
  )
}

function FlowerBadge({
  px,
  bloom,
  reducedMotion,
}: {
  px: number
  bloom: boolean
  reducedMotion: boolean
}) {
  const t = useSharedValue(bloom ? 0 : 1)
  useEffect(() => {
    if (bloom) t.set(withTiming(1, { duration: reducedMotion ? 200 : 300 }))
  }, [bloom, reducedMotion, t])
  const show = useAnimatedStyle(() =>
    reducedMotion ? { opacity: t.get() } : { transform: [{ scale: t.get() }] },
  )
  return (
    <Animated.View
      testID={bloom ? 'map-flower-bloom' : 'map-flower-badge'}
      style={[styles.badge, show, imageShadow(3, 2, 'rgba(0,0,0,0.2)')]}
    >
      <PathImage id="ui-bloom" px={px} />
    </Animated.View>
  )
}

export function MapStopView({
  stop,
  x,
  y,
  size,
  reducedMotion,
  bloom,
  popping,
  wiggle,
  onPress,
}: MapStopProps) {
  const locked = stop.state === 'locked'
  const sticker = Math.round(size * 0.84)
  const lock = Math.round(size * 0.46)
  const plinthW = size * 0.92
  const plinthH = size * 0.42
  return (
    <Pressable
      testID={`map-stop-${stop.node}`}
      accessibilityRole="button"
      accessibilityLabel={STAGE_SPOKEN_NAMES[stop.node]}
      onPress={onPress}
      style={[
        styles.abs,
        {
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          zIndex: 3,
        },
      ]}
    >
      <View
        testID={`map-stop-state-${stop.state}`}
        pointerEvents="none"
        style={[styles.abs, { left: size * 0.04, top: size * 0.64 }]}
      >
        <ClayOval
          id={`plinth-${stop.node}`}
          w={plinthW}
          h={plinthH}
          drop={locked ? 6 : 7}
          stops={
            locked
              ? ['#fffdf8', '#f3e8d8', '#e2d0b6']
              : ['#fffaf0', '#efdcc0', '#d6b890']
          }
          slab={locked ? '#cdb592' : '#b8946a'}
        />
      </View>
      <Sticker
        stop={stop}
        px={sticker}
        left={(size - sticker) / 2}
        top={Math.round(size * 0.08)}
        wiggle={wiggle}
        popping={popping}
        reducedMotion={reducedMotion}
      />
      {locked && (
        <View
          testID="map-stop-padlock"
          style={[styles.lock(lock), imageShadow(3, 2, 'rgba(0,0,0,0.25)')]}
        >
          <PathImage id="ui-padlock" px={lock} />
        </View>
      )}
      {popping && <PadlockPop px={lock} reducedMotion={reducedMotion} />}
      {popping && !reducedMotion && (
        <SparkleBurst count={8} radius={size * 0.7} testID="map-pop-sparkles" />
      )}
      {stop.state === 'mastered' && (
        <FlowerBadge
          px={Math.round(size * 0.4)}
          bloom={bloom}
          reducedMotion={reducedMotion}
        />
      )}
      {stop.state === 'current' && stop.buds.length > 0 && (
        <BudTray
          buds={stop.buds}
          top={Math.round(size * 1.02)}
          centre={size / 2}
        />
      )}
    </Pressable>
  )
}

const styles = {
  ...StyleSheet.create({
    abs: { position: 'absolute' },
    badge: { position: 'absolute', right: '-8%', top: '-8%' },
  }),
  lock: (px: number) =>
    ({
      position: 'absolute',
      right: '-8%',
      bottom: '-6%',
      width: px,
      height: px,
    }) as const,
}
