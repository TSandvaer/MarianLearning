/**
 * localStorage seeding helpers for e2e specs.
 *
 * Ticket 86c9kwnmx. Seeds the two persisted blobs the app reads at mount:
 *   - `marian-tutor:progress:v1` — `Progress` document.
 *   - `marian-tutor.session-history.v1` — Hub stats / session count.
 *
 * Seeding happens via `page.addInitScript` BEFORE the first navigation so
 * the App's first render observes the right state. Setting localStorage
 * after `goto()` is too late — the App's mount-time reads have already
 * fired.
 */

import type { Page } from '@playwright/test'

export const PROGRESS_STORAGE_KEY = 'marian-tutor:progress:v1'
export const SESSION_HISTORY_STORAGE_KEY = 'marian-tutor.session-history.v1'

export interface SeedProgressOptions {
  /** Override `skillLevels`; merged on top of the diagnostic defaults. */
  skillLevelOverrides?: Record<string, string>
  /** Append entries to `history`. */
  history?: ReadonlyArray<{
    dateISO: string
    skillFocus: string[]
    successRate: number
  }>
  /** ISO timestamp for `profile.lastPlayedISO`. */
  lastPlayedISO?: string | null
  /**
   * Override `parentSettings.masteryThreshold`. Useful for tests that
   * need a faster promotion path.
   */
  masteryThreshold?: { percent: number; sessions: number }
}

/** Diagnostic defaults from `src/lib/progress/defaults.ts`. Mirrored here
 *  so e2e specs don't drag the app's `defaultProgress()` factory in. */
const DEFAULT_SKILL_LEVELS = {
  'number-recog': 'mastered',
  'add-to-10': 'practicing',
  'add-to-20': 'locked',
  'sub-to-10': 'mastered',
  'sub-to-20': 'intro',
  'two-digit-addsub': 'locked',
  'skip-counting': 'locked',
  'mult-2-5-10': 'intro',
  'mult-3-4': 'locked',
  'mult-6-9': 'locked',
  'letter-names': 'mastered',
  'letter-sounds': 'practicing',
  'blending-cv': 'practicing',
  'cvc-words': 'intro',
  digraphs: 'locked',
  'sight-words': 'intro',
  'simple-sentences': 'locked',
} as const

export interface SeedSessionHistoryOptions {
  sessionCount?: number
  cumulativeStardust?: number
  longestStreakEver?: number
  lastSessionStardust?: number
  dayStreak?: number
  lastSessionCompletedAt?: string
}

/**
 * Build a `Progress` document the e2e spec can install via
 * `seedLocalStorage`. The shape mirrors `defaultProgress()` but lets the
 * caller override the bits the spec cares about (history, mastery
 * threshold, focus-node levels).
 */
export function buildSeedProgress(opts: SeedProgressOptions = {}): unknown {
  return {
    schemaVersion: 1,
    profile: {
      childName: 'Marian',
      character: 'melody',
      lastPlayedISO: opts.lastPlayedISO ?? null,
    },
    skillLevels: {
      ...DEFAULT_SKILL_LEVELS,
      ...(opts.skillLevelOverrides ?? {}),
    },
    mathFactsLeitner: {
      items: [],
    },
    history:
      opts.history?.map((h) => ({ ...h, skillFocus: [...h.skillFocus] })) ?? [],
    parentSettings: {
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: opts.masteryThreshold ?? { percent: 0.95, sessions: 3 },
      crossDayEnforcement: true,
      showLevelToMarian: false,
    },
  }
}

/**
 * Build a `SessionHistoryV2` blob for the Hub stats key. Defaults to a
 * "returning user with 5 sessions and 12 cumulative stardust" shape so
 * the App skips the first-ever Greet path on Splash advance.
 */
export function buildSeedSessionHistory(
  opts: SeedSessionHistoryOptions = {},
): unknown {
  return {
    schemaVersion: 2,
    sessionCount: opts.sessionCount ?? 5,
    lastSessionCompletedAt:
      opts.lastSessionCompletedAt ??
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    longestStreakEver: opts.longestStreakEver ?? 4,
    cumulativeStardust: opts.cumulativeStardust ?? 12,
    lastSessionStardust: opts.lastSessionStardust ?? 8,
    dayStreak: opts.dayStreak ?? 1,
    todayTreesTouched: { date: '', trees: [] },
    lastSuggestion: null,
    consecutiveOverrides: 0,
    suggestionCooldownUntil: null,
  }
}

/**
 * Install Progress + SessionHistory blobs into localStorage BEFORE the
 * App mounts. Called from `beforeEach` in specs that need preloaded
 * state.
 */
export async function seedLocalStorage(
  page: Page,
  seeds: {
    progress?: unknown
    sessionHistory?: unknown
  },
): Promise<void> {
  await page.addInitScript(
    ({ progressKey, historyKey, progress, sessionHistory }) => {
      try {
        if (progress !== undefined) {
          window.localStorage.setItem(progressKey, JSON.stringify(progress))
        }
        if (sessionHistory !== undefined) {
          window.localStorage.setItem(
            historyKey,
            JSON.stringify(sessionHistory),
          )
        }
      } catch {
        // If the test browser blocks localStorage, the app's own
        // try/catch reads `null` and uses defaults — same as a fresh
        // first-ever launch.
      }
    },
    {
      progressKey: PROGRESS_STORAGE_KEY,
      historyKey: SESSION_HISTORY_STORAGE_KEY,
      progress: seeds.progress,
      sessionHistory: seeds.sessionHistory,
    },
  )
}

/**
 * Read `marian-tutor:progress:v1` back out of the page after a session.
 * Used by the mastery-promotion spec to assert the post-session
 * skillLevels.
 */
export async function readProgressFromPage(page: Page): Promise<unknown> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  }, PROGRESS_STORAGE_KEY)
}

/** Read `marian-tutor.session-history.v1` back out of the page. */
export async function readSessionHistoryFromPage(page: Page): Promise<unknown> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  }, SESSION_HISTORY_STORAGE_KEY)
}
