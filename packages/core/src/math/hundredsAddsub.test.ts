/**
 * More and less's read lines, chips and canon (content wave 4,
 * `design/native/content-wave-4.md` § 2.6, § 2.7, AC 1, AC 2): "Two hundred
 * and thirty-five. What is two hundred more?" is a `more` problem with
 * `count: 2, direction: 'more'`, "… What is thirty less?" one with
 * `direction: 'less'`, in the opt-in extended plan, and nothing in the
 * default (web) parse. Hundreds' "ten / one hundred more" reads keep
 * `count: 1, direction: 'more'` and their chips.
 *
 * Failing-first: written before the widened template, the chip rules and
 * the canon file existed.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  extendedDistractors,
  extendedOfferedClass,
  hundredsDistractors,
} from './extendedDistractors'
import {
  isMoreAndLess,
  moreBlocksMoveOnRead,
  moreChange,
  problemFact,
  type HundredsProblem,
  type MoreProblem,
} from './extendedProblems'
import {
  mathSessionPlanFromServer,
  PlanFromServerError,
} from './planFromServer'

const SLOTS = [
  'read',
  'correct',
  'reprompt',
  'hint1',
  'hint2',
  'hint3',
  'giveAnswer',
] as const

/** A plan whose 8 problems read `reads[i]` (or `reads[0]` for all). */
function planReading(...reads: string[]): unknown {
  return {
    id: 'canon-hundreds-addsub',
    label: 'More and less',
    utterances: Array.from({ length: 8 }, (_, i) =>
      SLOTS.map((slot) => ({
        id: `math.p${i + 1}.${slot}`,
        text: slot === 'read' ? (reads[i] ?? reads[0]!) : 'Hmm... try again?',
      })),
    ).flat(),
  }
}

const parse = (...reads: string[]) =>
  mathSessionPlanFromServer(planReading(...reads), { extendedKinds: true })

const first = (read: string) => parse(read).problems[0]!

/** § 2.7, the binding canon: read, answer, chips (correct first), class. */
const CANON: readonly [string, number, readonly number[], string][] = [
  [
    'Two hundred and thirty-five. What is two hundred more?',
    435,
    [435, 635, 835],
    'gentle',
  ],
  [
    'Three hundred and twenty-four. What is thirty more?',
    354,
    [354, 374, 394],
    'gentle',
  ],
  [
    'Four hundred and twenty-six. What is three hundred more?',
    726,
    [726, 526, 326],
    'gentle',
  ],
  [
    'Five hundred and thirty-two. What is thirty more?',
    562,
    [562, 535, 526],
    'wrong-place',
  ],
  [
    'Two hundred and forty-five. What is four hundred more?',
    645,
    [645, 285, 654],
    'wrong-place',
  ],
  [
    'Six hundred and fifty-three. What is two hundred less?',
    453,
    [453, 853, 435],
    'wrong-op',
  ],
  [
    'Seven hundred and sixty-five. What is thirty less?',
    735,
    [735, 795, 753],
    'wrong-op',
  ],
  [
    'Three hundred and sixty-eight. What is forty less?',
    328,
    [328, 364, 382],
    'wrong-place',
  ],
]

/** Hundreds' P6–P8 (content wave 3 § 3.7), with their unchanged chips. */
const HUNDREDS_MORE: readonly [string, number, 10 | 100, number, number[]][] = [
  ['Two hundred and forty-three. What is ten more?', 243, 10, 253, [244, 343]],
  [
    'Four hundred and sixty-five. What is one hundred more?',
    465,
    100,
    565,
    [466, 475],
  ],
  [
    'Seven hundred and twenty-eight. What is ten more?',
    728,
    10,
    738,
    [729, 828],
  ],
]

describe('the more-and-less read template (§ 2.6, AC 1)', () => {
  it('P1 → more 235, step 100, count 2, more, 435', () => {
    expect(first(CANON[0]![0])).toMatchObject({
      kind: 'more',
      index: 1,
      start: 235,
      step: 100,
      count: 2,
      direction: 'more',
      correct: 435,
    })
  })

  it('P7 → 765, step 10, count 3, less, 735', () => {
    expect(first(CANON[6]![0])).toMatchObject({
      kind: 'more',
      start: 765,
      step: 10,
      count: 3,
      direction: 'less',
      correct: 735,
    })
  })

  it("hundreds' P6–P8 still parse with count 1, more", () => {
    for (const [read, start, step, correct] of HUNDREDS_MORE)
      expect(first(read)).toMatchObject({
        kind: 'more',
        start,
        step,
        count: 1,
        direction: 'more',
        correct,
      })
  })

  it.each([
    ['ten', 'Three hundred and twenty-four. What is ten more?', 10, 1],
    ['twenty', 'Three hundred and twenty-four. What is twenty more?', 10, 2],
    ['forty', 'Three hundred and twenty-four. What is forty more?', 10, 4],
    [
      'one hundred',
      'Three hundred and twenty-four. What is one hundred more?',
      100,
      1,
    ],
    [
      'four hundred',
      'Three hundred and twenty-four. What is four hundred more?',
      100,
      4,
    ],
  ])('reads the change word "%s"', (_word, read, step, count) => {
    expect(first(read)).toMatchObject({ step, count })
  })

  it.each([
    ['not a change word', 'Two hundred and thirty-five. What is fifty more?'],
    [
      'a zero in the answer',
      'Three hundred and forty-two. What is forty less?',
    ],
    ['a regroup', 'Three hundred and twenty-four. What is thirty less?'],
    ['past 999', 'Eight hundred and twelve. What is two hundred more?'],
    ['a zero in the start', 'Two hundred and four. What is ten more?'],
    [
      'an answer under 100',
      'Two hundred and thirty-five. What is two hundred less?',
    ],
    ['a two-digit start', 'Forty-three. What is ten less?'],
  ])('rejects %s', (_name, read) => {
    expect(() => parse(read)).toThrow(PlanFromServerError)
  })

  it('throws without extendedKinds (the frozen web keeps its silent fallback)', () => {
    for (const [read] of [CANON[0]!, CANON[5]!])
      expect(() => mathSessionPlanFromServer(planReading(read))).toThrow(
        PlanFromServerError,
      )
  })

  it('records no Leitner fact (K8)', () => {
    for (const [read] of CANON) expect(problemFact(first(read))).toBeNull()
  })

  it('names the change: +200, +30, −200, −30', () => {
    const p = parse(...CANON.map(([r]) => r)).problems as MoreProblem[]
    expect(p.map(moreChange)).toEqual([200, 30, 300, 30, 400, -200, -30, -40])
    expect(p.every(isMoreAndLess)).toBe(true)
    for (const [read] of HUNDREDS_MORE)
      expect(isMoreAndLess(first(read) as MoreProblem)).toBe(false)
  })

  it('moves the blocks on the read on P1–P3 and P6 only (D1, D2)', () => {
    const p = parse(...CANON.map(([r]) => r)).problems as MoreProblem[]
    expect(p.map(moreBlocksMoveOnRead)).toEqual([
      true,
      true,
      true,
      false,
      false,
      true,
      false,
      false,
    ])
    // Hundreds' P6–P8 never move on the read (content wave 3, D11).
    const h = parse(
      ...Array(5).fill(
        'Two hundreds, three tens and four ones. What number is it?',
      ),
      ...HUNDREDS_MORE.map(([r]) => r),
    ).problems.slice(5) as MoreProblem[]
    expect(h.map(moreBlocksMoveOnRead)).toEqual([false, false, false])
  })
})

describe('the more-and-less chips (§ 2.6, § 2.7, AC 2)', () => {
  const plan = parse(...CANON.map(([read]) => read))
  const problems = plan.problems as HundredsProblem[]

  it('parses 8/8 with § 2.7 answers', () => {
    expect(problems.map((p) => p.correct)).toEqual(CANON.map(([, a]) => a))
  })

  it.each(CANON.map(([read, , chips], i) => [i + 1, read, chips] as const))(
    'P%i: hundredsDistractors gives § 2.7 chips',
    (i, _read, chips) => {
      const p = problems[i - 1]!
      const wrong = hundredsDistractors(p)
      expect([...wrong].sort()).toEqual([...chips.slice(1)].sort())
      expect(extendedDistractors(p, 99)).toEqual(wrong)
      const all = [p.correct, ...wrong]
      expect(new Set(all).size).toBe(3)
      for (const c of all) {
        expect(c).toBeGreaterThanOrEqual(100)
        expect(c).toBeLessThanOrEqual(999)
      }
    },
  )

  it('records gentle (P1–P3), wrong-place (P4, P5, P8), wrong-op (P6, P7)', () => {
    expect(problems.map((p) => extendedOfferedClass(p))).toEqual(
      CANON.map(([, , , cls]) => cls),
    )
  })

  it('gentle varies the changing place: P2 (+30) varies the tens (D3)', () => {
    expect(hundredsDistractors(problems[1]!)).toEqual([374, 394])
  })

  it('gentle steps the changing digit down above 5 (− 2, − 4)', () => {
    // 243 + 30 = 273: tens 7 → 253, 233.
    const p = first('Two hundred and forty-three. What is thirty more?')
    expect(hundredsDistractors(p as HundredsProblem)).toEqual([233, 253])
  })

  it("'wrong-op' with a zero, a regroup or past 999 becomes 'wrong-place'", () => {
    const at = (n: number, read: string) =>
      parse(...CANON.slice(0, n - 1).map(([r]) => r), read).problems[
        n - 1
      ] as HundredsProblem
    // P8: 368 + 40 = 408 has a zero → 364.
    expect(hundredsDistractors(problems[7]!)).toEqual([364, 382])
    expect(extendedOfferedClass(problems[7]!)).toBe('wrong-place')
    // 376 − 40 = 336: 376 + 40 regroups → 372.
    const regroup = at(6, 'Three hundred and seventy-six. What is forty less?')
    expect(hundredsDistractors(regroup)).toEqual([363, 372])
    expect(extendedOfferedClass(regroup)).toBe('wrong-place')
    // 865 − 200 = 665: 865 + 200 is past 999 → 845.
    const past = at(
      7,
      'Eight hundred and sixty-five. What is two hundred less?',
    )
    expect(hundredsDistractors(past)).toEqual([656, 845])
    expect(extendedOfferedClass(past)).toBe('wrong-place')
  })

  it("hundreds' chips are unchanged (count 1, more: the other two of +1, +10, +100)", () => {
    const h = parse(
      ...Array(5).fill(
        'Two hundreds, three tens and four ones. What number is it?',
      ),
      ...HUNDREDS_MORE.map(([r]) => r),
    ).problems.slice(5) as HundredsProblem[]
    expect(h.map((p) => [...hundredsDistractors(p)])).toEqual(
      HUNDREDS_MORE.map(([, , , , chips]) => chips),
    )
    expect(h.map((p) => extendedOfferedClass(p))).toEqual([
      'wrong-place',
      'wrong-place',
      'wrong-place',
    ])
  })
})

describe('the committed canon (§ 2.7, AC 2)', () => {
  const file = join(
    process.cwd(),
    'public',
    'canon',
    'math',
    'level-1',
    'hundreds-addsub.json',
  )

  it('exists and parses 8/8 into § 2.7', () => {
    expect(existsSync(file)).toBe(true)
    const doc = JSON.parse(readFileSync(file, 'utf8')) as { plan: unknown }
    const plan = mathSessionPlanFromServer(doc.plan, { extendedKinds: true })
    expect(plan.problems.map((p) => p.utterances.read)).toEqual(
      CANON.map(([read]) => read),
    )
    expect(plan.problems.map((p) => p.correct)).toEqual(CANON.map(([, a]) => a))
    expect(
      (plan.problems as MoreProblem[]).map((p) => [p.count, p.direction]),
    ).toEqual([
      [2, 'more'],
      [3, 'more'],
      [3, 'more'],
      [3, 'more'],
      [4, 'more'],
      [2, 'less'],
      [3, 'less'],
      [4, 'less'],
    ])
  })
})
