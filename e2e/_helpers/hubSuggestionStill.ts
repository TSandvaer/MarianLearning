/**
 * Hold the Hub's suggested card face still in e2e (Guidance G1).
 *
 * The suggested card's face bobs twice as the Hub opens
 * (`hub-suggest-bob`, 2 × 2.2 s on `.hub-card-face` in
 * `src/screens/Hub/hubClay.css`). The card itself (the tap target) never
 * moves, so taps on the card land at once without this helper.
 *
 * The map button sits on the face, though, so it bobs with it, and
 * Playwright's `click()` waits for a target to be stable: a map-button
 * tap on the suggested card would wait ~4 s for the bob to end. Stilling
 * the face puts it at its resting position, the same position the bob
 * ends at. Only the bob is stilled: the breathing ring (`::after`,
 * opacity only) keeps running, and no spec asserts the bob.
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
        ".hub-card[data-suggested='true'] > .hub-card-face { animation: none !important; }"
      ;(document.head ?? document.documentElement).appendChild(style)
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', add)
    } else {
      add()
    }
  }, STYLE_ID)
}
