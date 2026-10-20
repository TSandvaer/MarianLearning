/**
 * Zeros' read lines and chips (content wave 5,
 * `design/native/content-wave-5.md` § 2.6, § 2.7, AC 1, AC 2): a
 * place-value read may name a place with "no" ("no tens", a zero digit)
 * and the hundreds with "One hundred"; the new name read "Find <number>."
 * is a place-value problem of `form: 'name'`; a "more" read may carry a
 * zero in its start or answer, and its changed digit may become 0. The
 * chips: `'zero-drop'` (108 → 18, the only chip allowed below 100) and
 * the digit swap on a zero problem from P4; a count-1 "less" takes
 * hundreds' wrong-place rule, signed. Hundreds' and more and less's reads
 * and chips are unchanged.
 *
 * Failing-first: written before the widened templates, the name read and
 * the zero-drop chips existed.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  extendedOfferedClass,
  hundredsDistractors,
} from './extendedDistractors'
import {
  isHundredsProblem,
  PLACE_PARTS,
  problemFact,
  type ExtendedMathProblem,
  type HundredsProblem,
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
    id: 'canon-hundreds-zeros',
    label: 'Zeros',
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
const first = (read: string): ExtendedMathProblem => parse(read).problems[0]!

/** § 2.7's reads, P1..P8. */
const READS = [
  'Three hundreds, no tens and five ones. What number is it?',
  'Four hundreds, six tens and no ones. What number is it?',
  'Seven hundreds, no tens and no ones. What number is it?',
  'One hundred, no tens and eight ones. What number is it?',
  'Find one hundred and ninety.',
  'Three hundred and five. What is ten more?',
  'Six hundred and forty. What is one hundred more?',
  'Four hundred and sixteen. What is ten less?',
]
/** § 2.7's chips, the answer first, and the recorded class. */
const CHIPS: readonly [number, number, number][] = [
  [305, 505, 705],
  [460, 660, 860],
  [700, 500, 300],
  [108, 18, 180],
  [190, 19, 109],
  [315, 306, 405],
  [740, 641, 650],
  [406, 415, 316],
]
const CLASSES = [
  'gentle',
  'gentle',
  'gentle',
  'zero-drop',
  'zero-drop',
  'wrong-place',
  'wrong-place',
  'wrong-place',
]

describe('the widened place-value read (§ 2.6, AC 1)', () => {
  it('P1 names a zero place with "no"', () => {
    expect(first(READS[0]!)).toMatchObject({
      kind: 'place-value',
      hundreds: 3,
      tens: 0,
      ones: 5,
      spokenOrder: ['hundreds', 'tens', 'ones'],
      form: 'places',
      correct: 305,
    })
  })

  it('P4 starts with "One hundred" (the singular)', () => {
    expect(first(READS[3]!)).toMatchObject({
      kind: 'place-value',
      hundreds: 1,
      tens: 0,
      ones: 8,
      form: 'places',
      correct: 108,
    })
  })

  it('P2 and P3: the zero in the ones, and in both', () => {
    expect(first(READS[1]!)).toMatchObject({ tens: 6, ones: 0, correct: 460 })
    expect(first(READS[2]!)).toMatchObject({ tens: 0, ones: 0, correct: 700 })
  })

  it.each([
    'Three hundreds, one ten and five ones. What number is it?',
    'Three hundreds, one tens and five ones. What number is it?',
    'No hundreds, four tens and two ones. What number is it?',
    'One hundreds, four tens and two ones. What number is it?',
    'Two hundred, four tens and two ones. What number is it?',
    'Three hundreds, no tens and no tens. What number is it?',
  ])('rejects "%s"', (read) => {
    expect(() => parse(read)).toThrow(PlanFromServerError)
  })
})

describe('the name read "Find <number>." (§ 2.6, AC 1)', () => {
  it('P5 is a place-value problem of form "name", the places in place order', () => {
    expect(first(READS[4]!)).toMatchObject({
      kind: 'place-value',
      hundreds: 1,
      tens: 9,
      ones: 0,
      spokenOrder: PLACE_PARTS,
      form: 'name',
      correct: 190,
    })
  })

  it.each(['Find forty-two.', 'Find seven.', 'Find a cat.'])(
    'rejects "%s" (below 100, or not a number)',
    (read) => {
      expect(() => parse(read)).toThrow(PlanFromServerError)
    },
  )

  it('the web (default) parse never reads it', () => {
    expect(() => mathSessionPlanFromServer(planReading(READS[4]!))).toThrow(
      PlanFromServerError,
    )
  })
})

describe('the widened more read (§ 2.6, AC 1)', () => {
  it('P6 and P7 carry a zero in the start; P8 makes one', () => {
    expect(first(READS[5]!)).toMatchObject({
      kind: 'more',
      start: 305,
      step: 10,
      count: 1,
      direction: 'more',
      correct: 315,
    })
    expect(first(READS[6]!)).toMatchObject({
      kind: 'more',
      start: 640,
      step: 100,
      count: 1,
      direction: 'more',
      correct: 740,
    })
    expect(first(READS[7]!)).toMatchObject({
      kind: 'more',
      start: 416,
      step: 10,
      count: 1,
      direction: 'less',
      correct: 406,
    })
  })

  it.each([
    'Three hundred and ninety-five. What is ten more?',
    'Four hundred and five. What is ten less?',
    'One hundred and five. What is one hundred less?',
  ])('rejects "%s" (a regroup, or below 100)', (read) => {
    expect(() => parse(read)).toThrow(PlanFromServerError)
  })
})

describe("hundreds' and more and less's reads still parse as before (AC 1)", () => {
  const canonReads = (stem: string): string[] => {
    const path = join(
      __dirname,
      '../../../../public/canon/math/level-1',
      `${stem}.json`,
    )
    const doc = JSON.parse(readFileSync(path, 'utf8')) as {
      plan: { utterances: { id: string; text: string }[] }
    }
    return doc.plan.utterances
      .filter((u) => /^math\.p\d\.read$/.test(u.id))
      .map((u) => u.text)
  }

  it.each(['hundreds', 'hundreds-addsub'])(
    '%s: 8/8 parse, with their digits and chips unchanged',
    (stem) => {
      const plan = parse(...canonReads(stem))
      expect(plan.problems).toHaveLength(8)
      for (const p of plan.problems) {
        expect(isHundredsProblem(p)).toBe(true)
        if (p.kind === 'place-value') {
          expect(p.form).toBe('places')
          for (const place of PLACE_PARTS)
            expect(p[place]).toBeGreaterThanOrEqual(2)
        }
      }
    },
  )
})

describe("zeros' chips and classes (§ 2.6, § 2.7, AC 2)", () => {
  const problems = parse(...READS).problems as HundredsProblem[]

  it.each(CHIPS.map((c, i) => [i + 1, c] as const))(
    'P%i: %j',
    (n, [answer, ...wrong]) => {
      const p = problems[n - 1]!
      expect(p.correct).toBe(answer)
      expect(hundredsDistractors(p)).toEqual([...wrong].sort((a, b) => a - b))
      expect(extendedOfferedClass(p)).toBe(CLASSES[n - 1])
    },
  )

  it('the zero-drop chip is the only one below 100; the three chips differ', () => {
    for (const p of problems) {
      const chips = [p.correct, ...hundredsDistractors(p)]
      expect(new Set(chips).size).toBe(3)
      const small = chips.filter((c) => c < 100)
      expect(small.length).toBeLessThanOrEqual(1)
      for (const c of small) {
        expect(extendedOfferedClass(p)).toBe('zero-drop')
        expect(c).toBeGreaterThanOrEqual(10)
      }
    }
  })

  it('a zero problem at P1–P3 stays gentle and from P4 drops its zero; a no-zero read from P4 keeps its digit swap', () => {
    const [p1] = parse(READS[0]!).problems as HundredsProblem[]
    expect(extendedOfferedClass(p1!)).toBe('gentle')
    const late = { ...problems[0]!, index: 4 } as HundredsProblem
    expect(extendedOfferedClass(late)).toBe('zero-drop')
    expect(hundredsDistractors(late)).toEqual([35, 350])
    const [noZero] = parse(
      'Five hundreds, three tens and seven ones. What number is it?',
    ).problems as HundredsProblem[]
    const swap = { ...noZero!, index: 4 } as HundredsProblem
    expect(extendedOfferedClass(swap)).toBe('digit-swap')
    expect(hundredsDistractors(swap)).toEqual([547, 573])
  })

  it('records no fact', () => {
    for (const p of problems) expect(problemFact(p)).toBeNull()
  })
})

describe('the committed zeros canon (§ 2.7, AC 2)', () => {
  const path = join(
    __dirname,
    '../../../../public/canon/math/level-1/hundreds-zeros.json',
  )

  it('exists and parses 8/8 to § 2.7', () => {
    expect(existsSync(path)).toBe(true)
    const doc = JSON.parse(readFileSync(path, 'utf8')) as { plan: unknown }
    const plan = mathSessionPlanFromServer(doc.plan, { extendedKinds: true })
    expect(plan.problems.map((p) => p.utterances.read)).toEqual(READS)
    expect(plan.problems.map((p) => p.correct)).toEqual(CHIPS.map((c) => c[0]))
  })
})
