import { describe, expect, it } from 'vitest'
import { defaultProgress } from '../progress/defaults'
import { MATH_TREE } from '../progress/mastery'
import type { Progress, SkillNode } from '../progress/types'
import { flowerBedRound, GAMES, openGames } from './miniGames'

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

const DEFAULT = defaultProgress()
const ADD_TO_10_MASTERED = withLevels({
  'add-to-10': 'mastered',
  'add-to-20': 'practicing',
})
const GARDEN_COMPLETE = withLevels(
  Object.fromEntries(MATH_TREE.map((n) => [n, 'mastered'])),
)
const NUMBERS_NOT_MASTERED = withLevels({ 'number-recog': 'practicing' })

describe('GAMES (mini-game spec § 1.1)', () => {
  it('has the flower bed only, opening at adding to ten in Number Garden', () => {
    expect(GAMES).toEqual({
      'flower-bed': { world: 'math', opensAt: 'add-to-10' },
    })
  })
})

describe('openGames (§ 1.1)', () => {
  it('C1: the flower bed is open when adding to ten is current or mastered', () => {
    expect(openGames(DEFAULT, 'math')).toEqual(['flower-bed'])
    expect(openGames(ADD_TO_10_MASTERED, 'math')).toEqual(['flower-bed'])
    expect(openGames(GARDEN_COMPLETE, 'math')).toEqual(['flower-bed'])
  })

  it('C1: nothing is open before numbers is mastered, or without progress', () => {
    expect(openGames(NUMBERS_NOT_MASTERED, 'math')).toEqual([])
    expect(openGames(null, 'math')).toEqual([])
  })

  it('C2: Word Song has no game yet', () => {
    for (const p of [
      DEFAULT,
      ADD_TO_10_MASTERED,
      GARDEN_COMPLETE,
      NUMBERS_NOT_MASTERED,
      null,
    ]) {
      expect(openGames(p, 'word-song')).toEqual([])
    }
  })
})

describe('flowerBedRound (§ 2.1)', () => {
  it('C3: six beds of distinct givens 1-9, each with its missing part to ten', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const round = flowerBedRound(seeded(seed))
      expect(round).toHaveLength(6)
      const givens = round.map((b) => b.given)
      expect(new Set(givens).size).toBe(6)
      for (const bed of round) {
        expect(bed.given).toBeGreaterThanOrEqual(1)
        expect(bed.given).toBeLessThanOrEqual(9)
        expect(Number.isInteger(bed.given)).toBe(true)
        expect(bed.missing).toBe(10 - bed.given)
      }
    }
  })

  it("C3: every round holds the lesson's three, 7 + 3, 6 + 4 and 8 + 2", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const givens = flowerBedRound(seeded(seed)).map((b) => b.given)
      expect(givens).toEqual(expect.arrayContaining([6, 7, 8]))
    }
  })

  it('C3: the same seed gives the same round', () => {
    expect(flowerBedRound(seeded(42))).toEqual(flowerBedRound(seeded(42)))
  })

  it('C3: over 1,000 seeds every given appears, and bed 1 varies', () => {
    const seen = new Set<number>()
    const firsts = new Set<number>()
    for (let seed = 1; seed <= 1000; seed++) {
      const round = flowerBedRound(seeded(seed))
      round.forEach((b) => seen.add(b.given))
      firsts.add(round[0]!.given)
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(firsts.size).toBeGreaterThanOrEqual(6)
  })
})
