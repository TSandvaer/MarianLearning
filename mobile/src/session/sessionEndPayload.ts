/**
 * What a finished session hands SessionEnd. The shape is the web's
 * `SessionEndPayload` (`src/screens/SessionEnd/SessionEnd.tsx`), so the
 * native SessionEnd (`../screens/sessionEnd/`) receives exactly what the
 * web's does. Math and Word Song build it the way the web's
 * `handleMathComplete` / `handleWordSongComplete` do.
 */
import type { MathSessionPlan } from '@marian/core/math/sessionPlans'
import type { FocusMode, SkillNode } from '@marian/core/progress'
import type { SessionEndSurface } from '@marian/core/sessionEnd/progressHistory'
import type { OfferedDistractorClass } from '../screens/math/chipOrder'
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
  perProblemDistractorClass?: readonly (OfferedDistractorClass | null)[]
  currentTargetVowel?: '/o/' | '/u/' | '/i/' | '/e/'
  sessionFocus?: { node: SkillNode; mode: FocusMode }
}

/**
 * Web `handleMathComplete`: the result, `surface: 'math'`, the facts of
 * the plan that was on screen, the scaffold flags only when `true`, and
 * the session focus frozen at the session start (omitted without one).
 */
export function mathSessionEndPayload(
  result: MathSessionResult,
  activePlan: MathSessionPlan | null,
  sessionFocus: { node: SkillNode; mode: FocusMode } | null,
): SessionEndPayload {
  const mathFacts = activePlan
    ? activePlan.problems.map((p) => ({ a: p.addendA, b: p.addendB, op: p.op }))
    : undefined
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
