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
// HEADLESS-CHROMIUM LIMITATION (tests 1 + 3 only): without
// forceHowlerUnlock, Math.tsx's read-aloud effect short-circuits on
// silent-MP3 placeholder bytes (Howler.ctx stays suspended), chips
// never enable, and the multi-problem chip walk for tests 1 (P4
// wrong-op) and 3 (add-to-10 P4) cannot complete. The cleanest fix is
// to swap the canned silent-MP3 fixture for real Azure canon bytes
// (the `installDigraphsThClaudeMock` pattern from
// `digraphs-th-content.spec.ts`) — but the sub-to-10 canon on disk
// uses a different fact pool than this spec's synthetic fixture
// (canon P4 = `10 - 3 = 7`, no in-range wrong-op trap), so naive
// canon-on-disk read would not exercise the Class 2 logic. Tests 1
// and 3 should be revisited once the spec → canon → fixture
// alignment can be redesigned together; until then they will stay
// RED-for-wrong-reason on chromium headless. Test 2 (P1 gentle,
// no walk) reads chips at P1 without advancing, so it works with
// just the canon-landed gate + chromium skip.

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
 * Sub-to-10 plan placing `9 - 1 = 8` at problem index 4 (discriminate-tier
 * Class-2 wrong-op trap = `9 + 1 = 10`, in range). The other 7 problems
 * are valid sub-to-10 pool facts; none materially affect the assertions
 * below, but they're shaped per the spec to keep the rendered plan
 * coherent.
 */
function cannedSubToTenWithProblem4WrongOp() {
  const problems = [
    {
      idx: 1,
      mW: 'Ten',
      sW: 'five',
      minuend: 10,
      subtrahend: 5,
      ans: 5,
      ansW: 'Five',
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
      mW: 'Nine',
      sW: 'one',
      minuend: 9,
      subtrahend: 1,
      ans: 8,
      ansW: 'Eight',
    },
    {
      idx: 5,
      mW: 'Ten',
      sW: 'three',
      minuend: 10,
      subtrahend: 3,
      ans: 7,
      ansW: 'Seven',
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
      mW: 'Nine',
      sW: 'four',
      minuend: 9,
      subtrahend: 4,
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

/**
 * Sub-to-10 plan placing `9 - 1 = 8` at problem index 1 (gentle tier).
 * Gentle ramp uses Class 0 distractors regardless of operation; the
 * wrong-op value `10` must NOT appear.
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

/**
 * add-to-10 plan placing `5 + 3 = 8` at problem index 4 (discriminate
 * tier). Class 2 is sub-only — even at P4 the addition plan must NOT
 * carry `|5 - 3| = 2` as a distractor (spec §3.5).
 */
function cannedAddToTenWithProblem4Trap() {
  const problems = [
    {
      idx: 1,
      mW: 'One',
      sW: 'one',
      minuend: 1,
      subtrahend: 1,
      ans: 2,
      ansW: 'Two',
    },
    {
      idx: 2,
      mW: 'Two',
      sW: 'one',
      minuend: 2,
      subtrahend: 1,
      ans: 3,
      ansW: 'Three',
    },
    {
      idx: 3,
      mW: 'Two',
      sW: 'two',
      minuend: 2,
      subtrahend: 2,
      ans: 4,
      ansW: 'Four',
    },
    {
      idx: 4,
      mW: 'Five',
      sW: 'three',
      minuend: 5,
      subtrahend: 3,
      ans: 8,
      ansW: 'Eight',
    },
    {
      idx: 5,
      mW: 'Four',
      sW: 'two',
      minuend: 4,
      subtrahend: 2,
      ans: 6,
      ansW: 'Six',
    },
    {
      idx: 6,
      mW: 'Three',
      sW: 'four',
      minuend: 3,
      subtrahend: 4,
      ans: 7,
      ansW: 'Seven',
    },
    {
      idx: 7,
      mW: 'Four',
      sW: 'four',
      minuend: 4,
      subtrahend: 4,
      ans: 8,
      ansW: 'Eight',
    },
    {
      idx: 8,
      mW: 'Five',
      sW: 'four',
      minuend: 5,
      subtrahend: 4,
      ans: 9,
      ansW: 'Nine',
    },
  ]
  return mkResponse(
    'sums-to-10-warm-up',
    'Sums to 10 — warm up',
    problems,
    'plus',
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
  // The math screen renders exactly ONE problem at a time. The chip row
  // for the current problem is the only `math-chips` block in the DOM.
  // We advance to `problemIndex` by tapping the correct chip
  // (problemIndex - 1) times.
  for (let i = 1; i < problemIndex; i++) {
    const correctChip = page.locator(
      '[data-testid="math-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 15_000 })
    await correctChip.click()
    // Brief pause so the next problem mounts.
    await page.waitForTimeout(1500)
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
  // STOPGAP — chip-walk hang on chromium headless.
  //
  // Without forceHowlerUnlock, silent-MP3 placeholder bytes leave
  // Howler.ctx suspended → Math.tsx's read-aloud effect short-circuits
  // → chips never enable → readChipValuesAtProblem hangs at P1→P2.
  // forceHowlerUnlock itself causes a silent fallback to the static
  // rotation plan (per testing-and-ci.md §4.1.2 + empirically
  // extended in `feedback_force_howler_unlock_demote_extension`), which
  // masks the canned plan's distractor content — the very thing this
  // spec asserts on.
  //
  // Re-enable when one of:
  //   (a) a sub-to-10 canon variant with P4 = Class-2-eligible
  //       subtraction is baked + read via the
  //       `installDigraphsThClaudeMock`-style pattern from
  //       `digraphs-th-content.spec.ts`; or
  //   (b) `__testInitiallyAudioUnlocked` (or equivalent test seam) is
  //       plumbed through Math.tsx so Howler.ctx can be marked
  //       running without the silent-fallback demote firing.
  //
  // Tracked as a follow-up; per orchestrator dispatch 2026-05-16 the
  // sub-to-10 wave ships with this test fixme-d. The render layer
  // (PR #241, merged) ALREADY satisfies the §3.2 wrong-op trap via
  // PR 1's distractors-test.ts unit coverage (`pickDistractors` returns
  // `[10, 7]` for the 9-1=8 / wrong-op case); the structural lever
  // remains an E2E gap.
  test.fixme('problem 4 (discriminate tier) with 9-1=8 carries `10` as the wrong-op trap distractor', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    // 4-session walk-through: tap correct 3 times to reach problem 4,
    // then read chips. Bump test timeout for safety on slow CI runners.
    test.setTimeout(120_000)

    await installMathMockReturning(page, cannedSubToTenWithProblem4WrongOp)
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

    // Canon-landed addend gate (PR #242 precedent). Wait for the canned
    // plan's P1 addends (`10 - 5 = 5`) before walking through chips, so
    // every distractor read fires against canon, not static fallback.
    // KNOWN LIMITATION (see file header): chip walk to P4 will hang on
    // chromium headless because silent-MP3 placeholders leave Howler
    // suspended → chips never enable. Tracked as a structural follow-up.
    await expect(page.getByTestId('math-addend-a')).toHaveText('10', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('5', {
      timeout: 15_000,
    })

    const valuesAtP4 = await readChipValuesAtProblem(page, 4)

    // Failing-first lever — `10` is the wrong-op trap for `9 - 1 = 8`
    // (minuend + subtrahend). On RED, the parser falls back to the
    // static addition plan; problem 4's chips do NOT contain 10.
    // Count-based assertion per `feedback_count_assertions_on_regression_tests`.
    expect(valuesAtP4).toHaveLength(3)
    const tenCount = valuesAtP4.filter((v) => v === 10).length
    expect(tenCount).toBe(1)
    // The correct answer 8 must also be among the chips.
    const eightCount = valuesAtP4.filter((v) => v === 8).length
    expect(eightCount).toBe(1)
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

  // STOPGAP — chip-walk hang on chromium headless (same root cause
  // as the first test in this file; see header note). Re-enable when
  // the structural audio fixture is in place. Class-2-is-sub-only is
  // unit-tested in `distractors.test.ts` (pickDistractors with
  // op === '+' never dispatches the wrong-op branch).
  test.fixme('add-to-10 problem 4 with 5+3=8 does NOT carry `2` (Class 2 is sub-only per spec §3.5)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(120_000)

    await installMathMockReturning(page, cannedAddToTenWithProblem4Trap)
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

    // Canon-landed addend gate (PR #242 precedent). P1 of this fixture
    // is `1 + 1 = 2`. KNOWN LIMITATION (see file header): chip walk to
    // P4 will hang on chromium headless because silent-MP3 placeholders
    // leave Howler suspended → chips never enable.
    await expect(page.getByTestId('math-addend-a')).toHaveText('1', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('1', {
      timeout: 15_000,
    })

    const valuesAtP4 = await readChipValuesAtProblem(page, 4)

    expect(valuesAtP4).toHaveLength(3)
    // Counter-test — Class 2 is sub-only. `|5 - 3| = 2` must NOT appear
    // as a distractor on an add-to-10 problem.
    const twoCount = valuesAtP4.filter((v) => v === 2).length
    expect(twoCount).toBe(0)
    // Correct answer 8 must be present.
    const eightCount = valuesAtP4.filter((v) => v === 8).length
    expect(eightCount).toBe(1)
  })
})
