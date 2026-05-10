/**
 * Public surface of the progress module. App code imports from here
 * (`@/lib/progress` once we add the alias) — never reach inside.
 */

export type {
  Character,
  LeitnerBox,
  LeitnerBoxIndex,
  LeitnerItem,
  MasteryThreshold,
  MasteryTrackKey,
  MathFact,
  NumberGardenNode,
  ParentSettings,
  PerTrackMasteryThreshold,
  Profile,
  Progress,
  SessionHistory,
  SessionHistoryEntry,
  SessionModePicker,
  SkillLevel,
  SkillLevels,
  SkillNode,
  WordSongNode,
} from './types'

export {
  DEFAULT_PARENT_SETTINGS,
  MASTERY_THRESHOLD_PRESETS,
  getSettings,
} from './parentSettings'

export { CURRENT_SCHEMA_VERSION } from './types'

export {
  LEITNER_HINT_MAX_ITEMS,
  addItem,
  buildLeitnerSessionHint,
  demote,
  emptyLeitner,
  findItem,
  promote,
} from './leitner'
export type { LeitnerSessionHintItem } from './leitner'

// Slow-fact session-gen hint (M4.x — follow-up to 86c9pwgc8).
export {
  SLOW_FACT_HINT_MAX_ITEMS,
  SLOW_FACT_MIN_ATTEMPTS,
  SLOW_FACT_MIN_CORRECT_RATE,
  SLOW_FACT_MIN_MEDIAN_LATENCY_MS,
  buildSlowFactSessionHint,
} from './slowFacts'
export type { SlowFactHint } from './slowFacts'

export { defaultProgress } from './defaults'
export { migrate } from './migrate'
export { isProgressV1 } from './guards'

// Lifetime-first-encounter gate (ticket 86c9q9ben).
export {
  inferLifetimeFirstEncountersFromProgress,
  isFirstEncounter,
  markFirstEncounterSeen,
} from './lifetimeFirstEncounters'
export {
  MAX_SESSION_HISTORY,
  STORAGE_KEY,
  clearProgress,
  loadProgress,
  saveProgress,
} from './storage'

export {
  MATH_NODES_IN_ORDER,
  WORD_SONG_NODES_IN_ORDER,
  pickFocusNode,
  pickRecentSuccessRate,
} from './focusNode'
export type { ProgressTrack } from './focusNode'

export {
  CVC_CROSS_VOWEL_NODES,
  CVC_CROSS_VOWEL_VOWELS,
  LITERACY_TREE,
  MATH_TREE,
  NOVEL_POOL_THRESHOLD,
  WORD_SONG_GRADUATION_GATED_NODES,
  applyMasteryRule,
  crossVowelMixingActive,
  isGraduationSessionPending,
  nextNode,
} from './mastery'
export type { MasteryTrack } from './mastery'

// Cloud-sync (ticket 86c9pkfyu).
export {
  DEVICE_ID_STORAGE_KEY,
  getOrCreateDeviceId,
  isValidUuid,
  readStoredDeviceId,
  writeStoredDeviceId,
} from './deviceId'
export {
  fetchProgressFromCloud,
  pushProgressToCloud,
  reconcileWithCloud,
} from './cloudSync'
export type {
  CloudErrorReason,
  FetchResult,
  PushResult,
  ReconcileOutcome,
} from './cloudSync'
