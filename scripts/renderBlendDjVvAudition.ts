/**
 * /dʒ/-recovery + isolated-/v/ audition render script.
 *
 * ⚠️  NOT PRODUCTION CODE. Audition tooling only.  ⚠️
 * --------------------------------------------------------------------------
 * Renders the candidate SSML treatments defined in
 * `blendDjVvAuditionVariants.ts` for:
 *   • DELIVERABLE 1 — the 3 /dʒ/ blend words (jam / jet / jug) × 7 candidates
 *     (j0 baseline floor → j6 split-slowed). The /dʒ/ words are auditioned as
 *     FULL segmented blend renders ("j - a - m ... jam"); the baseline (j0)
 *     is the current whole-word FLOOR shape.
 *   • DELIVERABLE 2 — the 4 isolated-/v/ letter-sounds slots × 5 candidates
 *     (vv0 baseline = current production render → vv4 pass-7 held + pitch).
 *
 * Writes a self-contained manifest (`public/blend-dj-vv-audition-data.json`)
 * that the standalone `public/blend-dj-vv-audition.html` page reads — base64
 * MP3 + the exact SSML body + a SHA-256 hash per (item × candidate). The page
 * is region-independent (base64-embedded clips) — same pattern as #470/#472.
 *
 * Every candidate is a HAND-BUILT inner-SSML POSTed directly to Azure, mirroring
 * synthesizeUtterance's request shape so the only difference vs the production
 * path is the inner-text SSML. The j0 /dʒ/ baseline mirrors
 * renderBlendFloorInnerText byte-for-byte; the vv0 /v/ baseline mirrors the
 * production renderLetterSoundsInnerText softenScratchy vvv path byte-for-byte.
 *
 * All candidates use the SAME voice config (EMMA_VOICE_CONFIG,
 * en-GB-OliviaNeural, rate -10% / pitch +0Hz / volume +0%), the SAME Azure
 * endpoint, headers, and output format — so each is auditioned in the identical
 * acoustic frame the app uses; only the inner-text SSML differs.
 *
 * Run:
 *   npx tsx scripts/renderBlendDjVvAudition.ts          # render all, write manifest
 *   npx tsx scripts/renderBlendDjVvAudition.ts --dry    # print the SSML plan only
 *
 * Reads `.env.local` for AZURE_SPEECH_KEY / AZURE_SPEECH_REGION (the loader
 * below strips surrounding quotes, per planner-and-canon §"splice, don't
 * re-bake": .env.local values are quote-wrapped, and a standalone bake that
 * doesn't strip them fails every Azure fetch as "fetch failed").
 *
 * If Azure REJECTS a candidate's SSML shape (e.g. a nested-prosody onset on a
 * rejecting resource), it is recorded with `error: <message>` and NO audio —
 * the page shows it as un-renderable. (The bake-resource local creds accept
 * the nested onset; the production runtime resource 400s it — see pass-5/7.)
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
import {
  DJ_CANDIDATES,
  DJ_WORDS,
  buildDjInner,
  buildDjFloorInner,
  VVV_CANDIDATES,
  VVV_SLOTS,
  buildVvvInner,
} from './blendDjVvAuditionVariants.js'
import type {
  DjCandidate,
  DjWord,
  VvvCandidate,
  VvvSlot,
} from './blendDjVvAuditionVariants.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_PATH = join(REPO_ROOT, 'public/blend-dj-vv-audition-data.json')
const CANON_PATH = join(
  REPO_ROOT,
  'public/canon/word-song/level-1/letter-sounds-audit.json',
)

const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
const USER_AGENT =
  'marian-tutor-dj-vv-audition/1.0 (+marian-learning.vercel.app)'

// ── .env.local loader (mirrors renderBlendAudition.ts) ───────────────────
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

/** Assert the /v/ slot texts match the committed canon so a drift fails loudly
 *  rather than auditioning stale text. Best-effort: if the canon file or a
 *  slot id is missing, warn but continue (the audition is text-pinned in the
 *  variant module too). */
function assertVvvCanonText(): void {
  if (!existsSync(CANON_PATH)) {
    console.warn(`WARN: ${CANON_PATH} not found — skipping canon text check.`)
    return
  }
  let canon: { utterances?: { id: string; text: string }[] }
  try {
    canon = JSON.parse(readFileSync(CANON_PATH, 'utf8'))
  } catch (err) {
    console.warn(`WARN: could not parse canon: ${String(err)}`)
    return
  }
  const byId = new Map(
    (canon.utterances ?? []).map((u) => [u.id.split('#')[1] ?? u.id, u.text]),
  )
  for (const s of VVV_SLOTS) {
    const want = byId.get(`word.p2.${s.slot}`)
    if (want === undefined) {
      console.warn(`WARN: canon missing word.p2.${s.slot} — using pinned text.`)
      continue
    }
    if (want !== s.text) {
      throw new Error(
        `Canon text drift on word.p2.${s.slot}:\n  canon: ${JSON.stringify(want)}\n  pinned: ${JSON.stringify(s.text)}\n` +
          `Update VVV_SLOTS in blendDjVvAuditionVariants.ts before auditioning.`,
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

/** Directly POST a hand-built SSML body to Azure. */
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
  mechanism: string
  ssml: string
  audioHash: string | null
  base64: string | null
  mime: string
  error?: string
}

interface ItemRecord {
  /** Group slug (the /dʒ/ word or the vvv slot name). */
  key: string
  /** Display title. */
  title: string
  context: string
  /** Provenance (vvv slots only). */
  canonItemId?: string
  candidates: CandidateRecord[]
}

interface GroupRecord {
  /** Section slug. */
  key: string
  title: string
  blurb: string
  items: ItemRecord[]
}

async function renderOne(
  id: string,
  label: string,
  mechanism: string,
  inner: string,
  dry: boolean,
): Promise<CandidateRecord> {
  const body = buildSpeakBody(inner)
  if (dry) {
    return {
      id,
      label,
      mechanism,
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
      id,
      label,
      mechanism,
      ssml: body,
      audioHash,
      base64,
      mime: 'audio/mpeg',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      id,
      label,
      mechanism,
      ssml: body,
      audioHash: null,
      base64: null,
      mime: 'audio/mpeg',
      error: message,
    }
  }
}

async function renderDjWord(word: DjWord, dry: boolean): Promise<ItemRecord> {
  process.stdout.write(
    `\n[dʒ] ${word.word} (${DJ_CANDIDATES.length} candidates)\n`,
  )
  const candidates: CandidateRecord[] = []
  for (const c of DJ_CANDIDATES as DjCandidate[]) {
    process.stdout.write(`  ${c.id} ${c.label} ... `)
    const inner =
      c.buildOnset === null
        ? buildDjFloorInner(word.word)
        : buildDjInner(word.word, c)
    const rec = await renderOne(c.id, c.label, c.mechanism, inner, dry)
    logRec(rec, dry)
    candidates.push(rec)
  }
  return { key: word.word, title: word.word, context: word.context, candidates }
}

async function renderVvvSlot(slot: VvvSlot, dry: boolean): Promise<ItemRecord> {
  process.stdout.write(
    `\n[vvv] ${slot.slot} (${VVV_CANDIDATES.length} candidates)\n`,
  )
  const candidates: CandidateRecord[] = []
  for (const c of VVV_CANDIDATES as VvvCandidate[]) {
    process.stdout.write(`  ${c.id} ${c.label} ... `)
    const inner = buildVvvInner(slot.text, c)
    const rec = await renderOne(c.id, c.label, c.mechanism, inner, dry)
    logRec(rec, dry)
    candidates.push(rec)
  }
  return {
    key: slot.slot,
    title: `vvv — ${slot.slot} ("${slot.text}")`,
    context: slot.context,
    canonItemId: slot.canonItemId,
    candidates,
  }
}

function logRec(rec: CandidateRecord, dry: boolean): void {
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
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry')
  loadEnvLocal()
  assertVvvCanonText()

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

  const djItems: ItemRecord[] = []
  for (const w of DJ_WORDS) djItems.push(await renderDjWord(w, dry))

  const vvvItems: ItemRecord[] = []
  for (const s of VVV_SLOTS) vvvItems.push(await renderVvvSlot(s, dry))

  if (dry) {
    console.log('\n[--dry] No Azure calls made; no manifest written.')
    return
  }

  const groups: GroupRecord[] = [
    {
      key: 'dj',
      title: 'Deliverable 1 — /dʒ/ blend recovery (jam · jet · jug)',
      blurb:
        'The ONLY blend floor left after pass-7. j0 is the current FLOOR (Emma says ' +
        'the whole word, no segmentation) — your A/B anchor. Every other candidate ' +
        'attempts a real j-a-m segmentation with a different /dʒ/ onset lever. ' +
        'j4/j6 use a nested-prosody onset that the production RUNTIME resource 400s ' +
        '(bake-only); if one of those wins it ports as a full-fidelity-only render.',
      items: djItems,
    },
    {
      key: 'vvv',
      title: 'Deliverable 2 — isolated letter-sound /v/ "vvv" cross-benefit',
      blurb:
        'The 4 accepted-model-floor /v/ clips (#446). vv0 is the EXACT current ' +
        'production render — your A/B anchor. vv1–vv4 transplant the pass-7 blend ' +
        '/v/ win (held vːə + schwa-tail length mark @ -25%) onto the ISOLATED ' +
        'mnemonic. Hypothesis: the same lever that recovered van/web/wig may clean ' +
        'up the isolated /v/.',
      items: vvvItems,
    },
  ]

  const manifest = {
    generatedAt: new Date().toISOString(),
    voice: EMMA_VOICE_CONFIG.voice,
    rootProsody: {
      rate: EMMA_VOICE_CONFIG.rate,
      pitch: EMMA_VOICE_CONFIG.pitch,
      volume: EMMA_VOICE_CONFIG.volume,
    },
    note: 'NOT PRODUCTION. /dʒ/-recovery + isolated-/v/ audition. The winning candidate per group is ported into production + re-baked in a separate follow-up PR after Thomas ear-tests.',
    groups,
  }
  writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2), 'utf8')

  const allItems = groups.flatMap((g) => g.items)
  const total = allItems.reduce((n, it) => n + it.candidates.length, 0)
  const failed = allItems.reduce(
    (n, it) => n + it.candidates.filter((c) => c.error).length,
    0,
  )
  console.log(
    `\nWrote ${OUT_PATH}\n  ${groups.length} groups, ${allItems.length} items, ${total} candidates` +
      (failed
        ? `, ${failed} Azure-rejected (recorded with error, no audio)`
        : ''),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
