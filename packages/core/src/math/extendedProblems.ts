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
 *  - missing-addend: `"Seven and what make ten?"` — the answer is the
 *    missing part (content wave 1 § 1.6). Lives inside add-to-10 and
 *    add-to-20 (P4, P6, P8), so the web's silent fallback now covers those
 *    two steps too (§ 1.9).
 *  - divide: `"Twelve flowers, three plates. How many on each plate?"` —
 *    the answer is the share, total / plates (content wave 2 § 2.6). Only
 *    in the sharing step (`div-share`); there is no division sign on
 *    screen and no Leitner fact.
 *
 * Answer chips
 * ------------
 * `extendedDistractors.ts` picks the two wrong chips for these kinds (native
 * spec `design/native/math-skip-counting-multiplication-native.md` § 4 and
 * § 10); `pickDistractors` stays arithmetic-only.
 *
 * Pure types plus type guards: no I/O, no React.
 */

import type { MathFact } from '../progress/types'
import type { MathProblem, MathProblemUtterances } from './sessionPlans'

/**
 * The largest answer (and chip) an extended problem may have. The progress
 * guard accepts recorded answers in 0..99 only (`progress/guards.ts`,
 * `perProblemAnswerValue`); one recorded 100 makes the whole progress doc
 * fail the guard and load as a fresh start. So the parser sends a problem
 * whose answer is above this to the static fallback, and the chip pickers
 * never offer more.
 */
export const EXTENDED_ANSWER_MAX = 99

/** The problem kinds of an {@link ExtendedMathSessionPlan}. */
export type ExtendedMathProblemKind =
  | 'arithmetic'
  | 'recognize'
  | 'skip-count'
  | 'multiply'
  | 'missing-addend'
  | 'divide'

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

/** The largest whole a missing-addend read may name (content wave 1
 *  § 1.6: 1 ≤ A < T ≤ 20, the add-to-20 range). */
export const MISSING_ADDEND_TOTAL_MAX = 20

/**
 * A missing-addend problem (content wave 1 § 1, NG-A): Emma names one part
 * and the whole, the child taps the other part. e.g. "Seven and what make
 * ten?" → addendA 7, total 10, correct 3; the screen shows `7 + ? = 10`.
 * It practises the same bond as `7 + 3`, so it records the same Leitner
 * fact, `{ a: addendA, b: correct, op: '+' }` (K4).
 */
export interface MissingAddendProblem {
  kind: 'missing-addend'
  /** 1-based position in the session (1..8). */
  index: number
  /** The given part (1..19). */
  addendA: number
  /** The whole (2..{@link MISSING_ADDEND_TOTAL_MAX}). */
  total: number
  /** The missing part, `total − addendA` (≥ 1). */
  correct: number
  /** Pre-canned utterance lines, same slots as arithmetic problems. */
  utterances: MathProblemUtterances
}

/** Sharing's ranges (content wave 2 § 2.6, K4): 2–5 plates (a `GroupsRow`
 *  plate row holds 5), a share of 2–10 (a plate holds 10), at most 20
 *  flowers (two pile rows of 10). The canon itself keeps the share to 2–6
 *  (§ 2.7, the bake lint); the parser takes what a plate can show. */
export const DIVIDE_PLATES_MIN = 2
export const DIVIDE_PLATES_MAX = 5
export const DIVIDE_SHARE_MIN = 2
export const DIVIDE_SHARE_MAX = 10
export const DIVIDE_TOTAL_MAX = 20

/**
 * A sharing problem (content wave 2 § 2, NG-C): a pile of `total` flowers
 * is dealt one for each plate in turn onto `plates` plates; the child taps
 * how many land on each. e.g. "Twelve flowers, three plates. How many on
 * each plate?" → total 12, plates 3, correct 4. It records no Leitner
 * fact (K6): its time includes the deal, so it would mark × facts slow.
 */
export interface DivideProblem {
  kind: 'divide'
  /** 1-based position in the session (1..8). */
  index: number
  /** Flowers in the pile ({@link DIVIDE_PLATES_MIN} × {@link DIVIDE_SHARE_MIN}
   *  .. {@link DIVIDE_TOTAL_MAX}). */
  total: number
  /** How many plates ({@link DIVIDE_PLATES_MIN}..{@link DIVIDE_PLATES_MAX}). */
  plates: number
  /** The share, `total / plates` (a whole number). */
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
  | MissingAddendProblem
  | DivideProblem

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

/** Also takes a plain (kind-less) `MathProblem`, which is never one. */
export function isMissingAddendProblem(
  problem: MathProblem | ExtendedMathProblem,
): problem is MissingAddendProblem {
  return 'kind' in problem && problem.kind === 'missing-addend'
}

export function isMultiplyProblem(
  problem: ExtendedMathProblem,
): problem is MultiplyProblem {
  return problem.kind === 'multiply'
}

export function isDivideProblem(
  problem: ExtendedMathProblem,
): problem is DivideProblem {
  return problem.kind === 'divide'
}

/**
 * The Leitner fact a problem practises, or `null` for one that is not an
 * a/b fact (number recognition, skip counting, sharing). Arithmetic is `a ± b`;
 * multiplication `A * B` in read order (`2*3` is not `3*2`); a missing
 * number is the bond it completes, `{ a: addendA, b: correct, op: '+' }`,
 * the key plain addition uses (content wave 1 K4). Sharing records none
 * (content wave 2 K6). One reading for the session end, the canon fact
 * table and the review picker.
 */
export function problemFact(
  problem: MathProblem | ExtendedMathProblem,
): MathFact | null {
  if (!('kind' in problem) || problem.kind === 'arithmetic') {
    return { a: problem.addendA, b: problem.addendB, op: problem.op }
  }
  switch (problem.kind) {
    case 'multiply':
      return { a: problem.factorA, b: problem.factorB, op: '*' }
    case 'missing-addend':
      return { a: problem.addendA, b: problem.correct, op: '+' }
    case 'recognize':
    case 'skip-count':
    case 'divide':
      return null
  }
}
