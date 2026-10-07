/**
 * Guard: local e2e runs are silent (e2e/_helpers/silentAudio.ts).
 *
 * After Emma's first Hub line has played (her caption fully walked), the
 * page's audio output path must be zeroed: every WebAudio connection to the
 * destination goes through a gain-0 node, and every media element that was
 * played is muted. Fails if the context hook stops installing (e.g. a
 * Playwright upgrade drops the instrumentation seam). Proves silence by
 * inspection, never by listening.
 */
import { test, expect } from '@playwright/test'
import { E2E_AUDIBLE } from './_helpers/silentAudio'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedProgress,
  buildSeedSessionHistory,
  seedLocalStorage,
} from './_helpers/seedStorage'

test.skip(E2E_AUDIBLE, 'E2E_AUDIBLE=1 turns the silencing off on purpose')

test('a Hub line plays with its output path at gain 0 / muted', async ({
  page,
}) => {
  await installClaudeMock(page, { failNetwork: true })
  await seedLocalStorage(page, {
    progress: buildSeedProgress(),
    sessionHistory: buildSeedSessionHistory({ sessionCount: 5 }),
  })
  await page.goto('/')
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })
  // Emma waits for the first tap (audio unlock); tap the empty sky.
  await page.getByTestId('hub-stage').click({ position: { x: 24, y: 24 } })

  const words = page.locator(
    '[data-testid="hub-caption"] [data-testid="hub-caption-word"]',
  )
  await expect(words.first()).toBeAttached({ timeout: 10_000 })
  await expect(words.and(page.locator('[data-revealed="false"]'))).toHaveCount(
    0,
    { timeout: 10_000 },
  )

  const state = await page.evaluate(() => {
    const w = window as unknown as {
      __e2eSilentAudio?: {
        gains: GainNode[]
        routed: number
        media: HTMLMediaElement[]
      }
      Howler?: { usingWebAudio?: boolean; _howls?: unknown[] }
    }
    const p = w.__e2eSilentAudio
    return {
      installed: !!p,
      usingWebAudio: !!w.Howler?.usingWebAudio,
      howls: w.Howler?._howls?.length ?? 0,
      routed: p?.routed ?? 0,
      gains: p?.gains.map((g) => g.gain.value) ?? [],
      mediaMuted: p?.media.map((m) => m.muted) ?? [],
    }
  })

  expect(state.installed).toBe(true)
  expect(state.howls).toBeGreaterThan(0)
  if (state.usingWebAudio) {
    expect(state.routed).toBeGreaterThan(0)
    expect(state.gains.length).toBeGreaterThan(0)
  } else {
    expect(state.mediaMuted.length).toBeGreaterThan(0)
  }
  expect(state.gains.every((g) => g === 0)).toBe(true)
  expect(state.mediaMuted.every((m) => m)).toBe(true)
})
