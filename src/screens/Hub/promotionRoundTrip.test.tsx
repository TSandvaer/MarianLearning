/**
 * Round-trip integration test for the unlock celebration wire
 * (tickets 86c9kwnkw, 86c9m3brc; rewired by Emma's Path 9/10, 123jpnbc3dt).
 *
 * Walks the full pipeline:
 *
 *   1. Seed a Progress document where Marian is at the threshold for
 *      promoting `add-to-10`.
 *   2. Call `recordProgressOnSessionEnd` (the production write path). It
 *      seeds the unlock seen-marker (`unlocksCelebrated`) from the
 *      pre-session doc and runs the M3 mastery rule.
 *   3. Re-read via `loadProgress()`: under autoPromote=true the unlock is
 *      pending (`pendingUnlock`); under autoPromote=false the rule only
 *      queues it and the map celebrates once the parent confirms.
 *   4. Mount the map: it plays the unlock beat once and saves the marker;
 *      a second mount, and the Hub, celebrate nothing.
 *
 * Why this test exists: one module WRITES the marker + levels, another
 * READS them (`feedback_self_test_report.md`, "Cross-module write
 * integration tests"). The Hub `PromotionCelebration` overlay this test
 * used to pin was retired — the unlock moment moved to the map (spec §6).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import Hub from './Hub'
import { MapScreen } from '../Map/MapScreen'
import type { MapLinePlayer } from '../Map/playMapLine'
import { recordProgressOnSessionEnd } from '@marian/core/sessionEnd/progressHistory'
import {
  clearProgress,
  defaultProgress,
  getSettings,
  loadProgress,
  saveProgress,
  type Progress,
} from '@marian/core/progress'
import { pendingUnlock } from '@marian/core/progress/pathBeats'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  clearProgress()
})

function seedAtPromotionCusp(autoPromote: boolean): void {
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
    parentSettings: { ...getSettings(base), autoPromote },
  }
  saveProgress(seeded)
}

function recordThirdGoodDay(): Progress {
  return recordProgressOnSessionEnd({
    surface: 'math',
    totalCorrect: 8, // 100% on the third qualifying session
    dateISO: new Date(2026, 4, 3, 18, 0).toISOString(),
    focusNode: 'add-to-10',
  })
}

function fakePlayer(): MapLinePlayer & { play: ReturnType<typeof vi.fn> } {
  return {
    play: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(),
    unload: vi.fn(),
  }
}

function renderMap(player: MapLinePlayer) {
  return render(
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="always">
        <MapScreen
          world="math"
          onBack={() => {}}
          createPlayer={() => player}
          createSfxFn={() => ({ play: () => {}, unload: () => {} }) as never}
        />
      </MotionConfig>
    </LazyMotion>,
  )
}

describe('unlock round-trip (session-end writer → map reader)', () => {
  it('autoPromote=true: the map celebrates the unlock once, then never again (map or Hub)', async () => {
    seedAtPromotionCusp(true)
    const promoted = recordThirdGoodDay()
    expect(promoted.skillLevels['add-to-10']).toBe('mastered')
    expect(promoted.skillLevels['add-to-20']).toBe('intro')
    // Marker seeded from the PRE-session doc: add-to-20 was locked then,
    // so it is the pending unlock.
    expect(promoted.unlocksCelebrated).not.toContain('add-to-20')
    expect(promoted.unlocksCelebrated).toContain('add-to-10')
    expect(pendingUnlock(loadProgress()!, 'math')).toEqual({
      world: 'math',
      mastered: 'add-to-10',
      unlocked: 'add-to-20',
      land: null,
    })

    vi.useFakeTimers()
    const player = fakePlayer()
    const first = renderMap(player)
    expect(screen.getByTestId('map')).toHaveAttribute('data-beat', 'unlock')
    // Seen-marker saved on mount, before the line plays.
    expect(loadProgress()?.unlocksCelebrated).toContain('add-to-20')
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByTestId('map-ribbon')).toHaveAttribute(
      'data-line-id',
      'end.unlock.add-to-20',
    )
    expect(screen.getByTestId('map-ribbon').textContent).toBe(
      'You learned adding to ten! Now you can do adding to twenty!',
    )
    expect(player.play.mock.calls.map((c) => c[0].id)).toEqual([
      'end.unlock.add-to-20',
    ])
    first.unmount()

    // Second visit: the plain open line, no beat.
    const again = fakePlayer()
    renderMap(again)
    expect(screen.getByTestId('map')).toHaveAttribute('data-beat', 'none')
    expect(again.play.mock.calls.map((c) => c[0].id)).toEqual([
      'path.open.add-to-20',
    ])
    expect(pendingUnlock(loadProgress()!, 'math')).toBeNull()
  })

  it('autoPromote=false: nothing pending until the parent confirms, then the map celebrates it', () => {
    seedAtPromotionCusp(false)
    const promoted = recordThirdGoodDay()
    expect(promoted.pendingPromotion).toBe('add-to-10')
    expect(promoted.skillLevels['add-to-10']).toBe('practicing')
    expect(pendingUnlock(loadProgress()!, 'math')).toBeNull()

    // Parent confirms in Settings (same write ParentSettings makes).
    const p = loadProgress()!
    saveProgress({
      ...p,
      skillLevels: {
        ...p.skillLevels,
        'add-to-10': 'mastered',
        'add-to-20': 'intro',
      },
      pendingPromotion: undefined,
    })
    expect(pendingUnlock(loadProgress()!, 'math')?.unlocked).toBe('add-to-20')
  })

  it('no unlock when the threshold is not met', () => {
    const base = defaultProgress()
    saveProgress({
      ...base,
      history: [
        {
          dateISO: new Date(2026, 4, 1, 18, 0).toISOString(),
          skillFocus: ['add-to-10'],
          successRate: 1.0,
        },
      ],
    })
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: new Date(2026, 4, 2, 18, 0).toISOString(),
      focusNode: 'add-to-10',
    })
    expect(pendingUnlock(loadProgress()!, 'math')).toBeNull()
  })

  it('the Hub never mounts an unlock overlay, even right after a promotion', () => {
    seedAtPromotionCusp(true)
    recordThirdGoodDay()
    render(
      <LazyMotion features={domAnimation}>
        <MotionConfig reducedMotion="always">
          <Hub progressDoc={loadProgress()} />
        </MotionConfig>
      </LazyMotion>,
    )
    expect(screen.queryByTestId('hub-promotion-celebration')).toBeNull()
    expect(screen.getAllByTestId('hub-emma')).toHaveLength(1)
  })

  it('autoPromote=true: pendingPromotion clears on the next session-end (no persistent artifact)', () => {
    // Lifecycle assertion — the transient flag must NOT persist past
    // the next session-end. Without this, a default user would see the
    // celebration replay every Hub mount until they completed another
    // session, which is the opposite of the intended one-shot UX.
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
        autoPromote: true,
      },
    }
    saveProgress(seeded)

    // Session-end 1: triggers the promotion + sets the cue.
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: new Date(2026, 4, 3, 18, 0).toISOString(),
      focusNode: 'add-to-10',
    })
    expect(loadProgress()?.pendingPromotion).toBe('add-to-10')

    // Session-end 2: a regular subsequent session on the new focus node.
    // The mastery rule re-runs, sees the queued node is 'mastered', and
    // the stale-clear branch deletes pendingPromotion.
    // add-to-20 is now at 'intro' (unlocked by the session-end 1 promotion)
    // and session-end 2 records a 100% session on it — the intro→practicing
    // pass (ticket 86c9qu91g) fires, so add-to-20 advances to 'practicing'.
    // Core assertion: pendingPromotion is gone (the stale-clear lifecycle).
    recordProgressOnSessionEnd({
      surface: 'math',
      totalCorrect: 8,
      dateISO: new Date(2026, 4, 4, 18, 0).toISOString(),
      focusNode: 'add-to-20',
    })
    const afterSecond = loadProgress()
    expect(afterSecond?.pendingPromotion).toBeUndefined()
    expect(afterSecond?.skillLevels['add-to-10']).toBe('mastered')
    // add-to-20 advances intro → practicing because session-end 2 recorded
    // a 100% session on it (intro→practicing fires on any successRate > 0).
    expect(afterSecond?.skillLevels['add-to-20']).toBe('practicing')
  })
})
