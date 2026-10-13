/**
 * The opt-in extended kinds of `mathSessionPlanFromServer` (Number Garden
 * steps 8–11: skip-counting, mult-2-5-10, mult-3-4, mult-6-9), run against
 * the committed canon files, plus the proof that the default call (the frozen
 * web app's) is unchanged for those files: it still throws, so the web keeps
 * its silent static fallback there.
 *
 * The canon is read from `public/canon/math/level-1/*.json`; the parser is
 * fed `canon.plan`, the same object the web (`mathPathA.ts`) and native
 * (`mobile/src/session/mathSession.ts`) callers pass it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isArithmeticProblem,
  isMultiplyProblem,
  isSkipCountProblem,
  type MultiplyProblem,
  type SkipCountProblem,
} from './extendedProblems'
import {
  PlanFromServerError,
  mathSessionPlanFromServer,
  parseMultiplyRead,
  parseSkipCountRead,
  wordToNumber,
} from './planFromServer'

const CANON_DIR = join(process.cwd(), 'public', 'canon', 'math', 'level-1')

function canonPlan(node: string): unknown {
  const canon = JSON.parse(
    readFileSync(join(CANON_DIR, `${node}.json`), 'utf8'),
  ) as { plan: unknown }
  return canon.plan
}

/** Decode a capitalised number word from a canon line ("Twenty-one"). */
function num(word: string): number | undefined {
  return wordToNumber(word.toLowerCase())
}

/** The number in "Yes! <W>!" and "This one is <W>." — the confirm and the
 *  give-answer lines must name the answer the parser derived. */
function expectAnswerLinesName(
  correct: number,
  utterances: { correct: string; giveAnswer: string },
) {
  const confirm = utterances.correct.match(/^Yes! ([A-Za-z-]+)!$/)
  const giveAnswer = utterances.giveAnswer.match(/^This one is ([a-z-]+)\.$/)
  expect(confirm && num(confirm[1]!)).toBe(correct)
  expect(giveAnswer && num(giveAnswer[1]!)).toBe(correct)
}

const ARITHMETIC_CANON = [
  'add-to-10',
  'add-to-20',
  'sub-to-10',
  'sub-to-20',
  'two-digit-addsub',
  'two-digit-addsub-with-regroup',
] as const

describe('extended kinds — skip-counting canon', () => {
  const plan = mathSessionPlanFromServer(canonPlan('skip-counting'), {
    extendedKinds: true,
  })
  const skipCounts = plan.problems.filter(isSkipCountProblem)

  it('reads 8/8 problems as skip-count', () => {
    expect(plan.problems).toHaveLength(8)
    expect(skipCounts).toHaveLength(8)
  })

  it('derives sequence, step and next term for every read line', () => {
    expect(
      skipCounts.map(({ index, sequence, step, correct }) => ({
        index,
        sequence,
        step,
        correct,
      })),
    ).toEqual([
      { index: 1, sequence: [2, 4, 6, 8], step: 2, correct: 10 },
      { index: 2, sequence: [5, 10, 15], step: 5, correct: 20 },
      { index: 3, sequence: [10, 20, 30, 40], step: 10, correct: 50 },
      { index: 4, sequence: [2, 4, 6], step: 2, correct: 8 },
      { index: 5, sequence: [5, 10, 15, 20, 25], step: 5, correct: 30 },
      { index: 6, sequence: [10, 20, 30, 40, 50, 60], step: 10, correct: 70 },
      {
        index: 7,
        sequence: [2, 4, 6, 8, 10, 12, 14],
        step: 2,
        correct: 16,
      },
      {
        index: 8,
        sequence: [5, 10, 15, 20, 25, 30, 35, 40],
        step: 5,
        correct: 45,
      },
    ])
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'problem %i: confirm, hint and give-answer lines agree with the derivation',
    (index) => {
      const p = skipCounts[index - 1] as SkipCountProblem
      expectAnswerLinesName(p.correct, p.utterances)
      // Planner generic-tier template: hint2 "We add <step> each time.",
      // hint3 "<last term> and <step> more is what?"
      const hint2 = p.utterances.hint2?.match(/^We add ([a-z-]+) each time\.$/)
      expect(hint2 && num(hint2[1]!)).toBe(p.step)
      const hint3 = p.utterances.hint3?.match(
        /^([A-Za-z-]+) and ([a-z-]+) more is what\?$/,
      )
      expect(hint3 && num(hint3[1]!)).toBe(p.sequence[p.sequence.length - 1])
      expect(hint3 && num(hint3[2]!)).toBe(p.step)
    },
  )
})

describe.each([
  {
    node: 'mult-2-5-10',
    factors: [
      [2, 2, 4],
      [5, 1, 5],
      [10, 1, 10],
      [2, 3, 6],
      [5, 2, 10],
      [2, 5, 10],
      [10, 2, 20],
      [5, 4, 20],
    ],
  },
  {
    node: 'mult-3-4',
    factors: [
      [2, 3, 6],
      [3, 2, 6],
      [3, 3, 9],
      [4, 2, 8],
      [2, 4, 8],
      [3, 4, 12],
      [4, 3, 12],
      [4, 4, 16],
    ],
  },
  {
    node: 'mult-6-9',
    factors: [
      [6, 2, 12],
      [7, 2, 14],
      [8, 2, 16],
      [6, 3, 18],
      [7, 3, 21],
      [9, 2, 18],
      [8, 3, 24],
      [9, 3, 27],
    ],
  },
])('extended kinds — $node canon', ({ node, factors }) => {
  const plan = mathSessionPlanFromServer(canonPlan(node), {
    extendedKinds: true,
  })
  const multiplies = plan.problems.filter(isMultiplyProblem)

  it('reads 8/8 problems as multiply', () => {
    expect(plan.problems).toHaveLength(8)
    expect(multiplies).toHaveLength(8)
  })

  it('derives factors and product for every read line', () => {
    expect(
      multiplies.map(({ index, factorA, factorB, correct }) => ({
        index,
        factorA,
        factorB,
        correct,
      })),
    ).toEqual(
      factors.map(([factorA, factorB, correct], i) => ({
        index: i + 1,
        factorA,
        factorB,
        correct,
      })),
    )
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'problem %i: confirm, hint and give-answer lines agree with the derivation',
    (index) => {
      const p = multiplies[index - 1] as MultiplyProblem
      expectAnswerLinesName(p.correct, p.utterances)
      // Planner template: hint2 repeats factorA factorB times ("One group
      // of five." for one copy). Proves factorB is the copy count.
      const hint2 = p.utterances.hint2 ?? ''
      const oneGroup = hint2.match(/^One group of ([a-z-]+)\.$/)
      const copies = oneGroup
        ? [oneGroup[1]!]
        : (hint2.match(/[A-Za-z-]+/g) ?? []).filter(
            (w) => !['and', 'more', 'then'].includes(w),
          )
      expect(copies.map(num)).toEqual(
        Array.from({ length: p.factorB }, () => p.factorA),
      )
    },
  )
})

describe('default call (the web app) is unchanged for steps 8–11', () => {
  // The exact errors the parser threw on origin/main before the extended
  // kinds existed: the web keeps falling back on these four files.
  const ARITHMETIC_TEMPLATES =
    '(addition "<W> plus <W>. How many?"; subtraction "<W> minus <W>. ' +
    'How many are left?"; subtraction first-session "<W> take away <W>. ' +
    'How many are left?")'
  it.each([
    ['skip-counting', 'Two, four, six, eight. What is next?'],
    ['mult-2-5-10', 'Two times two. How many?'],
    ['mult-3-4', 'Two times three. How many?'],
    ['mult-6-9', 'Six times two. How many?'],
  ])('%s still throws the same PlanFromServerError', (node, p1Read) => {
    const plan = canonPlan(node)
    expect(() => mathSessionPlanFromServer(plan)).toThrow(PlanFromServerError)
    expect(() => mathSessionPlanFromServer(plan)).toThrow(
      `math read line "${p1Read}" did not match any known math read template ` +
        ARITHMETIC_TEMPLATES,
    )
    // An explicit `extendedKinds: false` is the default too.
    expect(() =>
      mathSessionPlanFromServer(plan, { extendedKinds: false }),
    ).toThrow(ARITHMETIC_TEMPLATES)
  })

  it.each(ARITHMETIC_CANON)(
    '%s: default problems carry no kind (same keys as before)',
    (node) => {
      const plan = mathSessionPlanFromServer(canonPlan(node))
      expect(plan.problems).toHaveLength(8)
      for (const p of plan.problems) {
        expect(Object.keys(p)).toEqual([
          'index',
          'addendA',
          'addendB',
          'correct',
          'op',
          'utterances',
        ])
      }
    },
  )
})

describe('extended kinds — arithmetic canon reads the same content, tagged', () => {
  it.each(ARITHMETIC_CANON)(
    '%s: every problem is the default problem plus kind "arithmetic"',
    (node) => {
      const plain = mathSessionPlanFromServer(canonPlan(node))
      const extended = mathSessionPlanFromServer(canonPlan(node), {
        extendedKinds: true,
      })
      expect(extended.problems.filter(isArithmeticProblem)).toHaveLength(8)
      expect(extended).toEqual({
        ...plain,
        problems: plain.problems.map((p) => ({ kind: 'arithmetic', ...p })),
      })
    },
  )
})

describe('parseSkipCountRead', () => {
  it('parses the canon template', () => {
    expect(parseSkipCountRead('Two, four, six, eight. What is next?')).toEqual({
      sequence: [2, 4, 6, 8],
      step: 2,
      next: 10,
    })
  })

  it('accepts hyphenated terms and any case / spacing', () => {
    expect(
      parseSkipCountRead('twenty-five ,thirty,  thirty-five. what is NEXT ?'),
    ).toEqual({ sequence: [25, 30, 35], step: 5, next: 40 })
  })

  it.each([
    ['two terms', 'Two, four. What is next?', 'fewer than three terms'],
    [
      'an irregular step',
      'Two, four, seven. What is next?',
      'not a skip-count sequence',
    ],
    [
      'a counting-down sequence',
      'Ten, eight, six. What is next?',
      'not a skip-count sequence',
    ],
    [
      'a repeated term (step 0)',
      'Five, five, five. What is next?',
      'not a skip-count sequence',
    ],
    [
      'an unknown number word',
      'Two, four, sicks. What is next?',
      'unrecognised number word',
    ],
    [
      'a different question',
      "Two, four, six. What's next?",
      'did not match the skip-count read template',
    ],
    [
      'an ellipsis',
      'Two, four, six, ... What is next?',
      'did not match the skip-count read template',
    ],
  ])('rejects %s', (_label, read, message) => {
    expect(() => parseSkipCountRead(read)).toThrow(PlanFromServerError)
    expect(() => parseSkipCountRead(read)).toThrow(message)
  })
})

describe('parseMultiplyRead', () => {
  it('parses the canon template, factors in read order', () => {
    expect(parseMultiplyRead('Two times three. How many?')).toEqual({
      factorA: 2,
      factorB: 3,
    })
  })

  it('is case-insensitive', () => {
    expect(parseMultiplyRead('SEVEN times three. how many?')).toEqual({
      factorA: 7,
      factorB: 3,
    })
  })

  it.each([
    ['an unknown number word', 'Two times tree. How many?', 'unrecognised'],
    [
      'another operator word',
      'Two multiplied by three. How many?',
      'did not match the multiplication read template',
    ],
    [
      'the subtraction question',
      'Two times three. How many are left?',
      'did not match the multiplication read template',
    ],
  ])('rejects %s', (_label, read, message) => {
    expect(() => parseMultiplyRead(read)).toThrow(PlanFromServerError)
    expect(() => parseMultiplyRead(read)).toThrow(message)
  })
})

describe('extended kinds — mixed and failing plans', () => {
  /** A minimal server plan: one read line per problem, every other slot
   *  stubbed (legacy single `hint`). */
  function serverPlan(reads: readonly string[]) {
    return {
      id: 'mixed',
      label: 'Mixed',
      utterances: reads.flatMap((read, i) =>
        ['read', 'correct', 'reprompt', 'hint', 'giveAnswer'].map((slot) => ({
          id: `math.p${i + 1}.${slot}`,
          text: slot === 'read' ? read : `${slot} ${i + 1}`,
        })),
      ),
    }
  }

  it('reads every kind in one plan, in problem order', () => {
    const plan = mathSessionPlanFromServer(
      serverPlan([
        'Three plus two. How many?',
        'Seven minus three. How many are left?',
        'Eight take away three. How many are left?',
        'Two, four, six. What is next?',
        'Five times two. How many?',
        'Ten, twenty, thirty. What is next?',
        'Thirty-one plus four. How many?',
        'Nine times three. How many?',
      ]),
      { extendedKinds: true },
    )
    expect(plan.problems.map((p) => [p.kind, p.correct])).toEqual([
      ['arithmetic', 5],
      ['arithmetic', 4],
      ['arithmetic', 5],
      ['skip-count', 8],
      ['multiply', 10],
      ['skip-count', 40],
      ['arithmetic', 35],
      ['multiply', 27],
    ])
    expect(plan.problems.map((p) => p.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('an unknown read line names all five templates', () => {
    const reads = Array.from({ length: 8 }, () => 'Two times two. How many?')
    reads[2] = 'Tap the one.'
    expect(() =>
      mathSessionPlanFromServer(serverPlan(reads), { extendedKinds: true }),
    ).toThrow(
      'math read line "Tap the one." did not match any known math read template ' +
        '(addition "<W> plus <W>. How many?"; subtraction "<W> minus <W>. ' +
        'How many are left?"; subtraction first-session "<W> take away <W>. ' +
        'How many are left?"; skip-count "<W>, <W>, <W>. What is next?"; ' +
        'multiplication "<W> times <W>. How many?")',
    )
  })

  it('the structural checks still apply (missing slot)', () => {
    const plan = serverPlan(
      Array.from({ length: 8 }, () => 'Two, four, six. What is next?'),
    )
    const broken = {
      ...plan,
      utterances: plan.utterances.filter((u) => u.id !== 'math.p5.reprompt'),
    }
    expect(() =>
      mathSessionPlanFromServer(broken, { extendedKinds: true }),
    ).toThrow('server plan problem 5 missing slot "reprompt"')
  })
})
