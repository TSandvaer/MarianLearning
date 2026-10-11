/**
 * Native Parent Settings' copy departures from the web
 * (`design/native/parent-settings-native.md` § 7). Every other string is
 * the web's, from `@marian/core/parentSettings/copy`. The web keeps its
 * own strings (UI freeze), so these stay native.
 */
import { presetLabel } from '@marian/core/parentSettings/parentSettingsModel'
import type { ParentSettings } from '@marian/core/progress'

export const NATIVE_COPY = {
  /**
   * Both threshold rows. Core counts good days (or good sessions with
   * fresh-day mastery off) in any order; the web's "in-a-row" is wrong.
   */
  masteryDescription:
    "How many sessions at this success rate Marian needs before a skill counts as mastered. They don't have to be in a row.",
  share: 'Share…',
  /** The web's line points at the textarea, which native doesn't have. */
  copyFailedUseShare: "Couldn't copy — use Share instead.",
  shareFailed: "Couldn't share.",
  /** Share sheet title (Android) and mail subject (iOS). */
  shareTitle: 'Marian Tutor backup',
  ownDeviceId: "That's this device's own ID.",
  restoreAlertTitle: 'Restore from that device?',
  restoreAlertMessage:
    'This device will use that ID from now on. The newer progress of the two devices is kept, and the older one is replaced.',
  cancel: 'Cancel',
} as const

const onOff = (v: boolean) => (v ? 'on' : 'off')

/**
 * The defaults footnote, generated from the settings it describes (the
 * web hardcodes stale values). With `DEFAULT_PARENT_SETTINGS` it reads:
 * "Defaults: auto-promote on, fresh-day mastery on, math threshold 88% / 3
 * sessions, word-song threshold 88% / 3 sessions, level shown, mode picker
 * off, cross-vowel mixing on (active after all three short-vowel CVC tiers
 * master)."
 */
export function defaultsFootnote(defaults: ParentSettings): string {
  const t = defaults.masteryThreshold
  return (
    `Defaults: auto-promote ${onOff(defaults.autoPromote)}, ` +
    `fresh-day mastery ${onOff(defaults.crossDayEnforcement)}, ` +
    `math threshold ${presetLabel(t.math)} sessions, ` +
    `word-song threshold ${presetLabel(t['word-song'])} sessions, ` +
    `level ${defaults.showLevelToMarian ? 'shown' : 'hidden'}, ` +
    `mode picker ${defaults.sessionModePicker}, ` +
    `cross-vowel mixing ${onOff(defaults.crossVowelMixingEnabled)} ` +
    '(active after all three short-vowel CVC tiers master).'
  )
}

/**
 * "Last synced" in the device's local time (the web prints the UTC ISO
 * string, an hour or two off in Denmark). `null` → "Never"; a value that
 * doesn't parse, or a formatter that throws, comes back unchanged.
 */
export function formatLastSynced(iso: string | null, never: string): string {
  if (iso === null) return never
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
