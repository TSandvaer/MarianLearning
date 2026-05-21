/**
 * E2E spec — `SessionHistoryEntry.perProblemAnswerValue` /
 * `perProblemAnswerWord` schema (PR #286, commit `be578b4`).
 *
 * Defense-in-depth post-merge regression coverage. Kevin's unit suite
 * already covers the field shape at the ref-write site
 * (`Math.test.tsx` × 3 cases, `progressHistory.test.ts` × 8 cases,
 * `progress.test.ts` × 12 guard cases). This spec exercises the full
 * browser path: real user-gesture chip-tap → screen ref-mirror →
 * `MathSessionResult` / `WordSongSessionResult` → `SessionEndPayload`
 * → `recordProgressOnSessionEnd` → persisted `Progress.history[N]`
 * blob in localStorage. The browser path is what a unit test stub
 * cannot reach.
 *
 * Contract pinned by this spec
 * ----------------------------
 * After a math session (8 problems), the new
 * `Progress.history[N].perProblemAnswerValue` field:
 *   - is present (PR #286 ships it on every math session-end write)
 *   - has length === 8
 *   - has every entry equal to the literal chip `data-value` Marian
 *     tapped on her FIRST tap for that problem, regardless of
 *     correctness (test 2's wrong-then-correct is the load-bearing
 *     case — proves the first-tap LATCH, not last-tap)
 *
 * After a word-song session (8 problems), the parallel
 * `Progress.history[N].perProblemAnswerWord` field carries the
 * literal chip `data-word` of the FIRST tap for each problem.
 *
 * Back-compat: pre-#286 `SessionHistoryEntry` blobs (no
 * `perProblemAnswerValue` field) load cleanly via `isProgressV1`,
 * and a fresh post-#286 session-end appends a new entry that DOES
 * carry the field — both shapes coexist in `history`.
 *
 * Routing exception — what E2E CANNOT see for this schema
 * --------------------------------------------------------
 * - The raw `wrongCount`-related side-channel behaviour (PR #286
 *   only touches first-tap; subsequent retries within a problem are
 *   not captured by design). This spec asserts the latch behaviour;
 *   it does NOT assert any behaviour on second/third taps within the
 *   same problem.
 * - Audio onPlay correctness — out of E2E scope per Jessica's
 *   routing rule. We run on the silent-caption-walk fallback
 *   (`failNetwork: true`) which exercises the chip-tap path without
 *   needing real Azure MP3s.
 *
 * Test setup notes
 * ----------------
 * - `installClaudeMock(page, { failNetwork: true })` — same harness
 *   shape as `latency-band-invariant.spec.ts`. The screen falls
 *   through to its static-fallback plan; chips still render with
 *   `data-value` / `data-word` and `data-correct`, refs still
 *   capture, the session-end write path still fires. This is the
 *   minimal-surface path that exercises the schema plumbing without
 *   pulling in canon-bytes mocks.
 * - `forceHowlerUnlock(page)` — required to get chips out of the
 *   disabled-pending-audio gate. Production-NEVER-calls-this test
 *   seam.
 * - All 4 tests are chromium-only — WebKit headless has no
 *   `AudioContext`, the read-aloud effect never fires, chips never
 *   enable. Production iPad Safari works fine; this is the same
 *   harness limitation documented across the suite.
 *
 * Assertion discipline
 * --------------------
 * Per `feedback_count_assertions_on_regression_tests`: no
 * `.toContain` / `.toContainEqual` on regression behaviour. Use
 * `.toEqual([exact-array])` for ordered captures, `.toBe(value)`
 * for scalar pin-downs, `.toBeUndefined()` for back-compat absence.
 */

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

interface PersistedHistoryEntry {
  dateISO: string
  skillFocus: string[]
  successRate: number
  perProblemAnswerValue?: (number | null)[]
  perProblemAnswerWord?: (string | null)[]
}

interface PersistedProgress {
  history: PersistedHistoryEntry[]
}

const PROBLEM_COUNT = 8

// WebKit-headless skip — same shape as sub-to-10-payload-shape.spec.ts /
// latency-band-invariant.spec.ts. The read-aloud effect needs a working
// AudioContext to flip readAloudPlayed → true; WebKit headless has no
// AudioContext, so chips never enable. Real iPad Safari is unaffected.
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → chips never enable; this spec is chromium-only.',
  )
}

test.describe('SessionHistoryEntry.perProblemAnswerValue / perProblemAnswerWord schema (PR #286)', () => {
  test.beforeEach(async ({ page }) => {
    await installClaudeMock(page, { failNetwork: true })
  })

  test('1. math correct-only walk — perProblemAnswerValue captures the correct chip value on every problem', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
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

    // Walk 8 problems, tapping correct each time. Capture each
    // problem's correct-chip data-value at tap time so the assertion
    // below can compare positionally without re-reading the static
    // plan source (which would couple the spec to the plan factory).
    const tappedValues: number[] = []
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
      const valueAttr = await correctChip.getAttribute('data-value')
      expect(
        valueAttr,
        `problem ${i}: correct chip must expose data-value`,
      ).not.toBeNull()
      tappedValues.push(Number(valueAttr))
      await correctChip.click()
    }

    // Drive through SessionEnd → Hub so `recordProgressOnSessionEnd`
    // runs (the mount effect is what writes the new SessionHistoryEntry
    // to localStorage).
    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
    const cta = page.getByTestId('session-end-cta')
    await expect(cta).toBeVisible({ timeout: 12_000 })
    await cta.click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    // Read persisted progress. The seed had no history, so the new
    // entry sits at index 0.
    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted, 'persisted progress is null').not.toBeNull()
    expect(
      persisted.history.length,
      'history must contain exactly one new entry from the just-completed math session',
    ).toBe(1)

    const entry = persisted.history[0]!

    // Diagnostic attachment — surfaces the actual captured array in CI
    // failure log without a re-run.
    await testInfo.attach('perProblemAnswerValue-array', {
      body: JSON.stringify(entry.perProblemAnswerValue),
      contentType: 'application/json',
    })

    // Presence: PR #286 ships this on every math session-end write.
    expect(
      entry.perProblemAnswerValue,
      'perProblemAnswerValue must be present on math session entries (PR #286 ships this)',
    ).toBeDefined()

    // Exact-array equality — every entry is the literal value of the
    // chip Marian tapped (which here is every correct chip in order).
    // toEqual not toContain — toContain would pass [v, v, ...] OR
    // [v] OR [v, v, v, v, v, v, v, v, extra], silently allowing the
    // duplicate-fire / over-capture regression we want to prevent.
    expect(entry.perProblemAnswerValue).toEqual(tappedValues)

    // Length: one slot per problem. Pinned separately so a future
    // length-drift regression is the failure message, not the
    // toEqual mismatch.
    expect(
      entry.perProblemAnswerValue!.length,
      `perProblemAnswerValue.length must equal PROBLEM_COUNT (${PROBLEM_COUNT})`,
    ).toBe(PROBLEM_COUNT)

    // Word-song parallel field must NOT appear on a math entry.
    // Positive discriminator that the schema's mutually-exclusive
    // surface separation holds end-to-end.
    expect(
      entry.perProblemAnswerWord,
      'perProblemAnswerWord must be undefined on math session entries (surface separation)',
    ).toBeUndefined()
  })

  test('2. math wrong-then-correct on P1 — perProblemAnswerValue[0] latches the WRONG (first-tap) value, not the eventual correct retry', async ({
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

    // ── Problem 0 — TAP WRONG FIRST, then correct ────────────────────────
    const math = page.getByTestId('math')
    await expect(math).toHaveAttribute('data-problem-index', '0', {
      timeout: 20_000,
    })
    await expect(math).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })

    // Capture the first wrong chip's data-value. The screen ships at
    // least 3 distractor chips per problem; we use the first wrong one.
    // Per `feedback_playwright_disabled_button_click`: chips with
    // `disabled` attribute are no-ops even with force:true, so we
    // explicitly wait for the wrong chip to be enabled before clicking.
    const wrongChip = page
      .locator('[data-testid="math-chip"][data-correct="false"]')
      .first()
    await expect(wrongChip).toBeEnabled({ timeout: 15_000 })
    const wrongValueAttr = await wrongChip.getAttribute('data-value')
    expect(wrongValueAttr, 'wrong chip must expose data-value').not.toBeNull()
    const wrongValue = Number(wrongValueAttr)
    await wrongChip.click()

    // After a wrong tap the screen plays the "Hmm... try again?"
    // reprompt and the chip enters a shake. The CORRECT chip stays
    // enabled — Marian retries. Wait for the correct chip to be
    // available and tap it.
    const correctChipP0 = page.locator(
      '[data-testid="math-chip"][data-correct="true"]',
    )
    await expect(correctChipP0).toBeEnabled({ timeout: 15_000 })
    await correctChipP0.click()

    // ── Problems 1..7 — clean correct walk ───────────────────────────────
    const subsequentValues: number[] = []
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
      const valueAttr = await correctChip.getAttribute('data-value')
      expect(
        valueAttr,
        `problem ${i}: correct chip must expose data-value`,
      ).not.toBeNull()
      subsequentValues.push(Number(valueAttr))
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

    await testInfo.attach('perProblemAnswerValue-array', {
      body: JSON.stringify(entry.perProblemAnswerValue),
      contentType: 'application/json',
    })

    expect(entry.perProblemAnswerValue).toBeDefined()
    const values = entry.perProblemAnswerValue!
    expect(values.length).toBe(PROBLEM_COUNT)

    // ── Load-bearing assertion: P0 latched the FIRST (wrong) tap ─────────
    // Not the eventual correct retry. This is the regression-critical
    // assertion — if the latch ever inverts to last-tap semantics, this
    // value would equal the correct-chip's value instead of `wrongValue`.
    //
    // toBe (scalar pin) chosen over toEqual so the failure message
    // points at the single element with the latch-inversion claim, not
    // the whole array shape.
    expect(
      values[0],
      'perProblemAnswerValue[0] must equal the WRONG first-tap value, NOT the correct retry — first-tap latch is the load-bearing contract from PR #286',
    ).toBe(wrongValue)

    // Tail invariant: P1..P7 captured the correct values we tapped.
    // toEqual on the sub-slice — proves the rest of the array wasn't
    // collateral-damaged by the wrong-tap path.
    expect(values.slice(1)).toEqual(subsequentValues)
  })

  test('3. WordSong wrong-then-correct on P1 — perProblemAnswerWord[0] latches the WRONG (first-tap) word, not the eventual correct retry', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    // Seed a returning user so Splash advances to Hub without Greet.
    // No skill-level overrides — Marian lands on her current focus
    // (cvc-words is at 'intro' per the diagnostic baseline; with no
    // history the picker walks past mastered nodes and lands on the
    // first non-mastered node, which is fine for this spec — we only
    // need the word-song surface to fire, not a specific tier).
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    // ── Problem 0 — TAP WRONG FIRST, then correct ────────────────────────
    await expect(wordSong).toHaveAttribute('data-problem-index', '0', {
      timeout: 20_000,
    })
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })

    const wrongChip = page
      .locator('[data-testid="word-song-chip"][data-correct="false"]')
      .first()
    await expect(wrongChip).toBeEnabled({ timeout: 15_000 })
    const wrongWordAttr = await wrongChip.getAttribute('data-word')
    expect(
      wrongWordAttr,
      'wrong word-song chip must expose data-word',
    ).not.toBeNull()
    const wrongWord = wrongWordAttr!
    await wrongChip.click()

    const correctChipP0 = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChipP0).toBeEnabled({ timeout: 15_000 })
    await correctChipP0.click()

    // ── Problems 1..7 — clean correct walk ───────────────────────────────
    const subsequentWords: string[] = []
    for (let i = 1; i < PROBLEM_COUNT; i++) {
      await expect(wordSong).toHaveAttribute('data-problem-index', String(i), {
        timeout: 20_000,
      })
      await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
        timeout: 20_000,
      })
      const correctChip = page.locator(
        '[data-testid="word-song-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      const wordAttr = await correctChip.getAttribute('data-word')
      expect(
        wordAttr,
        `problem ${i}: correct chip must expose data-word`,
      ).not.toBeNull()
      subsequentWords.push(wordAttr!)
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
    expect(persisted).not.toBeNull()
    expect(persisted.history.length).toBe(1)
    const entry = persisted.history[0]!

    await testInfo.attach('perProblemAnswerWord-array', {
      body: JSON.stringify(entry.perProblemAnswerWord),
      contentType: 'application/json',
    })

    // Presence: PR #286 ships this on every word-song session-end write.
    expect(
      entry.perProblemAnswerWord,
      'perProblemAnswerWord must be present on word-song session entries (PR #286 ships this)',
    ).toBeDefined()
    const words = entry.perProblemAnswerWord!
    expect(words.length).toBe(PROBLEM_COUNT)

    // Load-bearing assertion — P0 latched the FIRST (wrong) word, not
    // the eventual correct retry.
    expect(
      words[0],
      'perProblemAnswerWord[0] must equal the WRONG first-tap word, NOT the correct retry — first-tap latch is the load-bearing contract from PR #286',
    ).toBe(wrongWord)

    // Tail invariant — P1..P7 captured the correct words we tapped.
    expect(words.slice(1)).toEqual(subsequentWords)

    // Math parallel field must NOT appear on a word-song entry.
    expect(
      entry.perProblemAnswerValue,
      'perProblemAnswerValue must be undefined on word-song session entries (surface separation)',
    ).toBeUndefined()
  })

  test('4. back-compat — pre-#286 SessionHistoryEntry (no perProblemAnswerValue field) loads cleanly and a new session appends an entry that DOES carry the field', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // Seed Progress with an OLD-shape history entry — no
    // perProblemAnswerValue field. This is the shape every
    // localStorage blob written before PR #286 carries. The type
    // guard isProgressV1 must accept it (additive optional field;
    // see progress.test.ts new cases for the unit-test surface).
    //
    // We hand-build the Progress shape rather than calling
    // buildSeedProgress with an `history` override, because the
    // helper's typed shape doesn't carry latencyMs / mathFacts /
    // perProblemAnswerValue arrays — pattern matches §4.1.1c
    // (buildSeedProgress widening flag).
    const oldShapeHistoryEntry = {
      dateISO: '2026-05-15T12:00:00.000Z',
      skillFocus: ['add-to-10'],
      successRate: 0.875,
      // NB: no perProblemAnswerValue field. This is the pre-#286
      // shape. isProgressV1 must accept it.
    }
    const baseProgress = buildSeedProgress() as Record<string, unknown>
    const progressWithOldEntry = {
      ...baseProgress,
      history: [oldShapeHistoryEntry],
    }
    await seedLocalStorage(page, {
      progress: progressWithOldEntry,
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    // ── Discriminator A — the OLD-shape entry survived the type-guard ────
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
      beforeRun!.history[0]!.perProblemAnswerValue,
      'old-shape entry must NOT carry perProblemAnswerValue (back-compat baseline)',
    ).toBeUndefined()

    // Run a fresh math session so a NEW entry is appended.
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })

    const tappedValues: number[] = []
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
      const valueAttr = await correctChip.getAttribute('data-value')
      expect(
        valueAttr,
        `problem ${i}: correct chip must expose data-value`,
      ).not.toBeNull()
      tappedValues.push(Number(valueAttr))
      await correctChip.click()
    }

    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
    const cta = page.getByTestId('session-end-cta')
    await expect(cta).toBeVisible({ timeout: 12_000 })
    await cta.click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    // ── Discriminator B — both old and new shape coexist in history ──────
    const persisted = (await readProgressFromPage(page)) as PersistedProgress
    expect(persisted).not.toBeNull()
    expect(
      persisted.history.length,
      'history must contain the old-shape entry AND the new just-completed entry',
    ).toBe(2)

    // Old entry still has no perProblemAnswerValue (back-compat).
    const oldEntry = persisted.history[0]!
    expect(
      oldEntry.perProblemAnswerValue,
      'old-shape entry must STILL have no perProblemAnswerValue after the new session — historical entries are not retroactively modified',
    ).toBeUndefined()

    // New entry DOES have the field, populated from the live walk.
    const newEntry = persisted.history[1]!
    expect(
      newEntry.perProblemAnswerValue,
      'NEW (post-#286) math session entry must carry perProblemAnswerValue',
    ).toBeDefined()
    await testInfo.attach('new-entry-perProblemAnswerValue', {
      body: JSON.stringify(newEntry.perProblemAnswerValue),
      contentType: 'application/json',
    })
    expect(newEntry.perProblemAnswerValue).toEqual(tappedValues)
  })
})
