/**
 * Content wave 3, Word Song: fox stories, hen stories and bug stories,
 * land 7 "Stories" (`design/native/content-wave-3.md` § 1, § 4.1, § 5.1,
 * AC 6, AC 7, AC 8).
 *
 * Failing-first: it pins the progression (cake words mastered → fox
 * stories opens, then hen, then bug, on load and in the tree), the steps'
 * wiring (tree order, land 7, the names, the leads, the story lines, the
 * path lines) and the warm-up rule (never a story block), so a partial
 * landing fails here rather than on a device.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GUIDANCE_LINES,
  GUIDANCE_LINES_AWAITING_RENDER,
  guidanceLine,
  sessionIntroLine,
  storyReadLine,
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
import { STORY_NODES, STORY_WORDS } from '../wordSong/littleStories'
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
const FOX = 'fox-stories' as WordSongNode
const HEN = 'hen-stories' as WordSongNode
const BUG = 'bug-stories' as WordSongNode

describe('the three story steps in the Word Song tree (§ 1, § 4.1)', () => {
  it('follow cake words, in both tree lists', () => {
    // Content wave 4 appends land 8 after bug stories.
    const at = LITERACY_TREE.indexOf('cake-words')
    expect(LITERACY_TREE.slice(at, at + 4)).toEqual([
      'cake-words',
      FOX,
      HEN,
      BUG,
    ])
    expect(WORD_SONG_NODES_IN_ORDER.slice(at, at + 4)).toEqual([
      'cake-words',
      FOX,
      HEN,
      BUG,
    ])
    expect(nextNode('word-song', 'cake-words')).toBe(FOX)
    expect(nextNode('word-song', FOX)).toBe(HEN)
    expect(nextNode('word-song', HEN)).toBe(BUG)
    expect(nextNode('word-song', BUG)).toBe('bee-words')
    expect(STORY_NODES).toEqual([
      FOX,
      HEN,
      BUG,
      'sheep-stories',
      'goat-stories',
    ])
  })

  it('are land 7, Stories, of the Word Song lands; LANDS flattened equals both trees (AC 7)', () => {
    const ws = LANDS.filter((l) => l.world === 'word-song')
    // Content wave 4 adds land 8, content wave 5 land 9.
    expect(ws).toHaveLength(9)
    expect(ws[6]).toEqual({
      world: 'word-song',
      number: 7,
      name: 'Stories',
      nodes: [FOX, HEN, BUG],
    })
    expect(LANDS.flatMap((l) => l.nodes)).toEqual([
      ...MATH_TREE,
      ...LITERACY_TREE,
    ])
  })

  it('have path art: the three stops and land 7 (§ 1)', () => {
    for (const id of [FOX, HEN, BUG, 'land-ws-7'])
      expect(PATH_ART_IDS).toContain(id)
    expect(landArtId(LANDS.find((l) => l.name === 'Stories')!)).toBe(
      'land-ws-7',
    )
  })

  it("start 'locked' for a fresh child", () => {
    const levels = defaultProgress('Marian').skillLevels
    for (const n of [FOX, HEN, BUG]) expect(levels[n]).toBe('locked')
  })

  it('have their names: "fox / hen / bug stories", "are", recap "reading stories"; spoken names stay unique (T1, AC 7)', () => {
    expect(STAGE_SPOKEN_NAMES[FOX]).toBe('fox stories')
    expect(STAGE_SPOKEN_NAMES[HEN]).toBe('hen stories')
    expect(STAGE_SPOKEN_NAMES[BUG]).toBe('bug stories')
    for (const n of [FOX, HEN, BUG]) {
      expect(STAGE_SPOKEN_NAME_VERBS[n]).toBe('are')
      expect(FRIENDLY_NODE_NAMES[n]).toBe('reading stories')
    }
    const nodes = [...MATH_TREE, ...LITERACY_TREE]
    expect(new Set(nodes.map((n) => STAGE_SPOKEN_NAMES[n])).size).toBe(
      nodes.length,
    )
  })
})

describe('the story lines (§ 5.1, AC 7)', () => {
  it('the leads share one frame (D12)', () => {
    expect(sessionIntroLine(FOX)?.text).toBe('Read the story. Who is it?')
    expect(sessionIntroLine(HEN)?.text).toBe('Read the story. What is it?')
    expect(sessionIntroLine(BUG)?.text).toBe('Read the story. Where is it?')
  })

  it('"Read the story." and one clip per story word: 54 clips, 224 characters', () => {
    expect(storyReadLine()).toMatchObject({
      id: 'guide.story.read',
      kind: 'story-read',
      world: 'word-song',
      text: 'Read the story.',
      src: '/assets/audio/path/guide-story-read.mp3',
    })
    // Wave 3's 54; content wave 4's 17 follow, rendered from "Word,".
    const words = GUIDANCE_LINES.filter(
      (l) => l.kind === 'story-word' && l.input === undefined,
    )
    expect(words).toHaveLength(54)
    expect(words.reduce((n, l) => n + l.text.length, 0)).toBe(224)
    expect(words.map((l) => l.id)).toEqual(
      STORY_WORDS.slice(0, 54).map((w) => `guide.story.word.${w}`),
    )
    expect(storyWordLine('fox')).toMatchObject({
      text: 'Fox.',
      src: '/assets/audio/path/guide-story-word-fox.mp3',
    })
    expect(storyWordLine('a')?.text).toBe('A.')
    expect(storyWordLine('the')?.text).toBe('The.')
  })

  it('peek, intro and replay lines for each step', () => {
    expect(guidanceLine('guide.session.peek-open.hen-stories')?.text).toBe(
      "Let's look at hen stories!",
    )
    expect(guidanceLine('guide.session.peek-close.bug-stories')?.text).toBe(
      'Bug stories are for later. You will learn it!',
    )
    expect(guidanceLine('guide.session.replay-open.fox-stories')?.text).toBe(
      "Let's play fox stories again!",
    )
    expect(guidanceLine('guide.session.replay-close.fox-stories')?.text).toBe(
      'You know fox stories!',
    )
  })

  it('70 guidance lines and 18 path lines (683 / 614 characters), rendered in Lily', () => {
    const g = GUIDANCE_LINES.filter(
      (l) =>
        l.kind === 'story-read' ||
        (l.kind === 'story-word' && l.input === undefined) ||
        [FOX, HEN, BUG].some((n) => l.id.endsWith(`.${n}`)),
    )
    expect(g).toHaveLength(70)
    expect(g.reduce((n, l) => n + l.text.length, 0)).toBe(683)
    const p = BAKED_PATH_LINES.filter(
      (l) =>
        /\.word-song\.7(\.|$)/.test(l.id) ||
        /\.(fox|hen|bug)-stories$/.test(l.id),
    )
    expect(p).toHaveLength(18)
    expect(p.reduce((n, l) => n + l.text.length, 0)).toBe(614)
    // None of the story lines awaits a render.
    for (const l of [...g, ...p]) {
      expect(GUIDANCE_LINES_AWAITING_RENDER).not.toContain(l.id)
      expect(PATH_LINES_AWAITING_RENDER).not.toContain(l.id)
    }
  })

  it('the path lines name the land and the steps', () => {
    expect(pathLine('path.land.word-song.7')?.text).toBe('Land 7: Stories.')
    expect(pathLine('end.land.word-song.7')?.text).toBe(
      'A new land! Land 7: Stories!',
    )
    expect(pathLine('end.land.word-song.7.no-number')?.text).toBe(
      'A new land: Stories!',
    )
    expect(pathLine('path.locked.next.fox-stories')?.text).toBe(
      'Fox stories! First, cake words. Then this!',
    )
    expect(pathLine('end.unlock.bug-stories')?.text).toBe(
      'You learned hen stories! Now you can do bug stories!',
    )
  })
})

describe('the progression into the stories (AC 8)', () => {
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

  it("cake words mastered, no story keys → fox 'intro', hen and bug 'locked'; the Map owes cake → fox, land 7", () => {
    const skillLevels = upTo('cake-words', 'mastered')
    for (const n of [FOX, HEN, BUG]) delete skillLevels[n]
    store(skillLevels, LITERACY_TREE.slice(1, LITERACY_TREE.indexOf(FOX)))
    const loaded = loadProgress()
    expect(isProgressV1(loaded)).toBe(true)
    expect(loaded!.skillLevels[FOX]).toBe('intro')
    expect(loaded!.skillLevels[HEN]).toBe('locked')
    expect(loaded!.skillLevels[BUG]).toBe('locked')
    expect(pendingUnlock(loaded!, 'word-song')).toMatchObject({
      world: 'word-song',
      mastered: 'cake-words',
      unlocked: FOX,
    })
    expect(pendingUnlock(loaded!, 'word-song')?.land).not.toBeNull()
  })

  it("cake words practicing, no story keys → all 'locked'", () => {
    const skillLevels = upTo('cake-words', 'practicing')
    for (const n of [FOX, HEN, BUG]) delete skillLevels[n]
    store(skillLevels)
    const loaded = loadProgress()
    for (const n of [FOX, HEN, BUG])
      expect(loaded?.skillLevels[n]).toBe('locked')
  })

  it("fox stories mastered, no hen key → hen 'intro' (same land)", () => {
    const skillLevels = upTo(FOX, 'mastered')
    delete skillLevels[HEN]
    delete skillLevels[BUG]
    store(skillLevels, LITERACY_TREE.slice(1, LITERACY_TREE.indexOf(HEN)))
    const loaded = loadProgress()
    expect(loaded!.skillLevels[HEN]).toBe('intro')
    expect(pendingUnlock(loaded!, 'word-song')).toEqual({
      world: 'word-song',
      mastered: FOX,
      unlocked: HEN,
      land: null,
    })
  })

  it('the focus picker walks fox → hen → bug', () => {
    const seed = defaultProgress('Marian')
    for (const [prev, n] of [
      ['cake-words', FOX],
      [FOX, HEN],
      [HEN, BUG],
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

describe('the warm-up never serves a story block (AC 6, D7)', () => {
  it('with fox and hen stories mastered, the hearts come from cake words', () => {
    const seed = defaultProgress('Marian')
    const levels = { ...seed.skillLevels } as SkillLevels
    for (const n of LITERACY_TREE) levels[n] = 'mastered'
    levels[BUG] = 'practicing'
    // Land 8 (content wave 4) is still ahead of her.
    for (const n of LITERACY_TREE.slice(LITERACY_TREE.indexOf(BUG) + 1))
      levels[n] = 'locked'
    const p: Progress = { ...seed, skillLevels: levels, history: [] }
    const now = Date.parse('2026-10-17T10:00:00Z')
    for (let seedN = 0; seedN < 8; seedN++) {
      const blocks = pickWarmupBlocks(p, 'word-song', now, '2026-10-17', seedN)
      expect(blocks.length).toBeGreaterThan(0)
      for (const b of blocks) expect(b.node).toBe('cake-words')
    }
  })
})
