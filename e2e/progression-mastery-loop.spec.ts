/**
 * E2E spec — Progression mastery loop: intro → practicing → mastered.
 *
 * Ticket 86c9qu91g — covers the gap that allowed the intro→practicing
 * missing-transition bug to ship to production undetected.
 *
 * THE BUG (current main, before Kevin's fix)
 * ------------------------------------------
 * `applyMasteryRule()` in `src/lib/progress/mastery.ts` line ~277:
 *
 *   if (out.skillLevels[node] !== 'practicing') continue
 *
 * This check explicitly SKIPS nodes at `'intro'`. The mastery rule
 * handles `practicing → mastered` (and `locked → intro` for downstream
 * unlocks) but has NO path for `intro → practicing`. As a result, four
 * default-`'intro'` nodes in the diagnostic baseline are permanently
 * stuck:
 *
 *   - `cvc-words`    (word-song track, diagnostic default)
 *   - `sub-to-20`    (math track, diagnostic default)
 *   - `mult-2-5-10`  (math track, diagnostic default)
 *   - `sight-words`  (word-song track, diagnostic default)
 *
 * Each of the four test suites below:
 *   1. Seeds a state where the target node is at `'intro'`.
 *   2. Runs 2 perfect sessions (threshold: 80% / 2 sessions, crossDay off).
 *   3. Asserts the node advanced to `'mastered'` and its downstream
 *      neighbour unlocked to `'intro'`.
 *
 * EXPECTED BEHAVIOUR ON CURRENT MAIN (before the fix)
 * ----------------------------------------------------
 * All four "session 2 promotions" assertions FAIL with something like:
 *   expect(received).toBe(expected)
 *   Expected: "mastered"
 *   Received: "intro"
 *
 * This spec turns GREEN once Kevin's PR (#fix/86c9qu91g-intro-to-practicing)
 * merges. Do not rebase this branch onto his fix branch — the failing-test-
 * first discipline is the point.
 *
 * Threshold choice
 * ----------------
 * The spec uses `percent: 0.8, sessions: 2` with `crossDayEnforcement: false`
 * so two back-to-back sessions suffice. This is the most lenient preset
 * (80/2) and sidesteps cross-day de-dupe complexity entirely. Both the
 * bug class (intro node never promotes regardless of session count) and
 * the fix (intro → practicing on first encounter, then standard rule
 * fires) are observable at any threshold.
 *
 * Session-driving strategy
 * ------------------------
 * Math sessions use `failNetwork: true` (silent caption-walk fallback).
 * Word-song sessions also use `failNetwork: true` — the static plan
 * (`pickStaticWordSongPlan`) drives chip render, and the caption-walk
 * fallback fires `audioReady` so chips enable. Both approaches let the
 * spec run without paying audio-decode costs in CI.
 *
 * Chromium-only
 * -------------
 * Like `mastery-promotion.spec.ts`, these tests depend on chips enabling
 * (which requires the read-aloud gate to flip). WebKit headless has no
 * AudioContext; the read-aloud effect short-circuits on WebKit and chips
 * never enable. All four suites are chromium-only.
 *
 * Count-based assertions
 * ----------------------
 * Per `feedback_count_assertions_on_regression_tests`: every assertion on
 * the promoted state uses `.toBe()` with an exact expected value, not
 * `.toContain`. The `history.length` assertions also use exact counts.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  forceHowlerUnlock,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

interface PersistedProgress {
  skillLevels: Record<string, string>
  history: Array<{ dateISO: string; skillFocus: string[]; successRate: number }>
}

// ── shared helpers ─────────────────────────────────────────────────────────

/**
 * Drive one complete math session: Hub → Number Garden → 8 correct chip
 * taps → SessionEnd → "All done!" → Hub.
 *
 * The session records a 1.0 successRate entry for whatever node is the
 * current focus (the focus picker picks it from `skillLevels` at
 * session-end). Returns when Hub re-mounts.
 */
async function runOneMathSession(
  page: import('@playwright/test').Page,
): Promise<void> {
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  await page
    .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
    .click()
  await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

  for (let i = 1; i <= 8; i++) {
    const correctChip = page.locator(
      '[data-testid="math-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 15_000 })
    await correctChip.click()
    if (i < 8) {
      await page.waitForTimeout(1500)
    }
  }

  await expect(page.getByTestId('session-end')).toBeVisible({ timeout: 10_000 })
  const cta = page.getByTestId('session-end-cta')
  await expect(cta).toBeVisible({ timeout: 12_000 })
  await cta.click()
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
}

/**
 * Drive one complete word-song session: Hub → Word Song → 8 correct chip
 * taps → SessionEnd → "All done!" → Hub.
 *
 * Uses the static word-song plan (failNetwork path) — chips become enabled
 * after the caption-walk fallback fires `audioReady`. Returns when Hub
 * re-mounts.
 */
async function runOneWordSongSession(
  page: import('@playwright/test').Page,
): Promise<void> {
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  await page
    .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
    .click()
  await expect(page.getByTestId('word-song')).toBeVisible({ timeout: 10_000 })

  for (let i = 1; i <= 8; i++) {
    const correctChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 15_000 })
    await correctChip.click()
    if (i < 8) {
      await page.waitForTimeout(1500)
    }
  }

  await expect(page.getByTestId('session-end')).toBeVisible({ timeout: 10_000 })
  const cta = page.getByTestId('session-end-cta')
  await expect(cta).toBeVisible({ timeout: 12_000 })
  await cta.click()
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
}

// ── Part 1 — cvc-words (word-song track) ──────────────────────────────────

test.describe('Progression loop — cvc-words (intro → mastered)', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page, { failNetwork: true })

    // Seed: all word-song prerequisites mastered so pickFocusNode lands on
    // cvc-words. cvc-words itself is at 'intro'. cvc-words-short-o is
    // 'locked' (the downstream node we expect to flip to 'intro').
    // Threshold: 80%/2 sessions, crossDay off so two same-session runs qualify.
    const progress = buildSeedProgress({
      skillLevelOverrides: {
        'letter-names': 'mastered',
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'intro',
        'cvc-words-short-o': 'locked',
        // Keep subsequent nodes locked so focus stays on cvc-words.
        'cvc-words-short-u': 'locked',
        'cvc-words-short-i': 'locked',
        digraphs: 'locked',
        'sight-words': 'locked',
        'simple-sentences': 'locked',
      },
      masteryThreshold: { percent: 0.8, sessions: 2 },
    })

    // parentSettings.crossDayEnforcement must be false for two back-to-back
    // sessions to qualify. buildSeedProgress uses crossDayEnforcement: true
    // by default; override via a full parentSettings merge inside the raw
    // seed object.
    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: { 'word-song': { percent: 0.8, sessions: 2 } },
        crossDayEnforcement: false,
        showLevelToMarian: false,
      },
    }

    await seedLocalStorage(page, {
      progress: progressWithNoCrossDay,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  /**
   * FAILS on current main: applyMasteryRule skips 'intro' nodes so
   * cvc-words never advances past 'intro' regardless of session count.
   *
   * PASSES once Kevin's fix lands: intro → practicing on first session,
   * practicing → mastered after 2 qualifying sessions, cvc-words-short-o
   * unlocks to 'intro'.
   */
  test(
    '[chromium] two perfect cvc-words sessions promote intro → mastered and unlock cvc-words-short-o',
    { tag: '@chromium' },
    async ({ page }) => {
      await page.goto('/')
      await forceHowlerUnlock(page)

      // Session 1: intro → practicing (after fix)
      await runOneWordSongSession(page)

      // Session 2: practicing → mastered if qualifies (after fix)
      await runOneWordSongSession(page)

      const persisted = (await readProgressFromPage(page)) as PersistedProgress
      expect(persisted).not.toBeNull()

      // THE SMOKING GUN — fails on main, passes after Kevin's fix.
      expect(persisted.skillLevels['cvc-words']).toBe('mastered')

      // Downstream unlock: cvc-words-short-o should flip locked → intro.
      expect(persisted.skillLevels['cvc-words-short-o']).toBe('intro')

      // History grew by exactly 2 entries (we seeded 0 and ran 2 sessions).
      expect(persisted.history.length).toBe(2)

      // Both entries targeted cvc-words and were perfect.
      const lastTwo = persisted.history.slice(-2)
      expect(lastTwo[0]!.successRate).toBe(1)
      expect(lastTwo[1]!.successRate).toBe(1)
      expect(lastTwo[0]!.skillFocus).toEqual(['cvc-words'])
      expect(lastTwo[1]!.skillFocus).toEqual(['cvc-words'])
    },
  )
})

// ── Part 2a — sub-to-20 (math track) ──────────────────────────────────────

test.describe('Progression loop — sub-to-20 (intro → mastered)', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page, { failNetwork: true })

    // Seed: all math prerequisites mastered so pickFocusNode lands on
    // sub-to-20. sub-to-20 at 'intro'. two-digit-addsub 'locked'.
    const progress = buildSeedProgress({
      skillLevelOverrides: {
        'number-recog': 'mastered',
        'add-to-10': 'mastered',
        'add-to-20': 'mastered',
        'sub-to-10': 'mastered',
        'sub-to-20': 'intro',
        'two-digit-addsub': 'locked',
        'skip-counting': 'locked',
        'mult-2-5-10': 'locked',
        'mult-3-4': 'locked',
        'mult-6-9': 'locked',
      },
      masteryThreshold: { percent: 0.8, sessions: 2 },
    })

    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: { math: { percent: 0.8, sessions: 2 } },
        crossDayEnforcement: false,
        showLevelToMarian: false,
      },
    }

    await seedLocalStorage(page, {
      progress: progressWithNoCrossDay,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  /**
   * FAILS on current main: sub-to-20 stays at 'intro' forever.
   * PASSES after Kevin's fix: intro → practicing → mastered in 2 sessions.
   */
  test(
    '[chromium] two perfect sub-to-20 sessions promote intro → mastered and unlock two-digit-addsub',
    { tag: '@chromium' },
    async ({ page }) => {
      await page.goto('/')
      await forceHowlerUnlock(page)

      await runOneMathSession(page)
      await runOneMathSession(page)

      const persisted = (await readProgressFromPage(page)) as PersistedProgress
      expect(persisted).not.toBeNull()

      expect(persisted.skillLevels['sub-to-20']).toBe('mastered')
      expect(persisted.skillLevels['two-digit-addsub']).toBe('intro')

      expect(persisted.history.length).toBe(2)
      const lastTwo = persisted.history.slice(-2)
      expect(lastTwo[0]!.successRate).toBe(1)
      expect(lastTwo[1]!.successRate).toBe(1)
      expect(lastTwo[0]!.skillFocus).toEqual(['sub-to-20'])
      expect(lastTwo[1]!.skillFocus).toEqual(['sub-to-20'])
    },
  )
})

// ── Part 2b — mult-2-5-10 (math track) ────────────────────────────────────

test.describe('Progression loop — mult-2-5-10 (intro → mastered)', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page, { failNetwork: true })

    // Seed: all math prerequisites mastered so pickFocusNode lands on
    // mult-2-5-10. mult-2-5-10 at 'intro'. mult-3-4 'locked'.
    const progress = buildSeedProgress({
      skillLevelOverrides: {
        'number-recog': 'mastered',
        'add-to-10': 'mastered',
        'add-to-20': 'mastered',
        'sub-to-10': 'mastered',
        'sub-to-20': 'mastered',
        'two-digit-addsub': 'mastered',
        'skip-counting': 'mastered',
        'mult-2-5-10': 'intro',
        'mult-3-4': 'locked',
        'mult-6-9': 'locked',
      },
      masteryThreshold: { percent: 0.8, sessions: 2 },
    })

    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: { math: { percent: 0.8, sessions: 2 } },
        crossDayEnforcement: false,
        showLevelToMarian: false,
      },
    }

    await seedLocalStorage(page, {
      progress: progressWithNoCrossDay,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  /**
   * FAILS on current main: mult-2-5-10 stays at 'intro' forever.
   * PASSES after Kevin's fix.
   */
  test(
    '[chromium] two perfect mult-2-5-10 sessions promote intro → mastered and unlock mult-3-4',
    { tag: '@chromium' },
    async ({ page }) => {
      await page.goto('/')
      await forceHowlerUnlock(page)

      await runOneMathSession(page)
      await runOneMathSession(page)

      const persisted = (await readProgressFromPage(page)) as PersistedProgress
      expect(persisted).not.toBeNull()

      expect(persisted.skillLevels['mult-2-5-10']).toBe('mastered')
      expect(persisted.skillLevels['mult-3-4']).toBe('intro')

      expect(persisted.history.length).toBe(2)
      const lastTwo = persisted.history.slice(-2)
      expect(lastTwo[0]!.successRate).toBe(1)
      expect(lastTwo[1]!.successRate).toBe(1)
      expect(lastTwo[0]!.skillFocus).toEqual(['mult-2-5-10'])
      expect(lastTwo[1]!.skillFocus).toEqual(['mult-2-5-10'])
    },
  )
})

// ── Part 2c — sight-words (word-song track) ────────────────────────────────

test.describe('Progression loop — sight-words (intro → mastered)', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page, { failNetwork: true })

    // Seed: all word-song prerequisites mastered so pickFocusNode lands on
    // sight-words. sight-words at 'intro'. simple-sentences 'locked'.
    const progress = buildSeedProgress({
      skillLevelOverrides: {
        'letter-names': 'mastered',
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'mastered',
        'cvc-words-short-o': 'mastered',
        'cvc-words-short-u': 'mastered',
        'cvc-words-short-i': 'mastered',
        digraphs: 'mastered',
        'sight-words': 'intro',
        'simple-sentences': 'locked',
      },
      masteryThreshold: { percent: 0.8, sessions: 2 },
    })

    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: { 'word-song': { percent: 0.8, sessions: 2 } },
        crossDayEnforcement: false,
        showLevelToMarian: false,
      },
    }

    await seedLocalStorage(page, {
      progress: progressWithNoCrossDay,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  /**
   * FAILS on current main: sight-words stays at 'intro' forever.
   * PASSES after Kevin's fix: intro → practicing → mastered, simple-sentences
   * unlocks to 'intro'.
   */
  test(
    '[chromium] two perfect sight-words sessions promote intro → mastered and unlock simple-sentences',
    { tag: '@chromium' },
    async ({ page }) => {
      await page.goto('/')
      await forceHowlerUnlock(page)

      await runOneWordSongSession(page)
      await runOneWordSongSession(page)

      const persisted = (await readProgressFromPage(page)) as PersistedProgress
      expect(persisted).not.toBeNull()

      expect(persisted.skillLevels['sight-words']).toBe('mastered')
      expect(persisted.skillLevels['simple-sentences']).toBe('intro')

      expect(persisted.history.length).toBe(2)
      const lastTwo = persisted.history.slice(-2)
      expect(lastTwo[0]!.successRate).toBe(1)
      expect(lastTwo[1]!.successRate).toBe(1)
      expect(lastTwo[0]!.skillFocus).toEqual(['sight-words'])
      expect(lastTwo[1]!.skillFocus).toEqual(['sight-words'])
    },
  )
})
