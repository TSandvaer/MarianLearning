/**
 * A Hub card's flower tray (web `.hub-tray` + `.hub-hole`, Guidance G1):
 * one clay hole per good day the step needs. A hole is `grown` (open bud),
 * `sleeping` (closed bud, dimmed, a moon and a bobbing "z": earned today,
 * it opens tomorrow) or `empty`. A bud that slept since the last visit
 * opens once on mount (web `hub-wake`). Reference px × s.
 */
import type { MasteryTrack } from '@marian/core/progress'
import type { FlowerSlot, HubCardModel } from '@marian/core/hub/hubCardModel'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { PathImage } from '../../components/PathImage'
import { fonts } from '../../theme'
import { MoonIcon } from '../sessionEnd/glyphs'
import { EASE_IN_OUT, imageShadow } from './clay'

/** Web `hub-wake`: 0.8 s `cubic-bezier(.34, 1.56, .64, 1)` after 0.5 s. */
export const WAKE_DELAY_MS = 500
export const WAKE_MS = 800
const WAKE_EASE = Easing.bezier(0.34, 1.56, 0.64, 1)
/** Web `hub-zz`: 2.4 s, up 6u and to 0.6 opacity at the midpoint. */
const ZZ_PERIOD_MS = 2400
const HOLE = 64

const TRAY: Record<
  MasteryTrack,
  { face: string; flat: string; shadow: (s: number) => string }
> = {
  math: {
    face: 'linear-gradient(#c58a55, #a86c3c)',
    flat: '#b67b48',
    shadow: (s) =>
      `inset 0 ${4 * s}px 0 rgba(255, 255, 255, 0.2), 0 ${7 * s}px 0 #7d4a26`,
  },
  'word-song': {
    face: 'linear-gradient(#ffc2d7, #f7a6c3)',
    flat: '#fbb4cd',
    shadow: (s) =>
      `inset 0 ${4 * s}px 0 rgba(255, 255, 255, 0.45), 0 ${7 * s}px 0 #d27b9c`,
  },
}

function SleepingZ({
  s,
  reducedMotion,
}: {
  s: number
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
    transform: [{ translateY: -6 * s * t.get() }],
  }))
  return (
    <Animated.Text
      accessible={false}
      allowFontScaling={false}
      style={[
        styles.zz,
        {
          left: -0.08 * HOLE * s,
          top: -0.24 * HOLE * s,
          fontSize: 24 * s,
          lineHeight: 24 * s,
          textShadowOffset: { width: 0, height: 2 * s },
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
  waking: boolean
  s: number
  reducedMotion: boolean
}

function Hole({ slot, waking, s, reducedMotion }: HoleProps) {
  const size = HOLE * s
  // The wake plays once per mount; Reduce Motion shows the bud open.
  const t = useSharedValue(waking && !reducedMotion ? 0 : 1)
  useEffect(() => {
    if (!waking || reducedMotion) return
    t.set(
      withDelay(
        WAKE_DELAY_MS,
        withTiming(1, { duration: WAKE_MS, easing: WAKE_EASE }),
      ),
    )
    // Mount-once: a rotation must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const wake = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.4 + 0.6 * t.get()),
    transform: [
      { scale: 0.6 + 0.4 * t.get() },
      { rotate: `${-10 * (1 - t.get())}deg` },
    ],
  }))
  return (
    <View
      testID={`hub-slot-${slot}`}
      style={[
        styles.hole,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          boxShadow: `inset 0 ${8 * s}px ${10 * s}px rgba(0, 0, 0, 0.45), 0 ${2 * s}px 0 rgba(255, 255, 255, 0.35)`,
        },
      ]}
    >
      {slot !== 'empty' && (
        <Animated.View
          testID={waking ? 'hub-slot-waking' : undefined}
          style={[
            styles.bud,
            {
              left: 1 * s,
              top: -4 * s,
              width: 62 * s,
              height: 62 * s,
            },
            imageShadow(3 * s, 2 * s, 'rgba(0, 0, 0, 0.3)'),
            // Web `brightness(.85) saturate(.8)`: iOS paints a grey box for
            // `brightness` behind a transparent image, so the bud dims
            // through opacity over the dark hole (as Session End does).
            slot === 'sleeping' && styles.sleeping,
            waking && wake,
          ]}
        >
          <PathImage
            id={slot === 'sleeping' ? 'ui-bud-closed' : 'ui-bud-open'}
            px={62 * s}
          />
        </Animated.View>
      )}
      {slot === 'sleeping' && (
        <>
          <View
            style={[
              styles.moon,
              { right: -0.12 * size, top: -0.14 * size },
              imageShadow(2 * s, 2 * s, 'rgba(0, 0, 0, 0.3)'),
            ]}
          >
            <MoonIcon size={0.48 * size} />
          </View>
          <SleepingZ s={s} reducedMotion={reducedMotion} />
        </>
      )}
    </View>
  )
}

export interface HubFlowerTrayProps {
  model: HubCardModel
  /** Slot indexes whose bud opens on this visit. */
  wakeSlots: readonly number[]
  s: number
  reducedMotion: boolean
}

export function HubFlowerTray({
  model,
  wakeSlots,
  s,
  reducedMotion,
}: HubFlowerTrayProps) {
  const look = TRAY[model.world]
  return (
    <View
      testID="hub-tray"
      accessible={false}
      pointerEvents="none"
      style={[
        styles.tray,
        {
          left: 22 * s,
          top: (672 - 30 - 108) * s,
          width: 222 * s,
          height: 108 * s,
          borderRadius: 40 * s,
          paddingHorizontal: 8 * s,
          backgroundColor: look.flat,
          experimental_backgroundImage: look.face,
          boxShadow: look.shadow(s),
        },
      ]}
    >
      {model.slots.map((slot, i) => (
        <Hole
          key={i}
          slot={slot}
          waking={slot === 'grown' && wakeSlots.includes(i)}
          s={s}
          reducedMotion={reducedMotion}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  tray: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  hole: {
    backgroundColor: '#4e2c19',
    experimental_backgroundImage:
      'radial-gradient(circle at 50% 62%, #6b4128 0%, #4e2c19 60%, #3d2112 100%)',
  },
  bud: { position: 'absolute' },
  sleeping: { opacity: 0.85 },
  moon: { position: 'absolute' },
  zz: {
    position: 'absolute',
    fontFamily: fonts.bold,
    color: '#ffffff',
    textShadowColor: '#6b4a9c',
    textShadowRadius: 0,
  },
})
