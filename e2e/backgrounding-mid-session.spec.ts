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
   * audioCtxLog carries the `visibility-recovery-buffer` row plus a
   * `howl-play-event` row from the next problem's read-aloud — that
   * is, audio actually played post-resume, not just the React state
   * advanced.
   */
  test('Math hidden during correct-tap advance — advance does not fire while hidden', async ({
    page,
  }) => {
    // Enable `?debug=1` so the audioCtxLog probe is active and we can
    // read back the visibility-recovery-buffer + howl-play-event rows.
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

    // PR #137 round 2 (ticket 86c9kxtmu) — the round-1 fix that
    // tried to call `Howler.ctx.resume()` + `unlockIosAudioSession()`
    // from the visibilitychange handler did NOT actually unstick the
    // OS audio session on real iPad PWA (Thomas's audioCtxLog dump
    // proved the context stays `'suspended'` despite the recovery
    // buffer firing). Round-2 fix defers the recovery to the next
    // user gesture.
    //
    // To exercise that path here, we simulate a chip-tap on the new
    // problem after the resume — that's the gesture iOS would
    // associate with the audio recovery on a real device. The
    // `drainOnGesture` call inside Math.tsx's `onChipTap` runs
    // resume + unlock + drains the queued read-aloud.
    //
    // Wait for the new problem's chip to be enabled (read-aloud has
    // been queued OR has played + flipped readAloudPlayed). On the
    // round-2 path with a pending gate, the read-aloud is queued
    // until the chip-tap below drains it; the chip itself stays
    // disabled until readAloudPlayed flips. We bridge this by
    // unpinning the ctx state back to 'running' before the chip-tap
    // (so the queued play actually emits when drained), then
    // dispatching a synthetic chip-tap (the `audioUnlocked` first-
    // gesture path consumes the tap and fires drainOnGesture).
    await pinHowlerCtxState(page, 'running')

    // Click the chip area — even a disabled chip tap reaches the
    // onChipTap handler in Math.tsx, which short-circuits on
    // `!audioUnlocked` AFTER running the drain. That's the
    // gesture-deferred recovery path the round-2 fix relies on.
    const newChip = page.locator('[data-testid="math-chip"]').first()
    await newChip.click({ force: true })

    // Round-2 strengthening: the audio actually played post-resume,
    // not just the React state advanced. The audioCtxLog carries
    // both proofs:
    //
    //   - `visibility-recovery-buffer` row: confirms the
    //     visibility-edge marked the gate pending (bufferStarted=false
    //     under round-2 contract — the buffer kick is gesture-deferred).
    //   - `howl-play-event` row landed AFTER the recovery row:
    //     proves an actual `'play'` event fired on a Howl post-
    //     recovery (i.e. audio is no longer dead). The
    //     `drainOnGesture` invoked by the chip-tap above runs the
    //     queued read-aloud inside the gesture window.
    //
    // The previous shape only asserted React state advanced — green
    // even if audio was bricked for the rest of the session, which
    // was Thomas's PR #137 ear-test failure mode.
    const log = await page.evaluate(() => {
      const raw = window.localStorage.getItem('debug:audioCtxLog:v1')
      return raw
        ? (JSON.parse(raw) as Array<{ cause: string; timestamp: number }>)
        : []
    })
    const recoveryRows = log.filter(
      (r) => r.cause === 'visibility-recovery-buffer',
    )
    expect(recoveryRows.length).toBeGreaterThanOrEqual(1)

    // Wait for a `howl-play-event` row to land AFTER the recovery
    // row's timestamp, indicating a Howl on the resumed problem
    // actually fired its `'play'` event. Poll up to 10 s; iPad
    // Howler-on-iOS post-recovery onplay latency is usually under
    // 500 ms but the cold-mount path adds the read-aloud setup time.
    await expect
      .poll(
        async () => {
          const fresh = await page.evaluate(() => {
            const raw = window.localStorage.getItem('debug:audioCtxLog:v1')
            return raw
              ? (JSON.parse(raw) as Array<{ cause: string; timestamp: number }>)
              : []
          })
          const recoveryAt =
            fresh.filter((r) => r.cause === 'visibility-recovery-buffer').pop()
              ?.timestamp ?? 0
          return fresh.some(
            (r) => r.cause === 'howl-play-event' && r.timestamp >= recoveryAt,
          )
        },
        { timeout: 10_000 },
      )
      .toBe(true)
  })
})
