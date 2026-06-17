/**
 * BYTE-PRESERVATION PROOF for the pass-7 /v/+/w/ recovery blend re-bake.
 *
 * Baseline here is the MERGED PASS-5 canon (origin/main = `bccd332` or later),
 * NOT the candidate-f baseline. Pass-7 recovered /v/ and /w/ from the
 * whole-word FLOOR to the held + schwa-tail nested-prosody onset (`vːə`/`wːə`
 * @ -25%, mirroring the pass-5 /f/+/s/ shape Thomas picked). /f/, /s/, /h/, the
 * stops, continuants, vowels, and the still-floored /dʒ/(j) are ALL UNCHANGED
 * from pass-5, so they re-render byte-identically (identical SSML against the
 * same bake resource → identical bytes — the in-resource deterministic case).
 *
 * Therefore, relative to the pass-5 baseline, the ONLY clips that change are
 * blend words whose graphemes include `v` or `w`. Across the 5 CVC tiers those
 * are exactly: van (/v/), wig (/w/), web (/w/) — 3 clips. Everything else is
 * byte-identical, including every f/s/h/j blend clip (whose pass-7 SSML equals
 * its pass-5 SSML).
 *
 * Invariants proven (mirror verifyBlendBytePreservation.ts, divergence set
 * narrowed to {v, w}):
 *   - every PRE-EXISTING NON-blend id (read/correct/reprompt/hint/giveAnswer +
 *     the shared session.end.* family) is base64 byte-identical to the baseline,
 *     in BOTH the audio-side `utterances[]` and the `plan.utterances[]` skeleton;
 *   - every blend clip with a `v` or `w` grapheme CHANGED (FLOOR → held onset);
 *   - every other blend clip (f/s/h/j/stop/continuant/vowel only) stayed
 *     byte-IDENTICAL — its pass-7 SSML equals its pass-5 SSML verbatim;
 *   - no id was added or removed; no blend clip's TEXT changed.
 *
 * The baseline is read straight from a git ref (default origin/main) via
 * `git show`, so the proof is independent of the bake script.
 *
 * Exit 0 + "BYTE-PRESERVATION: PASS" iff every invariant holds; non-zero
 * otherwise. The printed summary is the artifact quoted in the PR body
 * (feedback_canon_state_empirical_verification).
 *
 * Run: `npx tsx scripts/verifyBlendBytePreservationPass7.ts`
 *      `npx tsx scripts/verifyBlendBytePreservationPass7.ts --base <ref>`
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBlendText } from '../api/_tts.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const BLEND_TIERS: readonly string[] = [
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
]
const BLEND_ID_RE = /^word\.p[1-8]\.blend$/

/** Graphemes whose pass-7 full-fidelity render DIVERGES from the MERGED PASS-5
 *  baseline: ONLY v and w (FLOOR → held nested-prosody onset). f/s/h/j and all
 *  stop/continuant/vowel graphemes are unchanged from pass-5 → byte-identical.
 *  A blend word containing v or w MUST have changed bytes; any other word MUST
 *  stay byte-identical. Mirrors the pass-5→pass-7 delta in _tts.ts:
 *  BLEND_FRICATIVE_ONSET_IPA gained {v, w}; BLEND_FLOOR_GRAPHEMES lost {v, w}. */
const PASS7_DIVERGING_GRAPHEMES: ReadonlySet<string> = new Set(['v', 'w'])

/** Does this blend word's pass-7 render diverge from the pass-5 baseline? */
function blendWordDiverges(blendText: string): boolean {
  const parsed = parseBlendText(blendText)
  if (parsed === null) return false
  return parsed.graphemes.some((g) =>
    PASS7_DIVERGING_GRAPHEMES.has(g.toLowerCase()),
  )
}

interface SkeletonUtterance {
  id: string
  text: string
}
interface AudioUtterance {
  id: string
  text: string
  audio?: { kind: string; base64: string; mime: string }
}
interface CanonFile {
  plan: { utterances: SkeletonUtterance[] }
  utterances: AudioUtterance[]
}

function sha(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function readBaseline(ref: string, relPath: string): CanonFile {
  const raw = execFileSync('git', ['show', `${ref}:${relPath}`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(raw) as CanonFile
}

function readWorking(absPath: string): CanonFile {
  return JSON.parse(readFileSync(absPath, 'utf8')) as CanonFile
}

function resolveArg(name: string): string | undefined {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(`--${name}=`.length)
  const idx = process.argv.indexOf(`--${name}`)
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  return undefined
}

function main(): void {
  const base = resolveArg('base') ?? 'origin/main'

  let nonBlendChecked = 0
  let nonBlendMismatches = 0
  let blendDivergingChanged = 0
  let blendNonDivergingIdentical = 0
  let blendDivergingUnchanged = 0
  let blendNonDivergingChanged = 0
  const changedClips: string[] = []
  const failures: string[] = []

  for (const tier of BLEND_TIERS) {
    const rel = `public/canon/word-song/level-1/${tier}.json`
    const abs = join(REPO_ROOT, rel)
    const before = readBaseline(base, rel)
    const after = readWorking(abs)

    const beforeById = new Map(before.utterances.map((u) => [u.id, u]))
    const afterById = new Map(after.utterances.map((u) => [u.id, u]))

    // No id added or removed (audio-side).
    for (const id of beforeById.keys()) {
      if (!afterById.has(id)) failures.push(`${tier}: id ${id} DISAPPEARED`)
    }
    for (const id of afterById.keys()) {
      if (!beforeById.has(id)) failures.push(`${tier}: unexpected new id ${id}`)
    }

    for (const [id, beforeU] of beforeById) {
      const afterU = afterById.get(id)
      if (!afterU) continue // already flagged disappeared
      const b64Before = beforeU.audio?.base64 ?? ''
      const b64After = afterU.audio?.base64 ?? ''
      if (BLEND_ID_RE.test(id)) {
        // Blend TEXT must be unchanged; only the audio bytes move.
        if (beforeU.text !== afterU.text) {
          failures.push(
            `${tier}: blend ${id} TEXT changed (must stay the same)`,
          )
        }
        const changed = sha(b64Before) !== sha(b64After)
        // Pass-7 expectation is per-word: a clip with a v/w grapheme diverges
        // from the pass-5 baseline (FLOOR → held onset) and MUST change; every
        // other clip's pass-7 SSML equals its pass-5 SSML and MUST stay
        // byte-identical.
        const diverges = blendWordDiverges(afterU.text)
        if (diverges && changed) {
          blendDivergingChanged++
          changedClips.push(`${tier}/${id} (${afterU.text})`)
        } else if (diverges && !changed) {
          failures.push(
            `${tier}: blend ${id} (${afterU.text}) has a v/w grapheme but ` +
              `bytes UNCHANGED (held-onset full-fidelity render did not take)`,
          )
          blendDivergingUnchanged++
        } else if (!diverges && !changed) {
          blendNonDivergingIdentical++
        } else {
          // !diverges && changed — a non-v/w word's bytes moved, which means
          // either the SSML changed unexpectedly OR Azure returned
          // non-deterministic bytes for identical SSML. Either way it breaks
          // the splice-only guarantee for an unchanged-SSML clip.
          failures.push(
            `${tier}: blend ${id} (${afterU.text}) has NO v/w grapheme but ` +
              `bytes CHANGED (non-deterministic re-render — should be identical)`,
          )
          blendNonDivergingChanged++
        }
      } else {
        // Every non-blend clip MUST be byte-identical.
        nonBlendChecked++
        if (sha(b64Before) !== sha(b64After)) {
          failures.push(`${tier}: non-blend id ${id} base64 CHANGED`)
          nonBlendMismatches++
        }
      }
    }

    // Skeleton (plan.utterances) carries no blend slot — must be fully identical.
    const skelBefore = JSON.stringify(before.plan.utterances)
    const skelAfter = JSON.stringify(after.plan.utterances)
    if (sha(skelBefore) !== sha(skelAfter)) {
      failures.push(`${tier}: plan.utterances skeleton CHANGED`)
    }
  }

  console.log(
    '=== pass-7 /v/+/w/ recovery blend re-bake byte-preservation proof ===',
  )
  console.log(`baseline ref:                       ${base}`)
  console.log(`tiers:                              ${BLEND_TIERS.length}`)
  console.log(`non-blend clips checked:            ${nonBlendChecked}`)
  console.log(`non-blend mismatches:               ${nonBlendMismatches}`)
  console.log(`blend diverging (v/w) ↻:            ${blendDivergingChanged}`)
  console.log(
    `blend non-diverging identical:      ${blendNonDivergingIdentical}`,
  )
  console.log(`blend diverging UNCHANGED (bad):    ${blendDivergingUnchanged}`)
  console.log(`blend non-diverging CHANGED (bad):  ${blendNonDivergingChanged}`)
  if (changedClips.length) {
    console.log('\nChanged blend clips (expected = van, wig, web):')
    for (const c of changedClips) console.log(`  ↻ ${c}`)
  }
  if (failures.length) {
    console.log(`\nFAILURES (${failures.length}):`)
    for (const f of failures.slice(0, 40)) console.log(`  - ${f}`)
    if (failures.length > 40) console.log(`  ... +${failures.length - 40} more`)
    console.log('\nBYTE-PRESERVATION: FAIL')
    process.exit(1)
  }
  console.log('\nBYTE-PRESERVATION: PASS')
  console.log(
    `(${nonBlendChecked} non-blend clips byte-identical; ` +
      `${blendDivergingChanged} v/w blend clips re-rendered, ` +
      `${blendNonDivergingIdentical} other blend clips byte-identical, ` +
      `across ${BLEND_TIERS.length} tiers)`,
  )
}

main()
