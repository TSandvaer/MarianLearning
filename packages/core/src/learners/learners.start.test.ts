// @vitest-environment node
/**
 * Learner profiles: start docs, moving a start, the 12 fallbacks, the
 * per-learner review baseline and routing (`design/native/learner-profiles.md`
 * §§ 4.8, 4.9, 6.1, ACs 16–19 and 23).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { setKeyValueStore, type KeyValueStore } from '../platform/keyValueStore'
import { defaultProgress } from '../progress/defaults'
import { landsOf } from '../progress/lands'
import { LITERACY_TREE, MATH_TREE } from '../progress/mastery'
import { reviewBaseline } from '../progress/reviewPlan'
import { STORAGE_KEY, loadProgress, saveProgress } from '../progress/storage'
import type { Progress, SkillNode } from '../progress/types'
import { nextAfterSplash } from '../router/nextAfterSplash'
import { recordProgressOnSessionEnd } from '../sessionEnd/progressHistory'
import {
  readSessionHistory,
  recordSessionEnd,
  writeSessionHistory,
} from '../sessionEnd/sessionHistory'
import { loadStardust, writeStardust } from '../shared/stardust'
import { progressAtStep } from '../debug/stepProgress'
import {
  activateLearner,
  activeLearner,
  addLearner,
  boundLearner,
  currentLand,
  ensureLearnerList,
  learnerStartProgress,
  loadLearnerList,
  nextAfterPick,
  resetLearnersForTests,
  setLearnerStart,
  startProgressForActive,
  type LearnerEntry,
} from './index'

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

const NOW = '2026-10-19T17:00:00.000Z'

function entry(start: LearnerEntry['start'], name = 'Sam'): LearnerEntry {
  return {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    name,
    avatarId: 'owl',
    language: 'en',
    legacySlot: false,
    start,
    createdAtISO: NOW,
  }
}

function levelsOf(p: Progress, tree: readonly SkillNode[]) {
  return Object.fromEntries(tree.map((n) => [n, p.skillLevels[n]]))
}

afterEach(() => {
  resetLearnersForTests()
  setKeyValueStore(null)
})

describe('learnerStartProgress (AC 16)', () => {
  it('{ math: 3, wordSong: 2 } → lands placed from the empty floor', () => {
    const p = learnerStartProgress(entry({ math: 3, wordSong: 2 }))
    expect(levelsOf(p, MATH_TREE)).toEqual({
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'mastered',
      'sub-to-20': 'mastered',
      'two-digit-addsub-no-regroup': 'intro',
      // Every later step locked, read from the tree so a new land's steps
      // don't break this.
      ...Object.fromEntries(MATH_TREE.slice(6).map((n) => [n, 'locked'])),
    })
    const ws = levelsOf(p, LITERACY_TREE)
    expect(ws['letter-names']).toBe('mastered')
    expect(ws['letter-sounds']).toBe('mastered')
    expect(ws['blending-cv']).toBe('intro')
    for (const node of LITERACY_TREE.slice(3)) expect(ws[node]).toBe('locked')
    // Past letter-sounds: all four short vowels mastered (progressAtStep's rule).
    expect(
      Object.values(p.literacy!.letterSoundsVowelStates!).every(
        (s) => s === 'mastered',
      ),
    ).toBe(true)
    expect(p.lifetimeFirstEncounters).toEqual(['letter-names', 'letter-sounds'])
    expect(p.profile.childName).toBe('Sam')
    expect(p.history).toEqual([])
  })

  it('no diagnostic level appears', () => {
    const p = learnerStartProgress(entry({ math: 1, wordSong: 1 }))
    expect(p.skillLevels['sub-to-10']).not.toBe('practicing')
    expect(p.skillLevels['add-to-10']).toBe('locked')
    expect(p.skillLevels['number-recog']).toBe('intro')
  })

  it("'legacy-default' → defaultProgress(), Marian's baseline", () => {
    const p = learnerStartProgress({
      ...entry('legacy-default', 'Marian'),
      legacySlot: true,
    })
    expect(p).toEqual(defaultProgress('Marian'))
  })
})

describe('setLearnerStart (AC 17, D1)', () => {
  it('moves one world down; keeps the other world and everything banked', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()
    const sam = addLearner({
      name: 'Sam',
      avatarId: 'owl',
      start: { math: 3, wordSong: 2 },
    })
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: '2026-10-18T10:00:00.000Z',
      focusNode: 'two-digit-addsub-no-regroup',
      leitnerOutcomes: [],
    })
    recordSessionEnd(
      1,
      undefined,
      () => new Date('2026-10-18T10:05:00.000Z'),
      2,
    )
    writeStardust(5)
    const io = boundLearner(sam)
    const before = io.load()!
    io.save({
      ...before,
      pendingPromotion: 'two-digit-addsub-no-regroup',
      goodDays: { 'two-digit-addsub-no-regroup': ['2026-10-18'] },
    })
    const saved = io.load()!
    const historyBefore = JSON.stringify(readSessionHistory())
    const stardustBefore = loadStardust().total

    setLearnerStart(sam.id, 'math', 1)

    const after = io.load()!
    expect(after.skillLevels['number-recog']).toBe('intro')
    for (const node of MATH_TREE.slice(1))
      expect(after.skillLevels[node]).toBe('locked')
    expect(levelsOf(after, LITERACY_TREE)).toEqual(
      levelsOf(saved, LITERACY_TREE),
    )
    expect(after.history).toEqual(saved.history)
    expect(after.mathFactsLeitner).toEqual(saved.mathFactsLeitner)
    expect(after.goodDays).toEqual(saved.goodDays)
    expect(after.pendingPromotion).toBeUndefined()
    expect(after.profile.lastPlayedISO).not.toBe(saved.profile.lastPlayedISO)
    expect(JSON.stringify(readSessionHistory())).toBe(historyBefore)
    expect(loadStardust().total).toBe(stardustBefore)
    const listed = loadLearnerList()!.learners.find((l) => l.id === sam.id)!
    expect(listed.start).toEqual({ math: 1, wordSong: 2 })
    expect(currentLand(after, 'math').number).toBe(1)
    expect(currentLand(after, 'word-song').number).toBe(2)
  })

  it('a pending promotion in the other world stays', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()
    const sam = addLearner({
      name: 'Sam',
      avatarId: 'owl',
      start: { math: 1, wordSong: 2 },
    })
    const io = boundLearner(sam)
    io.save({ ...io.load()!, pendingPromotion: 'blending-cv' })
    setLearnerStart(sam.id, 'math', 2)
    expect(io.load()!.pendingPromotion).toBe('blending-cv')
    expect(io.load()!.skillLevels['add-to-10']).toBe('intro')
  })

  it('moving Word Song down resets the vowels and first encounters it places', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()
    const sam = addLearner({
      name: 'Sam',
      avatarId: 'owl',
      start: { math: 1, wordSong: 3 },
    })
    setLearnerStart(sam.id, 'word-song', 1)
    const p = boundLearner(sam).load()!
    expect(p.skillLevels['letter-names']).toBe('intro')
    expect(
      Object.values(p.literacy!.letterSoundsVowelStates!).every(
        (s) => s === 'intro',
      ),
    ).toBe(true)
    expect(p.lifetimeFirstEncounters).toEqual([])
  })

  it('a finished world shows its last land', () => {
    const p = defaultProgress()
    for (const n of MATH_TREE) p.skillLevels[n] = 'mastered'
    expect(currentLand(p, 'math').number).toBe(landsOf('math').length)
    expect(currentLand(defaultProgress(), 'math').number).toBe(2)
  })
})

describe('fallbacks (AC 18, K7)', () => {
  it("with B's doc missing, a session end for B saves B's start doc, not the diagnostic", () => {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()
    const sam = addLearner({
      name: 'Sam',
      avatarId: 'owl',
      start: { math: 1, wordSong: 1 },
    })
    store.data.delete(`${STORAGE_KEY}:${sam.id}`)
    expect(startProgressForActive().skillLevels['add-to-10']).toBe('locked')

    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 3,
      dateISO: NOW,
      focusNode: 'number-recog',
    })

    const p = loadProgress()!
    expect(p.skillLevels['add-to-10']).toBe('locked')
    expect(p.skillLevels['sub-to-10']).toBe('locked')
    expect(p.skillLevels['letter-names']).toBe('intro')
  })

  it('no list installed (the web) → defaultProgress(), as today', () => {
    setKeyValueStore(new MapStore())
    expect(startProgressForActive()).toEqual(defaultProgress())
  })

  it('the QA jump starts from the playing learner’s start', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()
    const p = progressAtStep('mult-6-9')
    expect(p.skillLevels['letter-names']).toBe('intro')
    expect(p.skillLevels['letter-sounds']).toBe('locked')
  })

  it('a source scan finds defaultProgress() in production code only in the learners start doc', () => {
    const root = join(__dirname, '..', '..', '..', '..')
    const dirs = [join(root, 'packages/core/src'), join(root, 'mobile/src')]
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) {
          if (name === 'node_modules' || name === '__tests__') continue
          walk(path)
          continue
        }
        if (!/\.(ts|tsx)$/.test(name) || /\.test\.tsx?$/.test(name)) continue
        const lines = readFileSync(path, 'utf8').split('\n')
        lines.forEach((line, i) => {
          const code = line.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '')
          if (/^\s*(\*|\/\*)/.test(code)) return
          if (
            /\bdefaultProgress\(/.test(code) &&
            !/function defaultProgress/.test(code)
          ) {
            hits.push(`${relative(root, path)}:${i + 1}`)
          }
        })
      }
    }
    for (const dir of dirs) walk(dir)
    for (const hit of hits) {
      expect(hit).toMatch(/^packages\/core\/src\/learners\/startDoc\.ts:\d+$/)
    }
    expect(hits.length).toBeGreaterThan(0)
  })
})

describe('review baseline (AC 19, K7)', () => {
  it("learner 1 → today's set; land-1 → empty; land-3 → lands 1–2; per learner after a switch", () => {
    const store = new MapStore()
    store.data.set(STORAGE_KEY, JSON.stringify(defaultProgress()))
    setKeyValueStore(store)
    ensureLearnerList()
    const one = activeLearner()!
    expect([...reviewBaseline()].sort()).toEqual([
      'letter-names',
      'number-recog',
    ])

    const land1 = addLearner({
      name: 'Ana',
      avatarId: 'frog',
      start: { math: 1, wordSong: 1 },
    })
    expect([...reviewBaseline()]).toEqual([])

    const land3 = addLearner({
      name: 'Leo',
      avatarId: 'bear',
      start: { math: 3, wordSong: 1 },
    })
    expect([...reviewBaseline()].sort()).toEqual(
      [
        'add-to-10',
        'add-to-20',
        'number-recog',
        'sub-to-10',
        'sub-to-20',
      ].sort(),
    )

    activateLearner(one.id)
    expect([...reviewBaseline()].sort()).toEqual([
      'letter-names',
      'number-recog',
    ])
    activateLearner(land1.id)
    expect([...reviewBaseline()]).toEqual([])
    expect(land3.id).not.toBe(land1.id)
  })

  it('follows a moved start', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()
    const sam = addLearner({
      name: 'Sam',
      avatarId: 'owl',
      start: { math: 1, wordSong: 1 },
    })
    expect([...reviewBaseline()]).toEqual([])
    setLearnerStart(sam.id, 'math', 2)
    expect([...reviewBaseline()]).toEqual(['number-recog'])
  })

  it('no list (the web) → the steps mastered in defaultProgress()', () => {
    setKeyValueStore(new MapStore())
    expect([...reviewBaseline()].sort()).toEqual([
      'letter-names',
      'number-recog',
    ])
  })
})

describe('routing (AC 23)', () => {
  it('2+ learners → Splash goes to the picker', () => {
    setKeyValueStore(new MapStore())
    ensureLearnerList()
    addLearner({
      name: 'Sam',
      avatarId: 'owl',
      start: { math: 1, wordSong: 1 },
    })
    expect(nextAfterSplash()).toBe('picker')
  })

  it('1 learner → nextAfterPick: greet on a fresh install, hub once played', () => {
    setKeyValueStore(new MapStore())
    ensureLearnerList()
    expect(nextAfterSplash()).toBe('greet')
    expect(nextAfterPick(activeLearner()!)).toBe('greet')
    recordSessionEnd(1, undefined, () => new Date(NOW), 1)
    expect(nextAfterSplash()).toBe('hub')
  })

  it('a learner with doc history but no session history → hub', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    ensureLearnerList()
    const sam = addLearner({
      name: 'Sam',
      avatarId: 'owl',
      start: { math: 1, wordSong: 1 },
    })
    const io = boundLearner(sam)
    const p = io.load()!
    io.save({
      ...p,
      history: [{ dateISO: NOW, skillFocus: ['number-recog'], successRate: 1 }],
    })
    expect(readSessionHistory().sessionCount).toBe(0)
    expect(nextAfterPick(sam)).toBe('hub')
    const one = loadLearnerList()!.learners[0]!
    expect(nextAfterPick(one)).toBe('greet')
  })

  it('no list (the web) → sessionCount alone, as today', () => {
    setKeyValueStore(new MapStore())
    expect(nextAfterSplash()).toBe('greet')
    writeSessionHistory({ ...readSessionHistory(), sessionCount: 1 })
    expect(nextAfterSplash()).toBe('hub')
  })

  it('saveProgress before any list is today’s single key', () => {
    const store = new MapStore()
    setKeyValueStore(store)
    saveProgress(defaultProgress())
    expect([...store.data.keys()]).toEqual([STORAGE_KEY])
  })
})
