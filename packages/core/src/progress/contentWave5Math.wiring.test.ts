/**
 * Content wave 5, Number Garden: zeros (`hundreds-zeros`), the 3rd stop of
 * land 5 "Hundreds", and adding big numbers (`add-two-digit`), the first
 * stop of a new land 6 "Bigger numbers" (`design/native/content-wave-5.md`
 * § 1, § 2.1, § 3.1, § 9.1, K8, AC 7, AC 8, AC 9).
 *
 * Failing-first: written before either step existed. It pins the
 * progression (more and less mastered → zeros opens; zeros mastered →
 * adding big numbers opens with a land beat), the wiring (tree order,
 * lands, names, leads, peek, replay and path lines and their "; then
 * this!" render input, path art) and the session ends (zeros: no fact;
 * adding big numbers: its 8 facts, a warm-up block like the two-digit
 * steps'), so a partial landing fails here rather than on a device.
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
  PATH_LINES,
  PATH_LINES_AWAITING_RENDER,
  pathLine,
  THEN_THIS_INPUT_STEPS,
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

/** Typed by a cast so this file typechecks before the literals exist. */
const ZEROS = 'hundreds-zeros' as NumberGardenNode
const ADD = 'add-two-digit' as NumberGardenNode

/** § 9.1's guidance lines (lead, peek, replay) of the two steps. */
const GUIDANCE: readonly [string, string][] = [
  ['guide.session.intro.hundreds-zeros', 'No tens? Zero tens!'],
  ['guide.session.peek-open.hundreds-zeros', "Let's look at zeros!"],
  [
    'guide.session.peek-close.hundreds-zeros',
    'Zeros are for later. You will learn it!',
  ],
  ['guide.session.replay-open.hundreds-zeros', "Let's play zeros again!"],
  ['guide.session.replay-close.hundreds-zeros', 'You know zeros!'],
  ['guide.session.intro.add-two-digit', 'Tens and ones!'],
  [
    'guide.session.peek-open.add-two-digit',
    "Let's look at adding big numbers!",
  ],
  [
    'guide.session.peek-close.add-two-digit',
    'Adding big numbers is for later. You will learn it!',
  ],
  [
    'guide.session.replay-open.add-two-digit',
    "Let's play adding big numbers again!",
  ],
  ['guide.session.replay-close.add-two-digit', 'You know adding big numbers!'],
]
/** § 9.1's path lines, in `PATH_LINES` order within each step. */
const PATH: readonly [string, string][] = [
  ['path.open.hundreds-zeros', 'Here is your path! You are on zeros.'],
  [
    'path.open.add-two-digit',
    'Here is your path! You are on adding big numbers.',
  ],
  ['path.stop.hundreds-zeros', 'Zeros.'],
  ['path.stop.add-two-digit', 'Adding big numbers.'],
  ['path.land.math.6', 'Land 6: Bigger numbers.'],
  [
    'path.locked.next.hundreds-zeros',
    'Zeros! First, more and less. Then this!',
  ],
  [
    'path.locked.next.add-two-digit',
    'Adding big numbers! First, zeros. Then this!',
  ],
  ['end.bud.hundreds-zeros', 'Look! A new flower for zeros!'],
  ['end.bud.add-two-digit', 'Look! A new flower for adding big numbers!'],
  [
    'end.unlock.hundreds-zeros',
    'You learned more and less! Now you can do zeros!',
  ],
  [
    'end.unlock.add-two-digit',
    'You learned zeros! Now you can do adding big numbers!',
  ],
  ['end.land.math.6', 'A new land! Land 6: Bigger numbers!'],
  ['end.land.math.6.no-number', 'A new land: Bigger numbers!'],
]

describe('the two steps in the Number Garden tree (§ 1, § 2.1, § 3.1)', () => {
  it('follow more and less, zeros then adding big numbers, in both tree lists', () => {
    expect(MATH_TREE.slice(-3)).toEqual(['hundreds-addsub', ZEROS, ADD])
    expect(MATH_NODES_IN_ORDER.slice(-3)).toEqual([
      'hundreds-addsub',
      ZEROS,
      ADD,
    ])
    expect(nextNode('math', 'hundreds-addsub')).toBe(ZEROS)
    expect(nextNode('math', ZEROS)).toBe(ADD)
    expect(nextNode('math', ADD)).toBeNull()
  })

  it('zeros is land 5\'s 3rd stop; land 6 "Bigger numbers" holds adding big numbers; LANDS flattened equals both trees (AC 8)', () => {
    const ng = LANDS.filter((l) => l.world === 'math')
    expect(ng).toHaveLength(6)
    expect(ng[4]).toEqual({
      world: 'math',
      number: 5,
      name: 'Hundreds',
      nodes: ['hundreds', 'hundreds-addsub', ZEROS],
    })
    expect(ng[5]).toEqual({
      world: 'math',
      number: 6,
      name: 'Bigger numbers',
      nodes: [ADD],
    })
    expect(LANDS.flatMap((l) => l.nodes)).toEqual([
      ...MATH_TREE,
      ...LITERACY_TREE,
    ])
  })

  it('has path art: both stops and land 6 (§ 1)', () => {
    for (const id of [ZEROS, ADD, 'land-ng-6'])
      expect(PATH_ART_IDS).toContain(id)
    expect(landArtId(LANDS.find((l) => l.name === 'Bigger numbers')!)).toBe(
      'land-ng-6',
    )
  })

  it("both start 'locked' for a fresh learner", () => {
    const fresh = defaultProgress('Marian').skillLevels
    expect(fresh[ZEROS]).toBe('locked')
    expect(fresh[ADD]).toBe('locked')
  })

  it('have their names (T1): "zeros" / "are", "adding big numbers" / "is"; spoken names stay unique (AC 8)', () => {
    expect(STAGE_SPOKEN_NAMES[ZEROS]).toBe('zeros')
    expect(STAGE_SPOKEN_NAME_VERBS[ZEROS]).toBe('are')
    expect(FRIENDLY_NODE_NAMES[ZEROS]).toBe('zeros')
    expect(STAGE_SPOKEN_NAMES[ADD]).toBe('adding big numbers')
    expect(STAGE_SPOKEN_NAME_VERBS[ADD]).toBe('is')
    expect(FRIENDLY_NODE_NAMES[ADD]).toBe('adding big numbers')
    const nodes = [...MATH_TREE, ...LITERACY_TREE]
    expect(new Set(nodes.map((n) => STAGE_SPOKEN_NAMES[n])).size).toBe(
      nodes.length,
    )
  })

  it('zeros records no fact; adding big numbers records its 8 sums (K8)', () => {
    expect(CANON_MATH_FACTS[ZEROS]).toEqual(Array(8).fill(null))
    expect(CANON_MATH_FACTS[ADD]).toEqual([
      { a: 34, b: 25, op: '+' },
      { a: 42, b: 36, op: '+' },
      { a: 28, b: 35, op: '+' },
      { a: 47, b: 26, op: '+' },
      { a: 39, b: 44, op: '+' },
      { a: 56, b: 28, op: '+' },
      { a: 29, b: 33, op: '+' },
      { a: 65, b: 27, op: '+' },
    ])
  })
})

describe('the lines (§ 9.1, AC 8)', () => {
  it('the leads, the peeks and the replays', () => {
    expect(sessionIntroLine(ZEROS)).toMatchObject({
      id: 'guide.session.intro.hundreds-zeros',
      kind: 'session-intro',
      world: 'math',
      text: 'No tens? Zero tens!',
      src: '/assets/audio/path/guide-session-intro-hundreds-zeros.mp3',
    })
    expect(sessionIntroLine(ADD)?.text).toBe('Tens and ones!')
    expect(GUIDANCE.map(([id]) => guidanceLine(id)?.text)).toEqual(
      GUIDANCE.map(([, text]) => text),
    )
    expect(
      GUIDANCE_LINES.filter(
        (l) =>
          l.id.endsWith('.hundreds-zeros') || l.id.endsWith('.add-two-digit'),
      ),
    ).toHaveLength(10)
    expect(GUIDANCE.reduce((n, [, t]) => n + t.length, 0)).toBe(278)
  })

  it('the path lines name the steps, land 6 and the step before each', () => {
    expect(PATH.map(([id]) => pathLine(id)?.text)).toEqual(
      PATH.map(([, text]) => text),
    )
    const mine = BAKED_PATH_LINES.filter(
      (l) =>
        l.id.endsWith('.hundreds-zeros') ||
        l.id.endsWith('.add-two-digit') ||
        /\.math\.6(\.|$)/.test(l.id),
    )
    expect(mine.map((l) => l.id)).toEqual(PATH.map(([id]) => id))
    expect(PATH.reduce((n, [, t]) => n + t.length, 0)).toBe(450)
  })

  it('the locked-next lines render from "; then this!" (wave 5 § 9.1, #607 take 3); their captions keep ". Then this!"', () => {
    expect(THEN_THIS_INPUT_STEPS.has(ZEROS)).toBe(true)
    expect(THEN_THIS_INPUT_STEPS.has(ADD)).toBe(true)
    expect(pathLine('path.locked.next.hundreds-zeros')).toMatchObject({
      text: 'Zeros! First, more and less. Then this!',
      input: 'Zeros! First, more and less; then this!',
    })
    expect(pathLine('path.locked.next.add-two-digit')).toMatchObject({
      text: 'Adding big numbers! First, zeros. Then this!',
      input: 'Adding big numbers! First, zeros; then this!',
    })
    // Shipped lines keep no input, so nothing rendered re-renders.
    expect(pathLine('path.locked.next.hundreds-addsub')?.input).toBeUndefined()
    for (const l of PATH_LINES)
      if (l.input !== undefined) {
        expect(l.kind).toBe('locked-next')
        expect(l.input.length).toBe(l.text.length)
      }
  })

  it('every new line awaits its Lily render; land 5 and more and less are not new', () => {
    for (const [id] of GUIDANCE)
      expect(GUIDANCE_LINES_AWAITING_RENDER).toContain(id)
    for (const [id] of PATH) expect(PATH_LINES_AWAITING_RENDER).toContain(id)
    for (const id of ['path.land.math.5', 'path.open.hundreds-addsub'])
      expect(PATH_LINES_AWAITING_RENDER).not.toContain(id)
  })
})

describe('the progression into the two steps (AC 9)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  /** Every math step mastered up to `upTo`, which gets `level`. */
  function through(
    upTo: NumberGardenNode,
    level: SkillLevel,
  ): Record<string, unknown> {
    const seed = defaultProgress('Marian')
    const levels: Record<string, unknown> = { ...seed.skillLevels }
    for (const n of MATH_TREE) {
      if (n === upTo) break
      levels[n] = 'mastered'
    }
    levels[upTo] = level
    return levels
  }

  it("more and less mastered, no new keys → zeros 'intro', adding big numbers 'locked'; the Map owes more and less → zeros, no land", () => {
    const seed = defaultProgress('Marian')
    const skillLevels = through('hundreds-addsub', 'mastered')
    delete skillLevels[ZEROS]
    delete skillLevels[ADD]
    const seen = MATH_TREE.slice(1, MATH_TREE.indexOf(ZEROS))
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seed, skillLevels, unlocksCelebrated: seen }),
    )
    const loaded = loadProgress()
    expect(isProgressV1(loaded)).toBe(true)
    expect(loaded!.skillLevels[ZEROS]).toBe('intro')
    expect(loaded!.skillLevels[ADD]).toBe('locked')
    const owed = pendingUnlock(loaded!, 'math')
    expect(owed).toMatchObject({
      world: 'math',
      mastered: 'hundreds-addsub',
      unlocked: ZEROS,
    })
    expect(owed?.land).toBeNull()
  })

  it("zeros mastered, no adding-big-numbers key → 'intro'; the Map owes zeros → adding big numbers with land 6's beat", () => {
    const seed = defaultProgress('Marian')
    const skillLevels = through(ZEROS, 'mastered')
    delete skillLevels[ADD]
    const seen = MATH_TREE.slice(1, MATH_TREE.indexOf(ADD))
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seed, skillLevels, unlocksCelebrated: seen }),
    )
    const loaded = loadProgress()
    expect(loaded!.skillLevels[ADD]).toBe('intro')
    const owed = pendingUnlock(loaded!, 'math')
    expect(owed).toMatchObject({ mastered: ZEROS, unlocked: ADD })
    expect(owed?.land).toMatchObject({ number: 6, name: 'Bigger numbers' })
  })

  it("more and less practicing → zeros stays 'locked'", () => {
    const seed = defaultProgress('Marian')
    const skillLevels = through('hundreds-addsub', 'practicing')
    delete skillLevels[ZEROS]
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seed, skillLevels }),
    )
    expect(loadProgress()?.skillLevels[ZEROS]).toBe('locked')
  })

  it('the focus picker lands on each step in turn', () => {
    const seed = defaultProgress('Marian')
    const z = { ...through('hundreds-addsub', 'mastered'), [ZEROS]: 'intro' }
    expect(
      pickFocusNode({ ...seed, skillLevels: z as SkillLevels }, 'math', 10)
        .node,
    ).toBe(ZEROS)
    const a = { ...through(ZEROS, 'mastered'), [ADD]: 'intro' }
    expect(
      pickFocusNode({ ...seed, skillLevels: a as SkillLevels }, 'math', 10)
        .node,
    ).toBe(ADD)
  })

  it('the warm-up never serves a zeros block (no fact) and may serve an adding-big-numbers one; both join reviews once mastered (K8, AC 7)', () => {
    const seed = defaultProgress('Marian')
    const levels = { ...seed.skillLevels } as SkillLevels
    for (const n of MATH_TREE) levels[n] = 'mastered'
    // P3's fact, always due (lastSeen 0): adding big numbers' block serves
    // it, as a two-digit step's block serves its own fact.
    const p: Progress = {
      ...seed,
      skillLevels: levels,
      history: [],
      mathFactsLeitner: {
        items: [{ item: { a: 28, b: 35, op: '+' }, box: 2, lastSeen: 0 }],
      },
    }
    const now = Date.parse('2026-10-20T10:00:00Z')
    for (let s = 0; s < 8; s++) {
      const blocks = pickWarmupBlocks(p, 'math', now, '2026-10-20', s)
      expect(blocks).toEqual([{ node: ADD, problem: 3 }])
      for (const b of blocks) expect(b.node).not.toBe(ZEROS)
    }
    const one = {
      ...p,
      skillLevels: { ...levels, hundreds: 'practicing' } as SkillLevels,
    }
    expect(reviewPool(one, 'math')).toEqual(
      expect.arrayContaining([ZEROS, ADD]),
    )
  })
})

describe('the session ends (§ 2.6, § 3.6, AC 3)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('zeros keeps its taps (a zero-drop tap is two digits), records § 2.7’s classes and no mathFacts', () => {
    const classes = [
      'gentle',
      'gentle',
      'gentle',
      'zero-drop',
      'zero-drop',
      'wrong-place',
      'wrong-place',
      'wrong-place',
    ]
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 7,
      dateISO: '2026-10-20T12:00:00.000Z',
      focusNode: ZEROS,
      firstTapCorrect: [true, true, true, false, true, true, true, true],
      latencyMs: [3000, 2800, 2500, 4100, 3900, 3200, 3600, 3000],
      perProblemAnswerValue: [305, 460, 700, 18, 190, 315, 740, 406],
      perProblemDistractorClass: classes,
    })
    const loaded = loadProgress()
    expect(isProgressV1(loaded)).toBe(true)
    const entry = loaded!.history[0]!
    expect(entry.skillFocus).toEqual([ZEROS])
    expect(entry.perProblemAnswerValue).toEqual([
      305, 460, 700, 18, 190, 315, 740, 406,
    ])
    expect(entry.perProblemDistractorClass).toEqual(classes)
    expect(entry.mathFacts).toBeUndefined()
  })
})
