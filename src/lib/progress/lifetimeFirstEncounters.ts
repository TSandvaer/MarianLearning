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
 * Why the WordSongNode subset (not full SkillNode)
 * ------------------------------------------------
 * Today only word-song tier transitions carry first-encounter
 * scaffolding (the /u/ vs /ʌ/ contrast, the box/fox /ks/ line). Math
 * has no analogous scaffolding — counting, addition, subtraction
 * don't fan out into vowel-pair phonetic-discrimination work. The
 * subset is enforced at the type layer (`Progress.lifetimeFirstEncounters: WordSongNode[]`);
 * the runtime guard widens to `SkillNode` because the persisted
 * shape uses string literals and the SKILL_NODES set is already
 * shaped that way. If math ever picks up first-encounter
 * scaffolding, widen the type to `SkillNode[]` here and add the
 * appropriate `MATH_NODES_IN_ORDER` entries to the migration helper.
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
