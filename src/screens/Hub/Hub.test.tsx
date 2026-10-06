/**
 * Hub component tests.
 *
 * Source-of-truth for behaviour: `design/screen-hub.md` (acceptance
 * criteria starting at the §"Acceptance criteria (Jessica)" header).
 *
 * Tests render Hub through `render` with the global motion-reduce shim
 * configured in `src/test/setup.ts`. Audio is replaced via `playLineFn`
 * so we don't need real Howler.
 */

import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import Hub from './Hub'
import type { HubProps } from './Hub'
import {
  MATH_TREE,
  defaultProgress,
  saveProgress,
  type Progress,
  type SkillNode,
} from '../../lib/progress'
import {
  SESSION_HISTORY_KEY,
  emptySessionHistory,
  type SessionHistoryV2,
} from '../SessionEnd/sessionHistory'
import {
  HUB_LAST_UNMOUNT_KEY,
  RAPID_REMOUNT_THRESHOLD_MS,
} from './useRapidRemountSuppression'
import {
  FLOWER_WAKE_STORAGE_KEY,
  GUIDANCE_LINES,
  type GuidanceLineId,
} from './hubGuidance'
import type { StorageAdapter } from '../Math/stardust'

function createMemoryStorage(): StorageAdapter & {
  store: Map<string, string>
} {
  const store = new Map<string, string>()
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
  }
}

function seed(
  adapter: StorageAdapter,
  patch: Partial<SessionHistoryV2> = {},
): SessionHistoryV2 {
  const value: SessionHistoryV2 = { ...emptySessionHistory(), ...patch }
  adapter.setItem(SESSION_HISTORY_KEY, JSON.stringify(value))
  return value
}

/** Nothing mastered: first step of each tree at intro, rest locked. */
function freshDoc(): Progress {
  const p = defaultProgress()
  for (const k of Object.keys(p.skillLevels) as (keyof typeof p.skillLevels)[])
    p.skillLevels[k] = 'locked'
  p.skillLevels['number-recog'] = 'intro'
  p.skillLevels['letter-names'] = 'intro'
  return p
}

/** A good (100%) session on `node`, `daysAgo` days before `now`, at noon. */
function goodDay(now: Date, daysAgo: number, node: SkillNode) {
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysAgo,
    12,
  )
  return { dateISO: d.toISOString(), skillFocus: [node], successRate: 1 }
}

function renderHub(props: Partial<HubProps> = {}) {
  return render(
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="always">
        <Hub {...props} />
      </MotionConfig>
    </LazyMotion>,
  )
}

beforeEach(() => {
  window.sessionStorage.clear()
  window.localStorage.clear()
  // Hub now emits a `[Hub] welcome-back: …` console.log on every dispatch
  // (and one on suppression) — added in ticket 86c9kxv47 to make the
  // iPad-export diagnostics readable. We silence it in tests so the suite
  // output stays clean. Tests that care about the log content can spy on
  // their own.
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Hub — render states', () => {
  it('renders the hub root with both skill-tree nodes', () => {
    renderHub({ storage: createMemoryStorage() })
    expect(screen.getByTestId('hub')).toBeInTheDocument()
    const nodes = screen.getAllByTestId('hub-tree-node')
    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toHaveAttribute('data-tree', 'number-garden')
    expect(nodes[1]).toHaveAttribute('data-tree', 'word-song')
  })

  it('renders Emma idle pose with layoutId="emma"', () => {
    renderHub({ storage: createMemoryStorage() })
    const emma = screen.getByTestId('hub-emma')
    expect(emma.getAttribute('src')).toBe('/assets/emma-idle.svg')
    expect(emma.getAttribute('alt')).toBe('Emma')
  })

  it('does NOT use any "Melody" copy on the screen', () => {
    renderHub({ storage: createMemoryStorage() })
    const root = screen.getByTestId('hub')
    expect(root.textContent ?? '').not.toMatch(/melody/i)
  })

  it('shows no stardust total and no day-streak sun (bar 14); the data stays', () => {
    const adapter = createMemoryStorage()
    const stored = seed(adapter, {
      cumulativeStardust: 47,
      sessionCount: 4,
      lastSessionCompletedAt: new Date(2026, 3, 29, 8, 0).toISOString(),
      dayStreak: 3,
    })
    renderHub({ storage: adapter, now: () => new Date(2026, 3, 29, 18, 0) })
    expect(screen.queryByTestId('hub-hud')).toBeNull()
    expect(screen.queryByTestId('hub-cumulative-stardust')).toBeNull()
    expect(screen.queryByTestId('hub-day-streak')).toBeNull()
    expect(screen.getByTestId('hub').textContent ?? '').not.toMatch(/47/)
    const after = JSON.parse(
      adapter.store.get(SESSION_HISTORY_KEY)!,
    ) as SessionHistoryV2
    expect(after.cumulativeStardust).toBe(stored.cumulativeStardust)
    expect(after.dayStreak).toBe(stored.dayStreak)
  })

  it('renders an invisible 96×96pt parent-gate corner with no glyph', () => {
    renderHub({ storage: createMemoryStorage() })
    const gate = screen.getByTestId('hub-parent-gate')
    expect(gate).toBeInTheDocument()
    expect(gate.getAttribute('aria-hidden')).toBe('true')
    expect(gate.getAttribute('style')).toMatch(/96pt/)
    // No visible content
    expect(gate.textContent ?? '').toBe('')
  })
})

describe('Hub — soft suggestion algorithm', () => {
  const apr29 = new Date(2026, 3, 29, 12, 0)

  it('renders the soft ring on the suggested node only', () => {
    const adapter = createMemoryStorage()
    seed(adapter, { lastSuggestion: 'number-garden' }) // → algorithm picks word-song
    renderHub({ storage: adapter, now: () => apr29 })
    const nodes = screen.getAllByTestId('hub-tree-node')
    const numberNode = nodes.find(
      (n) => n.getAttribute('data-tree') === 'number-garden',
    )!
    const wordNode = nodes.find(
      (n) => n.getAttribute('data-tree') === 'word-song',
    )!
    expect(wordNode.getAttribute('data-suggested')).toBe('true')
    expect(numberNode.getAttribute('data-suggested')).toBe('false')
  })

  it("no ring when both worlds have today's flower (suggestion === null)", () => {
    const adapter = createMemoryStorage()
    seed(adapter)
    const doc = freshDoc()
    doc.history = [
      goodDay(apr29, 0, 'number-recog'),
      goodDay(apr29, 0, 'letter-names'),
    ]
    renderHub({ storage: adapter, now: () => apr29, progressDoc: doc })
    const nodes = screen.getAllByTestId('hub-tree-node')
    for (const node of nodes) {
      expect(node.getAttribute('data-suggested')).toBe('false')
    }
    expect(screen.getByTestId('hub').getAttribute('data-suggestion')).toBe(
      'none',
    )
  })

  it('persists suggestion outcome on tap (matched suggestion → consecutiveOverrides reset)', async () => {
    const user = userEvent.setup()
    const adapter = createMemoryStorage()
    const onPickTree = vi.fn()
    seed(adapter, {
      sessionCount: 3,
      consecutiveOverrides: 2,
      lastSuggestion: 'number-garden',
    })
    renderHub({
      storage: adapter,
      now: () => apr29,
      onPickTree,
    })
    // Algorithm picks 'word-song' on this mount (alternates from
    // lastSuggestion 'number-garden').
    expect(screen.getByTestId('hub').getAttribute('data-suggestion')).toBe(
      'word-song',
    )
    const wordNode = screen
      .getAllByTestId('hub-tree-node')
      .find((n) => n.getAttribute('data-tree') === 'word-song')!
    await user.click(wordNode)
    expect(onPickTree).toHaveBeenCalledWith('word-song')

    const persisted = JSON.parse(
      adapter.store.get(SESSION_HISTORY_KEY)!,
    ) as SessionHistoryV2
    expect(persisted.consecutiveOverrides).toBe(0)
    expect(persisted.lastSuggestion).toBe('word-song')
    expect(persisted.suggestionCooldownUntil).toBeNull()
  })

  it('an override tap only records the suggestion she was shown (no cool-down)', async () => {
    const user = userEvent.setup()
    const adapter = createMemoryStorage()
    seed(adapter, {
      sessionCount: 3,
      consecutiveOverrides: 2,
      lastSuggestion: 'number-garden', // → tie alternates to word-song
    })
    renderHub({
      storage: adapter,
      now: () => apr29,
      onPickTree: vi.fn(),
    })
    const numberNode = screen
      .getAllByTestId('hub-tree-node')
      .find((n) => n.getAttribute('data-tree') === 'number-garden')!
    await user.click(numberNode)

    const persisted = JSON.parse(
      adapter.store.get(SESSION_HISTORY_KEY)!,
    ) as SessionHistoryV2
    expect(persisted.lastSuggestion).toBe('word-song')
    expect(persisted.consecutiveOverrides).toBe(0)
    expect(persisted.suggestionCooldownUntil).toBeNull()
  })
})

describe('Hub — rapid-remount suppression', () => {
  it('suppresses the welcome line when within the 30s threshold', () => {
    const adapter = createMemoryStorage()
    seed(adapter)
    // Fake recent unmount
    window.sessionStorage.setItem(
      HUB_LAST_UNMOUNT_KEY,
      String(Date.now() - (RAPID_REMOUNT_THRESHOLD_MS - 1000)),
    )
    renderHub({ storage: adapter })
    expect(screen.getByTestId('hub').getAttribute('data-suppressed')).toBe(
      'true',
    )
    // No ribbon shown — caption never started
    expect(screen.queryByTestId('hub-ribbon')).toBeNull()
  })

  it('does NOT suppress on a fresh mount (no prior unmount)', async () => {
    const adapter = createMemoryStorage()
    seed(adapter)
    renderHub({ storage: adapter, path: 'session-end' })
    expect(screen.getByTestId('hub').getAttribute('data-suppressed')).toBe(
      'false',
    )
  })
})

describe('Hub — parent-gate long-press (invisible v1)', () => {
  it('fires onParentGate after 2 seconds of sustained press', () => {
    vi.useFakeTimers()
    try {
      const onParentGate = vi.fn()
      renderHub({ storage: createMemoryStorage(), onParentGate })
      const gate = screen.getByTestId('hub-parent-gate')

      // Simulate pointerdown
      act(() => {
        gate.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
        )
      })

      // Just under 2 s → no fire
      act(() => {
        vi.advanceTimersByTime(1999)
      })
      expect(onParentGate).not.toHaveBeenCalled()

      // Past 2 s → fires
      act(() => {
        vi.advanceTimersByTime(2)
      })
      expect(onParentGate).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does NOT fire on a short tap', () => {
    vi.useFakeTimers()
    try {
      const onParentGate = vi.fn()
      renderHub({ storage: createMemoryStorage(), onParentGate })
      const gate = screen.getByTestId('hub-parent-gate')

      act(() => {
        gate.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
        )
      })
      act(() => {
        vi.advanceTimersByTime(200)
      })
      act(() => {
        gate.dispatchEvent(
          new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }),
        )
      })
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(onParentGate).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels on pointer cancel mid-press', () => {
    vi.useFakeTimers()
    try {
      const onParentGate = vi.fn()
      renderHub({ storage: createMemoryStorage(), onParentGate })
      const gate = screen.getByTestId('hub-parent-gate')

      act(() => {
        gate.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
        )
      })
      act(() => {
        vi.advanceTimersByTime(500)
      })
      // Pointer cancelled (system gesture, screen lock, etc.)
      act(() => {
        gate.dispatchEvent(
          new PointerEvent('pointercancel', {
            bubbles: true,
            pointerId: 1,
          }),
        )
      })
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(onParentGate).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Hub — character-art 3s long-press (M2.5)', () => {
  it('fires onCharacterLongPress after 3s of sustained press on Emma', () => {
    vi.useFakeTimers()
    try {
      const onCharacterLongPress = vi.fn()
      renderHub({
        storage: createMemoryStorage(),
        onCharacterLongPress,
      })
      const emma = screen.getByTestId('hub-emma')

      act(() => {
        emma.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
        )
      })

      // Just under 3 s → no fire
      act(() => {
        vi.advanceTimersByTime(2999)
      })
      expect(onCharacterLongPress).not.toHaveBeenCalled()

      // Past 3 s → fires exactly once
      act(() => {
        vi.advanceTimersByTime(2)
      })
      expect(onCharacterLongPress).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does NOT fire on a 1500ms tap-and-release', () => {
    vi.useFakeTimers()
    try {
      const onCharacterLongPress = vi.fn()
      renderHub({
        storage: createMemoryStorage(),
        onCharacterLongPress,
      })
      const emma = screen.getByTestId('hub-emma')

      act(() => {
        emma.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
        )
      })
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      act(() => {
        emma.dispatchEvent(
          new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }),
        )
      })
      // Even past the 3s threshold post-release, no fire.
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(onCharacterLongPress).toHaveBeenCalledTimes(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does NOT fire on a 3s long-press of a non-character element (Math button)', () => {
    vi.useFakeTimers()
    try {
      const onCharacterLongPress = vi.fn()
      renderHub({
        storage: createMemoryStorage(),
        onCharacterLongPress,
      })
      const numberNode = screen
        .getAllByTestId('hub-tree-node')
        .find((n) => n.getAttribute('data-tree') === 'number-garden')!

      act(() => {
        numberNode.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
        )
      })
      act(() => {
        vi.advanceTimersByTime(3500)
      })
      expect(onCharacterLongPress).toHaveBeenCalledTimes(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels on pointercancel mid-press', () => {
    vi.useFakeTimers()
    try {
      const onCharacterLongPress = vi.fn()
      renderHub({
        storage: createMemoryStorage(),
        onCharacterLongPress,
      })
      const emma = screen.getByTestId('hub-emma')

      act(() => {
        emma.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
        )
      })
      act(() => {
        vi.advanceTimersByTime(500)
      })
      act(() => {
        emma.dispatchEvent(
          new PointerEvent('pointercancel', {
            bubbles: true,
            pointerId: 1,
          }),
        )
      })
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(onCharacterLongPress).toHaveBeenCalledTimes(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Hub — node tap routing', () => {
  it('calls onPickTree("number-garden") when the Number Garden node is tapped', async () => {
    const user = userEvent.setup()
    const onPickTree = vi.fn()
    renderHub({ storage: createMemoryStorage(), onPickTree })
    const numberNode = screen
      .getAllByTestId('hub-tree-node')
      .find((n) => n.getAttribute('data-tree') === 'number-garden')!
    await user.click(numberNode)
    expect(onPickTree).toHaveBeenCalledTimes(1)
    expect(onPickTree).toHaveBeenCalledWith('number-garden')
  })

  it('calls onPickTree("word-song") when the Word Song node is tapped', async () => {
    const user = userEvent.setup()
    const onPickTree = vi.fn()
    renderHub({ storage: createMemoryStorage(), onPickTree })
    const wordNode = screen
      .getAllByTestId('hub-tree-node')
      .find((n) => n.getAttribute('data-tree') === 'word-song')!
    await user.click(wordNode)
    expect(onPickTree).toHaveBeenCalledWith('word-song')
  })
})

describe('Hub — audio-handoff cancellation (ticket 86c9m4afh)', () => {
  /**
   * Regression tests for the iPad audio-leak bug surfaced 2026-05-03.
   *
   * Before this fix, tapping a skill-tree chip while the Hub welcome-back
   * line was still playing only set `cancelledRef.current = true`, which
   * short-circuits subsequent caption-tick state updates. The underlying
   * Howl was never told to stop, so its audio kept playing past the
   * route-flip and bled into Math/WordSong's read-aloud.
   *
   * The fix wires `cancelLineFn` (default: module-level
   * `cancelActiveHubLine`) into `handleNodeTap` so the in-flight Hub
   * utterance is stopped synchronously on chip tap.
   */
  it('invokes cancelLineFn exactly once when a tree node is tapped', async () => {
    const user = userEvent.setup()
    const cancelLineFn = vi.fn()
    const playLineFn = vi.fn(() => new Promise<void>(() => {})) // never resolves
    renderHub({
      storage: createMemoryStorage(),
      path: 'session-end', // gate already unlocked → greeting fires on mount
      playLineFn,
      cancelLineFn,
    })
    const wordNode = screen
      .getAllByTestId('hub-tree-node')
      .find((n) => n.getAttribute('data-tree') === 'word-song')!
    await user.click(wordNode)
    expect(cancelLineFn).toHaveBeenCalledTimes(1)
  })

  it('invokes cancelLineFn on either chip tap (number-garden too)', async () => {
    const user = userEvent.setup()
    const cancelLineFn = vi.fn()
    const playLineFn = vi.fn(() => new Promise<void>(() => {}))
    renderHub({
      storage: createMemoryStorage(),
      path: 'session-end',
      playLineFn,
      cancelLineFn,
    })
    const numberNode = screen
      .getAllByTestId('hub-tree-node')
      .find((n) => n.getAttribute('data-tree') === 'number-garden')!
    await user.click(numberNode)
    expect(cancelLineFn).toHaveBeenCalledTimes(1)
  })

  it('invokes cancelLineFn on chip tap even when the greeting is suppressed (rapid-remount path)', async () => {
    // Rapid-remount path: no welcome-back line dispatches, but
    // `cancelLine()` is still called on tap. This is intentional — the
    // call is idempotent, and treating "did we play a line?" as the gate
    // is more error-prone than just always calling cancel. The
    // underlying player's `cancelActive()` is itself a no-op when
    // nothing is playing (covered in playHubLine.test.ts).
    const user = userEvent.setup()
    const adapter = createMemoryStorage()
    window.sessionStorage.setItem(
      HUB_LAST_UNMOUNT_KEY,
      String(Date.now() - (RAPID_REMOUNT_THRESHOLD_MS - 1000)),
    )
    const cancelLineFn = vi.fn()
    renderHub({ storage: adapter, cancelLineFn })
    const wordNode = screen
      .getAllByTestId('hub-tree-node')
      .find((n) => n.getAttribute('data-tree') === 'word-song')!
    await user.click(wordNode)
    expect(cancelLineFn).toHaveBeenCalledTimes(1)
  })

  it('does NOT invoke cancelLineFn on cold mount (no chip tap)', () => {
    // Direct deep-launch / cold mount path. The screen never tapped a
    // chip → cancel must not fire. This is the regression test that
    // proves we don't accidentally cancel on mount or on every render.
    const cancelLineFn = vi.fn()
    renderHub({
      storage: createMemoryStorage(),
      path: 'app-open',
      cancelLineFn,
    })
    expect(cancelLineFn).toHaveBeenCalledTimes(0)
  })
})

describe('Hub — recorded lines wait for the first tap on app-open (Guidance G3)', () => {
  it('app-open: Emma does not speak on mount; the first tap starts her line', async () => {
    const playLineFn = vi.fn(() => Promise.resolve())
    renderHub({
      storage: createMemoryStorage(),
      path: 'app-open',
      playLineFn,
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(playLineFn).toHaveBeenCalledTimes(0)
    act(() => {
      screen
        .getByTestId('hub')
        .dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
        )
    })
    await waitFor(() => expect(playLineFn).toHaveBeenCalledTimes(1))
  })
})

describe('Hub — gesture-unlock race (ticket 86c9m4u13)', () => {
  /**
   * Regression tests for the chip-tap-as-first-gesture audio leak
   * surfaced 2026-05-03 evening.
   *
   * Symptom: when Marian's first interaction with the page is the chip
   * tap (no prior splash tap consumed for audio unlock), the queued Hub
   * greeting plays AFTER the route-flip — she arrives at Word Song,
   * then hears "Try Word Song" play over the destination screen.
   *
   * Root cause: `dispatchGreeting` was queued behind `gestureUnlocked`,
   * which only flipped to `true` inside `handleNodeTap` AFTER
   * `cancelLine()` ran. Cancel ran against an empty active slot
   * (greeting was queued, not playing); then `setGestureUnlocked(true)`
   * triggered the deferred effect, which fired the greeting
   * post-render — bleeding into the destination screen.
   *
   * Fix: mark `greetingDispatchedRef.current = true` synchronously in
   * the chip-tap handler BEFORE flipping `setGestureUnlocked`. The
   * effect still runs (it's gated on `gestureUnlocked`), but
   * `dispatchGreeting()` short-circuits on the ref check.
   */
  it('does NOT play the greeting when the chip tap is the first user gesture (app-open path)', async () => {
    const user = userEvent.setup()
    const playLineFn = vi.fn(() => Promise.resolve())
    renderHub({
      storage: createMemoryStorage(),
      path: 'app-open', // gate starts locked
      playLineFn,
    })
    // No prior gesture → greeting queued, not yet dispatched.
    expect(playLineFn).toHaveBeenCalledTimes(0)
    // Chip tap IS the first gesture.
    const wordNode = screen
      .getAllByTestId('hub-tree-node')
      .find((n) => n.getAttribute('data-tree') === 'word-song')!
    await user.click(wordNode)
    // Flush any deferred microtasks the gesture-unlock effect might
    // have scheduled.
    await act(async () => {
      await Promise.resolve()
    })
    // Greeting must NOT fire — Marian is already on her way to Word Song.
    expect(playLineFn).toHaveBeenCalledTimes(0)
  })

  it('does NOT play the greeting when the chip tap is the first user gesture (app-open-recent path)', async () => {
    // Same gate-locked path as 'app-open'; both await first gesture.
    const user = userEvent.setup()
    const playLineFn = vi.fn(() => Promise.resolve())
    const adapter = createMemoryStorage()
    seed(adapter, {
      sessionCount: 4,
      lastSessionCompletedAt: new Date(2026, 3, 29, 8, 0).toISOString(),
    })
    renderHub({
      storage: adapter,
      path: 'app-open-recent',
      playLineFn,
      now: () => new Date(2026, 3, 29, 18, 0),
    })
    expect(playLineFn).toHaveBeenCalledTimes(0)
    const numberNode = screen
      .getAllByTestId('hub-tree-node')
      .find((n) => n.getAttribute('data-tree') === 'number-garden')!
    await user.click(numberNode)
    await act(async () => {
      await Promise.resolve()
    })
    expect(playLineFn).toHaveBeenCalledTimes(0)
  })

  it('still cancels an already-mid-flight greeting on chip tap (PR #144 regression guard)', async () => {
    // The gate is already unlocked (session-end path), greeting fires
    // on mount, chip tap then cancels it. This is the PR #144 behavior;
    // the fix for 86c9m4u13 must not regress this.
    const user = userEvent.setup()
    const cancelLineFn = vi.fn()
    // playLineFn returns a never-resolving promise so the greeting
    // stays "in flight" through the chip tap.
    const playLineFn = vi.fn(() => new Promise<void>(() => {}))
    renderHub({
      storage: createMemoryStorage(),
      path: 'session-end', // gate already unlocked → greeting fires on mount
      playLineFn,
      cancelLineFn,
    })
    // Wait for the mount-time dispatch.
    await act(async () => {
      await Promise.resolve()
    })
    expect(playLineFn).toHaveBeenCalledTimes(1)
    const wordNode = screen
      .getAllByTestId('hub-tree-node')
      .find((n) => n.getAttribute('data-tree') === 'word-song')!
    await user.click(wordNode)
    expect(cancelLineFn).toHaveBeenCalledTimes(1)
  })

  it('still plays the greeting when first gesture is a non-chip tap (handleFirstTap path)', async () => {
    // If Marian taps anywhere on Hub OTHER than a chip — the body of
    // the screen, the Emma image, the HUD chips — the gate
    // unlocks via `handleFirstTap` and the greeting SHOULD fire. Only
    // a chip tap suppresses the greeting (because she's leaving).
    const playLineFn = vi.fn(() => Promise.resolve())
    renderHub({
      storage: createMemoryStorage(),
      path: 'app-open',
      playLineFn,
    })
    expect(playLineFn).toHaveBeenCalledTimes(0)
    // Tap the hub root (not a chip) — fires `handleFirstTap` via
    // `onPointerDown` on `<m.main>`.
    const hubRoot = screen.getByTestId('hub')
    act(() => {
      hubRoot.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
      )
    })
    // Effect runs after gesture flip; flush microtasks.
    await act(async () => {
      await Promise.resolve()
    })
    expect(playLineFn).toHaveBeenCalledTimes(1)
  })
})

describe('Hub — clay world cards (Redesign R2, 123jpnbc68z)', () => {
  function cardFor(tree: 'number-garden' | 'word-song'): HTMLElement {
    return screen
      .getAllByTestId('hub-tree-node')
      .find((c) => c.getAttribute('data-tree') === tree)!
  }

  it('fresh progress: land 1, current = first step, padlocked next = second, 3 empty holes', () => {
    renderHub({
      storage: createMemoryStorage(),
      progressDoc: freshDoc(),
    })
    const landNumbers = screen.getAllByTestId('hub-land-number')
    expect(landNumbers.map((n) => n.getAttribute('data-value'))).toEqual([
      '1',
      '1',
    ])
    expect(
      screen
        .getAllByTestId('hub-card-current')
        .map((n) => n.getAttribute('data-node')),
    ).toEqual(['number-recog', 'letter-names'])
    expect(
      screen
        .getAllByTestId('hub-card-next')
        .map((n) => n.getAttribute('data-node')),
    ).toEqual(['add-to-10', 'letter-sounds'])
    expect(screen.getAllByTestId('hub-card-lock')).toHaveLength(2)
    const seeds = within(cardFor('number-garden')).getAllByTestId(
      'hub-card-seed',
    )
    expect(seeds.map((s) => s.getAttribute('data-filled'))).toEqual([
      'false',
      'false',
      'false',
    ])
  })

  it('has no bead row (the overview lives on the map, bar 9)', () => {
    renderHub({ storage: createMemoryStorage(), progressDoc: freshDoc() })
    expect(screen.queryAllByTestId('hub-card-bead')).toHaveLength(0)
    expect(screen.queryAllByTestId('hub-card-land')).toHaveLength(0)
  })

  it('uses the clay art manifest for stickers, land pill, seeds and map', () => {
    const p = freshDoc()
    p.skillLevels['number-recog'] = 'mastered'
    p.skillLevels['add-to-10'] = 'practicing'
    p.history = [
      {
        dateISO: new Date(2026, 4, 1, 12).toISOString(),
        skillFocus: ['add-to-10'],
        successRate: 1,
      },
    ]
    renderHub({
      storage: createMemoryStorage(),
      progressDoc: p,
      onOpenMap: () => {},
    })
    const math = within(cardFor('number-garden'))
    expect(math.getByTestId('hub-card-current')).toHaveAttribute(
      'src',
      '/assets/path/add-to-10-512.webp',
    )
    const srcs = Array.from(
      cardFor('number-garden').querySelectorAll('img'),
    ).map((i) => i.getAttribute('src'))
    expect(srcs).toEqual(
      expect.arrayContaining([
        '/assets/path/add-to-20-256.webp',
        '/assets/path/ui-padlock-256.webp',
        '/assets/path/land-ng-2-256.webp',
        '/assets/path/ui-bud-open-256.webp',
        '/assets/path/ui-map-256.webp',
      ]),
    )
    expect(
      math
        .getAllByTestId('hub-card-seed')
        .map((s) => s.getAttribute('data-filled')),
    ).toEqual(['true', 'false', 'false'])
  })

  it('hides only the land pill when showLevelToMarian is false', () => {
    const p = freshDoc()
    p.parentSettings = { ...p.parentSettings!, showLevelToMarian: false }
    renderHub({
      storage: createMemoryStorage(),
      progressDoc: p,
      onOpenMap: () => {},
    })
    expect(screen.queryAllByTestId('hub-land-number')).toHaveLength(0)
    expect(screen.getAllByTestId('hub-card-current')).toHaveLength(2)
    expect(screen.getAllByTestId('hub-card-next')).toHaveLength(2)
    expect(screen.getAllByTestId('hub-card-seed')).toHaveLength(6)
    expect(screen.getAllByTestId('hub-map-button')).toHaveLength(2)
  })

  it('a tap on the hero sticker still starts that tree (the card is one target)', async () => {
    const onPickTree = vi.fn()
    renderHub({
      storage: createMemoryStorage(),
      progressDoc: freshDoc(),
      onPickTree,
    })
    await userEvent.click(
      within(cardFor('word-song')).getByTestId('hub-card-current'),
    )
    expect(onPickTree).toHaveBeenCalledTimes(1)
    expect(onPickTree).toHaveBeenCalledWith('word-song')
  })

  it('the map button inside the card opens the map and never starts a session', async () => {
    const onPickTree = vi.fn()
    const onOpenMap = vi.fn()
    renderHub({
      storage: createMemoryStorage(),
      progressDoc: freshDoc(),
      onPickTree,
      onOpenMap,
    })
    const mapButton = within(cardFor('number-garden')).getByRole('button', {
      name: 'Number Garden map',
    })
    await userEvent.click(mapButton)
    expect(onOpenMap).toHaveBeenCalledTimes(1)
    expect(onOpenMap).toHaveBeenCalledWith('math')
    expect(onPickTree).toHaveBeenCalledTimes(0)
  })

  it('the card is keyboard-operable (Enter starts the tree)', async () => {
    const onPickTree = vi.fn()
    renderHub({
      storage: createMemoryStorage(),
      progressDoc: freshDoc(),
      onPickTree,
    })
    cardFor('number-garden').focus()
    await userEvent.keyboard('{Enter}')
    expect(onPickTree).toHaveBeenCalledTimes(1)
    expect(onPickTree).toHaveBeenCalledWith('number-garden')
  })

  it('a whole-world-complete card shows a bloom instead of a padlocked next', () => {
    const p = freshDoc()
    for (const n of MATH_TREE) p.skillLevels[n] = 'mastered'
    renderHub({ storage: createMemoryStorage(), progressDoc: p })
    const math = within(cardFor('number-garden'))
    expect(math.queryByTestId('hub-card-next')).toBeNull()
    expect(math.queryByTestId('hub-card-lock')).toBeNull()
    expect(math.getByTestId('hub-card-bloom')).toBeInTheDocument()
  })

  it('falls back to loadProgress() when no progressDoc is passed', () => {
    const p = freshDoc()
    p.skillLevels['number-recog'] = 'mastered'
    p.skillLevels['add-to-10'] = 'intro'
    saveProgress(p)
    renderHub({ storage: createMemoryStorage() })
    expect(
      within(cardFor('number-garden')).getByTestId('hub-card-current'),
    ).toHaveAttribute('data-node', 'add-to-10')
    expect(screen.getAllByTestId('hub-land-number')[0]).toHaveAttribute(
      'data-value',
      '2',
    )
  })
})

// Emma's Path 9/10 (123jpnbc3dt): the unlock moment moved to the map
// (spec §6), so the Hub never celebrates an unlock — an unlock is
// celebrated exactly once, there. Replaces the PromotionCelebration
// overlay tests (ticket 86c9kwnkw); their "exactly one Emma" and
// "exactly one line per mount" intent is kept below.
describe("Hub — no unlock celebration (moved to the map, Emma's Path 9/10)", () => {
  function promotedDoc() {
    const p = defaultProgress()
    p.skillLevels['add-to-10'] = 'mastered'
    p.skillLevels['add-to-20'] = 'intro'
    p.pendingPromotion = 'add-to-10'
    return p
  }

  it('renders exactly one idle Emma and no overlay while a promotion is queued', () => {
    renderHub({ storage: createMemoryStorage(), progressDoc: promotedDoc() })
    expect(screen.queryByTestId('hub-promotion-celebration')).toBeNull()
    expect(screen.queryAllByTestId(/^hub(-promotion)?-emma$/)).toHaveLength(1)
    expect(screen.getByTestId('hub-emma')).toBeInTheDocument()
    expect(screen.getAllByTestId('hub-tree-node')).toHaveLength(2)
  })

  it('speaks exactly one line per mount, and never a celebrate line', async () => {
    const playLineFn = vi.fn<NonNullable<HubProps['playLineFn']>>(() =>
      Promise.resolve(),
    )
    renderHub({
      storage: createMemoryStorage(),
      path: 'session-end',
      progressDoc: promotedDoc(),
      playLineFn,
    })
    await waitFor(() => expect(playLineFn).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(playLineFn).toHaveBeenCalledTimes(1)
    expect(String(playLineFn.mock.calls[0]![0])).not.toMatch(
      /^hub\.celebrate\./,
    )
  })
})

describe('Hub — anti-dark-pattern', () => {
  it('never displays the wrong-answer counter or red-x text', () => {
    const adapter = createMemoryStorage()
    seed(adapter, {
      sessionCount: 10,
      cumulativeStardust: 50,
      lastSessionStardust: 4,
      lastSessionCompletedAt: new Date(2026, 3, 29, 8, 0).toISOString(),
      dayStreak: 3,
    })
    renderHub({
      storage: adapter,
      now: () => new Date(2026, 3, 29, 18, 0),
    })
    const text = (screen.getByTestId('hub').textContent ?? '').toLowerCase()
    expect(text).not.toMatch(/wrong/)
    expect(text).not.toMatch(/streak broken/)
    expect(text).not.toMatch(/missed/)
    expect(text).not.toMatch(/0\s*(day|streak)/)
  })

  it('does NOT surface longestStreakEver anywhere on the screen', () => {
    const adapter = createMemoryStorage()
    seed(adapter, {
      sessionCount: 4,
      longestStreakEver: 42,
      cumulativeStardust: 100,
    })
    renderHub({ storage: adapter })
    const text = screen.getByTestId('hub').textContent ?? ''
    expect(text).not.toMatch(/42/)
    expect(text).not.toMatch(/best/i)
    expect(text).not.toMatch(/longest/i)
  })
})

// Guidance G1 (123jpnbca4r): the mockup's Hub states a / c / d / a2.
describe('Hub — guidance (mockup a / c / d / a2)', () => {
  const now = new Date(2026, 4, 12, 9, 0)

  function cardFor(tree: 'number-garden' | 'word-song'): HTMLElement {
    return screen
      .getAllByTestId('hub-tree-node')
      .find((c) => c.getAttribute('data-tree') === tree)!
  }
  const slotStates = (tree: 'number-garden' | 'word-song') =>
    within(cardFor(tree))
      .getAllByTestId('hub-card-seed')
      .map((s) => s.getAttribute('data-state'))

  async function spoken(playLineFn: ReturnType<typeof vi.fn>, n: number) {
    // The lines are recorded (G3): on app-open Emma waits for the first
    // tap, so tap the screen (not a card) the way Marian would.
    act(() => {
      screen
        .getByTestId('hub')
        .dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
        )
    })
    await waitFor(() => expect(playLineFn).toHaveBeenCalledTimes(n), {
      timeout: 3000,
    })
    return playLineFn.mock.calls.map(
      (c) => GUIDANCE_LINES[c[0] as GuidanceLineId].text,
    )
  }

  it('a · morning: Number Garden glows (closer to its unlock), Emma names it', async () => {
    const storage = createMemoryStorage()
    // Yesterday's flower already seen awake.
    storage.setItem(
      FLOWER_WAKE_STORAGE_KEY,
      JSON.stringify({ math: '2026-05-11' }),
    )
    const doc = freshDoc()
    doc.history = [goodDay(now, 1, 'number-recog')]
    const playLineFn = vi.fn(() => Promise.resolve())
    renderHub({ storage, now: () => now, progressDoc: doc, playLineFn })

    expect(cardFor('number-garden')).toHaveAttribute('data-suggested', 'true')
    expect(cardFor('word-song')).toHaveAttribute('data-suggested', 'false')
    expect(slotStates('number-garden')).toEqual(['grown', 'empty', 'empty'])
    expect(slotStates('word-song')).toEqual(['empty', 'empty', 'empty'])
    expect(await spoken(playLineFn, 1)).toEqual([
      "Let's grow a flower in Number Garden! Or pick Word Song.",
    ])
  })

  it('c · Number Garden done today: its flower sleeps, Word Song glows', async () => {
    const storage = createMemoryStorage()
    storage.setItem(
      FLOWER_WAKE_STORAGE_KEY,
      JSON.stringify({ math: '2026-05-11' }),
    )
    const doc = freshDoc()
    doc.history = [
      goodDay(now, 1, 'number-recog'),
      goodDay(now, 0, 'number-recog'),
    ]
    const playLineFn = vi.fn(() => Promise.resolve())
    renderHub({
      storage,
      now: () => now,
      progressDoc: doc,
      playLineFn,
      path: 'session-end',
    })

    expect(slotStates('number-garden')).toEqual(['grown', 'sleeping', 'empty'])
    const sleeping = within(cardFor('number-garden')).getAllByTestId(
      'hub-card-seed',
    )[1]!
    expect(sleeping.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/path/ui-bud-closed-256.webp',
    )
    expect(sleeping.querySelector('.hub-moon')).not.toBeNull()
    expect(sleeping.textContent).toBe('z')
    expect(cardFor('word-song')).toHaveAttribute('data-suggested', 'true')
    expect(await spoken(playLineFn, 1)).toEqual([
      "Your flower is sleeping. Let's play Word Song!",
    ])
  })

  it('d · both done: no glow, Emma offers practice, a card tap still starts a session', async () => {
    const doc = freshDoc()
    doc.history = [
      goodDay(now, 0, 'number-recog'),
      goodDay(now, 0, 'letter-names'),
    ]
    const playLineFn = vi.fn(() => Promise.resolve())
    const onPickTree = vi.fn()
    renderHub({
      storage: createMemoryStorage(),
      now: () => now,
      progressDoc: doc,
      playLineFn,
      onPickTree,
      path: 'session-end',
    })
    expect(screen.getByTestId('hub')).toHaveAttribute('data-suggestion', 'none')
    expect(slotStates('number-garden')).toEqual(['sleeping', 'empty', 'empty'])
    expect(slotStates('word-song')).toEqual(['sleeping', 'empty', 'empty'])
    expect(await spoken(playLineFn, 1)).toEqual([
      'Both flowers are sleeping. Want to practise more?',
    ])
    await userEvent.click(cardFor('word-song'))
    expect(onPickTree).toHaveBeenCalledWith('word-song')
  })

  it('a2 · next morning: buds open once with "Your flowers woke up!", then the path line', async () => {
    const storage = createMemoryStorage()
    // Yesterday both flowers were asleep (last seen awake: day before).
    storage.setItem(
      FLOWER_WAKE_STORAGE_KEY,
      JSON.stringify({ math: '2026-05-10' }),
    )
    const doc = freshDoc()
    doc.history = [
      goodDay(now, 2, 'number-recog'),
      goodDay(now, 1, 'number-recog'),
      goodDay(now, 1, 'letter-names'),
    ]
    const playLineFn = vi.fn(() => Promise.resolve())
    const view = renderHub({
      storage,
      now: () => now,
      progressDoc: doc,
      playLineFn,
    })

    expect(slotStates('number-garden')).toEqual(['grown', 'grown', 'empty'])
    const waking = (tree: 'number-garden' | 'word-song') =>
      within(cardFor(tree))
        .getAllByTestId('hub-card-seed')
        .map((s) => s.getAttribute('data-waking') === 'true')
    expect(waking('number-garden')).toEqual([false, true, false])
    expect(waking('word-song')).toEqual([true, false, false])
    expect(cardFor('number-garden')).toHaveAttribute('data-suggested', 'true')
    expect(await spoken(playLineFn, 2)).toEqual([
      'Your flowers woke up!',
      'One more flower, and a new path opens!',
    ])
    expect(JSON.parse(storage.store.get(FLOWER_WAKE_STORAGE_KEY)!)).toEqual({
      math: '2026-05-11',
      'word-song': '2026-05-11',
    })

    // Once: the next visit the same morning neither animates nor says it.
    view.unmount()
    window.sessionStorage.clear() // not a rapid remount
    const again = vi.fn(() => Promise.resolve())
    renderHub({ storage, now: () => now, progressDoc: doc, playLineFn: again })
    expect(
      screen
        .getAllByTestId('hub-card-seed')
        .some((s) => s.getAttribute('data-waking') === 'true'),
    ).toBe(false)
    expect(await spoken(again, 1)).toEqual([
      "Let's grow a flower in Number Garden! Or pick Word Song.",
    ])
  })

  it('?debug=1&dayOffset=1: the default clock moves "today", so today\'s sleeping flower is grown', () => {
    const realLocation = window.location
    const setSearch = (search: string) =>
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...realLocation, search },
      })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    try {
      const doc = freshDoc()
      doc.history = [goodDay(now, 0, 'number-recog')]
      const props = {
        progressDoc: doc,
        playLineFn: vi.fn(() => Promise.resolve()),
        path: 'session-end' as const,
      }

      // No `now` prop: the Hub reads the progress clock.
      setSearch('')
      const view = renderHub({ storage: createMemoryStorage(), ...props })
      expect(slotStates('number-garden')).toEqual([
        'sleeping',
        'empty',
        'empty',
      ])
      view.unmount()

      window.sessionStorage.clear() // not a rapid remount
      setSearch('?debug=1&dayOffset=1')
      renderHub({ storage: createMemoryStorage(), ...props })
      expect(slotStates('number-garden')).toEqual(['grown', 'empty', 'empty'])
      expect(cardFor('number-garden')).toHaveAttribute('data-suggested', 'true')
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: realLocation,
      })
      vi.useRealTimers()
    }
  })

  it('the caption shows the line Emma is saying', async () => {
    const doc = freshDoc()
    const playLineFn = vi.fn(
      (_id: GuidanceLineId, opts?: { onWordTick?: (i: number) => void }) => {
        opts?.onWordTick?.(0)
        return Promise.resolve()
      },
    )
    renderHub({
      storage: createMemoryStorage(),
      now: () => now,
      progressDoc: doc,
      playLineFn,
      path: 'session-end',
    })
    await screen.findByTestId('hub-caption')
    const words = screen
      .getAllByTestId('hub-caption-word')
      .map((w) => w.textContent)
    expect(words.join(' ')).toBe(
      "Let's grow a flower in Word Song! Or pick Number Garden.",
    )
  })
})
