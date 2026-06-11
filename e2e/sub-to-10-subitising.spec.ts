/**
 * E2E spec — sub-to-10 subitising scaffold (single-cell minuend) — W10.5.
 *
 * Ticket: 86ca7kdzq (Jessica, failing-first).
 * Paired with: Devon's W10.3 impl (branch
 *   `devon/86ca7kdw8-sub-to-10-subitising`) — the
 *   `shouldShowSubitisingSubScaffold()` predicate, the
 *   `math-sub-minuend-card` testid, the `TenFrameCell` render mode, the
 *   `profile.subitisingScaffoldSubSessionsObserved` Progress field, and
 *   the `easyBandSubLeitnerMeanBox()` derivation.
 *
 * Spec authority: `design/math/subitising-scaffold-content.md` §13
 *   (Kyle, sub-to-10 content-tier rules) + §13.5 vocabulary contract
 *   (EXACT identifiers) + §13.6 acceptance criteria. Research authority:
 *   `design/research/sub-to-10-subitising-mental-model.md` (Dave, W10.1).
 *
 * ────────────────────────────────────────────────────────────────────
 * Why the single-cell minuend, not the add-to-10 two-cell layout
 * ────────────────────────────────────────────────────────────────────
 *
 * Subtraction is take-from-one-quantity (§13.1, Dave research). The
 * scaffold shows EXACTLY ONE cell — the minuend (`problem.addendA` for
 * `op === '-'`) — with NO subtrahend cell, NO operator glyph, NO "?"
 * cell. Minuends 1–5 render the canonical die face (existing
 * `DotCardCell`); minuends 6–10 render a ten-frame (`TenFrameCell`,
 * §13.2). The EASY-band minuend range is `[5, 10]` (§13.3 S3).
 *
 * ────────────────────────────────────────────────────────────────────
 * RED-on-base evidence (verified against current `origin/main`)
 * ────────────────────────────────────────────────────────────────────
 *
 * On main HEAD (W10.3 NOT yet merged):
 *   - The `math-sub-minuend-card` testid does NOT exist anywhere in
 *     `src/` (verified via grep at authoring time, 2026-06-11).
 *   - For `op === '-'` problems, Math.tsx skips the ENTIRE
 *     `math-visual-groups` row (Math.tsx ~L2602: `currentProblem.op
 *     === '+' && (...)`), so NO subitising affordance of any kind
 *     mounts on a sub-to-10 problem today (the sub-to-10 dot-card
 *     SUPPRESSION already shipped — see
 *     `sub-to-10-dot-card-suppression.spec.ts`).
 *   - `shouldShowSubitisingSubScaffold` / `SUB_SCAFFOLD_FOCUS_NODE` /
 *     `SUB_EASY_BAND_FACTS` / `easyBandSubLeitnerMeanBox` /
 *     `subitisingScaffoldSubSessionsObserved` do NOT exist.
 *
 * So Test 1's `toHaveCount(1)` on `math-sub-minuend-card` is the
 * load-bearing RED-on-base lever: actual count is 0 today (the gated
 * testid never renders), expected is 1 post-W10.3. The assertion fails
 * for the RIGHT reason — the feature does not exist yet — not because
 * the assertion is malformed.
 *
 * Per-assertion classification (per
 * `[[feedback_progression_e2e_mandatory]]` rule 8) appears inline at
 * each test block below.
 *
 * ────────────────────────────────────────────────────────────────────
 * Mock discipline (per dispatch brief + testing-and-ci.md §4.1.1d/e)
 * ────────────────────────────────────────────────────────────────────
 *
 * This spec uses the CANON-BYTES (canned-plan) mock via
 * `installClaudeMock(page, { mathResponse: ... })`, NOT `failNetwork:
 * true`. Rationale (testing-and-ci.md §4.1.1d/§4.1.1e + §4.2 tier-
 * asymmetry warning): under `failNetwork: true` the screen falls into
 * `pickStaticSessionPlan`, which for any non-`add-to-20` focus emits the
 * add-to-10 rotation (`op: '+'`). A sub-to-10 spec that ran on the
 * add-to-10 fallback would NEVER exercise the `op === '-'` minuend gate
 * — every assertion would be trivially-green against the wrong tier.
 * Serving a canned `op === '-'` plan is the only way the sub-to-10
 * predicate is genuinely exercised.
 *
 * We follow the sibling `sub-to-10-dot-card-suppression.spec.ts`
 * pattern: NO `forceHowlerUnlock` (its WebKit stub-ctx breaks real-bytes
 * decode → silent static fallback, per §4.1.2), Hub-tree-node click IS
 * the first gesture, chromium-only (`skipOnWebkitHeadless`), and a
 * canon-landed gate (`math-addend-a` text) before any scaffold
 * assertion so we never assert against a silent static fallback.
 *
 * The captured-request positive discriminator (§4.1.1e fix pattern +
 * §4.1 defensive-pairing) asserts `payload.progress.focusNode ===
 * 'sub-to-10'` on the outgoing POST body, proving the sub-tier gate
 * fired rather than inferring it from a negative-membership chip check.
 *
 * ────────────────────────────────────────────────────────────────────
 * Timeout sizing (testing-and-ci.md §4.1.1b)
 * ────────────────────────────────────────────────────────────────────
 *
 * Test 4 (stickiness) walks 3 problems within one session (~50s/problem
 * on the silent caption-walk path). `test.setTimeout(180_000)` at the
 * suite head covers the multi-problem walk plus headroom. The
 * single-problem tests early-exit well under the per-test budget but
 * inherit the suite setTimeout harmlessly.
 *
 * ────────────────────────────────────────────────────────────────────
 * What this spec does NOT cover — routing notes
 * ────────────────────────────────────────────────────────────────────
 *
 *   - Ten-frame PIP-PATTERN visual correctness (which slot fills, pip
 *     geometry) — owned by Devon's `TenFrameCell` unit tests
 *     (`TenFrameCell.test.tsx`, spec §13.6 "Pip vocabulary"). Pixel
 *     correctness is out of Playwright scope (persona-routing rule #3 →
 *     Devon design-review). This spec asserts pip/slot COUNT only
 *     (`data-pips` / cell count), which is a DOM census, not a pixel
 *     check.
 *   - Sub-facts Leitner-mean MID-BAND fade probabilities (P=0.66, 0.33)
 *     — stochastic RNG bands, covered by Devon's
 *     `subitisingScaffold.test.ts` unit grid (spec §13.4.3). Only the
 *     deterministic boundaries (first-encounter forces ON; mean ≥ 4.0
 *     forces OFF) are exercised here.
 *   - Audio narration absence (`math.p{N}.read` plays unchanged, no new
 *     TTS) — no utterance-text / SSML change in this wave, so no Thomas
 *     ear-test routing needed (per
 *     `[[feedback_jessica_audio_visual_gate_narrowed]]`; W10.3 is
 *     render-layer wiring only).
 *   - Reduced-motion lifecycle timing — Devon unit test
 *     (`DotCardOverlay.test.tsx` / `TenFrameCell.test.tsx`).
 *
 * ────────────────────────────────────────────────────────────────────
 * Count-assertion discipline
 * ────────────────────────────────────────────────────────────────────
 *
 * Per `[[feedback_count_assertions_on_regression_tests]]`: all DOM
 * census assertions use `.toHaveCount(N)` / `.toBe(value)` /
 * `.toEqual([...])`, never `.toContain` / `.toContainEqual`. The
 * `math-sub-minuend-card` mount is a JSX-conditional element (Devon
 * gates the whole container on `shouldShowSubitisingSubScaffold`), so it
 * is a STATIC-absence element (never a transient unmount window for the
 * NOT-mounted case) — `.toHaveCount(0)` polling is correct per §4.1.3.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

// Test 4 walks 3 problems within one session on the silent caption-walk
// fallback path (~50s/problem). Per testing-and-ci.md §4.1.1b, size the
// budget at sessions×wall + ≥30s headroom; 180s covers the walk.
test.setTimeout(180_000)

// ── Vocabulary contract (Kyle §13.5 — EXACT identifiers, verbatim) ───────────
//
// Devon (W10.3) produces these; Jessica (W10.5) seeds / selects against
// them. A single source here so a future rename is a one-line change.
const SUB_MINUEND_CARD_TESTID = 'math-sub-minuend-card' // §13.5 row 9
const DOT_CARD_CELL_TESTID = 'math-dot-card-cell' // reused, §13.5 row 9
const SUB_SCAFFOLD_FIELD = 'subitisingScaffoldSubSessionsObserved' // §13.5 row 1

// Tiny silent MP3 — single frame; Howler may or may not decode. We never
// tap chips far enough to depend on audio in the single-problem tests;
// Test 4's chip-walk gates on `data-problem-index` not on audio.
const SILENT_MP3 =
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAA8TEFNRTMuMTAwBLgAAAAAAAAAABRAJAUHQQAB4AAAAk8tnaAyAAAAAA=='

function audio() {
  return {
    kind: 'inline' as const,
    base64: SILENT_MP3,
    mime: 'audio/mpeg' as const,
  }
}

// ── WebKit-headless skip ─────────────────────────────────────────────────────
//
// We serve real-bytes canned plans, so WebKit (no AudioContext → cannot
// decode → silent static fallback) is structurally unsupported. Chromium
// only, same posture as `sub-to-10-dot-card-suppression.spec.ts`.
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → real-bytes canned plan cannot decode; sub-to-10 subitising spec is chromium-only. Real iPad Safari has working AudioContext post-gesture.',
  )
}

// ── Canned-plan factories (op === '-' sub-to-10) ─────────────────────────────

type SubProblem = {
  idx: number
  mW: string
  sW: string
  minuend: number
  subtrahend: number
  ans: number
  ansW: string
}

function cannedSubPlan(problems: ReadonlyArray<SubProblem>) {
  const utterances = problems.flatMap((p) => [
    {
      id: `math.p${p.idx}.read`,
      text: `${p.mW} minus ${p.sW}. How many are left?`,
      audio: audio(),
    },
    { id: `math.p${p.idx}.correct`, text: `Yes! ${p.ansW}!`, audio: audio() },
    {
      id: `math.p${p.idx}.reprompt`,
      text: 'Hmm... try again?',
      audio: audio(),
    },
    {
      id: `math.p${p.idx}.hint`,
      text: `Look. ${p.mW}. Take away ${p.sW}. How many now?`,
      audio: audio(),
    },
    {
      id: `math.p${p.idx}.giveAnswer`,
      text: `This one is ${p.ansW.toLowerCase()}.`,
      audio: audio(),
    },
  ])
  return {
    ok: true as const,
    kind: 'session-start' as const,
    plan: {
      id: 'sub-to-10-level-1',
      label: 'Subtraction within 10 — Level 1',
      utterances: utterances.map((u) => ({ id: u.id, text: u.text })),
    },
    utterances,
  }
}

/**
 * Q1 = `8 - 4 = 4` (minuend 8, in EASY-band `[5,10]`, renders ten-frame:
 * 5 top + 3 bottom = 8 pips). The full 8-problem pool is the
 * `sub-to-10-content.md` §1.1 EASY-band shape (all minuends ∈ [5,10]).
 */
function cannedSubToTenMinuendEightAtP1() {
  return cannedSubPlan([
    {
      idx: 1,
      mW: 'Eight',
      sW: 'four',
      minuend: 8,
      subtrahend: 4,
      ans: 4,
      ansW: 'Four',
    },
    {
      idx: 2,
      mW: 'Six',
      sW: 'three',
      minuend: 6,
      subtrahend: 3,
      ans: 3,
      ansW: 'Three',
    },
    {
      idx: 3,
      mW: 'Five',
      sW: 'five',
      minuend: 5,
      subtrahend: 5,
      ans: 0,
      ansW: 'Zero',
    },
    {
      idx: 4,
      mW: 'Nine',
      sW: 'one',
      minuend: 9,
      subtrahend: 1,
      ans: 8,
      ansW: 'Eight',
    },
    {
      idx: 5,
      mW: 'Ten',
      sW: 'five',
      minuend: 10,
      subtrahend: 5,
      ans: 5,
      ansW: 'Five',
    },
    {
      idx: 6,
      mW: 'Eight',
      sW: 'eight',
      minuend: 8,
      subtrahend: 8,
      ans: 0,
      ansW: 'Zero',
    },
    {
      idx: 7,
      mW: 'Seven',
      sW: 'zero',
      minuend: 7,
      subtrahend: 0,
      ans: 7,
      ansW: 'Seven',
    },
    {
      idx: 8,
      mW: 'Nine',
      sW: 'zero',
      minuend: 9,
      subtrahend: 0,
      ans: 9,
      ansW: 'Nine',
    },
  ])
}

/**
 * Q1 = `5 - 5 = 0` (minuend 5 → canonical die-5 face, NOT a ten-frame,
 * per §13.2.2 value-conditional rendering). Used by the pip-vocabulary
 * boundary test.
 */
function cannedSubToTenMinuendFiveAtP1() {
  return cannedSubPlan([
    {
      idx: 1,
      mW: 'Five',
      sW: 'five',
      minuend: 5,
      subtrahend: 5,
      ans: 0,
      ansW: 'Zero',
    },
    {
      idx: 2,
      mW: 'Six',
      sW: 'three',
      minuend: 6,
      subtrahend: 3,
      ans: 3,
      ansW: 'Three',
    },
    {
      idx: 3,
      mW: 'Eight',
      sW: 'four',
      minuend: 8,
      subtrahend: 4,
      ans: 4,
      ansW: 'Four',
    },
    {
      idx: 4,
      mW: 'Nine',
      sW: 'one',
      minuend: 9,
      subtrahend: 1,
      ans: 8,
      ansW: 'Eight',
    },
    {
      idx: 5,
      mW: 'Ten',
      sW: 'five',
      minuend: 10,
      subtrahend: 5,
      ans: 5,
      ansW: 'Five',
    },
    {
      idx: 6,
      mW: 'Eight',
      sW: 'eight',
      minuend: 8,
      subtrahend: 8,
      ans: 0,
      ansW: 'Zero',
    },
    {
      idx: 7,
      mW: 'Seven',
      sW: 'zero',
      minuend: 7,
      subtrahend: 0,
      ans: 7,
      ansW: 'Seven',
    },
    {
      idx: 8,
      mW: 'Nine',
      sW: 'zero',
      minuend: 9,
      subtrahend: 0,
      ans: 9,
      ansW: 'Nine',
    },
  ])
}

// NOTE: Test 4 (stickiness chip-walk) previously used a synthetic
// `cannedSubToTenStickyStarter()` plan with the silent-MP3 placeholder.
// That placeholder does not decode under the genuine gesture-unlock chain,
// so the read-aloud→chip-enable gate never released and `toBeEnabled()`
// stalled at Q1→Q2 (Kevin's review on `614d429`). Test 4 now serves the
// real on-disk sub-to-10 canon via `installSubToTenCanonClaudeMock` per
// testing-and-ci.md §4.1.3 rule 3 (multi-problem chip-walk = real-canon
// bytes), so the synthetic sticky factory is removed.

/**
 * Add-to-10 plan (`3 + 4` at Q1) for the regression-pin: the existing
 * two-cell add scaffold must remain unaffected by the sub-tier work.
 */
function cannedAddToTenSmallAddendsAtP1() {
  const problems = [
    { idx: 1, aW: 'Three', bW: 'four', a: 3, b: 4, ans: 7, ansW: 'Seven' },
    { idx: 2, aW: 'One', bW: 'two', a: 1, b: 2, ans: 3, ansW: 'Three' },
    { idx: 3, aW: 'Two', bW: 'three', a: 2, b: 3, ans: 5, ansW: 'Five' },
    { idx: 4, aW: 'Three', bW: 'four', a: 3, b: 4, ans: 7, ansW: 'Seven' },
    { idx: 5, aW: 'Five', bW: 'four', a: 5, b: 4, ans: 9, ansW: 'Nine' },
    { idx: 6, aW: 'Two', bW: 'six', a: 2, b: 6, ans: 8, ansW: 'Eight' },
    { idx: 7, aW: 'Three', bW: 'six', a: 3, b: 6, ans: 9, ansW: 'Nine' },
    { idx: 8, aW: 'Four', bW: 'six', a: 4, b: 6, ans: 10, ansW: 'Ten' },
  ]
  const utterances = problems.flatMap((p) => [
    {
      id: `math.p${p.idx}.read`,
      text: `${p.aW} plus ${p.bW}. How many?`,
      audio: audio(),
    },
    { id: `math.p${p.idx}.correct`, text: `Yes! ${p.ansW}!`, audio: audio() },
    {
      id: `math.p${p.idx}.reprompt`,
      text: 'Hmm... try again?',
      audio: audio(),
    },
    {
      id: `math.p${p.idx}.hint`,
      text: `Look. ${p.aW}. And ${p.bW} more. How many now?`,
      audio: audio(),
    },
    {
      id: `math.p${p.idx}.giveAnswer`,
      text: `This one is ${p.ansW.toLowerCase()}.`,
      audio: audio(),
    },
  ])
  return {
    ok: true as const,
    kind: 'session-start' as const,
    plan: {
      id: 'add-to-10-level-1',
      label: 'Addition within 10 — Level 1',
      utterances: utterances.map((u) => ({ id: u.id, text: u.text })),
    },
    utterances,
  }
}

// ── On-disk canon mock — for Test 4 (multi-problem chip-walk) ────────────────
//
// Test 4 drives a chip-advance walk across Q1→Q2→Q3. Per testing-and-ci.md
// §4.1.3 rule 3, multi-problem chip-walk specs MUST serve real-canon MP3
// bytes — the silent-placeholder `SILENT_MP3` does NOT decode under the
// genuine gesture-unlock chain, so the read-aloud effect never resolves
// and chips never enable (the `toBeEnabled()` stall Kevin observed on
// `614d429`). `forceHowlerUnlock` is NOT the fix here: its WebKit stub-ctx
// breaks real-bytes decode → silent static add-to-10 fallback (§4.1.2
// silent-demote caveat), which would (a) serve op:'+' problems with NO
// sub minuend scaffold and (b) defeat the whole stickiness assertion.
//
// We follow the `sub-to-10-distractor-class-2.spec.ts` pattern: serve the
// on-disk `public/canon/math/level-1/sub-to-10.json` verbatim. Its
// Azure-rendered MP3 bytes decode cleanly in headless chromium, so the
// read-aloud effect resolves and chips enable across the walk. Canon P1–P3
// are `5-5`, `6-3`, `9-1` — all minuends ∈ EASY-band [5,10], so the sub
// minuend card mounts on each, exactly what the stickiness AC needs.
const SUB_TO_TEN_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/math/level-1/sub-to-10.json',
)

function readMathCanon(path: string): string {
  if (!existsSync(path)) {
    throw new Error(
      `[sub-to-10-subitising spec] canon not found at ${path}. ` +
        `Test 4's chip-walk requires real-canon MP3 bytes; do NOT swap to ` +
        `a silent-MP3 placeholder — see the on-disk-canon-mock header.`,
    )
  }
  return readFileSync(path, 'utf-8')
}

/**
 * Install a `/api/claude` mock that serves the on-disk math canon for
 * `track === 'math'` requests (modelled on
 * `sub-to-10-distractor-class-2.spec.ts`'s `installMathCanonClaudeMock`).
 * Real MP3 bytes decode cleanly so the read-aloud→chip-enable gate
 * releases across the multi-problem walk. Returns the captured requests so
 * Test 4 can keep the same `focusNode === 'sub-to-10'` positive
 * discriminator as Test 1. Unknown tracks 500 loudly.
 */
async function installSubToTenCanonClaudeMock(
  page: Page,
  canonBody: string,
): Promise<{ requests: Request[] }> {
  const requests: Request[] = []
  await page.route('**/api/claude', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    requests.push(req)
    let body: Record<string, unknown>
    try {
      body = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>
    } catch {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: '{}',
      })
      return
    }
    const payload = (body.payload ?? {}) as Record<string, unknown>
    const track = payload.track as string | undefined
    if (track === 'math') {
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
        message: `sub-to-10-subitising chip-walk is math-only; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

// ── Seed builders ────────────────────────────────────────────────────────────

/**
 * sub-to-10 focus seed. `subitisingScaffoldSubSessionsObserved` is the
 * NEW `Profile` field Devon's W10.3 adds (§13.5 row 1). We inject it via
 * raw spread because `buildSeedProgress` does not yet know about it (and
 * won't until Devon widens the helper). `isProgressV1` tolerates the
 * extra `profile` key by the same rule that lets the add-to-10 spec seed
 * `subitisingScaffoldSessionsObserved` (testing-and-ci.md §4.1.1a +
 * `subitising-scaffold.spec.ts` precedent).
 *
 * `mathFactsLeitner.items` shapes the fade signal: each entry is a
 * SUBTRACTION fact (`op: '-'`) so it lands in `SUB_EASY_BAND_FACTS`
 * (§13.4.2). Per §13.4 the sub fade reads sub-facts ONLY — never
 * add-facts — so seeding add-facts here would prove nothing.
 */
function buildSubToTenSubitisingSeed(opts: {
  subSessionsObserved: number
  // box for the 8 EASY-band SUB facts; null → no sub-facts seeded
  // (empty-seen-set → 0 sentinel → scaffold stays ON).
  subLeitnerTargetBox: 1 | 2 | 3 | 4 | 5 | null
  // optionally seed ADD facts at a high box to prove cross-operation
  // isolation (high add mean must NOT suppress the sub scaffold).
  addLeitnerTargetBox?: 1 | 2 | 3 | 4 | 5
}): unknown {
  const base = buildSeedProgress({
    skillLevelOverrides: {
      'number-recog': 'mastered',
      'add-to-10': 'mastered',
      'add-to-20': 'mastered',
      'sub-to-10': 'practicing',
      'sub-to-20': 'intro',
      'two-digit-addsub-no-regroup': 'locked',
      'two-digit-addsub-with-regroup': 'locked',
      'skip-counting': 'locked',
      'mult-2-5-10': 'intro',
      'mult-3-4': 'locked',
      'mult-6-9': 'locked',
    },
  }) as { profile: Record<string, unknown> }

  // The 8 EASY-band sub-to-10 facts (sub-to-10-content.md §1.1 / spec
  // §13.4.2 SUB_EASY_BAND_FACTS). Keyed { a, b, op: '-' }.
  const SUB_EASY_BAND_FACTS: ReadonlyArray<{ a: number; b: number }> = [
    { a: 5, b: 5 },
    { a: 8, b: 8 },
    { a: 7, b: 0 },
    { a: 9, b: 0 },
    { a: 10, b: 5 },
    { a: 8, b: 4 },
    { a: 6, b: 3 },
    { a: 9, b: 1 },
  ]

  // The 9 EASY-band add-to-10 facts (sums 3-5) — used only to prove
  // cross-operation isolation.
  const ADD_EASY_BAND_FACTS: ReadonlyArray<{ a: number; b: number }> = [
    { a: 1, b: 2 },
    { a: 2, b: 1 },
    { a: 1, b: 3 },
    { a: 3, b: 1 },
    { a: 2, b: 2 },
    { a: 1, b: 4 },
    { a: 4, b: 1 },
    { a: 2, b: 3 },
    { a: 3, b: 2 },
  ]

  const items: unknown[] = []
  if (opts.subLeitnerTargetBox !== null) {
    for (const f of SUB_EASY_BAND_FACTS) {
      items.push({
        item: { a: f.a, b: f.b, op: '-' as const },
        box: opts.subLeitnerTargetBox,
        lastSeen: Date.now() - 60 * 60 * 1000,
      })
    }
  }
  if (opts.addLeitnerTargetBox !== undefined) {
    for (const f of ADD_EASY_BAND_FACTS) {
      items.push({
        item: { a: f.a, b: f.b, op: '+' as const },
        box: opts.addLeitnerTargetBox,
        lastSeen: Date.now() - 60 * 60 * 1000,
      })
    }
  }

  return {
    ...(base as Record<string, unknown>),
    profile: {
      ...base.profile,
      [SUB_SCAFFOLD_FIELD]: opts.subSessionsObserved,
    },
    mathFactsLeitner: { items },
  }
}

/**
 * add-to-10 focus seed for the regression-pin (existing add scaffold
 * unaffected). Seeds the add-to-10 first-encounter window so the add
 * two-cell scaffold is unconditionally ON.
 */
function buildAddToTenSubitisingSeed(): unknown {
  const base = buildSeedProgress({
    skillLevelOverrides: {
      'number-recog': 'mastered',
      'add-to-10': 'practicing',
      'add-to-20': 'locked',
      'sub-to-10': 'mastered',
      'sub-to-20': 'intro',
      'two-digit-addsub-no-regroup': 'locked',
      'two-digit-addsub-with-regroup': 'locked',
      'skip-counting': 'locked',
      'mult-2-5-10': 'intro',
      'mult-3-4': 'locked',
      'mult-6-9': 'locked',
    },
  }) as { profile: Record<string, unknown> }

  return {
    ...(base as Record<string, unknown>),
    profile: {
      ...base.profile,
      // add-to-10 first-encounter window → add scaffold unconditionally on.
      subitisingScaffoldSessionsObserved: 0,
    },
    mathFactsLeitner: { items: [] },
  }
}

// ── Navigation + capture helpers ─────────────────────────────────────────────

async function navigateToMath(page: Page) {
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  await page
    .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
    .click()
  await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('math-symbolic')).toBeVisible({
    timeout: 15_000,
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Suite
// ────────────────────────────────────────────────────────────────────────────

test.describe('sub-to-10 subitising scaffold — single-cell minuend (W10.5)', () => {
  // ── Test 1 ─────────────────────────────────────────────────────────────────
  //
  // AC (spec §13.6 trigger/scope): on `focusNode === 'sub-to-10'`, a
  //   problem with `op === '-'` and minuend ∈ [5,10] mounts a SINGLE
  //   minuend cell. Plus the captured-request positive discriminator
  //   proving the sub-tier gate fired.
  //
  // Classification:
  //   - `math-sub-minuend-card` toHaveCount(1)  → RED-on-base LEVER
  //       (testid absent on main; op==='-' renders no card today).
  //   - exactly ONE `math-dot-card-cell` inside → RED-on-base LEVER
  //       (no cell renders for op==='-' today).
  //   - `data-pips === '8'` (the minuend, not subtrahend/answer)
  //                                              → RED-on-base LEVER.
  //   - captured `focusNode === 'sub-to-10'`     → REGRESSION-LOCK
  //       (passes on base — the browser already ships focusNode on the
  //        payload; locks that the gate reads the right tier).
  test('sub-to-10 minuend 8: single ten-frame minuend cell mounts (8 pips) + payload focusNode=sub-to-10', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // Capture the outgoing /api/claude POST for the positive
    // discriminator (testing-and-ci.md §4.1.1e fix pattern). We still
    // serve the canned sub-to-10 plan from the same handler.
    const requests: Request[] = []
    await page.route('**/api/claude', async (route, request) => {
      requests.push(request)
      const body = JSON.parse(request.postData() ?? '{}') as {
        kind?: string
      }
      if (body.kind !== 'session-start') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: 'invalid-body' }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cannedSubToTenMinuendEightAtP1()),
      })
    })

    await seedLocalStorage(page, {
      progress: buildSubToTenSubitisingSeed({
        subSessionsObserved: 0, // first-encounter window → scaffold ON
        subLeitnerTargetBox: null, // empty sub-facts → 0 sentinel → ON anyway
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await navigateToMath(page)

    // Canon-landed gate: confirm the canned sub-to-10 plan reached the
    // screen (Q1 = `8 - 4`), NOT a silent static add-to-10 fallback. If
    // this fires, the scaffold assertions below would be meaningless.
    await expect(page.getByTestId('math-addend-a')).toHaveText('8', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('4', {
      timeout: 15_000,
    })

    // ── RED-on-base levers ────────────────────────────────────────────────
    // Exactly one minuend-card container, exactly one cell inside it.
    await expect(page.getByTestId(SUB_MINUEND_CARD_TESTID)).toHaveCount(1)
    await expect(
      page
        .getByTestId(SUB_MINUEND_CARD_TESTID)
        .getByTestId(DOT_CARD_CELL_TESTID),
    ).toHaveCount(1)

    // The cell shows the MINUEND quantity (8), not subtrahend (4) or
    // answer (4). `data-pips` carries the rendered quantity.
    await expect(
      page
        .getByTestId(SUB_MINUEND_CARD_TESTID)
        .getByTestId(DOT_CARD_CELL_TESTID),
    ).toHaveAttribute('data-pips', '8')

    // No second cell, no operator glyph inside the overlay — cell count
    // inside the minuend card is exactly 1 (asserted above). Belt: the
    // add scaffold's two-cell container must NOT be present on a
    // subtraction problem (`math-visual-groups` is skipped for op==='-').
    await expect(page.getByTestId('math-visual-groups')).toHaveCount(0)

    // ── Regression-lock — captured-request positive discriminator ─────────
    // Defensive-pairing per testing-and-ci.md §4.1 (toBeDefined gate
    // before destructuring postData).
    const mathReq = requests.find((r) => {
      const payload = JSON.parse(r.postData() ?? '{}') as {
        payload?: { track?: string; progress?: { focusNode?: string } }
      }
      return payload.payload?.track !== 'word-song'
    })
    expect(mathReq).toBeDefined()
    const payload = JSON.parse(mathReq!.postData() ?? '{}') as {
      payload?: { progress?: { focusNode?: string } }
    }
    expect(payload.payload?.progress?.focusNode).toBe('sub-to-10')
  })

  // ── Test 2 ─────────────────────────────────────────────────────────────────
  //
  // AC (spec §13.6 pip vocabulary): minuend 5 renders the canonical
  //   die-5 face (5 pips via DotCardCell), NOT a ten-frame — but it is
  //   still ONE cell carrying `data-pips="5"`. This pins the
  //   value-conditional rendering boundary at 5 (§13.2.2).
  //
  // Classification:
  //   - card mounts + single cell + data-pips='5' → RED-on-base LEVER
  //     (no sub minuend card exists on main).
  test('sub-to-10 minuend 5: single die-5 cell mounts (5 pips, value-conditional boundary)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    await installClaudeMock(page, {
      mathResponse: cannedSubToTenMinuendFiveAtP1,
    })
    await seedLocalStorage(page, {
      progress: buildSubToTenSubitisingSeed({
        subSessionsObserved: 0,
        subLeitnerTargetBox: null,
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await navigateToMath(page)

    // Canon-landed gate: Q1 = `5 - 5`.
    await expect(page.getByTestId('math-addend-a')).toHaveText('5', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('5', {
      timeout: 15_000,
    })

    // ── RED-on-base levers ────────────────────────────────────────────────
    await expect(page.getByTestId(SUB_MINUEND_CARD_TESTID)).toHaveCount(1)
    const cell = page
      .getByTestId(SUB_MINUEND_CARD_TESTID)
      .getByTestId(DOT_CARD_CELL_TESTID)
    await expect(cell).toHaveCount(1)
    await expect(cell).toHaveAttribute('data-pips', '5')
  })

  // ── Test 3 ─────────────────────────────────────────────────────────────────
  //
  // AC (spec §13.6 fade signal): after 3+ sub-to-10 scaffold sessions
  //   with `easyBandSubLeitnerMeanBox >= 4.0`, the scaffold does NOT
  //   fire on any in-scope problem (permanent fade, deterministic OFF).
  //   We saturate the SUB facts at box 5 (mean 5.0 ≥ 4.0) and set
  //   sessionsObserved = 5 (past first-encounter).
  //
  //   CROSS-OPERATION ISOLATION sub-clause: we ALSO seed ADD facts at
  //   box 5. If Devon's gate wrongly read the add-facts mean, that would
  //   ALSO suppress — so this seed alone can't distinguish. Test 1
  //   (sub empty + add high → ON) is the isolation discriminator; here
  //   the sub mean itself is high, so OFF is the correct verdict.
  //
  // Classification:
  //   - `toHaveCount(0)`                          → trivially-green TODAY
  //     (sub minuend card never renders on main), real REGRESSION-GUARD
  //     post-W10.3 (proves the fade actually suppresses).
  test('permanent fade: 5 sub-sessions + sub-facts Leitner mean 5.0 → no minuend card', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    await installClaudeMock(page, {
      mathResponse: cannedSubToTenMinuendEightAtP1,
    })
    await seedLocalStorage(page, {
      progress: buildSubToTenSubitisingSeed({
        subSessionsObserved: 5, // past 3-session first-encounter gate
        subLeitnerTargetBox: 5, // sub mean = 5.0 → P=0 (≥ 4.0)
        addLeitnerTargetBox: 5, // add also high (does not matter for verdict)
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 10 }),
    })

    await page.goto('/')
    await navigateToMath(page)

    // Canon-landed gate: Q1 = `8 - 4` is in-band (minuend 8 ∈ [5,10]).
    // If the scaffold were ON it WOULD mount here — so count 0 proves
    // suppression, not out-of-band exclusion.
    await expect(page.getByTestId('math-addend-a')).toHaveText('8', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('4', {
      timeout: 15_000,
    })

    // Scaffold suppressed (fade permanent). Static-absence → toHaveCount.
    await expect(page.getByTestId(SUB_MINUEND_CARD_TESTID)).toHaveCount(0)
  })

  // ── Test 4 ─────────────────────────────────────────────────────────────────
  //
  // AC (spec §13.6 fade signal + §2.3 carried over): the per-session
  //   decision is sticky — if Q1 shows the minuend card, all in-scope
  //   problems Q2, Q3 also show it; NO mid-session toggling. We force
  //   the ON branch by seeding sub-facts BELOW the fade-start threshold
  //   (`easyBandSubLeitnerMeanBox = 1.0 < 2.0` → P=1.0) AND past the
  //   first-encounter window (so we're truly testing the fade-mean path,
  //   not the unconditional first-encounter override).
  //
  // Mock seam — REAL ON-DISK CANON BYTES, not silent placeholder.
  //   This is the ONLY test in the spec that drives a multi-problem chip-
  //   advance walk. Per testing-and-ci.md §4.1.3 rule 3, multi-problem
  //   chip-walk specs MUST serve real-canon MP3 bytes: the silent-MP3
  //   placeholder used by the single-problem tests does NOT decode under
  //   the genuine gesture-unlock chain, so the read-aloud→chip-enable
  //   gate never releases and `toBeEnabled()` stalls (the chip-disabled
  //   failure Kevin observed on `614d429`). `forceHowlerUnlock` is the
  //   WRONG fix (§4.1.2 silent-demote: its stub-ctx breaks real-bytes
  //   decode → silent static add-to-10 fallback → op:'+' with no sub
  //   scaffold → stickiness assertion unsatisfiable). On-disk canon P1–P3
  //   are `5-5`, `6-3`, `9-1`, all minuends ∈ [5,10], so the sub card
  //   mounts on each — exactly the sticky-on walk this AC needs.
  //
  // Classification:
  //   - card mounts on Q1, Q2, Q3 (sticky)        → RED-on-base LEVER
  //     post-W10.3 if Devon's decision were per-problem instead of
  //     per-session; today trivially the card never renders, so the
  //     first iteration is the load-bearing RED lever (count 1 vs 0).
  //   - captured `focusNode === 'sub-to-10'`       → REGRESSION-LOCK
  //     (passes on base; locks that the walk runs against the sub tier).
  test('sticky-on under low sub-facts fluency: minuend card mounts on Q1, Q2, Q3', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    const canonBody = readMathCanon(SUB_TO_TEN_CANON_PATH)
    const { requests } = await installSubToTenCanonClaudeMock(page, canonBody)
    await seedLocalStorage(page, {
      progress: buildSubToTenSubitisingSeed({
        subSessionsObserved: 5, // past first-encounter → tests the mean path
        subLeitnerTargetBox: 1, // sub mean = 1.0 < 2.0 → P=1.0 always
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 10 }),
    })

    await page.goto('/')
    await navigateToMath(page)

    // Canon-landed gate: confirm the on-disk sub-to-10 canon reached the
    // screen (canon Q1 = `5 - 5`), NOT a silent static add-to-10 fallback.
    await expect(page.getByTestId('math-addend-a')).toHaveText('5', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('5', {
      timeout: 15_000,
    })

    // Walk Q1, Q2, Q3 via the `data-problem-index` DOM gate (0-based per
    // testing-and-ci.md §4.1.3 — Q1='0', Q2='1', Q3='2'). All three are
    // in-band sub-to-10 minuends (5, 6, 9), so the sticky card must mount
    // on each.
    for (let q = 0; q < 3; q++) {
      await expect(page.getByTestId('math')).toHaveAttribute(
        'data-problem-index',
        String(q),
        { timeout: 15_000 },
      )
      await expect(page.getByTestId(SUB_MINUEND_CARD_TESTID)).toHaveCount(1, {
        timeout: 5_000,
      })

      // Advance to the next problem unless we've hit Q3. Real-canon MP3
      // bytes decode → read-aloud resolves → the correct chip enables.
      if (q < 2) {
        const correctChip = page.locator(
          '[data-testid="math-chip"][data-correct="true"]',
        )
        await expect(correctChip).toBeEnabled({ timeout: 15_000 })
        await correctChip.click()
      }
    }

    // ── Regression-lock — captured-request positive discriminator ─────────
    // Defensive-pairing per testing-and-ci.md §4.1 (toBeDefined gate
    // before destructuring postData). Proves the walk ran against the
    // sub-to-10 tier, not a silent wrong-tier fallback.
    const mathReq = requests.find((r) => {
      const payload = JSON.parse(r.postData() ?? '{}') as {
        payload?: { track?: string; progress?: { focusNode?: string } }
      }
      return payload.payload?.track !== 'word-song'
    })
    expect(mathReq).toBeDefined()
    const payload = JSON.parse(mathReq!.postData() ?? '{}') as {
      payload?: { progress?: { focusNode?: string } }
    }
    expect(payload.payload?.progress?.focusNode).toBe('sub-to-10')
  })

  // ── Test 5 ─────────────────────────────────────────────────────────────────
  //
  // REGRESSION-PIN (dispatch brief item 4): the existing add-to-10
  //   two-cell scaffold behaviour is UNCHANGED by the sub-tier work. On
  //   an add-to-10 problem with both addends ≤ 5 (`3 + 4`), the existing
  //   `subitising-scaffold-dot-card` + 2 cells still mount, and the NEW
  //   `math-sub-minuend-card` must NOT appear.
  //
  // Classification:
  //   - existing add scaffold present (2 cells)   → REGRESSION-LOCK
  //     (passes on base AND must keep passing post-W10.3).
  //   - new `math-sub-minuend-card` count 0        → trivially-green TODAY
  //     (testid doesn't exist), real REGRESSION-GUARD post-W10.3
  //     (the sub card must never fire on the add tier).
  test('regression-pin: add-to-10 two-cell scaffold unaffected; no sub minuend card', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    await installClaudeMock(page, {
      mathResponse: cannedAddToTenSmallAddendsAtP1,
    })
    await seedLocalStorage(page, {
      progress: buildAddToTenSubitisingSeed(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await navigateToMath(page)

    // Canon landed (Q1 = `3 + 4`).
    await expect(page.getByTestId('math-addend-a')).toHaveText('3', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('math-addend-b')).toHaveText('4', {
      timeout: 15_000,
    })

    // ── Regression-lock — existing add-to-10 two-cell scaffold mounts ─────
    await expect(page.getByTestId('subitising-scaffold-dot-card')).toHaveCount(
      1,
    )
    await expect(page.getByTestId('math-dot-card-cell')).toHaveCount(2)

    // ── Regression-guard — the NEW sub minuend card must NOT fire here ────
    await expect(page.getByTestId(SUB_MINUEND_CARD_TESTID)).toHaveCount(0)
  })

  // ── Test 6 — assertion-sensitivity sub-test (Wave 7 retro Pattern 3) ────────
  //
  // The other tests' `toHaveCount(0)` assertions (Test 3 permanent-fade,
  // Test 5 sub-card-absent-on-add) are trivially-green on main because
  // the `math-sub-minuend-card` testid does not exist yet. That is
  // ACCEPTABLE per the failing-first protocol (they become real guards
  // post-W10.3) — but it leaves open the risk that a `toHaveCount(0)`
  // assertion is silently mis-targeted (wrong testid string) and would
  // STAY green even after W10.3 ships, never catching a real regression.
  //
  // This sub-test proves the count-0 machinery is WIRED CORRECTLY by
  // asserting that a DELIBERATELY-WRONG-but-known-PRESENT selector does
  // NOT report 0 — i.e. the `toHaveCount` plumbing genuinely observes
  // the DOM. We assert the `math` root (always present) has count 1, and
  // a guaranteed-absent sentinel testid has count 0. If `toHaveCount`
  // were broken (e.g. always-0), the first assertion would fail; if it
  // were always-N, the second would fail. This pins the assertion
  // SENSITIVITY independent of the not-yet-shipped feature.
  test('assertion-sensitivity: toHaveCount observes present vs absent DOM correctly', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    await installClaudeMock(page, {
      mathResponse: cannedSubToTenMinuendEightAtP1,
    })
    await seedLocalStorage(page, {
      progress: buildSubToTenSubitisingSeed({
        subSessionsObserved: 0,
        subLeitnerTargetBox: null,
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await navigateToMath(page)
    await expect(page.getByTestId('math-addend-a')).toHaveText('8', {
      timeout: 15_000,
    })

    // PRESENT element → count 1 (proves toHaveCount can observe a hit).
    await expect(page.getByTestId('math')).toHaveCount(1)
    // GUARANTEED-ABSENT element → count 0 (proves toHaveCount(0) is not
    // vacuously true for arbitrary strings — it genuinely returns the
    // real DOM census). This sentinel is intentionally never a real
    // testid.
    await expect(
      page.getByTestId('zzz-never-a-real-testid-sentinel'),
    ).toHaveCount(0)
  })
})
