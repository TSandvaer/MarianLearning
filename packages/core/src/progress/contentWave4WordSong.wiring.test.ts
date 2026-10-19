/**
 * Content wave 4, Word Song: bee words (ee / ea), car words (ar) and sheep
 * stories, land 8 "Words and stories" (`design/native/content-wave-4.md`
 * § 1, § 3, § 4, § 6, § 7, § 8.1, AC 4, AC 7, AC 8, AC 9).
 *
 * Failing-first: it pins the progression (bug stories mastered → bee words
 * opens, then car words, then sheep stories, on load and in the tree), the
 * steps' wiring (tree order, land 8, the names, the leads, the guidance and
 * path lines, the path art), the 16 rows with their chips and the new
 * forbidden pairs, and the warm-up rule (never a story block), so a partial
 * landing fails here rather than on a device.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GUIDANCE_LINES,
  GUIDANCE_LINES_AWAITING_RENDER,
  guidanceLine,
  sessionIntroLine,
  storyWordLine,
} from '../emmasPath/guidanceLines'
import { landArtId, PATH_ART_IDS } from '../emmasPath/pathArt'
import {
  BAKED_PATH_LINES,
  PATH_LINES_AWAITING_RENDER,
  pathLine,
} from '../emmasPath/pathLines'
import {
  FRIENDLY_NODE_NAMES,
  STAGE_SPOKEN_NAMES,
  STAGE_SPOKEN_NAME_VERBS,
} from '../sessionEnd/friendlyNodeName'
import {
  BIG_WORDS_STEPS,
  bigWordsOf,
  type BigWordsStep,
} from '../wordSong/bigWordsSteps'
import { STORY_NODES, STORY_WORDS } from '../wordSong/littleStories'
import {
  ALL_WORDS,
  FORBIDDEN_PAIRS,
  TARGET_PAIRINGS,
  getWordEntry,
  isForbiddenPair,
} from '../wordSong/wordPack'
import { defaultProgress } from './defaults'
import { WORD_SONG_NODES_IN_ORDER, pickFocusNode } from './focusNode'
import { isProgressV1 } from './guards'
import { LANDS } from './lands'
import { LITERACY_TREE, MATH_TREE, nextNode } from './mastery'
import { pendingUnlock } from './pathBeats'
import { pickWarmupBlocks } from './reviewPlan'
import { STORAGE_KEY, loadProgress } from './storage'
import type { Progress, SkillLevel, SkillLevels, WordSongNode } from './types'

/** Typed by a cast so this file typechecks before the literals exist. */
const BEE = 'bee-words' as WordSongNode
const CAR = 'car-words' as WordSongNode
const SHEEP = 'sheep-stories' as WordSongNode
const NEW = [BEE, CAR, SHEEP] as const

describe('the three steps in the Word Song tree (§ 1, § 3.1, § 4.1, § 6.1)', () => {
  it('follow bug stories, in both tree lists', () => {
    const at = LITERACY_TREE.indexOf('bug-stories')
    expect(LITERACY_TREE.slice(at, at + 4)).toEqual([
      'bug-stories',
      BEE,
      CAR,
      SHEEP,
    ])
    expect(WORD_SONG_NODES_IN_ORDER.slice(at, at + 4)).toEqual([
      'bug-stories',
      BEE,
      CAR,
      SHEEP,
    ])
    expect(nextNode('word-song', 'bug-stories')).toBe(BEE)
    expect(nextNode('word-song', BEE)).toBe(CAR)
    expect(nextNode('word-song', CAR)).toBe(SHEEP)
    // Content wave 5's land 9 follows.
    expect(nextNode('word-song', SHEEP)).toBe('snail-words')
  })

  it('are land 8, Words and stories, of the Word Song lands; LANDS flattened equals both trees (K6, AC 8)', () => {
    const ws = LANDS.filter((l) => l.world === 'word-song')
    // Content wave 5 adds land 9.
    expect(ws).toHaveLength(9)
    expect(ws[7]).toEqual({
      world: 'word-song',
      number: 8,
      name: 'Words and stories',
      nodes: [BEE, CAR, SHEEP],
    })
    expect(LANDS.flatMap((l) => l.nodes)).toEqual([
      ...MATH_TREE,
      ...LITERACY_TREE,
    ])
  })

  it('have path art: the three stops and land 8 (§ 1)', () => {
    for (const id of [...NEW, 'land-ws-8']) expect(PATH_ART_IDS).toContain(id)
    expect(landArtId(LANDS.find((l) => l.name === 'Words and stories')!)).toBe(
      'land-ws-8',
    )
  })

  it("start 'locked' for a fresh child", () => {
    const levels = defaultProgress('Marian').skillLevels
    for (const n of NEW) expect(levels[n]).toBe('locked')
  })

  it('sheep stories is a story step; bee and car words are big-words steps', () => {
    expect(STORY_NODES).toContain(SHEEP)
    expect(bigWordsOf(BEE as BigWordsStep)).toHaveLength(8)
    expect(bigWordsOf(CAR as BigWordsStep)).toHaveLength(8)
  })

  it('have their names (T1): "bee words" / "car words" / "sheep stories", "are", recaps; spoken names stay unique (AC 8)', () => {
    expect(STAGE_SPOKEN_NAMES[BEE]).toBe('bee words')
    expect(STAGE_SPOKEN_NAMES[CAR]).toBe('car words')
    expect(STAGE_SPOKEN_NAMES[SHEEP]).toBe('sheep stories')
    for (const n of NEW) expect(STAGE_SPOKEN_NAME_VERBS[n]).toBe('are')
    expect(FRIENDLY_NODE_NAMES[BEE]).toBe('reading words')
    expect(FRIENDLY_NODE_NAMES[CAR]).toBe('reading words')
    expect(FRIENDLY_NODE_NAMES[SHEEP]).toBe('reading stories')
    const nodes = [...MATH_TREE, ...LITERACY_TREE]
    expect(new Set(nodes.map((n) => STAGE_SPOKEN_NAMES[n])).size).toBe(
      nodes.length,
    )
  })
})

describe('the lines (§ 8.1, AC 8)', () => {
  it("bee and car words reuse duck words' lead; sheep stories has its own", () => {
    const duck = sessionIntroLine('duck-words')!.text
    expect(duck).toBe('Two letters, one sound!')
    expect(sessionIntroLine(BEE)).toMatchObject({
      id: 'guide.session.intro.bee-words',
      kind: 'session-intro',
      world: 'word-song',
      text: duck,
    })
    expect(sessionIntroLine(CAR)?.text).toBe(duck)
    expect(sessionIntroLine(SHEEP)?.text).toBe(
      'Read the story. Who, what or where?',
    )
  })

  it('peek and replay lines for each step', () => {
    expect(guidanceLine('guide.session.peek-open.bee-words')?.text).toBe(
      "Let's look at bee words!",
    )
    expect(guidanceLine('guide.session.peek-close.car-words')?.text).toBe(
      'Car words are for later. You will learn it!',
    )
    expect(guidanceLine('guide.session.peek-close.sheep-stories')?.text).toBe(
      'Sheep stories are for later. You will learn it!',
    )
    expect(guidanceLine('guide.session.replay-open.sheep-stories')?.text).toBe(
      "Let's play sheep stories again!",
    )
    expect(guidanceLine('guide.session.replay-close.bee-words')?.text).toBe(
      'You know bee words!',
    )
  })

  it('17 new story-word clips (87 characters), captioned "Word." and sent to Lily as "Word,"', () => {
    const fresh = [
      'sheep',
      'jeep',
      'peach',
      'cart',
      'harp',
      'barn',
      'leaf',
      'bee',
      'seed',
      'card',
      'seal',
      'tree',
      'car',
      'shark',
      'ship',
      'scarf',
      'star',
    ]
    // Content wave 5's goat stories add 16 more after these.
    expect(STORY_WORDS).toHaveLength(87)
    expect(STORY_WORDS.slice(54, 71)).toEqual(fresh)
    const lines = fresh.map((w) => storyWordLine(w)!)
    expect(lines.reduce((n, l) => n + l.text.length, 0)).toBe(87)
    expect(storyWordLine('sheep')).toMatchObject({
      id: 'guide.story.word.sheep',
      text: 'Sheep.',
      input: 'Sheep,',
      src: '/assets/audio/path/guide-story-word-sheep.mp3',
    })
    for (const l of lines) expect(l.input).toBe(`${l.text.slice(0, -1)},`)
    // The 54 shipped clips keep their committed MP3s: no new input.
    expect(storyWordLine('fox')?.input).toBeUndefined()
    expect(storyWordLine('sat')?.input).toBeUndefined()
  })

  it('32 guidance lines (30 new texts, 477 characters) and 18 path lines (628 characters) of this half, rendered in Lily', () => {
    const sheepWords = new Set(STORY_WORDS.slice(54, 71))
    const g = GUIDANCE_LINES.filter(
      (l) =>
        NEW.some((n) => l.id.endsWith(`.${n}`)) ||
        (l.kind === 'story-word' &&
          sheepWords.has(l.id.replace('guide.story.word.', ''))),
    )
    expect(g).toHaveLength(32)
    // § 8.1: peeks 6 + replays 6 + 3 leads + 17 clips. The bee and car
    // leads are duck words' text, so they bill nothing.
    const fresh = [
      ...new Set(
        g.map((l) => l.text).filter((t) => t !== 'Two letters, one sound!'),
      ),
    ]
    expect(fresh).toHaveLength(30)
    expect(fresh.reduce((n, t) => n + t.length, 0)).toBe(477)
    const p = BAKED_PATH_LINES.filter(
      (l) =>
        /\.word-song\.8(\.|$)/.test(l.id) ||
        /\.(bee-words|car-words|sheep-stories)$/.test(l.id),
    )
    expect(p).toHaveLength(18)
    expect(p.reduce((n, l) => n + l.text.length, 0)).toBe(628)
    for (const l of g)
      expect(GUIDANCE_LINES_AWAITING_RENDER).not.toContain(l.id)
    for (const l of p) expect(PATH_LINES_AWAITING_RENDER).not.toContain(l.id)
  })

  it("the bee and car leads have their own files, copies of duck words' clip (the render writes the same bytes)", () => {
    const duck = sessionIntroLine('duck-words')!
    const bytes = (src: string) =>
      readFileSync(join(process.cwd(), 'public', src))
    for (const n of [BEE, CAR]) {
      const line = sessionIntroLine(n)!
      expect(line.src).toBe(`/assets/audio/path/guide-session-intro-${n}.mp3`)
      expect(bytes(line.src).equals(bytes(duck.src)), n).toBe(true)
      expect(GUIDANCE_LINES_AWAITING_RENDER).not.toContain(line.id)
    }
  })

  it('the path lines name the land and the steps (§ 8.1)', () => {
    expect(pathLine('path.land.word-song.8')?.text).toBe(
      'Land 8: Words and stories.',
    )
    expect(pathLine('end.land.word-song.8')?.text).toBe(
      'A new land! Land 8: Words and stories!',
    )
    expect(pathLine('end.land.word-song.8.no-number')?.text).toBe(
      'A new land: Words and stories!',
    )
    expect(pathLine('path.open.bee-words')?.text).toBe(
      'Here is your path! You are on bee words.',
    )
    expect(pathLine('path.stop.sheep-stories')?.text).toBe('Sheep stories.')
    expect(pathLine('path.locked.next.bee-words')?.text).toBe(
      'Bee words! First, bug stories. Then this!',
    )
    expect(pathLine('end.bud.car-words')?.text).toBe(
      'Look! A new flower for car words!',
    )
    expect(pathLine('end.unlock.sheep-stories')?.text).toBe(
      'You learned car words! Now you can do sheep stories!',
    )
  })
})

// ── The 16 rows (§ 3.2, § 4.2) and the forbidden pairs (§ 7), AC 4 ──────

/** [word, gentle, trap], canon order. */
type Row = readonly [
  string,
  readonly [string, string],
  readonly [string, string],
]
const BEE_ROWS: readonly Row[] = [
  ['bee', ['cup', 'fan'], ['bed', 'tree']],
  ['tree', ['dog', 'cap'], ['tent', 'bee']],
  ['leaf', ['box', 'hat'], ['leg', 'seal']],
  ['sheep', ['pot', 'map'], ['ship', 'jeep']],
  ['jeep', ['pig', 'sun'], ['jet', 'sheep']],
  ['seal', ['mop', 'cap'], ['sun', 'seed']],
  ['peach', ['dog', 'bus'], ['pen', 'leaf']],
  ['seed', ['cat', 'cup'], ['sock', 'seal']],
]
const CAR_ROWS: readonly Row[] = [
  ['car', ['dog', 'pen'], ['cat', 'star']],
  ['star', ['hen', 'cup'], ['sun', 'car']],
  ['barn', ['fox', 'pen'], ['bag', 'harp']],
  ['cart', ['sun', 'hen'], ['cat', 'car']],
  ['shark', ['pot', 'bed'], ['ship', 'star']],
  ['scarf', ['dog', 'bun'], ['sack', 'shark']],
  ['card', ['pig', 'hen'], ['cap', 'cart']],
  ['harp', ['fox', 'bus'], ['hat', 'barn']],
]
const NEW_PAIRS = [
  ['bee', 'bug'],
  ['tree', 'pine'],
  ['seed', 'nut'],
  ['seed', 'egg'],
  ['peach', 'plum'],
  ['sheep', 'dog'],
  ['sheep', 'pig'],
  ['sheep', 'cat'],
  ['jeep', 'van'],
  ['jeep', 'bus'],
  ['jeep', 'car'],
  ['car', 'van'],
  ['car', 'bus'],
  ['barn', 'tent'],
  ['scarf', 'belt'],
  ['card', 'gift'],
  ['seal', 'shark'],
] as const

describe('the 16 rows and the 17 new forbidden pairs (§ 3.2, § 4.2, § 7, AC 4)', () => {
  it('BIG_WORDS_STEPS holds the spec rows in canon order', () => {
    const rows = (step: string) =>
      BIG_WORDS_STEPS[step as BigWordsStep].map(
        (r) => [r.word, [...r.gentle], [...r.trap]] as const,
      )
    expect(rows(BEE)).toEqual(BEE_ROWS.map(([w, g, t]) => [w, [...g], [...t]]))
    expect(rows(CAR)).toEqual(CAR_ROWS.map(([w, g, t]) => [w, [...g], [...t]]))
    for (const r of BIG_WORDS_STEPS[BEE as BigWordsStep])
      expect(r.vowel, r.word).toBe('e')
    for (const r of BIG_WORDS_STEPS[CAR as BigWordsStep])
      expect(r.vowel, r.word).toBe('a')
  })

  it("the 14 words new to the pack are picture targets; sheep and shark keep the sh step's entries (§ 5)", () => {
    for (const [word] of [...BEE_ROWS, ...CAR_ROWS]) {
      const entries = ALL_WORDS.filter((e) => e.word === word)
      expect(entries, word).toHaveLength(1)
      expect(entries[0]!.isTarget, word).toBe(true)
      expect(entries[0]!.pictureKey, word).toBe(word)
    }
    expect(getWordEntry('sheep')).toMatchObject({
      phoneme: '/ʃ/',
      hybridMode: true,
    })
    expect(getWordEntry('shark')).toMatchObject({
      phoneme: '/ʃ/',
      hybridMode: true,
    })
    expect(getWordEntry('star').category).toBe('celestial')
    // Every chip partner is a pack word.
    for (const [, gentle, trap] of [...BEE_ROWS, ...CAR_ROWS])
      for (const w of [...gentle, ...trap])
        expect(() => getWordEntry(w), w).not.toThrow()
  })

  it("TARGET_PAIRINGS gains the 14 new words' rows and keeps the sh step's sheep and shark rows", () => {
    for (const [word, gentle, trap] of [...BEE_ROWS, ...CAR_ROWS]) {
      if (word === 'sheep' || word === 'shark') continue
      expect(TARGET_PAIRINGS[word], word).toEqual({ gentle, trap })
    }
    expect(TARGET_PAIRINGS.sheep).toEqual({
      gentle: ['shark', 'shoe'],
      trap: ['ship', 'shell'],
    })
    expect(TARGET_PAIRINGS.shark).toEqual({
      gentle: ['ship', 'sheep'],
      trap: ['shoe', 'shell'],
    })
  })

  it('adds the 17 forbidden pairs once each, and no trio holds a forbidden pair, old or new', () => {
    for (const [a, b] of NEW_PAIRS) {
      expect(isForbiddenPair(a, b), `${a}-${b}`).toBe(true)
      expect(
        FORBIDDEN_PAIRS.filter(
          ([x, y]) => (x === a && y === b) || (x === b && y === a),
        ),
      ).toHaveLength(1)
    }
    for (const [word, gentle, trap] of [...BEE_ROWS, ...CAR_ROWS])
      for (const trio of [
        [word, ...gentle],
        [word, ...trap],
      ])
        for (let i = 0; i < 3; i++)
          for (let j = i + 1; j < 3; j++)
            expect(isForbiddenPair(trio[i]!, trio[j]!), trio.join()).toBe(false)
  })

  it('P1 of each step ends in its team (the ending-pair cue lights it, § 3.3)', () => {
    expect(bigWordsOf(BEE as BigWordsStep)[0]!.slice(-2)).toBe('ee')
    expect(bigWordsOf(CAR as BigWordsStep)[0]!.slice(-2)).toBe('ar')
  })
})

describe('the progression into land 8 (AC 9)', () => {
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

  it("bug stories mastered, no new keys → bee words 'intro', car words and sheep stories 'locked'; the Map owes bug → bee, land 8", () => {
    const skillLevels = upTo('bug-stories', 'mastered')
    for (const n of NEW) delete skillLevels[n]
    store(skillLevels, LITERACY_TREE.slice(1, LITERACY_TREE.indexOf(BEE)))
    const loaded = loadProgress()
    expect(isProgressV1(loaded)).toBe(true)
    expect(loaded!.skillLevels[BEE]).toBe('intro')
    expect(loaded!.skillLevels[CAR]).toBe('locked')
    expect(loaded!.skillLevels[SHEEP]).toBe('locked')
    expect(pendingUnlock(loaded!, 'word-song')).toMatchObject({
      world: 'word-song',
      mastered: 'bug-stories',
      unlocked: BEE,
    })
    expect(pendingUnlock(loaded!, 'word-song')?.land).not.toBeNull()
  })

  it("bug stories practicing, no new keys → all 'locked'", () => {
    const skillLevels = upTo('bug-stories', 'practicing')
    for (const n of NEW) delete skillLevels[n]
    store(skillLevels)
    const loaded = loadProgress()
    for (const n of NEW) expect(loaded?.skillLevels[n]).toBe('locked')
  })

  it("bee words mastered, no car key → car 'intro' (same land)", () => {
    const skillLevels = upTo(BEE, 'mastered')
    delete skillLevels[CAR]
    delete skillLevels[SHEEP]
    store(skillLevels, LITERACY_TREE.slice(1, LITERACY_TREE.indexOf(CAR)))
    const loaded = loadProgress()
    expect(loaded!.skillLevels[CAR]).toBe('intro')
    expect(pendingUnlock(loaded!, 'word-song')).toEqual({
      world: 'word-song',
      mastered: BEE,
      unlocked: CAR,
      land: null,
    })
  })

  it('the focus picker walks bee → car → sheep', () => {
    const seed = defaultProgress('Marian')
    for (const [prev, n] of [
      ['bug-stories', BEE],
      [BEE, CAR],
      [CAR, SHEEP],
    ] as const) {
      const levels = {
        ...upTo(prev as WordSongNode, 'mastered'),
        [n]: 'intro',
      } as SkillLevels
      expect(
        pickFocusNode({ ...seed, skillLevels: levels }, 'word-song', 10).node,
      ).toBe(n)
    }
  })
})

describe('the warm-up never serves a sheep-story block (AC 7, K8)', () => {
  it('with car words and sheep stories mastered, the hearts come from car words', () => {
    const seed = defaultProgress('Marian')
    const levels = { ...seed.skillLevels } as SkillLevels
    for (const n of LITERACY_TREE) levels[n] = 'mastered'
    levels[SHEEP] = 'mastered'
    // Land 9 (content wave 5) not reached yet.
    for (const n of ['snail-words', 'moon-words', 'goat-stories'] as const)
      levels[n] = 'locked'
    // A world not yet complete: one earlier step is still practicing, so
    // the review pool is open and sheep stories is its newest step.
    levels['cvc-words-short-e'] = 'practicing'
    const p: Progress = { ...seed, skillLevels: levels, history: [] }
    const now = Date.parse('2026-10-18T10:00:00Z')
    for (let seedN = 0; seedN < 8; seedN++) {
      const blocks = pickWarmupBlocks(p, 'word-song', now, '2026-10-18', seedN)
      expect(blocks.length).toBeGreaterThan(0)
      for (const b of blocks) expect(b.node).toBe(CAR)
    }
  })
})
