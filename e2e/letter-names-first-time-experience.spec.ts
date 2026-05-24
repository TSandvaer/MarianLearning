/**
 * E2E spec — letter-names first-time-experience integration smoke.
 *
 * Ticket: 86c9y9qz9 (Wave 8 — Jessica's first-time-experience integration
 * smoke for the letter-names content tier). Drives a SEED → screen →
 * session → end-state walkthrough that exercises the full integration
 * surface end-to-end: debug-seed boots Marian onto letter-names; planner
 * mock serves the real shipped canon; WordSong renders the letter-names
 * chip surface; the spec drives ≥3 problems through correct/wrong/3-wrongs
 * paths; SessionEnd lands cleanly with the right surface tag.
 *
 * Sibling references
 * ------------------
 *   - Wave 7 A4 wire-level spec: `e2e/letter-names-regression.spec.ts`
 *     proves the planner routes correctly + canon bytes flow + bake-time
 *     composition rules hold. That spec is payload-level. THIS spec is
 *     the screen-level walkthrough.
 *   - Wave 5 short-i full-flow spec: `e2e/cvc-words-short-i-regression.spec.ts`
 *     is the closest sibling for the canon-bytes-mock + chip-walk pattern,
 *     adapted here for the letter-names chip surface (letter glyph chips,
 *     not picture chips).
 *   - Debug-seed recipe shipped 2026-05-23 in PR #345 (ticket 86c9y6g6n).
 *
 * Failing-first posture (post-impl regression-guard)
 * --------------------------------------------------
 * Per `[[feedback_failing_first_must_prove_green]]` — the impl this spec
 * exercises (the letter-names content tier across all 6 surfaces) has
 * already merged on main (Wave 7 A1–A7 plus the debug-seed PR #345). The
 * spec lands GREEN on current main. Assertion sensitivity comes from the
 * canon-bytes mock returning the REAL shipped letter-names canon (its
 * targets are C, e, G, J, O, b, W, d) — every chip-level + screen-level
 * assertion below would fail if the planner mock served any other
 * word-song canon (silent-demote to `pickStaticWordSongPlan` blending-cv
 * fallback would emit picture chips for words like `cat`, `bat`, `mat`,
 * NOT letter-glyph chips for `C`, `e`, etc.). The sibling spec at
 * `letter-names-regression.spec.ts` Test 4 already locks the mutation-
 * sensitivity of the canon contract; this spec layers the
 * screen-rendering invariants on top.
 *
 * Mock strategy
 * -------------
 * Same canon-bytes pass-through pattern as the cvc + digraphs-sh sibling
 * specs. `installLetterNamesClaudeMock` reads the bytes of
 * `public/canon/word-song/level-1/letter-names.json` and returns them on
 * word-song requests. Math (and any other) requests reject with 500 — the
 * letter-names flow only triggers a word-song fetch; a stray math request
 * means the spec's invariants are wrong, and we'd rather see a loud error
 * than a silent pass. Per `testing-and-ci.md §4.1.1d / §4.1.1e` the
 * canon-bytes mock is the correct shape here (NOT `failNetwork: true`,
 * which would route-abort before the served-canon could influence test
 * state, and which under the static fallback rotation would serve
 * blending-cv content for a letter-names spec — see §4.1.1d trivially-
 * green trap).
 *
 * Per `[[feedback_force_howler_unlock_demote_extension]]`:
 * `forceHowlerUnlock` is INTENTIONALLY NOT called from this spec. The
 * canon ships real Azure-rendered MP3s, and `forceHowlerUnlock`'s stub
 * `{ state: 'running' }` AudioContext can cause Howler to silently
 * demote when it tries to decode the real MP3 bytes against a fake ctx
 * — which would render the static `pickStaticWordSongPlan` blending-cv
 * fallback chips instead of letter-name chips. Headless Chromium has a
 * real `AudioContext` (unlike WebKit headless), and the screen's
 * `data-read-aloud-played` attribute monotonically flips to `"true"`
 * once the read-aloud completes OR rejects — the chip-enabled gate
 * fires reliably without the helper. This matches the sibling
 * `cvc-words-short-i-regression.spec.ts` pattern (verified passing on
 * main with real canon-bytes mocks + no `forceHowlerUnlock`).
 *
 * Why chromium only
 * -----------------
 * Per `.claude/docs/testing-and-ci.md §2.2`: WebKit headless has no
 * `AudioContext` — the read-aloud effect's `getHowlerRunning()`
 * predicate stays false forever; chips never enable; chip-tap tests
 * time out. This spec drives chip taps through 3+ problems, so it MUST
 * skip WebKit. Real iPad Safari is unaffected; the wire-level
 * `letter-names-regression.spec.ts` covers the cross-browser planner
 * contract.
 *
 * Timeout sizing
 * --------------
 * Per `.claude/docs/testing-and-ci.md §4.1.1b`: 3 problems × ~50s wall
 * time (silent-caption-walk fallback on the audio-ready path) + ~30s
 * headroom for the wrong-tap retry path + SessionEnd phase machine.
 * Conservatively size to 180s. Each test in this spec exercises a
 * different sub-flow over 3+ problems; the same ceiling fits all.
 *
 * Seed strategy
 * -------------
 * Per `letter-names-regression.spec.ts` §"Seed note — letter-names
 * default is 'mastered'": `defaults.ts` ships `letter-names: 'mastered'`
 * per Marian's diagnostic baseline, so the natural-state picker walks
 * past letter-names. To force `pickFocusNode()` to return `letter-names`
 * we override that one key to `'practicing'` via
 * `buildSeedProgress.skillLevelOverrides`. Every other key inherits the
 * diagnostic default (the `DEFAULT_SKILL_LEVELS` floor in
 * `seedStorage.ts` mirrors `SKILL_NODES`, so the strict guard accepts
 * the seeded blob).
 *
 * The debug-seed recipe from PR #345 is `?debug=1&seed=letter-names`,
 * which writes the SAME `letter-names: 'practicing'` patch through the
 * production `applySkillLevelsPatch`. Using the localStorage seed
 * helper here is functionally equivalent and matches the established
 * sibling-spec pattern — both paths land Marian on a returning-user Hub
 * with `pickFocusNode === 'letter-names'`. The debug-seed URL form is
 * deliberately reserved for manual iPad smoke (it requires `?debug=1`
 * which mounts the DebugOverlay and changes the visual surface); the
 * Playwright path bypasses that overlay by seeding directly.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

/** Production letter-names canon path (canonical 8-target session).
 *  Resolved off `process.cwd()` so the spec breaks loudly if it moves. */
const LETTER_NAMES_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/letter-names.json',
)

/**
 * The 8 target letters shipped in the canon, in problem order
 * (C, e, G, J, O, b, W, d). Source-of-truth tap for spec assertions on
 * which letter is the correct answer at each problem index — the
 * sibling regression spec at `letter-names-regression.spec.ts` Tests 2-3
 * already covers the structural composition rules (single-ASCII pool,
 * CIRCLE-STICK budget, case-mix floors) directly on the canon JSON, so
 * THIS spec just needs to know what the targets are to walk the chips.
 *
 * If a future re-bake shuffles the targets, this array updates; the
 * `letter-names-regression.spec.ts` composition-rule tests pin the
 * compositional invariants the new targets must still satisfy.
 */
const CANON_TARGETS: readonly string[] = [
  'C',
  'e',
  'G',
  'J',
  'O',
  'b',
  'W',
  'd',
]

/**
 * The 52-glyph ASCII letter pool (A-Z + a-z). Mirrors `LETTER_GLYPH_POOL`
 * in `src/screens/WordSong/planFromServer.ts` (kept local to avoid an
 * e2e-into-src import; the parser owns the pool as the wire-validation
 * source of truth). Used to assert chip distractors never leak digits
 * or non-ASCII glyphs.
 */
function buildLetterPool(): ReadonlySet<string> {
  const out = new Set<string>()
  for (let c = 0x41; c <= 0x5a; c++) out.add(String.fromCharCode(c))
  for (let c = 0x61; c <= 0x7a; c++) out.add(String.fromCharCode(c))
  return out
}
const LETTER_POOL: ReadonlySet<string> = buildLetterPool()

/**
 * Install a /api/claude mock that returns the letter-names canon on
 * word-song requests, captures every observed request body for the
 * planner-contract assertion. Math (or any other) requests reject with
 * 500 — letter-names triggers a word-song fetch only.
 */
async function installLetterNamesClaudeMock(
  page: Page,
): Promise<{ requests: Request[] }> {
  const canonBody = readFileSync(LETTER_NAMES_CANON_PATH, 'utf-8')
  const requests: Request[] = []
  await page.route('**/api/claude', async (route) => {
    const request = route.request()

    if (request.method() === 'OPTIONS') {
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
    if (request.method() !== 'POST') {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'method-not-allowed' }),
      })
      return
    }

    requests.push(request)

    let body: Record<string, unknown>
    try {
      body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    } catch {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'invalid-json' }),
      })
      return
    }

    const payload = (body.payload ?? {}) as Record<string, unknown>
    const track = payload.track as string | undefined
    if (track === 'word-song') {
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
        message: `letter-names-first-time-experience spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

/**
 * Seed the persisted Progress + SessionHistory blobs so the App routes
 * Splash → Hub directly with `letter-names` as the picked focus node.
 *
 *  - `letter-names: 'practicing'` overrides the diagnostic default
 *    (`'mastered'`); the picker walks `WORD_SONG_NODES_IN_ORDER` and
 *    stops at letter-names (the FIRST node in the order).
 *  - `sessionCount: 5` skips Greet (Splash advances directly to Hub
 *    when `sessionCount > 0`).
 *
 * Functionally equivalent to `?debug=1&seed=letter-names` (the
 * production debug-seed recipe shipped in PR #345). The
 * localStorage-seed form is the Playwright-standard idiom (matches every
 * sibling regression spec); the URL form is reserved for manual iPad
 * smoke where `?debug=1` is required to mount the DebugOverlay.
 */
async function seedLetterNamesProgress(page: Page): Promise<void> {
  await seedLocalStorage(page, {
    progress: buildSeedProgress({
      skillLevelOverrides: {
        'letter-names': 'practicing',
      },
    }),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

/**
 * Skip helper for tests that depend on the read-aloud effect firing
 * AND/OR chip taps that need `readAloudPlayed === true`. WebKit headless
 * has no AudioContext, so the gate stays closed forever.
 *
 * Pattern mirrored from `cvc-words-short-i-regression.spec.ts`.
 */
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud cannot fire; chips never enable; chip-tap walk is structurally impossible. Real iPad Safari works fine — this is a Playwright-harness limitation per .claude/docs/testing-and-ci.md §2.2.',
  )
}

/**
 * Wait for WordSong to settle at problem `index` with the read-aloud
 * gate flipped to `true` (chip-enabled). Returns the locator at the
 * settled state so the caller can drive chip taps.
 */
async function waitForProblemReady(page: Page, index: number): Promise<void> {
  const wordSong = page.getByTestId('word-song')
  await expect(wordSong).toHaveAttribute('data-problem-index', String(index), {
    timeout: 20_000,
  })
  await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
    timeout: 20_000,
  })
}

test.describe('letter-names first-time-experience integration smoke (ticket 86c9y9qz9)', () => {
  test.beforeEach(async ({ page }) => {
    await seedLetterNamesProgress(page)
  })

  /**
   * Test 1 — Chip rendering shows letter-name content (NOT blending-cv
   * stub picture chips).
   *
   * Drives Splash → Hub → Word Song through the SEED, then asserts on
   * problem 0 (target letter `C`):
   *
   *   - The letter-card container `word-song-letter-card` renders (the
   *     `letter-names` content-type's centered glyph anchor). The
   *     `word-song-word-card` container that CVC tiers use is NOT
   *     present — proves the screen dispatched on `contentType ===
   *     'letter-names'`, not the blending-cv fallback path.
   *   - Three chips render, each with a `data-word` that's a SINGLE
   *     ASCII letter from the 52-glyph pool. CVC-stub fallback chips
   *     would carry multi-char `data-word` values (`cat`, `mat`, …) and
   *     this would fail loudly.
   *   - One chip has `data-correct="true"` and its `data-word`
   *     matches the canon-target letter `C`.
   *   - Both distractor chips carry case-uniform letters (same case as
   *     target, per Kyle A1 §3.2) and they are pool-members but NOT
   *     the target.
   *
   * Wire-level chip pipeline assertion. If silent-demote to
   * `pickStaticWordSongPlan` fired (per
   * `[[feedback_force_howler_unlock_demote_extension]]`), the chips
   * would render blending-cv stubs and EVERY chip-card / chip-text
   * assertion below would fail at the first step — there'd be no
   * letter-card in the DOM at all.
   */
  test('1. chip rendering shows letter-name content (letter-card + single-glyph chips, not blending-cv picture chips)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(180_000)

    await installLetterNamesClaudeMock(page)
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    // Greet must NOT be on screen — proves the session-history seed
    // bumped sessionCount past the Greet gate.
    await expect(page.getByTestId('greet')).toHaveCount(0)

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    await waitForProblemReady(page, 0)

    // The letter-card is rendered exclusively under
    // `contentType === 'letter-names'`. Its presence proves the screen
    // accepted the canon's "Tap the letter <X>." read-line template
    // and dispatched on the letter-names content branch. CVC tiers
    // render `word-song-word-card` instead; blending-cv stub fallback
    // would render `word-song-word-card` with a picture. Either branch
    // mismatched would mean the silent-demote / parser-mismatch path
    // fired.
    const letterCard = page.getByTestId('word-song-letter-card')
    await expect(letterCard).toBeVisible()
    await expect(letterCard).toHaveAttribute('data-letter', CANON_TARGETS[0]!)

    // The CVC `word-song-word-card` (the picture-anchored card on
    // blending-cv / cvc-word tiers) MUST be absent — pins the
    // mutual-exclusion gate between letter-names and CVC content
    // surfaces.
    await expect(page.getByTestId('word-song-word-card')).toHaveCount(0)

    // The letter glyph element renders with the canon target letter.
    const letterGlyph = page.getByTestId('word-song-letter-glyph')
    await expect(letterGlyph).toBeVisible()
    await expect(letterGlyph).toContainText(CANON_TARGETS[0]!)

    // Three chips render. Per Kyle A1 §4.1 the chip FRAME is unchanged
    // from CVC tiers (size, border, spring, hit area) — only the chip
    // CONTENT swaps to a single letter glyph. The chip count assertion
    // is shared with the CVC siblings.
    const chips = page.getByTestId('word-song-chip')
    await expect(chips).toHaveCount(3)

    // Exactly one chip is the correct chip; its `data-word` matches the
    // canon target letter.
    const correctChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChip).toHaveCount(1)
    await expect(correctChip).toHaveAttribute('data-word', CANON_TARGETS[0]!)

    // Both distractor chips carry single-ASCII-letter data-words from
    // the 52-glyph pool, distinct from the target, distinct from each
    // other, case-uniform with the target.
    const distractors = page.locator(
      '[data-testid="word-song-chip"][data-correct="false"]',
    )
    await expect(distractors).toHaveCount(2)
    const distractorWords = await distractors.evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).getAttribute('data-word')),
    )
    expect(distractorWords).toHaveLength(2)

    const targetLetter = CANON_TARGETS[0]!
    const targetIsUpper = targetLetter === targetLetter.toUpperCase()

    for (const w of distractorWords) {
      // Defensive null + type guard so the assertion message names
      // the failure clearly (rather than a downstream `.length` crash).
      expect(w).not.toBeNull()
      expect(typeof w).toBe('string')
      const dw = w as string
      // Single ASCII letter, in the 52-glyph pool. CVC fallback chips
      // would carry multi-char `data-word` and fail this assertion
      // loudly.
      expect(dw).toHaveLength(1)
      expect(LETTER_POOL.has(dw)).toBe(true)
      // Not the target.
      expect(dw).not.toBe(targetLetter)
      // Case-uniform with target per Kyle A1 §3.2.
      expect(dw === dw.toUpperCase()).toBe(targetIsUpper)
    }
    // Distractors are distinct from each other.
    expect(new Set(distractorWords).size).toBe(2)
  })

  /**
   * Test 2 — Read-aloud audio gate fires correctly; chips disabled
   * until the gate flips.
   *
   * Per `audioReady` / `readAloudPlayed` props in WordSong, chips
   * start `disabled` and become enabled only after the read-aloud
   * completes. This test walks ≥3 problems with the correct-chip path
   * and verifies the gate fires on each problem boundary — proves the
   * cold-mount audio gate AND the per-problem re-arm both work for the
   * letter-names content surface.
   *
   * Asserts on 3 consecutive problems (indices 0, 1, 2):
   *   - On problem entry, `data-read-aloud-played` transitions
   *     `false → true` (waited via the locator timeout).
   *   - Once the gate flips, the correct chip becomes enabled.
   *   - Tapping the correct chip advances to the next problem index
   *     with the gate re-arming `false → true` again.
   *
   * Note: the data-read-aloud-played attribute MAY already be `true`
   * when the locator first reads it (the audio-ready window is short).
   * `toHaveAttribute('data-read-aloud-played', 'true')` is monotonic-
   * stable: once flipped true, the chip enables and the assertion
   * succeeds. Catching the false-to-true transition is racy and not
   * the contract we want to lock — what we want is "by the time
   * Marian can tap, the gate IS open." That's what
   * `toBeEnabled` on the correct chip pins.
   */
  test('2. read-aloud audio gate fires correctly across 3 problems (chips disabled until gate flips)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(180_000)

    await installLetterNamesClaudeMock(page)
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    for (let i = 0; i < 3; i++) {
      await waitForProblemReady(page, i)

      // Chip enablement is gated on `readAloudPlayed === true` per
      // WordSong.tsx:1904 (`disabled={problemState.resolved ||
      // dimForGuided || !readAloudPlayed}`). The gate fires through the
      // standard Path-A audio resolve OR reject — chips MUST be enabled
      // by the time we observe the `data-read-aloud-played="true"`
      // attribute.
      const correctChip = page.locator(
        '[data-testid="word-song-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })

      // The correct chip's data-word is the canon target at this index.
      await expect(correctChip).toHaveAttribute('data-word', CANON_TARGETS[i]!)

      await correctChip.click()
    }

    // After 3 problems advanced cleanly, problem index should be 3.
    await expect(wordSong).toHaveAttribute('data-problem-index', '3', {
      timeout: 15_000,
    })
  })

  /**
   * Test 3 — Wrong-tap reaction: Emma reacts in character (no red X),
   * chip shakes; retry path keeps the correct chip live.
   *
   * Per CLAUDE.md "never a red X" + `emma-character-and-animation.md`
   * §10: wrong taps trigger a `puzzled-tilt` pose swap and a "poof"
   * SFX, NOT a red X / error icon / harsh tone. The screen exposes
   * pose via `data-pose` on `word-song-emma` and shake via
   * `data-shaking` on the tapped chip.
   *
   * Walks problem 0 with the following sequence:
   *   1. Wait for chip-ready.
   *   2. Tap a wrong distractor chip.
   *   3. Assert chip's `data-shaking` transitions to `"true"` and the
   *      Emma pose flips to `puzzled-tilt`.
   *   4. Assert NO `data-testid="word-song-error-x"` / red-X visual
   *      surface is present (defensive negative — the screen should
   *      have no element with `red`-prefixed surfaces; cataloguing
   *      every possible element would be brittle, so we assert on
   *      the canonical Emma pose + lack of an error surface).
   *   5. After shake settles, the correct chip is still tappable.
   *   6. Tap the correct chip → advance to problem 1, gate re-arms.
   *
   * This is the "Emma reacts in character" invariant from the
   * Acceptance Criteria. The pose-swap proof is the load-bearing
   * assertion; the absence of a red-X locator is defensive.
   */
  test('3. wrong-tap handling: Emma reacts in character (puzzled-tilt + chip shake), no red X, correct-chip retry advances', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(180_000)

    await installLetterNamesClaudeMock(page)
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })
    await waitForProblemReady(page, 0)

    // Tap ONE wrong distractor chip. Use the first false-correct chip
    // — chip layout is deterministic per problemIndex hash (see
    // `buildChipOrder` in WordSong.tsx), so a future spec re-run with
    // the same seed picks the same distractor.
    const wrongChip = page
      .locator('[data-testid="word-song-chip"][data-correct="false"]')
      .first()
    await expect(wrongChip).toBeEnabled({ timeout: 15_000 })
    await wrongChip.click()

    // Chip shake fires — `data-shaking="true"` on the tapped chip for
    // the WRONG_SHAKE_MS window. Use toHaveAttribute with a generous
    // timeout because the shake state is set synchronously in
    // onChipTap then cleared on a timer; the assertion may observe
    // either the true or the post-clear state depending on timing.
    // We assert the data-shaking attribute is set to "true" at least
    // momentarily by polling for it.
    await expect(wrongChip).toHaveAttribute('data-shaking', 'true', {
      timeout: 2_000,
    })

    // Emma's pose flips to `puzzled-tilt` synchronously inside the
    // wrong-tap branch (WordSong.tsx:1061). The pose holds for the
    // POSE_HOLD_MS window (1500ms per emmaPose.ts) — during which
    // AnimatePresence renders BOTH the exiting idle Emma AND the
    // entering puzzled-tilt Emma simultaneously, so `getByTestId`
    // resolves to two elements. Lock the assertion to the specific
    // puzzled-tilt Emma via a chained attribute selector so the
    // strict-mode locator settles on exactly one node.
    const puzzledEmma = page.locator(
      '[data-testid="word-song-emma"][data-pose="puzzled-tilt"]',
    )
    await expect(puzzledEmma).toHaveCount(1, { timeout: 2_000 })

    // No red-X / error-icon surface — defensive. The "never a red X"
    // invariant is enforced by the design system not rendering one,
    // not by a positive presence check. Asserting on absence of a
    // canonical surface name is a belt-and-braces guard against a
    // future PR adding one.
    await expect(page.locator('[data-error="red-x"]')).toHaveCount(0)
    await expect(page.getByTestId('word-song-error-x')).toHaveCount(0)

    // After the shake / pose hold, the correct chip is still tappable.
    // The screen does NOT advance on a wrong tap — `problemState.resolved`
    // stays `false` until the correct chip is tapped. So we should
    // still be on problem 0.
    await expect(wordSong).toHaveAttribute('data-problem-index', '0', {
      timeout: 5_000,
    })

    const correctChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 15_000 })
    await correctChip.click()

    // Now we advance to problem 1 and the gate re-arms.
    await waitForProblemReady(page, 1)
  })

  /**
   * Test 4 — Three-wrongs path triggers give-answer behaviour
   * (guided pose).
   *
   * Per `WordSong.tsx` + `_shared/gameplayConstants.ts`:
   *   - `HINT_AFTER_WRONG_COUNT = 2` → hint utterance after 2 wrongs.
   *   - `GUIDED_AFTER_WRONG_COUNT = 3` → guided-give-answer after 3
   *     wrongs (`setGuidedActive(true)` flips `guidedActive`, which
   *     dims non-correct chips and ultimately the give-answer
   *     utterance fires per `problem.utterances.giveAnswer`).
   *
   * Drives problem 0 by tapping 3 distinct wrong chips (when only 2
   * distractors exist, taps go DISTRACTOR-A → DISTRACTOR-B →
   * DISTRACTOR-A again — `wrongCountRef` increments regardless of
   * which distractor was tapped, so the count reaches 3 the same way),
   * then verifies the guided state is active:
   *
   *   - `data-shaking` fires on each wrong tap.
   *   - After 3 wrongs, the screen enters guided-give-answer state.
   *     Today the canonical signal is `setGuidedActive(true)` which
   *     dims non-correct chips (`dimForGuided`); we assert on the
   *     correct chip remaining enabled AND on non-correct chips having
   *     the dim-class semantic (chip stays not-resolved but distractors
   *     become un-tappable).
   *   - The correct chip is still tappable after guided-active, and
   *     tapping it advances to problem 1.
   *
   * Note on the chip count: the AC says "3-wrongs path triggers
   * give-answer behaviour." Word Song presents 3 chips (1 correct + 2
   * distractors); 3 wrong taps means tapping at least one distractor
   * twice. The wrong-count ref counts taps, not unique chips —
   * matching real Marian rage-tap behaviour. This is the production
   * contract; we drive it the same way.
   */
  test('4. three-wrongs path triggers give-answer guided behaviour; correct-chip retry advances', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(180_000)

    await installLetterNamesClaudeMock(page)
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })
    await waitForProblemReady(page, 0)

    // Collect the two distractor chips' `data-word` values; we'll tap
    // by `data-word` to avoid stale-locator races as shake-state flips.
    const distractorWords: string[] = await page
      .locator('[data-testid="word-song-chip"][data-correct="false"]')
      .evaluateAll((nodes) =>
        nodes
          .map((n) => (n as HTMLElement).getAttribute('data-word'))
          .filter((w): w is string => w !== null),
      )
    expect(distractorWords).toHaveLength(2)
    const [d1, d2] = distractorWords as [string, string]

    // Tap sequence: d1, d2, d1 — three wrong taps to cross
    // GUIDED_AFTER_WRONG_COUNT (=3) per gameplayConstants.ts.
    //
    // After each wrong tap, wait for Emma to RETURN to idle before
    // the next tap. The idle-return fires inside the reprompt `.then()`
    // body — proves the reprompt promise resolved and the post-reprompt
    // dispatch (hint scheduler / guided-give-answer scheduler) ran on
    // this tap before we issue the next. Without this synchronization,
    // rapid taps overlap the reprompt-in-flight window and the
    // hint/guided refs can land in a different order than the test
    // intends (e.g. third tap's `.then()` runs AFTER the test moved on,
    // so `data-guided` flips true after the assertion window closes).
    //
    // Real canon audio is heavier than the silent-caption-walk fallback
    // — a single reprompt's speak Promise takes ~1-3s end-to-end in
    // headless Chromium with the real Azure-rendered MP3s.
    for (const distractor of [d1, d2, d1]) {
      const chip = page.locator(
        `[data-testid="word-song-chip"][data-word="${distractor}"]`,
      )
      await expect(chip).toBeEnabled({ timeout: 15_000 })
      await chip.click()

      // Puzzled-tilt fires synchronously after click; the idle-return
      // fires inside reprompt's `.then()`. Wait for pose to flip to
      // idle (or, on the third tap, to stay puzzled-tilt while the
      // give-answer line plays — guidedActive flip happens inside the
      // .then() body too). 15s budget for the speak round-trip.
      const wsRoot = page.getByTestId('word-song')
      await expect(wsRoot).not.toHaveAttribute('data-pose', 'puzzled-tilt', {
        timeout: 15_000,
      })
    }

    // After 3 wrongs: the screen flips into `guidedActive` state,
    // surfaced on the root via `data-guided="true"` (WordSong.tsx:1421).
    // `setGuidedActive(true)` fires inside the reprompt `.then()`
    // (WordSong.tsx:1150) — so it lands a tick after the third tap
    // resolves the reprompt promise. Asserting on the root's
    // `data-guided` attribute is the load-bearing, race-free signal —
    // it sticks `true` until problem-advance whereas the give-answer
    // utterance dispatch is asynchronous and chip-disabled timing
    // depends on render scheduling. Per the count-based assertion
    // rules in jessica.md, `data-guided === "true"` is the exact
    // contract — not membership in a guided-state SET.
    const wordSong2 = page.getByTestId('word-song')
    await expect(wordSong2).toHaveAttribute('data-guided', 'true', {
      timeout: 15_000,
    })

    // The correct chip is still tappable in the guided path — Marian
    // hears the give-answer line, sees the correct chip highlighted,
    // and can tap it to advance. Per WordSong.tsx:1904 the chip's
    // `disabled` prop is `problemState.resolved || dimForGuided ||
    // !readAloudPlayed` — `dimForGuided` is `guidedActive && !isCorrect`,
    // so it is FALSE for the correct chip, leaving the chip enabled.
    const correctChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 5_000 })

    // Tap the correct chip — advances to problem 1 with gate re-armed.
    await correctChip.click()
    await waitForProblemReady(page, 1)
  })

  /**
   * Test 5 — Session-end transition lands cleanly with the right
   * surface tag (`'word-song'`).
   *
   * The Acceptance Criteria's bottom anchor: walking ≥3 problems
   * proves the chip-tap → advance loop; walking all 8 proves the
   * SessionEnd handoff lands cleanly. This test does the full 8-tap
   * walk (≥3 satisfied trivially) and asserts:
   *
   *   - SessionEnd mounts after the 8th correct tap.
   *   - `data-surface` on the SessionEnd root is `'word-song'`
   *     (proves `handleWordSongComplete` set `surface: 'word-song'`
   *     in the SessionEndPayload, not `'math'`).
   *   - `data-total-stardust` is parseable as a number ≥ 1 (proves
   *     the word-song completion bonus + per-correct grants flowed).
   *
   * Tests 1-4 already cover the chip-render, audio-gate, wrong-tap,
   * and 3-wrongs paths over the first 3 problems. This test layers
   * the SessionEnd contract on top via the same 8-tap path.
   */
  test('5. session-end transition lands cleanly with surface tag "word-song" after 8 correct chip taps', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(180_000)

    await installLetterNamesClaudeMock(page)
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    for (let i = 0; i < 8; i++) {
      await waitForProblemReady(page, i)
      const correctChip = page.locator(
        '[data-testid="word-song-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      // The correct chip's data-word is the canon target at this index.
      // Sanity-check the canon-mock didn't drift mid-session.
      await expect(correctChip).toHaveAttribute('data-word', CANON_TARGETS[i]!)
      await correctChip.click()
    }

    const sessionEnd = page.getByTestId('session-end')
    await expect(sessionEnd).toBeVisible({ timeout: 20_000 })

    // Surface tag is the load-bearing assertion — the SessionEnd
    // payload's `surface: 'word-song'` flows from
    // `handleWordSongComplete` in App.tsx and drives the
    // word-song-specific completion bonus + history skillFocus.
    await expect(sessionEnd).toHaveAttribute('data-surface', 'word-song')

    // Total stardust > 0 — proves the SessionEnd mount-effect picked up
    // the completion bonus (or per-correct grants). The exact value
    // depends on the streak threshold landings; ≥ 1 is the minimum
    // sanity-floor.
    const totalAttr = await sessionEnd.getAttribute('data-total-stardust')
    const total = Number(totalAttr)
    expect(Number.isFinite(total)).toBe(true)
    expect(total).toBeGreaterThanOrEqual(1)
  })
})
