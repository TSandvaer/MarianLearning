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
  addItem,
  defaultProgress,
  demote,
  getOrCreateDeviceId,
  loadProgress,
  markFirstEncounterSeen,
  promote,
  pushProgressToCloud,
  saveProgress,
  WORD_SONG_NODES_IN_ORDER,
  type LeitnerBox,
  type MathFact,
  type Progress,
  type SessionHistoryEntry,
  type SkillNode,
  type WordSongNode,
} from '../../lib/progress'
import {
  SCAFFOLD_FOCUS_NODE,
  bumpSubitisingScaffoldSessionsObserved,
} from '../Math/subitisingScaffold'
import type { SessionEndSurface } from './SessionEnd'

/**
 * Sessions are always 8 problems. `successRate` is `totalCorrect / 8` as a
 * float in [0, 1] (NOT rounded — adaptive engine wants the precise value).
 */
const PROBLEMS_PER_SESSION = 8

/**
 * Split-pool result for a graduation session (ticket 86c9m3aec).
 *
 * When the just-completed session was a graduation run for cvc-words,
 * the planner mixed 2–3 novel short-a probe words into the 8-problem
 * set. The mastery engine evaluates two gates separately: the
 * canonical pool against the standard 90/3 rule, and the novel pool
 * against `NOVEL_POOL_THRESHOLD`. The caller (SessionEnd.tsx)
 * computes this shape from the per-problem outcomes + the rehydrated
 * plan and passes it through to `recordProgressOnSessionEnd`.
 *
 * Counts are independent because the planner picks 5–6 canonical + 2–3
 * novel; the totals must add to 8 but the split is not fixed.
 */
export interface GraduationSessionSplit {
  /** Number of canonical-pool problems Marian got right this session. */
  canonicalCorrect: number
  /** Number of canonical-pool problems in the session (5 or 6). */
  canonicalCount: number
  /** Number of novel-pool problems Marian got right this session. */
  novelCorrect: number
  /** Number of novel-pool problems in the session (2 or 3). */
  novelCount: number
}

/**
 * Per-problem Leitner outcome (ticket 86c9pwgc8 — M4). The math
 * surface ships one entry per problem; the array length equals the
 * number of problems Marian saw (8 in v1).
 *
 * - `fact` is the math fact (addends + operator) the problem
 *   targeted, used as the Leitner-box key.
 * - `correct` is Marian's FIRST-tap correctness on that problem.
 *   `true` promotes the fact one box (cap 5); `false` demotes to
 *   box 1; `undefined` adds the fact at box 1 if missing but leaves
 *   any existing rank unchanged (sentinel for "not measured", e.g.
 *   the screen was abandoned before the chip was tapped).
 */
export interface LeitnerOutcome {
  fact: MathFact
  correct: boolean | undefined
}

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
  /**
   * Graduation-session split (ticket 86c9m3aec). Present ONLY when
   * the just-completed session was a graduation run for cvc-words —
   * the caller decides this by reading
   * `isGraduationSessionPending(loadProgress(), focusNode, track)`
   * BEFORE recording the new entry.
   *
   * When supplied AND both counts are positive:
   *  - The recorded entry's `successRate` becomes
   *    `canonicalCorrect / canonicalCount` (canonical-pool only) so
   *    the existing 90/3 rule continues to gate on canonical accuracy
   *    per PR #127.
   *  - The recorded entry gains a `novelPoolSuccessRate` field equal
   *    to `novelCorrect / novelCount`, which the mastery engine reads
   *    as the second gate at `NOVEL_POOL_THRESHOLD`.
   *
   * When omitted (or one of the counts is 0): the recorded entry uses
   * the legacy `totalCorrect / 8` semantics and no
   * `novelPoolSuccessRate` field is attached — exactly the
   * pre-86c9m3aec shape. Defensive zero-handling protects against an
   * upstream bug computing a 0-count slice.
   */
  graduationSplit?: GraduationSessionSplit
  /**
   * Per-problem Leitner outcomes (ticket 86c9pwgc8 — M4). Math only.
   * When supplied AND `surface === 'math'`, the writer:
   *   - Promotes / demotes each fact in `progress.mathFactsLeitner`
   *     per its first-tap correctness (Leitner classical rule).
   *   - Adds new facts at box 1 so the box self-populates over a
   *     handful of sessions (per Q1 — accept 2-3 seed sessions
   *     instead of retroactively populating from history).
   *
   * When absent, the box is unchanged. Word-song sessions have no
   * Leitner box in v1 and should not ship this field.
   */
  leitnerOutcomes?: readonly LeitnerOutcome[]
  /**
   * Per-problem first-tap latency in milliseconds (ticket 86c9pwgc8
   * — M4). Indexed 0..N-1; sentinel `-1` means the problem was never
   * tapped. When supplied, persists onto the recorded
   * `SessionHistoryEntry.latencyMs` field for future "slow facts"
   * surfacing work. Length must match the session's problem count
   * (8 in v1) — the writer makes a defensive copy and trusts the
   * caller's framing.
   */
  latencyMs?: readonly number[]
  /**
   * Per-problem math fact (M4.x slow-fact directive — follow-up to
   * 86c9pwgc8). Math only; word-song doesn't ship this. When supplied,
   * persists onto the recorded `SessionHistoryEntry.mathFacts` field
   * so the slow-fact session-gen hint can join `latencyMs[i]` to a
   * concrete fact key without re-deriving from the audio plan.
   *
   * Defensive copy at write time (shallow per-element); writer trusts
   * the caller's framing on length / contents.
   */
  mathFacts?: readonly { a: number; b: number; op: '+' | '-' | '*' }[]
  /**
   * Whether the subitising scaffold (dot-card overlay) rendered on
   * the just-completed session (ticket 86c9ur1zr §2.2). Math-surface
   * only; word-song doesn't ship this.
   *
   * When `true` AND `surface === 'math'` AND
   * `focusNode === SCAFFOLD_FOCUS_NODE` ('add-to-10'), the writer
   * bumps `profile.subitisingScaffoldSessionsObserved` by 1 (capped
   * at `SCAFFOLD_SESSIONS_OBSERVED_CAP`). When `false` / absent, the
   * counter is unchanged.
   *
   * The counter measures EXPOSURE TO THE SCAFFOLD, not eligibility —
   * a math session on `add-to-10` where every problem happened to
   * land out-of-scope (all addends > 5) would emit `false` and
   * leave the counter unchanged. Spec §2.2.
   */
  subitisingScaffoldRendered?: boolean
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

  const entry = buildEntry(input)

  // M4 Leitner update (ticket 86c9pwgc8). Math-surface sessions that
  // ship per-problem outcomes get their facts promoted / demoted.
  // Other surfaces (word-song) and math sessions without outcomes
  // (legacy / test fixtures) leave the box unchanged.
  const nextLeitner =
    input.surface === 'math' && input.leitnerOutcomes !== undefined
      ? applyLeitnerOutcomes(
          existing.mathFactsLeitner,
          input.leitnerOutcomes,
          new Date(input.dateISO).getTime(),
        )
      : existing.mathFactsLeitner

  // Subitising scaffold counter (ticket 86c9ur1zr §2.2). Bump
  // profile.subitisingScaffoldSessionsObserved by 1 if (a) the
  // surface is math, (b) the focus node is the scaffold's target
  // (add-to-10), AND (c) the screen reported that the overlay
  // actually rendered for at least one problem this session. Capped
  // at SCAFFOLD_SESSIONS_OBSERVED_CAP (4); the bump helper handles
  // the cap + defensive defaulting of malformed inputs.
  //
  // Why all three conditions: the counter measures EXPOSURE TO THE
  // SCAFFOLD, not exposure to the tier (Marian has run dozens of
  // add-to-10 sessions before this ships) and not eligibility (a
  // math session with all out-of-scope problems didn't actually
  // surface the affordance). Spec §2.2.
  const nextScaffoldCounter =
    input.surface === 'math' &&
    input.focusNode === SCAFFOLD_FOCUS_NODE &&
    input.subitisingScaffoldRendered === true
      ? bumpSubitisingScaffoldSessionsObserved(
          existing.profile.subitisingScaffoldSessionsObserved,
        )
      : existing.profile.subitisingScaffoldSessionsObserved

  const next: Progress = {
    ...existing,
    profile: {
      ...existing.profile,
      lastPlayedISO: input.dateISO,
      // Carry the post-bump counter forward. When unchanged, this
      // assigns the same value (or undefined) the spread already
      // carried — no observable behaviour change for non-scaffold
      // sessions. For scaffold sessions, the bumped value lands.
      subitisingScaffoldSessionsObserved: nextScaffoldCounter,
    },
    history: [...existing.history, entry],
    mathFactsLeitner: nextLeitner,
  }

  // 86c9q9ben (AC9f): mark the just-completed session's focus node as
  // encountered. The session-start gate read this flag BEFORE this
  // session ran (the contrast / scaffolding line fired iff the node
  // was NOT in the list at that point). Now that the session has
  // finished, append so the NEXT session-start ships the updated
  // list and the gate substitutes vanilla "You did it!".
  //
  // Idempotent: append-only when not already present. Word-song nodes
  // only — math has no first-encounter scaffolding today and the
  // type narrows enforce it. Non-word-song focus (math surface) is a
  // no-op pass-through.
  const withFirstEncounter = isWordSongNode(input.focusNode)
    ? markFirstEncounterSeen(next, input.focusNode)
    : next

  // M3 (ticket 86c9kmwd0): evaluate the mastery promotion rule on the
  // post-append history. The rule is pure and tunable via parentSettings;
  // see `src/lib/progress/mastery.ts`. We collapse the two writes into a
  // single `saveProgress(promoted)` so the persisted blob always reflects
  // the post-promotion shape — there's no observable mid-state in
  // localStorage and no double IO.
  const promoted = applyMasteryRule(withFirstEncounter)
  saveProgress(promoted)

  // T2 cloud-sync (ticket 86c9pkfyu) — fire-and-forget POST so a future
  // iPad-loss / app-deletion / restore-from-device-id flow can recover
  // Marian's progress. localStorage stays the source of truth; the
  // cloud is a backup. The call NEVER blocks the session-end choreography
  // (the promise is intentionally not awaited) and NEVER throws — see
  // `pushProgressToCloud`'s contract. Failures land as `console.warn`
  // only.
  void pushProgressToCloud(getOrCreateDeviceId(), promoted)

  return promoted
}

/**
 * Construct the SessionHistoryEntry from the input shape, branching on
 * whether a graduation split was supplied (ticket 86c9m3aec).
 *
 * Defensive: an inadvertent zero-count split (e.g. an upstream bug that
 * misclassifies all 8 problems as canonical) falls back to the legacy
 * `totalCorrect / 8` shape rather than producing a NaN successRate. The
 * graduation gate then can't fire on this entry, which is the right
 * conservative behaviour — better to under-promote than to feed garbage
 * into the mastery rule.
 */
function buildEntry(input: RecordProgressInput): SessionHistoryEntry {
  const { graduationSplit, latencyMs, mathFacts } = input
  const useSplit =
    graduationSplit !== undefined &&
    graduationSplit.canonicalCount > 0 &&
    graduationSplit.novelCount > 0

  // Latency persistence (ticket 86c9pwgc8 — M4). When supplied, the
  // array is shallow-cloned onto the entry; when absent the field is
  // omitted to keep the existing on-disk shape unchanged for callers
  // that don't ship it.
  const latencyClone =
    latencyMs !== undefined ? Array.from(latencyMs) : undefined

  // mathFacts persistence (M4.x slow-fact directive). Same posture as
  // latencyMs — shallow-clone when supplied (per-element copy so a
  // post-record mutation by the caller can't corrupt on-disk data),
  // omit when absent.
  const mathFactsClone =
    mathFacts !== undefined
      ? mathFacts.map((f) => ({ a: f.a, b: f.b, op: f.op }))
      : undefined

  if (!useSplit) {
    return {
      dateISO: input.dateISO,
      skillFocus: [input.focusNode],
      successRate: input.totalCorrect / PROBLEMS_PER_SESSION,
      ...(latencyClone !== undefined ? { latencyMs: latencyClone } : {}),
      ...(mathFactsClone !== undefined ? { mathFacts: mathFactsClone } : {}),
    }
  }

  const split = graduationSplit
  return {
    dateISO: input.dateISO,
    skillFocus: [input.focusNode],
    successRate: split.canonicalCorrect / split.canonicalCount,
    novelPoolSuccessRate: split.novelCorrect / split.novelCount,
    ...(latencyClone !== undefined ? { latencyMs: latencyClone } : {}),
    ...(mathFactsClone !== undefined ? { mathFacts: mathFactsClone } : {}),
  }
}

/**
 * Update `mathFactsLeitner` from a session's per-problem outcomes
 * (ticket 86c9pwgc8 — M4). For each problem:
 *   - First-tap correct  → promote (cap 5).
 *   - First-tap wrong    → demote to box 1.
 *   - No measurement (`undefined`) → fact added to box 1 if missing,
 *     existing rank unchanged.
 *
 * `addItem` runs first for every outcome so brand-new facts land in
 * the box at box 1 before the promote / demote step. Without this
 * the very first session-end after a new fact is introduced wouldn't
 * be able to promote it (promote / demote are no-ops on missing
 * items by the existing leitner.ts contract).
 *
 * Pure — returns a new box, never mutates input. Mirrors the helper
 * conventions in `lib/progress/leitner.ts`.
 */
function applyLeitnerOutcomes(
  box: LeitnerBox<MathFact>,
  outcomes: ReadonlyArray<LeitnerOutcome>,
  now: number,
): LeitnerBox<MathFact> {
  let next = box
  for (const { fact, correct } of outcomes) {
    next = addItem(next, mathFactKey, fact)
    if (correct === true) {
      next = promote(next, mathFactKey, fact, now)
    } else if (correct === false) {
      next = demote(next, mathFactKey, fact, now)
    }
    // correct === undefined: addItem already ran; no rank change.
  }
  return next
}

/**
 * Stable key for math facts in the Leitner box. Mirrors the test
 * fixture `progress.test.ts` (`${a}${op}${b}`) so the on-disk fact
 * key is invariant across promote / demote calls. Local because the
 * Leitner public surface uses caller-supplied key fns by design — no
 * other module should pluck this without explicit thought.
 */
const mathFactKey = (f: MathFact): string => `${f.a}${f.op}${f.b}`

/**
 * Narrow a `SkillNode` to the `WordSongNode` subset for the
 * lifetime-first-encounter append (ticket 86c9q9ben). Math nodes
 * never get appended — no first-encounter scaffolding lives on the
 * math track today.
 */
function isWordSongNode(node: SkillNode): node is WordSongNode {
  return (WORD_SONG_NODES_IN_ORDER as readonly string[]).includes(node)
}
