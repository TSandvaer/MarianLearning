/**
 * E2E spec — W12-05: Math three-hint scaffolding (failing-first).
 *
 * Ticket: 86ca87067 (Wave 12 — three-hint utterances). The test IS the
 * spec: authored RED on `origin/main` BEFORE the W12-01/02/03/04 dev
 * tickets land. Paired with:
 *   - W12-01 (Kevin): parser + `MathUtteranceSlot` widening (hint1/2/3).
 *   - W12-02 (Devon): Math.tsx consumer + three-beat choreography.
 *   - W12-04 (Kevin): targeted canon re-bake (88 hint → 264 hint1/2/3).
 *
 * WHAT THIS SPEC ASSERTS
 * ----------------------
 * Test 1 (RED-on-base lever): a math session served the THREE-HINT canon
 *   envelope, driven to 2 wrong taps on problem 1, plays three discrete
 *   hint utterances `hint1 → hint2 → hint3` IN ORDER. Observed via the
 *   `math-caption` text sequence (each hint replaces the caption as it
 *   plays; a MutationObserver records every distinct caption value so the
 *   ordered subsequence is captured race-free).
 *
 * Test 2 (back-compat regression-lock): the LEGACY single-`hint` canon
 *   envelope, same 2-wrong drive, plays EXACTLY ONE hint utterance with
 *   the legacy composite text. GREEN today; must STAY green after
 *   W12-01's parser widening (W12-01 AC#4 mandates legacy back-compat).
 *
 * ASSERTION CLASSIFICATION (per .claude/docs/testing-and-ci.md §4.1.1)
 * --------------------------------------------------------------------
 * Test 1 — RED-on-base lever. On `origin/main` the served three-hint
 *   envelope carries `math.p1.hint1/hint2/hint3` ids. The current parser
 *   regex (`src/screens/Math/planFromServer.ts`:
 *   `/^math\.p(\d+)\.(read|correct|reprompt|hint|giveAnswer)$/`) does NOT
 *   accept `hint1/2/3` → `mathSessionPlanFromServer` throws
 *   `PlanFromServerError` → `prepareMathPathA` rejects → the screen falls
 *   back to `pickStaticSessionPlan()` (single composite hint). After 2
 *   wrongs ONE composite hint caption appears — so "three distinct hint
 *   texts in order" is UNSATISFIABLE → RED. This is the contract's
 *   explicitly-acceptable "fixture fails to PARSE on main" RED shape
 *   (W12-05 ticket: parse rejection is acceptable as long as the spec can
 *   go green post-stack without edits).
 *
 *   HOW IT FLIPS GREEN (no spec edits):
 *     - W12-01 widens the parser regex + `MathUtteranceSlot` to accept
 *       hint1/2/3 → the three-hint envelope now PARSES (no demote).
 *     - W12-02 wires the Math.tsx consumer to play hint1 → hint2 → hint3
 *       sequentially after 2 wrongs (replacing the single
 *       `speak(problem.utterances.hint)` call) → three distinct caption
 *       texts appear in order.
 *   W12-04 (the canon re-bake) is NOT required for THIS spec to go green —
 *   the spec serves its own three-hint envelope via the mock, so the
 *   parser + consumer (W12-01 + W12-02) are the load-bearing activators.
 *   W12-04 ships the on-disk three-hint canon for production; the spec
 *   proves the end-to-end render path independently of the bake.
 *
 * Test 2 — Regression-lock. The legacy single-hint envelope PARSES on
 *   today's main → ONE composite hint after 2 wrongs → GREEN today. It
 *   must keep parsing after W12-01 (back-compat) → stays GREEN. Codifies
 *   existing behaviour; defends against a W12-02 refactor that breaks the
 *   single-hint path.
 *
 * NO TRIVIALLY-GREEN TRAP (§4.1.1d/e/f)
 * -------------------------------------
 * This spec does NOT use `failNetwork: true`. Both tests serve a POSITIVE
 * canon envelope (the served-canon-envelope positive discriminator) and
 * capture the outgoing `/api/claude` request to confirm a real math
 * session-start fired (not a static-fallback no-op). Test 1's load-bearing
 * assertion (three distinct hint texts in order) is satisfiable ONLY when
 * the three-hint envelope parsed AND the sequential consumer rendered —
 * neither the static fallback nor a single-hint render can produce it.
 *
 * AUDIO / `forceHowlerUnlock` (§4.1.2)
 * ------------------------------------
 * We deliberately do NOT call `forceHowlerUnlock`. This spec pins
 * canon-specific caption text (the hint texts), so `forceHowlerUnlock`'s
 * stub `AudioContext` would break MP3 decode → silent demote to the static
 * plan → wrong (single composite) hint text → the assertion would be
 * unsatisfiable for the wrong reason (§4.1.2 "poison for canon-served
 * content specs"). Instead we serve REAL on-disk add-to-10 canon MP3 bytes
 * (injected into the fixtures), drive the genuine gesture-unlock chain (Hub
 * node tap → Math), and gate the wrong-tap drive on `data-read-aloud-played
 * === 'true'`. WebKit headless has no AudioContext, so the spec is
 * chromium-only (`skipOnWebkitHeadless`).
 *
 * TIMEOUT (§4.1.1b)
 * -----------------
 * Single-problem flow (no multi-session walk): Splash→Hub→Math (~few s) +
 * read-aloud gate + 2 wrong taps + 3 sequential hint plays on the silent-
 * caption-walk fallback (~165 wpm). Budgeted at 120 s per test — generous
 * headroom over the ~30-40 s realistic walk, well within the per-spec
 * margin for slow CI runners.
 *
 * Out of scope: implementation (W12-01/02/03/04); word-song three-hint
 * (math-track only per the Wave 12 plan).
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  threeHintMathSessionResponse,
  legacyHintMathSessionResponse,
  THREE_HINT_TEXTS_P1,
  LEGACY_HINT_TEXT_P1,
} from './fixtures/canonicalSessionResponses'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

// ── WebKit-headless skip ─────────────────────────────────────────────────
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → canon MP3 cannot decode; the ' +
      'genuine gesture-unlock read-aloud gate never opens. Spec is ' +
      'chromium-only — real iPad Safari is unaffected.',
  )
}

// ── Real on-disk canon bytes (so the served fixtures decode) ─────────────
//
// The fixtures need bytes that decode under a real chromium AudioContext.
// The default silent-MP3 placeholder does not decode reliably; real
// Azure-rendered canon bytes do. We read ONE real utterance's base64 from
// the on-disk add-to-10 canon and stamp it onto every fixture utterance —
// the bytes only have to decode; the spec asserts on the fixture TEXT, not
// the audio. Resolved from `process.cwd()` (Playwright runs from the
// worktree root, same place `vite preview` serves `public/`).
const ADD_TO_TEN_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/math/level-1/add-to-10.json',
)

let cachedRealMp3: string | null = null

/** Read a real Azure-rendered MP3 base64 from the on-disk add-to-10 canon.
 *  Cached so the fixture builders don't re-read the file per utterance. */
function realCanonAudioBytes(): string {
  if (cachedRealMp3 !== null) return cachedRealMp3
  if (!existsSync(ADD_TO_TEN_CANON_PATH)) {
    throw new Error(
      `[math-three-hint spec] add-to-10 canon not found at ${ADD_TO_TEN_CANON_PATH}. ` +
        `Real canon MP3 bytes are required so the served three-hint/legacy ` +
        `fixtures decode under the genuine gesture-unlock chain — do NOT ` +
        `swap to a silent-MP3 placeholder (see file header §Audio).`,
    )
  }
  const canon = JSON.parse(readFileSync(ADD_TO_TEN_CANON_PATH, 'utf-8')) as {
    utterances: ReadonlyArray<{ audio?: { base64?: string } }>
  }
  const bytes = canon.utterances.find(
    (u) => typeof u.audio?.base64 === 'string' && u.audio.base64.length > 0,
  )?.audio?.base64
  if (!bytes) {
    throw new Error(
      `[math-three-hint spec] add-to-10 canon at ${ADD_TO_TEN_CANON_PATH} ` +
        `carries no inline base64 audio — cannot source decodable bytes.`,
    )
  }
  cachedRealMp3 = bytes
  return bytes
}

// ── /api/claude mock — serves the per-test math envelope, captures req ────
async function installMathEnvelopeMock(
  page: Page,
  response: () => unknown,
): Promise<{ requests: Request[] }> {
  const requests: Request[] = []
  await page.route('**/api/claude', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
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
        body: JSON.stringify(response()),
      })
      return
    }
    // Math-only spec — fail loud on any non-math track so an unintended
    // live hit cannot pass silently.
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: 'unexpected-track',
        message: `math-three-hint spec is math-only; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

// ── Seed — Marian's default add-to-10:'practicing' focus ──────────────────
//
// `buildSeedProgress()` defaults to the April diagnostic baseline where
// `add-to-10` is `practicing` and `number-recog` is `mastered`, so the
// focus-node picker lands on `add-to-10` — exactly the served fixture's
// tier. No skill-level overrides needed.
function buildMathSeed(): unknown {
  return buildSeedProgress()
}

// ── Caption-sequence recorder ─────────────────────────────────────────────
//
// Each `speak()` call replaces `math-caption`'s text. To capture a
// fast-changing sequence race-free, install an in-page `setInterval` poll
// (50 ms) that records every DISTINCT caption value into `window.__captionLog`
// as it changes. We read the log at the end and assert the expected hint
// subsequence appears in order. The poll captures the FULL caption text
// (`textContent` includes every word-span, revealed or not — `renderCaption`
// renders all words with opacity, never gating text content), so even a
// terminal hint that persists is recorded, and a mid-reveal snapshot is the
// complete hint text. A short interval guarantees no hint value (each held
// for ~its silent-walk duration) is replaced before a poll fires.
async function installCaptionRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __captionLog?: string[]
      __captionTimer?: number
    }
    w.__captionLog = []
    if (w.__captionTimer !== undefined) clearInterval(w.__captionTimer)
    // The caption renders each word in its own <span>; inter-word spacing is
    // CSS `marginRight`, NOT a whitespace text node, so `textContent`
    // concatenates words with no separators ("Look.One.And..."). Strip ALL
    // whitespace so comparisons are agnostic to how spacing is rendered — the
    // expected texts are stripped the same way (`stripWs` in Node).
    const norm = (s: string) => s.replace(/\s+/g, '')
    const tick = () => {
      const el = document.querySelector('[data-testid="math-caption"]')
      const txt = el && el.textContent ? norm(el.textContent) : ''
      if (!txt) return
      const log = w.__captionLog!
      if (log.length === 0 || log[log.length - 1] !== txt) log.push(txt)
    }
    tick()
    w.__captionTimer = window.setInterval(tick, 50)
  })
}

async function readCaptionLog(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __captionLog?: string[] }
    return w.__captionLog ?? []
  })
}

/** Strip ALL whitespace — matches the in-page recorder's `norm`. The caption
 *  renders words as separate spans with CSS margin (no whitespace text
 *  nodes), so `textContent` has no separators; the expected texts must be
 *  compared the same way. */
function stripWs(s: string): string {
  return s.replace(/\s+/g, '')
}

/** Index of the first log entry whose whitespace-stripped text equals
 *  `target`, searching at or after `from`. Returns -1 if absent. */
function indexOfText(log: string[], target: string, from = 0): number {
  const n = stripWs(target)
  for (let i = from; i < log.length; i++) {
    if (log[i] === n) return i
  }
  return -1
}

// ── Drive: Hub → Math, gate on read-aloud, tap 2 wrong chips on P1 ────────
async function navigateToMathP1(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  await page
    .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
    .click()
  await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })
  // Genuine gesture-unlock chain: the Hub tap unlocked Howler; the real
  // canon MP3 decodes → read-aloud fires → flips data-read-aloud-played.
  await expect(page.getByTestId('math')).toHaveAttribute(
    'data-read-aloud-played',
    'true',
    { timeout: 20_000 },
  )
  // Confirm we are on P1 (0-based attribute "0") — the three-hint fixture's
  // hint1/2/3 live on P1.
  await expect(page.getByTestId('math')).toHaveAttribute(
    'data-problem-index',
    '0',
    { timeout: 15_000 },
  )
}

/** Tap a wrong chip once. The screen ships ≥1 distractor per problem;
 *  we use the first one with data-correct="false". */
async function tapWrongChip(page: Page): Promise<void> {
  const wrongChip = page
    .locator('[data-testid="math-chip"][data-correct="false"]')
    .first()
  await expect(wrongChip).toBeEnabled({ timeout: 15_000 })
  await wrongChip.click()
}

test.describe('W12-05 — math three-hint scaffolding (failing-first)', () => {
  test('1. three-hint envelope: after 2 wrongs on P1, hint1 → hint2 → hint3 play in order [RED-on-base lever]', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(120_000)

    const { requests } = await installMathEnvelopeMock(page, () =>
      threeHintMathSessionResponse(realCanonAudioBytes),
    )
    await seedLocalStorage(page, {
      progress: buildMathSeed(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await navigateToMathP1(page)

    // Positive discriminator: a real math session-start request fired
    // (NOT a static-fallback no-op). Guards against the §4.1.1d/e traps.
    const mathRequest = requests.find((r) => {
      const p = JSON.parse(r.postData() ?? '{}') as {
        payload?: { track?: string }
      }
      return p.payload?.track === 'math'
    })
    expect(
      mathRequest,
      'a math session-start request must have fired',
    ).toBeDefined()

    // Start recording caption changes BEFORE the wrong taps so no hint
    // value is missed.
    await installCaptionRecorder(page)

    // Drive 2 wrong taps to cross HINT_AFTER_WRONG_COUNT (= 2). The hint
    // sequence schedules ~HINT_DELAY_AFTER_WRONG_MS (600 ms) after the
    // second wrong's reprompt resolves.
    await tapWrongChip(page)
    // After a wrong tap the correct chip stays tappable; re-acquire the
    // (still-present) wrong chip for the second tap.
    await tapWrongChip(page)

    // ── LOAD-BEARING: three distinct hint texts appear IN ORDER. ─────────
    // On RED main the three-hint envelope is parser-rejected → static
    // fallback → only ONE composite hint caption ever appears, so hint2's
    // text never shows and this wait times out = RED for the right reason.
    // Post W12-01 (parser) + W12-02 (sequential consumer) all three appear.
    await expect
      .poll(
        async () => {
          const log = await readCaptionLog(page)
          const i1 = indexOfText(log, THREE_HINT_TEXTS_P1[0])
          if (i1 < 0) return 0
          const i2 = indexOfText(log, THREE_HINT_TEXTS_P1[1], i1 + 1)
          if (i2 < 0) return 1
          const i3 = indexOfText(log, THREE_HINT_TEXTS_P1[2], i2 + 1)
          if (i3 < 0) return 2
          return 3
        },
        {
          timeout: 30_000,
          message:
            'expected hint1 → hint2 → hint3 caption texts in order; ' +
            'fewer appeared (RED on base: single composite hint only)',
        },
      )
      .toBe(3)

    // Explicit ordering re-assert on the final log for a clear failure
    // diff (count-based per feedback_count_assertions_on_regression_tests:
    // each hint text appears, and the indices are strictly increasing).
    const finalLog = await readCaptionLog(page)
    const i1 = indexOfText(finalLog, THREE_HINT_TEXTS_P1[0])
    const i2 = indexOfText(finalLog, THREE_HINT_TEXTS_P1[1])
    const i3 = indexOfText(finalLog, THREE_HINT_TEXTS_P1[2])
    expect(i1, 'hint1 text present').toBeGreaterThanOrEqual(0)
    expect(i2, 'hint2 after hint1').toBeGreaterThan(i1)
    expect(i3, 'hint3 after hint2').toBeGreaterThan(i2)
  })

  test('2. legacy single-hint envelope: after 2 wrongs on P1, exactly ONE composite hint plays [back-compat regression-lock]', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)
    test.setTimeout(120_000)

    const { requests } = await installMathEnvelopeMock(page, () =>
      legacyHintMathSessionResponse(realCanonAudioBytes),
    )
    await seedLocalStorage(page, {
      progress: buildMathSeed(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await navigateToMathP1(page)

    const mathRequest = requests.find((r) => {
      const p = JSON.parse(r.postData() ?? '{}') as {
        payload?: { track?: string }
      }
      return p.payload?.track === 'math'
    })
    expect(
      mathRequest,
      'a math session-start request must have fired',
    ).toBeDefined()

    await installCaptionRecorder(page)

    await tapWrongChip(page)
    await tapWrongChip(page)

    // The legacy composite hint must appear (GREEN today; stays green
    // after W12-01 widens the parser while preserving back-compat).
    await expect
      .poll(
        async () => {
          const log = await readCaptionLog(page)
          return indexOfText(log, LEGACY_HINT_TEXT_P1) >= 0
        },
        {
          timeout: 30_000,
          message:
            'expected the legacy composite hint caption to appear after 2 ' +
            'wrongs (back-compat single-hint path)',
        },
      )
      .toBe(true)

    // Counter-assert: the three-hint texts must NOT appear on the legacy
    // path (the legacy fixture carries no hint1/2/3). This is a
    // trivially-green counter-test today (the texts simply do not exist in
    // the legacy envelope) but becomes a real guard post-W12-02 — it
    // proves a legacy plan does NOT accidentally fire the three-beat
    // sequence once the consumer can do so.
    const finalLog = await readCaptionLog(page)
    expect(
      indexOfText(finalLog, THREE_HINT_TEXTS_P1[1]),
      'hint2 text must NOT appear on the legacy single-hint path',
    ).toBe(-1)
    expect(
      indexOfText(finalLog, THREE_HINT_TEXTS_P1[2]),
      'hint3 text must NOT appear on the legacy single-hint path',
    ).toBe(-1)
  })
})
