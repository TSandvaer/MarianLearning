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

/** v1 read line: outer -10% rate + LEADING 300ms break + trailing "?"
 *  TEXT, no nested question-prosody. */
function readInner(mnemonic: string, ipa: string): string {
  return `Which letter says ${BREAK}${phoneme(mnemonic, ipa)}?`
}
/** v1 hint line: declarative, with the LEADING 300ms break. */
function hintInner(mnemonic: string, ipa: string): string {
  return `Listen. ${BREAK}${phoneme(mnemonic, ipa)}.`
}

// ── v2 variants (Thomas A/B round 2) — REJECTED ────────────────────────
// v2 reads (no lead break, trailing 200ms) RAN TOGETHER ("SaysM/SaysA/…")
// — the leading break IS needed. v2 hints (no break) didn't fix the S/H
// onset (the "sink" was the "Listen." lead-in, not the break). v2 is
// abandoned; the 4 read-v2 clips are removed. See v3 below.

// ── v3 variants (Thomas A/B round 3) ───────────────────────────────────
// Refined diagnosis:
//   - The read SCRATCH hits ONLY voiced M/A/O/L; their HINTS (declarative)
//     are perfect. Reads are QUESTIONS → the question-final intonation
//     creaks the voiced held sounds. Voiceless reads (S/H/T) are perfect.
//     v3 read = make the read DECLARATIVE (end "." not "?"), keep the
//     leading 300ms break (v2 proved it's needed), bare phoneme, rate -10%.
//   - S/H reads are perfect; their HINTS have a breath "sink" before the
//     fricative — present in hint v1 AND v2, so it's the "Listen." lead-in,
//     NOT the break. v3 hint = drop "Listen." (standalone phoneme).
// T = perfect both (untouched). M/A/O/L hints perfect (untouched). S/H
// reads perfect (untouched).

/** v3 read: DECLARATIVE — leading 300ms break + bare phoneme + "." (no
 *  "?", no question-prosody). For the voiced sounds M/A/O/L. */
function readInnerV3(mnemonic: string, ipa: string): string {
  return `Which letter says ${BREAK}${phoneme(mnemonic, ipa)}.`
}
/** v3 hint: NO "Listen." lead-in — standalone phoneme as its own
 *  utterance. For the fricatives S/H. */
function hintInnerV3(mnemonic: string, ipa: string): string {
  return `${phoneme(mnemonic, ipa)}.`
}

/** The 6 problem clips that get a v3 variant. */
const V3_CLIPS: ReadonlyArray<{
  letter: string
  slot: 'read' | 'hint'
}> = [
  { letter: 'M', slot: 'read' },
  { letter: 'A', slot: 'read' },
  { letter: 'O', slot: 'read' },
  { letter: 'L', slot: 'read' },
  { letter: 'S', slot: 'hint' },
  { letter: 'H', slot: 'hint' },
]

// ── v4 variant (Thomas A/B round 4) — S/H hint — FAILED ────────────────
// v4 = "It says <phoneme>sss</phoneme>." with NO leading break. The
// utterance-final fricative after "says" got SWALLOWED (rendered as just
// "It says", fricative inaudible). The "says" lead-in alone wasn't enough.
// Removed — superseded by v5/v6 which restore the 300ms break.

// ── v5 / v6 variants (Thomas A/B round 5) — S/H hint ONLY ──────────────
// The PERFECT S/H READ is "Which letter says <break 300ms> sss?" — it
// keeps BOTH the 300ms break AND ends in "?". The break + the question
// terminal are what keep the fricative pronounced as its own audible
// unit. v4 dropped the break and the fricative vanished. v5/v6 restore the
// break after "It says":
//   v5 = break + STATEMENT ("." terminal)
//   v6 = break + QUESTION  ("?" terminal — mirrors the proven-audible read)
// Both: bare phoneme, no question-prosody wrapper. If v5's "." still
// swallows the fricative, v6's "?" is the fallback (matches the read that
// is known-audible).
function hintInnerV5(mnemonic: string, ipa: string): string {
  return `It says ${BREAK}${phoneme(mnemonic, ipa)}.`
}
function hintInnerV6(mnemonic: string, ipa: string): string {
  return `It says ${BREAK}${phoneme(mnemonic, ipa)}?`
}

/** v5 + v6 apply to the S and H HINT only. */
const V56_CLIPS: ReadonlyArray<{ letter: string }> = [
  { letter: 'S' },
  { letter: 'H' },
]

async function main(): Promise<void> {
  const { key } = readAzureCredentials()
  const region = process.env.AZURE_SPEECH_REGION!
  console.log(`Voice: ${VOICE} @ ${RATE} — bare-phoneme, no question-prosody`)

  const outDir = join(REPO_ROOT, 'public', 'olivia-final')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const byLetter = new Map(SOUNDS.map((s) => [s.letter, s]))

  const jobs: Array<{
    file: string
    ssml: string
    desc: string
    skipIfExists: boolean
  }> = []
  // v1 clips — keep byte-identical (already ear-confirmed correct). Skip
  // if already on disk so this re-run only renders the new v2 variants
  // and never re-bills / perturbs the committed v1 clips.
  for (const s of SOUNDS) {
    jobs.push({
      file: `${s.letter}-read.mp3`,
      ssml: envelope(readInner(s.mnemonic, s.ipa)),
      desc: `${s.letter} read v1 (leading break)`,
      skipIfExists: true,
    })
    jobs.push({
      file: `${s.letter}-hint.mp3`,
      ssml: envelope(hintInner(s.mnemonic, s.ipa)),
      desc: `${s.letter} hint v1 (leading break)`,
      skipIfExists: true,
    })
  }
  // v3 clips — keep byte-identical (already on disk + ear-tested). Skip
  // if present so this run only renders the new v4 variants.
  for (const c of V3_CLIPS) {
    const s = byLetter.get(c.letter)
    if (!s) throw new Error(`V3_CLIPS references unknown letter ${c.letter}`)
    const inner =
      c.slot === 'read'
        ? readInnerV3(s.mnemonic, s.ipa)
        : hintInnerV3(s.mnemonic, s.ipa)
    jobs.push({
      file: `${s.letter}-${c.slot}-v3.mp3`,
      ssml: envelope(inner),
      desc:
        c.slot === 'read'
          ? `${s.letter} read v3 (declarative, leading break)`
          : `${s.letter} hint v3 (no "Listen.")`,
      skipIfExists: true,
    })
  }
  // v5 + v6 clips — S/H hint only, always (re)rendered.
  for (const c of V56_CLIPS) {
    const s = byLetter.get(c.letter)
    if (!s) throw new Error(`V56_CLIPS references unknown letter ${c.letter}`)
    jobs.push({
      file: `${s.letter}-hint-v5.mp3`,
      ssml: envelope(hintInnerV5(s.mnemonic, s.ipa)),
      desc: `${s.letter} hint v5 ("It says" + break, statement)`,
      skipIfExists: false,
    })
    jobs.push({
      file: `${s.letter}-hint-v6.mp3`,
      ssml: envelope(hintInnerV6(s.mnemonic, s.ipa)),
      desc: `${s.letter} hint v6 ("It says" + break, question)`,
      skipIfExists: false,
    })
  }

  for (const job of jobs) {
    if (job.skipIfExists && existsSync(join(outDir, job.file))) {
      console.log(`  · skip ${job.file} (exists) — ${job.desc}`)
      continue
    }
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
