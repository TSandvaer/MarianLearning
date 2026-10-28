/**
 * A raft trip (play-place spec § 2, raft-island-goal §§ 1-6): drag or tap
 * animals 1-9 onto a raft that carries exactly its target, 10 or 20.
 * Every boarding and take-off shows the total on the flag and Emma says it
 * ("Seven!"), each total cutting the one before. Too heavy: the raft
 * wobbles, the newest animal splashes off and paddles home, "Too heavy!";
 * the others stay. After two splashes in a row on a stuck raft, a
 * newcomer of `raftNewcomer`'s weight walks on, unannounced (D4). Exactly
 * the target: Emma waves, "Ten! Off we go!" ("Twenty! ..."), the raft rows
 * to the island, the seated animals play a silly scene on the deck, then
 * hop home lightest first: a new kind fills its home (the sparkle and a
 * burst; the island's record is written then), a kind already home merges
 * with a wiggle. No crossing cap (§ 6): every crossing without a party
 * comes back to a refilled shore. The ninth kind's crossing throws the
 * party (§ 3.1), whose last step is the game's (`onPartyEnd`).
 *
 * The model is `raftModel.ts`; this screen runs its beats (through the
 * frame's kit: Back clears them, a hidden app holds them; a trip left for
 * the picker drops its own) and draws the scene from `raftScene`. A new
 * layout redraws from the same model, and a motion in flight jumps to its
 * end. Reduce Motion (§ 2.5, raft-island-goal § 9): fades only, the same
 * lines and sounds; a drag still follows the finger.
 */
import {
  RAFT_ANIMALS,
  type RaftTarget,
  type RaftWeight,
} from '@marian/core/games/playPlace'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import type { Rect } from '../../layout/layout'
import { SparkleBurst, SPARKLE_BURST_MS } from '../wordSong/WordChip'
import { DragPiece } from './DragPiece'
import { SPRING } from './dragLock'
import {
  centre,
  contains,
  grow,
  islandHomes,
  moundFace,
  outerness,
  raftScene,
  type Point,
  type RaftScene,
} from './playGeometry'
import type { GameKit } from './playKit'
import {
  animalLabel,
  homeLabel,
  raftGoLine,
  raftOpenLine,
  raftTotalLine,
  type PlayLineId,
} from './playLines'
import {
  arrive,
  board,
  homeOne,
  homePlan,
  initialRaft,
  islandIsFull,
  refill,
  splashEnd,
  startParty,
  takeOff,
  wobbleEnd,
  type HomeHop,
  type RaftState,
  type SceneId,
  type SpotMetric,
} from './raftModel'
import { bandRadius, bandShadow, clayK, rectStyle } from './raftPaint'
import {
  AnimalArt,
  Deck,
  FADE_MS,
  GLIDE_MS,
  HomeArt,
  Plinth,
  REDUCED_GLIDE_MS,
  REDUCED_RETURN_MS,
  RETURN_MS,
  TripIsland,
  WATER,
  WATER_DEEP,
  WATER_LEDGE,
  WOBBLE_MS,
} from './RaftParts'

export {
  FADE_MS,
  GLIDE_MS,
  REDUCED_GLIDE_MS,
  RETURN_MS,
  WOBBLE_MS,
} from './RaftParts'

/** The open line: 300 ms after the 200 ms fade-in (§ 4.1). */
export const RAFT_OPEN_DELAY_MS = 500
/** Too heavy (§ 2.3). */
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
/** Exactly the target (§ 2.3). */
export const ROW_AT_MS = 600
export const SCENE_AT_MS = 300
export const SCENE_MS = 2600
/** The scene's end (its line and motion) to the walk home's `H0` (§ 1.4). */
export const AFTER_SCENE_MS = 400
/** The walk home (§ 1.4): a hop of 300 ms, hops 300 ms apart. */
export const HOP_HOME_MS = 300
export const HOP_HOME_STAGGER_MS = 300
/** A hop's beat after it lands: the fill's settle, a repeat's wiggle. */
export const HOME_BEAT_MS = 400
/** The last hop's beat end to the return or the party (§ 1.4). */
export const AFTER_HOMES_MS = 400
/** Reduce Motion: a home's shape cross-fades to its animal (§ 2.3). */
const CROSS_FADE_MS = 200
/** The repeat's wiggle, four 100 ms steps (§ 2.2). */
const WIGGLE_STEP_MS = 100
/** The party (§ 3.1), from `P0`. */
export const PARTY_LAP_AT_MS = 300
export const PARTY_LAP_STEP_MS = 120
export const PARTY_LINE_AT_MS = 1760
/** The shipped cheer's length (J1's place until J1 lands, § 7). */
export const CHEER_MS = 862
export const PARTY_CLOSE_GAP_MS = 300
export const PARTY_DANCE_MS = 2000
/** The close line's end to the party's last step (§ 3.1). */
export const CLOSE_GAP_MS = 800

export interface RaftCrossingProps {
  kit: GameKit
  /** The raft (default 10). */
  target?: RaftTarget
  /** The kinds home on its island as the trip starts. */
  homes?: readonly RaftWeight[]
  /** Test seam: the first shore's weights. */
  shore?: readonly number[]
  /** A kind's first landing on this island (the record's write, I7). */
  onFill?: (weight: RaftWeight) => void
  /** The party's last step (§ 3.1): the reveal, or back to the picker. */
  onPartyEnd?: () => void
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

/** An animal on its way home (§ 1.4), drawn above the scene. */
interface Walker extends HomeHop {
  key: number
}

/** What a home is doing this beat (§§ 2, 3). */
interface HomeFx {
  /** A fill landed: the shape fades, the animal settles (§ 2.1). */
  fill: number
  /** A repeat landed: the wiggle (§ 2.2). */
  repeat: number
}

export function RaftCrossing({
  kit,
  target = 10,
  homes = [],
  shore,
  onFill,
  onPartyEnd,
}: RaftCrossingProps) {
  const { reducedMotion, sfx, tablet } = kit
  const scene = raftScene(kit.area, kit.tablet, kit.landscape, target)
  const sceneRef = useRef(scene)
  useLayoutEffect(() => {
    sceneRef.current = scene
  })

  // A trip left for the picker (Back with two rafts open) is unmounted
  // while the frame lives on: its own beats and lines stop with it.
  const liveRef = useRef(true)
  useEffect(() => {
    liveRef.current = true
    return () => {
      liveRef.current = false
    }
  }, [])
  const later = (fn: () => void, ms: number) =>
    kit.later(() => {
      if (liveRef.current) fn()
    }, ms)
  const advance = (fn: () => void, ms: number) =>
    kit.advance(() => {
      if (liveRef.current) fn()
    }, ms)
  const speak = (id: PlayLineId): Promise<boolean> =>
    liveRef.current
      ? kit.speak(id).then((ok) => ok && liveRef.current)
      : Promise.resolve(false)

  const [model, setModel] = useState<RaftState>(() =>
    initialRaft(kit.rng, { target, homes, shore }),
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
  const seq = useRef(0)
  const nextKey = () => ++seq.current
  const [splash, setSplash] = useState<Splash | null>(null)
  const [deckAt, setDeckAt] = useState<'dock' | 'landing'>('dock')
  const [gliding, setGliding] = useState(false)
  const [playing, setPlaying] = useState<SceneId | null>(null)
  const [leaving, setLeaving] = useState<{
    id: number
    weight: RaftWeight
    spot: number
  } | null>(null)
  const [hops, setHops] = useState<Record<number, number>>({})
  /** The kinds drawn in colour: a fill shows at its hop's end. */
  const [shown, setShown] = useState<readonly RaftWeight[]>(() => homes)
  const [walkers, setWalkers] = useState<readonly Walker[]>([])
  const [fx, setFx] = useState<Partial<Record<RaftWeight, HomeFx>>>({})
  const [bursts, setBursts] = useState<
    readonly { w: RaftWeight; key: number }[]
  >([])
  /** The party: its lap and its dance, each a fresh key (§ 3.1). */
  const [lap, setLap] = useState(0)
  const [dance, setDance] = useState(0)
  const [partyBurst, setPartyBurst] = useState(false)
  /** The island was full as the trip began: it never parties (§ 3.1). */
  const [fullAtStart] = useState(() => homes.length === 9)

  // The open line, 300 ms after the fade-in.
  useEffect(() => {
    later(() => {
      kit.setPose('listening')
      void speak(raftOpenLine(target)).then((ok) => {
        if (ok) kit.setPose('idle')
      })
    }, RAFT_OPEN_DELAY_MS)
    // Mount-once: the trip starts when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const deckRect = deckAt === 'dock' ? scene.dock : scene.landing
  const boardZone = grow(scene.dock, 0.25 * scene.a)

  const sayTotal = (total: number) => {
    if (total >= 1 && total < target) void speak(raftTotalLine(total))
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
    setSplash({ id, weight, seat, key: nextKey() })
    const atMs = reducedMotion ? 0 : SPLASH_AT_MS
    later(() => {
      sfx.splash.play()
      kit.setPose('puzzled-tilt')
      void speak('guide.play.raft.splash')
    }, atMs)
    advance(
      () => apply(wobbleEnd(modelRef.current)),
      reducedMotion ? REDUCED_WOBBLE_MS : WOBBLE_MS,
    )
    advance(
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
      later(() => setLeaving(null), reducedMotion ? 200 : WALK_MS)
    }
    apply(next, f)
    sayTotal(next.total)
    return true
  }

  // --- Exactly the target --------------------------------------------------

  const depart = () => {
    sfx.sparkle.play()
    kit.setPose('waving')
    void speak(raftGoLine(target))
    advance(() => {
      setGliding(true)
      setDeckAt('landing')
      advance(
        () => {
          setGliding(false)
          land()
        },
        reducedMotion ? REDUCED_GLIDE_MS : GLIDE_MS,
      )
    }, ROW_AT_MS)
  }

  /** At the landing the animals stay seated; the scene follows (§ 1.4). */
  const land = () => {
    const [next, chosen] = arrive(modelRef.current, kit.rng)
    apply(next)
    advance(() => silly(chosen), SCENE_AT_MS)
  }

  const silly = (chosen: SceneId) => {
    if (!reducedMotion) setPlaying(chosen)
    kit.setPose('cheering')
    sfx.cheer.play()
    if (chosen === 'cannonball' && !reducedMotion) {
      later(() => sfx.splash.play(), 500)
    }
    let lineDone = false
    let sceneDone = false
    const next = () => {
      if (lineDone && sceneDone) advance(walkHome, AFTER_SCENE_MS)
    }
    later(
      () => {
        sceneDone = true
        setPlaying(null)
        next()
      },
      reducedMotion ? 0 : SCENE_MS,
    )
    void speak('guide.play.raft.silly').then(() => {
      lineDone = true
      next()
    })
  }

  // --- The walk home (§ 1.4, § 2) ----------------------------------------

  const walkHome = () => {
    kit.setPose('idle')
    const plan = homePlan(modelRef.current)
    plan.forEach((h, k) => advance(() => hopStart(h), HOP_HOME_STAGGER_MS * k))
    const lastEnd =
      HOP_HOME_STAGGER_MS * Math.max(0, plan.length - 1) +
      (reducedMotion ? FADE_MS : HOP_HOME_MS)
    advance(afterHomes, lastEnd + HOME_BEAT_MS + AFTER_HOMES_MS)
  }

  const hopStart = (h: HomeHop) => {
    apply(homeOne(modelRef.current, h.id))
    const key = nextKey()
    setWalkers((ws) => [...ws, { ...h, key }])
    later(() => hopEnd(h, key), reducedMotion ? FADE_MS : HOP_HOME_MS)
  }

  const hopEnd = (h: HomeHop, key: number) => {
    setWalkers((ws) => ws.filter((x) => x.key !== key))
    const w = h.weight
    if (h.fill) {
      setShown((ks) => (ks.includes(w) ? ks : [...ks, w]))
      setFx((f) => ({ ...f, [w]: { fill: key, repeat: f[w]?.repeat ?? 0 } }))
      sfx.sparkle.play()
      onFill?.(w)
      if (!reducedMotion) {
        setBursts((b) => [...b, { w, key }])
        later(
          () => setBursts((b) => b.filter((x) => x.key !== key)),
          SPARKLE_BURST_MS,
        )
      }
      return
    }
    setFx((f) => ({ ...f, [w]: { fill: f[w]?.fill ?? 0, repeat: key } }))
  }

  /** The ninth kind just filled: the party; otherwise the way back. */
  const afterHomes = () => {
    if (!fullAtStart && islandIsFull(modelRef.current)) party()
    else goBack()
  }

  /** Every crossing without a party (§ 6): back to a refilled shore. */
  const goBack = () => {
    setGliding(true)
    setDeckAt('dock')
    kit.setPose('idle')
    advance(
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

  // --- The party (§ 3.1) ---------------------------------------------------

  const party = () => {
    apply(startParty(modelRef.current))
    kit.setPose('celebration')
    later(() => setLap(nextKey()), PARTY_LAP_AT_MS)
    advance(() => {
      kit.setPose('cheering')
      void speak('guide.play.raft.party').then((ok) => {
        if (!ok) return
        sfx.cheer.play()
        if (!reducedMotion) {
          setPartyBurst(true)
          setDance(nextKey())
          later(() => setPartyBurst(false), SPARKLE_BURST_MS)
        }
        advance(() => {
          kit.setPose('cheering')
          void speak('guide.play.raft.close').then((closed) => {
            if (!closed) return
            advance(() => {
              kit.setPose('idle')
              onPartyEnd?.()
            }, CLOSE_GAP_MS)
          })
        }, CHEER_MS + PARTY_CLOSE_GAP_MS)
      })
    }, PARTY_LINE_AT_MS)
  }

  // --- Drawing -----------------------------------------------------------

  const { a } = scene
  const takeFrom = (key: string) => flights[key]
  const shoreOpen = model.phase === 'loading' || model.phase === 'wobbling'
  const homeRects = islandHomes(scene)
  const face = moundFace(scene)
  const heaviestAboard = Math.max(
    0,
    ...model.seats.map((id) => (id === null ? 0 : model.animals[id]!.weight)),
  )

  return (
    <View testID="raft-crossing" pointerEvents="box-none" style={styles.fill}>
      <Backdrop scene={scene} area={kit.area} tablet={tablet} />
      <TripIsland scene={scene} tablet={tablet} />

      {/* The nine homes (§ 1): not touch targets (Decision 10). */}
      <View pointerEvents="none" style={styles.fill}>
        {homeRects.map((r, i) => {
          const w = (i + 1) as RaftWeight
          const filled = shown.includes(w)
          return (
            <View
              key={w}
              testID={`raft-home-${w}`}
              accessible
              accessibilityLabel={homeLabel(RAFT_ANIMALS[w], w, filled)}
              style={[styles.abs, rectStyle(r)]}
            >
              <HomeMotion
                w={w}
                h={r.width}
                order={i}
                fx={fx[w]}
                lap={filled ? lap : 0}
                dance={dance}
                reducedMotion={reducedMotion}
              >
                {/* § 2.1: the shape fades out (150 ms) as the animal lands;
                    § 2.3: Reduce Motion cross-fades (200 ms). */}
                <Animated.View
                  key={filled ? 'filled' : 'empty'}
                  pointerEvents="none"
                  entering={
                    filled && reducedMotion && fx[w]?.fill
                      ? FadeIn.duration(CROSS_FADE_MS)
                      : undefined
                  }
                  exiting={FadeOut.duration(
                    reducedMotion ? CROSS_FADE_MS : FADE_MS,
                  )}
                  style={styles.fill}
                >
                  <HomeArt
                    weight={w}
                    size={r.width}
                    filled={filled}
                    tag
                    tablet={tablet}
                    id={`raft-home-${w}`}
                  />
                </Animated.View>
              </HomeMotion>
            </View>
          )
        })}
        {bursts.map(({ w, key }) => {
          const r = homeRects[w - 1]!
          return (
            <View
              key={key}
              pointerEvents="none"
              style={[styles.abs, rectStyle(r)]}
            >
              <SparkleBurst
                testID={`raft-home-burst-${w}`}
                distance={1.2 * r.width}
                glyph={0.45 * r.width}
              />
            </View>
          )
        })}
        {partyBurst && (
          <View pointerEvents="none" style={[styles.abs, rectStyle(face)]}>
            <SparkleBurst
              testID="raft-party-burst"
              distance={75 * (tablet ? 1.5 : 1)}
              glyph={16 * (tablet ? 1.5 : 1)}
            />
          </View>
        )}
        {playing !== null && <View testID={`raft-scene-${playing}`} />}
        {lap > 0 && !reducedMotion && <View testID="raft-lap" />}
        {lap > 0 && reducedMotion && <View testID="raft-brighten" />}
        {dance > 0 && <View testID="raft-dance" />}
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
                <SceneMotion
                  scene={playing}
                  reducedMotion={reducedMotion}
                  order={seat}
                  heaviest={animal.weight === heaviestAboard}
                >
                  <AnimalArt
                    weight={animal.weight}
                    size={scene.seats[seat]!.width}
                    tag
                    tablet={tablet}
                  />
                </SceneMotion>
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
              disabled={model.phase === 'party'}
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

      {/* The walk home: each animal from its seat at the landing to its
          home, above the scene. */}
      {walkers.map((h) => (
        <HopHome
          key={`${h.key}|${kit.cancelKey}`}
          testID={`raft-hop-${h.id}`}
          weight={h.weight}
          seat={seatOnScreen(scene, scene.landing, h.seat)}
          home={homeRects[h.weight - 1]!}
          fill={h.fill}
          a={a}
          reducedMotion={reducedMotion}
          tablet={tablet}
        />
      ))}

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
 * One hop home (§ 1.4): from its seat (0.7 a) to its home (`h`), a 0.2 a
 * arc over 300 ms; a repeat fades over the hop's last 100 ms (§ 2.2).
 * Reduce Motion: no hop; it fades out at its seat (150 ms, § 2.3).
 */
function HopHome({
  weight,
  seat,
  home,
  fill,
  a,
  reducedMotion,
  tablet,
  testID,
}: {
  weight: RaftWeight
  seat: Rect
  home: Rect
  fill: boolean
  a: number
  reducedMotion: boolean
  tablet: boolean
  testID: string
}) {
  const t = useSharedValue(0)
  const o = useSharedValue(1)
  useEffect(() => {
    if (reducedMotion) {
      o.set(withTiming(0, { duration: FADE_MS }))
      return
    }
    t.set(withTiming(1, { duration: HOP_HOME_MS, easing: Easing.linear }))
    if (!fill) {
      o.set(
        withDelay(
          HOP_HOME_MS - 100,
          withTiming(0, { duration: 100, easing: Easing.linear }),
        ),
      )
    }
    // Mount-once: one hop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const d = delta(seat, home)
  const s0 = seat.width / home.width
  const arc = 0.2 * a
  const style = useAnimatedStyle(() => {
    const p = t.get()
    return {
      opacity: o.get(),
      transform: [
        { translateX: d.x * (1 - p) },
        { translateY: d.y * (1 - p) - arc * 4 * p * (1 - p) },
        { scale: s0 + (1 - s0) * p },
      ],
    }
  })
  // At the home, carried back to the seat by `d` and `s0` (Reduce Motion
  // stays there and fades).
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[styles.abs, rectStyle(home), style]}
    >
      <AnimalArt
        weight={weight}
        size={home.width}
        tag={false}
        tablet={tablet}
      />
    </Animated.View>
  )
}

/**
 * A home's own motion (§§ 2, 3): a fill settles (1.12 → 1, 200 ms); a
 * repeat wiggles around its feet (0 → −5° → +5° → −3° → 0, 100 ms a
 * step); the party's lap hops it 0.45 h, 120 ms after the home before;
 * the dance of nine is the shipped dance at the lap's height. Reduce
 * Motion (§ 9): a repeat dims 1 → 0.6 → 1 (300 ms), the lap brightens a
 * filled animal 0.85 → 1 (200 ms), no settle, wiggle, hop or dance.
 */
function HomeMotion({
  w,
  h,
  order,
  fx,
  lap,
  dance,
  reducedMotion,
  children,
}: {
  w: RaftWeight
  h: number
  order: number
  fx: HomeFx | undefined
  lap: number
  dance: number
  reducedMotion: boolean
  children: ReactNode
}) {
  const y = useSharedValue(0)
  const r = useSharedValue(0)
  const s = useSharedValue(1)
  const o = useSharedValue(1)
  const fill = fx?.fill ?? 0
  const repeat = fx?.repeat ?? 0
  const hopUp = (d: number) =>
    withDelay(
      d,
      withSequence(
        withTiming(-0.45 * h, { duration: 150 }),
        withTiming(0, { duration: 150 }),
      ),
    )

  useEffect(() => {
    if (fill === 0 || reducedMotion) return
    s.set(1.12)
    s.set(withTiming(1, { duration: 200 }))
  }, [fill, reducedMotion, s])

  useEffect(() => {
    if (repeat === 0) return
    if (reducedMotion) {
      o.set(
        withSequence(
          withTiming(0.6, { duration: 150 }),
          withTiming(1, { duration: 150 }),
        ),
      )
      return
    }
    const step = { duration: WIGGLE_STEP_MS }
    r.set(
      withSequence(
        withTiming(-5, step),
        withTiming(5, step),
        withTiming(-3, step),
        withTiming(0, step),
      ),
    )
  }, [repeat, reducedMotion, r, o])

  useEffect(() => {
    if (lap === 0) return
    if (reducedMotion) {
      o.set(0.85)
      o.set(withTiming(1, { duration: 200 }))
      return
    }
    y.set(hopUp(PARTY_LAP_STEP_MS * order))
    // A new lap only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lap, reducedMotion])

  useEffect(() => {
    if (dance === 0 || reducedMotion) return
    y.set(withSequence(hopUp(100 * order), hopUp(600)))
    // A new dance only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dance, reducedMotion])

  const style = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [
      { translateY: y.get() },
      { rotate: `${r.get()}deg` },
      { scale: s.get() },
    ],
  }))
  return (
    <Animated.View style={[styles.fill, styles.feet, style]}>
      {children}
      {fill > 0 && !reducedMotion && <View testID={`raft-home-${w}-settle`} />}
      {repeat > 0 && !reducedMotion && (
        <View testID={`raft-home-${w}-wiggle`} />
      )}
      {repeat > 0 && reducedMotion && <View testID={`raft-home-${w}-dim`} />}
    </Animated.View>
  )
}

/**
 * The water, the shore and the island's band (drawn, § 2.2) as the Map's
 * land (T2): one pool slab under the island and the water, running R
 * under the shore; short ripples; the sand band on top. The island's oval
 * and its homes are drawn over it. `raft-water` keeps its rect for tests.
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
  const { shore, water, island } = scene
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
 * The silly scenes (§ 2.3), about 2-3 s, played by this crossing's
 * animals on the deck at the landing (raft-island-goal Decision 4): each
 * scene's motion is an offset from the animal's seat. The tower topples
 * onto the logs; the cannonball jumps from the deck into the water. None
 * under Reduce Motion.
 */
function SceneMotion({
  scene,
  reducedMotion,
  order,
  heaviest,
  children,
}: {
  scene: SceneId | null
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
  /** A home turns around its animal's feet, in the nest (§ 2.2). */
  feet: { transformOrigin: '50% 92%' },
  pool: { backgroundColor: WATER },
  ripple: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  shore: {
    backgroundColor: SHORE_LO,
    experimental_backgroundImage: `linear-gradient(${SHORE_HI}, ${SHORE_LO})`,
  },
})
