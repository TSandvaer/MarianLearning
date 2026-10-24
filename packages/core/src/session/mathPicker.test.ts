/**
 * The device's math picker (no-Claude plan phase 3): Dave's § 2.2 rules
 * (`design/research/no-claude-variety-2026-10-23.md`) inside the step's
 * composition rules (`../math/compositionRules.ts`).
 *
 * Today's pools are the 8 canon blocks of add-to-10 and sub-to-10 (the
 * bundled canon text), so every block plays every session and the rules
 * decide the order. A synthetic whole-pool canon (44 facts and the 9 bonds
 * to ten; sub-to-10's 22) shows the selection a bigger pool (plan phase
 * 5a) gets with no code change.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ADD_TO_TEN_POOL,
  SUB_TO_TEN_POOL,
  mathCompositionViolations,
  parseAddToTenReadLine,
  parseMissingNumberReadLine,
  parseSubToTenReadLine,
  type ComposedMathStep,
} from '../math/compositionRules'
import { localDateKey } from '../progress/clock'
import type { LeitnerBoxIndex, MathFact, SeenItems } from '../progress/types'
import type { CanonText } from './composeSession'
import {
  MATH_PICK_SOFT_RULES,
  pickMathProblems,
  type MathPickRequest,
} from './mathPicker'

const CANON = JSON.parse(
  readFileSync('mobile/assets/canon/canon-text.json', 'utf8'),
) as Record<string, CanonText>
const canonOf = (step: ComposedMathStep) => CANON[`math/level-1/${step}`]!

const NOW = '2026-10-24T09:00:00.000Z'
const DAY = 86_400_000
const daysAgo = (n: number) => new Date(NOW).getTime() - n * DAY

type Op = '+' | '-'
const f = (a: number, op: Op, b: number): MathFact => ({ a, b, op })
const key = (x: MathFact) => `${x.a}${x.op}${x.b}`

/** `[fact, box, lastSeen]` rows → a Leitner box. */
function box(rows: [MathFact, LeitnerBoxIndex, number][]) {
  return {
    items: rows.map(([item, b, lastSeen]) => ({ item, box: b, lastSeen })),
  }
}

function request(
  step: ComposedMathStep,
  over: Partial<MathPickRequest> = {},
): MathPickRequest {
  return {
    step,
    leitner: { items: [] },
    seen: {},
    previous: null,
    slow: [],
    warmup: [],
    nowMs: new Date(NOW).getTime(),
    today: localDateKey(new Date(NOW)),
    seed: 0,
    ...over,
  }
}

/** The fact a canon block's read line asks (a missing number: given + missing). */
function factOf(canon: CanonText, problem: number): MathFact {
  const read = canon.utterances.find((u) => u.id === `math.p${problem}.read`)!
  const missing = parseMissingNumberReadLine(read.text)
  if (missing !== null) return f(missing.given, '+', missing.missing)
  const add = parseAddToTenReadLine(read.text)
  if (add !== null) return f(add.a, '+', add.b)
  const sub = parseSubToTenReadLine(read.text)!
  return f(sub.a, '-', sub.b)
}

/** The picked session's facts, P1..P8. */
function picked(
  step: ComposedMathStep,
  req: MathPickRequest,
  canon = canonOf(step),
) {
  const { problems } = pickMathProblems(req, canon)
  return problems.map((p) => key(factOf(canon, p)))
}

/** The read lines of a pick, renamed P1..P8, for the composition check. */
function readLines(canon: CanonText, problems: readonly number[]) {
  return {
    utterances: problems.map((p, i) => ({
      id: `math.p${i + 1}.read`,
      text: canon.utterances.find((u) => u.id === `math.p${p}.read`)!.text,
    })),
  }
}

// ── Today's pools: the 8 canon blocks ─────────────────────────────────────

describe('pickMathProblems on today’s canon (8 blocks: all play, the rules set the order)', () => {
  it('add-to-10: each block once; the easy facts open in ramp order; missing numbers at P4, P6, P8', () => {
    const canon = canonOf('add-to-10')
    const { problems } = pickMathProblems(request('add-to-10'), canon)
    expect([...problems].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(picked('add-to-10', request('add-to-10')).slice(0, 3)).toEqual([
      '1+2',
      '2+2',
      '3+2',
    ])
    const missing = new Set(['7+3', '6+4', '8+2'])
    const facts = picked('add-to-10', request('add-to-10'))
    expect([3, 5, 7].map((i) => missing.has(facts[i]!))).toEqual([
      true,
      true,
      true,
    ])
    expect(
      mathCompositionViolations('add-to-10', readLines(canon, problems)),
    ).toEqual([])
  })

  it('slots 4-8 take the due box-1 and box-2 facts first', () => {
    const facts = picked(
      'add-to-10',
      request('add-to-10', {
        leitner: box([
          [f(8, '+', 2), 3, daysAgo(1)], // not due
          [f(7, '+', 3), 4, daysAgo(2)], // not due
          [f(6, '+', 4), 1, daysAgo(1)], // due, box 1
          [f(4, '+', 4), 3, daysAgo(1)], // not due
          [f(4, '+', 5), 2, daysAgo(2)], // due, box 2
        ]),
      }),
    )
    expect(facts[3]).toBe('6+4') // P4, the first missing-number slot
    expect(facts[4]).toBe('4+5') // P5, the first plain trap slot
  })

  it('then the new facts, then the due box-3-5 facts (most overdue first), then the lowest box', () => {
    const facts = picked(
      'add-to-10',
      request('add-to-10', {
        leitner: box([
          // 7+3: never answered (no entry) = new.
          [f(6, '+', 4), 4, daysAgo(9)], // due box 4, 2 days overdue
          [f(8, '+', 2), 2, daysAgo(0)], // not due, box 2
          [f(1, '+', 2), 3, daysAgo(1)],
          [f(2, '+', 2), 3, daysAgo(1)],
          [f(3, '+', 2), 3, daysAgo(1)],
          [f(4, '+', 4), 3, daysAgo(4)], // due box 3
          [f(4, '+', 5), 5, daysAgo(1)], // not due, box 5
        ]),
      }),
    )
    expect([facts[3], facts[5], facts[7]]).toEqual(['7+3', '6+4', '8+2'])
    expect([facts[4], facts[6]]).toEqual(['4+4', '4+5'])
  })

  it('the not-yet-due facts play lowest box first (§ 2.2.2.iv)', () => {
    const facts = picked(
      'add-to-10',
      request('add-to-10', {
        leitner: box([
          [f(7, '+', 3), 2, daysAgo(0)], // not due, box 2
          [f(8, '+', 2), 3, daysAgo(1)], // not due, box 3
          [f(6, '+', 4), 4, daysAgo(1)], // not due, box 4
        ]),
      }),
    )
    expect([facts[3], facts[5], facts[7]]).toEqual(['7+3', '8+2', '6+4'])
  })

  it('the due cap is shared with the warm-up: over-cap due facts play after the not-due ones', () => {
    const leitner = box([
      [f(6, '+', 4), 1, daysAgo(5)],
      [f(8, '+', 2), 1, daysAgo(1)],
      [f(7, '+', 3), 3, daysAgo(1)], // not due
    ])
    // No warm-up: cap 3, both due facts lead.
    expect(
      picked('add-to-10', request('add-to-10', { leitner })).filter(
        (_, i) => i === 3 || i === 5 || i === 7,
      ),
    ).toEqual(['6+4', '8+2', '7+3'])
    // A 2-fact warm-up leaves a cap of 1: the most overdue leads, the
    // other waits behind the not-due fact.
    expect(
      picked(
        'add-to-10',
        request('add-to-10', {
          leitner,
          warmup: [f(9, '+', 2), f(5, '-', 5)],
        }),
      ).filter((_, i) => i === 3 || i === 5 || i === 7),
    ).toEqual(['6+4', '7+3', '8+2'])
  })

  it('a fact the warm-up just played comes last its slots allow', () => {
    const facts = picked(
      'add-to-10',
      request('add-to-10', {
        leitner: box([[f(7, '+', 3), 1, daysAgo(3)]]), // due, but warmed up
        warmup: [f(7, '+', 3)],
      }),
    )
    expect(facts[7]).toBe('7+3')
  })

  it('a slow fact (accurate but slow) leads the not-due facts', () => {
    const leitner = box([
      [f(4, '+', 4), 3, daysAgo(1)],
      [f(4, '+', 5), 3, daysAgo(1)],
    ])
    expect(picked('add-to-10', request('add-to-10', { leitner }))[4]).toBe(
      '4+4',
    )
    expect(
      picked(
        'add-to-10',
        request('add-to-10', { leitner, slow: [f(4, '+', 5)] }),
      )[4],
    ).toBe('4+5')
  })

  it('sub-to-10: the 3 easy facts open in ramp order; a due HARD fact takes the first slot its band allows', () => {
    const facts = picked(
      'sub-to-10',
      request('sub-to-10', {
        leitner: box([
          [f(7, '-', 3), 1, daysAgo(1)], // due, HARD: P5-P8
          [f(10, '-', 7), 2, daysAgo(1)], // due, MEDIUM: P4-P8
        ]),
      }),
    )
    expect(facts.slice(0, 3)).toEqual(['5-5', '6-3', '9-1'])
    expect(facts[3]).toBe('10-7')
    expect(facts[4]).toBe('7-3')
  })

  it('never the same facts in the same order as the learner’s previous session of the step', () => {
    const req = request('add-to-10', {
      leitner: box([[f(6, '+', 4), 1, daysAgo(1)]]),
    })
    const first = picked('add-to-10', req)
    const previous = first.map((k) => {
      const [a, b] = k.split('+').map(Number)
      return f(a!, '+', b!)
    })
    const next = picked('add-to-10', { ...req, previous })
    expect(next).not.toEqual(first)
    expect([...next].sort()).toEqual([...first].sort())
    expect(next[3]).toBe('6+4') // the due fact still leads
  })

  it('is deterministic: the same request picks the same session (prefetch = tap)', () => {
    const req = request('sub-to-10', {
      leitner: box([[f(8, '-', 2), 1, daysAgo(2)]]),
      seed: 7,
    })
    expect(pickMathProblems(req, canonOf('sub-to-10'))).toEqual(
      pickMathProblems(req, canonOf('sub-to-10')),
    )
  })

  it('reports the rules it had to give up, in the fixed order', () => {
    // Every block due in box 1: slots 4-8 cannot keep the due cap of 3,
    // and no fact is known.
    const all = [
      f(1, '+', 2),
      f(2, '+', 2),
      f(3, '+', 2),
      f(7, '+', 3),
      f(4, '+', 4),
      f(6, '+', 4),
      f(4, '+', 5),
      f(8, '+', 2),
    ]
    const { relaxed } = pickMathProblems(
      request('add-to-10', {
        leitner: box(
          all.map((x) => [x, 1, daysAgo(1)] as [MathFact, 1, number]),
        ),
      }),
      canonOf('add-to-10'),
    )
    // No new fact, so the new cap holds; the due cap and the known floor
    // come as close as 8 due box-1 blocks allow (Dave, Q2).
    expect(relaxed).toEqual(['due-cap', 'known-floor'])
    expect(MATH_PICK_SOFT_RULES).toEqual([
      'new-cap',
      'due-cap',
      'known-floor',
      'slow-dose',
      'new-order',
    ])
  })

  it('throws (so the app asks the server) when the step’s canon cannot make a legal session', () => {
    const canon = canonOf('add-to-10')
    const broken: CanonText = {
      plan: canon.plan,
      utterances: canon.utterances.filter((u) => !u.id.startsWith('math.p5.')),
    }
    expect(() => pickMathProblems(request('add-to-10'), broken)).toThrow()
  })
})

// ── Dave's rulings, 2026-10-24 (Q1–Q3) ────────────────────────────────────

describe('pickMathProblems: Dave’s rulings', () => {
  it('Q1: a due fact the band keeps out of P4-P8 never opens the session while a box >= 2 fact can', () => {
    // sub-to-10's easy facts: 5-5 (answer 0), 6-3 (3), 9-1 (8).
    const dueFirst = picked(
      'sub-to-10',
      request('sub-to-10', {
        leitner: box([
          [f(5, '-', 5), 1, daysAgo(1)], // due, would open the ramp
          [f(6, '-', 3), 3, daysAgo(1)],
          [f(9, '-', 1), 2, daysAgo(0)],
        ]),
      }),
    )
    expect(dueFirst.slice(0, 3)).toEqual(['6-3', '5-5', '9-1'])
    // No box >= 2 fact to open with: the ramp stands.
    const noOpener = picked(
      'sub-to-10',
      request('sub-to-10', {
        leitner: box([[f(5, '-', 5), 1, daysAgo(1)]]),
      }),
    )
    expect(noOpener.slice(0, 3)).toEqual(['5-5', '6-3', '9-1'])
  })

  it('Q1: a box-2 fact that is not due opens the session too', () => {
    const facts = picked(
      'add-to-10',
      request('add-to-10', {
        leitner: box([
          [f(1, '+', 2), 1, daysAgo(1)], // due, would open the ramp
          [f(2, '+', 2), 2, daysAgo(0)], // box 2, met today: not due
          // 3+2: never answered (no entry) = new.
        ]),
      }),
    )
    expect(facts.slice(0, 3)).toEqual(['2+2', '1+2', '3+2'])
  })

  it('Q1: Leitner decides what gets in: a capped due easy fact plays in P2-P3 and counts toward the cap', () => {
    const pool = wholePool('sub-to-10')
    const known = (x: MathFact): [MathFact, LeitnerBoxIndex, number] => [
      x,
      4,
      daysAgo(1),
    ]
    const due: [MathFact, LeitnerBoxIndex, number][] = [
      [f(9, '-', 1), 1, daysAgo(6)], // easy: barred from P4-P8
      [f(10, '-', 3), 1, daysAgo(5)],
      [f(10, '-', 7), 1, daysAgo(4)],
      [f(8, '-', 3), 1, daysAgo(3)],
    ]
    const dueKeys = new Set(due.map(([x]) => key(x)))
    const req = request('sub-to-10', {
      leitner: box([
        ...SUB_TO_TEN_POOL.map((p) => f(p.a, '-', p.b))
          .filter((x) => !dueKeys.has(key(x)))
          .map(known),
        ...due,
      ]),
    })
    const { problems, relaxed } = pickMathProblems(req, pool)
    expect(relaxed).toEqual([])
    const facts = problems.map((p) => key(factOf(pool, p)))
    expect(['9-1']).toContain(facts[1] === '9-1' ? facts[1] : facts[2])
    expect(facts.filter((k) => dueKeys.has(k))).toHaveLength(3)
    expect(facts).not.toContain('8-3') // the 4th due fact waits
  })

  it('Q2: a floor the learner cannot meet comes as close as the pool allows; box-2 facts then count', () => {
    const pool = wholePool('sub-to-10')
    const req = request('sub-to-10', {
      leitner: box([
        [f(10, '-', 1), 4, daysAgo(1)], // known
        [f(9, '-', 4), 4, daysAgo(1)], // known
        [f(8, '-', 2), 2, daysAgo(0)], // box 2, not due
        [f(7, '-', 1), 2, daysAgo(0)], // box 2, not due
      ]),
    })
    const { problems, relaxed } = pickMathProblems(req, pool)
    expect(relaxed).toEqual(['known-floor'])
    const facts = problems.map((p) => key(factOf(pool, p)))
    expect(facts).toEqual(expect.arrayContaining(['10-1', '9-4']))
    expect(
      facts.filter((k) => ['10-1', '9-4', '8-2', '7-1'].includes(k)).length,
    ).toBeGreaterThanOrEqual(3)
  })

  it('Q2: slow facts count as known', () => {
    const req = request('sub-to-10', {
      leitner: box([
        [f(5, '-', 5), 2, daysAgo(0)],
        [f(6, '-', 3), 2, daysAgo(0)],
        [f(9, '-', 1), 2, daysAgo(0)],
      ]),
      slow: [f(5, '-', 5), f(6, '-', 3), f(9, '-', 1)],
    })
    expect(pickMathProblems(req, canonOf('sub-to-10')).relaxed).not.toContain(
      'known-floor',
    )
  })

  it('Q3 dual exposure: the 8 avoid a warm-up fact’s inverse when they can', () => {
    const pool = wholePool('sub-to-10')
    const { problems, dropWarmup } = pickMathProblems(
      request('sub-to-10', { warmup: [f(3, '+', 5)] }),
      pool,
    )
    expect(dropWarmup).toEqual([])
    const facts = problems.map((p) => key(factOf(pool, p)))
    expect(facts).not.toContain('8-3') // 3 + 5 = 8
  })

  it('Q3 dual exposure: with today’s 8 blocks the warm-up fact gives way instead', () => {
    // 7 + 3 is the inverse of sub-to-10's 10 - 3 and 10 - 7.
    const { dropWarmup } = pickMathProblems(
      request('sub-to-10', { warmup: [f(9, '-', 2), f(7, '+', 3)] }),
      canonOf('sub-to-10'),
    )
    expect(dropWarmup).toEqual([1])
  })

  it('Q3: on − only the same fact is barred: 10 - 3 and 10 - 7 share a session', () => {
    const facts = picked('sub-to-10', request('sub-to-10'))
    expect(facts).toEqual(expect.arrayContaining(['10-3', '10-7']))
  })
})

// ── A whole-pool canon (what plan phase 5a bakes) ─────────────────────────

const WORDS = [
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
const cap = (w: string) => w[0]!.toUpperCase() + w.slice(1)

/** A synthetic canon holding every pool fact (read lines only). */
function wholePool(step: ComposedMathStep): CanonText {
  const reads =
    step === 'add-to-10'
      ? [
          ...ADD_TO_TEN_POOL.map(
            (p) => `${cap(WORDS[p.a]!)} plus ${WORDS[p.b]}. How many?`,
          ),
          ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(
            (g) => `${cap(WORDS[g]!)} and what make ten?`,
          ),
        ]
      : SUB_TO_TEN_POOL.map(
          (p) =>
            `${cap(WORDS[p.a]!)} take away ${WORDS[p.b]}. How many are left?`,
        )
  const utterances = reads.flatMap((text, i) => [
    { id: `math.p${i + 1}.read`, text },
    { id: `math.p${i + 1}.correct`, text: 'Yes!' },
  ])
  return { plan: { id: `${step}-pool`, label: step, utterances }, utterances }
}

describe('pickMathProblems on a whole pool (selection)', () => {
  const pool = wholePool('add-to-10')
  const known = (x: MathFact): [MathFact, LeitnerBoxIndex, number] => [
    x,
    4,
    daysAgo(1),
  ]

  it('opens on 3 known easy facts; slots 4-8 take at most 3 due box-1/2 facts, then at most 2 new', () => {
    const due: [MathFact, LeitnerBoxIndex, number][] = [
      [f(7, '+', 3), 1, daysAgo(5)],
      [f(6, '+', 4), 1, daysAgo(4)],
      [f(8, '+', 2), 1, daysAgo(3)],
      [f(2, '+', 4), 1, daysAgo(2)],
      [f(5, '+', 2), 1, daysAgo(1)],
    ]
    const newFacts = new Set(['3+4', '4+3', '2+6', '1+7'])
    const dueKeys = new Set(due.map(([x]) => key(x)))
    const req = request('add-to-10', {
      leitner: box([
        ...ADD_TO_TEN_POOL.map((p) => f(p.a, '+', p.b))
          .filter((x) => !newFacts.has(key(x)) && !dueKeys.has(key(x)))
          .map(known),
        ...due,
      ]),
    })
    const { problems, relaxed } = pickMathProblems(req, pool)
    expect(relaxed).toEqual([])
    expect(
      mathCompositionViolations('add-to-10', readLines(pool, problems)),
    ).toEqual([])
    const facts = problems.map((p) => key(factOf(pool, p)))
    const boxOf = new Map(req.leitner.items.map((e) => [key(e.item), e.box]))
    expect(facts.slice(0, 3).every((k) => (boxOf.get(k) ?? 0) >= 3)).toBe(true)
    const trap = facts.slice(3)
    // The cap takes the three most overdue (in either shape); the other
    // two wait. At most 2 new facts.
    expect(trap.filter((k) => dueKeys.has(k)).sort()).toEqual([
      '6+4',
      '7+3',
      '8+2',
    ])
    expect(trap.filter((k) => newFacts.has(k)).length).toBeLessThanOrEqual(2)
  })

  it('holds at least 3 known facts when the learner has them, even when only harder facts are known', () => {
    const subPool = wholePool('sub-to-10')
    const req = request('sub-to-10', {
      leitner: box([
        known(f(10, '-', 1)),
        known(f(9, '-', 4)),
        known(f(7, '-', 4)),
        [f(9, '-', 1), 1, daysAgo(1)],
      ]),
    })
    const { problems, relaxed } = pickMathProblems(req, subPool)
    // 9-1 (due) and 10-1 (known) share subtract-one's cap of 1: the due
    // rule gives way before the known floor (Dave, Q2).
    expect(relaxed).toEqual(['due-cap'])
    expect(
      mathCompositionViolations('sub-to-10', readLines(subPool, problems)),
    ).toEqual([])
    const facts = problems.map((p) => key(factOf(subPool, p)))
    expect(
      facts.filter((k) => ['10-1', '9-4', '7-4'].includes(k)),
    ).toHaveLength(3)
    expect(facts).not.toContain('9-1')
  })

  it('doses a slow fact the learner answers right but slowly', () => {
    const req = request('add-to-10', {
      leitner: box(ADD_TO_TEN_POOL.map((p) => known(f(p.a, '+', p.b)))),
      slow: [f(2, '+', 6)],
    })
    const facts = pickMathProblems(req, pool).problems.map((p) =>
      key(factOf(pool, p)),
    )
    expect(facts).toContain('2+6')
  })

  it('prefers facts not met today, then the least recently met', () => {
    const today = localDateKey(new Date(NOW))
    const seen: SeenItems = {}
    const rows: [MathFact, LeitnerBoxIndex, number][] = []
    for (const p of ADD_TO_TEN_POOL) {
      const x = f(p.a, '+', p.b)
      rows.push(known(x))
      seen[`math:${key(x)}`] = { day: today, count: 3, correct: true }
    }
    // Two MEDIUM facts (different bonds) not met today.
    seen['math:2+5'] = { day: '2026-10-10', count: 1, correct: true }
    seen['math:6+2'] = { day: '2026-10-20', count: 1, correct: true }
    const facts = pickMathProblems(
      request('add-to-10', { leitner: box(rows), seen }),
      pool,
    ).problems.map((p) => key(factOf(pool, p)))
    expect(facts).toEqual(expect.arrayContaining(['2+5', '6+2']))
  })

  it('sub-to-10 whole pool: every pick passes the composition rules', () => {
    const subPool = wholePool('sub-to-10')
    const req = request('sub-to-10', {
      leitner: box([
        [f(9, '-', 1), 1, daysAgo(1)],
        [f(10, '-', 3), 1, daysAgo(1)],
        [f(7, '-', 4), 2, daysAgo(2)],
      ]),
    })
    const { problems } = pickMathProblems(req, subPool)
    expect(
      mathCompositionViolations('sub-to-10', readLines(subPool, problems)),
    ).toEqual([])
  })
})
