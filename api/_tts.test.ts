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
  synthesizeUtterance,
  uint8ToBase64,
  type WebSocketLike,
} from './_tts'

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
