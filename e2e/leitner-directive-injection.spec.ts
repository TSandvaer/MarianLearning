/**
 * E2E spec — Leitner directive injection on the /api/claude payload.
 *
 * Coverage gap (post PR #164 — M4 Leitner session-gen wiring)
 * -----------------------------------------------------------
 * PR #164 wired `mathFactsLeitner` → `buildLeitnerSessionHint(...)` →
 * the `progress.leitner` block on the session-start payload. The PR
 * landed with vitest unit coverage on `buildLeitnerSessionHint` (pure
 * flatten + sort) and on the server-side `parseLeitnerHint` validator,
 * but no full-stack assertion that the directive *actually fires* in
 * the browser → wire path. This spec fills that gap. Specifically:
 *
 *   1. A seeded `mathFactsLeitner` with N facts → planner request body
 *      carries `payload.progress.leitner` with N entries.
 *   2. Box-1 facts and higher-box facts both ship; the wire shape
 *      preserves the per-fact `box` field so the planner directive can
 *      group correctly. (Mastered facts are NOT silently dropped.)
 *   3. The wire's `{ a, b, op, box }` quadruple round-trips the seeded
 *      facts unchanged — no operand swap (3+4 vs 4+3 is a different
 *      fact), no operator drop, no box drift.
 *   4. An empty `mathFactsLeitner` → the wire field is OMITTED entirely
 *      (not `[]`, not `null`). This is the "free canon path" gate from
 *      PR #164's posture: empty Leitner → canon-served first sessions
 *      stay zero-cost.
 *   5. iPad-portrait viewport is the load-bearing surface — same
 *      pattern PR #168 established for layout-fit specs (per
 *      `feedback_jessica_first_for_objective_gates.md` and
 *      `testing-and-ci.md` § 4.0).
 *
 * Mock strategy
 * -------------
 * `installClaudeMock`-style is not enough — the shared helper doesn't
 * expose request capture. We need to read the POST body to assert on
 * `payload.progress.leitner`. So this spec installs a local route
 * handler that mirrors the canonical math response from
 * `canonicalSessionResponses.ts` AND captures every request for
 * post-mortem inspection.
 *
 * The mock returns the shared `canonicalMathSessionResponse()` for
 * track === 'math', so the App's downstream wiring (chip render,
 * read-aloud, advance) keeps working. A failed math request would
 * route the screen into the silent-caption-walk fallback — which is
 * fine for assertion purposes here (we only assert on the request
 * body), but reusing the canonical response keeps the harness shape
 * close to other specs and reduces incidental skew.
 *
 * Why count-based assertions
 * --------------------------
 * Per `feedback_count_assertions_on_regression_tests.md`: regression
 * specs use `.toEqual([item])` / `.toHaveLength(N)` / `.toEqual({...})`,
 * never `.toContain`. A `.toContain('add-to-10')` on an arrayful body
 * would pass even if a regression *added* a stray fact alongside the
 * legit ones. Every assertion below is shape-exact.
 *
 * Why iPad-portrait viewport even on a request-shape spec
 * -------------------------------------------------------
 * The wire-shape contract is the load-bearing assertion. The viewport
 * pin is per the project default (helper-imported per
 * `testing-and-ci.md` § 4.0) so any future regression that incidentally
 * narrows the viewport doesn't subtly mask a different bug. iPad-
 * portrait is also Marian's actual rendering surface; sticking to it
 * keeps the harness shape consistent with `add-to-20-flower-row-fit`.
 */

import { test, expect } from '@playwright/test'
import type { Request } from '@playwright/test'
import { canonicalMathSessionResponse } from './fixtures/canonicalSessionResponses'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'
import { IPAD_PORTRAIT_VIEWPORT } from './_helpers/iPadViewport'
import {
  buildMathFactsLeitner,
  expectedWireFacts,
  MIXED_BOX_FIXTURE,
  ALL_MASTERED_FIXTURE,
  type LeitnerFactSpec,
} from './_helpers/leitnerFixtures'

// ── Local mock with request capture ──────────────────────────────────────

/**
 * Install a /api/claude mock that:
 *   - Routes math requests to `canonicalMathSessionResponse()` (shared
 *     fixture; keeps the screen flow alive enough to render).
 *   - Captures every observed request body so the spec can assert on
 *     `payload.progress.leitner` shape post-mortem.
 *
 * Word-song / unknown tracks are intentionally rejected with 500 — this
 * spec is math-only; a stray non-math request would mean an invariant
 * is wrong upstream and we'd rather see a loud failure than a quiet
 * pass.
 */
async function installLeitnerMathMock(
  page: import('@playwright/test').Page,
): Promise<{ requests: Request[] }> {
  const requests: Request[] = []
  await page.route('**/api/claude', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
        body: '',
      })
      return
    }
    if (request.method() !== 'POST') {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'method-not-allowed' }),
      })
      return
    }

    requests.push(request)

    let body: Record<string, unknown>
    try {
      body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    } catch {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'invalid-json' }),
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
    // word-song or anything else: surface the spec invariant violation.
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'unexpected-track',
        message: `leitner-directive spec is math-only; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

// ── Seed builder — Progress with seeded mathFactsLeitner ─────────────────

/**
 * Build a Progress blob with a Leitner box pre-populated. Mirrors
 * `buildSeedProgress()` in seedStorage.ts but allows overriding the
 * `mathFactsLeitner` field (which the shared helper hardcodes to an
 * empty box).
 *
 * Skill-level baseline puts Marian on `add-to-10` as the active focus
 * node — `pickFocusNode` walks the in-order math tree and stops at the
 * first non-mastered node, which under the diagnostic baseline is
 * `add-to-10` (`practicing`). This is also the only focus node where
 * the Leitner directive fires today (per PR #164 active scope).
 */
function buildLeitnerSeededProgress(
  facts: ReadonlyArray<LeitnerFactSpec>,
): unknown {
  return {
    schemaVersion: 1,
    profile: {
      childName: 'Marian',
      character: 'melody',
      lastPlayedISO: null,
    },
    skillLevels: {
      'number-recog': 'mastered',
      'add-to-10': 'practicing',
      'add-to-20': 'locked',
      'sub-to-10': 'mastered',
      'sub-to-20': 'intro',
      'two-digit-addsub': 'locked',
      'skip-counting': 'locked',
      'mult-2-5-10': 'intro',
      'mult-3-4': 'locked',
      'mult-6-9': 'locked',
      'letter-names': 'mastered',
      'letter-sounds': 'practicing',
      'blending-cv': 'practicing',
      'cvc-words': 'intro',
      'cvc-words-short-o': 'locked',
      digraphs: 'locked',
      'sight-words': 'intro',
      'simple-sentences': 'locked',
    },
    mathFactsLeitner: buildMathFactsLeitner(facts),
    history: [],
    parentSettings: {
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: { percent: 0.95, sessions: 3 },
      crossDayEnforcement: true,
      showLevelToMarian: false,
    },
  }
}

/**
 * Read `payload.progress.leitner` from a captured math request body.
 * Returns `undefined` when the field is missing OR the request body is
 * malformed — the caller asserts on the returned value's presence.
 */
function readLeitnerFromRequest(request: Request): unknown {
  const raw = request.postData() ?? '{}'
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return undefined
  }
  const payload = body.payload as Record<string, unknown> | undefined
  if (!payload) return undefined
  const progressBlock = payload.progress as Record<string, unknown> | undefined
  if (!progressBlock) return undefined
  return progressBlock.leitner
}

/** Filter captured requests to math session-starts only — Hub mounts
 *  may fan out a word-song pre-warm (per PR #162) which a stray
 *  request count would silently double. Per `testing-and-ci.md` §
 *  4.2.1: count assertions must filter by track. */
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

// ── Spec ─────────────────────────────────────────────────────────────────

test.describe('Leitner directive injection on /api/claude payload', () => {
  test.beforeEach(async ({ page }) => {
    // Pin the iPad-portrait viewport per `testing-and-ci.md` § 4.0.
    // The Playwright project config already pins it; setting it
    // explicitly at the spec layer keeps the assertion site self-
    // describing and survives any future per-project viewport change.
    await page.setViewportSize({
      width: IPAD_PORTRAIT_VIEWPORT.width,
      height: IPAD_PORTRAIT_VIEWPORT.height,
    })
  })

  test('1. mathFactsLeitner with mixed boxes → payload.progress.leitner ships sorted box-ascending with the exact fact set', async ({
    page,
  }) => {
    const { requests } = await installLeitnerMathMock(page)
    await seedLocalStorage(page, {
      progress: buildLeitnerSeededProgress(MIXED_BOX_FIXTURE),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    // Splash → Hub → Number Garden → Math triggers a math session-start
    // POST. The kick-effect for math fires on `route === 'greet' ||
    // route === 'math'` (per `architecture-overview.md` audio
    // pre-warm); for a returning user, the chain Splash → Hub fires
    // word-song's pre-warm on Hub mount (mathFactsLeitner is shipped
    // only on math requests) and the math fetch fires on the route
    // flip into 'math'.
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Wait for at least one math request to land.
    await expect
      .poll(() => mathRequests(requests).length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1)

    const mathReqs = mathRequests(requests)
    expect(mathReqs).toHaveLength(1)

    const leitner = readLeitnerFromRequest(mathReqs[0]!)
    expect(leitner, 'payload.progress.leitner must be present').toEqual(
      expect.any(Array),
    )

    // Shape-exact: the seeded fixture flattened and sorted box-
    // ascending. `expectedWireFacts` is a deterministic stable sort,
    // mirroring `buildLeitnerSessionHint`'s contract.
    expect(leitner).toEqual(expectedWireFacts(MIXED_BOX_FIXTURE))

    // Count: `MIXED_BOX_FIXTURE` is 8 facts spanning boxes 1, 2, 3, 5.
    expect((leitner as unknown[]).length).toBe(MIXED_BOX_FIXTURE.length)
  })

  test('2. all-mastered fixture (every fact at box 5) still ships the directive — mastered facts are NOT dropped', async ({
    page,
  }) => {
    const { requests } = await installLeitnerMathMock(page)
    await seedLocalStorage(page, {
      progress: buildLeitnerSeededProgress(ALL_MASTERED_FIXTURE),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

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

    const leitner = readLeitnerFromRequest(mathReqs[0]!)
    expect(leitner).toEqual(expectedWireFacts(ALL_MASTERED_FIXTURE))

    // Every entry has box === 5. Confirm directly so a future bug that
    // silently demotes high-box facts to box 1 (e.g. a forgotten clamp)
    // surfaces here with a count rather than a `.toContain` smell.
    const arr = leitner as ReadonlyArray<{ box: number }>
    const boxFiveCount = arr.filter((f) => f.box === 5).length
    expect(boxFiveCount).toBe(ALL_MASTERED_FIXTURE.length)
  })

  test('3. wire shape preserves operand order and operator — 3+4 ships as {a:3,b:4,op:"+"}, not {a:4,b:3} or with op dropped', async ({
    page,
  }) => {
    // Distinct fixture with intentionally non-commutative-shape facts:
    // 3+4 and 4+3 are the SAME math result but DIFFERENT facts in the
    // Leitner box (the box keys on the literal `{a,b,op}` triple). A
    // bug that normalises to "smaller addend first" before serialising
    // would silently merge them; this spec catches that class.
    const ORDER_SENSITIVE_FIXTURE: ReadonlyArray<LeitnerFactSpec> = [
      { a: 3, b: 4, op: '+', box: 1 },
      { a: 4, b: 3, op: '+', box: 2 },
      { a: 7, b: 2, op: '+', box: 1 },
      { a: 2, b: 7, op: '+', box: 3 },
    ]
    const { requests } = await installLeitnerMathMock(page)
    await seedLocalStorage(page, {
      progress: buildLeitnerSeededProgress(ORDER_SENSITIVE_FIXTURE),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

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

    const leitner = readLeitnerFromRequest(mathReqs[0]!)

    // Exact-shape: each `{a,b,op,box}` quadruple matches the seeded
    // fixture. Sorted box-ascending; within a box level the input
    // order is preserved (Array.sort is stable in ES2019+).
    expect(leitner).toEqual(expectedWireFacts(ORDER_SENSITIVE_FIXTURE))

    // Spot-check: 3+4 is a separate fact from 4+3. Both ship.
    const arr = leitner as ReadonlyArray<{ a: number; b: number; op: string }>
    const threePlusFour = arr.filter(
      (f) => f.a === 3 && f.b === 4 && f.op === '+',
    )
    expect(threePlusFour).toHaveLength(1)
    const fourPlusThree = arr.filter(
      (f) => f.a === 4 && f.b === 3 && f.op === '+',
    )
    expect(fourPlusThree).toHaveLength(1)
    // Total count assertion catches any silent merge / dedupe.
    expect(arr).toHaveLength(ORDER_SENSITIVE_FIXTURE.length)
  })

  test('4. empty mathFactsLeitner → payload.progress.leitner is OMITTED entirely (empty-array gate, canon-served free path)', async ({
    page,
  }) => {
    // Empty box. The browser-side gate in `readProgressHintsForTrack`
    // is: `if (hint.length > 0) leitner = hint;` else leitner stays
    // undefined and the wire field is omitted by JSON.stringify. This
    // test pins that gate; a regression that ships `leitner: []`
    // would defeat the canon-served-first-session free path (PR
    // #164's posture: any non-empty / non-undefined leitner bypasses
    // canon).
    const { requests } = await installLeitnerMathMock(page)
    await seedLocalStorage(page, {
      progress: buildLeitnerSeededProgress([]),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

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

    // Read the raw progress block and inspect property presence —
    // `undefined` round-trips through JSON.stringify as omission, but
    // `null` and `[]` are both observable values. We must distinguish
    // "field absent" from "field present but empty".
    const raw = mathReqs[0]!.postData() ?? '{}'
    const body = JSON.parse(raw) as Record<string, unknown>
    const payload = body.payload as Record<string, unknown>
    const progressBlock = payload.progress as
      | Record<string, unknown>
      | undefined

    // The progress block itself ships when ANY hint is present —
    // focusNode at minimum (because seeded skillLevels put us on
    // add-to-10). We assert progress is present but `leitner` is
    // NOT one of its own properties.
    expect(progressBlock, 'progress block should be present').toBeDefined()
    const has = Object.prototype.hasOwnProperty.call(progressBlock!, 'leitner')
    expect(has, 'progress.leitner must be omitted on empty Leitner').toBe(false)
  })

  test('5. no persisted progress at all (first-launch / private-mode) → payload.progress.leitner is OMITTED', async ({
    page,
  }) => {
    // The "first-ever launch" path: no progress blob at all. Per
    // `readProgressHintsForTrack`, when `loadProgress() === null`, every
    // hint is `undefined` — which JSON.stringify drops. The wire field
    // is absent.
    //
    // Why a separate test from #4: #4 seeds an explicit empty
    // mathFactsLeitner; this one seeds NO progress blob. Both should
    // produce an absent `leitner` field, but the code paths are
    // distinct (early-return vs the empty-array gate). Both must be
    // pinned because either change could ship a stray empty array
    // independently.
    const { requests } = await installLeitnerMathMock(page)
    // Skip-Greet via session-history seed only. No progress seed →
    // App reads `loadProgress() === null` and falls back to defaults
    // for Hub display, but the wire payload's progress block is gated
    // by the same null-check.
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

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

    const raw = mathReqs[0]!.postData() ?? '{}'
    const body = JSON.parse(raw) as Record<string, unknown>
    const payload = body.payload as Record<string, unknown>

    // The progress block itself may or may not ship — `prepareMathPathA`
    // only attaches it when at least one hint is non-undefined. With
    // `loadProgress() === null`, focusNode/recentSuccessRate/
    // isGraduationSession/leitner are ALL undefined; the wire either
    // omits the whole `progress` block OR ships an empty object.
    // Either way, `leitner` must be absent. Assert directly: if
    // `progress` is missing or `progress.leitner` is missing, both
    // satisfy the invariant; the only failure shape is `progress.leitner`
    // being a present array (empty or otherwise) — which would mean a
    // regression has shipped a `[]` placeholder.
    const progressBlock = payload.progress as
      | Record<string, unknown>
      | undefined
    if (progressBlock !== undefined) {
      const has = Object.prototype.hasOwnProperty.call(progressBlock, 'leitner')
      expect(
        has,
        'first-launch must omit progress.leitner; saw it as a present property',
      ).toBe(false)
    }
    // If progressBlock IS undefined, the assertion is satisfied
    // trivially — nothing further to check.
  })
})
