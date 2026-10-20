/**
 * Hundreds' read lines, chips and canon (content wave 3,
 * `design/native/content-wave-3.md` § 3.6, § 3.7, AC 2, AC 3): "Two
 * hundreds, three tens and four ones. What number is it?" is a
 * `place-value` problem and "Two hundred and forty-three. What is ten
 * more?" a `more` problem in the opt-in extended plan, and nothing in the
 * default (web) parse.
 *
 * Failing-first: written before the parser branch, the chip picker and the
 * canon file existed.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  extendedDistractors,
  extendedOfferedClass,
  hundredsDistractors,
  multiplyChipCeiling,
  SKIP_COUNT_CHIP_MAX,
} from './extendedDistractors'
import {
  EXTENDED_ANSWER_MAX,
  TWO_DIGIT_CHIP_MAX,
  isHundredsProblem,
  problemFact,
  type HundredsProblem,
} from './extendedProblems'
import {
  mathSessionPlanFromServer,
  numberToWords,
  PlanFromServerError,
  wordToNumber,
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
    id: 'canon-hundreds',
    label: 'Hundreds',
    utterances: Array.from({ length: 8 }, (_, i) =>
      SLOTS.map((slot) => ({
        id: `math.p${i + 1}.${slot}`,
        text: slot === 'read' ? (reads[i] ?? reads[0]!) : 'Hmm... try again?',
      })),
    ).flat(),
  }
}

const first = (read: string) =>
  mathSessionPlanFromServer(planReading(read), { extendedKinds: true })
    .problems[0]!

/** § 3.7, the binding canon: read, answer, chips (correct first). */
const CANON: readonly [string, number, readonly number[]][] = [
  [
    'Two hundreds, three tens and four ones. What number is it?',
    234,
    [234, 434, 634],
  ],
  [
    'Three hundreds, five tens and two ones. What number is it?',
    352,
    [352, 552, 752],
  ],
  [
    'Four hundreds, two tens and six ones. What number is it?',
    426,
    [426, 626, 826],
  ],
  [
    'Five hundreds, three tens and seven ones. What number is it?',
    537,
    [537, 573, 547],
  ],
  [
    'Three hundreds, six ones and two tens. What number is it?',
    326,
    [326, 362, 336],
  ],
  ['Two hundred and forty-three. What is ten more?', 253, [253, 244, 343]],
  [
    'Four hundred and sixty-five. What is one hundred more?',
    565,
    [565, 475, 466],
  ],
  ['Seven hundred and twenty-eight. What is ten more?', 738, [738, 729, 828]],
]

describe('hundreds number words (§ 3.6)', () => {
  it.each([
    ['two hundred', 200],
    ['one hundred', 100],
    ['two hundred and forty-three', 243],
    ['seven hundred and twenty-eight', 728],
    ['nine hundred and ninety-nine', 999],
    ['four hundred and six', 406],
    ['three hundred and twelve', 312],
  ])('wordToNumber("%s") = %i', (word, n) => {
    expect(wordToNumber(word)).toBe(n)
  })

  it.each([
    'hundred',
    'ten hundred',
    'two hundred and',
    'two hundred forty-three',
    'two hundreds',
    'two hundred and two hundred',
  ])('wordToNumber("%s") is undefined', (word) => {
    expect(wordToNumber(word)).toBeUndefined()
  })

  it('numberToWords is British, with "and", and round-trips 100..999', () => {
    expect(numberToWords(234)).toBe('two hundred and thirty-four')
    expect(numberToWords(300)).toBe('three hundred')
    expect(numberToWords(565)).toBe('five hundred and sixty-five')
    expect(numberToWords(810)).toBe('eight hundred and ten')
    for (let n = 100; n <= 999; n++)
      expect(wordToNumber(numberToWords(n))).toBe(n)
  })
})

describe('the hundreds reads (§ 3.6, AC 2)', () => {
  it('P1 → place-value 2, 3, 4 = 234, place order', () => {
    const p = first(CANON[0]![0])
    expect(p).toMatchObject({
      kind: 'place-value',
      index: 1,
      hundreds: 2,
      tens: 3,
      ones: 4,
      spokenOrder: ['hundreds', 'tens', 'ones'],
      correct: 234,
    })
  })

  it('P5 → spoken order hundreds, ones, tens; 326', () => {
    expect(first(CANON[4]![0])).toMatchObject({
      kind: 'place-value',
      hundreds: 3,
      tens: 2,
      ones: 6,
      spokenOrder: ['hundreds', 'ones', 'tens'],
      correct: 326,
    })
  })

  it('P6 → more 243 + 10 = 253; P7 → 465 + 100 = 565', () => {
    expect(first(CANON[5]![0])).toMatchObject({
      kind: 'more',
      start: 243,
      step: 10,
      correct: 253,
    })
    expect(first(CANON[6]![0])).toMatchObject({
      kind: 'more',
      start: 465,
      step: 100,
      correct: 565,
    })
  })

  it.each([
    [
      'a digit of one',
      'One hundreds, three tens and four ones. What number is it?',
    ],
    [
      'a place twice',
      'Two hundreds, three tens and four tens. What number is it?',
    ],
    // A zero in the start parses since zeros (content wave 5 § 2.6);
    // hundreds keeps none by its canon lint (`hundredsCanonCheck.ts`).
    ['regrouping on +10', 'Two hundred and ninety-three. What is ten more?'],
    [
      'regrouping on +100',
      'Nine hundred and twenty-three. What is one hundred more?',
    ],
    ['a two-digit start', 'Forty-three. What is ten more?'],
  ])('rejects %s', (_name, read) => {
    expect(() =>
      mathSessionPlanFromServer(planReading(read), { extendedKinds: true }),
    ).toThrow(PlanFromServerError)
  })

  it('throws without extendedKinds (the frozen web keeps its silent fallback)', () => {
    for (const [read] of [CANON[0]!, CANON[5]!])
      expect(() => mathSessionPlanFromServer(planReading(read))).toThrow(
        PlanFromServerError,
      )
  })

  it('records no Leitner fact (K7)', () => {
    for (const [read] of CANON) expect(problemFact(first(read))).toBeNull()
  })
})

describe('the hundreds chips (§ 3.6, § 3.7, AC 3)', () => {
  const plan = mathSessionPlanFromServer(
    planReading(...CANON.map(([read]) => read)),
    { extendedKinds: true },
  )
  const problems = plan.problems.filter(isHundredsProblem) as HundredsProblem[]

  it('parses 8/8 with § 3.7 answers', () => {
    expect(problems.map((p) => p.correct)).toEqual(CANON.map(([, a]) => a))
  })

  it.each(CANON.map(([read, , chips], i) => [i + 1, read, chips] as const))(
    'P%i: hundredsDistractors gives § 3.7 chips',
    (i, _read, chips) => {
      const p = problems[i - 1]!
      const wrong = hundredsDistractors(p)
      expect([...wrong].sort()).toEqual([...chips.slice(1)].sort())
      // Through the shared picker too (the ceiling is not read).
      expect(extendedDistractors(p, 99)).toEqual(wrong)
      const all = [p.correct, ...wrong]
      expect(new Set(all).size).toBe(3)
      for (const c of all) {
        expect(c).toBeGreaterThanOrEqual(100)
        expect(c).toBeLessThanOrEqual(999)
      }
    },
  )

  it('offers gentle (P1–P3), digit-swap (P4), spoken-order (P5), wrong-place (P6–P8)', () => {
    expect(problems.map((p) => extendedOfferedClass(p))).toEqual([
      'gentle',
      'gentle',
      'gentle',
      'digit-swap',
      'spoken-order',
      'wrong-place',
      'wrong-place',
      'wrong-place',
    ])
  })

  it('gentle chips step the hundreds down above 5 (− 2, − 4)', () => {
    const p = first(
      'Seven hundreds, three tens and four ones. What number is it?',
    )
    expect(hundredsDistractors(p as HundredsProblem)).toEqual([334, 534])
  })

  it('digit-swap with tens 9 takes tens − 1', () => {
    const p = mathSessionPlanFromServer(
      planReading(
        ...CANON.slice(0, 3).map(([r]) => r),
        'Five hundreds, nine tens and seven ones. What number is it?',
      ),
      { extendedKinds: true },
    ).problems[3] as HundredsProblem
    expect(hundredsDistractors(p)).toEqual([579, 587])
  })
})

describe('G4: the cap is 999; skip and times chips do not change', () => {
  it('EXTENDED_ANSWER_MAX is 999, TWO_DIGIT_CHIP_MAX 99', () => {
    expect(EXTENDED_ANSWER_MAX).toBe(999)
    expect(TWO_DIGIT_CHIP_MAX).toBe(99)
    expect(SKIP_COUNT_CHIP_MAX).toBe(99)
    expect(multiplyChipCeiling([99])).toBe(99)
  })
})

describe('the committed canon (§ 3.7, AC 3)', () => {
  const file = join(
    process.cwd(),
    'public',
    'canon',
    'math',
    'level-1',
    'hundreds.json',
  )

  it('exists and parses 8/8 into § 3.7', () => {
    expect(existsSync(file)).toBe(true)
    const doc = JSON.parse(readFileSync(file, 'utf8')) as { plan: unknown }
    const plan = mathSessionPlanFromServer(doc.plan, { extendedKinds: true })
    expect(plan.problems.map((p) => p.utterances.read)).toEqual(
      CANON.map(([read]) => read),
    )
    expect(plan.problems.map((p) => p.correct)).toEqual(CANON.map(([, a]) => a))
  })
})
