/**
 * Barrel for the Math screen. App.tsx imports `./screens/Math` which
 * resolves here, picks up Math.tsx as the default export.
 */
export { default } from './Math'
export type {
  MathProps,
  MathSessionResult,
  PlayMathUtteranceFn,
  PlayMathUtteranceOptions,
} from './Math'
export { STREAK_BONUS_THRESHOLDS } from '@marian/core/math/constants'
export type {
  MathProblem,
  MathProblemUtterances,
  MathSessionPlan,
  MathUtteranceSlot,
  MathUtteranceSource,
} from '@marian/core/math/sessionPlans'
export {
  STATIC_SESSION_PLANS,
  mathSessionPlanFromWire,
  mathSessionPlanToUtteranceSources,
  mathUtteranceId,
  pickStaticSessionPlan,
} from '@marian/core/math/sessionPlans'
export {
  PlanFromServerError as MathPlanFromServerError,
  mathSessionPlanFromServer,
  parseReadAddends,
  parseReadOperands,
} from '@marian/core/math/planFromServer'
