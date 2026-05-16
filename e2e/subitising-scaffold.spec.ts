/**
 * E2E spec — Subitising scaffold trigger + fluency-fade gate.
 *
 * Ticket: 86c9ur20t (Jessica, failing-first).
 * Paired with: Devon's implementation ticket (TBA — the
 * `shouldShowSubitisingScaffold()` predicate + the
 * `subitising-scaffold-dot-card` testid + the
 * `profile.subitisingScaffoldSessionsObserved` Progress field +
 * the `easyBandLeitnerMeanBox` derivation).
 *
 * Spec authority: `design/math/subitising-scaffold-content.md`
 * (Kyle, content-tier rules), with cross-references to
 * `design/screen-math-subitising-prompt.md` (Kyle, screen-layer
 * visual primitive).
 *
 * ────────────────────────────────────────────────────────────────────
 * FAILING-FIRST POSTURE — Option B (`test.fixme`)
 * ────────────────────────────────────────────────────────────────────
 *
 * Per the dispatch brief, mirroring the PR #202 progression-mastery-loop
 * pattern: every test in this spec is wrapped in `test.fixme()` until
 * Devon's implementation PR lands. Rationale:
 *
 *   - Devon's PR is not yet authored. There is no implementation
 *     branch to stack against.
 *   - On current `origin/main` the trigger predicate module
 *     (`src/screens/Math/subitisingScaffold.ts`) does NOT exist
 *     (verified at spec-authoring time, 2026-05-16). The Progress
 *     doc has no `subitisingScaffoldSessionsObserved` field; the
 *     testid `subitising-scaffold-dot-card` is nowhere in source.
 *     The existing `math-dot-card` testid (Kyle's screen-layer
 *     primitive) mounts on EVERY in-scope problem unconditionally.
 *   - The non-fixme'd assertions would RED-fail at CI immediately
 *     against current main → blocks this PR from merging until
 *     Devon's impl lands → Devon's impl can't merge cleanly because
 *     this spec sits unmerged in front of it. Classic stacked-PR
 *     dependency.
 *   - With `test.fixme()` wrappers, this spec PR is CI-green and
 *     mergeable IMMEDIATELY. A tiny follow-up PR (≤10-line diff)
 *     flips `test.fixme(` → `test(` after Devon's PR merges; CI
 *     then goes green on the GREEN-side meaning.
 *
 * NB: Option A (un-fixme'd tests, RED on base) was considered and
 * rejected. The Option B precedent (PR #202) is well-established and
 * has worked cleanly for three subsequent failing-first specs
 * (PR #206 short-e, sub-to-10 dispatch contract, digraphs-ch).
 *
 * ────────────────────────────────────────────────────────────────────
 * Coordination contract with Devon
 * ────────────────────────────────────────────────────────────────────
 *
 * The dispatch brief specifies the testid `subitising-scaffold-dot-card`
 * on Devon's rendered scaffold container. The existing screen-layer
 * primitive ships testid `math-dot-card` (per
 * `e2e/dot-card-affordance.spec.ts` + `DotCardOverlay.tsx:201`). For
 * coordination clarity, this spec asserts against
 * `subitising-scaffold-dot-card` — Devon's implementation should:
 *
 *   (a) Add `data-testid="subitising-scaffold-dot-card"` to the new
 *       gated-mount container (the one whose mount is decided by
 *       `shouldShowSubitisingScaffold()`), OR
 *   (b) Switch the existing `DotCardOverlay` container testid to
 *       `subitising-scaffold-dot-card` (renaming `math-dot-card`) AND
 *       update `e2e/dot-card-affordance.spec.ts` +
 *       `e2e/sub-to-10-dot-card-suppression.spec.ts` callsites to
 *       match.
 *
 * Either path satisfies this spec; option (a) is the minimal-blast-
 * radius default. If Devon picks (b), this docstring should be updated
 * to call out the cross-spec rename in the follow-up that flips the
 * fixmes.
 *
 * ────────────────────────────────────────────────────────────────────
 * Acceptance criteria coverage (per dispatch brief + spec §2 + §6.3)
 * ────────────────────────────────────────────────────────────────────
 *
 * AC1 (first-encounter, session 1): scaffold fires on every in-scope
 *      problem when `subitisingScaffoldSessionsObserved < 3`, regardless
 *      of Leitner mean box. — covered by Test 1.
 *
 * AC2 (out-of-scope C2 failure): scaffold does NOT mount when either
 *      addend > 5, even on the first-encounter session. — covered by
 *      Test 2.
 *
 * AC3 (post-first-encounter, fade-permanent boundary): scaffold does
 *      NOT mount once `subitisingScaffoldSessionsObserved >= 3` AND
 *      `easyBandLeitnerMeanBox >= 4.0`. — covered by Test 3.
 *
 * AC4 (fade-mode all-or-nothing): per `subitising-scaffold-content.md`
 *      §2.3 the per-session decision is sticky — if problem 1 shows
 *      the dot-card, problems 2-8 (in-scope) also show it; if problem 1
 *      hides it, problems 2-8 also hide. — covered by Test 4
 *      (verifies sticky-on under low fluency).
 *
 * AC5 (focus-node gate): scaffold does NOT mount on a non-`add-to-10`
 *      focus node (e.g. `sub-to-10`), regardless of addend size. —
 *      covered by Test 5.
 *
 * ────────────────────────────────────────────────────────────────────
 * Routing notes — what this spec does NOT cover
 * ────────────────────────────────────────────────────────────────────
 *
 *   - Pip-pattern visual correctness (which pips render where, per spec
 *     §1.2 wireframe) — owned by `<DotCard>` / `<DotCardCell>` unit
 *     tests under `src/screens/Math/`. Pixel correctness is out of
 *     Playwright's scope (per persona-routing rule #3, visual
 *     correctness routes to Devon design review / Thomas's eye).
 *   - Motion envelope (1100ms lifecycle, opacity in/out) — covered by
 *     existing `e2e/dot-card-affordance.spec.ts` and
 *     `DotCardOverlay.test.tsx` unit tests. This spec is purely about
 *     the trigger gate, not the visual primitive.
 *   - Audio narration absence (`math.p{N}.read` plays unchanged, no
 *     parallel TTS line) — routes to Thomas's ear-test on the Vercel
 *     preview per persona-routing rule #1 (Playwright bypasses real
 *     audio via `failNetwork: true`).
 *   - RNG-mid-band fluency-fade probability bands (P=0.66 at mean in
 *     [2.0, 3.0); P=0.33 at mean in [3.0, 4.0)) — covered by Devon's
 *     unit-test grid at `subitisingScaffold.test.ts` (per spec §6.2).
 *     Stochastic gates exercised at the e2e layer are spec-anti-pattern:
 *     they require a test-only RNG injection seam that production
 *     code wouldn't otherwise need. The boundary cases (mean < 2.0
 *     forces ON; mean >= 4.0 forces OFF) ARE deterministic and ARE
 *     covered here (Test 3 + Test 4).
 *   - First-encounter cap behaviour (`subitisingScaffoldSessionsObserved`
 *     bumps once per session, capped at 4) — covered by Devon's
 *     unit-test in `subitisingScaffold.test.ts`. e2e walk-through of
 *     all 4 transitions would require 4 separate sessions on one spec
 *     (~3-4 min wall time) and is more cheaply tested at the unit
 *     layer.
 *
 * ────────────────────────────────────────────────────────────────────
 * Browser engine support
 * ────────────────────────────────────────────────────────────────────
 *
 * Chromium-only. The dot-card lifecycle does NOT directly depend on
 * Howler / AudioContext, but the trigger predicate's "in-scope" test
 * requires the symbolic row to render (which requires the audioReady
 * gate to flip). WebKit headless has no AudioContext; `forceHowlerUnlock`
 * is used here as the test seam to bridge the gap. Real iPad Safari
 * has a working AudioContext post-gesture; the gate is engine-agnostic
 * in production.
 *
 * ────────────────────────────────────────────────────────────────────
 * Failing-first verification trail
 * ────────────────────────────────────────────────────────────────────
 *
 * Per `[[feedback_progression_e2e_mandatory]]` rule 8 and the spec
 * authoring docs §2 of the persona file — classify each assertion:
 *
 *   - Test 1 assertion (scaffold mounts in session 1): RED-on-base
 *     lever in spirit. On current main the existing `math-dot-card`
 *     mounts unconditionally for in-scope problems — but the testid
 *     `subitising-scaffold-dot-card` does NOT exist anywhere, so a
 *     non-fixme version of this test would fail at `toHaveCount(1)`
 *     (actual: 0 — the gated testid doesn't render). That is the
 *     load-bearing failing-first signal. Post-Devon-impl, the gated
 *     testid mounts and the assertion goes green.
 *   - Test 2 assertion (no scaffold for out-of-scope addends): would
 *     be a trivially-green counter-test today (because the gated
 *     testid never renders), and a real regression-guard
 *     post-Devon-impl.
 *   - Test 3 assertion (no scaffold after 3 sessions + Leitner ≥ 4.0):
 *     would be trivially-green today; real regression-guard
 *     post-Devon-impl.
 *   - Test 4 assertion (sticky-on under low fluency): would be
 *     RED-on-base lever post-Devon-impl if Devon's per-problem
 *     decision-cache breaks. The brief specifies the gate is
 *     per-session-deterministic (§2.3); this test pins it.
 *   - Test 5 assertion (no scaffold on sub-to-10 focus): would be
 *     trivially-green today; real regression-guard post-Devon-impl.
 *
 * Per dispatch brief and `[[feedback_count_assertions_on_regression_tests]]`,
 * all assertions use `.toHaveCount(N)` / `.toBe(value)` / `.toEqual([...])`,
 * never `.toContain`.
 */

import { test, expect } from '@playwright/test'
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
    'WebKit headless has no AudioContext; symbolic row never renders. Real iPad Safari has working AudioContext post-gesture — gate is engine-agnostic in production.',
  )
}

// ── Coordination testid ──────────────────────────────────────────────────
//
// See the docstring "Coordination contract with Devon" above. This
// constant is exported one place so a future testid rename (Devon
// option (b)) is a one-line update.
const SCAFFOLD_TESTID = 'subitising-scaffold-dot-card'

// ── Seed helpers ─────────────────────────────────────────────────────────

/**
 * Build a Progress doc seeded for `add-to-10` focus with the
 * subitising scaffold field at the given session-count and the
 * Leitner box state shaping the fluency-fade signal.
 *
 * `subitisingScaffoldSessionsObserved` is the NEW Progress field
 * Devon's PR adds on `profile`. We seed it via raw spread because
 * `buildSeedProgress` doesn't yet know about the field (and won't
 * until Devon widens the helper).
 *
 * `mathFactsLeitner.items` is shaped so `buildEasyBandLeitnerMeanBox`
 * (or whatever Devon names the helper) computes the target mean
 * across the 9 EASY-band facts (sums 3-5). Each EASY fact gets
 * placed in the target box explicitly; non-EASY facts are NOT
 * included so they don't dilute the band-aggregate signal.
 *
 * Spec authority: `subitising-scaffold-content.md` §2.3
 * (`easyBandLeitnerMeanBox = mean({ leitnerBoxOf(fact) | fact ∈
 *  EASY_BAND_FACTS_SEEN })`).
 */
function buildAddToTenSubitisingSeed(opts: {
  subitisingScaffoldSessionsObserved: number
  easyBandLeitnerTargetBox: 1 | 2 | 3 | 4 | 5
}): unknown {
  const base = buildSeedProgress({
    skillLevelOverrides: {
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
    },
  })

  // EASY-band facts per spec §2.1 C3 (sums 3-5, both addends ≥ 1):
  //   1+2, 2+1, 1+3, 3+1, 2+2, 1+4, 4+1, 2+3, 3+2 — 9 facts total.
  const EASY_BAND_FACTS: Array<{ a: number; b: number }> = [
    { a: 1, b: 2 },
    { a: 2, b: 1 },
    { a: 1, b: 3 },
    { a: 3, b: 1 },
    { a: 2, b: 2 },
    { a: 1, b: 4 },
    { a: 4, b: 1 },
    { a: 2, b: 3 },
    { a: 3, b: 2 },
  ]

  const leitnerItems = EASY_BAND_FACTS.map((fact) => ({
    item: { a: fact.a, b: fact.b, op: '+' as const },
    box: opts.easyBandLeitnerTargetBox,
    lastSeen: Date.now() - 60 * 60 * 1000,
  }))

  // Raw spread to add the new `profile.subitisingScaffoldSessionsObserved`
  // field (not yet in the `Progress` type union on main; Devon's PR
  // widens `Profile` to include it). `isProgressV1` tolerates extra
  // keys on `profile` by the same rule as `skillLevels` (see
  // `feedback_progression_e2e_mandatory.md` rule + the cvc-words-short-e
  // precedent in `progression-mastery-loop.spec.ts` Part 3).
  const baseObj = base as {
    profile: Record<string, unknown>
    mathFactsLeitner: { items: unknown[] }
  }

  return {
    ...(base as Record<string, unknown>),
    profile: {
      ...baseObj.profile,
      subitisingScaffoldSessionsObserved:
        opts.subitisingScaffoldSessionsObserved,
    },
    mathFactsLeitner: {
      items: leitnerItems,
    },
  }
}

/**
 * Same as the add-to-10 seed but on a `sub-to-10` focus. Used by
 * Test 5 (focus-node gate). The scaffold must NOT mount regardless
 * of session count or Leitner mean — `focusNode === 'add-to-10'` is
 * a hard gate per spec §2.1 C1.
 */
function buildSubToTenSubitisingSeed(): unknown {
  const base = buildSeedProgress({
    skillLevelOverrides: {
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
    },
  })

  // Greenfield Leitner — scaffold should be off because focusNode
  // fails C1, NOT because Leitner suppresses. Test 5's RED on a
  // future broken C1 gate would surface as a scaffold mounting on
  // sub-to-10 chips, which is exactly the regression we're locking
  // against.
  const baseObj = base as { profile: Record<string, unknown> }

  return {
    ...(base as Record<string, unknown>),
    profile: {
      ...baseObj.profile,
      subitisingScaffoldSessionsObserved: 0,
    },
  }
}

// ────────────────────────────────────────────────────────────────────────
// Test suite
// ────────────────────────────────────────────────────────────────────────

test.describe('Subitising scaffold — trigger + fluency-fade gate (failing-first, fixme until Devon merges)', () => {
  test.beforeEach(async ({ page }) => {
    // `failNetwork: true` — silent caption-walk fallback drives chip
    // enablement on CI runners (no AudioContext, no decode cost). The
    // canonical math fixture rotates to an EASY-band opener (`1 + 2`
    // / `2 + 1` / etc.) so the in-scope predicate fires on Q1. This
    // is the same posture as `dot-card-affordance.spec.ts`.
    await installClaudeMock(page, { failNetwork: true })
  })

  // ── Test 1 ─────────────────────────────────────────────────────────
  //
  // AC1 — first-encounter session 1: scaffold mounts on every
  //       in-scope problem when `subitisingScaffoldSessionsObserved < 3`,
  //       regardless of Leitner mean box.
  //
  // RED-on-base lever: the testid `subitising-scaffold-dot-card`
  // does not exist anywhere in `src/`. Even though the existing
  // `math-dot-card` mounts unconditionally for in-scope problems,
  // this spec asserts on the GATED testid Devon adds.
  test.fixme('first-encounter session: scaffold mounts on in-scope Q1 (1+2 or similar)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    await seedLocalStorage(page, {
      progress: buildAddToTenSubitisingSeed({
        subitisingScaffoldSessionsObserved: 0,
        // Saturate Leitner at box 5 so the only thing keeping the
        // scaffold visible is the first-encounter gate. Verifies
        // first-encounter OVERRIDES the fluency-fade. (Spec §2.2:
        // "Session 1, 2, 3 of add-to-10 → C4 = TRUE on every
        // problem matching C1+C2+C3+C5".)
        easyBandLeitnerTargetBox: 5,
      }),
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

    // Confirm the canonical fixture / static fallback landed us
    // on an in-scope problem. If the rotation lands on an
    // out-of-scope opener (sum > 5 with at least one addend > 5),
    // test 1 is meaningless. The static fallback openers per
    // `sessionPlans.ts` are 3+2, 1+2, 2+2 — all in-scope. The
    // canonical fixture is similarly in-scope. Guard against
    // future plan rotations.
    const addendAText = await page.getByTestId('math-addend-a').textContent()
    const addendBText = await page.getByTestId('math-addend-b').textContent()
    const addendA = Number(addendAText)
    const addendB = Number(addendBText)
    expect(addendA).toBeGreaterThanOrEqual(1)
    expect(addendB).toBeGreaterThanOrEqual(1)
    expect(addendA).toBeLessThanOrEqual(5)
    expect(addendB).toBeLessThanOrEqual(5)

    // The scaffold IS mounted because we're in the first-encounter
    // window. Exactly one container.
    await expect(page.getByTestId(SCAFFOLD_TESTID)).toHaveCount(1)
  })

  // ── Test 2 ─────────────────────────────────────────────────────────
  //
  // AC2 — C2 failure (out-of-scope addends): scaffold does NOT mount
  //       when either addend > 5, even on the first-encounter session.
  //
  // We cannot easily force an OOS opener on Q1 via the default
  // fixtures (both the canonical and the static fallback open with
  // sums ≤ 5). Instead, we drive a custom canned plan whose Q1 is
  // `6 + 1 = 7` — exercises C2.
  test.fixme('out-of-scope addends (6+1): scaffold does NOT mount even in first-encounter session', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // Override the math response with a canned plan whose Q1 is
    // out-of-scope. Per `subitising-scaffold-content.md` §2.1 C2,
    // both addends must be ≤ 5; `6 + 1` fails the gate (addendA = 6).
    //
    // We use the silent-MP3 inline pattern from
    // `sub-to-10-dot-card-suppression.spec.ts` — bytes don't have
    // to decode cleanly because we never tap a chip in this test
    // (we just observe the scaffold's absence on the rendered Q1).
    // The screen still falls through to the static plan if Howler
    // can't decode, but the static plan's Q1 is in-scope (3+2 or
    // similar) — which would defeat the test. So we close the
    // back door by overriding `mathResponse` with the OOS plan
    // AND keeping `failNetwork: false` (deferred via re-install
    // here, overriding the beforeEach).
    const SILENT_MP3 =
      'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAA8TEFNRTMuMTAwBLgAAAAAAAAAABRAJAUHQQAB4AAAAk8tnaAyAAAAAA=='
    const inlineAudio = () => ({
      kind: 'inline' as const,
      base64: SILENT_MP3,
      mime: 'audio/mpeg' as const,
    })

    function cannedAddToTenOosAtP1() {
      const problems = [
        { idx: 1, aW: 'Six', bW: 'one', a: 6, b: 1, ans: 7, ansW: 'Seven' },
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
          audio: inlineAudio(),
        },
        {
          id: `math.p${p.idx}.correct`,
          text: `Yes! ${p.ansW}!`,
          audio: inlineAudio(),
        },
        {
          id: `math.p${p.idx}.reprompt`,
          text: 'Hmm... try again?',
          audio: inlineAudio(),
        },
        {
          id: `math.p${p.idx}.hint`,
          text: `Look. ${p.aW}. And ${p.bW} more. How many now?`,
          audio: inlineAudio(),
        },
        {
          id: `math.p${p.idx}.giveAnswer`,
          text: `This one is ${p.ansW.toLowerCase()}.`,
          audio: inlineAudio(),
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

    // Re-install the mock with our OOS canned plan (clobbers the
    // beforeEach failNetwork mock — Playwright route handlers are
    // first-match-wins per registration order, and the second
    // installClaudeMock call registers a fresh handler that
    // matches earlier).
    await installClaudeMock(page, { mathResponse: cannedAddToTenOosAtP1 })

    await seedLocalStorage(page, {
      progress: buildAddToTenSubitisingSeed({
        subitisingScaffoldSessionsObserved: 0,
        easyBandLeitnerTargetBox: 1, // doesn't matter — C2 fires first
      }),
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

    // Wait until the OOS canned plan landed — confirms we're on
    // the gated content, not a static fallback. If Howler can't
    // decode the silent MP3 (chromium headless usually can; if
    // not, see canonical-fixture decode caveats in
    // `testing-and-ci.md` §4.1.2), the screen falls back to the
    // static plan whose Q1 is in-scope — and this assertion
    // catches that fallback as a test-environment fault rather
    // than a silent wrong-test-result. If it fires, drop to a
    // `failNetwork:true`-plus-debugSeed approach in the post-impl
    // flip-PR.
    await expect(page.getByTestId('math-addend-a')).toHaveText('6', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('1', {
      timeout: 15_000,
    })

    // The scaffold is NOT mounted because C2 fails.
    await expect(page.getByTestId(SCAFFOLD_TESTID)).toHaveCount(0)
  })

  // ── Test 3 ─────────────────────────────────────────────────────────
  //
  // AC3 — fade-permanent boundary: scaffold does NOT mount once
  //       `subitisingScaffoldSessionsObserved >= 3` AND
  //       `easyBandLeitnerMeanBox >= 4.0`.
  //
  // Per spec §2.3 fade-probability schedule, mean ≥ 4.0 → P=0.0
  // (deterministic OFF). Combined with first-encounter satisfied
  // (sessionsObserved ≥ 3), the scaffold permanently leaves the
  // screen. We saturate Leitner at box 5 (mean = 5.0, well above
  // 4.0).
  test.fixme('permanent fade: 5 sessions observed + Leitner mean 5.0 → no scaffold even on in-scope Q1', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    await seedLocalStorage(page, {
      progress: buildAddToTenSubitisingSeed({
        subitisingScaffoldSessionsObserved: 5, // well past the 3-session first-encounter gate
        easyBandLeitnerTargetBox: 5, // mean = 5.0 → fade permanent (P=0)
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 10 }),
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

    // Confirm we landed on an in-scope problem. If the addends
    // are out-of-scope, the test is meaningless (C2 would fail
    // anyway). The default fixtures open in-scope per Test 1's
    // notes.
    const addendAText = await page.getByTestId('math-addend-a').textContent()
    const addendBText = await page.getByTestId('math-addend-b').textContent()
    const addendA = Number(addendAText)
    const addendB = Number(addendBText)
    expect(addendA).toBeLessThanOrEqual(5)
    expect(addendB).toBeLessThanOrEqual(5)

    // Scaffold is NOT mounted because C4 fails (fade permanent).
    await expect(page.getByTestId(SCAFFOLD_TESTID)).toHaveCount(0)
  })

  // ── Test 4 ─────────────────────────────────────────────────────────
  //
  // AC4 — per-session all-or-nothing stickiness. Per spec §2.3 the
  //       fluency-fade decision is per-session, not per-problem;
  //       within a single session, every in-scope problem either
  //       shows the scaffold OR none of them do. No mid-session
  //       toggling.
  //
  // We force the "show" branch deterministically by seeding fluency
  // BELOW the fade-start threshold (`easyBandLeitnerMeanBox < 2.0` →
  // P=1.0 always). Then we walk 3 chips and assert the scaffold
  // mounts on Q1, Q2, Q3 — all in-scope opener problems per the
  // static rotation. Walking past Q3 would land on possibly-OOS
  // problems (Q4-Q8 in the static plans often include addends > 5);
  // 3 chips is sufficient to lock the stickiness contract without
  // tripping C2 in the middle.
  test.fixme('sticky-on under low fluency: scaffold mounts on Q1, Q2, Q3 of an in-scope session', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // Override the default failNetwork beforeEach with a canned
    // plan whose Q1, Q2, Q3 are ALL guaranteed in-scope (both
    // addends ≤ 5). Static-fallback openers vary by minute
    // rotation — we close that variance with an explicit canned
    // plan. Q4-Q8 carry OOS addends so we don't accidentally
    // walk into a C2 case during the chip-walk (which would mask
    // the stickiness check on Q3 if Devon's gate were wrongly
    // applied per-problem instead of per-session).
    const SILENT_MP3 =
      'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAA8TEFNRTMuMTAwBLgAAAAAAAAAABRAJAUHQQAB4AAAAk8tnaAyAAAAAA=='
    const inlineAudio = () => ({
      kind: 'inline' as const,
      base64: SILENT_MP3,
      mime: 'audio/mpeg' as const,
    })

    function cannedAddToTenInScopeStarter() {
      const problems = [
        { idx: 1, aW: 'One', bW: 'two', a: 1, b: 2, ans: 3, ansW: 'Three' },
        { idx: 2, aW: 'Two', bW: 'three', a: 2, b: 3, ans: 5, ansW: 'Five' },
        { idx: 3, aW: 'Two', bW: 'two', a: 2, b: 2, ans: 4, ansW: 'Four' },
        { idx: 4, aW: 'Five', bW: 'four', a: 5, b: 4, ans: 9, ansW: 'Nine' },
        { idx: 5, aW: 'Two', bW: 'six', a: 2, b: 6, ans: 8, ansW: 'Eight' },
        { idx: 6, aW: 'Three', bW: 'six', a: 3, b: 6, ans: 9, ansW: 'Nine' },
        { idx: 7, aW: 'Four', bW: 'six', a: 4, b: 6, ans: 10, ansW: 'Ten' },
        { idx: 8, aW: 'Three', bW: 'four', a: 3, b: 4, ans: 7, ansW: 'Seven' },
      ]
      const utterances = problems.flatMap((p) => [
        {
          id: `math.p${p.idx}.read`,
          text: `${p.aW} plus ${p.bW}. How many?`,
          audio: inlineAudio(),
        },
        {
          id: `math.p${p.idx}.correct`,
          text: `Yes! ${p.ansW}!`,
          audio: inlineAudio(),
        },
        {
          id: `math.p${p.idx}.reprompt`,
          text: 'Hmm... try again?',
          audio: inlineAudio(),
        },
        {
          id: `math.p${p.idx}.hint`,
          text: `Look. ${p.aW}. And ${p.bW} more. How many now?`,
          audio: inlineAudio(),
        },
        {
          id: `math.p${p.idx}.giveAnswer`,
          text: `This one is ${p.ansW.toLowerCase()}.`,
          audio: inlineAudio(),
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

    await installClaudeMock(page, {
      mathResponse: cannedAddToTenInScopeStarter,
    })

    await seedLocalStorage(page, {
      progress: buildAddToTenSubitisingSeed({
        subitisingScaffoldSessionsObserved: 5, // past first-encounter
        easyBandLeitnerTargetBox: 1, // mean = 1.0 < 2.0 → P=1.0 always
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 10 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Walk Q1, Q2, Q3 and assert scaffold mount on each. Use the
    // `data-problem-index` DOM gate per `testing-and-ci.md`
    // §4.1.3 — `data-problem-index` is 0-based on `math` root,
    // so Q1=`"0"`, Q2=`"1"`, Q3=`"2"`.
    for (let q = 0; q < 3; q++) {
      await expect(page.getByTestId('math')).toHaveAttribute(
        'data-problem-index',
        String(q),
        { timeout: 15_000 },
      )
      await expect(page.getByTestId(SCAFFOLD_TESTID)).toHaveCount(1, {
        timeout: 5_000,
      })

      // Advance to the next problem if we haven't hit Q3 yet.
      if (q < 2) {
        const correctChip = page.locator(
          '[data-testid="math-chip"][data-correct="true"]',
        )
        await expect(correctChip).toBeEnabled({ timeout: 15_000 })
        await correctChip.click()
      }
    }
  })

  // ── Test 5 ─────────────────────────────────────────────────────────
  //
  // AC5 — focus-node gate (C1). Scaffold does NOT mount on a
  //       non-`add-to-10` focus node, regardless of addend size.
  //
  // We seed sub-to-10 as the focus (sub-to-10 'practicing', add-to-10
  // 'mastered', etc.) and override the math response with a canned
  // sub-to-10 plan whose Q1 has BOTH operands ≤ 5 (`5 - 3 = 2`).
  // Were the gate's C1 broken (e.g. accidentally widened to
  // sub-to-10), the scaffold would mount on Q1 because C2 passes
  // (both operands ≤ 5). The correct behaviour is that C1 fails
  // first and the scaffold is absent.
  //
  // NOTE this overlaps with `sub-to-10-dot-card-suppression.spec.ts`
  // for the EXISTING `math-dot-card` testid; this test is its
  // sibling for the NEW `subitising-scaffold-dot-card` testid. Devon
  // should ensure the suppression gates fire on BOTH testid surfaces
  // (or, if option (b) testid-rename is chosen, the existing spec
  // gets updated and this test becomes redundant — flag in the
  // flip-PR).
  test.fixme('sub-to-10 focus with both operands ≤ 5: scaffold does NOT mount (C1 gates first)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    const SILENT_MP3 =
      'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAA8TEFNRTMuMTAwBLgAAAAAAAAAABRAJAUHQQAB4AAAAk8tnaAyAAAAAA=='
    const inlineAudio = () => ({
      kind: 'inline' as const,
      base64: SILENT_MP3,
      mime: 'audio/mpeg' as const,
    })

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
          audio: inlineAudio(),
        },
        {
          id: `math.p${p.idx}.correct`,
          text: `Yes! ${p.ansW}!`,
          audio: inlineAudio(),
        },
        {
          id: `math.p${p.idx}.reprompt`,
          text: 'Hmm... try again?',
          audio: inlineAudio(),
        },
        {
          id: `math.p${p.idx}.hint`,
          text: `Look. ${p.mW}. Take away ${p.sW}. How many now?`,
          audio: inlineAudio(),
        },
        {
          id: `math.p${p.idx}.giveAnswer`,
          text: `This one is ${p.ansW.toLowerCase()}.`,
          audio: inlineAudio(),
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

    await installClaudeMock(page, {
      mathResponse: cannedSubToTenSmallOperandsAtP1,
    })

    await seedLocalStorage(page, {
      progress: buildSubToTenSubitisingSeed(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Confirm the sub-to-10 canned plan landed — Q1 addends are
    // '5' and '3'. Same diagnostic guard as Test 2: if the
    // canned bytes can't decode and the screen falls back to the
    // static add-to-10 plan, this assertion fires loud (and the
    // post-impl flip-PR can swap to a debug-seed approach).
    await expect(page.getByTestId('math-addend-a')).toHaveText('5', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('3', {
      timeout: 15_000,
    })

    // Scaffold is NOT mounted because C1 fails (focusNode !==
    // 'add-to-10').
    await expect(page.getByTestId(SCAFFOLD_TESTID)).toHaveCount(0)
  })
})
