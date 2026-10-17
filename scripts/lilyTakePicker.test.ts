import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { renderElevenLabsText } from '../api/_tts_elevenlabs'
import { tierFor } from './lilyCanonLib'
import {
  audioHash,
  bundledClips,
  envelopeCorr,
  keyMatches,
  parseApply,
  parseIds,
  parseKeyed,
  pickDistinct,
  planTakes,
  rmsEnvelope,
  spliceAudio,
  takesPage,
  type CanonDoc,
  type LineRef,
  type TakeSet,
} from './lilyTakePicker'

const SHORT_I = 'public/canon/word-song/level-1/cvc-words-short-i.json'
const PEEK = 'public/assets/audio/path/guide-session-peek-open-div-share.mp3'
const READ: LineRef = {
  kind: 'canon',
  file: SHORT_I,
  utteranceId: 'word.p2.read',
}

const utt = (id: string, text: string, base64 = 'old') => ({
  id,
  text,
  audio: { kind: 'inline', base64, mime: 'audio/mpeg' },
})

describe('argument parsing', () => {
  it('parses canon and MP3 lines, each optionally pinned to a git ref', () => {
    expect(
      parseIds(
        `${SHORT_I}:word.p2.read,${PEEK}@origin/devon/ng-sharing,${SHORT_I}:word.p2.hint@bdbac1f^`,
      ),
    ).toEqual([
      { line: READ, ref: undefined },
      { line: { kind: 'mp3', file: PEEK }, ref: 'origin/devon/ng-sharing' },
      {
        line: { kind: 'canon', file: SHORT_I, utteranceId: 'word.p2.hint' },
        ref: 'bdbac1f^',
      },
    ])
  })

  it('rejects a line that is neither a canon utterance nor an MP3', () => {
    expect(() => parseIds('word.p2.read')).toThrow(/bad entry/)
    expect(() => parseIds('public/x.txt:word.p2.read')).toThrow(/expected/)
  })

  it('parses --apply into line + take number, working tree only', () => {
    expect(parseApply(`${SHORT_I}:word.p2.read=4,${PEEK}=0`)).toEqual([
      { line: READ, take: 4 },
      { line: { kind: 'mp3', file: PEEK }, take: 0 },
    ])
    expect(() => parseApply(`${SHORT_I}:word.p2.read=two`)).toThrow(/take/)
    expect(() => parseApply(`${PEEK}@origin/main=1`)).toThrow(/working tree/)
  })

  it('collects repeatable keyed values, keeping "=" in the value', () => {
    const v = parseKeyed('--input-variant', [
      'word.p2.read=Read the fig!',
      'word.p2.read=Read the fig...',
      'x=a=b',
    ])
    expect(v.get('word.p2.read')).toEqual(['Read the fig!', 'Read the fig...'])
    expect(v.get('x')).toEqual(['a=b'])
    expect(() => parseKeyed('--input-variant', ['nope'])).toThrow(
      /input-variant/,
    )
  })

  it('matches a key on the whole id or its tail, never mid-name', () => {
    const mp3: LineRef = { kind: 'mp3', file: PEEK }
    expect(keyMatches(READ, 'word.p2.read')).toBe(true)
    expect(keyMatches(READ, `${SHORT_I}:word.p2.read`)).toBe(true)
    expect(keyMatches(READ, 'p2.read')).toBe(false)
    expect(keyMatches(mp3, 'guide-session-peek-open-div-share.mp3')).toBe(true)
    expect(keyMatches(mp3, 'div-share.mp3')).toBe(false)
  })
})

describe('planTakes', () => {
  const take0 = { n: 0, input: 'Read the fig.', hash: 'h', seconds: 1 }

  it('numbers fresh takes after the anchor, committed input first', () => {
    const plan = planTakes(
      [take0],
      [
        { text: 'Read the fig.', input: 'Read the fig.', count: 2 },
        { text: 'Read the fig!', input: 'Read the fig!', count: 1 },
      ],
    )
    expect(plan).toEqual([
      { n: 1, text: 'Read the fig.', input: 'Read the fig.' },
      { n: 2, text: 'Read the fig.', input: 'Read the fig.' },
      { n: 3, text: 'Read the fig!', input: 'Read the fig!' },
    ])
  })

  it('appends after the highest existing take so page numbers stay valid', () => {
    const plan = planTakes(
      [take0, { ...take0, n: 9 }, { ...take0, n: 3 }],
      [{ text: 'a', input: 'a', count: 2 }],
    )
    expect(plan.map((t) => t.n)).toEqual([10, 11])
  })

  it('plans nothing for --takes 0', () => {
    expect(planTakes([take0], [{ text: 'a', input: 'a', count: 0 }])).toEqual(
      [],
    )
  })
})

describe('spliceAudio', () => {
  const SHORT_O = 'public/canon/word-song/level-1/cvc-words-short-o.json'
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
      rel: SHORT_O,
      doc: { utterances: [utt('word.p9.read', 'Read the fig.')] },
    },
  ]

  it('gives every utterance with the same input the same bytes, and nothing else', () => {
    const d = docs()
    expect(spliceAudio(d, 'Read the fig.', 'NEW')).toEqual([
      READ,
      { kind: 'canon', file: SHORT_O, utteranceId: 'word.p9.read' },
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
      { kind: 'canon', file: SHORT_I, utteranceId: 'word.p2.blend' },
    ])
  })
})

describe('bundledClips', () => {
  it('lists the voice-QA page clips as repo paths with their text', () => {
    const clips = bundledClips(
      readFileSync(join(process.cwd(), 'public', 'voice-qa.html'), 'utf8'),
    )
    expect(clips).toContainEqual({
      file: 'public/assets/audio/path/guide-hub-suggest-math.mp3',
      text: "Let's grow a flower in Number Garden! Or pick Word Song.",
    })
    for (const c of clips)
      expect(c.file).toMatch(/^public\/assets\/audio\/.+\.mp3$/)
  })
})

describe('near-duplicate filter', () => {
  /** An envelope with bursts at the given frames. */
  const env = (len: number, bursts: number[]) =>
    Float64Array.from({ length: len }, (_, i) =>
      bursts.includes(i) ? 1 : 0.01,
    )

  it('rmsEnvelope is 20 ms RMS frames at 16 kHz', () => {
    const e = rmsEnvelope(new Float64Array(320 * 3 + 100).fill(0.5))
    expect(Array.from(e)).toEqual([0.5, 0.5, 0.5])
  })

  it('envelopeCorr is 1 for a copy, finds a shift within the lag window, and is low for different shapes', () => {
    const a = env(60, [5, 6, 20, 40])
    const shifted = env(60, [8, 9, 23, 43])
    expect(envelopeCorr(a, a)).toBeCloseTo(1, 6)
    expect(envelopeCorr(a, shifted)).toBeGreaterThan(0.99)
    expect(envelopeCorr(a, shifted, 0)).toBeLessThan(0.5)
    expect(envelopeCorr(a, env(60, [52, 55, 58]))).toBeLessThan(0.5)
  })

  it('drops takes too close to an anchor or to an earlier kept take', () => {
    const anchor = env(60, [5, 6, 20, 40])
    const verdicts = pickDistinct(
      [{ label: 'take 0', env: anchor }],
      [
        { n: 3, env: env(60, [30, 31, 50]) },
        { n: 1, env: env(60, [5, 6, 20, 40]) },
        { n: 2, env: env(60, [12, 13, 45]) },
        { n: 4, env: env(60, [12, 13, 45]) },
      ],
      0.95,
    )
    expect(verdicts.map((v) => [v.n, v.keep, v.nearest])).toEqual([
      [1, false, 'take 0'],
      [2, true, expect.any(String)],
      [3, true, expect.any(String)],
      [4, false, 'take 2'],
    ])
    expect(verdicts[0].r).toBeCloseTo(1, 6)
    // r0 is always against take 0, even when the nearest is a kept take.
    expect(verdicts[3].r0).toBeCloseTo(
      envelopeCorr(anchor, env(60, [12, 13, 45])),
      9,
    )
    expect(verdicts[3].r0).toBeLessThan(verdicts[3].r)
  })
})

describe('takesPage', () => {
  const set: TakeSet = {
    line: { kind: 'canon', file: SHORT_I, utteranceId: 'word.p2.hint' },
    text: "Let's look. Fig.",
    tier: 'cvc-words-short-i',
    input: "Let's look. Fig.",
    references: [],
    takes: [
      {
        n: 2,
        input: "Let's look. Fig!",
        seed: 42,
        hash: 'cccccccccc',
        seconds: 1.5,
      },
      {
        n: 1,
        input: "Let's look. Fig.",
        seed: 7,
        hash: 'bbbbbbbbbb',
        seconds: 1.5,
      },
      { n: 0, input: "Let's look. Fig.", hash: 'aaaaaaaaaa', seconds: 1.25 },
    ],
  }
  const html = takesPage(
    [
      {
        set,
        audio: new Map([
          [0, 'QUFB'],
          [1, 'QkJC'],
          [2, 'Q0ND'],
        ]),
        verdicts: [
          { n: 1, keep: false, r0: 0.991, r: 0.991, nearest: 'take 0' },
          { n: 2, keep: true, r0: 0.812, r: 0.8, nearest: 'take 0' },
        ],
      },
    ],
    0.95,
  )

  it('inlines take 0 and the distinct takes only, one Play button each', () => {
    expect(html.match(/<button /g)).toHaveLength(2)
    expect(html).toContain('data-src="data:audio/mpeg;base64,QUFB"')
    expect(html).toContain('data-src="data:audio/mpeg;base64,Q0ND"')
    expect(html).not.toContain('QkJC')
    expect(html).not.toMatch(/src="(https?:|\/)/)
  })

  it('labels takes with input, seed, duration and lists the dropped ones', () => {
    expect(html).toContain('Take 0<br><small>committed</small>')
    expect(html).toContain(
      '<code>Let&#39;s look. Fig!</code> <small>(variant)</small>',
    )
    expect(html).toContain('seed 42')
    expect(html).toContain('r 0.812 to take 0')
    expect(html).toContain('1.25 s')
    expect(html).toContain('take 1 (0.991 vs take 0)')
    expect(html).toContain('1 distinct fresh take(s)')
  })
})

describe('helpers', () => {
  it('audioHash follows the voice-QA page: base64 string for canon, bytes for MP3s', () => {
    const bytes = Buffer.from('AAA')
    const sha = (x: string | Buffer) =>
      createHash('sha256').update(x).digest('hex').slice(0, 10)
    expect(audioHash(READ, bytes)).toBe(sha('QUFB'))
    expect(audioHash({ kind: 'mp3', file: PEEK }, bytes)).toBe(sha(bytes))
  })

  it('tierFor maps canon paths to production tiers', () => {
    expect(tierFor(SHORT_I)).toBe('cvc-words-short-i')
    expect(tierFor('public/canon/math/level-1/add-to-10.json')).toBeUndefined()
    expect(
      tierFor('public/canon/word-song/level-1/letter-sounds-vowels.json'),
    ).toBe('letter-sounds')
  })
})
