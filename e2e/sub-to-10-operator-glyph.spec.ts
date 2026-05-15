/**
 * E2E spec — `sub-to-10` operator glyph rendering.
 *
 * Paired with Devon's PR 2 (`feat/sub-to-10-render`) — render-layer
 * work: operator glyph (− vs +), chip-0 rendering, FlowerGroup skip
 * on subtraction, dotCard op-gate.
 *
 * What this spec asserts (per Kyle's spec §13 "PR 2 — render + parser")
 * ---------------------------------------------------------------------
 *  - For a sub-to-10 plan (`op: '-'`), the `math-symbolic` row displays
 *    the U+2212 MINUS SIGN (`−`), NOT a plus sign and NOT an ASCII
 *    hyphen-minus.
 *  - Counter-test: for an add-to-10 plan (`op: '+'`), the row displays
 *    `+`. Regression-lock guarding Devon's PR 2 against accidentally
 *    flipping the operator on the addition path.
 *
 * Failing-First Verification Protocol (per `.claude/agents/jessica.md`)
 * ---------------------------------------------------------------------
 *  - Subtraction assertion: **RED-on-base lever**. On `main` (commit
 *    `1da454c`, post PR #240 merge) the operator glyph is hard-coded
 *    to `+` at [`Math.tsx:2166`](../../src/screens/Math/Math.tsx#L2166)
 *    — `<span aria-hidden>+</span>`. A sub-to-10 problem renders
 *    `5 + 5 = ?` instead of `5 − 5 = ?`. Devon's PR 2 reads
 *    `currentProblem.op` and renders the correct glyph.
 *  - Addition assertion: **regression-lock**. Already correct on `main`;
 *    must keep passing after Devon's PR 2 lands.
 *
 * Out of scope
 * ------------
 *  - The captioned (read-aloud) text — separate spec
 *    `sub-to-10-read-line-take-away`.
 *  - Audio pronunciation of "−" / "minus" / "take away" — Thomas's
 *    ear-test lane.
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'

// ── Audio fixture ────────────────────────────────────────────────────────────

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
 * Sub-to-10 plan; all 8 problems use the "minus" template so
 * `parseReadOperands` (already widened on `main` post PR #240) emits
 * `op: '-'` for every problem.
 *
 * Problem 1 = `5 - 3 = 2` — both operands non-zero, in range; chip
 * generation doesn't touch the chip-0 path (that's a separate spec).
 */
function cannedSubToTenResponse() {
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
 * Add-to-10 plan; all 8 problems use the "plus" template so
 * `parseReadOperands` emits `op: '+'`. Counter-test regression-lock for
 * the addition path.
 */
function cannedAddToTenResponse() {
  const problems = [
    { idx: 1, aW: 'Three', bW: 'two', a: 3, b: 2, ans: 5, ansW: 'Five' },
    { idx: 2, aW: 'One', bW: 'four', a: 1, b: 4, ans: 5, ansW: 'Five' },
    { idx: 3, aW: 'Two', bW: 'two', a: 2, b: 2, ans: 4, ansW: 'Four' },
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

/** Seed Marian so the math focus-node picker lands on `sub-to-10`. */
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

/** Seed Marian so the math focus-node picker lands on `add-to-10`. */
function buildAddToTenSeedProgress(): unknown {
  const blob = buildSubToTenSeedProgress() as {
    skillLevels: Record<string, string>
  }
  blob.skillLevels['add-to-10'] = 'practicing'
  blob.skillLevels['add-to-20'] = 'locked'
  blob.skillLevels['sub-to-10'] = 'mastered'
  return blob
}

// ── Shared navigation helper ─────────────────────────────────────────────────

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

// ── Spec ─────────────────────────────────────────────────────────────────────

test.describe('sub-to-10 operator glyph (PR 2 of 2 — render layer)', () => {
  test('subtraction problem renders the MINUS SIGN (U+2212) in math-symbolic', async ({
    page,
  }) => {
    await installClaudeMock(page, {
      mathResponse: cannedSubToTenResponse,
    })
    await seedLocalStorage(page, {
      progress: buildSubToTenSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)
    await navigateToMath(page)

    // Read the symbolic-row text. On RED main, hardcoded `+` shows.
    // On GREEN (PR 2), Devon reads `currentProblem.op` and renders `−`.
    const symbolicText =
      (await page.getByTestId('math-symbolic').textContent())?.trim() ?? ''

    // ── RED-on-base lever ────────────────────────────────────────────────────
    //
    // Assertion: the math-symbolic text contains U+2212 (MINUS SIGN).
    // On RED main (commit 1da454c), the hard-coded `<span>+</span>` at
    // Math.tsx:2166 means the text is `5 + 3 = ?` — no U+2212. The
    // .toBe(true) assertion is count-based per
    // feedback_count_assertions_on_regression_tests (single boolean
    // value, not `.toContain`).
    expect(symbolicText.includes('−')).toBe(true)

    // Sanity sub-assertion: the addend digits ARE present (the screen
    // didn't render an empty symbolic row).
    const addendAText = await page.getByTestId('math-addend-a').textContent()
    const addendBText = await page.getByTestId('math-addend-b').textContent()
    expect(addendAText?.trim()).toBe('5')
    expect(addendBText?.trim()).toBe('3')
  })

  test('addition problem renders + in math-symbolic (regression-lock — Devon must keep this passing)', async ({
    page,
  }) => {
    await installClaudeMock(page, {
      mathResponse: cannedAddToTenResponse,
    })
    await seedLocalStorage(page, {
      progress: buildAddToTenSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)
    await navigateToMath(page)

    const symbolicText =
      (await page.getByTestId('math-symbolic').textContent())?.trim() ?? ''

    // ── Regression-lock ──────────────────────────────────────────────────────
    //
    // The addition path already renders `+` correctly on RED main. This
    // assertion is the guard that ensures Devon's PR 2 (which gates the
    // operator-glyph render on `op`) doesn't accidentally break the
    // addition path while wiring subtraction.
    expect(symbolicText.includes('+')).toBe(true)
    // The minus glyph must NOT appear on an addition problem.
    expect(symbolicText.includes('−')).toBe(false)

    // Sanity sub-assertion: addends from the canned plan.
    const addendAText = await page.getByTestId('math-addend-a').textContent()
    const addendBText = await page.getByTestId('math-addend-b').textContent()
    expect(addendAText?.trim()).toBe('3')
    expect(addendBText?.trim()).toBe('2')
  })
})
