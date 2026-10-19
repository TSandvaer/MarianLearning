#!/usr/bin/env tsx
/**
 * generatePackPictures — Word Song pack pictures from OpenAI
 * gpt-image-2.5-flare, replacing the Midjourney copy-paste loop.
 *
 * Generate (one images.edit call per word, n variants, 3 style anchors):
 *   npx tsx scripts/generatePackPictures.ts --batch 1 --dry-run
 *   npx tsx scripts/generatePackPictures.ts --batch 1 --budget 5
 *   npx tsx scripts/generatePackPictures.ts --words hen,sack --variants 2
 *     → design/references/picture-pack/openai/batch-N/<word>__v<k>.png
 *     → design/references/picture-pack/openai/batch-N/contact-sheet.png
 *
 * Pick the approved variants into the existing embed pipeline:
 *   npx tsx scripts/generatePackPictures.ts --pick hen=v2,sack=v1
 *     → design/references/picture-pack/transparent-<tier>/picture-<word>.png
 *   then: yarn embed-pictures design/references/picture-pack/transparent-<tier> public/assets/pictures
 *         (cd mobile && npm run export-assets)
 *
 * Little-story scenes (content-wave-3.md § 6), the same flow with --scenes:
 *   npx tsx scripts/generatePackPictures.ts --scenes --dry-run    (all 24)
 *   npx tsx scripts/generatePackPictures.ts --scenes --batch 1 --budget 3.3
 *   npx tsx scripts/generatePackPictures.ts --scenes --words fox-3 --force
 *     → design/references/picture-pack/openai/scenes/batch-N/<scene>__v<k>.png
 *   Each call sends the 3 anchors plus the chip picture of each `refs` word
 *   (mobile/assets/pictures/<word>.webp), so the scene's fox is the chip's
 *   fox; the background is opaque. --pick writes the app's file:
 *   npx tsx scripts/generatePackPictures.ts --scenes --pick fox-1=v2
 *     → mobile/assets/scenes/story-<scene>.webp (600x600, opaque)
 *
 * Inputs: design/word-song/picture-manifest.json (scenes:
 * design/word-song/scene-manifest.json; override: --manifest) and the local,
 * gitignored anchors in design/references/picture-pack/anchors-openai/.
 * OPENAI_API_KEY comes from .env.local (never logged).
 *
 * Spend: every response's `usage` is priced (packPictureLib.RATES_PER_1M) and
 * appended to design/references/picture-pack/openai/spend-ledger.jsonl
 * (scenes: openai/scenes/spend-ledger.jsonl), so the running total survives
 * across runs. `--budget <usd>` stops before any call that would take that
 * ledger + in-flight + this call's estimate over it.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import type {
  ImageEditParamsNonStreaming,
  ImagesResponse,
} from 'openai/resources/images'

import {
  ANCHOR_WORDS,
  DEFAULT_VARIANTS,
  IMAGE_SIZE,
  MAX_CONCURRENCY,
  MAX_RETRIES,
  MODEL,
  PATHS,
  MEASURED,
  PACK_PICTURE_PX,
  QUALITY,
  RATES_PER_1M,
  SCENE_PICTURE_PX,
  USAGE,
  anchorRelPaths,
  batchDirRel,
  budgetAllows,
  buildPrompt,
  buildScenePrompt,
  classifyApiError,
  contactSheetRelPath,
  costFromUsage,
  currentPictureRelPath,
  estimateCallCost,
  formatUsd,
  ledgerLine,
  parseCli,
  parseManifest,
  parseSceneManifest,
  planPicks,
  planScenePicks,
  roundUsd,
  runPool,
  sceneDestRelPath,
  selectRows,
  styleOf,
  sumLedger,
  variantRelPath,
  variantsOnDisk,
  withRetry,
} from './packPictureLib.ts'
import type {
  CliCommand,
  LedgerEntry,
  PictureManifestEntry,
  PictureSet,
  SceneManifestEntry,
} from './packPictureLib.ts'
import { buildContactSheet } from './packPictureSheet.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export type EditImages = (
  params: ImageEditParamsNonStreaming,
) => Promise<ImagesResponse>

export interface Deps {
  /** Repo root all repo-relative paths resolve against. */
  root: string
  /** Only called for real runs, so a dry run never needs a key. */
  createEditor: () => EditImages
  sleep: (ms: number) => Promise<void>
  log: (line: string) => void
  now: () => Date
}

export interface WordResult {
  /** The word, or the scene id with --scenes. */
  word: string
  /** `exists`: variants already on disk and no `--force`, so no call (and no
   *  spend). `skipped`: not attempted because the run stopped. */
  status: 'ok' | 'failed' | 'skipped' | 'exists'
  images: number
  costUsd: number
  detail?: string
}

export interface GenerateSummary {
  results: WordResult[]
  runCostUsd: number
  ledgerTotalUsd: number
  sheets: string[]
  stoppedBy: 'budget' | 'fatal' | null
}

// ── .env.local loader (KEY=VALUE; mirrors rebakeVvvAuditSlots.ts) ──────────
function loadEnvLocal(root: string): void {
  const path = join(root, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function realEditor(root: string): EditImages {
  loadEnvLocal(root)
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Add it to .env.local in the repo root (or export it).',
    )
  }
  // maxRetries 0: retries are ours (withRetry), so 429/5xx are not retried twice.
  const client = new OpenAI({ apiKey, maxRetries: 0 })
  return (params) => client.images.edit(params)
}

function readManifestJson(root: string, rel: string): unknown {
  // resolve, not join: --manifest may be an absolute path.
  const path = resolve(root, rel)
  if (!existsSync(path)) {
    throw new Error(
      `Manifest not found: ${rel}. Pass --manifest <path> to use another file.`,
    )
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    throw new Error(
      `Manifest is not valid JSON (${rel}): ${(err as Error).message}`,
    )
  }
}

function readManifest(root: string, rel: string): PictureManifestEntry[] {
  return parseManifest(readManifestJson(root, rel))
}

function readSceneManifest(root: string, rel: string): SceneManifestEntry[] {
  return parseSceneManifest(readManifestJson(root, rel))
}

/** Where each picture set lives and how its calls differ. */
interface SetConfig {
  noun: 'word' | 'scene'
  manifest: string
  outRoot: string
  ledger: string
  background: 'transparent' | 'opaque'
  /** The CLI flag that selects the set ('' for the pack). */
  flag: string
  sheetTitle: string
  pickExample: string
}

const SETS: Record<PictureSet, SetConfig> = {
  pack: {
    noun: 'word',
    manifest: PATHS.manifest,
    outRoot: PATHS.outRoot,
    ledger: PATHS.ledger,
    background: 'transparent',
    flag: '',
    sheetTitle: 'Batch',
    pickExample: '--pick word=v1,word=v2',
  },
  scenes: {
    noun: 'scene',
    manifest: PATHS.sceneManifest,
    outRoot: PATHS.sceneOutRoot,
    ledger: PATHS.sceneLedger,
    background: 'opaque',
    flag: '--scenes',
    sheetTitle: 'Scenes batch',
    pickExample: '--scenes --pick fox-1=v1,fox-2=v2',
  },
}

/** A manifest row of either set, as the run uses it. */
interface Row {
  /** The word, or the scene id. */
  key: string
  tier: string
  batch: number
  prompt: string
  /** Repo-relative style anchors, sent first (the row's style). */
  anchors: string[]
  /** Repo-relative chip pictures sent after the anchors (scenes only). */
  refs: string[]
  /** What the app shows today, the contact sheet's first cell. */
  currentRel: string
  notes: string[]
}

function readRows(root: string, set: PictureSet, rel: string): Row[] {
  if (set === 'pack') {
    return readManifest(root, rel).map((e) => ({
      key: e.word,
      tier: e.tier,
      batch: e.batch,
      prompt: buildPrompt(e),
      anchors: anchorRelPaths(styleOf(e)),
      refs: [],
      currentRel: currentPictureRelPath(e.word),
      notes: [
        `tier: ${e.tier}`,
        ...(e.distinctFrom.length > 0
          ? [`not like: ${e.distinctFrom.join(', ')}`]
          : []),
        ...(e.style ? [`style: ${e.style}`] : []),
      ],
    }))
  }
  return readSceneManifest(root, rel).map((e) => ({
    key: e.scene,
    tier: e.tier,
    batch: e.batch,
    prompt: buildScenePrompt(e),
    anchors: anchorRelPaths(),
    refs: e.refs.map(currentPictureRelPath),
    currentRel: sceneDestRelPath(e.scene),
    notes: [`tier: ${e.tier}`, `refs: ${e.refs.join(', ')}`],
  }))
}

function readLedgerTotal(
  root: string,
  ledgerRel: string,
  log: (s: string) => void,
): number {
  const path = join(root, ledgerRel)
  if (!existsSync(path)) return 0
  const { totalUsd, badLines } = sumLedger(readFileSync(path, 'utf8'))
  if (badLines.length > 0) {
    log(`WARN spend ledger: ignored malformed line(s) ${badLines.join(', ')}`)
  }
  return totalUsd
}

function errorText(err: unknown): string {
  const e = err as { status?: unknown; message?: unknown }
  const msg = typeof e?.message === 'string' ? e.message : String(err)
  // SDK messages already start with the status ("429 You exceeded ...").
  const status =
    typeof e?.status === 'number' && !msg.startsWith(String(e.status))
      ? `${e.status} `
      : ''
  return `${status}${msg}`.replace(/\s+/g, ' ').slice(0, 300)
}

function listBatchDir(root: string, batch: number, outRoot: string): string[] {
  const dir = join(root, batchDirRel(batch, outRoot))
  return existsSync(dir) ? readdirSync(dir) : []
}

function variantRange(ks: readonly number[]): string {
  if (ks.length === 0) return ''
  const first = ks[0]
  const last = ks[ks.length - 1]
  return first === last ? `v${first}` : `v${first}-v${last}`
}

/** Highest variant index on disk for any of `words` in a batch dir. */
function highestVariantOnDisk(dir: string, words: Set<string>): number {
  if (!existsSync(dir)) return 0
  let max = 0
  for (const f of readdirSync(dir)) {
    const m = /^(.+)__v(\d+)\.png$/.exec(f)
    if (m && words.has(m[1])) max = Math.max(max, Number(m[2]))
  }
  return max
}

async function writeContactSheet(
  root: string,
  cfg: SetConfig,
  batch: number,
  all: Row[],
  minVariants: number,
): Promise<string> {
  const rows = all.filter((e) => e.batch === batch)
  const dir = join(root, batchDirRel(batch, cfg.outRoot))
  const k = Math.max(
    minVariants,
    highestVariantOnDisk(dir, new Set(rows.map((r) => r.key))),
  )
  const png = await buildContactSheet(
    {
      title: `${cfg.sheetTitle} ${batch} · ${rows.length} ${cfg.noun}(s)`,
      hint: `Pick with: npx tsx scripts/generatePackPictures.ts ${cfg.pickExample}`,
    },
    rows.map((e) => {
      const current = join(root, e.currentRel)
      return {
        key: e.key,
        notes: e.notes,
        currentPath: existsSync(current) ? current : null,
        variantPaths: Array.from({ length: k }, (_, i) => {
          const p = join(root, variantRelPath(batch, e.key, i + 1, cfg.outRoot))
          return existsSync(p) ? p : null
        }),
      }
    }),
  )
  const rel = contactSheetRelPath(batch, cfg.outRoot)
  mkdirSync(join(root, dirname(rel)), { recursive: true })
  writeFileSync(join(root, rel), png)
  return rel
}

/** Ready-to-paste command for the words a stopped or partly failed run did
 *  not finish. */
export function rerunCommand(
  words: string[],
  cmd: Extract<CliCommand, { mode: 'generate' }>,
): string {
  const cfg = SETS[cmd.set]
  const parts = [
    'npx tsx scripts/generatePackPictures.ts',
    ...(cfg.flag ? [cfg.flag] : []),
    `--words ${words.join(',')}`,
  ]
  if (cmd.variants !== DEFAULT_VARIANTS)
    parts.push(`--variants ${cmd.variants}`)
  if (cmd.budgetUsd !== undefined) parts.push('--budget <usd>')
  if (cmd.manifestPath !== cfg.manifest) {
    parts.push(`--manifest ${cmd.manifestPath}`)
  }
  return parts.join(' ')
}

export async function runGenerate(
  cmd: Extract<CliCommand, { mode: 'generate' }>,
  deps: Deps,
): Promise<GenerateSummary> {
  const { root, log } = deps
  const cfg = SETS[cmd.set]
  const { noun } = cfg
  const all = readRows(root, cmd.set, cmd.manifestPath)
  const entries = selectRows(all, cmd.selection, (r) => r.key)
  const n = cmd.variants
  const plans = entries.map((e) => {
    const existing = variantsOnDisk(
      listBatchDir(root, e.batch, cfg.outRoot),
      e.key,
    )
    return {
      entry: e,
      prompt: e.prompt,
      estimate: estimateCallCost(
        n,
        e.prompt.length,
        e.anchors.length + e.refs.length,
      ),
      existing,
      // Never overwrite a paid variant: new ones are numbered after them.
      firstVariant: (existing[existing.length - 1] ?? 0) + 1,
    }
  })
  // Words already on disk are not generated (or paid for) again unless --force.
  const jobs = plans.filter((p) => cmd.force || p.existing.length === 0)
  const onDisk = plans.filter((p) => !cmd.force && p.existing.length > 0)
  const estTotal = roundUsd(jobs.reduce((s, j) => s + j.estimate.costUsd, 0))
  // The anchors this run needs (a dry run checks every selected row's).
  const anchorRels = [
    ...new Set((cmd.dryRun ? plans : jobs).flatMap((j) => j.entry.anchors)),
  ]
  const missingAnchors = anchorRels.filter((p) => !existsSync(join(root, p)))
  const refRels = [...new Set(jobs.flatMap((j) => j.entry.refs))]
  const missingRefs = refRels.filter((p) => !existsSync(join(root, p)))
  const ledgerTotal = readLedgerTotal(root, cfg.ledger, log)

  if (cmd.dryRun) {
    log(
      `DRY RUN — no API call. Model ${MODEL}, ${IMAGE_SIZE}, quality ${QUALITY}, ${n} variant(s) per ${noun}.`,
    )
    log(`Manifest: ${cmd.manifestPath}`)
    log(`${noun === 'word' ? 'Words' : 'Scenes'} (${plans.length}):`)
    for (const p of plans) {
      const refs = p.entry.refs.length
      const head =
        `  ${p.entry.key.padEnd(12)} tier ${p.entry.tier.padEnd(14)} batch ${String(p.entry.batch).padEnd(3)}` +
        (refs > 0 ? ` +${refs} refs` : '')
      if (!cmd.force && p.existing.length > 0) {
        log(`${head} skip: ${variantRange(p.existing)} on disk`)
      } else {
        const adds = variantRange(
          Array.from({ length: n }, (_, i) => p.firstVariant + i),
        )
        log(`${head} est ${formatUsd(p.estimate.costUsd)} (writes ${adds})`)
      }
    }
    log(
      `Images: ${jobs.length} ${noun}(s) x ${n} = ${jobs.length * n}` +
        (onDisk.length > 0
          ? ` (${onDisk.length} already on disk, skipped; --force adds more)`
          : ''),
    )
    const inputs =
      noun === 'scene'
        ? `(${ANCHOR_WORDS.length} anchors + refs)`
        : `${anchorRels.length} anchors`
    log(
      `Estimated cost: ${formatUsd(estTotal)} ` +
        `(per image returned: ${inputs} x ${MEASURED.inputImageTokens} image-in tokens @ $${RATES_PER_1M.imageInput}/1M + ${MEASURED.outputTokensPerImage} out @ $${RATES_PER_1M.imageOutput}/1M + ~prompt/4 text-in @ $${RATES_PER_1M.textInput}/1M)`,
    )
    log(`Spend ledger so far: ${formatUsd(ledgerTotal)} (${cfg.ledger})`)
    if (cmd.budgetUsd !== undefined) {
      let fitting = 0
      let committed = 0
      for (const j of jobs) {
        const ok = budgetAllows({
          budgetUsd: cmd.budgetUsd,
          spentUsd: ledgerTotal,
          reservedUsd: committed,
          estimateUsd: j.estimate.costUsd,
        })
        if (!ok) break
        committed = roundUsd(committed + j.estimate.costUsd)
        fitting++
      }
      log(
        `Budget ${formatUsd(cmd.budgetUsd)}: ledger + estimate = ${formatUsd(roundUsd(ledgerTotal + estTotal))} → ` +
          (fitting === jobs.length
            ? 'fits'
            : `would stop after ${fitting} of ${jobs.length} ${noun}(s)`),
      )
    }
    log(
      missingAnchors.length === 0
        ? `Anchors: ${anchorRels.length}/${anchorRels.length} present.`
        : `WARN anchors missing (a real run would stop): ${missingAnchors.join(', ')}`,
    )
    if (refRels.length > 0) {
      log(
        missingRefs.length === 0
          ? `Refs: ${refRels.length}/${refRels.length} chip pictures present.`
          : `WARN refs missing (a real run would stop): ${missingRefs.join(', ')}`,
      )
    }
    return {
      results: [],
      runCostUsd: 0,
      ledgerTotalUsd: ledgerTotal,
      sheets: [],
      stoppedBy: null,
    }
  }

  if (missingAnchors.length > 0 && jobs.length > 0) {
    throw new Error(
      `Style anchors missing:\n  ${missingAnchors.join('\n  ')}\n` +
        (missingAnchors.some((p) => p.startsWith(PATHS.anchorsDir))
          ? 'They are local and gitignored (not in a fresh checkout or worktree). ' +
            `Copy anchor-hen.png, anchor-sack.png and anchor-wing.png into ${PATHS.anchorsDir}/.`
          : 'The clay anchors are committed path art (CLAY_ANCHORS); restore them from git.'),
    )
  }
  if (missingRefs.length > 0 && jobs.length > 0) {
    throw new Error(
      `Reference pictures missing (the chip picture of a refs word):\n  ${missingRefs.join('\n  ')}`,
    )
  }
  // Nothing to call (every word already on disk): no key or anchors needed.
  const edit: EditImages =
    jobs.length > 0
      ? deps.createEditor()
      : () => Promise.reject(new Error('no calls in this run'))
  // Anchors and refs, read once; each call sends the anchors, then its refs.
  const inputBytes = new Map<string, Buffer>(
    jobs.length > 0
      ? [...anchorRels, ...refRels].map((rel) => [
          rel,
          readFileSync(join(root, rel)),
        ])
      : [],
  )
  const inputFiles = (row: Row) =>
    Promise.all(
      [...row.anchors, ...row.refs].map((rel) =>
        toFile(inputBytes.get(rel) as Buffer, basename(rel), {
          type: rel.endsWith('.webp') ? 'image/webp' : 'image/png',
        }),
      ),
    )

  const runId = randomUUID()
  const ledgerPath = join(root, cfg.ledger)
  mkdirSync(dirname(ledgerPath), { recursive: true })

  let runSpent = 0
  let reserved = 0
  let stoppedBy: GenerateSummary['stoppedBy'] = null
  const results = new Map<string, WordResult>()
  for (const p of onDisk) {
    results.set(p.entry.key, {
      word: p.entry.key,
      status: 'exists',
      images: 0,
      costUsd: 0,
      detail: `${variantRange(p.existing)} on disk (--force adds more)`,
    })
  }

  log(
    `Generating ${jobs.length} ${noun}(s) x ${n} with ${MODEL} (max ${MAX_CONCURRENCY} concurrent). ` +
      (onDisk.length > 0
        ? `${onDisk.length} ${noun}(s) already on disk, skipped. `
        : '') +
      `Estimate ${formatUsd(estTotal)}; ledger so far ${formatUsd(ledgerTotal)}` +
      (cmd.budgetUsd !== undefined
        ? `; budget ${formatUsd(cmd.budgetUsd)}.`
        : '.'),
  )

  await runPool(jobs, MAX_CONCURRENCY, async (job) => {
    const { entry, prompt, estimate, firstVariant } = job
    const { key: word, batch } = entry
    if (stoppedBy !== null) {
      results.set(word, {
        word,
        status: 'skipped',
        images: 0,
        costUsd: 0,
        detail: stoppedBy,
      })
      return
    }
    if (
      !budgetAllows({
        budgetUsd: cmd.budgetUsd,
        spentUsd: ledgerTotal + runSpent,
        reservedUsd: reserved,
        estimateUsd: estimate.costUsd,
      })
    ) {
      stoppedBy = 'budget'
      log(
        `STOP budget: ledger ${formatUsd(ledgerTotal + runSpent)} + in flight ${formatUsd(reserved)} + ${word} est ${formatUsd(estimate.costUsd)} > ${formatUsd(cmd.budgetUsd ?? 0)}`,
      )
      results.set(word, {
        word,
        status: 'skipped',
        images: 0,
        costUsd: 0,
        detail: 'budget',
      })
      return
    }

    reserved += estimate.costUsd
    let res: ImagesResponse
    try {
      res = await withRetry(
        async () =>
          edit({
            model: MODEL,
            image: await inputFiles(entry),
            prompt,
            size: IMAGE_SIZE,
            quality: QUALITY,
            background: cfg.background,
            output_format: 'png',
            n,
          }),
        {
          maxRetries: MAX_RETRIES,
          sleep: deps.sleep,
          onRetry: (attempt, ms, err) =>
            log(
              `  retry ${word} ${attempt}/${MAX_RETRIES} in ${Math.round(ms / 1000)}s (${errorText(err)})`,
            ),
        },
      )
    } catch (err) {
      const cls = classifyApiError(err)
      if (cls === 'fatal' && stoppedBy === null) stoppedBy = 'fatal'
      const detail = errorText(err)
      log(
        `FAIL ${word}: ${detail}${cls === 'fatal' ? ' (stopping the run)' : ''}`,
      )
      results.set(word, {
        word,
        status: 'failed',
        images: 0,
        costUsd: 0,
        detail,
      })
      return
    } finally {
      reserved = roundUsd(reserved - estimate.costUsd)
    }

    // Record spend before touching the images, so a write failure can't lose it.
    const usageMissing = !res.usage
    const cost = res.usage ? costFromUsage(res.usage) : estimate
    const entryLine: LedgerEntry & { usageMissing?: boolean } = {
      ts: deps.now().toISOString(),
      runId,
      ...(cmd.set === 'scenes' ? { scene: word } : { word }),
      batch,
      model: MODEL,
      size: IMAGE_SIZE,
      quality: QUALITY,
      n,
      ...cost,
      usage: res.usage ?? { input_tokens: 0, output_tokens: 0 },
      ...(usageMissing ? { usageMissing: true } : {}),
    }
    appendFileSync(ledgerPath, ledgerLine(entryLine))
    runSpent = roundUsd(runSpent + cost.costUsd)

    const images = (res.data ?? []).filter(
      (d) => typeof d.b64_json === 'string',
    )
    images.forEach((d, i) => {
      const rel = variantRelPath(batch, word, firstVariant + i, cfg.outRoot)
      mkdirSync(join(root, dirname(rel)), { recursive: true })
      writeFileSync(
        join(root, rel),
        Buffer.from(d.b64_json as string, 'base64'),
      )
    })
    const short = images.length < n ? ` (asked for ${n})` : ''
    const written = variantRange(images.map((_, i) => firstVariant + i))
    log(
      `ok   ${word.padEnd(12)} ${images.length} image(s) ${written}${short}  ${formatUsd(cost.costUsd)}${usageMissing ? ' (no usage in response; estimate recorded)' : ''}`,
    )
    results.set(word, {
      word,
      status: images.length > 0 ? 'ok' : 'failed',
      images: images.length,
      costUsd: cost.costUsd,
      detail: images.length > 0 ? undefined : 'response had no images',
    })
  })

  const ordered = plans.map(
    ({ entry }) =>
      results.get(entry.key) ?? {
        word: entry.key,
        status: 'skipped' as const,
        images: 0,
        costUsd: 0,
      },
  )

  const sheets: string[] = []
  for (const batch of [...new Set(entries.map((e) => e.batch))]) {
    sheets.push(await writeContactSheet(root, cfg, batch, all, n))
  }

  const ledgerAfter = roundUsd(ledgerTotal + runSpent)
  log('')
  log(`Per ${noun}:`)
  for (const r of ordered) {
    log(
      `  ${r.status.padEnd(7)} ${r.word.padEnd(12)} ${String(r.images).padStart(2)} img  ${formatUsd(r.costUsd)}${r.detail ? `  ${r.detail}` : ''}`,
    )
  }
  const count = (s: WordResult['status']) =>
    ordered.filter((r) => r.status === s).length
  const failed = count('failed')
  const skipped = count('skipped')
  const existed = count('exists')
  log(
    `Batch total: ${formatUsd(runSpent)} for ${count('ok')}/${ordered.length} ${noun}(s)` +
      `${failed ? `, ${failed} failed` : ''}${skipped ? `, ${skipped} skipped` : ''}` +
      `${existed ? `, ${existed} already on disk` : ''}.`,
  )
  log(`Spend ledger total: ${formatUsd(ledgerAfter)} (${cfg.ledger})`)
  for (const s of sheets) log(`Contact sheet: ${s}`)
  const rest = ordered
    .filter((r) => r.status === 'failed' || r.status === 'skipped')
    .map((r) => r.word)
  if (rest.length > 0) {
    log(`To generate the rest (only these ${noun}s are called and paid for):`)
    log(`  ${rerunCommand(rest, cmd)}`)
  }

  return {
    results: ordered,
    runCostUsd: runSpent,
    ledgerTotalUsd: ledgerAfter,
    sheets,
    stoppedBy,
  }
}

/** export-assets.mjs encodes the app's WebPs at q 85. */
const SCENE_WEBP = { quality: 85 }

/**
 * Writes the chosen variants into the embed pipeline at the pack's size:
 * 1024x1024 → 500x500 transparent PNG (PACK_PICTURE_PX). Scenes go straight
 * to the app as opaque 600x600 WebPs (SCENE_PICTURE_PX). Every pick is
 * decoded and resized in memory first, so one bad file means nothing is
 * written.
 */
export async function runPick(
  cmd: Extract<CliCommand, { mode: 'pick' }>,
  deps: Pick<Deps, 'root' | 'log'>,
): Promise<{ copied: number }> {
  const { root, log } = deps
  const scenes = cmd.set === 'scenes'
  const plan = scenes
    ? planScenePicks(cmd.picks, readSceneManifest(root, cmd.manifestPath))
    : planPicks(cmd.picks, readManifest(root, cmd.manifestPath))
  const missing = plan.filter((c) => !existsSync(join(root, c.src)))
  if (missing.length > 0) {
    throw new Error(
      `Picked variant(s) not on disk (nothing copied):\n  ${missing.map((c) => c.src).join('\n  ')}`,
    )
  }
  const px = scenes ? SCENE_PICTURE_PX : PACK_PICTURE_PX
  const resized = await Promise.all(
    plan.map(async (c) => {
      try {
        if (scenes) {
          return await sharp(join(root, c.src))
            .resize(px, px, { fit: 'cover' })
            .removeAlpha()
            .webp(SCENE_WEBP)
            .toBuffer()
        }
        return await sharp(join(root, c.src))
          .resize(px, px, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .ensureAlpha()
          .png()
          .toBuffer()
      } catch (err) {
        throw new Error(
          `Could not read ${c.src} (nothing copied): ${(err as Error).message}`,
        )
      }
    }),
  )
  plan.forEach((c, i) => {
    log(
      `${cmd.dryRun ? 'would write' : 'write'} ${c.src} → ${c.dest} (${px}x${px})`,
    )
    if (!cmd.dryRun) {
      mkdirSync(join(root, dirname(c.dest)), { recursive: true })
      writeFileSync(join(root, c.dest), resized[i])
    }
  })
  log('')
  if (scenes) {
    log(`Next: commit ${PATHS.scenes}/story-*.webp (export-assets keeps them).`)
    return { copied: cmd.dryRun ? 0 : plan.length }
  }
  const tiers = [...new Set(plan.map((c) => dirname(c.dest)))]
  log('Next, per tier:')
  for (const t of tiers)
    log(`  yarn embed-pictures ${t} public/assets/pictures`)
  log('  (cd mobile && npm run export-assets)')
  return { copied: cmd.dryRun ? 0 : plan.length }
}

async function main(): Promise<void> {
  let cmd: CliCommand
  try {
    cmd = parseCli(process.argv.slice(2))
  } catch (err) {
    console.error(`ERROR: ${(err as Error).message}\n\n${USAGE}`)
    process.exit(2)
  }
  const deps: Deps = {
    root: REPO_ROOT,
    createEditor: () => realEditor(REPO_ROOT),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (line) => console.log(line),
    now: () => new Date(),
  }
  try {
    if (cmd.mode === 'pick') {
      await runPick(cmd, deps)
      return
    }
    const summary = await runGenerate(cmd, deps)
    const unfinished = summary.results.some(
      (r) => r.status === 'failed' || r.status === 'skipped',
    )
    if (unfinished) process.exitCode = 1
  } catch (err) {
    console.error(`ERROR: ${(err as Error).message}`)
    process.exit(1)
  }
}

function isDirectRun(): boolean {
  if (!process.argv[1]) return false
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return false
  }
}

if (isDirectRun()) void main()
