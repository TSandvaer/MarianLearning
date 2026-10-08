/**
 * The ONLY import surface from the web app into the spike.
 *
 * Every module re-exported here is consumed byte-for-byte unchanged from
 * the web tree (resolved through metro.config.js `watchFolders`). If one of
 * these files ever needs a DOM API, it does not belong in this list — that
 * is the Phase 1 `packages/core` boundary in miniature.
 */
export {
  GREET_LINES,
  HEART_REVEAL_AFTER_LINE_INDEX,
  REPROMPT_AFTER_MS,
  REPROMPT_LINE_INDEX,
  runGreetSequence,
  speakReprompt,
  type GreetSequenceHandle,
  type SpeakFn,
  type SpeakLikeOptions,
} from '../../src/screens/greetSequence'

export { WARM_CAP_MS } from '../../src/screens/splashTiming'

export {
  mathSessionPlanFromServer,
  PlanFromServerError,
} from '../../src/screens/Math/planFromServer'
export type {
  MathProblem,
  MathSessionPlan,
} from '../../src/screens/Math/sessionPlans'
export { pickDistractors } from '../../src/screens/Math/distractors'

export {
  isSessionStartResponse,
  type ClaudeRequest,
  type SessionStartResponse,
  type Utterance,
} from '../../api/_types'

export {
  CHIP_TAP_SPRING,
  HINT_AFTER_WRONG_COUNT,
  HINT_DELAY_AFTER_WRONG_MS,
  WRONG_SHAKE_MS,
} from '../../src/screens/_shared/gameplayConstants'

export {
  TILT_BY_POSE,
  TILT_SPRING_BY_POSE,
  POSE_HOLD_MS,
  type EmmaPose,
} from '../../src/lib/character/emmaPose'
