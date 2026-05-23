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
 *   - Test 2 (rendered-operand range): when the canon is served,
 *     rendered addend-a should be ≥ 10 (two-digit first operand per
 *     Kyle's spec §1.1, `design/math/two-digit-addsub-with-regroup-
 *     content.md`). Today on `main`, with canon absent, the screen
 *     falls into `pickStaticSessionPlan(now,
 *     'two-digit-addsub-with-regroup')` which has NO special-case
 *     for the with-regroup focus (only `add-to-20` is special-cased
 *     at `sessionPlans.ts:445-447`) and returns the default
 *     `add-to-10` rotation with operands in [1, 9]. This assertion
 *     is RED on base for the right reason: the wrong-tier fallback
 *     content cannot satisfy a two-digit operand.
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
 *     add-to-10 rotation. Test 2 was AUTHORED as a RED-on-base render
 *     lever (rendered operand-a < 10 under fallback → fails the ≥ 10
 *     assertion), with the expectation that once Wave 6C baked the
 *     canon Test 2 would flip GREEN. **Kevin's Wave 6C empirical
 *     finding (PR #318 NOF, 2026-05-23) invalidated that expectation:**
 *     `failNetwork: true` aborts `/api/claude` at the Playwright route
 *     layer BEFORE the server-side canon-lookup codepath ever runs, so
 *     the canon being on disk cannot make Test 2 GREEN. The fix is to
 *     upgrade Test 2's mock from `failNetwork` to a canon-bytes mock
 *     that serves the new file (see add-to-20 PR #283 pattern) — this
 *     was deferred to a Wave 6D polish PR. **Until that lands Test 2
 *     is marked `.fixme`** so it neither passes nor fails on CI
 *     (Playwright lists `.fixme` tests separately) and the paired
 *     merge of this PR after Wave 6C is safe.
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
 *   Test 2 (operand range ≥ 10)          — **DEFERRED to Wave 6D**;
 *                                          marked `.fixme` 2026-05-23
 *                                          per Kevin's PR #318 NOF.
 *                                          Authored as a RED-on-base
 *                                          render lever, but Kevin
 *                                          empirically discovered the
 *                                          spec defect: under
 *                                          `failNetwork: true` the
 *                                          Playwright route aborts
 *                                          BEFORE the server-side
 *                                          canon-lookup codepath ever
 *                                          runs — so the canon being
 *                                          on disk cannot make Test 2
 *                                          GREEN. Fix is to swap the
 *                                          mock from `failNetwork` to
 *                                          a canon-bytes mock per
 *                                          add-to-20 PR #283 pattern.
 *                                          Deferred to Wave 6D polish
 *                                          PR; until then the test is
 *                                          `.fixme` so it neither
 *                                          passes nor fails on CI.
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
import { existsSync } from 'node:fs'
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

  // ── Test 2 — DEFERRED to Wave 6D (marked .fixme) ───────────────────
  //
  // **Why .fixme:** Kevin's Wave 6C bake (PR #318) discovered a
  // structural spec defect in this test. The test was authored as a
  // RED-on-base render lever — under `installClaudeMock(failNetwork:
  // true)` the screen was expected to fall into the add-to-10 static
  // rotation (operands ∈ [1, 9]) per `testing-and-ci.md §4.1.1d`,
  // failing the `addend-a >= 10` assertion. The expectation was that
  // once Wave 6C baked the canon, the served-canon path would deliver
  // two-digit operands and Test 2 would flip GREEN.
  //
  // **Kevin's empirical finding (PR #318 NOF, 2026-05-23):**
  // `failNetwork: true` aborts the `/api/claude` request at the
  // Playwright route layer. The canon-lookup logic lives **server-
  // side** inside the `/api/claude` function handler — an aborted
  // request never reaches that codepath. So no matter how correctly
  // Wave 6C bakes the canon, this assertion cannot turn GREEN under
  // the current mock shape.
  //
  // **Wave 6D fix:** swap the mock from `failNetwork: true` to a
  // canon-bytes mock that serves the new tier's canon JSON directly
  // from the Playwright route (see add-to-20 PR #283 pattern). That
  // mocks the canon-serving codepath rather than aborting the
  // upstream request, making the assertion actually exercise the
  // canon-rendered operand range.
  //
  // **References:**
  //   - PR #318 (Wave 6C canon bake) — Kevin's NOF that discovered
  //     this defect
  //   - PR #283 (add-to-20 add-to-mock-canon pattern) — the mock
  //     pattern Wave 6D will adopt here
  //   - `testing-and-ci.md §4.1.1d` — failNetwork tier-asymmetry
  //     (the load-bearing context Kevin's finding extends)
  //
  // **CI impact of `.fixme`:** Playwright lists `.fixme` tests
  // separately from PASS/FAIL — they neither pass nor fail the
  // suite. This unblocks paired-merge of this PR after Wave 6C
  // (PR #318) without breaking CI on post-6C main.
  test.fixme('rendered operand range — at least one addend-a ≥ 10 across 8 problems (post-canon-bake)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // 8-problem walk-through; size timeout per `testing-and-ci.md
    // §4.1.1b` (sessions × ~50s wall + ≥30s headroom).
    test.setTimeout(180_000)

    await installClaudeMock(page, { failNetwork: true })
    await seedLocalStorage(page, {
      progress: buildWithRegroupSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

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
        `means the canon is absent OR the parser is rejecting the canon ` +
        `read-lines and falling through. Both failure modes are the RED ` +
        `signal Wave 6C resolves.`,
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
