/**
 * "Accurate but slow" math-fact session-generation hint (M4.x —
 * follow-up to PR #164's Leitner wiring).
 *
 * The latency-capture infrastructure shipped in PR #164 + #167 records
 * per-problem first-tap latency on `SessionHistoryEntry.latencyMs`. M4.x
 * adds the consumer: a threshold-based predicate over that history
 * surfaces facts where Marian is reliably correct (ge X% over N
 * attempts) but reliably SLOW (ge T ms median latency). Those are the
 * canaries for finger-counting dependency — accelerating them is the
 * next adaptive lever after raw correctness, per Dave's research
 * deliverable § 6 P3.
 *
 * The hint emerges from a join of two parallel arrays per session:
 *   - `entry.latencyMs[i]` — first-tap latency in ms (PR #164/#167)
 *   - `entry.mathFacts[i]` — the fact that problem targeted (M4.x
 *     follow-up; an additive optional field on `SessionHistoryEntry`).
 *     Without this companion array, latency on its own can't be
 *     attributed to a specific fact — `skillFocus` only names the
 *     focus node, not the per-problem pair.
 *
 * Wire shape is deliberately verbose (attempts/correctRate/
 * medianLatencyMs alongside the fact triple) so the planner directive
 * can compose human-readable bullet copy ("4+2 — answers ~6.2s; over
 * 7 attempts, 100% correct.") without the server re-deriving stats.
 *
 * Active scope (v1)
 * -----------------
 * Math + add-to-10 only. Same gating posture as `buildLeitnerSessionHint`
 * — that's the only Leitner-bearing focus node Marian touches today and
 * the only one with enough latency data to make the threshold predicate
 * meaningful. Misrouted slow-facts on word-song / other math nodes are
 * silently ignored at the planner.
 *
 * Threshold defaults
 * ------------------
 * Tunable based on real-Marian signal once she's generated a handful of
 * sessions. The defaults below are conservative — they rule out the
 * "two attempts, both happened to be slow" false positive while still
 * surfacing real automaticity gaps once a fact has 5+ data points.
 *
 *   - SLOW_FACT_MIN_ATTEMPTS = 5
 *     Below this we don't have enough samples for a stable median.
 *   - SLOW_FACT_MIN_CORRECT_RATE = 0.8
 *     Below this the fact is a Leitner-box concern (correctness gap),
 *     not a slowness concern; the existing Leitner directive handles it.
 *   - SLOW_FACT_MIN_MEDIAN_LATENCY_MS = 5000
 *     5s is the rough cut-off for "she's still finger-counting" on
 *     add-to-10 per Dave's research § 6 P3 — sub-2s is automatic
 *     retrieval; 2-5s is mixed; 5s+ is reliably counting. Sentinel
 *     `-1` ("no measurement") is excluded from the median input.
 *   - SLOW_FACT_HINT_MAX_ITEMS = 8
 *     Keeps the planner-prompt budget bounded — 8 facts × ~25 tokens
 *     each ≈ 200 tokens of directive copy, which Haiku 4.5 budgets
 *     comfortably. Sorted median-latency-DESCENDING (most-needed first)
 *     so a future trim doesn't drop the highest-priority targets.
 *
 * Pure function — no side effects, no clock reads, no React. Mirrors
 * the helper conventions in `./leitner.ts`.
 */

import type {
  MathFact,
  Progress,
  SessionHistoryEntry,
  SkillNode,
} from './types'

/** Min total attempts on a fact before it can be flagged. */
export const SLOW_FACT_MIN_ATTEMPTS = 5
/** Min first-tap correctness rate (0..1) — below this it's a Leitner concern. */
export const SLOW_FACT_MIN_CORRECT_RATE = 0.8
/**
 * Min median latency in ms for `op === '+'` facts (add-to-10 retrieval).
 * Below this the fact is already automatic. 5s is the rough cut-off
 * per Dave's research §6 P3 — sub-2s is automatic retrieval; 2-5s is
 * mixed; 5s+ is reliably counting.
 */
export const SLOW_FACT_MIN_MEDIAN_LATENCY_MS = 5000
/**
 * Min median latency in ms for `op === '-'` facts (sub-to-10 retrieval),
 * post-warmup. Higher than the addition default because subtraction
 * retrieval runs systematically slower at the same grade — Geary 2007
 * (Dave's research §Source 6) shows higher mean RT and higher variance
 * vs addition for comparable facts at 2nd grade, because subtraction
 * lacks the rehearsal scaffolding addition gets from counting-on.
 * Applying the 5000ms addition threshold to sub-to-10 would flood the
 * slow-fact payload on early sessions (every new subtraction fact
 * looks slow), defeating the canon-first fast-path. Thomas locked the
 * shape 2026-05-15: flat 6000ms post-warmup + a 5-session warmup
 * where surfacing is suppressed (the simpler-shape alternative from
 * Kyle's spec §8 over the 3-band tenure ladder).
 */
export const SLOW_FACT_MIN_MEDIAN_LATENCY_MS_SUB = 6000
/**
 * Sub-to-10 warmup window — sessions where slow-fact surfacing is
 * suppressed entirely. Per Kyle's spec §8: "Suppress the slow-fact
 * directive entirely for the first 5 sub-to-10 sessions (treat the
 * node as 'new tier, baseline phase')". Counted as the number of
 * history entries whose `skillFocus` includes `sub-to-10`. After 5+
 * sessions on the node, the normal threshold predicate engages.
 */
export const SLOW_FACT_SUB_WARMUP_SESSIONS = 5
/** Cap on how many slow-fact entries we ship per request. */
export const SLOW_FACT_HINT_MAX_ITEMS = 8

/**
 * One fact + its accuracy / latency stats, ready for the wire. Mirrors
 * the planner's `SlowFactHintItem` shape on the server side (see
 * `MarianLearning/api/_planner.ts`). The shape is duplicated rather
 * than imported because the api/ tsconfig builds independently from
 * src/.
 */
export interface SlowFactHint {
  /** Math-fact triple — addends + operator. */
  fact: MathFact
  /** Total counted attempts (excludes `-1` sentinels). */
  attempts: number
  /** Fraction correct on counted attempts, 0..1. */
  correctRate: number
  /** Median first-tap latency in ms, computed over counted attempts only. */
  medianLatencyMs: number
}

/**
 * Build the slow-fact hint from `progress.history`. Returns an empty
 * array when no fact qualifies (greenfield Marian, every fact below
 * the attempts threshold, every fact still under the latency floor),
 * which the caller is expected to map to "OMIT the field on the wire"
 * so the canon-served free path stays active.
 *
 * Algorithm
 * ---------
 * 1. For each session entry that carries BOTH `latencyMs` AND
 *    `mathFacts` AND targets `add-to-10`, walk the per-problem pairs.
 *    Drop any pair where `latencyMs[i]` is the `-1` sentinel (the
 *    `[250, 60000]` ms band is the only valid latency input — see
 *    PR #164 fix-PR notes).
 * 2. For each fact key, compute total attempts, correct count, and
 *    the latency list. Correctness comes from joining the entry's
 *    `successRate` against the per-problem split — but
 *    `SessionHistoryEntry` doesn't persist per-problem correctness
 *    today (that lives only in `LeitnerOutcome[]` at write time, and
 *    is not round-tripped onto history). For v1 we approximate
 *    correctness via the per-session `successRate`: a fact appearing
 *    in a session counts toward `correctTotal` weighted by that
 *    session's success rate. This is conservative — real-Marian's
 *    add-to-10 success rate is high (90%+) so the approximation
 *    rarely flips a slow fact off the list. A future tightening adds
 *    `perProblemCorrect: boolean[]` to `SessionHistoryEntry`; gated
 *    on real-Marian signal.
 * 3. Apply the threshold predicate. Sort by median-latency-descending
 *    (slowest-first). Trim to the cap.
 *
 * @param progress  Live Progress doc loaded from localStorage.
 * @returns Sorted, capped slow-fact list. Empty when no fact qualifies.
 */
export function buildSlowFactSessionHint(progress: Progress): SlowFactHint[] {
  type Acc = {
    fact: MathFact
    attempts: number
    correctSum: number
    latencies: number[]
  }
  const byKey = new Map<string, Acc>()

  // sub-to-10 warmup gate (Kyle's spec §8 + Thomas's 2026-05-15 lock):
  // suppress slow-fact surfacing for the first 5 sub-to-10 sessions.
  // Counted once up-front so the per-entry loop doesn't re-derive it.
  // Counts ALL history entries whose skillFocus includes 'sub-to-10';
  // see countSessionsOnNode helper below.
  const subSessionsOnNode = countSessionsOnNode(progress.history, 'sub-to-10')
  const subSurfacingActive = subSessionsOnNode >= SLOW_FACT_SUB_WARMUP_SESSIONS

  for (const entry of progress.history) {
    if (!isMathRetrievalEntry(entry)) continue
    const facts = entry.mathFacts
    const lat = entry.latencyMs
    if (!facts || !lat) continue

    // Walk parallel arrays. Length mismatch shouldn't happen (writer
    // builds both from the same per-problem source) but guard anyway
    // — silently skip past the shorter array's end rather than
    // pretending an undefined fact is real data.
    const n = Math.min(facts.length, lat.length)
    for (let i = 0; i < n; i++) {
      const ms = lat[i]
      const fact = facts[i]
      if (ms === undefined || fact === undefined) continue
      // `-1` is the explicit "not measured" sentinel. Sub-floor /
      // above-ceiling values were folded to `-1` at write time
      // (PR #164 fix-PR), so a present-and-positive value is in
      // `[250, 60000]` ms by construction.
      if (ms < 0) continue

      const key = mathFactKey(fact)
      const existing = byKey.get(key)
      if (existing) {
        existing.attempts += 1
        existing.correctSum += entry.successRate
        existing.latencies.push(ms)
      } else {
        byKey.set(key, {
          fact: { a: fact.a, b: fact.b, op: fact.op },
          attempts: 1,
          correctSum: entry.successRate,
          latencies: [ms],
        })
      }
    }
  }

  const out: SlowFactHint[] = []
  for (const acc of byKey.values()) {
    if (acc.attempts < SLOW_FACT_MIN_ATTEMPTS) continue
    const correctRate = acc.correctSum / acc.attempts
    if (correctRate < SLOW_FACT_MIN_CORRECT_RATE) continue
    const medianLatencyMs = median(acc.latencies)
    // Op-parameterized latency threshold (Kyle's spec §8 + Thomas's
    // 2026-05-15 lock). For `op === '-'`, the warmup gate above gives
    // 5 sub-to-10 sessions of grace before any surfacing happens; once
    // engaged, the threshold sits at 6000ms (vs 5000ms for '+'). For
    // `op === '+'` the existing 5000ms threshold applies. `op === '*'`
    // is not yet wired (no multiplication tier shipped); reuse '+''s
    // threshold for forward-compat — the planner gate will reject
    // multiplication slow-facts upstream anyway.
    if (acc.fact.op === '-') {
      if (!subSurfacingActive) continue
      if (medianLatencyMs < SLOW_FACT_MIN_MEDIAN_LATENCY_MS_SUB) continue
    } else {
      if (medianLatencyMs < SLOW_FACT_MIN_MEDIAN_LATENCY_MS) continue
    }
    out.push({
      fact: acc.fact,
      attempts: acc.attempts,
      correctRate,
      medianLatencyMs,
    })
  }

  // Slowest-first — when the cap trims, we keep the highest-priority
  // automaticity targets.
  out.sort((x, y) => y.medianLatencyMs - x.medianLatencyMs)
  if (out.length > SLOW_FACT_HINT_MAX_ITEMS) {
    out.length = SLOW_FACT_HINT_MAX_ITEMS
  }
  return out
}

// --------------------------------------------------------------------------
// internals
// --------------------------------------------------------------------------

/**
 * Stable string key for a math fact in the slow-fact aggregator.
 * Mirrors `mathFactKey` in `screens/SessionEnd/progressHistory.ts` so
 * the keying agrees across modules (3+4 vs 4+3 are deliberately
 * distinct — Leitner treats them as separate facts).
 */
function mathFactKey(f: { a: number; b: number; op: string }): string {
  return `${f.a}${f.op}${f.b}`
}

/**
 * Active scope guard. Slow-fact directive fires for math retrieval
 * focus nodes — `add-to-10` (op `'+'`) and `sub-to-10` (op `'-'`) as
 * of Kyle's sub-to-10 content tier spec. An entry's `skillFocus`
 * carries the focus node the planner targeted at session-start; any
 * other node gets skipped here so we don't pollute the latency
 * aggregate with multi-tier data. Same posture as
 * `buildLeitnerSessionHint`, widened by op.
 *
 * Cross-op aggregation is safe: facts key on `{a, op, b}` so a 4+2
 * latency record never aggregates with a 6−2 latency record even
 * though both share the same operand digits.
 */
function isMathRetrievalEntry(entry: SessionHistoryEntry): boolean {
  if (entry.skillFocus.length !== 1) return false
  const focus = entry.skillFocus[0]
  return focus === 'add-to-10' || focus === 'sub-to-10'
}

/**
 * Count the number of history entries whose `skillFocus` includes a
 * specific skill node. Used by the sub-to-10 warmup gate (Kyle's spec
 * §8): the slow-fact directive is suppressed entirely for the first
 * `SLOW_FACT_SUB_WARMUP_SESSIONS` (5) sub-to-10 sessions, treating the
 * node as "new tier, baseline phase" before any retrieval-latency
 * surfacing engages.
 *
 * Implementation note: walks `history` once; matches by
 * `skillFocus.includes(node)` (not exclusive-match) so an entry with
 * multiple focus nodes counts toward each. In v1, sessions are single-
 * focus so the distinction doesn't matter; the looser predicate is
 * forward-compatible with future fact-family interleaving (Dave's
 * research §Q3 / McNeil et al. 2025) where a session might list both
 * add-to-10 and sub-to-10 in skillFocus.
 */
function countSessionsOnNode(
  history: ReadonlyArray<SessionHistoryEntry>,
  node: SkillNode,
): number {
  let n = 0
  for (const entry of history) {
    if (entry.skillFocus.includes(node)) n += 1
  }
  return n
}

/**
 * Median of a non-empty number array. Pure — does not mutate input.
 * For even-length arrays we return the mean of the two middle values
 * (the standard convention). The caller never passes an empty array
 * (the threshold predicate filters before calling), but we defensive-
 * return `-1` if it ever happens so an upstream bug surfaces as a
 * dropped entry rather than a NaN.
 */
function median(values: ReadonlyArray<number>): number {
  if (values.length === 0) return -1
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  if (sorted.length % 2 === 1) {
    return sorted[mid]!
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}
