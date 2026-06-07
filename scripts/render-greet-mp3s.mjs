#!/usr/bin/env node
/**
 * Re-render the 4 fixed Greet MP3s via Azure Speech REST.
 *
 * Why this script exists
 * ----------------------
 * Greet's 4 lines ("Hi!", "I'm Emma.", "It's so nice to meet you.", "Tap
 * the heart when you're ready.") are FIXED text — they never change
 * session-to-session. Per the audio architecture (`design/audio-architecture.md`)
 * they ship as bundled MP3s in `public/assets/audio/greet/` and play through
 * Howler.js, sidestepping iPad Safari's Web Speech / first-call-after-idle
 * synthesis flakiness.
 *
 * The MP3s have to be regenerated whenever the canonical voice config in
 * `api/_session.ts` (`EMMA_VOICE_CONFIG`) changes — otherwise Greet's
 * voice drifts from Path A's voice and the child hears a tone change at
 * the screen boundary.
 *
 * History
 * -------
 *  - 2026-04-25 (PR #25, ticket 86c9gqprh): initial bake via the Python
 *    `edge-tts` CLI at `en-US-AnaNeural` rate `-10%`. Hand-run, not
 *    committed as a script.
 *  - 2026-04-28 (ticket 86c9hjnq1, Phase 3a): re-rendered with
 *    `en-US-EmmaMultilingualNeural` at the same rate; line 2 also
 *    re-keyed from "I'm Melody." to "I'm Emma." as part of the broader
 *    character pivot away from Sanrio IP. Committed as a script so future
 *    voice/text changes don't require recovering the production recipe
 *    from a chat transcript.
 *  - 2026-06-06 (British-voice rollout, Thomas directive): VOICE const
 *    swapped `en-US-EmmaMultilingualNeural` → `en-GB-OliviaNeural`; all
 *    4 Greet MP3s re-rendered. See `api/_session.ts` EMMA_VOICE_CONFIG.
 *
 * Usage
 * -----
 *   1. Ensure `.env.local` (in the repo root) carries:
 *        AZURE_SPEECH_KEY=<key>
 *        AZURE_SPEECH_REGION=westeurope
 *      OR `npx vercel env pull --environment development .env.local`,
 *      OR export the same vars into the shell.
 *   2. From the repo root: `node scripts/render-greet-mp3s.mjs`
 *   3. The 4 MP3s land in `public/assets/audio/greet/`, overwriting any
 *    prior bake. Re-run vitest's `audioAssetIntegrity` test to confirm
 *    each file is between 1KB and 30KB and starts with a valid MPEG
 *    Layer III frame-sync header.
 *   4. Pass `--dry-run` to print the SSML bodies without calling Azure.
 *
 * The text and voice config are duplicated literals here rather than
 * imported from `src/screens/greetSequence.ts` and `api/_session.ts`
 * because Node's ESM loader cannot resolve `.ts` sources without the
 * project's compile step. The duplication is small and intentional;
 * audioAssetIntegrity.test.ts pins the MP3 list against
 * `GREET_LINE_SOURCES` so a divergence (file added/removed) is caught
 * by CI. A divergence in the SPOKEN TEXT or VOICE would not be caught
 * by that test — be deliberate when editing this script.
 *
 * Cost
 * ----
 * Azure F0 free tier is 20 tx/s and 500K chars/month. 4 calls of
 * ~30 chars each is well within both ceilings; the script sleeps 200ms
 * between calls.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const OUT_DIR = join(REPO_ROOT, 'public', 'assets', 'audio', 'greet')

// ── Env loading ─────────────────────────────────────────────────────────
// Minimal .env.local parser — no dotenv dep. KEY=VALUE only, comments
// allowed, surrounding quotes stripped (vercel env pull writes
// `KEY="value"`). Process env wins over file values.

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

// ── Voice + line config (duplicated; see header rationale) ──────────────

const VOICE = 'en-GB-OliviaNeural'
const RATE = '-10%'
const PITCH = '+0Hz'
const VOLUME = '+0%'

/**
 * The 4 Greet lines, paired with their stable filename. The line text
 * MUST stay in sync with `GREET_LINES` in `src/screens/greetSequence.ts`.
 * Filename keys MUST stay in sync with `SOURCES` in
 * `src/lib/audio/preRecorded.ts`.
 *
 * Phase 3b (ticket 86c9jccp7, 2026-04-29): the second line was renamed
 * `greet-02-im-melody.mp3` → `greet-02-im-emma.mp3` in lockstep with
 * the corresponding `'imMelody'` → `'imEmma'` GreetLineKey rename in
 * `src/lib/audio/preRecorded.ts`.
 */
const LINES = [
  { file: 'greet-01-hi.mp3', text: 'Hi!' },
  { file: 'greet-02-im-emma.mp3', text: "I'm Emma." },
  { file: 'greet-03-nice-to-meet-you.mp3', text: "It's so nice to meet you." },
  {
    file: 'greet-04-tap-the-heart.mp3',
    text: "Tap the heart when you're ready.",
  },
]

// ── SSML build ──────────────────────────────────────────────────────────
// Verbatim copy of the inputs `buildSsmlBody` from `api/_tts.ts` would
// produce for these declarative utterances. The trailing-interrogative
// wrap (renderSsmlInnerText) is a no-op on declarative text, so we
// embed the plain XML-escaped text directly — the resulting SSML body
// is byte-identical to what api/_tts.ts emits today.

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

// ── Azure call ──────────────────────────────────────────────────────────

const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
const AZURE_ENDPOINT = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`

async function synthesize(ssml) {
  const res = await fetch(AZURE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      // `; charset=utf-8` mirrors the canonical _tts.ts fix (ticket
      // 86c9qhr91): without it Azure may decode the SSML body as
      // Windows-1252 and produce mojibake on em-dash / curly-quote /
      // en-dash codepoints. The Greet/Hub render scripts share the same
      // POST shape and need the same defense-in-depth.
      'Content-Type': 'application/ssml+xml; charset=utf-8',
      'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
      'User-Agent': 'marian-tutor-greet-render/1.0',
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
  console.log(`Voice : ${VOICE}`)
  console.log(`Rate  : ${RATE}`)
  console.log(`Region: ${AZURE_REGION}`)
  console.log(`Out   : ${OUT_DIR}`)
  if (DRY_RUN) console.log('(--dry-run — no Azure calls)')
  console.log('')

  for (const line of LINES) {
    const ssml = buildSsml(line.text)
    if (DRY_RUN) {
      console.log(`=== ${line.file} ===`)
      console.log(`text: ${line.text}`)
      console.log(`ssml: ${ssml}`)
      console.log('')
      continue
    }
    process.stdout.write(`Rendering ${line.file} ... `)
    try {
      const bytes = await synthesize(ssml)
      writeFileSync(join(OUT_DIR, line.file), bytes)
      console.log(`ok (${bytes.length}B)`)
    } catch (err) {
      console.log(`FAILED — ${err.message}`)
      process.exitCode = 1
    }
    await sleep(200)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
