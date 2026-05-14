/**
 * E2E spec — digraphs-ch CONTENT presence + intro→practicing transition.
 *
 * Ticket: PR 3 of the 3-PR digraphs-ch content build wave. Paired with
 *         Kevin's planner PR (`feat/digraphs-ch-planner`) and Devon's
 *         wordPack PR (`feat/digraphs-ch-wordpack`), both in flight in
 *         parallel.
 *         Spec source: `design/word-song/digraphs-ch-word-list.md` §1 +
 *         §8 (AC1 pool, AC9 isolated-ch trios, AC11 progression E2E),
 *         reconciled against `design/research/digraph-ch-addendum.md`
 *         (Dave — the /tʃ/-specific authority, locks the 7-word pool +
 *         the zero-`hybridMode` call).
 *
 * SCOPE — what this spec covers
 * -----------------------------
 * This is the digraphs-ch CONTENT-presence + progression spec. It is
 * the structural clone of `digraphs-sh-content.spec.ts` (PR #219) with
 * one deliberate addition: it ALSO covers the `intro → practicing`
 * progression transition for `digraphs-ch` specifically (test 4).
 *
 * The sh tier split content (PR #219) and progression (PR #214) across
 * two specs. The ch tier folds the `intro → practicing` wire-level
 * assertion into this content spec because of Devon's PR #225 review
 * note + `feedback_progression_e2e_mandatory`: the `intro → practicing`
 * transition is the EXACT gap that shipped broken for `cvc-words` (no
 * `intro → practicing` transition existed anywhere in the codebase for
 * weeks; see memory `feedback_progression_e2e_mandatory`). A
 * canon-shape file-read alone would NOT catch a planner that emits the
 * right words but a state machine that never moves `digraphs-ch` out of
 * `intro`. Test 4 is the wire-level proof that the node actually
 * transitions.
 *
 * THE FAILING-FIRST CONTRACT
 * --------------------------
 * On current `main` (commit 8e04a10 — PR #225 landed Kyle's
 * digraphs-ch CONTENT SPEC, but NO ch content code):
 *   - `digraphs-ch` IS a valid focus node + IS in `SKILL_NODES`,
 *     `WordSongNode` union, `WORD_SONG_NODES_IN_ORDER`, and
 *     `e2e/_helpers/seedStorage.ts` `DEFAULT_SKILL_LEVELS` (PR #211
 *     SkillNode split). But it is NOT in
 *     `WORD_SONG_FIRST_CLASS_FOCUS_NODES` (`api/_planner.ts`), so the
 *     planner's `effectiveFocusNode` stub-falls-through to
 *     `blending-cv` content for any `digraphs-ch` session.
 *   - There is NO `public/canon/word-song/level-1/digraphs-ch.json`
 *     canon file on disk. The 7 word-song canon files today are
 *     `blending-cv`, `cvc-words`, `cvc-words-short-{o,u,i,e}`,
 *     `digraphs-sh`.
 *   - `wordPack.ts` has zero `ch`-onset digraph entries.
 *
 * This spec's `/api/claude` mock serves the bytes of the ch-tier canon
 * file (same canon-bytes pass-through pattern as the sibling cvc + sh
 * regression specs — real Azure-rendered MP3s decode cleanly in
 * headless Chromium; hand-rolled silent-base64 fixtures break Howler's
 * decode and mask the regression). Because that canon file does NOT
 * exist on current main, `readDigraphsChCanon()` throws `ENOENT` and
 * tests 1-3 fail at setup — for the right reason: the ch content does
 * not exist yet. The failure message names the missing file explicitly
 * so the RED state is unambiguous in CI logs.
 *
 * Test 4 (the `intro → practicing` progression assertion) uses the
 * SAME per-spec `installDigraphsChClaudeMock` as tests 1 and 3 — it
 * serves the ch-tier canon bytes on word-song requests, so a REAL ch
 * session drives the transition. On pre-merge main it still fails for
 * the right reason: `readDigraphsChCanon()` throws `ENOENT` at setup
 * because the canon file does not exist yet. (An earlier draft used the
 * shared `installClaudeMock` with `failNetwork: true`; that was wrong —
 * with the network aborted, WordSong falls through to
 * `pickStaticWordSongPlan()`, whose targets are hardcoded short-a CVC
 * words, never ch-pool words, so the content-half assertion could never
 * pass even post-merge. Using the ch-canon mock makes the content half
 * satisfiable on a green tree.) Test 4's RED state is therefore NOT
 * about progression plumbing (PR #211 + #201 already wired that) — it
 * is about CONTENT: pre-merge the canon file does not exist, so the
 * mock setup throws; post-merge the canon serves real ch content and
 * both the transition AND the content-half assertion pass. Test 4
 * asserts BOTH the transition AND that the session that drove it ran
 * real ch content (the first correct chip carries a ch-pool
 * `data-word`).
 *
 * POST-MERGE GREEN STATE
 * ----------------------
 * After Kevin's planner PR + Devon's wordPack PR merge (and the canon
 * is baked + committed per AC10), then the orchestrator rebases this
 * branch onto main:
 *   1. `public/canon/word-song/level-1/digraphs-ch.json` exists on
 *      disk → `readDigraphsChCanon()` succeeds, the mock serves real
 *      ch-tier canon bytes.
 *   2. AC1: the canon's 8 problems all carry ch-tier target words
 *      (`chin, chip, chop, chat, chest, chug, chick`); the seeded
 *      `digraphs-ch` session fires a planner request with
 *      `progress.focusNode === 'digraphs-ch'`; the WordSong chip UI
 *      renders ch-tier words (no `blending-cv` fallback content).
 *   3. AC12: the ch tier has ZERO `hybridMode` words — unlike sh, no
 *      decode-style-prompt gate is needed. Test 2 asserts the canon
 *      carries NO `segmentation` / `spelling` / `decode_from_phoneme`
 *      slot for ANY problem (the sh tier gated only its 3 hybrid words;
 *      the ch tier has none, so the gate is total — a regression that
 *      emitted a decode-style prompt for any ch word is caught).
 *   4. AC9: every chip word — target AND distractor — is a ch-pool
 *      word OR a shipped s-contrast distractor-only entry (`sip`,
 *      `sat`, `sick`). No CVC-tier words, no sh-tier words leak into
 *      ch-trios (the isolated-ch rule).
 *   5. AC11 (this spec's progression half): a single perfect
 *      `digraphs-ch` session moves the node `intro → practicing` via
 *      the PR #201 intro-pass — AND the session that drove it ran real
 *      ch content (the read-line caption named a ch-pool word, not a
 *      `blending-cv` stub word).
 *
 * WHY ASSERT ON THE CANON PAYLOAD (not just the UI)
 * -------------------------------------------------
 * Per Devon's PR #219 finding + `testing-and-ci.md` §4.2 (Claude-mock
 * request-capture pattern): a pure canon-JSON file-read test would
 * still pass if the planner regressed — the file would sit on disk
 * correct while the live planner served `blending-cv` stub content.
 * Test 1 is the WIRE-LEVEL test: it asserts the seeded `digraphs-ch`
 * session fires a real `/api/claude` POST with
 * `progress.focusNode === 'digraphs-ch'` AND that WordSong actually
 * mounts on the ch-tier mock response (proving the parser accepted ch
 * content). The canon-payload inspection is layered ON TOP of that
 * wire assertion, not instead of it. Test 3 (UI walk) and test 4
 * (progression) are both full live-pipeline walks — planner mock →
 * canon bytes → Howler decode → chip render → state machine.
 *
 * Mock strategy
 * -------------
 * `installDigraphsChClaudeMock` reads the bytes of
 * `public/canon/word-song/level-1/digraphs-ch.json` and returns them
 * on word-song requests; it also captures every observed request body
 * so test 1 can assert the wire-level planner contract
 * (`progress.focusNode === 'digraphs-ch'`). Math (or any other)
 * requests are rejected with 500 — the ch-tier flow only triggers a
 * word-song fetch; a stray math request would mean the spec's
 * invariants are wrong, and we'd rather see a loud error than a silent
 * pass. This is a PER-SPEC LOCAL mock function modelled on
 * `installDigraphsShClaudeMock` in `digraphs-sh-content.spec.ts` —
 * there is NO shared `installCvcWordsClaudeMock`-with-capture helper;
 * word-song Claude mocks in e2e are per-spec local functions.
 *
 * Test 4 uses the SAME `installDigraphsChClaudeMock` as tests 1 and 3,
 * not the shared `installClaudeMock` — it walks a full session that
 * must run REAL ch content to satisfy its content-half assertion. The
 * `failNetwork: true` fallback path would route WordSong through
 * `pickStaticWordSongPlan()`, whose hardcoded targets are short-a CVC
 * words (never ch-pool words), so the content-half assertion could
 * never pass on that path. Driving the session with the ch-canon mock
 * means the first correct chip carries a real ch-pool `data-word`. See
 * test 4's docstring for the precise RED/GREEN mechanism.
 *
 * Timeout sizing — per `testing-and-ci.md` §4.1.1b
 * ------------------------------------------------
 * Tests 1-2 are payload assertions that don't walk a session — default
 * 90s budget is ample. Test 3 walks one 8-problem session (~30-50s wall
 * driven by the ch-canon mock) — default 90s is adequate.
 * Test 4 walks ONE full session AND reads progress back — single
 * session, ~50s wall + nav + progress-read overhead; the default 90s
 * budget covers it, but it is sized explicitly at 120s for headroom
 * because it is the one test that does a full session walk PLUS a
 * progress round-trip read. (Contrast `digraphs-sh-progression.spec.ts`
 * which runs FOUR sessions and needs 240s.)
 *
 * Why some tests skip on webkit
 * -----------------------------
 * Same harness limitation as the cvc + sh regression siblings — WebKit
 * headless has no AudioContext, so the read-aloud effect's
 * `getHowlerRunningFn()` predicate stays false forever and chips never
 * enable. Tests that don't depend on the read-aloud completing run on
 * BOTH chromium AND webkit (1, 2 — pure payload assertions). The chip
 * UI walkthrough (test 3) and the progression walk (test 4) are
 * chromium-only. Real iPad Safari is unaffected.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * Path to the ch-tier session canon the spec serves as the mock
 * response. Resolved relative to `process.cwd()` because Playwright
 * runs the harness from the worktree root (same place `vite preview`
 * reads `public/`). Hardcoding the relative path means the spec breaks
 * loudly if the canon ever moves.
 *
 * On current main this file does NOT exist — that absence is the
 * failing-first signal (see header). Kevin's planner PR + the AC10
 * canon bake create it.
 */
const DIGRAPHS_CH_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/digraphs-ch.json',
)

/**
 * The 7 ch-tier target words shipped in the canon. Source of truth:
 * `design/word-song/digraphs-ch-word-list.md` §1 final pool (Dave's
 * §3c locked inventory) + §8 AC1. Must stay aligned with the `ch`-onset
 * entries in `wordPack.ts` `TARGET_WORDS` once Devon's wordPack PR
 * lands.
 */
const CH_TIER_WORDS: ReadonlySet<string> = new Set([
  'chin',
  'chip',
  'chop',
  'chat',
  'chest',
  'chug',
  'chick',
])

/**
 * The s-contrast distractor-only entries the ch tier ships. Source:
 * `digraphs-ch-word-list.md` §2 + §8 AC2:
 *   - `sat` (`vowel: 'a'`, `isTarget: false`) — NEW distractor-only
 *   - `sick` (`vowel: 'i'`, `isTarget: false`) — NEW distractor-only
 *   - `sip` — dual-role: already a short-i `TARGET_WORDS` entry,
 *     referenced by string as `chip`'s trap. NOT a new entry.
 * Weak-trap s-contrast words (`sin, sop, sest, sug`) are explicitly NOT
 * shipped (§2: `sin`/`sop` adult-register/obscure, `sest`/`sug`
 * non-words).
 */
const CH_DISTRACTOR_ONLY_WORDS: ReadonlySet<string> = new Set([
  'sat',
  'sick',
  'sip',
])

/**
 * The full set of chip words a ch-tier session is ALLOWED to render:
 * the 7 ch-tier pool words + the 3 s-contrast distractor-only entries.
 * Anything outside this set is `blending-cv` fallback content, CVC-tier
 * leakage, or sh-tier leakage — the isolated-ch regression this spec
 * guards (`digraphs-ch-word-list.md` §6 / §8 AC9).
 */
const ALLOWED_CHIP_WORDS: ReadonlySet<string> = new Set([
  ...CH_TIER_WORDS,
  ...CH_DISTRACTOR_ONLY_WORDS,
])

/**
 * Decode-style prompt-type slots that the ch tier must NEVER emit. The
 * sh tier gated these THREE slots for its 3 `hybridMode: true` words
 * (`shoe`, `sheep`, `shark`). The ch tier has ZERO `hybridMode` words
 * (`digraphs-ch-word-list.md` §6.1 + §8 AC12 — Dave's addendum §3d /
 * non-obvious finding #1), so the gate is TOTAL for ch: no problem in
 * the ch canon may carry any of these slots. A regression that emitted
 * a decode-style prompt for any ch word is caught by test 2.
 *
 * The canon's per-problem utterance ids follow the `word.p<N>.<slot>`
 * template (verified against the shipped digraphs-sh canon: slots today
 * are `read | correct | reprompt | hint | giveAnswer`).
 */
const FORBIDDEN_DECODE_SLOTS: ReadonlyArray<string> = [
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
 * Read + parse the ch-tier canon from disk.
 *
 * On current main the file does NOT exist — `readFileSync` throws
 * `ENOENT`. We catch + re-throw with an explicit, attributable message
 * so the RED state reads unambiguously in CI logs: this is the
 * failing-first signal, not an infra flake. Post-merge (Kevin's
 * planner PR + Devon's wordPack PR + AC10 canon bake + rebase) the file
 * exists and this resolves cleanly.
 */
function readDigraphsChCanon(): { raw: string; parsed: CanonShape } {
  if (!existsSync(DIGRAPHS_CH_CANON_PATH)) {
    throw new Error(
      `[digraphs-ch-content spec] FAILING-FIRST: ch-tier canon not found at ` +
        `${DIGRAPHS_CH_CANON_PATH}. This is the expected RED state on ` +
        `pre-merge main (commit 8e04a10) — the ch content does not exist ` +
        `yet. The spec flips GREEN after Kevin's feat/digraphs-ch-planner ` +
        `PR + Devon's feat/digraphs-ch-wordpack PR merge, the AC10 canon ` +
        `bake commits this file, and the orchestrator rebases this branch ` +
        `onto post-merge main.`,
    )
  }
  const raw = readFileSync(DIGRAPHS_CH_CANON_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as CanonShape
  return { raw, parsed }
}

/**
 * Extract the per-problem target word from the canon `plan.utterances`
 * array. Each problem's `read` slot text is `"Read the <word>."` (the
 * shipped cvc-words + digraphs-sh convention — verified against the
 * on-disk digraphs-sh canon). Returns a map from problem number (1..8)
 * to the lowercase target word.
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
        `[digraphs-ch-content spec] canon read-slot text did not match ` +
          `"Read the <word>." template: id=${u.id} text=${JSON.stringify(u.text)}`,
      )
    }
    byProblem.set(problemNum, wordMatch[1]!.toLowerCase())
  }
  return byProblem
}

/**
 * Install a `/api/claude` mock that returns the digraphs-ch canon on
 * word-song requests and captures every observed request body for the
 * wire-level planner-contract assertion. Per-spec local function —
 * modelled on `installDigraphsShClaudeMock` in
 * `digraphs-sh-content.spec.ts`. There is no shared
 * `installCvcWordsClaudeMock`-with-`{capture:'request'}` helper.
 */
async function installDigraphsChClaudeMock(
  page: Page,
): Promise<{ requests: Request[] }> {
  // Reads the canon file — throws the explicit failing-first error on
  // pre-merge main. This is intentional: the throw IS the RED signal.
  const { raw: canonBody } = readDigraphsChCanon()
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
        message: `digraphs-ch-content spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

/**
 * Seed the persisted Progress + SessionHistory blobs so the App routes
 * Splash → Hub directly with `digraphs-ch` as the picked focus node.
 *
 *  - Every word-song node before `digraphs-ch` must be `'mastered'`
 *    so `pickFocusNode()` walks the track and stops at `digraphs-ch`.
 *    This includes `digraphs-sh` (the immediately-preceding digraph
 *    tier — ch is second in the locked sh → ch → th sequence).
 *  - `digraphs-ch` is bumped to `'intro'` (the post-`digraphs-sh`-
 *    promotion state Marian is in once she reaches the ch tier — the
 *    downstream-unlock cascade flips `digraphs-ch: 'locked' → 'intro'`
 *    when `digraphs-sh` graduates).
 *  - SessionHistory `sessionCount: 5` skips Greet (Splash advances
 *    direct to Hub when sessionCount > 0).
 *
 * `skillLevelOverrides` is typed `Record<string, string>` — it accepts
 * the `digraphs-ch` literal whether or not it is canonical in the
 * `SkillNode` union. On post-#211 main `digraphs-ch` IS canonical, so
 * this is a normal seed (no failing-first looseness needed on the
 * progress side — the failing-first signal here is the missing CANON
 * file + the planner stub-fallback, not a missing node literal). See
 * `testing-and-ci.md` §4.1.1a.
 *
 * `crossDayEnforcement: false` so the single back-to-back test-4
 * session counts toward the intro-pass without a same-day gate. Both
 * `math` AND `word-song` thresholds must be present — `isParentSettings`
 * is STRICT on the per-track shape (a single-track seed makes the
 * guard reject the whole blob → `loadProgress()` returns null → the app
 * silently falls back to `defaultProgress()`; see
 * `digraphs-sh-progression.spec.ts` for the post-mortem of that exact
 * silent-rejection failure mode).
 */
async function seedDigraphsChProgress(page: Page): Promise<void> {
  const progress = buildSeedProgress({
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
      'digraphs-ch': 'intro',
      'digraphs-th-voiceless': 'locked',
      'sight-words': 'locked',
      'simple-sentences': 'locked',
    },
  })

  // buildSeedProgress hardcodes `crossDayEnforcement: true` and may seed
  // a single-track masteryThreshold; replace the whole `parentSettings`
  // via raw spread so BOTH tracks are present and crossDayEnforcement is
  // off. Mirrors `digraphs-sh-progression.spec.ts`.
  const progressWithNoCrossDay = {
    ...(progress as Record<string, unknown>),
    parentSettings: {
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: {
        math: { percent: 0.95, sessions: 3 },
        'word-song': { percent: 0.9, sessions: 3 },
      },
      crossDayEnforcement: false,
      showLevelToMarian: false,
    },
  }

  await seedLocalStorage(page, {
    progress: progressWithNoCrossDay,
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

/**
 * Skip helper for tests that depend on the read-aloud effect firing.
 * WebKit headless has no AudioContext — same harness limitation as the
 * cvc + sh regression siblings.
 */
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud effect cannot fire. Production iPad Safari works fine; this is a harness limitation. Tests 1 + 2 (payload assertions) cover the ch-content + zero-hybridMode contract on webkit.',
  )
}

interface PersistedProgress {
  skillLevels: Record<string, string>
  history: Array<{ dateISO: string; skillFocus: string[]; successRate: number }>
}

test.describe('digraphs-ch content + intro→practicing transition (AC1 + AC9 + AC11 + AC12)', () => {
  test.beforeEach(async ({ page }) => {
    await seedDigraphsChProgress(page)
  })

  /**
   * AC1 (wire-level) — ch content emits from the planner with ch-tier
   * words.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit (does not
   * depend on the read-aloud effect / chip enablement). Asserts:
   *   - The seeded `digraphs-ch` session fires exactly one planner
   *     request with `progress.focusNode === 'digraphs-ch'` — the
   *     WIRE-LEVEL picker contract. Per Devon's PR #219 finding: a pure
   *     canon-JSON file-read would pass even if the planner regressed;
   *     this assertion proves the live request carried the right focus
   *     node.
   *   - WordSong mounts on the ch-tier mock response — proves the
   *     planner fetch resolved AND the browser parser accepted the
   *     ch-tier content.
   *   - The ch-tier canon has 8 problems.
   *   - All 8 target words are drawn from the 7-word ch-tier pool
   *     (`chin, chip, chop, chat, chest, chug, chick`) — i.e. NO
   *     `blending-cv` fallback content (the pre-merge stub behaviour).
   *
   * On pre-merge main this fails at `installDigraphsChClaudeMock` →
   * `readDigraphsChCanon()` → explicit ENOENT throw.
   */
  test('1. AC1: digraphs-ch session fires a planner request with focusNode=digraphs-ch and the canon carries 8 ch-tier-pool target words', async ({
    page,
  }) => {
    const { requests } = await installDigraphsChClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // WordSong mounts — proves the planner fetch resolved (the ch-tier
    // mock returned 200) and the parser accepted the ch-tier content.
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
    // THE wire-level picker contract — the live request carried
    // focusNode=digraphs-ch. This is the assertion a pure canon
    // file-read cannot make.
    expect(progressBlock.focusNode).toBe('digraphs-ch')

    // Inspect the ch-tier canon payload directly.
    const { parsed: canon } = readDigraphsChCanon()
    expect(canon.ok).toBe(true)
    expect(canon.kind).toBe('session-start')

    const byProblem = targetWordsByProblem(canon)
    // 8 problems per session — count-based assertion per
    // feedback_count_assertions_on_regression_tests.md.
    expect(byProblem.size).toBe(8)

    // Every target word is in the 7-word ch-tier pool. Compute the
    // off-pool intersection explicitly so the failure message names
    // exactly which words leaked (catches the blending-cv stub
    // fallback — those targets would NOT be in CH_TIER_WORDS).
    const targetWords = [...byProblem.values()]
    const offPoolWords = targetWords.filter((w) => !CH_TIER_WORDS.has(w))
    expect(offPoolWords).toEqual([])
  })

  /**
   * AC12 — the ch tier has ZERO `hybridMode` words → NO problem in the
   * ch canon may carry a decode-style prompt slot.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit. The sh
   * tier gated `segmentation` / `spelling` / `decode_from_phoneme`
   * slots for its 3 `hybridMode: true` words only; the 4 non-hybrid sh
   * words were un-gated. The ch tier has ZERO `hybridMode` words
   * (`digraphs-ch-word-list.md` §6.1, §8 AC12 — Dave's addendum §3d /
   * non-obvious finding #1: "the ch tier sets `hybridMode: true` on
   * ZERO entries"). So the gate is TOTAL for ch: this test asserts NO
   * problem — for any of the 7 ch words — carries any forbidden
   * decode-style slot. A regression where Kevin's planner emitted a
   * decode-style prompt for a ch word (e.g. by misapplying the sh
   * tier's hybridMode planner logic to ch) is caught here.
   *
   * On pre-merge main this fails at `readDigraphsChCanon()` → explicit
   * ENOENT throw.
   */
  test('2. AC12: zero hybridMode words → no segmentation/spelling/decode-from-phoneme slot on any ch-tier problem', async () => {
    const { parsed: canon } = readDigraphsChCanon()
    const byProblem = targetWordsByProblem(canon)
    expect(byProblem.size).toBe(8)

    // Build the per-problem slot inventory from the canon's
    // `plan.utterances` array. Key = problem number, value = the set of
    // slot names emitted for that problem.
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
    // exactly which ch word got which forbidden decode-style slot.
    const decodeSlotViolations: Array<{
      problem: number
      word: string
      slot: string
    }> = []
    for (const [problemNum, word] of byProblem) {
      const slots = slotsByProblem.get(problemNum) ?? new Set<string>()
      for (const forbidden of FORBIDDEN_DECODE_SLOTS) {
        if (slots.has(forbidden)) {
          decodeSlotViolations.push({
            problem: problemNum,
            word,
            slot: forbidden,
          })
        }
      }
    }

    // The ch tier is hybridMode-free: zero decode-style slots on ANY
    // problem. Total gate — unlike sh, there is no un-gated subset.
    expect(decodeSlotViolations).toEqual([])

    // Sanity: the test actually exercised all 8 problems against ch
    // words (guards against a vacuous pass on an empty/malformed
    // canon). Every problem's target word is a ch-pool word.
    const offPoolTargets = [...byProblem.values()].filter(
      (w) => !CH_TIER_WORDS.has(w),
    )
    expect(offPoolTargets).toEqual([])
  })

  /**
   * AC1 + AC9 (UI belt-and-braces) — the WordSong chip UI renders
   * ch-tier words, not `blending-cv` fallback content; ch-trios obey
   * the isolated-ch rule.
   *
   * Chromium-only (depends on the read-aloud effect firing to enable
   * chips). Walks the full 8-problem session and asserts every chip's
   * `data-word` — target AND distractor — is either a ch-tier pool word
   * OR a shipped s-contrast distractor-only entry (`sip`, `sat`,
   * `sick`). Zero `blending-cv` / CVC-tier / sh-tier content leaks
   * (`digraphs-ch-word-list.md` §6 / §8 AC9 — the isolated-ch rule:
   * ch-trios contain only ch-pool words + s-contrast traps).
   *
   * On pre-merge main this fails at `installDigraphsChClaudeMock` →
   * `readDigraphsChCanon()` → explicit ENOENT throw.
   */
  test('3. AC1+AC9: WordSong chip UI renders ch-tier words across all 8 problems (no blending-cv / CVC / sh leakage)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installDigraphsChClaudeMock(page)
    await page.goto('/')

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
      // The correct chip's word must be a ch-tier TARGET word — never a
      // trap distractor and never CVC/sh-tier content.
      const correctWord = await correctChip.getAttribute('data-word')
      expect(correctWord).not.toBeNull()
      expect(CH_TIER_WORDS.has(correctWord!)).toBe(true)

      await correctChip.click()
    }

    // Count-based assertions per
    // feedback_count_assertions_on_regression_tests.md: 24 chip renders
    // (3 × 8), 8 targets.
    expect(allChipWords).toHaveLength(24)
    expect(allTargetWords).toHaveLength(8)

    // Every target word is in the ch-tier pool.
    const offPoolTargets = allTargetWords.filter((w) => !CH_TIER_WORDS.has(w))
    expect(offPoolTargets).toEqual([])

    // Every chip word — target AND distractor — is either a ch-tier
    // pool word or an allowed s-contrast trap. Compute the off-pool
    // intersection explicitly so the failure message names exactly
    // which words leaked (catches blending-cv fallback content + any
    // CVC-tier / sh-tier leakage — the isolated-ch rule, AC9).
    const offPoolChips = allChipWords.filter((w) => !ALLOWED_CHIP_WORDS.has(w))
    expect(offPoolChips).toEqual([])

    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
  })

  /**
   * AC11 (progression) — a single perfect `digraphs-ch` session moves
   * the node `intro → practicing`, AND the session that drove the
   * transition ran real ch content.
   *
   * THIS IS THE WIRE-LEVEL `intro → practicing` ASSERTION the brief
   * mandates per `feedback_progression_e2e_mandatory` + Devon's PR #225
   * review note. The `intro → practicing` transition is the EXACT gap
   * that shipped broken for `cvc-words` — no such transition existed
   * anywhere in the codebase for weeks (memory
   * `feedback_progression_e2e_mandatory`). A canon-shape file-read
   * alone (tests 1-2) would NOT catch a state machine that never moves
   * `digraphs-ch` out of `intro`.
   *
   * Mock choice — the PER-SPEC `installDigraphsChClaudeMock` (the same
   * mock tests 1 and 3 use), NOT the shared `installClaudeMock` with
   * `failNetwork: true`. Rationale: this test asserts BOTH the
   * transition AND that REAL ch content drove it. The `failNetwork`
   * fallback routes WordSong through `pickStaticWordSongPlan()`, whose
   * hardcoded targets are short-a CVC words (`cat`, `mat`, `cap`, ...) —
   * never ch-pool words — so the content-half assertion could never
   * pass on that path, even on a green tree. Driving the session with
   * the ch-canon mock means the first correct chip carries a real
   * ch-pool `data-word`, so the content half is satisfiable post-merge.
   *
   * Pre-merge RED mechanism (precise):
   *   The progression plumbing already works on pre-merge main:
   *   `digraphs-ch` IS in `WORD_SONG_NODES_IN_ORDER` (PR #211 SkillNode
   *   split), so the picker lands on the seeded `digraphs-ch: 'intro'`
   *   node, the session logs `skillFocus: ['digraphs-ch']`, and
   *   `applyMasteryRule`'s intro-pass (PR #201) advances it to
   *   `'practicing'`. So a progression-ONLY assertion would pass
   *   pre-merge — false confidence.
   *   What FAILS pre-merge is setup: `public/canon/word-song/level-1/
   *   digraphs-ch.json` does not exist, so `installDigraphsChClaudeMock`
   *   → `readDigraphsChCanon()` throws `ENOENT` before the session walk
   *   even begins. The content-half assertion
   *   `expect(CH_TIER_WORDS.has(firstTargetWord))` is therefore never
   *   reached on pre-merge main — the test is RED at the mock-install
   *   step, the same RED reason as tests 1 and 3.
   *   This is the RIGHT failing reason: the ch content (canon file +
   *   first-class planner support) does not exist yet, so a real ch
   *   session — the only thing that can satisfy the content half —
   *   cannot be constructed.
   *
   * Post-merge GREEN: the canon file exists, `digraphs-ch` is
   * first-class, the mock serves real ch content, the first correct
   * chip carries a ch-pool word, and the intro-pass advances the node
   * to `'practicing'`. Both halves pass.
   *
   * Chromium-only (the session walk depends on the read-aloud effect /
   * chip enablement). Timeout sized explicitly per `testing-and-ci.md`
   * §4.1.1b — single session walk + a progress round-trip read.
   */
  test('4. AC11: one perfect digraphs-ch session transitions the node intro → practicing, driven by real ch content', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    // Single session walk (~50s wall, ch-canon mock) + nav + a progress
    // round-trip read. Default 90s is borderline; 120s gives headroom.
    // Contrast digraphs-sh-progression.spec.ts which runs 4 sessions and
    // needs 240s.
    test.setTimeout(120_000)

    await installDigraphsChClaudeMock(page)
    await page.goto('/')
    // NOTE: do NOT call `forceHowlerUnlock` here. That test seam stubs
    // `Howler.ctx` in a way that makes the real ch-canon MP3 nodes throw
    // `Failed to execute 'connect' on 'AudioNode'` when Howler decodes
    // them — `prepareWordSongPathA` then rejects and WordSong silently
    // falls back to the short-a static plan, so `firstTargetWord` would
    // be `cat`, never a ch-pool word, and the content-half assertion
    // could never pass. This test drives a real ch-canon session, so it
    // relies on the genuine gesture-unlock chain — the same path test 3
    // (the UI walk) uses, which is why test 3 passes without forcing.
    // `forceHowlerUnlock` is only safe on the `failNetwork: true`
    // silent-caption-walk path (e.g. `digraphs-sh-progression.spec.ts`),
    // which never decodes real canon audio.

    // ── Pre-flight: confirm the seed landed and digraphs-ch starts at
    //    'intro'. If the seed were silently rejected (the
    //    isParentSettings strict-shape failure mode), the app would
    //    fall back to defaultProgress() and digraphs-ch would be
    //    'locked', not 'intro' — catching that here makes a seed-
    //    rejection regression loud instead of a confusing downstream
    //    failure.
    const beforeSession = (await readProgressFromPage(
      page,
    )) as PersistedProgress
    expect(beforeSession).not.toBeNull()
    expect(beforeSession.skillLevels['digraphs-ch']).toBe('intro')

    // ── Capture the target word the session actually presents.
    //    The ch-canon mock serves real ch-tier content, so problem 1's
    //    correct chip carries a ch-pool `data-word`. We grab it as the
    //    content-half signal: post-merge it is one of the 7 ch-pool
    //    words. (Pre-merge this line is never reached — the mock-install
    //    step throws `ENOENT` because the ch canon file does not exist.)
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()
    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 10_000 })

    await expect(wordSong).toHaveAttribute('data-problem-index', '0', {
      timeout: 20_000,
    })
    // Wait for the REAL ch-canon plan to drive the read-aloud before
    // reading the target word. On cold mount WordSong renders the
    // `pickStaticWordSongPlan()` fallback (short-a CVC) until
    // `prepareWordSongPathA` resolves and swaps in the server plan;
    // `data-read-aloud-played === 'true'` only flips once the real
    // (ch-canon) audio has played. Reading `data-word` before this gate
    // would catch the static-fallback CVC word, not the ch-pool word —
    // the same gate test 3 uses for its per-problem chip assertions.
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })
    // The correct chip carries `data-word` — the canonical per-problem
    // target word. Read it before the first tap. Driven by the ch-canon
    // mock, this is a ch-pool word post-merge; the content-half
    // assertion at the end of the test pins that.
    const firstCorrectChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(firstCorrectChip).toBeEnabled({ timeout: 15_000 })
    const firstTargetWord = await firstCorrectChip.getAttribute('data-word')
    expect(firstTargetWord).not.toBeNull()

    // ── Walk the rest of the 8-problem session to completion.
    await firstCorrectChip.click()
    await page.waitForTimeout(1500)
    for (let i = 2; i <= 8; i++) {
      const correctChip = page.locator(
        '[data-testid="word-song-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()
      if (i < 8) {
        await page.waitForTimeout(1500)
      }
    }
    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 10_000,
    })
    const cta = page.getByTestId('session-end-cta')
    await expect(cta).toBeVisible({ timeout: 12_000 })
    await cta.click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    const afterSession = (await readProgressFromPage(page)) as PersistedProgress
    expect(afterSession).not.toBeNull()

    // SMOKING GUN — the intro→practicing transition fired for
    // `digraphs-ch` on the first perfect session. The PR #211 + #201
    // plumbing makes this pass; this assertion guards that the
    // plumbing stays wired. The content-half assertion below is what
    // guards that a REAL ch session drove it. (Pre-merge this line is
    // never reached — the mock-install step throws `ENOENT`.)
    expect(afterSession.skillLevels['digraphs-ch']).toBe('practicing')

    // Exactly one history entry, focused on `digraphs-ch`, perfect
    // score. Count-based per
    // feedback_count_assertions_on_regression_tests.md.
    expect(afterSession.history.length).toBe(1)
    expect(afterSession.history[0]!.skillFocus).toEqual(['digraphs-ch'])
    expect(afterSession.history[0]!.successRate).toBe(1)

    // Downstream sibling stays locked — the cascade only fires on
    // 'mastered', not 'practicing'.
    expect(afterSession.skillLevels['digraphs-th-voiceless']).toBe('locked')

    // CONTENT HALF — the session that drove the transition ran REAL ch
    // content. The ch-canon mock serves first-class `digraphs-ch`
    // content, so `firstTargetWord` is one of the 7 ch-pool words. This
    // is what makes test 4 a genuine wire-level check rather than a
    // false-green progression-only assertion: the transition firing
    // (above) plus a ch-pool word driving it (here) together prove a
    // real ch session moved the node. Pre-merge this line is never
    // reached — the mock-install step throws `ENOENT` because the ch
    // canon file does not exist yet, the same RED reason as tests 1
    // and 3.
    expect(CH_TIER_WORDS.has(firstTargetWord!)).toBe(true)
  })
})
