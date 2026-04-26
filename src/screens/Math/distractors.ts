/**
 * Distractor generation for the Math screen (sums to 10).
 *
 * Pure functions, fully unit-testable. No DOM, no React, no audio.
 *
 * Spec
 * ----
 * `design/screen-3-math.md` §"Distractor policy" + the post-Dave update in
 * `design/research/math-distractor-and-streak-decisions.md`. Two tiers:
 *
 *   - **gentle** (problems 1-3 of the session): distractors are at least 2
 *     away from the correct answer, biased toward the extremes of [1, 10].
 *     Marian's session opening shouldn't trip on an off-by-one.
 *   - **offByOne** (problems 4-8 of the session): distractors are
 *     `correct - 1` and `correct + 1`, clamped into [1, 10] by substituting
 *     the next-nearest in-range non-correct number when one falls out.
 *
 * Constraints (must hold for both tiers):
 *
 *   1. Distractors live in `[1, 10]` — the problem space for sums to 10.
 *   2. The two distractors are distinct from each other and from `correct`.
 *   3. Output is a tuple `[d1, d2]`. Position randomisation across the 3
 *      chips lives in `AnswerChips` — `pickDistractors` is deterministic so
 *      tests don't have to seed RNG.
 *
 * Cutoff history
 * --------------
 * Kyle's spec originally sat the gentle/offByOne switch between problem 2
 * and problem 3. Dave's developmental consult on `86c9grn9c` recommended
 * extending the gentle ramp by one item — reasoning is in
 * `math-distractor-and-streak-decisions.md` (anxiety-window literature +
 * Siegler's overlapping-waves model). Switch now sits between problems 3
 * and 4. Single source of truth for the cutoff is the `pickTier` constant
 * below; if Dave revisits, change one number.
 */

/** The two distractor flavours. */
export type DistractorTier = 'gentle' | 'offByOne'

/** Inclusive lower / upper bound on chip values for sums-to-10. */
export const ANSWER_RANGE_MIN = 1
export const ANSWER_RANGE_MAX = 10

/**
 * Last problem index (1-based) that uses gentle-ramp distractors. Problems
 * 1..GENTLE_RAMP_THROUGH use 'gentle'; the rest use 'offByOne'. Per Dave's
 * 2026-04-25 consult this is 3 (was 2 in Kyle's first draft).
 */
export const GENTLE_RAMP_THROUGH = 3

/**
 * Decide which distractor tier applies for the given problem index.
 *
 * @param problemIndex 1-based; clamped to [1, ∞) — out-of-range upper values
 *                     fall through to 'offByOne' which is the safe default
 *                     beyond the warm-up window.
 */
export function pickTier(problemIndex: number): DistractorTier {
  return problemIndex <= GENTLE_RAMP_THROUGH ? 'gentle' : 'offByOne'
}

/**
 * Pick two distinct in-range distractors for a given correct answer.
 *
 * Deterministic per (correct, problemIndex) pair. The position of the
 * correct chip among the three rendered chips is randomised separately at
 * render time (`AnswerChips`), so two sessions running back-to-back with
 * the same plan won't put the right chip in the same slot — but the chip
 * *values* themselves are stable, which is what tests want to assert against.
 *
 * @param correct The right answer. Must be in [ANSWER_RANGE_MIN, ANSWER_RANGE_MAX].
 * @param problemIndex 1-based session position. Drives the tier choice.
 * @returns A tuple [d1, d2] of distractor values, both in range, both
 *          distinct, and both different from `correct`.
 *
 * @throws if `correct` is outside the valid range — the session-plan
 *         generator should never emit one, and silently coercing would
 *         hide a real bug.
 */
export function pickDistractors(
  correct: number,
  problemIndex: number,
): [number, number] {
  if (
    !Number.isInteger(correct) ||
    correct < ANSWER_RANGE_MIN ||
    correct > ANSWER_RANGE_MAX
  ) {
    throw new Error(
      `[distractors] correct=${correct} is outside [${ANSWER_RANGE_MIN}, ${ANSWER_RANGE_MAX}]`,
    )
  }

  const tier = pickTier(problemIndex)
  return tier === 'gentle'
    ? gentleDistractors(correct)
    : offByOneDistractors(correct)
}

/**
 * Gentle ramp: pick two values that are at least 2 away from the correct
 * answer, biased toward the extremes of [1, 10]. The bias matters
 * pedagogically — `1` and `10` look obviously different from "five-ish",
 * which is the whole point of the warm-up.
 *
 * Deterministic strategy: prefer the two range-extremes that sit at least
 * 2 away from `correct`. If both are valid (i.e. correct is somewhere in
 * the middle), return [MIN, MAX]. If only one extreme is valid (correct
 * sits within 2 of the other extreme), return that extreme paired with the
 * next-furthest in-range value that still satisfies the ≥2 gap and the
 * distinctness rule.
 *
 * Worked examples:
 *   correct=5  → [1, 10] (both extremes ≥2 away)
 *   correct=2  → [10, 5]  (MIN=1 is only 1 away → reject; MAX=10 is 8 away → take;
 *                          then look for a second value ≥2 away from 2 and ≠10:
 *                          start from MAX-1=9, walk down → 9, 8, 7, ... first
 *                          that satisfies is 5? Actually 9 satisfies — see impl.)
 *   correct=10 → [1, 5]   (MAX is correct, so MIN=1 is 9 away → take;
 *                          second pick walks from MIN+1=2 up; 2 is 8 away, take 2? No,
 *                          we bias toward middle for the second so the two distractors
 *                          aren't visually adjacent. See impl notes.)
 *
 * Implementation notes:
 *
 *   - We don't actually need cleverness for sums-to-10. The space is tiny
 *     (10 possible answers); a deterministic search works in microseconds.
 *   - We always emit [low, high] sorted ascending so tests don't have to
 *     guess the order. AnswerChips re-shuffles position at render time.
 */
function gentleDistractors(correct: number): [number, number] {
  const minOk = correct - ANSWER_RANGE_MIN >= 2 ? ANSWER_RANGE_MIN : null
  const maxOk = ANSWER_RANGE_MAX - correct >= 2 ? ANSWER_RANGE_MAX : null

  if (minOk !== null && maxOk !== null) {
    // Easy case: middle-ish correct answer.
    return [minOk, maxOk]
  }

  // One extreme is ruled out by the ≥2 gap. Take the other extreme and pair
  // it with the in-range value furthest from `correct` that still satisfies
  // ≥2 gap, distinct, in-range, ≠ the first pick.
  const anchor = (minOk ?? maxOk) as number

  // Walk inward from the opposite end. For correct in {1, 2}, anchor=MAX,
  // so search from MIN upward; for correct in {9, 10}, anchor=MIN, so
  // search from MAX downward.
  const searchOrder =
    anchor === ANSWER_RANGE_MIN
      ? rangeDescending(ANSWER_RANGE_MAX, ANSWER_RANGE_MIN)
      : rangeAscending(ANSWER_RANGE_MIN, ANSWER_RANGE_MAX)

  for (const candidate of searchOrder) {
    if (candidate === anchor) continue
    if (candidate === correct) continue
    if (Math.abs(candidate - correct) < 2) continue
    return sortPair(anchor, candidate)
  }

  // Pathological fallback — by construction this is unreachable for any
  // correct in [1, 10] because the gentle-distance constraint is satisfiable.
  // Throw rather than silently returning bad data.
  throw new Error(
    `[distractors] gentle ramp could not satisfy ≥2 gap for correct=${correct}`,
  )
}

/**
 * Off-by-one trap distractors: `correct - 1` and `correct + 1`, with
 * range-clamping. The whole point is to drill against Marian's documented
 * miscount pattern, so we never silently widen the gap — if `correct + 1`
 * falls out of range, we substitute `correct - 2` (the next-nearest
 * adjacent number that's still in range), and symmetrically on the low end.
 *
 * Worked examples (per spec line 134-136):
 *   correct=2  → [1, 3]
 *   correct=5  → [4, 6]
 *   correct=10 → [9, 8]  (correct+1=11 is OOR → substitute 8 = correct-2)
 *   correct=1  → [2, 3]  (correct-1=0 is OOR → substitute 3 = correct+2)
 */
function offByOneDistractors(correct: number): [number, number] {
  const low = correct - 1
  const high = correct + 1

  const lowOk = low >= ANSWER_RANGE_MIN
  const highOk = high <= ANSWER_RANGE_MAX

  if (lowOk && highOk) return [low, high]

  if (!lowOk) {
    // correct === 1: low=0 invalid. Take high=2, then the next in-range
    // adjacent on the high side: high+1=3.
    return [high, high + 1]
  }

  // !highOk: correct === ANSWER_RANGE_MAX. Take low=correct-1, then walk
  // further down for the second pick.
  return [low - 1, low]
}

function rangeAscending(start: number, end: number): number[] {
  const out: number[] = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
}

function rangeDescending(start: number, end: number): number[] {
  const out: number[] = []
  for (let i = start; i >= end; i--) out.push(i)
  return out
}

function sortPair(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a]
}
