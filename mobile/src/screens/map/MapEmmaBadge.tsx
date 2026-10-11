/**
 * Emma's "you are here" badge (web `EmmaBadge.tsx` + its wrapper in
 * `MapScreen.tsx`): a round clay badge with her head and shoulders, cropped
 * from the pose art, and a tail pointing down at her stop. Thomas
 * (2026-10-07) chose it over the standing figure.
 *
 * - Position: springs to her stop (260 / 22); Reduce Motion: she jumps.
 * - Hop (unlock beat): two small arcs, 0.7 s.
 * - Cheering: the cheering face and a scale pop (0.6 s).
 * - Attentive-pointing (a locked-stop tap): the idle face and a curious
 *   −9° head-tilt (spring 300 / 16). Pivot at the tail's tip.
 * - The face swap is expo-image's cross-dissolve (0.2 s).
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type { SkillNode } from '@marian/core/progress'
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { emmaAsset } from '../../assets'
import { EASE_IN_OUT, imageShadow } from '../hub/clay'

type Face = 'idle' | 'cheering'

/** Crop square in the 1024² pose art: left, top, side (px). */
const CROP: Record<Face, readonly [number, number, number]> = {
  idle: [312, 14, 400],
  cheering: [330, 80, 400],
}
const ART = 1024
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)

export interface MapEmmaBadgeProps {
  node: SkillNode
  left: number
  top: number
  /** Circle diameter. */
  size: number
  /** Circle + tail. */
  height: number
  pose: EmmaPose
  hopping: boolean
  reducedMotion: boolean
}

export function MapEmmaBadge({
  node,
  left,
  top,
  size,
  height,
  pose,
  hopping,
  reducedMotion,
}: MapEmmaBadgeProps) {
  const face: Face = pose === 'cheering' ? 'cheering' : 'idle'
  const motion = !reducedMotion
  const x = useSharedValue(left)
  const y = useSharedValue(top)
  useEffect(() => {
    const spring = { stiffness: 260, damping: 22, mass: 1 }
    x.set(motion ? withSpring(left, spring) : left)
    y.set(motion ? withSpring(top, spring) : top)
  }, [left, top, motion, x, y])
  const place = useAnimatedStyle(() => ({ left: x.get(), top: y.get() }))

  const lift = useSharedValue(0)
  const scale = useSharedValue(1)
  const tilt = useSharedValue(0)
  useEffect(() => {
    if (!hopping || !motion) return
    const leg = (to: number) =>
      withTiming(to, { duration: 175, easing: EASE_IN_OUT })
    lift.set(withSequence(leg(-28), leg(0), leg(-18), leg(0)))
  }, [hopping, motion, lift])
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
  const rim = Math.max(5, Math.round(size * 0.075))
  const win = size - 2 * rim
  const tail = height - size
  const tailW = Math.round(size * 0.42)
  return (
    <Animated.View
      testID="map-emma"
      pointerEvents="none"
      style={[styles.abs, { width: size, height, zIndex: 2 }, place]}
    >
      <View testID={`map-emma-at-${node}`} />
      <Animated.View
        testID={`map-emma-${pose}`}
        style={[StyleSheet.absoluteFill, styles.pivot, bob]}
      >
        <View
          style={[
            styles.abs,
            { left: (size - tailW) / 2, bottom: 0 },
            imageShadow(3, 2, 'rgba(60,30,10,0.3)'),
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
            { width: size, height: size, borderRadius: size / 2 },
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
              },
            ]}
          >
            <Image
              testID={`map-emma-face-${face}`}
              source={emmaAsset(face)}
              transition={200}
              accessible={false}
              style={{
                position: 'absolute',
                width: (win * ART) / cs,
                height: (win * ART) / cs,
                left: (-win * cx) / cs,
                top: (-win * cy) / cs,
              }}
            />
            <View style={[StyleSheet.absoluteFill, styles.gloss]} />
          </View>
        </View>
      </Animated.View>
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
    boxShadow:
      'inset 0 4px 0 rgba(255,255,255,0.3), 0 6px 0 #7d4a26, 0 12px 16px rgba(60,30,10,0.3)',
  },
  window: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#fff1dc',
    experimental_backgroundImage:
      'radial-gradient(circle at 45% 35%, #fffdf8 0%, #fff1dc 60%, #f6dfbd 100%)',
    boxShadow: 'inset 0 3px 6px rgba(90,50,20,0.3)',
  },
  gloss: {
    experimental_backgroundImage:
      'radial-gradient(ellipse at 30% 18%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%)',
  },
})
