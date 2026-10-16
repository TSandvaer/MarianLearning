/**
 * What a finished session hands SessionEnd. The shape is the web's
 * `SessionEndPayload` (`src/screens/SessionEnd/SessionEnd.tsx`), so the
 * native SessionEnd (`../screens/sessionEnd/`) receives exactly what the
 * web's does. Math and Word Song build it the way the web's
 * `handleMathComplete` / `handleWordSongComplete` do.
 *
 * Native additions (native spec `design/native/review-mode-and-warmup-native.md`
 * § 7.4): `review` marks a same-day review, which Session End records with no
 * history entry; `problemFacts` is a review's per-problem fact list (its
 * steps mix, so some problems may have none); `warmupFacts` +
 * `warmupCorrect` are a forward session's warm-up outcomes.
 */
// A problem's fact (native spec § 8; content wave 1 K4): `a ± b`, `A * B`
// (`2*3` and `3*2` are separate facts), a missing number's bond (`7 + ? =
// 10` is `7+3`); `null` for number recognition and skip counting.
import {
  problemFact,
  type ExtendedMathProblem,
  type ExtendedMathSessionPlan,
} from '@marian/core/math/extendedProblems'
import type {
  MathProblem,
  MathSessionPlan,
} from '@marian/core/math/sessionPlans'
import type { FocusMode, SkillNode } from '@marian/core/progress'
import type { SessionEndSurface } from '@marian/core/sessionEnd/progressHistory'
import type { MathOfferedClass } from '../screens/math/extendedChipOrder'
import type { MathSessionResult } from '../screens/math/mathTypes'
import type { WordSongSessionResult } from '../screens/wordSong/wordSongTypes'

export interface SessionEndPayload {
  totalCorrect: number
  totalStardust: number
  finalStreak: number
  earnedThisSession: number
  surface: SessionEndSurface
  perProblemCorrect?: readonly boolean[]
  targetWords?: readonly string[]
  latencyMs?: readonly number[]
  mathFacts?: readonly { a: number; b: number; op: '+' | '-' | '*' }[]
  subitisingScaffoldRendered?: boolean
  subitisingScaffoldSubRendered?: boolean
  perProblemAnswerValue?: readonly (number | null)[]
  perProblemAnswerWord?: readonly (string | null)[]
  perProblemDistractorClass?: readonly (MathOfferedClass | null)[]
  currentTargetVowel?: '/o/' | '/u/' | '/i/' | '/e/'
  sessionFocus?: { node: SkillNode; mode: FocusMode }
  /** A same-day review (no history entry, no flower, no bonus). */
  review?: true
  /** A review's 8 problems' facts; `null` for a problem with none. */
  problemFacts?: readonly (MathFact | null)[]
  /** The warm-up problems' facts (math), in order. */
  warmupFacts?: readonly (MathFact | null)[]
  /** The warm-up problems' first-tap correctness, in order. */
  warmupCorrect?: readonly boolean[]
  /**
   * The 8 scored problems' first-tap correctness (fast-track spec
   * `design/native/fast-track-native.md` § 3.2), for the secure-day rule.
   */
  firstTapCorrect?: readonly boolean[]
}

type MathFact = { a: number; b: number; op: '+' | '-' | '*' }

/** How the round on screen was made up (the session controller's snapshot). */
export interface RoundShape {
  review: boolean
  /** The first `warmupCount` problems of the plan are the warm-up. */
  warmupCount: number
}

const FORWARD_ROUND: RoundShape = { review: false, warmupCount: 0 }

/** The problems' facts, one per problem, or `undefined` when a problem has
 *  none: `mathFacts` is zipped with `perProblemCorrect` by position for
 *  the Leitner box, so a fact list with holes cannot be sent. Every
 *  forward session is one step, so its 8 are all-facts or no-facts (a
 *  review sends `problemFacts`, holes allowed, instead). */
function planFacts(
  problems: readonly (MathProblem | ExtendedMathProblem)[],
): MathFact[] | undefined {
  const facts: MathFact[] = []
  for (const p of problems) {
    const fact = problemFact(p)
    if (fact === null) return undefined
    facts.push(fact)
  }
  return facts
}

/**
 * Web `handleMathComplete`: the result, `surface: 'math'`, the facts of
 * the plan that was on screen, the scaffold flags only when `true`, and
 * the session focus frozen at the session start (omitted without one).
 * Native: a number-recognition or skip-count plan sends no facts (no
 * Leitner outcome, no `mathFacts`); multiplication sends `op: '*'` facts.
 */
export function mathSessionEndPayload(
  result: MathSessionResult,
  activePlan: MathSessionPlan | ExtendedMathSessionPlan | null,
  sessionFocus: { node: SkillNode; mode: FocusMode } | null,
  round: RoundShape = FORWARD_ROUND,
): SessionEndPayload {
  const problems: readonly (MathProblem | ExtendedMathProblem)[] =
    activePlan?.problems ?? []
  const warmup = problems.slice(0, round.warmupCount)
  const scored = problems.slice(round.warmupCount)
  const mathFacts = activePlan && !round.review ? planFacts(scored) : undefined
  return {
    totalCorrect: result.totalCorrect,
    totalStardust: result.totalStardust,
    finalStreak: result.finalStreak,
    earnedThisSession: result.earnedThisSession,
    surface: 'math',
    perProblemCorrect: result.perProblemCorrect,
    latencyMs: result.latencyMs,
    ...(mathFacts !== undefined ? { mathFacts } : {}),
    ...(result.subitisingScaffoldRendered === true
      ? { subitisingScaffoldRendered: true }
      : {}),
    ...(result.subitisingScaffoldSubRendered === true
      ? { subitisingScaffoldSubRendered: true }
      : {}),
    perProblemAnswerValue: result.perProblemAnswerValue,
    perProblemDistractorClass: result.perProblemDistractorClass,
    firstTapCorrect: result.firstTapCorrect,
    ...(sessionFocus !== null ? { sessionFocus } : {}),
    ...(round.review
      ? { review: true as const, problemFacts: scored.map(problemFact) }
      : {}),
    ...(warmup.length > 0
      ? {
          warmupFacts: warmup.map(problemFact),
          warmupCorrect: result.warmupCorrect.slice(0, warmup.length),
        }
      : {}),
  }
}

/**
 * Web `handleWordSongComplete`: the result (surface `word-song`, the
 * per-problem outcomes and target words for the graduation split, the
 * first-tap words), the letter-sounds target vowel and the session focus
 * frozen at the session start (each omitted when absent).
 */
export function wordSongSessionEndPayload(
  result: WordSongSessionResult,
  currentTargetVowel: '/o/' | '/u/' | '/i/' | '/e/' | null,
  sessionFocus: { node: SkillNode; mode: FocusMode } | null,
  round: RoundShape = FORWARD_ROUND,
): SessionEndPayload {
  return {
    totalCorrect: result.totalCorrect,
    totalStardust: result.totalStardust,
    finalStreak: result.finalStreak,
    earnedThisSession: result.earnedThisSession,
    surface: result.surface,
    perProblemCorrect: result.perProblemCorrect,
    targetWords: result.targetWords,
    perProblemAnswerWord: result.perProblemAnswerWord,
    firstTapCorrect: result.firstTapCorrect,
    ...(currentTargetVowel !== null ? { currentTargetVowel } : {}),
    ...(sessionFocus !== null ? { sessionFocus } : {}),
    ...(round.review ? { review: true as const } : {}),
    ...(result.warmupCorrect.length > 0
      ? { warmupCorrect: result.warmupCorrect }
      : {}),
  }
}
