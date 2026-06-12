/**
 * E2E spec — sight-words CONTENT round-trip + recognition-mechanic render.
 *
 * Ticket: 86ca7xmn5 (W11-04). Wave 11 sight-words content tier.
 *   Paired with Kevin's content PR (W11-02, ticket 86ca7xmr8) and
 *   Devon's render PR (W11-03, ticket 86ca7xmvz). Pedagogy gate:
 *   `design/research/sight-words-sequence-marian.md` (Dave, W11-01,
 *   merged in PR #380). Plan: `design/wave-11-sight-words-plan.md`.
 *
 * WHAT THIS SPEC PINS
 * -------------------
 * Two failing-first levers, both RED on current `main`:
 *
 *   1. CONTENT round-trip (test 1): the `/api/claude` mock serves the
 *      bytes of the on-disk sight-words canon. That canon file does NOT
 *      exist on `main` yet, so the mock-install throws an explicit
 *      ENOENT — the RED signal. Post-merge: the canon carries
 *      sight-words target words, and the seeded session fires exactly
 *      one planner request whose body carries
 *      `progress.focusNode === 'sight-words'` (a POSITIVE request-body
 *      discriminator per `testing-and-ci.md` §4.1.1e — NOT a
 *      negative-membership chip assertion).
 *
 *   2. RENDER mechanic (test 3): the sight-words recognition mechanic
 *      Dave specified is audio-first WRITTEN-WORD matching — Emma speaks
 *      the target, Marian taps the matching WRITTEN chip among 3
 *      written-word alternatives. Crucially:
 *        - NO picture chips for the target (`word-song-word-picture`
 *          must be ABSENT; the CVC/blending-cv tiers render it).
 *        - The chips present the written word as TEXT (the target word
 *          string is visible chip text), NOT a `<WordPicture>` SVG.
 *        - NO silent decoding beat (the 1500ms `SILENT_TEXT_WINDOW_MS`
 *          gate that `cvc-word` content uses is wrong for whole-word
 *          recognition — sounding out "was" by GPC rules yields the
 *          non-word /wæs/; see Dave §"Recognition mechanic" point 2).
 *
 * WHY RED ON BASE (the failing-first contract)
 * --------------------------------------------
 * On `main`, `sight-words` is a STUB tier: the `SkillNode` literal +
 * picker order + tree exist (PR #217-era infra), but the planner's
 * `effectiveFocusNode` demotes `sight-words` → `blending-cv` content
 * (`api/_planner.ts` — `WORD_SONG_FIRST_CLASS_FOCUS_NODES` stops before
 * sight-words). And there is NO sight-words canon JSON on disk. So:
 *   - test 1 throws ENOENT at mock-install (canon file missing).
 *   - test 3, if it ran the blending-cv stub, would render a
 *     `word-song-word-picture` picture card + `<WordPicture>` picture
 *     chips — exactly the mechanic Dave's research rules OUT. The
 *     render assertions therefore FAIL on base for the right reason.
 *
 * WHY IT CAN BE MADE GREEN (credible green path)
 * ----------------------------------------------
 * test 1 is additionally run against a HAND-MOCKED sight-words plan
 * shape (test 2) — proving the positive request-body discriminator +
 * pool-membership assertion go GREEN the moment a real plan is served,
 * independent of whether the on-disk canon exists. This demonstrates the
 * spec is not just verifiable-RED but credibly-makeable-GREEN
 * (`feedback_failing_first_must_prove_green`): the assertion lever is
 * satisfiable against a real served plan, not structurally impossible.
 * Post-merge, Kevin's canon bake creates the on-disk file and test 1
 * flips GREEN against the real canon bytes; Devon's render PR flips
 * test 3 GREEN.
 *
 * TRAP AVOIDANCE (testing-and-ci.md §4.1.1d/e)
 * --------------------------------------------
 * This spec does NOT combine `failNetwork: true` with negative-
 * membership assertions (the trivially-green trap). It serves a real
 * sight-words plan and asserts POSITIVE discriminators against the
 * captured request body (`focusNode === 'sight-words'`) and the served
 * plan's target words (pool membership). The render test asserts the
 * mechanic is PRESENT (written-word chips), not merely that a bad value
 * is absent.
 *
 * COUNT-ASSERTION DISCIPLINE
 * --------------------------
 * Per `feedback_count_assertions_on_regression_tests`: `.toEqual([...])`
 * / `.toBe(N)` / `.toHaveLength(N)`. The single `.toContain` use is on a
 * chip's full text content (membership of the target substring within
 * the chip's rendered text), where the SET (the chip text) is the
 * contract — the permitted membership-in-set exception, not an
 * appears-at-least-once-in-array regression assertion.
 *
 * WEBKIT SKIP
 * -----------
 * WebKit headless has no AudioContext → the read-aloud effect's
 * `getHowlerRunningFn()` predicate stays false forever and chips never
 * enable. Pure payload assertions (tests 1, 2) run on BOTH engines; the
 * chip-UI walk (test 3) is chromium-only. Real iPad Safari is
 * unaffected.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * Path to the sight-words session canon. Resolved relative to
 * `process.cwd()` (Playwright runs the harness from the worktree root,
 * same place `vite preview` reads `public/`).
 *
 * On current `main` this file does NOT exist — that absence IS the
 * failing-first signal (see header). Kevin's content PR + canon bake
 * (W11-02) create it.
 */
const SIGHT_WORDS_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/sight-words.json',
)

/**
 * The sight-words starter pool. Source of truth:
 * `design/research/sight-words-sequence-marian.md` §"Which words —
 * recommended set" (Batch 1 + Batch 2). Note `I` is uppercase (the
 * pronoun). The canon's served targets must all be drawn from this set;
 * a `blending-cv` stub fallback would serve CVC words (`cat`, `bag`,
 * ...) which are NOT in this set, surfacing the demote.
 *
 * Kevin's W11-02 content PR may ship a subset of this pool for the
 * first wave (Dave recommends ~2 new per session over a 10-session
 * rollout). The membership assertion below tolerates any subset — it
 * asserts every SERVED target is IN this pool, not that the whole pool
 * appears. Widen this set only if W11-02 ships a target outside Dave's
 * recommended list (which would itself be a pedagogy-gate violation
 * worth flagging, not silently accommodating).
 */
const SIGHT_WORDS_POOL: ReadonlySet<string> = new Set([
  // Batch 1 — Pre-Primer function words.
  'the',
  'a',
  'i',
  'is',
  'it',
  'in',
  'to',
  'go',
  'no',
  'do',
  // Batch 2 — Primer / Grade-1 function words and common verbs.
  'was',
  'see',
  'said',
  'he',
  'she',
  'we',
  'for',
  'on',
  'not',
  'can',
])

/** Minimal shape of the on-disk session canon this spec inspects. */
interface CanonUtterance {
  id: string
  text: string
}
interface CanonShape {
  ok: boolean
  kind: string
  plan: { id: string; label: string; utterances: CanonUtterance[] }
  utterances: Array<{ id: string; text: string }>
}

/**
 * Read + parse the sight-words canon from disk.
 *
 * On current `main` the file does NOT exist — `existsSync` is false and
 * this throws an explicit, attributable message so the RED state reads
 * unambiguously in CI logs: this is the failing-first signal, not an
 * infra flake. Post-merge (Kevin's W11-02 PR + canon bake) the file
 * exists and this resolves cleanly.
 */
function readSightWordsCanon(): { raw: string; parsed: CanonShape } {
  if (!existsSync(SIGHT_WORDS_CANON_PATH)) {
    throw new Error(
      `[sight-words-content spec] FAILING-FIRST: sight-words canon not ` +
        `found at ${SIGHT_WORDS_CANON_PATH}. This is the expected RED ` +
        `state on pre-merge main — the sight-words content does not exist ` +
        `yet (the planner demotes sight-words → blending-cv stub). The ` +
        `spec flips GREEN when Kevin's W11-02 content PR (ticket ` +
        `86ca7xmr8) merges and the canon bake commits this file.`,
    )
  }
  const raw = readFileSync(SIGHT_WORDS_CANON_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as CanonShape
  return { raw, parsed }
}

/**
 * Extract the per-problem target word from a canon's `plan.utterances`
 * array. Dave's recognition mechanic (W11-01 §"Recommended mechanic")
 * has Emma speak the target in a carrier sentence for the gentle phase
 * ("The cat is here. Find: the.") and the bare word for the trap phase
 * ("Was."). The read-slot template is therefore NOT the CVC
 * "Read the <word>." shape — so this parser pulls the target from the
 * `correct` slot ("Yes! <Word>.") which is stable across both phases
 * and mirrors the CVC `correct` convention.
 *
 * If Kevin's W11-02 canon uses a different stable target encoding, this
 * helper is the one place to adjust — the assertion semantics (every
 * target ∈ pool) are unchanged.
 */
function targetWordsByProblem(canon: CanonShape): Map<number, string> {
  const byProblem = new Map<number, string>()
  for (const u of canon.plan.utterances) {
    const m = u.id.match(/^word\.p(\d+)\.correct$/)
    if (m === null) continue
    const problemNum = Number(m[1])
    // "Yes! The." / "Yes! Was." — pull the word, strip trailing period.
    const wordMatch = u.text.match(/^Yes!\s+([A-Za-z]+)\.?$/)
    if (wordMatch === null) {
      throw new Error(
        `[sight-words-content spec] canon correct-slot text did not match ` +
          `"Yes! <Word>." template: id=${u.id} text=${JSON.stringify(u.text)}`,
      )
    }
    byProblem.set(problemNum, wordMatch[1]!.toLowerCase())
  }
  return byProblem
}

/**
 * Build a hand-mocked sight-words session plan that mirrors the wire
 * shape Kevin's W11-02 canon will produce. Used by test 2 to prove the
 * positive request-body + pool-membership assertions are CREDIBLY
 * MAKEABLE-GREEN against a real served plan — independent of whether the
 * on-disk canon exists yet (`feedback_failing_first_must_prove_green`).
 *
 * Targets are drawn from `SIGHT_WORDS_POOL` (Dave's Batch 1). The
 * `read` slot uses the carrier-sentence / bare-word phase split; the
 * `correct` slot uses the stable "Yes! <Word>." encoding the on-disk
 * canon is expected to share.
 */
const HAND_MOCK_TARGETS: ReadonlyArray<string> = [
  'the',
  'a',
  'is',
  'it',
  'go',
  'no',
  'to',
  'do',
]

function handMockedSightWordsPlan(): CanonShape {
  const utterances: CanonUtterance[] = []
  HAND_MOCK_TARGETS.forEach((word, i) => {
    const n = i + 1
    const cap = word[0]!.toUpperCase() + word.slice(1)
    // Gentle phase (1-3): carrier sentence. Trap phase (4-8): bare word.
    const read = n <= 3 ? `Here is a word. Find: ${word}.` : `${cap}.`
    utterances.push(
      { id: `word.p${n}.read`, text: read },
      { id: `word.p${n}.correct`, text: `Yes! ${cap}.` },
      { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
      { id: `word.p${n}.hint`, text: `Look. ${cap}.` },
      { id: `word.p${n}.giveAnswer`, text: `This one is ${word}.` },
    )
  })
  return {
    ok: true,
    kind: 'session-start',
    plan: {
      id: 'sight-words-warm-up',
      label: 'Sight words — warm up',
      utterances,
    },
    utterances: utterances.map((u) => ({ id: u.id, text: u.text })),
  }
}

/**
 * Install a `/api/claude` mock and capture every observed request body.
 * `canonBody` is the JSON string served on word-song requests — resolved
 * EAGERLY by the caller BEFORE install, so an on-disk-canon read throws
 * its ENOENT failing-first error here (pre-navigation), giving a clean,
 * attributable RED on base rather than a murky hub-not-visible timeout
 * when the route handler throws mid-fetch. Mirrors the proven
 * `digraphs-sh-content.spec.ts` `installDigraphsShClaudeMock` pattern.
 * Math (or any other) track is rejected 500 so a stray request fails
 * loudly rather than passing silently.
 */
async function installSightWordsClaudeMock(
  page: Page,
  canonBody: string,
): Promise<{ requests: Request[] }> {
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
        message: `sight-words-content spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

/**
 * Seed the persisted Progress + SessionHistory blobs so the App routes
 * Splash → Hub directly with `sight-words` as the picked focus node.
 *
 *  - Every word-song node before `sight-words` must be `'mastered'` so
 *    `pickFocusNode()` walks the track and stops at `sight-words`. The
 *    three digraph siblings (sh / ch / th-voiceless) are the immediate
 *    predecessors post-PR-#211 split.
 *  - `sight-words` is bumped to `'practicing'` (the post-digraph-mastery
 *    state Marian is in once she reaches the sight-words tier).
 *  - SessionHistory `sessionCount: 5` skips Greet (Splash advances
 *    direct to Hub when sessionCount > 0).
 *
 * `skillLevelOverrides` is typed `Record<string, string>` and accepts
 * the `sight-words` literal (already canonical in the `SkillNode` union
 * on main — the failing-first signal here is the missing CANON +
 * RENDER mechanic, not a missing node literal). See
 * `testing-and-ci.md` §4.1.1a.
 */
async function seedSightWordsProgress(page: Page): Promise<void> {
  await seedLocalStorage(page, {
    progress: buildSeedProgress({
      skillLevelOverrides: {
        'letter-names': 'mastered',
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'mastered',
        'cvc-words-short-o': 'mastered',
        'cvc-words-short-u': 'mastered',
        'cvc-words-short-i': 'mastered',
        'cvc-words-short-e': 'mastered',
        'digraphs-sh': 'mastered',
        'digraphs-ch': 'mastered',
        'digraphs-th-voiceless': 'mastered',
        'sight-words': 'practicing',
        'simple-sentences': 'locked',
      },
    }),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

/**
 * Skip helper for tests that depend on the read-aloud effect firing.
 * WebKit headless has no AudioContext — same harness limitation as the
 * cvc / digraph regression siblings.
 */
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud effect cannot fire. Production iPad Safari works fine; this is a harness limitation. Tests 1 + 2 (payload assertions) cover the content round-trip on webkit.',
  )
}

test.describe('sight-words content round-trip + recognition mechanic (W11-04)', () => {
  test.beforeEach(async ({ page }) => {
    await seedSightWordsProgress(page)
  })

  /**
   * TEST 1 — CONTENT round-trip against the on-disk canon.
   *
   * CLASSIFICATION: RED-on-base lever. The mock-install reads the
   * on-disk sight-words canon; on `main` that file is absent →
   * `readSightWordsCanon()` throws ENOENT and this test FAILS at setup
   * for the right reason (the content does not exist yet). Post-merge
   * (Kevin's W11-02 canon bake) the file exists and the assertions run.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit (does not
   * depend on chip enablement). Asserts:
   *   - The seeded `sight-words` session fires exactly one planner
   *     request whose body carries `progress.focusNode === 'sight-words'`
   *     (POSITIVE request-body discriminator — testing-and-ci.md
   *     §4.1.1e — proves the picker landed on sight-words and the wire
   *     carried it; NOT a negative-membership chip assertion).
   *   - The served canon has 8 problems.
   *   - Every target word is drawn from Dave's sight-words pool (so NO
   *     `blending-cv` CVC stub content leaked).
   */
  test('1. CONTENT: sight-words session fires a planner request with focusNode=sight-words and the on-disk canon carries 8 sight-words-pool targets', async ({
    page,
  }) => {
    // Read the on-disk canon EAGERLY — throws ENOENT on pre-merge main,
    // the failing-first RED signal (pre-navigation, clean message).
    const { requests } = await installSightWordsClaudeMock(
      page,
      readSightWordsCanon().raw,
    )
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // WordSong mounts — proves the planner fetch resolved and the parser
    // accepted the sight-words content.
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
    // POSITIVE discriminator — the picker chose sight-words and the wire
    // carried it. This is the load-bearing failing-first assertion.
    expect(progressBlock.focusNode).toBe('sight-words')

    // Inspect the on-disk canon payload directly.
    const { parsed: canon } = readSightWordsCanon()
    expect(canon.ok).toBe(true)
    expect(canon.kind).toBe('session-start')

    const byProblem = targetWordsByProblem(canon)
    // 8 problems per session — count-based assertion.
    expect(byProblem.size).toBe(8)

    // Every target word is in Dave's sight-words pool. Compute the
    // off-pool intersection explicitly so the failure message names
    // exactly which words leaked (catches the blending-cv stub fallback
    // — those CVC targets would NOT be in SIGHT_WORDS_POOL).
    const targetWords = [...byProblem.values()]
    const offPoolWords = targetWords.filter((w) => !SIGHT_WORDS_POOL.has(w))
    expect(offPoolWords).toEqual([])
  })

  /**
   * TEST 2 — MAKEABLE-GREEN proof against a hand-mocked plan.
   *
   * CLASSIFICATION: Trivially-green counter-test on base for the
   * request-body half, but it serves a REAL sight-words plan shape (not
   * `failNetwork`), so it proves the positive discriminators in test 1
   * are CREDIBLY makeable-green the moment a real plan is served —
   * independent of whether the on-disk canon file exists yet
   * (`feedback_failing_first_must_prove_green`). It does NOT read the
   * on-disk canon, so it runs (and passes) on pre-merge main, confirming
   * the assertion lever is satisfiable, not structurally impossible.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit.
   */
  test('2. MAKEABLE-GREEN: a served sight-words plan yields focusNode=sight-words on the wire and 8 in-pool targets (hand-mocked, no on-disk dependency)', async ({
    page,
  }) => {
    const handMock = handMockedSightWordsPlan()
    const { requests } = await installSightWordsClaudeMock(
      page,
      JSON.stringify(handMock),
    )
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()
    await expect(page.getByTestId('word-song')).toBeVisible({
      timeout: 15_000,
    })

    expect(requests).toHaveLength(1)
    const body = JSON.parse(requests[0]!.postData() ?? '{}') as Record<
      string,
      unknown
    >
    const payload = body.payload as Record<string, unknown>
    const progressBlock = payload.progress as Record<string, unknown>
    // Same positive discriminator as test 1 — green against a real plan.
    expect(progressBlock.focusNode).toBe('sight-words')

    // The served plan's 8 targets are all in-pool — the membership
    // assertion is satisfiable against a real plan (test 1's GREEN path).
    const byProblem = targetWordsByProblem(handMock)
    expect(byProblem.size).toBe(8)
    const offPoolWords = [...byProblem.values()].filter(
      (w) => !SIGHT_WORDS_POOL.has(w),
    )
    expect(offPoolWords).toEqual([])
  })

  /**
   * TEST 3 — RENDER mechanic: audio-first written-word matching.
   *
   * CLASSIFICATION: RED-on-base lever. On `main` a sight-words session
   * runs the `blending-cv` stub, which renders a `word-song-word-picture`
   * picture card and `<WordPicture>` SVG chips — exactly the mechanic
   * Dave's research rules OUT. So the assertions below FAIL on base for
   * the right reason. Devon's W11-03 render PR adds the sight-word
   * content-type branch (written-word text chips, no picture card, no
   * silent decoding beat) → GREEN.
   *
   * Asserts the recognition mechanic Dave specified:
   *   - NO picture card for the target (`word-song-word-picture` count
   *     = 0). The CVC/blending-cv tiers always render it; the
   *     sight-word mechanic must not.
   *   - Each chip presents the WRITTEN word as visible text — the
   *     chip's text content contains the chip's `data-word`. (On base,
   *     the chip renders a picture SVG with NO text node, so the chip's
   *     `innerText` is empty and this fails.)
   *   - 3 chips per problem; exactly one is the correct (target) chip,
   *     and its written word is a sight-words-pool word.
   *
   * Chromium-only — depends on the read-aloud effect firing to enable
   * chips.
   *
   * NOTE for Devon (W11-03): this spec deliberately asserts on the
   * MECHANIC-DEFINING observables (no picture card, chip text == word),
   * NOT on a specific new test-id, so it does not over-couple to the
   * exact DOM shape you pick. If you add a `word-song-chip-sight-word`
   * test-id mirroring the letter-tier `word-song-chip-letter` pattern,
   * that is welcome but not required by these assertions.
   */
  test('3. RENDER: sight-words chips present written words as text with NO picture card (audio-first whole-word matching mechanic)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // Single-session walk (~30-50s on the silent caption-walk fallback)
    // + setup. The default 90s budget is adequate for one session, but
    // give comfortable headroom on slow CI runners.
    test.setTimeout(120_000)

    // Read the on-disk canon EAGERLY — throws ENOENT on pre-merge main,
    // the failing-first RED signal (pre-navigation, clean message).
    await installSightWordsClaudeMock(page, readSightWordsCanon().raw)
    await page.goto('/')
    // NOTE: do NOT call forceHowlerUnlock here. This test serves real
    // on-disk canon MP3 bytes; forceHowlerUnlock's stubbed AudioContext
    // breaks the MP3 decode → prepareWordSongPathA throws → the App
    // silently demotes to the static blending-cv plan (picture card +
    // <WordPicture> chips render), making the render assertions below
    // unsatisfiable for the WRONG reason (audio-race, not missing
    // render). The canon-bytes + real-gesture-unlock chain + the
    // `data-read-aloud-played` gate below is the correct mechanism —
    // mirrors `digraphs-sh-content.spec.ts` test 3, which omits
    // forceHowlerUnlock for exactly this reason (testing-and-ci.md
    // §4.1.2 silent-demote caveat + §4.1.6).
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    const allChipWords: string[] = []
    const allTargetWords: string[] = []

    for (let i = 0; i < 8; i++) {
      await expect(wordSong).toHaveAttribute('data-problem-index', String(i), {
        timeout: 20_000,
      })
      await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
        timeout: 20_000,
      })

      // MECHANIC ASSERTION A — NO picture card for the target. The
      // blending-cv stub (base) renders exactly one; the sight-word
      // mechanic renders zero.
      await expect(page.getByTestId('word-song-word-picture')).toHaveCount(0)

      const chips = page.getByTestId('word-song-chip')
      await expect(chips).toHaveCount(3)

      // MECHANIC ASSERTION B — each chip presents the WRITTEN word as
      // visible text. Read each chip's `data-word` and its rendered
      // text content; the text must contain the word (membership-in-set
      // exception per count-assertion rules — the chip text IS the
      // contract). On base, the chip renders a picture SVG with no text
      // node → `innerText` empty → this fails for the right reason.
      const chipData = await chips.evaluateAll((nodes) =>
        nodes.map((n) => ({
          word: (n as HTMLElement).getAttribute('data-word'),
          text: ((n as HTMLElement).innerText || '').trim().toLowerCase(),
          correct: (n as HTMLElement).getAttribute('data-correct') === 'true',
        })),
      )
      expect(chipData).toHaveLength(3)
      for (const { word, text, correct } of chipData) {
        expect(word).not.toBeNull()
        const w = (word as string).toLowerCase()
        allChipWords.push(w)
        if (correct) allTargetWords.push(w)
        // The written word is visible as chip text.
        expect(text).toContain(w)
      }

      const correctChip = page.locator(
        '[data-testid="word-song-chip"][data-correct="true"]',
      )
      await expect(correctChip).toHaveCount(1)
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      const correctWord = (
        await correctChip.getAttribute('data-word')
      )?.toLowerCase()
      expect(correctWord).toBeDefined()
      // The correct chip's word is a sight-words-pool TARGET.
      expect(SIGHT_WORDS_POOL.has(correctWord!)).toBe(true)

      await correctChip.click()
    }

    // Count-based assertions: 24 chip renders (3 × 8), 8 targets.
    expect(allChipWords).toHaveLength(24)
    expect(allTargetWords).toHaveLength(8)

    // Every target word is in the sight-words pool.
    const offPoolTargets = allTargetWords.filter(
      (w) => !SIGHT_WORDS_POOL.has(w),
    )
    expect(offPoolTargets).toEqual([])

    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
  })
})
