/**
 * The map's chrome (web `src/screens/Map/mapParts.tsx` + `MapScreen.tsx`;
 * map-native § 2): the sky-to-meadow backdrop over the whole screen, the
 * clay Home button, the world title, the caption slab, and the peek
 * prompt's round button (`design/native/locked-stop-peek-prompt.md` § 4).
 */
import type { PathArtId } from '@marian/core/emmasPath/pathArt'
import type { MasteryTrack, SkillNode } from '@marian/core/progress'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
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
import { TITLE } from '../hub/cardLook'
import { MAP_BUTTON_LOOK } from '../hub/mapButtonLook'
import { PRESS_MS } from '../hub/clay'
import { CLAY_LOOK } from '../sessionEnd/clayLook'
import { EASE_OUT } from './mapMotion'
import type { MapCaptionLine } from './useMapVisit'

export function MapBackdrop() {
  return <View pointerEvents="none" style={styles.backdrop} />
}

/** Each clay disc's ledge. */
const LEDGE = { wood: '#7d4a26', cream: '#e3c6a6', honey: '#b27b37' } as const

/** The clay Home button → Hub. The face sinks 6 × k at press-in. */
export function HomeButton({
  rect,
  k,
  onPress,
  testID = 'map-home',
}: {
  rect: Rect
  /** Web px → pt (1 on tablets, 7/12 on phones). */
  k: number
  onPress: () => void
  testID?: string
}) {
  return (
    <ClayDisc
      rect={rect}
      k={k}
      onPress={onPress}
      testID={testID}
      label="Home"
      art="ui-house"
      look="wood"
    />
  )
}

/**
 * A round clay disc button with a piece of path art at 68 × k, Home's
 * shape, ledge and press: wood (Home), the Hub bubble's cream over its
 * `#e3c6a6` ledge (the Hub's Play disc, play-place § 1.2), or Word Song
 * honey over its `#b27b37` ledge (Letter critters' New letters,
 * critters-word-hunt.md § 5.3). No idle motion.
 */
export function ClayDisc({
  rect,
  k,
  onPress,
  testID,
  label,
  art,
  look,
}: {
  rect: Rect
  k: number
  onPress: () => void
  testID: string
  label: string
  art: PathArtId
  look: 'wood' | 'cream' | 'honey'
}) {
  const [down, setDown] = useState(false)
  const sink = useSharedValue(0)
  useEffect(() => {
    sink.set(withTiming(down ? 6 * k : 0, { duration: PRESS_MS }))
  }, [down, k, sink])
  const pressed = useAnimatedStyle(() => ({
    transform: [{ translateY: sink.get() }],
  }))
  const ledge = LEDGE[look]
  const shine = look === 'wood' ? 0.3 : look === 'honey' ? 0.4 : 1
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
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
          styles[look === 'wood' ? 'home' : look],
          {
            borderRadius: rect.width / 2,
            boxShadow: `inset 0 ${5 * k}px 0 rgba(255,255,255,${shine}), 0 ${8 * k}px 0 ${ledge}, 0 ${12 * k}px ${16 * k}px rgba(60,30,10,0.3)`,
          },
          pressed,
        ]}
      >
        <PathImage id={art} px={Math.round(68 * k)} testID={`${testID}-art`} />
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
  line: MapCaptionLine | null
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

/** Peek prompt § 4: in with the caption's entrance; out over 150 ms. */
const peekIn = FadeInDown.duration(200)
  .easing(EASE_OUT)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })
const peekInReduced = FadeIn.duration(200).easing(EASE_OUT)
const peekOut = FadeOut.duration(150)

/**
 * The peek prompt's round button (§ 4): Session End's green clay ("All
 * done"), its slab, highlight and 9 pt × size / 112 press sink; the tapped
 * stop's sticker in full colour (70 %) with a white play triangle in a
 * green disc at its lower right (28 %). No text: the caption asks.
 */
export function MapPeekButton({
  rect,
  node,
  reducedMotion,
  onPress,
}: {
  rect: Rect
  node: SkillNode
  reducedMotion: boolean
  onPress: () => void
}) {
  const look = CLAY_LOOK.go
  const size = rect.width
  const k = size / 112
  const sink = useSharedValue(0)
  const sinkStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sink.get() }],
  }))
  const shadow = (pressed: boolean) =>
    pressed
      ? `inset 0 ${5 * k}px 0 ${look.highlight}, 0 ${2 * k}px 0 ${look.slab}, 0 ${6 * k}px ${10 * k}px ${look.drop}`
      : `inset 0 ${5 * k}px 0 ${look.highlight}, 0 ${11 * k}px 0 ${look.slab}, 0 ${18 * k}px ${24 * k}px ${look.drop}`
  const disc = size * 0.28
  const tri = disc * 0.4
  return (
    <Animated.View
      entering={reducedMotion ? peekInReduced : peekIn}
      exiting={peekOut}
      style={[
        styles.abs,
        { left: rect.x, top: rect.y, width: size, height: size },
      ]}
    >
      <Animated.View style={[styles.fillBox, sinkStyle]}>
        <Pressable
          testID="map-peek-button"
          accessibilityRole="button"
          accessibilityLabel="Try it"
          onPressIn={() => {
            if (!reducedMotion) {
              sink.set(withTiming(9 * k, { duration: PRESS_MS }))
            }
          }}
          onPressOut={() => sink.set(withTiming(0, { duration: PRESS_MS }))}
          onPress={onPress}
          style={({ pressed }) => [
            styles.peekFace,
            {
              borderRadius: size / 2,
              backgroundColor: look.flat,
              experimental_backgroundImage: look.face,
              boxShadow: shadow(pressed),
            },
          ]}
        >
          <PathImage
            id={node}
            px={Math.round(size * 0.7)}
            testID="map-peek-button-art"
          />
          <View
            pointerEvents="none"
            style={[
              styles.peekPlay,
              {
                width: disc,
                height: disc,
                borderRadius: disc / 2,
                right: size * 0.04,
                bottom: size * 0.04,
                backgroundColor: look.slab,
              },
            ]}
          >
            <View
              style={{
                marginLeft: tri * 0.25,
                borderTopWidth: tri / 2,
                borderBottomWidth: tri / 2,
                borderLeftWidth: tri * 0.85,
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
                borderLeftColor: '#ffffff',
              }}
            />
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  fillBox: { ...FILL },
  peekFace: {
    ...FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekPlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  // The Hub bubble's cream (hub-native § 6).
  cream: {
    ...FILL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff8ee',
  },
  // Word Song honey, the Letter critters tile's face (play-place § 1.3).
  honey: {
    ...FILL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MAP_BUTTON_LOOK['word-song'].flat,
    experimental_backgroundImage: MAP_BUTTON_LOOK['word-song'].face,
  },
  titleBox: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, textAlign: 'center' },
  under: { position: 'absolute', left: 0, right: 0 },
  slot: { justifyContent: 'center' },
  slotEnd: { justifyContent: 'flex-end' },
  slab: { width: '100%' },
})
