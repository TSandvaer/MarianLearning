/**
 * Pure rules behind the extended kinds' hint beats (spec
 * `design/native/math-skip-counting-multiplication-native.md` § 5 and § 10).
 */
import { wordToNumber } from '@marian/core/math/planFromServer'

/**
 * Hint 2's word match (spec § 5): of the line's first `revealed` words, how
 * many name `factorA` (lower-cased, punctuation stripped, through core's
 * `wordToNumber`), capped at `factorB`. The k-th lights plate k: "Two, then
 * two, then two." lights a plate at each "two"; "One group of five." lights
 * its one plate at "five". Driven by the same word ticks as the ribbon, so
 * the silent caption walk lights them too.
 */
export function countSpokenFactor(
  text: string,
  revealed: number,
  factorA: number,
  factorB: number,
): number {
  const words = text.split(/\s+/).filter(Boolean).slice(0, revealed)
  let count = 0
  for (const word of words) {
    const token = word.toLowerCase().replace(/[^a-z-]/g, '')
    if (wordToNumber(token) === factorA) count += 1
  }
  return Math.min(count, factorB)
}

/**
 * The number-strip cell each number-recognition hint-2 fact names (the
 * planner's number-recog table, `api/_planner.ts`): "Two comes right after
 * one." → 1, "Seven is bigger than five." → 5, "Nine is close to ten." → 10;
 * for 1, 5 and 10 the target itself (spec § 10).
 */
export const NUMBER_STRIP_LANDMARK: Readonly<Record<number, number>> = {
  1: 1,
  2: 1,
  3: 2,
  4: 3,
  5: 5,
  6: 5,
  7: 5,
  8: 7,
  9: 10,
  10: 10,
}
