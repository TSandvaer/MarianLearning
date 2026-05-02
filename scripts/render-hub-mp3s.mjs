#!/usr/bin/env node
/**
 * Re-render the 18 fixed Hub welcome-back / node-tap MP3s via Azure Speech REST.
 *
 * Why this script exists
 * ----------------------
 * The Hub screen plays one of 18 short, fixed lines at mount (welcome-back
 * variants keyed off `HubEntryPath` + suggestion + a deterministic seed) plus
 * two tap-confirm lines. Per `design/screen-hub.md` § "Audio integration
 * contract", these lines are STATIC — they never vary per session — and so
 * they ride the same pre-rendered-MP3 + Howler pipeline as Greet's 4 lines.
 * Until the binaries land, `playHubLine()` falls through to the silent
 * 165-wpm caption walk: the screen functions but is mute.
 *
 * Sister script: `scripts/render-greet-mp3s.mjs` (Greet's 4 lines). Same
 * voice config, same SSML body shape, same Azure REST endpoint, same
 * directory layout. Refer there for the full architectural rationale; only
 * the inputs differ.
 *
 * Source-of-truth pinning
 * -----------------------
 * The `LINES` table below is duplicated from `src/screens/Hub/hubLines.ts`
 * (HUB_LINES). Node's ESM loader can't read `.ts` directly, so we copy the
 * 18 (id, file, text) triples here. `audioAssetIntegrity.test.ts` pins the
 * filename set against `HUB_LINES`, so a missing/renamed file is caught by
 * CI; the spoken-text equivalence is NOT guarded — be deliberate when
 * editing.
 *
 * Voice config — must stay in lockstep with `EMMA_VOICE_CONFIG` in
 * `api/_session.ts` and the inline literals in `render-greet-mp3s.mjs`.
 * Voice drift between Hub, Greet, and Path A would be audible the moment
 * Marian crosses a screen boundary.
 *
 * Usage
 * -----
 *   1. Ensure `.env.local` (in the repo root) carries:
 *        AZURE_SPEECH_KEY=<key>
 *        AZURE_SPEECH_REGION=westeurope
 *      OR `npx vercel env pull --environment development .env.local`,
 *      OR export the same vars into the shell.
 *   2. From the repo root: `node scripts/render-hub-mp3s.mjs`
 *   3. The 18 MP3s land in `public/assets/audio/hub/`, overwriting any
 *      prior bake.
 *   4. Pass `--dry-run` to print the SSML bodies without calling Azure.
 *
 * Cost
 * ----
 * Azure S0 tier: 18 utterances × ~25 chars each ≈ 450 chars total. Trivial
 * against the 500K char/month budget. The 200ms inter-call sleep keeps us
 * well under the 20 tx/s limit.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const OUT_DIR = join(REPO_ROOT, 'public', 'assets', 'audio', 'hub')

// ── Env loading (verbatim from render-greet-mp3s.mjs) ───────────────────

function loadDotEnvLocal() {
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

const DRY_RUN = process.argv.includes('--dry-run')
const AZURE_KEY = process.env.AZURE_SPEECH_KEY
const AZURE_REGION = process.env.AZURE_SPEECH_REGION || 'westeurope'

if (!AZURE_KEY && !DRY_RUN) {
  console.error(
    '\nERROR: AZURE_SPEECH_KEY is not set.\n' +
      'Either:\n' +
      '  - Create .env.local in the repo root with AZURE_SPEECH_KEY=...\n' +
      '  - OR run `npx vercel env pull --environment development .env.local`\n' +
      '  - OR export AZURE_SPEECH_KEY=... before running this script.\n' +
      '  - Pass --dry-run to inspect SSML bodies without calling Azure.\n',
  )
  process.exit(1)
}

// ── Voice + line config (duplicated; see header) ────────────────────────

const VOICE = 'en-US-EmmaMultilingualNeural'
const RATE = '-10%'
const PITCH = '+0Hz'
const VOLUME = '+0%'

/**
 * Hub manifest — duplicated from `src/screens/Hub/hubLines.ts` HUB_LINES.
 * Order does not matter for the render output. Filenames MUST stay in
 * lockstep with the manifest (audioAssetIntegrity.test.ts guards this).
 */
const LINES = [
  // Anchor lines
  { file: 'hub-welcome-first-again.mp3', text: 'Hi again!' },
  { file: 'hub-welcome-what-today.mp3', text: 'Hi! What today?' },
  { file: 'hub-welcome-try-number-garden.mp3', text: 'Hi! Try Number Garden?' },
  { file: 'hub-welcome-try-word-song.mp3', text: 'Hi! Try Word Song?' },
  { file: 'hub-welcome-back-soon.mp3', text: 'Back so soon!' },
  { file: 'hub-welcome-pick-again.mp3', text: 'Pick again?' },
  { file: 'hub-welcome-pick-next.mp3', text: "Pick what's next." },
  // Rotation variants — what-today
  { file: 'hub-welcome-what-today-alt-1.mp3', text: "Hi! Look who's here!" },
  { file: 'hub-welcome-what-today-alt-2.mp3', text: 'Hi! Ready?' },
  { file: 'hub-welcome-what-today-alt-3.mp3', text: 'Hello, friend!' },
  // Rotation variants — try-number-garden
  {
    file: 'hub-welcome-try-number-garden-alt-1.mp3',
    text: 'Hi! Number Garden today?',
  },
  {
    file: 'hub-welcome-try-number-garden-alt-2.mp3',
    text: 'Hello! Want some flowers?',
  },
  // Rotation variants — try-word-song
  { file: 'hub-welcome-try-word-song-alt-1.mp3', text: 'Hi! Word Song today?' },
  {
    file: 'hub-welcome-try-word-song-alt-2.mp3',
    text: 'Hello! Want some music?',
  },
  // Rotation variants — back-soon
  { file: 'hub-welcome-back-soon-alt-1.mp3', text: 'Hi again!' },
  { file: 'hub-welcome-back-soon-alt-2.mp3', text: "You're back!" },
  // Node-tap "enter" lines
  { file: 'hub-enter-number-garden.mp3', text: 'Number Garden!' },
  { file: 'hub-enter-word-song.mp3', text: 'Word Song!' },
]

// ── SSML build (verbatim from render-greet-mp3s.mjs) ────────────────────

function escapeSsml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildSsml(text) {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">` +
    `<voice name="${escapeSsml(VOICE)}">` +
    `<prosody pitch="${escapeSsml(PITCH)}" rate="${escapeSsml(RATE)}" volume="${escapeSsml(VOLUME)}">` +
    `${escapeSsml(text)}` +
    `</prosody></voice></speak>`
  )
}

// ── Azure call (verbatim from render-greet-mp3s.mjs) ────────────────────

const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
const AZURE_ENDPOINT = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`

async function synthesize(ssml) {
  const res = await fetch(AZURE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
      'User-Agent': 'marian-tutor-hub-render/1.0',
    },
    body: ssml,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Azure TTS ${res.status}: ${body.slice(0, 200)}`)
  }
  return new Uint8Array(await res.arrayBuffer())
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Driver ──────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  console.log(`Voice : ${VOICE}`)
  console.log(`Rate  : ${RATE}`)
  console.log(`Region: ${AZURE_REGION}`)
  console.log(`Out   : ${OUT_DIR}`)
  console.log(`Lines : ${LINES.length}`)
  if (DRY_RUN) console.log('(--dry-run — no Azure calls)')
  console.log('')

  let totalBytes = 0
  for (const line of LINES) {
    const ssml = buildSsml(line.text)
    if (DRY_RUN) {
      console.log(`=== ${line.file} ===`)
      console.log(`text: ${line.text}`)
      console.log(`ssml: ${ssml}`)
      console.log('')
      continue
    }
    process.stdout.write(`Rendering ${line.file.padEnd(46)} ... `)
    try {
      const bytes = await synthesize(ssml)
      writeFileSync(join(OUT_DIR, line.file), bytes)
      totalBytes += bytes.length
      console.log(`ok (${bytes.length}B)`)
    } catch (err) {
      console.log(`FAILED — ${err.message}`)
      process.exitCode = 1
    }
    await sleep(200)
  }

  if (!DRY_RUN) {
    console.log('')
    console.log(`Total: ${LINES.length} files, ${totalBytes}B`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
