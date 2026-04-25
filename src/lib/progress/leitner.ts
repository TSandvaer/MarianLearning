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
