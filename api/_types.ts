// Shared request/response shapes for the /api/claude Vercel function.
// Imported by both the function (server) and the browser-side client helper
// so that the wire contract is defined in exactly one place.
//
// This file lives in the api/ directory under a leading-underscore filename
// so Vercel does not expose it as an HTTP route (Vercel treats `_*` files in
// api/ as private). See https://vercel.com/docs/functions.

/** The three points in a session where we call Claude. See CLAUDE.md. */
export type ClaudeKind = 'session-start' | 'stumble-explanation' | 'session-end'

/** POST body for /api/claude. The payload shape is per-kind and is defined
 *  in follow-up tickets that wire real prompts. Until then it is `unknown`. */
export interface ClaudeRequest {
  kind: ClaudeKind
  payload: unknown
}

/** Successful stub response. Once the real prompt is wired, the function
 *  will return the parsed Claude completion in addition to (or instead of)
 *  these fields. The `stub` flag lets callers light-touch detect the
 *  pre-wiring placeholder. */
export interface ClaudeStubResponse {
  ok: true
  kind: ClaudeKind
  stub: true
  note: string
}

/** Error response shape. `error` is a stable machine-readable code; `message`
 *  is optional human-readable detail (never echoes the request body, never
 *  leaks env state). */
export interface ClaudeErrorResponse {
  ok?: false
  error:
    | 'method-not-allowed'
    | 'invalid-body'
    | 'invalid-json'
    | 'config-missing'
  message?: string
}

export type ClaudeResponse = ClaudeStubResponse | ClaudeErrorResponse

const VALID_KINDS: readonly ClaudeKind[] = [
  'session-start',
  'stumble-explanation',
  'session-end',
]

/** Type guard for ClaudeRequest. Strict — rejects extra-typed but
 *  malformed bodies (wrong kind string, missing payload key). */
export function isClaudeRequest(value: unknown): value is ClaudeRequest {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.kind !== 'string') return false
  if (!VALID_KINDS.includes(v.kind as ClaudeKind)) return false
  if (!('payload' in v)) return false
  return true
}
