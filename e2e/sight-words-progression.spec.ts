/**
 * E2E spec — sight-words PROGRESSION: focus picker lands on sight-words.
 *
 * Ticket: 86ca7xmn5 (W11-04). OPTIONAL sibling to
 * `sight-words-content.spec.ts` (the required Done-when file).
 *
 * SCOPE — what this spec is and is NOT
 * ------------------------------------
 * The FULL intro → practicing → mastered mastery walk for sight-words
 * already ships in `e2e/progression-mastery-loop.spec.ts` Part 2c
 * ("Progression loop — sight-words (intro → mastered)"), which seeds all
 * prior word-song tiers `'mastered'` + sight-words `'intro'`, runs two
 * perfect sessions, and asserts the promotion + `simple-sentences`
 * unlock. This spec does NOT duplicate that walk.
 *
 * What this spec adds is the focus-PICKER contract as a tight,
 * single-assertion wire check: with all prior word-song tiers
 * `'mastered'` and sight-words `'practicing'`, the session-start
 * planner request carries `progress.focusNode === 'sight-words'`. This
 * is the "assert pickFocusNode → sight-words" AC from the ticket,
 * pinned at the wire layer with a POSITIVE request-body discriminator
 * (testing-and-ci.md §4.1.1e) rather than re-running a multi-session
 * mastery walk.
 *
 * CLASSIFICATION (failing-first protocol step 2)
 * ----------------------------------------------
 * REGRESSION-LOCK. `sight-words` is already in
 * `WORD_SONG_NODES_IN_ORDER` on `main` (PR #217-era infra), so
 * `pickFocusNode` ALREADY lands on it given this seed — this test
 * PASSES on base and codifies that picker behaviour so a future tier
 * insertion or picker reorder can't silently move the focus off
 * sight-words. It is NOT a RED-on-base lever; the RED levers live in
 * `sight-words-content.spec.ts` (canon round-trip + render mechanic).
 *
 * This spec is paired with the content spec to satisfy the ticket's two
 * AC families (progression + content/render). Per
 * `feedback_progression_e2e_mandatory`, any PR touching the picker /
 * mastery path for sight-words is covered by this + the content spec.
 *
 * Why not `failNetwork: true`
 * ---------------------------
 * Per testing-and-ci.md §4.1.1d/e, `failNetwork` aborts the route
 * BEFORE the request body can be captured — and the focus-node
 * discriminator lives in the request body. We serve a 200 (a CVC
 * fixture is fine; the assertion is on the OUTGOING request, not the
 * served plan) and capture the body. The served-plan content is the
 * content spec's concern, not this one's.
 *
 * WebKit note
 * -----------
 * Pure payload assertion (no chip enablement / read-aloud dependency) —
 * runs on BOTH chromium + webkit.
 */

import { test, expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'
import { canonicalWordSongSessionResponse } from './fixtures/canonicalSessionResponses'

/**
 * Install a `/api/claude` mock that returns a 200 word-song fixture and
 * captures every observed request body for the picker-contract
 * assertion. The served plan is the canonical CVC fixture — the
 * assertion here is purely on the OUTGOING request's `focusNode`, so the
 * served content is irrelevant to this spec.
 */
async function installCapturingMock(
  page: Page,
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(canonicalWordSongSessionResponse()),
    })
  })
  return { requests }
}

test.describe('sight-words progression — focus picker lands on sight-words (W11-04)', () => {
  test.beforeEach(async ({ page }) => {
    // Seed: every word-song node before sight-words `'mastered'`;
    // sight-words `'practicing'`. `pickFocusNode` walks
    // WORD_SONG_NODES_IN_ORDER left-to-right and stops at the first
    // non-mastered node — which must be sight-words.
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
          'sight-words': 'practicing',
          'simple-sentences': 'locked',
        },
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })
  })

  /**
   * The picker contract: a returning Marian whose word-song tree is
   * mastered up to sight-words gets a sight-words session. Asserted at
   * the wire layer — the session-start planner request carries
   * `progress.focusNode === 'sight-words'`.
   */
  test('pickFocusNode lands on sight-words: the session-start request carries focusNode=sight-words', async ({
    page,
  }) => {
    const { requests } = await installCapturingMock(page)
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
    // POSITIVE discriminator — the picker chose sight-words.
    expect(progressBlock.focusNode).toBe('sight-words')
  })
})
