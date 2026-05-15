/**
 * E2E spec — `sub-to-10` full progression-mastery loop.
 *
 * Paired with Kevin's PR 1 (`feat/sub-to-10-content`).
 *
 * What the spec asserts (per `feedback_progression_e2e_mandatory`)
 * ---------------------------------------------------------------
 * Seed: `add-to-10` mastered, `add-to-20` mastered, `sub-to-10`
 * `'practicing'`, no prior sub-to-10 sessions. Walk 3 sessions at
 * 100% accuracy.
 *
 *   1. After session 3, `skillLevels['sub-to-10'] === 'mastered'`.
 *   2. After session 3, the downstream node `'sub-to-20'` flips
 *      `'locked' → 'intro'`. The focus-node picker now lands on
 *      `'sub-to-20'` per the existing `MATH_NODES_IN_ORDER`
 *      (Thomas decision #2 = Option A — tree stays
 *      `add-to-10 → add-to-20 → sub-to-10 → sub-to-20`).
 *   3. History contains exactly 3 new entries, all with
 *      `skillFocus: ['sub-to-10']` and `successRate: 1`.
 *
 * Why 3 sessions at 80/2 threshold
 * --------------------------------
 * The math default threshold is `95/3` (locked 2026-05-02). The
 * sibling `progression-mastery-loop.spec.ts` precedent uses `80/2`
 * with `crossDayEnforcement: false` to keep the session count low
 * for CI cost. Same pattern here. The `intro → practicing`
 * transition fires inside session 1's `applyMasteryRule`; the
 * `practicing → mastered` scan promotes on session 2's call (2 perfect
 * entries clear the 2-session window at 80%).
 *
 * **But the seed sets `sub-to-10: 'practicing'` directly, not
 * `'intro'`.** Per the spec at `progress-and-persistence.md` § "Mastery
 * rule (M3)", a `practicing → mastered` scan needs `threshold.sessions`
 * qualifying entries — so 2 perfect sub-to-10 sessions at 80% are
 * sufficient to promote on session 2's call. We run 3 sessions for a
 * belt-and-braces idempotence check on session 3 + to observe the
 * picker landing on `sub-to-20` for session 3.
 *
 * Failing-first contract
 * ----------------------
 * On RED `main` (commit `ea9e53a`):
 *   - The capturing math mock returns the canonical math fixture (a
 *     valid addition plan with silent placeholder MP3s). The screen
 *     parses the plan and falls into the silent-caption walk for
 *     each session.
 *   - **The load-bearing RED lever is the wire-shape assertion**
 *     (smoking gun 0): `payload.progress.lifetimeFirstEncounters`
 *     must ship as an array on the math request. On RED,
 *     `App.tsx§readProgressHintsForTrack` only ships the field for
 *     `track === 'word-song'` (line 248-249) — for math it's
 *     `undefined`. `Array.isArray(undefined)` is `false` → assertion
 *     fails.
 *   - The persisted-state assertions (smoking guns A/B/C) are the
 *     regression-lock half. The mastery rule reads
 *     `history[i].skillFocus` regardless of content op, so 3 perfect
 *     addition-content sessions stamped `skillFocus: ['sub-to-10']`
 *     (the picker returns `'sub-to-10'` from the seed) DO promote
 *     sub-to-10 even on RED. These assertions pin the end-to-end
 *     contract against future regressions when Kevin's
 *     progression-state-machine-adjacent code lands.
 *
 * On GREEN (Kevin's PR 1): `readProgressHintsForTrack` widens to
 * ship `lifetimeFirstEncounters` for math (or specifically when the
 * focus node is in the gated set including `'sub-to-10'`). The
 * wire-shape assertion turns green; all persisted-state assertions
 * remain green.
 *
 * Out of scope
 * ------------
 * - Cross-day enforcement edge cases — covered by mastery.test.ts.
 * - Multi-tier cascades — covered by progression-mastery-loop.spec.ts.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
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
}

/**
 * Install a math-only mock that ALSO captures every observed request.
 * Mirrors the precedent in `slow-fact-directive-injection.spec.ts`.
 * The captured requests give the test a wire-shape signal in addition
 * to the persisted-state signal — the wire-shape half is the
 * RED-on-main lever for this spec (per the file header docstring).
 */
async function installCapturingMathMock(
  page: Page,
): Promise<{ requests: Request[] }> {
  const requests: Request[] = []
  await page.route('**/api/claude', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    if (req.method() !== 'POST') {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: '{}',
      })
      return
    }
    requests.push(req)
    let body: Record<string, unknown>
    try {
      body = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>
    } catch {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: '{}',
      })
      return
    }
    const payload = (body.payload ?? {}) as Record<string, unknown>
    const track = payload.track as string | undefined
    if (track === 'math') {
      // Return the canonical math fixture (silent-MP3-bearing
      // addition plan) so the screen flow stays alive enough to
      // walk to SessionEnd. Content correctness isn't what this
      // spec asserts — the focus is the wire-shape signal +
      // persisted-state cascade.
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
        error: 'unexpected-track',
        message: `sub-to-10 progression spec is math-only; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

function mathRequests(requests: ReadonlyArray<Request>): Request[] {
  return requests.filter((r) => {
    try {
      const body = JSON.parse(r.postData() ?? '{}') as Record<string, unknown>
      const payload = body.payload as Record<string, unknown> | undefined
      return payload?.track === 'math'
    } catch {
      return false
    }
  })
}

/**
 * WebKit headless has no AudioContext → chips never become enabled.
 * Pattern mirrored from `progression-mastery-loop.spec.ts`.
 */
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext. Chromium coverage is sufficient.',
  )
}

async function runOneMathSession(page: Page): Promise<void> {
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
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
}

test.describe('sub-to-10 progression-mastery loop', () => {
  let requests: Request[] = []

  test.beforeEach(async ({ page }) => {
    // Capturing math mock returns the canonical math fixture; the
    // screen falls into the silent-caption walk because the mocked
    // canon is a valid addition plan (parser succeeds, audio decode
    // soft-fails on the placeholder MP3 in CI). Captured requests
    // let us assert the wire-shape lever for this spec.
    const installed = await installCapturingMathMock(page)
    requests = installed.requests

    // Seed:
    //   - All math nodes through `add-to-20` mastered.
    //   - `sub-to-10` at `'practicing'` (post-Thomas decision #1,
    //     this is the new default; we set it explicitly so the test
    //     is stable both before and after the default flips).
    //   - `sub-to-20` overridden to `'locked'` so the downstream
    //     cascade is observable on this seed (the
    //     seedStorage.ts:DEFAULT_SKILL_LEVELS default for sub-to-20
    //     is `'intro'`, which would make the cascade vacuous).
    //   - `crossDayEnforcement: false` + 80/2 math threshold so two
    //     perfect back-to-back sessions promote.
    const seedProgress = {
      schemaVersion: 1,
      profile: {
        childName: 'Marian',
        character: 'melody',
        lastPlayedISO: null,
      },
      skillLevels: {
        'number-recog': 'mastered',
        'add-to-10': 'mastered',
        'add-to-20': 'mastered',
        'sub-to-10': 'practicing',
        'sub-to-20': 'locked',
        'two-digit-addsub': 'locked',
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
      },
      mathFactsLeitner: { items: [] },
      history: [],
      parentSettings: {
        autoPromote: true,
        sessionModePicker: 'off',
        masteryThreshold: {
          math: { percent: 0.8, sessions: 2 },
          'word-song': { percent: 0.8, sessions: 2 },
        },
        crossDayEnforcement: false,
        showLevelToMarian: false,
      },
    }

    await seedLocalStorage(page, {
      progress: seedProgress,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  test('three perfect sub-to-10 sessions: practicing → mastered, sub-to-20 unlocks locked → intro', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // 3 sessions × ~25s each (1500ms × 8 chips + nav overhead) is
    // close to the 90s default. Bump for CI safety.
    test.setTimeout(180_000)

    await page.goto('/')
    await forceHowlerUnlock(page)

    await runOneMathSession(page)
    await runOneMathSession(page)
    await runOneMathSession(page)

    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()

    // SMOKING GUN 0 — wire-shape: session 1's math request payload
    // carries focusNode === 'sub-to-10' AND ships
    // lifetimeFirstEncounters as an array (post-Kevin PR 1 widening
    // of `readProgressHintsForTrack` to include math).
    //
    // Failing-first lever — on RED, `App.tsx§readProgressHintsForTrack`
    // ships `lifetimeFirstEncounters` only for word-song. On the
    // first captured math request the field is `undefined` →
    // `Array.isArray` returns `false` → assertion fails.
    //
    // On GREEN (Kevin's PR 1): the field is shipped as an array for
    // math when focusNode is in the gated set.
    const mathReqs = mathRequests(requests)
    expect(mathReqs.length).toBeGreaterThanOrEqual(1)
    const firstBody = JSON.parse(mathReqs[0]!.postData() ?? '{}') as Record<
      string,
      unknown
    >
    const firstPayload = firstBody.payload as Record<string, unknown>
    const firstProgress = firstPayload.progress as Record<string, unknown>
    expect(firstProgress).toBeDefined()
    expect(firstProgress.focusNode).toBe('sub-to-10')
    expect(
      Array.isArray(firstProgress.lifetimeFirstEncounters),
      'math payload must ship lifetimeFirstEncounters as an array (post-Kevin PR 1)',
    ).toBe(true)

    // SMOKING GUN A — sub-to-10 mastered.
    expect(persisted.skillLevels['sub-to-10']).toBe('mastered')

    // SMOKING GUN B — downstream cascade: sub-to-20 unlocked.
    // The expected post-cascade state is 'intro' on first
    // observation, OR 'practicing' if session 3 ran on sub-to-20
    // (post-cascade) and a fresh `intro → practicing` fired in the
    // same `applyMasteryRule` pass. Either is correct per the
    // N+1-session cascade chain in
    // `progress-and-persistence.md` §"Mastery rule (M3)".
    const subToTwentyLevel = persisted.skillLevels['sub-to-20']
    expect(['intro', 'practicing']).toContain(subToTwentyLevel)
    // Defensive: must NOT still be 'locked' (the cascade fires) and
    // must NOT be 'mastered' (only 1-2 sessions on it at most).
    expect(subToTwentyLevel).not.toBe('locked')
    expect(subToTwentyLevel).not.toBe('mastered')

    // SMOKING GUN C — history shape. Three new entries. First two
    // run on sub-to-10 (the picker landed there). Third entry's
    // focus depends on whether session 2 already promoted sub-to-10
    // (in which case session 3 ran on sub-to-20). Both cases are
    // captured in the count-based assertion below.
    expect(persisted.history.length).toBe(3)
    const lastThree = persisted.history.slice(-3)
    for (const entry of lastThree) {
      expect(entry.successRate).toBe(1)
    }
    // The first two entries are unambiguously on sub-to-10.
    expect(lastThree[0]!.skillFocus).toEqual(['sub-to-10'])
    expect(lastThree[1]!.skillFocus).toEqual(['sub-to-10'])
    // The third entry is on sub-to-10 OR sub-to-20 depending on
    // when promotion fired (sessions 2's applyMasteryRule call
    // promotes; session 3 then runs on the next focus node). Per
    // `progress-and-persistence.md` §"N+1-session cascade", the
    // tail entry IS the post-promotion entry — on sub-to-20.
    const thirdFocus = lastThree[2]!.skillFocus
    expect([['sub-to-10'], ['sub-to-20']]).toContainEqual(thirdFocus)
  })
})
