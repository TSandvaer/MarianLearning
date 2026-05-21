import { describe, expect, it } from 'vitest'
import {
  PlanFromServerError,
  mathSessionPlanFromServer,
  parseReadAddends,
  parseReadOperands,
  wordToNumber,
} from './planFromServer'
import {
  mathSessionPlanToUtteranceSources,
  STATIC_SESSION_PLANS,
} from './sessionPlans'

/** Build a server-shaped plan from one of the static plans — same id/label,
 *  same utterances. The point of these helpers is to exercise round-trip
 *  semantics: server-output (the flat shape) → planFromServer → nested
 *  shape that matches the static plan we started with. */
function staticPlanAsServerShape(planIndex = 0) {
  const plan = STATIC_SESSION_PLANS[planIndex]!
  return {
    id: plan.id,
    label: plan.label,
    utterances: mathSessionPlanToUtteranceSources(plan).map((u) => ({
      id: u.id,
      text: u.text,
    })),
  }
}

describe('parseReadAddends', () => {
  it('parses canonical "Three plus two. How many?"', () => {
    expect(parseReadAddends('Three plus two. How many?')).toEqual({
      addendA: 3,
      addendB: 2,
    })
  })

  it('is case-insensitive on the leading word', () => {
    expect(parseReadAddends('three plus two. How many?')).toEqual({
      addendA: 3,
      addendB: 2,
    })
  })

  it('accepts all 1..10 number words', () => {
    expect(parseReadAddends('One plus ten. How many?')).toEqual({
      addendA: 1,
      addendB: 10,
    })
    expect(parseReadAddends('Nine plus four. How many?')).toEqual({
      addendA: 9,
      addendB: 4,
    })
  })

  it('accepts 11..20 number words for add-to-20 teen+single facts (ticket 86c9q5q13)', () => {
    // Per the planner prompt, add-to-20 allows "Ten plus five. How many?"
    // (10+5=15) and the canon may also emit teen+single forms. Parser
    // covers up to twenty as defense in depth.
    expect(parseReadAddends('Ten plus five. How many?')).toEqual({
      addendA: 10,
      addendB: 5,
    })
    expect(parseReadAddends('Eleven plus two. How many?')).toEqual({
      addendA: 11,
      addendB: 2,
    })
    expect(parseReadAddends('Twelve plus seven. How many?')).toEqual({
      addendA: 12,
      addendB: 7,
    })
    expect(parseReadAddends('Eight plus nine. How many?')).toEqual({
      addendA: 8,
      addendB: 9,
    })
    expect(parseReadAddends('One plus twenty. How many?')).toEqual({
      addendA: 1,
      addendB: 20,
    })
  })

  it('throws on non-template lines', () => {
    expect(() => parseReadAddends('What is three plus two?')).toThrow(
      PlanFromServerError,
    )
  })

  it('rejects unhyphenated compound forms and out-of-range tokens (defense against prompt drift)', () => {
    // Two-digit-addsub canon (PR #285 Wave 3) emits hyphenated number words
    // ("Thirty-one plus four. How many?") — the parser accepts those now.
    // What still must NOT be silently absorbed:
    //
    //   - Unhyphenated compound forms ("twentyone", "thirtyfive") — the
    //     bake-time prosody constraint REQUIRES the hyphen, so unhyphenated
    //     drift signals a prompt regression.
    //   - Tokens beyond 99 ("hundred", "thousand") — out of every shipping
    //     tier's pool.
    //   - Malformed compounds ("five-three" — decade slot isn't a decade;
    //     "thirty-twenty" — unit slot isn't a unit).
    expect(() => parseReadAddends('Twentyone plus two. How many?')).toThrow(
      PlanFromServerError,
    )
    expect(() => parseReadAddends('Hundred plus two. How many?')).toThrow(
      PlanFromServerError,
    )
    expect(() => parseReadAddends('Five-three plus two. How many?')).toThrow(
      PlanFromServerError,
    )
    expect(() => parseReadAddends('Thirty-twenty plus two. How many?')).toThrow(
      PlanFromServerError,
    )
  })

  it('throws when called on a subtraction read line (legacy shim is addition-only)', () => {
    // parseReadAddends is the backwards-compat shim — addition only.
    // Subtraction templates throw with a clear message directing the
    // caller to parseReadOperands.
    expect(() =>
      parseReadAddends('Seven minus three. How many are left?'),
    ).toThrow(/parseReadOperands/)
    expect(() =>
      parseReadAddends('Eight take away three. How many are left?'),
    ).toThrow(/parseReadOperands/)
  })
})

describe('parseReadOperands — sub-to-10 templates (Kyle spec §9.1)', () => {
  it('parses the canonical subtraction "minus" template', () => {
    expect(parseReadOperands('Seven minus three. How many are left?')).toEqual({
      addendA: 7,
      addendB: 3,
      op: '-',
    })
  })

  it('parses the first-session "take away" template', () => {
    expect(
      parseReadOperands('Eight take away three. How many are left?'),
    ).toEqual({
      addendA: 8,
      addendB: 3,
      op: '-',
    })
  })

  it('accepts subtract-self facts (minuend == subtrahend, correct = 0)', () => {
    expect(parseReadOperands('Five minus five. How many are left?')).toEqual({
      addendA: 5,
      addendB: 5,
      op: '-',
    })
    expect(parseReadOperands('Eight minus eight. How many are left?')).toEqual({
      addendA: 8,
      addendB: 8,
      op: '-',
    })
  })

  it('accepts subtract-zero facts (subtrahend = 0)', () => {
    expect(parseReadOperands('Seven minus zero. How many are left?')).toEqual({
      addendA: 7,
      addendB: 0,
      op: '-',
    })
    expect(parseReadOperands('Nine minus zero. How many are left?')).toEqual({
      addendA: 9,
      addendB: 0,
      op: '-',
    })
  })

  it('is case-insensitive on the leading word and operator word', () => {
    expect(parseReadOperands('ten minus three. How Many Are Left?')).toEqual({
      addendA: 10,
      addendB: 3,
      op: '-',
    })
    expect(
      parseReadOperands('TEN TAKE AWAY THREE. HOW MANY ARE LEFT?'),
    ).toEqual({
      addendA: 10,
      addendB: 3,
      op: '-',
    })
  })

  it('still parses addition templates and tags op:"+"', () => {
    expect(parseReadOperands('Three plus two. How many?')).toEqual({
      addendA: 3,
      addendB: 2,
      op: '+',
    })
  })

  it('throws on the wrong trailing phrase — addition uses "How many?", subtraction uses "How many are left?"', () => {
    // Cross-template mismatch: addition with "are left", subtraction
    // without "are left". Both rejected.
    expect(() =>
      parseReadOperands('Three plus two. How many are left?'),
    ).toThrow(PlanFromServerError)
    expect(() => parseReadOperands('Seven minus three. How many?')).toThrow(
      PlanFromServerError,
    )
  })

  it('throws on non-template lines (clearer error than the legacy shim)', () => {
    expect(() => parseReadOperands('What is seven minus three?')).toThrow(
      PlanFromServerError,
    )
    expect(() => parseReadOperands('Three minus two equals one.')).toThrow(
      PlanFromServerError,
    )
  })
})

describe('mathSessionPlanFromServer — sub-to-10 plan integration', () => {
  function buildSubToTenWire() {
    // Build a sub-to-10 plan matching Dave's pool. 8 problems, mix of
    // bands. All slots present. op:"-" emitted per problem post-parse.
    const probs = [
      { a: 6, b: 3, sub: '6-3=3' }, // easy doubles
      { a: 8, b: 4, sub: '8-4=4' }, // easy doubles
      { a: 5, b: 5, sub: '5-5=0' }, // easy subtract-self (correct=0)
      { a: 10, b: 2, sub: '10-2=8' }, // medium
      { a: 10, b: 3, sub: '10-3=7' }, // take-from-10
      { a: 10, b: 7, sub: '10-7=3' }, // take-from-10
      { a: 9, b: 4, sub: '9-4=5' }, // hard
      { a: 8, b: 3, sub: '8-3=5' }, // hard
    ]
    const numberWord = (n: number): string => {
      const words = [
        'zero',
        'one',
        'two',
        'three',
        'four',
        'five',
        'six',
        'seven',
        'eight',
        'nine',
        'ten',
      ]
      return words[n] ?? '?'
    }
    const utterances: { id: string; text: string }[] = []
    probs.forEach((prob, i) => {
      const p = i + 1
      const correct = prob.a - prob.b
      utterances.push({
        id: `math.p${p}.read`,
        text: `${cap(numberWord(prob.a))} minus ${numberWord(prob.b)}. How many are left?`,
      })
      utterances.push({
        id: `math.p${p}.correct`,
        text: `Yes! ${cap(numberWord(correct))}!`,
      })
      utterances.push({ id: `math.p${p}.reprompt`, text: 'Hmm... try again?' })
      utterances.push({
        id: `math.p${p}.hint`,
        text: `Look. ${cap(numberWord(prob.a))}. Take away ${numberWord(prob.b)}. How many now?`,
      })
      utterances.push({
        id: `math.p${p}.giveAnswer`,
        text: `This one is ${numberWord(correct)}.`,
      })
    })
    return {
      id: 'sub-to-10-level-1',
      label: 'Subtraction within 10 — Level 1',
      utterances,
    }
  }
  function cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  it('rebuilds a sub-to-10 plan with op:"-" on every problem', () => {
    const wire = buildSubToTenWire()
    const rebuilt = mathSessionPlanFromServer(wire)
    expect(rebuilt.problems).toHaveLength(8)
    for (const p of rebuilt.problems) {
      expect(p.op).toBe('-')
    }
  })

  it('computes correct = addendA − addendB for each subtraction problem', () => {
    const wire = buildSubToTenWire()
    const rebuilt = mathSessionPlanFromServer(wire)
    // Spot check a couple
    const p1 = rebuilt.problems[0]!
    expect(p1.addendA).toBe(6)
    expect(p1.addendB).toBe(3)
    expect(p1.correct).toBe(3)
    const p3 = rebuilt.problems[2]!
    expect(p3.addendA).toBe(5)
    expect(p3.addendB).toBe(5)
    // subtract-self → correct=0
    expect(p3.correct).toBe(0)
    const p6 = rebuilt.problems[5]!
    expect(p6.addendA).toBe(10)
    expect(p6.addendB).toBe(7)
    expect(p6.correct).toBe(3)
  })

  it('rebuilds a mixed addition + subtraction plan (each problem tagged independently)', () => {
    // Real world: a graduation session or future mixed-op session
    // could carry both. Parser handles per-problem dispatch.
    const wire = {
      id: 'mixed-plan',
      label: 'mixed',
      utterances: [
        // P1: addition
        { id: 'math.p1.read', text: 'Three plus two. How many?' },
        { id: 'math.p1.correct', text: 'Yes! Five!' },
        { id: 'math.p1.reprompt', text: 'Hmm... try again?' },
        {
          id: 'math.p1.hint',
          text: 'Look. Three. And two more. How many now?',
        },
        { id: 'math.p1.giveAnswer', text: 'This one is five.' },
        // P2: subtraction
        { id: 'math.p2.read', text: 'Seven minus three. How many are left?' },
        { id: 'math.p2.correct', text: 'Yes! Four!' },
        { id: 'math.p2.reprompt', text: 'Hmm... try again?' },
        {
          id: 'math.p2.hint',
          text: 'Look. Seven. Take away three. How many now?',
        },
        { id: 'math.p2.giveAnswer', text: 'This one is four.' },
        // P3-P8: addition again (to satisfy 8-problem requirement)
        ...[3, 4, 5, 6, 7, 8].flatMap((i) => [
          { id: `math.p${i}.read`, text: 'Four plus two. How many?' },
          { id: `math.p${i}.correct`, text: 'Yes! Six!' },
          { id: `math.p${i}.reprompt`, text: 'Hmm... try again?' },
          {
            id: `math.p${i}.hint`,
            text: 'Look. Four. And two more. How many now?',
          },
          { id: `math.p${i}.giveAnswer`, text: 'This one is six.' },
        ]),
      ],
    }
    const rebuilt = mathSessionPlanFromServer(wire)
    expect(rebuilt.problems).toHaveLength(8)
    expect(rebuilt.problems[0]!.op).toBe('+')
    expect(rebuilt.problems[1]!.op).toBe('-')
    expect(rebuilt.problems[1]!.correct).toBe(4) // 7 - 3
  })
})

describe('mathSessionPlanFromServer — happy path', () => {
  it('rebuilds a MathSessionPlan that matches the static plan it was derived from', () => {
    const wire = staticPlanAsServerShape(0)
    const rebuilt = mathSessionPlanFromServer(wire)
    const original = STATIC_SESSION_PLANS[0]!

    expect(rebuilt.id).toBe(original.id)
    expect(rebuilt.label).toBe(original.label)
    expect(rebuilt.problems).toHaveLength(8)
    for (let i = 0; i < 8; i++) {
      const got = rebuilt.problems[i]!
      const want = original.problems[i]!
      expect(got.index).toBe(want.index)
      expect(got.addendA).toBe(want.addendA)
      expect(got.addendB).toBe(want.addendB)
      expect(got.correct).toBe(want.correct)
      expect(got.utterances).toEqual(want.utterances)
    }
  })

  it('preserves the server-supplied id/label even when they differ from any static plan', () => {
    const wire = {
      ...staticPlanAsServerShape(0),
      id: 'haiku-generated-plan',
      label: 'Math Level 1: Sums to 10',
    }
    const rebuilt = mathSessionPlanFromServer(wire)
    expect(rebuilt.id).toBe('haiku-generated-plan')
    expect(rebuilt.label).toBe('Math Level 1: Sums to 10')
  })
})

describe('mathSessionPlanFromServer — failure paths', () => {
  it('throws when the blob is the wrong shape', () => {
    expect(() => mathSessionPlanFromServer(null)).toThrow(PlanFromServerError)
    expect(() => mathSessionPlanFromServer({})).toThrow(PlanFromServerError)
    expect(() =>
      mathSessionPlanFromServer({ id: 'x', label: 'y', utterances: [{}] }),
    ).toThrow(PlanFromServerError)
  })

  it('skips utterances with ids outside the math.p<N>.<slot> namespace, but still rejects when that leaves a slot missing', () => {
    // Replace math.p1.read with an out-of-namespace id. Under the
    // skip-not-throw contract the parser ignores it, but problem 1's
    // `read` slot is now genuinely missing — which the completeness
    // check still catches with the clearer "missing slot" error.
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: [
        { id: 'not-the-template', text: 'whatever' },
        ...wire.utterances.slice(1),
      ],
    }
    expect(() => mathSessionPlanFromServer(broken)).toThrow(
      /missing slot "read"/,
    )
  })

  it('throws when a problem is missing entirely', () => {
    const wire = staticPlanAsServerShape(0)
    // Drop every utterance for problem 4.
    const broken = {
      ...wire,
      utterances: wire.utterances.filter((u) => !u.id.startsWith('math.p4.')),
    }
    expect(() => mathSessionPlanFromServer(broken)).toThrow(
      /missing problem index 4/,
    )
  })

  it('throws when a slot is missing for a problem', () => {
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: wire.utterances.filter((u) => u.id !== 'math.p2.hint'),
    }
    expect(() => mathSessionPlanFromServer(broken)).toThrow(
      /missing slot "hint"/,
    )
  })

  it('throws when the read line drifts off template', () => {
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: wire.utterances.map((u) =>
        u.id === 'math.p1.read'
          ? { ...u, text: 'How many is three plus two?' }
          : u,
      ),
    }
    expect(() => mathSessionPlanFromServer(broken)).toThrow(/template/)
  })
})

// Regression tests for ticket 86c9kj2u6 — the planner now also emits
// `session.end.*` utterances (and may emit other cross-screen families
// later). Per the skip-not-throw contract documented in the file header,
// the parser must ignore those without affecting the per-problem plan.
describe('mathSessionPlanFromServer — skip-not-throw on out-of-namespace ids (86c9kj2u6)', () => {
  /** The 19 session.end.* ids that the planner emits today (1 opener +
   *  11 recap.N + 6 streak.N + 1 goodbye). Texts are placeholders; the
   *  parser only inspects ids. */
  const SESSION_END_UTTERANCES: ReadonlyArray<{ id: string; text: string }> = [
    { id: 'session.end.opener', text: 'You did it!' },
    ...Array.from({ length: 11 }, (_, i) => ({
      id: `session.end.recap.${i + 1}`,
      text: `recap-${i + 1}`,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `session.end.streak.${i + 3}`,
      text: `streak-${i + 3}`,
    })),
    { id: 'session.end.goodbye', text: 'See you soon.' },
  ]

  it('returns the same plan whether or not session.end.* ids are present', () => {
    const baseline = staticPlanAsServerShape(0)
    const additive = {
      ...baseline,
      utterances: [...baseline.utterances, ...SESSION_END_UTTERANCES],
    }
    expect(additive.utterances.length).toBe(40 + 19)
    const fromBaseline = mathSessionPlanFromServer(baseline)
    const fromAdditive = mathSessionPlanFromServer(additive)
    // Structural equality — ids/labels, problem indexes, addends, sums,
    // and per-problem slot text all preserved.
    expect(fromAdditive).toEqual(fromBaseline)
  })

  it('still rejects malformed-but-namespaced ids by surfacing the missing-slot error downstream', () => {
    // `math.p1.bogus` is in the math.* namespace but its slot doesn't
    // match read|correct|reprompt|hint|giveAnswer. Under skip-not-throw
    // it's dropped from the bucket; problem 1 then has a missing slot
    // (whichever real slot we replaced) and the completeness check
    // throws the clearer message. This pins the contract: out-of-
    // namespace ids no longer throw early, but malformed ones don't
    // silently produce a corrupted plan either.
    const wire = staticPlanAsServerShape(0)
    const broken = {
      ...wire,
      utterances: wire.utterances.map((u) =>
        u.id === 'math.p1.read' ? { id: 'math.p1.bogus', text: u.text } : u,
      ),
    }
    expect(() => mathSessionPlanFromServer(broken)).toThrow(PlanFromServerError)
    expect(() => mathSessionPlanFromServer(broken)).toThrow(
      /missing slot "read"/,
    )
  })
})

// ─── wordToNumber: compositional decoder for 21..99 (Kyle spec §5.2,
// Devon Wave 3, PR #285). Pins both the existing single-token range
// (0..20 + round decades) and the new decade-units composition. ────────
describe('wordToNumber — single-token forms', () => {
  it('decodes 0..20 (the existing single-token range)', () => {
    expect(wordToNumber('zero')).toBe(0)
    expect(wordToNumber('one')).toBe(1)
    expect(wordToNumber('ten')).toBe(10)
    expect(wordToNumber('eleven')).toBe(11)
    expect(wordToNumber('nineteen')).toBe(19)
    expect(wordToNumber('twenty')).toBe(20)
  })

  it('decodes the round decade names 30..90', () => {
    expect(wordToNumber('thirty')).toBe(30)
    expect(wordToNumber('forty')).toBe(40)
    expect(wordToNumber('fifty')).toBe(50)
    expect(wordToNumber('sixty')).toBe(60)
    expect(wordToNumber('seventy')).toBe(70)
    expect(wordToNumber('eighty')).toBe(80)
    expect(wordToNumber('ninety')).toBe(90)
  })

  it('returns undefined on unknown single tokens', () => {
    expect(wordToNumber('hundred')).toBeUndefined()
    expect(wordToNumber('thousand')).toBeUndefined()
    expect(wordToNumber('twentyone')).toBeUndefined()
    expect(wordToNumber('thirtyfive')).toBeUndefined()
    expect(wordToNumber('')).toBeUndefined()
    expect(wordToNumber('seven-')).toBeUndefined()
  })
})

describe('wordToNumber — compositional decade-units (21..99)', () => {
  it('decodes the 21..29 band', () => {
    expect(wordToNumber('twenty-one')).toBe(21)
    expect(wordToNumber('twenty-five')).toBe(25)
    expect(wordToNumber('twenty-nine')).toBe(29)
  })

  it('decodes the 30..99 bands sample (covers every decade)', () => {
    expect(wordToNumber('thirty-one')).toBe(31)
    expect(wordToNumber('forty-two')).toBe(42)
    expect(wordToNumber('fifty-six')).toBe(56)
    expect(wordToNumber('sixty-three')).toBe(63)
    expect(wordToNumber('seventy-seven')).toBe(77)
    expect(wordToNumber('eighty-four')).toBe(84)
    expect(wordToNumber('ninety-nine')).toBe(99)
  })

  it('rejects malformed compounds (decade slot not a multiple of 10 in [20,90])', () => {
    // Decade slot must resolve to a round decade ≥ 20. Anything else is
    // a malformed compound the parser should not silently accept.
    expect(wordToNumber('five-three')).toBeUndefined() // unit-then-unit
    expect(wordToNumber('fifteen-three')).toBeUndefined() // teen-then-unit
    expect(wordToNumber('ten-three')).toBeUndefined() // 10 is not ≥ 20
  })

  it('rejects malformed compounds (unit slot not in [1,9])', () => {
    expect(wordToNumber('thirty-twenty')).toBeUndefined() // 20 not a unit
    expect(wordToNumber('thirty-ten')).toBeUndefined() // 10 not a unit
    expect(wordToNumber('thirty-zero')).toBeUndefined() // 0 not in [1,9]
  })

  it('rejects malformed compounds (multiple hyphens)', () => {
    expect(wordToNumber('thirty-one-two')).toBeUndefined()
    expect(wordToNumber('twenty-three-four')).toBeUndefined()
  })

  it('rejects unknown tokens in either slot', () => {
    expect(wordToNumber('thirty-foo')).toBeUndefined()
    expect(wordToNumber('foo-three')).toBeUndefined()
  })
})

describe('parseReadOperands — two-digit-addsub templates (Kyle spec §5, PR #285)', () => {
  // Operand-shape coverage: addition with hyphenated decade-units form.
  it('parses "Twenty plus three" (decade + single — first canon read line)', () => {
    expect(parseReadOperands('Twenty plus three. How many?')).toEqual({
      addendA: 20,
      addendB: 3,
      op: '+',
    })
  })

  it('parses "Thirty-one plus four. How many?" (hyphenated A)', () => {
    expect(parseReadOperands('Thirty-one plus four. How many?')).toEqual({
      addendA: 31,
      addendB: 4,
      op: '+',
    })
  })

  it('parses "Forty-two plus six. How many?" (hyphenated A across decades)', () => {
    expect(parseReadOperands('Forty-two plus six. How many?')).toEqual({
      addendA: 42,
      addendB: 6,
      op: '+',
    })
  })

  it('parses "Ninety-nine plus zero. How many?" (top-of-range, defense in depth)', () => {
    expect(parseReadOperands('Ninety-nine plus zero. How many?')).toEqual({
      addendA: 99,
      addendB: 0,
      op: '+',
    })
  })

  it('parses subtraction hyphenated forms', () => {
    expect(
      parseReadOperands('Twenty-eight minus three. How many are left?'),
    ).toEqual({
      addendA: 28,
      addendB: 3,
      op: '-',
    })
    expect(
      parseReadOperands('Thirty-four minus two. How many are left?'),
    ).toEqual({
      addendA: 34,
      addendB: 2,
      op: '-',
    })
    expect(
      parseReadOperands('Thirty-nine minus seven. How many are left?'),
    ).toEqual({
      addendA: 39,
      addendB: 7,
      op: '-',
    })
  })

  it('parses two-digit operands on both sides (hyphenated A AND B)', () => {
    // Per Kyle's spec §7.2 Option B — two-digit-plus-two-digit no-regroup
    // facts (e.g. 23 + 14 = 37, 42 + 31 = 73). Parser is shape-only — it
    // doesn't enforce no-regroup; that's the lint's job.
    expect(parseReadOperands('Twenty-three plus fourteen. How many?')).toEqual({
      addendA: 23,
      addendB: 14,
      op: '+',
    })
    expect(parseReadOperands('Forty-two plus thirty-one. How many?')).toEqual({
      addendA: 42,
      addendB: 31,
      op: '+',
    })
  })

  it('is case-insensitive on hyphenated operands', () => {
    expect(parseReadOperands('THIRTY-ONE plus FOUR. How many?')).toEqual({
      addendA: 31,
      addendB: 4,
      op: '+',
    })
    expect(parseReadOperands('twenty-six plus five. How many?')).toEqual({
      addendA: 26,
      addendB: 5,
      op: '+',
    })
  })

  it('still rejects malformed hyphenated tokens inside the template', () => {
    expect(() =>
      parseReadOperands('Thirty-twenty plus four. How many?'),
    ).toThrow(PlanFromServerError)
    expect(() => parseReadOperands('Five-three plus four. How many?')).toThrow(
      PlanFromServerError,
    )
  })
})

describe('mathSessionPlanFromServer — two-digit-addsub canon integration (PR #285 Wave 3)', () => {
  // Reproduces the canon's actual read lines verbatim to pin the parser
  // against the live `public/canon/math/level-1/two-digit-addsub.json`
  // shape. Before this PR, ANY canon plan touching a hyphenated number
  // word threw `PlanFromServerError` and fell back to silent mode —
  // verified by Devon during PR #285 cross-review.
  function buildTwoDigitAddsubWire() {
    // Eight read lines extracted from canon `public/canon/math/level-1/
    // two-digit-addsub.json` head (verified 2026-05-21). Slot text for
    // correct/reprompt/hint/giveAnswer is placeholder; the parser only
    // inspects `read` for addends.
    const reads: ReadonlyArray<{
      a: number
      b: number
      op: '+' | '-'
      text: string
    }> = [
      { a: 20, b: 3, op: '+', text: 'Twenty plus three. How many?' },
      { a: 15, b: 2, op: '+', text: 'Fifteen plus two. How many?' },
      { a: 31, b: 4, op: '+', text: 'Thirty-one plus four. How many?' },
      { a: 26, b: 5, op: '+', text: 'Twenty-six plus five. How many?' },
      {
        a: 28,
        b: 3,
        op: '-',
        text: 'Twenty-eight minus three. How many are left?',
      },
      {
        a: 34,
        b: 2,
        op: '-',
        text: 'Thirty-four minus two. How many are left?',
      },
      { a: 42, b: 6, op: '+', text: 'Forty-two plus six. How many?' },
      {
        a: 39,
        b: 7,
        op: '-',
        text: 'Thirty-nine minus seven. How many are left?',
      },
    ]
    const utterances: { id: string; text: string }[] = []
    reads.forEach((r, i) => {
      const p = i + 1
      utterances.push({ id: `math.p${p}.read`, text: r.text })
      utterances.push({ id: `math.p${p}.correct`, text: 'Yes!' })
      utterances.push({ id: `math.p${p}.reprompt`, text: 'Hmm... try again?' })
      utterances.push({ id: `math.p${p}.hint`, text: 'Look.' })
      utterances.push({ id: `math.p${p}.giveAnswer`, text: 'This one.' })
    })
    return {
      id: 'two-digit-addsub-level-1',
      label: 'Two-digit add/sub — Level 1',
      utterances,
    }
  }

  it('parses the canon two-digit-addsub plan without throwing (latent-bug regression test)', () => {
    const wire = buildTwoDigitAddsubWire()
    // Pre-PR: throws on problem 3 ("Thirty-one plus four").
    const rebuilt = mathSessionPlanFromServer(wire)
    expect(rebuilt.problems).toHaveLength(8)
  })

  it('rebuilds addends and ops per problem, including hyphenated A and round-decade A', () => {
    const wire = buildTwoDigitAddsubWire()
    const rebuilt = mathSessionPlanFromServer(wire)
    // P1: Twenty plus three — round decade left, single right.
    expect(rebuilt.problems[0]).toMatchObject({
      addendA: 20,
      addendB: 3,
      op: '+',
      correct: 23,
    })
    // P3: Thirty-one plus four — hyphenated left.
    expect(rebuilt.problems[2]).toMatchObject({
      addendA: 31,
      addendB: 4,
      op: '+',
      correct: 35,
    })
    // P5: Twenty-eight minus three — hyphenated subtraction.
    expect(rebuilt.problems[4]).toMatchObject({
      addendA: 28,
      addendB: 3,
      op: '-',
      correct: 25,
    })
    // P7: Forty-two plus six — hyphenated subset crossing decades.
    expect(rebuilt.problems[6]).toMatchObject({
      addendA: 42,
      addendB: 6,
      op: '+',
      correct: 48,
    })
    // P8: Thirty-nine minus seven — hyphenated subtraction.
    expect(rebuilt.problems[7]).toMatchObject({
      addendA: 39,
      addendB: 7,
      op: '-',
      correct: 32,
    })
  })
})
