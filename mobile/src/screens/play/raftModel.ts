/**
 * Raft crossing's model (play-place spec § 2.3): pure state and moves, no
 * timers. `RaftCrossing.tsx` runs the beats and calls these at their times;
 * the model lives for the visit only and is never written (§ 1.6).
 *
 * - **Board** an animal from the shore: it takes the next free seat. Past
 *   10 it splashes (`splashing`): the total keeps the old load and drops are
 *   refused while the raft wobbles; at the splash's end the animal is back
 *   on its spot. Exactly 10 departs.
 * - **Stuck** (D4): `splashesInARow` counts splashes; a board that does not
 *   splash, a take-off and a departure reset it. A splash that ends with the
 *   count at 2 or more, a stuck raft (`raftStuck`) and an empty spot brings
 *   a newcomer of exactly the missing weight to the empty spot nearest the
 *   shore's outer edge.
 * - **Take off**: back to its own spot, or the nearest free one when a
 *   newcomer stands there; with every spot full, the most recent newcomer
 *   walks out and the animal takes the freed spot.
 * - **Cross**: exactly 10 leaves, the animals land on the island, a silly
 *   scene never the same twice in a row; crossings 1 and 2 come back and the
 *   shore refills to 6 (`raftRefill`); the third is the natural stop.
 */
import {
  RAFT_CROSSINGS,
  RAFT_LOAD,
  RAFT_SHORE_SIZE,
  raftRefill,
  raftShore,
  raftStuck,
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
  /** Exactly ten: crossing, the scene and the way back; boarding closed. */
  | 'away'
  /** After the third crossing: the close, then the Play place. */
  | 'done'

export interface RaftState {
  animals: Readonly<Record<number, RaftAnimal>>
  /** The animal on each shore spot, or null. */
  spots: readonly (number | null)[]
  /** The animal on each seat, or null (back row, then front). */
  seats: readonly (number | null)[]
  total: number
  splashesInARow: number
  /** The animal in the water after a splash (paddling home), or null. */
  splashing: number | null
  /** Crossings done this visit. */
  crossings: number
  /** Every animal on the island, in landing order. */
  island: readonly { id: number; weight: RaftWeight }[]
  /** The last silly scene played, never repeated next. */
  lastScene: SceneId | null
  phase: RaftPhase
  nextId: number
  /** Newcomer order counter. */
  newcomerSeq: number
}

export type Rng = () => number

const SEATS = 6

function withShore(weights: readonly number[]): RaftState {
  const animals: Record<number, RaftAnimal> = {}
  const spots: (number | null)[] = []
  weights.forEach((w, i) => {
    animals[i] = { id: i, weight: w as RaftWeight, home: i, newcomer: null }
    spots.push(i)
  })
  while (spots.length < RAFT_SHORE_SIZE) spots.push(null)
  return {
    animals,
    spots,
    seats: Array.from({ length: SEATS }, () => null),
    total: 0,
    splashesInARow: 0,
    splashing: null,
    crossings: 0,
    island: [],
    lastScene: null,
    phase: 'loading',
    nextId: weights.length,
    newcomerSeq: 0,
  }
}

/** A fresh visit: 6 animals from `raftShore(rng)`, or a test's `shore`. */
export function initialRaft(rng: Rng, shore?: readonly number[]): RaftState {
  return withShore(shore ?? raftShore(rng))
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
  if (s.total + animal.weight > RAFT_LOAD) {
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
  if (total === RAFT_LOAD) return [{ ...next, phase: 'away' }, 'depart']
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
  if (
    next.splashesInARow >= 2 &&
    raftStuck(waitingWeights(next), next.total) &&
    empty.length > 0
  ) {
    const spot = empty.reduce((a, b) =>
      metric.outer(b) > metric.outer(a) ? b : a,
    )
    const nid = next.nextId
    const weight = (RAFT_LOAD - next.total) as RaftWeight
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

/** The raft lands: its animals hop onto the island; this crossing's scene. */
export function arrive(s: RaftState, rng: Rng): [RaftState, SceneId] {
  const aboard = s.seats.filter((x): x is number => x !== null)
  const options = SCENES.filter((x) => x !== s.lastScene)
  const scene =
    options[Math.min(options.length - 1, Math.floor(rng() * options.length))]!
  const animals = { ...s.animals }
  for (const id of aboard) delete animals[id]
  return [
    {
      ...s,
      animals,
      island: [
        ...s.island,
        ...aboard.map((id) => ({ id, weight: s.animals[id]!.weight })),
      ],
      seats: s.seats.map(() => null),
      total: 0,
      splashesInARow: 0,
      crossings: s.crossings + 1,
      lastScene: scene,
    },
    scene,
  ]
}

/** After the scene: the last crossing ends the trip. */
export const tripOver = (s: RaftState) => s.crossings >= RAFT_CROSSINGS

/**
 * The raft is back at the dock (crossings 1 and 2): newcomers fill the
 * empty spots, nearest the outer edge first; an unused stuck newcomer is
 * now an ordinary waiting animal. Boarding opens.
 */
export function refill(
  s: RaftState,
  rng: Rng,
  metric: SpotMetric,
): [RaftState, number[]] {
  const waiting = waitingWeights(s)
  const all = raftRefill(waiting, rng)
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

/** The trip's natural stop. */
export const finish = (s: RaftState): RaftState => ({ ...s, phase: 'done' })
