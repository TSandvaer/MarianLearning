/**
 * Parent Settings: the Backup section's JSON (ticket 86c9pkfth), the
 * manual escape hatch a parent copies to a notes app.
 *
 * The wrapper is versioned separately from the inner
 * `Progress.schemaVersion`: `kind` + `version` let a future
 * restore-from-paste validate provenance before installing anything.
 * Do not conflate `version: 1` here with `schemaVersion: 1` inside
 * `progress`.
 */
import type { Progress } from '../progress/types'
import type { SessionHistoryV2 } from '../sessionEnd/sessionHistory'

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
 * renders, with `sessionHistory: null`.
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

/** The backup payload. No reader means `sessionHistory: null`. */
export function buildBackupPayload(
  progress: Progress,
  readSessionHistory: (() => SessionHistoryV2) | undefined,
  exportedAt: Date,
): BackupPayload {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAtISO: exportedAt.toISOString(),
    progress,
    sessionHistory: readSessionHistory
      ? safelyReadSessionHistory(readSessionHistory)
      : null,
  }
}

/** The text the Backup section shows and copies: 2-space JSON. */
export function backupJson(
  progress: Progress,
  readSessionHistory: (() => SessionHistoryV2) | undefined,
  exportedAt: Date = new Date(),
): string {
  return JSON.stringify(
    buildBackupPayload(progress, readSessionHistory, exportedAt),
    null,
    2,
  )
}
