import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildBlendInnerTextWithOnset,
  handler,
  type BlendTweakOverrides,
} from './blend-tweak.js'
import { createRateLimiter } from './_rateLimit.js'
import type { TtsResult } from './_tts.js'

function makeRequest(body: unknown, init: RequestInit = {}): Request {
  return new Request('https://example.test/api/blend-tweak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  })
}

/** A fresh limiter per test so buckets don't leak across cases. */
function freshLimiterOverride(): Pick<BlendTweakOverrides, 'rateLimiter'> {
  return { rateLimiter: createRateLimiter({ limit: 100, windowMs: 60_000 }) }
}

/** A synthesize stub that records the override SSML it was handed and
 *  returns a tiny fake MP3 payload. */
function makeSynthStub() {
  const calls: Array<{ ssmlOverride: string | undefined }> = []
  const synthesize = vi.fn(
    async (
      _req: unknown,
      opts: { ssmlOverride?: string } = {},
    ): Promise<TtsResult> => {
      calls.push({ ssmlOverride: opts.ssmlOverride })
      // 3 bytes → base64 'AAEC'
      return { audio: new Uint8Array([0, 1, 2]) }
    },
  )
  return { synthesize, calls }
}

const validBody = {
  word: 'fan',
  graphemes: ['f', 'a', 'n'],
  onsetText: 'ff',
  ratePct: 0,
  pitchPct: -5,
  breakMs: 250,
}

const validIpaBody = {
  word: 'fan',
  graphemes: ['f', 'a', 'n'],
  onsetMode: 'ipa',
  onsetText: 'fː', // IPA length-marked /f/ — the held-fricative lever
  ratePct: 0,
  pitchPct: -5,
  breakMs: 250,
}

beforeEach(() => {
  delete process.env.VERCEL_ENV
})

afterEach(() => {
  delete process.env.VERCEL_ENV
  vi.restoreAllMocks()
})

describe('buildBlendInnerTextWithOnset — structure mirrors production', () => {
  it('parameterizes ONLY the onset slot; medial + coda + whole word are production-identical', () => {
    const inner = buildBlendInnerTextWithOnset('cat', ['c', 'a', 't'], {
      onsetMode: 'text',
      onsetText: 'kuh',
      graphemeFallback: 'c',
      ratePct: 0,
      pitchPct: 0,
      breakMs: 250,
    })
    // Onset slot is a <prosody> wrap of the free-text onset (NOT a phoneme tag).
    expect(inner).toContain(
      '<prosody rate="+0%" pitch="+0%">kuh</prosody><break time="250ms"/>',
    )
    // Medial vowel `a` → production æ phoneme + 250ms break.
    expect(inner).toContain(
      '<phoneme alphabet="ipa" ph="æ">a</phoneme><break time="250ms"/>',
    )
    // Coda `t` is a STOP → clipped tə release (production rule), 250ms break.
    expect(inner).toContain(
      '<phoneme alphabet="ipa" ph="tə">t</phoneme><break time="250ms"/>',
    )
    // Whole word: 450ms break then the bare word, voiced naturally.
    expect(inner).toContain('<break time="450ms"/>cat')
    // The onset grapheme `c` must NOT appear as a production phoneme tag —
    // the onset slot replaces it entirely.
    expect(inner).not.toContain('ph="kə">c</phoneme>')
  })

  it('renders signed rate/pitch correctly (positive and negative)', () => {
    const inner = buildBlendInnerTextWithOnset('sun', ['s', 'u', 'n'], {
      onsetMode: 'text',
      onsetText: 'sss',
      graphemeFallback: 's',
      ratePct: 10,
      pitchPct: -20,
      breakMs: 300,
    })
    expect(inner).toContain('<prosody rate="+10%" pitch="-20%">sss</prosody>')
    expect(inner).toContain('<break time="300ms"/>')
  })

  it('escapes SSML-injection attempts in onset and word', () => {
    const inner = buildBlendInnerTextWithOnset('fan', ['f', 'a', 'n'], {
      onsetMode: 'text',
      onsetText: 'a</prosody><break time="9000ms"/>',
      graphemeFallback: 'f',
      ratePct: 0,
      pitchPct: 0,
      breakMs: 250,
    })
    // The injected markup must be escaped — no raw closing prosody / break.
    expect(inner).not.toContain('</prosody><break time="9000ms"/>')
    expect(inner).toContain('&lt;/prosody&gt;')
  })

  it('renders the /ks/ cluster coda for fox bare (production rule: x stays bare)', () => {
    const inner = buildBlendInnerTextWithOnset('fox', ['f', 'o', 'x'], {
      onsetMode: 'text',
      onsetText: 'ff',
      graphemeFallback: 'f',
      ratePct: 0,
      pitchPct: 0,
      breakMs: 250,
    })
    // medial o → ɒ
    expect(inner).toContain('<phoneme alphabet="ipa" ph="ɒ">o</phoneme>')
    // coda x → /ks/ cluster, BARE (no ə release — not in BLEND_STOP_GRAPHEMES)
    expect(inner).toContain('<phoneme alphabet="ipa" ph="ks">x</phoneme>')
  })
})

describe('buildBlendInnerTextWithOnset — IPA onset mode', () => {
  it('emits a <phoneme alphabet="ipa"> onset wrapper INSIDE the prosody wrap; preserves the IPA length mark', () => {
    const inner = buildBlendInnerTextWithOnset('fan', ['f', 'a', 'n'], {
      onsetMode: 'ipa',
      onsetText: 'fː', // held fricative — the length-mark lever
      graphemeFallback: 'f',
      ratePct: 0,
      pitchPct: -5,
      breakMs: 250,
    })
    // Onset slot: prosody-wrapped IPA phoneme, glyph fallback `f`, then break.
    expect(inner).toContain(
      '<prosody rate="+0%" pitch="-5%"><phoneme alphabet="ipa" ph="fː">f</phoneme></prosody><break time="250ms"/>',
    )
    // The IPA length mark survives intact in the ph attribute (the whole point).
    expect(inner).toContain('ph="fː"')
    // The medial/coda stay production-identical (unaffected by onset mode).
    expect(inner).toContain('<phoneme alphabet="ipa" ph="æ">a</phoneme>')
    expect(inner).toContain('<break time="450ms"/>fan')
  })

  it('preserves a range of IPA unicode codepoints in the ph value (dʒ, ʊw, sː)', () => {
    const jam = buildBlendInnerTextWithOnset('jam', ['j', 'a', 'm'], {
      onsetMode: 'ipa',
      onsetText: 'dʒ',
      graphemeFallback: 'j',
      ratePct: 0,
      pitchPct: 0,
      breakMs: 250,
    })
    expect(jam).toContain('<phoneme alphabet="ipa" ph="dʒ">j</phoneme>')

    const web = buildBlendInnerTextWithOnset('web', ['w', 'e', 'b'], {
      onsetMode: 'ipa',
      onsetText: 'ʊw',
      graphemeFallback: 'w',
      ratePct: 0,
      pitchPct: -15,
      breakMs: 250,
    })
    expect(web).toContain('<phoneme alphabet="ipa" ph="ʊw">w</phoneme>')

    const sip = buildBlendInnerTextWithOnset('sip', ['s', 'i', 'p'], {
      onsetMode: 'ipa',
      onsetText: 'sː',
      graphemeFallback: 's',
      ratePct: 0,
      pitchPct: 0,
      breakMs: 250,
    })
    expect(sip).toContain('<phoneme alphabet="ipa" ph="sː">s</phoneme>')
  })

  it('neutralizes XML metacharacters in the ph value while preserving IPA unicode', () => {
    // A defence-in-depth case: even though the request validator rejects markup
    // in IPA onset, the builder still escapes — verify " < > are neutralised
    // but a benign IPA codepoint alongside survives.
    const inner = buildBlendInnerTextWithOnset('fan', ['f', 'a', 'n'], {
      onsetMode: 'ipa',
      onsetText: 'fː"<>', // IPA char + raw quote + angle brackets
      graphemeFallback: 'f',
      ratePct: 0,
      pitchPct: 0,
      breakMs: 250,
    })
    // The IPA length mark is preserved verbatim.
    expect(inner).toContain('fː')
    // The XML metacharacters are escaped inside the attribute — no raw " < >.
    expect(inner).toContain('ph="fː&quot;&lt;&gt;"')
    // No raw closing-tag injection survived.
    expect(inner).not.toContain('ph="fː"<>')
  })

  it('escapes the grapheme fallback glyph', () => {
    const inner = buildBlendInnerTextWithOnset('fan', ['f', 'a', 'n'], {
      onsetMode: 'ipa',
      onsetText: 'fː',
      graphemeFallback: '<f>',
      ratePct: 0,
      pitchPct: 0,
      breakMs: 250,
    })
    expect(inner).toContain('ph="fː">&lt;f&gt;</phoneme>')
  })

  it('text mode is byte-unchanged regression: no <phoneme> in the onset slot', () => {
    const inner = buildBlendInnerTextWithOnset('fan', ['f', 'a', 'n'], {
      onsetMode: 'text',
      onsetText: 'fff',
      graphemeFallback: 'f',
      ratePct: 0,
      pitchPct: 0,
      breakMs: 250,
    })
    // Onset is the raw orthography, NOT a phoneme tag.
    expect(inner).toContain('<prosody rate="+0%" pitch="+0%">fff</prosody>')
    // The onset prosody wrap must NOT contain an ipa phoneme tag.
    const onsetSlot = inner.slice(0, inner.indexOf('<break'))
    expect(onsetSlot).not.toContain('alphabet="ipa"')
  })
})

describe('handler — non-production gate', () => {
  it('404s when VERCEL_ENV === production', async () => {
    process.env.VERCEL_ENV = 'production'
    const { synthesize } = makeSynthStub()
    const res = await handler(makeRequest(validBody), {
      ...freshLimiterOverride(),
      synthesize,
    })
    expect(res.status).toBe(404)
    expect(synthesize).not.toHaveBeenCalled()
  })

  it('serves on preview (VERCEL_ENV=preview)', async () => {
    process.env.VERCEL_ENV = 'preview'
    const { synthesize, calls } = makeSynthStub()
    const res = await handler(makeRequest(validBody), {
      ...freshLimiterOverride(),
      synthesize,
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; base64: string }
    expect(json.ok).toBe(true)
    expect(json.base64).toBe('AAEC') // base64 of [0,1,2]
    expect(calls).toHaveLength(1)
    expect(calls[0]!.ssmlOverride).toContain('en-GB-OliviaNeural')
    expect(calls[0]!.ssmlOverride).toContain(
      '<prosody rate="+0%" pitch="-5%">ff</prosody>',
    )
  })

  it('serves locally (VERCEL_ENV unset → development)', async () => {
    const { synthesize } = makeSynthStub()
    const res = await handler(makeRequest(validBody), {
      ...freshLimiterOverride(),
      synthesize,
    })
    expect(res.status).toBe(200)
  })

  it('renders IPA mode — the override SSML carries the IPA <phoneme> onset wrapper with the length mark intact', async () => {
    process.env.VERCEL_ENV = 'preview'
    const { synthesize, calls } = makeSynthStub()
    const res = await handler(makeRequest(validIpaBody), {
      ...freshLimiterOverride(),
      synthesize,
    })
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(1)
    const ssml = calls[0]!.ssmlOverride!
    // The onset is now a prosody-wrapped IPA phoneme, NOT raw text.
    expect(ssml).toContain(
      '<prosody rate="+0%" pitch="-5%"><phoneme alphabet="ipa" ph="fː">f</phoneme></prosody>',
    )
    expect(ssml).toContain('en-GB-OliviaNeural')
  })
})

describe('handler — request validation', () => {
  const cases: Array<{ name: string; body: unknown }> = [
    { name: 'missing word', body: { ...validBody, word: undefined } },
    { name: 'word too long', body: { ...validBody, word: 'elephant' } },
    { name: 'word with digits', body: { ...validBody, word: 'f4n' } },
    { name: 'graphemes not array', body: { ...validBody, graphemes: 'fan' } },
    { name: 'graphemes too few', body: { ...validBody, graphemes: ['f'] } },
    {
      name: 'onsetText too long',
      body: { ...validBody, onsetText: 'aaaaaaaaaaaaa' },
    },
    { name: 'onsetText with markup', body: { ...validBody, onsetText: '<b>' } },
    { name: 'ratePct out of range', body: { ...validBody, ratePct: 999 } },
    { name: 'pitchPct out of range', body: { ...validBody, pitchPct: -999 } },
    { name: 'breakMs out of range', body: { ...validBody, breakMs: 9000 } },
    { name: 'breakMs non-integer', body: { ...validBody, breakMs: 12.5 } },
    {
      name: 'invalid onsetMode',
      body: { ...validBody, onsetMode: 'syllable' },
    },
    {
      name: 'ipa onsetText with markup',
      body: { ...validIpaBody, onsetText: 'f<b>' },
    },
    {
      name: 'ipa onsetText with whitespace',
      body: { ...validIpaBody, onsetText: 'f ː' },
    },
    {
      name: 'ipa onsetText empty',
      body: { ...validIpaBody, onsetText: '' },
    },
  ]
  for (const c of cases) {
    it(`400s on ${c.name}`, async () => {
      const { synthesize } = makeSynthStub()
      const res = await handler(makeRequest(c.body), {
        ...freshLimiterOverride(),
        synthesize,
      })
      expect(res.status).toBe(400)
      expect(synthesize).not.toHaveBeenCalled()
    })
  }

  it('400s on invalid JSON', async () => {
    const { synthesize } = makeSynthStub()
    const req = new Request('https://example.test/api/blend-tweak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })
    const res = await handler(req, { ...freshLimiterOverride(), synthesize })
    expect(res.status).toBe(400)
  })
})

describe('handler — method handling', () => {
  it('204s on OPTIONS preflight', async () => {
    const req = new Request('https://example.test/api/blend-tweak', {
      method: 'OPTIONS',
    })
    const res = await handler(req, freshLimiterOverride())
    expect(res.status).toBe(204)
  })

  it('405s on GET', async () => {
    const req = new Request('https://example.test/api/blend-tweak', {
      method: 'GET',
    })
    const res = await handler(req, freshLimiterOverride())
    expect(res.status).toBe(405)
  })
})

describe('handler — rate limit', () => {
  it('429s when the per-IP bucket is exhausted', async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
    const { synthesize } = makeSynthStub()
    const overrides = { rateLimiter: limiter, synthesize }
    const first = await handler(makeRequest(validBody), overrides)
    expect(first.status).toBe(200)
    const second = await handler(makeRequest(validBody), overrides)
    expect(second.status).toBe(429)
    expect(second.headers.get('Retry-After')).toBeTruthy()
  })
})

describe('handler — render failure mapping', () => {
  it('502s when the Azure synthesize path throws', async () => {
    const synthesize = vi.fn(async () => {
      throw new Error('tts auth failed: check AZURE_SPEECH_KEY')
    })
    const res = await handler(makeRequest(validBody), {
      ...freshLimiterOverride(),
      synthesize,
    })
    expect(res.status).toBe(502)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('render-failed')
  })
})
