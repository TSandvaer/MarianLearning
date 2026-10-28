/**
 * The raft picker (raft-island-goal § 5): a harbour of ponds on the
 * garden, one per open raft, the whole pond the button (Decision 7). Each
 * pond holds its raft at full size (its board, a blank flag) and its
 * island with the nine homes as they are, filled in colour and empty as
 * shapes, no tags (Decision 8). It never speaks and shows no count.
 *
 * The reveal (§ 3.2) runs here after the 10 island's party: the 20 pond
 * fades in and its raft glides up into it from the pond's lower edge,
 * then docks with a dip. Its steps are `RaftGame`'s; this draws them.
 */
import type { RaftTarget, RaftWeight } from '@marian/core/games/playPlace'
import type { IslandRecord } from '@marian/core/games/raftIsland'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import type { RaftPond } from './playGeometry'
import { raftForLabel } from './playLines'
import { bandRadius, bandShadow, clayK, rectStyle } from './raftPaint'
import {
  Deck,
  HomeArt,
  IslandGround,
  WATER,
  WATER_DEEP,
  WATER_LEDGE,
} from './RaftParts'

/** § 5.3: a pond's press, the Play-place tile's (6 × k over 120 ms). */
export const POND_PRESS_MS = 120
/** § 9: Reduce Motion, a 150 ms dim instead of the sink. */
const POND_DIM_MS = 150
/** § 3.2, from `R0`: the 20 pond fades in (300 ms), its raft glides up. */
export const REVEAL_POND_AT_MS = 400
export const REVEAL_POND_FADE_MS = 300
export const REVEAL_GLIDE_MS = 1200
/** It docks at R0 + 1600; the deck dips 4 pt and back (300 ms). */
export const REVEAL_DOCK_AT_MS = 1600
const REVEAL_DIP_MS = 300
/** Docked → Emma idle, touch unlocks: max(J2, 300) + 200. */
export const REVEAL_UNLOCK_GAP_MS = 500
/** Reduce Motion: pond, island and raft fade in together (400 ms) at
 *  R0 + 400; the sparkle at R0 + 800. */
export const REDUCED_REVEAL_FADE_MS = 400
export const REDUCED_REVEAL_DOCK_AT_MS = 800

/** Where the reveal stands: the 20 pond hidden, gliding in, docked. */
export type RevealPhase = 'none' | 'hidden' | 'glide' | 'docked'

export function RaftPicker({
  ponds,
  record,
  tablet,
  reducedMotion,
  frameKey,
  reveal,
  locked,
  onPick,
}: {
  ponds: readonly RaftPond[]
  record: IslandRecord
  tablet: boolean
  reducedMotion: boolean
  frameKey: string
  reveal: RevealPhase
  locked: boolean
  onPick: (target: RaftTarget) => void
}) {
  return (
    <View testID="raft-picker" pointerEvents="box-none" style={styles.fill}>
      {ponds.map((p) => {
        const revealing = p.target === 20 && reveal !== 'none'
        if (revealing && reveal === 'hidden') return null
        return (
          <Pond
            key={p.target}
            pond={p}
            homes={record[p.target]}
            tablet={tablet}
            reducedMotion={reducedMotion}
            frameKey={frameKey}
            reveal={revealing ? reveal : 'none'}
            locked={locked}
            onPress={() => onPick(p.target)}
          />
        )
      })}
    </View>
  )
}

function Pond({
  pond: p,
  homes,
  tablet,
  reducedMotion,
  frameKey,
  reveal,
  locked,
  onPress,
}: {
  pond: RaftPond
  homes: readonly RaftWeight[]
  tablet: boolean
  reducedMotion: boolean
  frameKey: string
  reveal: RevealPhase
  locked: boolean
  onPress: () => void
}) {
  const k = clayK(tablet)
  const R = bandRadius(tablet)
  const [down, setDown] = useState(false)
  const sink = useSharedValue(0)
  const dim = useSharedValue(1)
  const depth = 6 * k
  useEffect(() => {
    if (reducedMotion) {
      if (down) {
        dim.set(
          withSequence(
            withTiming(0.85, { duration: POND_DIM_MS / 2 }),
            withTiming(1, { duration: POND_DIM_MS / 2 }),
          ),
        )
      }
      return
    }
    sink.set(withTiming(down ? depth : 0, { duration: POND_PRESS_MS }))
  }, [down, depth, reducedMotion, sink, dim])
  const pressed = useAnimatedStyle(() => ({
    opacity: dim.get(),
    transform: [{ translateY: sink.get() }],
  }))

  // The reveal's raft: up from below the pond's lower edge (clipped), then
  // a 4 pt dip as it docks; a new layout jumps it home.
  const rise = p.pond.y + p.pond.height - p.deck.y
  const lift = useSharedValue(reveal === 'glide' && !reducedMotion ? rise : 0)
  const dip = useSharedValue(0)
  useEffect(() => {
    if (reveal === 'glide' && !reducedMotion) {
      lift.set(
        withTiming(0, {
          duration: REVEAL_GLIDE_MS,
          easing: Easing.out(Easing.quad),
        }),
      )
    }
    if (reveal === 'docked' && !reducedMotion) {
      lift.set(0)
      dip.set(
        withSequence(
          withTiming(4, { duration: REVEAL_DIP_MS / 2 }),
          withTiming(0, { duration: REVEAL_DIP_MS / 2 }),
        ),
      )
    }
  }, [reveal, reducedMotion, lift, dip])
  useEffect(() => {
    lift.set(0)
  }, [frameKey, lift])
  const raftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.get() + dip.get() }],
  }))

  const scene = { ...p.raft, dock: p.deck, landing: p.deck }
  const local = (r: {
    x: number
    y: number
    width: number
    height: number
  }) => ({
    ...r,
    x: r.x - p.pond.x,
    y: r.y - p.pond.y,
  })
  const fadeIn =
    reveal === 'glide'
      ? FadeIn.duration(
          reducedMotion ? REDUCED_REVEAL_FADE_MS : REVEAL_POND_FADE_MS,
        )
      : undefined
  return (
    <Animated.View
      entering={fadeIn}
      pointerEvents="box-none"
      style={[styles.abs, rectStyle(p.pond)]}
    >
      <Pressable
        testID={`raft-pond-${p.target}`}
        accessibilityRole="button"
        accessibilityLabel={raftForLabel(p.target)}
        disabled={locked}
        onPressIn={() => setDown(true)}
        onPressOut={() => setDown(false)}
        onPress={onPress}
        style={styles.fill}
      >
        <Animated.View
          testID={`raft-pond-${p.target}-face`}
          pointerEvents="none"
          style={[styles.fill, pressed]}
        >
          {/* T2's pool slab, no ripples. */}
          <View
            style={[
              styles.fill,
              styles.pool,
              {
                borderRadius: R,
                experimental_backgroundImage: `linear-gradient(180deg, ${WATER} 0%, ${WATER_DEEP} 100%)`,
                boxShadow: bandShadow(WATER_LEDGE, k),
              },
            ]}
          />
          <View style={[styles.fill, styles.clip, { borderRadius: R }]}>
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={[styles.fill, { left: -p.pond.x, top: -p.pond.y }]}
            >
              <IslandGround
                scene={scene}
                oval={p.island}
                tips={false}
                tablet={tablet}
                id={`raft-pond-${p.target}-island`}
              />
              {p.homes.map((r, i) => {
                const w = (i + 1) as RaftWeight
                return (
                  <View
                    key={w}
                    testID={`raft-pond-${p.target}-home-${w}`}
                    style={[styles.abs, rectStyle(r)]}
                  >
                    <HomeArt
                      weight={w}
                      size={r.width}
                      filled={homes.includes(w)}
                      tag={false}
                      tablet={tablet}
                      id={`raft-pond-${p.target}-home-${w}`}
                    />
                  </View>
                )
              })}
              <Animated.View style={[styles.fill, raftStyle]}>
                <Deck
                  scene={scene}
                  rect={p.deck}
                  total={0}
                  splashing={false}
                  gliding={reveal === 'glide'}
                  reducedMotion={reducedMotion}
                  frameKey={frameKey}
                  tablet={tablet}
                  labelled={false}
                  testID={`raft-pond-${p.target}-raft`}
                />
              </Animated.View>
            </View>
          </View>
          {reveal === 'glide' && !reducedMotion && (
            <View testID="raft-reveal-glide" style={local(p.deck)} />
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  abs: { position: 'absolute' },
  pool: { backgroundColor: WATER },
  clip: { overflow: 'hidden' },
})
