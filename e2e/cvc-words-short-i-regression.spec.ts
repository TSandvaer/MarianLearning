/**
 * E2E regression spec — cvc-words-short-i session flow (ticket 86c9qdba4).
 *
 * Sibling to `cvc-words-short-u-regression.spec.ts` (PR #174, ticket
 * 86c9q9ben). The cvc-words-short-i sibling focus node sits between
 * `cvc-words-short-u` and `digraphs` in `WORD_SONG_NODES_IN_ORDER` —
 * the fourth vowel-tier sibling per
 * `design/word-song/short-i-pool-expansion.md` §2.
 *
 * What this spec locks
 * --------------------
 * Eight tests mirroring the short-u suite. Tests 1-7 cover flow-level
 * coverage (debug-seed routing, planner request shape, read-line
 * caption, chip render, advance, 8-tap walk, focus persistence). Test
 * 8 locks the same-vowel-only distractor policy
 * (`design/word-song/short-i-pool-expansion.md` §8). Cross-vowel mixing
 * for short-i is filed as a follow-up to ticket `86c9m3aek` and is
 * intentionally OUT of scope until that ticket lands — the spec lock
 * forces any future cross-vowel work to explicitly OPT IN to mixing
 * rather than letting it leak in silently.
 *
 * Note on first-encounter scaffolding
 * -----------------------------------
 * Per the dispatch contract for ticket 86c9qdba4, the lifetime-first-
 * encounter gate (and the `/i/` vs `/ɪ/` minimal-pair contrast opener
 * Dave's research recommends per
 * `design/research/short-u-minimal-pair-and-future-vowel-openers.md`
 * §3.1) is OUT OF SCOPE for this PR. The canon ships with the vanilla
 * `"You did it!"` opener; `cvc-words-short-i` is NOT in
 * `FIRST_ENCOUNTER_GATED_NODES`. A follow-up ticket (TBD — Matt to file)
 * lands the contrast opener and the gate together. This spec therefore
 * does NOT mirror short-u's test 9 (AC9g first-encounter gate) — when
 * the follow-up ships, that spec gets its own AC.
 *
 * Mock strategy
 * -------------
 * Sibling `installCvcWordsShortIClaudeMock` returns the bytes of
 * `public/canon/word-song/level-1/cvc-words-short-i.json`. Reusing the
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
 * Same harness limitation as the short-a / short-o / short-u siblings
 * — WebKit headless has no AudioContext, so the read-aloud effect's
 * `getHowlerRunningFn()` predicate stays false forever and chips
 * never enable. Tests that don't depend on the read-aloud completing
 * run on BOTH chromium AND webkit (1, 2). Tests that need the
 * read-aloud to fire (3-8) are chromium-only. Real iPad Safari is
 * unaffected.
 *
 * Note on canon authority
 * -----------------------
 * The canon's 8 short-i targets — pig, pin, bin, wig, bib, fig, lid,
 * sip — are the source of truth for `VALID_SHORT_I_WORDS`. They mirror
 * (and must stay in sync with) the `vowel: 'i'` entries in
 * `src/screens/WordSong/wordPack.ts` `TARGET_WORDS`. Phase-2 voluntary
 * drop: `hip` and `rim` removed from the recommended 11-word pool for
 * vocab unfamiliarity (rosehip + bicycle wheel rim were both Phase-2-
 * flagged in the spec audit). The planner emits 8-of-8 in any single
 * session per the "8 distinct" rule, so `VALID_SHORT_I_WORDS` is the
 * full ship pool — observed targets are a subset (or full) of it.
 *
 * Note on test 7 (focusNode persistence)
 * --------------------------------------
 * Same caveat as the short-o / short-u siblings — the focus lives on
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
// both flagged the pattern on PR #174 review). Helper unit tests live
// at `e2e/_helpers/slidingWindow.test.ts`.
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
const CVC_WORDS_SHORT_I_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/cvc-words-short-i.json',
)

/**
 * The 8 short-i targets shipped in the canon. Source of truth for
 * read-line / chip-target membership checks. Must stay aligned with
 * `vowel: 'i'` entries in `wordPack.ts` `TARGET_WORDS`.
 */
const VALID_SHORT_I_WORDS: ReadonlySet<string> = new Set([
  'pig',
  'pin',
  'bin',
  'wig',
  'bib',
  'fig',
  'lid',
  'sip',
])

/**
 * The non-short-i pool — short-a + short-o + short-u targets + the
 * remaining `pen` distractor-only entry. Used by test 8 to assert NO
 * non-short-i word leaks into a short-i session's chip render under
 * the current same-vowel-only distractor policy
 * (`design/word-song/short-i-pool-expansion.md` §8). If a future
 * ticket (`86c9m3aek` follow-up) opts in to cross-vowel mixing for
 * short-i, that ticket will need to update this assertion alongside
 * the picker change.
 */
const NON_SHORT_I_POOL: ReadonlySet<string> = new Set([
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
  // Short-u target words (sun/cup/bus moved to short-u targets per
  // 86c9q9ben Q2=A).
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
  // Distractor-only — short-e flavoured.
  'pen',
])

/**
 * Install a /api/claude mock that returns the cvc-words-short-i canon
 * on word-song requests, captures every observed request body for
 * planner contract assertions. Math (or any other) requests are
 * intentionally rejected with 500 — the cvc-words-short-i flow only
 * triggers a word-song fetch; a stray math request would mean the
 * spec's invariants are wrong, and we'd rather see a loud error than
 * a silent pass.
 */
async function installCvcWordsShortIClaudeMock(
  page: import('@playwright/test').Page,
): Promise<{ requests: Request[] }> {
  const canonBody = readFileSync(CVC_WORDS_SHORT_I_CANON_PATH, 'utf-8')
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
        message: `cvc-words-short-i spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

/**
 * Seed the persisted Progress + SessionHistory blobs so the App
 * routes Splash → Hub directly with `cvc-words-short-i` as the picked
 * focus node.
 *
 *  - Every word-song node before short-i must be `mastered` so
 *    `pickFocusNode()` walks the track and stops at
 *    `cvc-words-short-i`.
 *  - `cvc-words-short-i` is bumped to `practicing` (the
 *    post-short-u-promotion state Marian is in).
 *  - SessionHistory `sessionCount: 5` skips Greet (Splash advances
 *    direct to Hub when sessionCount > 0).
 */
async function seedShortIProgress(
  page: import('@playwright/test').Page,
): Promise<void> {
  await seedLocalStorage(page, {
    progress: buildSeedProgress({
      skillLevelOverrides: {
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'mastered',
        'cvc-words-short-o': 'mastered',
        'cvc-words-short-u': 'mastered',
        'cvc-words-short-i': 'practicing',
      },
    }),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

/**
 * Skip helper for tests that depend on the read-aloud effect firing.
 * WebKit headless has no AudioContext — same harness limitation as
 * the prior sibling specs.
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

test.describe('cvc-words-short-i flow regression (ticket 86c9qdba4)', () => {
  test.beforeEach(async ({ page }) => {
    await seedShortIProgress(page)
  })

  test('1. Seeded progress mounts Hub directly with cvc-words-short-u mastered + short-i current; idle Emma visible, no celebration', async ({
    page,
  }) => {
    await installCvcWordsShortIClaudeMock(page)
    await page.goto('/')

    // Splash auto-advances. With sessionCount=5 from the seeded
    // session history, `nextAfterSplash()` routes us to Hub (not Greet).
    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Greet must NOT be on screen — proves the session-history seed
    // bumped sessionCount past the Greet gate.
    await expect(page.getByTestId('greet')).toHaveCount(0)

    // Word-song path-strip projection. With every node up to and
    // including `cvc-words-short-u` `mastered`, `pickFocusNode()`
    // returns `cvc-words-short-i` → focus index = 6 in
    // `WORD_SONG_NODES_IN_ORDER`. Expected slice + projection are
    // derived from the canonical node list — no hardcoded stage
    // counts.
    const focusIndex = WORD_SONG_NODES_IN_ORDER.indexOf('cvc-words-short-i')
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

  test('2. Tapping Word Song fires planner request with progress.focusNode === "cvc-words-short-i"', async ({
    page,
  }) => {
    const { requests } = await installCvcWordsShortIClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // WordSong mounts — proves the planner fetch resolved (short-i
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
    expect(progressBlock.focusNode).toBe('cvc-words-short-i')
  })

  test('3. Read-line caption renders ["Read", "the", "<word>."] with a valid short-i target', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortIClaudeMock(page)
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
    expect(VALID_SHORT_I_WORDS.has(target)).toBe(true)

    const reconstructed = tokens.join(' ')
    expect(reconstructed).toMatch(/^Read the \w+\.$/)
  })

  test('4. Three chips render; one has data-correct="true" matching the read-line word; the other two are valid short-i distractors', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortIClaudeMock(page)
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
    expect(VALID_SHORT_I_WORDS.has(targetWord!)).toBe(true)

    const chips = page.getByTestId('word-song-chip')
    await expect(chips).toHaveCount(3)

    const correctChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChip).toHaveCount(1)
    await expect(correctChip).toHaveAttribute('data-word', targetWord!)

    // Two distractors with valid `data-word` attributes drawn from
    // the short-i pool. Each must be (a) non-null, (b) NOT the
    // target, (c) unique, AND (d) a member of VALID_SHORT_I_WORDS.
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
      expect(VALID_SHORT_I_WORDS.has(w as string)).toBe(true)
    }
    expect(new Set(distractorWords).size).toBe(2)
  })

  test('5. Tapping the correct chip advances to problem index 1 and re-flips read-aloud-played to true', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortIClaudeMock(page)
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
    await installCvcWordsShortIClaudeMock(page)
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

  test('7. Progress history records cvc-words-short-i as the focus of the just-completed session', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortIClaudeMock(page)
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
    expect(lastEntry.skillFocus[0]).toBe('cvc-words-short-i')
  })

  /**
   * Same-vowel-only distractor policy lock-in (current behaviour;
   * follow-up to ticket `86c9m3aek` will be the OPT-IN to cross-vowel
   * mixing for short-i).
   *
   * Per `design/word-song/short-i-pool-expansion.md` §8 with Thomas's
   * 2026-05-09 Phase-2 lock: every distractor for a short-i target is
   * drawn from the short-i pool itself (`pig, pin, bin, wig, bib, fig,
   * lid, sip`). No cross-vowel mixing in v1. This test walks the full
   * 8-problem session, collects every chip's `data-word` across every
   * render, and asserts:
   *
   *   - All collected words are members of `VALID_SHORT_I_WORDS`.
   *   - Zero overlap with `NON_SHORT_I_POOL` (short-a + short-o +
   *     short-u targets + the `pen` distractor-only entry).
   *
   * If a future cross-vowel mixing ticket later opts in to cross-vowel
   * distractors for short-i, that PR will need to update this assertion
   * alongside the picker change — exactly the regression-guard
   * semantics we want.
   */
  test('8. Distractor pool is same-vowel only — zero short-a / short-o / short-u leakage across all 8 problems', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installCvcWordsShortIClaudeMock(page)
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
    // short-i pool. Compute the off-pool intersection explicitly and
    // assert it equals []; gives a useful failure message (which
    // words leaked).
    const offPoolWords = allChipWords.filter((w) => !VALID_SHORT_I_WORDS.has(w))
    expect(offPoolWords).toEqual([])

    // Belt-and-braces: zero overlap with the non-short-i pool
    // (short-a + short-o + short-u + remaining distractor-only).
    const otherVowelOverlap = allChipWords.filter((w) =>
      NON_SHORT_I_POOL.has(w),
    )
    expect(otherVowelOverlap).toEqual([])

    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
  })
})
