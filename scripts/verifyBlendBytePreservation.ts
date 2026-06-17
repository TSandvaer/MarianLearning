/**
 * BYTE-PRESERVATION PROOF for the pass-5 FULL-FIDELITY blend re-bake.
 *
 * Proves the re-bake touched ONLY the `word.p<N>.blend` clips of the 5 CVC
 * tiers, and within those, ONLY the clips whose full-fidelity SSML actually
 * diverges from origin/main's candidate-f baseline:
 *   - every PRE-EXISTING NON-blend id (read/correct/reprompt/hint/giveAnswer +
 *     the shared session.end.* family) has base64 audio byte-identical to the
 *     baseline, in BOTH the audio-side `utterances[]` and the `plan.utterances[]`
 *     skeleton;
 *   - every blend clip with a DIVERGING grapheme (f/s/h or a floored v/j/w)
 *     CHANGED — these are the only clips whose pass-5 render differs from the
 *     candidate-f baseline on main;
 *   - every blend clip with ONLY stop/continuant/vowel graphemes stayed
 *     byte-IDENTICAL — its full-fidelity SSML equals the candidate-f baseline
 *     verbatim, and Azure re-rendered identical bytes (the common in-resource
 *     deterministic case; see planner-and-canon.md "Azure TTS renders are NOT
 *     byte-deterministic across separate bake calls" — divergence is the
 *     exception, identical-SSML→identical-bytes is the norm). This is the
 *     pass-5 difference from the candidate-f pass, where ALL 40 blend clips
 *     changed because candidate-f differed from the prior bare-stop render;
 *   - no id was added or removed; no blend clip's TEXT changed.
 *
 * The baseline is read straight from a git ref (default origin/main) via
 * `git show`, so the proof is independent of the bake script.
 *
 * Exit 0 + "BYTE-PRESERVATION: PASS" iff every invariant holds; non-zero
 * otherwise. The printed summary is the artifact quoted in the PR body
 * (feedback_canon_state_empirical_verification).
 *
 * Run: `npx tsx scripts/verifyBlendBytePreservation.ts`
 *      `npx tsx scripts/verifyBlendBytePreservation.ts --base <ref>`
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

/** Graphemes whose pass-5 full-fidelity render DIVERGES from the candidate-f
 *  baseline on main: f/s get the nested-prosody fricative onset, h gets the
 *  `hə` fric-rel (was bare on main), and v/j/w force the whole-word floor. A
 *  blend word containing ANY of these MUST have changed bytes; a word with only
 *  stop/continuant/vowel graphemes renders byte-identically to candidate-f.
 *  Mirrors BLEND_FRICATIVE_ONSET_IPA ∪ {h} ∪ BLEND_FLOOR_GRAPHEMES in _tts.ts. */
const PASS5_DIVERGING_GRAPHEMES: ReadonlySet<string> = new Set([
  'f',
  's',
  'h',
  'v',
  'j',
  'w',
])

/** Does this blend word's full-fidelity render diverge from candidate-f? */
function blendWordDiverges(blendText: string): boolean {
  const parsed = parseBlendText(blendText)
  if (parsed === null) return false
  return parsed.graphemes.some((g) =>
    PASS5_DIVERGING_GRAPHEMES.has(g.toLowerCase()),
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
        // Pass-5 expectation is per-word: a clip with an f/s/h/v/j/w grapheme
        // diverges from main's candidate-f and MUST change; a clip with only
        // stop/continuant/vowel graphemes renders byte-identically to
        // candidate-f and MUST stay unchanged.
        const diverges = blendWordDiverges(afterU.text)
        if (diverges && changed) {
          blendDivergingChanged++
        } else if (diverges && !changed) {
          failures.push(
            `${tier}: blend ${id} (${afterU.text}) has a diverging ` +
              `grapheme but bytes UNCHANGED (full-fidelity render did not take)`,
          )
          blendDivergingUnchanged++
        } else if (!diverges && !changed) {
          blendNonDivergingIdentical++
        } else {
          // !diverges && changed — a stop/continuant/vowel-only word's bytes
          // moved, which means either the SSML changed unexpectedly OR Azure
          // returned non-deterministic bytes for identical SSML. Either way it
          // breaks the splice-only guarantee for an unchanged-SSML clip.
          failures.push(
            `${tier}: blend ${id} (${afterU.text}) has NO diverging grapheme ` +
              `but bytes CHANGED (non-deterministic re-render — should be identical)`,
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
    '=== pass-5 full-fidelity blend re-bake byte-preservation proof ===',
  )
  console.log(`baseline ref:                       ${base}`)
  console.log(`tiers:                              ${BLEND_TIERS.length}`)
  console.log(`non-blend clips checked:            ${nonBlendChecked}`)
  console.log(`non-blend mismatches:               ${nonBlendMismatches}`)
  console.log(`blend diverging (f/s/h/v/j/w) ↻:    ${blendDivergingChanged}`)
  console.log(
    `blend non-diverging identical:      ${blendNonDivergingIdentical}`,
  )
  console.log(`blend diverging UNCHANGED (bad):    ${blendDivergingUnchanged}`)
  console.log(`blend non-diverging CHANGED (bad):  ${blendNonDivergingChanged}`)
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
      `${blendDivergingChanged} diverging blend clips re-rendered, ` +
      `${blendNonDivergingIdentical} non-diverging blend clips byte-identical, ` +
      `across ${BLEND_TIERS.length} tiers)`,
  )
}

main()
