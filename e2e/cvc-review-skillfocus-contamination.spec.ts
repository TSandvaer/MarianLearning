/**
 * E2E FAILING-FIRST — periodic CVC-review must NOT contaminate the
 * forward-node mastery record (ticket 86ca9atqh, paired with Kevin's
 * `fix(word-song): periodic CVC-review skillFocus mislabel`).
 *
 * Status at authoring: INTENTIONALLY RED on `origin/main`. Goes GREEN once
 * Kevin's impl threads the real `sessionCount` into the session-end
 * `pickFocusNode` consult. Stays OPEN across sessions until the paired impl
 * merges, then rebases → greens → merges as a pair (same lifecycle as the
 * Wave-16 #469 cross-vowel-review-firing spec).
 *
 * THE BUG
 * -------
 * Once the WHOLE word-song tree is mastered, `pickFocusNode` enters
 * cvc-review maintenance mode. Post-graduation, every 5th session
 * (`sessionCount % CVC_REVIEW_PERIOD_SESSIONS === 0`) re-surfaces a mastered
 * CVC tier on a round-robin (a → o → u …) for a cross-vowel review session.
 *
 * The picker is `sessionCount`-dependent for that periodic branch:
 *   - SESSION-START (App.tsx ~L308): `pickFocusNode(progress, 'word-song',
 *     readSessionHistory().sessionCount)` — WITH the real sessionCount.
 *     `sessionCount=10` → periodic round-robin → `cvc-words-short-u`. The
 *     session genuinely runs on the short-u review tier.
 *   - SESSION-END (SessionEnd.tsx ~L481): `pickFocusNode(progressForFocus,
 *     track)` — `sessionCount` OMITTED (defaults to 0). The periodic branch
 *     is guarded by `sessionCount > 0`, so it is SKIPPED; `pickCvcReviewNode`
 *     returns `null`; the picker falls through to the forward fallback =
 *     the LAST node `'simple-sentences'`.
 *
 * Net: a high-scoring short-u review session writes its
 * `SessionHistoryEntry.skillFocus` as `['simple-sentences']` (the forward
 * fallback) instead of `['cvc-words-short-u']` (the tier actually
 * practised). The review's accuracy is credited to the WRONG node — the
 * mastery rule's per-node 90/3 window for the forward node ingests a
 * review it never decoded, and the CVC tier that WAS reviewed gets no
 * history credit at all. (Harm class: a forward tier's promotion window can
 * be advanced by a session that never targeted it → Marian skips a tier she
 * never decoded.)
 *
 * THE FIX (Kevin)
 * ---------------
 * Thread the real `sessionCount` (from `readSessionHistory()`) into the
 * session-end `pickFocusNode` call so the recorded `skillFocus` names the
 * tier the session actually ran on. After the fix, the periodic short-u
 * review records `skillFocus: ['cvc-words-short-u']`.
 *
 * WHY THIS IS RED ON BASE (failing-first contract)
 * ------------------------------------------------
 * On `origin/main`, the session-end picker omits `sessionCount` → records
 * `['simple-sentences']`. The load-bearing assertion below
 * (`expect(reviewEntry.skillFocus).toEqual(['cvc-words-short-u'])`) FAILS
 * because the persisted value is `['simple-sentences']`. Verified RED via
 * a direct production-function trace (session-start picks
 * `cvc-words-short-u`; session-end picks `simple-sentences`) and via the
 * full headless walk below.
 *
 * WHY NOT "forward-node 90/3 counter unchanged" (the Wave-16 #469 trap)
 * --------------------------------------------------------------------
 * The genuine production trigger requires the WHOLE tree mastered, so the
 * forward fallback is `'simple-sentences'` — which is ALREADY `'mastered'`.
 * The mastery rule only scans `'practicing'` nodes, so a phrasing like
 * "the forward node's 90/3 counter is unchanged" is TRIVIALLY green on base
 * (a mastered node can't advance regardless of the bug) — a
 * trivially-green counter-test, NOT a RED-on-base lever. We must NOT
 * hand-construct a synthetic state where the forward node is `'practicing'`
 * (production never emits a periodic review with a non-mastered forward
 * node — review only fires when `!hasForwardProgress`). The real,
 * production-faithful, RED-on-base invariant is the one this spec asserts:
 * the periodic review's recorded `skillFocus` names the CVC review tier,
 * NOT the forward fallback. (Confirmed against `focusNode.test.ts`:
 * `pickFocusNode(reviewProgress, 'word-song', 5)` → `cvc-words-short-o`;
 * `...(progress, 'word-song', 10)` → `cvc-words-short-u`.)
 *
 * BLACK-BOX SHAPE
 * ---------------
 * Seeds the genuine production precondition (whole tree mastered + the
 * graduation latch already fired + sessionCount=10) and plays ONE real
 * production word-song session, then reads the persisted Progress blob and
 * asserts the just-appended history entry's `skillFocus`. It does NOT poke
 * internal picker vocabulary — only the seeded precondition and the
 * persisted result.
 *
 * MOCK STRATEGY
 * -------------
 * `installCvcWordsShortUClaudeMock` returns the bytes of
 * `cvc-words-short-u.json` (real Azure-rendered MP3s) for any word-song
 * request — identical shape to the sibling cross-vowel-review-firing +
 * short-u regression specs. Synthetic silent-base64 fixtures decode flakily
 * in headless Chromium and never flip `data-read-aloud-played`
 * (.claude/docs/testing-and-ci.md §6). With sessionCount=10 the session-
 * start picker targets `cvc-words-short-u`, so the short-u canon matches the
 * tier the picker selected.
 *
 * WEBKIT SKIP RULE
 * ----------------
 * The chip-render walk needs the read-aloud effect to fire (chips enable).
 * WebKit headless has no AudioContext, so it skips per testing-and-ci.md
 * §2.2 / §8.3. Real iPad Safari is unaffected.
 */

import { test, expect } from '@playwright/test'
import type { Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'

// One full 8-problem walk on the silent-caption fallback is ~30-50s; size
// the per-test budget generously per testing-and-ci.md §4.1.1b.
test.setTimeout(120_000)

/**
 * Round-robin lands on `cvc-words-short-u` at sessionCount=10:
 * `CVC_TIERS[floor(10/5) % 3]` = `CVC_TIERS[2]` = `'cvc-words-short-u'`.
 * Pinned against `focusNode.test.ts` (period=5 → `CVC_TIERS[1]` short-o;
 * period×2=10 → `CVC_TIERS[2]` short-u). Using short-u keeps the served
 * canon aligned with the picked review tier.
 */
const PERIODIC_REVIEW_SESSION_COUNT = 10
const EXPECTED_REVIEW_TIER = 'cvc-words-short-u'
/** The wrong node the BUG records on base (forward fallback, last node). */
const FORWARD_FALLBACK_NODE = 'simple-sentences'

const CVC_WORDS_SHORT_U_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/cvc-words-short-u.json',
)

/** Returns the cvc-words-short-u canon bytes for any word-song request.
 *  Math (or any other) request is rejected with 500 — only word-song
 *  fetches in this flow. Identical shape to the sibling
 *  cvc-cross-vowel-review-firing spec's mock. */
async function installCvcWordsShortUClaudeMock(
  page: import('@playwright/test').Page,
): Promise<{ requests: Request[] }> {
  const canonBody = readFileSync(CVC_WORDS_SHORT_U_CANON_PATH, 'utf-8')
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
        message: `cvc-review-skillfocus spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud effect cannot fire, chips never enable. Production iPad Safari works fine; harness limitation.',
  )
}

/**
 * Narrow the loose `readProgressFromPage` return to the bits this spec
 * reads. Keeps the assertions honest about shape without dragging the
 * production `Progress` type in.
 */
interface ReadbackProgress {
  history: { skillFocus: string[]; successRate: number }[]
  skillLevels: Record<string, string>
}

test.describe('periodic CVC-review must not contaminate forward-node mastery (ticket 86ca9atqh) — FAILING-FIRST, RED on main until Kevin threads sessionCount into the session-end pick', () => {
  test('1. a high-scoring periodic CVC-review session records skillFocus on the REVIEW tier (cvc-words-short-u), NOT the forward fallback (simple-sentences)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // ── Seed the GENUINE production precondition ───────────────────────────
    // Whole word-song tree mastered through `simple-sentences` (so
    // `pickFocusNode` enters cvc-review maintenance mode — review fires
    // ONLY when the forward walk finds NO non-mastered node), PLUS the
    // graduation latch already fired (`cvcGraduationSessionFired: true`) so
    // the PERIODIC round-robin — not the one-shot graduation review — is the
    // branch under test. `sessionCount=10` is a positive multiple of
    // CVC_REVIEW_PERIOD_SESSIONS (5) whose round-robin index lands on
    // `cvc-words-short-u`.
    //
    // `cvcGraduationSessionFired` is NOT exposed by `buildSeedProgress`, so
    // it is raw-spread onto the seeded blob (the established stopgap for
    // Progress-level fields per testing-and-ci.md §4.1.1c — flagged as a NOF
    // for `SeedProgressOptions` widening). This is the real post-graduation
    // production shape, not a synthetic shortcut: the graduation review has
    // already fired for a Marian who finished the whole tree.
    const seededProgress = {
      ...(buildSeedProgress({
        skillLevelOverrides: {
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
          'sight-words': 'mastered',
          'simple-sentences': 'mastered',
        },
      }) as Record<string, unknown>),
      cvcGraduationSessionFired: true,
    }

    await seedLocalStorage(page, {
      progress: seededProgress,
      sessionHistory: buildSeedSessionHistory({
        sessionCount: PERIODIC_REVIEW_SESSION_COUNT,
      }),
    })

    const { requests } = await installCvcWordsShortUClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    const wordSong = page.getByTestId('word-song')
    await expect(wordSong).toBeVisible({ timeout: 15_000 })
    await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
      timeout: 20_000,
    })

    // ── Walk all 8 problems at 100% (high score) ───────────────────────────
    // Tapping the correct chip every problem is the "HIGH score" the brief
    // asks for: if this review were credited to a forward node's 90/3
    // window, it would advance that node's promotion counter. We always tap
    // the correct chip so successRate === 1.0 on the recorded entry.
    for (let i = 0; i < 8; i++) {
      await expect(wordSong).toHaveAttribute('data-problem-index', String(i), {
        timeout: 20_000,
      })
      await expect(wordSong).toHaveAttribute('data-read-aloud-played', 'true', {
        timeout: 20_000,
      })
      const correctChip = page.locator(
        '[data-testid="word-song-chip"][data-correct="true"]',
      )
      await expect(correctChip).toBeEnabled({ timeout: 15_000 })
      await correctChip.click()
    }

    // SessionEnd mounts and runs `recordProgressOnSessionEnd`, which appends
    // the new `SessionHistoryEntry` and persists the Progress blob. Wait for
    // SessionEnd to surface before reading back.
    await expect(page.getByTestId('session-end')).toBeVisible({
      timeout: 20_000,
    })

    // Read the persisted Progress blob back out and inspect the entry the
    // just-completed review session appended (the tail of `history`).
    const readback = (await readProgressFromPage(page)) as ReadbackProgress
    expect(
      readback,
      'progress blob must persist after session-end',
    ).not.toBeNull()
    expect(
      readback.history.length,
      'a session-end entry must be appended',
    ).toBeGreaterThan(0)
    const reviewEntry = readback.history[readback.history.length - 1]!

    // Sanity: the session genuinely ran at 100% (high score) so the harm —
    // crediting a high-accuracy review to the wrong node — is real. This is
    // a regression-lock on the score, independent of the focus bug.
    expect(
      reviewEntry.successRate,
      'the review session was walked at 100% — its accuracy is the contamination payload',
    ).toBe(1)

    // ── LOAD-BEARING RED-ON-BASE LEVER ─────────────────────────────────────
    // The recorded skillFocus must name the tier the session ACTUALLY ran on
    // (the periodic short-u review), not the forward fallback. Exact-array
    // assertion per feedback_count_assertions_on_regression_tests (NO
    // `.toContain` — a duplicate-fire / extra-node regression must fail).
    //
    // On `origin/main`: session-end omits `sessionCount` → periodic branch
    // skipped → records `['simple-sentences']` → THIS FAILS (RED).
    // After Kevin threads `sessionCount`: records `['cvc-words-short-u']` →
    // GREEN.
    expect(
      reviewEntry.skillFocus,
      `periodic CVC-review must record skillFocus on the review tier it ran on ` +
        `('${EXPECTED_REVIEW_TIER}'), not the forward fallback ('${FORWARD_FALLBACK_NODE}'). ` +
        `Recorded ['${reviewEntry.skillFocus.join("', '")}']. A '${FORWARD_FALLBACK_NODE}' here ` +
        `means the session-end pick dropped sessionCount → the review's accuracy is credited to ` +
        `the wrong node (contamination).`,
    ).toEqual([EXPECTED_REVIEW_TIER])

    // ── CONTAMINATION-NEGATIVE (corroborating, same root cause) ────────────
    // The forward fallback node must NOT appear in the recorded focus. This
    // is the direct "no contamination of the forward node" guard. On base it
    // IS recorded → fails; after the fix it never appears → passes.
    expect(
      reviewEntry.skillFocus.includes(FORWARD_FALLBACK_NODE),
      `the forward fallback '${FORWARD_FALLBACK_NODE}' must NOT be credited with a CVC-review ` +
        `session it never represented (contamination guard).`,
    ).toBe(false)

    // ── REGRESSION-LOCK: a word-song planner request actually fired ────────
    // Guards against the spec passing vacuously if the session never reached
    // the planner (e.g. routed to the static fallback). Passes on base too —
    // codifies existing wiring, not the bug.
    const planRequest = requests.find((r) => {
      try {
        const b = JSON.parse(r.postData() ?? '{}') as { payload?: unknown }
        return (
          (b.payload as { track?: string } | undefined)?.track === 'word-song'
        )
      } catch {
        return false
      }
    })
    expect(
      planRequest,
      'a word-song planner request must have fired (the session reached the planner)',
    ).toBeDefined()
  })
})
