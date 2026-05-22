/**
 * Unit tests for the Progress → Hub projection helpers (ticket 86c9kwnkw).
 *
 * Pure functions — no DOM, no React. Quick to run, high signal.
 */

import { describe, expect, it } from 'vitest'
import {
  defaultProgress,
  type Progress,
  type SkillLevels,
} from '../../lib/progress'
import { labelForSkillNode, projectHubTreeProgress } from './progressProjection'

function withSkillLevels(patch: Partial<SkillLevels>): Progress {
  const base = defaultProgress()
  return { ...base, skillLevels: { ...base.skillLevels, ...patch } }
}

describe('projectHubTreeProgress', () => {
  it('returns 0/0 when progress is null', () => {
    expect(projectHubTreeProgress(null)).toEqual({
      numberGardenIndex: 0,
      wordSongIndex: 0,
    })
  })

  it('counts consecutive mastered nodes from the start of math track', () => {
    // defaultProgress has number-recog=mastered, add-to-10=practicing,
    // so math index should be 1.
    const result = projectHubTreeProgress(defaultProgress())
    expect(result.numberGardenIndex).toBe(1)
  })

  it('stops counting at the first non-mastered node', () => {
    const p = withSkillLevels({
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'practicing',
      'sub-to-10': 'mastered', // gap — not counted
    })
    expect(projectHubTreeProgress(p).numberGardenIndex).toBe(2)
  })

  it('returns track length when every node is mastered', () => {
    const p = withSkillLevels({
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'mastered',
      'sub-to-20': 'mastered',
      // Wave 5 (ticket 86c9y0bvc) sibling-tier split — both tiers
      // mastered to walk past. Math track is now 11 nodes (was 10).
      'two-digit-addsub-no-regroup': 'mastered',
      'two-digit-addsub-with-regroup': 'mastered',
      'skip-counting': 'mastered',
      'mult-2-5-10': 'mastered',
      'mult-3-4': 'mastered',
      'mult-6-9': 'mastered',
    })
    // 11 math nodes, all mastered → index 11 (sliding-window helper clamps
    // to last cell).
    expect(projectHubTreeProgress(p).numberGardenIndex).toBe(11)
  })

  it('counts word-song track independently of math track', () => {
    const p = withSkillLevels({
      // Math: only number-recog mastered.
      'number-recog': 'mastered',
      'add-to-10': 'practicing',
      // Word-song: letter-names + letter-sounds + blending-cv mastered.
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'practicing',
    })
    const result = projectHubTreeProgress(p)
    expect(result.numberGardenIndex).toBe(1)
    expect(result.wordSongIndex).toBe(3)
  })

  it('returns 0 when first node of track is not mastered', () => {
    const p = withSkillLevels({
      'number-recog': 'practicing',
      'letter-names': 'intro',
    })
    const result = projectHubTreeProgress(p)
    expect(result.numberGardenIndex).toBe(0)
    expect(result.wordSongIndex).toBe(0)
  })
})

describe('labelForSkillNode', () => {
  it('returns a human-readable label for math nodes', () => {
    expect(labelForSkillNode('add-to-10')).toBe('add to 10')
    expect(labelForSkillNode('add-to-20')).toBe('add to 20')
    expect(labelForSkillNode('mult-6-9')).toBe('multiply by 6 to 9')
  })

  it('returns a human-readable label for word-song nodes', () => {
    expect(labelForSkillNode('cvc-words')).toBe('CVC words')
    expect(labelForSkillNode('blending-cv')).toBe('blending sounds')
  })

  it('falls back to the raw id for an unknown node', () => {
    // Defensive: cast through unknown to feign a future schema entry.
    expect(labelForSkillNode('future-node' as never)).toBe('future-node')
  })
})
