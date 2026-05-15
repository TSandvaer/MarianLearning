/**
 * Lifetime-first-encounter gate (ticket 86c9q9ben).
 *
 * Pure functions over `Progress.lifetimeFirstEncounters`. Two surfaces:
 *
 *  1. `isFirstEncounter(progress, node)` — predicate read at session-
 *     render time. True when the node is NOT yet in the list.
 *  2. `markFirstEncounterSeen(progress, node)` — append-once helper
 *     called at session-end after the first-encounter scaffolding
 *     was actually delivered for this session.
 *  3. `inferLifetimeFirstEncountersFromProgress(progress)` — migration
 *     helper used by `migrate.ts` (and the read-path defaulter for
 *     blobs that predate the field). Treats any non-`'locked'`
 *     word-song node as already-encountered, so a blob with a
 *     pre-existing `cvc-words: 'practicing'` doesn't get the short-a
 *     scaffolding replayed (and a `cvc-words-short-o: 'mastered'`
 *     blob doesn't get the box/fox line replayed when the canon
 *     variant ships).
 *
 * Why the helper API is WordSongNode-only (not full SkillNode)
 * ------------------------------------------------------------
 * The persisted shape (`Progress.lifetimeFirstEncounters`) is typed
 * `SkillNode[]` post Wave 3.4 — it spans BOTH tracks so math focus
 * nodes (`'sub-to-10'` per Kyle's spec §4.3) can round-trip cleanly
 * once the session-end append-on-math path lights up. However, the
 * helpers in THIS module (`isFirstEncounter`, `markFirstEncounterSeen`,
 * `inferLifetimeFirstEncountersFromProgress`) remain `WordSongNode`-
 * scoped because:
 *
 *  - The only producer today is `progressHistory.ts`, which calls
 *    `markFirstEncounterSeen` gated by `isWordSongNode(focusNode)`.
 *    The math-track append is intentionally deferred (the timing of
 *    when a math node counts as "first-encountered" needs design).
 *  - The only consumer today is the session-start path for word-song.
 *  - The migration helper walks `WORD_SONG_NODES_IN_ORDER` because
 *    the inference rule ("any non-locked node is already-encountered")
 *    only fits the word-song scaffolding it was designed for. Math
 *    inference would replay the wrong tier scaffolding if widened
 *    naively — the rule needs its own design pass.
 *
 * When math first-encounter scaffolding actually ships, widen these
 * helpers to `SkillNode`, add a `MATH_NODES_IN_ORDER` entry to the
 * migration helper (with the right inference rule), and pull the
 * `isWordSongNode` gate in `progressHistory.ts`. The storage layer
 * needs no further change — `SkillNode[]` is already its type.
 *
 * Gate level: NODE, not WORD
 * --------------------------
 * Per Dave's PR #173 §4 recommendation. Future cross-vowel mixing
 * (#86c9m3aek) won't accidentally re-fire when a short-u word
 * surfaces in a mixed-vowel session: the gate keys on `focusNode`,
 * which is set once-per-session at session-start fetch time.
 */

import { WORD_SONG_NODES_IN_ORDER } from './focusNode'
import type { Progress, WordSongNode } from './types'

/**
 * Predicate: true when `node` has NOT yet been recorded as
 * encountered for this child. The session-start handler reads this
 * to decide whether to fire tier-specific first-encounter
 * scaffolding (the contrast opener etc.).
 *
 * - `progress === null` → true (no profile yet → first encounter
 *   trivially holds for whichever node we're asked about).
 * - `lifetimeFirstEncounters` undefined → true (pre-86c9q9ben blob
 *   with no list yet; the read-path defaulter normally fills this
 *   before the predicate runs, but we defend defensively).
 * - `lifetimeFirstEncounters` set + does not contain `node` → true.
 * - `lifetimeFirstEncounters` set + contains `node` → false.
 *
 * Pure read; no mutation.
 */
export function isFirstEncounter(
  progress: Progress | null,
  node: WordSongNode,
): boolean {
  if (progress === null) return true
  const list = progress.lifetimeFirstEncounters
  if (list === undefined) return true
  return !list.includes(node)
}

/**
 * Append-once: returns a NEW progress doc with `node` added to
 * `lifetimeFirstEncounters` if it wasn't already there. If it was
 * already there OR the field is undefined (defensive), inserts at
 * the end. Returns the input verbatim when no change is needed —
 * lets call sites short-circuit on `next === progress` when they
 * want to avoid a redundant `saveProgress`.
 */
export function markFirstEncounterSeen(
  progress: Progress,
  node: WordSongNode,
): Progress {
  const list = progress.lifetimeFirstEncounters ?? []
  if (list.includes(node)) {
    // Already recorded; preserve the existing list shape including
    // the (defensive) "field was missing" branch where we now seed
    // it as empty.
    if (progress.lifetimeFirstEncounters !== undefined) return progress
    return { ...progress, lifetimeFirstEncounters: list }
  }
  return {
    ...progress,
    lifetimeFirstEncounters: [...list, node],
  }
}

/**
 * Migration helper — infer `lifetimeFirstEncounters` for an existing
 * Progress payload that predates ticket 86c9q9ben.
 *
 * Rule: every word-song node whose `skillLevels[node]` is NOT
 * `'locked'` is treated as already-encountered. Rationale:
 *
 *  - A node at `'mastered'` clearly has been seen.
 *  - A node at `'practicing'` has been delivered to Marian via
 *    session-start at least once (the engine doesn't push a node
 *    into `'practicing'` without a session backing it up).
 *  - A node at `'intro'` is in the trees the engine considers
 *    fair game; if Marian had her diagnostic baseline set this
 *    flag, she's seen any tier-specific scaffolding the engine
 *    would have fired in earlier sessions. Replaying it on the
 *    next session would be confusing.
 *  - A node at `'locked'` is genuinely unseen — the gate fires on
 *    her first session at that tier.
 *
 * Pre-86c9q9ben Marians whose short-u was already at `'practicing'`
 * (e.g. via the `cvc-words-short-u` debug seed) are treated as
 * already-encountered by this rule, which means the migration
 * does NOT replay the contrast line for them on next session-start.
 * That's the conservative choice — risking a false "already seen"
 * is a quieter UX failure than re-firing the scaffolding on a
 * Marian who's been doing short-u for a week.
 *
 * Empty `skillLevels` (defensive — should not occur under the
 * read-path defaulter) → empty list (greenfield posture).
 */
export function inferLifetimeFirstEncountersFromProgress(
  progress: Pick<Progress, 'skillLevels'>,
): WordSongNode[] {
  const out: WordSongNode[] = []
  for (const node of WORD_SONG_NODES_IN_ORDER) {
    const level = progress.skillLevels[node]
    if (level !== undefined && level !== 'locked') {
      out.push(node)
    }
  }
  return out
}
