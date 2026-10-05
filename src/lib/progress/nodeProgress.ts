/**
 * nodeProgress — the one source of truth for what the UI shows about a
 * step: its level, good days toward mastery, the last score and what it
 * unlocks (design/progression-emmas-path.md, "What changes underneath").
 *
 * Pure, and built only from the mastery rule's own helpers in
 * `mastery.ts` (`qualifyingDayCount`, `perVowelTrackingActive`,
 * `graduationGateClears`, `nextNode`, ...), so the display cannot drift
 * from the rule. When the rule changes (cumulative good days, ticket
 * 4/10) only those helpers change; this module follows.
 */

import { LETTER_SOUNDS_VOWELS } from './defaults'
import {
  graduationGateClears,
  isGraduationGated,
  nextNode,
  perVowelTrackingActive,
  qualifiesOverHistory,
  qualifyingDayCount,
  trackOf,
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
   * Good days banked toward mastery under the current rule, 0..requiredDays.
   * A mastered step reports `requiredDays`. For `letter-sounds` while
   * per-vowel tracking is active this is the sum over the four vowels.
   */
  goodDays: number
  requiredDays: number
  /** successRate of the most recent session on this step, or null. */
  lastSuccessRate: number | null
  /** The step this one unlocks when mastered, or null for a tree's last step. */
  unlocksNext: SkillNode | null
  /**
   * Graduation-gated steps (cvc-words): the good days are all banked but
   * the novel-word check (novelPoolSuccessRate >= 0.8) has not cleared yet.
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
            : qualifyingDayCount(vowelHistory, threshold, settings),
        requiredDays: threshold.sessions,
      }
    })
    return {
      level,
      goodDays: vowels.reduce((sum, v) => sum + v.goodDays, 0),
      requiredDays: threshold.sessions * vowels.length,
      lastSuccessRate,
      unlocksNext,
      awaitingNovelWordCheck: false,
      vowels,
    }
  }

  const goodDays =
    level === 'mastered'
      ? threshold.sessions
      : level === 'locked'
        ? 0
        : qualifyingDayCount(focused, threshold, settings)

  const awaitingNovelWordCheck =
    level === 'practicing' &&
    isGraduationGated(node) &&
    qualifiesOverHistory(focused, threshold, settings) &&
    !graduationGateClears(progress.history, node, threshold, settings)

  return {
    level,
    goodDays,
    requiredDays: threshold.sessions,
    lastSuccessRate,
    unlocksNext,
    awaitingNovelWordCheck,
  }
}
