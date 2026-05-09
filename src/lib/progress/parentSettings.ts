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

import type {
  MasteryThreshold,
  ParentSettings,
  PerTrackMasteryThreshold,
  Progress,
} from './types'

/**
 * Three v1 mastery threshold presets. Exported so the ParentSettings
 * UI can render them as a segmented control without re-declaring the
 * constants. Order matters — UI renders left-to-right in this order.
 *
 * Updated 2026-05-02 (ticket 86c9kwvy0): the middle preset is now 90/3
 * (was 90/2). This pairs with the per-track defaults — word-song
 * defaults to 90/3, math defaults to 95/3 — so the parent has both
 * defaults available as presets without inventing a fourth.
 */
export const MASTERY_THRESHOLD_PRESETS: readonly MasteryThreshold[] = [
  { percent: 0.8, sessions: 2 },
  { percent: 0.9, sessions: 3 }, // word-song default
  { percent: 0.95, sessions: 3 }, // math default
] as const

/**
 * Per-track default mastery thresholds (Thomas-locked, 2026-05-02).
 * Pulled out so backward-compat code below can fall back per-track.
 *
 * Math: 95/3 (over-practice durability hypothesis, see types.ts).
 * Word-song: 90/3 (Pickering et al. PMC5843573 — 90% over-learning is
 * the durable plateau; 95% adds practice time without measurable
 * benefit and Marian's August timeline can't afford the slack).
 */
const DEFAULT_PER_TRACK_THRESHOLD: PerTrackMasteryThreshold = Object.freeze({
  math: Object.freeze({ percent: 0.95, sessions: 3 }),
  'word-song': Object.freeze({ percent: 0.9, sessions: 3 }),
}) as PerTrackMasteryThreshold

/**
 * Default settings (Thomas-locked, 2026-05-02 update for per-track
 * thresholds; 2026-05-01 originals for the rest).
 *
 * Frozen so a runtime mutation can't quietly poison the source of
 * truth — `getSettings()` always merges loaded values OVER a fresh
 * copy, so this object is read-only by design.
 */
export const DEFAULT_PARENT_SETTINGS: ParentSettings = Object.freeze({
  autoPromote: true,
  sessionModePicker: 'off',
  masteryThreshold: DEFAULT_PER_TRACK_THRESHOLD,
  crossDayEnforcement: true,
  showLevelToMarian: false,
  // Ticket 86c9qa0kf — cross-vowel distractor mix v1. Default ON per
  // spec §10 Q1 lock 2026-05-09 + Dave's research (PR #175) §4.4: the
  // per-aggregate mastery gate (all three CVC tiers `'mastered'`)
  // already encodes "she's ready for harder discrimination work" —
  // a default-OFF setting would require Thomas to flip a hidden toggle
  // to unlock the pedagogically appropriate next step. Reversible —
  // if Marian struggles, the parent flips this to `false`.
  crossVowelMixingEnabled: true,
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
    masteryThreshold: mergePerTrackMasteryThreshold(loaded.masteryThreshold),
    crossDayEnforcement:
      typeof loaded.crossDayEnforcement === 'boolean'
        ? loaded.crossDayEnforcement
        : DEFAULT_PARENT_SETTINGS.crossDayEnforcement,
    showLevelToMarian:
      typeof loaded.showLevelToMarian === 'boolean'
        ? loaded.showLevelToMarian
        : DEFAULT_PARENT_SETTINGS.showLevelToMarian,
    // Ticket 86c9qa0kf — additive optional field, defaults to `true`
    // when missing (old blobs) or non-boolean (malformed). Mirrors
    // the autoPromote / crossDayEnforcement defaulter pattern.
    crossVowelMixingEnabled:
      typeof loaded.crossVowelMixingEnabled === 'boolean'
        ? loaded.crossVowelMixingEnabled
        : DEFAULT_PARENT_SETTINGS.crossVowelMixingEnabled,
  }
}

// ── internals ──────────────────────────────────────────────────────────

function cloneDefaults(): ParentSettings {
  return {
    autoPromote: DEFAULT_PARENT_SETTINGS.autoPromote,
    sessionModePicker: DEFAULT_PARENT_SETTINGS.sessionModePicker,
    masteryThreshold: clonePerTrackDefaults(),
    crossDayEnforcement: DEFAULT_PARENT_SETTINGS.crossDayEnforcement,
    showLevelToMarian: DEFAULT_PARENT_SETTINGS.showLevelToMarian,
    crossVowelMixingEnabled: DEFAULT_PARENT_SETTINGS.crossVowelMixingEnabled,
  }
}

function clonePerTrackDefaults(): PerTrackMasteryThreshold {
  return {
    math: { ...DEFAULT_PER_TRACK_THRESHOLD.math },
    'word-song': { ...DEFAULT_PER_TRACK_THRESHOLD['word-song'] },
  }
}

/**
 * Merge a loaded `masteryThreshold` value into the per-track shape,
 * filling defaults where needed.
 *
 * Three input shapes are accepted (in priority order):
 *
 *  1. **New per-track shape** — `{ math, 'word-song' }`. Each track's
 *     value is shape-validated and per-key defaulted via
 *     `mergeSingleMasteryThreshold`. Missing tracks default. This is
 *     what fresh writes produce.
 *
 *  2. **Old single shape** — `{ percent, sessions }`. Pre-2026-05-02
 *     blobs (and pre-86c9kwvy0 fresh writes) used a single threshold
 *     for both tracks. We **apply that single shape to BOTH tracks**.
 *     This preserves the parent's prior intent: they had picked one
 *     number; until they actively tune the per-track controls, give
 *     them that number on both. The alternative (always reset to
 *     per-track defaults) would silently move a parent who explicitly
 *     chose 80/2 back up to 95/3 / 90/3 — surprise.
 *
 *  3. **Malformed / null / wrong type** — fall back to per-track
 *     defaults entirely.
 */
function mergePerTrackMasteryThreshold(
  loaded: unknown,
): PerTrackMasteryThreshold {
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
    return clonePerTrackDefaults()
  }
  const obj = loaded as Record<string, unknown>

  // Shape 1: new per-track shape (either key present is enough to
  // route here; missing tracks default per-key).
  if ('math' in obj || 'word-song' in obj) {
    return {
      math: mergeSingleMasteryThreshold(
        obj.math,
        DEFAULT_PER_TRACK_THRESHOLD.math,
      ),
      'word-song': mergeSingleMasteryThreshold(
        obj['word-song'],
        DEFAULT_PER_TRACK_THRESHOLD['word-song'],
      ),
    }
  }

  // Shape 2: old single shape. Validate it like the legacy code did,
  // then apply the SAME validated value to both tracks. The legacy
  // validator also fell back per-key on out-of-range / wrong-type
  // input — using the math default here as the fallback base is
  // arbitrary but harmless; the legacy code also defaulted to a
  // single hard-coded value (95/3) and the math default matches that.
  if ('percent' in obj || 'sessions' in obj) {
    const single = mergeSingleMasteryThreshold(
      obj,
      DEFAULT_PER_TRACK_THRESHOLD.math,
    )
    return { math: { ...single }, 'word-song': { ...single } }
  }

  // Shape 3: empty / malformed object — defaults.
  return clonePerTrackDefaults()
}

function mergeSingleMasteryThreshold(
  loaded: unknown,
  base: MasteryThreshold,
): MasteryThreshold {
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
    return { ...base }
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
