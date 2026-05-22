/**
 * E2E spec — `sub-to-10` Class 2 wrong-operation distractor.
 *
 * Paired with Kevin's PR 1 (`feat/sub-to-10-content`).
 *
 * What the spec asserts (per `design/math/sub-to-10-content.md` §3.2)
 * -------------------------------------------------------------------
 * 1. **GREEN-side wrong-op present, P4-P8 zone.** A canned plan with
 *    `10 - 2 = 8` at problem index 4 (the discriminate window's first
 *    problem) renders chips whose distractor row contains the
 *    wrong-operation trap value `12` (= minuend + subtrahend).
 *
 *    Wait — the spec §3.2 also says: when `a + b > maxAnswer` the
 *    wrong-op falls back to off-by-one. `10 + 2 = 12` is OOR for
 *    `maxAnswer = 10`, so Class 2 silently downgrades to Class 1.
 *
 *    To exercise the **in-range** wrong-op trap, problem index 4 in
 *    our canned plan uses `9 - 1 = 8` (the §3.2 worked example with
 *    `a + b = 10` in range). The distractor row must contain `10`.
 *
 * 2. **GREEN-side gentle tier (P1-P3) does NOT carry the wrong-op
 *    value.** A canned subtraction at problem index 1 with the SAME
 *    fact (e.g. `9 - 1 = 8`) gets Class 0 (gentle) distractors per
 *    `pickTier` — distractors are at-least-2 away from `correct`,
 *    pinned to range extremes. The chip row must NOT contain `10`
 *    as a distractor at P1 (because gentle ramp does not use the
 *    `correct + 2` neighbour either; `9 - 1 = 8` gentle returns
 *    `[ANSWER_RANGE_MIN, ANSWER_RANGE_MAX]` only if both extremes are
 *    ≥2 away — `10 - 8 = 2` so `10` is rejected; gentle picks `1`
 *    and walks down. `10` is not in the gentle set).
 *
 * 3. **Class 2 is sub-only.** A canned `add-to-10` plan with
 *    `5 + 3 = 8` at problem index 4 must NOT carry `|5 - 3| = 2` as
 *    a distractor (Class 2 never fires for `op === '+'` per spec
 *    §3.5).
 *
 * Failing-first contract
 * ----------------------
 * On RED `main` (commit `ea9e53a`):
 *   - The parser rejects "minus" / "take away" read-lines → the
 *     screen falls back to `pickStaticSessionPlan()` for subtraction
 *     problems. Static fallback chips do NOT carry `10` as a
 *     wrong-op distractor (Class 2 doesn't exist yet anywhere).
 *   - Assertion 1 (`chips contain 10` at P4): **FAILS** — the
 *     fallback addition plan's P4 distractors are
 *     `[correct - 1, correct + 1]`, not the canned subtraction's
 *     wrong-op.
 *   - Assertions 2 + 3 hold trivially on RED for the wrong reason —
 *     they're counter-tests that defend against false-positives in
 *     Kevin's implementation. Tracked together so they don't drift.
 *
 * On GREEN (Kevin's PR 1):
 *   - The parser accepts the new read templates, tags `op: '-'`,
 *     and the screen renders the canned plan.
 *   - `pickDistractors` with `op === '-'`, `distractorClass: 'wrong-op'`,
 *     `correct: 8`, `minuend: 9`, `subtrahend: 1`, `problemIndex: 4`
 *     returns a tuple containing `10` (the wrong-op trap).
 *
 * Out of scope
 * ------------
 * Chip-0 rendering (subtract-self facts) is PR 2 territory and not
 * exercised here.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

// NOTE on `forceHowlerUnlock` + chip-walking limitation
// -----------------------------------------------------
// We deliberately do NOT call `forceHowlerUnlock(page)` in this spec.
// Per `.claude/docs/testing-and-ci.md` §4.1.2 + the empirical finding
// from PR #242, the helper causes a silent fallback to the static
// rotation plan, masking the canned plan's distractor content — which
// IS what this spec asserts on (chip values for specific facts).
//
// Tests 1 and 3 (P4 chip-walk) now use REAL CANON BYTES served via
// `installMathCanonClaudeMock` (the `installDigraphsChClaudeMock`
// pattern from `digraphs-ch-content.spec.ts`). Real Azure-rendered MP3s
// decode cleanly under the genuine gesture-unlock chain, so chips
// enable across the multi-problem walk. Per PR #253 the sub-to-10
// canon pool was widened to 22 facts and P4 is now `8 - 2 = 6` — a
// Class-2-eligible fact (a+b=10, in-range trap). This unblocks the
// re-enable path that was blocked at PR #239 dispatch time, when the
// pre-#253 canon's P4 (`10 - 3 = 7`) had no in-range wrong-op trap.
// Per `.claude/docs/testing-and-ci.md` §4.1.3 rule 3, multi-problem
// chip-walk specs require real-canon-bytes mocks — this is exactly
// that pattern. Test 2 (P1 gentle) remains `test.fixme`'d for a
// SEPARATE reason — see the fixme comment on test 2 itself.

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

const SILENT_MP3 =
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAA8TEFNRTMuMTAwBLgAAAAAAAAAABRAJAUHQQAB4AAAAk8tnaAyAAAAAA=='

function audio() {
  return {
    kind: 'inline' as const,
    base64: SILENT_MP3,
    mime: 'audio/mpeg' as const,
  }
}

// ── Canned-plan factories ────────────────────────────────────────────────────

/**
 * Sub-to-10 plan placing `9 - 1 = 8` at problem index 1 (gentle tier).
 * Gentle ramp uses Class 0 distractors regardless of operation; the
 * wrong-op value `10` must NOT appear.
 *
 * Used by test 2 only (P1 gentle, fixme'd for an unrelated spec-design
 * reason — see the fixme docstring on test 2 itself).
 */
function cannedSubToTenWithProblem1GentleFact() {
  const problems = [
    {
      idx: 1,
      mW: 'Nine',
      sW: 'one',
      minuend: 9,
      subtrahend: 1,
      ans: 8,
      ansW: 'Eight',
    },
    {
      idx: 2,
      mW: 'Six',
      sW: 'three',
      minuend: 6,
      subtrahend: 3,
      ans: 3,
      ansW: 'Three',
    },
    {
      idx: 3,
      mW: 'Eight',
      sW: 'four',
      minuend: 8,
      subtrahend: 4,
      ans: 4,
      ansW: 'Four',
    },
    {
      idx: 4,
      mW: 'Ten',
      sW: 'three',
      minuend: 10,
      subtrahend: 3,
      ans: 7,
      ansW: 'Seven',
    },
    {
      idx: 5,
      mW: 'Nine',
      sW: 'four',
      minuend: 9,
      subtrahend: 4,
      ans: 5,
      ansW: 'Five',
    },
    {
      idx: 6,
      mW: 'Ten',
      sW: 'seven',
      minuend: 10,
      subtrahend: 7,
      ans: 3,
      ansW: 'Three',
    },
    {
      idx: 7,
      mW: 'Eight',
      sW: 'three',
      minuend: 8,
      subtrahend: 3,
      ans: 5,
      ansW: 'Five',
    },
    {
      idx: 8,
      mW: 'Nine',
      sW: 'six',
      minuend: 9,
      subtrahend: 6,
      ans: 3,
      ansW: 'Three',
    },
  ]
  return mkResponse(
    'sub-to-10-level-1',
    'Subtraction within 10 — Level 1',
    problems,
    'minus',
  )
}

function mkResponse(
  planId: string,
  label: string,
  problems: ReadonlyArray<{
    idx: number
    mW: string
    sW: string
    ans: number
    ansW: string
  }>,
  op: 'minus' | 'plus',
) {
  const readSuffix = op === 'minus' ? 'How many are left?' : 'How many?'
  const hintConnector = op === 'minus' ? 'Take away' : 'And'
  const utterances = problems.flatMap((p) => [
    {
      id: `math.p${p.idx}.read`,
      text: `${p.mW} ${op} ${p.sW}. ${readSuffix}`,
      audio: audio(),
    },
    { id: `math.p${p.idx}.correct`, text: `Yes! ${p.ansW}!`, audio: audio() },
    {
      id: `math.p${p.idx}.reprompt`,
      text: 'Hmm... try again?',
      audio: audio(),
    },
    {
      id: `math.p${p.idx}.hint`,
      text: `Look. ${p.mW}. ${hintConnector} ${p.sW}. How many now?`,
      audio: audio(),
    },
    {
      id: `math.p${p.idx}.giveAnswer`,
      text: `This one is ${p.ansW.toLowerCase()}.`,
      audio: audio(),
    },
  ])
  return {
    ok: true as const,
    kind: 'session-start' as const,
    plan: {
      id: planId,
      label,
      utterances: utterances.map((u) => ({ id: u.id, text: u.text })),
    },
    utterances,
  }
}

// ── Canon-bytes mock — for tests 1 + 3 (multi-problem chip-walk) ─────────────

/**
 * Paths to the math session canons we serve for tests 1 + 3. Resolved
 * from `process.cwd()` because Playwright runs the harness from the
 * worktree root (same place `vite preview` reads `public/`).
 *
 * sub-to-10 canon current state (post PR #253 widening + #255 lint
 * tightening) — see `api/_planner.ts:972` for the locked 22-fact pool:
 *   P1=5-5=0  P2=6-3=3  P3=9-1=8  P4=8-2=6  (a+b=10 IN — Class-2 trap)
 *   P5=10-3=7 P6=10-7=3 P7=7-3=4 (a+b=10 IN) P8=6-4=2 (a+b=10 IN)
 *
 * add-to-10 canon P4 = `2 + 4 = 6` (per PR #266 re-bake). Class 2 is
 * op:'-' ONLY (see `distractors.ts:224-227`) so even though
 * `|2 - 4| = 2` is the hypothetical wrong-op trap value, it must NOT
 * appear on the chip row at P4 — the off-by-one tier emits `[5, 7]`
 * for correct=6.
 */
const SUB_TO_TEN_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/math/level-1/sub-to-10.json',
)
const ADD_TO_TEN_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/math/level-1/add-to-10.json',
)

function readMathCanon(path: string): string {
  if (!existsSync(path)) {
    throw new Error(
      `[sub-to-10-distractor-class-2 spec] canon not found at ${path}. ` +
        `This canon is required for chip-walk tests; do NOT swap to a ` +
        `silent-MP3 placeholder — see file header.`,
    )
  }
  return readFileSync(path, 'utf-8')
}

/**
 * Install a `/api/claude` mock that serves the on-disk math canon for
 * `track === 'math'` requests. Modelled on `installDigraphsChClaudeMock`
 * (`digraphs-ch-content.spec.ts`). Real Azure-rendered MP3 bytes decode
 * cleanly in headless chromium, so the read-aloud effect resolves and
 * chips enable across the multi-problem walk — the required pattern per
 * `.claude/docs/testing-and-ci.md` §4.1.3.
 *
 * `canonBody` is the raw JSON string read from disk; we serve it
 * verbatim as the `track === 'math'` response. Unknown tracks return
 * 500 loudly so an unintended live hit cannot pass silently.
 */
async function installMathCanonClaudeMock(
  page: Page,
  canonBody: string,
): Promise<{ requests: Request[] }> {
  const requests: Request[] = []
  await page.route('**/api/claude', async (route) => {
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
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'unexpected-track',
        message: `distractor-class-2 spec is math-only; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

// ── Mock factory — math-only, response is per-test ───────────────────────────

async function installMathMockReturning(
  page: Page,
  response: () => unknown,
): Promise<{ requests: Request[] }> {
  const requests: Request[] = []
  await page.route('**/api/claude', async (route) => {
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
        body: JSON.stringify(response()),
      })
      return
    }
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'unexpected-track',
        message: `distractor-class-2 spec is math-only; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

// ── Seed builders ────────────────────────────────────────────────────────────

function buildSubToTenSeedProgress(): unknown {
  return buildMathProgressWith({
    'add-to-10': 'mastered',
    'add-to-20': 'mastered',
    'sub-to-10': 'practicing',
  })
}

function buildAddToTenSeedProgress(): unknown {
  return buildMathProgressWith({
    'add-to-10': 'practicing',
  })
}

function buildMathProgressWith(overrides: Record<string, string>): unknown {
  const base: Record<string, string> = {
    'number-recog': 'mastered',
    'add-to-10': 'practicing',
    'add-to-20': 'locked',
    'sub-to-10': 'mastered',
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
  }
  return {
    schemaVersion: 1,
    profile: { childName: 'Marian', character: 'melody', lastPlayedISO: null },
    skillLevels: { ...base, ...overrides },
    mathFactsLeitner: { items: [] },
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

// ── Helpers — read the chip row's data-value set ─────────────────────────────

async function readChipValuesAtProblem(
  page: Page,
  problemIndex: number,
): Promise<number[]> {
  // `problemIndex` is 1-based in the spec signature (1 = first problem
  // in the canon, 4 = fourth). The DOM's `data-problem-index` on
  // `[data-testid="math"]` is 0-based — P1 renders as `"0"`, P4 as
  // `"3"`. Wait for the 0-based attribute to land before reading chips
  // to defeat the celebrate→next-problem race that a bare
  // `waitForTimeout` would absorb (leaving the previous problem's
  // chips on screen at read time).
  for (let i = 1; i < problemIndex; i++) {
    const correctChip = page.locator(
      '[data-testid="math-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 15_000 })
    await correctChip.click()
    // After tap #i, the screen should advance from 0-based index
    // `i - 1` to `i`.
    await expect(page.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      String(i),
      { timeout: 15_000 },
    )
  }
  // Now we're on `problemIndex`. Read all 3 chip values.
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

// ── Spec ────────────────────────────────────────────────────────────────────

test.describe('sub-to-10 distractor Class 2 (wrong-operation)', () => {
  // RE-ENABLED 2026-05-16 (ClickUp 86c9up8u2). The PR #239 fixme is
  // resolved by serving the on-disk sub-to-10 canon (PR #253-widened,
  // PR #255-lint-tightened) instead of the silent-MP3 canned fixture.
  // Post-#253 the canon's P4 = `8 - 2 = 6` is a Class-2-eligible fact
  // (a+b=10 IN — boundary, strongest "makes ten" lure per the planner's
  // pool annotation at `api/_planner.ts:985`). Real Azure MP3 bytes
  // decode cleanly, so the read-aloud effect resolves and chips enable
  // across the chip-walk — the canonical pattern per
  // `.claude/docs/testing-and-ci.md` §4.1.3 rule 3.
  //
  // The original test asserted on `9 - 1 = 8` at P4 (synthetic canned
  // fact). Canon P3 IS `9 - 1 = 8` but P4 is `8 - 2 = 6`; we re-target
  // the assertion to the CANON's P4 fact (correct=6, wrong-op trap=10).
  // The structural assertion is unchanged — "wrong-op trap value
  // appears on a Class-2-eligible P4 chip row" — only the operands
  // shift to match where the canon places the lure.
  test('problem 4 (discriminate tier) with canon `8 - 2 = 6` carries the wrong-op trap `10` as a distractor', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    // 4-problem walk-through: tap correct 3 times to reach problem 4,
    // then read chips. Bump test timeout for safety on slow CI runners.
    test.setTimeout(120_000)

    const canonBody = readMathCanon(SUB_TO_TEN_CANON_PATH)
    await installMathCanonClaudeMock(page, canonBody)
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

    // Canon-landed addend gate (PR #242 precedent). Canon P1 is
    // `5 - 5 = 0`; wait for those operands so the chip walk starts
    // against canon (not static fallback) on every distractor read.
    await expect(page.getByTestId('math-addend-a')).toHaveText('5', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('5', {
      timeout: 15_000,
    })

    const valuesAtP4 = await readChipValuesAtProblem(page, 4)

    // Failing-first lever — for canon P4 `8 - 2 = 6`, the wrong-op
    // trap value is `a + b = 10` (in range). On RED (pre-Class-2-impl)
    // the discriminate tier would fall through to plain off-by-one
    // [5, 7] and `10` would not appear on the chip row. Count-based
    // assertions per `feedback_count_assertions_on_regression_tests`.
    expect(valuesAtP4).toHaveLength(3)
    const tenCount = valuesAtP4.filter((v) => v === 10).length
    expect(tenCount).toBe(1)
    // Correct answer 6 must be among the chips.
    const sixCount = valuesAtP4.filter((v) => v === 6).length
    expect(sixCount).toBe(1)
  })

  // STOPGAP — spec premise was wrong, not the implementation.
  //
  // The original docstring (lines 24-30) claimed gentle ramp would
  // not include `10` for `correct=8` because "gentle picks `1` and
  // walks down". That reasoning was incorrect. For `op === '-'`,
  // `gentleDistractors(correct=8, minAnswer=0, maxAnswer=10)` hits
  // the easy case at distractors.ts:356 — both extremes satisfy the
  // ≥2 gap, so the function returns [0, 10]. The chip row is
  // [0, 8, 10] — `10` IS in the chip set, NOT because Class 2 fired,
  // but because gentle's natural extreme-pair returned it.
  //
  // The original assertion `tenCount === 0` therefore fails on GREEN
  // for the right structural reason (gentle correctly returns
  // [0, 10]) but the spec cannot distinguish "gentle did NOT add 10
  // via wrong-op" from "gentle DID add 10 via extremes". The
  // counter-test is not load-bearing — the unit tests in
  // `distractors.test.ts` cover both the gentle-tier extreme-pair
  // contract and the wrong-op gating on `pickTier(problemIndex) ===
  // 'offByOne'`. Re-author as a unit test on `pickDistractors` if
  // future E2E coverage is wanted; the chip-render path adds no
  // signal here.
  test.fixme('problem 1 (gentle tier) with 9-1=8 does NOT carry the wrong-op `10` as a distractor', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(60_000)

    await installMathMockReturning(page, cannedSubToTenWithProblem1GentleFact)
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

    // Canon-landed addend gate (PR #242 precedent). P1 of this fixture
    // is the gentle `9 - 1 = 8` fact — no chip-walk needed, so this test
    // runs through cleanly on chromium headless without forceHowlerUnlock.
    await expect(page.getByTestId('math-addend-a')).toHaveText('9', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('1', {
      timeout: 15_000,
    })

    const valuesAtP1 = await readChipValuesAtProblem(page, 1)

    expect(valuesAtP1).toHaveLength(3)
    // Counter-test: gentle tier (P1) must NOT carry the wrong-op `10`.
    const tenCount = valuesAtP1.filter((v) => v === 10).length
    expect(tenCount).toBe(0)
    // The correct answer 8 must still be among the chips.
    const eightCount = valuesAtP1.filter((v) => v === 8).length
    expect(eightCount).toBe(1)
  })

  // RE-ENABLED 2026-05-16 (ClickUp 86c9up8u2). Same fix as test 1 —
  // switch to real canon bytes + drop `forceHowlerUnlock`. Class-2-is-
  // sub-only is the counter-test: even on the discriminate tier (P4),
  // an op:'+' problem must NOT carry `|a - b|` as a distractor.
  //
  // Canon `add-to-10.json` P4 = `2 + 4 = 6` (per PR #266 re-bake; was
  // `4 + 3 = 7` pre-#266). The hypothetical wrong-op trap value (if
  // Class 2 erroneously fired) would be `|2 - 4| = 2`. Per
  // `distractors.ts:224-227` the wrong-op branch ONLY fires when
  // `op === '-'`, so for this op:'+' problem the chip row must be the
  // plain off-by-one tier `[5, 7]` plus correct `6`. The trap value
  // `2` must NOT appear. (Re-targeted twice — first from `5 + 3 = 8`
  // (trap `|5-3|=2`) to `4 + 3 = 7` (trap `|4-3|=1`) on PR #239 canon
  // widening, now to `2 + 4 = 6` (trap `|2-4|=2`) on PR #266 re-bake;
  // structural assertion is unchanged — "the op:'-'-only Class-2 lure
  // does NOT leak onto an op:'+' chip row" — only the specific trap
  // value shifts to match canon operands.)
  test('add-to-10 problem 4 with canon `2 + 4 = 6` does NOT carry the would-be wrong-op `2` (Class 2 is sub-only per spec §3.5)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(120_000)

    const canonBody = readMathCanon(ADD_TO_TEN_CANON_PATH)
    await installMathCanonClaudeMock(page, canonBody)
    await seedLocalStorage(page, {
      progress: buildAddToTenSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Canon-landed addend gate (PR #242 precedent). Canon P1 is
    // `1 + 2 = 3` (per PR #266 re-bake) — wait for those operands
    // before walking chips.
    await expect(page.getByTestId('math-addend-a')).toHaveText('1', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('2', {
      timeout: 15_000,
    })

    const valuesAtP4 = await readChipValuesAtProblem(page, 4)

    expect(valuesAtP4).toHaveLength(3)
    // Counter-test — Class 2 is sub-only. `|2 - 4| = 2` (the would-be
    // wrong-op trap value if Class 2 erroneously fired on op:'+') must
    // NOT appear as a distractor on an add-to-10 problem.
    const twoCount = valuesAtP4.filter((v) => v === 2).length
    expect(twoCount).toBe(0)
    // Correct answer 6 must be present.
    const sixCount = valuesAtP4.filter((v) => v === 6).length
    expect(sixCount).toBe(1)
  })
})
