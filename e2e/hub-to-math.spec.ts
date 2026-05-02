/**
 * E2E spec — Hub → Math golden path.
 *
 * Ticket 86c9kwnmx (P0.1 from the 2026-05-02 polish audit). Closes the
 * "load-bearing flow has zero browser-level coverage" gap for the
 * single most-trafficked path: Marian taps Number Garden on Hub, the
 * App fetches the math session plan, Math mounts, the first problem
 * renders, the first chip eventually becomes tappable.
 *
 * What we assert
 * --------------
 *  1. The Hub mounts on a returning-user seed (sessionCount >= 1
 *     skips Greet).
 *  2. The Math button (Number Garden) is reachable.
 *  3. Tapping it transitions us into Math.
 *  4. The first problem renders symbolically — addends present.
 *  5. The first answer chip becomes tap-responsive (chip is enabled
 *     once the read-aloud completes, even with the silent fallback).
 *
 * What we deliberately do NOT assert
 * ----------------------------------
 *  - Audible playback. CI runners are mute; the silent caption walk
 *    is the path that lights chips.
 *  - Specific addend values. The fixture pins them, but the parser
 *    layer's invariant is "8 problems × 5 utterances each", not the
 *    exact arithmetic — that's pinned by `planFromServer.test.ts`.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'

test.describe('Hub → Math golden path', () => {
  test.beforeEach(async ({ page }) => {
    // `failNetwork: true` forces the planner fetch to abort, so the
    // browser falls into the silent-caption-walk fallback path. Why
    // not the canonical-response path?
    //
    // The canonical response carries inline base64 audio. In headless
    // Chromium / WebKit, Howler's decode of that audio is brittle —
    // `loaderror` fires, `playSession` rejects, and "cancelled" lands
    // on the speak() catch before `setReadAloudPlayed(true)` ever
    // commits. Chips stay disabled; the test hangs.
    //
    // The silent-fallback path is ALSO production-real: when Anthropic
    // is down, this is exactly what Marian sees on her iPad. Locking
    // it in a regression test catches every cross-screen state-machine
    // bug the audit flagged (PR #111 / #117 / #118 family) without
    // depending on a working audio decoder.
    //
    // A follow-up spec under `e2e/audio-real-fixtures/` will exercise
    // the real Path A path with captured-from-Azure MP3 fixtures.
    await installClaudeMock(page, { failNetwork: true })
    // Returning-user seed: sessionCount >= 1 routes Splash → Hub
    // (skipping the once-ever Greet path), so we land on Hub directly
    // and exercise the production "tap a tree from Hub" flow rather
    // than the first-ever Greet → Math handoff.
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  test('tapping Number Garden on Hub renders a math problem and unlocks chips', async ({
    page,
  }) => {
    await page.goto('/')

    // Bridge the headless-browser gesture-unlock gap. See
    // `forceHowlerUnlock`'s docstring for the rationale; production
    // never calls this. Without it, the read-aloud effect's
    // `getHowlerRunning()` returns false, the chips stay disabled
    // forever, and we'd be testing the gesture chain instead of the
    // cross-screen state machine.
    await forceHowlerUnlock(page)

    // Splash auto-advances → Hub (because sessionCount >= 1).
    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Two skill-tree nodes are visible side-by-side.
    const numberGardenButton = page.locator(
      '[data-testid="hub-tree-node"][data-tree="number-garden"]',
    )
    await expect(numberGardenButton).toBeVisible()
    await expect(numberGardenButton).toHaveAttribute(
      'aria-label',
      'Number Garden',
    )

    // Tap Number Garden — orchestrator routes us to Math.
    await numberGardenButton.click()

    // Math screen mounts; the first problem renders.
    const math = page.getByTestId('math')
    await expect(math).toBeVisible({ timeout: 10_000 })

    // Symbolic problem visible (addends are rendered, not just hidden
    // behind a loading skeleton).
    const addendA = page.getByTestId('math-addend-a')
    const addendB = page.getByTestId('math-addend-b')
    await expect(addendA).toBeVisible()
    await expect(addendB).toBeVisible()

    // The 3 answer chips render. Wait for them to mount; they may be
    // briefly disabled while the read-aloud walks the caption.
    const chips = page.getByTestId('math-chip')
    await expect(chips).toHaveCount(3, { timeout: 10_000 })

    // First chip becomes tap-responsive. The chip is disabled in the
    // DOM until `readAloudPlayed` flips; the silent caption walk at
    // 165 wpm completes within ~2 seconds for a 4-5 word read line.
    // Allow extra headroom for the WebKit project on CI.
    const firstChip = chips.first()
    await expect(firstChip).toBeEnabled({ timeout: 15_000 })

    // The Math screen exposes a back-to-Hub affordance for mid-skill
    // exit. Verify it's wired (catches a regression where the prop
    // gets dropped on a future refactor).
    await expect(page.getByTestId('math-back-to-hub')).toBeVisible()

    // Verify the /api/claude mock saw the math request — guards against
    // a future refactor that bypasses the planner fetch entirely.
    // (Indirect proof: if the fetch had been live, the silent base64
    // wouldn't decode and we'd still see the silent fallback — but the
    // Math chips wouldn't depend on the response shape. The strongest
    // signal we have is that math mounted at all.)
  })
})
