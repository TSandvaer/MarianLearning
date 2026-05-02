/**
 * E2E spec — Mastery promotion happy path.
 *
 * Ticket 86c9kwnmx (P0.1 from the 2026-05-02 polish audit). Closes the
 * "M3 mastery rule has unit-only coverage; full integration through
 * `recordProgressOnSessionEnd` is untested" gap.
 *
 * Seed shape
 * ----------
 *  - `add-to-10` is at `'practicing'` (the diagnostic baseline).
 *  - `add-to-20` is at `'locked'` (downstream node — promotion ought to
 *    nudge it to `'intro'`).
 *  - History carries 3 cross-day entries, each with skillFocus
 *    `['add-to-10']` and successRate 1.0 (perfect 8/8 sessions).
 *  - Mastery threshold is the M3 default (0.95 percent / 3 sessions),
 *    cross-day enforcement on, autoPromote on.
 *
 * What we run
 * -----------
 *  - Hub → Math → 8/8 correct → SessionEnd → "All done!" → Hub.
 *
 * What we assert (post-flip)
 * --------------------------
 *  - Persisted `Progress.skillLevels['add-to-10']` === `'mastered'`.
 *  - Persisted `Progress.skillLevels['add-to-20']` === `'intro'`.
 *  - Persisted `Progress.history.length` === 4 (3 seeded + 1 new).
 *
 * Catches the in-flight P0.2 / P0.3 regressions
 * ---------------------------------------------
 *  - P0.2 (`recordProgressOnSessionEnd` SURFACE_FOCUS hardcode): today
 *    is the unit-tested-pure-functions case; if the focus-node
 *    propagation refactor lands and the SURFACE_FOCUS map is replaced
 *    with the right per-problem lookup, this spec must continue to
 *    pass — the seeded history's skillFocus and the new entry's
 *    skillFocus must intersect on `add-to-10` for promotion to fire.
 *  - P0.3 (cross-day UTC vs local-day): the spec seeds dates across
 *    three distinct UTC days; promotion fires under either UTC or
 *    local-day semantics. If the rule is widened to local-day, this
 *    spec stays green; we add a separate timezone-pinned spec when
 *    the local-day fix lands.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

interface PersistedProgress {
  skillLevels: Record<string, string>
  history: Array<{ dateISO: string; skillFocus: string[]; successRate: number }>
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  // Mid-day UTC so the `slice(0, 10)` cross-day key is unambiguous
  // regardless of how this run is scheduled.
  d.setUTCHours(12, 0, 0, 0)
  return d.toISOString()
}

test.describe('Mastery promotion happy path', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page)

    const seedProgress = buildSeedProgress({
      skillLevelOverrides: {
        'add-to-10': 'practicing',
        'add-to-20': 'locked',
      },
      history: [
        { dateISO: isoDaysAgo(3), skillFocus: ['add-to-10'], successRate: 1 },
        { dateISO: isoDaysAgo(2), skillFocus: ['add-to-10'], successRate: 1 },
        { dateISO: isoDaysAgo(1), skillFocus: ['add-to-10'], successRate: 1 },
      ],
      masteryThreshold: { percent: 0.95, sessions: 3 },
    })

    await seedLocalStorage(page, {
      progress: seedProgress,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  test('a perfect 4th cross-day math session promotes add-to-10 → mastered and add-to-20 → intro', async ({
    page,
  }) => {
    await page.goto('/')

    // Splash → Hub → Math.
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Drive 8 perfect chip taps.
    for (let i = 1; i <= 8; i++) {
      const correctChip = page.locator(
        '[data-testid="math-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()
      if (i < 8) {
        await page.waitForTimeout(1500)
      }
    }

    // SessionEnd → "All done!" → Hub. Driving the full flow is the
    // load-bearing part: the mastery rule fires inside
    // `recordProgressOnSessionEnd`, which runs on SessionEnd MOUNT,
    // not on the CTA tap. We still tap through to Hub so the
    // post-condition mirrors what Marian would observe.
    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 10_000,
    })
    const cta = page.getByTestId('session-end-cta')
    await expect(cta).toBeVisible({ timeout: 12_000 })
    await cta.click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    // Persisted Progress reflects the promotion.
    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()
    expect(persisted.skillLevels['add-to-10']).toBe('mastered')
    expect(persisted.skillLevels['add-to-20']).toBe('intro')

    // History grew by exactly one entry. The new entry's successRate
    // should be 1 (we tapped 8/8 correct chips). skillFocus reflects
    // the surface — today this is the SURFACE_FOCUS hardcode
    // `['add-to-10']`; once P0.2 lands, it should still include
    // `add-to-10` when the active focus is in fact add-to-10.
    expect(persisted.history.length).toBe(4)
    const newest = persisted.history[persisted.history.length - 1]!
    expect(newest.successRate).toBe(1)
    expect(newest.skillFocus).toContain('add-to-10')
  })
})
