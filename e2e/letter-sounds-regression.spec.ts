/**
 * E2E regression spec — letter-sounds content first-class wiring.
 *
 * React Native Phase 4: Tests 2, 3 and 4 moved to
 * `scripts/canonLetterSounds.test.ts`. They read the canon from disk and
 * need no browser, so they run in Vitest, which outlives the web
 * front end. Test numbers below are the original ones.
 *
 * Ticket: 86c9y49cz (Wave 7 Track A8 — Jessica's regression E2E for the
 * letter-sounds tier). Sibling specs:
 *   - A5 spec:        `design/word-song/letter-sounds-content.md` (Kyle,
 *                     post-#334 Q4/Q6 resolution).
 *   - A6 directive:   `api/_planner.ts` `WORD_SONG_TRACK_GUIDE`
 *                     letter-sounds block (Dave).
 *   - A7 canon+wire:  `public/canon/word-song/level-1/letter-sounds.json`
 *                     + `WORD_SONG_FIRST_CLASS_FOCUS_NODES` entry +
 *                     `PHONEME_OVERRIDES` tier-filter (Devon, PR #337
 *                     commit `4091e95`).
 *   - A4 sibling:     `e2e/letter-names-regression.spec.ts` (Jessica,
 *                     PR #338 — the canonical pattern mirrored here).
 *
 * Sequence note — post-impl regression-guard authoring
 * ---------------------------------------------------
 * A7 has already merged (commit `4091e95`, 2026-05-23): the canon JSON +
 * planner first-class entry + tier-aware `PHONEME_OVERRIDES` are LIVE on
 * main. Per `[[feedback_failing_first_must_prove_green]]`, when impl
 * ships before the spec, the spec must still prove its assertions are
 * SENSITIVE enough to catch a regression — otherwise it's a smoke test
 * that happens to pass, not a regression guard.
 *
 * The modern equivalent of the failing-first RED→GREEN flip is:
 *
 *   (a) the MAIN tests assert the post-impl invariants (lands GREEN on
 *       current main), AND
 *   (b) a separate ASSERTION-SENSITIVITY sub-test installs a WRONG
 *       canon (a payload that violates the directive's invariants) and
 *       asserts the same main-test logic FAILS against the wrong state
 *       — proving the main assertions are real, not vacuous.
 *
 * Both (a) and (b) ship in a single PR. This mirrors the A4 spec
 * (PR #338) test 4 pattern verbatim.
 *
 * SCOPE — what this spec is and isn't
 * ----------------------------------
 * IS:
 *   - The CONTENT-presence + composition-rule spec for the letter-
 *     sounds tier (mirrors the A4 letter-names sibling for a first-
 *     class word-song tier landing).
 *   - Asserts (1) the planner request carries
 *     `progress.focusNode === 'letter-sounds'`, (2) the served canon
 *     carries 8 problems whose read-lines match the
 *     `"Which letter says <MNEMONIC>?"` template + targets are single
 *     ASCII letter glyphs whose mnemonic→IPA mapping is consistent
 *     with A5 §2.3, (3) Dave A6's composition rules hold on the baked
 *     canon (current-target-vowel floor + cap, mastered-consonant
 *     floor, mastered-vowel /æ/ presence, /ɪ/↔/ɛ/ adjacency ban, no
 *     long vowels, gentle-ramp consonants-only at P1-P3, trap-window
 *     current-target-vowel ≥2 at P6-P8), (4) the spec's main checks
 *     fail against a WRONG canon (cvc-words-short-o → CVC content)
 *     proving mutation sensitivity.
 *
 * IS NOT:
 *   - The UI / chip-render walkthrough. The screen-side parser
 *     (`src/screens/WordSong/planFromServer.ts`) currently only
 *     accepts `"Tap the <word>."` / `"Read the <word>."` templates
 *     against `TARGET_WORD_SET`; the canon's `"Which letter says
 *     <MNEMONIC>?"` shape is NOT in the accepted-template list and
 *     would parse-fail at the browser, triggering the silent-demote →
 *     `pickStaticWordSongPlan` blending-cv fallback. A UI walkthrough
 *     that asserts "chip render shows letter glyphs" would be RED on
 *     current main for that reason. Render-side wiring (parser +
 *     screen widening for the letter-sounds template) is out of scope
 *     for A7; it lands in a follow-up parser+screen widening ticket
 *     (Kevin A8b is the parallel-track ticket per the orchestrator
 *     brief). This spec asserts the planner/canon CONTRACT — the
 *     right wire-level signal — so when the screen widening lands,
 *     this spec plus a sibling chip-render spec together pin both
 *     ends of the pipeline.
 *
 * Mock strategy
 * -------------
 * `installLetterSoundsClaudeMock` reads the bytes of
 * `public/canon/word-song/level-1/letter-sounds.json` and returns them
 * on word-song requests, captures every observed request body for the
 * planner-contract assertion (the `progress.focusNode` check). Math
 * requests are rejected with 500 — the letter-sounds flow only
 * triggers a word-song fetch; a stray math request would mean the
 * spec's invariants are wrong, and we'd rather see a loud error than
 * a silent pass. Same canon-bytes pass-through pattern as the A4
 * letter-names sibling and the cvc regression siblings — per
 * `testing-and-ci.md` §4.1.1d / §4.2 the canon-bytes mock is the
 * correct shape here (NOT `failNetwork: true`, which would route-
 * abort before the served-canon could influence test state, and which
 * under the static fallback rotation would serve add-to-10 math
 * content for a word-song spec).
 *
 * Per `[[feedback_force_howler_unlock_demote_extension]]`:
 * `forceHowlerUnlock` is NOT called from this spec — the assertions
 * here are payload assertions only (planner request body + canon JSON
 * on disk), not audio-playback assertions. A spec that read DOM
 * `data-read-aloud-played` state on the screen would need to either
 * call `forceHowlerUnlock` OR be chromium-only (real AudioContext);
 * this spec sidesteps the gate entirely by inspecting the planner
 * contract instead of the screen state. The letter-sounds canon ships
 * pre-rendered MP3s with phoneme-wrapped pronunciation (Devon A7
 * Amendment 1), so a future render-side spec MUST account for the
 * silent-demote risk — flagged here, not exercised here.
 *
 * Seed note — letter-sounds default is 'practicing'
 * -------------------------------------------------
 * Per `src/lib/progress/defaults.ts:125` and `e2e/_helpers/
 * seedStorage.ts:110`, `letter-sounds` defaults to `'practicing'` in
 * the diagnostic baseline. `letter-names` defaults to `'mastered'`
 * (alphabet mastered per CLAUDE.md current-levels). With those
 * defaults `pickFocusNode()` walks the literacy track, skips
 * letter-names (mastered), and stops at letter-sounds. We STILL
 * explicitly set both overrides for defence-in-depth: if a future
 * defaults.ts change flips letter-sounds to `'mastered'` (e.g. after
 * Marian masters the tier), the picker would walk past and this
 * spec's `requests` assertion would catch nothing useful. The
 * explicit override pins the picker target.
 *
 * Why some tests skip on webkit
 * -----------------------------
 * Same harness limitation as the A4 + cvc + digraphs-sh siblings —
 * WebKit headless has no AudioContext. Test 1 inspects the planner
 * request body which requires the `/api/claude` POST to fire — that's
 * a NETWORK event triggered by `App.tsx`'s word-song kick-effect on
 * Hub mount, NOT by audio playback. So test 1 runs on BOTH chromium +
 * webkit. Tests 2-4 inspect ONLY the canon JSON on disk (no browser
 * interaction at all) so they run on both browsers natively. There is
 * no chromium-only sub-test in this spec — the payload-only scope
 * makes the WebKit AudioContext limitation moot, same as A4.
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
 * Path to the production letter-sounds canon the spec serves as the
 * mock response. Resolved relative to `process.cwd()` because
 * Playwright runs the harness from the worktree root (same place
 * `vite preview` reads `public/`). Hardcoding the relative path means
 * the spec breaks loudly if the canon ever moves.
 */
const LETTER_SOUNDS_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/letter-sounds.json',
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

/** Read + parse a canon file from disk. Throws with explicit context
 *  on parse failure so a malformed canon surfaces unambiguously in CI
 *  logs rather than hiding behind a JSON.parse stack trace. */
function readCanon(path: string): { raw: string; parsed: CanonShape } {
  const raw = readFileSync(path, 'utf-8')
  try {
    const parsed = JSON.parse(raw) as CanonShape
    return { raw, parsed }
  } catch (err) {
    throw new Error(
      `[letter-sounds-regression spec] failed to JSON.parse canon at ` +
        `${path}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
}

/**
 * Install a `/api/claude` mock that returns the letter-sounds canon
 * on word-song requests and captures every observed request body for
 * the planner-contract assertion. Math (or any other) requests
 * rejected with 500 — a stray math request would mean the spec's
 * invariants are wrong.
 */
async function installLetterSoundsClaudeMock(
  page: Page,
): Promise<{ requests: Request[] }> {
  const { raw: canonBody } = readCanon(LETTER_SOUNDS_CANON_PATH)
  return installWordSongMockWithBody(page, canonBody)
}

/**
 * Sibling of `installLetterSoundsClaudeMock` that serves a CUSTOM
 * canon body. Reserved for future sensitivity sub-tests that need to
 * serve the WRONG canon from inside a Playwright route — test 4 in
 * this spec runs the broken-canon check against the on-disk JSON
 * directly (no browser interaction needed), so this helper is
 * provided for completeness + symmetry with the A4 sibling spec.
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
        message: `letter-sounds-regression spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

/**
 * Seed the persisted Progress + SessionHistory blobs so the App's
 * `pickFocusNode()` returns `letter-sounds` as the picked focus.
 *
 *  - Per `src/lib/progress/defaults.ts`, `letter-names` defaults to
 *    `'mastered'` (Marian's alphabet is mastered) and `letter-sounds`
 *    defaults to `'practicing'`. With those defaults `pickFocusNode()`
 *    walks the literacy track and naturally stops at letter-sounds.
 *    We STILL set both explicitly for defence-in-depth: if a future
 *    defaults change flips letter-sounds to `'mastered'` (e.g. after
 *    Marian masters the tier), the picker would walk past and this
 *    spec's `requests` assertion would catch nothing useful.
 *  - SessionHistory `sessionCount: 5` skips Greet (Splash advances
 *    direct to Hub when sessionCount > 0).
 *
 * Because `pickFocusNode()` walks the literacy track in declaration
 * order and stops at the FIRST non-mastered node, setting
 * `letter-sounds: 'practicing'` + `letter-names: 'mastered'` is
 * sufficient — every node AFTER letter-sounds in the literacy track
 * is irrelevant to the picker's decision once it stops at slot 1.
 */
async function seedLetterSoundsProgress(page: Page): Promise<void> {
  await seedLocalStorage(page, {
    progress: buildSeedProgress({
      skillLevelOverrides: {
        'letter-names': 'mastered',
        'letter-sounds': 'practicing',
      },
    }),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
}

test.describe('letter-sounds content first-class wiring (Wave 7 Track A7/A8)', () => {
  test.beforeEach(async ({ page }) => {
    await seedLetterSoundsProgress(page)
  })

  /**
   * Test 1 — Planner request fires with `focusNode: 'letter-sounds'`.
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
   *     'letter-sounds'` — proves the picker walked the literacy
   *     track and stopped at the seeded letter-sounds node.
   *
   * Wire-level picker contract — inspecting the outgoing request body
   * is the cleanest signal for the focus-node selection, ahead of any
   * silent-demote in the response handling.
   */
  test('1. planner request fires once on Hub with progress.focusNode === "letter-sounds"', async ({
    page,
  }) => {
    const { requests } = await installLetterSoundsClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    // Greet must NOT be on screen — proves the session-history seed
    // bumped sessionCount past the Greet gate.
    await expect(page.getByTestId('greet')).toHaveCount(0)

    // Wait for the kick-effect's POST to land. Polls the requests
    // array up to 15s; same shape as the A4 + cvc + digraphs-sh
    // siblings.
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
    expect(progressBlock.focusNode).toBe('letter-sounds')
  })
})
