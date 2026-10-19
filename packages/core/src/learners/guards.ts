/**
 * The learner list's guard (`design/native/learner-profiles.md` § 4.1,
 * AC 21). Shape only: no upper bound on learners (the cap of 4 is the add
 * buttons'), and avatar and language strings are not checked against a
 * known set, so a newer build's picture or language never rejects a list.
 */
import type { LearnerList } from './types'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isLand(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1
}

function isStart(v: unknown): boolean {
  if (v === 'legacy-default') return true
  return isObject(v) && isLand(v.math) && isLand(v.wordSong)
}

function isEntry(v: unknown): boolean {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.name === 'string' &&
    typeof v.avatarId === 'string' &&
    typeof v.language === 'string' &&
    typeof v.legacySlot === 'boolean' &&
    isStart(v.start) &&
    typeof v.createdAtISO === 'string'
  )
}

/** True iff `v` is a v1 learner list this build can use. */
export function isLearnerList(v: unknown): v is LearnerList {
  if (!isObject(v) || v.schemaVersion !== 1) return false
  const learners = v.learners
  if (!Array.isArray(learners) || learners.length === 0) return false
  if (!learners.every(isEntry)) return false
  const entries = learners as Array<{ id: string; legacySlot: boolean }>
  if (new Set(entries.map((l) => l.id)).size !== entries.length) return false
  // Two learners in the legacy slot would share today's keys.
  if (entries.filter((l) => l.legacySlot).length > 1) return false
  return (
    typeof v.activeLearnerId === 'string' &&
    entries.some((l) => l.id === v.activeLearnerId)
  )
}

/** A list from a newer build (`schemaVersion` above 1): never written back. */
export function isNewerLearnerList(v: unknown): boolean {
  return (
    isObject(v) && typeof v.schemaVersion === 'number' && v.schemaVersion > 1
  )
}
