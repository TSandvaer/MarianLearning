/**
 * @vitest-environment node
 *
 * ElevenLabs backend (voice migration 1/6, ClickUp 123jpnbc33e).
 */
import { describe, expect, it, vi } from 'vitest'
import { synthesizeUtterance, type TtsRequest } from './_tts.js'
import {
  ELEVENLABS_MODEL_ID,
  ELEVENLABS_OUTPUT_FORMAT,
  ELEVENLABS_VOICE_ID,
  LETTER_SOUND_IPA,
  readElevenLabsKey,
  renderElevenLabsBlend,
  renderElevenLabsText,
  synthesizeElevenLabs,
} from './_tts_elevenlabs.js'

const req = (text: string, tier?: string): TtsRequest => ({
  text,
  tier,
  voice: 'en-GB-OliviaNeural',
  rate: '-10%',
  pitch: '+0Hz',
  volume: '+0%',
})

const okFetch = () =>
  vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }))

describe('renderElevenLabsText', () => {
  it('maps the ear-approved bake-off sounds to IPA in letter-sounds lines', () => {
    expect(
      renderElevenLabsText('Which letter says vvv?', 'letter-sounds'),
    ).toBe('Which letter says /vː/?')
    expect(renderElevenLabsText('Yes. T says tuh.', 'letter-sounds')).toBe(
      'Yes. T says /t/.',
    )
    expect(renderElevenLabsText('It says shhh?', 'letter-sounds')).toBe(
      'It says /ʃː/?',
    )
  })

  it('maps every mnemonic in an utterance, and only whole words', () => {
    expect(
      renderElevenLabsText('This one is S. S says it. sss?', 'letter-sounds'),
    ).toBe('This one is S. S says it. /sː/?')
    // "says" contains "s" but is not a mnemonic; "Yes" must stay intact.
    expect(renderElevenLabsText('Yes. S says sss.', 'letter-sounds')).toBe(
      'Yes. S says /sː/.',
    )
  })

  it('maps the U/I anchored lead sounds but keeps the anchor word plain', () => {
    expect(
      renderElevenLabsText('Yes. U. Uh, like in cup.', 'letter-sounds'),
    ).toBe('Yes. U. /ʌ/, like in cup.')
    expect(
      renderElevenLabsText(
        'Which letter says ih, like in ink?',
        'letter-sounds',
      ),
    ).toBe('Which letter says /ɪ/, like in ink?')
  })

  it('leaves mnemonic-looking words alone outside the letter-sounds tier', () => {
    expect(renderElevenLabsText('Hmm... try again?', 'cvc-words')).toBe(
      'Hmm... try again?',
    )
    expect(renderElevenLabsText('Which letter says vvv?')).toBe(
      'Which letter says vvv?',
    )
  })

  it('renders CVC blends as segmented IPA, keeping the whole word plain', () => {
    expect(renderElevenLabsText('v - a - n ... van', 'cvc-words')).toBe(
      '/vː/ - /æ/ - /n/ ... van',
    )
    expect(renderElevenLabsText('b - o - x ... box', 'cvc-words-short-o')).toBe(
      '/b/ - /ɒ/ - /ks/ ... box',
    )
  })

  it('renders a soft onset g for gem but keeps hard g elsewhere', () => {
    expect(renderElevenLabsText('g - e - m ... gem', 'cvc-words-short-e')).toBe(
      '/dʒ/ - /e/ - /mː/ ... gem',
    )
    expect(renderElevenLabsText('b - a - g ... bag', 'cvc-words')).toBe(
      '/b/ - /æ/ - /ɡ/ ... bag',
    )
  })

  it('falls back to plain text for a blend with an unmapped grapheme', () => {
    expect(renderElevenLabsBlend('q - a - t ... qat')).toBe(null)
    expect(renderElevenLabsText('q - a - t ... qat', 'cvc-words')).toBe(
      'q - a - t ... qat',
    )
  })

  it('substitutes the simple-sentences gap token', () => {
    expect(
      renderElevenLabsText('The ___ is red.', 'simple-sentences'),
    ).not.toContain('___')
  })

  it('has IPA for every mnemonic in the current letter-sounds canon', () => {
    const inCanon = [
      'aaa',
      'buh',
      'duh',
      'eee',
      'fff',
      'guh',
      'hhh',
      'kuh',
      'lll',
      'mmm',
      'nnn',
      'ooo',
      'puh',
      'rrr',
      'sss',
      'tuh',
      'vvv',
    ]
    expect(inCanon.filter((m) => LETTER_SOUND_IPA[m] === undefined)).toEqual([])
  })
})

describe('synthesizeElevenLabs', () => {
  const env = { ELEVENLABS_API_KEY: 'test-key' } as NodeJS.ProcessEnv

  it('posts plain text + IPA to the Lily voice with the pinned model and format', async () => {
    const fetchFn = okFetch()
    const out = await synthesizeElevenLabs(
      req('It says vvv?', 'letter-sounds'),
      {
        fetchFn,
        env,
      },
    )
    expect(Array.from(out.audio)).toEqual([1, 2, 3])
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`,
    )
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe(
      'test-key',
    )
    expect(JSON.parse(init.body as string)).toEqual({
      text: 'It says /vː/?',
      model_id: ELEVENLABS_MODEL_ID,
    })
  })

  it('throws a named error on a non-2xx response', async () => {
    const fetchFn = vi.fn(async () => new Response('bad key', { status: 401 }))
    await expect(
      synthesizeElevenLabs(req('Hi!'), {
        fetchFn,
        env,
        backoff: { maxAttempts: 0 },
      }),
    ).rejects.toThrow(/elevenlabs tts failed: HTTP 401/)
  })

  it('fails loud when the key is missing', () => {
    expect(() => readElevenLabsKey({} as NodeJS.ProcessEnv)).toThrow(
      /ELEVENLABS_API_KEY/,
    )
  })
})

describe('synthesizeUtterance provider switch', () => {
  it('routes to ElevenLabs only when TTS_PROVIDER=elevenlabs', async () => {
    const fetchFn = okFetch()
    await synthesizeUtterance(req('Hi!'), {
      fetchFn,
      env: {
        TTS_PROVIDER: 'elevenlabs',
        ELEVENLABS_API_KEY: 'k',
      } as NodeJS.ProcessEnv,
    })
    const [url] = fetchFn.mock.calls[0] as unknown as [string]
    expect(url.startsWith('https://api.elevenlabs.io/')).toBe(true)
  })

  it('stays on Azure by default', async () => {
    const fetchFn = okFetch()
    await synthesizeUtterance(req('Hi!'), {
      fetchFn,
      env: {
        AZURE_SPEECH_KEY: 'k',
        AZURE_SPEECH_REGION: 'westeurope',
      } as NodeJS.ProcessEnv,
    })
    const [url] = fetchFn.mock.calls[0] as unknown as [string]
    expect(url).toContain('tts.speech.microsoft.com')
  })
})
