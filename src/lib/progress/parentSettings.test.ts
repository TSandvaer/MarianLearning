/**
 * parentSettings tests (M2.5 — ticket 86c9kpjc7).
 *
 * Covers:
 *  - DEFAULT_PARENT_SETTINGS shape and Thomas-locked values
 *  - getSettings() with null / undefined / missing-field / partial-shape
 *  - loadProgress() defaults injection on a v1 blob without parentSettings
 *  - saveProgress() round-trip — write/load preserves the field deep-equal
 *  - clearProgress() removes the entire blob (single-key storage)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PARENT_SETTINGS,
  MASTERY_THRESHOLD_PRESETS,
  STORAGE_KEY,
  clearProgress,
  defaultProgress,
  getSettings,
  loadProgress,
  saveProgress,
} from './index'
import type { ParentSettings, Progress } from './types'

describe('DEFAULT_PARENT_SETTINGS', () => {
  it('matches the Thomas-locked 2026-05-01 values', () => {
    expect(DEFAULT_PARENT_SETTINGS).toEqual({
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: { percent: 0.95, sessions: 3 },
      crossDayEnforcement: true,
      showLevelToMarian: false,
    })
  })

  it('exposes the three v1 mastery threshold presets in left-to-right order', () => {
    expect(MASTERY_THRESHOLD_PRESETS).toEqual([
      { percent: 0.8, sessions: 2 },
      { percent: 0.9, sessions: 2 },
      { percent: 0.95, sessions: 3 },
    ])
  })
})

describe('getSettings', () => {
  it('returns defaults when progress is null', () => {
    expect(getSettings(null)).toEqual(DEFAULT_PARENT_SETTINGS)
  })

  it('returns defaults when progress is undefined', () => {
    expect(getSettings(undefined)).toEqual(DEFAULT_PARENT_SETTINGS)
  })

  it('returns defaults when parentSettings is missing on the document', () => {
    const p = { ...defaultProgress() } as Progress
    delete p.parentSettings
    expect(getSettings(p)).toEqual(DEFAULT_PARENT_SETTINGS)
  })

  it('returns the loaded value when parentSettings is fully present', () => {
    const custom: ParentSettings = {
      autoPromote: false,
      sessionModePicker: 'on',
      masteryThreshold: { percent: 0.8, sessions: 2 },
      crossDayEnforcement: false,
      showLevelToMarian: true,
    }
    const p: Progress = { ...defaultProgress(), parentSettings: custom }
    expect(getSettings(p)).toEqual(custom)
  })

  it('returns a fresh object — mutating the result does not poison defaults', () => {
    const a = getSettings(undefined)
    a.autoPromote = false
    a.masteryThreshold.percent = 0.5
    const b = getSettings(undefined)
    // Defaults must remain intact for the next reader.
    expect(b.autoPromote).toBe(true)
    expect(b.masteryThreshold.percent).toBe(0.95)
  })

  it('fills missing top-level keys from defaults (partial merge)', () => {
    const partial = {
      ...defaultProgress(),
      // Only sessionModePicker provided; the rest must default.
      parentSettings: { sessionModePicker: 'on' } as Partial<ParentSettings>,
    } as Progress
    const result = getSettings(partial)
    expect(result.sessionModePicker).toBe('on')
    expect(result.autoPromote).toBe(true)
    expect(result.crossDayEnforcement).toBe(true)
    expect(result.showLevelToMarian).toBe(false)
    expect(result.masteryThreshold).toEqual({ percent: 0.95, sessions: 3 })
  })

  it('fills missing nested masteryThreshold keys per-key', () => {
    const partial: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: { percent: 0.8 } as never, // missing sessions
      },
    }
    const result = getSettings(partial)
    expect(result.masteryThreshold.percent).toBe(0.8)
    // Falls back to the default sessions count.
    expect(result.masteryThreshold.sessions).toBe(3)
  })

  it('rejects out-of-range percent values and falls back to default', () => {
    const bad: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: { percent: 2.5, sessions: 3 }, // > 1
      },
    }
    expect(getSettings(bad).masteryThreshold.percent).toBe(0.95)
  })

  it('rejects non-positive / non-integer sessions and falls back to default', () => {
    const zero: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: { percent: 0.9, sessions: 0 },
      },
    }
    const fractional: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: { percent: 0.9, sessions: 2.5 },
      },
    }
    expect(getSettings(zero).masteryThreshold.sessions).toBe(3)
    expect(getSettings(fractional).masteryThreshold.sessions).toBe(3)
  })

  it('rejects an unrecognised sessionModePicker and falls back to "off"', () => {
    const weird: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        sessionModePicker: 'maybe' as never,
      },
    }
    expect(getSettings(weird).sessionModePicker).toBe('off')
  })
})

describe('loadProgress + parentSettings', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  it('injects DEFAULT_PARENT_SETTINGS when the stored blob omits the field', () => {
    const seed = defaultProgress()
    // Strip parentSettings to simulate a pre-M2.5 blob.
    const { parentSettings: _drop, ...preM2_5 } = seed
    void _drop
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preM2_5))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.parentSettings).toEqual(DEFAULT_PARENT_SETTINGS)
  })

  it('preserves the stored parentSettings when present', () => {
    const custom: ParentSettings = {
      autoPromote: false,
      sessionModePicker: 'on',
      masteryThreshold: { percent: 0.8, sessions: 2 },
      crossDayEnforcement: false,
      showLevelToMarian: true,
    }
    const p: Progress = { ...defaultProgress(), parentSettings: custom }
    saveProgress(p)
    const loaded = loadProgress()
    expect(loaded?.parentSettings).toEqual(custom)
  })

  it('round-trips parentSettings deep-equal through save/load', () => {
    const start = defaultProgress()
    saveProgress(start)
    const loaded = loadProgress()
    // Round-trip is deep-equal because defaultProgress() seeds a fully-
    // shaped parentSettings, so withDefaultedSettings is a no-op.
    expect(loaded).toEqual(start)
  })

  it('rejects a stored blob whose parentSettings is malformed', () => {
    // schema-shaped doc but with an invalid sessionModePicker → fail.
    const bad = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        sessionModePicker: 'maybe',
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bad))
    expect(loadProgress()).toBeNull()
  })
})

describe('clearProgress', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('removes parentSettings along with the rest of the document', () => {
    saveProgress(defaultProgress())
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    clearProgress()
    // Single-key storage — verify there's no orphaned parentSettings
    // hiding under a sibling key.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(window.localStorage.length).toBe(0)
  })
})
