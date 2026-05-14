/**
 * Unit tests for the M3 mastery promotion rule (ticket 86c9kmwd0).
 *
 * Pure-function tests — no React, no localStorage, no SDK. Each test
 * builds a synthetic `Progress` document, runs `applyMasteryRule()`,
 * and asserts on the resulting shape.
 *
 * Test scenarios mirror the ones spelled out in the dispatch contract
 * (Thomas's 2026-05-01 update comment) — defaults exercise 95/3
 * cross-day, the threshold-override test proves settings propagate,
 * and the autoPromote / crossDayEnforcement toggles each have a paired
 * test that proves they actually steer behaviour.
 *
 * Manila timezone (P0.3 audit follow-up to PR #120)
 * -------------------------------------------------
 * `dedupeByCalendarDay` now keys on local-tz `YYYY-MM-DD` (matching the
 * streak counter in `sessionHistory.ts`). The Manila regression below
 * needs the runtime tz pinned to `Asia/Manila` to exercise the
 * 22:00–06:00 wrap that previously collapsed under UTC. We set
 * `process.env.TZ` at module load — Node reads it on first `Date`
 * construction, vitest workers honour it because the import happens
 * before any test body runs. The other tests in this file use UTC
 * timestamps that produce the same number of distinct local days
 * under either tz, so this is safe.
 */

process.env.TZ = 'Asia/Manila'

import { describe, expect, it } from 'vitest'
import {
  CVC_CROSS_VOWEL_NODES,
  LITERACY_TREE,
  MATH_TREE,
  NOVEL_POOL_THRESHOLD,
  WORD_SONG_GRADUATION_GATED_NODES,
  applyMasteryRule,
  crossVowelMixingActive,
  isGraduationSessionPending,
  nextNode,
} from './mastery'
import { defaultProgress } from './defaults'
import { MATH_NODES_IN_ORDER, WORD_SONG_NODES_IN_ORDER } from './focusNode'
import type {
  ParentSettings,
  Progress,
  SessionHistoryEntry,
  SkillLevels,
  SkillNode,
} from './types'

/** Build a SkillLevels map with everything `locked` plus per-node overrides. */
function levels(overrides: Partial<SkillLevels> = {}): SkillLevels {
  const base = defaultProgress().skillLevels
  const allLocked = Object.fromEntries(
    Object.keys(base).map((k) => [k, 'locked']),
  ) as SkillLevels
  return { ...allLocked, ...overrides }
}

/**
 * Build a `Progress` with the supplied skillLevels, history, and settings.
 *
 * `parentSettings.masteryThreshold` accepts a partial per-track map
 * (math and/or word-song). Missing tracks are filled from the per-track
 * defaults so a test that overrides only math doesn't accidentally
 * shift word-song's threshold.
 */
function buildProgress(args: {
  skillLevels: SkillLevels
  history?: SessionHistoryEntry[]
  parentSettings?: Partial<ParentSettings>
  pendingPromotion?: SkillNode
}): Progress {
  const base = defaultProgress()
  return {
    ...base,
    skillLevels: args.skillLevels,
    history: args.history ?? [],
    parentSettings: args.parentSettings
      ? {
          ...base.parentSettings!,
          ...args.parentSettings,
          masteryThreshold: {
            ...base.parentSettings!.masteryThreshold,
            ...(args.parentSettings.masteryThreshold ?? {}),
          },
        }
      : base.parentSettings,
    ...(args.pendingPromotion !== undefined
      ? { pendingPromotion: args.pendingPromotion }
      : {}),
  }
}

/** Build a SessionHistoryEntry with concise input. */
function entry(
  dateISO: string,
  node: SkillNode,
  successRate: number,
): SessionHistoryEntry {
  return { dateISO, skillFocus: [node], successRate }
}

/**
 * Build a graduation-session entry — same shape as `entry()` plus the
 * `novelPoolSuccessRate` tag (ticket 86c9m3aec). The presence of the
 * tag is what tells the engine "this was a graduation run, not a
 * regular session".
 */
function graduationEntry(
  dateISO: string,
  node: SkillNode,
  canonicalRate: number,
  novelRate: number,
): SessionHistoryEntry {
  return {
    dateISO,
    skillFocus: [node],
    successRate: canonicalRate,
    novelPoolSuccessRate: novelRate,
  }
}

// --------------------------------------------------------------------------
// Tree adjacency
// --------------------------------------------------------------------------

describe('MATH_TREE / LITERACY_TREE', () => {
  it('mirrors MATH_NODES_IN_ORDER from focusNode.ts', () => {
    // M2 (focusNode.ts) and M3 (mastery.ts) both declare a math tree
    // order. They MUST stay in lockstep — the planner's prompt and
    // the promotion downstream walk depend on the same sequence. If
    // a future ticket reorders one without the other, this fails CI.
    expect(MATH_TREE).toEqual(MATH_NODES_IN_ORDER)
  })

  it('mirrors WORD_SONG_NODES_IN_ORDER from focusNode.ts', () => {
    expect(LITERACY_TREE).toEqual(WORD_SONG_NODES_IN_ORDER)
  })
})

describe('nextNode', () => {
  it('returns the next math node', () => {
    expect(nextNode('math', 'add-to-10')).toBe('add-to-20')
    expect(nextNode('math', 'number-recog')).toBe('add-to-10')
  })

  it('returns the next literacy node', () => {
    expect(nextNode('word-song', 'blending-cv')).toBe('cvc-words')
  })

  it('returns null for the last node in a track', () => {
    expect(nextNode('math', 'mult-6-9')).toBeNull()
    expect(nextNode('word-song', 'simple-sentences')).toBeNull()
  })

  it('returns null when the node does not appear in the track', () => {
    // Calling with a wrong-track node is a programming error; we
    // return null rather than throw so the caller doesn't crash on a
    // typo in a future refactor.
    expect(nextNode('math', 'blending-cv')).toBeNull()
    expect(nextNode('word-song', 'add-to-10')).toBeNull()
  })
})

// --------------------------------------------------------------------------
// Default rule (95% / 3 sessions, cross-day on, autoPromote on)
// --------------------------------------------------------------------------

describe('applyMasteryRule — defaults (95/3, cross-day, autoPromote)', () => {
  it('promotes after 3 cross-day high-score entries on add-to-10', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 0.95),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-10']).toBe('mastered')
    // Downstream node was locked; should now be intro.
    expect(result.skillLevels['add-to-20']).toBe('intro')
    // Ticket 86c9m3brc — pendingPromotion is set under autoPromote=true
    // so the Hub celebration fires for default users. The flag is
    // cleared by the stale-clear branch on the next applyMasteryRule
    // call (covered by the transient-clear lifecycle test below).
    expect(result.pendingPromotion).toBe('add-to-10')
  })

  it('does not promote with only 2 cross-day high-score entries', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-10']).toBe('practicing')
    expect(result.skillLevels['add-to-20']).toBe('locked')
    expect(result.pendingPromotion).toBeUndefined()
  })

  it('does not promote when 3 high-score entries land on the same calendar day', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-05-01T08:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T12:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T18:00:00.000Z', 'add-to-10', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    // After cross-day dedupe these collapse to ONE entry, so the
    // 3-session requirement is unmet.
    expect(result.skillLevels['add-to-10']).toBe('practicing')
  })

  it('leaves an already-practicing downstream node alone', () => {
    const progress = buildProgress({
      skillLevels: levels({
        'add-to-10': 'practicing',
        'add-to-20': 'practicing',
      }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-10']).toBe('mastered')
    // Already-practicing downstream is NOT demoted / reset.
    expect(result.skillLevels['add-to-20']).toBe('practicing')
  })

  it('is a no-op for an already-mastered node with new high-score history', () => {
    const progress = buildProgress({
      skillLevels: levels({
        'add-to-10': 'mastered',
        'add-to-20': 'practicing',
      }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-10']).toBe('mastered')
    // Downstream is at practicing already; do not touch.
    expect(result.skillLevels['add-to-20']).toBe('practicing')
  })

  it('is idempotent on skillLevels — running twice yields the same skill-level shape', () => {
    // Idempotence is asserted on `skillLevels` only. The
    // `pendingPromotion` field is intentionally transient under
    // autoPromote=true (ticket 86c9m3brc): set on the first call to
    // drive the Hub celebration, cleared by the stale-clear branch on
    // the second call (since the queued node is now 'mastered', no
    // longer 'practicing'). See the dedicated test below for the
    // transient-clear lifecycle.
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 1.0),
      ],
    })
    const once = applyMasteryRule(progress)
    const twice = applyMasteryRule(once)
    expect(twice.skillLevels).toEqual(once.skillLevels)
  })

  it('walks both tracks per call', () => {
    // add-to-10 (math) and blending-cv (word-song) BOTH qualify in
    // the same call. Both should land mastered + downstream unlock.
    const progress = buildProgress({
      skillLevels: levels({
        'add-to-10': 'practicing',
        'blending-cv': 'practicing',
      }),
      history: [
        // math
        entry('2026-04-29T08:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T08:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T08:00:00.000Z', 'add-to-10', 1.0),
        // literacy
        entry('2026-04-29T10:00:00.000Z', 'blending-cv', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'blending-cv', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'blending-cv', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-10']).toBe('mastered')
    expect(result.skillLevels['add-to-20']).toBe('intro')
    expect(result.skillLevels['blending-cv']).toBe('mastered')
    expect(result.skillLevels['cvc-words']).toBe('intro')
  })

  it('does not mutate the input progress', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 1.0),
      ],
    })
    applyMasteryRule(progress)
    // Source-of-truth input must remain at 'practicing'.
    expect(progress.skillLevels['add-to-10']).toBe('practicing')
    expect(progress.skillLevels['add-to-20']).toBe('locked')
  })

  // ── P0.3 regression: cross-day uses LOCAL day, not UTC ──────────────
  //
  // Audit: `design/audits/2026-05-02-polish/jessica-qa-edge-cases.md`
  // § P0.3. Manila is UTC+8, so the 22:00–06:00 evening/morning wrap
  // crosses a local day even though both stamps land in the same UTC
  // day.
  //
  // The bug shape is specifically about UTC `Z`-format `dateISO`
  // values — that's what `recordProgressOnSessionEnd` writes via
  // `clock().toISOString()`. The earlier `dedupeByCalendarDay` keyed
  // on `dateISO.slice(0,10)`, which under Z-format gives the UTC day.
  // We use UTC `Z` timestamps below so the test exercises the actual
  // production write shape — not `+08:00` offset strings, which the
  // old slice-prefix code would have day-keyed correctly by accident.
  //
  // Three Manila wall-clock evenings, written in UTC `Z` form:
  //   2026-04-29T14:00:00.000Z = Manila 2026-04-29 22:00 → local 04-29
  //   2026-04-29T23:00:00.000Z = Manila 2026-04-30 07:00 → local 04-30
  //   2026-05-01T14:00:00.000Z = Manila 2026-05-01 22:00 → local 05-01
  //
  // Old behaviour: UTC slice → days = {04-29, 04-29, 05-01} → dedupe to
  //                2 rows → < 3 threshold → no promotion.
  // Fixed behaviour: local-tz day-key → {04-29, 04-30, 05-01} →
  //                3 distinct days → all at 1.0 successRate → promotion
  //                fires.
  //
  // Pinned by `process.env.TZ = 'Asia/Manila'` at the top of this file.
  // The streak counter in `sessionHistory.ts` was already local-tz, so
  // before this fix Marian's stardust display would say "3-day streak"
  // while the mastery rule said "1 day" — same `dateISO`, two
  // semantics. After the fix the two are aligned.
  it('promotes when Manila evening + morning entries cross a local day (P0.3)', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-29T14:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-29T23:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T14:00:00.000Z', 'add-to-10', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-10']).toBe('mastered')
    expect(result.skillLevels['add-to-20']).toBe('intro')
  })

  it('does not collapse two distinct local days that share a UTC day (P0.3 dedupe shape)', () => {
    // Tighter than the promotion test above. Two UTC `Z` timestamps
    // that share the same UTC `slice(0,10)` prefix (`2026-04-29`) but
    // straddle the local Manila day boundary.
    //
    // Old behaviour (UTC slice key): both rows collapse to one →
    // 1 deduped entry → < 2-session threshold → no promotion.
    // Fixed behaviour (local-day key): one row per local day → 2
    // deduped entries → meets the override 2-session threshold → promotes.
    //
    // The promotion outcome is the assertion vehicle for "both rows
    // survived dedupe" (count-based exactness — never a `.toContain`,
    // per project regression-test convention).
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-29T14:00:00.000Z', 'add-to-10', 1.0), // Manila 04-29 22:00
        entry('2026-04-29T23:00:00.000Z', 'add-to-10', 1.0), // Manila 04-30 07:00
      ],
      parentSettings: {
        masteryThreshold: {
          math: { percent: 0.95, sessions: 2 },
          'word-song': { percent: 0.9, sessions: 3 },
        },
      },
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-10']).toBe('mastered')
  })
})

// --------------------------------------------------------------------------
// Threshold override — proves settings propagate
// --------------------------------------------------------------------------

describe('applyMasteryRule — threshold override 80/2 (math track)', () => {
  it('promotes with 2 cross-day entries at 0.81', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 0.81),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 0.81),
      ],
      parentSettings: {
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
          'word-song': { percent: 0.9, sessions: 3 },
        },
      },
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-10']).toBe('mastered')
    expect(result.skillLevels['add-to-20']).toBe('intro')
  })

  it('does not promote when 1 of 2 is below the 80% threshold', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 0.79),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 0.85),
      ],
      parentSettings: {
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
          'word-song': { percent: 0.9, sessions: 3 },
        },
      },
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-10']).toBe('practicing')
  })
})

// --------------------------------------------------------------------------
// autoPromote=false — queues pendingPromotion, does NOT mutate skillLevels
// --------------------------------------------------------------------------

describe('applyMasteryRule — autoPromote=false', () => {
  it('queues pendingPromotion and does not mutate skillLevels', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 1.0),
      ],
      parentSettings: { autoPromote: false },
    })
    const result = applyMasteryRule(progress)
    // skillLevels must be unchanged — count-based exactness, not
    // membership (per project regression-test convention).
    expect(result.skillLevels).toEqual(progress.skillLevels)
    expect(result.pendingPromotion).toBe('add-to-10')
  })

  it('flipping autoPromote to true and re-running applies the queued promotion', () => {
    // First run: queue a promotion.
    const queued = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 1.0),
      ],
      parentSettings: { autoPromote: false },
    })
    const queuedResult = applyMasteryRule(queued)
    expect(queuedResult.pendingPromotion).toBe('add-to-10')

    // Parent flips autoPromote=true. Re-run.
    const flipped: Progress = {
      ...queuedResult,
      parentSettings: {
        ...queuedResult.parentSettings!,
        autoPromote: true,
      },
    }
    const applied = applyMasteryRule(flipped)
    expect(applied.skillLevels['add-to-10']).toBe('mastered')
    expect(applied.skillLevels['add-to-20']).toBe('intro')
    expect(applied.pendingPromotion).toBeUndefined()
  })

  it('preserves a prior pendingPromotion across calls when autoPromote stays false', () => {
    const progress = buildProgress({
      skillLevels: levels({
        'add-to-10': 'practicing',
        'blending-cv': 'practicing',
      }),
      history: [
        // Both add-to-10 and blending-cv qualify in this call.
        entry('2026-04-29T08:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T08:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T08:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-29T10:00:00.000Z', 'blending-cv', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'blending-cv', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'blending-cv', 1.0),
      ],
      parentSettings: { autoPromote: false },
      // Pretend we previously queued blending-cv. The new call sees
      // both qualify; the prior queue must NOT be stomped.
      pendingPromotion: 'blending-cv',
    })
    const result = applyMasteryRule(progress)
    expect(result.pendingPromotion).toBe('blending-cv')
    expect(result.skillLevels).toEqual(progress.skillLevels)
  })

  it('queues the earliest tree-order candidate when multiple qualify', () => {
    // Math comes before literacy; within math, add-to-10 is earlier
    // than mult-2-5-10. (The diagnostic seeds mult-2-5-10 as 'intro';
    // we override it to 'practicing' for this scenario.)
    const progress = buildProgress({
      skillLevels: levels({
        'add-to-10': 'practicing',
        'mult-2-5-10': 'practicing',
        'blending-cv': 'practicing',
      }),
      history: [
        // mult-2-5-10 qualifies (earlier dates)
        entry('2026-04-20T08:00:00.000Z', 'mult-2-5-10', 1.0),
        entry('2026-04-21T08:00:00.000Z', 'mult-2-5-10', 1.0),
        entry('2026-04-22T08:00:00.000Z', 'mult-2-5-10', 1.0),
        // add-to-10 qualifies
        entry('2026-04-29T08:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T08:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T08:00:00.000Z', 'add-to-10', 1.0),
        // blending-cv qualifies
        entry('2026-04-29T10:00:00.000Z', 'blending-cv', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'blending-cv', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'blending-cv', 1.0),
      ],
      parentSettings: { autoPromote: false },
    })
    const result = applyMasteryRule(progress)
    // Tree-order winner: math 'add-to-10' is index 1 in MATH_TREE,
    // mult-2-5-10 is index 7. add-to-10 wins.
    expect(result.pendingPromotion).toBe('add-to-10')
    expect(result.skillLevels).toEqual(progress.skillLevels)
  })
})

// --------------------------------------------------------------------------
// autoPromote=true — sets transient pendingPromotion alongside skillLevels
// (ticket 86c9m3brc — drives Hub celebration for default users)
// --------------------------------------------------------------------------
//
// Background: PR #140 wired the Hub celebration to read
// `progress.pendingPromotion`. But the M3 mastery engine only wrote that
// field in the autoPromote=false branch (parent-confirms flow). Since
// autoPromote defaults to true per the M2.5 ParentSettings contract,
// virtually no one saw the celebration — the default-user path mutated
// `skillLevels` silently and never set the celebration cue.
//
// Fix: under autoPromote=true, ALSO set `pendingPromotion` to the
// earliest tree-order node that promoted this call, in addition to the
// `skillLevels` mutation. The flag is transient — the next
// `applyMasteryRule` run sees the queued node is no longer 'practicing'
// (it's now 'mastered') and the stale-clear branch deletes it. So the
// field exists ONLY to drive the next Hub mount's celebration; once the
// next session-end runs the rule again, the field clears.

describe('applyMasteryRule — autoPromote=true sets pendingPromotion (ticket 86c9m3brc)', () => {
  it('sets pendingPromotion alongside skillLevels mutation under default settings', () => {
    // The core AC — under default settings (autoPromote=true), a
    // qualifying promotion must produce BOTH:
    //   - skillLevels[node] = 'mastered' (today's behaviour)
    //   - pendingPromotion = node       (the new write)
    // …in a single applyMasteryRule call. Without this, default users
    // (everyone) never see the Hub celebration that PR #140 shipped.
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 1.0),
      ],
      // No parentSettings override — defaultProgress() ships
      // autoPromote=true and the math 95/3 threshold.
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-10']).toBe('mastered')
    expect(result.skillLevels['add-to-20']).toBe('intro')
    expect(result.pendingPromotion).toBe('add-to-10')
  })

  it('clears the transient pendingPromotion on the next applyMasteryRule call', () => {
    // The transient-clear lifecycle: session-end 1 sets the flag,
    // session-end 2 clears it via the stale-clear branch (queued node
    // is now 'mastered', so the existing line 226-230 delete fires).
    // This is what makes the field "exists ONLY to drive the next Hub
    // mount, then clears" per the AC — no parent-confirm involvement.
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 1.0),
      ],
    })
    const sessionEnd1 = applyMasteryRule(progress)
    expect(sessionEnd1.pendingPromotion).toBe('add-to-10')

    // Simulate the next session-end with no fresh qualifying history
    // for any other node — the rule re-runs against the now-promoted
    // state and clears the transient flag.
    const sessionEnd2 = applyMasteryRule(sessionEnd1)
    expect(sessionEnd2.pendingPromotion).toBeUndefined()
    // skillLevels stay where they were — no double-promotion.
    expect(sessionEnd2.skillLevels['add-to-10']).toBe('mastered')
    expect(sessionEnd2.skillLevels['add-to-20']).toBe('intro')
  })

  it('queues the earliest tree-order node when multiple qualify in a single call', () => {
    // When two nodes both qualify in one session (rare but possible —
    // e.g. a long history catches up multiple branches), pendingPromotion
    // surfaces only the earliest in tree order. Both nodes still mutate
    // on `skillLevels`; only the celebration cue is single-valued.
    // Mirrors the autoPromote=false ordering convention (math first,
    // then literacy; within a track, root-to-leaf order).
    const progress = buildProgress({
      skillLevels: levels({
        'add-to-10': 'practicing',
        'blending-cv': 'practicing',
      }),
      history: [
        entry('2026-04-29T08:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-30T08:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T08:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-04-29T10:00:00.000Z', 'blending-cv', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'blending-cv', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'blending-cv', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    // Both promote on skillLevels.
    expect(result.skillLevels['add-to-10']).toBe('mastered')
    expect(result.skillLevels['blending-cv']).toBe('mastered')
    // Earliest tree-order is math 'add-to-10'.
    expect(result.pendingPromotion).toBe('add-to-10')
  })

  it('does not set pendingPromotion when no candidate qualifies', () => {
    // Mid-progression no-cross — the engine runs at every session-end
    // even when no threshold is met. We must not leak a stale flag in
    // that case.
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        // Two qualifying entries; threshold is 3. No promotion.
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-10']).toBe('practicing')
    expect(result.pendingPromotion).toBeUndefined()
  })

  it('promotes cvc-words via graduation gate AND sets pendingPromotion under autoPromote=true', () => {
    // Graduation-gated path (PR #145): canonical 90/3 + novel ≥ 0.80
    // both clear → promotion fires under default autoPromote=true. The
    // celebration cue must surface alongside the skillLevels mutation
    // just like the non-gated path. Verifies my change interacts
    // cleanly with the graduation gate.
    //
    // Ticket 86c9m3ae3 inserted `cvc-words-short-o` between `cvc-words`
    // and `digraphs-sh` in LITERACY_TREE — so the downstream node that
    // unlocks on cvc-words promotion is now `cvc-words-short-o` (not
    // a digraph node directly). The first digraph sibling node only
    // unlocks once short-e graduates; that's a much later session.
    // (PR #211 split the single `digraphs` literal into 3 sequential
    // sibling nodes; this assertion pins the leading digraph sibling.)
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0),
        graduationEntry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0, 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['cvc-words']).toBe('mastered')
    expect(result.skillLevels['cvc-words-short-o']).toBe('intro')
    expect(result.skillLevels['digraphs-sh']).toBe('locked')
    expect(result.pendingPromotion).toBe('cvc-words')
  })

  it('does not re-fire pendingPromotion on subsequent session ends after a graduation promotion', () => {
    // The brief flagged this edge case explicitly: "After a successful
    // graduation under autoPromote=true: cvc-words → mastered,
    // digraphs → intro, AND pendingPromotion = 'cvc-words'. The
    // graduation gate's 'any novelPoolSuccessRate in tail blocks
    // re-graduation' rule already ensures cvc-words doesn't re-trigger;
    // but verify that the pendingPromotion setter doesn't accidentally
    // re-fire on subsequent sessions where the engine re-runs."
    //
    // Walk: graduation session → applyMasteryRule (sets flag) →
    // simulated next session-end at non-promotion threshold → second
    // applyMasteryRule (clears flag) → no re-fire on a third pass.
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0),
        graduationEntry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0, 1.0),
      ],
    })
    const sessionEnd1 = applyMasteryRule(progress)
    expect(sessionEnd1.pendingPromotion).toBe('cvc-words')
    expect(sessionEnd1.skillLevels['cvc-words']).toBe('mastered')

    // Second session-end (no fresh history relevant): clear.
    const sessionEnd2 = applyMasteryRule(sessionEnd1)
    expect(sessionEnd2.pendingPromotion).toBeUndefined()
    expect(sessionEnd2.skillLevels['cvc-words']).toBe('mastered')

    // Third pass for paranoia — confirm no resurrection.
    const sessionEnd3 = applyMasteryRule(sessionEnd2)
    expect(sessionEnd3.pendingPromotion).toBeUndefined()
    expect(sessionEnd3.skillLevels['cvc-words']).toBe('mastered')
  })
})

// --------------------------------------------------------------------------
// crossDayEnforcement=false — same-day entries count individually
// --------------------------------------------------------------------------

describe('applyMasteryRule — crossDayEnforcement=false', () => {
  it('promotes when 3 same-day entries qualify and the toggle is off', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-05-01T08:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T12:00:00.000Z', 'add-to-10', 1.0),
        entry('2026-05-01T18:00:00.000Z', 'add-to-10', 1.0),
      ],
      parentSettings: { crossDayEnforcement: false },
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-10']).toBe('mastered')
    expect(result.skillLevels['add-to-20']).toBe('intro')
  })
})

// --------------------------------------------------------------------------
// Pending promotion edge cases
// --------------------------------------------------------------------------

describe('applyMasteryRule — pendingPromotion edge cases', () => {
  it('clears a stale pendingPromotion whose node is no longer practicing', () => {
    // pendingPromotion points to a node that's now mastered. The
    // queue is stale; clear it.
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'mastered' }),
      pendingPromotion: 'add-to-10',
    })
    const result = applyMasteryRule(progress)
    expect(result.pendingPromotion).toBeUndefined()
  })

  it('does not promote downstream when the queued node is no longer practicing', () => {
    // add-to-10 was already promoted by some other path; the queue is
    // stale. Don't double-promote add-to-20.
    const progress = buildProgress({
      skillLevels: levels({
        'add-to-10': 'mastered',
        'add-to-20': 'locked',
      }),
      pendingPromotion: 'add-to-10',
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['add-to-20']).toBe('locked')
    expect(result.pendingPromotion).toBeUndefined()
  })
})

// --------------------------------------------------------------------------
// Per-track defaults — math 95/3 + word-song 90/3 (ticket 86c9kwvy0)
// --------------------------------------------------------------------------
//
// Default behaviour after the 2026-05-02 split: math demands 95% over
// 3 sessions; word-song accepts 90% over 3 sessions. The two tests
// below pin both halves of that asymmetry on the SAME data shape (3
// cross-day entries at 0.91 success), demonstrating that the rule
// reads the per-track threshold and not a single global value.
//
// Math at 0.91 < 0.95 → no promotion.
// Word-song at 0.91 ≥ 0.90 → promotion.
//
// `buildProgress` here passes NO parentSettings override so the
// defaults from `defaultProgress()` flow through — the assertion
// vehicle is the divergent outcome on identical successRate data.

describe('applyMasteryRule — per-track defaults (ticket 86c9kwvy0)', () => {
  it('promotes word-song with 3 sessions at 0.91 under the 90/3 default', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'blending-cv': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'blending-cv', 0.91),
        entry('2026-04-30T10:00:00.000Z', 'blending-cv', 0.91),
        entry('2026-05-01T10:00:00.000Z', 'blending-cv', 0.91),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['blending-cv']).toBe('mastered')
    // Downstream node was 'intro' in defaultProgress() seed; it's not
    // 'locked' so the rule leaves it as-is. The promotion of
    // blending-cv is the assertion vehicle here.
  })

  it('does NOT promote math with 3 sessions at 0.91 under the 95/3 default', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'add-to-10', 0.91),
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 0.91),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 0.91),
      ],
    })
    const result = applyMasteryRule(progress)
    // 0.91 < 0.95 — fails the math threshold.
    expect(result.skillLevels['add-to-10']).toBe('practicing')
    expect(result.skillLevels['add-to-20']).toBe('locked')
    expect(result.pendingPromotion).toBeUndefined()
  })

  it('reads the math threshold for math nodes and the word-song threshold for literacy nodes within a single call', () => {
    // Both tracks have qualifying 0.91 history — but only word-song
    // promotes under defaults. This proves the per-track lookup happens
    // once per track, not once per node-from-the-same-settings.
    const progress = buildProgress({
      skillLevels: levels({
        'add-to-10': 'practicing',
        'blending-cv': 'practicing',
      }),
      history: [
        entry('2026-04-29T08:00:00.000Z', 'add-to-10', 0.91),
        entry('2026-04-30T08:00:00.000Z', 'add-to-10', 0.91),
        entry('2026-05-01T08:00:00.000Z', 'add-to-10', 0.91),
        entry('2026-04-29T10:00:00.000Z', 'blending-cv', 0.91),
        entry('2026-04-30T10:00:00.000Z', 'blending-cv', 0.91),
        entry('2026-05-01T10:00:00.000Z', 'blending-cv', 0.91),
      ],
    })
    const result = applyMasteryRule(progress)
    // Math: 0.91 < 0.95 — no promotion.
    expect(result.skillLevels['add-to-10']).toBe('practicing')
    expect(result.skillLevels['add-to-20']).toBe('locked')
    // Word-song: 0.91 ≥ 0.90 — promotion fires.
    expect(result.skillLevels['blending-cv']).toBe('mastered')
  })
})

// --------------------------------------------------------------------------
// Graduation gate — novel-word generalization check (ticket 86c9m3aec)
// --------------------------------------------------------------------------
//
// Per Dave's developmental review (`design/research/cvc-words-developmental-
// review.md` § P1.2), the standard 90/3 rule on the canonical 8-word
// pool can reflect item familiarity rather than decoding skill.
// `cvc-words` joins `WORD_SONG_GRADUATION_GATED_NODES`: promotion
// requires (a) the canonical 90/3 to clear AND (b) the most recent
// qualifying entry to carry a `novelPoolSuccessRate >= 0.80`. The
// detection helper `isGraduationSessionPending` flags the next
// session for novel-word probe insertion when the canonical window
// is full but the gate hasn't fired yet.

describe('WORD_SONG_GRADUATION_GATED_NODES + NOVEL_POOL_THRESHOLD constants', () => {
  it('cvc-words is the only graduation-gated node in v1', () => {
    // Pin the graduation set explicitly (count-based exactness) so a
    // future widening (short-o / short-u sibling nodes) lands as a
    // deliberate paired edit on this test, not as silent drift.
    expect(WORD_SONG_GRADUATION_GATED_NODES).toEqual(['cvc-words'])
  })

  it('novel-pool threshold is 0.80', () => {
    // Locked at 0.80 per Dave §6 P1 ("50% on 2 novel items is a
    // reasonable generalization signal"; 80% is the conservative
    // v1 bar). A future tunability move to parentSettings would
    // change this constant + the test together.
    expect(NOVEL_POOL_THRESHOLD).toBe(0.8)
  })
})

describe('isGraduationSessionPending — cvc-words detector (ticket 86c9m3aec)', () => {
  it('returns true after 3 cross-day canonical sessions at 100% with no novelPoolSuccessRate', () => {
    // AC#4 round-trip part 1: "Simulate 3 sessions of canonical 8
    // cvc-words at 100% → assert next session is flagged as
    // graduation".
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0),
      ],
    })
    expect(isGraduationSessionPending(progress, 'cvc-words', 'word-song')).toBe(
      true,
    )
  })

  it('returns false when the node is at intro (default seed level)', () => {
    // cvc-words starts at 'intro' in defaultProgress(); a graduation
    // gate cannot fire until the node has reached 'practicing'.
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'intro' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0),
      ],
    })
    expect(isGraduationSessionPending(progress, 'cvc-words', 'word-song')).toBe(
      false,
    )
  })

  it('returns false for a non-graduation-gated node (blending-cv)', () => {
    // The graduation gate is currently cvc-words-only. Other word-song
    // nodes (blending-cv, etc.) follow the standard 90/3 rule with no
    // novel-word probe. Pinning here so a future widening to short-o
    // sibling nodes is a paired edit on the gated set + this test.
    const progress = buildProgress({
      skillLevels: levels({ 'blending-cv': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'blending-cv', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'blending-cv', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'blending-cv', 1.0),
      ],
    })
    expect(
      isGraduationSessionPending(progress, 'blending-cv', 'word-song'),
    ).toBe(false)
  })

  it('returns false with only 2 cross-day qualifying entries', () => {
    // Need exactly threshold.sessions cross-day entries for the
    // canonical window to be full. Two days short → no graduation.
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0),
      ],
    })
    expect(isGraduationSessionPending(progress, 'cvc-words', 'word-song')).toBe(
      false,
    )
  })

  it('returns false when one of the last 3 entries dipped below threshold', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 0.5), // dip
        entry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0),
      ],
    })
    expect(isGraduationSessionPending(progress, 'cvc-words', 'word-song')).toBe(
      false,
    )
  })

  it('returns false when the most recent qualifying entry already carries novelPoolSuccessRate (post-graduation cooldown)', () => {
    // After a previous graduation attempt (passing or failing) the
    // tail entry has novelPoolSuccessRate set. Per the AC, the engine
    // "waits for the canonical 90/3 condition to reset" — meaning we
    // need fresh non-graduation sessions to push the tagged entry out
    // of the tail window before another graduation fires.
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        entry('2026-04-28T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        // failed graduation: canonical 100%, novel 50% (< 0.80)
        graduationEntry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0, 0.5),
      ],
    })
    expect(isGraduationSessionPending(progress, 'cvc-words', 'word-song')).toBe(
      false,
    )
  })

  it('returns true again after the cooldown — 3 fresh non-graduation sessions push the tagged entry out of the tail window', () => {
    // Same scenario as the cooldown test, plus 3 new non-graduation
    // sessions. The graduation-tagged entry is now older than the
    // tail-3 window; the engine reflags graduation.
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        graduationEntry('2026-04-28T10:00:00.000Z', 'cvc-words', 1.0, 0.5),
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0),
      ],
    })
    expect(isGraduationSessionPending(progress, 'cvc-words', 'word-song')).toBe(
      true,
    )
  })

  it('returns false when the most recent entry is a PASSING graduation (gate already cleared)', () => {
    // After a passing graduation the engine should promote on the
    // next applyMasteryRule call (verified separately below). Until
    // that promotion fires, the node is still at 'practicing' and
    // the graduation-pending detector must NOT re-flag — that would
    // double up the probe insertion on the very next session.
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0),
        graduationEntry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0, 1.0),
      ],
    })
    expect(isGraduationSessionPending(progress, 'cvc-words', 'word-song')).toBe(
      false,
    )
  })
})

describe('applyMasteryRule — graduation gate on cvc-words (ticket 86c9m3aec)', () => {
  it('does NOT promote cvc-words after 3 canonical sessions at 100% (graduation pending)', () => {
    // The standard 90/3 rule WOULD have fired here; the graduation
    // gate holds promotion until the next session lands a
    // novelPoolSuccessRate. This is the behaviour change vs. the
    // pre-86c9m3aec rule.
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['cvc-words']).toBe('practicing')
    // Downstream stays locked — no cascade.
    expect(result.skillLevels['digraphs-sh']).toBe('locked')
    // No queued pendingPromotion either — the gate is unmet, not a
    // parent-confirmation hold.
    expect(result.pendingPromotion).toBeUndefined()
  })

  it('promotes cvc-words after a graduation session with novel-pool ≥ 0.80', () => {
    // AC#4 round-trip part 2: "Simulate graduation session with
    // novel words at 100% → assert pickFocusNode advances past
    // cvc-words to next node". Asserted here on skillLevels; the
    // pickFocusNode walk is tested in focusNode.test.ts and is a
    // pure read of the resulting skillLevels.
    //
    // Ticket 86c9m3ae3 inserted `cvc-words-short-o` between `cvc-words`
    // and the first digraph sibling — the downstream that unlocks on
    // cvc-words promotion is now `cvc-words-short-o`. (PR #211 split
    // the dead `digraphs` literal into 3 sequential sibling nodes;
    // `digraphs-sh` is the new leading digraph, still far downstream.)
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0),
        graduationEntry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0, 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['cvc-words']).toBe('mastered')
    // Downstream `cvc-words-short-o` was 'locked' — should now be
    // 'intro'. `digraphs-sh` stays 'locked' until short-e promotes.
    expect(result.skillLevels['cvc-words-short-o']).toBe('intro')
    expect(result.skillLevels['digraphs-sh']).toBe('locked')
  })

  it('does NOT promote when the graduation session lands novel-pool below 0.80', () => {
    // AC#4 round-trip part 3: "Simulate graduation session with
    // novel words at 50% → assert promotion does NOT fire; focus
    // stays on cvc-words". 0.5 < 0.80 → gate fails, node stays at
    // 'practicing'.
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0),
        graduationEntry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0, 0.5),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['cvc-words']).toBe('practicing')
    expect(result.skillLevels['digraphs-sh']).toBe('locked')
  })

  it('promotes at exactly 0.80 novel-pool (boundary inclusive)', () => {
    // The threshold is `>=`, not `>`. A novel-pool rate sitting
    // exactly on the boundary clears the gate.
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0),
        graduationEntry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0, 0.8),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['cvc-words']).toBe('mastered')
  })

  it('does NOT promote when canonical dipped below threshold even with novel ≥ 0.80', () => {
    // The canonical 90/3 rule remains a NECESSARY condition. A
    // graduation session with great novel performance but a
    // canonical dip below 0.90 still fails the standard rule.
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 0.85), // canonical dip
        graduationEntry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0, 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['cvc-words']).toBe('practicing')
  })

  it('blending-cv (non-gated) still promotes under the standard rule alone', () => {
    // Defense-in-depth: the gate is cvc-words-only. A non-gated
    // word-song node continues to promote on the canonical 90/3
    // rule with no novelPoolSuccessRate involvement.
    const progress = buildProgress({
      skillLevels: levels({ 'blending-cv': 'practicing' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'blending-cv', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'blending-cv', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'blending-cv', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['blending-cv']).toBe('mastered')
  })
})

// --------------------------------------------------------------------------
// Cross-vowel mix predicate (ticket 86c9qa0kf)
// --------------------------------------------------------------------------

describe('CVC_CROSS_VOWEL_NODES', () => {
  it('lists the three v1 CVC vowel-tier nodes in declaration order', () => {
    // Declaration order matches LITERACY_TREE so future short-i / short-e
    // additions slot in cleanly. The set membership is what the predicate
    // reads — the array form is exposed for the parent-settings UI / debug
    // tooling that wants to enumerate the participating tiers.
    expect(CVC_CROSS_VOWEL_NODES).toEqual([
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
    ])
  })
})

describe('crossVowelMixingActive', () => {
  // Helper: build a Progress with the three CVC tiers at given levels +
  // an explicit parentSettings.crossVowelMixingEnabled toggle.
  function buildCrossVowelProgress(args: {
    cvcWords: 'mastered' | 'practicing' | 'intro' | 'locked'
    cvcShortO: 'mastered' | 'practicing' | 'intro' | 'locked'
    cvcShortU: 'mastered' | 'practicing' | 'intro' | 'locked'
    crossVowelMixingEnabled?: boolean
    omitParentSettings?: boolean
  }): Progress {
    const base = defaultProgress()
    const out: Progress = {
      ...base,
      skillLevels: levels({
        'cvc-words': args.cvcWords,
        'cvc-words-short-o': args.cvcShortO,
        'cvc-words-short-u': args.cvcShortU,
      }),
      parentSettings: {
        ...base.parentSettings!,
        crossVowelMixingEnabled: args.crossVowelMixingEnabled ?? true,
      },
    }
    if (args.omitParentSettings) {
      // Strip parentSettings — `getSettings()` should default it on
      // the inner read, including `crossVowelMixingEnabled: true`.
      delete out.parentSettings
    }
    return out
  }

  it('returns true when all three CVC tiers are mastered AND the toggle is on (default)', () => {
    const progress = buildCrossVowelProgress({
      cvcWords: 'mastered',
      cvcShortO: 'mastered',
      cvcShortU: 'mastered',
      crossVowelMixingEnabled: true,
    })
    expect(crossVowelMixingActive(progress)).toBe(true)
  })

  it('returns false when the parent toggle is off, even with all three mastered (escape-valve)', () => {
    // Per spec §10 Q1 lock + Dave's research §4.4 — toggle is the
    // hard off switch.
    const progress = buildCrossVowelProgress({
      cvcWords: 'mastered',
      cvcShortO: 'mastered',
      cvcShortU: 'mastered',
      crossVowelMixingEnabled: false,
    })
    expect(crossVowelMixingActive(progress)).toBe(false)
  })

  it('returns false when one tier is at "practicing" (per-aggregate gate)', () => {
    const progress = buildCrossVowelProgress({
      cvcWords: 'mastered',
      cvcShortO: 'mastered',
      cvcShortU: 'practicing',
      crossVowelMixingEnabled: true,
    })
    expect(crossVowelMixingActive(progress)).toBe(false)
  })

  it('returns false when one tier is at "intro" (per-aggregate gate)', () => {
    const progress = buildCrossVowelProgress({
      cvcWords: 'mastered',
      cvcShortO: 'intro',
      cvcShortU: 'mastered',
      crossVowelMixingEnabled: true,
    })
    expect(crossVowelMixingActive(progress)).toBe(false)
  })

  it('returns false when one tier is at "locked" (per-aggregate gate)', () => {
    const progress = buildCrossVowelProgress({
      cvcWords: 'practicing',
      cvcShortO: 'locked',
      cvcShortU: 'locked',
      crossVowelMixingEnabled: true,
    })
    expect(crossVowelMixingActive(progress)).toBe(false)
  })

  it('returns true when parentSettings is omitted entirely (defaulter fills crossVowelMixingEnabled = true)', () => {
    // Old blob without parentSettings → withDefaultedSettings fills the
    // defaults, including `crossVowelMixingEnabled: true`. The
    // predicate then sees toggle=true.
    const progress = buildCrossVowelProgress({
      cvcWords: 'mastered',
      cvcShortO: 'mastered',
      cvcShortU: 'mastered',
      omitParentSettings: true,
    })
    expect(crossVowelMixingActive(progress)).toBe(true)
  })

  it('reads an explicit ParentSettings argument when supplied (saves a getSettings call)', () => {
    // Optional 2nd arg lets callers (App.tsx kick-effect) avoid double-
    // resolving parentSettings when they already have it in scope.
    const progress = buildCrossVowelProgress({
      cvcWords: 'mastered',
      cvcShortO: 'mastered',
      cvcShortU: 'mastered',
      crossVowelMixingEnabled: true,
    })
    // Override via the explicit arg (toggle off) — the predicate
    // should respect the passed value, not re-read from progress.
    const explicitSettings: ParentSettings = {
      ...progress.parentSettings!,
      crossVowelMixingEnabled: false,
    }
    expect(crossVowelMixingActive(progress, explicitSettings)).toBe(false)
  })

  it('is O(1) — does not consult history', () => {
    // Construct a Progress with a populated history that would clear
    // the qualifies() filter on cvc-words. The predicate should not
    // care about it (mirrors `isGraduationSessionPending`'s
    // skillLevels-first short-circuit ordering).
    const progress: Progress = {
      ...defaultProgress(),
      skillLevels: levels({
        'cvc-words': 'mastered',
        'cvc-words-short-o': 'mastered',
        'cvc-words-short-u': 'mastered',
      }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 0.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 0.0),
        entry('2026-05-01T10:00:00.000Z', 'cvc-words', 0.0),
      ],
    }
    expect(crossVowelMixingActive(progress)).toBe(true)
  })
})

// --------------------------------------------------------------------------
// Regression — ticket 86c9qu91g (mastery-promotion bug)
//
// Thomas reported: after 4-5 perfect cvc-words sessions on iPhone Safari
// with ParentSettings set to 80% / 2 sessions + crossDayEnforcement=false,
// the PromotionCelebration overlay fired but the next session still picked
// cvc-words as focus and served the same short-a words.
//
// These tests pin each layer of the promotion + focus-selection pipeline
// under the lowered threshold so a regression is immediately visible.
//
// Settings profile used throughout:
//   masteryThreshold['word-song']: { percent: 0.8, sessions: 2 }
//   crossDayEnforcement: false
//   autoPromote: true (default)
// --------------------------------------------------------------------------

describe('applyMasteryRule — 86c9qu91g regression (80%/2, crossDay off, cvc-words)', () => {
  // Helper: build a Progress with the Thomas settings profile.
  // masteryThreshold must include both tracks to satisfy PerTrackMasteryThreshold;
  // keep math at the default 95/3 so only word-song is lowered.
  function thomasProgress(args: {
    history: SessionHistoryEntry[]
    pendingPromotion?: SkillNode
  }): Progress {
    return buildProgress({
      skillLevels: levels({ 'cvc-words': 'practicing' }),
      history: args.history,
      parentSettings: {
        masteryThreshold: {
          math: { percent: 0.95, sessions: 3 },
          'word-song': { percent: 0.8, sessions: 2 },
        },
        crossDayEnforcement: false,
      },
      ...(args.pendingPromotion !== undefined
        ? { pendingPromotion: args.pendingPromotion }
        : {}),
    })
  }

  it('graduation gate blocks promotion after 2 same-day canonical sessions at 100% (no novel entry yet)', () => {
    // Sessions 1+2 on the same day, both perfect. With crossDay off,
    // both count. The 80%/2 canonical window is full — but cvc-words
    // is graduation-gated, so promotion MUST NOT fire until the novel
    // probe result lands. Focus must stay on cvc-words.
    const progress = thomasProgress({
      history: [
        entry('2026-05-11T08:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T09:00:00.000Z', 'cvc-words', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['cvc-words']).toBe('practicing')
    expect(result.skillLevels['cvc-words-short-o']).toBe('locked')
    expect(result.pendingPromotion).toBeUndefined()
  })

  it('isGraduationSessionPending returns true after 2 same-day qualifying sessions with 80%/2 + crossDay off', () => {
    // The graduation detector must flag the next session for novel-word
    // probing so the planner can emit the graduation-run problem set.
    const progress = thomasProgress({
      history: [
        entry('2026-05-11T08:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T09:00:00.000Z', 'cvc-words', 1.0),
      ],
    })
    expect(isGraduationSessionPending(progress, 'cvc-words', 'word-song')).toBe(
      true,
    )
  })

  it('promotes cvc-words and sets pendingPromotion when the graduation session lands novel ≥ 0.80 (same day, crossDay off)', () => {
    // Graduation session on the same day as the two canonical sessions.
    // crossDayEnforcement=false → all three entries count. The tail
    // (graduation entry) carries novelPoolSuccessRate=0.9 ≥ 0.80.
    // Both qualifies() and graduationGateClears() pass → promote.
    const progress = thomasProgress({
      history: [
        entry('2026-05-11T08:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T09:00:00.000Z', 'cvc-words', 1.0),
        graduationEntry('2026-05-11T10:00:00.000Z', 'cvc-words', 1.0, 0.9),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['cvc-words']).toBe('mastered')
    expect(result.skillLevels['cvc-words-short-o']).toBe('intro')
    expect(result.pendingPromotion).toBe('cvc-words')
  })

  it('second applyMasteryRule call (next session-end) does NOT reset cvc-words back to practicing — stale-clear only clears pendingPromotion', () => {
    // Core regression case: if something (cloud sync, double-call,
    // state restore) triggers applyMasteryRule a second time after the
    // graduation promotion, cvc-words must stay at 'mastered'. The
    // stale-clear branch deletes pendingPromotion (cvc-words is no
    // longer 'practicing') but must NOT touch skillLevels.
    const progress = thomasProgress({
      history: [
        entry('2026-05-11T08:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T09:00:00.000Z', 'cvc-words', 1.0),
        graduationEntry('2026-05-11T10:00:00.000Z', 'cvc-words', 1.0, 0.9),
      ],
    })
    const afterFirstCall = applyMasteryRule(progress)
    expect(afterFirstCall.skillLevels['cvc-words']).toBe('mastered')
    expect(afterFirstCall.pendingPromotion).toBe('cvc-words')

    // Simulate next session-end calling applyMasteryRule on the saved doc.
    const afterSecondCall = applyMasteryRule(afterFirstCall)
    expect(afterSecondCall.skillLevels['cvc-words']).toBe('mastered')
    expect(afterSecondCall.skillLevels['cvc-words-short-o']).toBe('intro')
    // pendingPromotion cleared by stale-clear branch (node is now 'mastered').
    expect(afterSecondCall.pendingPromotion).toBeUndefined()
  })

  it('graduation gate blocks promotion even with 5 same-day sessions at 100% if none has novelPoolSuccessRate', () => {
    // Thomas reports 4-5 perfect sessions without the app emitting the
    // graduation probe. The gate must hold for all N additional canonical
    // sessions until a graduation entry lands.
    const progress = thomasProgress({
      history: [
        entry('2026-05-11T08:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T08:30:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T09:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T09:30:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T10:00:00.000Z', 'cvc-words', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['cvc-words']).toBe('practicing')
    expect(result.pendingPromotion).toBeUndefined()
  })

  it('80%/2 + crossDay off — threshold applies to the tail 2 entries; earlier dips do not prevent promotion', () => {
    // Only the LAST 2 (= threshold.sessions) entries need to clear the
    // percent threshold. A dip in an earlier session is outside the
    // window and should not block the graduation gate from triggering.
    // (Note: graduation gate also checks the last entry for novelPoolSuccessRate.)
    const progress = thomasProgress({
      history: [
        entry('2026-05-11T07:00:00.000Z', 'cvc-words', 0.5), // dip — outside tail
        entry('2026-05-11T08:00:00.000Z', 'cvc-words', 1.0),
        graduationEntry('2026-05-11T09:00:00.000Z', 'cvc-words', 1.0, 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['cvc-words']).toBe('mastered')
    expect(result.pendingPromotion).toBe('cvc-words')
  })
})

// --------------------------------------------------------------------------
// intro → practicing transition (ticket 86c9qu91g root-cause fix)
//
// Root cause confirmed by Thomas's iPhone state export:
//   skillLevels['cvc-words'] === 'intro' after 4 consecutive 100% sessions.
//
// `applyMasteryRule` previously only walked nodes at 'practicing'. Nodes
// stuck at 'intro' were invisible to the mastery engine regardless of
// session history. The fix adds a pass BEFORE the practicing → mastered
// scan: for every node at 'intro' that has at least one session with
// successRate > 0, promote it to 'practicing'. This lets the normal M3
// rule handle practicing → mastered on the SAME call.
//
// Four nodes start at 'intro' in defaultProgress():
//   cvc-words, sub-to-20, mult-2-5-10, sight-words
//
// All four are dead-end skills until this fix ships.
// --------------------------------------------------------------------------

describe('applyMasteryRule — intro → practicing transition (86c9qu91g)', () => {
  // ── Core case: Thomas's exact iPhone scenario ──────────────────────────
  //
  // Settings match what Thomas has configured: 80%/2, crossDayEnforcement=false.
  // Starting state: cvc-words === 'intro' (default).
  // History: 4 × 100% same-day sessions on cvc-words (crossDay off → all count).
  //
  // Expected full ladder traversal:
  //   intro → practicing (new intro→practicing pass)
  //   practicing → (graduation gate fires, but no novelPoolSuccessRate yet → stays)
  //
  // Note: cvc-words is graduation-gated. After intro→practicing, the 80%/2
  // canonical window is satisfied but the graduation gate needs a
  // novelPoolSuccessRate entry. So the expected outcome after 4 plain sessions
  // is: cvc-words === 'practicing' (not mastered yet — graduation needed).
  // isGraduationSessionPending must also return true.
  it('promotes cvc-words from intro to practicing when successRate > 0, then graduation gate holds', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'intro' }),
      history: [
        entry('2026-05-11T08:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T09:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T11:00:00.000Z', 'cvc-words', 1.0),
      ],
      parentSettings: {
        masteryThreshold: {
          math: { percent: 0.95, sessions: 3 },
          'word-song': { percent: 0.8, sessions: 2 },
        },
        crossDayEnforcement: false,
      },
    })
    const result = applyMasteryRule(progress)
    // intro → practicing fired; graduation gate blocks mastery (no novel entry).
    expect(result.skillLevels['cvc-words']).toBe('practicing')
    // Downstream stays locked — no mastery promotion yet.
    expect(result.skillLevels['cvc-words-short-o']).toBe('locked')
    // isGraduationSessionPending must be true (80%/2 canonical met, no novel yet).
    expect(isGraduationSessionPending(result, 'cvc-words', 'word-song')).toBe(
      true,
    )
  })

  // ── Thomas's full self-healing scenario (AC#6 verification) ────────────
  //
  // Thomas's iPhone has cvc-words stuck at 'intro' but has 5+ sessions
  // of 100% cvc-words history. After ONE applyMasteryRule call with a
  // graduation entry as the most recent, the node must reach 'mastered'
  // in a single pass:
  //   intro → practicing (new pass)
  //   practicing → mastered (graduation gate clears)
  //
  // This is the self-healing test from AC#6 — no manual data fix needed.
  it('full ladder traversal (intro → practicing → mastered) in one call when graduation entry is present', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'intro' }),
      history: [
        // 3 canonical sessions (crossDay off) + graduation entry — all at 100%.
        // The 80%/2 canonical window is satisfied by the tail 2 of these entries;
        // the graduation entry is the last one and carries novelPoolSuccessRate=1.0.
        entry('2026-05-11T07:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T08:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-11T09:00:00.000Z', 'cvc-words', 1.0),
        graduationEntry('2026-05-11T10:00:00.000Z', 'cvc-words', 1.0, 1.0),
      ],
      parentSettings: {
        masteryThreshold: {
          math: { percent: 0.95, sessions: 3 },
          'word-song': { percent: 0.8, sessions: 2 },
        },
        crossDayEnforcement: false,
      },
    })
    const result = applyMasteryRule(progress)
    // Full ladder: intro → practicing → mastered in a single call.
    expect(result.skillLevels['cvc-words']).toBe('mastered')
    // Downstream unlocked.
    expect(result.skillLevels['cvc-words-short-o']).toBe('intro')
    expect(result.pendingPromotion).toBe('cvc-words')
  })

  // ── AC#4: full ladder with default 90%/3 settings (non-Thomas shape) ──
  //
  // Tests that the intro → practicing → mastered ladder works under the
  // default word-song 90%/3 threshold too (not just Thomas's 80%/2).
  // Uses 4 sessions: 3 canonical qualifying + 1 graduation entry.
  it('full ladder under default 90%/3 word-song threshold with cross-day sessions', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'intro' }),
      history: [
        entry('2026-04-29T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-04-30T10:00:00.000Z', 'cvc-words', 1.0),
        entry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0),
        // Graduation entry — completes the 90%/3 canonical window and passes the novel gate.
        // With crossDayEnforcement=true (default), dedupe to one-per-day;
        // the tail 3 after dedupe are the three entries above + this one.
        // Slice(-3): entries [04-30, 05-01, graduation]; the last is the graduation entry.
        graduationEntry('2026-05-02T10:00:00.000Z', 'cvc-words', 1.0, 1.0),
      ],
      // No parentSettings override — uses defaultProgress()'s 90%/3 word-song default.
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['cvc-words']).toBe('mastered')
    expect(result.skillLevels['cvc-words-short-o']).toBe('intro')
    expect(result.pendingPromotion).toBe('cvc-words')
  })

  // ── intro → practicing on a non-graduation-gated node ─────────────────
  //
  // sub-to-20 starts at 'intro' in defaultProgress(). It is NOT
  // graduation-gated. A single session with successRate > 0 should
  // promote it to 'practicing'. Three sessions above the threshold
  // should then promote it to 'mastered' in the same call.
  it('promotes sub-to-20 from intro to practicing when successRate > 0', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'sub-to-20': 'intro' }),
      history: [
        entry('2026-05-01T10:00:00.000Z', 'sub-to-20', 0.625), // 5/8 — above zero
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['sub-to-20']).toBe('practicing')
  })

  it('intro node with zero successRate does NOT advance to practicing', () => {
    // A session where Marian got 0/8 does not count as "she can do something
    // with this skill." intro → practicing requires successRate > 0.
    const progress = buildProgress({
      skillLevels: levels({ 'sub-to-20': 'intro' }),
      history: [entry('2026-05-01T10:00:00.000Z', 'sub-to-20', 0.0)],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['sub-to-20']).toBe('intro')
  })

  it('intro node with no matching history stays at intro', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'sub-to-20': 'intro' }),
      history: [
        // History only has add-to-10 entries — sub-to-20 not touched.
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 1.0),
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['sub-to-20']).toBe('intro')
  })

  it('intro → practicing does NOT unlock the downstream node (locked → intro only on mastered)', () => {
    // When blending-cv (at 'locked') should NOT get promoted to 'intro'
    // just because cvc-words advances from intro → practicing.
    // The 'locked → intro' downstream unlock only fires on mastered, not on
    // practicing.
    const progress = buildProgress({
      skillLevels: levels({
        'cvc-words': 'intro',
        'cvc-words-short-o': 'locked',
      }),
      history: [entry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0)],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['cvc-words']).toBe('practicing')
    // Downstream stays locked — intro→practicing does not cascade.
    expect(result.skillLevels['cvc-words-short-o']).toBe('locked')
  })

  it('does not mutate input progress', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'cvc-words': 'intro' }),
      history: [entry('2026-05-01T10:00:00.000Z', 'cvc-words', 1.0)],
    })
    applyMasteryRule(progress)
    expect(progress.skillLevels['cvc-words']).toBe('intro')
  })

  // ── mult-2-5-10 (math intro node) ─────────────────────────────────────
  //
  // mult-2-5-10 starts at 'intro' in defaultProgress(). Verify the fix
  // works on the math track too.
  it('promotes mult-2-5-10 from intro to practicing with one any-success session', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'mult-2-5-10': 'intro' }),
      history: [
        entry('2026-05-01T10:00:00.000Z', 'mult-2-5-10', 0.125), // 1/8
      ],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['mult-2-5-10']).toBe('practicing')
  })

  // ── sight-words (word-song intro node) ────────────────────────────────
  it('promotes sight-words from intro to practicing with one any-success session', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'sight-words': 'intro' }),
      history: [entry('2026-05-01T10:00:00.000Z', 'sight-words', 0.5)],
    })
    const result = applyMasteryRule(progress)
    expect(result.skillLevels['sight-words']).toBe('practicing')
  })
})
