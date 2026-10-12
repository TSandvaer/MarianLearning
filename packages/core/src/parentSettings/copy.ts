/**
 * Parent Settings copy: every string the web screen shows, verbatim, so
 * the web and native screens cannot drift. Native shows these too, except
 * its named departures (`design/native/parent-settings-native.md` § 7,
 * `mobile/src/screens/parentSettings/nativeCopy.ts`). Parent-facing (not
 * Emma's vocabulary): plain, adult, no Marian theming.
 */
import type { MasteryTrackKey } from '../progress/types'
import type { ToggleSettingKey } from './parentSettingsModel'

export interface RowCopy {
  label: string
  description: string
}

export const HEADER_COPY = {
  title: 'Parent settings',
  subtitle: 'Changes save automatically.',
  done: 'Done',
} as const

export const PENDING_PROMOTION_COPY = {
  heading: 'Promotion ready to confirm',
  /** Followed by the node's label (bold), then `after`. */
  before: 'Marian has met the mastery threshold for ',
  after: '. Confirm to advance her to the next skill.',
  confirm: 'Confirm promotion',
} as const

export const TOGGLE_ROW_COPY: Readonly<Record<ToggleSettingKey, RowCopy>> = {
  autoPromote: {
    label: 'Auto-promote on mastery',
    description:
      'Advance Marian to the next skill once she meets the mastery threshold.',
  },
  crossDayEnforcement: {
    label: 'Require fresh-day mastery',
    description:
      'Hold off promotion that would happen mid-session — wait for a new day.',
  },
  showLevelToMarian: {
    label: 'Show level to Marian',
    description: 'Show her land number on the Hub cards. On by default.',
  },
  // Ticket 86c9qa0kf: active only once all three short-vowel CVC tiers
  // are mastered; this is the parent's escape valve.
  crossVowelMixingEnabled: {
    label: 'Mix vowels in chip trios',
    description:
      'After Marian masters all three short-vowel CVC tiers, mix vowels across her chip choices to test discrimination. Defaults on.',
  },
}

export const SESSION_MODE_ROW_COPY: RowCopy = {
  label: 'Session-mode picker',
  description:
    'Off: the engine picks the session shape. On: Marian sees a review / focus / mixed choice on the Hub.',
}

export const MASTERY_ROW_LABELS: Readonly<Record<MasteryTrackKey, string>> = {
  math: 'Math threshold',
  'word-song': 'Word Song threshold',
}

export const MASTERY_ROW_DESCRIPTION =
  'How many in-a-row sessions Marian needs at this success rate before a skill counts as mastered.'

export const DEFAULTS_FOOTNOTE =
  'Defaults: auto-promote on, fresh-day mastery on, math threshold 95% / 3 sessions, word-song threshold 90% / 3 sessions, level hidden, mode picker off, cross-vowel mixing on (active after all three short-vowel CVC tiers master).'

export const BACKUP_COPY = {
  heading: 'Backup',
  body: "A copy of Marian's progress and session history. Tap Copy and paste it somewhere safe (notes app, email to yourself). Helpful if her tablet is lost or reset.",
  copy: 'Copy',
  /** The JSON field's accessibility label. */
  jsonLabel: "Marian's progress backup JSON",
} as const

/** The copy status lines (backup JSON and device ID share them). */
export const COPY_STATUS_COPY = {
  copied: 'Copied to clipboard.',
  error: "Couldn't copy — select the text and copy manually.",
} as const

export const CLOUD_BACKUP_COPY = {
  heading: 'Cloud backup',
  body: "Marian's progress is also saved to the cloud after every session. If her tablet is lost or reset, paste this device ID on the new device to restore.",
  deviceIdLabel: 'Device ID',
  deviceIdUnavailable: '(unavailable)',
  copy: 'Copy',
  lastSyncedLabel: 'Last synced',
  neverSynced: 'Never',
  pushNow: 'Push now',
  pushSending: 'Sending…',
  restoreLabel: 'Restore from device ID',
  restorePlaceholder: 'paste UUID here',
  restore: 'Restore',
  restoring: 'Restoring…',
  invalidFormat:
    "That doesn't look like a device ID. Expected: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.",
} as const

export const PUSH_STATUS_COPY = {
  sent: 'Synced.',
  failed: "Couldn't reach the server.",
  skipped: "Cloud sync isn't configured.",
} as const

/** `Restore failed (<reason>).` */
export function restoreFailedMessage(reason: string): string {
  return `Restore failed (${reason}).`
}
