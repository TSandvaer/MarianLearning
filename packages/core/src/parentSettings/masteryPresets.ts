/**
 * Parent Settings: the mastery-threshold segmented control's mapping
 * between a stored threshold and the three presets
 * (`MASTERY_THRESHOLD_PRESETS`). Shared by the web and native screens.
 */
import {
  DEFAULT_PARENT_SETTINGS,
  MASTERY_THRESHOLD_PRESETS,
} from '../progress/parentSettings'
import type { MasteryThreshold, MasteryTrackKey } from '../progress/types'

/**
 * The selected preset for a stored threshold: the preset it equals
 * exactly. If none match (a future schema shape that didn't reach the
 * UI), this track's default preset, so the control always has one
 * segment selected.
 */
export function masteryPresetIndex(
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
export function masteryPresetId(preset: MasteryThreshold): string {
  return `${Math.round(preset.percent * 100)}-${preset.sessions}`
}

/** A preset's segment label, e.g. `95% / 3`. */
export function masteryPresetLabel(preset: MasteryThreshold): string {
  return `${Math.round(preset.percent * 100)}% / ${preset.sessions}`
}
