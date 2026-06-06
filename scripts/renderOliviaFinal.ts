/**
 * One-off diagnostic render — final letter-sounds on Emma's chosen voice.
 *
 * Thomas picked Voice 4 = en-GB-OliviaNeural as Emma's voice. Diagnosis:
 * on Olivia the IPA <phoneme>+stress(ˈ)/length(ː) markup SCRATCHES on
 * isolated sounds, while plain text + the sample sentence are clean. The
 * phoneme apparatus was compensating for the US voice; on a native GB
 * voice the lexicon says these sounds correctly from plain text.
 *
 * Hypothesis to prove: plain-text mnemonics on Olivia are clean AND
 * correct (a literal "mmm"/"hhh" reads as a held/audible sound). This
 * script renders the 8 shipped letter-sounds (plan
 * "letter-sounds-short-o-intro": M, S, H, A, T, O, L — read + hint) on
 * Olivia at rate -10%, PLAIN TEXT, with the 300ms pre-sound <break>
 * preserved, and NO redundant en-GB lang wrapper (voice is natively GB).
 *
 * Insurance: for the riskiest sounds (H, M, S) we ALSO render a MARK-FREE
 * bare <phoneme ph="..."> variant (no stress, no length) to test whether
 * a mark-free phoneme is clean — in case plain text doesn't hold/isn't
 * audible. Plain text is the lead candidate.
 *
 * Diagnostic ONLY: NOT part of the canon bake, does NOT touch
 * public/canon/**, does NOT change api/_tts.ts. After Thomas ear-confirms,
 * the winning treatment is rolled across all canon on Olivia — SEPARATE.
 *
 * Run from repo root (kevin-wt) with a live Azure subscription:
 *   npx tsx scripts/renderOliviaFinal.ts
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

const VOICE = 'en-GB-OliviaNeural'
const RATE = '-10%'
const PITCH = '+0Hz'
const VOLUME = '+0%'
const BREAK = '<break time="300ms"/>'

/** Envelope WITHOUT the en-GB lang wrapper on the inner text — the voice
 *  is natively GB. `xml:lang` on <speak> is required by Azure but matches
 *  the voice locale (en-GB) so it is not a mid-utterance switch. */
function envelope(inner: string): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">` +
    `<voice name="${VOICE}">` +
    `<prosody pitch="${PITCH}" rate="${RATE}" volume="${VOLUME}">` +
    `${inner}` +
    `</prosody></voice></speak>`
  )
}

/** The 8 shipped problems → 7 distinct sounds (O repeats at P6/P8).
 *  `mnemonic` is the plain-text token spoken. `risky` flags H/M/S, which
 *  also get a mark-free bare-phoneme insurance variant. `bareIpa` is the
 *  mark-free IPA for that insurance variant (no ˈ, no ː). */
interface SoundSpec {
  letter: string
  mnemonic: string
  risky: boolean
  bareIpa?: string
}

const SOUNDS: readonly SoundSpec[] = [
  { letter: 'M', mnemonic: 'mmm', risky: true, bareIpa: 'm' },
  { letter: 'S', mnemonic: 'sss', risky: true, bareIpa: 's' },
  { letter: 'H', mnemonic: 'hhh', risky: true, bareIpa: 'h' },
  { letter: 'A', mnemonic: 'a', risky: false },
  { letter: 'T', mnemonic: 'tuh', risky: false },
  { letter: 'O', mnemonic: 'o', risky: false },
  { letter: 'L', mnemonic: 'lll', risky: false },
]

/** Build the inner fragment for a slot.
 *  - read (plain):  "Which letter says <break>mmm?"
 *  - hint (plain):  "Listen. <break>mmm."
 *  - read/hint (bare-phoneme insurance): same but the mnemonic wrapped in
 *    a MARK-FREE <phoneme ph="m"> (no stress/length). */
function readInner(mnemonic: string, bareIpa?: string): string {
  const token = bareIpa
    ? `<phoneme alphabet="ipa" ph="${bareIpa}">${mnemonic}</phoneme>`
    : mnemonic
  return `Which letter says ${BREAK}${token}?`
}
function hintInner(mnemonic: string, bareIpa?: string): string {
  const token = bareIpa
    ? `<phoneme alphabet="ipa" ph="${bareIpa}">${mnemonic}</phoneme>`
    : mnemonic
  return `Listen. ${BREAK}${token}.`
}

interface Job {
  file: string
  ssml: string
  desc: string
}

function buildJobs(): Job[] {
  const jobs: Job[] = []
  for (const s of SOUNDS) {
    // Lead candidate: PLAIN TEXT.
    jobs.push({
      file: `${s.letter}-read-plain.mp3`,
      ssml: envelope(readInner(s.mnemonic)),
      desc: `${s.letter} read  (plain "${s.mnemonic}")`,
    })
    jobs.push({
      file: `${s.letter}-hint-plain.mp3`,
      ssml: envelope(hintInner(s.mnemonic)),
      desc: `${s.letter} hint  (plain "${s.mnemonic}")`,
    })
    // Insurance: mark-free bare <phoneme> for the risky sounds only.
    if (s.risky && s.bareIpa) {
      jobs.push({
        file: `${s.letter}-read-bare.mp3`,
        ssml: envelope(readInner(s.mnemonic, s.bareIpa)),
        desc: `${s.letter} read  (mark-free <phoneme ph="${s.bareIpa}">)`,
      })
      jobs.push({
        file: `${s.letter}-hint-bare.mp3`,
        ssml: envelope(hintInner(s.mnemonic, s.bareIpa)),
        desc: `${s.letter} hint  (mark-free <phoneme ph="${s.bareIpa}">)`,
      })
    }
  }
  return jobs
}

async function main(): Promise<void> {
  const { key } = readAzureCredentials()
  const region = process.env.AZURE_SPEECH_REGION!
  console.log(`Voice: ${VOICE} @ ${RATE} — region ${region}`)

  const outDir = join(REPO_ROOT, 'public', 'olivia-final')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  for (const job of buildJobs()) {
    try {
      const res = await fetch(buildAzureEndpoint(region), {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml; charset=utf-8',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'marian-tutor/1.0 (+marian-learning.vercel.app)',
        },
        body: job.ssml,
      })
      if (!res.ok) {
        const hint = (await res.text()).slice(0, 200)
        throw new Error(`Azure ${res.status}: ${hint}`)
      }
      const buf = new Uint8Array(await res.arrayBuffer())
      if (buf.length < 200) {
        throw new Error(`tiny render (${buf.length} bytes) — likely SSML junk`)
      }
      writeFileSync(join(outDir, job.file), buf)
      console.log(`  ✓ ${job.file} (${buf.length} bytes) — ${job.desc}`)
    } catch (err) {
      console.error(
        `  ✗ ${job.file} FAILED: ${err instanceof Error ? err.message : String(err)}`,
      )
      process.exitCode = 1
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
