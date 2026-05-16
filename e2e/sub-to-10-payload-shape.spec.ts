/**
 * E2E spec — `sub-to-10` planner payload contract.
 *
 * Paired with Kevin's PR 1 (`feat/sub-to-10-content`) per the
 * `feedback_progression_e2e_mandatory` memory: Kevin's PR touches
 * `firstEncounterGate.ts` + `defaults.ts` + slow-fact threshold
 * (progression-state-machine adjacent).
 *
 * Failing-first contract (per `testing-and-ci.md` §6 + the spec at
 * `design/math/sub-to-10-content.md`)
 * ----------------------------------------------------------------
 * Seed Marian with:
 *   - `add-to-10`     mastered
 *   - `add-to-20`     mastered
 *   - `sub-to-10`     practicing
 *
 * On RED main (commit `ea9e53a`):
 *   1. `defaults.ts` ships `sub-to-10: 'mastered'` per the April-2026
 *      diagnostic baseline. The mirrored constant in
 *      `e2e/_helpers/seedStorage.ts:DEFAULT_SKILL_LEVELS` mirrors that
 *      (line 54: `'sub-to-10': 'mastered'`). The seed override below
 *      explicitly sets it to `'practicing'` so the picker walks past
 *      `add-to-10` (mastered) + `add-to-20` (mastered) and lands on
 *      `sub-to-10`. Kevin's PR 1 (Thomas's decision #1) flips the
 *      default itself to `'practicing'`; the override here keeps the
 *      test stable across the flip.
 *   2. `pickFocusNode` walks `MATH_NODES_IN_ORDER` and lands on
 *      `'sub-to-10'`. The math request payload carries
 *      `payload.progress.focusNode === 'sub-to-10'`. **This half is
 *      already true on RED** — the picker logic already knows the
 *      node.
 *   3. The server returns a canned sub-to-10 plan with 8 problems
 *      all `op === '-'` and `read` lines following the
 *      `"<minuend> minus <subtrahend>. How many are left?"` template.
 *   4. **`planFromServer.ts:parseReadAddends` on RED is anchored to
 *      `"<addend-A-word> plus <addend-B-word>. How many?"` only.** A
 *      minus / take-away read-line throws `PlanFromServerError`. The
 *      screen falls back to `pickStaticSessionPlan()` (addition).
 *   5. The rendered chip with `data-correct="true"` carries the
 *      ADDITION correct answer for the static fallback's problem 1
 *      (any sum 1..10), NOT the SUBTRACTION correct answer expected
 *      from the canned plan. The assertion `data-value === '<canned
 *      subtraction answer>'` fails.
 *
 * On GREEN (Kevin's PR 1): `planFromServer.ts` accepts the new
 * read-line templates and tags `op: '-'`; the screen renders the
 * canned plan; the chip's `data-value` matches the expected
 * subtraction answer.
 *
 * Out of scope (PR 2 territory)
 * ----------------------------
 * - The operator glyph rendered on `Math.tsx` (visual).
 * - Chip-0 rendering when `correct === 0` (visual).
 * - Read-line "take away" Azure pronunciation (ear-test).
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import {
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

// NOTE on `forceHowlerUnlock`
// ---------------------------
// We deliberately do NOT call `forceHowlerUnlock(page)` in this spec.
// Per `.claude/docs/testing-and-ci.md` §4.1.2 + the empirical finding
// from PR #242, the helper's WebKit stub-shape
// `Howler.ctx = { state: 'running' }` is incompatible with a canned
// plan (even one carrying silent-placeholder MP3 bytes) — Howler's
// downstream `connect()` calls throw `TypeError: Failed to execute
// 'connect' on 'AudioNode'` during decode, `prepareMathPathA` rejects,
// and Math.tsx silently falls back to the static rotation plan. That
// fallback masks the canned plan content and the chip-value assertion
// below becomes unsatisfiable (we'd snapshot the static addition
// fallback's chip, never the canned `10 - 5 = 5` chip).
//
// Production reality: the user's first tap on the Hub tree node IS the
// first gesture in the chain. Howler's document-level click listener
// installs after the first `new Howl(...)` (which happens during
// `prepareMathPathA`'s `loadAudio` call). chromium headless runs this
// chain naturally. WebKit headless has no `AudioContext`, so this spec
// is chromium-only via `skipOnWebkitHeadless` — same posture as
// `sub-to-10-chip-zero-render.spec.ts` (PR #242 precedent).

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

// ── Canned sub-to-10 plan factory ────────────────────────────────────────────
//
// Returns a `SessionStartResponse`-shaped object whose plan + utterances
// carry 8 subtraction problems, all `op === '-'`, drawn from the locked
// 22-fact pool in `design/math/sub-to-10-content.md` §1.1.
//
// Problem 1 is `10 - 5 = 5` (easy band, doubles); the canned plan's other
// problems are not asserted by this spec.

const SILENT_MP3 =
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAA8TEFNRTMuMTAwBLgAAAAAAAAAABRAJAUHQQAB4AAAAk8tnaAyAAAAAA=='

function audio() {
  return {
    kind: 'inline' as const,
    base64: SILENT_MP3,
    mime: 'audio/mpeg' as const,
  }
}

function cannedSubToTenResponse() {
  // 8 facts from the §1.1 pool, problem index 1 is the load-bearing one
  // for this spec's assertion.
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
      mW: 'Nine',
      sW: 'one',
      minuend: 9,
      subtrahend: 1,
      ans: 8,
      ansW: 'Eight',
    },
    {
      idx: 4,
      mW: 'Ten',
      sW: 'two',
      minuend: 10,
      subtrahend: 2,
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

/** Cap MATH_CORRECT_FOR_PROBLEM_1 — the chip data-value we assert against. */
const PROBLEM_1_CORRECT_ANSWER = 5

// ── Local mock with request capture ──────────────────────────────────────────

async function installCapturingMathMock(
  page: Page,
): Promise<{ requests: Request[] }> {
  const requests: Request[] = []
  await page.route('**/api/claude', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
        body: '',
      })
      return
    }
    if (req.method() !== 'POST') {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: '{}',
      })
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
        body: JSON.stringify(cannedSubToTenResponse()),
      })
      return
    }
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'unexpected-track',
        message: `sub-to-10 spec is math-only; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

// ── Seed builder — sub-to-10 reachable as the focus node ─────────────────────

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

function mathRequests(requests: ReadonlyArray<Request>): Request[] {
  return requests.filter((r) => {
    try {
      const body = JSON.parse(r.postData() ?? '{}') as Record<string, unknown>
      const payload = body.payload as Record<string, unknown> | undefined
      return payload?.track === 'math'
    } catch {
      return false
    }
  })
}

// ── Spec ────────────────────────────────────────────────────────────────────

test.describe('sub-to-10 planner payload contract', () => {
  test('math request payload carries track=math, focusNode=sub-to-10, and the screen renders the canned subtraction plan', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    const { requests } = await installCapturingMathMock(page)
    await seedLocalStorage(page, {
      progress: buildSubToTenSeedProgress(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')

    // Hub → Number Garden → Math.
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Wait until at least one math request has landed at the mock.
    await expect
      .poll(() => mathRequests(requests).length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1)

    const mathReqs = mathRequests(requests)
    expect(mathReqs).toHaveLength(1)

    // ── Assertion A — payload shape ───────────────────────────────────────────
    const raw = mathReqs[0]!.postData() ?? '{}'
    const body = JSON.parse(raw) as Record<string, unknown>
    expect(body.kind).toBe('session-start')
    const payload = body.payload as Record<string, unknown>
    expect(payload.track).toBe('math')

    const progressBlock = payload.progress as
      | Record<string, unknown>
      | undefined
    expect(progressBlock, 'progress block must be present').toBeDefined()
    expect(progressBlock!.focusNode).toBe('sub-to-10')

    // ── Canon-landed addend gate (PR #242 precedent) ──────────────────────────
    //
    // Without this gate we'd snapshot the static-fallback DOM in the
    // cold-mount window before the canon plan arrived (or, on RED main,
    // before the parser-fallback static plan replaces it). Wait for the
    // addends from the canned plan (`10 - 5 = 5`) to land on screen so
    // every assertion below fires against the canon-served plan, not a
    // static-rotation artifact.
    await expect(page.getByTestId('math-addend-a')).toHaveText('10', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('5', {
      timeout: 15_000,
    })

    // ── Assertion B — the canned plan renders ─────────────────────────────────
    //
    // Failing-first lever. On RED `main`, `planFromServer.parseReadAddends`
    // only accepts the "X plus Y. How many?" template. Our canned response
    // uses "Ten minus five. How many are left?" → the parser throws,
    // App.tsx catches, and the screen falls back to `pickStaticSessionPlan()`
    // which carries ADDITION facts. The canon-landed gate above would also
    // fail in that scenario — addends would be the static fallback's
    // problem 1 (e.g. `1 + 1`), not the canned `10 - 5`.
    //
    // On GREEN (Kevin's PR 1): the parser accepts "X minus Y. How many are
    // left?", tags `op: '-'`, and rehydrates the canned plan. The first
    // problem's correct chip has `data-value="5"` per the canned
    // `10 - 5 = 5` fact.
    const correctChip = page.locator(
      '[data-testid="math-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeVisible({ timeout: 15_000 })
    const dataValue = await correctChip.getAttribute('data-value')
    expect(dataValue).toBe(String(PROBLEM_1_CORRECT_ANSWER))
  })
})
