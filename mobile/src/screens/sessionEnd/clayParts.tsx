/**
 * Session End's clay chrome (web `sessionEndClay.css` `.se-btn`,
 * `.se-caption`), scaled from the web's 112 pt button.
 *
 * - `ClayButton`: a thick press-able clay button. Green (`go`: All done,
 *   Again) or caramel (`alt`: Home). Press: the face sinks 9 pt onto its
 *   slab over 120 ms. It comes in with opacity 0 → 1 and y 16 → 0
 *   (Framer's defaults: a 0.3 s fade, a 500 / 25 spring); Reduce Motion:
 *   the fade only.
 * The caption slab is shared with the map: `components/ClayCaption.tsx`.
 */
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'
import type { ButtonMetrics } from '../../layout/sessionEndLayout'
import { fonts } from '../../theme'
import { CLAY_LOOK } from './clayLook'

/** Web `.se-btn` `transition: transform .12s`. */
const PRESS_MS = 120

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
  const look = CLAY_LOOK[variant]
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
})
