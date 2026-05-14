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
      'cvc-words-short-o',
      'cvc-words-short-u',
      'cvc-words-short-i',
      'cvc-words-short-e',
      // Digraphs split into 3 sequential sibling nodes per PR #211.
      'digraphs-sh',
      'digraphs-ch',
      'digraphs-th-voiceless',
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

describe('pickFocusNode — word-song (un-clamped, planner-parser contract step 2, ticket 86c9kxu07)', () => {
  // Word-song was hard-clamped to 'blending-cv' as the P0 shim (86c9kt47v)
  // while only the CVC "Tap the <word>." parser shape existed. PR #132
  // widened the parser to accept "Read the <word>." → cvc-word, and this
  // PR (step 2) widens the planner to emit that content. The picker now
  // walks LITERACY_TREE the same way the math walker does. Letter-sounds /
  // digraphs / sight-words / simple-sentences are safe to surface because
  // the planner falls back to blending-cv content (a stub) for those tiers
  // — i.e. the screen always renders, even on tiers we haven't tuned yet.

  it('returns letter-sounds for the default Progress doc (Marian, post-diagnostic)', () => {
    // Default doc: letter-names mastered, letter-sounds practicing,
    // blending-cv practicing. Walker stops at the first non-mastered:
    // letter-sounds. The planner stub-fallback handles letter-sounds by
    // emitting blending-cv content, so the picker can surface it safely.
    const progress = defaultProgress()
    expect(pickFocusNode(progress, 'word-song')).toBe('letter-sounds')
  })

  it('returns blending-cv when blending-cv is practicing (AC #1.a)', () => {
    // AC scenario (a): blending-cv practicing → returns blending-cv.
    const progress = buildProgress({
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'practicing',
    })
    expect(pickFocusNode(progress, 'word-song')).toBe('blending-cv')
  })

  it('returns cvc-words when blending-cv is mastered + cvc-words is practicing (AC #1.b — the August unblock)', () => {
    // AC scenario (b): blending-cv mastered + cvc-words practicing →
    // returns cvc-words. THIS is the path that unblocks Marian on the
    // literacy track. Pre-step-2 the clamp returned 'blending-cv' here
    // and Marian could never progress.
    const progress = buildProgress({
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'practicing',
    })
    expect(pickFocusNode(progress, 'word-song')).toBe('cvc-words')
  })

  it('returns letter-names when every literacy node is locked (AC #1.c — first non-locked up the tree)', () => {
    // AC scenario (c): all literacy nodes locked → returns the first
    // node in tree order. 'locked' is treated as non-mastered (same
    // contract as the math walker — see the math test "treats 'locked'
    // as non-mastered" above), so the walker returns the first-in-order
    // entry: letter-names.
    const progress = buildProgress({
      'letter-names': 'locked',
      'letter-sounds': 'locked',
      'blending-cv': 'locked',
      'cvc-words': 'locked',
      'cvc-words-short-o': 'locked',
      // Digraphs split into 3 sequential sibling nodes per PR #211.
      'digraphs-sh': 'locked',
      'digraphs-ch': 'locked',
      'digraphs-th-voiceless': 'locked',
      'sight-words': 'locked',
      'simple-sentences': 'locked',
    })
    expect(pickFocusNode(progress, 'word-song')).toBe('letter-names')
  })

  it("treats 'intro' as non-mastered (mirrors the math walker contract)", () => {
    const progress = buildProgress({
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'mastered',
      'cvc-words-short-o': 'mastered',
      'cvc-words-short-u': 'mastered',
      'cvc-words-short-i': 'mastered',
      'cvc-words-short-e': 'mastered',
      // First digraph sibling at 'intro' — picker lands there.
      'digraphs-sh': 'intro',
    })
    expect(pickFocusNode(progress, 'word-song')).toBe('digraphs-sh')
  })

  it('skips mastered nodes and lands on the first non-mastered', () => {
    const progress = buildProgress({
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'mastered',
      'cvc-words-short-o': 'mastered',
      'cvc-words-short-u': 'mastered',
      'cvc-words-short-i': 'mastered',
      'cvc-words-short-e': 'mastered',
      // All three digraph siblings mastered too; picker lands on
      // sight-words. (Sequential isolation per PR #211: each digraph
      // tier must master before the next unlocks; this test seeds
      // the post-graduation state directly.)
      'digraphs-sh': 'mastered',
      'digraphs-ch': 'mastered',
      'digraphs-th-voiceless': 'mastered',
      'sight-words': 'practicing',
    })
    expect(pickFocusNode(progress, 'word-song')).toBe('sight-words')
  })

  it('falls back to the last word-song node when every node is mastered (defensive)', () => {
    // Mirrors the math fallback at the end of MATH_NODES_IN_ORDER.
    const progress = buildProgress() // every level → mastered via helper
    expect(pickFocusNode(progress, 'word-song')).toBe('simple-sentences')
  })

  it('returns the lowest non-mastered across a sweep of progress shapes', () => {
    // Sanity sweep covering common progressions Marian can plausibly
    // reach. Each entry is [overrides, expected].
    const shapes: Array<[Partial<SkillLevels>, string]> = [
      // Practising the very first tier.
      [{ 'letter-names': 'practicing' }, 'letter-names'],
      // Past letter-names; on letter-sounds.
      [
        {
          'letter-names': 'mastered',
          'letter-sounds': 'practicing',
        },
        'letter-sounds',
      ],
      // The blending-cv → cvc-words transition.
      [
        {
          'letter-names': 'mastered',
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'intro',
        },
        'cvc-words',
      ],
      // The cvc-words → cvc-words-short-o (sibling) transition.
      [
        {
          'letter-names': 'mastered',
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'practicing',
        },
        'cvc-words-short-o',
      ],
      // Every higher tier locked; walker falls onto the first
      // non-mastered node — `cvc-words-short-u` (the next sibling
      // after the only two CVC tiers we explicitly mastered).
      [
        {
          'letter-names': 'mastered',
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'mastered',
          // Note: leaving short-u/i/e and the digraph siblings at the
          // helper's all-mastered default would skip past everything
          // to simple-sentences — that's a different sweep case below.
          // Here we override short-u back to 'locked' to stop the walk.
          'cvc-words-short-u': 'locked',
        },
        'cvc-words-short-u',
      ],
      // Every CVC + digraph mastered; walker lands on the leading
      // digraph sibling when it's 'locked' downstream of short-e.
      [
        {
          'letter-names': 'mastered',
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'mastered',
          'cvc-words-short-u': 'mastered',
          'cvc-words-short-i': 'mastered',
          'cvc-words-short-e': 'mastered',
          // Three digraph siblings per PR #211 — sh comes first.
          'digraphs-sh': 'locked',
        },
        'digraphs-sh',
      ],
    ]
    for (const [overrides, expected] of shapes) {
      const progress = buildProgress(overrides)
      expect(pickFocusNode(progress, 'word-song')).toBe(expected)
    }
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
