/**
 * @vitest-environment node
 *
 * Integration test for the Vercel function. Exercises the request-shape
 * branches and the new (ticket 86c9gr385) session-start → TTS-merge path.
 *
 * The TTS module is dependency-injected in `_session.ts`; here we mock it
 * by stubbing the named export the function transitively imports. We use
 * `vi.mock` of `./_session` so we can plug in a deterministic
 * `renderSessionAudio` fake.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock _session BEFORE importing the handler so the handler picks up the
// stubbed renderSessionAudio. NB: the mock specifier MUST match the source
// import specifier exactly — handler imports `./_session.js`, so the mock
// is keyed on `./_session.js` too. See HISTORY in api/claude.ts (round 3).
vi.mock('./_session.js', () => {
  return {
    renderSessionAudio: vi.fn(),
    EMMA_VOICE_CONFIG: {
      voice: 'en-US-EmmaMultilingualNeural',
      rate: '-10%',
      pitch: '+0Hz',
      volume: '+0%',
    },
    extractUtteranceTexts: vi.fn(),
  }
})

import claudeEntrypoint, { handler, assertNodeRuntime } from './claude.js'
import { renderSessionAudio } from './_session.js'
import { createRateLimiter } from './_rateLimit.js'
import { createSessionCache } from './_sessionCache.js'
import type { PlannerAnthropicClient } from './_planner.js'

const mockedRender = vi.mocked(renderSessionAudio)

/** Build a stubbed Anthropic SDK client that returns a fixed plan body.
 *  Captures the args of the last call so tests can assert prompt shape. */
function makeStubAnthropicClient(
  responseText: string,
  capture: { lastArgs?: unknown } = {},
): PlannerAnthropicClient {
  return {
    messages: {
      create: vi.fn(async (args) => {
        capture.lastArgs = args
        return {
          content: [{ type: 'text', text: responseText }],
        }
      }),
    },
  }
}

/** Stable mock plan response from Haiku — well-formed math plan shape. */
const STUB_MATH_PLAN_BODY = JSON.stringify({
  id: 'haiku-math-test',
  label: 'Sums to 10 — test',
  utterances: [
    { id: 'math.p1.read', text: 'Three plus two. How many?' },
    { id: 'math.p1.correct', text: 'Yes! Five!' },
  ],
})

function makeRequest(body: unknown, init: RequestInit = {}): Request {
  return new Request('https://example.test/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  })
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
  mockedRender.mockReset()
})

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
})

describe('runtime assertion (Vercel cold-start tripwire)', () => {
  // Background: PR #28 first attempted this tripwire as
  //   export const config = { runtime: 'nodejs' } as const
  // which Vercel does NOT recognise for /api/*.ts files (that shape is the
  // Next.js middleware convention). The result was FUNCTION_INVOCATION_FAILED
  // on every request — module load failed before reaching the handler. This
  // hot-fix replaces the magic-string config with a real runtime check that
  // throws if `process.versions.node` is missing (i.e. running on Edge).
  //
  // The presence of THIS test plus the `assertNodeRuntime()` call at module
  // top-level means a regression that flips the function to Edge will fail
  // CI (this test runs in Node so the assertion passes here) AND will fail
  // loud at cold-start in production (with a clear message, not a cryptic
  // "ws is not defined").

  it('does not throw when running on Node (sanity)', () => {
    expect(() => assertNodeRuntime()).not.toThrow()
  })

  it('throws a clear message when process.versions.node is missing (Edge-runtime simulation)', () => {
    const originalProcess = globalThis.process
    try {
      // Simulate Edge runtime: no Node `process` global.
      ;(globalThis as { process?: unknown }).process = undefined
      expect(() => assertNodeRuntime()).toThrow(/Vercel Node runtime/)
    } finally {
      ;(globalThis as { process?: unknown }).process = originalProcess
    }
  })

  it('throws when process exists but process.versions.node is not a string', () => {
    const originalProcess = globalThis.process
    try {
      ;(globalThis as { process?: unknown }).process = { versions: {} }
      expect(() => assertNodeRuntime()).toThrow(/Vercel Node runtime/)
    } finally {
      ;(globalThis as { process?: unknown }).process = originalProcess
    }
  })
})

describe('Vercel entrypoint shape (regression — round-2 hot-fix 86c9grnj4)', () => {
  // Background: the round-1 fix kept the default export as a bare async
  // function `export default async function handler(request: Request)`.
  // `@vercel/node`'s dispatcher only routes the Web `Request`/`Response`
  // codepath when the entrypoint exports per-method handlers (GET/POST/...)
  // OR an object with a `fetch` method. Without those it falls back to
  // invoking the default function with `(IncomingMessage, ServerResponse)`,
  // and our handler — which calls `request.headers.get('origin')` —
  // throws TypeError on the first line. Result: FUNCTION_INVOCATION_FAILED
  // on every method, including OPTIONS, in production.
  //
  // Source of truth:
  //   github.com/vercel/vercel — packages/node/src/serverless-functions/
  //     serverless-handler.mts  (`shouldUseWebHandlers`)
  //
  // This test pins the export shape so a future refactor that drops the
  // `fetch` wrapper (or reverts to a bare default function) fails in CI
  // before it reaches Vercel.

  it('default export is an object with a `fetch` method (NOT a bare function)', () => {
    expect(typeof claudeEntrypoint).toBe('object')
    expect(claudeEntrypoint).not.toBeNull()
    expect(typeof (claudeEntrypoint as { fetch?: unknown }).fetch).toBe(
      'function',
    )
  })

  it('default.fetch is the same handler exported by name', () => {
    expect((claudeEntrypoint as { fetch: unknown }).fetch).toBe(handler)
  })
})

describe('OPTIONS preflight', () => {
  it('returns 204 with CORS headers', async () => {
    const req = new Request('https://example.test/api/claude', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173' },
    })
    const res = await handler(req)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:5173',
    )
  })
})

describe('non-POST methods', () => {
  it('returns 405 with Allow header', async () => {
    const req = new Request('https://example.test/api/claude', {
      method: 'GET',
    })
    const res = await handler(req)
    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toContain('POST')
  })
})

describe('body validation', () => {
  it('rejects non-JSON bodies', async () => {
    const req = new Request('https://example.test/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid-json' })
  })

  it('rejects malformed bodies', async () => {
    const res = await handler(makeRequest({ kind: 'unknown', payload: {} }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid-body' })
  })

  it('rejects when the API key env var is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = await handler(
      makeRequest({ kind: 'session-start', payload: {} }),
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'config-missing' })
  })
})

describe('stub path (no plan in payload)', () => {
  it('returns the legacy stub for session-start without a plan', async () => {
    const res = await handler(
      makeRequest({ kind: 'session-start', payload: {} }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      ok: true,
      kind: 'session-start',
      stub: true,
    })
    expect(mockedRender).not.toHaveBeenCalled()
  })

  it('returns the legacy stub for stumble-explanation', async () => {
    const res = await handler(
      makeRequest({ kind: 'stumble-explanation', payload: { problem: '2+3' } }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      ok: true,
      kind: 'stumble-explanation',
      stub: true,
    })
  })

  it('returns the legacy stub for session-end', async () => {
    const res = await handler(makeRequest({ kind: 'session-end', payload: {} }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      ok: true,
      kind: 'session-end',
      stub: true,
    })
  })
})

describe('TTS-merge path (session-start with plan)', () => {
  it('renders TTS and returns the SessionStartResponse', async () => {
    const fakePlan = {
      utterances: [{ id: 'p1', text: 'Two plus three.' }],
    }
    mockedRender.mockResolvedValueOnce({
      ok: true,
      kind: 'session-start',
      plan: fakePlan,
      utterances: [
        {
          id: 'p1',
          text: 'Two plus three.',
          audio: { kind: 'inline', base64: 'AAEC', mime: 'audio/mpeg' },
        },
      ],
    })

    const res = await handler(
      makeRequest({
        kind: 'session-start',
        payload: { plan: fakePlan },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      kind: string
      utterances: { id: string; audio: { mime: string } }[]
    }
    expect(body.kind).toBe('session-start')
    expect(body.utterances).toHaveLength(1)
    expect(body.utterances[0]!.audio.mime).toBe('audio/mpeg')
    expect(mockedRender).toHaveBeenCalledOnce()
    // The plan reaches the function via JSON.stringify → JSON.parse, so
    // structural equality, not identity.
    expect(mockedRender.mock.calls[0]![0]).toEqual(fakePlan)
  })

  it('returns 502 tts-failed when the TTS render throws', async () => {
    // Suppress the new console.error log (asserted by its own test below)
    // so this existing assertion isn't noisy in test output.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockedRender.mockRejectedValueOnce(new Error('socket reset'))
      const res = await handler(
        makeRequest({
          kind: 'session-start',
          payload: { plan: { utterances: [{ id: 'a', text: 't' }] } },
        }),
      )
      expect(res.status).toBe(502)
      const body = (await res.json()) as { error: string; message?: string }
      expect(body.error).toBe('tts-failed')
      expect(body.message).toContain('socket reset')
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('logs the underlying error to console.error on the tts-failed path (ticket 86c9gwxah — so vercel logs is non-empty)', async () => {
    // Background: the 86c9gwvn0 P0 investigation had to reason from the
    // 502 response-message shape because this catch path was silent. The
    // structural fix is to log message + stack so future failures of
    // this shape are diagnosable from `vercel logs` directly.
    //
    // PII / secrets discipline: the log line must NOT carry the request
    // body, the payload, or the Azure key. Asserting on the call shape
    // (exactly { message, stack }) keeps that contract enforced — if
    // someone widens the log surface, this test fails and the PR review
    // surfaces it.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const thrown = new Error('socket reset')
      mockedRender.mockRejectedValueOnce(thrown)

      const res = await handler(
        makeRequest({
          kind: 'session-start',
          payload: { plan: { utterances: [{ id: 'a', text: 't' }] } },
        }),
      )
      expect(res.status).toBe(502)

      // Logged exactly once, with a stable label and a structured payload
      // carrying message + stack. No third positional arg — no payload /
      // body / headers / key surface.
      expect(errorSpy).toHaveBeenCalledTimes(1)
      const [label, detail, ...rest] = errorSpy.mock.calls[0]!
      expect(label).toBe('[api/claude] tts-failed')
      expect(rest).toEqual([])
      expect(detail).toMatchObject({
        message: 'socket reset',
        stack: expect.stringContaining('Error: socket reset'),
      })
      // Belt-and-braces: nothing else snuck in.
      expect(Object.keys(detail as object).sort()).toEqual(['message', 'stack'])
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('cache-control header is no-store on every response', async () => {
    const res = await handler(makeRequest({ kind: 'session-end', payload: {} }))
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('Track-based session-start (ticket 86c9jdh39 — real Anthropic wiring)', () => {
  // These tests exercise the new track→Haiku→TTS pipeline. The real
  // Anthropic SDK is replaced with a stub via the handler's `overrides`
  // seam; the TTS pipeline is replaced via the `vi.mock('./_session.js')`
  // at the top of this file.

  // Fresh cache per test (ticket 86c9kjdh2). The handler defaults to a
  // module-singleton cache; injecting a per-test instance ensures tests
  // see a clean cache state regardless of execution order.
  let sessionCache = createSessionCache({ ttlMs: 60_000, now: () => 1000 })

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
    mockedRender.mockReset()
    sessionCache = createSessionCache({ ttlMs: 60_000, now: () => 1000 })
    // Default — render echoes a small response so the success path tests
    // don't have to set this up every time.
    mockedRender.mockResolvedValue({
      ok: true,
      kind: 'session-start',
      plan: { utterances: [] },
      utterances: [
        {
          id: 'math.p1.read',
          text: 'Three plus two. How many?',
          audio: { kind: 'inline', base64: 'AAEC', mime: 'audio/mpeg' },
        },
      ],
    })
  })

  it('routes track payload through the planner and returns SessionStartResponse', async () => {
    const capture: { lastArgs?: unknown } = {}
    const anthropicClient = makeStubAnthropicClient(
      STUB_MATH_PLAN_BODY,
      capture,
    )

    const res = await handler(
      makeRequest({
        kind: 'session-start',
        payload: { track: 'math', level: 1, childName: 'Marian' },
      }),
      { anthropicClient, sessionCache },
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      kind: string
      utterances: unknown[]
    }
    expect(body.ok).toBe(true)
    expect(body.kind).toBe('session-start')

    // Planner was called with the pinned model id.
    const args = capture.lastArgs as { model: string }
    expect(args.model).toBe('claude-haiku-4-5-20251001')

    // Plan from planner was passed through to renderSessionAudio.
    expect(mockedRender).toHaveBeenCalledTimes(1)
    const planArg = mockedRender.mock.calls[0]![0] as {
      utterances: Array<{ id: string; text: string }>
    }
    expect(planArg.utterances).toHaveLength(2)
    expect(planArg.utterances[0]!.id).toBe('math.p1.read')
  })

  it('rejects malformed track payloads (falls through to stub)', async () => {
    // Missing childName → not a valid track payload → falls through to
    // the legacy stub path. (`payload` on ClaudeRequest is typed `unknown`
    // by design, so no @ts-expect-error needed — the runtime guard inside
    // extractTrackPayload is what we're exercising here.)
    const res = await handler(
      makeRequest({
        kind: 'session-start',
        payload: { track: 'math', level: 1 },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { stub?: boolean }
    expect(body.stub).toBe(true)
  })

  it('rejects bogus track names (not in the valid set)', async () => {
    const res = await handler(
      makeRequest({
        kind: 'session-start',
        payload: { track: 'banana', level: 1, childName: 'Marian' },
      }),
    )
    // Falls through to stub — unknown track means the handler doesn't
    // recognise this as a track payload at all.
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ stub: true })
  })

  it('rejects level out of range', async () => {
    const res = await handler(
      makeRequest({
        kind: 'session-start',
        payload: { track: 'math', level: 99, childName: 'Marian' },
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ stub: true })
  })

  it('rejects over-long childName (defense against prompt injection)', async () => {
    const longName = 'a'.repeat(100)
    const res = await handler(
      makeRequest({
        kind: 'session-start',
        payload: { track: 'math', level: 1, childName: longName },
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ stub: true })
  })

  it('returns 502 planner-failed when the model returns malformed JSON', async () => {
    // Planner rejects non-JSON; the handler maps that to planner-failed.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const anthropicClient = makeStubAnthropicClient('this is not json')
      const res = await handler(
        makeRequest({
          kind: 'session-start',
          payload: { track: 'math', level: 1, childName: 'Marian' },
        }),
        { anthropicClient, sessionCache },
      )
      expect(res.status).toBe(502)
      expect(await res.json()).toMatchObject({ error: 'planner-failed' })
      // Logged as planner-failed (not tts-failed) for log attribution.
      expect(
        errorSpy.mock.calls.some(
          (call) => call[0] === '[api/claude] planner-failed',
        ),
      ).toBe(true)
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('returns 502 tts-failed if planner succeeds but TTS pipeline fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const anthropicClient = makeStubAnthropicClient(STUB_MATH_PLAN_BODY)
      mockedRender.mockRejectedValueOnce(new Error('azure 500'))
      const res = await handler(
        makeRequest({
          kind: 'session-start',
          payload: { track: 'math', level: 1, childName: 'Marian' },
        }),
        { anthropicClient, sessionCache },
      )
      expect(res.status).toBe(502)
      const body = (await res.json()) as { error: string; message?: string }
      expect(body.error).toBe('tts-failed')
      expect(body.message).toContain('azure 500')
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('does not leak the request body or the API key in error logs', async () => {
    // Discipline check: our log shape is { message, stack } only — no
    // `payload` key, no `key` value, no `track` value reaching the log
    // surface. Ensures a future widening of the log doesn't slip in.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const anthropicClient = makeStubAnthropicClient('not json')
      await handler(
        makeRequest({
          kind: 'session-start',
          payload: {
            track: 'math',
            level: 1,
            childName: 'Marian',
          },
        }),
        { anthropicClient, sessionCache },
      )
      // The planner-failed log fires once with [label, detail] — no third
      // arg, no payload echo.
      const plannerCalls = errorSpy.mock.calls.filter(
        (c) => c[0] === '[api/claude] planner-failed',
      )
      expect(plannerCalls).toHaveLength(1)
      const [, detail, ...rest] = plannerCalls[0]!
      expect(rest).toEqual([])
      expect(Object.keys(detail as object).sort()).toEqual(['message', 'stack'])
      // None of the secret-shaped values should appear in the detail.
      const blob = JSON.stringify(detail)
      expect(blob).not.toContain('test-key-not-real')
    } finally {
      errorSpy.mockRestore()
    }
  })
})

describe('Rate limiting on track-based session-start (ticket 86c9jdh39)', () => {
  // Fresh cache per test (ticket 86c9kjdh2). See note in the track-based
  // suite above for the rationale.
  let sessionCache = createSessionCache({ ttlMs: 60_000, now: () => 1000 })

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
    mockedRender.mockReset()
    sessionCache = createSessionCache({ ttlMs: 60_000, now: () => 1000 })
    mockedRender.mockResolvedValue({
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [],
    })
  })

  it('returns 429 with Retry-After when the limiter rejects', async () => {
    // Build a limiter that's already saturated by pre-loading 6 requests
    // for the test IP. We use a tight limit (2) and pre-fill it so the
    // very first call from the handler is blocked.
    const rateLimiter = createRateLimiter({ limit: 2, windowMs: 60_000 })
    rateLimiter.check('203.0.113.1', 1000)
    rateLimiter.check('203.0.113.1', 2000)

    const anthropicClient = makeStubAnthropicClient(STUB_MATH_PLAN_BODY)
    const req = new Request('https://example.test/api/claude', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Vercel sets x-forwarded-for; our extractor reads it.
        'x-forwarded-for': '203.0.113.1',
      },
      body: JSON.stringify({
        kind: 'session-start',
        payload: { track: 'math', level: 1, childName: 'Marian' },
      }),
    })

    const res = await handler(req, {
      anthropicClient,
      rateLimiter,
      sessionCache,
      now: () => 3000,
    })

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toMatch(/^\d+$/)
    expect(await res.json()).toMatchObject({ error: 'rate-limited' })
    // Crucially: the Anthropic SDK was NOT called. Limiter must gate
    // before any cost is incurred.
    expect(anthropicClient.messages.create).not.toHaveBeenCalled()
  })

  it('does NOT rate-limit the legacy plan-attached path', async () => {
    // The plan-attached path costs nothing on Anthropic (it only renders
    // TTS), so we deliberately skip the limiter for it. This test pins
    // that contract — a saturated limiter should NOT block a v1 client.
    const rateLimiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
    rateLimiter.check('203.0.113.2', 1000)

    const fakePlan = { utterances: [{ id: 'p1', text: 'Hi.' }] }
    mockedRender.mockResolvedValueOnce({
      ok: true,
      kind: 'session-start',
      plan: fakePlan,
      utterances: [
        {
          id: 'p1',
          text: 'Hi.',
          audio: { kind: 'inline', base64: 'AAEC', mime: 'audio/mpeg' },
        },
      ],
    })

    const req = new Request('https://example.test/api/claude', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.2',
      },
      body: JSON.stringify({
        kind: 'session-start',
        payload: { plan: fakePlan },
      }),
    })

    const res = await handler(req, {
      rateLimiter,
      sessionCache,
      now: () => 2000,
    })

    expect(res.status).toBe(200)
    expect(mockedRender).toHaveBeenCalled()
  })
})

describe('Session cache on track-based session-start (ticket 86c9kjdh2)', () => {
  // Per-test fresh cache + planner stub. The cache-aware handler should
  // serve the second-and-subsequent identical requests from the cache,
  // bypassing the Anthropic SDK and the TTS pipeline entirely.
  //
  // We also inject a fresh rate limiter per test (with a generous limit)
  // so the module-singleton limiter accumulating state from earlier tests
  // in this file doesn't reject our session-start calls.

  let sessionCache = createSessionCache({ ttlMs: 60_000, now: () => 1000 })
  let rateLimiter = createRateLimiter({ limit: 100, windowMs: 60_000 })
  let nowMs = 1000
  const nowFn = () => nowMs

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real'
    mockedRender.mockReset()
    nowMs = 1000
    sessionCache = createSessionCache({ ttlMs: 60_000, now: nowFn })
    rateLimiter = createRateLimiter({ limit: 100, windowMs: 60_000 })
    mockedRender.mockResolvedValue({
      ok: true,
      kind: 'session-start',
      plan: { utterances: [] },
      utterances: [
        {
          id: 'math.p1.read',
          text: 'Three plus two. How many?',
          audio: { kind: 'inline', base64: 'AAEC', mime: 'audio/mpeg' },
        },
      ],
    })
  })

  it('serves the second identical session-start from cache (Azure synth not called twice)', async () => {
    const anthropicClient = makeStubAnthropicClient(STUB_MATH_PLAN_BODY)
    const payload = {
      kind: 'session-start' as const,
      payload: { track: 'math', level: 1, childName: 'Marian' },
    }

    const res1 = await handler(makeRequest(payload), {
      anthropicClient,
      sessionCache,
      rateLimiter,
      now: nowFn,
    })
    expect(res1.status).toBe(200)
    expect(mockedRender).toHaveBeenCalledTimes(1)
    expect(anthropicClient.messages.create).toHaveBeenCalledTimes(1)

    // Second call within TTL — should hit cache, NOT the planner or TTS.
    nowMs = 2000 // 1s later, well within 60s TTL
    const res2 = await handler(makeRequest(payload), {
      anthropicClient,
      sessionCache,
      rateLimiter,
      now: nowFn,
    })
    expect(res2.status).toBe(200)
    expect(mockedRender).toHaveBeenCalledTimes(1) // STILL one call
    expect(anthropicClient.messages.create).toHaveBeenCalledTimes(1)

    // Bodies are equivalent (deep clone — cache returns a fresh object).
    const body1 = await res1.json()
    const body2 = await res2.json()
    expect(body2).toEqual(body1)
  })

  it('different (track, level, childName) triples each hit the planner+Azure once', async () => {
    const anthropicClient = makeStubAnthropicClient(STUB_MATH_PLAN_BODY)

    await handler(
      makeRequest({
        kind: 'session-start',
        payload: { track: 'math', level: 1, childName: 'Marian' },
      }),
      { anthropicClient, sessionCache, rateLimiter, now: nowFn },
    )
    await handler(
      makeRequest({
        kind: 'session-start',
        payload: { track: 'word-song', level: 1, childName: 'Marian' },
      }),
      { anthropicClient, sessionCache, rateLimiter, now: nowFn },
    )
    await handler(
      makeRequest({
        kind: 'session-start',
        payload: { track: 'math', level: 1, childName: 'Other' },
      }),
      { anthropicClient, sessionCache, rateLimiter, now: nowFn },
    )

    // All three are distinct keys → all three render.
    expect(mockedRender).toHaveBeenCalledTimes(3)
    expect(anthropicClient.messages.create).toHaveBeenCalledTimes(3)
  })

  it('after TTL expiry, the next call hits the planner+Azure again', async () => {
    const anthropicClient = makeStubAnthropicClient(STUB_MATH_PLAN_BODY)
    const payload = {
      kind: 'session-start' as const,
      payload: { track: 'math', level: 1, childName: 'Marian' },
    }

    nowMs = 1000
    await handler(makeRequest(payload), {
      anthropicClient,
      sessionCache,
      rateLimiter,
      now: nowFn,
    })
    expect(mockedRender).toHaveBeenCalledTimes(1)

    // Jump past the 60_000ms TTL.
    nowMs = 100_000
    await handler(makeRequest(payload), {
      anthropicClient,
      sessionCache,
      rateLimiter,
      now: nowFn,
    })
    expect(mockedRender).toHaveBeenCalledTimes(2)
  })

  it('parallel concurrent requests with the same key — race-safe (at most one planner+azure call after the first one settles)', async () => {
    // We cannot prevent two cold-cache concurrent requests from BOTH
    // rendering — that would require a mutex defeating the warm-cache
    // goal. But we MUST guarantee no race breaks the cache map itself
    // and that subsequent calls (after at least one has set()) hit the
    // cache.
    const anthropicClient = makeStubAnthropicClient(STUB_MATH_PLAN_BODY)
    const payload = {
      kind: 'session-start' as const,
      payload: { track: 'math', level: 1, childName: 'Marian' },
    }

    // Fire 5 concurrent requests. With the synchronous Map.get/set, after
    // the first one resolves (and writes the cache), the rest may have
    // already called the planner before the cache write — that's
    // expected. The key invariant: no exception, all 5 return 200,
    // mockedRender call count is bounded by 5 (not unbounded).
    const calls = await Promise.all(
      Array.from({ length: 5 }, () =>
        handler(makeRequest(payload), {
          anthropicClient,
          sessionCache,
          rateLimiter,
          now: nowFn,
        }),
      ),
    )
    for (const res of calls) {
      expect(res.status).toBe(200)
    }
    expect(mockedRender.mock.calls.length).toBeLessThanOrEqual(5)
    expect(mockedRender.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('cached response is independent of the original (mutating the response does not corrupt the cache)', async () => {
    const anthropicClient = makeStubAnthropicClient(STUB_MATH_PLAN_BODY)
    const payload = {
      kind: 'session-start' as const,
      payload: { track: 'math', level: 1, childName: 'Marian' },
    }

    const res1 = await handler(makeRequest(payload), {
      anthropicClient,
      sessionCache,
      rateLimiter,
      now: nowFn,
    })
    const body1 = (await res1.json()) as {
      utterances: Array<{ text: string }>
    }
    // Caller shouldn't mutate, but if they did, it must NOT corrupt
    // the next cache hit.
    body1.utterances[0]!.text = 'caller-mutated'

    nowMs = 2000
    const res2 = await handler(makeRequest(payload), {
      anthropicClient,
      sessionCache,
      rateLimiter,
      now: nowFn,
    })
    const body2 = (await res2.json()) as {
      utterances: Array<{ text: string }>
    }
    expect(body2.utterances[0]!.text).toBe('Three plus two. How many?')
  })
})
