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
 * invariant is structural: 8 problems, every utterance id matches the
 * `math.p<N>.<slot>` template, and each problem carries the four
 * always-present slots (read, correct, reprompt, giveAnswer) plus EITHER
 * the legacy single `hint` OR the full `hint1`/`hint2`/`hint3` triple
 * (the W12-01 back-compat predicate — a partial triple is rejected).
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
 * Extended kinds (opt-in, native only)
 * ------------------------------------
 * `{ extendedKinds: true }` also reads the number-recognition ("Tap the
 * seven."), skip-count ("Two, four, six, eight. What is next?"),
 * multiplication ("Two times three. How many?") and missing-number ("Seven
 * and what make ten?") read lines and returns an
 * `ExtendedMathSessionPlan` (see `extendedProblems.ts`). Without the option (the frozen web app's call) the
 * output is exactly what it was before: arithmetic only, and those read
 * lines throw.
 *
 * Pure module: no React, no I/O, no side effects. All inputs validated;
 * throws `PlanFromServerError` on any structural issue so the caller's
 * fallback path fires cleanly.
 */

import {
  EXTENDED_ANSWER_MAX,
  MISSING_ADDEND_TOTAL_MAX,
  type ExtendedMathProblem,
  type ExtendedMathSessionPlan,
} from './extendedProblems'
import {
  type MathProblem,
  type MathProblemUtterances,
  type MathSessionPlan,
  type MathUtteranceSlot,
} from './sessionPlans'

/**
 * Slots required on EVERY problem regardless of hint shape. The hint
 * slot(s) are validated separately by {@link assertHintShape} because a
 * problem carries EITHER the legacy `hint` OR the `hint1`/`hint2`/`hint3`
 * triple — the back-compat predicate (W12-01, ticket 86ca86zyq).
 */
const NON_HINT_SLOTS: readonly MathUtteranceSlot[] = [
  'read',
  'correct',
  'reprompt',
  'giveAnswer',
]

/** The three escalating hint sub-step slots (W12-01). */
const HINT_TRIPLE_SLOTS: readonly MathUtteranceSlot[] = [
  'hint1',
  'hint2',
  'hint3',
]

/** Single-token number words 0..20 — and decade names 30..90. Tens 21..99
 *  that English spells as a hyphenated compound (`thirty-one`, `forty-five`,
 *  `ninety-nine`, …) are NOT entries here — they are resolved
 *  compositionally by {@link wordToNumber} via a hyphen split.
 *
 *  Covered ranges:
 *
 *   - 0..10: every add-to-10 / sub-to-10 addend (sub-to-10 needs the
 *     `zero` entry for the `7 − 0` and `5 − 5` style facts).
 *   - 11..20: teen-plus-single add-to-20 / sub-to-20 facts
 *     (e.g. "Twelve plus five. How many?" — addendA=12, addendB=5).
 *   - 30, 40, 50, 60, 70, 80, 90: the decade names. Solo decade operands
 *     ("Forty plus three. How many?") parse via direct lookup;
 *     hyphenated forms ("Thirty-one plus four. How many?") parse via
 *     {@link wordToNumber} which splits on `-` and adds.
 *
 *  Compositional decoding chosen over an 80-entry literal table because
 *  English number-word formation is regular for 21..99 and the
 *  compositional approach is robust to any decade × unit pair without
 *  re-listing 80 strings. {@link wordToNumber} is the only place that
 *  inspects this map; both decoders share the table.
 *
 *  Out-of-range tokens ("Hundred", "Twentyone" without hyphen, etc.)
 *  return `undefined` from {@link wordToNumber} — the parser then throws
 *  `PlanFromServerError` so the App's silent-fallback path fires rather
 *  than silently absorbing prompt drift. */
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
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

/** Decode a (possibly hyphenated) number word to its integer value.
 *
 *  Single-token forms ("seven", "fifteen", "twenty", "forty") are looked
 *  up directly. Hyphenated compounds ("thirty-one", "ninety-nine") are
 *  split on `-` and summed — the contract is "decade + unit", so the left
 *  side must resolve to a multiple of 10 in [20, 90] AND the right side
 *  must resolve to a unit in [1, 9].
 *
 *  Returns `undefined` on any miss (unknown token, missing decade-then-
 *  unit composition, malformed hyphenation). Callers translate that into
 *  a `PlanFromServerError`.
 *
 *  Why compositional rather than 80 literal entries: English 21..99 number
 *  words are formed regularly (decade + `-` + unit). A two-pass decoder
 *  is shorter, easier to read, and forward-compatible with any future
 *  re-bake that uses these names. The strict decade ∈ [20, 90] / unit ∈
 *  [1, 9] check rejects nonsense like "thirty-eleven" or "thirty-twenty"
 *  rather than silently accepting them.
 *
 *  Inputs are expected to be lowercased — callers in this file pass
 *  `.toLowerCase()` before lookup. */
export function wordToNumber(word: string): number | undefined {
  // Single-token form first — covers 0..20 and the round decades.
  const direct = NUMBER_WORDS[word]
  if (direct !== undefined) return direct

  // Compositional decade-units form: "thirty-one", "ninety-nine", …
  const dashIdx = word.indexOf('-')
  if (dashIdx < 1 || dashIdx !== word.lastIndexOf('-')) {
    // Either no hyphen (already handled by direct lookup miss) or more
    // than one hyphen ("twenty-one-two") — both reject.
    return undefined
  }
  const decade = NUMBER_WORDS[word.slice(0, dashIdx)]
  const unit = NUMBER_WORDS[word.slice(dashIdx + 1)]
  if (decade === undefined || unit === undefined) return undefined
  // Decade slot must be a round multiple of 10 in [20, 90]; unit slot
  // must be a single digit in [1, 9]. Rejects "twenty-twenty",
  // "thirty-eleven", "five-three", etc. as malformed compounds.
  if (decade < 20 || decade > 90 || decade % 10 !== 0) return undefined
  if (unit < 1 || unit > 9) return undefined
  return decade + unit
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

/** Options for {@link mathSessionPlanFromServer}. */
export interface MathPlanFromServerOptions {
  /** Also read the number-recognition, skip-count and multiplication read
   *  lines, and return an `ExtendedMathSessionPlan` whose problems carry a
   *  `kind`. Default
   *  `false`: arithmetic only, the web app's behaviour. */
  readonly extendedKinds?: boolean
  /**
   * Build problems 1..`problemCount` instead of 1..8, and reject a plan
   * with a problem numbered past it: the Map peek reads exactly 3 (native
   * spec `design/native/fast-track-native.md` § 6.2). Default: 8, with
   * later numbers ignored (the web app's behaviour).
   */
  readonly problemCount?: number
}

/**
 * Build a `MathSessionPlan` from a server-returned plan blob.
 *
 * With `{ extendedKinds: true }`, build an `ExtendedMathSessionPlan` instead:
 * every problem carries a `kind`, and number-recognition, skip-count and
 * multiplication read lines parse too.
 *
 * @throws {PlanFromServerError} if the blob isn't shaped right or any
 *   `read` text fails to parse against the template.
 */
export function mathSessionPlanFromServer(serverPlan: unknown): MathSessionPlan
export function mathSessionPlanFromServer(
  serverPlan: unknown,
  options: MathPlanFromServerOptions & { readonly extendedKinds: true },
): ExtendedMathSessionPlan
export function mathSessionPlanFromServer(
  serverPlan: unknown,
  options?: MathPlanFromServerOptions,
): MathSessionPlan | ExtendedMathSessionPlan
export function mathSessionPlanFromServer(
  serverPlan: unknown,
  options?: MathPlanFromServerOptions,
): MathSessionPlan | ExtendedMathSessionPlan {
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
  // One list per mode: the default (web) path builds exactly the
  // arithmetic-only `MathProblem[]` it always has; only the opt-in path
  // tags problems with a `kind` and reads the extended templates.
  const extended = options?.extendedKinds === true
  const count = options?.problemCount ?? 8
  if (options?.problemCount !== undefined) {
    const extra = [...byProblem.keys()].find((i) => i > count)
    if (extra !== undefined) {
      throw new PlanFromServerError(
        `server plan has problem ${extra}; expected exactly ${count}`,
      )
    }
  }
  const problems: MathProblem[] = []
  const extendedProblems: ExtendedMathProblem[] = []
  for (let index = 1; index <= count; index++) {
    const bucket = byProblem.get(index)
    if (!bucket) {
      throw new PlanFromServerError(
        `server plan missing problem index ${index}`,
      )
    }
    for (const slot of NON_HINT_SLOTS) {
      if (typeof bucket[slot] !== 'string') {
        throw new PlanFromServerError(
          `server plan problem ${index} missing slot "${slot}"`,
        )
      }
    }
    assertHintShape(bucket, index)
    const utterances = bucket as MathProblemUtterances
    if (extended) {
      extendedProblems.push(extendedProblemFromRead(index, utterances))
    } else {
      problems.push(
        arithmeticProblem(
          index,
          parseReadOperands(utterances.read),
          utterances,
        ),
      )
    }
  }

  if (extended) {
    return {
      id: serverPlan.id,
      label: serverPlan.label,
      problems: extendedProblems,
    }
  }
  return {
    id: serverPlan.id,
    label: serverPlan.label,
    problems,
  }
}

/** One warm-up block of a server response: `math.w<block>.<slot>`. */
export interface MathWarmupProblem {
  /** The `w` number (1..3): the warm-up ref the block answers, in order. */
  block: number
  problem: ExtendedMathProblem
}

/**
 * The warm-up blocks the server appended to a forward response as
 * `math.w<N>.<slot>` (native spec
 * `design/native/review-mode-and-warmup-native.md` § 7.4), read with the
 * `p` blocks' slot set and per-problem builder (extended kinds), in `N`
 * order. A block with a missing slot or a read line no template matches is
 * dropped, and a plan that is not a server plan gives none: the warm-up
 * never fails the session. The `p` parser above skips `w` ids (its regex
 * is anchored on `p<N>`), so the forward plan reads exactly as before.
 */
export function mathWarmupFromServer(serverPlan: unknown): MathWarmupProblem[] {
  if (!isServerPlan(serverPlan)) return []
  const byBlock = new Map<number, Partial<MathProblemUtterances>>()
  for (const u of serverPlan.utterances) {
    const parsedId = parseUtteranceId(u.id, 'w')
    if (parsedId === null) continue
    const bucket = byBlock.get(parsedId.index) ?? {}
    bucket[parsedId.slot] = u.text
    byBlock.set(parsedId.index, bucket)
  }
  const out: MathWarmupProblem[] = []
  for (const block of [...byBlock.keys()].sort((a, b) => a - b)) {
    const bucket = byBlock.get(block)!
    try {
      for (const slot of NON_HINT_SLOTS) {
        if (typeof bucket[slot] !== 'string') {
          throw new PlanFromServerError(
            `warm-up block ${block} missing "${slot}"`,
          )
        }
      }
      assertHintShape(bucket, block)
      out.push({
        block,
        problem: extendedProblemFromRead(
          block,
          bucket as MathProblemUtterances,
        ),
      })
    } catch (err) {
      if (!(err instanceof PlanFromServerError)) throw err
    }
  }
  return out
}

/** The arithmetic problem for parsed operands; the answer is derived here. */
function arithmeticProblem(
  index: number,
  { addendA, addendB, op }: { addendA: number; addendB: number; op: '+' | '-' },
  utterances: MathProblemUtterances,
): MathProblem {
  const correct = op === '-' ? addendA - addendB : addendA + addendB
  return {
    index,
    addendA,
    addendB,
    correct,
    op,
    utterances,
  }
}

/** One problem of an extended plan, dispatched on the read line's template.
 *  The templates are disjoint ("Tap the", comma list + "What is next?",
 *  "times", "plus" / "minus" / "take away"), so the order only decides which
 *  error a near-miss gets. */
function extendedProblemFromRead(
  index: number,
  utterances: MathProblemUtterances,
): ExtendedMathProblem {
  const { read } = utterances
  const recognize = matchRecognizeRead(read)
  if (recognize !== null) {
    return { kind: 'recognize', index, correct: recognize, utterances }
  }
  const skipCount = matchSkipCountRead(read)
  if (skipCount) {
    return {
      kind: 'skip-count',
      index,
      sequence: skipCount.sequence,
      step: skipCount.step,
      correct: skipCount.next,
      utterances,
    }
  }
  const missing = matchMissingAddendRead(read)
  if (missing) {
    return { kind: 'missing-addend', index, ...missing, utterances }
  }
  const multiply = matchMultiplyRead(read)
  if (multiply) {
    assertRecordableAnswer(read, multiply.factorA * multiply.factorB)
    return {
      kind: 'multiply',
      index,
      factorA: multiply.factorA,
      factorB: multiply.factorB,
      correct: multiply.factorA * multiply.factorB,
      utterances,
    }
  }
  const operands = matchReadOperands(read)
  if (operands) {
    return {
      kind: 'arithmetic',
      ...arithmeticProblem(index, operands, utterances),
    }
  }
  throw new PlanFromServerError(
    `math read line "${read}" did not match any known math read template ` +
      `(addition "<W> plus <W>. How many?"; subtraction "<W> minus <W>. ` +
      `How many are left?"; subtraction first-session "<W> take away <W>. ` +
      `How many are left?"; number recognition "Tap the <W>."; skip-count ` +
      `"<W>, <W>, <W>. What is next?"; multiplication "<W> times <W>. How ` +
      `many?"; missing number "<W> and what make <W>?")`,
  )
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
  const operands = matchReadOperands(read)
  if (operands) return operands
  throw new PlanFromServerError(
    `math read line "${read}" did not match any known math read template ` +
      `(addition "<W> plus <W>. How many?"; subtraction "<W> minus <W>. ` +
      `How many are left?"; subtraction first-session "<W> take away <W>. ` +
      `How many are left?")`,
  )
}

/** The arithmetic templates of {@link parseReadOperands}: `null` when the
 *  line matches none of them; throws when it matches one but a number word
 *  is unknown. */
function matchReadOperands(read: string): {
  addendA: number
  addendB: number
  op: '+' | '-'
} | null {
  // Addition template — anchored to "plus" between two number words.
  // "Three plus two. How many?" / "Thirty-one plus four. How many?" —
  // case-insensitive. Operand character class `[a-z-]` accepts the
  // hyphenated compound forms (`twenty-one` … `ninety-nine`); the
  // structural rejection of malformed hyphenation lives downstream in
  // {@link wordToNumber}, so the regex is intentionally permissive here.
  const additionMatch = read.match(
    /^\s*([a-z-]+)\s+plus\s+([a-z-]+)\s*\.\s*how\s+many\s*\?\s*$/i,
  )
  if (additionMatch) {
    return decodeOperands(additionMatch[1]!, additionMatch[2]!, '+', read)
  }
  // Subtraction template — "minus" between two number words, "how many
  // are left?" trailing. e.g. "Seven minus three. How many are left?"
  // Hyphenated operands accepted ("Thirty-four minus two. How many are
  // left?"); decoding rejects malformed forms.
  const subMinusMatch = read.match(
    /^\s*([a-z-]+)\s+minus\s+([a-z-]+)\s*\.\s*how\s+many\s+are\s+left\s*\?\s*$/i,
  )
  if (subMinusMatch) {
    return decodeOperands(subMinusMatch[1]!, subMinusMatch[2]!, '-', read)
  }
  // First-session subtraction template — "take away" between operands.
  // e.g. "Eight take away three. How many are left?"
  const subTakeAwayMatch = read.match(
    /^\s*([a-z-]+)\s+take\s+away\s+([a-z-]+)\s*\.\s*how\s+many\s+are\s+left\s*\?\s*$/i,
  )
  if (subTakeAwayMatch) {
    return decodeOperands(subTakeAwayMatch[1]!, subTakeAwayMatch[2]!, '-', read)
  }
  return null
}

/** Extract the target number from a number-recognition `read` line.
 *
 *  Template (canon and planner, `api/_planner.ts` number-recog):
 *  `"Tap the <number-word>."`, e.g. `"Tap the seven."` → 7.
 *
 *  The word must be a number word in 1..10 (the planner's hint-2 table
 *  covers only those): "Tap the <word>." is also Word Song's blending read
 *  line, so a non-number word is not a recognition problem. Throws on a
 *  miss or a number outside 1..10.
 *
 *  Opt-in kind: only `mathSessionPlanFromServer(plan, { extendedKinds: true
 *  })` reads this template. */
export function parseRecognizeRead(read: string): number {
  const target = matchRecognizeRead(read)
  if (target !== null) return target
  throw new PlanFromServerError(
    `math read line "${read}" did not match the number-recognition read ` +
      `template "Tap the <W>." with a number word`,
  )
}

/** Extract the sequence, step and next term from a skip-count `read` line.
 *
 *  Templates: the committed canon's, which is the planner's generic-tier
 *  hint template `"<sequence-terms>. What is next?"`, and the example form
 *  on the planner's skip-counting line, "... what's next?" (the live planner
 *  writes plans whenever Leitner items are due):
 *
 *   - `"Two, four, six, eight. What is next?"` → sequence [2, 4, 6, 8],
 *     step 2, next 10
 *   - `"Two, four, six. What's next?"` → sequence [2, 4, 6], step 2, next 8
 *
 *  Case-insensitive; hyphenated terms ("twenty-five") decode through
 *  {@link wordToNumber}. Throws unless the line has at least three terms
 *  that all decode and share one positive step: a two-term line is not a
 *  pattern, and an irregular one has no single next term to tap.
 *
 *  Opt-in kind: only `mathSessionPlanFromServer(plan, { extendedKinds: true
 *  })` reads this template. */
export function parseSkipCountRead(read: string): {
  sequence: number[]
  step: number
  next: number
} {
  const skipCount = matchSkipCountRead(read)
  if (skipCount) return skipCount
  throw new PlanFromServerError(
    `math read line "${read}" did not match the skip-count read template ` +
      `"<W>, <W>, <W>. What is next?" (or "What's next?")`,
  )
}

/** Extract the two factors from a multiplication `read` line.
 *
 *  Template (canon and planner): `"<A> times <B>. How many?"`, e.g.
 *  `"Two times three. How many?"` → factorA 2, factorB 3. `factorB` is the
 *  number of copies of `factorA` (canon hint: "Two, then two, then two.").
 *
 *  Case-insensitive; throws on any drift or an unknown number word.
 *
 *  Opt-in kind: only `mathSessionPlanFromServer(plan, { extendedKinds: true
 *  })` reads this template. */
export function parseMultiplyRead(read: string): {
  factorA: number
  factorB: number
} {
  const multiply = matchMultiplyRead(read)
  if (multiply) return multiply
  throw new PlanFromServerError(
    `math read line "${read}" did not match the multiplication read ` +
      `template "<W> times <W>. How many?"`,
  )
}

/** Extract the given part, the whole and the missing part from a
 *  missing-addend `read` line (content wave 1 § 1.6).
 *
 *  Template (canon and planner): `"<A> and what make <T>?"`, e.g. `"Seven
 *  and what make ten?"` → addendA 7, total 10, correct 3. Valid when
 *  1 ≤ A < T ≤ {@link MISSING_ADDEND_TOTAL_MAX}. Case-insensitive; throws on
 *  any drift, an unknown number word or an out-of-range pair. Disjoint from
 *  every other template (none contains "and what make").
 *
 *  Opt-in kind: only `mathSessionPlanFromServer(plan, { extendedKinds: true
 *  })` reads this template. */
export function parseMissingAddendRead(read: string): {
  addendA: number
  total: number
  correct: number
} {
  const missing = matchMissingAddendRead(read)
  if (missing) return missing
  throw new PlanFromServerError(
    `math read line "${read}" did not match the missing-number read ` +
      `template "<W> and what make <W>?"`,
  )
}

/** {@link parseMissingAddendRead}'s template: `null` on a miss; throws on an
 *  unknown number word or a pair outside 1 ≤ A < T ≤ 20. */
function matchMissingAddendRead(
  read: string,
): { addendA: number; total: number; correct: number } | null {
  const match = read.match(
    /^\s*([a-z-]+)\s+and\s+what\s+make\s+([a-z-]+)\s*\?\s*$/i,
  )
  if (!match) return null
  const addendA = wordToNumber(match[1]!.toLowerCase())
  const total = wordToNumber(match[2]!.toLowerCase())
  if (addendA === undefined || total === undefined) {
    throw new PlanFromServerError(
      `math read line "${read}" had unrecognised number word(s)`,
    )
  }
  if (addendA < 1 || addendA >= total || total > MISSING_ADDEND_TOTAL_MAX) {
    throw new PlanFromServerError(
      `math read line "${read}" names ${addendA} of ${total}; a missing ` +
        `number needs 1 ≤ part < whole ≤ ${MISSING_ADDEND_TOTAL_MAX}`,
    )
  }
  return { addendA, total, correct: total - addendA }
}

/** {@link parseRecognizeRead}'s template: `null` when the line is not
 *  "Tap the <word>." or the word is not a number word (Word Song's blending
 *  line has the same shape); throws when the number is outside 1..10. */
function matchRecognizeRead(read: string): number | null {
  const match = read.match(/^\s*tap\s+the\s+([a-z-]+)\s*\.\s*$/i)
  if (!match) return null
  const target = wordToNumber(match[1]!.toLowerCase())
  if (target === undefined) return null
  if (target < 1 || target > 10) {
    throw new PlanFromServerError(
      `math read line "${read}" asks for ${target}; number recognition ` +
        `covers 1..10`,
    )
  }
  return target
}

/** {@link parseSkipCountRead}'s template: `null` when the line is not a
 *  comma-separated list of words followed by "What is next?" / "What's
 *  next?"; throws when it is one but the terms don't form a skip-count
 *  sequence. */
function matchSkipCountRead(
  read: string,
): { sequence: number[]; step: number; next: number } | null {
  const match = read.match(
    /^\s*([a-z-]+(?:\s*,\s*[a-z-]+)+)\s*\.\s*what(?:\s+is|['’]s)\s+next\s*\?\s*$/i,
  )
  if (!match) return null
  const sequence: number[] = []
  for (const word of match[1]!.split(',')) {
    const n = wordToNumber(word.trim().toLowerCase())
    if (n === undefined) {
      throw new PlanFromServerError(
        `math read line "${read}" had unrecognised number word(s)`,
      )
    }
    sequence.push(n)
  }
  if (sequence.length < 3) {
    throw new PlanFromServerError(
      `math read line "${read}" is a skip-count read with fewer than three terms`,
    )
  }
  const step = sequence[1]! - sequence[0]!
  const regular = sequence.every(
    (n, i) => i === 0 || n - sequence[i - 1]! === step,
  )
  if (step <= 0 || !regular) {
    throw new PlanFromServerError(
      `math read line "${read}" is not a skip-count sequence ` +
        `(the terms must go up by the same step)`,
    )
  }
  const next = sequence[sequence.length - 1]! + step
  assertRecordableAnswer(read, next)
  return { sequence, step, next }
}

/** Throws when an extended problem's answer can't be recorded: the
 *  progress guard holds answers up to {@link EXTENDED_ANSWER_MAX} (99), and
 *  the session falls back rather than lose the progress doc. */
function assertRecordableAnswer(read: string, answer: number): void {
  if (answer > EXTENDED_ANSWER_MAX) {
    throw new PlanFromServerError(
      `math read line "${read}" has the answer ${answer}, above ` +
        `${EXTENDED_ANSWER_MAX} (the progress record holds answers up to ` +
        `${EXTENDED_ANSWER_MAX})`,
    )
  }
}

/** {@link parseMultiplyRead}'s template: `null` on a miss; throws on an
 *  unknown number word. */
function matchMultiplyRead(
  read: string,
): { factorA: number; factorB: number } | null {
  const match = read.match(
    /^\s*([a-z-]+)\s+times\s+([a-z-]+)\s*\.\s*how\s+many\s*\?\s*$/i,
  )
  if (!match) return null
  const factorA = wordToNumber(match[1]!.toLowerCase())
  const factorB = wordToNumber(match[2]!.toLowerCase())
  if (factorA === undefined || factorB === undefined) {
    throw new PlanFromServerError(
      `math read line "${read}" had unrecognised number word(s)`,
    )
  }
  return { factorA, factorB }
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
  const a = wordToNumber(wordA.toLowerCase())
  const b = wordToNumber(wordB.toLowerCase())
  if (a === undefined || b === undefined) {
    throw new PlanFromServerError(
      `math read line "${rawRead}" had unrecognised number word(s)`,
    )
  }
  return { addendA: a, addendB: b, op }
}

/**
 * Validate a problem's hint shape against the back-compat predicate
 * (W12-01, ticket 86ca86zyq). A problem is valid iff it carries EITHER the
 * legacy single `hint` OR the complete `hint1`/`hint2`/`hint3` triple —
 * never a partial triple, never neither.
 *
 * Throws `PlanFromServerError` with a clear missing-slot message when:
 *   - no hint slot is present at all, OR
 *   - the triple is partial (e.g. `hint1` without `hint2`/`hint3`).
 *
 * A partial triple is the dangerous case (wave-12-plan §8 risk 3): a loose
 * predicate that accepted `hint1` alone would silently render a broken hint
 * sequence. We reject it loudly so the App's silent-fallback path fires
 * instead of shipping a half-built scaffold.
 */
function assertHintShape(
  bucket: Partial<MathProblemUtterances>,
  index: number,
): void {
  const hasLegacy = typeof bucket.hint === 'string'
  const presentTripleSlots = HINT_TRIPLE_SLOTS.filter(
    (s) => typeof bucket[s] === 'string',
  )
  const hasFullTriple = presentTripleSlots.length === HINT_TRIPLE_SLOTS.length

  if (hasLegacy || hasFullTriple) return

  // Partial triple → name the missing triple slot(s) for a clear error.
  if (presentTripleSlots.length > 0) {
    const missing = HINT_TRIPLE_SLOTS.filter(
      (s) => typeof bucket[s] !== 'string',
    )
    throw new PlanFromServerError(
      `server plan problem ${index} has a partial hint triple ` +
        `(present: ${presentTripleSlots.join(', ')}; ` +
        `missing slot "${missing[0]}") — a problem must carry EITHER the ` +
        `legacy "hint" OR all of hint1/hint2/hint3, not a partial triple.`,
    )
  }

  // No hint of any shape.
  throw new PlanFromServerError(
    `server plan problem ${index} missing slot "hint" ` +
      `(no legacy "hint" and no hint1/hint2/hint3 triple present).`,
  )
}

/** Parse a `math.p<N>.<slot>` utterance id. Returns null on miss.
 *
 *  Accepts both the legacy single `hint` slot AND the three-hint sub-step
 *  slots `hint1` / `hint2` / `hint3` (W12-01, ticket 86ca86zyq) so committed
 *  legacy canon and the post-W12-04 re-baked three-hint canon both parse.
 *  The `hint` alternative is listed BEFORE `hint1|hint2|hint3` and the regex
 *  is fully anchored (`$`), so `hint` matches `math.pN.hint` exactly and
 *  never the prefix of `math.pN.hint1`. */
function parseUtteranceId(
  id: string,
  block: 'p' | 'w' = 'p',
): { index: number; slot: MathUtteranceSlot } | null {
  // Anchored to the canonical template; rejects nested dots / extra
  // segments / empty slot names. `w` reads the warm-up blocks instead.
  const match = (block === 'p' ? PROBLEM_ID : WARMUP_ID).exec(id)
  if (!match) return null
  const index = Number.parseInt(match[1]!, 10)
  if (!Number.isInteger(index) || index < 1) return null
  return { index, slot: match[2] as MathUtteranceSlot }
}

const PROBLEM_ID =
  /^math\.p(\d+)\.(read|correct|reprompt|hint|hint1|hint2|hint3|giveAnswer)$/
const WARMUP_ID =
  /^math\.w(\d+)\.(read|correct|reprompt|hint|hint1|hint2|hint3|giveAnswer)$/

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
