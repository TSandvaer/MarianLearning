/**
 * E2E spec — `sub-to-10` slow-fact threshold + 5-session warmup
 * (Thomas decision #3 — flat 6000ms + 5-session warmup for `op === '-'`).
 *
 * Paired with Kevin's PR 1 (`feat/sub-to-10-content`).
 *
 * What the spec asserts
 * ---------------------
 * 1. **Warmup branch.** Seed Marian with 4 prior sub-to-10 sessions
 *    that include a slow fact (`8 - 3 = 5`, median latency 6500ms,
 *    100% correct over 6 attempts). The 5-session warmup is NOT yet
 *    met. The math request payload for the 5th sub-to-10 session
 *    must OMIT `progress.slowFacts` entirely.
 *
 * 2. **Post-warmup branch.** Same shape, but seed sessionCount 6
 *    (warmup met). The math request payload MUST include
 *    `progress.slowFacts` with the expected shape (one item carrying
 *    the slow fact).
 *
 * 3. **Parity counter-test.** Seed an `add-to-10` history with a
 *    single slow `+` fact (sessionCount 1, median latency 5500ms,
 *    100% correct over 6 attempts). On the next session, the math
 *    request payload MUST include `progress.slowFacts`. The
 *    add-to-10 threshold (5000ms) and warmup (none) are unchanged by
 *    Kevin's PR 1; this guards against accidentally tightening
 *    add-to-10's gate.
 *
 * Failing-first contract
 * ----------------------
 * On RED `main` (commit `ea9e53a`):
 *   - `slowFacts.ts:isAddToTenEntry` filters to entries whose
 *     `skillFocus === ['add-to-10']` ONLY (lines 215-218). Sub-to-10
 *     history entries are filtered out — `buildSlowFactSessionHint`
 *     returns `[]` for any sub-to-10 input regardless of attempts /
 *     latency / session count.
 *   - The math focus node on RED with the seed shape below is
 *     `sub-to-10` (per `MATH_NODES_IN_ORDER`).
 *   - Assertion 1 (warmup): PASSES on RED because `slowFacts === []`
 *     → App.tsx omits the field → no `progress.slowFacts`. **The
 *     test passes for the WRONG reason on RED.** Acceptable trade-off:
 *     it pins the contract and turns green for the RIGHT reason
 *     post-Kevin (warmup-gated empty list, not "feature missing").
 *   - Assertion 2 (post-warmup): **FAILS** on RED — same code path
 *     produces `[]`, field is omitted, assertion expects PRESENT.
 *     This is the load-bearing RED signal.
 *   - Assertion 3 (add-to-10 parity): PASSES on RED (the existing
 *     add-to-10 path is unchanged). Pins regression-safety on
 *     Kevin's threshold/warmup widening.
 *
 * On GREEN (Kevin's PR 1): `slowFacts.ts` widens to accept `op === '-'`
 * entries with an op-parameterized threshold (6000ms) and a
 * focus-node-tenure warmup (5 sub-to-10 sessions). The post-warmup
 * sub-to-10 case ships the field; the parity add-to-10 case is
 * unchanged.
 *
 * Out of scope
 * ------------
 * - The directive composition in `_planner.ts`'s user message
 *   (server-side; covered by Kevin's `_planner.test.ts` unit tests).
 * - The actual numeric median value when present (the canonical
 *   median computation is unit-tested in `slowFacts.test.ts`).
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { canonicalMathSessionResponse } from './fixtures/canonicalSessionResponses'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

// NOTE on `forceHowlerUnlock`
// ---------------------------
// We deliberately do NOT call `forceHowlerUnlock(page)` in this spec.
// Per `.claude/docs/testing-and-ci.md` §4.1.2 + the empirical finding
// from PR #242, the helper is incompatible with canned plans (even
// silent-MP3 placeholder bytes) — it causes a silent fallback to the
// static rotation plan. This spec asserts only on the math request
// body (no chip interaction, no rendered canon content assertion),
// so the audio path is irrelevant to correctness; we drop the call
// to remove the coupling. The request fires on Hub→Math navigation
// regardless of audio state.

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
        message: `sub-to-10 slow-fact spec is math-only; saw track=${String(track)}`,
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

// ── Seed builders ────────────────────────────────────────────────────────────

interface SlowFactHistoryConfig {
  /** Number of prior sub-to-10 (or add-to-10) sessions to seed. */
  sessionCount: number
  /** Focus node every history entry targeted. */
  focusNode: 'sub-to-10' | 'add-to-10'
  /** The math fact to mark as slow + correct. */
  fact: { a: number; b: number; op: '+' | '-' }
  /** Per-session median latency in ms. Will be split across 6 attempts. */
  latenciesMs: ReadonlyArray<number>
}

/**
 * Build a Progress doc with `sessionCount` history entries, each
 * recording 6 problems where `fact` was the per-problem target,
 * `successRate: 1`, and `latencyMs` filled across the supplied
 * latencies. The aggregator joins `mathFacts[i]` with `latencyMs[i]`
 * across all entries, so by spreading 6 latencies × `sessionCount`
 * sessions we get attempts == 6 × sessionCount.
 *
 * Per the spec's slow-fact predicate, we need attempts ≥ 5, correctRate
 * ≥ 0.8, medianLatencyMs ≥ threshold-for-op. Six attempts at 100%
 * correct + median 6500ms (sub) or 5500ms (add) is enough.
 */
function buildSlowFactProgress(config: SlowFactHistoryConfig): unknown {
  const baseDateMs = Date.parse('2026-05-01T10:00:00.000Z')
  const dayMs = 24 * 60 * 60 * 1000
  // Each session entry carries 6 per-problem rows of the SAME fact.
  // Using sub-to-10 entries — the aggregator on RED filters these out;
  // on GREEN it accepts them.
  //
  // Pre-86c9xaybc this function hand-built the full Progress shape to
  // get `latencyMs` + `mathFacts` onto each entry; the widened
  // `buildSeedProgress.history` now carries those fields natively.
  const history = Array.from({ length: config.sessionCount }, (_, i) => ({
    dateISO: new Date(baseDateMs + i * dayMs).toISOString(),
    skillFocus: [config.focusNode],
    successRate: 1,
    latencyMs: config.latenciesMs.slice(),
    mathFacts: config.latenciesMs.map(() => ({
      a: config.fact.a,
      b: config.fact.b,
      op: config.fact.op,
    })),
  }))

  // Skill-levels: when rehearsing sub-to-10 we need add-to-10 +
  // add-to-20 fully mastered so the focus-picker walks down to
  // sub-to-10. When rehearsing add-to-10 the default Marian baseline
  // (add-to-10: practicing) already lands the focus there, so no
  // override is needed.
  const isSub = config.focusNode === 'sub-to-10'
  const skillLevelOverrides: Record<string, string> = isSub
    ? {
        'add-to-10': 'mastered',
        'add-to-20': 'mastered',
        'sub-to-10': 'practicing',
      }
    : {}

  return buildSeedProgress({
    skillLevelOverrides,
    lastPlayedISO: history[history.length - 1]?.dateISO ?? null,
    history,
  })
}

// 6 latencies whose median = 6500ms (for sub-to-10 — over 6000ms threshold).
const SLOW_SUB_LATENCIES = [6200, 6300, 6400, 6600, 6700, 6800] as const

// 6 latencies whose median = 5500ms (for add-to-10 — over 5000ms threshold).
const SLOW_ADD_LATENCIES = [5200, 5300, 5400, 5600, 5700, 5800] as const

// ── Spec ────────────────────────────────────────────────────────────────────

test.describe('sub-to-10 slow-fact threshold + warmup', () => {
  test('warmup branch — 4 prior sub-to-10 sessions with slow fact → progress.slowFacts is OMITTED', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    const { requests } = await installMathMock(page)
    await seedLocalStorage(page, {
      progress: buildSlowFactProgress({
        sessionCount: 4,
        focusNode: 'sub-to-10',
        fact: { a: 8, b: 3, op: '-' },
        latenciesMs: SLOW_SUB_LATENCIES,
      }),
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

    // Pin the shape unconditionally — the math request MUST ship a
    // progress block (focusNode is always populated when a Progress
    // doc exists; the seed installs one). Per
    // feedback_count_assertions_on_regression_tests, the conditional
    // form admitted a false-green where a full slowFacts.ts
    // regression returning [] for everything would let the
    // outer `if` collapse to a no-op and the assertion never fire.
    const progressBlock = payload.progress as
      | Record<string, unknown>
      | undefined
    expect(
      progressBlock,
      'math payload must ship a progress block (focusNode is populated for seeded Progress)',
    ).toBeDefined()
    expect(
      Object.prototype.hasOwnProperty.call(progressBlock!, 'slowFacts'),
      'warmup branch (4 prior sessions) must OMIT progress.slowFacts; saw it as a present property',
    ).toBe(false)
  })

  test('post-warmup branch — 6 prior sub-to-10 sessions with slow fact → progress.slowFacts IS present', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    const { requests } = await installMathMock(page)
    await seedLocalStorage(page, {
      progress: buildSlowFactProgress({
        sessionCount: 6,
        focusNode: 'sub-to-10',
        fact: { a: 8, b: 3, op: '-' },
        latenciesMs: SLOW_SUB_LATENCIES,
      }),
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
    expect(progressBlock, 'progress block must be present').toBeDefined()

    const slowFacts = progressBlock.slowFacts as
      | ReadonlyArray<{
          fact: { a: number; b: number; op: string }
          attempts: number
          correctRate: number
          medianLatencyMs: number
        }>
      | undefined
    expect(
      slowFacts,
      'post-warmup branch must ship progress.slowFacts',
    ).toBeDefined()
    // Exactly one slow fact qualifies — the seeded `8 - 3 = 5`.
    expect(slowFacts).toHaveLength(1)
    expect(slowFacts![0]!.fact).toEqual({ a: 8, b: 3, op: '-' })
    expect(slowFacts![0]!.correctRate).toBe(1)
    expect(slowFacts![0]!.attempts).toBe(36)
    // medianLatencyMs is computed over the joined 36 attempts; the
    // sorted set is the SLOW_SUB_LATENCIES repeated 6× → median is
    // the mean of position 17/18 (0-indexed) which falls between
    // 6400 and 6600 → 6500.
    expect(slowFacts![0]!.medianLatencyMs).toBe(6500)
  })

  test('parity counter-test — add-to-10 with slow + fact, sessionCount 1 → progress.slowFacts IS present (threshold unchanged)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    const { requests } = await installMathMock(page)
    await seedLocalStorage(page, {
      progress: buildSlowFactProgress({
        sessionCount: 1,
        focusNode: 'add-to-10',
        fact: { a: 4, b: 2, op: '+' },
        latenciesMs: SLOW_ADD_LATENCIES,
      }),
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
    expect(progressBlock, 'progress block must be present').toBeDefined()

    const slowFacts = progressBlock.slowFacts as
      | ReadonlyArray<{
          fact: { a: number; b: number; op: string }
          attempts: number
          correctRate: number
          medianLatencyMs: number
        }>
      | undefined
    expect(
      slowFacts,
      'add-to-10 baseline path must continue to ship progress.slowFacts (no warmup gate for `+`)',
    ).toBeDefined()
    expect(slowFacts).toHaveLength(1)
    expect(slowFacts![0]!.fact).toEqual({ a: 4, b: 2, op: '+' })
    expect(slowFacts![0]!.correctRate).toBe(1)
    expect(slowFacts![0]!.attempts).toBe(6)
    expect(slowFacts![0]!.medianLatencyMs).toBe(5500)
  })
})
