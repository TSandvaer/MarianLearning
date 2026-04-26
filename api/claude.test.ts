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
    MELODY_VOICE_CONFIG: {
      voice: 'en-US-AnaNeural',
      rate: '-10%',
      pitch: '+0Hz',
      volume: '+0%',
    },
    extractUtteranceTexts: vi.fn(),
  }
})

import claudeEntrypoint, { handler, assertNodeRuntime } from './claude.js'
import { renderSessionAudio } from './_session.js'

const mockedRender = vi.mocked(renderSessionAudio)

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
