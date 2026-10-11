/**
 * Parent Settings model: settings patch, promotion confirm, rows,
 * mastery presets, backup JSON, restore outcome lines. The "web parity"
 * blocks run the web screen's pre-extraction code (copied verbatim from
 * `src/screens/ParentSettings/ParentSettings.tsx` at origin/main 054928c)
 * as an oracle against the core functions over an input matrix.
 */
import { describe, expect, it } from 'vitest'
import type { ReconcileOutcome } from '../progress/cloudSync'
import { applyMasteryRule } from '../progress/mastery'
import {
  DEFAULT_PARENT_SETTINGS,
  MASTERY_THRESHOLD_PRESETS,
  getSettings,
} from '../progress/parentSettings'
import { defaultProgress } from '../progress/defaults'
import type {
  MasteryThreshold,
  MasteryTrackKey,
  ParentSettings,
  Progress,
} from '../progress/types'
import {
  emptySessionHistory,
  type SessionHistoryV2,
} from '../sessionEnd/sessionHistory'
import {
  SESSION_MODE_OPTIONS,
  SETTINGS_ROWS,
  applySettingsPatch,
  buildBackupJson,
  buildBackupPayload,
  confirmPendingPromotion,
  masteryPatch,
  masteryRowId,
  pendingPromotionToConfirm,
  presetId,
  presetIndexFor,
  presetLabel,
  restoreOutcomeMessage,
  safelyReadSessionHistory,
  togglePatch,
  type ParentSettingsPatch,
} from './parentSettingsModel'

// ── Web reference (verbatim logic, pre-extraction) ──────────────────────

function webUpdate(prev: Progress, patch: ParentSettingsPatch): Progress {
  const current = getSettings(prev)
  const next: ParentSettings = {
    ...current,
    ...patch,
    masteryThreshold: patch.masteryThreshold
      ? { ...current.masteryThreshold, ...patch.masteryThreshold }
      : current.masteryThreshold,
  }
  return { ...prev, parentSettings: next }
}

function webConfirm(prev: Progress): Progress {
  if (prev.pendingPromotion === undefined) return prev
  const trueAutoPromote: Progress = {
    ...prev,
    parentSettings: { ...getSettings(prev), autoPromote: true },
  }
  const promoted = applyMasteryRule(trueAutoPromote)
  return {
    ...promoted,
    parentSettings: {
      ...getSettings(promoted),
      autoPromote: getSettings(prev).autoPromote,
    },
  }
}

function webPresetIndex(value: MasteryThreshold, track: MasteryTrackKey) {
  const idx = MASTERY_THRESHOLD_PRESETS.findIndex(
    (p) => p.percent === value.percent && p.sessions === value.sessions,
  )
  if (idx !== -1) return idx
  const fallback = DEFAULT_PARENT_SETTINGS.masteryThreshold[track]
  return MASTERY_THRESHOLD_PRESETS.findIndex(
    (p) => p.percent === fallback.percent && p.sessions === fallback.sessions,
  )
}

// ── Fixtures ────────────────────────────────────────────────────────────

function withPending(autoPromote: boolean): Progress {
  const base = defaultProgress()
  return {
    ...base,
    pendingPromotion: 'add-to-10',
    parentSettings: { ...DEFAULT_PARENT_SETTINGS, autoPromote },
    skillLevels: { ...base.skillLevels, 'add-to-10': 'practicing' },
  }
}

/** A blob from before per-track thresholds, with a sparse settings object. */
function legacySparse(): Progress {
  return {
    ...defaultProgress(),
    parentSettings: {
      autoPromote: false,
    } as unknown as ParentSettings,
  }
}

const PATCHES: ParentSettingsPatch[] = [
  { autoPromote: false },
  { autoPromote: true },
  { sessionModePicker: 'on' },
  { crossDayEnforcement: false },
  { showLevelToMarian: false },
  { crossVowelMixingEnabled: false },
  { masteryThreshold: { math: { percent: 0.8, sessions: 2 } } },
  { masteryThreshold: { 'word-song': { percent: 0.95, sessions: 3 } } },
  {
    masteryThreshold: {
      math: { percent: 0.95, sessions: 3 },
      'word-song': { percent: 0.8, sessions: 2 },
    },
  },
]

const BASES: [string, () => Progress][] = [
  ['default', defaultProgress],
  ['legacy sparse settings', legacySparse],
  [
    'no parentSettings',
    () => {
      const p = defaultProgress()
      delete (p as Partial<Progress>).parentSettings
      return p
    },
  ],
]

// ── Tests ───────────────────────────────────────────────────────────────

describe('applySettingsPatch', () => {
  it.each(BASES)('matches the web update() for every patch (%s)', (_, base) => {
    for (const patch of PATCHES) {
      expect(applySettingsPatch(base(), patch)).toEqual(
        webUpdate(base(), patch),
      )
    }
  })

  it('writes the FULL settings object and keeps the other track', () => {
    const next = applySettingsPatch(defaultProgress(), {
      masteryThreshold: { math: { percent: 0.8, sessions: 2 } },
    })
    expect(next.parentSettings).toEqual({
      ...DEFAULT_PARENT_SETTINGS,
      masteryThreshold: {
        math: { percent: 0.8, sessions: 2 },
        'word-song': DEFAULT_PARENT_SETTINGS.masteryThreshold['word-song'],
      },
    })
  })

  it('leaves every other Progress field untouched', () => {
    const base = defaultProgress()
    const next = applySettingsPatch(base, { autoPromote: false })
    expect({ ...next, parentSettings: base.parentSettings }).toEqual(base)
    expect(next).not.toBe(base)
  })
})

describe('pendingPromotionToConfirm', () => {
  it('shows the queued node only when auto-promote is off', () => {
    expect(pendingPromotionToConfirm(withPending(false))).toBe('add-to-10')
    expect(pendingPromotionToConfirm(withPending(true))).toBeNull()
    expect(pendingPromotionToConfirm(defaultProgress())).toBeNull()
  })
})

describe('confirmPendingPromotion', () => {
  it('matches the web handler', () => {
    for (const p of [
      withPending(false),
      withPending(true),
      defaultProgress(),
    ]) {
      expect(confirmPendingPromotion(p)).toEqual(webConfirm(p))
    }
  })

  it('masters the node, unlocks the next, clears the queue, keeps autoPromote off', () => {
    const after = confirmPendingPromotion(withPending(false))
    expect(after.pendingPromotion).toBeUndefined()
    expect(after.skillLevels['add-to-10']).toBe('mastered')
    expect(after.skillLevels['add-to-20']).toBe('intro')
    expect(after.parentSettings?.autoPromote).toBe(false)
  })

  it('returns the same object when nothing is queued (the caller skips the write)', () => {
    const p = defaultProgress()
    expect(confirmPendingPromotion(p)).toBe(p)
  })
})

describe('rows', () => {
  it('lists the seven rows in the web order', () => {
    expect(SETTINGS_ROWS.map((r) => r.id)).toEqual([
      'autoPromote',
      'sessionModePicker',
      'masteryThreshold-math',
      'masteryThreshold-word-song',
      'crossDayEnforcement',
      'showLevelToMarian',
      'crossVowelMixingEnabled',
    ])
  })

  it('names mastery rows by track', () => {
    expect(masteryRowId('math')).toBe('masteryThreshold-math')
    expect(masteryRowId('word-song')).toBe('masteryThreshold-word-song')
  })

  it('builds one-key patches', () => {
    expect(togglePatch('showLevelToMarian', false)).toEqual({
      showLevelToMarian: false,
    })
    expect(masteryPatch('word-song', { percent: 0.8, sessions: 2 })).toEqual({
      masteryThreshold: { 'word-song': { percent: 0.8, sessions: 2 } },
    })
  })

  it('offers session mode off | on', () => {
    expect(SESSION_MODE_OPTIONS).toEqual([
      { value: 'off', label: 'Off' },
      { value: 'on', label: 'On' },
    ])
  })
})

describe('mastery presets', () => {
  const VALUES: MasteryThreshold[] = [
    ...MASTERY_THRESHOLD_PRESETS,
    { percent: 0.9, sessions: 3 }, // the retired word-song default
    { percent: 0.95, sessions: 2 },
    { percent: 1, sessions: 1 },
  ]

  it('matches the web preset index for every value and track', () => {
    for (const track of ['math', 'word-song'] as const) {
      for (const v of VALUES) {
        expect(presetIndexFor(v, track)).toBe(webPresetIndex(v, track))
      }
    }
  })

  it('selects the exact preset, else the track default', () => {
    expect(presetIndexFor({ percent: 0.8, sessions: 2 }, 'math')).toBe(0)
    expect(presetIndexFor({ percent: 0.95, sessions: 3 }, 'math')).toBe(2)
    expect(presetIndexFor({ percent: 0.9, sessions: 3 }, 'word-song')).toBe(1)
  })

  it('labels and ids round the percent like the web', () => {
    expect(MASTERY_THRESHOLD_PRESETS.map(presetLabel)).toEqual([
      '80% / 2',
      '88% / 3',
      '95% / 3',
    ])
    expect(MASTERY_THRESHOLD_PRESETS.map(presetId)).toEqual([
      '80-2',
      '88-3',
      '95-3',
    ])
  })
})

// ── Backup JSON ─────────────────────────────────────────────────────────

const AT_ISO = '2026-10-11T12:00:00.000Z'

/** The web textarea's value (verbatim logic, pre-extraction). */
function webBackupJson(
  progress: Progress,
  loadSessionHistory: (() => SessionHistoryV2) | undefined,
  exportedAtISO: string,
): string {
  const safely = (read: () => SessionHistoryV2) => {
    try {
      return read()
    } catch {
      return null
    }
  }
  const sessionHistory = loadSessionHistory ? safely(loadSessionHistory) : null
  return JSON.stringify(
    {
      kind: 'marian-tutor.backup' as const,
      version: 1 as const,
      exportedAtISO,
      progress,
      sessionHistory,
    },
    null,
    2,
  )
}

describe('backup JSON', () => {
  const history = { ...emptySessionHistory(), sessionCount: 5 }
  const throwing = (): SessionHistoryV2 => {
    throw new Error('storage unavailable')
  }

  it('matches the web textarea for a reader, no reader and a throwing reader', () => {
    for (const read of [() => history, undefined, throwing]) {
      const sessionHistory = read ? safelyReadSessionHistory(read) : null
      expect(buildBackupJson(defaultProgress(), sessionHistory, AT_ISO)).toBe(
        webBackupJson(defaultProgress(), read, AT_ISO),
      )
    }
  })

  it('carries the versioned envelope, in key order', () => {
    const payload = buildBackupPayload(defaultProgress(), history, AT_ISO)
    expect(Object.keys(payload)).toEqual([
      'kind',
      'version',
      'exportedAtISO',
      'progress',
      'sessionHistory',
    ])
    expect(payload).toMatchObject({
      kind: 'marian-tutor.backup',
      version: 1,
      exportedAtISO: AT_ISO,
      sessionHistory: history,
    })
  })

  it('a throwing reader gives sessionHistory null', () => {
    expect(safelyReadSessionHistory(throwing)).toBeNull()
  })
})

// ── Restore outcome lines ───────────────────────────────────────────────

describe('restoreOutcomeMessage', () => {
  const OUTCOMES: ReconcileOutcome[] = [
    { kind: 'installed-from-cloud', progress: defaultProgress() },
    { kind: 'pushed-to-cloud' },
    { kind: 'noop', reason: 'no-cloud-record' },
    { kind: 'noop', reason: 'no-local-blob' },
    { kind: 'noop', reason: 'equal' },
    { kind: 'cloud-blob-rejected' },
    { kind: 'cloud-error', reason: 'timeout' },
  ]

  it('words every outcome as the web did', () => {
    expect(OUTCOMES.map(restoreOutcomeMessage)).toEqual([
      "Restored Marian's progress from that device.",
      "That device had older progress; this device's progress was kept.",
      'No progress found for that device ID.',
      "That device hasn't synced anything yet.",
      'Both devices have the same progress.',
      "That device's backup is in an unexpected format.",
      "Couldn't reach the server (timeout).",
    ])
  })
})
