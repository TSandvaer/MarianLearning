/**
 * The two wrong answer chips for the extended Math kinds (number
 * recognition, skip counting, multiplication), per the native spec
 * `design/native/math-skip-counting-multiplication-native.md` § 4 and § 10.
 * The arithmetic kinds keep `pickDistractors` (`distractors.ts`), which this
 * module reuses unchanged for number recognition and for multiplication's
 * gentle problems and fallback.
 *
 * Every function is pure and deterministic, and returns the pair sorted
 * ascending (as `pickDistractors` does); the screen shuffles the three chips.
 *
 * | Kind       | P1–P3 (gentle)                  | P4–P8                                      | Offered (P4–P8)  |
 * | ---------- | ------------------------------- | ------------------------------------------ | ---------------- |
 * | recognize  | `pickDistractors(c, i, 10)`     | `pickDistractors(c, i, 10)` (off by one)   | `'off-by-one'`   |
 * | skip-count | first term; `c + step`          | last term + 1; `c + step`                  | `'count-by-one'` |
 * | multiply   | `pickDistractors(c, i, M)`      | `A + B`; `c ± 1` (sign by position)        | `'wrong-op'`     |
 */

import { GENTLE_RAMP_THROUGH, pickDistractors } from './distractors'
import {
  EXTENDED_ANSWER_MAX,
  type MultiplyProblem,
  type NumberRecogProblem,
  type SkipCountProblem,
} from './extendedProblems'

/** Number recognition: the chips are numbers 1..10 (spec § 10). */
export const RECOGNIZE_CHIP_MAX = 10
/** Skip counting: every chip stays in 1..99. The spec's § 4 "Skip repair"
 *  says 1..100; 99 is the progress guard's ceiling for a recorded answer
 *  ({@link EXTENDED_ANSWER_MAX}), so a tapped 100 can't reset the doc. */
export const SKIP_COUNT_CHIP_MIN = 1
export const SKIP_COUNT_CHIP_MAX = EXTENDED_ANSWER_MAX

/** The trap a problem's chips offer on P4–P8 (`null` on the gentle P1–P3).
 *  Recorded as `perProblemDistractorClass`; like the arithmetic tiers it is
 *  the intent, kept even when a multiply trap falls back. */
export type ExtendedOfferedClass = 'off-by-one' | 'count-by-one' | 'wrong-op'

/** The kinds this module picks chips for. */
export type ExtendedChipProblem =
  | NumberRecogProblem
  | SkipCountProblem
  | MultiplyProblem

const sortPair = (a: number, b: number): [number, number] =>
  a <= b ? [a, b] : [b, a]

/**
 * The multiplication chip ceiling M for a plan: the smallest multiple of 10
 * above its largest answer, `10 × ceil((max + 1) / 10)` (spec § 4), and
 * never above {@link EXTENDED_ANSWER_MAX} (99, the progress guard's ceiling).
 * `mult-2-5-10` → 30, `mult-3-4` → 20, `mult-6-9` → 30. The +1 chip fits
 * under it (below the 99 cap), and no chip reads "99" beside "Six times
 * two".
 *
 * @param corrects the answers of the plan's multiply problems.
 */
export function multiplyChipCeiling(corrects: readonly number[]): number {
  const max = corrects.length === 0 ? 0 : Math.max(...corrects)
  return Math.min(EXTENDED_ANSWER_MAX, 10 * Math.ceil((max + 1) / 10))
}

/**
 * Times mix's ceiling (content wave 1 § 2.1): M = 40 for every problem of a
 * `mult-mix` session, whichever 8 facts it drew (its largest pool answer is
 * 36, so `10 × ceil(37 / 10)`). A per-plan ceiling would move the chips
 * from day to day as the mix changes.
 */
export const MULT_MIX_CHIP_CEILING = 40

/** The multiplication chip ceiling of a step's problems on screen: times
 *  mix's fixed one, else {@link multiplyChipCeiling} of their answers. */
export function multiplyChipCeilingFor(
  node: string | undefined,
  corrects: readonly number[],
): number {
  return node === 'mult-mix'
    ? MULT_MIX_CHIP_CEILING
    : multiplyChipCeiling(corrects)
}

/** Number recognition: `pickDistractors(correct, index, 10)`, unchanged
 *  (spec § 10): far values on P1–P3, the neighbours on P4–P8. */
export function recognizeDistractors(
  problem: NumberRecogProblem,
): [number, number] {
  return pickDistractors(problem.correct, problem.index, RECOGNIZE_CHIP_MAX)
}

/**
 * Skip counting (spec § 4):
 *
 * - P1–P3: the first term and `correct + step` (one term too far).
 * - P4–P8: `last + 1` (counted on by one) and `correct + step` (skipped a
 *   term).
 * - Repair: a value equal to the answer or to the other value, or outside
 *   1..99 (the spec says 100; see {@link SKIP_COUNT_CHIP_MAX}), becomes the
 *   last term, or failing that the first term.
 */
export function skipCountDistractors(
  problem: SkipCountProblem,
): [number, number] {
  const { sequence, step, correct, index } = problem
  const first = sequence[0]!
  const last = sequence[sequence.length - 1]!
  const gentle = index <= GENTLE_RAMP_THROUGH
  const ok = (v: number, other: number | null) =>
    v !== correct &&
    v !== other &&
    v >= SKIP_COUNT_CHIP_MIN &&
    v <= SKIP_COUNT_CHIP_MAX
  const repair = (v: number, other: number | null) =>
    ok(v, other) ? v : ok(last, other) ? last : first
  const a = repair(gentle ? first : last + 1, null)
  const b = repair(correct + step, a)
  return sortPair(a, b)
}

/**
 * Multiplication (spec § 4), with `ceiling` from {@link multiplyChipCeiling}:
 *
 * - P1–P3: `pickDistractors(correct, index, ceiling)` (its gentle tier).
 * - P4–P8: `A + B` (× read as +) and a counting slip `correct ± 1`. The sign
 *   alternates by position, +1 on P4 / P6 / P8 and −1 on P5 / P7, so the
 *   answer is not always the biggest chip (`A + B` is always below `A × B`).
 *   A slip that equals `A + B` or leaves 1..ceiling takes the other sign,
 *   then ±2 in the same order.
 * - When `A + B` is the answer itself (2 × 2) or outside 1..ceiling:
 *   `pickDistractors(correct, index, ceiling)` (off by one).
 *
 * The sign is NOT taken from the chip shuffle's generator: for these small
 * seeds its first draw is always below 0.5 (spec § 4).
 */
export function multiplyDistractors(
  problem: MultiplyProblem,
  ceiling: number,
): [number, number] {
  const { factorA, factorB, correct, index } = problem
  if (index <= GENTLE_RAMP_THROUGH) {
    return pickDistractors(correct, index, ceiling)
  }
  const trap = factorA + factorB
  if (trap === correct || trap < 1 || trap > ceiling) {
    return pickDistractors(correct, index, ceiling)
  }
  const sign = index % 2 === 0 ? 1 : -1
  for (const delta of [sign, -sign, 2 * sign, -2 * sign]) {
    const slip = correct + delta
    if (slip >= 1 && slip <= ceiling && slip !== trap) {
      return sortPair(trap, slip)
    }
  }
  return pickDistractors(correct, index, ceiling)
}

/** The class a problem's chips offer: `null` on P1–P3; on P4–P8
 *  `'off-by-one'` (recognize), `'count-by-one'` (skip) or `'wrong-op'`
 *  (multiply). */
export function extendedOfferedClass(
  problem: ExtendedChipProblem,
): ExtendedOfferedClass | null {
  if (problem.index <= GENTLE_RAMP_THROUGH) return null
  switch (problem.kind) {
    case 'recognize':
      return 'off-by-one'
    case 'skip-count':
      return 'count-by-one'
    case 'multiply':
      return 'wrong-op'
  }
}

/** The two wrong chips for any extended problem; `multiplyCeiling` is the
 *  plan's {@link multiplyChipCeiling} (read by multiply problems only). */
export function extendedDistractors(
  problem: ExtendedChipProblem,
  multiplyCeiling: number,
): [number, number] {
  switch (problem.kind) {
    case 'recognize':
      return recognizeDistractors(problem)
    case 'skip-count':
      return skipCountDistractors(problem)
    case 'multiply':
      return multiplyDistractors(problem, multiplyCeiling)
  }
}
