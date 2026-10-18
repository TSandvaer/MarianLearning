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
 * | divide     | `pickDistractors(c, i, 10)`     | `pickDistractors(c, i, 10)` (off by one)   | `'off-by-one'`   |
 * | hundreds   | hundreds digit ± 2 and ± 4      | see {@link hundredsDistractors}            | see below        |
 *
 * Sharing (content wave 2 § 2.6, K5, D4): `pickDistractors` unchanged with
 * M = 10, so no far "99" chip and no plate-count trap.
 *
 * Hundreds (content wave 3 § 3.6, D9): every chip in 100..999; the classes
 * are `'gentle'` (P1–P3), `'digit-swap'` (place order, tens and ones
 * swapped), `'spoken-order'` (the digits in the order the read names them)
 * and `'wrong-place'` (ten / one hundred more: the other two of +1, +10,
 * +100).
 */

import { GENTLE_RAMP_THROUGH, pickDistractors } from './distractors'
import {
  EXTENDED_ANSWER_MAX,
  PLACE_PARTS,
  placeDigits,
  TWO_DIGIT_CHIP_MAX,
  type DivideProblem,
  type HundredsProblem,
  type MultiplyProblem,
  type NumberRecogProblem,
  type SkipCountProblem,
} from './extendedProblems'

/** Number recognition: the chips are numbers 1..10 (spec § 10). */
export const RECOGNIZE_CHIP_MAX = 10
/** Sharing: the chips are shares 1..10 (content wave 2 § 2.6, K5). */
export const SHARE_CHIP_MAX = 10
/** Skip counting: every chip stays in 1..99. The spec's § 4 "Skip repair"
 *  says 1..100; 99 is the two-digit cap ({@link TWO_DIGIT_CHIP_MAX}, the
 *  recorded-answer cap before content wave 3's G), so the chips don't
 *  change now that the cap for hundreds is 999 (G4). */
export const SKIP_COUNT_CHIP_MIN = 1
export const SKIP_COUNT_CHIP_MAX = TWO_DIGIT_CHIP_MAX
/** Hundreds: every chip is a three-digit number (§ 3.6). */
export const HUNDREDS_CHIP_MIN = 100
export const HUNDREDS_CHIP_MAX = EXTENDED_ANSWER_MAX

/** The trap a problem's chips offer on P4–P8 (`null` on the gentle P1–P3,
 *  but hundreds names its gentle chips `'gentle'`, § 3.6). Recorded as
 *  `perProblemDistractorClass`; like the arithmetic tiers it is the intent,
 *  kept even when a multiply trap falls back. */
export type ExtendedOfferedClass =
  | 'off-by-one'
  | 'count-by-one'
  | 'wrong-op'
  | HundredsOfferedClass

/** Hundreds' chip classes (content wave 3 § 3.6). */
export type HundredsOfferedClass =
  | 'gentle'
  | 'digit-swap'
  | 'spoken-order'
  | 'wrong-place'

/** The kinds this module picks chips for. */
export type ExtendedChipProblem =
  | NumberRecogProblem
  | SkipCountProblem
  | MultiplyProblem
  | DivideProblem
  | HundredsProblem

const sortPair = (a: number, b: number): [number, number] =>
  a <= b ? [a, b] : [b, a]

/**
 * The multiplication chip ceiling M for a plan: the smallest multiple of 10
 * above its largest answer, `10 × ceil((max + 1) / 10)` (spec § 4), and
 * never above {@link TWO_DIGIT_CHIP_MAX} (99, the two-digit cap).
 * `mult-2-5-10` → 30, `mult-3-4` → 20, `mult-6-9` → 30. The +1 chip fits
 * under it (below the 99 cap), and no chip reads "99" beside "Six times
 * two".
 *
 * @param corrects the answers of the plan's multiply problems.
 */
export function multiplyChipCeiling(corrects: readonly number[]): number {
  const max = corrects.length === 0 ? 0 : Math.max(...corrects)
  return Math.min(TWO_DIGIT_CHIP_MAX, 10 * Math.ceil((max + 1) / 10))
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

/** Sharing: `pickDistractors(correct, index, 10)`, unchanged (content wave
 *  2 § 2.6): far values on P1–P3, the neighbours on P4–P8. */
export function divideDistractors(problem: DivideProblem): [number, number] {
  return pickDistractors(problem.correct, problem.index, SHARE_CHIP_MAX)
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

/** The class of a hundreds problem's chips (§ 3.6): `'wrong-place'` for
 *  ten / one hundred more; for a place-value read `'gentle'` on P1–P3, then
 *  `'digit-swap'` when it names the places in place order, else
 *  `'spoken-order'`. */
export function hundredsOfferedClass(
  problem: HundredsProblem,
): HundredsOfferedClass {
  if (problem.kind === 'more') return 'wrong-place'
  if (problem.index <= GENTLE_RAMP_THROUGH) return 'gentle'
  return problem.spokenOrder.every((p, i) => p === PLACE_PARTS[i])
    ? 'digit-swap'
    : 'spoken-order'
}

/**
 * Hundreds (content wave 3 § 3.6, § 3.7, D9), every chip in 100..999 and
 * all three different:
 *
 * - `'gentle'`: the hundreds digit + 2 and + 4 (− 2 and − 4 above 5).
 * - `'digit-swap'`: tens and ones swapped (537 → 573, M6), and tens + 1
 *   (tens 9: − 1).
 * - `'spoken-order'`: the digits in the order the read names them (362 for
 *   P5's 326), and tens + 1.
 * - `'wrong-place'`: the other two of + 1, + 10 and + 100.
 *
 * Repair (off canon): a value equal to the answer or the other value, or
 * outside 100..999, takes the next of the gentle values.
 */
export function hundredsDistractors(
  problem: HundredsProblem,
): [number, number] {
  const { correct } = problem
  const d = placeDigits(correct)
  const number = (h: number, t: number, o: number) => 100 * h + 10 * t + o
  const tensStep = d.tens === 9 ? -1 : 1
  const down = d.hundreds > 5 ? -1 : 1
  const gentle = [2, 4].map((k) => correct + 100 * k * down)
  let wanted: number[]
  switch (hundredsOfferedClass(problem)) {
    case 'wrong-place': {
      const start = problem.kind === 'more' ? problem.start : correct
      wanted = [1, 10, 100]
        .filter((k) => k !== (problem.kind === 'more' ? problem.step : 0))
        .map((k) => start + k)
      break
    }
    case 'digit-swap':
      wanted = [
        number(d.hundreds, d.ones, d.tens),
        number(d.hundreds, d.tens + tensStep, d.ones),
      ]
      break
    case 'spoken-order': {
      const order =
        problem.kind === 'place-value' ? problem.spokenOrder : PLACE_PARTS
      const [a, b, c] = order.map((p) => d[p]) as [number, number, number]
      wanted = [number(a, b, c), number(d.hundreds, d.tens + tensStep, d.ones)]
      break
    }
    case 'gentle':
      wanted = gentle
      break
  }
  const out: number[] = []
  for (const v of [...wanted, ...gentle, correct + 10, correct - 10]) {
    if (out.length === 2) break
    if (
      v !== correct &&
      !out.includes(v) &&
      v >= HUNDREDS_CHIP_MIN &&
      v <= HUNDREDS_CHIP_MAX
    ) {
      out.push(v)
    }
  }
  return sortPair(out[0]!, out[1]!)
}

/** The class a problem's chips offer: `null` on P1–P3; on P4–P8
 *  `'off-by-one'` (recognize, divide), `'count-by-one'` (skip) or
 *  `'wrong-op'` (multiply). Hundreds: {@link hundredsOfferedClass}. */
export function extendedOfferedClass(
  problem: ExtendedChipProblem,
): ExtendedOfferedClass | null {
  if (problem.kind === 'place-value' || problem.kind === 'more') {
    return hundredsOfferedClass(problem)
  }
  if (problem.index <= GENTLE_RAMP_THROUGH) return null
  switch (problem.kind) {
    case 'recognize':
    case 'divide':
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
    case 'divide':
      return divideDistractors(problem)
    case 'place-value':
    case 'more':
      return hundredsDistractors(problem)
  }
}
