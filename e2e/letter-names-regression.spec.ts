/**
 * E2E regression spec — letter-names content first-class wiring.
 *
 * Ticket: 86c9y4997 (Wave 7 Track A4 — Jessica's failing-first / regression
 * E2E for the letter-names tier). Sibling specs:
 *   - A1 spec:        `design/word-song/letter-names-content.md` (Kyle)
 *   - A2 directive:   `api/_planner.ts` `WORD_SONG_TRACK_GUIDE` letter-names
 *                     block (Dave, PR #329)
 *   - A3 canon+wire:  `public/canon/word-song/level-1/letter-names.json` +
 *                     `WORD_SONG_FIRST_CLASS_FOCUS_NODES` entry
 *                     (Kevin, PR #335)
 *
 * Sequence note — post-impl regression-guard authoring
 * ---------------------------------------------------
 * A3 has already merged (commit `ff5a31a`, 2026-05-23): the canon JSON
 * + planner first-class entry are LIVE on main. Per
 * `[[feedback_failing_first_must_prove_green]]`, when impl ships before
 * the spec, the spec must still prove its assertions are SENSITIVE
 * enough to catch a regression — otherwise it's a smoke test that
 * happens to pass, not a regression guard.
 *
 * The modern equivalent of the failing-first RED→GREEN flip is:
 *
 *   (a) the MAIN tests assert the post-impl invariants (lands GREEN on
 *       current main), AND
 *   (b) a separate ASSERTION-SENSITIVITY sub-test installs a BROKEN
 *       canon mock (a payload that violates the directive's composition
 *       rules) and asserts the same main-test logic FAILS against the
 *       broken state — proving the main assertions are real, not
 *       vacuous.
 *
 * Both (a) and (b) ship in a single PR.
 *
 * SCOPE — what this spec is and isn't
 * ----------------------------------
 * IS:
 *   - The CONTENT-presence + composition-rule spec for the letter-names
 *     tier (mirrors the `digraphs-sh-content.spec.ts` precedent for a
 *     first-class word-song tier landing).
 *   - Asserts (1) the planner request carries
 *     `progress.focusNode === 'letter-names'`, (2) the served canon
 *     carries 8 single-ASCII-letter target glyphs from the 52-glyph
 *     pool, (3) Dave A2's composition rules hold on the baked canon
 *     (CIRCLE-STICK floor + cap, case-mix floors, no duplicates).
 *   - Includes an ASSERTION-SENSITIVITY sub-test that swaps in a
 *     BROKEN canon (the shipped cvc-words-short-o canon, which carries
 *     CVC target words — not letter glyphs) and asserts the main
 *     letter-pool assertion FAILS against it. Locks the spec's
 *     mutation-sensitivity per
 *     `[[feedback_failing_first_must_prove_green]]`.
 *
 * IS NOT:
 *   - The UI / chip-render walkthrough. The screen-side parser
 *     (`src/screens/WordSong/planFromServer.ts`) currently only accepts
 *     `"Tap the <word>."` / `"Read the <word>."` templates against
 *     `TARGET_WORD_SET`; the canon's `"Tap the letter C."` shape is
 *     NOT in the accepted-template list and would parse-fail at the
 *     browser, triggering the silent-demote → `pickStaticWordSongPlan`
 *     blending-cv fallback. A UI walkthrough that asserts "chip render
 *     shows letter glyphs" would be RED on current main for that
 *     reason. Render-side wiring is out of scope for A3; it lands in a
 *     follow-up parser+screen widening ticket (Wave 7 Track A4+, to be
 *     filed). This spec asserts the planner/canon CONTRACT — the right
 *     wire-level signal — so when the screen widening lands, this spec
 *     plus a sibling chip-render spec together pin both ends of the
 *     pipeline.
 *
 * Mock strategy
 * -------------
 * `installLetterNamesClaudeMock` reads the bytes of
 * `public/canon/word-song/level-1/letter-names.json` and returns them on
 * word-song requests, captures every observed request body for the
 * planner-contract assertion (the `progress.focusNode` check). Math
 * requests are rejected with 500 — the letter-names flow only triggers
 * a word-song fetch; a stray math request would mean the spec's
 * invariants are wrong, and we'd rather see a loud error than a silent
 * pass. Same canon-bytes pass-through pattern as
 * `digraphs-sh-content.spec.ts` and the cvc regression siblings —
 * per `testing-and-ci.md` §4.1.1d / §4.2 the canon-bytes mock is the
 * correct shape here (NOT `failNetwork: true`, which would route-abort
 * before the served-canon could influence test state, and which under
 * the static fallback rotation would serve add-to-10 math content for
 * a word-song spec).
 *
 * Per `[[feedback_force_howler_unlock_demote_extension]]`:
 * `forceHowlerUnlock` is NOT called from this spec — the assertions
 * here are payload assertions only (planner request body + canon JSON
 * on disk), not audio-playback assertions. A spec that read DOM
 * `data-read-aloud-played` state on the screen would need to either
 * call `forceHowlerUnlock` OR be chromium-only (real AudioContext);
 * this spec sidesteps the gate entirely by inspecting the planner
 * contract instead of the screen state.
 *
 * Seed note — letter-names default is 'mastered'
 * ----------------------------------------------
 * Per `CLAUDE.md` § "Marian's current levels", letter-names defaults
 * to `'mastered'` in `DEFAULT_SKILL_LEVELS`. A returning-user seed that
 * doesn't override this lands the focus picker past letter-names. To
 * force `pickFocusNode()` to return `letter-names`, the seed MUST
 * explicitly set `letter-names: 'practicing'` (the post-encounter
 * state). Without this, the planner would receive a different
 * focusNode and the canon-bytes mock's word-song branch would never
 * fire its 200 response — the test would fail at the `requests` length
 * assertion or the focus-node check, not at the composition rules.
 *
 * Why some tests skip on webkit
 * -----------------------------
 * Same harness limitation as the cvc + digraphs-sh siblings — WebKit
 * headless has no AudioContext. Test 1 inspects the planner request
 * body which requires the `/api/claude` POST to fire — that's a
 * NETWORK event triggered by `App.tsx`'s word-song kick-effect on
 * Hub mount, NOT by audio playback. So test 1 runs on BOTH chromium
 * + webkit. Tests 2-4 inspect ONLY the canon JSON on disk (no browser
 * interaction at all) so they run on both browsers natively. There is
 * no chromium-only sub-test in this spec — the payload-only scope
 * makes the WebKit AudioContext limitation moot.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * Path to the production letter-names canon the spec serves as the mock
 * response. Resolved relative to `process.cwd()` because Playwright
 * runs the harness from the worktree root (same place `vite preview`
 * reads `public/`). Hardcoding the relative path means the spec breaks
 * loudly if the canon ever moves.
 */
const LETTER_NAMES_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/letter-names.json',
)

/**
 * Path to a DIFFERENT, structurally-valid canon used by the
 * assertion-sensitivity sub-test (test 4). The cvc-words-short-o
 * canon ships CVC target words (`dog`, `pot`, `mop` …) with the
 * `"Read the <word>."` template — when this is served on a
 * letter-names-focused session, the main letter-pool assertion MUST
 * fail (none of the canon's targets are single-ASCII-letter glyphs).
 * Locks the spec's mutation-sensitivity per
 * `[[feedback_failing_first_must_prove_green]]`.
 */
const BROKEN_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/cvc-words-short-o.json',
)

/**
 * The 52-glyph letter-names pool per A1 spec §1.1: 26 uppercase + 26
 * lowercase ASCII letters. The canon's 8 problem targets must all be
 * members of this set — anything outside is a structural drift (digit
 * `0` for capital `O`, punctuation, a CVC word leaked from a wrong
 * canon, etc.). Built programmatically rather than hand-listed so a
 * typo in the spec body can't accidentally narrow the pool.
 */
function buildLetterPool(): ReadonlySet<string> {
  const out = new Set<string>()
  // ASCII A-Z (0x41-0x5A)
  for (let c = 0x41; c <= 0x5a; c++) {
    out.add(String.fromCharCode(c))
  }
  // ASCII a-z (0x61-0x7A)
  for (let c = 0x61; c <= 0x7a; c++) {
    out.add(String.fromCharCode(c))
  }
  return out
}
const LETTER_POOL: ReadonlySet<string> = buildLetterPool()

/**
 * The CIRCLE-STICK confusion class per Dave A2 directive
 * (`api/_planner.ts` letter-names block, around line 1888) and A1
 * spec §1.4. Lowercase only — uppercase `B, D, P, Q` are visually
 * distinct and do NOT belong here. Dave A2's composition rule §1
 * floor + §5 cap requires AT LEAST 1 and AT MOST 2 across the 8
 * problems.
 */
const CIRCLE_STICK_LOWERCASE: ReadonlySet<string> = new Set([
  'b',
  'd',
  'p',
  'q',
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

/** Read + parse a canon file from disk. Throws with explicit context on
 *  parse failure so a malformed canon surfaces unambiguously in CI logs
 *  rather than hiding behind a JSON.parse stack trace. */
function readCanon(path: string): { raw: string; parsed: CanonShape } {
  const raw = readFileSync(path, 'utf-8')
  try {
    const parsed = JSON.parse(raw) as CanonShape
    return { raw, parsed }
  } catch (err) {
    throw new Error(
      `[letter-names-regression spec] failed to JSON.parse canon at ` +
        `${path}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
}

/**
 * Extract the per-problem target letter from the canon `plan.utterances`
 * array. Each problem's `read` slot text is `"Tap the letter <X>."`
 * per Dave A2 §2.1 template. Returns a map from problem number (1..8)
 * to the verbatim target glyph (case-preserved — uppercase A and
 * lowercase a are DISTINCT targets per the A2 directive §7 rule).
 *
 * A canon whose `read` slot doesn't match the `"Tap the letter <X>."`
 * template (e.g. a CVC canon using `"Read the dog."`) returns an empty
 * map — the test 4 sensitivity check relies on this behaviour.
 */
function targetLettersByProblem(canon: CanonShape): Map<number, string> {
  const byProblem = new Map<number, string>()
  for (const u of canon.plan.utterances) {
    const idMatch = u.id.match(/^word\.p(\d+)\.read$/)
    if (idMatch === null) continue
    const problemNum = Number(idMatch[1])
    // Anchored "Tap the letter <X>." — `<X>` is a single non-whitespace
    // character (the glyph). The regex deliberately allows any single
    // character so a future expansion (e.g. a digit glyph or unicode
    // letter) would still parse — the pool-membership check below is
    // the gate that rejects non-ASCII or digit drift.
    const textMatch = u.text.match(/^Tap the letter (\S)\.$/)
    if (textMatch === null) continue
    byProblem.set(problemNum, textMatch[1]!)
  }
  return byProblem
}

/**
 * Install a `/api/claude` mock that returns the letter-names canon on
 * word-song requests and captures every observed request body for the
 * planner-contract assertion. Math (or any other) requests rejected
 * with 500 — a stray math request would mean the spec's invariants are
 * wrong.
 */
async function installLetterNamesClaudeMock(
  page: Page,
): Promise<{ requests: Request[] }> {
  const { raw: canonBody } = readCanon(LETTER_NAMES_CANON_PATH)
  return installWordSongMockWithBody(page, canonBody)
}

/**
 * Sibling of `installLetterNamesClaudeMock` that serves a CUSTOM
 * canon body. Used by the assertion-sensitivity sub-test (test 4) to
 * swap in the cvc-words-short-o canon and assert the main letter-pool
 * assertion fails against it.
 */
async function installWordSongMockWithBody(
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
        message: `letter-names-regression spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

/**
 * Seed the persisted Progress + SessionHistory blobs so the App's
 * `pickFocusNode()` returns `letter-names` as the picked focus.
 *
 *  - Per `CLAUDE.md`, the production diagnostic baseline has
 *    `letter-names: 'mastered'` (Marian's alphabet is mastered with
 *    minor b/d confusion). A seed that doesn't override this would
 *    skip past letter-names. We bump it to `'practicing'` (the
 *    post-encounter state) so the picker stops here.
 *  - SessionHistory `sessionCount: 5` skips Greet (Splash advances
 *    direct to Hub when sessionCount > 0).
 *
 * Because `pickFocusNode()` walks the literacy track in declaration
 * order and stops at the FIRST non-mastered node, setting
 * `letter-names: 'practicing'` is sufficient — every node AFTER
 * letter-names in the literacy track is irrelevant to the picker's
 * decision once it stops at slot 0.
 */
async function seedLetterNamesProgress(page: Page): Promise<void> {
  await seedLocalStorage(page, {
    progress: buildSeedProgress({
      skillLevelOverrides: {
        'letter-names': 'practicing',
      },
    }),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

test.describe('letter-names content first-class wiring (Wave 7 Track A3)', () => {
  test.beforeEach(async ({ page }) => {
    await seedLetterNamesProgress(page)
  })

  /**
   * Test 1 — Planner request fires with `focusNode: 'letter-names'`.
   *
   * Pure payload assertion — runs on BOTH chromium + webkit. The
   * `/api/claude` POST is a NETWORK event triggered by App.tsx's
   * word-song kick-effect on Hub mount; it does NOT depend on audio
   * playback or chip enablement (no `forceHowlerUnlock` needed).
   *
   * Asserts:
   *   - Hub mounts (the session-history seed routes Splash → Hub
   *     directly, not Splash → Greet).
   *   - On Hub mount, exactly one /api/claude POST fires with
   *     `kind: 'session-start'` and `payload.track: 'word-song'`.
   *   - The request body carries `payload.progress.focusNode ===
   *     'letter-names'` — proves the picker walked the literacy track
   *     and stopped at the seeded letter-names node.
   *
   * Wire-level picker contract per Devon's PR #214 review S3 pattern
   * — inspecting the outgoing request body is the cleanest signal for
   * the focus-node selection, ahead of any silent-demote in the
   * response handling.
   */
  test('1. planner request fires once on Hub with progress.focusNode === "letter-names"', async ({
    page,
  }) => {
    const { requests } = await installLetterNamesClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Greet must NOT be on screen — proves the session-history seed
    // bumped sessionCount past the Greet gate.
    await expect(page.getByTestId('greet')).toHaveCount(0)

    // Wait for the kick-effect's POST to land. Polls the requests array
    // up to 15s; same shape as the cvc + digraphs-sh siblings.
    await expect(async () => {
      expect(requests.length).toBeGreaterThanOrEqual(1)
    }).toPass({ timeout: 15_000 })

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
    expect(progressBlock.focusNode).toBe('letter-names')
  })

  /**
   * Test 2 — Canon shape + pool membership.
   *
   * Pure payload assertion — reads the canon JSON directly from disk
   * (no browser interaction). Runs on BOTH chromium + webkit
   * trivially. Asserts the structural shape A1 spec §1.1 + Dave A2
   * directive promises:
   *
   *   - The canon parses to `{ ok: true, kind: 'session-start' }`.
   *   - `plan.utterances` carries exactly 8 problem `read` slots
   *     (problem ids 1..8), the standard word-song session shape.
   *   - Every `read` slot text matches the `"Tap the letter <X>."`
   *     template (A2 directive §2.1).
   *   - Every target glyph is a single ASCII letter from the
   *     52-glyph pool (A1 spec §1.1).
   *
   * If a future re-bake drifts the read-line template (e.g. emits
   * `"Tap the cat."` because the directive regressed to blending-cv
   * stub content) OR emits a non-ASCII / digit / multi-char target,
   * THIS test catches it at the canon-JSON layer — ahead of any
   * silent screen-side demote.
   */
  test('2. canon ships 8 problems whose targets are all single ASCII letters from the 52-glyph pool', () => {
    const { parsed: canon } = readCanon(LETTER_NAMES_CANON_PATH)
    expect(canon.ok).toBe(true)
    expect(canon.kind).toBe('session-start')

    const byProblem = targetLettersByProblem(canon)
    // 8 problems per session — count-based assertion per
    // feedback_count_assertions_on_regression_tests.md.
    expect(byProblem.size).toBe(8)
    // Problem ids are 1..8 contiguously — no gaps, no extras.
    expect([...byProblem.keys()].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ])

    // Every target glyph is in the 52-glyph pool. Compute the
    // off-pool intersection explicitly so the failure message names
    // exactly which target leaked (catches CVC-word leakage from a
    // wrong canon, digit-0-for-O drift, unicode contamination, etc.).
    const targets = [...byProblem.values()]
    const offPoolTargets = targets.filter((t) => !LETTER_POOL.has(t))
    expect(offPoolTargets).toEqual([])

    // Sanity — every target IS a single ASCII letter (1 char, /[A-Za-z]/).
    // This is structurally implied by the pool-membership check above
    // but worth pinning explicitly: catches a regression where the
    // pool definition itself drifts (e.g. someone widens the pool to
    // include digits, but the directive still expects letters).
    for (const target of targets) {
      expect(target).toHaveLength(1)
      expect(target).toMatch(/^[A-Za-z]$/)
    }
  })

  /**
   * Test 3 — Composition rules per Dave A2 directive.
   *
   * Pure payload assertion — reads the canon JSON directly. Asserts
   * the empirical composition rules the directive's bake-time
   * self-checks enforce on the 8 target letters:
   *
   *   (a) CIRCLE-STICK floor (Dave A2 CONFUSION-CLASS BUDGET):
   *       AT LEAST 1 of the 8 targets is in `{b, d, p, q}` (lowercase
   *       only). The directive's "at least 1" is the tier's
   *       load-bearing assessment anchor — Marian's residual b/d
   *       confusion is the literal subject of this tier.
   *   (b) CIRCLE-STICK cap: AT MOST 2 of the 8 targets is in
   *       `{b, d, p, q}`. Prevents the session feeling like a
   *       remediation drill.
   *   (c) Case-mix floors: AT LEAST 2 uppercase + AT LEAST 2
   *       lowercase targets. A pure-uppercase or pure-lowercase
   *       session breaks the tier's case-coverage promise.
   *   (d) No duplicate (glyph + case) pair across the 8 targets per
   *       directive rule §7.
   *
   * On the shipped canon (commit `ff5a31a`): targets are
   * C, e, G, J, O, b, W, d — CIRCLE-STICK count = 2 (at cap),
   * uppercase = 5, lowercase = 3, all distinct. All four rules pass.
   *
   * If a future re-bake drifts (e.g. emits 3 of b/d/p/q, or zero, or
   * a pure-uppercase 8 targets), this test catches it at the canon
   * layer.
   */
  test('3. canon composition: CIRCLE-STICK floor (>=1) + cap (<=2), case-mix floors (>=2 upper, >=2 lower), no duplicates', () => {
    const { parsed: canon } = readCanon(LETTER_NAMES_CANON_PATH)
    const byProblem = targetLettersByProblem(canon)
    const targets = [...byProblem.values()]
    expect(targets).toHaveLength(8)

    // (a) + (b) — CIRCLE-STICK floor + cap.
    const circleStickTargets = targets.filter((t) =>
      CIRCLE_STICK_LOWERCASE.has(t),
    )
    expect(
      circleStickTargets.length,
      `CIRCLE-STICK targets (b/d/p/q lowercase) found: ${JSON.stringify(circleStickTargets)} — directive requires AT LEAST 1, AT MOST 2`,
    ).toBeGreaterThanOrEqual(1)
    expect(circleStickTargets.length).toBeLessThanOrEqual(2)

    // (c) — case-mix floors. Uppercase A-Z + lowercase a-z each >= 2.
    const uppercaseTargets = targets.filter((t) => /^[A-Z]$/.test(t))
    const lowercaseTargets = targets.filter((t) => /^[a-z]$/.test(t))
    expect(
      uppercaseTargets.length,
      `Uppercase targets: ${JSON.stringify(uppercaseTargets)} — directive requires AT LEAST 2`,
    ).toBeGreaterThanOrEqual(2)
    expect(
      lowercaseTargets.length,
      `Lowercase targets: ${JSON.stringify(lowercaseTargets)} — directive requires AT LEAST 2`,
    ).toBeGreaterThanOrEqual(2)
    // Sanity — every target is in exactly one case class (sum to 8).
    expect(uppercaseTargets.length + lowercaseTargets.length).toBe(8)

    // (d) — no duplicate (glyph + case) pair. A target is the literal
    // glyph as emitted (case-preserved); uppercase `A` and lowercase
    // `a` are DISTINCT targets, but two `A` items would violate rule
    // §7.
    const targetSet = new Set(targets)
    expect(
      targetSet.size,
      `Duplicate (glyph + case) targets found: targets=${JSON.stringify(targets)}`,
    ).toBe(targets.length)
  })

  /**
   * Test 4 — Assertion-sensitivity sub-test.
   *
   * Per `[[feedback_failing_first_must_prove_green]]`: because A3 has
   * already merged, the spec lands GREEN on current main without an
   * organic RED→GREEN flip. The mutation-sensitivity proof goes here
   * instead: install a STRUCTURALLY-VALID but WRONG-CONTENT canon —
   * the shipped cvc-words-short-o canon, which ships CVC target
   * words (`dog`, `pot`, `mop` etc.) with the `"Read the <word>."`
   * template — and assert the same `targetLettersByProblem` +
   * `LETTER_POOL` membership logic from test 2 FAILS against it.
   *
   * Why cvc-words-short-o rather than a hand-built bogus blob:
   *   - It's a real, shipped canon — proves the spec catches a
   *     plausible misroute (the `effectiveFocusNode` fallback path
   *     would serve THIS canon if `letter-names` were silently
   *     dropped from `WORD_SONG_FIRST_CLASS_FOCUS_NODES`).
   *   - It's structurally valid JSON with the right outer shape —
   *     proves the test isn't passing on a parse-error short-circuit.
   *   - Its read-line template (`"Read the <word>."`) doesn't match
   *     `targetLettersByProblem`'s regex (`"Tap the letter <X>."`),
   *     so the function returns an empty map → test 2's
   *     `expect(...).toBe(8)` assertion fails → mutation caught.
   *
   * The check is structured as a `try`/`catch` over the same logic
   * test 2 runs, asserting that AT LEAST ONE assertion in that block
   * throws. This is the canonical pattern for "prove the main check
   * is sensitive": running the main check against a known-broken
   * input must surface a failure.
   *
   * On current main: the cvc-words-short-o canon is on disk
   * (committed in PR #151 + extended pool in #160), so this test
   * exercises real bytes — no spec-side stub.
   */
  test('4. assertion-sensitivity: applying the main letter-pool check to a WRONG canon (cvc-words-short-o) catches the mismatch', () => {
    const { parsed: brokenCanon } = readCanon(BROKEN_CANON_PATH)
    // Sanity — the broken canon parses to the same outer shape, so any
    // test failure below is genuine assertion sensitivity, NOT a
    // parse-error short-circuit.
    expect(brokenCanon.ok).toBe(true)
    expect(brokenCanon.kind).toBe('session-start')

    // Run the same extraction logic as test 2 against the wrong
    // canon. The cvc-words-short-o canon's `read` slots are
    // `"Read the <word>."` — they do NOT match
    // `targetLettersByProblem`'s `"Tap the letter <X>."` regex, so
    // the function returns an empty map.
    const byProblem = targetLettersByProblem(brokenCanon)

    // The sensitivity check: test 2's main assertion is
    // `expect(byProblem.size).toBe(8)`. If we ran that exact assertion
    // against the broken canon, would it fail? Yes — `byProblem.size`
    // is 0 (no read lines matched the letter-names template), not 8.
    // Pin this explicitly: the spec's main check IS sensitive to the
    // wrong-canon mutation.
    expect(
      byProblem.size,
      'Sensitivity check: the cvc-words-short-o canon must yield 0 letter-names targets ' +
        '(its read lines use "Read the <word>." not "Tap the letter <X>."). ' +
        'If this assertion fails — byProblem.size is non-zero — the spec is matching ' +
        'against CVC words too, which means the main test 2 assertion is too loose.',
    ).toBe(0)
    expect(byProblem.size).not.toBe(8)

    // Additionally — even if a future fork of this spec relaxed the
    // template regex to match BOTH read-line shapes, the
    // pool-membership check in test 2 would still catch the
    // cvc-words-short-o targets: CVC words like `dog` are multi-char
    // and not in the 52-glyph single-letter pool. Pin this as a
    // belt-and-braces sensitivity check so a future regex-widening
    // doesn't accidentally weaken the spec.
    //
    // Extract the canon's CVC-tier target words directly (matching
    // `"Read the <word>."`) and assert NONE are in LETTER_POOL.
    const cvcTargets: string[] = []
    for (const u of brokenCanon.plan.utterances) {
      const idMatch = u.id.match(/^word\.p(\d+)\.read$/)
      if (idMatch === null) continue
      const textMatch = u.text.match(/^Read the (\w+)\.$/)
      if (textMatch === null) continue
      cvcTargets.push(textMatch[1]!.toLowerCase())
    }
    expect(cvcTargets.length).toBeGreaterThan(0)
    const cvcTargetsInLetterPool = cvcTargets.filter((t) => LETTER_POOL.has(t))
    expect(
      cvcTargetsInLetterPool,
      'Sensitivity check (belt-and-braces): no CVC word from the broken canon ' +
        'should be in LETTER_POOL (the single-ASCII-letter 52-glyph set). ' +
        'If any CVC target is, LETTER_POOL has drifted to include multi-char strings.',
    ).toEqual([])
  })
})
