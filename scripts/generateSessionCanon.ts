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
 *   npx tsx scripts/generateSessionCanon.ts --lint-warn     # warn-only lint
 *
 * Run from the repo root, with .env.local providing both ANTHROPIC and
 * Azure keys (or with the same keys exported into the shell).
 *
 * Bake-time lint
 * --------------
 * Every successfully-rendered SessionStartResponse is passed through
 * `lintCanonResponse` (see scripts/canonLint.ts, ticket 86c9qhr9k)
 * BEFORE it's written to disk. Default behaviour: any violation throws
 * `CanonLintError`, the bake fails for that combo, and the corrupt JSON
 * never reaches `public/canon/`. Use `--lint-warn` to downgrade to
 * warn-only during prompt-iteration dev cycles. CI never sets
 * `--lint-warn`.
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
import {
  CanonLintError,
  formatLintReport,
  lintCanonResponse,
} from './canonLint.ts'
import {
  CompositionLintError,
  assertAddToTenCompositionClean,
  assertAddToTwentyCompositionClean,
  assertSubToTenCompositionClean,
  assertSubToTwentyCompositionClean,
  assertTwoDigitAddsubCompositionClean,
  assertTwoDigitAddsubWithRegroupCompositionClean,
} from './compositionLint.ts'

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
  /** When true, lint violations are logged as warnings instead of
   *  aborting the bake. Default false (fail-fast). Use during local
   *  prompt-iteration only — CI never sets this. Ticket 86c9qhr9k. */
  lintWarn: boolean
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    force: argv.includes('--force'),
    dryRun: argv.includes('--dry-run'),
    lintWarn: argv.includes('--lint-warn'),
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

// Wire-side `focusNode` literals (`SkillNode` union from
// `src/lib/progress/types.ts`). The bake script PASSES these literals
// to the planner — matching what `pickFocusNode` emits at runtime — so
// the planner's `Focus skill node: <X>.` line matches the runtime
// shape. Disk-file naming is decoupled via `canonFileTierFor` so the
// `'two-digit-addsub-no-regroup'` literal lands in
// `public/canon/math/level-1/two-digit-addsub.json` (the legacy disk
// name kept stable for the no-regroup tier per dispatch contract).
const MATH_FOCUS_NODES: readonly string[] = [
  'number-recog',
  'add-to-10',
  'add-to-20',
  'sub-to-10',
  'sub-to-20',
  // Wave 5 (ticket 86c9y1p99 — PR B). Sibling-tier split of
  // `'two-digit-addsub'`. Both literals are valid wire focusNodes
  // post-PR-#308. The `-no-regroup` literal maps to the existing
  // `two-digit-addsub.json` canon disk file (kept stable per dispatch
  // contract); `-with-regroup` maps to its own
  // `two-digit-addsub-with-regroup.json` disk file (Wave 6C — ticket
  // 86c9y34xn — bakes the regrouping canon now that Dave's directive
  // ships via PR #314).
  'two-digit-addsub-no-regroup',
  'two-digit-addsub-with-regroup',
  'skip-counting',
  'mult-2-5-10',
  'mult-3-4',
  'mult-6-9',
]

// Word-song first-class content modes — must match the
// WORD_SONG_FIRST_CLASS_FOCUS_NODES list in api/_planner.ts. Untuned
// tiers (letter-sounds / sight-words / simple-sentences) fall back to
// blending-cv content via `effectiveFocusNode`, so baking canon
// entries for them would just be a wasteful copy of the blending-cv
// blob — they're omitted here on purpose. Future tier widenings
// (paired parser-then-planner steps per the contract doc) add their
// entries here when they go first-class.
// The digraph SkillNode split (PR #211) replaces the single `digraphs`
// literal with three sequential sibling nodes; `digraphs-sh` went
// first-class first (its content tier) and IS baked; `digraphs-ch`
// went first-class second (its content tier) and IS baked;
// `digraphs-th-voiceless` is now ALSO first-class (its content tier —
// this PR) and IS baked.
//
// Ticket 86c9m3ae3 added `cvc-words-short-o` as the next-vowel sibling
// tier — see `design/word-song/short-o-pool-expansion.md` §6 (canon-
// bake plan). Ticket 86c9q9ben added `cvc-words-short-u` as the third
// vowel-tier sibling — see `design/word-song/short-u-pool-expansion.md`
// §6. Ticket 86c9qdba4 added `cvc-words-short-i` as the fourth
// vowel-tier sibling — see `design/word-song/short-i-pool-expansion.md`
// §6. Ticket 86c9teua2 added `cvc-words-short-e` as the fifth and
// FINAL single-vowel tier in the o → u → i → e canonical arc — see
// `design/word-song/short-e-pool-expansion.md` §7. The digraphs-sh
// content tier added `digraphs-sh` as the FIRST digraph tier — see
// `design/word-song/digraphs-sh-word-list.md` §6/§8 (AC10 canon bake).
// The digraphs-ch content tier added `digraphs-ch` as the SECOND
// digraph tier — see `design/word-song/digraphs-ch-word-list.md`
// §6/§8 (AC10 canon bake). Unlike digraphs-sh, the ch tier has ZERO
// hybridMode words. The digraphs-th content tier added
// `digraphs-th-voiceless` as the THIRD and final digraph tier — see
// `design/word-song/digraphs-th-word-list.md` §1 (reconciled against
// Dave's digraph-th-addendum §3f). Like digraphs-sh, the th tier has
// hybridMode words (`thick`, `cloth`).
// Wave 7 Track A3 (ticket 86c9y4983) added `letter-names` — the FIRST
// literacy tier in WORD_SONG_NODES_IN_ORDER — as a first-class baked
// tier. The tier ships ZERO picture-pack assets (letter glyphs are
// rendered as text in the chip frame, no `picture-{word}.svg`
// pipeline). See `design/word-song/letter-names-content.md` (Kyle A1) +
// `WORD_SONG_TRACK_GUIDE` letter-names block (Dave A2, PR #329).
// Wave 7 Track A7 (ticket 86c9y49cd) added `letter-sounds` as the FIRST
// non-CVC word-song tier to ship first-class content — see
// `design/word-song/letter-sounds-content.md` §1-§6. The tier emits
// isolated-phoneme prompts (`"Which letter says mmm?"`) using a
// mnemonic substitution table wrapped at render time via the
// tier-aware extension of `PHONEME_OVERRIDES` in `api/_tts.ts`
// (Amendment 1 of this PR). The canon bake produces
// `public/canon/word-song/level-1/letter-sounds.json` whose utterance
// text is plain mnemonic ("mmm", "buh", "o", etc.) and whose audio
// payload is the phoneme-wrapped MP3 (the substitution table fires
// during the bake-time Azure render call).
const WORD_SONG_FOCUS_NODES: readonly string[] = [
  'letter-names',
  'letter-sounds',
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
  'digraphs-sh',
  'digraphs-ch',
  'digraphs-th-voiceless',
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
  lintWarn: boolean,
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

  // Bake-time lint gate (ticket 86c9qhr9k). Default behaviour: any
  // non-ASCII / slash-IPA / angle-tag violation throws, the bake fails,
  // and the corrupt JSON never reaches disk. `--lint-warn` downgrades
  // to a printed warning + writes anyway (prompt-iteration dev only).
  const violations = lintCanonResponse(response)
  if (violations.length > 0) {
    const summary = formatLintReport({
      filesScanned: 1,
      totalViolations: violations.length,
      baselineViolations: 0,
      findings: [{ filePath: `${combo.track}/${combo.focusNode}`, violations }],
      baselineFindings: [],
      unparseable: [],
    })
    if (lintWarn) {
      console.warn(
        `\n[canon-lint] WARN — writing despite violations:\n${summary}\n`,
      )
    } else {
      // Throwing CanonLintError lets the bakeOne catch site log the
      // structured violations alongside the failure summary line.
      throw new CanonLintError(violations)
    }
  }

  // Composition-rule lint gate. Mechanically validates the 8-problem set
  // against per-tier composition rules (currently scoped to sub-to-10,
  // add-to-10, sub-to-20, and add-to-20). Sits after the text-encoding lint so the
  // bake author sees the hygiene errors first. `--lint-warn` also
  // downgrades this lint — same dev-iteration semantics as the
  // text-encoding lint.
  //
  // Out-of-scope tiers (digraphs, cvc-words, etc.) are no-ops
  // here — only the math tiers with bindings fire. The dispatch is
  // duplicated between this file (bake-time) and `compositionLint.ts`
  // `resolveTierBinding` (CI-time disk walker); both walk the SAME tier
  // set and must stay in sync. Tests in `compositionLint.test.ts` assert
  // each binding fires; tests in `generateSessionCanon.test.ts` cover
  // this dispatch.
  if (combo.track === 'math' && combo.focusNode === 'sub-to-10') {
    try {
      assertSubToTenCompositionClean(
        `${combo.track}/${combo.focusNode}`,
        response,
      )
    } catch (err) {
      if (lintWarn && err instanceof CompositionLintError) {
        console.warn(
          `\n[composition-lint] WARN — writing despite violations: ` +
            `${err.message}\n` +
            err.violations
              .map((v) => `  - [${v.rule}] ${v.message}`)
              .join('\n') +
            '\n',
        )
      } else {
        throw err
      }
    }
  } else if (combo.track === 'math' && combo.focusNode === 'add-to-10') {
    try {
      assertAddToTenCompositionClean(
        `${combo.track}/${combo.focusNode}`,
        response,
      )
    } catch (err) {
      if (lintWarn && err instanceof CompositionLintError) {
        console.warn(
          `\n[composition-lint] WARN — writing despite violations: ` +
            `${err.message}\n` +
            err.violations
              .map((v) => `  - [${v.rule}] ${v.message}`)
              .join('\n') +
            '\n',
        )
      } else {
        throw err
      }
    }
  } else if (combo.track === 'math' && combo.focusNode === 'sub-to-20') {
    try {
      assertSubToTwentyCompositionClean(
        `${combo.track}/${combo.focusNode}`,
        response,
      )
    } catch (err) {
      if (lintWarn && err instanceof CompositionLintError) {
        console.warn(
          `\n[composition-lint] WARN — writing despite violations: ` +
            `${err.message}\n` +
            err.violations
              .map((v) => `  - [${v.rule}] ${v.message}`)
              .join('\n') +
            '\n',
        )
      } else {
        throw err
      }
    }
  } else if (combo.track === 'math' && combo.focusNode === 'add-to-20') {
    try {
      assertAddToTwentyCompositionClean(
        `${combo.track}/${combo.focusNode}`,
        response,
      )
    } catch (err) {
      if (lintWarn && err instanceof CompositionLintError) {
        console.warn(
          `\n[composition-lint] WARN — writing despite violations: ` +
            `${err.message}\n` +
            err.violations
              .map((v) => `  - [${v.rule}] ${v.message}`)
              .join('\n') +
            '\n',
        )
      } else {
        throw err
      }
    }
  } else if (
    combo.track === 'math' &&
    combo.focusNode === 'two-digit-addsub-no-regroup'
  ) {
    try {
      // `two-digit-addsub-no-regroup` is the wire `SkillNode` literal; the
      // composition-lint config is keyed on the disk-tier identifier
      // `'two-digit-addsub'` (see `CanonFileTier` in `compositionLint.ts`).
      // The assertion runs on the just-baked response regardless of
      // identifier shape — the disk filename is derived in the writer
      // below via `canonFileTierFor`.
      assertTwoDigitAddsubCompositionClean(
        `${combo.track}/two-digit-addsub`,
        response,
      )
    } catch (err) {
      if (lintWarn && err instanceof CompositionLintError) {
        console.warn(
          `\n[composition-lint] WARN — writing despite violations: ` +
            `${err.message}\n` +
            err.violations
              .map((v) => `  - [${v.rule}] ${v.message}`)
              .join('\n') +
            '\n',
        )
      } else {
        throw err
      }
    }
  } else if (
    combo.track === 'math' &&
    combo.focusNode === 'two-digit-addsub-with-regroup'
  ) {
    try {
      // Wave 6C (ticket 86c9y34xn) — bake-time composition lint for the
      // regrouping tier. Wire literal and disk-file tier identifier match
      // verbatim (`canonFileTierFor` is a pass-through for
      // `two-digit-addsub-with-regroup`).
      assertTwoDigitAddsubWithRegroupCompositionClean(
        `${combo.track}/two-digit-addsub-with-regroup`,
        response,
      )
    } catch (err) {
      if (lintWarn && err instanceof CompositionLintError) {
        console.warn(
          `\n[composition-lint] WARN — writing despite violations: ` +
            `${err.message}\n` +
            err.violations
              .map((v) => `  - [${v.rule}] ${v.message}`)
              .join('\n') +
            '\n',
        )
      } else {
        throw err
      }
    }
  }

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
  console.log('lint       :', args.lintWarn ? 'warn-only' : 'fail-fast')
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
      const { bytes } = await bakeOne(
        combo,
        client!,
        args.child,
        args.out,
        args.lintWarn,
      )
      totalBytes += bytes
      console.log(`ok (${(bytes / 1024).toFixed(0)}KB)`)
      written++
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`FAILED — ${msg}`)
      // Surface lint violations explicitly so the author can see exactly
      // which utterance(s) tripped the rule without re-running.
      if (err instanceof CanonLintError) {
        for (const v of err.violations) {
          console.log(
            `         ↳ [${v.rule}] id=${v.utteranceId} text=${JSON.stringify(v.text)}`,
          )
        }
      } else if (err instanceof CompositionLintError) {
        for (const v of err.violations) {
          const slot = v.problemIndex === null ? '*' : `P${v.problemIndex}`
          console.log(`         ↳ [${v.rule}] slot=${slot} ${v.message}`)
        }
      }
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
