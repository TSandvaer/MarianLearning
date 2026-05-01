/**
 * Adapt a server-generated `PlannerPlan` (flat `{ id, label, utterances:
 * [{id, text}] }`) into a `MathSessionPlan` (nested per-problem shape that
 * `Math.tsx` reads).
 *
 * Why this lives here
 * -------------------
 * Ticket 86c9jteud — browser switchover from the legacy plan-attached
 * payload (browser ships the plan, server only renders TTS) to the
 * track-based payload (browser ships `{track, level, childName}`, server
 * generates the plan via Haiku). Once the switch is on, the server is the
 * source of truth for what problems Marian sees AND for the spoken text.
 * Math.tsx still needs the nested shape (per-problem `addendA`, `addendB`,
 * `correct`, `utterances.{slot}`) to render the addends visually and to
 * pass slot text into `playUtterance(text)`.
 *
 * Parsing strategy
 * ----------------
 * The Haiku prompt (api/_planner.ts:MATH_TRACK_GUIDE) constrains the
 * `read` line to the template "<addend-A> plus <addend-B>. How many?"
 * where each addend is a number word in 1..10. We extract the addends by
 * regex against the `read` text; the answer is `addendA + addendB`. If
 * the model drifts off the template, we throw — caller (App.tsx) catches
 * and falls back to silent mode + a static plan. Better than rendering
 * mismatched visuals.
 *
 * We do NOT trust the model's per-utterance text content beyond the
 * `read` parsing — the text strings flow through to captions verbatim,
 * but we don't try to validate "yes! five!" against `addendA + addendB`.
 * The audio is rendered from those texts; mismatch between caption and
 * computed `correct` is a soft issue (Marian sees the picked sum on
 * screen and hears Emma's voice — both come from the model). The hard
 * invariant is structural: 8 problems × 5 slots, every utterance id
 * matches the `math.p<N>.<slot>` template.
 *
 * Out-of-namespace ids (skip-not-throw)
 * -------------------------------------
 * The server response can carry utterances whose ids fall outside the
 * `math.p<N>.<slot>` template — e.g. the `session.end.*` family added in
 * 86c9kj2u6. Those are loaded into the singleton howl-map for cross-screen
 * consumption (SessionEnd reads them via `playSessionUtterance`) but they
 * don't belong in the nested per-problem plan this parser produces. The
 * loop below SKIPS such ids rather than throwing, so additive emissions
 * upstream don't cascade into a silent-fallback regression for Math.
 * Malformed-but-namespaced ids (e.g. `math.p1.bogus`) are also skipped
 * here, but the per-problem completeness check downstream still catches
 * them — the bucket for problem 1 will be missing a slot and we throw
 * the clearer `missing slot "<slot>"` error.
 *
 * Pure module: no React, no I/O, no side effects. All inputs validated;
 * throws `PlanFromServerError` on any structural issue so the caller's
 * fallback path fires cleanly.
 */

import {
  type MathProblem,
  type MathProblemUtterances,
  type MathSessionPlan,
  type MathUtteranceSlot,
} from './sessionPlans'

const ALL_SLOTS: readonly MathUtteranceSlot[] = [
  'read',
  'correct',
  'reprompt',
  'hint',
  'giveAnswer',
]

/** Words that can appear as an addend in the `read` template. The Haiku
 *  prompt restricts addends to 1..9 with sums in 3..10; we accept ten as
 *  defense in depth in case the prompt drifts. */
const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

/** Flat plan shape returned by /api/claude — mirrors `PlannerPlan` in
 *  api/_planner.ts. Re-declared here so the screen module doesn't reach
 *  into `api/_planner.ts` (server-only). */
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
 * Build a `MathSessionPlan` from a server-returned plan blob.
 *
 * @throws {PlanFromServerError} if the blob isn't shaped right or any
 *   `read` text fails to parse against the template.
 */
export function mathSessionPlanFromServer(
  serverPlan: unknown,
): MathSessionPlan {
  if (!isServerPlan(serverPlan)) {
    throw new PlanFromServerError(
      'server plan did not match { id, label, utterances:[{id,text}] }',
    )
  }

  // Group utterances by problem index, indexed by slot. Out-of-namespace
  // ids (e.g. session.end.*) are skipped — they are loaded into the
  // singleton howl-map separately and don't belong in the nested
  // per-problem plan. See the file header for the full contract.
  const byProblem = new Map<number, Partial<MathProblemUtterances>>()
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

  // Build problems 1..8 in order. Throw if any problem or slot is missing.
  const problems: MathProblem[] = []
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
    const utterances = bucket as MathProblemUtterances
    const { addendA, addendB } = parseReadAddends(utterances.read)
    problems.push({
      index,
      addendA,
      addendB,
      correct: addendA + addendB,
      utterances,
    })
  }

  return {
    id: serverPlan.id,
    label: serverPlan.label,
    problems,
  }
}

/** Extract `{addendA, addendB}` from a `read` line shaped like
 *  "Okay, three plus two. How many?" — case-insensitive on the leading word.
 *  Throws on any drift.
 *
 *  Carrier prefix (ticket 86c9kj2um)
 *  ---------------------------------
 *  Azure neural TTS realises a sentence-leading "four" / "two" as the
 *  homophones "for" / "to" with declarative falling intonation. The planner
 *  fix is to prepend a carrier word ("Okay, ") to every read line so the
 *  number word is never at sentence-start. This parser accepts BOTH
 *  shapes:
 *
 *  - Carrier-prefixed (the new norm): "Okay, three plus two. How many?"
 *  - Bare template (back-compat for older fixtures + safety):
 *    "Three plus two. How many?"
 *
 *  The carrier is constrained to 1-2 letter-only words ending in `,` or `—`
 *  (em-dash) so we don't silently absorb arbitrary text drift. Any other
 *  shape still throws. */
export function parseReadAddends(read: string): {
  addendA: number
  addendB: number
} {
  // Anchor: optional leading whitespace, optional 1-2 word carrier ending
  // in `,` or `—`, then capture word A, " plus ", capture word B,
  // ". How many?". Case-insensitive so "Three" / "three" both work, and so
  // the carrier "Okay," / "okay," both pass.
  const match = read.match(
    /^\s*(?:[a-z]+(?:\s+[a-z]+)?\s*[,—]\s+)?([a-z]+)\s+plus\s+([a-z]+)\s*\.\s*how\s+many\s*\?\s*$/i,
  )
  if (!match) {
    throw new PlanFromServerError(
      `math read line "${read}" did not match "<word> plus <word>. How many?" template`,
    )
  }
  const a = NUMBER_WORDS[match[1]!.toLowerCase()]
  const b = NUMBER_WORDS[match[2]!.toLowerCase()]
  if (a === undefined || b === undefined) {
    throw new PlanFromServerError(
      `math read line "${read}" had unrecognised number word(s)`,
    )
  }
  return { addendA: a, addendB: b }
}

/** Parse a `math.p<N>.<slot>` utterance id. Returns null on miss. */
function parseUtteranceId(
  id: string,
): { index: number; slot: MathUtteranceSlot } | null {
  // Anchored to the canonical template; rejects nested dots / extra
  // segments / empty slot names.
  const match = id.match(
    /^math\.p(\d+)\.(read|correct|reprompt|hint|giveAnswer)$/,
  )
  if (!match) return null
  const index = Number.parseInt(match[1]!, 10)
  if (!Number.isInteger(index) || index < 1) return null
  return { index, slot: match[2] as MathUtteranceSlot }
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
