/**
 * A Hub world card in clay (web `HubWorldCard`, `HubPathCard.tsx` +
 * `hubClay.css`; Redesign R2 "Toy Box" with Guidance G1): one sculpted
 * slab per world with its crown and clay title, the current step glowing
 * on a plinth, the next step muted with a padlock, the land pill, the
 * flower tray and the map button. The whole card starts that world; the
 * map button is the only other target in it.
 *
 * The card's box (the Pressable) never moves. Its face carries the slab
 * and everything on it: it sinks 8u while pressed (shadow 14u → 6u), and on
 * the suggested card it bobs twice on mount and wears a breathing golden
 * ring. Both cards are the same size; the other one is never dimmed.
 * Reduce Motion: no bob, the ring holds full opacity, press feedback stays.
 */
import type { HubCardModel } from '@marian/core/hub/hubCardModel'
import type { SkillTreeId } from '@marian/core/sessionEnd/sessionHistory'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import type { Rect } from '../../layout/layout'
import { fonts } from '../../theme'
import { CardProgress } from './cardParts'
import { CSS_EASE, EASE_IN_OUT, PRESS_MS, radii } from './clay'
import { HubFlowerTray } from './HubFlowerTray'
import { MapButton } from './MapButton'
import { SLAB, TITLE, TITLES, crownBackground, crownShadow } from './cardLook'

/** Web `hub-suggest-bob` / `hub-suggest-ring`: 2.2 s. */
export const SUGGEST_PERIOD_MS = 2200
/** The bob runs twice, then rests. */
export const SUGGEST_BOBS = 2

export interface HubCardProps {
  tree: SkillTreeId
  model: HubCardModel
  rect: Rect
  /** Card scale: reference px × s. */
  s: number
  suggested: boolean
  wakeSlots: readonly number[]
  reducedMotion: boolean
  onPress: () => void
  onOpenMap: () => void
}

function ClayTitle({ tree, s }: { tree: SkillTreeId; s: number }) {
  const [first, second] = TITLES[tree]
  const look = TITLE[tree]
  const fontSize = Math.max(22, 52 * s)
  const text = {
    fontSize,
    lineHeight: 0.98 * fontSize,
    letterSpacing: 0.5 * s,
  }
  const layer = (dy: number) => [
    styles.title,
    text,
    { top: 34 * s, transform: [{ translateY: dy }] },
  ]
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Dark extrusion (web shadows at 5u and 6u) with the soft drop
          (web 10u below the face: 4u below this layer). */}
      <Text
        allowFontScaling={false}
        style={[
          layer(6 * s),
          {
            color: look.dark,
            textShadowColor: look.drop,
            textShadowOffset: { width: 0, height: 4 * s },
            textShadowRadius: 10 * s,
          },
        ]}
      >
        {`${first}\n${second}`}
      </Text>
      <Text
        allowFontScaling={false}
        style={[layer(2 * s), { color: look.rim }]}
      >
        {`${first}\n${second}`}
      </Text>
      <Text
        testID="hub-card-title"
        allowFontScaling={false}
        style={[layer(0), { color: look.face }]}
      >
        {first}
        {'\n'}
        <Text style={{ color: look.second }}>{second}</Text>
      </Text>
    </View>
  )
}

export function HubCard({
  tree,
  model,
  rect,
  s,
  suggested,
  wakeSlots,
  reducedMotion,
  onPress,
  onOpenMap,
}: HubCardProps) {
  const slab = SLAB[tree]
  const [down, setDown] = useState(false)
  const press = useSharedValue(0)
  const bob = useSharedValue(0)
  const ring = useSharedValue(1)

  // Mount-once, as the web's CSS animations: a rotation re-renders the
  // card with a new `s` but never restarts the bob.
  useEffect(() => {
    if (!suggested || reducedMotion) return
    const half = { duration: SUGGEST_PERIOD_MS / 2, easing: EASE_IN_OUT }
    bob.set(
      withRepeat(
        withSequence(withTiming(-10, half), withTiming(0, half)),
        SUGGEST_BOBS,
      ),
    )
    ring.set(
      withRepeat(withSequence(withTiming(0.65, half), withTiming(1, half)), -1),
    )
    return () => {
      cancelAnimation(bob)
      cancelAnimation(ring)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pressTo = (to: boolean) => {
    setDown(to)
    press.set(
      withTiming(to ? 8 : 0, {
        duration: reducedMotion ? 0 : PRESS_MS,
        easing: CSS_EASE,
      }),
    )
  }
  const faceMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: (bob.get() + press.get()) * s }],
  }))
  const ringPulse = useAnimatedStyle(() => ({ opacity: ring.get() }))

  return (
    <Pressable
      testID={`hub-card-${tree}`}
      accessibilityRole="button"
      accessibilityLabel={
        tree === 'number-garden' ? 'Number Garden' : 'Word Song'
      }
      accessibilityState={{ selected: suggested }}
      onPressIn={() => pressTo(true)}
      onPressOut={() => pressTo(false)}
      onPress={onPress}
      style={[
        styles.card,
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
      ]}
    >
      <Animated.View
        testID={suggested ? 'hub-card-suggested' : undefined}
        style={[
          styles.face,
          radii(64 * s, 64 * s, 52 * s, 52 * s),
          {
            backgroundColor: slab.flat,
            experimental_backgroundImage: slab.face,
            boxShadow: down ? slab.pressed(s) : slab.rest(s),
          },
          faceMotion,
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.crown,
            radii(70 * s, 70 * s, 40 * s, 40 * s),
            {
              left: -10 * s,
              top: -18 * s,
              width: 398 * s,
              height: 170 * s,
              experimental_backgroundImage: crownBackground(tree, s),
              boxShadow: crownShadow(tree, s),
            },
          ]}
        />
        <ClayTitle tree={tree} s={s} />
        <CardProgress model={model} s={s} reducedMotion={reducedMotion} />
        <HubFlowerTray
          model={model}
          wakeSlots={wakeSlots}
          s={s}
          reducedMotion={reducedMotion}
        />
        <MapButton
          world={model.world}
          s={s}
          reducedMotion={reducedMotion}
          onPress={onOpenMap}
        />
        {suggested && (
          <Animated.View
            testID="hub-card-ring"
            pointerEvents="none"
            style={[
              styles.ring,
              radii(76 * s, 76 * s, 64 * s, 64 * s),
              {
                left: -14 * s,
                top: -14 * s,
                width: rect.width + 28 * s,
                height: rect.height + 28 * s,
                boxShadow: `0 0 0 ${6 * s}px #fff3a8, 0 0 ${36 * s}px ${14 * s}px rgba(255, 210, 63, 0.8)`,
              },
              ringPulse,
            ]}
          />
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { position: 'absolute' },
  face: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  crown: { position: 'absolute' },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.bold,
  },
  ring: { position: 'absolute' },
})
