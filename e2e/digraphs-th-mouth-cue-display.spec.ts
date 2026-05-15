/**
 * E2E spec — digraphs-th mouth-cue display (Placements A + B).
 *
 * Spec source: `design/word-song/digraphs-th-mouth-cue-integration.md`
 * Implementation ticket: #231 / PR that wires wording-cue placements.
 *
 * WHAT THIS SPEC COVERS
 * ----------------------
 * Four display-state assertions for the `emma-th-mouth.svg` mouth-cue:
 *
 *   1. First-encounter intro panel (Placement A) is VISIBLE before
 *      audioReady flips (i.e. during the Path A fetch window), and
 *      ABSENT after the gate opens. Requires a delayed mock.
 *   2. Returning-user `practicing` session: corner cue (Placement B)
 *      visible, intro panel (Placement A) absent.
 *   3. Non-th session (node level `locked`): NEITHER placement visible.
 *   4. Mastered node: NEITHER placement visible.
 *
 * All four tests are DOM-presence only — no audio playback is asserted.
 * No chip taps, no session walk. All four run on BOTH chromium and webkit.
 *
 * MOCK STRATEGY
 * -------------
 * Tests 2-4 use `installClaudeMock(page, { failNetwork: true })`. The
 * reject branch in App.tsx's catch handler still flips `wordSongAudioReady`
 * to `true`, which opens the problem-area gate and collapses Placement A.
 * For these tests that is fine — we only assert Placement B (corner cue)
 * or absence; Placement A is gated on first-encounter which is not set
 * in tests 2-4.
 *
 * Test 1 requires observing Placement A BEFORE audioReady flips. We use
 * `delayMs` so the fetch is in flight during the assertion window, then
 * assert A absent AFTER the delay expires and the gate opens.
 *
 * WHY NOT `forceHowlerUnlock`
 * ---------------------------
 * These tests don't walk chips or depend on the read-aloud completing.
 * `forceHowlerUnlock` is not needed — we only assert on two testids.
 *
 * BROWSER-ENGINE SUPPORT
 * ----------------------
 * All four tests run on chromium AND webkit. No AudioContext needed for
 * DOM presence assertions. Marian's real iPad Safari is unaffected by
 * any harness limitation here.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * Delay used for test 1 to hold the Path A fetch in flight while we
 * assert Placement A visible. Must be long enough for the assertions
 * to complete but short enough for the test not to time out.
 * 4 000 ms gives ample assertion headroom on parallel-worker CI.
 */
const FETCH_IN_FLIGHT_DELAY_MS = 4_000

/**
 * Seed: `digraphs-th-voiceless` is `intro`, absent from
 * `lifetimeFirstEncounters` → first-encounter session.
 * All preceding nodes mastered so `pickFocusNode` lands on th.
 */
function seedThFirstEncounterProgress(
  page: Parameters<typeof seedLocalStorage>[0],
) {
  const progress = buildSeedProgress({
    skillLevelOverrides: {
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'mastered',
      'cvc-words-short-o': 'mastered',
      'cvc-words-short-u': 'mastered',
      'cvc-words-short-i': 'mastered',
      'cvc-words-short-e': 'mastered',
      'digraphs-sh': 'mastered',
      'digraphs-ch': 'mastered',
      'digraphs-th-voiceless': 'intro',
      'sight-words': 'locked',
      'simple-sentences': 'locked',
    },
    // Empty array = greenfield; `digraphs-th-voiceless` not yet recorded
    // as encountered → Placement A fires.
    lifetimeFirstEncounters: [],
  })
  const progressWithSettings = {
    ...(progress as Record<string, unknown>),
    parentSettings: {
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: {
        math: { percent: 0.95, sessions: 3 },
        'word-song': { percent: 0.9, sessions: 3 },
      },
      crossDayEnforcement: false,
      showLevelToMarian: false,
    },
  }
  return seedLocalStorage(page, {
    progress: progressWithSettings,
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

/**
 * Seed: `digraphs-th-voiceless` is `practicing`.
 * `lifetimeFirstEncounters` includes `'digraphs-th-voiceless'` (already
 * encountered) → Placement A must NOT show; Placement B must show.
 */
function seedThPracticingProgress(
  page: Parameters<typeof seedLocalStorage>[0],
) {
  const progress = buildSeedProgress({
    skillLevelOverrides: {
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'mastered',
      'cvc-words-short-o': 'mastered',
      'cvc-words-short-u': 'mastered',
      'cvc-words-short-i': 'mastered',
      'cvc-words-short-e': 'mastered',
      'digraphs-sh': 'mastered',
      'digraphs-ch': 'mastered',
      'digraphs-th-voiceless': 'practicing',
      'sight-words': 'locked',
      'simple-sentences': 'locked',
    },
    lifetimeFirstEncounters: ['digraphs-th-voiceless'],
  })
  const progressWithSettings = {
    ...(progress as Record<string, unknown>),
    parentSettings: {
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: {
        math: { percent: 0.95, sessions: 3 },
        'word-song': { percent: 0.9, sessions: 3 },
      },
      crossDayEnforcement: false,
      showLevelToMarian: false,
    },
  }
  return seedLocalStorage(page, {
    progress: progressWithSettings,
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

/**
 * Seed: non-th session (digraphs-th-voiceless is `locked`).
 * focusNode will be cvc-words (or earlier). Neither placement should show.
 */
function seedNonThProgress(page: Parameters<typeof seedLocalStorage>[0]) {
  const progress = buildSeedProgress({
    skillLevelOverrides: {
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'intro',
      'cvc-words-short-o': 'locked',
      'cvc-words-short-u': 'locked',
      'cvc-words-short-i': 'locked',
      'cvc-words-short-e': 'locked',
      'digraphs-sh': 'locked',
      'digraphs-ch': 'locked',
      'digraphs-th-voiceless': 'locked',
      'sight-words': 'locked',
      'simple-sentences': 'locked',
    },
  })
  const progressWithSettings = {
    ...(progress as Record<string, unknown>),
    parentSettings: {
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: {
        math: { percent: 0.95, sessions: 3 },
        'word-song': { percent: 0.9, sessions: 3 },
      },
      crossDayEnforcement: false,
      showLevelToMarian: false,
    },
  }
  return seedLocalStorage(page, {
    progress: progressWithSettings,
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

/**
 * Seed: th node `mastered`. Neither placement should show.
 */
function seedThMasteredProgress(page: Parameters<typeof seedLocalStorage>[0]) {
  const progress = buildSeedProgress({
    skillLevelOverrides: {
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'mastered',
      'cvc-words-short-o': 'mastered',
      'cvc-words-short-u': 'mastered',
      'cvc-words-short-i': 'mastered',
      'cvc-words-short-e': 'mastered',
      'digraphs-sh': 'mastered',
      'digraphs-ch': 'mastered',
      'digraphs-th-voiceless': 'mastered',
      'sight-words': 'intro',
      'simple-sentences': 'locked',
    },
    lifetimeFirstEncounters: [
      'digraphs-th-voiceless',
      'digraphs-sh',
      'digraphs-ch',
    ],
  })
  const progressWithSettings = {
    ...(progress as Record<string, unknown>),
    parentSettings: {
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: {
        math: { percent: 0.95, sessions: 3 },
        'word-song': { percent: 0.9, sessions: 3 },
      },
      crossDayEnforcement: false,
      showLevelToMarian: false,
    },
  }
  return seedLocalStorage(page, {
    progress: progressWithSettings,
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

test.describe('digraphs-th mouth-cue display — Placements A + B (spec #231)', () => {
  /**
   * Test 1 — First-encounter session: Placement A (intro panel) visible
   * during the fetch window, absent after audioReady flips.
   *
   * Uses `delayMs` to hold the fetch in flight. During the in-flight
   * window, Placement A must be in the DOM (the gate is `audioReady !== true`
   * which is `false` during the fetch). After the delay expires the catch
   * handler flips `wordSongAudioReady` to `true`; Placement A exits via
   * AnimatePresence.
   *
   * Placement B (corner cue) is also visible during and after the fetch
   * because `digraphsThNodeLevel === 'intro'`.
   */
  test('1. first-encounter: intro panel (A) visible pre-audioReady, absent post-flip; corner cue (B) present throughout', async ({
    page,
  }) => {
    await installClaudeMock(page, {
      failNetwork: true,
      delayMs: FETCH_IN_FLIGHT_DELAY_MS,
    })
    await seedThFirstEncounterProgress(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 5_000 })

    // Pre-flip: fetch is in flight, audioReady is still false.
    // Placement A must be visible (first-encounter intro panel).
    // Placement B must also be visible (node is 'intro').
    await expect(page.getByTestId('th-intro-panel')).toBeVisible()
    await expect(page.getByTestId('th-corner-cue')).toBeVisible()

    // Post-flip: delay expires, catch handler flips audioReady=true,
    // Placement A exits via AnimatePresence (200ms fade).
    // Give AnimatePresence time to complete the exit animation.
    await expect(page.getByTestId('th-intro-panel')).toHaveCount(0, {
      timeout: FETCH_IN_FLIGHT_DELAY_MS + 2_000,
    })
    // Placement B stays (corner cue is static once mounted).
    await expect(page.getByTestId('th-corner-cue')).toBeVisible()
  })

  /**
   * Test 2 — Returning-user `practicing` session: corner cue (B) visible,
   * intro panel (A) absent (node is NOT first-encounter).
   *
   * `failNetwork: true` immediately flips audioReady via catch path;
   * Placement A was never mounted because `digraphsThFirstEncounter=false`
   * (lifetimeFirstEncounters includes the node). Placement B is shown
   * because node level is `practicing`.
   */
  test('2. practicing: corner cue (B) visible, intro panel (A) absent', async ({
    page,
  }) => {
    await installClaudeMock(page, { failNetwork: true })
    await seedThPracticingProgress(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 5_000 })

    // Wait for audioReady to flip (failNetwork resolves quickly).
    // Problem area gate opens — Placement A was never mounted.
    await expect(page.getByTestId('word-song-chips')).toBeVisible({
      timeout: 8_000,
    })

    await expect(page.getByTestId('th-corner-cue')).toBeVisible()
    await expect(page.getByTestId('th-intro-panel')).toHaveCount(0)
  })

  /**
   * Test 3 — Non-th session (th node `locked`): neither placement visible.
   *
   * focusNode is cvc-words. `digraphsThNodeLevel` defaults to `'locked'`
   * which is neither `intro` nor `practicing` → both placements absent.
   */
  test('3. non-th session (locked): neither intro panel (A) nor corner cue (B) visible', async ({
    page,
  }) => {
    await installClaudeMock(page, { failNetwork: true })
    await seedNonThProgress(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 5_000 })

    // Wait for gate to open before asserting absence (rule out
    // "not yet mounted" false-negative for Placement B).
    await expect(page.getByTestId('word-song-chips')).toBeVisible({
      timeout: 8_000,
    })

    await expect(page.getByTestId('th-intro-panel')).toHaveCount(0)
    await expect(page.getByTestId('th-corner-cue')).toHaveCount(0)
  })

  /**
   * Test 4 — th node `mastered`: neither placement visible.
   *
   * `mastered` is explicitly out-of-scope for both placements per spec §3.
   * focusNode would advance to `sight-words` (next unlocked node), so the
   * session isn't a th session at all. Belt-and-suspenders: even if the
   * planner somehow served th content, the cue must not render when the
   * node is mastered.
   */
  test('4. th mastered: neither placement visible', async ({ page }) => {
    await installClaudeMock(page, { failNetwork: true })
    await seedThMasteredProgress(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 5_000 })

    // Wait for gate to open.
    await expect(page.getByTestId('word-song-chips')).toBeVisible({
      timeout: 8_000,
    })

    await expect(page.getByTestId('th-intro-panel')).toHaveCount(0)
    await expect(page.getByTestId('th-corner-cue')).toHaveCount(0)
  })
})
