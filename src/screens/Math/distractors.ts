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

/** The three distractor flavours.
 *
 *  - `gentle`: warm-up tier (problems 1-3). Distractors ≥2 away from
 *    correct, biased toward range extremes. Op-agnostic — fires the
 *    same on `+` and `-` (Kyle's sub-to-10 spec §3.1: "no code change
 *    for sub-to-10 — same algorithm fires").
 *  - `offByOne`: discriminate tier default (problems 4-8). Distractors
 *    are `correct ± 1` clamped into range.
 *  - `wrongOp`: discriminate tier alternative for `op === '-'` problems
 *    only (Kyle's spec §3.2). Trap = `minuend + subtrahend` (the
 *    addition answer using the same operand pair); secondary = an
 *    off-by-one. Range-fitness checked at render time — when trap is
 *    OOR or aliases correct, silently downgrades to `offByOne`. */
export type DistractorTier = 'gentle' | 'offByOne' | 'wrongOp'

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
 * Pick the answer-range ceiling that fits a list of correct answers.
 *
 * Returns the smallest tier ceiling (`ANSWER_RANGE_MAX = 10` or
 * `ANSWER_RANGE_MAX_TO_20 = 20`) that contains every value in `corrects`.
 * Used by the Math screen to thread the right `maxAnswer` into
 * `pickDistractors` based on the active plan's actual content, instead of
 * pattern-matching plan ids (`sums-to-20-A`, `add-to-20-level-1`, etc.) at
 * the screen layer.
 *
 * Why a single derivation
 * -----------------------
 * Both the static fallback (`STATIC_ADD_TO_20_PLANS`) and the canon
 * (`add-to-20-level-1`) emit problems with `correct ∈ [11, 18]`. Walking
 * the actual correct values is robust against either source — and against
 * future tier additions that don't follow the same id naming convention.
 *
 * @param corrects The correct answers across the plan (typically
 *                 `plan.problems.map((p) => p.correct)`).
 * @returns The smallest known tier ceiling that contains every correct.
 *          Defaults to `ANSWER_RANGE_MAX` (10) when `corrects` is empty —
 *          a degenerate plan defensively renders inside the smaller range.
 * @throws if any correct exceeds the largest known tier ceiling. Higher
 *         tiers (sub-to-20 widens to its own range; two-digit-addsub up to
 *         99; etc.) plug in by extending the tier table here.
 */
export function chipMaxAnswerForCorrects(corrects: readonly number[]): number {
  if (corrects.length === 0) return ANSWER_RANGE_MAX
  const maxCorrect = Math.max(...corrects)
  if (maxCorrect <= ANSWER_RANGE_MAX) return ANSWER_RANGE_MAX
  if (maxCorrect <= ANSWER_RANGE_MAX_TO_20) return ANSWER_RANGE_MAX_TO_20
  throw new Error(
    `[distractors] no tier ceiling covers correct=${maxCorrect}; extend chipMaxAnswerForCorrects`,
  )
}

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
 * Optional render-time hints fed to {@link pickDistractors}. All are
 * additive — addition callers (add-to-10 / add-to-20) pass nothing and
 * the function behaves exactly as before the sub-to-10 extension.
 *
 * @property op             Operator on the problem (`'+'` or `'-'`). Defaults
 *                          to `'+'`. Drives the Class-2 dispatch and the
 *                          `minAnswer` widening default.
 * @property operands       `[addendA, addendB]` (minuend + subtrahend for
 *                          `op === '-'`). Required when `distractorClass`
 *                          is `'wrong-op'`; the wrong-op trap = `a + b`.
 * @property minAnswer      Inclusive lower bound. Defaults to
 *                          `ANSWER_RANGE_MIN` (1) for `op === '+'`, and
 *                          `0` for `op === '-'` (sub-to-10's subtract-self
 *                          facts produce `correct = 0` — Kyle's spec §3.3).
 *                          Callers can override either default.
 * @property distractorClass Planner's soft hint on which Class-2-eligible
 *                          path to take for `op === '-'` problems P4–P8.
 *                          Defaults to `'off-by-one'` when absent. Range-
 *                          fitness re-checked at render time.
 */
export interface PickDistractorsOpts {
  op?: '+' | '-'
  operands?: readonly [number, number]
  minAnswer?: number
  distractorClass?: 'off-by-one' | 'wrong-op'
}

/**
 * Pick two distinct in-range distractors for a given correct answer.
 *
 * Deterministic per (correct, problemIndex, maxAnswer, opts) tuple. The
 * position of the correct chip among the three rendered chips is
 * randomised separately at render time (`AnswerChips`), so two sessions
 * running back-to-back with the same plan won't put the right chip in
 * the same slot — but the chip *values* themselves are stable, which is
 * what tests want to assert against.
 *
 * @param correct      The right answer. Must be in [minAnswer, maxAnswer].
 * @param problemIndex 1-based session position. Drives the tier choice.
 * @param maxAnswer    Upper bound of the answer range (inclusive).
 *                     Defaults to ANSWER_RANGE_MAX (10). Pass
 *                     ANSWER_RANGE_MAX_TO_20 for the add-to-20 tier.
 * @param opts         Optional render-time hints. See
 *                     {@link PickDistractorsOpts}.
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
  opts?: PickDistractorsOpts,
): [number, number] {
  const op = opts?.op ?? '+'
  const minAnswer = opts?.minAnswer ?? (op === '-' ? 0 : ANSWER_RANGE_MIN)

  if (!Number.isInteger(maxAnswer) || maxAnswer < minAnswer + 2) {
    // Need at least 2 valid distractors to satisfy the distinctness +
    // ≥2-gap constraints; a too-narrow range is a configuration bug
    // upstream, not a user-facing failure mode.
    throw new Error(
      `[distractors] maxAnswer=${maxAnswer} must be an integer >= ${minAnswer + 2}`,
    )
  }
  if (
    !Number.isInteger(correct) ||
    correct < minAnswer ||
    correct > maxAnswer
  ) {
    throw new Error(
      `[distractors] correct=${correct} is outside [${minAnswer}, ${maxAnswer}]`,
    )
  }

  const tier = pickTier(problemIndex)
  if (tier === 'gentle') {
    return gentleDistractors(correct, maxAnswer, minAnswer)
  }
  // Discriminate tier (problems 4-8). Dispatch on op + distractorClass:
  //   - op === '+'                                  → off-by-one (Class 1)
  //   - op === '-', class !== 'wrong-op'             → off-by-one (Class 1)
  //   - op === '-', class === 'wrong-op', no operands → off-by-one (defensive)
  //   - op === '-', class === 'wrong-op', operands     → try Class 2; fall
  //                                                       back to Class 1
  //                                                       on OOR / alias.
  const wantsWrongOp =
    op === '-' &&
    opts?.distractorClass === 'wrong-op' &&
    opts.operands !== undefined
  if (wantsWrongOp) {
    const [a, b] = opts.operands as [number, number]
    const wrongOp = wrongOpDistractors(correct, a, b, maxAnswer, minAnswer)
    if (wrongOp !== null) {
      return wrongOp
    }
    // Range-fitness or alias collision — fall through to off-by-one.
    // Per Kyle's spec §3.2 "Out-of-range wrong-op fallback": the
    // problem renders identically to a Class-1 off-by-one. The planner
    // hint was misleading; this is the documented downgrade.
  }
  return offByOneDistractors(correct, maxAnswer, minAnswer)
}

/**
 * Class-2 wrong-operation distractor pair for a subtraction problem
 * `a − b = c` (Kyle's spec §3.2). Returns `null` when the trap value
 * can't be used cleanly — the caller's expected behaviour is to fall
 * through to Class 1 (off-by-one).
 *
 * Trap = `a + b` (the addition answer using the same operand pair).
 * Two failure modes downgrade to null:
 *
 *   1. **Out-of-range:** `a + b > maxAnswer`. E.g. `10 − 2 = 8` →
 *      wrong-op `12` > 10. The Class-2 lure simply doesn't fit. The
 *      problem renders identically to a Class-1 off-by-one.
 *   2. **Same-value collision (subtract-zero):** `a + 0 = a = c`.
 *      Wrong-op aliases the correct answer. Per spec §3.2, Class 2 is
 *      FORBIDDEN for subtract-zero facts.
 *
 * Secondary distractor is the standard off-by-one (`c - 1` or `c + 1`
 * clamped). Alias collision between trap and off-by-one is resolved by
 * substituting the next-nearest in-range value (`c - 2`).
 *
 * Returned tuple is sorted ascending for test stability — chip
 * randomization happens at render time.
 */
export function wrongOpDistractors(
  correct: number,
  a: number,
  b: number,
  maxAnswer: number,
  minAnswer: number = 0,
): [number, number] | null {
  const trap = a + b
  // Failure mode 1: trap out of range.
  if (trap > maxAnswer || trap < minAnswer) return null
  // Failure mode 2: trap aliases the correct answer (subtract-zero).
  if (trap === correct) return null

  // Secondary: off-by-one. Prefer `correct - 1` when in range AND not
  // equal to the trap; else `correct + 1`; else fall back further.
  const secondary = pickSecondaryOffByOne(correct, trap, minAnswer, maxAnswer)
  if (secondary === null) {
    // Pathological — couldn't satisfy distinctness even with the
    // off-by-one. Caller falls through to plain off-by-one tier.
    return null
  }
  return sortPair(trap, secondary)
}

/** Pick a single off-by-one secondary distractor that is in range,
 *  distinct from `correct`, and distinct from `avoid` (the wrong-op
 *  trap). Walk `correct ± 1` first, then `± 2` if a collision forces
 *  us further. Returns `null` if no choice satisfies the constraints
 *  (would only happen on absurdly narrow ranges). */
function pickSecondaryOffByOne(
  correct: number,
  avoid: number,
  minAnswer: number,
  maxAnswer: number,
): number | null {
  // Try ±1 first (the textbook off-by-one), then ±2 if collision.
  for (const delta of [-1, 1, -2, 2]) {
    const candidate = correct + delta
    if (candidate < minAnswer || candidate > maxAnswer) continue
    if (candidate === correct) continue
    if (candidate === avoid) continue
    return candidate
  }
  return null
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
  minAnswer: number = ANSWER_RANGE_MIN,
): [number, number] {
  const minOk = correct - minAnswer >= 2 ? minAnswer : null
  const maxOk = maxAnswer - correct >= 2 ? maxAnswer : null

  if (minOk !== null && maxOk !== null) {
    // Easy case: middle-ish correct answer.
    return [minOk, maxOk]
  }

  // One extreme is ruled out by the ≥2 gap. Take the other extreme and pair
  // it with the in-range value furthest from `correct` that still satisfies
  // ≥2 gap, distinct, in-range, ≠ the first pick.
  const anchor = (minOk ?? maxOk) as number

  // Walk inward from the opposite end. When anchor=minAnswer (correct
  // sits high), search from maxAnswer downward; when anchor=maxAnswer
  // (correct sits low), search from minAnswer upward.
  const searchOrder =
    anchor === minAnswer
      ? rangeDescending(maxAnswer, minAnswer)
      : rangeAscending(minAnswer, maxAnswer)

  for (const candidate of searchOrder) {
    if (candidate === anchor) continue
    if (candidate === correct) continue
    if (Math.abs(candidate - correct) < 2) continue
    return sortPair(anchor, candidate)
  }

  // Pathological fallback — by construction this is unreachable for any
  // correct in [minAnswer, maxAnswer] because the gentle-distance
  // constraint is satisfiable on any range with maxAnswer - minAnswer >= 3.
  // Throw rather than silently returning bad data.
  throw new Error(
    `[distractors] gentle ramp could not satisfy ≥2 gap for correct=${correct} (range [${minAnswer}, ${maxAnswer}])`,
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
  minAnswer: number = ANSWER_RANGE_MIN,
): [number, number] {
  const low = correct - 1
  const high = correct + 1

  const lowOk = low >= minAnswer
  const highOk = high <= maxAnswer

  if (lowOk && highOk) return [low, high]

  if (!lowOk) {
    // correct === minAnswer: low is below the floor. Take high, then
    // the next in-range adjacent on the high side.
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
