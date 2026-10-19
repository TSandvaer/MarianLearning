/**
 * Content wave 3, Number Garden: hundreds (`hundreds`), land 5 "Hundreds",
 * the new step after sharing (`design/native/content-wave-3.md` § 1,
 * § 3.1, § 3.6, § 5.1, AC 4, AC 7, AC 8).
 *
 * Failing-first: written before the step existed. It pins the progression
 * (div-share mastered → hundreds opens, on load and in the tree), the
 * step's wiring (tree order, land 5, the names, the leads, the path lines,
 * the path art) and the session end (3-digit answers kept, no fact), so a
 * partial landing of the step fails here rather than on a device.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GUIDANCE_LINES,
  GUIDANCE_LINES_AWAITING_RENDER,
  guidanceLine,
  sessionIntroLine,
} from '../emmasPath/guidanceLines'
import { landArtId, PATH_ART_IDS } from '../emmasPath/pathArt'
import {
  BAKED_PATH_LINES,
  PATH_LINES_AWAITING_RENDER,
  pathLine,
} from '../emmasPath/pathLines'
import { recordProgressOnSessionEnd } from '../sessionEnd/progressHistory'
import {
  FRIENDLY_NODE_NAMES,
  STAGE_SPOKEN_NAMES,
  STAGE_SPOKEN_NAME_VERBS,
} from '../sessionEnd/friendlyNodeName'
import { CANON_MATH_FACTS } from './canonMathFacts.generated'
import { defaultProgress } from './defaults'
import { MATH_NODES_IN_ORDER, pickFocusNode } from './focusNode'
import { isProgressV1 } from './guards'
import { LANDS } from './lands'
import { LITERACY_TREE, MATH_TREE, nextNode } from './mastery'
import { pendingUnlock } from './pathBeats'
import { pickWarmupBlocks } from './reviewPlan'
import { STORAGE_KEY, loadProgress } from './storage'
import type {
  NumberGardenNode,
  Progress,
  SkillLevel,
  SkillLevels,
} from './types'

/** Typed by a cast so this file typechecks before the literal exists. */
const HUNDREDS = 'hundreds' as NumberGardenNode

/** § 5.1's hundreds lines: guidance (lead, peek, replay) and path. */
const GUIDANCE_IDS = [
  'guide.session.intro.hundreds',
  'guide.session.peek-open.hundreds',
  'guide.session.peek-close.hundreds',
  'guide.session.replay-open.hundreds',
  'guide.session.replay-close.hundreds',
]
const PATH_IDS = [
  'path.open.hundreds',
  'path.stop.hundreds',
  'path.locked.next.hundreds',
  'end.bud.hundreds',
  'end.unlock.hundreds',
  'path.land.math.5',
  'end.land.math.5',
  'end.land.math.5.no-number',
]

describe('hundreds in the Number Garden tree (§ 1, § 3.1)', () => {
  it('follows div-share in both tree lists; more and less follows it (content wave 4)', () => {
    expect(MATH_TREE.slice(-3, -1)).toEqual(['div-share', HUNDREDS])
    expect(MATH_NODES_IN_ORDER.slice(-3, -1)).toEqual(['div-share', HUNDREDS])
    expect(nextNode('math', 'div-share')).toBe(HUNDREDS)
    expect(nextNode('math', HUNDREDS)).toBe('hundreds-addsub')
  })

  it('is land 5, Hundreds, of 5 Number Garden lands; LANDS flattened equals both trees (AC 7)', () => {
    const ng = LANDS.filter((l) => l.world === 'math')
    expect(ng).toHaveLength(5)
    // Content wave 4 adds more and less as its 2nd stop.
    expect(ng[4]).toEqual({
      world: 'math',
      number: 5,
      name: 'Hundreds',
      nodes: [HUNDREDS, 'hundreds-addsub'],
    })
    // Content wave 4 adds Word Song land 8, content wave 5 land 9.
    expect(LANDS.filter((l) => l.world === 'word-song')).toHaveLength(9)
    expect(LANDS.flatMap((l) => l.nodes)).toEqual([
      ...MATH_TREE,
      ...LITERACY_TREE,
    ])
  })

  it('has path art: the stop and land 5 (§ 1)', () => {
    for (const id of [HUNDREDS, 'land-ng-5']) expect(PATH_ART_IDS).toContain(id)
    expect(landArtId(LANDS.find((l) => l.name === 'Hundreds')!)).toBe(
      'land-ng-5',
    )
  })

  it("starts 'locked' for a fresh child", () => {
    expect(defaultProgress('Marian').skillLevels[HUNDREDS]).toBe('locked')
  })

  it('has its names: "hundreds", "are", recap "hundreds"; spoken names stay unique (T1, AC 7)', () => {
    expect(STAGE_SPOKEN_NAMES[HUNDREDS]).toBe('hundreds')
    expect(STAGE_SPOKEN_NAME_VERBS[HUNDREDS]).toBe('are')
    expect(FRIENDLY_NODE_NAMES[HUNDREDS]).toBe('hundreds')
    const nodes = [...MATH_TREE, ...LITERACY_TREE]
    expect(new Set(nodes.map((n) => STAGE_SPOKEN_NAMES[n])).size).toBe(
      nodes.length,
    )
  })

  it('has 8 canon problems and no fact (§ 3.6)', () => {
    expect(CANON_MATH_FACTS[HUNDREDS]).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ])
  })
})

describe('the hundreds lines (§ 5.1, AC 7)', () => {
  it('the lead, the peek and the replay lines', () => {
    expect(sessionIntroLine(HUNDREDS)).toMatchObject({
      id: 'guide.session.intro.hundreds',
      kind: 'session-intro',
      world: 'math',
      text: 'Hundreds, tens and ones!',
      src: '/assets/audio/path/guide-session-intro-hundreds.mp3',
    })
    expect(guidanceLine('guide.session.peek-open.hundreds')?.text).toBe(
      "Let's look at hundreds!",
    )
    expect(guidanceLine('guide.session.peek-close.hundreds')?.text).toBe(
      'Hundreds are for later. You will learn it!',
    )
    expect(guidanceLine('guide.session.replay-open.hundreds')?.text).toBe(
      "Let's play hundreds again!",
    )
    expect(guidanceLine('guide.session.replay-close.hundreds')?.text).toBe(
      'You know hundreds!',
    )
  })

  it('the path lines name the land and the step', () => {
    expect(PATH_IDS.map((id) => pathLine(id)?.text)).toEqual([
      'Here is your path! You are on hundreds.',
      'Hundreds.',
      'Hundreds! First, sharing. Then this!',
      'Look! A new flower for hundreds!',
      'You learned sharing! Now you can do hundreds!',
      'Land 5: Hundreds.',
      'A new land! Land 5: Hundreds!',
      'A new land: Hundreds!',
    ])
  })

  it('5 guidance lines and 8 path lines (133 / 228 characters), rendered in Lily', () => {
    const g = GUIDANCE_IDS.map((id) => guidanceLine(id)!)
    expect(g.reduce((n, l) => n + l.text.length, 0)).toBe(133)
    expect(
      GUIDANCE_LINES.filter((l) => l.id.endsWith('.hundreds')),
    ).toHaveLength(5)
    const p = PATH_IDS.map((id) => BAKED_PATH_LINES.find((l) => l.id === id))
    expect(p.every((l) => l !== undefined)).toBe(true)
    expect(p.reduce((n, l) => n + l!.text.length, 0)).toBe(228)
    for (const id of [...GUIDANCE_IDS, ...PATH_IDS]) {
      expect(GUIDANCE_LINES_AWAITING_RENDER).not.toContain(id)
      expect(PATH_LINES_AWAITING_RENDER).not.toContain(id)
    }
  })
})

describe('the progression into hundreds (AC 8)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  /** Marian's baseline with every math step mastered up to div-share. */
  function throughShare(shareLevel: SkillLevel): Record<string, unknown> {
    const seed = defaultProgress('Marian')
    const levels: Record<string, unknown> = { ...seed.skillLevels }
    for (const n of MATH_TREE) {
      if (n === 'div-share') break
      levels[n] = 'mastered'
    }
    levels['div-share'] = shareLevel
    return levels
  }

  it("no hundreds key with div-share mastered → 'intro'; the Map owes sharing → hundreds, land 5", () => {
    const seed = defaultProgress('Marian')
    const skillLevels = throughShare('mastered')
    delete skillLevels[HUNDREDS]
    const seen = MATH_TREE.slice(1, MATH_TREE.indexOf(HUNDREDS))
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seed, skillLevels, unlocksCelebrated: seen }),
    )
    const loaded = loadProgress()
    expect(isProgressV1(loaded)).toBe(true)
    expect(loaded!.skillLevels[HUNDREDS]).toBe('intro')
    const owed = pendingUnlock(loaded!, 'math')
    expect(owed).toMatchObject({
      world: 'math',
      mastered: 'div-share',
      unlocked: HUNDREDS,
    })
    expect(owed?.land).not.toBeNull()
  })

  it("div-share practicing and no hundreds key → 'locked'", () => {
    const seed = defaultProgress('Marian')
    const skillLevels = throughShare('practicing')
    delete skillLevels[HUNDREDS]
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seed, skillLevels }),
    )
    expect(loadProgress()?.skillLevels[HUNDREDS]).toBe('locked')
  })

  it('the focus picker lands on hundreds once sharing is mastered', () => {
    const seed = defaultProgress('Marian')
    const skillLevels = {
      ...throughShare('mastered'),
      [HUNDREDS]: 'intro',
    } as SkillLevels
    const { node } = pickFocusNode({ ...seed, skillLevels }, 'math', 10)
    expect(node).toBe(HUNDREDS)
  })

  it('the warm-up never serves a hundreds block (no fact)', () => {
    const seed = defaultProgress('Marian')
    const levels = { ...seed.skillLevels } as SkillLevels
    for (const n of MATH_TREE) levels[n] = 'mastered'
    const p: Progress = { ...seed, skillLevels: levels, history: [] }
    const now = Date.parse('2026-10-18T10:00:00Z')
    for (let s = 0; s < 8; s++)
      for (const b of pickWarmupBlocks(p, 'math', now, '2026-10-18', s))
        expect(b.node).not.toBe(HUNDREDS)
  })
})

describe('a hundreds session end (§ 3.6, AC 4)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('keeps the 3-digit taps, writes no mathFacts, and loads back', () => {
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 7,
      dateISO: '2026-10-18T12:00:00.000Z',
      focusNode: HUNDREDS,
      firstTapCorrect: [true, true, true, false, true, true, true, true],
      latencyMs: [3000, 2800, 2500, 4100, 3900, 3200, 3600, 3000],
      perProblemAnswerValue: [234, 352, 426, 573, 326, 253, 565, 738],
      perProblemDistractorClass: [
        'gentle',
        'gentle',
        'gentle',
        'digit-swap',
        'spoken-order',
        'wrong-place',
        'wrong-place',
        'wrong-place',
      ],
    })
    const loaded = loadProgress()
    expect(isProgressV1(loaded)).toBe(true)
    const entry = loaded!.history[0]!
    expect(entry.skillFocus).toEqual([HUNDREDS])
    expect(entry.perProblemAnswerValue).toEqual([
      234, 352, 426, 573, 326, 253, 565, 738,
    ])
    expect(entry.mathFacts).toBeUndefined()
  })
})
