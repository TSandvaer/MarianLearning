/**
 * Content wave 2, Number Garden: sharing (`div-share`), the new step after
 * all the groups (`design/native/content-wave-2.md` § 1, § 2.1, AC 5, AC 7).
 *
 * Failing-first: written before the step existed. It pins the progression
 * (mult-mix mastered → div-share opens, on load and in the tree) and the
 * step's wiring (tree order, land 4, the names), so a partial landing of
 * the step fails here rather than on a device.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { STAGE_SPOKEN_NAMES } from '../sessionEnd/friendlyNodeName'
import {
  FRIENDLY_NODE_NAMES,
  STAGE_SPOKEN_NAME_VERBS,
} from '../sessionEnd/friendlyNodeName'
import { defaultProgress } from './defaults'
import { pickFocusNode } from './focusNode'
import { MATH_NODES_IN_ORDER } from './focusNode'
import { isProgressV1 } from './guards'
import { LANDS } from './lands'
import { LITERACY_TREE, MATH_TREE, nextNode } from './mastery'
import { pendingUnlock } from './pathBeats'
import { STORAGE_KEY, loadProgress } from './storage'
import type { NumberGardenNode, SkillLevel } from './types'

/** Typed by a cast so this file typechecks before the literal exists. */
const DIV_SHARE = 'div-share' as NumberGardenNode

describe('div-share in the Number Garden tree (§ 1, § 2.1)', () => {
  it('is the last step, after mult-mix, in both tree lists', () => {
    expect(MATH_TREE.slice(-2)).toEqual(['mult-mix', DIV_SHARE])
    expect(MATH_NODES_IN_ORDER.slice(-2)).toEqual(['mult-mix', DIV_SHARE])
    expect(nextNode('math', 'mult-mix')).toBe(DIV_SHARE)
    expect(nextNode('math', DIV_SHARE)).toBeNull()
  })

  it('is the 5th stop of land 4, Groups; LANDS flattened equals both trees (AC 5)', () => {
    const groups = LANDS.find((l) => l.world === 'math' && l.number === 4)
    expect(groups?.name).toBe('Groups')
    expect(groups?.nodes).toEqual([
      'mult-2-5-10',
      'mult-3-4',
      'mult-6-9',
      'mult-mix',
      DIV_SHARE,
    ])
    expect(LANDS.flatMap((l) => l.nodes)).toEqual([
      ...MATH_TREE,
      ...LITERACY_TREE,
    ])
  })

  it("starts 'locked' for a fresh child", () => {
    expect(defaultProgress('Marian').skillLevels[DIV_SHARE]).toBe('locked')
  })

  it('has its names: "sharing", "is", recap "sharing"; spoken names stay unique (AC 5)', () => {
    expect(STAGE_SPOKEN_NAMES[DIV_SHARE]).toBe('sharing')
    expect(STAGE_SPOKEN_NAME_VERBS[DIV_SHARE]).toBe('is')
    expect(FRIENDLY_NODE_NAMES[DIV_SHARE]).toBe('sharing')
    const nodes = [...MATH_TREE, ...LITERACY_TREE]
    expect(new Set(nodes.map((n) => STAGE_SPOKEN_NAMES[n])).size).toBe(
      nodes.length,
    )
  })
})

describe('the progression into sharing', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  /** Marian's baseline with every math step mastered up to mult-mix. */
  function throughMix(mixLevel: SkillLevel): Record<string, unknown> {
    const seed = defaultProgress('Marian')
    const levels: Record<string, unknown> = { ...seed.skillLevels }
    for (const n of MATH_TREE) {
      if (n === 'mult-mix') break
      levels[n] = 'mastered'
    }
    levels['mult-mix'] = mixLevel
    return levels
  }

  it("AC 7: no div-share key with mult-mix mastered → 'intro', and the Map owes all the groups → sharing", () => {
    const seed = defaultProgress('Marian')
    const skillLevels = throughMix('mastered')
    delete skillLevels[DIV_SHARE]
    // Every step before it already celebrated.
    const seen = MATH_TREE.slice(1, MATH_TREE.indexOf(DIV_SHARE))
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seed, skillLevels, unlocksCelebrated: seen }),
    )
    const loaded = loadProgress()
    expect(isProgressV1(loaded)).toBe(true)
    expect(loaded!.skillLevels[DIV_SHARE]).toBe('intro')
    expect(pendingUnlock(loaded!, 'math')).toEqual({
      world: 'math',
      mastered: 'mult-mix',
      unlocked: DIV_SHARE,
      land: null,
    })
  })

  it("mult-mix practicing and no div-share key → 'locked'", () => {
    const seed = defaultProgress('Marian')
    const skillLevels = throughMix('practicing')
    delete skillLevels[DIV_SHARE]
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seed, skillLevels }),
    )
    expect(loadProgress()?.skillLevels[DIV_SHARE]).toBe('locked')
  })

  it('the focus picker lands on sharing once all the groups is mastered', () => {
    const seed = defaultProgress('Marian')
    const skillLevels = {
      ...throughMix('mastered'),
      [DIV_SHARE]: 'intro',
    } as typeof seed.skillLevels
    const { node } = pickFocusNode({ ...seed, skillLevels }, 'math', 10)
    expect(node).toBe(DIV_SHARE)
  })
})
