/**
 * Parent Settings: the pure model both screens share (web
 * `src/screens/ParentSettings/ParentSettings.tsx`, native
 * `mobile/src/screens/parentSettings/`; `design/native/
 * parent-settings-native.md` § 8): the settings patch, the
 * pending-promotion confirm, the rows, the mastery presets, the backup
 * JSON and the restore outcome lines.
 *
 * Save-on-change: every control builds the next Progress here and the
 * screen writes it through at once; there is no save button. Pure: no
 * storage, no clock.
 */
import type { ReconcileOutcome } from '../progress/cloudSync'
import { applyMasteryRule } from '../progress/mastery'
import {
  DEFAULT_PARENT_SETTINGS,
  MASTERY_THRESHOLD_PRESETS,
  getSettings,
} from '../progress/parentSettings'
import type {
  MasteryThreshold,
  MasteryTrackKey,
  ParentSettings,
  Progress,
  SessionModePicker,
  SkillNode,
} from '../progress/types'
import type { SessionHistoryV2 } from '../sessionEnd/sessionHistory'

/**
 * Sparse patch for `applySettingsPatch`. `Partial<>` widens every
 * top-level field to optional, AND widens the nested `masteryThreshold`
 * so a single-track update doesn't have to supply both tracks.
 */
export type ParentSettingsPatch = Partial<
  Omit<ParentSettings, 'masteryThreshold'>
> & {
  masteryThreshold?: Partial<ParentSettings['masteryThreshold']>
}

/**
 * The Progress after one control change. Always merges OVER the fully
 * defaulted current settings (`getSettings`), so a sparse patch never
 * drops keys and the persisted shape is the full settings object. A
 * single-track `masteryThreshold` patch keeps the other track.
 */
export function applySettingsPatch(
  progress: Progress,
  patch: ParentSettingsPatch,
): Progress {
  const current = getSettings(progress)
  const next: ParentSettings = {
    ...current,
    ...patch,
    masteryThreshold: patch.masteryThreshold
      ? { ...current.masteryThreshold, ...patch.masteryThreshold }
      : current.masteryThreshold,
  }
  return { ...progress, parentSettings: next }
}

/**
 * The node the pending-promotion banner asks the parent to confirm, or
 * null when there is no banner. The engine only queues a promotion when
 * auto-promote is off; with it on, promotions apply silently and the
 * banner stays hidden.
 */
export function pendingPromotionToConfirm(
  progress: Progress,
): SkillNode | null {
  if (progress.pendingPromotion === undefined) return null
  if (getSettings(progress).autoPromote) return null
  return progress.pendingPromotion
}

/**
 * Confirm the queued `pendingPromotion` (M3 audit follow-up, ticket
 * 86c9kwnkw). Runs `applyMasteryRule()` on a temporarily
 * `autoPromote=true` view: the rule's auto-promote re-entry branch marks
 * the queued node `'mastered'`, unlocks the next node and clears the
 * field. The parent's real `autoPromote` is then restored (they confirmed
 * one promotion; they did not flip the toggle).
 *
 * Returns `progress` itself (same reference) when nothing is queued, so
 * the caller can skip the write.
 */
export function confirmPendingPromotion(progress: Progress): Progress {
  if (progress.pendingPromotion === undefined) return progress
  const trueAutoPromote: Progress = {
    ...progress,
    parentSettings: { ...getSettings(progress), autoPromote: true },
  }
  const promoted = applyMasteryRule(trueAutoPromote)
  return {
    ...promoted,
    parentSettings: {
      ...getSettings(promoted),
      autoPromote: getSettings(progress).autoPromote,
    },
  }
}

// ── Rows ────────────────────────────────────────────────────────────────

/** The boolean settings, each rendered as a switch row. */
export type ToggleSettingKey =
  | 'autoPromote'
  | 'crossDayEnforcement'
  | 'showLevelToMarian'
  | 'crossVowelMixingEnabled'

/** The row id of a track's mastery-threshold row. */
export type MasteryRowId = `masteryThreshold-${MasteryTrackKey}`

export type SettingsRowId =
  | ToggleSettingKey
  | 'sessionModePicker'
  | MasteryRowId

export type SettingsRow =
  | { kind: 'toggle'; id: ToggleSettingKey }
  | { kind: 'session-mode'; id: 'sessionModePicker' }
  | { kind: 'mastery'; id: MasteryRowId; track: MasteryTrackKey }

/** The rows, top to bottom (the web's documented order). */
export const SETTINGS_ROWS: readonly SettingsRow[] = [
  { kind: 'toggle', id: 'autoPromote' },
  { kind: 'session-mode', id: 'sessionModePicker' },
  { kind: 'mastery', id: 'masteryThreshold-math', track: 'math' },
  { kind: 'mastery', id: 'masteryThreshold-word-song', track: 'word-song' },
  { kind: 'toggle', id: 'crossDayEnforcement' },
  { kind: 'toggle', id: 'showLevelToMarian' },
  { kind: 'toggle', id: 'crossVowelMixingEnabled' },
]

export function masteryRowId(track: MasteryTrackKey): MasteryRowId {
  return `masteryThreshold-${track}`
}

/** The patch a switch row writes. */
export function togglePatch(
  key: ToggleSettingKey,
  value: boolean,
): ParentSettingsPatch {
  const patch: ParentSettingsPatch = {}
  patch[key] = value
  return patch
}

/** The patch a mastery row writes: its own track only. */
export function masteryPatch(
  track: MasteryTrackKey,
  value: MasteryThreshold,
): ParentSettingsPatch {
  const masteryThreshold: Partial<ParentSettings['masteryThreshold']> = {}
  masteryThreshold[track] = value
  return { masteryThreshold }
}

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export const SESSION_MODE_OPTIONS: readonly SegmentedOption<SessionModePicker>[] =
  [
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'On' },
  ]

// ── Mastery presets ─────────────────────────────────────────────────────

/**
 * The selected preset for a stored threshold: the preset it equals
 * exactly. If none match (a future schema shape that didn't reach the
 * UI), this track's default preset, so the control always has one
 * segment selected.
 */
export function presetIndexFor(
  value: MasteryThreshold,
  track: MasteryTrackKey,
): number {
  const idx = MASTERY_THRESHOLD_PRESETS.findIndex(
    (p) => p.percent === value.percent && p.sessions === value.sessions,
  )
  if (idx !== -1) return idx
  const fallback = DEFAULT_PARENT_SETTINGS.masteryThreshold[track]
  return MASTERY_THRESHOLD_PRESETS.findIndex(
    (p) => p.percent === fallback.percent && p.sessions === fallback.sessions,
  )
}

/** A preset's stable id, e.g. `95-3` (test ids). */
export function presetId(preset: MasteryThreshold): string {
  return `${Math.round(preset.percent * 100)}-${preset.sessions}`
}

/** A preset's segment label, e.g. `95% / 3`. */
export function presetLabel(preset: MasteryThreshold): string {
  return `${Math.round(preset.percent * 100)}% / ${preset.sessions}`
}

// ── Backup JSON ─────────────────────────────────────────────────────────
//
// The Backup section's JSON (ticket 86c9pkfth), the manual escape hatch a
// parent copies to a notes app. The wrapper is versioned separately from
// the inner `Progress.schemaVersion`: `kind` + `version` let a future
// restore-from-paste validate provenance before installing anything. Do
// not conflate `version: 1` here with `schemaVersion: 1` inside `progress`.

export const BACKUP_KIND = 'marian-tutor.backup' as const
export const BACKUP_VERSION = 1 as const

/** Key order is the JSON's key order. */
export interface BackupPayload {
  kind: typeof BACKUP_KIND
  version: typeof BACKUP_VERSION
  exportedAtISO: string
  progress: Progress
  sessionHistory: SessionHistoryV2 | null
}

/**
 * A session-history reader that throws (storage unavailable, a parse
 * failure below) must not take Parent Settings down: the backup still
 * builds, with `sessionHistory: null`.
 */
export function safelyReadSessionHistory(
  read: () => SessionHistoryV2,
): SessionHistoryV2 | null {
  try {
    return read()
  } catch {
    return null
  }
}

export function buildBackupPayload(
  progress: Progress,
  sessionHistory: SessionHistoryV2 | null,
  exportedAtISO: string,
): BackupPayload {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAtISO,
    progress,
    sessionHistory,
  }
}

/** The backup text the parent copies or shares: 2-space JSON. */
export function buildBackupJson(
  progress: Progress,
  sessionHistory: SessionHistoryV2 | null,
  exportedAtISO: string,
): string {
  return JSON.stringify(
    buildBackupPayload(progress, sessionHistory, exportedAtISO),
    null,
    2,
  )
}

// ── Restore outcome ─────────────────────────────────────────────────────

/** The status line a parent reads for each reconcile end-state. */
export function restoreOutcomeMessage(outcome: ReconcileOutcome): string {
  switch (outcome.kind) {
    case 'installed-from-cloud':
      return "Restored Marian's progress from that device."
    case 'pushed-to-cloud':
      // This device's progress was newer than the target's: say so, so
      // the parent doesn't think it silently worked.
      return "That device had older progress; this device's progress was kept."
    case 'noop':
      if (outcome.reason === 'no-cloud-record') {
        return 'No progress found for that device ID.'
      }
      if (outcome.reason === 'no-local-blob') {
        return "That device hasn't synced anything yet."
      }
      return 'Both devices have the same progress.'
    case 'cloud-blob-rejected':
      return "That device's backup is in an unexpected format."
    case 'cloud-error':
      return `Couldn't reach the server (${outcome.reason}).`
  }
}
