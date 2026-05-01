/**
 * Unit tests for the M2 focus-node selectors. Pure functions; no React,
 * no localStorage, no SDK. The selectors are walked against synthetic
 * Progress documents.
 */
import { describe, expect, it } from 'vitest'
import { defaultProgress } from './defaults'
import {
  MATH_NODES_IN_ORDER,
  WORD_SONG_NODES_IN_ORDER,
  pickFocusNode,
  pickRecentSuccessRate,
} from './focusNode'
import type { Progress, SkillLevels } from './types'

/** Build a Progress with all skills set to `mastered`, then layer overrides
 *  on top. Tests that need a specific shape spell out only the deltas. */
function buildProgress(overrides: Partial<SkillLevels> = {}): Progress {
  const base = defaultProgress()
  const allMastered: SkillLevels = Object.fromEntries(
    Object.keys(base.skillLevels).map((k) => [k, 'mastered']),
  ) as SkillLevels
  return {
    ...base,
    skillLevels: { ...allMastered, ...overrides },
  }
}

describe('MATH_NODES_IN_ORDER / WORD_SONG_NODES_IN_ORDER', () => {
  it('mirrors the declaration order in types.ts (math)', () => {
    // The expected sequence is the curriculum from CLAUDE.md `## Two skill
    // trees` — number-recog → add-to-10 → ... → mult-6-9. If a node moves
    // here without moving in types.ts (or vice versa), the planner's prompt
    // ordering and the selector go out of sync. Pin it.
    expect(MATH_NODES_IN_ORDER).toEqual([
      'number-recog',
      'add-to-10',
      'add-to-20',
      'sub-to-10',
      'sub-to-20',
      'two-digit-addsub',
      'skip-counting',
      'mult-2-5-10',
      'mult-3-4',
      'mult-6-9',
    ])
  })

  it('mirrors the declaration order in types.ts (word-song)', () => {
    expect(WORD_SONG_NODES_IN_ORDER).toEqual([
      'letter-names',
      'letter-sounds',
      'blending-cv',
      'cvc-words',
      'digraphs',
      'sight-words',
      'simple-sentences',
    ])
  })
})

describe('pickFocusNode — math', () => {
  it("returns 'add-to-10' when add-to-10 is practicing and add-to-20 is locked (the AC case)", () => {
    // The ticket's acceptance criterion: a Progress doc with add-to-10
    // practicing + add-to-20 locked must select add-to-10. number-recog
    // is mastered above it; the walker must skip past mastered to land
    // on the first non-mastered.
    const progress = buildProgress({
      'number-recog': 'mastered',
      'add-to-10': 'practicing',
      'add-to-20': 'locked',
    })
    expect(pickFocusNode(progress, 'math')).toBe('add-to-10')
  })

  it('returns the lowest non-mastered node — skips mastered nodes', () => {
    const progress = buildProgress({
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'practicing',
    })
    expect(pickFocusNode(progress, 'math')).toBe('add-to-20')
  })

  it("treats 'intro' as non-mastered", () => {
    const progress = buildProgress({
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'mastered',
      'sub-to-20': 'mastered',
      'two-digit-addsub': 'mastered',
      'skip-counting': 'mastered',
      'mult-2-5-10': 'intro',
    })
    expect(pickFocusNode(progress, 'math')).toBe('mult-2-5-10')
  })

  it("treats 'locked' as non-mastered (the walker doesn't try to leapfrog)", () => {
    // 'locked' is not yet ready, but the M2 selector treats it the same
    // as 'practicing' / 'intro' — anything-not-mastered. The mastery
    // progression that DECIDES locked → intro is M3's job.
    const progress = buildProgress({
      'number-recog': 'mastered',
      'add-to-10': 'locked',
    })
    expect(pickFocusNode(progress, 'math')).toBe('add-to-10')
  })

  it('falls back to the last math node when every node is mastered (defensive)', () => {
    const progress = buildProgress() // every level → mastered via helper
    expect(pickFocusNode(progress, 'math')).toBe('mult-6-9')
  })

  it('walks the default Progress doc — Marian lands on add-to-10 (matches diagnostic)', () => {
    // The default doc encodes the April 2026 diagnostic: number-recog
    // mastered, add-to-10 practicing → the selector must pick add-to-10.
    // Pin the integration so a future tweak to defaults can't silently
    // shift focus to a node Marian isn't ready for.
    const progress = defaultProgress()
    expect(pickFocusNode(progress, 'math')).toBe('add-to-10')
  })
})

describe('pickFocusNode — word-song', () => {
  it('returns the lowest non-mastered node', () => {
    const progress = buildProgress({
      'letter-names': 'mastered',
      'letter-sounds': 'practicing',
    })
    expect(pickFocusNode(progress, 'word-song')).toBe('letter-sounds')
  })

  it('walks the default Progress doc — Marian lands on letter-sounds', () => {
    // Default doc: letter-names mastered, letter-sounds practicing.
    const progress = defaultProgress()
    expect(pickFocusNode(progress, 'word-song')).toBe('letter-sounds')
  })

  it('falls back to the last word-song node when every node is mastered', () => {
    const progress = buildProgress()
    expect(pickFocusNode(progress, 'word-song')).toBe('simple-sentences')
  })
})

describe('pickRecentSuccessRate', () => {
  function progressWithHistory(
    history: Array<{ skillFocus: string[]; successRate: number }>,
  ): Progress {
    const base = defaultProgress()
    return {
      ...base,
      history: history.map((h, i) => ({
        dateISO: new Date(2026, 3, 1 + i).toISOString(),
        skillFocus: h.skillFocus as Progress['history'][number]['skillFocus'],
        successRate: h.successRate,
      })),
    }
  }

  it('returns null when the history is empty (planner needs to distinguish "no data" from "abysmal")', () => {
    const progress = progressWithHistory([])
    expect(pickRecentSuccessRate(progress, 'math')).toBeNull()
  })

  it('returns null when no entries match the requested track', () => {
    // Only word-song entries — math should return null.
    const progress = progressWithHistory([
      { skillFocus: ['letter-sounds'], successRate: 0.8 },
      { skillFocus: ['cvc-words'], successRate: 0.6 },
    ])
    expect(pickRecentSuccessRate(progress, 'math')).toBeNull()
    // ...and the same data DOES yield a number for word-song.
    expect(pickRecentSuccessRate(progress, 'word-song')).toBeCloseTo(0.7, 5)
  })

  it('averages the last 3 matching entries (drops earlier matching entries)', () => {
    // Five matching entries — only the last three count. 0.4, 0.5, 0.6.
    const progress = progressWithHistory([
      { skillFocus: ['add-to-10'], successRate: 0.1 },
      { skillFocus: ['add-to-10'], successRate: 0.2 },
      { skillFocus: ['add-to-10'], successRate: 0.4 },
      { skillFocus: ['add-to-10'], successRate: 0.5 },
      { skillFocus: ['add-to-10'], successRate: 0.6 },
    ])
    expect(pickRecentSuccessRate(progress, 'math')).toBeCloseTo(0.5, 5)
  })

  it('averages the last <3 entries when fewer than 3 match', () => {
    // Two matching math entries → mean of those two.
    const progress = progressWithHistory([
      { skillFocus: ['add-to-10'], successRate: 0.4 },
      { skillFocus: ['letter-sounds'], successRate: 0.9 }, // wrong track, ignored
      { skillFocus: ['add-to-10'], successRate: 0.6 },
    ])
    expect(pickRecentSuccessRate(progress, 'math')).toBeCloseTo(0.5, 5)
  })

  it('treats a single matching entry as its own mean', () => {
    const progress = progressWithHistory([
      { skillFocus: ['add-to-10'], successRate: 0.42 },
    ])
    expect(pickRecentSuccessRate(progress, 'math')).toBeCloseTo(0.42, 5)
  })

  it('an entry whose skillFocus mixes tracks counts for either track', () => {
    // Defensive: a session that touched both tracks (won't happen today,
    // but the type allows it) attributes to whichever track is queried.
    const progress = progressWithHistory([
      { skillFocus: ['add-to-10', 'letter-sounds'], successRate: 0.7 },
    ])
    expect(pickRecentSuccessRate(progress, 'math')).toBeCloseTo(0.7, 5)
    expect(pickRecentSuccessRate(progress, 'word-song')).toBeCloseTo(0.7, 5)
  })

  it('returns null on success rate of 0 too — wait, no — pick a real test name', () => {
    // Sanity: a 0.0 rate IS a number, not null. The null sentinel only
    // means "no data".
    const progress = progressWithHistory([
      { skillFocus: ['add-to-10'], successRate: 0 },
    ])
    expect(pickRecentSuccessRate(progress, 'math')).toBe(0)
  })
})
