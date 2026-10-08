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
export { STREAK_BONUS_THRESHOLDS } from '@marian/core/wordSong/constants'
export type {
  WordSongProblem,
  WordSongProblemUtterances,
  WordSongSessionPlan,
  WordSongUtteranceSlot,
  WordSongUtteranceSource,
} from '@marian/core/wordSong/wordSessionPlans'
export {
  STATIC_WORD_SONG_PLANS,
  TARGET_WORDS,
  pickStaticWordSongPlan,
  wordSongSessionPlanFromWire,
  wordSongSessionPlanToUtteranceSources,
  wordSongUtteranceId,
} from '@marian/core/wordSong/wordSessionPlans'
export {
  PlanFromServerError as WordSongPlanFromServerError,
  parseReadTarget,
  wordSongSessionPlanFromServer,
} from '@marian/core/wordSong/planFromServer'
export {
  GENTLE_RAMP_THROUGH,
  pickDistractors,
  pickTier,
} from '@marian/core/wordSong/wordDistractors'
export type {
  DistractorTier,
  PickDistractorsOptions,
} from '@marian/core/wordSong/wordDistractors'
export {
  ALL_WORDS,
  DISTRACTOR_ONLY_WORDS,
  FORBIDDEN_PAIRS,
  TARGET_PAIRINGS,
  TARGET_PAIRINGS_CROSSVOWEL,
  getWordEntry,
  isForbiddenPair,
} from '@marian/core/wordSong/wordPack'
export type {
  TargetPairings,
  WordCategory,
  WordEntry,
} from '@marian/core/wordSong/wordPack'
