/**
 * One-shot localStorage seeder for QA / iPad ear-test workflows.
 *
 * When the URL has `?debug=1&seed=<value>`, this module pre-populates
 * `marian-tutor:progress:v1` and `marian-tutor.session-history.v1` so a
 * fresh browser session can deep-launch into a specific learning state
 * (e.g. "Marian as if she had mastered blending-cv and is now practicing
 * cvc-words"). Without this, the only way to test downstream-screen
 * behaviour is to play the natural progression from a fresh-storage
 * Splash → Greet → Math → ... — which on a desktop QA pass meant
 * pasting localStorage seed snippets into DevTools, and on iPad PWA
 * meant remote-debugger access (which most testers don't have).
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
 * The seed must land in localStorage BEFORE any of the React-tree's
 * `useState(loadProgress)` initializers, `getInitialRoute()`, or
 * `getInitialPostSplashRoute()` run — otherwise the first render reads
 * stale values and we'd need a forced reload to reflect the seed.
 * Module-load timing puts this BEFORE the React tree even imports.
 * Mirrors the `disableHowlerAutoSuspend()` pattern at the top of
 * App.tsx.
 *
 * Idempotency
 * -----------
 * Reload-safe. The seeder checks if the requested progress is already
 * applied AND if a fake session-history entry already exists; if both
 * are true, it no-ops. So pasting the URL twice doesn't pile up
 * duplicate sessions, and the user can iterate freely on the same tab.
 *
 * Recognized seed values
 * ----------------------
 * - `cvc-words`: Marian as if she's mastered blending-cv and is
 *   practicing cvc-words. Skips Greet (sets sessionCount to 1 via a
 *   fake math session in history) so the app deep-routes to Hub on
 *   first mount, where the user taps "Word Song" → picker reads the
 *   seeded `skillLevels` → routes to cvc-words content.
 *
 * Adding new seeds
 * ----------------
 * Extend the `SEEDS` table below. Each entry declares (a) the
 * `skillLevels` patch and (b) whether to skip Greet. Test the new seed
 * value in `debugSeed.test.ts` against the same shape as the existing
 * entries.
 */

import { isDebugEnabled } from './isDebugEnabled'

/** Storage key for the user-progress blob. Mirrors the constant in
 * `src/lib/progress/loadProgress.ts` (kept private here to avoid an
 * import cycle on the seeder, which must run at module load). */
const PROGRESS_KEY = 'marian-tutor:progress:v1'

/** Storage key for the session-history blob. Mirrors the constant in
 * `src/screens/SessionEnd/sessionHistory.ts` (same import-cycle reason). */
const SESSION_HISTORY_KEY = 'marian-tutor.session-history.v1'

/** Marker we stamp on a seeded fake session so the idempotency check
 * can recognize "this entry came from the seeder, not a real run". */
const SEEDER_MARKER = '__debug_seed__'

interface SeedRecipe {
  /** skillLevels to merge over the existing progress. Keys not listed
   * are left untouched; values 'locked' | 'practicing' | 'mastered'. */
  readonly skillLevels: Readonly<
    Record<string, 'locked' | 'practicing' | 'mastered'>
  >
  /** Whether to insert a fake session-history entry so sessionCount > 0
   * and Splash routes to Hub instead of Greet. */
  readonly skipGreet: boolean
  /** Which surface the fake session pretends to come from. Must match
   * a SessionEndPayload['surface']. */
  readonly fakeSessionSurface: 'math' | 'word-song'
  /** Which focus node the fake session records. Must be valid for the
   * fakeSessionSurface track. */
  readonly fakeSessionFocusNode: string
}

const SEEDS: Readonly<Record<string, SeedRecipe>> = {
  'cvc-words': {
    skillLevels: {
      'blending-cv': 'mastered',
      'cvc-words': 'practicing',
    },
    skipGreet: true,
    fakeSessionSurface: 'math',
    fakeSessionFocusNode: 'add-to-10',
  },
}

/** Returns the seed value from `?seed=<value>` if `?debug=1` is also
 * present. Returns `null` when no debug seed is requested. */
export function readDebugSeedParam(): string | null {
  if (typeof window === 'undefined' || !window.location) return null
  if (!isDebugEnabled()) return null
  try {
    return new URLSearchParams(window.location.search).get('seed')
  } catch {
    return null
  }
}

/** Apply a recognized debug seed exactly once per stored state. Safe
 * to call multiple times — idempotent on the persisted blobs. No-op
 * when `?debug=1` is missing, when no `?seed=` is provided, or when
 * the seed value is not in the SEEDS table. */
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
    insertFakeSessionIfMissing(
      recipe.fakeSessionSurface,
      recipe.fakeSessionFocusNode,
    )
  }
}

function applySkillLevelsPatch(
  patch: Readonly<Record<string, 'locked' | 'practicing' | 'mastered'>>,
): void {
  let progress: Record<string, unknown>
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY)
    progress = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    progress = {}
  }
  const skillLevels =
    typeof progress.skillLevels === 'object' && progress.skillLevels !== null
      ? (progress.skillLevels as Record<string, string>)
      : {}
  let changed = false
  for (const [key, value] of Object.entries(patch)) {
    if (skillLevels[key] !== value) {
      skillLevels[key] = value
      changed = true
    }
  }
  if (!changed) return
  progress.skillLevels = skillLevels
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // Storage write failed (quota, private mode, etc.) — surface but
    // don't throw. The seeder is best-effort.
    console.warn('[debugSeed] Failed to persist progress patch')
  }
}

function insertFakeSessionIfMissing(
  surface: 'math' | 'word-song',
  focusNode: string,
): void {
  let history: { version?: number; sessions?: unknown[] }
  try {
    const raw = window.localStorage.getItem(SESSION_HISTORY_KEY)
    history = raw
      ? (JSON.parse(raw) as { version?: number; sessions?: unknown[] })
      : { version: 2, sessions: [] }
  } catch {
    history = { version: 2, sessions: [] }
  }
  const sessions = Array.isArray(history.sessions) ? history.sessions : []
  // Idempotency check — already seeded?
  const alreadySeeded = sessions.some(
    (s) =>
      typeof s === 'object' &&
      s !== null &&
      (s as Record<string, unknown>)[SEEDER_MARKER] === true,
  )
  if (alreadySeeded) return
  sessions.push({
    [SEEDER_MARKER]: true,
    surface,
    dateISO: new Date().toISOString(),
    totalCorrect: 8,
    totalStardust: 8,
    finalStreak: 8,
    earnedThisSession: 8,
    focusNode,
  })
  try {
    window.localStorage.setItem(
      SESSION_HISTORY_KEY,
      JSON.stringify({ version: history.version ?? 2, sessions }),
    )
  } catch {
    console.warn('[debugSeed] Failed to persist fake session entry')
  }
}
