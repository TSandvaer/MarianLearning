/**
 * Public surface of the progress module. App code imports from here
 * (`@/lib/progress` once we add the alias) — never reach inside.
 */

export type {
  Character,
  LeitnerBox,
  LeitnerBoxIndex,
  LeitnerItem,
  MathFact,
  NumberGardenNode,
  Profile,
  Progress,
  SessionHistory,
  SessionHistoryEntry,
  SkillLevel,
  SkillLevels,
  SkillNode,
  WordSongNode,
} from './types'

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
