/**
 * /v/ in-FRAME audition render script — letter-sound "vvv" scratch, round-6.
 *
 * ⚠️  NOT PRODUCTION CODE. Audition tooling only.  ⚠️
 * --------------------------------------------------------------------------
 * Renders the candidate /v/ treatments defined in `vFrameAuditionVariants.ts`
 * across the 4 PRODUCTION slots (read / correct / hint / giveAnswer) PLUS the
 * bare isolated "vvv" token, writing a self-contained manifest
 * (`public/v-frame-audition-data.json`) that the standalone
 * `public/v-frame-audition.html` page reads — base64 MP3 + the exact SSML body
 * + a SHA-256 hash per (slot × candidate).
 *
 * THE §4.4.7 REQUIREMENT (audition-frame representativeness):
 * --------------------------------------------------------------------------
 * Every IN-FRAME candidate is rendered through the SAME break / lead-break
 * structure the production `renderLetterSoundsInnerText` injects at bake time:
 *   • a `<break time="300ms"/>` reset break BEFORE the "vvv" markup (every slot),
 *   • the extra `<break time="350ms"/>` after "This one is V." for the
 *     fricative-giveAnswer slot.
 * Only the "vvv"-region markup differs between candidates — the lead/trailing
 * prose, the breaks, and the trailing `?` are byte-identical across v0..v5 for
 * a given slot. So the A/B isolates exactly the /v/ treatment.
 *
 * HOW v0 / v5 vs v1..v4 differ:
 *   • v0 (floor anchor) renders THROUGH the production `synthesizeUtterance`
 *     (which calls renderSsmlInnerText), so it carries the EXACT accepted-floor
 *     bytes. v5 (de-question) also routes through production, but on the slot
 *     text with terminal `?`→`.` — isolating the question-intonation lever.
 *   • v1..v4 build the production FRAME by hand (mirroring
 *     renderLetterSoundsInnerText) and substitute only the "vvv" markup, so
 *     they can explore /v/ treatments BEYOND the production floor while keeping
 *     the frame byte-faithful.
 *   • For the ISOLATED slot, every candidate is the bare token (no frame, no
 *     break, no `?`): v0/v5 = the production floor `və`+prosody on a lone
 *     "vvv"; v1..v4 = their markup alone.
 *
 * All candidates use the SAME voice config (EMMA_VOICE_CONFIG,
 * en-GB-OliviaNeural, rate -10% / pitch +0Hz / volume +0%), the SAME Azure
 * endpoint, headers, and output format.
 *
 * Run:
 *   npx tsx scripts/renderVFrameAudition.ts          # render all, write manifest
 *   npx tsx scripts/renderVFrameAudition.ts --dry    # print the SSML plan only
 *
 * Reads `.env.local` for AZURE_SPEECH_KEY / AZURE_SPEECH_REGION (the loader
 * below strips surrounding quotes — `.env.local` values are quote-wrapped).
 *
 * If Azure REJECTS a candidate's SSML shape, it is recorded in the manifest
 * with `error: <message>` and NO audio — the page shows it as un-renderable.
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
import {
  V_CANDIDATES,
  V_SLOTS,
  buildInFrameInner,
  deQuestionText,
} from './vFrameAuditionVariants.js'
import type { VCandidate, VSlot } from './vFrameAuditionVariants.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CANON_ROOT = join(REPO_ROOT, 'public/canon')
const OUT_PATH = join(REPO_ROOT, 'public/v-frame-audition-data.json')
const LETTER_SOUNDS_TIER = 'letter-sounds'

const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
const USER_AGENT =
  'marian-tutor-vframe-audition/1.0 (+marian-learning.vercel.app)'

// ── .env.local loader (mirrors renderVoiceAudition.ts) ───────────────────
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

/** Assert the 4 in-frame slot texts match the live letter-sounds-audit canon
 *  so a canon-text drift fails loudly rather than auditioning stale text.
 *  The isolated slot is bare and has no canon row to check. */
function assertCanonTexts(): void {
  const absPath = join(
    CANON_ROOT,
    'word-song',
    'level-1',
    'letter-sounds-audit.json',
  )
  const canon = JSON.parse(readFileSync(absPath, 'utf8')) as {
    utterances: Array<{ id: string; text: string }>
  }
  for (const slot of V_SLOTS) {
    if (slot.isolated) continue
    const [, id] = slot.canonItemId.split('#')
    const u = canon.utterances.find((x) => x.id === id)
    if (!u) {
      throw new Error(
        `canon utterance not found: ${slot.canonItemId} (looked in ${absPath})`,
      )
    }
    if (u.text !== slot.text) {
      throw new Error(
        `TEXT DRIFT for ${slot.canonItemId}:\n  spec : ${JSON.stringify(slot.text)}\n  canon: ${JSON.stringify(u.text)}\n` +
          `The audition must use the live canon text (SSML-only — text changes are out of scope).`,
      )
    }
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

interface CandidateRecord {
  id: string
  label: string
  mechanism: string
  /** The full SSML body sent to Azure (for the inventory table). For the
   *  production-path candidates (v0/v5) this is a descriptive marker — the
   *  bytes come from synthesizeUtterance's own renderSsmlInnerText output. */
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

interface SlotRecord {
  key: string
  title: string
  canonItemId: string
  text: string
  isolated: boolean
  context: string
  candidates: CandidateRecord[]
}

/** Directly POST a hand-built SSML body to Azure (the in-frame v1..v4 path).
 *  Mirrors synthesizeUtterance's request shape exactly so the only difference
 *  vs the production path is the inner-text SSML. */
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

/**
 * Plan a candidate × slot render. Returns the SSML body to display AND a
 * `render` thunk that produces the MP3 bytes. The thunk encapsulates the
 * production-path vs hand-built distinction:
 *   • production path (v0, v5): synthesizeUtterance on the (de-questioned, for
 *     v5) slot text @ tier=letter-sounds — exact production bytes.
 *   • hand-built path (v1..v4): renderRawSsml on the in-frame (or isolated)
 *     body with the candidate's /v/ markup substituted.
 */
function planRender(
  slot: VSlot,
  candidate: VCandidate,
): { ssml: string; render: () => Promise<Uint8Array> } {
  const isProductionPath = candidate.buildVvvMarkup === null

  if (isProductionPath) {
    // v0 / v5 — route through the production synthesizeUtterance path.
    const text = candidate.deQuestion ? deQuestionText(slot.text) : slot.text
    // For the isolated slot, the production path on a bare "vvv" still applies
    // the letter-sounds tier scratchy-soften (vvv is in SCRATCHY_MNEMONICS),
    // so it carries the floor `və`+prosody — the right isolated anchor.
    const tier = LETTER_SOUNDS_TIER
    const marker = `[production renderSsmlInnerText for ${JSON.stringify(text)} @ tier=${tier}]`
    return {
      ssml: marker,
      render: async () => {
        const result = await synthesizeUtterance({
          text,
          voice: EMMA_VOICE_CONFIG.voice,
          rate: EMMA_VOICE_CONFIG.rate,
          pitch: EMMA_VOICE_CONFIG.pitch,
          volume: EMMA_VOICE_CONFIG.volume,
          tier,
        })
        return result.audio
      },
    }
  }

  // v1..v4 — hand-built. The /v/ markup substitutes the bare "vvv" token.
  const vvvMarkup = candidate.buildVvvMarkup!()
  const inner = slot.isolated
    ? vvvMarkup // bare token, NO frame / break / ?
    : buildInFrameInner(slot.text, vvvMarkup)
  const body = buildSpeakBody(inner)
  return { ssml: body, render: () => renderRawSsml(body) }
}

async function renderCandidate(
  slot: VSlot,
  candidate: VCandidate,
  dry: boolean,
): Promise<CandidateRecord> {
  const { ssml, render } = planRender(slot, candidate)

  if (dry) {
    return {
      id: candidate.id,
      label: candidate.label,
      mechanism: candidate.mechanism,
      ssml,
      audioHash: null,
      base64: null,
      mime: 'audio/mpeg',
    }
  }

  try {
    const bytes = await render()
    const base64 = uint8ToBase64(bytes)
    const audioHash = createHash('sha256').update(base64).digest('hex')
    return {
      id: candidate.id,
      label: candidate.label,
      mechanism: candidate.mechanism,
      ssml,
      audioHash,
      base64,
      mime: 'audio/mpeg',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      id: candidate.id,
      label: candidate.label,
      mechanism: candidate.mechanism,
      ssml,
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

  // Validate the 4 in-frame slot texts against the live canon BEFORE rendering.
  assertCanonTexts()

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

  const slots: SlotRecord[] = []
  for (const slot of V_SLOTS) {
    process.stdout.write(
      `\n${slot.title} (${V_CANDIDATES.length} candidates)\n`,
    )
    const candidates: CandidateRecord[] = []
    for (const candidate of V_CANDIDATES) {
      process.stdout.write(`  ${candidate.id} ${candidate.label} ... `)
      const rec = await renderCandidate(slot, candidate, dry)
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
    slots.push({
      key: slot.key,
      title: slot.title,
      canonItemId: slot.canonItemId,
      text: slot.text,
      isolated: slot.isolated,
      context: slot.context,
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
    note: 'NOT PRODUCTION. /v/ in-FRAME audition (letter-sound "vvv" scratch, round-6). Every candidate rendered in the 4 production slots + isolated, per testing-and-ci.md §4.4.7. The winning treatment (if any beats the floor in-frame) lands in renderSsmlInnerText + re-baked in a separate follow-up PR.',
    slots,
  }
  writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2), 'utf8')

  const total = slots.reduce((n, s) => n + s.candidates.length, 0)
  const failed = slots.reduce(
    (n, s) => n + s.candidates.filter((c) => c.error).length,
    0,
  )
  console.log(
    `\nWrote ${OUT_PATH}\n  ${slots.length} slots, ${total} candidates` +
      (failed
        ? `, ${failed} Azure-rejected (recorded with error, no audio)`
        : ''),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
