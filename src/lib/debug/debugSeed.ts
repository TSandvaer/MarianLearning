/**
 * One-shot localStorage seeder for QA / iPad ear-test workflows.
 *
 * When the URL has `?debug=1&seed=<value>`, this module pre-populates
 * the persisted Progress + SessionHistory blobs so a fresh browser can
 * deep-launch into a specific learning state (e.g. "Marian as if she
 * had mastered through `blending-cv` and is now practicing `cvc-words`").
 * Without this, the only way to reach a downstream-screen behaviour was
 * to play the natural progression from a fresh-storage Splash → Greet →
 * Math → ... — which on a desktop QA pass meant pasting localStorage
 * snippets into DevTools, and on iPad PWA meant a remote-debugger session
 * (which most testers don't have).
 *
 * Why `?debug=1` is the gate
 * --------------------------
 * `isDebugEnabled()` (the same predicate that drives `DebugOverlay`) is
 * the canonical "this is a QA browser, not a real user's session" flag.
 * Marian's normal app-open never sets `?debug=1`, so this seeder never
 * runs in her flow. Production users are unaffected.
 *
 * Why module-load (not useEffect)
 * -------------------------------
 * The seed must land in localStorage BEFORE the React-tree's
 * `useState(loadProgress)` initializers, `getInitialRoute()`, or
 * `nextAfterSplash()` run — otherwise the first render reads stale
 * values and a forced reload would be needed to reflect the seed.
 * Module-load timing puts this BEFORE the React tree even imports.
 * Mirrors the `disableHowlerAutoSuspend()` pattern at the top of
 * `App.tsx`.
 *
 * Type-driven schema sharing (post 2026-05-02 rework)
 * ---------------------------------------------------
 * The original 2026-05-02 implementation hand-mirrored the on-disk
 * shape (`{version: 2, sessions: [...]}`) — wrong format for the
 * canonical reader (which expects a flat `SessionHistoryV2` with
 * `schemaVersion: 2`), so the reader fell back to `emptySessionHistory()`
 * with `sessionCount: 0`, defeating the skip-Greet behaviour. Thomas
 * caught the regression on iPad.
 *
 * To eliminate that whole class of bug:
 *   - We import `SessionHistoryV2` and `emptySessionHistory()` from
 *     `screens/SessionEnd/sessionHistory.ts` and use the real
 *     `writeSessionHistory()` writer rather than hand-rolled JSON.
 *     Schema drift becomes a TypeScript error, not a silent runtime
 *     bug.
 *   - We import `defaultProgress()` and `saveProgress()` from
 *     `lib/progress` for the user-progress blob, so the seeder can
 *     never produce a partial blob that fails `isProgressV1` — the
 *     `loadProgress()` reader would otherwise return `null` and the
 *     seeded `skillLevels` would be invisible to `pickFocusNode()`.
 *
 * No import cycle: the canonical modules (`sessionHistory.ts`,
 * `lib/progress/storage.ts`, and their transitive deps) do not import
 * anything under `lib/debug/`. Verified 2026-05-02 with a one-way
 * grep before this rework.
 *
 * Idempotency
 * -----------
 * Reload-safe.
 *   - For progress: applying the same skillLevels patch a second time
 *     short-circuits via a no-op write (the `changed` flag).
 *   - For session-history: the seed only bumps `sessionCount` to 1 if
 *     the existing value is 0. A real returning user with
 *     `sessionCount > 0` is never displaced — the seeder MUST NOT
 *     overwrite Marian's actual progress on a real device that
 *     happens to load a `?debug=1&seed=...` URL.
 *
 * Recognized seed values
 * ----------------------
 * - `cvc-words`: Marian as if she's mastered everything through
 *   `blending-cv` and is now practicing `cvc-words`. Skips Greet (sets
 *   sessionCount to 1) so the app deep-routes to Hub on first mount,
 *   where the user taps "Word Song" → `pickFocusNode()` walks the
 *   word-song tree and returns `cvc-words` (because every earlier node
 *   is `mastered`) → planner emits cvc-words content.
 * - `cvc-words-graduation-ready`: same as `cvc-words`, plus 3 cross-day
 *   canonical history entries at 100% so the next session-start fetch
 *   flags `isGraduationSession=true`.
 * - `cvc-words-short-o`: Marian as if the short-a CVC pool is fully
 *   mastered and she's now practicing the short-o sibling node. The
 *   picker walks past `cvc-words` (mastered) and lands on
 *   `cvc-words-short-o` (practicing) per WORD_SONG_NODES_IN_ORDER.
 * - `cvc-words-short-u`: Marian as if both short-a AND short-o CVC
 *   pools are fully mastered and she's now practicing the short-u
 *   sibling node (ticket 86c9q9ben). The picker walks past `cvc-words`
 *   AND `cvc-words-short-o` (both mastered) and lands on
 *   `cvc-words-short-u` (practicing) per WORD_SONG_NODES_IN_ORDER.
 *   Mirrors the `cvc-words-short-o` recipe one step further down the
 *   tree.
 * - `cvc-words-short-i`: Marian as if short-a, short-o, AND short-u CVC
 *   pools are fully mastered and she's now practicing the short-i
 *   sibling node (ticket 86c9qdba4). The picker walks past every prior
 *   CVC tier and lands on `cvc-words-short-i` (practicing) per
 *   WORD_SONG_NODES_IN_ORDER. Mirrors the `cvc-words-short-u` recipe
 *   one step further down the tree.
 * - `cross-vowel-mixing`: Marian as if all three CVC tiers
 *   (`cvc-words`, `cvc-words-short-o`, `cvc-words-short-u`) are fully
 *   mastered and she's now practicing `digraphs` — the next node in
 *   word-song promotion order (ticket 86c9qa0kf). With every CVC tier
 *   mastered, `crossVowelMixingActive(progress, parentSettings)`
 *   returns `true`; the next session on any of the three CVC tiers
 *   would draw from `TARGET_PAIRINGS_CROSSVOWEL`. Note: with all three
 *   CVC tiers mastered the picker actually walks past them and lands
 *   on `digraphs` — to exercise cross-vowel chip rendering, test
 *   harnesses bump one CVC tier back to `'practicing'` (the e2e
 *   regression spec does this directly via `seedLocalStorage` with
 *   tier-specific overrides; the seed here is the ear-test recipe for
 *   "all three mastered, predicate active"). `parentSettings.crossVowelMixingEnabled`
 *   is left at the default `true` — no override needed.
 * - `add-to-20`: Marian as if she's mastered `number-recog` and
 *   `add-to-10` and is now practicing the next math tier. The picker
 *   walks past those two and lands on `add-to-20` (practicing) per
 *   MATH_NODES_IN_ORDER. Used by Thomas's iPad smoke-test for the
 *   add-to-20 focus session (ticket 86c9q5q13).
 *
 * Adding new seeds
 * ----------------
 * Extend the `SEEDS` table below. Each entry declares (a) the
 * `skillLevels` patch and (b) whether to skip Greet. Make sure the
 * patch marks ALL preceding nodes in the relevant track as `'mastered'`
 * — `pickFocusNode()` walks left-to-right in declaration order and
 * stops at the first non-mastered node, so a half-patched track lands
 * on the wrong focus.
 */

import {
  defaultProgress,
  loadProgress,
  saveProgress,
  type Progress,
  type SessionHistoryEntry,
  type SkillLevel,
  type SkillLevels,
  type SkillNode,
} from '../progress'
import {
  emptySessionHistory,
  readSessionHistory,
  writeSessionHistory,
  type SessionHistoryV2,
} from '../../screens/SessionEnd/sessionHistory'
import { isDebugEnabled } from './isDebugEnabled'

interface SeedRecipe {
  /**
   * skillLevels to merge over the existing progress. Keys not listed
   * are left untouched.
   *
   * NOTE: the picker walks the track in declaration order and stops at
   * the first non-mastered node — when targeting a deep node, mark
   * EVERY preceding node in that track as `'mastered'`, otherwise the
   * picker lands on an earlier node and the seed misses its target.
   */
  readonly skillLevels: Readonly<Partial<Record<SkillNode, SkillLevel>>>
  /**
   * Whether to bump session-history's `sessionCount` to 1 (if currently
   * 0) so Splash routes to Hub instead of Greet on the next mount.
   */
  readonly skipGreet: boolean
  /**
   * Optional history-seed factory (ticket 86c9m3aec). When supplied,
   * applied AFTER the skillLevels patch — the seeded entries land
   * unconditionally (they are debug fixtures, no idempotency
   * guarantee needed). Returning an empty array is equivalent to
   * omitting the field.
   */
  readonly historyFactory?: () => SessionHistoryEntry[]
}

/**
 * Build three cross-day cvc-words history entries at 100% canonical
 * — the exact pre-graduation state per ticket 86c9m3aec AC#4 part 1.
 * The dates are pinned three calendar days backward from the seed's
 * application instant so cross-day dedupe sees three distinct local
 * days under any timezone.
 */
function buildGraduationReadyHistory(): SessionHistoryEntry[] {
  const now = Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000
  return [3, 2, 1].map((daysAgo) => ({
    dateISO: new Date(now - daysAgo * oneDayMs).toISOString(),
    skillFocus: ['cvc-words' as const],
    successRate: 1.0,
  }))
}

const SEEDS: Readonly<Record<string, SeedRecipe>> = {
  'cvc-words': {
    skillLevels: {
      // Mark every preceding word-song node as mastered so the picker
      // walks past them and lands on `cvc-words`. Order mirrors
      // WORD_SONG_NODES_IN_ORDER in lib/progress/focusNode.ts.
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'practicing',
    },
    skipGreet: true,
  },
  // Ticket 86c9m3aec: deep-launch into the cvc-words graduation state.
  // Pre-populates 3 cross-day canonical sessions at 100% so the next
  // session-start fetch flags `isGraduationSession=true` and the
  // planner mixes 2-3 novel short-a probe words. Used by the SAR
  // walkthrough on the Vercel preview URL.
  'cvc-words-graduation-ready': {
    skillLevels: {
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'practicing',
    },
    skipGreet: true,
    historyFactory: buildGraduationReadyHistory,
  },
  // Short-o sibling node smoke-test entry (PR #151 follow-up). Marian
  // has fully mastered the short-a CVC pool and is now practicing the
  // short-o tier. The picker walks WORD_SONG_NODES_IN_ORDER, sees every
  // earlier word-song node mastered (including `cvc-words`), and lands
  // on `cvc-words-short-o`. Used by Thomas's iPad smoke-test for the
  // short-o focus session.
  'cvc-words-short-o': {
    skillLevels: {
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'mastered',
      'cvc-words-short-o': 'practicing',
    },
    skipGreet: true,
  },
  // Short-u sibling node smoke-test entry (ticket 86c9q9ben — third
  // vowel-tier sibling). Marian has fully mastered both short-a AND
  // short-o CVC pools and is now practicing the short-u tier. The
  // picker walks WORD_SONG_NODES_IN_ORDER, sees every earlier
  // word-song node mastered (including `cvc-words` and
  // `cvc-words-short-o`), and lands on `cvc-words-short-u`. Used by
  // Thomas's iPad smoke-test for the short-u focus session AND by QA
  // for the deep-launch path verifying the new tier renders end-to-end.
  // Mirrors the `cvc-words-short-o` recipe with one additional
  // mastered prerequisite.
  'cvc-words-short-u': {
    skillLevels: {
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'mastered',
      'cvc-words-short-o': 'mastered',
      'cvc-words-short-u': 'practicing',
    },
    skipGreet: true,
  },
  // Short-i sibling node smoke-test entry (ticket 86c9qdba4 — fourth
  // vowel-tier sibling). Marian has fully mastered short-a, short-o,
  // AND short-u CVC pools and is now practicing the short-i tier. The
  // picker walks WORD_SONG_NODES_IN_ORDER, sees every earlier word-song
  // node mastered (including `cvc-words`, `cvc-words-short-o`, and
  // `cvc-words-short-u`), and lands on `cvc-words-short-i`. Used by
  // Thomas's iPad smoke-test for the short-i focus session AND by QA
  // for the deep-launch path verifying the new tier renders end-to-end.
  // Mirrors the `cvc-words-short-u` recipe with one additional mastered
  // prerequisite.
  'cvc-words-short-i': {
    skillLevels: {
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'mastered',
      'cvc-words-short-o': 'mastered',
      'cvc-words-short-u': 'mastered',
      'cvc-words-short-i': 'practicing',
    },
    skipGreet: true,
  },
  // Cross-vowel mixing smoke-test entry (ticket 86c9qa0kf). Marian as
  // if all three CVC vowel tiers are mastered. The predicate
  // `crossVowelMixingActive(progress, parentSettings)` returns `true`
  // for this state (assuming default `parentSettings.crossVowelMixingEnabled
  // = true`). For practical chip rendering: with all three CVC tiers
  // mastered, `pickFocusNode` walks past them and lands on the next
  // non-mastered node — the seed sets `digraphs: 'practicing'` so the
  // picker has somewhere to land. Cross-vowel chips don't render in the
  // natural session flow (focus is `digraphs`, NOT a CVC tier; the
  // caller-side `focusIsCvcTier` gate in App.tsx returns `false` and
  // `wordSongCrossVowel` stays `false`).
  //
  // Why ship the seed at all in v1 if cross-vowel never fires? Two
  // reasons: (a) the seed exercises the predicate-true branch end-to-end
  // for the parent-settings UI display ("cross-vowel mixing: enabled"
  // visible to the parent); (b) it's the deep-launch state for any
  // future review-mode work that revisits mastered CVC tiers, at which
  // point the seed becomes the cross-vowel-fires entry-point without
  // recipe changes. Predicate-level + matrix-level testing happens in
  // unit tests (mastery.test.ts + wordDistractors.test.ts); the e2e
  // regression spec covers the wiring + the predicate-OFF-by-toggle and
  // predicate-OFF-by-incomplete-mastery paths.
  'cross-vowel-mixing': {
    skillLevels: {
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'mastered',
      'cvc-words-short-o': 'mastered',
      'cvc-words-short-u': 'mastered',
      // cvc-words-short-i mastered too (ticket 86c9qdba4) — without this
      // entry the picker would land on cvc-words-short-i (locked-to-
      // intro-when-short-u-promotes pattern) instead of digraphs, and
      // the seed's intent ("focus is digraphs, not a CVC tier; cross-
      // vowel chips don't render in the natural session flow") would
      // break. The `crossVowelMixingActive` predicate still gates only
      // on the 3-node CVC_CROSS_VOWEL_NODES set (cvc-words / short-o /
      // short-u) per mastery.ts — short-i mastery is irrelevant to the
      // predicate today; it only matters for the picker walk to land on
      // digraphs.
      'cvc-words-short-i': 'mastered',
      digraphs: 'practicing',
    },
    skipGreet: true,
  },
  // Add-to-20 sibling tier smoke-test entry (ticket 86c9q5q13). Marian
  // has mastered the prerequisites (number-recog and add-to-10) and is
  // now practicing the next math tier. The picker walks
  // MATH_NODES_IN_ORDER, sees every earlier math node mastered, and
  // lands on `add-to-20`. Other math nodes that are downstream stay at
  // their default levels — only the predecessors of the target need
  // coercion. Used by Thomas's iPad smoke-test for the add-to-20 focus
  // session AND by QA for the deep-launch path verifying static plans /
  // canon / planner all work end-to-end on the new tier.
  'add-to-20': {
    skillLevels: {
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'practicing',
    },
    skipGreet: true,
  },
}

/**
 * Returns the seed value from `?seed=<value>` if `?debug=1` is also
 * present. Returns `null` when no debug seed is requested.
 */
export function readDebugSeedParam(): string | null {
  if (typeof window === 'undefined' || !window.location) return null
  if (!isDebugEnabled()) return null
  try {
    return new URLSearchParams(window.location.search).get('seed')
  } catch {
    return null
  }
}

/**
 * Apply a recognized debug seed exactly once per stored state. Safe
 * to call multiple times — idempotent on the persisted blobs. No-op
 * when `?debug=1` is missing, when no `?seed=` is provided, or when
 * the seed value is not in the SEEDS table.
 */
export function maybeApplyDebugSeed(): void {
  const value = readDebugSeedParam()
  if (value === null) return
  const recipe = SEEDS[value]
  if (!recipe) {
    // Unknown seed — emit a console hint so testers see the typo
    // immediately rather than silently getting un-seeded behaviour.
    console.warn(
      `[debugSeed] Unknown seed value: "${value}". Recognized: ${Object.keys(SEEDS).join(', ')}`,
    )
    return
  }

  applySkillLevelsPatch(recipe.skillLevels)
  if (recipe.historyFactory) {
    applyHistorySeed(recipe.historyFactory())
  }
  if (recipe.skipGreet) {
    bumpSessionCountIfZero()
  }
}

/**
 * Append `entries` to the persisted Progress document's `history`
 * (ticket 86c9m3aec). Used by the `cvc-words-graduation-ready` seed
 * to deep-launch into a state where the next session-start fetch
 * flags graduation. Non-idempotent: a second invocation appends
 * again. Acceptable for a debug seed — testers re-launch on a fresh
 * storage clear.
 *
 * If no progress exists yet, seeds via `defaultProgress()` first so
 * the persisted blob always validates as v1.
 */
function applyHistorySeed(entries: SessionHistoryEntry[]): void {
  if (entries.length === 0) return
  const existing = loadProgress() ?? defaultProgress()
  saveProgress({
    ...existing,
    history: [...existing.history, ...entries],
  })
}

/**
 * Merge the recipe's skillLevels patch over the persisted Progress
 * document, then save via the canonical `saveProgress()` writer.
 *
 * If no progress exists (fresh storage), starts from `defaultProgress()`
 * so the resulting blob fully validates as v1 — `loadProgress()` would
 * otherwise return `null` for a partial blob and `pickFocusNode()`
 * would never see the seeded skill levels.
 *
 * Idempotent: a second call with the same patch detects "no change" and
 * skips the write.
 */
function applySkillLevelsPatch(
  patch: Readonly<Partial<Record<SkillNode, SkillLevel>>>,
): void {
  const stored = loadProgress()
  const existing: Progress = stored ?? defaultProgress()
  const nextSkillLevels: SkillLevels = { ...existing.skillLevels }
  let changed = false
  for (const [key, value] of Object.entries(patch) as Array<
    [SkillNode, SkillLevel]
  >) {
    if (nextSkillLevels[key] !== value) {
      nextSkillLevels[key] = value
      changed = true
    }
  }
  // If nothing changed AND we already had a valid stored blob, skip the
  // write. If `stored === null` (fresh storage), we still write so a
  // valid blob lands on disk for downstream readers (`loadProgress()`
  // would otherwise keep returning null and `pickFocusNode()` would
  // never see the seed).
  if (!changed && stored !== null) return
  saveProgress({ ...existing, skillLevels: nextSkillLevels })
}

/**
 * Write a minimal valid `SessionHistoryV2` with `sessionCount: 1` if
 * the stored value parses to a sessionCount of 0 (i.e. a fresh-storage
 * profile). If a real session history already exists with
 * sessionCount > 0, it's preserved verbatim — the debug seeder MUST
 * NOT displace Marian's actual progress on a real-user device that
 * happens to load a `?debug=1&seed=...` URL.
 *
 * The fake history is built off `emptySessionHistory()` so its shape
 * is whatever the canonical reader produces. Type-anchored to
 * `SessionHistoryV2`; any drift in the canonical type fails this file
 * at compile time, not at the user's iPad.
 */
function bumpSessionCountIfZero(): void {
  const existing = readSessionHistory()
  if (existing.sessionCount > 0) return
  const fakeHistory: SessionHistoryV2 = {
    ...emptySessionHistory(),
    sessionCount: 1,
    lastSessionCompletedAt: new Date().toISOString(),
  }
  writeSessionHistory(fakeHistory)
}
