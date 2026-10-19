/**
 * @vitest-environment node
 *
 * More and less's canon (`design/native/content-wave-4.md` § 2.7, § 8.1,
 * AC 2) against `scripts/spliceContentWave4MathCanon.ts` and
 * `scripts/hundredsAddsubCanonCheck.ts`:
 *
 * - The committed `hundreds-addsub.json` is what the splice writes (a hand
 *   edit or a Haiku re-bake fails here), and it equals § 2.7 line for line.
 * - All 8 reads parse (the read-line row of the sibling-tier checklist),
 *   as `more` problems with count 2–4, § 2.7's answers and changes.
 * - The lint catches every § 2.7 rule a plan can break, the per-file rule
 *   (count 2–4 here, count 1 'more' in hundreds) included.
 * - Exactly § 8.1's 39 texts (1,349 characters) are left for the Lily
 *   render; "Hmm... try again?", the two "Look at the …" hints and the
 *   session-end lines keep their bytes.
 * - The step is pending (never Haiku-baked) and voice-QA lists it.
 *
 * The 39 new texts have empty audio until their Lily render
 * (`npx tsx scripts/revoiceCanonLily.ts --unrendered`); that red lives in
 * `canonIntegrity.test.ts` (a), which has no exemption by design.
 *
 * Failing-first: written before the splice, the check and the file.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { MoreProblem } from '@marian/core/math/extendedProblems'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { PENDING_CANON_NODES, activeCombos } from './generateSessionCanon.ts'
import {
  HUNDREDS_ADDSUB_PLAN,
  HUNDREDS_ADDSUB_RECAP_FOCUS,
  hundredsAddsubCanonViolations,
  hundredsAddsubRuleViolations,
  type MoreAndLessSpec,
} from './hundredsAddsubCanonCheck.ts'
import { HUNDREDS_PLAN } from './hundredsCanonCheck.ts'
import { MATH_CANON_DIR } from './spliceContentWave1Canon.ts'
import { awaitingRender, type CanonDoc } from './spliceContentWave3Canon.ts'
import {
  HUNDREDS_ADDSUB_FILE,
  spliceHundredsAddsub,
} from './spliceContentWave4MathCanon.ts'

const committed = () =>
  JSON.parse(
    readFileSync(join(MATH_CANON_DIR, `${HUNDREDS_ADDSUB_FILE}.json`), 'utf8'),
  ) as CanonDoc

/** § 2.7, row by row: read (its length), answer, correct, give answer,
 *  hints 1–3. */
const TABLE: readonly [
  string,
  number,
  number,
  string,
  string,
  readonly [string, string, string],
][] = [
  [
    'Two hundred and thirty-five. What is two hundred more?',
    54,
    435,
    'Yes! Four hundred and thirty-five!',
    'This one is four hundred and thirty-five.',
    [
      'Look at the hundreds.',
      'Two more hundreds.',
      'What is two hundred more?',
    ],
  ],
  [
    'Three hundred and twenty-four. What is thirty more?',
    51,
    354,
    'Yes! Three hundred and fifty-four!',
    'This one is three hundred and fifty-four.',
    ['Look at the tens.', 'Three more tens.', 'What is thirty more?'],
  ],
  [
    'Four hundred and twenty-six. What is three hundred more?',
    56,
    726,
    'Yes! Seven hundred and twenty-six!',
    'This one is seven hundred and twenty-six.',
    [
      'Look at the hundreds.',
      'Three more hundreds.',
      'What is three hundred more?',
    ],
  ],
  [
    'Five hundred and thirty-two. What is thirty more?',
    49,
    562,
    'Yes! Five hundred and sixty-two!',
    'This one is five hundred and sixty-two.',
    ['Look at the tens.', 'Three more tens.', 'What is thirty more?'],
  ],
  [
    'Two hundred and forty-five. What is four hundred more?',
    54,
    645,
    'Yes! Six hundred and forty-five!',
    'This one is six hundred and forty-five.',
    [
      'Look at the hundreds.',
      'Four more hundreds.',
      'What is four hundred more?',
    ],
  ],
  [
    'Six hundred and fifty-three. What is two hundred less?',
    54,
    453,
    'Yes! Four hundred and fifty-three!',
    'This one is four hundred and fifty-three.',
    [
      'Look at the hundreds.',
      'Take away two hundreds.',
      'What is two hundred less?',
    ],
  ],
  [
    'Seven hundred and sixty-five. What is thirty less?',
    50,
    735,
    'Yes! Seven hundred and thirty-five!',
    'This one is seven hundred and thirty-five.',
    ['Look at the tens.', 'Take away three tens.', 'What is thirty less?'],
  ],
  [
    'Three hundred and sixty-eight. What is forty less?',
    50,
    328,
    'Yes! Three hundred and twenty-eight!',
    'This one is three hundred and twenty-eight.',
    ['Look at the tens.', 'Take away four tens.', 'What is forty less?'],
  ],
]

describe('hundreds-addsub.json (§ 2.7, AC 2)', () => {
  const doc = committed()
  const text = (id: string) =>
    doc.plan.utterances.find((u) => u.id === id)?.text

  it('is exactly what the splice writes', () => {
    expect(doc).toEqual(spliceHundredsAddsub())
  })

  it('equals § 2.7 line for line', () => {
    TABLE.forEach(([read, length, , correct, give, hints], i) => {
      const n = i + 1
      expect(text(`math.p${n}.read`)).toBe(read)
      expect(read).toHaveLength(length)
      expect(text(`math.p${n}.correct`)).toBe(correct)
      expect(text(`math.p${n}.reprompt`)).toBe('Hmm... try again?')
      expect(text(`math.p${n}.giveAnswer`)).toBe(give)
      expect([1, 2, 3].map((k) => text(`math.p${n}.hint${k}`))).toEqual(hints)
    })
    expect(text('session.end.recap.focus')).toBe(HUNDREDS_ADDSUB_RECAP_FOCUS)
    expect(HUNDREDS_ADDSUB_RECAP_FOCUS).toBe(
      'You worked on more and less today!',
    )
    expect(doc.plan.id).toBe('hundreds-addsub-level-1')
    expect(hundredsAddsubCanonViolations(doc.plan.utterances)).toEqual([])
  })

  it('parses 8/8 as more problems with count 2–4 and § 2.7 answers', () => {
    const plan = mathSessionPlanFromServer(doc.plan, { extendedKinds: true })
    const problems = plan.problems as MoreProblem[]
    expect(problems.map((p) => p.kind)).toEqual(Array(8).fill('more'))
    expect(problems.map((p) => p.correct)).toEqual(
      TABLE.map(([, , answer]) => answer),
    )
    for (const p of problems) {
      expect(p.count).toBeGreaterThanOrEqual(2)
      expect(p.count).toBeLessThanOrEqual(4)
    }
  })

  it('leaves § 8.1’s 39 texts (1,349 characters) for the Lily render, none after it; the rest keep their bytes', () => {
    const reused = new Set([
      'Hmm... try again?',
      'Look at the hundreds.',
      'Look at the tens.',
    ])
    const newTexts = [
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
    expect(newTexts).toHaveLength(39)
    expect(newTexts.reduce((n, t) => n + t.length, 0)).toBe(1349)
    expect(newTexts).toContain(HUNDREDS_ADDSUB_RECAP_FOCUS)
    // Before the render: exactly these. After it: none.
    const waiting = awaitingRender(doc)
    expect(waiting).toEqual(waiting.length > 0 ? newTexts : [])
    const audio = (t: string) =>
      doc.utterances.find((u) => u.text === t)!.audio.base64
    for (const t of reused) expect(audio(t)).not.toBe('')
    expect(audio('You did it!')).not.toBe('')
  })
})

describe('the § 2.7 lint', () => {
  const swap = (n: number, spec: MoreAndLessSpec): MoreAndLessSpec[] =>
    HUNDREDS_ADDSUB_PLAN.map((s, i) => (i === n - 1 ? spec : s))

  it('the plan is clean', () => {
    expect(hundredsAddsubRuleViolations(HUNDREDS_ADDSUB_PLAN)).toEqual([])
  })

  it.each([
    [
      'a zero in the start',
      swap(4, { start: 502, step: 10, count: 3, direction: 'more' }),
      /P4: 502 has a zero digit/,
    ],
    [
      'a zero in the answer',
      swap(8, { start: 342, step: 10, count: 4, direction: 'less' }),
      /P8: the answer 302 has a zero digit/,
    ],
    [
      'a regroup',
      swap(7, { start: 725, step: 10, count: 3, direction: 'less' }),
      /P7: 725 − 30 regroups/,
    ],
    [
      'a count of 1 (hundreds’ own problem)',
      swap(2, { start: 324, step: 10, count: 1, direction: 'more' }),
      /P2: count 1/,
    ],
    [
      'a repeated digit',
      swap(1, { start: 232, step: 100, count: 2, direction: 'more' }),
      /P1: a digit repeats/,
    ],
    [
      'more than 7 flats',
      swap(5, { start: 645, step: 100, count: 2, direction: 'more' }),
      /P5: 8 flats/,
    ],
  ])('catches %s', (_name, plan, message) => {
    expect(hundredsAddsubRuleViolations(plan).join('\n')).toMatch(message)
  })

  it('catches chips off the table', () => {
    const chips = [[435, 636, 835]]
    expect(
      hundredsAddsubRuleViolations(HUNDREDS_ADDSUB_PLAN, chips).join('\n'),
    ).toMatch(/P1: chips 435/)
  })

  it('catches a drifted line', () => {
    const bad = committed().plan.utterances.map((u) =>
      u.id === 'math.p7.hint2' ? { ...u, text: 'Three less tens.' } : u,
    )
    expect(hundredsAddsubCanonViolations(bad).join('\n')).toMatch(
      /math\.p7\.hint2/,
    )
  })

  it("hundreds' own plan holds only count-1 'more' problems (the per-file rule)", () => {
    expect(HUNDREDS_PLAN.filter((s) => s.kind === 'more')).toHaveLength(3)
    const hundreds = JSON.parse(
      readFileSync(join(MATH_CANON_DIR, 'hundreds.json'), 'utf8'),
    ) as CanonDoc
    const more = mathSessionPlanFromServer(hundreds.plan, {
      extendedKinds: true,
    }).problems.filter((p): p is MoreProblem => p.kind === 'more')
    expect(more.map((p) => [p.count, p.direction])).toEqual([
      [1, 'more'],
      [1, 'more'],
      [1, 'more'],
    ])
  })
})

describe('more and less in the bake lists', () => {
  it('is pending (never Haiku-baked) and an active combo', () => {
    expect(PENDING_CANON_NODES.has('hundreds-addsub')).toBe(true)
    expect(
      activeCombos().filter(
        (c) => c.track === 'math' && c.focusNode === 'hundreds-addsub',
      ),
    ).toHaveLength(1)
  })

  it('is on the voice-QA page (CANON_FILES)', () => {
    const html = readFileSync(
      resolve(process.cwd(), 'public/voice-qa.html'),
      'utf8',
    )
    const block = html.slice(
      html.indexOf('const CANON_FILES'),
      html.indexOf('const GREET_FILES'),
    )
    expect(block).toContain(`['math', 'hundreds-addsub']`)
  })
})
