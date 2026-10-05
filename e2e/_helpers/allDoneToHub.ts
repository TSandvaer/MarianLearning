/**
 * "All done!" → back to the Hub, following Emma's Path 9/10 (123jpnbc3dt).
 *
 * Since 9/10, a session that unlocks a stop (or opens a land gate) sends
 * "All done" to the MAP, which plays the unlock beat and saves the
 * seen-marker before anything else. Every other session still lands on
 * the Hub. Multi-session progression specs don't know (and shouldn't
 * hard-code) which session tips the unlock, so this helper accepts
 * either landing:
 *
 *   - Hub  → done.
 *   - Map  → it must be playing a beat (never a plain map), then Home
 *            (`map-back`) returns to the Hub — the child's own path.
 *
 * The caller has already tapped the CTA. Mastery / unlock state is
 * asserted by the caller from persisted Progress, unchanged.
 */

import { expect, type Page } from '@playwright/test'

export async function returnToHubAfterAllDone(page: Page): Promise<void> {
  const hub = page.getByTestId('hub')
  const map = page.getByTestId('map')
  await expect(hub.or(map)).toBeVisible({ timeout: 10_000 })
  if (await map.isVisible()) {
    // An "All done" that lands on the map is always an unlock/land beat.
    await expect(map).not.toHaveAttribute('data-beat', 'none')
    await page.getByTestId('map-back').click()
  }
  await expect(hub).toBeVisible({ timeout: 10_000 })
}
