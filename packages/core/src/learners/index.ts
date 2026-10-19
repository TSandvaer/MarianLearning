/**
 * `@marian/core/learners`: learner profiles
 * (`design/native/learner-profiles.md`). One shared vocabulary for PR A
 * (core, data, cloud) and PR B (the screens), § 4.1.
 */
export * from './types'
export { isLearnerList } from './guards'
export { LEARNER_KEYS, learnerKey, learnerScopedStore } from './keys'
export {
  currentLand,
  learnerStartProgress,
  startProgressForActive,
} from './startDoc'
export { activeLearner } from './state'
export {
  activateLearner,
  addLearner,
  addLearnerFromBackup,
  boundLearner,
  ensureLearnerList,
  isValidLearnerName,
  launchReconcileDeps,
  loadLearnerList,
  nextAfterPick,
  recordLastSyncForSyncId,
  removeLearner,
  renameLearner,
  resetLearnersForTests,
  restoreLearnerFromCode,
  saveLearnerList,
  setLearnerAvatar,
  setLearnerStart,
  type AddFromBackupOutcome,
  type LearnerRestoreOutcome,
} from './learners'
