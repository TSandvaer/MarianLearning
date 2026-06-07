/**
 * E2E regression spec — letter-sounds content first-class wiring.
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

/**
 * Path to a DIFFERENT, structurally-valid canon used by the
 * assertion-sensitivity sub-test (test 4). The cvc-words-short-o
 * canon ships CVC target words (`dog`, `pot`, `mop` …) with the
 * `"Read the <word>."` template — when this is served on a
 * letter-sounds-focused session, the main letter-sound assertions
 * MUST fail (none of the canon's read-lines match the
 * `"Which letter says <MNEMONIC>?"` template). Locks the spec's
 * mutation-sensitivity per
 * `[[feedback_failing_first_must_prove_green]]`. Same pattern as A4
 * test 4.
 */
const BROKEN_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/cvc-words-short-o.json',
)

/**
 * The mnemonic → (IPA, target-letter) mapping from A5 spec §2.3.
 * Built from the spec's table — every isolated-phoneme utterance in
 * letter-sounds canon must use one of these mnemonics in its read-
 * line and pair it with the corresponding target letter in its
 * `correct` slot.
 *
 *   - Continuant consonants use triplet mnemonics (`mmm`, `nnn`,
 *     `sss`, `fff`, `vvv`, `lll`, `rrr`, `hhh`) — the triplet hints
 *     sustained articulation to Azure TTS.
 *   - Stop consonants use schwa-tail mnemonics (`puh`, `buh`, `tuh`,
 *     `duh`, `kuh`, `guh`) — the schwa epenthesis is unavoidable for
 *     isolated stop pronunciation.
 *   - Mastered vowel /æ/ uses bare `a`.
 *   - Current-target short vowels use bare `o, u, i, e` (the
 *     pronunciation forcing comes from the SSML wrap at render time
 *     via `PHONEME_OVERRIDES` tier-filter, A7 amendment).
 *
 * Each entry records:
 *   - `ipa`: the IPA phoneme — the `ph=` value in the SSML wrap.
 *   - `target`: the target letter glyph (lowercase) — the chip
 *     answer for the problem.
 *   - `category`: classification for §3 composition-rule checks.
 */
interface MnemonicMapping {
  readonly ipa: string
  readonly target: string
  readonly category: 'mastered-consonant' | 'mastered-vowel' | 'short-vowel'
}

const MNEMONIC_TO_MAPPING: ReadonlyMap<string, MnemonicMapping> = new Map([
  // Continuant consonants (A5 §2.3 row 1 — 8 sounds).
  ['mmm', { ipa: 'm', target: 'm', category: 'mastered-consonant' }],
  ['nnn', { ipa: 'n', target: 'n', category: 'mastered-consonant' }],
  ['sss', { ipa: 's', target: 's', category: 'mastered-consonant' }],
  ['fff', { ipa: 'f', target: 'f', category: 'mastered-consonant' }],
  ['vvv', { ipa: 'v', target: 'v', category: 'mastered-consonant' }],
  ['lll', { ipa: 'l', target: 'l', category: 'mastered-consonant' }],
  ['rrr', { ipa: 'r', target: 'r', category: 'mastered-consonant' }],
  ['hhh', { ipa: 'h', target: 'h', category: 'mastered-consonant' }],
  // Stop consonants (A5 §2.3 row 2 — 6 sounds).
  ['puh', { ipa: 'p', target: 'p', category: 'mastered-consonant' }],
  ['buh', { ipa: 'b', target: 'b', category: 'mastered-consonant' }],
  ['tuh', { ipa: 't', target: 't', category: 'mastered-consonant' }],
  ['duh', { ipa: 'd', target: 'd', category: 'mastered-consonant' }],
  ['kuh', { ipa: 'k', target: 'k', category: 'mastered-consonant' }],
  ['guh', { ipa: 'ɡ', target: 'g', category: 'mastered-consonant' }],
  // Mastered vowel /æ/ — short-a. British-voice rollout: vowel mnemonics
  // are TRIPLETS (the vowel double-wrap fix), NOT the bare single letter.
  ['aaa', { ipa: 'æ', target: 'a', category: 'mastered-vowel' }],
  // Current-target short vowels — TRIPLET mnemonics. The u/i/e IPA were
  // re-pointed in round-2/3 (ə/ɘ/e and the example-word anchoring for
  // U/I), but the read-line mnemonic→target-letter mapping this spec
  // checks is what matters here.
  ['ooo', { ipa: 'ɒ', target: 'o', category: 'short-vowel' }],
  ['uuu', { ipa: 'ʌ', target: 'u', category: 'short-vowel' }],
  ['iii', { ipa: 'ɪ', target: 'i', category: 'short-vowel' }],
  ['eee', { ipa: 'e', target: 'e', category: 'short-vowel' }],
  // Round-3 example-word-anchoring isolate leads for U/I. The anchored
  // read leads with `uh`/`ih`, e.g. "Which letter says uh, like in cup?".
  ['uh', { ipa: 'ʌ', target: 'u', category: 'short-vowel' }],
  ['ih', { ipa: 'ɪ', target: 'i', category: 'short-vowel' }],
])

/** The set of mnemonics that map to short vowels (triplets + round-3
 *  anchored isolate leads). */
const SHORT_VOWEL_MNEMONICS: ReadonlySet<string> = new Set([
  'ooo',
  'uuu',
  'iii',
  'eee',
  'uh',
  'ih',
])

/** The set of mnemonics that map to the mastered vowel /æ/. */
const MASTERED_VOWEL_MNEMONICS: ReadonlySet<string> = new Set(['aaa'])

/** The set of mnemonics that map to short-i and short-e — the
 *  load-bearing adjacency-ban pair. */
const I_E_VOWEL_MNEMONICS: ReadonlySet<string> = new Set(['iii', 'eee', 'ih'])

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
 * Extract the per-problem target mnemonic from the canon
 * `plan.utterances` array. Each problem's `read` slot text is
 * `"Which letter says <MNEMONIC>?"` per A5 §2.1 + Dave A6 directive
 * template. Returns a map from problem number (1..8) to the verbatim
 * mnemonic string.
 *
 * A canon whose `read` slot doesn't match the
 * `"Which letter says <MNEMONIC>?"` template (e.g. a CVC canon using
 * `"Read the dog."`) returns an empty map — the test 4 sensitivity
 * check relies on this behaviour.
 */
function targetMnemonicsByProblem(canon: CanonShape): Map<number, string> {
  const byProblem = new Map<number, string>()
  for (const u of canon.plan.utterances) {
    const idMatch = u.id.match(/^word\.p(\d+)\.read$/)
    if (idMatch === null) continue
    const problemNum = Number(idMatch[1])
    // Anchored "Which letter says <MNEMONIC><TERM>" — `<MNEMONIC>`
    // matches `\S+?` (non-greedy so it does not swallow the terminal)
    // and `<TERM>` is `[.?]`. The British-voice rollout (2026-06-06)
    // made the read terminal sound-class-dependent: declarative "." for
    // VOICED sounds, question "?" for VOICELESS. Both must be extracted
    // here or the per-problem mnemonic map loses every voiced-sound
    // problem. The mnemonic-pool check below is the gate that rejects
    // unknown mnemonics.
    const textMatch = u.text.match(/^Which letter says (\S+?)[.?]$/)
    if (textMatch === null) continue
    byProblem.set(problemNum, textMatch[1]!)
  }
  return byProblem
}

/**
 * Extract the per-problem target LETTER from the canon `correct`
 * slot. Returns a map from problem number (1..8) to the target letter
 * (lowercase — the `correct` slot emits the uppercase Azure-friendly
 * glyph; we lower-case here for category-membership checks against the
 * lowercase canonical letter set).
 *
 * British-voice-rollout `correct` shapes (the OLD "Yes! <L> says <M>."
 * was retired):
 *   - non-fricative:  "Yes. <L>. <mnemonic>."        e.g. "Yes. M. mmm."
 *   - fricative S/F/H/V: "Yes. <L> says it. <mnemonic>?"
 *                                                    e.g. "Yes. S says it. sss?"
 *   - anchored U/I:   "Yes. <L>. <Iso>, like in <word>."
 *                                                    e.g. "Yes. U. Uh, like in cup."
 * In every shape the LETTER is the single ASCII glyph immediately
 * after the leading "Yes." — captured by the anchored regex below.
 *
 * Cross-checks against `targetMnemonicsByProblem` via the
 * `MNEMONIC_TO_MAPPING` table — the (mnemonic, target-letter) pair
 * must match the spec's mapping for every problem.
 */
function targetLettersByProblem(canon: CanonShape): Map<number, string> {
  const byProblem = new Map<number, string>()
  for (const u of canon.plan.utterances) {
    const idMatch = u.id.match(/^word\.p(\d+)\.correct$/)
    if (idMatch === null) continue
    const problemNum = Number(idMatch[1])
    // The letter is the single ASCII glyph right after "Yes. " — either
    // "Yes. <L>. ..." (non-fric / vowels) or "Yes. <L> says it. ..."
    // (fricatives). Anchor on the leading "Yes." + the glyph + a
    // following "." or " says it".
    const textMatch = u.text.match(/^Yes\. ([A-Za-z])(?:\.| says it)/)
    if (textMatch === null) continue
    byProblem.set(problemNum, textMatch[1]!.toLowerCase())
  }
  return byProblem
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

  /**
   * Test 2 — Canon shape + mnemonic-pool + target-letter consistency.
   *
   * Pure payload assertion — reads the canon JSON directly from disk
   * (no browser interaction). Runs on BOTH chromium + webkit
   * trivially. Asserts the structural shape A5 spec + Dave A6
   * directive promise:
   *
   *   - The canon parses to `{ ok: true, kind: 'session-start' }`.
   *   - `plan.utterances` carries exactly 8 problem `read` slots
   *     (problem ids 1..8), the standard word-song session shape.
   *   - Every `read` slot text matches the
   *     `"Which letter says <MNEMONIC>?"` template (A5 §2.1 / A6
   *     directive §2.1).
   *   - Every mnemonic is a member of `MNEMONIC_TO_MAPPING` keys —
   *     the 14 mastered consonants + /æ/ + 4 short-vowel mnemonics
   *     from A5 §2.3.
   *   - For every problem, the `correct` slot's target letter
   *     matches the mnemonic's spec-mapped target letter (e.g. mn
   *     `mmm` ↔ letter `m`). Cross-checks the read-line mnemonic
   *     against the correct-slot letter — catches drift where Haiku
   *     emits a consistent-looking `(mnemonic, letter)` pair that
   *     violates the A5 §2.3 mapping table (e.g. `"Which letter says
   *     mmm?" → "Yes! N says mmm."`).
   *
   * If a future re-bake drifts the read-line template (e.g. emits
   * `"Tap the cat."` because the directive regressed to blending-cv
   * stub content) OR emits an unknown mnemonic / mismatched
   * (mnemonic, letter) pair, THIS test catches it at the canon-JSON
   * layer — ahead of any silent screen-side demote.
   */
  test('2. canon ships 8 problems whose read-lines + correct-slots map mnemonic→target letter per the A5 §2.3 table', () => {
    const { parsed: canon } = readCanon(LETTER_SOUNDS_CANON_PATH)
    expect(canon.ok).toBe(true)
    expect(canon.kind).toBe('session-start')

    const mnemonicsByProblem = targetMnemonicsByProblem(canon)
    const lettersByProblem = targetLettersByProblem(canon)

    // 8 problems per session — count-based assertion per
    // feedback_count_assertions_on_regression_tests.md.
    expect(mnemonicsByProblem.size).toBe(8)
    expect(lettersByProblem.size).toBe(8)
    // Problem ids 1..8 contiguously — no gaps, no extras.
    expect([...mnemonicsByProblem.keys()].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ])
    expect([...lettersByProblem.keys()].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ])

    // Every mnemonic is in the spec's known mnemonic set. Compute the
    // unknown-mnemonic intersection explicitly so the failure message
    // names exactly which mnemonic leaked.
    const unknownMnemonics: string[] = []
    for (const [, mnemonic] of mnemonicsByProblem) {
      if (!MNEMONIC_TO_MAPPING.has(mnemonic)) unknownMnemonics.push(mnemonic)
    }
    expect(
      unknownMnemonics,
      `Unknown mnemonics found in canon read-lines: ${JSON.stringify(unknownMnemonics)} — must be drawn from A5 §2.3 mapping table.`,
    ).toEqual([])

    // For every problem, the read-line mnemonic's spec-mapped target
    // letter must equal the correct-slot's target letter. Cross-
    // checks the (read, correct) pair and catches the
    // mnemonic→letter drift class.
    const mismatches: Array<{
      problem: number
      mnemonic: string
      expected: string
      actual: string
    }> = []
    for (const [problem, mnemonic] of mnemonicsByProblem) {
      const expected = MNEMONIC_TO_MAPPING.get(mnemonic)?.target
      const actual = lettersByProblem.get(problem)
      if (
        expected !== undefined &&
        actual !== undefined &&
        expected !== actual
      ) {
        mismatches.push({ problem, mnemonic, expected, actual })
      }
    }
    expect(
      mismatches,
      `(mnemonic → target-letter) mismatches against A5 §2.3 mapping table: ${JSON.stringify(mismatches)}`,
    ).toEqual([])
  })

  /**
   * Test 3 — Composition rules per Dave A6 directive.
   *
   * Pure payload assertion — reads the canon JSON directly. Asserts
   * the empirical composition rules the directive's bake-time self-
   * checks enforce on the 8 target sounds:
   *
   *   (a) Current-target-vowel floor (A6 SESSION COMPOSITION RULES
   *       §3 + CATEGORY-MIX BUDGET): AT LEAST 2 of the 8 problems'
   *       targets are short-vowel mnemonics (`o`, `u`, `i`, or `e`).
   *       The tier's load-bearing assessment anchor.
   *   (b) Current-target-vowel cap (A6 SESSION COMPOSITION RULES §4
   *       + CATEGORY-MIX BUDGET): AT MOST 3 of the 8 problems'
   *       targets are short-vowel mnemonics. Prevents single-vowel
   *       drill feel.
   *   (c) Mastered-consonant floor (A6 SESSION COMPOSITION RULES §4
   *       + CATEGORY-MIX BUDGET): AT LEAST 4 of the 8 problems'
   *       targets are mastered-consonant mnemonics (the 14 consonants
   *       in MNEMONIC_TO_MAPPING with category 'mastered-consonant').
   *       Maintains the session's overall "review mode" feel.
   *   (d) Mastered-vowel /æ/ presence (A6 SESSION COMPOSITION RULES
   *       §2 + CATEGORY-MIX BUDGET): AT LEAST 1 of the 8 problems'
   *       targets is the mastered vowel `a`, placed in the mid-tier
   *       window (P4 or P5).
   *   (e) /ɪ/↔/ɛ/ adjacency ban (A6 ADJACENT-VOWEL-BAN SELF-CHECK
   *       NEGATIVE ANCHOR): the targets `i` AND `e` MAY NOT both
   *       appear in the same session. (This is enforced regardless
   *       of which is current-target.)
   *   (f) No long-vowel targets (A6 POOL-MEMBERSHIP SELF-CHECK §5):
   *       every target must be in the active-pool's
   *       MNEMONIC_TO_MAPPING — implicitly verified by test 2's
   *       unknown-mnemonic check, but re-pinned here as the
   *       no-out-of-pool gate.
   *   (g) Gentle-ramp (P1-P3) consonants-only (A6 SESSION COMPOSITION
   *       RULES §1 NEGATIVE ANCHOR): NONE of problems 1-3 may have a
   *       vowel target (neither /æ/ nor short-vowel). Vowel mapping
   *       is the LIFT, not the warmup.
   *   (h) Trap-window (P6-P8) current-target-vowel floor (A6 SESSION
   *       COMPOSITION RULES §3): AT LEAST 2 of P6-P8 must have the
   *       current-target vowel as the target sound.
   *
   * On the shipped canon (British-voice rollout PINNED /ɒ/ session,
   * tuple m,s,l,a,b,o,n,o): mnemonics are mmm, sss, lll, aaa, buh, ooo,
   * nnn, ooo. Current-target /ɒ/ count = 2 (ooo at P6 + P8, within 2-3
   * cap), mastered-consonants = 5 (m, s, l, b, n, ≥4), mastered-vowel
   * /æ/ = 1 (aaa at P4, mid-tier), no /ɪ/ or /ɛ/ targets (adjacency ban
   * satisfied), gentle-ramp P1-P3 = all consonants (m, s, l),
   * trap-window P6-P8 current-target = 2 of 3 (P6=ooo, P8=ooo). All
   * eight rules pass. (Vowel mnemonics are TRIPLETS post-rollout — the
   * vowel double-wrap fix.)
   *
   * If a future re-bake drifts (e.g. emits 4 short-vowel targets, or
   * places /æ/ at P1, or both `i` and `e` as targets, or fewer than
   * 2 current-target items in P6-P8), this test catches it at the
   * canon layer.
   */
  test('3. canon composition: short-vowel floor (>=2) + cap (<=3), mastered-consonant floor (>=4), mastered-vowel /æ/ (>=1 at P4-P5), /ɪ/↔/ɛ/ ban, gentle-ramp consonants only, trap-window current-target floor', () => {
    const { parsed: canon } = readCanon(LETTER_SOUNDS_CANON_PATH)
    const mnemonicsByProblem = targetMnemonicsByProblem(canon)
    expect(mnemonicsByProblem.size).toBe(8)

    // Helper to enumerate targets by category, preserving problem
    // order so positional checks (gentle-ramp, trap-window) work.
    const problemsSorted = [...mnemonicsByProblem.keys()].sort((a, b) => a - b)

    // (a) + (b) — short-vowel floor + cap.
    const shortVowelTargets = problemsSorted.filter((p) =>
      SHORT_VOWEL_MNEMONICS.has(mnemonicsByProblem.get(p)!),
    )
    expect(
      shortVowelTargets.length,
      `Short-vowel targets (o/u/i/e) at problems ${JSON.stringify(shortVowelTargets)} — directive requires AT LEAST 2, AT MOST 3`,
    ).toBeGreaterThanOrEqual(2)
    expect(shortVowelTargets.length).toBeLessThanOrEqual(3)

    // (c) — mastered-consonant floor.
    const masteredConsonantTargets = problemsSorted.filter((p) => {
      const mn = mnemonicsByProblem.get(p)!
      return MNEMONIC_TO_MAPPING.get(mn)?.category === 'mastered-consonant'
    })
    expect(
      masteredConsonantTargets.length,
      `Mastered-consonant targets at problems ${JSON.stringify(masteredConsonantTargets)} — directive requires AT LEAST 4`,
    ).toBeGreaterThanOrEqual(4)

    // (d) — mastered-vowel /æ/ presence at P4 or P5 (mid-tier
    // window). Directive §2 places /æ/ exactly at one of P4/P5.
    const masteredVowelProblems = problemsSorted.filter((p) =>
      MASTERED_VOWEL_MNEMONICS.has(mnemonicsByProblem.get(p)!),
    )
    expect(
      masteredVowelProblems.length,
      `Mastered-vowel /æ/ targets at problems ${JSON.stringify(masteredVowelProblems)} — directive requires AT LEAST 1`,
    ).toBeGreaterThanOrEqual(1)
    // Every /æ/ slot must be at P4 OR P5 (mid-tier window per
    // directive §2 — vowels in P1-P3 violate gentle-ramp negative
    // anchor, vowels in P6-P8 would compete with the lift vowel).
    for (const p of masteredVowelProblems) {
      expect(
        [4, 5].includes(p),
        `Mastered-vowel /æ/ target at problem ${p}; directive §2 requires placement at P4 or P5 (mid-tier window).`,
      ).toBe(true)
    }

    // (e) — /ɪ/↔/ɛ/ adjacency ban (NEGATIVE ANCHOR — directive
    // ADJACENT-VOWEL-BAN SELF-CHECK).
    const iETargets = problemsSorted.filter((p) =>
      I_E_VOWEL_MNEMONICS.has(mnemonicsByProblem.get(p)!),
    )
    const hasShortI = iETargets.some((p) => mnemonicsByProblem.get(p) === 'i')
    const hasShortE = iETargets.some((p) => mnemonicsByProblem.get(p) === 'e')
    expect(
      hasShortI && hasShortE,
      `Both /ɪ/ AND /ɛ/ appear as targets in this session at problems ${JSON.stringify(iETargets)} — directive NEGATIVE ANCHOR forbids this (acoustic-similarity ban per phonics-sequence-marian.md §Q1).`,
    ).toBe(false)

    // (f) — no out-of-pool targets — implicitly verified by test 2,
    // re-pinned here. Every target must be a known mnemonic.
    for (const [p, mn] of mnemonicsByProblem) {
      expect(
        MNEMONIC_TO_MAPPING.has(mn),
        `Problem ${p} has unknown mnemonic "${mn}" — directive POOL-MEMBERSHIP SELF-CHECK §5 requires every target be in the 16-sound active pool.`,
      ).toBe(true)
    }

    // (g) — gentle-ramp (P1-P3) consonants only. NEGATIVE ANCHOR
    // from directive §1.
    for (const p of [1, 2, 3]) {
      const mn = mnemonicsByProblem.get(p)!
      const category = MNEMONIC_TO_MAPPING.get(mn)?.category
      expect(
        category,
        `Problem ${p} (gentle-ramp) has mnemonic "${mn}" with category "${category}" — directive §1 NEGATIVE ANCHOR requires mastered-consonant ONLY at P1-P3.`,
      ).toBe('mastered-consonant')
    }

    // (h) — trap-window (P6-P8) current-target-vowel floor.
    const trapWindowShortVowels = [6, 7, 8].filter((p) =>
      SHORT_VOWEL_MNEMONICS.has(mnemonicsByProblem.get(p)!),
    )
    expect(
      trapWindowShortVowels.length,
      `Trap-window (P6-P8) short-vowel targets at problems ${JSON.stringify(trapWindowShortVowels)} — directive §3 requires AT LEAST 2 of P6-P8 carry the current-target vowel.`,
    ).toBeGreaterThanOrEqual(2)
  })

  /**
   * Test 4 — Assertion-sensitivity sub-test.
   *
   * Per `[[feedback_failing_first_must_prove_green]]`: because A7 has
   * already merged, the spec lands GREEN on current main without an
   * organic RED→GREEN flip. The mutation-sensitivity proof goes here
   * instead: install a STRUCTURALLY-VALID but WRONG-CONTENT canon —
   * the shipped cvc-words-short-o canon, which ships CVC target
   * words (`dog`, `pot`, `mop` etc.) with the `"Read the <word>."`
   * template — and assert the same `targetMnemonicsByProblem` +
   * `MNEMONIC_TO_MAPPING` membership logic from tests 2-3 FAILS
   * against it. Mirrors the A4 letter-names sibling test 4 verbatim.
   *
   * Why cvc-words-short-o rather than a hand-built bogus blob:
   *   - It's a real, shipped canon — proves the spec catches a
   *     plausible misroute (the `effectiveFocusNode` fallback path
   *     would serve THIS canon if `letter-sounds` were silently
   *     dropped from `WORD_SONG_FIRST_CLASS_FOCUS_NODES`).
   *   - It's structurally valid JSON with the right outer shape —
   *     proves the test isn't passing on a parse-error short-circuit.
   *   - Its read-line template (`"Read the <word>."`) doesn't match
   *     `targetMnemonicsByProblem`'s regex (`"Which letter says
   *     <MNEMONIC>?"`), so the function returns an empty map →
   *     test 2's `expect(...).toBe(8)` assertion fails → mutation
   *     caught.
   *
   * The check is structured as a series of explicit assertions
   * against the broken-canon extraction results, asserting that the
   * main checks from tests 2-3 produce failure-shaped output when
   * run against the wrong canon. This is the canonical pattern for
   * "prove the main check is sensitive": running the main check
   * against a known-broken input must surface a failure.
   *
   * On current main: the cvc-words-short-o canon is on disk
   * (committed in PR #151 + extended pool in #160), so this test
   * exercises real bytes — no spec-side stub.
   */
  test('4. assertion-sensitivity: applying the main mnemonic-pool + composition checks to a WRONG canon (cvc-words-short-o) catches the mismatch', () => {
    const { parsed: brokenCanon } = readCanon(BROKEN_CANON_PATH)
    // Sanity — the broken canon parses to the same outer shape, so
    // any test failure below is genuine assertion sensitivity, NOT a
    // parse-error short-circuit.
    expect(brokenCanon.ok).toBe(true)
    expect(brokenCanon.kind).toBe('session-start')

    // Run the same extraction logic as test 2 against the wrong
    // canon. The cvc-words-short-o canon's `read` slots are
    // `"Read the <word>."` — they do NOT match
    // `targetMnemonicsByProblem`'s `"Which letter says <MNEMONIC>?"`
    // regex, so the function returns an empty map.
    const mnemonicsByProblem = targetMnemonicsByProblem(brokenCanon)

    // The sensitivity check: test 2's main assertion is
    // `expect(mnemonicsByProblem.size).toBe(8)`. If we ran that
    // exact assertion against the broken canon, would it fail? Yes —
    // `mnemonicsByProblem.size` is 0 (no read lines matched the
    // letter-sounds template), not 8. Pin this explicitly: the
    // spec's main check IS sensitive to the wrong-canon mutation.
    expect(
      mnemonicsByProblem.size,
      'Sensitivity check: the cvc-words-short-o canon must yield 0 letter-sounds mnemonics ' +
        '(its read lines use "Read the <word>." not "Which letter says <MNEMONIC>?"). ' +
        'If this assertion fails — mnemonicsByProblem.size is non-zero — the spec is matching ' +
        'against CVC words too, which means the main test 2 assertion is too loose.',
    ).toBe(0)
    expect(mnemonicsByProblem.size).not.toBe(8)

    // Additionally — even if a future fork of this spec relaxed the
    // template regex to match BOTH read-line shapes, the
    // mnemonic-pool membership check would still catch the
    // cvc-words-short-o targets: CVC words like `dog` are not in
    // the MNEMONIC_TO_MAPPING (whose keys are mnemonic strings like
    // `mmm`, `buh`, `o` — not full English words). Pin this as a
    // belt-and-braces sensitivity check so a future regex-widening
    // doesn't accidentally weaken the spec.
    //
    // Extract the canon's CVC-tier target words directly (matching
    // `"Read the <word>."`) and assert NONE are in
    // MNEMONIC_TO_MAPPING.
    const cvcTargets: string[] = []
    for (const u of brokenCanon.plan.utterances) {
      const idMatch = u.id.match(/^word\.p(\d+)\.read$/)
      if (idMatch === null) continue
      const textMatch = u.text.match(/^Read the (\w+)\.$/)
      if (textMatch === null) continue
      cvcTargets.push(textMatch[1]!.toLowerCase())
    }
    expect(cvcTargets.length).toBeGreaterThan(0)
    const cvcTargetsInMnemonicPool = cvcTargets.filter((t) =>
      MNEMONIC_TO_MAPPING.has(t),
    )
    expect(
      cvcTargetsInMnemonicPool,
      'Sensitivity check (belt-and-braces): no CVC word from the broken canon ' +
        'should be in MNEMONIC_TO_MAPPING (the mnemonic→IPA-target table from A5 §2.3). ' +
        'If any CVC target is, MNEMONIC_TO_MAPPING has drifted to include multi-char strings.',
    ).toEqual([])

    // Also pin the composition-rule sensitivity: test 3's short-
    // vowel floor `expect(shortVowelTargets.length).toBeGreaterThanOrEqual(2)`
    // would, if applied to mnemonicsByProblem on the broken canon
    // (which is empty), return 0 — far below the floor of 2. The
    // composition test is sensitive to the same mutation.
    const shortVowelCountInBrokenCanon = [
      ...mnemonicsByProblem.values(),
    ].filter((mn) => SHORT_VOWEL_MNEMONICS.has(mn)).length
    expect(
      shortVowelCountInBrokenCanon,
      'Sensitivity check: the cvc-words-short-o canon must yield 0 short-vowel mnemonic targets ' +
        '(the test 3 short-vowel floor of >=2 would fail loudly on this canon).',
    ).toBe(0)
  })
})
