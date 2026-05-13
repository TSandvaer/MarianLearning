/**
 * E2E spec — Progression mastery loop: intro → practicing → mastered.
 *
 * Ticket 86c9qu91g — covers the gap that allowed the intro→practicing
 * missing-transition bug to ship to production undetected.
 *
 * THE BUG (pre-fix on main)
 * -------------------------
 * `applyMasteryRule()` in `src/lib/progress/mastery.ts` only walked nodes
 * at `'practicing'` and explicitly skipped `'intro'`. The mastery rule
 * handled `practicing → mastered` (and `locked → intro` for downstream
 * unlocks) but had NO path for `intro → practicing`. As a result, four
 * default-`'intro'` nodes in the diagnostic baseline were permanently
 * stuck:
 *
 *   - `cvc-words`    (word-song track, diagnostic default)
 *   - `sub-to-20`    (math track, diagnostic default)
 *   - `mult-2-5-10`  (math track, diagnostic default)
 *   - `sight-words`  (word-song track, diagnostic default)
 *
 * Kevin's fix in PR #201 (commit `ce9c557`) added the intro→practicing
 * pass before the practicing→mastered scan. Rule: if history contains any
 * entry for the node with `successRate > 0`, advance to `'practicing'`.
 *
 * What these four suites lock in
 * ------------------------------
 * Each suite seeds the target node at `'intro'` with prerequisites
 * mastered, runs 2 perfect sessions (80%/2 threshold, crossDay off), and
 * asserts the post-fix terminal state.
 *
 * Graduation-gate caveat for cvc-words
 * ------------------------------------
 * `cvc-words` is graduation-gated (`WORD_SONG_GRADUATION_GATED_NODES`):
 * mastery requires a graduation session with a passing
 * `novelPoolSuccessRate`. Two plain perfect sessions advance it to
 * `'practicing'` but NOT to `'mastered'` — that's the documented
 * behaviour Kevin's own mastery.test.ts case validates. The downstream
 * `cvc-words-short-o` therefore stays `'locked'` (the unlock cascade
 * only fires on `'mastered'`). The cvc-words assertion below is the
 * `intro → practicing` half of the ladder; the graduation-session test
 * is a separate concern (covered by `plannerRoundTrip` + the existing
 * cvc-words regression specs).
 *
 * The OTHER three nodes (`sub-to-20`, `mult-2-5-10`, `sight-words`) are
 * NOT graduation-gated, so two perfect sessions DO advance them all the
 * way to `'mastered'` with the downstream node flipped to `'intro'`.
 *
 * Threshold + cross-day setup
 * ---------------------------
 * 80%/2 with `crossDayEnforcement: false` so two back-to-back sessions
 * qualify. This is the most lenient preset and sidesteps day-key
 * complexity. The bug (intro stuck forever) and the fix (intro→practicing
 * pass) are observable at any threshold; we pick the cheapest one.
 *
 * Session-driving strategy
 * ------------------------
 * Both math and word-song sessions use `failNetwork: true` (silent
 * caption-walk fallback driven by the static plan). Chips become
 * enabled once the read-aloud effect's `audioReady` flips true. No
 * audio-decode costs in CI.
 *
 * Chromium-only (webkit skip)
 * ---------------------------
 * WebKit headless has no AudioContext; the read-aloud effect's
 * `getHowlerRunningFn()` predicate stays false forever and chips never
 * enable. This is a Playwright harness limitation — real iPad Safari has
 * a working AudioContext post-gesture. Mirroring the pattern in
 * `cvc-words-regression.spec.ts`, each test calls `skipOnWebkitHeadless`
 * to skip on the webkit project. The progression-state-machine surface
 * is engine-agnostic; chromium coverage is sufficient.
 *
 * Count-based assertions
 * ----------------------
 * Per `feedback_count_assertions_on_regression_tests`: `.toBe()` with
 * exact expected values, `.toEqual([...])` for arrays. Never `.toContain`.
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

/**
 * WebKit headless has no AudioContext. Read-aloud effect's
 * `getHowlerRunningFn()` predicate stays false forever; chips never
 * become enabled and any chip-tap test times out. Real iPad Safari
 * works fine — this is a Playwright harness limitation only.
 *
 * Pattern mirrored from `cvc-words-regression.spec.ts:282-290`.
 */
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud cannot fire. Chromium coverage is sufficient for progression state-machine surface.',
  )
}

// ── shared helpers ─────────────────────────────────────────────────────────

/**
 * Drive one complete math session: Hub → Number Garden → 8 correct chip
 * taps → SessionEnd → "All done!" → Hub.
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

// ── Part 1 — cvc-words (graduation-gated; verifies intro → practicing) ─────

test.describe('Progression loop — cvc-words (intro → practicing, graduation-gated)', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page, { failNetwork: true })

    // Seed: all word-song prerequisites mastered so pickFocusNode lands on
    // cvc-words. cvc-words at 'intro'. cvc-words-short-o 'locked'.
    const progress = buildSeedProgress({
      skillLevelOverrides: {
        'letter-names': 'mastered',
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'intro',
        'cvc-words-short-o': 'locked',
        'cvc-words-short-u': 'locked',
        'cvc-words-short-i': 'locked',
        digraphs: 'locked',
        'sight-words': 'locked',
        'simple-sentences': 'locked',
      },
      masteryThreshold: { percent: 0.8, sessions: 2 },
    })

    // crossDayEnforcement: false so two back-to-back sessions both count.
    // buildSeedProgress hardcodes crossDayEnforcement: true; replace the
    // whole parentSettings via raw spread to override.
    //
    // GOTCHA — `isParentSettings` is STRICT on the per-track shape: when
    // `'math' in mt || 'word-song' in mt`, BOTH `mt.math` AND
    // `mt['word-song']` must be valid thresholds (guards.ts:193-197). A
    // single-track seed (`{ 'word-song': {...} }` alone) makes the guard
    // reject the whole `parentSettings` → `isProgressV1` rejects the
    // blob → `loadProgress()` returns null → app falls back to
    // defaultProgress(). Silent seed-rejection failure mode. Include
    // both tracks here.
    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
          'word-song': { percent: 0.8, sessions: 2 },
        },
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
   * Pre-fix: cvc-words stays at 'intro' forever.
   * Post-fix: 2 perfect sessions advance cvc-words to 'practicing'.
   *
   * Graduation-gate caveat: cvc-words is in
   * `WORD_SONG_GRADUATION_GATED_NODES`. Two plain perfect sessions are
   * NOT sufficient for 'mastered' — the graduation gate requires a
   * novelPoolSuccessRate entry. So we assert the half of the ladder
   * Kevin's fix actually closes: intro → practicing. cvc-words-short-o
   * stays 'locked' (downstream unlock cascades on 'mastered' only).
   */
  test('two perfect cvc-words sessions advance intro → practicing (graduation gate holds short-o locked)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    await page.goto('/')
    await forceHowlerUnlock(page)

    await runOneWordSongSession(page)
    await runOneWordSongSession(page)

    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()

    // THE SMOKING GUN — pre-fix: 'intro'. Post-fix: 'practicing'.
    expect(persisted.skillLevels['cvc-words']).toBe('practicing')

    // Downstream stays locked — unlock only fires on 'mastered' promotion.
    expect(persisted.skillLevels['cvc-words-short-o']).toBe('locked')

    // History grew by exactly 2 entries.
    expect(persisted.history.length).toBe(2)
    const lastTwo = persisted.history.slice(-2)
    expect(lastTwo[0]!.successRate).toBe(1)
    expect(lastTwo[1]!.successRate).toBe(1)
    expect(lastTwo[0]!.skillFocus).toEqual(['cvc-words'])
    expect(lastTwo[1]!.skillFocus).toEqual(['cvc-words'])
  })
})

// ── Part 2a — sub-to-20 (math, not graduation-gated) ──────────────────────

test.describe('Progression loop — sub-to-20 (intro → mastered)', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page, { failNetwork: true })

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

    // Both tracks required by isParentSettings strict per-track guard
    // (see cvc-words describe block above for full gotcha note).
    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
          'word-song': { percent: 0.8, sessions: 2 },
        },
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
   * Pre-fix: sub-to-20 stays at 'intro' forever.
   * Post-fix: 2 perfect sessions → intro → practicing → mastered in one
   * ladder traversal (intro→practicing pass fires session 1; practicing→
   * mastered fires session 2 with both qualifying entries). two-digit-addsub
   * unlocks from 'locked' → 'intro'.
   */
  test('two perfect sub-to-20 sessions promote intro → mastered and unlock two-digit-addsub', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

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
  })
})

// ── Part 2b — mult-2-5-10 (math, not graduation-gated) ─────────────────────

test.describe('Progression loop — mult-2-5-10 (intro → mastered)', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page, { failNetwork: true })

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

    // Both tracks required (see cvc-words describe block for the gotcha).
    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
          'word-song': { percent: 0.8, sessions: 2 },
        },
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
   * Pre-fix: mult-2-5-10 stays at 'intro' forever.
   * Post-fix: full intro → practicing → mastered ladder, mult-3-4 unlocks.
   */
  test('two perfect mult-2-5-10 sessions promote intro → mastered and unlock mult-3-4', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

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
  })
})

// ── Part 2c — sight-words (word-song, not graduation-gated) ────────────────

test.describe('Progression loop — sight-words (intro → mastered)', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page, { failNetwork: true })

    // Seed: all word-song prerequisites mastered (including digraphs, the
    // node directly before sight-words in WORD_SONG_NODES_IN_ORDER).
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

    // Both tracks required (see cvc-words describe block for the gotcha).
    const progressWithNoCrossDay = {
      ...(progress as Record<string, unknown>),
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
          'word-song': { percent: 0.8, sessions: 2 },
        },
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
   * Pre-fix: sight-words stays at 'intro' forever.
   * Post-fix: full intro → practicing → mastered, simple-sentences unlocks.
   */
  test('two perfect sight-words sessions promote intro → mastered and unlock simple-sentences', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

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
  })
})
