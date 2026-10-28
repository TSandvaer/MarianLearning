/**
 * Raft crossing's model (play-place spec § 2.3, raft-island-goal §§ 1-6):
 * pure state and moves, no timers. `RaftCrossing.tsx` runs the beats and
 * calls these at their times; the model lives for the trip only. The
 * island's record (`raftIsland.ts`) is the screen's to write.
 *
 * - **Board** an animal from the shore: it takes the next free seat. Past
 *   the raft's target (10, or 20) it splashes (`splashing`): the total
 *   keeps the old load and drops are refused while the raft wobbles; at
 *   the splash's end the animal is back on its spot. Exactly the target
 *   departs.
 * - **Stuck** (D4): `splashesInARow` counts splashes; a board that does not
 *   splash, a take-off and a departure reset it. A splash that ends with the
 *   count at 2 or more, a stuck raft and an empty spot brings a newcomer
 *   of `raftNewcomer`'s weight to the empty spot nearest the shore's outer
 *   edge.
 * - **Take off**: back to its own spot, or the nearest free one when a
 *   newcomer stands there; with every spot full, the most recent newcomer
 *   walks out and the animal takes the freed spot.
 * - **Cross**: exactly the target leaves; at the island the animals stay
 *   seated for a silly scene, never the same twice in a row, then hop home
 *   lightest first (`homePlan`, `homeOne`): a new kind fills its home, a
 *   kind already home merges. Every crossing without a party comes back
 *   and the shore refills to 6 (`raftRefill`, with the island's missing
 *   kinds). No crossing cap (raft-island-goal § 6): the ninth kind's
 *   crossing parties, and nothing else ends a trip but Back.
 */
import {
  RAFT_SEATS,
  RAFT_SHORE_SIZE,
  raftNewcomer,
  raftRefill,
  raftShore,
  type RaftTarget,
  type RaftWeight,
} from '@marian/core/games/playPlace'

export type SceneId = 'dance' | 'tower' | 'cannonball' | 'spin'
export const SCENES: readonly SceneId[] = [
  'dance',
  'tower',
  'cannonball',
  'spin',
]

export interface RaftAnimal {
  id: number
  weight: RaftWeight
  /** Its own shore spot (0-5). */
  home: number
  /** Walked on to unstick the raft (D4); the most recent leaves first. */
  newcomer: number | null
}

export type RaftPhase =
  /** Boarding open. */
  | 'loading'
  /** Too heavy: the raft wobbles; drops are refused. */
  | 'wobbling'
  /** Exactly the target: crossing, the scene, the walk home and the way
   *  back; boarding closed. */
  | 'away'
  /** The ninth kind is home: the party; touch stays locked. */
  | 'party'

export interface RaftState {
  /** What this raft carries, exactly (raft-island-goal § 4). */
  target: RaftTarget
  animals: Readonly<Record<number, RaftAnimal>>
  /** The animal on each shore spot, or null. */
  spots: readonly (number | null)[]
  /** The animal on each seat, or null (back row, then front). */
  seats: readonly (number | null)[]
  total: number
  splashesInARow: number
  /** The animal in the water after a splash (paddling home), or null. */
  splashing: number | null
  /** The kinds home on this raft's island, ascending (Dave (1)). */
  homes: readonly RaftWeight[]
  /** The last silly scene played, never repeated next. */
  lastScene: SceneId | null
  phase: RaftPhase
  nextId: number
  /** Newcomer order counter. */
  newcomerSeq: number
}

export type Rng = () => number

/** The nine kinds, bee 1 to pig 9: one home each. */
const KINDS: readonly RaftWeight[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/** The kinds `homes` lacks: a shore's `missing` (Dave (1)). */
export const missingOf = (homes: readonly RaftWeight[]): RaftWeight[] =>
  KINDS.filter((k) => !homes.includes(k))

function withShore(
  weights: readonly number[],
  target: RaftTarget,
  homes: readonly RaftWeight[],
): RaftState {
  const animals: Record<number, RaftAnimal> = {}
  const spots: (number | null)[] = []
  weights.forEach((w, i) => {
    animals[i] = { id: i, weight: w as RaftWeight, home: i, newcomer: null }
    spots.push(i)
  })
  while (spots.length < RAFT_SHORE_SIZE) spots.push(null)
  return {
    target,
    animals,
    spots,
    seats: Array.from({ length: RAFT_SEATS[target] }, () => null),
    total: 0,
    splashesInARow: 0,
    splashing: null,
    homes: KINDS.filter((k) => homes.includes(k)),
    lastScene: null,
    phase: 'loading',
    nextId: weights.length,
    newcomerSeq: 0,
  }
}

export interface RaftTrip {
  /** The raft (default 10). */
  target?: RaftTarget
  /** The kinds already home on its island (default none). */
  homes?: readonly RaftWeight[]
  /** A test's first shore (default `raftShore`). */
  shore?: readonly number[]
}

/**
 * A fresh trip: 6 animals from `raftShore` for the raft's target and its
 * island's missing kinds, or a test's `shore`.
 */
export function initialRaft(
  rng: Rng,
  { target = 10, homes = [], shore }: RaftTrip = {},
): RaftState {
  return withShore(
    shore ?? raftShore(rng, { target, missing: missingOf(homes) }),
    target,
    homes,
  )
}

/** The shore's weights, in spot order (the `waiting` of `raftStuck`). */
export function waitingWeights(s: RaftState): number[] {
  return s.spots
    .filter((id): id is number => id !== null)
    .map((id) => s.animals[id]!.weight)
}

export const isAboard = (s: RaftState, id: number) => s.seats.includes(id)
export const isOnShore = (s: RaftState, id: number) => s.spots.includes(id)

export type BoardResult = 'boarded' | 'splash' | 'depart' | 'refused'

/** Board `id` from the shore. */
export function board(s: RaftState, id: number): [RaftState, BoardResult] {
  if (s.phase !== 'loading' || !isOnShore(s, id)) return [s, 'refused']
  const seat = s.seats.indexOf(null)
  if (seat < 0) return [s, 'refused']
  const animal = s.animals[id]!
  const spots = s.spots.map((x) => (x === id ? null : x))
  if (s.total + animal.weight > s.target) {
    return [
      {
        ...s,
        spots,
        splashing: id,
        splashesInARow: s.splashesInARow + 1,
        phase: 'wobbling',
      },
      'splash',
    ]
  }
  const seats = s.seats.map((x, i) => (i === seat ? id : x))
  const total = s.total + animal.weight
  const next: RaftState = { ...s, spots, seats, total, splashesInARow: 0 }
  if (total === s.target) return [{ ...next, phase: 'away' }, 'depart']
  return [next, 'boarded']
}

/** The wobble is over: boarding opens again (the animal still paddles). */
export function wobbleEnd(s: RaftState): RaftState {
  return s.phase === 'wobbling' ? { ...s, phase: 'loading' } : s
}

/** The free spot nearest `from` (by centre distance in spot order). */
function nearestFree(
  spots: readonly (number | null)[],
  from: number,
  distance: (a: number, b: number) => number,
): number {
  let best = -1
  spots.forEach((x, i) => {
    if (x !== null) return
    if (best < 0 || distance(i, from) < distance(best, from)) best = i
  })
  return best
}

export interface SpotMetric {
  /** Distance between two spots. */
  distance: (a: number, b: number) => number
  /** Larger = nearer the shore's outer edge. */
  outer: (spot: number) => number
}

/** The splashing animal is back on its spot; maybe a newcomer walks on. */
export function splashEnd(
  s: RaftState,
  metric: SpotMetric,
): [RaftState, { newcomer: number | null }] {
  const id = s.splashing
  if (id === null) return [s, { newcomer: null }]
  const animal = s.animals[id]!
  const spots = [...s.spots]
  let home = animal.home
  if (spots[home] !== null)
    home = nearestFree(spots, animal.home, metric.distance)
  if (home >= 0) spots[home] = id
  let next: RaftState = {
    ...s,
    spots,
    animals: {
      ...s.animals,
      [id]: { ...animal, home: home >= 0 ? home : animal.home },
    },
    splashing: null,
    phase: s.phase === 'wobbling' ? 'loading' : s.phase,
  }
  const empty = spots.flatMap((x, i) => (x === null ? [i] : []))
  const weight =
    next.splashesInARow >= 2 && empty.length > 0
      ? raftNewcomer(waitingWeights(next), next.total, next.target)
      : undefined
  if (weight !== undefined) {
    const spot = empty.reduce((a, b) =>
      metric.outer(b) > metric.outer(a) ? b : a,
    )
    const nid = next.nextId
    next = {
      ...next,
      animals: {
        ...next.animals,
        [nid]: { id: nid, weight, home: spot, newcomer: next.newcomerSeq + 1 },
      },
      spots: next.spots.map((x, i) => (i === spot ? nid : x)),
      nextId: nid + 1,
      newcomerSeq: next.newcomerSeq + 1,
      splashesInARow: 0,
    }
    return [next, { newcomer: nid }]
  }
  return [next, { newcomer: null }]
}

export interface TakeOffResult {
  /** The spot it hopped to. */
  spot: number
  /** A newcomer that walked out to make room, or null. */
  leaving: number | null
}

/** Take `id` off the deck. */
export function takeOff(
  s: RaftState,
  id: number,
  metric: SpotMetric,
): [RaftState, TakeOffResult | null] {
  if (s.phase !== 'loading' && s.phase !== 'wobbling') return [s, null]
  if (!isAboard(s, id)) return [s, null]
  const animal = s.animals[id]!
  const spots = [...s.spots]
  let animals = { ...s.animals }
  let leaving: number | null = null
  let spot = animal.home
  if (spots[spot] !== null) {
    const free = nearestFree(spots, animal.home, metric.distance)
    if (free >= 0) spot = free
    else {
      // Every spot full: the most recent newcomer walks back out.
      const newest = spots
        .filter((x): x is number => x !== null && animals[x]!.newcomer !== null)
        .reduce<
          number | null
        >((a, b) => (a === null || animals[b]!.newcomer! > animals[a]!.newcomer! ? b : a), null)
      if (newest === null) return [s, null]
      leaving = newest
      const freed = spots.indexOf(newest)
      spots[freed] = null
      const rest = { ...animals }
      delete rest[newest]
      animals = rest
      spot = spots[animal.home] === null ? animal.home : freed
    }
  }
  spots[spot] = id
  animals[id] = { ...animal, home: spot }
  return [
    {
      ...s,
      animals,
      spots,
      seats: s.seats.map((x) => (x === id ? null : x)),
      total: s.total - animal.weight,
      splashesInARow: 0,
    },
    { spot, leaving },
  ]
}

/**
 * The raft lands: its animals stay seated; this crossing's scene, never
 * the last one again.
 */
export function arrive(s: RaftState, rng: Rng): [RaftState, SceneId] {
  const options = SCENES.filter((x) => x !== s.lastScene)
  const scene =
    options[Math.min(options.length - 1, Math.floor(rng() * options.length))]!
  return [{ ...s, splashesInARow: 0, lastScene: scene }, scene]
}

/** One animal's hop home: a new kind fills its home, else it merges. */
export interface HomeHop {
  id: number
  weight: RaftWeight
  seat: number
  fill: boolean
}

/**
 * The walk home (raft-island-goal § 1.4): the seated animals in weight
 * order, lightest first (seat order on a tie). The first of a kind not yet
 * home fills it; a second of the same kind, or a kind already home, merges
 * (§ 2.1, § 2.2).
 */
export function homePlan(s: RaftState): HomeHop[] {
  const seated = s.seats.flatMap((id, seat) =>
    id === null ? [] : [{ id, seat, weight: s.animals[id]!.weight }],
  )
  seated.sort((p, q) => p.weight - q.weight || p.seat - q.seat)
  const home = new Set(s.homes)
  return seated.map((x) => {
    const fill = !home.has(x.weight)
    home.add(x.weight)
    return { ...x, fill }
  })
}

/** `id` has hopped home: off its seat and the trip; its kind is home. */
export function homeOne(s: RaftState, id: number): RaftState {
  if (!isAboard(s, id)) return s
  const animal = s.animals[id]!
  const animals = { ...s.animals }
  delete animals[id]
  return {
    ...s,
    animals,
    seats: s.seats.map((x) => (x === id ? null : x)),
    total: s.total - animal.weight,
    homes: KINDS.filter((k) => k === animal.weight || s.homes.includes(k)),
  }
}

/** Every kind is home on this island. */
export const islandIsFull = (s: RaftState) => s.homes.length === KINDS.length

/**
 * The raft is back at the dock (every crossing without a party): newcomers
 * fill the empty spots, nearest the outer edge first, dealt for the
 * island's missing kinds (Dave's refill rule, in `raftRefill`); an unused
 * stuck newcomer is now an ordinary waiting animal. Boarding opens.
 */
export function refill(
  s: RaftState,
  rng: Rng,
  metric: SpotMetric,
): [RaftState, number[]] {
  const waiting = waitingWeights(s)
  const all = raftRefill(waiting, rng, {
    target: s.target,
    missing: missingOf(s.homes),
  })
  const fresh = all.slice(waiting.length)
  const empty = s.spots
    .flatMap((x, i) => (x === null ? [i] : []))
    .sort((a, b) => metric.outer(b) - metric.outer(a))
  const animals: Record<number, RaftAnimal> = {}
  for (const [id, a] of Object.entries(s.animals)) {
    animals[Number(id)] = { ...a, newcomer: null }
  }
  const spots = [...s.spots]
  const ids: number[] = []
  let nextId = s.nextId
  fresh.forEach((w, i) => {
    const spot = empty[i]
    if (spot === undefined) return
    const id = nextId++
    animals[id] = { id, weight: w as RaftWeight, home: spot, newcomer: null }
    spots[spot] = id
    ids.push(id)
  })
  return [
    { ...s, animals, spots, nextId, phase: 'loading', newcomerSeq: 0 },
    ids,
  ]
}

/** The ninth kind is home: the party locks the shore and the raft. */
export const startParty = (s: RaftState): RaftState => ({
  ...s,
  phase: 'party',
})
