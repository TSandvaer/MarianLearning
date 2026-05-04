/**
 * E2E spec — backgrounding the app mid-session (audit P1.1).
 *
 * Ticket 86c9kxp3j (top-4 race-bug e2e specs from the polish-audit
 * roadmap). Documents what SHOULD happen when Marian backgrounds the
 * app mid-session — homescreen, app-switcher, lock-screen, sibling
 * snatching the iPad, anything that fires `visibilitychange` /
 * `pagehide` events on the PWA.
 *
 * Current product state (2026-05-01)
 * ----------------------------------
 * **No `visibilitychange` or `pagehide` handlers exist anywhere in
 * `src/`** (verified via grep at spec-authoring time). When Marian
 * backgrounds during a Math problem, anything in flight just keeps
 * running on the JS event loop until the OS suspends the tab —
 * including any `setTimeout` that drives the read-aloud caption
 * walk, the chip-advance timer, and any pending `playSession`
 * promise. There is no documented contract for what Marian sees on
 * resume; in practice the iPad PWA reload behaviour determines it
 * (Safari-specific: tabs that were backgrounded for >30s often get
 * page-resurrect, restoring the DOM; longer than that and it's a
 * cold reload).
 *
 * Why the spec exists at .fixme today
 * -----------------------------------
 * Per the brief — "If documenting 'no handling' feels wrong, mark
 * the assertions as `test.fixme()` and note in the PR body that a
 * product fix is needed before this spec can assert positive
 * behavior. Either way: the spec exists." We're choosing .fixme
 * over a baseline-no-op because:
 *
 *  - "No handler" is not a contract worth pinning. A future PR that
 *    adds visibilitychange handling correctly should NOT make this
 *    spec turn red. .fixme is exactly the right Playwright primitive:
 *    skipped today, ready to flip live the moment the handler lands.
 *  - The assertions below describe what the audit recommends as the
 *    target product behaviour: pause audio on hide, resume cleanly
 *    on show, no chip-advance fires while hidden, no Path A fetch
 *    starts while hidden.
 *
 * Follow-up product ticket to file
 * --------------------------------
 *  - Title: "Pause audio + suppress timers on visibilitychange (mid-
 *    session safety)"
 *  - Body: link this spec; describe the four `test.fixme` cases as
 *    acceptance criteria; cite audit P1.1.
 *
 * What we DO assert today
 * -----------------------
 * Two `test.fixme` cases (described above) that flip live once the
 * handler lands, plus one ALWAYS-LIVE smoke assertion that the page
 * lifecycle events themselves can be dispatched in this harness — a
 * canary so a future Playwright API change is caught here rather than
 * masked under the .fixme guard.
 *
 * Browser-engine support
 * ----------------------
 * Both Chromium and WebKit support the `visibilitychange` /
 * `pagehide` lifecycle. We dispatch the events via `page.evaluate`
 * to drive `document.visibilityState` and the corresponding event,
 * which is the same shape the Page-Lifecycle spec uses across both
 * engines. Real OS-level backgrounding (Playwright `page.context().pages()`
 * tab-blur) was tried during spec design and proved engine-flaky;
 * synthetic `visibilitychange` is the industry standard for
 * regression coverage of lifecycle handlers.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * Dispatch a synthetic `visibilitychange` to the page. Drives
 * `document.visibilityState` to the requested value via a property
 * override (the real DOM property is read-only) and fires a bubbling
 * Event so any document-level handlers (the future product code) see
 * it.
 *
 * Cross-engine note: WebKit also accepts `webkitvisibilitychange`
 * via legacy fallback; modern WebKit fires the standard event so we
 * only dispatch the standard form.
 */
async function setVisibility(
  page: import('@playwright/test').Page,
  state: 'visible' | 'hidden',
): Promise<void> {
  await page.evaluate((nextState) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => nextState,
    })
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => nextState === 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
  }, state)
}

/**
 * Pin `Howler.ctx.state` to a literal value. Lets the spec exercise
 * iOS-only paths (`'interrupted'`) that desktop chromium / webkit
 * don't naturally produce.
 *
 * Round-2 use (ticket 86c9kxtmu): set state to `'interrupted'` AFTER
 * suspending so `useHowlerSuspendOnHide`'s visible-pre read sees the
 * iOS shape. The spec then asserts the recovery-buffer row landed
 * AND the next playSession's onstart fired.
 */
async function pinHowlerCtxState(
  page: import('@playwright/test').Page,
  state: 'running' | 'suspended' | 'interrupted',
): Promise<void> {
  await page.evaluate((nextState) => {
    interface HowlerWindow {
      Howler?: { ctx?: AudioContext | null }
    }
    const w = window as Window & HowlerWindow
    const ctx = w.Howler?.ctx
    if (!ctx) return
    Object.defineProperty(ctx, 'state', {
      configurable: true,
      get: () => nextState,
    })
  }, state)
}

test.describe('Backgrounding mid-session (audit P1.1)', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page, { failNetwork: true })
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  /**
   * Canary: synthetic `visibilitychange` events round-trip through
   * the harness. Always live. If this assertion ever breaks, the
   * lifecycle helper above needs a fix before any `.fixme` flip
   * makes sense.
   */
  test('lifecycle event harness — synthetic visibilitychange round-trips', async ({
    page,
  }) => {
    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    // Wire a no-op listener and verify it fires when we dispatch.
    // This is harness-level; the product may or may not have its
    // own listener. We poll the counter through page.evaluate.
    await page.evaluate(() => {
      ;(
        window as unknown as { __qaVisChangeCount: number }
      ).__qaVisChangeCount = 0
      document.addEventListener('visibilitychange', () => {
        ;(window as unknown as { __qaVisChangeCount: number })
          .__qaVisChangeCount++
      })
    })

    await setVisibility(page, 'hidden')
    await setVisibility(page, 'visible')

    const count = await page.evaluate(
      () =>
        (window as unknown as { __qaVisChangeCount: number })
          .__qaVisChangeCount,
    )
    expect(count).toBe(2)

    // visibilityState read-back round-trips correctly.
    const finalState = await page.evaluate(() => document.visibilityState)
    expect(finalState).toBe('visible')
  })

  /**
   * Target behaviour: audio (caption walk timers, in-flight Howler
   * playSession) pauses when the page goes hidden mid-Math.
   *
   * Today this is .fixme — no handler exists. When the product fix
   * lands, flip `.fixme(` to `(` and the spec runs live.
   */
  test('Math mid-problem hidden → audio pauses; show → audio resumes cleanly', async ({
    page,
  }) => {
    await page.goto('/')
    await forceHowlerUnlock(page)
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    const math = page.getByTestId('math')
    await expect(math).toBeVisible({ timeout: 10_000 })

    // Mid-problem (audio still walking the caption — chips not
    // tap-responsive yet).
    await expect(math).toHaveAttribute('data-read-aloud-played', 'false')

    await setVisibility(page, 'hidden')

    // ── ASSERT (target product behaviour) ──
    // The Math root should expose a paused state (e.g. via a
    // `data-paused` attribute or via the existing `data-gate-state`
    // gaining a "paused" value). Concrete attribute name to be
    // pinned by the product fix; this spec will land alongside it.
    // Until then, the placeholder check below documents intent.
    await expect(math).toHaveAttribute('data-paused', 'true', {
      timeout: 1_000,
    })

    await setVisibility(page, 'visible')

    // After resume, Math should drop the paused attribute and the
    // caption walk should continue (eventually flipping
    // `data-read-aloud-played` to true).
    await expect(math).toHaveAttribute('data-paused', 'false', {
      timeout: 1_000,
    })
    await expect(math).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 15_000,
    })
  })

  /**
   * Target behaviour: while the page is hidden, the chip-advance
   * timer does NOT fire. (Pre-fix concern: a backgrounded tab still
   * runs the JS event loop on iOS Safari, so a `setTimeout` started
   * just before backgrounding can resolve while hidden — and on
   * resume Marian sees an "already advanced past my answer" screen.)
   *
   * Round 2 (ticket 86c9kxtmu): the spec is strengthened beyond
   * "data-problem-index advanced" to include the iOS-specific
   * `'interrupted'` recovery path. We pin `Howler.ctx.state` to
   * `'interrupted'` after the hide so the visible-pre read in
   * `useHowlerSuspendOnHide` sees the iPad shape, then assert the
   * audioCtxLog carries the `visibility-recovery-buffer` row + the
   * pendingResumeGate transitions back to `'idle'` after a gesture
   * tap on the affordance — proving the `drainOnGesture` path ran
   * end-to-end.
   *
   * What this spec proves vs what it cannot prove
   * ---------------------------------------------
   * The test environment uses `failNetwork: true` (see beforeEach),
   * which forces `prepareMathPathA` to reject and Math falls through
   * to the silent-but-captioned `defaultPlayUtterance` (no Howler
   * instances are constructed for read-alouds). That means
   * `howl-play-event` rows — which require a real `Howl.on('play')`
   * — cannot land in this harness no matter how well the recovery
   * worked. The earlier shape of this assertion was unreachable in CI
   * regardless of correctness; main was red on it for the entire
   * window between PR #137 merge and this fix.
   *
   * What we CAN observe in CI is the `pendingResumeGate` state
   * machine: it transitions `idle → pending-resume` at the visible-
   * edge with state `'interrupted'`, and `pending-resume → idle`
   * when `drainOnGesture` runs. Every audioCtxLog row mirrors the
   * latest `pendingResumeGateState` as a sticky field. So a row
   * landing AFTER the recovery row with `pendingResumeGateState ===
   * 'idle'` is unambiguous proof that the gesture-deferred drain
   * fired end-to-end. The "audio actually played" assertion is owned
   * by Thomas's iPad ear-test (the production-only signal).
   *
   * Why we tap the `pending-resume-affordance` and not a chip
   * ---------------------------------------------------------
   * The earlier shape clicked the first `[data-testid="math-chip"]`
   * with `force: true`, expecting `onChipTap` → `drainOnGesture` to
   * fire. But the chip is rendered as `<button disabled>` until the
   * new problem's read-aloud completes (`readAloudPlayed=true`), and
   * browsers do not fire click events on `<button disabled>` even
   * with Playwright's `force: true` (which only bypasses Playwright's
   * actionability checks, not DOM-level disabled). React 19 also
   * skips synthetic events on disabled buttons. The drain never
   * ran in CI; the `pendingResumeGateState` stayed `'pending-resume'`
   * forever; the polled `howl-play-event` could never land.
   *
   * The `PendingResumeAffordance` overlay (mounted at App root, see
   * `src/components/PendingResumeAffordance.tsx`) renders whenever
   * the gate is `'pending'` or `'awaiting-tap'`, and its
   * `onPointerDown` calls `drainOnGesture` directly. That's the
   * canonical "any tap anywhere drains the gate" target the round-4
   * fix added precisely so Marian's tap doesn't have to land on a
   * specific control. Tapping it from the spec exercises the same
   * code path Marian's tap would on a real iPad return-from-
   * background, without depending on chip enablement.
   */
  test('Math hidden during correct-tap advance — advance does not fire while hidden', async ({
    page,
  }) => {
    // Enable `?debug=1` so the audioCtxLog probe is active and we can
    // read back the visibility-recovery-buffer row + the
    // pendingResumeGateState transitions on every emit.
    await page.goto('/?debug=1')
    await forceHowlerUnlock(page)
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    const math = page.getByTestId('math')
    await expect(math).toBeVisible({ timeout: 10_000 })

    // Wait for chips to enable, tap correct.
    const correctChip = page.locator(
      '[data-testid="math-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 15_000 })
    const initialIndex = await math.getAttribute('data-problem-index')
    await correctChip.click()

    // Immediately background. The advance timer
    // (ADVANCE_AFTER_CORRECT_MS = 1.2s in src/screens/Math) should
    // be suppressed while hidden.
    await setVisibility(page, 'hidden')

    // Pin `Howler.ctx.state` to `'interrupted'` so the visible-pre
    // read sees the iOS shape on resume. Round-2 contract: this
    // should trigger the recovery-buffer kick.
    await pinHowlerCtxState(page, 'interrupted')

    // Wait past when the advance would normally fire.
    await page.waitForTimeout(2_000)

    // Read the problem index in a hidden-state-safe way (the
    // helper still runs JS — only timers should be gated).
    const indexWhileHidden = await math.getAttribute('data-problem-index')
    expect(indexWhileHidden).toBe(initialIndex)

    await setVisibility(page, 'visible')

    // After resume the advance fires; problem index increments.
    await expect(math).not.toHaveAttribute(
      'data-problem-index',
      initialIndex!,
      { timeout: 5_000 },
    )

    // The visibility-edge handler in `useHowlerSuspendOnHide` saw
    // ctx state `'interrupted'` and called `markPendingResume()` —
    // recording a `visibility-recovery-buffer` row with
    // `bufferStarted=false` (round-2 contract: the buffer kick is
    // gesture-deferred).
    const log = await page.evaluate(() => {
      const raw = window.localStorage.getItem('debug:audioCtxLog:v1')
      return raw
        ? (JSON.parse(raw) as Array<{
            cause: string
            timestamp: number
            pendingResumeGateState?: string
          }>)
        : []
    })
    const recoveryRows = log.filter(
      (r) => r.cause === 'visibility-recovery-buffer',
    )
    expect(recoveryRows.length).toBeGreaterThanOrEqual(1)

    // The pending-resume affordance is mounted at App level
    // (`src/components/PendingResumeAffordance.tsx`) and renders
    // whenever the gate is `'pending'` / `'awaiting-tap'`. Its
    // pointerdown handler calls `drainOnGesture` synchronously —
    // the canonical gesture-deferred recovery path on real iPad.
    // Unpin the ctx state to `'running'` first so the synchronous
    // resume call inside the drain sees a recoverable shape.
    await pinHowlerCtxState(page, 'running')
    const affordance = page.locator('[data-testid="pending-resume-affordance"]')
    await expect(affordance).toBeVisible({ timeout: 5_000 })
    await affordance.dispatchEvent('pointerdown')

    // Drain ran → gate flipped `'pending-resume' → 'idle'`. Every
    // subsequent audioCtxLog row mirrors `pendingResumeGateState`
    // as a sticky field; the 1Hz poll guarantees a fresh emit
    // lands within ~1.5 s of the gate transition. We poll for a
    // row landing AFTER the recovery row's timestamp with the
    // sticky field reading `'idle'`. That is the production-
    // realistic proof that `drainOnGesture` ran end-to-end —
    // observable in CI without depending on Path A audio (which
    // is mocked off via `failNetwork: true` in this suite).
    await expect
      .poll(
        async () => {
          const fresh = await page.evaluate(() => {
            const raw = window.localStorage.getItem('debug:audioCtxLog:v1')
            return raw
              ? (JSON.parse(raw) as Array<{
                  cause: string
                  timestamp: number
                  pendingResumeGateState?: string
                }>)
              : []
          })
          const recoveryAt =
            fresh.filter((r) => r.cause === 'visibility-recovery-buffer').pop()
              ?.timestamp ?? 0
          return fresh.some(
            (r) =>
              r.timestamp > recoveryAt && r.pendingResumeGateState === 'idle',
          )
        },
        { timeout: 10_000 },
      )
      .toBe(true)
  })
})
