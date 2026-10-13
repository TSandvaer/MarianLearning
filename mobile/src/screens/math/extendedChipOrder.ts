/**
 * The answer chips for the extended kinds (number recognition, skip
 * counting, multiplication): the answer plus core's two wrong values
 * (`@marian/core/math/extendedDistractors`), shuffled with the same LCG and
 * seed as `buildChipOrder` (spec
 * `design/native/math-skip-counting-multiplication-native.md` § 4).
 * `buildChipOrder` stays the web's verbatim copy and keeps serving the
 * arithmetic kinds.
 */
import {
  extendedDistractors,
  extendedOfferedClass,
  type ExtendedChipProblem,
  type ExtendedOfferedClass,
} from '@marian/core/math/extendedDistractors'
import { lcg, type OfferedDistractorClass } from './chipOrder'

/** Any class a Math chip set offers: the arithmetic tiers' (the web's) plus
 *  skip counting's `'count-by-one'`. Persisted as a string. */
export type MathOfferedClass = OfferedDistractorClass | ExtendedOfferedClass

export interface ExtendedChipOrder {
  values: readonly number[]
  /** `null` for P1–P3 (gentle ramp). */
  offeredClass: ExtendedOfferedClass | null
}

/**
 * @param multiplyCeiling the plan's `multiplyChipCeiling` (multiply only).
 */
export function buildExtendedChipOrder(
  problem: ExtendedChipProblem,
  multiplyCeiling: number,
): ExtendedChipOrder {
  const [d1, d2] = extendedDistractors(problem, multiplyCeiling)
  const values = [problem.correct, d1, d2]
  // `buildChipOrder`'s seed and Fisher–Yates, unchanged.
  const seed = (problem.index * 31 + problem.correct * 17 + 1) >>> 0
  const rng = lcg(seed)
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return { values, offeredClass: extendedOfferedClass(problem) }
}
