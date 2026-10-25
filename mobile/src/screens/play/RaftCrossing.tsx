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
 *
 * The paint is the app's clay (play-games-restyle § 2 T2-T6): the Map's
 * land bands for the water and the shore, a clay oval island, clay wood
 * for the raft, cream clay tiles for the numbers, plinths and contact
 * shadows for the animals. Paint only: every rect is `raftScene`'s.
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
import { imageShadow } from '../../components/imageShadow'
import type { Rect } from '../../layout/layout'
import { fonts } from '../../theme'
import { ClayOval } from '../map/mapFx'
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

// The clay (play-games-restyle § 2). k is the frame's clay scale (1 on
// tablets, 7/12 on phones, the Home disc's); R the Map band's radius.
const clayK = (tablet: boolean) => (tablet ? 1 : 7 / 12)
const bandRadius = (tablet: boolean) => 48 * clayK(tablet)
/** The Map band's shadow on its ledge colour (`landParts.tsx`). */
const bandShadow = (lo: string, k: number) =>
  `inset 0 ${5 * k}px 0 rgba(255, 255, 255, 0.4), inset 0 ${-8 * k}px 0 rgba(0, 0, 0, 0.08), 0 ${10 * k}px 0 ${lo}, 0 ${18 * k}px ${24 * k}px rgba(60, 40, 10, 0.15)`
/** T2: today's water as a pool; its ledge is the only new colour. */
const WATER = '#8fd0ee'
const WATER_DEEP = '#5fb3dd'
const WATER_LEDGE = '#4a9cc8'
/** T2: the Map's sand band (`BAND_TINTS[1]`). */
const SHORE_HI = '#ffeec2'
const SHORE_LO = '#e8c77a'
/** Ripples: fractions of the water rect, clear of the raft's path. */
const RIPPLES_UP: readonly [number, number][] = [
  [0.05, 0.25],
  [0.78, 0.18],
  [0.08, 0.7],
  [0.8, 0.62],
  [0.14, 0.92],
]
const RIPPLES_RIGHT: readonly [number, number][] = [
  [0.62, 0.12],
  [0.78, 0.3],
  [0.6, 0.72],
  [0.8, 0.88],
  [0.7, 0.5],
]
/** T3: the island, a Word Song honey clay oval; bushes in green clay. */
const MOUND_STOPS = ['#ffeec2', '#f2c27a', '#d9a159'] as const
const MOUND_SLAB = '#b27b37'
/** T6: the Map's open-stop plinth. */
const PLINTH_STOPS = ['#fffaf0', '#efdcc0', '#d6b890'] as const
const PLINTH_SLAB = '#b8946a'
/** A clay oval's soft shadow under its slab. */
const ovalSoft = (drop: number) => ({
  dy: drop + 2,
  blur: 8,
  color: 'rgba(60, 30, 10, 0.22)',
})
/** T4: the Home disc's wood, run top to bottom. */
const WOOD = '#c98a55'
const WOOD_RIM = '#7d4a26'
/** T5: the cream clay tile (`ClayChip`) on Number Garden's slab. */
const TILE = '#fff7ee'
const TILE_FACE = 'linear-gradient(#ffffff 0%, #fff7ee 60%, #ffeedd 100%)'
const TAG_SHADOW = {
  tablet:
    'inset 0 2px 0 #ffffff, 0 4px 0 #dba675, 0 6px 9px rgba(90, 45, 20, 0.16)',
  phone:
    'inset 0 2px 0 #ffffff, 0 3px 0 #dba675, 0 5px 7px rgba(90, 45, 20, 0.16)',
}
const TAG_TEXT = '#6b3f1f'
/** T6: the Hub and map stickers' drop shadow, on every animal picture. */
const PICTURE_SHADOW = {
  tablet: imageShadow(4, 8, 'rgba(60, 30, 10, 0.28)'),
  phone: imageShadow(3, 6, 'rgba(60, 30, 10, 0.28)'),
}

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
  const { reducedMotion, sfx, tablet } = kit
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
      <Backdrop scene={scene} area={kit.area} tablet={tablet} />

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
                <AnimalArt
                  weight={weight}
                  size={r.width}
                  tag={false}
                  tablet={tablet}
                />
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
        tablet={tablet}
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
                  tablet={tablet}
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
            tablet={tablet}
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
              <Plinth size={r.width} tablet={tablet} id={`raft-plinth-${id}`} />
              <Hop count={hops[id] ?? 0} a={a} reducedMotion={reducedMotion}>
                <AnimalArt
                  weight={animal.weight}
                  size={r.width}
                  tag
                  tablet={tablet}
                />
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
            <Plinth
              size={a}
              tablet={tablet}
              id={`raft-plinth-leaving-${leaving.id}`}
            />
            <AnimalArt weight={leaving.weight} size={a} tag tablet={tablet} />
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
 * fills the cell, with a contact shadow (T6); a cream clay disc of
 * 0.42 × size at its lower right with the numeral (D2, T5).
 */
function AnimalArt({
  weight,
  size,
  tag,
  tablet,
}: {
  weight: RaftWeight
  size: number
  tag: boolean
  tablet: boolean
}) {
  const px = size * (0.72 + (0.28 * (weight - 1)) / 8)
  const disc = 0.42 * size
  return (
    <View pointerEvents="none" style={styles.centred}>
      <View
        testID="raft-picture"
        style={tablet ? PICTURE_SHADOW.tablet : PICTURE_SHADOW.phone}
      >
        <Image
          source={pictureAsset(RAFT_ANIMALS[weight])}
          contentFit="contain"
          accessible={false}
          style={{ width: px, height: px }}
        />
      </View>
      {tag && (
        <View
          testID="raft-tag"
          style={[
            styles.tag,
            {
              width: disc,
              height: disc,
              borderRadius: disc / 2,
              right: 0,
              bottom: 0,
              boxShadow: tablet ? TAG_SHADOW.tablet : TAG_SHADOW.phone,
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

/**
 * A shore animal's cream clay plinth (T6), inside its cell; it moves with
 * the animal, so an empty spot shows sand.
 */
function Plinth({
  size,
  tablet,
  id,
}: {
  size: number
  tablet: boolean
  id: string
}) {
  const drop = tablet ? 6 : 4
  return (
    <View
      testID="raft-plinth"
      pointerEvents="none"
      style={[styles.abs, { left: 0.06 * size, top: 0.62 * size }]}
    >
      <ClayOval
        id={id}
        w={0.88 * size}
        h={0.34 * size}
        drop={drop}
        stops={PLINTH_STOPS}
        slab={PLINTH_SLAB}
        soft={ovalSoft(drop)}
      />
    </View>
  )
}

/**
 * The water, the shore and the island (drawn, § 2.2) as the Map's land
 * (T2, T3): one pool slab under the island and the water, running R under
 * the shore; short ripples; a clay oval island with two green clay
 * bushes; the sand band on top. `raft-water` keeps its rect for tests.
 */
function Backdrop({
  scene,
  area,
  tablet,
}: {
  scene: RaftScene
  area: Rect
  tablet: boolean
}) {
  const { mound, shore, water, island } = scene
  const k = clayK(tablet)
  const R = bandRadius(tablet)
  const up = scene.axis === 'up'
  const poolX = shore.x + shore.width - R
  const pool: Rect = up
    ? {
        x: area.x,
        y: island.y,
        width: area.width,
        height: shore.y - island.y + R,
      }
    : {
        x: poolX,
        y: area.y,
        width: area.x + area.width - poolX,
        height: area.height,
      }
  const ripple = tablet ? 6 : 4
  const drop = tablet ? 10 : 7
  const bush = 0.5 * scene.a
  return (
    <View pointerEvents="none" style={styles.fill}>
      <View
        testID="raft-pool"
        style={[
          styles.abs,
          styles.pool,
          rectStyle(pool),
          {
            borderRadius: R,
            experimental_backgroundImage: up
              ? `linear-gradient(180deg, ${WATER} 0%, ${WATER_DEEP} 100%)`
              : `linear-gradient(90deg, ${WATER_DEEP} 0%, ${WATER} 100%)`,
            boxShadow: bandShadow(WATER_LEDGE, k),
          },
        ]}
      />
      <View testID="raft-water" style={[styles.abs, rectStyle(water)]}>
        {(up ? RIPPLES_UP : RIPPLES_RIGHT).map(([fx, fy]) => (
          <View
            key={`${fx},${fy}`}
            testID="raft-ripple"
            style={[
              styles.ripple,
              {
                left: fx * water.width,
                top: fy * water.height,
                width: (up ? 0.12 : 0.16) * water.width,
                height: ripple,
                borderRadius: ripple / 2,
              },
            ]}
          />
        ))}
      </View>
      <View testID="raft-island" style={[styles.abs, rectStyle(island)]} />
      <View
        testID="raft-mound"
        style={[styles.abs, { left: mound.x, top: mound.y }]}
      >
        <ClayOval
          id="raft-mound"
          w={mound.width}
          h={mound.height - drop}
          drop={drop}
          stops={MOUND_STOPS}
          slab={MOUND_SLAB}
          soft={ovalSoft(drop)}
        />
      </View>
      {[0.3, 0.7].map((f) => (
        <View
          key={f}
          testID="raft-bush"
          style={[
            styles.abs,
            styles.bush,
            {
              left: mound.x + f * mound.width - bush / 2,
              top: mound.y + 0.12 * mound.height,
              width: bush,
              height: 0.8 * bush,
              // 50 % / 50 % / 45 % / 45 % of the height: iOS draws no
              // elliptical corners, and a '50%' radius here is a lens.
              borderTopLeftRadius: 0.4 * bush,
              borderTopRightRadius: 0.4 * bush,
              borderBottomRightRadius: 0.36 * bush,
              borderBottomLeftRadius: 0.36 * bush,
              boxShadow: `inset 0 ${3 * k}px 0 rgba(255, 255, 255, 0.35), 0 ${5 * k}px 0 #3f8a2e, 0 ${8 * k}px ${10 * k}px rgba(40, 90, 20, 0.3)`,
            },
          ]}
        />
      ))}
      <View
        testID="raft-shore"
        style={[
          styles.abs,
          styles.shore,
          rectStyle(shore),
          { borderRadius: R, boxShadow: bandShadow(SHORE_LO, k) },
        ]}
      />
    </View>
  )
}

/**
 * The raft (§ 2.2): five logs of Number Garden wood with 6 seats (T4: clay
 * logs on a dark wood base, two rope bands, no seat marks), a mast whose
 * cream clay flag shows the total (blank at 0) and an oar. It sinks with
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
  tablet,
  children,
}: {
  scene: RaftScene
  rect: Rect
  total: number
  splashing: boolean
  gliding: boolean
  reducedMotion: boolean
  frameKey: string
  tablet: boolean
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
  /** The base's depth: 1 on tablets, 0.75 on phones. */
  const kd = tablet ? 1 : 0.75
  const log = dock.height / 5
  const mastW = Math.max(6, 0.07 * a)
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
      <View pointerEvents="none" style={styles.fill}>
        <View
          testID="raft-deck"
          style={[
            styles.fill,
            styles.deck,
            {
              borderRadius: 0.14 * a,
              boxShadow: `0 ${8 * kd}px 0 ${WOOD_RIM}, 0 ${14 * kd}px ${18 * kd}px rgba(60, 30, 10, 0.3)`,
            },
          ]}
        />
        {/* Five logs, 2 pt apart: the base shows between them. */}
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            testID="raft-log"
            style={[
              styles.log,
              {
                top: i * log + 1,
                height: log - 2,
                borderRadius: (log - 2) / 2,
              },
            ]}
          />
        ))}
        {[0.2, 0.8].map((f) => (
          <View
            key={f}
            testID="raft-rope"
            style={[
              styles.rope,
              {
                left: f * dock.width - 0.05 * a,
                width: 0.1 * a,
                height: dock.height + 4,
                borderRadius: 0.05 * a,
              },
            ]}
          />
        ))}
      </View>
      {/* The mast and its flag, at the back-left corner: the mast's right
          edge stays 1 pt under the flag, as at its old 4 pt width. */}
      <View
        pointerEvents="none"
        style={[
          styles.mast,
          { left: 8 - mastW, width: mastW, top: flag.y, height: -flag.y + 12 },
        ]}
      />
      <View
        testID="raft-flag-box"
        pointerEvents="none"
        style={[
          styles.flag,
          {
            left: 7,
            top: flag.y,
            width: flag.width,
            height: flag.height,
            borderRadius: 0.08 * a,
          },
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
          {
            right: -6,
            top: 0.15 * dock.height,
            width: tablet ? 10 : 8,
            height: 0.7 * dock.height,
          },
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
  tablet,
  testID,
}: {
  weight: RaftWeight
  seat: Rect
  home: Rect
  reducedMotion: boolean
  tablet: boolean
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
      <AnimalArt weight={weight} size={seat.width} tag tablet={tablet} />
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
    backgroundColor: TILE,
    experimental_backgroundImage: TILE_FACE,
  },
  tagText: { fontFamily: fonts.bold, color: TAG_TEXT },
  pool: { backgroundColor: WATER },
  ripple: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  bush: {
    backgroundColor: '#6cc655',
    experimental_backgroundImage: 'linear-gradient(#7fd364, #5cb945)',
  },
  shore: {
    backgroundColor: SHORE_LO,
    experimental_backgroundImage: `linear-gradient(${SHORE_HI}, ${SHORE_LO})`,
  },
  deck: { backgroundColor: WOOD_RIM },
  log: {
    position: 'absolute',
    left: 2,
    right: 2,
    backgroundColor: WOOD,
    experimental_backgroundImage:
      'linear-gradient(#e7b07a 0%, #c98a55 55%, #a86c3c 100%)',
    boxShadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.3)',
  },
  rope: {
    position: 'absolute',
    top: -2,
    backgroundColor: '#f2d3a6',
    boxShadow: 'inset 0 -3px 0 rgba(125, 74, 38, 0.3)',
  },
  mast: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: WOOD_RIM,
    experimental_backgroundImage: `linear-gradient(90deg, #a86c3c, ${WOOD_RIM})`,
  },
  flag: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TILE,
    experimental_backgroundImage: 'linear-gradient(#fffdf8, #fff1e2)',
    boxShadow:
      'inset 0 2px 0 #ffffff, 0 3px 0 #efcfb4, 0 6px 8px rgba(90, 45, 20, 0.16)',
  },
  flagText: { fontFamily: fonts.bold, color: TAG_TEXT },
  oar: {
    position: 'absolute',
    borderRadius: 6,
    backgroundColor: WOOD_RIM,
    experimental_backgroundImage: `linear-gradient(90deg, ${WOOD}, ${WOOD_RIM})`,
    boxShadow: `0 3px 0 ${WOOD_RIM}`,
  },
})
