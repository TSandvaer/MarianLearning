/**
 * E2E spec — Path A fetch abort on rapid Hub ↔ Math bounce.
 *
 * Ticket 86c9kxp3j (top-4 race-bug e2e specs from the polish-audit
 * roadmap). Closes audit P1.6: the `mathFetchStartedRef` latch could
 * stay `true` while the in-flight fetch was aborted, so a re-entry
 * into Math wouldn't re-fire the fetch. The leave-effect in App.tsx
 * does reset the latch (and abort the controller) when route leaves
 * the audio surfaces — but the audit flagged this as untested in the
 * browser.
 *
 * Scenario this spec exercises
 * ----------------------------
 *  1. Returning-user mounts Hub (`sessionCount: 5`).
 *  2. Marian taps Number Garden — Math mounts, fetch goes in flight,
 *     `mathFetchStartedRef = true`, `mathAbortRef = controller`.
 *  3. Before the fetch settles, Marian taps the back-arrow — route
 *     flips to `hub`. App.tsx's leave-effect aborts the in-flight
 *     fetch, resets `mathFetchStartedRef = false`, clears
 *     `mathAudioReady = false`.
 *  4. Marian immediately re-taps Number Garden — route flips to
 *     `math` again. The ref is now `false`; the kick-effect re-runs;
 *     a fresh fetch is issued.
 *  5. Eventually `mathAudioReady` flips true and the problem area
 *     renders. The screen does NOT brick on a stale latch.
 *
 * What we assert (per task contract — "doesn't brick on stale latch")
 * ------------------------------------------------------------------
 *  - Re-entry into Math does NOT leave the audio gate stuck. The
 *    Math root's `data-read-aloud-played` attribute eventually flips
 *    to `true` and the problem area becomes visible. (Pre-fix shape
 *    of the audit concern: gate stays false forever; problem area
 *    never renders; chips never enable.)
 *  - This is the load-bearing user-facing contract. Even if the
 *    underlying latch leaks (see the empirical finding below), the
 *    SCREEN must recover.
 *
 * Latch-leak fix landed (ticket 86c9kxtm5)
 * ----------------------------------------
 * The Jessica-batch fix (`fix/jessica-e2e-batch`) rearranged the
 * leave-effect so the latch reset + abort fire BEFORE the
 * `if (!hadAudio) return` guard. Post-fix, a Math → Hub bounce while
 * the fetch is in flight aborts the controller and resets the latch;
 * the re-entry into Math fires a fresh fetch. We now assert
 * `claudePosts.length >= 2` to pin that behaviour and prevent a
 * regression back to the latch-leak shape (where Marian rode the
 * still-in-flight first fetch from the second mount).
 *
 * Why this regression test is worth its weight
 * --------------------------------------------
 * The audit's P1.6 concern was specifically that the leave-effect's
 * abort path and the kick-effect's latch path could fall out of sync.
 * Unit tests of the effects in isolation pass; this spec exercises
 * the combined dance through the actual `<AnimatePresence mode="wait">`
 * orchestrator at the App boundary, which is where Marian's tap
 * sequence lives.
 *
 * The `/api/claude` POST count is captured for diagnostic export but
 * is not asserted: the brief is "doesn't brick", not "fetch behaviour
 * is correct". A future PR that fixes the leave-effect to abort
 * regardless of `hadAudio` will start producing 2 POSTs here without
 * needing this spec to change.
 *
 * Browser-engine support
 * ----------------------
 * Runs on Chromium AND WebKit. Both engines exhibit the same
 * `AnimatePresence` handoff timing for the route flip, so neither is
 * skipped.
 */

import { test, expect } from '@playwright/test'
import type { Request } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * Hold each fetch in flight long enough that the route bounce
 * deterministically happens BEFORE the fetch would have settled.
 * 4000ms is comfortably longer than the Hub→Math→Hub→Math sequence
 * (each step under 200ms in headless) plus the AnimatePresence exit
 * animation (~250ms).
 */
const IN_FLIGHT_DELAY_MS = 4000

test.describe('Path A fetch abort on rapid Hub ↔ Math bounce (audit P1.6)', () => {
  test.beforeEach(async ({ page }) => {
    // We failNetwork so each fetch lands in App.tsx's `.catch` path
    // after the delay, flipping `mathAudioReady` to `true` and
    // letting the silent-fallback walk light the chips. This is the
    // production-real "Anthropic offline" path; coverage shape mirrors
    // the existing harness specs.
    await installClaudeMock(page, {
      failNetwork: true,
      delayMs: IN_FLIGHT_DELAY_MS,
    })
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  test('Hub → Math (mid-fetch) → Hub → Math: re-entry does not stall on stale latch', async ({
    page,
  }) => {
    // Count POST requests to /api/claude — captured for diagnostic
    // logging only, not asserted. See the file header for why: the
    // current product behaviour leaks the latch and serves a single
    // fetch across both Math mounts. The screen still recovers, which
    // is what the spec asserts. A follow-up product fix will bump this
    // count to >= 2 without needing this spec to change.
    const claudePosts: string[] = []
    page.on('request', (req: Request) => {
      if (req.url().endsWith('/api/claude') && req.method() === 'POST') {
        claudePosts.push(req.url())
      }
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // ── First entry: Hub → Math. Fetch goes in flight. ──
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    const math = page.getByTestId('math')
    await expect(math).toBeVisible({ timeout: 5_000 })
    // Pre-flip on first entry — gate is closed (audio is in flight).
    await expect(math).toHaveAttribute('data-read-aloud-played', 'false')

    // ── Bounce back: Math → Hub via the back-arrow. App.tsx's
    //    leave-effect fires, aborting the in-flight controller and
    //    resetting `mathFetchStartedRef` to false. ──
    const backToHub = page.getByTestId('math-back-to-hub')
    await expect(backToHub).toBeVisible()
    await backToHub.click()
    await expect(hub).toBeVisible({ timeout: 5_000 })

    // ── Re-entry: Hub → Math. The latch should have been reset by
    //    the leave-effect; the kick-effect should re-issue the fetch. ──
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(math).toBeVisible({ timeout: 5_000 })

    // Eventually the audio-ready gate flips true. This is the
    // load-bearing assertion: pre-fix shape of the audit concern is
    // "gate stays false forever". We give 12s — IN_FLIGHT_DELAY_MS +
    // headroom for the route bounce + WebKit slowness.
    await expect(math).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-symbolic')).toBeVisible()
    await expect(page.getByTestId('math-chips')).toBeVisible()

    // Post-fix (ticket 86c9kxtm5): the bounce-to-Hub aborts the
    // first in-flight controller and resets `mathFetchStartedRef`.
    // The re-entry then issues a SECOND fetch. Pre-fix this stayed
    // at 1 (latch leak); the count assertion is the regression
    // canary for the leave-effect's pre-`hadAudio` reset shape.
    expect(claudePosts.length).toBeGreaterThanOrEqual(2)
  })
})
