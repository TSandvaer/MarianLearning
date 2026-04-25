// Server-side TTS using Microsoft's free Edge Read-Aloud endpoint.
//
// Why this exists
// ---------------
// PR #25 (ticket 86c9gqprh) shipped pre-recorded MP3s for the four fixed
// Greet lines using `en-US-AnaNeural` at rate -10% via the Python `edge-tts`
// CLI. Math, Word Song, and any future per-session utterance is dynamic
// (Claude-generated per session) and cannot be pre-recorded. This module
// reimplements the same protocol in Node so the Vercel session-generation
// function can mint AnaNeural audio for every utterance in a session plan
// at session-start time.
//
// Protocol references — derived from the Python `edge-tts` package
// (https://github.com/rany2/edge-tts), specifically `communicate.py`,
// `constants.py`, and `drm.py`. No API key is required: the
// TrustedClientToken below is the public token Edge ships with for the
// free read-aloud endpoint, and Sec-MS-GEC is computed locally.
//
// IMPORTANT: this is a server-side module ONLY. It uses the `ws` package
// and Node's `crypto.subtle`. Never import from the browser bundle —
// `tsconfig.api.json` keeps it scoped to `api/`.

import { WebSocket } from 'ws'
import { createHash, randomUUID } from 'node:crypto'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS_URL_BASE =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'

// Windows file-time epoch offset (1601-01-01) vs Unix epoch (1970-01-01),
// in seconds. See drm.py — Sec-MS-GEC is a SHA-256 of "<ticks>"+token where
// ticks is in 100-ns units of Windows file time, rounded down to the nearest
// 5-minute boundary.
const WIN_EPOCH_SECONDS = 11_644_473_600
const SEC_MS_GEC_VERSION = '1-143.0.3650.75'

// Edge's User-Agent string — the service does some basic UA sniffing so we
// match what the Python lib sends.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.3650.75'

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
  /** Concatenated MP3 audio bytes (audio/mpeg). */
  audio: Uint8Array
}

/** Generates the Sec-MS-GEC token used to authenticate against the free
 *  Edge read-aloud endpoint. Pure function — easy to test. */
export function generateSecMsGec(nowMs: number = Date.now()): string {
  const unixSeconds = Math.floor(nowMs / 1000)
  const winSeconds = unixSeconds + WIN_EPOCH_SECONDS
  // Round DOWN to nearest 5-minute (300s) boundary.
  const rounded = winSeconds - (winSeconds % 300)
  // Convert to 100-ns ticks. We must avoid floating-point precision loss for
  // the multiply — use BigInt.
  const ticks = BigInt(rounded) * 10_000_000n
  const toHash = `${ticks.toString()}${TRUSTED_CLIENT_TOKEN}`
  return createHash('sha256').update(toHash).digest('hex').toUpperCase()
}

/** XML-escape a string for safe embedding in SSML.  */
export function escapeSsml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Build the WSS URL with required query params. */
export function buildWssUrl(
  connectionId: string,
  nowMs: number = Date.now(),
): string {
  const params = new URLSearchParams({
    TrustedClientToken: TRUSTED_CLIENT_TOKEN,
    ConnectionId: connectionId.replace(/-/g, ''),
    'Sec-MS-GEC': generateSecMsGec(nowMs),
    'Sec-MS-GEC-Version': SEC_MS_GEC_VERSION,
  })
  return `${WSS_URL_BASE}?${params.toString()}`
}

/** Build the speech.config message sent right after WS connect. */
export function buildSpeechConfigMessage(): string {
  const config = {
    context: {
      synthesis: {
        audio: {
          metadataoptions: {
            sentenceBoundaryEnabled: 'false',
            wordBoundaryEnabled: 'false',
          },
          outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
        },
      },
    },
  }
  return (
    `X-Timestamp:${new Date().toISOString()}\r\n` +
    `Content-Type:application/json; charset=utf-8\r\n` +
    `Path:speech.config\r\n\r\n` +
    JSON.stringify(config)
  )
}

/** Build the SSML message for a single utterance. All four attribute fields
 *  (voice/rate/pitch/volume) are XML-escaped in addition to `text`. Today
 *  these all come from the hardcoded `MELODY_VOICE_CONFIG`, but
 *  `buildSsmlMessage` is exported and `TtsRequest` accepts arbitrary strings
 *  — escaping is cheap defense-in-depth against a future caller passing
 *  user-derived prosody values into a single-quoted attribute slot. */
export function buildSsmlMessage(req: TtsRequest, requestId: string): string {
  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${escapeSsml(req.voice)}'>` +
    `<prosody pitch='${escapeSsml(req.pitch)}' rate='${escapeSsml(req.rate)}' volume='${escapeSsml(req.volume)}'>` +
    `${escapeSsml(req.text)}` +
    `</prosody></voice></speak>`
  // X-Timestamp must be a single ISO-8601 + Z, not double-Z. `toISOString()`
  // already terminates with Z; an earlier draft of this file appended a second
  // Z and the Edge endpoint silently tolerated it. Match the speech.config
  // message format above (and edge-tts/communicate.py upstream).
  return (
    `X-RequestId:${requestId.replace(/-/g, '')}\r\n` +
    `Content-Type:application/ssml+xml\r\n` +
    `X-Timestamp:${new Date().toISOString()}\r\n` +
    `Path:ssml\r\n\r\n` +
    ssml
  )
}

/** Parse `\r\n`-separated `key:value` header lines into a record. Shared
 *  between the binary-frame parser (where headers live in a length-prefixed
 *  block) and the text-frame parser (where headers live before `\r\n\r\n`). */
function parseHeaderBlock(headerText: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of headerText.split('\r\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
  }
  return headers
}

/** Parse a binary frame returned by the service. The first 2 bytes are a
 *  big-endian uint16 giving the header length; headers are then `\r\n`-
 *  separated `key:value` pairs; payload starts at offset 2 + headerLength. */
export function parseBinaryFrame(buf: Uint8Array): {
  headers: Record<string, string>
  payload: Uint8Array
} {
  if (buf.length < 2) {
    return { headers: {}, payload: new Uint8Array(0) }
  }
  const headerLength = (buf[0]! << 8) | buf[1]!
  const headerBytes = buf.subarray(2, 2 + headerLength)
  const headerText = Buffer.from(headerBytes).toString('utf8')
  const headers = parseHeaderBlock(headerText)
  const payload = buf.subarray(2 + headerLength)
  return { headers, payload }
}

/** Parse a text frame: headers separated from body by `\r\n\r\n`. If the
 *  separator is missing, the whole string is treated as headers (the body is
 *  optional for our purposes — we only ever read `Path`). */
export function parseTextFrame(text: string): {
  headers: Record<string, string>
  body: string
} {
  const sep = text.indexOf('\r\n\r\n')
  if (sep < 0) {
    return { headers: parseHeaderBlock(text), body: '' }
  }
  return {
    headers: parseHeaderBlock(text.slice(0, sep)),
    body: text.slice(sep + 4),
  }
}

/** Minimal duck-type for the WebSocket we depend on. Lets tests inject a
 *  fake without spinning up a real WS server. */
export interface WebSocketLike {
  send: (data: string | Uint8Array) => void
  close: () => void
  readonly readyState: number
  on(event: 'open', listener: () => void): unknown
  on(event: 'message', listener: (data: Buffer | ArrayBuffer) => void): unknown
  on(event: 'error', listener: (err: Error) => void): unknown
  on(event: 'close', listener: () => void): unknown
}

export type WebSocketFactory = (url: string) => WebSocketLike

/** Default factory using the `ws` package. Tests inject their own. */
export const defaultWebSocketFactory: WebSocketFactory = (url) => {
  return new WebSocket(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  }) as unknown as WebSocketLike
}

export interface SynthesizeOptions {
  /** Test seam: WebSocket factory. Defaults to `defaultWebSocketFactory`. */
  webSocketFactory?: WebSocketFactory
  /** Test seam: clock used for Sec-MS-GEC. Defaults to `Date.now`. */
  now?: () => number
  /** Test seam: connection ID. Defaults to `crypto.randomUUID()`. */
  connectionId?: string
  /** Test seam: per-utterance request ID. Defaults to `crypto.randomUUID()`. */
  requestId?: string
  /** Hard timeout for a single utterance in ms. Defaults to 8s. */
  timeoutMs?: number
  /** Test seam: schedule a timeout. Defaults to setTimeout. */
  setTimeoutFn?: (cb: () => void, ms: number) => unknown
  /** Test seam: cancel a timeout. Defaults to clearTimeout. */
  clearTimeoutFn?: (handle: unknown) => void
}

/**
 * Synthesize one utterance. Opens a WSS to the Edge endpoint, sends the
 * speech.config + SSML messages, accumulates `audio` binary frames, and
 * resolves with the concatenated MP3 bytes once `Path:turn.end` is seen.
 *
 * One WSS per utterance is the simple, correct shape: the protocol allows
 * multiplexing requests over a single socket, but our parallelism is bound
 * by the Vercel function's CPU and the endpoint's per-IP concurrency, not
 * by socket count, and a fresh socket per utterance keeps error handling
 * tractable. Connection setup is ~50ms — negligible inside our 10s budget.
 */
export function synthesizeUtterance(
  req: TtsRequest,
  opts: SynthesizeOptions = {},
): Promise<TtsResult> {
  const factory = opts.webSocketFactory ?? defaultWebSocketFactory
  const now = opts.now ?? (() => Date.now())
  const connectionId = opts.connectionId ?? randomUUID()
  const requestId = opts.requestId ?? randomUUID()
  const timeoutMs = opts.timeoutMs ?? 8_000
  const scheduleTimeout = opts.setTimeoutFn ?? ((cb, ms) => setTimeout(cb, ms))
  const cancelTimeout =
    opts.clearTimeoutFn ??
    ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))

  return new Promise<TtsResult>((resolve, reject) => {
    const url = buildWssUrl(connectionId, now())
    const ws = factory(url)
    const audioChunks: Uint8Array[] = []
    let settled = false
    let timeoutHandle: unknown = null

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      if (timeoutHandle !== null) {
        cancelTimeout(timeoutHandle)
        timeoutHandle = null
      }
      try {
        ws.close()
      } catch {
        // best effort
      }
      fn()
    }

    timeoutHandle = scheduleTimeout(() => {
      settle(() => reject(new Error(`tts timeout after ${timeoutMs}ms`)))
    }, timeoutMs)

    ws.on('open', () => {
      try {
        ws.send(buildSpeechConfigMessage())
        ws.send(buildSsmlMessage(req, requestId))
      } catch (err) {
        settle(() =>
          reject(err instanceof Error ? err : new Error(String(err))),
        )
      }
    })

    ws.on('message', (data) => {
      // Binary frames are audio + audio-control; text frames are turn.start /
      // turn.end / response. We only act on binary `Path:audio` frames and
      // text frames whose Path is `turn.end`.
      if (data instanceof ArrayBuffer || Buffer.isBuffer(data)) {
        const buf =
          data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        const { headers, payload } = parseBinaryFrame(buf)
        if (headers['Path'] === 'audio' && payload.length > 0) {
          audioChunks.push(payload)
        }
        return
      }

      // Text frame. Parse the header block properly rather than substring-
      // matching on `Path:turn.end` — a malformed body that happened to
      // contain that literal would otherwise false-trigger the resolve.
      const text = String(data)
      const { headers: textHeaders } = parseTextFrame(text)
      if (textHeaders['Path'] === 'turn.end') {
        const total = audioChunks.reduce((n, c) => n + c.length, 0)
        const merged = new Uint8Array(total)
        let offset = 0
        for (const chunk of audioChunks) {
          merged.set(chunk, offset)
          offset += chunk.length
        }
        settle(() => resolve({ audio: merged }))
      }
    })

    ws.on('error', (err) => {
      settle(() => reject(err))
    })

    ws.on('close', () => {
      settle(() => reject(new Error('tts socket closed before turn.end')))
    })
  })
}

/** Encode a Uint8Array as base64. Server-side only — uses Node's Buffer. */
export function uint8ToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}
