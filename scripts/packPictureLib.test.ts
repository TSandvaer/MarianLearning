/**
 * @vitest-environment node
 *
 * Pure helpers behind scripts/generatePackPictures.ts: manifest validation,
 * prompt building, spend math, the --pick mapping, CLI args, retry + pool.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import {
  backoffMs,
  budgetAllows,
  buildPrompt,
  classifyApiError,
  costFromUsage,
  estimateCallCost,
  ledgerLine,
  parseCli,
  parseManifest,
  parsePickArg,
  planPicks,
  runPool,
  selectEntries,
  sumLedger,
  withRetry,
} from './packPictureLib.ts'
import type { LedgerEntry, PictureManifestEntry } from './packPictureLib.ts'

const FIXTURE = JSON.parse(
  readFileSync(
    new URL('./fixtures/pack-picture-manifest.fixture.json', import.meta.url),
    'utf8',
  ),
) as unknown

const row = (
  over: Partial<PictureManifestEntry> = {},
): PictureManifestEntry => ({
  word: 'hen',
  tier: 'short-e',
  batch: 1,
  subject: 'a hen standing, seen from the side',
  avoid: [],
  distinctFrom: [],
  ...over,
})

function apiError(status: number, code?: string, retryAfter?: string): Error {
  const err = new Error(`HTTP ${status}`) as Error & {
    status: number
    code?: string
    headers: Headers
  }
  err.status = status
  err.code = code
  err.headers = new Headers(retryAfter ? { 'retry-after': retryAfter } : {})
  return err
}

describe('parseManifest', () => {
  it('accepts the stub fixture', () => {
    const m = parseManifest(FIXTURE)
    expect(m.map((e) => e.word)).toEqual([
      'cat',
      'hat',
      'pig',
      'sack',
      'bus',
      'sun',
    ])
    expect(m[0]).toEqual({
      word: 'cat',
      tier: 'short-a',
      batch: 1,
      subject:
        'a small orange tabby cat sitting, seen from the front, pointed ears, long curled tail',
      avoid: ['a dog', 'a fox'],
      distinctFrom: ['dog', 'fox'],
    })
  })

  it('rejects a non-array and an empty array', () => {
    expect(() => parseManifest({ word: 'hen' })).toThrow(/JSON array/)
    expect(() => parseManifest([])).toThrow(/empty/)
  })

  it('collects every problem into one error', () => {
    const bad = [
      {
        word: '../etc',
        tier: 'short-e',
        batch: 1,
        subject: 'x',
        avoid: [],
        distinctFrom: [],
      },
      {
        word: 'hen',
        tier: 'Short E',
        batch: 0,
        subject: ' ',
        avoid: 'a dog',
        distinctFrom: [1],
      },
      'not an object',
    ]
    let message = ''
    try {
      parseManifest(bad)
    } catch (err) {
      message = (err as Error).message
    }
    expect(message).toMatch(/7 problem\(s\)/)
    expect(message).toContain(
      'entry 0 ("../etc"): "word" must be a lower-case slug',
    )
    expect(message).toContain(
      'entry 1 ("hen"): "tier" must be a lower-case slug',
    )
    expect(message).toContain(
      'entry 1 ("hen"): "batch" must be a positive integer',
    )
    expect(message).toContain(
      'entry 1 ("hen"): "subject" must be a non-empty string',
    )
    expect(message).toContain(
      'entry 1 ("hen"): "avoid" must be an array of strings',
    )
    expect(message).toContain(
      'entry 1 ("hen"): "distinctFrom" must be an array of strings',
    )
    expect(message).toContain('entry 2: must be an object')
  })

  it('rejects duplicate words and fractional batches', () => {
    expect(() => parseManifest([row(), row()])).toThrow(
      /entry 1 \("hen"\): duplicate word/,
    )
    expect(() => parseManifest([row({ batch: 1.5 })])).toThrow(
      /positive integer/,
    )
  })

  it('ignores unknown keys, trims the subject, drops blank avoid items', () => {
    const [e] = parseManifest([
      {
        ...row({ subject: '  a hen  ', avoid: ['a duck', '  '] }),
        notes: 'kyle',
      },
    ])
    expect(e).toEqual(row({ subject: 'a hen', avoid: ['a duck'] }))
  })
})

describe('selectEntries', () => {
  const m = parseManifest(FIXTURE)

  it('selects a batch in manifest order', () => {
    expect(
      selectEntries(m, { kind: 'batch', batch: 2 }).map((e) => e.word),
    ).toEqual(['bus', 'sun'])
  })

  it('names the batches present when the batch is empty', () => {
    expect(() => selectEntries(m, { kind: 'batch', batch: 9 })).toThrow(
      'No manifest entries in batch 9. Batches present: 1, 2',
    )
  })

  it('selects words in the requested order, de-duplicated', () => {
    expect(
      selectEntries(m, { kind: 'words', words: ['sun', 'cat', 'sun'] }).map(
        (e) => e.word,
      ),
    ).toEqual(['sun', 'cat'])
  })

  it('lists every unknown word', () => {
    expect(() =>
      selectEntries(m, { kind: 'words', words: ['cat', 'yak', 'emu'] }),
    ).toThrow('Not in the manifest: yak, emu')
  })
})

describe('buildPrompt', () => {
  it('builds the bake-off style prompt with a transparent-background clause', () => {
    expect(buildPrompt(row({ subject: 'a red apple' }))).toBe(
      "Draw a red apple as a single children's picture-book illustration in exactly the same art " +
        'style as the reference pictures: the same soft line weight, the same flat soft colours and ' +
        'gentle cel-shading, the same simplicity and finish. The references show the style only; do ' +
        'not copy their subjects. One subject, centred, filling about 70% of a square frame, on a ' +
        'fully transparent background with no scenery, no shadow, no ground, no text, no border.',
    )
  })

  it('does not ask for a cream background', () => {
    expect(buildPrompt(row())).not.toMatch(/cream/i)
  })

  it('appends the avoid list from the manifest', () => {
    expect(buildPrompt(row({ avoid: ['a duck', 'a rooster'] }))).toMatch(
      / no border\. Must not look like: a duck; a rooster\.$/,
    )
  })

  it('omits the avoid clause when the list is empty', () => {
    expect(buildPrompt(row({ avoid: [] }))).not.toContain('Must not look like')
  })
})

describe('spend math', () => {
  it('prices the measured single-image call at $0.038136', () => {
    // 3,072 image-in x $8/1M + 78 text-in x $5/1M + 439 out x $30/1M
    const c = costFromUsage({
      input_tokens: 3150,
      input_tokens_details: { image_tokens: 3072, text_tokens: 78 },
      output_tokens: 439,
      total_tokens: 3589,
    })
    expect(c).toEqual({
      imageInTokens: 3072,
      textInTokens: 78,
      outputTokens: 439,
      costUsd: 0.038136,
    })
  })

  it('prices two images in one call (input billed once)', () => {
    const c = costFromUsage({
      input_tokens: 3150,
      input_tokens_details: { image_tokens: 3072, text_tokens: 78 },
      output_tokens: 878,
    })
    expect(c.costUsd).toBe(0.051306)
  })

  it('prices all input at the image rate when the split is missing', () => {
    const c = costFromUsage({ input_tokens: 1000, output_tokens: 1000 })
    expect(c).toEqual({
      imageInTokens: 1000,
      textInTokens: 0,
      outputTokens: 1000,
      costUsd: 0.038,
    })
  })

  it('estimates a call from the measured tokens and prompt length', () => {
    // 3072 x 8 + ceil(400 / 4) x 5 + 2 x 439 x 30 = 51,416 micro-dollars
    expect(estimateCallCost(2, 400)).toEqual({
      imageInTokens: 3072,
      textInTokens: 100,
      outputTokens: 878,
      costUsd: 0.051416,
    })
    expect(estimateCallCost(1, 0).costUsd).toBe(0.037746)
  })

  it('sums the ledger without float drift and reports bad lines', () => {
    const text = [
      JSON.stringify({ costUsd: 0.1 }),
      '',
      JSON.stringify({ costUsd: 0.2 }),
      '{not json',
      JSON.stringify({ word: 'hen' }),
      JSON.stringify({ costUsd: 0.038136 }),
    ].join('\n')
    expect(sumLedger(text)).toEqual({
      totalUsd: 0.338136,
      entries: 3,
      badLines: [4, 5],
    })
  })

  it('round-trips a ledger line', () => {
    const entry: LedgerEntry = {
      ts: '2026-10-16T12:00:00.000Z',
      runId: 'r1',
      word: 'hen',
      batch: 1,
      model: 'gpt-image-2.5-flare',
      size: '1024x1024',
      quality: 'medium',
      n: 2,
      imageInTokens: 3072,
      textInTokens: 78,
      outputTokens: 878,
      costUsd: 0.051306,
      usage: { input_tokens: 3150, output_tokens: 878 },
    }
    const line = ledgerLine(entry)
    expect(line.endsWith('\n')).toBe(true)
    expect(JSON.parse(line)).toEqual(entry)
    expect(sumLedger(line + line).totalUsd).toBe(0.102612)
  })

  it('gates on ledger + in-flight + this estimate', () => {
    const base = { spentUsd: 1, reservedUsd: 0.5, estimateUsd: 0.5 }
    expect(budgetAllows({ ...base, budgetUsd: undefined })).toBe(true)
    expect(budgetAllows({ ...base, budgetUsd: 2 })).toBe(true) // exactly at budget
    expect(budgetAllows({ ...base, budgetUsd: 1.99 })).toBe(false)
    expect(budgetAllows({ ...base, reservedUsd: 0, budgetUsd: 1.5 })).toBe(true)
  })
})

describe('pick mapping', () => {
  const m = parseManifest(FIXTURE)

  it('parses word=vN pairs, with or without the v', () => {
    expect(parsePickArg('cat=v2, bus=1')).toEqual([
      { word: 'cat', variant: 2 },
      { word: 'bus', variant: 1 },
    ])
  })

  it('rejects malformed, zero and duplicate picks', () => {
    expect(() => parsePickArg('cat:v2')).toThrow('"cat:v2" is not word=vN')
    expect(() => parsePickArg('cat=v0')).toThrow('v1 or higher')
    expect(() => parsePickArg('cat=v1,cat=v2')).toThrow('"cat" is picked twice')
    expect(() => parsePickArg(' , ')).toThrow('word=vN pairs')
  })

  it('maps a pick to its batch variant and tier staging file', () => {
    expect(planPicks(parsePickArg('cat=v2,sack=v1,sun=v2'), m)).toEqual([
      {
        word: 'cat',
        src: 'design/references/picture-pack/openai/batch-1/cat__v2.png',
        dest: 'design/references/picture-pack/transparent-short-a/picture-cat.png',
      },
      {
        word: 'sack',
        src: 'design/references/picture-pack/openai/batch-1/sack__v1.png',
        dest: 'design/references/picture-pack/transparent-duck-words/picture-sack.png',
      },
      {
        word: 'sun',
        src: 'design/references/picture-pack/openai/batch-2/sun__v2.png',
        dest: 'design/references/picture-pack/transparent-short-u/picture-sun.png',
      },
    ])
  })

  it('rejects picks for words not in the manifest', () => {
    expect(() => planPicks(parsePickArg('cat=v1,yak=v2'), m)).toThrow(
      '--pick: not in the manifest: yak',
    )
  })
})

describe('parseCli', () => {
  it('defaults to 2 variants, no budget, the real manifest', () => {
    expect(parseCli(['--batch', '3'])).toEqual({
      mode: 'generate',
      selection: { kind: 'batch', batch: 3 },
      variants: 2,
      dryRun: false,
      budgetUsd: undefined,
      manifestPath: 'design/word-song/picture-manifest.json',
    })
  })

  it('parses --words, --variants, --budget, --dry-run, --manifest', () => {
    expect(
      parseCli([
        '--words',
        'hen, sack',
        '--variants',
        '3',
        '--budget',
        '2.5',
        '--dry-run',
        '--manifest',
        'x.json',
      ]),
    ).toEqual({
      mode: 'generate',
      selection: { kind: 'words', words: ['hen', 'sack'] },
      variants: 3,
      dryRun: true,
      budgetUsd: 2.5,
      manifestPath: 'x.json',
    })
  })

  it('parses --pick', () => {
    expect(parseCli(['--pick', 'hen=v2'])).toEqual({
      mode: 'pick',
      picks: [{ word: 'hen', variant: 2 }],
      dryRun: false,
      manifestPath: 'design/word-song/picture-manifest.json',
    })
  })

  it('requires exactly one of --batch, --words, --pick', () => {
    expect(() => parseCli([])).toThrow('exactly one of')
    expect(() => parseCli(['--batch', '1', '--words', 'hen'])).toThrow(
      'exactly one of',
    )
  })

  it('rejects bad values and unknown flags', () => {
    expect(() => parseCli(['--batch', '0'])).toThrow(
      '--batch must be a positive integer',
    )
    expect(() => parseCli(['--batch', '1', '--variants', '11'])).toThrow(
      '1..10',
    )
    expect(() => parseCli(['--batch', '1', '--variants', '2.5'])).toThrow(
      'integer',
    )
    expect(() => parseCli(['--batch', '1', '--budget', '0'])).toThrow(
      'positive USD',
    )
    expect(() => parseCli(['--batch', '1', '--budget', 'ten'])).toThrow(
      'positive USD',
    )
    expect(() => parseCli(['--pick', 'hen=v1', '--variants', '2'])).toThrow(
      'do not apply to --pick',
    )
    expect(() => parseCli(['--batch', '1', '--quality', 'high'])).toThrow()
  })
})

describe('errors and retry', () => {
  it('classifies API errors', () => {
    expect(classifyApiError(apiError(429, 'insufficient_quota'))).toBe('fatal')
    expect(classifyApiError(apiError(429, 'rate_limit_exceeded'))).toBe('retry')
    expect(classifyApiError(apiError(500))).toBe('retry')
    expect(classifyApiError(apiError(503))).toBe('retry')
    expect(classifyApiError(apiError(401))).toBe('fatal')
    expect(classifyApiError(apiError(403))).toBe('fatal')
    expect(classifyApiError(apiError(400))).toBe('word')
    expect(classifyApiError(new Error('ENOENT'))).toBe('word')
    expect(classifyApiError(undefined)).toBe('word')
  })

  it('backs off exponentially, capped, or by retry-after', () => {
    expect([0, 1, 2, 3, 10].map((a) => backoffMs(a))).toEqual([
      2000, 4000, 8000, 16000, 60000,
    ])
    expect(backoffMs(0, 7)).toBe(7000)
    expect(backoffMs(0, 600)).toBe(60000)
  })

  it('retries 429 / 5xx and then succeeds', async () => {
    const sleep = vi.fn(async () => {})
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(apiError(429, 'rate_limit_exceeded', '3'))
      .mockRejectedValueOnce(apiError(502))
      .mockResolvedValueOnce('ok')
    await expect(withRetry(fn, { maxRetries: 4, sleep })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls).toEqual([[3000], [4000]])
  })

  it('does not retry a 400 or an out-of-credit 429', async () => {
    const sleep = vi.fn(async () => {})
    for (const err of [apiError(400), apiError(429, 'insufficient_quota')]) {
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(err)
      await expect(withRetry(fn, { maxRetries: 4, sleep })).rejects.toBe(err)
      expect(fn).toHaveBeenCalledTimes(1)
    }
    expect(sleep).not.toHaveBeenCalled()
  })

  it('gives up after maxRetries', async () => {
    const sleep = vi.fn(async () => {})
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(apiError(500))
    await expect(withRetry(fn, { maxRetries: 2, sleep })).rejects.toThrow(
      'HTTP 500',
    )
    expect(fn).toHaveBeenCalledTimes(3)
  })
})

describe('runPool', () => {
  it('processes every item with at most `limit` in flight', async () => {
    let inFlight = 0
    let peak = 0
    const done: number[] = []
    await runPool([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (item) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 1 + (item % 3)))
      done.push(item)
      inFlight--
    })
    expect(peak).toBe(4)
    expect([...done].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('handles an empty list', async () => {
    const worker = vi.fn(async () => {})
    await runPool([], 4, worker)
    expect(worker).not.toHaveBeenCalled()
  })
})
