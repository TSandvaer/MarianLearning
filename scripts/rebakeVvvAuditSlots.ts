/**
 * Targeted re-bake of the FOUR isolated-/v/ "vvv" audit clips, splicing the new
 * v3 render (labiodental APPROXIMANT `ʋə` + the UNCHANGED round-5 floor prosody
 * pitch -3st / rate -15% / volume -20%) into the existing
 * `letter-sounds-audit.json` WITHOUT churning any other clip's bytes.
 *
 * Round-6 in-frame audition winner (PR #485): the residual /v/ scratch is the
 * FRICATION of the voiced labiodental FRICATIVE /v/; v3 swaps it for the
 * labiodental APPROXIMANT /ʋ/ (`ʋə`) — same place of articulation, no
 * frication. Only the IPA moves `və → ʋə` in api/_tts.ts PHONEME_OVERRIDES.vvv;
 * SCRATCHY_PROSODY_BY_MNEMONIC.vvv is unchanged.
 *
 * Why a targeted splice (not `bakeLetterSoundsPinned.ts`):
 *   - `bakeLetterSoundsPinned.ts` re-bakes BOTH `letter-sounds.json` (the
 *     SHIPPED, Thomas-approved /ɒ/ session) AND `letter-sounds-audit.json`.
 *     Azure renders are NOT byte-deterministic, so a full re-bake would churn
 *     every approved byte in the shipped file and flip them to needs-retest on
 *     the voice-QA page — the exact "splice, don't re-bake" trap documented in
 *     `.claude/docs/planner-and-canon.md`.
 *   - The v3 change (api/_tts.ts PHONEME_OVERRIDES.vvv) ONLY affects clips
 *     whose text contains the `vvv` mnemonic. The only canon carrying `vvv`
 *     mnemonic text is `letter-sounds-audit.json` at
 *     `word.p2.{read,correct,hint,giveAnswer}` (the shipped letter-sounds.json
 *     is the pinned /ɒ/ session — m,s,l,a,b,o,n,o — no /v/).
 *
 * So: render ONLY those 4 /v/ slots through the SAME production path the audit
 * bake uses (`renderSessionAudio` with `tierFilter: 'letter-sounds'`), then
 * replace just those 4 entries' `audio` in the parsed audit canon and
 * re-serialize with the SAME `JSON.stringify` shape `bake()` uses. Every other
 * clip (incl. the shared `word.p2.reprompt` "Hmm... try again?" and the top-
 * level `ok`/`kind`/`plan` keys) is preserved byte-for-byte.
 *
 * Run: `npx tsx scripts/rebakeVvvAuditSlots.ts`
 * Reads `.env.local` for AZURE_SPEECH_KEY / AZURE_SPEECH_REGION.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSessionAudio } from '../api/_session.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIT_PATH = join(
  REPO_ROOT,
  'public/canon/word-song/level-1/letter-sounds-audit.json',
)

// ── .env.local loader (KEY=VALUE; mirrors generateSessionCanon.ts) ──────
// NOTE: .env.local values may be quote-wrapped (AZURE_SPEECH_REGION="westeurope");
// strip the wrapping quotes or every Azure fetch fails as "fetch failed".
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
    if (!(key in process.env)) process.env[key] = value
  }
}

/** The 4 /v/ audit slots to re-render. Texts MUST match the audit canon's
 *  word.p2.* texts exactly (the production /v/ letter-sound problem shape from
 *  bakeLetterSoundsPinned.ts SOUND.v: read "?", fricative hint, saysIt correct/
 *  give). `reprompt` is the shared generic "Hmm... try again?" — NOT /v/-specific,
 *  so it is intentionally absent here and left byte-untouched. */
const VVV_SLOTS: { id: string; text: string }[] = [
  { id: 'word.p2.read', text: 'Which letter says vvv?' },
  { id: 'word.p2.correct', text: 'Yes. V says it. vvv?' },
  { id: 'word.p2.hint', text: 'It says vvv?' },
  { id: 'word.p2.giveAnswer', text: 'This one is V. V says it. vvv?' },
]

interface CanonUtterance {
  id: string
  text: string
  audio: { kind: string; base64: string; mime: string }
}

async function main(): Promise<void> {
  loadEnvLocal()
  if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
    console.error(
      'ERROR: AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set (add to .env.local).',
    )
    process.exit(1)
  }

  const canon = JSON.parse(readFileSync(AUDIT_PATH, 'utf8')) as {
    utterances: CanonUtterance[]
  }

  // Defensive: confirm each target slot exists with the expected text BEFORE
  // we render — a text drift means the audit canon shape changed and the
  // splice would be wrong.
  for (const slot of VVV_SLOTS) {
    const existing = canon.utterances.find((u) => u.id === slot.id)
    if (!existing) {
      throw new Error(`audit canon missing ${slot.id}`)
    }
    if (existing.text !== slot.text) {
      throw new Error(
        `audit canon text drift on ${slot.id}:\n  canon: ${JSON.stringify(existing.text)}\n  expected: ${JSON.stringify(slot.text)}`,
      )
    }
  }

  // Render ONLY the 4 /v/ slots through the production letter-sounds path.
  const plan = {
    id: 'vvv-audit-splice',
    label: 'vvv audit splice',
    utterances: VVV_SLOTS,
  }
  const response = await renderSessionAudio(plan, {
    tierFilter: 'letter-sounds',
  })
  const rendered = new Map(response.utterances.map((u) => [u.id, u])) as Map<
    string,
    CanonUtterance
  >

  for (const slot of VVV_SLOTS) {
    const r = rendered.get(slot.id)
    if (!r || !r.audio || r.audio.kind !== 'inline') {
      throw new Error(`render produced no inline audio for ${slot.id}`)
    }
    const target = canon.utterances.find((u) => u.id === slot.id)!
    target.audio = r.audio
    console.log(
      `  spliced ${slot.id} (${(r.audio.base64.length / 1024).toFixed(1)}KB base64)`,
    )
  }

  // Re-serialize with the SAME minified shape bake() uses.
  writeFileSync(AUDIT_PATH, JSON.stringify(canon), 'utf8')
  console.log(
    `\nDone. Re-baked 4 /v/ audit slots (v3: labiodental approximant ʋə, ` +
      `floor prosody pitch -3st / rate -15% / volume -20%). Every other clip ` +
      `preserved byte-for-byte. Voice = EMMA_VOICE_CONFIG (Olivia).`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
