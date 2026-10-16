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
 * Inputs: design/word-song/picture-manifest.json (override: --manifest) and
 * the local, gitignored anchors in design/references/picture-pack/anchors-openai/.
 * OPENAI_API_KEY comes from .env.local (never logged).
 *
 * Spend: every response's `usage` is priced (packPictureLib.RATES_PER_1M) and
 * appended to design/references/picture-pack/openai/spend-ledger.jsonl, so
 * the running total survives across runs. `--budget <usd>` stops before any
 * call that would take ledger + in-flight + this call's estimate over it.
 */

import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import OpenAI, { toFile } from 'openai'
import type {
  ImageEditParamsNonStreaming,
  ImagesResponse,
} from 'openai/resources/images'

import {
  IMAGE_SIZE,
  MAX_CONCURRENCY,
  MAX_RETRIES,
  MODEL,
  PATHS,
  MEASURED,
  QUALITY,
  RATES_PER_1M,
  USAGE,
  anchorRelPaths,
  batchDirRel,
  budgetAllows,
  buildPrompt,
  classifyApiError,
  contactSheetRelPath,
  costFromUsage,
  currentPictureRelPath,
  estimateCallCost,
  formatUsd,
  ledgerLine,
  parseCli,
  parseManifest,
  planPicks,
  roundUsd,
  runPool,
  selectEntries,
  sumLedger,
  variantRelPath,
  withRetry,
} from './packPictureLib.ts'
import type {
  CliCommand,
  LedgerEntry,
  PictureManifestEntry,
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
  word: string
  status: 'ok' | 'failed' | 'skipped'
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

function readManifest(root: string, rel: string): PictureManifestEntry[] {
  const path = join(root, rel)
  if (!existsSync(path)) {
    throw new Error(
      `Manifest not found: ${rel}. Pass --manifest <path> to use another file.`,
    )
  }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    throw new Error(
      `Manifest is not valid JSON (${rel}): ${(err as Error).message}`,
    )
  }
  return parseManifest(raw)
}

function readLedgerTotal(root: string, log: (s: string) => void): number {
  const path = join(root, PATHS.ledger)
  if (!existsSync(path)) return 0
  const { totalUsd, badLines } = sumLedger(readFileSync(path, 'utf8'))
  if (badLines.length > 0) {
    log(`WARN spend ledger: ignored malformed line(s) ${badLines.join(', ')}`)
  }
  return totalUsd
}

function errorText(err: unknown): string {
  const e = err as { status?: unknown; message?: unknown }
  const status = typeof e?.status === 'number' ? `${e.status} ` : ''
  const msg = typeof e?.message === 'string' ? e.message : String(err)
  return `${status}${msg}`.replace(/\s+/g, ' ').slice(0, 300)
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
  batch: number,
  manifest: PictureManifestEntry[],
  minVariants: number,
): Promise<string> {
  const rows = manifest.filter((e) => e.batch === batch)
  const dir = join(root, batchDirRel(batch))
  const k = Math.max(
    minVariants,
    highestVariantOnDisk(dir, new Set(rows.map((r) => r.word))),
  )
  const png = await buildContactSheet(
    batch,
    rows.map((e) => {
      const current = join(root, currentPictureRelPath(e.word))
      return {
        word: e.word,
        tier: e.tier,
        distinctFrom: e.distinctFrom,
        currentPath: existsSync(current) ? current : null,
        variantPaths: Array.from({ length: k }, (_, i) => {
          const p = join(root, variantRelPath(batch, e.word, i + 1))
          return existsSync(p) ? p : null
        }),
      }
    }),
  )
  const rel = contactSheetRelPath(batch)
  mkdirSync(join(root, dirname(rel)), { recursive: true })
  writeFileSync(join(root, rel), png)
  return rel
}

export async function runGenerate(
  cmd: Extract<CliCommand, { mode: 'generate' }>,
  deps: Deps,
): Promise<GenerateSummary> {
  const { root, log } = deps
  const manifest = readManifest(root, cmd.manifestPath)
  const entries = selectEntries(manifest, cmd.selection)
  const n = cmd.variants
  const jobs = entries.map((e) => {
    const prompt = buildPrompt(e)
    return { entry: e, prompt, estimate: estimateCallCost(n, prompt.length) }
  })
  const estTotal = roundUsd(jobs.reduce((s, j) => s + j.estimate.costUsd, 0))
  const missingAnchors = anchorRelPaths().filter(
    (p) => !existsSync(join(root, p)),
  )
  const ledgerTotal = readLedgerTotal(root, log)

  if (cmd.dryRun) {
    log(
      `DRY RUN — no API call. Model ${MODEL}, ${IMAGE_SIZE}, quality ${QUALITY}, ${n} variant(s) per word.`,
    )
    log(`Manifest: ${cmd.manifestPath}`)
    log(`Words (${jobs.length}):`)
    for (const j of jobs) {
      log(
        `  ${j.entry.word.padEnd(12)} tier ${j.entry.tier.padEnd(14)} batch ${String(j.entry.batch).padEnd(3)} est ${formatUsd(j.estimate.costUsd)}`,
      )
    }
    log(`Images: ${jobs.length} word(s) x ${n} = ${jobs.length * n}`)
    log(
      `Estimated cost: ${formatUsd(estTotal)} ` +
        `(per call: ${MEASURED.anchorImageInputTokens} image-in tokens @ $${RATES_PER_1M.imageInput}/1M + ~prompt/4 text-in @ $${RATES_PER_1M.textInput}/1M + ${n} x ${MEASURED.outputTokensPerImage} out @ $${RATES_PER_1M.imageOutput}/1M)`,
    )
    log(`Spend ledger so far: ${formatUsd(ledgerTotal)} (${PATHS.ledger})`)
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
            : `would stop after ${fitting} of ${jobs.length} word(s)`),
      )
    }
    log(
      missingAnchors.length === 0
        ? 'Anchors: 3/3 present.'
        : `WARN anchors missing (a real run would stop): ${missingAnchors.join(', ')}`,
    )
    return {
      results: [],
      runCostUsd: 0,
      ledgerTotalUsd: ledgerTotal,
      sheets: [],
      stoppedBy: null,
    }
  }

  if (missingAnchors.length > 0) {
    throw new Error(
      `Style anchors missing:\n  ${missingAnchors.join('\n  ')}\n` +
        'They are local and gitignored (not in a fresh checkout or worktree). ' +
        `Copy anchor-hen.png, anchor-sack.png and anchor-wing.png into ${PATHS.anchorsDir}/.`,
    )
  }
  const edit = deps.createEditor()
  const anchors = anchorRelPaths().map((rel) => ({
    name: rel.slice(rel.lastIndexOf('/') + 1),
    bytes: readFileSync(join(root, rel)),
  }))

  const runId = randomUUID()
  const ledgerPath = join(root, PATHS.ledger)
  mkdirSync(dirname(ledgerPath), { recursive: true })

  let runSpent = 0
  let reserved = 0
  let stoppedBy: GenerateSummary['stoppedBy'] = null
  const results = new Map<string, WordResult>()

  log(
    `Generating ${jobs.length} word(s) x ${n} with ${MODEL} (max ${MAX_CONCURRENCY} concurrent). ` +
      `Estimate ${formatUsd(estTotal)}; ledger so far ${formatUsd(ledgerTotal)}` +
      (cmd.budgetUsd !== undefined
        ? `; budget ${formatUsd(cmd.budgetUsd)}.`
        : '.'),
  )

  await runPool(jobs, MAX_CONCURRENCY, async ({ entry, prompt, estimate }) => {
    const { word, batch } = entry
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
            image: await Promise.all(
              anchors.map((a) =>
                toFile(a.bytes, a.name, { type: 'image/png' }),
              ),
            ),
            prompt,
            size: IMAGE_SIZE,
            quality: QUALITY,
            background: 'transparent',
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
      word,
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
      const rel = variantRelPath(batch, word, i + 1)
      mkdirSync(join(root, dirname(rel)), { recursive: true })
      writeFileSync(
        join(root, rel),
        Buffer.from(d.b64_json as string, 'base64'),
      )
    })
    const short = images.length < n ? ` (asked for ${n})` : ''
    log(
      `ok   ${word.padEnd(12)} ${images.length} image(s)${short}  ${formatUsd(cost.costUsd)}${usageMissing ? ' (no usage in response; estimate recorded)' : ''}`,
    )
    results.set(word, {
      word,
      status: images.length > 0 ? 'ok' : 'failed',
      images: images.length,
      costUsd: cost.costUsd,
      detail: images.length > 0 ? undefined : 'response had no images',
    })
  })

  const ordered = jobs.map(
    ({ entry }) =>
      results.get(entry.word) ?? {
        word: entry.word,
        status: 'skipped' as const,
        images: 0,
        costUsd: 0,
      },
  )

  const sheets: string[] = []
  for (const batch of [...new Set(entries.map((e) => e.batch))]) {
    sheets.push(await writeContactSheet(root, batch, manifest, n))
  }

  const ledgerAfter = roundUsd(ledgerTotal + runSpent)
  log('')
  log('Per word:')
  for (const r of ordered) {
    log(
      `  ${r.status.padEnd(7)} ${r.word.padEnd(12)} ${String(r.images).padStart(2)} img  ${formatUsd(r.costUsd)}${r.detail ? `  ${r.detail}` : ''}`,
    )
  }
  const failed = ordered.filter((r) => r.status === 'failed').length
  const skipped = ordered.filter((r) => r.status === 'skipped').length
  log(
    `Batch total: ${formatUsd(runSpent)} for ${ordered.length - failed - skipped}/${ordered.length} word(s)` +
      `${failed ? `, ${failed} failed` : ''}${skipped ? `, ${skipped} skipped` : ''}.`,
  )
  log(`Spend ledger total: ${formatUsd(ledgerAfter)} (${PATHS.ledger})`)
  for (const s of sheets) log(`Contact sheet: ${s}`)

  return {
    results: ordered,
    runCostUsd: runSpent,
    ledgerTotalUsd: ledgerAfter,
    sheets,
    stoppedBy,
  }
}

export function runPick(
  cmd: Extract<CliCommand, { mode: 'pick' }>,
  deps: Pick<Deps, 'root' | 'log'>,
): { copied: number } {
  const { root, log } = deps
  const manifest = readManifest(root, cmd.manifestPath)
  const plan = planPicks(cmd.picks, manifest)
  const missing = plan.filter((c) => !existsSync(join(root, c.src)))
  if (missing.length > 0) {
    throw new Error(
      `Picked variant(s) not on disk (nothing copied):\n  ${missing.map((c) => c.src).join('\n  ')}`,
    )
  }
  for (const c of plan) {
    log(`${cmd.dryRun ? 'would copy' : 'copy'} ${c.src} → ${c.dest}`)
    if (!cmd.dryRun) {
      mkdirSync(join(root, dirname(c.dest)), { recursive: true })
      copyFileSync(join(root, c.src), join(root, c.dest))
    }
  }
  const tiers = [...new Set(plan.map((c) => dirname(c.dest)))]
  log('')
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
      runPick(cmd, deps)
      return
    }
    const summary = await runGenerate(cmd, deps)
    if (summary.results.some((r) => r.status !== 'ok')) process.exitCode = 1
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
