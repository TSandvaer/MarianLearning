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
 * Wiring sanity note (Devon PR #182 P3 follow-up)
 * -----------------------------------------------
 * The browser reads `import.meta.env.VITE_PROGRESS_API_SECRET` at call
 * time; the value is baked into the bundle at build time. If
 * `.env.local` doesn't carry the secret, every cloud-sync helper
 * short-circuits to `'skipped'` / `'auth-not-configured'` and never
 * fires a network request.
 *
 * Earlier revisions of this module exported an `assertCloudSyncWiredOrSkip`
 * helper that pretended to detect this, but it always returned `true`
 * because the baked value cannot be read from a running bundle without
 * a production-side test seam (e.g. `window.__viteEnv`). That helper
 * was misleading shape and is removed.
 *
 * Misconfiguration signal: the strict count-based assertions in the
 * conflict spec (`expect(mock.gets).toHaveLength(1)` etc.) FAIL on a
 * bundle without the secret because the App never makes the request.
 * Failure surfaces as `expected length 1, got 0` — clear enough that
 * a future investigator finds the auth wiring in two minutes.
 *
 * Future work (out of scope here): a vite plugin that exposes
 * `import.meta.env.VITE_PROGRESS_API_SECRET` via a window hook in
 * dev/test only would let a sibling helper here probe + skip-with-
 * reason. Production code stays unchanged today.
 */

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
    // Wave 5 (ticket 86c9y0bvc) sibling-tier split — both tiers
    // default to 'locked' mirroring the production schema floor.
    'two-digit-addsub-no-regroup': 'locked',
    'two-digit-addsub-with-regroup': 'locked',
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
    'cvc-words-short-i': 'locked',
    'cvc-words-short-e': 'locked',
    // Digraphs split into 3 sequential sibling nodes per PR #211.
    'digraphs-sh': 'locked',
    'digraphs-ch': 'locked',
    'digraphs-th-voiceless': 'locked',
    'sight-words': 'intro',
    'simple-sentences': 'locked',
  }
  return {
    schemaVersion: 1,
    profile: {
      childName: 'Marian',
      // Schema literal stays 'melody' verbatim — see types.ts:177
      // (`export type Character = 'melody'`). Phase-3b character pivot
      // (2026-04-29) intentionally did NOT rename this literal because
      // doing so would require a v1 → v2 schema migration; the field
      // is invisible to Marian (no UI reads it). Devon's PR #182 P3
      // nit was a doc misread — changing this to 'emma' would FAIL
      // `isProgressV1` on the cloud-installed blob and break the
      // conflict tests below.
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
