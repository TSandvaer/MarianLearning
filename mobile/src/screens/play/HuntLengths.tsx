/**
 * Letter critters' four-letter rounds, drawn (`design/native/critters-four-letter.md`
 * § 3, § 5, § 6): the sockets under a hunt log's seats, the length picker's
 * two logs lying in the meadow, the arrival slab that glides in when "4"
 * opens, and the door it becomes. Every piece is a View; the paint is
 * the restyle's tokens (`play-games-restyle.md` T8 wood and sockets, T9
 * green clay, T11 end grain). The game (`CrittersGame.tsx`,
 * `LetterCritters.tsx`) owns every state and time; these only draw and
 * animate what they are given.
 */
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import type { Rect } from '../../layout/layout'
import { fonts } from '../../theme'
import { PRESS_MS } from '../hub/clay'
import { OVER_PIECE_Z } from './dragLock'
import {
  centre,
  logSockets,
  type ArrivalScene,
  type LogParts,
  type PickerLog,
  type PickerScene,
} from './playGeometry'

/** § 5.3: about 200 ms after the release the picker gives way. */
export const PICK_AFTER_MS = 200
/** § 8.1: Reduce Motion's press, a 150 ms dim (1 → 0.85 → 1). */
export const PICK_DIM_MS = 150
/**
 * § 5.3, the wave: 300 ms after the picker's fade-in ends, the logs hop in
 * turn, 120 ms apart, each up and back over 480 ms; again on a press on
 * the meadow, but never twice within 1200 ms. It answers a touch, never a
 * timer.
 */
export const PICK_WAVE_AFTER_MS = 300
export const PICK_WAVE_STAGGER_MS = 120
export const PICK_HOP_MS = 480
export const PICK_WAVE_GAP_MS = 1200
/** The picker's fade-in, the Play place's and `CRITTERS_SWAP_MS` (200 ms). */
const PICK_FADE_IN_MS = 200
/** The hop's rise and fall: CSS ease-out, then ease-in. */
const HOP_UP = Easing.bezier(0, 0, 0.58, 1)
const HOP_DOWN = Easing.bezier(0.42, 0, 1, 1)
/**
 * § 6.1, from U0 (the beat's "its end + 900"): the glide; the rest, the
 * sparkle and the dip; the flight to the door; the door in place, New
 * letters and the unlock.
 */
export const ROLL_GLIDE_MS = 1200
export const ROLL_DIP_MS = 300
export const ROLL_FLY_AT_MS = 2300
export const ROLL_FLY_MS = 500
export const ROLL_DONE_MS = 2800
/** Over the flight's last 200 ms the slab fades and the disc fills the door. */
const ROLL_FADE_SHARE = 200 / ROLL_FLY_MS
/** § 8.1: Reduce Motion's door fades in at U0 + 1200. */
export const DOOR_FADE_MS = 300

const LETTER = '#6b3f1f'
/** T8: the log's wood face and ledge, phone and tablet. */
const WOOD = 'linear-gradient(#e7b07a 0%, #c98a55 55%, #a86c3c 100%)'
const woodLedge = (tablet: boolean) =>
  tablet
    ? '0 6px 0 #7d4a26, 0 10px 14px rgba(60,30,10,0.3)'
    : '0 5px 0 #7d4a26, 0 8px 10px rgba(60,30,10,0.3)'
const woodShadow = (tablet: boolean) =>
  `inset 0 3px 0 rgba(255,255,255,0.3), ${woodLedge(tablet)}`
/** T8: a socket, the Hub tray's hole. */
const SOCKET =
  'radial-gradient(circle at 50% 62%, #6b4128 0%, #4e2c19 60%, #3d2112 100%)'
const socketShadow = (tablet: boolean) =>
  tablet
    ? 'inset 0 4px 5px rgba(0,0,0,0.45), 0 2px 0 rgba(255,255,255,0.35)'
    : 'inset 0 3px 4px rgba(0,0,0,0.45), 0 1.5px 0 rgba(255,255,255,0.35)'
/** T11: the end grain, a carved ring. */
const GRAIN =
  'radial-gradient(circle at 40% 32%, #fbe6c8 0%, #f2d3a6 60%, #dcb27c 100%)'
const GRAIN_RING =
  'inset 0 0 0 3px rgba(125,74,38,0.22), inset 0 2px 0 rgba(255,255,255,0.5)'
/**
 * § 5.2: a picker log's contact shadow on the meadow, T9's band-shadow
 * brown, darker.
 */
const GROUND =
  'radial-gradient(ellipse at 50% 50%, rgba(60,40,10,0.3) 0%, rgba(60,40,10,0.15) 38%, rgba(60,40,10,0) 70%)'
/** T9: the arrival slab's green clay and its shadow at the band's k. */
const MEADOW = 'linear-gradient(#d7f2c4, #a9d68c)'
const meadowShadow = (tablet: boolean) => {
  const k = tablet ? 0.7 : 0.45
  return `inset 0 ${5 * k}px 0 rgba(255, 255, 255, 0.4), inset 0 ${-8 * k}px 0 rgba(0, 0, 0, 0.08), 0 ${10 * k}px 0 #a9d68c, 0 ${18 * k}px ${24 * k}px rgba(60, 40, 10, 0.15)`
}

const rectStyle = (r: Rect) => ({
  left: r.x,
  top: r.y,
  width: r.width,
  height: r.height,
})
const relTo = (o: { x: number; y: number }, r: Rect): Rect => ({
  ...r,
  x: r.x - o.x,
  y: r.y - o.y,
})

/**
 * A hunt log's sockets (T8, critters-four-letter.md § 3): an oval under
 * each seat, 0.64 of it wide, on the log's bar. Drawn relative to `origin`.
 */
export function LogSockets({
  seats,
  bar,
  origin,
  tablet,
  testID,
}: {
  seats: readonly Rect[]
  bar: Rect
  origin: { x: number; y: number }
  tablet: boolean
  testID?: string
}) {
  return (
    <>
      {logSockets(seats, bar).map((r, i) => (
        <View
          key={i}
          testID={testID === undefined ? undefined : `${testID}-${i}`}
          pointerEvents="none"
          style={[
            styles.abs,
            rectStyle(relTo(origin, r)),
            {
              borderRadius: r.height / 2,
              experimental_backgroundImage: SOCKET,
              boxShadow: socketShadow(tablet),
            },
          ]}
        />
      ))}
    </>
  )
}

/** The end-grain disc with its length, Fredoka 700 at 0.62 of its side. */
function GrainDisc({ rect, length }: { rect: Rect; length: number }) {
  const D = rect.width
  return (
    <View
      pointerEvents="none"
      style={[
        styles.abs,
        styles.centred,
        rectStyle(rect),
        {
          borderRadius: D / 2,
          experimental_backgroundImage: GRAIN,
          boxShadow: GRAIN_RING,
        },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[styles.numeral, { fontSize: 0.62 * D, lineHeight: D }]}
      >
        {String(length)}
      </Text>
    </View>
  )
}

/**
 * A log on its own (§ 5.2, § 6.1): T8's wood bar with a socket under each
 * seat and the length's end-grain disc on its left end; the seats above it
 * are empty garden. Drawn relative to `origin`; never an element. `motion`
 * moves it whole (the picker's press and hop).
 */
function BareLog({
  log,
  origin,
  tablet,
  length,
  testID,
  motion,
}: {
  log: LogParts
  origin: { x: number; y: number }
  tablet: boolean
  length: number
  testID: string
  motion?: AnimatedStyle<ViewStyle>
}) {
  const bar = relTo(origin, log.bar)
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      style={[styles.fill, motion]}
    >
      <View
        style={[
          styles.abs,
          rectStyle(bar),
          {
            borderRadius: bar.height / 2,
            experimental_backgroundImage: WOOD,
            boxShadow: woodShadow(tablet),
          },
        ]}
      />
      <LogSockets
        seats={log.seats}
        bar={log.bar}
        origin={origin}
        tablet={tablet}
        testID={`${testID}-socket`}
      />
      <GrainDisc rect={relTo(origin, log.disc)} length={length} />
    </Animated.View>
  )
}

/**
 * One of the picker's logs (§ 5.2, § 5.3): its row is the button. A press
 * sinks the log, its sockets and disc 6 × k over 120 ms (k 7/12 on phones,
 * 1 on tablets) while its shadow stays on the ground; Reduce Motion: a
 * 150 ms dim instead. The wave's hop lifts it `rise` and dims the shadow
 * to 0.75 at the top.
 */
function PickerLogButton({
  entry: { length, hit, log, shadow },
  lift,
  rise,
  tablet,
  reducedMotion,
  label,
  onDown,
  onPress,
}: {
  entry: PickerLog
  lift: SharedValue<number>
  rise: number
  tablet: boolean
  reducedMotion: boolean
  label: string
  onDown: () => void
  onPress: () => void
}) {
  const [down, setDown] = useState(false)
  const sink = useSharedValue(0)
  const dim = useSharedValue(1)
  const depth = 6 * (tablet ? 1 : 7 / 12)
  useEffect(() => {
    if (reducedMotion) {
      if (down) {
        dim.set(
          withSequence(
            withTiming(0.85, { duration: PICK_DIM_MS / 2 }),
            withTiming(1, { duration: PICK_DIM_MS / 2 }),
          ),
        )
      }
      return
    }
    sink.set(withTiming(down ? depth : 0, { duration: PRESS_MS }))
  }, [down, depth, reducedMotion, sink, dim])
  const moved = useAnimatedStyle(() => ({
    opacity: dim.get(),
    transform: [{ translateY: sink.get() - lift.get() }],
  }))
  const ground = useAnimatedStyle(() => ({
    opacity: 1 - (0.25 * lift.get()) / rise,
  }))
  return (
    <Pressable
      testID={`hunt-pick-${length}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => {
        onDown()
        setDown(true)
      }}
      onPressOut={() => setDown(false)}
      onPress={onPress}
      style={[styles.abs, rectStyle(hit)]}
    >
      <Animated.View
        testID={`hunt-pick-${length}-shadow`}
        pointerEvents="none"
        accessible={false}
        style={[
          styles.abs,
          rectStyle(relTo(hit, shadow)),
          { experimental_backgroundImage: GROUND },
          ground,
        ]}
      />
      <BareLog
        log={log}
        origin={hit}
        tablet={tablet}
        length={length}
        testID={`hunt-pick-${length}-log`}
        motion={moved}
      />
    </Pressable>
  )
}

/**
 * The length picker (§ 5): two logs lying in the meadow, "3" on top and
 * "4" below, their discs lined up. No slab, critters, slots, text or
 * count, the same whatever the rounds hold (Decision 5). It never speaks.
 * The wave (§ 5.3) answers the tap that brought her here and a press on
 * the meadow that misses the logs; a press on a log cuts it, and Reduce
 * Motion has none.
 */
export function LengthPicker({
  scene,
  tablet,
  reducedMotion,
  labels,
  onPick,
}: {
  scene: PickerScene
  tablet: boolean
  reducedMotion: boolean
  labels: Readonly<Record<3 | 4, string>>
  onPick: (length: 3 | 4) => void
}) {
  const lift3 = useSharedValue(0)
  const lift4 = useSharedValue(0)
  const lifts = { 3: lift3, 4: lift4 }
  const rise = tablet ? 4 : 3
  const hopsRef = useRef(new Set<ReturnType<typeof setTimeout>>())
  const lastWaveRef = useRef(-Infinity)
  const after = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      hopsRef.current.delete(timer)
      fn()
    }, ms)
    hopsRef.current.add(timer)
  }
  const wave = () => {
    const now = Date.now()
    if (reducedMotion || now - lastWaveRef.current < PICK_WAVE_GAP_MS) return
    lastWaveRef.current = now
    scene.logs.forEach(({ length }, i) => {
      const hop = () =>
        lifts[length].set(
          withSequence(
            withTiming(rise, { duration: PICK_HOP_MS / 2, easing: HOP_UP }),
            withTiming(0, { duration: PICK_HOP_MS / 2, easing: HOP_DOWN }),
          ),
        )
      if (i === 0) hop()
      else after(hop, i * PICK_WAVE_STAGGER_MS)
    })
  }
  const cut = () => {
    hopsRef.current.forEach(clearTimeout)
    hopsRef.current.clear()
    for (const lift of [lift3, lift4]) {
      cancelAnimation(lift)
      lift.set(0)
    }
  }
  useEffect(() => {
    const hops = hopsRef.current
    after(wave, PICK_FADE_IN_MS + PICK_WAVE_AFTER_MS)
    return () => hops.forEach(clearTimeout)
    // Mount-once: the wave that answers her arrival (rotation lays the
    // picker out again without one).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <View testID="hunt-picker" pointerEvents="box-none" style={styles.fill}>
      <Pressable
        testID="hunt-pick-meadow"
        accessible={false}
        onPressIn={wave}
        style={[styles.abs, rectStyle(scene.meadow)]}
      />
      {scene.logs.map((entry) => (
        <PickerLogButton
          key={entry.length}
          entry={entry}
          lift={lifts[entry.length]}
          rise={rise}
          tablet={tablet}
          reducedMotion={reducedMotion}
          label={labels[entry.length]}
          onDown={cut}
          onPress={() => onPick(entry.length)}
        />
      ))}
    </View>
  )
}

/** The flight's ease in-out, as a worklet (quad). */
const easeInOut = (t: number) => {
  'worklet'
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

/**
 * The roll-in's arrival (§ 6.1): a green clay slab carrying the four-seat
 * log enters from beyond the screen's right edge and glides to rest
 * centred in `A` (1200 ms, ease-out); at rest it dips 4 pt and back
 * (300 ms); then it flies to the door, shrinking onto its rect (500 ms,
 * ease in-out), the slab, bar and sockets fading over the last 200 ms
 * while the "4" disc grows to fill the door. Drawn above everything. Not
 * on Reduce Motion (the door fades in instead).
 */
export function ArrivalSlab({
  scene,
  door,
  phase,
  tablet,
}: {
  scene: ArrivalScene
  door: Rect
  phase: 'glide' | 'rest' | 'fly'
  tablet: boolean
}) {
  const { slab, log, startX } = scene
  const glide = useSharedValue(startX - slab.x)
  const dip = useSharedValue(0)
  const t = useSharedValue(0)
  useEffect(() => {
    glide.set(
      withTiming(0, {
        duration: ROLL_GLIDE_MS,
        easing: Easing.out(Easing.quad),
      }),
    )
    // Mount-once: the glide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (phase === 'rest') {
      dip.set(
        withSequence(
          withTiming(4, { duration: ROLL_DIP_MS / 2 }),
          withTiming(0, { duration: ROLL_DIP_MS / 2 }),
        ),
      )
    }
    if (phase === 'fly') t.set(withTiming(1, { duration: ROLL_FLY_MS }))
  }, [phase, dip, t])
  const sc = centre(slab)
  const dc = centre(door)
  const disc = log.disc
  const discC = centre(disc)
  const sEnd = door.width / slab.width
  const body = useAnimatedStyle(() => {
    const e = easeInOut(t.get())
    const fade = Math.max(
      0,
      (t.get() - (1 - ROLL_FADE_SHARE)) / ROLL_FADE_SHARE,
    )
    return {
      opacity: 1 - fade,
      transform: [
        { translateX: glide.get() + (dc.x - sc.x) * e },
        { translateY: dip.get() + (dc.y - sc.y) * e },
        { scale: 1 + (sEnd - 1) * e },
      ],
    }
  })
  const discStyle = useAnimatedStyle(() => {
    const e = easeInOut(t.get())
    const s = 1 + (sEnd - 1) * e
    const q = Math.max(0, (t.get() - (1 - ROLL_FADE_SHARE)) / ROLL_FADE_SHARE)
    // The disc where the shrinking slab carries it, then onto the door.
    const fx = sc.x + glide.get() + (dc.x - sc.x) * e + s * (discC.x - sc.x)
    const fy = sc.y + dip.get() + (dc.y - sc.y) * e + s * (discC.y - sc.y)
    const size = disc.width * s + (door.width - disc.width * s) * q
    return {
      transform: [
        { translateX: fx + (dc.x - fx) * q - discC.x },
        { translateY: fy + (dc.y - fy) * q - discC.y },
        { scale: size / disc.width },
      ],
    }
  })
  return (
    <View pointerEvents="none" style={[styles.fill, styles.over]}>
      <Animated.View
        testID="hunt-roll-in"
        style={[
          styles.abs,
          rectStyle(slab),
          {
            borderRadius: slab.height / 2,
            experimental_backgroundImage: MEADOW,
            boxShadow: meadowShadow(tablet),
          },
          body,
        ]}
      >
        <BareLog
          log={{ ...log, disc: { ...disc, width: 0, height: 0 } }}
          origin={slab}
          tablet={tablet}
          length={4}
          testID="hunt-roll-in-log"
        />
      </Animated.View>
      <Animated.View
        testID="hunt-roll-in-disc"
        style={[styles.abs, rectStyle(disc), discStyle]}
      >
        <GrainDisc rect={{ ...disc, x: 0, y: 0 }} length={4} />
      </Animated.View>
    </View>
  )
}

/**
 * The door (§ 6.2): the log's end grain as a clay button, a "4" on it, by
 * New letters. New letters' press (6 × k over 120 ms, k its side / 96).
 * No text, badge, glow or idle motion. Until it lands (`live`) it is no
 * element; Reduce Motion: it fades in (300 ms).
 */
export function HuntDoor({
  rect,
  tablet,
  live,
  fadeIn,
  label,
  onPress,
}: {
  rect: Rect
  tablet: boolean
  live: boolean
  fadeIn: boolean
  label: string
  onPress: () => void
}) {
  const [down, setDown] = useState(false)
  const sink = useSharedValue(0)
  const k = rect.width / 96
  useEffect(() => {
    sink.set(withTiming(down ? 6 * k : 0, { duration: PRESS_MS }))
  }, [down, k, sink])
  const pressed = useAnimatedStyle(() => ({
    transform: [{ translateY: sink.get() }],
  }))
  return (
    <Animated.View
      entering={fadeIn ? FadeIn.duration(DOOR_FADE_MS) : undefined}
      pointerEvents="box-none"
      style={[styles.fill, styles.top]}
    >
      <Pressable
        testID="hunt-open-four"
        accessible={live}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={!live}
        onPressIn={() => setDown(true)}
        onPressOut={() => setDown(false)}
        onPress={onPress}
        style={[styles.abs, rectStyle(rect)]}
      >
        <Animated.View
          style={[
            styles.fill,
            styles.centred,
            {
              borderRadius: rect.width / 2,
              experimental_backgroundImage: GRAIN,
              boxShadow: `${GRAIN_RING}, ${woodLedge(tablet)}`,
            },
            pressed,
          ]}
        >
          <Text
            allowFontScaling={false}
            style={[
              styles.numeral,
              { fontSize: 0.62 * rect.width, lineHeight: rect.width },
            ]}
          >
            4
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  abs: { position: 'absolute' },
  centred: { alignItems: 'center', justifyContent: 'center' },
  top: { zIndex: 4 },
  // Over every critter, the log and the drag layer (`dragLock.ts`).
  over: { zIndex: OVER_PIECE_Z },
  numeral: { fontFamily: fonts.bold, color: LETTER },
})
