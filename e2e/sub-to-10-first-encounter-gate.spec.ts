/**
 * E2E spec — `sub-to-10` first-encounter scaffolding gate.
 *
 * Paired with Kevin's PR 1 (`feat/sub-to-10-content`).
 *
 * What the spec asserts (per `design/math/sub-to-10-content.md` §4.3
 * and the corresponding wire-level signal from
 * `api/_firstEncounterGate.ts`)
 * --------------------------------------------------------------------
 * 1. **First-encounter branch.** Seed Marian with `sub-to-10` at
 *    `'practicing'` and an EMPTY `lifetimeFirstEncounters` list
 *    (greenfield for the tier — math has never shipped first-encounter
 *    scaffolding before). On the next math session, the request
 *    payload must:
 *
 *      - carry `payload.progress.focusNode === 'sub-to-10'`;
 *      - carry `payload.progress.lifetimeFirstEncounters` as an
 *        array (the field is shipped for math now, not omitted
 *        post-Kevin's PR 1 — see App.tsx§readProgressHintsForTrack
 *        widening);
 *      - the shipped list does NOT contain `'sub-to-10'` (greenfield
 *        signal that the server-side gate should fire scaffolding).
 *
 * 2. **Already-encountered branch.** Seed `lifetimeFirstEncounters`
 *    pre-populated with `'sub-to-10'` (the child has done one
 *    session on the tier; the gate already fired). The next math
 *    session's request payload must carry
 *    `payload.progress.lifetimeFirstEncounters` containing
 *    `'sub-to-10'`.
 *
 * Why we assert on the WIRE shape, not the read-line text
 * -------------------------------------------------------
 * The scaffolding rewrite happens server-side in
 * `_firstEncounterGate.ts:applyFirstEncounterGate`. In e2e we mock the
 * `/api/claude` endpoint, so the server-side behaviour itself is
 * covered by `_firstEncounterGate.test.ts` (Kevin's unit). What this
 * spec pins is the BROWSER-SIDE contract: the payload carries the
 * field with the right shape so the (real) server has the input it
 * needs.
 *
 * Failing-first contract
 * ----------------------
 * On RED `main` (commit `ea9e53a`):
 *   - `App.tsx§readProgressHintsForTrack` ships
 *     `lifetimeFirstEncounters` ONLY for `track === 'word-song'`
 *     (line 248-249). For math the field is `undefined`.
 *   - Assertion 1's "field MUST be present on math" check **FAILS**:
 *     `payload.progress.lifetimeFirstEncounters === undefined` (the
 *     field is absent / unsent).
 *   - Assertion 2 fails identically — same root cause.
 *
 * On GREEN (Kevin's PR 1): App.tsx widens
 * `readProgressHintsForTrack` to ship `lifetimeFirstEncounters` for
 * math too (or at minimum when `focusNode === 'sub-to-10'`).
 * `FIRST_ENCOUNTER_GATED_NODES` in `api/_firstEncounterGate.ts` adds
 * `'sub-to-10'`. Both assertions pass.
 *
 * Out of scope
 * ------------
 * - The actual read-line text variant ("take away" vs "minus") — the
 *   server-side gate is unit-tested in `_firstEncounterGate.test.ts`;
 *   the audio realisation is ear-tested by Thomas on the Vercel
 *   preview.
 * - Append-on-session-end of `'sub-to-10'` into the list — covered by
 *   `recordProgressOnSessionEnd` unit tests + the progression-mastery
 *   loop spec.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { canonicalMathSessionResponse } from './fixtures/canonicalSessionResponses'
import {
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

// NOTE on `forceHowlerUnlock`
// ---------------------------
// We deliberately do NOT call `forceHowlerUnlock(page)` in this spec.
// Per `.claude/docs/testing-and-ci.md` §4.1.2 + the empirical finding
// from PR #242, the helper is incompatible with canned plans — it
// causes a silent fallback to the static rotation plan. This spec
// asserts only on the math request body (no chip interaction, no
// rendered canon content assertion), so the audio path is irrelevant
// to correctness; we drop the call to remove the coupling.

// ── WebKit-headless skip ─────────────────────────────────────────────────────
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → canned plan cannot decode; spec is chromium-only.',
  )
}

// ── Local mock with request capture ─────────────────────────────────────────

async function installMathMock(page: Page): Promise<{ requests: Request[] }> {
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
        message: `sub-to-10 first-encounter spec is math-only; saw track=${String(track)}`,
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

// ── Seed builder ────────────────────────────────────────────────────────────

function buildSubToTenProgress(
  lifetimeFirstEncounters: ReadonlyArray<string>,
): unknown {
  return {
    schemaVersion: 1,
    profile: { childName: 'Marian', character: 'melody', lastPlayedISO: null },
    skillLevels: {
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'practicing',
      'sub-to-20': 'intro',
      // Wave 5 (ticket 86c9y0bvc) sibling-tier split.
      'two-digit-addsub-no-regroup': 'locked',
      'two-digit-addsub-with-regroup': 'locked',
      'skip-counting': 'locked',
      'mult-2-5-10': 'intro',
      'mult-3-4': 'locked',
      'mult-6-9': 'locked',
      'letter-names': 'mastered',
      'letter-sounds': 'practicing',
      'blending-cv': 'practicing',
      'cvc-words': 'intro',
      'cvc-words-short-o': 'locked',
      'cvc-words-short-u': 'locked',
      'cvc-words-short-i': 'locked',
      'cvc-words-short-e': 'locked',
      'digraphs-sh': 'locked',
      'digraphs-ch': 'locked',
      'digraphs-th-voiceless': 'locked',
      'sight-words': 'intro',
      'simple-sentences': 'locked',
    },
    mathFactsLeitner: { items: [] },
    history: [],
    parentSettings: {
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: { percent: 0.95, sessions: 3 },
      crossDayEnforcement: true,
      showLevelToMarian: false,
    },
    lifetimeFirstEncounters: [...lifetimeFirstEncounters],
  }
}

// ── Spec ────────────────────────────────────────────────────────────────────

test.describe('sub-to-10 first-encounter scaffolding gate', () => {
  test('greenfield Marian (lifetimeFirstEncounters empty) → math request ships lifetimeFirstEncounters as an array NOT containing `sub-to-10`', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    const { requests } = await installMathMock(page)
    await seedLocalStorage(page, {
      progress: buildSubToTenProgress([]),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    await expect
      .poll(() => mathRequests(requests).length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1)

    const mathReqs = mathRequests(requests)
    expect(mathReqs).toHaveLength(1)

    const body = JSON.parse(mathReqs[0]!.postData() ?? '{}') as Record<
      string,
      unknown
    >
    const payload = body.payload as Record<string, unknown>
    expect(payload.track).toBe('math')

    const progressBlock = payload.progress as Record<string, unknown>
    expect(progressBlock, 'progress block must be present').toBeDefined()
    expect(progressBlock.focusNode).toBe('sub-to-10')

    // Failing-first lever — on RED, `readProgressHintsForTrack` ships
    // `lifetimeFirstEncounters` only for word-song. On GREEN, math
    // ships it as an array (post-Kevin's PR 1).
    const lfe = progressBlock.lifetimeFirstEncounters
    expect(
      Array.isArray(lfe),
      'math payload must ship lifetimeFirstEncounters as an array',
    ).toBe(true)
    const lfeArr = lfe as ReadonlyArray<string>
    // Greenfield signal — `'sub-to-10'` NOT in the list; the server
    // gate will fire scaffolding.
    const subToTenCount = lfeArr.filter((s) => s === 'sub-to-10').length
    expect(subToTenCount).toBe(0)
  })

  test('already-encountered Marian (lifetimeFirstEncounters contains sub-to-10) → math request ships the list with sub-to-10 present', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    const { requests } = await installMathMock(page)
    await seedLocalStorage(page, {
      // Seed pre-populated — child has done one prior sub-to-10
      // session and the gate already fired.
      progress: buildSubToTenProgress(['sub-to-10']),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    await expect
      .poll(() => mathRequests(requests).length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1)

    const mathReqs = mathRequests(requests)
    expect(mathReqs).toHaveLength(1)

    const body = JSON.parse(mathReqs[0]!.postData() ?? '{}') as Record<
      string,
      unknown
    >
    const payload = body.payload as Record<string, unknown>
    const progressBlock = payload.progress as Record<string, unknown>
    expect(progressBlock).toBeDefined()

    const lfe = progressBlock.lifetimeFirstEncounters
    expect(Array.isArray(lfe)).toBe(true)
    const lfeArr = lfe as ReadonlyArray<string>
    // Already-encountered signal — list MUST contain `sub-to-10` so
    // the server gate suppresses scaffolding.
    const subToTenCount = lfeArr.filter((s) => s === 'sub-to-10').length
    expect(subToTenCount).toBe(1)
  })
})
