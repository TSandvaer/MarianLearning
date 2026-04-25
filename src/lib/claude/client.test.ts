import { afterEach, describe, expect, it, vi } from 'vitest'
import { callClaude, ClaudeApiError } from './client'

function mockFetchOnce(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValueOnce(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('callClaude', () => {
  it('POSTs JSON to /api/claude with kind + payload', async () => {
    const fetchMock = mockFetchOnce(
      jsonResponse({
        ok: true,
        kind: 'session-start',
        stub: true,
        note: 'stub',
      }),
    )

    await callClaude('session-start', { skill: 'add-to-10' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/claude')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body as string)).toEqual({
      kind: 'session-start',
      payload: { skill: 'add-to-10' },
    })
  })

  it('returns the parsed stub response on success', async () => {
    mockFetchOnce(
      jsonResponse({
        ok: true,
        kind: 'stumble-explanation',
        stub: true,
        note: 'not yet wired',
      }),
    )

    const result = await callClaude('stumble-explanation', { problem: '3+4' })
    expect(result).toEqual({
      ok: true,
      kind: 'stumble-explanation',
      stub: true,
      note: 'not yet wired',
    })
  })

  it('throws ClaudeApiError with the function-provided code on 4xx', async () => {
    mockFetchOnce(
      jsonResponse(
        { error: 'invalid-body', message: 'kind missing' },
        { status: 400 },
      ),
    )

    await expect(callClaude('session-end', null)).rejects.toMatchObject({
      name: 'ClaudeApiError',
      status: 400,
      code: 'invalid-body',
      message: 'kind missing',
    })
  })

  it('throws config-missing on 500 from the function', async () => {
    mockFetchOnce(jsonResponse({ error: 'config-missing' }, { status: 500 }))

    const err = await callClaude('session-start', {}).catch((e) => e)
    expect(err).toBeInstanceOf(ClaudeApiError)
    expect((err as ClaudeApiError).code).toBe('config-missing')
    expect((err as ClaudeApiError).status).toBe(500)
  })

  it('throws network-coded ClaudeApiError when fetch rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('offline'))
    vi.stubGlobal('fetch', fetchMock)

    const err = await callClaude('session-start', {}).catch((e) => e)
    expect(err).toBeInstanceOf(ClaudeApiError)
    expect((err as ClaudeApiError).code).toBe('network')
    expect((err as ClaudeApiError).status).toBe(0)
  })

  it('throws malformed when the body is not JSON', async () => {
    mockFetchOnce(
      new Response('not json', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    )

    const err = await callClaude('session-start', {}).catch((e) => e)
    expect(err).toBeInstanceOf(ClaudeApiError)
    expect((err as ClaudeApiError).code).toBe('malformed')
  })

  it('throws malformed when the success body has the wrong shape', async () => {
    mockFetchOnce(jsonResponse({ ok: true, totally: 'wrong' }))

    const err = await callClaude('session-start', {}).catch((e) => e)
    expect(err).toBeInstanceOf(ClaudeApiError)
    expect((err as ClaudeApiError).code).toBe('malformed')
  })

  it('forwards an AbortSignal to fetch', async () => {
    const fetchMock = mockFetchOnce(
      jsonResponse({
        ok: true,
        kind: 'session-end',
        stub: true,
        note: 'ok',
      }),
    )
    const controller = new AbortController()

    await callClaude('session-end', {}, { signal: controller.signal })

    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.signal).toBe(controller.signal)
  })
})
