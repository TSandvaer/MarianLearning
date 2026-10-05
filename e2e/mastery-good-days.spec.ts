/**
 * E2E spec — mastery = 3 good days at 7/8+, any order, never lost.
 *
 * Ticket 123jpnbc3dm (Emma's Path 4/10; plan
 * `design/progression-emmas-path.md`, decision 1 — Thomas 2026-10-04).
 *
 * Failing-first: on main before this ticket the rule was "the last 3
 * cross-day sessions all >= 95% (math)", i.e. three 8/8 days in a row
 * where one weak or 7/8 day reset the run, and only `history` (30-entry
 * cap) was consulted. Both tests below stay at `'practicing'` there.
 *
 *   1. Any order, 7/8 counts: seeded history has two 7/8 days with weak
 *      days between and after them; one more good session today is the
 *      third good day → `sub-to-10` mastered, `sub-to-20` unlocks.
 *      (Main: the last three days are 7/8, 5/8, 8/8 → not all >= 95%.)
 *   2. Never lost: two good days are banked only in the persisted
 *      `goodDays` counter (their sessions aged out of history); one good
 *      session today → mastered. (Main: one history entry, the counter
 *      is ignored → practicing.)
 *
 * Both tests drive ONE real math session through the browser so the
 * session-end write path (`recordProgressOnSessionEnd` →
 * `applyMasteryRule` → `saveProgress`) is what produces the asserted
 * state — not a unit-level call.
 *
 * Session-driving strategy mirrors `sub-to-10-progression-mastery.spec.ts`
 * (capturing math mock serving the canonical fixture, `forceHowlerUnlock`
 * because the chip walk needs Howler running, chromium-only because
 * WebKit headless has no AudioContext). The assertions are on persisted
 * `skillLevels` / `goodDays`, which are content-agnostic.
 */

import { test, expect } from '@playwright/test'
import { returnToHubAfterAllDone } from './_helpers/allDoneToHub'
import type { Page } from '@playwright/test'
import { canonicalMathSessionResponse } from './fixtures/canonicalSessionResponses'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

interface PersistedProgress {
  skillLevels: Record<string, string>
  history: Array<{ dateISO: string; skillFocus: string[]; successRate: number }>
  goodDays?: Record<string, string[]>
}

const DAY_MS = 24 * 60 * 60 * 1000

/** A session timestamp `n` days before now (distinct local days per n). */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString()
}

async function installMathMock(page: Page): Promise<void> {
  await page.route('**/api/claude', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    let track: unknown
    try {
      const body = JSON.parse(req.postData() ?? '{}') as {
        payload?: { track?: unknown }
      }
      track = body.payload?.track
    } catch {
      track = undefined
    }
    if (req.method() === 'POST' && track === 'math') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(canonicalMathSessionResponse()),
      })
      return
    }
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'unexpected-request',
        message: `mastery-good-days spec is math-only; saw ${req.method()} track=${String(track)}`,
      }),
    })
  })
}

function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext. Chromium coverage is sufficient.',
  )
}

/** One 8/8 math session from the Hub back to the Hub. */
async function runOnePerfectMathSession(page: Page): Promise<void> {
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  await page
    .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
    .click()
  await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

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

  await expect(page.getByTestId('session-end')).toBeVisible({ timeout: 10_000 })
  const cta = page.getByTestId('session-end-cta')
  await expect(cta).toBeVisible({ timeout: 12_000 })
  await cta.click()
  await returnToHubAfterAllDone(page)
}

/**
 * Math through `add-to-20` mastered, `sub-to-10` practicing (the focus
 * node), `sub-to-20` locked so the unlock cascade is observable; the
 * literacy tree is mastered so the picker cannot wander there.
 */
function seedSkillLevels(): Record<string, string> {
  return {
    'number-recog': 'mastered',
    'add-to-10': 'mastered',
    'add-to-20': 'mastered',
    'sub-to-10': 'practicing',
    'sub-to-20': 'locked',
    'two-digit-addsub-no-regroup': 'locked',
    'two-digit-addsub-with-regroup': 'locked',
    'skip-counting': 'locked',
    'mult-2-5-10': 'locked',
    'mult-3-4': 'locked',
    'mult-6-9': 'locked',
    'letter-names': 'mastered',
    'letter-sounds': 'mastered',
    'blending-cv': 'mastered',
    'cvc-words': 'mastered',
    'cvc-words-short-o': 'mastered',
    'cvc-words-short-u': 'mastered',
    'cvc-words-short-i': 'mastered',
    'cvc-words-short-e': 'mastered',
    'digraphs-sh': 'mastered',
    'digraphs-ch': 'mastered',
    'digraphs-th-voiceless': 'mastered',
    'sight-words': 'mastered',
    'simple-sentences': 'locked',
  }
}

function baseSeed(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    profile: { childName: 'Marian', character: 'melody', lastPlayedISO: null },
    skillLevels: seedSkillLevels(),
    mathFactsLeitner: { items: [] },
  }
}

test.describe('mastery: 3 good days at 7/8+, any order, never lost (ticket 123jpnbc3dm)', () => {
  test.beforeEach(async ({ page }) => {
    await installMathMock(page)
  })

  test('7/8 days count and weak days in between do not reset: third good day masters sub-to-10', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(120_000)

    // No parentSettings on the blob → the app's defaults apply.
    await seedLocalStorage(page, {
      progress: {
        ...baseSeed(),
        history: [
          {
            dateISO: daysAgo(4),
            skillFocus: ['sub-to-10'],
            successRate: 0.875,
          },
          { dateISO: daysAgo(3), skillFocus: ['sub-to-10'], successRate: 0.5 },
          {
            dateISO: daysAgo(2),
            skillFocus: ['sub-to-10'],
            successRate: 0.875,
          },
          {
            dateISO: daysAgo(1),
            skillFocus: ['sub-to-10'],
            successRate: 0.625,
          },
        ],
      },
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)
    await runOnePerfectMathSession(page)

    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()

    // The session ran on sub-to-10 at 8/8 (one new history entry).
    expect(persisted.history).toHaveLength(5)
    expect(persisted.history.at(-1)!.skillFocus).toEqual(['sub-to-10'])
    expect(persisted.history.at(-1)!.successRate).toBe(1)

    expect(persisted.skillLevels['sub-to-10']).toBe('mastered')
    expect(persisted.skillLevels['sub-to-20']).toBe('intro')

    // Three good days banked: the two seeded 7/8 days + today.
    expect(persisted.goodDays?.['sub-to-10']).toHaveLength(3)
  })

  test('good days banked in the counter survive history aging out', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(120_000)

    await seedLocalStorage(page, {
      progress: {
        ...baseSeed(),
        // The sessions behind these two good days are gone from history.
        history: [],
        goodDays: { 'sub-to-10': ['2026-01-05', '2026-01-06'] },
      },
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)
    await runOnePerfectMathSession(page)

    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()
    expect(persisted.history).toHaveLength(1)
    expect(persisted.history[0]!.skillFocus).toEqual(['sub-to-10'])

    expect(persisted.skillLevels['sub-to-10']).toBe('mastered')
    expect(persisted.skillLevels['sub-to-20']).toBe('intro')

    // Banked days kept + today's added — never removed.
    const days = persisted.goodDays?.['sub-to-10'] ?? []
    expect(days).toHaveLength(3)
    expect(days.slice(0, 2)).toEqual(['2026-01-05', '2026-01-06'])
  })
})
