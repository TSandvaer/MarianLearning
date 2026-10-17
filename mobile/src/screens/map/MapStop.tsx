/**
 * One stop on the map (web `StopView`, `src/screens/Map/mapParts.tsx`): a
 * clay plinth, the step's sticker, and per state a padlock (locked), the
 * flower badge (mastered) or the bud tray (current). The unlock beat adds
 * the bloom, the padlock pop and the frost fading off. No press visual
 * (web), except on a stop whose tap starts a session (native, Map
 * tap-to-play `design/native/map-tap-to-play.md` § 2): press-in scales the
 * sticker 1 → 0.94 over 120 ms, and the launch pops it 0.94 → 1.08 → 1
 * (spring 300 / 14). Reduce Motion: neither.
 *
 * The box is the stop × s (map-native § 1), lifted to a 44 pt hit area by
 * `hitSlop`; the current stop's bottom slop also covers its bud tray,
 * which sits inside the stop's button on the web.
 */
import type { MapStop } from '@marian/core/map/mapModel'
import { STAGE_SPOKEN_NAMES } from '@marian/core/sessionEnd/friendlyNodeName'
import { useEffect } from 'react'
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { imageShadow } from '../../components/imageShadow'
import { PathImage } from '../../components/PathImage'
import { hitSlopFor } from '../../layout/mapScreenLayout'
import { PRESS_MS } from '../hub/clay'
import { BudTray, ClayOval, SparkleBurst } from './mapFx'
import {
  formatMapStop,
  type HitRect,
  type MapDebugLog,
  type MapTapPoint,
} from './mapTapLog'
import { budTrayHeight, lockBox } from './stopGeometry'
import { FlowerBadge, PadlockPop, Sticker } from './stopParts'

export interface MapStopProps {
  stop: MapStop
  /** Centre and size, pt. */
  x: number
  y: number
  size: number
  /** pt per web px. */
  s: number
  reducedMotion: boolean
  /** Unlock beat: the just-mastered stop's flower badge blooms in. */
  bloom: boolean
  /** Unlock beat: the padlock pops and the frost fades off. */
  popping: boolean
  /** Bumped on every tap of a locked stop: one "not yet" wiggle. */
  wiggle: number
  /** The tap starts a session: the press-in visual (map-tap-to-play § 2.1). */
  launches?: boolean
  /** The launch is under way: the pop (§ 2.2). */
  launching?: boolean
  /** `tap`: where it landed and this stop's hit rect (the debug log). */
  onPress: (tap: MapTapPoint) => void
  /** Debug only: logs this stop's hit rect once on mount. */
  debugLog?: MapDebugLog
}

/** § 2.1: the press-in scale. */
export const PRESS_SCALE = 0.94
/** § 2.2: the pop's overshoot. */
export const POP_SCALE = 1.08
/** § 2.2: the pop's spring (the app's 300 / 14, as MissingNumber's bloom). */
const POP_SPRING = { stiffness: 300, damping: 14, mass: 1 }

export function MapStopView({
  stop,
  x,
  y,
  size,
  s,
  reducedMotion,
  bloom,
  popping,
  wiggle,
  launches = false,
  launching = false,
  onPress,
  debugLog,
}: MapStopProps) {
  const locked = stop.state === 'locked'
  const scale = useSharedValue(1)
  const pressable = launches && !reducedMotion
  useEffect(() => {
    if (!launching || reducedMotion) return
    scale.set(
      withSequence(
        withSpring(POP_SCALE, POP_SPRING),
        withSpring(1, POP_SPRING),
      ),
    )
  }, [launching, reducedMotion, scale])
  const press = (down: boolean) => {
    if (!pressable || launching) return
    scale.set(withTiming(down ? PRESS_SCALE : 1, { duration: PRESS_MS }))
  }
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }))
  const sticker = size * 0.84
  const lock = size * 0.46
  const tray = stop.state === 'current' && stop.buds.length > 0
  const slop = hitSlopFor(size)
  const trayTop = size * 1.02
  const below = tray ? trayTop + budTrayHeight(stop.buds, s) - size : 0
  const bottomSlop = Math.max(slop, below)
  // The touchable area: the box grown by its hitSlop (path-layer pt).
  const rect: HitRect = {
    x: x - size / 2 - slop,
    y: y - size / 2 - slop,
    width: size + 2 * slop,
    height: size + slop + bottomSlop,
  }
  useEffect(() => {
    debugLog?.(formatMapStop(stop.node, stop.state, rect))
    // Once on mount (debug only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pressed = (e: GestureResponderEvent) => {
    const ev = e?.nativeEvent as Partial<GestureResponderEvent['nativeEvent']>
    onPress({
      pageX: ev?.pageX ?? Number.NaN,
      pageY: ev?.pageY ?? Number.NaN,
      locationX: ev?.locationX ?? Number.NaN,
      locationY: ev?.locationY ?? Number.NaN,
      rect,
    })
  }
  return (
    <Pressable
      testID={`map-stop-${stop.node}`}
      accessibilityRole="button"
      accessibilityLabel={STAGE_SPOKEN_NAMES[stop.node]}
      onPress={pressed}
      onPressIn={() => press(true)}
      onPressOut={() => press(false)}
      hitSlop={{
        left: slop,
        right: slop,
        top: slop,
        bottom: bottomSlop,
      }}
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
          w={size * 0.92}
          h={size * 0.42}
          drop={(locked ? 6 : 7) * s}
          stops={
            locked
              ? ['#fffdf8', '#f3e8d8', '#e2d0b6']
              : ['#fffaf0', '#efdcc0', '#d6b890']
          }
          slab={locked ? '#cdb592' : '#b8946a'}
          soft={
            locked
              ? { dy: 9 * s, blur: 10 * s, color: 'rgba(60,30,10,0.12)' }
              : { dy: 10 * s, blur: 12 * s, color: 'rgba(60,30,10,0.2)' }
          }
        />
      </View>
      <Animated.View
        testID={launching ? `map-stop-launching-${stop.node}` : undefined}
        pointerEvents="none"
        style={[
          styles.abs,
          {
            left: (size - sticker) / 2,
            top: size * 0.08,
            width: sticker,
            height: sticker,
          },
          pressStyle,
        ]}
      >
        <Sticker
          stop={stop}
          px={sticker}
          left={0}
          top={0}
          s={s}
          wiggle={wiggle}
          popping={popping}
          reducedMotion={reducedMotion}
        />
      </Animated.View>
      {locked && (
        <View
          testID="map-stop-padlock"
          style={[lockBox(lock), imageShadow(3 * s, 2 * s, 'rgba(0,0,0,0.25)')]}
        >
          <PathImage id="ui-padlock" px={lock} />
        </View>
      )}
      {popping && <PadlockPop px={lock} reducedMotion={reducedMotion} />}
      {popping && !reducedMotion && (
        <SparkleBurst
          count={8}
          radius={size * 0.7}
          s={s}
          testID="map-pop-sparkles"
        />
      )}
      {stop.state === 'mastered' && (
        <FlowerBadge
          px={size * 0.4}
          s={s}
          bloom={bloom}
          reducedMotion={reducedMotion}
        />
      )}
      {tray && (
        <BudTray buds={stop.buds} top={trayTop} centre={size / 2} s={s} />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
})
