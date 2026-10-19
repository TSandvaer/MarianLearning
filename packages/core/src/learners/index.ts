/* eslint-disable @typescript-eslint/no-unused-vars -- failing-first stub */
/**
 * `@marian/core/learners`: learner profiles (`design/native/learner-profiles.md`).
 * Failing-first stub: every call throws until the module lands.
 */
import type { KeyValueStore } from '../platform/keyValueStore'
import type { LaunchReconcileDeps } from '../progress/launchReconcile'
import type { Land } from '../progress/lands'
import type { MasteryTrack } from '../progress/mastery'
import type { ReconcileOutcome } from '../progress/cloudSync'
import type { Progress } from '../progress/types'
import type { AvatarId, LearnerEntry, LearnerIo, LearnerList } from './types'

export * from './types'

const todo = (): never => {
  throw new Error('learners: not implemented')
}

export const LEARNER_KEYS: readonly string[] = []
export type LearnerRestoreOutcome =
  | ReconcileOutcome
  | { kind: 'code-held'; learner: LearnerEntry }
export type AddFromBackupOutcome =
  | { kind: 'added'; learner: LearnerEntry }
  | { kind: 'already-here'; learner: LearnerEntry }
  | { kind: 'other-learner-record' }
  | { kind: 'not-found' }
  | { kind: 'rejected' }
  | { kind: 'error'; reason: string }
  | { kind: 'invalid-code' }
  | { kind: 'full' }

export const ensureLearnerList = (): LearnerList | null => todo()
export const loadLearnerList = (): LearnerList | null => todo()
export const saveLearnerList = (_list: LearnerList): void => todo()
export const isLearnerList = (_v: unknown): _v is LearnerList => todo()
export const activeLearner = (): LearnerEntry | null => todo()
export const activateLearner = (_id: string): LearnerEntry | null => todo()
export const addLearner = (_input: {
  name: string
  avatarId: AvatarId
  start: { math: number; wordSong: number }
}): LearnerEntry => todo()
export const addLearnerFromBackup = async (
  _code: string,
): Promise<AddFromBackupOutcome> => todo()
export const renameLearner = (_id: string, _name: string): void => todo()
export const setLearnerAvatar = (_id: string, _a: AvatarId): void => todo()
export const setLearnerStart = (
  _id: string,
  _world: MasteryTrack,
  _land: number,
): void => todo()
export const removeLearner = (_id: string): boolean => todo()
export const learnerKey = (_base: string, _entry: LearnerEntry): string =>
  todo()
export const learnerScopedStore = (
  _raw: KeyValueStore,
  _entry: LearnerEntry,
): KeyValueStore => todo()
export const boundLearner = (_entry: LearnerEntry): LearnerIo => todo()
export const learnerStartProgress = (_entry: LearnerEntry): Progress => todo()
export const startProgressForActive = (): Progress => todo()
export const currentLand = (_p: Progress, _world: MasteryTrack): Land => todo()
export const nextAfterPick = (_entry: LearnerEntry): 'greet' | 'hub' => todo()
export const restoreLearnerFromCode = async (
  _entry: LearnerEntry,
  _code: string,
): Promise<LearnerRestoreOutcome> => todo()
export const launchReconcileDeps = (
  _entry: LearnerEntry,
): LaunchReconcileDeps => todo()
export const recordLastSyncForSyncId = (_syncId: string): void => todo()
export const resetLearnersForTests = (): void => {}
