/**
 * The per-learner seen-record (no-Claude plan phase 3; Dave
 * `design/research/no-claude-variety-2026-10-23.md` § 2.1 rule 5): the
 * progress-doc field, its guard, the migration for a doc written before
 * it, and the once-a-day Leitner promotion that keeps its day in it
 * (§ 2.2 rule 4).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { localDateKey } from './clock'
import { installCloudBlob } from './cloudSync'
import { defaultProgress } from './defaults'
import { isProgressV1 } from './guards'
import {
  applyMathOutcomes,
  mathSeenKey,
  recordProbeResults,
  recordWordsMet,
  seedSeenItems,
  seenItemsOf,
  withWordsMet,
  wordSeenKey,
} from './seenItems'
import { loadProgress, saveProgress } from './storage'
import type { LeitnerBox, MathFact, Progress, SeenItems } from './types'

const fact = (a: number, op: '+' | '-', b: number): MathFact => ({ a, b, op })
const at = (iso: string) => new Date(iso).getTime()
const dayOf = (iso: string) => localDateKey(new Date(iso))

function withSeen(seen: unknown): Record<string, unknown> {
  return { ...defaultProgress(), seenItems: seen }
}

describe('seenItems: the guard', () => {
  it('accepts a doc with a well-formed seen-record', () => {
    expect(
      isProgressV1(
        withSeen({
          'math:3+4': { day: '2026-10-24', count: 2, correct: true },
          'math:7-3': {
            day: '2026-10-23',
            count: 1,
            correct: null,
            promoted: '2026-10-23',
          },
        }),
      ),
    ).toBe(true)
    expect(isProgressV1(withSeen({}))).toBe(true)
    expect(isProgressV1(withSeen(undefined))).toBe(true)
  })

  it('rejects a malformed seen-record, as every other optional field', () => {
    for (const bad of [
      [],
      'math:3+4',
      { 'math:3+4': null },
      { 'math:3+4': { count: 1, correct: true } },
      { 'math:3+4': { day: 20261024, count: 1, correct: true } },
      { 'math:3+4': { day: '2026-10-24', count: -1, correct: true } },
      { 'math:3+4': { day: '2026-10-24', count: 1.5, correct: true } },
      { 'math:3+4': { day: '2026-10-24', count: 1, correct: 'yes' } },
      { 'math:3+4': { day: '2026-10-24', count: 1 } },
      {
        'math:3+4': { day: '2026-10-24', count: 1, correct: true, promoted: 1 },
      },
    ]) {
      expect(isProgressV1(withSeen(bad))).toBe(false)
    }
  })

  it('keeps a newer build’s extra keys inside a record (forward compatibility)', () => {
    expect(
      isProgressV1(
        withSeen({
          'word:cat': { day: '2026-10-24', count: 3, correct: false, slot: 4 },
        }),
      ),
    ).toBe(true)
  })
})

describe('seenItems: the doc carries it', () => {
  beforeEach(() => window.localStorage.clear())

  const seen: SeenItems = {
    'math:3+4': { day: '2026-10-24', count: 2, correct: true },
    'math:7+3': {
      day: '2026-10-24',
      count: 1,
      correct: false,
      promoted: '2026-10-22',
    },
  }

  it('a local save and load keep it intact', () => {
    saveProgress({ ...defaultProgress(), seenItems: seen })
    expect(loadProgress()?.seenItems).toEqual(seen)
  })

  it('a cloud install keeps it (the blob carries the field)', () => {
    const doc = JSON.parse(
      JSON.stringify({ ...defaultProgress(), seenItems: seen }),
    ) as unknown
    expect(installCloudBlob(doc)?.seenItems).toEqual(seen)
  })

  it('a doc without it loads unchanged (the frozen web and older builds write none)', () => {
    const before = defaultProgress()
    saveProgress(before)
    const loaded = loadProgress()!
    expect('seenItems' in loaded).toBe(false)
  })
})

describe('seenItems: the migration (a doc written before the field)', () => {
  it('seeds each fact from the history’s problems: last day and sessions met', () => {
    const p: Progress = {
      ...defaultProgress(),
      history: [
        {
          dateISO: '2026-10-20T09:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 1,
          mathFacts: [fact(3, '+', 4), fact(7, '+', 3), fact(3, '+', 4)],
        },
        {
          dateISO: '2026-10-22T09:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 1,
          mathFacts: [fact(3, '+', 4)],
        },
        {
          dateISO: '2026-10-23T09:00:00.000Z',
          skillFocus: ['blending-cv'],
          successRate: 1,
        },
      ],
    }
    expect(seedSeenItems(p)).toEqual({
      'math:3+4': {
        day: dayOf('2026-10-22T09:00:00.000Z'),
        count: 2,
        correct: null,
      },
      'math:7+3': {
        day: dayOf('2026-10-20T09:00:00.000Z'),
        count: 1,
        correct: null,
      },
    })
  })

  it('a boxed fact the trimmed history no longer shows is seeded from its last move', () => {
    const p: Progress = {
      ...defaultProgress(),
      mathFactsLeitner: {
        items: [
          {
            item: fact(9, '-', 1),
            box: 3,
            lastSeen: at('2026-10-01T12:00:00.000Z'),
          },
          // Never shown (addItem's 0): no record.
          { item: fact(2, '+', 2), box: 1, lastSeen: 0 },
        ],
      },
    }
    expect(seedSeenItems(p)).toEqual({
      'math:9-1': {
        day: dayOf('2026-10-01T12:00:00.000Z'),
        count: 1,
        correct: null,
      },
    })
  })

  it('reads the field when the doc has it, else the seed', () => {
    const seen: SeenItems = {
      'math:1+2': { day: '2026-10-24', count: 5, correct: true },
    }
    const p: Progress = {
      ...defaultProgress(),
      seenItems: seen,
      history: [
        {
          dateISO: '2026-10-20T09:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 1,
          mathFacts: [fact(3, '+', 4)],
        },
      ],
    }
    expect(seenItemsOf(p)).toBe(seen)
    expect(seenItemsOf({ ...p, seenItems: undefined })).toEqual({
      'math:3+4': {
        day: dayOf('2026-10-20T09:00:00.000Z'),
        count: 1,
        correct: null,
      },
    })
    expect(seenItemsOf(defaultProgress())).toEqual({})
  })

  it('keys math facts by operator, so 3+4 and 3-4 never share a record', () => {
    expect(mathSeenKey(fact(3, '+', 4))).toBe('math:3+4')
    expect(mathSeenKey({ a: 3, b: 4, op: '*' })).toBe('math:3*4')
    expect(mathSeenKey(fact(3, '-', 4))).not.toBe(mathSeenKey(fact(3, '+', 4)))
  })
})

describe('applyMathOutcomes: a fact promotes at most once a day, and only when due (Dave § 2.2 rule 4)', () => {
  const AFTERNOON = '2026-10-23T13:00:00.000Z'
  const EVENING = '2026-10-23T17:00:00.000Z'
  const NEXT_DAY = '2026-10-24T09:00:00.000Z'
  const f = fact(3, '+', 4)
  const k = mathSeenKey(f)

  const box = (
    b: 1 | 2 | 3 | 4 | 5,
    lastSeen: number,
  ): LeitnerBox<MathFact> => ({
    items: [{ item: f, box: b, lastSeen }],
  })

  it('a due fact answered right moves up one box and records the day', () => {
    const out = applyMathOutcomes(
      box(2, at('2026-10-20T09:00:00.000Z')),
      {},
      [{ fact: f, correct: true }],
      at(AFTERNOON),
    )
    expect(out.box.items[0]).toEqual({
      item: f,
      box: 3,
      lastSeen: at(AFTERNOON),
    })
    expect(out.seen[k]).toEqual({
      day: dayOf(AFTERNOON),
      count: 1,
      correct: true,
      promoted: dayOf(AFTERNOON),
    })
  })

  it('a fact answered right twice in one afternoon moves up once', () => {
    const first = applyMathOutcomes(
      { items: [] },
      {},
      [{ fact: f, correct: true }],
      at(AFTERNOON),
    )
    expect(first.box.items[0]!.box).toBe(2)
    const second = applyMathOutcomes(
      first.box,
      first.seen,
      [{ fact: f, correct: true }],
      at(EVENING),
    )
    expect(second.box.items[0]).toEqual(first.box.items[0])
    expect(second.seen[k]).toEqual({
      day: dayOf(EVENING),
      count: 2,
      correct: true,
      promoted: dayOf(AFTERNOON),
    })
  })

  it('a right answer on a fact that is not due keeps its box and its due date', () => {
    // Box 3 (3-day interval), moved yesterday: not due today.
    const lastSeen = at('2026-10-22T09:00:00.000Z')
    const out = applyMathOutcomes(
      box(3, lastSeen),
      {},
      [{ fact: f, correct: true }],
      at(AFTERNOON),
    )
    expect(out.box.items[0]).toEqual({ item: f, box: 3, lastSeen })
    expect(out.seen[k]).toEqual({
      day: dayOf(AFTERNOON),
      count: 1,
      correct: true,
    })
  })

  it('a wrong answer still sends a fact to box 1, due or not', () => {
    const out = applyMathOutcomes(
      box(4, at('2026-10-22T09:00:00.000Z')),
      {},
      [{ fact: f, correct: false }],
      at(AFTERNOON),
    )
    expect(out.box.items[0]).toEqual({
      item: f,
      box: 1,
      lastSeen: at(AFTERNOON),
    })
    expect(out.seen[k]).toEqual({
      day: dayOf(AFTERNOON),
      count: 1,
      correct: false,
    })
  })

  it('promoted, then wrong, then right on the same day: it stays in box 1 until tomorrow', () => {
    const up = applyMathOutcomes(
      box(2, at('2026-10-20T09:00:00.000Z')),
      {},
      [{ fact: f, correct: true }],
      at('2026-10-23T10:00:00.000Z'),
    )
    const down = applyMathOutcomes(
      up.box,
      up.seen,
      [{ fact: f, correct: false }],
      at(AFTERNOON),
    )
    const again = applyMathOutcomes(
      down.box,
      down.seen,
      [{ fact: f, correct: true }],
      at(EVENING),
    )
    expect(again.box.items[0]!.box).toBe(1)
    const tomorrow = applyMathOutcomes(
      again.box,
      again.seen,
      [{ fact: f, correct: true }],
      at(NEXT_DAY),
    )
    expect(tomorrow.box.items[0]!.box).toBe(2)
    expect(tomorrow.seen[k]!.promoted).toBe(dayOf(NEXT_DAY))
  })

  it('wrong, then right on the same day (no promotion yet that day): box 1 is due, so it moves to box 2', () => {
    const down = applyMathOutcomes(
      box(3, at('2026-10-15T09:00:00.000Z')),
      {},
      [{ fact: f, correct: false }],
      at(AFTERNOON),
    )
    const up = applyMathOutcomes(
      down.box,
      down.seen,
      [{ fact: f, correct: true }],
      at(EVENING),
    )
    expect(up.box.items[0]!.box).toBe(2)
  })

  it('an unmeasured answer adds a new fact at box 1 and records no seen-day', () => {
    const out = applyMathOutcomes(
      { items: [] },
      {},
      [{ fact: f, correct: undefined }],
      at(AFTERNOON),
    )
    expect(out.box.items).toEqual([{ item: f, box: 1, lastSeen: 0 }])
    expect(out.seen).toEqual({})
  })

  it('never mutates its inputs', () => {
    const b = box(2, at('2026-10-20T09:00:00.000Z'))
    const seen: SeenItems = {
      [k]: { day: '2026-10-20', count: 1, correct: true },
    }
    const snapshot = JSON.stringify({ b, seen })
    applyMathOutcomes(b, seen, [{ fact: f, correct: true }], at(AFTERNOON))
    expect(JSON.stringify({ b, seen })).toBe(snapshot)
  })
})

describe('seenItems: words (the cvc-words probe reserve, Dave 2026-10-24)', () => {
  const MORNING = '2026-10-24T08:00:00.000Z'
  const EVENING = '2026-10-24T19:00:00.000Z'

  it('a word key never collides with a math key', () => {
    expect(wordSeenKey('ham')).toBe('word:ham')
    for (const f of [fact(3, '+', 4), fact(9, '-', 1), fact(2, '+', 5)]) {
      expect(mathSeenKey(f).startsWith('math:')).toBe(true)
      expect(mathSeenKey(f)).not.toBe(wordSeenKey(`${f.a}${f.op}${f.b}`))
    }
  })

  it('the guard takes a word record with a check result, and a newer build’s value', () => {
    expect(
      isProgressV1(
        withSeen({
          'word:ham': { day: '2026-10-24', count: 1, correct: null },
          'word:cab': {
            day: '2026-10-24',
            count: 2,
            correct: true,
            check: 'right',
            checkDay: '2026-10-22',
          },
          'word:rag': {
            day: '2026-10-24',
            count: 1,
            correct: false,
            check: 'missed',
          },
          'word:ram': {
            day: '2026-10-24',
            count: 1,
            correct: null,
            check: 'skipped',
          },
        }),
      ),
    ).toBe(true)
    expect(
      isProgressV1(
        withSeen({
          'word:ham': { day: '2026-10-24', count: 1, correct: null, check: 1 },
        }),
      ),
    ).toBe(false)
    expect(
      isProgressV1(
        withSeen({
          'word:ham': {
            day: '2026-10-24',
            count: 1,
            correct: false,
            check: 'missed',
            checkDay: 20261024,
          },
        }),
      ),
    ).toBe(false)
  })

  it('a word met (Letter Critters): a new record, then a count; its check result is kept', () => {
    const once = recordWordsMet({}, ['ham'], at(MORNING))
    expect(once).toEqual({
      'word:ham': { day: dayOf(MORNING), count: 1, correct: null },
    })
    const checked: SeenItems = {
      'word:ham': {
        day: '2026-10-20',
        count: 1,
        correct: false,
        check: 'missed',
      },
    }
    expect(recordWordsMet(checked, ['ham', 'ham'], at(EVENING))).toEqual({
      'word:ham': {
        day: dayOf(EVENING),
        count: 2,
        correct: false,
        check: 'missed',
      },
    })
    expect(checked['word:ham']!.count).toBe(1)
  })

  it('a check writes each probe word’s first tap and its most recent result with the day (Dave 2026-10-24)', () => {
    const seen = recordProbeResults(
      { 'word:cab': { day: '2026-10-20', count: 3, correct: null } },
      [
        { word: 'cab', correct: true },
        { word: 'ham', correct: false },
      ],
      at(MORNING),
    )
    expect(seen).toEqual({
      'word:cab': {
        day: dayOf(MORNING),
        count: 4,
        correct: true,
        check: 'right',
        checkDay: dayOf(MORNING),
      },
      'word:ham': {
        day: dayOf(MORNING),
        count: 1,
        correct: false,
        check: 'missed',
        checkDay: dayOf(MORNING),
      },
    })
    const later = recordProbeResults(
      seen,
      [{ word: 'ham', correct: true }],
      at(EVENING),
    )
    expect(later['word:ham']).toEqual({
      day: dayOf(EVENING),
      count: 2,
      correct: true,
      check: 'right',
      checkDay: dayOf(EVENING),
    })
    // Letter Critters later keeps the check result and its day.
    const metAgain = recordWordsMet(later, ['ham'], at('2026-10-26T09:00:00'))
    expect(metAgain['word:ham']).toMatchObject({
      check: 'right',
      checkDay: dayOf(EVENING),
      count: 3,
    })
  })

  it('the first word written to a doc without the field keeps the math seed (migration)', () => {
    const p: Progress = {
      ...defaultProgress(),
      history: [
        {
          dateISO: '2026-10-20T09:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 1,
          mathFacts: [fact(3, '+', 4)],
        },
      ],
    }
    expect(withWordsMet(p, ['ham'], at(MORNING)).seenItems).toEqual({
      'math:3+4': {
        day: dayOf('2026-10-20T09:00:00.000Z'),
        count: 1,
        correct: null,
      },
      'word:ham': { day: dayOf(MORNING), count: 1, correct: null },
    })
    expect(withWordsMet(p, [], at(MORNING))).toBe(p)
  })
})
