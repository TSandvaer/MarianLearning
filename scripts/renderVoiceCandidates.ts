/**
 * One-off diagnostic render — British-voice candidates for Emma.
 *
 * Thomas's standing directive (2026-06-06): prefer a British (en-GB) voice
 * over the US voice. A GB voice natively says "o as in hot" (rounded +
 * short) with no IPA hacking — root-cause fix for the short-O defect. This
 * supersedes the earlier en-US short-O IPA candidate hunt.
 *
 * This script renders a small representative clip set per candidate GB
 * voice to `public/voice-candidates/v{N}-{slot}.mp3` and exits. It is
 * diagnostic-only: NOT part of the canon bake, does NOT touch
 * `public/canon/**`, does NOT change `api/_tts.ts`. After Thomas picks a
 * voice we roll the winner across the canon — a SEPARATE change.
 *
 * Voice roster is the REAL Azure en-GB female list (queried live, not
 * guessed). Each candidate gets:
 *   - short-O read "Which letter says o?" — the key judge — rendered TWO
 *     ways (plain "o" and <phoneme ph="ɒ">) so Thomas can pick the GB
 *     short-O that sounds most like "hot".
 *   - M continuant "Which letter says mmm?" — confirm the stress+length
 *     remediation still holds on the GB voice.
 *   - short-A "Which letter says aaa?".
 *   - a character sample so Thomas hears Emma's overall new timbre.
 *
 * The remediated SSML treatment is preserved: rate -10%, stress ˈ + length
 * ː on the continuant, 300ms pre-phoneme break, schwa-H (not exercised
 * here but unchanged in production). short-A uses ˈæ; short-O variant (b)
 * uses ɒ (the GB lexicon keeps it rounded+short).
 *
 * Run from repo root (kevin-wt) with a live Azure subscription:
 *   npx tsx scripts/renderVoiceCandidates.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildAzureEndpoint, readAzureCredentials } from '../api/_tts.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

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

const RATE = '-10%'
const PITCH = '+0Hz'
const VOLUME = '+0%'
const BREAK = '<break time="300ms"/>'

/** Candidate voices — REAL en-GB female ShortNames from the Azure
 *  /voices/list roster (queried 2026-06-06). Neutral page labels are
 *  Voice 1..4; this map is the internal label→voice record for the report. */
const VOICES: ReadonlyArray<{ id: string; voice: string; note: string }> = [
  {
    id: 'v1',
    voice: 'en-GB-SoniaNeural',
    note: 'warm young-adult female, has cheerful style — closest GB analog to Emma',
  },
  {
    id: 'v2',
    voice: 'en-GB-AdaMultilingualNeural',
    note: 'multilingual GB voice — same family as current en-US-EmmaMultilingualNeural (least architecture drift)',
  },
  {
    id: 'v3',
    voice: 'en-GB-MaisieNeural',
    note: "Azure's en-GB CHILD voice — younger/child-leaning option",
  },
  {
    id: 'v4',
    voice: 'en-GB-OliviaNeural',
    note: 'warm, gentle adult-young female — alternate timbre',
  },
]

/** Per-voice clip set. `slot` becomes the filename suffix; `inner` is the
 *  prosody-inner fragment. `label` is shown on the page (neutral, no IPA). */
const CLIPS: ReadonlyArray<{ slot: string; label: string; inner: string }> = [
  {
    slot: 'short-o-plain',
    label: 'Short-O (a) — "Which letter says o?"',
    // Plain text "o" — lets the GB lexicon pick the natural short-O.
    inner: 'Which letter says o?',
  },
  {
    slot: 'short-o-ipa',
    label: 'Short-O (b) — "Which letter says o?"',
    // Explicit ɒ — GB lexicon keeps /ɒ/ rounded + short ("hot").
    inner: `Which letter says ${BREAK}<phoneme alphabet="ipa" ph="ɒ">o</phoneme>?`,
  },
  {
    slot: 'm',
    label: 'M (continuant) — "Which letter says mmm?"',
    // Remediated continuant: stress ˈ + length ː, with the 300ms break.
    inner: `Which letter says ${BREAK}<phoneme alphabet="ipa" ph="ˈmː">mmm</phoneme>?`,
  },
  {
    slot: 'short-a',
    label: 'Short-A — "Which letter says aaa?"',
    inner: `Which letter says ${BREAK}<phoneme alphabet="ipa" ph="ˈæ">aaa</phoneme>?`,
  },
  {
    slot: 'sample',
    label: 'Character sample — Emma intro',
    inner: "Hi! I'm Emma. Let's learn together. You can do it!",
  },
]

function escapeApos(s: string): string {
  // The sample sentence carries an apostrophe; everything else is
  // hand-authored SSML-safe. Escape only the apostrophe in plain-text
  // fragments (the phoneme fragments have no XML metacharacters).
  return s.replace(/'/g, '&apos;')
}

function envelope(voice: string, inner: string): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">` +
    `<voice name="${voice}">` +
    `<prosody pitch="${PITCH}" rate="${RATE}" volume="${VOLUME}">` +
    `${escapeApos(inner)}` +
    `</prosody></voice></speak>`
  )
}

async function main(): Promise<void> {
  const { key } = readAzureCredentials()
  const region = process.env.AZURE_SPEECH_REGION!
  console.log(`Azure region: ${region}`)

  const outDir = join(REPO_ROOT, 'public', 'voice-candidates')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  for (const v of VOICES) {
    console.log(`\n=== ${v.id} = ${v.voice} (${v.note}) ===`)
    for (const clip of CLIPS) {
      const ssml = envelope(v.voice, clip.inner)
      try {
        const res = await fetch(buildAzureEndpoint(region), {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/ssml+xml; charset=utf-8',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
            'User-Agent': 'marian-tutor/1.0 (+marian-learning.vercel.app)',
          },
          body: ssml,
        })
        if (!res.ok) {
          const hint = (await res.text()).slice(0, 200)
          throw new Error(`Azure ${res.status}: ${hint}`)
        }
        const buf = new Uint8Array(await res.arrayBuffer())
        if (buf.length < 200) {
          throw new Error(
            `tiny render (${buf.length} bytes) — likely SSML junk`,
          )
        }
        const outPath = join(outDir, `${v.id}-${clip.slot}.mp3`)
        writeFileSync(outPath, buf)
        console.log(
          `  ✓ ${v.id}-${clip.slot}.mp3 (${buf.length} bytes) — ${clip.slot}`,
        )
      } catch (err) {
        console.error(
          `  ✗ ${v.id}-${clip.slot} FAILED: ${err instanceof Error ? err.message : String(err)}`,
        )
        process.exitCode = 1
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
