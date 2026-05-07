/**
 * @vitest-environment node
 *
 * Tests for /api/progress (cloud-sync, ticket 86c9pkfyu).
 *
 * Covers:
 *  - method routing (OPTIONS / GET / POST / others)
 *  - auth (missing config, missing header, wrong bearer)
 *  - GET happy path, GET 404 first-launch
 *  - POST happy path
 *  - validation (invalid deviceId, malformed body, cross-deviceId not
 *    a thing â€” body's deviceId IS the key)
 *  - rate limiting (per-deviceId, GET vs POST separate buckets)
 *  - KV failure â†’ 502
 *  - CORS shape
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  handler,
  assertNodeRuntime,
  isValidDeviceId,
  buildProgressKey,
} from './progress.js'
import { createRateLimiter } from './_rateLimit.js'
import type { KvClient, ProgressCloudRecord } from './_progressStore.js'

// --- helpers ---------------------------------------------------------------

const VALID_UUID = '11111111-2222-4333-8444-555555555555'
const OTHER_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const SECRET = 'test-progress-secret-deadbeef'

function makeKv(initial: Record<string, ProgressCloudRecord> = {}): {
  client: KvClient
  store: Map<string, ProgressCloudRecord>
} {
  const store = new Map<string, ProgressCloudRecord>(Object.entries(initial))
  return {
    client: {
      get: vi.fn(async (key: string) => {
        const v = store.get(key)
        return v === undefined ? null : v
      }),
      set: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value as ProgressCloudRecord)
        return 'OK'
      }),
    },
    store,
  }
}

interface JsonBody {
  ok?: unknown
  error?: string
  blob?: unknown
  lastModifiedISO?: string
  message?: string
}

async function readBody(res: Response): Promise<JsonBody> {
  return (await res.json()) as JsonBody
}

function makeRequest(
  url: string,
  init: RequestInit & { auth?: 'valid' | 'wrong' | 'none' } = {},
): Request {
  const { auth = 'valid', ...rest } = init
  const headers = new Headers(rest.headers)
  if (auth === 'valid') headers.set('Authorization', `Bearer ${SECRET}`)
  if (auth === 'wrong') headers.set('Authorization', 'Bearer not-the-secret')
  if (!headers.has('Content-Type') && rest.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  return new Request(url, { ...rest, headers })
}

beforeEach(() => {
  process.env.PROGRESS_API_SECRET = SECRET
})

afterEach(() => {
  delete process.env.PROGRESS_API_SECRET
})

// --- runtime + validation primitives --------------------------------------

describe('runtime assertion', () => {
  it('does not throw under Node', () => {
    expect(() => assertNodeRuntime()).not.toThrow()
  })
})

describe('isValidDeviceId', () => {
  it('accepts crypto.randomUUID()-style v4 UUIDs', () => {
    expect(isValidDeviceId('11111111-2222-4333-8444-555555555555')).toBe(true)
  })
  it('rejects empty string', () => {
    expect(isValidDeviceId('')).toBe(false)
  })
  it('rejects non-string', () => {
    expect(isValidDeviceId(undefined)).toBe(false)
    expect(isValidDeviceId(null)).toBe(false)
    expect(isValidDeviceId(123)).toBe(false)
  })
  it('rejects malformed shapes', () => {
    expect(isValidDeviceId('not-a-uuid')).toBe(false)
    expect(isValidDeviceId('11111111-2222-4333-8444-55555555555')).toBe(false) // short
    expect(isValidDeviceId('zzzzzzzz-2222-4333-8444-555555555555')).toBe(false) // bad hex
  })
})

describe('buildProgressKey', () => {
  it('namespaces under "progress:"', () => {
    expect(buildProgressKey(VALID_UUID)).toEqual(`progress:${VALID_UUID}`)
  })
})

// --- method routing -------------------------------------------------------

describe('OPTIONS / preflight', () => {
  it('returns 204 with CORS headers for OPTIONS', async () => {
    const { client } = makeKv()
    const req = makeRequest('https://example.test/api/progress', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
      auth: 'none',
    })
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:5173',
    )
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain(
      'Authorization',
    )
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})

describe('rejects non-GET/POST methods', () => {
  it('returns 405 for PUT', async () => {
    const { client } = makeKv()
    const req = makeRequest('https://example.test/api/progress', {
      method: 'PUT',
    })
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toContain('GET')
    expect(res.headers.get('Allow')).toContain('POST')
    const body = (await readBody(res)) as { error?: string }
    expect(body.error).toEqual('method-not-allowed')
  })
})

// --- auth -----------------------------------------------------------------

describe('auth', () => {
  it('returns 500 config-missing when PROGRESS_API_SECRET is unset', async () => {
    delete process.env.PROGRESS_API_SECRET
    const { client } = makeKv()
    const req = makeRequest(
      `https://example.test/api/progress?deviceId=${VALID_UUID}`,
      { method: 'GET' },
    )
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(500)
    const body = await readBody(res)
    expect(body.error).toEqual('config-missing')
  })

  it('returns 401 when Authorization header is missing', async () => {
    const { client } = makeKv()
    const req = makeRequest(
      `https://example.test/api/progress?deviceId=${VALID_UUID}`,
      { method: 'GET', auth: 'none' },
    )
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(401)
    const body = await readBody(res)
    expect(body.error).toEqual('unauthorized')
  })

  it('returns 401 when Authorization bearer token is wrong', async () => {
    const { client } = makeKv()
    const req = makeRequest(
      `https://example.test/api/progress?deviceId=${VALID_UUID}`,
      { method: 'GET', auth: 'wrong' },
    )
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(401)
    const body = await readBody(res)
    expect(body.error).toEqual('unauthorized')
  })
})

// --- GET ------------------------------------------------------------------

describe('GET /api/progress', () => {
  it('returns 200 with blob when record exists', async () => {
    const cloudRecord: ProgressCloudRecord = {
      blob: { schemaVersion: 1, hello: 'world' },
      lastModifiedISO: '2026-05-07T10:00:00.000Z',
    }
    const { client, store } = makeKv({
      [`progress:${VALID_UUID}`]: cloudRecord,
    })
    const req = makeRequest(
      `https://example.test/api/progress?deviceId=${VALID_UUID}`,
      { method: 'GET' },
    )
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(200)
    expect(store.has(`progress:${VALID_UUID}`)).toBe(true)
    const body = await readBody(res)
    expect(body).toEqual({
      ok: true,
      blob: cloudRecord.blob,
      lastModifiedISO: cloudRecord.lastModifiedISO,
    })
  })

  it('returns 404 not-found when no record exists (first-launch case)', async () => {
    const { client } = makeKv() // empty
    const req = makeRequest(
      `https://example.test/api/progress?deviceId=${VALID_UUID}`,
      { method: 'GET' },
    )
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(404)
    const body = await readBody(res)
    expect(body.error).toEqual('not-found')
  })

  it('returns 400 when deviceId is missing or malformed', async () => {
    const { client } = makeKv()
    const req1 = makeRequest('https://example.test/api/progress', {
      method: 'GET',
    })
    const res1 = await handler(req1, { kvClient: client })
    expect(res1.status).toBe(400)
    expect((await readBody(res1)).error).toEqual('invalid-deviceId')

    const req2 = makeRequest(
      'https://example.test/api/progress?deviceId=not-a-uuid',
      { method: 'GET' },
    )
    const res2 = await handler(req2, { kvClient: client })
    expect(res2.status).toBe(400)
    expect((await readBody(res2)).error).toEqual('invalid-deviceId')
  })

  it('returns 502 when KV throws on read', async () => {
    const client: KvClient = {
      get: vi.fn(async () => {
        throw new Error('upstash unreachable')
      }),
      set: vi.fn(async () => 'OK'),
    }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const req = makeRequest(
      `https://example.test/api/progress?deviceId=${VALID_UUID}`,
      { method: 'GET' },
    )
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(502)
    expect((await readBody(res)).error).toEqual('kv-failed')
    expect(errSpy).toHaveBeenCalledWith(
      '[api/progress] kv-get-failed',
      expect.objectContaining({ message: 'upstash unreachable' }),
    )
    errSpy.mockRestore()
  })
})

// --- POST -----------------------------------------------------------------

describe('POST /api/progress', () => {
  it('writes the record and returns 200 ok', async () => {
    const { client, store } = makeKv()
    const body = {
      deviceId: VALID_UUID,
      blob: { schemaVersion: 1, marian: true },
      lastModifiedISO: '2026-05-07T11:00:00.000Z',
    }
    const req = makeRequest('https://example.test/api/progress', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(200)
    expect(await readBody(res)).toEqual({ ok: true })
    expect(store.get(`progress:${VALID_UUID}`)).toEqual({
      blob: body.blob,
      lastModifiedISO: body.lastModifiedISO,
    })
  })

  it('rejects 400 invalid-json on bad body', async () => {
    const { client } = makeKv()
    const req = new Request('https://example.test/api/progress', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SECRET}`,
        'Content-Type': 'application/json',
      },
      body: 'not-json',
    })
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(400)
    expect((await readBody(res)).error).toEqual('invalid-json')
  })

  it('rejects 400 invalid-body when deviceId is malformed', async () => {
    const { client } = makeKv()
    const body = {
      deviceId: 'not-a-uuid',
      blob: {},
      lastModifiedISO: '2026-05-07T11:00:00.000Z',
    }
    const req = makeRequest('https://example.test/api/progress', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(400)
    expect((await readBody(res)).error).toEqual('invalid-body')
  })

  it('rejects 400 invalid-body when lastModifiedISO is unparseable', async () => {
    const { client } = makeKv()
    const body = {
      deviceId: VALID_UUID,
      blob: {},
      lastModifiedISO: 'definitely-not-a-date',
    }
    const req = makeRequest('https://example.test/api/progress', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(400)
    expect((await readBody(res)).error).toEqual('invalid-body')
  })

  it('returns 502 when KV throws on write', async () => {
    const client: KvClient = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {
        throw new Error('upstash write failed')
      }),
    }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const body = {
      deviceId: VALID_UUID,
      blob: {},
      lastModifiedISO: '2026-05-07T11:00:00.000Z',
    }
    const req = makeRequest('https://example.test/api/progress', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const res = await handler(req, { kvClient: client })
    expect(res.status).toBe(502)
    expect((await readBody(res)).error).toEqual('kv-failed')
    errSpy.mockRestore()
  })
})

// --- rate limiting --------------------------------------------------------

describe('rate limiting', () => {
  it('GET limiter is keyed by deviceId â€” different devices have separate buckets', async () => {
    const { client } = makeKv()
    // limit=2 makes the test cheap
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 })
    const otherLimiter = createRateLimiter({ limit: 2, windowMs: 60_000 })
    const make = (deviceId: string) =>
      makeRequest(`https://example.test/api/progress?deviceId=${deviceId}`, {
        method: 'GET',
      })
    const opts = {
      kvClient: client,
      getLimiter: limiter,
      postLimiter: otherLimiter,
    }

    expect((await handler(make(VALID_UUID), opts)).status).toBe(404)
    expect((await handler(make(VALID_UUID), opts)).status).toBe(404)
    // Third hit on VALID_UUID is rate-limited
    const blocked = await handler(make(VALID_UUID), opts)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
    expect((await readBody(blocked)).error).toEqual('rate-limited')
    // OTHER_UUID still has a fresh bucket
    expect((await handler(make(OTHER_UUID), opts)).status).toBe(404)
  })

  it('GET and POST limiters are independent', async () => {
    const { client } = makeKv()
    const limiterGet = createRateLimiter({ limit: 1, windowMs: 60_000 })
    const limiterPost = createRateLimiter({ limit: 1, windowMs: 60_000 })

    const getReq = makeRequest(
      `https://example.test/api/progress?deviceId=${VALID_UUID}`,
      { method: 'GET' },
    )
    const postBody = {
      deviceId: VALID_UUID,
      blob: {},
      lastModifiedISO: '2026-05-07T11:00:00.000Z',
    }
    const postReq = () =>
      makeRequest('https://example.test/api/progress', {
        method: 'POST',
        body: JSON.stringify(postBody),
      })

    // First GET passes (404 not-found â€” no record).
    expect(
      (
        await handler(getReq, {
          kvClient: client,
          getLimiter: limiterGet,
          postLimiter: limiterPost,
        })
      ).status,
    ).toBe(404)
    // First POST passes (200) â€” separate bucket from GET.
    expect(
      (
        await handler(postReq(), {
          kvClient: client,
          getLimiter: limiterGet,
          postLimiter: limiterPost,
        })
      ).status,
    ).toBe(200)
    // Second POST is rate-limited (POST bucket exhausted).
    const blocked = await handler(postReq(), {
      kvClient: client,
      getLimiter: limiterGet,
      postLimiter: limiterPost,
    })
    expect(blocked.status).toBe(429)
  })
})

// --- CORS shape -----------------------------------------------------------

describe('CORS', () => {
  it('echoes allowed Origin on responses', async () => {
    const { client } = makeKv()
    const req = makeRequest(
      `https://example.test/api/progress?deviceId=${VALID_UUID}`,
      {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      },
    )
    const res = await handler(req, { kvClient: client })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:5173',
    )
    expect(res.headers.get('Vary')).toBe('Origin')
  })

  it('does not set Access-Control-Allow-Origin for unknown origins', async () => {
    const { client } = makeKv()
    const req = makeRequest(
      `https://example.test/api/progress?deviceId=${VALID_UUID}`,
      {
        method: 'GET',
        headers: { Origin: 'https://attacker.example' },
      },
    )
    const res = await handler(req, { kvClient: client })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(null)
  })
})
