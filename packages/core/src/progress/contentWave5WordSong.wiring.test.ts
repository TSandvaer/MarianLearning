/**
 * Content wave 5, Word Song: snail words (ai / ay and oa), moon words (long
 * oo) and goat stories, land 9 "More words and stories"
 * (`design/native/content-wave-5.md` § 1, § 4–§ 9, AC 4–AC 9).
 *
 * Failing-first: it pins the progression (sheep stories mastered → snail
 * words opens, then moon words, then goat stories, on load and in the
 * tree), the steps' wiring (tree order, land 9, the names, the leads, the
 * guidance and path lines with the "; then this!" render input, the path
 * art), the 16 rows with their chips and the 21 new forbidden pairs, and
 * the warm-up rule (never a story block), so a partial landing fails here
 * rather than on a device. Number Garden's half (zeros, adding big
 * numbers, land 6) is a parallel PR: this file reads only Word Song.
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
  THEN_THIS_INPUT_STEPS,
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
import type {
  Progress,
  SkillLevel,
  SkillLevels,
  SkillNode,
  WordSongNode,
} from './types'

/** Typed by a cast so this file typechecks before the literals exist. */
const SNAIL = 'snail-words' as WordSongNode
const MOON = 'moon-words' as WordSongNode
const GOAT = 'goat-stories' as WordSongNode
const NEW = [SNAIL, MOON, GOAT] as const

describe('the three steps in the Word Song tree (§ 1, § 4.1, § 5.1, § 7.1)', () => {
  it('follow sheep stories, in both tree lists', () => {
    const at = LITERACY_TREE.indexOf('sheep-stories')
    expect(LITERACY_TREE.slice(at, at + 4)).toEqual([
      'sheep-stories',
      SNAIL,
      MOON,
      GOAT,
    ])
    expect(WORD_SONG_NODES_IN_ORDER).toEqual(LITERACY_TREE)
    expect(nextNode('word-song', 'sheep-stories')).toBe(SNAIL)
    expect(nextNode('word-song', SNAIL)).toBe(MOON)
    expect(nextNode('word-song', MOON)).toBe(GOAT)
    expect(nextNode('word-song', GOAT)).toBeNull()
  })

  it('are land 9, More words and stories, of 9 Word Song lands; LANDS flattened equals both trees (K6, AC 8)', () => {
    const ws = LANDS.filter((l) => l.world === 'word-song')
    expect(ws).toHaveLength(9)
    expect(ws[8]).toEqual({
      world: 'word-song',
      number: 9,
      name: 'More words and stories',
      nodes: [SNAIL, MOON, GOAT],
    })
    expect(LANDS.flatMap((l) => l.nodes)).toEqual([
      ...MATH_TREE,
      ...LITERACY_TREE,
    ])
  })

  it('have path art: the three stops and land 9 (§ 1)', () => {
    for (const id of [...NEW, 'land-ws-9']) expect(PATH_ART_IDS).toContain(id)
    expect(
      landArtId(LANDS.find((l) => l.name === 'More words and stories')!),
    ).toBe('land-ws-9')
  })

  it("start 'locked' for a fresh child", () => {
    const levels = defaultProgress('Marian').skillLevels
    for (const n of NEW) expect(levels[n]).toBe('locked')
  })

  it('goat stories is a story step; snail and moon words are big-words steps', () => {
    expect(STORY_NODES).toContain(GOAT)
    expect(bigWordsOf(SNAIL as BigWordsStep)).toHaveLength(8)
    expect(bigWordsOf(MOON as BigWordsStep)).toHaveLength(8)
  })

  it('have their names (T1): "snail words" / "moon words" / "goat stories", "are", recaps; spoken names stay unique (AC 8)', () => {
    expect(STAGE_SPOKEN_NAMES[SNAIL]).toBe('snail words')
    expect(STAGE_SPOKEN_NAMES[MOON]).toBe('moon words')
    expect(STAGE_SPOKEN_NAMES[GOAT]).toBe('goat stories')
    for (const n of NEW) expect(STAGE_SPOKEN_NAME_VERBS[n]).toBe('are')
    expect(FRIENDLY_NODE_NAMES[SNAIL]).toBe('reading words')
    expect(FRIENDLY_NODE_NAMES[MOON]).toBe('reading words')
    expect(FRIENDLY_NODE_NAMES[GOAT]).toBe('reading stories')
    const nodes = [...MATH_TREE, ...LITERACY_TREE]
    expect(new Set(nodes.map((n) => STAGE_SPOKEN_NAMES[n])).size).toBe(
      nodes.length,
    )
  })
})

describe('the lines (§ 9.1, AC 8)', () => {
  it("snail and moon words reuse duck words' lead, goat stories sheep stories'", () => {
    const duck = sessionIntroLine('duck-words')!.text
    expect(duck).toBe('Two letters, one sound!')
    expect(sessionIntroLine(SNAIL)).toMatchObject({
      id: 'guide.session.intro.snail-words',
      kind: 'session-intro',
      world: 'word-song',
      text: duck,
    })
    expect(sessionIntroLine(MOON)?.text).toBe(duck)
    expect(sessionIntroLine(GOAT)?.text).toBe(
      sessionIntroLine('sheep-stories')!.text,
    )
    expect(sessionIntroLine(GOAT)?.text).toBe(
      'Read the story. Who, what or where?',
    )
  })

  it('peek and replay lines for each step', () => {
    expect(guidanceLine('guide.session.peek-open.snail-words')?.text).toBe(
      "Let's look at snail words!",
    )
    expect(guidanceLine('guide.session.peek-close.moon-words')?.text).toBe(
      'Moon words are for later. You will learn it!',
    )
    expect(guidanceLine('guide.session.peek-close.goat-stories')?.text).toBe(
      'Goat stories are for later. You will learn it!',
    )
    expect(guidanceLine('guide.session.replay-open.goat-stories')?.text).toBe(
      "Let's play goat stories again!",
    )
    expect(guidanceLine('guide.session.replay-close.snail-words')?.text).toBe(
      'You know snail words!',
    )
  })

  it('16 new story-word clips (87 characters), captioned "Word." and sent to Lily as "Word,"', () => {
    const fresh = [
      'goat',
      'boat',
      'loaf',
      'roof',
      'broom',
      'train',
      'stool',
      'hoop',
      'coat',
      'spoon',
      'tray',
      'snail',
      'moon',
      'boot',
      'tooth',
      'chain',
    ]
    expect(STORY_WORDS).toHaveLength(87)
    expect(STORY_WORDS.slice(71)).toEqual(fresh)
    const lines = fresh.map((w) => storyWordLine(w)!)
    expect(lines.reduce((n, l) => n + l.text.length, 0)).toBe(87)
    expect(storyWordLine('goat')).toMatchObject({
      id: 'guide.story.word.goat',
      text: 'Goat.',
      input: 'Goat,',
      src: '/assets/audio/path/guide-story-word-goat.mp3',
    })
    for (const l of lines) expect(l.input).toBe(`${l.text.slice(0, -1)},`)
  })

  it('31 guidance lines of this half: 28 new texts (450 characters), all rendered in Lily', () => {
    const g = GUIDANCE_LINES.filter(
      (l) =>
        NEW.some((n) => l.id.endsWith(`.${n}`)) ||
        (l.kind === 'story-word' &&
          STORY_WORDS.indexOf(l.id.replace('guide.story.word.', '')) >= 71),
    )
    expect(g).toHaveLength(31)
    const leads = new Set([
      'Two letters, one sound!',
      'Read the story. Who, what or where?',
    ])
    const fresh = [
      ...new Set(g.map((l) => l.text).filter((t) => !leads.has(t))),
    ]
    expect(fresh).toHaveLength(28)
    expect(fresh.reduce((n, t) => n + t.length, 0)).toBe(450)
    const rendered = g
      .filter((l) => l.kind !== 'session-intro')
      .map((l) => l.id)
      .sort()
    expect(rendered).toHaveLength(28)
    for (const l of g)
      expect(GUIDANCE_LINES_AWAITING_RENDER).not.toContain(l.id)
  })

  it("the three leads have their own files, copies of the shipped lead's clip (the render writes the same bytes)", () => {
    const bytes = (src: string) =>
      readFileSync(join(process.cwd(), 'public', src))
    for (const [n, from] of [
      [SNAIL, 'duck-words'],
      [MOON, 'duck-words'],
      [GOAT, 'sheep-stories'],
    ] as const) {
      const line = sessionIntroLine(n)!
      expect(line.src).toBe(`/assets/audio/path/guide-session-intro-${n}.mp3`)
      const shipped = sessionIntroLine(from as SkillNode)!
      expect(bytes(line.src).equals(bytes(shipped.src)), n).toBe(true)
    }
  })

  it('18 path lines of this half (663 characters), all rendered in Lily', () => {
    const p = BAKED_PATH_LINES.filter(
      (l) =>
        /\.word-song\.9(\.|$)/.test(l.id) ||
        /\.(snail-words|moon-words|goat-stories)$/.test(l.id),
    )
    expect(p).toHaveLength(18)
    expect(p.reduce((n, l) => n + l.text.length, 0)).toBe(663)
    for (const l of p) expect(PATH_LINES_AWAITING_RENDER).not.toContain(l.id)
  })

  it('the path lines name the land and the steps (§ 9.1)', () => {
    expect(pathLine('path.land.word-song.9')?.text).toBe(
      'Land 9: More words and stories.',
    )
    expect(pathLine('end.land.word-song.9')?.text).toBe(
      'A new land! Land 9: More words and stories!',
    )
    expect(pathLine('end.land.word-song.9.no-number')?.text).toBe(
      'A new land: More words and stories!',
    )
    expect(pathLine('path.open.snail-words')?.text).toBe(
      'Here is your path! You are on snail words.',
    )
    expect(pathLine('path.stop.goat-stories')?.text).toBe('Goat stories.')
    expect(pathLine('end.bud.moon-words')?.text).toBe(
      'Look! A new flower for moon words!',
    )
    expect(pathLine('end.unlock.snail-words')?.text).toBe(
      'You learned sheep stories! Now you can do snail words!',
    )
    expect(pathLine('end.unlock.goat-stories')?.text).toBe(
      'You learned moon words! Now you can do goat stories!',
    )
  })

  it('the "Then this!" lines keep their caption and go to Lily as "; then this!" (§ 9.1); shipped lines get no input', () => {
    for (const n of NEW) expect(THEN_THIS_INPUT_STEPS.has(n)).toBe(true)
    expect(pathLine('path.locked.next.snail-words')).toMatchObject({
      text: 'Snail words! First, sheep stories. Then this!',
      input: 'Snail words! First, sheep stories; then this!',
    })
    expect(pathLine('path.locked.next.moon-words')).toMatchObject({
      text: 'Moon words! First, snail words. Then this!',
      input: 'Moon words! First, snail words; then this!',
    })
    expect(pathLine('path.locked.next.goat-stories')).toMatchObject({
      text: 'Goat stories! First, moon words. Then this!',
      input: 'Goat stories! First, moon words; then this!',
    })
    for (const id of [
      'path.locked.next.car-words',
      'path.locked.next.sheep-stories',
      'path.open.snail-words',
    ])
      expect(pathLine(id)?.input, id).toBeUndefined()
    // Same length, same bill.
    for (const n of NEW) {
      const l = pathLine(`path.locked.next.${n}`)!
      expect(l.input!.length).toBe(l.text.length)
    }
  })

  it('the render script sends the input when there is one', () => {
    const src = readFileSync(
      join(process.cwd(), 'scripts/renderPathLinesLily.ts'),
      'utf8',
    )
    expect(src).toContain('l.input ?? l.text')
  })
})

// ── The 16 rows (§ 4.2, § 5.2) and the forbidden pairs (§ 8), AC 4 ──────

/** [word, gentle, trap], canon order. */
type Row = readonly [
  string,
  readonly [string, string],
  readonly [string, string],
]
const SNAIL_ROWS: readonly Row[] = [
  ['tray', ['hen', 'cup'], ['tree', 'train']],
  ['boat', ['sun', 'jug'], ['bat', 'bone']],
  ['snail', ['cup', 'bed'], ['seal', 'sack']],
  ['coat', ['hen', 'bus'], ['cot', 'goat']],
  ['train', ['nut', 'pen'], ['chain', 'tray']],
  ['loaf', ['sun', 'bed'], ['leaf', 'log']],
  ['goat', ['cup', 'net'], ['gum', 'coat']],
  ['chain', ['bug', 'sun'], ['can', 'train']],
]
const SNAIL_VOWELS = ['a', 'o', 'a', 'o', 'a', 'o', 'o', 'a']
const MOON_ROWS: readonly Row[] = [
  ['moon', ['hen', 'cup'], ['mop', 'spoon']],
  ['spoon', ['bug', 'jet'], ['sock', 'moon']],
  ['boot', ['fan', 'pig'], ['box', 'bone']],
  ['broom', ['hen', 'sun'], ['brick', 'boot']],
  ['tooth', ['cup', 'pig'], ['top', 'boot']],
  ['stool', ['jet', 'hen'], ['star', 'spoon']],
  ['hoop', ['bus', 'cup'], ['hot', 'roof']],
  ['roof', ['bed', 'fan'], ['rock', 'rope']],
]
const CATEGORIES: Record<string, string> = {
  tray: 'household',
  boat: 'vehicle',
  snail: 'animal',
  coat: 'clothing',
  train: 'vehicle',
  loaf: 'food',
  goat: 'animal',
  chain: 'object',
  moon: 'celestial',
  spoon: 'kitchen',
  boot: 'clothing',
  broom: 'household',
  tooth: 'body-part',
  stool: 'household',
  hoop: 'object',
  roof: 'structure',
}
const NEW_PAIRS = [
  ['tray', 'mat'],
  ['train', 'bus'],
  ['train', 'van'],
  ['train', 'car'],
  ['train', 'jeep'],
  ['chain', 'rope'],
  ['boat', 'ship'],
  ['boat', 'tub'],
  ['goat', 'sheep'],
  ['goat', 'dog'],
  ['goat', 'pig'],
  ['goat', 'cat'],
  ['loaf', 'bun'],
  ['snail', 'bug'],
  ['broom', 'mop'],
  ['boot', 'sock'],
  ['stool', 'desk'],
  ['hoop', 'ring'],
  ['roof', 'tent'],
  ['roof', 'barn'],
  ['coat', 'cape'],
] as const

describe('the 16 rows and the 21 new forbidden pairs (§ 4.2, § 5.2, § 8, AC 4)', () => {
  const rows = (step: string) =>
    BIG_WORDS_STEPS[step as BigWordsStep].map(
      (r) => [r.word, [...r.gentle], [...r.trap]] as const,
    )

  it('BIG_WORDS_STEPS holds the spec rows in canon order', () => {
    expect(rows(SNAIL)).toEqual(
      SNAIL_ROWS.map(([w, g, t]) => [w, [...g], [...t]]),
    )
    expect(rows(MOON)).toEqual(
      MOON_ROWS.map(([w, g, t]) => [w, [...g], [...t]]),
    )
    expect(BIG_WORDS_STEPS[SNAIL as BigWordsStep].map((r) => r.vowel)).toEqual(
      SNAIL_VOWELS,
    )
    for (const r of BIG_WORDS_STEPS[MOON as BigWordsStep])
      expect(r.vowel, r.word).toBe('o')
    for (const r of [
      ...BIG_WORDS_STEPS[SNAIL as BigWordsStep],
      ...BIG_WORDS_STEPS[MOON as BigWordsStep],
    ])
      expect(r.category, r.word).toBe(CATEGORIES[r.word])
  })

  it('the 16 words are new picture targets, one pack entry each (no word collides, K4)', () => {
    for (const [word] of [...SNAIL_ROWS, ...MOON_ROWS]) {
      const entries = ALL_WORDS.filter((e) => e.word === word)
      expect(entries, word).toHaveLength(1)
      expect(entries[0]).toEqual({
        word,
        pictureKey: word,
        vowel: entries[0]!.vowel,
        category: CATEGORIES[word],
        isTarget: true,
      })
    }
    // Every chip partner is a pack word.
    for (const [, gentle, trap] of [...SNAIL_ROWS, ...MOON_ROWS])
      for (const w of [...gentle, ...trap])
        expect(() => getWordEntry(w), w).not.toThrow()
  })

  it("TARGET_PAIRINGS gains the 16 words' rows", () => {
    for (const [word, gentle, trap] of [...SNAIL_ROWS, ...MOON_ROWS])
      expect(TARGET_PAIRINGS[word], word).toEqual({ gentle, trap })
  })

  it('adds the 21 forbidden pairs once each, and no trio holds a forbidden pair, old or new', () => {
    for (const [a, b] of NEW_PAIRS) {
      expect(isForbiddenPair(a, b), `${a}-${b}`).toBe(true)
      expect(
        FORBIDDEN_PAIRS.filter(
          ([x, y]) => (x === a && y === b) || (x === b && y === a),
        ),
      ).toHaveLength(1)
    }
    for (const [word, gentle, trap] of [...SNAIL_ROWS, ...MOON_ROWS])
      for (const trio of [
        [word, ...gentle],
        [word, ...trap],
      ])
        for (let i = 0; i < 3; i++)
          for (let j = i + 1; j < 3; j++)
            expect(isForbiddenPair(trio[i]!, trio[j]!), trio.join()).toBe(false)
  })

  it('gentle chips: another category, another first sound, no letter of the team (D5)', () => {
    const misses: string[] = []
    for (const [step, list, team] of [
      [SNAIL, SNAIL_ROWS, /[aioy]/],
      [MOON, MOON_ROWS, /o/],
    ] as const)
      for (const [word, gentle] of list)
        for (const g of gentle) {
          const d = getWordEntry(g)
          if (
            g[0] === word[0] ||
            team.test(g) ||
            d.category === CATEGORIES[word]
          )
            misses.push(`${step} ${word}: ${g}`)
        }
    expect(misses).toEqual([])
  })

  it('P1 of snail words ends in its team; P1 of moon words holds "oo" (the lead cues, § 4.3, § 5.3)', () => {
    expect(bigWordsOf(SNAIL as BigWordsStep)[0]).toBe('tray')
    expect(bigWordsOf(SNAIL as BigWordsStep)[0]!.slice(-2)).toBe('ay')
    expect(bigWordsOf(MOON as BigWordsStep)[0]).toBe('moon')
    expect(bigWordsOf(MOON as BigWordsStep)[0]).toContain('oo')
  })
})

describe('the progression into land 9 (AC 9)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  /** A baseline with every Word Song step mastered before `last`. */
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

  it("sheep stories mastered, no new keys → snail words 'intro', moon words and goat stories 'locked'; the Map owes sheep → snail, land 9", () => {
    const skillLevels = upTo('sheep-stories', 'mastered')
    for (const n of NEW) delete skillLevels[n]
    store(skillLevels, LITERACY_TREE.slice(1, LITERACY_TREE.indexOf(SNAIL)))
    const loaded = loadProgress()
    expect(isProgressV1(loaded)).toBe(true)
    expect(loaded!.skillLevels[SNAIL]).toBe('intro')
    expect(loaded!.skillLevels[MOON]).toBe('locked')
    expect(loaded!.skillLevels[GOAT]).toBe('locked')
    expect(pendingUnlock(loaded!, 'word-song')).toMatchObject({
      world: 'word-song',
      mastered: 'sheep-stories',
      unlocked: SNAIL,
    })
    expect(pendingUnlock(loaded!, 'word-song')?.land).not.toBeNull()
  })

  it("sheep stories practicing, no new keys → all 'locked'", () => {
    const skillLevels = upTo('sheep-stories', 'practicing')
    for (const n of NEW) delete skillLevels[n]
    store(skillLevels)
    const loaded = loadProgress()
    for (const n of NEW) expect(loaded?.skillLevels[n]).toBe('locked')
  })

  it("snail words mastered, no moon key → moon 'intro' (same land)", () => {
    const skillLevels = upTo(SNAIL, 'mastered')
    delete skillLevels[MOON]
    delete skillLevels[GOAT]
    store(skillLevels, LITERACY_TREE.slice(1, LITERACY_TREE.indexOf(MOON)))
    const loaded = loadProgress()
    expect(loaded!.skillLevels[MOON]).toBe('intro')
    expect(pendingUnlock(loaded!, 'word-song')).toEqual({
      world: 'word-song',
      mastered: SNAIL,
      unlocked: MOON,
      land: null,
    })
  })

  it('the focus picker walks snail → moon → goat', () => {
    const seed = defaultProgress('Marian')
    for (const [prev, n] of [
      ['sheep-stories', SNAIL],
      [SNAIL, MOON],
      [MOON, GOAT],
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

describe('the warm-up never serves a goat-story block (AC 7, K8)', () => {
  it('with moon words and goat stories mastered, the hearts come from moon words', () => {
    const seed = defaultProgress('Marian')
    const levels = { ...seed.skillLevels } as SkillLevels
    for (const n of LITERACY_TREE) levels[n] = 'mastered'
    // A world not yet complete: one earlier step is still practicing, so
    // the review pool is open and goat stories is its newest step.
    levels['cvc-words-short-e'] = 'practicing'
    const p: Progress = { ...seed, skillLevels: levels, history: [] }
    const now = Date.parse('2026-10-19T10:00:00Z')
    for (let seedN = 0; seedN < 8; seedN++) {
      const blocks = pickWarmupBlocks(p, 'word-song', now, '2026-10-19', seedN)
      expect(blocks.length).toBeGreaterThan(0)
      for (const b of blocks) expect(b.node).toBe(MOON)
    }
  })
})
