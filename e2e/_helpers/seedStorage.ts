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
  'cvc-words-short-o': 'locked',
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

/**
 * Force Howler's AudioContext into the `running` state.
 *
 * Why this exists
 * ---------------
 * Production reality: AudioContext starts `suspended`. The first user
 * gesture inside a chain that touches Howler unlocks it. In Marian's
 * iPad PWA flow, that gesture is the Greet wake-tap (first-ever launch)
 * or — for returning users — an empirical tap somewhere on Hub that
 * Howler's document-level click listener catches.
 *
 * In Playwright headless Chromium / WebKit the auto-unlock chain is
 * brittle: Howler's `click` listener only installs after the first
 * `new Howl(...)` is constructed (which happens during the math fetch
 * resolution), and the user's tap on Hub may have already fired by
 * then. The result is that Math mounts, fetch resolves, but
 * `Howler.ctx.state === 'suspended'` so the read-aloud effect's
 * `getHowlerRunning() === false` short-circuit holds; chips never
 * become enabled.
 *
 * This helper sidesteps the gesture chain by directly resuming
 * `Howler.ctx` from the page context. It's the equivalent of "the
 * gesture chain succeeded" without paying the gesture-routing
 * complexity in the harness.
 *
 * Production NEVER calls this — it relies on the real gesture chain.
 * The helper is a TEST SEAM to bridge the headless-browser gap. When
 * the audit's "real iPad gesture-unlock e2e" follow-up ticket lands,
 * that spec exercises the gesture chain end-to-end (mobile-emulation
 * mode, real touch events) and asserts unlock without this helper.
 */
export async function forceHowlerUnlock(page: Page): Promise<void> {
  await page.evaluate(async () => {
    interface HowlerWindow {
      Howler?: {
        ctx?: AudioContext | null
        usingWebAudio?: boolean
        _audioUnlocked?: boolean
        _howls?: unknown[]
      }
    }
    const w = window as Window & HowlerWindow
    // Howler is exposed on `window` because howler.js is a UMD module that
    // self-registers when imported. If it isn't on window, the app hasn't
    // imported it yet — wait briefly, then bail (caller's expect() will
    // surface a clearer failure than ours).
    const start = Date.now()
    while (!w.Howler && Date.now() - start < 5000) {
      await new Promise((r) => setTimeout(r, 50))
    }
    const howler = w.Howler
    if (!howler) return
    // If Howler hasn't lazy-initted its ctx yet (no Howl constructed),
    // construct one now. Without this, WebKit's `Howler.ctx === null`
    // makes `getHowlerRunning()` return false and Math's read-aloud
    // effect short-circuits. Chromium hits this less often because
    // SFX-load failures still construct Howls (and lazy-init ctx as a
    // side-effect); WebKit's path differs.
    if (!howler.ctx) {
      try {
        const Ctor =
          (window as unknown as { AudioContext?: typeof AudioContext })
            .AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        if (Ctor) {
          howler.ctx = new Ctor()
        }
      } catch {
        // Best-effort. If construction fails, downstream `getHowlerRunning()`
        // will return false and the test will fail at the chip-enabled
        // assertion with a clearer message.
      }
    }
    if (howler.ctx && howler.ctx.state === 'suspended') {
      await howler.ctx.resume()
    }
    if (!howler.ctx) {
      // WebKit headless doesn't expose `AudioContext` — there's nothing
      // to construct. Spoof a minimal-shape stub Howler.ctx that the
      // production-code's `readHowlerContextRunning()` (which only reads
      // `Howler.ctx?.state`) sees as 'running'. The stub also satisfies
      // Howler's own internal probes which use `Howler.ctx.state === 'running'`
      // to skip resume calls.
      howler.ctx = {
        state: 'running',
      } as unknown as AudioContext
    }
    howler._audioUnlocked = true
  })
}
