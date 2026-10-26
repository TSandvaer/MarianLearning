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
 * Native (spec `design/native/review-mode-and-warmup-native.md` § 7.5): a
 * same-day review (`payload.review`) runs `recordSessionEnd`, then core's
 * `recordReviewOnSessionEnd` (Leitner + `lastPlayedISO`, no history entry),
 * then the guidance for the world's current step, which is the practice
 * day; no Word Song +5. A forward session with a warm-up records the
 * warm-up's Leitner outcomes first and leaves out any scored problem whose
 * fact the warm-up already recorded (one outcome per fact per session).
 *
 * The Word Song graduation split needs the probe words. The planner's
 * copy lives in the server's `api/` (outside what Metro bundles), so the
 * split reads core's `GRADUATION_PROBE_WORDS`: `NOVEL_PROBE_WORDS`, pinned
 * to the planner's by the web suite (`wordRoundParity.test.tsx`), and the
 * reserve's words (Dave 2026-10-24), which the app's check serves. With
 * the reserve check on (`RESERVE_CHECK_READY`) the split is one session of
 * a two-session check; either way it carries each probe word's first tap
 * for the seen-record.
 */
import { currentStepOf } from '@marian/core/hub/hubCardModel'
import { localDateKey, now as progressNow } from '@marian/core/progress/clock'
import {
  isGraduationSessionPending,
  loadProgress,
  pickFocusNode,
  type Progress,
  type ProgressTrack,
  type SkillNode,
} from '@marian/core/progress'
import { startProgressForActive } from '@marian/core/learners'
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
  recordReviewOnSessionEnd,
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
import { GRADUATION_PROBE_WORDS } from '@marian/core/wordSong/novelProbeWords'
import { RESERVE_CHECK_READY } from './graduationCheck'
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
  /** Word Song's probe words (default: core's), for the graduation split. */
  novelProbeWords?: readonly string[]
  /** The reserve check is on (default: this build's `RESERVE_CHECK_READY`). */
  reserveCheck?: boolean
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
  if (p.review === true) return writeReviewEnd(p, clock)
  const dateISO = clock().toISOString()
  if (p.surface === 'word-song') grantWordSongCompletionBonus(undefined, clock)
  recordSessionEnd(p.finalStreak, undefined, clock)

  const before = loadProgress() ?? startProgressForActive()
  const track = trackForSurface(p.surface)
  const { node: focusNode, mode: focusMode } =
    p.sessionFocus ?? pickFocusNode(before, track)
  const graduationSplit = computeGraduationSplit(
    before,
    track,
    focusNode,
    p,
    opts.novelProbeWords ?? GRADUATION_PROBE_WORDS,
    opts.reserveCheck ?? RESERVE_CHECK_READY,
  )
  const leitnerOutcomes =
    p.surface === 'math' ? forwardLeitnerOutcomes(p) : undefined
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
    // The step's next session reads this one's P1 and order (Dave
    // 2026-10-25, 5b ruling (6g)).
    ...(p.surface === 'word-song' && p.targetWords !== undefined
      ? { targetWords: p.targetWords }
      : {}),
    ...(math && p.perProblemDistractorClass !== undefined
      ? { perProblemDistractorClass: p.perProblemDistractorClass }
      : {}),
    ...(p.surface === 'word-song' &&
    focusNode === 'letter-sounds' &&
    p.currentTargetVowel !== undefined
      ? { currentTargetVowel: p.currentTargetVowel }
      : {}),
    // Fast track (spec § 3.2): the secure-day rule reads the first taps.
    ...(p.firstTapCorrect !== undefined
      ? { firstTapCorrect: p.firstTapCorrect }
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

/** A review's end: no history, the practice day of the current step. */
function writeReviewEnd(
  p: SessionEndPayload,
  clock: () => Date,
): SessionEndResult {
  const dateISO = clock().toISOString()
  recordSessionEnd(p.finalStreak, undefined, clock)
  const before = loadProgress() ?? startProgressForActive()
  const track = trackForSurface(p.surface)
  const leitnerOutcomes =
    p.surface === 'math' &&
    p.problemFacts !== undefined &&
    p.perProblemCorrect !== undefined
      ? factOutcomes(p.problemFacts, p.perProblemCorrect)
      : []
  const after = recordReviewOnSessionEnd({
    surface: p.surface,
    dateISO,
    ...(leitnerOutcomes.length > 0 ? { leitnerOutcomes } : {}),
  })
  const node = currentStepOf(before, track)
  const beat = sessionEndBeat(before, after, node)
  const today = localDateKey(clock())
  const guidance = sessionEndGuidance({
    before,
    after,
    node,
    beat,
    totalCorrect: p.totalCorrect,
    today,
    nudgeSaidToday: nudgeSaidToday(track, today),
  })
  // A review that crossed midnight gets the not-yet day, and its nudge.
  if (guidance.lines.some((l) => l.id === 'guide.end.not-yet.again')) {
    markNudgeSaid(track, today)
  }
  return { beat, guidance }
}

type Fact = { a: number; b: number; op: '+' | '-' | '*' }
const factKey = (f: Fact) => `${f.a}${f.op}${f.b}`

/** Facts zipped with first-tap correctness, problems without a fact left out. */
function factOutcomes(
  facts: ReadonlyArray<Fact | null>,
  correct: readonly boolean[],
): LeitnerOutcome[] {
  const n = Math.min(facts.length, correct.length)
  const out: LeitnerOutcome[] = []
  for (let i = 0; i < n; i++) {
    const f = facts[i]
    if (f) out.push({ fact: { a: f.a, b: f.b, op: f.op }, correct: correct[i] })
  }
  return out
}

/**
 * A forward math session's Leitner outcomes: the warm-up's (non-fact
 * problems left out), then the scored ones, one outcome per fact from its
 * first occurrence. A scored problem whose fact the warm-up already
 * recorded came after priming, so only the warm-up's first tap counts
 * (§ 7.4, Dave 2026-10-14); the same holds for a fact two scored problems
 * share (`7 + 3` and `7 + ? = 10` are one bond, content wave 1 § 1.7).
 * `undefined` when there is nothing to record.
 */
export function forwardLeitnerOutcomes(
  p: SessionEndPayload,
): LeitnerOutcome[] | undefined {
  const warmup =
    p.warmupFacts !== undefined && p.warmupCorrect !== undefined
      ? factOutcomes(p.warmupFacts, p.warmupCorrect)
      : []
  const scored =
    p.mathFacts !== undefined && p.perProblemCorrect !== undefined
      ? (buildLeitnerOutcomes(p.mathFacts, p.perProblemCorrect) ?? [])
      : []
  const seen = new Set<string>()
  const out = [...warmup, ...scored].filter((o) => {
    const key = factKey(o.fact)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return out.length > 0 ? out : undefined
}

/**
 * How a check scores its probe words: the one switch (Dave 2026-10-24,
 * run run_3d3d82fb3b65 message msg_a4e2ea6ad291).
 *
 * - `'first-tap'` (the ruling): a probe word is right only when her first
 *   tap was (`firstTapCorrect`, WordSong's scored problems). A session
 *   without first taps is no check session (no fall-back). At 5 of 6, a
 *   90% decoder passes 0.89 and a pure guesser 0.018.
 * - `'any-tap'` (before the ruling): `perProblemCorrect`, right unless Emma
 *   gave the answer at the 3rd wrong tap, so a child who taps each chip
 *   once always passes.
 *
 * The practised words keep `perProblemCorrect` either way (the canonical
 * slice and its 90% rule), as do regular sessions and the 90/3 score.
 */
export type ProbeScoring = 'first-tap' | 'any-tap'
export const PROBE_SCORING: ProbeScoring = 'first-tap'

/**
 * Word Song graduation split (web `computeGraduationSplit`, ticket
 * 86c9m3aec): only when the engine flagged this session as graduation AND
 * the plan used novel-pool words; else `null`. The probe words score by
 * `scoring` ({@link PROBE_SCORING}), the practised ones by
 * `perProblemCorrect`. It carries each probe word's score for the
 * seen-record and, with `twoSessions` (the reserve check), marks the
 * session as one of a two-session check (core `progressHistory.ts`).
 */
export function computeGraduationSplit(
  progress: Progress,
  track: ProgressTrack,
  focusNode: SkillNode,
  payload: SessionEndPayload,
  novelProbeWords: readonly string[] | undefined,
  twoSessions = false,
  scoring: ProbeScoring = PROBE_SCORING,
): GraduationSessionSplit | null {
  if (track !== 'word-song' || novelProbeWords === undefined) return null
  const { targetWords, perProblemCorrect } = payload
  if (!targetWords || !perProblemCorrect) return null
  if (targetWords.length !== perProblemCorrect.length) return null
  const probeScores =
    scoring === 'first-tap' ? payload.firstTapCorrect : perProblemCorrect
  if (!probeScores || probeScores.length !== targetWords.length) return null
  if (!isGraduationSessionPending(progress, focusNode, track)) return null
  const novel = new Set(novelProbeWords)
  let canonicalCount = 0
  let canonicalCorrect = 0
  let novelCount = 0
  let novelCorrect = 0
  const probes: { word: string; correct: boolean }[] = []
  targetWords.forEach((word, i) => {
    if (novel.has(word)) {
      const correct = probeScores[i] === true
      novelCount += 1
      if (correct) novelCorrect += 1
      probes.push({ word, correct })
    } else {
      canonicalCount += 1
      if (perProblemCorrect[i] === true) canonicalCorrect += 1
    }
  })
  if (novelCount === 0) return null
  return {
    canonicalCorrect,
    canonicalCount,
    novelCorrect,
    novelCount,
    probes,
    ...(twoSessions ? { twoSessions: true } : {}),
  }
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
