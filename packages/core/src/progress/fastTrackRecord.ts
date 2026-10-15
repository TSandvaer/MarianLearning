/**
 * The fast track's session-end writes (native spec
 * `design/native/fast-track-native.md` § 3.2 secure days, § 5 pace guard),
 * called by `recordProgressOnSessionEnd` for a finished forward session.
 * Reviews and Map peeks never reach them (no history, P4 / § 6.5).
 *
 * Pure: a Progress document in, a new one (or the same one) out.
 */
import { isSecureSession, PACE_GUARD_MAX_DAY_SCORE } from './fastTrack'
import { localDayKey, MAX_GOOD_DAYS_PER_STEP } from './mastery'
import type {
  GoodDayKey,
  LetterSoundsVowel,
  Progress,
  SessionHistoryEntry,
  SkillNode,
} from './types'

export interface SecureDayInput {
  focusNode: SkillNode
  /** Letter sounds only: the session's vowel (adds the vowel's key too). */
  currentTargetVowel?: LetterSoundsVowel
  /** The session end (the progress clock). */
  dateISO: string
  /** First-tap correctness of the 8 scored problems (warm-ups left out). */
  firstTapCorrect?: readonly boolean[]
}

/**
 * § 3.2: `existing` — the doc BEFORE this session's history entry — with
 * the session's day unioned into `secureDays` for each of its keys (the
 * focus step, plus the vowel on a tagged letter-sounds session) when the
 * step is not mastered, the session is secure, and no earlier session on
 * that key finished the same local day (P2). Returns `existing` itself when
 * nothing is added.
 */
export function withSecureDay(
  existing: Progress,
  input: SecureDayInput,
): Progress {
  if (existing.skillLevels[input.focusNode] === 'mastered') return existing
  if (!isSecureSession(input.firstTapCorrect)) return existing
  const day = localDayKey(input.dateISO)
  const vowel =
    input.focusNode === 'letter-sounds' ? input.currentTargetVowel : undefined
  const keys: { key: GoodDayKey; vowel: LetterSoundsVowel | null }[] = [
    { key: input.focusNode, vowel: null },
    ...(vowel !== undefined ? [{ key: vowel, vowel }] : []),
  ]
  let secureDays = existing.secureDays
  for (const { key, vowel: keyVowel } of keys) {
    const playedToday = existing.history.some(
      (entry) =>
        entry.skillFocus.includes(input.focusNode) &&
        (keyVowel === null || entry.currentTargetVowel === keyVowel) &&
        localDayKey(entry.dateISO) === day,
    )
    if (playedToday) continue
    const days = secureDays?.[key] ?? []
    if (days.includes(day)) continue
    secureDays = {
      ...secureDays,
      [key]: [...days, day].sort().slice(-MAX_GOOD_DAYS_PER_STEP),
    }
  }
  return secureDays === existing.secureDays
    ? existing
    : { ...existing, secureDays }
}

/**
 * § 5 day scores: per local day she played `node`, the `successRate` of
 * the first session on it that day, oldest day first.
 */
export function dayScores(
  history: readonly SessionHistoryEntry[],
  node: SkillNode,
): { day: string; score: number }[] {
  const focused = history
    .filter((entry) => entry.skillFocus.includes(node))
    .map((entry, i) => ({ entry, i, ms: Date.parse(entry.dateISO) }))
    // Chronological; a malformed timestamp keeps its place.
    .sort((a, b) =>
      Number.isNaN(a.ms) || Number.isNaN(b.ms)
        ? a.i - b.i
        : a.ms - b.ms || a.i - b.i,
    )
  const byDay = new Map<string, number>()
  for (const { entry } of focused) {
    const day = localDayKey(entry.dateISO)
    if (!byDay.has(day)) byDay.set(day, entry.successRate)
  }
  return [...byDay.entries()]
    .map(([day, score]) => ({ day, score }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

/**
 * § 5 trip: after a forward session-end write (`p` = the saved doc), add
 * `node` to `paceHold` when it is not mastered and its two most recent days
 * played both scored ≤ 5/8. Add-only; returns `p` itself when nothing is
 * added.
 */
export function withPaceHold(p: Progress, node: SkillNode): Progress {
  if (p.skillLevels[node] === 'mastered') return p
  if (p.paceHold?.includes(node) === true) return p
  const scores = dayScores(p.history, node)
  if (scores.length < 2) return p
  const lastTwo = scores.slice(-2)
  if (!lastTwo.every((d) => d.score <= PACE_GUARD_MAX_DAY_SCORE)) return p
  return { ...p, paceHold: [...(p.paceHold ?? []), node] }
}
