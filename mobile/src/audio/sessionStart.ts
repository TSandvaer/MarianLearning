/**
 * `/api/claude` session-start → session audio on disk.
 *
 * The native counterpart of the request/response half of the web's
 * `mathPathA.ts` / `wordSongPathA.ts`. The caller (a Phase 3 screen or the
 * Hub prefetch) builds the `session-start` payload exactly as the web does
 * (`track`, `level`, `childName`, the progress hints); this module POSTs it
 * through core's `apiUrl()`, validates the response with core's
 * `isSessionStartResponse`, writes the audio (`loadSessionAudio`) and hands
 * back the raw plan for the screen to rehydrate with core's
 * `mathSessionPlanFromServer` / Word Song adapter. The response object
 * (with its ~1.7 MB of base64) is not retained.
 *
 * Failures throw `SessionStartError` with the web's codes; the caller falls
 * back to a static plan and silent captions, as on the web. The Claude key
 * never reaches the app: `/api/claude` is the Vercel function.
 */
import { apiUrl } from '@marian/core/platform/apiUrl'
import {
  isSessionStartResponse,
  type ClaudeRequest,
  type SessionStartResponse,
} from '@marian/core/wire/types'
import { recordAudio } from './audioLog'
import {
  loadSessionAudio,
  type LoadedSessionAudio,
  type SessionAudioDeps,
} from './sessionAudio'

export const CLAUDE_ENDPOINT = '/api/claude'

export type SessionTrack = 'math' | 'word-song'

/** The `payload` of a `session-start` request (web shape). */
export type SessionStartPayload = { track: SessionTrack } & Record<
  string,
  unknown
>

export interface SessionStartArgs {
  /** Stable id; names the session's cache directory. */
  sessionId: string
  payload: SessionStartPayload
  signal?: AbortSignal
}

export interface PreparedSession {
  sessionId: string
  track: SessionTrack
  /** The server's flat plan, for core's plan adapters. */
  plan: unknown
  currentTargetVowel?: SessionStartResponse['currentTargetVowel']
  audio: LoadedSessionAudio
  /** Request start → parsed response. */
  fetchMs: number
}

/** Same codes as the web's `PrepareMathPathAErrorCode`. */
export type SessionStartErrorCode =
  | 'config-missing'
  | 'tts-failed'
  | 'rate-limited'
  | 'planner-failed'
  | 'invalid-response'
  | 'network-error'
  | 'aborted'

export class SessionStartError extends Error {
  readonly code: SessionStartErrorCode
  constructor(code: SessionStartErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'SessionStartError'
  }
}

const SERVER_CODES: readonly SessionStartErrorCode[] = [
  'config-missing',
  'tts-failed',
  'rate-limited',
  'planner-failed',
]

export interface SessionStartDeps extends SessionAudioDeps {
  fetch?: typeof fetch
}

const isAbort = (err: unknown) =>
  err instanceof Error &&
  (err.name === 'AbortError' || err.name === 'TimeoutError')

export async function startSession(
  args: SessionStartArgs,
  deps: SessionStartDeps = {},
): Promise<PreparedSession> {
  const fetchImpl = deps.fetch ?? fetch
  const now = deps.now ?? Date.now
  const body: ClaudeRequest = { kind: 'session-start', payload: args.payload }
  const t0 = now()

  let response: Response
  try {
    response = await fetchImpl(apiUrl(CLAUDE_ENDPOINT), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: args.signal,
    })
  } catch (err) {
    if (isAbort(err) || args.signal?.aborted) {
      throw new SessionStartError('aborted', 'session-start aborted')
    }
    throw new SessionStartError(
      'network-error',
      `session-start fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch (err) {
    if (isAbort(err) || args.signal?.aborted) {
      throw new SessionStartError('aborted', 'session-start aborted')
    }
    throw new SessionStartError(
      'invalid-response',
      `session-start response was not JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!response.ok) {
    const code =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? (parsed as { error: unknown }).error
        : undefined
    const known = SERVER_CODES.find((c) => c === code)
    throw new SessionStartError(
      known ?? 'invalid-response',
      `session-start returned ${response.status}${known ? ` (${known})` : ''}`,
    )
  }
  if (!isSessionStartResponse(parsed)) {
    throw new SessionStartError(
      'invalid-response',
      'session-start response did not match SessionStartResponse',
    )
  }
  const fetchMs = now() - t0
  recordAudio({
    kind: 'session-load',
    label: `session-fetch ${args.payload.track}`,
    ms: fetchMs,
    detail: `${parsed.utterances.length} utterances`,
  })

  // An abandoned request (prefetch discarded, timeout fallback) must not
  // replace the session audio that superseded it (web 123jpnbc3dh).
  if (args.signal?.aborted) {
    throw new SessionStartError('aborted', 'session-start aborted before load')
  }
  const audio = loadSessionAudio(args.sessionId, parsed.utterances, deps)

  return {
    sessionId: args.sessionId,
    track: args.payload.track,
    plan: parsed.plan,
    currentTargetVowel: parsed.currentTargetVowel,
    audio,
    fetchMs,
  }
}
