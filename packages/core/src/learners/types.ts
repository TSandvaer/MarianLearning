/**
 * Learner profiles: the shared vocabulary (`design/native/learner-profiles.md`
 * § 4.1). PR B (the screens) imports these names as written.
 */
import type { Progress } from '../progress/types'

export const LEARNERS_STORAGE_KEY = 'marian-tutor:learners:v1'
export const MAX_LEARNERS = 4 // the add buttons' cap (T1); the guard has no upper bound
export const LEARNER_NAME_MAX = 24 // types.ts:466

export type AvatarId =
  | 'fox'
  | 'lion'
  | 'frog'
  | 'turtle'
  | 'penguin'
  | 'owl'
  | 'cat'
  | 'bear'

/** The 8 avatars in the picker's order (T2): the first free one is the default. */
export const AVATAR_IDS: readonly AvatarId[] = [
  'fox',
  'lion',
  'frog',
  'turtle',
  'penguin',
  'owl',
  'cat',
  'bear',
]

/** Reserved for the planned Danish version. Only 'en' exists; nothing reads it yet. */
export type LearnerLanguage = 'en'

/** Land numbers per world (lands.ts), or the migrated learner's defaultProgress(). */
export type LearnerStart = { math: number; wordSong: number } | 'legacy-default'

export interface LearnerEntry {
  id: string // v4 UUID made at add time; the suffix of their keys; local only, never sent
  name: string // trimmed, 0..24 chars ('' only for an unnamed learner)
  avatarId: AvatarId // unique on the device
  language: LearnerLanguage
  legacySlot: boolean // true for at most one learner: their data is under today's keys
  start: LearnerStart // rebuilds their doc if it is ever missing (§ 4.8); moved by § 4.9
  createdAtISO: string
}

export interface LearnerList {
  schemaVersion: 1
  learners: LearnerEntry[] // 1+ entries, in add order (the picker's order)
  activeLearnerId: string // one of learners[].id
}

/** One learner's storage, whoever is playing (§ 4.4). */
export interface LearnerIo {
  load(): Progress | null
  save(doc: Progress): void // stamps this learner's carrier (§ 4.5)
  syncId(): string // getOrCreateDeviceId() on this learner's key
  writeSyncId(id: string): void
  recordLastSync(): void
}
