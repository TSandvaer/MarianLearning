#!/usr/bin/env tsx
/**
 * Pre-bake every active (track, level, focusNode) session-start combo
 * to a static JSON+base64-audio blob under `public/canon/`.
 *
 * Ticket 86c9kwhbc (D — pre-baked session canon).
 *
 * Why
 * ---
 * Cold-start /api/claude session-start was 10–12s on prod (Anthropic
 * Haiku call + 40-59 Azure TTS renders, sequential because the planner
 * blocks on the model response). For the active set of curriculum
 * combos, the content is deterministic enough that we can pre-render
 * everything offline and ship the blobs in the function bundle. The
 * function then reads from canon first; on a hit, session-start is
 * a sync filesystem read + JSON.parse + Response.json — well under
 * 500ms even on a cold instance.
 *
 * What this script does
 * ---------------------
 * 1. Loads ANTHROPIC_API_KEY + AZURE_SPEECH_KEY/REGION from .env.local
 *    or process.env (matching the convention render-greet-mp3s.mjs uses).
 * 2. Iterates the cross-product of MATH_TREE × {level: 1} +
 *    LITERACY_TREE × {level: 1} × {childName: "Marian"}.
 * 3. For each combo, calls `generateSessionStartResponse` (the same
 *    callable the live HTTP handler uses) to produce the full
 *    SessionStartResponse.
 * 4. Writes one JSON file per combo at
 *    `public/canon/<track>/level-<n>/<focusNode>.json`.
 *
 * Determinism caveat
 * ------------------
 * Haiku is a generative model — we don't get bit-identical output across
 * runs. What we DO get is "a curriculum-correct 8-problem session" each
 * time, which is what canon's job is. If the prompt changes (curriculum
 * tweak, new utterance slot, voice config edit), regenerate the canon by
 * passing `--force`. Otherwise the script skips combos whose blobs
 * already exist on disk so a partial run can be resumed.
 *
 * Wordsong scope
 * --------------
 * Per project_planner_parser_contract memory + the WORD_SONG_TRACK_GUIDE
 * comment in api/_planner.ts: word-song is server-side clamped to
 * `blending-cv`. Generating any other word-song node would either
 * re-emit the same content (wasteful canon copies) or — if the clamp
 * were lifted — produce content the browser parser rejects. We only
 * generate `blending-cv` for word-song until the M-series widens
 * content-template support; the rest of the LITERACY_TREE will get
 * canon entries when the planner widens.
 *
 * Childname strategy (AC #3 of the ticket)
 * ----------------------------------------
 * "Marian" is baked directly into utterance text. Multi-child support
 * is out of scope; if added later, the natural shape is either
 * (a) one canon per child, generated on first sign-in, or
 * (b) a `__CHILD_NAME__` placeholder + read-time substitution. This
 * script does (a) trivially — pass `--child <name>` and
 * `--out public/canon-<name>` to bake a separate set.
 *
 * Usage
 * -----
 *   npx tsx scripts/generateSessionCanon.ts                 # incremental
 *   npx tsx scripts/generateSessionCanon.ts --force         # regenerate
 *   npx tsx scripts/generateSessionCanon.ts --child Marian  # explicit
 *   npx tsx scripts/generateSessionCanon.ts --dry-run       # plan only
 *
 * Run from the repo root, with .env.local providing both ANTHROPIC and
 * Azure keys (or with the same keys exported into the shell).
 *
 * Cost
 * ----
 * 11 combos × (1 Haiku call + ~59 Azure TTS calls). Haiku is cents per
 * full canon regen; Azure TTS S0 is well within budget. The script
 * sleeps 250ms between combos to stay polite against any future Azure
 * rate ceiling — the wall time is dominated by Azure latency anyway,
 * so the sleep is comparatively cheap.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import Anthropic from '@anthropic-ai/sdk'

import {
  generateSessionStartResponse,
  type PlannerAnthropicClient,
  type PlannerTrack,
} from '../api/_planner.js'
import { canonFilePath } from '../api/_canon.js'
import { synthesizeUtterance } from '../api/_tts.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

// ── env loading ─────────────────────────────────────────────────────────
// Same minimal parser as scripts/render-greet-mp3s.mjs — we don't pull
// in a dotenv dep for the same reason; KEY=VALUE only, comments allowed,
// surrounding quotes stripped. Process env wins over file values.

function loadDotEnvLocal(): void {
  const path = join(REPO_ROOT, '.env.local')
  if (!existsSync(path)) return
  const txt = readFileSync(path, 'utf8')
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadDotEnvLocal()

// ── flag parsing ────────────────────────────────────────────────────────

interface CliArgs {
  force: boolean
  dryRun: boolean
  child: string
  out: string
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    force: argv.includes('--force'),
    dryRun: argv.includes('--dry-run'),
    child: 'Marian',
    out: join(REPO_ROOT, 'public', 'canon'),
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--child' && typeof argv[i + 1] === 'string') {
      args.child = argv[i + 1]!
      i++
    } else if (argv[i] === '--out' && typeof argv[i + 1] === 'string') {
      args.out = argv[i + 1]!
      i++
    }
  }
  return args
}

// ── combo enumeration ───────────────────────────────────────────────────
// Mirrors `MATH_TREE` and `LITERACY_TREE` from `src/lib/progress/mastery.ts`.
// We don't import that module directly — it lives under the app tsconfig
// and dragging it into the script's TS compile dragged in
// `localStorage` types we don't need here. Instead, the lists are
// duplicated and pinned by `scripts/generateSessionCanon.test.ts`
// against the source-of-truth lists in `_planner.ts`
// (VALID_MATH_FOCUS_NODES / VALID_WORD_SONG_FOCUS_NODES) so a
// curriculum drift breaks CI.

interface Combo {
  track: PlannerTrack
  level: number
  focusNode: string
}

const MATH_FOCUS_NODES: readonly string[] = [
  'number-recog',
  'add-to-10',
  'add-to-20',
  'sub-to-10',
  'sub-to-20',
  'two-digit-addsub',
  'skip-counting',
  'mult-2-5-10',
  'mult-3-4',
  'mult-6-9',
]

// Word-song first-class content modes — must match the
// WORD_SONG_FIRST_CLASS_FOCUS_NODES list in api/_planner.ts. Untuned
// tiers (letter-sounds / digraphs / sight-words / simple-sentences)
// fall back to blending-cv content via `effectiveFocusNode`, so baking
// canon entries for them would just be a wasteful copy of the
// blending-cv blob — they're omitted here on purpose. Future tier
// widenings (paired parser-then-planner steps per the contract doc)
// add their entries here when they go first-class.
//
// Ticket 86c9m3ae3 added `cvc-words-short-o` as the next-vowel sibling
// tier — see `design/word-song/short-o-pool-expansion.md` §6 (canon-
// bake plan). Ticket 86c9q9ben added `cvc-words-short-u` as the third
// vowel-tier sibling — see `design/word-song/short-u-pool-expansion.md`
// §6. Ticket 86c9qdba4 added `cvc-words-short-i` as the fourth
// vowel-tier sibling — see `design/word-song/short-i-pool-expansion.md`
// §6.
const WORD_SONG_FOCUS_NODES: readonly string[] = [
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
]

export function activeCombos(): readonly Combo[] {
  const out: Combo[] = []
  for (const focusNode of MATH_FOCUS_NODES) {
    out.push({ track: 'math', level: 1, focusNode })
  }
  for (const focusNode of WORD_SONG_FOCUS_NODES) {
    out.push({ track: 'word-song', level: 1, focusNode })
  }
  return out
}

// ── runner ──────────────────────────────────────────────────────────────

function buildAnthropicClient(): PlannerAnthropicClient {
  // Same wrapper as api/claude.ts buildAnthropicClient — narrows the
  // SDK's typed content blocks to the planner's PlannerCreateResponse
  // surface.
  const sdk = new Anthropic()
  return {
    messages: {
      create: async (args) => {
        const message = await sdk.messages.create({
          model: args.model,
          max_tokens: args.max_tokens,
          system: args.system,
          messages: args.messages,
        })
        return {
          content: message.content.map((block) =>
            block.type === 'text'
              ? { type: 'text', text: block.text }
              : { type: block.type },
          ),
        }
      },
    },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function bakeOne(
  combo: Combo,
  client: PlannerAnthropicClient,
  childName: string,
  outRoot: string,
): Promise<{ bytes: number }> {
  const response = await generateSessionStartResponse({
    client,
    track: combo.track,
    level: combo.level,
    childName,
    focusNode: combo.focusNode,
    // No recentSuccessRate — canon is a "fresh start" baseline. The
    // planner phrases this as "no data yet — pick a balanced mix".
    recentSuccessRate: null,
    renderOptions: {
      // Use the same Azure synth the production handler uses. The
      // module-singleton retry/backoff logic inside synthesizeUtterance
      // handles transient 429s.
      synth: synthesizeUtterance,
    },
  })

  const json = JSON.stringify(response)
  const path = canonFilePath(outRoot, combo)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, json, 'utf8')
  return { bytes: Buffer.byteLength(json, 'utf8') }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const combos = activeCombos()

  // Decide up front whether we'll need the upstream APIs at all. If
  // every combo is already on disk and we're not --force, this run is a
  // no-op and we skip the env-var pre-flight so a Vercel build (where
  // canon was committed/uploaded earlier) doesn't fail just because
  // the keys aren't set in the build environment.
  const combosToBake = args.dryRun
    ? combos
    : args.force
      ? combos
      : combos.filter((combo) => !existsSync(canonFilePath(args.out, combo)))

  // ── pre-flight ──
  // Two failure modes for missing keys, depending on context:
  //   - `--require-keys` is set: hard-fail (exit 1). Use this when you
  //     EXPECT the canon to be regenerated (release deploys, manual
  //     `yarn canon:regen`, etc.). The flag is opt-in so a missing key
  //     never silently degrades to "no canon" in those flows.
  //   - default: soft-fail (exit 0 with a warning) when keys are
  //     missing. This is the Vercel-build path: if the project owner
  //     hasn't provisioned ANTHROPIC_API_KEY in the build environment,
  //     the function still ships and falls through to the live planner.
  //     Slow session-start, but the app doesn't break on deploy.
  //
  // `--require-keys` is the safer default for human-driven runs; the
  // npm `prebuild` script omits it so a fresh clone of the repo can
  // build without requiring secrets.
  const requireKeys = process.argv.includes('--require-keys')

  if (!args.dryRun && combosToBake.length > 0) {
    const missing: string[] = []
    if (!process.env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY')
    if (!process.env.AZURE_SPEECH_KEY) missing.push('AZURE_SPEECH_KEY')
    if (missing.length > 0) {
      const msg = `MISSING ENV: ${missing.join(', ')}.`
      if (requireKeys) {
        console.error(`ERROR: ${msg} Add to .env.local or export them.`)
        process.exit(1)
      }
      console.warn(
        `\n[canon-generator] WARNING: ${msg}\n` +
          `Skipping canon generation. The function will fall through to\n` +
          `the live Haiku + Azure pipeline on every session-start until\n` +
          `the canon is generated. To generate locally:\n` +
          `  - Set both keys in .env.local (vercel env pull will populate)\n` +
          `  - Run \`yarn canon:generate\`\n` +
          `Or set them as Vercel build-environment variables and redeploy.\n`,
      )
      return
    }
  }

  console.log('canon root :', args.out)
  console.log('child name :', args.child)
  console.log(
    'combos     :',
    combos.length,
    '(to bake:',
    combosToBake.length,
    ')',
  )
  console.log('mode       :', args.force ? 'force regen' : 'incremental')
  if (args.dryRun) console.log('(--dry-run — no Anthropic / Azure calls)')
  console.log('')

  if (combosToBake.length === 0 && !args.dryRun) {
    console.log('canon up-to-date — nothing to bake.')
    return
  }

  const client = args.dryRun ? null : buildAnthropicClient()

  let written = 0
  let skipped = 0
  let failed = 0
  let totalBytes = 0

  for (const combo of combos) {
    const path = canonFilePath(args.out, combo)
    const label = `${combo.track}/level-${combo.level}/${combo.focusNode}`

    if (!args.force && existsSync(path)) {
      console.log(`skip   ${label}  (exists; pass --force to regen)`)
      skipped++
      continue
    }

    if (args.dryRun) {
      console.log(`would  ${label}  -> ${path}`)
      continue
    }

    process.stdout.write(`bake   ${label} ... `)
    try {
      const { bytes } = await bakeOne(combo, client!, args.child, args.out)
      totalBytes += bytes
      console.log(`ok (${(bytes / 1024).toFixed(0)}KB)`)
      written++
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`FAILED — ${msg}`)
    }

    // Polite delay between combos. Wall time is dominated by Azure
    // latency anyway; 250ms is well within the per-second ceiling for
    // any plausible Azure tier.
    await sleep(250)
  }

  console.log('')
  console.log(
    `summary: ${written} written, ${skipped} skipped, ${failed} failed, ${(totalBytes / 1024 / 1024).toFixed(2)}MB total`,
  )
  if (failed > 0) {
    process.exitCode = 1
  }
}

/**
 * Run main() ONLY when this file is invoked directly as a script — not
 * when it's imported by a test file. Without this guard, running
 * `vitest scripts/generateSessionCanon.test.ts` would call main() on
 * import, blow up on the missing ANTHROPIC_API_KEY pre-flight check,
 * and process.exit(1) the test runner itself.
 *
 * The ESM is-main idiom: compare `import.meta.url` against
 * `pathToFileURL(process.argv[1]).href`. Works on Windows + POSIX —
 * pathToFileURL normalises path separators so the equality check is
 * platform-agnostic.
 */
function isMainModule(): boolean {
  if (!process.argv[1]) return false
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return false
  }
}

if (isMainModule()) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
