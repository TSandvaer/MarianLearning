// Server-side TTS using Azure Speech REST.
//
// Why this exists
// ---------------
// PR #25 (ticket 86c9gqprh) shipped pre-recorded MP3s for the four fixed
// Greet lines using `en-US-AnaNeural` at rate -10% via the Python `edge-tts`
// CLI. Math, Word Song, and any future per-session utterance is dynamic
// (Claude-generated per session) and cannot be pre-recorded. This module
// renders those dynamic lines at session-start time using the same voice.
//
// HISTORY
// -------
//  - 86c9gr385 (Path A — server-side TTS pipeline): first impl reused the
//    free Edge Read-Aloud WSS endpoint
//    (wss://speech.platform.bing.com/...) — the same protocol the Python
//    `edge-tts` package speaks. The choice was empirically wrong: from
//    Vercel's serverless egress (arn1/iad1) the WSS handshake times out at
//    8000ms across cold and warm invocations, plan sizes, and retries. Root
//    cause is most likely a Vercel plan-level outbound WSS restriction or a
//    Microsoft block-list on Vercel egress IPs. Either way the failure
//    class is structural — no amount of timeout tuning fixes it.
//    See ticket 86c9gv8um for the diagnostic write-up.
//  - 86c9gvgjk (THIS CHANGE — Plan B lock-in): swap the entire transport
//    layer to Azure Speech REST. Same voice (en-US-AnaNeural in Azure's
//    official catalog), same output format (audio-24khz-48kbitrate-mono-mp3),
//    same wire shape exposed to the caller (Uint8Array MP3 bytes). Plain
//    HTTPS — no WSS, no Sec-MS-GEC token, no reverse-engineered protocol.
//    Cost: $0/month within Azure F0 free tier.
//
// IMPORTANT: this is a server-side module ONLY. It reads
// `process.env.AZURE_SPEECH_KEY` and `process.env.AZURE_SPEECH_REGION`.
// Never import from the browser bundle — `tsconfig.api.json` keeps it
// scoped to `api/`.

const AZURE_TTS_PATH = '/cognitiveservices/v1'

/** Output format header value. Matches what the Greet pre-recorded MP3s use
 *  and what the client decoder expects. Do not change without coordinating
 *  with the iPad audio path. */
const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'

/** User-Agent — Azure logs reject empty/clearly-bot UAs on some regions.
 *  The value itself doesn't matter for billing; this just identifies us in
 *  the Azure portal's diagnostic logs. */
const USER_AGENT = 'marian-tutor/1.0 (+marian-learning.vercel.app)'

/** Default per-utterance hard timeout. 8s matches the prior WSS contract;
 *  Azure REST typically responds in <1s so this is comfortable headroom. */
const DEFAULT_TIMEOUT_MS = 8_000

/** Voice config for a single utterance. */
export interface TtsRequest {
  /** Plain text to synthesize. Will be XML-escaped before embedding in SSML. */
  text: string
  /** Voice short-name, e.g. `en-US-AnaNeural`. */
  voice: string
  /** Prosody rate, e.g. `'-10%'`, `'+0%'`, `'+5%'`. */
  rate: string
  /** Prosody pitch, e.g. `'+0Hz'`, `'+5Hz'`. */
  pitch: string
  /** Prosody volume, e.g. `'+0%'`. */
  volume: string
}

export interface TtsResult {
  /** MP3 audio bytes (audio/mpeg). */
  audio: Uint8Array
}

/** Server-side env-var snapshot. Pulled at synthesize-time so a deploy that
 *  forgot to set the vars fails loud per request rather than at module-load
 *  (where it would mask the cold-start error in `/api/claude` behind a
 *  generic FUNCTION_INVOCATION_FAILED). */
export interface AzureCredentials {
  key: string
  region: string
}

/** Read Azure credentials from process.env. Exported for unit tests; the
 *  production path calls this implicitly inside synthesizeUtterance. */
export function readAzureCredentials(
  env: NodeJS.ProcessEnv = process.env,
): AzureCredentials {
  const key = env.AZURE_SPEECH_KEY
  const region = env.AZURE_SPEECH_REGION
  if (!key || typeof key !== 'string') {
    throw new Error(
      'tts misconfigured: AZURE_SPEECH_KEY is not set in the function environment',
    )
  }
  if (!region || typeof region !== 'string') {
    throw new Error(
      'tts misconfigured: AZURE_SPEECH_REGION is not set in the function environment',
    )
  }
  return { key, region }
}

/** Build the Azure TTS endpoint URL for a given region. */
export function buildAzureEndpoint(region: string): string {
  return `https://${region}.tts.speech.microsoft.com${AZURE_TTS_PATH}`
}

/** XML-escape a string for safe embedding in SSML. */
export function escapeSsml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Build the SSML body sent to Azure. All four prosody attribute fields
 *  (voice/rate/pitch/volume) are XML-escaped in addition to `text`. Today
 *  these all come from the hardcoded `MELODY_VOICE_CONFIG`, but the
 *  function is exported and `TtsRequest` accepts arbitrary strings —
 *  escaping is cheap defense-in-depth against a future caller passing
 *  user-derived prosody values into a single-quoted attribute slot.
 *
 *  `xml:lang="en-US"` is set on the speak element per Azure docs; the
 *  service is more strict about this than the old Edge endpoint was. */
export function buildSsmlBody(req: TtsRequest): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">` +
    `<voice name="${escapeSsml(req.voice)}">` +
    `<prosody pitch="${escapeSsml(req.pitch)}" rate="${escapeSsml(req.rate)}" volume="${escapeSsml(req.volume)}">` +
    `${escapeSsml(req.text)}` +
    `</prosody></voice></speak>`
  )
}

/** Map an upstream non-2xx into a stable, named Error. The outer
 *  `_session.ts` and `claude.ts` both wrap this in the public `tts-failed`
 *  response shape; the message text is preserved for log diagnosis but is
 *  not user-facing and does not echo any secret value. */
export function describeAzureFailure(status: number, bodyHint: string): Error {
  const trimmed = bodyHint.trim().slice(0, 200)
  // 401 is almost always a stale or wrong AZURE_SPEECH_KEY. 403 likewise
  // (region/key mismatch counts as auth-shaped). 429 is rate-limit (F0
  // tier ceiling or burst control). 5xx is upstream — retry-class.
  if (status === 401 || status === 403) {
    return new Error(`tts auth failed (${status}): check AZURE_SPEECH_KEY`)
  }
  if (status === 429) {
    return new Error(`tts rate limited (429): Azure throttled the request`)
  }
  if (status >= 500 && status < 600) {
    return new Error(
      `tts upstream error (${status}): Azure returned 5xx${trimmed ? ` — ${trimmed}` : ''}`,
    )
  }
  return new Error(`tts http error (${status})${trimmed ? `: ${trimmed}` : ''}`)
}

/** Test seam — a fetch-shaped function. Defaults to `globalThis.fetch`. */
export type FetchFn = typeof fetch

export interface SynthesizeOptions {
  /** Test seam: fetch implementation. Defaults to `globalThis.fetch`. */
  fetchFn?: FetchFn
  /** Hard timeout for a single utterance in ms. Defaults to 8s. */
  timeoutMs?: number
  /** Test seam: schedule a timeout. Defaults to setTimeout. */
  setTimeoutFn?: (cb: () => void, ms: number) => unknown
  /** Test seam: cancel a timeout. Defaults to clearTimeout. */
  clearTimeoutFn?: (handle: unknown) => void
  /** Test seam: env snapshot. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv
}

/**
 * Synthesize one utterance via Azure Speech REST. POSTs an SSML body to
 * `https://{region}.tts.speech.microsoft.com/cognitiveservices/v1` with
 * `Ocp-Apim-Subscription-Key` auth and the standard 24kHz/48kbps mono MP3
 * output format header. Resolves with the response body bytes; rejects on
 * non-2xx with a named error (`describeAzureFailure`) or on timeout.
 *
 * One HTTPS call per utterance — same dispatch shape as the prior WSS
 * implementation. The fan-out / concurrency cap lives in `_session.ts`.
 */
export async function synthesizeUtterance(
  req: TtsRequest,
  opts: SynthesizeOptions = {},
): Promise<TtsResult> {
  const fetchFn = opts.fetchFn ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const scheduleTimeout = opts.setTimeoutFn ?? ((cb, ms) => setTimeout(cb, ms))
  const cancelTimeout =
    opts.clearTimeoutFn ??
    ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))

  if (typeof fetchFn !== 'function') {
    throw new Error(
      'tts misconfigured: globalThis.fetch is not available — is this running on the Vercel Node runtime?',
    )
  }

  const { key, region } = readAzureCredentials(opts.env)
  const endpoint = buildAzureEndpoint(region)
  const body = buildSsmlBody(req)

  // AbortController gives us a cancellation handle the fetch implementation
  // honours natively. We wrap it in the existing setTimeout/clearTimeout
  // seam so the timeout test can run synchronously without real timers.
  const controller = new AbortController()
  let timedOut = false
  const timeoutHandle = scheduleTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  let response: Response
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
        'User-Agent': USER_AGENT,
      },
      body,
      signal: controller.signal,
    })
  } catch (err) {
    cancelTimeout(timeoutHandle)
    if (timedOut) {
      throw new Error(`tts timeout after ${timeoutMs}ms`, { cause: err })
    }
    throw err instanceof Error ? err : new Error(String(err), { cause: err })
  }

  cancelTimeout(timeoutHandle)

  if (!response.ok) {
    // Drain the body so the underlying socket can be reused; capture the
    // first 200 chars for the named-error message but never log the auth
    // header value.
    let bodyHint = ''
    try {
      bodyHint = await response.text()
    } catch {
      // best-effort
    }
    throw describeAzureFailure(response.status, bodyHint)
  }

  const buf = await response.arrayBuffer()
  return { audio: new Uint8Array(buf) }
}

/** Encode a Uint8Array as base64. Server-side only — uses Node's Buffer. */
export function uint8ToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}
