/**
 * Raft crossing's island goal, the record and the open rafts
 * (`design/native/raft-island-goal.md` § 11, ACs I4 and I5; the rules are
 * Dave's ruling of 2026-10-25, `design/research/raft-island-goal-2026-10-25.md`
 * (1) and (3)).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activateLearner,
  activeLearner,
  addLearner,
  ensureLearnerList,
  LEARNER_KEYS,
  learnerKey,
  resetLearnersForTests,
} from '../learners'
import { setKeyValueStore, type KeyValueStore } from '../platform/keyValueStore'
import { defaultProgress } from '../progress/defaults'
import { MATH_TREE } from '../progress/mastery'
import type { Progress, SkillNode } from '../progress/types'
import { RAFT_ANIMALS, type RaftWeight } from './playPlace'
import {
  emptyIslandRecord,
  islandFull,
  islandHome,
  islandMissing,
  loadIslandRecord,
  openRafts,
  RAFT_ISLAND_STORAGE_KEY,
  saveIslandRecord,
  type IslandRecord,
} from './raftIsland'

class MapStore implements KeyValueStore {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}

const KINDS: readonly RaftWeight[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/** Every math step before `current` mastered, `current` practicing. */
function mathAt(current: SkillNode): Progress {
  const p = defaultProgress()
  const i = (MATH_TREE as readonly SkillNode[]).indexOf(current)
  return {
    ...p,
    skillLevels: {
      ...p.skillLevels,
      ...Object.fromEntries(MATH_TREE.slice(0, i).map((n) => [n, 'mastered'])),
      [current]: 'practicing',
    } as Progress['skillLevels'],
  }
}

const withKinds = (ten: RaftWeight[], twenty: RaftWeight[] = []) =>
  ({ 10: ten, 20: twenty }) satisfies IslandRecord

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  resetLearnersForTests()
  setKeyValueStore(null)
  vi.restoreAllMocks()
})

describe('the island record (Dave (1))', () => {
  it('starts empty: nine kinds missing on both islands, neither full', () => {
    expect(emptyIslandRecord()).toEqual({ 10: [], 20: [] })
    for (const target of [10, 20] as const) {
      expect(islandMissing(emptyIslandRecord(), target)).toEqual(KINDS)
      expect(islandFull(emptyIslandRecord(), target)).toBe(false)
    }
  })

  it('islandHome adds a new kind, ascending, to that island only; a kind already home changes nothing', () => {
    let rec = emptyIslandRecord()
    rec = islandHome(rec, 10, 9)
    rec = islandHome(rec, 10, 3)
    expect(rec).toEqual({ 10: [3, 9], 20: [] })
    expect(islandHome(rec, 10, 9)).toBe(rec)
    rec = islandHome(rec, 20, 9)
    expect(rec).toEqual({ 10: [3, 9], 20: [9] })
    expect(islandMissing(rec, 10)).toEqual([1, 2, 4, 5, 6, 7, 8])
  })

  it('the ninth kind fills the island, and a full island stays full', () => {
    let rec = emptyIslandRecord()
    for (const k of [5, 1, 9, 2, 8, 3, 7, 4] as const)
      rec = islandHome(rec, 10, k)
    expect(islandFull(rec, 10)).toBe(false)
    expect(islandMissing(rec, 10)).toEqual([6])
    rec = islandHome(rec, 10, 6)
    expect(islandFull(rec, 10)).toBe(true)
    expect(rec[10]).toEqual(KINDS)
    for (const k of KINDS) expect(islandHome(rec, 10, k)).toBe(rec)
    expect(islandFull(rec, 20)).toBe(false)
  })

  it('the kinds are the raft’s nine animals', () => {
    expect(KINDS.map((k) => RAFT_ANIMALS[k])).toEqual([
      'bee',
      'frog',
      'hen',
      'duck',
      'cat',
      'fox',
      'dog',
      'goat',
      'pig',
    ])
  })
})

describe('I4: openRafts (Dave (3))', () => {
  const full = withKinds([...KINDS])

  it('[] for null and for a learner without the raft', () => {
    expect(openRafts(null, full)).toEqual([])
    expect(openRafts(mathAt('number-recog'), full)).toEqual([])
    expect(openRafts(mathAt('number-recog'), emptyIslandRecord())).toEqual([])
  })

  it('[10] with fewer than nine kinds on the 10 island, whatever the 20 record holds', () => {
    const p = mathAt('add-to-10')
    expect(openRafts(p, emptyIslandRecord())).toEqual([10])
    expect(openRafts(p, withKinds([1, 2, 3, 4, 5, 6, 7, 8]))).toEqual([10])
    expect(
      openRafts(p, withKinds([1, 2, 3, 4, 5, 6, 7, 8], [...KINDS])),
    ).toEqual([10])
    expect(openRafts(p, withKinds([], [...KINDS]))).toEqual([10])
  })

  it('[10, 20] with all nine on the 10 island, whether or not adding to twenty is current', () => {
    for (const step of ['add-to-10', 'add-to-20', 'sub-to-10'] as const) {
      expect(openRafts(mathAt(step), full)).toEqual([10, 20])
    }
    const allMastered: Progress = {
      ...defaultProgress(),
      skillLevels: {
        ...defaultProgress().skillLevels,
        ...Object.fromEntries(MATH_TREE.map((n) => [n, 'mastered'])),
      } as Progress['skillLevels'],
    }
    expect(openRafts(allMastered, full)).toEqual([10, 20])
  })

  it('never [20] alone, over every way the two islands can be filled', () => {
    const p = mathAt('add-to-10')
    for (let mask10 = 0; mask10 < 512; mask10 += 7) {
      for (let mask20 = 0; mask20 < 512; mask20 += 31) {
        const of = (m: number) => KINDS.filter((_, i) => m & (1 << i))
        const open = openRafts(p, withKinds(of(mask10), of(mask20)))
        expect(open).toEqual(mask10 === 511 ? [10, 20] : [10])
      }
    }
    expect(openRafts(p, withKinds([...KINDS]))).toEqual([10, 20])
  })

  it('a record with all nine kinds never goes back to [10]: no kind leaves, and it reads back full', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    saveIslandRecord(full)
    let rec = loadIslandRecord()
    for (const k of KINDS) rec = islandHome(rec, 10, k)
    for (const k of KINDS) rec = islandHome(rec, 20, k)
    saveIslandRecord(rec)
    expect(openRafts(mathAt('add-to-10'), loadIslandRecord())).toEqual([10, 20])
  })
})

describe('I5: the record, per learner', () => {
  it('is one of the learner’s own keys', () => {
    expect(LEARNER_KEYS).toContain(RAFT_ISLAND_STORAGE_KEY)
  })

  it('round-trips through the learner-scoped store; learner B never reads learner A’s', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()
    const a = activeLearner()!
    const b = addLearner({
      name: 'Sam',
      avatarId: 'owl',
      start: { math: 1, wordSong: 1 },
    })
    activateLearner(a.id)
    const rec = islandHome(islandHome(emptyIslandRecord(), 10, 9), 10, 1)
    saveIslandRecord(rec)
    expect(loadIslandRecord()).toEqual(rec)
    expect(store.data.has(learnerKey(RAFT_ISLAND_STORAGE_KEY, a))).toBe(true)

    activateLearner(b.id)
    expect(loadIslandRecord()).toEqual(emptyIslandRecord())
    const other = islandHome(emptyIslandRecord(), 10, 5)
    saveIslandRecord(other)
    expect(store.data.has(`${RAFT_ISLAND_STORAGE_KEY}:${b.id}`)).toBe(true)

    activateLearner(a.id)
    expect(loadIslandRecord()).toEqual(rec)
    activateLearner(b.id)
    expect(loadIslandRecord()).toEqual(other)
  })

  it('writes only its own key, as JSON by island', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    saveIslandRecord(withKinds([1, 9], [5]))
    expect([...store.data.keys()]).toEqual([RAFT_ISLAND_STORAGE_KEY])
    expect(JSON.parse(store.data.get(RAFT_ISLAND_STORAGE_KEY)!)).toEqual({
      10: [1, 9],
      20: [5],
    })
  })

  it('an unreadable record reads as empty; a damaged island keeps its readable kinds', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    expect(loadIslandRecord()).toEqual(emptyIslandRecord())
    store.setItem(RAFT_ISLAND_STORAGE_KEY, '{not json')
    expect(loadIslandRecord()).toEqual(emptyIslandRecord())
    store.setItem(RAFT_ISLAND_STORAGE_KEY, JSON.stringify([1, 2]))
    expect(loadIslandRecord()).toEqual(emptyIslandRecord())
    store.setItem(
      RAFT_ISLAND_STORAGE_KEY,
      JSON.stringify({ 10: [9, 'x', 0, 10, 2.5, 3, 9], 20: 'pig' }),
    )
    expect(loadIslandRecord()).toEqual({ 10: [3, 9], 20: [] })
  })

  it('without a store, loads empty and saves nothing', () => {
    setKeyValueStore(null)
    expect(loadIslandRecord()).toEqual(emptyIslandRecord())
    expect(() => saveIslandRecord(withKinds([1]))).not.toThrow()
  })
})
