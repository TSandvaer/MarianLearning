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
//  - 86c9grnj4 (this change — P1 hot-fix) removes a broken
//    `export const config = { runtime: 'nodejs' }` that caused
//    FUNCTION_INVOCATION_FAILED on every request. The Vercel /api/*.ts
//    file format does NOT recognise `runtime: 'nodejs'` as a valid value
//    in the `config` export (that shape is the Next.js middleware
//    convention; for plain /api functions the Node runtime IS the
//    default and no config export is needed). The intended tripwire —
//    "fail loud at cold-start if a future maintainer pushes us onto
//    Edge" — is reimplemented below as a real runtime assertion that
//    cannot be bypassed by a config-shape misunderstanding.
//
// ABSOLUTE RULE: ANTHROPIC_API_KEY is read here only. It must never reach
// the browser bundle. Do not echo, log, or include it in any response.
//
// Runtime: Web-standard fetch handler. The TTS pipeline imported from
// `_tts.ts` uses the `ws` package + `node:crypto`, both of which require
// Vercel's Node runtime (Edge is V8 isolates with no Node built-ins).
// /api/*.ts defaults to Node on Vercel; the assertion below is the
// belt-and-braces guard against a future project-wide vercel.json or
// platform default flip silently moving us to Edge.

import {
  isClaudeRequest,
  type ClaudeErrorResponse,
  type ClaudeStubResponse,
  type SessionStartResponse,
} from './_types'
import { renderSessionAudio } from './_session'

/**
 * Cold-start runtime assertion. Throws at module load if the function is
 * not running on Node.
 *
 * Caveat: this fires AFTER the static `import { WebSocket } from 'ws'` and
 * `node:crypto` imports above are resolved. On a pure Edge runtime those
 * imports would themselves fail first with "Cannot find module 'ws'" — so
 * this assertion does NOT add coverage there. What it DOES add coverage
 * for is the in-between cases that exist in the Vercel ecosystem: hybrid
 * runtimes (Edge with Node compat shims), partial polyfills, or a future
 * Vercel build target that resolves the imports but still lacks
 * `process.versions.node`. In those cases the imports succeed but the
 * function would later mis-behave; this throw makes the failure loud and
 * named at the top of the stack.
 *
 * Edge runtime: `globalThis.process` is undefined.
 * Node runtime: `process.versions.node` is always a string (e.g. "22.11.0").
 *
 * Exported for unit-test coverage; the side effect is the runtime check
 * itself — calling `assertNodeRuntime()` from another file must produce the
 * same throw shape so the regression test is meaningful.
 */
export function assertNodeRuntime(): void {
  const nodeVersion = (
    globalThis as { process?: { versions?: { node?: string } } }
  ).process?.versions?.node
  if (typeof nodeVersion !== 'string') {
    throw new Error(
      '/api/claude must run on the Vercel Node runtime — `ws` and `node:crypto` ' +
        'imports require Node. Check vercel.json and the Vercel project runtime ' +
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

export default async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)

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

  // session-start with a plan attached → render audio and return the
  // SessionStartResponse. Real Claude prompt wiring (which produces the
  // plan in the first place) is a follow-up ticket; until then the
  // browser can pass its own plan to exercise the audio pipeline.
  if (body.kind === 'session-start') {
    const plan = extractPlan(body.payload)
    if (plan !== null) {
      try {
        const rendered = await renderSessionAudio(plan)
        return jsonResponse(rendered, 200, headers)
      } catch (err) {
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
  }

  // Stub success path (unchanged from the prior contract). Real Claude
  // call is wired in a follow-up ticket.
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
