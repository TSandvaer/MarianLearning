/**
 * The Hub's background layer (below App's Emma): web `.hub-clay` sky →
 * meadow → path bands over the whole screen, the six soft `.hub-garden`
 * blobs, and Emma's warm light (`.hub-emma-light`), which fades in with
 * the Hub so she lands on it (hub-native §§ 4, 6).
 *
 * Blob centres: W (tablet portrait) at the web stage's coordinates; P and
 * L at the same fractions of the screen (x / 820, y / 1180). Blob radii
 * scale with the layout's `garden.scale` (W: u; P / L: the card scale s,
 * so the garden keeps its size next to the cards).
 */
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import type { HubLayout } from '../../layout/hubLayout'
import { FILL } from '../../theme'
import { gardenBackground } from './clay'

/** Web: the Hub fades in over 0.3 s and out over 0.25 s. */
export const HUB_ENTER_MS = 300
export const HUB_EXIT_MS = 250

const LIGHT =
  'radial-gradient(circle at 50% 45%, rgba(255, 236, 190, 0.85) 0%, rgba(255, 224, 160, 0.4) 40%, rgba(255, 214, 140, 0) 70%)'

export function HubBackdrop({ layout }: { layout: HubLayout }) {
  const { light } = layout
  return (
    <Animated.View
      testID="hub-backdrop"
      entering={FadeIn.duration(HUB_ENTER_MS)}
      exiting={FadeOut.duration(HUB_EXIT_MS)}
      style={[
        styles.backdrop,
        { experimental_backgroundImage: gardenBackground(layout.garden) },
      ]}
    >
      <View
        testID="hub-emma-light"
        style={[
          styles.light,
          {
            left: light.x,
            top: light.y,
            width: light.width,
            height: light.height,
            borderRadius: light.width / 2,
          },
        ]}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...FILL,
    zIndex: 0,
    pointerEvents: 'none',
    backgroundColor: '#cdebb4',
  },
  light: {
    position: 'absolute',
    experimental_backgroundImage: LIGHT,
  },
})
