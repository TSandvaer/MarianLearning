/**
 * The per-learner seen-record and the once-a-day Leitner promotion
 * (no-Claude plan phase 3, `design/native/no-claude-sizing.md` § 2
 * "Inputs"; Dave `design/research/no-claude-variety-2026-10-23.md`
 * § 2.1 rule 5 and § 2.2 rule 4).
 *
 * - `Progress.seenItems` keeps, per item, the last day this learner met
 *   it, how many sessions she met it in, and her last first tap. The math
 *   picker (`../session/mathPicker.ts`) ranks by it.
 * - `applyMathOutcomes` is the session end's Leitner update. A fact moves
 *   up a box at most once a calendar day, and only when it is due; a right
 *   answer on a fact that is not due keeps its box and its due date; a
 *   wrong answer still sends it to box 1. The day of the last promotion
 *   lives in the seen-record (`promoted`), so "once a day" holds even
 *   when a same-day demotion makes the fact due again.
 * - Migration: a doc written before the field (an older build, the web)
 *   has none. `seenItemsOf` then seeds it from what the doc already
 *   holds: the history's per-problem facts (day and sessions met) and the
 *   Leitner box (the day an older fact last moved). The first math
 *   session end writes it.
 *
 * Pure: no storage, no clock.
 */
import {
  findItem,
  addItem,
  demote,
  leitnerOverdueDays,
  promote,
} from './leitner'
import { localDateKey } from './clock'
import type { LeitnerBox, MathFact, Progress, SeenItems } from './types'

/** A math fact's seen-record key: `math:3+4`, `math:7-3`, `math:2*5`. */
export function mathSeenKey(f: Pick<MathFact, 'a' | 'b' | 'op'>): string {
  return `math:${f.a}${f.op}${f.b}`
}

/**
 * A word's seen-record key: `word:ham`. The `word:` prefix never starts a
 * `mathSeenKey`, so the two kinds share the map without colliding. Words
 * are written by Letter Critters (the words Emma says) and by the cvc-words
 * check (each probe word's result); the probe reserve ranks by them
 * (`wordSong/probeReserve.ts`, Dave 2026-10-24).
 */
export function wordSeenKey(word: string): string {
  return `word:${word}`
}

/** The Leitner box's key, `3+4` (as `sessionEnd/progressHistory.ts`). */
const leitnerKey = (f: MathFact): string => `${f.a}${f.op}${f.b}`

/** The local day of an ISO timestamp, or `null` when it does not parse. */
function dayOfISO(iso: string): string | null {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : localDateKey(new Date(ms))
}

/**
 * The migration: a seen-record for a doc written before the field.
 *
 * - Every history entry with per-problem facts counts once for each fact
 *   it holds; the record's day is the entry's local day (entries are
 *   oldest first, so the last one wins).
 * - A boxed fact the 30-entry history no longer shows gets the day it
 *   last moved and a count of 1. A fact never answered (`lastSeen: 0`)
 *   gets none.
 * - `correct` is `null` throughout: the history keeps no per-problem
 *   result.
 */
export function seedSeenItems(
  p: Pick<Progress, 'history' | 'mathFactsLeitner'>,
): SeenItems {
  const out: SeenItems = {}
  for (const entry of p.history) {
    if (entry.mathFacts === undefined) continue
    const day = dayOfISO(entry.dateISO)
    if (day === null) continue
    const keys = new Set(entry.mathFacts.map(mathSeenKey))
    for (const key of keys) {
      out[key] = { day, count: (out[key]?.count ?? 0) + 1, correct: null }
    }
  }
  for (const entry of p.mathFactsLeitner.items) {
    const key = mathSeenKey(entry.item)
    if (out[key] !== undefined || entry.lastSeen <= 0) continue
    out[key] = {
      day: localDateKey(new Date(entry.lastSeen)),
      count: 1,
      correct: null,
    }
  }
  return out
}

/** The doc's seen-record, or (a doc written before it) the seed. */
export function seenItemsOf(
  p: Pick<Progress, 'history' | 'mathFactsLeitner' | 'seenItems'>,
): SeenItems {
  return p.seenItems ?? seedSeenItems(p)
}

/** One problem's result at the session end (`LeitnerOutcome`). */
export interface MathOutcome {
  fact: MathFact
  /** First tap: right, wrong, or `undefined` (not measured). */
  correct: boolean | undefined
}

/**
 * The session end's Leitner update and seen-record write, outcome by
 * outcome:
 *
 * - every fact is in the box afterwards (`addItem`: a new fact at box 1,
 *   never answered, so due);
 * - right: promote when the fact is due and has not moved up today;
 *   otherwise nothing changes, `lastSeen` included;
 * - wrong: box 1 (`demote`);
 * - not measured: no box change and no seen-record (she may not have
 *   reached it).
 *
 * `now` is the session end (the progress clock); "today" is its local day.
 * Pure: returns a new box and record, never mutates its inputs.
 */
export function applyMathOutcomes(
  box: LeitnerBox<MathFact>,
  seen: SeenItems,
  outcomes: ReadonlyArray<MathOutcome>,
  now: number,
): { box: LeitnerBox<MathFact>; seen: SeenItems } {
  const today = localDateKey(new Date(now))
  let nextBox = box
  const nextSeen: SeenItems = { ...seen }
  for (const { fact, correct } of outcomes) {
    nextBox = addItem(nextBox, leitnerKey, fact)
    if (correct === undefined) continue
    const key = mathSeenKey(fact)
    const before = nextSeen[key]
    let promoted = before?.promoted
    if (correct) {
      const entry = findItem(nextBox, leitnerKey, fact)!
      if (leitnerOverdueDays(entry, now) >= 0 && promoted !== today) {
        nextBox = promote(nextBox, leitnerKey, fact, now)
        promoted = today
      }
    } else {
      nextBox = demote(nextBox, leitnerKey, fact, now)
    }
    nextSeen[key] = {
      day: today,
      count: (before?.count ?? 0) + 1,
      correct,
      ...(promoted !== undefined ? { promoted } : {}),
    }
  }
  return { box: nextBox, seen: nextSeen }
}

/**
 * Words she met where nothing is scored (Letter Critters: the words Emma
 * says): each record's day is today and its count goes up once per call,
 * however often the word repeats in it. Its first-tap result and check
 * result stay as they were. Pure: returns a new record.
 */
export function recordWordsMet(
  seen: SeenItems,
  words: readonly string[],
  now: number,
): SeenItems {
  const today = localDateKey(new Date(now))
  const next: SeenItems = { ...seen }
  for (const word of new Set(words)) {
    const key = wordSeenKey(word)
    const before = next[key]
    next[key] = {
      ...before,
      day: today,
      count: (before?.count ?? 0) + 1,
      correct: before?.correct ?? null,
    }
  }
  return next
}

/** One probe word's first tap in a cvc-words check. */
export interface ProbeResult {
  word: string
  correct: boolean
}

/**
 * A check's probe words: each record gets today, a count, the first tap,
 * and its most recent check result, `check` `'right'` or `'missed'` with
 * `checkDay` today. The probe reserve ranks by them (Dave 2026-10-24,
 * `wordSong/probeReserve.ts` `chooseCheckWords`: a missed word comes last,
 * the oldest miss first). Pure: returns a new record.
 */
export function recordProbeResults(
  seen: SeenItems,
  results: ReadonlyArray<ProbeResult>,
  now: number,
): SeenItems {
  const next = recordWordsMet(
    seen,
    results.map((r) => r.word),
    now,
  )
  for (const { word, correct } of results) {
    const key = wordSeenKey(word)
    const record = next[key]!
    next[key] = {
      ...record,
      correct,
      check: correct ? 'right' : 'missed',
      checkDay: record.day,
    }
  }
  return next
}

/**
 * `p` with `words` met (`recordWordsMet`), starting from its seen-record or,
 * for a doc written before the field, its seed, so the first word never
 * drops the math history (`seenItemsOf`). `p` itself when `words` is empty.
 */
export function withWordsMet(
  p: Progress,
  words: readonly string[],
  now: number,
): Progress {
  if (words.length === 0) return p
  return { ...p, seenItems: recordWordsMet(seenItemsOf(p), words, now) }
}
