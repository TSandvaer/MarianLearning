/**
 * The answer chips for a problem: the correct value plus two distractors
 * from core's `pickDistractors`, in a deterministic per-problem order, and
 * the distractor class the chips offer.
 *
 * A verbatim copy of the web's private `buildChipOrder` + `lcg`
 * (`src/screens/Math/Math.tsx`), which are not in `@marian/core` and are
 * not exported. Moving them into core means editing the web screen, which
 * this port does not touch. `chipOrder.test.ts` compares the code of both
 * copies and fails when either side changes, so they cannot drift apart.
 *
 * Read the web file for the reasoning behind each branch (the per-tier
 * distractor class, the sub-to-20 `minAnswer` band, the offered-class
 * capture for SessionEnd).
 */
import { pickDistractors } from '@marian/core/math/distractors'
import type { MathProblem } from '@marian/core/math/sessionPlans'
import type { SkillNode } from '@marian/core/progress'

/** The trap class the chips offer on P4–P8 (web `OfferedDistractorClass`). */
export type OfferedDistractorClass =
  | 'off-by-one'
  | 'wrong-op'
  | 'decade-anchor'
  | 'forgotten-carry'
  | 'smaller-from-larger'
  | 'borrow-no-decrement'

export interface ChipOrderWithClass {
  values: readonly number[]
  /** `null` for P1–P3 (gentle ramp). Pre-downgrade (the pedagogical intent). */
  offeredClass: OfferedDistractorClass | null
}

// ── Verbatim from the web (`chipOrder.test.ts` keeps it so) ──────────────

export function buildChipOrder(
  problem: MathProblem,
  maxAnswer: number,
  focusNode?: SkillNode,
): ChipOrderWithClass {
  const distractorClass:
    | 'off-by-one'
    | 'wrong-op'
    | 'decade-anchor'
    | 'forgotten-carry'
    | 'smaller-from-larger'
    | 'borrow-no-decrement'
    | undefined =
    problem.distractorClass ??
    (problem.op === '-'
      ? focusNode === 'sub-to-20'
        ? 'decade-anchor'
        : focusNode === 'two-digit-addsub-no-regroup' ||
            focusNode === 'two-digit-addsub-with-regroup'
          ? 'smaller-from-larger'
          : 'wrong-op'
      : focusNode === 'two-digit-addsub-no-regroup' ||
          focusNode === 'two-digit-addsub-with-regroup'
        ? 'forgotten-carry'
        : undefined)
  const minAnswer =
    focusNode === 'sub-to-20' && problem.op === '-' && problem.correct >= 10
      ? 10
      : undefined
  const [d1, d2] = pickDistractors(problem.correct, problem.index, maxAnswer, {
    op: problem.op,
    operands: [problem.addendA, problem.addendB] as const,
    distractorClass,
    minAnswer,
  })
  const values = [problem.correct, d1, d2]
  const seed = (problem.index * 31 + problem.correct * 17 + 1) >>> 0
  const rng = lcg(seed)
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  const offeredClass: OfferedDistractorClass | null =
    problem.index >= 1 && problem.index <= 3
      ? null
      : distractorClass !== undefined
        ? (distractorClass as OfferedDistractorClass)
        : 'off-by-one'
  return { values, offeredClass }
}

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}
