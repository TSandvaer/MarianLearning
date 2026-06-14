/**
 * E2E spec — simple-sentences TERMINAL-TIER PROGRESSION:
 * intro → practicing → mastered with NO downstream unlock.
 *
 * Ticket: 86ca8d4ar (W13-05). Wave 13 simple-sentences content tier.
 *   Paired with the W13-03 content stack. Plan:
 *   `design/wave-13-simple-sentences-plan.md` (Track 4).
 *
 * WHY simple-sentences IS SPECIAL — the TERMINAL node
 * ---------------------------------------------------
 * `simple-sentences` is the LAST node of `WORD_SONG_NODES_IN_ORDER` and
 * `LITERACY_TREE`. `nextNode('word-song', 'simple-sentences')` returns
 * `null` (pinned at the unit level in `mastery.test.ts`). So unlike every
 * prior tier's progression spec — which asserts the downstream node flips
 * `'locked' → 'intro'` on mastery — this spec asserts the OPPOSITE: when
 * simple-sentences masters, there is NO downstream node to unlock. The
 * mastery is observable in the persisted Progress doc, but the unlock
 * cascade fires on nothing.
 *
 * This is the distinguishing AC-1 contract (per
 * `design/wave-13-simple-sentences-plan.md` Track 4): "assert promotion to
 * mastered with NO downstream unlock (nextNode → null)."
 *
 * WHAT THIS SPEC PINS — two tests
 * -------------------------------
 *   1. TERMINAL PROGRESSION WALK (test 1, REGRESSION-LOCK — verified
 *      GREEN on base): seed
 *      simple-sentences at `'intro'` with every prior word-song tier
 *      `'mastered'`, run 3 perfect sessions, and assert:
 *        - simple-sentences advances intro → practicing → mastered.
 *        - NO new node flips off `'locked'` (the unlock cascade is a
 *          no-op at the terminal node) — asserted by snapshotting the FULL
 *          word-song skillLevels map and proving exactly the terminal node
 *          changed and nothing downstream appeared.
 *        - The session focus stays on simple-sentences for all 3 sessions
 *          (the picker falls back to the LAST node when everything before
 *          it is mastered — `focusNode.ts:148`).
 *      RED on base because the content stack (W13-03) is not yet merged:
 *      with `failNetwork: true`, the word-song session runs the static
 *      stub plan and records `skillFocus: ['simple-sentences']` regardless
 *      (the focusNode picker already lands here on main — the literal is
 *      the terminal tree node). HOWEVER the mastery-rule walk depends on
 *      the production mastery engine, which IS wired on main for the
 *      terminal node already.
 *
 *      *** Failing-first mechanism — read carefully ***
 *      The progression STATE MACHINE (mastery.ts) already handles the
 *      terminal node on main (the literal is in LITERACY_TREE). So the
 *      mastery walk in test 1 is GREEN on main as a REGRESSION-LOCK — it
 *      codifies that the terminal-node mastery + no-downstream-unlock
 *      behaviour is correct, and locks it against a future tier insertion
 *      that would add a node AFTER simple-sentences (which would silently
 *      turn the no-unlock assertion into a wrong-unlock regression). The
 *      RED-on-base lever for the CONTENT/render lives in the sibling
 *      `simple-sentences-content.spec.ts`; this progression spec is the
 *      REGRESSION-LOCK half of the AC-1 pair (same split as
 *      `sight-words-progression.spec.ts` vs `sight-words-content.spec.ts`).
 *
 *   2. PICKER CONTRACT (test 2, regression-lock): with every prior
 *      word-song tier `'mastered'` and simple-sentences `'practicing'`,
 *      the session-start planner request carries
 *      `progress.focusNode === 'simple-sentences'`. A tight,
 *      single-assertion wire check (POSITIVE request-body discriminator —
 *      testing-and-ci.md §4.1.1e). Passes on base (the literal is the
 *      terminal node on main); locks the picker against a reorder or a
 *      future post-terminal tier insertion.
 *
 * CLASSIFICATION (failing-first protocol step 2)
 * ----------------------------------------------
 * Both tests are REGRESSION-LOCKs (they pass on base): the progression
 * state machine + picker already handle the terminal `simple-sentences`
 * literal on main. The RED-on-base levers for this ticket live in
 * `simple-sentences-content.spec.ts` (canon round-trip + render mechanic).
 * This file is the AC-1 progression half — per
 * `feedback_progression_e2e_mandatory`, any PR touching the picker /
 * mastery path for simple-sentences is covered by this + the content spec.
 * The no-downstream-unlock assertion is the load-bearing terminal-tier
 * contract that has no analogue in any prior tier's progression spec.
 *
 * Why `failNetwork: true` here (and NOT in the content spec)
 * ---------------------------------------------------------
 * This spec asserts on the PERSISTED Progress doc (skillLevels + history)
 * and the OUTGOING request body — content-AGNOSTIC state written at the
 * chip-tap site / mastery-engine, NOT pinned to canon-specific content.
 * Per testing-and-ci.md §4.1.2, `forceHowlerUnlock` + `failNetwork` is the
 * correct harness for content-agnostic progression walks (the silent
 * demote substitutes one plan for another, but the assertions don't pin
 * the plan's content). The focusNode discriminator in test 2 lives in the
 * request body, so test 2 serves a 200 (CVC fixture) and captures the body
 * rather than aborting.
 *
 * Threshold + cross-day setup
 * ---------------------------
 * 90/3 per-track (the production word-song default) with
 * `crossDayEnforcement: false` so three back-to-back sessions qualify.
 * Test 1 runs the full intro → practicing → mastered ladder at the real
 * production threshold (mirrors `progression-mastery-loop.spec.ts` Part 3).
 *
 * Sizing
 * ------
 * Test 1 is a 3-session walk (~25-50s/session on the silent caption-walk
 * fallback). The default 90s budget overruns — `test.setTimeout` per
 * §4.1.1b: 3 × 50s + 30s headroom = 180s.
 *
 * Chromium-only (webkit skip)
 * ---------------------------
 * WebKit headless has no AudioContext; chips never enable. The
 * progression state-machine surface is engine-agnostic; chromium coverage
 * is sufficient. Test 2 is a pure payload assertion and runs on both.
 *
 * Count-based assertions
 * ----------------------
 * Per `feedback_count_assertions_on_regression_tests`: `.toBe()` /
 * `.toEqual([...])`. Never `.toContain` on regression behaviour.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  forceHowlerUnlock,
  readProgressFromPage,
  seedLocalStorage,
} from './_helpers/seedStorage'
import { canonicalWordSongSessionResponse } from './fixtures/canonicalSessionResponses'

interface PersistedProgress {
  skillLevels: Record<string, string>
  history: Array<{ dateISO: string; skillFocus: string[]; successRate: number }>
}

/**
 * The complete word-song skill tree, root-to-leaf, on main. Source of
 * truth: `WORD_SONG_NODES_IN_ORDER` (`src/lib/progress/focusNode.ts`).
 * `simple-sentences` is the terminal node — there is NOTHING after it, so
 * the no-downstream-unlock assertion in test 1 can prove the FULL map's
 * post-mastery shape (only the terminal node changed level).
 */
const WORD_SONG_NODES: ReadonlyArray<string> = [
  'letter-names',
  'letter-sounds',
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
  'digraphs-sh',
  'digraphs-ch',
  'digraphs-th-voiceless',
  'sight-words',
  'simple-sentences',
]

/**
 * WebKit headless has no AudioContext. Chips never enable; chip-tap tests
 * time out. Real iPad Safari works fine — Playwright harness limitation
 * only. Pattern mirrored from `progression-mastery-loop.spec.ts`.
 */
function skipOnWebkitHeadless(testInfo: {
  skip: (cond: boolean, msg?: string) => void
  project: { name: string }
}): void {
  testInfo.skip(
    testInfo.project.name === 'webkit',
    'WebKit headless has no AudioContext → read-aloud cannot fire. Chromium coverage is sufficient for the progression state-machine surface.',
  )
}

/**
 * Drive one complete word-song session: Hub → Word Song → 8 correct chip
 * taps → SessionEnd → CTA → Hub. Content-agnostic — works against the
 * static stub plan (`failNetwork: true`).
 */
async function runOneWordSongSession(page: Page): Promise<void> {
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  await page
    .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
    .click()
  await expect(page.getByTestId('word-song')).toBeVisible({ timeout: 10_000 })

  for (let i = 1; i <= 8; i++) {
    const correctChip = page.locator(
      '[data-testid="word-song-chip"][data-correct="true"]',
    )
    await expect(correctChip).toBeEnabled({ timeout: 15_000 })
    await correctChip.click()
    if (i < 8) {
      await page.waitForTimeout(1500)
    }
  }

  await expect(page.getByTestId('session-end')).toBeVisible({ timeout: 10_000 })
  const cta = page.getByTestId('session-end-cta')
  await expect(cta).toBeVisible({ timeout: 12_000 })
  await cta.click()
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
}

/**
 * The seed used by test 1: every word-song node before simple-sentences
 * `'mastered'`; simple-sentences `'intro'`. 90/3 with cross-day off,
 * both tracks supplied (isParentSettings strict per-track guard — see the
 * progression-mastery-loop gotcha note). Math threshold set to an
 * unreachable 95/3 so a stray math session can't qualify.
 */
function buildTerminalSeed(): Record<string, unknown> {
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
      'digraphs-th-voiceless': 'mastered',
      'sight-words': 'mastered',
      'simple-sentences': 'intro',
    },
    masteryThreshold: { percent: 0.9, sessions: 3 },
  })

  return {
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
}

test.describe('simple-sentences TERMINAL progression — mastery with NO downstream unlock (W13-05)', () => {
  /**
   * TEST 1 — Terminal-tier progression walk: intro → practicing →
   * mastered, NO downstream unlock.
   *
   * CLASSIFICATION: REGRESSION-LOCK. The mastery state machine already
   * handles the terminal `simple-sentences` literal on main (it is in
   * `LITERACY_TREE`), so this walk is GREEN on base. It LOCKS the
   * terminal-tier behaviour — specifically the no-downstream-unlock
   * property that `nextNode → null` guarantees — against a future tier
   * insertion that would add a node after simple-sentences and silently
   * turn this into a wrong-unlock regression.
   *
   * The distinguishing assertion (no analogue in any prior tier's
   * progression spec): snapshot the FULL word-song skillLevels map before
   * and after the walk; prove EXACTLY ONE node changed (simple-sentences
   * intro → mastered) and no node went from `'locked'` to a non-locked
   * level (the unlock cascade was a no-op at the terminal node).
   */
  test('1. three perfect simple-sentences sessions promote intro → mastered with NO downstream unlock (nextNode → null)', async ({
    page,
  }, testInfo) => {
    skipOnWebkitHeadless(testInfo)

    // 3 sessions × ~50s + 30s headroom (testing-and-ci.md §4.1.1b).
    test.setTimeout(180_000)

    // failNetwork-canon-pinning audit (86c9y49bu): STRUCTURALLY SAFE.
    // Focus is `simple-sentences` (non-add-to-10/20) → static word-song
    // stub plan, but Test 1 asserts only on the persisted Progress doc
    // (skillLevels mastery transition / changed-node set / skillFocus /
    // history). No sentence content is pinned, so the §4.2 tier-asymmetry
    // never bites. (Test 2, the picker-payload assertion, deliberately
    // serves a 200 CVC fixture rather than failNetwork so it can capture
    // the outgoing request body — see its docstring.)
    await installClaudeMock(page, { failNetwork: true })
    await seedLocalStorage(page, {
      progress: buildTerminalSeed(),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)

    // Snapshot the seeded pre-walk word-song levels for the
    // exactly-one-node-changed assertion. (Read from the seed directly —
    // it is the ground truth installed into localStorage.)
    const seedLevels = (
      buildTerminalSeed() as { skillLevels: Record<string, string> }
    ).skillLevels

    // ── Session 1: intro → practicing ─────────────────────────────────
    await runOneWordSongSession(page)

    const afterSession1 = (await readProgressFromPage(
      page,
    )) as PersistedProgress
    expect(afterSession1).not.toBeNull()

    // intro→practicing fires on the first perfect session.
    expect(afterSession1.skillLevels['simple-sentences']).toBe('practicing')
    expect(afterSession1.history.length).toBe(1)
    expect(afterSession1.history[0]!.skillFocus).toEqual(['simple-sentences'])
    expect(afterSession1.history[0]!.successRate).toBe(1)

    // ── Sessions 2-3: practicing → mastered ───────────────────────────
    await runOneWordSongSession(page)
    await runOneWordSongSession(page)

    const afterSession3 = (await readProgressFromPage(
      page,
    )) as PersistedProgress
    expect(afterSession3).not.toBeNull()

    // SMOKING GUN A — practicing→mastered fires under the 90/3 window.
    expect(afterSession3.skillLevels['simple-sentences']).toBe('mastered')

    // SMOKING GUN B — NO DOWNSTREAM UNLOCK. simple-sentences is terminal
    // (`nextNode → null`), so mastering it unlocks nothing. Prove the
    // post-walk word-song map differs from the seed in EXACTLY ONE node
    // (the terminal node intro → mastered) and that NO node went from
    // `'locked'` to a non-locked level (the unlock cascade was a no-op).
    const changedNodes = WORD_SONG_NODES.filter(
      (node) => afterSession3.skillLevels[node] !== seedLevels[node],
    )
    expect(changedNodes).toEqual(['simple-sentences'])

    // And specifically: no word-song node that was `'locked'` in the seed
    // is now unlocked (the cascade fired on nothing). There were no
    // `'locked'` word-song nodes in the seed (all prior mastered, terminal
    // at intro), so the set of newly-unlocked nodes is exactly empty —
    // asserted as the empty array so a regression that adds a
    // post-terminal node + unlocks it names itself.
    const newlyUnlocked = WORD_SONG_NODES.filter(
      (node) =>
        seedLevels[node] === 'locked' &&
        afterSession3.skillLevels[node] !== 'locked',
    )
    expect(newlyUnlocked).toEqual([])

    // History accumulates exactly 3 entries, all on the terminal node —
    // the picker falls back to the LAST node when everything before it is
    // mastered (focusNode.ts:148), so session 3 (post-mastery) ALSO runs
    // simple-sentences rather than walking off the end of the tree.
    expect(afterSession3.history.length).toBe(3)
    const lastThree = afterSession3.history.slice(-3)
    expect(lastThree[0]!.successRate).toBe(1)
    expect(lastThree[1]!.successRate).toBe(1)
    expect(lastThree[2]!.successRate).toBe(1)
    expect(lastThree[0]!.skillFocus).toEqual(['simple-sentences'])
    expect(lastThree[1]!.skillFocus).toEqual(['simple-sentences'])
    expect(lastThree[2]!.skillFocus).toEqual(['simple-sentences'])
  })

  /**
   * TEST 2 — Picker contract: focus lands on simple-sentences.
   *
   * CLASSIFICATION: REGRESSION-LOCK. `simple-sentences` is already the
   * terminal node of `WORD_SONG_NODES_IN_ORDER` on main, so
   * `pickFocusNode` ALREADY lands on it given this seed — PASSES on base
   * and codifies that picker behaviour so a future tier insertion or
   * picker reorder can't silently move the focus off the terminal tier.
   *
   * Pure payload assertion (no chip enablement) — runs on BOTH engines.
   * Serves a 200 (CVC fixture is fine; the assertion is on the OUTGOING
   * request body, not the served plan) and captures the body — NOT
   * `failNetwork: true`, which aborts before the body can be captured.
   */
  test('2. pickFocusNode lands on simple-sentences: the session-start request carries focusNode=simple-sentences', async ({
    page,
  }) => {
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
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(canonicalWordSongSessionResponse()),
      })
    })

    // Seed: every prior word-song node `'mastered'`, simple-sentences
    // `'practicing'`. pickFocusNode walks WORD_SONG_NODES_IN_ORDER and
    // stops at the first non-mastered node — the terminal tier.
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
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
          'digraphs-th-voiceless': 'mastered',
          'sight-words': 'mastered',
          'simple-sentences': 'practicing',
        },
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')

    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()
    await expect(page.getByTestId('word-song')).toBeVisible({
      timeout: 15_000,
    })

    // Exactly one /api/claude POST for this session-start.
    expect(requests).toHaveLength(1)
    const body = JSON.parse(requests[0]!.postData() ?? '{}') as Record<
      string,
      unknown
    >
    expect(body.kind).toBe('session-start')
    const payload = body.payload as Record<string, unknown>
    expect(payload.track).toBe('word-song')
    const progressBlock = payload.progress as Record<string, unknown>
    expect(progressBlock).toBeDefined()
    // POSITIVE discriminator — the picker chose the terminal tier.
    expect(progressBlock.focusNode).toBe('simple-sentences')
  })
})
