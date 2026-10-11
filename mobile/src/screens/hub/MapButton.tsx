/**
 * The round wooden map button inside a Hub card (web `.hub-mapbtn`): right
 * 20, bottom 24, 118 reference px; pressed, it sinks 7u onto its slab. Its
 * hit area never drops below 56×56 pt (hub-native § 1), while the visual
 * stays at 118s. A nested Pressable: a touch here never presses the card.
 */
import type { MasteryTrack } from '@marian/core/progress'
import { useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { PathImage } from '../../components/PathImage'
import { mapHitSlop } from '../../layout/hubLayout'
import { CSS_EASE, PRESS_MS } from './clay'

const LOOK: Record<
  MasteryTrack,
  { face: string; flat: string; shadow: (s: number) => string }
> = {
  math: {
    face: 'radial-gradient(circle at 40% 32%, #e7b07a 0%, #c98a55 55%, #a86c3c 100%)',
    flat: '#c98a55',
    shadow: (s) =>
      `inset 0 ${5 * s}px 0 rgba(255, 255, 255, 0.3), inset 0 ${-6 * s}px 0 rgba(0, 0, 0, 0.18), 0 ${9 * s}px 0 #7d4a26, 0 ${14 * s}px ${18 * s}px rgba(60, 30, 10, 0.3)`,
  },
  'word-song': {
    face: 'radial-gradient(circle at 40% 32%, #ffe0a8 0%, #f2c27a 55%, #d9a159 100%)',
    flat: '#f2c27a',
    shadow: (s) =>
      `inset 0 ${5 * s}px 0 rgba(255, 255, 255, 0.4), inset 0 ${-6 * s}px 0 rgba(0, 0, 0, 0.12), 0 ${9 * s}px 0 #b27b37, 0 ${14 * s}px ${18 * s}px rgba(120, 60, 20, 0.25)`,
  },
}

/** Web `.hub-mapbtn:active` (both worlds: the later rule wins). */
const pressedShadow = (s: number) =>
  `inset 0 ${5 * s}px 0 rgba(255, 255, 255, 0.3), 0 ${2 * s}px 0 #7d4a26`

export interface MapButtonProps {
  world: MasteryTrack
  s: number
  reducedMotion: boolean
  onPress: () => void
}

export function MapButton({
  world,
  s,
  reducedMotion,
  onPress,
}: MapButtonProps) {
  const look = LOOK[world]
  const size = 118 * s
  const [down, setDown] = useState(false)
  const y = useSharedValue(0)
  const press = (to: boolean) => {
    setDown(to)
    y.set(
      withTiming(to ? 7 : 0, {
        duration: reducedMotion ? 0 : PRESS_MS,
        easing: CSS_EASE,
      }),
    )
  }
  const sink = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() * s }],
  }))
  return (
    <Pressable
      testID={`hub-map-${world}`}
      accessibilityRole="button"
      accessibilityLabel={
        world === 'math' ? 'Number Garden map' : 'Word Song map'
      }
      hitSlop={mapHitSlop(s)}
      onPressIn={() => press(true)}
      onPressOut={() => press(false)}
      onPress={onPress}
      style={[
        styles.hit,
        { right: 20 * s, bottom: 24 * s, width: size, height: size },
      ]}
    >
      <Animated.View
        style={[
          styles.face,
          {
            borderRadius: size / 2,
            backgroundColor: look.flat,
            experimental_backgroundImage: look.face,
            boxShadow: down ? pressedShadow(s) : look.shadow(s),
          },
          sink,
        ]}
      >
        {/* Web `.hub-mapbtn img` has no drop-shadow, so none here. */}
        <PathImage id="ui-map" px={84 * s} />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  hit: { position: 'absolute' },
  face: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
