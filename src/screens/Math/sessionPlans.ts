/**
 * Hardcoded sums-to-10 session plans for the Math screen v1.
 *
 * Why hardcoded — and not calling Claude
 * --------------------------------------
 * Per CLAUDE.md, the production architecture is "Claude is the brain, not
 * the mouth": the session-start Claude call returns a JSON plan + the
 * inline TTS bundle for it. That pipeline is real (`api/claude.ts` +
 * `api/_tts.ts` post-86c9gr385) and `ANTHROPIC_API_KEY` is now in Vercel
 * env (production + preview + development).
 *
 * We still ship 2-3 deterministic plans here so the Math screen can be
 * developed and QA-tested end-to-end without any network dependency, and
 * so the Path A wiring layer (App.tsx) has a stable input plan to feed
 * the server's TTS pipeline. When real Claude prompt wiring lands, the
 * orchestrator will replace `pickStaticSessionPlan()` with a fetch — the
 * {@link MathSessionPlan} shape is the contract that survives the swap,
 * so consumers (the `Math` screen) don't change.
 *
 * Wire shape & adapter
 * --------------------
 * The on-the-wire shape that `/api/claude` (kind=`session-start`) consumes
 * and returns is FLAT — the `plan` blob is opaque to the server except for
 * a top-level `utterances: { id, text }[]` field, walked by
 * `api/_session.ts:extractUtteranceTexts`. The browser receives back
 * `Utterance[]` (id, text, audio.base64) — see `api/_types.ts`.
 *
 * `MathSessionPlan` (this file) keeps the per-problem nested shape
 * (`problems[].utterances.{read,correct,reprompt,hint,giveAnswer}`)
 * because every consumer in `Math.tsx` reads utterance lines by slot name
 * inside the gesture-driven state machine. Translating between the two
 * shapes is the job of {@link mathSessionPlanToUtteranceSources} (flatten
 * to wire) and {@link mathSessionPlanFromWire} (rehydrate from wire). The
 * id template is {@link mathUtteranceId}.
 *
 * Why an adapter and not a shape change
 * - Math.tsx pervasively reads `problem.utterances.read` etc. Flattening
 *   the shape means re-keying every callsite by `math.p{N}.read`-style
 *   ids; high churn for a screen that's already QA'd.
 * - Server-side `extractUtteranceTexts` is unchanged: we POST the wire
 *   shape, server walks the flat array, browser merges the returned
 *   audio back into the nested shape via App.tsx's wiring layer.
 * - Single source of truth lives in `api/_types.ts` (`Utterance`, the
 *   inline-base64 contract) and `design/screen-3-math.md`
 *   (`math.p{N}.{slot}` id template).
 *
 * Plan choice
 * -----------
 * `pickStaticSessionPlan()` rotates through {@link STATIC_SESSION_PLANS}
 * by `Date.now()` minute count so two consecutive sessions don't see the
 * exact same problem order. The rotation is deterministic for the same
 * minute (good for tests via the optional `now` param).
 *
 * Plan content
 * ------------
 * Each plan covers Marian's documented ceiling: sums to 10 with addends
 * where the smaller is ≥ 1 and the answer is ≤ 10. Per the diagnostic
 * (project memory `project_diagnostic_results.md`), she should drive
 * automaticity here — these plans favour facts that bridge through 5
 * (3+2, 4+3, 5+5) and the easy doubles (2+2, 4+4) over rote 1+N strings.
 *
 * Per Kyle's spec (§Distractor policy), distractor values themselves are
 * NOT carried in the plan — they're generated at render time via
 * `pickDistractors(correct, problemIndex)`, which gives us a single
 * source of truth for the gentle/off-by-one rule.
 *
 * Audio
 * -----
 * Each plan defines the lines per problem. The audio bytes live OUT of the
 * plan — App.tsx fetches them from `/api/claude` at session-start by
 * flattening the plan via {@link mathSessionPlanToUtteranceSources}, and
 * binds the returned `Utterance[]` to Math via the `playUtterance` prop.
 * When that prop is omitted (no key, fetch failure, tests) Math falls back
 * to its silent-but-captioned `defaultPlayUtterance` at 165 wpm.
 */

import type { Utterance } from '../../../api/_types'

/**
 * Wire-shape source row — `{ id, text }` per utterance, no audio. Used as
 * the request payload's `plan.utterances` array (server reads this via
 * `api/_session.ts:extractUtteranceTexts`) and as the input to
 * {@link mathSessionPlanFromWire}. Mirrors `UtteranceSource` in
 * `api/_session.ts`; declared locally to keep the frontend's type
 * dependency surface narrow (frontend already imports `Utterance` from
 * `api/_types.ts`; pulling another type from `api/_session.ts` would
 * widen the api/ public surface for no benefit).
 */
export interface MathUtteranceSource {
  id: string
  text: string
}

/** Slot names matching the per-problem utterance set. */
export type MathUtteranceSlot =
  | 'read'
  | 'correct'
  | 'reprompt'
  | 'hint'
  | 'giveAnswer'

/**
 * Build the canonical utterance id for a problem + slot.
 *
 * Spec source of truth: `design/screen-3-math.md` §"Audio integration
 * contract (Path A)". The pattern `math.p{N}.{slot}` is what the design
 * spec mandates and what the server's pipeline expects to see in the
 * wire-shape `plan.utterances` array.
 *
 * @param problemIndex 1-based problem index (matches `MathProblem.index`).
 * @param slot the per-problem utterance slot.
 */
export function mathUtteranceId(
  problemIndex: number,
  slot: MathUtteranceSlot,
): string {
  return `math.p${problemIndex}.${slot}`
}

/** Slots emitted in canonical render order — matches the spec's bundle layout. */
const ALL_SLOTS: readonly MathUtteranceSlot[] = [
  'read',
  'correct',
  'reprompt',
  'hint',
  'giveAnswer',
]

/** Per-problem audio set. Lines map 1:1 to Kyle's spec §Audio integration. */
export interface MathProblemUtterances {
  /** "Three plus two. How many?" — read on problem reveal. */
  read: string
  /** "Yes! Five!" — fired on correct first-or-later tap. */
  correct: string
  /** "Hmm... try again?" — fired on wrong tap (1st or 2nd attempt). */
  reprompt: string
  /** "Look. Three. And two more. How many now?" — fires after 2 wrongs. */
  hint: string
  /** "This one is five." — fires after 3 wrongs (guided completion). */
  giveAnswer: string
}

/** A single problem in the session. */
export interface MathProblem {
  /** 1-based position in the session (1..8). */
  index: number
  /** Left addend (e.g. 3 in "3 + 2"). */
  addendA: number
  /** Right addend (e.g. 2 in "3 + 2"). */
  addendB: number
  /** The right answer. Always `addendA + addendB`; computed once at plan
   *  authoring time so `Math.tsx` doesn't have to re-derive on every render. */
  correct: number
  /** Pre-canned utterance lines for this problem. */
  utterances: MathProblemUtterances
}

/** A full Math session plan — exactly 8 problems, sums to 10. */
export interface MathSessionPlan {
  /** Stable id for the plan (used by the audio cache and the audit trail). */
  id: string
  /** Human-readable label for QA / debug overlay. */
  label: string
  /** Exactly 8 problems. */
  problems: readonly MathProblem[]
}

/** Build a problem with all the canned utterances derived from its addends. */
function makeProblem(
  index: number,
  addendA: number,
  addendB: number,
): MathProblem {
  const correct = addendA + addendB
  return {
    index,
    addendA,
    addendB,
    correct,
    utterances: {
      read: `${numberWord(addendA)} plus ${numberWord(addendB)}. How many?`,
      correct: `Yes! ${numberWord(correct)}!`,
      reprompt: 'Hmm... try again?',
      hint: `Look. ${numberWord(addendA)}. And ${numberWord(addendB)} more. How many now?`,
      giveAnswer: `This one is ${numberWord(correct)}.`,
    },
  }
}

/**
 * Number word lookup — sums-to-10 only needs 1..10, so we hand-author for
 * absolute spelling control rather than pulling in a humanize-numbers dep.
 * Capitalised nowhere — the templates above set sentence case via context.
 */
function numberWord(n: number): string {
  const words: Record<number, string> = {
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
  }
  const w = words[n]
  if (!w) {
    // Defensive — every plan in this file is hand-authored to stay within
    // [1, 10], but if someone adds a plan that drifts out, throw rather
    // than silently producing "11" in Emma's mouth.
    throw new Error(`[sessionPlans] no word for number ${n}`)
  }
  return w
}

/**
 * The hardcoded plans. Three rotation slots so two back-to-back sessions
 * don't repeat. Each picks 8 facts spanning the sums-to-10 surface; the
 * problem order matters because Kyle's distractor ramp (gentle → off-by-one)
 * is positional, so we keep the easier "bridge through 5" facts in the
 * gentle window (problems 1-3) and let the trickier doubles or near-doubles
 * land in the off-by-one window (4-8).
 */
export const STATIC_SESSION_PLANS: readonly MathSessionPlan[] = [
  {
    id: 'sums-to-10-A',
    label: 'Sums to 10 — bridge-through-5 warm-up',
    problems: [
      makeProblem(1, 3, 2), //  = 5  (gentle)
      makeProblem(2, 1, 4), //  = 5  (gentle)
      makeProblem(3, 4, 2), //  = 6  (gentle)
      makeProblem(4, 5, 3), //  = 8  (off-by-one)
      makeProblem(5, 2, 5), //  = 7  (off-by-one)
      makeProblem(6, 6, 3), //  = 9  (off-by-one)
      makeProblem(7, 4, 4), //  = 8  (doubles, off-by-one)
      makeProblem(8, 5, 5), //  = 10 (clamp test, off-by-one)
    ],
  },
  {
    id: 'sums-to-10-B',
    label: 'Sums to 10 — small-number warm-up',
    problems: [
      makeProblem(1, 1, 2), //  = 3  (gentle, smallest opener)
      makeProblem(2, 2, 3), //  = 5  (gentle)
      makeProblem(3, 4, 1), //  = 5  (gentle)
      makeProblem(4, 3, 4), //  = 7  (off-by-one)
      makeProblem(5, 5, 2), //  = 7  (off-by-one)
      makeProblem(6, 3, 6), //  = 9  (off-by-one)
      makeProblem(7, 7, 2), //  = 9  (off-by-one)
      makeProblem(8, 6, 4), //  = 10 (clamp test, off-by-one)
    ],
  },
  {
    id: 'sums-to-10-C',
    label: 'Sums to 10 — doubles & near-doubles',
    problems: [
      makeProblem(1, 2, 2), //  = 4  (gentle, easy double)
      makeProblem(2, 3, 3), //  = 6  (gentle, easy double)
      makeProblem(3, 1, 5), //  = 6  (gentle)
      makeProblem(4, 2, 4), //  = 6  (off-by-one)
      makeProblem(5, 4, 5), //  = 9  (off-by-one near-double)
      makeProblem(6, 6, 2), //  = 8  (off-by-one)
      makeProblem(7, 3, 5), //  = 8  (off-by-one)
      makeProblem(8, 4, 6), //  = 10 (clamp test, off-by-one)
    ],
  },
]

/**
 * Pick a static plan deterministically from the rotation. Two sessions
 * started in the same minute see the same plan; consecutive minutes
 * advance one slot. Tests pass `now` to pin the choice.
 *
 * When real Claude prompt wiring lands, this function gets replaced (or
 * wrapped) with a fetch to `/api/claude` kind=`session-start`. The
 * adapter functions below survive that swap unchanged.
 */
export function pickStaticSessionPlan(
  now: () => Date = () => new Date(),
): MathSessionPlan {
  const minute = Math.floor(now().getTime() / 60_000)
  const idx =
    ((minute % STATIC_SESSION_PLANS.length) + STATIC_SESSION_PLANS.length) %
    STATIC_SESSION_PLANS.length
  return STATIC_SESSION_PLANS[idx]
}

// ── Wire-shape adapters ──────────────────────────────────────────────────
//
// These translate between `MathSessionPlan` (this file's nested shape) and
// the on-the-wire shape that `/api/claude` consumes (request) and returns
// (response). See the file header `Wire shape & adapter` block for the
// rationale on why this is an adapter rather than a shape change.

/**
 * Flatten a MathSessionPlan into the wire-shape utterance list — one entry
 * per problem × slot, in canonical (problem-major, slot-order) order.
 *
 * The output is shaped to drop directly into the `plan.utterances` field
 * the server walks via `api/_session.ts:extractUtteranceTexts`. App.tsx's
 * Path A wiring layer POSTs `{ kind: 'session-start', payload: { plan: {
 * utterances: mathSessionPlanToUtteranceSources(plan) } } }` to render the
 * audio bundle.
 *
 * Order is stable: problem 1 read/correct/reprompt/hint/giveAnswer, then
 * problem 2's, etc. Server preserves order in its response (per
 * `_session.test.ts:'preserves utterance order even with parallel
 * rendering'`), which makes round-tripping through
 * {@link mathSessionPlanFromWire} deterministic.
 */
export function mathSessionPlanToUtteranceSources(
  plan: MathSessionPlan,
): MathUtteranceSource[] {
  const out: MathUtteranceSource[] = []
  for (const problem of plan.problems) {
    for (const slot of ALL_SLOTS) {
      out.push({
        id: mathUtteranceId(problem.index, slot),
        text: problem.utterances[slot],
      })
    }
  }
  return out
}

/**
 * Rehydrate a MathSessionPlan from its plan skeleton + the server's
 * returned `Utterance[]` (which carries the rendered audio). The plan
 * skeleton supplies the math (addends, ordering); the utterances supply
 * the text + audio bytes for each slot.
 *
 * Used by App.tsx's Path A wiring after a successful `/api/claude` call
 * to confirm that the server returned every expected utterance id. The
 * actual `playUtterance` binding doesn't need this — Math reads text from
 * the plan and the wiring layer maps text → Howl directly — but we keep
 * this adapter for round-trip tests and for any future consumer that
 * needs ID-keyed access to the rehydrated plan.
 *
 * Rules
 * - Every problem × slot combination MUST be present in `utterances`,
 *   matched by id. A missing id throws — better to crash loudly than to
 *   silently substitute the wrong text.
 * - Text from the wire wins over the plan skeleton's original text. The
 *   server is the source of truth for what was actually synthesized; if
 *   it diverges from our skeleton (e.g. SSML normalization tweak), the
 *   captions need to mirror the audio, not the skeleton.
 *
 * @throws {Error} if any expected utterance id is missing from `utterances`.
 */
export function mathSessionPlanFromWire(
  skeleton: MathSessionPlan,
  utterances: readonly Utterance[],
): MathSessionPlan {
  const byId = new Map<string, Utterance>()
  for (const u of utterances) byId.set(u.id, u)

  const rebuiltProblems: MathProblem[] = skeleton.problems.map((problem) => {
    const slotTexts: Partial<MathProblemUtterances> = {}
    for (const slot of ALL_SLOTS) {
      const id = mathUtteranceId(problem.index, slot)
      const u = byId.get(id)
      if (!u) {
        throw new Error(
          `[sessionPlans] mathSessionPlanFromWire: missing utterance "${id}" — ` +
            'wire response is incomplete; cannot rehydrate plan.',
        )
      }
      slotTexts[slot] = u.text
    }
    return {
      ...problem,
      utterances: slotTexts as MathProblemUtterances,
    }
  })

  return {
    ...skeleton,
    problems: rebuiltProblems,
  }
}
