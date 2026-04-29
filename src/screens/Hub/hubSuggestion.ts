/**
 * Soft-suggestion algorithm for the Hub picker.
 *
 * Source-of-truth: `design/screen-hub.md` § "Soft guided default — Melody's
 * nudge" + § "Suggestion algorithm". Dave's research backing this lives at
 * `design/research/hub-navigation-research-86c9hab6y.md` Q1 (Ryan & Deci
 * SDT, Bao & Lam relational autonomy in elementary children).
 *
 * Locked decisions (Thomas, 2026-04-28):
 *  - 3-consecutive-override cap → 2-day suspension before nudging resumes.
 *  - First-of-day suggests the tree she did less of yesterday by stardust
 *    (we do not have per-tree stardust tracking yet, so v1 falls back to
 *    "alternate from the prior day's suggestion").
 *
 * Pure functions only — `computeSuggestion` and `recordSuggestionOutcome`
 * are deterministic given their inputs. The Hub component holds the
 * `now` clock; tests inject it.
 */

import type {
  SessionHistoryV2,
  SkillTreeId,
} from '../SessionEnd/sessionHistory'

/** How many consecutive overrides trigger the cool-down (Thomas-locked). */
export const SUGGESTION_OVERRIDE_CAP = 3

/** Cool-down duration in milliseconds — 2 days (Thomas-locked). */
export const SUGGESTION_COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000

/** What Hub displays as the soft nudge. `null` ⇒ both nodes equal. */
export type SuggestionTarget = SkillTreeId | null

/**
 * Compute the suggestion to surface on this Hub mount.
 *
 * Inputs:
 *   - `history`: stored session-history (v2). The relevant fields are
 *     `todayTreesTouched`, `lastSuggestion`, `consecutiveOverrides`,
 *     `suggestionCooldownUntil`.
 *   - `now`: clock injection. Used to detect cool-down expiry.
 *
 * Decision tree (in order):
 *   1. If `now` is before `suggestionCooldownUntil` ⇒ return `null`
 *      (suspended; both nodes equal).
 *   2. If today's session has already touched exactly ONE tree, suggest
 *      the OTHER one (variety nudge).
 *   3. If today's session has touched both trees ⇒ return `null`
 *      (her own balance; no nudge).
 *   4. If today's session has touched NEITHER tree (first session of
 *      the day) ⇒ alternate from `lastSuggestion`. If `lastSuggestion`
 *      is null, default to `'word-song'` — Marian's literacy is the
 *      lower-confidence skill per the diagnostic and Hub is a kindly
 *      place to nudge there.
 *
 * Note on stardust-balance tie-break: the spec mentions "by stardust
 * earned yesterday" as an aspirational rule, but `session-history.v2`
 * does not yet persist per-tree stardust. Step 4's alternation is the
 * deterministic operationalisation Thomas approved on 2026-04-28.
 */
export function computeSuggestion(
  history: SessionHistoryV2,
  now: Date,
): SuggestionTarget {
  // Rule 1 — cool-down still in effect.
  if (
    history.suggestionCooldownUntil !== null &&
    now.getTime() < history.suggestionCooldownUntil
  ) {
    return null
  }

  // What did Marian touch today? (Stale entries — different ISO date —
  // are treated as "neither touched today".)
  const today = isoDateLocal(now)
  const touchedToday =
    history.todayTreesTouched.date === today
      ? history.todayTreesTouched.trees
      : []

  const touchedSet = new Set(touchedToday)
  const touchedNumber = touchedSet.has('number-garden')
  const touchedWord = touchedSet.has('word-song')

  // Rule 3 — both touched, no nudge.
  if (touchedNumber && touchedWord) return null

  // Rule 2 — one touched, suggest the other.
  if (touchedNumber) return 'word-song'
  if (touchedWord) return 'number-garden'

  // Rule 4 — neither touched today (first session). Alternate from
  // `lastSuggestion` if set; otherwise default to 'word-song'.
  if (history.lastSuggestion === 'word-song') return 'number-garden'
  if (history.lastSuggestion === 'number-garden') return 'word-song'
  return 'word-song'
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
 * Compute the next suggestion-state given a node tap.
 *
 * Inputs:
 *   - `prev`: prior session-history.
 *   - `currentSuggestion`: what Hub showed as the nudge (output of
 *     `computeSuggestion`).
 *   - `picked`: which tree Marian actually tapped.
 *   - `now`: clock injection.
 *
 * Behaviour:
 *  - If the tap matched the suggestion (or there was no suggestion to
 *    override): reset `consecutiveOverrides` to 0; clear any cool-down;
 *    record `lastSuggestion = currentSuggestion ?? prev.lastSuggestion`.
 *  - If the tap was an override (suggestion was non-null and `picked`
 *    differs from it): bump `consecutiveOverrides` by 1. If the bumped
 *    count hits `SUGGESTION_OVERRIDE_CAP`, set
 *    `suggestionCooldownUntil = now + SUGGESTION_COOLDOWN_MS` and reset
 *    `consecutiveOverrides` to 0 (the cool-down is the response; we
 *    don't keep climbing). `lastSuggestion` stays at the original
 *    suggestion (we want next time's nudge to alternate against the
 *    same direction she rejected).
 *
 * Why reset on cap rather than "stay at 3 forever": the cap is a
 * cool-off trigger, not a persistent flag. After the 2-day suspension,
 * the algorithm starts fresh — if she keeps rejecting in the same
 * direction post-cooldown, the cap fires again. This matches the
 * spec's "suspend again" wording.
 */
export function recordSuggestionOutcome(
  prev: SessionHistoryV2,
  currentSuggestion: SuggestionTarget,
  picked: SkillTreeId,
  now: Date,
): SuggestionOutcomePatch {
  const matched = currentSuggestion === null || currentSuggestion === picked

  if (matched) {
    return {
      lastSuggestion: currentSuggestion ?? prev.lastSuggestion,
      consecutiveOverrides: 0,
      suggestionCooldownUntil: null,
    }
  }

  // Override path.
  const bumped = prev.consecutiveOverrides + 1
  if (bumped >= SUGGESTION_OVERRIDE_CAP) {
    return {
      lastSuggestion: currentSuggestion,
      consecutiveOverrides: 0,
      suggestionCooldownUntil: now.getTime() + SUGGESTION_COOLDOWN_MS,
    }
  }
  return {
    lastSuggestion: currentSuggestion,
    consecutiveOverrides: bumped,
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
