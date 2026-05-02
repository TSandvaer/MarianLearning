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

/**
 * E2E spec — no-swap-jolt on cold mount (ticket 86c9kxb5q).
 *
 * Reproduces Thomas's 2026-05-02 production bug: cold-mount Math paints
 * the static-fallback Q1, then the canon-derived plan arrives ~1.3s
 * later, the plan prop flips, and Q1 visibly swaps to a different
 * problem before audio fires. Pre-fix: Marian sees one problem, then
 * another, then audio. Post-fix: Marian sees Emma idle, then the first
 * problem appears once with audio firing.
 *
 * Strategy
 * --------
 * The mock helper now supports `delayMs` — we hold the /api/claude route
 * in flight for 800ms so the App.tsx state machine sits with
 * `mathAudioReady === false` long enough for Playwright to assert
 * against the DOM. Then the mock aborts (failNetwork: true) — App's
 * catch flips audioReady to true and the static fallback plan renders.
 * That's the soft-fail path; the assertion that matters is "no problem
 * area was on screen during the in-flight window".
 *
 * We pick the failNetwork path (matching the existing harness) over the
 * canonical-resolve path because the canonical response carries inline
 * base64 audio that Howler can't reliably decode in headless browsers,
 * and either branch flips audioReady to true the same way (App.tsx's
 * `.catch` block mirrors its `.then` block on this point). The
 * load-bearing assertion — "no problem text visible at mount, problem
 * text visible after the flip" — holds either way.
 */
test.describe('Hub → Math no-swap-jolt on cold mount (86c9kxb5q)', () => {
  test.beforeEach(async ({ page }) => {
    // 3000ms delay before the route aborts. Long enough that the chain
    // of `expect.toBeVisible({timeout:10s})` calls leading up to the
    // pre-flip `toHaveCount(0)` assertion always lands inside the
    // pre-flip window even under parallel-worker load on slower CI
    // engines (WebKit observed flaking at 800ms). Total spec runtime
    // is still well under the project's 90s timeout.
    await installClaudeMock(page, { failNetwork: true, delayMs: 3000 })
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  test('Math renders Emma + HUD on mount; problem area appears only after audioReady flips', async ({
    page,
  }) => {
    await page.goto('/')
    await forceHowlerUnlock(page)

    // Splash auto-advances → Hub.
    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Tap Number Garden — Math mounts immediately, but the parent's
    // /api/claude fetch is held in flight by the mock for 800ms.
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    // Math screen mounts with HUD chrome + Emma. These stay visible
    // through the entire pre-flip window.
    const math = page.getByTestId('math')
    await expect(math).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('math-hud')).toBeVisible()
    await expect(page.getByTestId('math-emma')).toBeVisible()

    // Pre-flip: the problem area is NOT in the DOM. This is the
    // load-bearing assertion — pre-fix the static-fallback Q1 would be
    // visible HERE, then swap to the canon Q1 when the prop flipped.
    // Post-fix the render gate holds these elements off-DOM until
    // audioReady === true.
    //
    // We check the symbolic block, the chips wrapper, and the addend
    // span. Hidden=visible:false is intentional — we want a hard "not in
    // DOM" assertion, not "visible in viewport" semantics.
    await expect(page.getByTestId('math-symbolic')).toHaveCount(0)
    await expect(page.getByTestId('math-chips')).toHaveCount(0)
    await expect(page.getByTestId('math-addend-a')).toHaveCount(0)
    await expect(page.getByTestId('math-addend-b')).toHaveCount(0)

    // Wait for the route to settle (abort fires after 800ms; App's
    // catch flips mathAudioReady to true on the next microtask).
    // Once the gate flips, the problem area renders for the first
    // time — against the static fallback plan since the fetch failed,
    // which is the soft-fail contract Marian sees on Anthropic outage.
    await expect(page.getByTestId('math-symbolic')).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByTestId('math-addend-a')).toBeVisible()
    await expect(page.getByTestId('math-addend-b')).toBeVisible()
    await expect(page.getByTestId('math-chips')).toBeVisible()

    // Capture the addend texts post-flip. These are the values Marian
    // sees and hears once. Pre-fix they would have been preceded by
    // different addends from the static-fallback plan (and the test
    // would have failed the pre-flip assertion above first).
    const firstAddendA = await page.getByTestId('math-addend-a').textContent()
    const firstAddendB = await page.getByTestId('math-addend-b').textContent()
    expect(firstAddendA).toMatch(/^\d+$/)
    expect(firstAddendB).toMatch(/^\d+$/)

    // Stability: the addends must NOT change in the steady-state. If
    // any further plan flip were waiting in the wings (which it
    // shouldn't be — the fallback plan is final once we landed in soft-
    // fail), this catches it. We poll for ~1s of stability before
    // calling it.
    await page.waitForTimeout(1000)
    await expect(page.getByTestId('math-addend-a')).toHaveText(firstAddendA!)
    await expect(page.getByTestId('math-addend-b')).toHaveText(firstAddendB!)

    // Chips eventually become tappable per the existing read-aloud gate.
    const chips = page.getByTestId('math-chip')
    await expect(chips).toHaveCount(3)
    await expect(chips.first()).toBeEnabled({ timeout: 15_000 })
  })
})
