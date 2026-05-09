/**
 * E2E spec — `Progress.history[N].latencyMs` band invariant.
 *
 * Ticket 86c9q7tpu (AC2). Regression pin for PR #167's fix-PR follow-up
 * to PR #164 (Leitner session-gen wiring + per-problem latency capture).
 *
 * The bug
 * -------
 * PR #164 wired `latencyMs` capture into the math screen, but the
 * anchor moment (`chipReadyAtRef.current = performance.now()`) ran
 * inside the read-aloud `.then()` callback — BEFORE React schedules
 * the `setReadAloudPlayed(true)` commit. On iPad Safari, touchstart
 * events queued during the `disabled → enabled` transition can
 * dispatch their click handler microseconds after the disabled flip,
 * so the captured "first tap latency" was sub-floor (9-178ms) — below
 * the 250ms human-reaction-time floor for an 8-yo on a choice-reaction
 * task (Whetstone et al. 2017).
 *
 * Real-iPad data on 2026-05-08 showed `[181331, 12236, 69, 602, 654,
 * 178, 9, 275]` — a mix of session-abandonment outliers (181331ms = 3
 * minutes), legitimate values (602, 654, 275), and physically-
 * impossible reaction times (9, 69, 178).
 *
 * The fix (PR #167, commit aebef2c)
 * ---------------------------------
 * 1. Move the anchor capture from the `.then()` body to a
 *    `useLayoutEffect([readAloudPlayed])` block. Layout effects run
 *    synchronously after DOM mutation but before paint — closest JS
 *    can get to the chip-paint event Marian actually perceives.
 * 2. Sanity-bound the captured value at write time:
 *      sub-floor (< 250ms)    → fold to -1 ("not measured" sentinel)
 *      above-ceiling (> 60s)  → fold to -1
 *      in-band [250ms, 60s]   → persist raw value
 *
 * The contract this spec pins
 * ---------------------------
 * Every entry in `progress.history[N].latencyMs` AFTER a math session
 * passes either:
 *   - `value === -1` (the sentinel), OR
 *   - `value >= 250 && value <= 60000` (the in-band range).
 *
 * The strongest assertion the spec can make in headless Chromium is
 * the sentinel-or-band shape — actual latency values vary based on
 * scheduling, paint timing, and the silent-caption-walk's read-aloud
 * delay. Real-iPad latency values would be clustered around 250-3000ms;
 * headless will hit either the sentinel (because the silent-caption
 * walk doesn't fire `boundary` events on the right cadence) or values
 * in band, but never the sub-floor noise that PR #164 produced before
 * the fix-PR.
 *
 * Status: this spec should PASS on main today (commit aebef2c is on
 * main). It's the regression pin for the fix that already shipped.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

interface PersistedHistoryEntry {
  dateISO: string
  skillFocus: string[]
  successRate: number
  latencyMs?: number[]
}

interface PersistedProgress {
  history: PersistedHistoryEntry[]
}

const PROBLEM_COUNT = 8
const LATENCY_FLOOR_MS = 250
const LATENCY_CEILING_MS = 60_000
const LATENCY_SENTINEL = -1

test.describe('Progress.history[N].latencyMs band invariant', () => {
  test.beforeEach(async ({ page }) => {
    // Same harness shape as `mastery-promotion.spec.ts` — silent
    // caption walk path, returning user, no /api/claude live call.
    await installClaudeMock(page, { failNetwork: true })
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  test('every persisted latencyMs entry is either -1 sentinel or in [250, 60000] ms', async ({
    page,
  }, testInfo) => {
    await page.goto('/')
    await forceHowlerUnlock(page)

    // Splash → Hub → Math.
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Walk 8 perfect chip taps. The post-fix anchor moment fires in
    // the `useLayoutEffect([readAloudPlayed])` block right before the
    // chip-tap; the chip-tap captures `performance.now() -
    // chipReadyAtRef.current` and writes the bounded value to
    // `latencyMsByProblemRef[i]`.
    for (let i = 1; i <= PROBLEM_COUNT; i++) {
      const correctChip = page.locator(
        '[data-testid="math-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()
      if (i < PROBLEM_COUNT) {
        await page.waitForTimeout(1500)
      }
    }

    // Drive through SessionEnd → Hub so `recordProgressOnSessionEnd`
    // runs (the mount effect is what writes `latencyMs` onto the new
    // `SessionHistoryEntry`).
    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 10_000,
    })
    const cta = page.getByTestId('session-end-cta')
    await expect(cta).toBeVisible({ timeout: 12_000 })
    await cta.click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    // Read the persisted progress blob. The new history entry sits at
    // the tail; e2e seed fixture seeds NO history, so the new entry
    // is at index 0.
    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted, 'persisted progress is null').not.toBeNull()
    expect(
      persisted.history.length,
      'history must contain exactly one new entry from the just-completed session',
    ).toBe(1)

    const entry = persisted.history[0]!

    // `latencyMs` is an OPTIONAL field (per `SessionHistoryEntry` —
    // additive non-bumping schema field). If the field is undefined
    // the spec passes vacuously — there are no entries to violate
    // the band. If it's present, every entry must satisfy the band
    // rule.
    //
    // Actually we want a stronger assertion: PR #164 SHIPS the field
    // for every math session, so a missing `latencyMs` post-#164 is
    // itself a regression. Assert presence.
    expect(
      entry.latencyMs,
      'latencyMs must be present on math session entries (PR #164 shipped this)',
    ).toBeDefined()
    expect(entry.latencyMs, 'latencyMs must be an array').toEqual(
      expect.any(Array),
    )

    const latencyMs = entry.latencyMs!

    // Length: one slot per problem.
    expect(
      latencyMs.length,
      `latencyMs.length must equal PROBLEM_COUNT (${PROBLEM_COUNT})`,
    ).toBe(PROBLEM_COUNT)

    // Diagnostic attachment so a CI failure surfaces the actual
    // values without requiring a re-run.
    await testInfo.attach('latencyMs-array', {
      body: JSON.stringify(latencyMs),
      contentType: 'application/json',
    })

    // The band invariant. Every entry: either the -1 sentinel OR
    // in [LATENCY_FLOOR_MS, LATENCY_CEILING_MS]. No other values
    // are valid post-#167 fix.
    //
    // Use index-aware error message so a failing entry's position
    // is visible at-a-glance in the failure log.
    for (let i = 0; i < latencyMs.length; i++) {
      const value = latencyMs[i]!
      const inBand = value >= LATENCY_FLOOR_MS && value <= LATENCY_CEILING_MS
      const isSentinel = value === LATENCY_SENTINEL
      const ok = inBand || isSentinel
      expect(
        ok,
        `latencyMs[${i}] = ${value}; must be -1 sentinel OR in [${LATENCY_FLOOR_MS}, ${LATENCY_CEILING_MS}] ms`,
      ).toBe(true)
    }
  })
})
