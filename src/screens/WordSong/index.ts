/**
 * Barrel for the Word Song screen. App.tsx imports `./screens/WordSong`
 * which resolves here.
 */
export { default } from './WordSong'
export type {
  WordSongProps,
  WordSongSessionResult,
  PlayWordSongUtteranceFn,
  PlayWordSongUtteranceOptions,
} from './WordSong'
export { STREAK_BONUS_THRESHOLDS } from './constants'
export type {
  WordSongProblem,
  WordSongProblemUtterances,
  WordSongSessionPlan,
  WordSongUtteranceSlot,
  WordSongUtteranceSource,
} from './wordSessionPlans'
export {
  STATIC_WORD_SONG_PLANS,
  TARGET_WORDS,
  pickStaticWordSongPlan,
  wordSongSessionPlanFromWire,
  wordSongSessionPlanToUtteranceSources,
  wordSongUtteranceId,
} from './wordSessionPlans'
export {
  PlanFromServerError as WordSongPlanFromServerError,
  parseReadTarget,
  wordSongSessionPlanFromServer,
} from './planFromServer'
export {
  GENTLE_RAMP_THROUGH,
  pickDistractors,
  pickTier,
} from './wordDistractors'
export type { DistractorTier, PickDistractorsOptions } from './wordDistractors'
export {
  ALL_WORDS,
  DISTRACTOR_ONLY_WORDS,
  FORBIDDEN_PAIRS,
  TARGET_PAIRINGS,
  TARGET_PAIRINGS_CROSSVOWEL,
  getWordEntry,
  isForbiddenPair,
} from './wordPack'
export type { TargetPairings, WordCategory, WordEntry } from './wordPack'
