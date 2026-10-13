/**
 * What a finished session hands SessionEnd. The shape is the web's
 * `SessionEndPayload` (`src/screens/SessionEnd/SessionEnd.tsx`), so the
 * native SessionEnd (`../screens/sessionEnd/`) receives exactly what the
 * web's does. Math and Word Song build it the way the web's
 * `handleMathComplete` / `handleWordSongComplete` do.
 */
import type {
  ExtendedMathProblem,
  ExtendedMathSessionPlan,
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
}

type MathFact = { a: number; b: number; op: '+' | '-' | '*' }

/** A problem's fact (native spec § 8): `a ± b` for arithmetic, `A * B` for
 *  multiplication (`2*3` and `3*2` are separate facts, as the canon reads
 *  them); `null` for number recognition and skip counting, which are not
 *  a/b facts. */
function problemFact(p: MathProblem | ExtendedMathProblem): MathFact | null {
  if (!('kind' in p) || p.kind === 'arithmetic') {
    return { a: p.addendA, b: p.addendB, op: p.op }
  }
  if (p.kind === 'multiply') return { a: p.factorA, b: p.factorB, op: '*' }
  return null
}

/** The plan's facts, one per problem, or `undefined` when a problem has
 *  none: `mathFacts` is zipped with `perProblemCorrect` by position for
 *  the Leitner box, so a fact list with holes cannot be sent. Every
 *  session is one step, so a plan is all-facts or no-facts. */
function planFacts(
  plan: MathSessionPlan | ExtendedMathSessionPlan,
): MathFact[] | undefined {
  const facts: MathFact[] = []
  for (const p of plan.problems) {
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
): SessionEndPayload {
  const mathFacts = activePlan ? planFacts(activePlan) : undefined
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
    ...(sessionFocus !== null ? { sessionFocus } : {}),
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
    ...(currentTargetVowel !== null ? { currentTargetVowel } : {}),
    ...(sessionFocus !== null ? { sessionFocus } : {}),
  }
}
