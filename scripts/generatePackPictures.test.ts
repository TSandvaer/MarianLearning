/**
 * @vitest-environment node
 *
 * generatePackPictures end to end against a temp repo root and a mocked
 * images.edit: files, ledger, budget stop, failure handling, skip-existing,
 * contact sheet, --pick, and the same for --scenes. No network, no key.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { APIError } from 'openai'
import type { ImagesResponse } from 'openai/resources/images'
import sharp from 'sharp'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { runGenerate, runPick } from './generatePackPictures.ts'
import type { Deps, EditImages } from './generatePackPictures.ts'
import {
  buildScenePrompt,
  CLAY_ANCHORS,
  CLAY_STYLE_INSTRUCTION,
  estimateCallCost,
  formatUsd,
  parseCli,
  PATHS,
  roundUsd,
} from './packPictureLib.ts'
import type { CliCommand, SceneManifestEntry } from './packPictureLib.ts'

const FIXTURE = 'scripts/fixtures/pack-picture-manifest.fixture.json'
const FIXTURE_JSON = readFileSync(
  new URL('./fixtures/pack-picture-manifest.fixture.json', import.meta.url),
)

let pngB64 = ''
let root = ''
let logs: string[] = []

beforeAll(async () => {
  const png = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 200, g: 80, b: 40, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
  pngB64 = png.toString('base64')
})

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'pack-pictures-'))
  logs = []
  mkdirSync(join(root, 'scripts/fixtures'), { recursive: true })
  writeFileSync(join(root, FIXTURE), FIXTURE_JSON)
  mkdirSync(join(root, PATHS.anchorsDir), { recursive: true })
  for (const w of ['hen', 'sack', 'wing']) {
    writeFileSync(
      join(root, PATHS.anchorsDir, `anchor-${w}.png`),
      Buffer.from(pngB64, 'base64'),
    )
  }
  // A "current" pack picture for cat only.
  mkdirSync(join(root, PATHS.currentPictures), { recursive: true })
  await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 0, g: 0, b: 255, alpha: 1 },
    },
  })
    .webp()
    .toFile(join(root, PATHS.currentPictures, 'cat.webp'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function okResponse(n: number, b64 = pngB64): ImagesResponse {
  return {
    created: 0,
    data: Array.from({ length: n }, () => ({ b64_json: b64 })),
    usage: {
      input_tokens: 3150,
      input_tokens_details: { image_tokens: 3072, text_tokens: 78 },
      output_tokens: 439 * n,
      total_tokens: 3150 + 439 * n,
    },
  }
}

function deps(
  edit: EditImages,
): Deps & { createEditor: ReturnType<typeof vi.fn> } {
  return {
    root,
    createEditor: vi.fn(() => edit),
    sleep: async () => {},
    log: (line) => logs.push(line),
    now: () => new Date('2026-10-16T12:00:00.000Z'),
  }
}

function gen(argv: string[]): Extract<CliCommand, { mode: 'generate' }> {
  const cmd = parseCli([...argv, '--manifest', FIXTURE])
  if (cmd.mode !== 'generate') throw new Error('expected generate')
  return cmd
}

function ledgerLines(rel: string = PATHS.ledger): Record<string, unknown>[] {
  const p = join(root, rel)
  if (!existsSync(p)) return []
  return readFileSync(p, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as Record<string, unknown>)
}

const variant = (batch: number, file: string) =>
  join(root, PATHS.outRoot, `batch-${batch}`, file)

describe('runGenerate', () => {
  it('dry run: no editor, prints words, image count and estimate', async () => {
    const d = deps(vi.fn())
    const s = await runGenerate(gen(['--batch', '1', '--dry-run']), d)
    expect(d.createEditor).not.toHaveBeenCalled()
    expect(s.results).toEqual([])
    const out = logs.join('\n')
    expect(out).toContain('Images: 4 word(s) x 2 = 8')
    // 4 x ~$0.0772: 2 x 3 anchors x 1,024 image-in + 2 x 439 out + 2 x text.
    expect(out).toContain('Estimated cost: $0.3087 ')
    expect(out).toContain('Anchors: 3/3 present.')
    expect(existsSync(join(root, PATHS.outRoot))).toBe(false)
  })

  it('dry run: says how many words a --budget covers', async () => {
    await runGenerate(
      gen(['--batch', '1', '--dry-run', '--budget', '0.2']),
      deps(vi.fn()),
    )
    expect(logs.join('\n')).toMatch(
      /Budget \$0\.2000: .* would stop after 2 of 4 word\(s\)/,
    )
  })

  it('writes variants, a priced ledger line per word, and one sheet per batch', async () => {
    let inFlight = 0
    let peak = 0
    const edit = vi.fn<EditImages>(async (params) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return okResponse(params.n ?? 1)
    })
    const s = await runGenerate(
      gen(['--words', 'cat,hat,pig,sack,bus,sun']),
      deps(edit),
    )

    expect(edit).toHaveBeenCalledTimes(6)
    expect(peak).toBe(4)
    const p = edit.mock.calls[0][0]
    expect(p).toMatchObject({
      model: 'gpt-image-2.5-flare',
      size: '1024x1024',
      quality: 'medium',
      background: 'transparent',
      output_format: 'png',
      n: 2,
    })
    expect(Array.isArray(p.image) && p.image.length).toBe(3)
    expect(p.prompt).toMatch(
      /^Subject: A small orange tabby cat sitting, .* curled tail\. Draw this subject /,
    )
    expect(p.prompt).toContain('Must not look like: a dog; a fox.')

    expect(s.results.map((r) => [r.word, r.status, r.images])).toEqual([
      ['cat', 'ok', 2],
      ['hat', 'ok', 2],
      ['pig', 'ok', 2],
      ['sack', 'ok', 2],
      ['bus', 'ok', 2],
      ['sun', 'ok', 2],
    ])
    expect(existsSync(variant(1, 'cat__v1.png'))).toBe(true)
    expect(existsSync(variant(2, 'sun__v2.png'))).toBe(true)

    const ledger = ledgerLines()
    expect(ledger).toHaveLength(6)
    expect(ledger[0]).toMatchObject({
      model: 'gpt-image-2.5-flare',
      n: 2,
      costUsd: 0.051306,
    })
    expect(s.runCostUsd).toBe(0.307836) // 6 x 0.051306
    expect(s.ledgerTotalUsd).toBe(0.307836)

    expect(s.sheets).toEqual([
      'design/references/picture-pack/openai/batch-1/contact-sheet.png',
      'design/references/picture-pack/openai/batch-2/contact-sheet.png',
    ])
    const meta = await sharp(join(root, s.sheets[0])).metadata()
    // label column + current + 2 variants; header + 4 rows
    expect([meta.width, meta.height]).toEqual([1072, 1296])
    expect(logs.join('\n')).toContain('Batch total: $0.3078 for 6/6 word(s).')
  })

  it('adds this run to the running ledger total across runs', async () => {
    const edit = vi.fn<EditImages>(async (params) => okResponse(params.n ?? 1))
    await runGenerate(gen(['--words', 'cat']), deps(edit))
    const s = await runGenerate(gen(['--words', 'hat']), deps(edit))
    expect(ledgerLines()).toHaveLength(2)
    expect(s.runCostUsd).toBe(0.051306)
    expect(s.ledgerTotalUsd).toBe(0.102612)
  })

  it('stops before a call that would exceed --budget, counting calls in flight', async () => {
    mkdirSync(join(root, PATHS.outRoot), { recursive: true })
    writeFileSync(
      join(root, PATHS.ledger),
      `${JSON.stringify({ costUsd: 1 })}\n`,
    )
    const edit = vi.fn<EditImages>(async (params) => okResponse(params.n ?? 1))
    // Each call estimates ~$0.076: $1 spent + 2 calls fit under $1.16, a 3rd does not.
    const s = await runGenerate(
      gen(['--batch', '1', '--budget', '1.16']),
      deps(edit),
    )
    expect(edit).toHaveBeenCalledTimes(2)
    expect(s.stoppedBy).toBe('budget')
    expect(s.results.map((r) => r.status)).toEqual([
      'ok',
      'ok',
      'skipped',
      'skipped',
    ])
    const out = logs.join('\n')
    expect(out).toMatch(/STOP budget/)
    expect(out).toContain(
      `  npx tsx scripts/generatePackPictures.ts --words pig,sack --budget <usd> --manifest ${FIXTURE}`,
    )
  })

  it('carries on past one word failing and reports it', async () => {
    const edit = vi.fn<EditImages>(async (params) => {
      if (params.prompt.includes('pink pig')) {
        throw Object.assign(new Error('Your request was rejected'), {
          status: 400,
        })
      }
      return okResponse(params.n ?? 1)
    })
    const s = await runGenerate(gen(['--batch', '1']), deps(edit))
    expect(s.results.map((r) => [r.word, r.status])).toEqual([
      ['cat', 'ok'],
      ['hat', 'ok'],
      ['pig', 'failed'],
      ['sack', 'ok'],
    ])
    expect(s.results[2].detail).toBe('400 Your request was rejected')
    expect(ledgerLines()).toHaveLength(3)
    expect(s.stoppedBy).toBeNull()
    expect(logs.join('\n')).toContain(`--words pig --manifest ${FIXTURE}`)
  })

  it('retries a 429 and succeeds', async () => {
    let calls = 0
    const edit = vi.fn<EditImages>(async (params) => {
      calls++
      if (calls === 1)
        throw Object.assign(new Error('Rate limit'), { status: 429 })
      return okResponse(params.n ?? 1)
    })
    const s = await runGenerate(gen(['--words', 'cat']), deps(edit))
    expect(edit).toHaveBeenCalledTimes(2)
    expect(s.results[0].status).toBe('ok')
    expect(logs.join('\n')).toContain('retry cat 1/4')
  })

  it('stops the run, without retrying, when prepaid credit runs out', async () => {
    const sleep = vi.fn(async () => {})
    const edit = vi.fn<EditImages>(async () => {
      throw APIError.generate(
        429,
        {
          error: {
            type: 'insufficient_quota',
            code: 'credit_balance_exhausted',
            message: 'Your organization has no prepaid credits remaining.',
          },
        },
        undefined,
        new Headers(),
      )
    })
    const d = { ...deps(edit), sleep }
    const s = await runGenerate(gen(['--words', 'cat,hat,pig,sack,bus,sun']), d)
    expect(edit.mock.calls.length).toBeLessThanOrEqual(4) // only the ones already in flight
    expect(sleep).not.toHaveBeenCalled()
    expect(s.stoppedBy).toBe('fatal')
    expect(s.results.slice(4).map((r) => r.status)).toEqual([
      'skipped',
      'skipped',
    ])
    expect(ledgerLines()).toHaveLength(0)
    expect(logs.join('\n')).toContain(
      'FAIL cat: 429 Your organization has no prepaid credits remaining. (stopping the run)',
    )
  })

  it('records the estimate when a response carries no usage', async () => {
    const edit = vi.fn<EditImages>(async (params) => ({
      ...okResponse(params.n ?? 1),
      usage: undefined,
    }))
    await runGenerate(gen(['--words', 'cat']), deps(edit))
    const [line] = ledgerLines()
    expect(line.usageMissing).toBe(true)
    expect(line.costUsd).toBeGreaterThan(0.05)
  })

  it('fails clearly when the anchors are missing, before any call', async () => {
    rmSync(join(root, PATHS.anchorsDir, 'anchor-sack.png'))
    const d = deps(vi.fn())
    await expect(runGenerate(gen(['--batch', '1']), d)).rejects.toThrow(
      /Style anchors missing:\n {2}design\/references\/picture-pack\/anchors-openai\/anchor-sack\.png/,
    )
    expect(d.createEditor).not.toHaveBeenCalled()
  })

  it('a clay row sends the clay anchors and clay style, into the pack ledger', async () => {
    const manifest = 'clay-manifest.json'
    writeFileSync(
      join(root, manifest),
      JSON.stringify([
        {
          word: 'avatar-fox',
          tier: 'avatars',
          batch: 15,
          style: 'clay',
          subject: 'A chubby baby fox sitting.',
          avoid: ['anything red'],
          distinctFrom: [],
        },
      ]),
    )
    for (const rel of CLAY_ANCHORS) {
      mkdirSync(join(root, rel, '..'), { recursive: true })
      await sharp({
        create: {
          width: 8,
          height: 8,
          channels: 4,
          background: { r: 0, g: 200, b: 0, alpha: 1 },
        },
      })
        .webp()
        .toFile(join(root, rel))
    }
    const edit = vi.fn<EditImages>(async (params) => okResponse(params.n ?? 1))
    const cmd = parseCli(['--words', 'avatar-fox', '--manifest', manifest])
    if (cmd.mode !== 'generate') throw new Error('expected generate')
    const s = await runGenerate(cmd, deps(edit))

    const p = edit.mock.calls[0][0]
    expect((p.image as File[]).map((f) => [f.name, f.type])).toEqual(
      CLAY_ANCHORS.map((rel) => [basename(rel), 'image/webp']),
    )
    expect(p.prompt).toContain(CLAY_STYLE_INSTRUCTION)
    expect(p.background).toBe('transparent')
    expect(s.results.map((r) => [r.word, r.status, r.images])).toEqual([
      ['avatar-fox', 'ok', 2],
    ])
    expect(existsSync(variant(15, 'avatar-fox__v2.png'))).toBe(true)
    expect(ledgerLines().map((l) => [l.word, l.batch])).toEqual([
      ['avatar-fox', 15],
    ])
  })

  it('accepts an absolute --manifest path', async () => {
    const cmd = parseCli([
      '--batch',
      '2',
      '--dry-run',
      '--manifest',
      join(root, FIXTURE),
    ])
    if (cmd.mode !== 'generate') throw new Error('expected generate')
    await runGenerate(cmd, deps(vi.fn()))
    expect(logs.join('\n')).toContain('Images: 2 word(s) x 2 = 4')
  })
})

describe('re-runs never overwrite or re-pay', () => {
  it('skips a word whose variants are on disk', async () => {
    const edit = vi.fn<EditImages>(async (params) => okResponse(params.n ?? 1))
    await runGenerate(gen(['--words', 'cat']), deps(edit))
    const before = readFileSync(variant(1, 'cat__v1.png'))

    logs = []
    const s = await runGenerate(gen(['--batch', '1']), deps(edit))
    // cat is skipped; only hat, pig, sack are called.
    expect(edit).toHaveBeenCalledTimes(4)
    expect(s.results.map((r) => [r.word, r.status])).toEqual([
      ['cat', 'exists'],
      ['hat', 'ok'],
      ['pig', 'ok'],
      ['sack', 'ok'],
    ])
    expect(ledgerLines()).toHaveLength(4)
    expect(readFileSync(variant(1, 'cat__v1.png'))).toEqual(before)
    expect(logs.join('\n')).toContain('1 already on disk')
  })

  it('dry run lists on-disk words as skipped and leaves them out of the cost', async () => {
    const edit = vi.fn<EditImages>(async (params) => okResponse(params.n ?? 1))
    await runGenerate(gen(['--words', 'cat']), deps(edit))
    logs = []
    await runGenerate(gen(['--batch', '1', '--dry-run']), deps(edit))
    const out = logs.join('\n')
    expect(out).toMatch(/cat .* skip: v1-v2 on disk/)
    expect(out).toContain(
      'Images: 3 word(s) x 2 = 6 (1 already on disk, skipped; --force adds more)',
    )
  })

  it('--force adds v3, v4 after the existing variants without touching them', async () => {
    const other = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 4,
        background: { r: 0, g: 200, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer()
    const edit = vi.fn<EditImages>(async (params) => okResponse(params.n ?? 1))
    await runGenerate(gen(['--words', 'cat']), deps(edit))
    const v1 = readFileSync(variant(1, 'cat__v1.png'))

    const edit2 = vi.fn<EditImages>(async (params) =>
      okResponse(params.n ?? 1, other.toString('base64')),
    )
    const s = await runGenerate(gen(['--words', 'cat', '--force']), deps(edit2))
    expect(edit2).toHaveBeenCalledTimes(1)
    expect(s.results[0]).toMatchObject({ status: 'ok', images: 2 })
    expect(readFileSync(variant(1, 'cat__v1.png'))).toEqual(v1)
    expect(readFileSync(variant(1, 'cat__v3.png'))).toEqual(other)
    expect(existsSync(variant(1, 'cat__v4.png'))).toBe(true)
    // The sheet grows to show all four.
    const meta = await sharp(join(root, s.sheets[0])).metadata()
    expect(meta.width).toBe(16 + 240 + 5 * (256 + 16))
  })
})

describe('runPick', () => {
  function pick(
    arg: string,
    dryRun = false,
  ): Extract<CliCommand, { mode: 'pick' }> {
    const cmd = parseCli([
      '--pick',
      arg,
      '--manifest',
      FIXTURE,
      ...(dryRun ? ['--dry-run'] : []),
    ])
    if (cmd.mode !== 'pick') throw new Error('expected pick')
    return cmd
  }

  // Generator-sized source: 1024x1024 with real alpha.
  beforeEach(async () => {
    mkdirSync(join(root, PATHS.outRoot, 'batch-1'), { recursive: true })
    for (const f of ['cat__v2.png', 'sack__v1.png']) {
      await sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .png()
        .toFile(variant(1, f))
    }
  })

  it('writes picks at the pack size (500x500, alpha) into transparent-<tier>/', async () => {
    const r = await runPick(pick('cat=v2,sack=v1'), {
      root,
      log: (l) => logs.push(l),
    })
    expect(r.copied).toBe(2)
    for (const dest of [
      'transparent-short-a/picture-cat.png',
      'transparent-duck-words/picture-sack.png',
    ]) {
      const meta = await sharp(join(root, PATHS.packRoot, dest)).metadata()
      expect([meta.width, meta.height, meta.format, meta.hasAlpha]).toEqual([
        500,
        500,
        'png',
        true,
      ])
    }
    expect(logs).toContain(
      '  yarn embed-pictures design/references/picture-pack/transparent-short-a public/assets/pictures',
    )
  })

  it('copies nothing when any picked variant is missing', async () => {
    await expect(
      runPick(pick('cat=v2,hat=v1'), { root, log: () => {} }),
    ).rejects.toThrow(
      /not on disk \(nothing copied\):\n {2}design\/references\/picture-pack\/openai\/batch-1\/hat__v1\.png/,
    )
    expect(
      existsSync(
        join(root, PATHS.packRoot, 'transparent-short-a/picture-cat.png'),
      ),
    ).toBe(false)
  })

  it('copies nothing when any picked variant is unreadable', async () => {
    writeFileSync(variant(1, 'sack__v1.png'), 'not a png')
    await expect(
      runPick(pick('cat=v2,sack=v1'), { root, log: () => {} }),
    ).rejects.toThrow(/Could not read .*sack__v1\.png \(nothing copied\)/)
    expect(
      existsSync(
        join(root, PATHS.packRoot, 'transparent-short-a/picture-cat.png'),
      ),
    ).toBe(false)
  })

  it('dry run prints the plan and writes nothing', async () => {
    const r = await runPick(pick('cat=v2', true), {
      root,
      log: (l) => logs.push(l),
    })
    expect(r.copied).toBe(0)
    expect(logs[0]).toBe(
      'would write design/references/picture-pack/openai/batch-1/cat__v2.png → design/references/picture-pack/transparent-short-a/picture-cat.png (500x500)',
    )
    expect(existsSync(join(root, PATHS.packRoot, 'transparent-short-a'))).toBe(
      false,
    )
  })
})

describe('--scenes', () => {
  // Three rows of design/word-song/scene-manifest.json, at its default path.
  const SCENES: SceneManifestEntry[] = [
    {
      scene: 'fox-1',
      tier: 'fox-stories',
      batch: 1,
      subject:
        'The fox sitting on a striped rug, a pink mug on the rug beside it.',
      avoid: ['a table'],
      refs: ['fox', 'rug', 'cup'],
    },
    {
      scene: 'fox-2',
      tier: 'fox-stories',
      batch: 1,
      subject:
        'The fox beside an open cardboard box with a hat inside, its top showing.',
      avoid: ['the fox wearing the hat'],
      refs: ['fox', 'hat', 'box'],
    },
    {
      scene: 'hen-1',
      tier: 'hen-stories',
      batch: 2,
      subject:
        'The hen inside a peach van, seen through its open side door, a pink-iced cake beside her.',
      avoid: ['candles, numbers'],
      refs: ['hen', 'cake', 'van'],
    },
  ]
  const CHIPS = ['fox', 'rug', 'cup', 'hat', 'box', 'hen', 'cake', 'van']

  beforeEach(async () => {
    mkdirSync(join(root, 'design/word-song'), { recursive: true })
    writeFileSync(join(root, PATHS.sceneManifest), JSON.stringify(SCENES))
    for (const w of CHIPS) {
      await sharp({
        create: {
          width: 8,
          height: 8,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .webp()
        .toFile(join(root, PATHS.currentPictures, `${w}.webp`))
    }
  })

  function scenes(argv: string[]): Extract<CliCommand, { mode: 'generate' }> {
    const cmd = parseCli(['--scenes', ...argv])
    if (cmd.mode !== 'generate') throw new Error('expected generate')
    return cmd
  }

  const sceneVariant = (batch: number, file: string) =>
    join(root, PATHS.sceneOutRoot, `batch-${batch}`, file)

  async function solidPng(
    size: number,
    background: { r: number; g: number; b: number; alpha: number },
  ): Promise<Buffer> {
    return sharp({
      create: { width: size, height: size, channels: 4, background },
    })
      .png()
      .toBuffer()
  }

  it('dry run: every scene, its refs, the estimate and the scene ledger; no call, no files', async () => {
    const d = deps(vi.fn())
    const s = await runGenerate(scenes(['--dry-run']), d)
    expect(d.createEditor).not.toHaveBeenCalled()
    expect(s.results).toEqual([])
    const out = logs.join('\n')
    expect(out).toContain('2 variant(s) per scene.')
    expect(out).toContain(`Manifest: ${PATHS.sceneManifest}`)
    expect(out).toContain('Scenes (3):')
    expect(out).toMatch(
      /fox-1 +tier fox-stories +batch 1 +\+3 refs est \$0\.1\d{3} \(writes v1-v2\)/,
    )
    expect(out).toContain('Images: 3 scene(s) x 2 = 6')
    // 3 anchors + 3 refs per call, billed for each of the 2 images.
    const est = roundUsd(
      SCENES.reduce(
        (t, e) =>
          t + estimateCallCost(2, buildScenePrompt(e).length, 6).costUsd,
        0,
      ),
    )
    expect(out).toContain(`Estimated cost: ${formatUsd(est)} `)
    expect(out).toContain(`Spend ledger so far: $0.0000 (${PATHS.sceneLedger})`)
    expect(out).toContain('Anchors: 3/3 present.')
    expect(out).toContain('Refs: 8/8 chip pictures present.')
    expect(existsSync(join(root, PATHS.outRoot))).toBe(false)
  })

  it('sends the anchors then the chip refs, opaque, and writes scene variants, ledger and sheets', async () => {
    const edit = vi.fn<EditImages>(async (params) => okResponse(params.n ?? 1))
    const s = await runGenerate(scenes([]), deps(edit))

    expect(edit).toHaveBeenCalledTimes(3)
    const call = edit.mock.calls.find((c) =>
      c[0].prompt.includes('striped rug'),
    )
    const p = call?.[0]
    expect(p).toMatchObject({
      model: 'gpt-image-2.5-flare',
      size: '1024x1024',
      quality: 'medium',
      background: 'opaque',
      output_format: 'png',
      n: 2,
      prompt: buildScenePrompt(SCENES[0]),
    })
    expect((p?.image as File[]).map((f) => [f.name, f.type])).toEqual([
      ['anchor-hen.png', 'image/png'],
      ['anchor-sack.png', 'image/png'],
      ['anchor-wing.png', 'image/png'],
      ['fox.webp', 'image/webp'],
      ['rug.webp', 'image/webp'],
      ['cup.webp', 'image/webp'],
    ])

    expect(s.results.map((r) => [r.word, r.status, r.images])).toEqual([
      ['fox-1', 'ok', 2],
      ['fox-2', 'ok', 2],
      ['hen-1', 'ok', 2],
    ])
    expect(existsSync(sceneVariant(1, 'fox-1__v2.png'))).toBe(true)
    expect(existsSync(sceneVariant(2, 'hen-1__v1.png'))).toBe(true)

    const ledger = ledgerLines(PATHS.sceneLedger)
    expect(ledger.map((l) => l.scene).sort()).toEqual([
      'fox-1',
      'fox-2',
      'hen-1',
    ])
    expect(ledger[0]).not.toHaveProperty('word')
    expect(ledger[0]).toMatchObject({ n: 2, costUsd: 0.051306 })
    expect(existsSync(join(root, PATHS.ledger))).toBe(false)

    expect(s.sheets).toEqual([
      `${PATHS.sceneOutRoot}/batch-1/contact-sheet.png`,
      `${PATHS.sceneOutRoot}/batch-2/contact-sheet.png`,
    ])
    const meta = await sharp(join(root, s.sheets[0])).metadata()
    // label column + current + 2 variants; header + 2 rows
    expect([meta.width, meta.height]).toEqual([1072, 692])
    expect(logs.join('\n')).toContain(`Batch total: $0.1539 for 3/3 scene(s).`)
  })

  it('--budget caps the scene ledger alone (the pack ledger is not counted)', async () => {
    mkdirSync(join(root, PATHS.sceneOutRoot), { recursive: true })
    writeFileSync(
      join(root, PATHS.sceneLedger),
      `${JSON.stringify({ costUsd: 1 })}\n`,
    )
    writeFileSync(
      join(root, PATHS.ledger),
      `${JSON.stringify({ costUsd: 100 })}\n`,
    )
    const edit = vi.fn<EditImages>(async (params) => okResponse(params.n ?? 1))
    // Each scene estimates ~$0.126: $1 spent + 1 call fits under $1.20, a 2nd does not.
    const s = await runGenerate(scenes(['--budget', '1.2']), deps(edit))
    expect(edit).toHaveBeenCalledTimes(1)
    expect(s.stoppedBy).toBe('budget')
    expect(s.results.map((r) => r.status)).toEqual(['ok', 'skipped', 'skipped'])
    expect(s.ledgerTotalUsd).toBe(1.051306)
    const out = logs.join('\n')
    expect(out).toMatch(/STOP budget/)
    expect(out).toContain(
      '  npx tsx scripts/generatePackPictures.ts --scenes --words fox-2,hen-1 --budget <usd>',
    )
  })

  it('stops the run on exhausted credit: no retry, nothing recorded', async () => {
    const sleep = vi.fn(async () => {})
    const edit = vi.fn<EditImages>(async () => {
      throw APIError.generate(
        429,
        {
          error: {
            type: 'insufficient_quota',
            code: 'credit_balance_exhausted',
            message: 'Your organization has no prepaid credits remaining.',
          },
        },
        undefined,
        new Headers(),
      )
    })
    const s = await runGenerate(scenes([]), { ...deps(edit), sleep })
    expect(edit).toHaveBeenCalledTimes(3) // the 3 already in flight, once each
    expect(sleep).not.toHaveBeenCalled()
    expect(s.stoppedBy).toBe('fatal')
    expect(s.results.map((r) => r.status)).toEqual([
      'failed',
      'failed',
      'failed',
    ])
    expect(ledgerLines(PATHS.sceneLedger)).toHaveLength(0)
    expect(logs.join('\n')).toContain(
      '429 Your organization has no prepaid credits remaining. (stopping the run)',
    )
  })

  it('re-runs skip scenes on disk; --force adds v3, v4 and keeps v1, v2', async () => {
    const edit = vi.fn<EditImages>(async (params) => okResponse(params.n ?? 1))
    await runGenerate(scenes(['--words', 'fox-1']), deps(edit))
    const v1 = readFileSync(sceneVariant(1, 'fox-1__v1.png'))

    const again = vi.fn<EditImages>(async (params) => okResponse(params.n ?? 1))
    const s = await runGenerate(scenes(['--batch', '1']), deps(again))
    expect(again).toHaveBeenCalledTimes(1)
    expect(s.results.map((r) => [r.word, r.status])).toEqual([
      ['fox-1', 'exists'],
      ['fox-2', 'ok'],
    ])

    const green = await solidPng(8, { r: 0, g: 200, b: 0, alpha: 1 })
    const retake = vi.fn<EditImages>(async (params) =>
      okResponse(params.n ?? 1, green.toString('base64')),
    )
    await runGenerate(scenes(['--words', 'fox-1', '--force']), deps(retake))
    expect(retake).toHaveBeenCalledTimes(1)
    expect(readFileSync(sceneVariant(1, 'fox-1__v1.png'))).toEqual(v1)
    expect(readFileSync(sceneVariant(1, 'fox-1__v3.png'))).toEqual(green)
    expect(existsSync(sceneVariant(1, 'fox-1__v4.png'))).toBe(true)
    expect(ledgerLines(PATHS.sceneLedger)).toHaveLength(3)
  })

  it('a missing chip picture warns in a dry run and stops a real run before any call', async () => {
    rmSync(join(root, PATHS.currentPictures, 'rug.webp'))
    await runGenerate(scenes(['--dry-run']), deps(vi.fn()))
    expect(logs.join('\n')).toContain(
      'WARN refs missing (a real run would stop): mobile/assets/pictures/rug.webp',
    )
    const d = deps(vi.fn())
    await expect(runGenerate(scenes([]), d)).rejects.toThrow(
      /Reference pictures missing .*:\n {2}mobile\/assets\/pictures\/rug\.webp/,
    )
    expect(d.createEditor).not.toHaveBeenCalled()
  })

  describe('--pick', () => {
    function pickScenes(arg: string, dryRun = false) {
      const cmd = parseCli([
        '--scenes',
        '--pick',
        arg,
        ...(dryRun ? ['--dry-run'] : []),
      ])
      if (cmd.mode !== 'pick') throw new Error('expected pick')
      return cmd
    }
    const story = (id: string) => join(root, PATHS.scenes, `story-${id}.webp`)

    beforeEach(async () => {
      mkdirSync(join(root, PATHS.sceneOutRoot, 'batch-1'), { recursive: true })
      writeFileSync(
        sceneVariant(1, 'fox-1__v2.png'),
        await solidPng(1024, { r: 255, g: 246, b: 238, alpha: 1 }),
      )
    })

    it('writes an opaque 600x600 WebP to mobile/assets/scenes/story-<id>.webp', async () => {
      const r = await runPick(pickScenes('fox-1=v2'), {
        root,
        log: (l) => logs.push(l),
      })
      expect(r.copied).toBe(1)
      const meta = await sharp(story('fox-1')).metadata()
      expect([meta.width, meta.height, meta.format, meta.hasAlpha]).toEqual([
        600,
        600,
        'webp',
        false,
      ])
      expect(logs[0]).toBe(
        `write ${PATHS.sceneOutRoot}/batch-1/fox-1__v2.png → mobile/assets/scenes/story-fox-1.webp (600x600)`,
      )
    })

    it('writes nothing in a dry run or when a picked variant is missing', async () => {
      const dry = await runPick(pickScenes('fox-1=v2', true), {
        root,
        log: () => {},
      })
      expect(dry.copied).toBe(0)
      await expect(
        runPick(pickScenes('fox-1=v2,fox-2=v1'), { root, log: () => {} }),
      ).rejects.toThrow(/not on disk \(nothing copied\):\n {2}.*fox-2__v1\.png/)
      expect(existsSync(story('fox-1'))).toBe(false)
    })
  })
})
