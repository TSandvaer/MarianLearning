/**
 * Emma's "you are here" badge (web `EmmaBadge.tsx` + its wrapper in
 * `MapScreen.tsx`; map-native § 3): a clay rim, a cream window with her
 * head and shoulders cropped from the pose art, and a tail pointing down
 * at her stop. The whole box sits above the stop.
 *
 * - Position: springs (260 / 22, on translateX/Y) only when her stop
 *   changes (the unlock hop); a rotation moves her with the path.
 * - Hop: two arcs, y [0, −28, 0, −18, 0] × s over 700 ms.
 * - Cheering: the cheering face and a scale pop [1, 1.18, .95, 1.05, 1].
 * - Attentive-pointing: the idle face, tilted −9° (spring 300 / 16).
 *   Pivot at the tail's tip. No breathing (web).
 * - The face swap: two keyed image layers, a 200 ms cross-fade.
 * - Reduce Motion: no hop, pop or tilt; she cross-fades stop to stop.
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type { SkillNode } from '@marian/core/progress'
import { useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { BadgeBody } from './badgeBody'

export interface MapEmmaBadgeProps {
  node: SkillNode
  /** Box, pt (`emmaBadge()` × s). */
  left: number
  top: number
  /** Circle diameter, pt. */
  size: number
  /** Circle + tail, pt. */
  height: number
  s: number
  pose: EmmaPose
  hopping: boolean
  reducedMotion: boolean
}

const SPRING = { stiffness: 260, damping: 22, mass: 1 }

function MovingBadge(p: MapEmmaBadgeProps) {
  const x = useSharedValue(p.left)
  const y = useSharedValue(p.top)
  const at = useRef(p.node)
  useEffect(() => {
    if (at.current !== p.node) {
      at.current = p.node
      x.set(withSpring(p.left, SPRING))
      y.set(withSpring(p.top, SPRING))
    } else {
      x.set(p.left)
      y.set(p.top)
    }
  }, [p.node, p.left, p.top, x, y])
  const place = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }))
  return (
    <Animated.View
      testID="map-emma"
      pointerEvents="none"
      style={[styles.box, { width: p.size, height: p.height }, place]}
    >
      <BadgeBody {...p} motion />
    </Animated.View>
  )
}

export function MapEmmaBadge(p: MapEmmaBadgeProps) {
  if (!p.reducedMotion) return <MovingBadge {...p} />
  return (
    <Animated.View
      key={p.node}
      testID="map-emma"
      pointerEvents="none"
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[
        styles.box,
        {
          width: p.size,
          height: p.height,
          transform: [{ translateX: p.left }, { translateY: p.top }],
        },
      ]}
    >
      <BadgeBody {...p} motion={false} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  box: { position: 'absolute', left: 0, top: 0, zIndex: 2 },
})
