/**
 * The chips of one problem on Math's screen: Math's chip memo, kept out of
 * the component so the chip path can be tested without rendering it.
 *
 * The chips follow each problem's own step (review spec § 7.4): its
 * distractor rules, and a ceiling from that step's problems only. Without
 * `problemNodes` every problem is `focusNode`'s, exactly as before. A
 * missing number (content wave 1 § 1.6) takes the arithmetic chips of its
 * bond, around the missing part. An adding-big-numbers sum (content wave 5
 * § 3.6) takes its own chips, `addTwoDigitDistractors`, shuffled with the
 * arithmetic LCG; `buildChipOrder` (the web's copy) is not touched.
 */
import {
  ANSWER_RANGE_MAX_TO_20,
  chipMaxAnswerForCorrects,
} from '@marian/core/math/distractors'
import {
  addTwoDigitDistractors,
  addTwoDigitOfferedClass,
  multiplyChipCeilingFor,
} from '@marian/core/math/extendedDistractors'
import {
  isPlaceValueArithmetic,
  type ExtendedMathProblem,
} from '@marian/core/math/extendedProblems'
import type { MathProblem } from '@marian/core/math/sessionPlans'
import type { SkillNode } from '@marian/core/progress'
import { buildChipOrder, lcg } from './chipOrder'
import {
  buildExtendedChipOrder,
  type MathOfferedClass,
} from './extendedChipOrder'

export interface ProblemChips {
  values: readonly number[]
  offeredClass: MathOfferedClass | null
}

/**
 * The `maxAnswer` an arithmetic problem's chips are picked under: the tier
 * ceiling of its step's answers on screen, never below what the problem's
 * distractor rule needs.
 *
 * A sub-to-20 subtraction answering 10 or more keeps its chips in the
 * no-borrow band, `minAnswer = 10` (`buildChipOrder`, the web's gate; Kyle's
 * sub-to-20 spec § 3.1), whose ceiling is the to-20 one. A full session
 * always has an answer above 10 and gets that ceiling from its answers. A
 * peek (the step's problems 1–3 all answer 10) or a review / warm-up with
 * only those blocks does not: the ceiling came out 10, and `pickDistractors`
 * threw `maxAnswer=10 must be an integer >= 12`. The floor changes nothing
 * that rendered before: below it, these problems threw.
 */
export function arithmeticChipCeiling(
  problem: MathProblem,
  node: SkillNode | undefined,
  sameStepCorrects: readonly number[],
): number {
  const fromAnswers = chipMaxAnswerForCorrects(sameStepCorrects)
  const inNoBorrowBand =
    node === 'sub-to-20' && problem.op === '-' && problem.correct >= 10
  return inNoBorrowBand
    ? Math.max(fromAnswers, ANSWER_RANGE_MAX_TO_20)
    : fromAnswers
}

/**
 * The chips of `problems[problemIndex]`. `planFocusNode` is the session's
 * step: with the problem's `problemNodes` entry it decides whether a sum
 * draws the trays (and takes their chips), as Math's stage does.
 */
export function problemChips(
  problems: readonly ExtendedMathProblem[],
  problemIndex: number,
  focusNode: SkillNode | undefined,
  problemNodes?: readonly (SkillNode | null | undefined)[],
  planFocusNode?: SkillNode,
): ProblemChips {
  const p = problems[problemIndex]
  const nodeOf = (i: number) => problemNodes?.[i] ?? focusNode
  const node = nodeOf(problemIndex)
  if (
    isPlaceValueArithmetic(p, problemNodes?.[problemIndex] ?? planFocusNode)
  ) {
    // `buildChipOrder`'s seed and Fisher–Yates, unchanged.
    const values = [p.correct, ...addTwoDigitDistractors(p.correct, p.index)]
    const rng = lcg((p.index * 31 + p.correct * 17 + 1) >>> 0)
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[values[i], values[j]] = [values[j]!, values[i]!]
    }
    return { values, offeredClass: addTwoDigitOfferedClass(p.index) }
  }
  const sameStep = problems.filter((_, j) => nodeOf(j) === node)
  // The adding steps' answers on screen: the sums and the missing parts.
  const addingCorrects = () =>
    sameStep
      .filter((q) => q.kind === 'arithmetic' || q.kind === 'missing-addend')
      .map((q) => q.correct)
  if (p.kind === 'arithmetic') {
    return buildChipOrder(
      p,
      arithmeticChipCeiling(p, node, addingCorrects()),
      node,
    )
  }
  if (p.kind === 'missing-addend') {
    // Content wave 1 § 1.6: `pickDistractors` around the missing part, the
    // arithmetic chips' LCG and seed, through `buildChipOrder` with the bond
    // `A + B` (the web's copy stays verbatim). On P4–P8 the off-by-one, her
    // count-on slip.
    const bond = {
      index: p.index,
      addendA: p.addendA,
      addendB: p.correct,
      correct: p.correct,
      op: '+' as const,
      utterances: p.utterances,
    }
    return buildChipOrder(
      bond,
      chipMaxAnswerForCorrects(addingCorrects()),
      node,
    )
  }
  const ceiling = multiplyChipCeilingFor(
    node,
    sameStep.filter((q) => q.kind === 'multiply').map((q) => q.correct),
  )
  return buildExtendedChipOrder(p, ceiling)
}
