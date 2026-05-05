/**
 * E2E regression spec — cvc-words flow (PRs #135, #142, #140, #144).
 *
 * What PR #135 shipped (commit `26bc8d3`):
 *   1. Picker un-clamp: `pickFocusNode(progress, 'word-song')` walks the
 *      literacy tree honoring `skillLevels` (was hard-clamped to
 *      `blending-cv`).
 *   2. Planner widen: `effectiveFocusNode` routes `cvc-words` →
 *      `"Read the <word>."` content (vs. `blending-cv`'s
 *      `"Tap the <word>."`).
 *   3. Canon committed at `public/canon/word-song/level-1/cvc-words.json`
 *      (~926 KB; 8 targets: bag, bat, cat, fan, hat, jam, pan, van).
 *   4. Debug seeder `?debug=1&seed=cvc-words` pre-populates progress so
 *      Hub renders directly with cvc-words as the next session focus.
 *
 * What PR #142 shipped (commit `9266143`):
 *   5. Silent-text window — cvc-word problems delay the read-aloud by
 *      `SILENT_TEXT_WINDOW_MS = 1500ms` after mount. The word card text
 *      renders immediately so Marian has a decoding beat before Emma
 *      reads the line. blending-cv path is unchanged (immediate fire).
 *
 * What PR #140 shipped (commit `629e7ce`):
 *   6. Hub progress wire — App.tsx threads `loadProgress()` through to
 *      Hub on every hub-route entry. `projectHubTreeProgress()` derives
 *      `wordSongIndex` from the count of consecutive mastered nodes from
 *      the start of the track. Path-strip cells render as
 *      `mastered | current | locked`. PromotionCelebration overlay mounts
 *      when `pendingPromotion` is set; idle Emma is suppressed under
 *      mutual-exclusion gate while celebration visible.
 *
 * What PR #144 shipped (commit `ad8c1cb`):
 *   7. Hub `cancelActive()` — chip tap calls `cancelLineFn()` before the
 *      route flip so the in-flight Hub welcome-back utterance stops cleanly
 *      and doesn't leak into Math/WordSong's read-aloud. Idempotent;
 *      no-op when nothing is playing.
 *
 * What this spec locks in
 * -----------------------
 * Eleven test cases. Tests 1-8 protect PR #135 surfaces (planner /
 * parser / canon / picker / debug seeder / session-end persistence).
 * Tests 9-11 protect the post-#135 shipments: silent-text window
 * (#142), Hub progress wire + celebration mutual-exclusion (#140), and
 * Hub utterance cancel-on-tap (#144). Together they are the regression
 * guard for any future change that would silently downgrade Marian's
 * cvc-words session back to the blending-cv content type or break the
 * Hub-side polish that landed in the same 24h window.
 *
 * Mock strategy
 * -------------
 * The spec routes `/api/claude` to fulfill with the EXACT bytes of
 * `public/canon/word-song/level-1/cvc-words.json` — the same canon the
 * production server returns when Marian's iPad makes the same request.
 * Two reasons we use the real canon (not a hand-rolled fixture):
 *
 *   1. **Real Azure-rendered MP3s.** A hand-rolled silent-base64 MP3
 *      decodes flakily in headless Chromium / WebKit; Howler's
 *      `loaderror` fires before `play`, `prepareWordSongPathA` rejects,
 *      and the App falls back to the static plan ("Tap the X.") —
 *      MASKING the very regression this spec exists to catch. The real
 *      canon's MP3s decode cleanly and drive the read-aloud effect to
 *      completion.
 *   2. **Tighter regression coverage.** If a future canon-bake changes
 *      the wire shape in a way the parser rejects, this spec FAILS —
 *      because the spec eats the same bytes the parser eats in
 *      production. A hand-rolled fixture would happily keep passing.
 *
 * Why not hit `/api/claude` for real:
 *   - `vite preview` (the harness's web server) does NOT serve
 *     `/api/*.ts` serverless functions.
 *   - The suite's hard contract is "no live Anthropic / Azure hits in
 *     e2e" — even if vite preview did serve `/api/claude`, we'd want
 *     the route handler in front of it.
 *
 * Note on test 7 (focusNode persistence)
 * --------------------------------------
 * The dispatch contract called for reading
 * `localStorage['marian-tutor.session-history.v1']` for the most-recent
 * session's `focusNode`. The actual storage key for per-session focus is
 * `marian-tutor:progress:v1`'s `history[last].skillFocus[0]` — see
 * `screens/SessionEnd/progressHistory.ts`. The session-history v2 blob
 * holds aggregate stats (sessionCount, cumulativeStardust, etc.) and has
 * no per-session focus field. The assertion is wired against the correct
 * key; the contract drift is called out in the PR body.
 *
 * Note on test 1 (cumulative stardust on debug-seed mount)
 * --------------------------------------------------------
 * The dispatch contract claimed the seed inserts a fake session with
 * 8 stardust → expect `data-total="8"`. The actual seeder
 * (`src/lib/debug/debugSeed.ts`) writes via `emptySessionHistory()` and
 * only bumps `sessionCount` to 1; `cumulativeStardust` stays at 0. The
 * assertion is wired to the actual behavior (`data-total="0"`); contract
 * drift called out in the PR body.
 *
 * Note on `forceHowlerUnlock`
 * ---------------------------
 * The shared helper from `_helpers/seedStorage.ts` is intentionally NOT
 * used in this spec. It proactively constructs (chromium) or stubs
 * (webkit) `Howler.ctx`. That breaks `loadSessionAudio`'s Howl
 * construction — Howler assumes IT owns ctx and `audioCtx.createGain()`
 * rejects with "Failed to execute 'connect' on 'AudioNode'". The mock
 * fetch then resolves but `prepareWordSongPathA` rejects on
 * audio-loading, so audioReady flips to true with the static plan still
 * in place — masking the cvc regression. Howler's natural ctx creation
 * (during the post-click loadSessionAudio) is sufficient on chromium
 * headless: ctx auto-creates in `'running'` state, `getHowlerRunningFn()`
 * returns true on the first read-aloud effect run after the mock fetch
 * settles, and the canon's MP3s decode cleanly.
 *
 * Why some tests skip on webkit
 * -----------------------------
 * WebKit headless (Playwright's iPad-engine surrogate) lacks
 * `AudioContext` entirely: `Howler.ctx` is never created, so the
 * read-aloud effect's `getHowlerRunningFn()` predicate stays false and
 * the effect bails forever. This is a Playwright headless limitation,
 * NOT a real-iPad-Safari issue (real iPad gesture-unlock + ctx
 * creation works fine).
 *
 * Tests 1, 2, 8, 10 (debug-seed routing, planner request shape,
 * negative-seed routing, and Hub progress projection / celebration
 * mutual-exclusion) run on BOTH chromium AND webkit — they don't
 * depend on the read-aloud completing. Tests 3-7, 9, 11 (caption text,
 * chip targeting, problem advance, session-end, focus persistence,
 * silent-text window timing, and cancel-on-tap rapid handoff) need
 * the read-aloud to fire and are therefore chromium-only. Marian's
 * actual iPad path remains covered: the planner contract + Hub
 * projection are the load-bearing surfaces, and tests 1, 2, 8, 10
 * lock those on webkit.
 *
 * Note on test 11 (cancel-on-tap)
 * -------------------------------
 * PR #144's surface is the singleton `cancelActiveHubLine` wired into
 * `Hub.tsx` via the module-level default. The most direct e2e signal
 * we can produce is a smoke assertion on the rapid Hub→WordSong
 * handoff: that the route flip succeeds, the planner request fires
 * exactly once, and WordSong's read-aloud-played reaches `true` within
 * the normal time bound. Pre-fix the leaking Hub utterance overlapped
 * the WordSong read-aloud and the gate sometimes failed to re-flip in
 * time; post-fix the cancel guarantees the silent baseline. We can't
 * assert "audio went silent" directly from Playwright (no Howler spy
 * surface in production code), so test 11 is a behavioural regression
 * guard, not a direct cancellation assertion. The unit-test side of
 * `cancelActive()` is exercised in `playHubLine.test.ts` /
 * `Hub.test.tsx` — this test pairs that with the actual screen-state
 * machine they sit in front of.
 */

import { test, expect } from '@playwright/test'
import type { Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Path to the production canon file the spec serves as the mock response.
 * Resolved relative to `process.cwd()` because Playwright runs the
 * harness from the worktree root (same place vite preview reads
 * `public/`). Hardcoding the relative path means the spec breaks loudly
 * if the canon ever moves (good — that's a regression worth surfacing).
 */
const CVC_WORDS_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/cvc-words.json',
)

/** The eight valid CVC targets shipped in the canon — for membership
 *  checks against parsed read-line / chip data attributes. */
const VALID_CVC_WORDS: ReadonlySet<string> = new Set([
  'bag',
  'bat',
  'cat',
  'fan',
  'hat',
  'jam',
  'pan',
  'van',
])

/**
 * Install a /api/claude mock that returns the cvc-words canon on
 * word-song requests, and captures every observed request body so the
 * spec can assert on the planner contract (kind / track / focusNode).
 *
 * Why not reuse `installClaudeMock`: the shared helper's word-song
 * fixture is the blending-cv shape ("Tap the X.") — wrong for this
 * spec. We also need request capture for assertion #2, which the shared
 * helper doesn't expose. A minimal local mock + canon-bytes pass-through
 * is the cleanest answer.
 *
 * Math (or any other) requests are intentionally rejected with 500 — the
 * cvc-words flow only triggers a word-song fetch; a stray math request
 * would mean the spec's invariants are wrong, and we'd rather see a
 * loud error than a silent pass.
 */
async function installCvcWordsClaudeMock(
  page: import('@playwright/test').Page,
): Promise<{ requests: Request[] }> {
  const canonBody = readFileSync(CVC_WORDS_CANON_PATH, 'utf-8')
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
        message: `cvc-words spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

// ── Spec ──────────────────────────────────────────────────────────────────

/**
 * Skip helper for tests that depend on the read-aloud effect firing.
 * WebKit headless has no AudioContext → `getHowlerRunningFn()` returns
 * false forever → the effect bails forever → chips never enable. See
 * file header for the long-form explanation. This skip is a Playwright
 * harness limitation, not a production-iPad issue.
 */
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud effect cannot fire. Production iPad Safari works fine; this is a harness limitation. Tests 1, 2, 8 cover the planner contract on webkit.',
  )
}

test.describe('cvc-words flow regression (PRs #135, #142, #140, #144)', () => {
  test('1. ?debug=1&seed=cvc-words mounts Hub directly with seeder-applied state', async ({
    page,
  }) => {
    await installCvcWordsClaudeMock(page)
    await page.goto('/?debug=1&seed=cvc-words')

    // Splash auto-advances. The seeder bumped sessionCount to 1, so
    // `nextAfterSplash()` routes us to Hub (not Greet).
    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Greet must NOT be on screen — proves the seeder's skipGreet bump
    // landed in the right session-history blob.
    await expect(page.getByTestId('greet')).toHaveCount(0)

    // Cumulative stardust HUD reflects the seeder's actual writes. The
    // seeder uses `emptySessionHistory()` + sessionCount: 1 — it does
    // NOT write any stardust — so the badge shows 0. (Contract said 8;
    // call-site truth is 0. See file header.)
    const stardustBadge = page.getByTestId('hub-cumulative-stardust')
    await expect(stardustBadge).toHaveAttribute('data-total', '0')
  })

  test('2. Tapping Word Song fires planner request with progress.focusNode === "cvc-words"', async ({
    page,
  }) => {
    const { requests } = await installCvcWordsClaudeMock(page)
    await page.goto('/?debug=1&seed=cvc-words')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // Word Song mounts — proves the planner fetch resolved (cvc-words
    // mock returned 200) and the parser accepted the cvc-word content
    // type.
    await expect(page.getByTestId('word-song')).toBeVisible({
      timeout: 15_000,
    })

    // Exactly one /api/claude POST observed for this session-start.
    expect(requests).toHaveLength(1)
    const recorded = requests[0]!
    const body = JSON.parse(recorded.postData() ?? '{}') as Record<
      string,
      unknown
    >

    expect(body.kind).toBe('session-start')
    const payload = body.payload as Record<string, unknown>
    expect(payload.track).toBe('word-song')

    // The contract Kevin caught earlier: `focusNode` lives under
    // `payload.progress`, NOT at the top of the payload.
    const progressBlock = payload.progress as Record<string, unknown>
    expect(progressBlock).toBeDefined()
    expect(progressBlock.focusNode).toBe('cvc-words')
  })

  test('3. Read-line caption renders ["Read", "the", "<word>."] with a valid CVC target', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsClaudeMock(page)
    await page.goto('/?debug=1&seed=cvc-words')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    // Wait for the read-aloud effect to complete (chips become enabled
    // once `readAloudPlayed` flips). This is also our proof that
    // (a) the cvc-words mock plan reached WordSong, (b) the audio
    // pipeline decoded the canon's MP3s, and (c) the gate transitioned
    // to 'unlocked'.
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })

    // The caption renders word-by-word. Each token is a
    // `word-song-caption-word` span carrying `data-word` (the source of
    // truth for the rendered text). textContent of the parent `<p>`
    // concatenates without whitespace, so we read the structured
    // attributes directly.
    const captionWords = page.getByTestId('word-song-caption-word')
    await expect(captionWords).toHaveCount(3, { timeout: 5_000 })

    const tokens = await captionWords.evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).getAttribute('data-word')),
    )
    expect(tokens).toHaveLength(3)
    expect(tokens[0]).toBe('Read')
    expect(tokens[1]).toBe('the')

    // Third token has the form "<word>." — strip the period and verify
    // the bare word is one of the eight CVC targets.
    const thirdToken = tokens[2]!
    const targetMatch = thirdToken.match(/^(\w+)\.$/)
    expect(targetMatch).not.toBeNull()
    const target = targetMatch![1]!
    expect(VALID_CVC_WORDS.has(target)).toBe(true)

    // Cross-check against the canonical regex form (Marian's iPad
    // hears the spans concatenated with spaces).
    const reconstructed = tokens.join(' ')
    expect(reconstructed).toMatch(/^Read the \w+\.$/)
  })

  test('4. Three chips render; one has data-correct="true" matching the read-line word; the other two are valid distractors', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsClaudeMock(page)
    await page.goto('/?debug=1&seed=cvc-words')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })
    // Confirms the cvc plan reached us and the read-aloud completed.
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })

    // Word card carries the target word as `data-word` — same source as
    // the caption's read-line target.
    const wordCard = page.getByTestId('word-song-word-card')
    await expect(wordCard).toBeVisible()
    const targetWord = await wordCard.getAttribute('data-word')
    expect(targetWord).not.toBeNull()
    expect(VALID_CVC_WORDS.has(targetWord!)).toBe(true)

    // Exactly three chips render.
    const chips = page.getByTestId('word-song-chip')
    await expect(chips).toHaveCount(3)

    // Exactly one chip is the correct chip; its `data-word` matches the
    // word card's target.
    const correctChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChip).toHaveCount(1)
    await expect(correctChip).toHaveAttribute('data-word', targetWord!)

    // The other two chips are distractors with valid `data-word`
    // attributes pulled from the picture-pack target pool. We don't pin
    // specific distractor identities — the planner picks them — but each
    // must (a) carry a non-null `data-word`, (b) NOT be the target, and
    // (c) be unique.
    const distractors = page.locator(
      '[data-testid="word-song-chip"][data-correct="false"]',
    )
    await expect(distractors).toHaveCount(2)
    const distractorWords = await distractors.evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).getAttribute('data-word')),
    )
    expect(distractorWords).toHaveLength(2)
    for (const w of distractorWords) {
      expect(w).not.toBeNull()
      expect(typeof w).toBe('string')
      expect((w as string).length).toBeGreaterThan(0)
      expect(w).not.toBe(targetWord)
    }
    expect(new Set(distractorWords).size).toBe(2)
  })

  test('5. Tapping the correct chip advances to problem index 1 and re-flips read-aloud-played to true', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsClaudeMock(page)
    await page.goto('/?debug=1&seed=cvc-words')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    // Wait for problem 0 to be the current state (read-aloud completed
    // and the data-attribute is exposed by the WordSong root).
    await expect(wordSong).toHaveAttribute('data-problem-index', '0', {
      timeout: 15_000,
    })
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })

    // Tap the correct chip for problem 0.
    const correctChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 15_000 })
    await correctChip.click()

    // Problem index advances to 1 (auto-advance after celebration).
    await expect(wordSong).toHaveAttribute('data-problem-index', '1', {
      timeout: 15_000,
    })

    // Read-aloud-played re-flips to true on the new problem (it
    // transiently flips to false at the advance boundary; we assert the
    // post-flip steady state).
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 15_000,
    })
  })

  test('6. Walking 8 correct chips lands on SessionEnd with non-zero stardust', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsClaudeMock(page)
    await page.goto('/?debug=1&seed=cvc-words')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    // Walk all 8 problems.
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

    // SessionEnd mounts after problem 8.
    const sessionEnd = page.getByTestId('session-end')
    await expect(sessionEnd).toBeVisible({ timeout: 20_000 })

    // Word-song earns its stardust at session-end (per ticket 86c9kwvza
    // the per-correct-tap grant moved to a session-end completion bonus).
    // We assert the displayed stardust is a finite, non-negative integer
    // and at least 1 (proving the session registered at all). We do NOT
    // pin an exact >= 8 bound — the dispatch contract referenced an
    // older formula; current behaviour grants the +5 completion bonus,
    // and tightening that here would couple this regression spec to the
    // stardust formula (which has its own dedicated tests).
    //
    // Storage: the value lives on `data-total-stardust` on the
    // `[data-testid="session-end"]` root — there is no
    // `[data-testid="session-end-stardust"]` testid (call-out for the
    // dispatch contract).
    const totalAttr = await sessionEnd.getAttribute('data-total-stardust')
    const total = Number(totalAttr)
    expect(Number.isFinite(total)).toBe(true)
    expect(total).toBeGreaterThanOrEqual(1)
  })

  test('7. Progress history records cvc-words as the focus of the just-completed session', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsClaudeMock(page)
    await page.goto('/?debug=1&seed=cvc-words')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

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

    // SessionEnd's mount effect calls `recordProgressOnSessionEnd`
    // (see SessionEnd.tsx), which appends a history entry with
    // `skillFocus: [focusNode]` to the Progress blob.
    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })

    // Read the persisted Progress blob and assert the most recent
    // history entry's focus is cvc-words. NOTE: focus lives on
    // `marian-tutor:progress:v1`'s `history[].skillFocus[0]` — NOT on
    // `marian-tutor.session-history.v1`. See file header.
    interface ProgressHistoryEntry {
      dateISO: string
      skillFocus: ReadonlyArray<string>
      successRate: number
    }
    interface PersistedProgress {
      schemaVersion: number
      history: ReadonlyArray<ProgressHistoryEntry>
    }
    const progress = (await page.evaluate(() => {
      const raw = window.localStorage.getItem('marian-tutor:progress:v1')
      return raw === null ? null : (JSON.parse(raw) as unknown)
    })) as PersistedProgress | null

    expect(progress).not.toBeNull()
    expect(progress!.history.length).toBeGreaterThanOrEqual(1)
    const lastEntry = progress!.history[progress!.history.length - 1]!
    expect(lastEntry.skillFocus).toHaveLength(1)
    expect(lastEntry.skillFocus[0]).toBe('cvc-words')
  })

  test('8. Without ?seed=cvc-words, fresh-storage launch routes to Greet (debug seed is QA-only)', async ({
    page,
  }) => {
    // No mock needed — Greet does not POST to /api/claude.
    await page.goto('/')

    // Splash auto-advances to Greet on first-ever launch
    // (sessionCount === 0 is the default for fresh storage).
    await expect(page.getByTestId('greet')).toBeVisible({ timeout: 10_000 })

    // Hub must NOT be visible — locks the production guarantee that the
    // debug seeder is gated on `?debug=1` and never displaces a normal
    // user's Greet → Math first-ever experience.
    await expect(page.getByTestId('hub')).toHaveCount(0)
  })

  // ── PR #142 — silent-text window on cvc-word problems ───────────────────

  /**
   * PR #142 (commit `9266143`) added a 1500ms `SILENT_TEXT_WINDOW_MS`
   * before the read-aloud fires on cvc-word problems. The word card text
   * must render IMMEDIATELY (so Marian has decoding time) but the
   * read-aloud must NOT fire until the window has elapsed. The
   * `data-read-aloud-played="true"` attribute on `[data-testid="word-song"]`
   * flips only AFTER the read-aloud completes — we use elapsed wall-time
   * between mount and flip as the regression signal.
   *
   * Pre-fix (PR #135 baseline) behaviour: read-aloud would fire on the
   * mount microtask, `data-read-aloud-played` flip and word-card paint
   * would be near-simultaneous (well under 500ms apart). Post-fix the
   * gap is ≥1500ms because the timer holds the dispatch back. We assert
   * `>= 1400ms` to leave 100ms headroom for browser variance — that's
   * still well above the pre-fix ceiling (~200ms on CI), so the
   * direction of regression is unambiguous.
   *
   * blending-cv (immediate-fire) coverage lives in `WordSong.test.tsx`
   * — the e2e suite cannot reach blending-cv via `?seed=cvc-words`, and
   * adding a second seed value is out of scope here. This test pins the
   * regression direction (cvc → MUST be deferred); the unit test pins
   * the blending-cv negative side (must NOT be deferred).
   */
  test('9. PR #142 — cvc-word read-aloud is deferred ≥1.5s after mount; word card text renders immediately', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsClaudeMock(page)
    await page.goto('/?debug=1&seed=cvc-words')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    // Wait for the WordSong root to expose `data-problem-index="0"` AND
    // for the word card to mount (proves the cvc plan reached us and the
    // first problem is on screen). Capture the wall-time at this moment
    // — this is the "mount" reference point for the silent-text window.
    await expect(wordSong).toHaveAttribute('data-problem-index', '0', {
      timeout: 15_000,
    })
    const wordCard = page.getByTestId('word-song-word-card')
    await expect(wordCard).toBeVisible({ timeout: 5_000 })
    const targetWord = await wordCard.getAttribute('data-word')
    expect(targetWord).not.toBeNull()
    expect(VALID_CVC_WORDS.has(targetWord!)).toBe(true)

    // The word-card text MUST be on screen BEFORE read-aloud-played
    // flips. Pre-fix this would still be true (the paint and the audio
    // fire near-simultaneously), but it's a useful sanity check on the
    // visual ordering — if a future change pushed the word-card render
    // behind the audio gate, this would fail loudly.
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'false', {
      timeout: 1_000,
    })

    // Mark mount-reference time AFTER confirming word-card painted — so
    // we measure the silent window from the earliest point the user
    // could be decoding the word. Includes any setup latency before the
    // mount microtask, which is conservative against false-positives.
    const mountAt = Date.now()

    // Wait for read-aloud-played to flip to true. The silent-text timer
    // (1500ms) plus the read-aloud duration ("Read the cat." ≈ ~1.2s on
    // canon-rendered MP3s) means ~2700ms is typical wall-time end-to-end.
    // 25s ceiling is generous to cover slow CI / WebKit variance.
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 25_000,
    })
    const flippedAt = Date.now()

    const elapsedMs = flippedAt - mountAt
    expect(elapsedMs).toBeGreaterThanOrEqual(1400)
  })

  // ── PR #140 — Hub progress wire + promotion celebration ─────────────────

  /**
   * PR #140 (commit `629e7ce`) wires `loadProgress()` into Hub on every
   * hub-route entry and projects `skillLevels` into per-tree indices.
   * The cvc-words seeder marks `letter-names`, `letter-sounds`, and
   * `blending-cv` as `'mastered'` (cvc-words itself is `'practicing'`).
   * `projectHubTreeProgress()` therefore returns `wordSongIndex: 3` —
   * the index of the first non-mastered node in the WORD_SONG_NODES_IN_ORDER
   * declaration.
   *
   * The path-strip's sliding-window helper renders 5 cells, with the cell
   * at the absolute index `wordSongIndex` marked `data-kind="current"`
   * and earlier cells marked `data-kind="mastered"`. Because the seeded
   * progress has no `pendingPromotion`, the celebration overlay must NOT
   * render and idle Emma stays on screen.
   *
   * Test runs on BOTH chromium AND webkit — no audio required. The
   * projection is a pure-function regression surface; failure here means
   * App.tsx stopped threading `progress` through, or
   * `projectHubTreeProgress()` regressed on the order-walk.
   */
  test('10. PR #140 — Hub renders projected path-strip from seeded skillLevels (wordSongIndex=3); no celebration without pendingPromotion', async ({
    page,
  }) => {
    await installCvcWordsClaudeMock(page)
    await page.goto('/?debug=1&seed=cvc-words')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Word-song path-strip — 5 cells (sliding-window helper). With
    // wordSongIndex=3 and an 8-node track, `slidingWindow(stages, 3, 5)`
    // yields desiredOffset=2, maxOffset=3, offset=2 (uncamped), so the
    // rendered slice is [blending-cv, cvc-words, cvc-words-short-o,
    // digraphs, sight-words] — the FIRST cell is `blending-cv` and the
    // cell at absolute index 3 (cvc-words) is `current`. The
    // earlier-mastered nodes (letter-names, letter-sounds) are
    // off-window and therefore intentionally not rendered, and
    // `simple-sentences` drops out of the right edge of the window now
    // that the track is 8 nodes long.
    const wordSongStrip = page.locator(
      '[data-testid="hub-path-strip"][data-tree="word-song"]',
    )
    await expect(wordSongStrip).toBeVisible()
    const wordSongCells = wordSongStrip.locator(
      '[data-testid="hub-path-strip-cell"]',
    )
    await expect(wordSongCells).toHaveCount(5)

    // Read all (stage, kind) pairs at once — single RPC, no per-cell race.
    const wordSongProjection = await wordSongCells.evaluateAll((nodes) =>
      nodes.map((n) => ({
        stage: (n as HTMLElement).getAttribute('data-stage'),
        kind: (n as HTMLElement).getAttribute('data-kind'),
      })),
    )
    expect(wordSongProjection).toEqual([
      { stage: 'blending-cv', kind: 'mastered' },
      { stage: 'cvc-words', kind: 'current' },
      { stage: 'cvc-words-short-o', kind: 'locked' },
      { stage: 'digraphs', kind: 'locked' },
      { stage: 'sight-words', kind: 'locked' },
    ])

    // No pendingPromotion seeded → celebration overlay must NOT render.
    await expect(page.getByTestId('hub-promotion-celebration')).toHaveCount(0)
    await expect(page.getByTestId('hub-promotion-emma')).toHaveCount(0)

    // Idle Emma IS on screen — the mutual-exclusion gate inverts the
    // celebration-visible suppression. With no celebration, idle Emma
    // renders normally.
    await expect(page.getByTestId('hub-emma')).toHaveCount(1)
  })

  /**
   * Mutual-exclusion regression: when `pendingPromotion` is set on the
   * persisted Progress blob, the PromotionCelebration overlay mounts and
   * idle Emma is suppressed. Pre-PR-#140-v2 the two Emma instances
   * stacked visibly; post-fix the idle Emma is conditionally rendered
   * behind `!celebrationVisible`.
   *
   * We seed `pendingPromotion: 'cvc-words'` directly into the persisted
   * Progress blob via `addInitScript` (mirrors `seedLocalStorage`'s
   * pattern but writes a hand-shaped blob — the public seeder helper
   * does not expose a pendingPromotion field). The seed runs BEFORE
   * `?debug=1&seed=cvc-words` because the cvc seeder reads the existing
   * progress via `loadProgress()` and merges its skillLevels patch on
   * top, preserving fields it doesn't touch (including
   * pendingPromotion).
   *
   * No mock — Hub doesn't POST to /api/claude on its own. Runs on both
   * chromium and webkit (no audio dependency).
   */
  test('10b. PR #140 — pendingPromotion mounts celebration overlay; idle Emma is suppressed under mutual-exclusion gate', async ({
    page,
  }) => {
    // Seed a Progress blob with pendingPromotion set BEFORE the cvc
    // seeder runs (it merges, not overwrites). Shape mirrors the
    // canonical Progress document; the cvc seeder's
    // `applySkillLevelsPatch` will then overlay skillLevels but leave
    // pendingPromotion intact.
    await page.addInitScript(() => {
      const blob = {
        schemaVersion: 1,
        profile: {
          childName: 'Marian',
          character: 'melody',
          lastPlayedISO: null,
        },
        skillLevels: {
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
          'letter-names': 'mastered',
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'practicing',
          'cvc-words-short-o': 'locked',
          digraphs: 'locked',
          'sight-words': 'intro',
          'simple-sentences': 'locked',
        },
        mathFactsLeitner: { items: [] },
        history: [],
        parentSettings: {
          autoPromote: false,
          sessionModePicker: 'off',
          masteryThreshold: { percent: 0.95, sessions: 3 },
          crossDayEnforcement: true,
          showLevelToMarian: false,
        },
        pendingPromotion: 'cvc-words',
      }
      window.localStorage.setItem(
        'marian-tutor:progress:v1',
        JSON.stringify(blob),
      )
    })

    await page.goto('/?debug=1&seed=cvc-words')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Celebration overlay mounts with the queued node tagged on the root.
    const celebration = page.getByTestId('hub-promotion-celebration')
    await expect(celebration).toHaveCount(1)
    await expect(celebration).toHaveAttribute('data-node', 'cvc-words')

    // Celebration's own Emma is on screen.
    await expect(page.getByTestId('hub-promotion-emma')).toHaveCount(1)

    // Mutual-exclusion gate: idle Emma is suppressed while celebration
    // is visible. Pre-fix BOTH would render and stack visibly.
    await expect(page.getByTestId('hub-emma')).toHaveCount(0)

    // Sparkle burst renders — 8 sparkles per the radial layout.
    await expect(page.getByTestId('hub-promotion-sparkle')).toHaveCount(8)

    // Caption uses the projected human label for cvc-words.
    await expect(page.getByTestId('hub-promotion-node-label')).toHaveText(
      'CVC words',
    )
  })

  // ── PR #144 — cancel-on-tap (no audio leak past route flip) ─────────────

  /**
   * PR #144 (commit `ad8c1cb`) added `cancelActive()` to `playHubLine.ts`
   * and wired it into `Hub.tsx`'s `handleNodeTap` so the in-flight Hub
   * welcome-back utterance stops cleanly before the route flips to Math
   * or WordSong. Pre-fix the Hub utterance leaked past the route flip
   * and overlapped the next screen's read-aloud — Thomas caught this on
   * iPad ear-test 2026-05-03.
   *
   * Direct cancellation assertion ("Howler stopped on cancel") lives in
   * `playHubLine.test.ts`'s unit suite where we can spy on the Howl. At
   * the e2e level we cannot inspect Howler internals from production
   * code (no test seam exposed by the shipped bundle), so this test is
   * a behavioural smoke check that the cancel doesn't break the
   * downstream flow:
   *
   *   1. The Hub→WordSong route flip succeeds within normal time.
   *   2. Exactly ONE `/api/claude` request fires (proves no double-mount
   *      retry from a hung utterance).
   *   3. WordSong's `data-read-aloud-played` reaches `true` within the
   *      normal time bound — pre-fix on a real iPad the leaked utterance
   *      could collide with the WordSong read-aloud and stall the gate.
   *
   * The chip tap fires almost immediately after Hub mounts (well within
   * the welcome-back utterance window), exercising the same rapid
   * handoff path Marian's iPad takes when she's eager to start.
   */
  test('11. PR #144 — rapid Hub→WordSong tap: route flips cleanly, single planner request, WordSong read-aloud completes', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    const { requests } = await installCvcWordsClaudeMock(page)
    await page.goto('/?debug=1&seed=cvc-words')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Tap WordSong as soon as Hub is mountable — mid-welcome-back-utterance.
    // This is the path that pre-fix produced the audio leak.
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // Route flip: WordSong mounts. Failure to flip here is an
    // independent regression (un-related to PR #144) but would fall out
    // of any cancel-related breakage that bricked the click handler.
    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })
    await expect(wordSong).toHaveAttribute('data-problem-index', '0', {
      timeout: 15_000,
    })

    // Read-aloud-played eventually flips — proves the WordSong gate
    // completed without being held by a leaking Hub utterance. Pre-fix
    // on real iPad the overlap could keep `getHowlerRunning()` reads
    // jittery during the WordSong effect's first run.
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 25_000,
    })

    // Exactly one /api/claude POST observed — no double-mount, no
    // retry. Cancel-on-tap is a synchronous Howl.stop() under the hood;
    // any breakage there that re-fires the WordSong audio pipeline
    // would manifest here as 2+ requests.
    expect(requests).toHaveLength(1)
  })
})
