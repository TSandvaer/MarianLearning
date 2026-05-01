/**
 * Adapt a server-generated `PlannerPlan` (flat) into a
 * `WordSongSessionPlan` (nested). Sibling of `screens/Math/planFromServer.ts`
 * — same parsing strategy, different domain.
 *
 * Why this lives here
 * -------------------
 * Ticket 86c9jteud — see the Math planFromServer header for the full
 * rationale. tl;dr: the track-based switchover makes the server the
 * source of truth for which target words appear in a session, and we
 * need to reverse-engineer the per-problem `target: WordEntry` from the
 * `read` text so `WordSong.tsx` can render its picture chips.
 *
 * Parsing strategy
 * ----------------
 * The Haiku prompt (api/_planner.ts:WORD_SONG_TRACK_GUIDE) constrains the
 * `read` line to "Tap the <word>." Extract the word; look it up in the
 * client-side `wordPack`. If the word isn't a known target — either the
 * model drifted, or the wordPack drifted out of sync with the server's
 * embedded list — throw `PlanFromServerError`. Caller falls back to
 * silent mode + a static plan.
 *
 * Out-of-namespace ids (skip-not-throw)
 * -------------------------------------
 * The server response can carry utterances whose ids fall outside the
 * `word.p<N>.<slot>` template — e.g. the `session.end.*` family added in
 * 86c9kj2u6. Those are loaded into the singleton howl-map for cross-screen
 * consumption (SessionEnd reads them via `playSessionUtterance`) but they
 * don't belong in the nested per-problem plan this parser produces. The
 * loop below SKIPS such ids rather than throwing, so additive emissions
 * upstream don't cascade into a silent-fallback regression for WordSong.
 * Malformed-but-namespaced ids (e.g. `word.p1.bogus`) are also skipped
 * here, but the per-problem completeness check downstream still catches
 * them — the bucket for problem 1 will be missing a slot and we throw
 * the clearer `missing slot "<slot>"` error.
 *
 * Pure module: no React, no I/O, no side effects.
 */

import {
  type WordSongProblem,
  type WordSongProblemUtterances,
  type WordSongSessionPlan,
  type WordSongUtteranceSlot,
} from './wordSessionPlans'
import { TARGET_WORDS, getWordEntry, type WordEntry } from './wordPack'

const ALL_SLOTS: readonly WordSongUtteranceSlot[] = [
  'read',
  'correct',
  'reprompt',
  'hint',
  'giveAnswer',
]

/** The 14 target words for level 1, lower-cased keyed for fast membership
 *  test. Mirrors `api/_plannerWordList.ts` and the `isTarget: true` rows
 *  in `wordPack.ts`. We cross-check against this set rather than against
 *  `getWordEntry` alone so distractor-only entries (bus, sun, etc.) can't
 *  slip through if the model misreads the prompt. */
const TARGET_WORD_SET: ReadonlySet<string> = new Set(
  TARGET_WORDS.map((w) => w.word),
)

/** Flat plan shape returned by /api/claude — mirrors `PlannerPlan` in
 *  api/_planner.ts. Re-declared here for the same reason as Math's
 *  planFromServer (no cross-module coupling to api/). */
export interface ServerPlan {
  id: string
  label: string
  utterances: ReadonlyArray<{ id: string; text: string }>
}

export class PlanFromServerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlanFromServerError'
  }
}

/**
 * Build a `WordSongSessionPlan` from a server-returned plan blob.
 *
 * @throws {PlanFromServerError} if the blob isn't shaped right or any
 *   `read` text fails to parse / yields a non-target word.
 */
export function wordSongSessionPlanFromServer(
  serverPlan: unknown,
): WordSongSessionPlan {
  if (!isServerPlan(serverPlan)) {
    throw new PlanFromServerError(
      'server plan did not match { id, label, utterances:[{id,text}] }',
    )
  }

  // Out-of-namespace ids (e.g. session.end.*) are skipped — see file
  // header. The per-problem completeness check below still catches any
  // genuine gaps in the word.p<N>.<slot> coverage.
  const byProblem = new Map<number, Partial<WordSongProblemUtterances>>()
  for (const u of serverPlan.utterances) {
    const parsedId = parseUtteranceId(u.id)
    if (parsedId === null) continue
    const { index, slot } = parsedId
    let bucket = byProblem.get(index)
    if (!bucket) {
      bucket = {}
      byProblem.set(index, bucket)
    }
    bucket[slot] = u.text
  }

  const problems: WordSongProblem[] = []
  for (let index = 1; index <= 8; index++) {
    const bucket = byProblem.get(index)
    if (!bucket) {
      throw new PlanFromServerError(
        `server plan missing problem index ${index}`,
      )
    }
    for (const slot of ALL_SLOTS) {
      if (typeof bucket[slot] !== 'string') {
        throw new PlanFromServerError(
          `server plan problem ${index} missing slot "${slot}"`,
        )
      }
    }
    const utterances = bucket as WordSongProblemUtterances
    const target = parseReadTarget(utterances.read)
    problems.push({
      index,
      target,
      utterances,
    })
  }

  return {
    id: serverPlan.id,
    label: serverPlan.label,
    problems,
  }
}

/** Extract the `WordEntry` from a `read` line shaped like "Tap the cat." */
export function parseReadTarget(read: string): WordEntry {
  const match = read.match(/^\s*tap\s+the\s+([a-z]+)\s*\.\s*$/i)
  if (!match) {
    throw new PlanFromServerError(
      `word-song read line "${read}" did not match "Tap the <word>." template`,
    )
  }
  const word = match[1]!.toLowerCase()
  if (!TARGET_WORD_SET.has(word)) {
    throw new PlanFromServerError(
      `word-song read line "${read}" yielded non-target word "${word}"`,
    )
  }
  // getWordEntry throws if the word is missing entirely; we've already
  // membership-checked against the target set, so this should always
  // resolve. Defensive `try` keeps the error class stable in case the
  // wordPack drifts.
  try {
    return getWordEntry(word)
  } catch (err) {
    throw new PlanFromServerError(
      `word-song wordPack lookup failed for "${word}": ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/** Parse a `word.p<N>.<slot>` utterance id. */
function parseUtteranceId(
  id: string,
): { index: number; slot: WordSongUtteranceSlot } | null {
  const match = id.match(
    /^word\.p(\d+)\.(read|correct|reprompt|hint|giveAnswer)$/,
  )
  if (!match) return null
  const index = Number.parseInt(match[1]!, 10)
  if (!Number.isInteger(index) || index < 1) return null
  return { index, slot: match[2] as WordSongUtteranceSlot }
}

function isServerPlan(value: unknown): value is ServerPlan {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.label !== 'string') return false
  if (!Array.isArray(v.utterances)) return false
  for (const u of v.utterances) {
    if (typeof u !== 'object' || u === null) return false
    const r = u as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.text !== 'string') return false
  }
  return true
}
