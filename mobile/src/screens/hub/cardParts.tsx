/**
 * The middle of a Hub card (web `HubPathCard.tsx` `hub-card-progress` +
 * `hubClay.css`): the current step as a big glowing clay sticker on a
 * plinth with two twinkling sparks, the next step as a small muted sticker
 * with a padlock (or the bloom when the world has no next step), and the
 * land pill. Positions are the web's card-relative reference px × s.
 */
import type { HubCardModel } from '@marian/core/hub/hubCardModel'
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { pathArtMutedAsset } from '../../assets'
import { PathImage } from '../../components/PathImage'
import { fonts } from '../../theme'
import { EASE_IN_OUT, box, imageShadow } from './clay'

/** Web `.hub-glow`: 2.4 s; `.hub-spark`: 1.8 s. */
const GLOW_PERIOD_MS = 2400
const SPARK_PERIOD_MS = 1800

/** A 0 → 1 → 0 ease-in-out loop from `delay`, held at 0 on Reduce Motion. */
function useLoop(periodMs: number, reducedMotion: boolean, delay = 0) {
  const t = useSharedValue(0)
  useEffect(() => {
    if (reducedMotion) {
      t.set(0)
      return
    }
    const half = { duration: periodMs / 2, easing: EASE_IN_OUT }
    t.set(
      withDelay(
        delay,
        withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1),
      ),
    )
    return () => cancelAnimation(t)
  }, [t, periodMs, reducedMotion, delay])
  return t
}

function Spark({
  s,
  x,
  y,
  delay,
  reducedMotion,
}: PartProps & {
  x: number
  y: number
  delay: number
}) {
  const t = useLoop(SPARK_PERIOD_MS, reducedMotion, delay)
  const twinkle = useAnimatedStyle(() => ({
    opacity: 1 - 0.6 * t.get(),
    transform: [{ scale: 1 - 0.5 * t.get() }],
  }))
  return (
    <Animated.View style={[box(s, x, y, 22, 22), twinkle]}>
      <Svg width={22 * s} height={22 * s} viewBox="0 0 100 100">
        <Path
          d="M50 0 L60 40 L100 50 L60 60 L50 100 L40 60 L0 50 L40 40 Z"
          fill="#fff6b0"
        />
      </Svg>
    </Animated.View>
  )
}

/**
 * Web `.hub-glow` (236 at 36, 170): a radial disc with a ring + halo whose
 * shadow pulses to its peak and back. Reanimated can't tween a shadow
 * string, so the peak shadow is a second layer whose opacity loops.
 */
function Glow({ s, reducedMotion }: PartProps) {
  const t = useLoop(GLOW_PERIOD_MS, reducedMotion)
  const peak = useAnimatedStyle(() => ({ opacity: t.get() }))
  const round = { borderRadius: 118 * s }
  return (
    <>
      <View
        style={[
          box(s, 36, 170, 236, 236),
          round,
          styles.glow,
          {
            boxShadow: `0 0 0 ${5 * s}px #ffe27a, 0 0 ${30 * s}px ${8 * s}px #ffd23f99`,
          },
        ]}
      />
      <Animated.View
        style={[
          box(s, 36, 170, 236, 236),
          round,
          {
            boxShadow: `0 0 0 ${5 * s}px #fff0a8, 0 0 ${44 * s}px ${14 * s}px #ffd23fbb`,
          },
          peak,
        ]}
      />
    </>
  )
}

/** Web `.hub-plinth`: an oval clay pedestal. */
function Plinth({
  s,
  x,
  y,
  w,
  h,
}: {
  s: number
  x: number
  y: number
  w: number
  h: number
}) {
  return (
    <View
      style={[
        box(s, x, y, w, h),
        styles.plinth,
        {
          boxShadow: `0 ${10 * s}px 0 #b8946a, 0 ${16 * s}px ${18 * s}px rgba(60, 30, 10, 0.25)`,
        },
      ]}
    />
  )
}

interface PartProps {
  s: number
  reducedMotion: boolean
}

export function CardProgress({
  model,
  s,
  reducedMotion,
}: PartProps & { model: HubCardModel }) {
  const next = model.unlocksNext ?? 'ui-bloom'
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Plinth s={s} x={50} y={380} w={208} h={64} />
      <Glow s={s} reducedMotion={reducedMotion} />
      <View
        style={[
          box(s, 46, 180, 216, 216),
          imageShadow(6 * s, 4 * s, 'rgba(60, 30, 10, 0.25)'),
        ]}
      >
        <PathImage
          testID={`hub-card-current-${model.current}`}
          id={model.current}
          px={216 * s}
        />
      </View>
      <Spark s={s} x={52} y={196} delay={0} reducedMotion={reducedMotion} />
      <Spark s={s} x={236} y={360} delay={700} reducedMotion={reducedMotion} />

      <Plinth s={s} x={262} y={388} w={104} h={34} />
      <View
        style={[
          box(s, 258, 290, 112, 112),
          imageShadow(5 * s, 3 * s, 'rgba(60, 30, 10, 0.2)'),
        ]}
      >
        <Image
          testID={
            model.unlocksNext === null
              ? 'hub-card-bloom'
              : `hub-card-next-${model.unlocksNext}`
          }
          source={pathArtMutedAsset(next)}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessible={false}
          style={{ width: 112 * s, height: 112 * s }}
        />
      </View>
      {model.unlocksNext !== null && (
        <View
          style={[
            box(s, 318, 350, 52, 52),
            imageShadow(3 * s, 2 * s, 'rgba(0, 0, 0, 0.25)'),
          ]}
        >
          <PathImage testID="hub-card-lock" id="ui-padlock" px={52 * s} />
        </View>
      )}

      {model.showLandNumber && <LandPill model={model} s={s} />}
    </View>
  )
}

/** Web `.hub-landpill`: land emblem + numeral (right 18, top 176). */
function LandPill({ model, s }: { model: HubCardModel; s: number }) {
  return (
    <View
      testID="hub-land-number"
      style={[
        styles.pill,
        {
          right: 18 * s,
          top: 176 * s,
          height: 58 * s,
          gap: 2 * s,
          paddingLeft: 4 * s,
          paddingRight: 14 * s,
          borderRadius: 30 * s,
          boxShadow: `inset 0 ${3 * s}px 0 #ffffff, 0 ${5 * s}px 0 rgba(90, 50, 20, 0.35)`,
        },
      ]}
    >
      <PathImage id={model.landArt} px={54 * s} />
      <Text
        allowFontScaling={false}
        style={[styles.pillText, { fontSize: 32 * s, lineHeight: 32 * s }]}
      >
        {model.landNumber}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  glow: {
    experimental_backgroundImage:
      'radial-gradient(circle, #fff7c2 0%, #ffe066cc 45%, #ffd23f00 70%)',
  },
  plinth: {
    borderRadius: '50%',
    backgroundColor: '#f1dcc0',
    experimental_backgroundImage:
      'radial-gradient(ellipse at 45% 30%, #fff8ec 0%, #f1dcc0 55%, #d9bb94 100%)',
  },
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8eedc',
    experimental_backgroundImage: 'linear-gradient(#fffaf0, #f3e3c8)',
  },
  pillText: { fontFamily: fonts.bold, color: '#6b3f1f' },
})
