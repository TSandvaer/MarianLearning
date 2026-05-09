/**
 * Unit tests for `buildSlowFactSessionHint` (M4.x — follow-up to PR
 * #164's Leitner wiring). Pure-function tests, no React.
 *
 * Coverage targets:
 *   - Empty / greenfield input → empty array.
 *   - Below-attempts-threshold facts filtered out.
 *   - Below-correctness-threshold facts filtered out (those are a
 *     Leitner concern, not a slowness concern).
 *   - Below-latency-threshold facts filtered out (already automatic).
 *   - `-1` sentinel ("not measured") excluded from latency aggregation.
 *   - Non-`add-to-10` history entries excluded from aggregation
 *     (mirrors `buildLeitnerSessionHint`'s active scope).
 *   - Output sorted by median-latency-DESCENDING (slowest-first).
 *   - Output capped at `SLOW_FACT_HINT_MAX_ITEMS`.
 *   - Median calculation correct on odd / even-length arrays.
 */

import { describe, expect, it } from 'vitest'
import {
  SLOW_FACT_HINT_MAX_ITEMS,
  SLOW_FACT_MIN_ATTEMPTS,
  SLOW_FACT_MIN_CORRECT_RATE,
  SLOW_FACT_MIN_MEDIAN_LATENCY_MS,
  buildSlowFactSessionHint,
} from './slowFacts'
import { defaultProgress } from './defaults'
import type { Progress, SessionHistoryEntry } from './types'

/** Build a single session-history entry with a parallel-array shape
 *  matching what the production writer ships post-M4.x. */
function buildEntry(args: {
  facts: ReadonlyArray<{ a: number; b: number; op: '+' | '-' | '*' }>
  latencies: ReadonlyArray<number>
  successRate: number
  focus?: SessionHistoryEntry['skillFocus'][number]
  dateISO?: string
}): SessionHistoryEntry {
  return {
    dateISO: args.dateISO ?? '2026-05-09T10:00:00.000Z',
    skillFocus: [args.focus ?? 'add-to-10'],
    successRate: args.successRate,
    latencyMs: [...args.latencies],
    mathFacts: args.facts.map((f) => ({ a: f.a, b: f.b, op: f.op })),
  }
}

/** Mount a Progress doc with a synthetic history. */
function progressWithHistory(history: SessionHistoryEntry[]): Progress {
  return { ...defaultProgress(), history }
}

describe('buildSlowFactSessionHint — empty / greenfield', () => {
  it('returns [] for a fresh progress doc with no history', () => {
    const p = defaultProgress()
    expect(buildSlowFactSessionHint(p)).toEqual([])
  })

  it('returns [] when every entry lacks the parallel mathFacts/latencyMs arrays', () => {
    // Pre-M4.x history doesn't carry the fields. Predicate must
    // skip silently rather than throwing on `undefined`.
    const p = progressWithHistory([
      {
        dateISO: '2026-05-08T10:00:00.000Z',
        skillFocus: ['add-to-10'],
        successRate: 1,
        // no latencyMs, no mathFacts
      },
    ])
    expect(buildSlowFactSessionHint(p)).toEqual([])
  })

  it('returns [] when latency is present but mathFacts is missing (legacy entries)', () => {
    const p = progressWithHistory([
      {
        dateISO: '2026-05-08T10:00:00.000Z',
        skillFocus: ['add-to-10'],
        successRate: 1,
        latencyMs: [6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000],
        // mathFacts missing — pre-M4.x entry shape.
      },
    ])
    expect(buildSlowFactSessionHint(p)).toEqual([])
  })
})

describe('buildSlowFactSessionHint — threshold predicate', () => {
  // Helper: build N sessions all using the same single fact at a
  // fixed latency, so the aggregator sees N attempts of one fact
  // with predictable median.
  function nSessionsOf(
    fact: { a: number; b: number; op: '+' | '-' | '*' },
    perSessionLatencies: ReadonlyArray<number>,
    successRate: number,
    n: number,
  ): SessionHistoryEntry[] {
    return Array.from({ length: n }, (_, i) =>
      buildEntry({
        facts: perSessionLatencies.map(() => fact),
        latencies: perSessionLatencies,
        successRate,
        dateISO: `2026-05-0${i + 1}T10:00:00.000Z`,
      }),
    )
  }

  it('filters out facts below SLOW_FACT_MIN_ATTEMPTS', () => {
    // 4 attempts at latency 6000ms — one less than the 5-attempt
    // threshold. Must be dropped.
    expect(SLOW_FACT_MIN_ATTEMPTS).toBe(5)
    const fact = { a: 4, b: 2, op: '+' as const }
    const p = progressWithHistory([
      buildEntry({
        facts: [fact, fact, fact, fact],
        latencies: [6000, 6000, 6000, 6000],
        successRate: 1,
      }),
    ])
    expect(buildSlowFactSessionHint(p)).toEqual([])
  })

  it('includes a fact at exactly SLOW_FACT_MIN_ATTEMPTS', () => {
    expect(SLOW_FACT_MIN_ATTEMPTS).toBe(5)
    const fact = { a: 4, b: 2, op: '+' as const }
    const p = progressWithHistory([
      buildEntry({
        facts: [fact, fact, fact, fact, fact],
        latencies: [6000, 6000, 6000, 6000, 6000],
        successRate: 1,
      }),
    ])
    const hint = buildSlowFactSessionHint(p)
    expect(hint).toHaveLength(1)
    expect(hint[0]!.fact).toEqual(fact)
    expect(hint[0]!.attempts).toBe(5)
    expect(hint[0]!.medianLatencyMs).toBe(6000)
    expect(hint[0]!.correctRate).toBe(1)
  })

  it('filters out facts below SLOW_FACT_MIN_CORRECT_RATE', () => {
    expect(SLOW_FACT_MIN_CORRECT_RATE).toBe(0.8)
    // 5 sessions at successRate = 0.7 → correctRate approximation = 0.7 < 0.8.
    const fact = { a: 4, b: 2, op: '+' as const }
    const p = progressWithHistory(nSessionsOf(fact, [6000], 0.7, 5))
    expect(buildSlowFactSessionHint(p)).toEqual([])
  })

  it('includes facts at exactly SLOW_FACT_MIN_CORRECT_RATE', () => {
    const fact = { a: 4, b: 2, op: '+' as const }
    const p = progressWithHistory(
      nSessionsOf(fact, [6000], SLOW_FACT_MIN_CORRECT_RATE, 5),
    )
    const hint = buildSlowFactSessionHint(p)
    expect(hint).toHaveLength(1)
    expect(hint[0]!.correctRate).toBeCloseTo(0.8)
  })

  it('filters out facts below SLOW_FACT_MIN_MEDIAN_LATENCY_MS', () => {
    expect(SLOW_FACT_MIN_MEDIAN_LATENCY_MS).toBe(5000)
    // 5 attempts at 4500ms median — under the 5000ms floor.
    const fact = { a: 4, b: 2, op: '+' as const }
    const p = progressWithHistory(nSessionsOf(fact, [4500], 1, 5))
    expect(buildSlowFactSessionHint(p)).toEqual([])
  })

  it('includes facts at exactly SLOW_FACT_MIN_MEDIAN_LATENCY_MS', () => {
    const fact = { a: 4, b: 2, op: '+' as const }
    const p = progressWithHistory(
      nSessionsOf(fact, [SLOW_FACT_MIN_MEDIAN_LATENCY_MS], 1, 5),
    )
    const hint = buildSlowFactSessionHint(p)
    expect(hint).toHaveLength(1)
    expect(hint[0]!.medianLatencyMs).toBe(SLOW_FACT_MIN_MEDIAN_LATENCY_MS)
  })
})

describe('buildSlowFactSessionHint — sentinel handling', () => {
  it('excludes -1 ("not measured") entries from the latency aggregation and from the attempts counter', () => {
    // 5 sessions × 1 problem each. 2 of the 5 are sentinel `-1`
    // (Marian abandoned the problem); the other 3 are 6000ms. With
    // -1 EXCLUDED, attempts = 3 (below the 5-attempt threshold) so
    // the predicate must DROP this fact.
    //
    // This pins the rule that `-1` is invisible — both to the
    // latency median AND to the attempts count. A regression that
    // counted -1 toward attempts would inflate the threshold pass
    // (and pollute the median).
    const fact = { a: 4, b: 2, op: '+' as const }
    const p = progressWithHistory([
      buildEntry({ facts: [fact], latencies: [6000], successRate: 1 }),
      buildEntry({ facts: [fact], latencies: [-1], successRate: 1 }),
      buildEntry({ facts: [fact], latencies: [6000], successRate: 1 }),
      buildEntry({ facts: [fact], latencies: [-1], successRate: 1 }),
      buildEntry({ facts: [fact], latencies: [6000], successRate: 1 }),
    ])
    expect(buildSlowFactSessionHint(p)).toEqual([])
  })

  it('counts only non-sentinel entries on a fact that does qualify', () => {
    // 6 of 7 problems on the same fact are 6000ms; one is `-1`.
    // attempts = 6, median = 6000.
    const fact = { a: 4, b: 2, op: '+' as const }
    const p = progressWithHistory([
      buildEntry({
        facts: [fact, fact, fact, fact, fact, fact, fact],
        latencies: [6000, 6000, -1, 6000, 6000, 6000, 6000],
        successRate: 1,
      }),
    ])
    const hint = buildSlowFactSessionHint(p)
    expect(hint).toHaveLength(1)
    expect(hint[0]!.attempts).toBe(6)
    expect(hint[0]!.medianLatencyMs).toBe(6000)
  })
})

describe('buildSlowFactSessionHint — focus-node gating', () => {
  it('ignores entries whose skillFocus is not add-to-10', () => {
    // 5 attempts on add-to-20 focus shouldn't surface in the
    // add-to-10 directive. Same gating posture as
    // `buildLeitnerSessionHint` — Leitner is currently
    // add-to-10-only.
    const fact = { a: 7, b: 6, op: '+' as const }
    const p = progressWithHistory([
      buildEntry({
        facts: [fact, fact, fact, fact, fact],
        latencies: [6000, 6000, 6000, 6000, 6000],
        successRate: 1,
        focus: 'add-to-20',
      }),
    ])
    expect(buildSlowFactSessionHint(p)).toEqual([])
  })
})

describe('buildSlowFactSessionHint — sorting + capping', () => {
  it('sorts output by median-latency-DESCENDING (slowest-first)', () => {
    // Three qualifying facts at distinct medians. Output must place
    // the slowest first.
    function fiveAt(
      fact: { a: number; b: number; op: '+' | '-' | '*' },
      latency: number,
    ): SessionHistoryEntry {
      return buildEntry({
        facts: [fact, fact, fact, fact, fact],
        latencies: [latency, latency, latency, latency, latency],
        successRate: 1,
      })
    }
    const slowFact = { a: 1, b: 9, op: '+' as const } // median 9000
    const midFact = { a: 2, b: 8, op: '+' as const } // median 6000
    const fastFact = { a: 3, b: 7, op: '+' as const } // median 5500

    const p = progressWithHistory([
      fiveAt(midFact, 6000),
      fiveAt(slowFact, 9000),
      fiveAt(fastFact, 5500),
    ])
    const hint = buildSlowFactSessionHint(p)
    expect(hint).toHaveLength(3)
    expect(hint[0]!.fact).toEqual(slowFact)
    expect(hint[1]!.fact).toEqual(midFact)
    expect(hint[2]!.fact).toEqual(fastFact)
  })

  it(`caps the output at SLOW_FACT_HINT_MAX_ITEMS = ${SLOW_FACT_HINT_MAX_ITEMS}`, () => {
    expect(SLOW_FACT_HINT_MAX_ITEMS).toBe(8)
    // 12 distinct qualifying facts at distinct latencies. After
    // sorting DESC by latency, the first 8 win.
    const entries: SessionHistoryEntry[] = []
    for (let i = 0; i < 12; i++) {
      const fact = { a: 1, b: i + 1, op: '+' as const }
      const latency = 5000 + i * 200 // 5000, 5200, ..., 7200
      entries.push(
        buildEntry({
          facts: [fact, fact, fact, fact, fact],
          latencies: [latency, latency, latency, latency, latency],
          successRate: 1,
        }),
      )
    }
    const p = progressWithHistory(entries)
    const hint = buildSlowFactSessionHint(p)
    expect(hint).toHaveLength(SLOW_FACT_HINT_MAX_ITEMS)
    // Top entry is the slowest (i=11, latency 7200).
    expect(hint[0]!.medianLatencyMs).toBe(7200)
    // Slowest-trimmed entry — the 9th-fastest, i=4, latency 5800.
    // The 8 winners are i=11..4; i=3 (5600) is dropped.
    expect(hint[7]!.medianLatencyMs).toBe(5800)
  })
})

describe('buildSlowFactSessionHint — median computation', () => {
  it('returns the single value for a 1-element series', () => {
    const fact = { a: 4, b: 2, op: '+' as const }
    const p = progressWithHistory([
      buildEntry({
        facts: [fact, fact, fact, fact, fact],
        latencies: [6000, 6000, 6000, 6000, 6000],
        successRate: 1,
      }),
    ])
    expect(buildSlowFactSessionHint(p)[0]!.medianLatencyMs).toBe(6000)
  })

  it('returns the middle value for an odd-length series', () => {
    // 5 distinct values; sorted: [5000, 5500, 6000, 6500, 7000].
    // Median = 6000.
    const fact = { a: 4, b: 2, op: '+' as const }
    const p = progressWithHistory([
      buildEntry({
        facts: [fact, fact, fact, fact, fact],
        latencies: [7000, 5500, 6000, 6500, 5000],
        successRate: 1,
      }),
    ])
    expect(buildSlowFactSessionHint(p)[0]!.medianLatencyMs).toBe(6000)
  })

  it('returns the mean of the two middle values for an even-length series', () => {
    // 6 attempts. We need 5+ for the threshold and an even count
    // for the median branch — split across 2 sessions of 3 each.
    const fact = { a: 4, b: 2, op: '+' as const }
    const p = progressWithHistory([
      buildEntry({
        facts: [fact, fact, fact],
        latencies: [5000, 5500, 6000],
        successRate: 1,
      }),
      buildEntry({
        facts: [fact, fact, fact],
        latencies: [6500, 7000, 7500],
        successRate: 1,
        dateISO: '2026-05-10T10:00:00.000Z',
      }),
    ])
    // Sorted: [5000, 5500, 6000, 6500, 7000, 7500].
    // Median = (6000 + 6500) / 2 = 6250.
    const hint = buildSlowFactSessionHint(p)
    expect(hint).toHaveLength(1)
    expect(hint[0]!.attempts).toBe(6)
    expect(hint[0]!.medianLatencyMs).toBe(6250)
  })
})

describe('buildSlowFactSessionHint — fact aggregation across sessions', () => {
  it('joins per-fact attempts across multiple sessions', () => {
    // Same fact in 3 sessions, different latencies. Aggregator sums.
    const fact = { a: 4, b: 2, op: '+' as const }
    const p = progressWithHistory([
      buildEntry({
        facts: [fact, fact],
        latencies: [6000, 5500],
        successRate: 1,
      }),
      buildEntry({
        facts: [fact, fact],
        latencies: [6500, 6000],
        successRate: 1,
        dateISO: '2026-05-10T10:00:00.000Z',
      }),
      buildEntry({
        facts: [fact],
        latencies: [7000],
        successRate: 1,
        dateISO: '2026-05-11T10:00:00.000Z',
      }),
    ])
    // 5 attempts: [6000, 5500, 6500, 6000, 7000] → sorted
    // [5500, 6000, 6000, 6500, 7000] → median 6000.
    const hint = buildSlowFactSessionHint(p)
    expect(hint).toHaveLength(1)
    expect(hint[0]!.attempts).toBe(5)
    expect(hint[0]!.medianLatencyMs).toBe(6000)
  })

  it('treats 4+2 and 2+4 as DISTINCT facts (operand order matters)', () => {
    // Same Leitner-key contract — `${a}${op}${b}`. A regression that
    // normalised commutative addition would silently merge these.
    const factForward = { a: 4, b: 2, op: '+' as const }
    const factReverse = { a: 2, b: 4, op: '+' as const }
    const p = progressWithHistory([
      buildEntry({
        facts: [
          factForward,
          factForward,
          factForward,
          factForward,
          factForward,
        ],
        latencies: [6000, 6000, 6000, 6000, 6000],
        successRate: 1,
      }),
      buildEntry({
        facts: [
          factReverse,
          factReverse,
          factReverse,
          factReverse,
          factReverse,
        ],
        latencies: [7000, 7000, 7000, 7000, 7000],
        successRate: 1,
        dateISO: '2026-05-10T10:00:00.000Z',
      }),
    ])
    const hint = buildSlowFactSessionHint(p)
    expect(hint).toHaveLength(2)
    // Sorted DESC by median latency — reverse (7000) before forward
    // (6000).
    expect(hint[0]!.fact).toEqual(factReverse)
    expect(hint[1]!.fact).toEqual(factForward)
  })
})
