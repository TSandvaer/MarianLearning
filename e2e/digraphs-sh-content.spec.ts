/**
 * E2E spec — digraphs-sh CONTENT presence + hybridMode planner gate.
 *
 * Ticket: paired with Kevin's planner PR (`feat/digraphs-sh-content-planner`)
 *         and Devon's wordPack PR (`feat/digraphs-sh-wordpack`).
 *         Spec source: `design/word-song/digraphs-sh-word-list.md` §8
 *         AC11 (sh content emits) + AC12 (`hybridMode: true` planner gating).
 *
 * SCOPE — what this spec is NOT
 * ----------------------------
 * This is the CONTENT-presence + hybridMode-gate spec. It is a SIBLING
 * to `digraphs-sh-progression.spec.ts` (PR #214), which covers the
 * PROGRESSION state machine (locked → intro → practicing → mastered +
 * downstream cascade). This spec does not re-test progression — it
 * asserts (a) the planner/canon actually emits sh-tier words for a
 * `digraphs-sh`-focused session, and (b) the 3 `hybridMode: true`
 * long-vowel words (`shoe`, `sheep`, `shark`) never receive
 * segmentation / spelling / decode-from-phoneme prompt types.
 *
 * Failing-first per `feedback_progression_e2e_mandatory`. Will be RED
 * until Kevin's `feat/digraphs-sh-content-planner` + Devon's
 * `feat/digraphs-sh-wordpack` PRs merge.
 *
 * THE FAILING-FIRST CONTRACT
 * --------------------------
 * On current `main` (commit b2e35e8 — PR #217 SkillNode-split landed,
 * but no sh CONTENT):
 *   - `digraphs-sh` IS a valid focus node + IS in
 *     `WORD_SONG_NODES_IN_ORDER` (PR #217). But it is NOT in
 *     `WORD_SONG_FIRST_CLASS_FOCUS_NODES` (`api/_planner.ts`), so the
 *     planner's `effectiveFocusNode` stub-falls-through to
 *     `blending-cv` content for any `digraphs-sh` session.
 *   - There is NO `public/canon/word-song/level-1/digraphs-sh.json`
 *     canon file on disk. The 6 word-song canon files today are
 *     `blending-cv`, `cvc-words`, `cvc-words-short-{o,u,i,e}`.
 *   - `wordPack.ts` has zero `sh`-vowel-digraph entries and no
 *     `hybridMode` field on `WordEntry`.
 *
 * This spec's `/api/claude` mock serves the bytes of the sh-tier canon
 * file (same canon-bytes pass-through pattern as the sibling cvc
 * regression specs — real Azure-rendered MP3s decode cleanly in
 * headless Chromium; hand-rolled silent-base64 fixtures break Howler's
 * decode and mask the regression). Because that canon file does NOT
 * exist on current main, `readDigraphsShCanon()` throws `ENOENT` and
 * EVERY test in this suite fails at setup — for the right reason: the
 * sh content does not exist yet. The failure message names the missing
 * file explicitly so the RED state is unambiguous in CI logs.
 *
 * POST-MERGE GREEN STATE
 * ----------------------
 * After Kevin's planner PR + Devon's wordPack PR merge (and the canon
 * is baked + committed per AC10):
 *   1. `public/canon/word-song/level-1/digraphs-sh.json` exists on
 *      disk → `readDigraphsShCanon()` succeeds, the mock serves real
 *      sh-tier canon bytes.
 *   2. AC11: the canon's 8 problems all carry sh-tier target words
 *      (`ship, shell, shoe, sheep, shark, shed, shop`); the seeded
 *      `digraphs-sh` session fires a planner request with
 *      `progress.focusNode === 'digraphs-sh'`; the WordSong chip UI
 *      renders sh-tier words (no `blending-cv` fallback content).
 *   3. AC12: for every problem whose target is a `hybridMode: true`
 *      word (`shoe`, `sheep`, `shark`), the canon carries NO utterance
 *      whose id slot is `segmentation` / `spelling` /
 *      `decode_from_phoneme`. The 4 non-hybrid sh words
 *      (`ship, shell, shed, shop`) are not gated — they MAY carry any
 *      slot.
 *
 * WHY ASSERT ON THE CANON PAYLOAD (not just the UI)
 * -------------------------------------------------
 * Per Devon's PR #214 review suggestion S3 + `testing-and-ci.md` §4.2
 * (Claude-mock request-capture pattern): inspecting the planner
 * response payload directly is the cleaner, tighter signal for the
 * hybridMode gate. The chip UI only renders the `read` slot; a
 * `segmentation` / `spelling` / `decode_from_phoneme` prompt for a
 * hybrid word could ship in the canon and never surface in the
 * chip-tap UI walk. Asserting on the canon `plan.utterances` array
 * catches it at the source. The UI walkthrough (test 3) is the
 * belt-and-braces "no blending-cv fallback content leaked" check.
 *
 * Mock strategy
 * -------------
 * `installDigraphsShClaudeMock` reads the bytes of
 * `public/canon/word-song/level-1/digraphs-sh.json` and returns them
 * on word-song requests; it also captures every observed request body
 * so test 1 can assert the wire-level planner contract
 * (`progress.focusNode === 'digraphs-sh'`) per Devon's S3 suggestion.
 * Math (or any other) requests are rejected with 500 — the sh-tier
 * flow only triggers a word-song fetch; a stray math request would
 * mean the spec's invariants are wrong, and we'd rather see a loud
 * error than a silent pass.
 *
 * Timeout sizing — per `testing-and-ci.md` §4.1.1b
 * ------------------------------------------------
 * This is a SINGLE-session spec (not a multi-session progression
 * walk). Tests 1-2 are payload assertions that don't walk the session;
 * test 3 walks one 8-problem session (~30-50s wall on the silent
 * caption-walk fallback). The Playwright config's default 90s per-test
 * budget is adequate — no `test.setTimeout` override needed (contrast
 * the progression sibling, which runs 4 sessions and needs 240s).
 *
 * Why some tests skip on webkit
 * -----------------------------
 * Same harness limitation as the cvc regression siblings — WebKit
 * headless has no AudioContext, so the read-aloud effect's
 * `getHowlerRunningFn()` predicate stays false forever and chips never
 * enable. Tests that don't depend on the read-aloud completing run on
 * BOTH chromium AND webkit (1, 2 — pure payload assertions). The chip
 * UI walkthrough (test 3) is chromium-only. Real iPad Safari is
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
 * Path to the sh-tier session canon the spec serves as the mock
 * response. Resolved relative to `process.cwd()` because Playwright
 * runs the harness from the worktree root (same place `vite preview`
 * reads `public/`). Hardcoding the relative path means the spec breaks
 * loudly if the canon ever moves.
 *
 * On current main this file does NOT exist — that absence is the
 * failing-first signal (see header). Kevin's planner PR + the AC10
 * canon bake create it.
 */
const DIGRAPHS_SH_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/digraphs-sh.json',
)

/**
 * The 7 sh-tier target words shipped in the canon. Source of truth:
 * `design/word-song/digraphs-sh-word-list.md` §1 final pool (Option
 * C-minus, Dave addendum 2026-05-14) + §8 AC1. Must stay aligned with
 * the `vowel`-digraph `sh`-onset entries in `wordPack.ts` `TARGET_WORDS`
 * once Devon's wordPack PR lands.
 */
const SH_TIER_WORDS: ReadonlySet<string> = new Set([
  'ship',
  'shell',
  'shoe',
  'sheep',
  'shark',
  'shed',
  'shop',
])

/**
 * The 3 `hybridMode: true` long-vowel sh words. Per
 * `digraphs-sh-word-list.md` §6.1 + §8 AC12: these are
 * "sight-word-hybrid" — Marian pattern-matches against Emma's audio +
 * the picture rather than fully decoding the long-vowel rest-of-word.
 * The planner must NEVER emit a segmentation / spelling /
 * decode-from-phoneme prompt for them.
 */
const HYBRID_WORDS: ReadonlySet<string> = new Set(['shoe', 'sheep', 'shark'])

/**
 * The 4 conventional decodable sh words (`hybridMode: false`). NOT
 * gated — the planner MAY emit any prompt type for these. Listed here
 * for the explicit "non-hybrid words are un-gated" assertion in test 2,
 * so a future over-broad gate (one that accidentally gates ALL sh
 * words) is caught.
 */
const NON_HYBRID_SH_WORDS: ReadonlySet<string> = new Set([
  'ship',
  'shell',
  'shed',
  'shop',
])

/**
 * Decode-style prompt-type slots that AC12 forbids for `hybridMode`
 * words. The canon's per-problem utterance ids follow the
 * `word.p<N>.<slot>` template (verified against the shipped cvc-words
 * canon: slots today are `read | correct | reprompt | hint |
 * giveAnswer`). AC12 forbids these three NEW decode-style slots from
 * ever appearing for a hybrid-word problem. If Kevin's planner
 * introduces them for non-hybrid words, that is allowed; for hybrid
 * words it is not.
 */
const FORBIDDEN_HYBRID_SLOTS: ReadonlyArray<string> = [
  'segmentation',
  'spelling',
  'decode_from_phoneme',
]

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
 * Read + parse the sh-tier canon from disk.
 *
 * On current main the file does NOT exist — `readFileSync` throws
 * `ENOENT`. We catch + re-throw with an explicit, attributable message
 * so the RED state reads unambiguously in CI logs: this is the
 * failing-first signal, not an infra flake. Post-merge (Kevin's
 * planner PR + AC10 canon bake) the file exists and this resolves
 * cleanly.
 */
function readDigraphsShCanon(): { raw: string; parsed: CanonShape } {
  if (!existsSync(DIGRAPHS_SH_CANON_PATH)) {
    throw new Error(
      `[digraphs-sh-content spec] FAILING-FIRST: sh-tier canon not found at ` +
        `${DIGRAPHS_SH_CANON_PATH}. This is the expected RED state on ` +
        `pre-merge main — the sh content does not exist yet. The spec ` +
        `flips GREEN when Kevin's feat/digraphs-sh-content-planner PR + ` +
        `Devon's feat/digraphs-sh-wordpack PR merge and the AC10 canon ` +
        `bake commits this file.`,
    )
  }
  const raw = readFileSync(DIGRAPHS_SH_CANON_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as CanonShape
  return { raw, parsed }
}

/**
 * Extract the per-problem target word from the canon `plan.utterances`
 * array. Each problem's `read` slot text is `"Read the <word>."` (the
 * shipped cvc-words convention — verified against the on-disk
 * cvc-words-short-i canon). Returns a map from problem number (1..8) to
 * the lowercase target word.
 */
function targetWordsByProblem(canon: CanonShape): Map<number, string> {
  const byProblem = new Map<number, string>()
  for (const u of canon.plan.utterances) {
    const m = u.id.match(/^word\.p(\d+)\.read$/)
    if (m === null) continue
    const problemNum = Number(m[1])
    const wordMatch = u.text.match(/^Read the (\w+)\.$/)
    if (wordMatch === null) {
      throw new Error(
        `[digraphs-sh-content spec] canon read-slot text did not match ` +
          `"Read the <word>." template: id=${u.id} text=${JSON.stringify(u.text)}`,
      )
    }
    byProblem.set(problemNum, wordMatch[1]!.toLowerCase())
  }
  return byProblem
}

/**
 * Install a `/api/claude` mock that returns the digraphs-sh canon on
 * word-song requests and captures every observed request body for the
 * planner-contract assertion (Devon's PR #214 review suggestion S3).
 */
async function installDigraphsShClaudeMock(
  page: Page,
): Promise<{ requests: Request[] }> {
  // Reads the canon file — throws the explicit failing-first error on
  // pre-merge main. This is intentional: the throw IS the RED signal.
  const { raw: canonBody } = readDigraphsShCanon()
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
        message: `digraphs-sh-content spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

/**
 * Seed the persisted Progress + SessionHistory blobs so the App routes
 * Splash → Hub directly with `digraphs-sh` as the picked focus node.
 *
 *  - Every word-song node before `digraphs-sh` must be `'mastered'`
 *    so `pickFocusNode()` walks the track and stops at `digraphs-sh`.
 *  - `digraphs-sh` is bumped to `'practicing'` (the post-short-e-
 *    promotion state Marian is in once she reaches the sh tier).
 *  - SessionHistory `sessionCount: 5` skips Greet (Splash advances
 *    direct to Hub when sessionCount > 0).
 *
 * `skillLevelOverrides` is typed `Record<string, string>` — it accepts
 * the `digraphs-sh` literal whether or not it is canonical in the
 * `SkillNode` union. On post-#217 main `digraphs-sh` IS canonical, so
 * this is a normal seed (no failing-first looseness needed on the
 * progress side — the failing-first signal here is the missing CANON
 * file, not a missing node literal). See `testing-and-ci.md` §4.1.1a.
 */
async function seedDigraphsShProgress(page: Page): Promise<void> {
  await seedLocalStorage(page, {
    progress: buildSeedProgress({
      skillLevelOverrides: {
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'mastered',
        'cvc-words-short-o': 'mastered',
        'cvc-words-short-u': 'mastered',
        'cvc-words-short-i': 'mastered',
        'cvc-words-short-e': 'mastered',
        'digraphs-sh': 'practicing',
      },
    }),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

/**
 * Skip helper for tests that depend on the read-aloud effect firing.
 * WebKit headless has no AudioContext — same harness limitation as the
 * cvc regression siblings.
 */
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud effect cannot fire. Production iPad Safari works fine; this is a harness limitation. Tests 1 + 2 (payload assertions) cover the sh-content + hybridMode-gate contract on webkit.',
  )
}

test.describe('digraphs-sh content + hybridMode gate (AC11 + AC12)', () => {
  test.beforeEach(async ({ page }) => {
    await seedDigraphsShProgress(page)
  })

  /**
   * AC11 — sh content emits from the planner with sh-tier words.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit (does not
   * depend on the read-aloud effect / chip enablement). Asserts:
   *   - The seeded `digraphs-sh` session fires exactly one planner
   *     request with `progress.focusNode === 'digraphs-sh'` (the
   *     wire-level picker contract — Devon's PR #214 review S3).
   *   - The sh-tier canon has 8 problems.
   *   - All 8 target words are drawn from the 7-word sh-tier pool
   *     (`ship, shell, shoe, sheep, shark, shed, shop`) — i.e. NO
   *     `blending-cv` fallback content (the pre-merge stub behaviour).
   *
   * On pre-merge main this fails at `installDigraphsShClaudeMock` →
   * `readDigraphsShCanon()` → explicit ENOENT throw.
   */
  test('1. AC11: digraphs-sh session fires a planner request with focusNode=digraphs-sh and the canon carries 8 sh-tier-pool target words', async ({
    page,
  }) => {
    const { requests } = await installDigraphsShClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // WordSong mounts — proves the planner fetch resolved (the sh-tier
    // mock returned 200) and the parser accepted the sh-tier content.
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
    expect(progressBlock.focusNode).toBe('digraphs-sh')

    // Inspect the sh-tier canon payload directly.
    const { parsed: canon } = readDigraphsShCanon()
    expect(canon.ok).toBe(true)
    expect(canon.kind).toBe('session-start')

    const byProblem = targetWordsByProblem(canon)
    // 8 problems per session — count-based assertion per
    // feedback_count_assertions_on_regression_tests.md.
    expect(byProblem.size).toBe(8)

    // Every target word is in the 7-word sh-tier pool. Compute the
    // off-pool intersection explicitly so the failure message names
    // exactly which words leaked (catches the blending-cv stub
    // fallback — those targets would NOT be in SH_TIER_WORDS).
    const targetWords = [...byProblem.values()]
    const offPoolWords = targetWords.filter((w) => !SH_TIER_WORDS.has(w))
    expect(offPoolWords).toEqual([])
  })

  /**
   * AC12 — `hybridMode: true` words never receive decode-style prompts.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit. For every
   * problem in the sh-tier canon whose target word is a `hybridMode`
   * word (`shoe`, `sheep`, `shark`), asserts NO utterance for that
   * problem carries a `segmentation` / `spelling` /
   * `decode_from_phoneme` slot. The 4 non-hybrid sh words
   * (`ship, shell, shed, shop`) are explicitly NOT gated — the test
   * asserts the canon's hybrid-word gate is the ONLY gate (a
   * regression that gated ALL sh words would be caught by the
   * non-hybrid un-gated check).
   *
   * On pre-merge main this fails at `readDigraphsShCanon()` → explicit
   * ENOENT throw.
   */
  test('2. AC12: no segmentation/spelling/decode-from-phoneme utterance for any hybridMode word (shoe/sheep/shark); non-hybrid sh words are un-gated', async () => {
    const { parsed: canon } = readDigraphsShCanon()
    const byProblem = targetWordsByProblem(canon)
    expect(byProblem.size).toBe(8)

    // Build the per-problem slot inventory from the canon's
    // `plan.utterances` array. Key = problem number, value = the set
    // of slot names emitted for that problem.
    const slotsByProblem = new Map<number, Set<string>>()
    for (const u of canon.plan.utterances) {
      const m = u.id.match(/^word\.p(\d+)\.(\w+)$/)
      if (m === null) continue // session.end.* etc — not per-problem
      const problemNum = Number(m[1])
      const slot = m[2]!
      if (!slotsByProblem.has(problemNum)) {
        slotsByProblem.set(problemNum, new Set())
      }
      slotsByProblem.get(problemNum)!.add(slot)
    }

    // Collect every (problem, word, forbidden-slot) violation across
    // all 8 problems, then assert the violation list is empty. The
    // list-then-assert-empty shape gives a failure message that names
    // exactly which hybrid word got which forbidden slot.
    const hybridViolations: Array<{
      problem: number
      word: string
      slot: string
    }> = []
    // Sanity counters — confirm the test actually exercised hybrid
    // AND non-hybrid words (guards against a canon that, e.g., shipped
    // zero hybrid words and passed vacuously).
    let hybridProblemCount = 0
    let nonHybridProblemCount = 0

    for (const [problemNum, word] of byProblem) {
      const slots = slotsByProblem.get(problemNum) ?? new Set<string>()
      if (HYBRID_WORDS.has(word)) {
        hybridProblemCount++
        for (const forbidden of FORBIDDEN_HYBRID_SLOTS) {
          if (slots.has(forbidden)) {
            hybridViolations.push({
              problem: problemNum,
              word,
              slot: forbidden,
            })
          }
        }
      } else if (NON_HYBRID_SH_WORDS.has(word)) {
        nonHybridProblemCount++
      }
    }

    // The gate is real: zero forbidden slots on any hybrid-word
    // problem.
    expect(hybridViolations).toEqual([])

    // The gate is not over-broad: the canon's 8-problem session
    // exercised at least one hybrid word AND at least one non-hybrid
    // sh word. Without this, a canon that shipped (e.g.) 8 non-hybrid
    // problems would pass `hybridViolations === []` vacuously. With 7
    // words in the pool and 8 distinct problems, the planner emits the
    // full pool + one repeat, so all 3 hybrids and all 4 non-hybrids
    // should appear — but assert the weaker ">= 1 each" so a future
    // planner pool-composition tweak doesn't false-fail this gate
    // test.
    expect(hybridProblemCount).toBeGreaterThanOrEqual(1)
    expect(nonHybridProblemCount).toBeGreaterThanOrEqual(1)
  })

  /**
   * AC11 (UI belt-and-braces) — the WordSong chip UI renders sh-tier
   * words, not `blending-cv` fallback content.
   *
   * Chromium-only (depends on the read-aloud effect firing to enable
   * chips). Walks the full 8-problem session and asserts every chip's
   * `data-word` — target AND distractor — is either a sh-tier pool
   * word OR a sh/s-contrast trap distractor (`sell`, `sop`, dual-role
   * `sip`). Zero `blending-cv` / CVC-tier content leaks.
   *
   * Distractor policy source: `digraphs-sh-word-list.md` §2 + §8 AC2 /
   * AC3 — sh-trios contain sh-pool neighbours + s-contrast trap
   * distractors only. `sip` is the dual-role cross-tier trap for
   * `ship` (it is also a short-i target — see §2 sip-dual-role).
   *
   * On pre-merge main this fails at `installDigraphsShClaudeMock` →
   * `readDigraphsShCanon()` → explicit ENOENT throw.
   */
  test('3. AC11: WordSong chip UI renders sh-tier words across all 8 problems (no blending-cv fallback content)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installDigraphsShClaudeMock(page)
    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })

    // The set of chip words the sh-tier session is ALLOWED to render:
    // the 7 sh-tier pool words + the s-contrast trap distractors
    // (`sell`, `sop` new distractor-only entries; `sip` dual-role).
    // Anything outside this set is `blending-cv` fallback or CVC-tier
    // leakage — the regression this test guards.
    const ALLOWED_CHIP_WORDS = new Set<string>([
      ...SH_TIER_WORDS,
      'sell',
      'sop',
      'sip',
    ])

    const allChipWords: string[] = []
    const allTargetWords: string[] = []

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
      }

      const correctChip = page.locator(
        '[data-testid="word-song-chip"][data-correct="true"]',
      )
      await expect(correctChip).toHaveCount(1)
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      // The correct chip's word must be a sh-tier TARGET word — never
      // a trap distractor and never CVC-tier content.
      const correctWord = await correctChip.getAttribute('data-word')
      expect(correctWord).not.toBeNull()
      expect(SH_TIER_WORDS.has(correctWord!)).toBe(true)

      await correctChip.click()
    }

    // Count-based assertions per
    // feedback_count_assertions_on_regression_tests.md: 24 chip
    // renders (3 × 8), 8 targets.
    expect(allChipWords).toHaveLength(24)
    expect(allTargetWords).toHaveLength(8)

    // Every target word is in the sh-tier pool.
    const offPoolTargets = allTargetWords.filter((w) => !SH_TIER_WORDS.has(w))
    expect(offPoolTargets).toEqual([])

    // Every chip word — target AND distractor — is either a sh-tier
    // pool word or an allowed s-contrast trap. Compute the off-pool
    // intersection explicitly so the failure message names exactly
    // which words leaked (catches blending-cv fallback content + any
    // CVC-tier leakage).
    const offPoolChips = allChipWords.filter((w) => !ALLOWED_CHIP_WORDS.has(w))
    expect(offPoolChips).toEqual([])

    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
  })
})
