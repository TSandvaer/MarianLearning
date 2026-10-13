/**
 * The extended Math plan model: Number Garden steps 8–11 (`skip-counting`,
 * `mult-2-5-10`, `mult-3-4`, `mult-6-9`) on top of the arithmetic
 * (`+` / `−`) problems of {@link MathProblem}.
 *
 * Opt-in, native only
 * -------------------
 * The web app is frozen and reads plans through the same core parser. It
 * calls `mathSessionPlanFromServer(plan)` with no options and keeps getting a
 * plain {@link MathSessionPlan}: a skip-count or multiplication read line
 * still throws there, so those four steps keep their silent static fallback
 * on the web, exactly as before this model existed. Only a caller that passes
 * `{ extendedKinds: true }` (the React Native app) gets an
 * {@link ExtendedMathSessionPlan}, whose problems are a discriminated union
 * on `kind`.
 *
 * Read-line shapes (the committed canon, `public/canon/math/level-1/*.json`,
 * and the planner's generic-tier hint templates in `api/_planner.ts`):
 *
 *  - skip-count: `"Two, four, six, eight. What is next?"` — three or more
 *    number words with one common positive step; the answer is the next term.
 *  - multiply: `"Two times three. How many?"` — the answer is the product.
 *    Operand order is meaningful: the canon and the planner read it as
 *    `factorB` copies of `factorA` ("Two times three" → hint "Two, then two,
 *    then two."), with no commutative flip.
 *
 * Answer chips — the seam
 * -----------------------
 * Not here, on purpose. `pickDistractors` (`distractors.ts`) is
 * arithmetic-only (`op: '+' | '-'`, two operands). How many chips a
 * skip-count or multiplication problem shows and which wrong values it
 * offers belong to the native UX spec
 * (`design/native/math-skip-counting-multiplication-native.md`). The picker
 * for these kinds is a separate pure function to be added beside
 * `pickDistractors` once that spec has merged; everything it needs is on the
 * problem (`sequence`, `step`, `factorA`, `factorB`, `correct`), so the plan
 * model does not change when it lands.
 *
 * Pure types plus type guards: no I/O, no React.
 */

import type { MathProblem, MathProblemUtterances } from './sessionPlans'

/** The problem kinds of an {@link ExtendedMathSessionPlan}. */
export type ExtendedMathProblemKind = 'arithmetic' | 'skip-count' | 'multiply'

/** An addition or subtraction problem in an extended plan: a
 *  {@link MathProblem}, tagged so the union can discriminate. Assignable to
 *  `MathProblem`, so arithmetic code paths keep taking it unchanged. */
export interface ArithmeticProblem extends MathProblem {
  kind: 'arithmetic'
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
