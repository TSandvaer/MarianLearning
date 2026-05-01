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
  MathFact,
  NumberGardenNode,
  ParentSettings,
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

export { addItem, demote, emptyLeitner, findItem, promote } from './leitner'

export { defaultProgress } from './defaults'
export { migrate } from './migrate'
export { isProgressV1 } from './guards'
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

export { LITERACY_TREE, MATH_TREE, applyMasteryRule, nextNode } from './mastery'
export type { MasteryTrack } from './mastery'
