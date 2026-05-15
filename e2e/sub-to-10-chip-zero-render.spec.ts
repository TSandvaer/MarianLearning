/**
 * E2E spec — chip-`0` rendering for `sub-to-10` subtract-self facts.
 *
 * Paired with Devon's PR 2 (`feat/sub-to-10-render`).
 *
 * Background (Kyle's spec §3.3, §11 Q3)
 * -------------------------------------
 * Two pool facts produce `correct === 0` — `5 - 5 = 0` and `8 - 8 = 0`
 * (subtract-self). Thomas locked Option A on 2026-05-15: widen the chip
 * range so `0` is a valid chip value for `op === '-'` problems. PR 1
 * (#240) wired the schema + planner directive + distractor logic
 * accordingly. The remaining piece — **the screen actually wires `op`
 * through to `pickDistractors`** — is PR 2's render-layer work.
 *
 * Why this fails on RED main today
 * --------------------------------
 * [`Math.tsx:2512`](../../src/screens/Math/Math.tsx#L2512):
 *
 *     pickDistractors(problem.correct, problem.index, maxAnswer)
 *
 * `op` and the `opts` object are NOT passed. `pickDistractors` defaults
 * `op = '+'` → `minAnswer = 1` (per the `op === '-' ? 0 : 1` ternary at
 * [`distractors.ts:193`](../../src/screens/Math/distractors.ts#L193)).
 * The range check at lines 203-211 then throws:
 *
 *     "[distractors] correct=0 is outside [1, 10]"
 *
 * because `correct = 0 < minAnswer = 1`. The throw escapes the
 * `useMemo` and Math.tsx crashes at chip-build time. Chips do not
 * render; the assertion below (`data-value="0"` chip is present) fails
 * because no chips render at all.
 *
 * On GREEN (Devon's PR 2): Math.tsx passes `{ op: problem.op }` (and
 * `minAnswer: 0` derived from `op`), `pickDistractors` honours the
 * widened minimum, and a chip with `data-value="0"` mounts as the
 * correct chip.
 *
 * Failing-First Verification Protocol
 * -----------------------------------
 *  - Assertion 1 (chip-0 present for `5-5=0`): **RED-on-base lever**.
 *  - Assertion 2 (chip-0 ABSENT for an add-to-10 plan): **regression-
 *    lock**. `correct === 0` never happens on the addition path, so
 *    the assertion passes on `main` trivially. The guard exists so
 *    Devon's PR 2 cannot accidentally surface a `0`-chip on addition
 *    sessions while wiring the subtraction path.
 *
 * Out of scope
 * ------------
 *  - The operator glyph (separate spec `sub-to-10-operator-glyph`).
 *  - The chip ordering (deterministic via the `lcg` shuffle; not
 *    asserted here).
 *  - Audio pronunciation of "zero" — Thomas's ear-test.
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'

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
 * Sub-to-10 plan placing the `5 - 5 = 0` subtract-self fact at problem
 * index 1 — so the very first paint of the chip row exercises the
 * `correct === 0` path. The other 7 problems are valid sub-to-10 pool
 * facts; their distractors fall through normally.
 */
function cannedSubToTenWithSubtractSelfAtP1() {
  const problems = [
    {
      idx: 1,
      mW: 'Five',
      sW: 'five',
      minuend: 5,
      subtrahend: 5,
      ans: 0,
      ansW: 'Zero',
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
 * Add-to-10 plan with addends and correct answers in [3, 10]. Counter-
 * test fixture: confirms no chip with `data-value="0"` ever surfaces on
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
}

// ── Spec ─────────────────────────────────────────────────────────────────────

test.describe('sub-to-10 chip-0 rendering (PR 2 of 2 — render layer)', () => {
  test('5 - 5 = 0 problem renders a chip with data-value="0" and text content "0"', async ({
    page,
  }) => {
    await installClaudeMock(page, {
      mathResponse: cannedSubToTenWithSubtractSelfAtP1,
    })
    await seedLocalStorage(page, {
      progress: buildSubToTenSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)
    await navigateToMath(page)

    // Wait for the symbolic row to mount — same gate the other Math
    // specs use (means audioReady has flipped and chips are about to
    // render). If buildChipOrder throws on RED main, the chip row
    // never renders; the assertion below times out at `.toHaveCount(1)`.
    await expect(page.getByTestId('math-symbolic')).toBeVisible({
      timeout: 15_000,
    })

    // ── RED-on-base lever ───────────────────────────────────────────────────
    //
    // Assert exactly ONE chip with data-value="0". On GREEN (PR 2) the
    // chip mounts as the correct answer. On RED main, `pickDistractors`
    // throws on correct=0 because minAnswer defaults to 1; chips never
    // render; count is 0.
    const chipZero = page.locator('[data-testid="math-chip"][data-value="0"]')
    await expect(chipZero).toHaveCount(1, { timeout: 15_000 })

    // The chip's text content is the literal "0" — confirms the visual
    // label matches the data attribute. Counter-checks against a future
    // bug where the chip is rendered without its number label.
    await expect(chipZero).toHaveText('0')

    // The chip is flagged as correct.
    await expect(chipZero).toHaveAttribute('data-correct', 'true')

    // Sanity sub-assertion: addends from the canned plan show on screen.
    const addendAText = await page.getByTestId('math-addend-a').textContent()
    const addendBText = await page.getByTestId('math-addend-b').textContent()
    expect(addendAText?.trim()).toBe('5')
    expect(addendBText?.trim()).toBe('5')
  })

  test('chip-0 does NOT render on an add-to-10 problem (regression-lock for the addition path)', async ({
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

    // Wait for the chip row to mount so the count is meaningful.
    await expect(page.getByTestId('math-chips')).toBeVisible({
      timeout: 15_000,
    })
    // All three chips for problem 1 (correct=5; distractors gentle-tier
    // both ≥2 away from 5, biased to range extremes). None of them is 0.
    await expect(page.getByTestId('math-chip')).toHaveCount(3)

    // ── Regression-lock ─────────────────────────────────────────────────────
    //
    // On the addition path no problem produces `correct = 0`, so a
    // `data-value="0"` chip must NEVER render. This assertion passes on
    // RED main and must keep passing after Devon's PR 2.
    const chipZero = page.locator('[data-testid="math-chip"][data-value="0"]')
    await expect(chipZero).toHaveCount(0)
  })
})
