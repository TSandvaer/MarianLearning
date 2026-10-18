/**
 * @vitest-environment node
 *
 * Hundreds' canon (`design/native/content-wave-3.md` § 3.7, § 5.1, AC 3)
 * against `scripts/spliceContentWave3Canon.ts` and
 * `scripts/hundredsCanonCheck.ts`:
 *
 * - The committed `hundreds.json` is what the splice writes (a hand edit or
 *   a Haiku re-bake fails here), and it equals § 3.7 line for line.
 * - All 8 reads parse (the read-line row of the sibling-tier checklist):
 *   P1–P5 as `place-value`, P6–P8 as `more`, with § 3.7's answers.
 * - The lint catches every § 3.7 rule a plan can break.
 * - Exactly § 5.1's 32 texts (1,190 characters) are left for the Lily
 *   render; "Hmm... try again?" and the session-end lines keep their bytes.
 * - The step is pending (never Haiku-baked) and voice-QA lists it.
 *
 * The 32 new texts had empty audio until their Lily render
 * (`npx tsx scripts/revoiceCanonLily.ts --unrendered`); that red lived in
 * `canonIntegrity.test.ts` (a), which has no exemption by design.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mathSessionPlanFromServer } from '@marian/core/math/planFromServer'
import { PENDING_CANON_NODES, activeCombos } from './generateSessionCanon.ts'
import {
  HUNDREDS_PLAN,
  HUNDREDS_RECAP_FOCUS,
  hundredsCanonViolations,
  hundredsRuleViolations,
  type HundredsSpec,
} from './hundredsCanonCheck.ts'
import { MATH_CANON_DIR } from './spliceContentWave1Canon.ts'
import {
  HUNDREDS_FILE,
  awaitingRender,
  spliceHundreds,
  type CanonDoc,
} from './spliceContentWave3Canon.ts'

const committed = () =>
  JSON.parse(
    readFileSync(join(MATH_CANON_DIR, `${HUNDREDS_FILE}.json`), 'utf8'),
  ) as CanonDoc

/** § 3.7, row by row: read (its length), answer, correct, give answer. */
const TABLE: readonly [string, number, number, string, string][] = [
  [
    'Two hundreds, three tens and four ones. What number is it?',
    58,
    234,
    'Yes! Two hundred and thirty-four!',
    'This one is two hundred and thirty-four.',
  ],
  [
    'Three hundreds, five tens and two ones. What number is it?',
    58,
    352,
    'Yes! Three hundred and fifty-two!',
    'This one is three hundred and fifty-two.',
  ],
  [
    'Four hundreds, two tens and six ones. What number is it?',
    56,
    426,
    'Yes! Four hundred and twenty-six!',
    'This one is four hundred and twenty-six.',
  ],
  [
    'Five hundreds, three tens and seven ones. What number is it?',
    60,
    537,
    'Yes! Five hundred and thirty-seven!',
    'This one is five hundred and thirty-seven.',
  ],
  [
    'Three hundreds, six ones and two tens. What number is it?',
    57,
    326,
    'Yes! Three hundred and twenty-six!',
    'This one is three hundred and twenty-six.',
  ],
  [
    'Two hundred and forty-three. What is ten more?',
    46,
    253,
    'Yes! Two hundred and fifty-three!',
    'This one is two hundred and fifty-three.',
  ],
  [
    'Four hundred and sixty-five. What is one hundred more?',
    54,
    565,
    'Yes! Five hundred and sixty-five!',
    'This one is five hundred and sixty-five.',
  ],
  [
    'Seven hundred and twenty-eight. What is ten more?',
    49,
    738,
    'Yes! Seven hundred and thirty-eight!',
    'This one is seven hundred and thirty-eight.',
  ],
]

const HINTS: Record<'pv' | 'ten' | 'hundred', readonly string[]> = {
  pv: ['Look at the hundreds.', 'Look at the tens.', 'Look at the ones.'],
  ten: ['Look at the tens.', 'One more ten.', 'What is ten more?'],
  hundred: [
    'Look at the hundreds.',
    'One more hundred.',
    'What is one hundred more?',
  ],
}

describe('hundreds.json (§ 3.7, AC 3)', () => {
  const doc = committed()
  const text = (id: string) =>
    doc.plan.utterances.find((u) => u.id === id)?.text

  it('is exactly what the splice writes', () => {
    expect(doc).toEqual(spliceHundreds())
  })

  it('equals § 3.7 line for line', () => {
    TABLE.forEach(([read, length, , correct, give], i) => {
      const n = i + 1
      expect(text(`math.p${n}.read`)).toBe(read)
      expect(read).toHaveLength(length)
      expect(text(`math.p${n}.correct`)).toBe(correct)
      expect(text(`math.p${n}.reprompt`)).toBe('Hmm... try again?')
      expect(text(`math.p${n}.giveAnswer`)).toBe(give)
      const hints = n <= 5 ? HINTS.pv : n === 7 ? HINTS.hundred : HINTS.ten
      expect([1, 2, 3].map((k) => text(`math.p${n}.hint${k}`))).toEqual(hints)
    })
    expect(text('session.end.recap.focus')).toBe(HUNDREDS_RECAP_FOCUS)
    expect(HUNDREDS_RECAP_FOCUS).toBe('You worked on hundreds today!')
    expect(hundredsCanonViolations(doc.plan.utterances)).toEqual([])
  })

  it('parses 8/8: P1–P5 place-value, P6–P8 more, § 3.7 answers', () => {
    const plan = mathSessionPlanFromServer(doc.plan, { extendedKinds: true })
    expect(plan.problems.map((p) => p.kind)).toEqual([
      'place-value',
      'place-value',
      'place-value',
      'place-value',
      'place-value',
      'more',
      'more',
      'more',
    ])
    expect(plan.problems.map((p) => p.correct)).toEqual(
      TABLE.map(([, , answer]) => answer),
    )
  })

  it('leaves § 5.1’s 32 texts (1,190 characters) for the Lily render, none after it; the rest keep their bytes', () => {
    const newTexts = [
      ...new Set(
        doc.utterances
          .filter(
            (u) =>
              !u.id.endsWith('.reprompt') &&
              (!u.id.startsWith('session.end.') ||
                u.id === 'session.end.recap.focus'),
          )
          .map((u) => u.text),
      ),
    ]
    expect(newTexts).toHaveLength(32)
    expect(newTexts.reduce((n, t) => n + t.length, 0)).toBe(1190)
    expect(newTexts).toContain(HUNDREDS_RECAP_FOCUS)
    // Before the render: exactly these. After it: none.
    const waiting = awaitingRender(doc)
    expect(waiting).toEqual(waiting.length > 0 ? newTexts : [])
    const audio = (t: string) =>
      doc.utterances.find((u) => u.text === t)!.audio.base64
    expect(audio('Hmm... try again?')).not.toBe('')
    expect(audio('You did it!')).not.toBe('')
  })
})

describe('the § 3.7 lint', () => {
  const swap = (i: number, spec: HundredsSpec) =>
    HUNDREDS_PLAN.map((s, j) => (j === i ? spec : s))

  it('the plan is clean', () => {
    expect(hundredsRuleViolations(HUNDREDS_PLAN)).toEqual([])
  })

  it.each([
    [
      'a digit of one',
      swap(0, {
        kind: 'place-value',
        hundreds: 1,
        tens: 3,
        ones: 4,
        order: ['hundreds', 'tens', 'ones'],
      }),
      /P1: 1 hundreds/,
    ],
    [
      'a repeated digit',
      swap(1, {
        kind: 'place-value',
        hundreds: 3,
        tens: 5,
        ones: 5,
        order: ['hundreds', 'tens', 'ones'],
      }),
      /P2: a digit repeats/,
    ],
    [
      'P1–P4 out of place order',
      swap(3, {
        kind: 'place-value',
        hundreds: 5,
        tens: 3,
        ones: 7,
        order: ['hundreds', 'ones', 'tens'],
      }),
      /P4: P1-P4 name the places in place order/,
    ],
    [
      'a zero digit',
      swap(5, { kind: 'more', start: 204, step: 10 }),
      /P6: 204 has a zero digit/,
    ],
    [
      'a regroup',
      swap(7, { kind: 'more', start: 793, step: 10 }),
      /P8: 793 \+ 10 regroups/,
    ],
    [
      'a repeated answer',
      swap(7, { kind: 'more', start: 243, step: 10 }),
      /P8: the answer 253 repeats/,
    ],
  ])('catches %s', (_name, plan, message) => {
    expect(hundredsRuleViolations(plan).join('\n')).toMatch(message)
  })

  it('catches chips off the table', () => {
    const chips = [[234, 435, 634]]
    expect(hundredsRuleViolations(HUNDREDS_PLAN, chips).join('\n')).toMatch(
      /P1: chips 234/,
    )
  })

  it('catches a drifted line', () => {
    const bad = committed().plan.utterances.map((u) =>
      u.id === 'math.p6.read'
        ? { ...u, text: 'Two hundred and forty-three. What is ten more? ' }
        : u,
    )
    expect(hundredsCanonViolations(bad).join('\n')).toMatch(/math\.p6\.read/)
  })
})

describe('hundreds in the bake lists', () => {
  it('is pending (never Haiku-baked) and an active combo', () => {
    expect(PENDING_CANON_NODES.has('hundreds')).toBe(true)
    expect(
      activeCombos().filter(
        (c) => c.track === 'math' && c.focusNode === 'hundreds',
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
    expect(block).toContain(`['math', 'hundreds']`)
  })
})
