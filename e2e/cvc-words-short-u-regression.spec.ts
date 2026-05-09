/**
 * E2E regression spec — cvc-words-short-u session flow (ticket 86c9q9ben).
 *
 * Sibling to `cvc-words-short-o-regression.spec.ts` (PR #155, ticket
 * 86c9m3ae3). The cvc-words-short-u sibling focus node sits between
 * `cvc-words-short-o` and `digraphs` in `WORD_SONG_NODES_IN_ORDER` —
 * the third vowel-tier sibling per
 * `design/word-song/short-u-pool-expansion.md` §2.
 *
 * What this spec locks
 * --------------------
 * Eight tests, one tier deeper than the short-o suite. Tests 1-7
 * mirror the flow-level coverage from the short-o sibling
 * (debug-seed routing, planner request shape, read-line caption,
 * chip render, advance, 8-tap walk, focus persistence). Test 8
 * locks the same-vowel-only distractor policy
 * (`design/word-song/short-u-pool-expansion.md` §8). Cross-vowel
 * mixing is filed as ticket `86c9m3aek` and is intentionally OUT of
 * scope until that ticket lands.
 *
 * Mock strategy
 * -------------
 * Sibling `installCvcWordsShortUClaudeMock` returns the bytes of
 * `public/canon/word-song/level-1/cvc-words-short-u.json`. Reusing the
 * shared `installClaudeMock` would return the canonical short-a
 * fixture for any word-song request and mask the regression. We also
 * need request capture for test 2 (planner contract on `focusNode`),
 * which the shared helper doesn't expose. See the short-o sibling
 * spec's header for the long-form rationale on canon-bytes
 * pass-through vs. hand-rolled fixtures (real Azure-rendered MP3s
 * decode cleanly in headless Chromium; silent-base64 fixtures break
 * Howler).
 *
 * Why some tests skip on webkit
 * -----------------------------
 * Same harness limitation as the short-a / short-o siblings — WebKit
 * headless has no AudioContext, so the read-aloud effect's
 * `getHowlerRunningFn()` predicate stays false forever and chips
 * never enable. Tests that don't depend on the read-aloud completing
 * run on BOTH chromium AND webkit (1, 2). Tests that need the
 * read-aloud to fire (3-8) are chromium-only. Real iPad Safari is
 * unaffected.
 *
 * Note on canon authority
 * -----------------------
 * The canon's 11 short-u targets — sun, cup, bus, bug, nut, tub, bun,
 * jug, rug, hut, gum — are the source of truth for
 * `VALID_SHORT_U_WORDS`. They mirror (and must stay in sync with) the
 * `vowel: 'u'` entries in `src/screens/WordSong/wordPack.ts`
 * `TARGET_WORDS`. The planner only emits 8 of the 11 in any single
 * session (per the "8 distinct" rule), so the membership assertions
 * here use the FULL pool — observed targets are a subset of the
 * pool, never the other way round.
 *
 * Note on test 7 (focusNode persistence)
 * --------------------------------------
 * Same caveat as the short-o sibling — the focus lives on
 * `marian-tutor:progress:v1`'s `history[].skillFocus[0]`, NOT on
 * `marian-tutor.session-history.v1`.
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
// Path-strip projection helpers — derive the expected slice from
// `WORD_SONG_NODES_IN_ORDER` instead of hardcoding stage counts.
// Refactored under ticket 86c9qa0kq (4th occurrence — Kevin and Devon
// both flagged the pattern on PR #174 review; Devon's #174 review
// noted this short-u spec ITSELF was a 4th carbon-copy of the
// hardcoded-slice pattern). Helper unit tests live at
// `e2e/_helpers/slidingWindow.test.ts`.
import { slidingWindow } from './_helpers/slidingWindow'
import {
  WORD_SONG_NODES_IN_ORDER,
  projectExpectedCells,
} from './_helpers/wordSongNodesInOrder'

/**
 * Path to the production canon file the spec serves as the mock
 * response. Resolved relative to `process.cwd()` because Playwright
 * runs the harness from the worktree root (same place vite preview
 * reads `public/`). Hardcoding the relative path means the spec
 * breaks loudly if the canon ever moves.
 */
const CVC_WORDS_SHORT_U_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/cvc-words-short-u.json',
)

/**
 * The 11 short-u targets shipped in the canon. Source of truth for
 * read-line / chip-target membership checks. Must stay aligned with
 * `vowel: 'u'` entries in `wordPack.ts` `TARGET_WORDS`.
 */
const VALID_SHORT_U_WORDS: ReadonlySet<string> = new Set([
  'sun',
  'cup',
  'bus',
  'bug',
  'nut',
  'tub',
  'bun',
  'jug',
  'rug',
  'hut',
  'gum',
])

/**
 * The short-a target + short-o target + remaining distractor-only
 * pool. Used by test 8 to assert NO non-short-u word leaks into a
 * short-u session's chip render under the current same-vowel-only
 * distractor policy (`design/word-song/short-u-pool-expansion.md` §8).
 * Mirror of `wordPack.ts` `TARGET_WORDS` (`vowel: 'a'` and `'o'`)
 * plus the `pen` distractor-only entry. If a future ticket
 * (`86c9m3aek`) opts in to cross-vowel mixing, that ticket will need
 * to update this assertion alongside the picker change.
 */
const NON_SHORT_U_POOL: ReadonlySet<string> = new Set([
  // Short-a target words (canonical 14 + 4 novel-pool probes).
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
  // Short-o target words.
  'dog',
  'mop',
  'log',
  'pot',
  'box',
  'fox',
  'mom',
  'hot',
  // Distractor-only — short-e flavoured. (sun, cup, bus moved to
  // short-u targets per the spec §1 promotion.)
  'pen',
])

/**
 * Install a /api/claude mock that returns the cvc-words-short-u canon
 * on word-song requests, captures every observed request body for
 * planner contract assertions. Math (or any other) requests are
 * intentionally rejected with 500 — the cvc-words-short-u flow only
 * triggers a word-song fetch; a stray math request would mean the
 * spec's invariants are wrong, and we'd rather see a loud error than
 * a silent pass.
 */
async function installCvcWordsShortUClaudeMock(
  page: import('@playwright/test').Page,
): Promise<{ requests: Request[] }> {
  const canonBody = readFileSync(CVC_WORDS_SHORT_U_CANON_PATH, 'utf-8')
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
        message: `cvc-words-short-u spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

/**
 * Seed the persisted Progress + SessionHistory blobs so the App
 * routes Splash → Hub directly with `cvc-words-short-u` as the picked
 * focus node.
 *
 *  - Every word-song node before short-u must be `mastered` so
 *    `pickFocusNode()` walks the track and stops at
 *    `cvc-words-short-u`.
 *  - `cvc-words-short-u` is bumped to `practicing` (the
 *    post-short-o-promotion state Marian is in).
 *  - SessionHistory `sessionCount: 5` skips Greet (Splash advances
 *    direct to Hub when sessionCount > 0).
 */
async function seedShortUProgress(
  page: import('@playwright/test').Page,
): Promise<void> {
  await seedLocalStorage(page, {
    progress: buildSeedProgress({
      skillLevelOverrides: {
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'mastered',
        'cvc-words-short-o': 'mastered',
        'cvc-words-short-u': 'practicing',
      },
      // Greenfield short-u (ticket 86c9q9ben — AC9f): Marian has
      // mastered every prior word-song tier but has NOT yet
      // encountered cvc-words-short-u. The migration default would
      // infer her practicing-on-short-u state as already-encountered;
      // we override to `[]` (excluding short-u) so the first session
      // sees the contrast-line opener via the gate. Tests 1-7 don't
      // assert on opener content so the gate state is invisible to
      // them; test 8 (greenfield first-encounter) explicitly verifies
      // the gate behavior.
      lifetimeFirstEncounters: [
        // Earlier mastered tiers stay seeded as already-encountered
        // — they would have triggered any earlier first-encounter
        // scaffolding before we got here.
        'letter-names',
        'letter-sounds',
        'blending-cv',
        'cvc-words',
        'cvc-words-short-o',
        // cvc-words-short-u is intentionally absent — first encounter.
      ],
    }),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

/**
 * Skip helper for tests that depend on the read-aloud effect firing.
 * WebKit headless has no AudioContext — same harness limitation as
 * the short-a / short-o sibling specs.
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

test.describe('cvc-words-short-u flow regression (ticket 86c9q9ben)', () => {
  test.beforeEach(async ({ page }) => {
    await seedShortUProgress(page)
  })

  test('1. Seeded progress mounts Hub directly with cvc-words-short-o mastered + short-u current; idle Emma visible, no celebration', async ({
    page,
  }) => {
    await installCvcWordsShortUClaudeMock(page)
    await page.goto('/')

    // Splash auto-advances. With sessionCount=5 from the seeded
    // session history, `nextAfterSplash()` routes us to Hub (not Greet).
    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Greet must NOT be on screen — proves the session-history seed
    // bumped sessionCount past the Greet gate.
    await expect(page.getByTestId('greet')).toHaveCount(0)

    // Word-song path-strip projection. With every node up to and
    // including `cvc-words-short-o` `mastered`, `pickFocusNode()`
    // returns `cvc-words-short-u` → focus index = 5 in
    // `WORD_SONG_NODES_IN_ORDER`. Expected slice + projection are
    // derived from the canonical node list — no hardcoded stage
    // counts. Future tier insertions update only the helper shim.
    const focusIndex = WORD_SONG_NODES_IN_ORDER.indexOf('cvc-words-short-u')
    const { items: expectedSlice, offset: expectedOffset } = slidingWindow(
      WORD_SONG_NODES_IN_ORDER,
      focusIndex,
      1,
      3,
    )
    const expectedProjection = projectExpectedCells(
      expectedSlice,
      expectedOffset,
      focusIndex,
    )

    const wordSongStrip = page.locator(
      '[data-testid="hub-path-strip"][data-tree="word-song"]',
    )
    await expect(wordSongStrip).toBeVisible()
    const wordSongCells = wordSongStrip.locator(
      '[data-testid="hub-path-strip-cell"]',
    )
    await expect(wordSongCells).toHaveCount(expectedSlice.length)

    const wordSongProjection = await wordSongCells.evaluateAll((nodes) =>
      nodes.map((n) => ({
        stage: (n as HTMLElement).getAttribute('data-stage'),
        kind: (n as HTMLElement).getAttribute('data-kind'),
      })),
    )
    expect(wordSongProjection).toEqual(expectedProjection)

    // No pendingPromotion seeded → celebration overlay must NOT render.
    await expect(page.getByTestId('hub-promotion-celebration')).toHaveCount(0)
    await expect(page.getByTestId('hub-promotion-emma')).toHaveCount(0)

    // Idle Emma IS on screen.
    await expect(page.getByTestId('hub-emma')).toHaveCount(1)
  })

  test('2. Tapping Word Song fires planner request with progress.focusNode === "cvc-words-short-u"', async ({
    page,
  }) => {
    const { requests } = await installCvcWordsShortUClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // WordSong mounts — proves the planner fetch resolved (short-u
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

    const progressBlock = payload.progress as Record<string, unknown>
    expect(progressBlock).toBeDefined()
    expect(progressBlock.focusNode).toBe('cvc-words-short-u')
  })

  test('3. Read-line caption renders ["Read", "the", "<word>."] with a valid short-u target', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortUClaudeMock(page)
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
    expect(VALID_SHORT_U_WORDS.has(target)).toBe(true)

    const reconstructed = tokens.join(' ')
    expect(reconstructed).toMatch(/^Read the \w+\.$/)
  })

  test('4. Three chips render; one has data-correct="true" matching the read-line word; the other two are valid short-u distractors', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortUClaudeMock(page)
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

    const wordCard = page.getByTestId('word-song-word-card')
    await expect(wordCard).toBeVisible()
    const targetWord = await wordCard.getAttribute('data-word')
    expect(targetWord).not.toBeNull()
    expect(VALID_SHORT_U_WORDS.has(targetWord!)).toBe(true)

    const chips = page.getByTestId('word-song-chip')
    await expect(chips).toHaveCount(3)

    const correctChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChip).toHaveCount(1)
    await expect(correctChip).toHaveAttribute('data-word', targetWord!)

    // Two distractors with valid `data-word` attributes drawn from
    // the short-u pool. Each must be (a) non-null, (b) NOT the
    // target, (c) unique, AND (d) a member of VALID_SHORT_U_WORDS.
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
      expect(VALID_SHORT_U_WORDS.has(w as string)).toBe(true)
    }
    expect(new Set(distractorWords).size).toBe(2)
  })

  test('5. Tapping the correct chip advances to problem index 1 and re-flips read-aloud-played to true', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortUClaudeMock(page)
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

    await expect(wordSong).toHaveAttribute('data-problem-index', '1', {
      timeout: 15_000,
    })
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 15_000,
    })
  })

  test('6. Walking 8 correct chips lands on SessionEnd with non-zero stardust', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortUClaudeMock(page)
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

    const totalAttr = await sessionEnd.getAttribute('data-total-stardust')
    const total = Number(totalAttr)
    expect(Number.isFinite(total)).toBe(true)
    expect(total).toBeGreaterThanOrEqual(1)
  })

  test('7. Progress history records cvc-words-short-u as the focus of the just-completed session', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortUClaudeMock(page)
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
    expect(lastEntry.skillFocus[0]).toBe('cvc-words-short-u')
  })

  /**
   * Same-vowel-only distractor policy lock-in (current behaviour;
   * ticket `86c9m3aek` will be the OPT-IN to cross-vowel mixing).
   *
   * Per `design/word-song/short-u-pool-expansion.md` §8 with Thomas's
   * 2026-05-09 lock (Q4=B): every distractor for a short-u target is
   * drawn from the short-u pool itself (`sun, cup, bus, bug, nut,
   * tub, bun, jug, rug, hut, gum`). No cross-vowel mixing in v1.
   * This test walks the full 8-problem session, collects every chip's
   * `data-word` across every render, and asserts:
   *
   *   - All collected words are members of `VALID_SHORT_U_WORDS`.
   *   - Zero overlap with `NON_SHORT_U_POOL` (short-a + short-o
   *     targets + the `pen` distractor-only entry).
   *
   * If `86c9m3aek` later opts in to cross-vowel distractors, that PR
   * will need to update this assertion alongside the picker change —
   * exactly the regression-guard semantics we want.
   */
  test('8. Distractor pool is same-vowel only — zero short-a / short-o leakage across all 8 problems', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortUClaudeMock(page)
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

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

      const correctChip = page.locator(
        '[data-testid="word-song-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()
    }

    // Sanity: 24 total chip renders (3 chips × 8 problems), 8
    // targets, 16 distractors. Count-based assertions per
    // feedback_count_assertions_on_regression_tests.md.
    expect(allChipWords).toHaveLength(24)
    expect(allTargetWords).toHaveLength(8)
    expect(allDistractorWords).toHaveLength(16)

    // Every chip word — target AND distractor — must be in the
    // short-u pool. Compute the off-pool intersection explicitly and
    // assert it equals []; gives a useful failure message (which
    // words leaked).
    const offPoolWords = allChipWords.filter((w) => !VALID_SHORT_U_WORDS.has(w))
    expect(offPoolWords).toEqual([])

    // Belt-and-braces: zero overlap with the non-short-u pool
    // (short-a + short-o + remaining distractor-only).
    const otherVowelOverlap = allChipWords.filter((w) =>
      NON_SHORT_U_POOL.has(w),
    )
    expect(otherVowelOverlap).toEqual([])

    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
  })

  /**
   * Lifetime-first-encounter gate (ticket 86c9q9ben — AC9g).
   *
   * Greenfield Marian seeded with `cvc-words-short-u: 'practicing'`
   * AND `lifetimeFirstEncounters: []` (no prior tier-encounters
   * recorded — true cold-start) ships an empty list on the
   * session-start request → server sees the focus node is NOT in
   * the list → first-encounter posture, contrast-line opener
   * delivered as canon ships it. Second session simulates the
   * post-first-session state by seeding `lifetimeFirstEncounters:
   * ['cvc-words-short-u']` directly → server rewrites to vanilla.
   *
   * Why this is two browser contexts (not one walk-through-and-walk-back)
   * --------------------------------------------------------------------
   * The session-start request fires once when WordSong mounts (via
   * `prepareWordSongPathA`). On a single browser, the ONLY time we
   * see the gate fire is the first time WordSong mounts in that
   * page lifecycle. Re-mounting WordSong in the same browser would
   * require navigating Hub → WordSong → SessionEnd → Hub →
   * WordSong, with the in-between session-end actually appending
   * `cvc-words-short-u` to lifetimeFirstEncounters. That works but
   * adds 30+ seconds of test runtime. Seeding the pre/post state in
   * separate contexts is simpler and faster. The "really walks
   * through a session" assertion is already covered by tests 6, 7
   * (which use the default seedShortUProgress that DOES fire first-
   * encounter via the empty-short-u list).
   */
  test('9. AC9g — first session ships empty short-u list (gate fires); pre-recorded second session ships short-u in list (gate does NOT fire)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // ── Step 1: First session — greenfield, gate fires ─────────────
    // Re-seed with an empty lifetimeFirstEncounters list to model
    // a true greenfield Marian (overrides the test.beforeEach seed).
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'mastered',
          'cvc-words-short-u': 'practicing',
        },
        lifetimeFirstEncounters: [],
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
    const { requests: firstRequests } =
      await installCvcWordsShortUClaudeMock(page)
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()
    await expect(page.getByTestId('word-song')).toBeVisible({
      timeout: 15_000,
    })

    expect(firstRequests).toHaveLength(1)
    const firstBody = JSON.parse(firstRequests[0]!.postData() ?? '{}') as {
      payload?: { progress?: { lifetimeFirstEncounters?: unknown } }
    }
    const firstList = firstBody.payload?.progress?.lifetimeFirstEncounters
    // The browser ships an array (always, when progress exists for
    // word-song). Greenfield = empty array.
    expect(Array.isArray(firstList)).toBe(true)
    expect(firstList).toEqual([])
    // Server's first-encounter gate sees `cvc-words-short-u` NOT in
    // [] → contrast line is delivered as canon ships it.

    // ── Step 2: Already-encountered — gate does NOT fire ───────────
    // Fresh page context; re-seed with cvc-words-short-u in the
    // list (post-first-session state). The browser ships the
    // populated list; the server's gate substitutes the vanilla
    // opener.
    await page.context().clearCookies()
    await page.evaluate(() => window.localStorage.clear())
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'mastered',
          'cvc-words-short-u': 'practicing',
        },
        lifetimeFirstEncounters: ['cvc-words-short-u'],
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 6 }),
    })
    // installCvcWordsShortUClaudeMock was already installed; the
    // existing route handler captures the new request.
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()
    await expect(page.getByTestId('word-song')).toBeVisible({
      timeout: 15_000,
    })

    // Two POSTs total now — the second carries the populated list.
    expect(firstRequests.length).toBeGreaterThanOrEqual(2)
    const secondBody = JSON.parse(
      firstRequests[firstRequests.length - 1]!.postData() ?? '{}',
    ) as {
      payload?: { progress?: { lifetimeFirstEncounters?: unknown } }
    }
    const secondList = secondBody.payload?.progress?.lifetimeFirstEncounters
    expect(Array.isArray(secondList)).toBe(true)
    expect(secondList).toEqual(['cvc-words-short-u'])
    // Server's first-encounter gate sees `cvc-words-short-u` IN the
    // list → vanilla "You did it!" opener substituted. Direct
    // assertion of the audio bytes is hard to do via Playwright's
    // mock-fulfill path (the canon mock returns the canon bytes
    // unmodified — the gate runs against the live server in
    // production but in this test the mock IS the server). Test
    // boundary: we verify the wire shape (browser ships the right
    // list); the server-side gate is exercised by
    // `api/_firstEncounterGate.test.ts` (vitest) where we can
    // assert the rewrite output directly.
  })
})
