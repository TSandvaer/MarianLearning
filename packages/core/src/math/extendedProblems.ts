/**
 * The extended Math plan model: Number Garden step 1 (`number-recog`) and
 * steps 8–11 (`skip-counting`, `mult-2-5-10`, `mult-3-4`, `mult-6-9`) on top
 * of the arithmetic (`+` / `−`) problems of {@link MathProblem}.
 *
 * Opt-in, native only
 * -------------------
 * The web app is frozen and reads plans through the same core parser. It
 * calls `mathSessionPlanFromServer(plan)` with no options and keeps getting a
 * plain {@link MathSessionPlan}: a number-recognition, skip-count or
 * multiplication read line still throws there, so those five steps keep
 * their silent static fallback on the web, exactly as before this model
 * existed. Only a caller that passes
 * `{ extendedKinds: true }` (the React Native app) gets an
 * {@link ExtendedMathSessionPlan}, whose problems are a discriminated union
 * on `kind`.
 *
 * Read-line shapes (the committed canon, `public/canon/math/level-1/*.json`,
 * and the planner's generic-tier hint templates in `api/_planner.ts`):
 *
 *  - recognize: `"Tap the seven."` — a number word in 1..10; the answer is
 *    that number.
 *  - skip-count: `"Two, four, six, eight. What is next?"` (or "What's
 *    next?") — three or more number words with one common positive step; the
 *    answer is the next term.
 *  - multiply: `"Two times three. How many?"` — the answer is the product.
 *    Operand order is meaningful: the canon and the planner read it as
 *    `factorB` copies of `factorA` ("Two times three" → hint "Two, then two,
 *    then two."), with no commutative flip.
 *
 * Answer chips
 * ------------
 * `extendedDistractors.ts` picks the two wrong chips for these kinds (native
 * spec `design/native/math-skip-counting-multiplication-native.md` § 4 and
 * § 10); `pickDistractors` stays arithmetic-only.
 *
 * Pure types plus type guards: no I/O, no React.
 */

import type { MathProblem, MathProblemUtterances } from './sessionPlans'

/** The problem kinds of an {@link ExtendedMathSessionPlan}. */
export type ExtendedMathProblemKind =
  | 'arithmetic'
  | 'recognize'
  | 'skip-count'
  | 'multiply'

/** An addition or subtraction problem in an extended plan: a
 *  {@link MathProblem}, tagged so the union can discriminate. Assignable to
 *  `MathProblem`, so arithmetic code paths keep taking it unchanged. */
export interface ArithmeticProblem extends MathProblem {
  kind: 'arithmetic'
}

/** A number-recognition problem: Emma names a number, the child taps it.
 *  e.g. "Tap the seven." → correct 7. */
export interface NumberRecogProblem {
  kind: 'recognize'
  /** 1-based position in the session (1..8). */
  index: number
  /** The number Emma names (1..10). */
  correct: number
  /** Pre-canned utterance lines, same slots as arithmetic problems. */
  utterances: MathProblemUtterances
}

/** A skip-count problem: Emma reads a sequence, the child picks the next term.
 *  e.g. "Two, four, six, eight. What is next?" → sequence [2, 4, 6, 8],
 *  step 2, correct 10. */
export interface SkipCountProblem {
  kind: 'skip-count'
  /** 1-based position in the session (1..8). */
  index: number
  /** The terms read aloud, in order (at least three). */
  sequence: readonly number[]
  /** The common difference between consecutive terms (always > 0). */
  step: number
  /** The expected next term: the last term plus `step`. */
  correct: number
  /** Pre-canned utterance lines, same slots as arithmetic problems. */
  utterances: MathProblemUtterances
}

/** A multiplication problem. e.g. "Two times three. How many?" →
 *  factorA 2, factorB 3, correct 6. */
export interface MultiplyProblem {
  kind: 'multiply'
  /** 1-based position in the session (1..8). */
  index: number
  /** The first number read: the size of each group (the repeated quantity). */
  factorA: number
  /** The second number read: how many groups (copies of `factorA`). */
  factorB: number
  /** The product, `factorA * factorB`. */
  correct: number
  /** Pre-canned utterance lines, same slots as arithmetic problems. */
  utterances: MathProblemUtterances
}

/** One problem in an extended plan. Switch on `kind`. */
export type ExtendedMathProblem =
  | ArithmeticProblem
  | NumberRecogProblem
  | SkipCountProblem
  | MultiplyProblem

/** A Math session plan with the extended problem kinds: exactly 8 problems. */
export interface ExtendedMathSessionPlan {
  /** Stable id for the plan (used by the audio cache and the audit trail). */
  id: string
  /** Human-readable label for QA / debug overlay. */
  label: string
  /** Exactly 8 problems. */
  problems: readonly ExtendedMathProblem[]
}

export function isArithmeticProblem(
  problem: ExtendedMathProblem,
): problem is ArithmeticProblem {
  return problem.kind === 'arithmetic'
}

export function isNumberRecogProblem(
  problem: ExtendedMathProblem,
): problem is NumberRecogProblem {
  return problem.kind === 'recognize'
}

export function isSkipCountProblem(
  problem: ExtendedMathProblem,
): problem is SkipCountProblem {
  return problem.kind === 'skip-count'
}

export function isMultiplyProblem(
  problem: ExtendedMathProblem,
): problem is MultiplyProblem {
  return problem.kind === 'multiply'
}
