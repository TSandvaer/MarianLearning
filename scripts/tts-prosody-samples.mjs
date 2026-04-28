#!/usr/bin/env node
/**
 * Phase 2 of audit ticket 86c9hjnq1 — generate alternative SSML/voice
 * samples for the trailing-interrogative-prosody A/B test.
 *
 * BACKGROUND
 * ----------
 * PR #82 introduced `<break time="250ms"/><prosody pitch="+8%" rate="-5%">`
 * around the trailing interrogative clause. Thomas reports the AnaNeural
 * output STILL sounds metallic/robotic on questions like "How many?"
 * after a numeric clause.
 *
 * Phase 1 (a throwaway local SSML dump, not committed) confirmed the
 * server emits exactly the SSML the test suite asserts. So the
 * diagnosis is "AnaNeural's prosody engine doesn't honour
 * <break>+<prosody> well on this pattern" — not a server bug.
 *
 * This script generates ALTERNATIVE renders so Thomas can A/B them on
 * iPad and pick the winner. The winner becomes the production SSML
 * strategy in a follow-up PR.
 *
 * USAGE
 * -----
 *   1. Ensure `.env.local` (in the repo root) carries:
 *        AZURE_SPEECH_KEY=<your key>
 *        AZURE_SPEECH_REGION=westeurope
 *      OR export the same vars into your shell environment.
 *   2. From the repo root: `node scripts/tts-prosody-samples.mjs`.
 *   3. MP3s land in `public/audio-samples/` — one per strategy, plus a
 *      `manifest.json`. The static `index.html` harness (already
 *      committed at `public/audio-samples/index.html`) reads the
 *      manifest at runtime; this script does NOT regenerate the HTML.
 *
 * Why public/ and not qa/
 * -----------------------
 * Vite copies `public/` verbatim into `dist/` on `vite build`, which
 * means a Vercel preview deploys these MP3s to
 * `https://<branch>.vercel.app/audio-samples/`. Thomas can A/B on his
 * iPad without sideloading. The same files also work over `file://`
 * locally (the harness does a relative `fetch('manifest.json')`).
 * `qa/` would have required a separate copy step.
 *
 * The script is dev-only — never imported by the runtime. ESM `.mjs`
 * extension keeps it out of `tsc -b` / `vite build`. The Azure call
 * shape is a verbatim copy of `synthesizeUtterance` from `api/_tts.ts`;
 * we can't import the .ts source without the project's compile pipeline.
 *
 * COST DISCIPLINE
 * ---------------
 * Azure F0 free tier is 20 tx/s and 500K chars/month. This script makes
 * one call per strategy (currently 9), each ~50-100 chars of synth text
 * — well inside both ceilings. We sleep 150ms between calls so we never
 * burst over 20/s even on a fast machine.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const OUT_DIR = join(REPO_ROOT, 'public', 'audio-samples')

// ── Env loading ─────────────────────────────────────────────────────────
// Minimal .env.local parser — no dotenv dep needed. Skips comments,
// trims, supports KEY=VALUE only. If the var is already set in the
// process env, that wins (so CI / shell exports take precedence).

function loadDotEnvLocal() {
  const path = join(REPO_ROOT, '.env.local')
  if (!existsSync(path)) return
  const txt = readFileSync(path, 'utf8')
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadDotEnvLocal()

const DRY_RUN = process.argv.includes('--dry-run')
const AZURE_KEY = process.env.AZURE_SPEECH_KEY
const AZURE_REGION = process.env.AZURE_SPEECH_REGION || 'westeurope'

if (!AZURE_KEY && !DRY_RUN) {
  console.error(
    '\nERROR: AZURE_SPEECH_KEY is not set.\n' +
      'Either:\n' +
      '  - Create .env.local in the repo root with AZURE_SPEECH_KEY=...\n' +
      '  - OR run `npx vercel env pull --environment development .env.local`\n' +
      '  - OR export AZURE_SPEECH_KEY=... before running this script.\n' +
      '  - Pass --dry-run to inspect SSML bodies without calling Azure.\n',
  )
  process.exit(1)
}

// ── SSML helpers (verbatim from api/_tts.ts) ────────────────────────────

function escapeSsml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ── Strategy registry ───────────────────────────────────────────────────
//
// Each strategy is `{ id, label, voice, buildSsml(text) }`. `buildSsml`
// returns the ENTIRE SSML body (incl. <speak><voice><prosody>), giving
// each strategy full control over the wrapping shape — some need
// `xmlns:mstts` declared, some don't.
//
// `id` is the filename slug. `label` is what the HTML harness shows
// under the play button.

// Source utterance — same across every strategy so Thomas A/Bs prosody,
// not text content. "Two plus two. How many?" matches Thomas's iPad
// capture (sums-to-10 plan C, problem 1) and exercises the same
// trailing-clause-after-numeric-clause pattern the hint utterance has.
const SAMPLE_TEXT = 'Two plus two. How many?'

/** Outer prosody (the production wrapper around the whole utterance) is
 *  always the same: -10% rate, +0Hz pitch, +0% volume — what Greet uses. */
const OUTER = 'pitch="+0Hz" rate="-10%" volume="+0%"'

/** Wrap a question clause in the production strategy A. */
function strategyAWrap(clause) {
  return `<break time="250ms"/><prosody pitch="+8%" rate="-5%">${escapeSsml(clause)}</prosody>`
}

/** Wrap a question clause in mstts:express-as. The xmlns:mstts attribute
 *  must be declared on <speak>; we keep that consistent across all
 *  strategies that use it. */
function expressAsWrap(clause, style) {
  return `<mstts:express-as style="${style}"><break time="200ms"/>${escapeSsml(clause)}</mstts:express-as>`
}

/** Wrap each word in <say-as interpret-as="characters"> — last-resort
 *  hack for breaking the prosody predictor. */
function sayAsCharactersWrap(clause) {
  // Split on whitespace, wrap each word; preserve final ? outside the
  // last wrap so it still parses as a question terminator at the SSML
  // level. (Not that it'll matter at this point — the engine is being
  // forced into letter-by-letter mode.)
  const noTerminal = clause.replace(/[?!.]+\s*$/, '')
  const terminal = clause.slice(noTerminal.length)
  const wrapped = noTerminal
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `<say-as interpret-as="characters">${escapeSsml(w)}</say-as>`)
    .join(' ')
  return `${wrapped}${escapeSsml(terminal)}`
}

/** Find trailing-clause boundary the same way renderSsmlInnerText does. */
function splitTrailingClause(text) {
  const trimmed = text.replace(/\s+$/, '')
  if (!trimmed.endsWith('?')) return { lead: text, clause: '' }
  const boundary = /[.!?]\s+/g
  let lastEnd = -1
  let m
  while ((m = boundary.exec(trimmed)) !== null) {
    if (m.index + m[0].length >= trimmed.length) break
    lastEnd = m.index + m[0].length
  }
  if (lastEnd === -1) return { lead: '', clause: trimmed }
  return { lead: trimmed.slice(0, lastEnd), clause: trimmed.slice(lastEnd) }
}

const speakOpen = (withMstts) =>
  `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"` +
  (withMstts ? ' xmlns:mstts="http://www.w3.org/2001/mstts"' : '') +
  ` xml:lang="en-US">`

const STRATEGIES = [
  // ── A. Current production (baseline) ─────────────────────────────────
  {
    id: 'A-baseline-break-prosody',
    label:
      'A — Production baseline: <break time="250ms"/><prosody pitch="+8%" rate="-5%">…</prosody>',
    voice: 'en-US-AnaNeural',
    text: SAMPLE_TEXT,
    buildSsml(text) {
      const { lead, clause } = splitTrailingClause(text)
      return (
        speakOpen(false) +
        `<voice name="en-US-AnaNeural">` +
        `<prosody ${OUTER}>` +
        `${escapeSsml(lead)}${strategyAWrap(clause)}` +
        `</prosody></voice></speak>`
      )
    },
  },

  // ── B1. mstts:express-as style="chat" ────────────────────────────────
  {
    id: 'B1-express-as-chat',
    label: 'B1 — mstts:express-as style="chat" on the trailing clause (Ana)',
    voice: 'en-US-AnaNeural',
    text: SAMPLE_TEXT,
    buildSsml(text) {
      const { lead, clause } = splitTrailingClause(text)
      return (
        speakOpen(true) +
        `<voice name="en-US-AnaNeural">` +
        `<prosody ${OUTER}>` +
        `${escapeSsml(lead)}${expressAsWrap(clause, 'chat')}` +
        `</prosody></voice></speak>`
      )
    },
  },

  // ── B2. mstts:express-as style="cheerful" ────────────────────────────
  {
    id: 'B2-express-as-cheerful',
    label:
      'B2 — mstts:express-as style="cheerful" on the trailing clause (Ana)',
    voice: 'en-US-AnaNeural',
    text: SAMPLE_TEXT,
    buildSsml(text) {
      const { lead, clause } = splitTrailingClause(text)
      return (
        speakOpen(true) +
        `<voice name="en-US-AnaNeural">` +
        `<prosody ${OUTER}>` +
        `${escapeSsml(lead)}${expressAsWrap(clause, 'cheerful')}` +
        `</prosody></voice></speak>`
      )
    },
  },

  // ── B3. mstts:express-as style="friendly" ────────────────────────────
  // CAVEAT: per the Azure docs (Voice styles and roles table), en-US-Ana
  // Neural is NOT listed as supporting any mstts:express-as styles.
  // B1/B2/B3 may therefore 400-reject. Kept in the test set anyway —
  // the docs are sometimes incomplete and an empirical 400 is a
  // definitive answer either way. The harness shows render errors
  // inline, so a failed strategy doesn't block the others.
  {
    id: 'B3-express-as-friendly',
    label:
      'B3 — mstts:express-as style="friendly" on the trailing clause (Ana)',
    voice: 'en-US-AnaNeural',
    text: SAMPLE_TEXT,
    buildSsml(text) {
      const { lead, clause } = splitTrailingClause(text)
      return (
        speakOpen(true) +
        `<voice name="en-US-AnaNeural">` +
        `<prosody ${OUTER}>` +
        `${escapeSsml(lead)}${expressAsWrap(clause, 'friendly')}` +
        `</prosody></voice></speak>`
      )
    },
  },

  // ── B4. mstts:express-as style="chat" on Emma (multilingual) ─────────
  // Emma's multilingual voice is documented to support a range of
  // express-as styles. If B1-B3 reject on Ana, this is the fallback
  // path: combine "different voice" (C1) with "expressive style".
  {
    id: 'B4-emma-express-as-chat',
    label: 'B4 — en-US-EmmaMultilingualNeural + mstts:express-as style="chat"',
    voice: 'en-US-EmmaMultilingualNeural',
    text: SAMPLE_TEXT,
    buildSsml(text) {
      const { lead, clause } = splitTrailingClause(text)
      return (
        speakOpen(true) +
        `<voice name="en-US-EmmaMultilingualNeural">` +
        `<prosody ${OUTER}>` +
        `${escapeSsml(lead)}${expressAsWrap(clause, 'chat')}` +
        `</prosody></voice></speak>`
      )
    },
  },

  // ── C1. en-US-EmmaMultilingualNeural with strategy A ─────────────────
  {
    id: 'C1-emma-multilingual-baseline',
    label: 'C1 — en-US-EmmaMultilingualNeural + production baseline SSML',
    voice: 'en-US-EmmaMultilingualNeural',
    text: SAMPLE_TEXT,
    buildSsml(text) {
      const { lead, clause } = splitTrailingClause(text)
      return (
        speakOpen(false) +
        `<voice name="en-US-EmmaMultilingualNeural">` +
        `<prosody ${OUTER}>` +
        `${escapeSsml(lead)}${strategyAWrap(clause)}` +
        `</prosody></voice></speak>`
      )
    },
  },

  // ── C2. en-US-AvaMultilingualNeural with strategy A ──────────────────
  {
    id: 'C2-ava-multilingual-baseline',
    label: 'C2 — en-US-AvaMultilingualNeural + production baseline SSML',
    voice: 'en-US-AvaMultilingualNeural',
    text: SAMPLE_TEXT,
    buildSsml(text) {
      const { lead, clause } = splitTrailingClause(text)
      return (
        speakOpen(false) +
        `<voice name="en-US-AvaMultilingualNeural">` +
        `<prosody ${OUTER}>` +
        `${escapeSsml(lead)}${strategyAWrap(clause)}` +
        `</prosody></voice></speak>`
      )
    },
  },

  // ── A2. Production strategy with a much louder pitch+rate hint ───────
  // Sanity check: if A sounds flat, is it because Azure ignored the
  // wrap entirely, or because +8% / -5% is too subtle to hear? A2
  // doubles the contour (+18% pitch, -15% rate). If A2 ALSO sounds
  // flat, the engine is ignoring the wrap (and we need a different
  // strategy entirely). If A2 sounds rising-but-overcooked, A's
  // numbers are just too quiet.
  {
    id: 'A2-baseline-aggressive',
    label:
      'A2 — Baseline shape with aggressive pitch (+18%) and rate (-15%) on the clause',
    voice: 'en-US-AnaNeural',
    text: SAMPLE_TEXT,
    buildSsml(text) {
      const { lead, clause } = splitTrailingClause(text)
      const wrap =
        `<break time="250ms"/><prosody pitch="+18%" rate="-15%">` +
        `${escapeSsml(clause)}` +
        `</prosody>`
      return (
        speakOpen(false) +
        `<voice name="en-US-AnaNeural">` +
        `<prosody ${OUTER}>` +
        `${escapeSsml(lead)}${wrap}` +
        `</prosody></voice></speak>`
      )
    },
  },

  // ── D. say-as per-word last-resort hack on AnaNeural ─────────────────
  {
    id: 'D-say-as-characters',
    label: 'D — say-as interpret-as="characters" on each trailing word (Ana)',
    voice: 'en-US-AnaNeural',
    text: SAMPLE_TEXT,
    buildSsml(text) {
      const { lead, clause } = splitTrailingClause(text)
      return (
        speakOpen(false) +
        `<voice name="en-US-AnaNeural">` +
        `<prosody ${OUTER}>` +
        `${escapeSsml(lead)}${sayAsCharactersWrap(clause)}` +
        `</prosody></voice></speak>`
      )
    },
  },
]

// ── Azure call ───────────────────────────────────────────────────────────

const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
const AZURE_ENDPOINT = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`

async function synthesize(ssml) {
  const res = await fetch(AZURE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
      'User-Agent': 'marian-tutor-prosody-audit/1.0',
    },
    body: ssml,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Azure TTS ${res.status}: ${body.slice(0, 200)}`)
  }
  return new Uint8Array(await res.arrayBuffer())
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Driver ──────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  const manifest = {
    generatedAt: new Date().toISOString(),
    region: AZURE_REGION,
    outputFormat: AZURE_OUTPUT_FORMAT,
    sampleText: SAMPLE_TEXT,
    samples: [],
  }

  for (const strategy of STRATEGIES) {
    const ssml = strategy.buildSsml(strategy.text)
    if (DRY_RUN) {
      console.log(`\n=== ${strategy.id} ===`)
      console.log(`label: ${strategy.label}`)
      console.log(`voice: ${strategy.voice}`)
      console.log(`ssml : ${ssml}`)
      manifest.samples.push({
        id: strategy.id,
        label: strategy.label,
        voice: strategy.voice,
        text: strategy.text,
        ssml,
        file: `${strategy.id}.mp3`,
        bytes: 0,
      })
      continue
    }
    process.stdout.write(`Synthesizing ${strategy.id} ... `)
    try {
      const bytes = await synthesize(ssml)
      const file = `${strategy.id}.mp3`
      writeFileSync(join(OUT_DIR, file), bytes)
      manifest.samples.push({
        id: strategy.id,
        label: strategy.label,
        voice: strategy.voice,
        text: strategy.text,
        ssml,
        file,
        bytes: bytes.length,
      })
      console.log(`ok (${bytes.length}B)`)
    } catch (err) {
      console.log(`FAILED — ${err.message}`)
      manifest.samples.push({
        id: strategy.id,
        label: strategy.label,
        voice: strategy.voice,
        text: strategy.text,
        ssml,
        error: err.message,
      })
    }
    // Polite pacing — F0 tier is 20 tx/s; we want headroom.
    await sleep(150)
  }

  if (DRY_RUN) {
    console.log(
      `\nDry-run complete — ${manifest.samples.length} SSML bodies above.`,
    )
    console.log(`Skipping manifest.json write so we don't shadow real outputs.`)
    return
  }

  writeFileSync(
    join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  )
  console.log(`\nWrote ${manifest.samples.length} samples + manifest.json`)
  console.log(`Open public/audio-samples/index.html to listen locally,`)
  console.log(`or push the branch and use the Vercel preview URL`)
  console.log(`(/audio-samples/index.html on the deploy preview).`)
}

main().catch((err) => {
  console.error('\nFATAL:', err)
  process.exit(1)
})
