/**
 * Content wave 4, Number Garden: more and less (`hundreds-addsub`), the 2nd
 * stop of land 5 "Hundreds", the step after hundreds
 * (`design/native/content-wave-4.md` § 1, § 2.1, § 2.6, § 8.1, AC 3, AC 8,
 * AC 9).
 *
 * Failing-first: written before the step existed. It pins the progression
 * (hundreds mastered → more and less opens, on load and in the tree), the
 * step's wiring (tree order, land 5's 2nd stop, the names, the lead, the
 * peek, replay and path lines, the path art) and the session end (3-digit
 * answers kept, § 2.7's classes, no fact), so a partial landing of the step
 * fails here rather than on a device.
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
import { pickWarmupBlocks, reviewPool } from './reviewPlan'
import { STORAGE_KEY, loadProgress } from './storage'
import type {
  NumberGardenNode,
  Progress,
  SkillLevel,
  SkillLevels,
} from './types'

/** Typed by a cast so this file typechecks before the literal exists. */
const ADDSUB = 'hundreds-addsub' as NumberGardenNode

/** § 8.1's more-and-less lines: guidance (lead, peek, replay) and path. */
const GUIDANCE: readonly [string, string][] = [
  ['guide.session.intro.hundreds-addsub', 'More and less!'],
  ['guide.session.peek-open.hundreds-addsub', "Let's look at more and less!"],
  [
    'guide.session.peek-close.hundreds-addsub',
    'More and less are for later. You will learn it!',
  ],
  [
    'guide.session.replay-open.hundreds-addsub',
    "Let's play more and less again!",
  ],
  ['guide.session.replay-close.hundreds-addsub', 'You know more and less!'],
]
const PATH: readonly [string, string][] = [
  ['path.open.hundreds-addsub', 'Here is your path! You are on more and less.'],
  ['path.stop.hundreds-addsub', 'More and less.'],
  [
    'path.locked.next.hundreds-addsub',
    'More and less! First, hundreds. Then this!',
  ],
  ['end.bud.hundreds-addsub', 'Look! A new flower for more and less!'],
  [
    'end.unlock.hundreds-addsub',
    'You learned hundreds! Now you can do more and less!',
  ],
]

describe('more and less in the Number Garden tree (§ 1, § 2.1)', () => {
  it('follows hundreds in both tree lists; zeros follows it (content wave 5)', () => {
    expect(MATH_TREE.slice(-4, -2)).toEqual(['hundreds', ADDSUB])
    expect(MATH_NODES_IN_ORDER.slice(-4, -2)).toEqual(['hundreds', ADDSUB])
    expect(nextNode('math', 'hundreds')).toBe(ADDSUB)
    expect(nextNode('math', ADDSUB)).toBe('hundreds-zeros')
  })

  it('is the 2nd stop of land 5, Hundreds, of 6 Number Garden lands; LANDS flattened equals both trees (AC 8)', () => {
    const ng = LANDS.filter((l) => l.world === 'math')
    // Content wave 5 adds land 6 and zeros as land 5's 3rd stop.
    expect(ng).toHaveLength(6)
    expect(ng[4]).toEqual({
      world: 'math',
      number: 5,
      name: 'Hundreds',
      nodes: ['hundreds', ADDSUB, 'hundreds-zeros'],
    })
    expect(LANDS.flatMap((l) => l.nodes)).toEqual([
      ...MATH_TREE,
      ...LITERACY_TREE,
    ])
  })

  it('has path art: the stop (the seesaw); land 5 keeps its own (§ 1)', () => {
    expect(PATH_ART_IDS).toContain(ADDSUB)
    expect(landArtId(LANDS.find((l) => l.name === 'Hundreds')!)).toBe(
      'land-ng-5',
    )
  })

  it("starts 'locked' for a fresh child", () => {
    expect(defaultProgress('Marian').skillLevels[ADDSUB]).toBe('locked')
  })

  it('has its names: "more and less", "are", recap "more and less"; spoken names stay unique (T1, AC 8)', () => {
    expect(STAGE_SPOKEN_NAMES[ADDSUB]).toBe('more and less')
    expect(STAGE_SPOKEN_NAME_VERBS[ADDSUB]).toBe('are')
    expect(FRIENDLY_NODE_NAMES[ADDSUB]).toBe('more and less')
    const nodes = [...MATH_TREE, ...LITERACY_TREE]
    expect(new Set(nodes.map((n) => STAGE_SPOKEN_NAMES[n])).size).toBe(
      nodes.length,
    )
  })

  it('has 8 canon problems and no fact (K8)', () => {
    expect(CANON_MATH_FACTS[ADDSUB]).toEqual(Array(8).fill(null))
  })
})

describe('the more-and-less lines (§ 8.1, AC 8)', () => {
  it('the lead, the peek and the replay lines', () => {
    expect(sessionIntroLine(ADDSUB)).toMatchObject({
      id: 'guide.session.intro.hundreds-addsub',
      kind: 'session-intro',
      world: 'math',
      text: 'More and less!',
      src: '/assets/audio/path/guide-session-intro-hundreds-addsub.mp3',
    })
    expect(GUIDANCE.map(([id]) => guidanceLine(id)?.text)).toEqual(
      GUIDANCE.map(([, text]) => text),
    )
  })

  it('the path lines name the step and hundreds before it', () => {
    expect(PATH.map(([id]) => pathLine(id)?.text)).toEqual(
      PATH.map(([, text]) => text),
    )
  })

  it('5 guidance lines and 5 path lines (143 / 188 characters), rendered in Lily', () => {
    expect(GUIDANCE.reduce((n, [, t]) => n + t.length, 0)).toBe(143)
    expect(
      GUIDANCE_LINES.filter((l) => l.id.endsWith('.hundreds-addsub')),
    ).toHaveLength(5)
    expect(
      BAKED_PATH_LINES.filter((l) => l.id.endsWith('.hundreds-addsub')).map(
        (l) => l.id,
      ),
    ).toEqual(PATH.map(([id]) => id))
    expect(PATH.reduce((n, [, t]) => n + t.length, 0)).toBe(188)
    for (const [id] of GUIDANCE)
      expect(GUIDANCE_LINES_AWAITING_RENDER).not.toContain(id)
    for (const [id] of PATH)
      expect(PATH_LINES_AWAITING_RENDER).not.toContain(id)
  })

  it("land 5's lines are unchanged: it is not new", () => {
    expect(pathLine('path.land.math.5')?.text).toBe('Land 5: Hundreds.')
    expect(PATH_LINES_AWAITING_RENDER).not.toContain('path.land.math.5')
    expect(PATH_LINES_AWAITING_RENDER).not.toContain('end.land.math.5')
  })
})

describe('the progression into more and less (AC 9)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  /** Marian's baseline with every math step mastered up to hundreds. */
  function throughHundreds(level: SkillLevel): Record<string, unknown> {
    const seed = defaultProgress('Marian')
    const levels: Record<string, unknown> = { ...seed.skillLevels }
    for (const n of MATH_TREE) {
      if (n === 'hundreds') break
      levels[n] = 'mastered'
    }
    levels['hundreds'] = level
    return levels
  }

  it("no hundreds-addsub key with hundreds mastered → 'intro'; the Map owes hundreds → more and less, no new land", () => {
    const seed = defaultProgress('Marian')
    const skillLevels = throughHundreds('mastered')
    delete skillLevels[ADDSUB]
    const seen = MATH_TREE.slice(1, MATH_TREE.indexOf(ADDSUB))
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seed, skillLevels, unlocksCelebrated: seen }),
    )
    const loaded = loadProgress()
    expect(isProgressV1(loaded)).toBe(true)
    expect(loaded!.skillLevels[ADDSUB]).toBe('intro')
    const owed = pendingUnlock(loaded!, 'math')
    expect(owed).toMatchObject({
      world: 'math',
      mastered: 'hundreds',
      unlocked: ADDSUB,
    })
    // The 2nd stop of a land: no land beat.
    expect(owed?.land).toBeNull()
  })

  it("hundreds practicing and no hundreds-addsub key → 'locked'", () => {
    const seed = defaultProgress('Marian')
    const skillLevels = throughHundreds('practicing')
    delete skillLevels[ADDSUB]
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seed, skillLevels }),
    )
    expect(loadProgress()?.skillLevels[ADDSUB]).toBe('locked')
  })

  it('the focus picker lands on more and less once hundreds is mastered', () => {
    const seed = defaultProgress('Marian')
    const skillLevels = {
      ...throughHundreds('mastered'),
      [ADDSUB]: 'intro',
    } as SkillLevels
    const { node } = pickFocusNode({ ...seed, skillLevels }, 'math', 10)
    expect(node).toBe(ADDSUB)
  })

  it('the warm-up never serves a more-and-less block (no fact); a mastered one joins reviews (K8)', () => {
    const seed = defaultProgress('Marian')
    const levels = { ...seed.skillLevels } as SkillLevels
    for (const n of MATH_TREE) levels[n] = 'mastered'
    const p: Progress = { ...seed, skillLevels: levels, history: [] }
    const now = Date.parse('2026-10-18T10:00:00Z')
    for (let s = 0; s < 8; s++)
      for (const b of pickWarmupBlocks(p, 'math', now, '2026-10-18', s))
        expect(b.node).not.toBe(ADDSUB)
    // A world with one step left still reviews: more and less is in the
    // pool once mastered (hundreds still practicing here).
    const one = {
      ...p,
      skillLevels: { ...levels, hundreds: 'practicing' } as SkillLevels,
    }
    expect(reviewPool(one, 'math')).toContain(ADDSUB)
  })
})

describe('a more-and-less session end (§ 2.6, AC 3)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('keeps the 3-digit taps, records § 2.7’s classes, writes no mathFacts, and loads back', () => {
    const classes = [
      'gentle',
      'gentle',
      'gentle',
      'wrong-place',
      'wrong-place',
      'wrong-op',
      'wrong-op',
      'wrong-place',
    ]
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 7,
      dateISO: '2026-10-18T12:00:00.000Z',
      focusNode: ADDSUB,
      firstTapCorrect: [true, true, true, true, true, false, true, true],
      latencyMs: [3000, 2800, 2500, 4100, 3900, 3200, 3600, 3000],
      perProblemAnswerValue: [435, 354, 726, 562, 645, 853, 735, 328],
      perProblemDistractorClass: classes,
    })
    const loaded = loadProgress()
    expect(isProgressV1(loaded)).toBe(true)
    const entry = loaded!.history[0]!
    expect(entry.skillFocus).toEqual([ADDSUB])
    expect(entry.perProblemAnswerValue).toEqual([
      435, 354, 726, 562, 645, 853, 735, 328,
    ])
    expect(entry.perProblemDistractorClass).toEqual(classes)
    expect(entry.mathFacts).toBeUndefined()
  })
})
