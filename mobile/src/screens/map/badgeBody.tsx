/**
 * The badge itself (web `EmmaBadge.tsx`): the bob layer (hop, cheer pop,
 * pointing tilt; pivot at the tail's tip), the tail, the clay rim, the
 * window and the cropped face. Values are the web's px × s.
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type { SkillNode } from '@marian/core/progress'
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { emmaAsset } from '../../assets'
import { imageShadow } from '../../components/imageShadow'
import { EASE_IN_OUT } from '../hub/clay'

type Face = 'idle' | 'cheering'

/** Crop square in the 1024² pose art: left, top, side (px). */
const CROP: Record<Face, readonly [number, number, number]> = {
  idle: [312, 14, 400],
  cheering: [330, 80, 400],
}
const ART = 1024
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)

export function BadgeBody({
  node,
  size,
  height,
  s,
  pose,
  hopping,
  motion,
}: {
  node: SkillNode
  size: number
  height: number
  s: number
  pose: EmmaPose
  hopping: boolean
  motion: boolean
}) {
  const face: Face = pose === 'cheering' ? 'cheering' : 'idle'
  const lift = useSharedValue(0)
  const scale = useSharedValue(1)
  const tilt = useSharedValue(0)
  useEffect(() => {
    if (!hopping || !motion) return
    const leg = (to: number) =>
      withTiming(to * s, { duration: 175, easing: EASE_IN_OUT })
    lift.set(withSequence(leg(-28), leg(0), leg(-18), leg(0)))
  }, [hopping, motion, lift, s])
  useEffect(() => {
    if (pose !== 'cheering' || !motion) return
    const leg = (to: number) =>
      withTiming(to, { duration: 150, easing: EASE_OUT })
    scale.set(withSequence(leg(1.18), leg(0.95), leg(1.05), leg(1)))
  }, [pose, motion, scale])
  useEffect(() => {
    const to = pose === 'attentive-pointing' && motion ? -9 : 0
    tilt.set(withSpring(to, { stiffness: 300, damping: 16, mass: 1 }))
  }, [pose, motion, tilt])
  const bob = useAnimatedStyle(() => ({
    transform: [
      { translateY: lift.get() },
      { scale: scale.get() },
      { rotate: `${tilt.get()}deg` },
    ],
  }))

  const [cx, cy, cs] = CROP[face]
  const rim = Math.max(5 * s, size * 0.075)
  const win = size - 2 * rim
  const tail = height - size
  const tailW = size * 0.42
  return (
    <Animated.View
      testID={`map-emma-${pose}`}
      style={[StyleSheet.absoluteFill, styles.pivot, bob]}
    >
      <View testID={`map-emma-at-${node}`} />
      <View
        style={[
          styles.abs,
          { left: (size - tailW) / 2, bottom: 0 },
          imageShadow(3 * s, 2 * s, 'rgba(60,30,10,0.3)'),
        ]}
      >
        <Svg
          width={tailW}
          height={tail + rim * 2}
          viewBox="0 0 42 40"
          preserveAspectRatio="none"
        >
          <Path
            d="M0 0 H42 L24.5 37.5 Q21 41 17.5 37.5 Z"
            fill="#a86c3c"
            stroke="#7d4a26"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View
        testID="map-emma-badge"
        style={[
          styles.abs,
          styles.rim,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            boxShadow: `inset 0 ${4 * s}px 0 rgba(255,255,255,0.3), 0 ${6 * s}px 0 #7d4a26, 0 ${12 * s}px ${16 * s}px rgba(60,30,10,0.3)`,
          },
        ]}
      >
        <View
          style={[
            styles.window,
            {
              left: rim,
              top: rim,
              width: win,
              height: win,
              borderRadius: win / 2,
              boxShadow: `inset 0 ${3 * s}px ${6 * s}px rgba(90,50,20,0.3)`,
            },
          ]}
        >
          <Animated.View
            key={face}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={StyleSheet.absoluteFill}
          >
            <Image
              testID={`map-emma-face-${face}`}
              source={emmaAsset(face)}
              accessible={false}
              style={{
                position: 'absolute',
                width: (win * ART) / cs,
                height: (win * ART) / cs,
                left: (-win * cx) / cs,
                top: (-win * cy) / cs,
              }}
            />
          </Animated.View>
          <View style={[StyleSheet.absoluteFill, styles.gloss]} />
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  pivot: { transformOrigin: '50% 100%' },
  rim: {
    left: 0,
    top: 0,
    backgroundColor: '#c98a55',
    experimental_backgroundImage:
      'radial-gradient(circle at 38% 30%, #e7b07a 0%, #c98a55 55%, #a86c3c 100%)',
  },
  window: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#fff1dc',
    experimental_backgroundImage:
      'radial-gradient(circle at 45% 35%, #fffdf8 0%, #fff1dc 60%, #f6dfbd 100%)',
  },
  gloss: {
    experimental_backgroundImage:
      'radial-gradient(ellipse at 30% 18%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%)',
  },
})
