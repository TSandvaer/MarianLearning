/**
 * E2E spec — M5 `?reset=1` boot-time progress reset (FAILING-FIRST).
 *
 * Ticket 86c9kmwh0. Paired with Devon's M5 implementation PR; this spec
 * is authored BEFORE that code lands, so it is intentional-RED on `main`
 * until Devon's reset handler ships. See "Failing-first contract" below.
 *
 * Dispatch contract (shared with Devon — assert on OBSERVABLES, not impl)
 * ----------------------------------------------------------------------
 * Visiting `/?reset=1` → on App boot:
 *   1. `clearProgress()` runs → the localStorage Progress slot
 *      (`marian-tutor:progress:v1`) is cleared / returns to default —
 *      i.e. the seeded returning-user blob does NOT survive the boot.
 *   2. The app renders the FIRST-LAUNCH entry (Splash → Greet), NOT the
 *      Hub. A seeded returning user (sessionCount >= 1) would normally
 *      land on Hub straight after Splash; after `?reset=1` she lands on
 *      Greet instead — the once-ever first-launch moment.
 *
 * We do NOT gate on a toast / `console.log` — Devon may use either, and
 * neither is part of the contract. The two load-bearing observables are
 * the cleared Progress slot and the first-launch screen.
 *
 * What we assert (with failing-first classification per
 * `.claude/docs/testing-and-ci.md` Step 2)
 * ----------------------------------------------------------------------
 *  - **RED-on-base lever A** — after `/?reset=1`, the Hub screen
 *    (`data-testid="hub"`) NEVER becomes visible. On base, `?reset=1` is
 *    an unrecognised query param (no-op), the seeded returning-user blob
 *    survives, and Splash auto-advances to Hub — so this assertion FAILS
 *    on base for the right reason (Hub appears). Goes GREEN once Devon's
 *    reset clears progress + session history so the first-launch branch
 *    is taken.
 *  - **RED-on-base lever B** — after `/?reset=1`, the first-launch Greet
 *    screen (`data-testid="greet"`) becomes visible. On base it never
 *    does (the returning user goes Splash → Hub), so this FAILS on base.
 *    Goes GREEN once the reset forces the first-launch entry.
 *  - **RED-on-base lever C** — after the boot settles, the persisted
 *    Progress slot is cleared (`loadProgress`-equivalent read returns the
 *    default `add-to-10: 'practicing'` baseline, NOT the seeded
 *    `'mastered'` we planted). On base the seeded `'mastered'` survives,
 *    so this FAILS on base. Goes GREEN once `clearProgress()` runs at
 *    boot.
 *  - **Regression-lock (control test)** — WITHOUT `?reset=1`, the same
 *    seeded returning user lands on Hub and her seeded progress survives.
 *    This passes on base AND must keep passing after Devon's PR (the
 *    reset must be gated on the query param, never fire unconditionally).
 *
 * At least one RED-on-base lever is required per failing-first spec; this
 * spec carries three (A, B, C) plus the regression-lock control.
 *
 * Count-assertion discipline (`feedback_count_assertions_on_regression_tests`)
 * ----------------------------------------------------------------------
 * The progress-cleared check reads the seeded node's level back and uses
 * `.toBe(...)` on the exact value — never `.toContain`. Screen presence
 * uses Playwright `.toBeVisible()` / `.toBeHidden()` on a unique testid.
 *
 * Browser-engine support
 * ----------------------
 * Runs on chromium AND webkit. The reset path is pure boot-time
 * JavaScript (query-param read → clearProgress → first-launch route);
 * no AudioContext dependency, so no chromium-only gate. Splash → Greet
 * advance is a silent timer; the first-launch entry needs no gesture
 * unlock to be observable.
 */

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import { IPAD_PORTRAIT_VIEWPORT } from './_helpers/iPadViewport'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * The seeded returning-user state: a non-empty Progress blob whose
 * `add-to-10` node is `'mastered'` (the diagnostic default is
 * `'practicing'`, so a post-reset read landing on `'practicing'` proves
 * the seeded blob was cleared and the default baseline took over).
 * Paired with a sessionCount >= 1 session-history blob so — on base —
 * Splash auto-advances straight to Hub.
 */
const SEEDED_NODE = 'add-to-10'
const SEEDED_LEVEL = 'mastered'
const DEFAULT_LEVEL = 'practicing' // defaultProgress() baseline for add-to-10

function seededProgress(): unknown {
  return buildSeedProgress({
    skillLevelOverrides: { [SEEDED_NODE]: SEEDED_LEVEL },
  })
}

/** Read the seeded node's level back out of the persisted Progress slot.
 *  Returns null when the slot is absent entirely. */
async function readSeededNodeLevel(
  page: import('@playwright/test').Page,
): Promise<string | null> {
  const progress = (await readProgressFromPage(page)) as {
    skillLevels?: Record<string, string>
  } | null
  if (progress === null) return null
  return progress.skillLevels?.[SEEDED_NODE] ?? null
}

test.describe('M5 ?reset=1 boot-time progress reset', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({
      width: IPAD_PORTRAIT_VIEWPORT.width,
      height: IPAD_PORTRAIT_VIEWPORT.height,
    })
    // No live pipeline — boot/reset specs don't drive a session. The
    // failNetwork mock keeps any incidental session-start fetch off the
    // wire.
    await installClaudeMock(page, { failNetwork: true })
  })

  // -------------------------------------------------------------------------
  // RED-on-base levers A + B — /?reset=1 lands first-launch (Greet), not Hub
  // -------------------------------------------------------------------------

  test('/?reset=1 renders first-launch (Greet), never Hub, on a seeded returning user', async ({
    page,
  }) => {
    // Plant a non-empty returning-user state that — without reset —
    // routes Splash → Hub.
    await seedLocalStorage(page, {
      progress: seededProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/?reset=1')

    // RED-on-base lever B: the first-launch Greet screen renders. On base
    // the returning user goes Splash → Hub and Greet never appears, so
    // this expectation FAILS on base. Goes GREEN once the reset forces
    // the first-launch branch (sessionCount cleared → nextAfterSplash
    // returns 'greet').
    await expect(page.getByTestId('greet')).toBeVisible({ timeout: 10_000 })

    // RED-on-base lever A: the Hub screen NEVER becomes visible. On base
    // the seeded returning user lands on Hub, so the Hub testid IS present
    // and this FAILS. Goes GREEN once the reset takes the first-launch
    // path. Asserting hidden AFTER Greet is visible avoids a racy
    // "hasn't mounted yet" false-negative — by the time Greet is up, the
    // post-Splash branch has been chosen.
    await expect(page.getByTestId('hub')).toBeHidden()
  })

  // -------------------------------------------------------------------------
  // RED-on-base lever C — the persisted Progress slot is cleared at boot
  // -------------------------------------------------------------------------

  test('/?reset=1 clears the persisted Progress slot (seeded mastery does not survive)', async ({
    page,
  }) => {
    await seedLocalStorage(page, {
      progress: seededProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/?reset=1')

    // Wait for the boot to settle on the first-launch entry so the reset
    // has definitely run before we read storage back.
    await expect(page.getByTestId('greet')).toBeVisible({ timeout: 10_000 })

    // RED-on-base lever C: read the seeded node level back. After a real
    // reset the slot is cleared; the App's greenfield boot writes the
    // default baseline (or leaves it absent until first save). Either way
    // the seeded `'mastered'` must NOT survive. On base the seeded
    // `'mastered'` round-trips intact, so this FAILS on base.
    //
    // Count-assertion discipline: exact `.toBe`, never `.toContain`.
    const level = await readSeededNodeLevel(page)
    expect(level).not.toBe(SEEDED_LEVEL)
    // Stronger form: when the slot is rewritten to defaults the node is
    // back at the diagnostic baseline; when the slot is simply removed
    // the read returns null. Both are acceptable post-reset states; the
    // seeded mastery is the only forbidden one. The `not.toBe` above is
    // the load-bearing assertion — this comment documents the accepted
    // GREEN shapes for the post-merge verifier.
    expect([DEFAULT_LEVEL, null]).toContainEqual(level)
  })

  // -------------------------------------------------------------------------
  // Regression-lock (control) — WITHOUT ?reset=1, nothing resets
  // -------------------------------------------------------------------------

  test('control: without ?reset=1, the seeded returning user lands on Hub and progress survives', async ({
    page,
  }) => {
    await seedLocalStorage(page, {
      progress: seededProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    // No query param — the ordinary returning-user boot.
    await page.goto('/')

    // Splash → Hub for a returning user. Passes on base AND must keep
    // passing after Devon's PR — the reset must be gated on the query
    // param and must never fire on an ordinary boot.
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('greet')).toBeHidden()

    // The seeded mastery survives an ordinary boot. Exact `.toBe`.
    const level = await readSeededNodeLevel(page)
    expect(level).toBe(SEEDED_LEVEL)
  })
})
