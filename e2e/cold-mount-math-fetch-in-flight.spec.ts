/**
 * E2E spec — cold-mount Math while /api/claude is in flight.
 *
 * Ticket 86c9kxp3j (top-4 race-bug e2e specs from the polish-audit
 * roadmap). Closes the regression family that produced the audio race
 * P0s in PR #111 / #117 / #118: cold-mount Math paints SOMETHING before
 * the planner fetch resolves. Pre-fix that "something" was the static
 * fallback Q1 (then visibly swapped to the canonical Q1 once the prop
 * flipped — Marian's "swap-jolt"). Post-fix (PR #130, ticket 86c9kxb5q)
 * the render gate holds the problem area off-DOM until `mathAudioReady`
 * flips true.
 *
 * What this spec adds
 * -------------------
 * The existing `hub-to-math.spec.ts` already pins the `failNetwork:true`
 * branch with `delayMs: 3000`. This spec adds the complementary
 * fetch-shape paths the audit called out as load-bearing:
 *
 *   1. `route fulfils with canonical fixture, but delayed`. Exercises
 *      App.tsx's `.then` block (different branch from `failNetwork`).
 *      The canonical inline audio is brittle to decode in headless
 *      Howler — the production code path tolerates this and lands in
 *      `prepareMathPathA`'s reject handler, which still flips
 *      `mathAudioReady` to `true` via App.tsx's `.catch`. Net: the gate
 *      observably opens after the delay, regardless of which sub-path
 *      we end up on. We therefore do NOT pin the addends to the
 *      canonical fixture's first problem (Howler decode determines
 *      whether `mathPlan` gets set or stays null) — instead we pin the
 *      structural contract: "no problem area pre-flip, problem area
 *      post-flip, addends are valid digits, addends do not change."
 *      That contract is what catches the race shape regardless of
 *      which side of the headless-audio coin the test happens to land
 *      on.
 *
 *   2. Negative path: fetch rejects (`failNetwork:true`) at the network
 *      layer. Re-asserted alongside the resolve branch so a future
 *      regression that, e.g., stops flipping `audioReady=true` on
 *      reject (re-bricking the screen) is caught here even when the
 *      sister hub-to-math spec is green.
 *
 * Why "structural contract" beats "pin canonical Q1"
 * --------------------------------------------------
 * The audit's race shape is "any pre-flip render of the problem area".
 * A future refactor that, e.g., switches `audioReady`-gated rendering
 * to a CSS `visibility:hidden` pattern would silently regress the
 * swap-jolt behaviour Marian saw in production. `toHaveCount(0)`
 * against the testids forces the strong "not in the DOM" semantic
 * pre-flip, then `toBeVisible` post-flip + addend stability catches
 * any second swap. Pinning canonical Q1 addends would couple the
 * spec to headless-Howler decode behaviour and turn an architectural
 * regression test into a flaky audio test.
 *
 * Browser-engine support
 * ----------------------
 * Runs on Chromium AND WebKit per `playwright.config.ts`. No audio
 * playback is asserted. Howler is force-unlocked via the test seam so
 * chip-enable assertions don't depend on the gesture chain.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * Mid-flight delay we hold the route open. Same logic that landed in
 * `hub-to-math.spec.ts`: WebKit on slow CI was observed to flake at
 * 800ms when the chained `expect.toBeVisible` calls happened to land
 * near the cutover. 3000ms gives the entire pre-flip assertion block
 * headroom under parallel-worker load while keeping total spec runtime
 * well under the 90s test timeout.
 */
const IN_FLIGHT_DELAY_MS = 3000

test.describe('Cold-mount Math while /api/claude is in flight', () => {
  test.describe('canonical fulfill branch — fetch resolves mid-mount', () => {
    test.beforeEach(async ({ page }) => {
      // No `failNetwork`: the route fulfils with the canonical math
      // fixture once the delay elapses. App.tsx's `.then` block handles
      // the resolve; whether `prepareMathPathA` further succeeds in
      // decoding the inline silent MP3 (Path A "happy path") OR
      // rejects on decode (silent-fallback path) depends on the
      // headless engine. Either way `mathAudioReady` ends true and the
      // structural contract holds.
      await installClaudeMock(page, { delayMs: IN_FLIGHT_DELAY_MS })
      await seedLocalStorage(page, {
        sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
      })
    })

    test('problem area absent during fetch; renders post-flip with stable addends', async ({
      page,
    }) => {
      await page.goto('/')
      await forceHowlerUnlock(page)

      const hub = page.getByTestId('hub')
      await expect(hub).toBeVisible({ timeout: 10_000 })

      await page
        .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
        .click()

      // Math chrome mounts immediately; HUD + Emma are visible the whole
      // pre-flip window. These act as the "Math is up, but the gate is
      // still closed" signal.
      const math = page.getByTestId('math')
      await expect(math).toBeVisible({ timeout: 5_000 })
      await expect(page.getByTestId('math-hud')).toBeVisible()
      await expect(page.getByTestId('math-emma')).toBeVisible()

      // Pre-flip: the gate's negative state is exposed via the
      // `data-read-aloud-played="false"` attribute on the Math root.
      // We also assert the symbolic block / chips are absent from the
      // DOM — a CSS-hidden regression would fail this hard.
      await expect(math).toHaveAttribute('data-read-aloud-played', 'false')
      await expect(page.getByTestId('math-symbolic')).toHaveCount(0)
      await expect(page.getByTestId('math-chips')).toHaveCount(0)
      await expect(page.getByTestId('math-addend-a')).toHaveCount(0)
      await expect(page.getByTestId('math-addend-b')).toHaveCount(0)

      // Post-flip: route fulfils after the delay; App.tsx's settle
      // handlers run; `mathAudioReady` flips true; Math's render-gate
      // opens. The problem area renders for the FIRST time. Pre-fix
      // the static fallback Q1 would have been on screen already and
      // we'd have failed the toHaveCount(0) assertion above.
      await expect(page.getByTestId('math-symbolic')).toBeVisible({
        timeout: 10_000,
      })
      await expect(page.getByTestId('math-addend-a')).toBeVisible()
      await expect(page.getByTestId('math-addend-b')).toBeVisible()
      await expect(page.getByTestId('math-chips')).toBeVisible()

      // Addends are valid digits. Whether they're the canonical fixture's
      // first problem (audio decode succeeded → mathPlan got set) or the
      // static fallback's first problem (audio decode failed → fallback
      // stays in place) is up to the headless engine; both are
      // "production-real" surfaces Marian could see and both are correct
      // outcomes of the gate flip.
      const firstAddendA = await page.getByTestId('math-addend-a').textContent()
      const firstAddendB = await page.getByTestId('math-addend-b').textContent()
      expect(firstAddendA).toMatch(/^\d+$/)
      expect(firstAddendB).toMatch(/^\d+$/)

      // Stability — once the gate flipped, the addends must NOT change.
      // The pre-fix bug was specifically a SECOND swap (fallback → canon)
      // visible to the eye. Whichever plan we landed on, no further
      // flip is allowed.
      await page.waitForTimeout(1000)
      await expect(page.getByTestId('math-addend-a')).toHaveText(firstAddendA!)
      await expect(page.getByTestId('math-addend-b')).toHaveText(firstAddendB!)

      // Three answer chips render with exactly one carrying
      // `data-correct="true"` — guards against a future change to the
      // chip ordering that breaks the correct-answer marker.
      const chips = page.getByTestId('math-chip')
      await expect(chips).toHaveCount(3)
      await expect(
        page.locator('[data-testid="math-chip"][data-correct="true"]'),
      ).toHaveCount(1)
    })
  })

  test.describe('reject branch — fetch fails, gate still flips', () => {
    test.beforeEach(async ({ page }) => {
      // Hold for the same window, then abort. Mirrors a real-world
      // Anthropic-down outage but with a deterministic delay so we can
      // observe the pre-flip DOM state. App.tsx's `.catch` block flips
      // `mathAudioReady` to `true` so the silent fallback path can
      // unblock the chips.
      await installClaudeMock(page, {
        failNetwork: true,
        delayMs: IN_FLIGHT_DELAY_MS,
      })
      await seedLocalStorage(page, {
        sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
      })
    })

    test('problem area absent during fetch; renders post-flip via static fallback', async ({
      page,
    }) => {
      await page.goto('/')
      await forceHowlerUnlock(page)

      const hub = page.getByTestId('hub')
      await expect(hub).toBeVisible({ timeout: 10_000 })

      await page
        .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
        .click()

      const math = page.getByTestId('math')
      await expect(math).toBeVisible({ timeout: 5_000 })

      // Same pre-flip invariant as the resolve branch. The reject
      // branch must hit it too — historically the bug was symmetric
      // (both branches painted the static fallback before flipping).
      await expect(math).toHaveAttribute('data-read-aloud-played', 'false')
      await expect(page.getByTestId('math-symbolic')).toHaveCount(0)
      await expect(page.getByTestId('math-chips')).toHaveCount(0)

      // After the abort, App.tsx's `.catch` flips the gate. Static
      // fallback plan renders for the first (and final) time.
      await expect(page.getByTestId('math-symbolic')).toBeVisible({
        timeout: 10_000,
      })
      await expect(page.getByTestId('math-addend-a')).toBeVisible()
      await expect(page.getByTestId('math-addend-b')).toBeVisible()

      // Stability check — once we landed in the static fallback, the
      // addends must NOT swap. (If a future refactor accidentally
      // re-issues the fetch on reject, this catches it: the second
      // resolve would flip the prop.)
      const firstAddendA = await page.getByTestId('math-addend-a').textContent()
      const firstAddendB = await page.getByTestId('math-addend-b').textContent()
      expect(firstAddendA).toMatch(/^\d+$/)
      expect(firstAddendB).toMatch(/^\d+$/)

      await page.waitForTimeout(1000)
      await expect(page.getByTestId('math-addend-a')).toHaveText(firstAddendA!)
      await expect(page.getByTestId('math-addend-b')).toHaveText(firstAddendB!)
    })
  })
})
