/**
 * Word-song completion-contingent stardust bonus.
 *
 * Spec
 * ----
 * Ticket 86c9kwvza (locked by Thomas 2026-05-02). Dave's audit recommended
 * switching word-song stardust from per-correct-tap to per-session-end. The
 * reasoning is grounded in Deci, Koestner & Ryan (1999) — performance-
 * contingent rewards undermine intrinsic motivation on tasks that are
 * intrinsically interesting. Word-learning at age 8 (and especially for
 * Marian, an L2 English learner) is intrinsically interesting; coupling
 * each correct chip-tap to a stardust grant trains the wrong loop.
 *
 * Math is unchanged. Drilled fact-recall on Math is the goal — automaticity
 * benefits from per-correct reinforcement, and the Deci result does not
 * apply to that class of task.
 *
 * Shape of the change
 * -------------------
 * - WordSong no longer calls `grantStardust(...)` per correct chip-tap.
 *   Sensory rewards (sparkle, plink, celebration tilt, streak band) all
 *   stay; they are not points-rewards.
 * - At session-end, a flat bonus (`WORDSONG_SESSION_END_BONUS = 5`) lands
 *   in the shared stardust store. The bonus is fixed — independent of how
 *   many problems Marian got right.
 * - Pre-existing day-streak / cross-session bonuses (handled elsewhere)
 *   layer on top, untouched by this module.
 *
 * Why a flat 5
 * ------------
 * A constant decouples the reward from per-session performance, which is
 * the whole point. 5 is on the same order as Math's per-session yield (8
 * correct + a couple streak bonuses → 8-11 stardust per session) so the
 * two screens stay broadly comparable in pace of total stardust
 * accumulation across mixed sessions.
 */

import {
  loadStardust,
  writeStardust,
  type StardustState,
  type StorageAdapter,
} from './stardust'

/** Fixed stardust grant for finishing a word-song session. */
export const WORDSONG_SESSION_END_BONUS = 5 as const

/**
 * Add the completion bonus to the persisted stardust total.
 *
 * Pure over the injected `StorageAdapter` + clock. Returns the new
 * `StardustState` so callers (SessionEnd) can immediately reflect the
 * grant in their UI without an extra `loadStardust` round-trip.
 *
 * Best-effort: storage failures are swallowed by `writeStardust` itself
 * (logged once). This function never throws.
 */
export function grantWordSongCompletionBonus(
  storage?: StorageAdapter,
  now: () => Date = () => new Date(),
): StardustState {
  const before = loadStardust(storage)
  return writeStardust(
    before.total + WORDSONG_SESSION_END_BONUS,
    storage,
    now,
  )
}
