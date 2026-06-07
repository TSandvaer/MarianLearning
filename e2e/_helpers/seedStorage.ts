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
import type {
  SessionHistoryEntry,
  SkillNode,
} from '../../src/lib/progress/types'

export const PROGRESS_STORAGE_KEY = 'marian-tutor:progress:v1'
export const SESSION_HISTORY_STORAGE_KEY = 'marian-tutor.session-history.v1'

/**
 * Helper-side `SessionHistoryEntry` shape used by `SeedProgressOptions.history`.
 *
 * Mirrors the production `SessionHistoryEntry` from `src/lib/progress/types.ts`
 * but with `ReadonlyArray<>` on every array field so callers can pass
 * `as const` literals without TypeScript fighting them. The helper deep-copies
 * each array on its way into the seeded blob, so frozen inputs are safe.
 *
 * Ticket 86c9xaybc widened this from the prior narrow
 * `{ dateISO, skillFocus, successRate }` shape after three precedents
 * (latencyMs, mathFacts, perProblemAnswerValue/Word) hit the type-signature
 * cap and forced specs to bypass the helper with hand-built Progress docs.
 * The new shape covers every additive field on `SessionHistoryEntry` so
 * spec authors stay on the typed helper instead of duplicating the
 * 23-node `skillLevels` block and 7-field `parentSettings` block by hand.
 */
export type SeedSessionHistoryEntry = {
  /** ISO 8601 date-time the session started. */
  dateISO: string
  /** Skill nodes this session focused on. */
  skillFocus: ReadonlyArray<SkillNode>
  /** Success rate, 0..1. See `SessionHistoryEntry.successRate` for semantics. */
  successRate: number
  /** Graduation-session novel-pool accuracy (cvc-words only). */
  novelPoolSuccessRate?: number
  /** Per-problem first-tap latency (ms). Sentinel `-1` = abandoned. */
  latencyMs?: ReadonlyArray<number>
  /** Per-problem target fact (math sessions only). */
  mathFacts?: ReadonlyArray<{ a: number; b: number; op: '+' | '-' | '*' }>
  /** Per-problem first-tap chip value (math sessions only). */
  perProblemAnswerValue?: ReadonlyArray<number | null>
  /** Per-problem first-tap chip word (word-song sessions only). */
  perProblemAnswerWord?: ReadonlyArray<string | null>
}

export interface SeedProgressOptions {
  /** Override `skillLevels`; merged on top of the diagnostic defaults. */
  skillLevelOverrides?: Record<string, string>
  /**
   * Append entries to `history`. Accepts the full `SessionHistoryEntry`
   * shape including every additive optional field (`latencyMs`,
   * `mathFacts`, `perProblemAnswerValue`, `perProblemAnswerWord`,
   * `novelPoolSuccessRate`). Arrays are deep-copied on the way in so
   * `as const` / frozen inputs are safe — see ticket 86c9xaybc.
   */
  history?: ReadonlyArray<SeedSessionHistoryEntry>
  /** ISO timestamp for `profile.lastPlayedISO`. */
  lastPlayedISO?: string | null
  /**
   * Override `parentSettings.masteryThreshold`. Useful for tests that
   * need a faster promotion path.
   */
  masteryThreshold?: { percent: number; sessions: number }
  /**
   * Override `lifetimeFirstEncounters` (ticket 86c9q9ben — AC9f).
   * When omitted, the field is left absent on the seeded blob —
   * the storage adapter's read-path defaulter fills it from the
   * skillLevels at load time, which means a seeded
   * `cvc-words-short-u: 'practicing'` Marian gets that node
   * inferred into the list (treated as already-encountered).
   * Tests that need to simulate a greenfield first encounter MUST
   * pass `lifetimeFirstEncounters: []` here so the gate fires.
   */
  lifetimeFirstEncounters?: ReadonlyArray<string>
  /**
   * Override `literacy.letterSoundsVowelStates` (Wave 9 W9.2 — ticket
   * 86c9ya3gd). Loose `Record<string, string>` shape so specs can pass
   * partial maps without TypeScript fighting them — same boundary-loose
   * posture as `skillLevelOverrides` (see `.claude/docs/testing-and-ci.md`
   * §4.1.1a). When omitted, the field is left absent on the seeded blob
   * and the storage adapter's read-path defaulter fills all four vowels
   * with `'intro'` at load time. Pass a partial map (e.g.
   * `{ '/o/': 'mastered' }`) to land a specific per-vowel state; the
   * defaulter fills the rest.
   */
  letterSoundsVowelStates?: Record<string, string>
}

/** Diagnostic defaults from `src/lib/progress/defaults.ts`. Mirrored here
 *  so e2e specs don't drag the app's `defaultProgress()` factory in. */
const DEFAULT_SKILL_LEVELS = {
  'number-recog': 'mastered',
  'add-to-10': 'practicing',
  'add-to-20': 'locked',
  'sub-to-10': 'mastered',
  'sub-to-20': 'intro',
  // Wave 5 (ticket 86c9y0bvc) sibling-tier split. Both default to
  // 'locked' to mirror the production `defaults.ts` schema floor —
  // an e2e blob seeded via `buildSeedProgress` that doesn't override
  // these keys still validates against the post-split guard. Specs
  // wanting to land the picker on either tier override explicitly
  // (e.g. `skillLevelOverrides: { 'two-digit-addsub-no-regroup': 'practicing' }`).
  'two-digit-addsub-no-regroup': 'locked',
  'two-digit-addsub-with-regroup': 'locked',
  'skip-counting': 'locked',
  'mult-2-5-10': 'intro',
  'mult-3-4': 'locked',
  'mult-6-9': 'locked',
  'letter-names': 'mastered',
  'letter-sounds': 'practicing',
  'blending-cv': 'practicing',
  'cvc-words': 'intro',
  'cvc-words-short-o': 'locked',
  'cvc-words-short-u': 'locked',
  'cvc-words-short-i': 'locked',
  'cvc-words-short-e': 'locked',
  // Digraphs split into 3 sequential sibling nodes per PR #211.
  'digraphs-sh': 'locked',
  'digraphs-ch': 'locked',
  'digraphs-th-voiceless': 'locked',
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
 * Deep-copy a `SeedSessionHistoryEntry` into the persisted `SessionHistoryEntry`
 * shape. Each array field is cloned so the seeded blob does not share
 * references with the caller's (possibly frozen) input. Optional fields
 * are emitted only when the caller supplied them — pre-existing absence
 * semantics are preserved (the read-path defaulter does its own thing
 * when a field is missing).
 *
 * Kept as a module-scope helper so the unit test below can exercise it
 * directly and so `buildSeedProgress` stays a clean one-liner over
 * `history.map(cloneSeedHistoryEntry)`.
 */
function cloneSeedHistoryEntry(
  h: SeedSessionHistoryEntry,
): SessionHistoryEntry {
  const out: SessionHistoryEntry = {
    dateISO: h.dateISO,
    skillFocus: [...h.skillFocus],
    successRate: h.successRate,
  }
  if (h.novelPoolSuccessRate !== undefined) {
    out.novelPoolSuccessRate = h.novelPoolSuccessRate
  }
  if (h.latencyMs !== undefined) {
    out.latencyMs = [...h.latencyMs]
  }
  if (h.mathFacts !== undefined) {
    out.mathFacts = h.mathFacts.map((f) => ({ a: f.a, b: f.b, op: f.op }))
  }
  if (h.perProblemAnswerValue !== undefined) {
    out.perProblemAnswerValue = [...h.perProblemAnswerValue]
  }
  if (h.perProblemAnswerWord !== undefined) {
    out.perProblemAnswerWord = [...h.perProblemAnswerWord]
  }
  return out
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
    history: opts.history?.map(cloneSeedHistoryEntry) ?? [],
    parentSettings: {
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: opts.masteryThreshold ?? { percent: 0.95, sessions: 3 },
      crossDayEnforcement: true,
      showLevelToMarian: false,
    },
    // Seed `lifetimeFirstEncounters` ONLY when the caller asks
    // explicitly. Otherwise leave the field absent — the production
    // read-path defaulter then fills it from skillLevels at load
    // time (ticket 86c9q9ben). Existing tests that don't care about
    // first-encounter scaffolding inherit the inferred-from-skillLevels
    // shape, which mirrors what a real Marian's localStorage would
    // produce after one read-cycle post-deploy.
    ...(opts.lifetimeFirstEncounters !== undefined
      ? { lifetimeFirstEncounters: [...opts.lifetimeFirstEncounters] }
      : {}),
    // Seed `literacy.letterSoundsVowelStates` ONLY when the caller asks
    // explicitly (Wave 9 W9.2 — ticket 86c9ya3gd). Otherwise leave the
    // `literacy` namespace absent — the production read-path defaulter
    // (`withDefaultedLetterSoundsVowelStates`) then fills all four vowels
    // with `'intro'` at load time, mirroring what a real Marian's
    // localStorage produces after one read-cycle post-deploy.
    ...(opts.letterSoundsVowelStates !== undefined
      ? {
          literacy: {
            letterSoundsVowelStates: { ...opts.letterSoundsVowelStates },
          },
        }
      : {}),
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
