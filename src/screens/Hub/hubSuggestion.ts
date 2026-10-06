/**
 * Soft-suggestion algorithm for the Hub picker.
 *
 * Guidance G1 (ClickUp 123jpnbca4r, team/DECISIONS.md 2026-10-06
 * "Guidance layer approved"): Emma names ONE next action and that card
 * glows. The rule lives in `hubGuidance.ts` (`suggestWorld`); this
 * module adapts it to the stored session history, which only keeps
 * `lastSuggestion` for the tie-break. The 2026-04-28 override cool-down
 * is retired: the suggestion is now a fact about today's flowers, not a
 * nudge to back off from.
 */

import type {
  SessionHistoryV2,
  SkillTreeId,
} from '../SessionEnd/sessionHistory'
import { loadProgress, type Progress } from '../../lib/progress'
import { buildHubCardModel } from './hubCardModel'
import { suggestWorld } from './hubGuidance'

/** What Hub displays as the soft nudge. `null` ⇒ both nodes equal. */
export type SuggestionTarget = SkillTreeId | null

/**
 * Compute the suggestion to surface on this Hub mount (Guidance G1,
 * ClickUp 123jpnbca4r — replaces the 2026-04-28 variety nudge and its
 * override cool-down): the world that can still earn today's flower,
 * the one closer to its unlock first, alternating from
 * `history.lastSuggestion` on a tie; `null` when both worlds already
 * have today's flower. See `suggestWorld` in `hubGuidance.ts`.
 *
 * `progress` defaults to the stored doc so App's session prefetch
 * (`hubSessionPrefetch.ts`, which calls this with history + clock only)
 * keeps prefetching the world the Hub glows.
 */
export function computeSuggestion(
  history: SessionHistoryV2,
  now: Date,
  progress: Progress | null = safeLoadProgress(),
): SuggestionTarget {
  const today = isoDateLocal(now)
  return suggestWorld(
    buildHubCardModel(progress, 'math', today),
    buildHubCardModel(progress, 'word-song', today),
    history.lastSuggestion,
  )
}

function safeLoadProgress(): Progress | null {
  try {
    return loadProgress()
  } catch {
    return null
  }
}

/**
 * Result of `recordSuggestionOutcome`. The Hub commits the partial
 * patch to `session-history.v2` after the user picks a tree.
 */
export interface SuggestionOutcomePatch {
  lastSuggestion: SuggestionTarget
  consecutiveOverrides: number
  suggestionCooldownUntil: number | null
}

/**
 * The history patch for a card tap: remember the suggestion she was
 * shown (the tie-break alternates from it) and clear the retired
 * override counters.
 */
export function recordSuggestionOutcome(
  prev: SessionHistoryV2,
  currentSuggestion: SuggestionTarget,
): SuggestionOutcomePatch {
  return {
    lastSuggestion: currentSuggestion ?? prev.lastSuggestion,
    consecutiveOverrides: 0,
    suggestionCooldownUntil: null,
  }
}

/**
 * Internal: ISO yyyy-mm-dd in local time. Mirror of
 * `sessionHistory.isoDate`; duplicated here so this module is
 * self-contained for downstream tests.
 */
function isoDateLocal(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
