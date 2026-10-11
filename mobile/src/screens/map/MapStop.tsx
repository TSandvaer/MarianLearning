/**
 * One stop on the map (web `StopView`, `src/screens/Map/mapParts.tsx`): a
 * clay plinth, the step's sticker, and per state a padlock (locked), the
 * flower badge (mastered) or the bud tray (current). The unlock beat adds
 * the bloom, the padlock pop and the frost fading off. No press visual
 * (web).
 *
 * The box is the stop × s (map-native § 1), lifted to a 44 pt hit area by
 * `hitSlop`; the current stop's bottom slop also covers its bud tray,
 * which sits inside the stop's button on the web.
 */
import type { MapStop } from '@marian/core/map/mapModel'
import { STAGE_SPOKEN_NAMES } from '@marian/core/sessionEnd/friendlyNodeName'
import { Pressable, StyleSheet, View } from 'react-native'
import { imageShadow } from '../../components/imageShadow'
import { PathImage } from '../../components/PathImage'
import { hitSlopFor } from '../../layout/mapScreenLayout'
import { BudTray, ClayOval, SparkleBurst } from './mapFx'
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
  onPress: () => void
}

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
  onPress,
}: MapStopProps) {
  const locked = stop.state === 'locked'
  const sticker = size * 0.84
  const lock = size * 0.46
  const tray = stop.state === 'current' && stop.buds.length > 0
  const slop = hitSlopFor(size)
  const trayTop = size * 1.02
  const below = tray ? trayTop + budTrayHeight(stop.buds, s) - size : 0
  return (
    <Pressable
      testID={`map-stop-${stop.node}`}
      accessibilityRole="button"
      accessibilityLabel={STAGE_SPOKEN_NAMES[stop.node]}
      onPress={onPress}
      hitSlop={{
        left: slop,
        right: slop,
        top: slop,
        bottom: Math.max(slop, below),
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
      <Sticker
        stop={stop}
        px={sticker}
        left={(size - sticker) / 2}
        top={size * 0.08}
        s={s}
        wiggle={wiggle}
        popping={popping}
        reducedMotion={reducedMotion}
      />
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
