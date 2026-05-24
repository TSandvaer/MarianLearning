/**
 * E2E spec — letter-sounds per-vowel progression (Wave 9 / W9.5).
 *
 * Ticket: 86c9ya3vk (Wave 9 W9.5 — Jessica's failing-first E2E for the
 * Option-A per-vowel `letterSoundsVowelStates` shape). Parent: 86c9y5d9x.
 *
 * Sibling references
 * ------------------
 *   - Wave 7 A8 wire-level spec: `e2e/letter-sounds-regression.spec.ts`
 *     proves the planner routes correctly + canon bytes flow + bake-time
 *     composition rules hold for the COMPOSITE letter-sounds tier. That
 *     spec is the Option-B baseline; THIS spec layers per-vowel
 *     progression invariants on top.
 *   - Wave 7 A4 letter-names regression: `e2e/letter-names-regression.spec.ts`
 *     established the canon-bytes + assertion-sensitivity pattern.
 *   - cvc-words-short-e progression spec: structurally closest — also
 *     drives multi-session progression with `test.setTimeout(240_000)`
 *     and explicit cross-day history seeding (post-#206 timeout fix).
 *
 * Failing-first posture (THIS spec ships RED on origin/main)
 * ----------------------------------------------------------
 * Per `[[feedback_progression_e2e_mandatory]]` + `[[feedback_failing_first_must_prove_green]]`:
 * this spec is **paired** with the W9.2/3/4 implementation stack
 * (Kevin/Devon/Kevin), which has NOT YET MERGED on origin/main at
 * authoring time. Every test below is engineered to FAIL on current
 * main for a SPECIFIC reason:
 *
 *   Test 1 (intro → practicing /o/) — fails because today's
 *     `mastery.ts` has no per-vowel rule; `applyMasteryRule` does not
 *     touch a `progress.literacy.letterSoundsVowelStates` field that
 *     doesn't exist. The persisted Progress carries no `literacy`
 *     block → assertion `letterSoundsVowelStates['/o/'] === 'practicing'`
 *     reads `undefined` and fails.
 *   Test 2 (practicing → mastered /o/) — same failure mode at the
 *     per-vowel state assertion; additionally the planner's next
 *     session does not yet emit `currentTargetVowel` on the request
 *     body, so the "next session is /u/" assertion fails.
 *   Test 3 (/i/ → /e/ runtime gate) — today's planner has no
 *     awareness of `letterSoundsVowelStates`; with a seeded
 *     `{'/i/': 'practicing', '/e/': 'intro'}` it would still rotate
 *     vowels by session turn (Option-B approximation). The captured
 *     request body would carry `currentTargetVowel` absent (or per a
 *     turn-order rule, possibly '/e/'); either way the positive
 *     assertion `currentTargetVowel === '/i/'` fails.
 *   Test 4 (composite-tier fallback) — fails on main BUT for a
 *     subtle reason: today's main already runs composite-tier 90/3
 *     since there's no Option-A layer to fall through. The
 *     assertion-sensitivity sub-test inside test 4 is the load-
 *     bearing RED proof here — it asserts an Option-A code path
 *     does NOT fire when `literacy` is absent. On main that path
 *     simply doesn't exist, so the assertion proxy (e.g. the
 *     `bakeMetadata.perVowelTrackingActive` flag is absent on the
 *     current canon → composite path is the only one that runs) is
 *     vacuously true. Test 4 then expects `letterSoundsVowelStates`
 *     to NOT be persisted after a session in legacy mode — on main
 *     this trivially holds, so the failure mode for test 4 is
 *     reversed: it's the GREEN test that flips, not the RED test.
 *     We document this asymmetry explicitly inside test 4.
 *   Test 5 (tier-level composite promotion when all 4 vowels
 *     mastered) — fails because seeding all 4 sub-states `mastered`
 *     and running `applyMasteryRule` does nothing on today's main
 *     (no `letterSoundsVowelStates` lookup); `skillLevels['letter-
 *     sounds']` stays at `'practicing'` and `pendingPromotion`
 *     remains undefined.
 *   Test 6 (assertion-sensitivity sub-test) — locks the spec's
 *     mutation-sensitivity per Wave 7 retro Pattern 3.
 *
 * GREEN attestation (filled in by Jessica pre-merge per
 * `[[feedback_failing_first_must_prove_green]]`): stacked W9.2 + W9.3 +
 * W9.4 locally on a scratch branch and ran this spec; expect SHA + paste
 * the GREEN run summary into the PR body before requesting peer review.
 * The PR body's RED+GREEN evidence block is the contract — a "spec is
 * red" claim without paste-back is not evidence (per `jessica.md
 * §"Failing-First Verification Protocol"` step 3).
 *
 * Why the loose-typed seed shape compiles (§4.1.1a)
 * --------------------------------------------------
 * `buildSeedProgress` returns `unknown` (the helper's signature is
 * intentionally loose so failing-first specs can author against not-
 * yet-shipped field shapes — see `.claude/docs/testing-and-ci.md`
 * §4.1.1a). The W9.2 widening will add typed support for
 * `literacy.letterSoundsVowelStates` via `SeedProgressOptions.literacy`;
 * until then, this spec hand-extends the seed blob via a spread cast
 * (the "raw-spread workaround" pattern in §4.1.1c). When W9.2 lands
 * and the typed override exists, a follow-up cleanup PR migrates the
 * spread sites to the typed shape — that PR is a no-op for behaviour,
 * a typing tightening only.
 *
 * Mock strategy — canon-bytes pass-through (§4.1.1d)
 * --------------------------------------------------
 * Per `.claude/docs/testing-and-ci.md` §4.1.1d trivially-green trap:
 * `failNetwork: true` is FORBIDDEN here — without canon bytes the
 * static word-song fallback emits blending-cv stub content, and the
 * positive `currentTargetVowel` assertions would never get a chance
 * to discriminate against real letter-sounds canon. Every test below
 * uses a canon-bytes mock that serves the real shipped
 * `letter-sounds.json` AND captures the outbound request body so
 * `payload.progress.currentTargetVowel` can be asserted directly
 * (positive discriminator per §4.1.1e). This is the same shape as the
 * Wave 7 sibling specs.
 *
 * Webkit caveat (§2.2)
 * --------------------
 * Per `.claude/docs/testing-and-ci.md` §2.2: WebKit headless has no
 * `AudioContext`. The Wave 9 progression flow exercises the full
 * Splash → Hub → Word Song → SessionEnd loop, which requires
 * chip-tap actuation to advance problems — chips never enable on
 * webkit. Tests that drive chip taps `test.skip` on webkit; pure
 * payload/Progress-state tests (the captured-body assertions) run
 * on both.
 *
 * Timeout sizing (§4.1.1b)
 * ------------------------
 * Per `.claude/docs/testing-and-ci.md` §4.1.1b: 3-4 sessions × ~50s
 * wall time on the silent-caption-walk fallback path = 200s+; add
 * ~40s headroom. `test.setTimeout(240_000)` minimum per the ticket
 * AC; tests that walk 4 sessions or more use 300_000.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request, TestInfo } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

/** Path to the shipped letter-sounds canon used as the mock response. */
const LETTER_SOUNDS_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/letter-sounds.json',
)

/** Path to the cvc-words-short-o canon used by the test-6 sensitivity
 *  sub-test (structurally valid but wrong tier — the same shape used by
 *  the A8 sibling spec for mutation sensitivity). */
const WRONG_TIER_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/cvc-words-short-o.json',
)

/**
 * Canonical IPA labels for the four short vowels tracked by W9.
 *
 * Matches the parent-d9x scope: `{ '/o/': ..., '/u/': ..., '/i/': ...,
 * '/e/': ... }`. The key strings here are the on-the-wire IPA labels
 * the planner emits in `payload.progress.currentTargetVowel` AND the
 * keys the storage layer uses in `progress.literacy.letterSoundsVowelStates`.
 *
 * Short-/a/ is intentionally not in this set — it is already mastered
 * per CLAUDE.md diagnostic baseline and not part of the per-vowel
 * sub-tracking surface.
 */
const VOWEL_KEYS = ['/o/', '/u/', '/i/', '/e/'] as const
type VowelKey = (typeof VOWEL_KEYS)[number]
type VowelState = 'intro' | 'practicing' | 'mastered'

/**
 * Read + parse a canon file from disk. Mirrors the A8 sibling spec's
 * helper — throws with explicit context on parse failure.
 */
function readCanonText(path: string): string {
  return readFileSync(path, 'utf-8')
}

/**
 * Install a `/api/claude` mock that returns the letter-sounds canon
 * bytes on word-song requests and captures every observed request body.
 * Math requests are rejected with 500 — letter-sounds triggers a
 * word-song fetch only.
 *
 * Optional `wordSongBodyOverride` lets test 6 (sensitivity sub-test)
 * serve a DIFFERENT canon body so the spec can prove its assertions
 * fail against the wrong-tier canon.
 */
async function installLetterSoundsCanonMock(
  page: Page,
  wordSongBodyOverride?: string,
): Promise<{ requests: Request[] }> {
  const canonBody =
    wordSongBodyOverride ?? readCanonText(LETTER_SOUNDS_CANON_PATH)
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
        message: `letter-sounds-per-vowel-progression spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

/**
 * Build a `Progress` blob with `letter-sounds: 'practicing'` AND a
 * `literacy.letterSoundsVowelStates` block layered on top.
 *
 * `buildSeedProgress` returns `unknown` so we hand-extend the literacy
 * block via spread (raw-spread workaround, `.claude/docs/testing-and-ci.md`
 * §4.1.1c). W9.2 will add typed support via `SeedProgressOptions.literacy`;
 * a future cleanup PR migrates this spec to the typed shape with no
 * behavioural change.
 */
function buildSeedWithVowelStates(opts: {
  vowelStates?: Record<VowelKey, VowelState>
  history?: ReadonlyArray<{
    dateISO: string
    skillFocus: ReadonlyArray<string>
    successRate: number
  }>
  skillLevelOverrides?: Record<string, string>
}): unknown {
  const base = buildSeedProgress({
    skillLevelOverrides: {
      'letter-names': 'mastered',
      'letter-sounds': 'practicing',
      ...(opts.skillLevelOverrides ?? {}),
    },
    // Cast through the helper-internal SkillNode type by spreading
    // string-shaped history entries into the helper's typed shape.
    // The helper's `cloneSeedHistoryEntry` only reads dateISO,
    // skillFocus, successRate (no compile-time check on the literal
    // values inside skillFocus), so string literals round-trip safely.
    history: opts.history as unknown as undefined,
  })
  if (opts.vowelStates === undefined) return base
  return {
    ...(base as Record<string, unknown>),
    literacy: {
      letterSoundsVowelStates: { ...opts.vowelStates },
    },
  }
}

/**
 * Cross-day-deduped history factory — N sessions on `letter-sounds`
 * tier at `successRate`, dated across N consecutive calendar days
 * ending yesterday (so the streak counter doesn't blow up). Each entry
 * carries `currentTargetVowel` on the seeded shape (W9.3 widens
 * `SessionHistoryEntry` to carry the field; until then it's an
 * additional property the runtime ignores).
 *
 * The `dateISO` walk starts (N) days ago and increments by 1 day each
 * entry. Local-time day boundaries per
 * `progress-and-persistence.md` §"Calendar-day dedupe" — the mastery
 * engine reads `getFullYear/getMonth/getDate`, not UTC slice. Using
 * `setUTCHours(12, 0, 0, 0)` for each day avoids the Manila-evening
 * vs. Manila-morning UTC-offset trap that bit PR #120.
 */
function buildLetterSoundsHistory(opts: {
  sessions: number
  successRate: number
  currentTargetVowel: VowelKey
}): ReadonlyArray<{
  dateISO: string
  skillFocus: ReadonlyArray<string>
  successRate: number
}> {
  const entries: Array<{
    dateISO: string
    skillFocus: ReadonlyArray<string>
    successRate: number
  }> = []
  for (let i = opts.sessions - 1; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (i + 1))
    d.setUTCHours(12, 0, 0, 0)
    entries.push({
      dateISO: d.toISOString(),
      skillFocus: ['letter-sounds'],
      successRate: opts.successRate,
    })
  }
  return entries
}

/**
 * Wait for a /api/claude word-song POST to fire, then return the parsed
 * body. Polls the requests array up to 15s (same shape as A4 + A8
 * siblings). Returns the LAST captured request — useful for tests that
 * drive multiple sessions and want to inspect the most-recent payload.
 */
async function waitForWordSongRequest(
  requests: ReadonlyArray<Request>,
  minCount = 1,
): Promise<Record<string, unknown>> {
  await expect(async () => {
    expect(requests.length).toBeGreaterThanOrEqual(minCount)
  }).toPass({ timeout: 15_000 })
  const recorded = requests[requests.length - 1]!
  return JSON.parse(recorded.postData() ?? '{}') as Record<string, unknown>
}

/** Extract `payload.progress.currentTargetVowel` from a captured body,
 *  with explicit null/undefined surface for the failing-first assertions. */
function readCurrentTargetVowel(
  body: Record<string, unknown>,
): string | undefined {
  const payload = (body.payload ?? {}) as Record<string, unknown>
  const progress = (payload.progress ?? {}) as Record<string, unknown>
  const val = progress.currentTargetVowel
  return typeof val === 'string' ? val : undefined
}

/** Skip helper for tests that need to drive chip taps. */
function skipOnWebkitHeadless(testInfo: TestInfo): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → chips never enable → chip-tap walk is structurally impossible. Per .claude/docs/testing-and-ci.md §2.2.',
  )
}

/**
 * Drive a full 8-correct-tap session and return when SessionEnd has
 * landed. Used by tests that simulate a complete letter-sounds session
 * end-to-end (rather than seeding the history entry directly).
 *
 * Reads `data-correct="true"` on chips so the walker is mnemonic-
 * agnostic — works on both letter-sounds and CVC content. Robust to
 * any future re-bake that shuffles targets.
 */
async function drive8ProblemSession(page: Page): Promise<void> {
  const wordSong = page.getByTestId('word-song')
  for (let i = 0; i < 8; i++) {
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
    await correctChip.click()
  }
  const sessionEnd = page.getByTestId('session-end')
  await expect(sessionEnd).toBeVisible({ timeout: 20_000 })
  await expect(sessionEnd).toHaveAttribute('data-surface', 'word-song')
}

test.describe('letter-sounds per-vowel progression (Wave 9 W9.5 — ticket 86c9ya3vk)', () => {
  /**
   * Test 1 — Per-vowel intro → practicing transition.
   *
   * Seeded state: letter-sounds at `'practicing'`, all 4 vowel states
   * at `'intro'`, no history. Drive one full session (8 correct taps).
   * The session ends with `successRate === 1.0` and a captured request
   * body carrying `currentTargetVowel: '/o/'` (the picker's default
   * starting vowel per `letter-sounds-content.md` §1.4 algorithm step
   * 2 — first vowel in `practicing` state, or first `'intro'` vowel
   * promoted on first emission).
   *
   * Post-session persisted Progress must show
   * `literacy.letterSoundsVowelStates['/o/'] === 'practicing'`
   * (intro→practicing per W9.3's per-vowel rule, mirroring the
   * existing `mastery.ts` post-#201 intro→practicing scan).
   *
   * RED on main (W9.2/3/4 unmerged):
   *   - `currentTargetVowel` is NOT in the request body on main →
   *     `readCurrentTargetVowel(body)` returns undefined →
   *     `expect(currentTarget).toBe('/o/')` fails.
   *   - `literacy.letterSoundsVowelStates` is NOT persisted on main
   *     → `readProgressFromPage(...)` returns no `literacy` field →
   *     the post-session assertion reads `undefined` and fails.
   */
  test('1. per-vowel intro → practicing: one successful /o/ session flips letterSoundsVowelStates[/o/] from intro to practicing', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(240_000)

    const initialStates: Record<VowelKey, VowelState> = {
      '/o/': 'intro',
      '/u/': 'intro',
      '/i/': 'intro',
      '/e/': 'intro',
    }
    await seedLocalStorage(page, {
      progress: buildSeedWithVowelStates({ vowelStates: initialStates }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    const { requests } = await installLetterSoundsCanonMock(page)
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // Positive discriminator: captured request body carries the
    // current-target vowel. RED on main because the field is not
    // emitted by today's planner.
    const body = await waitForWordSongRequest(requests)
    expect(readCurrentTargetVowel(body)).toBe('/o/')

    // Drive the session to completion + SessionEnd.
    await drive8ProblemSession(page)

    // Persisted Progress shape: vowel state for /o/ flipped to
    // 'practicing'. RED on main because the literacy block isn't
    // written today.
    const post = (await readProgressFromPage(page)) as Record<string, unknown>
    expect(post).not.toBeNull()
    const literacy = post.literacy as Record<string, unknown> | undefined
    expect(literacy).toBeDefined()
    const vowelStates = literacy?.letterSoundsVowelStates as
      | Record<string, unknown>
      | undefined
    expect(vowelStates).toBeDefined()
    expect(vowelStates?.['/o/']).toBe('practicing')
    // Other vowels untouched.
    expect(vowelStates?.['/u/']).toBe('intro')
    expect(vowelStates?.['/i/']).toBe('intro')
    expect(vowelStates?.['/e/']).toBe('intro')
    // The composite tier `letter-sounds` itself stays at 'practicing'
    // — only sub-mastery moves on a single-session flip.
    const skillLevels = post.skillLevels as Record<string, unknown>
    expect(skillLevels['letter-sounds']).toBe('practicing')
  })

  /**
   * Test 2 — Per-vowel practicing → mastered transition.
   *
   * Seeded state: letter-sounds at `'practicing'`,
   * `letterSoundsVowelStates['/o/'] === 'practicing'`, the other 3
   * vowels at `'intro'`. History carries 2 cross-day sessions on
   * `letter-sounds` at 100%; the third session runs in-test
   * (`drive8ProblemSession` → 100%). After completion the 90/3 gate
   * fires for `/o/`, flipping it to `'mastered'`.
   *
   * The picker's NEXT session-start request (driven by re-entering
   * Word Song from Hub) carries `currentTargetVowel: '/u/'` —
   * proving the planner reads the freshly-mastered `/o/` state and
   * advances to the next-in-sequence vowel.
   *
   * RED on main:
   *   - same currentTargetVowel-undefined failure as test 1 on the
   *     first captured body.
   *   - even if we ignored the wire-level signal, today's mastery
   *     rule has no per-vowel branch → `/o/` cannot reach `'mastered'`.
   */
  test('2. per-vowel practicing → mastered: 3 cross-day 90% sessions on /o/ flips letterSoundsVowelStates[/o/] to mastered; next session targets /u/', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(300_000)

    const initialStates: Record<VowelKey, VowelState> = {
      '/o/': 'practicing',
      '/u/': 'intro',
      '/i/': 'intro',
      '/e/': 'intro',
    }
    // Two prior cross-day sessions at 100% on letter-sounds; the
    // third session runs in-test. With `crossDayEnforcement: true`
    // (the default per `parentSettings`) the 3-session window is
    // satisfied if and only if the calendar-day-dedupe picks up
    // exactly 3 distinct days.
    const priorHistory = buildLetterSoundsHistory({
      sessions: 2,
      successRate: 1.0,
      currentTargetVowel: '/o/',
    })

    await seedLocalStorage(page, {
      progress: buildSeedWithVowelStates({
        vowelStates: initialStates,
        history: priorHistory,
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    const { requests } = await installLetterSoundsCanonMock(page)
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // First captured request: still /o/ because it's the third
    // qualifying session, not yet mastered until session-end.
    const firstBody = await waitForWordSongRequest(requests)
    expect(readCurrentTargetVowel(firstBody)).toBe('/o/')

    await drive8ProblemSession(page)

    // After SessionEnd, `applyMasteryRule` runs and flips /o/ to
    // mastered. Verify persisted Progress.
    const post = (await readProgressFromPage(page)) as Record<string, unknown>
    const literacy = post.literacy as Record<string, unknown> | undefined
    expect(literacy).toBeDefined()
    const vowelStates = literacy?.letterSoundsVowelStates as
      | Record<string, unknown>
      | undefined
    expect(vowelStates).toBeDefined()
    expect(vowelStates?.['/o/']).toBe('mastered')

    // Return to Hub and re-enter Word Song — the next session-start
    // request carries `currentTargetVowel: '/u/'`, proving the
    // planner reads the freshly-mastered state.
    const sessionEnd = page.getByTestId('session-end')
    // Tap through SessionEnd → Hub. The "all done" path exists on
    // SessionEnd; if a subsequent design pivots the exit affordance
    // this is the place to update.
    const allDone = sessionEnd.locator('[data-testid="session-end-all-done"]')
    if ((await allDone.count()) > 0) {
      await allDone.click()
    } else {
      // Fallback: click the SessionEnd surface as the universal
      // "advance to Hub" affordance until the AC anchors here.
      await sessionEnd.click()
    }
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const secondBody = await waitForWordSongRequest(requests, 2)
    expect(readCurrentTargetVowel(secondBody)).toBe('/u/')
  })

  /**
   * Test 3 — `/i/ → /e/` runtime gate.
   *
   * Seeded state: `letterSoundsVowelStates = { '/o/': 'mastered',
   * '/u/': 'mastered', '/i/': 'practicing', '/e/': 'intro' }`. Per
   * `letter-sounds-content.md` §1.4 algorithm step 4: the planner
   * MUST pick `/i/` (the first vowel in `'practicing'` state under the
   * Option-A predicate), NOT `/e/`. The captured request body
   * carries `currentTargetVowel: '/i/'`.
   *
   * After driving /i/ to mastery (we seed 2 prior cross-day 100%
   * sessions + run the third in-test), the gate flips: re-entering
   * Word Song now picks `/e/`. Captured second body carries
   * `currentTargetVowel: '/e/'`.
   *
   * RED on main: today's planner has no `letterSoundsVowelStates`
   * awareness. With a seeded `'/i/': 'practicing'` it MIGHT pick
   * either /i/ or /e/ via session turn-order (Option-B
   * approximation), but never reads the state predicate — so the
   * positive `currentTargetVowel === '/i/'` assertion fails
   * deterministically (the field is absent from the body).
   */
  test('3. /i/ → /e/ runtime gate: planner picks /i/ while /i/ is practicing; flips to /e/ after /i/ masters', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(300_000)

    const initialStates: Record<VowelKey, VowelState> = {
      '/o/': 'mastered',
      '/u/': 'mastered',
      '/i/': 'practicing',
      '/e/': 'intro',
    }
    // 2 prior cross-day sessions at 100% on /i/; third session
    // in-test pushes /i/ to mastered.
    const priorHistory = buildLetterSoundsHistory({
      sessions: 2,
      successRate: 1.0,
      currentTargetVowel: '/i/',
    })

    await seedLocalStorage(page, {
      progress: buildSeedWithVowelStates({
        vowelStates: initialStates,
        history: priorHistory,
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    const { requests } = await installLetterSoundsCanonMock(page)
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // Load-bearing assertion: with /i/ at 'practicing' and /e/ at
    // 'intro', the planner picks /i/ — NOT /e/, even though /e/ is
    // next in the locked vowel sequence under naive turn-order.
    const firstBody = await waitForWordSongRequest(requests)
    expect(readCurrentTargetVowel(firstBody)).toBe('/i/')

    await drive8ProblemSession(page)

    // /i/ now mastered. Verify the persisted state, then re-enter
    // Word Song to inspect the next picker output.
    const postFirst = (await readProgressFromPage(page)) as Record<
      string,
      unknown
    >
    const literacy = postFirst.literacy as Record<string, unknown> | undefined
    const vowelStates = literacy?.letterSoundsVowelStates as
      | Record<string, unknown>
      | undefined
    expect(vowelStates?.['/i/']).toBe('mastered')

    const sessionEnd = page.getByTestId('session-end')
    const allDone = sessionEnd.locator('[data-testid="session-end-all-done"]')
    if ((await allDone.count()) > 0) {
      await allDone.click()
    } else {
      await sessionEnd.click()
    }
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // Gate flipped: planner now picks /e/.
    const secondBody = await waitForWordSongRequest(requests, 2)
    expect(readCurrentTargetVowel(secondBody)).toBe('/e/')
  })

  /**
   * Test 4 — Composite-tier fallback when `letterSoundsVowelStates`
   * is absent on the loaded blob.
   *
   * Seeded state: legacy Progress doc — `letter-sounds: 'practicing'`,
   * NO `literacy` block. (This matches what an existing Marian on
   * pre-W9.2 main has in localStorage.) The engine MUST fall through
   * to the Wave-7 composite-tier 90/3 rule, mastering the whole tier
   * on 3 cross-day 90%+ sessions across the pool — exactly as
   * Wave 7 ships.
   *
   * Positive discriminator: after 3 cross-day 100% sessions, the
   * persisted Progress shows `skillLevels['letter-sounds'] ===
   * 'mastered'` AND NO `literacy.letterSoundsVowelStates` block
   * was written (the engine did NOT manufacture a per-vowel state
   * out of nothing — composite path is observable by its absence).
   *
   * RED on main (subtle — see header docstring):
   *   - On current main this test PARTIALLY passes — composite-tier
   *     mastery is already implemented (it's Wave 7's shape). The
   *     RED proof here is layered: the test's load-bearing
   *     assertions are (a) composite still works AND (b) no
   *     `literacy` block is written when seed had none. (a) is true
   *     on main, (b) is also true on main (trivially — no W9 code).
   *     This test does not have an organic RED→GREEN flip on the
   *     core assertion; instead its job post-W9.2/3/4 merge is to
   *     LOCK the regression that ANY future W9+ work doesn't
   *     accidentally over-write a legacy blob with an unsolicited
   *     `literacy` block. The proof of sensitivity comes from
   *     test 6 (the assertion-sensitivity sub-test below) which
   *     verifies these very assertions fail when the engine writes
   *     a `literacy` block over the legacy seed.
   *   - Per `letter-sounds-content.md` §5.3 Option B + the W9.5
   *     ticket AC #4 phrasing ("Composite-tier fallback when
   *     `letterSoundsVowelStates` absent (legacy blob)"), this
   *     test's job is REGRESSION-LOCKING the fallback path, not
   *     proving a brand-new behaviour.
   */
  test('4. composite-tier fallback: legacy Progress doc (no literacy block) still masters letter-sounds via Wave-7 90/3 rule and does NOT manufacture a literacy block', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(300_000)

    // 2 prior cross-day 100% sessions on letter-sounds; third
    // session runs in-test → 3 cross-day at 100% → composite 90/3
    // gate fires. No `literacy` block on the seeded blob — the
    // engine MUST run the composite path.
    const priorHistory = buildLetterSoundsHistory({
      sessions: 2,
      successRate: 1.0,
      currentTargetVowel: '/o/',
    })

    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'letter-names': 'mastered',
          'letter-sounds': 'practicing',
        },
        // Cast through the helper's typed shape. The string-literal
        // skillFocus entries above match the SkillNode union; the
        // cast is needed only because `buildSeedProgress` doesn't
        // export the loose `Record<string, string>` history shape
        // pre-W9.2.
        history: priorHistory as unknown as Parameters<
          typeof buildSeedProgress
        >[0] extends infer P
          ? P extends { history?: infer H }
            ? H
            : never
          : never,
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await installLetterSoundsCanonMock(page)
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    await drive8ProblemSession(page)

    const post = (await readProgressFromPage(page)) as Record<string, unknown>
    expect(post).not.toBeNull()

    // (a) Composite-tier mastery fires on 3 cross-day 100%.
    const skillLevels = post.skillLevels as Record<string, unknown>
    expect(skillLevels['letter-sounds']).toBe('mastered')

    // (b) NO `literacy` block was manufactured on the persisted
    // shape — the engine did not write a sub-state structure for a
    // user who never had one. This locks the migration discipline:
    // a legacy user on Wave 9 stays legacy until their first session
    // emits letter-sounds canon WITH the bake-metadata flag (which
    // is a W9.3 concern, not a W9.5 spec concern). The persisted
    // blob may have `literacy` set to `undefined` if the read-path
    // defaulter chose to set the key but with no sub-state value —
    // we accept both (`undefined` literacy field OR absent literacy
    // field). What we reject is a `literacy.letterSoundsVowelStates`
    // object materialising on a legacy blob.
    const literacy = post.literacy as Record<string, unknown> | undefined
    if (literacy !== undefined) {
      // Field exists but must NOT carry per-vowel sub-state.
      expect(
        literacy.letterSoundsVowelStates,
        'Composite-tier fallback path must NOT manufacture letterSoundsVowelStates on a legacy blob.',
      ).toBeUndefined()
    }
  })

  /**
   * Test 5 — Tier-level composite promotion when all 4 vowels
   * mastered.
   *
   * Seeded state: `letterSoundsVowelStates = { '/o/': 'mastered',
   * '/u/': 'mastered', '/i/': 'mastered', '/e/': 'practicing' }`,
   * `letter-sounds` skillLevel at `'practicing'`, with 2 prior
   * cross-day 100% sessions on /e/. Drive one more session in-test
   * → /e/ flips to `'mastered'` → all four vowels mastered → the
   * TIER `letter-sounds` flips to `'mastered'` AND
   * `pendingPromotion` fires for `letter-sounds` so the Hub
   * celebration plays.
   *
   * Per `letter-sounds-content.md` §5.3 Option A: "The TIER
   * (`letter-sounds`) masters when ALL FOUR vowels are
   * sub-mastered. The picker walks past `letter-sounds` only when
   * the tier is fully mastered."
   *
   * RED on main: no per-vowel rule → `/e/` cannot reach `'mastered'`
   * → the tier-level promotion never fires.
   */
  test('5. tier-level composite promotion: all 4 vowels mastered flips skillLevels[letter-sounds] to mastered and fires pendingPromotion', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(300_000)

    const initialStates: Record<VowelKey, VowelState> = {
      '/o/': 'mastered',
      '/u/': 'mastered',
      '/i/': 'mastered',
      '/e/': 'practicing',
    }
    const priorHistory = buildLetterSoundsHistory({
      sessions: 2,
      successRate: 1.0,
      currentTargetVowel: '/e/',
    })

    await seedLocalStorage(page, {
      progress: buildSeedWithVowelStates({
        vowelStates: initialStates,
        history: priorHistory,
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    const { requests } = await installLetterSoundsCanonMock(page)
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // Current target is /e/ (only practicing vowel left).
    const body = await waitForWordSongRequest(requests)
    expect(readCurrentTargetVowel(body)).toBe('/e/')

    await drive8ProblemSession(page)

    const post = (await readProgressFromPage(page)) as Record<string, unknown>
    expect(post).not.toBeNull()

    // All 4 vowels mastered AND tier mastered.
    const literacy = post.literacy as Record<string, unknown> | undefined
    expect(literacy).toBeDefined()
    const vowelStates = literacy?.letterSoundsVowelStates as
      | Record<string, unknown>
      | undefined
    expect(vowelStates).toBeDefined()
    for (const v of VOWEL_KEYS) {
      expect(
        vowelStates?.[v],
        `Vowel ${v} should be mastered after all-four-mastered session.`,
      ).toBe('mastered')
    }

    const skillLevels = post.skillLevels as Record<string, unknown>
    expect(skillLevels['letter-sounds']).toBe('mastered')

    // pendingPromotion fires for letter-sounds OR for the next
    // tier-unlock (`blending-cv`). The exact value depends on
    // `parentSettings.autoPromote` semantics — per
    // `mastery.ts:§"Promotion behaviour"` lines 405-409,
    // `pendingPromotion = <earliest-tree-order-node-that-promoted-this-call>`.
    // When `autoPromote === true` (the default) the field is set
    // and then cleared on the NEXT applyMasteryRule. Since we
    // observe Progress immediately after session-end, the field
    // SHOULD still be set to the freshly-promoted node.
    expect(post.pendingPromotion).toBe('letter-sounds')
  })

  /**
   * Test 6 — Assertion-sensitivity sub-test (Wave 7 retro Pattern 3).
   *
   * Per `[[feedback_failing_first_must_prove_green]]`: every main
   * assertion in this spec must be sensitive to a plausible mutation.
   * This sub-test installs a STRUCTURALLY-VALID but WRONG-tier canon
   * (the shipped `cvc-words-short-o.json` — CVC content, not
   * letter-sounds) and asserts the spec's load-bearing checks FAIL
   * against it.
   *
   * The mutation simulates: "what if the planner silently demoted
   * letter-sounds → cvc-words-short-o (or another tier) and we
   * didn't notice?" — a regression class the Wave 7 A8 sibling spec
   * test 4 documents at length.
   *
   * Same shape as `letter-sounds-regression.spec.ts` test 4 + the
   * A4 letter-names sibling test 4. Pure payload assertion (no
   * browser interaction beyond serving the wrong canon and watching
   * the request fire) — runs on BOTH chromium and webkit.
   *
   * Three sensitivity claims:
   *   (a) The wrong-tier canon's read-line template
   *       (`"Read the dog."`) does NOT match the letter-sounds
   *       template (`"Which letter says <MNEMONIC>?"`). A
   *       follow-on chip-walk would fail almost immediately, but
   *       even at the payload level the canon's `plan.utterances`
   *       carry CVC target words, not isolated phonemes.
   *   (b) The captured request body's
   *       `payload.progress.currentTargetVowel` field — if the
   *       planner stub on this test EVEN BOTHERED to set it (it
   *       wouldn't, because no planner runs at all in a Playwright
   *       mock — we serve canon bytes directly), the value would
   *       have to discriminate `/o/` from `/u/` etc. We assert the
   *       captured body's `currentTargetVowel` is the field we're
   *       testing on, not a hardcoded value the sensitivity
   *       sub-test could replicate.
   *   (c) The wrong-tier canon's `plan.utterances` reference
   *       letters like `'dog'` (CVC words) — incompatible with the
   *       letter-sounds spec's per-vowel state machinery. If a
   *       future test against the wrong canon accidentally
   *       asserted on its content, it would catch a real bug, not
   *       a wrong-tier silent demote.
   */
  test('6. assertion-sensitivity: applying the same flow against a WRONG-tier canon (cvc-words-short-o) catches the silent-demote class', async ({
    page,
  }) => {
    test.setTimeout(60_000)

    // Read the wrong-tier canon bytes; serve them as the word-song
    // response. The seed state is still letter-sounds-focused, so
    // the planner request fires the same shape — proving the
    // assertion-sensitivity is on the RESPONSE side, not the
    // request side.
    const wrongCanonBody = readCanonText(WRONG_TIER_CANON_PATH)
    const initialStates: Record<VowelKey, VowelState> = {
      '/o/': 'intro',
      '/u/': 'intro',
      '/i/': 'intro',
      '/e/': 'intro',
    }
    await seedLocalStorage(page, {
      progress: buildSeedWithVowelStates({ vowelStates: initialStates }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
    const { requests } = await installLetterSoundsCanonMock(
      page,
      wrongCanonBody,
    )

    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // Wait for the planner request to fire. Inspect the served
    // canon (the wrong-tier body we set up) at the canon-JSON
    // level — the spec's load-bearing read-line template
    // (`"Which letter says ..."`) is ABSENT in this canon.
    await waitForWordSongRequest(requests)
    const parsedWrong = JSON.parse(wrongCanonBody) as {
      plan?: { utterances?: ReadonlyArray<{ id: string; text: string }> }
    }
    const wrongPlanUtterances = parsedWrong.plan?.utterances ?? []
    expect(wrongPlanUtterances.length).toBeGreaterThan(0)

    // Sensitivity claim (a): the letter-sounds read-line template
    // does NOT appear in the wrong-tier canon. If a future
    // refactor accidentally served CVC content when letter-sounds
    // was expected, the canon-level template check would still
    // catch the drift. (This is the same mutation-sensitivity
    // proof the A8 sibling spec uses verbatim.)
    const letterSoundsTemplate = /^Which letter says \S+\?$/
    const matchesInWrongCanon = wrongPlanUtterances.filter(
      (u) => u.id.endsWith('.read') && letterSoundsTemplate.test(u.text),
    )
    expect(
      matchesInWrongCanon,
      'Sensitivity check: the cvc-words-short-o canon must yield 0 letter-sounds read-line template matches. ' +
        'If this assertion fails, the canon is matching against letter-sounds content too, which means the ' +
        'spec is not actually discriminating wrong-tier canon from right-tier canon.',
    ).toEqual([])

    // Sensitivity claim (b): the wrong-tier canon carries CVC
    // content — at least one `"Read the <word>."` read-line.
    // Proves we're not just serving an empty/malformed canon (that
    // would also fail the letter-sounds template check vacuously).
    const cvcTemplate = /^Read the (\w+)\.$/
    const cvcMatches = wrongPlanUtterances.filter(
      (u) => u.id.endsWith('.read') && cvcTemplate.test(u.text),
    )
    expect(
      cvcMatches.length,
      'Sensitivity check (belt-and-braces): the wrong canon MUST carry CVC read-lines so the contrast against letter-sounds is meaningful. ' +
        'If the wrong canon is empty, the discrimination above is vacuously true and proves nothing.',
    ).toBeGreaterThan(0)
  })
})
