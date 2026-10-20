/**
 * Raft crossing's model (play-place § 2.3; ACs N7, N7a, N8 at the model
 * level; the screen's timing is RaftCrossing.test.tsx's).
 */
import { RAFT_ANIMALS } from '@marian/core/games/playPlace'
import {
  arrive,
  board,
  initialRaft,
  refill,
  splashEnd,
  takeOff,
  tripOver,
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
    let s = initialRaft(seeded(1), [7, 3, 6, 4, 8, 2])
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
    let s = initialRaft(seeded(1), [7, 3, 6, 4, 8, 2])
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
    let s = initialRaft(seeded(1), [7, 3, 6, 4, 8, 2])
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
    let s = initialRaft(seeded(1), [6, 2, 5, 7, 9, 9])
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
    let s = initialRaft(seeded(1), [6, 2, 5, 7, 9, 4])
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

describe('crossings (N8)', () => {
  it('arrive lands the animals, never the same scene twice in a row; three crossings end the trip', () => {
    const rng = seeded(7)
    let s = initialRaft(rng, [7, 3, 6, 4, 8, 2])
    let last = null
    for (let k = 1; k <= 3; k++) {
      const pair = raftLoadPair(s)
      ;[s] = board(s, pair[0])
      ;[s] = board(s, pair[1])
      expect(s.phase).toBe('away')
      let scene
      ;[s, scene] = arrive(s, rng)
      expect(scene).not.toBe(last)
      last = scene
      expect(s.island).toHaveLength(2 * k)
      expect(s.crossings).toBe(k)
      if (k < 3) {
        expect(tripOver(s)).toBe(false)
        ;[s] = refill(s, rng, METRIC)
        expect(s.spots.filter((x) => x !== null)).toHaveLength(6)
        expect(s.phase).toBe('loading')
      }
    }
    expect(tripOver(s)).toBe(true)
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
