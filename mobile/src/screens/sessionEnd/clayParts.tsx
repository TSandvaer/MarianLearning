/**
 * Session End's clay chrome (web `sessionEndClay.css` `.se-btn`,
 * `.se-caption`), scaled from the web's 112 pt button.
 *
 * - `ClayButton`: a thick press-able clay button. Green (`go`: All done,
 *   Again) or caramel (`alt`: Home). Press: the face sinks 9 pt onto its
 *   slab over 120 ms. It comes in with opacity 0 → 1 and y 16 → 0
 *   (Framer's defaults: a 0.3 s fade, a 500 / 25 spring); Reduce Motion:
 *   the fade only.
 * - `ClayCaption`: Emma's spoken line on a cream clay slab with a speaker,
 *   shown whole as she starts the line (the web shows it whole too).
 */
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'
import type {
  ButtonMetrics,
  CaptionMetrics,
} from '../../layout/sessionEndLayout'
import { fonts } from '../../theme'
import { SpeakerIcon } from './glyphs'

/** Web `.se-btn` `transition: transform .12s`. */
const PRESS_MS = 120

const LOOK = {
  go: {
    face: 'linear-gradient(#7fd364, #5cb945)',
    flat: '#6cc655',
    slab: '#3f8a2e',
    highlight: 'rgba(255, 255, 255, 0.35)',
    drop: 'rgba(40, 90, 20, 0.3)',
  },
  alt: {
    face: 'linear-gradient(#e7b07a, #c98a55)',
    flat: '#d89d67',
    slab: '#7d4a26',
    highlight: 'rgba(255, 255, 255, 0.3)',
    drop: 'rgba(60, 30, 10, 0.3)',
  },
} as const

const buttonEntering: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 16 }] },
    animations: {
      opacity: withTiming(1, { duration: 300 }),
      transform: [
        { translateY: withSpring(0, { stiffness: 500, damping: 25, mass: 1 }) },
      ],
    },
  }
}

export interface ClayButtonProps {
  testID: string
  label: string
  variant: 'go' | 'alt'
  width: number
  metrics: ButtonMetrics
  icon: ReactNode
  text: string
  reducedMotion: boolean
  onPress: () => void
}

export function ClayButton({
  testID,
  label,
  variant,
  width,
  metrics: m,
  icon,
  text,
  reducedMotion,
  onPress,
}: ClayButtonProps) {
  const look = LOOK[variant]
  const k = m.height / 112
  const sink = useSharedValue(0)
  const sinkStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sink.get() }],
  }))
  const shadow = (pressed: boolean) =>
    pressed
      ? `inset 0 ${5 * k}px 0 ${look.highlight}, 0 ${2 * k}px 0 ${look.slab}, 0 ${6 * k}px ${10 * k}px ${look.drop}`
      : `inset 0 ${5 * k}px 0 ${look.highlight}, 0 ${m.slab}px 0 ${look.slab}, 0 ${18 * k}px ${24 * k}px ${look.drop}`
  return (
    <Animated.View
      entering={reducedMotion ? FadeIn.duration(300) : buttonEntering}
    >
      <Animated.View style={sinkStyle}>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPressIn={() => {
            if (!reducedMotion) {
              sink.set(withTiming(m.press, { duration: PRESS_MS }))
            }
          }}
          onPressOut={() => sink.set(withTiming(0, { duration: PRESS_MS }))}
          onPress={onPress}
          style={({ pressed }) => [
            styles.button,
            {
              width,
              height: m.height,
              borderRadius: m.radius,
              gap: 12 * k,
              backgroundColor: look.flat,
              experimental_backgroundImage: look.face,
              boxShadow: shadow(pressed),
            },
          ]}
        >
          {icon}
          <Text
            allowFontScaling={false}
            style={[
              styles.buttonText,
              {
                fontSize: m.font,
                lineHeight: m.font * 1.2,
                textShadowColor: look.slab,
                textShadowOffset: { width: 0, height: 3 * k },
              },
            ]}
          >
            {text}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}

export function ClayCaption({
  text,
  metrics: c,
}: {
  text: string
  metrics: CaptionMetrics
}) {
  return (
    <View
      testID="session-end-ribbon"
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
      style={[
        styles.caption,
        {
          minHeight: c.minHeight,
          gap: c.gap,
          paddingHorizontal: c.padding.horizontal,
          paddingVertical: c.padding.vertical,
          borderRadius: c.radius,
        },
      ]}
    >
      <SpeakerIcon size={c.speaker} />
      <Text
        testID="session-end-caption"
        allowFontScaling={false}
        style={[
          styles.captionText,
          { fontSize: c.font, lineHeight: c.lineHeight },
        ]}
      >
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: fonts.bold,
    color: '#ffffff',
    textShadowRadius: 0,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ee',
    experimental_backgroundImage: 'linear-gradient(#fffdf8, #fff1e2)',
    boxShadow:
      'inset 0 3px 0 #ffffff, 0 8px 0 #e3c6a6, 0 14px 22px rgba(60, 30, 10, 0.2)',
  },
  captionText: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    color: '#6b3f1f',
  },
})
