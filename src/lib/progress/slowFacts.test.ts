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
  SLOW_FACT_MIN_MEDIAN_LATENCY_MS_SUB,
  SLOW_FACT_SUB_WARMUP_SESSIONS,
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

// ── Sub-to-10 op-parameterized threshold + warmup (Kyle's spec §8) ───────
//
// Thomas's 2026-05-15 lock: flat 6000ms threshold for op === '-', plus
// a 5-session warmup where surfacing is suppressed entirely. The skip-
// the-3-band-ladder alternative.

describe('buildSlowFactSessionHint — sub-to-10 warmup gate', () => {
  /** Build N sub-to-10 sessions all on the same single fact at a
   *  fixed latency. Each session counts toward the warmup window AND
   *  contributes one attempt to the per-fact aggregator. */
  function nSubSessionsAt(
    n: number,
    fact: { a: number; b: number; op: '+' | '-' | '*' },
    latencyMs: number,
  ): Progress {
    const history: SessionHistoryEntry[] = []
    for (let i = 0; i < n; i++) {
      history.push(
        buildEntry({
          facts: [fact],
          latencies: [latencyMs],
          successRate: 1,
          focus: 'sub-to-10',
          dateISO: `2026-05-${String(15 + i).padStart(2, '0')}T10:00:00.000Z`,
        }),
      )
    }
    return progressWithHistory(history)
  }

  it('suppresses surfacing entirely below SLOW_FACT_SUB_WARMUP_SESSIONS (5) — even with N≥SLOW_FACT_MIN_ATTEMPTS', () => {
    // Sanity: SLOW_FACT_MIN_ATTEMPTS is 5 (the per-fact data floor).
    // The warmup window is the per-NODE session floor — different
    // count even though they share the same numeric value (5) in v1.
    // Either floor not met = no surfacing. Here we'd cross the
    // per-fact attempts floor at N=5 sessions × 1 problem each = 5
    // attempts, BUT the warmup gate ALSO suppresses at < 5 sessions.
    // Test both bands.
    const fact = { a: 10, b: 2, op: '-' as const }
    for (let n = 1; n < SLOW_FACT_SUB_WARMUP_SESSIONS; n++) {
      const p = nSubSessionsAt(n, fact, 7000)
      expect(buildSlowFactSessionHint(p)).toEqual([])
    }
  })

  it('engages surfacing once sessionsOnNode >= SLOW_FACT_SUB_WARMUP_SESSIONS AND latency is above the sub-threshold (6000ms)', () => {
    // N = 5 sessions × 1 problem each = 5 attempts (== MIN_ATTEMPTS).
    // Each at 7000ms (above the 6000ms sub-threshold). Surfacing
    // engages.
    const fact = { a: 10, b: 2, op: '-' as const }
    const p = nSubSessionsAt(SLOW_FACT_SUB_WARMUP_SESSIONS, fact, 7000)
    const hint = buildSlowFactSessionHint(p)
    expect(hint).toHaveLength(1)
    expect(hint[0]!.fact).toEqual(fact)
    expect(hint[0]!.medianLatencyMs).toBe(7000)
    expect(hint[0]!.attempts).toBe(SLOW_FACT_SUB_WARMUP_SESSIONS)
  })

  it('post-warmup, sub-fact below SLOW_FACT_MIN_MEDIAN_LATENCY_MS_SUB (6000ms) is filtered out', () => {
    // 5 sessions × 1 problem each at 5500ms. Warmup is satisfied
    // (5 ≥ 5 sessions) AND the per-fact attempts floor is satisfied
    // (5 ≥ 5 attempts), BUT the median 5500ms is below the
    // sub-threshold of 6000ms. Same as the addition path at 5500ms
    // would surface (it's > 5000ms), but for `-` it's gated higher.
    const fact = { a: 10, b: 5, op: '-' as const }
    const p = nSubSessionsAt(SLOW_FACT_SUB_WARMUP_SESSIONS, fact, 5500)
    expect(buildSlowFactSessionHint(p)).toEqual([])
  })

  it('the warmup gate counts sub-to-10 sessions, NOT add-to-10 sessions — running adds doesn’t accelerate sub surfacing', () => {
    // 4 sub-to-10 sessions (below warmup) + 10 add-to-10 sessions
    // (irrelevant for the sub warmup count). The sub fact has 4
    // attempts which is below MIN_ATTEMPTS=5 AND the node count is 4
    // which is below SUB_WARMUP=5; sub surfacing stays suppressed.
    const subFact = { a: 9, b: 4, op: '-' as const }
    const addFact = { a: 7, b: 3, op: '+' as const }
    const history: SessionHistoryEntry[] = []
    for (let i = 0; i < 4; i++) {
      history.push(
        buildEntry({
          facts: [subFact],
          latencies: [7000],
          successRate: 1,
          focus: 'sub-to-10',
          dateISO: `2026-05-${String(15 + i).padStart(2, '0')}T10:00:00.000Z`,
        }),
      )
    }
    for (let i = 0; i < 10; i++) {
      history.push(
        buildEntry({
          facts: [addFact],
          latencies: [6500],
          successRate: 1,
          focus: 'add-to-10',
          dateISO: `2026-05-${String(20 + i).padStart(2, '0')}T10:00:00.000Z`,
        }),
      )
    }
    const hint = buildSlowFactSessionHint(progressWithHistory(history))
    // Sub fact suppressed (warmup not met). Add fact surfaces
    // (10 attempts × 6500ms > 5000ms threshold).
    expect(hint).toHaveLength(1)
    expect(hint[0]!.fact).toEqual(addFact)
  })
})

describe('buildSlowFactSessionHint — op-parameterized latency threshold', () => {
  it('uses 5000ms for op === "+" — addition fact at 5500ms surfaces', () => {
    // Existing add-to-10 behaviour unchanged. 5 sessions × 1 add fact
    // at 5500ms median → above SLOW_FACT_MIN_MEDIAN_LATENCY_MS (5000)
    // and above SLOW_FACT_MIN_ATTEMPTS (5). Surfaces.
    const fact = { a: 4, b: 3, op: '+' as const }
    const history: SessionHistoryEntry[] = []
    for (let i = 0; i < 5; i++) {
      history.push(
        buildEntry({
          facts: [fact],
          latencies: [5500],
          successRate: 1,
          focus: 'add-to-10',
        }),
      )
    }
    const hint = buildSlowFactSessionHint(progressWithHistory(history))
    expect(hint).toHaveLength(1)
    expect(hint[0]!.fact).toEqual(fact)
    expect(hint[0]!.medianLatencyMs).toBe(5500)
  })

  it('uses 6000ms for op === "-" — sub fact at 5500ms does NOT surface even post-warmup', () => {
    // Same setup as above but for op === '-' (warmup satisfied: 5
    // sessions ≥ 5). 5500ms median is above '+' threshold (5000) but
    // below '-' threshold (6000). Filtered out.
    const fact = { a: 8, b: 3, op: '-' as const }
    const history: SessionHistoryEntry[] = []
    for (let i = 0; i < 5; i++) {
      history.push(
        buildEntry({
          facts: [fact],
          latencies: [5500],
          successRate: 1,
          focus: 'sub-to-10',
          dateISO: `2026-05-${String(15 + i).padStart(2, '0')}T10:00:00.000Z`,
        }),
      )
    }
    expect(buildSlowFactSessionHint(progressWithHistory(history))).toEqual([])
  })

  it('uses 6000ms for op === "-" — sub fact at 6500ms surfaces post-warmup', () => {
    const fact = { a: 8, b: 3, op: '-' as const }
    const history: SessionHistoryEntry[] = []
    for (let i = 0; i < 5; i++) {
      history.push(
        buildEntry({
          facts: [fact],
          latencies: [6500],
          successRate: 1,
          focus: 'sub-to-10',
          dateISO: `2026-05-${String(15 + i).padStart(2, '0')}T10:00:00.000Z`,
        }),
      )
    }
    const hint = buildSlowFactSessionHint(progressWithHistory(history))
    expect(hint).toHaveLength(1)
    expect(hint[0]!.fact).toEqual(fact)
    expect(hint[0]!.medianLatencyMs).toBe(6500)
  })

  it('cross-op aggregation: 4+3 and 7-3 do NOT aggregate even with same operand digits', () => {
    // Different ops → different mathFactKey ("4+3" vs "7-3"). Aggregator
    // treats them as distinct facts. Each must independently satisfy
    // its own threshold.
    const addFact = { a: 4, b: 3, op: '+' as const }
    const subFact = { a: 7, b: 3, op: '-' as const }
    const history: SessionHistoryEntry[] = []
    for (let i = 0; i < 5; i++) {
      history.push(
        buildEntry({
          facts: [addFact],
          latencies: [5500],
          successRate: 1,
          focus: 'add-to-10',
          dateISO: `2026-05-${String(10 + i).padStart(2, '0')}T10:00:00.000Z`,
        }),
      )
    }
    for (let i = 0; i < 5; i++) {
      history.push(
        buildEntry({
          facts: [subFact],
          latencies: [6500],
          successRate: 1,
          focus: 'sub-to-10',
          dateISO: `2026-05-${String(15 + i).padStart(2, '0')}T10:00:00.000Z`,
        }),
      )
    }
    const hint = buildSlowFactSessionHint(progressWithHistory(history))
    expect(hint).toHaveLength(2)
    // Sorted DESC by median latency — sub (6500) before add (5500).
    expect(hint[0]!.fact).toEqual(subFact)
    expect(hint[1]!.fact).toEqual(addFact)
  })
})

describe('buildSlowFactSessionHint — focus-node gating (sub-to-10 widening)', () => {
  it('includes entries with skillFocus = ["sub-to-10"] (post-widening)', () => {
    // Was: entries with focus !== 'add-to-10' rejected. Now: both
    // add-to-10 AND sub-to-10 entries flow through the aggregator,
    // each subject to its own op-specific threshold.
    const fact = { a: 9, b: 6, op: '-' as const }
    const history: SessionHistoryEntry[] = []
    for (let i = 0; i < 5; i++) {
      history.push(
        buildEntry({
          facts: [fact],
          latencies: [7000],
          successRate: 1,
          focus: 'sub-to-10',
          dateISO: `2026-05-${String(15 + i).padStart(2, '0')}T10:00:00.000Z`,
        }),
      )
    }
    const hint = buildSlowFactSessionHint(progressWithHistory(history))
    expect(hint).toHaveLength(1)
    expect(hint[0]!.fact).toEqual(fact)
  })

  it('still rejects unrelated focus nodes — add-to-20 entries do NOT contribute', () => {
    const fact = { a: 8, b: 5, op: '+' as const }
    const history: SessionHistoryEntry[] = []
    for (let i = 0; i < 10; i++) {
      history.push(
        buildEntry({
          facts: [fact],
          latencies: [7000],
          successRate: 1,
          focus: 'add-to-20',
        }),
      )
    }
    expect(buildSlowFactSessionHint(progressWithHistory(history))).toEqual([])
  })
})

// Acknowledge the unused constant import — kept so the test file's
// imports document the public API surface.
void SLOW_FACT_MIN_MEDIAN_LATENCY_MS_SUB
void SLOW_FACT_SUB_WARMUP_SESSIONS
