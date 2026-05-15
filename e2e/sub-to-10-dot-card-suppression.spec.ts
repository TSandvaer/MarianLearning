/**
 * E2E spec — dot-card overlay is SUPPRESSED on `sub-to-10` problems.
 *
 * Paired with Devon's PR 2 (`feat/sub-to-10-render`).
 *
 * Background
 * ----------
 * The subitising dot-card overlay (ticket 86c9q5j9a, Kyle's spec
 * `design/screen-math-subitising-prompt.md`) fires on Math problems
 * when both addends are in `[1, 5]`. The predicate at
 * [`dotCard.ts:67`](../../src/screens/Math/dotCard.ts#L67) is
 * **op-blind** today:
 *
 *     export function shouldShowDotCard(problem: MathProblem): boolean {
 *       const { addendA, addendB } = problem
 *       if (!Number.isInteger(addendA) || ...) return false
 *       if (addendA < 1 || addendA > 5) return false
 *       if (addendB < 1 || addendB > 5) return false
 *       return true
 *     }
 *
 * In v1 the predicate's structural-only behaviour was acceptable
 * because Math.tsx only routed `add-to-10` and `add-to-20` problems,
 * and the latter always carry at least one addend ≥ 6 (sum ≥ 11)
 * (see [`dotCard.ts:9-20`](../../src/screens/Math/dotCard.ts#L9-L20)
 * "Why structural-only").
 *
 * Sub-to-10 changes that. Kyle's content pool (§1.1) includes facts
 * like `5 - 3 = 2`, `5 - 5 = 0`, `8 - 4 = 4` where both operands are
 * `≤ 5`. The dot-card primitive (Kyle's spec § "Visual style decision")
 * is a subitising recognition cue — `addendA + addendB` pips arranged
 * as dice faces. It is **representational of an addition affordance**:
 * "look, this many here plus this many there." Applying it to
 * subtraction (`pipsA = minuend; pipsB = subtrahend`) would visually
 * imply addition of the pips, which is the exact wrong-operation
 * mental model Kyle's spec §3.2 wrong-op distractor exists to
 * confront. The dot-card MUST therefore be suppressed for
 * `op === '-'` problems regardless of operand size.
 *
 * Devon's PR 2 wires the op-gate at the predicate level — extending
 * `shouldShowDotCard` to also return `false` when `problem.op === '-'`
 * (consistent with the predicate's "structural-only" posture by
 * widening its definition of "structural" to include the operator).
 *
 * What this spec asserts
 * ----------------------
 *  1. **Suppression assertion (RED-on-base lever).** A sub-to-10
 *     plan with `5 - 3 = 2` at problem index 1 — both operands ≤ 5 —
 *     mounts ZERO `math-dot-card` elements.
 *  2. **Counter-test (regression-lock).** An add-to-10 plan with
 *     `3 + 4 = 7` at problem index 1 — both addends ≤ 5 — DOES mount
 *     exactly ONE `math-dot-card`. Guards against accidentally
 *     over-gating the predicate and silently disabling dot-cards on
 *     the addition tier.
 *
 * Failing-First Verification Protocol
 * -----------------------------------
 *  - Assertion 1 (sub-to-10 suppression): **RED-on-base lever**. On
 *    RED main, the predicate is op-blind — `shouldShowDotCard` returns
 *    `true` for `5 - 3 = 2` (both operands in [1, 5]); the overlay
 *    mounts; the assertion `count === 0` fails.
 *  - Assertion 2 (add-to-10 mounts): **regression-lock**. Passes on
 *    RED main; must keep passing after PR 2 lands.
 *
 * Out of scope
 * ------------
 *  - The operator glyph (separate spec `sub-to-10-operator-glyph`).
 *  - The `FlowerGroup` skip on subtraction — also PR 2's render work;
 *    not exercised here because the dot-card overlay's mount is the
 *    sharper RED-lever (`shouldShowDotCard` is the predicate Devon
 *    revises). FlowerGroup behaviour is covered by Devon's unit tests
 *    in [`Math.test.tsx`](../../src/screens/Math/Math.test.tsx).
 *  - Audio pronunciation — Thomas's ear-test.
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

// NOTE on `forceHowlerUnlock`
// ---------------------------
// We deliberately do NOT call `forceHowlerUnlock(page)` in this spec —
// see the matching note in `sub-to-10-operator-glyph.spec.ts` for the
// full rationale (testing-and-ci.md §4.1.2: the helper's WebKit
// stub-shape `Howler.ctx = { state: 'running' }` is not a real
// `AudioContext`, so real-bytes canned plans hit
// `connect() on AudioNode` errors and silently fall back to static).
//
// Hub-tree-node click IS the first gesture. Spec is chromium-only by
// Playwright project config.

const SILENT_MP3 =
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAA8TEFNRTMuMTAwBLgAAAAAAAAAABRAJAUHQQAB4AAAAk8tnaAyAAAAAA=='

function audio() {
  return {
    kind: 'inline' as const,
    base64: SILENT_MP3,
    mime: 'audio/mpeg' as const,
  }
}

// ── Canned plan factories ────────────────────────────────────────────────────

/**
 * Sub-to-10 plan placing `5 - 3 = 2` at problem index 1 (both operands
 * ≤ 5; on RED main this trips `shouldShowDotCard` → true and the
 * overlay mounts). The other 7 problems are the same as Spec 1's pool.
 */
function cannedSubToTenSmallOperandsAtP1() {
  const problems = [
    {
      idx: 1,
      mW: 'Five',
      sW: 'three',
      minuend: 5,
      subtrahend: 3,
      ans: 2,
      ansW: 'Two',
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
      mW: 'Eight',
      sW: 'three',
      minuend: 8,
      subtrahend: 3,
      ans: 5,
      ansW: 'Five',
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
  const utterances = problems.flatMap((p) => [
    {
      id: `math.p${p.idx}.read`,
      text: `${p.mW} minus ${p.sW}. How many are left?`,
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
      text: `Look. ${p.mW}. Take away ${p.sW}. How many now?`,
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
      id: 'sub-to-10-level-1',
      label: 'Subtraction within 10 — Level 1',
      utterances: utterances.map((u) => ({ id: u.id, text: u.text })),
    },
    utterances,
  }
}

/**
 * Add-to-10 plan placing `3 + 4 = 7` at problem index 1 — both addends
 * ≤ 5 → dot-card overlay MUST mount. Counter-test fixture.
 */
function cannedAddToTenSmallAddendsAtP1() {
  const problems = [
    { idx: 1, aW: 'Three', bW: 'four', a: 3, b: 4, ans: 7, ansW: 'Seven' },
    { idx: 2, aW: 'One', bW: 'two', a: 1, b: 2, ans: 3, ansW: 'Three' },
    { idx: 3, aW: 'Two', bW: 'three', a: 2, b: 3, ans: 5, ansW: 'Five' },
    { idx: 4, aW: 'Three', bW: 'four', a: 3, b: 4, ans: 7, ansW: 'Seven' },
    { idx: 5, aW: 'Five', bW: 'four', a: 5, b: 4, ans: 9, ansW: 'Nine' },
    { idx: 6, aW: 'Two', bW: 'six', a: 2, b: 6, ans: 8, ansW: 'Eight' },
    { idx: 7, aW: 'Three', bW: 'six', a: 3, b: 6, ans: 9, ansW: 'Nine' },
    { idx: 8, aW: 'Four', bW: 'six', a: 4, b: 6, ans: 10, ansW: 'Ten' },
  ]
  const utterances = problems.flatMap((p) => [
    {
      id: `math.p${p.idx}.read`,
      text: `${p.aW} plus ${p.bW}. How many?`,
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
      text: `Look. ${p.aW}. And ${p.bW} more. How many now?`,
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
      id: 'add-to-10-level-1',
      label: 'Addition within 10 — Level 1',
      utterances: utterances.map((u) => ({ id: u.id, text: u.text })),
    },
    utterances,
  }
}

// ── Seed builders ────────────────────────────────────────────────────────────

function buildSubToTenSeedProgress(): unknown {
  return {
    schemaVersion: 1,
    profile: { childName: 'Marian', character: 'melody', lastPlayedISO: null },
    skillLevels: {
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'practicing',
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
  }
}

function buildAddToTenSeedProgress(): unknown {
  const blob = buildSubToTenSeedProgress() as {
    skillLevels: Record<string, string>
  }
  blob.skillLevels['add-to-10'] = 'practicing'
  blob.skillLevels['add-to-20'] = 'locked'
  blob.skillLevels['sub-to-10'] = 'mastered'
  return blob
}

async function navigateToMath(page: Page) {
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  await page
    .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
    .click()
  await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('math-symbolic')).toBeVisible({
    timeout: 15_000,
  })
}

// ── WebKit-headless skip ─────────────────────────────────────────────────────
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → real-bytes canned plan cannot decode; spec is chromium-only.',
  )
}

// ── Spec ─────────────────────────────────────────────────────────────────────

test.describe('sub-to-10 dot-card suppression (PR 2 of 2 — render layer)', () => {
  test('sub-to-10 problem with both operands ≤ 5 does NOT mount math-dot-card', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installClaudeMock(page, {
      mathResponse: cannedSubToTenSmallOperandsAtP1,
    })
    await seedLocalStorage(page, {
      progress: buildSubToTenSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await navigateToMath(page)

    // Wait until the canon-derived plan has settled — the addends from
    // the canned plan (`5 - 3 = 2`) become visible. This is the
    // canon-landed gate.
    await expect(page.getByTestId('math-addend-a')).toHaveText('5', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('3', {
      timeout: 15_000,
    })

    // ── RED-on-base lever ───────────────────────────────────────────────────
    //
    // Read `data-flowers-visible` as a one-shot snapshot at the moment
    // the canon-derived addends are on screen. Per
    // [`Math.tsx:2202`](../../src/screens/Math/Math.tsx#L2202) this
    // attribute is `"false"` while the dot-card overlay is mounted
    // (flowers cross-faded out) and `"true"` otherwise.
    //
    // On RED main, the predicate `shouldShowDotCard` is op-blind and
    // returns `true` for `5 - 3 = 2` (both operands in `[1, 5]`); the
    // overlay mounts at problem-mount time; flowers go `data-flowers-
    // visible="false"`. On GREEN (Devon's PR 2 op-gate), the overlay
    // never mounts; flowers stay `data-flowers-visible="true"` from
    // first paint.
    //
    // Important — we use a **snapshot read** (`.getAttribute()` once)
    // rather than `.toHaveAttribute(...)` (which polls and converges).
    // Polling would silently absorb the dot-card's natural 1.1s
    // unmount on RED — the attribute flips `"false"` → `"true"` once
    // the overlay completes, so a polling assertion would eventually
    // see `"true"` and pass for the wrong reason.
    const flowersVisible = await page
      .getByTestId('math-visual-groups')
      .getAttribute('data-flowers-visible')
    expect(flowersVisible).toBe('true')

    // Belt-and-suspenders count assertion. On the GREEN side the cells
    // were never mounted at all, so a one-shot read of the cell count
    // is also `0`. On RED, the cells are still mounted at this point
    // and count is `2`.
    const dotCardCount = await page.getByTestId('math-dot-card').count()
    expect(dotCardCount).toBe(0)
    const dotCardCellCount = await page
      .getByTestId('math-dot-card-cell')
      .count()
    expect(dotCardCellCount).toBe(0)
  })

  test('add-to-10 problem with both addends ≤ 5 DOES mount math-dot-card (regression-lock)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installClaudeMock(page, {
      mathResponse: cannedAddToTenSmallAddendsAtP1,
    })
    await seedLocalStorage(page, {
      progress: buildAddToTenSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await navigateToMath(page)

    // Wait until the canon-derived plan has settled — addends from the
    // canned add-to-10 plan (`3 + 4 = 7`).
    await expect(page.getByTestId('math-addend-a')).toHaveText('3', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('4', {
      timeout: 15_000,
    })

    // ── Regression-lock ─────────────────────────────────────────────────────
    //
    // The dot-card overlay mounts on add-to-10 with small addends.
    // We assert at the same moment as the canon-landed gate — both
    // before the dot-card's natural ~1.1s lifecycle ends. Pattern
    // mirrors the sub-to-10 assertion above (snapshot read of
    // `data-flowers-visible`) so a future regression that prematurely
    // unmounts the overlay surfaces here.
    const flowersVisible = await page
      .getByTestId('math-visual-groups')
      .getAttribute('data-flowers-visible')
    expect(flowersVisible).toBe('false')

    // The cells are mounted alongside the overlay container. Using
    // `toHaveCount(2)` with the default expect.timeout polls until the
    // count matches; if Devon's PR 2 accidentally over-gates and
    // prevents the overlay from mounting at all, the count stays `0`
    // for the full polling window and the assertion fails.
    await expect(page.getByTestId('math-dot-card-cell')).toHaveCount(2, {
      timeout: 5_000,
    })
    await expect(page.getByTestId('math-dot-card')).toHaveCount(1)
  })
})
