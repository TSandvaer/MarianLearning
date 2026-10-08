/**
 * Leitner box helpers.
 *
 * Five boxes. A correct answer promotes an item one box (cap at 5).
 * A wrong answer demotes it back to box 1 — Leitner's classical rule.
 *
 * Pure functions: every helper returns a new box, never mutates input.
 * Keeps the reducer testable and avoids surprises from React strict-mode
 * double invocations.
 */

import type { LeitnerBox, LeitnerBoxIndex, LeitnerItem } from './types'

/** Max box index. Mirrors the type union bound. */
const MAX_BOX = 5 as const

/**
 * Find an item by deep-equality of payload via a caller-supplied key fn.
 * We don't assume `T` is referentially stable across sessions.
 */
export function findItem<T>(
  box: LeitnerBox<T>,
  key: (item: T) => string,
  target: T,
): LeitnerItem<T> | undefined {
  const targetKey = key(target)
  return box.items.find((entry) => key(entry.item) === targetKey)
}

/**
 * Insert a new item at box 1 if it isn't already present (by key).
 * Idempotent — safe to call on every session start.
 */
export function addItem<T>(
  box: LeitnerBox<T>,
  key: (item: T) => string,
  item: T,
): LeitnerBox<T> {
  if (findItem(box, key, item)) return box
  const next: LeitnerItem<T> = { item, box: 1, lastSeen: 0 }
  return { items: [...box.items, next] }
}

/**
 * Promote an item one box. No-op if the item isn't in the box yet.
 * Updates `lastSeen` to `now`.
 */
export function promote<T>(
  box: LeitnerBox<T>,
  key: (item: T) => string,
  target: T,
  now: number,
): LeitnerBox<T> {
  return mapMatching(box, key, target, (entry) => ({
    ...entry,
    box: clampBox(entry.box + 1),
    lastSeen: now,
  }))
}

/**
 * Demote an item back to box 1. No-op if missing.
 * Updates `lastSeen` to `now`.
 */
export function demote<T>(
  box: LeitnerBox<T>,
  key: (item: T) => string,
  target: T,
  now: number,
): LeitnerBox<T> {
  return mapMatching(box, key, target, (entry) => ({
    ...entry,
    box: 1,
    lastSeen: now,
  }))
}

/** Empty Leitner box constant for fresh profiles. */
export function emptyLeitner<T>(): LeitnerBox<T> {
  return { items: [] }
}

// --------------------------------------------------------------------------
// Spaced-review schedule (ticket 86c9kmwf8 — M4 residual delta).
//
// PR #164 (86c9pwgc8) wired the Leitner box into session generation, but
// every box fact shipped into EVERY math session regardless of recency —
// "weighted review," not "spaced review." This adds the time dimension:
// a fact is only DUE for review once its box-derived interval has elapsed
// since it was last seen.
//
// Box → interval (calendar days):
//   box 1 → 0   (always due — least familiar, review every session)
//   box 2 → 1
//   box 3 → 3
//   box 4 → 7
//   box 5 → 14  (most familiar — long review cadence)
//
// PR #447 shipped a "starting guess" schedule (0, 2, 4, 7, 14). This is the
// tuning pass (ticket 86c9kmwf8 follow-up) backed by Dave's research
// `design/research/leitner-interval-tuning-marian.md` (#450, Thomas-approved):
//   - box2 2→1: the first post-acquisition review is most effective after ONE
//     night of sleep. Children (ages 7-12) consolidate declarative memory far
//     more efficiently overnight than adults (Backhaus et al. 2020,
//     PMC7305149: F1,60 = 18.45, p = 0.00003 children vs. adults in the sleep
//     condition). A 2-day gap lets the critical 24-h consolidation window
//     pass; 1 day aligns the review with the post-consolidation retrieval
//     event that most efficiently strengthens the trace.
//   - box3 4→3: small tightening toward Cepeda et al. 2008's ~20%
//     gap-to-retention-interval ratio for a ~2-week review horizon.
//   - box1 / box4 / box5 hold (research says they are correct as-is).
// --------------------------------------------------------------------------

/** Milliseconds in one calendar day. */
const MS_PER_DAY = 86_400_000

/**
 * Per-box review interval in calendar days, keyed by box index. Box 1 is
 * `0` so freshly-added (and freshly-demoted) facts — which carry
 * `lastSeen` near `now` or `0` — are immediately due. Higher boxes back
 * off geometrically-ish toward a 14-day long-review cadence.
 *
 * Named + exported so the spaced-review schedule is tunable in one place
 * (ticket OOS: schedule values are a starting guess, tune later).
 */
export const LEITNER_REVIEW_INTERVAL_DAYS: Readonly<
  Record<LeitnerBoxIndex, number>
> = {
  1: 0,
  2: 1,
  3: 3,
  4: 7,
  5: 14,
}

/**
 * Filter a Leitner box down to the items that are DUE for review at
 * `now`. An item is due when the time elapsed since `lastSeen` is at
 * least its box's review interval. Box-1 items (interval 0) are always
 * due; a freshly-promoted box-2 item is NOT due again until 1 day passes.
 *
 * Pure: returns a new box; never mutates input. Item order is preserved,
 * so a downstream `buildLeitnerSessionHint` still sorts box-ascending
 * deterministically.
 *
 * `schedule` defaults to `LEITNER_REVIEW_INTERVAL_DAYS`; the parameter
 * exists so tests can pin custom intervals without depending on the
 * production constant.
 */
export function dueLeitnerItems<T>(
  box: LeitnerBox<T>,
  now: number,
  schedule: Readonly<
    Record<LeitnerBoxIndex, number>
  > = LEITNER_REVIEW_INTERVAL_DAYS,
): LeitnerBox<T> {
  const items = box.items.filter((entry) => {
    const intervalMs = schedule[entry.box] * MS_PER_DAY
    return now - entry.lastSeen >= intervalMs
  })
  return { items }
}

// --------------------------------------------------------------------------
// Session-generation hint (ticket 86c9pwgc8 — M4 Leitner wiring).
//
// The shape below is what App.tsx ships in its `/api/claude` payload's
// `progress.leitner` block so the planner can weight box-1 (least
// familiar) facts toward problems 4-8 in an 8-problem session, leaving
// the gentle-ramp problems 1-3 unaffected (per Dave's research
// deliverable `MarianLearning/design/research/add-to-10-counting-to-recall.md`).
//
// Wire shape is deliberately compact (`{ a, b, op, box }`) — Haiku
// already knows the focus-node-specific fact pool from the prompt; the
// hint just names the priority subset by box.
// --------------------------------------------------------------------------

/**
 * One fact + its current box, ready for the wire. Mirrors the planner's
 * `LeitnerHintItem` shape on the server side (see
 * `MarianLearning/api/_planner.ts`). The shape is duplicated rather
 * than imported because the api/ tsconfig builds independently from
 * src/.
 */
export interface LeitnerSessionHintItem {
  a: number
  b: number
  op: '+' | '-' | '*'
  box: 1 | 2 | 3 | 4 | 5
}

/**
 * Cap on how many facts we ship per request. The add-to-10 universe is
 * 36 unordered pairs (`a + b` with `a, b ∈ [1, 9]` and `a + b ≤ 10`),
 * which all comfortably fit. The cap exists as a forward-compatibility
 * brake for the day a richer fact universe (e.g. `mult-6-9`) lands and
 * the box could grow much larger. 60 is well above any single-tier
 * universe size we expect this year and well below the request-body
 * soft ceiling.
 */
export const LEITNER_HINT_MAX_ITEMS = 60

/**
 * Per-session cap on how many DUE review facts actually reach the planner.
 *
 * `LEITNER_HINT_MAX_ITEMS` (60) is a forward-compat brake on request-body
 * size; this is the much tighter pedagogical cap. On non-daily attendance a
 * few skipped days let the due set balloon — a box-2 item (now 1-day
 * interval) and several box-3 items (3-day interval) all age past their
 * windows at once and would otherwise flood an 8-problem session, crowding
 * out new focus-node content. Dave's research
 * `design/research/leitner-interval-tuning-marian.md` (#450) §6 calls for
 * capping overdue Leitner items "per session (suggestion: 2-3 maximum)
 * regardless of how many have elapsed"; we take the top of that range, 3.
 *
 * The cap is applied AFTER the box-ascending sort, so the 3 facts that ship
 * are always the lowest-box (most-fragile) ones — the items that most need
 * re-exposure. The outer 60-item brake still bounds the array first; in
 * practice 3 < 60 always wins, but the two caps are independent so a future
 * tuning pass can raise one without disturbing the other.
 */
export const LEITNER_DUE_PER_SESSION_CAP = 3

/**
 * Flatten a `LeitnerBox<MathFact>` into the wire-shape hint, sorted
 * box-ascending (least familiar first). Empty box returns an empty
 * array — the caller is expected to OMIT the field on the wire entirely
 * when length is 0 so the canon-served path stays free of charge.
 *
 * Two caps apply, both AFTER the sort so the survivors are the
 * lowest-box (most-fragile) facts:
 *   1. `LEITNER_HINT_MAX_ITEMS` (60) — the outer request-body brake.
 *   2. `perSessionCap` (default `LEITNER_DUE_PER_SESSION_CAP` = 3) — the
 *      tight pedagogical cap so a backlog of overdue facts can't flood the
 *      session. Exposed as a parameter so a future tuning pass (or a test
 *      asserting the outer brake) can override it without an App.tsx change.
 *
 * `Array.prototype.sort` is stable in every JS engine we target
 * (ES2019+), so within a box level the input order is preserved —
 * keeps the round-trip deterministic for tests.
 */
export function buildLeitnerSessionHint(
  box: LeitnerBox<{ a: number; b: number; op: '+' | '-' | '*' }>,
  perSessionCap: number = LEITNER_DUE_PER_SESSION_CAP,
): LeitnerSessionHintItem[] {
  const out: LeitnerSessionHintItem[] = box.items.map((entry) => ({
    a: entry.item.a,
    b: entry.item.b,
    op: entry.item.op,
    box: entry.box,
  }))
  out.sort((x, y) => x.box - y.box)
  // Outer request-body brake first, then the tight per-session cap. Both
  // truncate from the tail, so the lowest-box facts survive either way.
  const limit = Math.min(LEITNER_HINT_MAX_ITEMS, perSessionCap)
  if (out.length > limit) {
    out.length = limit
  }
  return out
}

// --------------------------------------------------------------------------
// internals
// --------------------------------------------------------------------------

function clampBox(n: number): LeitnerBoxIndex {
  if (n < 1) return 1
  if (n > MAX_BOX) return MAX_BOX
  return n as LeitnerBoxIndex
}

function mapMatching<T>(
  box: LeitnerBox<T>,
  key: (item: T) => string,
  target: T,
  fn: (entry: LeitnerItem<T>) => LeitnerItem<T>,
): LeitnerBox<T> {
  const targetKey = key(target)
  let matched = false
  const items = box.items.map((entry) => {
    if (matched) return entry
    if (key(entry.item) !== targetKey) return entry
    matched = true
    return fn(entry)
  })
  return matched ? { items } : box
}
