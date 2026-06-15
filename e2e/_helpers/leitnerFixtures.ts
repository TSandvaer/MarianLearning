/**
 * Leitner-fixture builders for e2e specs.
 *
 * Ticket follow-up to PR #164 (M4 Leitner session-gen wiring). These
 * helpers compose `mathFactsLeitner` blobs that the seeder ships into
 * `marian-tutor:progress:v1` so the App's `readProgressHintsForTrack('math')`
 * flattens them via `buildLeitnerSessionHint` and ships them on the
 * `/api/claude` payload's `progress.leitner` block.
 *
 * Why a dedicated builder
 * -----------------------
 * `buildSeedProgress()` in `seedStorage.ts` always emits
 * `mathFactsLeitner: { items: [] }` — empty box, no Leitner directive
 * fires. Multiple Leitner specs need to seed varied box-state shapes
 * (mixed boxes, single box-1, all box-5, etc.); this module is where
 * the canonical fixture shapes live.
 *
 * Wire-shape source of truth
 * --------------------------
 * `LeitnerItem` and `LeitnerBox` from `src/lib/progress/types.ts`. The
 * App reads via `buildLeitnerSessionHint(progress.mathFactsLeitner)`
 * (in `src/lib/progress/leitner.ts`) which flattens the box and sorts
 * box-ascending. The hint reaches the planner request body as
 * `payload.progress.leitner: { a, b, op, box }[]`.
 */

export type LeitnerOp = '+' | '-' | '*'
export type LeitnerBoxIndex = 1 | 2 | 3 | 4 | 5

export interface LeitnerFactSpec {
  a: number
  b: number
  op: LeitnerOp
  box: LeitnerBoxIndex
  /** Optional `lastSeen` ms-since-epoch. Defaults to 0 ("never shown"). */
  lastSeen?: number
}

/**
 * Build a `mathFactsLeitner` blob (the persisted shape) from a flat
 * list of fact specs. Mirrors what `addItem` + `promote` / `demote`
 * would produce after a stream of session-ends.
 */
export function buildMathFactsLeitner(facts: ReadonlyArray<LeitnerFactSpec>): {
  items: Array<{
    item: { a: number; b: number; op: LeitnerOp }
    box: LeitnerBoxIndex
    lastSeen: number
  }>
} {
  return {
    items: facts.map((f) => ({
      item: { a: f.a, b: f.b, op: f.op },
      box: f.box,
      lastSeen: f.lastSeen ?? 0,
    })),
  }
}

/**
 * Marian's plausible mid-flight `add-to-10` Leitner state — a mix of
 * box-1 (least familiar / due for review) facts and a couple of
 * higher-box facts so the flatten-and-sort path is exercised non-
 * trivially. All facts are valid `add-to-10` pairs (a + b ≤ 10, both
 * addends 1-9) so the planner accepts them.
 *
 * Box-ascending after flatten:
 *   - Box 1: 3+4, 5+2, 6+3, 4+5  (4 box-1 facts)
 *   - Box 2: 2+2
 *   - Box 3: 1+1, 2+1
 *   - Box 5: 5+5
 *
 * The four box-1 facts ensure the planner directive's "lean into Box-1
 * facts on problems 4-8" rule has enough material to satisfy the
 * "at least 2 of these 5 problems must use a fact from the Box-1 list"
 * constraint without exhausting the pool.
 */
export const MIXED_BOX_FIXTURE: ReadonlyArray<LeitnerFactSpec> = [
  { a: 3, b: 4, op: '+', box: 1 },
  { a: 5, b: 2, op: '+', box: 1 },
  { a: 6, b: 3, op: '+', box: 1 },
  { a: 4, b: 5, op: '+', box: 1 },
  { a: 2, b: 2, op: '+', box: 2 },
  { a: 1, b: 1, op: '+', box: 3 },
  { a: 2, b: 1, op: '+', box: 3 },
  { a: 5, b: 5, op: '+', box: 5 },
]

/**
 * "Marian knows everything" — every fact is mastered (box 5). The
 * planner directive should still fire (any non-empty box triggers
 * the directive) but no fact lands on the Box-1 forbidden list. The
 * critical assertion this enables: the wire field is non-empty AND
 * box-1 facts in the directive list are zero — the priority-list
 * phrasing remains coherent on a fully-mastered learner.
 */
export const ALL_MASTERED_FIXTURE: ReadonlyArray<LeitnerFactSpec> = [
  { a: 1, b: 1, op: '+', box: 5 },
  { a: 2, b: 1, op: '+', box: 5 },
  { a: 3, b: 2, op: '+', box: 5 },
  { a: 4, b: 3, op: '+', box: 5 },
]

/**
 * Spaced-review fixture (ticket 86c9kmwf8). Two box-3 facts at different
 * recencies, used to assert the App applies `dueLeitnerItems` BEFORE
 * `buildLeitnerSessionHint`:
 *
 *   - `7+2` was last seen RECENTLY (well inside the box-3 3-day interval)
 *     → NOT due → must be ABSENT from the wire.
 *   - `6+3` was last seen STALE (far past the box-3 interval) → due →
 *     must be PRESENT on the wire.
 *
 * `lastSeen` is expressed as a "days ago" offset resolved against
 * `Date.now()` at seed-build time by `buildSpacedReviewLeitner` so the
 * fixture stays valid regardless of when the test runs.
 */
export const SPACED_REVIEW_RECENT_FACT: {
  a: number
  b: number
  op: LeitnerOp
} = { a: 7, b: 2, op: '+' }
export const SPACED_REVIEW_STALE_FACT: { a: number; b: number; op: LeitnerOp } =
  { a: 6, b: 3, op: '+' }

/**
 * Build a `mathFactsLeitner` blob with one recently-seen box-3 fact
 * (not due) and one stale box-3 fact (due). Resolves the relative
 * recencies against the supplied `now` so the not-due / due split is
 * deterministic at the test's wall-clock.
 */
export function buildSpacedReviewLeitner(
  now: number,
): ReturnType<typeof buildMathFactsLeitner> {
  const MS_PER_DAY = 86_400_000
  return buildMathFactsLeitner([
    // box-3 interval is 3 days; seen 1 day ago → NOT due.
    { ...SPACED_REVIEW_RECENT_FACT, box: 3, lastSeen: now - 1 * MS_PER_DAY },
    // box-3 interval is 3 days; seen 10 days ago → due.
    { ...SPACED_REVIEW_STALE_FACT, box: 3, lastSeen: now - 10 * MS_PER_DAY },
  ])
}

/**
 * Per-session due-fact cap mirrored from `LEITNER_DUE_PER_SESSION_CAP`
 * in `src/lib/progress/leitner.ts`. The production `buildLeitnerSessionHint`
 * truncates the box-ascending-sorted hint to this many facts AFTER the sort,
 * so only the lowest-box (most-fragile) facts survive. This module mirrors
 * the constant rather than importing it because the e2e tsconfig builds
 * independently from src/ — keep the two in sync (Thomas-approved tuning,
 * #452 / Dave's research #450 §6).
 */
export const EXPECTED_DUE_PER_SESSION_CAP = 3

/**
 * The fact strings the wire ships for a given fixture, in box-ascending
 * order, AFTER the per-session due-fact cap. Tests assert this list against
 * the captured request body so a future bug that swaps operands (3+4 vs 4+3
 * — different fact), drops the operator, or mis-caps the due subset surfaces
 * as a shape-exact assertion failure.
 *
 * The cap is applied AFTER the stable box-ascending sort — exactly matching
 * `buildLeitnerSessionHint`. With more than `EXPECTED_DUE_PER_SESSION_CAP`
 * facts in the fixture, the lowest-box facts (insertion-order-preserved
 * within a box level) are the ones that ship.
 */
export function expectedWireFacts(
  fixture: ReadonlyArray<LeitnerFactSpec>,
  cap: number = EXPECTED_DUE_PER_SESSION_CAP,
): Array<{ a: number; b: number; op: LeitnerOp; box: LeitnerBoxIndex }> {
  // Stable sort by box ascending; preserves insertion order within a
  // box level — same contract as `buildLeitnerSessionHint` documents.
  const out = fixture.map((f) => ({
    a: f.a,
    b: f.b,
    op: f.op,
    box: f.box,
  }))
  out.sort((x, y) => x.box - y.box)
  // Truncate from the tail so the lowest-box facts survive — mirrors the
  // per-session cap in `buildLeitnerSessionHint`.
  if (out.length > cap) {
    out.length = cap
  }
  return out
}
