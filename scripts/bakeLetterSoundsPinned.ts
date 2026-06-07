/**
 * Deterministic bake for the letter-sounds tier (Dave master spec).
 *
 * Why a dedicated script (not the stochastic Haiku path in
 * generateSessionCanon.ts):
 *   - The SHIPPED /ɒ/ session is PINNED to an exact 8-tuple
 *     (m, s, l, a, b, o, n, o) per Dave master spec Part A. Pinning
 *     removes the stochastic re-roll churn that fought every prior
 *     letter-sounds bake AND guarantees the exact composition Thomas
 *     auditions ships verbatim.
 *   - The AUDITION canon (`letter-sounds-audit.json`) is an
 *     audition-only throwaway (NOT a real Marian session) with ONE
 *     problem per phoneme class so Thomas hears EVERY class in one pass.
 *
 * Both plans are built here with the EXACT class-dependent per-slot
 * templates from `api/_planner.ts` (read terminal, hint framing, the
 * "Yes. <L>. <mnem>." correct shape, the "This one is <L>. <mnem>."
 * giveAnswer shape) and rendered through the SAME `renderSessionAudio`
 * the production handler uses — with `tierFilter: 'letter-sounds'` so
 * the render path injects the 300ms break + tier-scoped <phoneme> wrap
 * and SKIPS the question-prosody wrapper. Voice is whatever
 * EMMA_VOICE_CONFIG declares (en-GB-OliviaNeural).
 *
 * Run: `npx tsx scripts/bakeLetterSoundsPinned.ts`
 * Reads `.env.local` for AZURE_SPEECH_KEY / AZURE_SPEECH_REGION.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSessionAudio } from '../api/_session.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── .env.local loader (KEY=VALUE; mirrors generateSessionCanon.ts) ──────
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
    // Strip surrounding quotes (mirrors generateSessionCanon.ts loader).
    // Without this, AZURE_SPEECH_REGION="westeurope" yields the literal
    // host `"westeurope".tts...` → DNS ENOTFOUND → every TTS fetch fails.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

// ── Per-sound class config (mirror of api/_planner.ts SOUND-CLASS table) ─
// readTerm: '.' = declarative; '?' = question.
// hintKind:    'fric'   → "It says <mnem>?" ; 'plain' → "Listen. <mnem>."
// correctKind: 'saysIt' → fricative flowing lead-in (S/F/H/V):
//                correct    "Yes. <L> says it. <mnem>?"
//                giveAnswer "This one is <L>. <L> says it. <mnem>?"
//              'plain'  → everyone else (round-1 approved):
//                correct    "Yes. <L>. <mnem>."
//                giveAnswer "This one is <L>. <mnem>."
//
// Round-2 read terminals (Dave straggler spec): voiced stops B/D/G and
// /p/ flip to declarative "." (their schwa-tail makes them vowel-final
// → want declarative); /t/ and /k/ KEEP the question read (k read is
// GREEN, t is round-1 approved). V flips to "?" (round-2). S/F/H stay
// "?". Nasals/liquids/vowels stay ".".
interface SoundSpec {
  letter: string // UPPERCASE letter name
  mnemonic: string
  readTerm: '.' | '?'
  hintKind: 'fric' | 'plain'
  correctKind: 'saysIt' | 'plain'
}

const SOUND: Record<string, SoundSpec> = {
  // Nasals (declarative read, plain hint+correct) — FROZEN.
  m: { letter: 'M', mnemonic: 'mmm', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  n: { letter: 'N', mnemonic: 'nnn', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  // Liquids — L FROZEN; R read+hint approved.
  l: { letter: 'L', mnemonic: 'lll', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  r: { letter: 'R', mnemonic: 'rrr', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  // Voiced fricative V — round-2: read "?", fricative hint + saysIt
  // correct/give. ph="və".
  v: { letter: 'V', mnemonic: 'vvv', readTerm: '?', hintKind: 'fric', correctKind: 'saysIt' }, // prettier-ignore
  // Voiceless fricatives S/F/H — read+hint approved; round-2 saysIt
  // correct/give (fixes cold-onset sink/drumbeat).
  s: { letter: 'S', mnemonic: 'sss', readTerm: '?', hintKind: 'fric', correctKind: 'saysIt' }, // prettier-ignore
  f: { letter: 'F', mnemonic: 'fff', readTerm: '?', hintKind: 'fric', correctKind: 'saysIt' }, // prettier-ignore
  h: { letter: 'H', mnemonic: 'hhh', readTerm: '?', hintKind: 'fric', correctKind: 'saysIt' }, // prettier-ignore
  // Voiced stops B/D/G — round-2: read flips to declarative ".".
  // hint/correct/give UNCHANGED (approved). ph bə/də/ɡə (round-1 green).
  b: { letter: 'B', mnemonic: 'buh', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  d: { letter: 'D', mnemonic: 'duh', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  g: { letter: 'G', mnemonic: 'guh', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  // P — round-2: all slots schwa (pə) + read declarative ".".
  p: { letter: 'P', mnemonic: 'puh', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  // T — FROZEN (read "?" approved). K — read "?" GREEN (kept); ph kə
  // applies to all K slots incl read (re-audition flag).
  t: { letter: 'T', mnemonic: 'tuh', readTerm: '?', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  k: { letter: 'K', mnemonic: 'kuh', readTerm: '?', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  // Vowels — TRIPLET mnemonics. A/O FROZEN; u/i/e re-pointed ph only.
  a: { letter: 'A', mnemonic: 'aaa', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  o: { letter: 'O', mnemonic: 'ooo', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  u: { letter: 'U', mnemonic: 'uuu', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  i: { letter: 'I', mnemonic: 'iii', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
  e: { letter: 'E', mnemonic: 'eee', readTerm: '.', hintKind: 'plain', correctKind: 'plain' }, // prettier-ignore
}

interface Utt {
  id: string
  text: string
}

/** Build the 5 per-problem utterances for one sound, per the
 *  class-dependent templates in api/_planner.ts. */
function problemUtterances(n: number, key: string): Utt[] {
  const s = SOUND[key]
  if (!s) throw new Error(`unknown sound key "${key}"`)
  const read = `Which letter says ${s.mnemonic}${s.readTerm}`
  const hint =
    s.hintKind === 'fric' ? `It says ${s.mnemonic}?` : `Listen. ${s.mnemonic}.`
  const correct =
    s.correctKind === 'saysIt'
      ? `Yes. ${s.letter} says it. ${s.mnemonic}?`
      : `Yes. ${s.letter}. ${s.mnemonic}.`
  const giveAnswer =
    s.correctKind === 'saysIt'
      ? `This one is ${s.letter}. ${s.letter} says it. ${s.mnemonic}?`
      : `This one is ${s.letter}. ${s.mnemonic}.`
  return [
    { id: `word.p${n}.read`, text: read },
    { id: `word.p${n}.correct`, text: correct },
    { id: `word.p${n}.reprompt`, text: 'Hmm... try again?' },
    { id: `word.p${n}.hint`, text: hint },
    { id: `word.p${n}.giveAnswer`, text: giveAnswer },
  ]
}

/** Lift the 19 session-end utterances from an existing canon plan so the
 *  shipped session keeps the standard SessionEnd script (re-rendered on
 *  Olivia by this bake). */
function sessionEndUtterances(): Utt[] {
  const existing = JSON.parse(
    readFileSync(
      join(REPO_ROOT, 'public/canon/word-song/level-1/letter-sounds.json'),
      'utf8',
    ),
  ) as { plan: { utterances: Utt[] } }
  return existing.plan.utterances
    .filter((u) => !/^word\.p\d+\./.test(u.id))
    .map((u) => ({ id: u.id, text: u.text }))
}

async function bake(
  outRelPath: string,
  planId: string,
  planLabel: string,
  problemUtts: Utt[],
  includeSessionEnd: boolean,
): Promise<{ path: string; bytes: number; problems: number }> {
  const utterances = includeSessionEnd
    ? [...problemUtts, ...sessionEndUtterances()]
    : [...problemUtts]
  const plan = { id: planId, label: planLabel, utterances }
  // tierFilter drives the letter-sounds render path (300ms break +
  // tier-scoped <phoneme> wrap + question-prosody skip).
  const response = await renderSessionAudio(plan, {
    tierFilter: 'letter-sounds',
  })
  // Pin plan.utterances to the SAME text the render saw (renderSessionAudio
  // echoes plan through verbatim, but be explicit).
  const out = { ...response, plan }
  const json = JSON.stringify(out)
  const path = join(REPO_ROOT, outRelPath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, json, 'utf8')
  return {
    path: outRelPath,
    bytes: Buffer.byteLength(json, 'utf8'),
    problems: problemUtts.length / 5,
  }
}

async function main(): Promise<void> {
  loadEnvLocal()
  if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
    console.error(
      'ERROR: AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set (add to .env.local).',
    )
    process.exit(1)
  }

  // ── SHIPPED /ɒ/ session — PINNED 8-tuple (Dave Part A) ────────────────
  const shippedTuple = ['m', 's', 'l', 'a', 'b', 'o', 'n', 'o']
  const shippedProblems = shippedTuple.flatMap((key, i) =>
    problemUtterances(i + 1, key),
  )
  console.log(
    `Baking SHIPPED letter-sounds (pinned: ${shippedTuple.join(',')})`,
  )
  const shipped = await bake(
    'public/canon/word-song/level-1/letter-sounds.json',
    'letter-sounds-short-o-intro',
    'Letter Sounds: Short O Introduction (Mastered Consonants + /ɒ/ Lift)',
    shippedProblems,
    true,
  )
  console.log(
    `  ok ${shipped.path} (${(shipped.bytes / 1024).toFixed(0)}KB, ${shipped.problems} problems)`,
  )

  // ── AUDIT canon — ONE problem per remaining class (Dave Part B) ───────
  // Audition-only (NOT a real Marian session): every phoneme class so
  // Thomas hears them all. No composition rules apply; i and e can
  // coexist here (no learner).
  const auditTuple = [
    'f',
    'v',
    'h',
    'r',
    'p',
    't',
    'k',
    'd',
    'g',
    'u',
    'i',
    'e',
  ]
  const auditProblems = auditTuple.flatMap((key, i) =>
    problemUtterances(i + 1, key),
  )
  console.log(
    `Baking AUDIT letter-sounds (one-per-class: ${auditTuple.join(',')})`,
  )
  const audit = await bake(
    'public/canon/word-song/level-1/letter-sounds-audit.json',
    'letter-sounds-audit',
    'Letter Sounds AUDIT (one problem per phoneme class — audition only, NOT a Marian session)',
    auditProblems,
    false,
  )
  console.log(
    `  ok ${audit.path} (${(audit.bytes / 1024).toFixed(0)}KB, ${audit.problems} problems)`,
  )

  console.log('\nDone. Voice = whatever EMMA_VOICE_CONFIG declares (Olivia).')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
