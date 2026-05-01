/**
 * Parent-facing settings (M2.5 — ticket 86c9kpjc7).
 *
 * Five parent-tunable knobs that drive the adaptive engine's behaviour.
 * Defaults locked by Thomas on 2026-05-01 (see `Decisions (Thomas,
 * 2026-05-01)` in the adaptive-engine one-pager).
 *
 * Wiring contract
 * ---------------
 * `getSettings()` is the SINGLE read API every adaptive-engine rule
 * consults. Rules MUST NOT reach into `progress.parentSettings`
 * directly — the helper guarantees a fully-shaped result even when
 * the field is missing (old localStorage blobs predate this milestone)
 * or partially-shaped (the field was added later in a session).
 *
 * Storage shape
 * -------------
 * `parentSettings` is an OPTIONAL top-level field on `Progress`. The
 * field is ADDITIVE and BACKWARD-COMPATIBLE — old code reading a new
 * blob ignores it; new code reading an old blob fills the defaults via
 * the read path in `storage.ts`. Schema version stays at 1; there is
 * no migration step.
 *
 * Consumption
 * -----------
 * No code reads these settings yet — that work is M3 (mastery), M4
 * (Leitner / session mode), M5 (level visibility). This module only
 * makes the data + read API exist.
 */

import type { MasteryThreshold, ParentSettings, Progress } from './types'

/**
 * Three v1 mastery threshold presets. Exported so the ParentSettings
 * UI can render them as a segmented control without re-declaring the
 * constants. Order matters — UI renders left-to-right in this order.
 */
export const MASTERY_THRESHOLD_PRESETS: readonly MasteryThreshold[] = [
  { percent: 0.8, sessions: 2 },
  { percent: 0.9, sessions: 2 },
  { percent: 0.95, sessions: 3 },
] as const

/**
 * Default settings (Thomas-locked, 2026-05-01).
 *
 * Frozen so a runtime mutation can't quietly poison the source of
 * truth — `getSettings()` always merges loaded values OVER a fresh
 * copy, so this object is read-only by design.
 */
export const DEFAULT_PARENT_SETTINGS: ParentSettings = Object.freeze({
  autoPromote: true,
  sessionModePicker: 'off',
  masteryThreshold: Object.freeze({ percent: 0.95, sessions: 3 }),
  crossDayEnforcement: true,
  showLevelToMarian: false,
}) as ParentSettings

/**
 * Read the parent settings off a Progress document, filling defaults
 * for any missing fields.
 *
 * Returns a FRESH object every call — callers may mutate the result
 * without affecting the source-of-truth defaults.
 *
 * Contract:
 *  - `progress` is null/undefined → returns DEFAULT_PARENT_SETTINGS clone
 *  - `progress.parentSettings` is missing → returns DEFAULT clone
 *  - `progress.parentSettings` is present but partial → defaults fill
 *    every missing key (per-key, including the nested `masteryThreshold`)
 *  - `progress.parentSettings` is fully present → returns it shallow-cloned
 *    (with `masteryThreshold` cloned too)
 */
export function getSettings(
  progress: Progress | null | undefined,
): ParentSettings {
  const loaded = progress?.parentSettings
  if (!loaded) {
    return cloneDefaults()
  }
  return {
    autoPromote:
      typeof loaded.autoPromote === 'boolean'
        ? loaded.autoPromote
        : DEFAULT_PARENT_SETTINGS.autoPromote,
    sessionModePicker:
      loaded.sessionModePicker === 'on' || loaded.sessionModePicker === 'off'
        ? loaded.sessionModePicker
        : DEFAULT_PARENT_SETTINGS.sessionModePicker,
    masteryThreshold: mergeMasteryThreshold(loaded.masteryThreshold),
    crossDayEnforcement:
      typeof loaded.crossDayEnforcement === 'boolean'
        ? loaded.crossDayEnforcement
        : DEFAULT_PARENT_SETTINGS.crossDayEnforcement,
    showLevelToMarian:
      typeof loaded.showLevelToMarian === 'boolean'
        ? loaded.showLevelToMarian
        : DEFAULT_PARENT_SETTINGS.showLevelToMarian,
  }
}

// ── internals ──────────────────────────────────────────────────────────

function cloneDefaults(): ParentSettings {
  return {
    autoPromote: DEFAULT_PARENT_SETTINGS.autoPromote,
    sessionModePicker: DEFAULT_PARENT_SETTINGS.sessionModePicker,
    masteryThreshold: { ...DEFAULT_PARENT_SETTINGS.masteryThreshold },
    crossDayEnforcement: DEFAULT_PARENT_SETTINGS.crossDayEnforcement,
    showLevelToMarian: DEFAULT_PARENT_SETTINGS.showLevelToMarian,
  }
}

function mergeMasteryThreshold(loaded: unknown): MasteryThreshold {
  const base = { ...DEFAULT_PARENT_SETTINGS.masteryThreshold }
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
    return base
  }
  const obj = loaded as Record<string, unknown>
  return {
    percent:
      typeof obj.percent === 'number' &&
      Number.isFinite(obj.percent) &&
      obj.percent >= 0 &&
      obj.percent <= 1
        ? obj.percent
        : base.percent,
    sessions:
      typeof obj.sessions === 'number' &&
      Number.isInteger(obj.sessions) &&
      obj.sessions > 0
        ? obj.sessions
        : base.sessions,
  }
}
