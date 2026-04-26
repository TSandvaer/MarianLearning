/**
 * @vitest-environment node
 *
 * Server-only module — runs in Node, never in jsdom.
 *
 * Covers the Azure Speech REST swap (ticket 86c9gvgjk). The prior WSS-
 * shaped tests (Sec-MS-GEC, binary-frame parsing, fake-WebSocket fan-out)
 * were retired with the transport layer; what remains is the testable
 * surface of the new pipeline:
 *   - SSML body construction (voice/lang/prosody/escape)
 *   - env-var validation (key + region must be set)
 *   - endpoint URL construction
 *   - fetch happy path (correct method, headers, body, status handling)
 *   - error mapping (401 / 429 / 5xx / generic non-2xx)
 *   - timeout path
 *   - base64 round-trip
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAzureEndpoint,
  buildSsmlBody,
  describeAzureFailure,
  escapeSsml,
  readAzureCredentials,
  renderSsmlInnerText,
  synthesizeUtterance,
  uint8ToBase64,
} from './_tts.js'

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

describe('buildAzureEndpoint', () => {
  it('builds the per-region cognitiveservices/v1 URL', () => {
    expect(buildAzureEndpoint('westeurope')).toBe(
      'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1',
    )
    expect(buildAzureEndpoint('eastus')).toBe(
      'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1',
    )
  })
})

describe('readAzureCredentials', () => {
  it('returns key + region when both are set', () => {
    const env = {
      AZURE_SPEECH_KEY: 'test-key',
      AZURE_SPEECH_REGION: 'westeurope',
    } as NodeJS.ProcessEnv
    expect(readAzureCredentials(env)).toEqual({
      key: 'test-key',
      region: 'westeurope',
    })
  })

  it('throws a clear error when AZURE_SPEECH_KEY is missing', () => {
    const env = {
      AZURE_SPEECH_REGION: 'westeurope',
    } as NodeJS.ProcessEnv
    expect(() => readAzureCredentials(env)).toThrow(/AZURE_SPEECH_KEY/)
  })

  it('throws a clear error when AZURE_SPEECH_REGION is missing', () => {
    const env = {
      AZURE_SPEECH_KEY: 'test-key',
    } as NodeJS.ProcessEnv
    expect(() => readAzureCredentials(env)).toThrow(/AZURE_SPEECH_REGION/)
  })

  it('throws when AZURE_SPEECH_KEY is the empty string (not just undefined)', () => {
    const env = {
      AZURE_SPEECH_KEY: '',
      AZURE_SPEECH_REGION: 'westeurope',
    } as NodeJS.ProcessEnv
    expect(() => readAzureCredentials(env)).toThrow(/AZURE_SPEECH_KEY/)
  })
})

describe('buildSsmlBody', () => {
  const baseReq = {
    text: 'Hello Marian!',
    voice: 'en-US-AnaNeural',
    rate: '-10%',
    pitch: '+0Hz',
    volume: '+0%',
  }

  it('wraps text in <speak><voice><prosody> with xml:lang="en-US"', () => {
    const body = buildSsmlBody(baseReq)
    expect(body).toContain('xml:lang="en-US"')
    expect(body).toContain(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"',
    )
    expect(body).toContain('<voice name="en-US-AnaNeural">')
    expect(body).toContain('<prosody pitch="+0Hz" rate="-10%" volume="+0%">')
    expect(body).toContain('Hello Marian!')
    expect(body).toMatch(/<\/prosody><\/voice><\/speak>$/)
  })

  it('XML-escapes the text payload (defense against SSML injection)', () => {
    // Use a declarative payload so this test pins escape behavior
    // independently of the trailing-interrogative emphasis wrap (covered
    // separately under renderSsmlInnerText / buildSsmlBody-prosody tests).
    const body = buildSsmlBody({
      ...baseReq,
      text: `What's <2+2>.`,
    })
    expect(body).toContain('What&apos;s &lt;2+2&gt;.')
    expect(body).not.toContain("What's <2+2>.")
  })

  it('XML-escapes voice/rate/pitch/volume attribute values (defense-in-depth)', () => {
    // Future caller might pass user-derived prosody values into a double-
    // quoted attribute slot; escapeSsml on those four fields blocks
    // attribute injection. None of the metacharacters reach the wire raw.
    const body = buildSsmlBody({
      text: 'x',
      voice: `evil" onerror="`,
      rate: `<rate>`,
      pitch: `&pitch;`,
      volume: `'vol'`,
    })
    expect(body).toContain('voice name="evil&quot; onerror=&quot;"')
    expect(body).toContain('rate="&lt;rate&gt;"')
    expect(body).toContain('pitch="&amp;pitch;"')
    expect(body).toContain(`volume="&apos;vol&apos;"`)
    // Raw double-quote inside the voice attribute would close it early —
    // verify it's gone after escaping.
    expect(body).not.toContain(`voice name="evil" onerror=""`)
  })
})

describe('renderSsmlInnerText (interrogative emphasis hint, ticket 86c9gxup4)', () => {
  // Background: en-US-AnaNeural's prosody predictor sometimes fails to flip
  // into question intonation on short trailing interrogatives ("How many
  // now?" after a numeric clause). Wrapping the trailing clause in
  // <emphasis level="moderate"> nudges Azure into the right shape.

  it('passes declarative text through unchanged (no emphasis tag)', () => {
    expect(renderSsmlInnerText('Hello Marian!')).toBe('Hello Marian!')
    expect(renderSsmlInnerText('This one is five.')).toBe('This one is five.')
    expect(renderSsmlInnerText('Yes! Five!')).toBe('Yes! Five!')
  })

  it('still XML-escapes declarative text', () => {
    expect(renderSsmlInnerText(`A & B < C.`)).toBe('A &amp; B &lt; C.')
  })

  it('wraps the trailing clause of the Math hint in <emphasis>', () => {
    // The exact utterance from sessionPlans.ts that the ticket targets.
    expect(
      renderSsmlInnerText('Look. Three. And two more. How many now?'),
    ).toBe(
      'Look. Three. And two more. <emphasis level="moderate">How many now?</emphasis>',
    )
  })

  it('wraps the whole text when it is one short interrogative with no internal boundary', () => {
    expect(renderSsmlInnerText('How many?')).toBe(
      '<emphasis level="moderate">How many?</emphasis>',
    )
  })

  it('XML-escapes both the leading portion and the wrapped clause', () => {
    expect(renderSsmlInnerText(`A & B. What's left?`)).toBe(
      `A &amp; B. <emphasis level="moderate">What&apos;s left?</emphasis>`,
    )
  })

  it('does not match a final-punctuation+whitespace inside the trailing clause itself', () => {
    // Defensive case: only one sentence boundary exists, and it sits
    // immediately before the trailing clause. No false-positive split.
    expect(renderSsmlInnerText('Ready. Go now?')).toBe(
      'Ready. <emphasis level="moderate">Go now?</emphasis>',
    )
  })

  it('treats `!` and `.` endings as declarative even after question-shaped phrasing', () => {
    expect(renderSsmlInnerText('How many now.')).toBe('How many now.')
    expect(renderSsmlInnerText('How many now!')).toBe('How many now!')
  })

  it('handles the read utterance ("X plus Y. How many?") correctly', () => {
    expect(renderSsmlInnerText('Three plus two. How many?')).toBe(
      'Three plus two. <emphasis level="moderate">How many?</emphasis>',
    )
  })
})

describe('buildSsmlBody (prosody-hint integration)', () => {
  const baseReq = {
    voice: 'en-US-AnaNeural',
    rate: '-10%',
    pitch: '+0Hz',
    volume: '+0%',
  }

  it('emits the <emphasis> hint inside <prosody> for the Math hint utterance', () => {
    const body = buildSsmlBody({
      ...baseReq,
      text: 'Look. Three. And two more. How many now?',
    })
    expect(body).toContain(
      '<prosody pitch="+0Hz" rate="-10%" volume="+0%">' +
        'Look. Three. And two more. ' +
        '<emphasis level="moderate">How many now?</emphasis>' +
        '</prosody>',
    )
  })

  it('does NOT emit <emphasis> for declarative utterances (regression guard for non-hint lines)', () => {
    const body = buildSsmlBody({
      ...baseReq,
      text: 'Yes! Five!',
    })
    expect(body).not.toContain('<emphasis')
    expect(body).toContain(
      '<prosody pitch="+0Hz" rate="-10%" volume="+0%">Yes! Five!</prosody>',
    )
  })
})

describe('describeAzureFailure', () => {
  it('maps 401 to a key-hint auth-failed error', () => {
    expect(describeAzureFailure(401, 'Access denied').message).toMatch(
      /tts auth failed \(401\)/,
    )
  })

  it('maps 403 to the same auth-failed error class', () => {
    expect(describeAzureFailure(403, 'Forbidden').message).toMatch(
      /tts auth failed \(403\)/,
    )
  })

  it('maps 429 to a rate-limited error', () => {
    expect(describeAzureFailure(429, 'Too many').message).toMatch(
      /tts rate limited \(429\)/,
    )
  })

  it('maps 5xx to upstream-error and includes a body hint', () => {
    const err = describeAzureFailure(503, 'service unavailable')
    expect(err.message).toMatch(/tts upstream error \(503\)/)
    expect(err.message).toContain('service unavailable')
  })

  it('truncates oversize body hints to keep error messages bounded', () => {
    const longBody = 'X'.repeat(500)
    const err = describeAzureFailure(500, longBody)
    // 200-char cap inside describeAzureFailure.
    expect(err.message.length).toBeLessThan(longBody.length)
  })

  it('falls through to a generic http-error for unmapped status codes', () => {
    expect(describeAzureFailure(418, "I'm a teapot").message).toMatch(
      /tts http error \(418\)/,
    )
  })
})

// --- synthesizeUtterance: integration with a fake fetch ----------------

const HAPPY_REQ = {
  text: 'Hi!',
  voice: 'en-US-AnaNeural',
  rate: '-10%',
  pitch: '+0Hz',
  volume: '+0%',
}

function fakeOkResponse(bytes: Uint8Array): Response {
  // Construct a real Response to match the runtime contract — fetchFn
  // returns one of these and we await arrayBuffer() / text() on it.
  return new Response(bytes, {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
  })
}

function fakeFailResponse(status: number, body = ''): Response {
  return new Response(body, { status })
}

const TEST_ENV: NodeJS.ProcessEnv = {
  AZURE_SPEECH_KEY: 'test-key-not-real',
  AZURE_SPEECH_REGION: 'westeurope',
}

describe('synthesizeUtterance', () => {
  beforeEach(() => {
    // Explicit env injection on every test — never read process.env in
    // synthesize tests so a stray AZURE_SPEECH_* in the dev shell can't
    // turn a unit test into an integration test.
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs the SSML body to the per-region endpoint with the correct headers', async () => {
    const audioBytes = new Uint8Array([0xff, 0xfb, 0x90, 0x44])
    const fetchFn =
      vi.fn<(input: string | URL, init?: RequestInit) => Promise<Response>>()
    fetchFn.mockImplementation(async () => fakeOkResponse(audioBytes))

    const result = await synthesizeUtterance(HAPPY_REQ, {
      fetchFn: fetchFn as unknown as typeof fetch,
      env: TEST_ENV,
    })

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url, init] = fetchFn.mock.calls[0]!
    expect(url).toBe(
      'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1',
    )
    expect(init).toBeDefined()
    expect(init!.method).toBe('POST')

    const headers = init!.headers as Record<string, string>
    expect(headers['Ocp-Apim-Subscription-Key']).toBe('test-key-not-real')
    expect(headers['Content-Type']).toBe('application/ssml+xml')
    expect(headers['X-Microsoft-OutputFormat']).toBe(
      'audio-24khz-48kbitrate-mono-mp3',
    )
    expect(headers['User-Agent']).toBeTruthy()

    expect(typeof init!.body).toBe('string')
    expect(init!.body as string).toContain('<voice name="en-US-AnaNeural">')
    expect(init!.body as string).toContain('xml:lang="en-US"')
    expect(init!.body as string).toContain('Hi!')

    expect(Array.from(result.audio)).toEqual([0xff, 0xfb, 0x90, 0x44])
  })

  it('passes the response body through as a Uint8Array unchanged', async () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0xff])
    const fetchFn = vi.fn(async () => fakeOkResponse(bytes))
    const result = await synthesizeUtterance(HAPPY_REQ, {
      fetchFn: fetchFn as unknown as typeof fetch,
      env: TEST_ENV,
    })
    expect(Array.from(result.audio)).toEqual([
      0x01, 0x02, 0x03, 0x04, 0x05, 0xff,
    ])
  })

  it('fails loud when AZURE_SPEECH_KEY is missing in the env', async () => {
    const fetchFn = vi.fn()
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: { AZURE_SPEECH_REGION: 'westeurope' } as NodeJS.ProcessEnv,
      }),
    ).rejects.toThrow(/AZURE_SPEECH_KEY/)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('fails loud when AZURE_SPEECH_REGION is missing in the env', async () => {
    const fetchFn = vi.fn()
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: { AZURE_SPEECH_KEY: 'k' } as NodeJS.ProcessEnv,
      }),
    ).rejects.toThrow(/AZURE_SPEECH_REGION/)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('rejects with the auth-failed message on 401', async () => {
    const fetchFn = vi.fn(async () => fakeFailResponse(401, 'Access denied'))
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: TEST_ENV,
      }),
    ).rejects.toThrow(/tts auth failed \(401\)/)
  })

  it('rejects with the rate-limited message on 429', async () => {
    const fetchFn = vi.fn(async () => fakeFailResponse(429, 'Too many'))
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: TEST_ENV,
      }),
    ).rejects.toThrow(/tts rate limited \(429\)/)
  })

  it('rejects with the upstream-error message on 503', async () => {
    const fetchFn = vi.fn(async () =>
      fakeFailResponse(503, 'service unavailable'),
    )
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: TEST_ENV,
      }),
    ).rejects.toThrow(/tts upstream error \(503\)/)
  })

  it('rejects on timeout — uses the injected scheduler so the test is synchronous', async () => {
    // The fetch never resolves; the timeout fires synchronously via the
    // injected setTimeoutFn. AbortController on the request signals the
    // fetch implementation, which here we simulate by rejecting with an
    // AbortError after the controller's signal aborts.
    let abortHandler: (() => void) | null = null
    const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined
      return new Promise<Response>((_resolve, reject) => {
        if (signal) {
          abortHandler = () => {
            const err = new Error('aborted') as Error & { name: string }
            err.name = 'AbortError'
            reject(err)
          }
          signal.addEventListener('abort', abortHandler)
        }
      })
    })

    let scheduled: (() => void) | null = null
    const promise = synthesizeUtterance(HAPPY_REQ, {
      fetchFn: fetchFn as unknown as typeof fetch,
      env: TEST_ENV,
      timeoutMs: 100,
      setTimeoutFn: (cb) => {
        scheduled = cb
        return 1
      },
      clearTimeoutFn: () => {},
    })

    expect(scheduled).toBeTypeOf('function')
    // Fire the scheduled timeout — the AbortController inside synthesize
    // calls .abort(), the fake fetch's signal listener rejects, and
    // synthesize re-throws the timeout-shaped error.
    scheduled!()

    await expect(promise).rejects.toThrow(/timeout after 100ms/)
  })

  it('rejects with the underlying fetch error when fetch fails for a non-timeout reason', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('connection reset by peer')
    })
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: TEST_ENV,
      }),
    ).rejects.toThrow(/connection reset by peer/)
  })
})

describe('uint8ToBase64', () => {
  it('round-trips through Buffer.from(b64, "base64")', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff])
    const b64 = uint8ToBase64(bytes)
    const decoded = Buffer.from(b64, 'base64')
    expect(Array.from(decoded)).toEqual([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff])
  })

  it('returns the empty string for an empty Uint8Array', () => {
    expect(uint8ToBase64(new Uint8Array(0))).toBe('')
  })
})
