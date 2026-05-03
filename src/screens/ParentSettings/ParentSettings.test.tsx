/**
 * ParentSettings screen tests (M2.5 — ticket 86c9kpjc7).
 *
 * Covers:
 *  - Renders the five rows in order
 *  - Toggles persist via storage.save() with the updated parentSettings
 *  - Segmented controls (mode picker, mastery threshold) persist
 *  - Done button fires onExit
 *  - Initial values reflect storage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ParentSettings from './ParentSettings'
import type { ParentSettingsStorage } from './ParentSettings'
import {
  DEFAULT_PARENT_SETTINGS,
  defaultProgress,
  type ParentSettings as ParentSettingsType,
  type Progress,
} from '../../lib/progress'

function createMemoryStorage(initial: Progress | null = null): {
  storage: ParentSettingsStorage
  saved: Progress[]
  current: () => Progress | null
} {
  let current: Progress | null = initial
  const saved: Progress[] = []
  return {
    storage: {
      load: () => current,
      save: (p: Progress) => {
        current = p
        saved.push(p)
      },
    },
    saved,
    current: () => current,
  }
}

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  window.localStorage.clear()
})

describe('ParentSettings — rendering', () => {
  it('renders six rows in the documented order (per-track threshold split adds one row, ticket 86c9kwvy0)', () => {
    const { storage } = createMemoryStorage(defaultProgress())
    render(<ParentSettings storage={storage} />)
    const rows = screen.getAllByTestId('parent-settings-row')
    expect(rows).toHaveLength(6)
    expect(rows.map((r) => r.getAttribute('data-row-id'))).toEqual([
      'autoPromote',
      'sessionModePicker',
      'masteryThreshold-math',
      'masteryThreshold-word-song',
      'crossDayEnforcement',
      'showLevelToMarian',
    ])
  })

  it('shows the loaded values, not always the defaults', () => {
    const custom: ParentSettingsType = {
      autoPromote: false,
      sessionModePicker: 'on',
      masteryThreshold: {
        math: { percent: 0.8, sessions: 2 },
        'word-song': { percent: 0.8, sessions: 2 },
      },
      crossDayEnforcement: false,
      showLevelToMarian: true,
    }
    const { storage } = createMemoryStorage({
      ...defaultProgress(),
      parentSettings: custom,
    })
    render(<ParentSettings storage={storage} />)

    expect(
      screen
        .getByTestId('parent-settings-toggle-autoPromote')
        .getAttribute('data-value'),
    ).toBe('off')
    expect(
      screen
        .getByTestId('parent-settings-segmented-sessionModePicker-on')
        .getAttribute('data-selected'),
    ).toBe('true')
    expect(
      screen
        .getByTestId('parent-settings-segmented-masteryThreshold-math-80-2')
        .getAttribute('data-selected'),
    ).toBe('true')
    expect(
      screen
        .getByTestId(
          'parent-settings-segmented-masteryThreshold-word-song-80-2',
        )
        .getAttribute('data-selected'),
    ).toBe('true')
    expect(
      screen
        .getByTestId('parent-settings-toggle-crossDayEnforcement')
        .getAttribute('data-value'),
    ).toBe('off')
    expect(
      screen
        .getByTestId('parent-settings-toggle-showLevelToMarian')
        .getAttribute('data-value'),
    ).toBe('on')
  })

  it('falls back to defaults when storage is empty (no progress yet)', () => {
    const { storage } = createMemoryStorage(null)
    render(<ParentSettings storage={storage} />)
    // Default is autoPromote=true, sessionModePicker=off,
    // math threshold=95/3, word-song threshold=90/3.
    expect(
      screen
        .getByTestId('parent-settings-toggle-autoPromote')
        .getAttribute('data-value'),
    ).toBe('on')
    expect(
      screen
        .getByTestId('parent-settings-segmented-sessionModePicker-off')
        .getAttribute('data-selected'),
    ).toBe('true')
    expect(
      screen
        .getByTestId('parent-settings-segmented-masteryThreshold-math-95-3')
        .getAttribute('data-selected'),
    ).toBe('true')
    expect(
      screen
        .getByTestId(
          'parent-settings-segmented-masteryThreshold-word-song-90-3',
        )
        .getAttribute('data-selected'),
    ).toBe('true')
  })
})

describe('ParentSettings — save-on-change', () => {
  it('flips autoPromote and writes the patched Progress to storage', async () => {
    const user = userEvent.setup()
    const ctx = createMemoryStorage(defaultProgress())
    render(<ParentSettings storage={ctx.storage} />)

    await user.click(screen.getByTestId('parent-settings-toggle-autoPromote'))

    expect(ctx.saved.length).toBeGreaterThan(0)
    const last = ctx.saved[ctx.saved.length - 1]
    expect(last.parentSettings?.autoPromote).toBe(false)
    // The other defaults must be preserved.
    expect(last.parentSettings?.sessionModePicker).toBe('off')
    expect(last.parentSettings?.masteryThreshold).toEqual({
      math: { percent: 0.95, sessions: 3 },
      'word-song': { percent: 0.9, sessions: 3 },
    })
  })

  it('switches sessionModePicker via the segmented control', async () => {
    const user = userEvent.setup()
    const ctx = createMemoryStorage(defaultProgress())
    render(<ParentSettings storage={ctx.storage} />)

    await user.click(
      screen.getByTestId('parent-settings-segmented-sessionModePicker-on'),
    )
    const last = ctx.saved[ctx.saved.length - 1]
    expect(last.parentSettings?.sessionModePicker).toBe('on')
  })

  it('selects each math-track preset independently and preserves word-song', async () => {
    const user = userEvent.setup()
    const ctx = createMemoryStorage(defaultProgress())
    render(<ParentSettings storage={ctx.storage} />)

    await user.click(
      screen.getByTestId(
        'parent-settings-segmented-masteryThreshold-math-80-2',
      ),
    )
    expect(ctx.saved.at(-1)?.parentSettings?.masteryThreshold).toEqual({
      math: { percent: 0.8, sessions: 2 },
      // word-song untouched at its 90/3 default.
      'word-song': { percent: 0.9, sessions: 3 },
    })

    await user.click(
      screen.getByTestId(
        'parent-settings-segmented-masteryThreshold-math-95-3',
      ),
    )
    expect(ctx.saved.at(-1)?.parentSettings?.masteryThreshold).toEqual({
      math: { percent: 0.95, sessions: 3 },
      'word-song': { percent: 0.9, sessions: 3 },
    })
  })

  it('selects each word-song-track preset independently and preserves math', async () => {
    const user = userEvent.setup()
    const ctx = createMemoryStorage(defaultProgress())
    render(<ParentSettings storage={ctx.storage} />)

    await user.click(
      screen.getByTestId(
        'parent-settings-segmented-masteryThreshold-word-song-80-2',
      ),
    )
    expect(ctx.saved.at(-1)?.parentSettings?.masteryThreshold).toEqual({
      // math untouched at its 95/3 default.
      math: { percent: 0.95, sessions: 3 },
      'word-song': { percent: 0.8, sessions: 2 },
    })

    await user.click(
      screen.getByTestId(
        'parent-settings-segmented-masteryThreshold-word-song-95-3',
      ),
    )
    expect(ctx.saved.at(-1)?.parentSettings?.masteryThreshold).toEqual({
      math: { percent: 0.95, sessions: 3 },
      'word-song': { percent: 0.95, sessions: 3 },
    })
  })

  it('per-track selections are independent across two clicks', async () => {
    // Click math 80/2, then word-song 95/3 — both selections survive,
    // neither resets the other.
    const user = userEvent.setup()
    const ctx = createMemoryStorage(defaultProgress())
    render(<ParentSettings storage={ctx.storage} />)

    await user.click(
      screen.getByTestId(
        'parent-settings-segmented-masteryThreshold-math-80-2',
      ),
    )
    await user.click(
      screen.getByTestId(
        'parent-settings-segmented-masteryThreshold-word-song-95-3',
      ),
    )
    expect(ctx.saved.at(-1)?.parentSettings?.masteryThreshold).toEqual({
      math: { percent: 0.8, sessions: 2 },
      'word-song': { percent: 0.95, sessions: 3 },
    })
  })

  it('flips remaining toggles independently and preserves other fields', async () => {
    const user = userEvent.setup()
    const ctx = createMemoryStorage(defaultProgress())
    render(<ParentSettings storage={ctx.storage} />)

    await user.click(
      screen.getByTestId('parent-settings-toggle-crossDayEnforcement'),
    )
    expect(ctx.saved.at(-1)?.parentSettings?.crossDayEnforcement).toBe(false)

    await user.click(
      screen.getByTestId('parent-settings-toggle-showLevelToMarian'),
    )
    const last = ctx.saved.at(-1)!
    expect(last.parentSettings?.showLevelToMarian).toBe(true)
    // crossDayEnforcement remains false from the previous tap.
    expect(last.parentSettings?.crossDayEnforcement).toBe(false)
    // autoPromote and sessionModePicker remain at defaults.
    expect(last.parentSettings?.autoPromote).toBe(true)
    expect(last.parentSettings?.sessionModePicker).toBe('off')
  })

  it('does not destroy the existing Progress fields (history, leitner, profile)', async () => {
    const user = userEvent.setup()
    const seed = defaultProgress('Marian')
    seed.history = [
      {
        dateISO: '2026-04-30T10:00:00.000Z',
        skillFocus: ['add-to-10'],
        successRate: 0.8,
      },
    ]
    const ctx = createMemoryStorage(seed)
    render(<ParentSettings storage={ctx.storage} />)
    await user.click(screen.getByTestId('parent-settings-toggle-autoPromote'))
    const last = ctx.saved.at(-1)!
    expect(last.history).toEqual(seed.history)
    expect(last.profile).toEqual(seed.profile)
    expect(last.skillLevels).toEqual(seed.skillLevels)
    expect(last.mathFactsLeitner).toEqual(seed.mathFactsLeitner)
  })
})

describe('ParentSettings — exit', () => {
  it('fires onExit when the Done button is tapped', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    const { storage } = createMemoryStorage(defaultProgress())
    render(<ParentSettings storage={storage} onExit={onExit} />)
    await user.click(screen.getByTestId('parent-settings-done'))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})

describe('ParentSettings — pending-promotion banner (M3 audit, ticket 86c9kwnkw)', () => {
  function progressWithPending(): Progress {
    const base = defaultProgress()
    return {
      ...base,
      pendingPromotion: 'add-to-10',
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        autoPromote: false,
      },
      skillLevels: { ...base.skillLevels, 'add-to-10': 'practicing' },
    }
  }

  it('hides the banner when pendingPromotion is undefined', () => {
    const { storage } = createMemoryStorage(defaultProgress())
    render(<ParentSettings storage={storage} />)
    expect(screen.queryByTestId('parent-settings-pending-promotion')).toBeNull()
  })

  it('hides the banner when autoPromote is true (engine never queues in that case)', () => {
    // Defensive: even if a stale `pendingPromotion` somehow exists with
    // autoPromote=true, we don't surface the banner — the engine's
    // auto-promote re-entry will clear the queue on the next session-end.
    const stale: Progress = {
      ...defaultProgress(),
      pendingPromotion: 'add-to-10',
      // autoPromote stays true via DEFAULT_PARENT_SETTINGS in
      // defaultProgress(), so no override needed.
    }
    const { storage } = createMemoryStorage(stale)
    render(<ParentSettings storage={storage} />)
    expect(screen.queryByTestId('parent-settings-pending-promotion')).toBeNull()
  })

  it('surfaces the banner when autoPromote is off AND pendingPromotion is set', () => {
    const { storage } = createMemoryStorage(progressWithPending())
    render(<ParentSettings storage={storage} />)
    const banner = screen.getByTestId('parent-settings-pending-promotion')
    expect(banner.getAttribute('data-node')).toBe('add-to-10')
    expect(
      screen.getByTestId('parent-settings-pending-promotion-label').textContent,
    ).toBe('add to 10')
  })

  it('Confirm button applies the promotion and clears pendingPromotion', async () => {
    const user = userEvent.setup()
    const { storage, saved, current } = createMemoryStorage(
      progressWithPending(),
    )
    render(<ParentSettings storage={storage} />)
    await user.click(screen.getByTestId('parent-settings-confirm-promotion'))

    // The save count reflects exactly one save for the confirm.
    expect(saved).toHaveLength(1)
    const after = current()!
    expect(after.pendingPromotion).toBeUndefined()
    expect(after.skillLevels['add-to-10']).toBe('mastered')
    // Downstream node was unlocked.
    expect(after.skillLevels['add-to-20']).toBe('intro')
    // Parent's autoPromote preference (false) is preserved.
    expect(after.parentSettings?.autoPromote).toBe(false)

    // Banner unmounts after the apply.
    expect(screen.queryByTestId('parent-settings-pending-promotion')).toBeNull()
  })
})

describe('ParentSettings — DEFAULT_PARENT_SETTINGS contract', () => {
  it('matches the seed defaults shown in the empty-storage path', () => {
    const { storage } = createMemoryStorage(null)
    render(<ParentSettings storage={storage} />)
    // Sanity: the DEFAULT_PARENT_SETTINGS export and the rendered
    // initial state agree. A regression here would mean the screen
    // and the read API drifted.
    expect(DEFAULT_PARENT_SETTINGS.autoPromote).toBe(true)
    expect(
      screen
        .getByTestId('parent-settings-toggle-autoPromote')
        .getAttribute('data-value'),
    ).toBe('on')
  })
})
