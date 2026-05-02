/**
 * Playwright route handler for /api/claude.
 *
 * Ticket 86c9kwnmx — keeps the e2e suite away from the live Anthropic +
 * Azure pipeline. Every spec calls `installClaudeMock(page)` in
 * `beforeEach`. The handler routes all requests away from the real
 * function; if a request shape isn't recognised, the handler fails
 * loudly so an unintended live hit cannot pass silently.
 */

import type { Page, Route } from '@playwright/test'
import {
  canonicalMathSessionResponse,
  canonicalWordSongSessionResponse,
} from '../fixtures/canonicalSessionResponses'

export interface MockClaudeOptions {
  /**
   * Override the math response. Useful for specs that want a smaller plan
   * or different correct answers.
   */
  mathResponse?: () => unknown
  /** Override the word-song response. */
  wordSongResponse?: () => unknown
  /**
   * Force the planner fetch to fail at the network layer. App.tsx catches
   * the rejection and Math falls through to its silent caption-walk
   * default — which is the same path Marian sees on a real outage. Useful
   * for specs that want to exercise the screen state machine without
   * paying the cost of audio decoding tests.
   */
  failNetwork?: boolean
  /**
   * Delay (in ms) before the route handler fulfils OR aborts. Lets specs
   * exercise the in-flight window — e.g. the no-swap-jolt regression
   * (ticket 86c9kxb5q) needs a deterministic stretch of time where
   * `audioReady === false` so the render-gate's "preparing" state is
   * observable before the fetch settles. 0 (default) means no artificial
   * delay; the route handler resolves immediately like before.
   */
  delayMs?: number
}

export async function installClaudeMock(
  page: Page,
  options: MockClaudeOptions = {},
): Promise<void> {
  const mathFactory = options.mathResponse ?? canonicalMathSessionResponse
  const wordSongFactory =
    options.wordSongResponse ?? canonicalWordSongSessionResponse

  const delayMs = options.delayMs ?? 0

  await page.route('**/api/claude', async (route: Route) => {
    // Hold the route in flight before either fulfilling or aborting so
    // specs that need to observe the audioReady=false window have time
    // to assert against the DOM before the parent flips the gate.
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    if (options.failNetwork) {
      await route.abort('failed')
      return
    }
    const request = route.request()

    // Allow the CORS preflight to fall through with a friendly 204 so the
    // browser doesn't drop the body of the real POST that follows. The
    // production function does the same shape; we mirror it here.
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

    if (request.method() !== 'POST') {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'method-not-allowed' }),
      })
      return
    }

    let body: Record<string, unknown>
    try {
      body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    } catch {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'invalid-json' }),
      })
      return
    }

    const kind = body.kind
    if (kind !== 'session-start') {
      // We deliberately do not fulfil unrecognised kinds — the only
      // session lifecycle currently calling /api/claude is session-start.
      // If a future spec exercises stumble-explanation / session-end,
      // extend this handler to fulfil those shapes too.
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'invalid-body',
          message: `e2e mock saw unexpected kind=${String(kind)}`,
        }),
      })
      return
    }

    const payload = (body.payload ?? {}) as Record<string, unknown>
    const track = payload.track as string | undefined
    const responseBody =
      track === 'word-song' ? wordSongFactory() : mathFactory()

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseBody),
    })
  })
}
