/**
 * Raft crossing's model (play-place § 2.3, raft-island-goal §§ 1-6; ACs
 * N7, N7a, I8, I12 at the model level; the screen's timing is
 * RaftCrossing.test.tsx's and RaftIsland.test.tsx's).
 */
import * as playPlace from '@marian/core/games/playPlace'
import { RAFT_ANIMALS } from '@marian/core/games/playPlace'
import * as model from './raftModel'
import {
  arrive,
  board,
  homeOne,
  homePlan,
  initialRaft,
  islandIsFull,
  missingOf,
  refill,
  splashEnd,
  takeOff,
  waitingWeights,
  wobbleEnd,
  type RaftState,
  type SpotMetric,
} from './raftModel'

/** Spots 0-2 the water row, 3-5 the outer row (portrait). */
const METRIC: SpotMetric = {
  distance: (a, b) =>
    Math.hypot((a % 3) - (b % 3), Math.floor(a / 3) - Math.floor(b / 3)),
  outer: (spot) => Math.floor(spot / 3) * 10 - (spot % 3),
}

function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const idOf = (s: RaftState, weight: number, nth = 0) =>
  s.spots.filter((id) => id !== null && s.animals[id]!.weight === weight)[nth]!

function splash(s: RaftState, id: number) {
  const [a, r] = board(s, id)
  expect(r).toBe('splash')
  return splashEnd(wobbleEnd(a), METRIC)
}

describe('board and take off (N7)', () => {
  it('boards to the next free seat; the total follows; take-off goes home', () => {
    let s = initialRaft(seeded(1), { shore: [7, 3, 6, 4, 8, 2] })
    ;[s] = board(s, idOf(s, 6))
    expect(s.total).toBe(6)
    expect(s.seats[0]).toBe(2)
    ;[s] = board(s, idOf(s, 2))
    expect(s.total).toBe(8)
    expect(s.seats[1]).toBe(5)
    const [t, off] = takeOff(s, 2, METRIC)
    expect(t.total).toBe(2)
    expect(off).toEqual({ spot: 2, leaving: null })
    expect(t.spots[2]).toBe(2)
  })

  it('past ten: a splash; the total keeps the old load; drops are refused while it wobbles', () => {
    let s = initialRaft(seeded(1), { shore: [7, 3, 6, 4, 8, 2] })
    ;[s] = board(s, idOf(s, 7))
    const [w, r] = board(s, idOf(s, 6))
    expect(r).toBe('splash')
    expect(w.total).toBe(7)
    expect(w.phase).toBe('wobbling')
    expect(board(w, idOf(w, 3))[1]).toBe('refused')
    const [back] = splashEnd(wobbleEnd(w), METRIC)
    expect(back.spots[2]).toBe(2)
    expect(back.total).toBe(7)
    expect(back.phase).toBe('loading')
  })

  it('exactly ten departs', () => {
    let s = initialRaft(seeded(1), { shore: [7, 3, 6, 4, 8, 2] })
    ;[s] = board(s, idOf(s, 7))
    const [d, r] = board(s, idOf(s, 3))
    expect(r).toBe('depart')
    expect(d.phase).toBe('away')
    expect(board(d, idOf(d, 6))[1]).toBe('refused')
  })
})

describe('stuck: a newcomer walks on (N7a, D4)', () => {
  /** A 6 aboard, waiting 2, 5, 7, 9, 9: no set makes 4. */
  function stuck() {
    let s = initialRaft(seeded(1), { shore: [6, 2, 5, 7, 9, 9] })
    ;[s] = board(s, idOf(s, 6))
    return s
  }

  it('after the first splash no newcomer; after the second, the missing weight at the outer empty spot', () => {
    let s = stuck()
    let r
    ;[s, r] = splash(s, idOf(s, 5))
    expect(r.newcomer).toBeNull()
    ;[s, r] = splash(s, idOf(s, 7))
    expect(r.newcomer).not.toBeNull()
    const n = s.animals[r.newcomer!]!
    expect(RAFT_ANIMALS[n.weight]).toBe(RAFT_ANIMALS[4])
    expect(n.weight).toBe(4)
    expect(s.spots[0]).toBe(r.newcomer)
    expect(s.splashesInARow).toBe(0)
    // Boarding it departs.
    expect(board(s, r.newcomer!)[1]).toBe('depart')
  })

  it('a board or take-off between the two splashes resets the count', () => {
    let s = stuck()
    ;[s] = splash(s, idOf(s, 5))
    ;[s] = board(s, idOf(s, 2))
    ;[s] = takeOff(s, s.seats[1]!, METRIC)
    const [, r] = splash(s, idOf(s, 7))
    expect(r.newcomer).toBeNull()
  })

  it('a splash on a raft that is not stuck never brings one', () => {
    let s = initialRaft(seeded(1), { shore: [6, 2, 5, 7, 9, 4] })
    ;[s] = board(s, idOf(s, 6))
    ;[s] = splash(s, idOf(s, 5))
    const [, r] = splash(s, idOf(s, 7))
    expect(r.newcomer).toBeNull()
  })

  it('one aboard, its spot taken by the newcomer: taking it off sends the newcomer out', () => {
    let s = stuck()
    ;[s] = splash(s, idOf(s, 5))
    const [after, r] = splash(s, idOf(s, 7))
    s = after
    const newcomer = r.newcomer!
    expect(s.spots.every((x) => x !== null)).toBe(true)
    const six = s.seats[0]!
    const [t, off] = takeOff(s, six, METRIC)
    expect(off).toEqual({ spot: 0, leaving: newcomer })
    expect(t.spots[0]).toBe(six)
    expect(t.animals[newcomer]).toBeUndefined()
    expect(waitingWeights(t)).toEqual([6, 2, 5, 7, 9, 9])
  })
})

describe('crossings (I8: no cap)', () => {
  /** Load a pair to ten, land, walk everyone home. */
  function cross(s: RaftState, rng: () => number) {
    const pair = raftLoadPair(s)
    ;[s] = board(s, pair[0])
    ;[s] = board(s, pair[1])
    expect(s.phase).toBe('away')
    let scene
    ;[s, scene] = arrive(s, rng)
    // At arrival the animals stay seated.
    expect(s.seats.filter((x) => x !== null)).toHaveLength(2)
    const plan = homePlan(s)
    for (const hop of plan) s = homeOne(s, hop.id)
    return { s, scene, plan }
  }

  it('twelve crossings in a row all come back to a full shore; scenes never repeat back to back', () => {
    const rng = seeded(7)
    let s = initialRaft(rng, { shore: [7, 3, 6, 4, 8, 2] })
    let last = null
    for (let k = 1; k <= 12; k++) {
      const r = cross(s, rng)
      expect(r.scene).not.toBe(last)
      last = r.scene
      s = r.s
      expect(s.seats.every((x) => x === null)).toBe(true)
      expect(s.total).toBe(0)
      ;[s] = refill(s, rng, METRIC)
      expect(s.spots.filter((x) => x !== null)).toHaveLength(6)
      expect(s.phase).toBe('loading')
    }
  })

  it('no crossing cap is left in the model or the core (I8)', () => {
    expect('tripOver' in model).toBe(false)
    expect('RAFT_CROSSINGS' in playPlace).toBe(false)
  })
})

describe('the walk home (I8, § 2)', () => {
  it('lightest first; a new kind fills, a kind already home and a second of a kind merge', () => {
    let s = initialRaft(seeded(1), {
      shore: [5, 5, 3, 7, 2, 8],
      homes: [3],
    })
    ;[s] = board(s, idOf(s, 7))
    ;[s] = board(s, idOf(s, 3))
    expect(homePlan(s).map((h) => [h.weight, h.fill])).toEqual([
      [3, false],
      [7, true],
    ])
    s = initialRaft(seeded(1), { shore: [5, 5, 3, 7, 2, 8] })
    ;[s] = board(s, idOf(s, 5, 1))
    ;[s] = board(s, idOf(s, 5))
    expect(homePlan(s).map((h) => [h.weight, h.fill, h.seat])).toEqual([
      [5, true, 0],
      [5, false, 1],
    ])
  })

  it('homeOne takes the animal off its seat and puts its kind home, once', () => {
    let s = initialRaft(seeded(1), { shore: [7, 3, 6, 4, 8, 2], homes: [3] })
    ;[s] = board(s, idOf(s, 7))
    ;[s] = board(s, idOf(s, 3))
    for (const hop of homePlan(s)) s = homeOne(s, hop.id)
    expect(s.homes).toEqual([3, 7])
    expect(waitingWeights(s)).toEqual([6, 4, 8, 2])
    expect(Object.keys(s.animals)).toHaveLength(4)
  })

  it('the ninth kind fills the island', () => {
    let s = initialRaft(seeded(1), {
      shore: [9, 1, 6, 4, 8, 2],
      homes: [1, 2, 3, 4, 5, 6, 7, 8],
    })
    expect(islandIsFull(s)).toBe(false)
    ;[s] = board(s, idOf(s, 9))
    ;[s] = board(s, idOf(s, 1))
    for (const hop of homePlan(s)) s = homeOne(s, hop.id)
    expect(islandIsFull(s)).toBe(true)
  })

  it('a fresh shore and a refill carry a missing kind (Dave (1))', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed)
      const homes = [1, 2, 3, 4, 5, 6, 7, 8] as const
      const s = initialRaft(rng, { homes })
      expect(missingOf(s.homes)).toEqual([9])
      expect(waitingWeights(s)).toContain(9)
    }
  })
})

describe('the 20 raft (I12, I13)', () => {
  it('has 8 seats; ten aboard boards on; past twenty splashes; exactly twenty departs', () => {
    let s = initialRaft(seeded(1), {
      target: 20,
      shore: [7, 3, 6, 4, 8, 2],
    })
    expect(s.seats).toHaveLength(8)
    ;[s] = board(s, idOf(s, 7))
    ;[s] = board(s, idOf(s, 3))
    expect(s.total).toBe(10)
    expect(s.phase).toBe('loading')
    ;[s] = board(s, idOf(s, 6))
    expect(s.total).toBe(16)
    expect(board(s, idOf(s, 8))[1]).toBe('splash')
    const [d, r] = board(s, idOf(s, 4))
    expect(r).toBe('depart')
    expect(d.total).toBe(20)
  })

  it('a stuck 20 raft gets raftNewcomer’s weight after two splashes; boarding can reach 20', () => {
    // 9 + 9 aboard (18), waiting 5, 6, 7, 8: no sum makes 2.
    let s = initialRaft(seeded(1), {
      target: 20,
      shore: [9, 9, 5, 6, 7, 8],
    })
    ;[s] = board(s, idOf(s, 9))
    ;[s] = board(s, idOf(s, 9))
    expect(s.total).toBe(18)
    let r
    ;[s, r] = splash(s, idOf(s, 5))
    expect(r.newcomer).toBeNull()
    ;[s, r] = splash(s, idOf(s, 6))
    expect(r.newcomer).not.toBeNull()
    const w = s.animals[r.newcomer!]!.weight
    expect(w).toBe(playPlace.raftNewcomer([5, 6, 7, 8], 18, 20))
    expect(w).toBe(2)
    expect(board(s, r.newcomer!)[1]).toBe('depart')
  })
})

/** Two shore animals that make ten. */
function raftLoadPair(s: RaftState): [number, number] {
  const ids = s.spots.filter((x): x is number => x !== null)
  for (const a of ids) {
    for (const b of ids) {
      if (a !== b && s.animals[a]!.weight + s.animals[b]!.weight === 10) {
        return [a, b]
      }
    }
  }
  throw new Error('no pair')
}
