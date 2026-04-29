// /api/claude — Vercel Function. Server-side proxy for the Anthropic API.
//
// HISTORY
// -------
//  - 86c9gkm0c (initial) scaffolded the endpoint as a stub: validate the
//    body, presence-check the API key, return a placeholder.
//  - 86c9gr385 (Path A — server-side TTS pipeline) extends
//    `kind: 'session-start'` to optionally carry a session plan and have
//    every utterance rendered to MP3 server-side via Edge AnaNeural. The
//    stub success path is preserved for callers that don't pass a plan
//    (stumble-explanation, session-end, and any session-start that
//    pre-dates the real Claude prompt wiring).
//  - 86c9grnj4 (P1 hot-fix, round 1) removed a broken
//    `export const config = { runtime: 'nodejs' }` export. PR #32 merged
//    but production still 500'd FUNCTION_INVOCATION_FAILED on every
//    request — the round-1 hypothesis (runtime config shape) was wrong.
//  - 86c9grnj4 (P1 hot-fix, round 2) switched the default export from a
//    bare async function to `{ fetch: handler }` so `@vercel/node` would
//    route the Web `Request`/`Response` codepath instead of the legacy
//    `(IncomingMessage, ServerResponse)` fallback. Reading of the upstream
//    `shouldUseWebHandlers` dispatch logic
//    (https://github.com/vercel/vercel/blob/main/packages/node/src/serverless-functions/serverless-handler.mts)
//    confirmed the dispatch shape was correct. PR #34 merged but production
//    still 500'd — the dispatch shape was a real future-proofing fix but
//    not the actual root cause of the cold-start failure.
//  - 86c9grnj4 (P1 hot-fix, round 3 — THIS CHANGE) fixes the ACTUAL root
//    cause, identified empirically by reading Vercel function logs
//    (`vercel logs --status-code 500 --json --no-follow`) instead of by
//    further source-spelunking. The cold-start error reported by Node is
//    unambiguous:
//        Error [ERR_MODULE_NOT_FOUND]: Cannot find module
//        '/var/task/api/_types' imported from /var/task/api/claude.js
//    The function never reached the handler — it failed at module-load
//    when Node's ESM resolver tried to resolve the bare specifier
//    `'./_types'` from the compiled `claude.js`. With `"type": "module"`
//    in package.json, Vercel's `@vercel/node` builder emits ESM, and
//    Node ESM strict-resolution requires explicit file extensions on
//    relative imports — extension-less specifiers do NOT resolve. Source
//    code under `tsconfig.api.json`'s `moduleResolution: "bundler"` was
//    happy to write `'./_types'`, but the deployed runtime is not.
//
//    Fix: add `.js` to every relative import inside api/. TypeScript with
//    `moduleResolution: "bundler"` accepts the `.js` suffix and resolves
//    it back to the matching `.ts` source for type-checking. Vitest
//    (Vite-bundler resolution) accepts it too. So a single canonical
//    spelling — `'./_types.js'` — works in dev, test, and production.
//    Round 1 + round 2 changes are kept as defensive measures even
//    though neither was the root cause: the no-config-export silence is
//    the upstream-recommended shape, and `{ fetch: handler }` is the
//    correct dispatch hint going forward.
//
// ABSOLUTE RULE: ANTHROPIC_API_KEY is read here only. It must never reach
// the browser bundle. Do not echo, log, or include it in any response.
//
// Runtime: Web-standard fetch handler (the `fetch` export above is what
// triggers Vercel's Web `Request`/`Response` codepath, which in turn runs
// on the Node runtime by default for /api/*.ts entrypoints). The TTS
// pipeline imported from `_tts.ts` uses `globalThis.fetch` (Node 20+
// global), `Buffer` (Node global), and `process.env` (Node API) — all of
// which require Node. The runtime-assertion below catches the in-between
// case where Vercel's defaults flip to Edge in a future platform change
// but still resolve our imports (e.g. via Node-compat shims). It does
// NOT add coverage when the imports themselves fail under Edge — that's
// caught loudly at module-load anyway.
//
// Historical note: prior to ticket 86c9gvgjk the TTS pipeline imported
// the `ws` package to speak the Edge Read-Aloud WSS protocol. The Azure
// REST swap dropped that dependency from this codepath; the assertion's
// error message and the assertNodeRuntime() doc-comment were updated in
// the same PR to reflect the new dependency surface.

import Anthropic from '@anthropic-ai/sdk'

import {
  isClaudeRequest,
  type ClaudeErrorResponse,
  type ClaudeStubResponse,
  type SessionStartResponse,
} from './_types.js'
import { renderSessionAudio } from './_session.js'
import {
  generateSessionPlan,
  PlannerError,
  type PlannerAnthropicClient,
  type PlannerTrack,
} from './_planner.js'
import { createRateLimiter, type RateLimiter } from './_rateLimit.js'

/**
 * Cold-start runtime assertion. Throws at module load if the function is
 * not running on Node.
 *
 * Edge runtime: `globalThis.process` is undefined.
 * Node runtime: `process.versions.node` is always a string (e.g. "22.11.0").
 *
 * Caveat: this fires AFTER the static module imports above are resolved.
 * On a pure Edge runtime, `Buffer` and `process.env` accesses inside
 * `_tts.ts` would themselves fail first — so this assertion does NOT add
 * coverage there. What it DOES add coverage for is hybrid runtimes (Edge
 * with Node compat shims) or a future Vercel build target that resolves
 * the imports but still lacks `process.versions.node`. In those cases
 * the imports succeed but the function would later mis-behave; this
 * throw makes the failure loud and named at the top of the stack.
 *
 * Exported for unit-test coverage; the side effect is the runtime check
 * itself — calling `assertNodeRuntime()` from another file must produce
 * the same throw shape so the regression test is meaningful.
 */
export function assertNodeRuntime(): void {
  const nodeVersion = (
    globalThis as { process?: { versions?: { node?: string } } }
  ).process?.versions?.node
  if (typeof nodeVersion !== 'string') {
    throw new Error(
      '/api/claude must run on the Vercel Node runtime — `Buffer`, ' +
        '`process.env`, and `globalThis.fetch` (used by the TTS pipeline) ' +
        'all require Node. Check vercel.json and the Vercel project runtime ' +
        'setting; do not move this function to Edge.',
    )
  }
}

assertNodeRuntime()

// Origins allowed to hit this function. Local dev port + the Vercel
// deployment's own origin (provided as VERCEL_URL at runtime, without
// scheme — we add https://). Add additional origins via
// CLAUDE_API_EXTRA_ORIGINS (comma-separated) if needed in future.
function buildAllowedOrigins(): readonly string[] {
  const origins = new Set<string>(['http://localhost:5173'])

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) origins.add(`https://${vercelUrl}`)

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
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Access-Control-Max-Age', '86400')
  return headers
}

function jsonResponse(
  body: ClaudeStubResponse | SessionStartResponse | ClaudeErrorResponse,
  status: number,
  baseHeaders: Headers,
): Response {
  const headers = new Headers(baseHeaders)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  // Belt-and-braces: the function never returns content that should be cached
  // by an intermediary or the browser.
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers })
}

/** Pull a session plan out of the payload, if one was provided. The plan
 *  is opaque here — `_session.extractUtteranceTexts` is the single point
 *  that knows how to find utterance text inside a plan. */
function extractPlan(payload: unknown): unknown | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  if (!('plan' in p)) return null
  return p.plan
}

/** Track-based session-start payload (added ticket 86c9jdh39). When the
 *  caller doesn't ship a hand-built plan, they may instead ask the server
 *  to generate one via Haiku by passing { track, level, childName }. */
interface TrackPayload {
  track: PlannerTrack
  level: number
  childName: string
}

const VALID_TRACKS: readonly PlannerTrack[] = ['math', 'word-song']

/**
 * Extract the track/level/childName triple if the payload carries one.
 * Returns null if any field is missing or wrongly typed — the handler
 * falls through to the legacy stub path in that case (no breaking change
 * for callers that still pass `{ plan }`).
 *
 * Sanity: childName is also bounded — anything longer than 64 chars is
 * suspicious enough to reject (real first names don't go that long; an
 * over-long value is most likely a prompt-injection attempt or a bug).
 * Level is restricted to 1-9 since today only level 1 is implemented and
 * the prompt is forward-compatible up to 9.
 */
function extractTrackPayload(payload: unknown): TrackPayload | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  const track = p.track
  const level = p.level
  const childName = p.childName
  if (
    typeof track !== 'string' ||
    !VALID_TRACKS.includes(track as PlannerTrack)
  )
    return null
  if (
    typeof level !== 'number' ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > 9
  )
    return null
  if (
    typeof childName !== 'string' ||
    childName.length === 0 ||
    childName.length > 64
  )
    return null
  return { track: track as PlannerTrack, level, childName }
}

/**
 * Module-singleton rate limiter for session-start. Per-IP, in-memory.
 * Lives at module scope (not per-request) so that warm Vercel containers
 * accumulate state across invocations — see _rateLimit.ts header for the
 * limitation discussion (cold starts reset the bucket, multi-instance
 * deployments multiply the effective rate).
 *
 * Tunables: 6 requests / 60 seconds. Calibrated for the real "kid spams
 * F5 / brother runs the iPad in a loop" cases without inconveniencing the
 * legitimate "Marian started a session, was disrupted, restarted" case.
 */
const sessionStartLimiter: RateLimiter = createRateLimiter({
  limit: 6,
  windowMs: 60_000,
})

/** Best-effort source-IP extraction. Vercel sets `x-forwarded-for`. We
 *  fall back to `x-real-ip` and finally to a fixed string — a fixed
 *  fallback means all unidentifiable callers share one bucket, which is
 *  conservative (over-throttles) but safe. */
function extractSourceIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    // X-F-F can be a comma-separated chain; the leftmost is the original
    // client per the standard. Vercel adds its own proxy address last.
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/** Build a real Anthropic SDK client wrapped in the planner's narrowed
 *  interface. Kept as a factory so tests can inject a stub via the
 *  exported handler-level seam below. */
function buildAnthropicClient(): PlannerAnthropicClient {
  // Anthropic SDK reads ANTHROPIC_API_KEY from env automatically; we
  // already presence-checked it above the planner call.
  const sdk = new Anthropic()
  return {
    messages: {
      create: async (args) => {
        const message = await sdk.messages.create({
          model: args.model,
          max_tokens: args.max_tokens,
          system: args.system,
          messages: args.messages,
        })
        // Narrow the SDK's typed content blocks down to what the planner's
        // PlannerCreateResponse interface promises (just `type` + optional
        // `text`). Unknown-type blocks pass through with no `text` field,
        // and the planner's `extractText` skips them.
        return {
          content: message.content.map((block) =>
            block.type === 'text'
              ? { type: 'text', text: block.text }
              : { type: block.type },
          ),
        }
      },
    },
  }
}

/** Handler-level seams. Tests use these to inject a mock SDK client and a
 *  pinned clock without monkey-patching internal state. Exported only for
 *  the test file in the same module folder. */
export interface HandlerOverrides {
  /** Override the Anthropic SDK adapter. Defaults to a real
   *  `@anthropic-ai/sdk` client. */
  anthropicClient?: PlannerAnthropicClient
  /** Override the rate limiter. Defaults to the module-singleton. */
  rateLimiter?: RateLimiter
  /** Override the clock for rate-limit windowing. Defaults to Date.now(). */
  now?: () => number
}

/**
 * The actual request handler. Exported as a named symbol so tests can
 * import it directly; the Vercel entrypoint is the `default` export
 * below, which wraps this in a `{ fetch }` object so Vercel routes the
 * Web `Request`/`Response` codepath (see top-of-file HISTORY).
 *
 * @param overrides Test seams. In production, omit — the function uses
 *   the module-singleton rate limiter and a real Anthropic SDK client.
 */
export async function handler(
  request: Request,
  overrides: HandlerOverrides = {},
): Promise<Response> {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  const limiter = overrides.rateLimiter ?? sessionStartLimiter
  const now = overrides.now ?? Date.now

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (request.method !== 'POST') {
    headers.set('Allow', 'POST, OPTIONS')
    return jsonResponse({ error: 'method-not-allowed' }, 405, headers)
  }

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

  if (!isClaudeRequest(body)) {
    return jsonResponse(
      {
        error: 'invalid-body',
        message:
          'Body must be { kind: "session-start" | "stumble-explanation" | "session-end", payload: unknown }.',
      },
      400,
      headers,
    )
  }

  // Env check. Note: presence-only — never read or echo the value here.
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'config-missing' }, 500, headers)
  }

  // session-start branches:
  //   1. payload.plan present  → render TTS for the supplied plan
  //      (legacy v1 client path; preserved unchanged for backward compat).
  //   2. payload.track present → call Haiku to generate a plan, then
  //      render TTS (added ticket 86c9jdh39 — replaces the prior stub
  //      that produced silence on Math + WordSong in production).
  //   3. neither present       → legacy stub (200 with stub: true).
  //
  // Order matters: plan-attached requests bypass the rate limiter
  // entirely (no Claude call, just TTS — same cost surface as v1). Only
  // the new track-based path goes through the limiter, since that's the
  // one that costs Anthropic credits.
  if (body.kind === 'session-start') {
    const plan = extractPlan(body.payload)
    if (plan !== null) {
      try {
        const rendered = await renderSessionAudio(plan)
        return jsonResponse(rendered, 200, headers)
      } catch (err) {
        // Surface the failure in `vercel logs` so future tts-failed shapes
        // can be root-caused from stack traces instead of from the
        // response message alone (see ticket 86c9gwxah; the 86c9gwvn0 P0
        // investigation had to reason from message shape because this
        // catch path was silent). Log message + stack ONLY — never the
        // request body, payload, or any provider headers; the underlying
        // _tts module is responsible for never embedding the Azure key
        // in the error it throws, and we deliberately don't widen the
        // log surface here in case that contract ever slips.
        const message = err instanceof Error ? err.message : String(err)
        const stack = err instanceof Error ? err.stack : undefined
        console.error('[api/claude] tts-failed', { message, stack })

        // Don't leak provider internals — `tts-failed` is the stable
        // code; the browser falls back to a degraded session per
        // "Claude is the brain, not the mouth" / graceful-degradation
        // policy in CLAUDE.md.
        return jsonResponse(
          {
            error: 'tts-failed',
            message:
              err instanceof Error && err.message
                ? `tts pipeline failed: ${err.message}`
                : 'tts pipeline failed',
          },
          502,
          headers,
        )
      }
    }

    // Track-based branch: planner generates the plan via Haiku, then we
    // render TTS through the same _session pipeline.
    const trackPayload = extractTrackPayload(body.payload)
    if (trackPayload !== null) {
      // Per-IP rate limit. We honour the limiter BEFORE calling Anthropic
      // so a leaked share-link in a tight loop can't run up a bill.
      const ip = extractSourceIp(request)
      const result = limiter.check(ip, now())
      if (!result.allowed) {
        if (result.retryAfterSec !== undefined) {
          headers.set('Retry-After', String(result.retryAfterSec))
        }
        return jsonResponse(
          {
            error: 'rate-limited',
            message: 'too many session-start requests; please slow down',
          },
          429,
          headers,
        )
      }

      const client = overrides.anthropicClient ?? buildAnthropicClient()

      let plannedPlan
      try {
        plannedPlan = await generateSessionPlan({
          client,
          track: trackPayload.track,
          level: trackPayload.level,
          childName: trackPayload.childName,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const stack = err instanceof Error ? err.stack : undefined
        // Distinguish planner errors from generic upstream failures in
        // logs so the QA sweep can attribute correctly. Same discipline
        // as the tts-failed branch: log message + stack only, never
        // request body / headers / key fragments.
        console.error('[api/claude] planner-failed', { message, stack })
        // For PlannerError("config-missing") we map to 500 — that's a
        // server misconfiguration, not a client error. For everything
        // else (invalid-response, upstream-error, invalid-request) we
        // return 502, signalling "the request was fine but the upstream
        // dependency couldn't satisfy it" — the browser's path A code
        // treats this the same as tts-failed and falls back to silent
        // mode.
        if (err instanceof PlannerError && err.code === 'config-missing') {
          return jsonResponse({ error: 'config-missing' }, 500, headers)
        }
        return jsonResponse(
          {
            error: 'planner-failed',
            message: 'session plan generation failed',
          },
          502,
          headers,
        )
      }

      // Render audio for the planned plan. Same pipeline the v1 client
      // path uses — no fork in the audio code.
      try {
        const rendered = await renderSessionAudio(plannedPlan)
        return jsonResponse(rendered, 200, headers)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const stack = err instanceof Error ? err.stack : undefined
        console.error('[api/claude] tts-failed', { message, stack })
        return jsonResponse(
          {
            error: 'tts-failed',
            message:
              err instanceof Error && err.message
                ? `tts pipeline failed: ${err.message}`
                : 'tts pipeline failed',
          },
          502,
          headers,
        )
      }
    }
  }

  // Stub success path (unchanged from the prior contract). Stumble-
  // explanation and session-end are out of scope for ticket 86c9jdh39
  // and remain stubbed; session-start with neither plan nor track also
  // returns the stub for backward compat.
  return jsonResponse(
    {
      ok: true,
      kind: body.kind,
      stub: true,
      note: 'Claude API call not yet wired — see follow-up tickets',
    },
    200,
    headers,
  )
}

/**
 * Vercel entrypoint. The `fetch` property — NOT a bare default function —
 * is what makes `@vercel/node` invoke `handler` with Web standard
 * `Request`/`Response` instead of the legacy `(IncomingMessage,
 * ServerResponse)` signature. See top-of-file HISTORY (round 2 fix) for
 * the full reasoning and the upstream source link.
 */
export default { fetch: handler }
