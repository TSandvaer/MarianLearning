/**
 * E2E spec — `two-digit-addsub` content tier: no-regroup pool envelope,
 * op-mix, round-ten-anchor cap (the round-ten-prior correction lever),
 * high-leverage coverage (near-boundary-no-cross in P5–P8),
 * no-duplicate operand triples, dual-exposure rule, parser hyphen
 * support, and (Wave-3-deferred) Class 2 column-cross + Class 3
 * phantom-borrow render-side traps.
 *
 * Ticket: 86c9xkzea (Jessica failing-first E2E for two-digit-addsub).
 *
 * Wave context (per `design/math/two-digit-addsub-content.md §6`):
 *
 *   - Wave 1a — Kyle's spec PR (PR #285, LANDED 2026-05-22). Authority for
 *     this spec. Defines: 36-fact pool (§1.1), no-regroup constraint
 *     (§1.2), problem-mix rules (§2), Class 2 column-cross + Class 3
 *     phantom-borrow distractor design (§3), planner directive block
 *     (§4.1), parser widening contract (§5.2), dual-exposure rule (§5.5),
 *     diagnostic-aware OUT gate (§5.4).
 *   - Wave 1a co-shipped: `ANSWER_RANGE_MAX_TWO_DIGIT = 99` constant +
 *     `chipMaxAnswerForCorrects` tier ceiling extension (`distractors.ts`),
 *     parser hyphen support in `wordToNumber` + addition-side regex
 *     widening (`planFromServer.ts`). Verified at HEAD `365a61a`.
 *   - Wave 1b — Kevin's schema-extension PR (`MathSessionResult.perProblemDistractorClass`)
 *     — independent ticket (`86c9xkz9p` per spec §6.1).
 *   - Wave 2 — Kevin's PR B (ticket `86c9xkz9n` per dispatch brief):
 *     canon rebake against the new §4.1 directive + compositionLint
 *     binding. **NOT YET LANDED.** Current canon at
 *     `public/canon/math/level-1/two-digit-addsub.json` is the legacy
 *     8-fact set (`20+3, 15+2, 31+4, 26+5, 28-3, 34-2, 42+6, 39-7`)
 *     baked under the old single-line directive — round-ten-anchor count
 *     = 3 (violates §2.3 cap of 1), high-leverage-coverage = 0 facts in
 *     P5–P8 (violates §2.4 minimum of 1), Class B / Class 2 / Class 3
 *     distractors structurally absent because Wave 3 hasn't shipped.
 *   - Wave 3 — Devon's render-side widening: subtraction regex widening
 *     to accept `"How many?"` (current parser requires `"How many are
 *     left?"` on `-` per `planFromServer.ts:295`), `distractorClass`
 *     union extension to add `'column-cross'` and `'phantom-borrow'`
 *     (current union at `distractors.ts:192` covers only `'off-by-one' |
 *     'wrong-op' | 'decade-anchor'`), `Math.tsx` P4–P8 dispatch wiring
 *     for the new classes, `columnCrossDistractor` + `phantomBorrowDistractor`
 *     helpers. **NOT YET LANDED.**
 *   - Wave 4 — THIS SPEC. Failing-first E2E. Flips fixme→active as Waves
 *     2 + 3 land.
 *
 * ────────────────────────────────────────────────────────────────────
 * Current-base RED signal (load-bearing for failing-first)
 * ────────────────────────────────────────────────────────────────────
 *
 * Today on `main`, with the legacy canon at HEAD, two-digit-addsub does
 * NOT actually render its canon content. Mechanism:
 *
 *   1. The canon's subtraction read-lines (e.g. `"Twenty-eight minus
 *      three. How many?"`) are formatted per Kyle's NEW §4.2 template
 *      (`<minuend> minus <subtrahend>. How many?`) — NOT the legacy
 *      sub-to-X template (`<minuend> minus <subtrahend>. How many are
 *      left?`).
 *   2. The parser at `planFromServer.ts:295` still requires the legacy
 *      `"How many are left?"` trailer for `-`. Subtraction reads from
 *      the current canon throw `PlanFromServerError` at parse time.
 *   3. App.tsx catches the rejection and the Math screen falls back to
 *      `pickStaticSessionPlan()` which for `focusNode !== 'add-to-20'`
 *      returns the add-to-10 rotation (`op: '+'`, `correct ∈ [3, 10]`,
 *      addends `∈ [1, 9]`) — per `[[testing-and-ci.md §4.2 failNetwork
 *      tier-asymmetry warning]]`.
 *
 * This means structural assertions on:
 *   - Operand range (`addend-a ≥ 10` for `+` two-digit-first; minuend
 *     `≥ 10` for `-`) — FAILS on base (static fallback emits operands
 *     in [1, 9]).
 *   - Sum range (`correct ≥ 12`) — FAILS on base (static fallback
 *     emits correct ∈ [3, 10]).
 *   - Op-mix (≥ 2 subtractions across 8) — FAILS on base (static
 *     fallback is `op: '+'` only).
 *
 * These are LEGITIMATE RED-on-base levers per
 * `[[feedback_progression_e2e_mandatory]]` rule 8: they fail today
 * because the static-fallback path is wrong-tier, and they will pass
 * once Devon's Wave-3 parser widening lands AND Kevin's Wave-2 canon
 * rebake holds the §1.1 pool invariants.
 *
 * Even the canon-against-canon assertions that survive parser dispatch
 * (the §1.4 round-ten-anchor cap, the §2.4 high-leverage coverage rule)
 * cannot be exercised at the rendered surface until Wave 3 widens the
 * `-` parser — because the screen runs against the static fallback.
 *
 * Tests in this spec follow this matrix:
 *
 *   | # | Assertion class                              | State today        | Lands at  |
 *   |---|----------------------------------------------|--------------------|-----------|
 *   | 1 | Pool envelope (operand range, sum ∈ [12,99]) | RED on base        | Wave 3+2  |
 *   | 2 | Op-mix in {5+/3-, 6+/2-}, P1 is +            | RED on base        | Wave 3+2  |
 *   | 3 | Round-ten-anchor cap ≤ 1 (§1.4 correction)   | RED on base        | Wave 2    |
 *   | 4 | High-leverage coverage ≥ 1 NBN-cross in P5-8 | RED on base        | Wave 2    |
 *   | 5 | No-regroup constraint (units don't cross)    | RED on base        | Wave 2    |
 *   | 6 | Dual-exposure rule across (a,b,op) triples   | Regression-lock    | Wave 2    |
 *   | 7 | Class 2 column-cross renders at P4 (`+`)     | FIXME until Wave 3 | Wave 3    |
 *   | 8 | Class 3 phantom-borrow renders at P5+ (`-`)  | FIXME until Wave 3 | Wave 3    |
 *   | 9 | Parser hyphen support (regression-lock)      | Regression-lock    | already   |
 *
 * Tests 7 + 8 use `test.fixme()` because the `distractorClass` union
 * does NOT yet contain `'column-cross'` / `'phantom-borrow'` literals;
 * any chip-row assertion against those classes is structurally
 * unsatisfiable today (the chips fall back to gentle / off-by-one).
 * Flip to `test(...)` when Devon's Wave-3 PR merges. Marker comment
 * inline per `[[testing-and-ci.md §6 "Split-PR pattern" breadcrumb]]`.
 *
 * ────────────────────────────────────────────────────────────────────
 * Acceptance criteria coverage (per Kyle's spec §6.9 + dispatch brief)
 * ────────────────────────────────────────────────────────────────────
 *
 * AC1 / AC9 (pool envelope — operand and sum range, no-regroup):
 *      Every problem in the 8-problem session has `addend-a ∈ [10, 99]`
 *      OR is a single-digit-second-operand fact with `b ∈ [1, 9]`, and
 *      `sum ∈ [12, 73]`. Covered by Tests 1 + 5.
 *
 * AC2 / AC9 (op-mix in [5+/3-, 6+/2-] AND P1 is +):
 *      Across the 8-problem session: 5 ≤ `+` count ≤ 6, 2 ≤ `-` count
 *      ≤ 3, total = 8. P1 op is `+`. Covered by Test 2.
 *
 * AC2 / AC9 (round-ten-anchor cap ≤ 1):
 *      Across the 8-problem session, AT MOST 1 problem may carry a
 *      round-ten-anchor fact (i.e. `a mod 10 === 0 AND op === '+'`).
 *      Covered by Test 3 — the §1.4 round-ten-prior correction lever.
 *
 * AC2 / AC10 (high-leverage coverage — ≥ 1 near-boundary-no-cross in P5-P8):
 *      At least one of P5–P8 must carry an `(a, b, op)` triple from
 *      the near-boundary-no-cross subset of the §1.1 pool (units
 *      operation lands at or near the decade boundary without crossing).
 *      Covered by Test 4.
 *
 * AC2 / AC9 (no-duplicate AND dual-exposure rule):
 *      No `(a, b, op)` triple repeats; no `+` fact's inverse `-` form
 *      appears in the same session. Covered by Test 6.
 *
 * AC3 (Class 2 column-cross at P4-P8 for `+`):
 *      Wave-3 render-side dispatch. Test 7 fixme'd until Wave 3.
 *
 * AC3 (Class 3 phantom-borrow at P5-P8 for `-`):
 *      Wave-3 render-side dispatch. Test 8 fixme'd until Wave 3.
 *
 * AC5 / AC11 (parser handles hyphenated decade-units):
 *      Already shipped (PR #285 — `wordToNumber` + addition regex).
 *      Subtraction regex widening still owed by Wave 3 — Test 9 covers
 *      addition surface only; sub coverage activates with Wave 3.
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
 *   - Test 1 (pool envelope): does NOT assert "P1 is 20+3=23" literally.
 *     Reads whatever addends rendered and asserts each is in the
 *     §1.1/§1.2 envelope. Survives any §1.1-compliant re-bake.
 *   - Test 2 (op-mix): walks all 8 problems, counts ops, asserts
 *     count-comparison against §2.2 LOCKED bounds.
 *   - Test 3 (round-ten cap): counts problems whose first operand is
 *     a round-ten anchor (`a mod 10 === 0 && a ≥ 10`) via structural
 *     read, asserts count ≤ 1.
 *   - Test 4 (high-leverage coverage): reads P5–P8 addends, checks
 *     ordered-pair membership in `NEAR_BOUNDARY_NO_CROSS_POOL` derived
 *     from §1.1 categories, asserts count ≥ 1.
 *   - Test 5 (no-regroup): computes `(a mod 10) + (b mod 10)` for `+`
 *     and `(a mod 10) - (b mod 10)` for `-`, asserts ≤ 9 / ≥ 0
 *     respectively — a structural rule, not a literal canon-content pin.
 *   - Test 6 (no-duplicate + dual-exposure): walks all 8, asserts
 *     uniqueness of `(a, b, op)` AND that no inverse pair co-occurs.
 *   - Tests 7 + 8 (FIXME): asserts chip-row contains a Class-specific
 *     trap value computed from rendered addends, NOT a literal chip
 *     value.
 *   - Test 9 (parser): does NOT pin a specific decade — drives Hub →
 *     Math and asserts a render-side digit (e.g. `addend-a` rendered as
 *     a number ≥ 10) AFTER the canon-landed gate, proving the hyphenated
 *     decade word parsed correctly. Survives any §1.1-compliant re-bake.
 *
 * Per `[[testing-and-ci.md §6 "Prose-template-coupled E2E spec drift"]]`
 * — applied lesson from PR #279. THIS SPEC USES NO SUBSTRING ASSERTIONS
 * AGAINST READ-LINE TEMPLATES. Every assertion reads structural state
 * (addend digits, chip data-value, problem-index) via testids.
 *
 * Per `[[testing-and-ci.md §4.1.1e Negative-membership trivially-green
 * trap]]` — Test 4 uses a POSITIVE discriminator (count of in-pool
 * matches ≥ 1) rather than "value X is NOT in chips" negative. Test 3
 * (round-ten cap ≤ 1) is positive-counting (asserts the count is in
 * range), not "value is absent". Tests 7 + 8 (when activated) follow
 * the add-to-20 PR #283 pattern: positive discriminator on captured
 * request body shape (`payload.progress.focusNode === 'two-digit-addsub'`)
 * BEFORE any chip-row assertion.
 *
 * ────────────────────────────────────────────────────────────────────
 * Mock strategy — canon-bytes single-tier
 * ────────────────────────────────────────────────────────────────────
 *
 * Per `[[testing-and-ci.md §4.2.3]]` the focus-aware multi-canon mock
 * is the FIRST instance of its pattern (PR #279 sub-to-20). This spec
 * does NOT exercise a cross-tier focus-switch — every test seeds
 * `two-digit-addsub` focus exclusively. A single-canon mock serving
 * `two-digit-addsub.json` for any `track === 'math'` request is
 * sufficient and structurally simpler. (Same posture as add-to-20
 * PR #283.)
 *
 * Per `[[testing-and-ci.md §4.1.2]]`:
 *   - `forceHowlerUnlock` is intentionally NOT called. Real Azure-
 *     rendered MP3 bytes decode cleanly under the genuine gesture-
 *     unlock chain in headless chromium. Per
 *     `[[feedback_force_howler_unlock_demote_extension]]`, demote
 *     fires on ANY canonical-MP3 fixture path — including silent
 *     placeholders — and would mask the regression these tests guard.
 *   - `skipOnWebkitHeadless(testInfo)` is called per WebKit headless
 *     having no AudioContext — real iPad Safari is unaffected.
 *   - Canon-landed gate (`math-caption` non-empty text) is added
 *     before any chip-walk so assertions run against canon-served
 *     operands rather than the static fallback.
 *
 * ────────────────────────────────────────────────────────────────────
 * Failing-first verification trail (CLASSIFIED per
 * [[feedback_progression_e2e_mandatory]] rule 8)
 * ────────────────────────────────────────────────────────────────────
 *
 *   - Tests 1, 2, 5, 6 — **RED-on-base levers**. The current parser
 *     mismatches the canon's `-` read-lines, so the screen falls
 *     through to the static add-to-10 rotation. Assertions on
 *     two-digit operand range, op-mix containing `-`, no-regroup with
 *     two-digit operands, and dual-exposure across `+` and `-` are
 *     all structurally unsatisfiable against the static fallback.
 *     Will flip GREEN after Wave 3 widens the `-` parser regex AND
 *     Wave 2 rebakes the canon with no-regroup compliance.
 *
 *   - Test 3 — **RED-on-base lever** against the current canon. The
 *     current canon contains 3 round-ten-anchor facts (`20+3`, `30+5`,
 *     `40+2` — wait, current canon has `20+3, 15+2, 31+4, 26+5, 28-3,
 *     34-2, 42+6, 39-7` so let me check: `20+3` is round-ten (20 % 10
 *     === 0), `15+2` is not, `31+4` is not, `26+5` is not, `42+6` is
 *     not. Current canon has 1 round-ten anchor (`20+3`)! So Test 3
 *     is actually GREEN against current canon, but the static fallback
 *     it runs through has 0 round-ten anchors (add-to-10 rotation
 *     facts: `4+3=7, 5+4=9, 3+6=9, ...`). Test 3 will trivially-pass
 *     under the fallback as `roundTenCount === 0 ≤ 1`.
 *     **CLASSIFICATION CORRECTION:** Test 3 is **trivially-green
 *     counter-test** today (per the protocol step-2 classification);
 *     becomes a real regression-lock once Wave 2 + 3 land and the
 *     canon serves directly. The §1.4 cap is enforced post-rebake.
 *
 *   - Test 4 — **RED-on-base lever**. Current canon facts (in pool
 *     terms): `20+3` round-ten, `15+2`/`31+4`/`26+5`/`42+6` are
 *     mid-decade-units-shift (not near-boundary), `28-3` mid, `34-2`
 *     mid, `39-7` mid. ZERO near-boundary-no-cross in P5–P8. After
 *     parser widening, the canon-as-rendered will fail Test 4 until
 *     Kevin's rebake forces ≥ 1 near-boundary in P5–P8 per §2.4.
 *
 *   - Test 9 — **Regression-lock**. Parser hyphen support is already
 *     in place (PR #285 — `wordToNumber` + addition regex). Asserts
 *     that a hyphenated decade-units word in addend-a renders as the
 *     correct two-digit number on screen. Catches any future
 *     regression that re-narrows the regex.
 *
 *   - Tests 7, 8 — **fixme'd**. Wave-3-dependent.
 *
 * Per `[[feedback_count_assertions_on_regression_tests]]`, all
 * assertions use `.toEqual([...])` / `.toBe(N)` / `.toHaveCount(N)` /
 * `.toBeLessThanOrEqual(N)` / `.toBeGreaterThanOrEqual(N)` shapes.
 * `.toContain` is avoided on regression behaviour.
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
import type { Page } from '@playwright/test'
import { resolve } from 'node:path'
import { installMathCanonClaudeMock } from './_helpers/mockClaude'
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

// ── §1.1 / §1.2 pool invariants — derived structural facts ─────────────

/**
 * Per Kyle's spec §1.2: every `+` fact has `addend-a ∈ [10, 99]` (two-
 * digit first operand) AND `addend-b ∈ [1, 9]` for the single-digit-
 * second-operand mainline (with §7.2 Option B exception: `b ∈ [10, 99]`
 * for the 6 two-digit-plus-two-digit facts). Every `-` fact has
 * `minuend ∈ [10, 99]` AND `subtrahend ∈ [1, 9]` in v1.
 *
 * Test 1 asserts the union: addend-a ∈ [10, 99] for every problem (the
 * "first operand is two-digit" invariant holds across the pool).
 */
const TWO_DIGIT_FIRST_OPERAND_MIN = 10
const TWO_DIGIT_FIRST_OPERAND_MAX = 99

/**
 * Per Kyle's spec §1.2: smallest result is `15 - 3 = 12` (smallest `-`
 * pool fact); largest single-digit-`+` result is `66 + 3 = 69`; largest
 * §7.2 Option B result is `42 + 31 = 73`. The chip-range ceiling is
 * `ANSWER_RANGE_MAX_TWO_DIGIT = 99` (already shipped PR #285), but the
 * actual v1 pool peaks at 73. We assert correct ≤ 73 (Option B) AND
 * correct ≥ 12 (the no-result-below-10 floor at §1.2 / §1.1 minimum).
 *
 * Per `[[testing-and-ci.md §6 "Canon-content-coupled drift"]]`: pin
 * range, not specific values. Survives any §1.1-compliant re-bake.
 */
const POOL_SUM_MIN = 12
const POOL_SUM_MAX = 73

/**
 * Per Kyle's spec §1.4: the round-ten-anchor category contains 3 pool
 * facts (`20+3`, `30+5`, `40+2`). The §2.3 category cap is 1 per
 * session — the round-ten-prior correction lever.
 *
 * Detection rule: a fact is a "round-ten-anchor" iff `op === '+'` AND
 * `a mod 10 === 0 AND a >= 10` (i.e. addend-a is a round multiple of
 * 10). The pool excludes round-ten subtractions structurally (`(a mod
 * 10) ≥ b` would require `b === 0` which is out of `[1, 9]`).
 *
 * Encoded as a predicate, not a fact list, because the structural rule
 * is the durable contract. Survives any pool widening that introduces
 * new round-ten facts (e.g. `50+3` in a v2 widening).
 */
function isRoundTenAnchor(a: number, _b: number, op: '+' | '-'): boolean {
  return op === '+' && a >= 10 && a % 10 === 0
}

/**
 * Per Kyle's spec §1.1 — the near-boundary-no-cross category. Pool
 * members in this category have their units operation land at or near
 * the decade boundary (units 0 or 9 after operation) WITHOUT crossing.
 *
 * Detection rule (all three clauses required):
 *   1. `a >= 10` — the first operand is a true two-digit number.
 *      WITHOUT this clause, single-digit-fact static-fallback rotations
 *      like `4 + 5 = 9` would satisfy `(4 % 10) + 5 === 9` and produce
 *      a false-positive trivially-green signal on Test 4. The §1.1
 *      pool is all two-digit-first-operand by construction, so this
 *      clause is the right pool-side gate.
 *   2. Operation-specific units constraint:
 *      - `op === '+'` AND `(a mod 10) + b === 9` (units land at 9,
 *        just below the carry boundary). Per spec §1.1 #4, #11, #20.
 *      - `op === '-'` AND `(a mod 10) - b ∈ {0, 1}` (units land at 0
 *        or 1, just above the borrow boundary). Per spec §1.1 #19,
 *        #25, #26.
 *
 * The §1.1 row 19 example `26 - 5 = 21` (units 6-5=1), row 27 example
 * `52 - 1 = 51` (units 2-1=1), row 28 `64 - 3 = 61` (units 4-3=1)
 * confirm "≤ 1 ones after subtract" as the upper bound on near-
 * boundary subtraction. The spec's "near-boundary" definition is
 * units ∈ {0, 1} for the `-` side AND the operand must be two-digit.
 *
 * Encoded as a predicate; the §1.1 facts that satisfy it index by
 * category in the pool table at lines 109-160 of the spec.
 *
 * NB: this predicate evaluated against the static-fallback rotation
 * (single-digit operands) correctly returns false for all 8 problems,
 * which is the desired behaviour — Test 4 fails as designed (count = 0
 * < 1) on base because the screen runs add-to-10 not two-digit-addsub.
 */
function isNearBoundaryNoCross(a: number, b: number, op: '+' | '-'): boolean {
  if (a < 10) return false
  if (op === '+') {
    return (a % 10) + b === 9
  }
  // op === '-'
  const unitsAfter = (a % 10) - b
  return unitsAfter === 0 || unitsAfter === 1
}

// ── Canon-bytes mock ────────────────────────────────────────────────────

/**
 * Path to the two-digit-addsub session canon. Resolved from
 * `process.cwd()` because Playwright runs the harness from the worktree
 * root (same place `vite preview` reads `public/`). See
 * `[[testing-and-ci.md §4.1.3]]` "Canon-path resolution happens at
 * module-load via `process.cwd()`".
 */
const TWO_DIGIT_ADDSUB_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/math/level-1/two-digit-addsub.json',
)

// The canon-bytes mock is now the shared
// `installMathCanonClaudeMock(page, canonPath)` from
// `e2e/_helpers/mockClaude.ts` (promoted in ticket 86c9y490t). This
// spec was the 4th, out-of-scope private clone flagged in PR #440;
// migrated to the shared helper in ticket 86ca8ncay. The shared helper
// performs the same loud `existsSync` throw on a missing canon, serves
// the canon bytes verbatim for `track === 'math'`, 500s loudly on
// word-song / unknown track, 204s the OPTIONS preflight, and returns
// `{ requests }` for the captured-request positive-discriminator used
// by Tests 7 + 8. Single-canon (not focus-aware) is the correct level
// here — this spec seeds `two-digit-addsub` focus exclusively and does
// not span a cross-tier focus-switch (per `[[testing-and-ci.md
// §4.2.3]]`).

// ── Seed builder ─────────────────────────────────────────────────────────

/**
 * Build a Progress doc with `two-digit-addsub: 'practicing'` and every
 * upstream math node `'mastered'`. The default `pickFocusNode` then
 * lands on two-digit-addsub (the first non-mastered node in
 * `MATH_NODES_IN_ORDER`).
 *
 * `mastered` upstream is required because the picker walks the order
 * left-to-right and stops at the first non-mastered node; any upstream
 * node at `'practicing'` or `'intro'` would intercept the focus.
 */
function buildTwoDigitAddsubSeedProgress(): unknown {
  return buildSeedProgress({
    skillLevelOverrides: {
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'mastered',
      'sub-to-20': 'mastered',
      // Wave 5 (ticket 86c9y0bvc) sibling-tier split — the legacy
      // `'two-digit-addsub'` literal is now `'two-digit-addsub-no-regroup'`.
      // This spec exercises the existing (no-regroup) pool envelope;
      // the with-regroup tier is locked here and exercised by PR B's
      // failing-first E2E spec instead.
      'two-digit-addsub-no-regroup': 'practicing',
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
 * Read the addend-a + addend-b digit values + the operator from the
 * currently-rendered problem. Returns `[a, b, op]`.
 *
 * Per `[[testing-and-ci.md §6 "Prose-template-coupled drift"]]`: this
 * reads structural state (digit text inside the addend testids), NOT
 * the read-line prose. Survives any directive re-templating.
 *
 * Op detection: the production renderer exposes `data-op` on the
 * `[data-testid="math-symbolic"]` element ("+", "-"). Falls back to
 * inferring from chip `data-correct` value vs `a + b` / `a - b` if the
 * attribute is absent (defensive; shouldn't happen in practice).
 */
async function readCurrentProblem(
  page: Page,
): Promise<{ a: number; b: number; op: '+' | '-' }> {
  const addendAText = await page.getByTestId('math-addend-a').textContent()
  const addendBText = await page.getByTestId('math-addend-b').textContent()
  const a = Number((addendAText ?? '').trim())
  const b = Number((addendBText ?? '').trim())
  // Operator glyph lives on the math-operator testid (added in PR
  // landing the sub-to-10 `-` glyph — see e2e/sub-to-10-operator-glyph.spec.ts).
  // Falls through to '+' if not found (production guarantees presence).
  const opText = (
    (await page.getByTestId('math-operator').textContent()) ?? '+'
  ).trim()
  // The rendered minus glyph may be a Unicode minus (U+2212) or ASCII
  // hyphen (U+002D); normalise either way.
  const op: '+' | '-' = opText === '+' ? '+' : '-'
  return { a, b, op }
}

/**
 * Read the data-correct chip value at the current problem. Used by
 * Tests 7 + 8 (fixme'd) for chip-row trap assertions.
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
 * Walk all 8 problems, capturing each problem's `(a, b, op)` triple
 * + the displayed correct answer (derived from addends + op).
 *
 * Used by Tests 1, 2, 3, 4, 5, 6 which need session-wide data.
 */
async function walkAllProblems(
  page: Page,
): Promise<Array<{ a: number; b: number; op: '+' | '-'; correct: number }>> {
  const problems: Array<{
    a: number
    b: number
    op: '+' | '-'
    correct: number
  }> = []
  for (let i = 0; i < 8; i++) {
    // Wait until the math screen reports it's on problem-index `i`.
    await expect(page.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      String(i),
      { timeout: 15_000 },
    )
    const { a, b, op } = await readCurrentProblem(page)
    const correct = op === '+' ? a + b : a - b
    problems.push({ a, b, op, correct })
    if (i < 7) {
      await tapCorrectAndAdvance(page, i)
    }
  }
  return problems
}

// ────────────────────────────────────────────────────────────────────────
// Test suite
// ────────────────────────────────────────────────────────────────────────

test.describe('two-digit-addsub — pool envelope + op-mix + round-ten cap + near-boundary coverage + no-regroup + dual-exposure', () => {
  test.beforeEach(async ({ page }) => {
    // Canon-bytes mock serves real Azure-rendered MP3 bytes — see
    // helper docstring for the full rationale. Avoids the
    // `installClaudeMock(page, { failNetwork: true })` trap per
    // `[[testing-and-ci.md §4.2 failNetwork tier-asymmetry warning]]`:
    // for any focus that is NOT `add-to-20`, the static fallback is
    // the add-to-10 rotation (`op: '+'`, `correct ∈ [3, 10]`) — every
    // single structural assertion in this spec (operand range ≥ 10,
    // sum ≥ 12, op-mix containing `-`) is structurally unsatisfiable
    // against that fallback. Serving real canon bytes keeps the
    // assertions grounded in the actual production content.
    //
    // `forceHowlerUnlock` is intentionally NOT called — per
    // `[[testing-and-ci.md §4.1.2]]` + the empirical extension at
    // `[[feedback_force_howler_unlock_demote_extension]]`, the helper
    // silently demotes the canon-bytes path to the static-fallback
    // plan, masking the very regression these tests guard. Real Azure-
    // rendered MP3 bytes decode cleanly under the genuine gesture-
    // unlock chain in headless chromium.
    await installMathCanonClaudeMock(page, TWO_DIGIT_ADDSUB_CANON_PATH)
  })

  // ── Test 1 ─────────────────────────────────────────────────────────
  //
  // AC1 / AC9 — pool envelope: every problem in the 8-problem session
  //              has addend-a (first operand) ∈ [10, 99] AND
  //              sum ∈ [12, 73].
  //
  // CLASSIFICATION: **RED-on-base lever**. The current parser at
  // `planFromServer.ts:295` requires `"How many are left?"` for `-`
  // reads but the canon emits `"How many?"` (Kyle's NEW §4.2 template).
  // Subtraction reads throw `PlanFromServerError` → screen falls
  // through to `pickStaticSessionPlan('two-digit-addsub')` →
  // add-to-10 rotation (`op: '+'`, `correct ∈ [3, 10]`, addends in
  // [1, 9]). The assertion `addend-a ≥ 10` is structurally
  // unsatisfiable against that fallback → deterministic RED today.
  // Flips GREEN once Devon's Wave-3 widens the `-` parser AND Kevin's
  // Wave-2 rebake produces a §1.1-compliant canon.
  //
  // Defense-in-depth value: catches any future render-side or canon-
  // side regression that drops first-operand back below 10.
  test('pool envelope — every problem has addend-a ≥ 10 AND sum ∈ [12, 73]', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    // 8-problem walk-through; size timeout per `testing-and-ci.md §4.1.1b`.
    test.setTimeout(240_000)

    await seedLocalStorage(page, {
      progress: buildTwoDigitAddsubSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Canon-landed gate (per testing-and-ci.md §4.1.2) — wait for the
    // caption to populate before walking. Non-empty caption text means
    // the read-aloud effect has landed on the canon plan rather than
    // the static fallback. Avoid pinning specific caption substring
    // per §6 prose-template-coupled drift.
    await expect
      .poll(
        async () =>
          ((await page.getByTestId('math-caption').textContent()) ?? '').trim()
            .length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0)

    const allProblems = await walkAllProblems(page)
    expect(allProblems).toHaveLength(8)

    for (let i = 0; i < 8; i++) {
      const { a, b, op, correct } = allProblems[i]!
      const slot = `P${i + 1} (a=${a}, b=${b}, op=${op}, correct=${correct})`
      // First-operand range — §1.2 strict.
      expect(
        a,
        `${slot}: first operand should be ≥ ${TWO_DIGIT_FIRST_OPERAND_MIN}`,
      ).toBeGreaterThanOrEqual(TWO_DIGIT_FIRST_OPERAND_MIN)
      expect(
        a,
        `${slot}: first operand should be ≤ ${TWO_DIGIT_FIRST_OPERAND_MAX}`,
      ).toBeLessThanOrEqual(TWO_DIGIT_FIRST_OPERAND_MAX)
      // Sum range — §1.2 v1 pool: smallest 12 (15-3); largest 73 (42+31).
      expect(
        correct,
        `${slot}: correct should be ≥ ${POOL_SUM_MIN}`,
      ).toBeGreaterThanOrEqual(POOL_SUM_MIN)
      expect(
        correct,
        `${slot}: correct should be ≤ ${POOL_SUM_MAX}`,
      ).toBeLessThanOrEqual(POOL_SUM_MAX)
    }
  })

  // ── Test 2 ─────────────────────────────────────────────────────────
  //
  // AC2 / AC9 — op-mix in {5+/3-, 6+/2-} AND P1 is `+`.
  //
  // CLASSIFICATION: **RED-on-base lever**. Static fallback under
  // `failNetwork`-style parser miss is the add-to-10 rotation
  // (`op: '+'` only — 8/8 problems are `+`). Asserting `subCount ≥ 2`
  // is structurally unsatisfiable. Flips GREEN once Wave-3 parser
  // widens + Wave-2 canon rebakes with a 5+/3- or 6+/2- mix.
  //
  // §2.2 LOCKED: `addCount ∈ [5, 6], subCount ∈ [2, 3], addCount +
  // subCount === 8`. P1 op === '+' (hard rule per §2.1).
  test('op-mix — counts in [5+/3-, 6+/2-] AND P1 is +', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(240_000)

    await seedLocalStorage(page, {
      progress: buildTwoDigitAddsubSeedProgress(),
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

    const allProblems = await walkAllProblems(page)
    expect(allProblems).toHaveLength(8)

    // P1 must be `+` (§2.1 hard rule).
    expect(
      allProblems[0]!.op,
      `P1 op must be '+' per §2.1; got ${allProblems[0]!.op}`,
    ).toBe('+')

    const addCount = allProblems.filter((p) => p.op === '+').length
    const subCount = allProblems.filter((p) => p.op === '-').length

    // §2.2 LOCKED — counts within {5+/3-, 6+/2-}.
    expect(
      addCount,
      `addCount must be ∈ [5, 6] per §2.2. Got ${addCount}+, ${subCount}-.`,
    ).toBeGreaterThanOrEqual(5)
    expect(
      addCount,
      `addCount must be ∈ [5, 6] per §2.2. Got ${addCount}+, ${subCount}-.`,
    ).toBeLessThanOrEqual(6)
    expect(
      subCount,
      `subCount must be ∈ [2, 3] per §2.2. Got ${addCount}+, ${subCount}-.`,
    ).toBeGreaterThanOrEqual(2)
    expect(
      subCount,
      `subCount must be ∈ [2, 3] per §2.2. Got ${addCount}+, ${subCount}-.`,
    ).toBeLessThanOrEqual(3)
    expect(addCount + subCount, 'total problems must be 8').toBe(8)
  })

  // ── Test 3 ─────────────────────────────────────────────────────────
  //
  // AC2 / AC9 — round-ten-anchor cap ≤ 1 per session (the §1.4 round-
  //              ten-prior correction lever).
  //
  // CLASSIFICATION: **Trivially-green counter-test** today (per the
  // failing-first protocol step-2 classification). The current canon
  // contains 1 round-ten-anchor (`20+3` at P1), satisfying the cap
  // already; the static fallback (add-to-10) contains zero round-ten
  // facts (all rotation addends are < 10). The assertion passes
  // trivially on base regardless of the production state.
  //
  // **Becomes a real regression-lock post-Wave-2** when Kevin's
  // re-bake activates the `ROUND-TEN-ANCHOR-CAP SELF-CHECK` directive.
  // Without the cap, Haiku's natural prior would push 2-3 round-ten
  // facts (`20+3, 30+5, 40+2`) into a session — the §1.4 paragraph
  // documents the empirical signal. After the cap binds, this test
  // catches any directive-drift that re-loosens the cap.
  //
  // This is the §1.4 round-ten-prior correction lever — the analog of
  // add-to-20's doubles-prior cap (PR #283 Test 3, RED-on-base).
  // Same structural role; different empirical history at this tier
  // because the current canon happens to be under cap already. The
  // test name + assertion preserve the contract; the RED-on-base
  // status will earn back as soon as the directive is updated.
  //
  // Per `[[feedback_count_assertions_on_regression_tests]]` use a
  // count assertion (toBeLessThanOrEqual), not `.toContain`.
  test('round-ten-anchor cap — at most 1 round-ten fact across the 8-problem session', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(240_000)

    await seedLocalStorage(page, {
      progress: buildTwoDigitAddsubSeedProgress(),
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

    const allProblems = await walkAllProblems(page)
    expect(allProblems).toHaveLength(8)

    // Count problems whose first operand is a round-ten anchor
    // (a mod 10 === 0 && a >= 10 && op === '+').
    const roundTenCount = allProblems.filter(({ a, b, op }) =>
      isRoundTenAnchor(a, b, op),
    ).length

    // Round-ten-anchor cap — §1.4 / §2.3 LOCKED at 1.
    expect(
      roundTenCount,
      `Round-ten-anchor cap must hold (≤ 1) per §1.4. Got ${roundTenCount} ` +
        `round-ten anchors. All problems: ${JSON.stringify(allProblems)}.`,
    ).toBeLessThanOrEqual(1)
  })

  // ── Test 4 ─────────────────────────────────────────────────────────
  //
  // AC2 / AC10 — high-leverage coverage: at least one of P5, P6, P7,
  //               P8 carries a near-boundary-no-cross fact (units
  //               operation lands at or near the decade boundary
  //               without crossing).
  //
  // CLASSIFICATION: **RED-on-base lever**. Static fallback under
  // parser-miss is add-to-10 rotation (small-operand facts like
  // `4+3=7` — units 4+3=7 ≠ 9, so not near-boundary). Current canon
  // facts `15+2 (units 5+2=7), 31+4 (units 1+4=5), 26+5 (units 6+5=11
  // -- wait that's > 9, can't be no-cross; let me re-check), 28-3
  // (units 8-3=5), 34-2 (units 4-2=2), 42+6 (units 2+6=8), 39-7 (units
  // 9-7=2)` — actually NOTE that `26+5 = 31` requires carry (units
  // 6+5=11 > 9) — that's a regroup fact, violates §1.2 — current
  // canon is non-compliant. But the §2.4 near-boundary detection on
  // current canon's P5-P8 (`28-3, 34-2, 42+6, 39-7`):
  //   - 28-3: units 8-3=5, not 0 or 1 → not NBN
  //   - 34-2: units 4-2=2, not 0 or 1 → not NBN
  //   - 42+6: units 2+6=8, not 9 → not NBN
  //   - 39-7: units 9-7=2, not 0 or 1 → not NBN
  // → 0 near-boundary in P5-P8. Test 4 RED against current canon if
  // parsed. Under static-fallback (add-to-10), still 0 NBN typically.
  // Either way: RED today; GREEN once Wave-2 forces ≥ 1 per §2.4.
  //
  // Stronger assertion (count ≥ 2) would over-fit a §1.1-compliant
  // re-bake; ≥ 1 is the §2.4 LOCKED minimum.
  test('high-leverage coverage — ≥ 1 near-boundary-no-cross fact in P5-P8', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(240_000)

    await seedLocalStorage(page, {
      progress: buildTwoDigitAddsubSeedProgress(),
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

    const allProblems = await walkAllProblems(page)
    expect(allProblems).toHaveLength(8)

    // Slice to P5-P8 (1-based 5..8 = 0-based 4..7).
    const p5ToP8 = allProblems.slice(4, 8)
    expect(p5ToP8).toHaveLength(4)

    // Count how many of P5-P8 are near-boundary-no-cross facts.
    const nbnCount = p5ToP8.filter(({ a, b, op }) =>
      isNearBoundaryNoCross(a, b, op),
    ).length

    // High-leverage coverage rule — §2.4 LOCKED at ≥ 1.
    expect(
      nbnCount,
      `P5-P8 must contain ≥ 1 near-boundary-no-cross fact per §2.4. ` +
        `Got ${nbnCount}. P5-P8: ${JSON.stringify(p5ToP8)}.`,
    ).toBeGreaterThanOrEqual(1)
  })

  // ── Test 5 ─────────────────────────────────────────────────────────
  //
  // AC1 / AC9 — no-regroup constraint: for every `+` fact, units don't
  //              carry ((a mod 10) + (b mod 10) ≤ 9); for every `-`
  //              fact, units don't borrow ((a mod 10) ≥ (b mod 10)).
  //
  // CLASSIFICATION: **RED-on-base lever**. Static fallback is add-to-10
  // facts which DO satisfy units ≤ 9 trivially (a+b ≤ 10 so units
  // can't exceed 10). But this only tests against the wrong-tier
  // fallback. The assertion is sound for any §1.2-compliant pool;
  // when Wave 2 rebakes, this test catches a directive miss where
  // Haiku emits a regroup fact like `27+6=33` (units 7+6=13 > 9).
  //
  // The current canon's `26+5=31` actually violates this (units
  // 6+5=11 > 9) — that's a regroup carry fact. Confirms the current
  // canon is NOT §1.2-compliant. Post-Wave-2 the rebaked canon excludes
  // such facts by §4.1 NO REGROUPING SELF-CHECK construction.
  //
  // §1.2 LOAD-BEARING constraint per the no-regroup contract.
  test('no-regroup — every + has units ≤ 9 AND every - has units ≥ 0', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(240_000)

    await seedLocalStorage(page, {
      progress: buildTwoDigitAddsubSeedProgress(),
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

    const allProblems = await walkAllProblems(page)
    expect(allProblems).toHaveLength(8)

    for (let i = 0; i < 8; i++) {
      const { a, b, op, correct } = allProblems[i]!
      const slot = `P${i + 1} (${a} ${op} ${b} = ${correct})`
      const onesA = a % 10
      const onesB = b % 10
      if (op === '+') {
        // No-carry: units sum ≤ 9.
        expect(
          onesA + onesB,
          `${slot}: + units (${onesA} + ${onesB}) must be ≤ 9 (no carry) per §1.2.`,
        ).toBeLessThanOrEqual(9)
      } else {
        // No-borrow: units(a) ≥ units(b).
        expect(
          onesA,
          `${slot}: - units (${onesA} from a) must be ≥ ${onesB} (from b) ` +
            `(no borrow) per §1.2.`,
        ).toBeGreaterThanOrEqual(onesB)
      }
    }
  })

  // ── Test 6 ─────────────────────────────────────────────────────────
  //
  // AC7 — no-duplicate triples AND dual-exposure rule.
  //
  // CLASSIFICATION: **Regression-lock** (with a weak RED-on-base
  // signal). Current canon has 8 distinct `(a, b, op)` triples and no
  // op-inverse pairs (e.g. `33+4` and `37-4` would be inverses but
  // current canon has neither). Static fallback rotation also has
  // distinct triples. The test will pass on base trivially BUT the
  // §5.5 LOAD-BEARING contract earns the regression-lock value once
  // Wave 2 lands: a re-baked canon containing both `33+4=37` AND
  // `37-4=33` (inverse pair) would fail this test. Today the
  // canon doesn't include such pairs, but the rule is asserted across
  // every (a, b, c) triple per spec §2.5 + §5.5.
  //
  // Dual-exposure rule: an `+` fact `a + b = c` and its `-` inverse
  // `c - b = a` may NOT co-occur in the same session. Lint asserts at
  // bake; this E2E lock catches a render-side regression where the
  // chip-derivation somehow re-injects the inverse.
  test('dual-exposure rule — no inverse op pair across the session, no duplicate triples', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(240_000)

    await seedLocalStorage(page, {
      progress: buildTwoDigitAddsubSeedProgress(),
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

    const allProblems = await walkAllProblems(page)
    expect(allProblems).toHaveLength(8)

    // No-duplicate check on (a, b, op) triples — §2.5.
    const tripleKeys = allProblems.map((p) => `${p.a}|${p.b}|${p.op}`)
    const uniqueTriples = new Set(tripleKeys)
    expect(
      uniqueTriples.size,
      `No duplicate (a, b, op) triples allowed per §2.5. ` +
        `Got triples: ${JSON.stringify(tripleKeys)}.`,
    ).toBe(8)

    // Dual-exposure rule — §5.5 LOAD-BEARING. For each `+` fact
    // `a + b = c`, the `-` inverse `c - b = a` must NOT also appear.
    // Conversely for each `-` fact `a - b = c`, the `+` inverse
    // `c + b = a` must NOT also appear.
    const forbiddenInverseHits: string[] = []
    for (const p of allProblems) {
      // The 'c' value is the correct answer (a+b for + ; a-b for -).
      const c = p.correct
      // The inverse pair is: same (b, c) but swapped op.
      // For `+`: a+b=c ↔ c-b=a (`-` form with minuend=c, subtrahend=b).
      // For `-`: a-b=c ↔ c+b=a (`+` form with addend-a=c, addend-b=b).
      // We look for ANY problem in the session whose triple matches
      // the inverse shape against p.
      const inverseOp: '+' | '-' = p.op === '+' ? '-' : '+'
      const inverseA = c
      const inverseB = p.b
      const inverseKey = `${inverseA}|${inverseB}|${inverseOp}`
      if (
        tripleKeys.includes(inverseKey) &&
        inverseKey !== `${p.a}|${p.b}|${p.op}`
      ) {
        forbiddenInverseHits.push(
          `${p.a}${p.op}${p.b}=${c} has inverse ${inverseA}${inverseOp}${inverseB} in session`,
        )
      }
    }
    expect(
      forbiddenInverseHits,
      `Dual-exposure rule violation per §5.5. ` +
        `Inverse pairs found: ${JSON.stringify(forbiddenInverseHits)}.`,
    ).toEqual([])
  })

  // ── Test 7 (FIXME — Wave 3) ────────────────────────────────────────
  //
  // AC3 — Class 2 column-cross trap renders at P4 for op:'+'. The
  //        trap formula per §3.3: for `a + b = c` with single-digit
  //        `b`, decompose `c` into tens `cT` and units `cU`; the
  //        column-cross trap = swap units/tens, i.e. `cU * 10 + cT`.
  //
  // CLASSIFICATION: **fixme** until Devon's Wave-3 PR widens the
  // `distractorClass` union to include `'column-cross'` AND wires
  // `Math.tsx` to dispatch it on `focusNode === 'two-digit-addsub' &&
  // problemIndex ∈ [4, 8] && op === '+'`. Today the union at
  // `distractors.ts:192` covers only `'off-by-one' | 'wrong-op' |
  // 'decade-anchor'`. The chips fall back to `gentleDistractors`
  // (P1-P3) or `offByOneDistractors` (P4-P8) — neither produces a
  // column-swap value. Test would be **deterministically RED** today
  // for the wrong reason (production logic doesn't exist yet, not a
  // production-state regression).
  //
  // Flip from `test.fixme(...)` to `test(...)` when Devon's PR
  // merges (per `[[testing-and-ci.md §6 "Split-PR pattern"]]`
  // breadcrumb pattern).
  //
  // Implementation notes for Wave-3 author:
  //   - Captured request body shape used as positive discriminator
  //     (anchor to right tier) — see add-to-20 PR #283 Test 4 pattern.
  //   - Chip row must EQUAL the structural Class-1 + Class-2 set,
  //     not "trap value is absent" (negative-membership trap per
  //     §4.1.1e).
  //   - The Class-2 trap is silently downgraded to off-by-one when
  //     degenerate (palindromic results, OOR) — test must skip the
  //     P4 assertion when the rendered fact is in the degenerate
  //     subset, per §3.3.
  test.fixme('Class 2 column-cross trap renders at P4 op:+ — chip row contains the units-tens swap of correct', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(120_000)

    // PR B activates: flip `test.fixme` → `test`. See
    // testing-and-ci.md §6 "Split-PR pattern" 3-line update.
    // Wave-3 author also: extend `distractorClass` union to add
    // `'column-cross'`; wire Math.tsx P4-P8 op:+ dispatch.

    await seedLocalStorage(page, {
      progress: buildTwoDigitAddsubSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    const { requests } = await installMathCanonClaudeMock(
      page,
      TWO_DIGIT_ADDSUB_CANON_PATH,
    )

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

    // POSITIVE DISCRIMINATOR — captured request body shape per
    // `[[testing-and-ci.md §4.1.1e]]` + the defensive pairing rule.
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
    // Wave 5 (ticket 86c9y0bvc) sibling-tier split — picker now
    // emits the no-regroup tier literal. PR B will introduce a
    // separate with-regroup spec; this assertion stays on the
    // no-regroup tier (existing pool envelope unchanged).
    expect(reqProgress.focusNode).toBe('two-digit-addsub-no-regroup')

    // Walk to P4 (0-based index 3). Tap correct 3 times.
    for (let i = 0; i < 3; i++) {
      await tapCorrectAndAdvance(page, i)
    }
    await expect(page.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      '3',
      { timeout: 15_000 },
    )

    // P4 must be `+` for this test (the §2.1 + §2.2 mix permits but
    // doesn't require — if a `-` lands here, skip with the §3.3
    // degeneracy note).
    const { a, b, op } = await readCurrentProblem(page)
    const correct = op === '+' ? a + b : a - b
    test.skip(
      op !== '+',
      `P4 op is ${op}; Class 2 column-cross test scoped to op:+ at P4. ` +
        `Pass through trivially.`,
    )

    // §3.3 trap formula for `+` with single-digit `b`:
    //   tens(correct) = floor(correct / 10), units(correct) = correct % 10
    //   trap = units(correct) * 10 + tens(correct)
    const tensC = Math.floor(correct / 10)
    const unitsC = correct % 10
    const trap = unitsC * 10 + tensC

    // §3.3 degenerate-input downgrade: trap === correct (palindromic
    // units/tens like correct=22 → trap=22) → downgraded to off-by-
    // one silently. Skip the assertion in that case.
    const decAliasesCorrect = trap === correct
    const decOutOfRange = trap < 1 || trap > 99
    test.skip(
      decAliasesCorrect || decOutOfRange,
      `P4 fact ${a}+${b}=${correct} produces a degenerate Class-2 trap ` +
        `(trap=${trap}); §3.3 downgrades silently to off-by-one. Assertion ` +
        `vacuously satisfied.`,
    )

    const chipValues = await readCurrentChipValues(page)

    // The chip row must contain `trap` exactly once (Class 2 trap fires).
    const trapCount = chipValues.filter((v) => v === trap).length
    expect(
      trapCount,
      `Class 2 trap value ${trap} must appear exactly once in chip row. ` +
        `Got chips: ${JSON.stringify(chipValues)}; correct=${correct}.`,
    ).toBe(1)

    // Sanity gate — correct also in chips.
    const correctCount = chipValues.filter((v) => v === correct).length
    expect(correctCount).toBe(1)
  })

  // ── Test 8 (FIXME — Wave 3) ────────────────────────────────────────
  //
  // AC3 — Class 3 phantom-borrow trap renders at P5+ for op:'-'. The
  //        trap formula per §3.4: `correct - 10` (decrement the tens
  //        digit by 1 preserving units).
  //
  // CLASSIFICATION: **fixme** until Devon's Wave-3 PR widens the
  // `distractorClass` union to include `'phantom-borrow'` AND wires
  // `Math.tsx` to dispatch it on `focusNode === 'two-digit-addsub' &&
  // problemIndex ∈ [5, 8] && op === '-'`. Same dispatch-deficiency as
  // Test 7. Today the chip row contains gentle / off-by-one only.
  //
  // Implementation notes for Wave-3 author (sibling of Test 7):
  //   - Walk to the first P5+ `-` fact (some sessions may put `-`
  //     only at later slots).
  //   - Skip if the rendered fact's trap is OOR (`correct < 12` →
  //     trap < 2; spec §3.4 acknowledges silent downgrade).
  //   - Same captured-request positive discriminator.
  test.fixme('Class 3 phantom-borrow trap renders at P5+ op:- — chip row contains (correct - 10)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(180_000)

    // PR B activates: flip `test.fixme` → `test`. See
    // testing-and-ci.md §6 "Split-PR pattern" 3-line update.
    // Wave-3 author also: extend `distractorClass` union to add
    // `'phantom-borrow'`; wire Math.tsx P5-P8 op:- dispatch with
    // downgrade chain phantom-borrow → column-cross → decade-anchor
    // → off-by-one.

    await seedLocalStorage(page, {
      progress: buildTwoDigitAddsubSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    const { requests } = await installMathCanonClaudeMock(
      page,
      TWO_DIGIT_ADDSUB_CANON_PATH,
    )

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

    // POSITIVE DISCRIMINATOR — captured request body shape.
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
    // Wave 5 (ticket 86c9y0bvc) sibling-tier split — picker now
    // emits the no-regroup tier literal. PR B will introduce a
    // separate with-regroup spec; this assertion stays on the
    // no-regroup tier (existing pool envelope unchanged).
    expect(reqProgress.focusNode).toBe('two-digit-addsub-no-regroup')

    // Walk problems P1..P8 looking for the first op:'-' at P5+.
    let foundSubIndex = -1
    for (let i = 0; i < 8; i++) {
      await expect(page.getByTestId('math')).toHaveAttribute(
        'data-problem-index',
        String(i),
        { timeout: 15_000 },
      )
      const { op } = await readCurrentProblem(page)
      if (op === '-' && i >= 4) {
        foundSubIndex = i
        break
      }
      if (i < 7) await tapCorrectAndAdvance(page, i)
    }

    test.skip(
      foundSubIndex < 0,
      "No op:'-' problem found at P5+ in this session. Op-mix may have " +
        "placed '-' only at P4 (allowed by §2.1). Test vacuously skipped.",
    )

    const { a, b } = await readCurrentProblem(page)
    const actualCorrect = a - b

    // §3.4 trap formula: correct - 10.
    const trap = actualCorrect - 10

    // §3.4 degenerate: trap < ANSWER_RANGE_MIN (= 1) → silent
    // downgrade to off-by-one.
    const decOutOfRange = trap < 1 || trap > 99
    test.skip(
      decOutOfRange,
      `P${foundSubIndex + 1} fact ${a}-${b}=${actualCorrect} produces a ` +
        `degenerate Class-3 trap (trap=${trap}); §3.4 downgrades silently.`,
    )

    const chipValues = await readCurrentChipValues(page)

    const trapCount = chipValues.filter((v) => v === trap).length
    expect(
      trapCount,
      `Class 3 phantom-borrow trap ${trap} must appear exactly once in ` +
        `chip row. Got chips: ${JSON.stringify(chipValues)}; ` +
        `correct=${actualCorrect}.`,
    ).toBe(1)

    const correctCount = chipValues.filter((v) => v === actualCorrect).length
    expect(correctCount).toBe(1)
  })

  // ── Test 9 ─────────────────────────────────────────────────────────
  //
  // AC5 / AC11 — parser handles hyphenated decade-units number words.
  //              The canon contains read-lines like `"Thirty-one plus
  //              four. How many?"`. The parser at `wordToNumber`
  //              (PR #285) decomposes `thirty-one` → 31. The screen
  //              renders addend-a as `"31"` (numeric form), proving
  //              the parse succeeded.
  //
  // CLASSIFICATION: **Regression-lock**. Already shipped (PR #285 —
  // `wordToNumber` + addition regex widening). Catches any future
  // regression that re-narrows the regex or removes hyphen support
  // from `NUMBER_WORDS` table-driven extension.
  //
  // Scoped to `+` problems only because the `-` regex still requires
  // `"How many are left?"` (Wave-3-pending widening); this test passes
  // structurally against the static fallback rotation too (where
  // addend-a renders as a digit string), but **the meaningful signal
  // is that AT LEAST ONE problem renders a hyphenated-decade addend
  // (a ≥ 21 with a mod 10 ≠ 0) — only possible when parser correctly
  // decoded a hyphenated word like "Twenty-one"**. Static fallback
  // tops at a=9 so this assertion is structurally unsatisfiable
  // against the fallback → genuine RED-on-base today, transitions to
  // GREEN once Wave-3 widens the `-` regex (or if Wave-2 rebakes the
  // canon to include hyphenated `+` reads from session P1, which is
  // already the case — current canon P3 is "Thirty-one plus four").
  //
  // After Wave-2 + Wave-3 land: the test should reliably find at
  // least one hyphenated-decade addend across the session.
  test('parser hyphen support — at least one rendered addend-a in [21, 99] with non-zero units', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(240_000)

    await seedLocalStorage(page, {
      progress: buildTwoDigitAddsubSeedProgress(),
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

    const allProblems = await walkAllProblems(page)
    expect(allProblems).toHaveLength(8)

    // At least one problem must have addend-a ≥ 21 AND a mod 10 ≠ 0
    // (hyphenated-decade form like "Twenty-one", "Thirty-five",
    // "Forty-eight"). The §1.1 pool guarantees this: every fact #4 +
    // facts #5 + #6 (EASY band, all with non-zero-units two-digit
    // first operand) means at least one of P1-P8 will land on a
    // hyphenated decade name.
    const hyphenatedDecadeProblems = allProblems.filter(
      ({ a }) => a >= 21 && a % 10 !== 0,
    )
    expect(
      hyphenatedDecadeProblems.length,
      `At least one rendered addend-a must be a hyphenated decade-units ` +
        `form (a ≥ 21 AND a mod 10 ≠ 0) per §4.2 + §5.2. Got all addends: ` +
        `${JSON.stringify(allProblems.map((p) => p.a))}. If this is 0, the ` +
        `parser likely rejected the hyphenated read-line and fell through ` +
        `to the static add-to-10 rotation (addends ≤ 9).`,
    ).toBeGreaterThanOrEqual(1)
  })
})
