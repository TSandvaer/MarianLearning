/**
 * E2E spec — SessionEnd → Hub flip.
 *
 * Ticket 86c9kwnmx (P0.1 from the 2026-05-02 polish audit). Closes the
 * "no e2e for the finish-the-session flow" gap.
 *
 * What we assert
 * --------------
 *  1. After tapping through 8 correct chips on Math, SessionEnd mounts.
 *  2. The "All done!" CTA becomes visible (4-5s after the celebration
 *     audio sequence; we use the fallback timer's CTA-surface guarantee).
 *  3. Tapping the CTA flips back to Hub.
 *  4. Hub's `data-path` attribute reflects the session-end origin.
 *  5. Hub's session-history HUD updates: cumulativeStardust >= the seed
 *     value (sessions don't decrement; new stardust earned in the run
 *     adds on top).
 *
 * Stardust note
 * -------------
 *  We do NOT pin an exact stardust delta. Stardust is derived from
 *  per-problem timing + streak bonuses; the production formula has
 *  enough surface that an exact value is brittle. We assert the
 *  monotonic invariant ("did not decrease") and leave fine-grained
 *  arithmetic to the unit tests in `_shared/stardust.test.ts`.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  readSessionHistoryFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

const SEED_STARDUST = 12

test.describe('Math session → SessionEnd → Hub flip', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page)
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({
        sessionCount: 5,
        cumulativeStardust: SEED_STARDUST,
      }),
    })
  })

  test('tap through 8 correct answers, SessionEnd surfaces, "All done!" returns to Hub', async ({
    page,
  }) => {
    await page.goto('/')

    // Splash → Hub.
    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Hub → Math.
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    const math = page.getByTestId('math')
    await expect(math).toBeVisible({ timeout: 10_000 })

    // Walk 8 problems. Each iteration: wait for the correct chip to
    // become enabled, click it, wait for the advance animation to
    // complete (ADVANCE_AFTER_CORRECT_MS = 1.2s + audio settle).
    for (let i = 1; i <= 8; i++) {
      // The correct chip carries `data-correct="true"`. Distractors
      // carry "false". We never need to compute the answer ourselves.
      const correctChip = page.locator(
        '[data-testid="math-chip"][data-correct="true"]',
      )
      // Wait for the chip to become enabled (read-aloud completes).
      // Up to 15s headroom for WebKit + slow CI.
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()

      if (i < 8) {
        // Math advances to the next problem. The problem dot for the
        // next index lights up; we wait for the new chip set to be
        // ready before continuing.
        // The cleanest signal is "the disabled/enabled state of the
        // correct chip flips" — but advance animations make that
        // racy. Instead, wait for the math streak counter or the
        // problem dot's data-current attribute. A short wait works
        // here because the screen state machine is deterministic.
        await page.waitForTimeout(1500)
      }
    }

    // SessionEnd mounts after problem 8.
    const sessionEnd = page.getByTestId('session-end')
    await expect(sessionEnd).toBeVisible({ timeout: 10_000 })

    // The CTA appears at most after FALLBACK_CTA_DELAY_MS = 4s. Allow
    // 12s of headroom because the CI timing is noisy and the audio
    // sequence takes ~5s wall time plus cushion.
    const cta = page.getByTestId('session-end-cta')
    await expect(cta).toBeVisible({ timeout: 12_000 })
    await expect(cta).toHaveAttribute('aria-label', 'All done!')

    await cta.click()

    // SessionEnd → Hub. The orchestrator stamps `data-path="session-end"`
    // on Hub when this transition fires.
    await expect(hub).toBeVisible({ timeout: 10_000 })
    await expect(hub).toHaveAttribute('data-path', 'session-end')

    // Cumulative stardust did not decrease — at minimum holds the
    // seed; at most grows by the session's per-problem awards.
    const cumulativeStardustBadge = page.getByTestId('hub-cumulative-stardust')
    const cumulativeAttr =
      await cumulativeStardustBadge.getAttribute('data-total')
    const cumulative = Number(cumulativeAttr)
    expect(Number.isFinite(cumulative)).toBe(true)
    expect(cumulative).toBeGreaterThanOrEqual(SEED_STARDUST)

    // The SessionEnd write path bumped sessionCount on disk. Read
    // the persisted blob back and assert.
    const persistedHistory = (await readSessionHistoryFromPage(page)) as {
      sessionCount: number
      lastSessionStardust: number
    } | null
    expect(persistedHistory).not.toBeNull()
    expect(persistedHistory!.sessionCount).toBeGreaterThanOrEqual(6)
  })
})
