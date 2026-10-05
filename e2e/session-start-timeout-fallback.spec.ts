/**
 * E2E spec — session-start timeout + prepared-session fallback
 * (Emma's Path 1/10, ClickUp 123jpnbc3dh).
 *
 * A session-start carrying canon-bypassing planner hints (Math: Leitner /
 * slow facts; Word Song: the letter-sounds vowel map) runs the live
 * planner on production (~15 s measured 2026-10-04). Once Marian has
 * waited SESSION_START_WAIT_TIMEOUT_MS (5 s) on the screen, App.tsx
 * aborts that request and re-requests WITHOUT the hints, which the server
 * answers from canon (~1 s).
 *
 * The mock below models that: a request WITH hints hangs for
 * `SLOW_PLANNER_MS` (far longer than the assertion window); a request
 * WITHOUT hints is fulfilled immediately. Each test proves:
 *   1. the "getting ready" beat is on screen while waiting (no blank slot);
 *   2. the problem area appears well before the slow planner would have
 *      answered — so the session still starts;
 *   3. exactly two session-start requests for the track: the first
 *      carries the hint, the second omits it.
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  canonicalMathSessionResponse,
  canonicalWordSongSessionResponse,
} from './fixtures/canonicalSessionResponses'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'
import {
  buildMathFactsLeitner,
  MIXED_BOX_FIXTURE,
} from './_helpers/leitnerFixtures'

/** How long the mocked live planner holds a hinted request. Longer than
 *  every assertion window below, so a pass can only come from the
 *  hint-free fallback request. */
const SLOW_PLANNER_MS = 60_000

/** Visible-wait budget (5 s) + canon response + render headroom for
 *  slow CI workers. Still far under SLOW_PLANNER_MS. */
const FALLBACK_VISIBLE_WITHIN_MS = 20_000

interface CapturedRequest {
  track: string
  progress: Record<string, unknown>
}

function isHinted(progress: Record<string, unknown>): boolean {
  return (
    progress.leitner !== undefined ||
    progress.slowFacts !== undefined ||
    progress.isGraduationSession === true ||
    progress.letterSoundsVowelStates !== undefined
  )
}

async function installSlowPlannerMock(
  page: Page,
): Promise<{ requests: CapturedRequest[] }> {
  const requests: CapturedRequest[] = []
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
    const body = JSON.parse(request.postData() ?? '{}') as {
      payload?: { track?: string; progress?: Record<string, unknown> }
    }
    const track = body.payload?.track ?? ''
    const progress = body.payload?.progress ?? {}
    requests.push({ track, progress })

    if (isHinted(progress)) {
      // The live planner: hang. The app aborts this request after the
      // visible-wait timeout; fulfilling an aborted route throws, which
      // is expected and swallowed.
      await new Promise((r) => setTimeout(r, SLOW_PLANNER_MS))
    }
    const response =
      track === 'word-song'
        ? canonicalWordSongSessionResponse()
        : canonicalMathSessionResponse()
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      })
    } catch {
      // Request was aborted by the app (timeout fallback) — expected.
    }
  })
  return { requests }
}

test.describe('Session-start timeout falls back to the canon session (123jpnbc3dh)', () => {
  test('Math: slow Leitner-hinted planner → getting-ready beat, then canon session starts', async ({
    page,
  }) => {
    const { requests } = await installSlowPlannerMock(page)
    await seedLocalStorage(page, {
      progress: {
        ...(buildSeedProgress() as Record<string, unknown>),
        mathFactsLeitner: buildMathFactsLeitner(MIXED_BOX_FIXTURE),
      },
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()

    await expect(page.getByTestId('math')).toBeVisible({ timeout: 10_000 })
    // Waiting state: Emma + the getting-ready beat, no problem area.
    await expect(page.getByTestId('math-getting-ready')).toBeVisible()
    await expect(page.getByTestId('math-emma')).toBeVisible()
    await expect(page.getByTestId('math-symbolic')).toHaveCount(0)

    // The session starts from the hint-free fallback request.
    await expect(page.getByTestId('math-symbolic')).toBeVisible({
      timeout: FALLBACK_VISIBLE_WITHIN_MS,
    })
    await expect(page.getByTestId('math-chips')).toBeVisible()
    await expect(page.getByTestId('math-getting-ready')).toHaveCount(0)

    const math = requests.filter((r) => r.track === 'math')
    expect(math).toHaveLength(2)
    expect(math[0]!.progress.leitner).toEqual(expect.any(Array))
    expect(math[1]!.progress.leitner).toBeUndefined()
    expect(math[1]!.progress.slowFacts).toBeUndefined()
    // The non-bypassing hints still ship on the fallback request.
    expect(math[1]!.progress.focusNode).toBe(math[0]!.progress.focusNode)
  })

  test('Word Song: slow vowel-map-hinted planner → getting-ready beat, then canon session starts', async ({
    page,
  }) => {
    const { requests } = await installSlowPlannerMock(page)
    await seedLocalStorage(page, {
      progress: buildSeedProgress({
        skillLevelOverrides: {
          'letter-names': 'mastered',
          'letter-sounds': 'practicing',
        },
        letterSoundsVowelStates: { '/o/': 'mastered' },
      }),
      sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
    })

    await page.goto('/')
    await forceHowlerUnlock(page)
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await page
      .locator('[data-testid="hub-tree-node"][data-tree="word-song"]')
      .click()

    await expect(page.getByTestId('word-song')).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByTestId('word-song-getting-ready')).toBeVisible()
    await expect(page.getByTestId('word-song-emma')).toBeVisible()
    await expect(page.getByTestId('word-song-word-card')).toHaveCount(0)

    await expect(page.getByTestId('word-song-word-card')).toBeVisible({
      timeout: FALLBACK_VISIBLE_WITHIN_MS,
    })
    await expect(page.getByTestId('word-song-getting-ready')).toHaveCount(0)

    const wordSong = requests.filter((r) => r.track === 'word-song')
    expect(wordSong).toHaveLength(2)
    expect(wordSong[0]!.progress.letterSoundsVowelStates).toEqual(
      expect.any(Object),
    )
    expect(wordSong[1]!.progress.letterSoundsVowelStates).toBeUndefined()
    expect(wordSong[1]!.progress.isGraduationSession).toBeUndefined()
    expect(wordSong[1]!.progress.focusNode).toBe(
      wordSong[0]!.progress.focusNode,
    )
  })
})
