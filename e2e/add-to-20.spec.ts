/**
 * E2E spec — `add-to-20` content tier: pool envelope, doubles cap,
 * make-ten-bridge coverage, Class B reject (defense-in-depth).
 *
 * Ticket: 86c9uur0e (Jessica add-to-20 failing-first E2E).
 *
 * Paired implementation (already LANDED on `origin/main` at this PR's base):
 *   - Kyle's PR #276 — `add-to-20` content-tier spec (22-fact pool,
 *     §2 problem-mix rules with doubles cap, §3.4 Class B REJECT,
 *     §1.1 §1.2 addend ≤ 9 ban).
 *   - Dave's PR #277 — cross-10-bridge error research (rejected Class B
 *     "dropped-carry" trap as not documented for 7-9yo mental arithmetic).
 *   - Kevin's PR #278 — extend compositionLint to add-to-20 (lint infra
 *     only; binding deferred).
 *   - Kevin's PR #280 — rebake add-to-20 + activate
 *     lintAddToTwentyComposition binding; current canon at
 *     `public/canon/math/level-1/add-to-20.json` satisfies:
 *       P1=9+2=11  [EASY/make-ten-bridge]
 *       P2=8+3=11  [EASY/make-ten-bridge]
 *       P3=6+6=12  [EASY/doubles]
 *       P4=9+4=13  [MEDIUM/make-ten-bridge]
 *       P5=8+5=13  [MEDIUM/make-ten-bridge]
 *       P6=6+7=13  [MEDIUM/near-doubles]
 *       P7=7+8=15  [HARD/near-doubles]
 *       P8=9+8=17  [HARD/make-ten-bridge]
 *     Doubles count = 1 (≤ 2 cap satisfied), make-ten-bridge in P5-P8 =
 *     2 (≥ 1 high-leverage coverage rule satisfied), all addends ≤ 9,
 *     all sums ∈ [11, 17] (≤ 18 ceiling). Verified 2026-05-21 against
 *     `public/canon/math/level-1/add-to-20.json`.
 *
 * Spec authority: `design/math/add-to-20-content.md` §1.1 (22-fact
 * pool), §1.2 (addend range), §2.2 (category caps), §2.4 (high-leverage
 * coverage), §3.4 (Class B REJECT), §6.8 (test coverage), Acceptance
 * Criteria AC2 + AC9 + AC10.
 *
 * ────────────────────────────────────────────────────────────────────
 * Why this spec exists (defense-in-depth)
 * ────────────────────────────────────────────────────────────────────
 *
 * The add-to-20 lint infra (PR #278) + canon binding (PR #280) already
 * enforce these invariants at BAKE TIME — any future re-bake that
 * violates them will fail CI before merge. This E2E spec is a
 * defense-in-depth layer that catches:
 *
 *   1. Render-side regressions — the canon could be valid but Math.tsx
 *      could ship a chip-row regression (e.g. a future PR wires a
 *      Class B "dropped-carry" trap and emits `10` as a chip
 *      distractor on add-to-20 P4-P8, violating §3.4). The lint
 *      layer doesn't see this; the E2E layer does.
 *   2. Canon-binding regression — a future refactor of
 *      `resolveTierBinding` (compositionLint.ts) could silently
 *      detach add-to-20 from its lint rules, allowing a non-compliant
 *      re-bake to land. The E2E layer detects this via the doubles-
 *      cap + MTB-coverage assertions on the served canon.
 *   3. Parser-coupling regression — `planFromServer.ts` parses
 *      "X plus Y" reads and tags `op: '+'`. A regression that
 *      silently misparses teen-number reads (e.g. a "fourteen" →
 *      "fourTeen" tokenizer bug) would land Marian on the static
 *      fallback plan (add-to-10 rotation per
 *      `sessionPlans.ts:424-434`, which has no add-to-20-specific
 *      branch — `pickStaticSessionPlan` only special-cases
 *      `focusNode === 'add-to-20'` once it ROUTES there; if the
 *      parser fails on the served canon the screen falls into the
 *      static add-to-10 instead). The structural sum-range assertion
 *      catches this fall-through.
 *
 * ────────────────────────────────────────────────────────────────────
 * Acceptance criteria coverage (per Kyle's spec §6.8 + dispatch brief)
 * ────────────────────────────────────────────────────────────────────
 *
 * AC1 (pool envelope — sum ≤ 18 AND addend ≤ 9):
 *      Every problem in the 8-problem session has `addend-a ∈ [1, 9]`
 *      AND `addend-b ∈ [1, 9]` AND `sum ∈ [11, 18]`. Structural —
 *      derives from rendered DOM, not literal canon pin. Covered by
 *      Test 1.
 *
 * AC2 / AC10 (make-ten-bridge coverage — ≥ 1 in P5-P8):
 *      At least one of P5, P6, P7, P8 must carry an `(a, b)` pair
 *      from the make-ten-bridge subset of the §1.1 pool. Covered by
 *      Test 2.
 *
 * AC9 (doubles cap ≤ 2 across the session):
 *      Across the 8-problem session, AT MOST 2 problems may carry
 *      a doubles fact (i.e. `(a, b)` ∈ {(6,6), (7,7), (8,8), (9,9)}).
 *      Covered by Test 3.
 *
 * Class B REJECT (Kyle §3.4 + Dave §7.6 reject):
 *      No "dropped-carry" decade-anchor distractor (chip value `10`)
 *      should fire on add-to-20 P4-P8. The render uses Class 1
 *      off-by-one only; chip row at P4 with correct ∈ [12, 18]
 *      should be `[correct-1, correct, correct+1]` clamped. Covered
 *      by Test 4 — with a POSITIVE DISCRIMINATOR per
 *      `[[testing-and-ci.md §4.1.1e]]`: chip row must EQUAL the
 *      structural off-by-one set (not "10 is absent" which would be
 *      trivially-green if Class B never fires regardless).
 *
 * ────────────────────────────────────────────────────────────────────
 * Structural / fact-equivalence assertions (per testing-and-ci.md §6)
 * ────────────────────────────────────────────────────────────────────
 *
 * Per `[[testing-and-ci.md §6 "Canon-content-coupled E2E spec drift"]]`
 * — applied lessons from PR #266 where a literal canon-content pin
 * broke a sibling spec on a commutative-equivalent re-bake. THIS SPEC
 * AVOIDS LITERAL CANON-CONTENT PINS:
 *
 *   - Test 1 (pool envelope): does NOT assert "P1 is 9+2=11" literally.
 *     Instead reads whatever addends rendered and asserts each is in
 *     [1, 9] AND sum is in [11, 18]. Survives any §1.1-compliant
 *     re-bake.
 *   - Test 2 (MTB coverage): does NOT assert "P5 is 8+5". Instead
 *     reads each of P5-P8's addends, looks up the (a, b) ordered pair
 *     in `MAKE_TEN_BRIDGE_POOL` (a structural fact, derived from
 *     §1.1's CATEGORY annotations), and asserts COUNT ≥ 1.
 *   - Test 3 (doubles cap): does NOT pin a specific double or absence
 *     of a double. Walks all 8 problems, counts how many are doubles
 *     facts. Survives re-bakes that include 0, 1, or 2 doubles.
 *   - Test 4 (Class B reject): does NOT assert "10 is absent from chip
 *     row". Instead asserts chip row EQUALS the structural off-by-one
 *     set `{correct-1, correct, correct+1}` clamped to [1, 20]. This
 *     is the positive discriminator — if Class B (or any non-Class-1
 *     class) fires, the chip row diverges from the expected set and
 *     the assertion fails loudly.
 *
 * Per `[[testing-and-ci.md §6 "Prose-template-coupled E2E spec drift"]]`
 * — applied lesson from PR #279. THIS SPEC USES NO SUBSTRING ASSERTIONS
 * AGAINST READ-LINE TEMPLATES. Every assertion reads structural state
 * (addend digits, chip data-value, problem-index) via testids.
 *
 * ────────────────────────────────────────────────────────────────────
 * Mock strategy — single-canon (NOT focus-aware)
 * ────────────────────────────────────────────────────────────────────
 *
 * Per `[[testing-and-ci.md §4.2.3]]`: focus-aware multi-canon mock is
 * the FIRST instance of its pattern (PR #279 sub-to-20). This spec
 * does NOT exercise a cross-tier focus-switch (every test seeds
 * `add-to-20` focus exclusively; no in-test transition to a sibling
 * tier). A single-canon mock that serves add-to-20.json for any
 * `track === 'math'` request is sufficient and structurally simpler.
 *
 * The focus-aware pattern only earns helper-promotion at adopter #3
 * per the §4.2.3 rule; this spec being the SECOND adopter (if it
 * were to use focus-aware) wouldn't reach that bar. Single-canon
 * keeps the mock surface minimal.
 *
 * Per `[[testing-and-ci.md §4.1.2]]`:
 *   - `forceHowlerUnlock` is intentionally NOT called. Real Azure-
 *     rendered MP3 bytes decode cleanly under the genuine gesture-
 *     unlock chain in headless chromium.
 *   - `skipOnWebkitHeadless(testInfo)` is called per WebKit headless
 *     having no AudioContext — real iPad Safari is unaffected.
 *   - Canon-landed gate (`math-caption` non-empty text) is added
 *     before any chip-walk so assertions run against canon-served
 *     operands.
 *
 * ────────────────────────────────────────────────────────────────────
 * Failing-first verification trail (CLASSIFIED per
 * [[feedback_progression_e2e_mandatory]] rule 8)
 * ────────────────────────────────────────────────────────────────────
 *
 *   - Test 1 (pool envelope): **Regression-lock**. Current canon
 *     (post-#280) satisfies addend ≤ 9 and sum ≤ 18 at every problem.
 *     A pre-#276 main with the loose-bound directive at
 *     `_planner.ts:964` allowed `10 + n` facts ("ten-plus-single is
 *     pedagogically easier" was the rationale being corrected); a
 *     re-bake with the old directive would have produced facts like
 *     `10 + 5 = 15` violating addend ≤ 9. The assertion catches that
 *     class of regression at the render surface.
 *
 *   - Test 2 (MTB coverage): **RED-on-base lever** against pre-#280
 *     canon. Pre-#280 canon P5-P8 = `(7+8, 9+9, 8+9, 5+9)` — ZERO
 *     make-ten-bridge facts from §1.1's MTB-annotated list (7+8 is
 *     near-doubles per row #15; 9+9 is doubles per row #22; 8+9 is
 *     near-doubles per row #21; 5+9 is NOT in the v1 pool at all).
 *     Test 2 would have RED'd on pre-#280 with `mtbCount === 0 < 1`.
 *     Post-#280 canon P5=8+5 + P8=9+8 → mtbCount = 2 ≥ 1; assertion
 *     passes. The high-leverage coverage rule §2.4 is the
 *     pedagogical lever; this is the empirical proof it landed.
 *
 *   - Test 3 (doubles cap): **RED-on-base lever** against pre-#280
 *     canon. Pre-#280 canon was the original 2026-04 add-to-20 bake:
 *     `(6+6, 7+7, 6+7, 8+8, 7+8, 9+9, 8+9, 5+9)` — FOUR doubles
 *     (#6+6, #7+7, #8+8, #9+9). Test 3 would have RED'd on pre-#280
 *     with `doublesCount === 4 > 2`. Post-#280 canon contains 1
 *     double (P3=6+6); the assertion passes with headroom.
 *
 *   - Test 4 (Class B reject via positive discriminator):
 *     **Regression-lock**. No Class B "dropped-carry" implementation
 *     exists on main (Dave's PR #277 rejected it). The chip row at
 *     P4 for `9+4=13` is `[12, 13, 14]` (Class 1 off-by-one). If a
 *     future PR wires a Class B trap (`distractorClass: 'decade-
 *     anchor'` arm for op:'+' add-to-20), the chip row would
 *     become `[10, 13, 14]` (or similar) and the structural-set
 *     assertion fails loudly. This is the positive-discriminator
 *     pattern per §4.1.1e — NOT a "10 is absent" negative which
 *     would be trivially-green pre-implementation.
 *
 * Per `[[feedback_count_assertions_on_regression_tests]]`, all
 * assertions use `.toEqual([...])` / `.toBe(N)` / `.toBeLessThanOrEqual(N)`
 * / `.toBeGreaterThanOrEqual(N)` shapes. `.toContain` is avoided on
 * regression behaviour.
 *
 * ────────────────────────────────────────────────────────────────────
 * Browser engine support
 * ────────────────────────────────────────────────────────────────────
 *
 * Chromium-only. Real canon MP3 bytes need an AudioContext to decode
 * for the read-aloud effect's `audioReady` gate to flip true (which
 * gates chip enablement). WebKit headless has no AudioContext — chips
 * never enable. Real iPad Safari is unaffected. Each test calls
 * `skipOnWebkitHeadless(testInfo)`.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request, Route } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

// ── WebKit-headless skip ─────────────────────────────────────────────────
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud cannot fire ' +
      'against real canon MP3 bytes. Chromium coverage is sufficient ' +
      'for content-tier surface; real iPad Safari has working ' +
      'AudioContext post-gesture.',
  )
}

// ── §1.1 pool invariants — derived structural facts, not canon literals ──

/**
 * Per Kyle's spec §1.2: every fact in the 22-fact pool has
 * `addend ∈ [1, 9]` for both addends. The render-side check on
 * `math-addend-a` and `math-addend-b` testids must respect this.
 * Structural — survives any pool re-curation that keeps the
 * single-digit-addend constraint.
 */
const ADD_TO_20_ADDEND_MIN = 1
const ADD_TO_20_ADDEND_MAX = 9

/**
 * Per Kyle's spec §1.2 (Answer range): every result in the v1 pool
 * falls in `[11, 18]`. The directive permits `[11, 20]` as a forward-
 * compat ceiling but the v1 pool maxes at `9 + 9 = 18`. Asserting
 * `sum ≤ 18` is the right E2E gate — if a future re-bake permits
 * §7.1's Option B widening (`addend ≤ 10`, allowing `9+10=19` etc.),
 * this assertion catches the scope creep.
 */
const ADD_TO_20_SUM_MIN = 11
const ADD_TO_20_SUM_MAX = 18

/**
 * Per Kyle's spec §1.1 — the doubles category (4 pool facts) capped
 * at session-count ≤ 2 per §2.2. Encoded as ordered-pair tuples
 * matching the §1.1 table's row 6 (6+6), row 13 (7+7), row 19 (8+8),
 * row 22 (9+9).
 *
 * Encoding the SET as a tuple-array allows .filter-count semantics
 * for the cap assertion; avoids the .toContain false-positive class
 * per `[[feedback_count_assertions_on_regression_tests]]`.
 */
const DOUBLES_POOL: ReadonlyArray<readonly [number, number]> = [
  [6, 6],
  [7, 7],
  [8, 8],
  [9, 9],
] as const

/**
 * Per Kyle's spec §1.1 — the 13 make-ten-bridge facts. This is the
 * actual learning target of the tier (Dave § 1.2). The high-leverage
 * coverage rule (§2.4) requires ≥ 1 in P5-P8.
 *
 * Enumerated from §1.1 rows: #1, #2, #3, #4, #5, #7, #8, #9, #10,
 * #14, #17, #18, #20 (per §1.1 row-by-row sanity check at line 105).
 */
const MAKE_TEN_BRIDGE_POOL: ReadonlyArray<readonly [number, number]> = [
  [9, 2], // #1
  [2, 9], // #2
  [8, 3], // #3
  [3, 8], // #4
  [9, 3], // #5
  [9, 4], // #7
  [4, 9], // #8
  [8, 5], // #9
  [5, 8], // #10
  [9, 5], // #14
  [9, 6], // #17
  [9, 7], // #18
  [9, 8], // #20
] as const

function isInPool(
  pool: ReadonlyArray<readonly [number, number]>,
  a: number,
  b: number,
): boolean {
  return pool.some(([pa, pb]) => pa === a && pb === b)
}

// ── Canon-bytes mock ────────────────────────────────────────────────────

/**
 * Path to the add-to-20 session canon. Resolved from `process.cwd()`
 * because Playwright runs the harness from the worktree root (same
 * place `vite preview` reads `public/`). See `[[testing-and-ci.md
 * §4.1.3]]` "Canon-path resolution happens at module-load via
 * `process.cwd()`" for the established pattern from
 * `sub-to-10-distractor-class-2.spec.ts`.
 */
const ADD_TO_TWENTY_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/math/level-1/add-to-20.json',
)

function readMathCanon(path: string): string {
  if (!existsSync(path)) {
    throw new Error(
      `[add-to-20 spec] canon not found at ${path}. ` +
        `This canon is required for canon-bytes mock; do NOT swap to ` +
        `a silent-MP3 placeholder — per testing-and-ci.md §4.1.2 + ` +
        `§4.1.3 rule 3 the placeholder also fails decode under the ` +
        `stub-ctx, falls back to the static add-to-10 rotation, and ` +
        `silently masks the regression. See the file header.`,
    )
  }
  return readFileSync(path, 'utf-8')
}

/**
 * Install a `/api/claude` mock that serves the on-disk add-to-20
 * canon for `track === 'math'` requests. Modelled on
 * `installMathCanonClaudeMock` in
 * `e2e/sub-to-10-distractor-class-2.spec.ts`.
 *
 * Single-canon (not focus-aware) — per `[[testing-and-ci.md §4.2.3]]`
 * the focus-aware multi-canon pattern only earns helper-promotion at
 * adopter #3. This spec doesn't span a cross-tier focus-switch so
 * single-canon is the correct level of abstraction.
 *
 * Behaviour:
 *   - `track === 'math'` → serve `add-to-20.json` regardless of
 *     `focusNode`. Tests assert against the served canon's
 *     structural envelope; if a test seeded a non-add-to-20 focus,
 *     the assertion would fail loudly (correct behaviour).
 *   - `track === 'word-song'` → 500 loudly. App.tsx catches and
 *     falls through to silent caption-walk on Hub's pre-warm fetch —
 *     this is the same behaviour the production word-song path takes
 *     on any outage, and doesn't affect Hub → Math navigation.
 *   - `OPTIONS` preflight → 204.
 *
 * Returns `{ requests }` for tests that want to inspect captured
 * request bodies (Test 4 uses this as a positive discriminator per
 * `[[testing-and-ci.md §4.1.1e]]`).
 */
async function installAddToTwentyCanonClaudeMock(
  page: Page,
): Promise<{ requests: Request[] }> {
  const canonBody = readMathCanon(ADD_TO_TWENTY_CANON_PATH)
  const requests: Request[] = []
  await page.route('**/api/claude', async (route: Route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, body: '' })
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
        body: canonBody,
      })
      return
    }
    // word-song or unknown track — 500 loudly. App.tsx catches and
    // falls through to silent caption-walk; doesn't affect Hub→Math.
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'unexpected-track',
        message: `add-to-20 spec is math-only; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

// ── Seed builder ─────────────────────────────────────────────────────────

/**
 * Build a Progress doc with `add-to-20: 'practicing'` and every
 * upstream math node `'mastered'`. The default `pickFocusNode` then
 * lands on add-to-20 (the first non-mastered node in
 * `MATH_NODES_IN_ORDER`).
 *
 * `mastered` upstream is required because the picker walks the
 * order left-to-right and stops at the first non-mastered node;
 * any upstream node at `'practicing'` or `'intro'` would intercept
 * the focus.
 */
function buildAddToTwentySeedProgress(): unknown {
  return buildSeedProgress({
    skillLevelOverrides: {
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'practicing',
      'sub-to-10': 'locked',
      'sub-to-20': 'locked',
      // Wave 5 (ticket 86c9y0bvc) sibling-tier split.
      'two-digit-addsub-no-regroup': 'locked',
      'two-digit-addsub-with-regroup': 'locked',
      'skip-counting': 'locked',
      'mult-2-5-10': 'locked',
      'mult-3-4': 'locked',
      'mult-6-9': 'locked',
    },
  })
}

// ── Chip-walk gate helpers — DOM 0-based `data-problem-index` ───────────

/**
 * Read the addend-a + addend-b digit values from the currently-
 * rendered problem. Returns `[a, b]` as a tuple of numbers.
 *
 * Per `[[testing-and-ci.md §6 "Prose-template-coupled drift"]]`:
 * this reads structural state (digit text inside the addend testids),
 * NOT the read-line prose. Survives any directive re-templating.
 */
async function readCurrentAddends(page: Page): Promise<[number, number]> {
  const addendAText = await page.getByTestId('math-addend-a').textContent()
  const addendBText = await page.getByTestId('math-addend-b').textContent()
  const a = Number((addendAText ?? '').trim())
  const b = Number((addendBText ?? '').trim())
  return [a, b]
}

/**
 * Read all 3 chip values (data-value) at the current problem.
 */
async function readCurrentChipValues(page: Page): Promise<number[]> {
  const chips = page.locator('[data-testid="math-chip"]')
  await expect(chips).toHaveCount(3, { timeout: 15_000 })
  const handles = await chips.elementHandles()
  const values: number[] = []
  for (const h of handles) {
    const v = await h.getAttribute('data-value')
    if (v !== null) values.push(Number(v))
  }
  return values
}

/**
 * Tap the correct chip and wait for the DOM to advance to the next
 * problem-index. Uses `data-problem-index` (0-based) on
 * `[data-testid="math"]` per `[[testing-and-ci.md §4.1.3]]` rule 5.
 *
 * `currentZeroBased` is the 0-based index of the problem currently
 * rendered; this function advances to `currentZeroBased + 1`.
 */
async function tapCorrectAndAdvance(
  page: Page,
  currentZeroBased: number,
): Promise<void> {
  const correctChip = page.locator(
    '[data-testid="math-chip"][data-correct="true"]',
  )
  await expect(correctChip).toBeEnabled({ timeout: 15_000 })
  await correctChip.click()
  await expect(page.getByTestId('math')).toHaveAttribute(
    'data-problem-index',
    String(currentZeroBased + 1),
    { timeout: 15_000 },
  )
}

/**
 * Walk all 8 problems, capturing each problem's addends. Returns an
 * array of 8 `[a, b]` tuples in problem-index order.
 *
 * Used by Tests 1 + 3 which need session-wide data.
 */
async function walkAllProblemAddends(
  page: Page,
): Promise<Array<readonly [number, number]>> {
  const addends: Array<readonly [number, number]> = []
  for (let i = 0; i < 8; i++) {
    // Wait until the math screen reports it's on problem-index `i`.
    await expect(page.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      String(i),
      { timeout: 15_000 },
    )
    const [a, b] = await readCurrentAddends(page)
    addends.push([a, b] as const)
    if (i < 7) {
      await tapCorrectAndAdvance(page, i)
    }
  }
  return addends
}

// ────────────────────────────────────────────────────────────────────────
// Test suite
// ────────────────────────────────────────────────────────────────────────

test.describe('add-to-20 — pool envelope + doubles cap + MTB coverage + Class B reject', () => {
  test.beforeEach(async ({ page }) => {
    // Canon-bytes mock serves real Azure-rendered MP3 bytes — see
    // helper docstring for the full rationale. Avoids the
    // `installClaudeMock(page, { failNetwork: true })` trap per
    // `[[testing-and-ci.md §4.2 failNetwork tier-asymmetry warning]]`:
    // the static fallback for `focusNode === 'add-to-20'` (per
    // `sessionPlans.ts:424-434`) is the only safe failNetwork path
    // for THIS tier, but it's an 8-problem CANNED rotation, not the
    // real canon shape — asserting on Haiku-baked structural
    // properties against the canned rotation conflates two layers.
    // Serving real canon bytes via the mock keeps the assertions
    // grounded in the actual production content.
    //
    // `forceHowlerUnlock` is intentionally NOT called — per
    // `[[testing-and-ci.md §4.1.2]]`, the helper silently demotes
    // the canon-bytes path to the static-fallback plan, masking the
    // very regression these tests guard. Real Azure-rendered MP3
    // bytes decode cleanly under the genuine gesture-unlock chain
    // in headless chromium.
    await installAddToTwentyCanonClaudeMock(page)
  })

  // ── Test 1 ─────────────────────────────────────────────────────────
  //
  // AC1 — pool envelope: every problem in the 8-problem session has
  //       addend-a ∈ [1, 9], addend-b ∈ [1, 9], and sum ∈ [11, 18].
  //
  // CLASSIFICATION: Regression-lock. Current canon (post-#280)
  // satisfies all three invariants at every slot. The defense-in-
  // depth value is catching a future render-side or canon-side
  // regression that breaks the §1.1 pool envelope.
  //
  // Per `[[testing-and-ci.md §6 "Canon-content-coupled drift"]]`:
  // structural assertions on RANGE, not literal addend pin. Survives
  // any §1.1-compliant re-bake.
  test('pool envelope — every problem has addend ≤ 9 AND sum ∈ [11, 18]', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    // 8-problem walk-through; size timeout per `testing-and-ci.md §4.1.1b`.
    test.setTimeout(240_000)

    await seedLocalStorage(page, {
      progress: buildAddToTwentySeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Canon-landed gate (per testing-and-ci.md §4.1.2) — wait for
    // caption to populate before walking. Non-empty caption text
    // means the read-aloud effect has landed on the canon plan
    // rather than the static fallback. Avoid pinning specific
    // caption substring per §6 prose-template-coupled drift.
    await expect
      .poll(
        async () =>
          ((await page.getByTestId('math-caption').textContent()) ?? '').trim()
            .length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0)

    const allAddends = await walkAllProblemAddends(page)
    expect(allAddends).toHaveLength(8)

    // For each problem, assert the structural envelope.
    for (let i = 0; i < 8; i++) {
      const [a, b] = allAddends[i]!
      const sum = a + b
      const slot = `P${i + 1} (a=${a}, b=${b}, sum=${sum})`
      // Addend range — §1.2 strict.
      expect(
        a,
        `${slot}: addend-a should be ≥ ${ADD_TO_20_ADDEND_MIN}`,
      ).toBeGreaterThanOrEqual(ADD_TO_20_ADDEND_MIN)
      expect(
        a,
        `${slot}: addend-a should be ≤ ${ADD_TO_20_ADDEND_MAX}`,
      ).toBeLessThanOrEqual(ADD_TO_20_ADDEND_MAX)
      expect(
        b,
        `${slot}: addend-b should be ≥ ${ADD_TO_20_ADDEND_MIN}`,
      ).toBeGreaterThanOrEqual(ADD_TO_20_ADDEND_MIN)
      expect(
        b,
        `${slot}: addend-b should be ≤ ${ADD_TO_20_ADDEND_MAX}`,
      ).toBeLessThanOrEqual(ADD_TO_20_ADDEND_MAX)
      // Sum range — §1.2 v1 pool max is 18.
      expect(
        sum,
        `${slot}: sum should be ≥ ${ADD_TO_20_SUM_MIN}`,
      ).toBeGreaterThanOrEqual(ADD_TO_20_SUM_MIN)
      expect(
        sum,
        `${slot}: sum should be ≤ ${ADD_TO_20_SUM_MAX}`,
      ).toBeLessThanOrEqual(ADD_TO_20_SUM_MAX)
    }
  })

  // ── Test 2 ─────────────────────────────────────────────────────────
  //
  // AC2 / AC10 — high-leverage coverage: at least one of P5, P6, P7,
  //              P8 carries a make-ten-bridge fact from the §1.1 pool.
  //
  // CLASSIFICATION: Regression-lock. Current canon P5=8+5, P8=9+8
  // both make-ten-bridge → count = 2. Pre-#280 canon had ZERO make-
  // ten-bridge facts (per the doubles-prior failure mode the
  // correction lever is fixing).
  //
  // Asserts count ≥ 1 to align with the §2.4 rule's minimum binding.
  // Stronger assertion (count ≥ 2 or specific MTB facts) would over-
  // fit current canon and break on a §1.1-compliant re-bake that
  // happens to land only 1 MTB fact in P5-P8.
  test('high-leverage coverage — ≥ 1 make-ten-bridge fact in P5-P8', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(240_000)

    await seedLocalStorage(page, {
      progress: buildAddToTwentySeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    await expect
      .poll(
        async () =>
          ((await page.getByTestId('math-caption').textContent()) ?? '').trim()
            .length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0)

    const allAddends = await walkAllProblemAddends(page)
    expect(allAddends).toHaveLength(8)

    // Slice to P5-P8 (1-based 5..8 = 0-based 4..7).
    const p5ToP8 = allAddends.slice(4, 8)
    expect(p5ToP8).toHaveLength(4)

    // Count how many of P5-P8 are make-ten-bridge facts (ordered-pair
    // membership against §1.1's 13 MTB facts).
    const mtbCount = p5ToP8.filter(([a, b]) =>
      isInPool(MAKE_TEN_BRIDGE_POOL, a, b),
    ).length

    // High-leverage coverage rule — §2.4 LOCKED.
    // Per `[[feedback_count_assertions_on_regression_tests]]` use a
    // count comparison, not `.toContain`.
    expect(
      mtbCount,
      `P5-P8 must contain ≥ 1 make-ten-bridge fact. Got ${mtbCount}. ` +
        `P5-P8 addends: ${JSON.stringify(p5ToP8)}.`,
    ).toBeGreaterThanOrEqual(1)
  })

  // ── Test 3 ─────────────────────────────────────────────────────────
  //
  // AC9 — doubles cap: across the 8-problem session, AT MOST 2
  //       problems may carry a doubles fact (i.e. (a, b) ∈ DOUBLES_POOL).
  //
  // CLASSIFICATION: RED-on-base lever against pre-#280 canon. Pre-#280
  // canon contained 4 doubles (6+6 P1, 7+7 P2, 8+8 P4, 9+9 P6); the
  // assertion fails with `doublesCount === 4 > 2`. Post-#280 canon
  // contains 1 double (P3=6+6); assertion passes.
  //
  // This is THE doubles-prior correction lever — the spec rule §2.2
  // exists explicitly to halve the pre-correction saturation.
  test('doubles cap — at most 2 doubles across the 8-problem session', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(240_000)

    await seedLocalStorage(page, {
      progress: buildAddToTwentySeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    await expect
      .poll(
        async () =>
          ((await page.getByTestId('math-caption').textContent()) ?? '').trim()
            .length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0)

    const allAddends = await walkAllProblemAddends(page)
    expect(allAddends).toHaveLength(8)

    // Count problems whose (a, b) is in the doubles pool.
    const doublesCount = allAddends.filter(([a, b]) =>
      isInPool(DOUBLES_POOL, a, b),
    ).length

    // Doubles cap — §2.2 LOCKED at 2.
    // Per `[[feedback_count_assertions_on_regression_tests]]` use a
    // count assertion (toBeLessThanOrEqual), not `.toContain`.
    expect(
      doublesCount,
      `Doubles cap must hold (≤ 2). Got ${doublesCount} doubles. ` +
        `All addends: ${JSON.stringify(allAddends)}.`,
    ).toBeLessThanOrEqual(2)
  })

  // ── Test 4 ─────────────────────────────────────────────────────────
  //
  // Class B "dropped-carry" REJECTED (Kyle §3.4 + Dave §7.6) — chip
  // row at P4 with `correct ∈ [12, 18]` must be the structural off-
  // by-one set `{correct-1, correct, correct+1}` clamped, NOT a
  // decade-anchor trap like `{10, correct, correct+1}`.
  //
  // CLASSIFICATION: Regression-lock with positive discriminator.
  //
  // Per `[[testing-and-ci.md §4.1.1e Negative-membership trivially-
  // green trap]]` and the Devon NOF from PR #279: a "chip row does
  // NOT contain 10" assertion would be trivially-green pre-
  // implementation (Class B doesn't exist for op:'+', so 10 wouldn't
  // appear from that source regardless). The correct discriminator
  // is a POSITIVE assertion that the chip row EQUALS the expected
  // off-by-one set. If Class B (or any non-Class-1 class) fires
  // in a future regression, the set diverges and the assertion
  // fails loudly.
  //
  // Current canon P4 = 9+4=13 → expected chip row = {12, 13, 14}.
  // Future-canon-safe: reads correct at P4 then computes the expected
  // off-by-one neighbours. Clamping respects [1, 20] but for any
  // correct ∈ [12, 18] the neighbours are in-range.
  //
  // ALSO: positive discriminator on the captured request body —
  // assert `payload.progress.focusNode === 'add-to-20'`. This proves
  // the test exercised the add-to-20 path (not some cross-tier
  // fallback) per `[[testing-and-ci.md §4.1.1e]]`.
  test('Class B reject — P4 chip row equals off-by-one structural set (positive discriminator on focusNode)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    // 4-problem walk-through: tap correct 3 times to reach P4, then
    // read chips. Size timeout per `testing-and-ci.md §4.1.1b`.
    test.setTimeout(120_000)

    await seedLocalStorage(page, {
      progress: buildAddToTwentySeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    // Capture requests so we can assert focusNode (positive
    // discriminator per §4.1.1e). The mock helper already returns
    // `requests`; re-install here to bind to this test's `requests`
    // ref via the `installAddToTwentyCanonClaudeMock` first-match-
    // wins pattern per `[[testing-and-ci.md §4.2.2]]`.
    const { requests } = await installAddToTwentyCanonClaudeMock(page)

    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Canon-landed gate — wait for caption to populate.
    await expect
      .poll(
        async () =>
          ((await page.getByTestId('math-caption').textContent()) ?? '').trim()
            .length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0)

    // POSITIVE DISCRIMINATOR — captured request body shape.
    // Per `[[testing-and-ci.md §4.1.1e]]`: prove the served-canon
    // envelope was add-to-20, not a wrong-tier fallback. This
    // anchors Test 4's structural assertion to the right tier.
    const mathRequest = requests.find((r) => {
      try {
        const body = JSON.parse(r.postData() ?? '{}') as Record<string, unknown>
        const payload = (body.payload ?? {}) as Record<string, unknown>
        return payload.track === 'math'
      } catch {
        return false
      }
    })
    expect(mathRequest, 'No math request captured by the mock').toBeDefined()
    const reqBody = JSON.parse(mathRequest!.postData() ?? '{}') as Record<
      string,
      unknown
    >
    const reqPayload = (reqBody.payload ?? {}) as Record<string, unknown>
    const reqProgress = (reqPayload.progress ?? {}) as Record<string, unknown>
    expect(
      reqProgress.focusNode,
      'POSITIVE DISCRIMINATOR — the served-canon request must carry ' +
        'focusNode === "add-to-20". If not, the test is exercising the ' +
        'wrong tier and any chip-row assertion below is meaningless.',
    ).toBe('add-to-20')

    // Walk to P4 (0-based index 3). Tap correct 3 times.
    for (let i = 0; i < 3; i++) {
      await tapCorrectAndAdvance(page, i)
    }
    // Confirm we're on P4 (0-based 3).
    await expect(page.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      '3',
      { timeout: 15_000 },
    )

    // Read P4 addends + chips.
    const [a, b] = await readCurrentAddends(page)
    const correct = a + b
    const chipValues = await readCurrentChipValues(page)

    // Sanity gate: P4 sum must be in the §1.2 range so the off-by-
    // one structural set is well-defined.
    expect(correct).toBeGreaterThanOrEqual(ADD_TO_20_SUM_MIN)
    expect(correct).toBeLessThanOrEqual(ADD_TO_20_SUM_MAX)

    // Expected off-by-one structural set per §3.2 — clamped to
    // [ADD_TO_20_ADDEND_MIN, 20] (chip-range ceiling). For any
    // correct ∈ [11, 18] the neighbours are in-range so no clamping
    // applies.
    const expectedSet = new Set<number>([correct - 1, correct, correct + 1])
    const actualSet = new Set<number>(chipValues)

    // POSITIVE DISCRIMINATOR — chip row must EQUAL the expected
    // structural set. If Class B (or any non-Class-1 class) fires,
    // a chip value diverges and this fails loudly.
    //
    // Per `[[feedback_count_assertions_on_regression_tests]]` use
    // exact-equality semantics on the sorted arrays, not `.toContain`.
    const expectedSorted = [...expectedSet].sort((x, y) => x - y)
    const actualSorted = [...actualSet].sort((x, y) => x - y)
    expect(
      actualSorted,
      `P4 chip row should equal off-by-one set for correct=${correct}: ` +
        `expected ${JSON.stringify(expectedSorted)}, got ` +
        `${JSON.stringify(actualSorted)}. If Class B "dropped-carry" ` +
        `fires here (Kyle §3.4 REJECT + Dave §7.6 REJECT), the chip ` +
        `row will include 10 or another decade-anchor value and this ` +
        `assertion will catch it.`,
    ).toEqual(expectedSorted)
  })
})
