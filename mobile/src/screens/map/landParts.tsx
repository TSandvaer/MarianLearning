/**
 * A land on the map (web `MapScreen.tsx` bands + `LandPill`): its tinted
 * clay band and its pill (emblem, plus the land number when the parent
 * allows). Positions in pt; `s` scales the web's fixed px.
 */
import { landArtId } from '@marian/core/emmasPath/pathArt'
import { BAND_INSET, type Side } from '@marian/core/map/mapLayout'
import { BAND_TINTS, INK } from '@marian/core/map/mapTheme'
import type { MasteryTrack } from '@marian/core/progress'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { PathImage } from '../../components/PathImage'
import { fonts } from '../../theme'

/** One land's band; a new land's band fades 0.35 → 1 as its gate swings. */
export function MapBand({
  index,
  land,
  top,
  height,
  s,
  faded,
}: {
  index: number
  land: number
  top: number
  height: number
  s: number
  faded: boolean
}) {
  const [hi, lo] = BAND_TINTS[index % BAND_TINTS.length]!
  const opacity = useSharedValue(faded ? 0.35 : 1)
  useEffect(() => {
    opacity.set(withTiming(faded ? 0.35 : 1, { duration: 600 }))
  }, [faded, opacity])
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return (
    <Animated.View
      testID={`map-band-${land}`}
      pointerEvents="none"
      style={[
        styles.abs,
        {
          left: BAND_INSET * s,
          right: BAND_INSET * s,
          top,
          height,
          borderRadius: 48 * s,
          backgroundColor: lo,
          experimental_backgroundImage: `linear-gradient(${hi}, ${lo})`,
          boxShadow: `inset 0 ${5 * s}px 0 rgba(255,255,255,0.4), inset 0 ${-8 * s}px 0 rgba(0,0,0,0.08), 0 ${10 * s}px 0 ${lo}, 0 ${18 * s}px ${24 * s}px rgba(60,40,10,0.15)`,
        },
        fade,
      ]}
    />
  )
}

/** The land's emblem, plus its number when the parent allows it. */
export function LandPill({
  world,
  land,
  side,
  top,
  s,
  showNumber,
}: {
  world: MasteryTrack
  land: number
  side: Side
  top: number
  s: number
  showNumber: boolean
}) {
  return (
    <View
      testID={`map-land-pill-${land}`}
      pointerEvents="none"
      style={[
        styles.pill,
        {
          [side]: 30 * s,
          top,
          height: 50 * s,
          gap: 2 * s,
          borderRadius: 25 * s,
          paddingLeft: 4 * s,
          paddingRight: (showNumber ? 14 : 4) * s,
          boxShadow: `inset 0 ${3 * s}px 0 #ffffff, 0 ${5 * s}px 0 rgba(90,50,20,0.35)`,
        },
      ]}
    >
      <PathImage id={landArtId({ world, number: land })} px={46 * s} />
      {showNumber && (
        <Text
          testID={`map-land-number-${land}`}
          allowFontScaling={false}
          style={[styles.number, { fontSize: 28 * s, lineHeight: 34 * s }]}
        >
          {land}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  pill: {
    position: 'absolute',
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8eedc',
    experimental_backgroundImage: 'linear-gradient(#fffaf0, #f3e3c8)',
  },
  number: { fontFamily: fonts.bold, color: INK },
})
