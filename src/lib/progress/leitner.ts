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
 * Flatten a `LeitnerBox<MathFact>` into the wire-shape hint, sorted
 * box-ascending (least familiar first). Empty box returns an empty
 * array — the caller is expected to OMIT the field on the wire entirely
 * when length is 0 so the canon-served path stays free of charge.
 *
 * `Array.prototype.sort` is stable in every JS engine we target
 * (ES2019+), so within a box level the input order is preserved —
 * keeps the round-trip deterministic for tests.
 */
export function buildLeitnerSessionHint(
  box: LeitnerBox<{ a: number; b: number; op: '+' | '-' | '*' }>,
): LeitnerSessionHintItem[] {
  const out: LeitnerSessionHintItem[] = box.items.map((entry) => ({
    a: entry.item.a,
    b: entry.item.b,
    op: entry.item.op,
    box: entry.box,
  }))
  out.sort((x, y) => x.box - y.box)
  if (out.length > LEITNER_HINT_MAX_ITEMS) {
    out.length = LEITNER_HINT_MAX_ITEMS
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
