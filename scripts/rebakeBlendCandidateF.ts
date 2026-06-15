/**
 * BLEND-SLOT canon re-bake — candidate f, "lightly-released stops".
 *
 * Why this exists (vs. revoiceCanonTargeted.ts / canon:regen --force)
 * ------------------------------------------------------------------
 * Thomas ear-tested ~37/40 baked `word.p<N>.blend` clips as FAIL (scratchy,
 * unreleased stops — "scratch no C, then AT then CAT", voice-QA #463). After
 * auditioning 7 candidate SSML treatments (PR #465), he picked candidate f —
 * lightly-released stops — for ALL words. That treatment is now ported into the
 * production `renderBlendInnerText` (api/_tts.ts): STOP consonants (b/c/k/d/g/
 * p/t) get a clipped `<stop>ə` IPA release; continuants + vowels stay bare;
 * break-AFTER each phoneme; no whole-line `<prosody rate>` wrap.
 *
 * This script re-renders ONLY the `word.p<N>.blend` audio of the 5 CVC tiers in
 * place (same id, same text, new candidate-f bytes) and leaves every other
 * utterance byte-for-byte untouched. Same shape as `revoiceCanonTargeted.ts`
 * (re-render existing ids in place) — NOT additive like `bakeRecapFocus.ts` /
 * `rebakeThreeHint.ts`.
 *
 * A full `canon:regen --force` is wrong here: Azure TTS is not byte-deterministic
 * across bake runs (see planner-and-canon.md "splice, don't re-bake"), so a full
 * run churns every clip's bytes and flips the entire voice-QA baseline to
 * needs-retest. This script touches only the 40 blend clips.
 *
 * Determinism (no re-planning)
 * ----------------------------
 * The blend TEXT is already committed in each tier's canon (`"c - a - t ... cat"`
 * etc.) and is NOT re-derived — we lift each `word.p<N>.blend` text verbatim and
 * re-render its audio. The candidate-f transform is entirely SSML-side
 * (renderBlendInnerText); the stored caption text never changes.
 *
 * tierFilter
 * ----------
 * Blend audio is gated on `tierFilter ∈ BLEND_CVC_TIERS` (api/_tts.ts). Each CVC
 * tier's focus node IS the tier name (all in WORD_SONG_FIRST_CLASS_FOCUS_NODES),
 * so we render with `tierFilter = <tier>` — mirroring
 * `generateSessionStartResponse`'s word-song `tierFilter = effectiveFocusNode`.
 * That is what routes the text through `renderBlendInnerText`'s candidate-f path.
 *
 * Run: `npx tsx scripts/rebakeBlendCandidateF.ts`         (renders + writes)
 *      `npx tsx scripts/rebakeBlendCandidateF.ts --dry`   (lists blend texts, NO
 *                                                           Azure calls)
 *      `npx tsx scripts/rebakeBlendCandidateF.ts --tiers cvc-words,cvc-words-short-o`
 * Reads `.env.local` for AZURE_SPEECH_KEY / AZURE_SPEECH_REGION (quote-stripped).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSessionAudio } from '../api/_session.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORD_SONG_CANON_DIR = join(REPO_ROOT, 'public/canon/word-song/level-1')

/** The 5 CVC tiers carrying a `blend` slot (mirror BLEND_CVC_TIERS in _tts.ts).
 *  Each tier name is also its focus node => its tierFilter. */
const BLEND_TIERS: readonly string[] = [
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
]

// ── .env.local loader (mirrors rebakeThreeHint.ts — quote-strip is load-bearing,
//    .env.local values are quote-wrapped: AZURE_SPEECH_REGION="westeurope") ─────
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

// ── canon file shapes (mirror rebakeThreeHint.ts) ───────────────────────────
interface SkeletonUtterance {
  id: string
  text: string
}
interface AudioUtterance {
  id: string
  text: string
  audio: { kind: string; base64: string; mime: string }
}
interface CanonFile {
  ok: boolean
  kind: string
  plan: { id: string; label: string; utterances: SkeletonUtterance[] }
  utterances: AudioUtterance[]
}

const BLEND_ID_RE = /^word\.p[1-8]\.blend$/

/** Collect this file's blend utterances (audio-side only — the blend slot does
 *  NOT appear in the plan.utterances skeleton; verified across all 5 tiers). */
function collectBlends(canon: CanonFile): AudioUtterance[] {
  const blends = canon.utterances.filter((u) => BLEND_ID_RE.test(u.id))
  if (blends.length === 0) {
    throw new Error('no word.p<N>.blend utterances found — wrong tier file?')
  }
  return blends
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry')
  const tiers = resolveTiers(process.argv)
  loadEnvLocal()
  if (
    !dryRun &&
    (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION)
  ) {
    console.error(
      'ERROR: AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set (.env.local). ' +
        'Run with --dry to preview without rendering.',
    )
    process.exit(1)
  }

  let totalReBaked = 0
  for (const tier of tiers) {
    const path = join(WORD_SONG_CANON_DIR, `${tier}.json`)
    if (!existsSync(path)) {
      throw new Error(`canon file missing: ${path} (${tier})`)
    }
    const canon = JSON.parse(readFileSync(path, 'utf8')) as CanonFile
    const blends = collectBlends(canon)

    console.log(`\n=== ${tier} (${blends.length} blend clips) ===`)
    for (const b of blends) console.log(`  ${b.id}: ${b.text}`)

    if (dryRun) {
      totalReBaked += blends.length
      continue
    }

    // Re-render the blend clips through the SAME pipeline the handler uses,
    // with this tier's tierFilter so renderBlendInnerText fires candidate f.
    process.stdout.write(`  rendering ${blends.length} blend clips ... `)
    const response = await renderSessionAudio(
      {
        id: canon.plan.id,
        label: canon.plan.label,
        utterances: blends.map((b) => ({ id: b.id, text: b.text })),
      },
      { tierFilter: tier },
    )
    if (response.utterances.length !== blends.length) {
      throw new Error(
        `partial render: ${response.utterances.length}/${blends.length} for ${tier} (NOT writing)`,
      )
    }
    const rendered = new Map<string, AudioUtterance['audio']>()
    for (const u of response.utterances) {
      rendered.set(u.id, u.audio as AudioUtterance['audio'])
    }

    // In-place audio swap: same id, same text, new bytes. Every NON-blend
    // utterance keeps its object reference (and thus its exact bytes).
    for (const u of canon.utterances) {
      if (!BLEND_ID_RE.test(u.id)) continue
      const audio = rendered.get(u.id)
      if (!audio) throw new Error(`no rendered audio for ${u.id}`)
      u.audio = audio
    }

    writeFileSync(path, JSON.stringify(canon), 'utf8')
    totalReBaked += blends.length
    console.log('ok')
  }

  console.log(
    `\nDone. ${dryRun ? '[--dry] would re-bake' : 're-baked'} ${totalReBaked} ` +
      `blend clips across ${tiers.length} tier(s).`,
  )
}

function resolveTiers(argv: readonly string[]): string[] {
  const eqArg = argv.find((a) => a.startsWith('--tiers='))
  let raw: string | undefined = eqArg?.slice('--tiers='.length)
  if (raw === undefined) {
    const idx = argv.indexOf('--tiers')
    if (idx >= 0 && idx + 1 < argv.length) raw = argv[idx + 1]
  }
  if (raw === undefined) return [...BLEND_TIERS]
  const tiers = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const t of tiers) {
    if (!BLEND_TIERS.includes(t)) {
      console.error(
        `ERROR: tier "${t}" has no blend slot ` +
          `(supported: ${BLEND_TIERS.join(', ')})`,
      )
      process.exit(1)
    }
  }
  return tiers
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
