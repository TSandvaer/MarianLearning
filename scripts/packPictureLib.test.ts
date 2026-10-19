/**
 * @vitest-environment node
 *
 * Pure helpers behind scripts/generatePackPictures.ts: manifest validation,
 * prompt building, spend math, the --pick mapping, CLI args, retry + pool.
 */
import { existsSync, readFileSync } from 'node:fs'
import { APIConnectionError, APIConnectionTimeoutError, APIError } from 'openai'
import { describe, expect, it, vi } from 'vitest'

import { AVATAR_IDS } from '@marian/core/learners'

import {
  anchorRelPaths,
  asSentence,
  backoffMs,
  budgetAllows,
  buildPrompt,
  buildScenePrompt,
  CLAY_ANCHORS,
  CLAY_STYLE_INSTRUCTION,
  classifyApiError,
  costFromUsage,
  estimateCallCost,
  isAvatarDest,
  isBillingError,
  ledgerLine,
  parseCli,
  parseManifest,
  parsePickArg,
  parseSceneManifest,
  planPicks,
  PACK_RULES,
  planScenePicks,
  runPool,
  SCENE_RULES,
  selectEntries,
  selectRows,
  STYLE_INSTRUCTION,
  sumLedger,
  variantsOnDisk,
  withRetry,
} from './packPictureLib.ts'
import type {
  LedgerEntry,
  PictureManifestEntry,
  SceneManifestEntry,
} from './packPictureLib.ts'

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
  subject: 'A hen standing, seen from the side.',
  avoid: [],
  distinctFrom: [],
  ...over,
})

/** A real SDK error, built the way the SDK builds one from an HTTP response. */
function sdkError(
  status: number,
  body: { type?: string; code?: string; message?: string },
  retryAfter?: string,
): APIError {
  return APIError.generate(
    status,
    { error: { message: 'error', ...body } },
    undefined,
    new Headers(retryAfter ? { 'retry-after': retryAfter } : {}),
  )
}

const CREDIT_EXHAUSTED = () =>
  sdkError(429, {
    type: 'insufficient_quota',
    code: 'credit_balance_exhausted',
    message: 'Your organization has no prepaid credits remaining.',
  })

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
        'A small orange tabby cat sitting, seen from the front, with pointed ears and a long curled tail.',
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
        ...row({ subject: '  A hen.  ', avoid: ['a duck', '  '] }),
        notes: 'kyle',
      },
    ])
    expect(e).toEqual(row({ subject: 'A hen.', avoid: ['a duck'] }))
  })

  it('keeps style "clay", leaves it absent otherwise, rejects any other', () => {
    const [clay, plain] = parseManifest([
      row({ word: 'avatar-fox', style: 'clay' }),
      row(),
    ])
    expect(clay.style).toBe('clay')
    expect('style' in plain).toBe(false)
    expect(() =>
      parseManifest([{ ...row(), style: 'pack' } as unknown]),
    ).toThrow(/"style" must be "clay" or absent, got "pack"/)
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
  // The real manifest's dad row (PR #579): one capitalised sentence.
  const dad = row({
    subject:
      'A dad and his small daughter standing side by side, facing the viewer and holding hands.',
    avoid: ['one man standing alone', "a mother's long hair or dress"],
  })

  it('lets a one-sentence subject stand as its own sentence', () => {
    expect(buildPrompt(dad)).toBe(
      'Subject: A dad and his small daughter standing side by side, facing the viewer and ' +
        "holding hands. Draw this subject as a single children's picture-book illustration in " +
        'exactly the same art style as the reference pictures: the same soft line weight, the same ' +
        'flat soft colours and gentle cel-shading, the same simplicity and finish. The references ' +
        'show the style only; do not copy their subjects. Show only the subject, with no other ' +
        'objects, people or animals, centred and filling about 70% of a square frame, on a fully ' +
        'transparent background. No scene, no ground, no drop shadow, no border, no text or ' +
        "letters, and no faces on objects. Must not look like: one man standing alone; a mother's " +
        'long hair or dress.',
    )
  })

  it('never splices the sentence into a noun slot', () => {
    const p = buildPrompt(dad)
    expect(p).not.toMatch(/\. as a/)
    expect(p).not.toMatch(/Draw A /)
  })

  it("carries Kyle's pack-wide rules on every prompt", () => {
    for (const e of parseManifest(FIXTURE)) {
      const p = buildPrompt(e)
      expect(p).toContain('Show only the subject')
      expect(p).toContain('No scene')
      expect(p).toContain('no drop shadow')
      expect(p).toContain('no text or letters')
      expect(p).toContain('no faces on objects')
      expect(p).not.toMatch(/cream/i)
    }
  })

  it('turns a bare noun phrase into a sentence', () => {
    expect(buildPrompt(row({ subject: 'a red apple' }))).toMatch(
      /^Subject: A red apple\. Draw this subject /,
    )
  })

  it('keeps a $ in the subject literally', () => {
    expect(buildPrompt(row({ subject: 'A tag that says $& 5.' }))).toMatch(
      /^Subject: A tag that says \$& 5\. Draw/,
    )
  })

  it('omits the avoid clause when the list is empty', () => {
    expect(buildPrompt(row({ avoid: [] }))).not.toContain('Must not look like')
  })

  it('a clay row swaps the style sentence and keeps the pack rules', () => {
    const p = buildPrompt(row({ style: 'clay' }))
    expect(p).toContain(CLAY_STYLE_INSTRUCTION)
    expect(p).not.toContain(STYLE_INSTRUCTION)
    expect(p).toContain(PACK_RULES)
    expect(p).not.toMatch(/picture-book/)
  })

  it('a clay row uses the committed clay path art as anchors', () => {
    expect(anchorRelPaths('clay')).toEqual([...CLAY_ANCHORS])
    expect(anchorRelPaths()).toEqual(
      ['hen', 'sack', 'wing'].map(
        (w) => `design/references/picture-pack/anchors-openai/anchor-${w}.png`,
      ),
    )
    for (const p of CLAY_ANCHORS) expect(existsSync(repoFile(p)), p).toBe(true)
  })

  it('asSentence: trims, capitalises, adds a full stop only when missing', () => {
    expect(asSentence('  a hen  ')).toBe('A hen.')
    expect(asSentence('A hen.')).toBe('A hen.')
    expect(asSentence('A hen!')).toBe('A hen!')
    expect(asSentence('')).toBe('')
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

  it('prices a real n = 2 pack call (the input images billed per image)', () => {
    // The ledger's cake line (2026-10-16): 2 x 3,072 image-in, 422 text-in.
    const c = costFromUsage({
      input_tokens: 6566,
      input_tokens_details: { image_tokens: 6144, text_tokens: 422 },
      output_tokens: 878,
    })
    expect(c.costUsd).toBe(0.077602)
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
    // 2 x 3 x 1024 x 8 + 2 x ceil(400 / 4) x 5 + 2 x 439 x 30 = 76,492 micro-dollars
    expect(estimateCallCost(2, 400)).toEqual({
      imageInTokens: 6144,
      textInTokens: 200,
      outputTokens: 878,
      costUsd: 0.076492,
    })
    expect(estimateCallCost(1, 0).costUsd).toBe(0.037746)
  })

  it('bills the input images once per image returned, refs included', () => {
    // A scene: 3 anchors + 3 refs, n = 2 → 2 x 6 x 1024 image-in tokens.
    expect(estimateCallCost(2, 400, 6)).toEqual({
      imageInTokens: 12288,
      textInTokens: 200,
      outputTokens: 878,
      costUsd: 0.125644,
    })
  })

  it('bills the text input once per image returned', () => {
    expect(estimateCallCost(1, 804).textInTokens).toBe(201)
    // The cake call: an 804-char prompt, n = 2. Its ledger line reports
    // 6,144 image-in, 422 text-in (about 2 x 211) and 878 out, $0.077602.
    const cake = estimateCallCost(2, 804)
    expect(cake).toEqual({
      imageInTokens: 6144,
      textInTokens: 402,
      outputTokens: 878,
      costUsd: 0.077502,
    })
    expect(Math.abs(cake.costUsd - 0.077602)).toBeLessThan(0.0002)
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

describe('variantsOnDisk', () => {
  it("lists one word's variant numbers in order, ignoring other files", () => {
    const files = [
      'cat__v2.png',
      'cat__v10.png',
      'cat__v1.png',
      'catfish__v3.png',
      'cat__v1.webp',
      'cat__vx.png',
      'cat__v0.png',
      'contact-sheet.png',
    ]
    expect(variantsOnDisk(files, 'cat')).toEqual([1, 2, 10])
    expect(variantsOnDisk(files, 'hat')).toEqual([])
  })
})

describe('parseCli', () => {
  it('defaults to 2 variants, no budget, no force, the real manifest', () => {
    expect(parseCli(['--batch', '3'])).toEqual({
      mode: 'generate',
      set: 'pack',
      selection: { kind: 'batch', batch: 3 },
      variants: 2,
      dryRun: false,
      budgetUsd: undefined,
      force: false,
      manifestPath: 'design/word-song/picture-manifest.json',
    })
  })

  it('parses --words, --variants, --budget, --force, --dry-run, --manifest', () => {
    expect(
      parseCli([
        '--words',
        'hen, sack',
        '--variants',
        '3',
        '--budget',
        '2.5',
        '--force',
        '--dry-run',
        '--manifest',
        'x.json',
      ]),
    ).toEqual({
      mode: 'generate',
      set: 'pack',
      selection: { kind: 'words', words: ['hen', 'sack'] },
      variants: 3,
      dryRun: true,
      budgetUsd: 2.5,
      force: true,
      manifestPath: 'x.json',
    })
  })

  it('parses --pick', () => {
    expect(parseCli(['--pick', 'hen=v2'])).toEqual({
      mode: 'pick',
      set: 'pack',
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
    expect(() => parseCli(['--pick', 'hen=v1', '--force'])).toThrow(
      'do not apply to --pick',
    )
    expect(() => parseCli(['--batch', '1', '--quality', 'high'])).toThrow()
  })
})

describe('errors and retry', () => {
  it('stops the run when prepaid credit is exhausted (429 credit_balance_exhausted)', () => {
    const err = CREDIT_EXHAUSTED()
    expect(err.status).toBe(429)
    expect(isBillingError(err)).toBe(true)
    expect(classifyApiError(err)).toBe('fatal')
  })

  it('treats every billing / quota / spend-limit code as fatal', () => {
    for (const body of [
      { type: 'insufficient_quota', code: 'insufficient_quota' },
      { type: 'insufficient_quota', code: 'something_new' },
      { code: 'organization_spend_limit_exceeded' },
      { code: 'project_spend_limit_exceeded' },
      { code: 'organization_usage_limit_exceeded' },
    ]) {
      expect(classifyApiError(sdkError(429, body))).toBe('fatal')
    }
    // Any status: a billing code on a 400 still stops the run.
    expect(
      classifyApiError(sdkError(400, { code: 'billing_limit_reached' })),
    ).toBe('fatal')
  })

  it('classifies the other API errors', () => {
    expect(
      classifyApiError(
        sdkError(429, { type: 'requests', code: 'rate_limit_exceeded' }),
      ),
    ).toBe('retry')
    expect(classifyApiError(sdkError(500, {}))).toBe('retry')
    expect(classifyApiError(sdkError(503, {}))).toBe('retry')
    expect(classifyApiError(sdkError(401, {}))).toBe('fatal')
    expect(classifyApiError(sdkError(403, {}))).toBe('fatal')
    expect(classifyApiError(sdkError(404, { code: 'model_not_found' }))).toBe(
      'fatal',
    )
    expect(
      classifyApiError(sdkError(400, { code: 'moderation_blocked' })),
    ).toBe('word')
    expect(classifyApiError(new APIConnectionError({ message: 'reset' }))).toBe(
      'retry',
    )
    expect(classifyApiError(new APIConnectionTimeoutError())).toBe('word')
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
      .mockRejectedValueOnce(
        sdkError(429, { code: 'rate_limit_exceeded' }, '3'),
      )
      .mockRejectedValueOnce(sdkError(502, {}))
      .mockResolvedValueOnce('ok')
    await expect(withRetry(fn, { maxRetries: 4, sleep })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls).toEqual([[3000], [4000]])
  })

  it('does not retry a 400 or an out-of-credit 429', async () => {
    const sleep = vi.fn(async () => {})
    for (const err of [sdkError(400, {}), CREDIT_EXHAUSTED()]) {
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(err)
      await expect(withRetry(fn, { maxRetries: 4, sleep })).rejects.toBe(err)
      expect(fn).toHaveBeenCalledTimes(1)
    }
    expect(sleep).not.toHaveBeenCalled()
  })

  it('gives up after maxRetries', async () => {
    const sleep = vi.fn(async () => {})
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(sdkError(500, { message: 'boom' }))
    await expect(withRetry(fn, { maxRetries: 2, sleep })).rejects.toThrow(
      '500 boom',
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

// ── --scenes (content-wave-3.md § 6) ────────────────────────────────────────

const repoFile = (rel: string) => new URL(`../${rel}`, import.meta.url)
const readRepoJson = (rel: string) =>
  JSON.parse(readFileSync(repoFile(rel), 'utf8')) as unknown

const scene = (over: Partial<SceneManifestEntry> = {}): SceneManifestEntry => ({
  scene: 'fox-1',
  tier: 'fox-stories',
  batch: 1,
  subject: 'The fox sitting on a striped rug.',
  avoid: [],
  refs: ['fox', 'rug'],
  ...over,
})

describe('the scene manifest', () => {
  const scenes = parseSceneManifest(
    readRepoJson('design/word-song/scene-manifest.json'),
  )
  const pack = parseManifest(
    readRepoJson('design/word-song/picture-manifest.json'),
  )

  it('holds the 32 stories: fox, hen, bug, sheep 1-8 in batches 1-4', () => {
    const ids = ['fox', 'hen', 'bug', 'sheep'].flatMap((a) =>
      Array.from({ length: 8 }, (_, i) => `${a}-${i + 1}`),
    )
    expect(scenes.map((e) => e.scene)).toEqual(ids)
    for (const e of scenes) {
      const animal = e.scene.split('-')[0]
      expect(e.tier).toBe(`${animal}-stories`)
      expect(e.batch).toBe({ fox: 1, hen: 2, bug: 3, sheep: 4 }[animal])
      expect(e.avoid.length).toBeGreaterThan(0)
    }
  })

  it('every ref is a pack word whose chip picture ships', () => {
    const words = new Set(pack.map((e) => e.word))
    for (const e of scenes) {
      for (const w of e.refs) {
        expect(words.has(w), `${e.scene}: ${w}`).toBe(true)
        expect(
          existsSync(repoFile(`mobile/assets/pictures/${w}.webp`)),
          `${e.scene}: ${w}.webp`,
        ).toBe(true)
      }
    }
  })
})

describe('the avatar manifest (learner-profiles.md § 9, T2)', () => {
  const avatars = parseManifest(
    readRepoJson('design/native/avatar-manifest.json'),
  )
  const pack = parseManifest(
    readRepoJson('design/word-song/picture-manifest.json'),
  )

  it('holds one clay row per AvatarId, in picker order, in batch 15', () => {
    expect(avatars.map((e) => e.word)).toEqual(
      AVATAR_IDS.map((id) => `avatar-${id}`),
    )
    for (const e of avatars) {
      expect(e.style).toBe('clay')
      expect(e.tier).toBe('avatars')
      expect(e.batch).toBe(15)
      expect(e.avoid).toContain('anything red')
      expect(e.distinctFrom).toHaveLength(7)
    }
  })

  it("picks straight into the app's avatar files, not the embed staging", () => {
    const picks = planPicks(
      parsePickArg(avatars.map((e) => `${e.word}=v1`).join(',')),
      avatars,
    )
    expect(picks.map((c) => c.dest)).toEqual(
      AVATAR_IDS.map((id) => `mobile/assets/avatars/avatar-${id}.webp`),
    )
    expect(picks.map((c) => isAvatarDest(c.dest))).toEqual(
      AVATAR_IDS.map(() => true),
    )
    expect(picks[0].src).toBe(
      'design/references/picture-pack/openai/batch-15/avatar-fox__v1.png',
    )
    const [packPick] = planPicks(parsePickArg('cat=v1'), pack)
    expect(isAvatarDest(packPick.dest)).toBe(false)
  })

  it('shares no batch or key with the word pack', () => {
    const batches = new Set(pack.map((e) => e.batch))
    const words = new Set(pack.map((e) => e.word))
    for (const e of avatars) {
      expect(batches.has(e.batch)).toBe(false)
      expect(words.has(e.word)).toBe(false)
    }
  })
})

describe('parseSceneManifest', () => {
  it('trims the subject and avoid list like the pack', () => {
    const [e] = parseSceneManifest([
      { ...scene({ subject: '  A fox.  ', avoid: ['a table', ' '] }) },
    ])
    expect(e).toEqual(scene({ subject: 'A fox.', avoid: ['a table'] }))
  })

  it('collects every problem, refs included', () => {
    let msg = ''
    try {
      parseSceneManifest([
        scene({ refs: ['fox', 'rug', 'cup', 'hat', 'box'] }),
        scene({ scene: 'fox-2', refs: [] }),
        scene({ scene: 'fox-3', refs: ['fox', 'fox'] }),
        { ...scene({ scene: 'fox-4' }), refs: 'fox' },
        scene({ scene: 'fox-1' }),
        { ...scene({ scene: 'Fox 6' }), subject: '' },
      ])
    } catch (err) {
      msg = (err as Error).message
    }
    expect(msg).toContain('Manifest has 7 problem(s)')
    expect(msg).toContain('entry 0 ("fox-1"): "refs" must be 1-4 pack words')
    expect(msg).toContain('entry 1 ("fox-2"): "refs" must be 1-4 pack words')
    expect(msg).toContain('entry 2 ("fox-3"): "refs" names a word twice')
    expect(msg).toContain('entry 3 ("fox-4"): "refs" must be 1-4 pack words')
    expect(msg).toContain('entry 4 ("fox-1"): duplicate scene')
    expect(msg).toContain(
      'entry 5 ("Fox 6"): "scene" must be a lower-case slug',
    )
    expect(msg).toContain(
      'entry 5 ("Fox 6"): "subject" must be a non-empty string',
    )
  })
})

describe('buildScenePrompt', () => {
  it('is subject + scene style + scene rules + a "Do not show" clause', () => {
    expect(
      buildScenePrompt(
        scene({
          subject:
            'The fox beside an open cardboard box with a hat inside, its top showing.',
          avoid: ['the fox wearing the hat'],
        }),
      ),
    ).toBe(
      'Subject: The fox beside an open cardboard box with a hat inside, its top showing. ' +
        "Draw this subject as a single children's picture-book illustration in exactly the same " +
        'art style as the reference pictures: the same soft line weight, the same flat soft ' +
        'colours and gentle cel-shading, the same simplicity and finish. The first 3 reference ' +
        'pictures show the style only; do not copy their subjects. The other reference pictures ' +
        'show the characters and objects of this scene. Show exactly the characters and objects ' +
        'named, each drawn like its reference picture, in one simple scene on a soft cream ' +
        'background that fills the square. Nothing else: no other animals, people or objects, no ' +
        'text or letters, no faces on objects. Do not show: the fox wearing the hat.',
    )
  })

  it("carries the spec's SCENE_RULES and none of the pack's single-subject rules", () => {
    for (const e of parseSceneManifest(
      readRepoJson('design/word-song/scene-manifest.json'),
    )) {
      const p = buildScenePrompt(e)
      expect(p).toContain(SCENE_RULES)
      expect(p).not.toContain('No scene')
      expect(p).not.toContain('transparent')
      expect(p).not.toContain('Must not look like')
      expect(p).not.toContain('The references show the style only')
    }
  })

  it('omits the avoid clause when the list is empty', () => {
    expect(buildScenePrompt(scene({ avoid: [] }))).not.toContain('Do not show')
  })
})

describe('scene selection and picks', () => {
  const m = [
    scene(),
    scene({ scene: 'fox-2' }),
    scene({ scene: 'hen-1', tier: 'hen-stories', batch: 2 }),
  ]

  it('selects all, a batch, or ids in the requested order', () => {
    const key = (e: SceneManifestEntry) => e.scene
    expect(selectRows(m, { kind: 'all' }, key).map(key)).toEqual([
      'fox-1',
      'fox-2',
      'hen-1',
    ])
    expect(selectRows(m, { kind: 'batch', batch: 2 }, key).map(key)).toEqual([
      'hen-1',
    ])
    expect(
      selectRows(m, { kind: 'words', words: ['hen-1', 'fox-1'] }, key).map(key),
    ).toEqual(['hen-1', 'fox-1'])
    expect(() =>
      selectRows(m, { kind: 'words', words: ['fox-9'] }, key),
    ).toThrow('Not in the manifest: fox-9')
  })

  it("maps a pick to its scenes batch variant and the app's story file", () => {
    expect(planScenePicks(parsePickArg('fox-2=v1,hen-1=v3'), m)).toEqual([
      {
        word: 'fox-2',
        src: 'design/references/picture-pack/openai/scenes/batch-1/fox-2__v1.png',
        dest: 'mobile/assets/scenes/story-fox-2.webp',
      },
      {
        word: 'hen-1',
        src: 'design/references/picture-pack/openai/scenes/batch-2/hen-1__v3.png',
        dest: 'mobile/assets/scenes/story-hen-1.webp',
      },
    ])
    expect(() => planScenePicks(parsePickArg('bug-1=v1'), m)).toThrow(
      '--pick: not in the manifest: bug-1',
    )
  })
})

describe('parseCli --scenes', () => {
  it('alone selects every scene from the scene manifest', () => {
    expect(parseCli(['--scenes', '--dry-run'])).toEqual({
      mode: 'generate',
      set: 'scenes',
      selection: { kind: 'all' },
      variants: 2,
      dryRun: true,
      budgetUsd: undefined,
      force: false,
      manifestPath: 'design/word-song/scene-manifest.json',
    })
  })

  it('takes --batch, scene ids in --words, --budget and --force', () => {
    expect(parseCli(['--scenes', '--batch', '2'])).toMatchObject({
      set: 'scenes',
      selection: { kind: 'batch', batch: 2 },
    })
    expect(
      parseCli([
        '--scenes',
        '--words',
        'fox-3,fox-8',
        '--budget',
        '3.3',
        '--force',
      ]),
    ).toMatchObject({
      set: 'scenes',
      selection: { kind: 'words', words: ['fox-3', 'fox-8'] },
      budgetUsd: 3.3,
      force: true,
    })
  })

  it('picks scenes', () => {
    expect(parseCli(['--scenes', '--pick', 'fox-1=v2'])).toEqual({
      mode: 'pick',
      set: 'scenes',
      picks: [{ word: 'fox-1', variant: 2 }],
      dryRun: false,
      manifestPath: 'design/word-song/scene-manifest.json',
    })
  })

  it('rejects two selections; the pack still needs one', () => {
    expect(() =>
      parseCli(['--scenes', '--batch', '1', '--words', 'fox-1']),
    ).toThrow('at most one of')
    expect(() => parseCli(['--dry-run'])).toThrow('exactly one of')
  })
})
