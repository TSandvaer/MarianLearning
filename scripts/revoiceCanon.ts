/**
 * TEXT-PRESERVING canon re-voice (British-voice rollout fix).
 *
 * Why this exists
 * ---------------
 * The British-voice rollout originally re-baked ALL canon via
 * `generateSessionCanon.ts`, which regenerates the utterance TEXT via
 * Haiku (stochastic) AND re-renders audio. That drifted the TEXT of
 * every non-letter-sounds tier (sub-to-10 facts, letter-names targets,
 * etc.), breaking the canon-aware e2e specs.
 *
 * A voice swap must preserve TEXT and change only AUDIO. This script
 * does exactly that for EVERY canon file EXCEPT the two letter-sounds
 * files (whose TEXT change is the intended feature):
 *   1. Read the canon JSON's TEXT from `origin/main` (the canonical,
 *      pre-rollout text) — NOT from the working tree (which carries the
 *      drifted text).
 *   2. Re-render each utterance's AUDIO on the current EMMA_VOICE_CONFIG
 *      voice (en-GB-OliviaNeural) via the SAME `renderSessionAudio` the
 *      production handler uses, passing the production `tierFilter` for
 *      the tier so the SSML treatment matches production exactly.
 *   3. Write the canon with main's EXACT text/structure + new Olivia
 *      audio.
 *
 * Result: `git diff origin/main -- <non-letter-sounds canon>` shows ONLY
 * audio-base64 changes, NO text changes.
 *
 * letter-sounds.json + letter-sounds-audit.json are SKIPPED — they keep
 * the branch's new pinned/anchored text (baked by
 * scripts/bakeLetterSoundsPinned.ts).
 *
 * Run: `npx tsx scripts/revoiceCanon.ts`
 * Reads `.env.local` for AZURE_SPEECH_KEY / AZURE_SPEECH_REGION.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSessionAudio } from '../api/_session.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── .env.local loader (KEY=VALUE; strips surrounding quotes) ────────────
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

interface CanonShape {
  ok: boolean
  kind: string
  plan: {
    id: string
    label: string
    utterances: Array<{ id: string; text: string }>
  }
  utterances: Array<{ id: string; text: string; audio: unknown }>
}

/** The production tierFilter for a canon file, mirroring
 *  `generateSessionStartResponse`: math → undefined; word-song → the
 *  focus node (file basename). letter-sounds is excluded entirely. */
function tierFilterFor(relPath: string): string | undefined {
  if (relPath.includes('/math/')) return undefined
  // word-song: focus node = file basename without .json
  const base = relPath
    .split('/')
    .pop()!
    .replace(/\.json$/, '')
  return base
}

/** Read a canon file's TEXT from origin/main (the pre-rollout canonical
 *  text). Returns the parsed plan ({id,label,utterances:[{id,text}]}). */
function mainPlanOf(relPath: string): CanonShape['plan'] {
  const json = execFileSync('git', ['show', `origin/main:${relPath}`], {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024 * 256,
  }).toString('utf8')
  const canon = JSON.parse(json) as CanonShape
  // Pass the FULL plan (id + label + utterances:[{id,text}]) so the
  // re-rendered canon keeps main's exact text + structure.
  return {
    id: canon.plan.id,
    label: canon.plan.label,
    utterances: canon.plan.utterances.map((u) => ({ id: u.id, text: u.text })),
  }
}

// EVERY canon file EXCEPT the two letter-sounds files.
const TARGET_FILES: readonly string[] = [
  'public/canon/math/level-1/add-to-10.json',
  'public/canon/math/level-1/add-to-20.json',
  'public/canon/math/level-1/mult-2-5-10.json',
  'public/canon/math/level-1/mult-3-4.json',
  'public/canon/math/level-1/mult-6-9.json',
  'public/canon/math/level-1/number-recog.json',
  'public/canon/math/level-1/skip-counting.json',
  'public/canon/math/level-1/sub-to-10.json',
  'public/canon/math/level-1/sub-to-20.json',
  'public/canon/math/level-1/two-digit-addsub-with-regroup.json',
  'public/canon/math/level-1/two-digit-addsub.json',
  'public/canon/word-song/level-1/blending-cv.json',
  'public/canon/word-song/level-1/cvc-words-short-e.json',
  'public/canon/word-song/level-1/cvc-words-short-i.json',
  'public/canon/word-song/level-1/cvc-words-short-o.json',
  'public/canon/word-song/level-1/cvc-words-short-u.json',
  'public/canon/word-song/level-1/cvc-words.json',
  'public/canon/word-song/level-1/digraphs-ch.json',
  'public/canon/word-song/level-1/digraphs-sh.json',
  'public/canon/word-song/level-1/digraphs-th-voiceless.json',
  'public/canon/word-song/level-1/letter-names.json',
]

async function main(): Promise<void> {
  loadEnvLocal()
  if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
    console.error(
      'ERROR: AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set (add to .env.local).',
    )
    process.exit(1)
  }

  let okCount = 0
  let failCount = 0
  for (const relPath of TARGET_FILES) {
    const plan = mainPlanOf(relPath)
    const tierFilter = tierFilterFor(relPath)
    process.stdout.write(
      `revoice ${relPath} (${plan.utterances.length} utt, tier=${tierFilter ?? 'none'}) ... `,
    )
    try {
      const response = await renderSessionAudio(plan, { tierFilter })
      // COMPLETENESS GUARD: renderSessionAudio soft-fails per utterance
      // (a failed render is dropped from `utterances`). A partial would
      // silently ship a canon missing audio. Require a full render — if
      // any utterance failed, do NOT write; surface it as a failure so
      // the run is re-attempted (Azure transient 429/network).
      const rendered = response.utterances.length
      const expected = plan.utterances.length
      if (rendered !== expected) {
        throw new Error(
          `partial render: ${rendered}/${expected} utterances (NOT writing)`,
        )
      }
      // renderSessionAudio echoes `plan` through verbatim; assemble the
      // canon with main's exact plan text + the new Olivia audio.
      const out = { ...response, plan }
      const json = JSON.stringify(out)
      writeFileSync(join(REPO_ROOT, relPath), json, 'utf8')
      console.log(`ok (${(json.length / 1024).toFixed(0)}KB, ${rendered} utt)`)
      okCount += 1
    } catch (err) {
      console.log(
        `FAILED — ${err instanceof Error ? err.message : String(err)}`,
      )
      failCount += 1
    }
  }

  console.log(
    `\nDone. ${okCount} re-voiced, ${failCount} failed. ` +
      `letter-sounds.json + letter-sounds-audit.json intentionally skipped ` +
      `(branch keeps their new text).`,
  )
  if (failCount > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
