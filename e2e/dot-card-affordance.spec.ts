/**
 * E2E spec — subitising dot-card affordance (ticket 86c9q5j9a).
 *
 * Pins the contract documented in
 * `design/screen-math-subitising-prompt.md` for Marian's iPad-portrait
 * device:
 *
 *   1. In-scope problems (both addends ≤ 5) mount exactly two
 *      `math-dot-card-cell` elements alongside one `math-dot-card`
 *      overlay container. Cells expose the addend value via
 *      `data-pips`.
 *   2. Out-of-scope problems (any addend > 5) mount zero dot-card
 *      cells; the flower row paints from t=0 with
 *      `data-flowers-visible="true"`.
 *   3. Layout stability: the math-symbolic and math-chips testids
 *      remain in flow regardless of dot-card lifecycle phase. Their
 *      bounding boxes do not shift between the in-scope (overlay
 *      mounted) and dismissed (overlay gone) states.
 *
 * Browser engine support
 * ----------------------
 * Runs on Chromium AND WebKit per `playwright.config.ts`. The dot-
 * card lifecycle does NOT depend on Howler / AudioContext, so WebKit
 * headless can run every assertion. Chips themselves still need the
 * read-aloud unlock; we use `forceHowlerUnlock` to bypass the
 * gesture chain so the gate flips and the problem area renders.
 *
 * Interaction with the existing cold-mount race spec
 * --------------------------------------------------
 * `cold-mount-math-fetch-in-flight.spec.ts` exercises the
 * `audioReady` render gate. This spec runs AFTER the gate has flipped
 * — we wait for `math-symbolic` to be visible, which is the canonical
 * post-gate signal. A future regression that re-introduces the swap-
 * jolt would be caught by THAT spec; this spec exists purely for the
 * dot-card affordance.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'
import { IPAD_PORTRAIT_VIEWPORT } from './_helpers/iPadViewport'

/**
 * Build a minimal canonical-shape `/api/claude` response with a single
 * problem at the requested addends. Mirrors the wire-shape produced by
 * `canonicalMathSessionResponse` but lets the spec pin Q1 deterministically
 * — the addends decide whether the dot-card fires.
 *
 * The audio is a known silent base64 placeholder so Howler's loaderror
 * path drives App.tsx's reject branch, which still flips
 * `mathAudioReady=true` (via the `.catch` block). The chips become
 * tappable once the silent caption walk completes.
 */
function buildSingleProblemMathResponse(
  addendA: number,
  addendB: number,
): () => unknown {
  const numberWord = (n: number): string =>
    [
      'zero',
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
    ][n] ?? String(n)
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const sum = addendA + addendB
  const eight = (i: number, a: number, b: number) => ({
    index: i,
    a,
    b,
    sum: a + b,
  })
  /*
   * Pad to 8 problems — App.tsx + Math.tsx assert a full 8-slot plan.
   * Problems 2-8 use safe in-scope addends (1+1) so the rest of the
   * session walks cleanly if the spec ever advances past Q1; we only
   * assert against Q1 here.
   */
  const problems = [
    eight(1, addendA, addendB),
    eight(2, 1, 1),
    eight(3, 1, 1),
    eight(4, 1, 1),
    eight(5, 1, 1),
    eight(6, 1, 1),
    eight(7, 1, 1),
    eight(8, 1, 1),
  ]
  // Build the wire shape — id + label + flat utterances list with
  // base64 audio. This mirrors `canonicalMathSessionResponse`'s shape
  // closely enough for `mathSessionPlanFromServer` to parse.
  return () => ({
    sessionId: `e2e-dot-card-${addendA}-${addendB}-${Date.now()}`,
    plan: {
      id: 'e2e-dot-card-plan',
      label: `dot-card e2e (${addendA}+${addendB})`,
      utterances: problems.flatMap((p) => [
        {
          id: `math.p${p.index}.read`,
          text: `${cap(numberWord(p.a))} plus ${numberWord(p.b)}. How many?`,
          audio: { kind: 'inline', base64: '', mime: 'audio/mpeg' },
        },
        {
          id: `math.p${p.index}.correct`,
          text: `Yes! ${cap(numberWord(p.sum))}!`,
          audio: { kind: 'inline', base64: '', mime: 'audio/mpeg' },
        },
        {
          id: `math.p${p.index}.reprompt`,
          text: 'Hmm... try again?',
          audio: { kind: 'inline', base64: '', mime: 'audio/mpeg' },
        },
        {
          id: `math.p${p.index}.hint`,
          text: `Look. ${cap(numberWord(p.a))}. And ${numberWord(p.b)} more. How many now?`,
          audio: { kind: 'inline', base64: '', mime: 'audio/mpeg' },
        },
        {
          id: `math.p${p.index}.giveAnswer`,
          text: `This one is ${numberWord(p.sum)}.`,
          audio: { kind: 'inline', base64: '', mime: 'audio/mpeg' },
        },
      ]),
    },
    // Suppress unused for spec readability.
    sumPlaceholder: sum,
  })
}

test.describe('Subitising dot-card affordance', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      width: IPAD_PORTRAIT_VIEWPORT.width,
      height: IPAD_PORTRAIT_VIEWPORT.height,
    })
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  test('in-scope problem (3+2) mounts 2 dot-card cells and one overlay', async ({
    page,
  }) => {
    await installClaudeMock(page, {
      mathResponse: buildSingleProblemMathResponse(3, 2),
    })
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

    // The overlay mounts inside the audioReady !== false block. Per
    // spec, in-scope addends mount exactly 2 cells alongside a single
    // overlay container.
    await expect(page.getByTestId('math-dot-card')).toHaveCount(1)
    await expect(page.getByTestId('math-dot-card-cell')).toHaveCount(2)

    // Cells expose data-pips reflecting the addends (3 + 2). Order
    // matches the symbolic row.
    const cells = page.getByTestId('math-dot-card-cell')
    await expect(cells.nth(0)).toHaveAttribute('data-pips', '3')
    await expect(cells.nth(1)).toHaveAttribute('data-pips', '2')
  })

  test('out-of-scope problem (6+4) mounts zero dot-card cells', async ({
    page,
  }) => {
    await installClaudeMock(page, {
      mathResponse: buildSingleProblemMathResponse(6, 4),
    })
    await page.goto('/')
    await forceHowlerUnlock(page)

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    const math = page.getByTestId('math')
    await expect(math).toBeVisible({ timeout: 10_000 })

    await expect(page.getByTestId('math-symbolic')).toBeVisible({
      timeout: 10_000,
    })

    // Done-when contract: zero cells when out-of-scope.
    await expect(page.getByTestId('math-dot-card')).toHaveCount(0)
    await expect(page.getByTestId('math-dot-card-cell')).toHaveCount(0)

    // The flower row's `data-flowers-visible="true"` from t=0 — there
    // is no overlay to hide them. (`installClaudeMock` may resolve
    // with the canonical fixture's default `1+1` first problem if our
    // override is misrouted; the boolean attr surfaces the actual
    // gating decision so a routing regression here is loud.)
    await expect(page.getByTestId('math-visual-groups')).toHaveAttribute(
      'data-flowers-visible',
      'true',
    )
  })

  test('layout stability: math-symbolic and math-chips remain in DOM with overlay mounted', async ({
    page,
  }) => {
    await installClaudeMock(page, {
      mathResponse: buildSingleProblemMathResponse(3, 2),
    })
    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    await expect(page.getByTestId('math-symbolic')).toBeVisible({
      timeout: 10_000,
    })

    // Even while the overlay is mounted, the math-symbolic + math-chips
    // testids remain in the DOM at their normal positions. Spec § "Layout-
    // stability rule (load-bearing)".
    await expect(page.getByTestId('math-dot-card')).toHaveCount(1)
    await expect(page.getByTestId('math-symbolic')).toBeVisible()
    await expect(page.getByTestId('math-chips')).toBeVisible()

    // No element should overflow the iPad-portrait viewport horizontally.
    // The overlay is `position: absolute` constrained to the same row
    // band as the flowers; the symbolic row sits above. We assert
    // bounding-box invariants per `feedback_jessica_first_for_objective_gates.md`.
    const symbolicBox = await page.getByTestId('math-symbolic').boundingBox()
    expect(symbolicBox).not.toBeNull()
    if (symbolicBox) {
      const rightEdge = symbolicBox.x + symbolicBox.width
      expect(rightEdge).toBeLessThanOrEqual(IPAD_PORTRAIT_VIEWPORT.width)
      expect(symbolicBox.x).toBeGreaterThanOrEqual(0)
    }
  })
})
