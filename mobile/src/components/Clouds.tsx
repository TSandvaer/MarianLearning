/**
 * Greet background — `public/assets/bg-clouds.svg` rendered through
 * react-native-svg's XML parser, with the web's 600 ms fade-in and 20 s
 * mirrored x-drift (+10 px) unless reduce-motion is on.
 */
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SvgXml } from 'react-native-svg'

const CLOUDS_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 1024" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF5F0"/>
      <stop offset="60%" stop-color="#FFE7EE"/>
      <stop offset="100%" stop-color="#FFC0CB" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="22%" r="55%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <symbol id="cloud" viewBox="0 0 240 100" overflow="visible">
      <g fill="#FFFFFF">
        <ellipse cx="60" cy="60" rx="56" ry="34"/>
        <ellipse cx="115" cy="46" rx="62" ry="40"/>
        <ellipse cx="170" cy="58" rx="54" ry="32"/>
        <ellipse cx="200" cy="68" rx="36" ry="22"/>
      </g>
      <ellipse cx="120" cy="84" rx="100" ry="6" fill="#F48FB1" opacity="0.08"/>
    </symbol>
  </defs>
  <rect width="768" height="1024" fill="url(#sky)"/>
  <rect width="768" height="1024" fill="url(#glow)"/>
  <use href="#cloud" x="-40" y="120" width="320" height="134"/>
  <use href="#cloud" x="460" y="80" width="260" height="108"/>
  <use href="#cloud" x="220" y="260" width="200" height="84" opacity="0.85"/>
</svg>`

export function Clouds() {
  const reducedMotion = useReducedMotion()
  const x = useSharedValue(0)

  useEffect(() => {
    if (reducedMotion) return
    const ease = Easing.inOut(Easing.ease)
    x.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 10_000, easing: ease }),
        withTiming(0, { duration: 10_000, easing: ease }),
      ),
      -1,
    )
    return () => cancelAnimation(x)
  }, [reducedMotion, x])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(600)}
      style={[StyleSheet.absoluteFill, style]}
    >
      <SvgXml xml={CLOUDS_XML} width="100%" height="100%" />
    </Animated.View>
  )
}
