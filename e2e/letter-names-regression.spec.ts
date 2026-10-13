/**
 * E2E regression spec — letter-names content first-class wiring.
 *
 * React Native Phase 4: Tests 2, 3 and 4 moved to
 * `scripts/canonLetterNames.test.ts`. They read the canon from disk and
 * need no browser, so they run in Vitest, which outlives the web
 * front end. Test numbers below are the original ones.
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
})
