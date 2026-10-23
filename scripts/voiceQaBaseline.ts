/**
 * Voice-QA baseline: a snapshot of every public/voice-qa.html item's audio
 * hash on main, written to public/voice-qa-baseline.json.
 *
 * The page's "New / changed" chip lists the items whose audio hash appears
 * nowhere in this snapshot: 'new' when the key is missing from it, 'changed'
 * when the key holds a different hash. Audio already in the snapshot is never
 * listed, even when a canon group's key moved because its alphabetically-
 * first member changed.
 *
 *   npx tsx scripts/voiceQaBaseline.ts           write the baseline
 *   npx tsx scripts/voiceQaBaseline.ts --check   compare the tree with the
 *                                                committed baseline; exit 1
 *                                                when anything is new/changed
 *   --force   write even when HEAD is not on origin/main or the audio paths
 *             have uncommitted changes
 *
 * When to regenerate: right after each release, from the released SHA
 * (`git checkout -b chore/voice-qa-baseline <released sha>`), committed in a
 * PR. scripts/release.sh prints the exact command. Production then lists what
 * changed since the last release; a PR preview lists its own lines plus any
 * audio merged since the last release. Never regenerate on a feature branch:
 * its own lines would drop out of "New / changed".
 *
 * Keys and hashes come from the page's own code. The manifest block
 * (CANON_FILES through GUIDANCE_FILES, including ASSET_BASES) and the
 * "Pure helpers" block are read out of voice-qa.html and evaluated, so the
 * snapshot hashes the same files and derives the same itemIds as the page.
 * Hash inputs match the page: the canon utterance's base64 string (UTF-8),
 * or the MP3 file's bytes; SHA-256, lowercase hex.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type Manifest = ReadonlyArray<readonly [string, string]>

export interface CanonMember {
  file: string
  id: string
}

export type DiffState = 'new' | 'changed' | null

/** What the baseline script evaluates out of voice-qa.html. */
export interface PageDefinitions {
  CANON_FILES: ReadonlyArray<readonly [string, string]>
  ASSET_BASES: Readonly<Record<string, string>>
  GREET_FILES: Manifest
  HUB_FILES: Manifest
  PATH_GROUPS: ReadonlyArray<readonly [string, Manifest]>
  GUIDANCE_FILES: Manifest
  canonicalItemIdOf: (members: CanonMember[]) => string
  baselineHashesOf: (
    baselineItems: Readonly<Record<string, string>> | null,
  ) => Set<string>
  baselineDiffOf: (
    item: { itemId: string; audioHash: string },
    baselineItems: Readonly<Record<string, string>> | null,
    baselineHashes: ReadonlySet<string>,
  ) => DiffState
  initialFilterOf: (search: string, newCount: number) => string
  groupFilterOf: (search: string) => string | null
}

export interface BaselineFile {
  generatedAt: string
  sourceSha: string
  note: string
  itemCount: number
  items: Record<string, string>
}

export interface ComputedItems {
  /** itemId -> sha256 hex ('' when the asset file is missing, as on the page). */
  items: Record<string, string>
  /** Asset paths (relative to public/) listed on the page but not on disk. */
  missing: string[]
  /** itemIds that two different audio hashes claimed. */
  collisions: string[]
}

export const MANIFEST_BEGIN = 'const CANON_FILES'
export const MANIFEST_END = '// ── State'
export const PURE_BEGIN = '// ── Pure helpers BEGIN'
export const PURE_END = '// ── Pure helpers END'

/** Asset groups in the order the page's main() loads them. */
const ASSET_PREFIXES = ['greet', 'hub', 'path', 'guide'] as const

export function sliceBetween(html: string, begin: string, end: string): string {
  const b = html.indexOf(begin)
  if (b < 0) throw new Error(`voice-qa.html: marker not found: ${begin}`)
  const e = html.indexOf(end, b)
  if (e < 0) throw new Error(`voice-qa.html: marker not found: ${end}`)
  return html.slice(b, e)
}

/** Evaluate the page's manifest + pure-helper blocks. */
export function loadPageDefinitions(html: string): PageDefinitions {
  const manifest = sliceBetween(html, MANIFEST_BEGIN, MANIFEST_END)
  const pure = sliceBetween(html, PURE_BEGIN, PURE_END)
  const factory = new Function(
    `'use strict'\n${manifest}\n${pure}\n` +
      'return { CANON_FILES, ASSET_BASES, GREET_FILES, HUB_FILES, ' +
      'PATH_GROUPS, GUIDANCE_FILES, canonicalItemIdOf, baselineHashesOf, ' +
      'baselineDiffOf, initialFilterOf, groupFilterOf }',
  )
  return factory() as PageDefinitions
}

/**
 * The page's main() decides which asset groups load; this script mirrors that
 * list in assetManifests(). Fail loudly when the page loads a group this
 * script does not know, instead of silently leaving it out of the baseline.
 */
export function assertAssetGroupsKnown(html: string): void {
  const used = new Set(
    [...html.matchAll(/loadAssetGroup\(\s*'([^']+)'/g)].map((m) => m[1]),
  )
  const known = new Set<string>(ASSET_PREFIXES)
  const unknown = [...used].filter((p) => !known.has(p))
  const unused = [...known].filter((p) => !used.has(p))
  if (unknown.length || unused.length) {
    throw new Error(
      'voice-qa.html asset groups and scripts/voiceQaBaseline.ts disagree ' +
        `(page-only: ${unknown.join(', ') || 'none'}; ` +
        `script-only: ${unused.join(', ') || 'none'}). ` +
        'Update assetManifests() to match main() in the page.',
    )
  }
}

export function assetManifests(
  defs: PageDefinitions,
): Array<readonly [string, Manifest]> {
  return [
    ['greet', defs.GREET_FILES],
    ['hub', defs.HUB_FILES],
    ['path', defs.PATH_GROUPS.flatMap(([, files]) => files)],
    ['guide', defs.GUIDANCE_FILES],
  ]
}

export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Compute itemId -> audio hash for every item the page renders.
 * `read` takes a path relative to public/ and returns the bytes, or null when
 * the file does not exist.
 */
export function computeItems(
  defs: PageDefinitions,
  read: (publicPath: string) => Uint8Array | null,
): ComputedItems {
  const items: Record<string, string> = {}
  const missing: string[] = []
  const collisions: string[] = []
  const put = (itemId: string, hash: string): void => {
    if (Object.prototype.hasOwnProperty.call(items, itemId)) {
      if (items[itemId] !== hash) collisions.push(itemId)
      return
    }
    items[itemId] = hash
  }

  // Canon: dedup by audio hash across all tier files, like loadCanon().
  const byHash = new Map<string, CanonMember[]>()
  for (const [group, stem] of defs.CANON_FILES) {
    const path = `canon/${group}/level-1/${stem}.json`
    const buf = read(path)
    if (!buf) throw new Error(`canon file missing: public/${path}`)
    const canon = JSON.parse(Buffer.from(buf).toString('utf8')) as {
      utterances?: unknown
    }
    const utts = Array.isArray(canon.utterances) ? canon.utterances : []
    for (const u of utts as Array<{
      id?: string
      audio?: { base64?: string }
    } | null>) {
      if (!u || !u.audio || !u.audio.base64) continue
      const hash = sha256Hex(u.audio.base64)
      let members = byHash.get(hash)
      if (!members) {
        members = []
        byHash.set(hash, members)
      }
      members.push({ file: stem, id: String(u.id) })
    }
  }
  for (const [hash, members] of byHash) {
    put(defs.canonicalItemIdOf(members), hash)
  }

  // Assets: one item per listed file, keyed `<prefix>#<filename>`.
  for (const [prefix, manifest] of assetManifests(defs)) {
    const base = defs.ASSET_BASES[prefix]
    if (!base) throw new Error(`ASSET_BASES has no entry for '${prefix}'`)
    for (const [filename] of manifest) {
      const path = base.replace(/^\//, '') + filename
      const buf = read(path)
      if (!buf) missing.push(path)
      put(prefix + '#' + filename, buf ? sha256Hex(buf) : '')
    }
  }
  return { items, missing, collisions }
}

/** The ids the page would list under "New / changed", split by kind. */
export function diffAgainstBaseline(
  defs: PageDefinitions,
  current: Readonly<Record<string, string>>,
  baselineItems: Readonly<Record<string, string>> | null,
): { added: string[]; changed: string[] } {
  const added: string[] = []
  const changed: string[] = []
  const hashes = defs.baselineHashesOf(baselineItems)
  for (const [itemId, audioHash] of Object.entries(current)) {
    const state = defs.baselineDiffOf(
      { itemId, audioHash },
      baselineItems,
      hashes,
    )
    if (state === 'new') added.push(itemId)
    else if (state === 'changed') changed.push(itemId)
  }
  return { added, changed }
}

export function buildBaselineFile(
  items: Readonly<Record<string, string>>,
  sourceSha: string,
  generatedAt: string,
): BaselineFile {
  const sorted: Record<string, string> = {}
  for (const key of Object.keys(items).sort()) sorted[key] = items[key]
  return {
    generatedAt,
    sourceSha,
    note:
      'Snapshot of public/voice-qa.html item audio hashes (itemId -> sha256). ' +
      'Regenerate right after each release, from the released SHA: ' +
      'yarn voice-qa:baseline on a branch at that SHA, committed in a PR ' +
      '(scripts/release.sh prints the command). Never regenerate on a ' +
      'feature branch.',
    itemCount: Object.keys(sorted).length,
    items: sorted,
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

/** Refusal reasons for writing a baseline from this checkout (empty = ok). */
function writeGuards(root: string): string[] {
  const reasons: string[] = []
  try {
    execFileSync(
      'git',
      ['merge-base', '--is-ancestor', 'HEAD', 'origin/main'],
      {
        cwd: root,
        stdio: 'ignore',
      },
    )
  } catch {
    reasons.push(
      'HEAD is not on origin/main (run on main, or a fresh branch off origin/main, before committing)',
    )
  }
  const dirty = git(root, [
    'status',
    '--porcelain',
    '--',
    'public/canon',
    'public/assets/audio',
  ])
  if (dirty)
    reasons.push(
      'uncommitted changes under public/canon or public/assets/audio',
    )
  return reasons
}

function main(): void {
  const args = new Set(process.argv.slice(2))
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const publicDir = join(root, 'public')
  const baselinePath = join(publicDir, 'voice-qa-baseline.json')

  const html = readFileSync(join(publicDir, 'voice-qa.html'), 'utf8')
  assertAssetGroupsKnown(html)
  const defs = loadPageDefinitions(html)
  const { items, missing, collisions } = computeItems(defs, (p) => {
    const abs = join(publicDir, p)
    return existsSync(abs) ? readFileSync(abs) : null
  })
  for (const p of missing)
    console.warn(`warning: listed on the page but missing: public/${p}`)
  for (const id of collisions)
    console.warn(`warning: itemId claimed by two different renders: ${id}`)

  if (args.has('--check')) {
    if (!existsSync(baselinePath)) {
      console.log(
        'voice-qa baseline: public/voice-qa-baseline.json is missing.',
      )
      process.exit(1)
    }
    const committed = JSON.parse(
      readFileSync(baselinePath, 'utf8'),
    ) as Partial<BaselineFile>
    const { added, changed } = diffAgainstBaseline(
      defs,
      items,
      committed.items ?? {},
    )
    const at = `main at ${String(committed.sourceSha ?? '?').slice(0, 7)}, ${String(committed.generatedAt ?? '?').slice(0, 10)}`
    if (added.length + changed.length === 0) {
      console.log(`voice-qa baseline (${at}) is current: 0 new or changed.`)
      return
    }
    console.log(
      `voice-qa baseline (${at}): ${added.length} new, ${changed.length} changed.`,
    )
    const list = [
      ...added.map((id) => `  new      ${id}`),
      ...changed.map((id) => `  changed  ${id}`),
    ]
    console.log(list.slice(0, 30).join('\n'))
    if (list.length > 30) console.log(`  … and ${list.length - 30} more`)
    process.exit(1)
  }

  const reasons = writeGuards(root)
  if (reasons.length && !args.has('--force')) {
    console.error('voice-qa baseline: refusing to write:')
    for (const r of reasons) console.error(`  - ${r}`)
    console.error('Pass --force to write anyway.')
    process.exit(1)
  }
  const sha = git(root, ['rev-parse', 'HEAD'])
  const file = buildBaselineFile(items, sha, new Date().toISOString())
  writeFileSync(baselinePath, JSON.stringify(file, null, 2) + '\n')
  console.log(
    `Wrote public/voice-qa-baseline.json: ${file.itemCount} items from ${sha.slice(0, 7)}` +
      (missing.length ? ` (${missing.length} listed files missing)` : '') +
      '.',
  )
}

function isMainModule(): boolean {
  if (!process.argv[1]) return false
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return false
  }
}

if (isMainModule()) {
  main()
}
