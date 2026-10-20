/**
 * @vitest-environment node
 *
 * Zeros' and adding big numbers' canon (`design/native/content-wave-5.md`
 * § 2.7, § 3.7, § 9.1, AC 2, AC 3) against
 * `scripts/spliceContentWave5MathCanon.ts`, `hundredsZerosCanonCheck.ts`
 * and `addTwoDigitCanonCheck.ts`:
 *
 * - The committed files are what the splice writes (a hand edit or a Haiku
 *   re-bake fails here), and they equal § 2.7 / § 3.7 line for line.
 * - All 8 reads of each parse (the read-line row of the sibling-tier
 *   checklist): zeros as place-value and "more" problems, adding big
 *   numbers as today's addition.
 * - The lints catch the rules a plan can break.
 * - Exactly § 9.1's texts are left for the Lily render (zeros 31 texts,
 *   993 characters; adding big numbers 26, 697); the reused lines keep
 *   their bytes.
 * - Both steps are pending (never Haiku-baked) and on the voice-QA page.
 *
 * The new texts have empty audio until their Lily render
 * (`npx tsx scripts/revoiceCanonLily.ts --unrendered`); that red lives in
 * `canonIntegrity.test.ts` (a), which has no exemption by design.
 *
 * Failing-first: written before the splice, the checks and the files.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import {
  ADD_TWO_DIGIT_PLAN,
  ADD_TWO_DIGIT_RECAP_FOCUS,
  addTwoDigitCanonViolations,
  addTwoDigitRuleViolations,
  type AddTwoDigitSpec,
} from './addTwoDigitCanonCheck.ts'
import { PENDING_CANON_NODES, activeCombos } from './generateSessionCanon.ts'
import {
  HUNDREDS_ZEROS_PLAN,
  HUNDREDS_ZEROS_RECAP_FOCUS,
  hundredsZerosCanonViolations,
  hundredsZerosRuleViolations,
  type ZerosSpec,
} from './hundredsZerosCanonCheck.ts'
import { MATH_CANON_DIR } from './spliceContentWave1Canon.ts'
import { awaitingRender, type CanonDoc } from './spliceContentWave3Canon.ts'
import {
  ADD_TWO_DIGIT_FILE,
  HUNDREDS_ZEROS_FILE,
  spliceAddTwoDigit,
  spliceHundredsZeros,
} from './spliceContentWave5MathCanon.ts'

const committed = (stem: string) =>
  JSON.parse(
    readFileSync(join(MATH_CANON_DIR, `${stem}.json`), 'utf8'),
  ) as CanonDoc

/** § 2.7 and § 2.4, row by row: read (its length), answer, correct, give
 *  answer, hints 1–3. */
const ZEROS: readonly [
  string,
  number,
  number,
  string,
  string,
  readonly [string, string, string],
][] = [
  [
    'Three hundreds, no tens and five ones. What number is it?',
    57,
    305,
    'Yes! Three hundred and five!',
    'This one is three hundred and five.',
    ['Look at the tens.', 'Zero tens.', 'What number is it?'],
  ],
  [
    'Four hundreds, six tens and no ones. What number is it?',
    55,
    460,
    'Yes! Four hundred and sixty!',
    'This one is four hundred and sixty.',
    ['Look at the ones.', 'Zero ones.', 'What number is it?'],
  ],
  [
    'Seven hundreds, no tens and no ones. What number is it?',
    55,
    700,
    'Yes! Seven hundred!',
    'This one is seven hundred.',
    ['Look at the tens.', 'Zero tens and zero ones.', 'What number is it?'],
  ],
  [
    'One hundred, no tens and eight ones. What number is it?',
    55,
    108,
    'Yes! One hundred and eight!',
    'This one is one hundred and eight.',
    ['Look at the tens.', 'Zero tens.', 'What number is it?'],
  ],
  [
    'Find one hundred and ninety.',
    28,
    190,
    'Yes! One hundred and ninety!',
    'This one is one hundred and ninety.',
    ['Look at the ones.', 'Zero ones.', 'Find one hundred and ninety.'],
  ],
  [
    'Three hundred and five. What is ten more?',
    41,
    315,
    'Yes! Three hundred and fifteen!',
    'This one is three hundred and fifteen.',
    ['Look at the tens.', 'One more ten.', 'What is ten more?'],
  ],
  [
    'Six hundred and forty. What is one hundred more?',
    48,
    740,
    'Yes! Seven hundred and forty!',
    'This one is seven hundred and forty.',
    ['Look at the hundreds.', 'One more hundred.', 'What is one hundred more?'],
  ],
  [
    'Four hundred and sixteen. What is ten less?',
    43,
    406,
    'Yes! Four hundred and six!',
    'This one is four hundred and six.',
    ['Look at the tens.', 'Take away one ten.', 'What is ten less?'],
  ],
]

/** § 3.7, row by row: read (its length), answer, correct, give answer,
 *  hint 2. */
const ADD: readonly [string, number, number, string, string, string][] = [
  [
    'Thirty-four plus twenty-five. How many?',
    39,
    59,
    'Yes! Fifty-nine!',
    'This one is fifty-nine.',
    'Look at the tens.',
  ],
  [
    'Forty-two plus thirty-six. How many?',
    36,
    78,
    'Yes! Seventy-eight!',
    'This one is seventy-eight.',
    'Look at the tens.',
  ],
  [
    'Twenty-eight plus thirty-five. How many?',
    40,
    63,
    'Yes! Sixty-three!',
    'This one is sixty-three.',
    'Ten ones make a ten.',
  ],
  [
    'Forty-seven plus twenty-six. How many?',
    38,
    73,
    'Yes! Seventy-three!',
    'This one is seventy-three.',
    'Ten ones make a ten.',
  ],
  [
    'Thirty-nine plus forty-four. How many?',
    38,
    83,
    'Yes! Eighty-three!',
    'This one is eighty-three.',
    'Ten ones make a ten.',
  ],
  [
    'Fifty-six plus twenty-eight. How many?',
    38,
    84,
    'Yes! Eighty-four!',
    'This one is eighty-four.',
    'Ten ones make a ten.',
  ],
  [
    'Twenty-nine plus thirty-three. How many?',
    40,
    62,
    'Yes! Sixty-two!',
    'This one is sixty-two.',
    'Ten ones make a ten.',
  ],
  [
    'Sixty-five plus twenty-seven. How many?',
    39,
    92,
    'Yes! Ninety-two!',
    'This one is ninety-two.',
    'Ten ones make a ten.',
  ],
]

/** The new texts of a file: every distinct text but the reused lines and
 *  the shared session-end lines (the recap is the step's own). */
function newTexts(doc: CanonDoc, reused: ReadonlySet<string>): string[] {
  return [
    ...new Set(
      doc.utterances
        .filter(
          (u) =>
            !reused.has(u.text) &&
            (!u.id.startsWith('session.end.') ||
              u.id === 'session.end.recap.focus'),
        )
        .map((u) => u.text),
    ),
  ]
}

describe('hundreds-zeros.json (§ 2.7, AC 2)', () => {
  const doc = committed(HUNDREDS_ZEROS_FILE)
  const text = (id: string) =>
    doc.plan.utterances.find((u) => u.id === id)?.text

  it('is exactly what the splice writes', () => {
    expect(doc).toEqual(spliceHundredsZeros())
  })

  it('equals § 2.7 line for line', () => {
    ZEROS.forEach(([read, length, , correct, give, hints], i) => {
      const n = i + 1
      expect(text(`math.p${n}.read`)).toBe(read)
      expect(read).toHaveLength(length)
      expect(text(`math.p${n}.correct`)).toBe(correct)
      expect(text(`math.p${n}.reprompt`)).toBe('Hmm... try again?')
      expect(text(`math.p${n}.giveAnswer`)).toBe(give)
      expect([1, 2, 3].map((k) => text(`math.p${n}.hint${k}`))).toEqual(hints)
    })
    expect(text('session.end.recap.focus')).toBe(HUNDREDS_ZEROS_RECAP_FOCUS)
    expect(HUNDREDS_ZEROS_RECAP_FOCUS).toBe('You worked on zeros today!')
    expect(doc.plan.id).toBe('hundreds-zeros-level-1')
    expect(hundredsZerosCanonViolations(doc.plan.utterances)).toEqual([])
  })

  it('parses 8/8: P1–P5 place-value (P5 the name form), P6–P8 one ten or hundred more or less', () => {
    const plan = mathSessionPlanFromServer(doc.plan, { extendedKinds: true })
    expect(plan.problems.map((p) => p.kind)).toEqual([
      ...Array(5).fill('place-value'),
      ...Array(3).fill('more'),
    ])
    expect(plan.problems.map((p) => p.correct)).toEqual(
      ZEROS.map(([, , answer]) => answer),
    )
  })

  it('leaves § 9.1’s 31 texts (993 characters) for the Lily render; the reused lines keep their bytes', () => {
    const reused = new Set([
      'Hmm... try again?',
      'Look at the hundreds.',
      'Look at the tens.',
      'Look at the ones.',
      'One more ten.',
      'One more hundred.',
      'What is ten more?',
      'What is one hundred more?',
    ])
    const fresh = newTexts(doc, reused)
    expect(fresh).toHaveLength(31)
    expect(fresh.reduce((n, t) => n + t.length, 0)).toBe(993)
    const waiting = awaitingRender(doc)
    expect(waiting).toEqual(waiting.length > 0 ? fresh : [])
    const audio = (t: string) =>
      doc.utterances.find((u) => u.text === t)!.audio.base64
    for (const t of reused) expect(audio(t)).not.toBe('')
    expect(audio('You did it!')).not.toBe('')
  })
})

describe('add-two-digit.json (§ 3.7, AC 3)', () => {
  const doc = committed(ADD_TWO_DIGIT_FILE)
  const text = (id: string) =>
    doc.plan.utterances.find((u) => u.id === id)?.text

  it('is exactly what the splice writes', () => {
    expect(doc).toEqual(spliceAddTwoDigit())
  })

  it('equals § 3.7 line for line', () => {
    ADD.forEach(([read, length, , correct, give, hint2], i) => {
      const n = i + 1
      expect(text(`math.p${n}.read`)).toBe(read)
      expect(read).toHaveLength(length)
      expect(text(`math.p${n}.correct`)).toBe(correct)
      expect(text(`math.p${n}.reprompt`)).toBe('Hmm... try again?')
      expect(text(`math.p${n}.giveAnswer`)).toBe(give)
      expect([1, 2, 3].map((k) => text(`math.p${n}.hint${k}`))).toEqual([
        'Look at the ones.',
        hint2,
        'How many?',
      ])
    })
    expect(text('session.end.recap.focus')).toBe(ADD_TWO_DIGIT_RECAP_FOCUS)
    expect(ADD_TWO_DIGIT_RECAP_FOCUS).toBe(
      'You worked on adding big numbers today!',
    )
    expect(doc.plan.id).toBe('add-two-digit-level-1')
    expect(addTwoDigitCanonViolations(doc.plan.utterances)).toEqual([])
  })

  it('parses 8/8 as addition with § 3.7’s answers', () => {
    const plan = mathSessionPlanFromServer(doc.plan, { extendedKinds: true })
    expect(plan.problems.map((p) => p.kind)).toEqual(
      Array(8).fill('arithmetic'),
    )
    expect(plan.problems.map((p) => p.correct)).toEqual(
      ADD.map(([, , answer]) => answer),
    )
  })

  it('leaves § 9.1’s 26 texts (697 characters) for the Lily render; the reused lines keep their bytes', () => {
    const reused = new Set([
      'Hmm... try again?',
      'Look at the tens.',
      'Look at the ones.',
      'How many?',
    ])
    const fresh = newTexts(doc, reused)
    expect(fresh).toHaveLength(26)
    expect(fresh.reduce((n, t) => n + t.length, 0)).toBe(697)
    const waiting = awaitingRender(doc)
    expect(waiting).toEqual(waiting.length > 0 ? fresh : [])
    const audio = (t: string) =>
      doc.utterances.find((u) => u.text === t)!.audio.base64
    for (const t of reused) expect(audio(t)).not.toBe('')
  })
})

describe('the § 2.7 lint', () => {
  const swap = (n: number, spec: ZerosSpec): ZerosSpec[] =>
    HUNDREDS_ZEROS_PLAN.map((s, i) => (i === n - 1 ? spec : s))
  const pv = (h: number, t: number, o: number): ZerosSpec => ({
    kind: 'place-value',
    form: 'places',
    hundreds: h,
    tens: t,
    ones: o,
  })

  it('the plan is clean', () => {
    expect(hundredsZerosRuleViolations(HUNDREDS_ZEROS_PLAN)).toEqual([])
  })

  it.each([
    ['no zero', swap(2, pv(4, 6, 2)), /P2: no zero/],
    ['a 1 outside the hundreds', swap(1, pv(3, 0, 1)), /P1: a 1 outside/],
    ['more than 8 cubes', swap(1, pv(3, 0, 9)), /P1: 9 cubes/],
    [
      'a regroup',
      swap(6, { kind: 'more', start: 390, step: 10, direction: 'more' }),
      /P6: 390 \+ 10 regroups/,
    ],
    [
      'a name read out of place',
      swap(1, {
        kind: 'place-value',
        form: 'name',
        hundreds: 3,
        tens: 0,
        ones: 5,
      }),
      /P1: P1-P4 build/,
    ],
  ])('catches %s', (_name, plan, message) => {
    expect(hundredsZerosRuleViolations(plan).join('\n')).toMatch(message)
  })

  it('catches chips off the table and a drifted line', () => {
    expect(
      hundredsZerosRuleViolations(HUNDREDS_ZEROS_PLAN, [[305, 505, 706]]).join(
        '\n',
      ),
    ).toMatch(/P1: chips 305/)
    const bad = committed(HUNDREDS_ZEROS_FILE).plan.utterances.map((u) =>
      u.id === 'math.p3.hint2' ? { ...u, text: 'No tens.' } : u,
    )
    expect(hundredsZerosCanonViolations(bad).join('\n')).toMatch(
      /math\.p3\.hint2/,
    )
  })
})

describe('the § 3.7 lint', () => {
  const swap = (n: number, spec: AddTwoDigitSpec): AddTwoDigitSpec[] =>
    ADD_TWO_DIGIT_PLAN.map((s, i) => (i === n - 1 ? spec : s))

  it('the plan is clean', () => {
    expect(addTwoDigitRuleViolations(ADD_TWO_DIGIT_PLAN)).toEqual([])
  })

  it.each([
    [
      'a zero digit',
      swap(4, { addendA: 40, addendB: 26 }),
      /P4: the addend 40/,
    ],
    [
      'a new ten in P1',
      swap(1, { addendA: 38, addendB: 25 }),
      /P1: makes a new ten/,
    ],
    [
      'no new ten in P5',
      swap(5, { addendA: 31, addendB: 44 }),
      /P5: the ones make 5/,
    ],
    [
      'an answer above 99',
      swap(8, { addendA: 65, addendB: 47 }),
      /P8: the answer 112/,
    ],
  ])('catches %s', (_name, plan, message) => {
    expect(addTwoDigitRuleViolations(plan).join('\n')).toMatch(message)
  })
})

describe('both steps in the bake lists', () => {
  it.each(['hundreds-zeros', 'add-two-digit'])(
    '%s is pending (never Haiku-baked) and an active combo',
    (node) => {
      expect(PENDING_CANON_NODES.has(node)).toBe(true)
      expect(
        activeCombos().filter(
          (c) => c.track === 'math' && c.focusNode === node,
        ),
      ).toHaveLength(1)
    },
  )

  it('both are on the voice-QA page (CANON_FILES)', () => {
    const html = readFileSync(
      resolve(process.cwd(), 'public/voice-qa.html'),
      'utf8',
    )
    const block = html.slice(
      html.indexOf('const CANON_FILES'),
      html.indexOf('const GREET_FILES'),
    )
    expect(block).toContain(`['math', 'hundreds-zeros']`)
    expect(block).toContain(`['math', 'add-two-digit']`)
  })
})
