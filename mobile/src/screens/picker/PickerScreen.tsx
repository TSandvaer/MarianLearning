/**
 * "Who is playing?" (learner profiles § 1): a device with 2 to 4 learners
 * opens here after Splash, from the Hub badge, after Session End's
 * handover and on the return rule. Each learner is one tile: their
 * picture on its colour disc and their written name. One tap picks.
 *
 * In the Hub's frame (`../../layout/pickerLayout.ts`) over the Hub
 * backdrop; Emma is App's `EmmaStage`, idle and breathing throughout.
 *
 * - Tiles in, after Emma lands: in reading order, 60 ms apart, scale
 *   0.85 → 1 with opacity 0 → 1 (spring 260 / 20). Reduce Motion: opacity
 *   only, 200 ms, all at once.
 * - "Who is playing?" 300 ms after the last tile lands, the caption
 *   walking as on the Hub; once more 20 s after it ends without a tap
 *   (Greet's re-prompt rule). Until its clip is bundled the caption walks
 *   silently.
 * - A tap: the chime, the chosen disc pulses 1 → 1.06 → 1 over 300 ms
 *   (none with Reduce Motion), and the route changes 400 ms later
 *   (`onPick`). Taps until then are ignored; the other tiles do not dim.
 *
 * Nothing on a tile but the picture and the name (§ 8): no flowers,
 * stars, level, streak or count. Fixed add order, never re-sorted.
 * There is no wrong tile and no error path.
 */
import { pickerWhoLine } from '@marian/core/emmasPath/guidanceLines'
import type { LearnerEntry } from '@marian/core/learners'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import {
  NAME_GAP,
  NAME_LINE_HEIGHT,
  NAME_MIN_SIZE,
  type PickerLayout,
} from '../../layout/pickerLayout'
import { FILL, fonts } from '../../theme'
import { HubBackdrop } from '../hub/HubBackdrop'
import { HubBubble } from '../hub/HubBubble'
import { AvatarDisc } from './AvatarDisc'
import {
  PICKER_LINE_ID,
  pickerLinePlayer,
  playPickChime,
  type PickerLinePlayer,
} from './pickerAudio'
import {
  PICKER_REPROMPT_AFTER_MS,
  PICK_PULSE_MS,
  PICK_ROUTE_DELAY_MS,
  TILE_FADE_MS,
  TILE_STAGGER_MS,
  TILES_IN_AT_MS,
  pickerLineAt,
} from './pickerTiming'

const TILE_SPRING = { stiffness: 260, damping: 20 }
const PRESS_SPRING = { stiffness: 400, damping: 25 }
/** Web slate-700: the name. */
const NAME_COLOR = '#334155'

export interface PickerScreenProps {
  layout: PickerLayout
  /** In add order (the list's order). */
  learners: readonly LearnerEntry[]
  /** A pick, 400 ms after the tap: App switches to that learner. */
  onPick: (learner: LearnerEntry) => void
  /** Test seams. */
  player?: PickerLinePlayer
  chime?: () => void
}

export function PickerScreen({
  layout,
  learners,
  onPick,
  player: playerProp,
  chime = playPickChime,
}: PickerScreenProps) {
  const reducedMotion = useReducedMotion()
  const [player] = useState<PickerLinePlayer>(
    () => playerProp ?? pickerLinePlayer(),
  )
  const [line, setLine] = useState({ take: 0, revealed: 0 })
  const [picked, setPicked] = useState<string | null>(null)
  const pickedRef = useRef(false)
  const onPickRef = useRef(onPick)
  useEffect(() => {
    onPickRef.current = onPick
  })
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }

  // The line: once after the tiles land, once more 20 s after it ends
  // without a tap. Timers and the line stop with the screen.
  const [lineAt] = useState(() => pickerLineAt(learners.length, reducedMotion))
  useEffect(() => {
    const pending = timers.current
    let stopped = false
    const say = async (take: number) => {
      if (stopped || pickedRef.current) return
      setLine({ take, revealed: 0 })
      await player.playLine(PICKER_LINE_ID, {
        onWordTick: (w) => {
          if (!stopped) setLine({ take, revealed: w + 1 })
        },
      })
      if (take === 0 && !stopped && !pickedRef.current) {
        later(() => void say(1), PICKER_REPROMPT_AFTER_MS)
      }
    }
    later(() => void say(0), lineAt)
    return () => {
      stopped = true
      for (const id of pending) clearTimeout(id)
      pending.clear()
      player.cancelActive()
      player.unload()
    }
    // `later` only touches the ref.
  }, [player, lineAt])

  const pick = (learner: LearnerEntry) => {
    if (pickedRef.current) return
    pickedRef.current = true
    player.cancelActive()
    chime()
    setPicked(learner.id)
    later(() => onPickRef.current(learner), PICK_ROUTE_DELAY_MS)
  }

  const who = pickerWhoLine()
  return (
    <>
      <HubBackdrop layout={layout} />
      <View testID="picker" style={styles.foreground}>
        {line.revealed > 0 && (
          <HubBubble
            key={`take-${line.take}`}
            testID="picker-bubble"
            bubble={layout.bubble}
            text={who.text}
            revealedCount={line.revealed}
            lineKey={`${PICKER_LINE_ID}-${line.take}`}
          />
        )}
        {learners.map((learner, i) => (
          <PickerTile
            key={learner.id}
            learner={learner}
            layout={layout}
            index={i}
            reducedMotion={reducedMotion}
            pulsing={picked === learner.id}
            onPress={() => pick(learner)}
          />
        ))}
      </View>
    </>
  )
}

interface PickerTileProps {
  learner: LearnerEntry
  layout: PickerLayout
  index: number
  reducedMotion: boolean
  pulsing: boolean
  onPress: () => void
}

function PickerTile({
  learner,
  layout,
  index,
  reducedMotion,
  pulsing,
  onPress,
}: PickerTileProps) {
  const rect = layout.tiles[index]!
  const shown = useSharedValue(0)
  const press = useSharedValue(1)
  const pulse = useSharedValue(1)

  // Mount-once: a rotation re-grids the tiles but never replays them.
  useEffect(() => {
    shown.set(
      reducedMotion
        ? withDelay(TILES_IN_AT_MS, withTiming(1, { duration: TILE_FADE_MS }))
        : withDelay(
            TILES_IN_AT_MS + index * TILE_STAGGER_MS,
            withSpring(1, TILE_SPRING),
          ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!pulsing || reducedMotion) return
    const half = { duration: PICK_PULSE_MS / 2 }
    pulse.set(withSequence(withTiming(1.06, half), withTiming(1, half)))
  }, [pulsing, reducedMotion, pulse])

  const tileMotion = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.get()),
    transform: [
      {
        scale: (reducedMotion ? 1 : 0.85 + 0.15 * shown.get()) * press.get(),
      },
    ],
  }))
  const discMotion = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.get() }],
  }))
  const pressTo = (to: boolean) => {
    if (reducedMotion) return
    press.set(withSpring(to ? 0.94 : 1, PRESS_SPRING))
  }

  const nameLine = layout.nameSize * NAME_LINE_HEIGHT
  return (
    <Pressable
      testID={`picker-tile-${learner.id}`}
      accessibilityRole="button"
      accessibilityLabel={learner.name === '' ? undefined : learner.name}
      accessibilityState={{ selected: pulsing }}
      onPressIn={() => pressTo(true)}
      onPressOut={() => pressTo(false)}
      onPress={onPress}
      style={[
        styles.tileTarget,
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
      ]}
    >
      <Animated.View style={[styles.tile, tileMotion]}>
        <Animated.View style={discMotion}>
          <AvatarDisc
            avatarId={learner.avatarId}
            size={layout.disc}
            testID={`picker-avatar-${learner.id}`}
          />
        </Animated.View>
        <View style={{ height: nameLine, marginTop: NAME_GAP }}>
          {learner.name !== '' && (
            <Text
              testID={`picker-name-${learner.id}`}
              allowFontScaling={false}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
              minimumFontScale={NAME_MIN_SIZE / layout.nameSize}
              style={[
                styles.name,
                { fontSize: layout.nameSize, lineHeight: nameLine },
              ]}
            >
              {learner.name}
            </Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  foreground: { ...FILL, zIndex: 2, pointerEvents: 'box-none' },
  tileTarget: { position: 'absolute' },
  tile: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: fonts.semibold,
    color: NAME_COLOR,
    textAlign: 'center',
  },
})
