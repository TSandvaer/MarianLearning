/**
 * The map's chrome (web `src/screens/Map/mapParts.tsx` + `MapScreen.tsx`):
 * the sky-to-meadow backdrop, a land's tinted clay band, its land pill,
 * the clay Home button, the world title and the caption slab.
 */
import { landArtId } from '@marian/core/emmasPath/pathArt'
import type { PathLine } from '@marian/core/emmasPath/pathLines'
import { BAND_INSET, type Side } from '@marian/core/map/mapLayout'
import { BAND_TINTS, INK } from '@marian/core/map/mapTheme'
import type { MasteryTrack } from '@marian/core/progress'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { PathImage } from '../../components/PathImage'
import type { MapCaptionLayout } from '../../layout/mapLayout'
import type { Rect } from '../../layout/layout'
import { FILL, fonts } from '../../theme'
import { TITLE } from '../hub/cardLook'
import { PRESS_MS } from '../hub/clay'
import { SpeakerIcon } from '../sessionEnd/glyphs'

export function MapBackdrop() {
  return <View pointerEvents="none" style={styles.backdrop} />
}

/** One land's band; a new land's band fades in as its gate swings. */
export function MapBand({
  index,
  land,
  top,
  height,
  faded,
}: {
  index: number
  land: number
  top: number
  height: number
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
        styles.band,
        {
          top,
          height,
          backgroundColor: lo,
          experimental_backgroundImage: `linear-gradient(${hi}, ${lo})`,
          boxShadow: `inset 0 5px 0 rgba(255,255,255,0.4), inset 0 -8px 0 rgba(0,0,0,0.08), 0 10px 0 ${lo}, 0 18px 24px rgba(60,40,10,0.15)`,
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
  showNumber,
}: {
  world: MasteryTrack
  land: number
  side: Side
  top: number
  showNumber: boolean
}) {
  return (
    <View
      testID={`map-land-pill-${land}`}
      pointerEvents="none"
      style={[
        styles.pill,
        { [side]: 30, top },
        showNumber ? styles.pillNumbered : styles.pillBare,
      ]}
    >
      <PathImage id={landArtId({ world, number: land })} px={46} />
      {showNumber && (
        <Text allowFontScaling={false} style={styles.pillNumber}>
          {land}
        </Text>
      )}
    </View>
  )
}

/** The clay Home button: back to the Hub. Sinks 6 pt while pressed. */
export function HomeButton({
  rect,
  icon,
  onPress,
}: {
  rect: Rect
  icon: number
  onPress: () => void
}) {
  const [down, setDown] = useState(false)
  const sink = useSharedValue(0)
  useEffect(() => {
    sink.set(
      withTiming(down ? 6 * (rect.width / 96) : 0, { duration: PRESS_MS }),
    )
  }, [down, rect.width, sink])
  const pressed = useAnimatedStyle(() => ({
    transform: [{ translateY: sink.get() }],
  }))
  const k = rect.width / 96
  return (
    <Pressable
      testID="map-home"
      accessibilityRole="button"
      accessibilityLabel="Home"
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      onPress={onPress}
      style={[
        styles.abs,
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
      ]}
    >
      <Animated.View
        style={[
          styles.home,
          {
            borderRadius: rect.width / 2,
            boxShadow: `inset 0 ${5 * k}px 0 rgba(255,255,255,0.3), 0 ${8 * k}px 0 #7d4a26, 0 ${12 * k}px ${16 * k}px rgba(60,30,10,0.3)`,
          },
          pressed,
        ]}
      >
        <PathImage id="ui-house" px={icon} />
      </Animated.View>
    </Pressable>
  )
}

const WORDS: Record<MasteryTrack, readonly [string, string]> = {
  math: ['Number', 'Garden'],
  'word-song': ['Word', 'Song'],
}

/** Clay-letter world title, as on the Hub cards (three stacked layers). */
export function MapTitle({
  world,
  rect,
  fontSize,
}: {
  world: MasteryTrack
  rect: Rect
  fontSize: number
}) {
  const [a, b] = WORDS[world]
  const look = TITLE[world === 'math' ? 'number-garden' : 'word-song']
  const k = fontSize / 52
  const layer = (dy: number) => [
    styles.title,
    { fontSize, lineHeight: fontSize * 1.05, letterSpacing: 0.5 * k },
    { transform: [{ translateY: dy }] },
  ]
  return (
    <View
      pointerEvents="none"
      style={[
        styles.abs,
        styles.titleBox,
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
      ]}
    >
      <View>
        <Text
          allowFontScaling={false}
          style={[
            layer(6 * k),
            styles.under,
            {
              color: look.dark,
              textShadowColor: 'rgba(0,0,0,0.2)',
              textShadowOffset: { width: 0, height: 4 * k },
              textShadowRadius: 10 * k,
            },
          ]}
        >
          {`${a} ${b}`}
        </Text>
        <Text
          allowFontScaling={false}
          style={[layer(2 * k), styles.under, { color: look.rim }]}
        >
          {`${a} ${b}`}
        </Text>
        <Text
          testID="map-title"
          allowFontScaling={false}
          style={[layer(0), { color: look.face }]}
        >
          {a} <Text style={{ color: look.second }}>{b}</Text>
        </Text>
      </View>
    </View>
  )
}

/** Clay caption slab mirroring Emma's spoken line (web `map-ribbon`). */
export function MapCaption({
  line,
  layout: c,
}: {
  line: PathLine | null
  layout: MapCaptionLayout
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.abs,
        styles.captionRow,
        { left: c.x, top: c.y, width: c.width, height: c.height },
        c.align === 'end' && styles.captionEnd,
      ]}
    >
      {line !== null && (
        <Animated.View
          key={line.id}
          testID="map-ribbon"
          entering={FadeIn.duration(200)}
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={line.text}
          style={[
            styles.slab,
            {
              gap: c.gap,
              paddingVertical: c.padV,
              paddingHorizontal: c.padH,
              borderRadius: c.radius,
            },
          ]}
        >
          <SpeakerIcon size={c.speaker} />
          <Text
            testID={`map-line-${line.id}`}
            allowFontScaling={false}
            style={[
              styles.captionText,
              { fontSize: c.fontSize, lineHeight: c.fontSize * c.lineHeight },
            ]}
          >
            {line.text}
          </Text>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  backdrop: {
    ...FILL,
    backgroundColor: '#d9f0c2',
    experimental_backgroundImage:
      'linear-gradient(#cdeeff 0%, #e6f6ff 9%, #d9f0c2 14%, #cde8b0 100%)',
  },
  band: {
    position: 'absolute',
    left: BAND_INSET,
    right: BAND_INSET,
    borderRadius: 48,
  },
  pill: {
    position: 'absolute',
    zIndex: 2,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 25,
    backgroundColor: '#f8eedc',
    experimental_backgroundImage: 'linear-gradient(#fffaf0, #f3e3c8)',
    boxShadow: 'inset 0 3px 0 #ffffff, 0 5px 0 rgba(90,50,20,0.35)',
  },
  pillNumbered: { paddingLeft: 4, paddingRight: 14 },
  pillBare: { paddingHorizontal: 4 },
  pillNumber: { fontFamily: fonts.bold, fontSize: 28, color: INK },
  home: {
    ...FILL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c98a55',
    experimental_backgroundImage:
      'radial-gradient(circle at 40% 32%, #e7b07a 0%, #c98a55 55%, #a86c3c 100%)',
  },
  titleBox: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, textAlign: 'center' },
  under: { position: 'absolute', left: 0, right: 0 },
  captionRow: { alignItems: 'center', justifyContent: 'center' },
  captionEnd: { justifyContent: 'flex-end' },
  slab: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ee',
    experimental_backgroundImage: 'linear-gradient(#fffdf8, #fff1e2)',
    boxShadow:
      'inset 0 3px 0 #ffffff, 0 8px 0 #e3c6a6, 0 14px 22px rgba(60,30,10,0.2)',
  },
  captionText: { flexShrink: 1, fontFamily: fonts.semibold, color: INK },
})
