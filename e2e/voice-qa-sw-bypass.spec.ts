/**
 * E2E spec — Voice-QA page service-worker bypass (ticket 86ca7y0gw / VQA-FIX.2).
 *
 * WHY THIS EXISTS
 * The QA page must ear-test NETWORK-FRESH audio bytes. The app's Workbox SW
 * (src/pwa/sw.ts) does `precacheAndRoute(self.__WB_MANIFEST)`, and Workbox
 * precache matching STRIPS the query string — so the greet/hub
 * `?v=<Date.now()>` + cache:no-store cache-bust defeats the HTTP cache but NOT
 * the SW precache. On an installed iPad standalone PWA whose SW predates an
 * audio re-render (e.g. PR #356's British-voice swap), every precached `*.mp3`
 * is served from the stale precache and the ear-test plays the wrong voice.
 * (Canon `.json` is exempt — not in vite.config.ts globPatterns — which is why
 * canon items show CURRENT hashes while greet/hub show STALE in the same
 * report. Full investigation: ticket 86ca7y0hj.)
 *
 * THE FIX UNDER TEST (public/voice-qa.html `bypassServiceWorker()`)
 * On first load the page unregisters every SW registration, deletes every Cache
 * Storage bucket (the precache lives there), then reloads ONCE so the reloaded
 * document is no longer SW-controlled and fetches hit the network. A
 * sessionStorage one-shot flag (`vqa-sw-bypassed`) guards against a reload loop:
 * it is set BEFORE the reload, so the reloaded page sees it and boots `main()`.
 *
 * WHAT THIS SPEC PROVES (under a seeded SW registration + a seeded stale cache)
 *   1. The bypass deletes the seeded Cache Storage bucket (caches.keys() empty).
 *   2. The bypass unregisters the seeded SW (getRegistrations() -> empty).
 *   3. The bypass reloads exactly once — the one-shot flag prevents a reload
 *      loop (nav counter == 2 = pre-trigger load + one bypass reload; a loop
 *      would also blow the test timeout).
 *   4. The page still renders its rows + footer after the bypass reload.
 *   5. A CLEAN load (no SW, no caches) does NOT reload — the page boots directly
 *      (nav counter == 1), so non-PWA / fresh-browser QA isn't penalised.
 *
 * DETERMINISM NOTE
 * The seeding is done with an AWAITED `page.evaluate` (not a fire-and-forget
 * addInitScript) so the stale cache bucket + SW registration are guaranteed
 * present BEFORE the bypass-triggering reload — no open()/register() race. The
 * FIRST navigation lands a clean context (nothing to clear -> the bypass does
 * NOT reload), so the seed cannot be eaten on first paint. The test then seeds,
 * resets the nav tally, and reloads to exercise the real bypass on a now-dirty
 * context.
 *
 * SCOPE: the QA page only. The app's SW config is untouched.
 * Per playwright.config.ts the page hashes 632 canon items on every (re)load,
 * so readiness uses the WebKit-sized budget below.
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const PAGE_URL = '/voice-qa.html'
const NAV_COUNT_KEY = 'vqa-test-nav-count'
const STALE_CACHE = 'vqa-stale-precache'

/** Mirrors voice-qa-page.spec.ts — the canon-hash pass is slow on WebKit. */
const PAGE_READY_TIMEOUT_MS = 45_000

/**
 * Block until the page finished its async canon-hash pass and rendered the row
 * set. The footer (`vqa-render-count`) is written LAST, so its visibility is the
 * canonical "page is ready" signal.
 */
async function waitForPageReady(page: Page): Promise<void> {
  await expect(page.getByTestId('vqa-render-count')).toBeVisible({
    timeout: PAGE_READY_TIMEOUT_MS,
  })
}

/**
 * Tally document loads in sessionStorage. Installed via addInitScript so it runs
 * at the start of EVERY document load (initial + every reload), BEFORE the
 * page's own script. After settle:
 *   1 -> no bypass reload (clean-load path)
 *   2 -> exactly one bypass reload (stale-SW path)
 *   3+ -> a reload LOOP (bug) — the one-shot flag failed to guard.
 */
async function installNavCounter(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key }) => {
      try {
        const n = Number(sessionStorage.getItem(key) || '0') + 1
        sessionStorage.setItem(key, String(n))
      } catch {
        /* private mode — ignore */
      }
    },
    { key: NAV_COUNT_KEY },
  )
}

async function readNavCount(page: Page): Promise<number> {
  return page.evaluate(
    (key) => Number(sessionStorage.getItem(key) || '0'),
    NAV_COUNT_KEY,
  )
}

async function cacheKeys(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    if (!('caches' in self)) return []
    return caches.keys()
  })
}

async function swRegistrationCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 0
    const regs = await navigator.serviceWorker.getRegistrations()
    return regs.length
  })
}

test.describe('Voice-QA page — service-worker bypass (VQA-FIX.2 / 86ca7y0gw)', () => {
  test('stale SW + cache: bypass clears caches + unregisters SW, reloads once, page still renders', async ({
    page,
  }) => {
    // ── Assertion classification ──────────────────────────────────────────
    // RED-on-base lever: WITHOUT the bypass, the seeded `vqa-stale-precache`
    // bucket + the seeded SW registration survive the trigger reload (the page
    // does no SW work) and the nav counter stays at 1 (no extra reload). WITH
    // the bypass, both are cleared and the nav counter reaches exactly 2. The
    // cache-empty + reg-count==0 + nav==2 triple is the load-bearing lever.
    await installNavCounter(page)

    // ── Phase 1: clean first load (nothing to clear -> the bypass does NOT ────
    // reload), so the seed we add next cannot be eaten on first paint.
    await page.goto(PAGE_URL)
    await waitForPageReady(page)

    // Seed the stale Cache Storage bucket + a real (no-op) SW registration, both
    // AWAITED so they are durably present before the trigger reload. The SW
    // source is a tiny no-fetch-handler worker — only its REGISTRATION matters.
    await page.evaluate(async (cacheName) => {
      if ('caches' in self) {
        const c = await caches.open(cacheName)
        await c.put(
          '/assets/audio/greet/greet-01-hi.mp3',
          new Response('stale-bytes', {
            headers: { 'Content-Type': 'audio/mpeg' },
          }),
        )
      }
      if ('serviceWorker' in navigator) {
        const swSource =
          `self.addEventListener('install',()=>self.skipWaiting());` +
          `self.addEventListener('activate',(e)=>e.waitUntil(self.clients.claim()));`
        const swUrl = URL.createObjectURL(
          new Blob([swSource], { type: 'text/javascript' }),
        )
        try {
          await navigator.serviceWorker.register(swUrl)
        } catch {
          /* blob-URL SWs are not allowed in all engines — the cache seed alone
             still triggers the bypass, so this is a best-effort add. */
        }
      }
    }, STALE_CACHE)

    // Confirm the seed actually landed (precondition — guards a false GREEN if a
    // future engine refuses the Cache API: then this test would be vacuous).
    expect(await cacheKeys(page)).toContain(STALE_CACHE)

    // ── Phase 2: reset the nav tally, reload -> the REAL bypass fires. ────────
    // The first load left the one-shot flag UNSET (it only sets on the load that
    // actually reloads), so this reload's bypass sees the seeded cache (+ SW),
    // clears them, sets the flag, and reloads once. The post-reload document
    // sees the flag and boots main() to the footer.
    await page.evaluate((key) => {
      try {
        sessionStorage.setItem(key, '0')
      } catch {
        /* ignore */
      }
    }, NAV_COUNT_KEY)

    await page.reload()
    // waitForPageReady tolerates the intermediate bypass reload (web-first
    // auto-retrying assertion on the FINAL footer).
    await waitForPageReady(page)

    // Exactly one bypass reload occurred: trigger reload (1) + bypass reload (2).
    expect(await readNavCount(page)).toBe(2)

    // The seeded stale Cache Storage bucket is gone (exact emptiness).
    expect(await cacheKeys(page)).toEqual([])

    // The seeded SW registration is gone.
    expect(await swRegistrationCount(page)).toBe(0)

    // The page is fully functional after the bypass reload — rows rendered.
    const rowCount = await page.locator('[data-testid^="vqa-item-"]').count()
    expect(rowCount).toBeGreaterThan(0)
  })

  test('clean load (no SW, no cache): page boots directly without a bypass reload', async ({
    page,
  }) => {
    // ── Assertion classification ──────────────────────────────────────────
    // Counter-test / regression-lock: proves the bypass does NOT punish a clean
    // (non-PWA / fresh-browser) load with a wasted reload round-trip. With
    // nothing to clear, `bypassServiceWorker()` returns false and main() boots
    // on the FIRST document — nav counter stays at exactly 1. This is the
    // "hadSomethingToClear" early-out lever; if it regressed to always-reload,
    // this nav==1 assertion flips to 2 and fails.
    await installNavCounter(page)

    await page.goto(PAGE_URL)
    await waitForPageReady(page)

    // No reload — the page booted directly on the first document load.
    expect(await readNavCount(page)).toBe(1)

    // Page rendered normally.
    const rowCount = await page.locator('[data-testid^="vqa-item-"]').count()
    expect(rowCount).toBeGreaterThan(0)
  })
})
