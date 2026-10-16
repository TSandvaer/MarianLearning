/**
 * @vitest-environment node
 *
 * generatePackPictures end to end against a temp repo root and a mocked
 * images.edit: files, ledger, budget stop, failure handling, contact sheet,
 * --pick. No network, no key.
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
import { join } from 'node:path'
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
import type { ImagesResponse } from 'openai/resources/images'

import { runGenerate, runPick } from './generatePackPictures.ts'
import type { Deps, EditImages } from './generatePackPictures.ts'
import { parseCli, PATHS } from './packPictureLib.ts'
import type { CliCommand } from './packPictureLib.ts'

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

function okResponse(n: number): ImagesResponse {
  return {
    created: 0,
    data: Array.from({ length: n }, () => ({ b64_json: pngB64 })),
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

function ledgerLines(): Record<string, unknown>[] {
  const p = join(root, PATHS.ledger)
  if (!existsSync(p)) return []
  return readFileSync(p, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as Record<string, unknown>)
}

describe('runGenerate', () => {
  it('dry run: no editor, prints words, image count and estimate', async () => {
    const d = deps(vi.fn())
    const s = await runGenerate(gen(['--batch', '1', '--dry-run']), d)
    expect(d.createEditor).not.toHaveBeenCalled()
    expect(s.results).toEqual([])
    const out = logs.join('\n')
    expect(out).toContain('Images: 4 word(s) x 2 = 8')
    expect(out).toMatch(/Estimated cost: \$0\.2\d{3}/)
    expect(out).toContain('Anchors: 3/3 present.')
    expect(existsSync(join(root, PATHS.outRoot))).toBe(false)
  })

  it('dry run: says how many words a --budget covers', async () => {
    await runGenerate(
      gen(['--batch', '1', '--dry-run', '--budget', '0.15']),
      deps(vi.fn()),
    )
    expect(logs.join('\n')).toMatch(
      /Budget \$0\.1500: .* would stop after 2 of 4 word\(s\)/,
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
    expect(p.prompt).toContain('Draw a small orange tabby cat')
    expect(p.prompt).toContain('Must not look like: a dog; a fox.')

    expect(s.results.map((r) => [r.word, r.status, r.images])).toEqual([
      ['cat', 'ok', 2],
      ['hat', 'ok', 2],
      ['pig', 'ok', 2],
      ['sack', 'ok', 2],
      ['bus', 'ok', 2],
      ['sun', 'ok', 2],
    ])
    expect(existsSync(join(root, PATHS.outRoot, 'batch-1/cat__v1.png'))).toBe(
      true,
    )
    expect(existsSync(join(root, PATHS.outRoot, 'batch-2/sun__v2.png'))).toBe(
      true,
    )

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
    // Each call estimates ~$0.0516: $1 spent + 2 calls fit under $1.12, a 3rd does not.
    const s = await runGenerate(
      gen(['--batch', '1', '--budget', '1.12']),
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
    expect(logs.join('\n')).toMatch(/STOP budget/)
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

  it('stops the run when credit runs out (429 insufficient_quota)', async () => {
    const edit = vi.fn<EditImages>(async () => {
      throw Object.assign(new Error('You exceeded your current quota'), {
        status: 429,
        code: 'insufficient_quota',
      })
    })
    const s = await runGenerate(
      gen(['--words', 'cat,hat,pig,sack,bus,sun']),
      deps(edit),
    )
    expect(edit).toHaveBeenCalledTimes(4) // the first 4 were already in flight
    expect(s.stoppedBy).toBe('fatal')
    expect(s.results.map((r) => r.status)).toEqual([
      'failed',
      'failed',
      'failed',
      'failed',
      'skipped',
      'skipped',
    ])
    expect(ledgerLines()).toHaveLength(0)
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

  beforeEach(() => {
    const dir = join(root, PATHS.outRoot, 'batch-1')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'cat__v2.png'), 'cat-v2')
    writeFileSync(join(dir, 'sack__v1.png'), 'sack-v1')
  })

  it('copies picks into transparent-<tier>/picture-<word>.png', () => {
    const r = runPick(pick('cat=v2,sack=v1'), {
      root,
      log: (l) => logs.push(l),
    })
    expect(r.copied).toBe(2)
    expect(
      readFileSync(
        join(root, PATHS.packRoot, 'transparent-short-a/picture-cat.png'),
        'utf8',
      ),
    ).toBe('cat-v2')
    expect(
      readFileSync(
        join(root, PATHS.packRoot, 'transparent-duck-words/picture-sack.png'),
        'utf8',
      ),
    ).toBe('sack-v1')
    expect(logs).toContain(
      '  yarn embed-pictures design/references/picture-pack/transparent-short-a public/assets/pictures',
    )
  })

  it('copies nothing when any picked variant is missing', () => {
    expect(() =>
      runPick(pick('cat=v2,hat=v1'), { root, log: () => {} }),
    ).toThrow(
      /not on disk \(nothing copied\):\n {2}design\/references\/picture-pack\/openai\/batch-1\/hat__v1\.png/,
    )
    expect(
      existsSync(
        join(root, PATHS.packRoot, 'transparent-short-a/picture-cat.png'),
      ),
    ).toBe(false)
  })

  it('dry run prints the plan and copies nothing', () => {
    const r = runPick(pick('cat=v2', true), { root, log: (l) => logs.push(l) })
    expect(r.copied).toBe(0)
    expect(logs[0]).toBe(
      'would copy design/references/picture-pack/openai/batch-1/cat__v2.png → design/references/picture-pack/transparent-short-a/picture-cat.png',
    )
    expect(existsSync(join(root, PATHS.packRoot, 'transparent-short-a'))).toBe(
      false,
    )
  })
})
