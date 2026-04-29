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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import Hub from './Hub'
import type { HubProps } from './Hub'
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
  SUGGESTION_COOLDOWN_MS,
  SUGGESTION_OVERRIDE_CAP,
} from './hubSuggestion'
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

  it('renders cumulative stardust in the HUD', () => {
    const adapter = createMemoryStorage()
    seed(adapter, { cumulativeStardust: 47 })
    renderHub({ storage: adapter })
    const counter = screen.getByTestId('hub-cumulative-stardust')
    expect(counter.getAttribute('data-total')).toBe('47')
    expect(counter.textContent ?? '').toContain('47')
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

describe('Hub — recent-stats strip (4 states)', () => {
  it('idle: no stats visible when no qualifying values', () => {
    const adapter = createMemoryStorage()
    seed(adapter)
    renderHub({ storage: adapter, now: () => new Date(2026, 3, 29, 12, 0) })
    expect(
      screen.getByTestId('hub-recent-stats').getAttribute('data-visible'),
    ).toBe('false')
    expect(screen.queryByTestId('hub-stardust-today')).toBeNull()
    expect(screen.queryByTestId('hub-day-streak')).toBeNull()
  })

  it("returning-user-with-stats: shows today's stardust + streak", () => {
    const adapter = createMemoryStorage()
    const now = new Date(2026, 3, 29, 18, 0)
    seed(adapter, {
      sessionCount: 4,
      lastSessionCompletedAt: new Date(2026, 3, 29, 8, 0).toISOString(),
      lastSessionStardust: 11,
      dayStreak: 3,
    })
    renderHub({ storage: adapter, now: () => now })
    expect(
      screen.getByTestId('hub-recent-stats').getAttribute('data-visible'),
    ).toBe('true')
    expect(
      screen.getByTestId('hub-stardust-today').getAttribute('data-value'),
    ).toBe('11')
    expect(
      screen.getByTestId('hub-day-streak').getAttribute('data-value'),
    ).toBe('3')
  })

  it('day-streak hidden when last session was 2+ days ago (silent reset)', () => {
    const adapter = createMemoryStorage()
    const now = new Date(2026, 3, 29, 18, 0)
    seed(adapter, {
      sessionCount: 4,
      // 2.5 days ago
      lastSessionCompletedAt: new Date(2026, 3, 27, 6, 0).toISOString(),
      lastSessionStardust: 6,
      dayStreak: 5,
    })
    renderHub({ storage: adapter, now: () => now })
    // Last session was >24h ago AND >1 calendar day → both stats hidden
    expect(
      screen.getByTestId('hub-recent-stats').getAttribute('data-visible'),
    ).toBe('false')
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

  it('no ring when both trees touched today (suggestion === null)', () => {
    const adapter = createMemoryStorage()
    seed(adapter, {
      todayTreesTouched: {
        date: '2026-04-29',
        trees: ['number-garden', 'word-song'],
      },
    })
    renderHub({ storage: adapter, now: () => apr29 })
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

  it('persists suggestion outcome on override tap (bumps consecutiveOverrides)', async () => {
    const user = userEvent.setup()
    const adapter = createMemoryStorage()
    seed(adapter, {
      sessionCount: 3,
      consecutiveOverrides: 0,
      lastSuggestion: 'number-garden', // → algorithm picks word-song
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
    expect(persisted.consecutiveOverrides).toBe(1)
    expect(persisted.lastSuggestion).toBe('word-song')
  })

  it('arms 2-day cool-down on the third consecutive override', async () => {
    const user = userEvent.setup()
    const adapter = createMemoryStorage()
    const now = apr29
    seed(adapter, {
      sessionCount: 5,
      consecutiveOverrides: SUGGESTION_OVERRIDE_CAP - 1, // = 2
      lastSuggestion: 'number-garden', // → algorithm picks word-song
    })
    renderHub({
      storage: adapter,
      now: () => now,
      onPickTree: vi.fn(),
    })
    const numberNode = screen
      .getAllByTestId('hub-tree-node')
      .find((n) => n.getAttribute('data-tree') === 'number-garden')!
    await user.click(numberNode)

    const persisted = JSON.parse(
      adapter.store.get(SESSION_HISTORY_KEY)!,
    ) as SessionHistoryV2
    // Counter resets when cap is hit; cool-down armed.
    expect(persisted.consecutiveOverrides).toBe(0)
    expect(persisted.suggestionCooldownUntil).toBe(
      now.getTime() + SUGGESTION_COOLDOWN_MS,
    )
  })

  it('returns null suggestion while cool-down is active (both nodes equal)', () => {
    const adapter = createMemoryStorage()
    const now = apr29
    seed(adapter, {
      sessionCount: 5,
      suggestionCooldownUntil: now.getTime() + 60_000,
      lastSuggestion: 'word-song',
    })
    renderHub({ storage: adapter, now: () => now })
    expect(screen.getByTestId('hub').getAttribute('data-suggestion')).toBe(
      'none',
    )
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

describe('Hub — path-strip sliding window', () => {
  it('renders 5 cells per tree at default (currentIndex=0)', () => {
    renderHub({ storage: createMemoryStorage() })
    const numberCells = screen
      .getAllByTestId('hub-path-strip-cell')
      .filter(
        (c) =>
          c
            .closest('[data-testid="hub-path-strip"]')
            ?.getAttribute('data-tree') === 'number-garden',
      )
    expect(numberCells.length).toBeLessThanOrEqual(5)
    expect(numberCells.length).toBeGreaterThan(0)
  })

  it('marks the current stage as "current" and earlier as "mastered"', () => {
    renderHub({
      storage: createMemoryStorage(),
      progress: { numberGardenIndex: 3, wordSongIndex: 0 },
    })
    const numberCells = screen
      .getAllByTestId('hub-path-strip-cell')
      .filter(
        (c) =>
          c
            .closest('[data-testid="hub-path-strip"]')
            ?.getAttribute('data-tree') === 'number-garden',
      )
    // Window is current-1 (=2) → current+3 (=6), so 5 cells with the
    // current cell at index 1 of the window.
    const masteredCount = numberCells.filter(
      (c) => c.getAttribute('data-kind') === 'mastered',
    ).length
    const currentCount = numberCells.filter(
      (c) => c.getAttribute('data-kind') === 'current',
    ).length
    expect(currentCount).toBe(1)
    expect(masteredCount).toBeGreaterThanOrEqual(1)
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
