/**
 * Parent Settings' learner copy (learner profiles § 3.6, T6 and T9,
 * approved by Thomas 2026-10-19). Native takes its own strings (the
 * `nativeCopy.ts` departure pattern), so the frozen web keeps its own.
 *
 * Every "Marian" in today's parent strings becomes the selected learner's
 * name ("this child" when unnamed), and "she / her" becomes "they /
 * their". With no learner list installed (a boot whose migration failed)
 * the name is the doc's `childName`, today's strings.
 */
import type { AddFromBackupOutcome } from '@marian/core/learners'
import {
  CLOUD_BACKUP_COPY,
  restoreFailedMessage,
} from '@marian/core/parentSettings/copy'
import { restoreOutcomeMessage } from '@marian/core/parentSettings/parentSettingsModel'
import type { Land } from '@marian/core/progress/lands'
import type { ReconcileOutcome } from '@marian/core/progress'

/** A learner's name in copy: "this child" when unnamed. */
export function displayName(name: string): string {
  const trimmed = name.trim()
  return trimmed === '' ? 'this child' : trimmed
}

/** Sentence-initial: "This child". */
function lead(name: string): string {
  const n = displayName(name)
  return `${n.charAt(0).toUpperCase()}${n.slice(1)}`
}

export const LEARNERS_COPY = {
  heading: 'Learners',
  playingNow: 'Playing now',
  noName: 'No name',
  add: '+ Add a learner',
  addFromCode: 'Add from a code',
  name: 'Name',
  picture: 'Picture',
  whereToStart: 'Where to start',
  firstLearner: 'Name the first learner',
  addTitle: 'Add a learner',
  codeTitle: 'Add from a code',
  addButton: 'Add',
  close: 'Close',
  cancel: 'Cancel',
  change: 'Change',
  remove: 'Remove',
  backupCode: 'Backup code',
  restoreFromCode: 'Restore from backup code',
  codePlaceholder: CLOUD_BACKUP_COPY.restorePlaceholder,
  worlds: { math: 'Number Garden', 'word-song': 'Word Song' },
  otherLearnersRecord: "That backup holds another learner's progress.",
  notFound: 'No progress found for that code.',
  rejected: "That backup can't be opened on this version of the app.",
  startAlertBody:
    'Steps before this land count as learned. This land and the ones after it start again. Stars and streak stay.',
  removeAlertBody:
    'This deletes their progress on this device. Their backup code brings back their progress, but not their stars or streak: those are not in the backup and will not come back.',
} as const

/** "Land 3: Big numbers" (§ 3.1). */
export function landLabel(land: Land): string {
  return `Land ${land.number}: ${land.name}`
}

export function startAlertTitle(name: string, land: Land): string {
  return `Start ${displayName(name)} at ${land.name}?`
}

export function removeLabel(name: string): string {
  return `Remove ${displayName(name)}`
}

export function removeAlertTitle(name: string): string {
  return `Remove ${displayName(name)}?`
}

export function alreadyHereLine(name: string): string {
  return `That's ${displayName(name)}, already on this device.`
}

export function addedLine(name: string): string {
  return `Added ${displayName(name)}.`
}

/** § 3.3's lines; `added` closes the sheet, the others stay in it. */
export function addFromCodeLine(outcome: AddFromBackupOutcome): {
  tone: 'ok' | 'error'
  text: string
} {
  switch (outcome.kind) {
    case 'added':
      return { tone: 'ok', text: addedLine(outcome.learner.name) }
    case 'already-here':
      return { tone: 'error', text: alreadyHereLine(outcome.learner.name) }
    case 'other-learner-record':
      return { tone: 'error', text: LEARNERS_COPY.otherLearnersRecord }
    case 'not-found':
      return { tone: 'error', text: LEARNERS_COPY.notFound }
    case 'rejected':
      return { tone: 'error', text: LEARNERS_COPY.rejected }
    case 'error':
      return { tone: 'error', text: restoreFailedMessage(outcome.reason) }
    case 'invalid-code':
    case 'full':
      return { tone: 'error', text: CLOUD_BACKUP_COPY.invalidFormat }
  }
}

/** The selected learner's heading over their card ("MARIAN"). */
export function learnerHeading(name: string): string {
  return displayName(name).toUpperCase()
}

/** Today's per-child strings, for one learner. */
export interface LearnerSettingsCopy {
  pendingBefore: string
  pendingAfter: string
  autoPromoteDescription: string
  showLevelLabel: string
  showLevelDescription: string
  crossVowelDescription: string
  sessionModeDescription: string
  masteryDescription: string
  backupBody: string
  backupJsonLabel: string
  cloudBody: string
  deviceIdLabel: string
  restoreLabel: string
  restoreOutcome: (outcome: ReconcileOutcome) => string
  qaRealStart: string
  qaRealStartTitle: string
  qaRealStartBody: string
}

export function learnerSettingsCopy(name: string): LearnerSettingsCopy {
  const n = displayName(name)
  const N = lead(name)
  return {
    pendingBefore: `${N} has met the mastery threshold for `,
    pendingAfter: '. Confirm to advance them to the next skill.',
    autoPromoteDescription: `Advance ${n} to the next skill once they meet the mastery threshold.`,
    showLevelLabel: `Show level to ${n}`,
    showLevelDescription:
      'Show their land number on the Hub cards. On by default.',
    crossVowelDescription: `After ${n} masters all three short-vowel CVC tiers, mix vowels across their chip choices to test discrimination. Defaults on.`,
    sessionModeDescription: `Off: the engine picks the session shape. On: ${n} sees a review / focus / mixed choice on the Hub.`,
    masteryDescription: `How many sessions at this success rate ${n} needs before a skill counts as mastered. They don't have to be in a row. Two days with every answer right on the first try also count.`,
    backupBody: `A copy of ${n}'s progress and session history. Tap Copy and paste it somewhere safe (notes app, email to yourself). Helpful if their tablet is lost or reset.`,
    backupJsonLabel: `${N}'s progress backup JSON`,
    cloudBody: `${N}'s progress is also saved to the cloud after every session. If their tablet is lost or reset, paste this backup code on the new device to restore.`,
    deviceIdLabel: LEARNERS_COPY.backupCode,
    restoreLabel: LEARNERS_COPY.restoreFromCode,
    restoreOutcome: (outcome) =>
      outcome.kind === 'installed-from-cloud'
        ? `Restored ${n}'s progress from that device.`
        : restoreOutcomeMessage(outcome),
    qaRealStart: `Back to ${n}'s real start`,
    qaRealStartTitle: `Back to ${n}'s real start?`,
    qaRealStartBody: `Writes ${n}'s starting progress on this device and clears today's history. The device ID stays.`,
  }
}
