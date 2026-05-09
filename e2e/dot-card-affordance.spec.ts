/**
 * E2E spec — subitising dot-card affordance (ticket 86c9q5j9a).
 *
 * Pins the contract documented in
 * `design/screen-math-subitising-prompt.md` for Marian's iPad-portrait
 * device:
 *
 *   1. On a normal Math session entry, in-scope problems (both
 *      addends ≤ 5) mount exactly two `math-dot-card-cell` elements
 *      alongside one `math-dot-card` overlay container. The cells'
 *      `data-pips` attributes match the rendered `math-addend-a` /
 *      `math-addend-b` digits.
 *   2. Layout stability: the math-symbolic and math-chips testids
 *      remain in flow when the overlay is mounted. Their right-edge
 *      bounding boxes do not exceed the iPad-portrait viewport.
 *   3. Out-of-scope problems (any addend > 5) mount zero dot-card
 *      cells. The fallback static plan + canonical math response both
 *      open with both addends ≤ 5; we exercise the out-of-scope
 *      branch via a unit-test fixture in `Math.test.tsx`. The
 *      e2e-level out-of-scope assertion would require a deep-link
 *      that doesn't yet exist for `add-to-20` — tracked separately.
 *
 * Browser engine support
 * ----------------------
 * Runs on Chromium AND WebKit per `playwright.config.ts`. The dot-
 * card lifecycle does NOT depend on Howler / AudioContext, so WebKit
 * headless can run every assertion. Chips themselves still need the
 * read-aloud unlock; we use `forceHowlerUnlock` to bypass the
 * gesture chain so the gate flips and the problem area renders.
 *
 * Why we don't pin specific addends via mockClaude.mathResponse
 * -------------------------------------------------------------
 * The canonical fixture inlines silent base64 MP3s that decode
 * unpredictably in headless engines (Howler loaderror → App.tsx
 * .catch branch → static fallback plan). The cold-mount race spec
 * (`cold-mount-math-fetch-in-flight.spec.ts`) takes the same posture:
 * "addends are valid digits, addends do not change" without pinning
 * exact values. We follow that pattern here — read the rendered
 * addends and assert the dot-card contract against THEM, regardless
 * of whether the canonical fixture or the static fallback won.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'
import { IPAD_PORTRAIT_VIEWPORT } from './_helpers/iPadViewport'

test.describe('Subitising dot-card affordance', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      width: IPAD_PORTRAIT_VIEWPORT.width,
      height: IPAD_PORTRAIT_VIEWPORT.height,
    })
    await installClaudeMock(page)
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  test('in-scope addends produce 2 dot-card cells whose data-pips match the symbolic addends', async ({
    page,
  }) => {
    await page.goto('/')
    await forceHowlerUnlock(page)

    // Walk Hub → Math.
    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    const math = page.getByTestId('math')
    await expect(math).toBeVisible({ timeout: 10_000 })

    // Wait for the audioReady gate to flip — symbolic row appears.
    await expect(page.getByTestId('math-symbolic')).toBeVisible({
      timeout: 10_000,
    })

    // Read whichever addends the canonical fixture or static fallback
    // landed us on. Both surfaces open with addends ≤ 5 today, so the
    // dot-card MUST be present.
    const addendAText = await page.getByTestId('math-addend-a').textContent()
    const addendBText = await page.getByTestId('math-addend-b').textContent()
    const addendA = Number(addendAText)
    const addendB = Number(addendBText)
    expect(addendA, 'addendA must be a positive digit').toBeGreaterThanOrEqual(
      1,
    )
    expect(addendB, 'addendB must be a positive digit').toBeGreaterThanOrEqual(
      1,
    )

    if (addendA <= 5 && addendB <= 5) {
      // In-scope: overlay mounts.
      await expect(page.getByTestId('math-dot-card')).toHaveCount(1)
      await expect(page.getByTestId('math-dot-card-cell')).toHaveCount(2)

      const cells = page.getByTestId('math-dot-card-cell')
      await expect(cells.nth(0)).toHaveAttribute('data-pips', String(addendA))
      await expect(cells.nth(1)).toHaveAttribute('data-pips', String(addendB))
    } else {
      // Out-of-scope: no overlay. (Defensive — current canonical
      // fixture + static fallback always land in-scope on Q1, but the
      // assertion is symmetric so a future plan rotation that lands
      // an out-of-scope opener doesn't silently fail this spec.)
      await expect(page.getByTestId('math-dot-card')).toHaveCount(0)
      await expect(page.getByTestId('math-dot-card-cell')).toHaveCount(0)
    }
  })

  test('flowers paint at full opacity once the dot-card overlay completes', async ({
    page,
  }) => {
    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    await expect(page.getByTestId('math-symbolic')).toBeVisible({
      timeout: 10_000,
    })

    // The flower row carries `data-flowers-visible="false"` while the
    // overlay is on screen; "true" once the overlay's onComplete
    // fires. Either we land on an in-scope problem (initial state
    // false → flips to true within ~1.1s) or an out-of-scope problem
    // (always true). The post-lifecycle steady state is "true".
    //
    // We give it 4s to converge — full lifecycle is ~1.1s plus
    // headless-engine variance.
    await expect(page.getByTestId('math-visual-groups')).toHaveAttribute(
      'data-flowers-visible',
      'true',
      { timeout: 4_000 },
    )
  })

  test('layout stability: math-symbolic stays inside the iPad-portrait viewport with overlay mounted', async ({
    page,
  }) => {
    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    await expect(page.getByTestId('math-symbolic')).toBeVisible({
      timeout: 10_000,
    })

    // Even if the overlay is mounted (in-scope case), the math-symbolic
    // and math-chips testids remain in flow. Per spec § "Layout-
    // stability rule (load-bearing)" — the overlay must not push the
    // symbolic row out or expand the layout horizontally.
    await expect(page.getByTestId('math-symbolic')).toBeVisible()
    await expect(page.getByTestId('math-chips')).toBeVisible()

    // Bounding-box invariants per `feedback_jessica_first_for_objective_gates.md`.
    const symbolicBox = await page.getByTestId('math-symbolic').boundingBox()
    expect(symbolicBox, 'math-symbolic boundingBox null').not.toBeNull()
    if (symbolicBox) {
      const right = symbolicBox.x + symbolicBox.width
      expect(right).toBeLessThanOrEqual(IPAD_PORTRAIT_VIEWPORT.width)
      expect(symbolicBox.x).toBeGreaterThanOrEqual(0)
    }

    const chipsBox = await page.getByTestId('math-chips').boundingBox()
    expect(chipsBox, 'math-chips boundingBox null').not.toBeNull()
    if (chipsBox) {
      const right = chipsBox.x + chipsBox.width
      expect(right).toBeLessThanOrEqual(IPAD_PORTRAIT_VIEWPORT.width)
      expect(chipsBox.x).toBeGreaterThanOrEqual(0)
    }
  })
})
