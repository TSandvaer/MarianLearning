/**
 * nodeProgress — the one source of truth for what the UI shows about a
 * step: its level, good days toward mastery, the last score and what it
 * unlocks (design/progression-emmas-path.md, "What changes underneath").
 *
 * Pure, and built only from the mastery rule's own helpers in
 * `mastery.ts` (`goodDayCount`, `perVowelTrackingActive`,
 * `graduationGateClears`, `nextNode`, ...), so the display cannot drift
 * from the rule. Good days come from the cumulative `progress.goodDays`
 * counter plus whatever `history` shows (ticket 123jpnbc3dm), exactly
 * as `applyMasteryRule` counts them, floored by the fast track's secure
 * days (native spec `design/native/fast-track-native.md` § 3.4: a
 * fast-tracked step not yet mastered reports `goodDays === requiredDays`).
 *
 * Check fold-in (Dave 2026-10-25 (4)): a graduation-gated step SHOWS
 * `mastered ? N : passed ? min(good, N) : min(good, N - 1)`, so its row
 * holds the last flower until the check passes and a full row always means
 * the step opens. A row the migration marker kept full
 * (`Progress.keptFullRows`) shows as before.
 */

import { LETTER_SOUNDS_VOWELS } from './defaults'
import { fastTrackSecureDays } from './fastTrack'
import {
  goodDayCount,
  graduationGateClears,
  isGraduationGated,
  nextNode,
  perVowelTrackingActive,
  trackOf,
  WORD_SONG_GRADUATION_GATED_NODES,
} from './mastery'
import { getSettings } from './parentSettings'
import type {
  LetterSoundsVowel,
  Progress,
  SkillLevel,
  SkillNode,
  VowelSubMasteryState,
} from './types'

export interface VowelProgress {
  vowel: LetterSoundsVowel
  state: VowelSubMasteryState
  goodDays: number
  requiredDays: number
}

export interface NodeProgress {
  level: SkillLevel
  /**
   * Good days SHOWN toward mastery under the current rule, 0..requiredDays:
   * the banked ones, less a flower held for the graduation check
   * (`flowerHeld`). A mastered step reports `requiredDays`. For
   * `letter-sounds` while per-vowel tracking is active this is the sum
   * over the four vowels.
   */
  goodDays: number
  /**
   * Graduation-gated steps: a banked good day the row does not show,
   * because the check has not passed (its last flower is held).
   */
  flowerHeld: boolean
  requiredDays: number
  /** successRate of the most recent session on this step, or null. */
  lastSuccessRate: number | null
  /** The step this one unlocks when mastered, or null for a tree's last step. */
  unlocksNext: SkillNode | null
  /**
   * Graduation-gated steps (cvc-words): the row shows all but its last
   * flower and the check has not passed, so one more flower opens the
   * path (the map's nearly-there stop, the Hub's "One more flower").
   */
  awaitingNovelWordCheck: boolean
  /** Per-vowel sub-steps; present only for `letter-sounds` while per-vowel tracking is active. */
  vowels?: VowelProgress[]
}

export function nodeProgress(
  progress: Progress,
  node: SkillNode,
): NodeProgress {
  const track = trackOf(node)
  if (track === null) {
    throw new Error(`SkillNode '${node}' is not in a mastery tree`)
  }
  const settings = getSettings(progress)
  const threshold = settings.masteryThreshold[track]
  const level = progress.skillLevels[node]
  const focused = progress.history.filter((entry) =>
    entry.skillFocus.includes(node),
  )
  const lastSuccessRate =
    focused.length > 0 ? focused[focused.length - 1]!.successRate : null
  const unlocksNext = nextNode(track, node)

  const vowelStates = progress.literacy?.letterSoundsVowelStates
  if (
    node === 'letter-sounds' &&
    vowelStates !== undefined &&
    perVowelTrackingActive(progress)
  ) {
    const vowels = LETTER_SOUNDS_VOWELS.map((vowel): VowelProgress => {
      const state = vowelStates[vowel]
      const vowelHistory = focused.filter(
        (entry) => entry.currentTargetVowel === vowel,
      )
      return {
        vowel,
        state,
        goodDays:
          state === 'mastered' || level === 'mastered'
            ? threshold.sessions
            : Math.min(
                threshold.sessions,
                goodDayCount(
                  vowelHistory,
                  threshold,
                  settings,
                  progress.goodDays?.[vowel],
                  fastTrackSecureDays(progress, vowel),
                ),
              ),
        requiredDays: threshold.sessions,
      }
    })
    return {
      level,
      goodDays: vowels.reduce((sum, v) => sum + v.goodDays, 0),
      requiredDays: threshold.sessions * vowels.length,
      flowerHeld: false,
      lastSuccessRate,
      unlocksNext,
      awaitingNovelWordCheck: false,
      vowels,
    }
  }

  const bankedDays = bankedGoodDays(progress, node)
  // The check's hold (fold-in (4)): a gated step being worked on whose
  // check has not passed shows at most N - 1 flowers.
  const holdsLast =
    (level === 'intro' || level === 'practicing') &&
    isGraduationGated(node) &&
    !graduationGateClears(progress.history, node) &&
    !(progress.keptFullRows ?? []).includes(node)
  const shownMax = holdsLast ? threshold.sessions - 1 : threshold.sessions
  const goodDays =
    level === 'mastered'
      ? threshold.sessions
      : level === 'locked'
        ? 0
        : Math.min(shownMax, bankedDays)

  return {
    level,
    goodDays,
    flowerHeld: holdsLast && bankedDays > shownMax,
    requiredDays: threshold.sessions,
    lastSuccessRate,
    unlocksNext,
    awaitingNovelWordCheck: holdsLast && goodDays === shownMax,
  }
}

/** `node`'s good days as the mastery rule counts them (uncapped). */
function bankedGoodDays(progress: Progress, node: SkillNode): number {
  const track = trackOf(node)!
  const settings = getSettings(progress)
  return goodDayCount(
    progress.history.filter((entry) => entry.skillFocus.includes(node)),
    settings.masteryThreshold[track],
    settings,
    progress.goodDays?.[node],
    fastTrackSecureDays(progress, node),
  )
}

/**
 * The migration marker's value for a doc this build has not loaded yet
 * (`Progress.keptFullRows`, Dave 2026-10-25 (4b)): the graduation-gated
 * steps being worked on whose row the build before the fold-in showed full
 * (good days >= N) with the check not passed. Their row stays full: never
 * take a flower from a child.
 */
export function keptFullRowsOf(progress: Progress): SkillNode[] {
  return WORD_SONG_GRADUATION_GATED_NODES.filter((node) => {
    const level = progress.skillLevels[node]
    if (level !== 'intro' && level !== 'practicing') return false
    const required =
      getSettings(progress).masteryThreshold[trackOf(node)!].sessions
    return (
      bankedGoodDays(progress, node) >= required &&
      !graduationGateClears(progress.history, node)
    )
  })
}
