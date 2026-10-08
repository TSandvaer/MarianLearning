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
import { retireLegacyMasteryThreshold } from './parentSettings'
import type { ParentSettings, Progress } from './types'

describe('DEFAULT_PARENT_SETTINGS', () => {
  it("matches the Emma's Path decision-1 thresholds (7/8 on 3 good days, ticket 123jpnbc3dm) + 2026-05-09 cross-vowel mix lock (ticket 86c9qa0kf)", () => {
    expect(DEFAULT_PARENT_SETTINGS).toEqual({
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: {
        math: { percent: 0.875, sessions: 3 },
        'word-song': { percent: 0.875, sessions: 3 },
      },
      crossDayEnforcement: true,
      // Emma's Path 7/10 (ticket 123jpnbc3dq): land number shown by default.
      showLevelToMarian: true,
      crossVowelMixingEnabled: true,
    })
  })

  it('exposes the three v1 mastery threshold presets in left-to-right order', () => {
    // Updated 2026-10-05 (ticket 123jpnbc3dm): the middle preset is the
    // new 7/8-on-3-days default for both tracks.
    expect(MASTERY_THRESHOLD_PRESETS).toEqual([
      { percent: 0.8, sessions: 2 },
      { percent: 0.875, sessions: 3 },
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
      masteryThreshold: {
        math: { percent: 0.8, sessions: 2 },
        'word-song': { percent: 0.8, sessions: 2 },
      },
      crossDayEnforcement: false,
      showLevelToMarian: true,
      crossVowelMixingEnabled: false,
    }
    const p: Progress = { ...defaultProgress(), parentSettings: custom }
    expect(getSettings(p)).toEqual(custom)
  })

  it('returns a fresh object — mutating the result does not poison defaults', () => {
    const a = getSettings(undefined)
    a.autoPromote = false
    a.masteryThreshold.math.percent = 0.5
    a.masteryThreshold['word-song'].percent = 0.5
    const b = getSettings(undefined)
    // Defaults must remain intact for the next reader.
    expect(b.autoPromote).toBe(true)
    expect(b.masteryThreshold.math.percent).toBe(0.875)
    expect(b.masteryThreshold['word-song'].percent).toBe(0.875)
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
    expect(result.showLevelToMarian).toBe(true)
    // Ticket 86c9qa0kf — cross-vowel default is `true` when missing.
    expect(result.crossVowelMixingEnabled).toBe(true)
    expect(result.masteryThreshold).toEqual({
      math: { percent: 0.875, sessions: 3 },
      'word-song': { percent: 0.875, sessions: 3 },
    })
  })

  it('fills missing nested masteryThreshold keys per-key (per track)', () => {
    const partial: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: {
          math: { percent: 0.8 } as never, // missing sessions
          'word-song': { percent: 0.85 } as never, // missing sessions
        },
      },
    }
    const result = getSettings(partial)
    expect(result.masteryThreshold.math.percent).toBe(0.8)
    expect(result.masteryThreshold['word-song'].percent).toBe(0.85)
    // Falls back to the per-track default sessions count (both 3).
    expect(result.masteryThreshold.math.sessions).toBe(3)
    expect(result.masteryThreshold['word-song'].sessions).toBe(3)
  })

  it('fills a missing track from the per-track default', () => {
    // Only math present in the persisted blob — word-song defaults.
    const partial: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
        } as never,
      },
    }
    const result = getSettings(partial)
    expect(result.masteryThreshold.math).toEqual({ percent: 0.8, sessions: 2 })
    expect(result.masteryThreshold['word-song']).toEqual({
      percent: 0.875,
      sessions: 3,
    })
  })

  it('rejects out-of-range percent values and falls back to per-track default (math)', () => {
    const bad: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: {
          math: { percent: 2.5, sessions: 3 }, // > 1
          'word-song': { percent: 0.9, sessions: 3 },
        },
      },
    }
    expect(getSettings(bad).masteryThreshold.math.percent).toBe(0.875)
  })

  it('rejects non-positive / non-integer sessions and falls back to per-track default', () => {
    const zero: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: {
          math: { percent: 0.95, sessions: 3 },
          'word-song': { percent: 0.9, sessions: 0 },
        },
      },
    }
    const fractional: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: {
          math: { percent: 0.95, sessions: 3 },
          'word-song': { percent: 0.9, sessions: 2.5 },
        },
      },
    }
    expect(getSettings(zero).masteryThreshold['word-song'].sessions).toBe(3)
    expect(getSettings(fractional).masteryThreshold['word-song'].sessions).toBe(
      3,
    )
  })

  // ── Backward-compat: old single-shape blob ─────────────────────────────
  //
  // Pre-2026-05-02 (pre-ticket 86c9kwvy0) blobs persisted
  // `masteryThreshold` as a single { percent, sessions } pair. The new
  // code expects per-track. `getSettings()` must accept the legacy shape
  // and apply the SAME single value to BOTH tracks — this preserves the
  // parent's prior intent (they had picked one number; until they tune
  // the per-track controls, give them that number on both).
  it('reads an old single-shape masteryThreshold and applies it to both tracks', () => {
    const legacy: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        // Cast through `unknown` because the new type rejects the old
        // shape — this test exists precisely to guard the read path.
        masteryThreshold: { percent: 0.8, sessions: 2 } as unknown as never,
      },
    }
    const result = getSettings(legacy)
    expect(result.masteryThreshold.math).toEqual({ percent: 0.8, sessions: 2 })
    expect(result.masteryThreshold['word-song']).toEqual({
      percent: 0.8,
      sessions: 2,
    })
  })

  it('reads a malformed single-shape and falls back to per-track defaults', () => {
    // Old single-shape with garbage values → the legacy validator
    // would have fallen back per-key on each. Apply the resulting
    // single value to both tracks.
    const bogus: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: {
          percent: 99,
          sessions: -5,
        } as unknown as never,
      },
    }
    const result = getSettings(bogus)
    // Both percent (>1) and sessions (<=0) reject; legacy fallback uses
    // the math default (now 0.875/3) as the per-key base. That value is
    // then applied to BOTH tracks (legacy intent preservation).
    expect(result.masteryThreshold.math).toEqual({
      percent: 0.875,
      sessions: 3,
    })
    expect(result.masteryThreshold['word-song']).toEqual({
      percent: 0.875,
      sessions: 3,
    })
  })

  it('reads a completely-malformed masteryThreshold and falls back to per-track defaults', () => {
    const bogus: Progress = {
      ...defaultProgress(),
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: 'not-a-threshold' as unknown as never,
      },
    }
    const result = getSettings(bogus)
    expect(result.masteryThreshold).toEqual({
      math: { percent: 0.875, sessions: 3 },
      'word-song': { percent: 0.875, sessions: 3 },
    })
  })

  // ── Ticket 123jpnbc3dm: retire the stored pre-decision-1 defaults ──────
  //
  // The Parent Settings screen persists the FULL settings object on any
  // change, so a device can carry the old defaults (math 95/3, word-song
  // 90/3) without a parent ever picking them. Those exact values retire
  // to the new 7/8-on-3-days default ONCE, on the first load of a blob
  // that predates the good-day counter; anything else is a deliberate
  // choice. `getSettings` itself never retires, so a parent who picks
  // 95/3 after this ticket keeps it.
  describe('legacy default retirement (ticket 123jpnbc3dm)', () => {
    it('retireLegacyMasteryThreshold maps exact old per-track defaults to the new default', () => {
      expect(
        retireLegacyMasteryThreshold({
          math: { percent: 0.95, sessions: 3 },
          'word-song': { percent: 0.9, sessions: 3 },
        }),
      ).toEqual({
        math: { percent: 0.875, sessions: 3 },
        'word-song': { percent: 0.875, sessions: 3 },
      })
    })

    it('keeps custom values and near-misses (only exact per-track matches retire)', () => {
      const custom = {
        math: { percent: 0.8, sessions: 2 },
        // 95/3 was the MATH default, never word-song's.
        'word-song': { percent: 0.95, sessions: 3 },
      }
      expect(retireLegacyMasteryThreshold(custom)).toBe(custom)
      const nearMiss = {
        math: { percent: 0.95, sessions: 2 },
        'word-song': { percent: 0.9, sessions: 4 },
      }
      expect(retireLegacyMasteryThreshold(nearMiss)).toBe(nearMiss)
    })

    it('retires the old single-shape default (95/3) to the per-track defaults', () => {
      expect(
        retireLegacyMasteryThreshold({ percent: 0.95, sessions: 3 }),
      ).toEqual({
        math: { percent: 0.875, sessions: 3 },
        'word-song': { percent: 0.875, sessions: 3 },
      })
      const custom = { percent: 0.8, sessions: 2 }
      expect(retireLegacyMasteryThreshold(custom)).toBe(custom)
    })

    it('passes malformed input through for getSettings to default', () => {
      expect(retireLegacyMasteryThreshold('x')).toBe('x')
      expect(retireLegacyMasteryThreshold(null)).toBe(null)
    })

    it('getSettings does NOT retire — a deliberate 95/3 choice is kept', () => {
      const p: Progress = {
        ...defaultProgress(),
        parentSettings: {
          ...DEFAULT_PARENT_SETTINGS,
          masteryThreshold: {
            math: { percent: 0.95, sessions: 3 },
            'word-song': { percent: 0.9, sessions: 3 },
          },
        },
      }
      expect(getSettings(p).masteryThreshold).toEqual({
        math: { percent: 0.95, sessions: 3 },
        'word-song': { percent: 0.9, sessions: 3 },
      })
    })
  })

  // Ticket 86c9qa0kf — cross-vowel mix default-ON + defaulter coverage.
  describe('crossVowelMixingEnabled (ticket 86c9qa0kf)', () => {
    it('defaults to `true` when the field is missing on the loaded blob', () => {
      const partial = {
        ...defaultProgress(),
        parentSettings: {
          ...DEFAULT_PARENT_SETTINGS,
          // Spread strips undefined; force-delete to simulate an old
          // blob that never carried the field.
        } as ParentSettings,
      } as Progress
      // Directly manipulate to remove the key.
      delete (partial.parentSettings as Partial<ParentSettings>)
        .crossVowelMixingEnabled
      expect(getSettings(partial).crossVowelMixingEnabled).toBe(true)
    })

    it('preserves an explicit `false` value (parent-toggled-off)', () => {
      const off: Progress = {
        ...defaultProgress(),
        parentSettings: {
          ...DEFAULT_PARENT_SETTINGS,
          crossVowelMixingEnabled: false,
        },
      }
      expect(getSettings(off).crossVowelMixingEnabled).toBe(false)
    })

    it('preserves an explicit `true` value', () => {
      const on: Progress = {
        ...defaultProgress(),
        parentSettings: {
          ...DEFAULT_PARENT_SETTINGS,
          crossVowelMixingEnabled: true,
        },
      }
      expect(getSettings(on).crossVowelMixingEnabled).toBe(true)
    })

    it('falls back to default `true` when the field is non-boolean garbage', () => {
      const bad: Progress = {
        ...defaultProgress(),
        parentSettings: {
          ...DEFAULT_PARENT_SETTINGS,
          crossVowelMixingEnabled: 'yes' as unknown as boolean,
        },
      }
      expect(getSettings(bad).crossVowelMixingEnabled).toBe(true)
    })
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
      masteryThreshold: {
        math: { percent: 0.8, sessions: 2 },
        'word-song': { percent: 0.8, sessions: 2 },
      },
      crossDayEnforcement: false,
      showLevelToMarian: true,
      crossVowelMixingEnabled: false,
    }
    const p: Progress = { ...defaultProgress(), parentSettings: custom }
    saveProgress(p)
    const loaded = loadProgress()
    expect(loaded?.parentSettings).toEqual(custom)
  })

  // ── Backward-compat at the storage layer ───────────────────────────────
  //
  // A legacy blob persisted under the OLD single-shape masteryThreshold
  // must round-trip cleanly through `loadProgress()`. The guard accepts
  // the old shape; the storage layer's `withDefaultedSettings` runs
  // `getSettings()` which promotes the single value to per-track.
  it('reads a legacy persisted blob with single-shape masteryThreshold and yields per-track', () => {
    const seed = defaultProgress()
    // Manually construct the legacy shape — TypeScript types disallow
    // it, so go through `unknown` for the persisted blob.
    const legacyBlob = {
      ...seed,
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: { percent: 0.95, sessions: 3 },
      },
    } as unknown as Progress
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyBlob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    // The legacy single value lands on BOTH tracks (per the
    // intent-preservation choice documented in `mergePerTrackMasteryThreshold`).
    // The blob already carries the good-day counter (defaultProgress
    // seeds it), so the one-time 123jpnbc3dm retirement does not run.
    expect(loaded?.parentSettings?.masteryThreshold).toEqual({
      math: { percent: 0.95, sessions: 3 },
      'word-song': { percent: 0.95, sessions: 3 },
    })
  })

  it('pre-counter blob: stored old defaults retire once on load; the next save keeps a later 95/3 choice (ticket 123jpnbc3dm)', () => {
    const seed = defaultProgress()
    const preCounter: Record<string, unknown> = {
      ...seed,
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: {
          math: { percent: 0.95, sessions: 3 },
          'word-song': { percent: 0.9, sessions: 3 },
        },
      },
    }
    delete preCounter.goodDays
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preCounter))

    const first = loadProgress()
    expect(first?.parentSettings?.masteryThreshold).toEqual({
      math: { percent: 0.875, sessions: 3 },
      'word-song': { percent: 0.875, sessions: 3 },
    })
    expect(first?.goodDays).toEqual({})

    // The parent now deliberately picks 95/3 for math and it is saved.
    saveProgress({
      ...first!,
      parentSettings: {
        ...first!.parentSettings!,
        masteryThreshold: {
          ...first!.parentSettings!.masteryThreshold,
          math: { percent: 0.95, sessions: 3 },
        },
      },
    })
    expect(loadProgress()?.parentSettings?.masteryThreshold.math).toEqual({
      percent: 0.95,
      sessions: 3,
    })
  })

  it('pre-counter single-shape 95/3 blob retires to the per-track defaults (ticket 123jpnbc3dm)', () => {
    const seed = defaultProgress()
    const preCounter: Record<string, unknown> = {
      ...seed,
      parentSettings: {
        ...DEFAULT_PARENT_SETTINGS,
        masteryThreshold: { percent: 0.95, sessions: 3 },
      },
    }
    delete preCounter.goodDays
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preCounter))
    expect(loadProgress()?.parentSettings?.masteryThreshold).toEqual({
      math: { percent: 0.875, sessions: 3 },
      'word-song': { percent: 0.875, sessions: 3 },
    })
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
