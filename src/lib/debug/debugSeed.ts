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
  if (recipe.skipGreet) {
    bumpSessionCountIfZero()
  }
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
