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
  it('renders seven rows in the documented order (per-track threshold split + ticket 86c9qa0kf cross-vowel toggle)', () => {
    const { storage } = createMemoryStorage(defaultProgress())
    render(<ParentSettings storage={storage} />)
    const rows = screen.getAllByTestId('parent-settings-row')
    expect(rows).toHaveLength(7)
    expect(rows.map((r) => r.getAttribute('data-row-id'))).toEqual([
      'autoPromote',
      'sessionModePicker',
      'masteryThreshold-math',
      'masteryThreshold-word-song',
      'crossDayEnforcement',
      'showLevelToMarian',
      'crossVowelMixingEnabled',
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
      crossVowelMixingEnabled: false,
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

  // Ticket 86c9qa0kf — cross-vowel mix toggle row.
  it('flips crossVowelMixingEnabled and preserves other fields (ticket 86c9qa0kf)', async () => {
    const user = userEvent.setup()
    const ctx = createMemoryStorage(defaultProgress())
    render(<ParentSettings storage={ctx.storage} />)

    // Default is `true`; click flips to `false`.
    await user.click(
      screen.getByTestId('parent-settings-toggle-crossVowelMixingEnabled'),
    )
    const last = ctx.saved.at(-1)!
    expect(last.parentSettings?.crossVowelMixingEnabled).toBe(false)
    // Other defaults preserved.
    expect(last.parentSettings?.autoPromote).toBe(true)
    expect(last.parentSettings?.crossDayEnforcement).toBe(true)
    expect(last.parentSettings?.showLevelToMarian).toBe(false)
  })

  it('crossVowelMixingEnabled defaults to "on" in the UI', () => {
    const { storage } = createMemoryStorage(defaultProgress())
    render(<ParentSettings storage={storage} />)
    expect(
      screen
        .getByTestId('parent-settings-toggle-crossVowelMixingEnabled')
        .getAttribute('data-value'),
    ).toBe('on')
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

describe('ParentSettings — Backup section (ticket 86c9pkfth)', () => {
  /**
   * The Backup section reads BOTH the Progress doc (via `storage.load()`)
   * AND the session-history blob (via `storage.loadSessionHistory()`).
   * To exercise the section deterministically, tests need a memory
   * storage that exposes both seams.
   */
  function createBackupStorage(opts?: { progress?: Progress | null }): {
    storage: ParentSettingsStorage
    clipboardWrites: string[]
    rejectClipboard: boolean
  } {
    const clipboardWrites: string[] = []
    const state = { rejectClipboard: false }
    const sessionHistoryStub = {
      schemaVersion: 2 as const,
      sessionCount: 5,
      lastSessionCompletedAt: '2026-05-06T10:00:00.000Z',
      longestStreakEver: 3,
      cumulativeStardust: 12,
      lastSessionStardust: 4,
      dayStreak: 1,
      todayTreesTouched: { date: '2026-05-06', trees: [] },
      lastSuggestion: null,
      consecutiveOverrides: 0,
      suggestionCooldownUntil: null,
    }
    const storage: ParentSettingsStorage = {
      load: () => opts?.progress ?? defaultProgress(),
      save: () => {
        /* no-op for backup tests */
      },
      loadSessionHistory: () => sessionHistoryStub,
      writeClipboard: async (text: string) => {
        if (state.rejectClipboard) throw new Error('NotAllowedError')
        clipboardWrites.push(text)
      },
    }
    return {
      storage,
      clipboardWrites,
      get rejectClipboard() {
        return state.rejectClipboard
      },
      set rejectClipboard(v: boolean) {
        state.rejectClipboard = v
      },
    } as ReturnType<typeof createBackupStorage>
  }

  it('renders the Backup section with a read-only textarea and Copy button', () => {
    const { storage } = createBackupStorage()
    render(<ParentSettings storage={storage} />)
    const section = screen.getByTestId('parent-settings-backup')
    expect(section).toBeTruthy()
    const textarea = screen.getByTestId(
      'parent-settings-backup-json',
    ) as HTMLTextAreaElement
    expect(textarea.readOnly).toBe(true)
    expect(screen.getByTestId('parent-settings-backup-copy')).toBeTruthy()
  })

  it('the textarea contents parse as JSON with the expected envelope shape', () => {
    const { storage } = createBackupStorage()
    render(<ParentSettings storage={storage} />)
    const textarea = screen.getByTestId(
      'parent-settings-backup-json',
    ) as HTMLTextAreaElement
    const parsed = JSON.parse(textarea.value)
    expect(parsed.kind).toBe('marian-tutor.backup')
    expect(parsed.version).toBe(1)
    expect(typeof parsed.exportedAtISO).toBe('string')
    expect(parsed.progress).toBeTruthy()
    expect(parsed.progress.schemaVersion).toBe(1)
    expect(parsed.sessionHistory).toBeTruthy()
    expect(parsed.sessionHistory.sessionCount).toBe(5)
  })

  it('Copy button calls writeClipboard with the textarea value', async () => {
    const user = userEvent.setup()
    const ctx = createBackupStorage()
    render(<ParentSettings storage={ctx.storage} />)
    const textarea = screen.getByTestId(
      'parent-settings-backup-json',
    ) as HTMLTextAreaElement
    await user.click(screen.getByTestId('parent-settings-backup-copy'))
    expect(ctx.clipboardWrites).toHaveLength(1)
    expect(ctx.clipboardWrites[0]).toBe(textarea.value)
  })

  it('renders a "copied" status after a successful Copy', async () => {
    const user = userEvent.setup()
    const { storage } = createBackupStorage()
    render(<ParentSettings storage={storage} />)
    expect(screen.queryByTestId('parent-settings-backup-status')).toBeNull()
    await user.click(screen.getByTestId('parent-settings-backup-copy'))
    const status = await screen.findByTestId('parent-settings-backup-status')
    expect(status.getAttribute('data-status')).toBe('copied')
  })

  it('renders an "error" status when writeClipboard rejects', async () => {
    const user = userEvent.setup()
    const ctx = createBackupStorage()
    ctx.rejectClipboard = true
    render(<ParentSettings storage={ctx.storage} />)
    await user.click(screen.getByTestId('parent-settings-backup-copy'))
    const status = await screen.findByTestId('parent-settings-backup-status')
    expect(status.getAttribute('data-status')).toBe('error')
    // Textarea still shows the JSON — manual select-and-copy fallback.
    const textarea = screen.getByTestId(
      'parent-settings-backup-json',
    ) as HTMLTextAreaElement
    expect(textarea.value.length).toBeGreaterThan(0)
  })

  it('survives a session-history read that throws (defensive — adapter failure)', () => {
    // Seam adapter returns a thrown error — the backup still renders
    // with `sessionHistory: null` rather than crashing the screen.
    const storage: ParentSettingsStorage = {
      load: () => defaultProgress(),
      save: () => {},
      loadSessionHistory: () => {
        throw new Error('storage-unavailable')
      },
      writeClipboard: async () => {},
    }
    render(<ParentSettings storage={storage} />)
    const textarea = screen.getByTestId(
      'parent-settings-backup-json',
    ) as HTMLTextAreaElement
    const parsed = JSON.parse(textarea.value)
    expect(parsed.progress).toBeTruthy()
    expect(parsed.sessionHistory).toBeNull()
  })

  it('renders an "error" status when writeClipboard is undefined (test-seam contract)', async () => {
    // A storage that doesn't supply writeClipboard at all (legacy
    // consumer) — the Copy click surfaces an error rather than
    // throwing.
    const user = userEvent.setup()
    const storage: ParentSettingsStorage = {
      load: () => defaultProgress(),
      save: () => {},
      loadSessionHistory: () => ({
        schemaVersion: 2,
        sessionCount: 0,
        lastSessionCompletedAt: '',
        longestStreakEver: 0,
        cumulativeStardust: 0,
        lastSessionStardust: 0,
        dayStreak: 0,
        todayTreesTouched: { date: '', trees: [] },
        lastSuggestion: null,
        consecutiveOverrides: 0,
        suggestionCooldownUntil: null,
      }),
      // writeClipboard intentionally omitted
    }
    render(<ParentSettings storage={storage} />)
    await user.click(screen.getByTestId('parent-settings-backup-copy'))
    const status = await screen.findByTestId('parent-settings-backup-status')
    expect(status.getAttribute('data-status')).toBe('error')
  })
})

// ── Cloud Backup section (ticket 86c9pkfyu) ───────────────────────────────

describe('ParentSettings — Cloud Backup section', () => {
  const VALID_UUID = '11111111-2222-4333-8444-555555555555'

  it('renders the device id, last-synced timestamp, and Push now button', () => {
    const seeded = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-07T10:00:00.000Z',
      },
    }
    const { storage } = createMemoryStorage(seeded)
    storage.getDeviceId = () => VALID_UUID
    render(<ParentSettings storage={storage} />)
    expect(
      screen.getByTestId('parent-settings-cloud-device-id').textContent,
    ).toBe(VALID_UUID)
    expect(
      screen.getByTestId('parent-settings-cloud-last-synced').textContent,
    ).toBe('2026-05-07T10:00:00.000Z')
    expect(
      screen.getByTestId('parent-settings-cloud-push-now'),
    ).toBeInTheDocument()
  })

  it('shows "Never" when no session has been played yet', () => {
    const { storage } = createMemoryStorage(defaultProgress())
    storage.getDeviceId = () => VALID_UUID
    render(<ParentSettings storage={storage} />)
    expect(
      screen.getByTestId('parent-settings-cloud-last-synced').textContent,
    ).toBe('Never')
  })

  it('Push now triggers storage.pushNow and surfaces "sent" status', async () => {
    const user = userEvent.setup()
    const { storage } = createMemoryStorage(defaultProgress())
    const pushNow = vi.fn(async () => 'sent' as const)
    storage.getDeviceId = () => VALID_UUID
    storage.pushNow = pushNow
    render(<ParentSettings storage={storage} />)
    await user.click(screen.getByTestId('parent-settings-cloud-push-now'))
    const status = await screen.findByTestId(
      'parent-settings-cloud-push-status',
    )
    expect(status.getAttribute('data-status')).toBe('sent')
    expect(pushNow).toHaveBeenCalledTimes(1)
  })

  it('Push now shows "failed" when pushNow rejects', async () => {
    const user = userEvent.setup()
    const { storage } = createMemoryStorage(defaultProgress())
    const pushNow = vi.fn(async () => 'failed' as const)
    storage.getDeviceId = () => VALID_UUID
    storage.pushNow = pushNow
    render(<ParentSettings storage={storage} />)
    await user.click(screen.getByTestId('parent-settings-cloud-push-now'))
    const status = await screen.findByTestId(
      'parent-settings-cloud-push-status',
    )
    expect(status.getAttribute('data-status')).toBe('failed')
  })

  it('Restore from device ID rejects malformed UUIDs without calling the seam', async () => {
    const user = userEvent.setup()
    const { storage } = createMemoryStorage(defaultProgress())
    const restoreFromDeviceId = vi.fn()
    storage.getDeviceId = () => VALID_UUID
    storage.restoreFromDeviceId = restoreFromDeviceId
    render(<ParentSettings storage={storage} />)
    await user.type(
      screen.getByTestId('parent-settings-cloud-restore-input'),
      'not-a-uuid',
    )
    await user.click(screen.getByTestId('parent-settings-cloud-restore-submit'))
    const status = await screen.findByTestId(
      'parent-settings-cloud-restore-status',
    )
    expect(status.getAttribute('data-status')).toBe('invalid-format')
    expect(restoreFromDeviceId).not.toHaveBeenCalled()
  })

  it('Restore from device ID with valid UUID + cloud install refreshes the in-memory progress', async () => {
    const user = userEvent.setup()
    const cloudBlob: Progress = {
      ...defaultProgress(),
      profile: {
        ...defaultProgress().profile,
        lastPlayedISO: '2026-05-07T10:00:00.000Z',
      },
    }
    const { storage } = createMemoryStorage(defaultProgress())
    storage.getDeviceId = () => VALID_UUID
    storage.restoreFromDeviceId = vi.fn(async () => ({
      kind: 'installed-from-cloud' as const,
      progress: cloudBlob,
    }))
    render(<ParentSettings storage={storage} />)
    await user.type(
      screen.getByTestId('parent-settings-cloud-restore-input'),
      VALID_UUID,
    )
    await user.click(screen.getByTestId('parent-settings-cloud-restore-submit'))
    const status = await screen.findByTestId(
      'parent-settings-cloud-restore-status',
    )
    expect(status.getAttribute('data-status')).toBe(
      'restored-installed-from-cloud',
    )
    // The new device id is reflected in the display.
    expect(
      screen.getByTestId('parent-settings-cloud-device-id').textContent,
    ).toBe(VALID_UUID)
    // The last-synced timestamp picked up the cloud blob's
    // lastPlayedISO via the post-restore re-render.
    expect(
      screen.getByTestId('parent-settings-cloud-last-synced').textContent,
    ).toBe('2026-05-07T10:00:00.000Z')
  })

  it('Restore from device ID returns "no-cloud-record" outcome when KV reports 404', async () => {
    const user = userEvent.setup()
    const { storage } = createMemoryStorage(defaultProgress())
    storage.getDeviceId = () => VALID_UUID
    storage.restoreFromDeviceId = vi.fn(async () => ({
      kind: 'noop' as const,
      reason: 'no-local-blob' as const,
    }))
    render(<ParentSettings storage={storage} />)
    await user.type(
      screen.getByTestId('parent-settings-cloud-restore-input'),
      VALID_UUID,
    )
    await user.click(screen.getByTestId('parent-settings-cloud-restore-submit'))
    const status = await screen.findByTestId(
      'parent-settings-cloud-restore-status',
    )
    expect(status.getAttribute('data-status')).toBe('restored-noop')
  })

  it('Copy device ID dispatches storage.writeClipboard and surfaces "copied"', async () => {
    const user = userEvent.setup()
    const { storage } = createMemoryStorage(defaultProgress())
    const writeClipboard = vi.fn(async () => undefined)
    storage.getDeviceId = () => VALID_UUID
    storage.writeClipboard = writeClipboard
    render(<ParentSettings storage={storage} />)
    await user.click(screen.getByTestId('parent-settings-cloud-copy-device-id'))
    const status = await screen.findByTestId(
      'parent-settings-cloud-device-id-status',
    )
    expect(status.getAttribute('data-status')).toBe('copied')
    expect(writeClipboard).toHaveBeenCalledWith(VALID_UUID)
  })
})
