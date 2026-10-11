/**
 * Session End's one write, and what the screen shows from it: the web's
 * mount effect in `src/screens/SessionEnd/SessionEnd.tsx`, lifted out of
 * the component so it can be tested on its own. Same order, same inputs:
 *
 *   1. Word Song only: the +5 completion bonus, before (2) so Hub's
 *      cumulative stardust is post-bonus.
 *   2. `recordSessionEnd` (session history: sessionCount, streak, ...).
 *   3. `recordProgressOnSessionEnd` (the progress doc; runs the mastery
 *      rule), with the session's focus (threaded, else re-derived), the
 *      Leitner outcomes and every per-problem field the web forwards.
 *   4. The path beat and the guidance model from the doc before (2)–(3)
 *      and the doc (3) saved, so the celebration is derived once and never
 *      replays. "Play again to get today's flower." is marked as said the
 *      moment it is scheduled.
 *
 * One deliberate gap: the Word Song graduation split needs the planner's
 * novel-probe word list, which lives in the server's `api/` (outside what
 * Metro bundles). The split is computed when the caller passes the list
 * (`novelProbeWords`); without it no split is written, the fallback the
 * web itself takes when a session used no novel words. Word Song is not
 * ported yet, so no Word Song payload reaches native Session End today.
 */
import { localDateKey, now as progressNow } from '@marian/core/progress/clock'
import {
  defaultProgress,
  isGraduationSessionPending,
  loadProgress,
  pickFocusNode,
  type Progress,
  type ProgressTrack,
  type SkillNode,
} from '@marian/core/progress'
import {
  sessionEndBeat,
  type SessionEndBeat,
} from '@marian/core/progress/pathBeats'
import {
  markNudgeSaid,
  nudgeSaidToday,
} from '@marian/core/sessionEnd/notYetNudge'
import {
  recordProgressOnSessionEnd,
  type GraduationSessionSplit,
  type LeitnerOutcome,
  type SessionEndSurface,
} from '@marian/core/sessionEnd/progressHistory'
import {
  sessionEndGuidance,
  type SessionEndGuidance,
} from '@marian/core/sessionEnd/sessionEndGuidance'
import { recordSessionEnd } from '@marian/core/sessionEnd/sessionHistory'
import {
  WORDSONG_SESSION_END_BONUS,
  grantWordSongCompletionBonus,
} from '@marian/core/shared/wordSongCompletionBonus'
import type { SessionEndPayload } from './sessionEndPayload'

/** The payload with the web's back-compat defaults (null → a zero math session). */
export function normalizeSessionEndPayload(
  payload: SessionEndPayload | null,
): SessionEndPayload {
  if (!payload) {
    return {
      totalCorrect: 0,
      totalStardust: 0,
      finalStreak: 0,
      earnedThisSession: 0,
      surface: 'math',
    }
  }
  return { ...payload, surface: payload.surface ?? 'math' }
}

/** Word Song's flat completion bonus, granted at Session End (else 0). */
export function completionBonus(surface: SessionEndSurface): number {
  return surface === 'word-song' ? WORDSONG_SESSION_END_BONUS : 0
}

export interface SessionEndWriteOptions {
  /** Progress clock (honours the debug day offset). */
  clock?: () => Date
  /** Word Song's novel-probe words, for the graduation split (see header). */
  novelProbeWords?: readonly string[]
}

export interface SessionEndResult {
  beat: SessionEndBeat
  guidance: SessionEndGuidance
}

/** The surface is the progress track (identical unions, different domains). */
function trackForSurface(surface: SessionEndSurface): ProgressTrack {
  return surface
}

export function writeSessionEnd(
  payload: SessionEndPayload,
  opts: SessionEndWriteOptions = {},
): SessionEndResult {
  const clock = opts.clock ?? progressNow
  const p = payload
  const dateISO = clock().toISOString()
  if (p.surface === 'word-song') grantWordSongCompletionBonus(undefined, clock)
  recordSessionEnd(p.finalStreak, undefined, clock)

  const before = loadProgress() ?? defaultProgress()
  const track = trackForSurface(p.surface)
  const { node: focusNode, mode: focusMode } =
    p.sessionFocus ?? pickFocusNode(before, track)
  const graduationSplit = computeGraduationSplit(
    before,
    track,
    focusNode,
    p,
    opts.novelProbeWords,
  )
  const leitnerOutcomes =
    p.surface === 'math' &&
    p.mathFacts !== undefined &&
    p.perProblemCorrect !== undefined
      ? buildLeitnerOutcomes(p.mathFacts, p.perProblemCorrect)
      : undefined
  const math = p.surface === 'math'
  const after = recordProgressOnSessionEnd({
    surface: p.surface,
    totalCorrect: p.totalCorrect,
    dateISO,
    focusNode,
    focusMode,
    ...(graduationSplit !== null ? { graduationSplit } : {}),
    ...(leitnerOutcomes !== undefined ? { leitnerOutcomes } : {}),
    ...(math && p.latencyMs !== undefined ? { latencyMs: p.latencyMs } : {}),
    ...(math && p.mathFacts !== undefined ? { mathFacts: p.mathFacts } : {}),
    ...(math && p.subitisingScaffoldRendered === true
      ? { subitisingScaffoldRendered: true }
      : {}),
    ...(math && p.subitisingScaffoldSubRendered === true
      ? { subitisingScaffoldSubRendered: true }
      : {}),
    ...(math && p.perProblemAnswerValue !== undefined
      ? { perProblemAnswerValue: p.perProblemAnswerValue }
      : {}),
    ...(p.surface === 'word-song' && p.perProblemAnswerWord !== undefined
      ? { perProblemAnswerWord: p.perProblemAnswerWord }
      : {}),
    ...(math && p.perProblemDistractorClass !== undefined
      ? { perProblemDistractorClass: p.perProblemDistractorClass }
      : {}),
    ...(p.surface === 'word-song' &&
    focusNode === 'letter-sounds' &&
    p.currentTargetVowel !== undefined
      ? { currentTargetVowel: p.currentTargetVowel }
      : {}),
  })

  const beat = sessionEndBeat(before, after, focusNode)
  const today = localDateKey(clock())
  const guidance = sessionEndGuidance({
    before,
    after,
    node: focusNode,
    ...(p.currentTargetVowel !== undefined
      ? { vowel: p.currentTargetVowel }
      : {}),
    beat,
    totalCorrect: p.totalCorrect,
    today,
    nudgeSaidToday: nudgeSaidToday(track, today),
  })
  if (guidance.lines.some((l) => l.id === 'guide.end.not-yet.again')) {
    markNudgeSaid(track, today)
  }
  return { beat, guidance }
}

/**
 * Word Song graduation split (web `computeGraduationSplit`, ticket
 * 86c9m3aec): only when the engine flagged this session as graduation AND
 * the plan used novel-pool words; else `null`.
 */
export function computeGraduationSplit(
  progress: Progress,
  track: ProgressTrack,
  focusNode: SkillNode,
  payload: SessionEndPayload,
  novelProbeWords: readonly string[] | undefined,
): GraduationSessionSplit | null {
  if (track !== 'word-song' || novelProbeWords === undefined) return null
  const { targetWords, perProblemCorrect } = payload
  if (!targetWords || !perProblemCorrect) return null
  if (targetWords.length !== perProblemCorrect.length) return null
  if (!isGraduationSessionPending(progress, focusNode, track)) return null
  const novel = new Set(novelProbeWords)
  let canonicalCount = 0
  let canonicalCorrect = 0
  let novelCount = 0
  let novelCorrect = 0
  targetWords.forEach((word, i) => {
    const correct = perProblemCorrect[i] === true
    if (novel.has(word)) {
      novelCount += 1
      if (correct) novelCorrect += 1
    } else {
      canonicalCount += 1
      if (correct) canonicalCorrect += 1
    }
  })
  if (novelCount === 0) return null
  return { canonicalCorrect, canonicalCount, novelCorrect, novelCount }
}

/**
 * Math facts zipped with first-tap correctness for the Leitner box (web
 * `buildLeitnerOutcomes`, ticket 86c9pwgc8): the overlapping prefix on a
 * length skew, `undefined` when there is nothing to record.
 */
export function buildLeitnerOutcomes(
  facts: ReadonlyArray<{ a: number; b: number; op: '+' | '-' | '*' }>,
  perProblemCorrect: readonly boolean[],
): LeitnerOutcome[] | undefined {
  const n = Math.min(facts.length, perProblemCorrect.length)
  if (n === 0) return undefined
  return Array.from({ length: n }, (_, i) => ({
    fact: { a: facts[i]!.a, b: facts[i]!.b, op: facts[i]!.op },
    correct: perProblemCorrect[i],
  }))
}
