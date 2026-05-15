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

/** Words that can appear as an addend / operand in the `read` template.
 *  Covers 0..20 because:
 *
 *   - add-to-10 (sums 3..10) restricts addends to 1..9 — the 10 entry is
 *     defense in depth in case the prompt drifts.
 *   - add-to-20 (ticket 86c9q5q13, sums 11..20) restricts addends to 1..9
 *     OR a teen + 1, so 11..20 entries cover the teen-plus-single pattern
 *     (e.g. "Twelve plus five. How many?" parses as addendA=12, addendB=5,
 *     correct=17).
 *   - sub-to-10 (Kyle's spec §1.1) introduces subtraction problems with
 *     operands and answer in [0, 10]. Two pool facts have operand `0`
 *     (`7 − 0 = 7`, `9 − 0 = 9`) and two have correct `0` (`5 − 5 = 0`,
 *     `8 − 8 = 0`). The "zero" entry is REQUIRED for the parser to
 *     accept those read-lines; without it the parser would throw on
 *     "Seven minus zero. How many are left?" and the screen would fall
 *     back to the silent static plan.
 *
 *  Anything beyond 20 stays out of this table — that signals a prompt
 *  drift the parser shouldn't silently absorb (`two-digit-addsub` has its
 *  own template / focus node and would route through a different parser
 *  if we ever ship one). */
const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
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
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
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
    const { addendA, addendB, op } = parseReadOperands(utterances.read)
    const correct = op === '-' ? addendA - addendB : addendA + addendB
    problems.push({
      index,
      addendA,
      addendB,
      correct,
      op,
      utterances,
    })
  }

  return {
    id: serverPlan.id,
    label: serverPlan.label,
    problems,
  }
}

/** Extract `{addendA, addendB, op}` from a `read` line.
 *
 *  Three templates accepted, dispatched by substring on the operator
 *  word (`plus` / `minus` / `take away`):
 *
 *   - `"<A> plus <B>. How many?"`             → op `'+'`
 *   - `"<A> minus <B>. How many are left?"`   → op `'-'`
 *   - `"<A> take away <B>. How many are left?"` → op `'-'`
 *
 *  All case-insensitive. Throws on any drift outside these three
 *  templates so the App's silent-fallback path can fire cleanly rather
 *  than silently producing a wrong-operator session.
 *
 *  The first-session `"take away"` variant is Kyle's spec §4.3 — fired
 *  by the planner via `lifetimeFirstEncounters['sub-to-10']` gating. The
 *  parser accepts both variants so the gate's flip from session 1 →
 *  session 2+ doesn't require a parser change.
 */
export function parseReadOperands(read: string): {
  addendA: number
  addendB: number
  op: '+' | '-'
} {
  // Addition template — anchored to "plus" between two number words.
  // "Three plus two. How many?" — case-insensitive.
  const additionMatch = read.match(
    /^\s*([a-z]+)\s+plus\s+([a-z]+)\s*\.\s*how\s+many\s*\?\s*$/i,
  )
  if (additionMatch) {
    return decodeOperands(additionMatch[1]!, additionMatch[2]!, '+', read)
  }
  // Subtraction template — "minus" between two number words, "how many
  // are left?" trailing. e.g. "Seven minus three. How many are left?"
  const subMinusMatch = read.match(
    /^\s*([a-z]+)\s+minus\s+([a-z]+)\s*\.\s*how\s+many\s+are\s+left\s*\?\s*$/i,
  )
  if (subMinusMatch) {
    return decodeOperands(subMinusMatch[1]!, subMinusMatch[2]!, '-', read)
  }
  // First-session subtraction template — "take away" between operands.
  // e.g. "Eight take away three. How many are left?"
  const subTakeAwayMatch = read.match(
    /^\s*([a-z]+)\s+take\s+away\s+([a-z]+)\s*\.\s*how\s+many\s+are\s+left\s*\?\s*$/i,
  )
  if (subTakeAwayMatch) {
    return decodeOperands(subTakeAwayMatch[1]!, subTakeAwayMatch[2]!, '-', read)
  }
  throw new PlanFromServerError(
    `math read line "${read}" did not match any known math read template ` +
      `(addition "<W> plus <W>. How many?"; subtraction "<W> minus <W>. ` +
      `How many are left?"; subtraction first-session "<W> take away <W>. ` +
      `How many are left?")`,
  )
}

/** Backwards-compat shim — exported so existing callers / tests that
 *  read only `{addendA, addendB}` (and assume addition) still compile.
 *  Throws on subtraction templates: addition-only consumers should NOT
 *  be passed subtraction read-lines; if they are, the failure is loud.
 *  New callers should use `parseReadOperands` directly. */
export function parseReadAddends(read: string): {
  addendA: number
  addendB: number
} {
  const result = parseReadOperands(read)
  if (result.op !== '+') {
    throw new PlanFromServerError(
      `parseReadAddends called on a non-addition read line "${read}"; ` +
        `use parseReadOperands for subtraction support`,
    )
  }
  return { addendA: result.addendA, addendB: result.addendB }
}

function decodeOperands(
  wordA: string,
  wordB: string,
  op: '+' | '-',
  rawRead: string,
): { addendA: number; addendB: number; op: '+' | '-' } {
  const a = NUMBER_WORDS[wordA.toLowerCase()]
  const b = NUMBER_WORDS[wordB.toLowerCase()]
  if (a === undefined || b === undefined) {
    throw new PlanFromServerError(
      `math read line "${rawRead}" had unrecognised number word(s)`,
    )
  }
  return { addendA: a, addendB: b, op }
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
