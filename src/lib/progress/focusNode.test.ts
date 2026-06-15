/**
 * Unit tests for the M2 focus-node selectors. Pure functions; no React,
 * no localStorage, no SDK. The selectors are walked against synthetic
 * Progress documents.
 */
import { describe, expect, it } from 'vitest'
import { defaultProgress } from './defaults'
import {
  CVC_REVIEW_PERIOD_SESSIONS,
  CVC_TIERS,
  MATH_NODES_IN_ORDER,
  WORD_SONG_NODES_IN_ORDER,
  pickCvcReviewNode,
  pickFocusNode,
  pickRecentSuccessRate,
} from './focusNode'
import type { Progress, SkillLevels } from './types'

/**
 * Build a Progress with all skills set to `mastered`, then layer overrides
 * on top. Tests that need a specific shape spell out only the deltas.
 *
 * `cvcGraduationSessionFired` defaults to `true` so forward-progression
 * tests (which seed all CVC tiers mastered to exercise the walk PAST them)
 * are not hijacked by the CVC graduation review (ticket 86c9qa6n3). The
 * CVC-review-specific tests pass `{ cvcGraduationSessionFired: false }` (or
 * other top-level fields) via the second argument to opt INTO review mode.
 */
function buildProgress(
  overrides: Partial<SkillLevels> = {},
  progressOverrides: Partial<Progress> = {},
): Progress {
  const base = defaultProgress()
  const allMastered: SkillLevels = Object.fromEntries(
    Object.keys(base.skillLevels).map((k) => [k, 'mastered']),
  ) as SkillLevels
  return {
    ...base,
    skillLevels: { ...allMastered, ...overrides },
    cvcGraduationSessionFired: true,
    ...progressOverrides,
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
      // Wave 5 (ticket 86c9y0bvc): `'two-digit-addsub'` split into
      // adjacent no-regroup + with-regroup sibling tiers.
      'two-digit-addsub-no-regroup',
      'two-digit-addsub-with-regroup',
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
    expect(pickFocusNode(progress, 'math').node).toBe('add-to-10')
  })

  it('returns the lowest non-mastered node — skips mastered nodes', () => {
    const progress = buildProgress({
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'practicing',
    })
    expect(pickFocusNode(progress, 'math').node).toBe('add-to-20')
  })

  it("treats 'intro' as non-mastered", () => {
    const progress = buildProgress({
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'mastered',
      'sub-to-20': 'mastered',
      // Wave 5 sibling-tier split — both tiers mastered to walk past.
      'two-digit-addsub-no-regroup': 'mastered',
      'two-digit-addsub-with-regroup': 'mastered',
      'skip-counting': 'mastered',
      'mult-2-5-10': 'intro',
    })
    expect(pickFocusNode(progress, 'math').node).toBe('mult-2-5-10')
  })

  it("treats 'locked' as non-mastered (the walker doesn't try to leapfrog)", () => {
    // 'locked' is not yet ready, but the M2 selector treats it the same
    // as 'practicing' / 'intro' — anything-not-mastered. The mastery
    // progression that DECIDES locked → intro is M3's job.
    const progress = buildProgress({
      'number-recog': 'mastered',
      'add-to-10': 'locked',
    })
    expect(pickFocusNode(progress, 'math').node).toBe('add-to-10')
  })

  it('falls back to the last math node when every node is mastered (defensive)', () => {
    const progress = buildProgress() // every level → mastered via helper
    expect(pickFocusNode(progress, 'math').node).toBe('mult-6-9')
  })

  it('walks the default Progress doc — Marian lands on add-to-10 (matches diagnostic)', () => {
    // The default doc encodes the April 2026 diagnostic: number-recog
    // mastered, add-to-10 practicing → the selector must pick add-to-10.
    // Pin the integration so a future tweak to defaults can't silently
    // shift focus to a node Marian isn't ready for.
    const progress = defaultProgress()
    expect(pickFocusNode(progress, 'math').node).toBe('add-to-10')
  })

  // ── Wave 5 sibling-tier split (ticket 86c9y0bvc) ─────────────────
  // The picker walks `'two-digit-addsub-no-regroup'` →
  // `'two-digit-addsub-with-regroup'` → `'skip-counting'`. Both
  // tiers are functionally distinguishable through `pickFocusNode`;
  // seeding one as 'mastered' must move the picker to the next.
  it('returns two-digit-addsub-no-regroup when upstream math is mastered and no-regroup is practicing', () => {
    const progress = buildProgress({
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'mastered',
      'sub-to-20': 'mastered',
      'two-digit-addsub-no-regroup': 'practicing',
      'two-digit-addsub-with-regroup': 'locked',
    })
    expect(pickFocusNode(progress, 'math').node).toBe(
      'two-digit-addsub-no-regroup',
    )
  })

  it('returns two-digit-addsub-with-regroup when no-regroup is mastered and with-regroup is practicing', () => {
    // Sibling cascade: mastering no-regroup advances the picker to
    // the with-regroup tier — the contract that lets Marian progress
    // from the pre-carrying band into the carrying band.
    const progress = buildProgress({
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'mastered',
      'sub-to-20': 'mastered',
      'two-digit-addsub-no-regroup': 'mastered',
      'two-digit-addsub-with-regroup': 'practicing',
    })
    expect(pickFocusNode(progress, 'math').node).toBe(
      'two-digit-addsub-with-regroup',
    )
  })

  it('advances past the entire two-digit cluster when both tiers are mastered', () => {
    // After mastering both no-regroup and with-regroup, the picker
    // must move on to skip-counting — proves the two literals are
    // not duplicates of one another (each one is a distinct gate the
    // picker walks through).
    const progress = buildProgress({
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'mastered',
      'sub-to-20': 'mastered',
      'two-digit-addsub-no-regroup': 'mastered',
      'two-digit-addsub-with-regroup': 'mastered',
      'skip-counting': 'practicing',
    })
    expect(pickFocusNode(progress, 'math').node).toBe('skip-counting')
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
    expect(pickFocusNode(progress, 'word-song').node).toBe('letter-sounds')
  })

  it('returns blending-cv when blending-cv is practicing (AC #1.a)', () => {
    // AC scenario (a): blending-cv practicing → returns blending-cv.
    const progress = buildProgress({
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'practicing',
    })
    expect(pickFocusNode(progress, 'word-song').node).toBe('blending-cv')
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
    expect(pickFocusNode(progress, 'word-song').node).toBe('cvc-words')
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
    expect(pickFocusNode(progress, 'word-song').node).toBe('letter-names')
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
    expect(pickFocusNode(progress, 'word-song').node).toBe('digraphs-sh')
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
    expect(pickFocusNode(progress, 'word-song').node).toBe('sight-words')
  })

  it('falls back to the last word-song node when every node is mastered (defensive)', () => {
    // Mirrors the math fallback at the end of MATH_NODES_IN_ORDER.
    const progress = buildProgress() // every level → mastered via helper
    expect(pickFocusNode(progress, 'word-song').node).toBe('simple-sentences')
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
      expect(pickFocusNode(progress, 'word-song').node).toBe(expected)
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

// ── CVC review mode (ticket 86c9qa6n3) ──────────────────────────────────
//
// The firing layer for PR #181 cross-vowel mixing. When all three CVC
// tiers are mastered, the forward picker walks past them onto a non-CVC
// node, so cross-vowel chips never surface. `pickCvcReviewNode` re-surfaces
// a mastered CVC tier on a graduation-once-then-round-robin cadence.
//
// All three CVC tiers (`cvc-words`, `cvc-words-short-o`,
// `cvc-words-short-u`) are mastered by the `buildProgress()` default; the
// helper's default `cvcGraduationSessionFired: true` is OVERRIDDEN to
// `false` here to test the graduation path, and back to `true` to test the
// periodic path. The intermediate vowel tiers (`-short-i`, `-short-e`) are
// NOT part of the cross-vowel set — only the original three.

describe('pickCvcReviewNode (ticket 86c9qa6n3)', () => {
  /** All three CVC tiers mastered + latch state + the graduation default. */
  function reviewEligibleProgress(
    progressOverrides: Partial<Progress> = {},
  ): Progress {
    // buildProgress() already masters every node; we just control the
    // latch via progressOverrides. The three CVC tiers are mastered by
    // construction, so `cvcReviewEligible` is true.
    return buildProgress({}, progressOverrides)
  }

  describe('eligibility gate', () => {
    it('returns null when not all three CVC tiers are mastered (§4.4)', () => {
      // Only two of three CVC tiers mastered — review mode is premature
      // because the forward picker still has a non-mastered CVC node to
      // land on. sessionCount is irrelevant; the gate short-circuits.
      const progress = buildProgress(
        { 'cvc-words-short-u': 'practicing' },
        { cvcGraduationSessionFired: false },
      )
      expect(pickCvcReviewNode(progress, 5)).toBeNull()
    })

    it('returns null when only cvc-words is mastered (rest practicing)', () => {
      const progress = buildProgress(
        {
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'practicing',
          'cvc-words-short-u': 'practicing',
        },
        { cvcGraduationSessionFired: false },
      )
      expect(pickCvcReviewNode(progress, 0)).toBeNull()
      expect(pickCvcReviewNode(progress, 5)).toBeNull()
    })
  })

  describe('graduation review (Option C — once)', () => {
    it('returns cvc-words-short-u on the first eligible session (latch falsy)', () => {
      // Short-u is the graduation target — /ʌ/ has no Tagalog equivalent
      // and is the highest-L1-interference vowel. sessionCount does NOT
      // matter for the graduation branch.
      const progress = reviewEligibleProgress({
        cvcGraduationSessionFired: false,
      })
      expect(pickCvcReviewNode(progress, 0)).toBe('cvc-words-short-u')
      expect(pickCvcReviewNode(progress, 3)).toBe('cvc-words-short-u')
      expect(pickCvcReviewNode(progress, 7)).toBe('cvc-words-short-u')
    })

    it('treats absent cvcGraduationSessionFired as not-yet-fired (§4.5 — old blobs)', () => {
      // An old blob predating the field reads `undefined`; the picker must
      // treat that as "graduation not yet fired" so a pre-existing Marian
      // still gets her one-shot graduation review.
      const progress = reviewEligibleProgress({
        cvcGraduationSessionFired: undefined,
      })
      expect(pickCvcReviewNode(progress, 0)).toBe('cvc-words-short-u')
    })

    it('does NOT re-fire graduation once the latch is true', () => {
      // Latch true → graduation branch skipped. On a non-period session
      // the picker returns null (forward picker takes over).
      const progress = reviewEligibleProgress({
        cvcGraduationSessionFired: true,
      })
      // sessionCount 3 is not a multiple of the period → null.
      expect(pickCvcReviewNode(progress, 3)).toBeNull()
    })
  })

  describe('periodic revisit (Option B — round-robin every N sessions)', () => {
    it('returns null on non-period sessions post-graduation', () => {
      const progress = reviewEligibleProgress({
        cvcGraduationSessionFired: true,
      })
      // 1..4 and 6..9 are not multiples of the 5-session period.
      for (const n of [1, 2, 3, 4, 6, 7, 8, 9]) {
        expect(pickCvcReviewNode(progress, n)).toBeNull()
      }
    })

    it('round-robins across the three CVC tiers on each Nth session', () => {
      const progress = reviewEligibleProgress({
        cvcGraduationSessionFired: true,
      })
      const period = CVC_REVIEW_PERIOD_SESSIONS // 5
      // session 5 → floor(5/5)%3 = 1 → CVC_TIERS[1]
      // session 10 → floor(10/5)%3 = 2 → CVC_TIERS[2]
      // session 15 → floor(15/5)%3 = 0 → CVC_TIERS[0]
      // session 20 → floor(20/5)%3 = 1 → CVC_TIERS[1] (cycle repeats)
      expect(pickCvcReviewNode(progress, period * 1)).toBe(CVC_TIERS[1])
      expect(pickCvcReviewNode(progress, period * 2)).toBe(CVC_TIERS[2])
      expect(pickCvcReviewNode(progress, period * 3)).toBe(CVC_TIERS[0])
      expect(pickCvcReviewNode(progress, period * 4)).toBe(CVC_TIERS[1])
    })

    it('covers all three tiers across a full round-robin cycle', () => {
      const progress = reviewEligibleProgress({
        cvcGraduationSessionFired: true,
      })
      const seen = new Set<string>()
      for (let k = 1; k <= CVC_TIERS.length; k++) {
        const node = pickCvcReviewNode(progress, CVC_REVIEW_PERIOD_SESSIONS * k)
        expect(node).not.toBeNull()
        seen.add(node!)
      }
      // Every CVC tier surfaces exactly once across one full cycle.
      expect(seen).toEqual(new Set(CVC_TIERS))
    })

    it('does not fire a periodic review on session 0 (sessionCount > 0 guard)', () => {
      // 0 % N === 0, but session 0 is the first-ever launch — guard it.
      const progress = reviewEligibleProgress({
        cvcGraduationSessionFired: true,
      })
      expect(pickCvcReviewNode(progress, 0)).toBeNull()
    })
  })
})

describe('pickFocusNode — CVC review mode integration (ticket 86c9qa6n3)', () => {
  function buildReviewProgress(
    progressOverrides: Partial<Progress> = {},
  ): Progress {
    return buildProgress({}, progressOverrides)
  }

  it('tags forward picks with mode "forward"', () => {
    const progress = defaultProgress()
    expect(pickFocusNode(progress, 'word-song')).toEqual({
      node: 'letter-sounds',
      mode: 'forward',
    })
    expect(pickFocusNode(progress, 'math')).toEqual({
      node: 'add-to-10',
      mode: 'forward',
    })
  })

  it('returns the graduation CVC review with mode "cvc-review" on the first eligible word-song session', () => {
    const progress = buildReviewProgress({
      cvcGraduationSessionFired: false,
    })
    // Forward picker would have landed on the first non-mastered node
    // (everything mastered → simple-sentences); review mode overrides it.
    expect(pickFocusNode(progress, 'word-song', 0)).toEqual({
      node: 'cvc-words-short-u',
      mode: 'cvc-review',
    })
  })

  it('returns a periodic CVC review with mode "cvc-review" on an Nth post-graduation session', () => {
    const progress = buildReviewProgress({
      cvcGraduationSessionFired: true,
    })
    expect(
      pickFocusNode(progress, 'word-song', CVC_REVIEW_PERIOD_SESSIONS),
    ).toEqual({ node: CVC_TIERS[1], mode: 'cvc-review' })
  })

  it('falls through to the forward walk (mode "forward") on a non-review session', () => {
    // All CVC mastered, latch true, non-period session → forward picker
    // lands on the next non-mastered node (digraphs-sh here).
    const progress = buildProgress(
      { 'digraphs-sh': 'practicing' },
      { cvcGraduationSessionFired: true },
    )
    expect(pickFocusNode(progress, 'word-song', 3)).toEqual({
      node: 'digraphs-sh',
      mode: 'forward',
    })
  })

  it('never enters CVC review on the math track even when CVC tiers are mastered', () => {
    // CVC review is word-song-only. A math-track call must always be
    // forward, regardless of CVC mastery / latch / sessionCount.
    const progress = buildReviewProgress({
      cvcGraduationSessionFired: false,
    })
    const pick = pickFocusNode(progress, 'math', CVC_REVIEW_PERIOD_SESSIONS)
    expect(pick.mode).toBe('forward')
    // Every math node mastered → defensive fallback to the last node.
    expect(pick.node).toBe('mult-6-9')
  })
})

/**
 * Regression: the e2e-failure class on PR #471 (ticket 86c9qa6n3). The
 * graduation latch is UNSET (falsy) for any child who has not yet had her
 * one-shot graduation review — which is the actual state of every forward
 * learner who has NOT yet completed the whole word-song tree. The unit
 * tests above default the latch to `true` (a convenience for the
 * forward-walk suite), which MASKED this bug: with the latch falsy, the
 * original `pickCvcReviewNode` consult (gated only on "all CVC mastered")
 * hijacked the wire `focusNode` to `cvc-words-short-u` for any seed with
 * the three cross-vowel CVC tiers mastered + a later tier in progress —
 * short-i / short-e / digraphs / sight-words / simple-sentences — exactly
 * the ~30 e2e failures.
 *
 * The fix anchors the review consult to "the forward walk found NO
 * non-mastered node" — i.e. review only fires once the whole tree is
 * mastered (the standing maintenance layer), never overriding an
 * actively-progressing forward tier. This matches the established e2e
 * contract:
 *   - `cvc-cross-vowel-mix-regression.spec.ts` test 1 (digraphs-sh
 *     `'practicing'`, latch unset) asserts wire focusNode === digraphs-sh.
 *   - `progression-mastery-loop.spec.ts` short-e walk asserts the boundary
 *     session (digraphs-sh just unlocked, latch unset) runs on digraphs-sh.
 *
 * These tests pin BOTH sides of the gate with the latch falsy (the real
 * production / e2e seed shape, NOT the latch-true convenience default).
 */
describe('pickFocusNode — CVC review does NOT override forward progression (PR #471 regression, latch falsy)', () => {
  /**
   * Mirror the e2e regression-spec seeds: every word-song node up to the
   * named tier mastered, that tier `practicing`, graduation latch UNSET,
   * everything downstream at its default. `sessionCount: 5` matches the
   * seeds' `buildSeedSessionHistory` AND lands on the CVC review period —
   * the worst case for a hijack.
   */
  function forwardTierSeed(practicing: string): Progress {
    const base = defaultProgress()
    const levels = { ...base.skillLevels }
    // Master everything up to (but not including) the practicing tier.
    for (const node of WORD_SONG_NODES_IN_ORDER) {
      if (node === practicing) break
      levels[node] = 'mastered'
    }
    levels[practicing as keyof typeof levels] = 'practicing'
    return {
      ...base,
      skillLevels: levels,
      // Latch UNSET — the state a real forward learner is in before her
      // one-shot graduation review. This is what the convenience default
      // of `true` in `buildProgress` was masking.
      cvcGraduationSessionFired: undefined,
    }
  }

  // Every forward tier past the three cross-vowel CVC tiers — whether a
  // later CVC sibling (short-i / short-e) OR a non-CVC tier (digraphs /
  // sight-words / simple-sentences) — must hold focus when it is the
  // actively-progressing tier. With all three cross-vowel tiers mastered
  // (so `cvcReviewEligible` is true) AND the latch unset AND sessionCount
  // on a review period, the pre-fix code returned `cvc-words-short-u`; the
  // fix returns the forward tier.
  it.each([
    'cvc-words-short-i',
    'cvc-words-short-e',
    'digraphs-sh',
    'digraphs-ch',
    'digraphs-th-voiceless',
    'sight-words',
    'simple-sentences',
  ])(
    'returns %s as a forward pick — review does NOT override active progression',
    (tier) => {
      const pick = pickFocusNode(forwardTierSeed(tier), 'word-song', 5)
      expect(pick).toEqual({ node: tier, mode: 'forward' })
    },
  )

  // The exact wire shape the e2e specs assert: a short-i forward learner's
  // session-start payload must carry focusNode === 'cvc-words-short-i', NOT
  // the review tier. This is the assertion that was RED on the e2e run.
  it('forward short-i learner exposes focusNode === cvc-words-short-i on the wire (was cvc-words-short-u)', () => {
    const { node } = pickFocusNode(
      forwardTierSeed('cvc-words-short-i'),
      'word-song',
      5,
    )
    expect(node).toBe('cvc-words-short-i')
  })

  // The boundary session: short-e just mastered, digraphs-sh just unlocked
  // to 'intro', latch unset (mirrors `progression-mastery-loop.spec.ts`
  // session 4). Forward progression on digraphs-sh wins — the graduation
  // review does NOT pre-empt the first digraphs-sh session.
  it('runs digraphs-sh forward at the CVC→digraphs boundary (digraphs-sh intro, latch unset)', () => {
    const base = defaultProgress()
    const levels = { ...base.skillLevels }
    for (const node of WORD_SONG_NODES_IN_ORDER) {
      if (node === 'digraphs-sh') break
      levels[node] = 'mastered'
    }
    levels['digraphs-sh'] = 'intro'
    const progress: Progress = {
      ...base,
      skillLevels: levels,
      cvcGraduationSessionFired: undefined,
    }
    expect(pickFocusNode(progress, 'word-song', 5)).toEqual({
      node: 'digraphs-sh',
      mode: 'forward',
    })
  })

  // Once the WHOLE tree is mastered (no forward progress left) and the
  // latch is unset, CVC review DOES take over as the maintenance layer —
  // this is the path that makes cross-vowel mixing fire. The graduation
  // pick is short-u regardless of sessionCount.
  it('enters CVC review only when the whole tree is mastered (latch unset → graduation short-u)', () => {
    const base = defaultProgress()
    const allMastered = Object.fromEntries(
      Object.keys(base.skillLevels).map((k) => [k, 'mastered']),
    ) as typeof base.skillLevels
    const progress: Progress = {
      ...base,
      skillLevels: allMastered,
      cvcGraduationSessionFired: undefined,
    }
    expect(pickFocusNode(progress, 'word-song', 3)).toEqual({
      node: 'cvc-words-short-u',
      mode: 'cvc-review',
    })
  })
})
