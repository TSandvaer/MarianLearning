// /api/progress — Vercel Function. Cloud-sync for Marian's progress blob.
//
// Ticket: 86c9pkfyu (T2 — Vercel KV cloud sync for progress, UUID-keyed,
// fire-and-forget, boot reconcile).
//
// Purpose
// -------
// Best-effort off-device backup for Marian's `marian-tutor:progress:v1`
// localStorage blob. localStorage stays the authoritative source; this
// function holds a backup keyed by a per-device UUID that the boot-time
// reconcile in App.tsx consults (and writes through to) on every
// session-end.
//
// Auth model
// ----------
// Bearer-token shared secret (`PROGRESS_API_SECRET`). The browser ships
// the same value via `VITE_PROGRESS_API_SECRET` so it's visible in the
// bundle — the protection model is "non-trivial for casual abuse," NOT
// "secure against pentest." Acceptable trade-off explicitly locked in
// the ticket. For any future sensitive-data shape, swap to magic-link
// or signed-token auth.
//
// Privacy
// -------
// The blob carries `childName: "Marian"` AS-IS. No name mapping, no
// pseudonym, no encryption. First-name-only is not real PII; KV is
// single-tenant on Thomas's account; no public list endpoint.
//
// Rate limit
// ----------
// Per-deviceId (NOT per-IP). 60 GET/min and 30 POST/min. Reusing the
// existing `_rateLimit.ts` sliding-window deque module — same shape
// /api/claude uses, two separate limiter instances. Per-deviceId
// keying is deliberate: iPads behind shared NAT (school WiFi later)
// MUST NOT share buckets, and the deviceId is the natural per-device
// identity we already trust.
//
// CORS
// ----
// Same `buildAllowedOrigins()` shape as /api/claude. We deliberately
// inline a copy here instead of importing the helper to keep
// /api/claude.ts unaware of /api/progress (the two functions don't
// otherwise depend on one another). Drift is unlikely; if the rule
// widens, both files update together.
//
// .js extensions on relative imports: required for the Vercel Node ESM
// runtime — see api/claude.ts HISTORY round 3.

import { createRateLimiter, type RateLimiter } from './_rateLimit.js'
import {
  buildProgressKey,
  getProgress,
  setProgress,
  type KvClient,
  type ProgressCloudRecord,
} from './_progressStore.js'

/** Cold-start runtime assertion (mirror of api/claude.ts). The Upstash
 *  client uses `globalThis.fetch`, `Buffer`, and `process.env` — Edge
 *  runtime would lose `process.env` access. This throw makes the
 *  failure loud at the top of the stack rather than buried inside the
 *  SDK. */
export function assertNodeRuntime(): void {
  const nodeVersion = (
    globalThis as { process?: { versions?: { node?: string } } }
  ).process?.versions?.node
  if (typeof nodeVersion !== 'string') {
    throw new Error(
      '/api/progress must run on the Vercel Node runtime — `process.env` ' +
        'and the Upstash Redis client require Node. Check vercel.json and ' +
        'the Vercel project runtime setting; do not move this function ' +
        'to Edge.',
    )
  }
}

assertNodeRuntime()

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

/** Successful GET response when a record exists. */
export interface ProgressGetResponse {
  ok: true
  blob: unknown
  lastModifiedISO: string
}

/** Successful POST response. */
export interface ProgressPostResponse {
  ok: true
}

/** Error response. */
export interface ProgressErrorResponse {
  ok?: false
  error:
    | 'method-not-allowed'
    | 'invalid-body'
    | 'invalid-json'
    | 'invalid-deviceId'
    | 'unauthorized'
    | 'config-missing'
    | 'rate-limited'
    | 'not-found'
    | 'kv-failed'
  message?: string
}

type ProgressResponseBody =
  | ProgressGetResponse
  | ProgressPostResponse
  | ProgressErrorResponse

// ---------------------------------------------------------------------------
// CORS — same allow-list shape as /api/claude. Inlined for the reasons
// noted at the top of the file.
// ---------------------------------------------------------------------------

function buildAllowedOrigins(): readonly string[] {
  const origins = new Set<string>(['http://localhost:5173'])

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) origins.add(`https://${vercelUrl}`)

  // Reuse the same extra-origins config the claude function honours so a
  // single env-var landing covers both endpoints. Cloud-sync doesn't
  // need its own origin list yet.
  const extra = process.env.CLAUDE_API_EXTRA_ORIGINS
  if (extra) {
    for (const o of extra.split(',')) {
      const trimmed = o.trim()
      if (trimmed) origins.add(trimmed)
    }
  }

  return [...origins]
}

function corsHeaders(requestOrigin: string | null): Headers {
  const headers = new Headers()
  const allowed = buildAllowedOrigins()
  if (requestOrigin && allowed.includes(requestOrigin)) {
    headers.set('Access-Control-Allow-Origin', requestOrigin)
    headers.set('Vary', 'Origin')
  }
  // GET + POST are the only methods. Authorization is required, so we
  // must allow it as a request header (browsers send a preflight when
  // a custom auth header is set on POST + JSON content-type).
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Access-Control-Max-Age', '86400')
  return headers
}

function jsonResponse(
  body: ProgressResponseBody,
  status: number,
  baseHeaders: Headers,
): Response {
  const headers = new Headers(baseHeaders)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  // Cloud-sync responses must never be cached — a stale GET would
  // serve last-week's blob and the reconcile logic would compare
  // against the wrong timestamp.
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers })
}

// ---------------------------------------------------------------------------
// DeviceId validation — strict UUID v4 / v5 shape (any RFC 4122 variant).
// `crypto.randomUUID()` always emits v4; we accept any RFC 4122-shaped
// 36-char hex-with-dashes value to leave room for future generation
// strategies (e.g. server-issued UUIDs in a downstream multi-child
// world). 8-4-4-4-12 lowercase or uppercase hex.
// ---------------------------------------------------------------------------

const DEVICE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidDeviceId(v: unknown): v is string {
  return typeof v === 'string' && DEVICE_ID_PATTERN.test(v)
}

// ---------------------------------------------------------------------------
// Rate-limiter singletons — separate buckets for GET and POST. Both keyed
// per-deviceId so iPads behind shared NAT (school WiFi later) don't
// collide. Limits per the ticket AC: 30 POST/min, 60 GET/min.
// ---------------------------------------------------------------------------

const getLimiter: RateLimiter = createRateLimiter({
  limit: 60,
  windowMs: 60_000,
})

const postLimiter: RateLimiter = createRateLimiter({
  limit: 30,
  windowMs: 60_000,
})

// ---------------------------------------------------------------------------
// Auth check — bearer-token shared secret. Constant-time comparison NOT
// strictly required for this auth model (the bundle exposes the value
// already), but we use a deterministic compare for code-readability and
// to keep "I tweaked the timing" out of the trip-wire surface.
// ---------------------------------------------------------------------------

function isAuthorized(request: Request): boolean {
  const expected = process.env.PROGRESS_API_SECRET
  if (typeof expected !== 'string' || expected.length === 0) {
    // Misconfiguration. We refuse to authorise rather than fall through
    // to "no auth required". This is read by the caller as 500
    // config-missing.
    return false
  }
  const header = request.headers.get('authorization')
  if (typeof header !== 'string') return false
  const expectedHeader = `Bearer ${expected}`
  // length-mismatch fast-fail; otherwise simple equality. Constant-time
  // would matter if the secret were a high-entropy server-side token,
  // but it's already in the bundle.
  if (header.length !== expectedHeader.length) return false
  return header === expectedHeader
}

// ---------------------------------------------------------------------------
// POST body validation. Shape: { deviceId, blob, lastModifiedISO }.
// `blob` is opaque and we do NOT validate its inner shape — the browser
// is responsible for re-validating after fetch. We DO check that
// `lastModifiedISO` is a parseable ISO string and that `deviceId`
// matches the path's deviceId from the URL (cross-deviceId rejection).
// ---------------------------------------------------------------------------

interface PostBody {
  deviceId: string
  blob: unknown
  lastModifiedISO: string
}

function isPostBody(v: unknown): v is PostBody {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (!isValidDeviceId(obj.deviceId)) return false
  if (typeof obj.lastModifiedISO !== 'string') return false
  // Sanity-check the timestamp shape. We don't need millisecond accuracy
  // — just that it's a valid Date for the comparison the browser does
  // on reconcile.
  if (Number.isNaN(Date.parse(obj.lastModifiedISO))) return false
  if (!('blob' in obj)) return false
  return true
}

// ---------------------------------------------------------------------------
// Handler-level seams. Tests inject a stubbed KV client + fresh limiters
// + pinned clock without monkey-patching module state.
// ---------------------------------------------------------------------------

export interface ProgressHandlerOverrides {
  kvClient?: KvClient
  getLimiter?: RateLimiter
  postLimiter?: RateLimiter
  now?: () => number
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handler(
  request: Request,
  overrides: ProgressHandlerOverrides = {},
): Promise<Response> {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  const limiterGet = overrides.getLimiter ?? getLimiter
  const limiterPost = overrides.postLimiter ?? postLimiter
  const now = overrides.now ?? Date.now

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    headers.set('Allow', 'GET, POST, OPTIONS')
    return jsonResponse({ error: 'method-not-allowed' }, 405, headers)
  }

  // Auth gate runs before any request parsing. 401 says "your bearer
  // token is wrong"; 500 says "PROGRESS_API_SECRET isn't configured at
  // all on the server". The two cases are distinguishable to the
  // browser only via status code (the message is identical) — that's
  // intentional, we don't echo internal config state.
  if (
    typeof process.env.PROGRESS_API_SECRET !== 'string' ||
    process.env.PROGRESS_API_SECRET.length === 0
  ) {
    return jsonResponse({ error: 'config-missing' }, 500, headers)
  }
  if (!isAuthorized(request)) {
    return jsonResponse({ error: 'unauthorized' }, 401, headers)
  }

  if (request.method === 'GET') {
    return handleGet(request, headers, limiterGet, now, overrides.kvClient)
  }
  return handlePost(request, headers, limiterPost, now, overrides.kvClient)
}

async function handleGet(
  request: Request,
  headers: Headers,
  limiter: RateLimiter,
  now: () => number,
  kvClient?: KvClient,
): Promise<Response> {
  // Pull deviceId from the query string. We deliberately don't accept
  // it as a path parameter because Vercel's `/api/<file>.ts` routing
  // doesn't support dynamic segments without an extra `[deviceId].ts`
  // file, and a query parameter is simpler.
  const url = new URL(request.url)
  const deviceId = url.searchParams.get('deviceId')
  if (!isValidDeviceId(deviceId)) {
    return jsonResponse({ error: 'invalid-deviceId' }, 400, headers)
  }

  // Rate limit by deviceId. Cold containers reset the bucket — that's
  // acceptable per the rationale in _rateLimit.ts: this is a soft
  // guardrail, not a security boundary.
  const limit = limiter.check(deviceId, now())
  if (!limit.allowed) {
    if (limit.retryAfterSec !== undefined) {
      headers.set('Retry-After', String(limit.retryAfterSec))
    }
    return jsonResponse({ error: 'rate-limited' }, 429, headers)
  }

  let record: ProgressCloudRecord | null
  try {
    record = await getProgress(deviceId, kvClient)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[api/progress] kv-get-failed', { message, stack })
    return jsonResponse({ error: 'kv-failed' }, 502, headers)
  }

  if (record === null) {
    // 404 here is NORMAL — first launch, fresh deviceId. The browser
    // catches this and proceeds with local-only state.
    return jsonResponse({ error: 'not-found' }, 404, headers)
  }

  return jsonResponse(
    {
      ok: true,
      blob: record.blob,
      lastModifiedISO: record.lastModifiedISO,
    },
    200,
    headers,
  )
}

async function handlePost(
  request: Request,
  headers: Headers,
  limiter: RateLimiter,
  now: () => number,
  kvClient?: KvClient,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse(
      { error: 'invalid-json', message: 'Body must be valid JSON.' },
      400,
      headers,
    )
  }

  if (!isPostBody(body)) {
    return jsonResponse(
      {
        error: 'invalid-body',
        message:
          'Body must be { deviceId, blob, lastModifiedISO } with a v4 UUID and a parseable ISO date.',
      },
      400,
      headers,
    )
  }

  const limit = limiter.check(body.deviceId, now())
  if (!limit.allowed) {
    if (limit.retryAfterSec !== undefined) {
      headers.set('Retry-After', String(limit.retryAfterSec))
    }
    return jsonResponse({ error: 'rate-limited' }, 429, headers)
  }

  try {
    await setProgress(
      body.deviceId,
      { blob: body.blob, lastModifiedISO: body.lastModifiedISO },
      kvClient,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[api/progress] kv-set-failed', { message, stack })
    return jsonResponse({ error: 'kv-failed' }, 502, headers)
  }

  return jsonResponse({ ok: true }, 200, headers)
}

/**
 * Vercel entrypoint. Same `{ fetch }` shape as /api/claude — see HISTORY
 * round 2 in api/claude.ts for the dispatch reasoning.
 */
export default { fetch: handler }

// Internal exports for tests
export { buildProgressKey }
