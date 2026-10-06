/**
 * Hold the Hub's suggested card still in e2e (Guidance G1).
 *
 * The suggested card bobs twice as the Hub opens (`hub-suggest-bob`,
 * 2 × 2.2 s in `src/screens/Hub/hubClay.css`). The bob moves the card's
 * bounding box, and Playwright's `click()` waits for a target to be
 * stable, so every tap on the suggested card waited ~4 s for the bob to
 * end. A child taps a moving card fine; the harness does not.
 *
 * That wait broke the delayed-fetch specs: the Hub prefetches the world
 * it suggests (Emma's Path 2/10), so a `delayMs` mock fetch settled
 * during the wait and the session mounted with audio already ready
 * (digraphs-th intro panel never shown, cold-mount problem area already
 * up). It also added ~4 s to every suggested-card tap across the suite.
 *
 * Stilling the bob puts the card at its resting position, the same
 * position the bob ends at, so a tap lands at once as it did before G1.
 * Only the bob is stilled: the breathing ring (`::after`, opacity only)
 * keeps running, and no spec asserts the bob.
 *
 * Called from `installClaudeMock` and `seedLocalStorage`, so every spec
 * that opens the Hub gets it; the style element is id-guarded, so
 * calling it more than once is harmless.
 */

import type { Page } from '@playwright/test'

const STYLE_ID = 'e2e-hub-suggestion-still'

export async function holdHubSuggestionStill(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    const add = () => {
      if (document.getElementById(id) !== null) return
      const style = document.createElement('style')
      style.id = id
      style.textContent =
        ".hub-card[data-suggested='true'] { animation: none !important; }"
      ;(document.head ?? document.documentElement).appendChild(style)
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', add)
    } else {
      add()
    }
  }, STYLE_ID)
}
