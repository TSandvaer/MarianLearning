/**
 * A garden-arch gate between two lands (web `GateView`,
 * `src/screens/Map/mapParts.tsx`). The closed arch art carries its own
 * padlock. On a land beat the closed arch swells and fades off the open
 * one (0.6 s) with a burst of 12 sparkles; Reduce Motion: a 0.2 s fade.
 * The box is the web's 88 px × s, lifted to 44 pt by `hitSlop`. No press
 * visual (web).
 */
import { useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { imageShadow } from '../../components/imageShadow'
import { PathImage } from '../../components/PathImage'
import { hitSlopFor } from '../../layout/mapScreenLayout'
import { SparkleBurst } from './mapFx'

export interface MapGateProps {
  land: number
  open: boolean
  /** Centre and square box, pt. */
  x: number
  y: number
  size: number
  s: number
  swinging: boolean
  reducedMotion: boolean
  onPress: () => void
}

function Swing({
  art,
  offset,
  reducedMotion,
}: {
  art: number
  offset: number
  reducedMotion: boolean
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.set(withTiming(1, { duration: reducedMotion ? 200 : 600 }))
  }, [t, reducedMotion])
  const swing = useAnimatedStyle(() => {
    const v = t.get()
    if (reducedMotion) return { opacity: 1 - v }
    // Framer keyframes: opacity [1, 1, 0], scale [1, 1.12, 1.2] at 0, .5, 1.
    return {
      opacity: v < 0.5 ? 1 : 2 - 2 * v,
      transform: [{ scale: v < 0.5 ? 1 + 0.24 * v : 1.12 + 0.16 * (v - 0.5) }],
    }
  })
  return (
    <Animated.View
      testID="map-gate-swing"
      style={[styles.abs, { left: offset, top: offset }, swing]}
    >
      <PathImage id="ui-arch-closed" px={art} />
    </Animated.View>
  )
}

export function MapGateView({
  land,
  open,
  x,
  y,
  size,
  s,
  swinging,
  reducedMotion,
  onPress,
}: MapGateProps) {
  const art = size * 1.1
  const offset = (size - art) / 2
  const slop = hitSlopFor(size)
  return (
    <Pressable
      testID={`map-gate-${land}`}
      accessibilityRole="button"
      accessibilityLabel={`Land ${land}`}
      onPress={onPress}
      hitSlop={slop}
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
        testID={open ? 'map-gate-open' : 'map-gate-closed'}
        style={[
          styles.abs,
          { left: offset, top: offset },
          imageShadow(5 * s, 3 * s, 'rgba(60,30,10,0.25)'),
        ]}
      >
        <PathImage id={open ? 'ui-arch-open' : 'ui-arch-closed'} px={art} />
      </View>
      {swinging && (
        <Swing art={art} offset={offset} reducedMotion={reducedMotion} />
      )}
      {swinging && !reducedMotion && (
        <SparkleBurst
          count={12}
          radius={64 * s}
          s={s}
          testID="map-gate-sparkles"
        />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
})
