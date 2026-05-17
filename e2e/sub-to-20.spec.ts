/**
 * E2E spec — `sub-to-20` content tier: trigger, Class B (decade-anchor
 * miss) distractor, no-borrow constraint, out-of-scope guard.
 *
 * Ticket: 86c9utcfx (Jessica, failing-first).
 * Paired with: Devon's implementation ticket 86c9utcf7 (the
 *   `distractorClass: 'decade-anchor'` type-union widening +
 *   `decadeAnchorDistractors` algorithm + Math.tsx dispatch wiring)
 *   and Kevin's planner/canon ticket (the `MATH_TRACK_GUIDE`
 *   `sub-to-20` directive block + 22-fact no-borrow pool +
 *   `public/canon/math/level-1/sub-to-20.json` re-bake).
 *
 * Spec authority: `design/math/sub-to-20-content.md` §1 (22-fact pool),
 * §2 (problem-mix rules), §3 (distractor classes), §6 (wire-up
 * checklist), §6.8 (test coverage minimums — AC list).
 *
 * ────────────────────────────────────────────────────────────────────
 * FAILING-FIRST POSTURE — Option B (`test.fixme`)
 * ────────────────────────────────────────────────────────────────────
 *
 * Per the dispatch brief, mirroring the PR #202 progression-mastery-loop
 * and PR #265 subitising-scaffold precedents: every test in this spec
 * is wrapped in `test.fixme()` until the paired implementation PRs
 * land. Rationale:
 *
 *   - Devon's PR (Class B distractor + render dispatch) is not yet
 *     authored; the `'decade-anchor'` member of `PickDistractorsOpts.
 *     distractorClass` union does NOT exist on current `origin/main`
 *     (verified at spec-authoring time, 2026-05-17 — `distractors.ts:159`
 *     still reads `'off-by-one' | 'wrong-op'`).
 *   - Kevin's PR (planner directive + canon re-bake) is also pending.
 *     Current `public/canon/math/level-1/sub-to-20.json` carries a
 *     pre-spec one-shot bake from the legacy 1-line `_planner.ts:1022`
 *     skeleton and openly violates the §1.1 no-borrow constraint
 *     (P5=`15-5=10`, P6=`14-7=7` ← BORROW, P7=`18-9=9` ← BORROW,
 *     P8=`19-3=16`). The current canon is the empirical RED state.
 *   - Un-fixme'd tests would RED-fail at CI immediately against current
 *     main → blocks this PR from merging until Devon's + Kevin's impls
 *     land → impls can't merge cleanly because this spec sits unmerged
 *     in front of them. Classic stacked-PR dependency.
 *   - With `test.fixme()` wrappers, this spec PR is CI-green and
 *     mergeable IMMEDIATELY. A tiny follow-up PR (≤10-line diff)
 *     flips `test.fixme(` → `test(` after the paired PRs merge; CI
 *     then asserts the GREEN-side meaning.
 *
 * NB: Option A (un-fixme'd tests, RED on base) was considered and
 * rejected. The Option B precedent is well-established (PR #202,
 * PR #206, PR #226, PR #239, PR #265) and works cleanly.
 *
 * ────────────────────────────────────────────────────────────────────
 * Coordination contract with Devon (ticket 86c9utcf7)
 * ────────────────────────────────────────────────────────────────────
 *
 * This spec asserts behaviour observable at the chip-render surface —
 * specifically the `[data-testid="math-chip"]` set carried by
 * `[data-testid="math"]` per existing pattern (`Math.tsx:2462+2476`).
 * Devon's implementation should:
 *
 *   (a) Widen `PickDistractorsOpts.distractorClass` to
 *       `'off-by-one' | 'wrong-op' | 'decade-anchor'`
 *       (`distractors.ts:159`).
 *   (b) Add a `decadeAnchorDistractors(correct, minAnswer, maxAnswer)`
 *       internal function implementing the §3.3 formula. Returns
 *       `[number, number] | null`. Null cases (degenerate /
 *       out-of-range / aliases-correct / aliases-off-by-one)
 *       downgrade to off-by-one at the call site.
 *   (c) Extend `pickDistractors` dispatch to route
 *       `op === '-' && distractorClass === 'decade-anchor'` to the
 *       new function; fall through to `offByOneDistractors` on `null`.
 *   (d) Wire `Math.tsx` to set `distractorClass = 'decade-anchor'` on
 *       P4-P8 problems when `focusNode === 'sub-to-20'`.
 *
 * **Testid contract.** No NEW testid is required for this spec — the
 * existing `math-chip` + `math-addend-a` + `math-addend-b` + `math`
 * (root) testids suffice. If Devon decides to add a
 * `data-distractor-class="decade-anchor"` attribute on
 * `[data-testid="math-chip"]` for diagnostic purposes, this spec
 * does NOT depend on it (the value-based assertions below are
 * sufficient). Flag in the flip-PR if a future spec wants such
 * an attribute.
 *
 * ────────────────────────────────────────────────────────────────────
 * Acceptance criteria coverage (per spec §6.8 + dispatch brief)
 * ────────────────────────────────────────────────────────────────────
 *
 * AC1 (trigger — sub-to-20 focus, op:'-') :
 *      Seed `sub-to-20: 'practicing'` with all upstream math nodes
 *      mastered. Hub → Number Garden lands on sub-to-20. P1 read-line
 *      is `<minuend> minus <subtrahend>. How many are left?` with
 *      `op === '-'` and minuend in [11, 19] (per §1.1 pool: every
 *      pool fact has minuend ∈ {11..19}). Covered by Test 1.
 *
 * AC2 (Class B distractor renders on P4-P8):
 *      For a P4-P8 problem whose `correct` answer is in [10, 18]
 *      AND `correct !== 10` AND `correct !== 11` AND `correct !== 9`
 *      (i.e. trap `DEC=10` does NOT alias correct AND does NOT
 *      alias off-by-one), the rendered chip row MUST contain `10`
 *      as a distractor. The §1.1 pool's CLEAN-annotated facts
 *      (#9 `14-2=12`, #12 `15-3=12`, #13 `15-2=13`, #16 `16-4=12`,
 *      #18 `17-5=12`, #20 `18-6=12`, #22 `19-7=12`) ALL satisfy
 *      this. Covered by Test 2.
 *
 * AC3 (no-borrow constraint — `14-7=7` and friends NEVER appear):
 *      The forbidden borrow facts (§1.1 — "Common BORROW candidates
 *      to REJECT" in the directive prose) MUST NOT appear in the
 *      8-problem session. Sample: across the 8 problems, no read
 *      line contains any of the canonical borrow operand strings
 *      (`Fourteen minus seven`, `Eighteen minus nine`, `Sixteen
 *      minus nine`, etc.). Covered by Test 3.
 *
 * AC4 (out-of-scope — focus !== sub-to-20):
 *      The Class B (`'decade-anchor'`) distractor MUST NOT fire when
 *      `focusNode === 'sub-to-10'` (different tier — sub-to-10 keeps
 *      Class 2 wrong-op per §3.5). Specifically: a sub-to-10 P4-P8
 *      problem where `DEC` would be `10` (e.g. `9-3=6` → `DEC=10`)
 *      does NOT render `10` as a Class-B-style distractor. Sub-to-10
 *      already has its own out-of-band coverage in
 *      `sub-to-10-distractor-class-2.spec.ts`; here we lock the
 *      cross-tier guard explicitly. Covered by Test 4.
 *
 * ────────────────────────────────────────────────────────────────────
 * Structural / fact-equivalence assertions (per testing-and-ci.md §6)
 * ────────────────────────────────────────────────────────────────────
 *
 * Per `[[testing-and-ci.md §6 "Canon-content-coupled E2E spec drift"]]`
 * — applied lessons from PR #266 where a literal canon-content pin
 * broke a sibling spec on a commutative-equivalent re-bake. THIS SPEC
 * AVOIDS LITERAL CANON-CONTENT PINS WHERE POSSIBLE. Specifically:
 *
 *   - Test 1 (AC1 trigger): does NOT assert `addend-a === "17"`
 *     literally. Instead asserts addend-a IS a digit-string AND that
 *     digit ∈ {11..19} (the §1.1 minuend set). Survives any pool
 *     re-bake that keeps the no-borrow constraint.
 *   - Test 2 (AC2 Class B): does NOT assert "P4 is `16-4=12`".
 *     Instead reads whatever `correct` is currently rendered AND
 *     verifies the Class-B-eligible PRECONDITIONS (correct ∈ [12, 18]
 *     EXCLUDING values where DEC aliases), THEN asserts the chip row
 *     contains DEC=10. Survives any canon re-bake that keeps a single
 *     Class-B-CLEAN-eligible fact at P4 (per §1.1 the maximum
 *     achievable CLEAN-count in P4-P8 is 4; minimum is 2).
 *   - Test 3 (AC3 no-borrow): asserts the read text of every problem
 *     does NOT contain any BORROW-pair substring. The pair set is
 *     derived from the §1.1 no-borrow definition (`ones-digit(a) < b`)
 *     — a structural rule, not a literal canon-content pin.
 *   - Test 4 (AC4 OOS gate): asserts the negative — sub-to-10 chip
 *     row does NOT contain a Class-B-style trap that ONLY makes sense
 *     under sub-to-20's rules.
 *
 * Where Test 2 needs to gate on P4 ordering (to confirm we're in the
 * discriminate tier, not gentle), it reads the `data-problem-index`
 * 0-based attribute on the `math` root per `testing-and-ci.md §4.1.3`
 * rule 5 — NOT `waitForTimeout`.
 *
 * ────────────────────────────────────────────────────────────────────
 * Browser engine support
 * ────────────────────────────────────────────────────────────────────
 *
 * Chromium-only. The chip-render surface needs the read-aloud effect's
 * `audioReady` gate to flip true before chips become enabled (for the
 * chip-walk in Test 2). WebKit headless has no AudioContext — chips
 * never enable. Real iPad Safari is unaffected. Each test calls
 * `skipOnWebkitHeadless(testInfo)`.
 *
 * ────────────────────────────────────────────────────────────────────
 * Failing-first verification trail
 * ────────────────────────────────────────────────────────────────────
 *
 * Per `[[feedback_progression_e2e_mandatory]]` rule 8 — classify each
 * assertion (target post-Devon+Kevin-merge state):
 *
 *   - Test 1 (trigger renders): post-Kevin-merge **RED-on-base lever**
 *     in spirit. On current main the pre-spec canon's P1 is `5 minus
 *     2 = 3` (NOT in the §1.1 no-borrow pool, minuend `5 < 11`). The
 *     minuend-membership assertion `addendA in {11..19}` fails. After
 *     Kevin's canon re-bake the minuend will be one of {11..19} and
 *     the test goes green.
 *   - Test 2 (Class B fires): post-Devon-merge **RED-on-base lever**.
 *     On current main `distractorClass = 'decade-anchor'` doesn't
 *     exist; `pickDistractors` falls through to off-by-one for every
 *     P4-P8 sub problem. The chip row at P4 will NOT contain `10`
 *     unless `correct == 11` (off-by-one accidentally produces 10).
 *     The §1.1 CLEAN pool keeps `correct >= 12`, so the assertion
 *     `chips.contains(10)` is RED on base.
 *   - Test 3 (no-borrow): post-Kevin-merge **RED-on-base lever**. On
 *     current main the legacy canon contains `14-7=7` at P6 and
 *     `18-9=9` at P7 (both BORROW facts). The substring assertion
 *     fails. After Kevin's canon re-bake under the new directive's
 *     NO-BORROW SELF-CHECK + 22-fact pool, borrow facts are excluded
 *     by construction.
 *   - Test 4 (out-of-scope on sub-to-10): would be trivially-green
 *     today (the `'decade-anchor'` class doesn't exist anywhere) and
 *     a real regression-guard post-Devon-merge — pins that Devon's
 *     wire doesn't accidentally widen Class B to sub-to-10.
 *
 * Per `[[feedback_count_assertions_on_regression_tests]]`, all
 * assertions use `.toEqual([...])` / `.toBe(N)` / `.toHaveCount(N)` /
 * `.filter(...).length === N` shapes. `.toContain` is avoided on
 * regression behaviour; the one membership-style read in Test 2
 * uses `.filter(...).length === 1` for exact-count guarantees.
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'

// ── WebKit-headless skip ─────────────────────────────────────────────────
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud cannot fire. ' +
      'Chromium coverage is sufficient for content-tier surface; real ' +
      'iPad Safari has working AudioContext post-gesture.',
  )
}

// ── §1.1 pool invariants — derived structural facts, not canon literals ──

/**
 * Per spec §1.1: every fact in the no-borrow 22-fact pool has
 * `minuend ∈ [11, 19]`. ANY rendered P1-P8 read-line must place
 * `addend-a` (the minuend) at one of these values when the focus
 * node is `sub-to-20`. Structural, not literal — survives any pool
 * re-curation that keeps the no-borrow + teen-minuend constraints.
 */
const SUB_TO_20_MINUEND_SET = new Set([
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
])

/**
 * Per spec §1.1: every result in the no-borrow pool falls in
 * `[10, 18]`. The Class B (decade-anchor) trap `DEC = round(c/10)*10`
 * equals `10` for results `[10, 14]` and `20` for `[15, 18]`. Since
 * `maxAnswer = ANSWER_RANGE_MAX_TO_20 = 20` (per `distractors.ts:110`
 * for any correct ≥ 11), `DEC = 10` is always in range; `DEC = 20`
 * is also in range. The pre-curated §1.1 pool produces `DEC = 10`
 * for almost every CLEAN fact (the rare exceptions at #6/#16/etc.
 * confirm this — see the pool table). For the CLEAN subset Haiku
 * is biased to pick at P4-P8, DEC=10 is the canonical trap value.
 */
const CLASS_B_TRAP_VALUE = 10

/**
 * The BORROW pairs the §1.1 NO-BORROW SELF-CHECK explicitly forbids.
 * Derived from `ones-digit(minuend) < subtrahend` (the strict
 * procedural no-borrow definition per §1.1 directive prose).
 *
 * Words match the Haiku-emitted read-line prosody (capitalized
 * minuend + lowercase subtrahend). E.g. `"Fourteen minus seven"`.
 * Per §4.1 PROSODY block: "numbers are spelled out as words
 * ('eleven'..'nineteen'); Capitalize the first word of each sentence."
 *
 * Computed at module-load: enumerate every (minuend, subtrahend)
 * with minuend ∈ [11, 19], subtrahend ∈ [1, 9], where
 * `ones-digit(minuend) < subtrahend` — this is the FORBIDDEN set.
 * Excludes `19-9=10` which is no-borrow (ones(19)=9 ≥ 9).
 */
const NUMBER_WORD_CAP = [
  '', // 0 — unused
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
] as const
const NUMBER_WORD_LOWER = NUMBER_WORD_CAP.map((s) => s.toLowerCase())

function buildForbiddenBorrowReadSubstrings(): readonly string[] {
  const out: string[] = []
  for (let a = 11; a <= 19; a++) {
    const onesA = a % 10
    for (let b = 1; b <= 9; b++) {
      if (onesA < b) {
        // BORROW fact — must not appear in any read-line.
        const minuendWord = NUMBER_WORD_CAP[a]
        const subtrahendWord = NUMBER_WORD_LOWER[b]
        // Format matches §4.2 read template:
        //   "<minuend> minus <subtrahend>. How many are left?"
        out.push(`${minuendWord} minus ${subtrahendWord}`)
      }
    }
  }
  return out
}

const FORBIDDEN_BORROW_READ_SUBSTRINGS = buildForbiddenBorrowReadSubstrings()

// ── Seed builders ────────────────────────────────────────────────────────

/**
 * Build a Progress doc with `sub-to-20: 'practicing'` and every
 * upstream math node `'mastered'`. The default `pickFocusNode` then
 * lands on sub-to-20 (the first non-mastered node in
 * `MATH_NODES_IN_ORDER`).
 *
 * `mastered` upstream is required because the picker walks the
 * order left-to-right and stops at the first non-mastered node;
 * any upstream node at `'practicing'` or `'intro'` would intercept
 * the focus.
 */
function buildSubToTwentySeedProgress(): unknown {
  return buildSeedProgress({
    skillLevelOverrides: {
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'mastered',
      'sub-to-20': 'practicing',
      'two-digit-addsub': 'locked',
      'skip-counting': 'locked',
      'mult-2-5-10': 'locked',
      'mult-3-4': 'locked',
      'mult-6-9': 'locked',
    },
  })
}

/**
 * For AC4 — seed sub-to-10 as the focus (sub-to-10 'practicing',
 * upstream mastered, sub-to-20 'locked'). Tests that Class B
 * (decade-anchor) does NOT fire on a non-sub-to-20 focus.
 */
function buildSubToTenSeedProgress(): unknown {
  return buildSeedProgress({
    skillLevelOverrides: {
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
    },
  })
}

// ── Chip-walk gate helper — DOM 0-based `data-problem-index` ────────────

/**
 * Walk from P1 to the target 1-based `problemIndex` via correct-chip
 * taps. Uses `data-problem-index` attribute on `[data-testid="math"]`
 * (0-based) as the advance gate per `testing-and-ci.md §4.1.3` rule 5
 * — NOT `waitForTimeout` which races the celebrate animation.
 *
 * Returns the chip values (`data-value` attribute on each
 * `[data-testid="math-chip"]`) at the target problem.
 */
async function readChipValuesAtProblem(
  page: Page,
  problemIndex: number,
): Promise<number[]> {
  // 1-based `problemIndex` from caller; DOM gate is 0-based.
  // For P=4 we need to tap correct 3 times (advance from idx 0 → 3).
  for (let i = 1; i < problemIndex; i++) {
    const correctChip = page.locator(
      '[data-testid="math-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 15_000 })
    await correctChip.click()
    await expect(page.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      String(i),
      { timeout: 15_000 },
    )
  }
  // Now on `problemIndex` — read all 3 chip values.
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
 * Read every problem's read-line text by walking through all 8
 * problems. Returns the concatenated session-wide read text. Used
 * by Test 3 (no-borrow) — we only need to see what text was read
 * to Marian; we don't need to assert chip values per problem.
 *
 * Walks via correct-chip tap + DOM gate per
 * `testing-and-ci.md §4.1.3` rule 5.
 */
async function readAllProblemReadLines(page: Page): Promise<string[]> {
  const lines: string[] = []
  for (let i = 0; i < 8; i++) {
    // Wait for the read-aloud effect to land on this problem.
    await expect(page.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      String(i),
      { timeout: 15_000 },
    )
    // Read the rendered read-aloud line. `math-read-aloud-text` is
    // the canonical testid for the visible caption text per
    // `Math.tsx`; if Devon's wire renames it, this helper updates
    // along with the spec.
    const text = await page.getByTestId('math-read-aloud-text').textContent()
    if (text !== null) lines.push(text.trim())
    // Advance to the next problem (except after the last one).
    if (i < 7) {
      const correctChip = page.locator(
        '[data-testid="math-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()
    }
  }
  return lines
}

// ────────────────────────────────────────────────────────────────────────
// Test suite
// ────────────────────────────────────────────────────────────────────────

test.describe('sub-to-20 — trigger + Class B + no-borrow + out-of-scope', () => {
  test.beforeEach(async ({ page }) => {
    // `failNetwork: true` — silent caption-walk fallback drives chip
    // enablement on CI runners (no AudioContext, no decode cost).
    //
    // GREEN-side caveat (per `testing-and-ci.md §6` corollary): a
    // canon-content-pinning test cannot use `failNetwork: true`
    // because `pickStaticMathPlan()` produces hardcoded fallback
    // problems — NOT the new sub-to-20 canon. This spec MOSTLY uses
    // structural assertions that survive the static fallback (a
    // borrow fact would never appear in any static plan either), so
    // `failNetwork` is acceptable for Tests 1 + 3 + 4. Test 2 (Class
    // B chip-row assertion) is the exception — it requires the new
    // canon to land at P4 with a CLEAN Class-B-eligible fact. When
    // the flip-PR un-fixmes Test 2, the brief should consider
    // switching to a sub-to-20-canon-serving mock following the
    // `installCvcWordsClaudeMock` pattern at §4.2 of testing-and-ci.
    // Flag in the flip-PR.
    await installClaudeMock(page, { failNetwork: true })
  })

  // ── Test 1 ─────────────────────────────────────────────────────────
  //
  // AC1 — trigger: seeded `sub-to-20` focus produces P1 read-line
  //       with minuend ∈ {11..19} (the §1.1 no-borrow teen-minuend
  //       constraint).
  //
  // RED-on-base lever (post-Kevin-merge): current main's
  // `sub-to-20.json` canon P1 is `5 minus 2 = 3` — minuend `5` is
  // NOT in the §1.1 pool. The set-membership assertion below fires.
  // Post-Kevin's canon re-bake, P1's minuend lands in {11..19}.
  test.fixme('trigger — sub-to-20 P1 has minuend ∈ {11..19} (no-borrow teen)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    await seedLocalStorage(page, {
      progress: buildSubToTwentySeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('math-symbolic')).toBeVisible({
      timeout: 10_000,
    })

    // Structural assertion — minuend (addend-a in op:'-' rendering)
    // is one of {11..19}. Survives any §1.1 pool re-curation that
    // preserves the teen-minuend constraint.
    const addendAText = await page.getByTestId('math-addend-a').textContent()
    expect(addendAText).not.toBeNull()
    const addendA = (addendAText ?? '').trim()
    expect(SUB_TO_20_MINUEND_SET.has(addendA)).toBe(true)

    // Structural assertion — subtrahend in {1..9}. The §1.1 pool's
    // subtrahend range is [1, 9] (single-digit only by no-borrow
    // construction).
    const addendBText = await page.getByTestId('math-addend-b').textContent()
    expect(addendBText).not.toBeNull()
    const addendB = Number((addendBText ?? '').trim())
    expect(addendB).toBeGreaterThanOrEqual(1)
    expect(addendB).toBeLessThanOrEqual(9)

    // Structural assertion — ones-digit(minuend) ≥ subtrahend
    // (the §1.1 NO-BORROW SELF-CHECK invariant). If Kevin's
    // directive lands but Haiku violates the self-check, this
    // assertion catches it.
    const minuendNum = Number(addendA)
    expect(minuendNum % 10).toBeGreaterThanOrEqual(addendB)
  })

  // ── Test 2 ─────────────────────────────────────────────────────────
  //
  // AC2 — Class B distractor renders on P4-P8: for a P4 problem
  //       whose `correct` is in [12, 18] (Class-B-CLEAN-eligible —
  //       DEC=10 in range, not aliasing correct, not aliasing
  //       off-by-one), the rendered chip row MUST contain `10` as
  //       a distractor.
  //
  // RED-on-base lever (post-Devon-merge): on current main
  // `distractorClass = 'decade-anchor'` is not in the union, so
  // `Math.tsx`'s P4-P8 dispatch can't request it. `pickDistractors`
  // falls through to `offByOneDistractors`, which emits
  // `[correct - 1, correct + 1]` — `10` only appears if `correct
  // ∈ {9, 11}`. Since §1.1's CLEAN pool keeps `correct ≥ 12`,
  // `10` would NEVER appear on the chip row pre-impl. Post-impl,
  // for a §1.1 CLEAN fact at P4, the chip row contains exactly one
  // `10` (the trap).
  //
  // Structural pre-condition gate: BEFORE asserting `chips contain
  // 10`, read the rendered `correct` value at P4. If `correct` is
  // ALIAS (10 — aliases trap) or BOUNDARY (11 — off-by-one is also
  // 10) or out of range, skip the assertion as "the canon's P4 isn't
  // Class-B-CLEAN today; spec is satisfied vacuously". This keeps
  // the spec robust against a future canon re-bake that lands a
  // non-CLEAN fact at P4 — the §1.1 minimum CLEAN-count in P4-P8
  // is 2, but exactly which slot they land at is Haiku's call.
  //
  // The 1-of-5 P4 sample is the cheapest gate; future polish could
  // walk all 5 P4-P8 slots and assert ≥2 CLEAN-with-10 (matching
  // the §2.2 ≥2/5 rule directly).
  test.fixme('Class B fires at P4 when fact is CLEAN — chip row contains the DEC=10 trap', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    // 4-problem walk-through: tap correct 3 times to reach problem 4,
    // then read chips. Per `testing-and-ci.md §4.1.1b`: size the
    // timeout for the full multi-problem walk + headroom.
    test.setTimeout(120_000)

    await seedLocalStorage(page, {
      progress: buildSubToTwentySeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    const valuesAtP4 = await readChipValuesAtProblem(page, 4)
    expect(valuesAtP4).toHaveLength(3)

    // Identify `correct` at P4 by reading the addends + computing
    // the difference. This is the structural read — derives from
    // whatever the canon currently emits, not a literal value pin.
    const addendAText = await page.getByTestId('math-addend-a').textContent()
    const addendBText = await page.getByTestId('math-addend-b').textContent()
    const minuend = Number((addendAText ?? '').trim())
    const subtrahend = Number((addendBText ?? '').trim())
    const correct = minuend - subtrahend

    // Pre-condition: the P4 fact must be Class-B-CLEAN-eligible.
    // Per §3.3 formula: DEC=10 (in range), DEC !== correct,
    // |DEC - correct| > 1.
    //
    // If the canon lands a non-CLEAN fact here, the spec is
    // satisfied vacuously — the §2.2 ≥2/5 P4-P8 rule is enforced
    // pool-side + directive-side; this E2E test exercises the
    // render-side delivery on the cheap 1-of-5 P4 sample. A future
    // polish PR could widen this to walk all P4-P8 slots and assert
    // ≥2 carry the trap.
    const decAliasesCorrect = correct === CLASS_B_TRAP_VALUE
    const decAliasesOffByOne = Math.abs(CLASS_B_TRAP_VALUE - correct) === 1
    const decOutOfRange = CLASS_B_TRAP_VALUE < 0 || CLASS_B_TRAP_VALUE > 20
    const isCleanEligible =
      !decAliasesCorrect && !decAliasesOffByOne && !decOutOfRange

    test.skip(
      !isCleanEligible,
      `P4 fact ${minuend}-${subtrahend}=${correct} is not Class-B-CLEAN ` +
        `(DEC=${CLASS_B_TRAP_VALUE} aliases correct=${correct} or ` +
        `off-by-one). Spec §2.2 ≥2/5 rule is pool-side; this 1-of-5 ` +
        `sample is vacuously satisfied. Future polish: walk all P4-P8.`,
    )

    // Failing-first lever (post-Devon-merge): for a CLEAN P4 fact,
    // the chip row MUST contain `10` exactly once (the trap).
    // Count-based assertion per `feedback_count_assertions_on_regression_tests`
    // — avoids `.toContain` membership semantics that would allow
    // a duplicate `10` to pass for the wrong reason.
    const tenCount = valuesAtP4.filter((v) => v === CLASS_B_TRAP_VALUE).length
    expect(tenCount).toBe(1)

    // Correct answer must also be among the chips (sanity guard
    // against a degenerate render where no chip matches correct).
    const correctCount = valuesAtP4.filter((v) => v === correct).length
    expect(correctCount).toBe(1)
  })

  // ── Test 3 ─────────────────────────────────────────────────────────
  //
  // AC3 — no-borrow constraint: across all 8 problems in the session,
  //       NO read-line contains a BORROW operand pair (where
  //       ones-digit(minuend) < subtrahend per §1.1 NO-BORROW
  //       SELF-CHECK).
  //
  // RED-on-base lever (post-Kevin-merge): current main's
  // `sub-to-20.json` contains `Fourteen minus seven` at P6 and
  // `Eighteen minus nine` at P7 — both BORROW under the strict
  // procedural definition (`ones(14)=4 < 7`, `ones(18)=8 < 9`).
  // The substring filter below catches these. Post-Kevin's canon
  // re-bake under the new directive's NO-BORROW SELF-CHECK +
  // 22-fact pool, all borrow facts are excluded by construction.
  test.fixme('no-borrow — no session read-line contains a borrow operand pair', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    // 8-problem walk-through; size timeout per `testing-and-ci.md §4.1.1b`.
    test.setTimeout(240_000)

    await seedLocalStorage(page, {
      progress: buildSubToTwentySeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    const readLines = await readAllProblemReadLines(page)
    expect(readLines).toHaveLength(8)

    // For each forbidden borrow substring, count occurrences across
    // the full session and assert zero. Per
    // `feedback_count_assertions_on_regression_tests`: use exact
    // count, not `.toContain`-style membership. Each line is checked
    // against every forbidden substring; a hit increments the count.
    //
    // Reports the exact violating pair on failure (the .filter
    // result is informative enough for the dev to diagnose).
    const allText = readLines.join(' || ')
    const violations = FORBIDDEN_BORROW_READ_SUBSTRINGS.filter((sub) =>
      allText.includes(sub),
    )
    expect(violations).toEqual([])
  })

  // ── Test 4 ─────────────────────────────────────────────────────────
  //
  // AC4 — out-of-scope: when `focusNode === 'sub-to-10'` (NOT
  //       sub-to-20), the Class B (decade-anchor) trap value `DEC=10`
  //       does NOT appear on the chip row of any P4-P8 problem
  //       whose `correct` would invite it under sub-to-20's rules.
  //
  // Concretely: pick the first P4-P8 problem whose `correct` is in
  // [12, 18] (would be CLEAN-eligible under sub-to-20). Sub-to-10's
  // pool produces `correct ∈ [0, 9]`, so this pre-condition is
  // typically not satisfied in sub-to-10 sessions — and the test
  // is vacuous in the GREEN state. The structural assertion is
  // still meaningful: if a future bug accidentally widens
  // `decade-anchor` to sub-to-10 (e.g. `Math.tsx` mistakenly sets
  // `distractorClass = 'decade-anchor'` for sub-to-10 P4-P8), AND
  // a sub-to-10 fact produces `correct === 10` (the `10-x` family),
  // the trap might fire. We assert it does NOT.
  //
  // More direct OOS posture: just confirm sub-to-10 P1 renders
  // with the EXPECTED sub-to-10 operand range (correct ∈ [0, 9],
  // minuend ∈ [0, 10]) — not the teen-minuend range of sub-to-20.
  // This is the structural OOS gate: the trigger predicate is
  // tier-keyed, so the wrong tier should NOT produce sub-to-20
  // operands.
  //
  // Trivially-green on base today (Class B doesn't exist at all);
  // becomes a real regression-guard post-Devon-merge against a
  // wire-side widening bug.
  test.fixme('out-of-scope — sub-to-10 focus does NOT emit sub-to-20 minuends or DEC=10 traps', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(60_000)

    await seedLocalStorage(page, {
      progress: buildSubToTenSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Sub-to-10 minuend MUST NOT be in the sub-to-20 teen range.
    // Sub-to-10's pool has minuend ∈ [0, 10] (correct ∈ [0, 9]).
    const addendAText = await page.getByTestId('math-addend-a').textContent()
    expect(addendAText).not.toBeNull()
    const addendA = (addendAText ?? '').trim()
    expect(SUB_TO_20_MINUEND_SET.has(addendA)).toBe(false)

    // Sub-to-10 P1 chip row MUST NOT contain `10` as a Class-B-style
    // trap. Sub-to-10's canon doesn't produce `correct = 10` (max is
    // 10-0=10 — borderline; the pool typically uses 9 as the ceiling
    // per §1 of sub-to-10 spec). For any sub-to-10 fact with
    // `correct ≤ 9`, the off-by-one chip row is `[correct-1,
    // correct, correct+1]` — `10` only appears when `correct === 9`.
    // If the chip row contains `10` here, it must be the OFF-BY-ONE
    // legit chip, NOT a Class B trap. This is a coarse heuristic:
    // for the more direct gate, check correct first.
    const chips = page.locator('[data-testid="math-chip"]')
    await expect(chips).toHaveCount(3, { timeout: 15_000 })
    const handles = await chips.elementHandles()
    const values: number[] = []
    for (const h of handles) {
      const v = await h.getAttribute('data-value')
      if (v !== null) values.push(Number(v))
    }
    expect(values).toHaveLength(3)

    // If correct is 9, then off-by-one renders `10` legitimately.
    // For any other correct, `10` should not appear.
    const addendBText = await page.getByTestId('math-addend-b').textContent()
    const minuend = Number(addendA)
    const subtrahend = Number((addendBText ?? '').trim())
    const correct = minuend - subtrahend
    const tenCount = values.filter((v) => v === CLASS_B_TRAP_VALUE).length
    if (correct === 9) {
      // Off-by-one legit `10` is allowed (`correct + 1`).
      expect(tenCount).toBeLessThanOrEqual(1)
    } else {
      // `10` would only appear if Class B (decade-anchor) erroneously
      // fired in sub-to-10's tier. It must NOT.
      expect(tenCount).toBe(0)
    }
  })
})
