/**
 * Distractor generation for the Math screen.
 *
 * Pure functions, fully unit-testable. No DOM, no React, no audio.
 *
 * Spec
 * ----
 * `design/screen-3-math.md` §"Distractor policy" + the post-Dave update in
 * `design/research/math-distractor-and-streak-decisions.md`. Two tiers:
 *
 *   - **gentle** (problems 1-3 of the session): distractors are at least 2
 *     away from the correct answer, biased toward the extremes of the
 *     answer range. Marian's session opening shouldn't trip on an
 *     off-by-one.
 *   - **offByOne** (problems 4-8 of the session): distractors are
 *     `correct - 1` and `correct + 1`, clamped into the answer range by
 *     substituting the next-nearest in-range non-correct number when one
 *     falls out.
 *
 * Constraints (must hold for both tiers):
 *
 *   1. Distractors live in `[ANSWER_RANGE_MIN, maxAnswer]` — `maxAnswer`
 *      defaults to 10 (sums-to-10 ceiling) and is widened to 20 by the
 *      add-to-20 caller (ticket 86c9q5q13). Larger ceilings (sub-to-20,
 *      two-digit-addsub, etc.) plug in via the same parameter.
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
 *
 * Why a parameterised maxAnswer (vs duplicate modules per focus node)
 * --------------------------------------------------------------------
 * The add-to-20 tier (ticket 86c9q5q13) is the first focus node where
 * the answer range exceeds 10. Rather than spinning up a parallel
 * `distractorsTo20.ts` with the same logic re-keyed on a different upper
 * bound, the single algorithm parameterises on `maxAnswer`. Future tiers
 * (sub-to-20, two-digit-addsub answers <100) plug in the same way. The
 * lower bound stays fixed at 1 — every tier on Marian's curriculum has
 * at least one positive integer as a valid chip value.
 */

/** The two distractor flavours. */
export type DistractorTier = 'gentle' | 'offByOne'

/** Default inclusive lower / upper bound on chip values for the sums-to-10
 *  tier. Other tiers (sums-to-20) override `ANSWER_RANGE_MAX` via the
 *  `maxAnswer` parameter on `pickDistractors`. */
export const ANSWER_RANGE_MIN = 1
export const ANSWER_RANGE_MAX = 10

/**
 * Answer-range upper bound for the add-to-20 tier (ticket 86c9q5q13).
 * Exposed as a named constant rather than an inline magic number so the
 * planner / canon / tests can pin against the same value.
 */
export const ANSWER_RANGE_MAX_TO_20 = 20

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
 * Deterministic per (correct, problemIndex, maxAnswer) tuple. The position
 * of the correct chip among the three rendered chips is randomised
 * separately at render time (`AnswerChips`), so two sessions running
 * back-to-back with the same plan won't put the right chip in the same
 * slot — but the chip *values* themselves are stable, which is what tests
 * want to assert against.
 *
 * @param correct The right answer. Must be in [ANSWER_RANGE_MIN, maxAnswer].
 * @param problemIndex 1-based session position. Drives the tier choice.
 * @param maxAnswer Upper bound of the answer range (inclusive). Defaults
 *                  to ANSWER_RANGE_MAX (10). Pass ANSWER_RANGE_MAX_TO_20
 *                  for the add-to-20 tier.
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
  maxAnswer: number = ANSWER_RANGE_MAX,
): [number, number] {
  if (!Number.isInteger(maxAnswer) || maxAnswer < ANSWER_RANGE_MIN + 2) {
    // Need at least 2 valid distractors to satisfy the distinctness +
    // ≥2-gap constraints; a too-narrow range is a configuration bug
    // upstream, not a user-facing failure mode.
    throw new Error(
      `[distractors] maxAnswer=${maxAnswer} must be an integer >= ${ANSWER_RANGE_MIN + 2}`,
    )
  }
  if (
    !Number.isInteger(correct) ||
    correct < ANSWER_RANGE_MIN ||
    correct > maxAnswer
  ) {
    throw new Error(
      `[distractors] correct=${correct} is outside [${ANSWER_RANGE_MIN}, ${maxAnswer}]`,
    )
  }

  const tier = pickTier(problemIndex)
  return tier === 'gentle'
    ? gentleDistractors(correct, maxAnswer)
    : offByOneDistractors(correct, maxAnswer)
}

/**
 * Gentle ramp: pick two values that are at least 2 away from the correct
 * answer, biased toward the extremes of [ANSWER_RANGE_MIN, maxAnswer].
 * The bias matters pedagogically — the smallest and largest in-range
 * values look obviously different from a middle-ish target, which is the
 * whole point of the warm-up.
 *
 * Deterministic strategy: prefer the two range-extremes that sit at least
 * 2 away from `correct`. If both are valid (i.e. correct is somewhere in
 * the middle), return [MIN, maxAnswer]. If only one extreme is valid
 * (correct sits within 2 of the other extreme), return that extreme
 * paired with the next-furthest in-range value that still satisfies the
 * ≥2 gap and the distinctness rule.
 *
 * Worked examples (sums-to-10, maxAnswer=10):
 *   correct=5  → [1, 10] (both extremes ≥2 away)
 *   correct=2  → [10, 4] (MIN=1 is only 1 away → reject; MAX=10 anchor;
 *                         second pick walks down from 10 — 10 == anchor so
 *                         skip; 9 satisfies ≥2 gap and is in range; etc.
 *                         see impl)
 *   correct=10 → [1, 4]  (MAX is correct, MIN=1 is 9 away → anchor;
 *                         second pick walks up from MIN+1; 2 is too close,
 *                         walk further; first acceptable is 8 → see impl)
 *
 * Worked examples (sums-to-20, maxAnswer=20):
 *   correct=15 → [1, 20] (both extremes ≥2 away)
 *   correct=20 → [1, 18] (MAX is correct → MIN=1 is anchor; second pick
 *                         walks from MAX downward, skipping correct and
 *                         the values within 2 of it)
 *
 * Implementation notes:
 *
 *   - We don't actually need cleverness for the sizes we run on (10 or
 *     20 possible answers); a deterministic search works in microseconds.
 *   - We always emit [low, high] sorted ascending so tests don't have to
 *     guess the order. AnswerChips re-shuffles position at render time.
 */
function gentleDistractors(
  correct: number,
  maxAnswer: number,
): [number, number] {
  const minOk = correct - ANSWER_RANGE_MIN >= 2 ? ANSWER_RANGE_MIN : null
  const maxOk = maxAnswer - correct >= 2 ? maxAnswer : null

  if (minOk !== null && maxOk !== null) {
    // Easy case: middle-ish correct answer.
    return [minOk, maxOk]
  }

  // One extreme is ruled out by the ≥2 gap. Take the other extreme and pair
  // it with the in-range value furthest from `correct` that still satisfies
  // ≥2 gap, distinct, in-range, ≠ the first pick.
  const anchor = (minOk ?? maxOk) as number

  // Walk inward from the opposite end. When anchor=MIN (correct sits high),
  // search from maxAnswer downward; when anchor=maxAnswer (correct sits
  // low), search from MIN upward.
  const searchOrder =
    anchor === ANSWER_RANGE_MIN
      ? rangeDescending(maxAnswer, ANSWER_RANGE_MIN)
      : rangeAscending(ANSWER_RANGE_MIN, maxAnswer)

  for (const candidate of searchOrder) {
    if (candidate === anchor) continue
    if (candidate === correct) continue
    if (Math.abs(candidate - correct) < 2) continue
    return sortPair(anchor, candidate)
  }

  // Pathological fallback — by construction this is unreachable for any
  // correct in [ANSWER_RANGE_MIN, maxAnswer] because the gentle-distance
  // constraint is satisfiable on any range with maxAnswer >= 3. Throw
  // rather than silently returning bad data.
  throw new Error(
    `[distractors] gentle ramp could not satisfy ≥2 gap for correct=${correct} (maxAnswer=${maxAnswer})`,
  )
}

/**
 * Off-by-one trap distractors: `correct - 1` and `correct + 1`, with
 * range-clamping. The whole point is to drill against Marian's documented
 * miscount pattern, so we never silently widen the gap — if `correct + 1`
 * falls out of range, we substitute `correct - 2` (the next-nearest
 * adjacent number that's still in range), and symmetrically on the low end.
 *
 * Worked examples (sums-to-10, maxAnswer=10):
 *   correct=2  → [1, 3]
 *   correct=5  → [4, 6]
 *   correct=10 → [8, 9]  (correct+1=11 is OOR → substitute 8 = correct-2)
 *   correct=1  → [2, 3]  (correct-1=0 is OOR → substitute 3 = correct+2)
 *
 * Worked examples (sums-to-20, maxAnswer=20):
 *   correct=15 → [14, 16]
 *   correct=20 → [18, 19] (correct+1=21 is OOR → substitute 18 = correct-2)
 *   correct=11 → [10, 12]
 */
function offByOneDistractors(
  correct: number,
  maxAnswer: number,
): [number, number] {
  const low = correct - 1
  const high = correct + 1

  const lowOk = low >= ANSWER_RANGE_MIN
  const highOk = high <= maxAnswer

  if (lowOk && highOk) return [low, high]

  if (!lowOk) {
    // correct === ANSWER_RANGE_MIN: low=0 invalid. Take high, then the
    // next in-range adjacent on the high side.
    return [high, high + 1]
  }

  // !highOk: correct === maxAnswer. Take low=correct-1, then walk
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
