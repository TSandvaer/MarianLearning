/**
 * Round-trip integration test for the promotion-celebration wire
 * (ticket 86c9kwnkw).
 *
 * Walks the full pipeline:
 *
 *   1. Seed a Progress document where Marian is at the threshold for
 *      promoting `add-to-10`.
 *   2. Call `recordProgressOnSessionEnd` (the production write path).
 *      Because `parentSettings.autoPromote === false`, the M3 mastery
 *      rule queues the promotion via `progress.pendingPromotion` rather
 *      than mutating `skillLevels`.
 *   3. Assert `loadProgress().pendingPromotion === 'add-to-10'`.
 *   4. Mount Hub with the loaded progress as the source of truth.
 *   5. Assert the PromotionCelebration overlay renders for the promoted
 *      node.
 *
 * Why this test exists
 * --------------------
 * Per `feedback_self_test_report.md`'s "Cross-module write integration
 * tests" section, when one module writes a field and another reads it,
 * the wire-shape contract needs a test that exercises the full path —
 * unit tests on either side leave room for silent drift (the same class
 * of bug the 2026-05-02 debugSeed mismatch fell into). The mastery
 * engine WRITES `progress.pendingPromotion`; Hub READS it. This test
 * pins the contract end-to-end.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import Hub from './Hub'
import { recordProgressOnSessionEnd } from '../SessionEnd/progressHistory'
import {
  clearProgress,
  defaultProgress,
  getSettings,
  loadProgress,
  saveProgress,
  type Progress,
} from '../../lib/progress'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  clearProgress()
})

/**
 * Seed Progress with `add-to-10` at the cusp of promotion: two qualifying
 * sessions on prior days; one more 100% session today (the test session
 * we're about to record) hits the 95/3 threshold.
 *
 * Using a fixed `now` so the cross-day filter sees three distinct local
 * days.
 */
function seedAtPromotionCusp(): void {
  const base = defaultProgress()
  const seeded: Progress = {
    ...base,
    skillLevels: {
      ...base.skillLevels,
      'number-recog': 'mastered',
      'add-to-10': 'practicing',
      'add-to-20': 'locked',
    },
    history: [
      // Two prior 100% sessions on different calendar days.
      {
        dateISO: new Date(2026, 4, 1, 18, 0).toISOString(),
        skillFocus: ['add-to-10'],
        successRate: 1.0,
      },
      {
        dateISO: new Date(2026, 4, 2, 18, 0).toISOString(),
        skillFocus: ['add-to-10'],
        successRate: 1.0,
      },
    ],
    parentSettings: {
      ...getSettings(base),
      // Auto-promote OFF so the engine queues `pendingPromotion` rather
      // than silently mutating skillLevels.
      autoPromote: false,
      // Use the math default threshold (95/3) — already in
      // defaultProgress, but explicit here for clarity.
    },
  }
  saveProgress(seeded)
}

function renderHubFromStorage() {
  const progress = loadProgress()
  // Project the indices the same way App.tsx does in production.
  // Importing the projection helper keeps the contract aligned.
  return render(
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="always">
        <Hub
          progress={{
            numberGardenIndex: 1, // number-recog mastered → index 1
            wordSongIndex: 0,
          }}
          pendingPromotion={progress?.pendingPromotion}
        />
      </MotionConfig>
    </LazyMotion>,
  )
}

describe('promotion round-trip (writer → reader)', () => {
  it('session-end write → loadProgress sees pendingPromotion → Hub renders celebration', () => {
    seedAtPromotionCusp()

    // ── 1. Production write path (SessionEnd would call this on mount).
    const sessionDate = new Date(2026, 4, 3, 18, 0)
    const promoted = recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8, // 100% on the third qualifying session
      dateISO: sessionDate.toISOString(),
      focusNode: 'add-to-10',
    })

    // Sanity: the rule queued the promotion (autoPromote=false branch).
    expect(promoted.pendingPromotion).toBe('add-to-10')
    // skillLevels unchanged — autoPromote=false means parent confirms.
    expect(promoted.skillLevels['add-to-10']).toBe('practicing')

    // ── 2. Re-read via the canonical reader.
    const reloaded = loadProgress()
    expect(reloaded).not.toBeNull()
    expect(reloaded?.pendingPromotion).toBe('add-to-10')

    // ── 3. Mount Hub and verify the celebration component renders for
    // the promoted node, with the human-readable label.
    renderHubFromStorage()

    const overlay = screen.getByTestId('hub-promotion-celebration')
    expect(overlay).toBeInTheDocument()
    expect(overlay.getAttribute('data-node')).toBe('add-to-10')
    expect(screen.getByTestId('hub-promotion-node-label').textContent).toBe(
      'add to 10',
    )
    // The picker remains functional beneath the overlay.
    expect(screen.getAllByTestId('hub-tree-node')).toHaveLength(2)
  })

  it('no celebration when the promotion threshold is not met', () => {
    // Only ONE prior session; threshold needs 3.
    const base = defaultProgress()
    const seeded: Progress = {
      ...base,
      history: [
        {
          dateISO: new Date(2026, 4, 1, 18, 0).toISOString(),
          skillFocus: ['add-to-10'],
          successRate: 1.0,
        },
      ],
      parentSettings: {
        ...getSettings(base),
        autoPromote: false,
      },
    }
    saveProgress(seeded)

    const promoted = recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: new Date(2026, 4, 2, 18, 0).toISOString(),
      focusNode: 'add-to-10',
    })

    expect(promoted.pendingPromotion).toBeUndefined()

    const reloaded = loadProgress()
    expect(reloaded?.pendingPromotion).toBeUndefined()

    render(
      <LazyMotion features={domAnimation}>
        <MotionConfig reducedMotion="always">
          <Hub pendingPromotion={reloaded?.pendingPromotion} />
        </MotionConfig>
      </LazyMotion>,
    )
    expect(screen.queryByTestId('hub-promotion-celebration')).toBeNull()
  })
})
