/**
 * One-off diagnostic render — FINAL letter-sounds on Emma's chosen voice.
 *
 * Decision trail:
 *  - Thomas picked en-GB-OliviaNeural as Emma's voice.
 *  - On Olivia, the IPA stress(ˈ)/length(ː) marks SCRATCH. PLAIN TEXT
 *    fails differently: Olivia reads the literal mnemonic as letter NAMES
 *    / spells them ("s s s s", "l l l", a="ay", o="oh", t="to").
 *  - WINNER (Thomas ear-test): BARE <phoneme alphabet="ipa" ph="X"> with
 *    NO stress, NO length marks. The mark-free phoneme tag is clean AND
 *    the GB lexicon says the sound correctly.
 *  - Reads were "a bit scratchy" with the nested question-prosody wrapper
 *    (<prosody pitch="+8%" rate="-5%">). The declarative hint was perfect.
 *    So: DROP the inner question-prosody on read lines (keep outer -10%
 *    rate, the 300ms break, and the trailing "?" text). Hints stay
 *    declarative.
 *
 * This renders the 7 distinct shipped sounds (M S H A T O L), read + hint,
 * on Olivia at rate -10%, bare-phoneme, no question-prosody on reads.
 *
 * Diagnostic ONLY: NOT part of the canon bake, does NOT touch
 * public/canon/**, does NOT change api/_tts.ts. After Thomas signs off we
 * lock (voice→Olivia, bare-phoneme no-marks rendering, drop question-
 * prosody on reads) and roll across all canon — SEPARATE change.
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

/** Outer envelope only — no nested question-prosody. The voice is
 *  natively GB so xml:lang matches (not a mid-utterance switch). */
function envelope(inner: string): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">` +
    `<voice name="${VOICE}">` +
    `<prosody pitch="${PITCH}" rate="${RATE}" volume="${VOLUME}">` +
    `${inner}` +
    `</prosody></voice></speak>`
  )
}

/** The 7 distinct shipped sounds. `mnemonic` = visible word inside the
 *  phoneme tag; `ipa` = BARE IPA (no ˈ, no ː). */
const SOUNDS: ReadonlyArray<{
  letter: string
  mnemonic: string
  ipa: string
  hint: string
}> = [
  { letter: 'M', mnemonic: 'mmm', ipa: 'm', hint: 'held "mmmm"' },
  { letter: 'S', mnemonic: 'sss', ipa: 's', hint: 'held "ssss"' },
  { letter: 'H', mnemonic: 'hhh', ipa: 'h', hint: 'audible breath "hhh"' },
  { letter: 'A', mnemonic: 'a', ipa: 'æ', hint: 'short a (as in cat)' },
  { letter: 'T', mnemonic: 'tuh', ipa: 't', hint: 'stop /t/ (as in top)' },
  { letter: 'O', mnemonic: 'o', ipa: 'ɒ', hint: 'short o (as in hot)' },
  { letter: 'L', mnemonic: 'lll', ipa: 'l', hint: 'held "llll"' },
]

function phoneme(mnemonic: string, ipa: string): string {
  // BARE phoneme — no stress mark, no length mark.
  return `<phoneme alphabet="ipa" ph="${ipa}">${mnemonic}</phoneme>`
}

/** Read line: outer -10% rate + 300ms break + trailing "?" TEXT, but NO
 *  nested question-prosody wrapper (that made reads scratchy). */
function readInner(mnemonic: string, ipa: string): string {
  return `Which letter says ${BREAK}${phoneme(mnemonic, ipa)}?`
}
/** Hint line: declarative. */
function hintInner(mnemonic: string, ipa: string): string {
  return `Listen. ${BREAK}${phoneme(mnemonic, ipa)}.`
}

async function main(): Promise<void> {
  const { key } = readAzureCredentials()
  const region = process.env.AZURE_SPEECH_REGION!
  console.log(`Voice: ${VOICE} @ ${RATE} — bare-phoneme, no question-prosody`)

  const outDir = join(REPO_ROOT, 'public', 'olivia-final')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const jobs: Array<{ file: string; ssml: string; desc: string }> = []
  for (const s of SOUNDS) {
    jobs.push({
      file: `${s.letter}-read.mp3`,
      ssml: envelope(readInner(s.mnemonic, s.ipa)),
      desc: `${s.letter} read  (bare ph="${s.ipa}", no question-prosody)`,
    })
    jobs.push({
      file: `${s.letter}-hint.mp3`,
      ssml: envelope(hintInner(s.mnemonic, s.ipa)),
      desc: `${s.letter} hint  (bare ph="${s.ipa}")`,
    })
  }

  for (const job of jobs) {
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
