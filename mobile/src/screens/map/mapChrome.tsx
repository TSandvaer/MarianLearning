/**
 * The map's chrome (web `src/screens/Map/mapParts.tsx` + `MapScreen.tsx`;
 * map-native § 2): the sky-to-meadow backdrop over the whole screen, the
 * clay Home button, the world title and the caption slab; natively, the
 * play door (mini-game spec § 1.2).
 */
import type { PathLine } from '@marian/core/emmasPath/pathLines'
import type { GameId } from '@marian/core/games/miniGames'
import type { MasteryTrack } from '@marian/core/progress'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'
import { ClayCaption } from '../../components/ClayCaption'
import { PathImage } from '../../components/PathImage'
import type { Rect } from '../../layout/layout'
import type { MapCaptionSlot } from '../../layout/mapScreenLayout'
import { FILL, fonts } from '../../theme'
import { GAME_DOOR_LABELS } from '../game/gameLines'
import { TITLE } from '../hub/cardLook'
import { PRESS_MS } from '../hub/clay'

export function MapBackdrop() {
  return <View pointerEvents="none" style={styles.backdrop} />
}

/** The clay Home button → Hub. The face sinks 6 × k at press-in. */
export function HomeButton({
  rect,
  k,
  onPress,
}: {
  rect: Rect
  /** Web px → pt (1 on tablets, 7/12 on phones). */
  k: number
  onPress: () => void
}) {
  const [down, setDown] = useState(false)
  const sink = useSharedValue(0)
  useEffect(() => {
    sink.set(withTiming(down ? 6 * k : 0, { duration: PRESS_MS }))
  }, [down, k, sink])
  const pressed = useAnimatedStyle(() => ({
    transform: [{ translateY: sink.get() }],
  }))
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
        <PathImage id="ui-house" px={Math.round(68 * k)} />
      </Animated.View>
    </Pressable>
  )
}

const WORDS: Record<MasteryTrack, readonly [string, string]> = {
  math: ['Number', 'Garden'],
  'word-song': ['Word', 'Song'],
}

/** Clay-letter world title: the Hub's three stacked `Text` layers. */
export function MapTitle({
  world,
  rect,
}: {
  world: MasteryTrack
  rect: Rect & { fontSize: number }
}) {
  const [a, b] = WORDS[world]
  const look = TITLE[world === 'math' ? 'number-garden' : 'word-song']
  const { fontSize } = rect
  const k = fontSize / 52
  const layer = (dy: number) => [
    styles.title,
    { fontSize, lineHeight: fontSize, letterSpacing: 0.5 * k },
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

/** Web caption entrance: opacity 0 → 1, y 8 → 0, 200 ms. */
const captionIn: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 8 }] },
    animations: {
      opacity: withTiming(1, { duration: 200 }),
      transform: [{ translateY: withTiming(0, { duration: 200 }) }],
    },
  }
}

/** The caption slot: the whole line at once, keyed by line id (§ 6). */
export function MapCaption({
  line,
  caption,
}: {
  line: PathLine | null
  caption: MapCaptionSlot
}) {
  const { slot, metrics, align } = caption
  return (
    <View
      pointerEvents="none"
      style={[
        styles.abs,
        styles.slot,
        { left: slot.x, top: slot.y, width: slot.width, height: slot.height },
        align === 'end' && styles.slotEnd,
      ]}
    >
      {line !== null && (
        <Animated.View
          key={line.id}
          testID={`map-line-${line.id}`}
          entering={captionIn}
          style={styles.slab}
        >
          <ClayCaption
            text={line.text}
            metrics={metrics}
            testID="map-ribbon"
            textTestID="map-caption"
          />
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
  slot: { justifyContent: 'center' },
  slotEnd: { justifyContent: 'flex-end' },
  slab: { width: '100%' },
})

/**
 * The play door (mini-game spec § 1.2): Home's clay disc, face and press
 * (wood clay, the Number Garden map button's), holding the game's own
 * picture (`GameDoorPicture`), fixed, full and still. No text, no badge, no
 * count, no idle animation. Chrome, like Home, not a stop.
 */
export function GameDoor({
  game,
  rect,
  k,
  onPress,
}: {
  game: GameId
  rect: Rect
  /** Web px → pt (1 on tablets, 7/12 on phones). */
  k: number
  onPress: () => void
}) {
  const [down, setDown] = useState(false)
  const sink = useSharedValue(0)
  useEffect(() => {
    sink.set(withTiming(down ? 6 * k : 0, { duration: PRESS_MS }))
  }, [down, k, sink])
  const pressed = useAnimatedStyle(() => ({
    transform: [{ translateY: sink.get() }],
  }))
  return (
    <Pressable
      testID="map-game-door"
      accessibilityRole="button"
      accessibilityLabel={GAME_DOOR_LABELS[game]}
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
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <GameDoorPicture k={k} />
        </View>
      </Animated.View>
    </Pressable>
  )
}

/**
 * The door's picture (§ 1.2.1, T6, Thomas's pick of 2026-10-20): the clay
 * piece `ui-flower-bed`, a small soil bed planted full, drawn as Home draws
 * its house. A fixed picture: it never shows how a round went (D7 c).
 */
function GameDoorPicture({ k }: { k: number }) {
  return (
    <PathImage
      id="ui-flower-bed"
      px={Math.round(68 * k)}
      testID="map-game-door-art"
    />
  )
}
