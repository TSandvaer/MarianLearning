/**
 * Progress-history persistence for Session End — adaptive engine plumbing.
 *
 * Ticket: 86c9kmu63 — feat(progress): persist session history to localStorage
 * on session-end.
 *
 * This module is the production write path into the `marian-tutor:progress:v1`
 * blob (see `src/lib/progress/`). The progress model has been fully built and
 * unit-tested for some time; until this ticket the only callers of
 * `saveProgress` lived in tests, so Marian's accumulating learning state was
 * never actually being collected. The adaptive engine (separate ticket Matt is
 * drafting) will read this data — this module just starts collecting it.
 *
 * M3 (ticket 86c9kmwd0) layers the mastery promotion rule on top: after the
 * history-append save lands, `applyMasteryRule()` evaluates the new history
 * and produces an updated `skillLevels` (and possibly `pendingPromotion`) —
 * a second `saveProgress()` lands the post-promotion shape so the next
 * session-start fetch picks up the new focus node.
 *
 * What this DOES NOT do (deferred):
 *   - Touch `mathFactsLeitner` (Leitner update logic deferred — M4).
 *   - Feed Progress into `/api/claude` request payload (M2 owns that
 *     read path; this module is the write path only).
 *
 * Why the call site is here, not App.tsx
 * --------------------------------------
 * `SessionEnd.tsx` already owns one persistence side-effect on mount via
 * `recordSessionEnd` (writing to `marian-tutor.session-history.v1`). Adding a
 * sibling write to a different storage key in the same effect keeps both
 * "session-end persistence" concerns co-located and avoids threading the
 * payload shape through App's route-flip handler. App.tsx already passes the
 * payload to SessionEnd; making SessionEnd own the write is a smaller diff
 * with a stronger separation of concerns.
 *
 * Storage key
 * -----------
 * Writes to `marian-tutor:progress:v1` via the `saveProgress` adapter (which
 * already enforces `MAX_SESSION_HISTORY=30` trimming). This is a different
 * key from `sessionHistory.ts`'s `marian-tutor.session-history.v1` — the two
 * blobs serve different consumers (Hub stats vs adaptive engine) and have
 * different schemas. Co-located write callers, separate storage payloads.
 */

import {
  applyMasteryRule,
  defaultProgress,
  loadProgress,
  saveProgress,
  type Progress,
  type SessionHistoryEntry,
  type SkillNode,
} from '../../lib/progress'
import type { SessionEndSurface } from './SessionEnd'

/**
 * Sessions are always 8 problems. `successRate` is `totalCorrect / 8` as a
 * float in [0, 1] (NOT rounded — adaptive engine wants the precise value).
 */
const PROBLEMS_PER_SESSION = 8

export interface RecordProgressInput {
  /** Discriminant from the Session End payload. */
  surface: SessionEndSurface
  /** 0..8 — number of problems Marian got right this session. */
  totalCorrect: number
  /** ISO 8601 timestamp the session-end CTA fired. Injected for test seam. */
  dateISO: string
  /**
   * The skill node the just-completed session targeted.
   *
   * Audit follow-up to PR #120 (M3 wiring) — P0.2 fix. The earlier shape
   * of this module hardcoded `skillFocus` per `surface` (`['add-to-10']`
   * for math, `['blending-cv']` for word-song). That worked for the very
   * first session but silently broke M3: once `add-to-10` was promoted
   * to `'mastered'` and the planner moved Marian onto `add-to-20`, every
   * subsequent history entry STILL recorded `skillFocus: ['add-to-10']`,
   * so `applyMasteryRule()` saw zero matching entries for `add-to-20`
   * and could never promote it. The promotion chain capped after the
   * first hop.
   *
   * The caller (SessionEnd.tsx) derives this via
   * `pickFocusNode(loadProgress() ?? defaultProgress(), trackForSurface)`
   * at session-end mount — same function the App.tsx fetch effects use
   * at session-start. Because `applyMasteryRule()` only runs at
   * session-end (via this module), `skillLevels` at session-end mount
   * are identical to what they were at session-start, so the derived
   * focus node is exactly the node the planner targeted.
   *
   * Per-problem skillFocus tracking (which nodes did THIS problem
   * touch) is a future M-series concern; this fix gets us "session
   * knows its focus node," not "problems report their nodes."
   */
  focusNode: SkillNode
}

/**
 * Append a `SessionHistoryEntry` to the persisted Progress document and
 * update `profile.lastPlayedISO`. If no document exists yet, seeds a fresh
 * one via `defaultProgress()` (which encodes Marian's diagnostic baseline —
 * see `src/lib/progress/defaults.ts`).
 *
 * Best-effort: storage failures (quota, private mode, missing window) are
 * swallowed by `saveProgress` itself; this function never throws.
 *
 * Idempotent under repeated calls only in the trivial sense — each call
 * appends one entry, so two calls with the same input produce two entries.
 * That matches the `recordSessionEnd` shape next door.
 *
 * Returns the persisted document for tests / future consumers; production
 * callers can ignore the return value.
 */
export function recordProgressOnSessionEnd(
  input: RecordProgressInput,
): Progress {
  const existing = loadProgress() ?? defaultProgress()

  const entry: SessionHistoryEntry = {
    dateISO: input.dateISO,
    skillFocus: [input.focusNode],
    successRate: input.totalCorrect / PROBLEMS_PER_SESSION,
  }

  const next: Progress = {
    ...existing,
    profile: {
      ...existing.profile,
      lastPlayedISO: input.dateISO,
    },
    history: [...existing.history, entry],
  }

  // M3 (ticket 86c9kmwd0): evaluate the mastery promotion rule on the
  // post-append history. The rule is pure and tunable via parentSettings;
  // see `src/lib/progress/mastery.ts`. We collapse the two writes into a
  // single `saveProgress(promoted)` so the persisted blob always reflects
  // the post-promotion shape — there's no observable mid-state in
  // localStorage and no double IO.
  const promoted = applyMasteryRule(next)
  saveProgress(promoted)
  return promoted
}
