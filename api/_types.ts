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

// --- Session audio types -------------------------------------------------
//
// Added in ticket 86c9gr385 (Path A — server-side TTS pipeline). The
// session-start response carries pre-rendered MP3 audio per utterance so
// the iPad never depends on Web Speech for dynamic Claude-generated lines.
//
// Shape rationale
// ---------------
// `Utterance` is { id, text, audio }. The `id` is a stable string the
// caller (Math / Word Song screens) uses to look up the audio at playback
// time. `audio` is a discriminated union so we can extend later with a CDN
// URL variant (`{ kind: 'url'; href: string }`) without breaking the wire.
//
// We intentionally keep this scoped to the response payload; no shared
// session-plan type lives here yet because the consumer screens (Math,
// Word Song) don't exist. When they land, the broader session-plan shape
// will move into a shared module — for now we keep the surface narrow.

/** A single audio reference. Currently only inline base64 is shipped. */
export type AudioRef = {
  kind: 'inline'
  /** Base64-encoded audio bytes (no data: prefix). */
  base64: string
  /** Always `audio/mpeg` for the Edge-AnaNeural pipeline. */
  mime: 'audio/mpeg'
}

/** A line Melody speaks, paired with its pre-rendered audio. */
export interface Utterance {
  /** Stable identifier the consumer uses to look up + play this audio. */
  id: string
  /** Spoken text. The frontend's caption layer uses this; it MUST match
   *  what was synthesized. */
  text: string
  /** Audio bundle. */
  audio: AudioRef
}

/** session-start response payload — the Claude session plan plus its
 *  rendered audio. The `plan` field's exact shape will be tightened in a
 *  follow-up ticket that wires the real Claude prompt; for now it's the
 *  raw plan blob from Claude (or a stub) plus the flat utterance list. */
export interface SessionStartResponse {
  ok: true
  kind: 'session-start'
  plan: unknown
  utterances: Utterance[]
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
    | 'tts-failed'
    /** Per-IP rate limit hit on session-start (added ticket 86c9jdh39 — guards
     *  against runaway billing if the share-link leaks). Browser path A code
     *  treats this like other failure codes and falls back to silent mode. */
    | 'rate-limited'
    /** Anthropic planner call failed: model returned malformed JSON, the
     *  upstream SDK errored, or the request shape was rejected (e.g. unknown
     *  track). Distinct from `tts-failed` so logs can attribute correctly.
     *  Added ticket 86c9jdh39. */
    | 'planner-failed'
  message?: string
}

export type ClaudeResponse =
  | ClaudeStubResponse
  | SessionStartResponse
  | ClaudeErrorResponse

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

/** Type guard for SessionStartResponse — used by the browser client to
 *  pick the right success branch. */
export function isSessionStartResponse(
  value: unknown,
): value is SessionStartResponse {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (v.ok !== true || v.kind !== 'session-start') return false
  if (!Array.isArray(v.utterances)) return false
  for (const u of v.utterances) {
    if (!isUtterance(u)) return false
  }
  return true
}

export function isUtterance(value: unknown): value is Utterance {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.text !== 'string') return false
  const a = v.audio as Record<string, unknown> | undefined
  if (!a || typeof a !== 'object') return false
  if (a.kind !== 'inline') return false
  if (typeof a.base64 !== 'string') return false
  if (a.mime !== 'audio/mpeg') return false
  return true
}
