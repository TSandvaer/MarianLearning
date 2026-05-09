/**
 * E2E spec — add-to-20 flower-row fits inside iPad-portrait viewport.
 *
 * Ticket 86c9q7tpu (AC1). Retroactive regression pin for the bug Thomas
 * caught on PR #166's iPad smoke: the math-visual-groups row spilled past
 * the right edge of iPad portrait when both addends rendered ≥ 8 flowers
 * (worst case 9+9 = 18 flowers + the "+" glyph + two group gaps). This
 * is NOT Safari-specific — it's a viewport-width regression. Any browser
 * at 1024 × 1366 with this content would have failed; the spec catches
 * that class of regression as a routine Playwright check rather than
 * routing it to Thomas's iPad.
 *
 * Status note: the spec is INTENTIONALLY failing on the regression-pin
 * PR head until Devon's UI fix on PR #166 lands and merges to main.
 * Once the fix lands AND the add-to-20 debug seed lands (both ship on
 * PR #166), the spec turns green. The expected-red window is the cost
 * of pinning the regression at the same time the fix is in flight.
 *
 * Strategy
 * --------
 * 1. Deep-launch via `?debug=1&seed=add-to-20`. The seed (added in
 *    PR #166) marks `number-recog` and `add-to-10` as `'mastered'` and
 *    `add-to-20` as `'practicing'`, so the focus-node picker walks past
 *    the easier tiers and lands on `add-to-20`. Skip-Greet is on, so
 *    Splash → Hub directly.
 * 2. `failNetwork: true` on the /api/claude mock so the App.tsx state
 *    machine falls through to the static-fallback `add-to-20` plan
 *    (the silent caption walk path, mirroring the existing harness in
 *    `hub-to-math.spec.ts` and `mastery-promotion.spec.ts`).
 * 3. Walk the 8 problems. After each tap-correct, the next problem
 *    renders. Per problem: assert the math-visual-groups bounding box
 *    stays inside the iPad-portrait layout viewport.
 * 4. At least one problem in the rotation will hit the worst-case
 *    sum-of-18 shape (9+9). The static-plan rotation in
 *    `STATIC_ADD_TO_20_PLANS` always includes a 9+9 capstone in slots
 *    A and C, and a 7+8 + 8+7 = 15-flower pair in slot B. Whichever
 *    slot the rotation lands on, every problem's flower row must fit.
 *
 * What we deliberately do NOT assert
 * ----------------------------------
 *  - Specific addends per problem. The static-plan rotation is
 *    minute-keyed and we don't pin time. The invariant we DO pin —
 *    "every problem in the live rotation must fit" — is stronger than
 *    "this specific problem must fit" and survives future plan
 *    edits. If a future plan adds a 10+9 problem that exceeds 20, the
 *    `numberWord` invariant in `sessionPlans.ts` would fail before this
 *    spec ever runs.
 *  - Which exact element overflows when the spec fails. The right-edge
 *    + left-edge check pinpoints the failure mode; the failure message
 *    surfaces the actual rect dims so triage doesn't need a debugger.
 *
 * Why the layout viewport, not the device pixel ratio
 * ---------------------------------------------------
 * `getBoundingClientRect().right` returns coordinates in CSS pixels
 * relative to the layout viewport. `viewport.width` from Playwright's
 * project config is the same layout-viewport pixel value. They are
 * directly comparable. DPR / physical pixels are not in scope — Marian
 * sees the layout viewport on her iPad regardless of the underlying
 * physical resolution.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'
import { IPAD_PORTRAIT_VIEWPORT } from './_helpers/iPadViewport'

const PROBLEM_COUNT = 8

test.describe('add-to-20 flower-row fits inside iPad-portrait viewport', () => {
  test.beforeEach(async ({ page }) => {
    // failNetwork: true → silent-caption-walk fallback path. The
    // canonical-response path is unsuitable for layout testing because
    // its inline base64 audio decode is brittle in headless browsers
    // and the chips never enable; layout checks need a working chip
    // walk. The fallback path renders the same DOM tree, so the
    // viewport-fit invariant holds either way.
    await installClaudeMock(page, { failNetwork: true })

    // Returning-user seed so the App routes Splash → Hub (the URL
    // `?debug=1&seed=add-to-20` ALSO bumps sessionCount 0 → 1, but
    // seeding explicitly here is harmless on top: the debug seed's
    // `bumpSessionCountIfZero` short-circuits when sessionCount > 0.
    // This keeps the spec's behaviour stable even on a future seed
    // refactor that drops the bump.
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  test('every add-to-20 problem renders with math-visual-groups inside viewport', async ({
    page,
  }, testInfo) => {
    // Pin viewport explicitly. The project config already pins both
    // projects to 1024×1366, but reading from the helper here makes
    // the load-bearing constant explicit at the assertion site.
    await page.setViewportSize({
      width: IPAD_PORTRAIT_VIEWPORT.width,
      height: IPAD_PORTRAIT_VIEWPORT.height,
    })

    // Deep-launch via the add-to-20 seed (PR #166). Seed-recipe applies
    // at module-load before any React state init, so the focus-node
    // picker lands on `add-to-20` from the first render.
    await page.goto('/?debug=1&seed=add-to-20')
    await forceHowlerUnlock(page)

    // Splash auto-advances → Hub.
    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Tap Number Garden — Math mounts on the add-to-20 plan.
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    const math = page.getByTestId('math')
    await expect(math).toBeVisible({ timeout: 10_000 })

    const visualGroups = page.getByTestId('math-visual-groups')

    // Walk the 8 problems. Per problem: wait for the visual row to
    // render, capture its bounding rect, assert the fit invariant,
    // then tap the correct chip to advance.
    for (let i = 1; i <= PROBLEM_COUNT; i++) {
      // The visual-groups element is rendered alongside the symbolic
      // block. Wait for it to be in DOM and laid out.
      await expect(visualGroups).toBeVisible({ timeout: 10_000 })

      // Capture the layout rect. `boundingBox()` returns DOMRect-like
      // coordinates in the layout viewport (the same coordinate space
      // as `viewport.width`).
      const rect = await visualGroups.boundingBox()
      expect(
        rect,
        `problem ${i}: visual-groups boundingBox is null`,
      ).not.toBeNull()
      // Type-narrow.
      const { left, right, top, width, height } = rect!

      // Capture the addend values for diagnostic context. If the
      // assertion fails, the failure message + the attached rect blob
      // is enough to triage without re-running locally.
      const addendA = await page.getByTestId('math-addend-a').textContent()
      const addendB = await page.getByTestId('math-addend-b').textContent()

      const diag = `problem ${i} addends ${addendA}+${addendB}: rect={left:${left}, right:${right}, top:${top}, width:${width}, height:${height}}, viewport.width=${IPAD_PORTRAIT_VIEWPORT.width}`
      await testInfo.attach(`visual-groups-rect-p${i}`, {
        body: diag,
        contentType: 'text/plain',
      })

      // The invariant. `right > viewport.width` is the regression
      // shape PR #166 shipped: 9+9 produced an 18-flower row that
      // overhung the right edge by ~30-90px depending on rendering.
      // `left < 0` is the symmetric case (would have indicated a
      // rebalanced fix that pushed the row off the LEFT edge instead);
      // the symmetric assertion catches that class.
      expect(right, diag).toBeLessThanOrEqual(IPAD_PORTRAIT_VIEWPORT.width)
      expect(left, diag).toBeGreaterThanOrEqual(0)

      // Advance to the next problem. The correct chip becomes
      // tap-responsive once the silent caption walk completes.
      const correctChip = page.locator(
        '[data-testid="math-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()

      // Per-problem advance pause matches the existing mastery-promotion
      // spec's cadence — the screen needs ~1.5s between problems for
      // the celebration → next-problem transition to settle.
      if (i < PROBLEM_COUNT) {
        await page.waitForTimeout(1500)
      }
    }

    // After problem 8: the SessionEnd screen mounts. We don't assert
    // anything else — this spec is scoped to the layout invariant.
    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 10_000,
    })
  })
})
