/**
 * Hardcoded sums-to-10 session plans for the Math screen v1.
 *
 * Why hardcoded — and not calling Claude
 * --------------------------------------
 * Per CLAUDE.md, the production architecture is "Claude is the brain, not
 * the mouth": the session-start Claude call returns a JSON plan + the
 * inline TTS bundle for it. That pipeline is real (`api/claude.ts` +
 * `api/_tts.ts` post-86c9gr385) BUT requires `ANTHROPIC_API_KEY` in Vercel
 * env, which is still owed (see project memory `reference_deploy.md`).
 *
 * Until the key lands, we ship 2-3 deterministic plans here so the Math
 * screen can be developed and QA-tested end-to-end without any network
 * dependency. When the key is configured and Path A is wired into Math's
 * mount, the orchestrator will replace `pickStaticSessionPlan()` with a
 * fetch — the {@link MathSessionPlan} shape is the contract that survives
 * the swap, so consumers don't change.
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
 * Each plan ships a list of pre-canned utterance lines. The shape mirrors
 * `Utterance` from `api/_types.ts` so when Path A lands, the swap is
 * mechanical. While hardcoded, `audio.base64` is empty — the production
 * `sessionAudio.playSessionUtterance` path would fail to play these as
 * MP3s, so for v1 the Math component receives a `playUtterance` test seam
 * (defaulting to a function that just resolves immediately and reveals
 * the caption text). When the Anthropic key is configured, the plan
 * factory swaps to a real fetch and the screen receives genuine MP3s
 * without any other change.
 */

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
    // than silently producing "11" in Melody's mouth.
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
 * When the Anthropic key lands, this function gets replaced (or wrapped)
 * with a fetch to `/api/claude` kind=`session-start`.
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
