/**
 * Parent Settings: the settings model both screens share (web
 * `src/screens/ParentSettings/ParentSettings.tsx`, native
 * `mobile/src/screens/parentSettings/`).
 *
 * Save-on-change: every control builds the next Progress here and the
 * screen writes it through at once; there is no save button. Pure: no
 * storage, no clock.
 */
import { applyMasteryRule } from '../progress/mastery'
import { getSettings } from '../progress/parentSettings'
import type {
  MasteryThreshold,
  MasteryTrackKey,
  ParentSettings,
  Progress,
  SessionModePicker,
  SkillNode,
} from '../progress/types'

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
