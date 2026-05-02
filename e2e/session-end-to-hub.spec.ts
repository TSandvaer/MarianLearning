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
 *  5. Persisted `sessionCount` bumps from 5 (seed) → 6.
 *  6. Persisted `longestStreakEver` reflects the 8-in-a-row streak.
 *  7. The separate stardust adapter (`marian-tutor.stardust.v1`) wrote
 *     a positive total — every correct tap registered.
 *
 * What we deliberately do NOT pin
 * -------------------------------
 *  - Exact stardust amount. Stardust is derived from per-problem timing +
 *    streak bonuses; the formula has enough surface that an exact value
 *    is brittle. Fine-grained arithmetic stays in
 *    `_shared/stardust.test.ts`.
 *  - `lastSessionStardust`. There is a real production bug here that
 *    surfaces only when the seed pre-populates `cumulativeStardust`
 *    higher than the session actually earns — see the inline note at
 *    the bottom. Follow-up ticket should fix the SessionEnd call site
 *    to pass `earnedThisSession`.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  readSessionHistoryFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

const SEED_STARDUST = 12

test.describe('Math session → SessionEnd → Hub flip', () => {
  test.beforeEach(async ({ page }) => {
    // See `hub-to-math.spec.ts` for the rationale on `failNetwork: true` —
    // routes the suite through the silent-caption-walk fallback path
    // (which is also what Marian sees on a real Anthropic outage).
    await installClaudeMock(page, { failNetwork: true })
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

    // Bridge the headless-browser gesture-unlock gap. See
    // `forceHowlerUnlock`'s docstring for the rationale.
    await forceHowlerUnlock(page)

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
        // Math advances to the next problem. Wait for the streak
        // counter or the next read-aloud to complete.
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

    // Cumulative stardust HUD reflects a real, non-negative integer.
    // We deliberately don't compare against the seed: `cumulativeStardust`
    // is recomputed at session-end as `stardustState.total` (read from a
    // SEPARATE localStorage key — see `recordSessionEnd` in
    // `screens/SessionEnd/sessionHistory.ts`). Our seed only writes the
    // session-history key; the stardust adapter starts at 0 and the new
    // total is whatever this session earned. A stronger seed would
    // pre-populate the stardust key too — out of scope for v1.
    const cumulativeStardustBadge = page.getByTestId('hub-cumulative-stardust')
    const cumulativeAttr =
      await cumulativeStardustBadge.getAttribute('data-total')
    const cumulative = Number(cumulativeAttr)
    expect(Number.isFinite(cumulative)).toBe(true)
    expect(cumulative).toBeGreaterThanOrEqual(0)
    // Earning eight correct answers should produce > 0 stardust under
    // every realistic stardust formula (`_shared/stardust.ts`).
    expect(cumulative).toBeGreaterThan(0)

    // The SessionEnd write path bumped sessionCount on disk. Read
    // the persisted blob back and assert.
    interface PersistedSessionHistory {
      sessionCount: number
      lastSessionStardust: number
      cumulativeStardust: number
      longestStreakEver: number
    }
    const ph = (await readSessionHistoryFromPage(
      page,
    )) as PersistedSessionHistory | null
    expect(ph).not.toBeNull()
    expect(ph!.sessionCount).toBeGreaterThanOrEqual(6)
    // longestStreakEver was 4 in the seed. After 8 correct in a row,
    // it should be at least 8 — proves the correct chip taps registered.
    expect(ph!.longestStreakEver).toBeGreaterThanOrEqual(8)

    // The separate stardust adapter (`marian-tutor.stardust.v1`) is the
    // source of truth for `cumulativeStardust` — `recordSessionEnd`
    // copies its current total verbatim. We assert the stardust key
    // grew past 0 (every correct tap grants 1 unit).
    const stardustRaw = await page.evaluate(() => {
      return window.localStorage.getItem('marian-tutor.stardust.v1')
    })
    expect(stardustRaw).not.toBeNull()
    const stardustParsed = JSON.parse(stardustRaw!) as { total: number }
    expect(stardustParsed.total).toBeGreaterThan(0)

    // NB: a real production bug surfaces here:
    //   `lastSessionStardust` is computed as `cumulativeStardust - prev.cumulativeStardust`
    //   ONLY when `recordSessionEnd` is called WITHOUT `earnedThisSession`.
    //   SessionEnd.tsx currently calls `recordSessionEnd(finalStreak, storage, now)`
    //   — 3 args, no `earnedThisSession`. When the seed
    //   pre-populates `cumulativeStardust` higher than the session's
    //   actual earn, the delta is negative and `lastSessionStardust`
    //   collapses to 0.
    //   File this as a follow-up ticket; not blocking the harness.
  })
})
