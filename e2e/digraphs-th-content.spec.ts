/**
 * E2E spec — digraphs-th (voiceless /θ/) CONTENT presence + hybridMode
 * partial gate + intro→practicing transition.
 *
 * Ticket: PR 3 of the 3-PR digraphs-th content build wave. Paired with
 *         Kevin's planner PR (`feat/digraphs-th-planner`) and Devon's
 *         wordPack PR (`feat/digraphs-th-wordpack`), both in flight in
 *         parallel.
 *         Spec source: `design/word-song/digraphs-th-word-list.md` §1
 *         (reconciled 7-word pool), §6.2 (hybridMode posture — `thick`
 *         + `cloth` only), §8 AC1 / AC9 / AC11 / AC13, reconciled
 *         against `design/research/digraph-th-addendum.md` (Dave — the
 *         /θ/-specific authority; locks the 7-word pool, the
 *         `thick`+`cloth` hybridMode reclassification, the th/t-only
 *         trap-class posture).
 *
 * SCOPE — what this spec covers
 * -----------------------------
 * This is the digraphs-th CONTENT-presence + hybridMode-partial-gate +
 * progression spec. It is the structural clone of
 * `digraphs-ch-content.spec.ts` (PR #226) with two deliberate
 * th-specific divergences:
 *   1. The th tier ships TWO `hybridMode: true` words (`thick`, `cloth`)
 *      — unlike ch (zero hybrid words → total gate). So test 2 is the
 *      sh-style PARTIAL gate: the 2 hybrid words get NO decode-style
 *      prompt slot, the other 5 (`thin, path, bath, math, moth`) are
 *      explicitly UN-gated. The "non-hybrid words are un-gated"
 *      assertion catches a future over-broad gate that accidentally
 *      gates ALL th words.
 *   2. It ALSO covers the `intro → practicing` progression transition
 *      for `digraphs-th-voiceless` specifically (test 4) — same posture
 *      the ch content spec adopted, per `feedback_progression_e2e_
 *      mandatory` + the digraphs-ch PR #225 review note.
 *
 * THE FAILING-FIRST CONTRACT
 * --------------------------
 * On current `main` (commit 99b1a36 — PR #226 landed the digraphs-ch
 * content failing-first spec; PR #229 landed Kyle's digraphs-th CONTENT
 * SPEC draft; but NO th content code):
 *   - `digraphs-th-voiceless` IS a valid focus node + IS in
 *     `SKILL_NODES`, the `WordSongNode` union, `WORD_SONG_NODES_IN_ORDER`,
 *     `VALID_WORD_SONG_FOCUS_NODES` (`api/_planner.ts`), and
 *     `e2e/_helpers/seedStorage.ts` `DEFAULT_SKILL_LEVELS` (all from the
 *     PR #211 SkillNode split). BUT it is NOT in
 *     `WORD_SONG_FIRST_CLASS_FOCUS_NODES` (`api/_planner.ts` —
 *     verified: that set is `blending-cv, cvc-words,
 *     cvc-words-short-{o,u,i,e}, digraphs-sh, digraphs-ch`), so the
 *     planner's `effectiveFocusNode` stub-falls-through to
 *     `blending-cv` content for any `digraphs-th-voiceless` session.
 *   - There is NO `public/canon/word-song/level-1/
 *     digraphs-th-voiceless.json` canon file on disk. The 8 word-song
 *     canon files today are `blending-cv`, `cvc-words`,
 *     `cvc-words-short-{o,u,i,e}`, `digraphs-sh`, `digraphs-ch`.
 *   - `wordPack.ts` has zero `th`-digraph entries.
 *
 * This spec's `/api/claude` mock serves the bytes of the th-tier canon
 * file (same canon-bytes pass-through pattern as the sibling cvc + sh +
 * ch regression specs — real Azure-rendered MP3s decode cleanly in
 * headless Chromium; hand-rolled silent-base64 fixtures break Howler's
 * decode and mask the regression). Because that canon file does NOT
 * exist on current main, `readDigraphsThCanon()` throws `ENOENT` and
 * tests 1-4 fail at setup — for the right reason: the th content does
 * not exist yet. The failure message names the missing file explicitly
 * so the RED state is unambiguous in CI logs.
 *
 * WHY THE RED SIGNAL IS A CONTENT ASSERTION, NOT A PROGRESSION ONE
 * ---------------------------------------------------------------
 * Per `testing-and-ci.md` §"Failing-first specs for content tiers" and
 * the digraphs-ch PR #226 confirmation: the `digraphs-th-voiceless`
 * progression plumbing ALREADY shipped on `main` (PR #211 SkillNode
 * split + PR #201 intro-pass). So a progression-ONLY assertion —
 * "the node moved intro → practicing" — would pass GREEN pre-merge and
 * give false confidence. The real RED signal is CONTENT: the th canon
 * file does not exist, so the per-spec mock setup throws `ENOENT`
 * before any session walk begins. Every test in this spec routes its
 * RED through `installDigraphsThClaudeMock` → `readDigraphsThCanon()` →
 * explicit ENOENT throw — including test 4 (the progression test),
 * whose content-half assertion (`TH_TIER_WORDS.has(firstTargetWord)`)
 * is never reached pre-merge.
 *
 * THE GREEN-SIDE MOCK SERVES REAL TIER CANON — NEVER `failNetwork`
 * ----------------------------------------------------------------
 * Per `testing-and-ci.md` §6 corollary: a spec that asserts on WHICH
 * words rendered cannot use `installClaudeMock(page, { failNetwork:
 * true })`. The network-fail path drops the planner response, so
 * WordSong runs `pickStaticWordSongPlan()` whose targets are hardcoded
 * short-a CVC words (`cat`/`mat`/`cap`...) — never th-pool words. Any
 * content assertion against that path is structurally unsatisfiable.
 * This spec uses the per-spec `installDigraphsThClaudeMock`, which
 * serves the real th-tier canon bytes. Test 4 uses the SAME mock — NOT
 * `failNetwork` — precisely because its content-half assertion needs a
 * real th session to be satisfiable post-merge.
 *
 * WHY NOT `forceHowlerUnlock`
 * --------------------------
 * Per `testing-and-ci.md` §4.1.2: `forceHowlerUnlock` stubs
 * `Howler.ctx`, so real canon MP3 nodes throw `Failed to execute
 * 'connect' on 'AudioNode'` on decode → `prepareWordSongPathA` rejects
 * → WordSong silently falls back to `pickStaticWordSongPlan()` (short-a
 * CVC), masking the regression. This spec serves REAL th-canon bytes,
 * so it relies on the genuine gesture-unlock chain plus a
 * `data-read-aloud-played === 'true'` gate before reading a rendered
 * word — the proven post-fix `digraphs-ch-content.spec.ts` test 3/4
 * pattern.
 *
 * POST-MERGE GREEN STATE
 * ----------------------
 * After Kevin's planner PR + Devon's wordPack PR merge (canon baked +
 * committed per AC10), then the orchestrator rebases this branch onto
 * main:
 *   1. `public/canon/word-song/level-1/digraphs-th-voiceless.json`
 *      exists on disk → `readDigraphsThCanon()` succeeds, the mock
 *      serves real th-tier canon bytes.
 *   2. AC1: the canon's 8 problems all carry th-tier target words
 *      (`thin, bath, math, path, moth, thick, cloth`); the seeded
 *      `digraphs-th-voiceless` session fires a planner request with
 *      `progress.focusNode === 'digraphs-th-voiceless'`; the WordSong
 *      chip UI renders th-tier words (no `blending-cv` fallback
 *      content).
 *   3. AC13: the th tier ships exactly 2 `hybridMode: true` words
 *      (`thick`, `cloth`). Test 2 asserts the canon carries NO
 *      `segmentation` / `spelling` / `decode_from_phoneme` slot for
 *      ANY problem whose target is `thick` or `cloth` — AND that the
 *      gate is PARTIAL: it does not assert the absence of those slots
 *      for the 5 non-hybrid words, so a future planner that adds a
 *      decode prompt for `thin`/`path`/`bath`/`math`/`moth` stays
 *      legal, while one that gates ALL th words (over-broad) or one
 *      that emits a decode prompt for `thick`/`cloth` (under-gated) is
 *      caught.
 *   4. AC9: every chip word — target AND distractor — is a th-pool word
 *      OR a shipped th/t-contrast distractor-only entry (`tin`, `tick`,
 *      `pat`, `bat`, `mat`). No CVC-tier words (except the dual-role
 *      t-contrast partners `bat`/`mat`), no sh-tier words, no ch-tier
 *      words leak into th-trios (the isolated-th rule).
 *   5. AC11 (this spec's progression half): a single perfect
 *      `digraphs-th-voiceless` session moves the node `intro →
 *      practicing` via the PR #201 intro-pass — AND the session that
 *      drove it ran real th content (the first correct chip carries a
 *      th-pool `data-word`, not a `blending-cv` stub word).
 *
 * WHY ASSERT ON THE CANON PAYLOAD (not just the UI)
 * -------------------------------------------------
 * Per Devon's PR #219 finding + `testing-and-ci.md` §4.2: a pure
 * canon-JSON file-read test would still pass if the planner regressed —
 * the file would sit on disk correct while the live planner served
 * `blending-cv` stub content. Test 1 is the WIRE-LEVEL test: it asserts
 * the seeded `digraphs-th-voiceless` session fires a real `/api/claude`
 * POST with `progress.focusNode === 'digraphs-th-voiceless'` AND that
 * WordSong actually mounts on the th-tier mock response (proving the
 * parser accepted th content). The canon-payload inspection is layered
 * ON TOP of that wire assertion, not instead of it. Test 3 (UI walk)
 * and test 4 (progression) are both full live-pipeline walks — planner
 * mock → canon bytes → Howler decode → chip render → state machine.
 *
 * Mock strategy
 * -------------
 * `installDigraphsThClaudeMock` reads the bytes of
 * `public/canon/word-song/level-1/digraphs-th-voiceless.json` and
 * returns them on word-song requests; it also captures every observed
 * request body so test 1 can assert the wire-level planner contract
 * (`progress.focusNode === 'digraphs-th-voiceless'`). Math (or any
 * other) requests are rejected with 500 — the th-tier flow only
 * triggers a word-song fetch; a stray math request would mean the
 * spec's invariants are wrong, and we'd rather see a loud error than a
 * silent pass. This is a PER-SPEC LOCAL mock function modelled on
 * `installDigraphsChClaudeMock` in `digraphs-ch-content.spec.ts` —
 * there is NO shared `installCvcWordsClaudeMock`-with-capture helper;
 * word-song Claude mocks in e2e are per-spec local functions.
 *
 * Timeout sizing — per `testing-and-ci.md` §4.1.1b
 * ------------------------------------------------
 * Tests 1-2 are payload assertions that don't walk a session — default
 * 90s budget is ample. Test 3 walks one 8-problem session (~30-50s wall
 * driven by the th-canon mock) — default 90s is adequate.
 * Test 4 walks ONE full session AND reads progress back — single
 * session, ~50s wall + nav + progress-read overhead; sized explicitly
 * at 120s for headroom (the same posture as `digraphs-ch-content.spec.ts`
 * test 4). Contrast `digraphs-sh-progression.spec.ts` which runs FOUR
 * sessions and needs 240s.
 *
 * Why some tests skip on webkit
 * -----------------------------
 * Same harness limitation as the cvc + sh + ch regression siblings —
 * WebKit headless has no AudioContext, so the read-aloud effect's
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
 * Path to the th-tier session canon the spec serves as the mock
 * response. Resolved relative to `process.cwd()` because Playwright
 * runs the harness from the worktree root (same place `vite preview`
 * reads `public/`). Hardcoding the relative path means the spec breaks
 * loudly if the canon ever moves.
 *
 * The canon focusNode key is `digraphs-th-voiceless` — verified against
 * the live `VALID_WORD_SONG_FOCUS_NODES` constant in `api/_planner.ts`
 * (PR #211 SkillNode name), per AC10's "confirm the canon focusNode
 * key" instruction.
 *
 * On current main this file does NOT exist — that absence is the
 * failing-first signal (see header). Kevin's planner PR + the AC10
 * canon bake create it.
 */
const DIGRAPHS_TH_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/digraphs-th-voiceless.json',
)

/**
 * The 7 th-tier target words shipped in the canon. Source of truth:
 * `design/word-song/digraphs-th-word-list.md` §1 RECONCILED final pool
 * (Dave's th-addendum §3f locked inventory) + §8 AC1. Must stay aligned
 * with the `th`-digraph entries in `wordPack.ts` `TARGET_WORDS` once
 * Devon's wordPack PR lands.
 *
 * `thumb` is NOT in the pool — Dave §3e dropped it from the opening 7
 * (silent `b` violates one-new-element-per-session); it is the
 * documented pool-EXTENSION word, not a v1 target.
 */
const TH_TIER_WORDS: ReadonlySet<string> = new Set([
  'thin',
  'bath',
  'math',
  'path',
  'moth',
  'thick',
  'cloth',
])

/**
 * The 2 `hybridMode: true` th words. Source:
 * `digraphs-th-word-list.md` §6.2 + §8 AC13 (Dave's th-addendum §3e):
 *   - `thick` — double-digraph (`th` target digraph + `ck`, a separate
 *     not-yet-taught digraph) → recognition-only.
 *   - `cloth` — `/kl/` onset blend exceeds CVC scope → recognition-only.
 * The planner must NEVER emit a `segmentation` / `spelling` /
 * `decode_from_phoneme` prompt for these two.
 *
 * th diverges from ch here: ch shipped ZERO hybridMode words (total
 * gate); th ships TWO (partial gate). It resembles the sh tier (3
 * hybrid words), though for a structurally-different reason — sh's
 * hybrids were long-vowel-after-digraph; th's are onset-blend +
 * double-digraph (Dave Non-obvious finding 5).
 */
const HYBRID_TH_WORDS: ReadonlySet<string> = new Set(['thick', 'cloth'])

/**
 * The 5 fully-decodable th words (`hybridMode: false`). NOT gated — the
 * planner MAY emit any prompt type for these. Listed here for the
 * explicit "non-hybrid words are un-gated" assertion in test 2, so a
 * future OVER-BROAD gate (one that accidentally gates ALL th words like
 * ch's total gate) is caught. This is the load-bearing partial-gate
 * distinction between th and ch.
 */
const NON_HYBRID_TH_WORDS: ReadonlySet<string> = new Set([
  'thin',
  'bath',
  'math',
  'path',
  'moth',
])

/**
 * The th/t-contrast distractor-only entries the th tier ships. Source:
 * `digraphs-th-word-list.md` §2 + §8 AC2:
 *   - `tin` (`vowel: 'i'`, `isTarget: false`) — NEW distractor-only
 *     (the `thin`/`tin` minimal pair).
 *   - `tick` (`vowel: 'i'`, `isTarget: false`) — NEW distractor-only
 *     (the `thick`/`tick` minimal pair).
 *   - `pat` (`vowel: 'a'`, `isTarget: false`) — NEW distractor-only
 *     (the `path`/`pat` minimal pair).
 *   - `bat`, `mat` — DUAL-ROLE: already short-a CVC `TARGET_WORDS`
 *     entries, referenced by string as `bath`'s / `math`'s t-contrast
 *     traps. NOT new entries.
 * Per §2: every th-tier distractor string is a member of the th pool
 * OR one of these 5 distractor-only / dual-role entries. `thumb`
 * appears nowhere.
 */
const TH_DISTRACTOR_ONLY_WORDS: ReadonlySet<string> = new Set([
  'tin',
  'tick',
  'pat',
  'bat',
  'mat',
])

/**
 * The full set of chip words a th-tier session is ALLOWED to render:
 * the 7 th-tier pool words + the 5 th/t-contrast distractor entries.
 * Anything outside this set is `blending-cv` fallback content, generic
 * CVC-tier leakage, or sh-/ch-tier leakage — the isolated-th regression
 * this spec guards (`digraphs-th-word-list.md` §6 / §8 AC9).
 *
 * Note `bat`/`mat` ARE short-a CVC words — their presence is NOT a
 * violation of the "no CVC words in th-trios" rule: they are the
 * deliberate th/t-contrast minimal-pair traps for `bath`/`math` (AC9 +
 * §2 dual-role subsection). A generic CVC word like `cat`/`dog`/`pen`
 * would NOT be in this set.
 */
const ALLOWED_CHIP_WORDS: ReadonlySet<string> = new Set([
  ...TH_TIER_WORDS,
  ...TH_DISTRACTOR_ONLY_WORDS,
])

/**
 * Decode-style prompt-type slots that the th tier must NEVER emit for a
 * `hybridMode: true` word. The canon's per-problem utterance ids follow
 * the `word.p<N>.<slot>` template (verified against the shipped
 * digraphs-ch / digraphs-sh canons: slots today are `read | correct |
 * reprompt | hint | giveAnswer`). AC13 forbids these three NEW
 * decode-style slots from ever appearing for a `thick` or `cloth`
 * problem — but ALLOWS them for the 5 non-hybrid words (the partial
 * gate, unlike ch's total gate).
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
 * Read + parse the th-tier canon from disk.
 *
 * On current main the file does NOT exist — `readFileSync` throws
 * `ENOENT`. We catch + re-throw with an explicit, attributable message
 * so the RED state reads unambiguously in CI logs: this is the
 * failing-first signal, not an infra flake. Post-merge (Kevin's planner
 * PR + Devon's wordPack PR + AC10 canon bake + rebase) the file exists
 * and this resolves cleanly.
 */
function readDigraphsThCanon(): { raw: string; parsed: CanonShape } {
  if (!existsSync(DIGRAPHS_TH_CANON_PATH)) {
    throw new Error(
      `[digraphs-th-content spec] FAILING-FIRST: th-tier canon not found at ` +
        `${DIGRAPHS_TH_CANON_PATH}. This is the expected RED state on ` +
        `pre-merge main (commit 99b1a36) — the digraphs-th (voiceless /θ/) ` +
        `content does not exist yet. The spec flips GREEN after Kevin's ` +
        `feat/digraphs-th-planner PR + Devon's feat/digraphs-th-wordpack ` +
        `PR merge, the AC10 canon bake commits this file, and the ` +
        `orchestrator rebases this branch onto post-merge main.`,
    )
  }
  const raw = readFileSync(DIGRAPHS_TH_CANON_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as CanonShape
  return { raw, parsed }
}

/**
 * Extract the per-problem target word from the canon `plan.utterances`
 * array. Each problem's `read` slot text is `"Read the <word>."` (the
 * shipped cvc-words + digraphs-sh + digraphs-ch convention — verified
 * against the on-disk digraphs-ch canon). Returns a map from problem
 * number (1..8) to the lowercase target word.
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
        `[digraphs-th-content spec] canon read-slot text did not match ` +
          `"Read the <word>." template: id=${u.id} text=${JSON.stringify(u.text)}`,
      )
    }
    byProblem.set(problemNum, wordMatch[1]!.toLowerCase())
  }
  return byProblem
}

/**
 * Build the per-problem slot inventory from the canon's
 * `plan.utterances` array. Key = problem number, value = the set of
 * slot names emitted for that problem. `session.end.*` and other
 * out-of-namespace ids are skipped.
 */
function slotsByProblem(canon: CanonShape): Map<number, Set<string>> {
  const byProblem = new Map<number, Set<string>>()
  for (const u of canon.plan.utterances) {
    const m = u.id.match(/^word\.p(\d+)\.(\w+)$/)
    if (m === null) continue // session.end.* etc — not per-problem
    const problemNum = Number(m[1])
    const slot = m[2]!
    if (!byProblem.has(problemNum)) {
      byProblem.set(problemNum, new Set())
    }
    byProblem.get(problemNum)!.add(slot)
  }
  return byProblem
}

/**
 * Install a `/api/claude` mock that returns the digraphs-th canon on
 * word-song requests and captures every observed request body for the
 * wire-level planner-contract assertion. Per-spec local function —
 * modelled on `installDigraphsChClaudeMock` in
 * `digraphs-ch-content.spec.ts`. There is no shared
 * `installCvcWordsClaudeMock`-with-`{capture:'request'}` helper.
 */
async function installDigraphsThClaudeMock(
  page: Page,
): Promise<{ requests: Request[] }> {
  // Reads the canon file — throws the explicit failing-first error on
  // pre-merge main. This is intentional: the throw IS the RED signal.
  const { raw: canonBody } = readDigraphsThCanon()
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
        message: `digraphs-th-content spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

/**
 * Seed the persisted Progress + SessionHistory blobs so the App routes
 * Splash → Hub directly with `digraphs-th-voiceless` as the picked
 * focus node.
 *
 *  - Every word-song node before `digraphs-th-voiceless` must be
 *    `'mastered'` so `pickFocusNode()` walks the track and stops at
 *    `digraphs-th-voiceless`. This includes `digraphs-sh` AND
 *    `digraphs-ch` (the two preceding digraph tiers — th is third in
 *    the locked sh → ch → th sequence).
 *  - `digraphs-th-voiceless` is bumped to `'intro'` (the post-
 *    `digraphs-ch`-promotion state Marian is in once she reaches the th
 *    tier — the downstream-unlock cascade flips
 *    `digraphs-th-voiceless: 'locked' → 'intro'` when `digraphs-ch`
 *    graduates).
 *  - SessionHistory `sessionCount: 5` skips Greet (Splash advances
 *    direct to Hub when sessionCount > 0).
 *
 * `skillLevelOverrides` is typed `Record<string, string>` — it accepts
 * the `digraphs-th-voiceless` literal whether or not it is canonical in
 * the `SkillNode` union. On post-#211 main `digraphs-th-voiceless` IS
 * canonical, so this is a normal seed (no failing-first looseness
 * needed on the progress side — the failing-first signal here is the
 * missing CANON file + the planner stub-fallback, not a missing node
 * literal). See `testing-and-ci.md` §4.1.1a.
 *
 * `crossDayEnforcement: false` so the single back-to-back test-4
 * session counts toward the intro-pass without a same-day gate. Both
 * `math` AND `word-song` thresholds must be present — `isParentSettings`
 * is STRICT on the per-track shape (a single-track seed makes the guard
 * reject the whole blob → `loadProgress()` returns null → the app
 * silently falls back to `defaultProgress()`; see
 * `digraphs-ch-content.spec.ts` / `digraphs-sh-progression.spec.ts` for
 * the post-mortem of that exact silent-rejection failure mode).
 */
async function seedDigraphsThProgress(page: Page): Promise<void> {
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
      'digraphs-ch': 'mastered',
      'digraphs-th-voiceless': 'intro',
      'sight-words': 'locked',
      'simple-sentences': 'locked',
    },
  })

  // buildSeedProgress hardcodes `crossDayEnforcement: true` and may seed
  // a single-track masteryThreshold; replace the whole `parentSettings`
  // via raw spread so BOTH tracks are present and crossDayEnforcement is
  // off. Mirrors `digraphs-ch-content.spec.ts`.
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
 * cvc + sh + ch regression siblings.
 */
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud effect cannot fire. Production iPad Safari works fine; this is a harness limitation. Tests 1 + 2 (payload assertions) cover the th-content + hybridMode-partial-gate contract on webkit.',
  )
}

interface PersistedProgress {
  skillLevels: Record<string, string>
  history: Array<{ dateISO: string; skillFocus: string[]; successRate: number }>
}

test.describe('digraphs-th content + hybridMode partial gate + intro→practicing transition (AC1 + AC9 + AC11 + AC13)', () => {
  test.beforeEach(async ({ page }) => {
    await seedDigraphsThProgress(page)
  })

  /**
   * AC1 (wire-level) — th content emits from the planner with th-tier
   * words.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit (does not
   * depend on the read-aloud effect / chip enablement). Asserts:
   *   - The seeded `digraphs-th-voiceless` session fires exactly one
   *     planner request with `progress.focusNode ===
   *     'digraphs-th-voiceless'` — the WIRE-LEVEL picker contract. Per
   *     Devon's PR #219 finding: a pure canon-JSON file-read would pass
   *     even if the planner regressed; this assertion proves the live
   *     request carried the right focus node.
   *   - WordSong mounts on the th-tier mock response — proves the
   *     planner fetch resolved AND the browser parser accepted the
   *     th-tier content.
   *   - The th-tier canon has 8 problems.
   *   - All 8 target words are drawn from the 7-word th-tier pool
   *     (`thin, bath, math, path, moth, thick, cloth`) — i.e. NO
   *     `blending-cv` fallback content (the pre-merge stub behaviour).
   *
   * On pre-merge main this fails at `installDigraphsThClaudeMock` →
   * `readDigraphsThCanon()` → explicit ENOENT throw.
   */
  test('1. AC1: digraphs-th session fires a planner request with focusNode=digraphs-th-voiceless and the canon carries 8 th-tier-pool target words', async ({
    page,
  }) => {
    const { requests } = await installDigraphsThClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // WordSong mounts — proves the planner fetch resolved (the th-tier
    // mock returned 200) and the parser accepted the th-tier content.
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
    // focusNode=digraphs-th-voiceless. This is the assertion a pure
    // canon file-read cannot make.
    expect(progressBlock.focusNode).toBe('digraphs-th-voiceless')

    // Inspect the th-tier canon payload directly.
    const { parsed: canon } = readDigraphsThCanon()
    expect(canon.ok).toBe(true)
    expect(canon.kind).toBe('session-start')

    const byProblem = targetWordsByProblem(canon)
    // 8 problems per session — count-based assertion per
    // feedback_count_assertions_on_regression_tests.md.
    expect(byProblem.size).toBe(8)

    // Every target word is in the 7-word th-tier pool. Compute the
    // off-pool intersection explicitly so the failure message names
    // exactly which words leaked (catches the blending-cv stub
    // fallback — those targets would NOT be in TH_TIER_WORDS).
    const targetWords = [...byProblem.values()]
    const offPoolWords = targetWords.filter((w) => !TH_TIER_WORDS.has(w))
    expect(offPoolWords).toEqual([])
  })

  /**
   * AC13 — the th tier ships TWO `hybridMode: true` words (`thick`,
   * `cloth`) → NO problem whose target is `thick` or `cloth` may carry
   * a decode-style prompt slot. The gate is PARTIAL — unlike ch's
   * total gate.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit. This is
   * the th-specific divergence from `digraphs-ch-content.spec.ts` test
   * 2: ch had ZERO hybridMode words, so its gate was TOTAL (no decode
   * slot on ANY ch problem). th has TWO hybridMode words, so its gate
   * is PARTIAL — modelled on `digraphs-sh-content.spec.ts` test 2.
   *
   * Two assertions, both load-bearing:
   *   (a) UNDER-GATE guard — NO problem whose target is `thick` or
   *       `cloth` carries a `segmentation` / `spelling` /
   *       `decode_from_phoneme` slot. A planner that misapplies a
   *       decode prompt to a hybrid word is caught.
   *   (b) OVER-BROAD-GATE guard — the test does NOT assert the absence
   *       of decode slots for the 5 non-hybrid words; instead it
   *       asserts every problem's target is a known th word and that
   *       BOTH hybrid words AND at least some non-hybrid words appear
   *       in the canon, so the partial-gate distinction is actually
   *       exercised. A future planner that gates ALL th words (copying
   *       ch's total-gate logic by mistake) would still pass (a) but
   *       the design intent — th is a PARTIAL gate — is documented and
   *       pinned by `NON_HYBRID_TH_WORDS` being a live, asserted-on
   *       constant.
   *
   * On pre-merge main this fails at `readDigraphsThCanon()` → explicit
   * ENOENT throw.
   */
  test('2. AC13: thick + cloth (hybridMode) carry no segmentation/spelling/decode-from-phoneme slot; the 5 non-hybrid th words are un-gated (partial gate, unlike ch)', async () => {
    const { parsed: canon } = readDigraphsThCanon()
    const byProblem = targetWordsByProblem(canon)
    expect(byProblem.size).toBe(8)

    const slots = slotsByProblem(canon)

    // (a) UNDER-GATE guard — collect every (problem, hybrid-word,
    // forbidden-slot) violation, then assert the violation list is
    // empty. The list-then-assert-empty shape gives a failure message
    // that names exactly which hybrid word got which forbidden
    // decode-style slot.
    const hybridDecodeViolations: Array<{
      problem: number
      word: string
      slot: string
    }> = []
    for (const [problemNum, word] of byProblem) {
      if (!HYBRID_TH_WORDS.has(word)) continue
      const problemSlots = slots.get(problemNum) ?? new Set<string>()
      for (const forbidden of FORBIDDEN_DECODE_SLOTS) {
        if (problemSlots.has(forbidden)) {
          hybridDecodeViolations.push({
            problem: problemNum,
            word,
            slot: forbidden,
          })
        }
      }
    }
    // thick + cloth never receive a decode-style prompt — the
    // recognition-only contract (Dave §3e, §6.2, AC13).
    expect(hybridDecodeViolations).toEqual([])

    // (b) OVER-BROAD-GATE guard / partial-gate exercise — the canon
    // must actually contain BOTH hybrid words AND non-hybrid words, so
    // the partial-gate distinction is meaningfully exercised (not a
    // vacuous pass on a canon that happens to omit thick/cloth, or one
    // that is all-hybrid). With a 7-word pool spread over 8 problems
    // (sub-8-pool: each word ≥1×, one repeat), both classes are present
    // by construction once the pool ships correctly.
    const targetWords = [...byProblem.values()]
    const hybridTargetsPresent = targetWords.filter((w) =>
      HYBRID_TH_WORDS.has(w),
    )
    const nonHybridTargetsPresent = targetWords.filter((w) =>
      NON_HYBRID_TH_WORDS.has(w),
    )
    // Both hybrid words appear (the 7-word pool, each ≥1× across 8
    // problems, guarantees thick + cloth both surface).
    expect(new Set(hybridTargetsPresent)).toEqual(HYBRID_TH_WORDS)
    // Non-hybrid th words also appear — the gate is PARTIAL, the canon
    // is not all-hybrid. (Count-based: at least the 5 non-hybrid pool
    // words must each surface ≥1× in a correctly-shaped 7-word/8-problem
    // canon.)
    expect(new Set(nonHybridTargetsPresent)).toEqual(NON_HYBRID_TH_WORDS)

    // Sanity: every problem's target word is a th-pool word (guards
    // against a vacuous pass on a blending-cv stub-fallback canon).
    const offPoolTargets = targetWords.filter((w) => !TH_TIER_WORDS.has(w))
    expect(offPoolTargets).toEqual([])
  })

  /**
   * AC1 + AC9 (UI belt-and-braces) — the WordSong chip UI renders
   * th-tier words, not `blending-cv` fallback content; th-trios obey
   * the isolated-th rule; the sub-8-pool invariant holds.
   *
   * Chromium-only (depends on the read-aloud effect firing to enable
   * chips). Walks the full 8-problem session and asserts:
   *   - every chip's `data-word` — target AND distractor — is either a
   *     th-tier pool word OR a shipped th/t-contrast distractor entry
   *     (`tin`, `tick`, `pat`, `bat`, `mat`). Zero `blending-cv` /
   *     generic CVC / sh-tier / ch-tier content leaks (the isolated-th
   *     rule, `digraphs-th-word-list.md` §6 / §8 AC9).
   *   - SUB-8-POOL INVARIANT: the 7-word th pool spread over 8 problems
   *     means the 8 target words are all from the pool, with ≥7
   *     distinct (one word repeats). The assertion is "8 reads, all
   *     from pool, ≥7 distinct" — NEVER "8 distinct" (8 distinct is
   *     impossible with a 7-word pool — the digraphs-sh / digraphs-ch
   *     planner-directive EXCEPTION).
   *
   * On pre-merge main this fails at `installDigraphsThClaudeMock` →
   * `readDigraphsThCanon()` → explicit ENOENT throw.
   */
  test('3. AC1+AC9: WordSong chip UI renders th-tier words across all 8 problems; sub-8-pool invariant holds (8 reads, all from pool, ≥7 distinct); no blending-cv / CVC / sh / ch leakage', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    await installDigraphsThClaudeMock(page)
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
      // The correct chip's word must be a th-tier TARGET word — never a
      // trap distractor and never CVC/sh/ch-tier content.
      const correctWord = await correctChip.getAttribute('data-word')
      expect(correctWord).not.toBeNull()
      expect(TH_TIER_WORDS.has(correctWord!)).toBe(true)

      await correctChip.click()
    }

    // Count-based assertions per
    // feedback_count_assertions_on_regression_tests.md: 24 chip renders
    // (3 × 8), 8 targets.
    expect(allChipWords).toHaveLength(24)
    expect(allTargetWords).toHaveLength(8)

    // Every target word is in the th-tier pool.
    const offPoolTargets = allTargetWords.filter((w) => !TH_TIER_WORDS.has(w))
    expect(offPoolTargets).toEqual([])

    // SUB-8-POOL INVARIANT — the th pool is 7 words spread over 8
    // problems, so 8 distinct is IMPOSSIBLE (the digraphs-sh /
    // digraphs-ch planner-directive EXCEPTION). The correct invariant
    // is "8 reads, all from pool, ≥7 distinct" — every pool word used
    // at least once, exactly one repeat. NEVER assert "8 distinct".
    const distinctTargets = new Set(allTargetWords)
    expect(distinctTargets.size).toBeGreaterThanOrEqual(7)
    expect(distinctTargets.size).toBeLessThanOrEqual(7)
    // All 7 pool words are exercised (each word ≥1× — the sub-8-pool
    // "use each of the 7 at least once" planner directive).
    expect(distinctTargets).toEqual(TH_TIER_WORDS)

    // Every chip word — target AND distractor — is either a th-tier
    // pool word or an allowed th/t-contrast trap. Compute the off-pool
    // intersection explicitly so the failure message names exactly
    // which words leaked (catches blending-cv fallback content + any
    // generic CVC / sh-tier / ch-tier leakage — the isolated-th rule,
    // AC9). `bat`/`mat` ARE allowed — they are the dual-role th/t
    // minimal-pair traps for `bath`/`math`, not generic CVC filler.
    const offPoolChips = allChipWords.filter((w) => !ALLOWED_CHIP_WORDS.has(w))
    expect(offPoolChips).toEqual([])

    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })
  })

  /**
   * AC11 (progression) — a single perfect `digraphs-th-voiceless`
   * session moves the node `intro → practicing`, AND the session that
   * drove the transition ran real th content.
   *
   * THIS IS THE WIRE-LEVEL `intro → practicing` ASSERTION the brief
   * mandates per `feedback_progression_e2e_mandatory` + the digraphs-ch
   * PR #225 review note. The `intro → practicing` transition is the
   * EXACT gap that shipped broken for `cvc-words` — no such transition
   * existed anywhere in the codebase for weeks (memory
   * `feedback_progression_e2e_mandatory`). A canon-shape file-read
   * alone (tests 1-2) would NOT catch a state machine that never moves
   * `digraphs-th-voiceless` out of `intro`.
   *
   * Mock choice — the PER-SPEC `installDigraphsThClaudeMock` (the same
   * mock tests 1 and 3 use), NOT the shared `installClaudeMock` with
   * `failNetwork: true`. Rationale: this test asserts BOTH the
   * transition AND that REAL th content drove it. The `failNetwork`
   * fallback routes WordSong through `pickStaticWordSongPlan()`, whose
   * hardcoded targets are short-a CVC words (`cat`, `mat`, `cap`, ...) —
   * never th-pool words — so the content-half assertion could never
   * pass on that path, even on a green tree. Driving the session with
   * the th-canon mock means the first correct chip carries a real
   * th-pool `data-word`, so the content half is satisfiable post-merge.
   *
   * Pre-merge RED mechanism (precise):
   *   The progression plumbing already works on pre-merge main:
   *   `digraphs-th-voiceless` IS in `WORD_SONG_NODES_IN_ORDER` (PR #211
   *   SkillNode split), so the picker lands on the seeded
   *   `digraphs-th-voiceless: 'intro'` node, the session logs
   *   `skillFocus: ['digraphs-th-voiceless']`, and `applyMasteryRule`'s
   *   intro-pass (PR #201) advances it to `'practicing'`. So a
   *   progression-ONLY assertion would pass pre-merge — false
   *   confidence.
   *   What FAILS pre-merge is setup:
   *   `public/canon/word-song/level-1/digraphs-th-voiceless.json` does
   *   not exist, so `installDigraphsThClaudeMock` →
   *   `readDigraphsThCanon()` throws `ENOENT` before the session walk
   *   even begins. The content-half assertion
   *   `expect(TH_TIER_WORDS.has(firstTargetWord))` is therefore never
   *   reached on pre-merge main — the test is RED at the mock-install
   *   step, the same RED reason as tests 1, 2, and 3.
   *   This is the RIGHT failing reason: the th content (canon file +
   *   first-class planner support) does not exist yet, so a real th
   *   session — the only thing that can satisfy the content half —
   *   cannot be constructed.
   *
   * Post-merge GREEN: the canon file exists, `digraphs-th-voiceless` is
   * first-class, the mock serves real th content, the first correct
   * chip carries a th-pool word, and the intro-pass advances the node
   * to `'practicing'`. Both halves pass.
   *
   * Chromium-only (the session walk depends on the read-aloud effect /
   * chip enablement). Timeout sized explicitly per `testing-and-ci.md`
   * §4.1.1b — single session walk + a progress round-trip read.
   */
  test('4. AC11: one perfect digraphs-th session transitions the node intro → practicing, driven by real th content', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    // Single session walk (~50s wall, th-canon mock) + nav + a progress
    // round-trip read. Default 90s is borderline; 120s gives headroom.
    // Contrast digraphs-sh-progression.spec.ts which runs 4 sessions and
    // needs 240s.
    test.setTimeout(120_000)

    await installDigraphsThClaudeMock(page)
    await page.goto('/')
    // NOTE: do NOT call `forceHowlerUnlock` here. That test seam stubs
    // `Howler.ctx` in a way that makes the real th-canon MP3 nodes throw
    // `Failed to execute 'connect' on 'AudioNode'` when Howler decodes
    // them — `prepareWordSongPathA` then rejects and WordSong silently
    // falls back to the short-a static plan, so `firstTargetWord` would
    // be `cat`, never a th-pool word, and the content-half assertion
    // could never pass. This test drives a real th-canon session, so it
    // relies on the genuine gesture-unlock chain — the same path test 3
    // (the UI walk) uses, which is why test 3 passes without forcing.
    // `forceHowlerUnlock` is only safe on the `failNetwork: true`
    // silent-caption-walk path (e.g. `digraphs-sh-progression.spec.ts`),
    // which never decodes real canon audio.

    // ── Pre-flight: confirm the seed landed and digraphs-th-voiceless
    //    starts at 'intro'. If the seed were silently rejected (the
    //    isParentSettings strict-shape failure mode), the app would
    //    fall back to defaultProgress() and digraphs-th-voiceless would
    //    be 'locked', not 'intro' — catching that here makes a seed-
    //    rejection regression loud instead of a confusing downstream
    //    failure.
    const beforeSession = (await readProgressFromPage(
      page,
    )) as PersistedProgress
    expect(beforeSession).not.toBeNull()
    expect(beforeSession.skillLevels['digraphs-th-voiceless']).toBe('intro')

    // ── Capture the target word the session actually presents.
    //    The th-canon mock serves real th-tier content, so problem 1's
    //    correct chip carries a th-pool `data-word`. We grab it as the
    //    content-half signal: post-merge it is one of the 7 th-pool
    //    words. (Pre-merge this line is never reached — the mock-install
    //    step throws `ENOENT` because the th canon file does not exist.)
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()
    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 10_000 })

    await expect(wordSong).toHaveAttribute('data-problem-index', '0', {
      timeout: 20_000,
    })
    // Wait for the REAL th-canon plan to drive the read-aloud before
    // reading the target word. On cold mount WordSong renders the
    // `pickStaticWordSongPlan()` fallback (short-a CVC) until
    // `prepareWordSongPathA` resolves and swaps in the server plan;
    // `data-read-aloud-played === 'true'` only flips once the real
    // (th-canon) audio has played. Reading `data-word` before this gate
    // would catch the static-fallback CVC word, not the th-pool word —
    // the same gate test 3 uses for its per-problem chip assertions.
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })
    // The correct chip carries `data-word` — the canonical per-problem
    // target word. Read it before the first tap. Driven by the th-canon
    // mock, this is a th-pool word post-merge; the content-half
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
    // 12s → 20s (British-voice rollout). Real-canon-audio session: the
    // session-end recap reveals the CTA only after its recap utterances
    // finish; en-GB-OliviaNeural clips run a touch longer, so the
    // reveal can exceed 12s on Chromium. 20s gives Olivia headroom.
    await expect(cta).toBeVisible({ timeout: 20_000 })
    await cta.click()
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    const afterSession = (await readProgressFromPage(page)) as PersistedProgress
    expect(afterSession).not.toBeNull()

    // SMOKING GUN — the intro→practicing transition fired for
    // `digraphs-th-voiceless` on the first perfect session. The PR #211
    // + #201 plumbing makes this pass; this assertion guards that the
    // plumbing stays wired. The content-half assertion below is what
    // guards that a REAL th session drove it. (Pre-merge this line is
    // never reached — the mock-install step throws `ENOENT`.)
    expect(afterSession.skillLevels['digraphs-th-voiceless']).toBe('practicing')

    // Exactly one history entry, focused on `digraphs-th-voiceless`,
    // perfect score. Count-based per
    // feedback_count_assertions_on_regression_tests.md.
    expect(afterSession.history.length).toBe(1)
    expect(afterSession.history[0]!.skillFocus).toEqual([
      'digraphs-th-voiceless',
    ])
    expect(afterSession.history[0]!.successRate).toBe(1)

    // Downstream sibling stays locked — the cascade only fires on
    // 'mastered', not 'practicing'. `sight-words` is the node after
    // `digraphs-th-voiceless` in `WORD_SONG_NODES_IN_ORDER`.
    expect(afterSession.skillLevels['sight-words']).toBe('locked')

    // CONTENT HALF — the session that drove the transition ran REAL th
    // content. The th-canon mock serves first-class
    // `digraphs-th-voiceless` content, so `firstTargetWord` is one of
    // the 7 th-pool words. This is what makes test 4 a genuine
    // wire-level check rather than a false-green progression-only
    // assertion: the transition firing (above) plus a th-pool word
    // driving it (here) together prove a real th session moved the
    // node. Pre-merge this line is never reached — the mock-install
    // step throws `ENOENT` because the th canon file does not exist
    // yet, the same RED reason as tests 1, 2, and 3.
    expect(TH_TIER_WORDS.has(firstTargetWord!)).toBe(true)
  })
})
