/**
 * The moving parts of a map stop (web `StopView` in `src/screens/Map/
 * mapParts.tsx`): the sticker (locked frost, wiggle, nearly-there pulse,
 * the pop's frost fade), the padlock pop and the flower badge. Sizes in
 * pt; `s` scales the web's fixed px (shadows).
 *
 * Locked frost (map-native § 5): the baked `-256-locked` sticker (web
 * `saturate(.2) brightness(1.12)`) drawn at opacity .62 with its shadow.
 */
import type { MapStop } from '@marian/core/map/mapModel'
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { pathArtLockedAsset } from '../../assets'
import { imageShadow } from '../../components/imageShadow'
import { PathImage } from '../../components/PathImage'
import { useLoop } from './mapMotion'
import { lockBox } from './stopGeometry'

/** Web `opacity(0.62)` of the locked filter. */
export const FROST_OPACITY = 0.62

function Frost({ id, px }: { id: MapStop['node']; px: number }) {
  return (
    <Image
      source={pathArtLockedAsset(id)}
      contentFit="contain"
      accessible={false}
      style={{ width: px, height: px, opacity: FROST_OPACITY }}
    />
  )
}

/** The sticker: wiggles once per locked tap; pulses when nearly there. */
export function Sticker({
  stop,
  px,
  top,
  left,
  s,
  wiggle,
  popping,
  reducedMotion,
}: {
  stop: MapStop
  px: number
  top: number
  left: number
  s: number
  wiggle: number
  popping: boolean
  reducedMotion: boolean
}) {
  const rotate = useSharedValue(0)
  const pulsing = stop.nearlyThere && !reducedMotion
  const pulse = useLoop(2000, !pulsing)
  useEffect(() => {
    if (wiggle === 0 || reducedMotion) return
    const step = (deg: number) => withTiming(deg, { duration: 125 })
    rotate.set(withSequence(step(-7), step(7), step(-4), step(0)))
  }, [wiggle, reducedMotion, rotate])
  const motion = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.get()}deg` }],
    opacity: pulsing ? 0.6 + 0.4 * pulse.get() : 1,
  }))
  const fade = useSharedValue(1)
  useEffect(() => {
    if (popping) fade.set(withTiming(0, { duration: 400 }))
  }, [popping, fade])
  const frostFade = useAnimatedStyle(() => ({ opacity: fade.get() }))
  const locked = stop.state === 'locked'
  return (
    <Animated.View
      testID={stop.nearlyThere ? 'map-stop-nearly-there' : undefined}
      style={[styles.abs, { left, top, width: px, height: px }, motion]}
    >
      <View
        style={
          locked
            ? imageShadow(4 * s, 3 * s, 'rgba(60,30,10,0.12)')
            : imageShadow(5 * s, 3 * s, 'rgba(60,30,10,0.25)')
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

/** Padlock scale 1 → 1.35 → 0, opacity 1 → 1 → 0 (400 ms). */
export function PadlockPop({
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
    const scale = v < 0.5 ? 1 + 0.7 * v : 1.35 * (2 - 2 * v)
    return { opacity: v < 0.5 ? 1 : 2 - 2 * v, transform: [{ scale }] }
  })
  return (
    <Animated.View testID="map-padlock-pop" style={[lockBox(px), pop]}>
      <PathImage id="ui-padlock" px={px} />
    </Animated.View>
  )
}

/** A mastered stop's flower; on the beat it blooms in (scale 0 → 1, 300 ms). */
export function FlowerBadge({
  px,
  s,
  bloom,
  reducedMotion,
}: {
  px: number
  s: number
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
      style={[styles.badge, show, imageShadow(3 * s, 2 * s, 'rgba(0,0,0,0.2)')]}
    >
      <PathImage id="ui-bloom" px={px} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  badge: { position: 'absolute', right: '-8%', top: '-8%' },
})
