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
 * Updated 2026-10-05 (ticket 123jpnbc3dm, Emma's Path decision 1): the
 * middle preset is the new default for both tracks, 7/8 on 3 good days
 * (was 90/3). The strict 95/3 preset stays for a parent who wants it.
 */
export const MASTERY_THRESHOLD_PRESETS: readonly MasteryThreshold[] = [
  { percent: 0.8, sessions: 2 },
  { percent: 0.875, sessions: 3 }, // default, both tracks
  { percent: 0.95, sessions: 3 },
] as const

/**
 * Per-track default mastery thresholds. Pulled out so backward-compat
 * code below can fall back per-track.
 *
 * Both tracks: 0.875/3 — a step is mastered after 3 separate days at
 * 7/8 or better, in any order (Emma's Path decision 1, Thomas
 * 2026-10-04; ticket 123jpnbc3dm). Replaces the 2026-05-02 per-track
 * defaults (math 95/3, word-song 90/3), which with 8-problem sessions
 * meant three 8/8 days where one 7/8 reset the run.
 */
const DEFAULT_PER_TRACK_THRESHOLD: PerTrackMasteryThreshold = Object.freeze({
  math: Object.freeze({ percent: 0.875, sessions: 3 }),
  'word-song': Object.freeze({ percent: 0.875, sessions: 3 }),
}) as PerTrackMasteryThreshold

/**
 * The per-track defaults before ticket 123jpnbc3dm. The Parent Settings
 * screen persists the FULL settings object whenever any control
 * changes, so a device can carry these old defaults explicitly without
 * a parent ever choosing them. `retireLegacyMasteryThreshold` maps a
 * stored track value exactly equal to its old default to the new
 * default; any other stored value is the parent's deliberate choice and
 * is kept (coordinator decision 2026-10-05, on Thomas's decision 1).
 */
const LEGACY_DEFAULT_PER_TRACK_THRESHOLD: PerTrackMasteryThreshold =
  Object.freeze({
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
  showLevelToMarian: true,
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

/**
 * One-time migration of a STORED `parentSettings.masteryThreshold` value
 * (raw, pre-merge) written before ticket 123jpnbc3dm: a track value
 * exactly equal to that track's old default (math 95/3, word-song 90/3)
 * becomes the new default; the legacy single shape's own default (95/3)
 * becomes the new per-track defaults. Anything else — including
 * malformed input, which `getSettings` handles — passes through.
 *
 * Deliberately NOT applied inside `getSettings`: it would also undo a
 * parent's deliberate post-ticket choice of 95/3 on every read. The
 * storage / cloud-install read paths call it only for blobs that
 * predate the good-day counter (`goodDays` absent), i.e. exactly once.
 */
export function retireLegacyMasteryThreshold(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const obj = raw as Record<string, unknown>
  const matches = (v: unknown, legacy: MasteryThreshold): boolean =>
    !!v &&
    typeof v === 'object' &&
    (v as Record<string, unknown>).percent === legacy.percent &&
    (v as Record<string, unknown>).sessions === legacy.sessions

  if ('math' in obj || 'word-song' in obj) {
    const out: Record<string, unknown> = { ...obj }
    let changed = false
    for (const track of ['math', 'word-song'] as const) {
      if (matches(obj[track], LEGACY_DEFAULT_PER_TRACK_THRESHOLD[track])) {
        out[track] = { ...DEFAULT_PER_TRACK_THRESHOLD[track] }
        changed = true
      }
    }
    return changed ? out : raw
  }
  if (matches(obj, LEGACY_DEFAULT_PER_TRACK_THRESHOLD.math)) {
    return clonePerTrackDefaults()
  }
  return raw
}

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
  // arbitrary but harmless (both tracks share one default today).
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
