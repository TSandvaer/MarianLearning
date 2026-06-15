/**
 * Blend-audition render script — CVC phoneme-blend scratch audition.
 *
 * ⚠️  NOT PRODUCTION CODE. Audition tooling only.  ⚠️
 * --------------------------------------------------------------------------
 * Renders the candidate blend SSML treatments defined in
 * `blendAuditionVariants.ts`. PASS 2 audits the now-failing CONTINUANT /
 * GLIDE / AFFRICATE classes (fricatives h/f/s/v, glide w, affricate j=/dʒ/ —
 * voice-QA #467) that candidate-f left bare; stops stay candidate-f and are
 * carried only as a `cat` control. Each candidate × word pair is rendered;
 * the manifest (`public/blend-audition-data.json`) feeds the standalone
 * `public/blend-audition.html` page reads — base64 MP3 + the exact SSML body
 * + a SHA-256 hash per (word × candidate).
 *
 * Every candidate (including candidate `a`, the baseline) is a HAND-BUILT
 * inner-SSML POSTed directly to Azure. Candidate `a`'s builder mirrors the
 * production `renderBlendInnerText` byte-for-byte, so playing it auditions the
 * EXACT rejected render; candidates b..e explore the break-placement / rate /
 * pitch levers BEYOND the production path.
 *
 * All candidates use the SAME voice config (EMMA_VOICE_CONFIG,
 * en-GB-OliviaNeural, rate -10% / pitch +0Hz / volume +0%), the SAME Azure
 * endpoint, headers, and output format — so each candidate is auditioned in
 * the identical acoustic frame the app uses; only the inner-text SSML differs.
 *
 * Run:
 *   npx tsx scripts/renderBlendAudition.ts          # render all, write manifest
 *   npx tsx scripts/renderBlendAudition.ts --dry    # print the SSML plan only
 *
 * Reads `.env.local` for AZURE_SPEECH_KEY / AZURE_SPEECH_REGION (the loader
 * below strips surrounding quotes — `.env.local` values are quote-wrapped,
 * e.g. AZURE_SPEECH_REGION="westeurope", and a standalone bake that doesn't
 * strip them fails every Azure fetch as "fetch failed", per planner-and-canon
 * §"splice, don't re-bake").
 *
 * If Azure REJECTS a candidate's SSML shape, it is recorded in the manifest
 * with `error: <message>` and NO audio — the page shows it as un-renderable.
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildAzureEndpoint,
  readAzureCredentials,
  uint8ToBase64,
  escapeSsml,
} from '../api/_tts.js'
import { EMMA_VOICE_CONFIG } from '../api/_session.js'
import { BLEND_CANDIDATES, BLEND_WORDS } from './blendAuditionVariants.js'
import type { BlendCandidate, BlendWord } from './blendAuditionVariants.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_PATH = join(REPO_ROOT, 'public/blend-audition-data.json')

const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
const USER_AGENT =
  'marian-tutor-blend-audition/1.0 (+marian-learning.vercel.app)'

// ── .env.local loader (mirrors renderVoiceAudition.ts) ──────────────────
function loadEnvLocal(): void {
  const path = join(REPO_ROOT, '.env.local')
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
    if (!process.env[key]) process.env[key] = value
  }
}

/** Wrap an inner-SSML region in the production speak/voice/prosody shell. */
function buildSpeakBody(inner: string): string {
  const v = EMMA_VOICE_CONFIG
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">` +
    `<voice name="${escapeSsml(v.voice)}">` +
    `<prosody pitch="${escapeSsml(v.pitch)}" rate="${escapeSsml(v.rate)}" volume="${escapeSsml(v.volume)}">` +
    `${inner}` +
    `</prosody></voice></speak>`
  )
}

/** Directly POST a hand-built SSML body to Azure. Mirrors
 *  synthesizeUtterance's request shape exactly so the only difference vs the
 *  production path is the inner-text SSML. */
async function renderRawSsml(body: string): Promise<Uint8Array> {
  const { key, region } = readAzureCredentials()
  const endpoint = buildAzureEndpoint(region)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml; charset=utf-8',
      'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
      'User-Agent': USER_AGENT,
    },
    body,
  })
  if (!res.ok) {
    let hint = ''
    try {
      hint = (await res.text()).trim().slice(0, 200)
    } catch {
      /* best-effort */
    }
    throw new Error(`Azure ${res.status}${hint ? `: ${hint}` : ''}`)
  }
  return new Uint8Array(await res.arrayBuffer())
}

interface CandidateRecord {
  id: string
  label: string
  /** Which failing phoneme class this candidate targets (page grouping). */
  targetClass: BlendCandidate['targetClass']
  mechanism: string
  /** The full SSML body sent to Azure (for the inventory table). */
  ssml: string
  /** SHA-256 of the base64 MP3 STRING (matches the page hash recipe), or
   *  null if render failed. */
  audioHash: string | null
  /** base64 MP3, or null if render failed. */
  base64: string | null
  mime: string
  /** Azure rejection message, if the SSML shape failed to render. */
  error?: string
}

interface WordRecord {
  /** slug == word */
  key: string
  word: string
  context: string
  candidates: CandidateRecord[]
}

async function renderCandidate(
  word: BlendWord,
  candidate: BlendCandidate,
  dry: boolean,
): Promise<CandidateRecord> {
  const inner = candidate.buildInner(word.word)
  const body = buildSpeakBody(inner)

  if (dry) {
    return {
      id: candidate.id,
      label: candidate.label,
      targetClass: candidate.targetClass,
      mechanism: candidate.mechanism,
      ssml: body,
      audioHash: null,
      base64: null,
      mime: 'audio/mpeg',
    }
  }

  try {
    const bytes = await renderRawSsml(body)
    const base64 = uint8ToBase64(bytes)
    const audioHash = createHash('sha256').update(base64).digest('hex')
    return {
      id: candidate.id,
      label: candidate.label,
      targetClass: candidate.targetClass,
      mechanism: candidate.mechanism,
      ssml: body,
      audioHash,
      base64,
      mime: 'audio/mpeg',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      id: candidate.id,
      label: candidate.label,
      targetClass: candidate.targetClass,
      mechanism: candidate.mechanism,
      ssml: body,
      audioHash: null,
      base64: null,
      mime: 'audio/mpeg',
      error: message,
    }
  }
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry')
  loadEnvLocal()

  if (
    !dry &&
    (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION)
  ) {
    console.error(
      'ERROR: AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set (add to .env.local). ' +
        'Run with --dry to preview the SSML plan without rendering.',
    )
    process.exit(1)
  }

  const words: WordRecord[] = []
  for (const word of BLEND_WORDS) {
    process.stdout.write(
      `\n${word.word} (${BLEND_CANDIDATES.length} candidates)\n`,
    )
    const candidates: CandidateRecord[] = []
    for (const candidate of BLEND_CANDIDATES) {
      process.stdout.write(`  ${candidate.id} ${candidate.label} ... `)
      const rec = await renderCandidate(word, candidate, dry)
      if (dry) {
        process.stdout.write('[dry]\n')
        process.stdout.write(`      ssml: ${rec.ssml}\n`)
      } else if (rec.error) {
        process.stdout.write(`AZURE REJECTED: ${rec.error}\n`)
      } else {
        process.stdout.write(
          `ok (${rec.base64!.length} b64 chars, hash ${rec.audioHash!.slice(0, 12)})\n`,
        )
      }
      candidates.push(rec)
    }
    words.push({
      key: word.word,
      word: word.word,
      context: word.context,
      candidates,
    })
  }

  if (dry) {
    console.log('\n[--dry] No Azure calls made; no manifest written.')
    return
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    voice: EMMA_VOICE_CONFIG.voice,
    rootProsody: {
      rate: EMMA_VOICE_CONFIG.rate,
      pitch: EMMA_VOICE_CONFIG.pitch,
      volume: EMMA_VOICE_CONFIG.volume,
    },
    note: 'NOT PRODUCTION. CVC phoneme-blend audition. The winning candidate is ported into renderBlendInnerText + re-baked in a separate follow-up PR.',
    words,
  }
  writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2), 'utf8')

  const total = words.reduce((n, w) => n + w.candidates.length, 0)
  const failed = words.reduce(
    (n, w) => n + w.candidates.filter((c) => c.error).length,
    0,
  )
  console.log(
    `\nWrote ${OUT_PATH}\n  ${words.length} words, ${total} candidates` +
      (failed
        ? `, ${failed} Azure-rejected (recorded with error, no audio)`
        : ''),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
