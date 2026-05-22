/**
 * E2E spec — `SessionHistoryEntry.perProblemDistractorClass` schema
 * (Kevin Wave-1b PR, paired ticket 86c9xwwxf, dispatched 2026-05-22).
 *
 * Failing-first spec authored at dispatch time per
 * `[[feedback_progression_e2e_mandatory]]`. Kevin's schema-extension PR
 * `kevin/per-problem-distractor-class-schema` is in flight in parallel.
 * The spec is RED on `origin/main` HEAD (the field does not yet exist
 * on `SessionHistoryEntry`) and turns GREEN once Kevin's PR merges.
 *
 * Contract pinned by this spec
 * ----------------------------
 * Per `design/math/two-digit-addsub-content.md` §3.7 + §6.1 (Kevin Wave-1b
 * file checklist):
 *
 *   - `SessionHistoryEntry.perProblemDistractorClass?: ReadonlyArray<DistractorClassTag | null>`
 *     (length 8; `null` for P1–P3 gentle-ramp problems where no
 *     Class 2 / 3 / B / wrong-op trap was offered; string literal from
 *     the `'off-by-one' | 'wrong-op' | 'decade-anchor' |
 *     'column-cross' | 'phantom-borrow'` union for P4–P8).
 *   - Persisted via `recordProgressOnSessionEnd` → `buildEntry` →
 *     `SessionHistoryEntry`.
 *   - The captured class is the POST-DOWNGRADE rendered class (what
 *     the chip-helper actually emitted), not the planner-intended
 *     class — same posture as `perProblemAnswerValue` (PR #286 ships
 *     the literal tapped value, leaves classification to the consumer).
 *   - Type guard `isProgressV1` accepts the new field; pre-Kevin
 *     blobs (no field) round-trip cleanly (additive optional, no
 *     schemaVersion bump — same precedent as `latencyMs` / `mathFacts` /
 *     `perProblemAnswerValue`).
 *
 * Failing-first discipline — RED-on-base + GREEN-post-merge proof
 * ---------------------------------------------------------------
 * On `origin/main` HEAD (base, BEFORE Kevin's schema PR lands), every
 * test in this file fails at the load-bearing presence assertion
 * `expect(entry.perProblemDistractorClass).toBeDefined()` — the field
 * is not written by today's `buildEntry` so the persisted entry has
 * `perProblemDistractorClass === undefined`. The assertion fails for
 * the right reason; the spec is doing its job as a RED lever.
 *
 * On the paired Kevin branch (GREEN side), `buildEntry` writes the
 * field on every math session-end, the type guard accepts it, and
 * `Math.tsx`'s session-result construction populates it from the
 * per-problem chip-render `distractorClass`. Every assertion below
 * passes.
 *
 * Trivially-green-trap discipline
 * --------------------------------
 * Per `testing-and-ci.md` §4.1.1d / §4.1.1e / §4.1.1f. Three traps
 * to avoid:
 *
 *   (1) `failNetwork: true` + assertion satisfiable against the
 *       add-to-10 static-fallback rotation (§4.1.1d). Mitigation:
 *       this spec uses the canonical add-to-10 mock fixture
 *       (`canonicalMathSessionResponse`) NOT `failNetwork: true`.
 *       The fixture serves a real canon-shape add-to-10 plan — the
 *       chip-row exercises the real render path, not the silent
 *       caption-walk demote path.
 *
 *   (2) Negative-membership predicate that excludes a value outside
 *       any plausible fallback range (§4.1.1e). Mitigation: every
 *       assertion in this spec is POSITIVE-membership — we assert
 *       the field is PRESENT, has length 8, contains specific values
 *       at specific positions. No `not.toBeVisible` / `toContain` /
 *       `toHaveCount(0)` shape that could pass trivially under
 *       structural mutation.
 *
 *   (3) Positive-predicate-too-lax that pattern-matches both real
 *       canon and silent-demote fallback (§4.1.1f). Mitigation: the
 *       distractor-class field is a schema-level plumbing contract —
 *       on add-to-10 (real canon), every P4–P8 problem renders
 *       `distractorClass = undefined` at the planner level (Math.tsx
 *       2914-2919) which `pickDistractors` resolves to `'off-by-one'`.
 *       Kevin's write path captures the resolved class. So the
 *       assertion `entry.perProblemDistractorClass[3] === 'off-by-one'`
 *       is the correct contract for add-to-10. There's no "wrong-tier"
 *       confusion here because we ARE on add-to-10.
 *
 * The load-bearing RED-on-base lever is the presence assertion
 * (`toBeDefined()`) on the field that doesn't yet exist. The
 * positive-equality assertions (`toEqual` on the exact array) lock
 * down the SHAPE of the field once it ships, defending against:
 *   - duplicate-fire regressions (`toContain` would pass these silently)
 *   - off-by-one length drift (length pinned)
 *   - latch-inversion regressions (P0–P2 vs P3–P7 pinned positionally)
 *
 * Count-assertion discipline
 * --------------------------
 * Per `[[feedback_count_assertions_on_regression_tests]]`: no
 * `.toContain` / `.toContainEqual` on regression behaviour. Use
 * `.toEqual([exact-array])` for ordered captures, `.toBe(value)` for
 * scalar pin-downs, `.toBeUndefined()` for back-compat absence.
 *
 * Routing exception — what E2E CANNOT see for this schema
 * --------------------------------------------------------
 * - Render-side `'column-cross'` / `'phantom-borrow'` class derivation —
 *   that's Devon's Wave-3 scope (`distractors.ts` union widening +
 *   `Math.tsx` two-digit-addsub focus-node dispatch). This spec
 *   covers Kevin's Wave-1b schema plumbing on the existing
 *   `'off-by-one' | 'wrong-op' | 'decade-anchor'` union; the wider
 *   union is exercised by Devon's Wave-3 spec separately.
 * - The diagnostic-aware promotion gate (§5.4 of the two-digit-addsub
 *   spec) — that's a mastery.ts widening, NOT a schema concern. The
 *   schema PR ships the field; the gate consumer is a separate PR.
 * - Audio onPlay correctness — out of E2E scope per Jessica's routing
 *   rule. We run the silent caption-walk fallback (canonical fixture
 *   carries placeholder silent MP3s) which exercises the chip-tap
 *   path without needing real Azure audio.
 *
 * Test setup notes
 * ----------------
 * - `installClaudeMock(page)` (no `failNetwork`) — serves the
 *   canonical add-to-10 plan so chip render exercises real canon
 *   shape, not the silent-demote path. Per §4.1.1d / §4.1.1f, this
 *   is the load-bearing choice that keeps the spec out of the
 *   trivially-green-trap family.
 * - `forceHowlerUnlock(page)` — required to get chips out of the
 *   disabled-pending-audio gate. Production-NEVER-calls-this test
 *   seam.
 * - WebKit-headless skip — same shape as
 *   `schema-answer-value.spec.ts` / `latency-band-invariant.spec.ts`.
 *   The read-aloud effect needs a working AudioContext to flip
 *   `readAloudPlayed → true`; WebKit headless has no AudioContext.
 *   Production iPad Safari is unaffected.
 */

// ╭──────────────────────────────────────────────────────────────────────────╮
// │ test.fixme INTERIM (2026-05-22) — pending Wave 5 PR B binding activation │
// │                                                                          │
// │ Force-merged via PR #304 ahead of its activator. The perProblemDistract- │
// │ orClass field is shipped at the type level (Kevin schema PR #302) and at │
// │ the helper level (Devon render-side PR #303), but the population wiring  │
// │ at math session-end has NOT shipped yet. That wiring is Kevin Wave 5 PR  │
// │ B — see ticket 86c9y01ee (PR A) and the follow-up PR B ticket.           │
// │                                                                          │
// │ Restore `test('...')` (remove `.fixme`) when PR B lands and confirms     │
// │ entry.perProblemDistractorClass is defined on a fresh math session end.  │
// ╰──────────────────────────────────────────────────────────────────────────╯

import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  forceHowlerUnlock,
  PROGRESS_STORAGE_KEY,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * Helper-side mirror of the production `DistractorClassTag` union.
 * Mirrors `'off-by-one' | 'wrong-op' | 'decade-anchor'` from
 * `src/screens/Math/distractors.ts` (post-PR #241 / sub-to-20 PR);
 * Kevin's Wave-1b PR persists this union (or its forward extension
 * `'column-cross' | 'phantom-borrow'` once Devon Wave-3 ships) onto
 * `SessionHistoryEntry`. The spec only exercises the add-to-10 path
 * so only `'off-by-one'` is observable here at GREEN time.
 */
type DistractorClassTag =
  | 'off-by-one'
  | 'wrong-op'
  | 'decade-anchor'
  | 'column-cross'
  | 'phantom-borrow'

interface PersistedHistoryEntry {
  dateISO: string
  skillFocus: string[]
  successRate: number
  perProblemDistractorClass?: (DistractorClassTag | null)[]
}

interface PersistedProgress {
  history: PersistedHistoryEntry[]
}

const PROBLEM_COUNT = 8

// WebKit-headless skip — same shape as schema-answer-value.spec.ts.
// The read-aloud effect needs a working AudioContext to flip
// readAloudPlayed → true; WebKit headless has no AudioContext, so
// chips never enable. Real iPad Safari is unaffected.
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → chips never enable; this spec is chromium-only.',
  )
}

test.describe('SessionHistoryEntry.perProblemDistractorClass schema (Kevin Wave-1b, ticket 86c9xwwxf)', () => {
  test.beforeEach(async ({ page }) => {
    // Canonical add-to-10 mock — NOT `failNetwork: true`. Per
    // §4.1.1d/f, real canon-shape avoids the silent-demote
    // trivially-green trap.
    await installClaudeMock(page)
  })

  test.fixme('1. RED-on-base lever — math session end writes perProblemDistractorClass with length 8; P1–P3 null (gentle ramp), P4–P8 string (rendered class)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    // Returning user — Splash auto-advances to Hub, no Greet detour.
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    // Splash → Hub → Math.
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // Walk 8 problems, tapping correct each time.
    for (let i = 0; i < PROBLEM_COUNT; i++) {
      const math = page.getByTestId('math')
      await expect(math).toHaveAttribute('data-problem-index', String(i), {
        timeout: 20_000,
      })
      await expect(math).toHaveAttribute('data-read-aloud-played', 'true', {
        timeout: 20_000,
      })
      const correctChip = page.locator(
        '[data-testid="math-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()
    }

    // SessionEnd → Hub so recordProgressOnSessionEnd fires.
    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
    const cta = page.getByTestId('session-end-cta')
    await expect(cta).toBeVisible({ timeout: 12_000 })
    await cta.click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    // Read persisted progress. Seed had no history, so the new entry
    // sits at index 0.
    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted, 'persisted progress is null').not.toBeNull()
    expect(
      persisted.history.length,
      'history must contain exactly one new entry from the just-completed math session',
    ).toBe(1)

    const entry = persisted.history[0]!

    // Diagnostic attachment — surfaces the actual captured array in CI
    // failure log without a re-run.
    await testInfo.attach('perProblemDistractorClass-array', {
      body: JSON.stringify(entry.perProblemDistractorClass),
      contentType: 'application/json',
    })

    // ── Load-bearing RED-on-base lever ──────────────────────────────────
    // PR ships the field; pre-PR it's undefined. This assertion is the
    // failing-first contract — on origin/main HEAD (base), it fails
    // with `received: undefined`; on Kevin's branch (GREEN), it passes.
    expect(
      entry.perProblemDistractorClass,
      'perProblemDistractorClass must be present on math session entries (Kevin Wave-1b ships this; field is absent on base)',
    ).toBeDefined()

    // Length: one slot per problem. Pinned separately so a future
    // length-drift regression is the failure message, not the
    // positional `toEqual` mismatch below.
    expect(
      entry.perProblemDistractorClass!.length,
      `perProblemDistractorClass.length must equal PROBLEM_COUNT (${PROBLEM_COUNT})`,
    ).toBe(PROBLEM_COUNT)

    // Exact-array equality on the FULL array. Per the design doc
    // §6.1 contract:
    //   - P1–P3 (indices 0–2) are gentle-ramp; the chip-helper does
    //     not offer a Class 2/3/B/wrong-op trap → recorded as `null`.
    //   - P4–P8 (indices 3–7) are discriminate band; for add-to-10
    //     (op === '+'), Math.tsx leaves `distractorClass` undefined
    //     and `pickDistractors` resolves to `'off-by-one'` (the
    //     post-downgrade rendered class — what Kevin's writer
    //     captures per §6.1 "the chip helper returns the resolved
    //     class (after downgrade) so the session-result reflects the
    //     actually-rendered class, not the planner-default").
    //
    // toEqual (exact-array) not toContain — per
    // `[[feedback_count_assertions_on_regression_tests]]`, toContain
    // would pass [null, null, null, 'off-by-one', ...extra] OR
    // [null, null, null, 'off-by-one', 'off-by-one', ...short] OR
    // [null, 'off-by-one'×7] silently allowing latch-inversion,
    // duplicate-fire, length-drift regressions.
    const expected: (DistractorClassTag | null)[] = [
      null,
      null,
      null,
      'off-by-one',
      'off-by-one',
      'off-by-one',
      'off-by-one',
      'off-by-one',
    ]
    expect(entry.perProblemDistractorClass).toEqual(expected)
  })

  test.fixme('2. RED-on-base lever — wrong-then-correct on P1 — perProblemDistractorClass[0] is null (gentle-ramp tag survives wrong-tap; tag is offered-class, not tap-outcome)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    // ── Problem 0 — TAP WRONG FIRST, then correct ───────────────────────
    // This proves the field captures the OFFERED distractor class
    // (gentle ramp at P0 → null), not a tap-outcome side channel.
    // If a future regression made the field correctness-dependent
    // (e.g. only set on wrong taps), this assertion fails.
    const math = page.getByTestId('math')
    await expect(math).toHaveAttribute('data-problem-index', '0', {
      timeout: 20_000,
    })
    await expect(math).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })

    const wrongChip = page
      .locator('[data-testid="math-chip"][data-correct="false"]')
      .first()
    await expect(wrongChip).toBeEnabled({ timeout: 15_000 })
    await wrongChip.click()

    const correctChipP0 = page.locator(
      '[data-testid="math-chip"][data-correct="true"]',
    )
    await expect(correctChipP0).toBeEnabled({ timeout: 15_000 })
    await correctChipP0.click()

    // ── Problems 1..7 — clean correct walk ──────────────────────────────
    for (let i = 1; i < PROBLEM_COUNT; i++) {
      await expect(math).toHaveAttribute('data-problem-index', String(i), {
        timeout: 20_000,
      })
      await expect(math).toHaveAttribute('data-read-aloud-played', 'true', {
        timeout: 20_000,
      })
      const correctChip = page.locator(
        '[data-testid="math-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()
    }

    // SessionEnd → Hub.
    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
    const cta = page.getByTestId('session-end-cta')
    await expect(cta).toBeVisible({ timeout: 12_000 })
    await cta.click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted, 'persisted progress is null').not.toBeNull()
    expect(persisted.history.length).toBe(1)
    const entry = persisted.history[0]!

    await testInfo.attach('perProblemDistractorClass-array', {
      body: JSON.stringify(entry.perProblemDistractorClass),
      contentType: 'application/json',
    })

    // ── Load-bearing RED-on-base lever ──────────────────────────────────
    expect(
      entry.perProblemDistractorClass,
      'perProblemDistractorClass must be present (Kevin Wave-1b ships this)',
    ).toBeDefined()

    // P0 latched as `null` despite the wrong-then-correct retry —
    // the field captures the OFFERED distractor class, which at P0
    // (gentle ramp) is `null` regardless of tap outcome.
    //
    // toBe (scalar pin) chosen over toEqual on the slice so the
    // failure message points at the single element with the
    // "wrong-tap leaked into distractor-class field" claim, not the
    // whole array shape.
    expect(
      entry.perProblemDistractorClass![0],
      'perProblemDistractorClass[0] must be null (gentle ramp; tag captures OFFERED class, not tap outcome — wrong-tap-then-correct does not leak a class tag into P1)',
    ).toBe(null)

    // Full array still matches the canonical add-to-10 shape — the
    // wrong-tap path did not corrupt the class capture across the
    // session.
    const expected: (DistractorClassTag | null)[] = [
      null,
      null,
      null,
      'off-by-one',
      'off-by-one',
      'off-by-one',
      'off-by-one',
      'off-by-one',
    ]
    expect(entry.perProblemDistractorClass).toEqual(expected)
  })

  test.fixme('3. back-compat — pre-Wave-1b SessionHistoryEntry (no perProblemDistractorClass field) loads cleanly and a new session appends an entry that DOES carry the field', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // Seed a Progress with an OLD-shape history entry — no
    // perProblemDistractorClass field. This is the shape every
    // localStorage blob written before Kevin's Wave-1b PR carries.
    // The type guard isProgressV1 must accept it (additive optional
    // field, same precedent as latencyMs / mathFacts /
    // perProblemAnswerValue).
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        history: [
          {
            dateISO: '2026-05-20T12:00:00.000Z',
            skillFocus: ['add-to-10'],
            successRate: 0.875,
            // NB: no perProblemDistractorClass. Pre-Wave-1b shape.
            // isProgressV1 must accept it.
          },
        ],
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    // ── Discriminator A — the OLD-shape entry survived the type-guard ──
    // If isProgressV1 had rejected the seeded blob, loadProgress would
    // have returned null and the app would have fallen back to
    // `defaultProgress()` — which has an empty `history`. Reading
    // history.length BEFORE a new session-end fires positively
    // identifies that the old-shape entry round-tripped through the
    // load path.
    const beforeRun = (await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key)
      return raw === null ? null : (JSON.parse(raw) as unknown)
    }, PROGRESS_STORAGE_KEY)) as PersistedProgress | null
    expect(
      beforeRun,
      'localStorage progress blob must be present after seeding',
    ).not.toBeNull()
    expect(
      beforeRun!.history.length,
      'old-shape history entry must survive isProgressV1 / migrate / save-on-mount round-trip — back-compat lever',
    ).toBe(1)
    expect(
      beforeRun!.history[0]!.perProblemDistractorClass,
      'old-shape entry must NOT carry perProblemDistractorClass (back-compat baseline)',
    ).toBeUndefined()

    // Run a fresh math session so a NEW entry is appended.
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    for (let i = 0; i < PROBLEM_COUNT; i++) {
      const math = page.getByTestId('math')
      await expect(math).toHaveAttribute('data-problem-index', String(i), {
        timeout: 20_000,
      })
      await expect(math).toHaveAttribute('data-read-aloud-played', 'true', {
        timeout: 20_000,
      })
      const correctChip = page.locator(
        '[data-testid="math-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()
    }

    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
    const cta = page.getByTestId('session-end-cta')
    await expect(cta).toBeVisible({ timeout: 12_000 })
    await cta.click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    // ── Discriminator B — both old and new shape coexist in history ────
    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()
    expect(
      persisted.history.length,
      'history must contain the old-shape entry AND the new just-completed entry',
    ).toBe(2)

    // Old entry still has no perProblemDistractorClass (historical
    // entries are not retroactively modified by a write that doesn't
    // touch them).
    const oldEntry = persisted.history[0]!
    expect(
      oldEntry.perProblemDistractorClass,
      'old-shape entry must STILL have no perProblemDistractorClass after the new session — historical entries are not retroactively modified',
    ).toBeUndefined()

    // ── Load-bearing RED-on-base lever ────────────────────────────────
    // NEW entry (post-Wave-1b shape) DOES carry the field.
    const newEntry = persisted.history[1]!
    expect(
      newEntry.perProblemDistractorClass,
      'NEW (post-Wave-1b) math session entry must carry perProblemDistractorClass (Kevin Wave-1b ships this; field is absent on base)',
    ).toBeDefined()

    await testInfo.attach('new-entry-perProblemDistractorClass', {
      body: JSON.stringify(newEntry.perProblemDistractorClass),
      contentType: 'application/json',
    })

    // Exact-array shape on the new entry — same expected as Test 1.
    // Locks the schema-write contract across the back-compat boundary.
    const expected: (DistractorClassTag | null)[] = [
      null,
      null,
      null,
      'off-by-one',
      'off-by-one',
      'off-by-one',
      'off-by-one',
      'off-by-one',
    ]
    expect(newEntry.perProblemDistractorClass).toEqual(expected)
  })
})
