/**
 * Hub card model (ticket 123jpnbc3dq). Per-step expectations are checked
 * against `nodeProgress()` itself so the card cannot drift from it.
 */
import { describe, expect, it } from 'vitest'
import {
  LITERACY_TREE,
  MATH_TREE,
  defaultProgress,
  type Progress,
  type SessionHistoryEntry,
  type SkillLevels,
  type SkillNode,
} from '../../lib/progress'
import { nodeProgress } from '../../lib/progress/nodeProgress'
import { buildHubCardModel, currentStepOf } from './hubCardModel'

/** All steps locked except the first of each tree (intro), plus overrides. */
function withLevels(overrides: Partial<SkillLevels> = {}): Progress {
  const p = defaultProgress()
  const allLocked = Object.fromEntries(
    Object.keys(p.skillLevels).map((k) => [k, 'locked']),
  ) as SkillLevels
  return {
    ...p,
    skillLevels: {
      ...allLocked,
      'number-recog': 'intro',
      'letter-names': 'intro',
      ...overrides,
    },
  }
}

function masterAll(nodes: readonly SkillNode[]): Partial<SkillLevels> {
  return Object.fromEntries(nodes.map((n) => [n, 'mastered']))
}

/** Day `d` of May 2026 at local noon, so calendar-day dedupe is TZ-proof. */
function entry(d: number, node: SkillNode, rate: number): SessionHistoryEntry {
  return {
    dateISO: new Date(2026, 4, d, 12).toISOString(),
    skillFocus: [node],
    successRate: rate,
  }
}

describe('buildHubCardModel', () => {
  it('null progress renders like defaultProgress()', () => {
    expect(buildHubCardModel(null, 'math')).toEqual(
      buildHubCardModel(defaultProgress(), 'math'),
    )
    expect(buildHubCardModel(null, 'math').showLandNumber).toBe(true)
  })

  it('nothing mastered: land 1, first step current, second step next', () => {
    const m = buildHubCardModel(withLevels(), 'math')
    expect(m.current).toBe('number-recog')
    expect(m.landNumber).toBe(1)
    expect(m.unlocksNext).toBe('add-to-10')
  })

  it('one bead per step, grouped by land: math 1+4+3+3, word 2+1+5+3+2', () => {
    const p = defaultProgress()
    expect(
      buildHubCardModel(p, 'math').lands.map((l) => l.beads.length),
    ).toEqual([1, 4, 3, 3])
    expect(
      buildHubCardModel(p, 'word-song').lands.map((l) => l.beads.length),
    ).toEqual([2, 1, 5, 3, 2])
    expect(
      buildHubCardModel(p, 'math').lands.flatMap((l) =>
        l.beads.map((b) => b.node),
      ),
    ).toEqual([...MATH_TREE])
    expect(
      buildHubCardModel(p, 'word-song').lands.flatMap((l) =>
        l.beads.map((b) => b.node),
      ),
    ).toEqual([...LITERACY_TREE])
  })

  it('current = first not-mastered step; land number follows it', () => {
    const p = withLevels({
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'sub-to-10': 'locked',
      'add-to-20': 'practicing',
    })
    const m = buildHubCardModel(p, 'math')
    expect(currentStepOf(p, 'math')).toBe('add-to-20')
    expect(m.current).toBe('add-to-20')
    expect(m.landNumber).toBe(2)
    expect(m.unlocksNext).toBe(nodeProgress(p, 'add-to-20').unlocksNext)
    const states = m.lands.flatMap((l) => l.beads.map((b) => b.state))
    expect(states.slice(0, 5)).toEqual([
      'mastered',
      'mastered',
      'current',
      'next',
      'locked',
    ])
  })

  it('current bead fill = nodeProgress goodDays / requiredDays', () => {
    const p: Progress = {
      ...withLevels({ 'number-recog': 'practicing' }),
      history: [entry(1, 'number-recog', 1), entry(2, 'number-recog', 1)],
    }
    const np = nodeProgress(p, 'number-recog')
    const m = buildHubCardModel(p, 'math')
    expect(m.goodDays).toBe(np.goodDays)
    expect(m.requiredDays).toBe(np.requiredDays)
    expect(m.fill).toBeCloseTo(np.goodDays / np.requiredDays)
    expect(m.buds).toEqual([
      Array.from({ length: np.requiredDays }, (_, i) => i < np.goodDays),
    ])
    expect(np.goodDays).toBeGreaterThan(0)
  })

  it('whole world mastered: complete, no next unlock, last step shown', () => {
    const p = withLevels(masterAll(MATH_TREE))
    const m = buildHubCardModel(p, 'math')
    expect(m.complete).toBe(true)
    expect(m.unlocksNext).toBeNull()
    expect(m.current).toBe('mult-6-9')
    expect(m.landNumber).toBe(4)
    expect(
      m.lands.flatMap((l) => l.beads).every((b) => b.state === 'mastered'),
    ).toBe(true)
  })

  it('showLandNumber mirrors parentSettings.showLevelToMarian', () => {
    const p = defaultProgress()
    p.parentSettings = { ...p.parentSettings!, showLevelToMarian: false }
    expect(buildHubCardModel(p, 'math').showLandNumber).toBe(false)
  })
})
