/**
 * Hub card model (ticket 123jpnbc3dq). Per-step expectations are checked
 * against `nodeProgress()` itself so the card cannot drift from it.
 */
import { describe, expect, it } from 'vitest'
import {
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
    expect(m.landArt).toBe('land-ng-2')
    expect(m.unlocksNext).toBe(nodeProgress(p, 'add-to-20').unlocksNext)
    expect(m.unlocksNext).toBe('sub-to-10')
  })

  it('carries no bead row: the overview lives on the map (bar 9)', () => {
    const m = buildHubCardModel(defaultProgress(), 'math')
    expect(Object.keys(m)).not.toContain('lands')
    expect(Object.keys(m)).not.toContain('buds')
  })

  it('seed holes = nodeProgress goodDays of requiredDays', () => {
    const p: Progress = {
      ...withLevels({ 'number-recog': 'practicing' }),
      history: [entry(1, 'number-recog', 1), entry(2, 'number-recog', 1)],
    }
    const np = nodeProgress(p, 'number-recog')
    const m = buildHubCardModel(p, 'math')
    expect(m.holes).toEqual(
      Array.from({ length: np.requiredDays }, (_, i) => i < np.goodDays),
    )
    expect(m.holes).toEqual([true, true, false])
  })

  it('letter sounds per vowel: 3 holes for the vowel being worked on', () => {
    const p: Progress = {
      ...withLevels({
        'letter-names': 'mastered',
        'letter-sounds': 'practicing',
      }),
      literacy: {
        letterSoundsVowelStates: {
          '/o/': 'mastered',
          '/u/': 'practicing',
          '/i/': 'intro',
          '/e/': 'intro',
        },
      },
      history: [{ ...entry(1, 'letter-sounds', 1), currentTargetVowel: '/u/' }],
    }
    const np = nodeProgress(p, 'letter-sounds')
    expect(np.vowels).toBeDefined()
    const working = np.vowels!.find((v) => v.goodDays < v.requiredDays)!
    expect(working.vowel).toBe('/u/')
    const m = buildHubCardModel(p, 'word-song')
    expect(m.holes).toEqual(
      Array.from(
        { length: working.requiredDays },
        (_, i) => i < working.goodDays,
      ),
    )
    expect(m.holes).toHaveLength(3)
  })

  it('whole world mastered: complete, no next unlock, last step shown', () => {
    const p = withLevels(masterAll(MATH_TREE))
    const m = buildHubCardModel(p, 'math')
    expect(m.complete).toBe(true)
    expect(m.unlocksNext).toBeNull()
    expect(m.current).toBe('mult-6-9')
    expect(m.landNumber).toBe(4)
    expect(m.holes.every(Boolean)).toBe(true)
  })

  it('showLandNumber mirrors parentSettings.showLevelToMarian', () => {
    const p = defaultProgress()
    p.parentSettings = { ...p.parentSettings!, showLevelToMarian: false }
    expect(buildHubCardModel(p, 'math').showLandNumber).toBe(false)
  })
})
