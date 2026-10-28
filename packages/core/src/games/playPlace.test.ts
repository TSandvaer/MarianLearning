import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultProgress } from '../progress/defaults'
import { LITERACY_TREE, MATH_TREE } from '../progress/mastery'
import type { Progress, SkillNode, WordSongNode } from '../progress/types'
import * as PlayPlace from './playPlace'
import {
  CRITTER_CAP,
  CRITTER_CLIP_WORDS,
  CRITTER_FUNNY_FROM,
  CRITTER_LEFT_OUT,
  CRITTER_NEVER_SAY,
  CRITTER_NOT_SAID,
  CRITTER_PICTURE_WORDS,
  CRITTER_REAL_WORDS,
  CRITTER_SAID_LATER,
  CRITTER_SAID_PICTURE_WORDS,
  critterHasPicture,
  critterPictureKey,
  CRITTER_SAID_WORDS,
  CRITTER_SOUND_SOURCE,
  CRITTER_WORDS_BY_STEP,
  critterFunnyOpen,
  critterPraise,
  critterRun,
  critterSet,
  CRITTER_PRAISE_WORDS,
  HUNT_FOUR_LESSON_WORDS,
  HUNT_FOUR_PICTURE_WORDS,
  HUNT_FOUR_TARGETS,
  openPlayGames,
  PLAY_GAMES,
  RAFT_ANIMALS,
  RAFT_LOAD,
  RAFT_SEATS,
  RAFT_SHORE_SIZE,
  RAFT_TARGETS,
  raftLoads,
  raftNewcomer,
  raftRefill,
  raftShore,
  raftStuck,
  type RaftTarget,
  type RaftWeight,
} from './playPlace'

/**
 * I1's refills (1,000 random waiting sets of 2-5 per target, 11 missing
 * sets each) that no newcomers can give every guarantee, so short of one:
 * all with 4 or 5 waiting (1 or 2 places). The brute force in I1 proves
 * each one short whatever walks in.
 */
const SHORT_10 = 686
const SHORT_20 = 1768

/** mulberry32: a small seeded generator, as the tests' `rng`. */
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

function withLevels(levels: Partial<Record<SkillNode, string>>): Progress {
  const p = defaultProgress()
  return {
    ...p,
    skillLevels: { ...p.skillLevels, ...levels } as Progress['skillLevels'],
  }
}

/** Every step before `current` in its tree mastered, `current` practicing. */
function currentAt(current: SkillNode): Partial<Record<SkillNode, string>> {
  const tree: readonly SkillNode[] = (
    MATH_TREE as readonly SkillNode[]
  ).includes(current)
    ? MATH_TREE
    : LITERACY_TREE
  const i = tree.indexOf(current)
  return {
    ...Object.fromEntries(tree.slice(0, i).map((n) => [n, 'mastered'])),
    [current]: 'practicing',
  }
}

const allMastered = (tree: readonly SkillNode[]) =>
  Object.fromEntries(tree.map((n) => [n, 'mastered']))

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])
const CRITTER_LETTERS = 'abcdefghijlmnoprstuvwx'.split('')

describe('PLAY_GAMES and openPlayGames (play-place spec § 1.1)', () => {
  it('has the raft at adding to ten and the critters at letter names, in tile order (Thomas 2026-10-22)', () => {
    expect(PLAY_GAMES).toEqual({
      raft: { opensAt: 'add-to-10' },
      critters: { opensAt: 'letter-names' },
    })
    expect(Object.keys(PLAY_GAMES)).toEqual(['raft', 'critters'])
  })

  it('C1: the critters open at Word Song’s first step, so every learner has them', () => {
    expect(LITERACY_TREE[0]).toBe(PLAY_GAMES.critters.opensAt)
  })

  it('C1: the default profile opens both', () => {
    expect(openPlayGames(defaultProgress())).toEqual(['raft', 'critters'])
  })

  it('C1: both open once letter sounds is mastered, and once both steps are mastered', () => {
    expect(openPlayGames(withLevels({ 'letter-sounds': 'mastered' }))).toEqual([
      'raft',
      'critters',
    ])
    expect(
      openPlayGames(
        withLevels({
          ...allMastered(MATH_TREE),
          ...allMastered(LITERACY_TREE),
        }),
      ),
    ).toEqual(['raft', 'critters'])
    expect(
      openPlayGames(
        withLevels({
          ...currentAt('sub-to-10'),
          ...currentAt('cvc-words-short-o'),
        }),
      ),
    ).toEqual(['raft', 'critters'])
  })

  it('C1: a learner on letter names or letter sounds has the critters (Thomas 2026-10-22)', () => {
    expect(
      openPlayGames(
        withLevels({ ...currentAt('add-to-10'), ...currentAt('letter-names') }),
      ),
    ).toEqual(['raft', 'critters'])
    expect(
      openPlayGames(
        withLevels({
          'number-recog': 'practicing',
          ...currentAt('letter-sounds'),
        }),
      ),
    ).toEqual(['critters'])
  })

  it('C1: the critters only, with numbers not mastered', () => {
    expect(
      openPlayGames(
        withLevels({
          'number-recog': 'practicing',
          ...currentAt('blending-cv'),
        }),
      ),
    ).toEqual(['critters'])
  })

  it('C1: the critters for a learner with every step locked; nothing for null', () => {
    const locked = Object.fromEntries(
      [...MATH_TREE, ...LITERACY_TREE].map((n) => [n, 'locked']),
    )
    expect(openPlayGames(withLevels(locked))).toEqual(['critters'])
    expect(openPlayGames(null)).toEqual([])
  })
})

describe('the raft (§ 2.1)', () => {
  const sum = (ws: readonly number[]) => ws.reduce((n, w) => n + w, 0)
  const pairLoads = (ws: readonly number[]) =>
    raftLoads(ws).filter((l) => l.length === 2)

  it('has the constants and the nine animals, small to big', () => {
    expect([RAFT_LOAD, RAFT_SHORE_SIZE]).toEqual([10, 6])
    expect(RAFT_ANIMALS).toEqual({
      1: 'bee',
      2: 'frog',
      3: 'hen',
      4: 'duck',
      5: 'cat',
      6: 'fox',
      7: 'dog',
      8: 'goat',
      9: 'pig',
    })
  })

  it('C3: raftLoads finds every set of positions that makes exactly ten', () => {
    expect(raftLoads([7, 3, 6, 4, 8, 2])).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ])
    expect(raftLoads([1, 2, 7, 9, 5, 5])).toEqual([
      [0, 1, 2],
      [0, 3],
      [4, 5],
    ])
    expect(raftLoads([9, 9])).toEqual([])
    expect(raftLoads([])).toEqual([])
    for (const load of raftLoads([1, 2, 3, 4, 5, 6])) {
      expect(sum(load.map((i) => [1, 2, 3, 4, 5, 6][i]!))).toBe(10)
    }
  })

  it('C3: raftStuck is true only when no waiting set fills the gap to ten', () => {
    expect(raftStuck([2, 5, 7, 9], 6)).toBe(true)
    expect(raftStuck([2, 5, 7, 9], 5)).toBe(false)
    expect(raftStuck([1, 3, 5, 9], 6)).toBe(false)
    for (const w of [[], [1], [2, 5, 7, 9], [9, 9, 9]]) {
      expect(raftStuck(w, 0)).toBe(false)
      expect(raftStuck(w, 10)).toBe(false)
    }
    expect(raftStuck([], 3)).toBe(true)
  })

  it('C2: raftShore gives 6 weights in 1-9 with at least 2 loads, one a pair, over 1,000 seeds', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const shore = raftShore(seeded(seed))
      expect(shore).toHaveLength(6)
      for (const w of shore) {
        expect(Number.isInteger(w)).toBe(true)
        expect(w).toBeGreaterThanOrEqual(1)
        expect(w).toBeLessThanOrEqual(9)
      }
      expect(raftLoads(shore).length).toBeGreaterThanOrEqual(2)
      expect(pairLoads(shore).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('C2: the same seed gives the same shore', () => {
    for (const seed of [1, 7, 42, 999]) {
      expect(raftShore(seeded(seed))).toEqual(raftShore(seeded(seed)))
    }
  })

  it('C2: raftRefill keeps the waiting weights in order and returns 6 with the same guarantee', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = seeded(seed)
      const n = 2 + Math.floor(rng() * 4)
      const waiting = Array.from({ length: n }, () => 1 + Math.floor(rng() * 9))
      const shore = raftRefill(waiting, rng)
      expect(shore).toHaveLength(6)
      expect(shore.slice(0, n)).toEqual(waiting)
      for (const w of shore) {
        expect(w).toBeGreaterThanOrEqual(1)
        expect(w).toBeLessThanOrEqual(9)
      }
      expect(raftLoads(shore).length).toBeGreaterThanOrEqual(2)
      expect(pairLoads(shore).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('C2: raftRefill passes the hard waiting sets (all one weight, no pair possible among them)', () => {
    for (const waiting of [
      [9, 9, 9, 9, 9],
      [1, 1, 1, 1, 1],
      [5, 5, 5, 5, 5],
      [9],
      [],
    ]) {
      const shore = raftRefill(waiting, seeded(3))
      expect(shore).toHaveLength(6)
      expect(shore.slice(0, waiting.length)).toEqual(waiting)
      expect(raftLoads(shore).length).toBeGreaterThanOrEqual(2)
      expect(pairLoads(shore).length).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('the raft island goal, core (raft-island-goal § 11.2, I1-I3)', () => {
  const KINDS: readonly RaftWeight[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const sum = (ws: readonly number[]) => ws.reduce((n, w) => n + w, 0)

  /** Some load to 20 is four animals that pair into ten and ten. */
  const tenAndTen = (ws: readonly number[]) =>
    raftLoads(ws, 20).some(
      (l) =>
        l.length === 4 && [1, 2, 3].some((j) => ws[l[0]!]! + ws[l[j]!]! === 10),
    )

  /** The plain guarantee: Dave (1) for 10, Dave (3) for 20. */
  function plainOk(ws: readonly number[], target: RaftTarget): boolean {
    const loads = raftLoads(ws, target)
    if (loads.length < 2) return false
    return target === 10 ? loads.some((l) => l.length === 2) : tenAndTen(ws)
  }

  /** Some load holds a missing kind (Dave (1)); nothing missing passes. */
  const bringsMissing = (
    ws: readonly number[],
    target: RaftTarget,
    missing: readonly number[],
  ) =>
    missing.length === 0 ||
    raftLoads(ws, target).some((l) => l.some((i) => missing.includes(ws[i]!)))

  const strictOk = (
    ws: readonly number[],
    target: RaftTarget,
    missing: readonly number[],
  ) => plainOk(ws, target) && bringsMissing(ws, target, missing)

  /** A random non-empty set of kinds. */
  function someMissing(rng: () => number): RaftWeight[] {
    const out = KINDS.filter(() => rng() < 0.5)
    return out.length > 0 ? out : [KINDS[Math.floor(rng() * 9)]!]
  }

  /** Whether any newcomers for the empty places pass `test` (brute force). */
  function canGive(
    waiting: readonly number[],
    test: (ws: number[]) => boolean,
  ): boolean {
    const empty = RAFT_SHORE_SIZE - waiting.length
    const fill = new Array<number>(empty).fill(1)
    for (;;) {
      if (test([...waiting, ...fill])) return true
      let i = 0
      while (i < empty && fill[i] === 9) fill[i++] = 1
      if (i === empty) return false
      fill[i]! += 1
    }
  }

  const inRange = (ws: readonly number[]) =>
    ws.every((w) => Number.isInteger(w) && w >= 1 && w <= 9)

  it('pins the names the native build uses (§ 11.1)', () => {
    expect(RAFT_TARGETS).toEqual([10, 20])
    expect(RAFT_SEATS).toEqual({ 10: 6, 20: 8 })
    expect(RAFT_LOAD).toBe(RAFT_TARGETS[0])
  })

  it('I1: raftShore(rng, { target: 10, missing }) gives 6 weights in 1-9, 2 loads, one a pair, and a load with a missing kind, over 1,000 seeds per case', () => {
    const cases: RaftWeight[][] = [[], ...KINDS.map((k) => [k])]
    for (const missing of cases) {
      for (let seed = 1; seed <= 1000; seed++) {
        const shore = raftShore(seeded(seed), { target: 10, missing })
        expect(shore).toHaveLength(6)
        expect(inRange(shore)).toBe(true)
        expect(strictOk(shore, 10, missing)).toBe(true)
      }
    }
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = seeded(seed)
      const missing = someMissing(rng)
      const shore = raftShore(rng, { target: 10, missing })
      expect(shore).toHaveLength(6)
      expect(strictOk(shore, 10, missing)).toBe(true)
    }
  }, 30_000)

  it('I1: raftShore(rng, { target: 20, missing }) gives 6 weights in 1-9, 2 loads to 20, a ten-and-ten load, and a load with a missing kind, over 1,000 seeds per case', () => {
    const cases: RaftWeight[][] = [[], ...KINDS.map((k) => [k])]
    for (const missing of cases) {
      for (let seed = 1; seed <= 1000; seed++) {
        const shore = raftShore(seeded(seed), { target: 20, missing })
        expect(shore).toHaveLength(6)
        expect(inRange(shore)).toBe(true)
        expect(strictOk(shore, 20, missing)).toBe(true)
      }
    }
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = seeded(seed)
      const missing = someMissing(rng)
      const shore = raftShore(rng, { target: 20, missing })
      expect(shore).toHaveLength(6)
      expect(strictOk(shore, 20, missing)).toBe(true)
    }
  }, 30_000)

  it('I1: the fallback is the canon shore, with a missing kind it lacks swapped in with its partner to ten (Dave (1), (3))', () => {
    // An rng stuck at 0 draws only bees and pigs: every draw fails a
    // missing cat, so both targets fall back.
    const stuck = () => 0
    const sorted = (ws: number[]) => [...ws].sort((a, b) => a - b)
    for (const target of RAFT_TARGETS) {
      expect(sorted(raftShore(stuck, { target, missing: [5] }))).toEqual([
        3, 4, 5, 5, 6, 7,
      ])
      // A missing kind the canon shore has needs no swap.
      expect(sorted(raftShore(stuck, { target, missing: [5, 8] }))).toEqual([
        2, 3, 4, 6, 7, 8,
      ])
    }
  })

  it('I1: the same seed gives the same shore, for both targets', () => {
    for (const target of RAFT_TARGETS) {
      for (const seed of [1, 7, 42, 999]) {
        const missing: RaftWeight[] = [9]
        expect(raftShore(seeded(seed), { target, missing })).toEqual(
          raftShore(seeded(seed), { target, missing }),
        )
        expect(raftRefill([4, 4], seeded(seed), { target, missing })).toEqual(
          raftRefill([4, 4], seeded(seed), { target, missing }),
        )
      }
    }
  })

  it('I1: raftRefill keeps the waiting weights in order and returns 6 with the same guarantees, for waiting sets of 2-5, whenever the empty places can give them', () => {
    // Some waiting sets cannot meet every guarantee whatever walks in: on
    // the 10 raft five pigs and a missing cat (one place, and a cat needs
    // a partner of 5); on the 20 raft five pigs (one place, no ten and
    // ten). There raftRefill keeps the plain guarantee if the places can
    // give it, else a load to the target if they can. `short` counts them.
    const short: Record<RaftTarget, number> = { 10: 0, 20: 0 }
    for (const target of RAFT_TARGETS) {
      for (let seed = 1; seed <= 1000; seed++) {
        const rng = seeded(seed)
        const n = 2 + Math.floor(rng() * 4)
        const waiting = Array.from(
          { length: n },
          () => 1 + Math.floor(rng() * 9),
        )
        const cases: RaftWeight[][] = [
          [],
          ...KINDS.map((k) => [k]),
          someMissing(rng),
        ]
        for (const missing of cases) {
          const shore = raftRefill(waiting, rng, { target, missing })
          expect(shore).toHaveLength(6)
          expect(shore.slice(0, n)).toEqual(waiting)
          expect(inRange(shore)).toBe(true)
          if (strictOk(shore, target, missing)) continue
          short[target]++
          expect(canGive(waiting, (ws) => strictOk(ws, target, missing))).toBe(
            false,
          )
          if (canGive(waiting, (ws) => plainOk(ws, target))) {
            expect(plainOk(shore, target)).toBe(true)
          } else if (
            canGive(waiting, (ws) => raftLoads(ws, target).length > 0)
          ) {
            expect(raftLoads(shore, target).length).toBeGreaterThan(0)
          }
        }
      }
    }
    expect(short).toEqual({ 10: SHORT_10, 20: SHORT_20 })
  }, 30_000)

  it('I1: in play, every 20 refill keeps every guarantee; a 10 refill may lack the missing-kind load (4 waiting), never the plain guarantee', () => {
    // 1,000 islands filled crossing by crossing: the shore with the
    // guarantee, a random load to the target leaves, its kinds come home,
    // the rest wait for the refill. No stuck newcomers.
    const kept: Record<RaftTarget, { refills: number; short: number }> = {
      10: { refills: 0, short: 0 },
      20: { refills: 0, short: 0 },
    }
    for (const target of RAFT_TARGETS) {
      for (let seed = 1; seed <= 1000; seed++) {
        const rng = seeded(seed)
        const home = new Set<number>()
        const missing = () => KINDS.filter((k) => !home.has(k))
        let shore = raftShore(rng, { target, missing: missing() })
        expect(strictOk(shore, target, missing())).toBe(true)
        while (home.size < 9) {
          const loads = raftLoads(shore, target)
          const load = loads[Math.floor(rng() * loads.length)]!
          for (const i of load) home.add(shore[i]!)
          const waiting = shore.filter((_, i) => !load.includes(i))
          shore = raftRefill(waiting, rng, { target, missing: missing() })
          kept[target].refills++
          expect(plainOk(shore, target)).toBe(true)
          if (!bringsMissing(shore, target, missing())) {
            kept[target].short++
            expect(target).toBe(10)
            expect(waiting).toHaveLength(4)
          }
        }
      }
    }
    expect(kept).toEqual({
      10: { refills: 8068, short: 77 },
      20: { refills: 5207, short: 0 },
    })
  }, 30_000)

  it('I1: raftRefill on the hard waiting sets, both targets', () => {
    expect(
      plainOk(raftRefill([9, 9, 9, 9, 9], seeded(3), { target: 10 }), 10),
    ).toBe(true)
    const pigs = raftRefill([9, 9, 9, 9, 9], seeded(3), { target: 20 })
    expect(pigs.slice(0, 5)).toEqual([9, 9, 9, 9, 9])
    expect(raftLoads(pigs, 20).length).toBeGreaterThan(0)
    for (const target of RAFT_TARGETS) {
      for (const waiting of [[1, 1, 1], [9, 9, 9], [5, 5, 5], [9], []]) {
        const shore = raftRefill(waiting, seeded(3), { target, missing: [1] })
        expect(shore.slice(0, waiting.length)).toEqual(waiting)
        expect(strictOk(shore, target, [1])).toBe(true)
      }
    }
  })

  it('I1: with no options, raftShore and raftRefill deal today’s shores draw for draw, except where no newcomer gives the plain guarantee', () => {
    // FNV-1a over the JSON of 1,000 shores, 1,000 refills and 6 hard
    // refills, by the shipped code at origin/main 4ccd7570: 28085 chars,
    // hash c252ff. None of them waits 5, 6, 7, 8 and 9, the one set that
    // changes (pinned in the next test).
    const out: number[][] = []
    for (let seed = 1; seed <= 1000; seed++) out.push(raftShore(seeded(seed)))
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = seeded(seed)
      const n = 2 + Math.floor(rng() * 4)
      const waiting = Array.from({ length: n }, () => 1 + Math.floor(rng() * 9))
      out.push(raftRefill(waiting, rng))
    }
    for (const waiting of [
      [9, 9, 9, 9, 9],
      [1, 1, 1, 1, 1],
      [5, 5, 5, 5, 5],
      [9],
      [],
      [1, 2, 3, 4, 9],
    ]) {
      out.push(raftRefill(waiting, seeded(3)))
    }
    const s = JSON.stringify(out)
    let hash = 0x811c9dc5
    for (let i = 0; i < s.length; i++) {
      hash ^= s.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
    expect([s.length, hash.toString(16)]).toEqual([28085, 'c252ff'])
    for (const seed of [1, 7, 42, 999]) {
      expect(raftShore(seeded(seed), { target: 10, missing: [] })).toEqual(
        raftShore(seeded(seed)),
      )
      expect(raftRefill([3, 8], seeded(seed), { target: 10 })).toEqual(
        raftRefill([3, 8], seeded(seed)),
      )
    }
  })

  it('I1: with no options, a refill for waiting 5, 6, 7, 8 and 9 gets a load (9 + 1), where today’s code gave the all-9 shore with none (Dave 2026-10-28)', () => {
    // No newcomer gives two loads here, so the plain guarantee cannot be
    // met; Dave's rule then asks for a load to the target.
    const shore = raftRefill([5, 6, 7, 8, 9], seeded(3))
    expect(shore).toEqual([5, 6, 7, 8, 9, 1])
    expect(raftLoads(shore).length).toBeGreaterThan(0)
  })

  it('I2: raftLoads to 20 on the canon shore is exactly 7 + 3 + 6 + 4, 7 + 3 + 8 + 2 and 6 + 4 + 8 + 2; to 10 it is today’s', () => {
    expect(raftLoads([7, 3, 6, 4, 8, 2], 20)).toEqual([
      [0, 1, 2, 3],
      [0, 1, 4, 5],
      [2, 3, 4, 5],
    ])
    for (const ws of [
      [7, 3, 6, 4, 8, 2],
      [1, 2, 7, 9, 5, 5],
      [9, 9],
      [],
      [1, 2, 3, 4, 5, 6],
    ]) {
      expect(raftLoads(ws, 10)).toEqual(raftLoads(ws))
    }
    // Every set of positions that makes the target, and nothing else.
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed)
      const ws = Array.from({ length: 6 }, () => 1 + Math.floor(rng() * 9))
      for (const target of RAFT_TARGETS) {
        const all: number[][] = []
        for (let mask = 1; mask < 64; mask++) {
          const set = [0, 1, 2, 3, 4, 5].filter((i) => mask & (1 << i))
          if (sum(set.map((i) => ws[i]!)) === target) all.push(set)
        }
        const key = (ls: number[][]) => ls.map((l) => l.join()).sort()
        expect(key(raftLoads(ws, target))).toEqual(key(all))
      }
    }
  })

  it('I3: on the 10 raft raftNewcomer is 10 − total when stuck (today’s rule), undefined when not', () => {
    expect(raftNewcomer([2, 5, 7, 9], 6, 10)).toBe(4)
    expect(raftNewcomer([2, 5, 7, 9], 5, 10)).toBeUndefined()
    expect(raftNewcomer([], 3, 10)).toBe(7)
    for (const w of [[], [1], [2, 5, 7, 9], [9, 9, 9]]) {
      expect(raftNewcomer(w, 0, 10)).toBeUndefined()
      expect(raftNewcomer(w, 10, 10)).toBeUndefined()
    }
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = seeded(seed)
      const waiting = Array.from(
        { length: Math.floor(rng() * 6) },
        () => 1 + Math.floor(rng() * 9),
      )
      const total = 1 + Math.floor(rng() * 9)
      expect(raftNewcomer(waiting, total, 10)).toBe(
        raftStuck(waiting, total) ? 10 - total : undefined,
      )
    }
  })

  it('I3: on the 20 raft a stuck raft gets gap − s in 1-9 for a sum s of waiting animals (Q4: s = 0 up to a gap of 9, else the smallest s from gap − 9), and the shore with it can reach 20', () => {
    expect(raftNewcomer([9, 9], 15, 20)).toBe(5)
    expect(raftNewcomer([9, 9, 9], 4, 20)).toBe(7)
    expect(raftNewcomer([9, 8], 1, 20)).toBe(2)
    expect(raftNewcomer([3, 3], 10, 20)).toBe(7)
    expect(raftNewcomer([5, 5], 10, 20)).toBeUndefined()
    // Stuck, but no one animal can close the gap.
    expect(raftNewcomer([1, 1], 1, 20)).toBeUndefined()
    for (const w of [[], [1], [9, 9, 9]]) {
      expect(raftNewcomer(w, 0, 20)).toBeUndefined()
      expect(raftNewcomer(w, 20, 20)).toBeUndefined()
    }
    const sumsOf = (ws: readonly number[]) => {
      let sums = new Set<number>([0])
      for (const w of ws)
        sums = new Set([...sums, ...[...sums].map((s) => s + w)])
      return sums
    }
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = seeded(seed)
      const waiting = Array.from(
        { length: Math.floor(rng() * 6) },
        () => 1 + Math.floor(rng() * 9),
      )
      const total = 1 + Math.floor(rng() * 19)
      const gap = 20 - total
      const sums = sumsOf(waiting)
      const got = raftNewcomer(waiting, total, 20)
      if (sums.has(gap)) {
        expect(got).toBeUndefined()
        continue
      }
      const s =
        gap <= 9
          ? 0
          : [...sums]
              .filter((x) => x >= gap - 9 && x < gap)
              .sort((a, b) => a - b)[0]
      expect(got).toBe(s === undefined ? undefined : gap - s)
      if (got !== undefined) {
        expect(got).toBeGreaterThanOrEqual(1)
        expect(got).toBeLessThanOrEqual(9)
        expect(sumsOf([...waiting, got]).has(gap)).toBe(true)
      }
    }
  })

  it('I3: on a 20 shore that met its guarantee, a stuck raft always gets a newcomer', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = seeded(seed)
      const shore = raftShore(rng, { target: 20 })
      // A random set aboard that is under 20; the rest wait.
      const mask = Math.floor(rng() * 64)
      const aboard = shore.filter((_, i) => mask & (1 << i))
      const total = sum(aboard)
      if (total < 1 || total >= 20) continue
      const waiting = shore.filter((_, i) => !(mask & (1 << i)))
      if (raftStuck(waiting, total, 20)) {
        expect(raftNewcomer(waiting, total, 20)).toBeDefined()
      } else {
        expect(raftNewcomer(waiting, total, 20)).toBeUndefined()
      }
    }
  })
})

/** The `word.p*.blend` words of a canon step file (K4: read in the test only). */
function canonBlendWords(step: WordSongNode): string[] {
  const canon = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'public',
        'canon',
        'word-song',
        'level-1',
        `${step}.json`,
      ),
      'utf8',
    ),
  ) as { plan: { utterances: { id: string; text: string }[] } }
  return canon.plan.utterances
    .filter((u) => /^word\.p\d+\.blend$/.test(u.id))
    .map((u) => u.text.split('...').pop()!.trim())
}

/** A canon step file's problems: each `word.pN`'s blend word and correct line. */
function canonPraise(step: WordSongNode): { word: string; correct: string }[] {
  const canon = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'public',
        'canon',
        'word-song',
        'level-1',
        `${step}.json`,
      ),
      'utf8',
    ),
  ) as { plan: { utterances: { id: string; text: string }[] } }
  const text = (id: string) =>
    canon.plan.utterances.find((u) => u.id === id)?.text
  return canon.plan.utterances
    .filter((u) => /^word\.p\d+\.blend$/.test(u.id))
    .map((u) => ({
      word: u.text.split('...').pop()!.trim(),
      correct: text(u.id.replace(/blend$/, 'correct'))!,
    }))
}

/**
 * The pack pictures the app bundles: the picture keys of
 * `mobile/src/assets/registry.ts`, the map `pictureAsset(key)` reads.
 */
function bundledPictures(): Set<string> {
  const registry = readFileSync(
    join(process.cwd(), 'mobile', 'src', 'assets', 'registry.ts'),
    'utf8',
  )
  const keys = registry.matchAll(
    /'\/(?:assets\/pictures\/picture-([a-z]+)\.svg|native\/pictures\/([a-z]+))'/g,
  )
  return new Set([...keys].map((m) => m[1] ?? m[2]!))
}

const CVC_STEPS: readonly WordSongNode[] = [
  'blending-cv',
  'sounding-out',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
]

const ALL_45 = [
  ...new Set(Object.values(CRITTER_WORDS_BY_STEP).flatMap((ws) => ws!)),
].sort()

/** The words of the CVC steps up to and including `last`, sorted. */
const wordsThrough = (last: WordSongNode) =>
  [
    ...new Set(
      CVC_STEPS.slice(0, CVC_STEPS.indexOf(last) + 1).flatMap(
        (s) => CRITTER_WORDS_BY_STEP[s]!,
      ),
    ),
  ].sort()

describe('the critters (§ 3.1)', () => {
  it('C4: each step’s words are its canon blend words, minus gem', () => {
    expect(CRITTER_LEFT_OUT).toEqual(['gem'])
    expect(Object.keys(CRITTER_WORDS_BY_STEP)).toEqual(CVC_STEPS)
    for (const step of CVC_STEPS) {
      const canon = canonBlendWords(step)
      expect(canon).toHaveLength(8)
      expect(CRITTER_WORDS_BY_STEP[step]).toEqual(
        canon.filter((w) => !CRITTER_LEFT_OUT.includes(w)).sort(),
      )
    }
    expect(ALL_45).toHaveLength(45)
  })

  it('C4: § 3.1’s table, row by row', () => {
    expect(CRITTER_WORDS_BY_STEP).toEqual({
      'blending-cv': ['bag', 'cat', 'fan', 'hat', 'man', 'pan', 'tag', 'van'],
      'sounding-out': ['bat', 'can', 'cap', 'dad', 'fan', 'jam', 'man', 'mat'],
      'cvc-words': ['bag', 'cat', 'fan', 'hat', 'man', 'pan', 'tag', 'van'],
      'cvc-words-short-o': [
        'box',
        'cot',
        'dog',
        'fox',
        'hot',
        'log',
        'mop',
        'pot',
      ],
      'cvc-words-short-u': [
        'bug',
        'bus',
        'cup',
        'jug',
        'nut',
        'rug',
        'sun',
        'tub',
      ],
      'cvc-words-short-i': [
        'bib',
        'bin',
        'fig',
        'lid',
        'pig',
        'pin',
        'sip',
        'wig',
      ],
      'cvc-words-short-e': ['bed', 'hen', 'jet', 'leg', 'net', 'pen', 'web'],
    })
  })

  it('C5: CRITTER_PICTURE_WORDS is all 45 words, sorted, over the 22 letters, with no step gate (Thomas 2026-10-22)', () => {
    expect(CRITTER_PICTURE_WORDS).toEqual(ALL_45)
    expect(CRITTER_PICTURE_WORDS).toHaveLength(45)
    expect(new Set(CRITTER_PICTURE_WORDS.join('')).size).toBe(22)
    // The step gate is gone: no learner-dependent word list is exported.
    expect(Object.keys(PlayPlace)).not.toContain('critterWords')
    // § 3.1's per-step shapes still hold for the step table itself.
    const shapes: [WordSongNode, number, number][] = [
      ['blending-cv', 8, 11],
      ['cvc-words', 14, 13],
      ['cvc-words-short-o', 22, 16],
      ['cvc-words-short-u', 30, 19],
      ['cvc-words-short-i', 38, 21],
      ['cvc-words-short-e', 45, 22],
    ]
    for (const [step, words, letters] of shapes) {
      expect(wordsThrough(step)).toHaveLength(words)
      expect(new Set(wordsThrough(step).join('')).size).toBe(letters)
    }
  })

  it('C5: critterSet keeps at most 16 letters, every vowel, only words they spell, a word per consonant', () => {
    expect(CRITTER_CAP).toBe(16)
    for (const words of [
      wordsThrough('cvc-words-short-u'),
      wordsThrough('cvc-words-short-i'),
      CRITTER_PICTURE_WORDS,
    ]) {
      const vowels = [...new Set(words.join(''))].filter((l) => VOWELS.has(l))
      for (let seed = 1; seed <= 1000; seed++) {
        const set = critterSet(words, seeded(seed))
        expect(set.letters.length).toBeLessThanOrEqual(16)
        expect(new Set(set.letters).size).toBe(set.letters.length)
        for (const v of vowels) expect(set.letters).toContain(v)
        const have = new Set(set.letters)
        expect(set.words).toEqual(
          words.filter((w) => [...w].every((l) => have.has(l))),
        )
        for (const c of set.letters.filter((l) => !VOWELS.has(l))) {
          expect(set.words.some((w) => w.includes(c))).toBe(true)
        }
      }
    }
  })

  it('C5: the meadow needs no Word Song step: any learner’s visit has 16 critters and words to build (Thomas 2026-10-22)', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const set = critterSet(CRITTER_PICTURE_WORDS, seeded(seed))
      expect(set.letters).toHaveLength(CRITTER_CAP)
      expect(set.words.length).toBeGreaterThan(0)
      for (const w of set.words) expect(critterRun(w)).toBe('picture')
    }
  })

  it('C5 (Thomas 2026-10-23, build 20): with no cap (a tablet), critterSet keeps all 22 letters and all 45 words on every visit, no rotation', () => {
    const meadow = [
      ...'aeiou',
      ...CRITTER_LETTERS.filter((l) => !VOWELS.has(l)),
    ]
    for (let seed = 1; seed <= 1000; seed++) {
      const set = critterSet(CRITTER_PICTURE_WORDS, seeded(seed), {
        cap: Infinity,
      })
      expect(set.letters).toEqual(meadow)
      expect(set.words).toEqual(CRITTER_PICTURE_WORDS)
    }
    // With no option, still the phone's cap.
    expect(critterSet(CRITTER_PICTURE_WORDS, seeded(1)).letters).toHaveLength(
      CRITTER_CAP,
    )
  })

  it('C5: with 16 letters or fewer, critterSet keeps them all, vowels first, then alphabetical', () => {
    const words = wordsThrough('cvc-words-short-o')
    const set = critterSet(words, seeded(5))
    expect(set.letters).toEqual([
      'a',
      'o',
      'b',
      'c',
      'd',
      'f',
      'g',
      'h',
      'j',
      'l',
      'm',
      'n',
      'p',
      't',
      'v',
      'x',
    ])
    expect(set.words).toEqual(words)
  })

  it('C6: CRITTER_SOUND_SOURCE follows § 3.4’s rule and equals its table', () => {
    const table = {
      a: { word: 'bag', index: 1 },
      e: { word: 'bed', index: 1 },
      i: { word: 'bib', index: 1 },
      o: { word: 'box', index: 1 },
      u: { word: 'bug', index: 1 },
      b: { word: 'bag', index: 0 },
      c: { word: 'can', index: 0 },
      d: { word: 'dad', index: 0 },
      f: { word: 'fan', index: 0 },
      h: { word: 'hat', index: 0 },
      j: { word: 'jam', index: 0 },
      l: { word: 'leg', index: 0 },
      m: { word: 'man', index: 0 },
      n: { word: 'net', index: 0 },
      p: { word: 'pan', index: 0 },
      r: { word: 'rug', index: 0 },
      s: { word: 'sip', index: 0 },
      t: { word: 'tag', index: 0 },
      v: { word: 'van', index: 0 },
      w: { word: 'web', index: 0 },
      g: { word: 'bag', index: 2 },
      x: { word: 'box', index: 2 },
    }
    expect(CRITTER_SOUND_SOURCE).toEqual(table)
    // The rule, recomputed from the 45 words.
    const ruled: Record<string, { word: string; index: number }> = {}
    for (const l of CRITTER_LETTERS) {
      const at = (i: number) => ALL_45.find((w) => w[i] === l)
      const index = VOWELS.has(l) ? 1 : at(0) !== undefined ? 0 : 2
      ruled[l] = { word: at(index)!, index }
    }
    expect(ruled).toEqual(table)
    for (const [l, src] of Object.entries(CRITTER_SOUND_SOURCE)) {
      expect(ALL_45).toContain(src.word)
      expect(src.word[src.index]).toBe(l)
    }
  })
})

/** § 3.1's printed list, as printed (C10: pinned exactly). */
const PRINTED_REAL_WORDS = `
bad bag ban bar bat cab can cap car cat dab dad dam fad fag fan far fat fax gag gap gas had hag ham
has hat jab jam jar jaw lab lad lag lap lax mad man map mat nab nag nan nap pad pal pan pat paw rag
ram ran rap rat raw sad sag sap sat saw sax tab tag tan tap tax van vat wag was wax
bed beg bet den fed few gem get hem hen her hex jet led leg let men met net new peg pen pet red set
sex ten vet vex web wed wet
bib bid big bin bit did dig dim din dip fib fig fin fit fix gig gin git hid him hip his hit jig lid
lip lit mix nib nip pig pin pit rib rid rig rim rip sin sip sir sis sit six tin tip tit wig win wit
bob bog bow box cob cod cog cop cot cow dog dot fog for fox god got hob hog hop hot how job jog jot
lob log lot low mob mom mop nod not now pod pop pot rob rod rot row sob son ton top tot won wow
bud bug bum bun bus but cub cum cup cut dud dug fun fur gum gun gut hub hug huh hum hut jug jut lug
mud mug mum nun nut pub pug pun pup pus put rub rug rum run rut sub sum sun tub tug
all and are ass bee eat egg one out pee poo see she the too two wee
owl own old arm art ash who flu act add ant elf end ill its odd off
`
  .trim()
  .split(/\s+/)

/** Dave's word hunt ruling (2026-10-25, § 6): his 17 text-only words, owl among them. */
const NEW_17 =
  'owl own old arm art ash who flu act add ant elf end ill its odd off'.split(
    ' ',
  )

/** The eight of them that still sing and sit; F7 gave the other nine clips. */
const STILL_QUIET_8 = 'owl own old arm art ash who flu'.split(' ')

/** A consonant, a vowel and a consonant: § 3.1's CVC words. */
const isCvc = (w: string) =>
  !VOWELS.has(w[0]!) && VOWELS.has(w[1]!) && !VOWELS.has(w[2]!)

describe('CRITTER_REAL_WORDS and critterRun (§ 3.1, D5)', () => {
  it('C10: is exactly § 3.1’s 282 words (Dave 2026-10-25; the word hunt ruling’s 17)', () => {
    expect([...CRITTER_REAL_WORDS].sort()).toEqual(
      [...PRINTED_REAL_WORDS].sort(),
    )
    expect(CRITTER_REAL_WORDS.size).toBe(282)
    const perVowel: Record<string, number> = {}
    for (const w of [...CRITTER_REAL_WORDS].filter(isCvc))
      perVowel[w[1]!] = (perVowel[w[1]!] ?? 0) + 1
    expect(perVowel).toEqual({ a: 71, e: 32, i: 50, o: 49, u: 46 })
  })

  it('C10 (Dave 2026-10-25): each is 3 letters from the 22 critter letters; 248 CVC words and 34 others', () => {
    for (const w of CRITTER_REAL_WORDS) {
      expect(w).toMatch(/^[a-z]{3}$/)
      for (const l of w) expect(CRITTER_LETTERS).toContain(l)
    }
    expect([...CRITTER_REAL_WORDS].filter(isCvc)).toHaveLength(248)
    expect([...CRITTER_REAL_WORDS].filter((w) => !isCvc(w)).sort()).toEqual(
      [
        'all',
        'and',
        'are',
        'ass',
        'bee',
        'eat',
        'egg',
        'one',
        'out',
        'pee',
        'poo',
        'see',
        'she',
        'the',
        'too',
        'two',
        'wee',
        // Dave's word hunt ruling (2026-10-25, § 6).
        ...NEW_17,
      ].sort(),
    )
  })

  it('C10: holds all 45 picture words and gem', () => {
    expect(ALL_45.filter((w) => !CRITTER_REAL_WORDS.has(w))).toEqual([])
    expect(CRITTER_REAL_WORDS.has('gem')).toBe(true)
  })

  it('C10: CRITTER_NEVER_SAY and CRITTER_NOT_SAID are Dave’s lists, real words, no picture word (Dave 2026-10-22, 2026-10-25)', () => {
    expect([...CRITTER_NEVER_SAY].sort()).toEqual([
      'ass',
      'bum',
      'cum',
      'dam',
      'fag',
      'git',
      'god',
      'gun',
      'hag',
      'pee',
      'poo',
      'sex',
      'tit',
      'wee',
    ])
    expect([...CRITTER_NOT_SAID].sort()).toEqual(
      [
        // Dave 2026-10-22.
        'gem',
        'gin',
        'has',
        'his',
        'put',
        'rum',
        'son',
        'was',
        'won',
        // Dave 2026-10-25: CVC words whose letters don't sing the vowel.
        'car',
        'for',
        'bar',
        'far',
        'jar',
        'her',
        'sir',
        'fur',
        'cow',
        'how',
        'now',
        'wow',
        'bow',
        'row',
        'low',
        'saw',
        'paw',
        'jaw',
        'raw',
        'new',
        'few',
        'ton',
        'huh',
        // Dave 2026-10-25: other 3-letter words.
        'the',
        'see',
        'she',
        'bee',
        'are',
        'all',
        'two',
        'one',
        'too',
        'out',
        'eat',
        // Dave's word hunt ruling (2026-10-25, § 6): owl and 7 more; the
        // other nine left with their clips (critters four-letter F7).
        ...STILL_QUIET_8,
      ].sort(),
    )
    expect(CRITTER_NEVER_SAY.size).toBe(14)
    expect(CRITTER_NOT_SAID.size).toBe(51)
    for (const w of [...CRITTER_NEVER_SAY, ...CRITTER_NOT_SAID]) {
      expect(CRITTER_REAL_WORDS.has(w)).toBe(true)
      expect(ALL_45).not.toContain(w)
    }
    expect(
      [...CRITTER_NEVER_SAY].filter((w) => CRITTER_NOT_SAID.has(w)),
    ).toEqual([])
  })

  it('C10: CRITTER_SAID_WORDS is every other real word that is not a picture word: 172, sorted', () => {
    expect(CRITTER_SAID_WORDS).toHaveLength(172)
    expect(CRITTER_SAID_WORDS).toEqual([...CRITTER_SAID_WORDS].sort())
    expect(new Set(CRITTER_SAID_WORDS).size).toBe(172)
    expect([...CRITTER_SAID_WORDS].sort()).toEqual(
      [...CRITTER_REAL_WORDS]
        .filter(
          (w) =>
            !ALL_45.includes(w) &&
            !CRITTER_NEVER_SAY.has(w) &&
            !CRITTER_NOT_SAID.has(w),
        )
        .sort(),
    )
    // 282 = 45 pictures + 14 never said + 51 not said + 172 said.
    expect(45 + CRITTER_NEVER_SAY.size + CRITTER_NOT_SAID.size + 172).toBe(282)
    for (const w of ['map', 'cab', 'ham', 'sat', 'hop', 'six', 'win'])
      expect(CRITTER_SAID_WORDS).toContain(w)
    // Dave 2026-10-25: the seven new said words; mum stays said.
    expect(
      ['mom', 'rag', 'did', 'nan', 'sis', 'egg', 'and', 'mum'].filter(
        (w) => !CRITTER_SAID_WORDS.includes(w),
      ),
    ).toEqual([])
  })

  it('C10 (Thomas 2026-10-23, build 20): CRITTER_SAID_PICTURE_WORDS is exactly the said words with a bundled pack picture: 31, sorted', () => {
    const bundled = bundledPictures()
    // The registry read works: every picture word's picture is found.
    for (const w of ALL_45) expect(bundled.has(w)).toBe(true)
    // The probe reserve's pictured said words pop like rat (Thomas
    // 2026-10-24): cab, ham, pad and ram; and mom, rag and egg (Dave
    // 2026-10-25); and mum, with mom's picture, and the word hunt's four
    // new pictures, mug, sad, mud and hug (the word hunt ruling, § 6);
    // and ant and elf (critters four-letter F7, pictures in #709); and the
    // pictured-only boards' eight (Dave 2026-10-27, (A); #714): dot peg
    // red rod run six ten tug.
    expect(CRITTER_SAID_PICTURE_WORDS).toEqual([
      'ant',
      'bun',
      'cab',
      'dot',
      'egg',
      'elf',
      'gum',
      'ham',
      'hug',
      'hut',
      'map',
      'mom',
      'mud',
      'mug',
      'mum',
      'nap',
      'pad',
      'peg',
      'pop',
      'rag',
      'ram',
      'rat',
      'red',
      'rod',
      'run',
      'sad',
      'six',
      'tap',
      'ten',
      'top',
      'tug',
    ])
    expect(CRITTER_SAID_WORDS).toContain('rag')
    expect(CRITTER_SAID_PICTURE_WORDS).toEqual(
      CRITTER_SAID_WORDS.filter((w) => bundled.has(critterPictureKey(w))),
    )
    expect(critterPictureKey('mum')).toBe('mom')
    expect(critterPictureKey('mom')).toBe('mom')
    for (const w of CRITTER_SAID_PICTURE_WORDS) {
      expect(critterHasPicture(w)).toBe(true)
    }
    for (const w of ALL_45) expect(critterHasPicture(w)).toBe(true)
    expect(critterHasPicture('fun')).toBe(false)
    for (const w of CRITTER_SAID_PICTURE_WORDS)
      expect(critterRun(w)).toBe('word')
  })

  it('C10: critterRun: picture for all 45 (no step gate), word, quiet, funny', () => {
    for (const w of ALL_45) expect(critterRun(w)).toBe('picture')
    for (const w of ['map', 'cab', 'ham', 'sat', 'hop'])
      expect(critterRun(w)).toBe('word')
    for (const w of CRITTER_SAID_WORDS) expect(critterRun(w)).toBe('word')
    for (const w of [...CRITTER_NEVER_SAY, ...CRITTER_NOT_SAID])
      expect(critterRun(w)).toBe('quiet')
    for (const w of ['tup', 'baf', 'gub', 'vop'])
      expect(critterRun(w)).toBe('funny')
  })

  it('C10 (Dave 2026-10-25, Thomas build 21: "mom" tumbled): mom and egg are said, car and poo sing and sit, a non-word is still funny', () => {
    for (const w of ['mom', 'rag', 'did', 'nan', 'sis', 'egg', 'and', 'mum'])
      expect(critterRun(w)).toBe('word')
    for (const w of ['car', 'cow', 'saw', 'new', 'ton', 'huh', 'the', 'see'])
      expect(critterRun(w)).toBe('quiet')
    for (const w of ['poo', 'pee', 'wee', 'ass'])
      expect(critterRun(w)).toBe('quiet')
    for (const w of ['mup', 'egb', 'baf', 'aaa'])
      expect(critterRun(w)).toBe('funny')
  })

  it('critters four-letter content (Dave 2026-10-26, (B); Dave 2026-10-27, (A)): HUNT_FOUR_TARGETS is his 82 and the 15 of the pictured-only boards, the nine said later are said (F7), and every one has a clip word', () => {
    const byVowel = (v: string) =>
      [...HUNT_FOUR_TARGETS].filter((w) => w.includes(v))
    expect(HUNT_FOUR_TARGETS.size).toBe(97)
    // 82 (a 18, o 15, i 7, u 19, e 23), then a + 10, o + 4, e + 1.
    expect(['a', 'o', 'i', 'u', 'e'].map((v) => byVowel(v).length)).toEqual([
      28, 19, 7, 19, 24,
    ])
    for (const w of HUNT_FOUR_TARGETS) {
      // One short vowel, over the 22 critter letters, never hump.
      expect(w).toMatch(/^[bcdfghjlmnprstvwx]*[aeiou][bcdfghjlmnprstvwx]*$/)
      expect(w).toHaveLength(4)
    }
    expect(HUNT_FOUR_TARGETS.has('hump')).toBe(false)
    // F7: the nine left CRITTER_NOT_SAID with their clips, so Emma says
    // them after a run of three.
    expect(CRITTER_SAID_LATER).toEqual(
      'act add ant elf end ill its odd off'.split(' '),
    )
    for (const w of CRITTER_SAID_LATER) {
      expect(CRITTER_NOT_SAID.has(w)).toBe(false)
      expect(CRITTER_SAID_WORDS).toContain(w)
      expect(critterRun(w)).toBe('word')
    }
    expect(CRITTER_CLIP_WORDS).toEqual(
      [...CRITTER_SAID_WORDS, ...HUNT_FOUR_TARGETS].sort(),
    )
    expect(CRITTER_CLIP_WORDS).toHaveLength(269)
  })

  it('F24 (pictured-only boards, Dave 2026-10-27, (A) and (C)): the 14 voiceless plurals and crab are four-letter targets with a clip word, said after a run of four; the holding lists are gone', () => {
    const fifteen =
      'ants bats caps cats cots crab hats jets maps mats mops pots rats taps tops'.split(
        ' ',
      )
    for (const w of fifteen) {
      expect(CRITTER_CLIP_WORDS).toContain(w)
      expect(HUNT_FOUR_TARGETS.has(w)).toBe(true)
      expect(critterRun(w)).toBe('word')
    }
    expect(HUNT_FOUR_TARGETS.size).toBe(97)
    expect('HUNT_FOUR_LATER' in PlayPlace).toBe(false)
    expect('CRITTER_PICTURES_WIRED_LATER' in PlayPlace).toBe(false)
  })

  it('F8 (critters four-letter § 1): a run of four is word for a HUNT_FOUR_TARGETS word and quiet for every other, never picture or funny', () => {
    // Every run over the 22 letters, both ways; one expect at the end (an
    // expect per run timed out on CI's runner).
    const kinds = new Map<string, number>()
    const wrong: string[] = []
    for (const a of CRITTER_LETTERS)
      for (const b of CRITTER_LETTERS)
        for (const c of CRITTER_LETTERS)
          for (const d of CRITTER_LETTERS) {
            const run = a + b + c + d
            const want = HUNT_FOUR_TARGETS.has(run) ? 'word' : 'quiet'
            for (const funny of [true, false]) {
              const kind = critterRun(run, { funny })
              if (kind !== want) wrong.push(`${run}:${kind}`)
              kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
            }
          }
    expect(wrong).toEqual([])
    // 22^4 runs, twice: 97 words each time (82, the plurals and crab).
    expect(kinds.get('word')).toBe(2 * 97)
    expect(kinds.get('quiet')).toBe(2 * (22 ** 4 - 97))
    for (const w of ['send', 'dogs', 'shit', 'hump', 'tupx'])
      expect(critterRun(w)).toBe('quiet')
    for (const w of ['crab', 'cats']) expect(critterRun(w)).toBe('word')
  })

  it('F24: HUNT_FOUR_PICTURE_WORDS is exactly the four-letter targets with a bundled pack picture: 41 (the 11 lesson pictures, 14 of #709, and #714’s step and 14 plurals, and crab)', () => {
    const bundled = bundledPictures()
    expect(HUNT_FOUR_PICTURE_WORDS).toEqual(
      [...HUNT_FOUR_TARGETS].filter((w) => bundled.has(w)).sort(),
    )
    expect(HUNT_FOUR_PICTURE_WORDS).toHaveLength(41)
    for (const w of 'ants bats caps cats cots crab hats jets maps mats mops pots rats step taps tops'.split(
      ' ',
    ))
      expect(HUNT_FOUR_PICTURE_WORDS).toContain(w)
    for (const w of HUNT_FOUR_PICTURE_WORDS) {
      expect(critterPictureKey(w)).toBe(w)
      expect(critterHasPicture(w)).toBe(true)
    }
    expect(critterHasPicture('flap')).toBe(false)
  })

  it('C10 (Dave’s safeguard, Thomas 2026-10-22): with funny false, a non-word is quiet; every other run is unchanged', () => {
    const off = { funny: false }
    for (const w of ['tup', 'baf', 'gub', 'vop'])
      expect(critterRun(w, off)).toBe('quiet')
    for (const w of ALL_45) expect(critterRun(w, off)).toBe('picture')
    for (const w of CRITTER_SAID_WORDS) expect(critterRun(w, off)).toBe('word')
    for (const w of [...CRITTER_NEVER_SAY, ...CRITTER_NOT_SAID])
      expect(critterRun(w, off)).toBe('quiet')
    expect(critterRun('tup', { funny: true })).toBe('funny')
  })

  it('critterPraise (Thomas 2026-10-25, Dave): each picture word’s praise is a lesson’s own correct line for it; none for any other run', () => {
    const lessons = CVC_STEPS.flatMap(canonPraise)
    for (const w of ALL_45) {
      const praise = critterPraise(w)
      expect(lessons.some((l) => l.word === w && l.correct === praise)).toBe(
        true,
      )
    }
    expect(
      ALL_45.filter((w) => critterPraise(w) !== `Yes! That's a ${w}.`),
    ).toEqual(['dad', 'hot', 'jam'])
    expect(critterPraise('dad')).toBe('Yes! Dad!')
    expect(critterPraise('hot')).toBe('Yes! Hot.')
    expect(critterPraise('jam')).toBe('Yes! Jam!')
    expect(critterPraise('fan')).toBe("Yes! That's a fan.")
    for (const w of ['map', 'mom', 'egg', 'sex', 'car', 'tup'])
      expect(critterPraise(w)).toBeUndefined()
  })

  it('F9: critterPraise gives the 11 four-letter lesson words their lesson’s own correct line (crab and tent words); no other four-letter word has one', () => {
    const lessonCorrect = (step: string) => {
      const canon = JSON.parse(
        readFileSync(
          join(
            process.cwd(),
            'public',
            'canon',
            'word-song',
            'level-1',
            `${step}.json`,
          ),
          'utf8',
        ),
      ) as { plan: { utterances: { id: string; text: string }[] } }
      return canon.plan.utterances
        .filter((u) => /^word\.p\d+\.correct$/.test(u.id))
        .map((u) => u.text)
    }
    const lines = [
      ...lessonCorrect('crab-words'),
      ...lessonCorrect('tent-words'),
    ]
    expect(HUNT_FOUR_LESSON_WORDS).toEqual(
      'belt drum flag frog gift hand lamp nest plum pond tent'.split(' '),
    )
    for (const w of HUNT_FOUR_LESSON_WORDS) {
      expect(HUNT_FOUR_TARGETS.has(w)).toBe(true)
      expect(critterPraise(w)).toBe(`Yes! That's a ${w}.`)
      expect(lines).toContain(critterPraise(w))
    }
    // The lessons' other words are not four-letter critter words, but for
    // crab (a target since Dave 2026-10-27, (A)), which gets no praise.
    expect(
      lines
        .map((l) => /^Yes! That's a (\w+)\.$/.exec(l)![1]!)
        .filter((w) => HUNT_FOUR_TARGETS.has(w))
        .sort(),
    ).toEqual([...HUNT_FOUR_LESSON_WORDS, 'crab'].sort())
    expect(critterPraise('crab')).toBeUndefined()
    for (const w of HUNT_FOUR_TARGETS)
      if (!HUNT_FOUR_LESSON_WORDS.includes(w))
        expect(critterPraise(w)).toBeUndefined()
    expect(CRITTER_PRAISE_WORDS).toEqual(
      [...CRITTER_PICTURE_WORDS, ...HUNT_FOUR_LESSON_WORDS].sort(),
    )
    expect(CRITTER_PRAISE_WORDS).toHaveLength(56)
  })

  it('C10 (Dave’s safeguard): non-words are funny from blending sounds on, quiet before it and for null', () => {
    expect(CRITTER_FUNNY_FROM).toBe('blending-cv')
    expect(critterFunnyOpen(null)).toBe(false)
    expect(critterFunnyOpen(withLevels(currentAt('letter-names')))).toBe(false)
    expect(critterFunnyOpen(withLevels(currentAt('letter-sounds')))).toBe(false)
    expect(critterFunnyOpen(defaultProgress())).toBe(false)
    expect(critterFunnyOpen(withLevels(currentAt('blending-cv')))).toBe(true)
    expect(critterFunnyOpen(withLevels(currentAt('cvc-words-short-e')))).toBe(
      true,
    )
    expect(critterFunnyOpen(withLevels(allMastered(LITERACY_TREE)))).toBe(true)
  })
})
