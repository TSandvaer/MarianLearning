// Browser-side helper for /api/claude.
// All Claude calls go through the Vercel function — never call Anthropic
// directly from the browser. The function is responsible for the API key.
//
// Wire shape lives in api/_types.ts and is shared with the function so the
// contract is defined once.

import type {
  ClaudeKind,
  ClaudeRequest,
  ClaudeResponse,
  ClaudeStubResponse,
  ClaudeErrorResponse,
} from '../../../api/_types'

export type {
  ClaudeKind,
  ClaudeRequest,
  ClaudeResponse,
  ClaudeStubResponse,
  ClaudeErrorResponse,
}

/** Endpoint URL. Defaults to the same-origin Vercel function path. Overridable
 *  via VITE_CLAUDE_API_ENDPOINT for unusual local setups (e.g. running the
 *  function on a different port via `vercel dev`). */
const ENDPOINT: string =
  import.meta.env.VITE_CLAUDE_API_ENDPOINT ?? '/api/claude'

/** Thrown when the function returns a non-2xx status or a malformed body.
 *  Callers should treat this as a transient failure and fall back to
 *  pre-canned content (per the "Claude is the brain, not the mouth" rule). */
export class ClaudeApiError extends Error {
  readonly status: number
  readonly code: ClaudeErrorResponse['error'] | 'network' | 'malformed'

  constructor(message: string, status: number, code: ClaudeApiError['code']) {
    super(message)
    this.name = 'ClaudeApiError'
    this.status = status
    this.code = code
  }
}

/** POST { kind, payload } to the Vercel function and return the parsed
 *  response. Throws ClaudeApiError on transport, status, or shape failures. */
export async function callClaude(
  kind: ClaudeKind,
  payload: unknown,
  options: { signal?: AbortSignal } = {},
): Promise<ClaudeStubResponse> {
  const body: ClaudeRequest = { kind, payload }

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    })
  } catch (err) {
    throw new ClaudeApiError(
      err instanceof Error ? err.message : 'fetch failed',
      0,
      'network',
    )
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new ClaudeApiError(
      'response was not valid JSON',
      response.status,
      'malformed',
    )
  }

  if (!response.ok) {
    const code = isErrorResponse(parsed) ? parsed.error : 'malformed'
    const message = isErrorResponse(parsed)
      ? (parsed.message ?? code)
      : 'request failed'
    throw new ClaudeApiError(message, response.status, code)
  }

  if (!isStubResponse(parsed)) {
    throw new ClaudeApiError(
      'unexpected response shape',
      response.status,
      'malformed',
    )
  }

  return parsed
}

function isErrorResponse(value: unknown): value is ClaudeErrorResponse {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.error === 'string'
}

function isStubResponse(value: unknown): value is ClaudeStubResponse {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    v.ok === true &&
    typeof v.kind === 'string' &&
    v.stub === true &&
    typeof v.note === 'string'
  )
}
