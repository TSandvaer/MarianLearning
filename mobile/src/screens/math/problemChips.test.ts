/**
 * Math's chip path (`problemChips`) over the committed canon, for every
 * way a step's problems reach the screen: the 8-problem forward session,
 * the Map peek (its problems 1–3, fast-track spec § 6.2), and a same-day
 * review or warm-up that mixes in a lone block of a step (review spec
 * § 7.4).
 *
 * Bug (Expo Go, main 41ca7a8): opening the sub-to-20 peek threw
 * `[distractors] maxAnswer=10 must be an integer >= 12` from the chip memo.
 * Its problems 1–3 all answer 10, so the ceiling from those answers is 10,
 * while the step's no-borrow band (`minAnswer = 10`) needs at least 12.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chipMaxAnswerForCorrects } from '@marian/core/math/distractors'
import { multiplyChipCeiling } from '@marian/core/math/extendedDistractors'
import type { ExtendedMathProblem } from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import {
  STATIC_ADD_TO_20_PLANS,
  STATIC_SESSION_PLANS,
} from '@marian/core/math/sessionPlans'
import { pickPeekBlocks } from '@marian/core/map/peek'
import { MATH_TREE } from '@marian/core/progress/mastery'
import type { CanonBlockRef } from '@marian/core/progress/reviewPlan'
import type { SkillNode } from '@marian/core/progress'
import { REPO_ROOT } from '../../../test/webSource'
import { mathRoundFromServer } from '../../session/mathSession'
import { peekPlanFromServer } from '../../session/peekSession'
import { buildChipOrder } from './chipOrder'
import { buildExtendedChipOrder } from './extendedChipOrder'
import { problemChips, type ProblemChips } from './problemChips'

interface Line {
  id: string
  text: string
}

/** The disk tier of a step's canon file (api/_canon.ts `canonFileTierFor`). */
function canonFileTier(node: SkillNode): string {
  return node === 'two-digit-addsub-no-regroup' ? 'two-digit-addsub' : node
}

/** The plan lines of a step's committed level-1 math canon. */
function canonLines(node: SkillNode): Line[] {
  const file = resolve(
    REPO_ROOT,
    'public',
    'canon',
    'math',
    'level-1',
    `${canonFileTier(node)}.json`,
  )
  if (!existsSync(file)) throw new Error(`no canon file for ${node}: ${file}`)
  return (
    JSON.parse(readFileSync(file, 'utf8')) as { plan: { utterances: Line[] } }
  ).plan.utterances
}

/** The step's 8-problem forward plan, read by the app's parser. */
function forwardProblems(node: SkillNode): readonly ExtendedMathProblem[] {
  return mathSessionPlanFromServer(
    { id: `canon-${node}`, label: 'x', utterances: canonLines(node) },
    { extendedKinds: true },
  ).problems
}

/**
 * Block `ref` renamed `math.p<k>.` → `math.<to>.`, as the server copies it
 * (api/_review.ts `copyBlock`).
 */
function copyBlock(ref: CanonBlockRef, to: string): Line[] {
  const from = `math.p${ref.problem}.`
  return canonLines(ref.node)
    .filter((u) => u.id.startsWith(from))
    .map((u) => ({ id: `math.${to}.${u.id.slice(from.length)}`, text: u.text }))
}

/** A served block session (peek / review): the refs as `p1..pN`. */
function servedBlocks(idPrefix: string, refs: readonly CanonBlockRef[]) {
  return {
    id: `${idPrefix}math`,
    label: 'x',
    utterances: refs.flatMap((r, i) => copyBlock(r, `p${i + 1}`)),
  }
}

/** Math's chips for every problem, as the screen walks them. */
function chipsOfEvery(
  problems: readonly ExtendedMathProblem[],
  focusNode: SkillNode | undefined,
  problemNodes?: readonly (SkillNode | null | undefined)[],
): ProblemChips[] {
  return problems.map((_, i) =>
    problemChips(problems, i, focusNode, problemNodes),
  )
}

/** 3 distinct chips, exactly one of them the answer. */
function expectWellFormed(chips: ProblemChips, correct: number) {
  expect(chips.values).toHaveLength(3)
  expect(new Set(chips.values).size).toBe(3)
  expect(chips.values.filter((v) => v === correct)).toHaveLength(1)
}

/** The chip ceiling Math used before the fix (main 41ca7a8). */
function chipsBeforeFix(
  problems: readonly ExtendedMathProblem[],
  i: number,
  node: SkillNode | undefined,
): ProblemChips {
  const p = problems[i]
  if (p.kind === 'missing-addend') {
    throw new Error('missing-addend problems came after the fix')
  }
  if (p.kind === 'arithmetic') {
    const max = chipMaxAnswerForCorrects(
      problems.filter((q) => q.kind === 'arithmetic').map((q) => q.correct),
    )
    return buildChipOrder(p, max, node)
  }
  return buildExtendedChipOrder(
    p,
    multiplyChipCeiling(
      problems.filter((q) => q.kind === 'multiply').map((q) => q.correct),
    ),
  )
}

describe('the Map peek (fast-track spec § 6.2): every Number Garden step', () => {
  /** The peek of `node` as App mounts it: its plan, every problem `node`'s. */
  function peekProblems(node: SkillNode): readonly ExtendedMathProblem[] {
    const served = servedBlocks('peek-', pickPeekBlocks(node))
    const peek = peekPlanFromServer('math', served)
    if (peek.world !== 'math') throw new Error('not a math peek')
    return peek.plan.problems
  }

  it('renders its 3 problems’ chips without throwing', () => {
    const crashed: string[] = []
    for (const node of MATH_TREE) {
      const problems = peekProblems(node)
      expect(problems).toHaveLength(3)
      problems.forEach((p, i) => {
        try {
          expectWellFormed(
            problemChips(
              problems,
              i,
              node,
              problems.map(() => node),
            ),
            p.correct,
          )
        } catch (err) {
          crashed.push(`${node} p${i + 1}: ${String(err)}`)
        }
      })
    }
    expect(crashed).toEqual([])
  })

  it('sub-to-20: its problems answer 10, and their chips are the forward session’s problems 1–3 (to-20 ceiling)', () => {
    const peek = peekProblems('sub-to-20')
    expect(peek.map((p) => p.correct)).toEqual([10, 10, 10])
    const forward = chipsOfEvery(forwardProblems('sub-to-20'), 'sub-to-20')
    expect(
      chipsOfEvery(
        peek,
        'sub-to-20',
        peek.map(() => 'sub-to-20'),
      ),
    ).toEqual(forward.slice(0, 3))
    // The no-borrow band (Kyle's sub-to-20 spec § 3.1): no chip below 10.
    for (const chips of chipsOfEvery(peek, 'sub-to-20')) {
      expect(Math.min(...chips.values)).toBeGreaterThanOrEqual(10)
    }
  })
})

describe('a same-day review / warm-up (review spec § 7.4) with a lone sub-to-20 block that answers 10', () => {
  const LONE: CanonBlockRef = { node: 'sub-to-20', problem: 1 }

  it('review: 8 mixed blocks, one of them sub-to-20 → every chip renders', () => {
    const refs: CanonBlockRef[] = [
      { node: 'add-to-20', problem: 4 },
      { node: 'sub-to-10', problem: 5 },
      { node: 'add-to-10', problem: 6 },
      { node: 'add-to-20', problem: 7 },
      LONE,
      { node: 'sub-to-10', problem: 6 },
      { node: 'add-to-10', problem: 7 },
      { node: 'add-to-20', problem: 8 },
    ]
    const round = mathRoundFromServer(servedBlocks('review-', refs), {
      planKind: { kind: 'review', blocks: refs },
    })
    expect(round.problemNodes).toEqual(refs.map((r) => r.node))
    const lone = round.plan.problems[4]
    expect(lone.correct).toBe(10)
    expect(lone.index).toBe(5)

    const chips = chipsOfEvery(
      round.plan.problems,
      'add-to-20',
      round.problemNodes,
    )
    round.plan.problems.forEach((p, i) => expectWellFormed(chips[i], p.correct))
    expect(Math.min(...chips[4].values)).toBeGreaterThanOrEqual(10)
    expect(chips[4].offeredClass).toBe('decade-anchor')
  })

  it('warm-up: a sub-to-20 warm-up block in front of an add-to-10 session → every chip renders', () => {
    const served = {
      id: 'canon-add-to-10',
      label: 'x',
      utterances: [...canonLines('add-to-10'), ...copyBlock(LONE, 'w1')],
    }
    const round = mathRoundFromServer(served, {
      planKind: { kind: 'forward', warmup: [LONE] },
    })
    expect(round.warmupCount).toBe(1)
    expect(round.problemNodes[0]).toBe('sub-to-20')
    expect(round.plan.problems[0].correct).toBe(10)

    const chips = chipsOfEvery(
      round.plan.problems,
      'add-to-10',
      round.problemNodes,
    )
    round.plan.problems.forEach((p, i) => expectWellFormed(chips[i], p.correct))
    expect(Math.min(...chips[0].values)).toBeGreaterThanOrEqual(10)
    // The forward session's own chips are untouched by the warm-up.
    expect(chips.slice(1)).toEqual(
      chipsOfEvery(forwardProblems('add-to-10'), 'add-to-10'),
    )
  })
})

describe('an 8-problem forward session: chips byte-identical to before the fix', () => {
  it.each(MATH_TREE.map((n) => [n]))('%s canon', (node) => {
    const problems = forwardProblems(node)
    expect(problems).toHaveLength(8)
    // Missing numbers (content wave 1) have their own chip rule, below.
    const old = problems.flatMap((p, i) =>
      p.kind === 'missing-addend' ? [] : [i],
    )
    expect(old.map((i) => problemChips(problems, i, node))).toEqual(
      old.map((i) => chipsBeforeFix(problems, i, node)),
    )
  })

  const statics = [...STATIC_SESSION_PLANS, ...STATIC_ADD_TO_20_PLANS]
  it.each(statics.map((p) => [p.id, p] as const))(
    'static plan %s (no focus step, and under sub-to-20)',
    (_id, plan) => {
      const problems: ExtendedMathProblem[] = plan.problems.map((p) => ({
        ...p,
        kind: 'arithmetic',
      }))
      for (const node of [undefined, 'sub-to-20'] as const) {
        expect(chipsOfEvery(problems, node)).toEqual(
          problems.map((_, i) => chipsBeforeFix(problems, i, node)),
        )
      }
    },
  )
})

describe('missing numbers (content wave 1 § 1.6)', () => {
  /** A plan of plain reads with `missing` at the given problems (1-based). */
  function plan(missing: Record<number, string>): ExtendedMathProblem[] {
    const reads = Array.from(
      { length: 8 },
      (_, i) => missing[i + 1] ?? 'Three plus two. How many?',
    )
    return mathSessionPlanFromServer(
      {
        id: 'x',
        label: 'x',
        utterances: reads.flatMap((read, i) =>
          ['read', 'correct', 'reprompt', 'hint', 'giveAnswer'].map((slot) => ({
            id: `math.p${i + 1}.${slot}`,
            text: slot === 'read' ? read : slot,
          })),
        ),
      },
      { extendedKinds: true },
    ).problems as ExtendedMathProblem[]
  }

  it('P4 7 + ? = 10: the missing part and its off-by-one neighbours, 2 3 4 (AC 11)', () => {
    const problems = plan({ 4: 'Seven and what make ten?' })
    const chips = problemChips(problems, 3, 'add-to-10')
    expect([...chips.values].sort((a, b) => a - b)).toEqual([2, 3, 4])
    expect(chips.offeredClass).toBe('off-by-one')
  })

  it('is `buildChipOrder` over the bond (same pickDistractors, LCG and seed)', () => {
    const problems = plan({
      4: 'Seven and what make ten?',
      6: 'Six and what make ten?',
      8: 'Eight and what make ten?',
    })
    for (const i of [3, 5, 7]) {
      const p = problems[i]
      if (p.kind !== 'missing-addend') throw new Error('not missing')
      expect(problemChips(problems, i, 'add-to-10')).toEqual(
        buildChipOrder(
          {
            index: p.index,
            addendA: p.addendA,
            addendB: p.correct,
            correct: p.correct,
            op: '+',
            utterances: p.utterances,
          },
          10,
          'add-to-10',
        ),
      )
    }
  })

  it('add-to-20 9 + ? = 13: the parts stay in the count-on band (3 4 5)', () => {
    const problems = plan({ 4: 'Nine and what make thirteen?' })
    const chips = problemChips(problems, 3, 'add-to-20')
    expect([...chips.values].sort((a, b) => a - b)).toEqual([3, 4, 5])
  })

  it('on P1–P3 (a review block can land there) the gentle ramp, no offered class', () => {
    const problems = plan({ 1: 'Nine and what make ten?' })
    const chips = problemChips(problems, 0, 'add-to-10')
    expectWellFormed(chips, 1)
    expect(chips.offeredClass).toBeNull()
  })
})
