/**
 * The 2-secure-days fast track (native spec `design/native/fast-track-native.md`
 * §§ 2–3, 5; Dave's consult and re-consult, Thomas 2026-10-14).
 *
 * - A **secure session** is all 8 scored problems right on the FIRST tap,
 *   on any step of either world. Latency is not read (Dave: accuracy
 *   finishes a step; automaticity is review's job).
 * - A **secure day** is a local day on which the first finished session on
 *   a step (on its vowel, for per-vowel letter sounds) was secure; it is
 *   recorded at session end (`fastTrackRecord.ts`) into `Progress.secureDays`.
 * - **Two** secure days on separate days count as all the step's good days
 *   (the floor in `mastery.ts` `goodDayCount`), so the step finishes through
 *   the existing promotion path. No good-day date is invented.
 * - The **pace guard** (§ 5) turns the fast track off for a step on
 *   `Progress.paceHold`. `fastTrackSecureDays` is the one switch: every
 *   mastery call site reads secure days through it.
 *
 * Pure, and import-free apart from types: `mastery.ts` imports this module.
 */
import type { GoodDayKey, Progress, SkillNode } from './types'

/** Secure days on separate days that finish a step (P3). */
export const FAST_TRACK_SECURE_DAYS = 2

/** A session's scored problems (warm-up hearts are never part of it). */
export const SESSION_PROBLEMS = 8

/** Pace guard (§ 5): a day score at or under this (5/8) is a slow day. */
export const PACE_GUARD_MAX_DAY_SCORE = 5 / 8

/** All 8 scored problems right on the first tap. */
export function isSecureSession(
  firstTapCorrect: readonly boolean[] | undefined,
): boolean {
  return (
    firstTapCorrect !== undefined &&
    firstTapCorrect.length === SESSION_PROBLEMS &&
    firstTapCorrect.every((c) => c === true)
  )
}

/** At least `FAST_TRACK_SECURE_DAYS` distinct secure days. */
export function fastTrackQualifies(
  secure: readonly string[] | undefined,
): boolean {
  return secure !== undefined && new Set(secure).size >= FAST_TRACK_SECURE_DAYS
}

/** The step a secure-day key belongs to: a vowel key is letter sounds. */
export function stepOfKey(key: GoodDayKey): SkillNode {
  return key.startsWith('/') ? 'letter-sounds' : (key as SkillNode)
}

/**
 * The secure days the mastery rule may count for `key`: `p.secureDays[key]`,
 * or `undefined` while the key's step is on pace hold and not mastered
 * (§ 5). The fast track's only switch.
 */
export function fastTrackSecureDays(
  p: Progress,
  key: GoodDayKey,
): readonly string[] | undefined {
  const step = stepOfKey(key)
  if (p.paceHold?.includes(step) === true && p.skillLevels[step] !== 'mastered')
    return undefined
  return p.secureDays?.[key]
}
