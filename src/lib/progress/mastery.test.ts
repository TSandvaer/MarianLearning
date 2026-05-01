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
 */

import { describe, expect, it } from 'vitest'
import { LITERACY_TREE, MATH_TREE, applyMasteryRule, nextNode } from './mastery'
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

/** Build a `Progress` with the supplied skillLevels, history, and settings. */
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
    expect(result.pendingPromotion).toBeUndefined()
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

  it('is idempotent — running twice equals running once', () => {
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
    expect(twice).toEqual(once)
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
})

// --------------------------------------------------------------------------
// Threshold override — proves settings propagate
// --------------------------------------------------------------------------

describe('applyMasteryRule — threshold override 80/2', () => {
  it('promotes with 2 cross-day entries at 0.81', () => {
    const progress = buildProgress({
      skillLevels: levels({ 'add-to-10': 'practicing' }),
      history: [
        entry('2026-04-30T10:00:00.000Z', 'add-to-10', 0.81),
        entry('2026-05-01T10:00:00.000Z', 'add-to-10', 0.81),
      ],
      parentSettings: {
        masteryThreshold: { percent: 0.8, sessions: 2 },
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
        masteryThreshold: { percent: 0.8, sessions: 2 },
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
