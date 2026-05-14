/**
 * E2E spec — slow-fact directive injection on the /api/claude payload
 * (M4.x, follow-up to PR #164's Leitner wiring).
 *
 * Coverage gap
 * ------------
 * The new `buildSlowFactSessionHint(progress)` (in
 * `src/lib/progress/slowFacts.ts`) ships with vitest unit coverage on
 * the threshold predicate, sentinel handling, sorting, and capping.
 * The server-side directive composition in `api/_planner.ts` ships
 * with vitest coverage on the user-message bullet-line shape. This
 * spec fills the FULL-STACK gap: a seeded `progress.history` that
 * triggers the predicate produces a request body whose
 * `payload.progress.slowFacts` carries the right shape on the wire.
 *
 * Mock strategy mirrors `leitner-directive-injection.spec.ts` — local
 * route handler with request capture, returning the canonical math
 * fixture so the screen flow stays alive enough to render.
 *
 * Why count-based assertions
 * --------------------------
 * Per `feedback_count_assertions_on_regression_tests.md`: regression
 * specs use `.toEqual([item])` / `.toHaveLength(N)` / `.toEqual({...})`,
 * never `.toContain`. A bug that adds a stray fact alongside the legit
 * one would slip past `.toContain`.
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

// ── Local mock with request capture ──────────────────────────────────────

/**
 * Install a /api/claude mock that:
 *   - Routes math requests to `canonicalMathSessionResponse()` (shared
 *     fixture; keeps the screen flow alive).
 *   - Captures every observed request body so the spec can assert on
 *     `payload.progress.slowFacts` shape post-mortem.
 *
 * Word-song / unknown tracks are intentionally rejected with 500 — the
 * spec is math-only and a stray non-math request would mean an
 * upstream invariant is wrong.
 */
async function installSlowFactMathMock(
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
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'unexpected-track',
        message: `slow-fact-directive spec is math-only; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

// ── Seed builders ────────────────────────────────────────────────────────

/**
 * Build a Progress blob that triggers the slow-fact directive on
 * `add-to-10`: 6 attempts of `4+2`, all correct, all in the
 * 5500-6300ms window. Median latency = 5950ms, attempts = 6,
 * correctRate = 1.0 (all sessions had successRate 1).
 *
 * Marian's diagnostic baseline puts her on `add-to-10` as the
 * `practicing` focus node — `pickFocusNode` walks the in-order math
 * tree, stops at the first non-mastered node, which under this
 * baseline is `add-to-10`.
 */
function buildSlowFactSeededProgress(): unknown {
  // 6 sessions × 1 attempt of 4+2 each. successRate = 1 every time
  // → correctRate approximation = 1. Latency median over 6 entries
  // sorted: [5500, 5700, 5800, 5900, 6100, 6300] → mean(5800, 5900)
  // = 5850ms. Above the 5000ms floor, so the predicate fires.
  const fact = { a: 4, b: 2, op: '+' as const }
  const baseDateMs = Date.parse('2026-05-01T10:00:00.000Z')
  const dayMs = 24 * 60 * 60 * 1000
  const latencies = [5500, 5700, 5800, 5900, 6100, 6300]

  const history = latencies.map((ms, i) => ({
    dateISO: new Date(baseDateMs + i * dayMs).toISOString(),
    skillFocus: ['add-to-10'],
    successRate: 1,
    latencyMs: [ms],
    mathFacts: [{ a: fact.a, b: fact.b, op: fact.op }],
  }))

  return {
    schemaVersion: 1,
    profile: {
      childName: 'Marian',
      character: 'melody',
      lastPlayedISO: history[history.length - 1]!.dateISO,
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
      'cvc-words-short-u': 'locked',
      'cvc-words-short-i': 'locked',
      'cvc-words-short-e': 'locked',
      // Digraphs split into 3 sequential sibling nodes per PR #211.
      'digraphs-sh': 'locked',
      'digraphs-ch': 'locked',
      'digraphs-th-voiceless': 'locked',
      'sight-words': 'intro',
      'simple-sentences': 'locked',
    },
    mathFactsLeitner: { items: [] },
    history,
    parentSettings: {
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: { percent: 0.95, sessions: 3 },
      crossDayEnforcement: true,
      showLevelToMarian: false,
    },
  }
}

/** Filter captured requests to math session-starts only. */
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

test.describe('Slow-fact directive injection on /api/claude payload', () => {
  test.beforeEach(async ({ page }) => {
    // Pin iPad-portrait viewport per `testing-and-ci.md` § 4.0.
    await page.setViewportSize({
      width: IPAD_PORTRAIT_VIEWPORT.width,
      height: IPAD_PORTRAIT_VIEWPORT.height,
    })
  })

  test('seeded slow-fact history → payload.progress.slowFacts ships with the right shape', async ({
    page,
  }) => {
    const { requests } = await installSlowFactMathMock(page)
    await seedLocalStorage(page, {
      progress: buildSlowFactSeededProgress(),
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
    const progressBlock = payload.progress as Record<string, unknown>
    expect(progressBlock, 'progress block should be present').toBeDefined()

    const slowFacts = progressBlock.slowFacts as ReadonlyArray<{
      fact: { a: number; b: number; op: string }
      attempts: number
      correctRate: number
      medianLatencyMs: number
    }>
    expect(slowFacts, 'progress.slowFacts must be present').toBeDefined()
    expect(slowFacts).toHaveLength(1)

    // Shape-exact assertion. Latency median over [5500, 5700, 5800,
    // 5900, 6100, 6300] (sorted) = (5800 + 5900) / 2 = 5850ms.
    expect(slowFacts[0]).toEqual({
      fact: { a: 4, b: 2, op: '+' },
      attempts: 6,
      correctRate: 1,
      medianLatencyMs: 5850,
    })
  })

  test('greenfield Marian (no qualifying history) → payload.progress.slowFacts is OMITTED entirely', async ({
    page,
  }) => {
    // Seed an empty history. The predicate finds nothing →
    // `buildSlowFactSessionHint` returns []. App.tsx maps `[]` to
    // `undefined` so the wire field is absent. This pins the
    // canon-served-free-path posture: a fresh first-launch Marian
    // doesn't pay an Anthropic call just because the field exists.
    const { requests } = await installSlowFactMathMock(page)
    // Use buildSeedProgress shape — empty history, no mathFacts.
    await seedLocalStorage(page, {
      progress: {
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
          'cvc-words-short-u': 'locked',
          'cvc-words-short-i': 'locked',
          'cvc-words-short-e': 'locked',
          // Digraphs split into 3 sequential sibling nodes per PR #211.
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
      },
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
    const progressBlock = payload.progress as
      | Record<string, unknown>
      | undefined

    if (progressBlock !== undefined) {
      const has = Object.prototype.hasOwnProperty.call(
        progressBlock,
        'slowFacts',
      )
      expect(
        has,
        'greenfield Marian must omit progress.slowFacts; saw it as a present property',
      ).toBe(false)
    }
    // If progressBlock IS undefined, the assertion is satisfied trivially.
  })
})
