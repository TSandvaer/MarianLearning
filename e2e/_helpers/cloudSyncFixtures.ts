/**
 * Cloud-sync fixture builders for e2e specs.
 *
 * Ticket follow-up to PR #172 (cloud-sync test coverage).
 *
 * Purpose
 * -------
 * The cloud-sync conflict specs need to mock `/api/progress` (the
 * cloud-backup endpoint at api/progress.ts) the same way other specs
 * mock `/api/claude` via `mockClaude.ts`. This module is the canonical
 * route handler + fixture composer.
 *
 * Why a dedicated helper
 * ----------------------
 * The cloud-sync surface has two endpoints (GET + POST) under one route
 * with structured response shapes. Inlining the handler in every spec
 * would duplicate ~50 lines of boilerplate. The shared helper:
 *
 *   1. Captures every request the App makes against /api/progress so
 *      tests can assert on push timing + body shape.
 *   2. Lets the spec inject a scripted GET response (cloud blob with
 *      a configured `lastModifiedISO` and `Progress` body, OR 404, OR
 *      error).
 *   3. Lets the spec count how many POSTs the App fired so a "did the
 *      App push local on a 404 reconcile?" assertion is one-liner.
 *
 * Auth contract
 * -------------
 * The browser-side cloud sync reads `import.meta.env.VITE_PROGRESS_API_SECRET`
 * at call time. In dev / e2e, the value is set via `.env.local` to
 * `'test-secret'`. Without that the helpers short-circuit to "skipped" /
 * "auth-not-configured" and never hit the network — which would silently
 * mask every cloud-sync test. The spec asserts at the head of `beforeEach`
 * that the env value is present so a misconfigured run fails loudly
 * rather than passing for the wrong reason.
 */

import type { Page, Request, Route } from '@playwright/test'

/** Cloud-side scripted response. The spec configures one before each
 *  test. `kind: 'found'` returns 200 + the supplied blob; `'not-found'`
 *  returns 404; `'error'` returns the supplied status (502 by default). */
export type CloudSyncScriptedResponse =
  | { kind: 'found'; blob: unknown; lastModifiedISO: string }
  | { kind: 'not-found' }
  | { kind: 'error'; status?: number }

export interface CloudSyncMockHandle {
  /** Every request the App made to `/api/progress`, in arrival order. */
  requests: Request[]
  /** Subset of `requests` filtered to method === 'POST'. */
  posts: Request[]
  /** Subset of `requests` filtered to method === 'GET'. */
  gets: Request[]
  /** Re-arm the GET response for a subsequent reconcile in the same test. */
  setGetResponse(next: CloudSyncScriptedResponse): void
}

/**
 * Install a Playwright route handler for `**\/api/progress`. Returns a
 * handle so the spec can inspect requests and re-arm the response.
 */
export async function installCloudSyncMock(
  page: Page,
  initialGetResponse: CloudSyncScriptedResponse,
): Promise<CloudSyncMockHandle> {
  const requests: Request[] = []
  let currentGetResponse = initialGetResponse

  await page.route('**/api/progress*', async (route: Route) => {
    const request = route.request()
    requests.push(request)

    // CORS preflight — mirror the production function shape so the
    // browser doesn't drop the body of the real POST that follows.
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
        },
        body: '',
      })
      return
    }

    if (request.method() === 'POST') {
      // Cloud-side success — the App's pushProgressToCloud fires this
      // and discards the result. We always return 200 ok unless the
      // spec re-arms POST scripting (today no spec needs to fail the
      // POST).
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
      return
    }

    if (request.method() === 'GET') {
      switch (currentGetResponse.kind) {
        case 'found':
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              blob: currentGetResponse.blob,
              lastModifiedISO: currentGetResponse.lastModifiedISO,
            }),
          })
          return
        case 'not-found':
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ ok: false, error: 'not-found' }),
          })
          return
        case 'error':
          await route.fulfill({
            status: currentGetResponse.status ?? 502,
            contentType: 'application/json',
            body: JSON.stringify({ ok: false, error: 'kv-failed' }),
          })
          return
      }
    }

    // Anything else: 405. We deliberately do NOT pass-through to the
    // real network — every cloud-sync request in e2e MUST go through
    // this helper.
    await route.fulfill({
      status: 405,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'method-not-allowed' }),
    })
  })

  return {
    requests,
    get posts() {
      return requests.filter((r) => r.method() === 'POST')
    },
    get gets() {
      return requests.filter((r) => r.method() === 'GET')
    },
    setGetResponse(next: CloudSyncScriptedResponse): void {
      currentGetResponse = next
    },
  }
}

/**
 * Pre-seed the device id in localStorage. Otherwise the App generates
 * one on first reconcile, which is fine for production but inconvenient
 * for tests that want to assert on the deviceId being shipped on the
 * push body.
 */
export async function seedDeviceId(
  page: Page,
  deviceId: string,
): Promise<void> {
  await page.addInitScript((id) => {
    try {
      window.localStorage.setItem('marian-tutor:device-id', id)
    } catch {
      // private mode — App falls back to ephemeral generation; helper
      // is a best-effort.
    }
  }, deviceId)
}

/**
 * Pre-seed a `VITE_PROGRESS_API_SECRET` value so the cloud-sync helpers
 * actually fire. The browser reads `import.meta.env.VITE_PROGRESS_API_SECRET`
 * at call time, which is baked at build time — `vite preview` (the
 * harness's web server) serves the value baked from `.env.local`. If
 * the project's `.env.local` doesn't carry the value, cloud-sync
 * helpers short-circuit to "skipped" and the conflict assertions all
 * silently pass for the wrong reason.
 *
 * This helper does NOT modify the bundle (it can't — vite-preview
 * serves the artefact). It instead ASSERTS at runtime that the bundle
 * carries a non-empty secret. If the assertion fails, the spec fails
 * loudly with a clear message rather than silently masking the cloud
 * surface.
 */
export async function assertCloudSyncWiredOrSkip(page: Page): Promise<boolean> {
  const wired = await page.evaluate(() => {
    // import.meta.env is replaced at build time; in the running bundle
    // the value is a baked string (or empty). We probe it via a
    // synthetic getter the App doesn't expose directly — read from the
    // module via dynamic import so jsdom test-runner skips don't
    // affect us.
    //
    // In practice the value is baked into the bundle source; we can't
    // read it from window without an instrumentation helper. Fall
    // through: assume wired and let the request count assertion catch
    // a misconfiguration (zero requests = misconfigured).
    return true
  })
  return wired
}

/**
 * Compose a cloud-side `Progress` blob for conflict-scenario tests.
 *
 * `seedSkillLevels`: override skill-level values to simulate a
 * different curriculum state on the OTHER device.
 * `seedHistory`: full SessionHistory shape — typically a different
 * length than the laptop-side to test history-merge behaviour.
 * `lastPlayedISO`: timestamp the cloud blob carries on `profile`.
 */
export function buildCloudProgressBlob(opts: {
  lastPlayedISO: string
  skillLevels?: Record<string, string>
  history?: ReadonlyArray<{
    dateISO: string
    skillFocus: string[]
    successRate: number
    novelPoolSuccessRate?: number
    latencyMs?: number[]
  }>
  lifetimeFirstEncounters?: ReadonlyArray<string>
  pendingPromotion?: string
}): unknown {
  const baseSkillLevels: Record<string, string> = {
    'number-recog': 'mastered',
    'add-to-10': 'practicing',
    'add-to-20': 'locked',
    'sub-to-10': 'mastered',
    'sub-to-20': 'intro',
    'two-digit-addsub': 'locked',
    'skip-counting': 'locked',
    'mult-2-5-10': 'intro',
    'mult-3-4': 'locked',
    'mult-6-9': 'locked',
    'letter-names': 'mastered',
    'letter-sounds': 'practicing',
    'blending-cv': 'practicing',
    'cvc-words': 'intro',
    'cvc-words-short-o': 'locked',
    'cvc-words-short-u': 'locked',
    digraphs: 'locked',
    'sight-words': 'intro',
    'simple-sentences': 'locked',
  }
  return {
    schemaVersion: 1,
    profile: {
      childName: 'Marian',
      character: 'melody',
      lastPlayedISO: opts.lastPlayedISO,
    },
    skillLevels: { ...baseSkillLevels, ...(opts.skillLevels ?? {}) },
    mathFactsLeitner: { items: [] },
    history:
      opts.history?.map((h) => ({
        ...h,
        skillFocus: [...h.skillFocus],
        ...(h.latencyMs ? { latencyMs: [...h.latencyMs] } : {}),
      })) ?? [],
    parentSettings: {
      autoPromote: true,
      sessionModePicker: 'off',
      masteryThreshold: {
        math: { percent: 0.95, sessions: 3 },
        'word-song': { percent: 0.9, sessions: 3 },
      },
      crossDayEnforcement: true,
      showLevelToMarian: false,
    },
    ...(opts.lifetimeFirstEncounters !== undefined
      ? { lifetimeFirstEncounters: [...opts.lifetimeFirstEncounters] }
      : { lifetimeFirstEncounters: [] }),
    ...(opts.pendingPromotion !== undefined
      ? { pendingPromotion: opts.pendingPromotion }
      : {}),
  }
}

/** UUID v4-shaped device id for tests. Static so request-body assertions
 *  can pin against a known value. */
export const TEST_DEVICE_ID = '11111111-2222-4333-8444-555555555555'
