/**
 * Raft crossing (play-place spec § 2): drag or tap animals 1-9 onto a raft
 * that carries exactly ten. Every boarding and take-off shows the total on
 * the flag and Emma says it ("Seven!"), each total cutting the one before.
 * Too heavy: the raft wobbles, the newest animal splashes off and paddles
 * home, "Too heavy! Splash!"; the others stay, nothing is counted. After
 * two splashes in a row on a stuck raft, a newcomer of exactly the missing
 * weight walks on, unannounced (D4). Exactly ten: Emma waves, "Ten! Off we
 * go!", the raft rows to the island, the animals hop off and play a silly
 * scene, and the raft comes back to a refilled shore. The third crossing is
 * the natural stop: "What a party on the island!", then the Play place.
 *
 * The model is `raftModel.ts`; this screen runs its beats (through the
 * frame's kit: Back clears them, a hidden app holds them) and draws the
 * scene from `raftScene`. A new layout redraws from the same model, and a
 * motion in flight jumps to its end. Reduce Motion (§ 2.5): fades only,
 * the same lines and sounds; a drag still follows the finger.
 */
import { RAFT_ANIMALS, type RaftWeight } from '@marian/core/games/playPlace'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Image } from 'expo-image'
import { pictureAsset } from '../../assets'
import type { Rect } from '../../layout/layout'
import { fonts } from '../../theme'
import { DragPiece } from './DragPiece'
import { SPRING } from './dragLock'
import {
  centre,
  contains,
  grow,
  islandSpot,
  outerness,
  raftScene,
  type Point,
  type RaftScene,
} from './playGeometry'
import type { GameKit } from './playKit'
import { animalLabel, raftLabel, raftTotalLine } from './playLines'
import {
  arrive,
  board,
  finish,
  initialRaft,
  refill,
  splashEnd,
  takeOff,
  tripOver,
  wobbleEnd,
  type RaftState,
  type SceneId,
  type SpotMetric,
} from './raftModel'

/** The open line: 300 ms after the 200 ms fade-in (§ 4.1). */
export const RAFT_OPEN_DELAY_MS = 500
/** Too heavy (§ 2.3). */
export const WOBBLE_MS = 900
export const SPLASH_AT_MS = 500
const SLIDE_MS = 400
const PADDLE_MS = 1200
const SHAKE_MS = 300
export const SPLASH_END_MS = WOBBLE_MS + PADDLE_MS + SHAKE_MS
/** Reduce Motion: the deck dims 300 ms; the animal fades 200 + 200. */
export const REDUCED_WOBBLE_MS = 300
export const REDUCED_SPLASH_END_MS = 400
/** Newcomers' walk-in, 120 ms apart; Reduce Motion: a 200 ms fade. */
export const WALK_MS = 500
const WALK_STAGGER_MS = 120
/** Exactly ten (§ 2.3). */
export const ROW_AT_MS = 600
export const GLIDE_MS = 2400
const REDUCED_GLIDE_MS = 400
const HOP_OFF_MS = 300
const HOP_OFF_STAGGER_MS = 80
export const SCENE_AT_MS = 300
export const SCENE_MS = 2600
export const AFTER_SCENE_MS = 400
export const RETURN_MS = 1600
const REDUCED_RETURN_MS = 400
export const CLOSE_GAP_MS = 800
const FADE_MS = 150

const WOOD = '#c98a55'
const WOOD_RIM = '#7d4a26'
const TAG_FACE = '#FFF5F0'
const TAG_TEXT = '#6b3f1f'
const SAND = '#f2c27a'
const SHORE_SAND = '#f6dca8'
const WATER = '#8fd0ee'
const WATER_DEEP = '#5fb3dd'
const TUFT = '#7bbf5a'

export interface RaftCrossingProps {
  kit: GameKit
  /** Test seam: the first shore's weights. */
  shore?: readonly number[]
}

function metricOf(scene: RaftScene): SpotMetric {
  return {
    distance: (a, b) => {
      const p = centre(scene.spots[a]!)
      const q = centre(scene.spots[b]!)
      return Math.hypot(p.x - q.x, p.y - q.y)
    },
    outer: (spot) => outerness(scene, scene.spots[spot]!),
  }
}

/** Where a seat sits on screen, with the deck at `deck`. */
const seatOnScreen = (scene: RaftScene, deck: Rect, seat: number): Rect => {
  const r = scene.seats[seat]!
  return { ...r, x: deck.x + r.x, y: deck.y + r.y }
}

const delta = (from: Rect, to: Rect): Point => ({
  x: from.x + from.width / 2 - (to.x + to.width / 2),
  y: from.y + from.height / 2 - (to.y + to.height / 2),
})

interface Flight {
  d: Point
  ms: number | 'spring'
  delay: number
}
type Flights = Record<string, Flight>

interface Splash {
  id: number
  weight: RaftWeight
  seat: number
  key: number
}

export function RaftCrossing({ kit, shore }: RaftCrossingProps) {
  const { reducedMotion, sfx } = kit
  const scene = raftScene(kit.area, kit.tablet, kit.landscape)
  const sceneRef = useRef(scene)
  useLayoutEffect(() => {
    sceneRef.current = scene
  })

  const [model, setModel] = useState<RaftState>(() =>
    initialRaft(kit.rng, shore),
  )
  const modelRef = useRef(model)
  /**
   * Where each piece that moves with this change flies in from when it
   * mounts (a FLIP delta), keyed by the piece; set with the model, so the
   * mount reads it in the same render.
   */
  const [flights, setFlights] = useState<Flights>({})
  const apply = (next: RaftState, moving: Flights = {}) => {
    modelRef.current = next
    setModel(next)
    setFlights(moving)
  }
  const splashSeq = useRef(0)
  const [splash, setSplash] = useState<Splash | null>(null)
  const [deckAt, setDeckAt] = useState<'dock' | 'landing'>('dock')
  const [gliding, setGliding] = useState(false)
  const [playing, setPlaying] = useState<SceneId | null>(null)
  const [party, setParty] = useState(false)
  const [leaving, setLeaving] = useState<{
    id: number
    weight: RaftWeight
    spot: number
  } | null>(null)
  const [hops, setHops] = useState<Record<number, number>>({})
  /** How many animals the latest crossing landed (they play its scene). */
  const [landed, setLanded] = useState(0)

  // The open line, 300 ms after the fade-in.
  useEffect(() => {
    kit.later(() => {
      kit.setPose('listening')
      void kit.speak('guide.play.raft.open').then((ok) => {
        if (ok) kit.setPose('idle')
      })
    }, RAFT_OPEN_DELAY_MS)
    // Mount-once: the trip starts when the game opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const deckRect = deckAt === 'dock' ? scene.dock : scene.landing
  const boardZone = grow(scene.dock, 0.25 * scene.a)

  const sayTotal = (total: number) => {
    if (total >= 1 && total <= 9) void kit.speak(raftTotalLine(total))
    else kit.cutLine()
  }

  const hop = (id: number) => setHops((h) => ({ ...h, [id]: (h[id] ?? 0) + 1 }))

  // --- Board -------------------------------------------------------------

  const onBoard = (id: number): boolean => {
    const s = modelRef.current
    const [next, result] = board(s, id)
    if (result === 'refused') {
      hop(id)
      return false
    }
    const seat = s.seats.indexOf(null)
    const spot = s.spots.indexOf(id)
    const sc = sceneRef.current
    const f: Flights = {}
    f[`aboard-${id}`] = {
      d: delta(sc.spots[spot]!, seatOnScreen(sc, sc.dock, seat)),
      ms: 'spring',
      delay: 0,
    }
    apply(next, f)
    if (result === 'splash') {
      tooHeavy(id, seat)
      return true
    }
    sfx.plink.play()
    if (result === 'depart') depart()
    else sayTotal(next.total)
    return true
  }

  const tooHeavy = (id: number, seat: number) => {
    const weight = modelRef.current.animals[id]!.weight
    splashSeq.current += 1
    setSplash({ id, weight, seat, key: splashSeq.current })
    const atMs = reducedMotion ? 0 : SPLASH_AT_MS
    kit.later(() => {
      sfx.splash.play()
      kit.setPose('puzzled-tilt')
      void kit.speak('guide.play.raft.splash')
    }, atMs)
    kit.advance(
      () => apply(wobbleEnd(modelRef.current)),
      reducedMotion ? REDUCED_WOBBLE_MS : WOBBLE_MS,
    )
    kit.advance(
      () => {
        const [next, { newcomer }] = splashEnd(
          modelRef.current,
          metricOf(sceneRef.current),
        )
        setSplash(null)
        const f: Flights = {}
        if (newcomer !== null) {
          f[`shore-${newcomer}`] = {
            d: walkFrom(sceneRef.current),
            ms: WALK_MS,
            delay: 0,
          }
        }
        apply(next, f)
        kit.setPose('idle')
      },
      reducedMotion ? REDUCED_SPLASH_END_MS : SPLASH_END_MS,
    )
  }

  // --- Take off ----------------------------------------------------------

  const onTakeOff = (id: number): boolean => {
    const s = modelRef.current
    const seat = s.seats.indexOf(id)
    const [next, result] = takeOff(s, id, metricOf(sceneRef.current))
    if (result === null) return false
    const sc = sceneRef.current
    const f: Flights = {}
    f[`shore-${id}`] = {
      d: delta(seatOnScreen(sc, sc.dock, seat), sc.spots[result.spot]!),
      ms: 300,
      delay: 0,
    }
    if (result.leaving !== null) {
      const weight = s.animals[result.leaving]!.weight
      const spot = s.spots.indexOf(result.leaving)
      setLeaving({ id: result.leaving, weight, spot })
      kit.later(() => setLeaving(null), reducedMotion ? 200 : WALK_MS)
    }
    apply(next, f)
    sayTotal(next.total)
    return true
  }

  // --- Exactly ten -------------------------------------------------------

  const depart = () => {
    sfx.sparkle.play()
    kit.setPose('waving')
    void kit.speak('guide.play.raft.go')
    kit.advance(() => {
      setGliding(true)
      setDeckAt('landing')
      kit.advance(
        () => {
          setGliding(false)
          land()
        },
        reducedMotion ? REDUCED_GLIDE_MS : GLIDE_MS,
      )
    }, ROW_AT_MS)
  }

  const land = () => {
    const s = modelRef.current
    const sc = sceneRef.current
    const aboard = s.seats.flatMap((id, seat) =>
      id === null ? [] : [{ id, seat }],
    )
    const f: Flights = {}
    aboard.forEach(({ id, seat }, j) => {
      f[`island-${id}`] = {
        d: delta(
          seatOnScreen(sc, sc.landing, seat),
          islandSpot(sc, s.island.length + j),
        ),
        ms: HOP_OFF_MS,
        delay: HOP_OFF_STAGGER_MS * j,
      }
    })
    const [next, chosen] = arrive(s, kit.rng)
    setLanded(aboard.length)
    apply(next, f)
    kit.advance(() => silly(chosen), SCENE_AT_MS)
  }

  const silly = (chosen: SceneId) => {
    if (!reducedMotion) setPlaying(chosen)
    kit.setPose('cheering')
    sfx.cheer.play()
    if (chosen === 'cannonball' && !reducedMotion) {
      kit.later(() => sfx.splash.play(), 500)
    }
    let lineDone = false
    let sceneDone = false
    const next = () => {
      if (lineDone && sceneDone) kit.advance(afterScene, AFTER_SCENE_MS)
    }
    kit.later(
      () => {
        sceneDone = true
        setPlaying(null)
        next()
      },
      reducedMotion ? 0 : SCENE_MS,
    )
    void kit.speak('guide.play.raft.silly').then(() => {
      lineDone = true
      next()
    })
  }

  const afterScene = () => {
    const s = modelRef.current
    if (tripOver(s)) {
      apply(finish(s))
      setParty(true)
      kit.setPose('cheering')
      void kit.speak('guide.play.raft.close').then((ok) => {
        if (ok) kit.advance(kit.done, CLOSE_GAP_MS)
      })
      return
    }
    setGliding(true)
    setDeckAt('dock')
    kit.setPose('idle')
    kit.advance(
      () => {
        setGliding(false)
        const [next, fresh] = refill(
          modelRef.current,
          kit.rng,
          metricOf(sceneRef.current),
        )
        const f: Flights = {}
        fresh.forEach(
          (id, j) =>
            (f[`shore-${id}`] = {
              d: walkFrom(sceneRef.current),
              ms: WALK_MS,
              delay: WALK_STAGGER_MS * j,
            }),
        )
        apply(next, f)
      },
      reducedMotion ? REDUCED_RETURN_MS : RETURN_MS,
    )
  }

  // --- Drawing -----------------------------------------------------------

  const { a } = scene
  const takeFrom = (key: string) => flights[key]
  const shoreOpen = model.phase === 'loading' || model.phase === 'wobbling'
  const thisCrossing = playing !== null ? model.island.slice(-landed) : []

  return (
    <View testID="raft-crossing" pointerEvents="box-none" style={styles.fill}>
      <Backdrop scene={scene} />

      {/* The island and every animal on it, this visit. */}
      <View pointerEvents="none" style={styles.fill}>
        {model.island.map(({ id, weight }, i) => {
          const r = islandSpot(scene, i)
          const inScene = thisCrossing.some((x) => x.id === id)
          return (
            <Fly
              key={`island-${id}`}
              testID={`raft-island-${i}`}
              rect={r}
              from={takeFrom(`island-${id}`)}
              reducedMotion={reducedMotion}
            >
              <IslandMotion
                scene={inScene ? playing : null}
                party={party}
                reducedMotion={reducedMotion}
                order={i}
                heaviest={
                  inScene &&
                  weight === Math.max(...thisCrossing.map((x) => x.weight))
                }
              >
                <AnimalArt weight={weight} size={r.width} tag={false} />
              </IslandMotion>
            </Fly>
          )
        })}
        {playing !== null && <View testID={`raft-scene-${playing}`} />}
      </View>

      <Deck
        scene={scene}
        rect={deckRect}
        total={model.total}
        splashing={splash !== null && model.phase === 'wobbling'}
        gliding={gliding}
        reducedMotion={reducedMotion}
        frameKey={kit.cancelKey}
      >
        {model.seats.map((id, seat) => {
          if (id === null) return null
          const animal = model.animals[id]!
          return (
            <Fly
              key={`aboard-${id}`}
              rect={scene.seats[seat]!}
              from={takeFrom(`aboard-${id}`)}
              reducedMotion={reducedMotion}
            >
              <DragPiece
                testID={`raft-aboard-${id}`}
                rect={{
                  x: 0,
                  y: 0,
                  width: scene.seats[seat]!.width,
                  height: scene.seats[seat]!.height,
                }}
                accessibilityLabel={animalLabel(
                  RAFT_ANIMALS[animal.weight],
                  animal.weight,
                )}
                disabled={!shoreOpen}
                reducedMotion={reducedMotion}
                cancelKey={kit.cancelKey}
                onTap={() => onTakeOff(id)}
                onDrop={(p) => (contains(boardZone, p) ? false : onTakeOff(id))}
              >
                <AnimalArt
                  weight={animal.weight}
                  size={scene.seats[seat]!.width}
                  tag
                />
              </DragPiece>
            </Fly>
          )
        })}
        {splash !== null && (
          <SplashingAnimal
            key={splash.key}
            testID="raft-splashing"
            weight={splash.weight}
            seat={scene.seats[splash.seat]!}
            home={(() => {
              const spot = scene.spots[model.animals[splash.id]!.home]!
              return { ...spot, x: spot.x - deckRect.x, y: spot.y - deckRect.y }
            })()}
            reducedMotion={reducedMotion}
          />
        )}
      </Deck>

      {model.spots.map((id, spot) => {
        if (id === null) return null
        const animal = model.animals[id]!
        const r = scene.spots[spot]!
        return (
          <Fly
            key={`shore-${id}`}
            rect={r}
            from={takeFrom(`shore-${id}`)}
            reducedMotion={reducedMotion}
          >
            <DragPiece
              testID={`raft-animal-${id}`}
              rect={{ x: 0, y: 0, width: r.width, height: r.height }}
              accessibilityLabel={animalLabel(
                RAFT_ANIMALS[animal.weight],
                animal.weight,
              )}
              disabled={model.phase === 'done'}
              reducedMotion={reducedMotion}
              cancelKey={kit.cancelKey}
              onTap={() => onBoard(id)}
              onDrop={(p) => (contains(boardZone, p) ? onBoard(id) : false)}
            >
              <Hop count={hops[id] ?? 0} a={a} reducedMotion={reducedMotion}>
                <AnimalArt weight={animal.weight} size={r.width} tag />
              </Hop>
            </DragPiece>
          </Fly>
        )
      })}

      {leaving !== null && (
        <Animated.View
          testID={`raft-leaving-${leaving.id}`}
          pointerEvents="none"
          exiting={FadeOut.duration(FADE_MS)}
          style={[styles.abs, rectStyle(scene.spots[leaving.spot]!)]}
        >
          <WalkOut to={walkFrom(scene)} reducedMotion={reducedMotion}>
            <AnimalArt weight={leaving.weight} size={a} tag />
          </WalkOut>
        </Animated.View>
      )}
    </View>
  )
}

/** Newcomers walk in from beyond the shore's outer edge. */
function walkFrom(scene: RaftScene): Point {
  return scene.axis === 'up' ? { x: 0, y: scene.a } : { x: -scene.a, y: 0 }
}

const rectStyle = (r: Rect) => ({
  left: r.x,
  top: r.y,
  width: r.width,
  height: r.height,
})

/**
 * A piece that, on mount, flies in from `from` (a delta from its place):
 * a spring, or a timed move; Reduce Motion: a 150 ms fade at its place.
 */
function Fly({
  rect,
  from,
  reducedMotion,
  testID,
  children,
}: {
  rect: Rect
  from?: { d: Point; ms: number | 'spring'; delay: number }
  reducedMotion: boolean
  testID?: string
  children: ReactNode
}) {
  const [initial] = useState(() => from)
  const x = useSharedValue(initial && !reducedMotion ? initial.d.x : 0)
  const y = useSharedValue(initial && !reducedMotion ? initial.d.y : 0)
  useEffect(() => {
    if (!initial || reducedMotion) return
    const go = (v: typeof x) =>
      v.set(
        withDelay(
          initial.delay,
          initial.ms === 'spring'
            ? withSpring(0, SPRING)
            : withTiming(0, {
                duration: initial.ms,
                easing: Easing.out(Easing.quad),
              }),
        ),
      )
    go(x)
    go(y)
    // Mount-once: a piece flies in once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }))
  return (
    <Animated.View
      testID={testID}
      pointerEvents="box-none"
      entering={initial && reducedMotion ? FadeIn.duration(FADE_MS) : undefined}
      style={[styles.abs, rectStyle(rect), style]}
    >
      {children}
    </Animated.View>
  )
}

/** A refused tap: the animal hops (0.2 a, 300 ms). */
function Hop({
  count,
  a,
  reducedMotion,
  children,
}: {
  count: number
  a: number
  reducedMotion: boolean
  children: ReactNode
}) {
  const y = useSharedValue(0)
  useEffect(() => {
    if (count === 0 || reducedMotion) return
    y.set(
      withSequence(
        withTiming(-0.2 * a, { duration: 150 }),
        withTiming(0, { duration: 150 }),
      ),
    )
  }, [count, a, reducedMotion, y])
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }],
  }))
  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>
}

/** A newcomer walking back out the way it came (500 ms). */
function WalkOut({
  to,
  reducedMotion,
  children,
}: {
  to: Point
  reducedMotion: boolean
  children: ReactNode
}) {
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const o = useSharedValue(1)
  useEffect(() => {
    if (reducedMotion) {
      o.set(withTiming(0, { duration: 200 }))
      return
    }
    x.set(withTiming(to.x, { duration: WALK_MS }))
    y.set(withTiming(to.y, { duration: WALK_MS }))
    // Mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const style = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }))
  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>
}

/**
 * An animal and its weight tag (§ 2.2): the pack picture at
 * size × (0.72 + 0.28 × (w − 1) / 8), so the bee is small and the pig
 * fills the cell; a cream disc of 0.42 × size at its lower right with the
 * numeral (D2).
 */
function AnimalArt({
  weight,
  size,
  tag,
}: {
  weight: RaftWeight
  size: number
  tag: boolean
}) {
  const px = size * (0.72 + (0.28 * (weight - 1)) / 8)
  const disc = 0.42 * size
  return (
    <View pointerEvents="none" style={styles.centred}>
      <Image
        source={pictureAsset(RAFT_ANIMALS[weight])}
        contentFit="contain"
        accessible={false}
        style={{ width: px, height: px }}
      />
      {tag && (
        <View
          style={[
            styles.tag,
            {
              width: disc,
              height: disc,
              borderRadius: disc / 2,
              right: 0,
              bottom: 0,
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.tagText, { fontSize: 0.3 * size }]}
          >
            {weight}
          </Text>
        </View>
      )}
    </View>
  )
}

/** The sand, the water and the island (drawn, § 2.2). */
function Backdrop({ scene }: { scene: RaftScene }) {
  const { mound } = scene
  const tuft = 0.22 * scene.a
  return (
    <View pointerEvents="none" style={styles.fill}>
      <View
        testID="raft-water"
        style={[styles.abs, styles.water, rectStyle(scene.water)]}
      >
        <View style={styles.wave} />
      </View>
      <View
        testID="raft-shore"
        style={[styles.abs, styles.shore, rectStyle(scene.shore)]}
      />
      <View
        testID="raft-island"
        style={[styles.abs, rectStyle(scene.island)]}
      />
      <View
        style={[
          styles.abs,
          styles.mound,
          rectStyle(mound),
          { borderRadius: Math.min(mound.width, mound.height) / 2 },
        ]}
      />
      {[0.3, 0.7].map((f) => (
        <View
          key={f}
          style={[
            styles.abs,
            styles.tuft,
            {
              left: mound.x + f * mound.width - tuft / 2,
              top: mound.y + 0.15 * mound.height,
              width: tuft,
              height: tuft,
              borderRadius: tuft / 2,
            },
          ]}
        />
      ))}
    </View>
  )
}

/**
 * The raft (§ 2.2): five logs of Number Garden wood with 6 seats, a mast
 * whose cream flag shows the total (blank at 0) and an oar. It sinks with
 * its load, goes under on a splash and wobbles (+6° / −6°, three times,
 * 900 ms; Reduce Motion: dims), and glides between the dock and the
 * island, bobbing and rowing. A new layout jumps it to where it is going.
 */
function Deck({
  scene,
  rect,
  total,
  splashing,
  gliding,
  reducedMotion,
  frameKey,
  children,
}: {
  scene: RaftScene
  rect: Rect
  total: number
  splashing: boolean
  gliding: boolean
  reducedMotion: boolean
  frameKey: string
  children: ReactNode
}) {
  const { dock } = scene
  const offset = { x: rect.x - dock.x, y: rect.y - dock.y }
  const x = useSharedValue(offset.x)
  const y = useSharedValue(offset.y)
  const sink = useSharedValue(0)
  const rot = useSharedValue(0)
  const dim = useSharedValue(1)
  const bob = useSharedValue(0)
  const oar = useSharedValue(0)
  const frameRef = useRef(frameKey)

  const depth = splashing
    ? 0.4 * dock.height
    : (Math.min(total, 10) / 10) * 0.12 * dock.height

  useEffect(() => {
    const jump = frameRef.current !== frameKey
    frameRef.current = frameKey
    if (jump) {
      x.set(offset.x)
      y.set(offset.y)
      return
    }
    const ms = offset.x === 0 && offset.y === 0 ? RETURN_MS : GLIDE_MS
    const t = reducedMotion
      ? {
          duration:
            offset.x === 0 && offset.y === 0
              ? REDUCED_RETURN_MS
              : REDUCED_GLIDE_MS,
        }
      : { duration: ms, easing: Easing.inOut(Easing.quad) }
    x.set(withTiming(offset.x, t))
    y.set(withTiming(offset.y, t))
    // Animate on a new target; a new layout jumps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset.x, offset.y, frameKey])

  useEffect(() => {
    sink.set(withTiming(depth, { duration: reducedMotion ? FADE_MS : 300 }))
  }, [depth, reducedMotion, sink])

  useEffect(() => {
    if (!splashing) return
    if (reducedMotion) {
      dim.set(
        withSequence(
          withTiming(0.7, { duration: 150 }),
          withTiming(1, { duration: 150 }),
        ),
      )
      return
    }
    const s = { duration: WOBBLE_MS / 6, easing: Easing.out(Easing.quad) }
    rot.set(
      withSequence(
        withTiming(6, s),
        withTiming(-6, s),
        withTiming(6, s),
        withTiming(-6, s),
        withTiming(4, s),
        withTiming(0, s),
      ),
    )
  }, [splashing, reducedMotion, rot, dim])

  useEffect(() => {
    if (!gliding || reducedMotion) {
      bob.set(0)
      oar.set(0)
      return
    }
    bob.set(
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 600 }),
          withTiming(3, { duration: 600 }),
        ),
        Math.ceil(GLIDE_MS / 1200),
        true,
      ),
    )
    oar.set(
      withRepeat(
        withSequence(
          withTiming(20, { duration: 250 }),
          withTiming(-20, { duration: 250 }),
        ),
        Math.ceil(GLIDE_MS / 500),
        true,
      ),
    )
  }, [gliding, reducedMotion, bob, oar])

  const moved = useAnimatedStyle(() => ({
    opacity: dim.get(),
    transform: [
      { translateX: x.get() },
      { translateY: y.get() + sink.get() + bob.get() },
      { rotate: `${rot.get()}deg` },
    ],
  }))
  const oarStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${oar.get()}deg` }],
  }))
  const a = scene.a
  const flag = scene.flag
  return (
    <Animated.View
      testID="raft"
      accessible
      accessibilityLabel={raftLabel(total)}
      pointerEvents="box-none"
      style={[styles.abs, rectStyle(dock), moved]}
    >
      {splashing && !reducedMotion && <View testID="raft-wobble" />}
      {splashing && reducedMotion && <View testID="raft-dim" />}
      {gliding && !reducedMotion && <View testID="raft-rowing" />}
      <View
        pointerEvents="none"
        style={[styles.fill, styles.deck, { borderRadius: 0.12 * a }]}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.log,
              { top: (i * dock.height) / 5, height: dock.height / 5 - 2 },
            ]}
          />
        ))}
      </View>
      {/* The mast and its flag, at the back-left corner. */}
      <View
        pointerEvents="none"
        style={[styles.mast, { left: 4, top: flag.y, height: -flag.y + 12 }]}
      />
      <View
        testID="raft-flag-box"
        pointerEvents="none"
        style={[
          styles.flag,
          { left: 7, top: flag.y, width: flag.width, height: flag.height },
        ]}
      >
        <Text
          testID="raft-flag"
          allowFontScaling={false}
          style={[styles.flagText, { fontSize: 0.26 * a }]}
        >
          {total === 0 ? '' : String(Math.min(total, 10))}
        </Text>
      </View>
      {/* The oar along the right edge. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.oar,
          { right: -6, top: 0.15 * dock.height, height: 0.7 * dock.height },
          oarStyle,
        ]}
      />
      {children}
    </Animated.View>
  )
}

/**
 * The newest animal after a too-heavy drop (§ 2.3): on its seat, then at
 * 500 ms it slides off into the water (400 ms), paddles home (1200 ms,
 * bobbing ±3) and shakes itself (300 ms). Reduce Motion: it fades from its
 * seat and in at its spot (200 ms each).
 */
function SplashingAnimal({
  weight,
  seat,
  home,
  reducedMotion,
  testID,
}: {
  weight: RaftWeight
  seat: Rect
  home: Rect
  reducedMotion: boolean
  testID: string
}) {
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const o = useSharedValue(1)
  const shake = useSharedValue(0)
  useEffect(() => {
    if (reducedMotion) {
      o.set(withTiming(0, { duration: 200 }))
      return
    }
    const dx = home.x + home.width / 2 - (seat.x + seat.width / 2)
    const dy = home.y + home.height / 2 - (seat.y + seat.height / 2)
    x.set(
      withDelay(
        SPLASH_AT_MS,
        withSequence(
          withTiming(seat.width, { duration: SLIDE_MS }),
          withTiming(dx, { duration: PADDLE_MS }),
        ),
      ),
    )
    y.set(
      withDelay(
        SPLASH_AT_MS,
        withSequence(
          withTiming(seat.height * 0.6, { duration: SLIDE_MS }),
          withTiming(dy, { duration: PADDLE_MS }),
        ),
      ),
    )
    shake.set(
      withDelay(
        WOBBLE_MS + PADDLE_MS,
        withSequence(
          withTiming(-8, { duration: SHAKE_MS / 3 }),
          withTiming(8, { duration: SHAKE_MS / 3 }),
          withTiming(0, { duration: SHAKE_MS / 3 }),
        ),
      ),
    )
    // Mount-once: one splash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const style = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { rotate: `${shake.get()}deg` },
    ],
  }))
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[styles.abs, rectStyle(seat), style]}
    >
      <AnimalArt weight={weight} size={seat.width} tag />
    </Animated.View>
  )
}

/**
 * The island's silly scenes (§ 2.3), about 2-3 s, played by this
 * crossing's animals; and the party bounce after the third crossing. None
 * under Reduce Motion.
 */
function IslandMotion({
  scene,
  party,
  reducedMotion,
  order,
  heaviest,
  children,
}: {
  scene: SceneId | null
  party: boolean
  reducedMotion: boolean
  order: number
  heaviest: boolean
  children: ReactNode
}) {
  const y = useSharedValue(0)
  const x = useSharedValue(0)
  const r = useSharedValue(0)
  const sy = useSharedValue(1)
  useEffect(() => {
    if (reducedMotion || scene === null) return
    const hopUp = (d: number) =>
      withDelay(
        d,
        withSequence(
          withTiming(-12, { duration: 150 }),
          withTiming(0, { duration: 150 }),
        ),
      )
    switch (scene) {
      case 'dance':
        y.set(withSequence(hopUp(100 * order), hopUp(600)))
        break
      case 'tower':
        y.set(withTiming(-10 * order, { duration: 250 * (order + 1) }))
        r.set(
          withDelay(
            1000,
            withSequence(
              withTiming(5, { duration: 250 }),
              withTiming(-5, { duration: 250 }),
              withTiming(5, { duration: 250 }),
              withTiming(-5, { duration: 250 }),
              withTiming(0, { duration: 200 }),
            ),
          ),
        )
        y.set(withDelay(2200, withTiming(0, { duration: 400 })))
        break
      case 'cannonball':
        if (heaviest) {
          x.set(
            withSequence(
              withTiming(-40, { duration: 500 }),
              withDelay(1500, withTiming(0, { duration: 300 })),
            ),
          )
          y.set(
            withSequence(
              withTiming(30, { duration: 500 }),
              withDelay(1500, withTiming(0, { duration: 300 })),
            ),
          )
        } else {
          r.set(
            withDelay(
              600,
              withSequence(
                withTiming(-8, { duration: 100 }),
                withTiming(8, { duration: 100 }),
                withTiming(0, { duration: 100 }),
              ),
            ),
          )
        }
        break
      case 'spin':
        r.set(
          withSequence(
            withTiming(360, { duration: 600 }),
            withTiming(0, { duration: 0 }),
          ),
        )
        sy.set(
          withDelay(
            600,
            withSequence(
              withTiming(0.8, { duration: 100 }),
              withTiming(1, { duration: 100 }),
            ),
          ),
        )
        break
    }
  }, [scene, reducedMotion, order, heaviest, x, y, r, sy])
  useEffect(() => {
    if (!party || reducedMotion) return
    y.set(
      withSequence(
        withTiming(-14, { duration: 180 }),
        withTiming(0, { duration: 180 }),
      ),
    )
  }, [party, reducedMotion, y])
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { rotate: `${r.get()}deg` },
      { scaleY: sy.get() },
    ],
  }))
  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  abs: { position: 'absolute' },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tag: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TAG_FACE,
    boxShadow: '0 2px 0 rgba(107, 63, 31, 0.25)',
  },
  tagText: { fontFamily: fonts.bold, color: TAG_TEXT },
  water: {
    backgroundColor: WATER,
    experimental_backgroundImage: `linear-gradient(180deg, ${WATER} 0%, ${WATER_DEEP} 100%)`,
    overflow: 'hidden',
  },
  wave: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '45%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  shore: { backgroundColor: SHORE_SAND },
  mound: { backgroundColor: SAND },
  tuft: { backgroundColor: TUFT },
  deck: {
    backgroundColor: WOOD,
    borderWidth: 2,
    borderColor: WOOD_RIM,
    overflow: 'hidden',
  },
  log: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: WOOD,
    borderBottomWidth: 2,
    borderBottomColor: WOOD_RIM,
  },
  mast: { position: 'absolute', width: 4, backgroundColor: WOOD_RIM },
  flag: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff8ee',
    borderRadius: 4,
  },
  flagText: { fontFamily: fonts.bold, color: TAG_TEXT },
  oar: {
    position: 'absolute',
    width: 8,
    borderRadius: 4,
    backgroundColor: WOOD_RIM,
  },
})
