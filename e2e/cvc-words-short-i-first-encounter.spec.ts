/**
 * E2E regression spec — cvc-words-short-i first-encounter gate (ticket
 * 86c9qdp1q).
 *
 * Sibling to `cvc-words-short-u-regression.spec.ts` test 9 (PR #174,
 * ticket 86c9q9ben — AC9g). Pins the lifetime-first-encounter gate
 * for short-i:
 *
 *   - First-ever short-i session: opener fires once. The browser ships
 *     `progress.lifetimeFirstEncounters` WITHOUT `cvc-words-short-i`,
 *     so the server-side gate (`api/_firstEncounterGate.ts`) leaves
 *     the canon's `/i/` vs `/ɪ/` contrast opener intact.
 *   - Second short-i session for same Marian profile: opener does
 *     NOT fire. The browser ships `progress.lifetimeFirstEncounters`
 *     INCLUDING `cvc-words-short-i`, so the server's gate substitutes
 *     the vanilla "You did it!" opener (sourced from the
 *     `cvc-words.json` canon).
 *   - Fresh-seed profile entering short-i: opener fires once. Same
 *     greenfield posture as the first case — verifies a brand-new
 *     `lifetimeFirstEncounters: []` Marian still gets the
 *     scaffolding, not just one with a partial list.
 *
 * Why this lives separately from `cvc-words-short-i-regression.spec.ts`
 * --------------------------------------------------------------------
 * The flow-level spec was shipped in PR #190 with the lifetime gate
 * explicitly carved out as out-of-scope (see that spec's header
 * "Note on first-encounter scaffolding"). Per the dispatch contract
 * for ticket 86c9qdp1q, the gate lives in this dedicated file rather
 * than getting bolted onto the existing flow spec — same separation
 * the short-u sibling kept: test 9 of the short-u regression spec
 * (`cvc-words-short-u-regression.spec.ts`) is the only short-u file,
 * because the short-u gate landed in the same PR as the tier itself.
 * Short-i was scoped differently (ship-now-fix-later per Devon's PR
 * #190 review), so the gate spec ships in its own file.
 *
 * Mock strategy
 * -------------
 * Sibling `installCvcWordsShortIClaudeMock` returns the bytes of
 * `public/canon/word-song/level-1/cvc-words-short-i.json` — same
 * canon-bytes pass-through approach the short-u spec uses (real
 * Azure-rendered MP3s decode cleanly in headless Chromium; silent-
 * base64 fixtures break Howler).
 *
 * Test boundary
 * -------------
 * The browser-side wire shape (browser ships the right list under the
 * right circumstances) is what this spec verifies. The server-side
 * rewrite — gate fires the substitution when `cvc-words-short-i` is
 * in the list — is exercised directly by
 * `api/_firstEncounterGate.test.ts` (vitest) where we can assert the
 * rewrite output without round-tripping through the mock-fulfill
 * path. Same boundary the short-u spec set in test 9.
 *
 * Cross-browser posture
 * ---------------------
 * Every test in this file polls for the /api/claude POST without
 * waiting on WordSong's read-aloud effect to complete — the wire
 * shape (browser → server) is the contract under test, not the
 * downstream chip-render. So all tests run on chromium AND webkit
 * without the AudioContext-gating skip the flow-level
 * `cvc-words-short-i-regression.spec.ts` needs.
 */

import { test, expect } from '@playwright/test'
import type { Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * Path to the production canon file the spec serves as the mock
 * response. Resolved relative to `process.cwd()` because Playwright
 * runs the harness from the worktree root (same place vite preview
 * reads `public/`).
 */
const CVC_WORDS_SHORT_I_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/word-song/level-1/cvc-words-short-i.json',
)

/**
 * Install a /api/claude mock that returns the cvc-words-short-i canon
 * on word-song requests, captures every observed request body for the
 * lifetime-encounter wire-shape assertions. Math (or any other)
 * requests are intentionally rejected with 500 — a stray non-word-song
 * request would mean the spec's invariants are wrong.
 */
async function installCvcWordsShortIClaudeMock(
  page: import('@playwright/test').Page,
): Promise<{ requests: Request[] }> {
  const canonBody = readFileSync(CVC_WORDS_SHORT_I_CANON_PATH, 'utf-8')
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
        message: `cvc-words-short-i first-encounter spec only mocks word-song; saw track=${String(track)}`,
      }),
    })
  })
  return { requests }
}

test.describe('cvc-words-short-i first-encounter gate (ticket 86c9qdp1q)', () => {
  /**
   * AC1 — First-ever short-i session: browser ships the empty / partial
   * list (no `cvc-words-short-i`) on the planner request, so the
   * server-side gate leaves the canon's contrast opener intact.
   *
   * Greenfield Marian seeded with `cvc-words-short-i: 'practicing'`
   * AND `lifetimeFirstEncounters: []` (empty list — true cold-start
   * for the gate). Pins the wire-shape contract: empty array → first-
   * encounter posture.
   */
  test('1. AC1 — first-ever short-i session ships empty lifetimeFirstEncounters list (gate fires)', async ({
    page,
  }) => {
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'mastered',
          'cvc-words-short-u': 'mastered',
          'cvc-words-short-i': 'practicing',
        },
        lifetimeFirstEncounters: [],
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    const { requests } = await installCvcWordsShortIClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    // Wait for the planner request to fire — captured into `requests`.
    // Use a poll instead of waiting for WordSong to mount (so this test
    // runs on webkit too).
    await expect(async () => {
      expect(requests).toHaveLength(1)
    }).toPass({ timeout: 15_000 })

    const recorded = requests[0]!
    const body = JSON.parse(recorded.postData() ?? '{}') as {
      kind?: string
      payload?: {
        track?: string
        progress?: { focusNode?: string; lifetimeFirstEncounters?: unknown }
      }
    }

    expect(body.kind).toBe('session-start')
    expect(body.payload?.track).toBe('word-song')
    expect(body.payload?.progress?.focusNode).toBe('cvc-words-short-i')

    const list = body.payload?.progress?.lifetimeFirstEncounters
    expect(Array.isArray(list)).toBe(true)
    // Empty array — server's first-encounter gate sees
    // `cvc-words-short-i` NOT in [] → contrast line delivered as canon
    // ships it. Count-based assertion per
    // feedback_count_assertions_on_regression_tests.
    expect(list).toEqual([])
  })

  /**
   * AC2 — Second short-i session for same Marian profile: browser ships
   * the populated list (containing `cvc-words-short-i`), so the
   * server-side gate substitutes the vanilla "You did it!" opener.
   *
   * Pins the lifetime-once contract — Marian doesn't hear the
   * scaffolding twice.
   */
  test('2. AC2 — second short-i session ships short-i in lifetimeFirstEncounters list (gate does NOT fire)', async ({
    page,
  }) => {
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'mastered',
          'cvc-words-short-u': 'mastered',
          'cvc-words-short-i': 'practicing',
        },
        lifetimeFirstEncounters: ['cvc-words-short-i'],
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 6 }),
    })

    const { requests } = await installCvcWordsShortIClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    await expect(async () => {
      expect(requests).toHaveLength(1)
    }).toPass({ timeout: 15_000 })

    const body = JSON.parse(requests[0]!.postData() ?? '{}') as {
      payload?: {
        progress?: { lifetimeFirstEncounters?: unknown }
      }
    }
    const list = body.payload?.progress?.lifetimeFirstEncounters
    expect(Array.isArray(list)).toBe(true)
    // Populated list with `cvc-words-short-i` present → server's gate
    // substitutes the vanilla "You did it!" opener. The substitution
    // itself is exercised directly by `api/_firstEncounterGate.test.ts`;
    // here we pin the wire shape that triggers it.
    expect(list).toEqual(['cvc-words-short-i'])
  })

  /**
   * AC3 — Fresh-seed profile (truly greenfield, never any tier
   * encountered) entering short-i: opener fires once. Verifies the
   * read-path defaulter does NOT pre-populate `cvc-words-short-i` for
   * a fresh-out-of-the-box Marian, AND that the "first encounter"
   * posture holds even when prior tiers ARE in the list (mastered short-
   * a/o/u).
   */
  test('3. AC3 — fresh-seed profile with prior tiers encountered but NOT short-i ships first-encounter posture (gate fires)', async ({
    page,
  }) => {
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'letter-sounds': 'mastered',
          'blending-cv': 'mastered',
          'cvc-words': 'mastered',
          'cvc-words-short-o': 'mastered',
          'cvc-words-short-u': 'mastered',
          'cvc-words-short-i': 'practicing',
        },
        // Mirror what real Marian's localStorage would carry after
        // mastering each prior tier — first-encounter scaffolding for
        // those tiers fired in earlier sessions; only short-i is
        // genuinely unseen.
        lifetimeFirstEncounters: [
          'letter-names',
          'letter-sounds',
          'blending-cv',
          'cvc-words',
          'cvc-words-short-o',
          'cvc-words-short-u',
          // cvc-words-short-i is intentionally absent — first encounter.
        ],
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 12 }),
    })

    const { requests } = await installCvcWordsShortIClaudeMock(page)
    await page.goto('/')

    const hub = page.getByTestId('hub')
    await expect(hub).toBeVisible({ timeout: 10_000 })

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    await expect(async () => {
      expect(requests).toHaveLength(1)
    }).toPass({ timeout: 15_000 })

    const body = JSON.parse(requests[0]!.postData() ?? '{}') as {
      payload?: {
        progress?: { lifetimeFirstEncounters?: unknown }
      }
    }
    const list = body.payload?.progress?.lifetimeFirstEncounters
    expect(Array.isArray(list)).toBe(true)
    // Prior tiers are listed but short-i is NOT → server's gate sees
    // `cvc-words-short-i` not in the list → first-encounter posture,
    // contrast line delivered.
    expect(list).toEqual([
      'letter-names',
      'letter-sounds',
      'blending-cv',
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
    ])
    expect(list).not.toContain('cvc-words-short-i')
  })

  /**
   * Belt-and-braces: pin that the canon currently ships the contrast
   * opener (NOT vanilla). If a future canon re-bake accidentally
   * regresses to vanilla "You did it!" for short-i, the gate's whole
   * job becomes moot. This test reads the canon directly from disk —
   * same approach the planner-round-trip suite uses to lock baked
   * content.
   */
  test('4. Canon source-of-truth — short-i canon ships the /ɪ/ contrast opener', async () => {
    // Pure disk-read; no AudioContext or browser harness needed.
    interface CanonShape {
      utterances: ReadonlyArray<{ id: string; text: string }>
    }
    const canon = JSON.parse(
      readFileSync(CVC_WORDS_SHORT_I_CANON_PATH, 'utf-8'),
    ) as CanonShape
    const opener = canon.utterances.find((u) => u.id === 'session.end.opener')
    expect(opener).toBeDefined()
    // Exact line — the planner directive in `api/_planner.ts`
    // SHORT-I FIRST-ENCOUNTER SCAFFOLDING block. If a future canon
    // regen produces different text, this fails loudly so the
    // mismatch can't sneak past code review.
    expect(opener!.text).toBe(
      "Listen — short i says ih. Not 'ee' — just ih. Like pig: /p/-/ɪ/-/g/.",
    )
  })
})
