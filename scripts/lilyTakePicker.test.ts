import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { renderElevenLabsText } from '../api/_tts_elevenlabs'
import { tierFor } from './lilyCanonLib'
import {
  audioHash,
  parseApply,
  parseIds,
  parseVariants,
  planTakes,
  spliceAudio,
  takesPage,
  type CanonDoc,
  type TakeSet,
} from './lilyTakePicker'

const SHORT_I = 'public/canon/word-song/level-1/cvc-words-short-i.json'

const utt = (id: string, text: string, base64 = 'old') => ({
  id,
  text,
  audio: { kind: 'inline', base64, mime: 'audio/mpeg' },
})

describe('argument parsing', () => {
  it('parses --ids on the last colon', () => {
    expect(parseIds(`${SHORT_I}:word.p2.read,${SHORT_I}:word.p2.hint`)).toEqual(
      [
        { file: SHORT_I, utteranceId: 'word.p2.read' },
        { file: SHORT_I, utteranceId: 'word.p2.hint' },
      ],
    )
  })

  it('parses --apply into line + take number', () => {
    expect(
      parseApply(`${SHORT_I}:word.p2.read=4,${SHORT_I}:word.p2.hint=0`),
    ).toEqual([
      { file: SHORT_I, utteranceId: 'word.p2.read', take: 4 },
      { file: SHORT_I, utteranceId: 'word.p2.hint', take: 0 },
    ])
  })

  it('rejects a malformed --apply entry', () => {
    expect(() => parseApply(`${SHORT_I}:word.p2.read=two`)).toThrow(/take/)
    expect(() => parseApply(`${SHORT_I}:word.p2.read`)).toThrow(/bad entry/)
    expect(() => parseIds('word.p2.read')).toThrow(/bad entry/)
  })

  it('collects repeatable input variants per utterance, keeping "=" in the input', () => {
    const v = parseVariants([
      'word.p2.read=Read the fig',
      'word.p2.read=Read the fig!',
      'x=a=b',
    ])
    expect(v.get('word.p2.read')).toEqual(['Read the fig', 'Read the fig!'])
    expect(v.get('x')).toEqual(['a=b'])
    expect(() => parseVariants(['nope'])).toThrow(/input-variant/)
  })
})

describe('planTakes', () => {
  const take0 = { n: 0, input: 'Read the fig.', hash: 'h', seconds: 1 }

  it('numbers fresh takes after the anchor, committed input first', () => {
    const plan = planTakes(
      [take0],
      [
        { text: 'Read the fig.', input: 'Read the fig.', count: 2 },
        { text: 'Read the fig', input: 'Read the fig', count: 1 },
      ],
    )
    expect(plan).toEqual([
      { n: 1, text: 'Read the fig.', input: 'Read the fig.' },
      { n: 2, text: 'Read the fig.', input: 'Read the fig.' },
      { n: 3, text: 'Read the fig', input: 'Read the fig' },
    ])
  })

  it('appends after the highest existing take so page numbers stay valid', () => {
    const plan = planTakes(
      [take0, { ...take0, n: 6 }, { ...take0, n: 3 }],
      [{ text: 'a', input: 'a', count: 2 }],
    )
    expect(plan.map((t) => t.n)).toEqual([7, 8])
  })

  it('plans nothing for --takes 0', () => {
    expect(planTakes([take0], [{ text: 'a', input: 'a', count: 0 }])).toEqual(
      [],
    )
  })
})

describe('spliceAudio', () => {
  const docs = (): CanonDoc[] => [
    {
      rel: SHORT_I,
      doc: {
        utterances: [
          utt('word.p2.read', 'Read the fig.'),
          utt('word.p2.hint', "Let's look. Fig."),
        ],
      },
    },
    {
      rel: 'public/canon/word-song/level-1/cvc-words-short-o.json',
      doc: { utterances: [utt('word.p9.read', 'Read the fig.')] },
    },
  ]

  it('gives every utterance with the same input the same bytes, and nothing else', () => {
    const d = docs()
    const touched = spliceAudio(d, 'Read the fig.', 'NEW')
    expect(touched).toEqual([
      { file: SHORT_I, utteranceId: 'word.p2.read' },
      {
        file: 'public/canon/word-song/level-1/cvc-words-short-o.json',
        utteranceId: 'word.p9.read',
      },
    ])
    expect(d[0].doc.utterances[0].audio).toEqual({
      kind: 'inline',
      base64: 'NEW',
      mime: 'audio/mpeg',
    })
    expect(d[1].doc.utterances[0].audio.base64).toBe('NEW')
    expect(d[0].doc.utterances[1].audio.base64).toBe('old')
  })

  it('matches on the rendered ElevenLabs input, not the raw caption', () => {
    const d: CanonDoc[] = [
      {
        rel: SHORT_I,
        doc: { utterances: [utt('word.p2.blend', 'f - i - g ... fig')] },
      },
    ]
    const input = renderElevenLabsText('f - i - g ... fig', tierFor(SHORT_I))
    expect(input).not.toBe('f - i - g ... fig')
    expect(spliceAudio(d, 'f - i - g ... fig', 'NEW')).toEqual([])
    expect(spliceAudio(d, input, 'NEW')).toEqual([
      { file: SHORT_I, utteranceId: 'word.p2.blend' },
    ])
  })
})

describe('takesPage', () => {
  const set: TakeSet = {
    file: SHORT_I,
    utteranceId: 'word.p2.hint',
    text: "Let's look. Fig.",
    tier: 'cvc-words-short-i',
    input: "Let's look. Fig.",
    takes: [
      { n: 1, input: "Let's look. Fig", hash: 'bbbbbbbbbb', seconds: 1.5 },
      { n: 0, input: "Let's look. Fig.", hash: 'aaaaaaaaaa', seconds: 1.25 },
    ],
  }
  const html = takesPage([
    {
      set,
      audio: new Map([
        [0, 'QUFB'],
        [1, 'QkJC'],
      ]),
    },
  ])

  it('inlines every take as a data URI with one Play button each', () => {
    expect(html.match(/<button /g)).toHaveLength(2)
    expect(html).toContain('data-src="data:audio/mpeg;base64,QUFB"')
    expect(html).toContain('data-src="data:audio/mpeg;base64,QkJC"')
    expect(html).not.toMatch(/src="(https?:|\/)/)
  })

  it('labels take 0 committed, marks variants, shows duration, escapes text', () => {
    expect(html.indexOf('Take 0')).toBeLessThan(html.indexOf('Take 1'))
    expect(html).toContain('Take 0<br><small>committed</small>')
    expect(html).toContain(
      '<code>Let&#39;s look. Fig</code> <small>(variant)</small>',
    )
    expect(html).toContain('1.25 s')
    expect(html).toContain(`<code>${SHORT_I}:word.p2.hint</code>`)
  })
})

describe('helpers', () => {
  it('audioHash uses the voice-QA scheme (SHA-256 of the base64 string)', () => {
    expect(audioHash('QUFB')).toBe(
      createHash('sha256').update('QUFB', 'utf8').digest('hex').slice(0, 10),
    )
  })

  it('tierFor maps canon paths to production tiers', () => {
    expect(tierFor(SHORT_I)).toBe('cvc-words-short-i')
    expect(tierFor('public/canon/math/level-1/add-to-10.json')).toBeUndefined()
    expect(
      tierFor('public/canon/word-song/level-1/letter-sounds-vowels.json'),
    ).toBe('letter-sounds')
  })
})
