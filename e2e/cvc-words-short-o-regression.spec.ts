/**
 * E2E regression spec — cvc-words-short-o session flow.
 *
 * Sibling to `cvc-words-regression.spec.ts` (covers short-a, PRs #135,
 * #142, #140, #144). PR #151 (commit `505cd60`) shipped the
 * `cvc-words-short-o` sibling focus node — a v2 vowel tier between
 * `cvc-words` (short-a) and `digraphs` in `WORD_SONG_NODES_IN_ORDER`.
 *
 * What this spec locks
 * --------------------
 * Eight tests. Tests 1-7 mirror the flow-level coverage in the short-a
 * spec (debug-seed routing, planner request shape, read-line caption,
 * chip render, advance, 8-tap walk, focus persistence). Test 8 is new
 * — it locks the CURRENT same-vowel-only distractor policy
 * (`design/word-song/short-o-pool-expansion.md` §8). Cross-vowel mixing
 * is filed as ticket `86c9m3aek` and is intentionally OUT of scope until
 * that ticket lands; this assertion is a regression guard so the future
 * cross-vowel work explicitly OPTS in to mixing rather than letting it
 * leak in silently.
 *
 * Tests skipped vs. the short-a sibling
 * -------------------------------------
 *  - Short-a's "?debug=1&seed=cvc-words" route is NOT mirrored — there
 *    is no short-o seed in `debugSeed.ts` (Kevin is wiring one on a
 *    separate branch, may not be merged when this spec lands). Instead
 *    we seed via `buildSeedProgress` (`skillLevelOverrides` →
 *    `cvc-words: mastered`, `cvc-words-short-o: practicing`) +
 *    `buildSeedSessionHistory({ sessionCount: 5 })` to skip Greet.
 *    `pickFocusNode()` walks the literacy track and returns
 *    `cvc-words-short-o` because every earlier node (including
 *    `cvc-words`) is `mastered`.
 *  - Short-a's tests 8 (negative-seed routing → Greet), 9 (PR #142
 *    silent-text window timing), 10 / 10b (Hub progress projection +
 *    PromotionCelebration overlay) and 11 (PR #144 cancel-on-tap) are
 *    NOT mirrored — they exercise code paths shared across both vowel
 *    tiers (no short-o-specific surface area). Per dispatch contract
 *    those are already locked by the short-a sibling.
 *
 * Mock strategy
 * -------------
 * Sibling `installCvcWordsShortOClaudeMock` — same shape as the short-a
 * helper but returns the bytes of
 * `public/canon/word-song/level-1/cvc-words-short-o.json`. Reusing the
 * shared `installClaudeMock` would return the canonical short-a fixture
 * for any word-song request and mask the entire regression. We also need
 * request capture for assertion #2 (planner contract on `focusNode`),
 * which the shared helper doesn't expose. See the short-a sibling
 * spec's header for the long-form rationale on canon-bytes pass-through
 * vs. hand-rolled fixtures (real Azure-rendered MP3s decode cleanly in
 * headless Chromium; silent-base64 fixtures break Howler).
 *
 * Why some tests skip on webkit
 * -----------------------------
 * Same harness limitation as the short-a sibling — WebKit headless has
 * no AudioContext, so the read-aloud effect's `getHowlerRunningFn()`
 * predicate stays false forever and chips never enable. Tests that
 * don't depend on the read-aloud completing run on BOTH chromium AND
 * webkit (1, 2). Tests that need the read-aloud to fire (3-8) are
 * chromium-only. Real iPad Safari is unaffected.
 *
 * Note on canon authority
 * -----------------------
 * The canon's 8 short-o targets — dog, mom, pot, log, mop, box, fox,
 * hot — are the source of truth for `VALID_SHORT_O_WORDS`. They mirror
 * (and must stay in sync with) the `vowel: 'o'` entries in
 * `src/screens/WordSong/wordPack.ts` `TARGET_WORDS`. Hardcoding the
 * set here means a future canon-bake that omits or adds a target
 * fails this spec loudly — the right kind of failure.
 *
 * Note on test 7 (focusNode persistence)
 * --------------------------------------
 * Same caveat as the short-a sibling — the focus lives on
 * `marian-tutor:progress:v1`'s `history[].skillFocus[0]`, NOT on
 * `marian-tutor.session-history.v1`. See short-a sibling spec for the
 * long-form explanation.
 */

import { test, expect } from '@playwright/test'
import type { Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * Path to the production canon file the spec serves as the mock response.
 * Resolved relative to `process.cwd()` because Playwright runs the
 * harness from the worktree root (same place vite preview reads
 * `public/`). Hardcoding the relative path means the spec breaks loudly
 * if the canon ever moves (good — that's a regression worth surfacing).
 */
const CVC_WORDS_SHORT_O_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/cvc-words-short-o.json',
)

/**
 * The eight short-o targets shipped in the canon. Source of truth for
 * read-line / chip-target membership checks. Must stay aligned with
 * `vowel: 'o'` entries in `wordPack.ts` `TARGET_WORDS`.
 */
const VALID_SHORT_O_WORDS: ReadonlySet<string> = new Set([
  'dog',
  'mom',
  'pot',
  'log',
  'mop',
  'box',
  'fox',
  'hot',
])

/**
 * The short-a target + distractor-only pool. Used by test 8 to assert
 * NO short-a word leaks into a short-o session's chip render under the
 * current same-vowel-only distractor policy
 * (`design/word-song/short-o-pool-expansion.md` §8). Mirror of
 * `wordPack.ts` `TARGET_WORDS` (`vowel: 'a'`) plus the short-a-flavoured
 * entries in `DISTRACTOR_ONLY_WORDS`. If a future ticket
 * (`86c9m3aek`) opts in to cross-vowel mixing, that ticket will need to
 * update this assertion alongside the picker change — exactly the
 * regression-guard semantics we want.
 */
const SHORT_A_AND_OTHER_VOWEL_POOL: ReadonlySet<string> = new Set([
  // Short-a target words (canonical 14-pack + 4 novel-pool probes).
  'cat',
  'hat',
  'bat',
  'mat',
  'bag',
  'fan',
  'man',
  'pan',
  'cap',
  'can',
  'tag',
  'dad',
  'jam',
  'van',
  'nap',
  'rat',
  'map',
  'tap',
  // Distractor-only entries — short-u and short-e flavoured. Never
  // appear in a short-o chip render under the same-vowel-only policy.
  'bus',
  'sun',
  'cup',
  'pen',
])

/**
 * Install a /api/claude mock that returns the cvc-words-short-o canon on
 * word-song requests, captures every observed request body for planner
 * contract assertions. See file header for the rationale on a sibling
 * mock vs. reusing `installClaudeMock`.
 *
 * Math (or any other) requests are intentionally rejected with 500 — the
 * cvc-words-short-o flow only triggers a word-song fetch; a stray math
 * request would mean the spec's invariants are wrong, and we'd rather see
 * a loud error than a silent pass.
 */
async function installCvcWordsShortOClaudeMock(
  page: import('@playwright/test').Page,
): Promise<{ requests: Request[] }> {
  const canonBody = readFileSync(CVC_WORDS_SHORT_O_CANON_PATH, 'utf-8')
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
        message: `cvc-words-short-o spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

/**
 * Seed the persisted Progress + SessionHistory blobs so the App routes
 * Splash → Hub directly with `cvc-words-short-o` as the picked focus
 * node. Called from `beforeEach`. The seed runs BEFORE the first
 * `goto()` via `addInitScript`, so the App's mount-time
 * `loadProgress()` reads observe it.
 *
 *  - `cvc-words` is bumped to `mastered` (would otherwise be the
 *    picked focus — `pickFocusNode()` walks the track and stops at the
 *    first non-mastered node).
 *  - `cvc-words-short-o` is bumped to `practicing` (the post-graduation
 *    state Marian is in once short-a is mastered).
 *  - SessionHistory `sessionCount: 5` skips Greet (Splash advances
 *    direct to Hub when sessionCount > 0).
 */
async function seedShortOProgress(
  page: import('@playwright/test').Page,
): Promise<void> {
  await seedLocalStorage(page, {
    progress: buildSeedProgress({
      skillLevelOverrides: {
        // Every literacy node before short-o must be `mastered` so
        // `pickFocusNode()` walks the track and stops at
        // `cvc-words-short-o`. The defaults in `seedStorage.ts`
        // reflect Marian's diagnostic baseline (letter-sounds /
        // blending-cv: practicing; cvc-words: intro), so we have to
        // fast-forward all four to `mastered` to land on short-o.
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'mastered',
        'cvc-words-short-o': 'practicing',
      },
    }),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

/**
 * Skip helper for tests that depend on the read-aloud effect firing.
 * WebKit headless has no AudioContext — same harness limitation as the
 * short-a sibling spec. Tests 1, 2 cover the planner contract on webkit.
 */
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud effect cannot fire. Production iPad Safari works fine; this is a harness limitation. Tests 1, 2 cover the planner contract on webkit.',
  )
}

test.describe('cvc-words-short-o flow regression (PR #151)', () => {
  test.beforeEach(async ({ page }) => {
    await seedShortOProgress(page)
  })

  test('1. Seeded progress mounts Hub directly with cvc-words and short-o on the strip; idle Emma visible, no celebration', async ({
    page,
  }) => {
    await installCvcWordsShortOClaudeMock(page)
    await page.goto('/')

    // Splash auto-advances. With sessionCount=5 from the seeded session
    // history, `nextAfterSplash()` routes us to Hub (not Greet).
    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Greet must NOT be on screen — proves the session-history seed bumped
    // sessionCount past the Greet gate.
    await expect(page.getByTestId('greet')).toHaveCount(0)

    // Word-song path-strip projection. With letter-names, letter-sounds,
    // blending-cv AND cvc-words all `mastered`, `wordSongIndex = 4`.
    // `slidingWindow(stages, 4, 5)` yields desiredOffset=3, maxOffset=3,
    // offset=3 — slice = nodes[3..7] = [cvc-words, cvc-words-short-o,
    // digraphs, sight-words, simple-sentences].
    const wordSongStrip = page.locator(
      '[data-testid="hub-path-strip"][data-tree="word-song"]',
    )
    await expect(wordSongStrip).toBeVisible()
    const wordSongCells = wordSongStrip.locator(
      '[data-testid="hub-path-strip-cell"]',
    )
    await expect(wordSongCells).toHaveCount(5)

    const wordSongProjection = await wordSongCells.evaluateAll((nodes) =>
      nodes.map((n) => ({
        stage: (n as HTMLElement).getAttribute('data-stage'),
        kind: (n as HTMLElement).getAttribute('data-kind'),
      })),
    )
    expect(wordSongProjection).toEqual([
      { stage: 'cvc-words', kind: 'mastered' },
      { stage: 'cvc-words-short-o', kind: 'current' },
      { stage: 'digraphs', kind: 'locked' },
      { stage: 'sight-words', kind: 'locked' },
      { stage: 'simple-sentences', kind: 'locked' },
    ])

    // No pendingPromotion seeded → celebration overlay must NOT render.
    await expect(page.getByTestId('hub-promotion-celebration')).toHaveCount(0)
    await expect(page.getByTestId('hub-promotion-emma')).toHaveCount(0)

    // Idle Emma IS on screen.
    await expect(page.getByTestId('hub-emma')).toHaveCount(1)
  })

  test('2. Tapping Word Song fires planner request with progress.focusNode === "cvc-words-short-o"', async ({
    page,
  }) => {
    const { requests } = await installCvcWordsShortOClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // WordSong mounts — proves the planner fetch resolved (short-o mock
    // returned 200) and the parser accepted the cvc-word content type.
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

    // The focus-node lives under `payload.progress.focusNode` (same
    // contract Kevin pinned in the short-a sibling test 2).
    const progressBlock = payload.progress as Record<string, unknown>
    expect(progressBlock).toBeDefined()
    expect(progressBlock.focusNode).toBe('cvc-words-short-o')
  })

  test('3. Read-line caption renders ["Read", "the", "<word>."] with a valid short-o target', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortOClaudeMock(page)
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    // Wait for the read-aloud effect to complete (chips become enabled
    // once `readAloudPlayed` flips). Same gate semantics as the short-a
    // sibling spec.
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })

    // Caption renders word-by-word. Read structured `data-word`
    // attributes from each `word-song-caption-word` span.
    const captionWords = page.getByTestId('word-song-caption-word')
    await expect(captionWords).toHaveCount(3, { timeout: 5_000 })

    const tokens = await captionWords.evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).getAttribute('data-word')),
    )
    expect(tokens).toHaveLength(3)
    expect(tokens[0]).toBe('Read')
    expect(tokens[1]).toBe('the')

    const thirdToken = tokens[2]!
    const targetMatch = thirdToken.match(/^(\w+)\.$/)
    expect(targetMatch).not.toBeNull()
    const target = targetMatch![1]!
    expect(VALID_SHORT_O_WORDS.has(target)).toBe(true)

    // Cross-check against canonical regex form.
    const reconstructed = tokens.join(' ')
    expect(reconstructed).toMatch(/^Read the \w+\.$/)
  })

  test('4. Three chips render; one has data-correct="true" matching the read-line word; the other two are valid short-o distractors', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortOClaudeMock(page)
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })

    // Word card carries the target word as `data-word`.
    const wordCard = page.getByTestId('word-song-word-card')
    await expect(wordCard).toBeVisible()
    const targetWord = await wordCard.getAttribute('data-word')
    expect(targetWord).not.toBeNull()
    expect(VALID_SHORT_O_WORDS.has(targetWord!)).toBe(true)

    const chips = page.getByTestId('word-song-chip')
    await expect(chips).toHaveCount(3)

    // Exactly one correct chip; matches the word card's target.
    const correctChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChip).toHaveCount(1)
    await expect(correctChip).toHaveAttribute('data-word', targetWord!)

    // Two distractors with valid `data-word` attributes drawn from the
    // short-o pool. Each must be (a) non-null, (b) NOT the target,
    // (c) unique, AND (d) a member of VALID_SHORT_O_WORDS — locks the
    // current same-vowel-only policy at the per-chip level.
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
      expect(VALID_SHORT_O_WORDS.has(w as string)).toBe(true)
    }
    expect(new Set(distractorWords).size).toBe(2)
  })

  test('5. Tapping the correct chip advances to problem index 1 and re-flips read-aloud-played to true', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortOClaudeMock(page)
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    await expect(wordSong).toHaveAttribute('data-problem-index', '0', {
      timeout: 15_000,
    })
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })

    const correctChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 15_000 })
    await correctChip.click()

    // Auto-advance after celebration → problem 1.
    await expect(wordSong).toHaveAttribute('data-problem-index', '1', {
      timeout: 15_000,
    })

    // Read-aloud-played re-flips on the new problem.
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 15_000,
    })
  })

  test('6. Walking 8 correct chips lands on SessionEnd with non-zero stardust', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortOClaudeMock(page)
    await page.goto('/')

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

    const sessionEnd = page.getByTestId('session-end')
    await expect(sessionEnd).toBeVisible({ timeout: 20_000 })

    // Same as the short-a sibling test 6 — assert finite, non-negative,
    // ≥ 1 (proves the session registered) without coupling to the
    // current stardust formula. `data-total-stardust` lives on the
    // session-end root testid.
    const totalAttr = await sessionEnd.getAttribute('data-total-stardust')
    const total = Number(totalAttr)
    expect(Number.isFinite(total)).toBe(true)
    expect(total).toBeGreaterThanOrEqual(1)
  })

  test('7. Progress history records cvc-words-short-o as the focus of the just-completed session', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortOClaudeMock(page)
    await page.goto('/')

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

    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })

    // Read the persisted Progress blob and assert the most recent
    // history entry's focus is cvc-words-short-o. Lives on
    // `marian-tutor:progress:v1`'s `history[].skillFocus[0]`.
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
    expect(lastEntry.skillFocus[0]).toBe('cvc-words-short-o')
  })

  /**
   * Same-vowel-only distractor policy lock-in (current behaviour, ticket
   * `86c9m3aek` will be the OPT-IN to cross-vowel mixing).
   *
   * Per `design/word-song/short-o-pool-expansion.md` §8 with Thomas's
   * 2026-05-04 lock: every distractor for a short-o target is drawn from
   * the short-o pool itself (`dog, mop, log, pot, box, fox, mom, hot`).
   * No cross-vowel mixing in v1. This test walks the full 8-problem
   * session, collects every chip's `data-word` across every render, and
   * asserts:
   *
   *   - All collected words are members of `VALID_SHORT_O_WORDS`.
   *   - Zero overlap with `SHORT_A_AND_OTHER_VOWEL_POOL` (short-a
   *     targets + short-u/short-e distractor-only entries).
   *
   * If `86c9m3aek` later opts in to cross-vowel distractors, that PR will
   * need to update this assertion alongside the picker change. That's
   * the behaviour we want — explicit opt-in, no silent regression.
   */
  test('8. Distractor pool is same-vowel only — zero short-a leakage across all 8 problems', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortOClaudeMock(page)
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    // Collect every chip's data-word across every problem in the session.
    const allChipWords: string[] = []
    const allTargetWords: string[] = []
    const allDistractorWords: string[] = []

    for (let i = 0; i < 8; i++) {
      await expect(wordSong).toHaveAttribute('data-problem-index', String(i), {
        timeout: 20_000,
      })
      await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
        timeout: 20_000,
      })

      // Capture chip + target identities BEFORE the tap (DOM is stable
      // here; after the tap the celebration animation reshapes the chip
      // grid).
      const chips = page.getByTestId('word-song-chip')
      await expect(chips).toHaveCount(3)

      const chipData = await chips.evaluateAll((nodes) =>
        nodes.map((n) => ({
          word: (n as HTMLElement).getAttribute('data-word'),
          correct: (n as HTMLElement).getAttribute('data-correct') === 'true',
        })),
      )
      expect(chipData).toHaveLength(3)
      for (const { word, correct } of chipData) {
        expect(word).not.toBeNull()
        expect(typeof word).toBe('string')
        const w = word as string
        allChipWords.push(w)
        if (correct) allTargetWords.push(w)
        else allDistractorWords.push(w)
      }

      // Tap the correct chip to advance.
      const correctChip = page.locator(
        '[data-testid="word-song-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()
    }

    // Sanity: 24 total chip renders (3 chips × 8 problems), 8 targets,
    // 16 distractors. Count-based assertions per
    // feedback_count_assertions_on_regression_tests.md.
    expect(allChipWords).toHaveLength(24)
    expect(allTargetWords).toHaveLength(8)
    expect(allDistractorWords).toHaveLength(16)

    // Every chip word — target AND distractor — must be in the
    // short-o pool. Compute the off-pool intersection explicitly and
    // assert it equals []; gives a useful failure message (which words
    // leaked).
    const offPoolWords = allChipWords.filter((w) => !VALID_SHORT_O_WORDS.has(w))
    expect(offPoolWords).toEqual([])

    // Belt-and-braces: zero overlap with the short-a / other-vowel pool.
    const shortAOverlap = allChipWords.filter((w) =>
      SHORT_A_AND_OTHER_VOWEL_POOL.has(w),
    )
    expect(shortAOverlap).toEqual([])

    // SessionEnd mounts after the 8-problem walk — proves we drove a
    // complete session, not a half-session that would skip later
    // distractor renders.
    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
  })
})
