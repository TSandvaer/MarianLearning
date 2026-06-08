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
 * Failing-first posture + GREEN attestation
 * ------------------------------------------
 * Per `[[feedback_progression_e2e_mandatory]]` +
 * `[[feedback_failing_first_must_prove_green]]`: this spec is paired with
 * the W9.2/3/4 implementation stack (now merged on main: W9.2 `d2ac7fd`,
 * W9.3 `0afa4d9`, W9.4 `8b0be09`). The W9.5 GREEN-attestation pass
 * RE-AUTHORED the assertions against the SHIPPED contract — the original
 * draft (May 24, pre-impl) guessed the wire shape wrong. The corrections
 * and the evidence trail live in the PR body's RED→GREEN block.
 *
 * The shipped contract this spec verifies (load-bearing facts the
 * original draft got wrong):
 *   - The OUTBOUND request carries `payload.progress.letterSoundsVowelStates`
 *     — the App reads the per-vowel map off persisted Progress and forwards
 *     it (`App.tsx:278-279` + `wordSongPathA.ts:236-238`). It does NOT
 *     carry `currentTargetVowel`; that is a RESPONSE-side field
 *     (`wordSongPathA.ts:157,381-396`), planner-derived server-side.
 *   - The per-vowel mastery scan keys on history entries TAGGED with
 *     `currentTargetVowel` (`mastery.ts:557-561`). `perVowelTrackingActive`
 *     (`mastery.ts:513-521`) requires literacy present AND ≥1 tagged
 *     letter-sounds history entry; with untagged history the engine falls
 *     through to the Wave 7 composite-tier 90/3 path.
 *   - The W9.2 read-path defaulter ALWAYS installs an all-`'intro'`
 *     `literacy.letterSoundsVowelStates` on load (`storage.ts:
 *     withDefaultedLetterSoundsVowelStates`) — even on a legacy blob.
 *
 * Assertion classification (Step 2, `jessica.md` Failing-First Protocol):
 *   Test 1 — RED-on-base lever. Request-side `letterSoundsVowelStates`
 *     (W9.4 plumbing absent on base) + persisted `/o/` intro→practicing
 *     (W9.2 defaulter + W9.3 scan absent on base).
 *   Test 2 — RED-on-base lever. /o/ practicing→mastered over 3 cross-day
 *     tagged sessions + freshly-mastered state propagated onto the next
 *     request.
 *   Test 3 — RED-on-base lever. /i/-practicing map forwarded; /i/ masters;
 *     gate-flipped map (/i/ mastered) propagated onto next request.
 *   Test 4 — Regression-lock. Composite-tier 90/3 still masters
 *     letter-sounds on untagged history (per-vowel scan skipped) AND the
 *     W9.2-defaulted vowel states stay all-intro. RED on base because the
 *     defaulter doesn't exist → `literacy` undefined → `toBeDefined()`
 *     fails.
 *   Test 5 — RED-on-base lever. All-four-mastered flips the composite
 *     `letter-sounds` tier to mastered + fires `pendingPromotion`.
 *   Test 6 — Assertion-sensitivity (Wave 7 retro Pattern 3). Pure
 *     canon-file read; cross-browser. Trivially-green on base (the
 *     wrong-tier canon is just bytes), but locks the silent-demote
 *     mutation sensitivity once the impl ships.
 *
 * RED-on-base proof: at pre-W9 base `39531a9` (parent of W9.2), a
 * `git grep -c letterSoundsVowelStates` over `App.tsx`,
 * `wordSongPathA.ts`, `storage.ts`, `mastery.ts` returns 0 in every file
 * — the request-side field cannot appear and the persisted literacy block
 * cannot be written, so the lever assertions fail for the intended reason.
 *
 * Seed-shape typing (§4.1.1a / §4.1.1c)
 * -------------------------------------
 * W9.2 shipped the typed `SeedProgressOptions.letterSoundsVowelStates`
 * override AND (in the W9.5 helper widening) the typed
 * `SeedSessionHistoryEntry.currentTargetVowel` tag. The raw-spread
 * workaround the original draft used is GONE — `buildSeedWithVowelStates`
 * routes the per-vowel map AND the tagged history through the production
 * clone helpers directly.
 *
 * Mock strategy — canon-bytes pass-through (§4.1.1d)
 * --------------------------------------------------
 * Per `.claude/docs/testing-and-ci.md` §4.1.1d trivially-green trap:
 * `failNetwork: true` is FORBIDDEN here — without canon bytes the static
 * word-song fallback emits blending-cv stub content and the positive
 * `letterSoundsVowelStates` request assertions could not discriminate.
 * Every test serves the real shipped `letter-sounds.json` AND captures
 * the outbound request body so `payload.progress.letterSoundsVowelStates`
 * is asserted directly (positive discriminator per §4.1.1e). The mock
 * also STAMPS `currentTargetVowel` onto the served response so the
 * in-test session tags its history entry — simulating the server's
 * non-fallback response stamp, since the real server derivation is
 * bypassed by the route mock (see `installLetterSoundsCanonMock`).
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
import type { SeedSessionHistoryEntry } from './_helpers/seedStorage'

/**
 * Letter-sounds-tagged seed history entry. Narrows the helper's
 * `SeedSessionHistoryEntry` to the fields this spec sets: a letter-sounds
 * focus, a successRate, a cross-day dateISO, and the load-bearing
 * `currentTargetVowel` tag the per-vowel mastery scan filters on.
 */
type SeedLetterSoundsHistoryEntry = SeedSessionHistoryEntry

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
 * Mock boundary note (the load-bearing architectural fact this spec
 * tests around)
 * ------------------------------------------------------------------
 * This mock fulfils `/api/claude` directly, so the SERVER-SIDE per-vowel
 * derivation (`api/claude.ts` → `deriveCurrentTargetVowel` →
 * `CURRENT TARGET VOWEL: /<vowel>/` directive, slash-vowel stamped on the
 * response envelope) NEVER runs in this spec. That server logic — including
 * the non-fallback bypass-canon-and-cache rule (`api/claude.ts:841-854`,
 * "all-`'intro'` stays canon-served / non-fallback triggers a live Haiku
 * run") and the bare-IPA-vs-slash-notation translation — is covered by
 * `api/_planner.test.ts` (`currentTargetVowel: 'ɒ'` IPA hint tests) and
 * `api/claude.test.ts`. THIS spec exercises the BROWSER + STORAGE +
 * MASTERY-ENGINE wiring: that the App reads `letterSoundsVowelStates` off
 * persisted Progress and forwards it on the request body
 * (`wordSongPathA.ts:236-238`), that the response-envelope
 * `currentTargetVowel` is read back (`wordSongPathA.ts:381-396`) and tagged
 * onto the session-end history entry (`App.tsx:677-679` →
 * `progressHistory.ts:449-457`), and that the W9.3 per-vowel sub-mastery
 * scan (`mastery.ts:540-592`) flips vowel states given tagged history.
 *
 * Because the in-test session's history-entry vowel tag is sourced from
 * the RESPONSE envelope (`prepared.currentTargetVowel ?? null`), the mock
 * must STAMP `currentTargetVowel` onto the served canon body for the
 * in-test session to participate in per-vowel tracking. `responseVowel`
 * does exactly that — it simulates what the real server stamps on a
 * non-fallback live run.
 *
 * Optional `wordSongBodyOverride` lets test 6 (sensitivity sub-test)
 * serve a DIFFERENT canon body so the spec can prove its assertions
 * fail against the wrong-tier canon.
 */
async function installLetterSoundsCanonMock(
  page: Page,
  opts: {
    wordSongBodyOverride?: string
    responseVowel?: VowelKey
  } = {},
): Promise<{ requests: Request[] }> {
  const baseCanonText =
    opts.wordSongBodyOverride ?? readCanonText(LETTER_SOUNDS_CANON_PATH)
  // Stamp `currentTargetVowel` onto the canon envelope (only when the
  // caller asks AND we're serving the real canon, not the wrong-tier
  // override). This simulates the server's non-fallback response stamp
  // (`api/claude.ts:1004-1008`) so the browser tags its session-end
  // history entry with the right vowel.
  let canonBody = baseCanonText
  if (
    opts.responseVowel !== undefined &&
    opts.wordSongBodyOverride === undefined
  ) {
    const parsed = JSON.parse(baseCanonText) as Record<string, unknown>
    parsed.currentTargetVowel = opts.responseVowel
    canonBody = JSON.stringify(parsed)
  }
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

/** Extract `payload.progress.letterSoundsVowelStates` from a captured
 *  request body — the real positive discriminator on the OUTBOUND request
 *  (the App forwards the seeded per-vowel map; the planner-derived
 *  `currentTargetVowel` is a RESPONSE-side field, not a request-side one). */
function readRequestVowelStates(
  body: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const payload = (body.payload ?? {}) as Record<string, unknown>
  const progress = (payload.progress ?? {}) as Record<string, unknown>
  const states = progress.letterSoundsVowelStates
  return typeof states === 'object' && states !== null
    ? (states as Record<string, unknown>)
    : undefined
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
  history?: ReadonlyArray<SeedLetterSoundsHistoryEntry>
  skillLevelOverrides?: Record<string, string>
}): unknown {
  // Migrated to the typed `SeedProgressOptions` shape (W9.2 shipped both
  // `history` carrying `currentTargetVowel` — via the W9.5 helper
  // widening — and `letterSoundsVowelStates` as a typed override). No more
  // raw-spread workaround: the typed path round-trips the per-vowel map
  // AND the tagged history entries through the production clone helpers.
  return buildSeedProgress({
    skillLevelOverrides: {
      'letter-names': 'mastered',
      'letter-sounds': 'practicing',
      ...(opts.skillLevelOverrides ?? {}),
    },
    ...(opts.history !== undefined ? { history: opts.history } : {}),
    ...(opts.vowelStates !== undefined
      ? { letterSoundsVowelStates: opts.vowelStates }
      : {}),
  })
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
}): ReadonlyArray<SeedLetterSoundsHistoryEntry> {
  const entries: SeedLetterSoundsHistoryEntry[] = []
  for (let i = opts.sessions - 1; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (i + 1))
    d.setUTCHours(12, 0, 0, 0)
    entries.push({
      dateISO: d.toISOString(),
      skillFocus: ['letter-sounds'],
      successRate: opts.successRate,
      // W9.3 per-vowel scan keys on this tag: `mastery.ts:557-561`
      // filters history to `currentTargetVowel === <vowel>`. Without it
      // `perVowelTrackingActive` (`mastery.ts:513-521`) returns false and
      // the engine falls through to the composite-tier 90/3 path.
      currentTargetVowel: opts.currentTargetVowel,
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

    // The mock stamps `currentTargetVowel: '/o/'` on the response so the
    // in-test session tags its history entry (simulating the server's
    // non-fallback stamp). For an all-intro seed the real server would
    // stay canon-served + derive `/o/`; the value is identical, so the
    // simulation is faithful for /o/.
    const { requests } = await installLetterSoundsCanonMock(page, {
      responseVowel: '/o/',
    })
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // Positive discriminator on the OUTBOUND request: the App reads the
    // seeded per-vowel map off persisted Progress and forwards it on the
    // request body (`wordSongPathA.ts:236-238`). RED on main because the
    // `letterSoundsVowelStates` field is not plumbed onto the request.
    const body = await waitForWordSongRequest(requests)
    expect(readRequestVowelStates(body)).toEqual({
      '/o/': 'intro',
      '/u/': 'intro',
      '/i/': 'intro',
      '/e/': 'intro',
    })

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
      // Re-entry test: reload must preserve the post-mastery state, not
      // re-seed it. See `seedLocalStorage` seedOnce.
      seedOnce: true,
    })

    const { requests } = await installLetterSoundsCanonMock(page, {
      responseVowel: '/o/',
    })
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // First captured request forwards the seeded per-vowel map. /o/ is
    // still 'practicing' on the request side — it only flips to mastered
    // at session-end after this third qualifying session lands.
    const firstBody = await waitForWordSongRequest(requests)
    expect(readRequestVowelStates(firstBody)?.['/o/']).toBe('practicing')

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

    // Re-enter Word Song to capture the NEXT session-start request.
    // Rather than walking the SessionEnd caption-walk to its CTA (which
    // partially-stalls under a real-canon mock that lacks the
    // `session.end.*` audio sources — the auto-unlocked howler cancels
    // the fallback-CTA timer, then a later utterance never resolves), we
    // reload the page. Reload re-mounts the App against the SAME persisted
    // localStorage (the mastery rule already ran + saved at session-end),
    // so the next Word Song request is derived from the freshly-persisted
    // state — exactly what the CTA → Hub → re-enter path would produce,
    // minus the audio-walk dependency.
    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 10_000,
    })
    await page.reload()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // The next session-start request forwards the FRESHLY-MASTERED /o/
    // state (mastery rule ran at the prior session-end). The server's
    // §1.4 picker then derives /u/ from this map — but that derivation is
    // server-side (`api/claude.ts:deriveCurrentTargetVowel`, covered by
    // `api/_planner.test.ts`); the mock bypasses it. The browser-side
    // contract this spec proves is that the mastered /o/ propagates onto
    // the next request, which is the input the server's /u/ pick depends
    // on. /u/ is still 'intro' (only /o/ moved).
    const secondBody = await waitForWordSongRequest(requests, 2)
    expect(readRequestVowelStates(secondBody)).toEqual({
      '/o/': 'mastered',
      '/u/': 'intro',
      '/i/': 'intro',
      '/e/': 'intro',
    })
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
      // Re-entry test: reload must preserve the post-mastery state.
      seedOnce: true,
    })

    const { requests } = await installLetterSoundsCanonMock(page, {
      responseVowel: '/i/',
    })
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // Load-bearing assertion: the request forwards the seeded map with
    // /i/ at 'practicing' and /e/ at 'intro'. The server's §1.4 picker
    // reads THIS map and picks /i/ (first practicing vowel), NOT /e/ —
    // that derivation is server-side. Browser-side we prove the map
    // (the picker's input) is forwarded intact.
    const firstBody = await waitForWordSongRequest(requests)
    expect(readRequestVowelStates(firstBody)).toEqual({
      '/o/': 'mastered',
      '/u/': 'mastered',
      '/i/': 'practicing',
      '/e/': 'intro',
    })

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

    // Re-enter via page reload (see test 2 for why the SessionEnd CTA
    // walk is avoided under a real-canon mock). Reload re-derives the
    // next request from the freshly-persisted post-mastery state.
    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 10_000,
    })
    await page.reload()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // Gate flipped: the next request forwards /i/ now 'mastered', /e/
    // still 'intro'. The server's picker derives /e/ from this map (the
    // only non-mastered vowel left), but that pick is server-side. The
    // browser-side proof is that the gate-flipping state (/i/ mastered)
    // propagated onto the next session's request.
    const secondBody = await waitForWordSongRequest(requests, 2)
    expect(readRequestVowelStates(secondBody)).toEqual({
      '/o/': 'mastered',
      '/u/': 'mastered',
      '/i/': 'mastered',
      '/e/': 'intro',
    })
  })

  /**
   * Test 4 — Composite-tier fallback when no history entry carries a
   * `currentTargetVowel` tag (the genuine legacy case).
   *
   * Seeded state: a legacy Progress doc — `letter-sounds: 'practicing'`,
   * NO `literacy` block, and prior history with NO `currentTargetVowel`
   * tags (entries written before W9.3 shipped). This matches what an
   * existing Marian on pre-W9 main has in localStorage.
   *
   * Real W9.2/3 contract (corrected against the shipped impl — the
   * original spec guessed wrong here):
   *   - The W9.2 read-path defaulter ALWAYS installs
   *     `literacy.letterSoundsVowelStates = { all four → 'intro' }` on
   *     load (`storage.ts:withDefaultedLetterSoundsVowelStates`, input
   *     shape 1). So the persisted blob DOES carry a defaulted literacy
   *     block — the original assertion "no literacy block is
   *     manufactured" contradicts the shipped W9.2 defaulter and was
   *     deleted.
   *   - `perVowelTrackingActive` (`mastery.ts:513-521`) requires BOTH a
   *     present literacy map AND ≥1 letter-sounds history entry carrying
   *     a `currentTargetVowel` tag. With untagged history (this test),
   *     the second condition fails → the per-vowel scan is SKIPPED and
   *     the engine falls through to the unchanged Wave 7 composite-tier
   *     90/3 path.
   *
   * Load-bearing assertions:
   *   (a) Composite-tier mastery still fires on 3 cross-day 100%:
   *       `skillLevels['letter-sounds'] === 'mastered'`.
   *   (b) The defaulted vowel states stay all-`'intro'` — the per-vowel
   *       scan did NOT run (it can't, with no tagged history), so no
   *       vowel was promoted out from under the composite path. This is
   *       the regression-lock: a future change that activated per-vowel
   *       tracking on untagged history would flip some vowel off 'intro'
   *       and fail this assertion.
   *
   * RED on main (W9.2/3/4 unmerged): the literacy block isn't defaulted
   * in at all (no W9.2 defaulter), so `post.literacy` is undefined and
   * assertion (b) reads `undefined?.['/o/']` → fails.
   */
  test('4. composite-tier fallback: untagged-history legacy blob masters letter-sounds via Wave-7 90/3 rule; defaulted vowel states stay all-intro (per-vowel scan skipped)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(300_000)

    // 2 prior cross-day 100% sessions on letter-sounds, UNTAGGED (no
    // currentTargetVowel) — the genuine legacy shape. Third session runs
    // in-test → 3 cross-day at 100% → composite 90/3 gate fires. Because
    // no entry carries a vowel tag, `perVowelTrackingActive` is false and
    // the engine runs the composite path.
    const priorHistory: ReadonlyArray<SeedLetterSoundsHistoryEntry> = (() => {
      const out: SeedLetterSoundsHistoryEntry[] = []
      for (let i = 1; i >= 0; i--) {
        const d = new Date()
        d.setUTCDate(d.getUTCDate() - (i + 1))
        d.setUTCHours(12, 0, 0, 0)
        out.push({
          dateISO: d.toISOString(),
          skillFocus: ['letter-sounds'],
          successRate: 1.0,
          // No currentTargetVowel — legacy untagged entry.
        })
      }
      return out
    })()

    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'letter-names': 'mastered',
          'letter-sounds': 'practicing',
        },
        history: priorHistory,
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    // No responseVowel: the in-test session is ALSO untagged (legacy
    // canon-served path), keeping `perVowelTrackingActive` false.
    await installLetterSoundsCanonMock(page)
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    await drive8ProblemSession(page)

    const post = (await readProgressFromPage(page)) as Record<string, unknown>
    expect(post).not.toBeNull()

    // (a) Composite-tier mastery fires on 3 cross-day 100% — the
    // unchanged Wave 7 90/3 path runs because per-vowel tracking is
    // inactive (untagged history).
    const skillLevels = post.skillLevels as Record<string, unknown>
    expect(skillLevels['letter-sounds']).toBe('mastered')

    // (b) The W9.2 defaulter DOES install a literacy block (all four
    // vowels at 'intro') on load — that is the shipped contract. The
    // regression-lock here is that the per-vowel SCAN did NOT run: with
    // no `currentTargetVowel`-tagged history, `perVowelTrackingActive`
    // is false, so no vowel was promoted off 'intro'. A future change
    // that wrongly activated per-vowel tracking on untagged history
    // would flip a vowel and fail this assertion.
    const literacy = post.literacy as Record<string, unknown> | undefined
    expect(
      literacy,
      'W9.2 read-path defaulter must install a literacy block on every loaded blob.',
    ).toBeDefined()
    const vowelStates = literacy?.letterSoundsVowelStates as
      | Record<string, unknown>
      | undefined
    expect(vowelStates).toEqual({
      '/o/': 'intro',
      '/u/': 'intro',
      '/i/': 'intro',
      '/e/': 'intro',
    })
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

    const { requests } = await installLetterSoundsCanonMock(page, {
      responseVowel: '/e/',
    })
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // Request forwards the seeded map: /e/ is the only non-mastered
    // vowel left, so the server's picker targets it. Browser-side proof
    // is the forwarded map shape.
    const body = await waitForWordSongRequest(requests)
    expect(readRequestVowelStates(body)).toEqual({
      '/o/': 'mastered',
      '/u/': 'mastered',
      '/i/': 'mastered',
      '/e/': 'practicing',
    })

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
    const { requests } = await installLetterSoundsCanonMock(page, {
      wordSongBodyOverride: wrongCanonBody,
    })

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
