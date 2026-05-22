/**
 * E2E spec — `sub-to-20` content tier: trigger, Class B (decade-anchor
 * miss) distractor, no-borrow constraint, out-of-scope guard.
 *
 * Ticket: 86c9utcfx (Jessica, failing-first spec; original PR #271).
 * Follow-up ticket: 86c9uuqyt (this PR — full fixme-flip via focus-aware
 *   canon-bytes mock; closes the PR #275 partial-flip helper-deficiency
 *   gap on Tests 1, 2, 4).
 *
 * Paired implementation (now LANDED on `origin/main` at this PR's base):
 *   - Devon's PR #272 — `distractorClass: 'decade-anchor'` type-union
 *     widening + `decadeAnchorDistractors` algorithm + Math.tsx
 *     dispatch wiring on P4-P8.
 *   - Kevin's PR #273 — `extend compositionLint to sub-to-20`.
 *   - Kevin's PR #274 — `rebake sub-to-20 + activate
 *     lintSubToTwentyComposition binding`; current canon at
 *     `public/canon/math/level-1/sub-to-20.json` now satisfies §1.1
 *     no-borrow (P1=11-1=10, P2=12-2=10, P3=13-3=10, P4=14-2=12,
 *     P5=15-5=10, P6=15-3=12, P7=17-5=12, P8=18-6=12 — verified
 *     2026-05-17 against `public/canon/math/level-1/sub-to-20.json`).
 *
 * Spec authority: `design/math/sub-to-20-content.md` §1 (22-fact pool),
 * §2 (problem-mix rules), §3 (distractor classes), §6 (wire-up
 * checklist), §6.8 (test coverage minimums — AC list).
 *
 * ────────────────────────────────────────────────────────────────────
 * Closure of PR #275 helper-deficiency follow-up
 * ────────────────────────────────────────────────────────────────────
 *
 * PR #275 flipped Test 3 (no-borrow) to PASS but re-fixme'd Tests 1, 2,
 * 4 because the shared `beforeEach` used
 * `installClaudeMock(page, { failNetwork: true })`. Per the new
 * `[[testing-and-ci.md §4.2 failNetwork tier-asymmetry warning]]` and
 * §6 "`failNetwork` + structural assertion + wrong-tier static
 * fallback" (third drift entry, Jessica NOF from PR #275):
 * `pickStaticSessionPlan()` for any focusNode that is NOT `add-to-20`
 * falls through to the **add-to-10** rotation (`op: '+'`,
 * `correct ∈ [3,10]`). Tests asserting on `op: '-'`, teen-minuend
 * range, or `correct >= 10` for `sub-to-20` focus were structurally
 * unsatisfiable against the static fallback (deterministic RED).
 *
 * This PR replaces the shared `failNetwork: true` mock with
 * `installFocusAwareMathCanonClaudeMock(page)` — modelled on
 * `installMathCanonClaudeMock` from `sub-to-10-distractor-class-2.spec.ts`
 * but keyed on `payload.progress.focusNode` so each focus serves its
 * own committed canon JSON:
 *   - `focusNode === 'sub-to-20'` → `public/canon/math/level-1/sub-to-20.json`
 *   - `focusNode === 'sub-to-10'` → `public/canon/math/level-1/sub-to-10.json`
 *   - any other focus → 500 loudly (spec is scoped to sub tiers).
 *
 * With real Azure-rendered MP3 bytes serving the genuine canon for the
 * focus under test, Tests 1, 2, 4 become real RED-on-base ↔
 * GREEN-after-canon-rebake levers and pass cleanly post-#272/#273/#274.
 *
 * Concurrent change to discipline:
 *   - `forceHowlerUnlock` is REMOVED from `beforeEach` per
 *     `[[testing-and-ci.md §4.1.2]]` (the helper silently demotes ANY
 *     canonical-MP3 fixture path — including the real Azure bytes we
 *     are now serving — to the static-fallback plan, masking the
 *     regression). Empirically extended to placeholder MP3s in
 *     `[[feedback_force_howler_unlock_demote_extension]]`. Real
 *     Azure-rendered MP3s decode cleanly in headless chromium under
 *     the genuine gesture-unlock chain.
 *   - `skipOnWebkitHeadless(testInfo)` retained per the same §4.1.2
 *     guidance — WebKit headless still has no AudioContext.
 *   - Canon-landed gates added before any chip-walk so the assertions
 *     run against canon-served operands, not stale static-fallback DOM.
 *
 * ────────────────────────────────────────────────────────────────────
 * Coordination contract with Devon (ticket 86c9utcf7) — historical
 * ────────────────────────────────────────────────────────────────────
 *
 * This spec asserts behaviour observable at the chip-render surface —
 * specifically the `[data-testid="math-chip"]` set carried by
 * `[data-testid="math"]` per existing pattern (`Math.tsx:2462+2476`).
 * Devon's implementation (PR #272, now landed):
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
 *       P4-P8 problems when `focusNode === 'sub-to-20'` AND `op === '-'`
 *       AND `correct >= 10` (the chip-input-coupled-drift gate per
 *       `[[testing-and-ci.md §6 "Chip-input-coupled drift"]]` —
 *       Devon NOF from PR #272). Tighter than focusNode alone so the
 *       static-fallback add-to-10 path doesn't trigger the throw.
 *
 * **Testid contract.** No NEW testid is required for this spec — the
 * existing `math-chip` + `math-addend-a` + `math-addend-b` + `math`
 * (root) + `math-caption` testids suffice.
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
 *      When `focusNode === 'sub-to-10'` (different tier), the
 *      focus-aware mock serves the sub-to-10 canon, the rendered
 *      P1 minuend is NOT in sub-to-20's teen-range set, AND the
 *      structural pool envelope holds (minuend ∈ [0, 10],
 *      subtrahend ∈ [0, 9]). Direct Class-B-fire OOS coverage
 *      lives in `distractors.test.ts` unit tests on
 *      `decadeAnchorDistractors` + the wire-side gate predicate
 *      in `Math.tsx` — see Test 4's docstring for why a chip-row
 *      `10`-absence assertion is unreliable on sub-to-10 (gentle-
 *      tier extreme-pair includes `maxAnswer=10` legitimately,
 *      muddling the signal). Covered by Test 4.
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
 *     achievable CLEAN-count in P4-P8 is 4; minimum is 2). Current
 *     canon P4 = `14 - 2 = 12` (correct=12, DEC=10, NOT alias) —
 *     CLEAN-eligible.
 *   - Test 3 (AC3 no-borrow): asserts the read text of every problem
 *     does NOT contain any BORROW-pair substring. The pair set is
 *     derived from the §1.1 no-borrow definition (`ones-digit(a) < b`)
 *     — a structural rule, not a literal canon-content pin.
 *   - Test 4 (AC4 OOS gate): two structural assertions — sub-to-10
 *     minuend is NOT in the sub-to-20 teen-range set, AND chip row
 *     does NOT contain `10` as a Class-B-style trap (with the
 *     correct-equals-9 off-by-one carve-out).
 *
 * Where Test 2 needs to gate on P4 ordering (to confirm we're in the
 * discriminate tier, not gentle), it reads the `data-problem-index`
 * 0-based attribute on the `math` root per `testing-and-ci.md §4.1.3`
 * rule 5 — NOT `waitForTimeout`.
 *
 * Canon-landed gate (per `testing-and-ci.md §4.1.2`): each test waits
 * for `math-caption` text to actually populate before assertions.
 * Pinning specific operand strings (the canon-content-coupled drift
 * trap from §6) is avoided — the gate is "any caption text non-empty"
 * which survives commutative re-bakes.
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
 *
 * ────────────────────────────────────────────────────────────────────
 * Failing-first verification trail (CLASSIFIED per
 * [[feedback_progression_e2e_mandatory]] rule 8)
 * ────────────────────────────────────────────────────────────────────
 *
 *   - Test 1 (trigger renders): **RED-on-base lever** before #274 canon
 *     re-bake (pre-rebake canon P1 was `5 minus 2 = 3`, minuend `5`
 *     NOT in {11..19}). Post-#274 canon P1 is `Eleven minus one`,
 *     minuend=11, assertion passes. With the focus-aware mock, the
 *     spec serves the rebaked canon and the assertion goes GREEN.
 *
 *   - Test 2 (Class B fires at P4): **RED-on-base lever** before #272
 *     (decade-anchor class didn't exist). Post-#272 + #274 canon
 *     P4 = `14-2=12` (correct=12, DEC=10 in range, not alias), so
 *     the chip row contains `[10, 12, 13]` and the `expect(tenCount).
 *     toBe(1)` passes.
 *
 *   - Test 3 (no-borrow): **RED-on-base lever** before #274 (pre-#274
 *     canon contained `14-7=7` at P6, `18-9=9` at P7 — BORROW facts).
 *     Post-#274 the rebaked canon excludes all borrow facts by
 *     directive construction. Spec passes. NOTE: under PR #275 this
 *     test was flipped to PASS while still using `failNetwork: true`
 *     — trivially-green because the static-fallback add-to-10
 *     rotation never contains the `Fourteen minus seven` substring.
 *     This PR converts the test to NON-trivial GREEN: the focus-aware
 *     mock serves the rebaked sub-to-20 canon, and the assertion
 *     genuinely validates the no-borrow constraint against the
 *     sub-to-20 content (not coincidentally against an add-to-10
 *     plan that physically cannot contain borrow facts).
 *
 *   - Test 4 (out-of-scope on sub-to-10): **Regression-lock** —
 *     verifies that seeding `sub-to-10` focus serves sub-to-10 canon
 *     operands (minuend NOT in {11..19}) and the rendered pool
 *     envelope holds (minuend ∈ [0, 10], subtrahend ∈ [0, 9]). See
 *     Test 4's inline docstring for why this is the correct OOS
 *     gate and a chip-row `10`-absence assertion would be unreliable
 *     (sub-to-10's gentle-tier extreme-pair legitimately includes
 *     `maxAnswer = 10` for facts with sufficient gap, NOT because
 *     Class B fired).
 *
 * Per `[[feedback_count_assertions_on_regression_tests]]`, all
 * assertions use `.toEqual([...])` / `.toBe(N)` / `.toHaveCount(N)` /
 * `.filter(...).length === N` shapes. `.toContain` is avoided on
 * regression behaviour; the one membership-style read in Test 2
 * uses `.filter(...).length === 1` for exact-count guarantees.
 */

import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
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

// ── Focus-aware canon-bytes mock ─────────────────────────────────────────

/**
 * Paths to the math session canons we serve. Resolved from
 * `process.cwd()` because Playwright runs the harness from the
 * worktree root (same place `vite preview` reads `public/`). See
 * `[[testing-and-ci.md §4.1.3]]` "Canon-path resolution happens at
 * module-load via `process.cwd()`" for the established pattern from
 * `sub-to-10-distractor-class-2.spec.ts`.
 */
const SUB_TO_TWENTY_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/math/level-1/sub-to-20.json',
)
const SUB_TO_TEN_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/math/level-1/sub-to-10.json',
)

function readMathCanon(path: string): string {
  if (!existsSync(path)) {
    throw new Error(
      `[sub-to-20 spec] canon not found at ${path}. ` +
        `This canon is required for the focus-aware mock; do NOT swap ` +
        `to a silent-MP3 placeholder — per testing-and-ci.md §4.1.2 + ` +
        `§4.1.3 rule 3 the placeholder also fails decode under the ` +
        `stub-ctx, falls back to the static add-to-10 rotation, and ` +
        `silently masks the regression. See the file header.`,
    )
  }
  return readFileSync(path, 'utf-8')
}

/**
 * Install a `/api/claude` mock that serves the on-disk math canon
 * keyed on `payload.progress.focusNode`. Modelled on
 * `installMathCanonClaudeMock` in
 * `e2e/sub-to-10-distractor-class-2.spec.ts` but extends the dispatch
 * to switch canon body based on the request's focus node, so a single
 * `beforeEach` install covers all four tests in this spec (Tests 1-3
 * seed `sub-to-20` focus; Test 4 seeds `sub-to-10`).
 *
 * Per `[[testing-and-ci.md §4.2 failNetwork tier-asymmetry warning]]`
 * + §6 "`failNetwork` + structural assertion + wrong-tier static
 * fallback" (third drift entry, Jessica NOF from PR #275): the
 * `installClaudeMock(page, { failNetwork: true })` path falls through
 * to `pickStaticSessionPlan()` which returns add-to-10 problems for
 * any non-`add-to-20` focus. Tests asserting on `op: '-'`, teen
 * minuends, or `correct >= 10` are structurally unsatisfiable against
 * that fallback. This focus-aware mock fixes the tier asymmetry by
 * serving the correct canon JSON per focus.
 *
 * Behaviour:
 *   - `track === 'math'` + `focusNode === 'sub-to-20'` → serve
 *     `public/canon/math/level-1/sub-to-20.json`.
 *   - `track === 'math'` + `focusNode === 'sub-to-10'` → serve
 *     `public/canon/math/level-1/sub-to-10.json`.
 *   - `track === 'math'` + any other focus → 500 loudly (spec is
 *     scoped to sub tiers).
 *   - `track === 'word-song'` → 500 loudly. App.tsx catches and
 *     falls through to silent caption-walk on Hub's pre-warm fetch —
 *     this is the same behaviour the production word-song path takes
 *     on any outage, and doesn't affect Hub → Math navigation.
 *   - `OPTIONS` preflight → 204.
 *
 * Returns `{ requests }` for tests that want to inspect captured
 * request bodies (this spec doesn't, but kept for parity with the
 * sibling helpers).
 */
async function installFocusAwareMathCanonClaudeMock(
  page: Page,
): Promise<{ requests: Request[] }> {
  const subToTwentyBody = readMathCanon(SUB_TO_TWENTY_CANON_PATH)
  const subToTenBody = readMathCanon(SUB_TO_TEN_CANON_PATH)
  const requests: Request[] = []
  await page.route('**/api/claude', async (route: Route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    requests.push(req as unknown as Request)
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
    const progress = (payload.progress ?? {}) as Record<string, unknown>
    const focusNode = progress.focusNode as string | undefined
    if (track === 'math') {
      if (focusNode === 'sub-to-20') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: subToTwentyBody,
        })
        return
      }
      if (focusNode === 'sub-to-10') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: subToTenBody,
        })
        return
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'unexpected-focus-node',
          message: `sub-to-20 spec is sub-tier-only; saw focusNode=${String(focusNode)}`,
        }),
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
        message: `sub-to-20 spec is math-only; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

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
    // Read the rendered read-aloud line. `math-caption` is the
    // canonical testid for the visible caption text per
    // `Math.tsx:2273`; if it ever gets renamed this helper updates
    // along with the spec.
    const text = await page.getByTestId('math-caption').textContent()
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
    // Focus-aware canon-bytes mock — see helper docstring above for
    // the full rationale. Replaces the prior `installClaudeMock(page,
    // { failNetwork: true })` which violated `testing-and-ci.md §4.2`
    // tier-asymmetry (static-fallback add-to-10 rotation for any
    // non-add-to-20 focus).
    //
    // `forceHowlerUnlock` is intentionally NOT called — per
    // `testing-and-ci.md §4.1.2`, the helper silently demotes the
    // canon-bytes path to the static-fallback plan, masking the very
    // regression these tests guard. Real Azure-rendered MP3 bytes
    // decode cleanly under the genuine gesture-unlock chain in
    // headless chromium.
    await installFocusAwareMathCanonClaudeMock(page)
  })

  // ── Test 1 ─────────────────────────────────────────────────────────
  //
  // AC1 — trigger: seeded `sub-to-20` focus produces P1 read-line
  //       with minuend ∈ {11..19} (the §1.1 no-borrow teen-minuend
  //       constraint).
  //
  // CLASSIFICATION: RED-on-base lever (pre-#274). Current canon
  // (post-#274) places minuend=11 at P1; assertion passes. The
  // structural assertion `SUB_TO_20_MINUEND_SET.has(addendA)`
  // survives any §1.1-compliant re-bake.
  test('trigger — sub-to-20 P1 has minuend ∈ {11..19} (no-borrow teen)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(60_000)

    await seedLocalStorage(page, {
      progress: buildSubToTwentySeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('math-symbolic')).toBeVisible({
      timeout: 15_000,
    })

    // Canon-landed gate (per testing-and-ci.md §4.1.2) — wait for the
    // caption to actually populate before reading addends. The non-empty
    // caption text is the indication that the read-aloud effect has
    // landed on the canon plan rather than the static fallback. Avoid
    // pinning a specific caption substring per §6 canon-content-coupled
    // drift; "non-empty text" survives any re-bake.
    await expect
      .poll(
        async () =>
          ((await page.getByTestId('math-caption').textContent()) ?? '').trim()
            .length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0)

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
  // CLASSIFICATION: RED-on-base lever (pre-#272). On pre-#272 main
  // `distractorClass = 'decade-anchor'` is not in the union, so
  // `Math.tsx`'s P4-P8 dispatch can't request it. `pickDistractors`
  // falls through to `offByOneDistractors`, which emits
  // `[correct - 1, correct + 1]` — `10` only appears if `correct
  // ∈ {9, 11}`. Since §1.1's CLEAN pool keeps `correct ≥ 12`,
  // `10` would NEVER appear on the chip row pre-impl. Post-#272 +
  // #274, current canon P4 = `14-2=12`: chip row is
  // `{10, 12, 13}` and the assertion `tenCount === 1` passes.
  //
  // Structural pre-condition gate: BEFORE asserting `chips contain
  // 10`, read the rendered `correct` value at P4. If `correct` is
  // ALIAS (10 — aliases trap) or BOUNDARY (11 — off-by-one is also
  // 10) or out of range, skip the assertion as "the canon's P4 isn't
  // Class-B-CLEAN today; spec is satisfied vacuously". Keeps the
  // spec robust against a future re-bake that lands a non-CLEAN
  // fact at P4 — the §1.1 minimum CLEAN-count in P4-P8 is 2, but
  // exactly which slot they land at is Haiku's call.
  test('Class B fires at P4 when fact is CLEAN — chip row contains the DEC=10 trap', async ({
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

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Canon-landed gate — wait for caption to populate (read-aloud
    // landed on canon plan, not static fallback).
    await expect
      .poll(
        async () =>
          ((await page.getByTestId('math-caption').textContent()) ?? '').trim()
            .length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0)

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
  // CLASSIFICATION: RED-on-base lever (pre-#274). On pre-#274 main
  // `sub-to-20.json` canon contained `Fourteen minus seven` at P6
  // and `Eighteen minus nine` at P7 — both BORROW under the strict
  // procedural definition (`ones(14)=4 < 7`, `ones(18)=8 < 9`).
  // The substring filter below catches these. Post-#274's directive-
  // gated canon excludes all borrow facts by construction.
  //
  // NOTE: under PR #275 this test was flipped to PASS while still
  // using `failNetwork: true` — TRIVIALLY-GREEN because the static-
  // fallback add-to-10 rotation never contains the `Fourteen minus
  // seven` substring (op:'+' only). This PR converts it to NON-
  // trivial GREEN — the focus-aware mock serves the rebaked sub-to-
  // 20 canon, and the assertion now genuinely validates the no-
  // borrow constraint against the actual sub-to-20 content.
  test('no-borrow — no session read-line contains a borrow operand pair', async ({
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
  //       sub-to-20), the seeded focus serves sub-to-10 canon
  //       operands (minuend NOT in sub-to-20's teen-range set) AND
  //       the structural pool envelope (minuend ∈ [0, 10],
  //       subtrahend ∈ [0, 9]) holds across all 8 problems.
  //
  // CLASSIFICATION: Regression-lock. Under PR #275 this test was
  // re-fixme'd because `failNetwork: true` made BOTH sub-to-10 AND
  // sub-to-20 focus drive the same hardcoded add-to-10 static
  // fallback. The focus-aware mock fixes this by serving the real
  // sub-to-10 canon — current canon P1 = `5 - 5 = 0`, minuend=5
  // (NOT in teen range).
  //
  // Why no chip-row `10` assertion here:
  // ─────────────────────────────────────
  // An earlier draft of this test asserted `tenCount === 0` on the
  // P1 chip row. That assertion is unreliable for sub-to-10: the
  // gentle-tier distractor algorithm (`gentleDistractors` at
  // `distractors.ts`) returns the extremes `[minAnswer, maxAnswer]`
  // for any correct sufficiently far from both — and for sub-to-10
  // `maxAnswer = 10`, so `10` legitimately appears as a gentle-
  // extreme distractor for almost any P1 fact, NOT because Class B
  // fired. The sub-to-10-distractor-class-2.spec.ts file documents
  // this exact pitfall (gentleDistractors's natural extreme-pair
  // includes the `maxAnswer` value at the lower end of the correct
  // range). A `tenCount` assertion on sub-to-10 cannot distinguish
  // "gentle returned an extreme" from "Class B fired erroneously"
  // and is therefore wrong-tier coverage.
  //
  // Additionally, Devon's PR #272 wired Class B with a tighter
  // gate than focus-node alone: `focusNode === 'sub-to-20' &&
  // problem.op === '-' && problem.correct >= 10` (per `Math.tsx`
  // line ~2783, per testing-and-ci.md §6 "Chip-input-coupled
  // drift" — the gate is the fix Devon shipped). Sub-to-10's pool
  // tops correct at 10 (`10 - 0`), but current canon P1's correct
  // is 0 — the gate fails the `correct >= 10` arm even before the
  // focus-node arm. There is no observable Class-B-fire path
  // through sub-to-10 in the current implementation. Asserting
  // "Class B did not fire" via chip-row content on a path where
  // it's structurally precluded is the textbook trivially-green
  // assertion that proves nothing (per testing-and-ci.md §4.1.1d
  // trivially-green-trap rule + the recent third drift entry).
  //
  // Therefore: the OOS gate here is the SERVED-CANON structural
  // envelope. If the focus-aware mock served the wrong canon, or
  // a future bug widened sub-to-20's tier to sub-to-10 at the
  // canon-bake layer, the minuend-range assertion catches it.
  // Class-B-specific OOS coverage lives in `distractors.test.ts`
  // unit tests on `decadeAnchorDistractors` + Devon's gate
  // predicate — not at the E2E chip-render surface where the
  // signal is muddled by gentle-tier extremes.
  test('out-of-scope — sub-to-10 focus serves sub-to-10 canon (minuend NOT in teen range)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(60_000)

    await seedLocalStorage(page, {
      progress: buildSubToTenSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

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

    // Sub-to-10 minuend MUST NOT be in the sub-to-20 teen range.
    // Sub-to-10's pool has minuend ∈ [0, 10].
    const addendAText = await page.getByTestId('math-addend-a').textContent()
    expect(addendAText).not.toBeNull()
    const addendA = (addendAText ?? '').trim()
    expect(SUB_TO_20_MINUEND_SET.has(addendA)).toBe(false)

    // Sub-to-10 pool envelope: minuend ∈ [0, 10], subtrahend ∈ [0, 9].
    // Structural — survives sub-to-10 canon re-bakes that respect the
    // tier's published range.
    const addendBText = await page.getByTestId('math-addend-b').textContent()
    expect(addendBText).not.toBeNull()
    const minuend = Number(addendA)
    const subtrahend = Number((addendBText ?? '').trim())
    expect(minuend).toBeGreaterThanOrEqual(0)
    expect(minuend).toBeLessThanOrEqual(10)
    expect(subtrahend).toBeGreaterThanOrEqual(0)
    expect(subtrahend).toBeLessThanOrEqual(9)
  })
})
