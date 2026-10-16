/**
 * Core's review / warm-up picker (native spec
 * `design/native/review-mode-and-warmup-native.md` § 9, AC 1–6).
 *
 * Every timestamp is a LOCAL wall-clock time (`new Date(y, m, d, h)`), so
 * the day keys the picker compares are the same in any timezone the suite
 * runs in.
 */
import { describe, expect, it } from 'vitest'
import { progressAtStep } from '../debug/stepProgress'
import { CANON_MATH_FACTS } from './canonMathFacts.generated'
import { localDateKey } from './clock'
import { defaultProgress } from './defaults'
import { LEITNER_DUE_PER_SESSION_CAP } from './leitner'
import { LITERACY_TREE, MATH_TREE } from './mastery'
import {
  forwardLeitnerHint,
  isFirstSessionToday,
  isReviewSession,
  pickReviewBlocks,
  pickWarmupBlocks,
  reviewBaseline,
  reviewPool,
  sessionPlanKind,
  WARMUP_PROBLEMS,
  type CanonBlockRef,
} from './reviewPlan'
import type {
  LeitnerBoxIndex,
  LeitnerItem,
  MathFact,
  Progress,
  SessionHistoryEntry,
  SkillNode,
} from './types'

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m)
const MON = 12
const TUE = 13
const NOW = at(TUE, 8)
const NOW_MS = NOW.getTime()
const TODAY = localDateKey(NOW)

function entry(node: SkillNode, when: Date, correct = 7): SessionHistoryEntry {
  return {
    dateISO: when.toISOString(),
    skillFocus: [node],
    successRate: correct / 8,
  }
}

function item(
  a: number,
  op: '+' | '-' | '*',
  b: number,
  box: LeitnerBoxIndex,
  lastSeen: Date,
): LeitnerItem<MathFact> {
  return { item: { a, b, op }, box, lastSeen: lastSeen.getTime() }
}

const withHistory = (p: Progress, ...h: SessionHistoryEntry[]): Progress => ({
  ...p,
  history: [...p.history, ...h],
})

const withBox = (p: Progress, ...items: LeitnerItem<MathFact>[]): Progress => ({
  ...p,
  mathFactsLeitner: { items },
})

const factOf = (ref: CanonBlockRef): MathFact | null =>
  (CANON_MATH_FACTS as Record<string, readonly (MathFact | null)[]>)[ref.node]![
    ref.problem - 1
  ]!

const refKey = (r: CanonBlockRef) => `${r.node}#${r.problem}`

/** progressAtStep('sub-to-10') with a 7/8 sub-to-10 session today. */
const subTo10Today = () =>
  withHistory(progressAtStep('sub-to-10'), entry('sub-to-10', at(TUE, 7)))

describe('reviewBaseline / reviewPool (D2)', () => {
  it('AC1: the baseline is the set of mastered steps in defaultProgress()', () => {
    const levels = defaultProgress().skillLevels
    const expected = [...MATH_TREE, ...LITERACY_TREE].filter(
      (n) => levels[n] === 'mastered',
    )
    expect([...reviewBaseline()].sort()).toEqual([...expected].sort())
    expect([...reviewBaseline()].sort()).toEqual([
      'letter-names',
      'number-recog',
    ])
  })

  it('AC1: with the defaults there is no review in either world, even after a good day today', () => {
    const p = withHistory(
      defaultProgress(),
      entry('add-to-10', at(TUE, 7), 8),
      entry('letter-sounds', at(TUE, 7), 8),
    )
    expect(reviewPool(p, 'math')).toEqual([])
    expect(reviewPool(p, 'word-song')).toEqual([])
    expect(isReviewSession(p, 'math', TODAY)).toBe(false)
    expect(isReviewSession(p, 'word-song', TODAY)).toBe(false)
  })

  it('the pool is the mastered non-baseline steps in tree order; [] for a complete world', () => {
    expect(reviewPool(progressAtStep('sub-to-10'), 'math')).toEqual([
      'add-to-10',
      'add-to-20',
    ])
    expect(
      reviewPool(progressAtStep('cvc-words-short-o'), 'word-song'),
    ).toEqual(['letter-sounds', 'blending-cv', 'cvc-words'])
    const done = progressAtStep('mult-mix')
    done.skillLevels['mult-mix'] = 'mastered'
    expect(reviewPool(done, 'math')).toEqual([])
  })
})

describe('isReviewSession (D1)', () => {
  it('AC2: true once the current step banked today’s flower', () => {
    expect(isReviewSession(subTo10Today(), 'math', TODAY)).toBe(true)
    // Not the other world, and not before the good day.
    expect(isReviewSession(subTo10Today(), 'word-song', TODAY)).toBe(false)
    expect(isReviewSession(progressAtStep('sub-to-10'), 'math', TODAY)).toBe(
      false,
    )
  })

  it('false under the good-day score, and when the parent switched the separate-days rule off', () => {
    const low = withHistory(
      progressAtStep('sub-to-10'),
      entry('sub-to-10', at(TUE, 7), 5),
    )
    expect(isReviewSession(low, 'math', TODAY)).toBe(false)
    const p = subTo10Today()
    p.parentSettings = { ...p.parentSettings!, crossDayEnforcement: false }
    expect(isReviewSession(p, 'math', TODAY)).toBe(false)
  })
})

describe('pickReviewBlocks (§ 7.2)', () => {
  it('AC2: 8 refs from {add-to-10, add-to-20}, alternating steps, no two sharing a fact', () => {
    const refs = pickReviewBlocks(subTo10Today(), 'math', NOW_MS, 3)
    expect(refs).toHaveLength(8)
    expect(new Set(refs.map((r) => r.node))).toEqual(
      new Set(['add-to-10', 'add-to-20']),
    )
    for (let i = 1; i < refs.length; i++) {
      expect(refs[i]!.node).not.toBe(refs[i - 1]!.node)
    }
    const facts = refs.map((r) => {
      const f = factOf(r)!
      return `${f.a}${f.op}${f.b}`
    })
    expect(new Set(facts).size).toBe(8)
    expect(new Set(refs.map(refKey)).size).toBe(8)
  })

  it('reproduces the spec example (seed 5, nothing due)', () => {
    expect(pickReviewBlocks(subTo10Today(), 'math', NOW_MS, 5)).toEqual([
      { node: 'add-to-20', problem: 6 },
      { node: 'add-to-10', problem: 6 },
      { node: 'add-to-20', problem: 7 },
      { node: 'add-to-10', problem: 7 },
      { node: 'add-to-20', problem: 8 },
      { node: 'add-to-10', problem: 8 },
      { node: 'add-to-20', problem: 1 },
      { node: 'add-to-10', problem: 1 },
    ])
  })

  it('back-to-back reviews (seed + 1) draw different blocks', () => {
    const a = pickReviewBlocks(subTo10Today(), 'math', NOW_MS, 5).map(refKey)
    const b = pickReviewBlocks(subTo10Today(), 'math', NOW_MS, 6).map(refKey)
    expect(a).not.toEqual(b)
  })

  it('AC3: with 5 due add-to-10 facts, the 3 highest-ranked come first in their step and exactly 3 are due picks', () => {
    // Ranks (overdue days desc, box asc, key asc): 1+2 (3 days), 2+2 (2),
    // 3+2 (1), 4+5 (0, box 1), 5+5 (0, box 1, key after 4+5).
    const p = withBox(
      subTo10Today(),
      item(1, '+', 2, 1, at(TUE - 3, 9)),
      item(2, '+', 2, 1, at(TUE - 2, 9)),
      item(3, '+', 2, 1, at(TUE - 1, 9)),
      item(5, '+', 5, 1, at(TUE, 6)),
      item(4, '+', 5, 1, at(TUE, 6)),
    )
    // seed 0: rot = 1..8; add-to-10's fill reaches #4 and #5 (2+4, 4+4)
    // after skipping the picked #1 / #2 / #3, not #6 / #8 (5+5, 4+5).
    const refs = pickReviewBlocks(p, 'math', NOW_MS, 0)
    expect(refs).toHaveLength(8)
    const tens = refs.filter((r) => r.node === 'add-to-10')
    expect(tens.slice(0, 3)).toEqual([
      { node: 'add-to-10', problem: 1 },
      { node: 'add-to-10', problem: 2 },
      { node: 'add-to-10', problem: 3 },
    ])
    expect(tens.map(refKey)).not.toContain('add-to-10#6')
    expect(tens.map(refKey)).not.toContain('add-to-10#8')
    expect(tens).toHaveLength(5)
    expect(refs.filter((r) => r.node === 'add-to-20')).toHaveLength(3)
  })

  it('[] with nothing to review', () => {
    expect(pickReviewBlocks(defaultProgress(), 'math', NOW_MS, 0)).toEqual([])
  })

  it('Word Song mixes the three review steps, newest first', () => {
    const refs = pickReviewBlocks(
      progressAtStep('cvc-words-short-o'),
      'word-song',
      NOW_MS,
      0,
    )
    expect(refs).toHaveLength(8)
    expect(refs.slice(0, 3).map((r) => r.node)).toEqual([
      'cvc-words',
      'blending-cv',
      'letter-sounds',
    ])
    expect(new Set(refs.map(refKey)).size).toBe(8)
  })
})

describe('isFirstSessionToday (§ 7.3)', () => {
  it('AC4: true with no entry for the world today (yesterday or the other world only)', () => {
    const p = withHistory(
      progressAtStep('sub-to-10'),
      entry('sub-to-10', at(MON, 18)),
      entry('cvc-words', at(TUE, 7)),
    )
    expect(isFirstSessionToday(p, 'math', TODAY)).toBe(true)
    expect(isFirstSessionToday(defaultProgress(), 'math', TODAY)).toBe(true)
  })

  it('AC4: false after a finished session in that world today; a review today changes nothing', () => {
    const p = withHistory(
      progressAtStep('sub-to-10'),
      entry('sub-to-10', at(TUE, 7)),
    )
    expect(isFirstSessionToday(p, 'math', TODAY)).toBe(false)
    expect(isFirstSessionToday(p, 'word-song', TODAY)).toBe(true)
    // A review writes no history: the doc is unchanged, so still false.
    expect(isFirstSessionToday({ ...p }, 'math', TODAY)).toBe(false)
    // Wednesday's first session warms up again.
    expect(isFirstSessionToday(p, 'math', localDateKey(at(TUE + 1, 8)))).toBe(
      true,
    )
  })
})

describe('pickWarmupBlocks (§ 7.2, D4)', () => {
  /**
   * The § 7.2 example: defaults (current add-to-10, no review steps), on
   * the content wave 1 canon: its 2+4 and 5+5 blocks became missing
   * numbers, so the box-2 fact is 7+3 (#4, "Seven and what make ten?") and
   * the not-yet-due box-3 fact 6+4 (#6).
   */
  const example = () =>
    withBox(
      withHistory(defaultProgress(), entry('add-to-10', at(MON, 18))),
      item(3, '+', 2, 1, at(MON, 18)),
      item(4, '+', 5, 1, at(MON, 18, 5)),
      item(7, '+', 3, 2, at(MON, 17)),
      // Box 3 promoted Monday: not due until Thursday.
      item(6, '+', 4, 3, at(MON, 17)),
    )

  it('AC5 (math): the spec example gives add-to-10 #4 then #3', () => {
    expect(pickWarmupBlocks(example(), 'math', NOW_MS, TODAY, 0)).toEqual([
      { node: 'add-to-10', problem: 4 },
      { node: 'add-to-10', problem: 3 },
    ])
  })

  it('AC5 (math): heart 1 is a box ≥ 2 fact whenever one is a candidate; never a not-yet-due fact', () => {
    const p = withBox(
      example(),
      // Two more overdue box-1 facts rank above 7+3 (box 2, overdue 0).
      item(1, '+', 2, 1, at(TUE - 3, 9)),
      item(2, '+', 2, 1, at(TUE - 3, 9)),
      item(7, '+', 3, 2, at(MON, 17)),
      item(6, '+', 4, 3, at(MON, 17)),
    )
    const refs = pickWarmupBlocks(p, 'math', NOW_MS, TODAY, 0)
    expect(refs).toHaveLength(WARMUP_PROBLEMS)
    expect(refs[0]).toEqual({ node: 'add-to-10', problem: 4 }) // 7+3, box 2
    expect(refs[1]).toEqual({ node: 'add-to-10', problem: 1 }) // top box 1
    expect(refs.map(refKey)).not.toContain('add-to-10#6') // 6+4, not due
  })

  it('AC5 (math): with no box ≥ 2 candidate, heart 1 is the top candidate; one candidate → one heart', () => {
    const one = withBox(
      withHistory(defaultProgress(), entry('add-to-10', at(MON, 18))),
      item(4, '+', 5, 1, at(MON, 18)),
    )
    expect(pickWarmupBlocks(one, 'math', NOW_MS, TODAY, 0)).toEqual([
      { node: 'add-to-10', problem: 7 },
    ])
    expect(
      pickWarmupBlocks(defaultProgress(), 'math', NOW_MS, TODAY, 0),
    ).toEqual([])
  })

  it('AC5: [] when it is not the first session today', () => {
    const p = withHistory(example(), entry('add-to-10', at(TUE, 7, 30)))
    expect(pickWarmupBlocks(p, 'math', NOW_MS, TODAY, 0)).toEqual([])
  })

  it('AC5 (Word Song): every ref from the newest review step, never the current or a baseline step', () => {
    const p = progressAtStep('cvc-words-short-o')
    for (const seed of [0, 1, 5, 7, 12]) {
      const refs = pickWarmupBlocks(p, 'word-song', NOW_MS, TODAY, seed)
      expect(refs).toHaveLength(2)
      expect(refs.every((r) => r.node === 'cvc-words')).toBe(true)
      expect(new Set(refs.map(refKey)).size).toBe(2)
    }
    expect(pickWarmupBlocks(p, 'word-song', NOW_MS, TODAY, 5)).toEqual([
      { node: 'cvc-words', problem: 6 },
      { node: 'cvc-words', problem: 7 },
    ])
    expect(
      pickWarmupBlocks(defaultProgress(), 'word-song', NOW_MS, TODAY, 0),
    ).toEqual([])
  })
})

describe('forwardLeitnerHint (§ 7.4, one shared cap of 3)', () => {
  const box = () =>
    withBox(
      defaultProgress(),
      item(3, '+', 2, 1, at(MON, 18)),
      item(4, '+', 5, 1, at(MON, 18)),
      item(2, '+', 4, 1, at(MON, 17)),
      item(1, '+', 2, 1, at(MON, 17)),
      item(2, '+', 2, 1, at(MON, 17)),
    ).mathFactsLeitner

  it('AC6: 2 warm-up refs leave at most 1 fact, neither warm-up fact', () => {
    const warmup: CanonBlockRef[] = [
      { node: 'add-to-10', problem: 4 }, // 2+4
      { node: 'add-to-10', problem: 3 }, // 3+2
    ]
    const hint = forwardLeitnerHint(box(), NOW_MS, 'add-to-10', warmup)
    expect(hint.length).toBeLessThanOrEqual(1)
    expect(hint).toHaveLength(1)
    const keys = hint.map((h) => `${h.a}${h.op}${h.b}`)
    expect(keys).not.toContain('2+4')
    expect(keys).not.toContain('3+2')
  })

  it('AC6: 1 warm-up ref leaves at most 2; none leaves the usual cap of 3', () => {
    const one = forwardLeitnerHint(box(), NOW_MS, 'add-to-10', [
      { node: 'add-to-10', problem: 4 },
    ])
    expect(one).toHaveLength(2)
    expect(one.map((h) => `${h.a}${h.op}${h.b}`)).not.toContain('2+4')
    expect(forwardLeitnerHint(box(), NOW_MS, 'add-to-10', [])).toHaveLength(
      LEITNER_DUE_PER_SESSION_CAP,
    )
  })
})

describe('sessionPlanKind (§ 2)', () => {
  it('a review when today’s flower sleeps, else forward with the warm-up', () => {
    const review = sessionPlanKind(subTo10Today(), 'math', NOW_MS, TODAY, 5)
    expect(review.kind).toBe('review')
    expect(review.kind === 'review' && review.blocks).toHaveLength(8)

    const forward = sessionPlanKind(
      withBox(
        withHistory(
          progressAtStep('sub-to-10'),
          entry('sub-to-10', at(MON, 18)),
        ),
        item(9, '+', 2, 2, at(MON, 18)),
      ),
      'math',
      NOW_MS,
      TODAY,
      5,
    )
    expect(forward).toEqual({
      kind: 'forward',
      warmup: [{ node: 'add-to-20', problem: 1 }],
    })
  })

  it('a complete world is a forward session (no sleeping flower)', () => {
    const done = progressAtStep('mult-mix')
    done.skillLevels['mult-mix'] = 'mastered'
    const p = withHistory(done, entry('mult-6-9', at(TUE, 7), 8))
    expect(sessionPlanKind(p, 'math', NOW_MS, TODAY, 0).kind).toBe('forward')
  })
})
