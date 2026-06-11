/**
 * Voice-audition render script — ticket 86ca7yh5k.
 *
 * ⚠️  NOT PRODUCTION CODE. Audition tooling only.  ⚠️
 * --------------------------------------------------------------------------
 * Renders the candidate SSML variants defined in `voiceAuditionVariants.ts`
 * for the 3 stubborn sounds (vvv / O letter-name / "four comes after three"),
 * each of which has rejected TWO production fix rounds. Writes a self-
 * contained manifest (`public/voice-audition-data.json`) that the standalone
 * `public/voice-audition.html` page reads — base64 MP3 + the exact SSML body
 * + a SHA-256 hash per variant.
 *
 * How variant-0 (baseline) vs variants 1..N differ:
 *   • Variant 0 is the CURRENT LIVE render — rendered through the PRODUCTION
 *     `synthesizeUtterance` (which calls renderSsmlInnerText), so it carries
 *     exactly the rejected production treatment. This is the A/B anchor.
 *   • Variants 1..N bypass renderSsmlInnerText and POST a hand-built SSML
 *     body directly to Azure, so they can explore treatments BEYOND the ones
 *     already baked into (and rejected from) the production path.
 *
 * Both paths use the SAME voice config (EMMA_VOICE_CONFIG, en-GB-OliviaNeural,
 * rate -10% / pitch +0Hz / volume +0%), the SAME Azure endpoint, headers, and
 * output format — so a variant is auditioned in the identical acoustic frame
 * the app uses; only the inner-text SSML differs.
 *
 * Run:
 *   npx tsx scripts/renderVoiceAudition.ts          # render all, write manifest
 *   npx tsx scripts/renderVoiceAudition.ts --dry    # print the SSML plan only
 *
 * Reads `.env.local` for AZURE_SPEECH_KEY / AZURE_SPEECH_REGION.
 *
 * If Azure REJECTS a variant's SSML shape (e.g. an IPA Olivia won't parse),
 * the variant is recorded in the manifest with `error: <message>` and NO
 * audio — the page shows it as un-renderable. The inventory table records
 * exactly what was tried, per the ticket's "note it and move on" rule.
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  synthesizeUtterance,
  buildAzureEndpoint,
  readAzureCredentials,
  uint8ToBase64,
  escapeSsml,
} from '../api/_tts.js'
import { EMMA_VOICE_CONFIG } from '../api/_session.js'
import { AUDITION_SOUNDS } from './voiceAuditionVariants.js'
import type { AuditionSound, AuditionVariant } from './voiceAuditionVariants.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CANON_ROOT = join(REPO_ROOT, 'public/canon')
const OUT_PATH = join(REPO_ROOT, 'public/voice-audition-data.json')

const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
const USER_AGENT = 'marian-tutor-audition/1.0 (+marian-learning.vercel.app)'

// ── .env.local loader (mirrors revoiceCanonTargeted.ts) ─────────────────
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

/** Map a sound's canonItemId (`<stem>#<id>`) to its committed canon JSON. */
function canonPathFor(canonItemId: string): { absPath: string; id: string } {
  const [stem, id] = canonItemId.split('#')
  if (!stem || !id) throw new Error(`bad canonItemId: ${canonItemId}`)
  // math files live under math/level-1; word-song under word-song/level-1.
  const mathStems = new Set([
    'number-recog',
    'add-to-10',
    'add-to-20',
    'sub-to-10',
    'sub-to-20',
    'two-digit-addsub',
    'two-digit-addsub-with-regroup',
    'skip-counting',
    'mult-2-5-10',
    'mult-3-4',
    'mult-6-9',
  ])
  const group = mathStems.has(stem) ? 'math' : 'word-song'
  return { absPath: join(CANON_ROOT, group, 'level-1', `${stem}.json`), id }
}

/** Read the live canon text for a sound + assert it matches the spec text. */
function assertCanonText(sound: AuditionSound): void {
  const { absPath, id } = canonPathFor(sound.canonItemId)
  const canon = JSON.parse(readFileSync(absPath, 'utf8')) as {
    utterances: Array<{ id: string; text: string }>
  }
  const u = canon.utterances.find((x) => x.id === id)
  if (!u) {
    throw new Error(
      `canon utterance not found: ${sound.canonItemId} (looked in ${absPath})`,
    )
  }
  if (u.text !== sound.text) {
    throw new Error(
      `TEXT DRIFT for ${sound.canonItemId}:\n  spec : ${JSON.stringify(sound.text)}\n  canon: ${JSON.stringify(u.text)}\n` +
        `The audition must use the live canon text (SSML-only — text changes are out of scope).`,
    )
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

/** Directly POST a hand-built SSML body to Azure (variants 1..N). Mirrors
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

interface VariantRecord {
  id: string
  label: string
  mechanism: string
  /** The full SSML body sent to Azure (for the inventory table). */
  ssml: string
  /** SHA-256 of the rendered MP3 bytes, or null if render failed. */
  audioHash: string | null
  /** base64 MP3, or null if render failed. */
  base64: string | null
  mime: string
  /** Azure rejection message, if the SSML shape failed to render. */
  error?: string
}

interface SoundRecord {
  key: string
  title: string
  canonItemId: string
  text: string
  context: string
  variants: VariantRecord[]
}

async function renderVariant(
  sound: AuditionSound,
  variant: AuditionVariant,
  dry: boolean,
): Promise<VariantRecord> {
  const inner = variant.buildInner(sound.text)
  const isBaseline = inner === null

  // Build the SSML body we'll record in the inventory. For the baseline we
  // render through the production synthesizeUtterance (which builds its own
  // body via renderSsmlInnerText); we reconstruct its body for display by
  // calling the same path. For variants we build it ourselves.
  let body: string
  if (isBaseline) {
    // Production path builds the body internally; mirror the shell for display
    // but mark it as production-derived. The actual bytes come from
    // synthesizeUtterance below — its renderSsmlInnerText output is what plays.
    body = `[production renderSsmlInnerText for ${JSON.stringify(sound.text)} @ tier=${sound.tierFilter ?? 'none'}]`
  } else {
    body = buildSpeakBody(inner)
  }

  if (dry) {
    return {
      id: variant.id,
      label: variant.label,
      mechanism: variant.mechanism,
      ssml: body,
      audioHash: null,
      base64: null,
      mime: 'audio/mpeg',
    }
  }

  try {
    let bytes: Uint8Array
    if (isBaseline) {
      const result = await synthesizeUtterance({
        text: sound.text,
        voice: EMMA_VOICE_CONFIG.voice,
        rate: EMMA_VOICE_CONFIG.rate,
        pitch: EMMA_VOICE_CONFIG.pitch,
        volume: EMMA_VOICE_CONFIG.volume,
        tier: sound.tierFilter,
      })
      bytes = result.audio
    } else {
      bytes = await renderRawSsml(body)
    }
    const base64 = uint8ToBase64(bytes)
    const audioHash = createHash('sha256').update(base64).digest('hex')
    return {
      id: variant.id,
      label: variant.label,
      mechanism: variant.mechanism,
      ssml: body,
      audioHash,
      base64,
      mime: 'audio/mpeg',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      id: variant.id,
      label: variant.label,
      mechanism: variant.mechanism,
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

  // Validate every sound's text against the live canon BEFORE any render.
  for (const sound of AUDITION_SOUNDS) assertCanonText(sound)

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

  const sounds: SoundRecord[] = []
  for (const sound of AUDITION_SOUNDS) {
    process.stdout.write(
      `\n${sound.title} (${sound.variants.length} variants)\n`,
    )
    const variants: VariantRecord[] = []
    for (const variant of sound.variants) {
      process.stdout.write(`  ${variant.id} ${variant.label} ... `)
      const rec = await renderVariant(sound, variant, dry)
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
      variants.push(rec)
    }
    sounds.push({
      key: sound.key,
      title: sound.title,
      canonItemId: sound.canonItemId,
      text: sound.text,
      context: sound.context,
      variants,
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
    note: 'NOT PRODUCTION. Audition-only variant renders for ticket 86ca7yh5k. Winning treatment lands in renderSsmlInnerText via a separate follow-up PR.',
    sounds,
  }
  writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2), 'utf8')

  const total = sounds.reduce((n, s) => n + s.variants.length, 0)
  const failed = sounds.reduce(
    (n, s) => n + s.variants.filter((v) => v.error).length,
    0,
  )
  console.log(
    `\nWrote ${OUT_PATH}\n  ${sounds.length} sounds, ${total} variants` +
      (failed
        ? `, ${failed} Azure-rejected (recorded with error, no audio)`
        : ''),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
