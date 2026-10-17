/**
 * Content wave 2, Word Song: tent words (end blends) and cake words (magic
 * e), land 6's 3rd and 4th steps (`design/native/content-wave-2.md` § 1,
 * § 3.1, § 4.1, AC 5, AC 7).
 *
 * Failing-first: it pins the progression (crab words mastered → tent words
 * opens, tent words mastered → cake words opens, on load and in the tree)
 * and the steps' wiring (tree order, land 6, the names, the intro leads,
 * the 16 rows), so a partial landing fails here rather than on a device.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sessionIntroLine } from '../emmasPath/guidanceLines'
import {
  FRIENDLY_NODE_NAMES,
  STAGE_SPOKEN_NAMES,
  STAGE_SPOKEN_NAME_VERBS,
} from '../sessionEnd/friendlyNodeName'
import { bigWordsOf } from '../wordSong/bigWordsSteps'
import {
  FORBIDDEN_PAIRS,
  TARGET_PAIRINGS,
  TARGET_WORDS,
  isForbiddenPair,
} from '../wordSong/wordPack'
import { defaultProgress } from './defaults'
import { WORD_SONG_NODES_IN_ORDER, pickFocusNode } from './focusNode'
import { isProgressV1 } from './guards'
import { LANDS } from './lands'
import { LITERACY_TREE, MATH_TREE, nextNode } from './mastery'
import { pendingUnlock } from './pathBeats'
import { STORAGE_KEY, loadProgress } from './storage'
import type { SkillLevel, WordSongNode } from './types'

/** Typed by a cast so this file typechecks before the literals exist. */
const TENT = 'tent-words' as WordSongNode
const CAKE = 'cake-words' as WordSongNode

describe('tent words and cake words in the Word Song tree (§ 1, § 3.1, § 4.1)', () => {
  it('follow crab words, in both tree lists', () => {
    expect(LITERACY_TREE.slice(-3)).toEqual(['crab-words', TENT, CAKE])
    expect(WORD_SONG_NODES_IN_ORDER.slice(-3)).toEqual([
      'crab-words',
      TENT,
      CAKE,
    ])
    expect(nextNode('word-song', 'crab-words')).toBe(TENT)
    expect(nextNode('word-song', TENT)).toBe(CAKE)
    expect(nextNode('word-song', CAKE)).toBeNull()
  })

  it('are the 3rd and 4th stops of land 6, Big words; LANDS flattened equals both trees (AC 5)', () => {
    const big = LANDS.find((l) => l.world === 'word-song' && l.number === 6)
    expect(big?.name).toBe('Big words')
    expect(big?.nodes).toEqual(['duck-words', 'crab-words', TENT, CAKE])
    expect(LANDS.flatMap((l) => l.nodes)).toEqual([
      ...MATH_TREE,
      ...LITERACY_TREE,
    ])
  })

  it("start 'locked' for a fresh child", () => {
    const levels = defaultProgress('Marian').skillLevels
    expect(levels[TENT]).toBe('locked')
    expect(levels[CAKE]).toBe('locked')
  })

  it('have their names: "tent words" / "cake words", "are", recap "reading words"; spoken names stay unique (AC 5)', () => {
    expect(STAGE_SPOKEN_NAMES[TENT]).toBe('tent words')
    expect(STAGE_SPOKEN_NAMES[CAKE]).toBe('cake words')
    expect(STAGE_SPOKEN_NAME_VERBS[TENT]).toBe('are')
    expect(STAGE_SPOKEN_NAME_VERBS[CAKE]).toBe('are')
    expect(FRIENDLY_NODE_NAMES[TENT]).toBe('reading words')
    expect(FRIENDLY_NODE_NAMES[CAKE]).toBe('reading words')
    const nodes = [...MATH_TREE, ...LITERACY_TREE]
    expect(new Set(nodes.map((n) => STAGE_SPOKEN_NAMES[n])).size).toBe(
      nodes.length,
    )
  })

  it('have their intro leads (§ 6.1, K11)', () => {
    expect(sessionIntroLine(TENT)).toMatchObject({
      id: 'guide.session.intro.tent-words',
      kind: 'session-intro',
      world: 'word-song',
      text: 'Read to the end!',
    })
    expect(sessionIntroLine(CAKE)).toMatchObject({
      id: 'guide.session.intro.cake-words',
      kind: 'session-intro',
      world: 'word-song',
      text: 'The E is quiet. It makes the A say its name.',
    })
  })
})

describe('the 16 rows and the new forbidden pairs (§ 3.2, § 4.2, § 5, AC 6)', () => {
  // [word, gentle, trap], canon order.
  const TENT_ROWS = [
    ['tent', ['dog', 'cup'], ['nest', 'tap']],
    ['hand', ['bus', 'pot'], ['hat', 'pond']],
    ['gift', ['sun', 'pot'], ['gem', 'fig']],
    ['nest', ['cup', 'fox'], ['net', 'tent']],
    ['desk', ['sun', 'cat'], ['duck', 'nest']],
    ['belt', ['sun', 'fox'], ['bed', 'tent']],
    ['lamp', ['bus', 'dog'], ['lock', 'hand']],
    ['pond', ['cup', 'hen'], ['pot', 'hand']],
  ] as const
  const CAKE_ROWS = [
    ['cake', ['dog', 'pen'], ['cape', 'cat']],
    ['kite', ['sun', 'hen'], ['king', 'bike']],
    ['bone', ['jet', 'sun'], ['box', 'rope']],
    ['cape', ['dog', 'bus'], ['cap', 'cake']],
    ['pine', ['dog', 'cup'], ['pin', 'kite']],
    ['rope', ['hen', 'sun'], ['rock', 'bone']],
    ['tube', ['hen', 'cat'], ['tub', 'top']],
    ['bike', ['dog', 'pen'], ['bib', 'kite']],
  ] as const

  it('serve the words in canon order', () => {
    expect(bigWordsOf('tent-words' as never)).toEqual(
      TENT_ROWS.map((r) => r[0]),
    )
    expect(bigWordsOf('cake-words' as never)).toEqual(
      CAKE_ROWS.map((r) => r[0]),
    )
  })

  it('carry the spec chip pairs, each a target picture word', () => {
    for (const [word, gentle, trap] of [...TENT_ROWS, ...CAKE_ROWS]) {
      expect(TARGET_PAIRINGS[word], word).toEqual({ gentle, trap })
      expect(
        TARGET_WORDS.filter((e) => e.word === word && e.isTarget),
        word,
      ).toHaveLength(1)
    }
  })

  it('add the 5 forbidden pairs, and no trio holds a forbidden pair', () => {
    for (const [a, b] of [
      ['gift', 'box'],
      ['nest', 'egg'],
      ['desk', 'bed'],
      ['kite', 'flag'],
      ['rope', 'sack'],
    ] as const) {
      expect(isForbiddenPair(a, b), `${a}-${b}`).toBe(true)
      expect(
        FORBIDDEN_PAIRS.filter(
          ([x, y]) => (x === a && y === b) || (x === b && y === a),
        ),
      ).toHaveLength(1)
    }
    for (const [word, gentle, trap] of [...TENT_ROWS, ...CAKE_ROWS])
      for (const trio of [
        [word, ...gentle],
        [word, ...trap],
      ])
        for (let i = 0; i < 3; i++)
          for (let j = i + 1; j < 3; j++)
            expect(isForbiddenPair(trio[i]!, trio[j]!), trio.join()).toBe(false)
  })
})

describe('the progression into tent words and cake words (AC 7)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  /** Marian's baseline with every Word Song step mastered before `last`. */
  function upTo(
    last: WordSongNode,
    lastLevel: SkillLevel,
  ): Record<string, unknown> {
    const seed = defaultProgress('Marian')
    const levels: Record<string, unknown> = { ...seed.skillLevels }
    for (const n of LITERACY_TREE) {
      if (n === last) break
      levels[n] = 'mastered'
    }
    levels[last] = lastLevel
    return levels
  }

  function store(skillLevels: Record<string, unknown>, seen: string[] = []) {
    const seed = defaultProgress('Marian')
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seed, skillLevels, unlocksCelebrated: seen }),
    )
  }

  it("no tent-words key with crab words mastered → tent 'intro', cake 'locked'; the Map owes crab → tent", () => {
    const skillLevels = upTo('crab-words', 'mastered')
    delete skillLevels[TENT]
    delete skillLevels[CAKE]
    // Every step before it already celebrated.
    store(skillLevels, LITERACY_TREE.slice(1, LITERACY_TREE.indexOf(TENT)))
    const loaded = loadProgress()
    expect(isProgressV1(loaded)).toBe(true)
    expect(loaded!.skillLevels[TENT]).toBe('intro')
    expect(loaded!.skillLevels[CAKE]).toBe('locked')
    expect(pendingUnlock(loaded!, 'word-song')).toEqual({
      world: 'word-song',
      mastered: 'crab-words',
      unlocked: TENT,
      land: null,
    })
  })

  it("crab words practicing and no tent-words key → 'locked'", () => {
    const skillLevels = upTo('crab-words', 'practicing')
    delete skillLevels[TENT]
    delete skillLevels[CAKE]
    store(skillLevels)
    expect(loadProgress()?.skillLevels[TENT]).toBe('locked')
    expect(loadProgress()?.skillLevels[CAKE]).toBe('locked')
  })

  it("tent words mastered and no cake-words key → cake 'intro'", () => {
    const skillLevels = upTo(TENT, 'mastered')
    delete skillLevels[CAKE]
    store(skillLevels, LITERACY_TREE.slice(1, LITERACY_TREE.indexOf(CAKE)))
    const loaded = loadProgress()
    expect(loaded!.skillLevels[CAKE]).toBe('intro')
    expect(pendingUnlock(loaded!, 'word-song')).toEqual({
      world: 'word-song',
      mastered: TENT,
      unlocked: CAKE,
      land: null,
    })
  })

  it('the focus picker lands on tent words once crab words is mastered, then on cake words', () => {
    const seed = defaultProgress('Marian')
    const atTent = {
      ...upTo('crab-words', 'mastered'),
      [TENT]: 'intro',
    } as typeof seed.skillLevels
    expect(
      pickFocusNode({ ...seed, skillLevels: atTent }, 'word-song', 10).node,
    ).toBe(TENT)
    const atCake = {
      ...upTo(TENT, 'mastered'),
      [CAKE]: 'intro',
    } as typeof seed.skillLevels
    expect(
      pickFocusNode({ ...seed, skillLevels: atCake }, 'word-song', 10).node,
    ).toBe(CAKE)
  })
})
