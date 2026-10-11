/**
 * The flower tray: the ONE progress number on Session End (web `.se-tray`
 * + `Hole`, `sessionEndClay.css`). A caramel tray in the Number Garden, a
 * pink one in Word Song; one clay hole per good day the step needs. A
 * hole is `grown` (open bud), `sleeping` (closed bud, dimmed, a moon and a
 * bobbing "z": earned today, it opens tomorrow) or `empty`.
 *
 * Sizes follow the hole (web 86 pt); every offset is the web's, scaled.
 */
import type { MasteryTrack } from '@marian/core/progress'
import type { FlowerSlot } from '@marian/core/sessionEnd/sessionEndGuidance'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'
import { PathImage } from '../../components/PathImage'
import { WEB_HOLE, holeRects } from '../../layout/sessionEndLayout'
import type { Rect } from '../../layout/layout'
import type { PanelContent } from '../../layout/sessionEndLayout'
import { fonts } from '../../theme'
import { MoonIcon } from './glyphs'

const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)
/** Web: the landed flower pops 0.7 → 1 over 0.35 s (0.2 s fade on Reduce Motion). */
export const HOLE_POP_MS = 350
/** Web `se-zz`: 2.4 s, up 6 px and to 0.6 opacity at the midpoint. */
const ZZ_PERIOD_MS = 2400

/** Web: the landed flower pops 0.7 → 1 (no fade). */
const holePopEntering: EntryExitAnimationFunction = () => {
  'worklet'
  return {
    initialValues: { transform: [{ scale: 0.7 }] },
    animations: {
      transform: [
        {
          scale: withTiming(1, {
            duration: HOLE_POP_MS,
            easing: Easing.out(Easing.ease),
          }),
        },
      ],
    },
  }
}

const TRAY = {
  math: {
    face: 'linear-gradient(#c58a55, #a86c3c)',
    highlight: 'rgba(255, 255, 255, 0.2)',
    slab: '#7d4a26',
  },
  'word-song': {
    face: 'linear-gradient(#ffc2d7, #f7a6c3)',
    highlight: 'rgba(255, 255, 255, 0.45)',
    slab: '#d27b9c',
  },
} as const

function SleepingZ({
  size,
  reducedMotion,
}: {
  size: number
  reducedMotion: boolean
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    if (reducedMotion) return
    const half = { duration: ZZ_PERIOD_MS / 2, easing: EASE_IN_OUT }
    t.set(
      withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1),
    )
    return () => cancelAnimation(t)
  }, [t, reducedMotion])
  const bob = useAnimatedStyle(() => ({
    opacity: 1 - 0.4 * t.get(),
    transform: [{ translateY: -6 * t.get() }],
  }))
  return (
    <Animated.Text
      accessible={false}
      allowFontScaling={false}
      style={[
        styles.zz,
        {
          left: -0.06 * size,
          top: -0.18 * size,
          fontSize: Math.round((22 * size) / WEB_HOLE),
          lineHeight: Math.round((22 * size * 1.2) / WEB_HOLE),
        },
        bob,
      ]}
    >
      z
    </Animated.Text>
  )
}

interface HoleProps {
  slot: FlowerSlot
  rect: Rect
  flower: PanelContent['holeFlower']
  /** Today's flower just landed here: it pops in. */
  pop: boolean
  reducedMotion: boolean
}

function Hole({ slot, rect, flower, pop, reducedMotion }: HoleProps) {
  const size = rect.width
  const k = size / WEB_HOLE
  return (
    <View
      testID={`session-end-slot-${slot}`}
      style={[
        styles.hole,
        {
          left: rect.x,
          top: rect.y,
          width: size,
          height: size,
          borderRadius: size / 2,
          boxShadow: `inset 0 ${8 * k}px ${10 * k}px rgba(0, 0, 0, 0.45), 0 ${2 * k}px 0 rgba(255, 255, 255, 0.35)`,
        },
      ]}
    >
      {slot !== 'empty' && (
        <Animated.View
          // The flower view mounts the moment today's flower lands.
          entering={
            pop
              ? reducedMotion
                ? FadeIn.duration(200)
                : holePopEntering
              : undefined
          }
          style={[
            styles.holeFlower,
            { left: flower.left, bottom: flower.bottom },
            slot === 'sleeping' ? styles.sleeping : styles.awake,
          ]}
        >
          <PathImage
            id={slot === 'sleeping' ? 'ui-bud-closed' : 'ui-bud-open'}
            px={flower.size}
          />
        </Animated.View>
      )}
      {slot === 'sleeping' && (
        <>
          <View
            style={[styles.moon, { right: -0.12 * size, top: -0.14 * size }]}
          >
            <MoonIcon size={0.48 * size} />
          </View>
          <SleepingZ size={size} reducedMotion={reducedMotion} />
        </>
      )}
    </View>
  )
}

export interface FlowerTrayProps {
  world: MasteryTrack
  slots: readonly FlowerSlot[]
  inner: PanelContent
  /** The slot today's flower just landed in, or null. */
  popSlot: number | null
  reducedMotion: boolean
}

export function FlowerTray({
  world,
  slots,
  inner,
  popSlot,
  reducedMotion,
}: FlowerTrayProps) {
  const { rect, radius } = inner.tray
  const k = inner.hole / WEB_HOLE
  const look = TRAY[world]
  const holes = holeRects(rect, inner.hole, slots.length)
  return (
    <View
      testID="session-end-tray"
      accessible={false}
      style={[
        styles.tray,
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          borderRadius: radius,
          experimental_backgroundImage: look.face,
          boxShadow: `inset 0 ${4 * k}px 0 ${look.highlight}, 0 ${7 * k}px 0 ${look.slab}`,
        },
      ]}
    >
      {slots.map((slot, i) => (
        <Hole
          key={i}
          slot={slot}
          rect={holes[i]!}
          flower={inner.holeFlower}
          pop={i === popSlot}
          reducedMotion={reducedMotion}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  tray: { position: 'absolute' },
  hole: {
    position: 'absolute',
    backgroundColor: '#4e2c19',
    experimental_backgroundImage:
      'radial-gradient(circle at 50% 62%, #6b4128 0%, #4e2c19 60%, #3d2112 100%)',
  },
  holeFlower: { position: 'absolute' },
  awake: { filter: 'drop-shadow(0px 3px 2px rgba(0, 0, 0, 0.3))' },
  sleeping: {
    filter:
      'brightness(0.85) saturate(0.8) drop-shadow(0px 3px 2px rgba(0, 0, 0, 0.3))',
  },
  moon: {
    position: 'absolute',
    filter: 'drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.3))',
  },
  zz: {
    position: 'absolute',
    fontFamily: fonts.bold,
    color: '#ffffff',
    textShadowColor: '#6b4a9c',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
})
