/**
 * Emma's Path 2/10 (123jpnbc3dj) — the Hub prefetches the suggested
 * world's session, and the tap reuses it.
 *
 * Seed: returning user whose last Hub suggestion was Word Song, nothing
 * touched today → the Hub suggests Number Garden (computeSuggestion
 * rule 4), so the MATH session-start must POST while the child is still
 * on the Hub. The mock holds each response 2 s; after a 3 s Hub dwell the
 * tap must find the session ready (problem area shown inside the 2 s the
 * fetch would otherwise take) with exactly ONE math request, no Word Song
 * request, and a timing record whose origin is `hub`.
 */
import { test, expect } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  forceHowlerUnlock,
  seedLocalStorage,
} from './_helpers/seedStorage'

test.describe("Hub session prefetch (Emma's Path 2/10)", () => {
  test('Hub suggests Number Garden → math session prefetched on the Hub and reused on tap', async ({
    page,
  }) => {
    const tracks: string[] = []
    page.on('request', (req) => {
      if (!req.url().includes('/api/claude') || req.method() !== 'POST') return
      try {
        const body = JSON.parse(req.postData() ?? '{}') as {
          payload?: { track?: string }
        }
        tracks.push(body.payload?.track ?? '?')
      } catch {
        tracks.push('?')
      }
    })

    // failNetwork + delay: the canonical-resolve path's inline base64 audio
    // does not decode reliably headless (see hub-to-math.spec.ts); the
    // reject path flips Math's audio-ready gate the same way.
    await installClaudeMock(page, { failNetwork: true, delayMs: 2000 })
    await seedLocalStorage(page, {
      sessionHistory: {
        ...(buildSeedSessionHistory({ sessionCount: 5 }) as Record<
          string,
          unknown
        >),
        lastSuggestion: 'word-song',
      },
    })

    await page.goto('/')
    await forceHowlerUnlock(page)
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('hub')).toHaveAttribute(
      'data-suggestion',
      'number-garden',
    )

    // The math request starts while the child is still on the Hub.
    await expect.poll(() => tracks.filter((t) => t === 'math').length).toBe(1)
    expect(tracks.filter((t) => t === 'word-song')).toHaveLength(0)

    // Hub dwell longer than the mocked fetch.
    await page.waitForTimeout(3000)

    await page
      .locator('[data-testid="hub-tree-node"][data-tree="number-garden"]')
      .click()
    await expect(page.getByTestId('math')).toBeVisible({ timeout: 5_000 })
    // Already settled on the Hub → the problem area (gated on Math's
    // audio-ready prop) shows without the 2 s fetch wait.
    await expect(page.getByTestId('math-addend-a')).toBeVisible({
      timeout: 1_000,
    })

    expect(tracks.filter((t) => t === 'math')).toHaveLength(1)
    expect(tracks.filter((t) => t === 'word-song')).toHaveLength(0)

    const timing = await page.evaluate(() => {
      const list = (
        window as unknown as {
          __sessionStartTimings?: Array<{
            track: string
            origin: string
            startedAt: number
            settledAt?: number
            shownAt?: number
          }>
        }
      ).__sessionStartTimings
      return list?.filter((t) => t.track === 'math').at(-1)
    })
    expect(timing?.origin).toBe('hub')
    expect(timing?.settledAt).toBeDefined()
    expect(timing?.shownAt).toBeDefined()
    expect(timing!.settledAt!).toBeLessThan(timing!.shownAt!)
  })
})
