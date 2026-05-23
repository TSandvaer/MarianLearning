/**
 * E2E spec — `two-digit-addsub-with-regroup` progression: focus-node
 * picker transition from the mastered `-no-regroup` sibling onto the
 * brand-new `-with-regroup` tier, first-encounter behaviour on
 * `-with-regroup` entry, intro→practicing self-heal after session 1,
 * and full intro → mastered ladder under the 2-session test threshold.
 *
 * Ticket: Wave 6B — paired with Kevin's Wave 6C canon-bake PR (epic
 * `86c9y34xn`).
 *
 * ────────────────────────────────────────────────────────────────────
 * THE FAILING-FIRST CONTRACT — canon-absence is the load-bearing RED
 * ────────────────────────────────────────────────────────────────────
 *
 * On `main` at the base of this PR (HEAD `b4ebfa7`), there is NO
 * `public/canon/math/level-1/two-digit-addsub-with-regroup.json` on
 * disk. The disk file enumeration at the time of authoring is:
 *
 *   add-to-10.json    add-to-20.json
 *   mult-2-5-10.json  mult-3-4.json  mult-6-9.json
 *   number-recog.json
 *   skip-counting.json
 *   sub-to-10.json    sub-to-20.json
 *   two-digit-addsub.json   ← this is the `-no-regroup` canon
 *                              (per `canonFileTierFor` wire→disk map,
 *                              `api/_canon.ts:148`)
 *
 * No `two-digit-addsub-with-regroup.json` is present. Verified via
 * `ls public/canon/math/level-1/` on commit `b4ebfa7` (also asserted
 * in this spec's `canon file existence` test below).
 *
 * Test 1 is the **structural failing-first lever**: it asserts the
 * canon file EXISTS on disk at the expected path. Today on `main`,
 * this fails with a concrete `existsSync(...) === false` assertion —
 * NOT a flake, NOT a timeout, NOT a wrong-tier render fall-through.
 * After Kevin's Wave 6C bake lands the file, Test 1 turns green
 * automatically. This is the unambiguous canon-absence signal the
 * orchestrator brief requested.
 *
 * Tests 2–4 are progression invariants the Wave 6C bake unlocks:
 *
 *   - Test 2 (rendered-operand range): when the canon is served via
 *     the Wave-6D canon-bytes mock (reading
 *     `public/canon/math/level-1/two-digit-addsub-with-regroup.json`
 *     verbatim — add-to-20 PR #283 pattern), rendered addend-a should
 *     be ≥ 10 in every one of the 8 slots (two-digit first operand
 *     per Kyle's spec §1.1, `design/math/two-digit-addsub-with-regroup-
 *     content.md`). The assertion uses ≥ 1 (not all 8) as the
 *     threshold to survive any §1.1-compliant re-bake that legitimately
 *     places a single-operand-first slot — the current canon ships
 *     addend-a ∈ {15, 17, 21, 25, 27, 32, 41, 45} across P1-P8 so the
 *     assertion holds with full headroom. Pins canon-binding +
 *     two-digit operand parser handling (PR #287 widening) against
 *     future drift.
 *
 *   - Test 3 (focus-node-picker transition): seeds every upstream
 *     math node mastered (including `-no-regroup`), asserts
 *     `pickFocusNode` lands on `-with-regroup`. This works
 *     structurally on base today (PR #308 already shipped the
 *     SkillNode split into `MATH_NODES_IN_ORDER`) — classified as
 *     a **regression-lock** that pins the picker behaviour against
 *     any future revert.
 *
 *   - Test 4 (intro→practicing + practicing→mastered + history-tail
 *     accuracy under 80%/2 test threshold): two perfect sessions
 *     advance `-with-regroup` from `intro` to `mastered` in one
 *     ladder traversal AND unlock `skip-counting` to `intro`. This
 *     is a **regression-lock** on base today (the progression
 *     machinery is generic over the SkillNode literal — it doesn't
 *     care whether canon serves real `-with-regroup` content or the
 *     add-to-10 static fallback; the session is still attributed to
 *     the focus node via the picker's choice). After Wave 6C lands,
 *     the same assertion runs against real canon content.
 *
 * Tests 2 + 3 + 4 are paired with Test 1's canon-existence lever —
 * the structural failing-first signal lives on Test 1, and Tests 2–4
 * provide defence-in-depth + lock the surface against future drift.
 *
 * ────────────────────────────────────────────────────────────────────
 * Why the failing-first signal is canon-existence, NOT a render
 * assertion
 * ────────────────────────────────────────────────────────────────────
 *
 * The orchestrator brief asked for a "specific, observable" RED
 * signal, "not flake / timeout — a concrete missing-canon assertion."
 * Canon-file existence on disk fulfils that exactly:
 *
 *   - Pre-bake: `existsSync(canonPath) === false`. Test 1 fails with
 *     a one-line assertion error naming the missing file. No
 *     ambiguity about whether the test "passed for the wrong reason"
 *     (a render assertion under `failNetwork: true` could in
 *     principle satisfy a range check trivially against the static
 *     fallback — see `testing-and-ci.md §4.1.1d` failNetwork
 *     trivially-green trap).
 *   - Post-bake: `existsSync(canonPath) === true`. Test 1 passes.
 *
 * Layering progression tests on top (Tests 2–4) gives the regression
 * surface that survives the failing-first → green transition.
 *
 * ────────────────────────────────────────────────────────────────────
 * Spec authority
 * ────────────────────────────────────────────────────────────────────
 *
 *   - `design/math/two-digit-addsub-with-regroup-content.md` (Kyle,
 *     Wave 6 spec, ticket `86c9xwk74`) — pool envelope, op-mix,
 *     diagnostic-aware OUT gate, canon-state verification at §5.
 *   - `design/research/wave-5-borrow-carry-error-patterns.md` (Dave,
 *     PR #300) — pedagogical authority.
 *   - `src/lib/progress/focusNode.ts` `MATH_NODES_IN_ORDER` — picker
 *     order (PR #308 / commit `13e17f8` shipped the SkillNode split;
 *     `-no-regroup` and `-with-regroup` are adjacent in the list).
 *   - `api/_canon.ts:148` `canonFileTierFor` — wire→disk seam;
 *     `'two-digit-addsub-with-regroup'` passes through unchanged so
 *     the on-disk file name matches the wire literal.
 *
 * ────────────────────────────────────────────────────────────────────
 * Memory-rule alignment
 * ────────────────────────────────────────────────────────────────────
 *
 *   - `[[feedback_progression_e2e_mandatory]]` — progression state-
 *     machine PRs must be paired with a Jessica failing-first E2E at
 *     dispatch time. This spec satisfies that for the Wave 6C canon-
 *     bake PR (which will indirectly exercise the post-#308 picker
 *     transition once the canon serves and the screen renders real
 *     -with-regroup content).
 *
 *   - `[[feedback_force_howler_unlock_demote_extension]]` — the
 *     silent-demote rule extends to placeholder MP3s. Under
 *     `installClaudeMock(page, { failNetwork: true })`, no MP3 bytes
 *     are served (network is aborted), so the demote rule does NOT
 *     fire here — the chips enable via the silent caption-walk path
 *     after `forceHowlerUnlock`. The progression machinery is the
 *     surface under test, NOT the audio gate.
 *
 *   - `[[testing-and-ci.md §4.1.1d]]` failNetwork tier-asymmetry —
 *     for `focusNode !== 'add-to-20'`, the static fallback is the
 *     add-to-10 rotation. Test 2 was ORIGINALLY authored as a RED-on-
 *     base render lever (rendered operand-a < 10 under fallback →
 *     fails the ≥ 10 assertion) under `failNetwork: true`. Kevin's
 *     Wave 6C NOF (PR #318, 2026-05-23) caught the spec defect:
 *     `failNetwork: true` aborts `/api/claude` at the Playwright route
 *     layer BEFORE the server-side canon-lookup codepath ever runs, so
 *     the canon being on disk could not make Test 2 GREEN. Test 2 was
 *     marked `.fixme` mid-merge-cascade. **Wave 6D (this PR, ticket
 *     `86c9y3xu0`) upgrades Test 2's mock to canon-bytes** — reading
 *     `public/canon/math/level-1/two-digit-addsub-with-regroup.json`
 *     and serving it verbatim for `track === 'math'` requests, per the
 *     add-to-20 PR #283 pattern. The mock now exercises the served-
 *     canon codepath rather than aborting the upstream request, so the
 *     operand-range assertion lands against real canon content.
 *     `.fixme` removed; Test 2 is once again a load-bearing assertion.
 *     The base for this PR is post-Wave-6C `main`, so the canon JSON
 *     is on disk and Test 2 turns GREEN on first CI run.
 *
 *   - `[[feedback_subagent_premature_completion_fabricated_artifacts]]`
 *     — every PR-claim in the final report is verified via `gh pr
 *     view` after push.
 *
 * ────────────────────────────────────────────────────────────────────
 * Failing-first classification (per `jessica.md` § Failing-First
 * Verification Protocol Step 2)
 * ────────────────────────────────────────────────────────────────────
 *
 *   Test 1 (canon file existence)        — **RED-on-base lever**.
 *                                          The load-bearing failing-
 *                                          first signal. Asserts
 *                                          `existsSync(canonPath) ===
 *                                          true`. RED today (file
 *                                          absent); GREEN once Wave 6C
 *                                          bakes the canon.
 *
 *   Test 2 (operand range ≥ 10)          — **Regression-lock**
 *                                          (upgraded in Wave 6D, ticket
 *                                          `86c9y3xu0`). Now uses a
 *                                          canon-bytes mock that serves
 *                                          `public/canon/math/level-1/
 *                                          two-digit-addsub-with-regroup
 *                                          .json` verbatim for
 *                                          `track === 'math'` requests
 *                                          (per add-to-20 PR #283
 *                                          pattern). Every read in the
 *                                          baked canon has addend-a ≥
 *                                          12 per Kyle's spec §1.1
 *                                          pool envelope; the
 *                                          assertion holds against any
 *                                          §1.1-compliant re-bake. The
 *                                          original `failNetwork: true`
 *                                          shape was a spec defect
 *                                          discovered by Kevin's PR
 *                                          #318 NOF (route abort fires
 *                                          BEFORE the canon-lookup
 *                                          codepath), now resolved.
 *                                          Pins the with-regroup canon
 *                                          binding + the parser's
 *                                          two-digit operand handling
 *                                          (PR #287 widening) against
 *                                          future drift.
 *
 *   Test 3 (picker lands on -with-regroup) — **Regression-lock**.
 *                                          PR #308 already shipped
 *                                          the SkillNode split into
 *                                          `MATH_NODES_IN_ORDER`, so
 *                                          the picker walks past a
 *                                          mastered `-no-regroup` and
 *                                          lands on `-with-regroup`
 *                                          on base today. Pins the
 *                                          picker shape against future
 *                                          drift.
 *
 *   Test 4 (intro → mastered + downstream
 *           unlock under 80/2 threshold)  — **Regression-lock**. The
 *                                          progression machinery is
 *                                          generic over the SkillNode
 *                                          literal; two perfect
 *                                          sessions advance the focus
 *                                          node to `mastered`
 *                                          regardless of whether
 *                                          canon serves real content.
 *                                          Pins the mastery rule
 *                                          shape for this tier.
 *
 * At least one RED-on-base lever is required per `jessica.md` Step 2.
 * Test 1 (canon-existence) is the structurally-cleanest one and the
 * brief's primary ask — it remains the load-bearing failing-first
 * lever. Test 2 was originally a second RED-on-base lever but was
 * empirically invalidated (see Test 2 classification above); it is
 * now `.fixme` pending Wave 6D's canon-bytes mock upgrade.
 *
 * ────────────────────────────────────────────────────────────────────
 * Browser engine support
 * ────────────────────────────────────────────────────────────────────
 *
 * Test 1 (canon existence) is Playwright-engine-agnostic — it reads
 * the filesystem. Runs on both chromium and webkit projects.
 *
 * Tests 2–4 are chromium-only. WebKit headless has no AudioContext;
 * the read-aloud effect's `getHowlerRunningFn()` predicate stays
 * `false` forever and chips never enable. Real iPad Safari is
 * unaffected. Each uses `skipOnWebkitHeadless(testInfo)` per the
 * established pattern in `progression-mastery-loop.spec.ts`.
 */

import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  forceHowlerUnlock,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

interface PersistedProgress {
  skillLevels: Record<string, string>
  history: Array<{ dateISO: string; skillFocus: string[]; successRate: number }>
}

// ── WebKit-headless skip ────────────────────────────────────────────────
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud cannot fire. ' +
      'Chromium coverage is sufficient for progression state-machine ' +
      'surface; real iPad Safari has working AudioContext post-gesture.',
  )
}

// ── Canon-file path (the load-bearing failing-first surface) ───────────
//
// Per `api/_canon.ts:148` `canonFileTierFor`:
//   - `'two-digit-addsub-no-regroup'`  → disk `'two-digit-addsub'`
//   - `'two-digit-addsub-with-regroup'` → disk `'two-digit-addsub-with-regroup'`
//     (pass-through; no rebind)
//
// So the expected disk file for the new tier is exactly:
//   public/canon/math/level-1/two-digit-addsub-with-regroup.json
//
// Resolved from `process.cwd()` (Playwright runs from the worktree
// root) per `testing-and-ci.md §4.1.3` rule.
const TWO_DIGIT_ADDSUB_WITH_REGROUP_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/math/level-1/two-digit-addsub-with-regroup.json',
)

// ── Canon-bytes mock (Wave 6D — for Test 2 only) ────────────────────────
//
// Test 2's mock was upgraded from `installClaudeMock(failNetwork: true)`
// to this canon-bytes pattern (per `[[feedback_failing_first_must_prove_
// green]]` + Kevin's PR #318 NOF). Modelled on `installAddToTwentyCanon
// ClaudeMock` in `e2e/add-to-20.spec.ts` (PR #283).
//
// Behaviour:
//   - `track === 'math'` → serve `two-digit-addsub-with-regroup.json`
//     verbatim (regardless of `focusNode`). Test 2's seed lands the
//     picker on `'two-digit-addsub-with-regroup'` so the canon shape
//     matches the request.
//   - `track === 'word-song'` → 500 loudly. App.tsx catches and
//     falls through to silent caption-walk on Hub's pre-warm fetch —
//     same behaviour the production word-song path takes on any
//     outage, and doesn't affect Hub → Math navigation.
//   - `OPTIONS` preflight → 204.
//
// Tests 1, 3, 4 deliberately keep `installClaudeMock(page,
// { failNetwork: true })` — their assertions are structural (canon-
// existence, persisted-progress shape, history attribution) and do
// NOT depend on the served-canon codepath running. The canon-bytes
// upgrade applies to Test 2 alone.
function readMathCanon(path: string): string {
  if (!existsSync(path)) {
    throw new Error(
      `[with-regroup spec] canon not found at ${path}. ` +
        `This canon is required for the Test 2 canon-bytes mock; do ` +
        `NOT swap to a silent-MP3 placeholder — per testing-and-ci.md ` +
        `§4.1.2 + §4.1.3 rule 3 the placeholder also fails decode under ` +
        `the stub-ctx, falls back to the static add-to-10 rotation, and ` +
        `silently masks the regression. Wave 6C (PR #318) bakes this ` +
        `file; if the file is missing here, base-branch state has ` +
        `regressed.`,
    )
  }
  return readFileSync(path, 'utf-8')
}

async function installWithRegroupCanonClaudeMock(page: Page): Promise<void> {
  const canonBody = readMathCanon(TWO_DIGIT_ADDSUB_WITH_REGROUP_CANON_PATH)
  await page.route('**/api/claude', async (route: Route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, body: '' })
      return
    }
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
    // falls through to silent caption-walk; doesn't affect Hub → Math.
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'unexpected-track',
        message:
          `with-regroup Test 2 canon-bytes mock is math-only; saw ` +
          `track=${String(track)}`,
      }),
    })
  })
}

// ── Helpers (math session walk, picker seed) ────────────────────────────

/**
 * Drive one complete math session: Hub → Number Garden → 8 correct
 * chip taps → SessionEnd → "All done!" → Hub. Mirrors the helper in
 * `progression-mastery-loop.spec.ts:124-149`.
 *
 * Each chip-tap is followed by a 1500ms pause so the read-aloud effect
 * can settle into the next problem. The final tap immediately
 * advances to SessionEnd (no pause needed).
 */
async function runOneMathSession(
  page: import('@playwright/test').Page,
): Promise<void> {
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

/**
 * Build a Progress doc where every upstream math node is `'mastered'`
 * (including the `-no-regroup` sibling), with `-with-regroup` at
 * `'intro'` and `skip-counting` (the downstream sibling) at `'locked'`.
 *
 * Default `pickFocusNode` then walks `MATH_NODES_IN_ORDER` left-to-
 * right and lands on `-with-regroup` (the first non-mastered node).
 *
 * Per `progression-mastery-loop.spec.ts` § "Both tracks required by
 * isParentSettings strict per-track guard" — `parentSettings`
 * `masteryThreshold` MUST carry BOTH `math` and `'word-song'` keys
 * when the per-track shape is in use. A single-track seed silently
 * rejects the whole blob (guards.ts:193-197). Replace `parentSettings`
 * wholesale via raw spread to override `crossDayEnforcement: false`
 * (lets back-to-back sessions both count).
 */
function buildWithRegroupSeedProgress(): unknown {
  const progress = buildSeedProgress({
    skillLevelOverrides: {
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'mastered',
      'sub-to-20': 'mastered',
      // Wave 5 sibling-tier split (PR #308): `-no-regroup` mastered
      // so the picker walks past it onto `-with-regroup`.
      'two-digit-addsub-no-regroup': 'mastered',
      'two-digit-addsub-with-regroup': 'intro',
      'skip-counting': 'locked',
      'mult-2-5-10': 'locked',
      'mult-3-4': 'locked',
      'mult-6-9': 'locked',
    },
    masteryThreshold: { percent: 0.8, sessions: 2 },
  })

  return {
    ...(progress as Record<string, unknown>),
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
}

// ────────────────────────────────────────────────────────────────────────
// Test suite
// ────────────────────────────────────────────────────────────────────────

test.describe('two-digit-addsub-with-regroup — Wave 6 progression (failing-first paired with Wave 6C canon-bake)', () => {
  // ── Test 1 — RED-on-base canon-existence lever ─────────────────────
  //
  // The load-bearing failing-first assertion. Asserts the
  // `two-digit-addsub-with-regroup.json` canon file exists on disk.
  // Today on `main` (HEAD `b4ebfa7`), this file is absent — only
  // `two-digit-addsub.json` (the `-no-regroup` canon, baked by PR
  // #309) sits in `public/canon/math/level-1/`.
  //
  // Per Kyle's spec §5 (`design/math/two-digit-addsub-with-regroup-
  // content.md` line 516): "No `two-digit-addsub-with-regroup` canon
  // currently exists." This is the empirically-verified state being
  // locked.
  //
  // Failure mode on base is a concrete one-line assertion error:
  //
  //   Error: expect(received).toBe(true)
  //     received: false
  //     Expected the with-regroup canon to exist at
  //     <abs-path>/public/canon/math/level-1/two-digit-addsub-with-
  //     regroup.json. Wave 6C bake has not landed yet.
  //
  // NOT a flake; NOT a timeout. Wave 6C's bake materialises the file
  // and the assertion turns green.
  //
  // Engine-agnostic (no browser interaction); runs on both chromium
  // and webkit projects.
  test('canon file existence — public/canon/math/level-1/two-digit-addsub-with-regroup.json must exist on disk', async () => {
    const exists = existsSync(TWO_DIGIT_ADDSUB_WITH_REGROUP_CANON_PATH)
    expect(
      exists,
      `Expected the with-regroup canon to exist at ` +
        `${TWO_DIGIT_ADDSUB_WITH_REGROUP_CANON_PATH}. Wave 6C bake has ` +
        `not landed yet. Per canonFileTierFor (api/_canon.ts:148), the ` +
        `wire literal 'two-digit-addsub-with-regroup' passes through ` +
        `unchanged to the disk filename. Until this file ships, a runtime ` +
        `request for focusNode=two-digit-addsub-with-regroup hits canon ` +
        `miss → falls through to Haiku (which has no -with-regroup ` +
        `directive on base) OR fails. Wave 6C is the canon-bake PR ` +
        `that creates this file.`,
    ).toBe(true)
  })

  // ── Test 2 — Regression-lock via canon-bytes mock (Wave 6D upgrade) ─
  //
  // **History — `.fixme` removed in Wave 6D.** This test was originally
  // authored under `installClaudeMock(page, { failNetwork: true })` as
  // a RED-on-base render lever (under failNetwork the screen falls
  // into the add-to-10 static rotation with operands ∈ [1, 9], failing
  // the `addend-a ≥ 10` assertion). Kevin's PR #318 NOF (2026-05-23)
  // caught the spec defect: `failNetwork: true` aborts the
  // `/api/claude` request at the Playwright route layer BEFORE the
  // server-side canon-lookup codepath runs. So even after Wave 6C
  // baked the canon on disk, the test could not turn GREEN under
  // failNetwork. Test 2 was marked `.fixme` mid-merge-cascade.
  //
  // **Wave 6D fix (this PR, ticket `86c9y3xu0`):** swap the mock from
  // `installClaudeMock(failNetwork: true)` to
  // `installWithRegroupCanonClaudeMock(page)` — a canon-bytes mock
  // that reads `public/canon/math/level-1/two-digit-addsub-with-
  // regroup.json` and serves it verbatim for `track === 'math'`
  // requests, modelled on add-to-20 PR #283's
  // `installAddToTwentyCanonClaudeMock`. The mock now exercises the
  // served-canon codepath, so the operand-range assertion is grounded
  // in real canon content.
  //
  // **`forceHowlerUnlock` intentionally NOT called** — per
  // `[[testing-and-ci.md §4.1.2]]` + `[[feedback_force_howler_unlock_
  // demote_extension]]` the helper silently demotes the canon-bytes
  // path to the static-fallback plan, masking the very regression this
  // test guards. Real Azure-rendered MP3 bytes from the on-disk canon
  // decode cleanly under the genuine gesture-unlock chain in headless
  // chromium.
  //
  // **Classification.** Now a **regression-lock**. Every read in the
  // current canon (P1-P8 addend-a = {15, 17, 21, 27, 32, 25, 41, 45})
  // satisfies addend-a ≥ 10. The threshold is "≥ 1 of 8" (not "all 8")
  // to survive any §1.1-compliant re-bake that legitimately places a
  // single-operand-first variant. Pins the canon binding + the
  // PR #287 parser-widening for hyphenated two-digit number words
  // ("twenty-one", "forty-five") against future drift — a regression
  // that breaks the parser would cause silent demote to the
  // add-to-10 fallback (operands ∈ [1, 9]) and this assertion would
  // fail loudly per `[[planner-and-canon.md "silent wrong-tier
  // misrender"]]`.
  //
  // **References:**
  //   - PR #318 (Wave 6C canon bake) — Kevin's NOF that discovered
  //     the failNetwork spec defect
  //   - PR #283 (add-to-20 canon-bytes mock pattern) — the model
  //     this test now follows
  //   - `[[testing-and-ci.md §4.1.1d]]` — failNetwork tier-
  //     asymmetry (the load-bearing context behind the fix)
  //   - `[[feedback_failing_first_must_prove_green]]` — the memory
  //     rule documenting why failNetwork mocks cannot exercise
  //     server-side state
  test('rendered operand range — at least one addend-a ≥ 10 across 8 problems (canon-bytes mock)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // 8-problem walk-through; size timeout per `testing-and-ci.md
    // §4.1.1b` (sessions × ~50s wall + ≥30s headroom). Bumped to 240s
    // to match the established headroom for chip-walks against real
    // canon-rendered MP3 decoding (see Test 4).
    test.setTimeout(240_000)

    await installWithRegroupCanonClaudeMock(page)
    await seedLocalStorage(page, {
      progress: buildWithRegroupSeedProgress(),
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

    // Walk all 8 problems, capturing rendered addend-a values.
    const renderedAddendAs: number[] = []
    for (let i = 0; i < 8; i++) {
      await expect(page.getByTestId('math')).toHaveAttribute(
        'data-problem-index',
        String(i),
        { timeout: 15_000 },
      )
      const addendAText = await page.getByTestId('math-addend-a').textContent()
      renderedAddendAs.push(Number((addendAText ?? '').trim()))

      if (i < 7) {
        const correctChip = page.locator(
          '[data-testid="math-chip"][data-correct="true"]',
        )
        await expect(correctChip).toBeEnabled({ timeout: 15_000 })
        await correctChip.click()
      }
    }

    const twoDigitCount = renderedAddendAs.filter((a) => a >= 10).length
    expect(
      twoDigitCount,
      `Expected at least one rendered addend-a >= 10 across the 8-problem ` +
        `session (every fact in Kyle's spec §1.1 -with-regroup pool has ` +
        `a >= 12). Got addend-as: ${JSON.stringify(renderedAddendAs)}. ` +
        `If zero, the screen is rendering the static add-to-10 fallback ` +
        `rotation (operands ∈ [1, 9]) per sessionPlans.ts:441 — which ` +
        `means the canon-bytes mock is not serving (or its 'math' branch ` +
        `mismatched), the parser is rejecting the canon read-lines, OR ` +
        `the canon binding broke. All three are the regression class ` +
        `this test locks against.`,
    ).toBeGreaterThanOrEqual(1)
  })

  // ── Test 3 — Regression-lock: picker lands on -with-regroup ────────
  //
  // After session 1 records, the persisted history's tail must carry
  // `skillFocus: ['two-digit-addsub-with-regroup']`. This pins the
  // PR #308 SkillNode-split picker behaviour: walking past a mastered
  // `-no-regroup` lands on `-with-regroup` (not on the dead pre-#308
  // `'two-digit-addsub'` literal, which is no longer in
  // `MATH_NODES_IN_ORDER`).
  //
  // Classification: **regression-lock**. Today on base, PR #308's
  // split is live and the picker shape is correct, so this test
  // passes on base. The lock catches any future revert that
  // re-introduces a single `'two-digit-addsub'` node or drops the
  // sibling sequencing.
  test('focus-node picker — session-1 history tail records skillFocus on -with-regroup (post-#308 sibling-tier split is intact)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(180_000)

    await installClaudeMock(page, { failNetwork: true })
    await seedLocalStorage(page, {
      progress: buildWithRegroupSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    await runOneMathSession(page)

    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()

    // PR #308 regression-lock — history tail carries the new SkillNode
    // literal, NOT the dead `'two-digit-addsub'` legacy literal.
    expect(persisted.history.length).toBe(1)
    expect(persisted.history[0]!.skillFocus).toEqual([
      'two-digit-addsub-with-regroup',
    ])
    expect(persisted.history[0]!.successRate).toBe(1)
  })

  // ── Test 4 — Regression-lock: intro → mastered + downstream unlock ─
  //
  // Two perfect sessions under the 80%/2-session test threshold
  // advance `-with-regroup` from `'intro'` to `'mastered'` in one
  // ladder traversal:
  //   - Session 1: intro → practicing (PR #201 intro-pass on
  //     `successRate > 0`).
  //   - Session 2: practicing → mastered (80/2 scan over the last 2
  //     entries).
  // Same call, the downstream cascade unlocks `skip-counting` from
  // `'locked'` to `'intro'` via `nextNode('math',
  // 'two-digit-addsub-with-regroup')` per `mastery.ts`.
  //
  // Classification: **regression-lock**. Progression machinery is
  // generic over the SkillNode literal — works today on base via the
  // static fallback (the fallback's content is wrong-tier but the
  // session is correctly attributed to `-with-regroup` via the
  // picker). Pins the mastery rule shape for this tier.
  //
  // Wave 5 sibling-tier-cascade endpoint: this is the LAST math
  // progression rung before `skip-counting` (per Kyle's spec §3.4
  // node-taxonomy). The unlock chain `... → sub-to-20 →
  // -no-regroup → -with-regroup → skip-counting → ...` lands here.
  test('two perfect sessions promote intro → mastered AND unlock skip-counting (intro)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(240_000)

    await installClaudeMock(page, { failNetwork: true })
    await seedLocalStorage(page, {
      progress: buildWithRegroupSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    await runOneMathSession(page)
    await runOneMathSession(page)

    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()

    // SMOKING GUN A — intro → mastered ladder traversal under 80/2.
    expect(persisted.skillLevels['two-digit-addsub-with-regroup']).toBe(
      'mastered',
    )

    // SMOKING GUN B — downstream cascade fires on the same
    // `applyMasteryRule` call that promoted `-with-regroup`.
    // `nextNode('math', 'two-digit-addsub-with-regroup')` returns
    // `'skip-counting'`; the cascade flips it from `'locked'` to
    // `'intro'`.
    expect(persisted.skillLevels['skip-counting']).toBe('intro')

    // History grew by exactly 2 entries, both perfect, both attributed
    // to the new sibling tier.
    expect(persisted.history.length).toBe(2)
    const lastTwo = persisted.history.slice(-2)
    expect(lastTwo[0]!.successRate).toBe(1)
    expect(lastTwo[1]!.successRate).toBe(1)
    expect(lastTwo[0]!.skillFocus).toEqual(['two-digit-addsub-with-regroup'])
    expect(lastTwo[1]!.skillFocus).toEqual(['two-digit-addsub-with-regroup'])
  })
})
