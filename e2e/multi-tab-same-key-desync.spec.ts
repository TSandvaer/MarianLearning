/**
 * E2E spec — multi-tab same-key desync (audit P1.2).
 *
 * Ticket 86c9kxp3j (top-4 race-bug e2e specs from the polish-audit
 * roadmap). Documents what SHOULD happen when Marian (or her sibling)
 * has the PWA open in two tabs / two windows: one tab writes to
 * `marian-tutor:progress:v1` or `marian-tutor.session-history.v1`,
 * the other tab keeps a stale in-memory copy.
 *
 * Why this matters
 * ----------------
 * Realistic scenarios on iPad PWA usage:
 *  - Marian opens the home-screen icon (window A), gets distracted,
 *    re-opens the icon (window B). Two tabs, both with stale data.
 *  - Sibling on the same Apple ID syncs an iCloud Tabs entry; PWA
 *    boots in a second context.
 *  - QA / parent debugging: one tab is the live session, another is
 *    `?debug=1` on the same origin.
 *
 * In all of these, mastery promotion / session-count writes from
 * tab A should be VISIBLE to tab B without a hard reload — otherwise
 * Marian sees stale stardust totals, missed promotions, or (worst)
 * a session-count mismatch that confuses the Splash → Hub branching.
 *
 * Current product state (2026-05-01)
 * ----------------------------------
 * **No `addEventListener('storage', ...)` handlers exist anywhere in
 * `src/`** (verified via grep at spec-authoring time). When tab A
 * writes a localStorage key, tab B's React state does not refresh.
 * The browser still fires the `storage` event in tab B (it is a
 * standard DOM event tied to localStorage writes from another
 * same-origin context); we just don't subscribe.
 *
 * Why the spec exists at .fixme today
 * -----------------------------------
 * Per the brief — same shape as the backgrounding spec. We document
 * intent here so when the product fix (a top-level `useStorageSync`
 * hook or similar) lands, this spec flips live. .fixme on the target-
 * behaviour assertion; live canary on the harness-side primitive.
 *
 * Follow-up product ticket to file
 * --------------------------------
 *  - Title: "Multi-tab storage event sync — Hub stats + Progress"
 *  - Body: link this spec; acceptance criteria match the .fixme
 *    cases below; cite audit P1.2.
 *
 * Browser-engine support
 * ----------------------
 * Both Chromium and WebKit fire the standard `storage` event across
 * same-origin pages within a browser context. We share a single
 * `BrowserContext` between the two pages so they share the same
 * storage origin (a cross-context test would be a different scenario
 * — separate storage partitions never see each other's writes — and
 * is out of scope here).
 */

import { test, expect } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { installClaudeMock } from './_helpers/mockClaude'
import {
  buildSeedSessionHistory,
  PROGRESS_STORAGE_KEY,
  SESSION_HISTORY_STORAGE_KEY,
  seedLocalStorage,
} from './_helpers/seedStorage'

/**
 * Open a second page inside the same `BrowserContext` so localStorage
 * is shared between the two pages. `BrowserContext.newPage()` returns
 * a page that shares storage; `browser.newContext()` would NOT.
 */
async function openSecondTab(
  context: BrowserContext,
  url: string,
): Promise<Page> {
  const page = await context.newPage()
  await page.goto(url)
  return page
}

test.describe('Multi-tab same-key desync (audit P1.2)', () => {
  // We override the default per-test fixtures here because we need to
  // install the /api/claude mock and the localStorage seed on BOTH
  // pages. The shared `BrowserContext` from `page.context()` is the
  // hook we use for the second tab.

  test.beforeEach(async ({ page, context }) => {
    // Install the mock at the context level so both pages get the
    // routing. (Page-level routes only apply to the page they were
    // installed on.)
    await context.route('**/api/claude', async (route) => {
      await route.abort('failed')
    })
    await installClaudeMock(page, { failNetwork: true })
    await seedLocalStorage(page, {
      sessionHistory: buildSeedSessionHistory({
        sessionCount: 5,
        cumulativeStardust: 12,
      }),
    })
  })

  /**
   * Canary: storage events round-trip across two same-context tabs.
   * Always live. Validates the harness primitive before we layer
   * .fixme cases on top.
   */
  test('lifecycle event harness — storage event fires across tabs in the same context', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    // Open second tab on the same origin so it sees the same storage.
    // We use `about:blank` first so we can wire the listener BEFORE
    // any localStorage writes happen during the app boot.
    const tabB = await context.newPage()
    await tabB.goto('http://127.0.0.1:4173/')
    await expect(tabB.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    // Wire a counting listener on tab B.
    await tabB.evaluate(() => {
      ;(
        window as unknown as {
          __qaStorageEvents: Array<{ key: string | null }>
        }
      ).__qaStorageEvents = []
      window.addEventListener('storage', (e: StorageEvent) => {
        ;(
          window as unknown as {
            __qaStorageEvents: Array<{ key: string | null }>
          }
        ).__qaStorageEvents.push({ key: e.key })
      })
    })

    // Tab A writes a key. The standard `storage` event fires on the
    // OTHER same-origin tabs (NOT in the writing tab itself).
    await page.evaluate(() => {
      window.localStorage.setItem('marian-tutor.qa.canary', String(Date.now()))
    })

    // Allow the event to propagate. 500ms is generous; both engines
    // dispatch synchronously from the OS-level write completion.
    await page.waitForTimeout(500)

    const events = await tabB.evaluate(
      () =>
        (
          window as unknown as {
            __qaStorageEvents: Array<{ key: string | null }>
          }
        ).__qaStorageEvents,
    )
    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events[0]!.key).toBe('marian-tutor.qa.canary')
  })

  /**
   * Target behaviour: tab A writes session-history (sessionCount,
   * cumulativeStardust); tab B's Hub HUD updates without a reload.
   *
   * Today: tab B reads localStorage on mount and never re-reads —
   * the HUD stays stale. .fixme until the product adds a `storage`
   * subscription.
   */
  test.fixme('session-history write in tab A reflects in tab B Hub HUD', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    const tabB = await openSecondTab(context, 'http://127.0.0.1:4173/')
    await expect(tabB.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    // Capture tab B's initial cumulative stardust.
    const initialBadge = tabB.getByTestId('hub-cumulative-stardust')
    const initialTotal = Number(await initialBadge.getAttribute('data-total'))
    expect(Number.isFinite(initialTotal)).toBe(true)

    // Tab A writes a NEW session-history blob with a higher total.
    await page.evaluate(
      ({ key, blob }) => {
        window.localStorage.setItem(key, JSON.stringify(blob))
      },
      {
        key: SESSION_HISTORY_STORAGE_KEY,
        blob: {
          schemaVersion: 2,
          sessionCount: 6,
          lastSessionCompletedAt: new Date().toISOString(),
          longestStreakEver: 4,
          cumulativeStardust: initialTotal + 7,
          lastSessionStardust: 7,
          dayStreak: 1,
          todayTreesTouched: { date: '', trees: [] },
          lastSuggestion: null,
          consecutiveOverrides: 0,
          suggestionCooldownUntil: null,
        },
      },
    )

    // ── ASSERT (target product behaviour) ──
    // Tab B's HUD should pick up the new total without a reload.
    // The product fix subscribes to the `storage` event and
    // re-projects the HUD; this assertion will flip green when
    // that lands.
    await expect(initialBadge).toHaveAttribute(
      'data-total',
      String(initialTotal + 7),
      { timeout: 5_000 },
    )
  })

  /**
   * Target behaviour: tab A writes Progress (e.g. mastery promotion);
   * tab B's downstream state respects the new skillLevels without a
   * reload. The most-direct visible signal in v1 is none — Hub
   * doesn't render skillLevels per se — but the contract is that an
   * in-tab read of localStorage reflects the latest write, AND the
   * product subscribes to changes (so a re-entry into Math from tab
   * B picks up the new focus-node hint).
   *
   * .fixme today; flips live with the same product fix.
   */
  test.fixme('progress write in tab A reflects in tab B in-app state', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    const tabB = await openSecondTab(context, 'http://127.0.0.1:4173/')
    await expect(tabB.getByTestId('hub')).toBeVisible({ timeout: 10_000 })

    // Tab A writes a Progress blob with `add-to-10` flipped to
    // `mastered`.
    await page.evaluate(
      ({ key }) => {
        const raw = window.localStorage.getItem(key)
        const cur =
          raw === null
            ? null
            : (JSON.parse(raw) as {
                skillLevels?: Record<string, string>
              })
        const next = cur ?? {
          schemaVersion: 1,
          profile: {
            childName: 'Marian',
            character: 'melody',
            lastPlayedISO: null,
          },
          skillLevels: {},
          mathFactsLeitner: { items: [] },
          history: [],
          parentSettings: {
            autoPromote: true,
            sessionModePicker: 'off',
            masteryThreshold: { percent: 0.95, sessions: 3 },
            crossDayEnforcement: true,
            showLevelToMarian: false,
          },
        }
        next.skillLevels = {
          ...(next.skillLevels ?? {}),
          'add-to-10': 'mastered',
        }
        window.localStorage.setItem(key, JSON.stringify(next))
      },
      { key: PROGRESS_STORAGE_KEY },
    )

    // ── ASSERT (target product behaviour) ──
    // The product fix should expose a per-tab debug attribute (or a
    // user-visible signal) when the in-memory Progress mirrors the
    // latest write. Concrete signal pinned alongside the fix; until
    // then this placeholder reads the persisted blob to prove the
    // write reached storage and that the harness primitives work.
    const persisted = await tabB.evaluate(
      ({ key }) => {
        const raw = window.localStorage.getItem(key)
        return raw === null
          ? null
          : (JSON.parse(raw) as { skillLevels?: Record<string, string> })
      },
      { key: PROGRESS_STORAGE_KEY },
    )
    expect(persisted?.skillLevels?.['add-to-10']).toBe('mastered')
    // Once the product fix lands, replace this with the in-app
    // signal — e.g. `expect(tabB.getByTestId('hub')).toHaveAttribute(
    // 'data-progress-version', '<latest>')`.
  })
})
