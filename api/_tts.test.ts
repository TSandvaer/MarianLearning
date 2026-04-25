/**
 * @vitest-environment node
 *
 * Server-only module — runs in Node, never in jsdom.
 */
import { describe, expect, it } from 'vitest'
import {
  buildSpeechConfigMessage,
  buildSsmlMessage,
  buildWssUrl,
  escapeSsml,
  generateSecMsGec,
  parseBinaryFrame,
  parseTextFrame,
  synthesizeUtterance,
  uint8ToBase64,
  type WebSocketLike,
} from './_tts'

// Strict ISO-8601 + single-Z timestamp shape. The earlier double-Z bug
// (`...sssZZ`) shipped under tests that only asserted substring presence
// of `X-Timestamp:`; this regex is what catches it on a future regression.
//   YYYY-MM-DDTHH:mm:ss.sssZ — exactly one trailing Z.
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function extractHeader(msg: string, name: string): string | null {
  const idx = msg.indexOf('\r\n\r\n')
  const headerBlock = idx >= 0 ? msg.slice(0, idx) : msg
  for (const line of headerBlock.split('\r\n')) {
    const sep = line.indexOf(':')
    if (sep > 0 && line.slice(0, sep).trim() === name) {
      return line.slice(sep + 1).trim()
    }
  }
  return null
}

describe('escapeSsml', () => {
  it('escapes the five XML metacharacters', () => {
    expect(escapeSsml(`<a href="x">o'rly?</a> & more`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;o&apos;rly?&lt;/a&gt; &amp; more',
    )
  })

  it('passes through plain text untouched', () => {
    expect(escapeSsml('Hello Marian!')).toBe('Hello Marian!')
  })
})

describe('generateSecMsGec', () => {
  it('produces a 64-char uppercase hex SHA-256 digest', () => {
    const out = generateSecMsGec(1714032000_000)
    expect(out).toMatch(/^[0-9A-F]{64}$/)
  })

  it('rounds the input timestamp DOWN to the nearest 5-minute boundary', () => {
    // 12:00:00 UTC and 12:04:59 UTC of the same hour both fall in the
    // [12:00, 12:05) bucket → identical token. 12:05:00 is a fresh bucket.
    const noon = Date.UTC(2026, 3, 25, 12, 0, 0)
    const noonPlus4m59s = Date.UTC(2026, 3, 25, 12, 4, 59)
    const noonPlus5m = Date.UTC(2026, 3, 25, 12, 5, 0)

    expect(generateSecMsGec(noon)).toBe(generateSecMsGec(noonPlus4m59s))
    expect(generateSecMsGec(noon)).not.toBe(generateSecMsGec(noonPlus5m))
  })

  it('is deterministic for a fixed timestamp', () => {
    const t = 1714032000_000
    expect(generateSecMsGec(t)).toBe(generateSecMsGec(t))
  })
})

describe('buildWssUrl', () => {
  it('embeds TrustedClientToken, ConnectionId (no dashes), Sec-MS-GEC, and version', () => {
    const url = buildWssUrl('aaaa-bbbb-cccc-dddd', 1714032000_000)
    expect(url).toMatch(/^wss:\/\/speech\.platform\.bing\.com/)
    expect(url).toContain('TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4')
    expect(url).toContain('ConnectionId=aaaabbbbccccdddd')
    expect(url).toMatch(/Sec-MS-GEC=[0-9A-F]{64}/)
    expect(url).toContain('Sec-MS-GEC-Version=1-143.0.3650.75')
  })
})

describe('buildSpeechConfigMessage', () => {
  it('contains the speech.config Path header and JSON body', () => {
    const msg = buildSpeechConfigMessage()
    expect(msg).toContain('Path:speech.config')
    expect(msg).toContain('Content-Type:application/json')
    // The body sits after \r\n\r\n. Parse it.
    const idx = msg.indexOf('\r\n\r\n')
    const body = JSON.parse(msg.slice(idx + 4))
    expect(body.context.synthesis.audio.outputFormat).toBe(
      'audio-24khz-48kbitrate-mono-mp3',
    )
  })

  it('writes X-Timestamp as a single ISO-8601 + Z (no double-Z)', () => {
    const ts = extractHeader(buildSpeechConfigMessage(), 'X-Timestamp')
    expect(ts).not.toBeNull()
    expect(ts).toMatch(ISO_TIMESTAMP_RE)
    expect(ts!.endsWith('ZZ')).toBe(false)
  })
})

describe('buildSsmlMessage', () => {
  it('embeds voice, prosody attrs, and escaped text inside the SSML envelope', () => {
    const msg = buildSsmlMessage(
      {
        text: `What's <2+2>?`,
        voice: 'en-US-AnaNeural',
        rate: '-10%',
        pitch: '+0Hz',
        volume: '+0%',
      },
      'req-1234-abcd',
    )
    expect(msg).toContain('Path:ssml')
    expect(msg).toContain('X-RequestId:req1234abcd')
    expect(msg).toContain("voice name='en-US-AnaNeural'")
    expect(msg).toContain("rate='-10%'")
    expect(msg).toContain("pitch='+0Hz'")
    expect(msg).toContain("volume='+0%'")
    expect(msg).toContain('What&apos;s &lt;2+2&gt;?')
    expect(msg).not.toContain("What's <2+2>?")
  })

  it('writes X-Timestamp as a single ISO-8601 + Z (no double-Z)', () => {
    // Regression for the `${toISOString()}Z` double-Z bug. `toISOString()`
    // already terminates with Z; appending another Z produces `...sssZZ`,
    // which the Edge endpoint silently tolerates today but is a one-char
    // protocol bug. The earlier test only asserted substring presence and
    // missed it — this regex is what would have caught it.
    const msg = buildSsmlMessage(
      {
        text: 'x',
        voice: 'en-US-AnaNeural',
        rate: '-10%',
        pitch: '+0Hz',
        volume: '+0%',
      },
      'req-1',
    )
    const ts = extractHeader(msg, 'X-Timestamp')
    expect(ts).not.toBeNull()
    expect(ts).toMatch(ISO_TIMESTAMP_RE)
    expect(ts!.endsWith('ZZ')).toBe(false)
    // Belt-and-braces: literal scan for the regression pattern.
    expect(msg).not.toMatch(/X-Timestamp:[^\r\n]*ZZ/)
  })

  it('XML-escapes voice/rate/pitch/volume attribute values (defense-in-depth)', () => {
    // Future caller might pass user-derived prosody values into a
    // single-quoted attribute slot; escapeSsml on those four fields blocks
    // attribute injection. None of the metacharacters should reach the
    // wire raw.
    const msg = buildSsmlMessage(
      {
        text: 'x',
        voice: `evil' onerror='`,
        rate: `<rate>`,
        pitch: `&pitch;`,
        volume: `"vol"`,
      },
      'req-2',
    )
    expect(msg).toContain(`voice name='evil&apos; onerror=&apos;'`)
    expect(msg).toContain(`rate='&lt;rate&gt;'`)
    expect(msg).toContain(`pitch='&amp;pitch;'`)
    expect(msg).toContain(`volume='&quot;vol&quot;'`)
    // Raw single-quote inside the voice attribute would close it early —
    // verify it's gone after escaping.
    expect(msg).not.toContain(`voice name='evil' onerror=''`)
  })
})

describe('parseTextFrame', () => {
  it('parses headers + body separated by \\r\\n\\r\\n', () => {
    const frame =
      'X-RequestId:abc\r\nContent-Type:application/json\r\nPath:turn.end\r\n\r\n{"foo":1}'
    const { headers, body } = parseTextFrame(frame)
    expect(headers['Path']).toBe('turn.end')
    expect(headers['X-RequestId']).toBe('abc')
    expect(headers['Content-Type']).toBe('application/json')
    expect(body).toBe('{"foo":1}')
  })

  it('treats the whole frame as headers when there is no body separator', () => {
    const { headers, body } = parseTextFrame('Path:turn.end\r\n')
    expect(headers['Path']).toBe('turn.end')
    expect(body).toBe('')
  })

  it('does NOT confuse a body containing the literal Path:turn.end with a real header', () => {
    // If the parser substring-matched on `Path:turn.end`, this innocent
    // metadata frame whose body happens to mention the literal would
    // false-trigger downstream logic. The header-block parser must only
    // look at the bytes BEFORE \r\n\r\n.
    const frame =
      'Path:response\r\nContent-Type:application/json\r\n\r\n{"note":"Path:turn.end is just text here"}'
    const { headers } = parseTextFrame(frame)
    expect(headers['Path']).toBe('response')
    expect(headers['Path']).not.toBe('turn.end')
  })
})

describe('parseBinaryFrame', () => {
  it('parses a real-shape audio frame: 2-byte length, headers, payload', () => {
    const headerStr = 'X-RequestId:abc\r\nContent-Type:audio/mpeg\r\nPath:audio'
    const headerBytes = Buffer.from(headerStr, 'utf8')
    const payload = Buffer.from([0xff, 0xfb, 0x90, 0x44]) // first 4 mp3 bytes
    const buf = Buffer.concat([
      Buffer.from([
        (headerBytes.length >> 8) & 0xff,
        headerBytes.length & 0xff,
      ]),
      headerBytes,
      payload,
    ])
    const { headers, payload: out } = parseBinaryFrame(new Uint8Array(buf))
    expect(headers['Path']).toBe('audio')
    expect(headers['Content-Type']).toBe('audio/mpeg')
    expect(headers['X-RequestId']).toBe('abc')
    expect(Array.from(out)).toEqual([0xff, 0xfb, 0x90, 0x44])
  })

  it('returns empty headers + empty payload on a malformed short frame', () => {
    const out = parseBinaryFrame(new Uint8Array([0x42]))
    expect(out.headers).toEqual({})
    expect(out.payload.length).toBe(0)
  })

  it('handles a frame with zero-length payload (end-of-stream marker)', () => {
    const headerStr = 'Path:audio'
    const headerBytes = Buffer.from(headerStr, 'utf8')
    const buf = Buffer.concat([
      Buffer.from([0x00, headerBytes.length]),
      headerBytes,
    ])
    const { headers, payload } = parseBinaryFrame(new Uint8Array(buf))
    expect(headers['Path']).toBe('audio')
    expect(payload.length).toBe(0)
  })
})

describe('uint8ToBase64', () => {
  it('round-trips through atob', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff])
    const b64 = uint8ToBase64(bytes)
    const decoded = Buffer.from(b64, 'base64')
    expect(Array.from(decoded)).toEqual([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff])
  })
})

// --- synthesizeUtterance: integration with a fake WebSocket -------------

type Listener = (data?: unknown) => void

function makeFakeWs() {
  const listeners: Record<string, Listener[]> = {
    open: [],
    message: [],
    error: [],
    close: [],
  }
  const sentMessages: (string | Uint8Array)[] = []
  let closed = false

  const ws = {
    readyState: 1,
    send(data: string | Uint8Array) {
      sentMessages.push(data)
    },
    close() {
      closed = true
    },
    on(event: string, listener: Listener) {
      listeners[event] ??= []
      listeners[event].push(listener)
      return undefined
    },
    __fire(event: string, data?: unknown) {
      const snap = (listeners[event] ?? []).slice()
      for (const cb of snap) cb(data)
    },
    __sent: sentMessages,
    __closed: () => closed,
  }
  return ws as unknown as WebSocketLike & {
    __fire: (event: string, data?: unknown) => void
    __sent: (string | Uint8Array)[]
    __closed: () => boolean
  }
}

function makeAudioFrame(payload: Uint8Array, path = 'audio'): Buffer {
  const headerStr = `Path:${path}\r\nContent-Type:audio/mpeg`
  const headerBytes = Buffer.from(headerStr, 'utf8')
  return Buffer.concat([
    Buffer.from([(headerBytes.length >> 8) & 0xff, headerBytes.length & 0xff]),
    headerBytes,
    Buffer.from(payload),
  ])
}

describe('synthesizeUtterance', () => {
  it('opens a socket, sends config + ssml, accumulates audio, resolves on turn.end', async () => {
    const ws = makeFakeWs()
    let capturedUrl: string | null = null
    const factory = (url: string) => {
      capturedUrl = url
      return ws
    }

    const promise = synthesizeUtterance(
      {
        text: 'Hi!',
        voice: 'en-US-AnaNeural',
        rate: '-10%',
        pitch: '+0Hz',
        volume: '+0%',
      },
      {
        webSocketFactory: factory,
        connectionId: 'abc',
        requestId: 'def',
        now: () => 1714032000_000,
      },
    )

    // The factory was called synchronously inside the promise constructor.
    expect(capturedUrl).toMatch(/^wss:\/\/speech\.platform\.bing/)

    // Open → engine sends two messages.
    ws.__fire('open')
    expect(ws.__sent).toHaveLength(2)
    expect(String(ws.__sent[0])).toContain('Path:speech.config')
    expect(String(ws.__sent[1])).toContain('Path:ssml')
    expect(String(ws.__sent[1])).toContain('Hi!')

    // Service streams two audio frames then the turn.end text frame.
    ws.__fire('message', makeAudioFrame(new Uint8Array([0xaa, 0xbb])))
    ws.__fire('message', makeAudioFrame(new Uint8Array([0xcc, 0xdd, 0xee])))
    ws.__fire(
      'message',
      'X-RequestId:def\r\nContent-Type:application/json; charset=utf-8\r\nPath:turn.end\r\n\r\n{}',
    )

    const result = await promise
    expect(Array.from(result.audio)).toEqual([0xaa, 0xbb, 0xcc, 0xdd, 0xee])
    expect(ws.__closed()).toBe(true)
  })

  it('rejects when the service emits an error', async () => {
    const ws = makeFakeWs()
    const promise = synthesizeUtterance(
      {
        text: 'x',
        voice: 'en-US-AnaNeural',
        rate: '-10%',
        pitch: '+0Hz',
        volume: '+0%',
      },
      { webSocketFactory: () => ws },
    )
    ws.__fire('error', new Error('boom'))
    await expect(promise).rejects.toThrow(/boom/)
  })

  it('rejects when the socket closes before turn.end', async () => {
    const ws = makeFakeWs()
    const promise = synthesizeUtterance(
      {
        text: 'x',
        voice: 'en-US-AnaNeural',
        rate: '-10%',
        pitch: '+0Hz',
        volume: '+0%',
      },
      { webSocketFactory: () => ws },
    )
    ws.__fire('open')
    ws.__fire('close')
    await expect(promise).rejects.toThrow(/closed before turn\.end/)
  })

  it('rejects on timeout', async () => {
    const ws = makeFakeWs()
    let scheduled: (() => void) | null = null
    const promise = synthesizeUtterance(
      {
        text: 'x',
        voice: 'en-US-AnaNeural',
        rate: '-10%',
        pitch: '+0Hz',
        volume: '+0%',
      },
      {
        webSocketFactory: () => ws,
        timeoutMs: 100,
        setTimeoutFn: (cb) => {
          scheduled = cb
          return 1
        },
        clearTimeoutFn: () => {},
      },
    )
    expect(scheduled).toBeTypeOf('function')
    scheduled!()
    await expect(promise).rejects.toThrow(/timeout after 100ms/)
  })

  it('does NOT resolve on a non-turn.end text frame whose body mentions Path:turn.end', async () => {
    // Regression for the substring-match parsing: a `response` text frame
    // whose JSON body mentions the literal `Path:turn.end` must not be
    // mistaken for the real terminator. The audio buffer must still be
    // resolved by the real terminator that arrives after.
    const ws = makeFakeWs()
    const promise = synthesizeUtterance(
      {
        text: 'x',
        voice: 'en-US-AnaNeural',
        rate: '-10%',
        pitch: '+0Hz',
        volume: '+0%',
      },
      { webSocketFactory: () => ws },
    )
    ws.__fire('open')
    ws.__fire('message', makeAudioFrame(new Uint8Array([0x11])))
    // Innocent `response` frame — must NOT resolve.
    ws.__fire(
      'message',
      'X-RequestId:def\r\nContent-Type:application/json\r\nPath:response\r\n\r\n{"note":"Path:turn.end mentioned in body"}',
    )
    // Audio still streaming — caller is still awaiting.
    ws.__fire('message', makeAudioFrame(new Uint8Array([0x22])))
    // Real terminator now resolves.
    ws.__fire('message', 'Path:turn.end\r\n')
    const result = await promise
    expect(Array.from(result.audio)).toEqual([0x11, 0x22])
  })

  it('only treats binary frames with Path:audio as audio chunks', async () => {
    const ws = makeFakeWs()
    const promise = synthesizeUtterance(
      {
        text: 'x',
        voice: 'en-US-AnaNeural',
        rate: '-10%',
        pitch: '+0Hz',
        volume: '+0%',
      },
      { webSocketFactory: () => ws },
    )
    ws.__fire('open')
    // A binary metadata frame should NOT be appended to the audio buffer.
    ws.__fire(
      'message',
      makeAudioFrame(new Uint8Array([0x99]), 'audio.metadata'),
    )
    ws.__fire('message', makeAudioFrame(new Uint8Array([0x42, 0x43])))
    ws.__fire('message', 'Path:turn.end\r\n')
    const result = await promise
    expect(Array.from(result.audio)).toEqual([0x42, 0x43])
  })
})
