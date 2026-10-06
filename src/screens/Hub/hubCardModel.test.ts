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

/** Local day key of day `d` of May 2026. */
const MAY = (d: number): string => `2026-05-${String(d).padStart(2, '0')}`

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

  it('flower slots = nodeProgress goodDays of requiredDays', () => {
    const p: Progress = {
      ...withLevels({ 'number-recog': 'practicing' }),
      history: [entry(1, 'number-recog', 1), entry(2, 'number-recog', 1)],
    }
    const np = nodeProgress(p, 'number-recog')
    const m = buildHubCardModel(p, 'math', MAY(10))
    expect(m.slots).toEqual(
      Array.from({ length: np.requiredDays }, (_, i) =>
        i < np.goodDays ? 'grown' : 'empty',
      ),
    )
    expect(m.slots).toEqual(['grown', 'grown', 'empty'])
    expect(m.slotDays).toEqual([MAY(1), MAY(2), null])
    expect(m.earnedToday).toBe(false)
    expect(m.flowersToUnlock).toBe(1)
  })

  it("today's good day sleeps (last filled slot); earlier days are grown", () => {
    const p: Progress = {
      ...withLevels({ 'number-recog': 'practicing' }),
      history: [entry(1, 'number-recog', 1), entry(2, 'number-recog', 1)],
    }
    const m = buildHubCardModel(p, 'math', MAY(2))
    expect(m.slots).toEqual(['grown', 'sleeping', 'empty'])
    expect(m.slotDays).toEqual([MAY(1), null, null])
    expect(m.earnedToday).toBe(true)
  })

  it('a second good session the same day adds no flower (practice)', () => {
    const p: Progress = {
      ...withLevels({ 'number-recog': 'practicing' }),
      history: [entry(2, 'number-recog', 1), entry(2, 'number-recog', 1)],
    }
    expect(buildHubCardModel(p, 'math', MAY(2)).slots).toEqual([
      'sleeping',
      'empty',
      'empty',
    ])
  })

  it('a weak session today is not a sleeping flower', () => {
    const p: Progress = {
      ...withLevels({ 'number-recog': 'practicing' }),
      history: [entry(1, 'number-recog', 1), entry(2, 'number-recog', 0.5)],
    }
    const m = buildHubCardModel(p, 'math', MAY(2))
    expect(m.slots).toEqual(['grown', 'empty', 'empty'])
    expect(m.earnedToday).toBe(false)
  })

  it('banked progress.goodDays count as flowers and can sleep', () => {
    const p: Progress = {
      ...withLevels({ 'number-recog': 'practicing' }),
      goodDays: { 'number-recog': [MAY(1), MAY(3)] },
    }
    expect(buildHubCardModel(p, 'math', MAY(3)).slots).toEqual([
      'grown',
      'sleeping',
      'empty',
    ])
  })

  it('separate-days rule switched off: nothing sleeps', () => {
    const p: Progress = {
      ...withLevels({ 'number-recog': 'practicing' }),
      history: [entry(2, 'number-recog', 1)],
    }
    p.parentSettings = { ...p.parentSettings!, crossDayEnforcement: false }
    const m = buildHubCardModel(p, 'math', MAY(2))
    expect(m.slots).toEqual(['grown', 'empty', 'empty'])
    expect(m.earnedToday).toBe(false)
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
    const m = buildHubCardModel(p, 'word-song', MAY(10))
    expect(m.slots).toEqual(
      Array.from({ length: working.requiredDays }, (_, i) =>
        i < working.goodDays ? 'grown' : 'empty',
      ),
    )
    expect(m.slots).toHaveLength(3)
    // Today's /u/ session sleeps on the /u/ row.
    expect(buildHubCardModel(p, 'word-song', MAY(1)).slots).toEqual([
      'sleeping',
      'empty',
      'empty',
    ])
  })

  it('whole world mastered: complete, no next unlock, last step shown', () => {
    const p = withLevels(masterAll(MATH_TREE))
    const m = buildHubCardModel(p, 'math')
    expect(m.complete).toBe(true)
    expect(m.unlocksNext).toBeNull()
    expect(m.current).toBe('mult-6-9')
    expect(m.landNumber).toBe(4)
    expect(m.slots.every((slot) => slot === 'grown')).toBe(true)
    expect(m.flowersToUnlock).toBe(0)
  })

  it('showLandNumber mirrors parentSettings.showLevelToMarian', () => {
    const p = defaultProgress()
    p.parentSettings = { ...p.parentSettings!, showLevelToMarian: false }
    expect(buildHubCardModel(p, 'math').showLandNumber).toBe(false)
  })
})
